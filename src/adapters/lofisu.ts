import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  BenchContext,
  BenchEvent,
  Capability,
  Outbound,
  StateSnapshot,
  SubjectAdapter,
} from "../types.js";

interface LofisuOutboxRow {
  id: string;
  replyId: string;
  ticketId: string;
  channel: string;
  thread: string;
  text: string;
  status: string;
  idempotencyKey?: string;
  createdAt: string;
}

interface LofisuTicket {
  ended?: unknown;
  assignments?: Array<{ state?: string }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface LofisuRuntime {
  store: {
    isOpen: boolean;
    listOutbox(): LofisuOutboxRow[];
    listDocs<T>(kind: string): T[];
    listEvents(): Array<{ type: string }>;
  };
  start(options?: { assessPending?: boolean; routines?: boolean }): void;
  ingest(trigger: unknown): string;
  jobsSettled(): Promise<void>;
  finish(): Promise<void>;
}

interface LofisuRuntimeConstructor {
  create(options: Record<string, unknown>): LofisuRuntime;
}

interface SubjectMeta {
  source?: string;
  commit?: string;
  version?: string;
}

function readMeta(root: string): SubjectMeta {
  const metaPath = join(root, "subject.json");
  if (!existsSync(metaPath)) return {};
  try {
    return JSON.parse(readFileSync(metaPath, "utf8")) as SubjectMeta;
  } catch {
    return {};
  }
}

/**
 * In-process adapter for LofiSu/deepseek-super-agent.
 *
 * It imports the subject's Runtime from a local checkout (or a prepared copy),
 * injects synthetic `im` triggers, reads the durable outbox, and recreates the
 * Runtime with the same home to simulate a restart. It uses a deterministic
 * scripted model and never calls a real provider.
 */
export class LofisuAdapter implements SubjectAdapter {
  readonly id = "lofisu";
  readonly mode = "in-process" as const;
  readonly capabilities: ReadonlySet<Capability> = new Set<Capability>([
    "event-injection",
    "outbound-capture",
    "authorization",
    "state-snapshot",
    "ticket-count",
    "eval-count",
    "restart",
    "work-active",
  ]);

  readonly version: string;
  readonly commit: string;

  private root: string;
  private runtime: LofisuRuntime | undefined;
  private runtimeCtor: LofisuRuntimeConstructor | undefined;
  private home = "";
  private allowedActors: string[] = [];
  private lastOutbound: Outbound[] = [];
  private lastSnapshot: StateSnapshot = {};
  private midFlight = false;
  private workDelayMs = 0;

  constructor() {
    this.root = this.resolveRoot();
    const meta = readMeta(this.root);
    const pkg = this.readPackage();
    this.version = meta.version ?? pkg.version ?? "unknown";
    this.commit = meta.commit ?? this.readCommit(this.root);
  }

  async start(ctx: BenchContext): Promise<void> {
    this.home = ctx.workDir;
    this.allowedActors = ctx.scenario.policy?.allowedActors ?? [];
    this.midFlight = ctx.scenario.restartMode === "mid-flight";
    this.workDelayMs = ctx.scenario.workDelayMs;
    await mkdir(this.home, { recursive: true });

    const modulePath = join(this.root, "src", "runtime.ts");
    const module = (await import(pathToFileURL(modulePath).href)) as {
      Runtime?: LofisuRuntimeConstructor;
    };
    if (!module.Runtime) {
      throw new Error(`lofisu adapter: Runtime export not found in ${modulePath}`);
    }
    this.runtimeCtor = module.Runtime;
    this.runtime = this.createRuntime();
    this.runtime.start({ assessPending: false });
  }

  async inject(events: BenchEvent[]): Promise<void> {
    if (!this.runtime) throw new Error("lofisu adapter: not started");
    for (const event of events) {
      const trigger = {
        id: event.id,
        source: "im",
        threads: [{ source: "im", id: event.threadKey }],
        actor: { source: "im", id: event.actor },
        human: true,
        ...(event.mentionsAgent ? { addressed: "mention" } : {}),
        at: event.timestamp,
        text: event.text,
        channel: { source: "im", thread: event.threadKey },
        meta: {},
      };
      this.runtime.ingest(trigger);
    }
    if (this.midFlight) return;
    await this.runtime.jobsSettled();
  }

  async workActive(): Promise<boolean> {
    if (!this.runtime?.store.isOpen) return false;
    const tickets = this.runtime.store.listDocs<LofisuTicket>("ticket");
    return tickets.some(
      (ticket) =>
        !ticket.ended &&
        (ticket.assignments ?? []).some(
          (assignment) => assignment.state === "pending" || assignment.state === "running",
        ),
    );
  }

  async outbound(): Promise<Outbound[]> {
    if (!this.runtime?.store.isOpen) return this.lastOutbound.map((message) => ({ ...message }));
    const messages = this.runtime.store.listOutbox().map((row) => ({
      id: row.id,
      threadKey: row.thread,
      body: row.text,
      createdAt: row.createdAt,
      destination: row.channel,
      metadata: {
        status: row.status,
        replyId: row.replyId,
        idempotencyKey: row.idempotencyKey,
        ticketId: row.ticketId,
      },
    }));
    this.lastOutbound = messages;
    return messages.map((message) => ({ ...message }));
  }

  async snapshot(): Promise<StateSnapshot> {
    if (!this.runtime?.store.isOpen) return { ...this.lastSnapshot };
    const tickets = this.runtime.store.listDocs<LofisuTicket>("ticket");
    const decisions = this.runtime.store.listDocs<unknown>("decision");
    const outbox = this.runtime.store.listOutbox();
    const events = this.runtime.store.listEvents();
    this.lastSnapshot = {
      tickets: tickets.length,
      openTickets: tickets.filter((ticket) => !ticket.ended).length,
      endedTickets: tickets.filter((ticket) => Boolean(ticket.ended)).length,
      evals: events.filter((event) => event.type === "eval.started").length,
      decisions: decisions.length,
      outbound: outbox.length,
    };
    return { ...this.lastSnapshot };
  }

  async restart(): Promise<void> {
    if (!this.runtime || !this.runtimeCtor) throw new Error("lofisu adapter: not started");
    this.lastOutbound = await this.outbound();
    await this.runtime.finish();
    this.runtime = this.createRuntime();
    this.runtime.start({ assessPending: false });
  }

  async stop(): Promise<void> {
    if (!this.runtime) return;
    try {
      this.lastOutbound = await this.outbound();
      await this.snapshot();
    } catch {
      // The runtime may be closing; keep the last captured view.
    }
    try {
      await this.runtime.finish();
    } finally {
      this.runtime = undefined;
    }
  }

  private createRuntime(): LofisuRuntime {
    if (!this.runtimeCtor) throw new Error("lofisu adapter: Runtime constructor missing");
    return this.runtimeCtor.create({
      home: this.home,
      model: {
        name: "BenchScriptedModel",
        classify: () => ({ pass: true, strength: "explicit", reason: "bench" }),
        complete: async (request: { role?: string }) => {
          if (this.workDelayMs > 0 && request.role === "worker") {
            await sleep(this.workDelayMs);
          }
          return { text: "bench-ack" };
        },
      },
      env: {},
      jobDelayMs: 0,
      watchdogIntervalMs: 60_000,
      stuckMs: 60_000,
      batchWindowMs: 0,
      ...(this.allowedActors.length > 0 ? { admission: { actors: this.allowedActors } } : {}),
    });
  }

  private resolveRoot(): string {
    const candidates = [
      process.env.BENCH_LOFISU_ROOT,
      join(process.cwd(), "results", "subjects", "lofisu"),
      resolve(process.cwd(), "..", "deepseek-super-agent"),
    ].filter((candidate): candidate is string => Boolean(candidate));
    for (const candidate of candidates) {
      if (existsSync(join(candidate, "src", "runtime.ts"))) return candidate;
    }
    throw new Error(
      "lofisu adapter: cannot find deepseek-super-agent; set BENCH_LOFISU_ROOT or run `npm run prepare:subjects`",
    );
  }

  private readPackage(): { version?: string } {
    try {
      const raw = readFileSync(join(this.root, "package.json"), "utf8");
      return JSON.parse(raw) as { version?: string };
    } catch {
      return {};
    }
  }

  private readCommit(root: string): string {
    try {
      return execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
        encoding: "utf8",
      }).trim();
    } catch {
      return "unknown";
    }
  }
}

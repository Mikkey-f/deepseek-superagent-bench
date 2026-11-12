import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  BenchContext,
  BenchEvent,
  Capability,
  Outbound,
  StateSnapshot,
  SubjectAdapter,
} from "../types.js";

export type NegativeFault = "double-work" | "replay-restart" | "unauthorized-work";

interface NegativeState {
  seen: string[];
  tickets: number;
  outbound: Outbound[];
}

const STATE_FILE = "negative-fixture-state.json";

function emptyState(): NegativeState {
  return { seen: [], tickets: 0, outbound: [] };
}

const CAPABILITIES: ReadonlySet<Capability> = new Set<Capability>([
  "event-injection",
  "outbound-capture",
  "authorization",
  "state-snapshot",
  "ticket-count",
  "restart",
]);

/**
 * A deliberately broken fixture used only to prove the evaluator can fail.
 * These adapters are never benchmark subjects and must not appear in the
 * reference matrix.
 */
export class NegativeFixtureAdapter implements SubjectAdapter {
  readonly id: string;
  readonly version = "1.0.0-negative";
  readonly commit = "fixture-negative";
  readonly mode = "fixture" as const;
  readonly capabilities = CAPABILITIES;

  private readonly fault: NegativeFault;
  private state: NegativeState = emptyState();
  private statePath = "";
  private allowedActors = new Set<string>();
  private outboundSeq = 0;

  constructor(fault: NegativeFault) {
    this.fault = fault;
    this.id = `fixture-${fault}`;
  }

  async start(ctx: BenchContext): Promise<void> {
    await mkdir(ctx.workDir, { recursive: true });
    this.statePath = join(ctx.workDir, STATE_FILE);
    this.allowedActors = new Set(ctx.scenario.policy?.allowedActors ?? []);
    try {
      this.state = JSON.parse(await readFile(this.statePath, "utf8")) as NegativeState;
    } catch {
      this.state = emptyState();
    }
    this.outboundSeq = this.state.outbound.length;
  }

  async inject(events: BenchEvent[]): Promise<void> {
    for (const event of events) {
      if (this.fault !== "double-work" && this.state.seen.includes(event.id)) {
        await this.persist();
        continue;
      }

      if (this.fault !== "unauthorized-work") {
        const allowed = this.allowedActors.size === 0 || this.allowedActors.has(event.actor);
        if (!allowed || !event.mentionsAgent) {
          this.state.seen.push(event.id);
          await this.persist();
          continue;
        }
      }

      this.state.seen.push(event.id);
      this.state.tickets += 1;
      this.outboundSeq += 1;
      this.state.outbound.push({
        id: `negative-out-${this.outboundSeq}`,
        threadKey: event.threadKey,
        body:
          this.fault === "double-work"
            ? `negative ack ${this.state.tickets}`
            : `negative ack for ${event.threadKey}`,
        createdAt: event.timestamp,
        metadata: { fault: this.fault },
      });
      await this.persist();
    }
  }

  async outbound(): Promise<Outbound[]> {
    return this.state.outbound.map((message) => ({ ...message }));
  }

  async snapshot(): Promise<StateSnapshot> {
    return {
      tickets: this.state.tickets,
      openTickets: this.state.tickets,
      endedTickets: 0,
      outbound: this.state.outbound.length,
    };
  }

  async restart(): Promise<void> {
    try {
      this.state = JSON.parse(await readFile(this.statePath, "utf8")) as NegativeState;
    } catch {
      this.state = emptyState();
    }
    this.outboundSeq = this.state.outbound.length;

    if (this.fault === "replay-restart" && this.state.outbound.length > 0) {
      const first = this.state.outbound[0];
      if (first) {
        this.outboundSeq += 1;
        this.state.outbound.push({
          ...first,
          id: `negative-replay-${this.outboundSeq}`,
          metadata: { fault: this.fault, replay: true },
        });
        await this.persist();
      }
    }
  }

  async stop(): Promise<void> {
    await this.persist();
  }

  getLogs(): string[] {
    return [`negative fixture fault=${this.fault}`];
  }

  private async persist(): Promise<void> {
    if (!this.statePath) return;
    await writeFile(this.statePath, JSON.stringify(this.state, null, 2), "utf8");
  }
}

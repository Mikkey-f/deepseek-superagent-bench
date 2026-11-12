import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import type {
  BenchContext,
  BenchEvent,
  Capability,
  MockModelController,
  Outbound,
  StateSnapshot,
  SubjectAdapter,
} from "../types.js";

const IN_SECRET = "bench-in-secret";
const OUT_SECRET = "bench-out-secret";

interface OsaTask {
  id: string;
  status: string;
  objective?: string;
  result?: { outcome?: string; notice?: string } | null;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripPrefix(thread: string): string {
  return thread.startsWith("webhook:") ? thread.slice("webhook:".length) : thread;
}

/**
 * Black-box adapter for thefullgc/opensuperagent.
 *
 * It starts the subject's HTTP server from a prepared copy, configures a local
 * OpenAI-compatible mock provider, injects signed `/hooks/webhook` events, and
 * captures the outbound webhook callbacks. Restart is a process stop/start with
 * the same data root. No real model, GitHub, or Feishu is used.
 */
export class OpenSuperAgentAdapter implements SubjectAdapter {
  readonly id = "opensuperagent";
  readonly mode = "black-box" as const;
  readonly capabilities: ReadonlySet<Capability> = new Set<Capability>([
    "event-injection",
    "outbound-capture",
    "authorization",
    "state-snapshot",
    "ticket-count",
    "restart",
  ]);

  readonly version: string;
  readonly commit: string;

  private root: string;
  private server: ChildProcessWithoutNullStreams | undefined;
  private callbackServer: Server | undefined;
  private port: number | undefined;
  private callbackUrl = "";
  private workDir = "";
  private dataRoot = "";
  private configPath = "";
  private mockModelUrl = "";
  private allowedActors: string[] = [];
  private outboundMessages: Outbound[] = [];
  private seq = 0;
  private logs: string[] = [];
  private lastSnapshot: StateSnapshot = {};

  constructor() {
    this.root = this.resolveRoot();
    const meta = readMeta(this.root);
    const pkg = this.readPackage();
    this.version = meta.version ?? pkg.version ?? "unknown";
    this.commit = meta.commit ?? "unknown";
  }

  configureMockModel(server: MockModelController): void {
    server.setConfig({
      defaultContent: "Mock model: acknowledged.",
      script: (body) => {
        const tools = Array.isArray(body.tools)
          ? (body.tools as Array<{ function?: { name?: string } }>)
          : [];
        const names = new Set(
          tools
            .map((tool) => tool.function?.name)
            .filter((name): name is string => typeof name === "string"),
        );
        const text = JSON.stringify(body.messages ?? []);

        if (names.has("start_task")) {
          const ids = [...new Set(text.match(/trg_[A-Za-z0-9_-]+/g) ?? [])];
          return {
            toolName: "start_task",
            toolArguments: {
              triggerIds: ids,
              definition: "coding",
              objective: "Fix the login timeout on checkout",
            },
          };
        }
        if (names.has("cli")) {
          return {
            toolName: "cli",
            toolArguments: {
              command:
                "_submit_result --json <<'TASK_RESULT'\n" +
                '{"outcome":"completed","notice":"Done: login timeout fixed","summary":"Mock worker completed the task."}\n' +
                "TASK_RESULT",
            },
          };
        }
        return { content: "Mock model: acknowledged." };
      },
    });
  }

  async start(ctx: BenchContext): Promise<void> {
    this.workDir = resolve(ctx.workDir);
    this.dataRoot = join(this.workDir, "data");
    this.configPath = join(this.workDir, "opensuperagent.config.yaml");
    this.mockModelUrl = ctx.mockModelUrl;
    this.allowedActors = ctx.scenario.policy?.allowedActors ?? [];
    this.outboundMessages = [];
    this.seq = 0;
    this.logs = [];

    await mkdir(this.dataRoot, { recursive: true });
    await this.startCallbackSink();
    await this.writeConfig();
    await this.runInit();
    await this.startServer();
    await this.configureSettings();
  }

  async inject(events: BenchEvent[]): Promise<void> {
    if (!this.port) throw new Error("opensuperagent adapter: server is not running");
    for (const event of events) {
      const payload = {
        id: event.id,
        threadId: event.threadKey,
        actorId: event.actor,
        text: event.text,
      };
      const raw = JSON.stringify(payload);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = `sha256=${createHmac("sha256", IN_SECRET)
        .update(`${timestamp}.${raw}`)
        .digest("hex")}`;
      const response = await fetch(`http://127.0.0.1:${this.port}/hooks/webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-OSA-Timestamp": timestamp,
          "X-OSA-Signature": signature,
        },
        body: raw,
      });
      const body = await response.text();
      if (response.status === 403) {
        this.logs.push(`[inject] filtered unauthorized event ${event.id}`);
        continue;
      }
      if (!response.ok) {
        throw new Error(`opensuperagent webhook ${response.status}: ${body}`);
      }
    }
    await this.waitForTasks();
    await this.waitForOutbound();
  }

  async outbound(): Promise<Outbound[]> {
    return this.outboundMessages.map((message) => ({ ...message }));
  }

  async snapshot(): Promise<StateSnapshot> {
    if (!this.port) return { ...this.lastSnapshot };
    try {
      const tasks = (await this.request("/api/tasks")) as { tasks?: OsaTask[] };
      const rows = tasks.tasks ?? [];
      this.lastSnapshot = {
        tickets: rows.length,
        openTickets: rows.filter((task) => ["pending", "active", "waiting"].includes(task.status))
          .length,
        endedTickets: rows.filter((task) =>
          ["completed", "failed", "cancelled"].includes(task.status),
        ).length,
        outbound: this.outboundMessages.length,
      };
    } catch {
      // Keep the last readable snapshot while the server is restarting.
    }
    return { ...this.lastSnapshot };
  }

  async restart(): Promise<void> {
    await this.stopServer();
    await this.startServer();
  }

  async stop(): Promise<void> {
    await this.stopServer();
    if (this.callbackServer) {
      const server = this.callbackServer;
      this.callbackServer = undefined;
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  private async startCallbackSink(): Promise<void> {
    this.callbackServer = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        try {
          const body = JSON.parse(raw) as Record<string, unknown>;
          if (body.type === "agent.reply" || typeof body.text === "string") {
            this.seq += 1;
            const threadId = typeof body.threadId === "string" ? body.threadId : "unknown";
            this.outboundMessages.push({
              id: typeof body.id === "string" ? body.id : `callback-${this.seq}`,
              threadKey: stripPrefix(threadId),
              body: String(body.text ?? ""),
              createdAt:
                typeof body.createdAt === "string" ? body.createdAt : new Date().toISOString(),
              destination: "webhook",
            });
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ id: `sink-${this.seq}` }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid json" }));
        }
      });
    });
    await new Promise<void>((resolve, reject) => {
      this.callbackServer?.once("error", reject);
      this.callbackServer?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = this.callbackServer.address() as AddressInfo;
    this.callbackUrl = `http://127.0.0.1:${address.port}/callback`;
  }

  private async writeConfig(): Promise<void> {
    const dataRoot = this.dataRoot.replaceAll("\\", "/");
    const yaml = [
      "instance:",
      `  data_root: "${dataRoot}"`,
      "  max_active_tasks: 1",
      "console:",
      '  listen: "127.0.0.1:0"',
      "sources:",
      "  - source: console",
      "",
    ].join("\n");
    await writeFile(this.configPath, yaml, "utf8");
  }

  private tsxCli(): string {
    const candidate = join(this.root, "node_modules", "tsx", "dist", "cli.mjs");
    if (!existsSync(candidate)) {
      throw new Error(
        "opensuperagent adapter: tsx not found in the prepared copy; run `npm run prepare:subjects`",
      );
    }
    return candidate;
  }

  private childEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_NO_WARNINGS: "1" };
    for (const key of [
      "OPENSUPERAGENT_CONFIG",
      "OPENSUPERAGENT_DATA_ROOT",
      "OPENSUPERAGENT_ADMIN_TOKEN",
      "OPENSUPERAGENT_LLM_API_KEY",
      "OPENSUPERAGENT_LLM_BASE_URL",
      "OPENSUPERAGENT_LLM_ROUTER_MODEL",
      "OPENSUPERAGENT_LLM_WORKER_MODEL",
      "DEEPSEEK_API_KEY",
    ]) {
      delete env[key];
    }
    return env;
  }

  private async runInit(): Promise<void> {
    const child = spawn(
      process.execPath,
      [this.tsxCli(), "src/cli.ts", "init", "--config", this.configPath],
      { cwd: this.root, env: this.childEnv() },
    );
    this.captureLogs(child);
    await new Promise<void>((resolvePromise, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code === 0) resolvePromise();
        else
          reject(
            new Error(`opensuperagent init exited ${code}: ${this.logs.slice(-8).join("\n")}`),
          );
      });
    });
  }

  private async startServer(): Promise<void> {
    const child = spawn(
      process.execPath,
      [this.tsxCli(), "src/cli.ts", "serve", "--config", this.configPath],
      { cwd: this.root, env: this.childEnv() },
    );
    this.server = child;
    this.captureLogs(child);

    const port = await new Promise<number>((resolvePromise, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`opensuperagent did not start: ${this.logs.slice(-10).join("\n")}`)),
        30_000,
      );
      const onData = (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        const match = text.match(/\[api\] listening on http:\/\/127\.0\.0\.1:(\d+)/);
        if (match?.[1]) {
          clearTimeout(timer);
          resolvePromise(Number.parseInt(match[1], 10));
        }
      };
      child.stdout.on("data", onData);
      child.stderr.on("data", onData);
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(
          new Error(
            `opensuperagent exited ${code} during startup: ${this.logs.slice(-10).join("\n")}`,
          ),
        );
      });
    });
    this.port = port;
    await this.waitFor(
      async () => {
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        return response.ok;
      },
      10_000,
      "health check",
    );
  }

  private async configureSettings(): Promise<void> {
    if (!this.port) throw new Error("opensuperagent adapter: server is not running");
    await this.put("/api/settings/providers", {
      id: "bench-mock",
      name: "Bench local mock",
      protocol: "openai-compatible",
      baseUrl: this.mockModelUrl,
      apiKey: "bench",
      models: ["router-model", "worker-model"],
      maxTokens: 8192,
    });
    await this.put("/api/settings/routing", {
      router: { providerId: "bench-mock", model: "router-model" },
      worker: { providerId: "bench-mock", model: "worker-model" },
      profiles: {
        "worker-strong": { providerId: "bench-mock", model: "worker-model" },
        "worker-fast": { providerId: "bench-mock", model: "worker-model" },
      },
    });
    await this.put("/api/settings/adapters/webhook", {
      enabled: true,
      secret: IN_SECRET,
      callbackUrl: this.callbackUrl,
      outboundSecret: OUT_SECRET,
      actors: this.allowedActors,
    });
    await this.waitFor(
      async () => {
        const system = (await this.request("/api/system")) as { agent?: string };
        return system.agent === "llm";
      },
      10_000,
      "model routing readiness",
    );
  }

  private async waitForTasks(): Promise<void> {
    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline) {
      try {
        const body = (await this.request("/api/tasks")) as { tasks?: OsaTask[] };
        const tasks = body.tasks ?? [];
        const busy = tasks.some((task) => ["pending", "active", "waiting"].includes(task.status));
        if (tasks.length === 0 || !busy) return;
      } catch {
        // The server may still be processing; retry until the deadline.
      }
      await sleep(200);
    }
    this.logs.push("[inject] task wait timed out");
  }

  private async waitForOutbound(): Promise<void> {
    if (this.outboundMessages.length > 0) return;
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (this.outboundMessages.length > 0) return;
      await sleep(100);
    }
    this.logs.push("[inject] outbound wait timed out");
  }

  private async stopServer(): Promise<void> {
    const child = this.server;
    this.server = undefined;
    this.port = undefined;
    if (!child) return;
    let exited = false;
    const exitPromise = new Promise<void>((resolvePromise) => {
      child.once("exit", () => {
        exited = true;
        resolvePromise();
      });
    });
    try {
      child.kill("SIGTERM");
    } catch {
      // Fall through to the forced kill.
    }
    await Promise.race([exitPromise, sleep(10_000)]);
    if (!exited) {
      if (process.platform === "win32" && child.pid) {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      } else {
        try {
          child.kill("SIGKILL");
        } catch {
          // Already gone.
        }
      }
      await Promise.race([exitPromise, sleep(2_000)]);
    }
  }

  private captureLogs(child: ChildProcessWithoutNullStreams): void {
    const onData = (chunk: Buffer) => {
      const text = chunk.toString("utf8").trimEnd();
      if (text) this.logs.push(text);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
  }

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    if (!this.port) throw new Error("opensuperagent adapter: server is not running");
    const response = await fetch(`http://127.0.0.1:${this.port}${path}`, init);
    const text = await response.text();
    let body: unknown = undefined;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    if (!response.ok) {
      throw new Error(
        `opensuperagent ${init?.method ?? "GET"} ${path} -> ${response.status}: ${text}`,
      );
    }
    return body;
  }

  private async put(path: string, value: unknown): Promise<void> {
    await this.request(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
  }

  private async waitFor(
    predicate: () => Promise<boolean>,
    timeoutMs: number,
    label: string,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        if (await predicate()) return;
      } catch {
        // Retry until the deadline.
      }
      await sleep(150);
    }
    throw new Error(`opensuperagent adapter: timed out waiting for ${label}`);
  }

  private resolveRoot(): string {
    const candidates = [
      process.env.BENCH_OPENSUPERAGENT_ROOT,
      join(process.cwd(), "results", "subjects", "opensuperagent"),
      resolve(process.cwd(), "..", "opensuperagent"),
    ].filter((candidate): candidate is string => Boolean(candidate));
    for (const candidate of candidates) {
      if (existsSync(join(candidate, "src", "cli.ts"))) return candidate;
    }
    throw new Error(
      "opensuperagent adapter: cannot find the checkout; set BENCH_OPENSUPERAGENT_ROOT or run `npm run prepare:subjects`",
    );
  }

  private readPackage(): { version?: string } {
    try {
      return JSON.parse(readFileSync(join(this.root, "package.json"), "utf8")) as {
        version?: string;
      };
    } catch {
      return {};
    }
  }
}

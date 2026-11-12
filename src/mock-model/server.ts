import { type IncomingMessage, type Server, type ServerResponse, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { MockModelCall, MockModelController } from "../types.js";

export interface MockModelRule {
  /** Substring to match against the serialized request messages. */
  match?: string;
  content?: string;
  toolName?: string;
  toolArguments?: unknown;
  delayMs?: number;
}

export interface MockModelConfig {
  rules?: MockModelRule[];
  defaultContent?: string;
  defaultTool?: { name: string; arguments: unknown };
  /** Optional per-request script, used by adapters that need dynamic tool args. */
  script?: (body: Record<string, unknown>) => MockModelRule | undefined;
}

const DEFAULT_CONTENT =
  "Mock model: acknowledged. I will inspect the request and produce a short, safe answer.";

interface CompletionResult {
  kind: "content" | "tool";
  completion: Record<string, unknown>;
  content: string | null;
  tool?: { name: string; arguments: string; id: string };
  delayMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function pickRule(config: MockModelConfig, requestText: string): MockModelRule | undefined {
  for (const rule of config.rules ?? []) {
    if (rule.match === undefined || requestText.includes(rule.match)) return rule;
  }
  return undefined;
}

function buildCompletion(
  body: Record<string, unknown>,
  config: MockModelConfig,
  counter: number,
): CompletionResult {
  const messages = body.messages ?? [];
  const requestText = JSON.stringify(messages);
  const rule = config.script?.(body) ?? pickRule(config, requestText);
  const id = `chatcmpl-mock-${counter}`;
  const model = typeof body.model === "string" ? body.model : "mock-model";
  const promptTokens = Math.max(1, Math.ceil(requestText.length / 4));
  let content: string | null = null;
  let tool: CompletionResult["tool"] | undefined;

  const toolName = rule?.toolName ?? config.defaultTool?.name;
  if (toolName) {
    const args = rule?.toolArguments ?? config.defaultTool?.arguments ?? {};
    tool = {
      id: `call_mock_${counter}`,
      name: toolName,
      arguments: JSON.stringify(args),
    };
  } else {
    content = rule?.content ?? config.defaultContent ?? DEFAULT_CONTENT;
  }

  const message = tool
    ? {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: tool.id,
            type: "function",
            function: { name: tool.name, arguments: tool.arguments },
          },
        ],
      }
    : { role: "assistant", content };

  const completionTokens = Math.max(1, Math.ceil((content?.length ?? 32) / 4));
  const completion = {
    id,
    object: "chat.completion",
    created: 0,
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: tool ? "tool_calls" : "stop",
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };

  return {
    kind: tool ? "tool" : "content",
    completion,
    content,
    tool,
    delayMs: rule?.delayMs ?? 0,
  };
}

function sendStream(res: ServerResponse, result: CompletionResult): void {
  const completion = result.completion as {
    id: string;
    model: string;
    choices: Array<{ message: { content: string | null } }>;
  };
  const base = {
    id: completion.id,
    object: "chat.completion.chunk",
    created: 0,
    model: completion.model,
  };
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  if (result.kind === "tool" && result.tool) {
    const delta = {
      role: "assistant",
      tool_calls: [
        {
          index: 0,
          id: result.tool.id,
          type: "function",
          function: { name: result.tool.name, arguments: result.tool.arguments },
        },
      ],
    };
    res.write(
      `data: ${JSON.stringify({
        ...base,
        choices: [{ index: 0, delta, finish_reason: null }],
      })}\n\n`,
    );
    res.write(
      `data: ${JSON.stringify({
        ...base,
        choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
      })}\n\n`,
    );
  } else {
    const delta = { role: "assistant", content: result.content ?? "" };
    res.write(
      `data: ${JSON.stringify({
        ...base,
        choices: [{ index: 0, delta, finish_reason: null }],
      })}\n\n`,
    );
    res.write(
      `data: ${JSON.stringify({
        ...base,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      })}\n\n`,
    );
  }
  res.write("data: [DONE]\n\n");
  res.end();
}

export class MockModelServer implements MockModelController {
  private config: MockModelConfig;
  private server: Server | undefined;
  private calls: MockModelCall[] = [];
  private counter = 0;

  constructor(config: MockModelConfig = {}) {
    this.config = { defaultContent: DEFAULT_CONTENT, ...config };
  }

  setConfig(config: MockModelConfig): void {
    this.config = { defaultContent: DEFAULT_CONTENT, ...this.config, ...config };
  }

  getCalls(): MockModelCall[] {
    return [...this.calls];
  }

  async start(port = 0): Promise<string> {
    this.server = createServer((req, res) => this.handle(req, res));
    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(port, "127.0.0.1", () => resolve());
    });
    const address = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${address.port}/v1`;
  }

  async stop(): Promise<void> {
    const server = this.server;
    this.server = undefined;
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url ?? "/";
    if (req.method === "GET" && url.endsWith("/health")) {
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === "GET" && url.endsWith("/__bench/calls")) {
      sendJson(res, 200, this.calls);
      return;
    }
    if (req.method === "GET" && (url.endsWith("/models") || url.endsWith("/v1/models"))) {
      sendJson(res, 200, {
        object: "list",
        data: [{ id: "mock-model", object: "model", owned_by: "bench" }],
      });
      return;
    }
    if (req.method !== "POST" || !url.includes("/chat/completions")) {
      sendJson(res, 404, { error: { message: `mock model: unsupported path ${url}` } });
      return;
    }

    let body: Record<string, unknown> = {};
    try {
      const raw = await readBody(req);
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      sendJson(res, 400, { error: { message: "mock model: invalid JSON body" } });
      return;
    }

    this.counter += 1;
    const result = buildCompletion(body, this.config, this.counter);
    this.calls.push({
      at: new Date().toISOString(),
      path: url,
      request: body,
      response: result.completion,
    });

    if (result.delayMs > 0) await sleep(result.delayMs);

    if (body.stream === true) {
      sendStream(res, result);
    } else {
      sendJson(res, 200, result.completion);
    }
  }
}

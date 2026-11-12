import { describe, expect, it } from "vitest";
import { MockModelServer } from "../src/mock-model/server.js";

describe("mock model", () => {
  it("serves an OpenAI-compatible completion and records the call", async () => {
    const server = new MockModelServer({ defaultContent: "hello from mock" });
    const baseUrl = await server.start();
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "mock-model",
          messages: [{ role: "user", content: "hello" }],
          stream: false,
        }),
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      expect(body.choices[0]?.message.content).toBe("hello from mock");
      expect(server.getCalls()).toHaveLength(1);
    } finally {
      await server.stop();
    }
  });
});

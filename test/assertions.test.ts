import { describe, expect, it } from "vitest";
import { evaluateScenario } from "../src/assertions.js";
import { validateScenario } from "../src/scenario.js";
import type { Capability, SubjectAdapter } from "../src/types.js";

function stubAdapter(
  capabilities: Capability[],
  options: { restart?: boolean } = {},
): SubjectAdapter {
  return {
    id: "stub",
    version: "0.0.0",
    commit: "stub",
    mode: "fixture",
    capabilities: new Set(capabilities),
    start: async () => {},
    inject: async () => {},
    outbound: async () => [],
    stop: async () => {},
    ...(options.restart === false ? {} : { restart: async () => {} }),
  };
}

const directRequest = validateScenario({
  id: "c1-test",
  name: "Direct request",
  description: "A test scenario.",
  events: [
    {
      id: "evt-1",
      threadKey: "thread-1",
      actor: "alice",
      text: "please help",
    },
  ],
  requires: ["event-injection", "outbound-capture"],
  expect: { outboundAtLeast: 1, duplicateOutbound: false },
});

describe("capability gating", () => {
  it("reports not_tested instead of failing when an adapter cannot observe a behavior", () => {
    const result = evaluateScenario({
      adapter: stubAdapter(["event-injection"]),
      scenario: directRequest,
      outbound: [],
    });

    expect(result.status).toBe("not_tested");
    expect(result.checks.some((check) => check.id === "outbound-at-least")).toBe(false);
    expect(result.checks[0]).toMatchObject({
      id: "capability:outbound-capture",
      status: "not_tested",
    });
  });

  it("evaluates assertions when all required capabilities are present", () => {
    const result = evaluateScenario({
      adapter: stubAdapter(["event-injection", "outbound-capture"]),
      scenario: directRequest,
      outbound: [{ id: "out-1", threadKey: "thread-1", body: "done" }],
    });

    expect(result.status).toBe("pass");
    expect(result.checks.map((check) => check.status)).toEqual(["pass", "pass"]);
  });

  it("gates a restart scenario when the adapter has no restart hook", () => {
    const restartScenario = validateScenario({
      id: "c7-test",
      name: "Restart",
      description: "A test scenario.",
      events: [
        {
          id: "evt-1",
          threadKey: "thread-1",
          actor: "alice",
          text: "please help",
        },
      ],
      restart: true,
      requires: ["event-injection", "outbound-capture", "restart"],
      expect: { outboundAtLeast: 1 },
    });

    const result = evaluateScenario({
      adapter: stubAdapter(["event-injection", "outbound-capture", "restart"], {
        restart: false,
      }),
      scenario: restartScenario,
      outbound: [{ id: "out-1", threadKey: "thread-1", body: "done" }],
    });

    expect(result.status).toBe("not_tested");
    expect(result.checks[0]?.id).toBe("capability:restart");
  });
});

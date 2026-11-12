import { describe, expect, it } from "vitest";
import { loadSuite, validateScenario } from "../src/scenario.js";

describe("scenario loading", () => {
  it("loads the four core scenarios", async () => {
    const scenarios = await loadSuite(process.cwd(), "core");
    expect(scenarios.map((scenario) => scenario.id).sort()).toEqual([
      "c1-direct-request",
      "c2-duplicate-delivery",
      "c3-concurrent-duplicate-delivery",
      "c5-unauthorized-sender",
      "c7-restart-recovery",
    ]);
  });

  it("asserts ticket counts for duplicate delivery and restart recovery", async () => {
    const scenarios = await loadSuite(process.cwd(), "core");
    for (const id of [
      "c2-duplicate-delivery",
      "c3-concurrent-duplicate-delivery",
      "c7-restart-recovery",
    ]) {
      const scenario = scenarios.find((candidate) => candidate.id === id);
      expect(scenario?.expect.ticketsCreated).toBe(1);
      expect(scenario?.requires).toContain("ticket-count");
    }
  });

  it("loads the concurrent delivery mode only for C3", async () => {
    const scenarios = await loadSuite(process.cwd(), "core");
    for (const scenario of scenarios) {
      expect(scenario.delivery).toBe(
        scenario.id === "c3-concurrent-duplicate-delivery" ? "concurrent" : "sequential",
      );
    }
  });

  it("rejects a scenario without events", () => {
    expect(() =>
      validateScenario({
        id: "bad",
        name: "bad",
        description: "bad",
        events: [],
        expect: {},
      }),
    ).toThrow();
  });
});

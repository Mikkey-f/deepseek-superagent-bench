import { describe, expect, it } from "vitest";
import { loadSuite, validateScenario } from "../src/scenario.js";

describe("scenario loading", () => {
  it("loads the four core scenarios", async () => {
    const scenarios = await loadSuite(process.cwd(), "core");
    expect(scenarios.map((scenario) => scenario.id).sort()).toEqual([
      "c1-direct-request",
      "c2-duplicate-delivery",
      "c5-unauthorized-sender",
      "c7-restart-recovery",
    ]);
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

import { describe, expect, it } from "vitest";
import { runSuite } from "../src/runner.js";

describe("evaluator negative controls", () => {
  it("fails the intentionally broken fixtures and keeps their control cases passing", async () => {
    const report = await runSuite({
      root: process.cwd(),
      suite: "core",
      subjects: ["fixture-double-work", "fixture-replay-restart", "fixture-unauthorized-work"],
      repeats: 1,
      outDir: "results/selftest",
    });

    const result = (scenarioId: string, subjectId: string) =>
      report.results.find(
        (candidate) => candidate.scenarioId === scenarioId && candidate.subjectId === subjectId,
      );

    const doubleWork = result("c2-duplicate-delivery", "fixture-double-work");
    expect(doubleWork?.status).toBe("fail");
    expect(
      doubleWork?.repeats[0]?.checks.find((check) => check.id === "tickets-created"),
    ).toMatchObject({ status: "fail", expected: 1, actual: 2 });
    expect(result("c1-direct-request", "fixture-double-work")?.status).toBe("pass");

    const replay = result("c7-restart-recovery", "fixture-replay-restart");
    expect(replay?.status).toBe("fail");
    expect(
      replay?.repeats[0]?.checks.find((check) => check.id === "no-duplicate-outbound"),
    ).toMatchObject({ status: "fail" });
    expect(result("c2-duplicate-delivery", "fixture-replay-restart")?.status).toBe("pass");

    const unauthorized = result("c5-unauthorized-sender", "fixture-unauthorized-work");
    expect(unauthorized?.status).toBe("fail");
    expect(
      unauthorized?.repeats[0]?.checks.find((check) => check.id === "tickets-created"),
    ).toMatchObject({ status: "fail", expected: 0, actual: 1 });
    expect(
      unauthorized?.repeats[0]?.checks.find((check) => check.id === "unauthorized-work"),
    ).toMatchObject({ status: "fail" });
    expect(result("c1-direct-request", "fixture-unauthorized-work")?.status).toBe("pass");
  });
});

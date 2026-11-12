import { describe, expect, it } from "vitest";
import { runSuite } from "../src/runner.js";

describe("fixture subject", () => {
  it("passes the core suite deterministically", async () => {
    const report = await runSuite({
      root: process.cwd(),
      suite: "core",
      subjects: ["fixture"],
      repeats: 3,
      outDir: "results/test-fixture",
    });

    const failures = report.results.filter((result) => result.status !== "pass");
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
    expect(report.results).toHaveLength(4);
  });
});

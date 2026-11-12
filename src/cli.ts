#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { BENCH_VERSION, runSuite } from "./runner.js";
import { loadSuite } from "./scenario.js";

const program = new Command();

program
  .name("superagent-bench")
  .description(
    "Unofficial reproducible behavioral benchmark for proactive super-agent implementations.",
  )
  .version(BENCH_VERSION);

program
  .command("run")
  .description("run a scenario suite against one or more subjects")
  .option("--suite <suite>", "scenario suite", "core")
  .option(
    "--subjects <subjects>",
    "comma-separated subjects (fixture,opensuperagent,lofisu)",
    "fixture",
  )
  .option("--repeats <n>", "repeats per scenario", "3")
  .option("--out <dir>", "output directory", "results/latest")
  .option("--root <dir>", "project root", process.cwd())
  .option("--verbose", "verbose logs", false)
  .action(async (options: Record<string, unknown>) => {
    const repeats = Number.parseInt(String(options.repeats ?? "3"), 10);
    if (!Number.isFinite(repeats) || repeats < 1) {
      console.error(pc.red("--repeats must be a positive integer"));
      process.exitCode = 2;
      return;
    }
    const subjects = String(options.subjects ?? "fixture")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    if (subjects.length === 0) {
      console.error(pc.red("--subjects must name at least one subject"));
      process.exitCode = 2;
      return;
    }

    try {
      const report = await runSuite({
        root: String(options.root ?? process.cwd()),
        suite: String(options.suite ?? "core"),
        subjects,
        repeats,
        outDir: String(options.out ?? "results/latest"),
        log: options.verbose ? (message) => console.log(pc.gray(message)) : undefined,
      });

      for (const result of report.results) {
        const color =
          result.status === "pass"
            ? pc.green
            : result.status === "fail" || result.status === "error"
              ? pc.red
              : pc.yellow;
        console.log(
          `${result.scenarioId.padEnd(28)} ${result.subjectId.padEnd(16)} ${color(result.status)}`,
        );
      }
      console.log("");
      console.log(`Report: ${String(options.out ?? "results/latest")}/report.md`);

      if (report.results.some((result) => result.status === "fail" || result.status === "error")) {
        process.exitCode = 1;
      }
    } catch (cause) {
      console.error(pc.red(cause instanceof Error ? cause.message : String(cause)));
      process.exitCode = 2;
    }
  });

program
  .command("list")
  .description("list scenarios in a suite")
  .option("--suite <suite>", "scenario suite", "core")
  .option("--root <dir>", "project root", process.cwd())
  .action(async (options: Record<string, unknown>) => {
    try {
      const scenarios = await loadSuite(
        String(options.root ?? process.cwd()),
        String(options.suite ?? "core"),
      );
      for (const scenario of scenarios) {
        console.log(`${scenario.id.padEnd(28)} ${scenario.name}`);
      }
    } catch (cause) {
      console.error(pc.red(cause instanceof Error ? cause.message : String(cause)));
      process.exitCode = 2;
    }
  });

program
  .command("validate")
  .description("validate all scenario files in a suite")
  .option("--suite <suite>", "scenario suite", "core")
  .option("--root <dir>", "project root", process.cwd())
  .action(async (options: Record<string, unknown>) => {
    try {
      const scenarios = await loadSuite(
        String(options.root ?? process.cwd()),
        String(options.suite ?? "core"),
      );
      console.log(
        pc.green(
          `OK: ${scenarios.length} scenario(s) in suite "${String(options.suite ?? "core")}"`,
        ),
      );
    } catch (cause) {
      console.error(pc.red(cause instanceof Error ? cause.message : String(cause)));
      process.exitCode = 2;
    }
  });

await program.parseAsync(process.argv);

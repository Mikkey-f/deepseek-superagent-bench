import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createAdapter } from "./adapters/index.js";
import { evaluateScenario } from "./assertions.js";
import { MockModelServer } from "./mock-model/server.js";
import { writeReport } from "./report.js";
import { type Scenario, loadSuite } from "./scenario.js";
import type {
  CheckResult,
  Outbound,
  RepeatEvidence,
  Report,
  ScenarioResult,
  ScenarioStatus,
  StateSnapshot,
  SubjectAdapter,
  SubjectMetadata,
} from "./types.js";

export const BENCH_VERSION = "0.1.0";

export interface RunSuiteOptions {
  root: string;
  suite: string;
  subjects: string[];
  repeats: number;
  outDir: string;
  log?: (message: string) => void;
}

const LIMITATIONS = [
  "MVP uses a scripted mock model and a synthetic event source; it does not measure real model quality.",
  "Only the core suite is exercised; unlisted behaviors are not tested.",
  "Real subjects are driven through their public or local interfaces; internal behavior is not asserted.",
  "A pass means the scenario's observable assertions held for this run; it is not a production-readiness claim.",
  "Results are version/commit/date pinned; rerun to reproduce.",
  "Unofficial, not affiliated with DeepSeek.",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function errorCheck(message: string): CheckResult {
  return {
    id: "run-error",
    label: "scenario run",
    status: "fail",
    expected: "no error",
    actual: message,
    detail: message,
  };
}

async function waitForSettle(
  adapter: SubjectAdapter,
  scenario: Scenario,
  log: (message: string) => void,
): Promise<void> {
  const started = Date.now();
  let lastCount = -1;
  let lastChange = Date.now();

  while (Date.now() - started < scenario.timeoutMs) {
    let current: Outbound[] = [];
    try {
      current = await adapter.outbound();
    } catch {
      current = [];
    }

    if (current.length !== lastCount) {
      lastCount = current.length;
      lastChange = Date.now();
    }

    const minimum = scenario.expect.outboundAtLeast ?? 0;
    const maximum = scenario.expect.outboundAtMost;
    if (maximum !== undefined && current.length > maximum) return;
    if (Date.now() - lastChange >= scenario.quietMs && current.length >= minimum) return;
    await sleep(100);
  }

  log(
    `settle timeout after ${scenario.timeoutMs}ms (last outbound count: ${lastCount}) for ${adapter.id}/${scenario.id}`,
  );
}

async function runOnce(
  adapter: SubjectAdapter,
  scenario: Scenario,
  repeat: number,
  outDir: string,
  log: (message: string) => void,
): Promise<RepeatEvidence> {
  const traceBase = `${sanitize(adapter.id)}--${sanitize(scenario.id)}--r${repeat}`;
  const workDir = join(outDir, "work", traceBase);
  // A rerun against the same --out must start from a clean subject state;
  // otherwise durable inboxes dedupe the synthetic event and the run is vacuous.
  await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });

  const mock = new MockModelServer();
  const started = Date.now();
  let outbound: Outbound[] = [];
  let snapshot: StateSnapshot | undefined;
  let checks: CheckResult[] = [];
  let status: ScenarioStatus = "error";
  let error: string | undefined;

  try {
    adapter.configureMockModel?.(mock);
    const mockModelUrl = await mock.start();
    await adapter.start({ mockModelUrl, workDir, scenario, log });
    await adapter.inject(scenario.events);
    await waitForSettle(adapter, scenario, log);

    if (scenario.restart) {
      if (adapter.restart) {
        await adapter.restart();
        await waitForSettle(adapter, scenario, log);
      } else {
        log(`${adapter.id}/${scenario.id}: restart unsupported; scenario will be capability-gated`);
      }
    }

    outbound = await adapter.outbound();
    snapshot = adapter.snapshot ? await adapter.snapshot() : undefined;
    const evaluation = evaluateScenario({ adapter, scenario, outbound, snapshot });
    checks = evaluation.checks;
    status = evaluation.status;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
    status = "error";
    checks = [errorCheck(error)];
    log(`${adapter.id}/${scenario.id} repeat ${repeat} error: ${error}`);
  } finally {
    try {
      await adapter.stop();
    } catch (cause) {
      log(`adapter stop failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    }
    await mock.stop();
  }

  const durationMs = Date.now() - started;
  const modelCalls = mock.getCalls();
  const tracePath = join(outDir, "traces", `${traceBase}.json`);
  await mkdir(join(outDir, "traces"), { recursive: true });
  await writeFile(
    tracePath,
    JSON.stringify(
      {
        scenario: scenario.id,
        subject: adapter.id,
        repeat,
        events: scenario.events,
        outbound,
        snapshot,
        modelCalls,
        adapterLogs: adapter.getLogs?.() ?? [],
        checks,
        status,
        error,
        durationMs,
      },
      null,
      2,
    ),
    "utf8",
  );

  return {
    repeat,
    status,
    checks,
    outbound,
    ...(snapshot ? { snapshot } : {}),
    modelCalls,
    durationMs,
    ...(error ? { error } : {}),
    tracePath,
  };
}

function resultStatus(repeats: RepeatEvidence[]): ScenarioStatus {
  if (repeats.some((repeat) => repeat.status === "error")) return "error";
  if (repeats.some((repeat) => repeat.status === "fail")) return "fail";
  const signatures = new Set(
    repeats.map((repeat) =>
      JSON.stringify({
        status: repeat.status,
        checks: repeat.checks.map((check) => [check.id, check.status]),
        outbound: repeat.outbound.length,
      }),
    ),
  );
  if (signatures.size > 1) return "flaky";
  if (repeats.some((repeat) => repeat.status === "not_tested")) return "not_tested";
  return "pass";
}

export async function runSuite(options: RunSuiteOptions): Promise<Report> {
  const log = options.log ?? (() => {});
  const scenarios = await loadSuite(options.root, options.suite);
  await mkdir(options.outDir, { recursive: true });

  const subjects = new Map<string, SubjectMetadata>();
  for (const id of options.subjects) {
    const probe = createAdapter(id);
    subjects.set(id, {
      id: probe.id,
      version: probe.version,
      commit: probe.commit,
      mode: probe.mode,
      capabilities: [...probe.capabilities].sort(),
    });
  }

  const results: ScenarioResult[] = [];
  for (const scenario of scenarios) {
    for (const subjectId of options.subjects) {
      const adapter = createAdapter(subjectId);
      const repeats = scenario.repeats ?? options.repeats;
      log(`running ${adapter.id} × ${scenario.id} (${repeats} repeat${repeats === 1 ? "" : "s"})`);

      const evidence: RepeatEvidence[] = [];
      for (let repeat = 1; repeat <= repeats; repeat += 1) {
        evidence.push(await runOnce(adapter, scenario, repeat, options.outDir, log));
      }

      const notes = [
        ...new Set(
          evidence.flatMap((repeat) => repeat.checks.flatMap((check) => check.detail ?? [])),
        ),
      ];
      results.push({
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        subjectId: adapter.id,
        status: resultStatus(evidence),
        repeats: evidence,
        notes,
      });
    }
  }

  const report: Report = {
    schemaVersion: "0.1",
    generatedAt: new Date().toISOString(),
    benchVersion: BENCH_VERSION,
    environment: {
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      cwd: options.root,
    },
    suite: options.suite,
    repeats: options.repeats,
    subjects: [...subjects.values()],
    results,
    limitations: LIMITATIONS,
  };

  await writeReport(report, options.outDir);
  return report;
}

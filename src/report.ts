import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Report, ScenarioResult } from "./types.js";

function statusCell(result: ScenarioResult | undefined): string {
  return result ? result.status : "not_run";
}

function renderMatrix(report: Report): string {
  const scenarioIds = [...new Set(report.results.map((result) => result.scenarioId))];
  const subjectIds = report.subjects.map((subject) => subject.id);
  const header = `| Scenario | ${subjectIds.join(" | ")} |`;
  const separator = `|---|${subjectIds.map(() => "---").join("|")}|`;
  const rows = scenarioIds.map((scenarioId) => {
    const cells = subjectIds.map((subjectId) => {
      const result = report.results.find(
        (candidate) => candidate.scenarioId === scenarioId && candidate.subjectId === subjectId,
      );
      return statusCell(result);
    });
    return `| ${scenarioId} | ${cells.join(" | ")} |`;
  });
  return [header, separator, ...rows].join("\n");
}

function renderSubjectTable(report: Report): string {
  const rows = report.subjects.map((subject) => {
    const capabilities = subject.capabilities.length > 0 ? subject.capabilities.join(", ") : "—";
    return `| ${subject.id} | ${subject.version} | ${subject.commit} | ${subject.mode} | ${capabilities} |`;
  });
  return [
    "| Subject | Version | Commit | Mode | Capabilities |",
    "|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}

function renderResult(result: ScenarioResult): string {
  const lines: string[] = [
    `### ${result.scenarioId} — ${result.subjectId}: **${result.status}**`,
    "",
    result.scenarioName,
    "",
    "| Check | Status | Expected | Actual | Detail |",
    "|---|---|---|---|---|",
  ];
  for (const check of result.repeats[0]?.checks ?? []) {
    lines.push(
      `| ${check.label} | ${check.status} | ${JSON.stringify(check.expected)} | ${JSON.stringify(
        check.actual,
      )} | ${check.detail ?? ""} |`,
    );
  }
  lines.push("");
  lines.push(`Repeats: ${result.repeats.map((repeat) => repeat.status).join(", ")}`);
  const traces = result.repeats.map((repeat) => repeat.tracePath).filter(Boolean);
  if (traces.length > 0) {
    lines.push(`Traces: ${traces.join(", ")}`);
  }
  if (result.notes.length > 0) {
    lines.push(`Notes: ${[...new Set(result.notes)].join("; ")}`);
  }
  lines.push("");
  return lines.join("\n");
}

export function renderMarkdown(report: Report): string {
  return [
    `# DeepSeek SuperAgent Bench — ${report.suite} report`,
    "",
    "> **Unofficial, not affiliated with DeepSeek.** MVP behavioral matrix, not a leaderboard.",
    "",
    `- Generated: ${report.generatedAt}`,
    `- Bench version: ${report.benchVersion}`,
    `- Environment: Node ${report.environment.node}, ${report.environment.platform}`,
    `- Repeats per scenario: ${report.repeats}`,
    "",
    "## Subjects",
    "",
    renderSubjectTable(report),
    "",
    "## Matrix",
    "",
    renderMatrix(report),
    "",
    "## Results",
    "",
    ...report.results.map(renderResult),
    "## Limitations",
    "",
    ...report.limitations.map((limitation) => `- ${limitation}`),
    "",
  ].join("\n");
}

export async function writeReport(report: Report, outDir: string): Promise<void> {
  await writeFile(join(outDir, "report.json"), JSON.stringify(report, null, 2), "utf8");
  await writeFile(join(outDir, "report.md"), renderMarkdown(report), "utf8");
}

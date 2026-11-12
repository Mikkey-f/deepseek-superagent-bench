import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const root = resolve(process.cwd());
const coreSource = join(root, "results", "latest");
const selftestSource = join(root, "results", "selftest");
const outDir = join(root, "docs", "results", "v0.1.0");
const coreTraceDir = join(outDir, "traces");
const selftestTraceDir = join(outDir, "negative-controls");

const home = process.env.USERPROFILE || process.env.HOME || "<home>";
const parent = dirname(root);

function sanitizeString(value) {
  const pairs = [
    [root, "<workspace>/deepseek-superagent-bench"],
    [root.replaceAll("\\", "/"), "<workspace>/deepseek-superagent-bench"],
    [parent, "<workspace>"],
    [parent.replaceAll("\\", "/"), "<workspace>"],
    [home, "<home>"],
    [home.replaceAll("\\", "/"), "<home>"],
    ["bench-in-secret", "<redacted-in-secret>"],
    ["bench-out-secret", "<redacted-out-secret>"],
    ["results\\latest\\traces\\", "traces/"],
    ["results/latest/traces/", "traces/"],
    ["results\\selftest\\traces\\", "negative-controls/"],
    ["results/selftest/traces/", "negative-controls/"],
  ];
  let result = value;
  for (const [from, to] of pairs) result = result.split(from).join(to);
  return result;
}

function sanitizeValue(value) {
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeValue(entry)]),
    );
  }
  return value;
}

function reportTracePath(repeat, prefix) {
  if (!repeat.tracePath) return;
  repeat.tracePath = `${prefix}/${basename(repeat.tracePath)}`;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(sanitizeValue(value), null, 2)}\n`, "utf8");
}

function publish(source, destination, tracePrefix, reportName) {
  mkdirSync(destination, { recursive: true });

  const reportJson = JSON.parse(readFileSync(join(source, "report.json"), "utf8"));
  reportJson.environment.cwd = "<workspace>/deepseek-superagent-bench";
  for (const result of reportJson.results) {
    for (const repeat of result.repeats) reportTracePath(repeat, tracePrefix);
  }
  writeJson(join(outDir, `${reportName}-report.json`), reportJson);

  const reportMarkdown = sanitizeString(readFileSync(join(source, "report.md"), "utf8"));
  writeFileSync(join(outDir, `${reportName}-report.md`), reportMarkdown, "utf8");

  for (const file of readdirSync(join(source, "traces"))) {
    if (!file.endsWith(".json")) continue;
    const trace = JSON.parse(readFileSync(join(source, "traces", file), "utf8"));
    writeJson(join(destination, file), trace);
  }
}

mkdirSync(outDir, { recursive: true });
rmSync(coreTraceDir, { recursive: true, force: true });
rmSync(selftestTraceDir, { recursive: true, force: true });
publish(coreSource, coreTraceDir, "traces", "core");
publish(selftestSource, selftestTraceDir, "negative-controls", "selftest");

console.log(`Snapshot written to ${outDir}`);

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const benchRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspace = resolve(benchRoot, "..");

const subjects = [
  {
    id: "lofisu",
    source: join(workspace, "deepseek-super-agent"),
    runtimeOnly: true,
  },
  {
    id: "opensuperagent",
    source: join(workspace, "opensuperagent"),
    runtimeOnly: false,
  },
];

function commitOf(source) {
  try {
    return execFileSync("git", ["-C", source, "rev-parse", "HEAD"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "unknown";
  }
}

function dirtyOf(source) {
  try {
    return execFileSync("git", ["-C", source, "status", "--porcelain"], {
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

for (const subject of subjects) {
  if (!existsSync(join(subject.source, "package.json"))) {
    console.warn(`[prepare] skip ${subject.id}: source not found at ${subject.source}`);
    continue;
  }
  const commit = commitOf(subject.source);
  const dirty = dirtyOf(subject.source);
  if (dirty) {
    console.warn(
      `[prepare] warning: ${subject.id} has uncommitted changes; commit ${commit} does not capture them`,
    );
  }
  const dest = join(benchRoot, "results", "subjects", subject.id);
  console.log(`[prepare] ${subject.id}: ${subject.source} -> ${dest}`);
  await rm(dest, { recursive: true, force: true });
  await mkdir(dirname(dest), { recursive: true });
  await cp(subject.source, dest, {
    recursive: true,
    filter: (source) => {
      const normalized = source.replaceAll("\\", "/");
      return !(
        normalized.includes("/.git") ||
        normalized.includes("/node_modules") ||
        normalized.includes("/dist/") ||
        normalized.includes("/coverage/") ||
        normalized.includes("/.turbo/")
      );
    },
  });

  const pkg = JSON.parse(await readFile(join(subject.source, "package.json"), "utf8"));
  await writeFile(
    join(dest, "subject.json"),
    JSON.stringify({ source: subject.source, commit, version: pkg.version }, null, 2),
  );

  console.log(
    `[prepare] installing dependencies for ${subject.id} (runtime-only=${subject.runtimeOnly})`,
  );
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = ["install", "--no-package-lock", "--no-save", "--no-audit", "--no-fund"];
  if (subject.runtimeOnly) args.splice(1, 0, "--omit=dev");
  execFileSync(npm, args, { cwd: dest, stdio: "inherit", shell: true });
}

console.log("[prepare] done");

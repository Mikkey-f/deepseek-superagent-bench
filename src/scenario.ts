import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { z } from "zod";

const eventSchema = z.object({
  id: z.string().min(1),
  kind: z
    .enum(["issue_comment", "pull_request_comment", "im_message", "manual"])
    .default("issue_comment"),
  source: z.string().min(1).default("github"),
  threadKey: z.string().min(1),
  actor: z.string().min(1),
  actorIsBot: z.boolean().optional(),
  text: z.string().min(1),
  mentionsAgent: z.boolean().default(false),
  timestamp: z.string().default("2026-01-01T00:00:00.000Z"),
  metadata: z.record(z.unknown()).optional(),
});

const expectationSchema = z
  .object({
    ticketsCreated: z.number().int().min(0).optional(),
    outboundAtLeast: z.number().int().min(0).optional(),
    outboundAtMost: z.number().int().min(0).optional(),
    duplicateOutbound: z.boolean().optional(),
    unauthorizedWork: z.boolean().optional(),
  })
  .default({});

const scenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  events: z.array(eventSchema).min(1),
  restart: z.boolean().default(false),
  repeats: z.number().int().positive().optional(),
  timeoutMs: z.number().int().positive().default(15_000),
  quietMs: z.number().int().positive().default(600),
  requires: z.array(z.string()).default([]),
  policy: z
    .object({
      allowedActors: z.array(z.string()).optional(),
    })
    .optional(),
  mock: z.unknown().optional(),
  expect: expectationSchema,
});

export type ScenarioEvent = z.infer<typeof eventSchema>;
export type ScenarioExpectation = z.infer<typeof expectationSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;

export async function loadScenarioFile(path: string): Promise<Scenario> {
  const raw = await readFile(path, "utf8");
  const parsed = YAML.parse(raw) as unknown;
  return scenarioSchema.parse(parsed);
}

export async function loadSuite(root: string, suite: string): Promise<Scenario[]> {
  const dir = join(root, "scenarios", suite);
  const files = (await readdir(dir)).filter(
    (file) => file.endsWith(".yaml") || file.endsWith(".yml"),
  );
  const scenarios = await Promise.all(
    files.sort().map((file) => loadScenarioFile(join(dir, file))),
  );
  return scenarios;
}

export function validateScenario(input: unknown): Scenario {
  return scenarioSchema.parse(input);
}

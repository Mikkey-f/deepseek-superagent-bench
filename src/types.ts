export type AdapterMode = "black-box" | "in-process" | "fixture";

export type Capability =
  | "event-injection"
  | "outbound-capture"
  | "authorization"
  | "state-snapshot"
  | "ticket-count"
  | "eval-count"
  | "restart"
  | "work-active"
  | "token-metrics"
  | "tool-calls";

export interface BenchEvent {
  /** Stable external id. Re-delivery of the same id must not create new work. */
  id: string;
  kind: "issue_comment" | "pull_request_comment" | "im_message" | "manual";
  source: string;
  threadKey: string;
  actor: string;
  actorIsBot?: boolean;
  text: string;
  mentionsAgent: boolean;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface Outbound {
  id: string;
  threadKey: string;
  body: string;
  createdAt?: string;
  destination?: string;
  metadata?: Record<string, unknown>;
}

export interface StateSnapshot {
  tickets?: number;
  openTickets?: number;
  endedTickets?: number;
  evals?: number;
  outbound?: number;
  [key: string]: unknown;
}

export interface MockModelCall {
  at: string;
  path: string;
  request: unknown;
  response: unknown;
}

export interface BenchContext {
  mockModelUrl: string;
  /** Per-run scratch directory. Adapters may persist state here for restart tests. */
  workDir: string;
  scenario: import("./scenario.js").Scenario;
  log: (message: string) => void;
}

export interface SubjectAdapter {
  readonly id: string;
  readonly version: string;
  readonly commit: string;
  readonly mode: AdapterMode;
  readonly capabilities: ReadonlySet<Capability>;
  /** Optional hook to configure the mock model before the subject starts. */
  configureMockModel?(server: MockModelController): void;
  start(ctx: BenchContext): Promise<void>;
  inject(events: BenchEvent[]): Promise<void>;
  outbound(): Promise<Outbound[]>;
  snapshot?(): Promise<StateSnapshot>;
  /** Whether accepted work is still pending or running before a restart. */
  workActive?(): Promise<boolean>;
  restart?(): Promise<void>;
  stop(): Promise<void>;
  /** Adapter-side diagnostics, written to the raw trace. */
  getLogs?(): string[];
}

export interface MockModelController {
  setConfig(config: import("./mock-model/server.js").MockModelConfig): void;
  getCalls(): MockModelCall[];
}

export type CheckStatus = "pass" | "fail" | "not_tested";

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  expected: unknown;
  actual: unknown;
  detail?: string;
}

export type ScenarioStatus = "pass" | "fail" | "not_tested" | "flaky" | "error";

export interface RepeatEvidence {
  repeat: number;
  status: ScenarioStatus;
  checks: CheckResult[];
  outbound: Outbound[];
  snapshot?: StateSnapshot;
  modelCalls: MockModelCall[];
  durationMs: number;
  midFlightObserved?: boolean;
  error?: string;
  tracePath?: string;
}

export interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  subjectId: string;
  status: ScenarioStatus;
  repeats: RepeatEvidence[];
  notes: string[];
}

export interface SubjectMetadata {
  id: string;
  version: string;
  commit: string;
  mode: AdapterMode;
  capabilities: Capability[];
}

export interface Report {
  schemaVersion: "0.1";
  generatedAt: string;
  benchVersion: string;
  environment: {
    node: string;
    platform: string;
    cwd: string;
  };
  suite: string;
  repeats: number;
  subjects: SubjectMetadata[];
  results: ScenarioResult[];
  limitations: string[];
}

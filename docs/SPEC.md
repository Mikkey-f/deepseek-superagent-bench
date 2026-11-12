# Benchmark Specification (MVP)

> **Unofficial, not affiliated with DeepSeek.** This document defines the
> benchmark's observable semantics, not the behavior of any subject.

- **Bench version**: 0.1.0
- **Report schema**: `0.1`
- **Status**: MVP, 2026-11-12
- **Scope**: core suite, C1/C2/C3/C5/C7, fixture + two real subjects

## 1. Purpose and non-goals

This benchmark asks whether proactive super-agent **system behavior** is
reliable when the same synthetic event is delivered, duplicated, rejected, or
interrupted by a restart. It is a conformance and regression tool, not a model
quality benchmark.

Non-goals:

- ranking subjects on one overall score;
- measuring model quality, task success, latency, cost, or code quality;
- testing destructive security exploits;
- modifying, forking, or committing to subject repositories.

## 2. Terms

| Term | Meaning in this benchmark |
|---|---|
| **Subject** | An implementation under test, driven through an adapter. |
| **Adapter** | The benchmark-owned integration that injects events, captures outbound, and optionally snapshots state. |
| **Event / Trigger** | A synthetic external input with a stable `id`, a thread, an actor, text, and a timestamp. |
| **Thread** | The conversation key an event belongs to, e.g. `acme/checkout#12`. |
| **Ticket** | A unit of accepted work. Exposed only when the adapter can count it. |
| **Outbound** | An observable message the subject emits for a thread. |
| **Capability** | A behavior the adapter can observe or drive. Capabilities gate assertions. |
| **measured** | Observed directly in a trace or report check. |
| **not_tested** | Not observable through the adapter; never treated as a failure by default. |

## 3. Adapter modes and capabilities

| Mode | Description | Typical capture |
|---|---|---|
| `black-box` | Subject runs as a separate process and is driven over HTTP. | Public API, webhook callbacks, HTTP snapshots. |
| `in-process` | Subject runtime is imported into the benchmark process. | Runtime APIs and durable stores. |
| `fixture` | A benchmark-owned minimal subject. | Used only to validate the evaluator. |

The following capabilities exist: `event-injection`, `outbound-capture`,
`authorization`, `state-snapshot`, `ticket-count`, `eval-count`, `restart`,
`token-metrics`, `tool-calls`.

A scenario declares the capabilities it requires. If any are missing, the
scenario is `not_tested`; no behavioral assertion is evaluated. This is a
fairness rule: an adapter that cannot observe a behavior must not be failed for
it.

Adapter mode and subject commit/version are reported with every result.

## 4. Scenario format

Scenarios are YAML files under `scenarios/<suite>/`. The loader validates them
with Zod; unknown fields are rejected by the schema where applicable.

```yaml
id: c1-direct-request
name: Direct request from an allowed user
description: >
  An allowed maintainer asks the agent directly.
events:
  - id: evt-c1-001
    kind: issue_comment          # issue_comment | pull_request_comment | im_message | manual
    source: github
    threadKey: acme/checkout#12
    actor: alice
    text: "@superagent-bot please fix the login timeout on checkout"
    mentionsAgent: true
    timestamp: "2026-01-01T00:00:00.000Z"
policy:
  allowedActors: [alice, bob]
restart: false
delivery: sequential
timeoutMs: 15000
quietMs: 600
requires: [event-injection, outbound-capture]
expect:
  outboundAtLeast: 1
  duplicateOutbound: false
```

| Field | Meaning |
|---|---|
| `events[]` | Events injected in order. Reusing an `id` models redelivery of the same external event. |
| `restart` | Run `adapter.restart()` after the initial settle window. |
| `delivery` | `sequential` (default) passes all events in one `inject()` call; `concurrent` calls `inject()` once per event and overlaps them. |
| `repeats` | Optional per-scenario repeat count; otherwise the CLI value applies. |
| `timeoutMs` | Maximum settle time per phase. |
| `quietMs` | Outbound must be unchanged for this long before a phase is considered settled. |
| `requires` | Capabilities needed to evaluate the scenario. |
| `policy.allowedActors` | Local allowlist used for authorization scenarios. |
| `expect.*` | Observable assertions; see below. |
| `mock` | Reserved for per-scenario model scripting. The MVP uses adapter-level scripts. |

### 4.1 Assertions

| Assertion | Observable | Pass condition |
|---|---|---|
| `outboundAtLeast` | outbound list | `outbound.length >= n` |
| `outboundAtMost` | outbound list | `outbound.length <= n` |
| `duplicateOutbound: false` | outbound list | No repeated `(threadKey, body)` and no repeated outbound `id`. |
| `unauthorizedWork: false` | outbound list + `policy.allowedActors` | No outbound on a thread whose only events came from non-allowed actors. |
| `ticketsCreated` | `StateSnapshot.tickets` | Exact ticket count, or `not_tested` if the adapter exposes no count. |

The evaluator also reports a `not_tested` check for a restart scenario whose
adapter has no restart hook, and for a scenario with no assertions.

## 5. Core scenarios

### C1 — `c1-direct-request`

One allowed actor asks directly. Requires `event-injection`,
`outbound-capture`. Expects at least one outbound message and no duplicate
outbound. This is the control case; it shows the subject is wired end-to-end.

### C2 — `c2-duplicate-delivery`

The same event `id` is delivered twice. Requires `event-injection`,
`outbound-capture`, `ticket-count`. Expects exactly one ticket, at most two
outbound messages, and no duplicate outbound. A subject may acknowledge once or
twice, but must not enqueue the same message twice or create a second unit of
work. The ticket count is asserted, not merely recorded, so duplicate work is
observable.

### C3 — `c3-concurrent-duplicate-delivery`

The same event `id` is delivered twice concurrently (`delivery: concurrent`).
Requires `event-injection`, `outbound-capture`, `ticket-count`. Expects exactly
one ticket, at least one and at most two outbound messages, and no duplicate
outbound. This is the racing counterpart to C2: it checks whether deduplication
holds when both deliveries overlap. Concurrency is at the adapter boundary; the
MVP does not simulate separate processes, network reordering, or partitions.

### C5 — `c5-unauthorized-sender`

An actor outside `policy.allowedActors` asks for work. Requires
`event-injection`, `outbound-capture`, `authorization`, `ticket-count`. Expects
zero tickets, zero outbound, and no outbound on an unauthorized thread. This is
a benign behavioral assertion, not an exploit.

### C7 — `c7-restart-recovery`

A direct request is accepted, then the subject is restarted. Requires
`event-injection`, `outbound-capture`, `restart`, `ticket-count`. Expects exactly
one ticket, at least one outbound message, and no duplicate outbound. If restart
is unsupported, the scenario is `not_tested`.

**Known limitation:** the MVP runner restarts after the initial settle window,
so C7 tests durable state and non-replay across a restart, not a hard crash
mid-flight. See §9.

## 6. Execution lifecycle

For each scenario × subject × repeat:

1. The runner creates a fresh per-repeat work directory. Any previous contents
   from the same `--out` run are removed first; otherwise durable inboxes would
   dedupe the synthetic event and produce a vacuous pass.
2. An OpenAI-compatible mock model server starts on a loopback port. It records
   every request and response.
3. `adapter.configureMockModel()` may install a deterministic script.
4. `adapter.start()` starts the subject against the mock model and the work
   directory.
5. `adapter.inject(events)` delivers the events. Duplicate ids are delivered as
   duplicates on purpose. With `delivery: concurrent`, the runner calls
   `adapter.inject([event])` for each event through `Promise.all`.
6. The runner waits for settle: outbound count must be stable for `quietMs`,
   bounded by `timeoutMs`. Reaching `outboundAtMost` early also settles the
   phase.
7. If `restart` is true and supported, `adapter.restart()` runs, then the
   runner settles again.
8. The runner reads `adapter.outbound()` and, if available,
   `adapter.snapshot()`.
9. The evaluator gates on capabilities and evaluates the assertions.
10. `adapter.stop()` and the mock server are stopped. The trace is written.

Each trace contains the scenario events, outbound, snapshot, mock model calls,
adapter logs, checks, status, error (if any), and duration. Traces are the
primary evidence; the Markdown/JSON report summarizes them.

## 7. Repeat aggregation

The CLI repeats each scenario three times by default. The scenario result is:

1. `error` if any repeat errored;
2. otherwise `fail` if any repeat failed;
3. otherwise `flaky` if repeats disagree on status, check statuses, or outbound
   count;
4. otherwise `not_tested` if any repeat was gated;
5. otherwise `pass`.

A flaky result is not averaged away or hidden. Repeats exist to expose
nondeterminism in the subject or the adapter.

### 7.1 Negative controls

The evaluator ships with three fixture-mode negative controls. They are
intentionally broken and exist only to prove the evaluator can fail:

| Adapter | Injected fault | Required failure |
|---|---|---|
| `fixture-double-work` | Processes duplicate event ids and creates two tickets. | C2 `tickets-created` fails. |
| `fixture-replay-restart` | Replays an outbound message after restart. | C7 `no-duplicate-outbound` fails. |
| `fixture-unauthorized-work` | Ignores the allowlist and acts for an unauthorized sender. | C5 `tickets-created` and `unauthorized-work` fail. |

`npm test` and `npm run bench:selftest` assert these outcomes in CI. Negative
controls are not subjects and never appear in the reference matrix.

## 8. Report and fairness

Every report includes:

- bench version, generation time, Node/platform, suite, and repeats;
- subject id, version, commit, adapter mode, and declared capabilities;
- one row per scenario × subject, with per-check expected/actual values;
- repeat statuses and trace paths;
- limitations and the unofficial disclaimer.

Rules:

- No overall score or single winner.
- A pass is scoped to the observable assertion, at that commit, in that run.
- `measured` observations are separated from limitations.
- Reports are version- and commit-pinned so a rerun can be compared.
- No real model, API key, GitHub repository, or chat account is used in the
  default suite.

## 9. Known limitations (MVP)

- **Scripted model.** The mock model is deterministic and scripted per adapter.
  It exercises control flow, not model quality.
- **Synthetic source.** Events are local and uniform; real GitHub/Feishu
  payloads and delivery retries are not in the MVP.
- **C3 concurrency is adapter-boundary.** The two deliveries overlap at
  `adapter.inject()`, but separate processes, network reordering, and partitions
  are not simulated.
- **Restart timing.** C7 restarts after the initial work settles, as noted in
  §5. Mid-flight crash recovery is a v0.2 candidate.
- **In-process capture is not delivery.** For in-process subjects, outbound may
  be read from a durable outbox, including messages not yet delivered by a real
  channel adapter. The adapter mode is disclosed.
- **Small subject set.** Two real subjects and five scenarios; absence of a
  failure is not evidence of production readiness.
- **Windows development environment.** The reference run is on Windows 11; CI
  runs the offline fixture suite on Ubuntu. Real-subject adapters are exercised
  locally, not in CI.
- **Node version caveat.** Some opensuperagent dependencies declare Node ≥22.19.
  The 2026-11-12 reference run on Node 22.14 completed successfully, but prefer
  Node 22.19+ for real-subject runs.

## 10. Versioning and changes

- Scenario ids are stable. Changing an assertion in a way that changes
  pass/fail semantics requires a documented migration note.
- `schemaVersion` in `report.json` changes on breaking report changes.
- New scenarios go to the v0.2 candidate list before entering the core suite.
- Subject repositories are read-only. Adapters pin a commit and must not copy
  subject business code.

## 11. Security and disclosure

Scenarios are benign and non-destructive. If a scenario reveals a real security
issue in a subject, report it privately to the maintainers first; do not publish
exploit details. The benchmark itself does not attempt privilege escalation,
denial of service, or data exfiltration.

## 12. References

- Domain terminology and design semantics: the official
  `dsh-superagent-prototype` docs, read-only.
- Subject integrations: [`../src/adapters/`](../src/adapters/).
- Scenario files: [`../scenarios/core/`](../scenarios/core/).
- Fairness and source notes: [`REFERENCES.md`](REFERENCES.md).

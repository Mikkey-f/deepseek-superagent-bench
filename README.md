# deepseek-superagent-bench

[![CI](https://github.com/Mikkey-f/deepseek-superagent-bench/actions/workflows/ci.yml/badge.svg)](https://github.com/Mikkey-f/deepseek-superagent-bench/actions/workflows/ci.yml)

> **Unofficial. Not affiliated with DeepSeek.** The name identifies the design
> family this suite tests. It includes no DeepSeek code, logos, or branding.

A reproducible, offline-by-default **behavioral benchmark and conformance suite**
for proactive super-agent implementations. It drives real implementations with
synthetic triggers, duplicate delivery, unauthorized senders, and restarts, then
reports what it could observe — and what it could not.

**Status: MVP (2026-11).** Six core scenarios, two subjects, a fixture that
validates the evaluator, and negative controls that prove it can fail. This is a
behavioral matrix, not a leaderboard.
[中文说明](README.zh-CN.md) · [Benchmark spec](docs/SPEC.md)

## Why

Proactive agents are easy to demo and hard to trust. The interesting failures
are not “the model wrote a bad sentence”; they are:

- the same webhook is delivered twice and the agent does the work twice;
- an unauthorized sender gets the agent to act;
- a restart replays or duplicates an external side effect;
- the agent replies on a thread it should have stayed out of.

Those are system behaviors. They are testable without a real model, a real
GitHub repository, or a real chat account.

## Core scenarios

| ID | Scenario | What it checks |
|---|---|---|
| C1 | `direct-request` | An allowed user asks directly; the subject produces outbound work without duplicates. |
| C2 | `duplicate-delivery` | The same external event arrives twice; no duplicate work or outbound. |
| C3 | `concurrent-duplicate-delivery` | The same event arrives twice concurrently; one ticket and no duplicate outbound. |
| C4 | `mid-flight-restart` | The subject restarts while work is active; recovery does not duplicate work or outbound. |
| C5 | `unauthorized-sender` | A sender outside the allowed list gets no ticket, no outbound, and no reply. |
| C7 | `restart-recovery` | The subject restarts; no duplicate work or outbound. `not_tested` if restart is unsupported. |

C2, C5, and C7 require a ticket count; an adapter without `ticket-count`
reports those scenarios `not_tested`. The `fixture` subject exists only to
validate the evaluator. It is not a product or a benchmark subject.

### Evaluator self-test

`npm test` and `npm run bench:selftest` include three deliberately broken
fixture-mode adapters:

| Negative control | Intended failure |
|---|---|
| `fixture-double-work` | C2 creates two tickets for one event; the ticket assertion must fail. |
| `fixture-replay-restart` | C7 replays an outbound after restart; the duplicate assertion must fail. |
| `fixture-unauthorized-work` | C5 acts on an unauthorized sender; ticket and authorization assertions must fail. |

They exist only to prove the evaluator can fail. They are not subjects and are
excluded from the reference matrix.

## Quickstart

Requirements: Node.js 22+ and npm. The default suites need no API keys and no
network access.

```bash
npm install
npm run bench:fixture          # offline, no subject repositories needed
```

To run real subjects, place the subject checkouts next to this repository:

```text
workspace/
├─ deepseek-superagent-bench/   # this repo
├─ opensuperagent/              # thefullgc/opensuperagent
└─ deepseek-super-agent/        # LofiSu/deepseek-super-agent
```

Then:

```bash
npm run prepare:subjects       # copies subjects to results/subjects and installs deps
npm run bench:core             # fixture + opensuperagent + lofisu, 3 repeats
```

Outputs:

- `results/latest/report.md` — human-readable matrix and per-check details;
- `results/latest/report.json` — machine-readable results;
- `results/latest/traces/` — raw events, outbound, snapshots, model calls.

Equivalent CLI:

```bash
npm run bench -- run --suite core --subjects fixture,opensuperagent,lofisu --repeats 3 --out results/latest
```

## Reference local run

The following is a reproducibility snapshot from 2026-11-12 (Node v22.14.0,
Windows 11), three repeats per scenario. It is not a permanent leaderboard:

- opensuperagent `0.1.1`, commit `a9f9b7e`
- deepseek-super-agent (LofiSu) `0.1.0`, commit `e705e87`

| Scenario | fixture (evaluator check) | opensuperagent (black-box) | lofisu (in-process) |
|---|---|---|---|
| C1 direct-request | pass 3/3 | pass 3/3 | pass 3/3 |
| C2 duplicate-delivery | pass 3/3 | pass 3/3 | pass 3/3 |
| C3 concurrent-duplicate-delivery | pass 3/3 | pass 3/3 | pass 3/3 |
| C4 mid-flight-restart | pass 3/3 | pass 3/3 | pass 3/3 |
| C5 unauthorized-sender | pass 3/3 | pass 3/3 | pass 3/3 |
| C7 restart-recovery | pass 3/3 | pass 3/3 | pass 3/3 |

In C2 all three produced one outbound message and one ticket; the ticket count
is asserted. C3 produced the same result under concurrent delivery. C4 observed
active work before the restart (`midFlightObserved: true`) and still produced one
ticket and one outbound per subject. In C5 all three produced zero tickets and
zero outbound; zero model calls was observed. In C7 all three still had one
ticket and one outbound message after restart; the ticket count is asserted. The
full per-check evidence is in the generated `results/latest/report.md` and
traces.

## What is measured

Only observable behavior:

- outbound messages (body, thread, count);
- duplicate outbound (same thread + body, or duplicate ids);
- state snapshots when the adapter exposes them (ticket count, decisions, evals);
- restart behavior.

The MVP uses a scripted mock model and a synthetic event source. It does not
measure model quality, task success, latency, or cost. See
[`docs/SPEC.md`](docs/SPEC.md) for the exact assertions and gating rules.

## Adapter contract

A subject adapter implements `SubjectAdapter` in `src/adapters/`:

```ts
interface SubjectAdapter {
  readonly id: string;
  readonly version: string;
  readonly commit: string;
  readonly mode: "black-box" | "in-process" | "fixture";
  readonly capabilities: ReadonlySet<Capability>;
  configureMockModel?(server: MockModelController): void;
  start(ctx: BenchContext): Promise<void>;
  inject(events: BenchEvent[]): Promise<void>;
  outbound(): Promise<Outbound[]>;
  snapshot?(): Promise<StateSnapshot>;
  restart?(): Promise<void>;
  stop(): Promise<void>;
  getLogs?(): string[];
}
```

Capabilities gate assertions: if an adapter cannot observe a behavior, the
entire scenario is reported `not_tested` and its assertions are not evaluated.
Adapter mode and subject commit are recorded in every report.

## Fairness and limitations

- **No overall winner.** Results are per-scenario; a subject can pass one
  behavior and fail another.
- **Synthetic inputs.** The mock model is scripted; the event source is local.
  A real model may behave differently.
- **MVP coverage is narrow.** Six scenarios; Feishu, the official prototype,
  and delivery retries are not in the MVP.
- **In-process capture is not delivery.** For in-process subjects, outbound may
  be read from a durable outbox, including messages not yet delivered by a real
  channel adapter. The report says so.
- **C2 allows two acknowledgements.** The scenario asserts one ticket and no
  duplicate outbound, but a subject may send two distinct acknowledgement
  messages for the same unit of work.
- **C3 concurrency is at the adapter boundary.** The two deliveries overlap at
  `adapter.inject()`, but the benchmark does not simulate separate processes,
  network reordering, or partition scenarios.
- **Restart timing.** C7 restarts after the initial work settles; C4 restarts
  while work is active, using a delayed worker and a graceful stop/start. Neither
  simulates a hard process crash with unflushed state.
- **Node version caveat.** Some opensuperagent dependencies declare Node ≥22.19.
  The reference run on Node 22.14 completed, but prefer Node 22.19+ for
  real-subject runs; CI exercises only the offline fixture suite.
- **A pass is not production readiness.** It means the observable assertion
  held in this run, at this commit.
- **Flaky is a result.** Repeats that disagree are marked `flaky`, not averaged
  away.

## Subjects and credits

- [opensuperagent](https://github.com/thefullgc/opensuperagent) — Apache-2.0.
- [deepseek-super-agent](https://github.com/LofiSu/deepseek-super-agent) — MIT.
- The official [`dsh-superagent-prototype`](https://github.com/deepseek-ai/dsh-superagent-prototype) is a source of design semantics, not an MVP subject.

This project does not fork or copy business code from the subjects. It drives
them through their public or local interfaces and pins the tested commit.

## License

MIT. See [LICENSE](LICENSE). Third-party names and code remain under their own
licenses.

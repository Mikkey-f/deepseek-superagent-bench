# A benchmark that proves it can fail

> The most important property of a benchmark is not that every subject passes.
> It is that the benchmark can demonstrate it is able to fail.
>
> **Unofficial, not affiliated with DeepSeek.** This project tests a design
> family; it contains no DeepSeek code, logos, or branding.

## Why another agent benchmark

Proactive agents are easy to demo. A message arrives, the agent creates a task,
calls a model, and replies. The hard part is what happens at the edges:

- the same webhook is delivered twice and the agent does the work twice;
- two identical deliveries arrive at once and deduplication stops working;
- a sender outside the allowlist gets the agent to act;
- the process restarts while a worker is still running, and an external side
  effect is replayed;
- the agent replies on the wrong thread.

These are system behaviors, not model-quality questions. They can be reproduced
without a real model, a real GitHub repository, or a real chat account.

`deepseek-superagent-bench` is a reproducible, offline-by-default behavioral
matrix and conformance suite for proactive super-agent implementations. It is
not another agent runtime, and it is not a leaderboard.

## What is measured

Only observable behavior:

- outbound messages: thread, body, count, and duplicates;
- state snapshots when an adapter exposes them: tickets, decisions, assignments;
- durable state across restarts;
- model calls in scenarios where that matters.

It does not measure model quality, task success, latency, cost, or code quality.
The default suite uses a scripted mock model and synthetic local events, so the
result describes control flow and persistence, not a production model.

## Six scenarios

| ID | Scenario | Assertion |
|---|---|---|
| C1 | Direct request | An allowed request produces outbound work without duplicates. |
| C2 | Sequential duplicate delivery | The same event twice still yields one ticket and no duplicate outbound. |
| C3 | Concurrent duplicate delivery | Two overlapping `inject()` calls still yield one ticket. |
| C4 | Mid-flight restart | Restart while work is active; recovery does not duplicate work or outbound. |
| C5 | Unauthorized sender | No ticket, no reply, and no outbound on the unauthorized thread. |
| C7 | After-settle restart | Restart after the first work settles; durable state is not replayed. |

Every scenario declares the capabilities it requires. If an adapter cannot
observe a behavior, the whole scenario is reported `not_tested`, not failed.
That is a fairness rule: “we cannot see it” is not evidence that the subject did
it wrong.

## Prove the evaluator can fail

A suite where every subject passes may simply have weak assertions. To show that
this evaluator can detect failures, it ships with three intentionally broken
fixture-mode adapters:

- `fixture-double-work`: creates two tickets for one event; C2's ticket assert
  must fail.
- `fixture-replay-restart`: replays an outbound after restart; C7's duplicate
  assert must fail.
- `fixture-unauthorized-work`: ignores the allowlist; C5's ticket and
  authorization asserts must fail.

They are not subjects and never appear in the matrix. `npm test` and
`npm run bench:selftest` assert the expected failures in CI. The negative
controls are the most important credibility addition in v0.1.0.

## C4: the mid-flight gap

The original C7 restarts after the first work settles. That checks durable state
and non-replay, but not “the worker was still running when the process stopped.”

C4 does this:

1. inject a request and wait for the subject to report active work;
2. hold the worker open with a configurable delay;
3. restart before it can finish;
4. wait for recovery and assert one ticket and no duplicate outbound.

Adapters expose `workActive()`; the runner writes `midFlightObserved: true` to
the trace. OpenSuperAgent logs `[recover] handled 1 incomplete runs` after the
restart, and LofiSu performs assignment recovery. The restart really overlaps
active work.

The limitation is explicit: C4 uses a graceful stop/start with a delayed worker,
not a hard crash with unflushed state. That limitation is in the README and
SPEC, not hidden behind a green check.

## Evidence and fairness

The pinned v0.1.0 snapshot is in
[`docs/results/v0.1.0`](https://github.com/Mikkey-f/deepseek-superagent-bench/tree/main/docs/results/v0.1.0):

- opensuperagent `0.1.1` @ `a9f9b7e`, black-box HTTP;
- deepseek-super-agent (LofiSu) `0.1.0` @ `e705e87`, in-process Runtime;
- Node v22.14.0, Windows 11, three repeats per scenario × subject;
- **18/18 combinations pass, 3/3 repeats**;
- raw traces, report JSON/Markdown, and negative controls are published, with
  local paths redacted.

All 18 combinations currently pass. That says the two implementations agree on
these scenarios; it also means **we have not found a differentiating failure
yet**. This is a conformance matrix, not a ranking. A pass means the observable
assertion held in this run at this commit, not that a system is production-ready.

Fairness rules:

- subject repositories are never modified; adapters use public or pinned local
  interfaces;
- every result pins version, commit, adapter mode, and environment;
- repeated runs that disagree are marked `flaky`, not averaged away;
- no single overall winner; results are per scenario.

## Limitations

- Scripted model and synthetic events; real-model integration may behave
  differently.
- C4 is a graceful restart with a delayed worker, not a hard crash.
- In-process LofiSu outbound is captured from a durable outbox, not a real
  channel delivery.
- CI runs the fixture and negative controls only; real-subject matrices are
  local.
- Coverage is still small: C6 thread isolation, delivery retries, and approval
  gates are not in v0.1.0.

## Run it and contribute

```bash
npm install
npm run bench:fixture      # offline; no subject repositories
npm run bench:selftest     # prove the evaluator can fail
```

For real subjects, place their checkouts next to this repository:

```bash
npm run prepare:subjects
npm run bench:core
```

If you maintain a proactive agent, an adapter contribution is welcome. If you
think a failure mode matters, bring a reproducible event sequence. The question
is whether a scenario reliably exposes system behavior, not who ranks first.

## Disclaimer

This is an unofficial project, not affiliated with DeepSeek. The name identifies
the design family under test; the repository contains no DeepSeek code, logos, or
branding. Subject names and code remain under their own licenses.

- Repository: https://github.com/Mikkey-f/deepseek-superagent-bench
- Spec: https://github.com/Mikkey-f/deepseek-superagent-bench/blob/main/docs/SPEC.md
- Results: https://github.com/Mikkey-f/deepseek-superagent-bench/tree/main/docs/results/v0.1.0

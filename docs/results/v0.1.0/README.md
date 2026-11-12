# v0.1.0 results snapshot — 2026-11-12

> **Unofficial, not affiliated with DeepSeek.** This snapshot records what the
> benchmark observed on one machine at one commit. It is not a leaderboard.

This directory is the pinned public evidence for the v0.1.0 release. The raw
traces were generated locally by `npm run bench:core` and sanitized for
publication (workspace paths redacted). The benchmark itself does not call a real
model, GitHub, Feishu, or any external network.

## Environment

- Bench: `0.1.0`, report schema `0.1`
- Node: `v22.14.0`
- Platform: Windows 11 (`win32 x64`)
- Date: 2026-11-12
- Repeats: 3 per scenario × subject

## Subjects

| Subject | Version | Commit | Mode |
|---|---|---|---|
| opensuperagent | 0.1.1 | `a9f9b7efc3ca8e055de2ef9fa0595155e4e108ed` | black-box HTTP |
| deepseek-super-agent (LofiSu) | 0.1.0 | `e705e872796ed1900fa6b42093136e577861de7f` | in-process |
| fixture | 1.0.0 | `fixture` | evaluator fixture |

## Matrix

| Scenario | fixture | opensuperagent | lofisu |
|---|---|---|---|
| C1 direct-request | pass 3/3 | pass 3/3 | pass 3/3 |
| C2 duplicate-delivery | pass 3/3 | pass 3/3 | pass 3/3 |
| C3 concurrent-duplicate-delivery | pass 3/3 | pass 3/3 | pass 3/3 |
| C4 mid-flight-restart | pass 3/3 | pass 3/3 | pass 3/3 |
| C5 unauthorized-sender | pass 3/3 | pass 3/3 | pass 3/3 |
| C7 restart-recovery | pass 3/3 | pass 3/3 | pass 3/3 |

Observed values:

- C1: 1 outbound, 1 ticket per repeat.
- C2/C3: duplicate delivery still yields 1 outbound and 1 ticket per repeat.
- C4: 1 ticket and 1 outbound per repeat; `midFlightObserved: true` on every
  repeat. OpenSuperAgent logs `[recover] handled 1 incomplete runs` after the
  restart.
- C5: 0 tickets, 0 outbound, 0 model calls per repeat.
- C7: after restart, still 1 outbound and 1 ticket; no duplicate outbound.

## Negative controls

The evaluator ships with intentionally broken fixture-mode adapters. They are
not subjects and do not appear in the matrix above.

| Adapter | Required failure |
|---|---|
| `fixture-double-work` | C2 `tickets-created` fails (2 tickets). |
| `fixture-replay-restart` | C7 `no-duplicate-outbound` fails after restart. |
| `fixture-unauthorized-work` | C5 `tickets-created` and `unauthorized-work` fail. |

See [selftest-report.md](selftest-report.md) and the
[negative-controls traces](negative-controls/).

## Files

- [core-report.md](core-report.md) — human-readable matrix and checks.
- [core-report.json](core-report.json) — machine-readable results.
- [traces/](traces/) — sanitized raw traces for every repeat.
- [selftest-report.md](selftest-report.md) — negative-control results.
- [selftest-report.json](selftest-report.json) — machine-readable selftest.
- [negative-controls/](negative-controls/) — sanitized broken-fixture traces.

## Reproduce

From the bench repository, with subject checkouts in sibling directories:

```bash
npm install
npm run prepare:subjects
npm run bench:core
npm run bench:selftest
npm run snapshot:results
```

The fixture-only suite runs without subject repositories:

```bash
npm run bench:fixture
```

## Limitations

- Scripted mock model and synthetic event source; this does not measure model
  quality, latency, cost, or task success.
- C4 is a graceful stop/start with a delayed worker, not a hard crash with
  unflushed state.
- In-process LofiSu outbound is read from its durable outbox; that is not proof
  of real channel delivery.
- All 18 scenario×subject combinations pass. This demonstrates conformance on
  these scenarios, not production readiness or a ranking.
- CI exercises the fixture and negative controls; real-subject matrices are
  local and version-pinned.

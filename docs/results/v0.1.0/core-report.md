# DeepSeek SuperAgent Bench — core report

> **Unofficial, not affiliated with DeepSeek.** MVP behavioral matrix, not a leaderboard.

- Generated: 2026-11-12T10:05:10.036Z
- Bench version: 0.1.0
- Environment: Node v22.14.0, win32 x64
- Repeats per scenario: 3

## Subjects

| Subject | Version | Commit | Mode | Capabilities |
|---|---|---|---|---|
| fixture | 1.0.0 | fixture | fixture | authorization, eval-count, event-injection, outbound-capture, restart, state-snapshot, ticket-count, work-active |
| opensuperagent | 0.1.1 | a9f9b7efc3ca8e055de2ef9fa0595155e4e108ed | black-box | authorization, event-injection, outbound-capture, restart, state-snapshot, ticket-count, work-active |
| lofisu | 0.1.0 | e705e872796ed1900fa6b42093136e577861de7f | in-process | authorization, eval-count, event-injection, outbound-capture, restart, state-snapshot, ticket-count, work-active |

## Matrix

| Scenario | fixture | opensuperagent | lofisu |
|---|---|---|---|
| c1-direct-request | pass | pass | pass |
| c2-duplicate-delivery | pass | pass | pass |
| c3-concurrent-duplicate-delivery | pass | pass | pass |
| c4-mid-flight-restart | pass | pass | pass |
| c5-unauthorized-sender | pass | pass | pass |
| c7-restart-recovery | pass | pass | pass |

## Results

### c1-direct-request — fixture: **pass**

Direct request from an allowed user

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |

Repeats: pass, pass, pass
Traces: traces/fixture--c1-direct-request--r1.json, traces/fixture--c1-direct-request--r2.json, traces/fixture--c1-direct-request--r3.json

### c1-direct-request — opensuperagent: **pass**

Direct request from an allowed user

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |

Repeats: pass, pass, pass
Traces: traces/opensuperagent--c1-direct-request--r1.json, traces/opensuperagent--c1-direct-request--r2.json, traces/opensuperagent--c1-direct-request--r3.json

### c1-direct-request — lofisu: **pass**

Direct request from an allowed user

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |

Repeats: pass, pass, pass
Traces: traces/lofisu--c1-direct-request--r1.json, traces/lofisu--c1-direct-request--r2.json, traces/lofisu--c1-direct-request--r3.json

### c2-duplicate-delivery — fixture: **pass**

Duplicate delivery of the same trigger

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at most | pass | 2 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass, pass, pass
Traces: traces/fixture--c2-duplicate-delivery--r1.json, traces/fixture--c2-duplicate-delivery--r2.json, traces/fixture--c2-duplicate-delivery--r3.json

### c2-duplicate-delivery — opensuperagent: **pass**

Duplicate delivery of the same trigger

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at most | pass | 2 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass, pass, pass
Traces: traces/opensuperagent--c2-duplicate-delivery--r1.json, traces/opensuperagent--c2-duplicate-delivery--r2.json, traces/opensuperagent--c2-duplicate-delivery--r3.json

### c2-duplicate-delivery — lofisu: **pass**

Duplicate delivery of the same trigger

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at most | pass | 2 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass, pass, pass
Traces: traces/lofisu--c2-duplicate-delivery--r1.json, traces/lofisu--c2-duplicate-delivery--r2.json, traces/lofisu--c2-duplicate-delivery--r3.json

### c3-concurrent-duplicate-delivery — fixture: **pass**

Concurrent duplicate delivery of the same trigger

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| outbound messages at most | pass | 2 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass, pass, pass
Traces: traces/fixture--c3-concurrent-duplicate-delivery--r1.json, traces/fixture--c3-concurrent-duplicate-delivery--r2.json, traces/fixture--c3-concurrent-duplicate-delivery--r3.json

### c3-concurrent-duplicate-delivery — opensuperagent: **pass**

Concurrent duplicate delivery of the same trigger

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| outbound messages at most | pass | 2 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass, pass, pass
Traces: traces/opensuperagent--c3-concurrent-duplicate-delivery--r1.json, traces/opensuperagent--c3-concurrent-duplicate-delivery--r2.json, traces/opensuperagent--c3-concurrent-duplicate-delivery--r3.json

### c3-concurrent-duplicate-delivery — lofisu: **pass**

Concurrent duplicate delivery of the same trigger

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| outbound messages at most | pass | 2 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass, pass, pass
Traces: traces/lofisu--c3-concurrent-duplicate-delivery--r1.json, traces/lofisu--c3-concurrent-duplicate-delivery--r2.json, traces/lofisu--c3-concurrent-duplicate-delivery--r3.json

### c4-mid-flight-restart — fixture: **pass**

Restart while work is in flight

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| outbound messages at most | pass | 2 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass, pass, pass
Traces: traces/fixture--c4-mid-flight-restart--r1.json, traces/fixture--c4-mid-flight-restart--r2.json, traces/fixture--c4-mid-flight-restart--r3.json

### c4-mid-flight-restart — opensuperagent: **pass**

Restart while work is in flight

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| outbound messages at most | pass | 2 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass, pass, pass
Traces: traces/opensuperagent--c4-mid-flight-restart--r1.json, traces/opensuperagent--c4-mid-flight-restart--r2.json, traces/opensuperagent--c4-mid-flight-restart--r3.json

### c4-mid-flight-restart — lofisu: **pass**

Restart while work is in flight

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| outbound messages at most | pass | 2 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass, pass, pass
Traces: traces/lofisu--c4-mid-flight-restart--r1.json, traces/lofisu--c4-mid-flight-restart--r2.json, traces/lofisu--c4-mid-flight-restart--r3.json

### c5-unauthorized-sender — fixture: **pass**

Request from an unauthorized sender

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at most | pass | 0 | 0 |  |
| no outbound on unauthorized thread | pass | 0 | 0 |  |
| tickets created | pass | 0 | 0 |  |

Repeats: pass, pass, pass
Traces: traces/fixture--c5-unauthorized-sender--r1.json, traces/fixture--c5-unauthorized-sender--r2.json, traces/fixture--c5-unauthorized-sender--r3.json

### c5-unauthorized-sender — opensuperagent: **pass**

Request from an unauthorized sender

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at most | pass | 0 | 0 |  |
| no outbound on unauthorized thread | pass | 0 | 0 |  |
| tickets created | pass | 0 | 0 |  |

Repeats: pass, pass, pass
Traces: traces/opensuperagent--c5-unauthorized-sender--r1.json, traces/opensuperagent--c5-unauthorized-sender--r2.json, traces/opensuperagent--c5-unauthorized-sender--r3.json

### c5-unauthorized-sender — lofisu: **pass**

Request from an unauthorized sender

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at most | pass | 0 | 0 |  |
| no outbound on unauthorized thread | pass | 0 | 0 |  |
| tickets created | pass | 0 | 0 |  |

Repeats: pass, pass, pass
Traces: traces/lofisu--c5-unauthorized-sender--r1.json, traces/lofisu--c5-unauthorized-sender--r2.json, traces/lofisu--c5-unauthorized-sender--r3.json

### c7-restart-recovery — fixture: **pass**

Restart after a direct request

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass, pass, pass
Traces: traces/fixture--c7-restart-recovery--r1.json, traces/fixture--c7-restart-recovery--r2.json, traces/fixture--c7-restart-recovery--r3.json

### c7-restart-recovery — opensuperagent: **pass**

Restart after a direct request

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass, pass, pass
Traces: traces/opensuperagent--c7-restart-recovery--r1.json, traces/opensuperagent--c7-restart-recovery--r2.json, traces/opensuperagent--c7-restart-recovery--r3.json

### c7-restart-recovery — lofisu: **pass**

Restart after a direct request

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass, pass, pass
Traces: traces/lofisu--c7-restart-recovery--r1.json, traces/lofisu--c7-restart-recovery--r2.json, traces/lofisu--c7-restart-recovery--r3.json

## Limitations

- MVP uses a scripted mock model and a synthetic event source; it does not measure real model quality.
- Only the core suite is exercised; unlisted behaviors are not tested.
- Real subjects are driven through their public or local interfaces; internal behavior is not asserted.
- A pass means the scenario's observable assertions held for this run; it is not a production-readiness claim.
- Results are version/commit/date pinned; rerun to reproduce.
- Unofficial, not affiliated with DeepSeek.

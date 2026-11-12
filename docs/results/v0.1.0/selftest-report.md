# DeepSeek SuperAgent Bench — core report

> **Unofficial, not affiliated with DeepSeek.** MVP behavioral matrix, not a leaderboard.

- Generated: 2026-11-12T10:32:37.009Z
- Bench version: 0.1.0
- Environment: Node v22.14.0, win32 x64
- Repeats per scenario: 1

## Subjects

| Subject | Version | Commit | Mode | Capabilities |
|---|---|---|---|---|
| fixture-double-work | 1.0.0-negative | fixture-negative | fixture | authorization, event-injection, outbound-capture, restart, state-snapshot, ticket-count |
| fixture-replay-restart | 1.0.0-negative | fixture-negative | fixture | authorization, event-injection, outbound-capture, restart, state-snapshot, ticket-count |
| fixture-unauthorized-work | 1.0.0-negative | fixture-negative | fixture | authorization, event-injection, outbound-capture, restart, state-snapshot, ticket-count |

## Matrix

| Scenario | fixture-double-work | fixture-replay-restart | fixture-unauthorized-work |
|---|---|---|---|
| c1-direct-request | pass | pass | pass |
| c2-duplicate-delivery | fail | pass | pass |
| c3-concurrent-duplicate-delivery | fail | pass | pass |
| c4-mid-flight-restart | not_tested | not_tested | not_tested |
| c5-unauthorized-sender | pass | pass | fail |
| c7-restart-recovery | pass | fail | pass |

## Results

### c1-direct-request — fixture-double-work: **pass**

Direct request from an allowed user

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |

Repeats: pass
Traces: negative-controls/fixture-double-work--c1-direct-request--r1.json

### c1-direct-request — fixture-replay-restart: **pass**

Direct request from an allowed user

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |

Repeats: pass
Traces: negative-controls/fixture-replay-restart--c1-direct-request--r1.json

### c1-direct-request — fixture-unauthorized-work: **pass**

Direct request from an allowed user

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |

Repeats: pass
Traces: negative-controls/fixture-unauthorized-work--c1-direct-request--r1.json

### c2-duplicate-delivery — fixture-double-work: **fail**

Duplicate delivery of the same trigger

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at most | pass | 2 | 2 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | fail | 1 | 2 |  |

Repeats: fail
Traces: negative-controls/fixture-double-work--c2-duplicate-delivery--r1.json

### c2-duplicate-delivery — fixture-replay-restart: **pass**

Duplicate delivery of the same trigger

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at most | pass | 2 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass
Traces: negative-controls/fixture-replay-restart--c2-duplicate-delivery--r1.json

### c2-duplicate-delivery — fixture-unauthorized-work: **pass**

Duplicate delivery of the same trigger

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at most | pass | 2 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass
Traces: negative-controls/fixture-unauthorized-work--c2-duplicate-delivery--r1.json

### c3-concurrent-duplicate-delivery — fixture-double-work: **fail**

Concurrent duplicate delivery of the same trigger

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 2 |  |
| outbound messages at most | pass | 2 | 2 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | fail | 1 | 2 |  |

Repeats: fail
Traces: negative-controls/fixture-double-work--c3-concurrent-duplicate-delivery--r1.json

### c3-concurrent-duplicate-delivery — fixture-replay-restart: **pass**

Concurrent duplicate delivery of the same trigger

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| outbound messages at most | pass | 2 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass
Traces: negative-controls/fixture-replay-restart--c3-concurrent-duplicate-delivery--r1.json

### c3-concurrent-duplicate-delivery — fixture-unauthorized-work: **pass**

Concurrent duplicate delivery of the same trigger

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| outbound messages at most | pass | 2 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass
Traces: negative-controls/fixture-unauthorized-work--c3-concurrent-duplicate-delivery--r1.json

### c4-mid-flight-restart — fixture-double-work: **not_tested**

Restart while work is in flight

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| capability work-active | not_tested | true | false | fixture-double-work does not declare this capability |

Repeats: not_tested
Traces: negative-controls/fixture-double-work--c4-mid-flight-restart--r1.json
Notes: fixture-double-work does not declare this capability

### c4-mid-flight-restart — fixture-replay-restart: **not_tested**

Restart while work is in flight

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| capability work-active | not_tested | true | false | fixture-replay-restart does not declare this capability |

Repeats: not_tested
Traces: negative-controls/fixture-replay-restart--c4-mid-flight-restart--r1.json
Notes: fixture-replay-restart does not declare this capability

### c4-mid-flight-restart — fixture-unauthorized-work: **not_tested**

Restart while work is in flight

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| capability work-active | not_tested | true | false | fixture-unauthorized-work does not declare this capability |

Repeats: not_tested
Traces: negative-controls/fixture-unauthorized-work--c4-mid-flight-restart--r1.json
Notes: fixture-unauthorized-work does not declare this capability

### c5-unauthorized-sender — fixture-double-work: **pass**

Request from an unauthorized sender

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at most | pass | 0 | 0 |  |
| no outbound on unauthorized thread | pass | 0 | 0 |  |
| tickets created | pass | 0 | 0 |  |

Repeats: pass
Traces: negative-controls/fixture-double-work--c5-unauthorized-sender--r1.json

### c5-unauthorized-sender — fixture-replay-restart: **pass**

Request from an unauthorized sender

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at most | pass | 0 | 0 |  |
| no outbound on unauthorized thread | pass | 0 | 0 |  |
| tickets created | pass | 0 | 0 |  |

Repeats: pass
Traces: negative-controls/fixture-replay-restart--c5-unauthorized-sender--r1.json

### c5-unauthorized-sender — fixture-unauthorized-work: **fail**

Request from an unauthorized sender

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at most | fail | 0 | 1 |  |
| no outbound on unauthorized thread | fail | 0 | 1 | negative-out-1 |
| tickets created | fail | 0 | 1 |  |

Repeats: fail
Traces: negative-controls/fixture-unauthorized-work--c5-unauthorized-sender--r1.json
Notes: negative-out-1

### c7-restart-recovery — fixture-double-work: **pass**

Restart after a direct request

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass
Traces: negative-controls/fixture-double-work--c7-restart-recovery--r1.json

### c7-restart-recovery — fixture-replay-restart: **fail**

Restart after a direct request

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 2 |  |
| no duplicate outbound | fail | "no duplicate (threadKey, body) or id" | {"duplicates":[{"key":"acme/checkout#12\u0000negative ack for acme/checkout#12","count":2}],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: fail
Traces: negative-controls/fixture-replay-restart--c7-restart-recovery--r1.json

### c7-restart-recovery — fixture-unauthorized-work: **pass**

Restart after a direct request

| Check | Status | Expected | Actual | Detail |
|---|---|---|---|---|
| outbound messages at least | pass | 1 | 1 |  |
| no duplicate outbound | pass | "no duplicate (threadKey, body) or id" | {"duplicates":[],"duplicateIds":0} |  |
| tickets created | pass | 1 | 1 |  |

Repeats: pass
Traces: negative-controls/fixture-unauthorized-work--c7-restart-recovery--r1.json

## Limitations

- MVP uses a scripted mock model and a synthetic event source; it does not measure real model quality.
- Only the core suite is exercised; unlisted behaviors are not tested.
- Real subjects are driven through their public or local interfaces; internal behavior is not asserted.
- A pass means the scenario's observable assertions held for this run; it is not a production-readiness claim.
- Results are version/commit/date pinned; rerun to reproduce.
- Unofficial, not affiliated with DeepSeek.

# DeepSeek SuperAgent Bench — STATUS

> **Last updated**: 2026-11-12
> **Current phase**: MVP plus post-MVP P0/C3/C4 shipped; v0.1.0 release
> snapshot and articles prepared in the release PR; tag after merge
> **Current milestone**: 6 core scenarios × 2 real subjects + fixture +
> negative controls; 18/18 local matrix pass; pinned results published
> **Next action**: merge the release PR, create the `v0.1.0` tag/release, then
> resume `superagent-runtime/`
> **Owner**: user; **implementation**: Claude Code
> **Canonical plan**: [`PLAN.md`](PLAN.md) · **Spec**: [`docs/SPEC.md`](docs/SPEC.md)

---

## 2026-11-12 decisions (owner)

- **Name**: `deepseek-superagent-bench` for discoverability. README first screen
  states “Unofficial, not affiliated with DeepSeek”; no official logos.
- **Repo**: public under `Mikkey-f/deepseek-superagent-bench`; `main` receives
  changes only through PRs; CI required.
- **MVP scope**: 2 subjects × 4 scenarios — opensuperagent (black-box HTTP) and
  LofiSu (in-process Runtime); C1 direct-request, C2 duplicate-delivery,
  C5 unauthorized-sender, C7 restart-recovery; plus a fixture adapter that
  validates the evaluator itself.
- **Post-MVP promotion**: owner approved P0 negative controls → C3 concurrent
  duplicate delivery → C4 mid-flight restart on 2026-11-12. The core suite is
  now six scenarios.
- **Tooling**: npm (pnpm global install was declined); Node 22; TypeScript;
  Vitest; Biome.
- **Paused**: `superagent-runtime/` is not part of this work; resume after the
  bench release.

## Definition of done

### MVP (shipped)

- [x] Core, fixture, two real subject adapters, and four original core scenarios.
- [x] `npm run bench:fixture` runs offline with no subject repositories.
- [x] `npm run bench:core` runs offline (no API keys, no real GitHub/Feishu).
- [x] Fixture and both real subjects passed the original 4 scenarios, 3/3.
- [x] JSON + Markdown report + raw traces; subject commit/version, adapter mode,
      capabilities, `measured`/`not_tested`, limitations, date.
- [x] Capability gating: a missing required capability makes the whole scenario
      `not_tested`; covered by unit tests.
- [x] README (English + Chinese), `docs/SPEC.md`, CI workflow.
- [x] Feature branch PR #1 and docs PRs #2–#4 merged with green CI; `main`
      branch protection enabled.
- [x] Gate-fix PR #5 merged: LF normalization, C2/C7 ticket assertions, dirty
      subject warning.
- [x] Owner authorized the post-MVP sequence on 2026-11-12; the release
      acceptance run is still recommended before tagging.

### Post-MVP (owner-promoted)

- [x] P0 negative controls: three deliberately broken fixtures prove the
      evaluator fails C2/C5/C7; `npm run bench:selftest` runs in CI. PR #6.
- [x] C3 concurrent duplicate delivery: overlapping `inject()` calls still yield
      one ticket and no duplicate outbound. PR #7.
- [x] C4 mid-flight restart: restart while work is active; `midFlightObserved`
      is recorded, and no duplicate work/outbound appears. PR #8.
- [ ] C6 concurrent threads / thread isolation.
- [ ] Delivery retry and approval/mandate scenarios (v0.2 candidates).
- [x] Pinned public results snapshot at
      [`docs/results/v0.1.0`](docs/results/v0.1.0/) (release PR).
- [x] Chinese and English articles under [`docs/articles/`](docs/articles/)
      (release PR).
- [ ] GitHub Release `v0.1.0` tag (created after the release PR merges).
- [ ] Real-subject CI/nightly runs (CI currently exercises the fixture only).
- [ ] Official prototype adapter (timeboxed, experimental).

## Daily gates (MVP)

| Day | Date | Deliverable | Gate | Status |
|---|---|---|---|---|
| D1 | 11-12 | public repo, scaffold, core types/schema, mock model, runner, fixture, C1/C2, CLI | fixture 3/3 stable; `npm test` green | done |
| D2 | 11-13 | opensuperagent adapter, C1/C2/C5/C7, report JSON/MD | one real subject end-to-end; report readable | done early |
| D3 | 11-14 | LofiSu adapter, README, CI, first PR merge | CI green; owner can run one command | done early |

## Evidence log

Environment: Node v22.14.0, npm 10.9.2, git 2.49.0, gh 2.97.0 authenticated as
`Mikkey-f`. Windows 11, Bash via Git Bash.

### Checks (latest, 2026-11-12)

| Command | Result |
|---|---|
| `npm run typecheck` | pass, no output |
| `npm run lint` | pass, 23 files checked on Windows |
| `npm test` | 5 files / 12 tests pass; fixture suite 6 scenarios × 3 repeats; selftest included |
| `npm run bench:selftest` | negative controls fail as intended; control cases pass |
| `npm run bench:fixture` | pass 6/6, 3/3 repeats |
| `npm run bench:core` | pass 18/18 scenario×subject combinations, 3/3 repeats |
| `npm run build` | pass |

### Reference matrix (2026-11-12)

Pinned subjects:

- opensuperagent `0.1.1`, commit `a9f9b7efc3ca8e055de2ef9fa0595155e4e108ed`
  (black-box).
- deepseek-super-agent (LofiSu) `0.1.0`, commit
  `e705e872796ed1900fa6b42093136e577861de7f` (in-process).

| Scenario | fixture | opensuperagent | lofisu |
|---|---|---|---|
| C1 direct-request | pass 3/3 | pass 3/3 | pass 3/3 |
| C2 duplicate-delivery | pass 3/3 | pass 3/3 | pass 3/3 |
| C3 concurrent-duplicate-delivery | pass 3/3 | pass 3/3 | pass 3/3 |
| C4 mid-flight-restart | pass 3/3 | pass 3/3 | pass 3/3 |
| C5 unauthorized-sender | pass 3/3 | pass 3/3 | pass 3/3 |
| C7 restart-recovery | pass 3/3 | pass 3/3 | pass 3/3 |

Observed values:

- C1: 1 outbound, 1 ticket per repeat for every subject.
- C2/C3: duplicate delivery still yields 1 outbound and 1 ticket per repeat.
- C4: 1 ticket and 1 outbound per repeat; `midFlightObserved: true` on all
  repeats. OpenSuperAgent logs `[recover] handled 1 incomplete runs` after the
  restart.
- C5: 0 tickets, 0 outbound, 0 model calls per repeat; `ticketsCreated: 0` is
  asserted in addition to the outbound/authorization checks.
- C7: after restart, still 1 outbound and 1 ticket; no duplicate outbound.

Artifacts (gitignored, local): `results/latest/report.md`,
`results/latest/report.json`, `results/latest/traces/`,
`results/post-mvp-core.log`, `results/selftest/`.

### Negative controls

- `fixture-double-work` — C2 creates two tickets; `tickets-created` must fail.
- `fixture-replay-restart` — C7 replays an outbound; `no-duplicate-outbound`
  must fail.
- `fixture-unauthorized-work` — C5 acts for an unauthorized sender;
  `tickets-created` and `unauthorized-work` must fail.

These are evaluator tests, not subjects, and never appear in the reference
matrix.

### Release evidence

- MVP PR #1: https://github.com/Mikkey-f/deepseek-superagent-bench/pull/1
- Docs PRs #2–#4: release evidence and CI badge.
- Gate-fix PR #5: https://github.com/Mikkey-f/deepseek-superagent-bench/pull/5
- Negative controls PR #6: https://github.com/Mikkey-f/deepseek-superagent-bench/pull/6
- C3 PR #7: https://github.com/Mikkey-f/deepseek-superagent-bench/pull/7
- C4 PR #8: https://github.com/Mikkey-f/deepseek-superagent-bench/pull/8
- Release PR: pinned results, release notes, Chinese/English articles.
- Results snapshot: [`docs/results/v0.1.0`](docs/results/v0.1.0/); release
  notes: [`docs/releases/v0.1.0.md`](docs/releases/v0.1.0.md); tag:
  `<created after merge>`.
- CI jobs: PR #5 37 s, PR #6 47 s, PR #7 54 s, PR #8 55 s; main push after each
  merge passed (latest main run: 1 m 2 s). All on Node 22 (Ubuntu), job name
  `typecheck / lint / test / fixture`.
- Branch protection on `main`: PR required, required check
  `typecheck / lint / test / fixture` (strict/up-to-date), admins enforced, force
  pushes and branch deletion disabled.
- Post-merge verification: `npm run bench:core` passed 18/18 on `main`
  (2026-11-12).
- Use `git log` for the current `main` tip; this document does not pin a moving
  branch head.

### Fixes and review findings

- OpensuperAgent mock script: removed a broad `report|result|completed` regex
  that matched the router system prompt and prevented `start_task`.
- Runner: each repeat removes its work directory before starting, so durable
  inboxes cannot turn a rerun into a vacuous pass.
- Fairness: missing capabilities short-circuit the whole scenario to
  `not_tested`; C2/C7 assert one ticket, not only outbound.
- Windows lint: `.gitattributes` keeps text LF; the previous CRLF failure was
  masked by Linux CI.
- C4 timing: the pre-restart settle is skipped for mid-flight restarts; the
  runner waits for `workActive()` before stopping the subject.
- `prepare:subjects` warns when a subject checkout has uncommitted changes.

### Known caveats

- C4 is a graceful stop/start with a delayed worker, not a hard process crash
  with unflushed state.
- C7 restarts after the initial settle window; C4 covers active-work restarts.
- In-process LofiSu outbound is read from its durable outbox; that is not proof
  of real channel delivery. Adapter mode is disclosed in the report.
- C2/C3 permit two outbound acknowledgements for one ticket; they assert one
  unit of work.
- Some opensuperagent dependencies declare Node ≥22.19. The reference run on
  Node 22.14 completed successfully, but real-subject runs should prefer a
  Node 22.19+ toolchain.
- CI exercises only the offline fixture and negative controls; real-subject
  matrices are local.
- All 18 combinations currently pass. The suite proves conformance on these
  scenarios, not production readiness or a ranking.
- No real model, GitHub, Feishu, or external network was used.

## Blockers

- None technical.
- Remaining release work: acceptance run, pinned public results, tag/article.

## Open decisions

| Decision | Options | Recommendation | Status |
|---|---|---|---|
| Branch protection | required CI + PR | Keep | Done |
| npm package publish | publish vs defer | Defer; GitHub release first | Decided: no publish |
| Report publishing | repo Markdown vs Pages | Publish a pinned result snapshot next | Provisional |
| Next scenario | C6 vs delivery retry vs approval | C6 is cheap; delivery retry/approval need adapter work | Later |
| Runtime resume | after release vs now | After bench release, return to `superagent-runtime/` | Paused |

## Next actions

1. Merge the release PR after CI; create the `v0.1.0` tag and GitHub Release
   from `docs/releases/v0.1.0.md`.
2. Optional release acceptance: `npm run bench:core`, then inspect
   `results/latest/report.md` and one C4 trace.
3. Optionally add C6 or a real-subject CI job if community feedback warrants it.
4. Resume `superagent-runtime/`; do not expand the bench further without owner
   promotion.

## Handoff protocol

1. Read `CLAUDE.md` → `STATUS.md` → `PLAN.md` → `docs/REFERENCES.md` before acting.
2. Work on a feature branch; never commit directly to `main`; merge via PR.
3. Keep the benchmark fair: deterministic fixture, full-scenario capability
   gating, version pinning, no single overall winner, no overclaiming.
4. Record evidence before marking anything complete.
5. Update this file before ending a substantial session.
6. Never modify the three subject repos.

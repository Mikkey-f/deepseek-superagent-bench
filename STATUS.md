# DeepSeek SuperAgent Bench — STATUS

> **Last updated**: 2026-11-12
> **Current phase**: MVP implemented and locally verified; PR/CI handoff next
> **Current milestone**: public repo + core + 2 subjects × 4 scenarios + report
> **Next action**: commit on `feat/mvp-core`, push, open PR, wait for green CI,
> merge, then collect owner acceptance.
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
- **Tooling**: npm (pnpm global install was declined); Node 22; TypeScript;
  Vitest; Biome.
- **Paused**: `superagent-runtime/` is not part of this MVP; resume after the
  bench ships.

## MVP definition of done

- [x] Core, fixture, two real subject adapters, and four core scenarios exist.
- [x] `npm run bench:fixture` runs offline with no subject repositories.
- [x] `npm run bench:core` runs offline (no API keys, no real GitHub/Feishu).
- [x] Fixture passes all 4 scenarios, 3/3 repeats.
- [x] Both opensuperagent and LofiSu pass all 4 scenarios, 3/3 repeats in the
      local reference run.
- [x] JSON + Markdown report + raw traces; subject commit/version, adapter mode,
      capabilities, `measured`/`not_tested`, limitations, date.
- [x] Capability gating: a missing required capability makes the whole scenario
      `not_tested`; covered by unit tests.
- [x] README (English + Chinese), `docs/SPEC.md`, CI workflow.
- [ ] Feature branch PR merged with green CI; branch protection enabled.
- [ ] Owner acceptance.
- [ ] No npm publish in the MVP (intentional).

## Daily gates

| Day | Date | Deliverable | Gate | Status |
|---|---|---|---|---|
| D1 | 11-12 | public repo, scaffold, core types/schema, mock model, runner, fixture, C1/C2, CLI | fixture 3/3 stable; `npm test` green | done |
| D2 | 11-13 | opensuperagent adapter, C1/C2/C5/C7, report JSON/MD | one real subject end-to-end; report readable | done early |
| D3 | 11-14 | LofiSu adapter, README, CI, first PR merge | CI green; owner can run one command | in progress |

The D3 gate is now the release gate: commit, PR, CI, merge. LofiSu did not block;
both subjects are integrated.

## Evidence log

Environment: Node v22.14.0, npm 10.9.2, git 2.49.0, gh 2.97.0 authenticated as
`Mikkey-f`. Windows 11, Bash via Git Bash.

### Checks

| Command | Result |
|---|---|
| `npm run typecheck` | pass, no output |
| `npm run lint` | pass, 21 files checked |
| `npm test` | 4 files / 7 tests pass; fixture suite 4 scenarios × 3 repeats in ~11 s |
| `npm run bench:fixture` | pass 4/4, 3/3 repeats |
| `npm run bench:core` | pass 12/12 scenario×subject combinations, 3/3 repeats |

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
| C5 unauthorized-sender | pass 3/3 | pass 3/3 | pass 3/3 |
| C7 restart-recovery | pass 3/3 | pass 3/3 | pass 3/3 |

Observed values:

- C1: 1 outbound, 1 ticket per repeat for every subject.
- C2: duplicate delivery still yields 1 outbound and 1 ticket per repeat.
- C5: 0 tickets, 0 outbound, 0 model calls per repeat; `ticketsCreated: 0` is
  asserted in addition to the outbound/authorization checks.
- C7: after restart, still 1 outbound and 1 ticket; no duplicate outbound.

Artifacts (gitignored, local): `results/latest/report.md`,
`results/latest/report.json`, `results/latest/traces/`, `results/final-run.log`.

### Fixes made during the MVP run

- OpensuperAgent mock script: removed a broad `report|result|completed` regex
  that matched the router system prompt and prevented `start_task`; the router
  turn now always receives `start_task`, and the worker turn receives
  `_submit_result`.
- Runner: each repeat now removes its work directory before starting. Reusing a
  durable inbox made reruns vacuous because the synthetic event was deduped.
- Fairness: capability gating now short-circuits the entire scenario to
  `not_tested` when a required capability is missing, instead of failing
  dependent assertions. Added `test/assertions.test.ts`.
- C5: added `ticketsCreated: 0`, so “no work” is observable rather than inferred
  only from outbound.

### Known caveats

- C7 restarts after the initial settle window; it validates durable state and
  non-replay, not mid-flight crash recovery.
- In-process LofiSu outbound is read from its durable outbox; that is not proof
  of real channel delivery. Adapter mode is disclosed in the report.
- Some opensuperagent dependencies declare Node ≥22.19. The reference run on
  Node 22.14 completed successfully, but real-subject runs should prefer a
  Node 22.19+ toolchain. CI exercises only the fixture suite.
- No real model, GitHub, Feishu, or external network was used.

## Blockers

- None technical.
- Remaining release steps: commit/push/PR, green CI, merge, branch protection,
  owner acceptance.

## Open decisions

| Decision | Options | Recommendation | Status |
|---|---|---|---|
| Branch protection | required CI + PR | Require PR and the CI job after the first green run | Do after merge |
| npm package publish | publish vs defer | Defer; MVP is a GitHub open-source release | Decided: no publish |
| Report publishing | repo Markdown vs Pages | Repo Markdown + generated artifacts for now | Provisional |
| Post-MVP scope | C3/C4/C6 vs official prototype | Take community feedback; official prototype is high-risk | Later |

## Next actions

1. Commit the MVP in logical chunks on `feat/mvp-core`.
2. Push the branch and open a PR; wait for the GitHub Actions CI job.
3. Merge via PR, enable branch protection, and record the PR/CI result here.
4. Owner acceptance: run `npm run bench:fixture` and inspect
   `results/latest/report.md`.
5. Only after the bench MVP ships, consider resuming `superagent-runtime/`.

## Handoff protocol

1. Read `CLAUDE.md` → `STATUS.md` → `PLAN.md` → `docs/REFERENCES.md` before acting.
2. Work on a feature branch; never commit directly to `main`; merge via PR.
3. Keep the benchmark fair: deterministic fixture, full-scenario capability
   gating, version pinning, no single overall winner, no overclaiming.
4. Record evidence before marking anything complete.
5. Update this file before ending a substantial session.
6. Never modify the three subject repos.

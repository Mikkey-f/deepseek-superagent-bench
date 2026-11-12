# DeepSeek SuperAgent Bench — STATUS

> **Last updated**: 2026-11-12
> **Current phase**: MVP implementation (2–3 day timebox)
> **Current milestone**: public repo + core + 2 subjects × 4 scenarios + report
> **Next action**: create public GitHub repo, scaffold with npm, implement core
> and fixture, then adapters.
> **Owner**: user; **implementation**: Claude Code
> **Canonical plan**: [`PLAN.md`](PLAN.md) · **References**: [`docs/REFERENCES.md`](docs/REFERENCES.md)

---

## 2026-11-12 decisions (owner)

- **Name**: `deepseek-superagent-bench` for discoverability. README first screen
  must state “Unofficial, not affiliated with DeepSeek”; no official logos.
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

- [ ] Public repo exists; `main` protected; at least one PR merged with green CI.
- [ ] `npm run bench:core` runs offline (no API keys, no real GitHub/Feishu).
- [ ] Fixture passes all 4 scenarios, 3/3 repeats.
- [ ] At least one real subject passes or is capability-gated honestly; target
      both opensuperagent and LofiSu.
- [ ] JSON + Markdown report + raw traces; subject commit/version, adapter mode,
      capabilities, `measured`/`not_tested`, limitations, date.
- [ ] Duplicate delivery does not create duplicate work/outbound; restart does
      not duplicate outbound, or the capability is `not_tested` (never fail by
      default).
- [ ] README (English + Chinese) with disclaimer, quickstart, matrix, limits,
      how to add an adapter; CI green.
- [ ] No npm publish in the MVP.

## Daily gates

| Day | Date | Deliverable | Gate |
|---|---|---|---|
| D1 | 11-12 | public repo, scaffold, core types/schema, mock model, runner, fixture, C1/C2, CLI | fixture 3/3 stable; `npm test` green |
| D2 | 11-13 | opensuperagent adapter, C1/C2/C5/C7, report JSON/MD | one real subject end-to-end; report readable |
| D3 | 11-14 | LofiSu adapter or honest `not_tested`, README, CI, first PR merge | CI green; owner can run one command |

If LofiSu blocks for more than one day, ship opensuperagent + fixture and mark
LofiSu `not_tested` with a documented blocker; do not delay the release.

## Open decisions

| Decision | Options | Recommendation | Status |
|---|---|---|---|
| npm package name/scope | `deepseek-superagent-bench` or scoped | Defer until after MVP | Not blocking |
| Main branch protection details | required checks vs manual PR | Required CI + PR after first green run | Do during D3 |
| Report publishing | GitHub Pages vs repo Markdown | Repo Markdown for MVP | Provisional |

## Blockers

- None. GitHub CLI is authenticated as `Mikkey-f`; npm and Node 22 are present.
- LofiSu in-process integration is the main technical risk; timebox one day.

## Evidence log

- 2026-11-12: environment — Node v22.14.0, npm 10.9.2, git 2.49.0, gh 2.97.0
  authenticated as `Mikkey-f` (repo, workflow scopes). pnpm unavailable/declined;
  using npm.
- No implementation evidence yet.

## Handoff protocol

1. Read `CLAUDE.md` → `STATUS.md` → `PLAN.md` → `docs/REFERENCES.md` before acting.
2. Work on a feature branch; never commit directly to `main`; merge via PR.
3. Keep the benchmark fair: deterministic fixture, capability gating, version
   pinning, no single overall winner, no overclaiming.
4. Record evidence before marking anything complete.
5. Update this file before ending a substantial session.
6. Never modify the three subject repos.

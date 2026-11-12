# SuperAgent Bench — project instructions

A reproducible behavioral benchmark and conformance suite for proactive
super-agent implementations. **Not an agent runtime.** The benchmark measures
subject implementations; it does not compete with them.

Owner: the user. Implementation assisted by Claude Code. Keep the owner as the
first author in docs, commits, and release metadata unless told otherwise.

## Read first

At the start of every session, read in this order:

1. `STATUS.md` — current phase, next action, blockers, open decisions.
2. `PLAN.md` — WBS M0–M6, task IDs, estimates, acceptance criteria.
3. `docs/REFERENCES.md` — sources, specs, external dependencies.
4. The auto-loaded memory index for this workspace.

Do not restart ideation or re-litigate the chosen direction (cross-implementation
behavioral benchmark). Continue from `STATUS.md`.

## Scope

v0.1 target: 7 core scenarios × 2 stable subjects (opensuperagent, LofiSu) plus an
experimental adapter for the official prototype. Deterministic mock model and
source; offline CI; JSON/Markdown/HTML report; bilingual docs; npm release.

Non-goals: new agent runtime/UI/channels; real model or real GitHub/Feishu in CI;
single-winner leaderboard; security exploitation; modifying subject repos.

## Subject repos (read-only)

- `../dsh-superagent-prototype` — official DeepSeek research prototype.
- `../deepseek-super-agent` — LofiSu's independent implementation.
- `../opensuperagent` — thefullgc's implementation.

Never copy business code from a subject into the benchmark. Drive subjects via
adapters, pin them to a commit, and disclose the adapter mode (black-box or
in-process). Do not modify, commit to, or open changes in these repos as part of
benchmark work.

## Engineering rules

- **Evidence first.** Never mark a task complete without the command output,
  report file, or trace that proves it.
- **Deterministic by default.** Mock model and mock sources; no real network or
  API keys in CI. Assert observable behavior, not model text.
- **Fairness.** Same scenario semantics for every subject; capability-gate what
  an adapter cannot observe (`not_tested`, never fail by default). Disclose
  black-box vs in-process mode. No single overall ranking in v0.1.
- **Version pin.** Record repository, commit, version, adapter mode, and
  environment in every result.
- **Scope discipline.** 7 core scenarios only for v0.1. New scenarios go to the
  v0.2 candidate list in `PLAN.md` unless the owner promotes them.
- **Security.** Use benign scenarios only. If a scenario reveals a real security
  issue, report it privately to the subject's maintainers first; do not publish
  exploit details.
- **Licensing and naming.** MIT for this project. The owner chose the name
  `deepseek-superagent-bench` for discoverability. The README's first screen
  must state **"Unofficial, not affiliated with DeepSeek"**, must not use
  DeepSeek logos or branding, and must credit the official design docs and
  subject repos. Keep the disclaimer visible in every report.
- **No claims without limits.** Every result page states what was mocked, what
  was not tested, and the date/commit.

## Commands

The toolchain is not created yet (P002). Once it exists, add the exact commands
here and keep them in sync with `package.json`:

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm bench:core        # placeholder until P014
```

## Session workflow

1. Read `STATUS.md` and the relevant section of `PLAN.md`.
2. Pick the next task by ID; mark it in progress.
3. Implement, test, and record evidence.
4. Update `STATUS.md` (completed, next action, blockers, decisions).
5. Update `PLAN.md` checkboxes only for tasks with evidence.
6. Before ending the session, leave a handoff note in `STATUS.md`.

When the repo becomes a git repository, use branches and PRs; never commit
directly to `main`, and never force-push a shared branch. Add CI before merging
runtime changes.

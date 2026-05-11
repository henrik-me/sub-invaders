# CS04 — Daily challenge + harness-sync exercise + whale-shark + v1 polish

**Status:** planned
**Owner:** —
**Branch:** —
**Started:** —
**Closed:** —
**Depends on:** CS01 (Repo hardening + first SWA staging deploy), CS02 (Engine + game skeleton + minimal playable game), CS03 (Backend Function project + persistent leaderboard)

## Goal

Ship the final Sub Invaders v1 feature set: deterministic daily challenge mode, whale-shark mystery enemy, feature-flagged daily leaderboard routing, and final docs/validation polish. At CS04 close, normal play remains stable, daily mode is reproducible for all players on the same UTC date, and staging demonstrates both all-time and daily leaderboard flows.

CS04 is also the harness-sync exercise CS. Before other work, the orchestrator bumps `harness.config.json:version` from `v0.2.0`, runs `harness sync --mode=apply`, and commits managed/composed drift as a separate first commit. This validates the highest-risk downstream operation: adopting a harness update in a real consumer after several CSs have established local state.

Daily challenge, whale-shark, and v1 polish are grouped here because SI-CS01 through SI-CS03 should already have proven repo standards, engine, playable game, and persistent leaderboard. When close-out lands, Sub Invaders v1 is shipped.

## Background

By CS04 claim, `henrik-me/sub-invaders` should already have protected `main`, CI, staging SWA deploys, a playable vanilla-JS canvas game, .NET 8 isolated Functions, Storage Tables persistence, replay protection, and a network leaderboard. Remaining v1 scope is daily challenge, whale shark, feature-flag routing, docs, and validation.

The CS16 active plan still labels the daily-challenge section as "SI-CS03 surface" because the feature was originally planned there. The 2026-05-11 scope refinement moved it to SI-CS04 so CS03 can focus on backend persistence and CS04 can validate `harness sync --mode=apply` without overloading the leaderboard CS. Treat CS16 `## Scope refinement (2026-05-11)` as authoritative over the older section title.

The pin bump is the most operationally risky harness action: managed files, composed blocks, `.harness-lock.json`, and scaffold policy may drift. CS04 is the natural validation point because the consumer is established, but v1 has not yet closed, so friction can become an explicit learning or follow-up.

## Decisions (SI-CS04-specific)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| CS04-1 | Harness pin bump | Current pin is C16-2 `v0.2.0`; bump to latest published harness tag, or 40-char `main` SHA fallback | Validates the downstream update path. |
| CS04-2 | Pin-bump ordering | Orchestrator-owned task #1; separate first commit before fan-out | Avoids stale managed/composed files in sub-agent work. |
| CS04-3 | Daily flag default | Off in production/staging until CS04 close-out validation turns it on | Keeps unfinished daily mode hidden. |
| CS04-4 | Date source | UTC only: `YYYY-MM-DD` for display/partitions, `YYYYMMDD` for RNG seed | Same challenge for all players. |
| CS04-5 | Modifier pool | Fixed five: fog-of-war, speed-run, one-shot, boss-rush, inverted-controls | Matches CS16 design. |
| CS04-6 | Daily RNG | `seed(parseInt(yyyyMmDdString))`; all daily draws use that Mulberry32 stream | Deterministic without engine API change. |
| CS04-7 | Daily params | Fire/speed multipliers from `{0.8,1.0,1.2,1.5}`; whale interval from `{10s,15s,20s,30s}` | Required CS16 surface. |
| CS04-8 | HUD badge | `DAILY · <YYYY-MM-DD> · <modifier-name>`; modifier segment ≤24 chars | Canvas-safe display. |
| CS04-9 | Daily partition | `daily-YYYY-MM-DD`; all-time remains `all` | Clear Storage Tables keying. |
| CS04-10 | Whale-shark spawn/score | Normal `random(15-30s)`; daily uses deterministic interval; score is uniform `[50,100,200]` | Sea-themed UFO equivalent. |
| CS04-11 | Feature flag source | Frontend reads `<meta name="flags" content="dailyChallenge=on">`; backend uses `FEATURE_FLAGS_DAILY_CHALLENGE` | No build step assumed. |
| CS04-12 | Scaffold exercises | `feature-flags` and `health-check` must be invoked and findings recorded | First real use of both scaffolds. |

## Hard prerequisite — task #1

**Before any other CS04 work**, on the CS04 content branch:

1. Identify the harness pin to bump to.
   - **Preferred:** the latest published harness tag at CS04 claim time. Run `gh release list --repo henrik-me/agent-harness --limit 5` and choose the newest release newer than `v0.2.0` (for example, `v0.3.0` if that exists by then).
   - **Fallback:** if no newer published tag exists, pin to the current `main` SHA: `gh api repos/henrik-me/agent-harness/commits/main --jq .sha`. Use the full 40-character lowercase SHA.
   - Document the choice, command output summary, and rationale in the active CS file `## Notes / Learnings` section.
2. Edit `harness.config.json` and change only the `version` field from `v0.2.0` to the chosen tag or SHA. If any structured config access is scripted, read the relevant schema first; schema is source of truth.
3. Run `node node_modules/agent-harness/bin/harness.mjs sync --mode=apply` from the sub-invaders root if installed locally; otherwise use `npx -y "github:henrik-me/agent-harness#<new-pin>" sync --mode=apply`. `apply` writes managed/composed/lock changes, warns on stderr, prints `Sync complete (<n> changes applied).`, and exits non-zero on errors.
4. Commit the resulting drift (managed/composed file updates plus `.harness-lock.json` refresh) as a **separate first commit** on the CS04 content branch with title: `Pin bump: <old> → <new>; sync apply`.
5. Capture stdout/stderr summary, optional drift report, and lock-file diff stats in `## Notes / Learnings`. Do not paste secrets or raw unrelated logs.
6. Run `node bin/harness.mjs lint --quiet`; it must exit 0. On failure, file `harness-sync-apply-friction` and fix in-band only if clearly consumer-owned; otherwise escalate to a harness CS.
7. Run the test suite: `node --test src/**/*.test.mjs` and `dotnet test api/`. Both must pass before any sub-agent fan-out begins.

Only after task #1 commits cleanly should the orchestrator dispatch the parallel CS04 implementation sub-agents.

## Deliverables

0. **Pin bump + `harness sync --mode=apply`** — complete the hard prerequisite above as the first commit. Record old pin, new pin, command used, sync output summary, lint result, JS test result, .NET test result, and any harness friction in the active CS file.
1. **Date-seeded RNG usage in engine** — `src/engine/seed.mjs` already exists from CS02 with the Mulberry32 surface. Extend tests and documentation for the date-seeded usage pattern: `seed(parseInt(yyyyMmDdString))`. Do not change the engine API unless an existing CS02 contract makes this impossible; if so, escalate.
2. **Five daily modifiers in `src/game/modifiers/`** — implement small mutator functions applied at scene init, with at least one test per modifier:
   - `src/game/modifiers/fog-of-war.mjs` — visibility is limited to a circular halo around the submarine; the rest of the canvas is darkened via an additional canvas pass with a circular punch-out at player position.
   - `src/game/modifiers/speed-run.mjs` — 2× player movement speed, 2× formation speed, and 2× fire rate.
   - `src/game/modifiers/one-shot.mjs` — single life only; starting `lives` is reset to 1.
   - `src/game/modifiers/boss-rush.mjs` — only the Squid row spawns (11 enemies), enemy fire density is higher, each clear respawns immediately, and scoring uses a ×2 multiplier.
   - `src/game/modifiers/inverted-controls.mjs` — `←` moves right and `→` moves left for the whole run.
3. **Daily-challenge scene** — add `src/game/scenes/daily.mjs` and register it with the engine scene stack. It reads today's UTC date, computes `seed = parseInt(YYYYMMDD)`, deterministically chooses one modifier from the five-modifier pool, draws `enemyFireMultiplier`, `formationSpeedMultiplier`, and `whaleSharkInterval` from the specified sets, and reuses the `play.mjs` core game with daily mutators applied.
4. **HUD daily-mode badge** — extend the HUD path to draw `DAILY · <YYYY-MM-DD> · <modifier-name>` below the wave counter when daily scene is active. Prefer `src/game/hud-daily.mjs` as an overlay if `hud.mjs` ownership is unclear; do not introduce DOM UI.
5. **Frontend feature flag** — implement `src/game/flags.mjs` from the CS02 stub. Read `<meta name="flags" content="dailyChallenge=on">`, parse flat `key=value` pairs, and expose `dailyChallenge` as off by default. The main menu shows the daily-challenge option only when the flag is on.
6. **Backend feature flag + daily partitions** — add `FEATURE_FLAGS_DAILY_CHALLENGE` handling. `LeaderboardFunction.cs` must reject or hide `period=daily` routing when the flag is off, route daily scores/queries to `daily-YYYY-MM-DD` when on, and keep all-time routing unchanged. `HealthFunction.cs` returns current flag state so the scaffold exercise can verify propagation.
7. **Whale-shark mystery enemy** — implement `src/game/whaleshark.mjs`. The whale shark traverses the top of the screen at constant speed, renders above the formation but below player torpedoes, spawns at `random(15-30s)` in normal mode or the deterministic daily interval in daily mode, and awards uniformly random `[50, 100, 200]` points on hit.
8. **`staticwebapp.config.json`** — add or update env/header/app-settings mapping needed for `dailyChallenge` flag exposure and backend Function settings. Keep paths consumer-root-relative; do not use relative-up paths.
9. **`CHANGELOG.md` CS04 entry** — describe daily challenge, whale shark, pin bump/sync-apply validation, and declare **v1 shipped**.
10. **Final `ARCHITECTURE.md` update** — declare v1 shipped, document the five-modifier extensibility pattern, document UTC date-seed reproducibility, and describe daily leaderboard partitioning.
11. **`feature-flags` scaffold exercise** — read the scaffold README/contract, apply its recommended policy to this no-build frontend, and record any mismatch between scaffold assumptions and static ES module usage.
12. **`health-check` scaffold exercise** — verify `GET /api/health` returns the current dailyChallenge flag state in every deployed validation state.
13. **Three-state validation** — run three independent validation waves against: `dailyChallenge=off`, `dailyChallenge=on`, and `dailyChallenge=on` after the bumped pin/sync-apply outcome. In all three states, `npm test`, `dotnet test`, and verify-deploy probes must pass.

## Sub-agent fan-out

Task #1 is orchestrator-owned and sequential. Do not dispatch these sub-agents until the pin bump commit is complete and local lint/tests are green. Each row's owned files must remain disjoint; if an implementation needs a cross-row file, the orchestrator must either reassign ownership before dispatch or require the sub-agent to escalate rather than write.

| # | Sub-agent | Owned files | Notes / coordination |
|---|---|---|---|
| 1 | `cs04-modifiers-1` | `src/game/modifiers/fog-of-war.mjs`, `fog-of-war.test.mjs`, `speed-run.mjs`, `speed-run.test.mjs`, `one-shot.mjs`, `one-shot.test.mjs` | Three mutators/tests; no scene/HUD writes. |
| 2 | `cs04-modifiers-2` | `src/game/modifiers/boss-rush.mjs`, `boss-rush.test.mjs`, `inverted-controls.mjs`, `inverted-controls.test.mjs` | Read `invaders.mjs` only unless reassigned. |
| 3 | `cs04-daily-scene-and-hud` | `src/game/scenes/daily.mjs`, `daily.test.mjs`, `src/game/hud-daily.mjs`, `hud-daily.test.mjs` | Prefer overlay; escalate before editing `hud.mjs`. |
| 4 | `cs04-feature-flags-frontend` | `src/game/flags.mjs`, `flags.test.mjs`, `src/game/scenes/menu-daily-option.mjs`, `menu-daily-option.test.mjs` | Avoid `src/index.html`; use runtime meta flag. |
| 5 | `cs04-feature-flags-backend` | `api/LeaderboardFunction.cs`, `api/HealthFunction.cs`, daily leaderboard/health tests, `staticwebapp.config.json` | CS03-file risk; stop on conflicts. |
| 6 | `cs04-whaleshark` | `src/game/whaleshark.mjs`, `whaleshark.test.mjs`, `whaleshark-render-contract.test.mjs` | Escalate before editing `play.mjs`. |
| 7 | `cs04-engine-seed-tests-and-docs` | `src/engine/seed.test.mjs`, `src/engine/README.md` | Date-seed tests/docs only. |
| 8 | `cs04-v1-docs-and-validation` | `CHANGELOG.md`, `ARCHITECTURE.md`, active CS04 task/report sections | Orchestrator may retain; owns final docs. |
| (orchestrator-owned) | — | `harness.config.json`, `.harness-lock.json`, managed/composed files changed by `harness sync --mode=apply`, active CS file task population, scaffold invocations, three-state verify-deploy orchestration | Must perform task #1 first and commit it separately. Must coordinate any file-ownership conflicts before fan-out. |

Dispatch prompts must include no-commit preflight, explicit ownership, required reading, conventions, deliverables, self-checks, decision authority, learning-candidate reporting, and required report shape. Use full URLs for agent-harness references, e.g. <https://github.com/henrik-me/agent-harness/blob/main/OPERATIONS.md#sub-agent-dispatch>.

## User-approval gates

| Gate | When | Default | Action |
|---|---|---|---|
| G-bump | Before task #1 pin edit, if the user wants explicit say over the chosen harness ref | Autonomous if the chosen ref is the latest published release tag | User may approve a specific tag/SHA. If no explicit approval is requested by project policy, proceed with latest published tag; use `main` SHA fallback only when no newer release exists. |

## Exit criteria

1. Task #1 completed first: `harness.config.json:version` bumped from `v0.2.0`, `harness sync --mode=apply` succeeded, `.harness-lock.json` refreshed, and drift landed as a separate first commit.
2. Post-sync `node bin/harness.mjs lint --quiet`, `node --test src/**/*.test.mjs`, and `dotnet test api/` pass before fan-out.
3. All five modifiers exist, have focused tests, and apply as scene-init mutators.
4. Daily scene deterministically selects modifier/params from UTC date and allowed parameter sets.
5. Canvas HUD badge renders below wave counter, truncates modifier names, and introduces no DOM UI.
6. Whale shark spawns in normal/daily modes, respects render order, traverses top screen, and awards uniform `[50,100,200]`.
7. Frontend flag defaults off; `dailyChallenge=on` exposes menu option while off leaves normal play unchanged.
8. Backend daily partition routing uses `daily-YYYY-MM-DD`, keeps `all`, and tests disabled-flag behavior.
9. `/api/health` returns dailyChallenge flag state; `staticwebapp.config.json`/SWA settings support toggling without secrets.
10. `feature-flags` and `health-check` scaffold exercises are completed and findings recorded.
11. Three-state validation passes for off, on, and on-with-bumped-pin: `npm test`, `dotnet test`, and verify-deploy.
12. `ARCHITECTURE.md` documents v1 shipped, modifier pattern, UTC date seeds, whale shark, and daily partitions.
13. `CHANGELOG.md` includes SI-CS04 and declares **v1 shipped**.
14. SWA staging deploy plays normal and daily modes with flag on.
15. Plan-vs-implementation review records `GO`; close-out docs/restart-state and learnings/follow-up tasks are complete.
16. Close-out summary states: **Sub Invaders v1 shipped**.

## Risks + open questions

1. **R1 — Pin bump may surface harness friction.** Managed/composed drift, lock-file shape, or scaffold scripts may have changed since `v0.2.0`; isolate task #1, capture output, and file `harness-sync-apply-friction` if needed.
2. **R2 — Daily non-determinism breaks fairness.** Test same UTC date produces identical modifier/params; adjacent dates may differ.
3. **R3 — Whale-shark Z-order.** Render above formation but below player torpedoes; document/test the layer contract.
4. **R4 — `feature-flags` scaffold may assume build-time env injection.** Confirm the no-build `<meta name="flags">` pattern against scaffold README.
5. **R5 — Daily partition growth.** 365 partitions/year is fine for v1, but document retention and consider >30-day cleanup later.
6. **R6 — Cross-CS file ownership.** CS04 touches CS02/CS03-era files; orchestrator must reassign ownership before dispatch or require escalation.
7. **R7 — Frontend/backend flag divergence.** Three-state validation must probe UI flag parsing, `/api/health`, and daily leaderboard routing together.
8. **R8 — UTC boundary confusion.** Badge/docs must show UTC date; never use browser local date for seed/partition.
9. **R9 — Boss-rush score inflation.** Keep boss-rush scores daily-only via `daily-YYYY-MM-DD`.
10. **R10 — Sync invocation uncertainty.** Choose local package vs `npx github:<ref>` based on install model and record the command.

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| Task #1: pin bump + sync apply | planned | orchestrator | Must be completed and committed before all other work. |
| Populate CS04 sub-agent dispatch plan | planned | orchestrator | Confirm disjoint ownership after reading current SI repo files. |
| Implement daily modifiers | planned | sub-agents | Split across `cs04-modifiers-1` and `cs04-modifiers-2`. |
| Implement daily scene + HUD badge | planned | sub-agent | Prefer overlay file to avoid `hud.mjs` race. |
| Implement frontend/backend feature flags | planned | sub-agents | Validate flag state through `/api/health`. |
| Implement whale shark | planned | sub-agent | Escalate `play.mjs` integration ownership before writing. |
| Update seed docs/tests | planned | sub-agent | No engine API change expected. |
| Close-out docs + restart state | planned | orchestrator | Update WORKBOARD/CONTEXT/active CS notes and relevant docs before close-out. |
| Close-out learnings + follow-ups | planned | orchestrator | File harness-sync/scaffold/cross-repo learnings and planned follow-ups if needed. |

## Notes / Learnings

Filled during execution. At minimum, record the chosen harness pin, `sync --mode=apply` command and result, lint/test summaries, scaffold exercise outcomes, three-state validation results, and any harness friction or scaffold mismatch.

## Plan-vs-implementation review

> _(filled at close-out per the gate)_

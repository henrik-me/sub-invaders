# CS04 — Daily challenge + whale-shark + v1 polish

**Status:** active
**Owner:** yoga-si
**Branch:** cs04/content
**Started:** 2026-05-14
**Closed:** —
**Depends on:** CS01 (Repo hardening + first SWA staging deploy), CS02 (Engine + game skeleton + minimal playable game), CS03 (Backend Function project + persistent leaderboard)

## Goal

Ship the final Sub Invaders v1 feature set: deterministic daily challenge mode, whale-shark mystery enemy, feature-flagged daily leaderboard routing, and final docs/validation polish. At CS04 close, normal play remains stable, daily mode is reproducible for all players on the same UTC date, and staging demonstrates both all-time and daily leaderboard flows.

Daily challenge, whale-shark, and v1 polish are grouped here because SI-CS01 through SI-CS03 should already have proven repo standards, engine, playable game, and persistent leaderboard. When close-out lands, Sub Invaders v1 is shipped.

## Background

By CS04 claim, `henrik-me/sub-invaders` should already have protected `main`, CI, staging SWA deploys, a playable vanilla-JS canvas game, .NET 8 isolated Functions, Storage Tables persistence, replay protection, and a network leaderboard. Remaining v1 scope is daily challenge, whale shark, feature-flag routing, docs, and validation.

The CS16 active plan still labels the daily-challenge section as "SI-CS03 surface" because the feature was originally planned there. The 2026-05-11 scope refinement moved it to SI-CS04 so CS03 can focus on backend persistence. Treat CS16 `## Scope refinement (2026-05-11)` as authoritative over the older section title.

The originally-planned harness pin-bump task (CS04-1 / CS04-2 / deliverable 0) was retired at CS04 claim time per the 2026-05-14 scope refinement: the pin-bump exercise was already validated end-to-end by CS10 (v0.4.0), CS11 (v0.5.0), and PR #62 (v0.5.1). Repo is at `v0.5.1` at claim. CS04 now focuses on the daily-challenge + whale-shark + v1 polish scope only.

## Decisions (SI-CS04-specific)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| CS04-3 | Daily flag default | Off in production/staging until CS04 close-out validation turns it on | Keeps unfinished daily mode hidden. |
| CS04-4 | Date source | UTC only: `YYYY-MM-DD` for display/partitions, `YYYYMMDD` for RNG seed | Same challenge for all players. |
| CS04-5 | Modifier pool | Fixed five: fog-of-war, speed-run, one-shot, boss-rush, inverted-controls | Matches CS16 design. |
| CS04-6 | Daily RNG | `seed(parseInt(yyyyMmDdString))`; all daily draws use that Mulberry32 stream | Deterministic without engine API change. |
| CS04-7 | Daily params | Fire/speed multipliers from `{0.8,1.0,1.2,1.5}`; whale interval from `{10s,15s,20s,30s}` | Required CS16 surface. |
| CS04-8 | HUD badge | `DAILY · <YYYY-MM-DD> · <modifier-name>`; modifier segment ≤24 chars | Canvas-safe display. |
| CS04-9 | Daily partition | `daily-YYYY-MM-DD`; all-time remains `all` | Clear Storage Tables keying. |
| CS04-10 | Whale-shark spawn/score | Normal `random(15-30s)`; daily uses deterministic interval; score is uniform `[50,100,200]` | Sea-themed UFO equivalent. |
| CS04-11 | Feature flag source | Frontend default in `src/index.html` `<meta name="flags" content="dailyChallenge=off">`; backend uses `FEATURE_FLAGS_DAILY_CHALLENGE` SWA app setting; frontend overrides default by re-fetching `flags.dailyChallenge` from `GET /api/health` on boot | No build step; HTML default keeps offline/local dev predictable; `/api/health` provides authoritative live state without redeploying HTML. |
| CS04-12 | Scaffold exercises | `feature-flags` and `health-check` must be invoked and findings recorded | First real use of both scaffolds. |
| CS04-13 | Pin-bump retirement | Drop CS04-1 / CS04-2 / deliverable 0 / exit-criteria 1-2 / risk R1+R10. | Pin-bump exercise already validated by CS10 (v0.4.0), CS11 (v0.5.0), PR #62 (v0.5.1). Repo is at `v0.5.1` at CS04 claim — re-running the exercise adds zero signal. |
| CS04-14 | Daily score write path | All daily-mode score submissions carry an explicit `period: "daily", utcDate: "YYYY-MM-DD"` payload field; `ScoreFunction.cs` and `ILeaderboardRepository` route writes to `daily-YYYY-MM-DD` partition based on that field; `period` defaults to `"all"` for backward compat. | F-001 (Plan R2): without an explicit write-path contract the leaderboard writes still hit `all` even when the daily flag is on. |
| CS04-15 | Validation commands | Use existing `npm run test:unit`, `npm run test:e2e`, `dotnet test api/`, and `node scripts/verify-deploy.mjs` for the two-state validation; do not introduce a new `npm test` script. | F-004 (Plan R2): `package.json` has no `test` script; calling `npm test` would silently fail. |

## Deliverables

1. **Date-seeded RNG usage in engine** — `src/engine/seed.mjs` already exists from CS02 with the Mulberry32 surface. Extend tests and documentation for the date-seeded usage pattern: `seed(parseInt(yyyyMmDdString))`. Do not change the engine API unless an existing CS02 contract makes this impossible; if so, escalate.
2. **Five daily modifiers in `src/game/modifiers/`** — implement small mutator functions applied at scene init, with at least one test per modifier:
   - `src/game/modifiers/fog-of-war.mjs` — visibility is limited to a circular halo around the submarine; the rest of the canvas is darkened via an additional canvas pass with a circular punch-out at player position.
   - `src/game/modifiers/speed-run.mjs` — 2× player movement speed, 2× formation speed, and 2× fire rate.
   - `src/game/modifiers/one-shot.mjs` — single life only; starting `lives` is reset to 1.
   - `src/game/modifiers/boss-rush.mjs` — only the Squid row spawns (11 enemies), enemy fire density is higher, each clear respawns immediately, and scoring uses a ×2 multiplier.
   - `src/game/modifiers/inverted-controls.mjs` — `←` moves right and `→` moves left for the whole run.
3. **Daily-challenge scene** — add `src/game/scenes/daily.mjs` and register it with the engine scene stack. It reads today's UTC date, computes `seed = parseInt(YYYYMMDD)`, deterministically chooses one modifier from the five-modifier pool, draws `enemyFireMultiplier`, `formationSpeedMultiplier`, and `whaleSharkInterval` from the specified sets, and reuses the `play.mjs` core game with daily mutators applied.
4. **HUD daily-mode badge** — extend the HUD path to draw `DAILY · <YYYY-MM-DD> · <modifier-name>` below the wave counter when daily scene is active. Prefer `src/game/hud-daily.mjs` as an overlay if `hud.mjs` ownership is unclear; do not introduce DOM UI.
5. **Frontend feature flag** — implement `src/game/flags.mjs` from the CS02 stub. Export `fetchFlags()` which: parses the `<meta name="flags" content="dailyChallenge=off">` HTML default, then issues a single `GET /api/health` with a bounded timeout (e.g. `AbortController` with ~1500ms ceiling, or `Promise.race`) and overrides `dailyChallenge` from the `flags.dailyChallenge` field in the response. If the health fetch fails OR times out (offline / API down / slow), fall back to the HTML default — never throw and never block boot for more than the timeout ceiling. The boot wiring (`await fetchFlags()` before pushing the menu scene; pass resolved flags into menu/daily creation) is owned by integration row 10 in `src/game/main.mjs`. The main menu shows the daily-challenge option only when the resolved value is `on`.
6. **Backend feature flag + daily partitions + daily score write path** — add `FEATURE_FLAGS_DAILY_CHALLENGE` handling across **three** functions and the repository:
   - `LeaderboardFunction.cs`: reject (HTTP 403) `period=daily` reads when the flag is off; route `period=daily&date=YYYY-MM-DD` reads to the `daily-YYYY-MM-DD` partition when on; keep `period=all` (default) routing unchanged.
   - `ScoreFunction.cs`: accept an optional `period: "daily", utcDate: "YYYY-MM-DD"` field on the submit payload. When `period=daily` and the flag is on, write to the `daily-YYYY-MM-DD` partition; when `period=all` (or absent), keep current `LeaderboardEntity.PartitionAll` write path. Reject (HTTP 403) `period=daily` submits when the flag is off.
   - `ILeaderboardRepository` + `LeaderboardRepository` (paths `api/Storage/ILeaderboardRepository.cs` and `api/Storage/LeaderboardRepository.cs`): extend `GetTopAsync` and `AddAsync` to accept an explicit partition key (default `PartitionAll` for backward compat). Replace the hard-coded `PartitionAll` reads in `GetTopAsync`. Add xUnit tests for both daily and all-time partition routing on writes and reads.
   - `HealthFunction.cs`: include the resolved `dailyChallenge` flag state in the response body (e.g. `flags: { dailyChallenge: "on"|"off" }`) so the frontend (deliverable 5) and the `health-check` scaffold (deliverable 12) can both consume it.
7. **Whale-shark mystery enemy** — implement `src/game/whaleshark.mjs`. The whale shark traverses the top of the screen at constant speed, renders above the formation but below player torpedoes, spawns at `random(15-30s)` in normal mode or the deterministic daily interval in daily mode, and awards uniformly random `[50, 100, 200]` points on hit.
8. **Frontend API client extension** — extend `src/game/api.mjs` (and its `api.test.mjs`) to forward optional `period` / `utcDate` to `submitScore` and optional `period` / `date` to `getLeaderboard`. All-time defaults must remain unchanged so CS03 call sites keep working without edits. Daily-aware call sites are wired up by integration row 10 in `play.mjs` and `leaderboard.mjs`. Validates round-trip against the CS04-14 payload contract.
9. **`staticwebapp.config.json`** — add or update env/header/app-settings mapping needed for `FEATURE_FLAGS_DAILY_CHALLENGE` exposure to the Function host. Keep paths consumer-root-relative; do not use relative-up paths.
10. **`CHANGELOG.md` CS04 entry** — describe daily challenge, whale shark, and declare **v1 shipped**.
11. **Final `ARCHITECTURE.md` update** — declare v1 shipped, document the five-modifier extensibility pattern, document UTC date-seed reproducibility, and describe daily leaderboard partitioning.
12. **`feature-flags` scaffold exercise** — read the scaffold README/contract, apply its recommended policy to this no-build frontend, and record any mismatch between scaffold assumptions and static ES module usage.
13. **`health-check` scaffold exercise** — verify `GET /api/health` returns the current dailyChallenge flag state in every deployed validation state.
14. **Two-state validation** — run two independent validation waves against `dailyChallenge=off` and `dailyChallenge=on`. In both states, `npm run test:unit`, `npm run test:e2e`, `dotnet test api/`, and `node scripts/verify-deploy.mjs` (with the appropriate base URL) must pass.

## Sub-agent fan-out

Each row's owned files must remain disjoint; if an implementation needs a cross-row file, the orchestrator must either reassign ownership before dispatch or require the sub-agent to escalate rather than write.

| # | Sub-agent | Owned files | Notes / coordination |
|---|---|---|---|
| 1 | `cs04-modifiers-1` | `src/game/modifiers/fog-of-war.mjs`, `fog-of-war.test.mjs`, `speed-run.mjs`, `speed-run.test.mjs`, `one-shot.mjs`, `one-shot.test.mjs` | Three mutators/tests; no scene/HUD writes. |
| 2 | `cs04-modifiers-2` | `src/game/modifiers/boss-rush.mjs`, `boss-rush.test.mjs`, `inverted-controls.mjs`, `inverted-controls.test.mjs` | Read `invaders.mjs` only unless reassigned. |
| 3 | `cs04-daily-scene-and-hud` | `src/game/scenes/daily.mjs`, `daily.test.mjs`, `src/game/hud-daily.mjs`, `hud-daily.test.mjs` | Prefer overlay; escalate before editing `hud.mjs`. |
| 4 | `cs04-feature-flags-frontend` | `src/game/flags.mjs`, `flags.test.mjs`, `src/game/scenes/menu-daily-option.mjs`, `menu-daily-option.test.mjs`, **`src/index.html`** (meta-tag default only) | Owns the meta-default edit. Coordinates with row 5 (backend) on the `/api/health` flag field shape. |
| 5 | `cs04-feature-flags-backend` | `api/LeaderboardFunction.cs`, `api/ScoreFunction.cs`, `api/HealthFunction.cs`, `api/Storage/ILeaderboardRepository.cs`, `api/Storage/LeaderboardRepository.cs`, daily/leaderboard/health/score xUnit tests, `staticwebapp.config.json` | CS03-file risk; stop on conflicts. Owns the `period`/`utcDate` payload contract (CS04-14). |
| 6 | `cs04-whaleshark` | `src/game/whaleshark.mjs`, `whaleshark.test.mjs`, `whaleshark-render-contract.test.mjs` | Implementation only. Render-order integration is in row 10 (integration). |
| 7 | `cs04-engine-seed-tests-and-docs` | `src/engine/seed.test.mjs`, `src/engine/README.md` | Date-seed tests/docs only. |
| 8 | `cs04-v1-docs-and-validation` | `CHANGELOG.md`, `ARCHITECTURE.md`, active CS04 task/report sections | Orchestrator may retain; owns final docs. |
| 9 | `cs04-frontend-api-client` | `src/game/api.mjs`, `src/game/api.test.mjs` | Extend `submitScore({ sessionId, score, finishedAt, period?, utcDate? })` to forward optional `period`/`utcDate` and `getLeaderboard({ period, date? })` to forward optional UTC `date` for daily reads (CS04-14). All-time call sites unchanged. |
| 10 | `cs04-integration` (orchestrator-owned) | `src/game/main.mjs` (await `fetchFlags()` from `flags.mjs` BEFORE pushing the menu scene; pass resolved flags into menu/daily creation; non-blocking fallback to HTML defaults on fetch failure or timeout; register daily scene), `src/game/main.test.mjs` (boot-flag-fetch tests), `src/game/scenes/menu.mjs` (expose daily option when `flags.dailyChallenge==='on'`), `src/game/scenes/play.mjs` (whale-shark spawn + render-order integration; in daily mode, pass `period:"daily", utcDate` to `apiClient.submitScore`), `src/game/scenes/play.test.mjs` (daily-mode integration tests), `src/game/scenes/leaderboard.mjs` (in daily mode, pass `period:"daily", date:utcDate` to `apiClient.getLeaderboard`), `src/game/scenes/leaderboard.test.mjs` (daily read tests) | Sequential AFTER rows 1-7 and row 9 (api client) land owned files. Wires up daily.mjs, hud-daily.mjs overlay, whaleshark.mjs, the menu daily option, the boot-time flag fetch, and the daily-aware API call sites without sub-agent collisions. Owns the integration tests for the wired files. |
| (orchestrator-owned) | — | active CS file task population, scaffold invocations, two-state verify-deploy orchestration | Coordinates ownership conflicts before fan-out; runs row 10 integration after parallel rows complete. |

Dispatch prompts must include no-commit preflight, explicit ownership, required reading, conventions, deliverables, self-checks, decision authority, learning-candidate reporting, and required report shape. Use full URLs for agent-harness references, e.g. <https://github.com/henrik-me/agent-harness/blob/main/OPERATIONS.md#sub-agent-dispatch>.

## User-approval gates

_(none — pin-bump gate G-bump retired with CS04-13)_

## Exit criteria

1. All five modifiers exist, have focused tests, and apply as scene-init mutators.
2. Daily scene deterministically selects modifier/params from UTC date and allowed parameter sets.
3. Canvas HUD badge renders below wave counter, truncates modifier names, and introduces no DOM UI.
4. Whale shark spawns in normal/daily modes, respects render order, traverses top screen, and awards uniform `[50,100,200]`.
5. Frontend flag defaults off; `dailyChallenge=on` exposes menu option while off leaves normal play unchanged.
6. Backend daily partition routing uses `daily-YYYY-MM-DD`, keeps `all`, and tests disabled-flag behavior.
7. `/api/health` returns dailyChallenge flag state; `staticwebapp.config.json`/SWA settings support toggling without secrets.
8. `feature-flags` and `health-check` scaffold exercises are completed and findings recorded.
9. Two-state validation passes for off and on: `npm run test:unit`, `npm run test:e2e`, `dotnet test api/`, and `node scripts/verify-deploy.mjs`.
10. `ARCHITECTURE.md` documents v1 shipped, modifier pattern, UTC date seeds, whale shark, and daily partitions.
11. `CHANGELOG.md` includes SI-CS04 and declares **v1 shipped**.
12. SWA staging deploy plays normal and daily modes with flag on.
13. Plan-vs-implementation review records `GO`; close-out docs/restart-state and learnings/follow-up tasks are complete.
14. Close-out summary states: **Sub Invaders v1 shipped**.

## Risks + open questions

1. **R2 — Daily non-determinism breaks fairness.** Test same UTC date produces identical modifier/params; adjacent dates may differ.
2. **R3 — Whale-shark Z-order.** Render above formation but below player torpedoes; document/test the layer contract.
3. **R4 — `feature-flags` scaffold may assume build-time env injection.** Confirm the no-build `<meta name="flags">` pattern against scaffold README.
4. **R5 — Daily partition growth.** 365 partitions/year is fine for v1, but document retention and consider >30-day cleanup later.
5. **R6 — Cross-CS file ownership.** CS04 touches CS02/CS03-era files; orchestrator must reassign ownership before dispatch or require escalation.
6. **R7 — Frontend/backend flag divergence.** Two-state validation must probe UI flag parsing, `/api/health`, and daily leaderboard routing together.
7. **R8 — UTC boundary confusion.** Badge/docs must show UTC date; never use browser local date for seed/partition.
8. **R9 — Boss-rush score inflation.** Keep boss-rush scores daily-only via `daily-YYYY-MM-DD`.

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| Populate CS04 sub-agent dispatch plan | planned | orchestrator | Confirm disjoint ownership after reading current SI repo files. |
| Implement daily modifiers | planned | sub-agents | Split across `cs04-modifiers-1` and `cs04-modifiers-2`. |
| Implement daily scene + HUD badge | planned | sub-agent | Prefer overlay file to avoid `hud.mjs` race. |
| Implement frontend/backend feature flags | planned | sub-agents | Validate flag state through `/api/health`. |
| Implement whale shark | planned | sub-agent | Escalate `play.mjs` integration ownership before writing. |
| Update seed docs/tests | planned | sub-agent | No engine API change expected. |
| Close-out docs + restart state | planned | orchestrator | Update WORKBOARD/CONTEXT/active CS notes and relevant docs before close-out. |
| Close-out learnings + follow-ups | planned | orchestrator | File scaffold/cross-repo learnings and planned follow-ups if needed. |

## Notes / Learnings

Filled during execution. At minimum, record scaffold exercise outcomes, two-state validation results, and any scaffold mismatch.

## Plan review

| Round | Reviewer model | Plan author model(s) | Reviewer agent | Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200 chars) |
|---|---|---|---|---|---|---|---|
| R1 | gpt-5.5 | claude-sonnet-4.6 | rubber-duck dispatched (orchestrator: yoga-si) | cfa059fd4241 | 2026-05-14T07:55:00Z | Go-with-amendments | Grandfathered at v0.5.0 pin-bump per harness CS42-7. Plan content unchanged at backfill; SI orchestrator may add R2 when CS is claimed. |
| R2 | gpt-5.5 | claude-sonnet-4.6, claude-opus-4.7 | rubber-duck dispatched (orchestrator: yoga-si) | 8c1a7078b29b | 2026-05-14T16:48:00Z | Needs-Fix | F-001 (daily score write path under-scoped), F-002 (frontend flag delivery contradictory), F-003 (runtime integration files unowned), F-004 (`npm test` not a script). All BLOCKING. |
| R3 | gpt-5.5 | claude-sonnet-4.6, claude-opus-4.7 | rubber-duck dispatched (orchestrator: yoga-si) | ae8962c07aa0 | 2026-05-14T17:35:00Z | Needs-Fix | R3-F-001 (frontend api.mjs unowned), R3-F-002 (repository paths missing api/Storage/), R3-F-003 (boot fetchFlags wiring implicit). All BLOCKING; R2 fixes accepted otherwise. |
| R4 | gpt-5.5 | claude-sonnet-4.6, claude-opus-4.7 | rubber-duck dispatched (orchestrator: yoga-si) | eb9b647f8ece | 2026-05-14T18:05:57Z | Go | All R3 BLOCKING resolved (api row 9 + Storage paths + row-10 await). 3 NON-BLOCKING amendments (fetch timeout, row-10 test ownership, row-9→row-10 ref) adopted inline. |
## Plan-vs-implementation review

> _(filled at close-out per the gate)_

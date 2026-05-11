# CS02 — Engine + game skeleton + minimal playable Sub Invaders

**Status:** planned
**Owner:** —
**Branch:** —
**Started:** —
**Closed:** —
**Depends on:** CS01 (Repo hardening + first SWA staging deploy)

## Goal

Ship the first real playable Sub Invaders build to the Static Web Apps staging environment that CS01 created. CS02 turns the empty folder skeleton and stub deploy from CS01 into a browser-playable, sea-themed Space Invaders loop built with vanilla ES2022 modules, HTML5 Canvas, and zero browser runtime dependencies.

The in-scope game slice is deliberately classic and small: a submarine player, a 5×11 formation of jellyfish / anglerfish / giant squid, a single player torpedo on screen, enemy fire from column-front enemies, AABB collision, lives, score, wave progression, game over, restart, and a local-only high score stored as `localStorage.subInvadersHighScore`. This demonstrates that SWA serves the static frontend, that the game loop works in a real browser, and that the harness can coordinate an eight-way implementation fan-out with disjoint file ownership.

CS02 does **not** add the backend leaderboard. The local high-score path is the visible persistence for this clickstop; `../../../src/game/api.mjs` remains an empty stub so CS03 can own `POST /api/session`, `POST /api/score`, and `GET /api/leaderboard` without file races. Whale-shark mystery enemy, curated sound design, daily challenge, and mobile touch beyond basic horizontal drag are also deferred to CS04.

## Background

By the time the Sub Invaders agent claims CS02, CS01 has already hardened the repository, populated governance docs, made `../../../ARCHITECTURE.md` authoritative, wired green CI, provisioned Azure resources, configured SWA deployment, and deployed a stub `../../../src/index.html` plus `/api/health` to staging. CS02 should assume those foundations exist and should focus on replacing the static stub with the actual game.

CS16's authoritative design lives in the agent-harness CS16 plan at https://github.com/henrik-me/agent-harness/blob/main/project/clickstops/active/active_cs16_bootstrap-sub-invaders/active_cs16_bootstrap-sub-invaders.md. The binding parts for CS02 are the Sub Invaders v1 game-design subset and decisions C16-10 / C16-11: vanilla JavaScript + Canvas, direct ES modules, no bundler or transpiler, and a custom in-tree `../../../src/engine/` with a strict one-way dependency boundary.

The planned-file execution shape is as important as the game. CS02 exists to validate that a new harness-governed consumer repo can fan out implementation to many sub-agents safely. Every sub-agent below owns a disjoint file set; the orchestrator must paste the canonical briefing preamble from https://github.com/henrik-me/agent-harness/blob/main/OPERATIONS.md#sub-agent-dispatch into every dispatch.

## Decisions (SI-CS02-specific)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| CS02-1 | Frontend stack | Carry forward C16-10: vanilla JavaScript ES2022, Canvas 2D, browser-native ES modules, no bundler, no transpiler, no TypeScript, zero browser runtime dependencies. | Keeps v1 inspectable and aligns with the user's “Keep it simple” direction. |
| CS02-2 | Engine boundary | Carry forward C16-11: all reusable primitives live in `../../../src/engine/`; engine modules MUST NOT import from outside `../../../src/engine/`. | Preserves future extraction to `henrik-me/canvas-game-engine`. |
| CS02-3 | Logical canvas | Use an 800×600 logical canvas with a DPR-aware backing store in `../../../src/engine/renderer.mjs`. | Classic SI proportions fit the design, tests can reason in fixed logical pixels, and high-DPI devices render crisply. |
| CS02-4 | Palette | Sea-themed dark blue to teal vertical gradient: `#061525` top, `#0b4f63` middle, `#12a7a0` accents; submarine yellow `#ffd84d`; enemy family colours purple / orange / cyan. | Matches CS16's underwater theme without external background assets. |
| CS02-5 | Sprite asset format | Hand-authored `../../../public/sprites.png`, original CC0, ≤16 KB, with `../../../public/sprites.licence` provenance text. | Avoids asset-pipeline scope while giving the game an identifiable look. |
| CS02-6 | Simulation timing | Fixed 60 Hz logic (`dt = 1 / 60`) with variable-rate `requestAnimationFrame` render and an accumulator clamp for tab-resume spikes. | Deterministic enough for tests and classic arcade movement while staying smooth under vsync. |
| CS02-7 | Input mapping | Keyboard movement: `ArrowLeft` / `ArrowRight` and `A` / `D`; fire: `Space`, `W`, or `ArrowUp`; touch: horizontal drag delta only. | Mirrors the CS16 game-design spec and defers mobile polish to CS04. |
| CS02-8 | Local persistence | `../../../src/game/score.mjs` is the only persistence module and stores an integer high score at `localStorage.subInvadersHighScore`. | Demonstrates static frontend persistence without overlapping CS03 backend ownership. |
| CS02-9 | Backend surface | `../../../src/game/api.mjs` exports an intentionally empty surface or no-op placeholders only. | Prevents CS02 from pre-designing CS03's session / leaderboard API. |
| CS02-10 | Deferred v1 polish | Whale shark, daily challenge, curated SFX assets, and mobile touch polish are explicitly out of CS02 and assigned to CS04. | Keeps CS02 focused on the minimal playable loop and the eight-way fan-out validation. |

## Deliverables

1. **Engine modules under `../../../src/engine/`** implementing the reusable canvas-game core, with no imports from outside `../../../src/engine/`:
   - `../../../src/engine/loop.mjs` — fixed-timestep update plus variable-rate render on `requestAnimationFrame`, with pause / resume hooks and accumulator clamp.
   - `../../../src/engine/entity.mjs` — base `Entity` class with position, velocity, dimensions, AABB, alive flag, and update / render defaults.
   - `../../../src/engine/collision.mjs` — AABB overlap and group-vs-group query returning colliding pairs without mutating inputs.
   - `../../../src/engine/input.mjs` — keyboard down / pressed / released state plus touch horizontal-drag delta and per-frame reset API.
   - `../../../src/engine/renderer.mjs` — Canvas 2D wrapper for DPR setup, clear, drawSprite, drawText, fill / stroke rect, and logical-pixel transforms.
   - `../../../src/engine/sprite.mjs` — sprite-sheet loader, frame descriptors, frame animation clock, and testable frame-index selection without requiring image decoding in Node.
   - `../../../src/engine/audio.mjs` — `<audio>` element pool for future SFX hooks; no Web Audio API and no required SFX assets in CS02.
   - `../../../src/engine/scene.mjs` — scene stack with push / pop / replace / current / update / render and input forwarding; menu, play, and game-over scenes register from game code.
   - `../../../src/engine/seed.mjs` — Mulberry32 seedable RNG with `seed(uint32)`, `next()`, and `range(min, max)`; introduced now so CS04 daily challenge has a stable engine surface.
   - `../../../src/engine/README.md` — API surface, extraction contract, future repo target placeholder `henrik-me/canvas-game-engine`, and a worked example showing the one-way dependency rule: engine modules may import only engine peers; game modules may import engine modules.
   - `../../../src/engine/*.test.mjs` — at least one `node:test` test per engine module; more tests are encouraged where edge cases are discovered.

2. **Game modules under `../../../src/game/`** implementing the Sub Invaders-specific rules:
   - `../../../src/game/player.mjs` — submarine entity, horizontal movement, screen bounds, respawn / 1.5 s invulnerability blink, lives, torpedo entity, and the single-shot rule.
   - `../../../src/game/invaders.mjs` — 5×11 formation: top row Giant Squid, middle two rows Anglerfish, bottom two rows Jellyfish; lock-step horizontal movement; descend / reverse at walls; alive-count speed scaling; column-front enemy fire selection.
   - `../../../src/game/hud.mjs` — Canvas HUD for `SCORE`, `HIGH`, `LIVES`, and `WAVE`, including simple life icons.
   - `../../../src/game/scenes/menu.mjs` — title, controls, high-score display, and start prompt.
   - `../../../src/game/scenes/play.mjs` — game-state owner for entities, collisions, scoring, lives, wave progression, and game-over transition.
   - `../../../src/game/scenes/gameover.mjs` — final score, high score, restart prompt, and return-to-menu flow.
   - `../../../src/game/constants.mjs` — canvas dimensions, player speed, enemy points, formation dimensions, fire-rate caps, wave bonus, spawn-depth formula, and CS16 formulas.
   - `../../../src/game/*.test.mjs` and scene-adjacent tests — at least one `node:test` test for every authored game module where Node can exercise pure logic; DOM / Canvas seams should be injected so tests stay browser-free.
   - **Deferred to CS04:** `../../../src/game/whaleshark.mjs`, `../../../src/game/scenes/daily.mjs`, and `../../../src/game/flags.mjs`. Stubs with explanatory comments are acceptable only if they are needed to satisfy imports; do not implement whale-shark, daily challenge, or feature flags in CS02.

3. **Bootstrap glue:**
   - Replace the CS01 stub with `../../../src/index.html` containing the canvas, accessible fallback text, and `<script type="module" src="./game/main.mjs"></script>`.
   - Add `../../../src/game/main.mjs` as the browser entrypoint that creates the canvas renderer, input, scene stack, menu / play / game-over scenes, loads `../../../public/sprites.png`, and starts the engine loop.
   - Add `../../../src/game/api.mjs` as a minimal empty stub (`export {}` or no-op placeholders only) so CS03 can own backend integration.

4. **Hand-authored sprite sheet:**
   - Create `../../../public/sprites.png`, original CC0 pixel art, ≤16 KB. It must include at minimum frames for submarine, torpedo, jellyfish, anglerfish, squid, enemy shot variants, and life icon.
   - Create `../../../public/sprites.licence` with plain-text provenance: original work, CC0 dedication, authoring method, date, and no copied third-party assets.

5. **Local-only high score:**
   - Create `../../../src/game/score.mjs` that reads and writes `localStorage.subInvadersHighScore`, treats malformed / missing values as 0, stores integers only, and never throws when `localStorage` is unavailable in a test environment.
   - HUD and menu display `HIGH`; game-over updates high score when the run exceeds the stored value.

6. **Game-over flow:**
   - Game over triggers when lives reach 0 OR when the enemy formation reaches the player's Y-row.
   - Game-over scene shows final score and high score, offers restart, and returns cleanly to menu / new play scene without stale entities or stuck input state.

7. **Wave progression:**
   - Clearing all 55 enemies awards `100 * wave_number`, increments wave, respawns the full formation one row deeper, caps the spawn-depth increase at +120 px from the first-wave spawn line, accelerates enemy fire by 100 ms per wave down to the 200 ms clamp, and increases descent step size by +1 px per wave capped at +5 px.
   - Endless play; no win state.

8. **CHANGELOG update:**
   - Add a SI-CS02 entry to `../../../CHANGELOG.md` summarizing the playable game, engine skeleton, local high score, and staging deploy. The orchestrator owns this edit after sub-agent fan-out completes to avoid file races.

9. **Verify-deploy probe:**
   - After the CS02 PR merges, run the `verify-deploy` scaffold's smoke probe against the SWA staging URL. It must return HTTP 200 and serve the game page, not the old stub. If CS01's smoke probe only checks `/api/health`, extend the probe in this CS to also check the frontend root path.

## Sub-agent fan-out

The orchestrator must dispatch at least eight sub-agents in parallel where possible. Every prompt must paste the canonical CRITICAL PREFLIGHT / file-ownership / self-check preamble from https://github.com/henrik-me/agent-harness/blob/main/OPERATIONS.md#mandatory-briefing-preamble and then add the task-specific scope below. File ownership is disjoint; curiosity reads are allowed, writes are not.

| # | Sub-agent | Owned files |
|---|---|---|
| 1 | `cs02-engine-loop-and-entity` | `../../../src/engine/loop.mjs`, `../../../src/engine/entity.mjs`, `../../../src/engine/loop.test.mjs`, `../../../src/engine/entity.test.mjs` |
| 2 | `cs02-engine-collision-and-input` | `../../../src/engine/collision.mjs`, `../../../src/engine/input.mjs`, `../../../src/engine/collision.test.mjs`, `../../../src/engine/input.test.mjs` |
| 3 | `cs02-engine-render-sprite-audio` | `../../../src/engine/renderer.mjs`, `../../../src/engine/sprite.mjs`, `../../../src/engine/audio.mjs`, `../../../src/engine/renderer.test.mjs`, `../../../src/engine/sprite.test.mjs`, `../../../src/engine/audio.test.mjs` |
| 4 | `cs02-engine-scene-seed-readme` | `../../../src/engine/scene.mjs`, `../../../src/engine/seed.mjs`, `../../../src/engine/scene.test.mjs`, `../../../src/engine/seed.test.mjs`, `../../../src/engine/README.md` |
| 5 | `cs02-game-player-and-invaders` | `../../../src/game/player.mjs`, `../../../src/game/invaders.mjs`, `../../../src/game/player.test.mjs`, `../../../src/game/invaders.test.mjs` |
| 6 | `cs02-game-hud-scenes-constants` | `../../../src/game/hud.mjs`, `../../../src/game/scenes/menu.mjs`, `../../../src/game/scenes/play.mjs`, `../../../src/game/scenes/gameover.mjs`, `../../../src/game/constants.mjs`, `../../../src/game/hud.test.mjs`, `../../../src/game/scenes.test.mjs`, optional explanatory stubs `../../../src/game/whaleshark.mjs`, `../../../src/game/scenes/daily.mjs`, `../../../src/game/flags.mjs` |
| 7 | `cs02-bootstrap-glue-and-score` | `../../../src/index.html`, `../../../src/game/main.mjs`, `../../../src/game/score.mjs`, `../../../src/game/api.mjs`, `../../../src/game/score.test.mjs`, `../../../src/game/main.test.mjs` |
| 8 | `cs02-sprite-asset-author` | `../../../public/sprites.png`, `../../../public/sprites.licence` |
| 9 | `cs02-engine-isolation-linter` | `../../../scripts/check-engine-isolation.mjs`, `../../../scripts/check-engine-isolation.test.mjs` |
| (orchestrator-owned) | — | `../../../CHANGELOG.md`, active CS Tasks population, post-wave disk verification, local review record, PR body, post-merge verify-deploy invocation |

If the orchestrator chooses exactly eight sub-agents, merge row 9 into row 4 or keep the linter orchestrator-owned. Do not reduce below eight implementation/reporting lanes.

## User-approval gates

None expected. CS01 already cleared infrastructure and deployment gates: Azure resources exist, the SWA token is configured, security / ruleset setup is complete, and staging deploy is proven with a stub. If a missing secret or Azure permission blocks CS02 deployment, treat it as a CS01 regression and escalate rather than adding a new approval gate here.

## Exit criteria

1. `node --test ../../../src/**/*.test.mjs` exits 0 in the sub-invaders repo; the PR reports the test count before and after CS02.
2. `harness lint --quiet` exits 0 in the sub-invaders repo.
3. `harness sync --mode=check` exits 0 in the sub-invaders repo; CS02 must not leave managed / composed files dirty.
4. `node ../../../scripts/check-engine-isolation.mjs --dir ../../../src/engine --quiet` exits 0.
5. Every authored `.mjs` file passes `node -c <file>` or is covered by a command that syntax-checks the full set.
6. The browser entry at `../../../src/index.html` loads `../../../src/game/main.mjs` via `<script type="module">` and starts at the menu scene without a bundler.
7. Manual play-through confirms start, movement, single torpedo, kills, one wave clear, wave 2 spawn, game over, restart, and new run.
8. `localStorage.subInvadersHighScore` updates after a new high score; malformed stored values are handled as 0; HUD shows `SCORE`, `HIGH`, `LIVES`, and `WAVE`.
9. Sprite sheet `../../../public/sprites.png` is ≤16 KB and `../../../public/sprites.licence` records original CC0 provenance.
10. SWA staging deploy succeeds after merge; the deployed root path returns HTTP 200 and serves the game, not the CS01 stub.
11. The `verify-deploy` smoke probe runs against the deployed staging URL after merge and passes for the frontend root path; keep `/api/health` green if CS01 added it.
12. `../../../CHANGELOG.md` contains a SI-CS02 entry.
13. `../../../ARCHITECTURE.md` is reviewed against the final engine API. Update it only if CS02 changed the documented API.
14. No backend leaderboard endpoints are implemented; `../../../src/game/api.mjs` remains a CS03 stub.
15. Whale-shark, daily challenge, curated SFX, and mobile touch polish remain deferred to CS04.
16. The active CS file's Tasks table records every dispatched sub-agent with report status and learning-candidate count.
17. Local review and plan-vs-implementation review are recorded; NEEDS-FIX blocks close-out.

## Risks + open questions

1. **R1 — Fixed timestep plus browser tab throttling.** Browser resume can produce large deltas; mitigate with accumulator clamp, pause / resume, and large-delta tests.
2. **R2 — Canvas DPR scaling on high-DPI displays.** Mitigate blur / coordinate drift with 800×600 logical pixels, centralized renderer scaling, and logical input coordinates.
3. **R3 — Sprite-sheet tooling.** A one-off pixel-art tool is acceptable only if no runtime dependency lands and provenance remains original CC0.
4. **R4 — Engine isolation linter strategy.** Add a tiny fail-closed ESM linter at `../../../scripts/check-engine-isolation.mjs` that resolves static imports in engine files and errors if any leave `../../../src/engine/`.
5. **R5 — Parallel fan-out integration seams.** Require engine sub-agents to report exports; orchestrator performs post-wave integration before final game wiring.
6. **R6 — Node tests for browser-facing modules.** Inject test doubles and keep pure logic separate; do not add jsdom or other npm dependencies.
7. **R7 — CS01 architecture drift.** Compare final exports against `../../../ARCHITECTURE.md` before PR open and update only if needed.
8. **OQ1 — Exact staging URL command.** If CS01 did not document it, derive it from the scaffold / workflow output and record the command in close-out notes.

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| (populated at claim time) | planned | — | — |

## Notes / Learnings

(filled during execution)

## Plan-vs-implementation review

> _(filled at close-out per the gate)_
# CS08 — Offline play + ranked vs practice modes

**Status:** active
**Owner:** yoga-si
**Branch:** cs08/content
**Started:** 2026-06-30
**Closed:** —
**Depends on:** CS03 (Backend Function project + persistent leaderboard), CS04 (Daily challenge + v1 ship)

## Goal

Make Sub Invaders playable when the network is gone, and split the gameplay into two clearly labelled modes: **ranked** (default — score is submitted to the persistent backend leaderboard) and **practice** (score is kept locally only, never submitted). After CS08 closes:

- A user can open the game on a previously-loaded device with no network and play normally.
- A practice session never touches `/api/session` or `/api/score`, never appears on the global leaderboard, but its top score persists locally in a separate localStorage key.
- A ranked session that completes while offline is queued and submitted on the next successful network round-trip — but only when the server-side replay window (C16-12: `finishedAt - startedAt ∈ [10s, 600s]`) can still be satisfied; otherwise it is dropped with a clear, non-cryptic user message.
- The HUD always shows `RANKED` or `PRACTICE` so the player can never confuse which mode they are in.
- Service-worker caching is conservative and easy to invalidate so a stale offline asset never silently survives a deploy.

## Background

By CS08 claim, CS03 has shipped the persistent leaderboard with C16-12 replay protection (server-issued session token, plausibility window, per-IP rate limit), and CS04 has closed v1. CS02 already ships a localStorage-only high score (`subInvadersHighScore`); CS03 wires `src/game/api.mjs` to the backend. CS08 builds on top.

CS08 is the first clickstop that introduces a Service Worker. The runtime so far is a single static HTML + ES modules + a sprite atlas, which is the easiest possible target for SW caching: a small explicit allowlist with hashed query-string busting on deploy is sufficient. No bundler is introduced. The frontend stays zero-runtime-dep.

The "ranked vs practice" split is a UX requirement, not a backend contract change. Practice scores never reach the backend. The C16-12 contract is unchanged. Daily challenge from CS04 is implicitly ranked-only; CS08 does not add a daily-practice variant.

## Decisions (SI-CS08-specific)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| CS08-1 | Default mode | `ranked` on every fresh game start unless URL/menu toggle says otherwise | Keeps the canonical leaderboard the centerpiece. |
| CS08-2 | Mode toggle | Menu option (canvas-rendered) plus URL query `?mode=practice` for deep-linking | Canvas-only UX matches the rest of the game; query param is testable. |
| CS08-3 | HUD badge | Top-left HUD shows `RANKED` (yellow) or `PRACTICE` (cyan); always visible | Player must never wonder which mode they are in. |
| CS08-4 | Practice persistence | New localStorage key `subInvadersPracticeHighScore` (integer) — completely separate from `subInvadersHighScore` (ranked) | No cross-pollination. Practice cannot promote into ranked. |
| CS08-5 | Practice network behavior | Practice mode never calls `startSession()` or `submitScore()`; `getLeaderboard()` is allowed (read-only) | Practice plays "against" the leaderboard but never writes to it. |
| CS08-6 | Offline-ranked queue | If `submitScore()` fails with a network error in ranked mode, push `{sessionId, score, finishedAt}` onto `localStorage.subInvadersPendingScores[]` (max 20 entries, FIFO eviction) | Bounded queue; do not unbounded-grow localStorage. |
| CS08-7 | Pending-score retry | On next successful `startSession()` (or page load with network), drain the queue. For each entry, attempt `submitScore()`. If the server rejects with `409 session-consumed` or `400 expired`, drop the entry and surface a one-line user-visible note. | Honest failure mode rather than silent loss. |
| CS08-8 | Ranked offline UX | If `startSession()` fails at game start in ranked mode, show a one-time non-blocking banner: "Offline — playing ranked, will try to submit when back online" and proceed with a client-generated placeholder `sessionId`; submission honesty depends on CS08-7 retry semantics | Player keeps playing; system is honest about what may not land. |
| CS08-9 | Service Worker scope | Cache only the explicit static asset allowlist: `index.html`, `main.mjs` and its statically-imported tree, `sprites.png`, `sprites.licence`, fonts if any. Network-only for `/api/*`. | Predictable; no surprise cache hits on dynamic data. |
| CS08-10 | SW versioning | Cache name embeds `BUILD_SHA` (injected at deploy via `<meta name="build-sha">`); old caches deleted on `activate` | Single, atomic deploy invalidation. No stale asset can survive a release. |
| CS08-11 | SW update strategy | `self.skipWaiting()` + `clients.claim()` on activate; show a one-time banner on reload "updated to <short-sha>" | Updates take effect on next reload without manual nudge. |
| CS08-12 | First-load behavior | SW registers on `load`, never on the critical path; first-ever visit must work without SW | SW is a progressive enhancement; never a load blocker. |
| CS08-13 | Asset freshness in dev | `?nosw=1` query param skips SW registration entirely; localhost detection also skips | Dev-time stale-cache pain avoided. |
| CS08-14 | Practice + daily challenge | Practice mode disables daily challenge selection (or vice versa: daily implies ranked) — they are mutually exclusive | Daily fairness depends on a single official run per day. |
| CS08-15 | Telemetry | None added in CS08 | Out of scope; if needed, file a separate CS. |

## Deliverables

1. **`src/game/mode.mjs`** — new module exporting `getMode()`, `setMode(mode)`, `isRanked()`, `isPractice()`. Reads URL query `?mode=` first, then any in-session override. Persists last-chosen mode to `localStorage.subInvadersLastMode` so a returning player does not have to re-pick. Pure module, no DOM.
2. **`src/game/mode.test.mjs`** — unit tests for `mode.mjs`: defaults to `ranked` when nothing set, parses `?mode=practice`, rejects unknown modes, round-trips through localStorage.
3. **`src/game/score.mjs`** — extend so the high-score read/write path is keyed by mode: ranked → existing `subInvadersHighScore`, practice → new `subInvadersPracticeHighScore`. Add `getHighScoreFor(mode)` and `setHighScoreFor(mode, score)`. Keep the existing functions backward-compatible and have them default to ranked.
4. **`src/game/score.test.mjs`** — extend tests for the new mode-keyed functions; assert no cross-pollination.
5. **`src/game/api.mjs`** — make `startSession()` and `submitScore()` no-ops that resolve immediately (with a `{ skipped: true, reason: 'practice' }` sentinel) when `isPractice()` is true. `getLeaderboard()` remains callable in both modes (read-only).
6. **`src/game/scenes/menu.mjs`** — add a canvas-rendered toggle "MODE: RANKED / PRACTICE" with arrow-key cycle. When daily challenge is enabled (CS04), selecting practice disables daily and vice versa (CS08-14).
7. **`src/game/hud.mjs`** — add the persistent top-left mode badge (CS08-3). Cyan for practice, yellow for ranked. Use existing palette tokens; do not introduce DOM UI.
8. **`src/game/scenes/play.mjs`** — render the HUD badge each frame; surface the offline banner from CS08-8 when ranked mode failed `startSession()` and never disable gameplay because of network state.
9. **`src/game/pending-scores.mjs`** — new module managing `localStorage.subInvadersPendingScores[]` with `enqueue(entry)`, `peek()`, `drain(submitFn)`, `cap(20)`. Each entry shape `{ sessionId, score, finishedAt, queuedAt }`. FIFO eviction at cap.
10. **`src/game/pending-scores.test.mjs`** — full unit coverage including cap eviction, drain success, drain partial-failure (server rejects one mid-drain), corrupt JSON resilience.
11. **`src/main.mjs`** — wire mode detection at boot, register SW (with `?nosw=1` and localhost guards), drain `pending-scores` on load when online.
12. **`src/sw.mjs`** — Service Worker. Pre-cache the explicit allowlist on `install`; `activate` deletes caches whose name does not match the current `BUILD_SHA`; `fetch` handler is **cache-first** for allowlisted same-origin static assets and **network-only** for `/api/*` and any cross-origin request. No fancy "stale-while-revalidate" in v1.
13. **`src/sw.test.mjs`** — Node-side tests that exercise the SW logic via a mocked `caches` and `fetch` (the SW module exports its handlers as plain functions for testability).
14. **`src/index.html`** — add `<meta name="build-sha" content="__BUILD_SHA__">` placeholder. The SWA build step (or a tiny inline replace in the deploy workflow) substitutes the real short SHA at deploy time. For local dev the placeholder stays as-is and SW registration is skipped (CS08-13).
15. **`.github/workflows/swa-deploy.yml`** — add a build-time step that replaces `__BUILD_SHA__` in `src/index.html` with the deploy commit SHA before the SWA upload. Idempotent and safe for re-runs.
16. **`README.md`** — new "Offline play and modes" section: explains `?mode=practice`, the menu toggle, the persistence split, what happens to a ranked score when offline, and how to force a fresh fetch (`?nosw=1` or hard reload).
17. **`ARCHITECTURE.md`** — new section "Offline + modes": SW cache shape, version-busting, ranked vs practice data flow, pending-scores queue contract, daily-challenge mutual exclusion.
18. **`CHANGELOG.md`** — SI-CS08 entry.
19. **CS07 Playwright specs (read-only dependency)** — if CS07 has shipped, add two new specs: `tests/e2e/offline.spec.mjs` and `tests/e2e/practice-vs-ranked.spec.mjs`. Owned by sub-agent #6 (the "specs" sub-agent), explicitly requires CS07 to be merged. If CS07 is not yet merged at CS08 claim time, note these specs as a follow-up in close-out.

## Sub-agent fan-out

The CS08 orchestrator must use the standard agent-harness sub-agent dispatch pattern from <https://github.com/henrik-me/agent-harness/blob/main/OPERATIONS.md#sub-agent-dispatch>. Each prompt must paste the mandatory preamble, declare disjoint write ownership, list exact required reading (including `src/game/api.mjs` post-CS03 shape, `src/game/score.mjs`, `src/game/scenes/menu.mjs`, and CS04 daily-challenge surface), and require the structured report shape. Maintain at least seven sub-agents.

| # | Sub-agent | Owned files | Notes / coordination |
|---|---|---|---|
| 1 | `cs08-mode-module` | `src/game/mode.mjs`, `src/game/mode.test.mjs` | Pure module; no DOM. Other lanes import from this. |
| 2 | `cs08-score-split` | `src/game/score.mjs`, `src/game/score.test.mjs` | Keep backward compat; mode parameter optional. |
| 3 | `cs08-api-and-pending` | `src/game/api.mjs`, `src/game/pending-scores.mjs`, `src/game/pending-scores.test.mjs` | Practice = no-op; ranked offline = enqueue. Coordinate with #1 on import. |
| 4 | `cs08-hud-and-menu` | `src/game/hud.mjs`, `src/game/scenes/menu.mjs`, related `.test.mjs` | Mode badge + menu toggle. Coordinate with CS04-owned daily-challenge HUD if both surface in same frame. |
| 5 | `cs08-play-scene-wireup` | `src/game/scenes/play.mjs` only | HUD badge render + offline banner. Must not change collision/wave logic. |
| 6 | `cs08-service-worker` | `src/sw.mjs`, `src/sw.test.mjs`, `src/main.mjs` (SW registration block only), `src/index.html` (build-sha meta) | Cache-first allowlist; network-only for `/api/*`. |
| 7 | `cs08-deploy-and-docs` | `.github/workflows/swa-deploy.yml` (build-sha substitution step), `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`; if CS07 is merged: `tests/e2e/offline.spec.mjs`, `tests/e2e/practice-vs-ranked.spec.mjs` | Coordinate with #6 on the meta-tag substitution contract. |
| (orchestrator-owned) | — | Active CS file population, scaffold invocations, branch-protection update if any new required check is added, plan-vs-implementation review | — |

## User-approval gates

| Gate | When | Default | Action |
|---|---|---|---|
| G-sw-rollout | Before flipping SW registration on for staging users | Autonomous if SW unit tests + at least one Playwright offline spec are green | User may approve early or defer. |
| G-pending-cap | If real traffic shows the 20-entry pending-scores cap is hit during normal play | Autonomous escalation to a follow-up CS to tune cap or backend window | User may instead approve raising the cap inline. |

## Exit criteria

1. Practice mode never issues `POST /api/session` or `POST /api/score`. Verified by integration test with a network mock.
2. Ranked mode in normal online play behaves identically to the CS03 baseline (no behavior regression).
3. Ranked mode with `startSession()` failing at boot still allows the player to play; the score is enqueued in `localStorage.subInvadersPendingScores[]` and submitted on next online round-trip.
4. Pending-score queue caps at 20 entries with FIFO eviction; corrupt JSON in the localStorage key is recovered (queue resets to empty, not throws).
5. Service Worker caches only the explicit allowlist; `/api/*` requests always go to network.
6. SW cache name embeds the deploy short-SHA; activating a new SW deletes old caches; users see a one-time "updated" notice on reload.
7. `?nosw=1` and `localhost` disable SW registration entirely.
8. HUD badge `RANKED` or `PRACTICE` is visible in every frame of the play scene.
9. Practice mode high score is persisted in `subInvadersPracticeHighScore` and never read by ranked mode.
10. Practice and daily challenge are mutually exclusive in the menu.
11. README and ARCHITECTURE document the new behavior, the cache invalidation story, and the `?nosw=1` escape hatch.
12. Plan-vs-implementation review records `GO`; close-out docs/restart-state and learnings/follow-up tasks are complete.

## Risks + open questions

1. **R1 — SW invalidation drift.** A bad deploy that breaks `__BUILD_SHA__` substitution could lock users on a stale cache. Mitigation: keep the substitution in CI, fail the deploy if the placeholder is still present in the uploaded HTML, and document `?nosw=1` everywhere user-facing.
2. **R2 — Pending-ranked-score replay-window expiry.** A player who plays ranked offline for >600s and then reconnects will fail submission per C16-12. CS08-7 surfaces this honestly rather than silently losing the score. Consider a UX nudge "back online — your last score may be too old to count" if the queue contains entries older than 600s at drain time.
3. **R3 — localStorage corruption.** A user could manually edit the pending-scores key. `pending-scores.mjs` must treat any non-array or non-shape-conforming entry as recoverable (reset queue) and never throw at boot.
4. **R4 — Mode-toggle keyboard collision.** If the menu reuses arrow-keys for mode cycling and another menu item also uses arrows, define the input precedence.
5. **R5 — Daily-challenge interaction.** CS04 owns the daily flag; CS08 must not regress daily ranked submission. The mutual-exclusion rule (CS08-14) keeps the matrix small but must be tested.
6. **R6 — Cross-origin sprite future.** If a future CS moves `sprites.png` to a CDN, the SW allowlist must update or stop pre-caching it. Document this dependency in `ARCHITECTURE.md`.
7. **R7 — Practice scores feel disposable.** Real users may want a longer practice history than just a single high score. Out of scope for v1; track as a follow-up if requested.
8. **R8 — SW + private-tab.** Some browsers disable SW in private mode. Game must still work — degrade to no-SW, no-offline. CS08-12 (never on the critical path) covers this.

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| Author `mode.mjs` + tests | done | sub-agent #1 | agent-id=cs08-mode \| role=mode-module \| report-status=complete \| learnings=0 |
| Split high-score by mode | done | sub-agent #2 | agent-id=cs08-score \| role=score-split \| report-status=complete \| learnings=0 |
| Practice = no-op API + pending-scores queue | done | sub-agent #3 | agent-id=cs08-pending+cs08-api \| role=pending-queue+api-noop \| report-status=complete \| learnings=0 |
| Mode badge in HUD + menu toggle | planned | sub-agent #4 | Canvas-only; no DOM. |
| Wire badge + offline banner in play scene | planned | sub-agent #5 | Must not touch collision/wave logic. |
| Service Worker + SHA-versioned cache | planned | sub-agent #6 | Allowlist + network-only `/api/*`. |
| Deploy workflow SHA substitution + docs | planned | sub-agent #7 | Fail deploy if placeholder remains. |
| Add Playwright offline + mode specs | planned | sub-agent #7 | Only if CS07 has merged; otherwise defer. |
| Verify ranked/online behavior unchanged vs CS03 baseline | planned | orchestrator | Exit criterion #2. |
| Close-out docs + restart state | planned | orchestrator | Workboard + active CS notes. |
| Close-out learnings + follow-ups | planned | orchestrator | File `cs08-practice-history` follow-up if R7 surfaces. |

## Notes / Learnings

Filled during execution. At minimum, record: SW rollout cadence, observed `__BUILD_SHA__` substitution health on first deploy, pending-scores queue depth observed in staging, and any user feedback on the ranked/practice toggle UX.

**Progress (2026-06-30, branch `cs08/content`):** Logic layer complete and committed
(40a10da foundation, f21f2ec api no-op): `mode.mjs`, mode-keyed `score.mjs`,
`pending-scores.mjs`, and practice-no-op `api.mjs`, all unit-tested (node --test 345/345)
with the unit coverage gate green. Implementer models materially used by the foundation
sub-agents included gpt-5.5 (cs08-score, cs08-pending; cs08-mode/cs08-api not exposed by
runtime) plus claude-opus-4.8 (orchestrator integration) — the close-out Model audit and
the rubber-duck reviewer-model choice MUST reconcile against these (reviewer model must
differ from every implementer model). Remaining: UI lanes (#4 HUD badge + menu toggle,
#5 play-scene wireup), #6 Service Worker + `main.mjs`/`index.html` wiring (decide SW
serve/scope — it is NOT covered by the single-entry esbuild build), #7 deploy SHA
substitution + docs + e2e specs, then the content PR + rubber-duck review + plan-vs-impl
review + close-out.

## Model audit

| Field | Value |
|---|---|
| Implementer models | claude-opus-4.8 |
| Reviewer model | gpt-5.5 |
| Implementer agent | yoga-si |
| Reviewer agent | rubber-duck |

## Plan review

| Round | Reviewer model | Plan author model(s) | Reviewer agent | Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200 chars) |
|---|---|---|---|---|---|---|---|
| R1 | gpt-5.5 | claude-sonnet-4.6 | rubber-duck dispatched (orchestrator: yoga-si) | b2cd771eec46 | 2026-05-14T07:55:00Z | Go-with-amendments | Grandfathered at v0.5.0 pin-bump per harness CS42-7. Plan content unchanged at backfill; SI orchestrator may add R2 when CS is claimed. |
## Plan-vs-implementation review

> _(filled at close-out per the gate)_

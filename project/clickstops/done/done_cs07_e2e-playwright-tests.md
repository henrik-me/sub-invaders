# CS07 — End-to-end browser tests with Playwright

**Status:** done
**Owner:** yoga-si (orchestrator) + cs07-content-agent (background sub-agent) + cs07-fix-round-agent
**Branch:** cs07/content (merged PR #28 as `3a86b84`) → cs07/close-out
**Started:** 2026-05-13T04:04Z
**Closed:** 2026-05-13T05:35Z
**Depends on:** CS01 (Repo hardening + first SWA staging deploy), CS02 (Engine + game skeleton + minimal playable game)

## Goal

Stand up a real headless-browser end-to-end test suite for Sub Invaders using [Playwright](https://playwright.dev). Tests drive the actual built game in a real Chromium (and optionally Firefox/WebKit) browser, exercising the full keyboard → engine → renderer → canvas pipeline against the same artifact that ships to staging or production. CS07 closes when every PR runs the E2E suite as a required check, the suite covers the core gameplay loop end-to-end (player movement, torpedo→invader collision, wave advancement, game over, persistence), and the CS02 torpedo-collision regression scenario is locked behind a Playwright spec that would have caught the bug pre-merge.

CS07 also introduces the project's first `package.json` and the convention for managing JavaScript dev-time tooling. The runtime frontend remains pure vanilla ES modules with no build step. `package.json` exists solely to install dev dependencies (Playwright, a tiny static-file server for local runs) and to expose `npm run test:e2e` style scripts. No bundler, no transpiler, no framework.

## Background

CS02 close-out shipped a regression where torpedoes flew straight through invaders because `play.mjs::formationInvaders()` looked for `formation.invaders` while the real `invaders.mjs` exposes the array via `formation.enemies`. The unit suite was 100% green because the test stubs in `scenes.test.mjs` happened to use the same misnamed field as the production lookup — a textbook stub-vs-real-API drift between two sub-agent lanes (formation owner vs play-scene owner). The hotfix in PR #23 (`d0a345f`) landed a stronger integration test that wires the real formation, but unit-style integration tests can't catch the next class of regressions: input-system bugs, renderer regressions, scene-routing bugs, focus/visibility bugs, browser-only timer drift, mobile touch regressions, or anything that requires a real DOM. A Playwright suite would have killed the CS02 bug in seconds with `await page.keyboard.press('Space'); await expect(scoreLocator).not.toHaveText('SCORE: 0');`.

Sub Invaders is small enough that a focused E2E suite (≤10 specs, ≤30s wall time on chromium) is feasible. The game has no backend dependencies in the v1 frontend (CS03 will add the leaderboard backend; CS07 stays frontend-only for the v1 scope and leaves backend E2E as a CS03/CS04 responsibility). Adding Playwright now also gives CS03 (backend) and CS04 (daily challenge) a place to layer their own E2E specs as those surfaces ship.

The repository currently has no `package.json` and no npm dependencies at all. CS07 introduces `package.json` carefully so the existing Node-test workflow (`node --test src/**/*.test.mjs`) is unaffected, the harness lint stays green, and CI cache keys are sized correctly.

## Decisions (SI-CS07-specific)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| CS07-1 | E2E framework | [`@playwright/test`](https://playwright.dev/docs/intro) | First-class TypeScript-free API works in plain `.mjs`; built-in fixtures, retries, traces, video, HTML report. Installed browsers are versioned with the package. |
| CS07-2 | Browsers | Chromium-only on PR CI; Chromium + Firefox + WebKit on nightly cron | Keeps PR latency low; nightly catches engine drift. WebKit covers Safari/iOS surface. |
| CS07-3 | Where tests run on PR | Local static server (`npx http-server src -p 4173 --silent`) launched by Playwright `webServer` config | Decouples PR E2E from the SWA preview deploy lifecycle; avoids preview-env-cap (3 envs Free SKU) thrash. |
| CS07-4 | Where tests run on staging | After SWA preview deploy, run the same suite against `BASE_URL=<preview-url>` as a separate "deployed-smoke" job that does not block merge | Real CDN behavior, real headers, real routing — but flake from cold-starts/preview-env-cap should not gate merge. |
| CS07-5 | Test hooks | Expose `window.__subInvaders` (read-only state + minimal action handles like `pressKey`) only when URL has `?test=1` query param | Asserting against `<canvas>` pixels alone is brittle and slow. A gated test hook keeps prod behavior unchanged while making assertions deterministic. |
| CS07-6 | Determinism | Add `?seed=N` URL param → engine RNG seeded from `N`; `?startWave=N` for wave skipping in tests | Eliminates flake from random invader fire timing. |
| CS07-7 | Required vs advisory | E2E suite is **required** on PR CI. Failures block merge. Flake budget is one auto-retry per spec. | The whole point is to catch CS02-class regressions before merge. |
| CS07-8 | Where artifacts live | `playwright-report/`, `test-results/`, `playwright/.cache/` are gitignored. Failure traces uploaded as workflow artifacts. | Standard Playwright layout. |
| CS07-9 | Dev-dep management | First `package.json` is dev-only (`"private": true`, no `dependencies`, only `devDependencies`); add `package-lock.json`; commit `node_modules` is forbidden via `.gitignore` | Keeps the runtime zero-dep promise intact. |
| CS07-10 | Local dev server | `http-server` (npm) on port 4173 by default; document `python -m http.server 4173 --directory src` as a no-npm fallback | Tiny, MIT, works on Windows/macOS/Linux. |
| CS07-11 | Visual regression | Out of scope for CS07; deferred to a future CS | Pixel snapshots are notoriously flake-prone across OS/font-rendering and add CI cost. Functional assertions first. |
| CS07-12 | Mobile/touch coverage | Out of scope for CS07; one Playwright `device: 'iPhone 14'` smoke spec is the floor, full coverage deferred | The game is desktop-first in v1; adds two tests not a full pass. |
| CS07-13 | Reporter | `list` for CI logs + `html` for failure debugging + `github` reporter for PR annotations | Matches the GitHub Actions UX the orchestrator already uses. |
| CS07-14 | Browser cache strategy | GitHub Actions cache keyed on `package-lock.json` hash + Playwright version | Browsers are ~300MB; downloading on every PR is wasteful. |

## Deliverables

1. **`package.json`** at repo root with `"private": true`, `"type": "module"`, `devDependencies` for `@playwright/test` and `http-server`, and `scripts`:
   - `"test:e2e"` — `playwright test`
   - `"test:e2e:headed"` — `playwright test --headed`
   - `"test:e2e:ui"` — `playwright test --ui`
   - `"test:e2e:report"` — `playwright show-report`
   - `"serve"` — `http-server src -p 4173 --silent -c-1`
2. **`package-lock.json`** committed; produced by `npm install`.
3. **`.gitignore`** updated: `node_modules/`, `playwright-report/`, `test-results/`, `playwright/.cache/`.
4. **`playwright.config.mjs`** at repo root:
   - `testDir: './tests/e2e'`
   - `webServer: { command: 'npm run serve', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 30_000 }`
   - `use.baseURL: process.env.BASE_URL ?? 'http://localhost:4173'`
   - `projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }]` on PR; nightly workflow extends with firefox + webkit.
   - `retries: process.env.CI ? 1 : 0`
   - `reporter: process.env.CI ? [['list'], ['html', { open: 'never' }], ['github']] : 'list'`
   - `workers: 1` (the game uses localStorage globals; serial avoids cross-test bleed).
5. **`src/game/test-hooks.mjs`** — exports `installTestHooks({ scenes, formation, player, input, score, lives, wave })` that conditionally attaches `window.__subInvaders` only when `new URL(location.href).searchParams.get('test') === '1'`. Surface area:
   - `state()` — returns `{ scene, score, lives, wave, alive, gameOver }` snapshot
   - `formation()` — returns array of `{ x, y, w, h, type, alive }` for current formation enemies
   - `player()` — returns `{ x, y, w, h, lives }`
   - `pressKey(code)` / `releaseKey(code)` — synthesizes `KeyboardEvent` dispatch on document
   - `setSeed(n)` — re-seeds RNG mid-run (test-only)
   - All hook methods are no-ops when hook is not installed.
6. **`src/main.mjs`** — wire `installTestHooks` (no-op without `?test=1`) so prod behavior is unchanged. Also parse `?seed=` and `?startWave=` query params and feed them into the engine bootstrap when present; both unset in normal play.
7. **`src/main.test.mjs`** — assert `installTestHooks` is a no-op when query param is absent and that all five hook methods are present and typeof function when query param is `1` (use a fake `window` and `URL`). Keep this in the existing Node test runner so harness lint isn't disturbed.
8. **`tests/e2e/_fixtures.mjs`** — Playwright test fixtures: `gamePage` extends `page` with helpers `goto({ seed, startWave, test = 1 })`, `waitForReady()`, `state()`, `formation()`, `player()`, `pressKey(code, ms)`. Provides retry-safe focus management (`page.locator('canvas').focus()`).
9. **`tests/e2e/smoke.spec.mjs`** — page loads with `?test=1`; canvas exists; no console errors; HUD renders score `0`, lives `3`, wave `1`; pressing arrow keys moves player x.
10. **`tests/e2e/collision.spec.mjs`** — **the CS02 regression smoke**. With deterministic seed and stationary-formation cheat (`?test=1&formationSpeed=0`), align player under formation column 5, press Space, assert `state().score > 0` within 2s and `formation()[targetIndex].alive === false`. This spec must fail if `play.mjs::formationInvaders()` regresses to looking up a wrong field name.
11. **`tests/e2e/wave.spec.mjs`** — start at wave 1 with low formation count or use `?startWave=1&waveSize=2`; clear all invaders; assert `state().wave === 2` and a fresh formation appears.
12. **`tests/e2e/game-over.spec.mjs`** — using a hook that drains lives or sets `state().lives = 1` then triggers a hit; assert game-over scene visible (HUD has `GAME OVER`); reload preserves high score in localStorage.
13. **`tests/e2e/persistence.spec.mjs`** — set high score via hook, reload, assert displayed high score persists (validates localStorage round-trip).
14. **`tests/e2e/mobile.spec.mjs`** — single iPhone 14 device test: page loads, canvas scales, on-screen control overlay (if any) responds to a tap; covered as a floor-line regression detector for mobile.
15. **`.github/workflows/e2e.yml`** — runs on `pull_request` and `push` to main; jobs:
    - `e2e-local` — `npm ci` → `npx playwright install --with-deps chromium` (cached) → `npm run test:e2e -- --project=chromium` against local `http-server`. **Required**.
    - `e2e-deployed` (only on `pull_request` after `swa-deploy.yml` succeeds, depends-on via `workflow_run`) — same suite against `BASE_URL=<pr-preview-url>`; **not required**, advisory annotation only.
    - Upload `playwright-report/` as artifact on failure.
16. **`.github/workflows/e2e-nightly.yml`** — cron `0 6 * * *` (06:00 UTC daily); runs full matrix (chromium + firefox + webkit) against staging URL. Failure files an auto-issue tagged `e2e-nightly-fail`.
17. **`README.md`** — new "End-to-end tests" section with `npm install`, `npx playwright install chromium`, `npm run test:e2e`, `npm run test:e2e:headed`, `npm run test:e2e:ui`, and a "writing a new spec" snippet.
18. **`OPERATIONS.md`** — note that any new gameplay-affecting CS must add at least one Playwright spec for the new surface; a CS that adds a new scene must add a smoke spec for that scene.
19. **`CHANGELOG.md`** — SI-CS07 entry summarizing the suite, the CS02 regression coverage, and the new dev-dep convention.

## Sub-agent fan-out

The CS07 orchestrator must use the standard agent-harness sub-agent dispatch pattern from <https://github.com/henrik-me/agent-harness/blob/main/OPERATIONS.md#sub-agent-dispatch>. Each prompt must paste the mandatory preamble, declare disjoint write ownership, list exact required reading (including `src/game/scenes/play.mjs`, `src/game/invaders.mjs`, `src/main.mjs`, and PR #23 / commit `d0a345f` as the motivating regression), and require the structured report shape. Maintain at least seven sub-agents.

| # | Sub-agent | Owned files | Notes / coordination |
|---|---|---|---|
| 1 | `cs07-package-and-config` | `package.json`, `package-lock.json`, `.gitignore`, `playwright.config.mjs` | Must keep `node_modules/` ignored; `package.json` `"private": true`, dev-only deps. Run `npm install` and commit lock. |
| 2 | `cs07-test-hooks` | `src/game/test-hooks.mjs`, `src/main.test.mjs`, read-only `src/main.mjs`, `src/game/scenes/*.mjs` | Hook must be no-op without `?test=1`. Coordinate with #3 before editing `src/main.mjs`. |
| 3 | `cs07-main-wireup` | `src/main.mjs` only | Wire `installTestHooks`, parse `?seed=`, `?startWave=`, `?formationSpeed=` query params. Must not change behavior when params are absent. |
| 4 | `cs07-fixtures` | `tests/e2e/_fixtures.mjs` | Read-only access to `src/game/test-hooks.mjs` for the contract. |
| 5 | `cs07-core-specs` | `tests/e2e/smoke.spec.mjs`, `tests/e2e/collision.spec.mjs` | The CS02 regression spec is the priority. |
| 6 | `cs07-gameplay-specs` | `tests/e2e/wave.spec.mjs`, `tests/e2e/game-over.spec.mjs`, `tests/e2e/persistence.spec.mjs`, `tests/e2e/mobile.spec.mjs` | Use deterministic seeds; no shared state between specs. |
| 7 | `cs07-ci-and-docs` | `.github/workflows/e2e.yml`, `.github/workflows/e2e-nightly.yml`, `README.md`, `OPERATIONS.md`, `CHANGELOG.md` | Coordinate with #1 to keep cache keys aligned. |
| (orchestrator-owned) | — | Active CS file population, scaffold invocations, branch-protection update to add `e2e-local` as a required check, plan-vs-implementation review | Must update branch-protection ruleset to require the new `e2e-local` job before close-out. |

## User-approval gates

| Gate | When | Default | Action |
|---|---|---|---|
| G-required-check | Before flipping the new `e2e-local` job to **required** on `main` branch protection | Autonomous if the suite has been green for 5 consecutive PR runs | User may approve flipping required-status sooner. |
| G-flake-budget | If a spec retries on more than 10% of PR runs in the first week | Autonomous escalation to a follow-up CS to harden the spec | User may instead approve removing the spec temporarily with a TODO. |

## Exit criteria

1. `package.json` exists, is dev-only (`"private": true`, no runtime `dependencies`), and `npm install` is reproducible from `package-lock.json`.
2. `npm run test:e2e` passes locally on a clean checkout (Chromium installed via `npx playwright install chromium`).
3. The CS02 collision regression scenario is covered by `tests/e2e/collision.spec.mjs`. Reverting the `play.mjs::formationInvaders()` fix from PR #23 in a scratch branch makes that spec **fail**, proving the test catches the bug.
4. `e2e-local` job runs on every PR and is a **required** GitHub branch-protection check on `main`.
5. `e2e-deployed` job runs against PR preview URL after SWA deploy succeeds and posts an advisory annotation; failures do not block merge.
6. `e2e-nightly` workflow runs on cron and executes chromium + firefox + webkit against staging.
7. Failure artifacts (`playwright-report/`, traces) are uploaded for every failed CI run and downloadable from the Actions UI.
8. The runtime frontend remains zero-runtime-dep. `src/index.html` does not reference `node_modules`. `installTestHooks` is provably a no-op without `?test=1` (covered by the unit test in `src/main.test.mjs`).
9. README documents `npm run test:e2e`, `npm run test:e2e:headed`, `npm run test:e2e:ui`, and how to add a new spec.
10. OPERATIONS doc requires future gameplay-affecting CSes to add at least one Playwright spec for the new surface.
11. Plan-vs-implementation review records `GO`; close-out docs/restart-state and learnings/follow-up tasks are complete.
12. The harness lint (`npx -y "github:henrik-me/agent-harness#<pin>" lint`) still exits 0 after `package.json` is added.

## Risks + open questions

1. **R1 — Playwright slows PR CI.** Chromium-only on PR keeps wall-time around 30-60s plus install. Cache the browser binary; pin `@playwright/test` so the cache key is stable.
2. **R2 — Canvas-only assertions are brittle.** Decision CS07-5 introduces `window.__subInvaders` test hooks gated by `?test=1` to avoid pixel-diff fragility.
3. **R3 — Test hook surface leaks into prod bundle.** Hooks must be conditionally installed; the unit test in `src/main.test.mjs` proves this. Consider stripping the file at build-time once a build step exists; until then, the conditional install is the contract.
4. **R4 — `node_modules` accidentally committed.** `.gitignore` must include it; CI should fail if `node_modules/` shows up in `git status` after `npm install`. Add a `harness lint` allowlist check if the linter flags new directories.
5. **R5 — SWA preview-env-cap thrash.** Decision CS07-3 keeps the **required** suite on a local server, not the preview env. The `e2e-deployed` job is advisory and will not block merges if the preview env cap (3 on Free SKU) is exhausted.
6. **R6 — Browser engine drift on WebKit/Firefox.** Nightly cron (CS07-2) catches drift without burdening PR CI. Auto-issue on nightly failure routes the noise to triage.
7. **R7 — `http-server` is a transitive dep risk.** Pin `http-server` to a recent stable major version in `package.json`. The Python `python -m http.server` fallback in CS07-10 is the no-npm escape hatch.
8. **R8 — Headed/UI mode flakiness on Windows.** Tests must use `page.locator('canvas').focus()` before keyboard input; document this in the fixture.
9. **R9 — Existing Node `--test` suite must keep working.** `package.json` adds `"type": "module"` which matches the existing `.mjs` files; verify `node --test src/**/*.test.mjs` still discovers and passes after adding `package.json`.
10. **R10 — Branch-protection update is a one-way door.** G-required-check defers flipping required-status until 5 green runs; until then, the job runs but is informational.

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| Bootstrap `package.json` + `.gitignore` + `package-lock.json` | planned | sub-agent #1 | First `npm install` of the repo. Verify `node --test` still works after. |
| Author `playwright.config.mjs` | planned | sub-agent #1 | Local server via `webServer`; chromium-only on PR. |
| Implement test hooks | planned | sub-agent #2 | Strict `?test=1` gating with unit-test proof. |
| Wire `src/main.mjs` query params + hook install | planned | sub-agent #3 | Must not change normal-play behavior. |
| Author E2E fixtures | planned | sub-agent #4 | `gamePage` helper centralizes hook access. |
| Author core specs (smoke + collision regression) | planned | sub-agent #5 | Collision spec is the CS02 regression contract. |
| Author gameplay/persistence/mobile specs | planned | sub-agent #6 | Use deterministic seeds. |
| Add CI workflows (PR + nightly) | planned | sub-agent #7 | Cache Playwright browsers. |
| Update README + OPERATIONS + CHANGELOG | planned | sub-agent #7 | Documents `npm run test:e2e` and the "new CS adds new spec" rule. |
| Flip `e2e-local` to required after 5 green runs | planned | orchestrator | G-required-check gate. |
| Verify reverting `play.mjs` fix breaks collision spec | planned | orchestrator | Exit criterion #3 evidence. |
| Close-out docs + restart state | planned | orchestrator | Workboard + active CS notes. |
| Close-out learnings + follow-ups | planned | orchestrator | File `cs07-flake-budget` follow-up if R6/R8 surface. |

## Notes / Learnings

Filled during execution. At minimum, record: chosen Playwright version, browser cache hit ratio, wall-time of PR `e2e-local` job after warm cache, any specs that retried, and whether `node --test` discovery survived the addition of `package.json`.

## Plan-vs-implementation review

**Verdict:** GO (post-PR #28).

**Reviewer:** GPT-5.5 (5 rounds: R1 No-Go [withdrawn as stale-diff false positive] → R2 Go @ `8c2d35a` → R3 Go @ `c4b892f` → R4 Conditional Go @ `c4b892f` → R5 Go @ `ec26adf`).

**Date closed:** 2026-05-13T05:35Z. Squash-merged as `3a86b84` on main.

### Plan-vs-implementation deltas

| Plan reference | Implementation reality | Resolution |
|---|---|---|
| Plan §6 names `src/main.mjs` | Repo's actual entrypoint from CS02 is `src/game/main.mjs` (CS02 placed game module under `src/game/`, not `src/`). | Implementation used `src/game/main.mjs` and adjacent `src/game/main.test.mjs` without changing `src/index.html`. PR body called out the path correction. Plan section above retains the original wording for historical accuracy. |
| Plan §7 names `src/main.test.mjs` | Adjacent test placed at `src/game/main.test.mjs` for the same reason. | Same as above. |
| 7 spec files planned | 8 spec files shipped. | Added `tests/e2e/wave-skip.spec.mjs` (R3 fix round) for explicit `?startWave=N>1` regression coverage when GPT-5.5 R1 surfaced a (false-positive) coverage concern. |

### Reviewer findings — disposition

| Round | Finding | Class | Disposition |
|---|---|---|---|
| R1 | "`?startWave=N` plumbed but never consumed by play.mjs" | Blocking (DISPUTED) | False positive: agent had already added the fix in `8a5dee4`/`daa128c` before R1 ran. Live verification at HEAD confirmed `?startWave=3` → `state.wave === 3` and `?startWave=5` → `state.wave === 5` (after `gamePage.waitForReady()`). R2 explicitly withdrew the finding. Root cause: neither R1 nor Copilot's first review stated `ANALYZED HEAD: <sha>`, leaving staleness invisible. |
| Copilot | 4 review threads (2× startWave-not-applied, 1× webServer-always-on, 1× nightly-issue-spam) | All stale-diff | All 4 threads resolved with explanations referencing the cs07/content commits that already had the fixes. |
| R4 RECOMMENDED-1 | All 4 e2e jobs missing job-level `timeout-minutes` | Recommended | Fixed in commit `ec26adf`: e2e-local 15m / e2e-deployed 15m / e2e-nightly 20m / open-issue-on-failure 5m. Verified clean in R5. |
| R4 RECOMMENDED-2 | Squash-merge commit must include Copilot trailer | Recommended | Done at merge: squash body of `3a86b84` includes `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`. Recovers the 4 fix-round commits (`8a5dee4`, `daa128c`, `c294613`, `8c2d35a`) that omitted it at commit level. |
| R4 NOTE | `e2e.yml` uploads artifacts on `push:main` failures | Note (DISAGREED) | Deliberately kept: post-merge regressions on main benefit from report preservation; main is trusted; no PR-controlled secrets. The R4 audit criterion was over-specified by the orchestrator and is not a documented policy. |

### Process gaps surfaced + filed for harness enforcement

This CS uncovered six distinct doctrine-without-enforcement gaps. All filed in the harness umbrella issue:

- **harness#145** — comprehensive enforcement-gap inventory (supersedes harness#143 + harness#144). Six groups, ~30 gates, six implementation-ready changes (R1-vs-Rn rounds, mandatory SHA pinning in review evidence, `pr-commits-trailer-coverage` lint, standardized reviewer-dispatch template, orchestrator verification pass CI gate, Copilot engagement procedure with new gate A16). Phase-1 self-test specifically references this PR's failures.
- **harness#140** — required status checks for review evidence (companion).
- **harness#141** — `harness review <pr>` CLI subcommand (companion; will host the new `--copilot` extension from #145 Change 6).
- **harness#142** — ban implementer self-review (companion).

### Acceptance-criteria checklist (post-PR #28)

- [x] Bootstrap `package.json` + `.gitignore` + `package-lock.json` shipped; `node --test src/**/*.test.mjs` still discovers all tests post-`npm install` (135 → 138 tests).
- [x] `playwright.config.mjs` shipped; `webServer` conditionalized on baseURL (localhost only) so deployed/nightly runs don't try to spin up a local server.
- [x] Test hooks shipped (`src/game/test-hooks.mjs`); `?test=1` gating proven by `src/game/main.test.mjs`.
- [x] `src/game/main.mjs` parses `?seed`, `?startWave`, `?formationSpeed`; `?startWave=N>1` actually advances scene to wave N (verified by R3 + `tests/e2e/wave-skip.spec.mjs`).
- [x] E2E fixtures (`tests/e2e/_fixtures.mjs`) ship the `gamePage` fixture with `waitForReady()` discipline.
- [x] 8 spec files shipped: smoke, collision (CS02 regression contract), wave, wave-skip, game-over, persistence, mobile.
- [x] CI workflows (`e2e.yml` PR + `e2e-nightly.yml` cron) shipped with SHA-pinned actions, scoped permissions, hardened `workflow_run` checkout (commit `dc58fdf`), nightly issue de-dup, all jobs with `timeout-minutes`.
- [x] README + OPERATIONS + CHANGELOG updated; OPERATIONS records the "future gameplay-affecting CSes must add a Playwright spec" rule.
- [x] CS02 collision regression locked: `tests/e2e/collision.spec.mjs` drives the real formation API; reverting `play.mjs::formationInvaders()` to omit `formation.enemies` causes `expect(target).toBeTruthy()` to fail.
- [ ] `e2e-local` flipped to required check on branch protection — **deferred** until 5 green PR runs accumulate (G-required-check gate).
- [x] `harness lint` clean (13 pass).
- [x] `dotnet test api/ --no-build` clean (1 pass).

### Notes / Learnings

- **Stale-diff trap with two reviewers (R1 + Copilot first pass):** both reviewed an older snapshot and reported a false-positive blocker on a fix that had already landed. Will recur until harness#145 Change 2 (mandatory `ANALYZED HEAD: <sha>` in review evidence + `review-evidence-sha-current` PR-side check) ships.
- **Co-authored-by trailer drift on fix rounds:** orchestrator forgot the trailer on 4 fix-round commits (`8a5dee4`, `daa128c`, `c294613`, `8c2d35a`). Recovered at squash-merge by including the trailer in the body, but the per-commit history is non-compliant. Will recur until harness#145 Change 3 (`pr-commits-trailer-coverage` lint) ships.
- **Reviewer summary-pass on YAML / package.json / per-test files:** R2 and R3 marked deliverables as "match" without enumerating per-file. R4 with a forced per-file checklist caught the missing `timeout-minutes`. Will recur until harness#145 Change 1 (R1 comprehensive vs Rn delta with forced enumeration) + Change 4 (standardized reviewer-dispatch template) ship.
- **Local-clean-then-Copilot ordering violated:** R3 + Copilot were dispatched in parallel instead of strictly serial. Wasted Copilot reviewer cycles on a state about to change. Will recur until harness#145 gate A5 (timestamp-ordering check) ships.
- **No documented procedure for engaging Copilot:** three different mechanisms tried; only one (PR comment with `@copilot review`) ever produced a review and only on the first call. Re-trigger at HEAD `ec26adf` was silent for 10+ minutes. Will recur until harness#145 Change 6 (Copilot engagement procedure + GraphQL `requestReviews` mutation + `harness review --copilot` subcommand) ships.
- **Test-hook default value trap:** `src/game/test-hooks.mjs:184` returns `wave: Math.max(1, Math.floor(Number(state.wave) || 1))` — when title scene is current, `state.wave` is undefined, so the hook defaults to `1`. Tests that call `state()` before `waitForReady()` see `wave: 1` regardless of `?startWave=N`. Both R1 and Copilot's first pass were tripped by this. Documented in `tests/e2e/wave-skip.spec.mjs` and `_fixtures.mjs::waitForReady()`.

> _Original placeholder: filled at close-out per the gate._

# Project Context

> **Last updated:** 2026-07-01 (post-CS18 close-out: E2E suite coverage floor made fatal)

## Codebase state

**CS18 complete** (merged 2026-07-01 as `00ffb1d`) — the E2E suite-level coverage
floor is now a real, blocking CI gate. The monocart `onEnd` hook set
`process.exitCode = 1` on a breach, but Playwright ignores a reporter-set exit code,
so `test:e2e:coverage` exited 0 even below the floor (LRN-028). A new post-Playwright
checker (`scripts/coverage-suite.mjs`, wired into `test:e2e:coverage` after the
per-file gate) reads the aggregate `.summary` from `coverage-report.json` and exits
non-zero on any breach (fail-closed on missing/malformed/non-finite/empty-floors). The
E2E suite floors were re-baselined to measured reality (lines 68 / statements 77 /
functions 77 / branches 62 / bytes 78, ~1pp margin) in `coverage-thresholds.json`
`e2e.suite` — now the single source of truth also read by
`playwright.coverage.config.mjs` (duplicated literal removed). Verified: full
`test:e2e:coverage` exits 0 at floors, a raised floor exits non-zero from the suite
checker, and the CI `coverage` job is green. Content PR #125 ran 5 rubber-duck + 5
Copilot rounds (6 robustness fixes). See
`project/clickstops/done/done_cs18_e2e-suite-coverage-floor-fatal.md`.

**CS17 complete** (merged 2026-07-01 as `5cd13cc`) — fixed the recurring `swa-deploy`
push-run cancellations that had left production stale after every merge since
`8a2c5bc` (2026-06-16). Root cause: the `push` production deploy and the
`pull_request:closed` preview teardown shared concurrency group
`swa-deploy-${{ github.ref }}`; the teardown (`cancel-in-progress: true`) cancelled the
push deploy ~2s after each merge, requiring a manual re-run (LRN-028). The group is now
event- and PR-number-qualified
(`swa-deploy-${{ github.event_name }}-${{ github.event.pull_request.number || github.ref }}`),
so push production deploys are never cancelled by PR teardown runs. **Verified on its own
merge:** `5cd13cc`'s push deploy completed with no manual re-run and `/api/health` →
`commit: 5cd13cc`. See `project/clickstops/done/done_cs17_swa-deploy-push-cancellation.md`.

**CS08 complete** (merged 2026-07-01 as `1321cc0`) — offline play + ranked/practice
modes. The frontend resolves a mode (`?mode=` deep-link seed + canvas menu toggle,
default ranked), splits the high score by mode (`subInvadersPracticeHighScore` for
practice), and makes practice a pure local mode (never calls `/api/session|score`).
Ranked scores that fail to submit offline are queued in
`localStorage.subInvadersPendingScores` (bounded FIFO, cap 20) and drained on the next
online load, bypassing the practice guard so queued ranked scores are never silently
lost. A self-contained root-scope Service Worker (`src/sw.mjs`, registered
`{ type: 'module' }`) cache-firsts an explicit static allowlist (network-only for
`/api/*`), names its cache `sub-invaders-<build-sha>` (the deploy substitutes
`__BUILD_SHA__` in `index.html` + `sw.mjs` and fails if the placeholder remains), and
shows a one-time "updated" banner on SW update. An always-visible HUD badge shows
`RANKED`/`PRACTICE`. Test counts on `main`: `npm run test:unit` 394; e2e adds
`offline.spec.mjs` + `practice-vs-ranked.spec.mjs`. Implemented via a 7-lane sub-agent
fan-out; the content PR #118 took 7 rubber-duck rounds (gemini-3.1-pro-preview) + 6
Copilot rounds, catching 3 real bugs before merge (SW module-worker registration,
drain-in-practice silent ranked-score loss, SW cache `ignoreSearch` for offline
deep-links). See `project/clickstops/done/done_cs08_offline-and-practice-mode.md`.

**CS13 complete** (merged 2026-06-30 as `78dcad0`) — the Canvas 2D engine was
extracted from the in-tree `src/engine/` into the standalone public repo
[`henrik-me/canvas-game-engine`](https://github.com/henrik-me/canvas-game-engine)
at tag `v0.1.0`. sub-invaders now consumes it as a git-URL dependency
(`github:henrik-me/canvas-game-engine#v0.1.0`), imports bundler-resolved bare
specifiers (`canvas-game-engine/<module>.mjs`), and the vendored engine +
in-repo isolation linter are deleted (the contract is now enforced by the
upstream repo's CI). Production deploy on `78dcad0` is healthy
(`/api/health` → `commit: 78dcad0`; the engine ships inside the esbuild bundle).
Test counts on `main`: `npm run test:unit` 316/316, `dotnet test api/` 95/95,
e2e 48 passing. **Deploy reliability:** main-push `swa-deploy` runs were cancelling
since `8a2c5bc` (2026-06-16) — the CS13 merge deploy had to be re-run manually to land;
**fixed in CS17** (2026-07-01), see LRN-028 (deploy sub-item resolved; e2e-floor
sub-item tracked by CS18).

Prior milestones (CS01–CS12, CS14, CS15) shipped repo hardening, the engine +
game, backend leaderboard, daily challenge, E2E suite, coverage gates, the
esbuild bundler, and the unit per-file coverage gate; see
`project/clickstops/done/` for the authoritative history.

**Historical detail (pre-CS13, may be stale):**

**CS02 complete** (merged 2026-05-13) — engine slice + game skeleton + minimal
playable Sub Invaders. Content shipped via PR #19 (squash-merged as `263aec0`)
and a follow-up content PR #20 (squash-merged as `49d12a1`) that wired the
`verify-deploy` scaffold per Deliverable 9 and resolved three NEEDS-FIX items
from the plan-vs-implementation review. `main` HEAD is `49d12a1` and the
production deploy on commit `263aec0` is healthy and serving the new game host
(verified via the wired `verify-deploy` probe — frontend-root, health, sprites
all 200).

**CS01 complete** (merged 2026-05-11) — repo hardening and first SWA staging
deploy done. **Post-CS01 maintenance** has also landed: full Dependabot wave
(7 PRs covering actions + nuget bumps), `swa-deploy.yml` skip-on-missing-
secrets fix, manual Functions Worker v2 alignment to replace an auto-closed
multi-bump, and stale-staging-env / stale-branch cleanup.

Highlights:
- Branch protection Ruleset `main-protection` (id 16210336) is active on `main`,
  requiring 1 approving review, conversation resolution, linear history,
  squash-only merges, and 5 required CI status checks (`ci`, `harness-lint`,
  `harness-sync-check`, `js-tests`, `dotnet-tests`). `build-and-deploy` is
  intentionally NOT required (Dependabot/fork PRs can't get the SWA token,
  and the SWA action now skips cleanly via
  `skip_deploy_on_missing_secrets: true`).
- `delete_branch_on_merge` enabled on the repo (post-CS01 setting change);
  merged PR head branches are reaped automatically.
- Security & supply-chain: secret scanning + push protection, CodeQL default
  setup (languages: `actions`, `csharp`, `javascript`, `javascript-typescript`,
  `typescript`; weekly schedule), Dependabot alerts + security updates +
  weekly version updates for `npm`/`nuget`/`github-actions`, Private
  Vulnerability Reporting all enabled.
- Governance: `SECURITY.md`, `CONTRIBUTING.md` (with the Copilot co-author
  trailer requirement), `CODE_OF_CONDUCT.md`, PR template, CODEOWNERS,
  bug + feature issue templates.
- ARCHITECTURE.md v1 published: game design, engine vs. game split, Azure
  topology, decision log including CS01-1 .. CS01-14. CS02's engine API
  matches what was documented; no ARCHITECTURE.md edit required by CS02.
- Three composed local blocks customised: `CONVENTIONS.md`, `OPERATIONS.md`,
  `REVIEWS.md`.
- CI workflows live: `ci.yml`, `swa-deploy.yml` (with
  `skip_deploy_on_missing_secrets: true` on both upload and close jobs),
  `workboard-auto-approve.yml` (validation-only — actual approve+merge is
  done by the GitHub App once G3 lands).
- Azure provisioned in `rg-sub-invaders-prod` (westus2): SWA `swa-sub-invaders`,
  Storage `stsubinvadersee1282`, Action Group `ag-sub-invaders-budget`, Budget
  `budget-sub-invaders-monthly` ($5/month cap, alerts 50/80/100%). Subscription
  `Visual Studio Enterprise Subscription`
  (`59fa8de9-d89c-42bc-8b8d-ee7bfab00270`).
- Production deploy live on commit `263aec0` at
  `https://happy-coast-04ffcaa1e.7.azurestaticapps.net/`. Frontend root now
  serves the playable game host (canvas#game-canvas + ES-module bootstrap),
  not the CS01 stub. `/api/health` still returns 200 + `{"status":"ok"}`.
  Sprite sheet served at `/public/sprites.png` (978 bytes).
- Functions Worker stack at v2 throughout: `Worker 2.1.0` + `Worker.Sdk 2.0.7`
  + `Extensions.Http 3.3.0` + `Extensions.Http.AspNetCore 2.1.0`; test
  toolchain at `Microsoft.NET.Test.Sdk 18.5.1` + `xunit.runner.visualstudio
  3.1.5`; actions at `actions/checkout 6.0.2` + `actions/setup-node 6.4.0`
  + `actions/setup-dotnet 5.2.0`.
- Harness pin: the live, authoritative version is the `version` field in [`harness.config.json`](harness.config.json) and `harness_ref` in [`.harness-lock.json`](.harness-lock.json) — always read those rather than trusting a number quoted in prose here (this document lags behind pin bumps). Check the current pin with `node -e "console.log(require('./harness.config.json').version)"` and `node -e "console.log(require('./.harness-lock.json').harness_ref)"` (or `jq -r .harness_ref .harness-lock.json` where `jq` is available). Pin bumps land as standalone `chore: bump agent-harness pin <old> -> <new>` PRs (see git log). PR template migration to composed-v2 remains deferred (existing SI custom template structure does not map cleanly; tracked as a follow-up).
- Test counts: backend `dotnet test api/` 1/1 passing; frontend `node --test`
  on `src/` + `scripts/` reports **134 tests passing** (was 0 at end of CS01;
  CS02 added 117, CS02 follow-up PR #20 added another 17 — `constants.test.mjs`
  + `verify-deploy.checks.test.mjs`).
- Engine isolation: the engine is now consumed as the external `canvas-game-engine`
  dependency (`github:henrik-me/canvas-game-engine#v0.1.0`), extracted in CS13; the one-way
  isolation invariant is enforced by the upstream repo's CI and the former in-repo
  `check-engine-isolation` linter has been removed. Engine remains game-agnostic.
- `verify-deploy` scaffold wired (CS02 PR #20): `scripts/verify-deploy.checks.mjs`
  defines frontend-root (HTML body must contain `#game-canvas` + "Sub Invaders"),
  health (`/api/health` 200 + non-empty body), sprites (`/public/sprites.png`
  200 + non-empty body). Live probe against `263aec0` passes 3/3.

**CS03 next** — backend + leaderboard (planned in `project/clickstops/planned/planned_cs03_backend-and-leaderboard.md`).

## Constraints

See `.harness-known-constraints.md` for repository tier and disposition (detected 2026-05-14T14:51:09.548Z).

## Architecture pointer

See [ARCHITECTURE.md](ARCHITECTURE.md).

## Blockers / open questions

- **G3 (workboard-auto-approve App install) still pending.** Not on the
  critical path for CS01 (claim/content/fixup/close-out PRs were all
  human/admin-merged). Should be installed before higher-volume CSs (CS02+)
  so workboard-only PRs auto-merge cleanly. Install via:
  https://github.com/apps/workboard-auto-approve → Configure → choose
  `henrik-me/sub-invaders`. After install, verify with
  `gh api repos/henrik-me/sub-invaders/installation` (requires App-installation
  scope on the token).

- **Workboard-auto-approve description in harness-managed prose is
  inaccurate** (filed as upstream harness-feedback during CS01 R2 content
  review). `OPERATIONS.md:130-144`, `REVIEWS.md:30-32, 201-203, 255-257`
  describe the workflow as approving + merging PRs, but the GitHub Actions
  built-in `GITHUB_TOKEN` cannot create approving PR reviews — the actual
  approver is the GitHub App. Consumer-facing files (CHANGELOG.md,
  ARCHITECTURE.md, the workflow itself) were corrected in PR #3; the
  managed-prose fix has to come from upstream agent-harness.

## CS plan

The CS plan files live under `project/clickstops/`:
- `done/done_cs01_repo-hardening-and-first-deploy.md` — completed.
- `done/done_cs02_engine-and-minimal-game.md` — completed.
- `planned/planned_cs03_backend-and-leaderboard.md` — next.
- `planned/planned_cs04_daily-challenge-and-pin-bump.md`
- `planned/planned_cs05_re-evaluate-persistence.md`
- `planned/planned_cs06_re-evaluate-cloudflare-full-stack.md`

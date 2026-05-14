# Project Context

> **Last updated:** 2026-05-13 (post-CS02 close-out: engine + minimal playable game)

## Codebase state

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
- Harness pin: `v0.5.1` (bumped from `v0.5.0` in this PR; v0.5.0 had bumped from `v0.3.1` in CS11, skipping `v0.4.0` since CS10 was never claimed). The v0.5.0 release shipped review_gates default-on, the new `cs-plan` / `clickstop-plan-review --strict` linters, the `harness copilot-engage` CLI, and the `Implementer agent` + `Reviewer agent` columns in `## Model audit`. v0.5.1 narrows `cs-plan` defaults (drops `lib/` / `bin/` / `scripts/`) and exempts inline-code spans, fixing [henrik-me/agent-harness#183](https://github.com/henrik-me/agent-harness/issues/183); the `cs_plan_lint.forbidden_path_prefixes` workaround we added in CS11 is no longer needed and has been dropped. PR template migration to composed-v2 remains deferred (existing SI custom template structure does not map cleanly; tracked as a follow-up).
- Test counts: backend `dotnet test api/` 1/1 passing; frontend `node --test`
  on `src/` + `scripts/` reports **134 tests passing** (was 0 at end of CS01;
  CS02 added 117, CS02 follow-up PR #20 added another 17 — `constants.test.mjs`
  + `verify-deploy.checks.test.mjs`).
- Engine isolation: `node scripts/check-engine-isolation.mjs --dir src/engine
  --quiet` exits 0 over 18 `.mjs` files. Engine remains game-agnostic.
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

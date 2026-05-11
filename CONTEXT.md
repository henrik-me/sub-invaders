# Project Context

> **Last updated:** 2026-05-11 (post-CS01 maintenance: Dependabot wave + SWA fix)

## Codebase state

**CS01 complete** (merged 2026-05-11) — repo hardening and first SWA staging
deploy done. **Post-CS01 maintenance** has also landed: full Dependabot wave
(7 PRs covering actions + nuget bumps), `swa-deploy.yml` skip-on-missing-
secrets fix, manual Functions Worker v2 alignment to replace an auto-closed
multi-bump, and stale-staging-env / stale-branch cleanup. `main` HEAD is
`e6d8089` and the production deploy on that SHA is healthy (smoke
verified).

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
  topology, decision log including CS01-1 .. CS01-14.
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
- Production deploy live on commit `e6d8089` at
  `https://happy-coast-04ffcaa1e.7.azurestaticapps.net/`. Frontend stub
  renders; `/api/health` returns 200 + `{"status":"ok"}`.
- Functions Worker stack at v2 throughout: `Worker 2.1.0` + `Worker.Sdk 2.0.7`
  + `Extensions.Http 3.3.0` + `Extensions.Http.AspNetCore 2.1.0`; test
  toolchain at `Microsoft.NET.Test.Sdk 18.5.1` + `xunit.runner.visualstudio
  3.1.5`; actions at `actions/checkout 6.0.2` + `actions/setup-node 6.4.0`
  + `actions/setup-dotnet 5.2.0`.
- Harness pin: `v0.3.1` (bumped from v0.1.0 mid-CS01 to absorb upstream fixes).
- Test counts: backend `dotnet test api/` 1/1 passing; frontend `node --test`
  reports 0 tests (intentional CS01 stub — engine + tests land in CS02).

**CS02 next** — engine + minimal game (planned in `project/clickstops/planned/planned_cs02_engine-and-minimal-game.md`).

## Constraints

See `.harness-known-constraints.md` for repository tier and disposition (detected 2026-05-11T01:10:46.511Z).

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
- `planned/planned_cs02_engine-and-minimal-game.md` — next.
- `planned/planned_cs03_backend-and-leaderboard.md`
- `planned/planned_cs04_daily-challenge-and-pin-bump.md`
- `planned/planned_cs05_re-evaluate-persistence.md`
- `planned/planned_cs06_re-evaluate-cloudflare-full-stack.md`

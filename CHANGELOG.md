# Changelog

All notable changes to Sub Invaders are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
once a tagged release exists.

## [Unreleased]

### Added (post-CS01 maintenance — 2026-05-11) — Dependabot wave + SWA fix

- **Functions Worker stack aligned at v2** (PR #16, replaces auto-closed
  Dependabot #9): `Microsoft.Azure.Functions.Worker` 1.22.0 → 2.1.0,
  `Microsoft.Azure.Functions.Worker.Extensions.Http` 3.2.0 → 3.3.0,
  `Microsoft.Azure.Functions.Worker.Extensions.Http.AspNetCore` 1.3.2 → 2.1.0
  (the Worker.Sdk 1.17.4 → 2.0.7 came in via Dependabot #10).
- **Dependency bumps applied** via Dependabot:
  - actions/setup-dotnet 4.0.0 → 5.2.0 (#4)
  - actions/checkout 4.1.7 → 6.0.2 (#5)
  - actions/setup-node 4.0.3 → 6.4.0 (#6)
  - Microsoft.NET.Test.Sdk 17.12.0 → 18.5.1 (#11)
  - xunit.runner.visualstudio 2.8.2 → 3.1.5 (#12)
  - Microsoft.Azure.Functions.Worker.Sdk 1.17.4 → 2.0.7 (#10)

### Fixed (post-CS01 maintenance — 2026-05-11)

- **`swa-deploy.yml` no longer fails red on Dependabot/fork PRs** (PR #15).
  Added `skip_deploy_on_missing_secrets: true` to both the upload and close
  jobs of `Azure/static-web-apps-deploy`. PRs from `dependabot[bot]` (and
  any fork) do not receive repo secrets, so the SWA action used to fail
  with `deployment_token was not provided`. The skip flag turns that hard
  failure into a clean "skipped (no token)" message and a green check.
  When the token IS present (push:main and any in-repo PR), behaviour is
  unchanged. (`build-and-deploy` is not in the required-checks set, so
  the previous failure didn't block merges, just produced visual noise.)
- **`csharp` is now auto-detected by CodeQL default setup** (no action
  required). The "csharp follow-up CS" referenced in the SI-CS01 entry
  above is no longer needed — once PR #3 merged the .NET code into `main`,
  the CodeQL Setup workflow re-ran and added `csharp` to the configured
  languages list (full list: `actions`, `csharp`, `javascript`,
  `javascript-typescript`, `typescript`).

### Changed (post-CS01 maintenance — 2026-05-11)

- **`delete_branch_on_merge` enabled** on the repository so merged PR head
  branches are removed automatically. Cleaned up the backlog of merged
  branches accumulated during CS01 (claim, content, fixup, close-out, the
  `cs01-fixup/swa-skip-deploy-on-missing-secrets` and
  `deps/api-functions-worker-v2-alignment` branches, and all merged
  Dependabot branches).
- **Stale SWA staging environments cleaned up**. Azure Static Web Apps Free
  SKU caps preview environments at 3; PRs #13/#14/#15 each created one and
  none were reaped on PR close, which surfaced as
  `BadRequest: This Static Web App already has the maximum number of
  staging environments` on the next push:main deploy. Cleanup is via
  `az staticwebapp environment delete --name swa-sub-invaders -g rg-sub-invaders-prod
  --environment-name <pr-number> --yes`.

### Added (SI-CS01 — 2026-05-11) — Repo hardening + first SWA staging deploy

- **Branch protection.** GitHub Repository Ruleset `main-protection` applied to
  `main`: PR required, ≥1 approving review, conversation resolution, linear
  history, squash-only merges, no force-pushes, no deletions. Repo admin retains
  bypass for owner override (LRN-080).
- **Workboard validation workflow.** Added
  `.github/workflows/workboard-auto-approve.yml` — validates that
  `workboard-only`-labeled PRs come from an approved author and touch only
  the workboard path allowlist (`WORKBOARD.md`,
  `project/clickstops/{planned,active,done}/**`). On success it posts a
  "ready for App auto-approve" comment; on failure it posts the
  disallowed-files explanation and exits non-zero. **Approval and squash-merge
  are owned by the `workboard-auto-approve` GitHub App** (gate G3, pending
  user installation) — the built-in `GITHUB_TOKEN` cannot create approving
  PR reviews due to a GitHub platform restriction.
- **Security & supply-chain.** Secret scanning + push protection enabled.
  CodeQL default setup configured for `actions` and `javascript-typescript`
  initially; once PR #3 merged the .NET code into `main`, default-setup
  re-detected and added `csharp`, so the live language list on `main` is
  `actions`, `csharp`, `javascript`, `javascript-typescript`, `typescript`
  (the originally-planned follow-up CS for .NET CodeQL coverage is no
  longer needed). Dependabot alerts,
  security updates, and weekly version updates enabled for `npm`, `nuget`,
  and `github-actions` ecosystems. Private Vulnerability Reporting enabled.
- **Governance.** Added public-facing `SECURITY.md`, `CONTRIBUTING.md`
  (with the `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`
  trailer requirement), `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1),
  `.github/pull_request_template.md`, `.github/CODEOWNERS`,
  `.github/ISSUE_TEMPLATE/bug_report.md`, and
  `.github/ISSUE_TEMPLATE/feature_request.md`.
- **Architecture baseline.** `ARCHITECTURE.md` v1 documents game design,
  engine vs. game split, .NET 8 isolated Functions backend, Azure topology
  (RG `rg-sub-invaders-prod`, isolation invariant, idempotency-via-tag,
  cleanup contract), CI/CD pipeline, and CS02–CS04 forward scope.
- **Composed local blocks.** Customised `conventions.project`,
  `operations.project-deploy`, and `reviews.project-gates` with project-
  specific JS+.NET conventions, SWA/Functions deploy procedures, and review
  gates.
- **CI/CD.** Added `.github/workflows/ci.yml` (Node 20 + .NET 8 matrix:
  `harness lint`, `harness sync --mode=check`, `node --test`, `dotnet test`),
  `.github/workflows/swa-deploy.yml` (Azure Static Web Apps deploy),
  `.github/workflows/workboard-auto-approve.yml`, and
  `.github/dependabot.yml`.
- **Azure provisioning script.** Added `infra/provision.sh` — RG-first creation,
  `workload=sub-invaders` tag verification, every `az ... create` scoped to
  `--resource-group "$RG_NAME"`, RG-scoped Budget (`$5/month`, alerts at
  50/80/100% via Action Group), env-var override surface
  (`RG_NAME`/`RG_LOCATION`/`STORAGE_ACCT_NAME`/`SWA_NAME`/`BUDGET_AMOUNT`/
  `BUDGET_ALERT_EMAIL`), fail-closed error handling. (Execution is gate G4 —
  not invoked as part of this PR; runs locally against the user's Azure
  subscription.)
- **Stub frontend.** `src/index.html` — minimal accessible "coming soon"
  page; no JS, no canvas, no engine imports.
- **Stub backend.** `api/` project — .NET 8 isolated Functions worker with
  `HealthFunction.cs` returning HTTP 200 + `{"status":"ok"}` for
  `GET /api/health`. xUnit test project at `api/Sub-invaders.Api.Tests/`
  with at least one passing test.
- **Repo hygiene.** Added `.gitattributes` (`text=auto eol=lf`) so all
  contributors check out LF regardless of `core.autocrlf` (LRN-006/018/065).
  Replaced `harness.config.json` placeholders with real sub-invaders values
  (`project.name`, `agent_suffix=si`, `repo`, `templating.*`, `constraints`).
- **Harness pin bump.** Bumped `harness.config.json` from `v0.1.0` to
  `v0.3.1` to pick up upstream fixes (deps gap, text-encoding gitignore
  awareness, architecture linter error message). Originally CS04 task #1;
  brought forward because the v0.1.0 deps gap blocks CI.

### Pending (gated on user actions)

- **G3: workboard-auto-approve App install.** Not blocking (CS01 PRs were all
  human/admin-merged). Should be installed before CS02 so workboard-only PRs
  auto-merge cleanly. Install via
  https://github.com/apps/workboard-auto-approve → Configure → choose
  `henrik-me/sub-invaders`.

### Notes
- This is the LRN-101 changelog pilot pattern: each closed CS appends one
  entry under `## [Unreleased]`, grouped by `Added / Changed / Fixed /
  Removed`. Release tags will be cut from `main` when v1.0 ships
  (after CS04 per the workboard plan).

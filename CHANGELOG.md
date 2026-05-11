# Changelog

All notable changes to Sub Invaders are documented in this file.

The format follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
once a tagged release exists.

## [Unreleased]

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
  (the languages GitHub auto-detected as eligible on this repo); `csharp`
  coverage for the `api/` Functions project is a planned follow-up CS
  because GitHub's default-setup endpoint does not currently surface it.
  Dependabot alerts,
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

### Pending (gated on user actions, will land in CS01 close-out PR)

- **Azure resources** (G4) — user runs `infra/provision.sh` to create
  `rg-sub-invaders-prod`, Storage account, Static Web App, Action Group,
  Budget.
- **First SWA deploy + smoke probe** (G5) — user pastes
  `AZURE_STATIC_WEB_APPS_API_TOKEN` into Actions secrets; `swa-deploy.yml`
  publishes to staging; verify-deploy or curl confirms `/` and
  `GET /api/health` return HTTP 200.

### Notes
- This is the LRN-101 changelog pilot pattern: each closed CS appends one
  entry under `## [Unreleased]`, grouped by `Added / Changed / Fixed /
  Removed`. Release tags will be cut from `main` when v1.0 ships
  (after CS04 per the workboard plan).

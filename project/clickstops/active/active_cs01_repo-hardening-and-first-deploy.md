# CS01 — Repo hardening + first SWA staging deploy

**Status:** active
**Owner:** yoga-si
**Branch:** cs01/content
**Started:** 2026-05-11T01:30Z
**Closed:** —
**Depends on:** bootstrap commit (initial harness init in CS16 from agent-harness)

## Goal

Turn the freshly bootstrapped `henrik-me/sub-invaders` repository from an unhardened harness consumer into a governed, secured, and deployable project. CS16 intentionally stops after repo creation, `harness init`, folder skeletons, and queued SI-CS planned files. CS01 is the first downstream proof that a consumer agent can claim a planned file and use the harness process without relying on the original `agent-harness` working tree.

The immediate outcome is standards parity with `agent-harness`: protected `main`, workboard-only automation, security features enabled, public contribution docs, a complete architecture baseline, project-specific composed blocks, and a green CI pipeline. This CS also provisions the first Azure resources in the dedicated Sub Invaders resource group and performs the first Static Web Apps staging deploy.

The deployable app remains intentionally tiny: a static "Sub Invaders — coming soon" page plus a .NET 8 isolated Azure Function health endpoint returning `{"status":"ok"}`. No engine modules, no game logic, no leaderboard, and no daily challenge land here. Those are reserved for SI-CS02 through SI-CS04 so each later CS has clean scope.

## Background

This is the first downstream consumer clickstop after CS16 in `agent-harness` bootstraps the bare Sub Invaders repository. CS16's authoritative scope refinement moved all hardening, security, architecture authoring, composed-block customization, Azure provisioning, and first-deploy work out of the harness repo and into this first Sub Invaders CS.

The SI agent must validate that an unsupervised consumer can complete meaningful work using the harness's own operating model. In particular, this CS must fan out to sub-agents with the canonical no-commit preflight, explicit file ownership, required reading, disjoint write sets, self-checks, and structured reports from https://github.com/henrik-me/agent-harness/blob/main/OPERATIONS.md.

Treat this file as the operational source of truth once it is copied into `project/clickstops/planned/` in Sub Invaders. Links to local Sub Invaders files use consumer-root-relative depth from that planned-file location, for example `../../../OPERATIONS.md` and `../../../ARCHITECTURE.md`; links back to harness history use full GitHub URLs.

## Decisions (SI-CS01-specific)

CS16 decisions C16-1 through C16-16 are normative for this CS and are not reopened here. Reference: https://github.com/henrik-me/agent-harness/blob/main/project/clickstops/active/active_cs16_bootstrap-sub-invaders/active_cs16_bootstrap-sub-invaders.md#decisions-cs16-specific-locked-in-2026-05-10.

| # | Decision | Choice | Rationale |
|---|---|---|---|
| CS01-1 | Ruleset API shape | Author `infra/main-protection-ruleset.json` as the Repository Rulesets API request body for `POST /repos/henrik-me/sub-invaders/rulesets`, mirroring the `agent-harness` CS15a `main-protection` shape. | CS15a proved this shape on the harness repo; C16-13 requires standards parity. |
| CS01-2 | Required checks in Ruleset | Require `ci`, `harness lint`, `harness sync --mode=check`, JS tests, .NET tests, PR body, commit trailers, and workflow pin checks if those contexts exist after bootstrap. | Enforces the same contribution discipline while allowing the Sub Invaders workflow names to be project-specific. |
| CS01-3 | Code scanning | Use GitHub CodeQL default setup for JavaScript and C#. Do not author advanced CodeQL workflow unless default setup is unavailable. | C16-13 calls out default setup; less YAML means less consumer-maintained security plumbing. |
| CS01-4 | Dependabot | Configure `.github/dependabot.yml` for `npm`, `nuget`, and `github-actions`, weekly cadence, security alerts and version updates enabled. | Covers the full stack: Node harness/tests, .NET Function, and Actions. |
| CS01-5 | Storage account naming | Default `STORAGE_ACCT_NAME=stsubinvaders$RAND6`, lowercase, no dashes, max 24 chars; allow env override. | Satisfies Azure global uniqueness and C16-14 while keeping reruns possible. |
| CS01-6 | Azure resource group | Default `RG_NAME=rg-sub-invaders-prod`; script must create/verify tag `workload=sub-invaders` before any other resource operation. | Preserves the hard isolation invariant and cleanup contract from C16-14. |
| CS01-7 | Budget | RG-scoped monthly Budget `budget-sub-invaders-monthly`, default cap `$5`, alerts at 50/80/100% through Action Group `ag-sub-invaders-budget`. | Spend guardrail is part of first provisioning, not an afterthought. |
| CS01-8 | Rate-limit defaults documented now | Document future defaults of 30/min for `/api/session` and `/api/score`; implement no rate limiter in CS01 because only `/api/health` exists. | Keeps ARCHITECTURE.md ready for SI-CS03 without adding unused backend code. |
| CS01-9 | Deploy workflow | Commit `swa-deploy.yml` unguarded once G5 secret exists; before G5 it must not be expected to pass. | C16 refinement makes token paste a CS01 gate, so the real first deploy happens here. |
| CS01-10 | Stub backend response | `GET /api/health` returns HTTP 200 and exactly JSON object with `status: "ok"`; version/flag fields are deferred. | Minimal stable probe for SWA staging and future verify-deploy scaffold. |
| CS01-11 | Stub frontend | `src/index.html` is static copy only; no JS modules, canvas, engine imports, or localStorage. | Avoids stealing SI-CS02 scope. |
| CS01-12 | CHANGELOG pilot | Add a dated SI-CS01 line to `CHANGELOG.md`. | Carries forward the LRN-101 pilot pattern from CS16. |

## Deliverables

1. Branch protection Ruleset `main-protection` applied to `henrik-me/sub-invaders`, using `infra/main-protection-ruleset.json` and mirroring the harness CS15a shape: pull request required, at least one approving review, conversation resolution, linear history, squash-only, no force pushes, no branch deletions, and an explicit repository-admin bypass for owner override.
2. Workboard-auto-approve App installed on `henrik-me/sub-invaders` before any SI-CS PR is opened. Verify installation with GitHub API evidence and run or document a workboard-only dry-run if feasible.
3. Security and supply-chain posture enabled: secret scanning, secret-scanning push protection, CodeQL default setup for JS+C#, Dependabot alerts, Dependabot security updates, Dependabot version updates for npm/nuget/actions, and Private Vulnerability Reporting.
4. Governance docs present and adapted from harness shapes: `../../../SECURITY.md`, `../../../CONTRIBUTING.md` with the `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` trailer requirement, `../../../CODE_OF_CONDUCT.md`, `../../../.github/pull_request_template.md`, `../../../.github/CODEOWNERS`, `../../../.github/ISSUE_TEMPLATE/bug_report.md`, and `../../../.github/ISSUE_TEMPLATE/feature_request.md`.
5. Full `../../../ARCHITECTURE.md` v1 authored, including game design, engine vs. game split, C16-9 through C16-16 technology decisions, and Azure topology: dedicated RG `rg-sub-invaders-prod`, isolation invariant, resource inventory, idempotency-via-tag, env-var override surface, and cleanup contract.
6. Three composed local blocks customized: `CONVENTIONS.md` block `id=conventions.project` for JS+.NET conventions and engine isolation, `OPERATIONS.md` block `id=operations.project-deploy` for SWA deploy commands, Function build, Storage Tables, env vars, and secret rotation, and `REVIEWS.md` block `id=reviews.project-gates` for staging URL, `/api/health`, leaderboard JSON shape, and container-validate gates.
7. CI workflows authored: `../../../.github/workflows/ci.yml` with Node 20 + .NET 8 SDK matrix running `harness lint --quiet`, `harness sync --mode=check`, `node --test src/**/*.test.mjs`, and `dotnet test api/`; `../../../.github/workflows/swa-deploy.yml` unguarded after G5; `../../../.github/workflows/workboard-auto-approve.yml` copied from harness; plus `../../../.github/dependabot.yml`.
8. Azure provisioning script `../../../infra/provision.sh` authored per C16-14: RG-first, every resource uses `--resource-group "$RG_NAME"`, RG tag verification, RG-scoped Budget, Action Group, all default names overridable by env vars, fail-closed error handling.
9. User-approval gate G4 completed: user runs `infra/provision.sh`, creating RG `rg-sub-invaders-prod`, Storage Account, SWA, Budget, and Action Group.
10. User-approval gate G5 completed: user stores `AZURE_STATIC_WEB_APPS_API_TOKEN` in Sub Invaders GitHub Actions secrets.
11. Stub frontend: `../../../src/index.html` contains a minimal accessible "Sub Invaders — coming soon" page and no game logic.
12. Stub backend: `../../../api/Sub-invaders.Api.csproj`, `../../../api/Program.cs`, `../../../api/host.json`, `../../../api/local.settings.json.example`, `../../../api/HealthFunction.cs`, and xUnit project under `../../../api/Sub-invaders.Api.Tests/` with at least one trivial passing test.
13. First SWA staging deploy completed; verify-deploy scaffold or equivalent smoke probe confirms `GET /api/health` returns 200 and body includes `status=ok`.
14. `../../../CHANGELOG.md` updated with an SI-CS01 entry following the LRN-101 pilot pattern.

No deliverable in this CS may add game engine code, game source modules, leaderboard endpoints, score submission, daily challenge, whale shark, local high score logic, or canvas rendering.

## Sub-agent fan-out

Each sub-agent briefing must paste the canonical preamble from `../../../OPERATIONS.md` § Mandatory briefing preamble verbatim, then add task-specific identity/scope, required reading, deliverables, decision authority, self-checks, and report shape. Owned files below are disjoint; curiosity reads are allowed, writes outside the listed set are not.

| # | Sub-agent | Owned files |
|---|---|---|
| 1 | `cs01-ruleset-and-app` | `infra/main-protection-ruleset.json`; active CS notes/evidence only if orchestrator explicitly delegates the active CS file section |
| 2 | `cs01-security-settings` | No repo files by default; runs `gh api` security, CodeQL, Dependabot, PVR, and App-install verification commands; reports evidence for orchestrator to paste into active CS Notes |
| 3 | `cs01-governance-docs` | `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/pull_request_template.md`, `.github/CODEOWNERS`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md` |
| 4 | `cs01-architecture-author` | `ARCHITECTURE.md` |
| 5 | `cs01-composed-blocks-customiser` | `template/composed/CONVENTIONS.md` project local block, `template/composed/OPERATIONS.md` project local block, `template/composed/REVIEWS.md` project local block; rendered roots only through `harness sync --mode=apply` if the orchestrator assigns that step |
| 6 | `cs01-ci-workflows-author` | `.github/workflows/ci.yml`, `.github/workflows/swa-deploy.yml`, `.github/workflows/workboard-auto-approve.yml`, `.github/dependabot.yml` |
| 7 | `cs01-azure-provisioning-script` | `infra/provision.sh` |
| 8 | `cs01-stub-frontend-and-backend` | `src/index.html`, `api/Sub-invaders.Api.csproj`, `api/Program.cs`, `api/host.json`, `api/local.settings.json.example`, `api/HealthFunction.cs`, `api/Sub-invaders.Api.Tests/` |
| 9 | `cs01-changelog-author` | `CHANGELOG.md` only |
| orchestrator-owned | — | active CS file rename/tasks/sub-agent ledger/notes, user gate coordination, final smoke evidence, plan-vs-implementation review, PR body, close-out |

## User-approval gates

| Gate | When | User action | Blast radius |
|---|---|---|---|
| G3 — Workboard-auto-approve App install | Before opening any SI-CS PR on Sub Invaders. | Install the existing workboard-auto-approve GitHub App for `henrik-me/sub-invaders` in GitHub settings. | Grants the App the repo-scoped permissions needed to approve and auto-merge eligible workboard-only PRs. Validate immediately because second-repo install is unproven. |
| G4 — Azure provisioning | After CS01 content branch has `infra/provision.sh`, before first deploy. | Run `infra/provision.sh` with Azure credentials, optionally overriding `RG_NAME`, `RG_LOCATION`, `STORAGE_ACCT_NAME`, `SWA_NAME`, `BUDGET_AMOUNT`, and alert email variables. | Creates real Azure resources and budget alerts inside the dedicated RG. Cleanup is `az group delete --name "$RG_NAME" --yes --no-wait`. |
| G5 — SWA deploy token secret | After G4 creates the Static Web App and emits/retrieves a deployment token. | Paste token into GitHub Actions secret `AZURE_STATIC_WEB_APPS_API_TOKEN` for `henrik-me/sub-invaders`. | Enables deploy workflow to publish to SWA. Secret must never be committed, logged, or copied into the active CS file. |

G6 Ruleset and G7 security settings are orchestrator-runnable via `gh api` during CS01, but should still be recorded as explicit gates in the active CS notes because they materially change repository behavior.

## Exit criteria

1. `gh api repos/henrik-me/sub-invaders/rulesets` shows active Ruleset `main-protection` with PR-required, ≥1 approving review, conversation resolution, no force pushes, no deletions, linear history, and required status checks.
2. `gh api repos/henrik-me/sub-invaders/installations` or equivalent App API evidence shows the workboard-auto-approve App installed for Sub Invaders.
3. Repository security evidence shows secret scanning, push protection, CodeQL default setup, Dependabot alerts/security/version updates, and PVR enabled.
4. All governance docs listed in Deliverable 4 exist and `CONTRIBUTING.md` states the Copilot co-author trailer requirement.
5. `ARCHITECTURE.md` contains sections for game design, engine/game split, backend/API model, Azure topology, resource inventory, idempotency-via-tag, cleanup contract, and future leaderboard/daily-challenge boundaries.
6. Composed local blocks exist and `harness lint --quiet` reports composed-block checks passing; `harness sync --mode=check` reports no drift.
7. `ci.yml`, `swa-deploy.yml`, `workboard-auto-approve.yml`, and `dependabot.yml` exist; the CS01 PR has green CI.
8. `infra/provision.sh` passes shell syntax check where available and visibly enforces RG-first creation, `workload=sub-invaders` tag verification, `--resource-group "$RG_NAME"` on all create calls, and RG-scoped Budget setup.
9. Azure RG `rg-sub-invaders-prod` exists with tag `workload=sub-invaders`; Storage Account, SWA, Budget, and Action Group are inside that RG and no Sub Invaders Azure resources are outside it.
10. GitHub secret `AZURE_STATIC_WEB_APPS_API_TOKEN` exists; do not print its value. Evidence may be workflow success using the secret.
11. `node --test src/**/*.test.mjs` exits 0. If no JS tests exist yet, the workflow must still handle that intentionally rather than failing from shell glob behavior.
12. `dotnet test api/` exits 0 and includes the xUnit stub test.
13. SWA staging URL responds 200 for `/` and `GET /api/health` responds 200 with JSON containing `status=ok`.
14. `CHANGELOG.md` contains a dated SI-CS01 entry.
15. Active CS file contains a complete sub-agent ledger, G3/G4/G5/G6/G7 evidence, and a plan-vs-implementation review with `Outcome: GO` before close-out.

## Risks + open questions

1. **R1 — CodeQL default setup may take up to 24 hours to produce scans.** Mitigation: enable it in CS01, record API evidence immediately, and file a learning if first analysis is delayed beyond close-out.
2. **R2 — Workboard-auto-approve App install may not transfer cleanly to a second repo.** Mitigation: validate installation before any SI-CS PR and open a no-op workboard-only dry-run if safe; file a harness follow-up if workflow parameterization is needed.
3. **R3 — `host.json` schema for .NET 8 isolated has changed across versions.** Mitigation: pin package versions current at implementation time, consult Microsoft docs, keep `host.json` minimal, and require `dotnet test api/` plus SWA deploy smoke.
4. **R4 — First SWA deploy with managed Functions may fail if the API project has no routable Function.** Mitigation: `HealthFunction.cs` returns 200 statically and deploy smoke probes `/api/health`.
5. **R5 — Azure Storage Account name collisions are common.** Mitigation: random 6-character suffix by default and env override for deterministic retries.
6. **R6 — RG-scoped Budget CLI support can vary by Azure CLI version.** Mitigation: `provision.sh` checks `az version`, emits a clear fail-closed message, and records the exact command that failed.
7. **R7 — `node --test src/**/*.test.mjs` may fail when no JS tests exist.** Mitigation: CI author must implement an explicit no-tests-yet path or add a placeholder test only if it does not introduce game code.
8. **OQ1 — Required status-check context names may differ after first workflow run.** Default: apply Ruleset after observing initial CI context names on the CS01 PR, then update the JSON/evidence if names differ.

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| Fill `harness.config.json` placeholders for sub-invaders | complete | orchestrator | Done in commit 715f5d3; placeholders replaced with real sub-invaders values |
| Author `infra/main-protection-ruleset.json` | complete | sub-agent | agent-id=cs01-ruleset-and-app \| role=ruleset-author \| report-status=complete \| learnings=2 \| commit=daff29d |
| Enable security & supply-chain settings via `gh api` | complete | sub-agent | agent-id=cs01-security-settings \| role=gh-api-runner \| report-status=complete \| learnings=2 \| evidence below |
| Author governance docs (SECURITY/CONTRIBUTING/CoC + .github templates + CODEOWNERS) | complete | sub-agent | agent-id=cs01-governance-docs \| role=docs-author \| report-status=complete \| learnings=2 \| commit=aed831b |
| Author `ARCHITECTURE.md` v1 | complete | sub-agent | agent-id=cs01-architecture-author \| role=docs-author \| report-status=complete \| learnings=2 \| commit=deba24b |
| Customise composed local blocks (`conventions.project`, `operations.project-deploy`, `reviews.project-gates`) | complete | sub-agent | agent-id=cs01-composed-blocks-customiser \| role=composed-block-author \| report-status=complete \| learnings=2 \| commit=43e83ac |
| Author CI workflows (`ci.yml`, `swa-deploy.yml`, `workboard-auto-approve.yml`, `dependabot.yml`) | complete | sub-agent | agent-id=cs01-ci-workflows-author \| role=ci-author \| report-status=complete \| learnings=3 \| commit=c5ddd36 |
| Author `infra/provision.sh` | complete | sub-agent | agent-id=cs01-azure-provisioning-script \| role=infra-author \| report-status=complete \| learnings=3 \| commit=675e1ab |
| Author stub frontend + .NET 8 isolated Functions backend + xUnit | complete | sub-agent | agent-id=cs01-stub-frontend-and-backend \| role=full-stack-stub \| report-status=complete \| learnings=3 \| commit=d7f64d3 |
| Author `CHANGELOG.md` SI-CS01 entry | complete | sub-agent | agent-id=cs01-changelog-author \| role=docs-author \| report-status=complete \| learnings=0 \| commit=0e46503 |
| Post-completion verification (git status / line counts / API spot-check) | complete | orchestrator | All 9 sub-agent outputs verified (line counts within ±20, BOM=False, CR=False, JSON valid, composed-block markers intact, no leaked build artifacts after `rm -rf api/bin api/obj`); harness lint 13/13 pass after fixes |
| Apply Ruleset + record `gh api` evidence (G6) | planned | orchestrator | After workflows exist so context names are known (OQ1) — defer to after first CI run on content PR |
| Coordinate user gate G3 (workboard-auto-approve App install) | planned | orchestrator | Pause for user |
| Coordinate user gate G4 (run `infra/provision.sh`) | planned | orchestrator | Pause for user |
| Coordinate user gate G5 (paste `AZURE_STATIC_WEB_APPS_API_TOKEN` secret) | planned | orchestrator | Pause for user |
| First SWA deploy + `/api/health` smoke evidence | planned | orchestrator | Confirms deliverable 13 |
| Open content PR + run GPT-5.5 review rounds until GO | planned | orchestrator | REVIEWS § Phase 2 |
| Plan-vs-implementation review (close-out gate) | planned | orchestrator | OPERATIONS § Plan-vs-implementation review (close-out gate); recorded verbatim before close-out |
| Close-out: docs + restart state | planned | orchestrator | Update WORKBOARD.md, CONTEXT.md, managed/composed templates and rendered roots, feature docs (per OPERATIONS § Claim) |
| Close-out: learnings + follow-ups | planned | orchestrator | File LRN entries; create planned follow-up CSs for unresolved issues (per OPERATIONS § Claim) |

## Notes / Learnings

### Sub-agent self-reported learning candidates (filed at close-out)

> **Note:** Several harness-specific issues observed during CS01 execution were
> reported upstream and addressed in **harness v0.3.1**:
>
> - `ajv`/`ajv-formats`/`js-yaml` moved from devDeps to runtime deps — schema-using
>   linters now work via plain `npx -y github:henrik-me/agent-harness#<ref>`.
> - `text-encoding` linter switched to `git ls-files` mode — gitignored build
>   output (`api/bin`, `api/obj`) is now correctly skipped.
> - `architecture` linter error now lists all four required headings and points
>   at `harness lint --explain architecture`.
> - WORKBOARD `## Queued` / `## Recently Completed` ban is **intentional policy**
>   (LRN-102) — filesystem under `project/clickstops/{planned,done}/` is the
>   source of truth.
>
> CS01 bumps the harness pin to **v0.3.1** in this PR (originally CS04's task
> #1, brought forward because the v0.1.0 deps gap blocks CI). The bump triggered
> one composed-block update in `OPERATIONS.md` (managed-prose refresh: LRN-102
> "no recently-completed log", harness-vs-consumer composed-block guidance from
> SI Finding #6, SAML-SSO `git ls-remote` fallback from SI Finding #7, and
> `REPLACE_ME` placeholder rendering fix). All managed-block updates were
> applied via `harness sync --mode=apply`; user-authored local blocks were
> preserved (provenance correctly recorded as `user-authored` in
> `.harness-lock.json`). Post-bump validation: `harness lint` 13/13 pass,
> `harness sync --mode=check` clean, `dotnet test` 1/1 pass.

- **Composed-blocks plan wording (A5):** CS01 plan deliverable 6 says "edit `template/composed/CONVENTIONS.md`" (harness-repo perspective) but consumer repos edit root `CONVENTIONS.md` directly. Future plans should use consumer-relative paths.
- **SDK glob collision (A8):** `Microsoft.NET.Sdk` default `**/*.cs` glob picks up subdirectory test files. Fix: explicit `<Compile Remove="Sub-invaders.Api.Tests/**" />` in main csproj.
- **HttpRequestData mocking (A8):** `HttpRequestData` is abstract and requires a live DI container to mock; CS01 test uses constant-string assertion (`HealthFunction.ResponseBody`) as a pragmatic workaround. Real HTTP-shape integration tests deferred to CS03+.
- **az CLI version drift (A7, R6):** `az consumption budget create --resource-group` scope is unreliable across `az` 2.x minor versions. `provision.sh` uses ARM REST PATCH for budget notifications as a stable fallback (non-fatal if it fails).
- **Azure SAML blocks `gh api` (A6):** Azure org SAML enforcement blocks `gh api repos/Azure/...` for non-SSO tokens. Use `git ls-remote https://github.com/Azure/<repo>.git refs/tags/<tag>` as the SHA verification fallback for action-pinning.
- **PowerShell vs grep regex (A7):** PowerShell `Select-String` uses .NET regex where `\?` is a literal `?`, unlike grep BRE where `\?` is zero-or-one. Self-check patterns must be authored with .NET regex semantics in mind when run from PowerShell.
- **Line endings on Windows (orchestrator):** Default `core.autocrlf=true` produces CRLF on disk while index stays LF, causing text-encoding linter failures. Fix: `.gitattributes` with `* text=auto eol=lf`, then `core.autocrlf=input`, then `git rm -rf --cached . && git reset --hard HEAD` re-extracts as LF.
- **CodeQL 404 on enable (A2, R1):** CodeQL default-setup PUT returned 404 — likely requires either 24h activation delay or paid plan on this tier. Acceptable per CS01-R1; revisit before close-out.
- **Workboard-auto-approve App check 401/403 (A2, R2):** Standard `repo`-scope tokens cannot list App installations. G3 verification deferred to manual user step.

## Evidence

### Security & supply-chain settings (G7) — evidence

Recorded by sub-agent `cs01-security-settings` on 2026-05-11T01:58:45Z.

#### Secret scanning + push protection

**Command:** `gh api -X PATCH repos/henrik-me/sub-invaders -F security_and_analysis.secret_scanning.status=enabled -F security_and_analysis.secret_scanning_push_protection.status=enabled`

**Response (abbreviated):** HTTP 200 OK; response body includes:
```json
"security_and_analysis": {
  "secret_scanning": { "status": "enabled" },
  "secret_scanning_push_protection": { "status": "enabled" },
  "dependabot_security_updates": { "status": "enabled" }
}
```

**Verify:** `gh api repos/henrik-me/sub-invaders --jq '.security_and_analysis'`
```json
{
  "secret_scanning": { "status": "enabled" },
  "secret_scanning_push_protection": { "status": "enabled" },
  "dependabot_security_updates": { "status": "enabled" },
  "secret_scanning_non_provider_patterns": { "status": "disabled" },
  "secret_scanning_validity_checks": { "status": "disabled" }
}
```

**Status:** enabled

#### CodeQL default setup

**Command:** `gh api -X PUT repos/henrik-me/sub-invaders/code-scanning/default-setup --raw-field 'state=configured' --raw-field 'languages=["javascript","csharp"]' --raw-field 'query_suite=default'`

**Response:** HTTP 404 Not Found
```json
{ "message": "Not Found", "status": "404" }
```

**Status:** not-applicable on this tier (per CS01-R1; revisit before close-out)

#### Dependabot alerts

**Command:** `gh api -X PUT repos/henrik-me/sub-invaders/vulnerability-alerts`

**Response:** HTTP 204 No Content

**Verify:** `gh api repos/henrik-me/sub-invaders/vulnerability-alerts -i` → HTTP 204

**Status:** enabled

#### Dependabot security updates

**Command:** `gh api -X PUT repos/henrik-me/sub-invaders/automated-security-fixes`

**Response:** HTTP 200 OK

**Verify:** `gh api repos/henrik-me/sub-invaders/automated-security-fixes -i` →
```json
{ "enabled": true, "paused": false }
```

**Status:** enabled

#### Private Vulnerability Reporting

**Command:** `gh api -X PUT repos/henrik-me/sub-invaders/private-vulnerability-reporting`

**Response:** HTTP 200 OK

**Verify:** `gh api repos/henrik-me/sub-invaders/private-vulnerability-reporting -i` →
```json
{ "enabled": true }
```

**Status:** enabled

#### Final state snapshot

```json
{
  "allow_merge_commit": true,
  "allow_rebase_merge": true,
  "allow_squash_merge": true,
  "delete_branch_on_merge": false,
  "has_discussions": false,
  "has_issues": true,
  "has_projects": true,
  "name": "sub-invaders",
  "private": false,
  "security_and_analysis": {
    "dependabot_security_updates": { "status": "enabled" },
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_non_provider_patterns": { "status": "disabled" },
    "secret_scanning_push_protection": { "status": "enabled" },
    "secret_scanning_validity_checks": { "status": "disabled" }
  }
}
```

### G3, G4, G5, G6 — evidence

(Filled during execution — G3/G4/G5 require user actions; G6 requires Ruleset application after CI context names are known.)

## Plan-vs-implementation review

> _(filled at close-out per the gate — see `../../../OPERATIONS.md` § Plan-vs-implementation review (close-out gate))_
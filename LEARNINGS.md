# Learnings

Learnings filed during the project. See [`RETROSPECTIVES.md`](RETROSPECTIVES.md) for harvest procedure and entry format.

---

> **ID sequencing:** Use sequential IDs starting from LRN-001. The linter emits
> warnings for gaps in the sequence but treats them as non-fatal; gaps do not
> cause exit code 1.

---

## Open

### LRN-001

```yaml
id: LRN-001
date: 2026-05-11
category: tooling
source_cs: CS01
status: open
tags: [windows, bash, az-cli, encoding]
```

**Problem:** When `infra/provision.sh` was run from WSL bash on Windows with az 2.84,
every `az ... -o tsv` capture produced a value with a trailing CR character. Bash command
substitution strips trailing LF but not CR, so the captured shell variables silently
contained a stray `\r`. This broke (a) string equality compares (the RG `tags.workload`
verification rejected `'sub-invaders\r' != 'sub-invaders'`), (b) Azure resource ID
arg-passing to subsequent `az` invocations, and (c) console display formatting (the
subscription ID printed inside parentheses split across lines).

**Finding:** Windows `az.cmd` (the shim invoked by WSL bash) emits CRLF line endings
on `-o tsv` output. Bash strips LF but not CR. Mitigation: append parameter expansion
`VAR=${VAR//$'\r'/}` after every `az ... -o tsv` capture.

**Disposition:** _(open until applied to harness-side provisioning examples)_

---

### LRN-002

```yaml
id: LRN-002
date: 2026-05-11
category: tooling
source_cs: CS01
status: open
tags: [azure, budget, az-cli, api-version]
```

**Problem:** `az consumption budget create --resource-group ...` returned HTTP 400
"Invalid budget configuration, please use filter interface with 2019-05-01-preview
version" for valid bodies on az 2.84 — even though the CS01 plan's R6 risk note
asserted RG-scope was supported in az ≥ 2.50. The CLI sub-group (`az consumption`)
is in preview and its body shape has drifted.

**Finding:** Don't go through `az consumption budget create` for budget provisioning.
Use `az rest --method PUT` against `Microsoft.Consumption/budgets/{name}`
(api-version=2023-05-01) directly — it accepts both budget body and notifications in
one idempotent request, and the ARM REST surface is far more stable than the preview
CLI sub-group. Pattern shipped in `infra/provision.sh` post-PR #13.

**Disposition:** _(open until applied to harness-side provisioning examples)_

---

### LRN-003

```yaml
id: LRN-003
date: 2026-05-11
category: architectural
source_cs: CS01
status: open
tags: [github, actions, github-token, app, permissions]
```

**Problem:** Round-1 GPT-5.5 review of PR #3 caught that `workboard-auto-approve.yml`
was attempting to do `gh pr review --approve` followed by `gh pr merge` using the
built-in `GITHUB_TOKEN`. This would have failed in production with HTTP 422
"GitHub Actions is not permitted to approve pull requests" — a hard GitHub platform
restriction.

**Finding:** `GITHUB_TOKEN` cannot create approving PR reviews under any
circumstances; an installed GitHub App is the only mechanism for automated approval.
The `workboard-auto-approve` workflow in this repo is therefore validation-only
(actor allowlist + paths-changed allowlist + comment); the actual approve+merge is
done by the `workboard-auto-approve` GitHub App after install (gate G3).

**Disposition:** _(open; track G3 install as a CONTEXT.md blocker)_

---

### LRN-004

```yaml
id: LRN-004
date: 2026-05-11
category: tooling
source_cs: CS01
status: open
tags: [github, actions, workflows]
```

**Problem:** A file named `verify-deploy.example.yml` was placed in
`.github/workflows/` with `on: workflow_dispatch:` triggers, intending it as a
reference example (not a live workflow). GitHub Actions registered it as a live
workflow anyway and surfaced it in the Actions UI.

**Finding:** GitHub Actions auto-detects **every** `.yml` file in
`.github/workflows/` regardless of filename suffix or trigger shape. Reference /
example workflows must live outside that directory (e.g.,
`.github/workflow-examples/`) to avoid being treated as live.

**Disposition:** _(open; pattern adopted in this repo as
`.github/workflow-examples/verify-deploy.example.yml`)_

---

### LRN-005

```yaml
id: LRN-005
date: 2026-05-11
category: process
source_cs: CS01
status: open
tags: [harness, composed-blocks, prose]
```

**Problem:** During CS01 R2 review, a doc inconsistency was found in
`OPERATIONS.md` and `REVIEWS.md` — but those passages turned out to live
**outside** the `harness:local-*` markers, i.e., in harness-managed prose.
Editing them from a consumer repo would be reverted on the next
`harness sync --mode=apply`.

**Finding:** Always check whether a target line is inside a `harness:local-*`
marker before editing a composed file from a consumer repo. Composed-file local
block boundaries in this repo: `OPERATIONS.md` lines 1079-1139 (id
`operations.project-deploy`); `REVIEWS.md` lines 261-294 (id
`reviews.project-gates`); `CONVENTIONS.md` id `conventions.project`. Anything
outside those markers must be filed upstream as harness-feedback rather than
patched locally.

**Disposition:** _(open; one such item is currently open upstream — see
CONTEXT.md "Blockers / open questions")_

---

### LRN-006

```yaml
id: LRN-006
date: 2026-05-11
category: tooling
source_cs: CS01
status: open
tags: [github, status-checks, branch-protection]
```

**Problem:** When configuring the `main-protection` Ruleset's required status
checks, it was tempting to copy the context names as displayed by
`gh pr checks` (which prefixes `ci/` to many of them). Those prefixed names
would not have matched what GitHub's status-check API actually records, and
the Ruleset's required-checks gate would never satisfy.

**Finding:** Real status-check context names from the Checks API are bare
strings (`ci`, `harness-lint`, `js-tests`, etc.) **without** any workflow-name
prefix. The `ci/` prefix in `gh pr checks` output is a `gh` CLI display
artefact (it prepends the workflow name when there are multiple jobs), not
part of the GitHub API contract. Always verify required-check context names
via `gh api repos/<owner>/<repo>/commits/<sha>/check-runs --jq '.check_runs[].name'`
before encoding them in a Ruleset.

**Disposition:** _(open)_

---

### LRN-007

```yaml
id: LRN-007
date: 2026-05-11
category: tooling
source_cs: CS01
status: open
tags: [github, codeql, default-setup, language-detection]
```

**Problem:** During CS01 plan-vs-impl close-out gate, enabling CodeQL default
setup with `csharp` returned HTTP 422 "not present in the repository" even
though `api/Program.cs`, `api/HealthFunction.cs`, and the test project all
existed on the working branch. A planned follow-up CS was filed for advanced
CodeQL coverage of .NET. Within the same close-out window — once PR #3 (with
the .NET code) merged to `main` — the CodeQL Setup workflow auto-detected
`csharp` without further intervention.

**Finding:** GitHub CodeQL default-setup language auto-detection runs against
the **default branch's contents**, not the branch being PATCHed against. When
enabling default setup via API on a brand-new repo, languages are gated on
what's already on `main`. Either (a) wait until all language-relevant code is
on `main` before PATCHing, or (b) PATCH twice — once at content-PR open, once
after content-PR merge — to pick up newly-detected languages.

**Disposition:** _(open; the planned follow-up CS for .NET CodeQL coverage is
no longer needed)_

---

### LRN-008

```yaml
id: LRN-008
date: 2026-05-11
category: tooling
source_cs: CS01
status: open
tags: [azure, swa, github-actions, dependabot, secrets]
```

**Problem:** `Azure/static-web-apps-deploy@v1` failed with
`deployment_token was not provided` on every Dependabot PR (and would on
any fork PR), surfacing as a red `build-and-deploy` check on PRs #4..#12.
GitHub does not pass repo secrets to workflows triggered by
`pull_request` events from `dependabot[bot]` or from forks, so
`${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}` evaluated to an empty
string.

**Finding:** Pass `skip_deploy_on_missing_secrets: true` on the SWA action
(both `action: upload` and `action: close` jobs). When the token is
present, behaviour is unchanged; when absent, the action prints a clear
"skipped (no token)" message and the check goes green. This is the
Azure-recommended pattern for Dependabot/fork PRs and avoids visual noise
on otherwise-passing PRs. Pattern shipped in `swa-deploy.yml` post-PR #15.

**Disposition:** _(open until applied to harness-side SWA deploy template)_

---

### LRN-009

```yaml
id: LRN-009
date: 2026-05-11
category: process
source_cs: CS01
status: open
tags: [dependabot, rebase, multi-bump]
```

**Problem:** During post-CS01 Dependabot triage, issuing
`@dependabot rebase` on a multi-bump PR (#9: `Microsoft.Azure.Functions.Worker`
+ 2 others) while another rebase was already in flight — and while the
single-bump sibling PR (#10: `Microsoft.Azure.Functions.Worker.Sdk`) was
still open — caused Dependabot to auto-close the multi-bump PR with
`Looks like this PR is closed.` and not recreate it.

**Finding:** Don't pile `@dependabot rebase` commands on the same PR or
on overlapping multi/single PRs in quick succession. If a multi-bump PR
gets auto-closed in this race, Dependabot will not always recreate it
(at least not until the next scheduled run); fall back to a manual PR
that bumps the same set of packages so main doesn't get stuck on a mixed
major-version configuration. Pattern: branch off `main`, edit the
`.csproj`, commit + push + open PR with title noting the auto-closed
Dependabot PR being replaced.

**Disposition:** _(open)_

---

### LRN-010

```yaml
id: LRN-010
date: 2026-05-11
category: tooling
source_cs: CS01
status: open
tags: [azure, swa, free-sku, staging-environments]
```

**Problem:** Azure Static Web Apps Free SKU has a hard cap of 3 preview
environments. After CS01 close-out (PRs #13 + #14 + #15), the cap was
reached and the next push:main deploy of PR #16 failed with
`The content server has rejected the request with: BadRequest. Reason:
This Static Web App already has the maximum number of staging
environments`. Despite each PR's `close-pull-request` job firing on PR
close, Azure did not always reap the staging environment.

**Finding:** Check and clean up SWA staging environments periodically:
```
az staticwebapp environment list \
  --name swa-sub-invaders -g rg-sub-invaders-prod \
  --query "[].{name:name, sourceBranch:sourceBranch}" -o table
az staticwebapp environment delete \
  --name swa-sub-invaders -g rg-sub-invaders-prod \
  --environment-name <pr-number-or-env-name> --yes
```
The `default` environment (sourceBranch `main`) must be left alone.

**Disposition:** _(open; consider an upstream periodic cleanup workflow)_

---

### LRN-011

```yaml
id: LRN-011
date: 2026-05-11
category: tooling
source_cs: CS01
status: open
tags: [github, repo-settings, branches]
```

**Problem:** New GitHub repos default `delete_branch_on_merge` to `false`,
so merged PR head branches accumulate indefinitely. Post-CS01 the repo
had ~10 stale branches (claim, content, fixup, close-out, all merged
Dependabot branches) that had to be deleted manually with
`git push origin --delete <branch>` and `git remote prune origin`.

**Finding:** Enable `delete_branch_on_merge` early (ideally as part of
the bootstrap/CS01 deliverable set) so the repo stays clean:
`gh api -X PATCH repos/<owner>/<repo> -f delete_branch_on_merge=true`.
Done post-CS01 on this repo; consider promoting to a CS01 deliverable
upstream.

**Disposition:** _(open until added to harness-side bootstrap/CS01 plan)_

---

### LRN-012

```yaml
id: LRN-012
date: 2026-05-13
category: process
source_cs: CS02
status: open
tags: [engine, input, integration-seam, allowlist, sub-agent-fanout]
```

**Problem:** During CS02 Wave 2 the orchestrator dispatched lane 5 (player + invaders)
and lane 6 (HUD + scenes + constants) in parallel. Lane 2 (engine `input.mjs`) had
already shipped a defensive `recognizedCodes` allowlist that filtered everything other
than the movement and fire keys (`ArrowLeft/Right`, `KeyA/D`, `Space`, `KeyW`,
`ArrowUp`). Lane 6's `scenes/play.mjs` (pause on `Escape`) and `scenes/gameover.mjs`
(menu return on `KeyM`) compiled and tested fine because lane 6's tests did not exercise
the live `createInput` factory — they covered scene logic with hand-built input
snapshots. The integration gap surfaced only at orchestrator-side disk verification.

**Finding:** Engine modules with a defensive allowlist are a **silent integration seam**
when game lanes are dispatched in parallel. Two complementary mitigations:

1. The orchestrator-owned post-wave verification must include an exit code that runs
   each scene's `handleInput` against a real `createInput()` snapshot for every key the
   scene's source code references. This catches future filter gaps without requiring
   either lane to know about the other's keymap.
2. Engine `recognizedCodes` should be an **opt-out allowlist** (allow all `Key*` /
   `Arrow*` codes by default; deny only known noisy codes) rather than an opt-in one.

CS02 absorbed the immediate fix as an orchestrator integration edit (added `Escape` +
`KeyM` to the allowlist + matching test in `src/engine/input.test.mjs`, commit
`ac47542`). The opt-out-allowlist refactor is left as a future engine improvement when
the engine is extracted to `henrik-me/canvas-game-engine`.

**Disposition:** _(open until orchestrator post-wave verification is extended to cover
scene-input integration, or the engine input adapter is refactored to opt-out allowlist
semantics)_

---

### LRN-013

```yaml
id: LRN-013
date: 2026-05-13
category: process
source_cs: CS02
status: open
tags: [orchestrator, sub-agent-fanout, preflight, sha-invariant, wave-discipline]
```

**Problem:** CS02 lane 7 (`cs02-bootstrap-glue-and-score`) reported `STATUS: partial`
even though every owned-file deliverable was correct, every test passed, and encoding
was clean. The reason: the dispatch text said "preflight HEAD must equal `ac47542` and
final HEAD must equal preflight HEAD". Between dispatch and the agent's preflight check,
the orchestrator committed `2df7297` (`git mv public src/public` for the SWA upload
fix). The agent observed `2df7297` at preflight, recorded that as preflight (still
self-consistent — preflight == final), but flagged `STATUS: partial` defensively because
the dispatch text named a different SHA.

**Finding:** Orchestrator commits **inside** a wave's dispatch-to-completion window
violate the preflight-SHA invariant from a sub-agent's perspective even when the
orchestrator's commit doesn't touch any of the lane's owned files. **Rule:** orchestrator
commits belong **only between waves**, never inside a wave. If an integration fix is
discovered mid-wave (e.g. a deploy gap surfaces), the orchestrator should let the
in-flight wave finish, then commit the integration fix in the post-wave window before
dispatching the next wave.

The lane 7 deliverables turned out fine, but the false-positive `STATUS: partial`
costs trust in the report and forces the orchestrator to manually re-verify the work.

**Disposition:** _(open until reflected in OPERATIONS.md § "Sub-agent dispatch" as an
explicit "no orchestrator commits inside a wave" rule, or the dispatch preamble is
amended to allow the agent to record the actual preflight SHA without flagging partial)_

---

### LRN-014

```yaml
id: LRN-014
date: 2026-05-13
category: operational
source_cs: CS02
status: open
tags: [swa, app_location, asset-path, sub-agent-fanout]
```

**Problem:** CS02 lane 8 (`cs02-sprite-asset-author`) shipped `public/sprites.png` and
`public/sprites.licence` per the plan's sub-agent fan-out table. Tests passed, the file
existed, and the lane reported `STATUS: complete`. But CS01's SWA workflow specifies
`app_location: "src"`, which means the SWA build action only uploads files **under
`src/`**. A sibling `public/` directory at the repo root is silently excluded from the
deploy. The frontend would have rendered with a broken sprite reference until the next
deploy, with no test or linter to catch it locally.

**Finding:** Plans and lane briefs must derive asset paths from the **actual
`app_location` of the deploy workflow**, not from a generic project convention or the
plan author's assumption. CS02 absorbed the fix as `git mv public src/public` (`2df7297`)
+ relative URL update in `src/index.html`. Two follow-ups for the harness side:

1. The CS02 lane brief used `public/sprites.png` because that's the conventional asset
   directory in many SWA setups, but the workflow's `app_location` is the source of
   truth. Plans authoring asset-shipping lanes should `grep` the deploy workflow for
   `app_location` before assigning paths.
2. The CI / pre-PR check battery did not flag the upload-tree exclusion. A check that
   walks the workflow's `app_location` and asserts every static asset under `src/` is
   under `app_location` would catch this class of bug. Likely a candidate for a
   harness-side scaffold (`scripts/check-deploy-upload-tree.mjs`).

**Disposition:** _(open until either the harness scaffold lints upload-tree exclusion,
or CS plans are updated to derive asset paths from `app_location`)_

---

### LRN-015

```yaml
id: LRN-015
date: 2026-05-13
category: process
source_cs: CS02
status: open
tags: [workboard, auto-merge, branch-protection, g3-app, harness-feedback, harness-issue-138]
```

**Upstream issue:** `henrik-me/agent-harness#138` (filed during CS02; P0 / `bug`).

**Problem:** CS02's claim PR (#18) and content PR (#19) both passed all 5 required CI
status checks but the branch protection ruleset on `main` requires `≥1 approving
review` even for workboard-only PRs. The `workboard-auto-approve.yml` workflow shipped
in CS01 is **validation-only** — the actual approve + merge is done by the
`workboard-auto-approve` GitHub App (gate G3), which is **not yet installed** on
`henrik-me/sub-invaders`. Without G3, no automated path can produce an approving review,
so workboard-only PRs sit indefinitely in `BLOCKED` state. The orchestrator had to fall
back to `gh pr merge --admin --squash --delete-branch` for every workboard-only PR.

**Finding:** Two distinct items:

1. **Filed upstream as `henrik-me/agent-harness#138` (P0 / `bug`):** The harness
   workboard-only ceremony documented in OPERATIONS.md does not specify a fallback for
   the no-G3 case. The fix is either (a) a documented `--admin` ceremony, (b) an
   alternative GitHub Actions step that `gh pr merge --admin`s when the App is absent,
   or (c) a `--no-required-reviews` rule branch carve-out for workboard-only labelled
   PRs. The user must choose; CS02 surfaced 4 secondary friction items in the same
   issue (`harness lint --quiet` swallows per-check error detail, claim PR title
   regex case sensitivity, etc.).

2. **G3 install is now on the critical path for CS03+.** CS03 will introduce a new CS
   with the same three-PR shape. Without G3, every workboard-only PR (claim +
   close-out) requires manual admin-merge ceremony, which is friction the harness
   process should have eliminated. CONTEXT.md already lists G3 install as an open
   blocker.

**Disposition:** _(open until either harness#138 lands an admin-bypass fallback, or G3
is installed on `henrik-me/sub-invaders`)_

---

### LRN-016

```yaml
id: LRN-016
date: 2026-05-13
category: process
source_cs: CS02
status: open
tags: [sub-agent-fanout, chicken-and-egg, factory-pattern, injected-options]
```

**Problem:** CS02 Wave 2 had a circular ownership: lane 5 (`player.mjs`,
`invaders.mjs`) needed numeric tunables (`PLAYER.speed`, `FORMATION.rows`,
`SCORING.waveBonusMultiplier`, etc.) that lane 6 (`constants.mjs`) owned. The naïve
fix of "lane 5 reads constants.mjs, lane 6 owns it" doesn't work in parallel: at
preflight, neither file exists yet, and at completion they may have inconsistent
shape. Adding a rendezvous between lanes destroys the disjoint-write-set invariant
that makes parallel fan-out safe in the first place.

**Finding:** The pattern that unblocked Wave 2 without rendezvous:

- Every game module exposes a **factory** (`createPlayer({ opts })`,
  `createFormation({ opts })`) that accepts an `opts` object.
- Each factory bakes **its own sensible defaults** for every tunable, so the lane's
  own tests (which don't import constants.mjs) work end-to-end.
- Lane 6 supplies the **canonical** constants (frozen `PLAYER`, `FORMATION`, etc.).
- Lane 7's `main.mjs` is the **only** module that wires the canonical constants into
  the factories: `createPlayer({ opts: PLAYER })`. If lane 7 doesn't pass anything,
  the factory's bake-in defaults are still production-quality.

This pattern resolves the chicken-and-egg cleanly: lanes 5 and 6 have zero file
overlap, no rendezvous, and their tests don't depend on each other. The pattern
generalises to any parallel fan-out where one lane "owns the canonical config" and
other lanes "consume it".

**Disposition:** _(open as a recommended sub-agent dispatch pattern; consider
documenting in OPERATIONS.md § "Sub-agent dispatch" or a new "Patterns" section)_

---

### LRN-017

```yaml
id: LRN-017
date: 2026-05-13
category: tooling
source_cs: CS02
status: open
tags: [scaffold, verify-deploy, validator, html, binary]
```

**Problem:** The `scripts/verify-deploy.mjs` scaffold shipped by the harness in CS01
supports only an `expect.json(body, ctx) -> string|null` validator. CS02's deliverable
9 needed three checks against a deployed SWA: frontend root (HTML), `/api/health`
(arbitrary text/JSON), and `/public/sprites.png` (binary). None of these can be
asserted with a JSON-only validator — a `JSON.parse('<!doctype html>...')` throw would
mark the check failed for the wrong reason.

**Finding:** CS02 follow-up PR #20 extended the local `scripts/verify-deploy.mjs` to
support `expect.body(text, ctx) -> string|null` alongside the existing `expect.json`.
Body validators get the raw response text and can do regex / substring checks (e.g.
"body must contain `#game-canvas`") without the JSON-parse hop. Both validators run
if both are defined.

This extension should be ported back upstream into the harness scaffold the next time
the harness publishes scaffold updates. Sub Invaders has a working local copy; any
future consumer that scaffolds `verify-deploy` from the harness will hit the same gap.

**Disposition:** _(open until the harness scaffold is updated to ship `expect.body`
support out of the box; track as an upstream feedback item separate from harness#138)_

---

### LRN-018

```yaml
id: LRN-018
date: 2026-05-13
category: tooling
source_cs: CS09
status: open
tags: [github-actions, branch-protection, ruleset, required-checks, skipped, umbrella-job]
```

**Problem:** CS09 wired a new `coverage` job into `needs:` of an umbrella `ci` job
(the only required check on the `main` ruleset), and declared "the gate is enforced
on merge". After CS09 close-out, a sanity check against PR #34's first push (which
actually failed `coverage`) revealed the umbrella `ci` job had been reported as
`conclusion: skipped`, NOT `failure`. **GitHub treats `skipped` required status
checks as passing.** A regression in `coverage` would not have blocked merge for
non-admins; the gate was a no-op.

**Finding:** Two compounding gotchas:

1. A job with only `needs:` (no `if:` clause) is *skipped* (not failed) when any
   `needs:` dependency is `failure`. The default `if: success()` short-circuits.
2. Branch protection / rulesets count `skipped` required checks as
   passing-by-default. There is no per-context "skipped == failure" toggle.

**Mitigation (PR #37, two layers of defense):**

- Add `coverage` (and any other underlying check) **directly** to the
  ruleset's `required_status_checks` list. Don't rely on a roll-up.
- On the umbrella `ci` job, add `if: ${{ always() }}` plus a jq verifier:

  ```yaml
  ci:
    needs: [harness-lint, harness-sync-check, js-tests, dotnet-tests, coverage]
    if: ${{ always() }}
    steps:
      - name: Verify all required jobs succeeded
        run: |
          results='${{ toJSON(needs) }}'
          echo "$results" | jq -e 'all(.[]; .result == "success")' \
            || { echo "::error::A required job did not succeed (skipped or failed)."; exit 1; }
  ```

**Disposition:** _(open as a project-level CI convention; consider lifting to
CONVENTIONS.md or harness-level guidance the next time we work on shared CI
templates. Already tracked at the harness level under enforcement-gap inventory
issue henrik-me/agent-harness#145.)_

---

### LRN-019

```yaml
id: LRN-019
date: 2026-05-13
category: process
source_cs: CS09
status: open
tags: [coverage, c8, monocart, per-file, gating, single-source-of-truth, negative-test]
```

**Problem:** CS09 originally enforced only suite-level coverage totals. A new file
shipped with 0% coverage would only move the suite total down a few tenths of a
percent and slip silently through the gate. The phrase "ensure new code adheres
to these limits and is included in the calculations" required a per-file gate,
not just a suite-level one.

**Finding:** Both c8 and monocart-coverage-reports emit per-file summaries in JSON.
A small post-process script (`scripts/coverage-perfile.mjs`, ~120 lines) reads
either format, normalises file keys to repo-relative `src/...` paths, and applies
per-file thresholds with two layers:

1. **Per-file defaults** — apply automatically to every file under
   `src/{engine,game}/*.mjs`. New files inherit defaults.
2. **Per-file overrides** — explicit lower floors for specific files where dead-
   in-production code can't realistically reach the default. Each override
   carries a `_reason` string so the deviation is documented in code.

The combination keeps the gate honest without gold-plating: defaults catch
regressions and undertested new files; overrides require a deliberate, reviewable
decision for any documented exception. Suite-level totals stay enforced
*alongside* per-file (defense in depth: a uniform 1% drop across all files
would pass per-file but trip the suite total).

**Single source of truth:** `coverage-thresholds.json` at repo root holds the
suite floors, per-file defaults, and per-file overrides for both suites. The
c8 CLI flags in `package.json` and the monocart `coverage.thresholds` /
`onEnd` literal in `playwright.coverage.config.mjs` are duplicates that must
be hand-synced; the OPERATIONS.md "Coverage policy" how-to-ratchet section
lists all four locations.

**Negative-test discipline:** before declaring any new gate "enforced", run a
negative test (temporarily raise a threshold past the current value) and
confirm `rc=1` with the expected list of misses. CS09 originally skipped this
step and shipped a no-op gate (see LRN-018).

**Disposition:** _(open as a recommended pattern for any future
threshold-style gate; the per-file-with-overrides shape generalises beyond
coverage to perf budgets, bundle size, type-check error counts, etc.)_

---

### LRN-020

```yaml
id: LRN-020
date: 2026-05-13
category: architectural
source_cs: CS03
status: open
tags: [azure, swa, functions, timer-trigger, scheduling, deploy-gate]
```

**Problem:** CS03 originally shipped `SessionsCleanupFunction` as a
`[TimerTrigger("0 0 * * * *")]` (NCRONTAB hourly cron), per the CS03 plan
decision CS03-10. All local gates passed (dotnet 42/42, unit, e2e, lint,
sync) but the SWA `Azure/static-web-apps-deploy@v1` action failed in CI on
PR #47 with `Error in processing api build artifacts: the file
'functions.metadata' has specified an invalid trigger of type 'timerTrigger'
and direction 'In'. Currently, only httpTriggers are supported.` SWA
**managed Functions** (the in-platform Functions runtime that piggybacks
on the SWA App Service plan) is HTTP-only — `timerTrigger`, `queueTrigger`,
`blobTrigger`, etc. are rejected at the build-and-deploy step. The
generated `functions.metadata` file is the SWA action's input, so this is
a hard build-time gate, not a runtime soft-fail.

**Finding:** Any Functions code intended to ship under SWA managed
Functions **must** be `[HttpTrigger]`. For workloads that need a schedule
(cron cleanup, daily rollover, retention policies), expose the work as an
admin HTTP endpoint with `AuthorizationLevel.Function` (function-key
guard) and drive the cadence from outside SWA: Azure Logic App / Azure
Scheduler / GitHub Actions cron `workflow_dispatch`-able job that POSTs
with the function key (`x-functions-key` header or `?code=` query). This
matches Microsoft's own docs and is how `SessionsCleanupFunction` ships
post-fix as `POST /api/admin/sessions-cleanup`. Excluded from rate-limit
allow-list so the scheduler is not throttled. **Local validation:** `dotnet
build -c Release` then grep `bin/Release/net8.0/functions.metadata` for
`timerTrigger`/`queueTrigger`/`blobTrigger` — if any non-`httpTrigger`
appears, the SWA build will fail. Alternative if a future CS truly needs
a non-HTTP trigger: deploy that Function out-of-band as a separate
Premium / Consumption Functions app (NOT under SWA), which doubles the
infra surface but unlocks the full trigger set.

**Disposition:** _(open as a structural constraint for all future
backend work in this repo. Future `clickstop` plans must call out the
HTTP-only constraint explicitly when planning Functions, and any 'cron /
periodic' deliverable should default to admin-HTTP-endpoint + external
scheduler unless a separate Functions app is also in scope.)_

---

### LRN-021

```yaml
id: LRN-021
date: 2026-05-13
category: architectural
source_cs: CS03
status: open
tags: [azure, swa, functions, app-settings, reserved-names, storage, deploy-gate]
```

**Problem:** SWA managed Functions reserves a set of app-setting names for
its own platform configuration and rejects any user attempt to set them
with HTTP 400 (`InvalidAppSettings`). `AzureWebJobsStorage` is one of
those reserved names — the SWA platform manages it for the Functions
runtime's internal storage account (the SWA-internal one, not the
operator's storage account). CS03 originally followed the standard
Functions pattern where the user code reads `AzureWebJobsStorage` to
reach the operator-controlled Storage Tables, but this design **silently
breaks under SWA**: `/api/health` returns 200 (the DI factory is lazy
and Health doesn't touch Tables), but the moment any Function tries to
resolve `ITableClientFactory`, the connection string points at the
SWA-internal storage account where our `Sessions` and `Leaderboard`
tables don't exist, and every request returns 500. The failure mode is
particularly bad because it passes all unit tests, all E2E tests against
a stubbed `http-server`, and the SWA build-and-deploy step (which
verifies that triggers are HTTP-only — see LRN-020 — but does not
exercise the runtime). It only fails when a real probe hits the deployed
endpoint.

**Finding:** Functions code on SWA must read its storage connection
string from a **non-reserved** app-setting name (we use
`SUB_INVADERS_STORAGE`). Three pieces have to line up:

1. `api/Program.cs` reads the custom name first, with a fallback to
   `AzureWebJobsStorage` so local dev (where the Functions runtime
   variable is genuinely the dev-storage emulator connection string) is
   not penalised.
2. `infra/provision.sh` Phase 3.5 sets the SWA app setting idempotently
   via `az staticwebapp appsettings set --setting-names
   "SUB_INVADERS_STORAGE=$(az storage account show-connection-string …
   -o tsv)"`.
3. `local.settings.json.example` sets BOTH names to
   `UseDevelopmentStorage=true` so contributors don't have to know the
   indirection until they read it.

The full reserved-name list is at
[learn.microsoft.com `2161641` — managed Functions reserved app
settings](https://go.microsoft.com/fwlink/?linkid=2161641); the relevant
operational tell when planning is *"if Azure Functions itself uses the
setting name, SWA managed Functions probably reserves it"*. The same
pattern applies to any future user-facing connection string (Service
Bus, Key Vault references, etc.) — pick a project-prefixed name from
day one. **Verification:** the only reliable check is to hit the live
endpoint after deploy. A `verify-deploy` probe that actually calls
`/api/leaderboard` against the SWA preview slot is the cheapest
guardrail; CS03's `leaderboard-sequence` check would have caught this
before merge if it had been wired into a deploy gate (it currently has
to be invoked manually).

**Disposition:** _(open. Recommend (a) folding a smoke probe of any
new `/api/*` endpoint into the deploy gate so this class of issue
fails before merge, and (b) updating any future plans that add
SWA-managed-Functions app settings to require a project-prefixed name
in the plan deliverables list, not the Azure-reserved equivalent.)_

---

_(no entries yet)_

## Obsolete

_(no entries yet)_

## Deferred

_(no entries yet)_

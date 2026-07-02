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

### LRN-026

```yaml
id: LRN-026
date: 2026-06-16
category: tooling
source_cs: CS15
status: open
tags: [coverage, c8, per-file, gating, ci, node-version, branch-count]
```

**Problem:** The unit-suite coverage CI step ran only `c8 --check-coverage` with
AGGREGATE thresholds and never invoked `coverage:check:unit`, so a single unit
file could sit below its per-file floor while the suite average kept CI green —
asymmetric with the E2E suite, which already runs its per-file gate via
`test:e2e:coverage`. Concretely `src/game/whaleshark.mjs` (~85% stmt / ~59%
branch) and `src/game/flags.mjs` (~77% branch) were below floor, the
Node-24-local vs Node-20-CI V8 branch-count skew that CS14 deferred (LRN-025
disposition).

**Finding:** Wiring `npm run coverage:check:unit` as a dedicated CI step
immediately after the c8 unit step — reusing the json-summary the c8 step
already writes (`coverage-report-unit/coverage-summary.json`), guarded to skip +
`exit 0` when that summary is absent (empty unit matrix) — enforces per-file
floors on every PR with no second instrumented run. Closing the gap by ADDING
tests (+6 flags, +17 whaleshark) rather than lowering thresholds or adding
overrides raised `flags.mjs` to 100% stmt / 96.29% branch and `whaleshark.mjs`
to 100% stmt / 98.88% branch — ample margin above the 80% branch floor, so the
gate is robust to the Node-version branch-count skew on both Node 20 (CI) and
Node 24 (local). Scope stayed test-files + one CI step; no production `src/**`
or `coverage-thresholds.json` change.

**Disposition:** _(open as the standard unit-coverage gate; resolves the
LRN-025-deferred `src/game/{flags,whaleshark}.mjs` skew. Follow-up candidate: a
pre-existing flaky E2E test `tests/e2e/game-flow.spec.mjs:26 — KeyM on game-over
returns to the main menu` surfaced during CS15 CI and passed on re-run; it is
input-timing flakiness of the class fixed for the score/input specs in PR #90,
out of CS15 scope.)_

---

### LRN-027

```yaml
id: LRN-027
date: 2026-06-30
category: architectural
source_cs: CS13
status: open
tags: [engine-extraction, canvas-game-engine, git-url-dependency, bare-specifier, upstream-ci, dependency-pinning]
```

**Problem:** The Canvas 2D engine (nine modules: `loop`, `entity`, `collision`,
`input`, `renderer`, `sprite`, `audio`, `scene`, `seed`) was vendored in-tree at
`src/engine/`, and its one-way isolation invariant (engine never imports game
code) was enforced by an in-repo linter `scripts/check-engine-isolation.mjs`.
Keeping the engine in-tree blocked reuse by other games and coupled the engine's
release cycle to sub-invaders' own.

**Finding:** CS13 extracted the engine to the standalone public repo
`henrik-me/canvas-game-engine`, tagged `v0.1.0`. sub-invaders now consumes it as a
git-URL dependency (`github:henrik-me/canvas-game-engine#v0.1.0`) and imports
bundler/Node-resolved bare specifiers (`canvas-game-engine/<module>.mjs`) instead
of relative `src/engine/...` paths. The vendored directory and
`scripts/check-engine-isolation.mjs` were deleted; the no-reverse-imports contract
and its CI enforcement now live in the upstream repo, and the API surface is
documented in the upstream README.

**Disposition:** _(open. Accepted tradeoff: engine bugfixes/features now require an
upstream round-trip — a PR + new tag in `canvas-game-engine`, then a dependency-pin
bump in sub-invaders — rather than an in-tree edit. The pinned tag gives
reproducible builds at the cost of manual dep bumps to pick up upstream changes.)_

---

### LRN-029

```yaml
id: LRN-029
date: 2026-07-01
category: architectural
source_cs: CS08
status: open
tags: [service-worker, offline, esm, cache-api, mode-aware-client, frontend]
```

**Problem:** CS08 added a root-scope Service Worker and a ranked/practice mode split.
Three integration bugs were caught in Copilot review (not by unit tests) because they
only manifest in a real browser / production, where Node + in-test doubles don't
exercise the browser Service Worker / Cache API semantics.

**Finding:**
- **An ESM Service Worker MUST be registered with `{ type: 'module' }`.** `src/sw.mjs`
  uses `export` (for testability), so registering `/sw.mjs` as a *classic* worker fails
  to parse `export` and the SW never activates. Unit tests missed it (SW registration is
  skipped on localhost per CS08-13; Node imports the module directly). Also keep the SW
  self-contained — no bare-specifier imports — since it is served raw, not bundled.
- **Draining a mode-agnostic queue through a mode-aware client silently drops items.**
  The pending-scores queue holds RANKED scores, but `drainPendingOnLoad` submitted them
  via the mode-aware `apiClient`, whose `submitScore` no-ops in practice mode and returns
  a success-shaped sentinel — so the drain cleared the queue without contacting the
  backend. Fix: the drain forces submission (`submitScore(entry, { bypassPracticeSkip: true })`).
  Lesson: any batch/retry path that submits inherently-typed items must force the correct
  behavior, not inherit the ambient mode of a mode-gated client.
- **`cache.match()` is query-string sensitive.** A pathname-allowlisted SW that precaches
  `/` still 503s an offline navigation to `/?mode=practice` unless it matches with
  `{ ignoreSearch: true }`.

**Evidence:** All three surfaced in Copilot review of PR #118 (rounds 3–5), fixed in
`142b284` / `dbcd85c` / `0d37064`, and locked in with regression tests (assert
`{ type: 'module' }` is passed to register; drain-in-practice actually submits the queue;
a query-sensitive fake cache resolves `/?...` to the cached `/`).

**Disposition:** _(open — applied within CS08; retain as the standard frontend
Service-Worker / offline / mode-aware-client pattern for any future SW or offline-queue
work.)_

## Applied

### LRN-032

```yaml
id: LRN-032
date: 2026-07-02
category: process
source_cs: CS21
status: applied
tags: [workboard, auto-merge, ci, managed-workflow, harness-boundary]
```

**Problem:** After adopting the v0.12.0 managed `workboard-auto-approve.yml` (CS21), workboard-only
PR auto-approval is gated on the PR branch name AND requires a repo secret — neither of which the
old custom workflow had. A future agent using the old ad-hoc branch names, or working before the
secret is added, will see workboard PRs silently NOT auto-merge and must fall back to admin-merge.

**Finding:** For workboard-only auto-merge to work under the v0.12.0 workflow: (1) the PR branch
MUST match `cs<NN>/(claim|close|close-out)`, `workboard/cs<NN>-(claim|close|close-out)`, or
`docs/file-planned-cs<NN>(-<slug>)?`; and (2) the repo must carry a `WORKBOARD_MERGE_TOKEN` secret
(fine-grained PAT, Contents + Pull-requests R/W, owner/admin account). Until the secret exists,
workboard PRs are admin-merged manually — the `validate-and-approve` job is NOT a required status
check, so a mis-named branch never *blocks* a merge, it only forgoes bot auto-approval. Separately,
Copilot findings on the adopted managed workflow content are not fixable in-consumer (editing a
managed file causes sync drift) and were routed upstream as agent-harness#394 — reinforcing LRN-031
(harness-owned content stays in the harness; file issues upstream).

**Disposition:** _applied in CS21 (merged `e074a32`); operational details recorded in CONTEXT.md; upstream harness gaps tracked by agent-harness#390–#394._

---

### LRN-031

```yaml
id: LRN-031
date: 2026-07-02
category: architectural
source_cs: CS19
status: applied
tags: [documentation, bootstrap, cross-repo, harness-boundary, staleness]
```

**Problem:** `ARCHITECTURE.md` — a seeded, consumer-owned doc authored during the
agent-harness–orchestrated bootstrap (`done_cs16` in agent-harness) — carried
harness-internal content that rots for this repo: a reproduced `CS16`
technology-decisions (`C16-9..C16-16`) table and a hard link into the harness's own
`project/clickstops/active/active_cs16_...` path, which returns HTTP 404 once the
harness closes that CS. It had also accumulated stale facts (a 4-job CI table, a
"five required contexts" list, `## Future scope` framing, a storage-name
contradiction) as CS13–CS18 shipped.

**Finding:** Harness-owned content must stay in the harness. In consumer-owned docs,
reference it by a single stable `done/` (or commit-pinned) pointer — never reproduce
harness decision tables and never link into a transient `active/` clickstop path (it
404s at close-out). CS19 removed the duplication + broken link (kept one `done/`
provenance pointer), stripped the inline `(C16-xx)` tags, and refreshed the stale
facts. The systemic prevention (the harness bootstrap should not seed consumer docs
with `active/` self-links or duplicated decision tables) is a harness-side defect and
is filed upstream as **agent-harness#371** — issues that belong to the harness are
filed there, not fixed in-repo.

**Disposition:** _applied in CS19 (merged `54219c0`); harness-side root cause tracked by agent-harness#371._

---

### LRN-030

```yaml
id: LRN-030
date: 2026-07-01
category: process
source_cs: CS17
status: applied
tags: [github-actions, concurrency, swa-deploy, ci, pr-review, copilot, review-discipline]
```

**Problem:** CS17 fixed the recurring swa-deploy push cancellations, but two reusable
lessons from that work were captured only in the `swa-deploy.yml` comment, the CS17
done-file notes, and a PR review reply — not in the canonical learnings index. `LRN-028`
records the CS17 root cause + fix but not the underlying GitHub-concurrency semantics or
the review-verification discipline below.

**Finding:**
- **A workflow triggering on BOTH `push` and `pull_request: closed` must not share a
  ref-only concurrency group.** With `group: …-${{ github.ref }}`, at a merge the `push`
  production deploy and the `pull_request: closed` teardown resolve to the same group; the
  teardown (`cancel-in-progress: true`) cancels the in-progress push deploy in ~2s. Qualify
  the group by `github.event_name` (and PR number for PRs) so events never collide:
  `swa-deploy-${{ github.event_name }}-${{ github.event.pull_request.number || github.ref }}`.
- **`queue: single` (the default) cancels+replaces existing *pending* runs, not
  in-progress ones.** With `cancel-in-progress: false`, a running job is never cancelled; a
  newly queued run becomes pending and any *existing* pending run in the group is cancelled
  and replaced. So back-to-back `main` merges only supersede a *pending* deploy — correct
  and desirable for a static SWA where only the latest commit must be live. (Authoritative:
  GitHub "Control workflow concurrency" docs.)
- **Automated reviewers can be confidently wrong about platform semantics.** Copilot flagged
  the swa-deploy comment as inaccurate, asserting `cancel-in-progress:false` does NOT
  supersede pending runs — the opposite of the documented `queue: single` behavior. Verify
  platform-behavior claims against primary docs before acting; decline an incorrect finding
  with a citation rather than degrading correct code/comments. A web-search summary was
  *also* wrong here (it conflated `queue: max`); the primary GitHub docs settled it.

**Evidence:** CS17 PR #122 — Copilot COMMENTED at `ce5db96` with the concurrency claim;
declined with a GitHub-docs citation, and the rubber-duck reviewer (gpt-5.5) independently
concurred the comment was correct. Fix verified across merges
`5cd13cc`/`45564f0`/`00ffb1d`/`eed9220` (push deploys auto-landed; prod `/api/health`
auto-tracked the latest commit with no manual re-run).

**Disposition:** _(applied within CS17. Reuse the event-qualified concurrency-group pattern
for any workflow spanning `push` + `pull_request` events; trust the `queue: single`
pending-supersede semantics for static-site deploys; and verify reviewer platform-semantics
claims against primary docs before acting on them.)_

---

### LRN-028

```yaml
id: LRN-028
date: 2026-06-30
category: process
source_cs: CS13
status: applied
tags: [harness-init, coverage, e2e, ci, swa-deploy, extraction, follow-up]
```

**Problem:** Executing the CS13 extraction surfaced several mechanics the plan
did not anticipate, and exposed one pre-existing production-deploy issue.

**Finding:**
- **`harness init` scaffolds are opt-IN** (`--with-scaffold`), not opt-out. A
  library-shaped consumer gets a clean tree by simply omitting them — no
  deploy dirs (`flags/`, `health/`, `seeds/`, `api/`) are created, so the
  anticipated "prune irrelevant dirs" step (CS13 Risk R4) was a no-op. Fresh
  `init` also leaves `REPLACE_ME`/`my-project`/`mp` placeholders in
  `harness.config.json`, defaults `review_gates` ON, and (when run via
  `npx github:…#tag`) records `harness_ref: "unknown"` in the lock; fix the
  config + re-`sync`, and set the lock ref manually. (CS13-17: in-repo
  learning, no upstream issue filed.)
- **Externalizing the engine interacts with the E2E per-file coverage gate.**
  Once the engine lives in `node_modules/canvas-game-engine/src/`, the bundle
  sourcemap paths are `../../node_modules/canvas-game-engine/src/<m>.mjs`;
  `coverage-perfile.mjs normalize()` collapsed them to `src/<m>.mjs` and would
  have gated the dependency as local source. Fix: drop `node_modules` paths
  from the per-file gate, while keeping the bundled engine in the e2e
  suite-level aggregate (it ships in the production bundle) via the monocart
  `sourceFilter`. The external engine's per-file coverage is owned upstream.
- **CI `js-tests` needed `npm ci`.** Once unit tests import the
  `canvas-game-engine` package (vs. relative `../engine/...`), the `node --test`
  job must install dependencies; other jobs already did.

**Disposition:** _(applied — both FOLLOW-UP sub-items resolved. (1) **E2E suite-level floor: RESOLVED by CS18** — the non-fatal monocart `onEnd` (`process.exitCode=1`, ignored by Playwright) is superseded by a post-Playwright checker (`scripts/coverage-suite.mjs`, wired into `npm run test:e2e:coverage` after the per-file gate) that reads the aggregate `.summary` from `coverage-report.json` and exits non-zero on a breach; the suite floors were re-baselined to measured reality in `coverage-thresholds.json` `e2e.suite` (now the single source of truth, also consumed by `playwright.coverage.config.mjs`). (2) **swa-deploy push-run cancellations: RESOLVED by CS17** — the concurrency group is event- and PR-number-qualified so the push production deploy is never cancelled by the `pull_request:closed` teardown. Retain the CS13-init findings above as reference.)_

---

### LRN-003

```yaml
id: LRN-003
date: 2026-05-11
category: architectural
source_cs: CS01
status: applied
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

**Disposition:** _(applied 2026-06-30 — the GITHUB_TOKEN-cannot-approve constraint is fully absorbed: `workboard-auto-approve.yml` ships validation-only, automated approval is handled by the GitHub App when installed, and OPERATIONS.md § "Workboard-only PR admin-bypass fallback" documents the `gh pr merge --admin` path otherwise.)_

---

### LRN-005

```yaml
id: LRN-005
date: 2026-05-11
category: process
source_cs: CS01
status: applied
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

**Disposition:** _(applied 2026-06-30 — institutionalized in OPERATIONS.md § "Composed-block edits — consumer vs harness-repo paths": always check `harness:local-*` marker boundaries before editing a composed file; out-of-marker prose is filed upstream as harness-feedback, not patched locally.)_

---

### LRN-009

```yaml
id: LRN-009
date: 2026-05-11
category: process
source_cs: CS01
status: applied
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

**Disposition:** _(applied 2026-06-30 — adopted practice: avoid piling `@dependabot rebase` on overlapping multi/single PRs; for independent green bumps, admin-squash-merge each, and replace any auto-closed multi-bump with a manual PR. Re-confirmed this session merging six independent Dependabot bumps via admin squash.)_

---

### LRN-013

```yaml
id: LRN-013
date: 2026-05-13
category: process
source_cs: CS02
status: applied
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

**Disposition:** _(applied 2026-06-30 — reflected in OPERATIONS.md § "CRITICAL PREFLIGHT" and the dispatch model: orchestrator commits land only between waves / at CS end, never inside a wave, and sub-agents assert preflight SHA == final SHA.)_

---

### LRN-015

```yaml
id: LRN-015
date: 2026-05-13
category: process
source_cs: CS02
status: applied
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

**Disposition:** _(applied 2026-06-30 — OPERATIONS.md § "Workboard-only PR admin-bypass fallback" documents the no-G3 `gh pr merge --admin` ceremony (and the App path when installed); the harness#138 friction items are addressed upstream. The constraint is absorbed into process.)_

---

### LRN-016

```yaml
id: LRN-016
date: 2026-05-13
category: process
source_cs: CS02
status: applied
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

**Disposition:** _(applied 2026-06-30 — the factory-with-baked-defaults pattern for disjoint parallel fan-out is established practice and is referenced from OPERATIONS.md § "File ownership (LRN-016)".)_

---

### LRN-019

```yaml
id: LRN-019
date: 2026-05-13
category: process
source_cs: CS09
status: applied
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

**Disposition:** _(applied 2026-06-30 — CS15 wired the per-file unit coverage gate into CI; `scripts/coverage-perfile.mjs` + `coverage-thresholds.json` enforce per-file floors (with documented `_reason` overrides) for both the unit and e2e suites alongside suite totals.)_

---

### LRN-020

```yaml
id: LRN-020
date: 2026-05-13
category: architectural
source_cs: CS03
status: applied
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

**Disposition:** _(applied 2026-06-30 — structural constraint absorbed: SWA managed Functions are HTTP-only, and `SessionsCleanupFunction` ships as `POST /api/admin/sessions-cleanup` driven by an external scheduler. Future Functions plans must call out the HTTP-only constraint and default any cron/periodic deliverable to an admin-HTTP endpoint + external scheduler unless a separate Functions app is in scope.)_

---

### LRN-021

```yaml
id: LRN-021
date: 2026-05-13
category: architectural
source_cs: CS03
status: applied
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

**Disposition:** _(applied 2026-06-30 — Functions read storage from the non-reserved `SUB_INVADERS_STORAGE` app setting (Program.cs with an `AzureWebJobsStorage` dev fallback, provisioning, and the local.settings example). A live `/api/*` smoke probe in the deploy gate remains the recommended guardrail for this class of runtime-only failure.)_

---

### LRN-022

```yaml
id: LRN-022
date: 2026-05-14
category: architectural
source_cs: CS03
status: applied
tags: [azure, swa, oryx, dotnet, msbuild, sourcelink, build-time-injection, observability, issue-52]
```

**Problem:** Issue #52 needed `/api/health` to surface the deployed commit
SHA. The original plan was a post-deploy `az staticwebapp appsettings set`
mutation: create an Azure Service Principal scoped to the prod RG, store its
JSON as `AZURE_CREDENTIALS` repo secret, add four workflow steps
(creds-check → login → appsettings set → logout), accept a Function host
cold restart on every `push:main`, and maintain a 70-line OPERATIONS.md
runbook for one-time setup. Net cost: ongoing SP rotation, GH secret
maintenance, and a non-atomic deploy (the artifact says "1.0.0" until the
appsettings call lands and the host restarts).

**Finding:** The same observability requirement is satisfiable with **zero
secrets, zero post-deploy mutation, and atomicity with the deploy artifact**
by baking the SHA into `AssemblyInformationalVersionAttribute` at build
time. Three lines glue the chain end-to-end:

1. `api/Sub-invaders.Api.csproj` PropertyGroup:

   ```xml
   <InformationalVersion Condition="'$(BUILD_COMMIT)' != ''">$(BUILD_COMMIT)</InformationalVersion>
   ```

2. `.github/workflows/swa-deploy.yml` job-level `env`:

   ```yaml
   env:
     BUILD_COMMIT: ${{ github.sha }}
   ```

3. `BuildInfoProvider` reads the attribute via reflection at startup and
   returns `info[..7]` after splitting on SourceLink's `+<sha>` suffix and
   validating `^[0-9a-fA-F]{7,40}$` shape.

The **load-bearing assumption** is that Oryx (SWA's build engine) forwards
GitHub-Actions job-level `env:` to the `dotnet build` it invokes
internally, AND that the .NET SDK auto-promotes env vars to MSBuild
properties so `$(BUILD_COMMIT)` resolves. Both are documented behaviour but
had not been observed end-to-end in this specific SWA-managed-Functions
configuration before. **Verified empirically** on PR #72: staging preview
returned `{"commit":"8b9b149"}` (a real 7-char hex prefix, not "unknown");
prod after merge returned `{"commit":"a575829"}` matching the merge SHA
exactly. The pattern is now production-proven.

**Sub-finding (SourceLink suffix):** With the .NET 8 SDK used here, Source
Link ships in-box and the SDK appends `+<SourceRevisionId>` (the source
git SHA) to `AssemblyInformationalVersionAttribute` by default. Opt out by
setting `<IncludeSourceRevisionInInformationalVersion>false</IncludeSourceRevisionInInformationalVersion>`
in the csproj. Reflection-based parsers must split on `'+'` *before* doing
shape validation; otherwise a BUILD_COMMIT of e.g.
`abc1234567890fedcba0987654321abcdef01234` reads back at runtime as
`abc1234567890fedcba0987654321abcdef01234+<sha>` and a naïve length/format
check produces nonsense.

**Reusability:** This pattern generalises to any string the build pipeline
needs to surface at runtime (build number, branch name, release channel,
deploy timestamp). The MSBuild auto-promotion contract is `env-var-name`
→ `$(env-var-name)` in MSBuild — no `-p:` flag required, no Oryx-specific
configuration. Use one MSBuild property per piece of metadata to keep the
parsing trivial; avoid encoding multiple values into one
`InformationalVersion` string.

**Disposition:** _(applied 2026-06-30 — build-time SHA injection via `InformationalVersion`/`BUILD_COMMIT` is the production-proven pattern for build-metadata observability; `/api/health` surfaces the deployed commit (verified `be8a412` this session). Future metadata (release channel, build number, deploy timestamp) should follow this template rather than post-deploy app-setting mutation.)_

---

### LRN-023

```yaml
id: LRN-023
date: 2026-05-14
category: process
source_cs: CS03
status: applied
tags: [agent-harness, sync, lock-file, parallel-sessions, drift, regression, issue-52]
```

**Problem:** During PR #72 implementation, `harness sync --mode=apply`
absorbed ~175 lines of OPERATIONS.md prose and ~41 lines of REVIEWS.md
prose from `docs/file-planned-cs47` (an unreleased feature branch in
`agent-harness`) into the consumer repo, even though the consumer's
declared pin was `v0.5.1`. The drift was committed as part of `41136e0`
on the fix branch and only caught in PvI R2 by an outside-eye review that
noticed `.harness-lock.json:2` recorded `harness_ref: "docs/file-planned-cs47"`
instead of `v0.5.1`. Backing it out required a second commit (`40e81a8`)
that re-pinned the local harness clone to v0.5.1 and re-ran sync, which
correctly removed the future-branch content.

**Finding:** Two compounding factors:

1. **C:\src\agent-harness gets clobbered by parallel sessions.** Other
   agents working in parallel sessions checkout different branches in the
   shared harness clone for their own purposes. There is no per-session
   isolation. By the time `harness sync` runs, the clone may be on any
   branch.
2. **`harness sync --mode=apply` writes file content based on the harness
   clone's current HEAD, regardless of the consumer's declared pin.** The
   consumer's `harness.config.json` `version` field is informational; the
   sync engine reads from the local clone's working tree. There is no
   safeguard that compares the lock-recorded ref to the clone's HEAD before
   writing.

**Mitigation:** Always re-pin the local clone *immediately* before any
`sync --mode=apply` invocation:

```powershell
cd C:\src\agent-harness; git stash push -u; git checkout v0.5.1
cd <consumer-worktree>; node C:\src\agent-harness\bin\harness.mjs sync --mode=apply
```

Re-pinning before only `lint` or `sync --mode=check` is *not* sufficient —
those operations don't write file content, but a follow-up `apply` against
a stale clone will. The trap is that `apply` may report "0 changes
applied" on the first call (when the consumer happens to match whatever
branch the clone is on) and then later report drift against the
correctly-pinned ref, leading to revert-and-re-sync churn.

**Detection:** Always verify post-sync that `.harness-lock.json:2`
`harness_ref` equals the intended pin (e.g. `v0.5.1`), not a branch name
or `unknown`. PvI reviewers should treat any `harness_ref` value that is
not a tag as a F-001-class blocking finding.

**Disposition:** _(applied 2026-06-30 — adopted discipline: run `harness sync`/`apply` from a clone/worktree checked out at the pinned tag (re-pin before apply), and verify `.harness-lock.json` `harness_ref` equals the tag (never a branch or `unknown`). `harness upgrade <ref>` (v0.8.0) is the supported preview-before-apply path. The upstream HEAD-vs-pin guard remains a nice-to-have.)_

---

### LRN-024

```yaml
id: LRN-024
date: 2026-05-14
category: process
source_cs: CS03
status: applied
tags: [github, copilot, pr-review, engagement, status-checks, a5-a16, graphql, issue-52]
```

**Problem:** This repo's read-only-gates A5+A16 check requires
`copilot-pull-request-reviewer[bot]` to have submitted a review against
the *current* PR HEAD. After every push that updates HEAD, Copilot must
re-review or A5+A16 stays red even when all substantive review feedback
is addressed. A previously-stored memory implied Copilot review on this
repo must be requested via the GitHub web UI because both
`gh pr edit --add-reviewer Copilot` and the REST `requested_reviewers`
endpoint return 422 ("Copilot is not a collaborator").

**Finding:** Empirical evidence from PR #72 timeline:

| time (UTC) | event | source |
|---|---|---|
| 03:03:39 | `review_requested` event for `Copilot` | issued by `harness copilot-engage 72` (GraphQL `requestCopilotReview` mutation against the PR node) |
| 03:07:19 | `copilot-pull-request-reviewer[bot]` posted COMMENTED review on `40e81a8` | triggered by the 03:03:39 request |
| 03:13:05 | `gh pr comment 72 --body "@copilot review"` posted (after a push to `c73ba62`) | did NOT trigger another review within 10+ min observation window |

**Confirmed engagement path:** `harness copilot-engage <pr>` from
agent-harness v0.5.0+. Internally it issues a GraphQL
`requestCopilotReview` mutation via `lib/github-graphql.mjs` against the
PR node ID. This bypasses the REST 422 — REST `/requested_reviewers`
expects a collaborator login string and Copilot is not a collaborator
user, but the GraphQL mutation accepts the Copilot bot via its node ID
resolved through the PR's `suggestedReviewers`/`reviewerNodeId` fields.

**Refuted engagement paths:**

- `gh pr edit --add-reviewer Copilot` → 422 "Could not resolve user with
  login 'copilot'" (still verified on PR #72; old memory accurate on
  this point).
- `gh api -X POST /repos/{owner}/{repo}/pulls/{pr}/requested_reviewers
  -f 'reviewers[]=copilot-pull-request-reviewer'` → 422 "not a
  collaborator" (still verified on PR #72).
- `gh pr comment <pr> --body "@copilot review"` → on PR #72, this comment
  posted at 03:13:05 by the PR author (`henrik-me`, `OWNER` association)
  did not trigger `copilot-pull-request-reviewer[bot]` to deliver a
  follow-up review against the new HEAD (no further review submitted
  within 10+ minutes despite the bot still being responsive elsewhere).
  This contradicts a common cargo-culted assumption; `@copilot review`
  comments may be intercepted by the cloud SWE agent or simply silently
  ignored by the review bot.

**Important caveats observed on PR #72:**

- Copilot delivers `COMMENTED`, never `APPROVED` — A5+A16 accepts a
  COMMENTED review as satisfying the gate.
- Copilot reviews are HEAD-stale: a review attached to commit `X` does
  not satisfy A5+A16 once the PR is updated to commit `Y`. Re-engagement
  requires another `harness copilot-engage <pr>` invocation (which fires
  a fresh GraphQL mutation), not a `@copilot review` comment.
- Copilot may not re-engage within a reasonable window (>10 min)
  for trivial doc-only deltas (CHANGELOG-only fix following a
  substantive review). When all substantive feedback is addressed and
  the post-review delta is verifiably trivial, admin-merge via
  `gh pr merge --squash --admin` is the user-pre-authorized path
  (CS11 precedent).
- Inline review comments from Copilot may be **stale relative to the
  committed code** — Copilot occasionally flags an issue that was
  already fixed in the same commit it's reviewing (PR #72 had this
  exact case: F-003 NIT was already addressed in `40e81a8`, but Copilot
  reviewing `40e81a8` still flagged the pre-fix line). Always verify by
  reading the current file before treating a Copilot comment as
  actionable.

**Disposition:** _(applied 2026-06-30 — `harness copilot-engage <pr>` is the documented-and-verified Copilot engagement path; do not rely on `gh pr comment "@copilot review"` or `gh pr edit --add-reviewer` (both refuted on PR #72). Admin-merge via `gh pr merge --squash --admin` is the pre-authorized escape hatch for verifiably-trivial post-review deltas. Copilot reviews are HEAD-stale and arrive as COMMENTED, which satisfies A5+A16.)_

---

### LRN-025

```yaml
id: LRN-025
date: 2026-06-10
category: architectural
source_cs: CS14
status: applied
tags: [esbuild, bundler, frontend-build, swa-deploy, coverage, sourcemap]
```

**Problem:** Consuming external/extracted ESM packages (immediately: CS13's
`canvas-game-engine`) requires resolving bare-package specifiers
(`from 'canvas-game-engine/loop.mjs'`) that browsers cannot resolve from a raw
`src/` tree, and `node_modules` is not deployed to SWA. The v1 "no bundler"
shortcut blocked any external dependency.

**Finding:** esbuild (exact-pinned `0.28.0`) as a single-entry bundler
(`src/game/main.mjs` → `src/dist/main.mjs`; ESM; ES2022; external sourcemap; no
minify) cleanly resolves the existing relative `.mjs` graph and unblocks
bare-specifier deps. Integration facts proven end-to-end on prod `368eb56`:

- **SWA/Oryx:** `app_location:"src"` with no `src/package.json` meant Oryx never
  built the frontend (it shipped raw static assets). Adding workflow-level
  `npm ci && npm run build` before the `static-web-apps-deploy` action produces a
  byte-identical bundle in production (`/dist/main.mjs` = 106,559 B) — no
  `skip_app_build: true` needed, `api_location:"api"` untouched.
- **Coverage:** the bundle must be excluded from c8 (`--exclude "src/dist/**"`)
  in BOTH `package.json` and `ci.yml`; `scripts/coverage-perfile.mjs` `normalize()`
  collapses leading `../` so the per-file gate attests sources, not the bundle
  (esbuild sourcemap `sources` are `../game/…`/`../engine/…`, though monocart
  already resolves them — the strip is regression-tested defensive insurance).
  E2E per-file gate passed with 29 source files.
- **Freshness:** `pretest:e2e[:coverage]` hooks + `webServer.command:
  "npm run build && npm run serve"` + explicit CI build steps each guarantee a
  fresh bundle; the hook specifically covers the local `reuseExistingServer` path
  where Playwright skips the webServer build.
- **Baseline (R7):** 104.1 KB raw / 191 KB map; esbuild build ~180 ms. No
  bundle-size budget yet.

**Disposition:** _(applied 2026-06-30 — esbuild single-entry bundling is the standard frontend-build pattern (CS14) and unblocked consuming the external `canvas-game-engine` package in CS13; the bundle is excluded from coverage and rebuilt fresh in CI/e2e. TypeScript adoption and a bundle-size budget (R7) remain deliberately out of scope.)_

## Obsolete

### LRN-012

```yaml
id: LRN-012
date: 2026-05-13
category: process
source_cs: CS02
status: obsolete
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

**Disposition:** _(obsolete 2026-06-30 — CS13 extracted the engine to the external `canvas-game-engine` package and deleted the in-tree `src/engine/input.mjs`, so this specific allowlist integration seam no longer exists in this repo; the opt-out-allowlist refactor is now an upstream concern. The general parallel-fan-out integration-verification lesson is retained via LRN-013 and LRN-016.)_

## Deferred

_(no entries yet)_

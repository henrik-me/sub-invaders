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

## Applied

_(no entries yet)_

## Obsolete

_(no entries yet)_

## Deferred

_(no entries yet)_

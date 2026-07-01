# OPERATIONS

> **File class:** composed — managed core + one project-local block.
> Do **not** edit the managed-core sections directly. Edit only the content
> inside the `operations.project-deploy` local block (see § Local block at the end of this file).
> All managed-core sections are overwritten on every `harness sync`.

Day-to-day procedures for filing, claiming, dispatching, syncing, and
harvesting with the agent harness. This is the canonical operational
reference for all harness-enabled projects.

---

## Filing a clickstop

A clickstop (CS) is the unit of planned work. **File a CS** when the work
involves design decisions, multiple files, or a doctrine/process change —
anything that benefits from a written plan and a plan review. Trivial
dependency bumps, pure `WORKBOARD.md` edits, and one-line doc fixes do not
need a CS (use the workboard-only / maintenance PR path instead). Filing
creates the `planned` plan only; moving it into flight (the
`planned → active` rename, the WORKBOARD row, the branch) is the separate
claim step in § Claim. Follow the steps below rather than reverse-engineering
the shape from an existing CS file.

### Steps

1. **Pick a collision-free id.** Use the next unused `CS<NN>` above every id
   already present under `project/clickstops/{planned,active,done}/`. A
   trailing letter (`CS63a`) marks a sub-task within one arc; when sibling
   orchestrators are active, leave a margin above their in-flight arc.
2. **Create** `project/clickstops/planned/planned_cs<NN>_<slug>.md` with LF
   line endings and no BOM (the text-encoding gate rejects CRLF/BOM).
3. **Author the plan** from the skeleton below.
4. **Get an independent plan review.** Dispatch the `## Decisions` +
   `## Deliverables` to the primary reviewer model (GPT-5.5; see
   [REVIEWS.md](REVIEWS.md)), which MUST differ from every `Plan author
   model(s)`. Iterate until the verdict is `Go` or `Go-with-amendments`.
5. **Pin the attestation.** Compute the 12-char hash of the current
   Decisions+Deliverables with `harness plan-review-hash <file>` and record
   it in a `## Plan review` row. The latest row's hash MUST equal the
   current Decisions+Deliverables hash, and its verdict MUST be `Go` or
   `Go-with-amendments`.
6. **Validate** with `harness lint` — it runs `check-clickstop` (structure),
   `check-clickstop-plan-review` (attestation), and `check-text-encoding`
   (LF/BOM).
7. **Open a content PR** adding the file, with the `## Model audit` +
   `## Review log` review evidence ([REVIEWS.md](REVIEWS.md) § 2.8). Filing
   does not claim the CS.

### Required structure

Mechanically enforced by `scripts/check-clickstop.mjs` and
`scripts/check-clickstop-plan-review.mjs`:

- **Header fields (all required):** `**Status:** planned`, `**Owner:**`,
  `**Branch:**`, `**Started:**`, `**Closed:**`, `**Depends on:**`. `Status`
  must read `planned` while the file lives in `planned/`. (Filing agents also
  add a `**Filed by:**` line by convention — it carries useful provenance but
  is not one of the fields `scripts/check-clickstop.mjs` enforces.)
- **`## Plan review`** — present, with the 8-column table and at least one
  row: `Round | Reviewer model | Plan author model(s) | Reviewer agent |
  Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200
  chars)`. Reviewer model ∉ author models; ISO-8601 UTC timestamps; the
  latest hash/verdict stay fresh per step 5.
- **`## Plan-vs-implementation review`** — include the placeholder now; it is
  only *enforced* once the file reaches `active/` or `done/` at close-out.

The remaining sections are canonical convention — but `## Decisions` and
`## Deliverables` are required in practice because the plan-review hash is
computed over their bodies.

### Skeleton

```markdown
# CS<NN> — <title>

**Status:** planned
**Owner:** —
**Branch:** —
**Started:** —
**Closed:** —
**Filed by:** <who filed it, when, and the surfacing context>
**Depends on:** <none | CS refs>

## Goal
## Background
## Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|

## Deliverables
## User-approval gates
## Exit criteria
## Risks + open questions
## Plan review

| Round | Reviewer model | Plan author model(s) | Reviewer agent | Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200 chars) |
|---|---|---|---|---|---|---|---|

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| (populated at claim time per § Claim) | planned | — | — |

## Notes / Learnings
## Plan-vs-implementation review

> _(filled at close-out per the gate)_
```

---

## Claim

The claim workflow moves a planned Clickstop (CS) into flight and establishes
a content PR on the repo. **One CS active at a time** — the WORKBOARD's
Active Work table is the live lock. No new CS may be claimed while an
existing CS has `state = Active`.

### Three-PR shape

Every CS produces exactly three PRs in sequence:

1. **Workboard-claim PR** — branch `cs<NN>/claim`; touches only
   `WORKBOARD.md` and the clickstop file rename (`planned → active`).
   Label: `workboard-only`. *(CS01–CS14: user-reviewed small PR.
   Public protected phase: bot auto-approved via Decision #23 when the PR
   passes the workboard-only validation gate.)*

2. **Content PR** — branch `cs<NN>/content`; all implementation work lives
   here. Standard review loop (GPT-5.5 + user). Squash-merge only.

3. **Close-out PR** — branch `cs<NN>/close-out`; touches only
   `WORKBOARD.md` (Active Work row removed for this CS), the clickstop
   rename (`active → done`), and any close-out updates to `CONTEXT.md` /
   `LEARNINGS.md`. The `done/` directory is the historical record;
   WORKBOARD never carries a "recently completed" log (LRN-102). Label:
   `workboard-only`. Same auto-merge rules as the claim PR. **Must be
   preceded by the plan-vs-implementation review gate (see
   [§ Plan-vs-implementation review (close-out gate)](#plan-vs-implementation-review-close-out-gate)).**

Every active/done CS file must include explicit `## Tasks` rows for:

- **Close-out: docs + restart state** — update `WORKBOARD.md`, `CONTEXT.md`,
  managed/composed process templates and rendered roots, plus any
  relevant feature docs so a fresh agent can restart from the actual state.
- **Close-out: learnings + follow-ups** — file or disposition learnings in
  `LEARNINGS.md` and create planned follow-up CSs for unresolved issues.

`check-clickstop.mjs` enforces these rows for active CS files and for done CS
files closed on or after CS15a's close-out enforcement date.

### Claim steps

1. `git pull origin main --rebase` — sync with upstream.
2. `git checkout -b cs<NN>/claim` — create claim branch.
3. Edit `WORKBOARD.md`: add a row to Active Work with CS-Task ID, branch,
   agent ID, state (`🟢 Active`), and last-updated timestamp.
4. Rename the CS file:
   ```
   git mv project/clickstops/planned/planned_cs<NN>_<slug>.md \
            project/clickstops/active/active_cs<NN>_<slug>.md
   ```
   *(Use the directory form for artifact-bearing CSs — see
   [TRACKING.md § Clickstop lifecycle](TRACKING.md#clickstop-lifecycle).)*
5. Commit: `Claim CS<NN>` with the `Co-authored-by: Copilot` trailer.
6. Push; open PR labeled `workboard-only`; user reviews; squash-merge.

### Pre-claim harvest gate (CS04+)

Run `harness harvest` before claiming (a future `harness claim` command will
run it automatically — tracked in CS64). It surfaces stale `open` learnings
tagged `process` or `architectural`, or learnings tagged with the
`claim_area` metadata for the current CS area. Resolve stale learnings
before the workboard-claim PR lands.

### Pre-claim planning-locality self-check (CS35 C35-11)

Before claiming any CS, verify no strategic planning content lives outside
the canonical `project/clickstops/{planned,active,done}/**` arc:

1. Run `node scripts/check-planning-locality.mjs --cwd .` — must exit 0.
   (Also runs as part of `harness lint` per CS35.)
2. If the orchestrator's session-state plan file (`~/.copilot/session-state/<id>/plan.md`)
   contains anything beyond (a) which CS this session is currently executing
   and (b) ephemeral todos for that one CS, externalize the strategic content
   into `project/clickstops/planned/planned_csNN_<slug>.md` BEFORE claiming.
   Session storage is non-durable; any agent restart, model swap, or handoff
   must succeed from the repo alone (per Decision C35-11).
3. Issues filed by the agent are forbidden in the harness repo
   (Decision C35-13). GitHub issues in `henrik-me/agent-harness` are an
   INBOUND channel from external contributors / the user; the agent
   reads them as input to file CSs but never opens them.

   **Scope clarification (CS55 / LRN-137):** C35-13 applies to the
   harness repo only. Cross-repo handoff issues filed into OTHER
   repositories (e.g. `henrik-me/sub-invaders`) are governed by Hard
   Rule § 6 in `INSTRUCTIONS.md` / `.github/copilot-instructions.md`
   and the `## Cross-repo procedures` section below. In those repos,
   the orchestrator MUST file an issue (rather than commit/push/PR
   directly) and is expected to create exactly one tracking issue
   labeled `harness-orchestrator` per cross-repo workstream.

### Plan-vs-implementation review (close-out gate)

This gate is **mandatory** before opening the close-out PR and before
the `active → done` rename. Run it against the merged content HEAD (or the
content diff), not a half-migrated close-out worktree.

**Reviewer:** GPT-5.5 (rubber-duck). Fallback: Claude Sonnet 4.6, subject
to the independence invariant in [REVIEWS.md](REVIEWS.md) (non-high-risk
only; user waiver always allowed).

**Inputs the reviewer must consume:**

- The active CS file (all deliverables, tasks table, sub-agent reports).
- The actual diff against the base branch:
  `git diff main..cs<NN>/content`.
- The test count delta (tests before vs. after).
- Any sub-agent final reports recorded in the CS file.

**Required outputs the reviewer must produce:**

- **Per-deliverable outcome table** — for each deliverable listed in the CS
  plan, one of: `match` | `diverged` | `added` | `dropped`, with a rationale
  sentence for every non-`match` entry.
- **Test-coverage assessment** — `sufficient` OR `gaps` with a specific list
  of untested scenarios.
- **Overall outcome** — `GO` | `NEEDS-FIX`.

**Recording the review:**

The orchestrator records the review verbatim in the active CS file's
`## Plan-vs-implementation review` section **before** the `active → done`
rename. Renaming first leaves a `done/` file with an unfilled PVI section
that `check-clickstop` correctly rejects. The section must contain:

```
**Reviewer:** <model name + rubber-duck | fallback reason>
**Date:** <ISO 8601 timestamp>
**Outcome:** GO | NEEDS-FIX

<prose summary — per-deliverable table + coverage assessment>
```

> **Field labels are matched verbatim by `check-clickstop.mjs`** (case-sensitive,
> bold-prefixed): `**Reviewer:**`, `**Date:**`, `**Outcome:**`. No aliases —
> e.g. `**Verdict:**` instead of `**Outcome:**` will fail the linter. Copy the
> code block above as-is when recording the review.

**Blocking behaviour:**

A `NEEDS-FIX` outcome blocks close-out. Fix the gap on the `cs<NN>/content`
branch and re-run the gate before proceeding.

**Mechanical enforcement:**

`check-clickstop.mjs` enforces the presence of the
`## Plan-vs-implementation review` section and its required content for all
`done/` files. The linter is wired into `harness lint` and runs on every PR.

### Plan review attestation procedure (CS35b)

This procedure is the **planning-phase counterpart** of the close-out gate
above. Per CS35b decisions C35b-1 through C35b-15, every clickstop file in
`project/clickstops/planned/` and `project/clickstops/active/` MUST carry a
`## Plan review` H2 section recording one or more independent plan reviews.
Done files are exempt — the close-out gate above already covers that surface.

**Reviewer:** GPT-5.5 (rubber-duck). Fallback rules from [REVIEWS.md](REVIEWS.md)
apply (independence invariant per C35b-4: reviewer model MUST NOT appear in
the row's `Plan author model(s)` column or in any earlier row's
`Plan author model(s)`).

**Inputs the reviewer must consume:**

- The full plan file: Background, Decisions, Deliverables, Sub-agent fan-out,
  Exit criteria, Risks + open questions.
- Any cross-CS dependencies the plan declares.

**Required outputs the reviewer must produce:**

- A verdict from the enum `Go` | `Go-with-amendments` | `Needs-Fix` (C35b-5).
- A findings recap ≤ 200 characters suitable for the table cell.

**Recording the review:**

The orchestrator records the review verbatim in the plan file's
`## Plan review` section, placed after `## Decisions` and before
`## Deliverables` (per C35b-1). Section template (paste-ready, fill the
eight cells; compute the hash via `harness plan-review-hash <file>`):

```
## Plan review

| Round | Reviewer model | Plan author model(s) | Reviewer agent | Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200 chars) |
|---|---|---|---|---|---|---|---|
| R1 | <reviewer-model-id> | <author-model-id-1,author-model-id-2,...> | <agent-id (or "rubber-duck dispatched")> | <12-char-hash from `harness plan-review-hash <file>`> | YYYY-MM-DDThh:mm:ssZ | Go | <short summary, ≤200 chars> |
```

Subsequent amendment rounds append `R2`, `R3`, ... rows below `R1`. The
latest row's `Reviewed sections hash` MUST equal the SHA-256-prefix-12 of
the file's current `## Decisions` + `## Deliverables` bodies (per C35b-3 —
the linter computes this on every run via `lib/plan-review-hash.mjs`). Once
a `## Decisions` or `## Deliverables` row is covered by a recorded plan-review
hash, factual errors found later must be corrected in the implementation and
recorded as a dated `## Notes` deviation; never edit the hashed section just
to make the plan match, because that invalidates the attestation.

**Blocking behaviour:**

A `Needs-Fix` latest verdict blocks merge. Apply the requested amendments
on the same branch, re-dispatch the reviewer, and append a new attestation
row with the post-amendment hash. The plan-vs-implementation review ladder
in [REVIEWS.md](REVIEWS.md) (3-round cap, escalate on R3 Needs-Fix) applies
identically to the planning-phase ladder.

**Strictness asymmetry (C35b-9 / C35b-10 / C42-7):**

- `harness lint` (standalone, pre-PR convenience) ran the linter with
  `--strict=false` in v0.4.0 (warn-only on missing-section). v0.5.0 (CS42)
  flipped the default to `true`; standalone lint now ERRORS on missing
  section by default. Consumers mid-migration can pass `--strict false`
  explicitly.
- The PR-time A6 gate dispatched by `harness pr-evidence` (CS36) ALWAYS
  runs in `--mode=pr-evidence`, which is STRICT regardless of `--strict`.
  The v0.4.0 asymmetry between local warn and PR strict has been collapsed
  to "always strict by default" in v0.5.0.
- Schema / independence / hash / verdict violations are ALWAYS errors,
  regardless of mode or `--strict`. Only the "section entirely absent"
  case is governed by the warn-vs-strict toggle.

**Mechanical enforcement:**

`scripts/check-clickstop-plan-review.mjs` (registered as
`check-clickstop-plan-review` in `harness lint` per CS35b decision C35b-8)
parses the table, validates the schema, enforces independence, verifies
hash freshness, and gates on the latest verdict. The CS36 PR-evidence
aggregator dispatches the same script in strict pr-evidence mode (A6).

**Honor-system caveat (C35b-14):**

The linter cannot verify the claimed reviewer model actually ran. As with
B1 commit trailers, this is honor-system attestation: the schema enforces
deliberation; orchestrator discipline + the close-out plan-vs-implementation
review catch lies. Future CS may add cryptographic evidence; this is
documented in [LEARNINGS.md](LEARNINGS.md).

### Enforcement model

**CS01–CS14 (private repo, discipline-only):** GitHub branch protection
requires GitHub Pro on private repos (see [LRN-001](LEARNINGS.md#lrn-001)).
All PRs are opened, reviewed, and squash-merged through the normal review
loop. The discipline replaces the missing mechanical enforcement.

#### Required review status checks (review-gates)

Content PRs MUST pass four PR-side status checks before merge:

| Check | What it verifies |
|---|---|
| `review-log-evidence` | `## Review log` contains at least one real `Go` / `Conditional Go` row by GPT-5.5, or by an approved fallback with `## Model audit` fallback rationale populated; template placeholders fail the gate. |
| `copilot-review-attached` | The configured Copilot PR reviewer (default `copilot-pull-request-reviewer[bot]`) has submitted a review; when missing, the workflow posts `@copilot review` as a best-effort trigger, and comment-permission failures leave the gate failed with an actionable error. |
| `independence-invariant` | `## Model audit` has populated implementer/reviewer model rows and rejects implementer/reviewer model overlap except the GPT-5.5 allowance for non-HIGH-RISK CSs. |
| `review-threads-resolved` | Every GitHub review thread on the PR is resolved. |

The `review-gates.yml` workflow runs on every PR except PRs labeled
`workboard-only`. **The `workboard-only` bypass is confined to its path
allowlist (CS63 C63-7):** a `validate-workboard-only-scope` job (and the
`pr-evidence` skip-reason check) rejects a `workboard-only`-labelled PR whose
diff touches any file outside `WORKBOARD.md` / `CONTEXT.md` / `LEARNINGS.md` /
`project/clickstops/`, so the label cannot bypass review on content. Genuine
workboard-only claim/close-out PRs are already constrained by
the workboard-only validation path. Configure the gates under
`harness.config.json → reviews`: `enforce_gates` controls workflow/ruleset
installation, `require_copilot_review` lets consumers without Copilot reviews
skip only the Copilot attachment gate, and `copilot_reviewer_slug` / `high_risk_clickstops`
customize the reviewer login and risk list. `harness init --enable-review-gates`
and `harness sync --mode=apply` inject the four contexts into
`infra/main-protection-ruleset.json` `required_checks`; `sync --mode=check`
fails when `reviews.enforce_gates=true` and the contexts are missing.

**Public protected phase (CS15a+ in this repo):** The Ruleset authored and
applied during CS15a enforces PR-required, ≥1 approving review, squash-only,
linear history, deletion/non-fast-forward protection, required status checks,
and conversation resolution. Repository admins have an explicit bypass actor
for owner override (LRN-080). Decision #23 activates the
`workboard-auto-approve.yml` bot: it verifies path-restriction +
`workboard-only` label + actor allowlist, submits the approval, and
auto-merges. The global review-required rule stays in force; the bot's review
satisfies it for eligible workboard-only PRs.

#### Consumer structural PR gate (harness-pr-check, CS63a)

Fresh `harness init` also installs `.github/workflows/harness-pr-check.yml`
(default-on; opt out via `harness.config.json → pr_check.enabled: false`). On
every PR it runs `harness lint` plus a file-class drift classifier
(`scripts/check-managed-drift.mjs`) that **fails the PR when a `managed` or
`composed` template file has been diverged** from its rendered template —
shipping the structural-integrity protection the harness enforces on itself as a
real consumer merge gate. `seeded` files are consumer-owned and never fail the
gate. An emergency managed edit can land via a `harness-managed-edit-ack` PR
label **plus** a `Harness-managed-edit:` justification line in the body (the
override is surfaced in the gate output, never silent). The workflow reads the
harness ref from the **base-branch** config and declares least-privilege
permissions, defeating fork-PR ref injection.

### Workboard-first for out-of-CS work

Rule: before starting any out-of-CS work (hotfix, single-file follow-up, doc
edit, post-CS cleanup, or other user-visible one-off), the orchestrator must
update `WORKBOARD.md` — or the consumer repo's equivalent live coordination file — so
the user can see the work in progress before the first implementation step.
This is in addition to any planned-CS-file flow.

Use the existing `## Active Work` table shape: `CS-Task ID`, `Title`, `State`,
`Owner`, `Branch`, `Last Updated`, and `Blocked Reason`. Record a short title,
the branch, an in-progress state such as `🟢 Active`, the owner agent, the date,
and the user-facing reason in `Title` (or `Blocked Reason` when blocked). Until
the workboard schema grows a dedicated out-of-CS identifier, use the nearest
CS-shaped tracking ID with a lowercase suffix (for example, `CS02h`) rather than
inventing an arbitrary ID that `check-workboard.mjs` will reject.

Example Active Work row for a downstream hotfix:

```
| CS02h | Hotfix torpedo-collision regression — restore user-visible gameplay correctness | 🟢 Active | yoga-si | hotfix/torpedo-collision | 2026-05-14 | — |
```

#### Workboard-only PR admin-bypass fallback

Consumer repos that have not installed the G3 workboard GitHub App may instead
configure a per-repo secret named `WORKBOARD_MERGE_TOKEN`. The token should be
a fine-grained PAT with repository permissions `contents: write` and
`pull-requests: write`; the token owner must also be allowed to bypass the
`main-protection` ruleset (typically by being a `RepositoryAdmin` bypass actor,
per [LRN-080](LEARNINGS.md#lrn-080)). If you manage ruleset bypass actors via
`gh`/API, refresh your local auth first with `gh auth refresh -s admin:org`;
otherwise create the fine-grained PAT in GitHub's developer settings UI and add
it to the consumer repo as the `WORKBOARD_MERGE_TOKEN` Actions secret.

The fallback degrades gracefully. When the secret is absent, the workflow keeps
running the label/branch/actor/path validation and then either uses the existing
GitHub App path (if `WORKBOARD_BOT_APP_ID` + `WORKBOARD_BOT_PRIVATE_KEY` are
configured) or logs `validation-only` so the owner knows a manual admin merge is
still required. The PAT cannot expand the workboard-only surface: the workflow
uses it only after the same actor allowlist, same-repository, immutable-head,
and path-allowlist gates pass, and the admin merge re-checks the PR head plus
reported non-workboard status checks before invoking `gh pr merge --admin`.

---

## Dispatch

Branch from main immediately after the claim PR merges:

```
git checkout -b cs<NN>/content
```

All implementation work happens on this branch. Sub-agents may be dispatched
per the parallelisation table in the active CS plan. See § Sub-agent dispatch
for the full briefing and reporting model.

---

## Handoff

If you need to leave a CS mid-flight:

1. Update `WORKBOARD.md`: set `state = ⏸ Paused` (or `🔴 Blocked`) with a
   brief reason and the `last-updated` timestamp.
2. Commit on the content branch and push: "WIP: <brief reason>" (this commit
   will be squash-merged later; it exists only to preserve work-in-progress
   state).
3. Note the `reclaimable` threshold in the WORKBOARD row (default: 7 days
   with no update). After that threshold, another orchestrator may pick it up
   by updating the WORKBOARD row with the new agent ID.

---

## Cross-repo procedures

This section governs orchestrator behaviour when work crosses the boundary
of `henrik-me/agent-harness` into other repositories (e.g. consumer repos
such as `henrik-me/sub-invaders`). It is the operational complement to
Hard Rule § 6 in `INSTRUCTIONS.md` / `.github/copilot-instructions.md`.

### Handoff pattern: issue-only, never direct PR

**Rule:** The harness orchestrator MUST NOT commit, push, open branches,
or create pull requests in any repo other than `henrik-me/agent-harness`.
The orchestrator files a GitHub issue and lets the consumer-repo agent
own the PR, validation, and merge. There is no escape hatch — even
urgent cross-repo work routes through an issue. (The human user can
still act directly outside the orchestrator at any time.)

**Status questions (e.g. "is SI updated to v0.6.0?"):**

1. Read-only inspection first: `gh pr list --repo OWNER/NAME`,
   `gh issue list --repo OWNER/NAME`, `gh api repos/OWNER/NAME/...`.
2. If a tracking issue already exists for the work in question
   (any state: open or closed within the relevant window), DO NOT
   file a duplicate; report the existing URL.
3. If no tracking issue exists, idempotently create exactly ONE issue
   per workstream using the procedure below.

**Issue-creation procedure (idempotent, non-mutating to consumer labels):**

1. **Pre-create existence check (idempotency guard).** Before creating,
   search for an existing tracking issue in the target repo to avoid
   duplicates. Use the `[harness:csNN]` title prefix as the stable
   identifier:

   ```
   gh issue list \
     --repo OWNER/NAME \
     --label harness-orchestrator \
     --state all \
     --search "[harness:csNN] <title terms> in:title"
   ```

   If exactly one issue matches (open or closed within the relevant
   window), do NOT create a duplicate; reuse the existing URL and
   report it (idempotency: re-asking the same status question must
   return the same issue). If multiple matches exist, that is a
   coordination drift — surface it as an escalation rather than
   creating a third.

2. **Label preflight (D55-3).** Ensure the routing label exists in the
   target repo. Invoke:

   ```
   gh label create harness-orchestrator \
     --repo OWNER/NAME \
     --color 0E8A16 \
     --description "Filed by harness orchestrator"
   ```

   Do NOT pass `--force`. If `gh label create` exits non-zero AND its
   stderr contains an "already exists" indication, treat as success
   (the label is already there with whatever color/description the
   consumer chose — do not overwrite). Any other non-zero exit
   (e.g. HTTP 403, network failure) is a real failure to escalate.

3. **Title convention:** prefix with `[harness:csNN]` where `csNN` is
   the originating CS that motivates the cross-repo handoff. Example:
   `[harness:cs55] Adopt v0.6.x cross-repo handoff doctrine`. The
   `[harness:csNN]` prefix is the stable identifier used by step 1's
   pre-create search; it prevents collision with future cross-repo
   handoff issues. (CS55 establishes this convention; CS56's `harness
   cross-repo open-issue` CLI is the supported handoff path — it
   applies the `harness-orchestrator` label and performs an idempotent
   exact-title search programmatically. **Two important caveats:** (a)
   the CLI does NOT enforce the `[harness:csNN]` prefix on `--title`
   (the prefix remains doctrine that operators must apply themselves);
   and (b) the CLI's idempotency only searches **open** issues
   (`gh issue list --state open`), so step 1's all-state pre-create
   check for relevant closed issues remains an operator responsibility
   when reusing a recently-closed tracking issue is desired.)

4. **Required body fields** (markdown):
   - **CS reference:** the originating harness CS (e.g. `CS55`) and a
     link to its file under `project/clickstops/done/` or `active/`.
   - **Target repo + kind of work:** which consumer repo, and a short
     classification (e.g. pin-bump, doctrine adoption, schema sync).
   - **Context:** why this issue was filed (link to harness merge
     commit SHA and/or release tag, e.g. `v0.6.x`).
   - **Requested action / ask:** the concrete change requested in the
     consumer repo, written as a checklist where possible.
   - **Acceptance criteria:** how the consumer agent will know the
     work is complete.
   - **Verification steps:** which harness checks / lint commands to
     run on the consumer side (e.g. `node bin/harness.mjs lint`).
   - **Relevant LRNs / docs:** links to applicable `LEARNINGS.md`
     entries and the harness `OPERATIONS.md` / `INSTRUCTIONS.md`
     sections that govern the handoff.
   - **Harness PR / tag links:** the merged harness PR and tag (if
     any) that supply the artefact the consumer will adopt.
   - **Coordination:** confirmation that the harness orchestrator
     will not push directly; consumer-repo agent owns the PR.

5. **Required label:** `harness-orchestrator` (always present as the
   uniform routing default per D55-3). Supplemental labels (e.g.
   `harness-sync`, `release-blocker`) are permitted as additions and
   never replace or remove the default.

6. **Record the URL** in the active CS file's Notes section. The
   close-out PR carries it forward into the done CS file.

**Exit criteria for a cross-repo handoff:** exactly one open tracking
issue exists in the target repo with the `harness-orchestrator` label
and `[harness:csNN]` title prefix; the close-out PR diff records its
URL; the orchestrator has neither committed nor opened a PR in the
target repo. (A consumer-repo agent may close the issue once the
consumer-side PR merges; that closure is the consumer's signal, not
the orchestrator's prerequisite for harness close-out.)

### Cross-repo pin-bump PR body checklist (CS54)

When the consumer-repo agent opens a cross-repo PR in response to a
harness-filed issue (typically a harness pin bump in a consumer repo
such as `henrik-me/sub-invaders`), the PR body MUST include the
canonical evidence sections at PR-open time, NOT relying on the
consumer's `.github/pull_request_template.md` to inject them. Two
reasons (per LRN-134):

1. Consumer PR templates can lag the harness version (the template is
   not in the managed file class by default, so `harness sync` does
   not auto-refresh it).
2. Since v0.6.0 the strict-flip default (`--strict-agent-columns`)
   requires the new `Implementer agent` / `Reviewer agent` rows in
   `## Model audit`; a pre-v0.6.0 template would silently produce an
   A3 hard-fail on `read-only-gates`.

This checklist is consumer-side doctrine but the harness orchestrator
MUST include it verbatim in every cross-repo handoff issue body
(under "Verification steps" / "Acceptance criteria") so the consumer
agent has a single source of truth.

**Required PR body sections (in this order):**

1. `## Summary` — one paragraph describing the cross-repo change.
2. `## Changes` — bulleted per-file enumeration of the consumer-side
   diff.
3. `## Testing` — what was run to verify the consumer-side change works
   (lint, tests, manual smoke).
4. `## Model audit` — `| Field | Value |` table with the required rows:
   - `Implementer models` (model IDs that materially produced the
     change)
   - `Reviewer model` (rubber-duck reviewer model)
   - `Implementer agent` (the **consumer-side** agent that authored the
     PR — NOT the harness orchestrator. The orchestrator only files the
     handoff issue and does not commit to the consumer repo per the
     doctrine above; the Model audit must record the actual PR author)
   - `Reviewer agent` (the reviewer's identity, e.g. `rubber-duck`)
   - Optional `Fallback rationale` when the reviewer model is an
     approved fallback (e.g. `sonnet-4.6` because GPT-5.5 was
     unavailable per § 2.2), not for implementer/reviewer overlap
     (overlap is enforced separately by the `independence-invariant`
     gate and is normally merge-blocking).
5. `## Review log` — 6-column table: `timestamp | analyzed_head |
   actor | model | verdict | evidence_link`. At least one `Go` (or
   `Conditional Go`) row at the current PR HEAD before merge. The
   `model` column MUST be the bare reviewer-model identifier (e.g.
   `gpt-5.5`); decorations like `gpt-5.5 (R2)` are not permitted —
   put round / role annotations in the `actor` column instead (see
   REVIEWS.md § 2.8).
6. Plan link to the originating harness CS file.

**Pre-open self-check:** before `gh pr create`, draft the body file
locally (UTF-8, LF, no BOM) and grep for `^## Model audit`,
`^## Review log`, `Implementer agent`, `Reviewer agent`. If any
missing, fix before opening — amending after `read-only-gates` fails
is more expensive than fixing before open.

**Sequencing rule (PR body push triggers re-attest):** If the
body is amended via `gh pr edit --body-file` after R1, the commit
SHA does NOT change — A4 stale-diff currency is unaffected because
A4 compares the latest Go row's `analyzed_head` against the actual
commit SHA. However, **review-evidence currency** is affected: the
Review log table itself, Copilot review provenance, and reviewer
narratives are PR-body artefacts that the rubber-duck and Copilot
reviewers may not have seen at R1. Use the narrow re-attest pattern
(next section) to refresh the Review log + Copilot provenance at the
post-body-push state. Adds a new Review log row at the unchanged
commit SHA — the timestamp shifts forward; the `analyzed_head` is
identical to the prior row.

**Idempotency note:** the issue-creation rules above (one open issue
per workstream, `[harness:csNN]` title prefix) apply unchanged. The
PR-body checklist is per-PR; the issue-creation guard is
per-workstream.

### Adopting the strict PR template in an existing consumer (CS54b)

The harness ships its PR template as a **composed** file
(`.github/pull_request_template.md`, rendered from
`template/composed/.github/pull_request_template.md`). Since v0.6.0
the shipped template already carries the strict `## Model audit`
(with `Implementer agent` / `Reviewer agent` rows + optional
`Notes`) and the 6-column `## Review log`, so a **fresh**
`harness init` seeds a consumer with the strict schema
automatically.

An **existing** consumer can still carry a stale, pre-strict copy
(the SI PR #79 failure mode: a pre-v0.6.0 template silently produces
an A3 hard-fail on `read-only-gates`). The harness does **not**
auto-rewrite a consumer's `.github/pull_request_template.md` unless
the consumer has opted the file into the composed flow — it is
consumer scaffold, and silently overwriting it could clobber local
customisations. Adoption is therefore **opt-in**:

1. **One-time copy (recommended — simple and reliable).** Copy
   `template/composed/.github/pull_request_template.md` from the
   pinned harness version over the consumer's
   `.github/pull_request_template.md` and commit it. This immediately
   adopts the strict schema; the file stays consumer-owned (re-copy
   on future harness bumps if desired).

2. **Reclassify for an ongoing harness-seeded evidence block
   (advanced).** Register `.github/pull_request_template.md` under the
   consumer's `harness.config.json` `composed.files`, with a
   `composed.overrides` entry that sets `"_inherited_class": "managed"`
   **and** `"local_blocks": ["pull-request.review-evidence"]`
   (mirroring how the harness itself ships the file). With that hint,
   `harness sync` runs the inherited-managed merge, which **preserves
   the consumer's existing content as-is** and, when the
   `pull-request.review-evidence` block is absent, **appends a seeded
   copy of it at end-of-file** (the strict `## Model audit` +
   `## Review log` placeholders, with a sync warning to relocate the
   block to your preferred position); an already-present block is
   preserved as consumer-owned. This path therefore **adds** the strict
   evidence sections to the current file rather than replacing it with
   the canonical template layout — use the one-time copy above if you
   want the full canonical template. Without the
   `"_inherited_class": "managed"` hint, the first sync of a file whose
   content does not already match the template fails closed
   (`EMERGE_LEGACY_UNMAPPED`).

Until a consumer adopts the strict template by either path, the
**inline-sections fallback** in the pin-bump checklist above remains
the safety net: author the canonical `## Model audit` + `## Review
log` sections directly in each PR body at open time rather than
relying on the (possibly stale) template to inject them.

### Narrow re-attest after trivial commits (CS54)

When a content PR receives small follow-on commits in response to
Copilot inline findings (typical: doc-only or 1-2 line code cleanups,
no behaviour change), a full rubber-duck re-review on every new HEAD
is overkill. The "narrow re-attest" pattern (per LRN-135) is the
cheap mitigation that keeps A4 (stale-diff currency) green without
re-paying the full GPT-5.5 round-trip.

**Three preconditions:**

1. The delta is genuinely trivial: ≤ 20 lines, doc-only or 1-2 line
   code cleanups responding to Copilot inline findings, no behaviour
   change.
2. R1 was a full-diff review at a prior HEAD, and that R1's `Go` row
   is still present in the Review log table.
3. The reviewer model and reviewer agent stay the same as R1; only
   the `timestamp` + `analyzed_head` (and optional one-paragraph
   delta summary) change.

**Dispatch shape (sync, ≤ 1 min):** brief the same rubber-duck model
with: "R1 already cleared the diff; only re-verify the trivial delta
from `<prev-head>` to `<new-head>` is innocuous; return `Go` or
`Needs-Fix`. Do NOT re-review the diff." Append the result as a new
Review log row with the new `analyzed_head`, the same model, the
same actor annotated `(narrow R2)` / `(narrow R3)`, and a
one-paragraph summary.

**Not a substitute for full re-review when the delta is substantive
(e.g. new test coverage, refactored module).** When in doubt, run a
full review.

Cross-refs: REVIEWS.md § Plan review (recommended mitigation when CS
plan delta is doc-only); REVIEWS.md § PR-evidence gates (A4
stale-diff currency); LRN-125 (Copilot review chase analogue — body
push triggers another review cycle).

---

## Sub-agent dispatch

The orchestrator (Claude Opus 4.8) dispatches sub-agents for parallelisable
sub-tasks per the parallelisation table in the active CS plan. Sub-agents
must be **briefed with structured context** and must **report back with a
structured report**. Both requirements are non-negotiable — without them the
orchestrator loses observability and the work loses traceability.

### Models

| Role | Model |
|---|---|
| Orchestrator | Claude Opus 4.8 (fallback Claude Opus 4.7) |
| Coding, unit-test & implementation sub-tasks (code/docs/config) | Claude Opus 4.8 (fallback Claude Opus 4.7) |
| Local review (primary) | GPT-5.5 |
| Local review (fallback, non-high-risk) | Claude Sonnet 4.6 (independence invariant — see REVIEWS.md) |

### Briefing template

Every sub-agent prompt includes the following sections **in this order**.
Quote directly-relevant conventions verbatim so the sub-agent does not
need to chase pointers.

#### 1. Identity + scope

State the agent role (e.g. `"mechanical sub-task on CS06"`), the CS being
contributed to, the **exact files owned by this sub-agent**, and explicit
boundaries (what NOT to touch).

Each sub-agent owns a **disjoint file set**. Overlapping write scope causes
silent file races: the later writer wins and the earlier agent's work is lost
with no error. Non-overlapping ownership is the only safe parallel model.
See **Explicit file ownership** below ([LRN-016](LEARNINGS.md#lrn-016)).

#### 2. Hard no-commit preflight ([LRN-021](LEARNINGS.md#lrn-021))

The briefing's **first paragraph** must be a `CRITICAL PREFLIGHT` block
requiring the sub-agent to:

- Record the current HEAD SHA: run `git log --oneline -1` at the start and
  include the result in the report.
- Verify at report time that the SHA is unchanged: `git log --oneline -1`
  in the final response must match the preflight SHA.
- Include `git status --short` in the final response showing only untracked
  or modified files — never staged or committed changes.
- State literally: "No commit was created."

**No commit / push / rebase / reset / gh pr** is permitted by any sub-agent.
The orchestrator commits at the end of each CS. This invariant has been
validated across 18+ sub-agent dispatches with zero violations after
standardization in [LRN-021](LEARNINGS.md#lrn-021).

#### 3. Required reading

List paths explicitly — do not say "read whatever you need":

- `INSTRUCTIONS.md`, `CONVENTIONS.md`, the active CS file, the cs-plan.
- All ADRs in `docs/adr/` that touch the deliverables area. When briefing
  a schema-author sub-agent, cross-check every ADR: ADR constraints
  frequently exceed what the cs-plan deliverables list restates (validated
  in [LRN-007](LEARNINGS.md#lrn-007) — omitting ADR 0002 cost three sub-agents a re-dispatch cycle).
- Relevant done CS files for prior art and conventions.

#### 4. Explicit file ownership ([LRN-016](LEARNINGS.md#lrn-016))

List every file the sub-agent may **write** and every file it may only
**read**. If two parallel sub-agents need the same file, designate one as
owner (may write) and the other as reader (must NOT write).

This rule was discovered empirically in CS03: `cs03-sync` wrote stubs for
`lib/templating.mjs` and `lib/lock.mjs` so its own code could `import` them.
The dedicated owners (`cs03-templating`, `cs03-lock`) reported rich APIs but
their work was silently overwritten by the stubs. The stubs — not the rich
APIs — were what remained on disk. `tests/lock.test.mjs` was lost entirely.

Verify disk state after each parallel-dispatch wave before declaring a wave
complete — see **Post-completion verification** below.

#### 5. Conventions to follow

Quote each convention verbatim in the briefing. Required conventions:

**Schema is source of truth** ([LRN-039](LEARNINGS.md#lrn-039))
Any code that reads `harness.config.json`, `.harness-lock.json`, or any
other structured config file must read `schemas/*.schema.json` first. Do not
guess field names from intuition. Guesses that match happen to work in unit
tests (because fixtures are authored against the same guess) but fail
integration silently. Before writing any field access: open the schema,
find the exact path, write the access from the schema.

**`requireValue` arg guard** ([LRN-040](LEARNINGS.md#lrn-040))
Every CLI flag that takes a value (e.g. `--file <path>`, `--config <path>`)
must guard the next token before consuming it. The guard must (a) verify
`args[i+1]` exists and (b) reject tokens that start with `-`, exiting with
code 2 and a usage message. Bare `if (args[i+1])` silently consumes the next
flag as a value, producing confusing errors like "file not found: --quiet".
The canonical guard is `requireValue(args, i, flagName)`.

**Test minimums, not exact counts** ([LRN-037](LEARNINGS.md#lrn-037))
Briefings specify a *minimum* test count. Over-delivery (writing more tests
than the minimum) is a signal of good engineering, not scope creep. It
catches edge cases the briefing did not enumerate. In CS05, delivering 12
tests against a 10-test minimum caught real `resolveLinks` contract drift.
Never specify exact counts — they create artificial pressure to stop at the
minimum and suppress coverage of discovered edge cases. The orchestrator
celebrates over-delivery on tests.

**Aggregator config single-source** ([LRN-038](LEARNINGS.md#lrn-038))
Aggregator commands (e.g. `cmdLint`) that read config AND thread it to child
subcommands must resolve the config path **exactly once** into a single
variable, then use that variable everywhere — both for local config reads and
for threading to children. Two resolution paths that agree for the happy-case
default diverge silently when a non-default `--config` or `--cwd` is passed.

**Linter explicit `--file`** ([LRN-032](LEARNINGS.md#lrn-032))
A `harness <subcommand>` wrapper that invokes a linter script must construct
the consumer-cwd-relative file path explicitly and pass it as `--file <path>`
to the script. Never let the script infer the path from `import.meta.url` or
`process.cwd()` — when the script runs as an installed package dependency,
those paths resolve inside the harness package directory, not the consumer
repo. Fix: `path.join(cwd, 'LEARNINGS.md')` as the explicit `--file` value.

**Windows `spawnSync`** ([LRN-029](LEARNINGS.md#lrn-029))
On Windows, `npm`, `npx`, and other ecosystem wrappers are `.cmd` batch
files, not executables. `spawnSync` without `{ shell: true }` attempts to
spawn the wrapper as a binary and returns EINVAL. Using `'npm.cmd'` as the
command name is not a reliable workaround. Use `{ shell: true }` for all
npm script invocations: `spawnSync('npm', args, { shell: true })`.

**`--help` re-forwarding** ([LRN-030](LEARNINGS.md#lrn-030))
A global CLI parser that intercepts `--help` must check whether a known
subcommand is also present in the argv slice before acting. If both `--help`
and a known subcommand name are present, `--help` belongs to the subcommand
— forward it to the subcommand's argv. Consuming `--help` globally when a
subcommand is present causes `harness sync --help` to print global help
instead of sync-specific flag docs.

**ESM `.mjs` only**
All harness scripts use ESM (`import`/`export`) and the `.mjs` extension.
No CommonJS `require()`. No `.cjs` files. Node.js 20+.

**LF line endings / UTF-8-BOM**
The `create` tool on Windows writes CRLF regardless of `.editorconfig`
settings ([LRN-006](LEARNINGS.md#lrn-006)). Files may also carry a UTF-8
BOM ([LRN-018](LEARNINGS.md#lrn-018)). After creating any text file on
Windows, run an explicit normalization step: strip the BOM if present and
replace `\r\n` with `\n`. All parsers that compare content must normalize in
their read step.

#### 6. Deliverables

List explicitly:

- Files to create (with purpose and minimum line / test counts).
- Files to edit (with what change is required).
- Exit criteria: the precise self-check the agent can run to verify "done".

#### 7. Self-checks before reporting

- In a freshly-created git worktree or checkout, run `npm install` in that
  checkout before dependency-backed harness linters (`harness lint`,
  `harness plan-review-hash`, schema/doc checks, etc.); `node_modules` is
  gitignored and per-checkout, not shared from the parent worktree.
- Run `node --test` and report the test count and delta.
- Run any existing linters that cover the deliverables area.
- Verify JSON schema conformance for any `.json` files created.
- Run `git status --short` — only untracked / modified files; nothing staged.
- Run `git log --oneline -1` — HEAD must match the preflight SHA.

#### 8. Decision authority and escalation

State what the sub-agent may decide independently (e.g. internal variable
names, helper-function structure, fixture design) versus what must be
escalated to the orchestrator:

- Adding or removing npm dependencies.
- Schema field additions, renames, or type changes.
- Anything that crosses CS boundaries or touches files outside the declared
  ownership set.
- Any surprising finding that materially changes the approach.

#### 9. Findings to surface

Every uncertainty, decision, deviation, or surprise must appear in the report
as a `LEARNINGS CANDIDATES` entry. The orchestrator decides whether to elevate
to `LEARNINGS.md`. **No silent decisions.** Silent decisions are the primary
source of drift between what a sub-agent reports and what lands on disk.

### Mandatory briefing preamble (copy verbatim into every dispatch)

The orchestrator MUST paste the block below verbatim into every sub-agent
dispatch prompt — including small or seemingly "obvious" ones. This is not
a style preference; it is the discipline that prevents individual requirements
(preflight SHA recording, BOM check, file-ownership scope, report-shape
completeness) from being silently omitted. When orchestrators re-draft the
preamble from memory or reference this section by hyperlink only, individual
steps are routinely forgotten. LRN-068 demonstrates how silently-lost process
steps are not surfaced until a downstream sub-agent raises them as
escalations — if the preamble itself is incomplete, that catch also fails.

A hyperlink to this section is NOT sufficient. Sub-agents operating under
tight context or fast-path prompting will skip non-pasted references.
Verbatim paste, not reference, is the mechanism that makes the discipline
reliable.

After pasting the block, append the task-specific sections: **Identity +
scope** (agent role, CS, exact owned files, what NOT to touch), **Required
reading** (explicit paths for this CS), **Deliverables**, **Decision
authority**, and any additional task-specific conventions. Do not modify the
pasted block itself.

### Subcommand authoring: never `git checkout` the consumer working repo ([LRN-124](LEARNINGS.md#lrn-124))

Harness subcommands run inside the consumer's (or self-host's) working repo,
which routinely carries **uncommitted, unstaged tracked edits**. Several git
verbs are destructive on such a repo: `reset --hard`, `restore`, `checkout -f`,
and `stash` can discard or stash away dirty tracked edits, and `clean` removes
untracked files; meanwhile `git checkout <commit-or-tag>` and
`git switch --detach <ref>` detach HEAD. The LRN-124 working-tree-loss
signature combined a detached HEAD with reverted tracked edits and no error.
CS47's bisection (`tests/cs47-detached-head-bisect.test.mjs`) proved no current
subcommand does any of this; this rule keeps it that way for new subcommands.

When a subcommand must read content at a specific ref, use, in preference order:

1. **`git show <ref>:<path>`** — read-only; never touches HEAD or the worktree. The default for inspecting tagged/committed file content.
2. **`git worktree add --detach <unique-tmpdir> <ref>`** — for multi-file scoped operations; clean up with `git worktree remove --force <path>` then `rmSync(<path>, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })` (Windows EPERM/EBUSY-hardened).
3. **`try { prev = git symbolic-ref HEAD; git stash push --include-untracked; ... } finally { restore prev + stash pop }`** — last resort only; the `stash` is mandatory, because restoring the branch ref alone does NOT restore dirty tracked-file contents.

> **Caveat:** approaches 2–3 use the `worktree`/`stash` verbs that the CS47
> trace guard flags as mutating — at the argv level it cannot prove they are
> scoped to an isolated tmpdir rather than the primary worktree. A subcommand
> that reaches for them trips the bisection suite and must be allow-listed with
> an explicit rationale documenting why the operation cannot lose consumer
> edits. Prefer approach 1 (`git show`) wherever possible.

Any new subcommand that reaches a git ref is covered automatically: the CS47
bisection enumerates the live `COMMAND_REGISTRY`, so a new subcommand that is
neither exercised nor allow-listed (with rationale) fails the suite.

```text
## CRITICAL PREFLIGHT (LRN-021)

1. Run `git log --oneline -1` NOW and record the SHA. Include it in your
   report as `PREFLIGHT SHA: <sha>`.
2. You MUST NOT commit, push, rebase, reset, `git add`, or `gh pr ...` at
   any point. The orchestrator commits at CS end.
3. At the end of your work, re-run `git log --oneline -1`. It MUST equal
   the preflight SHA. Include it as `FINAL SHA: <sha>`.
4. Run `git status --short` and include the output in your report. Only
   your owned files should appear; nothing must be staged.
5. State literally in your report: "No commit was created."

## File ownership (LRN-016)

OWN EXCLUSIVELY — you may read AND write only the files listed in the
Identity + scope section of this dispatch. You MUST NOT modify, rename,
or delete any file outside that list. Curiosity reads (grep/view) are
fine; writes are not.

Rationale: parallel sub-agents share a working tree. If two agents write
the same file, the later writer silently overwrites the earlier one's work
with no error or warning. Non-overlapping ownership is the only safe
parallel model (validated across CS03 where stubs silently replaced rich
APIs — see LRN-016).

## Required reading

Read every path listed in the Required reading section of this dispatch.
Do not infer what to read — only the explicit list counts. "Read what you
need" produces silent gaps that surface as integration failures later.

## Conventions to follow

- ESM `.mjs` only, Node 20+ stdlib. No CommonJS `require()`, no `.cjs`
  files, no npm dependencies unless explicitly authorized in this dispatch.

- Fresh git worktrees/checkouts need their own `npm install` before running
  dependency-backed harness linters; `node_modules` is gitignored and
  per-checkout, not shared from the parent worktree.

- LF line endings, no BOM. After every file write on Windows, normalize:
  strip BOM if present (first 3 bytes must NOT be 0xEF 0xBB 0xBF), replace
  \r\n with \n. All content comparisons must normalize in the read step.
  (LRN-006, LRN-018, LRN-065)

- `requireValue(args, i, flagName)` guard for every value-taking CLI flag
  (LRN-040). Must verify args[i+1] exists AND reject tokens starting with
  `-`, exiting code 2 + usage message. Bare `if (args[i+1])` silently
  consumes the next flag as a value.

- Schema is source of truth (LRN-039). Read `schemas/*.schema.json` BEFORE
  writing any field access against harness.config.json, .harness-lock.json,
  or any other structured config. Do not guess field names.

- Stdout for success output; stderr for errors and warnings (LRN-044).
  `--quiet` suppresses success stdout only. Errors always go to stderr.

- No dot-notation placeholders (LRN-049). Use flat keys only:
  `si` not `{{project.agent_suffix}}`. Dot-notation is not
  supported by the template engine and will be emitted literally.

- Consumer-root-relative paths (LRN-050). Scripts run from the consumer's
  cwd, not the harness source location. Never use `import.meta.url` or
  `process.cwd()` to resolve consumer-repo files.

- Cross-repo path discipline (LRN-105). When a sub-agent operates in a repo
  OTHER than the orchestrator's, every path in the briefing must be rooted
  in the executing repo. For composed-block edits in a consumer repo:
  edit `<consumer-root>/<file>` between `<​!-- harness:local-start id=X -->`
  markers, NOT `template/composed/<file>` (that path only exists in the
  harness repo). Disambiguate any `template/`, `scripts/`, or other
  directory name that exists in both repos with different semantics.

- Fail-closed parsers (LRN-033). Malformed JSON/YAML/etc → clear error
  message to stderr + process.exit(1). NEVER silent default. NEVER let a
  stack trace be the only error signal.

## Self-checks before reporting

Run all of the following and include each result in SELF-CHECKS RUN:

1. `git status --short` — only owned files appear; nothing staged.
2. `git log --oneline -1` — must match preflight SHA.
3. Text-encoding check on every modified file (BOM + line endings; LRN-065, LRN-074):
   `node scripts/check-text-encoding.mjs --dir <owned-paths> --quiet`
   must exit 0. (Replaces the prior inline PowerShell BOM-check snippet; the
   linter also catches CRLF/bare-\r line endings introduced by Windows
   core.autocrlf or stale editor settings.)
4. If tests were added/modified: `node --test` — report count delta
   (e.g. "23 → 27 tests; all pass").
5. For any .mjs files authored: `node -c <file>` exits 0.
6. If template files were modified (anything under `template/`): run the
   templates linter — `node scripts/check-templates.mjs --dir template --cwd .`
   must exit 0 (LRN-049/050/051: no dot-notation placeholders, no relative-up
   paths, no self-referencing TODO/FIXME tokens in PR-template files).

## Reporting independence (CS48 / issue #142)

**Self-review carries zero review weight.** Any implementer self-review of
the diff is a debugging aid, not a review-of-record. The orchestrator MUST
dispatch a separate reviewer sub-agent (per REVIEWS.md § Phase 2) whose model
differs from every implementer model used in the CS. The `harness review <pr>` CLI obtains the rubber-duck review; do not
pre-empt that step or present implementer self-review as review evidence.

Required final report field: `IMPLEMENTER MODEL USED` (the model-id(s)
materially used for the sub-agent's work), so the orchestrator can update the
CS sub-agent ledger and the PR-body `## Model audit` table.

## Mandatory report shape

Reports missing any field are rejected; orchestrator re-dispatches with
missing fields explicitly listed.

    STATUS: complete | partial | blocked
    PREFLIGHT SHA: <sha>
    FINAL SHA: <sha>
    SUMMARY: <one paragraph>
    IMPLEMENTER MODEL USED: <model-id(s) materially used for this work; used by the CS sub-agent ledger and PR-body ## Model audit>
    FILES CHANGED:
      - <path> (created | edited | deleted) — <one-line why> — <line count>
    SELF-CHECKS RUN:
      - git status / git log / text-encoding / [other checks]: pass | fail
    DECISIONS MADE:
      - <decision> — rationale
    ESCALATIONS: (none) | <issue> — recommended path
    LEARNINGS CANDIDATES: (none) | <category>: <problem>: <finding>: <evidence>
    NEXT STEPS (if partial/blocked):
      - <what's needed to complete>
```

### Canonical reviewer preamble (CS35 C35-1)

When dispatching a rubber-duck reviewer manually (per [REVIEWS.md § 2.1](REVIEWS.md#21-review-model)),
the orchestrator MUST paste the block below verbatim into the dispatch.
For content PRs on CS52+, prefer `harness review <pr>` (see
[§ Reviewer dispatch via `harness review`](#reviewer-dispatch-via-harness-review-cs52));
it composes the same guardrailed prompt for the manual MVP. The harness CLI
still does not call an LLM API; the orchestrator dispatches the emitted prompt
and paste-protocols the structured reviewer output.

The block is delimited by sentinel markers so `tests/operations-reviewer-preamble.test.mjs`
can assert presence and required-field coverage:

<!-- harness:reviewer-preamble:start -->
## Reviewer dispatch — canonical preamble

**role:** Independent rubber-duck reviewer for the active CS.

**scope:** Review the diff at the current HEAD against the base branch,
the active CS file (Decisions, Deliverables, Tasks), the test count delta,
and any sub-agent reports. Produce findings classified per
REVIEWS.md § 2.6 (Blocking | Non-blocking | Suggestion). For doc-heavy or
prose PRs, you MUST ALSO perform fact-claim verification per REVIEWS.md
§ 2.6a: (F1) every `--flag` mentioned actually exists in `bin/harness.mjs`
help text, library code, or pass-through `scripts/*.mjs` (e.g.
`harness review-output` forwards to `scripts/check-review-output.mjs`);
(F2) every file path mentioned actually exists
in the tree at this HEAD; (F3) every doctrine-strength claim (`required`,
`mandatory`, `enforces`, `recommended`, `optional`) matches the cited
source's wording verbatim or via a documented synonym; (F4) every LRN/CS
summary stays within the source entry's Problem/Finding scope (no
generalisation); (F5) cross-doc claims (CHANGELOG vs OPERATIONS vs README
vs LRN) are mutually consistent. Do NOT issue a Go verdict on a doc PR
based on diff-internal coherence alone — cross-check claims against the
shipped surfaces they reference. For changes that add or edit a config or
schema reader, you MUST ALSO perform schema-conformance verification per
REVIEWS.md § 2.6b: (S1) the reader requires no field the schema marks
optional/defaulted; (S2) each default-when-absent matches the schema's
declared `default` (or a documented divergence); (S3) present-but-malformed
values fail closed against the schema's `type`/`pattern`/`enum`.

**independence-invariant:** Your model MUST NOT appear in the active CS file's
`## Model audit` `Implementer models` field. If it does, refuse the dispatch
and instruct the orchestrator to escalate per the C35-2 fallback ladder.
Beyond model independence, agent-identity independence (CS35 C35-18) also
applies: your GitHub username MUST differ from the implementer agent's.

**model-fallback-ladder (per CS35 C35-2):** GPT-highest-available
(5.5 → 5.4 → ...) → Claude Sonnet-highest (4.7 → 4.6 → ...) → orchestrator's
own model (last resort, requires explicit user waiver and is forbidden for
HIGH-RISK CSs per REVIEWS.md § 2.3).

**output-schema-link:** Your report MUST conform to REVIEWS.md § 2.6
(Findings taxonomy) and § 2.7 (Finding disposition). For
plan-vs-implementation reviews, also conform to OPERATIONS.md
§ Plan-vs-implementation review (close-out gate). Always report a verdict:
`Go` / `Needs-Fix` / `Block`.

**required-output-fields:** Every plan-vs-implementation review row you (or the orchestrator on your behalf) record in the active CS file's `## Plan-vs-implementation review` table MUST contain these five fields, in this order:

- `model:` the reviewer model identifier (e.g., `gpt-5.5`) — drawn from the C35-2 fallback ladder above; must satisfy the independence invariant against `Implementer models`.
- `branch HEAD SHA:` the full 40-char SHA you reviewed against. Per CS35 C35-3 stale-diff doctrine, a verdict row whose SHA ≠ current HEAD at merge time is INVALID and forces a re-review (A4 enforces this mechanically in CS36).
- `R-round:` `R1` / `R2` / `R3`. Capped at 3 rounds per C35-2; if R3 returns Needs-Fix, the orchestrator MUST escalate to the user rather than open R4.
- `verdict:` exactly one of `Go` / `Needs-Fix` / `Block` (matches `output-schema-link` above and the A3/A4 PR-evidence parsers in CS36).
- `evidence link:` a PR comment URL, commit SHA, or file:line reference that cites the primary artefact(s) supporting the verdict. No vibes-based verdicts.
<!-- harness:reviewer-preamble:end -->

After pasting the block, append CS-specific context (which CS, which files
changed, which prior review rounds are on file). Do not modify the block itself.

### Post-review validation (CS40 — `harness review-output`)

After the dispatched reviewer returns its markdown output, the orchestrator
MUST validate the output's content shape via `harness review-output` before
recording the verdict in the active CS file's `## Plan-vs-implementation
review` table or in the PR body's `## Review log`. This closes #145 gap #3
(PR #28's reviewer summary-passed YAML / package.json without per-file
enumeration; the linter would have caught that).

```
harness review-output \
  --review-output <path-to-reviewer-markdown> \
  --round R1 \
  --base <merge-base-sha> \
  --head <pr-head-sha> \
  [--prev-head <prior-head-sha>]   # required for --round Rn
  [--repo <owner/repo> --pr <num> --reviewer-model <id>]   # independence guard
  [--update-pr]   # idempotently appends a row to the PR body's ## Review log
```

What the linter checks (per CS40 C40-2/3/5):

- Reviewer output has an `Analyzed HEAD: <40-char-sha>` line near top.
- For `--round R1`, the per-file enumeration exactly matches `git diff
  --name-only <base>..<head>` (missing files = error; extras = warning).
- Each finding row matches `- [Blocking|Non-blocking|Suggestion] <file>:<line>: <desc>`.
- Verdict line `Verdict: {Go|Needs-Fix|Block}` is present near end. Verdicts
  ≠ Go require at least one finding row.
- Optional independence-invariant guard: if `--repo`/`--pr`/`--reviewer-model`
  are all provided, fetches the PR body via `gh` and asserts the reviewer
  model is NOT in the implementer model set.

Exit 0 = pass (warnings allowed); exit 1 = at least one error; exit 2 = bad
usage. The aggregator `harness pr-evidence` does NOT include this gate (per
C40-8 — it requires the reviewer-output file which is not available in CI);
this is a standalone orchestrator-side step.

### Sub-agent report shape (mandatory)

Every sub-agent reports back with **exactly** this structure. A report
missing any field is rejected; the orchestrator re-dispatches with the missing
fields explicitly listed.

#### Reporting independence (CS48 / issue #142)

**Self-review carries zero review weight.** Any implementer self-review of
the diff is a debugging aid, not a review-of-record. The orchestrator MUST
dispatch a separate reviewer sub-agent (per REVIEWS.md § Phase 2) whose model
differs from every implementer model used in the CS. The `harness review <pr>` CLI obtains the rubber-duck review; do not
pre-empt that step or present implementer self-review as review evidence.

Required final report field: `IMPLEMENTER MODEL USED` (the model-id(s)
materially used for the sub-agent's work), so the orchestrator can update the
CS sub-agent ledger and the PR-body `## Model audit` table.

```
STATUS: complete | partial | blocked
SUMMARY: <one paragraph>
IMPLEMENTER MODEL USED: <model-id(s) materially used for this work; used by the CS sub-agent ledger and PR-body ## Model audit>
FILES CHANGED:
  - <path> (created | edited | deleted) — <one-line why>
SELF-CHECKS RUN:
  - <check name>: pass | fail (<details if fail>)
DECISIONS MADE:
  - <decision> — rationale
ESCALATIONS (orchestrator action required):
  - <issue> — recommended path
LEARNINGS CANDIDATES:
  - <category>: <problem>: <finding>: <evidence>
NEXT STEPS (if partial/blocked):
  - <what's needed to complete>
```

### Per-CS sub-agent ledger

The active CS file's `## Tasks` table records each dispatched sub-agent.
The `Notes` column uses a fixed format (per
[TRACKING.md § CS file structure](TRACKING.md#cs-file-structure)):

```
agent-id=<id> | role=<short role> | report-status=<value> | learnings=<N>
```

**`report-status` lifecycle:**

| Value | Meaning |
|---|---|
| `pending` | Slot reserved at claim time, not yet dispatched (initial value). |
| `dispatched` | Sub-agent invoked; awaiting completion notification. |
| `complete` | Sub-agent reported back successfully (matches `STATUS: complete`). |
| `partial` | Sub-agent reported partial completion; orchestrator decides next step. |
| `blocked` | Sub-agent cannot proceed; orchestrator escalates or re-dispatches. |

`learnings` is the integer count of learning candidates surfaced. Use `0`
for "none surfaced"; `-` is invalid.

Example row:

```
| Author harness.config.schema.json | done | sub-agent | agent-id=cs02-schema-config | role=schema-author | report-status=complete | learnings=1 |
```

### Post-completion verification

After each parallel-dispatch wave the orchestrator verifies disk state before
declaring the wave complete ([LRN-017](LEARNINGS.md#lrn-017)):

- `git status --short` — only the expected files appear; nothing unexpected.
- Per-file size check — compare reported line/byte counts against actual
  on-disk counts. A sub-agent's report describes what it *intended* to leave;
  file races leave stubs that pass their own unit tests but have none of the
  rich APIs the report claims.
- Spot-check claimed APIs — `grep` for key exported symbols or function names.

If the on-disk state contradicts the report, the work was lost to a file race.
Re-dispatch with a recovery briefing OR accept the simpler version with an
explicit deferral note in the CS file.

### Review fix-round heuristic ([LRN-047](LEARNINGS.md#lrn-047))

When GPT-5.5 review surfaces findings after a dispatch wave:

- **(# findings) × (# affected files) ≤ ~6:** handle inline by the
  orchestrator in the same session.
- **> ~6:** dispatch a dedicated fix-round sub-agent
  (e.g. `cs<NN>-fixes-r1`).

Budget **≥3 review rounds** for any user-facing CS surface (CLI flags, help
text, platform portability). Even "thin wrapper" CLIs generate 5–10 findings
per round ([LRN-031](LEARNINGS.md#lrn-031)). Engine code with strict safety
invariants may require 5–8 rounds ([LRN-024](LEARNINGS.md#lrn-024)).

### Progress observability

- `background` sub-agents notify on completion; use `read_agent`
  (with `wait: true` once notified) to retrieve the structured report.
- Use `list_agents` to poll only when actively blocked on a result.
- The orchestrator does **not** dispatch sub-agents speculatively — every
  dispatch maps to a parallelisation-table entry in the active CS plan.

### Orchestrator availability invariant

The orchestrator must remain available to receive and act on user instructions
at all times. Treat delegation as the default: any task the orchestrator could
plausibly delegate to a sub-agent — including out-of-CS hotfixes, one-off doc
edits, single-file follow-ups, and post-CS cleanups — means the orchestrator
should delegate unless (a) the work is so small that dispatch overhead exceeds
the work, (b) the orchestrator must serialize the change with imminent
sub-agent dispatch, or (c) the user explicitly asked the orchestrator to do it
directly.

When in doubt, dispatch. The orchestrator's primary job is coordination,
triage, user responsiveness, and review-loop steering; implementation work is
secondary when it would block those responsibilities.

### Sub-agent progress reporting

**Progress reporting (required):** every dispatch must require the sub-agent to
emit a one-line update after each owned-file commit, or after each owned-file
edit batch when the briefing prohibits commits, and after any tool invocation
that takes more than 5 minutes. Each update states the current subtask,
approximate completion percentage, and blockers if any.

Silence longer than 15 wall-minutes without an update is a stall signal. The
orchestrator should check the agent, re-brief, re-dispatch, or escalate rather
than letting a silent background task consume the coordination slot invisibly.

### Reviewer dispatch via `harness review` (CS52)

For content PR review rounds, run the combined review orchestrator instead of
hand-stitching the rubber-duck prompt, Copilot engagement, polling, and PR-body
evidence updates:

```
harness review <pr> [--repo owner/name] [--model gpt-5.5|sonnet-4.6] [--round R<n>]
```

The command validates the target PR, refuses workboard-only or fork PRs,
enforces the reviewer-model independence invariant, emits the manual MVP
rubber-duck prompt, optionally triggers/polls Copilot, and idempotently updates
`## Review log` plus `## Model audit`. Use `--dry-run` to preview the planned
round, `--no-poll` to dispatch only, `--rubber-duck-only` for local review
without Copilot, and `--copilot-only` for a Copilot retry after a valid local
Go row is already recorded.

Exit codes are operationally meaningful: `0` means Go / dispatch accepted,
`1` means No-Go or unresolved Blocking finding, and `2` means usage, policy, or
transport failure. Do not merge a content PR until the latest row for the
current HEAD has a Go verdict and Copilot review evidence satisfying the A5/A16
ordering gates in REVIEWS.md.

---

## Copilot engagement procedure (CS35 C35-10, updated CS37 + CS41)

GitHub Copilot review engagement on a content PR (gate A16 in REVIEWS.md
PR-evidence list) is performed locally by the orchestrator using
`harness copilot-engage` (CS41). The CI workflow only VERIFIES
the engagement happened (PR-evidence gate dispatched by
`harness pr-evidence` via `scripts/check-copilot-review.mjs` from CS37);
CI never mutates the PR.

**Spike outcome (CS37, ADR-0004):** the `requestReviews` GraphQL mutation
REJECTS the Copilot reviewer ID with "Could not resolve to User node"
because the Copilot reviewer is `__typename: Bot`, not `User`. The
documented engagement primitive is therefore the REST-backed
`gh pr edit --add-reviewer` invocation that `harness copilot-engage`
wraps — NOT a GraphQL mutation. See `docs/adr/0004-copilot-graphql-spike.md`
for the full transcript.

### Recommended invocation (CS41+):

```
harness copilot-engage <pr-number> [--repo owner/name] [--head <sha>] [--no-poll] [--poll-timeout 300] [--submitted-after <iso>]
```

The CLI:

1. Auto-detects `--repo` from the current working directory's `git remote origin url`
   when omitted. Errors with a clear message on detached/missing remotes.
2. Resolves the Copilot reviewer's Bot node ID via the
   `node(id: $id) { ... on Bot { databaseId login } }` GraphQL fragment with
   the hardcoded Copilot Bot node ID `BOT_kgDOCnlnWA` (cached for 7 days
   under `~/.cache/harness/copilot-id.json` per C41-2). The hardcoded ID is
   required because `user(login: 'copilot-pull-request-reviewer')` returns
   `null` per the CS37 GraphQL spike — see [LRN-009](LEARNINGS.md#lrn-009)
   and [ADR-0004 § ADR4-2](docs/adr/0004-copilot-graphql-spike.md#adr4-2).
3. Shells out to `gh pr edit <pr> --add-reviewer copilot-pull-request-reviewer` to
   request the review (per ADR-0004 § ADR4-2 — `requestReviews` GraphQL rejects
   Bot IDs).
4. Polls the PR's reviews via GraphQL every 30s up to `--poll-timeout` (default 300s);
   by default the poll HEAD is the PR's GitHub `headRefOid`, not the cwd's local
   git HEAD. `--head <sha>` is an opt-in override, and the CLI warns when the
   detected local HEAD differs from the PR head. The command exits 0 when at least
   one Bot review by `copilot-pull-request-reviewer` with state ∈ {APPROVED,
   COMMENTED, CHANGES_REQUESTED} is observed at the selected PR head AND submitted
   at or after the engage-request timestamp (or the explicit `--submitted-after <iso>`
   floor if provided). The submitted-after floor enforces the A5 ordering doctrine:
   a stale Copilot review on the same HEAD that predates the latest local Go MUST NOT
   satisfy the gate.
5. Exits 0 immediately after the request when `--no-poll` is set (CI use case
   where verification happens in a separate job).
6. Exits 2 on fork PRs (`isCrossRepository == true`) with the maintainer-rerun
   hint per ADR4-6.

The poll predicate is identical to the A5+A16 gate
(`scripts/check-copilot-review.mjs`) so "engage CLI says satisfied" =
"PR-evidence gate says satisfied".

Windows authoring reminder: the harness repo stays LF-clean and BOM-free.
Normalize any PR-body or review-log scratch text before writing tracked files;
`scripts/check-text-encoding.mjs` already respects `.gitignore`, so transient
ignored scratch paths such as `.tmp/` are skipped.

### Manual fallback (only if `harness copilot-engage` is unavailable):

1. Request a Copilot review with the maintainer's `gh` auth:
   ```
   gh pr edit <pr-number> --add-reviewer copilot-pull-request-reviewer
   ```
2. Wait 3–5 minutes; Copilot's review pipeline is asynchronous (typically
   delivers within ~3 minutes per spike S3).
3. Verify the review was submitted AND is on the current HEAD:
   ```
   gh api graphql -f query='
     query($owner: String!, $name: String!, $pr: Int!) {
       repository(owner: $owner, name: $name) {
         pullRequest(number: $pr) {
           headRefOid
           reviews(last: 20) {
             nodes {
               state
               submittedAt
               commit { oid }
               author { __typename ... on Bot { login } ... on User { login } }
             }
           }
         }
       }
     }' -F owner=<owner> -F name=<repo> -F pr=<pr-number>
   ```
   The CS37 verifier `scripts/check-copilot-review.mjs` runs the same
   query and enforces A5 + A16 (state, currency, ordering vs local Go).
4. Address every Blocking finding before merge per REVIEWS.md § 2.7.

Decision authority: step (1) requires maintainer credentials; the
harness CLI MUST run engagement only under the maintainer's `gh` auth,
never under a CI `GITHUB_TOKEN` (which is read-only on fork PRs anyway
per Decision C35-9).

### A5 ordering doctrine (PR #172 reconfirmation, CS40):

Each new HEAD requires a NEW `R` row in the PR body's `## Review log`
section. The latest local Go row's timestamp must be BEFORE the
most-recent Copilot review's `submittedAt`. If you add a Go row AFTER
Copilot has reviewed, you MUST re-engage Copilot (re-run
`harness copilot-engage <pr>`) so a new review lands on the new HEAD.
Wait ~3–4 minutes for the new review then re-run failed CI jobs. The
A5+A16 gate enforces this strict ordering mechanically.

CI implication (ADR4-8): an engage-and-verify workflow run will always
fail the verify step on first execution because the review is delivered
asynchronously after the workflow completes. CS38a CI splits engage
and verify into separate jobs/events (e.g. engage on `pull_request`,
verify on a later `pull_request_review` or scheduled rerun).

Fork PR caveat (ADR4-6): on `pullRequest.isCrossRepository == true`, the
`check-copilot-review` gate exits 2 with a maintainer-rerun hint —
forks cannot self-engage Copilot under their own token. `harness copilot-engage`
mirrors this exit-2 behavior on fork PRs.

### Troubleshooting (CS45):

If `harness copilot-engage` exits with `cache-write-failed` (exit code 5),
the most common cause is a read-only `$HOME/.cache/` (e.g. hardened CI
runner, sandboxed home directory). Override the cache directory with
`--cache-dir <writable-path>` to redirect identity-cache writes to a
location the process can write to.

---

## PR-evidence aggregator (CS36)

`harness pr-evidence` is the **single entry point** that runs the mechanical
PR-state evidence gates against an open PR's commit graph and body markdown.
It exists as a separate subcommand (not folded into `harness lint`) because
PR-state checks need PR context (`--base`, `--head`, `--pr-body`) that
default `harness lint` runs do not have (per CS35 decision C35-17).

### Gates registered

| Gate | Predicate script | Owns |
|---|---|---|
| B1 | `scripts/check-pr-commits.mjs` | Every commit in `<base>..<head>` carries the `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>` trailer. |
| A3 | `scripts/check-review-evidence.mjs` | PR body's `## Model audit` rows have no implementer-vs-reviewer model overlap. |
| A4 | `scripts/check-review-evidence.mjs` | PR body's `## Review log` latest `Go` row's `analyzed_head` equals `--head`. |
| A5+A16 | `scripts/check-copilot-review.mjs` | (CS37) Copilot review verifier — confirms `copilot-pull-request-reviewer` (`__typename: Bot`) submitted a review at the current HEAD with state in `{COMMENTED, APPROVED, CHANGES_REQUESTED}` AND submitted-at is after the latest local Go (A5 ordering, ADR4-5). Conditional dispatch: requires `--repo` + `--pr`; skipped with notice otherwise. Forks exit 2 with maintainer-rerun hint per ADR4-6. |
| A6 | `scripts/check-clickstop-plan-review.mjs` | Diff-scoped: any planned/active CS file in the PR diff carries a fresh `## Plan review` row with verdict in `{Go, Go-with-amendments}` (predicate from CS35b, `--files <csv>` invocation per CS36 C36-11). |

A3 and A4 share a single script because they parse the same PR body. A6
re-uses the CS35b predicate; the aggregator computes the diff-scoped file
list (`git diff --name-only $base..$head -- project/clickstops/{planned,active}/`)
and threads it via `--files` so that pre-arc grandfathered files cannot
fail unrelated PRs ([LRN-108](LEARNINGS.md#lrn-108)). A5+A16 is a single
script because both gates share the same GraphQL fetch — exposing them as
two scripts would double the API spend without adding signal (per ADR4-3).

### Canonical local invocation (orchestrator pre-PR sanity check)

```sh
PR_BODY=$(mktemp)
gh pr view <num> --json body --jq .body > "$PR_BODY"
node bin/harness.mjs pr-evidence \
  --base "$(gh pr view <num> --json baseRefOid --jq .baseRefOid)" \
  --head "$(gh pr view <num> --json headRefOid --jq .headRefOid)" \
  --pr-body "$PR_BODY"
```

Exits 0 when all gates pass, 1 on any gate failure, 2 on bad usage.

### Canonical CI invocation (CS38a wiring)

The harness ships a managed workflow template at
`template/managed/.github/workflows/pr-evidence-lint.yml` (added by CS38a).
Consumers opt in via `harness init --enable-review-gates` (writes the
`review_gates` block in `harness.config.json`, migrates
`.github/pull_request_template.md` from the `managed` to the `composed`
file class so consumers can keep custom prose, and prints branch-protection
instructions per C38a-7/8) and the next `harness sync` lands the workflow
in the consumer repo.

The workflow is split into TWO jobs per [ADR4-8 (`docs/adr/0004-copilot-graphql-spike.md`)](https://github.com/henrik-me/agent-harness/blob/main/docs/adr/0004-copilot-graphql-spike.md):

- **`read-only-gates`** runs on `pull_request` (`opened`, `synchronize`,
  `reopened`, `edited` per [LRN-100](LEARNINGS.md#lrn-100)) with
  `permissions: { contents: read, pull-requests: read }`. Computes
  `--skip-reasons` from the event payload (workboard-only label,
  `[bot]`-suffix login, fork detection via `head.repo != base.repo`),
  then invokes `node "$HARNESS_DIR/bin/harness.mjs" pr-evidence` with
  `--base $PR_BASE_SHA --head $PR_HEAD_SHA --pr-body /tmp/pr-body.md
  --repo $GH_REPO_FULL --pr $PR_NUM`. This job NEVER mutates the PR.
- **`mutation-engage`** runs on `workflow_dispatch` only, with
  `permissions: { contents: read, pull-requests: write }`. Calls
  `gh pr edit "$PR_NUM" --add-reviewer copilot-pull-request-reviewer`
  per ADR4-2. Engagement and verification MUST live on separate events
  because Copilot delivers reviews asynchronously (~3 min); a single-run
  engage-and-verify will always fail the verify step the first time.

The workflow uses the canonical clone-then-`node bin/harness.mjs` install
pattern from `.github/workflows/harness-checks.yml` (NOT `npx harness@<ref>`
— `harness` is a private package and npm 10.8.x's GitFetcher regression
makes `npx` invocation flaky). The derive-ref step validates the resolved
ref against the allowlist `^[a-zA-Z0-9._/-]+$` (CS12 R1 — shell-injection
hardening) and uses environment-variable indirection for all interpolation.

CI step is OPT-IN per repository (consumers list
`pr-evidence-lint / read-only-gates` in their branch ruleset's required
status checks). The instruction block emitted by `harness init
--enable-review-gates` is intentionally manual: the harness CLI does not
assume maintainer authority to apply branch rulesets remotely.

### Skip-reasons matrix (CS35 C35-19 / CS36 C36-5)

The aggregator centralises skip semantics so individual gate scripts do not
duplicate skip logic. The caller (CI workflow or orchestrator) computes
skip applicability and passes via `--skip-reasons <csv>`:

| Skip reason | B1 | A3 | A4 | A6 | Notes |
|---|---|---|---|---|---|
| `workboard-only` | skip | skip | skip | skip | Short-circuits to exit 0; used for workboard-only PRs (claim/close-out) per CS35-7. |
| `bot-author` | skip | skip | skip | run | A6 still runs because plan attestation is not author-dependent. |
| `fork-source` | run | run | run | run | Read-only gates remain in force; A16 (CS41) is the gate this reason will skip. |

The harness MUST NOT call `gh pr view` or any other authenticated API to
determine skip applicability — caller computes and passes the CSV. This
keeps `harness pr-evidence` callable from forked PR contexts where the
runner has only `read` permissions (per CS35 C35-9).

### Output modes

- Default: human-readable per-gate sections + a summary line listing
  pass/fail counts.
- `--quiet`: suppresses per-gate output; prints only the summary line.
  Suitable for CI logs that want to surface failure detail only via
  `actions/upload-artifact` of the gate-specific stderr streams.
- `--json`: emits a structured `{gates: [{name, status, exitCode}]}`
  payload to stdout. Suitable for downstream tooling (e.g. PR comment
  renderers added in a future CS).

### Wiring discipline

The `harness lint` aggregator (root linter) MUST NOT register the three
PR-evidence linters. Wiring them into `harness lint` would force every
local lint run to require `--base`/`--head`/`--pr-body`, which is hostile
to the local pre-PR convenience use case (per CS35 decision C35-17). The
PR-evidence linters are dispatched ONLY via `harness pr-evidence`.

---

## Init

`harness init` bootstraps a consumer repo with the harness file-class
manifest, scaffolds `harness.config.json` and `.harness-lock.json`, and
optionally opts the project into the PR-evidence gate set.

### `--enable-review-gates` (CS38a)

Passing `--enable-review-gates` to `harness init` performs three idempotent
operations:

1. **Patches `harness.config.json`** with a `review_gates` block — by default
   `{ enabled: true, copilot_required: true, gate_set: ['B1','A3','A4','A5','A16','A6'] }`.
   The default gate set is the CS37 spike PASS branch — full A5+A16
   enforcement (per [ADR4-1](https://github.com/henrik-me/agent-harness/blob/main/docs/adr/0004-copilot-graphql-spike.md)).
   Custom gate sets are accepted via direct config edit; the schema enum
   bounds the vocabulary.
2. **Migrates `.github/pull_request_template.md`** from `managed.files`
   to `composed.files` via `lib/file-class-migration.mjs`. The composed
   override gets `_inherited_class: 'managed'` (records the prior class
   for future audit) and `local_blocks: ['pull-request.review-evidence']`
   (the marker block carrying the `## Model audit` + `## Review log`
   tables that CS37's A5+A16 + CS36's A3+A4 read). Consumers that
   already have local prose in their PR template need to re-add it
   (the marker block is appended; outside-marker prose from the prior
   managed template is preserved as the composed skeleton).
3. **Lands the workflow file** `template/managed/.github/workflows/pr-evidence-lint.yml`
   in the consumer repo on the next `harness sync`.

After completion, the command prints a branch-protection instruction
block. The instruction is intentionally manual — the harness CLI does
NOT silently apply branch rulesets because branch-protection mutations
require maintainer authority that the harness deliberately does not
assume (per C38a-8).

The flag is opt-in (`review_gates.enabled` defaults to `false` in
v0.4.0). The default flips to `true` in v0.5.0 (CS41) once the
`harness copilot-engage` wrapper closes the manual-step gap.

Idempotency: re-invoking `harness init --enable-review-gates` on an
already-migrated repo is a no-op (re-emits the instruction block,
makes no config or filesystem changes).

---

## Sync

`harness sync` updates managed and composed files in a consumer repo from the
pinned harness version recorded in `.harness-lock.json`.

### Previewing an upgrade — `harness upgrade`

`harness upgrade <ref>` is a **read-only preview** of bumping the pinned harness
to `<ref>` (a semver tag, branch, or 40-char SHA). It fetches that ref's
templates and runs a **dry-run** `sync` against the consumer repo, printing the
list of files that would change (per-file action + class) + a change-count
summary. **It never writes** — it is additive over `lib/sync.mjs` (no apply-path
rewrite), so it cannot cause data loss. To apply after reviewing: set
`harness.config.json` `version` to `<ref>` and run `harness sync --mode=apply`
(add `--accept-major` for a major bump per § SemVer
policy). This replaces the previous hand-edit-`version`-then-sync-blind workflow
with a previewable upgrade.

### Modes

| Invocation | Behaviour |
|---|---|
| `harness sync` | Apply mode (default): writes updates to disk. |
| `harness sync --check` | Check mode: exits non-zero if any file is out of sync; writes nothing. Suitable for CI. |
| `harness sync --dry-run` | Dry-run mode: prints what would change; writes nothing. |

### Flags

- **`--config <path>`** — alternate config file path (default:
  `harness.config.json` in `--cwd`). The aggregator must resolve this path
  once and thread it to every subcommand
  ([LRN-038](LEARNINGS.md#lrn-038)).
- **`--cwd <path>`** — treat `<path>` as the consumer repo root.
  Default: `process.cwd()`.
- **`--accept-major`** — required when the resolved template version is a
  major bump from the pinned version (see § SemVer policy).
- **`--resolved-sha <40hex>`** (apply-mode only) — pin the recorded
  `resolved_sha` field in `.harness-lock.json` to a specific 40-character
  lowercase hex commit SHA, instead of letting the engine derive it from
  `git rev-parse HEAD`. Removes the post-commit-regenerate ordering trap
  ([LRN-070](LEARNINGS.md#lrn-070)) for CSs that touch templates AND root
  files in the same commit: commit content first, then `harness sync
  --mode=apply --resolved-sha <commit-sha>` records a lock that points at
  the actual content commit. The override is rejected (exit 2) in
  `--mode=check` / `--mode=dry-run` (only apply writes the lock) and
  rejected if the value is not 40-char lowercase hex.

### File-class behaviour

| Class | Sync behaviour |
|---|---|
| **managed** | Overwrite unconditionally with the rendered template. Consumer edits are lost. |
| **composed** | Re-render template sections; splice in preserved local-block contents. Consumer prose outside markers is replaced; block contents are kept verbatim. |
| **seeded** | Create if missing (seed once); skip completely if the file already exists. |
| **excluded** | Never touched (e.g. `README.md` per ADR 0002). Listed in `harness.config.json` `excluded[]`. |

### `review_gates` block currency (CS38a / CS41)

`harness sync` checks the `review_gates` block in `harness.config.json`
against the version pinned in `.harness-lock.json`:

- **v0.4.0 (CS38a):** if `review_gates` is absent, sync emits a WARN
  to stderr advising the consumer to run `harness init
  --enable-review-gates` to opt in. Sync still succeeds (exit 0). The
  warning is suppressed by `--quiet`.
- **v0.5.0 (CS41):** the warn is escalated to an ERROR — sync exits 1
  unless `review_gates` is present (any value, including `enabled: false`).
  Consumers that want to remain opted-out must EXPLICITLY record
  `review_gates: { enabled: false }` to acknowledge the choice. Silent
  absence is no longer a valid state because by v0.5.0 the gates are
  the default expectation, not the exception.

Document this escalation path in CS41's release notes; the v0.5.0
upgrade guide must list the manual edit required for any consumer
that wants opt-out without invoking `harness init --enable-review-gates`.

### Composed file sync invariant

For each composed file, the sync engine:

1. Parses the consumer file and extracts all local-block contents by ID.
2. Renders the template (substituting `{{templating}}` variables from config).
3. Splices preserved block contents back into their marker positions.
4. Writes the result atomically.

If the consumer file contains **non-template, non-block content** not covered
by a `legacy_composed_mapping.json` entry, sync exits non-zero and writes
nothing (fail-closed per ADR 0001 § Legacy-content fail-closed invariant).
Use `harness composed-audit --from-existing-harness` to generate the initial
mapping when migrating an existing file onto the harness.

### Integration testing for templated outputs (LRN-057)

Any change to seeded skeletons or composed templates must be validated with the
init → sync-check integration path: run `harness init` into a fresh consumer
repo, then run `harness --cwd <consumer> sync --mode=check`. The sync check
must exit 0 with `No drift detected` and must not mutate files.

This catches bug classes that lint alone can miss: inline harness markers in
prose, unresolved or malformed template placeholders, and composed-merge edge
cases that only appear when the seeded `harness.config.json` selects the
rendered template set. LRN-057 is the canonical example: individual linters
passed, but sync-check rejected the init-produced OPERATIONS.md because the
composed parser saw marker-like prose end-to-end.

### Composed marker syntax

Local blocks are delimited by HTML comment markers. The `id` attribute must
match `[a-z][a-z0-9.-]*`. Markers must occupy the full line (no inline use).
Nesting is an error. Duplicate IDs are an error. Every `local-start` must
have a matching `local-end`. See ADR 0001 § Composed marker syntax and parser
rules for the full normative parser specification.

To document marker syntax inside a code fence (e.g. in tests or this ADR),
insert a zero-width space (U+200B) immediately after the leading `<` to
prevent the parser from treating the example as a live marker.

### Composed-block edits — consumer vs harness-repo paths

When a CS plan or sub-agent briefing tells you to "edit a composed block",
**do the edit at the consumer-repo path**, not the harness-repo template path.
The two are different files:

| Where you are | What to edit | Path |
|---|---|---|
| **Consumer repo** (e.g. `henrik-me/sub-invaders`) | The materialised composed file at the repo root, between its `<​!-- harness:local-start id=… -->` / `<​!-- harness:local-end id=… -->` markers | `<repo-root>/CONVENTIONS.md`, `<repo-root>/OPERATIONS.md`, `<repo-root>/REVIEWS.md` |
| **Harness repo itself** (`henrik-me/agent-harness`) | The template that generates every consumer's composed file. Edits here propagate to all consumers on next `harness sync`. | `template/composed/CONVENTIONS.md`, `template/composed/OPERATIONS.md`, `template/composed/REVIEWS.md` |

The CS plan template historically used harness-repo-relative paths (e.g.
"edit `template/composed/CONVENTIONS.md`") because those plans were authored
in the harness repo. **In a consumer repo, those paths do not exist.** The
orchestrator briefing template now reminds dispatchers to translate to
consumer-relative paths before sending a sub-agent into a consumer repo.

A sub-agent that finds itself looking for `template/composed/...` inside a
consumer repo should escalate ("the dispatch path appears to reference the
harness repo, not this consumer repo — please clarify") rather than silently
guess. ([SI Finding #6](LEARNINGS.md), CS30.)

### Mid-CS sync policy

Do **not** run `harness sync` mid-CS unless fixing a harness blocker. Running
mid-CS when the harness version has changed may unexpectedly update managed
and composed files. The CLI warns when sync is invoked while a CS branch is
in flight (detected from the active branch name). Major-version syncs require
`--accept-major` to proceed.

### Reusable CI workflow

`harness-checks.yml` is a reusable GitHub Actions workflow (`on: workflow_call`)
that runs `harness lint` in any consumer repo with roughly ten lines of caller
YAML. Callers reference it via:

```yaml
jobs:
  harness-checks:
    uses: henrik-me/agent-harness/.github/workflows/harness-checks.yml@<ref>
    with:
      cli-ref: ''   # optional — leave blank to auto-read harness.config.json
```

**Version-locking model:** the workflow accepts an optional `cli-ref` input.
When blank (the default), an inline shell step reads the `version` field from
the caller repo's `harness.config.json` and uses that as the install ref for
the harness CLI (`npx -y github:henrik-me/agent-harness#<resolved-ref>`).
When `cli-ref` is set explicitly, that value is used instead. This ensures
local `harness lint` and CI always invoke the exact same harness version —
no version skew between developer machines and the CI runner.

The workflow's steps are: checkout (pinned SHA), setup-node 20 (pinned SHA),
derive-ref shell step, `npx -y github:henrik-me/agent-harness#<ref> lint --quiet`.
All third-party `uses:` refs are pinned to 40-character commit SHAs.

#### Resolving the SHA for an `actions/<owner>/<repo>@<tag>` pin

The standard recipe is:

```bash
gh api repos/<owner>/<repo>/git/ref/tags/<tag> --jq .object.sha
```

**SAML-protected orgs (Azure, several enterprises) — fallback:** when an org
enforces SAML SSO on its GitHub App and your CLI token isn't SSO-authorised,
`gh api repos/<org>/...` returns `403`. The standard recipe then breaks for
common pins like `Azure/static-web-apps-deploy@v1`.

Use `git ls-remote` instead — it works against the org's public HTTP endpoint
without authentication and returns the same SHA:

```bash
git ls-remote https://github.com/<owner>/<repo>.git refs/tags/<tag>
# Output:
# <40-char-sha>    refs/tags/<tag>
```

Pipe through `awk '{print $1}'` to get the bare SHA. ([SI Finding #7](LEARNINGS.md), CS30.)

### Drift-detection workflow

`template/managed/.github/workflows/harness-drift.yml` is a managed workflow
template that consumers receive via `harness sync`. It runs weekly (Monday
06:00 UTC, cron `0 6 * * 1`) and on `workflow_dispatch`, detecting when the
consumer repo has drifted from the harness version pinned in
`harness.config.json`.

**Behaviour:**

1. An inline shell step reads `harness.config.json` `.version` to derive the
   install ref.
2. `npx -y github:henrik-me/agent-harness#<ref> sync --mode=check --cwd .` is
   run and its exit code captured explicitly:
   - **exit 0** — no drift; the workflow sets `drift_detected=false` and all
     subsequent apply/PR steps skip cleanly via `if:` conditions.
   - **exit 1** — drift detected; `drift_detected=true` is set.
   - **any other exit code** — the workflow fails loudly (broken install,
     network error, or harness crash — never silently produces a PR in this
     state).
3. On drift: `sync --mode=apply` is run to generate the update, then
   `peter-evans/create-pull-request` (pinned to a 40-char SHA) opens a PR
   whose body explains the drift, links to the harness ref, and lists changed
   files.

The template uses `sub-invaders` and `henrik-me` placeholders
for PR reviewer/assignee fields; all YAML scalar values containing
`{{...}}` placeholders are quoted so the unrendered template parses as valid
YAML.

**Critical:** never use bare `npx harness ...` in these workflows — the
harness package is not published to npm. Always use
`npx -y github:henrik-me/agent-harness#<ref>`.

---

## Harvest

### Cadence

- **Weekly:** Monday morning, run `harness harvest` (CS04+) and review
  `LEARNINGS.md`. Disposition any `open` entries.
- **Before-claim (CS04+):** run `harness harvest` before claiming (a future
  `harness claim` command will run it automatically — tracked in CS64). It
  surfaces stale `open` learnings tagged `process` or `architectural`, or
  tagged with `claim_area` metadata matching the current CS. Resolve before
  the workboard-claim PR lands.

### Bounded-before-claim invariant

All `open` learnings had to be dispositioned (status `applied`, `obsolete`, or
`deferred` with an explicit `deferred_until` date) before the CS15a public flip.
That invariant is now satisfied in this repository; keep it true before future
public-facing release gates. See `LEARNINGS.md` header for the current status.

### LRN entry format

Each learning entry in `LEARNINGS.md` begins with a YAML frontmatter fence
followed by markdown body sections:

```yaml
id: LRN-<NNN>
date: YYYY-MM-DD
category: tooling | process | architectural | operational | anti-pattern
source_cs: CS<NN>
status: open | applied | obsolete | deferred
tags: [<tag>, ...]
claim_area: <area>          # optional — surfaces entry at claim of matching CS
deferred_until: YYYY-MM-DD  # required when status = deferred
```

Body sections (in order): **Problem**, **Finding**, **Evidence**,
**Disposition**. The schema is `schemas/learning.schema.json`;
`check-learnings.mjs` validates all entries as regression fixtures.

### Learning candidate lifecycle

Learning candidates are surfaced in sub-agent reports under
`LEARNINGS CANDIDATES`. The orchestrator decides whether to elevate each
candidate to a full LRN entry in `LEARNINGS.md`. Every candidate must be
surfaced — no silent decisions. The category `<problem>: <finding>:
<evidence>` format in the report directly maps to the LRN body sections.

### Open-LRN audit

To enumerate `LEARNINGS.md` entries by status (e.g. before a release gate or
during a harvest cadence):

```bash
# All entries by status
grep -E '^status: ' LEARNINGS.md | sort | uniq -c

# Just the open ones (with their IDs)
grep -B 4 '^status: open' LEARNINGS.md | grep '^id: '
```

Each `open` entry needs a status flip to `applied` / `obsolete` / `deferred`
(with `deferred_until: <date>`) before any future public-facing release gate
per the bounded-before-claim invariant above.

---

## SemVer policy

The harness follows [Semantic Versioning 2.0.0](https://semver.org).

### Version bump triggers

| Change type | Bump |
|---|---|
| Breaking config schema change (field removed, renamed, or type changed) | **Major** |
| Removed or renamed CLI flag | **Major** |
| New required config field with no default | **Major** |
| New linter script added | **Minor** |
| New optional config field (backward-compatible addition) | **Minor** |
| New template file added to any class (managed, composed, or seeded) | **Minor** |
| New CLI subcommand added | **Minor** |
| Bug fix with no interface change | **Patch** |
| Documentation or comment clarification, no behaviour change | **Patch** |
| Test-only change | **Patch** |

### Harness update guidance

- **Harness-internal updates** go through their own PR/CS on the harness
  repo. Never fold harness version bumps into a consumer CS.
- **Version mismatch warning:** `harness sync` warns when the installed
  harness version differs from the version pinned in `.harness-lock.json`.
  The warning is informational for Minor/Patch diffs.
- **Major-version sync:** `harness sync` exits non-zero with a descriptive
  message if the resolved template is a major version bump from the pinned
  version. Pass `--accept-major` to override after reviewing the migration
  notes. This prevents silent breakage from schema changes or removed flags.
- **Mid-CS sync:** the CLI warns when sync is invoked while a CS branch is
  in flight. Proceed only when fixing a harness blocker.

### Stub subcommands ([LRN-028](LEARNINGS.md#lrn-028))

Planned-but-unimplemented subcommands must exit **3**, not 0. Exit 0 from a
stub creates a false-positive CI signal — callers cannot distinguish "this
worked" from "this was never implemented". Exit codes:

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Runtime error |
| `2` | Bad invocation (unknown flag or missing required argument) |
| `3` | Planned but not yet implemented |

---

## Conventions

These conventions apply to all harness scripts and CLI code. Quote the
directly-relevant items verbatim in sub-agent briefings.

### ESM only

All harness scripts use ESM (`import`/`export`) and the `.mjs` extension.
No CommonJS `require()`. No `.cjs` files. Node.js 20+. Use `node --test` for
the test runner (no external test framework).

### Line endings and BOM ([LRN-006](LEARNINGS.md#lrn-006), [LRN-018](LEARNINGS.md#lrn-018))

The `create` tool on Windows writes CRLF regardless of `.editorconfig` LF
settings. Files may also carry a UTF-8 BOM. Required normalization after
creating any text file on Windows:

```js
let content = fs.readFileSync(filePath, 'utf8');
// Strip UTF-8 BOM
if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
// Normalize CRLF → LF
content = content.replace(/\r\n/g, '\n');
fs.writeFileSync(filePath, content, 'utf8');
```

All parsers that compare content (composed merge, lock file, doc-schema)
must normalize CRLF and strip BOM in their read step. Using `\r?\n` in
regexes is an acceptable alternative to full normalization in parser contexts.

### Windows `spawnSync` ([LRN-029](LEARNINGS.md#lrn-029))

On Windows, `npm`, `npx`, and other Node-ecosystem wrappers are `.cmd` batch
files, not executables. `spawnSync` or `execFileSync` without `{ shell: true }`
attempts to spawn the wrapper as a binary and returns EINVAL regardless of
whether `'npm'` or `'npm.cmd'` is used as the command name.

Canonical pattern:

```js
import { spawnSync } from 'node:child_process';

const result = spawnSync('npm', ['pack', '--dry-run'], { shell: true });
if (result.status !== 0) { /* handle error */ }
```

Use `{ shell: true }` for **all** npm script invocations. This is the only
safe cross-platform pattern.

### `--help` re-forwarding ([LRN-030](LEARNINGS.md#lrn-030))

A global CLI parser that intercepts `--help` must check whether a subcommand
is also present in the argv slice before printing global help:

```js
// In the global arg parser, before printing global help:
if (argv.includes('--help') && knownSubcommands.has(argv[0])) {
  // --help belongs to the subcommand, not the global invocation
  return dispatchSubcommand(argv[0], ['--help']);
}
```

`harness sync --help` must show sync-specific flag documentation, not global
help. Any global flag added later must apply the same subcommand-context check.

### Explicit `--file` for linters ([LRN-032](LEARNINGS.md#lrn-032))

A `harness <subcommand>` wrapper that invokes a linter script must construct
the consumer-cwd-relative file path explicitly and pass it as `--file`:

```js
// In cmdLint (bin/harness.mjs):
const targetFile = path.join(cwd, 'LEARNINGS.md');
spawnSync(
  'node',
  ['scripts/check-learnings.mjs', '--file', targetFile],
  { shell: true, stdio: 'inherit' }
);
```

Never infer the path from `import.meta.url` inside the linter script. When
the script runs as an installed package dependency, `import.meta.url` resolves
inside the harness package directory, not the consumer repo. The `--cwd` flag
passed to the `harness` CLI defines the consumer boundary; the linter must
receive the consumer-rooted path explicitly.

### `requireValue` arg guard ([LRN-040](LEARNINGS.md#lrn-040))

All linters and CLI commands that take flag values must guard the next token
before consuming it:

```js
function requireValue(args, i, flag) {
  if (!args[i + 1] || args[i + 1].startsWith('-')) {
    process.stderr.write(`${flag}: missing or invalid value\n`);
    process.exit(2);
  }
  return args[++i];
}

// Usage — instead of bare args[i+1]:
case '--file':
  filePath = requireValue(args, i++, '--file');
  break;
```

Bare `if (args[i+1])` is prohibited. It silently consumes the next flag as a
value, producing confusing errors like "file not found: --quiet" with no
indication that argument parsing failed.

### Aggregator config single-source ([LRN-038](LEARNINGS.md#lrn-038))

Aggregator commands that both read config and thread it to child subcommands
must resolve the config path exactly once:

```js
// Resolve once:
const effectiveConfigPath = resolveConfigPath(flags.config, cwd);
const cfg = readConfig(effectiveConfigPath);

// Thread the same variable everywhere — never re-resolve independently:
runChildLinter(['--config', effectiveConfigPath, '--cwd', cwd]);
```

Two separate resolution paths that agree for the default case silently diverge
when a non-default `--config` or `--cwd` is passed by automation.

### Schema is source of truth ([LRN-039](LEARNINGS.md#lrn-039))

Before writing any code that reads `harness.config.json`,
`.harness-lock.json`, or any structured config/lock file:

1. Open the corresponding `schemas/*.schema.json`.
2. Locate the exact field path (e.g. `composed.overrides[file].local_blocks`,
   not `composed_files`).
3. Cross-reference every field access against the schema before writing a
   single line of access code.

Guessing field names from intuition passes unit tests (because the test
fixtures are typically authored against the same guessed name) but fails
integration silently. Two CS06 sub-agents independently hit this: one used
`harness_pin` instead of `version`; the other used `composed_files` instead
of `composed.files`. Both failed only at integration time.

### Stdout/stderr discipline ([LRN-044](LEARNINGS.md#lrn-044))

Scripts that emit a primary artifact to stdout (renderers, exporters) must
maintain a strict channel separation:

- **stdout** — artifact only (clean data channel; suitable for pipe capture).
- **stderr** — progress, status, and warnings (non-quiet mode only).
- **suppressed** — all output except the artifact when `--quiet` is passed.

Mixing progress text on stdout corrupts the artifact for piped callers, even
in `--quiet` mode.

### Fail-closed parsers ([LRN-033](LEARNINGS.md#lrn-033))

Any parser that encounters a malformed structured entry must emit an ERROR
and exit non-zero. Silent `continue` or silent skip violates the fail-closed
invariant and gives false confidence that the document is clean. A block that
contains an `id:` field matching the document's entry-id pattern but fails
YAML parse is not silently dropped — it surfaces as a parse-error result and
the linter emits an ERROR.

### Safety-flag depth ([LRN-045](LEARNINGS.md#lrn-045))

Safety-required flags (e.g. `--redact-required`, `--strict`) must validate
the **substance** of the requirement, not just its surface presence. A flag
named `--redact-required` must verify that the applicable redaction rule
exists and is non-empty — not merely that some config object was loaded. Check
the deepest invariant the flag implies.

---

## Local block

The section below is managed by the project team. Edit only the content
**between** the markers. The markers and all content above are managed by
the harness and will be overwritten on the next `harness sync`. The block ID
`operations.project-deploy` must be listed in `harness.config.json` under
`composed.overrides["OPERATIONS.md"].local_blocks`.

<!-- harness:local-start id=operations.project-deploy -->

## Project-specific deploy operations

### Azure Static Web Apps deploy

- Workflow: `.github/workflows/swa-deploy.yml` triggered on push to `main`.
- Secret: `AZURE_STATIC_WEB_APPS_API_TOKEN` (G5).
- Build artifact paths: `app_location: "src"`, `api_location: "api"`,
  `output_location: ""`.

### .NET 8 isolated Functions build

```bash
dotnet restore api/
dotnet build api/ --configuration Release --no-restore
dotnet test api/ --configuration Release --no-build
```

### Local dev

- Frontend: open `src/index.html` in a browser, or serve via `npx http-server src` for
  module loading.
- Browser E2E: future gameplay-affecting CSes must add at least one Playwright spec
  for the new surface. A new scene must include a Playwright smoke spec for that scene.
- Backend: `func start --csharp` from `api/` (requires Azure Functions Core Tools v4 +
  .NET 8 SDK).

### Azure resource provisioning (G4)

```bash
infra/provision.sh             # uses defaults: rg-sub-invaders-prod, $5 budget
RG_NAME=rg-sub-invaders-test STORAGE_ACCT_NAME=stsubinvaderstest$RAND6 \
  infra/provision.sh           # override via env vars
```

The script is idempotent: re-running on an existing RG verifies the `workload=sub-invaders`
tag and skips create operations that already succeeded.

### Storage Tables persistence (CS03+)

- Storage account: `stsubinvaders$RAND6` (CS01-5).
- Tables created by `infra/provision.sh` Phase 2.5 (idempotent: `az storage table create` with
  a stderr `grep` for `TableAlreadyExists` to treat re-runs as a no-op):
  - `Sessions` — PartitionKey = `yyyyMMdd` (UTC day, sharded for fan-out + cleanup),
    RowKey = `sessionId` (cryptographically random GUID). Columns: `Nonce`, `StartedAt`,
    `Consumed`, `ConsumedAt`. Single-use; replay protection enforced via ETag-conditional
    `UpdateEntityAsync(Replace)` that returns 412 → mapped to HTTP 409 `already_consumed`.
  - `Leaderboard` — PartitionKey = `"all"` for all-time scores or `daily-YYYY-MM-DD`
    for daily scores (date suffix must be a real UTC calendar date), RowKey =
    `<invertedScore D8>_<submissionUuid>` so the natural ascending Table Storage sort
    returns top scores first (inverted score = `99_999_999 - score`, zero-padded to 8 digits).
    Columns: `Score` (int), `FinishedAt` (ISO-8601), `SessionId` (string).
- Cleanup Function (`SessionsCleanup`, `POST /api/admin/sessions-cleanup`,
  `AuthorizationLevel.Function`) deletes Sessions older than 24 h, trims the all-time
  `Leaderboard` partition to the top 10 000 rows (`LeaderboardCap`), and deletes daily
  leaderboard rows from `daily-YYYY-MM-DD` partitions older than
  `DAILY_LEADERBOARD_RETENTION_DAYS` (default 30). Azure Tables has no native TTL; the cleanup
  Function is the source of truth. SWA managed Functions does not support `timerTrigger` (the
  build emits *"Currently, only httpTriggers are supported"*), so the hourly cadence is driven
  by `.github/workflows/sessions-cleanup.yml` (GitHub Actions cron `5 * * * *`) which POSTs to
  the admin endpoint with the function key in the `x-functions-key` header. Manual step: add
  repository Actions secret `SUB_INVADERS_FUNCTION_KEY` with the production Function key and
  rotate it periodically. The workflow logs a skip and exits 0 when the secret is absent
  (fork/Dependabot safety). Mitigation if the scheduler is offline: Sessions are still
  single-use, so storage grows linearly but correctness is preserved; the next successful
  invocation reclaims the backlog.

### Env vars (deploy-time, set in Azure SWA configuration)

| Var | Purpose | When |
|---|---|---|
| `SUB_INVADERS_STORAGE` | Storage Tables connection string for our user-data Tables. Set on the SWA in Phase 3.5 of `infra/provision.sh`. **Cannot use the name `AzureWebJobsStorage`** — SWA reserves it for the platform-managed internal Functions storage and rejects user values with HTTP 400 (`'AzureWebJobsStorage' are not allowed`). Local dev `local.settings.json.example` sets both for parity. | CS03+ |
| `RATE_LIMIT_PER_MINUTE` | Per-IP rate cap on `/api/session` and `/api/score` (default 30) | CS03+ |
| `SUB_INVADERS_COMMIT` / `GITHUB_SHA` | **Removed in #52** — no longer consulted at runtime. The deployed commit SHA is now baked into `AssemblyInformationalVersionAttribute` at build time (`swa-deploy.yml` exposes `BUILD_COMMIT=${{ github.sha }}` to Oryx, which forwards it to `dotnet build`; `BuildInfoProvider` reads the attribute via reflection). | CS03+ |
| `DAILY_CHALLENGE_SEED` | Pin deterministic daily challenge | CS04+ |
| `DAILY_SCORE_MULTIPLIER_CAP` | Multiplier applied to `MAX_SCORE_PER_SECOND` for `period=daily` score submissions (default 4). | CS12+ |
| `DAILY_LEADERBOARD_RETENTION_DAYS` | Daily leaderboard retention window for cleanup (default 30 days). | CS12+ |

### Secret rotation

- `AZURE_STATIC_WEB_APPS_API_TOKEN`: rotate via Azure portal → SWA → Manage deployment
  token; update GitHub secret immediately.
- `SUB_INVADERS_STORAGE`: rotate via Azure portal → Storage account → Access keys; update
  the SWA application settings (the Functions worker re-reads on cold start). Plan a
  rolling key rotation: regenerate key2 first, update settings to key2, then regenerate
  key1.
- `SUB_INVADERS_FUNCTION_KEY`: rotate via Azure portal / Functions key management for the SWA-managed API; update the GitHub Actions secret used by `.github/workflows/sessions-cleanup.yml`.
- Never log secrets in workflows; never copy into the active CS file.

### Configuring deploy-time commit injection (Issue #52) — RESOLVED

Issue #52 originally proposed a post-deploy `az staticwebapp appsettings set`
step gated on an `AZURE_CREDENTIALS` Service Principal secret. That approach
was deemed overkill for the actual ask (surface the deployed commit on
`/api/health` for deploy verification).

The PR that fixed #52 replaced the post-deploy mutation path with **build-time
injection** via `AssemblyInformationalVersionAttribute`:

- `api/Sub-invaders.Api.csproj` declares
  `<InformationalVersion>$(BUILD_COMMIT)</InformationalVersion>` (only when
  `BUILD_COMMIT` is set).
- `.github/workflows/swa-deploy.yml` exports
  `env: BUILD_COMMIT: ${{ github.sha }}` at the `build-and-deploy` job level.
  Oryx (the SWA build engine) forwards env vars to `dotnet build`; modern .NET
  SDK auto-promotes env vars to MSBuild properties.
- `BuildInfoProvider.ParseCommitFromInformationalVersion()` reads the attribute
  via reflection (constructor-time) and validates the prefix is hex
  (7-40 chars after splitting on the SourceLink `+<sha>` suffix) before
  returning the first 7 chars.
  Anything else (MSBuild's default `1.0.0`, a manually-set semantic version,
  garbage) is reported as `"unknown"`.
- Local `dotnet build` / `dotnet test` invocations don't set `BUILD_COMMIT`,
  so they get `"unknown"` (parity with the previous env-var-fallback
  behaviour).

**No Service Principal, no `AZURE_CREDENTIALS` secret, no post-deploy
mutation, no Function host cold restart penalty.** The SHA is part of the
deploy artifact itself.

The `verify-deploy` `health` check (in `scripts/verify-deploy.checks.mjs`)
asserts `body.commit !== "unknown"` and (when `--expected-version` is a hex
SHA) asserts the prefix matches, providing post-deploy verification that the
end-to-end injection chain is intact.

### Coverage policy (CS09)

JS coverage is measured for both the Playwright E2E suite (Chromium V8 via
`monocart-reporter`) and the Node `node --test` unit suite (V8 via `c8`).
Both are wired into the required `coverage` and umbrella `ci` checks on
every PR (declared in the `main` ruleset), so any regression below the
configured floor blocks merge.

There are two layers of enforcement:

1. **Suite-level totals** — c8 `--check-coverage` (unit) and, for E2E, the
   post-Playwright checker `scripts/coverage-suite.mjs` (wired into
   `test:e2e:coverage` after the per-file gate) fail the run when overall
   coverage drops below the suite floor. The monocart `onEnd` hook is now
   informational only — Playwright derives its exit code from test results,
   not a reporter-set `process.exitCode`, so the E2E suite floor is enforced
   by the dedicated checker instead (CS18).
2. **Per-file floors** — `scripts/coverage-perfile.mjs` runs after each
   suite (chained in the npm scripts) and fails the run when any single
   file under `src/game/**/*.mjs` drops below its per-file floor.
   New files automatically inherit the per-file defaults — they cannot
   land below threshold without an explicit, documented override.

**Single source of truth:** [`coverage-thresholds.json`](../coverage-thresholds.json)
holds the suite floors, per-file defaults, and per-file overrides for both
suites. As of CS18 the E2E suite floors (`e2e.suite`) are read directly from
this file by both `scripts/coverage-suite.mjs` (the enforced gate) and
`playwright.coverage.config.mjs` (report coloring + the informational `onEnd`
summary) — there is no duplicated literal to keep in sync. The unit suite
floors still mirror the c8 CLI flags in `test:unit:coverage`.

**Suite-level floors (enforced):**

| Metric | Unit (c8) | E2E (monocart) |
|---|---:|---:|
| Statements | ≥ 90% | ≥ 77% |
| Functions | ≥ 90% | ≥ 77% |
| Lines | ≥ 90% | ≥ 68% |
| Branches | ≥ 85% | ≥ 62% |
| Bytes | — | ≥ 78% |

**Per-file defaults (enforced — new files start here):**

| Metric | Unit | E2E |
|---|---:|---:|
| Statements | ≥ 90% | ≥ 85% |
| Functions | ≥ 85% | ≥ 80% |
| Lines | ≥ 90% | ≥ 80% |
| Branches | ≥ 80% | ≥ 70% |
| Bytes | — | ≥ 80% |

The unit suite hits the canonical CS09 targets (≥90/85/90/90). The E2E
suite plateaus below 90 on `lines` and `branches` because the remaining
gaps are dead-in-production defensive code that the **unit** suite covers
independently. Per-file effective coverage (union of unit + E2E) is well
above 90% for all production files — see overrides for the specific
breakdown. **CS18 re-baseline:** the E2E suite floors were lowered to the
measured aggregate (with a ~1pp margin for V8 run-to-run variance) rather than
writing new offline-scenario E2E specs to chase the old CS09 targets; the gaps
are E2E-thin modules such as `game/modifiers/*` whose behavior the **unit**
suite gates as the primary floor. The suite gate (`scripts/coverage-suite.mjs`)
now reliably blocks CI on any real regression below the re-baselined floor.

**Per-file overrides (E2E):** these **game** files have a documented lower floor in
`coverage-thresholds.json` because the gap is dead-in-production code; the
unit suite covers them. Each override carries a `_reason` field. As of **CS13**
the engine is the external `canvas-game-engine` package — it is no longer
per-file gated here (its coverage is owned upstream), so the former
`src/engine/*` E2E overrides were removed. The engine still ships inside the
production bundle, so its bytes count toward the E2E suite-level aggregate.

| File | Why exempted (E2E only) | Unit % (lines/branches) |
|---|---|---:|
| `src/game/hud.mjs` | Trivial label-formatting branches. | 100 / 91 |
| `src/game/invaders.mjs` | `consumeFireCadence` external-clock branches reachable via API but production play scene uses internal `fireAccumulatorMs`. | 91 / 74 |
| `src/game/player.mjs` | Input-edge-case branches dead in current E2E. | 96 / 79 |
| `src/game/score.mjs` | Storage-failure paths dead in production. | 97 / 90 |
| `src/game/scenes/gameover.mjs` | Input-driven branches partly dead. | 100 / 68 |
| `src/game/scenes/menu.mjs` | Input-driven branches partly dead. | 100 / 75 |
| `src/game/scenes/play.mjs` | `defaultPlayerFactory` / `LOAD ERROR` / async-setup paths dead in production. | 96 / 89 |

**Per-file overrides (unit):** a small number of files carry per-file unit
overrides where small public surfaces or defensive-only branches make 85%
unrealistic; see `coverage-thresholds.json` for the full list and reasons
(notably `game/main.mjs`, `game/scenes/{menu,gameover}.mjs`).

**How to add a new file:** just write it under `src/game/**/*.mjs`
and ship tests. The default per-file floors apply automatically.

**How to add an exception:** if a new file legitimately can't hit the
defaults, add a per-file override entry to `coverage-thresholds.json`
under the relevant suite's `overrides` map with a `_reason` describing
why. Prefer narrowing only the affected metric (e.g. `branches`) rather
than skipping the file entirely.

**How to ratchet floors up:** if a CS pushes a metric well above the
floor, raise the floor to lock the gain:
1. **E2E suite** — edit `coverage-thresholds.json` `e2e.suite` only. Both
   the enforced checker (`scripts/coverage-suite.mjs`) and
   `playwright.coverage.config.mjs` read it; there is no separate literal
   to update (CS18).
2. **Unit suite** — update `coverage-thresholds.json` `unit.suite` **and**
   the `--lines/--statements/--functions/--branches` flags in
   `package.json` → `test:unit:coverage` in lockstep.
3. **Per-file** — `coverage-thresholds.json` `perFileDefaults` / `overrides`
   for the relevant suite.

**Where to find the HTML report:**

- Locally: `npm run test:e2e:coverage` writes `coverage-report/index.html`;
  `npm run test:unit:coverage` writes `coverage-report-unit/lcov-report/index.html`.
- CI: the `coverage` job uploads both as the `coverage-reports` workflow
  artifact (14-day retention).
- Weekly trend: the separate `e2e-coverage` workflow runs Sundays at
  04:00 UTC and on `workflow_dispatch`; same artifact name, same retention.

<!-- harness:local-end id=operations.project-deploy -->

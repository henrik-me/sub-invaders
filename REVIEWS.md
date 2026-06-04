# REVIEWS

> **File class: composed.**
> The managed core below is owned by the harness and updated on sync. The
> `reviews.project-gates` block at the end is owned by the project and
> preserved across syncs. Edit managed sections via
> `template/composed/REVIEWS.md`; edit local gates directly in this file.

---

## Overview

Every clickstop (CS) passes through a three-phase review lifecycle:

1. **Claim PR review** — a brief local review performed before opening the
   content PR, confirming the work is coherent enough to share.
2. **Content PR review** — iterative GPT-5.5 (or approved fallback) review
   rounds on the open PR until all blocking findings are resolved.
3. **Close-out PR review** — a final pass confirming that non-blocking
   findings have been tracked or addressed and that the retrospective entry is
   filed.

This document defines the policies, models, calibration targets, and findings
taxonomy that govern each phase.

---

## Phase 1 — Claim PR Review

The claim PR is a lightweight WORKBOARD-only PR (labeled `workboard-only`).
It is auto-approved and auto-merged by the dedicated workflow
(`workboard-auto-approve.yml`) when:

- Only `WORKBOARD.md` and/or clickstop rename paths changed.
- The `workboard-only` label is present.
- The author is in the approved-actors list.

No formal review iteration is required for claim PRs. The orchestrator is
responsible for verifying the claim is correct (CS number, slug, branch name)
before the PR is raised.

---

## Phase 2 — Content PR Review

### 2.1 Review model

**Primary reviewer: GPT-5.5.**

GPT-5.5 is the sole approved primary reviewer for all content PRs. Every CS
implementation must receive at least one GPT-5.5 review before the PR is
considered merge-ready.

**Fallback: Claude Sonnet 4.6** — subject to the independence invariant and
risk-class restrictions below.

### 2.2 Fallback policy (Decision #22)

If GPT-5.5 is unavailable for more than 30 minutes, or after two failed
attempts, the orchestrator may fall back to a Claude Sonnet 4.6 rubber-duck
review. The following conditions must all hold before the fallback is allowed:

| Condition | Requirement |
|---|---|
| Independence invariant | Sonnet 4.6 must **not** have materially implemented the CS being reviewed. If Sonnet performed non-trivial implementation sub-tasks within the CS, the fallback is forbidden. |
| Risk class | The CS must **not** be HIGH-RISK (see §2.3). |
| Documentation | The PR body must record: model used, timestamp, fallback reason, and the implementer-model-list for the CS. |

If Sonnet 4.6 cannot be used (independence violation or HIGH-RISK CS), the
only permitted options are: retry GPT-5.5, or obtain an explicit user waiver.
A user waiver must be recorded in the PR body with the waiver rationale.

### 2.2.1 Reviewer model fallback ladder (CS35 C35-2)

The fallback ladder governs which model to use when the primary reviewer
(GPT-5.5) is unavailable:

> GPT-highest-available (5.5 → 5.4 → ...) → Claude Sonnet-highest (4.7 → 4.6 → ...) → orchestrator's own model (last resort with explicit user waiver). The independence invariant (no implementer/reviewer model overlap) applies at every step of the ladder.

See §2.3 for risk-class restrictions: HIGH-RISK CSs forbid the
orchestrator-own-model rung absent an explicit user waiver.

### 2.3 Risk-class restrictions

HIGH-RISK CSs require GPT-5.5 **or explicit user waiver only** — no Sonnet
fallback regardless of independence:

- CS03 (sync engine)
- CS11 (self-host)
- CS15a (public-readiness, visibility flip, and Ruleset activation)
- CS18b (PILOT-A baseline)
- CS19 (migration)

Any CS newly designated HIGH-RISK by the orchestrator inherits these same
restrictions.

### 2.4 Review-round calibration

Review convergence takes multiple rounds. The following targets are calibration
baselines, not hard caps — converge when all blocking findings are resolved
regardless of round count.

| CS risk class | Expected rounds | Calibration source |
|---|---|---|
| User-facing surface (CLI, schema-rendered outputs) | ~3 | [LRN-031](LEARNINGS.md#lrn-031) |
| HIGH-RISK (sync engine, schema authoring, public-flip, migration) | 5–8 | [LRN-024](LEARNINGS.md#lrn-024) |
| Thin plumbing / tooling | ~2 | heuristic |

**Do not close the content PR until GPT-5.5 (or approved fallback) issues an
explicit GO verdict.**

Key observations from [LRN-024](LEARNINGS.md#lrn-024) and
[LRN-031](LEARNINGS.md#lrn-031):

- Each fix round can introduce new findings by disturbing adjacent invariants.
  Multiple iterations are normal, not a sign of poor work.
- High-risk CSs with multiple interacting invariants (fail-closed semantics,
  cross-platform behaviour, prototype-pollution edge cases) routinely require
  6–7 rounds even for careful implementations.
- User-facing CLIs generate 5–10 findings per round because they have rich
  behavioural contracts (exit codes, flag semantics, help text, platform
  portability).
- Budget time and sub-agent slots accordingly when planning high-risk or
  user-facing CSs.

### 2.4.1 Canonical orchestrator command (`harness review`)

For content PR review rounds, the canonical orchestrator entry point is:

```
harness review <pr> [--repo owner/name] [--model gpt-5.5|sonnet-4.6] [--round R<n>] [--no-poll|--dry-run]
```

`harness.config.json` → `reviews.require_copilot_review` defaults to `true`;
set it to `false` only for projects where Copilot review evidence is not
required or unavailable.

The command validates that the target is a content PR, enforces the reviewer
independence invariant from the PR body's `## Model audit` / CS plan review
evidence, emits the manual MVP rubber-duck prompt, optionally triggers and
polls Copilot review, and appends the PR body's `## Review log` + `## Model
audit` evidence when the round completes. Exit codes are: `0` = Go / dispatch
accepted, `1` = No-Go or unresolved Blocking finding, `2` = usage, policy, or
transport failure.

Use `harness copilot-engage` only as a Copilot-only fallback when the combined
review command is unavailable or unsuitable for a narrowly scoped retry.

### 2.5 What the reviewer examines

The review scope depends on CS type:

**Implementation CSs:**
- Correctness and edge-case coverage.
- Sync invariants — especially composed-class fail-closed semantics.
- Schema compatibility (no breaking changes to `harness.lock.json` or
  published schemas).
- Test coverage — new behaviour must have tests; regression tests for any
  found bugs.
- Secrets and IP hygiene — no credentials, internal hostnames, or
  third-party-copyright content committed.

**Template CSs (CS08–CS10, canonical doc authoring):**
- Linter pass (`check-composed-blocks.mjs` for composed-class files).
- Cross-link integrity (anchors resolve, LEARNINGS.md IDs exist).
- Schema conformance (YAML front-matter where required).
- No project-specific leakage into managed templates — managed sections must
  be portable across harness consumers.

**Migration CSs (CS19):**
- Parity manifest completeness.
- Freshness-calendar compliance.
- Migration-base SHA recorded.
- Soft-freeze status confirmed.
- Rollback path documented.

### 2.6 Findings taxonomy

Every finding is classified at time of delivery. The reviewer must use
exactly one of these labels:

| Label | Meaning | Gate |
|---|---|---|
| **Blocking** | Defect, missing invariant, security/IP issue, or broken contract that must be resolved before merge. | Hard gate — PR cannot merge with open Blocking findings. |
| **Non-blocking** | Real issue worth tracking, but safe to defer. Examples: debt items, minor inconsistency, opportunistic improvement. | Soft gate — must be recorded in the close-out entry; may not silently vanish. |
| **Suggestion** | Optional improvement at the orchestrator's discretion. No gate. | No gate — record or discard. |

### 2.6a Rubber-duck scope — fact-claim verification (PR #218 doctrine)

The reviewer's job is not only to read the diff. A "Go" verdict is only valid
when the reviewer has affirmatively verified that every factual claim in the
diff matches the cited shipped surface. This applies to all CS types, but is
the **dominant failure mode for documentation and prose PRs** — where the
diff itself looks coherent but the claims it makes about CLI behaviour,
doctrine, file paths, or prior LRN/CS entries can be wrong without the
reviewer noticing.

**Required checks for every Go verdict on a doc/prose-heavy PR:**

| # | Check | Source of truth |
|---|---|---|
| F1 | Every `--flag` mentioned exists in the CLI surface. | `bin/harness.mjs` (`SUBCOMMAND_HELP` blocks and `cmdXxx` argument parsers); `lib/<module>.mjs` for behaviour; `scripts/*.mjs` for pass-through subcommands (e.g. `harness review-output` forwards to `scripts/check-review-output.mjs`). |
| F2 | Every file path mentioned exists in the tree (or is explicitly described as not-yet-existing). | Repo filesystem at the analyzed HEAD. |
| F3 | Every doctrine-strength claim (`required`, `mandatory`, `enforces`, `recommended`, `optional`) matches the cited source's wording verbatim or via a documented synonym. | Cited doc (OPERATIONS.md, REVIEWS.md, INSTRUCTIONS.md, README.md, etc.). |
| F4 | Every summary of a LEARNINGS.md or CS entry stays within the source entry's stated scope. No generalisation beyond what the Problem / Finding / Decision text asserts. | The LRN/CS entry itself. |
| F5 | Cross-doc claims are mutually consistent. If the diff says "OPERATIONS.md says X" or "the CLI does Y", verify that OPERATIONS.md actually says X and the CLI actually does Y at the analyzed HEAD. | The other doc(s) and code referenced. |

**Reviewer prompt obligation.** When dispatching a rubber-duck for a doc PR,
the orchestrator MUST include language equivalent to: *"verify F1–F5 above
against the shipped surfaces — do not rely on the diff being internally
coherent."* The canonical reviewer preamble's `**scope:**` field already
references this expectation (see
[OPERATIONS.md § Reviewer dispatch — canonical preamble](OPERATIONS.md#reviewer-dispatch--canonical-preamble)).

**Empirical motivation.** PR #218 (CS55+CS56 doc backfill) required 3
substantive Copilot review rounds to surface 7 unique fact-claim issues
(R4 returned 0 findings) — every one of which the rubber-duck pre-review
missed because the dispatch prompt asked the reviewer to verify the diff
was coherent, not to cross-check claims against shipped code/help
text/doctrine. Examples of what was missed: nonexistent CLI flag
(`--idempotent`), nonexistent file path (`template/composed/INSTRUCTIONS.md`),
"enforces" overclaim contradicting CLI help text that says "doctrine; not
enforced", and LRN-138 summary that generalised the entry beyond its
"contents transmitted to a third party" scope.

### 2.7 Finding disposition

**Blocking findings:** must be addressed before merge via one of:

1. **Fixed** — the finding is corrected in the PR and the reviewer confirms in
   the next round.
2. **Explicitly waived** — the orchestrator documents a justification for why
   the finding is safe to defer or disagree with. The waiver is recorded in
   the PR body. The orchestrator reserves final judgment on all waivers.

Silently ignoring a Blocking finding is not permitted. If the orchestrator
disagrees with the reviewer's classification, the disagreement must be stated
explicitly in the PR body before proceeding.

**Non-blocking findings:** must appear in the close-out retrospective entry.
The entry records: finding text, source round, and one of: `deferred`,
`addressed`, or `accepted-debt`.

**Suggestions:** the orchestrator logs or discards at its discretion. No
close-out entry required.

### 2.8 PR body requirements

Every content PR body must record the following fields before merge:

```
## Review log

| timestamp | analyzed_head | actor | model | verdict | evidence_link |
|---|---|---|---|---|---|
| 2026-05-14T10:32:00Z | a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 | yoga-ah | gpt-5.5 | Go | https://github.com/henrik-me/agent-harness/pull/150#issuecomment-123456 |
```

**Review log column rules:**

- `timestamp` — RFC 3339 UTC (`...Z`).
- `analyzed_head` — full 40-character commit SHA the reviewer analysed. The A4 gate compares this to the current PR HEAD.
- `actor` — round/role annotation (e.g. `yoga-ah`, `rubber-duck`, `rubber-duck (narrow R2)`, `omni-ah (PvI R3)`). This is the column where round numbers and dispatch labels live.
- `model` — **MUST be the bare reviewer-model identifier** (e.g. `gpt-5.5`, `claude-sonnet-4.6`, `claude-opus-4.7`). Decorations like `gpt-5.5 (R2)`, `gpt-5.5 (reviewer)`, `gpt-5.5 (PvI)`, `gpt-5.5 (narrow re-attest)` are not permitted — they historically slipped past the PR-side `review-log-evidence` gate because `normalizeModel()` in `scripts/checks/check-review-log-evidence.mjs` collapsed them away from the primary reviewer ID (`gpt-5.5 (R2)` → `gpt-5.5-r2`), failed the primary-reviewer check, and were then approved via the fallback-rationale path (LRN-136). Display-form inputs that contain whitespace (e.g. `Claude Opus 4.7`) are also rejected — the bare-id regex `/^[A-Za-z0-9._-]+$/` only accepts unbroken identifiers (the case-normalization happens downstream in `normalizeModel()`, so `gpt-5.5` and `GPT-5.5` are treated equivalently for the audit-match check; both pass the bare-id check). Put round / role annotations in the `actor` column instead. Mechanically enforced since CS54 by `scripts/checks/check-review-log-evidence.mjs` (bare-id check fires for every row BEFORE `reviewerModelApproved()`). Note: this is a separate concern from the independence invariant (`scripts/checks/check-independence-invariant.mjs`), which reads `## Model audit`'s `Reviewer model` rather than the Review log `model` cell.
- `verdict` — one of `Go`, `Conditional Go`, `Needs-Fix` (historical spelling `Go-with-amendments` is accepted but not preferred).
- `evidence_link` — URL to the rubber-duck report comment, sub-agent transcript, or other artefact backing the verdict.

## Model audit

| Field | Required | Description |
|---|---|---|
| `Implementer models` | yes | Comma-separated list of every model that materially implemented any code/doc/config in the CS (orchestrator + all sub-agents). Case-insensitive on the family + version pair (e.g. `claude-opus-4.7` ≡ `Claude Opus 4.7`). |
| `Reviewer model` | yes | Single model identifier from the C35-2 fallback ladder. |
| `Implementer agent` | overlap is a hard error in v0.5.0 (CS41); missing or empty cells warn in v0.5.0, become a hard error in v0.6.0 (C42-6 strict-flip) | GitHub username of the implementing agent. Per CS35 C35-18 (agent-identity independence). Mechanically enforced: `scripts/check-clickstop-implementer-not-reviewer.mjs` (CS41) on the planned/active/done CS files; `scripts/check-review-evidence.mjs` (CS36, parser extended in CS41) on the PR body's `## Model audit` block. |
| `Reviewer agent` | overlap is a hard error in v0.5.0 (CS41); missing or empty cells warn in v0.5.0, become a hard error in v0.6.0 (C42-6 strict-flip) | GitHub username of the reviewing agent. Per CS35 C35-18. Same enforcement surface as `Implementer agent`. |

**Independence invariant (MUST):** `intersection({Implementer models}, {Reviewer model})` = ∅. Comparison is case-insensitive on the family + version pair. Violation blocks merge per A3.

**Agent-identity independence (MUST per CS35 C35-18 + CS41):** `Implementer agent` ≠ `Reviewer agent` (case-insensitive). v0.4.0 issued a warning when columns were absent; v0.5.0 (CS41) requires both columns and treats overlap as a hard error. The `--strict-agent-columns` flag on `check-review-evidence.mjs` defaults to `false` in v0.5.0 (warning-on-missing) so consumers have a one-cycle migration ramp; flips to `true` in v0.6.0 (hard error) per C42-6 strict-flip plan.

Example block (paste into the active CS file):

```
## Model audit

| Field | Value |
|---|---|
| Implementer models | claude-opus-4.8, claude-opus-4.7 |
| Reviewer model | gpt-5.5 |
| Implementer agent | yoga-ah |
| Reviewer agent | copilot |
```

**Stale-diff doctrine (CS35 C35-3 + A4 gate):** A `Go` row whose
`analyzed_head` ≠ current HEAD is INVALID — re-review is required before
merge. The A4 PR-evidence gate (lands in CS36) enforces this mechanically.

**R1 / Rn distinction (CS35 + #145 Change 1):** R1 = first review on a given
HEAD; reviewer must enumerate every file under review. Rn = follow-up review
on a delta from the previous round; reviewer may enumerate ONLY the changed
files (delta-only enumeration permitted).

## Plan review (planned/active CS attestation)

Every clickstop file in `project/clickstops/planned/` and
`project/clickstops/active/` carries a `## Plan review` H2 section that
records each independent plan-review round before the file can be merged.
Done files are exempt (the close-out gate `## Plan-vs-implementation review`
already covers that surface).

This is the planning-phase counterpart of the close-out review gate.
Mechanical enforcement: `scripts/check-clickstop-plan-review.mjs` (CS35b),
wired into `harness lint` AND dispatched by the `harness pr-evidence`
aggregator as gate A6 (C35b-9). Doctrine + procedure: see
[OPERATIONS.md § Plan review attestation procedure (CS35b)](OPERATIONS.md).

**Required columns (per CS35b C35b-2):**

| Column | Description |
|---|---|
| Round | `R1`, `R2`, ... — first review then one row per amendment round |
| Reviewer model | The model ID that performed the review (e.g. `gpt-5.5`) |
| Plan author model(s) | Comma-separated model IDs the orchestrator used to author / amend |
| Reviewer agent | Agent identity that ran the review (e.g. `rubber-duck dispatched (orchestrator: yoga-ah)`) |
| Reviewed sections hash | 12-char SHA-256 prefix of trimmed Decisions + Deliverables bodies (`harness plan-review-hash <file>`) |
| Timestamp (UTC) | ISO-8601 UTC, `YYYY-MM-DDThh:mm:ssZ` |
| Verdict | `Go` / `Go-with-amendments` / `Needs-Fix` |
| Findings recap (≤200 chars) | Short summary of the review outcome |

**Independence invariant (C35b-4):** `Reviewer model` MUST NOT appear in
`Plan author model(s)` of the same row OR any earlier row (accumulated
across the file's history). The linter rejects any overlap.

**Hash freshness (C35b-3):** The latest row's `Reviewed sections hash` MUST
equal the current SHA-256-prefix-12 of the Decisions + Deliverables bodies.
Pure prose edits to other sections (Background, Risks, Tasks, Notes) do
NOT change the hash and do NOT require a fresh row. Material edits to
Decisions or Deliverables flip the hash and demand a new attestation
round before the file can be merged.

**Gate (C35b-5):** Latest row's verdict MUST be `Go` or `Go-with-amendments`.
A latest `Needs-Fix` blocks the merge of the plan file (file an amendment
and a new attestation row to clear).

**Narrow re-attest rounds (LRN-135):** When a follow-up plan-review round
addresses ONLY a trivial doc-only delta in response to a prior reviewer
finding — same reviewer model, same reviewer agent, no new scope — it
MAY be filed as a narrow re-attest row (R2/R3/...) with the same
verdict cadence as full rounds. See
[OPERATIONS.md § Narrow re-attest after trivial commits](OPERATIONS.md)
for the procedure, preconditions, and ledger requirements. The PR-side
counterpart is documented under § PR-evidence gates A4 (stale-diff
currency) — narrow re-attest is the recommended mitigation when the
delta would otherwise trigger a full re-review.

Example block (paste into the plan file after `## Decisions`, before
`## Deliverables`; compute the hash via `harness plan-review-hash <file>`):

```
## Plan review

| Round | Reviewer model | Plan author model(s) | Reviewer agent | Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200 chars) |
|---|---|---|---|---|---|---|---|
| R1 | gpt-5.5 | claude-opus-4.7 | rubber-duck dispatched (orchestrator: yoga-ah) | abcd1234ef56 | 2026-05-13T12:34:56Z | Go | Plan accepted on first round; no amendments. |
```

## PR-evidence gates (B1, A2–A6, A16 reference)

The PR-evidence subcommand (lands in CS36, wired to CI in CS38a) runs a fixed
set of mechanical gates against the diff + git log + PR body of a content PR.
Each gate is named (B1, A2..A6, A16) so CS plans, review log entries, and bug
reports can reference them by short name. The gates are layered: failure of an
earlier gate may shadow later gates' findings, but every reachable gate
reports independently.

| Gate | Name | Source CS | What it checks | C35 anchor |
|---|---|---|---|---|
| B1 | per-commit trailer | CS36 | Every commit in `git log <base>..<head>` (NOT squash-only) carries the `Co-authored-by: Copilot` trailer. The B-prefix is intentional: B-gates inspect the git **branch** / commit graph; A-gates inspect the active CS **audit** artefacts. | C35-5 |
| A2 | per-file enumeration | CS36 | The PR body's "Changes" section enumerates every changed file by path; no summary-pass on YAML/package.json bundles. | #145 PR #28 evidence |
| A3 | model-audit independence | CS36 | The active CS file's `## Model audit` block satisfies the independence invariant: `intersection({Implementer models}, {Reviewer model})` = ∅, case-insensitive on family + version. (Schema presence is implicit — if the table is missing or unparseable, A3 fails with a parse error.) | C35-4 |
| A4 | stale-diff currency | CS36 | The latest `Go` row in `## Review log` has `analyzed_head` equal to the current HEAD SHA of the PR. | C35-3 / C35-6 |
| A5 | review-after-implementation ordering | CS36 (local-Go ordering) + CS37 (Copilot ordering) | The latest local `Go` row's `timestamp` is AFTER the latest commit's authored timestamp on the branch (no review-before-fix). When a Copilot review is present (gate A16), the Copilot review's `submittedAt` must ALSO be after the latest local `Go` row's `timestamp` — the Copilot reviewer cannot precede the local sign-off. | C35-6, ADR-0004 § ADR4-5 |
| A6 | plan-review attestation (PR-time) | CS35b | Every planned/active CS file touched by the PR carries a `## Plan review` row whose `Reviewed sections hash` matches the current content hash AND whose `Reviewer model` ∉ `Plan author model(s)`. STRICT in v0.4.0+v0.5.0 — no `--strict` ramp on this gate (per CS35b C35b-9). | CS35b C35b-2..C35b-9 |
| A16 | Copilot review engagement | CS37 (verifier) + CS41 (engage wrapper) | A Copilot review (state ∈ `APPROVED`/`COMMENTED`/`CHANGES_REQUESTED`, NOT `PENDING`) by `copilot-pull-request-reviewer` (`__typename: Bot`) is present on the PR at the current HEAD per the Copilot engagement procedure (OPERATIONS.md § Copilot engagement procedure). Verification-only on CI via `harness pr-evidence` (which dispatches `scripts/check-copilot-review.mjs` from CS37); engagement mutation lives in `harness copilot-engage` per C35-10 (lands in CS41). | C35-10, ADR-0004 |

Skip-semantics for B1, A2..A6, A16 are centralized via `--skip-reasons <comma-list>`
on `harness pr-evidence` (per C35-19); valid reasons: `workboard-only`,
`bot-author` (C35-8), `fork-source` (C35-9). The CI workflow computes the
reasons from the GitHub event payload; `harness pr-evidence` itself MUST
NOT call `gh pr view`.

### Required PR-side gates

The `review-gates.yml` workflow turns the review doctrine above into four
required status checks for content PRs. PRs labeled `workboard-only` skip these
checks because they are claim/close-out bookkeeping PRs, not implementation
content.

| Status check | How to satisfy it |
|---|---|
| `review-log-evidence` | Fill `## Review log` with at least one non-placeholder row whose verdict is `Go` or `Conditional Go` (the historical `Go-with-amendments` spelling is accepted) and whose reviewer model is GPT-5.5, or an approved fallback with `## Model audit` `Fallback rationale` populated. |
| `copilot-review-attached` | Ensure the configured Copilot PR reviewer has submitted a review. If the gate fails because no review exists yet, it posts `@copilot review`; wait for Copilot to submit and rerun the check. If token permissions prevent the comment, the check remains failed and reports the posting error. Repos without Copilot reviews may set `reviews.require_copilot_review=false`. |
| `independence-invariant` | Fill `## Model audit` with `Implementer models` and `Reviewer model`. The reviewer model must not appear in the implementer list unless the reviewer is GPT-5.5 on a non-HIGH-RISK CS; HIGH-RISK CSs forbid overlap regardless. |
| `review-threads-resolved` | Resolve every GitHub PR review thread before merge. |

`harness init --enable-review-gates` and `harness sync --mode=apply` install the
workflow and add these four contexts to `infra/main-protection-ruleset.json`
when `reviews.enforce_gates=true`.

---

## Config schema: `reviews` vs `review_gates`

`harness.config.json` defines two top-level blocks that govern review
behaviour. They serve different runtimes and are NOT interchangeable —
confusion between them surfaced on SI PR #79 (LRN-136 chase).

| Block | When it runs | Who reads it | Purpose |
|---|---|---|---|
| `review_gates.*` | Install time (`harness init`, `harness sync`) and CI workflow time | `pr-evidence-lint.yml` workflow + install machinery | Configures the **PR-evidence CI gate set** (B1, A2..A6, A16) wired into every content PR. |
| `reviews.*` | Orchestrator runtime (`harness review <pr>`) and PR-side CI status checks | The `harness review` CLI + the PR-side `review-gates.yml` status checks | Configures the **rubber-duck reviewer model defaults**, fallback policy, Copilot trigger, gate enforcement toggles, and HIGH-RISK clickstop list. |

**Rule of thumb:** if you're wiring CI workflow gates or the gate set itself,
edit `review_gates.*`. If you're choosing reviewer models, Copilot wiring,
or PR-side status checks, edit `reviews.*`.

### `review_gates.*` (install-time / CI workflow)

> Per CS38a/CS37/CS36: configuration for the PR-evidence CI workflow that
> wires the harness's gate set into every consumer PR. When `enabled` is true,
> consumers should also land `template/managed/.github/workflows/pr-evidence-lint.yml`
> via `harness sync` (typically opt-in via `harness init --enable-review-gates`).

Fields (descriptions adapted from `schemas/harness.config.schema.json`; schema remains source-of-truth, see file for full constraints and defaults):

- `enabled` (boolean, default `true`): Master switch for the PR-evidence
  gate set. When false, the workflow runs but exits 0 unconditionally (a
  no-op shell). When true, the gate set listed below is enforced.
- `_opt_out_reason` (string): Required when `review_gates.enabled` is false
  in v0.5.0+; records the explicit reason this consumer is opting out of the
  default PR-evidence gate set.
- `copilot_required` (boolean, default `false`): When true, the CS37 A5+A16
  Copilot review gate is included in the gate set; when false, A5+A16 are
  skipped. Forced false when running on fork PRs (per ADR4-6 — forks cannot
  self-engage Copilot under their own token).
- `gate_set` (array of `B1`/`A2`/`A3`/`A4`/`A5`/`A6`/`A16`, default `[]`):
  Explicit list of PR-evidence gate short-names enforced by `harness
  pr-evidence`. Vocabulary defined in [§ PR-evidence gates](#pr-evidence-gates-b1-a2a6-a16-reference).
  Empty array = all gates skipped (gate set disabled). Default when `harness
  init --enable-review-gates` was invoked with the CS37 PASS spike outcome:
  `["B1","A3","A4","A5","A16","A6"]`.

### `reviews.*` (orchestrator-side `harness review` + PR-side gates)

> Configuration for the orchestrator-side `harness review <pr>` command
> (CS52) and CS51 REVIEWS.md PR-side status checks: rubber-duck reviewer
> model defaults, fallback policy inputs, Copilot trigger mode, timeout,
> gate enforcement toggles, and project-specific HIGH-RISK clickstops.

Fields (descriptions adapted from `schemas/harness.config.schema.json`; schema remains source-of-truth):

- `rubber_duck_model` (string, default `gpt-5.5`): Primary rubber-duck
  reviewer model used by `harness review` when `--model` is omitted.
  Defaults to GPT-5.5 per [§ 2.1](#21-review-model).
- `fallback_model` (string, default `sonnet-4.6`): Fallback rubber-duck
  reviewer model allowed only when [§ 2.2](#22-fallback-policy) permits
  fallback and the independence guard passes.
- `enforce_gates` (boolean, default `true`): When true, `harness
  init`/`sync` installs `review-gates.yml` and injects
  `review-log-evidence`, `copilot-review-attached`, `independence-invariant`,
  and `review-threads-resolved` into
  `infra/main-protection-ruleset.json` `required_checks`.
- `require_copilot_review` (boolean, default `true`): When true, the
  `copilot-review-attached` gate requires a submitted review by the
  configured Copilot reviewer; `harness review` also triggers and waits for
  Copilot review evidence unless `--rubber-duck-only` is supplied. Set false
  for repos where Copilot PR reviews are unavailable.
- `copilot_reviewer_slug` (string, default `copilot-pull-request-reviewer[bot]`):
  GitHub login/slug for the Copilot PR reviewer bot. Both the bare slug and
  `[bot]`-suffixed login are accepted by the checker.
- `copilot_trigger` (`mention` | `reviewer`, default `mention`): How
  `harness review` requests Copilot review. `mention` posts an `@copilot
  review` PR comment via `gh api`; `reviewer` uses the reviewer attachment
  path where supported.
- `review_timeout_minutes` (number, default `30`): Maximum minutes `harness
  review` waits for required review evidence before returning a
  tooling/transport failure.
- `high_risk_clickstops` (array of CS-ids, default
  `["CS03","CS11","CS15a","CS18b","CS19"]`): Clickstop IDs (for example
  CS03 or CS15a) for which the `independence-invariant` gate forbids
  implementer/reviewer model overlap and `harness review` forbids fallback
  reviewer models unless an explicit user waiver is recorded.

---

## Phase 3 — Close-Out PR Review

The close-out PR archives the clickstop folder and updates `WORKBOARD.md`.
It is also `workboard-only`-labeled and auto-approved by the same workflow
as the claim PR.

Before raising the close-out PR the orchestrator must confirm:

- [ ] All Blocking findings from all content PR rounds are resolved or waived.
- [ ] All Non-blocking findings appear in the retrospective entry under
  `project/clickstops/done/<slug>/`.
- [ ] The WORKBOARD row for this CS is updated to `done`.
- [ ] Any LEARNINGS entries surfaced during the CS are filed in `LEARNINGS.md`.
- [ ] The `harness.lock.json` version is bumped if any managed or composed
  template changed.

---

## Review thread hygiene

All PR review threads must be resolved before merge. The squash-merge
policy (Decision #16, #17) applies:

- **Never** merge with unresolved review threads.
- **Never** merge-commit; squash only.
- If a thread represents a Suggestion the orchestrator has decided to discard,
  resolve it with a one-line explanation (e.g., "Suggestion noted; deferred to
  future CS.").

---

## Independence invariant — full statement

The independence invariant exists to prevent a model from reviewing its own
work. The invariant is violated when the same model (or
model/configuration pair) that materially implemented a CS is also the sole
reviewer of that CS.

"Materially implemented" means: the model authored non-trivial logic, not
merely mechanical find-replace or scaffolding.

Violation handling:
1. If GPT-5.5 is available: use GPT-5.5. No invariant concern (GPT-5.5 is
   never used as an implementer in this harness).
2. If GPT-5.5 is unavailable and Sonnet 4.6 is the candidate fallback:
   check the implementer-model-list for the CS. If Sonnet 4.6 did
   non-trivial implementation work, the fallback is forbidden. Escalate to
   GPT-5.5 retry or user waiver.
3. If neither is available: block the review, do not merge, escalate to user.

Beyond model independence (above), CS35 C35-18 introduces agent-identity
independence: the GitHub usernames of `Implementer agent` and `Reviewer agent`
MUST also differ. The CS41 linter `check-clickstop-implementer-not-reviewer`
enforces this. v0.5.0 ships the columns as required-with-warn-ramp (linters
warn but do not error when columns are missing); v0.6.0 flips to strict per
C42-6, after which missing columns become a hard failure.

---

## Phase matrix — quick reference

| Phase | PR type | Review required | Auto-merge eligible |
|---|---|---|---|
| Claim | `workboard-only` | No | Yes, via `workboard-auto-approve.yml` |
| Content | Normal | Yes — GPT-5.5 GO | No |
| Close-out | `workboard-only` | No (post-review confirmation only) | Yes, via `workboard-auto-approve.yml` |

---

<!-- harness:local-start id=reviews.project-gates -->

## Project-specific review gates

The following gates apply IN ADDITION TO the universal harness review process:

- **Staging URL gate** — every content PR that changes `src/`, `api/`, `infra/`, or
  `.github/workflows/swa-deploy.yml` MUST include the latest SWA staging deploy URL in the
  PR body and confirm `/` returns HTTP 200.

- **`/api/health` smoke gate** — every content PR that changes `api/` MUST confirm in the
  PR body that `GET /api/health` returns HTTP 200 with body `{"status":"ok"}`. Capture the
  verify-deploy script output if the scaffold is wired (CS04+).

- **Leaderboard JSON shape gate (CS03+)** — any change to `/api/score` or `/api/session`
  response shapes MUST include a backwards-compatibility note in the PR body, OR an explicit
  "BREAKING — frontend updated in this PR" callout.

- **Container-validate gate (when applicable)** — any CS that introduces or modifies a
  container image MUST run `scripts/validate-image.mjs` and include the validation output in
  the PR body. (CS01–CS04 do not touch containers; this gate activates only when a CS adds
  container surface.)

- **Azure resource-group isolation gate** — any CS that modifies `infra/provision.sh` or any
  other resource-creation script MUST verify in the PR body that
  `gh api ... rg list --tag workload=sub-invaders` shows only the expected RG and that all
  created resources have `--resource-group "$RG_NAME"`.

- **Budget gate** — any CS that changes the budget cap, alert thresholds, or Action Group
  recipients MUST include the new RG-scoped Budget JSON snapshot in the PR body.

- **Negative-test-the-gate gate (CS09+)** — any CS that introduces a new CI gate (required
  status check, threshold-style enforcement, build-time guard, etc.) MUST include in the
  close-out PR body evidence that the gate was negative-tested: a scenario that *should*
  trip the gate (e.g., bump a threshold past current values, remove a required file, push
  a known-bad value) was run, the gate reported `failure`, and the merge was blocked. Without
  this evidence the gate may be a no-op — see `LEARNINGS.md` LRN-018 for the CS09 close-out
  precedent where a coverage required check silently let regressions through because the
  umbrella job was reported as `skipped`.

These gates are enforced by reviewer discipline; mechanical checks may follow in a later CS.

<!-- harness:local-end id=reviews.project-gates -->

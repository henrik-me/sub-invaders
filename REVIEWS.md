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
| Round | Reviewer model | Verdict | Blocking | Non-blocking | Suggestions |
|-------|---------------|---------|----------|--------------|-------------|
| R1    | GPT-5.5       | No-Go   | 4        | 2            | 1           |
| R2    | GPT-5.5       | Go      | 0        | 1            | 0           |

## Model audit
- Implementer models: Claude Opus 4.7 1M (orchestrator), Haiku (sub-tasks)
- Reviewer model: GPT-5.5
- Fallback used: no / yes — <reason>
- Fallback permitted: n/a / yes — independence invariant satisfied / user waiver: <ref>
```

The model audit enables future review-of-review audits to verify the
independence invariant was respected.

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

_No project-specific gates are defined yet. Add entries here for gates that
apply to this project but are not universal harness policy. Examples:_

- _"All clickstops that touch Azure deployment configuration require a manual
  approval step from the project owner before the close-out PR is raised."_
- _"Security-sensitive changes (cryptographic primitives, secret handling,
  auth flows) require a dedicated security review round in addition to the
  standard GPT-5.5 content review."_
- _"Any CS that modifies public-facing API schemas must include a
  backwards-compatibility attestation in the PR body."_

_Replace this placeholder paragraph with the actual gates for your project._

<!-- harness:local-end id=reviews.project-gates -->

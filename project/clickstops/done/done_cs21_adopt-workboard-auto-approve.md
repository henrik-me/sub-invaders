# CS21 — Adopt the v0.12.0 managed workboard-auto-approve.yml (WORKBOARD_MERGE_TOKEN merge path)

**Status:** done
**Owner:** omni-si
**Branch:** cs21/content
**Started:** 2026-07-02
**Closed:** 2026-07-02
**Filed by:** omni-si, 2026-07-02, after the v0.12.0 pin bump (#140) surfaced 5 offered managed files; the user reviewed the per-file adoption analysis and chose to adopt workboard-auto-approve.yml with the WORKBOARD_MERGE_TOKEN merge path.
**Depends on:** none (v0.12.0 already pinned as of #140)

## Goal

Adopt the agent-harness v0.12.0 managed `.github/workflows/workboard-auto-approve.yml`, replacing
this repo's older custom validation-only version. This aligns the workflow with the v0.12.0
`OPERATIONS.md` #369 documentation (resolving the doc-vs-reality mismatch filed upstream as
agent-harness#381) and enables real auto-approve + auto-merge of workboard-only PRs via a
`WORKBOARD_MERGE_TOKEN` PAT, ending the recurring manual admin-merge of claim/close-out PRs.

## Background

v0.12.0's `sync` reports 5 offered-but-un-adopted managed files. A per-file analysis (this
session) recommended adopting only `workboard-auto-approve.yml` now; keeping the custom
`CODEOWNERS` (pending the composed-CODEOWNERS feature, agent-harness#390); and deferring
`harness-pr-check.yml` + `review-gates.yml` to a future CI-migration CS (they overlap this repo's
existing `ci.yml` harness jobs + `pr-evidence-lint.yml`; upstream easing tracked by
agent-harness#392/#393). `harness-drift.yml` is optional and not adopted here.

This repo's current `workboard-auto-approve.yml` is validation-only (actor + path allowlist →
posts "ready for App auto-approve"); the approving GitHub App was never installed, so workboard
PRs are admin-merged by the owner. The v0.12.0 version adds a branch-name gate and a real
auto-merge path (GitHub App **or** a `WORKBOARD_MERGE_TOKEN` PAT), degrading gracefully to
validation-only (manual admin-merge) when neither credential is present.

Verified (v0.12.0 template): the whole `validate-and-approve` job is gated on the `workboard-only`
label (content PRs are unaffected); the `validate-and-approve` job is NOT a required status check
(a mis-named branch cannot block merges — it just forgoes bot auto-approval); the PAT admin-merge
step re-checks that non-workboard status checks are green and refuses if the PR head changed after
validation (`--match-head-commit`).

## Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| CS21-1 | Adopt via managed.files + sync | Add `.github/workflows/workboard-auto-approve.yml` to `harness.config.json` `managed.files`, then `harness sync --mode=apply` (from a git-aware v0.12.0 checkout) to materialize the v0.12.0 version, overwriting the custom workflow | Selective adoption (managed.files + sync) is the supported mechanism; keeps lock provenance correct; aligns with the #369 docs and resolves agent-harness#381 for this consumer |
| CS21-2 | Merge path = WORKBOARD_MERGE_TOKEN PAT | Use the PAT admin-merge fallback, not the GitHub App. **Manual owner step:** create a fine-grained PAT scoped to `henrik-me/sub-invaders` with Contents:R/W + Pull-requests:R/W and add it as the repo secret `WORKBOARD_MERGE_TOKEN`. The PAT MUST be minted by an owner/admin account (admin/bypass capability is required for the `--admin` merge), with an expiration set and a rotation/revocation policy | User directive; no App install needed. Until the secret is set, the workflow degrades to validation-only (owner admin-merges manually — identical to today, no regression). The workflow re-checks green CI + head-immutability before merging |
| CS21-3 | Adopt the workflow's branch-name convention | Name workboard PRs `cs<NN>/(claim\|close\|close-out)`, `workboard/cs<NN>-(claim\|close\|close-out)`, or `docs/file-planned-cs<NN>(-<slug>)?` going forward | The adopted workflow enforces these for auto-approval; the old ad-hoc `workboard/cs<NN>-file` no longer matches (filing now uses `docs/file-planned-cs<NN>`). A non-matching branch falls back to manual admin-merge (the validate job is not a required check), so this is a convention, not a hard gate |
| CS21-4 | Scope: adopt ONLY this file | Do not adopt CODEOWNERS, harness-drift.yml, harness-pr-check.yml, or review-gates.yml in this CS | Separately dispositioned (keep CODEOWNERS pending #390; defer pr-check/review-gates to a CI-migration CS per #392/#393; drift optional). Only `workboard-auto-approve.yml` is added to `managed.files`; the report-only "new managed files available" warning will still list the other 4 (expected) |

## Deliverables

- `harness.config.json` — `.github/workflows/workboard-auto-approve.yml` added to `managed.files`.
- `.github/workflows/workboard-auto-approve.yml` — replaced with the v0.12.0 managed version.
- `.harness-lock.json` — rendered-file entry for the newly-managed file (re-stamped by sync).
- The manual `WORKBOARD_MERGE_TOKEN` secret setup documented in the content PR body and, at
  close-out, in `CONTEXT.md` (so a fresh agent knows the merge path + pending secret).
- The accepted workboard branch-name convention (CS21-3) recorded in `CONTEXT.md` at close-out —
  `docs/file-planned-cs<NN>` for filing and `cs<NN>/(claim|close|close-out)` /
  `workboard/cs<NN>-(claim|close|close-out)` for claim/close-out — so future agents use the
  auto-approvable branch names instead of falling back to manual admin-merge.
- Validation: `harness sync --mode=check` → no drift; `harness lint` → green; the other 4 offered
  managed files remain un-adopted (only the expected report-only warning).

## User-approval gates

- **`WORKBOARD_MERGE_TOKEN` secret creation is an owner action** (an agent cannot mint the PAT).
  The CS adopts the workflow that consumes the secret and documents the setup; the merge
  automation activates once the owner adds the secret. No other approval gates.

## Exit criteria

- `.github/workflows/workboard-auto-approve.yml` byte-matches the v0.12.0 rendered template and is
  listed in `managed.files`; `harness sync --mode=check` reports no drift; `harness lint` is green.
- The content PR CI is green; the independent GPT-5.5 review verdict is `Go`; Copilot is engaged
  and threads resolved.
- Only `workboard-auto-approve.yml` was adopted (CODEOWNERS + the 3 other workflows still show the
  report-only "available but not tracked" warning).
- The workboard branch-name convention (CS21-3) is recorded in `CONTEXT.md` so future workboard PRs
  use the auto-approvable branch names.

## Risks + open questions

- **Risk — mis-named workboard branch forgoes bot auto-approval.** Mitigation: adopt the new
  branch-name convention (CS21-3); the validate job is not a required check, so admin-merge always
  works as a fallback.
- **Risk — no behavior change until the PAT secret exists.** Accepted interim (manual admin-merge,
  same as today); documented as an owner step (CS21-2).
- **Risk — the PAT is a powerful admin-bypass credential.** Mitigation: fine-grained, repo-scoped,
  minimal scopes (Contents + Pull-requests R/W); the workflow re-checks green CI + head-immutability
  before merging, so `--admin` bypasses only the missing approval, never failing/pending CI.

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| T1 — Add `.github/workflows/workboard-auto-approve.yml` to `harness.config.json` `managed.files` (CS21-1) | done | omni-si | added alongside the existing 4 managed entries |
| T2 — `harness sync --mode=apply` from a git-aware v0.12.0 checkout to materialize the managed workflow (CS21-1) | done | omni-si | replaced the custom workflow; lock re-stamped; no drift |
| T3 — Document the `WORKBOARD_MERGE_TOKEN` PAT owner-setup step (CS21-2) | done | omni-si | in PR #144 body + CONTEXT.md |
| T4 — Validate: `sync --mode=check` no drift; `harness lint` green; only this file adopted (CS21-1/4) | done | omni-si | No drift; lint 21/0; CODEOWNERS + 3 workflows still un-adopted |
| Close-out: docs + restart state | done | omni-si | WORKBOARD row removed; CONTEXT.md updated (CS21 entry + branch convention + pending PAT secret) |
| Close-out: learnings + follow-ups | done | omni-si | LRN-032 filed; upstream #381/#394 + features #390–#393 tracked |

## Notes / Learnings

- Upstream context: agent-harness#381 (v0.12.0 #369 doc-vs-reality mismatch that this adoption
  resolves for the consumer), and the harness feature requests #390–#393 filed from this session's
  adoption analysis.

## Plan review

| Round | Reviewer model | Plan author model(s) | Reviewer agent | Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200 chars) |
|---|---|---|---|---|---|---|---|
| R1 | gpt-5.5 | claude-opus-4.8 | rubber-duck dispatched (orchestrator: omni-si) | 03de8f43be5c | 2026-07-02T19:20:26Z | Go-with-amendments | All 6 fact-claims confirmed. Amendments applied: branch-convention made a durable deliverable + PAT owner/expiry guidance tightened. |

## Model audit

| Field | Value |
|---|---|
| Implementer models | claude-opus-4.8 |
| Reviewer model | gpt-5.5 |
| Implementer agent | omni-si |
| Reviewer agent | rubber-duck |
| Notes | Managed-file adoption; the v0.12.0 workboard-auto-approve.yml is sync-materialized from a git-aware v0.12.0 checkout. Reviewer model ≠ implementer model (independence); Implementer agent ≠ Reviewer agent. |

## Plan-vs-implementation review

**Reviewer:** GPT-5.5 (rubber-duck, dispatched by omni-si; reviewer model ∉ Implementer models `claude-opus-4.8`; reviewer agent ≠ `omni-si`)
**Date:** 2026-07-02
**Outcome:** GO

| Field | Value |
|---|---|
| model | gpt-5.5 |
| branch HEAD SHA | e074a32f567c86f0d64e28643eb7e9762fba7899 |
| R-round | R1 |
| verdict | Go |
| evidence link | content PR #144 (merged `e074a32`) |

All four decisions **Delivered**, no scope creep, `harness lint` 21/0:

- **CS21-1** — `.github/workflows/workboard-auto-approve.yml` is in `managed.files` and matches the v0.12.0 template (`sync --mode=check` → No drift).
- **CS21-2** — the workflow references `secrets.WORKBOARD_MERGE_TOKEN` and degrades to validation-only when unset; the secret is documented as an owner action.
- **CS21-3** — the workflow enforces the branch-name convention; recorded in `CONTEXT.md` at close-out.
- **CS21-4** — only this file adopted; `CODEOWNERS` unchanged (custom); `harness-drift`/`harness-pr-check`/`review-gates` absent (still report-only "available but not tracked").

Content-PR review: R1 Needs-Fix flagged only an over-strict lock-metadata acceptance criterion (my review spec, not a code defect); R2 confirmed **Go** at the same HEAD. Copilot engaged; its 2 findings on the harness-managed workflow were filed upstream as agent-harness#394 (not editable in-consumer) and the threads resolved.

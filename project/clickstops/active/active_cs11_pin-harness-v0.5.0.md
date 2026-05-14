# CS11 — Pin harness to v0.5.0 + accept review_gates default-on + opt-in to plan-review attestation

**Status:** active
**Owner:** yoga-si
**Branch:** cs11/content
**Started:** 2026-05-14
**Closed:** —
**Filed by:** Cross-repo coordination from `henrik-me/agent-harness` CS42 (v0.5.0 release-cut). This file is filed by the agent-harness orchestrator (`yoga-ah`) per agent-harness CS42 Decision C42-4/C42-5; the SI orchestrator implements.
**Supersedes:** CS10 (v0.4.0 pin filing — never claimed). When CS11 is claimed, also retire CS10 by moving `planned_cs10_pin-harness-v0.4.0.md` → `done/done_cs10_pin-harness-v0.4.0.md` with a `**Status:** superseded by CS11` header note.
**Depends on:** None (claim any time after harness v0.5.0 is published — verified live via `gh release view v0.5.0 --repo henrik-me/agent-harness` → `isDraft: false, publishedAt: 2026-05-14T05:18:21Z`).

## Goal

Pin Sub Invaders' harness consumption directly to `v0.5.0`, skipping the unclaimed v0.4.0 pin (CS10). The v0.5.0 release ships the CS40 + CS41 + CS42 arc on top of v0.4.0's #145 enforcement-gap stack. CS11 picks up everything CS10 would have delivered PLUS the v0.5.0-specific deliverables, with two material migration costs that did NOT exist at v0.4.0.

## Background

`henrik-me/agent-harness` v0.5.0 was published 2026-05-14 by the harness orchestrator after the three-CS arc (CS40 → CS41 → CS42). The release ships everything from v0.4.0 (see superseded CS10 for the v0.4.0 deliverable inventory) plus the following NEW capability:

1. **`harness copilot-engage <pr-number>` subcommand** (CS41) — wraps `gh pr edit --add-reviewer copilot-pull-request-reviewer` (per ADR-0004 ADR4-2) and polls until Copilot's Bot review lands at the current HEAD with `submittedAt ≥ engage-request timestamp` (enforces A5 ordering). `--no-poll` short-circuits for CI usage; `--submitted-after <iso>` overrides the implicit floor. Auto-detects `--repo` from `git remote origin url`. Replaces hand-crafted GraphQL invocations.
2. **`scripts/check-clickstop-implementer-not-reviewer.mjs`** (CS41) — new self-host-guarded linter scanning `project/clickstops/{active,done}/*.md`. Fails when `Implementer agent` ≡ `Reviewer agent` in the `## Model audit` block (case-insensitive). Mirrors the model-independence invariant at the agent-identity level. Default: missing columns → WARNING (one-cycle migration ramp); `--strict-agent-columns` → missing columns become errors. Registered in `harness lint`.
3. **`Implementer agent` + `Reviewer agent` columns** (CS41) first-class in `## Model audit` schema. PR template (`template/managed/.github/pull_request_template.md`) gains the two placeholder rows; REVIEWS.md and the composed mirror align the schema prose. `check-review-evidence.mjs` parser ingests both rows; `--strict-agent-columns` defaults `false` in v0.5.0 (flips `true` in v0.6.0 per C42-6 strict-flip plan).
4. **`harness.config.json` `review_gates.enabled` default-flip** (CS41) — fresh `harness init` invocations now produce `review_gates.enabled: true` (v0.4.0 required the explicit `--enable-review-gates` opt-in flag). New `_opt_out_reason: "<string>"` field lets consumers explicitly opt out; `harness sync --mode=check` ERRORS when `review_gates` is absent OR `enabled: false` without `_opt_out_reason`. **Repos that ran `harness init --enable-review-gates` per CS10 are unaffected.** Repos that never opted in must either opt-in (recommended) or set `_opt_out_reason`.
5. **`harness review-output` subcommand + `scripts/check-review-output.mjs` linter** (CS40) — validates a reviewer's output markdown against the CS40 schema (Analyzed-HEAD line, R1/Rn per-file enumeration vs `git diff --name-only`, finding-row shape `[Blocking|Non-blocking|Suggestion] <file>:<line>: <desc>`, verdict line). Optional `--update-pr` flag idempotently posts the parsed output as a row in the PR body's `## Review log` (canonical 6-column schema per REVIEWS.md §2.7). Optional independence-invariant guard parses the PR body's `## Model audit` and re-asserts that the reviewer model is NOT in the implementer set. NOT registered with `harness pr-evidence` per C40-8 (requires reviewer-output file unavailable in CI); orchestrators invoke it locally after capturing reviewer output.
6. **`scripts/check-clickstop-plan-review.mjs --strict` default-flip** (CS42) — the local-lint default flips from `false` (v0.4.0 warn-only) to `true` (v0.5.0 error) per CS35b-10 migration ramp. **Local `harness lint` invocations now ERROR rather than WARN on missing/stale `## Plan review` attestations on planned/active CS files.** (The PR-time A6 gate via `harness pr-evidence` was already strict from v0.4.0; this change brings local lint into alignment.)

## What changes for Sub Invaders

On the next `harness sync` after upgrading the pin to `v0.5.0`:

- **`review_gates.enabled` default-on**: SI is **expected to be unaffected** because CS10's recommended path was `harness init --enable-review-gates` which already inserts the `review_gates` block with `enabled: true`. **Verify at claim time** by inspecting `harness.config.json` for the `review_gates` block. If absent (e.g., CS10 was never claimed and SI skipped straight to CS11), either run `harness init --enable-review-gates` (recommended) or hand-add the block with `_opt_out_reason: "<reason>"` for explicit opt-out.
- **`Implementer agent` + `Reviewer agent` columns in PR template**: the `harness sync` will surface the two new rows in the composed PR template under `## Model audit`. Existing PRs in flight need a re-trigger (push an empty commit) to pick up the new template content. Missing-column severity is WARNING in v0.5.0 (defaults flip ERROR in v0.6.0); SI can populate the rows opportunistically during the v0.5.0 cycle.
- **`check-clickstop-plan-review.mjs --strict` default flip → ERROR**: SI's existing planned CS files (`planned_cs04_*`, `planned_cs05_*`, `planned_cs06_*`, `planned_cs08_*`) and the soon-to-be-superseded `planned_cs10_*` lack `## Plan review` sections. After the pin bump, `harness lint` will start ERRORING on these files. **Mitigation options:**
  - **(a) Recommended:** backfill `## Plan review` grandfather attestations on each pre-existing planned/active CS file. The grandfather row records that the file pre-dates the attestation requirement and uses `Verdict: Go-with-amendments` plus a ≤200-char recap noting "grandfathered at v0.5.0 pin-bump". The harness's own self-host repo did this during CS35b for in-arc files and during CS42 for pre-CS35b backlog (see agent-harness `LEARNINGS.md` LRN-122 candidate for the asymmetry-collapse rationale).
  - **(b) Migration window:** invoke local `harness lint` with `--strict=false` while backfill is in flight. This is safe for short-term work but should NOT become permanent — the PR-time A6 gate via `pr-evidence-lint` has been strict since v0.4.0 and bypasses local-lint settings.
  - **(c) Opt-out per-file:** not available; the linter operates at the lint-invocation level, not file level.
- **`harness copilot-engage` CLI**: when SI orchestrators dispatch Copilot reviews on PRs, prefer `harness copilot-engage <pr>` over hand-crafted `gh api graphql` calls. The CLI enforces A5 ordering automatically.
- **All other v0.4.0 deliverables** (PR template file class `composed`, doctrine sections in OPERATIONS.md / REVIEWS.md, sync warnings, branch-protection instruction block) come in via `harness sync` per CS10's "What changes for Sub Invaders" section — re-read CS10 for that detail; CS11 inherits all of it.

## Decisions (suggested, not binding)

| # | Decision | Suggested choice | Rationale |
|---|---|---|---|
| C11-1 | Pin target | `v0.5.0` (exact tag). | Stable release; published 2026-05-14. Skip the v0.4.0 stepping stone since CS10 was never claimed. |
| C11-2 | CS10 retirement | Move `planned_cs10_pin-harness-v0.4.0.md` → `done_cs10_pin-harness-v0.4.0.md` with `**Status:** superseded by CS11` header note in the same PR that claims CS11. | Preserves audit trail; avoids two simultaneous open pin-bump CSs. |
| C11-3 | `review_gates.enabled` posture | Accept the new default; if `harness.config.json` lacks the block at claim time, run `harness init --enable-review-gates` (recommended) OR hand-add the block with explicit `enabled: true`. | SI was already on track to opt in via CS10; the default-flip just removes the explicit-flag step. |
| C11-4 | Plan-review attestation backfill | **Backfill grandfather rows** on `planned_cs04`, `planned_cs05`, `planned_cs06`, `planned_cs08` before bumping the pin (or in the same PR). Use `Verdict: Go-with-amendments`, recap "grandfathered at v0.5.0 pin-bump per harness CS42-7", `Reviewer model` independent of the implementer model. Recompute hash via `node bin/harness.mjs plan-review-hash <file>` AFTER backfill content is finalized. | Avoids `harness lint` start failing immediately at pin-bump; matches what agent-harness self-host did during CS35b/CS42. |
| C11-5 | Agent columns in Model audit | Populate `Implementer agent` + `Reviewer agent` rows on all NEW PRs going forward at v0.5.0; defer backfill on closed CS files until v0.6.0 (when `--strict-agent-columns` defaults to error). | Lowest-friction path; aligns with the v0.5.0→v0.6.0 ramp built into the linter. |
| C11-6 | `harness review-output` adoption | OPTIONAL in v0.5.0. Adopt opportunistically when the SI orchestrator dispatches reviewer sub-agents and wants to capture per-file reviewer output. Not required for any CI gate. | NOT registered in CI; entirely a local-orchestrator quality-of-life tool. |
| C11-7 | `harness copilot-engage` adoption | RECOMMENDED for all future SI PR Copilot engagements. Replaces hand-crafted `gh api graphql` invocations and `gh pr edit --add-reviewer` calls. | Enforces A5 ordering automatically; `--no-poll` for CI; auto-detects repo. |
| C11-8 | Branch-protection re-confirmation | Re-confirm `pr-evidence-lint / read-only-gates` is still a required check on `main` after the workflow file refresh from `harness sync`. | Sync does not touch repo settings; manual confirmation needed (per CS38a C38a-8). |
| C11-9 | Risks | (a) `harness lint` will start failing on existing planned CS files until C11-4 backfill is done — order the PR to backfill BEFORE bumping the pin if SI orchestrator runs lint on the PR; (b) PR template change requires re-trigger on in-flight PRs; (c) sync warning surface area increases slightly — review the diff before merge. | (a) is the highest-risk item; mitigate by ordering. |

## Deliverables

1. Update `harness.config.json` `harness_pin` from prior version (`v0.3.x`) to `v0.5.0`.
2. Backfill `## Plan review` grandfather rows on `planned_cs04`, `planned_cs05`, `planned_cs06`, `planned_cs08` (per C11-4). Recompute hash via `node bin/harness.mjs plan-review-hash <file>` (or the SI-local equivalent if harness is vendored differently).
3. Move `planned_cs10_pin-harness-v0.4.0.md` → `done_cs10_pin-harness-v0.4.0.md` with `**Status:** superseded by CS11` header (per C11-2).
4. If `harness.config.json` lacks the `review_gates` block at claim time, run `harness init --enable-review-gates` OR hand-add the equivalent diff (per C11-3).
5. Run `harness sync` and accept the resulting diff (composed PR template gets `Implementer agent` + `Reviewer agent` rows; doctrine sections refresh).
6. Re-confirm branch-protection rule from the printed instruction block (per C11-8).
7. Update SI's `CONTEXT.md` / `WORKBOARD.md` to record the pin-bump from v0.3.x → v0.5.0 (skipping v0.4.0).
8. (Optional) Adopt `harness copilot-engage` for the next reviewer dispatch and `harness review-output` for the next reviewer sub-agent's output validation.

## Exit criteria

1. SI `harness.config.json` pins to `v0.5.0`.
2. `harness lint --quiet` runs clean (no errors) on the SI repo at the post-bump HEAD, including the four backfilled `## Plan review` sections passing the strict default.
3. `.github/workflows/pr-evidence-lint.yml` is present in SI's `.github/workflows/` (carried over from CS10 path; verify it matches the v0.5.0 template).
4. `harness sync --mode=check` runs clean (no drift).
5. `pr-evidence-lint / read-only-gates` is still a required check on SI's `main` branch protection.
6. At least one new SI PR has been opened post-pin-bump and has gone through the full `pr-evidence-lint` workflow (engage via `harness copilot-engage <pr>` + verify on subsequent CI re-run). The PR template should show `Implementer agent` + `Reviewer agent` rows in the Model audit section.
7. `planned_cs10_pin-harness-v0.4.0.md` is no longer in `planned/` (moved to `done/` with superseded note).
8. CONTEXT.md / WORKBOARD.md updated.

## Risks + open questions

- **R1 (medium):** First PR after the pin bump that runs `harness lint` will fail unless the C11-4 backfill is done first. Strongly recommend a pre-merge order: backfill in the same PR as the pin bump, OR file the backfill as a separate PR that lands BEFORE the pin-bump PR.
- **R2 (low):** First PR after pin bump will fail `read-only-gates` until Copilot is engaged. Use `harness copilot-engage <pr>` (NEW in v0.5.0) instead of the manual GraphQL recipe.
- **R3 (low):** `Implementer agent` + `Reviewer agent` rows missing on legacy closed CS files will WARN under `harness lint`. Defer per C11-5 — backfill in the v0.6.0 cycle when the strict-flip lands.
- **R4 (very low, noted for completeness):** If SI orchestrator inadvertently bumps directly to v0.5.0 without the C11-4 backfill, local lint will surface the failures within the same PR cycle. The fix is mechanical (same backfill, same hash recompute); no rollback needed.

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| D1 — Configure `cs_plan_lint.forbidden_path_prefixes` workaround in `harness.config.json` | pending | orchestrator | Per filed agent-harness issue [#183](https://github.com/henrik-me/agent-harness/issues/183): narrow defaults to `template/composed/` + `template/seeded/` until upstream fix lands. Removes 27 false-positive `cs-plan` violations on SI's legitimate `scripts/` / `bin/` / `lib/` references. |
| D2 — Backfill `## Plan review` grandfather rows on `planned_cs04`, `planned_cs05`, `planned_cs06`, `planned_cs08` | pending | orchestrator | Per C11-4. Use `Verdict: Go-with-amendments`; recap: "grandfathered at v0.5.0 pin-bump per harness CS42-7"; reviewer model independent of implementer model. |
| D3 — Add `review_gates` block to `harness.config.json` (per C11-3) | pending | orchestrator | Hand-add `{"enabled": true}` since CS10 was never claimed (otherwise `harness sync --mode=check` ERRORs in v0.5.0). |
| D4 — Bump `harness.config.json#version` from `v0.3.1` → `v0.5.0` | pending | orchestrator | Skip v0.4.0 (CS10 superseded by this CS). |
| D5 — Run `harness sync --mode=apply` and accept the resulting diff | pending | orchestrator | Composed PR template gains `Implementer agent` + `Reviewer agent` rows; `pr-evidence-lint.yml` workflow added; OPERATIONS.md / REVIEWS.md doctrine sections refresh. |
| D6 — Verify `harness lint --quiet` exits 0 | pending | orchestrator | Address remaining true-positive `cs-plan` violations (e.g., `done_cs01:74,173` referencing `template/composed/...` in inline code). |
| D7 — Verify `harness sync --mode=check` exits 0 | pending | orchestrator | Confirms no drift after the apply. |
| D8 — Re-confirm `pr-evidence-lint / read-only-gates` is still a required check on `main` branch protection | pending | orchestrator | Per C11-8 (sync does not touch repo settings). |
| D9 — Update `CONTEXT.md` to record the pin bump v0.3.1 → v0.5.0 (skipping v0.4.0) | pending | orchestrator | Per deliverable 7. |
| D10 — Engage Copilot review on the CS11 content PR via the new `harness copilot-engage <pr>` CLI | pending | orchestrator | Per C11-7; validates the new CLI ships working. |
| D11 — Move `planned_cs10_pin-harness-v0.4.0.md` → `done/done_cs10_pin-harness-v0.4.0.md` with supersession header (per C11-2) | done | orchestrator | Done in this claim PR. |
| C1 — Close-out: docs/restart-state refreshed (CHANGELOG, restart-state files) | pending | orchestrator | Per OPERATIONS.md close-out procedure. |
| C2 — Close-out: learnings + follow-up issues filed (incl. issue #183 link); `## Plan-vs-implementation review` filled | pending | orchestrator | Per RETROSPECTIVES.md and OPERATIONS.md close-out procedure. |

## Notes / Learnings

(filled during execution)

## Plan review

| Round | Reviewer model | Plan author model(s) | Reviewer agent | Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200 chars) |
|---|---|---|---|---|---|---|---|
| R1 | gpt-5.5 | claude-opus-4.7-xhigh | rubber-duck dispatched (orchestrator: yoga-ah) | fc0e68907e7a | 2026-05-14T05:45:00Z | Go-with-amendments | CS11 grandfather: filed cross-repo from agent-harness CS42 (cs10-supersede). Plan content unchanged at backfill. SI orchestrator may add R2 at claim time if plan needs amendments. |

## Plan-vs-implementation review

> _(filled at close-out per the gate)_

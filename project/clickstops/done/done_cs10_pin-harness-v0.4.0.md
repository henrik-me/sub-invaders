# CS10 — Pin harness to v0.4.0 + opt into pr-evidence gates

> **Superseded by:** CS11 (v0.5.0 pin-bump). CS10 was filed but **never claimed**; no implementation work was performed. The v0.4.0 pin-bump scope is fully subsumed by CS11 (v0.5.0 includes everything from v0.4.0 plus the CS40/CS41/CS42 arc). Retired in the same PR that claimed CS11 per `active_cs11_*.md` §C11-2.

**Status:** done
**Owner:** —
**Branch:** —
**Started:** —
**Closed:** — (superseded by CS11; never implemented)
**Filed by:** Cross-repo coordination from `henrik-me/agent-harness` CS39 (v0.4.0 release-cut). This file is filed by the agent-harness orchestrator (`yoga-ah`) per agent-harness CS39 Decision C39-4/C39-5; the SI orchestrator implements.
**Depends on:** None (claim any time after harness v0.4.0 is published — verified live via `gh release view v0.4.0 --repo henrik-me/agent-harness`).

## Goal

Pin Sub Invaders' harness consumption to the new `v0.4.0` release. The v0.4.0 release ships the #145 enforcement-gap arc — a substantial doctrine + linter + CI-workflow stack that closes the long-standing gap where doctrine existed in `REVIEWS.md` but was never mechanically enforced on PRs. Optionally opt into the new PR-evidence CI gates immediately to derive the value the release was designed for.

## Background

`henrik-me/agent-harness` v0.4.0 was published 2026-05-13 by the harness orchestrator after the eight-CS arc (CS35 → CS35b → CS36 → CS37 → CS38a → CS38b). The release ships:

1. **`harness pr-evidence` aggregator subcommand** with five mechanical PR-state gates (B1 commit-trailer audit, A3 reviewer-model independence, A4 stale-Analyzed-HEAD currency, A5 Copilot-review ordering, A6 plan-review attestation freshness, A16 Copilot-review presence) — runnable locally or in CI.
2. **`harness init --enable-review-gates`** opt-in flag that patches `harness.config.json` with the `review_gates` block, migrates `.github/pull_request_template.md` from `managed` → `composed` so consumers can keep their project-specific PR-template prose while picking up the doctrine-required Review log + Model audit skeleton blocks, and prints a branch-protection instruction block.
3. **`template/managed/.github/workflows/pr-evidence-lint.yml`** — managed CI workflow that wires `harness pr-evidence` into every PR (split into separate `read-only-gates` and `mutation-engage` jobs per ADR-0004; engagement happens via `gh pr edit --add-reviewer copilot-pull-request-reviewer` because the GraphQL `requestReviews` mutation rejects Bot reviewer IDs).
4. **`scripts/check-clickstop-plan-review.mjs` (CS35b)** — `## Plan review` attestation linter on `project/clickstops/{planned,active}/*.md` files. Warns standalone in v0.4.0 (`harness lint --strict=false` default); strict at PR-time.
5. **Reviewer-model fallback ladder** documented in `OPERATIONS.md` and `REVIEWS.md`: GPT-highest-available → Sonnet-highest → orchestrator's-own with independence invariant.

The CS37 spike outcome was **PASS**, so A5 + A16 ship as fully ENFORCED in v0.4.0 — not as deferred doctrine-only stubs. Consumers that opt in immediately get all six gates active.

## What changes for Sub Invaders

On the next `harness sync` after upgrading the pin to `v0.4.0`:

- The PR template file class transitions from `managed` → `composed`. Consumers that did NOT customize the prior managed PR template see no behavioural change. Consumers that DID customize will need either to run `harness init --enable-review-gates` (which performs the migration) or to add an explicit `composed.overrides[".github/pull_request_template.md"] = { _inherited_class: "managed", local_blocks: ["pull-request.review-evidence"] }` entry to `harness.config.json`. The `_inherited_class: "managed"` field records prior provenance for any future audit.
- A sync warning fires if `review_gates` block is absent from `harness.config.json`. The warning is informational in v0.4.0 (CS41 will flip it to ERROR in v0.5.0).
- All the new doctrine sections in `OPERATIONS.md` / `REVIEWS.md` come in via `harness sync` (composed merge — your local prose outside `harness:local-start/end` markers is preserved).

## Decisions (suggested, not binding)

| # | Decision | Suggested choice | Rationale |
|---|---|---|---|
| C10-1 | Pin target | `v0.4.0` (exact tag). | Stable release; matches what published 2026-05-13. |
| C10-2 | Opt-in path | Run `harness init --enable-review-gates` immediately. | Derives the value the release ships. Existing PRs that need to use the new gates need to be re-triggered (push an empty commit or close/reopen). Consumers who delay opt-in see no behavioural change. |
| C10-3 | Branch-protection | Add `pr-evidence-lint / read-only-gates` as a required check on `main` after the workflow is on `main` and has run successfully at least once. | Per CS38a C38a-8, the harness CLI does NOT auto-apply branch rulesets; maintainer applies via repo Settings → Branches → branch protection. |
| C10-4 | PR template handling | Accept the migration via `harness init --enable-review-gates`. SI's PR template has no project-specific customizations (verified against `henrik-me/sub-invaders/.github/pull_request_template.md` at SHA TBD), so the migration is no-op for content; only the file class changes. | Lowest-friction path. |
| C10-5 | Plan-review attestation backfill | NOT required for SI in v0.4.0 — the `## Plan review` linter is warn-only standalone in v0.4.0. SI can opt-in selectively by adding the attestation row to new planned/active CS files going forward; pre-existing files don't need backfill. | Defer cost; only necessary if SI starts using `harness pr-evidence` against its own PRs. |
| C10-6 | Risks | (a) Existing in-flight PRs need re-trigger to pick up the new workflow; (b) the workflow's `read-only-gates` job will fail on the FIRST PR after opt-in until Copilot is engaged via `mutation-engage` (per ADR-0004); (c) sync warning surface area increases — review the diff before merge. | Manageable; (b) is a known behaviour and is the canonical "first run after opt-in" cost documented in CS37 ADR. |

## Deliverables

1. Update `harness.config.json` `harness_pin` (or whatever the SI pin field is) from the prior version to `v0.4.0`.
2. Run `harness init --enable-review-gates` (or hand-craft the equivalent diff if init is judged too invasive).
3. Run `harness sync` and accept the resulting diff (composed PR template + new doctrine sections).
4. Apply the branch-protection rule from the printed instruction block via the repo Settings UI.
5. Update SI's `CONTEXT.md` / `WORKBOARD.md` to record the pin-bump and the new gate activation.

## Exit criteria

1. SI `harness.config.json` pins to `v0.4.0`.
2. `.github/workflows/pr-evidence-lint.yml` is present in SI's `.github/workflows/`.
3. `harness sync` runs clean (no drift).
4. `pr-evidence-lint / read-only-gates` is a required check on SI's `main` branch protection.
5. At least one new SI PR has been opened post-opt-in and gone through the full `pr-evidence-lint` workflow (engage via the `mutation-engage` workflow_dispatch + verify on subsequent CI re-run).
6. CONTEXT.md / WORKBOARD.md updated.

## Risks + open questions

- **R1 (low):** First PR after opt-in will fail `read-only-gates` until Copilot is engaged via `mutation-engage`. This is by design (ADR-0004 documents the engage-and-verify-on-separate-events pattern).
- **R2 (low):** SI may have customized `.github/pull_request_template.md` in ways not visible to a casual diff. Verify with `git diff main -- .github/pull_request_template.md` against the v0.3.x template baseline before running init.

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| (populated at claim time) | planned | — | — |

## Notes / Learnings

(filled during execution)

## Plan-vs-implementation review

**Reviewer:** —
**Date:** 2026-05-14
**Outcome:** Superseded — CS10 was never claimed and no implementation work was performed against this plan. The v0.4.0 pin-bump scope is fully subsumed by CS11 (v0.5.0 pin-bump, which includes everything CS10 would have delivered plus the CS40/CS41/CS42 arc). No plan-vs-implementation comparison applies. See `active_cs11_pin-harness-v0.5.0.md` §C11-2 for the supersession decision and CS11's own `## Plan-vs-implementation review` section for the v0.5.0 pin-bump close-out evidence.

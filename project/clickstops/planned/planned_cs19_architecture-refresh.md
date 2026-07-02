# CS19 — Refresh ARCHITECTURE.md: remove harness-owned references + fix staleness

**Status:** planned
**Owner:** —
**Branch:** —
**Started:** —
**Closed:** —
**Filed by:** omni-si, 2026-07-01, after the user flagged that ARCHITECTURE.md "references stuff that is not relevant for this repo" and directed that harness-owned content stay in the harness while this-repo issues get a CS.
**Depends on:** none

## Goal

Update sub-invaders' `ARCHITECTURE.md` so it accurately describes **this repository's**
architecture and stops carrying content that belongs to the `agent-harness` repo (the
bootstrap CS16 decision table and a now-404 cross-repo link), plus refresh the sections that
have drifted from the shipped code since CS12.

## Background

`ARCHITECTURE.md` is a seeded, consumer-owned document (created by `harness init`, never
overwritten by sync) that was authored during the harness-orchestrated CS16 bootstrap. It
currently mixes three kinds of content:

1. **Harness-owned content** that does not belong in this repo: a reproduced
   `### CS16 technology decisions (C16-9..C16-16)` table and a hard link into the harness's
   own `active/active_cs16_...` clickstop path. That link now returns **HTTP 404** (CS16 was
   closed and moved to `done/` upstream). The harness-side root cause is filed as
   **agent-harness#371**; the seeded template `template/seeded/ARCHITECTURE.md` is a clean
   generic skeleton, confirming this content was bootstrap-authored, not templated.
2. **Stale facts** that drifted from shipped reality: the header reads "Last updated
   2026-06-04 / CS12" though CS13, CS14, CS15, CS17, and CS18 have since shipped; the CI/CD
   table lists 4 jobs while
   the real `.github/workflows/ci.yml` runs 6 (adds `coverage` and an aggregate `ci` gate); a
   `## Future scope (CS02–CS04 — v1 complete)` heading frames v1 as the horizon; and the
   storage-account default is written two ways (`stsubinvaders$RAND6` vs `stsubinvadersee1282`).
3. **Legitimate sub-invaders architecture** (game/engine consumption, backend, Azure topology,
   data model, hardening) that is accurate and should be preserved.

This CS removes (1), refreshes (2), and preserves (3).

## Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| CS19-1 | Harness-owned CS16 decision table | Remove the `### CS16 technology decisions (C16-9..C16-16)` section from ARCHITECTURE.md; the decision records belong to agent-harness CS16 | Harness content stays in the harness (user directive); duplication rots and is already partly 404 (agent-harness#371) |
| CS19-2 | Cross-repo pointer | Delete the broken `active/` link; keep at most one stable pointer to the harness `done/done_cs16_bootstrap-sub-invaders/` record. Never link a transient `active/` path | The `active/` link is already 404; a `done/` reference is stable; a single pointer preserves provenance without re-duplicating harness content |
| CS19-3 | Inline `(C16-xx)` provenance tags | Strip the harness-internal `(C16-xx)` labels from prose; retain the underlying architecture facts and this repo's own decision references (`CS01-x`, `CS03`, `CS04-x`, `CS08-x`, `CS13-1`) | The `C16` numbering is harness-internal and not meaningful to a sub-invaders contributor; the facts themselves are sub-invaders' own |
| CS19-4 | Stale-fact refresh (bounded) | Update exactly: (a) the `Last updated` header; (b) the CI/CD section to match `.github/workflows/ci.yml` (6 jobs incl. `coverage` + aggregate `ci`); (c) the `## Future scope` section to reflect state through CS18; (d) the storage-account-name inconsistency | The user asked to "update the architecture"; leaving demonstrably stale facts while editing the file would be incoherent. Scope is limited to these four enumerated items — no unrelated prose is restructured |
| CS19-5 | Decision-log completeness | Add concise `## Decision log` rows for the CSs shipped since CS12 (CS13/CS14/CS15/CS17/CS18) whose decisions are not yet recorded there | Keeps the authoritative decision log current without re-deriving any harness content |
| CS19-6 | Required structure preserved | Keep the four linter-required headings (`## Overview`, `## Components`, `## Data model`, `## Decision log`); introduce no broken relative links; keep LF / no-BOM | `scripts/check-architecture.mjs` enforces the headings + relative-link integrity and `check-text-encoding` enforces LF/BOM; the file must stay lint-green |

## Deliverables

- Edited `ARCHITECTURE.md` in which:
  - the `### CS16 technology decisions` table is removed (CS19-1);
  - the broken `active/` cross-repo link is gone, replaced by at most one stable `done/`
    pointer (CS19-2);
  - inline `(C16-xx)` tags are stripped from prose while the architecture facts and
    sub-invaders' own decision references remain (CS19-3);
  - the header, CI/CD section, `## Future scope` section, and storage-account name are
    refreshed to match shipped reality (CS19-4);
  - the `## Decision log` records the CS13/CS14/CS15/CS17/CS18 decisions not previously
    captured (CS19-5).
- `harness lint` passes (notably `check-architecture` and `check-text-encoding`).
- No source, test, infra, or process files are changed by the content PR — this is a
  single-document change (the separate close-out PR touches only `WORKBOARD.md`,
  `CONTEXT.md`, and `LEARNINGS.md` per the standard three-PR shape).

## User-approval gates

None beyond the standard review loop. This is a docs-only change to a consumer-owned file
with no runtime, infra, or process-doctrine impact.

## Exit criteria

- ARCHITECTURE.md contains no reproduction of agent-harness CS16/C16-x decision content and no
  link into any `active/` clickstop path; at most a single stable `done/` pointer remains.
- The CI/CD table, `Last updated` header, `## Future scope` section, and storage-account name
  match shipped reality (verified against `.github/workflows/ci.yml` and the current tree).
- `harness lint` is green; the content-PR CI is green; the independent GPT-5.5 review verdict
  is `Go`; the Copilot review is engaged and all threads resolved.

## Risks + open questions

- **Risk — scope creep into a full rewrite.** Mitigation: CS19-4 enumerates the exact stale
  items to touch; all other prose is left structurally intact.
- **Risk — dropping useful provenance.** Mitigation: CS19-2 keeps one stable `done/` pointer so
  a contributor can still find why the stack was chosen.
- **Open question — pointer vs. full omission (CS19-2).** Default is to keep one stable `done/`
  pointer; defer to the plan/implementation reviewer if omission is preferred.

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| (populated at claim time per § Claim) | planned | — | — |

## Notes / Learnings

- Harness-side root cause filed as agent-harness#371 (bootstrap-authored consumer docs linking
  into transient `active/` paths + duplicated decision tables). This CS is the consumer-side
  remediation only.

## Plan review

| Round | Reviewer model | Plan author model(s) | Reviewer agent | Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200 chars) |
|---|---|---|---|---|---|---|---|
| R1 | gpt-5.5 | claude-opus-4.8 | rubber-duck dispatched (orchestrator: omni-si) | 1fef701cecd2 | 2026-07-02T05:36:26Z | Go-with-amendments | All 7 fact-claims confirmed. Amendment applied: replaced "CS13–CS18" range with explicit CS13/14/15/17/18 (no local CS16 exists). |

## Plan-vs-implementation review

> _(filled at close-out per the gate)_

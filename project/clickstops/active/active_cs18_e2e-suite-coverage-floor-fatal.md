# CS18 — Make the E2E suite-level coverage floor actually fail CI

**Status:** active
**Owner:** yoga-si
**Branch:** cs18/content
**Started:** 2026-07-01
**Closed:** —
**Filed by:** yoga-si (claude-opus-4.8), 2026-07-01, surfaced during CS08/LRN-028 harvest: the E2E suite-level aggregate floor check is non-fatal and has been printing a ❌ on `main` without failing CI.
**Depends on:** none (independent of CS17)

## Goal

Turn the E2E suite-level coverage floor into a real, blocking CI gate — one that
fails `npm run test:e2e:coverage` (and thus the `e2e-coverage` CI job) when the
aggregate coverage drops below its floors — and re-baseline the floors to the
current honest reality so the gate is green-when-passing rather than silently red.

## Background

`playwright.coverage.config.mjs` computes the E2E aggregate coverage and, in the
monocart-reporter `coverage.onEnd` hook, prints `❌ E2E coverage regression below
CS09 floor` and sets `process.exitCode = 1` on a violation.

**Root cause:** Playwright derives its process exit code from test results, not
from a late `process.exitCode` mutation inside a reporter's async shutdown hook,
so `playwright test` exits **0** even when the floor is breached — the ❌ is
cosmetic. LRN-028 records that this has been printing a regression on `main` since
low-coverage `game/modifiers/*` landed, i.e. the aggregate is currently BELOW the
CS09 floors (lines 77 / statements 87 / functions 84 / branches 69 / bytes 80),
so making the check fatal as-is would immediately (and correctly) fail CI.

Note: the separate **per-file** E2E gate (`scripts/coverage-perfile.mjs` via
`npm run coverage:check:e2e`) already runs after Playwright and exits non-zero
correctly; only the **suite-level aggregate** floor is non-fatal.

## Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| CS18-1 | Root cause | `process.exitCode = 1` set in monocart's `onEnd` does not fail the Playwright run; the suite floor is cosmetic. | Playwright's exit reflects test outcomes, not reporter-set exit codes. |
| CS18-2 | Enforcement mechanism | Enforce the suite floor in a **post-Playwright Node step** that reads the emitted coverage summary JSON and exits non-zero on any breach; wire it into `npm run test:e2e:coverage` after `playwright test` (mirroring `coverage:check:unit`). Keep the `onEnd` console output for humans but stop depending on its exit code. | A dedicated check has a reliable exit code; matches the already-working unit + per-file pattern. |
| CS18-3 | Single source of truth | Move the E2E suite-level floors into `coverage-thresholds.json` (which already holds unit + e2e per-file floors) under a dedicated suite-floors key, and have the post-step read them from there. Each floor is a numeric metric key (lines/statements/functions/branches/bytes); any `_reason` is a sibling metadata field the checker explicitly ignores (only numeric metric keys are compared). | One source of truth; no drift between the reporter literal and the gate; metadata can't be mistaken for a metric. |
| CS18-4 | Re-baseline | Set the E2E suite floors to the **current measured** aggregate (rounded down to a small margin), each documented with a `_reason`, rather than writing new E2E specs for `game/modifiers/*` to reach the old CS09 targets. | The gaps are unit-covered defensive/modifier code; adding offline-scenario E2E specs to recover a few points is disproportionate. Adding coverage stays an option if desired. |
| CS18-5 | Negative test | Before declaring done, run a negative test — temporarily raise a **suite-level** floor in `coverage-thresholds.json` above the measured value and confirm `npm run test:e2e:coverage` exits non-zero **specifically from the new suite-total checker** (its miss message), not from the per-file gate or the reporter console output (LRN-019 discipline). | Proves the suite gate actually blocks; the whole point of the CS. |

## Deliverables

1. **Suite-floor check** — a post-Playwright step (extend `scripts/coverage-perfile.mjs`
   with a suite-total mode, or a small sibling script) that reads the E2E coverage
   summary JSON, compares aggregate lines/statements/functions/branches/bytes to the
   floors, prints misses, and exits non-zero on any breach.
2. **`package.json`** — `test:e2e:coverage` runs the suite-floor check after
   `playwright test` (alongside the existing `coverage:check:e2e` per-file check).
3. **`coverage-thresholds.json`** — add an `e2e` suite-level floors block with the
   re-baselined values as numeric metric keys, plus an optional `_reason` metadata
   field per deviation that the checker ignores (only numeric metric keys are
   compared). Single source of truth for the suite floors.
4. **`playwright.coverage.config.mjs`** — read floors from `coverage-thresholds.json`
   (or drop the `onEnd` exit-code reliance and keep it console-only); remove the
   duplicated threshold literal.
5. **`LEARNINGS.md`** — update LRN-028's disposition to mark the e2e-floor sub-item
   resolved by CS18.
6. **`OPERATIONS.md`** — note in the "Coverage policy" section that the E2E
   suite-level floor is now enforced by the post-Playwright checker (single source
   of truth in `coverage-thresholds.json`), and that the unit suite is the primary
   gate for E2E-thin modules (`game/modifiers/*`) per the re-baseline (R2).

## User-approval gates

None — CI-gate hardening with no runtime/user-visible change.

## Exit criteria

1. `npm run test:e2e:coverage` exits **non-zero** when the E2E aggregate is below a floor
   (verified by a negative test) and **zero** at the re-baselined floors.
2. The `e2e-coverage` CI job fails on a real suite-floor regression.
3. E2E suite floors live in `coverage-thresholds.json` with documented `_reason`s; no
   duplicated literal drives the gate.
4. `harness lint` + CI green on `main` after the re-baseline (no lingering ❌).
5. Plan-vs-implementation review records GO.

## Risks + open questions

1. **R1 — Summary JSON shape.** The post-step must read the exact monocart
   `v8-json` / summary format; confirm the field path for aggregate percentages
   before wiring the gate (fail-closed if the file is missing/malformed).
2. **R2 — Re-baseline masks real regressions.** Lowering floors to current reality
   could hide the fact that `game/modifiers/*` are E2E-thin. Mitigation: document each
   `_reason`, and note in `OPERATIONS.md` "Coverage policy" that the unit suite is the
   primary gate for those modules.
3. **R3 — CI flakiness.** V8 coverage percentages can vary slightly run-to-run; set
   floors with a small margin below the measured value to avoid flaky failures.

## Model audit

| Field | Value |
|---|---|
| Implementer models | claude-opus-4.8, gpt-5.5 |
| Reviewer model | gemini-3.1-pro-preview |
| Implementer agent | yoga-si |
| Reviewer agent | rubber-duck |

## Plan review

| Round | Reviewer model | Plan author model(s) | Reviewer agent | Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200 chars) |
|---|---|---|---|---|---|---|---|
| R1 | gpt-5.5 | claude-opus-4.8 | rubber-duck | 632d2dfde316 | 2026-07-01T04:15:10Z | Go-with-amendments | Post-Playwright suite-total checker sound; clarified thresholds schema (_reason ignored), added OPERATIONS.md deliverable, made negative test suite-specific. No blockers. |

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| Suite-floor checker reading `coverage-report.json` `.summary.*.pct` vs `coverage-thresholds.json` `e2e.suite` (CS18-1/2) | planned | sub-agent #1 | Fail-closed if summary missing/malformed (R1). Distinct miss message for CS18-5. |
| Wire checker into `package.json` `test:e2e:coverage` after `playwright test` (CS18-2) | planned | sub-agent #1 | Alongside existing `coverage:check:e2e` per-file check. |
| Re-baseline `e2e.suite` floors to measured aggregate (small margin) with `_reason`s (CS18-3/4) | planned | sub-agent #1 | Single source of truth; drop the duplicated literal in `playwright.coverage.config.mjs`. |
| Negative test: raise a suite floor, confirm non-zero exit from the new checker (CS18-5) | planned | sub-agent #1 | Must fail from the suite checker's message, not per-file gate/reporter (LRN-019). |
| Update `LEARNINGS.md` (LRN-028 e2e-floor sub-item resolved) + `OPERATIONS.md` Coverage policy (CS18-6) | planned | sub-agent #1 | Note suite floor now enforced; unit is primary gate for `game/modifiers/*`. |
| Close-out docs + restart state | planned | orchestrator | active→done, WORKBOARD cleared, CONTEXT.md updated. |
| Close-out learnings + follow-ups | planned | orchestrator | Confirm no lingering ❌ on `main`; file LRN if the re-baseline surfaces anything. |

## Notes / Learnings

Filled during execution.

## Plan-vs-implementation review

> _(filled at close-out per the gate)_

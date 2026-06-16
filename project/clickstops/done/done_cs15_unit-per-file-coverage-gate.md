# CS15 — Wire unit per-file coverage gate into CI + close flags/whaleshark coverage gap

**Status:** done
**Owner:** omni-si
**Branch:** cs15/content
**Started:** 2026-06-16
**Closed:** 2026-06-16
**Filed by:** omni-si (Claude Opus 4.8) on 2026-06-15, surfacing the complete-but-uncommitted coverage work found in the working tree during session-start bootstrap. The gap was documented but deferred: CS14's close-out disposition (LEARNINGS.md, CS14 entry) carved out the "Node-24-local vs Node-20-CI V8 branch-count skew on `src/game/{flags,whaleshark}.mjs`" as a separate pre-existing item; CS09 shipped the per-file coverage tooling but the unit suite's per-file floors were never wired into `ci.yml` (only the c8 aggregate thresholds run there).
**Depends on:** none (CS09 shipped the per-file gate tooling; CS14 documented the deferred gap this CS closes).

## Goal

Make the unit per-file coverage gate (`npm run coverage:check:unit`) run in CI and pass deterministically on both Node 20 (CI) and Node 24 (local), closing the documented `src/game/{flags,whaleshark}.mjs` per-file gap by raising real coverage — not by lowering thresholds. After this CS a per-file unit-coverage regression on any single source file is caught on every PR, matching the E2E suite which already enforces its per-file gate.

## Background

CS09 ("coverage-hardening-and-required-gates") introduced `scripts/coverage-perfile.mjs` + `coverage-thresholds.json` with suite floors, per-file defaults, and per-file overrides for both the unit and E2E suites. The E2E suite runs its per-file gate via `npm run test:e2e:coverage` (which chains `coverage:check:e2e`). The unit suite's coverage CI step, however, only invoked `c8 --check-coverage` with AGGREGATE thresholds (lines/statements/functions/branches totals) and never ran `coverage:check:unit` — so a single unit file could sit below its per-file floor while CI stayed green.

Separately, CS14's close-out disposition recorded a "Node-24-local vs Node-20-CI V8 branch-count skew on `src/game/{flags,whaleshark}.mjs`" as "a separate pre-existing item, not a CS14 regression." Locally (Node 24) the per-file gate failed for these two files (whaleshark.mjs ~85% stmt / ~59% branch; flags.mjs ~77% branch — below the 90/80 floors); on Node 20 CI the branch arithmetic differs.

The fix (already authored and green in the working tree, backed up to the session as `cs15-coverage-work.patch`): add targeted unit tests that raise the two files' coverage comfortably above floor on both Node versions, and add a dedicated "Unit per-file coverage floors" CI step that runs `npm run coverage:check:unit` against the json-summary the existing c8 step already writes.

## Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| CS15-1 | How to enforce unit per-file floors in CI | Add a dedicated `Unit per-file coverage floors` step to `.github/workflows/ci.yml` immediately after the existing c8 unit-coverage step; it runs `npm run coverage:check:unit` against `coverage-report-unit/coverage-summary.json`. Guard: if the summary file is absent (no unit tests ran), echo a skip note and `exit 0`. | The c8 step already writes a json-summary, so reusing it avoids a second instrumented run. The guard mirrors the existing defensive "no tests ran" handling and keeps the step from hard-failing on an empty matrix. Per-file gating is the same shape the E2E suite already uses. |
| CS15-2 | How to close the flags/whaleshark gap | Raise REAL coverage by ADDING unit tests to `src/game/flags.test.mjs` (+6) and `src/game/whaleshark.test.mjs` (+17). Do NOT lower thresholds or add per-file overrides for these files. | Raising coverage well above the floor (whaleshark.mjs ~85->100% stmt, ~59->~99% branch) makes the gate robust to the documented Node-version branch-count skew, whereas an override would mask the gap permanently and weaken the gate for those files. |
| CS15-3 | Scope boundary | Test files + one CI workflow step ONLY. No production `src/**` code changes, no `coverage-thresholds.json` changes, no aggregate-threshold changes. | Smallest blast radius: correctness is provable by "`npm run test:unit:coverage` exits 0 on both Node versions and the CI unit-coverage job now enforces per-file floors." Threshold tuning is a separate concern, deliberately excluded. |

## Deliverables

1. `.github/workflows/ci.yml`: a `Unit per-file coverage floors` step after the c8 unit-coverage step, running `npm run coverage:check:unit`, guarded by a `coverage-report-unit/coverage-summary.json` existence check (skip + `exit 0` when absent).
2. `src/game/whaleshark.test.mjs`: +17 targeted tests raising `src/game/whaleshark.mjs` per-file coverage above floor on both Node 20 and Node 24 (spawn-interval RNG fallbacks + clamping, alternating entry-edge / despawn paths, `checkHit` aabb/kill + tolerant geometry, render / forceSpawn / maybeSpawn / reset paths).
3. `src/game/flags.test.mjs`: +6 targeted tests raising `src/game/flags.mjs` branch coverage above floor (`parseMetaFlags` empty-segment / empty-key handling, `readDefaultFlags` no-document path, `fetchFlags` no-fetch / `timeoutMs=0` / no-`AbortController` paths).
4. Verification: `npm run test:unit:coverage` exits 0 (per-file gate green over all unit source files); `npm run test:unit` all green; `harness lint` + `harness sync --mode=check` green; zero `coverage-thresholds.json` diff.

## User-approval gates

CS15 performs no irreversible or public-facing operations (no repo creation, no tag/release, no destructive deletes; the engine source is untouched). The only approval gates are the standard branch-protection PR approvals the user gives on each of the four PRs (filing, claim, content, close-out). No additional per-step pause is required.

## Exit criteria

- `npm run test:unit:coverage` exits 0 locally (Node 24) AND the CI unit-coverage job's new per-file step is green (Node 20).
- `npm run test:unit` reports 0 failures; backend `dotnet test api/` remains green.
- `harness lint` reports 0 failed; `harness sync --mode=check` reports no drift.
- No change to `coverage-thresholds.json` or to any production `src/**` module.
- Content PR: rubber-duck `Go` recorded + Copilot review engaged with no unresolved blocking findings.
- CS file rotated `planned -> active -> done`; WORKBOARD reflects the lifecycle; CONTEXT/LEARNINGS updated at close-out.

## Risks + open questions

- **R1 — Node-version branch-count skew persists.** Even after adding tests, V8 branch counting may differ Node 20 vs 24. Mitigation: CS15-2 raises coverage well clear of the floor (whaleshark branch ~99% vs the 80 floor), leaving ample margin; the CI step (Node 20) is the source of truth and is verified green before merge.
- **R2 — Empty / unchanged unit matrix.** If a future change skips unit tests, the new CI step must not hard-fail. Mitigation: CS15-1 guards on the summary file's existence (skip + `exit 0`).
- **Open question:** none blocking. Extending per-file gating to any additional suite is out of scope.

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| Land ci.yml per-file unit step + flags/whaleshark tests on cs15/content | planned | orchestrator | Restore stashed work; verify `test:unit:coverage` green. Deliverables 1-4. |
| Content PR: local gauntlet + rubber-duck Go + copilot-engage + merge | planned | orchestrator | User approves merge. |
| Close-out: docs + restart state | planned | orchestrator | Update WORKBOARD + CONTEXT; rotate `active -> done`. |
| Close-out: learnings + follow-ups | planned | orchestrator | File LEARNINGS entry (unit per-file gate wired; flags/whaleshark skew closed); no follow-up CS expected. |

## Notes / Learnings

Final per-file coverage (Node 24 local; CI Node 20 green): `flags.mjs` 100% stmt / 96.29% branch; `whaleshark.mjs` 100% stmt / 98.88% branch — both comfortably above the per-file floors, so the gate holds across the Node-version branch-count skew. Added-test counts: +6 `flags.test.mjs`, +17 `whaleshark.test.mjs` (unit suite 428 → 451). No `coverage-thresholds.json` override was needed. Content shipped as squash `6851611` (PR #102); a follow-up commit renamed two `whaleshark` tests for left-moving clarity per Copilot. Learning filed as LRN-026. A pre-existing flaky E2E test (`game-flow.spec.mjs:26 — KeyM on game-over returns to the main menu`) surfaced during CI and passed on re-run — noted in LRN-026 as a follow-up candidate; no follow-up CS filed.

## Model audit

| Field | Value |
|---|---|
| Implementer models | claude-opus-4.8 |
| Reviewer model | gpt-5.5 |
| Implementer agent | omni-si |
| Reviewer agent | rubber-duck |

## Plan review

| Round | Reviewer model | Plan author model(s) | Reviewer agent | Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200 chars) |
|---|---|---|---|---|---|---|---|
| R1 | gpt-5.5 | claude-opus-4.8 | rubber-duck dispatched (orchestrator: omni-si) | 72e4a3de7157 | 2026-06-16T15:01:53Z | Go | No blockers/amendments; Decisions+Deliverables coherent; factual claims verified (ci.yml aggregate-only baseline, CS09 tooling, CS14 deferred gap all exist); R1/R2 cover material risks. |

## Plan-vs-implementation review

**Reviewer:** gpt-5.5 (rubber-duck, dispatched by orchestrator omni-si)
**Date:** 2026-06-16T16:03:06Z
**Outcome:** GO

All four deliverables matched the plan, with no divergences, additions, or drops. Decisions CS15-2 (raise real coverage rather than lower thresholds) and CS15-3 (scope = test files + one CI step) were honored — the merged diff (squash `6851611`) touches only `.github/workflows/ci.yml`, `src/game/flags.test.mjs`, and `src/game/whaleshark.test.mjs`, with no production `src/**` module change and no `coverage-thresholds.json` change. Test coverage is **sufficient**. Local verification at close-out: `npm run test:unit` 451/451 pass; `npm run test:unit:coverage` exit 0 with the unit per-file gate green over 30 files; `dotnet test api/` 95/95; harness lint 18 passed / 0 failed; harness sync `--mode=check` no drift.

| Deliverable | Outcome | Notes |
|---|---|---|
| D1 — CI unit per-file coverage floors step | match | `ci.yml` adds `Unit per-file coverage floors` immediately after the c8 unit-coverage step, checks for `coverage-report-unit/coverage-summary.json`, skips with `exit 0` when absent, then runs `npm run coverage:check:unit`. |
| D2 — whaleshark +17 tests | match | Diff adds 17 `whaleshark.test.mjs` tests; `whaleshark.mjs` now at 100% statements / 98.88% branches. |
| D3 — flags +6 tests | match | Diff adds 6 `flags.test.mjs` tests; `flags.mjs` now at 100% statements / 96.29% branches. |
| D4 — verification | match | `test:unit` 451/451; `test:unit:coverage` per-file gate green over 30 files; harness lint 18/0; sync no drift; `dotnet test api/` 95/95; commit touches only the 3 planned files, not `coverage-thresholds.json`. |

Test-coverage assessment: **sufficient**.

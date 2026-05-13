# CS09 — coverage hardening to ≥90% + required gates

**Status:** planned
**Owner:** —
**Branch:** —
**Started:** —
**Closed:** —
**Depends on:** CS07 (E2E Playwright tests), `chore/e2e-coverage` PR #31 (coverage measurement infrastructure)

## Summary

Push both the Playwright E2E suite and the Node `--test` unit suite to ≥90%
coverage across statements, functions, and lines (and ≥85% branches), then
flip the corresponding CI gates to **required** so regressions block PRs.

This CS depends on CS07 (E2E suite) and on the in-flight `chore/e2e-coverage`
PR (measurement infrastructure for both suites).

## Baseline (measured 2026-05-12, branch `chore/e2e-coverage`)

| Suite | Stmts | Branches | Funcs | Lines |
|---|---:|---:|---:|---:|
| E2E (monocart V8, 8 specs) | 78.83% | 60.68% | 77.24% | 68.72% |
| Unit (c8, 115 tests) | 86.41% | 74.52% | 84.10% | 86.41% |

## Targets

For each suite independently:

| Metric | Target |
|---|---:|
| Statements | ≥ 90% |
| Functions | ≥ 90% |
| Lines | ≥ 90% |
| Branches | ≥ 85% |

Branches set lower because defensive `if`-arms (e.g. storage-not-available
fallbacks) are intentionally hard to exercise from outside.

Per-file floors: every `src/**/*.mjs` file ≥ 80% lines except documented
exceptions (see "Exclusions" below).

## Gap analysis

### E2E gaps (current → target lines)

| File | Current | Notes |
|---|---:|---|
| `engine/sprite.mjs` | 34% | Need specs that load and render the sprite atlas; likely needs a test hook to introspect frame state. |
| `game/score.mjs` | 46% | Need specs that kill each enemy type (jellyfish, anglerfish, giant squid, mystery) and assert score increments. |
| `engine/seed.mjs` | 52% | Test specs across multiple seeds; verify PRNG branch coverage. |
| `engine/loop.mjs` | 53% | Pause/resume, visibility-change handling, frame skipping. May need test hook. |
| `game/scenes/play.mjs` | 62% | Largest file (537 LOC). Needs specs for pause overlay, debug overlay, scene transitions, game-over → restart cycle. |
| `engine/input.mjs` | 62% | Exercise all key bindings (left/right/space/escape/p/etc) and key-state edge cases. |
| `engine/collision.mjs` | 63% | Edge cases — boundary touches, no-overlap, axis-aligned tangents. |
| `game/invaders.mjs` | 66% | Fire-pattern variations, formation movement at different speeds, edge wraps. |
| `game/test-hooks.mjs` | 68% | Add specs that exercise the unused hooks. |
| `game/player.mjs` | 71% | Torpedo cooldown, off-screen torpedoes, edge-of-screen movement clamp. |
| `engine/audio.mjs` | 0% | **Requires user-gesture fixture** that taps the canvas before the page loads `audio.mjs`. |

### Unit gaps (current → target lines)

| File | Current | Notes |
|---|---:|---|
| `game/scenes/play.mjs` | 67% | Same 537-LOC file. Add unit tests for non-DOM logic: scene state machine, transition guards, debug-overlay pure formatters. |
| `engine/sprite.mjs` | 68% | Needs `fetch` mock for the atlas JSON, then exercise atlas-lookup paths. |
| `engine/audio.mjs` | 84% | Add Web Audio API mock; cover error fallback paths. |
| `engine/loop.mjs` | 84% | Cover `document.visibilitychange` lifecycle paths. |

`game/test-hooks.mjs` is **excluded** from the unit denominator (browser-only
APIs; covered by E2E).

## Implementation plan

### Phase 1 — exclusions + thresholds (small)

1. Codify the exclusion list in both configs (`playwright.coverage.config.mjs`
   and the c8 invocation). Document each exclusion inline.
2. Add per-suite threshold enforcement at the **current baseline** as a
   regression guard:
   - c8: `--check-coverage --lines=86 --statements=86 --functions=84 --branches=74`
   - monocart: `coverage.thresholds = { lines: 68, statements: 78, functions: 77, branches: 60 }`
3. Wire `coverage` job into the `ci` umbrella so the existing required `ci`
   check fails on regression. (No new required-status-check context to add.)

### Phase 2 — write missing tests (bulk of the work)

Per-file:
- `engine/audio.mjs` — E2E user-gesture fixture; unit Web-Audio mock.
- `engine/sprite.mjs` — unit `fetch` mock + E2E test hook for frame state.
- `game/score.mjs` — E2E enemy-kill specs (4 types).
- `engine/seed.mjs` — unit branch tests across multiple seeds.
- `engine/loop.mjs` — unit visibility-change tests; E2E pause/resume spec.
- `game/scenes/play.mjs` — unit tests for pure formatters; E2E specs for
  pause overlay, debug overlay, game-over → restart, scene transitions.
- `engine/input.mjs` — unit tests for every key binding; key-state edge
  cases.
- `engine/collision.mjs` — unit tests for boundary cases.
- `game/invaders.mjs` — unit tests for fire patterns + formation edges.
- `game/player.mjs` — unit tests for torpedo cooldown + screen clamp.

### Phase 3 — bump thresholds + flip gates

1. After Phase 2, raise both threshold sets to the targets above.
2. Promote the `e2e-coverage` workflow to PR-required:
   - Move coverage measurement into the existing `e2e-local` job (same
     run, +3-8% wall-clock per measured CI overhead).
   - OR add `e2e-coverage` to `infra/main-protection-ruleset.json` +
     live ruleset id `16210336` via `gh api -X PUT` (same pattern as
     CS07's e2e-local flip).
3. Document the policy in `OPERATIONS.md` (under a new "Coverage policy"
   subsection): thresholds, exceptions, how to update, where to find
   the HTML report.

## Exclusions (documented)

- `src/game/test-hooks.mjs` — excluded from **unit** denominator (browser-only
  APIs; covered by E2E).
- `src/game/api.mjs` — excluded from both (1-line `export {}` stub for CS03;
  re-include when CS03 lands).
- `src/index.html` — excluded; not JS.

## Acceptance criteria

- [ ] Both suites measured; numbers reported.
- [ ] E2E lines ≥ 90%, branches ≥ 85% (per-file floors honored).
- [ ] Unit lines ≥ 90%, branches ≥ 85% (per-file floors honored).
- [ ] Both suites enforce thresholds in CI (failing build on regression).
- [ ] At least one of the two coverage gates is required on `main` ruleset.
- [ ] `OPERATIONS.md` "Coverage policy" subsection added.
- [ ] No new flaky tests (3-run rerun stability).

## Risks

- E2E coverage of `engine/loop.mjs` may plateau below 90% — game-loop
  internals are hard to reach from the outside. Mitigation: lean more on
  unit tests for that file; document any remaining shortfall.
- Threshold gates are abrasive when CS work-in-progress legitimately
  drops a number. Mitigation: thresholds set on the **suite total**, not
  per-file (per-file is a soft floor in OPERATIONS.md). Per-CS exemption
  flow if needed.
- Adding the coverage step to `e2e-local` adds 5-15s wall-clock. Acceptable
  given the suite is already 218s on CI.

## Out of scope

- Mutation testing.
- Coverage of `api/` (.NET Functions) — `dotnet test` already runs and
  has its own coverage path; out of scope for this CS.
- Coverage trending dashboards / Codecov integration.

## Dependencies

- CS07 (e2e suite) — done.
- `chore/e2e-coverage` PR — measurement infrastructure; in flight.

## Co-authored-by

Co-authored-by: Copilot &lt;223556219+Copilot@users.noreply.github.com&gt;

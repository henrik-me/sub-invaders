# CS20 — Stabilize the nightly webkit E2E suite (issue #111)

**Status:** planned
**Owner:** —
**Branch:** —
**Started:** —
**Closed:** —
**Filed by:** yoga-si (claude-opus-4.8), 2026-07-01, surfaced from issue #111 (recurring nightly webkit E2E flakiness) during the open-issue relevance review; user-requested a CS with a detailed plan.
**Depends on:** none

## Goal

Stop the `e2e-nightly` workflow from recurrently, falsely failing on **webkit**
and re-paging issue #111, without weakening it as a real production-regression
detector. Deliver a root-cause-informed stabilization: reproduce the observed
webkit failures, harden the flake-prone waits with target-aware budgets, give
webkit a slightly larger retry budget in the nightly, fix any genuine webkit
product/test bug uncovered, and make the auto-filed failure issue name the
failing spec + browser so triage is actionable. Success = the nightly runs green
across all three browsers on consecutive nights and #111 can be closed.

## Background

`.github/workflows/e2e-nightly.yml` runs the full Playwright E2E suite once per
day (cron `0 6 * * *`) against **production** (`BASE_URL =
https://happy-coast-04ffcaa1e.7.azurestaticapps.net`) as a 3-browser matrix
(`chromium`, `firefox`, `webkit`, `fail-fast: false`). It inherits
`playwright.config.mjs` `retries: process.env.CI ? 1 : 0` (so **1 retry** in CI)
and `workers: 1`. On any failure the `open-issue-on-failure` job upserts a single
dedup'd issue labeled `e2e-nightly-fail` ("Nightly E2E failed", #111): it comments
on the existing open issue if present, else creates one, and **never self-closes**
on a subsequent green night (verified; the comment body currently carries only a
run URL, no failing-spec detail).

**Observed failures — both webkit-only, both survived the single retry:**

| Night | Run | Failing spec | Symptom |
|---|---|---|---|
| 2026-06-29 | 28365058247 | `tests/e2e/score.spec.mjs:152` "killing a squid (row 0) awards 40 points" | `expect(...).toBe(...)` equality mismatch; 47 passed / 1 failed |
| 2026-07-01 | 28507543218 | `tests/e2e/offline.spec.mjs:53` "an offline ranked score is queued, then drained on the next online load" | `expect.poll(() => pendingCount, { timeout: 5_000 }).toBe(0)` never reached 0; 50 passed / 1 failed |

Nightly history: `06-24..06-28` + `06-30` green; `06-29` + `07-01` red — i.e.
intermittent, ~2 of last 8 nights, always webkit, never chromium/firefox.

**Root-cause framing (to be confirmed by the repro deliverable):**

- `/api/*` is **route-mocked at the Playwright layer** via the `_fixtures.mjs`
  `defaultApiStubs` auto-fixture (and per-spec `page.route` overrides) even in the
  nightly, so Azure Functions cold starts are **not** the cause. The variance is
  **webkit timing-sensitivity** — browser-execution speed plus production
  static-asset / Service-Worker load timing (Service Workers are **not** disabled
  in the nightly) — hitting timing-sensitive gameplay/input/assertion and
  `expect.poll`/hook paths with only **one** retry. The two observed failures
  differ in shape: `offline.spec.mjs` is a literal 5s `expect.poll`, but
  `score.spec.mjs` failed an equality assertion after shorter (~2.5-3s) gameplay
  waits — so the shared factor is webkit timing, not one specific 5s constant.
- webkit-on-Linux is the known-flakiest Playwright target; chromium/firefox pass
  consistently on the same nights, which points at browser-timing rather than a
  cross-browser product regression.
- The `offline` failure specifically exercises `src/game/main.mjs`
  `drainPendingOnLoad()` (guarded by `if (nav && nav.onLine === false) return;`)
  → `src/game/pending-scores.mjs` `drain()` on reload. Whether webkit ever takes
  the `navigator.onLine === false` early-return in headless CI, or simply loses a
  timing race against the concurrent `waitForReady()` Space-press loop, must be
  established before choosing between a product fix and an assertion hardening.

**Non-goals / constraints:** the Canvas 2D engine is the external
`canvas-game-engine` dependency and MUST NOT be modified here (isolation
invariant). This CS does not re-architect the nightly target (live prod vs pinned
preview) — that is captured as a follow-up open question.

## Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Framing | Treat as **systemic webkit-nightly stabilization**, not a per-spec patch. | Two *different* specs flaked on different nights with *different* shapes (a 5s poll vs an equality assertion after ~2.5-3s gameplay waits); fixing only one just relocates the failure. The shared factor — webkit timing-sensitivity across gameplay/input/assertion + poll/hook paths, with only 1 retry against prod — is the real target. |
| 2 | Reproduce before changing | **Attempt** to reproduce both failures under `--project=webkit` against `BASE_URL=<prod>` (and a local prod-build `serve`) within a **bounded budget**, capturing Playwright traces — proceed with instrumentation/hardening if it does not reproduce (see Deliverable 1). | Distinguishes a genuine webkit product/test bug (e.g. drain early-return / unawaited work) from pure timing flake, so the fix is targeted rather than a blanket timeout bump. |
| 3 | Target-aware wait budgets | Replace scattered hardcoded wait budgets (`5_000` `expect.poll`/hook timeouts **and** the shorter ~2.5-3s gameplay/input waits in the affected specs) with a **shared helper/constant** that yields a **larger budget for the deployed/nightly target** and keeps a **tight budget for local**. | The deployed target has higher, variable latency; a single hardcoded budget cannot serve both local and remote. Local stays strict so real slow-downs still surface; only the remote budget widens. |
| 4 | WebKit retry budget | Raise the **nightly** retry budget for webkit from **1 → 2** (scoped to the nightly/webkit path; leave PR `e2e` and `e2e-local` at 1). | A second retry materially reduces webkit-on-Linux flake; a *deterministic* regression still fails all webkit attempts (webkit-only regressions are possible, so retry=2 is an accepted noise/signal tradeoff, not a detection guarantee). Scope-limiting keeps PR-time signal fast and strict. |
| 5 | Fix genuine bugs, else harden assertions | If the repro shows the webkit drain genuinely skips/races (e.g. `navigator.onLine`, an unawaited drain, or SW interplay), **fix the product/test path**; otherwise **harden the assertions** to poll the observable end-state with the target-aware budget. **Engine code stays untouched.** | Keeps the fix honest: a real bug gets fixed at source; a pure flake gets a robust wait rather than masking. |
| 6 | Nightly signal quality | Keep **single-run failure alerting** (do NOT gate paging behind N consecutive red nights), but **enrich the auto-filed issue comment/body with the failing spec name(s) + browser** parsed from the Playwright report. | Delaying alerts would hide real regressions; enriching context makes #111 immediately actionable instead of a bare run URL. |
| 7 | Anti-regression proof | Prove stability by running the affected webkit specs **≥5× consecutively green** against the prod `BASE_URL` (e.g. `--repeat-each=5`) in the content PR, and document the target-aware-budget convention. | Converts "seems fixed" into evidence; documents the pattern so future specs don't re-introduce hardcoded 5s remote polls. |

## Deliverables

1. **Repro + root-cause notes** (Decision 2): attempt to reproduce
   `score.spec.mjs:152` and `offline.spec.mjs:53` under webkit against the prod
   `BASE_URL`. Because the failures are **intermittent**, bound the effort — run a
   fixed budget (e.g. `--repeat-each=20` per spec with `trace: on`); if it does not
   reproduce within budget, **record the non-reproduction and proceed** with
   targeted instrumentation / assertion hardening rather than blocking on a repro.
   Record findings (timing-flake vs genuine bug, incl. whether `navigator.onLine`
   is ever `false` in headless webkit CI) in this CS file's `## Notes / Learnings`
   and/or an attached trace summary.
2. **Target-aware E2E wait-budget helper** (Decision 3): a small shared module
   (e.g. `tests/e2e/_timeouts.mjs`, or an extension of `_fixtures.mjs`) exposing a
   budget that scales local-vs-deployed, replacing the hardcoded `5_000`
   `expect.poll`/hook timeouts in the affected specs. Unit-covered where practical.
3. **Spec fixes** (Decision 5): stabilize `tests/e2e/offline.spec.mjs` and
   `tests/e2e/score.spec.mjs` — genuine product/test fix in
   `src/game/*` **only if** the repro proves a real webkit bug, otherwise
   assertion hardening via the helper. No change under `canvas-game-engine`.
4. **Nightly retry scope** (Decision 4): `playwright.config.mjs` and/or
   `e2e-nightly.yml` change so the nightly webkit path uses 2 retries while PR
   `e2e`/`e2e-local` stay at 1; keep the existing `if: failure()` trace/report
   artifact upload.
5. **Enriched failure issue** (Decision 6): update
   `.github/workflows/e2e-nightly.yml` `open-issue-on-failure` to include the
   failing spec(s) + browser in the issue comment and newly-created body. This
   requires wiring a machine-readable source: add a **JSON reporter** (e.g.
   `['json', { outputFile: ... }]`) to the nightly Playwright run, **upload it as
   a per-matrix-job artifact** (or emit a job output), and have the
   `open-issue-on-failure` job **download/parse** it to extract the failing
   spec + browser — the current config has no JSON reporter and the issue job
   cannot see the matrix job's report.
6. **Stability evidence** (Decision 7): a repeatable command run green ≥5×
   consecutively for the affected webkit specs against prod `BASE_URL`, captured
   in the content PR body.
7. **Docs + learnings:** a note on target-aware E2E wait budgets + the
   webkit-nightly retry rationale (in `CONVENTIONS.md` or the tests README), a
   `LEARNINGS.md` entry, and a `CONTEXT.md` update at close-out.
8. **Close-out: docs + restart state** — update `WORKBOARD.md`, `CONTEXT.md`,
   and any affected process/feature docs so a fresh agent can restart from the
   real state.
9. **Close-out: learnings + follow-ups** — file/disposition `LEARNINGS.md`
   entries; file planned follow-up CSs for anything deferred (e.g. nightly
   target = pinned preview build).

## User-approval gates

- **None required beyond standard review.** All changes are consumer-side (tests,
  Playwright config, nightly workflow, and — only if a real bug is proven —
  `src/game/*`). Flag for the user only if root-cause work turns out to require
  touching production submit/drain behavior in a user-visible way.

## Exit criteria

- Both previously-flaky specs pass **≥5 consecutive** webkit runs against the
  production `BASE_URL` locally (evidence in the content PR).
- No hardcoded `5_000` `expect.poll`/hook timeout remains in the affected specs;
  the shared target-aware budget helper is in use.
- The nightly webkit path uses 2 retries; PR `e2e`/`e2e-local` retry budget
  unchanged.
- `e2e-nightly` runs **green across chromium + firefox + webkit** for **≥3
  consecutive nights** post-merge; issue #111 is then closed (manually or via a
  close-out follow-up).
- The auto-filed nightly failure issue names the failing spec(s) + browser.
- `harness lint` green; `npm run test:unit` + `npm run test:e2e` green; per-file
  and suite coverage floors still met.

## Risks + open questions

- **WebKit-on-Linux may remain intrinsically flaky.** Retries + wider remote
  budgets mitigate but cannot fully eliminate; residual flake is an accepted risk
  vs. the noise of a false-red nightly.
- **Widened timeouts could mask a genuine slow-down regression.** Mitigated by
  keeping local budgets strict and only widening the deployed/nightly budget.
- **The offline failure could be a real webkit product bug** (drain early-return
  or race). If so, the fix touches `src/game/main.mjs` / `pending-scores.mjs`
  (allowed) — never the external engine.
- **Open question:** should the nightly target a **pinned preview/build** instead
  of live prod to remove deploy-timing variance? Out of scope; capture as a
  follow-up CS if repro implicates asset/deploy timing.
- **Open question:** is `navigator.onLine` reliable in headless webkit CI? To be
  answered by the repro deliverable.

## Plan review

| Round | Reviewer model | Plan author model(s) | Reviewer agent | Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200 chars) |
|---|---|---|---|---|---|---|---|
| R1 | gpt-5.5 | claude-opus-4.8 | rubber-duck | 9e903f046506 | 2026-07-02T05:35:36Z | Go-with-amendments | Go (0 blockers); all 4 amendments applied: broadened root-cause beyond 5s polls, bounded repro, qualified retry rationale, specified report-parsing mechanics; facts verified vs repo. |

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| (populated at claim time per § Claim) | planned | — | — |

## Notes / Learnings

- Source: issue #111 (`e2e-nightly-fail`), runs 28365058247 (2026-06-29,
  `score.spec.mjs:152`) and 28507543218 (2026-07-01, `offline.spec.mjs:53`).
- Related: LRN-028 (deploy reliability + e2e-floor), and the standing note that
  the `coverage`/nightly retries:0/1 paths surface timing-flaky specs that
  `e2e-local` (retries:1) passes on retry.
- CS numbering: skipped CS16 (= agent-harness bootstrap CS for this repo) and
  CS19 (= REVIEWS.md "migration" HIGH-RISK reserved slot) to avoid cross-doc
  collision.

## Plan-vs-implementation review

> _(filled at close-out per the gate)_

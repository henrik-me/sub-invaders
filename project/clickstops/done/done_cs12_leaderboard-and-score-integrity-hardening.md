# CS12 — Leaderboard & score-integrity hardening

**Status:** active
**Owner:** yoga-si
**Branch:** cs12/content
**Started:** 2026-06-04T03:02Z
**Closed:** —
**Depends on:** CS03 (Backend Function project + persistent leaderboard), CS04 (Daily challenge + v1 ship)

## Goal

Close the correctness, abuse-resistance, and operational-hygiene gaps that Copilot
review surfaced against the CS03/CS04 backend (open issues
[#67](https://github.com/henrik-me/sub-invaders/issues/67),
[#69](https://github.com/henrik-me/sub-invaders/issues/69),
[#70](https://github.com/henrik-me/sub-invaders/issues/70),
[#49](https://github.com/henrik-me/sub-invaders/issues/49),
[#51](https://github.com/henrik-me/sub-invaders/issues/51)). After CS12 closes:

- Daily-leaderboard `date` / `utcDate` parameters are validated as **real calendar
  dates** on both the client (`src/game/api.mjs`) and the backend
  (`api/Storage/ILeaderboardRepository.cs`), so `2026-02-30` / `2026-99-99` are
  rejected and can never route into a `daily-YYYY-MM-DD` partition.
- The `/api/score` per-second plausibility cap is **daily-aware**, so a legitimate
  high-skill boss-rush daily run is no longer silently rejected as
  `implausible_score`.
- `/api/score` enforces a **server wall-clock** bound against the stored session
  `StartedAt`, and the per-second cap is applied to an **effective scoring duration
  that can never exceed real server-elapsed time** (`min(finishedAt - startedAt,
  serverNow - startedAt)`), closing the bypass where today a client can submit
  immediately after `POST /api/session` with a forged `finishedAt = startedAt + 600s`
  and have the cap trust that fabricated 600s of gameplay.
- Daily leaderboard partitions have an **enforced retention window** so they do not
  accumulate indefinitely.
- The hourly `POST /api/admin/sessions-cleanup` endpoint has an **external scheduler**
  so TTL-expired sessions (and now stale daily partitions) are actually reaped on a
  cadence.

## Background

By CS12 claim, CS03 has shipped the persistent leaderboard with C16-12 replay
protection (server-issued session token, `[10s,600s]` plausibility window, per-IP
rate limit) and CS04 has closed v1 with the daily challenge behind the
`FEATURE_FLAGS_DAILY_CHALLENGE` flag (off by default in production — see
`api/HealthFunction.cs:37-45`). Every item in this CS was filed as a Copilot-review
follow-up on PR #66 (CS04 content) or PR #47 (CS03 content) and explicitly deferred
as non-v1-blocking.

**Grounding (verified against `main` at CS12 authoring):**

| Area | Current code | Reference |
|---|---|---|
| Score cap | `_maxScorePerSecond` (default 50, env `MAX_SCORE_PER_SECOND`); rejects `implausible_score` when `score > floor(elapsed * cap)` | `api/ScoreFunction.cs:111-115`, `api/Program.cs:23` |
| Duration window | `MinGameSeconds=10`, `MaxGameSeconds=600`; validates `finishedAt - session.StartedAt`; **no `DateTimeOffset.UtcNow` used** | `api/ScoreFunction.cs:16-17,105-109` |
| Daily branch | `period=="daily"` writes `partitionKey = LeaderboardPartitions.DailyPartition(utcDate)` | `api/ScoreFunction.cs:71-93`, `api/Storage/ILeaderboardRepository.cs:24-31` |
| `IsUtcDate` | regex `^\d{4}-\d{2}-\d{2}$` only (no calendar check) | `api/Storage/ILeaderboardRepository.cs:24-29` |
| Trim | all-time partition only, `LeaderboardCap=10_000`; no daily retention | `api/SessionsCleanupFunction.cs:14-15,45-47`, `api/Storage/LeaderboardRepository.cs:52-78` |
| Cleanup endpoint | `POST /api/admin/sessions-cleanup` (route attribute `admin/sessions-cleanup`), `AuthorizationLevel.Function`; `SessionTtl = 24h` (HTTP trigger per LRN-020) | `api/SessionsCleanupFunction.cs:14-15,31-40` |
| Client date check | regex-only in `submitScore` and `getLeaderboard` | `src/game/api.mjs:104-108,123-128` |
| Producer date check | already calendar-validates via `Date.UTC` round-trip | `src/game/scenes/daily.mjs:25-34,45-60` |

> **Note — issue corrections:** issues #69/#51 say `SessionTtlHours = 1`; the shipped
> constant is `SessionTtl = TimeSpan.FromHours(24)`. Issue #70 Option C references
> `SUB_INVADERS_MAX_SCORE_PER_SECOND`; the shipped env var is `MAX_SCORE_PER_SECOND`.
> Use the shipped names.

## Decisions (SI-CS12-specific)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| CS12-1 | Calendar-date validation (#67) | Extract `isValidUtcDate(date)` (JS, `Date.UTC` round-trip mirroring `daily.mjs`) and use in `getLeaderboard` + `submitScore`; strengthen C# `IsUtcDate` to require a real date via `DateOnly.TryParseExact(date, "yyyy-MM-dd", …, DateTimeStyles.None)` after the shape regex. | Single helper per side; backend stays the authority; mirrors the already-correct producer logic. |
| CS12-2 | Daily-aware score cap (#70) | **Option A.** Keep the fixed cap for all-time. For `period=daily`, allow `score ≤ floor(elapsed * cap * dailyMultiplierCap)` where `dailyMultiplierCap` is a config int (env `DAILY_SCORE_MULTIPLIER_CAP`, default `4`). | Covers boss-rush ×2 + other modifiers with margin; no need for the server to reproduce the daily seed→modifier resolution (Option B); tunable without code change. |
| CS12-3 | Server-clock bound (#49) | Capture `serverNow = DateTimeOffset.UtcNow` early in `Submit`. (a) **Reject** `400 stale_or_early_submission` when `(serverNow - session.StartedAt) < MinGameSeconds` or `> MaxSubmitSeconds`. (b) **Bind scoring duration to server time:** compute `effectiveElapsed = min(finishedAt - session.StartedAt, serverNow - session.StartedAt)` and apply the per-second cap to `effectiveElapsed`, so a forged `finishedAt` can never inflate the allowance. Reuse `MinGameSeconds=10`; add `MaxSubmitSeconds=900` (15min). Keep the existing `finishedAt - StartedAt ∈ [10s,600s]` payload-shape check as `invalid_duration`. | Closes the synthesised-`finishedAt` bypass at its root (the cap input), not just the submit timing. The two windows are distinct and intentional: `MaxGameSeconds=600` bounds *claimed gameplay length*; `MaxSubmitSeconds=900` bounds *wall-clock submission age* (network/retry grace). Neither is used as the scoring duration — that is always `effectiveElapsed`. |
| CS12-4 | Daily retention (#69) | **Option A.** Extend the existing cleanup path: delete all rows in `daily-YYYY-MM-DD` partitions whose date is older than `DAILY_LEADERBOARD_RETENTION_DAYS` (env, default `30`). | Reuses the one already-scheduled cleanup pass; bounded storage; no new function surface. |
| CS12-5 | External scheduler (#51) | **Option A.** Add `.github/workflows/sessions-cleanup.yml` (GitHub Actions cron `5 * * * *` + `workflow_dispatch`) that `POST`s the cleanup endpoint with `x-functions-key` from secret `SUB_INVADERS_FUNCTION_KEY`. | Lowest cost/complexity; no extra Azure infra. Secret provisioning is a documented manual step. |
| CS12-6 | Scope boundary | No change to the C16-12 contract shape (session token, replay 409, rate limit) beyond the new server-clock bound. No new public API routes. Daily challenge stays flag-gated. | Keeps the blast radius to validation + cleanup; no client protocol change except seed/probe timing. |

## Deliverables

1. **`src/game/api.mjs`** — add `isValidUtcDate(date)` helper (calendar round-trip); call it in `submitScore` (line ~104-108) and `getLeaderboard` (line ~123-128) **in addition to** the shape regex; reject before any network call with a clear error.
2. **`src/game/api.test.mjs`** — cases rejecting `2026-02-30`, `2026-99-99`, `0000-00-00`, `2026-13-01`, `2026-00-10`; accept a real leap day (`2024-02-29`) and a normal date; assert no `fetch` happens on rejection.
3. **`api/Storage/ILeaderboardRepository.cs`** — strengthen `IsUtcDate` to require a real calendar date (shape regex → `DateOnly.TryParseExact`). Keep the method name/signature.
4. **`api/Sub-invaders.Api.Tests/`** — extend `LeaderboardFunctionTests.cs` (and/or `EntitiesTests.cs`) with `IsUtcDate`/route cases rejecting impossible dates and accepting `2024-02-29`.
5. **`api/ScoreFunction.cs`** — (a) daily-aware cap per CS12-2; (b) server-clock bound per CS12-3: `serverNow` capture, the `[MinGameSeconds, MaxSubmitSeconds]` submit-age rejection, **and** computing `effectiveElapsed = min(finishedAt - StartedAt, serverNow - StartedAt)` as the cap input (the cap is applied to `effectiveElapsed`, never to the raw payload duration). Preserve existing `invalid_duration` (payload `[10s,600s]` shape) / `implausible_score` / replay behavior.
6. **`api/Program.cs`** — read `DAILY_SCORE_MULTIPLIER_CAP` (default 4) and `DAILY_LEADERBOARD_RETENTION_DAYS` (default 30) via the existing `ParsePositiveInt(Environment.GetEnvironmentVariable(...))` convention; thread into options.
7. **`api/Sub-invaders.Api.Tests/ScoreFunctionTests.cs`** — regression tests (injectable clock, see CS12-Risk R1): (a) boss-rush daily run that exceeds the all-time cap but passes the daily cap is **accepted**; (b) a daily score above the daily cap is **rejected**; (c) server-clock early-submit (`serverNow - StartedAt < 10s`) rejected; (d) abandoned-session submit (`serverNow - StartedAt > 900s`) rejected; (e) **forged-duration**: session started ~10s ago (server clock), payload `finishedAt = StartedAt + 600s` with a score that only passes under a 600s allowance — must be **rejected** as `implausible_score` because `effectiveElapsed` is clamped to ~10s; (f) daily-cap boundary triple: exactly `floor(effectiveElapsed × cap × multiplier)` accepted, one above rejected, `effectiveElapsed < MinGameSeconds` rejected before cap logic; (g) boundary at `MinGameSeconds`.
8. **`api/SessionsCleanupFunction.cs`** + **`api/Storage/LeaderboardRepository.cs`** + **`api/Storage/ILeaderboardRepository.cs`** — add a daily-retention pass (`DeleteDailyPartitionsOlderThanAsync(retentionDays, utcNow)` or equivalent) invoked alongside the existing TTL + all-time trim; surface a count in the cleanup response.
9. **`api/Sub-invaders.Api.Tests/SessionsCleanupFunctionTests.cs`** + **`LeaderboardRepositoryPartitionTests.cs`** — retention tests: a `daily-<old>` partition row is deleted, a `daily-<recent>` row and the all-time partition are untouched; boundary at exactly `retentionDays`.
10. **`seeds/002_cs03-leaderboard-smoke.seed.mjs`** + **`scripts/verify-deploy.checks.mjs`** — insert a `≥ MinGameSeconds` wait between the `POST /api/session` and `POST /api/score` steps so the new server-clock lower bound is satisfied. Keep the probe deterministic.
11. **`.github/workflows/sessions-cleanup.yml`** — GitHub Actions cron `5 * * * *` + `workflow_dispatch`, `permissions: {}`, pinned `runs-on`, `curl --fail-with-body` POST to `/api/admin/sessions-cleanup` with `x-functions-key: ${{ secrets.SUB_INVADERS_FUNCTION_KEY }}` against the prod host. The job must no-op gracefully (clear log, non-failing) if the secret is unset, so forks/dependabot don't red-X.
12. **`CHANGELOG.md`** — SI-CS12 entry; move the #49 server-clock item from "Known limitations (SI-CS03)" to "Fixed in SI-CS12".
13. **`ARCHITECTURE.md`** (and the `operations.project-deploy` local block in `OPERATIONS.md` if operationally relevant) — document the daily retention window, the external scheduler, and the **manual step: add repo Actions secret `SUB_INVADERS_FUNCTION_KEY`** (rotate periodically).

## Sub-agent fan-out

The CS12 orchestrator must use the standard agent-harness sub-agent dispatch pattern
(<https://github.com/henrik-me/agent-harness/blob/main/OPERATIONS.md#sub-agent-dispatch>):
paste the mandatory preamble, declare disjoint write ownership, list exact required
reading (the grounding table above + each owned file's current shape), and require the
structured report shape including LEARNINGS CANDIDATES. Lanes are split so that two
agents never write the same file.

| # | Sub-agent | Owned files | Notes / coordination |
|---|---|---|---|
| 1 | `cs12-date-validation` | `src/game/api.mjs`, `src/game/api.test.mjs`, `api/Storage/ILeaderboardRepository.cs`, the date-validation cases in `api/Sub-invaders.Api.Tests/LeaderboardFunctionTests.cs` | #67. Mirror `daily.mjs` calendar logic. Coordinate with #2 — both touch `api/Sub-invaders.Api.Tests` (split by test method, not file, or #2 owns `ScoreFunctionTests.cs` exclusively). |
| 2 | `cs12-score-integrity` | `api/ScoreFunction.cs`, `api/Program.cs`, `api/Sub-invaders.Api.Tests/ScoreFunctionTests.cs` | #70 + #49. Owns the cap + server-clock change and an injectable clock. |
| 3 | `cs12-retention` | `api/SessionsCleanupFunction.cs`, `api/Storage/LeaderboardRepository.cs`, `api/Storage/ILeaderboardRepository.cs` (retention method only — coordinate with #1 on `IsUtcDate`), `api/Sub-invaders.Api.Tests/SessionsCleanupFunctionTests.cs`, `api/Sub-invaders.Api.Tests/LeaderboardRepositoryPartitionTests.cs` | #69. **`ILeaderboardRepository.cs` is shared with #1** — assign the whole file to #3 and have #1 hand its `IsUtcDate` diff to #3, OR sequence #1 before #3. Orchestrator resolves the overlap at dispatch. |
| 4 | `cs12-probe-and-schedule` | `seeds/002_cs03-leaderboard-smoke.seed.mjs`, `scripts/verify-deploy.checks.mjs`, `.github/workflows/sessions-cleanup.yml` | #51 + the seed/probe wait for #49. Coordinate with #2 on `MinGameSeconds`. |
| 5 | `cs12-docs` | `CHANGELOG.md`, `ARCHITECTURE.md`, `OPERATIONS.md` (`operations.project-deploy` local block only) | Document retention + scheduler + required secret. |
| (orchestrator-owned) | — | Active CS file population, WORKBOARD rows, `ILeaderboardRepository.cs` overlap arbitration, plan-vs-implementation review, close-out | — |

## Exit criteria

1. `submitScore` / `getLeaderboard` and backend `IsUtcDate` reject impossible calendar dates (`2026-02-30`, `2026-99-99`, `0000-00-00`) and accept real ones (incl. `2024-02-29`). Client rejects before issuing `fetch`.
2. A boss-rush daily run that exceeds the all-time per-second cap but is within `cap × DAILY_SCORE_MULTIPLIER_CAP` is **accepted**; a daily score above the daily cap is **rejected** with `implausible_score`. Regression test reproduces the pre-fix rejection.
3. `/api/score` rejects an early submit (`serverNow - StartedAt < 10s`) and an abandoned submit (`serverNow - StartedAt > 900s`) with a clear error. A forged `finishedAt = StartedAt + 600s` submitted after only ~10s of real server time is rejected as `implausible_score` (scoring allowance is clamped to `effectiveElapsed`), independent of the client-supplied `finishedAt`.
4. Daily partitions older than `DAILY_LEADERBOARD_RETENTION_DAYS` are deleted by the cleanup pass; recent daily rows and the all-time partition are untouched.
5. `.github/workflows/sessions-cleanup.yml` exists, runs on cron + dispatch, and no-ops cleanly when `SUB_INVADERS_FUNCTION_KEY` is absent. The required-secret manual step is documented.
6. Seed + verify-deploy probe wait `≥ MinGameSeconds` and still pass against a live deploy.
7. `dotnet test api/`, `npm run test:unit`, `harness lint`, and `harness sync --mode=check` are all green; coverage gates hold.
8. Plan-vs-implementation review records `GO`; close-out docs/restart-state and learnings/follow-ups complete. Issues #67/#69/#70/#49/#51 are referenced for closure in the content PR.

## Risks + open questions

1. **R1 — Server clock injectability.** `ScoreFunction` currently reads no clock. Introducing `DateTimeOffset.UtcNow` directly makes the new bound untestable deterministically. Inject an `IClock`/`Func<DateTimeOffset>` (default `() => DateTimeOffset.UtcNow`) via options so tests can pin `serverNow`. Keep production wiring a one-liner in `Program.cs`.
2. **R2 — Daily cap factor tuning + breadth.** `DAILY_SCORE_MULTIPLIER_CAP = 4` is an estimate (boss-rush ×2 plus headroom). Option A applies the relaxed envelope to **every** daily partition regardless of that day's actual modifier (a non-boss-rush daily gets the same wider cap). This is an accepted integrity trade-off chosen to avoid server-side seed→modifier reconstruction (Option B); document it. If real daily runs still trip the cap, raise the env var — no code change.
3. **R3 — Retention vs. read correctness.** Deleting old daily partitions must never touch the all-time partition or a still-current daily date. Filter strictly on the `daily-` prefix and parse the date suffix with the same calendar validator from CS12-1; skip any partition whose suffix doesn't parse. Retention boundary tests must target the deterministic repository method (`DeleteDailyPartitionsOlderThanAsync(retentionDays, fixedUtcNow)`) — `SessionsCleanupFunction` reads `DateTimeOffset.UtcNow` directly, so keep exact-boundary assertions off the function level (or inject the same clock there) to avoid flakiness.
4. **R4 — Scheduler secret + fork safety.** The workflow must not fail on PRs from forks/dependabot (no secret access). Guard the POST step behind a secret-presence check and exit 0 with a skip log when absent (mirror `skip_deploy_on_missing_secrets` precedent).
5. **R5 — Seed/probe slowdown.** Adding a `≥10s` wait lengthens `verify-deploy` and the smoke seed. Acceptable; keep it a single explicit wait, not a poll loop, and note it in the probe output.
6. **R6 — Feature-flag interaction.** Daily challenge is off by default in prod, so daily-path changes (#67 daily route, #70 daily cap, #69 retention) have zero production traffic today. **All** daily-path backend tests (date validation, daily cap, retention) MUST set `FEATURE_FLAGS_DAILY_CHALLENGE=on` via `EnvironmentVariableScope` and exercise the daily path directly rather than relying on prod behavior.
7. **R7 — `ILeaderboardRepository.cs` write overlap.** Lanes #1 (`IsUtcDate`) and #3 (retention method) both edit this file. Orchestrator must serialize or assign the whole file to one lane to avoid a merge clobber (see fan-out table).
8. **R8 — New env-var defaults/fallbacks.** Add coverage that `DAILY_SCORE_MULTIPLIER_CAP` defaults to `4` and `DAILY_LEADERBOARD_RETENTION_DAYS` to `30`, and that invalid/non-positive values fall back via `ParsePositiveInt` (mirror existing `MAX_SCORE_PER_SECOND` parsing tests if present).

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| Calendar-date validation (client + backend) | done | orchestrator | #67 implemented in JS + backend; impossible dates rejected, leap day accepted. |
| Daily-aware score cap | done | orchestrator | #70 implemented with default multiplier 4 and env fallback tests. |
| Server-clock bound on `/api/score` | done | orchestrator | #49 implemented with injectable `UtcNow`, 10–900s submit age, effectiveElapsed clamp. |
| Daily-partition retention pass | done | orchestrator | #69 implemented in repository + cleanup response; boundary tested. |
| Seed/probe wait + cleanup cron workflow | done | orchestrator | #51 workflow added; seed/probe wait 10.1s and log it. |
| Docs: CHANGELOG/ARCHITECTURE/OPERATIONS + required-secret step | done | orchestrator | Docs updated; #49 limitation moved to SI-CS12 fixed entry. |
| `ILeaderboardRepository.cs` overlap arbitration | done | orchestrator | Serialized in one edit: `IsUtcDate` + retention helper/method landed together. |
| Plan-vs-implementation review (GO) | planned | orchestrator | Deferred to close-out after content PR merge per OPERATIONS close-out gate. |
| Close-out docs + restart state | planned | orchestrator | Update WORKBOARD/CONTEXT/active CS notes and relevant docs before close-out; reference #67/#69/#70/#49/#51. |
| Close-out learnings + follow-ups | planned | orchestrator | File or disposition learnings and planned follow-ups if needed. |

## Notes / Learnings

- `DAILY_SCORE_MULTIPLIER_CAP` shipped with default `4`, matching CS12-2. Tests cover a daily score above the all-time cap but below `cap × 4`, exact cap boundary, and one-above rejection.
- `DAILY_LEADERBOARD_RETENTION_DAYS` shipped with default `30`, matching CS12-4. Repository-level tests pin `utcNow` and prove old daily partitions delete while exact-boundary, recent daily, and all-time rows remain.
- `.github/workflows/sessions-cleanup.yml` checks `SUB_INVADERS_FUNCTION_KEY` before invoking curl; missing secret logs a clear skip and exits 0 for fork/Dependabot safety.
- Implementation was serialized by the orchestrator to avoid the `ILeaderboardRepository.cs` lane overlap called out in R7.

## Plan review

| Round | Reviewer model | Plan author model(s) | Reviewer agent | Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200 chars) |
|---|---|---|---|---|---|---|---|
| R1 | gpt-5.5 | claude-opus-4.8 | rubber-duck (orchestrator: yoga-si) | 7361af98e9a0 | 2026-06-04T02:34:10Z | Go-with-amendments | Blocking fix: CS12-3 cap now on effectiveElapsed=min(finishedAt,serverNow) minus start, closing forged-duration bypass; two windows made explicit; daily-cap + retention-clock + flag-on tests added. |

## Plan-vs-implementation review

> _(filled at close-out per the gate)_

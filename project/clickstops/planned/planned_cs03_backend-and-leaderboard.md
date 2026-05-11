# CS03 — Backend Function project + persistent leaderboard

**Status:** planned
**Owner:** —
**Branch:** —
**Started:** —
**Closed:** —
**Depends on:** CS01 (Repo hardening + first SWA staging deploy), CS02 (Engine + game skeleton + minimal playable game)

## Goal

CS03 completes Sub Invaders' first persistent backend: Azure Functions in the .NET 8 isolated worker model, hosted as SWA-managed Functions at `/api/*`, with Azure Storage Tables as the persistence layer. The backend implements the full C16-12 contract from agent-harness: `POST /api/session` issues a server-side play session, `POST /api/score` consumes exactly one valid session after applying replay-protection and plausibility checks, and `GET /api/leaderboard` returns the persistent all-time top scores.

The security scope is intentionally simple but complete for v1. Session tokens are server-generated UUIDs persisted in the `Sessions` table with a random nonce and `startedAt`; submissions are accepted only when the session exists, has not been consumed, is within the 10-600 second duration window, and the score is plausible against elapsed time. Both session minting and score submission are rate-limited per IP at 30 requests/minute by in-process sliding-window middleware. Request bodies are bounded to 1 KB, strict JSON is required for score submissions, and extra fields are rejected with HTTP 400.

CS03 also wires the playable frontend from CS02 to the backend. `../../../src/game/api.mjs` starts a session when a run begins, submits the score at game over, retrieves the all-time leaderboard, and surfaces errors in the game-over flow. `../../../src/game/scenes/leaderboard.mjs` renders the top entries in canvas, not a DOM table, so the feature exercises the engine renderer. After CS03 closes, the leaderboard persists across plays, browsers, and players in staging.

## Background

By CS03 claim, CS01 has hardened the repository, created the first SWA staging deployment, provisioned the dedicated Azure resource group (`rg-sub-invaders-prod`) and Storage Account, and left the Function project scaffold under `../../../api/`. CS02 has delivered a minimal playable canvas game with localStorage-only high score and no network persistence.

CS03 is the first clickstop that turns the backend scaffold into production code. It should verify the CS01 scaffold (`Sub-invaders.Api.csproj`, `Program.cs`, `host.json`, `local.settings.json.example`) rather than replacing it blindly, then fill in Functions, models, storage helpers, tests, and smoke probes. The Storage Account from CS01's G4 gate is expected to exist but the `Sessions` and `Leaderboard` tables may be empty or absent until CS03 provisioning runs.

The authoritative upstream design source is agent-harness CS16 decision C16-12, recorded at https://github.com/henrik-me/agent-harness/blob/main/project/clickstops/active/active_cs16_bootstrap-sub-invaders/active_cs16_bootstrap-sub-invaders.md. Do not relax that replay-protection contract during implementation.

## Decisions (SI-CS03-specific)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| CS03-1 | Backend hosting | Carry forward C16-9: Azure Functions, .NET 8 isolated worker, SWA-managed Functions, route `/api/*` | Aligns with the CS16 user directive and keeps deploy topology in one SWA pipeline. |
| CS03-2 | Function layout | Carry forward C16-15: Function code lives at `../../../api/` with `host.json`, `local.settings.json.example`, `Sub-invaders.Api.csproj`, `net8.0`, `<AzureFunctionsVersion>v4</AzureFunctionsVersion>`, and `<OutputType>Exe</OutputType>` | SWA convention and isolated worker requirements. |
| CS03-3 | CI matrix | Carry forward C16-16: Node 20 + .NET 8 SDK; `harness lint --quiet`, `harness sync --mode=check`, `node --test src/**/*.test.mjs`, `dotnet test api/` | CS03 must keep both frontend and Function checks green. |
| CS03-4 | Replay protection | Carry forward C16-12 verbatim in implementation: server-issued session token persisted in Storage Tables; score accepted only after existence, not-consumed, elapsed-time, plausible-score, and per-IP-rate-limit checks pass | This is the authoritative anti-abuse contract for v1. |
| CS03-5 | Dedicated Azure resource group | Carry forward C16-14: Storage Account remains inside `rg-sub-invaders-prod`; no Sub Invaders resource is provisioned outside the dedicated RG | Preserves one-command teardown and spend isolation. |
| CS03-6 | Storage tables | `Sessions` and `Leaderboard` | Names are short, explicit, and match the C16-12 domain model. |
| CS03-7 | `Sessions` keys | `PartitionKey = yyyyMMdd` UTC date, `RowKey = sessionId` | Date partition supports cleanup scans without over-designing v1. |
| CS03-8 | `Leaderboard` keys | `PartitionKey = "all"`, `RowKey = <invertedScore>_<submissionUuid>`; `invertedScore = (99999999 - score).ToString("D8")` | Azure Tables sort RowKey ascending; inverted score yields top-down reads. UUID suffix prevents collisions. |
| CS03-9 | Rate limits | Default 30/min/IP for `/api/session` and 30/min/IP for `/api/score`, configurable by app setting | Matches C16-12 and bounds both token minting and submission costs. |
| CS03-10 | Cleanup cadence | Timer trigger NCRONTAB `0 0 * * * *` hourly | Matches C16-12 and is frequent enough for 24h session expiry. |
| CS03-11 | Expiry and cap | Sessions expire after 24h; leaderboard capped to top 10,000 rows | Azure Storage Tables have no native TTL; cleanup Function is required. |
| CS03-12 | Daily period | `GET /api/leaderboard?period=daily` returns 501 Not Implemented in CS03 | Daily partitioning is explicitly deferred to CS04. |
| CS03-13 | Score-rate constant | `MAX_SCORE_PER_SECOND = 50` default, configurable by app setting only if the implementation keeps the default visible in tests | Conservative upper bound for classic scoring while allowing normal play. |

## Deliverables

1. **Function project completion** at `../../../api/` — verify CS01 left the scaffold intact, then fill in real implementations without changing the SWA/.NET 8 isolated shape. Keep `local.settings.json` untracked; update only `local.settings.json.example` if new non-secret settings must be documented.
2. **`../../../api/HealthFunction.cs`** — extend the CS01 health endpoint so it still returns `{"status":"ok"}` and also includes `{"version":"<assembly-version>","commit":"<short-sha>"}`. The commit value is injected at deploy by an environment variable such as `GITHUB_SHA` or `SUB_INVADERS_COMMIT`; local fallback may be `unknown`.
3. **`../../../api/SessionFunction.cs`** — implement `POST /api/session`. It returns `{sessionId, nonce, startedAt}`, persists a row to `Sessions` (`PartitionKey=yyyyMMdd`, `RowKey=sessionId`), ignores any request body, and applies the C16-12 per-IP rate limit before minting a token. The nonce is random 16 bytes encoded for JSON transport.
4. **`../../../api/ScoreFunction.cs`** — implement `POST /api/score` with body `{sessionId, score, finishedAt}`. Enforce all C16-12 checks: (a) `sessionId` exists in `Sessions`; (b) it has not previously been consumed; (c) `finishedAt - startedAt` is between `MIN_GAME_SECONDS=10` and `MAX_GAME_SECONDS=600`; (d) `score <= elapsedSeconds * MAX_SCORE_PER_SECOND` with default `MAX_SCORE_PER_SECOND=50`; (e) per-IP rate limit. Bound the request body to ≤1 KB, accept only `sessionId`, `score`, and `finishedAt`, reject extra fields with 400, reject invalid UUID/int/date values with 400, mark the session consumed atomically/idempotently, and write the accepted score to `Leaderboard` using the RowKey format in CS03-8.
5. **`../../../api/LeaderboardFunction.cs`** — implement `GET /api/leaderboard?period=all|daily`. For `period=all` or omitted, return the top 100 rows from `Leaderboard` partition `all` as `[{rank, score, finishedAt}]` sorted descending by score. For `period=daily`, return HTTP 501 with a clear JSON error because CS04 owns daily partitioning. Unknown periods return 400.
6. **`../../../api/SessionsCleanupFunction.cs`** — implement a timer-triggered Function using `0 0 * * * *`. Pass one deletes `Sessions` rows with `startedAt < UtcNow - 24h`. Pass two trims `Leaderboard` to the first 10,000 rows by RowKey ordering and deletes the tail. The implementation must not rely on Azure Tables `_ts`; `_ts` does not expire rows.
7. **Rate-limit middleware** — implement in-process, per-IP, sliding-window rate limiting with a 1-minute window and configurable cap defaulting to 30. Use a simple `ConcurrentDictionary<string, Queue<DateTimeOffset>>` and lock around each queue's dequeue/enqueue. Apply to both `/api/session` and `/api/score` before expensive body parsing or Storage calls. It is not distributed in v1.
8. **xUnit tests** at `../../../api/Sub-invaders.Api.Tests/` with at least 15 tests and `dotnet test api/` exiting 0:
   - `SessionFunctionTests.cs` — POST returns valid `sessionId`; row persists; rate limit returns 429 after 30 calls in 1 minute.
   - `ScoreFunctionTests.cs` — happy path; replay rejected; expired session rejected; implausible score rejected; extra-field payload rejected; rate limit returns 429.
   - `LeaderboardFunctionTests.cs` — top 100 sorted descending; `period=daily` returns 501; 100-row partition test confirms rank assignment.
   - `SessionsCleanupFunctionTests.cs` — old sessions are swept; oversize leaderboard trims to 10,000/top rows.
   - `RateLimitMiddlewareTests.cs` — sliding-window expiration and concurrent-access safety.
9. **Frontend API client** at `../../../src/game/api.mjs` — export `startSession()`, `submitScore({score, finishedAt})`, and `getLeaderboard({period})`. Use browser `fetch()` only, no runtime dependencies. Normalize backend errors into predictable Error objects/messages for game scenes.
10. **Frontend leaderboard scene** at `../../../src/game/scenes/leaderboard.mjs` — render top 10 entries in canvas through the engine renderer. The scene is shown after game over. Do not add a DOM table. If integrating requires editing `gameover.mjs`, coordinate file ownership before dispatch because CS02 may own that file; an alternative is registering the leaderboard scene from `main.mjs` if ownership is cleaner.
11. **Storage Tables provisioning** — extend `../../../infra/provision.sh` so it idempotently creates `Sessions` and `Leaderboard` in the CS01 Storage Account using `az storage table create --if-not-exists`. Preserve the dedicated RG invariant from C16-14 and avoid hard-coded account keys in source.
12. **`../../../CHANGELOG.md` updated** with a SI-CS03 entry summarizing backend Functions, persistent leaderboard, replay protection, and staging smoke coverage.
13. **Verify-deploy probe** — extend the `verify-deploy` scaffold's smoke probe to run the full sequence against staging: `POST /api/session`, wait or inject a test-safe valid `finishedAt`, `POST /api/score` with a plausible score, `GET /api/leaderboard`, and assert the submitted or seeded score appears in the top 10.
14. **Container-validate scaffold** — exercise `container-validate` against the Function project locally before deploy. It should start Functions with `func start` (or the scaffold's standard wrapper), hit `/api/health`, then run the same session/score/leaderboard smoke against local Functions where feasible.
15. **Seed scaffold** — exercise `seed` after staging deploy by seeding `Leaderboard` Storage Tables with smoke-test data. Keep seed data deterministic, small, and non-secret. CS03 is the first clickstop that validates this scaffold in sub-invaders.
16. **`../../../ARCHITECTURE.md` updated** with the actually implemented schema: table names, keys, columns, replay-protection flow, rate-limit caveats, cleanup behavior, cold-start note, CORS assumption, and upgrade path.

## Sub-agent fan-out

The CS03 orchestrator must use the standard agent-harness sub-agent dispatch pattern from https://github.com/henrik-me/agent-harness/blob/main/OPERATIONS.md#sub-agent-dispatch. Each prompt must paste the mandatory preamble, declare disjoint write ownership, list exact required reading, and require the structured report shape. Maintain at least eight sub-agents; the split below gives nine plus orchestrator-owned integration/checkpoint work.

| # | Sub-agent | Owned files |
|---|---|---|
| 1 | `cs03-session-and-score-functions` | `../../../api/SessionFunction.cs`; `../../../api/ScoreFunction.cs`; `../../../api/Sub-invaders.Api.Tests/SessionFunctionTests.cs`; `../../../api/Sub-invaders.Api.Tests/ScoreFunctionTests.cs` |
| 2 | `cs03-leaderboard-function` | `../../../api/LeaderboardFunction.cs`; `../../../api/Sub-invaders.Api.Tests/LeaderboardFunctionTests.cs` |
| 3 | `cs03-cleanup-function` | `../../../api/SessionsCleanupFunction.cs`; `../../../api/Sub-invaders.Api.Tests/SessionsCleanupFunctionTests.cs` |
| 4 | `cs03-rate-limit-middleware` | `../../../api/Middleware/RateLimitMiddleware.cs`; `../../../api/Program.cs`; `../../../api/Sub-invaders.Api.Tests/RateLimitMiddlewareTests.cs` |
| 5 | `cs03-storage-models-and-helpers` | `../../../api/Models/SessionEntity.cs`; `../../../api/Models/LeaderboardEntity.cs`; `../../../api/Storage/TableClientFactory.cs`; `../../../api/Storage/TableRepository.cs` |
| 6 | `cs03-frontend-api-client` | `../../../src/game/api.mjs`; `../../../src/game/api.test.mjs` |
| 7 | `cs03-frontend-leaderboard-scene` | `../../../src/game/scenes/leaderboard.mjs`; `../../../src/game/scenes/leaderboard.test.mjs`; possible read-only access to `../../../src/game/scenes/gameover.mjs` |
| 8 | `cs03-provisioning-extension` | `../../../infra/provision.sh`; `../../../infra/seed-data.json` |
| 9 | `cs03-health-extension` | `../../../api/HealthFunction.cs`; `../../../api/Sub-invaders.Api.Tests/HealthFunctionTests.cs` |
| orchestrator-owned | — | active CS file task population; `../../../CHANGELOG.md`; `../../../ARCHITECTURE.md`; scaffold invocations for `container-validate`, `seed`, and `verify-deploy`; coordination of any cross-file integration |

Known coordination point: `gameover.mjs` may need to call the new leaderboard scene after score submission. Row 7 should read it carefully but must not edit it unless the CS03 orchestrator explicitly assigns ownership; otherwise register the leaderboard transition through an owned integration file such as `main.mjs`, or have the orchestrator make the small cross-cutting edit.

Recommended ordering:

1. Dispatch storage models/helpers and rate-limit middleware first because the Function classes depend on them.
2. Dispatch individual Function classes in parallel once helper interfaces are agreed.
3. Dispatch frontend API and leaderboard scene in parallel with backend tests using mocked `fetch()`/scene fixtures.
4. Run an orchestrator integration pass to wire app settings, active CS tasks, scaffolds, architecture, changelog, and staging probes.

## User-approval gates

None expected. CS01 cleared all infrastructure gates, including Azure subscription access, dedicated resource group provisioning, SWA creation, Storage Account creation, and deployment token configuration. If the CS03 implementation discovers missing Azure resources or missing secrets, treat that as an execution issue to document and fix through the existing CS01 provisioning scripts, not as a new user-approval gate unless real spend or a new Azure resource type is introduced.

## Exit criteria

1. `dotnet test api/` exits 0 with at least 15 xUnit tests covering session, score, leaderboard, cleanup, health, storage helpers, and rate limiting.
2. `node --test src/**/*.test.mjs` exits 0 for frontend API and canvas leaderboard scene tests.
3. `harness lint --quiet` exits 0.
4. `harness sync --mode=check` exits 0 after any scaffold or composed-file changes.
5. `container-validate` scaffold exits 0 against the local Function project and proves `/api/health` plus the session/score/leaderboard smoke path works locally or documents any local Azure Tables emulator substitution.
6. SWA staging deploy succeeds with the .NET 8 isolated Functions under `/api/*`.
7. `verify-deploy` smoke probe runs `POST /api/session` → `POST /api/score` → `GET /api/leaderboard` against staging and asserts the submitted or seeded score appears in the top 10.
8. `seed` scaffold-managed data exists in the staging `Leaderboard` table and is visible through `GET /api/leaderboard?period=all`.
9. Rate limiting demonstrably returns HTTP 429 after 30 requests within a 1-minute window for both `/api/session` and `/api/score`.
10. Replay protection demonstrably rejects a duplicate `sessionId` score submission after the first successful consume.
11. Payload validation rejects a score body over 1 KB and rejects JSON objects with fields other than `sessionId`, `score`, and `finishedAt`.
12. `GET /api/leaderboard?period=daily` returns HTTP 501 with a clear JSON error, preserving CS04 ownership of daily partitions.
13. Cleanup Function tests prove old sessions are deleted and leaderboard rows beyond the top 10,000 are trimmed; no implementation claims Azure Tables TTL support.
14. `../../../ARCHITECTURE.md` documents the actual implemented table schema, RowKey encoding, cleanup mechanism, rate-limit limitation, CORS assumption, and upgrade path.
15. `../../../CHANGELOG.md` includes a SI-CS03 entry.
16. Active CS close-out includes the plan-vs-implementation review section with reviewer/model/timestamp/outcome and no NEEDS-FIX finding.

## Risks + open questions

1. **R1 — Azure Storage Tables `_ts` does not auto-expire rows.** C16-12 is explicit: session expiry depends entirely on `SessionsCleanupFunction.cs`. Mitigation: test cleanup directly, keep the timer hourly, and make failed cleanup visible in logs.
2. **R2 — Function cold-start latency on free tier.** .NET 8 isolated Functions in SWA-managed hosting may show 1-3 second cold starts. Mitigation: document observed staging latency in `ARCHITECTURE.md`; do not block v1 unless smoke probes become unreliable.
3. **R3 — Rate limiting is in-process and per-instance.** This is acceptable for v1 single-instance/free-tier expectations but is not distributed. Mitigation: document upgrade path to Azure Cache for Redis, Storage-backed counters, or API Management if scale changes.
4. **R4 — CORS should not be an issue.** SWA serves frontend and Functions on the same hostname with `/api/*`, so browser calls are same-origin. Mitigation: document this assumption; do not add permissive wildcard CORS unless staging proves it is necessary.
5. **R5 — `Leaderboard` uses a single `PartitionKey="all"`.** This is intentional for a sub-10k v1 leaderboard even though it is an anti-pattern at scale. Mitigation: top-10k cap, RowKey ordering, and future upgrade path to daily/region partitions.
6. **R6 — Atomic consume semantics on Azure Tables require care.** The score Function must not allow two concurrent submissions to consume one session. Mitigation: use ETag/conditional update or equivalent optimistic concurrency and include a replay/concurrency test.
7. **R7 — Frontend integration may cross file ownership.** Showing leaderboard after game over could require edits in a CS02-owned file. Mitigation: orchestrator assigns a single owner for `gameover.mjs` if needed or chooses an owned registration path.
8. **R8 — Local Function validation may need Azurite or a storage abstraction.** If `container-validate` cannot reach real Azure Tables safely, use deterministic local configuration and document it in the scaffold output.

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| (populated at claim time) | planned | — | — |

## Notes / Learnings

(filled during execution)

## Plan-vs-implementation review

> _(filled at close-out per the gate)_
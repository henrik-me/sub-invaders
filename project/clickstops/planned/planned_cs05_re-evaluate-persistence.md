# CS05 — Re-evaluate persistence layer (Storage Tables → ?)

**Status:** planned
**Owner:** —
**Branch:** —
**Started:** —
**Closed:** —
**Depends on:** CS03 (Backend Function project + persistent leaderboard)

## Goal

This is a deferred re-evaluation of the v1 persistence choice for Sub Invaders. CS03 is expected to ship the persistent leaderboard and session-token replay protection on Azure Storage Tables first, then collect real staging/production signals before revisiting that decision.

This planned file is not scheduled for v1 execution. It exists as a tripwire artefact so the SI agent can keep the re-evaluation visible in the planned/queued set while avoiding premature design churn.

## Background

CS16 chose Azure Storage Tables for v1 because the leaderboard and session rows are simple key/value-style records, SWA-managed Functions can access Tables with minimal infrastructure, and the expected free/near-free cost profile matches the "lowest possible cost" goal. The design also keeps the Azure footprint inside the dedicated Sub Invaders resource group documented by CS16 C16-14.

The choice is intentionally modest: Tables do not provide rich relational queries, native TTL, or cross-table transactions. CS16 C16-12 already compensates with an hourly `SessionsCleanupFunction.cs` and a 10,000-row leaderboard trim, but those compensations become re-evaluation signals if they are exercised often.

## Trigger conditions (any one fires this re-eval)

- Leaderboard read latency P95 > 200ms over a 1-week window.
- Storage cost > $1/month sustained.
- Need for query-by-time-range or rich filters that Tables don't natively support.
- Need for transactional consistency across Sessions + Leaderboard.
- Approaching the 10k row cleanup boundary frequently (suggesting growth past v1 assumptions).

## Candidate alternatives to evaluate

- Cosmos DB serverless (NoSQL API; richer querying; per-RU pricing).
- Azure SQL serverless (relational; transactions; familiar).
- Cloudflare D1 (SQLite-on-edge; cheap; if frontend already on Cloudflare).
- PostgreSQL on Neon / Supabase (not a v1-Azure-aligned option but track).

## Evaluation framework

At claim time, estimate monthly cost at the observed traffic level and at the next two plausible growth tiers, including request/read/write units and storage. Benchmark P95 latency for `GET /api/leaderboard`, `POST /api/session`, and `POST /api/score` against representative staging data. Compare migration cost from the current Tables schema, operational complexity for the team, and lock-in implications. The output should be a short decision record, not a speculative rewrite plan unless the winning option clearly beats Tables.

## Out of scope until triggered

This CS file exists ONLY as a tripwire artefact. Do not claim until at least one trigger condition fires.

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| (populated at claim time) | planned | — | — |

## Notes / Learnings

(filled when triggered)

## Plan-vs-implementation review

> _(filled at close-out per the gate)_
# Work Board

Live coordination file for multi-agent work. Only orchestrating agents update this file.

> **Last updated:** 2026-07-01T05:10Z

## Orchestrators

Status vocabulary: `🟢 Active` (Last Seen within 24h), `🟡 Idle` (24h-7d), `⚪ Offline` (>7d). Agent-ID derivation per [TRACKING.md § Agent Identification](TRACKING.md#agent-identification).

| Agent ID | Machine | Repo Folder | Status | Last Seen |
|----------|---------|-------------|--------|-----------|
| omni-si | HENRIKM-OMNI | C:\src\sub-invaders | 🟢 Active | 2026-06-16T16:06Z |
| yoga-si | HENRIKM-YOGA | C:\src\sub-invaders | 🟢 Active | 2026-07-01T05:10Z |

## Active Work

| CS-Task ID | Title | State | Owner | Branch | Last Updated | Blocked Reason |
|------------|-------|-------|-------|--------|--------------|----------------|
| CS18 | Make the E2E suite-level coverage floor fatal | 🟢 Active | yoga-si | cs18/content | 2026-07-01T05:10Z | — |

> **Note:** Filesystem is the source of truth for queued and completed work.
> See `project/clickstops/planned/` for the queue and `project/clickstops/done/`
> for history. Do not add `## Queued` or `## Recently Completed` sections here
> (the harness linter forbids them).

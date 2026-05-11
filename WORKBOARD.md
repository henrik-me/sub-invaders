# Work Board

Live coordination file for multi-agent work. Only orchestrating agents update this file.

> **Last updated:** 2026-05-11T01:30Z

## Orchestrators

Status vocabulary: `🟢 Active` (Last Seen within 24h), `🟡 Idle` (24h-7d), `⚪ Offline` (>7d). Agent-ID derivation per [TRACKING.md § Agent Identification](TRACKING.md#agent-identification).

| Agent ID | Machine | Repo Folder | Status | Last Seen |
|----------|---------|-------------|--------|-----------|
| _(placeholder — replace with real agent)_ | _(hostname)_ | _(path)_ | ⚪ Offline | _(never)_ |

## Active Work

| CS-Task ID | Title | State | Owner | Branch | Last Updated | Blocked Reason |
|------------|-------|-------|-------|--------|--------------|----------------|
| — | no active CS — populate when claiming | — | — | — | _(set on claim)_ | _(none)_ |

## Queued

| Priority | CS | Title | Notes |
|----------|----|----|-------|
| 1 | CS01 | Repo hardening + first SWA staging deploy | Ruleset, App, security settings, governance docs, ARCHITECTURE.md, composed-blocks customisation, CI workflows, Azure provisioning (RG `rg-sub-invaders-prod`), G3+G4+G5 user gates. ≥6 sub-agent fan-out. |
| 2 | CS02 | Engine + game skeleton + minimal playable Sub Invaders | Custom in-tree engine at `src/engine/`, game at `src/game/`, hand-authored sprite sheet, localStorage high-score, deploy to staging. ≥8 sub-agent fan-out. Depends on CS01. |
| 3 | CS03 | Backend Function project + persistent leaderboard | .NET 8 isolated Functions, C16-12 replay protection (session token + plausibility + rate limit), Storage Tables persistence, hourly cleanup, leaderboard scene in canvas. ≥8 sub-agent fan-out. Depends on CS01, CS02. |
| 4 | CS04 | Daily challenge + harness pin-bump + whale-shark + v1 polish | First exercise of `harness sync --mode=apply` from a real consumer (task #1, orchestrator-owned). Then 5 daily modifiers, daily-challenge scene, whale-shark, feature-flags + health-check scaffolds wired up. v1 declared shipped at close. ≥7 sub-agent fan-out. Depends on CS01, CS02, CS03. |
| defer | CS05 | Re-evaluate persistence (Storage Tables → ?) | Tripwire skeleton; do not claim until trigger condition fires (latency / cost / query-shape signals). |
| defer | CS06 | Re-evaluate full-stack hosting (SWA → Cloudflare?) | Tripwire skeleton; do not claim until trigger condition fires (cost > $5/mo, cold-start P95 > 2s, etc.). |

## Recently Completed

| CS | Title | Closed | Notes |
|----|-------|--------|-------|
| _(bootstrap)_ | Initial harness init via agent-harness CS16 | 2026-05-11 | Repo created, harness pinned at `v0.2.0`, scaffolds: feature-flags, verify-deploy, container-validate, seed, health-check. See https://github.com/henrik-me/agent-harness PR for the bootstrap audit trail. |

> **Note:** Clickstop files live under lifecycle subdirectories: `project/clickstops/planned/` (queued), `project/clickstops/active/` (in flight), `project/clickstops/done/` (completed).
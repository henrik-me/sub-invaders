# CS06 — Re-evaluate full-stack hosting (SWA + Functions → Cloudflare Workers + Pages + R2)

**Status:** planned
**Owner:** —
**Branch:** —
**Started:** —
**Closed:** —
**Depends on:** CS01 (Repo hardening + first SWA staging deploy), CS03 (Backend Function project + persistent leaderboard)

## Goal

This is a tripwire-triggered re-evaluation of the v1 hosting choice: Azure Static Web Apps plus SWA-managed .NET Functions. The alternative most aligned with the v1 cost goal is Cloudflare Pages for the frontend, Cloudflare Workers for compute, and R2 / Workers KV / D1 for data depending on the observed persistence needs.

This planned file is not scheduled for v1 execution. It preserves the decision point so the SI agent can revisit hosting only after measurable cost, latency, or platform-limit signals appear.

## Background

CS16 selected SWA-managed Functions because it keeps frontend hosting, API deployment, and Azure Storage Tables access in one Azure-aligned path with a very small operational surface. CS16 C16-9 records the .NET 8 isolated worker choice and C16-14 keeps all Azure resources in one dedicated Sub Invaders resource group with a $5 monthly budget alert ceiling.

Cloudflare's free and low-cost tiers are competitive, especially for static assets and edge compute. A full-stack Cloudflare move may become attractive if SWA cold starts, cost ceilings, DNS/TLS friction, or durable edge-runtime requirements outweigh the benefits of staying in the v1 Azure shape.

## Trigger conditions (any one fires this re-eval)

- Sustained Azure cost > $5/month (the budget alert ceiling per CS16 C16-14).
- Function cold-start latency P95 > 2s sustained over 1 week.
- SWA-managed Functions limitations bite (e.g. lack of long-running tasks, lack of background workers).
- DNS / TLS provisioning friction observed.
- Need for a global edge runtime with durable consistency (Cloudflare Durable Objects).

## Candidate stacks to evaluate

- Cloudflare Pages (static) + Workers (compute) + KV/D1/R2 (data).
- Vercel + Vercel Functions + Vercel KV.
- Self-hosted on a small VPS (Hetzner/DO) with Caddy + a single binary.
- Stay on SWA but bump to Standard tier (with Always Ready instances).

## Evaluation framework

Project cost at 1k DAU, 10k DAU, and 100k DAU, including static hosting, function invocations, storage, egress, logs, and any always-ready capacity. Benchmark frontend and API latency from at least three geographic regions, including first request after idle. Compare migration complexity from SWA routing, .NET Functions, Storage Tables, and GitHub Actions secrets/workflows. Include team-knowledge cost and the operational burden of each stack before recommending any move.

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
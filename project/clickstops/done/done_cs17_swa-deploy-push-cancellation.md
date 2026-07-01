# CS17 — Fix swa-deploy push-run cancellations (production deploys never land)

**Status:** done
**Owner:** yoga-si
**Branch:** cs17/content
**Started:** 2026-07-01
**Closed:** 2026-07-01
**Filed by:** yoga-si (claude-opus-4.8), 2026-07-01, after CS08 required manually re-running the cancelled production deploy 3× this session (be8a412, 1321cc0/cda1ec8); recurring since `8a2c5bc` (2026-06-16). See LRN-028.
**Depends on:** none

## Goal

Make every push to `main` reliably deploy to production without a manual re-run.
Today the `push` production deploy is cancelled within ~2 seconds of a merge,
leaving prod stale on the previous commit until a human re-runs it.

## Background

`.github/workflows/swa-deploy.yml` triggers on both `push: [main]` and
`pull_request: [opened, synchronize, reopened, closed]`, and uses a single
concurrency group `swa-deploy-${{ github.ref }}` with
`cancel-in-progress: ${{ github.event_name == 'pull_request' }}` (true only for
pull_request events).

**Root cause (confirmed empirically):** when a PR merges, two runs start at the
same instant — the `push` build-and-deploy for the squash commit and the
`pull_request: closed` teardown (`close-pull-request` job). They resolve to the
**same concurrency group**, and because the pull_request run has
`cancel-in-progress: true`, it cancels the in-progress `push` production deploy.
Evidence: at the CS08 #118 merge (2026-07-01T03:35:00Z) run `1321cc0`
(event=push) was `cancelled` after 2s while run `0d37064` (event=pull_request,
the PR-close teardown) `succeeded`; the same pattern holds for every cancelled
push deploy in the run history (they die in 1–2s at startup; only manual re-runs
succeed).

The existing comment in the file blames rapid back-to-back merges (Issue #38);
that is a secondary effect. The primary, always-present cause is the
push-vs-pull_request group collision on a single merge.

## Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| CS17-1 | Root cause | The `push` deploy and the `pull_request: closed` teardown share concurrency group `swa-deploy-${{ github.ref }}`; the pull_request run (`cancel-in-progress: true`) cancels the push production deploy. | Confirmed by run history (push run cancelled in 2s; concurrent pull_request teardown succeeded). |
| CS17-2 | Fix | Qualify the concurrency group by event AND (for PRs) PR number so push and pull_request never share one, and PR-close teardowns don't cancel each other: `group: swa-deploy-${{ github.event_name }}-${{ github.event.pull_request.number || github.ref }}`. | Push production deploys can no longer be cancelled by PR teardown runs; per-PR isolation keeps rapid merges from cancelling each other's preview teardown; minimal, surgical change. |
| CS17-3 | Push cancel behavior | Keep `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` (unchanged). Push deploys do not cancel-in-progress; rapid push→push only supersedes the *pending* (older) run, so the newest commit always deploys. | A static SWA only needs the latest commit live; superseding older pending deploys is fine and desirable. |
| CS17-4 | No trigger change | Do NOT drop the `pull_request: closed` trigger or the `close-pull-request` job. | It legitimately tears down PR preview environments; only the group collision is the bug. |

## Deliverables

1. **`.github/workflows/swa-deploy.yml`** — change the `concurrency.group` to
   `swa-deploy-${{ github.event_name }}-${{ github.event.pull_request.number || github.ref }}`.
   No other change to triggers, jobs, `cancel-in-progress`, action pins, or deploy
   inputs.
2. **`LEARNINGS.md`** — update LRN-028's disposition (mark the swa-deploy
   push-cancellation sub-item resolved by CS17, retaining the e2e-floor sub-item
   for CS18).
3. **Verification (orchestrator, no file):** after the CS17 content PR merges,
   confirm its own push production deploy runs to completion (NOT cancelled) and
   `/api/health` reflects the new commit with **no manual re-run**.

## User-approval gates

None — internal CI/deploy reliability fix with no user-visible behavior change.

## Exit criteria

1. `swa-deploy.yml` concurrency group is event-qualified.
2. The CS17 merge's own `push` deploy completes (not cancelled) without a manual re-run.
3. Production `/api/health` `commit` equals the CS17 merge commit shortly after merge.
4. `harness lint` (incl. `workflow-pins`) and CI stay green; no action pins changed.
5. A closed PR's preview environment is still torn down — the `close-pull-request`
   job runs (now in its own `swa-deploy-pull_request-<n>` group) and succeeds.
6. Plan-vs-implementation review records GO.

## Risks + open questions

1. **R1 — GitHub concurrency semantics.** If, contrary to the diagnosis, the
   cancellation has a second cause (e.g. an org-level setting), the event-qualified
   group may not fully fix it. Mitigation: exit criterion #2 verifies against a real
   merge; if it still cancels, investigate the run's cancellation actor directly.
2. **R2 — Preview-env teardown.** Ensure the `close-pull-request` job still runs
   (it is now in its own group `swa-deploy-pull_request-…`); verify a PR close still
   tears down its preview.

## Model audit

| Field | Value |
|---|---|
| Implementer models | claude-opus-4.8 |
| Reviewer model | gpt-5.5 |
| Implementer agent | yoga-si |
| Reviewer agent | rubber-duck |

## Plan review

| Round | Reviewer model | Plan author model(s) | Reviewer agent | Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200 chars) |
|---|---|---|---|---|---|---|---|
| R1 | gpt-5.5 | claude-opus-4.8 | rubber-duck | 6ea0f9751bb3 | 2026-07-01T04:15:10Z | Go-with-amendments | Root cause (push vs pull_request:closed concurrency-group collision) sound; adopted PR-number-qualified group and added a preview-teardown exit criterion. No blocking findings. |

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| Event+PR-number-qualify `swa-deploy.yml` concurrency group (CS17-2) | done | sub-agent #1 | Only the `group:` line + comment rewrite; no other workflow change. Commit on cs17/content. |
| Update LRN-028 disposition (swa-deploy sub-item resolved) | done | sub-agent #1 | Deploy sub-item RESOLVED by CS17; e2e-floor sub-item retained for CS18. |
| Close-out docs + restart state | done | orchestrator | active→done, WORKBOARD cleared, CONTEXT.md updated. |
| Close-out learnings + follow-ups | done | orchestrator | No residual cancellation cause — exit criterion #2 verified clean (see Notes). |

## Notes / Learnings

**Outcome (2026-07-01):** content PR #122 merged as `5cd13cc`. Exit criteria #1–#5 all met.

- **Exit #2 + #3 VERIFIED on the CS17 merge's own deploy** — the definitive proof of the fix. At the `5cd13cc` merge, the `push` production deploy (run 28493723025, group `swa-deploy-push-refs/heads/main`) ran to **completion (success, not cancelled)** while the concurrent `pull_request:closed` teardown for PR #122 (group `swa-deploy-pull_request-122`) succeeded independently. Prod `/api/health` → `commit: 5cd13cc` with **no manual re-run**. Contrast the two immediately-prior merges under the old shared group: `5353d05` (filing PR #120) and `406f4ef` (claim PR #121) push deploys were both **cancelled** in ~2s.
- **Exit #5 (preview teardown):** the PR #122 `close-pull-request` job ran and succeeded in its own per-PR group.
- **Review:** rubber-duck (gpt-5.5) returned Go with no blocking findings (confirmed group separation, unchanged push queueing, no other refs to the old group, valid `||` expression, LRN-028 frontmatter intact). Copilot raised one comment claiming `cancel-in-progress: false` does not supersede older *pending* runs; declined with an authoritative GitHub-docs citation (default `queue: single` cancels+replaces existing pending runs) — the comment wording is correct and the reviewer concurred.

## Plan-vs-implementation review

**Reviewer:** rubber-duck (gpt-5.5) — independent of the implementer model (claude-opus-4.8) per CS48. One rubber-duck round (Go, no blocking findings) plus one Copilot (`copilot-pull-request-reviewer`) round on #122 (one comment, declined with GitHub-docs citation).
**Date:** 2026-07-01
**Outcome:** GO — content PR #122 merged as `5cd13cc`.

**Deliverables:** both landed exactly as planned — (1) `swa-deploy.yml` concurrency `group:` changed to `swa-deploy-${{ github.event_name }}-${{ github.event.pull_request.number || github.ref }}` (plus a comment rewrite documenting the real root cause; no trigger/job/pin/cancel-in-progress/deploy-input change), and (2) LRN-028's disposition updated (deploy sub-item RESOLVED by CS17, e2e-floor sub-item retained for CS18). All six exit criteria satisfied; #2/#3 verified empirically on the CS17 merge's own push deploy (`5cd13cc` deployed to prod with no manual re-run — see Notes). No scope deviation.

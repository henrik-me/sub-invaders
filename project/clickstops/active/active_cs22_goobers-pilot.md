# CS22 - Define the native Windows Goobers pilot and dispatch exception

**Status:** active
**Owner:** omni-si
**Branch:** cs22/content
**Started:** 2026-10-22T23:58:07Z
**Closed:** not closed
**Filed by:** omni-si (gpt-6.1-sol), 2026-10-22, at the user's request.
**Depends on:** none

## Goal

Prepare a reversible Goobers pilot that reduces manual coordination without removing
existing Sub Invaders safeguards. This clickstop defines the pilot and proposes its
dispatch-issue exception. It does not install Goobers or execute the coding task.

## Background

The user selected this machine, native Windows only, and approved the offline-score
preservation task described below. The user requires separate approval before any live
AI execution under their Windows account.

The current harness prohibits agents from creating issues in this repository.
Goobers' standard implementation workflow dispatches GitHub issues. The user requested
a narrowly scoped proposed exception rather than personally creating the dispatch issue.
Clickstops remain the canonical planning record.

The baseline source revision is `db19474`. No Goobers executable was found on PATH
during preparation. Copilot CLI, Git, Node.js, and .NET were found; this does not establish
their versions, authentication, or readiness for a Goobers run.

Read-only probes on 2026-10-22: `git log -1` reported `db19474`;
`gh api repos/henrik-me/sub-invaders/rules/branches/main` reported the effective
rules listed below; `gh api repos/henrik-me/sub-invaders/rulesets` reported active
`main-protection`. The classic branch-protection endpoint returned 404; protection
is provided by the ruleset, not absent.
`gh label list --repo henrik-me/sub-invaders --search goobers` returned no pilot
labels during independent review on 2026-10-22.

## Decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Objective | Reduce manual coordination while preserving existing review and CI requirements. | A successful PR alone does not demonstrate a useful migration. |
| 2 | Host | This machine, native Windows; no WSL substitution. | Explicit user selection. |
| 3 | Introduction | Introduce Goobers alongside the pinned harness. Remove no existing controls during the pilot. | Keep rollback simple and expose missing policy mappings. |
| 4 | Planning and dispatch | Clickstops own plans and history. One linked GitHub issue is a dispatch ticket, not a second task queue. | Avoid competing sources of truth. |
| 5 | Policy change | Propose an explicit project-local exception in `INSTRUCTIONS.md`; do not edit the managed core. It becomes effective only after its policy PR merges. | Preserve composed-file ownership and normal governance. |
| 6 | Configuration | Store reviewed desired-state definitions in `goobers/`; do not activate them merely because they exist on a branch. | Workforce changes require review just like product changes. |
| 7 | Runtime | Store the local instance at `C:\goobers\sub-invaders`, outside the checkout. Edit source definitions, not generated active copies. | Journals, transcripts, claims, and worktrees are operational state, not Git content. |
| 8 | Execution | Manual dispatch, one active run, finite runtime and repair limits, no merge-review or automatic work nomination. | Bound the first experiment and prevent unapproved work. |
| 9 | Review and merge | Preserve review independence, evidence, and checks. Require valid independent human approval and no ruleset/admin bypass for every pilot-related PR: plan filing, claim, policy, setup, coding, and close-out. Do not opt into workboard auto-merge. | This user-required posture is stricter than the historical solo-admin/workboard merge path. Internal Goobers verdicts are not GitHub approvals. |
| 10 | Credentials and isolation | Keep secrets outside Git; assess access granted to the Windows account and repository credentials before live execution. No claim of native sandbox parity. | Git worktrees isolate edits, not filesystem or network access. |
| 11 | Sequence | Complete policy approval before ticket creation. Complete setup and readiness before requesting live-run approval. Approve the coding clickstop separately before claiming it. | Each phase has an explicit stop point and stays independently reviewable. |

## Deliverables

1. This reviewed plan, including the approved task, baseline evidence, storage layout,
   policy proposal, acceptance criteria, and explicit approval gates.
2. After this planned clickstop is approved, a policy-only implementation in the
   `instructions.harness` local block of `INSTRUCTIONS.md`. Explain that the local
   exception overrides only the managed no-agent-created-issues rule for this pilot.
   All other managed rules remain in effect; `harness sync` must preserve the block.
3. A restart-state update in `CONTEXT.md` when the policy is accepted, naming the
   next separately planned setup clickstop and all still-unapproved actions.
4. Close-out: docs + restart state. Complete normal clickstop/workboard lifecycle
   updates through reviewed PRs; keep this record in the completed history.
5. Close-out: learnings + follow-ups. Record policy-mapping discoveries and file the
   separate setup/coding clickstops before execution; do not create follow-up issues.

## Proposed dispatch exception

This is proposed wording, not an active exception:

> For the user-approved Goobers pilot only, an agent may create one dispatch issue
> for the offline-score preservation task specified in CS22, after this exception's
> policy PR has merged. This maintainer-authorized local exception takes precedence
> over "Agent does not file issues in this repository" only for this one ticket.
> The issue must link to the approved coding clickstop, contain its approved scope
> and acceptance criteria, and include the exact body marker
> `Goobers-Pilot-ID: sub-invaders-offline-score-preservation-v1`.
> Search open and closed issues for that marker before creating a ticket. Reuse an
> open match; stop and ask the user if the match is closed or ambiguous. Never create
> a replacement automatically.
> A human must apply both `goobers:approved` and `goobers:ready`; agents must not
> apply or reapply either trust/readiness label. Label creation requires separately
> approved setup. Configured claim/status labels and progress comments may affect
> only this ticket; opening a PR, observing checks, and recording feedback may affect
> only its pilot PR.
> This exception does not authorize other agent-created issues, automatic nomination,
> extra tasks, or changes to CI, review, merge, or deployment policy. Clickstop files
> remain the source of truth. Remove the exception through review when the pilot ends.

Do not enable work-nomination/backlog-curation modules that can create or expand work.
Confirm the configured issue query can select only the approved dispatch ticket.
Do not let pilot workers edit their instructions, Goobers definitions, or governance.
These are workflow constraints, not a claim that a GitHub token is path-scoped.

## Pilot task and acceptance

The approved coding task is to preserve offline scores enqueued while an earlier
submission is awaiting completion in `src/game/pending-scores.mjs`.

Reproduction with isolated in-memory storage, without a browser or network:

1. Enqueue score A and start `drain()` with its submission promise held open.
2. Enqueue score B while the drain is awaiting that promise.
3. Resolve A successfully: the stored queue becomes empty and B is lost.
4. Repeat with a transient failure for A: the queue retains A but loses B.

The existing eight `pending-scores.test.mjs` tests passed at `db19474`.
The reproduction demonstrates module behavior, not a verified browser journey.
`src/game/main.mjs` starts a drain on load; `src/game/scenes/play.mjs` can enqueue
a failed submission.

The later coding clickstop must require:

- Preserve newly enqueued B after both successful and transiently failing attempts for A.
- Preserve FIFO, permanent-drop behavior, transient retry behavior, and the existing cap.
- Add focused regression tests in the existing test file. Keep the implementation in
  the queue module unless a reviewed finding proves a dependent change necessary.
- Do not change backend contracts, deployment, or general multi-tab synchronization.
  Do not conflate this task with CS20's WebKit nightly stabilization.

## Storage and introduction sequence

| Information | Location |
|---|---|
| Pilot policy plan | This clickstop, moving through planned/active/done under normal review |
| Setup and coding plans | Separate clickstops allocated after checking the then-current IDs |
| Active ownership | `WORKBOARD.md`, under existing claim rules |
| Dispatch and proposed code | One approved GitHub issue and normal content PR |
| Versioned definitions | `C:\src\sub-invaders\goobers` |
| Instance configuration and generated active definitions | `C:\goobers\sub-invaders` and its `config` directory |
| Journals, transcripts, artifacts, scheduler state, managed worktrees | Inside the local instance; never committed |
| Secrets | Supported credential store or environment references; no token values in YAML |

The later setup clickstop must pin and verify a Goobers release, map existing review
obligations, select a real Windows-compatible local CI command, and validate source
configuration without dispatch. Follow the release-matched placement and onboarding
guides; the guided wizard defaults to instance-local configuration, so do not assume it
automatically creates or tracks the reviewed in-repository source layout.

Before activating the in-repository config source, the setup clickstop must arrange
CODEOWNERS coverage, required code-owner review, and an eligible independent reviewer
for that path, as required by the placement guide. The current ruleset has required
code-owner review disabled. Any change to that setting needs its own explicit approval
and protected review; CS22 does not authorize ruleset edits. If the boundary cannot be
established, stop and ask about a different placement rather than activating an
unprotected source. Recheck the then-current harness pin and synchronization behavior.

Before any live probe, request approval stating the command, account, credentials,
filesystem/network exposure, and usage/time limits. A disposable live Copilot probe is
also a live run and is not authorized by this plan. Only after readiness is established
and the coding task is claimed may Goobers attempt the real task under a separately
approved live-run scope.

## User-approval gates

- Confirmed: native Windows, reduced coordination with safeguards preserved, bounded
  read-only discovery, and the offline-score preservation task.
- Confirmed: prepare a proposed dispatch exception; this does not make it effective.
- Confirmed one-time preparation model substitution: GPT-6.1 Sol authors the
  pilot-plan/policy proposal; independent Claude Opus 5.5 reviews it. The repository's
  specified author/reviewer models are unavailable in this session. This exception
  does not change standing model policy or authorize Goobers/Copilot CLI execution.
  Record the substitution and its rationale in both the plan-filing and policy PR bodies.
- Confirmed pilot audit clarification: `github` identifies the GitHub Copilot agent
  platform; models and independent agent instances are recorded separately from
  publishing-account usernames. The maintainer explicitly approved this interpretation
  on 2026-10-22. It does not establish native GitHub approval or change the ruleset.
- Completed: the plan-filing PR, #173, merged as `64685df` on 2026-10-22.
- Completed: pre-claim evidence PR #174 and claim PR #175 merged; the latter is
  `b31a39c`. Policy content review/merge and later setup/coding/live-run gates remain.
- Pending: arrange an eligible independent human approver before merging any pilot PR.
  The historical solo-admin fallback is explicitly forbidden throughout this pilot.
- Pending: independent review and normal human approval of the plan and policy PRs.
- Pending: approval for pilot-label creation and any configuration-protection changes;
  human application of both trust/readiness labels before dispatch.
- Pending: approval of the separately planned setup and coding work.
- Pending: explicit approval before any live AI execution under the Windows account.

## Exit criteria

- The dispatch exception is independently reviewed and accepted through a normal policy
  PR, with no protection changes or bypass.
- Composed-file synchronization preserves the local exception; pinned harness checks
  pass, or a pre-existing blocker is explicitly reported and resolved before merge.
- Restart documentation names the approved policy and next phase without claiming
  that Goobers is installed, a ticket exists, or live execution is authorized.

## Risks + open questions

- Confirm how Goobers can satisfy this repository's independent review and PR-evidence
  gates. An agentic review verdict alone is insufficient.
- Native Windows integration and process cleanup need validation. Missing tests are
  unknowns, not proof of product failure; native isolation remains a separate limitation.
- The account can access more than a worktree. Defer any live run until its exposure
  and credentials are explicitly approved.
- A PR authored with the current `henrik-me` credentials cannot obtain a valid human
  approval from the same account. Arrange an eligible independent approver; do not
  weaken the one-approval requirement or use a bypass.
- Existing required checks include `ci`, `harness-lint`, `harness-sync-check`,
  `js-tests`, `dotnet-tests`, `e2e-local`, and `coverage`. Verify current rules again
  before executing later phases.
- Stop Goobers and retain evidence if the pilot fails. Leave product changes unmerged
  and return ownership explicitly to the old process before it resumes the same task.

## Plan review

R1 requested amendments; R2 approved the revised hashed sections. The remaining R2
waiver-recording clarification and label-probe citation were applied outside those
sections without changing their hash. R3 reviewed the committed plan at `df80a758`
and returned Go. Local review does not establish native GitHub approval or replace
human approval. Future claim, policy, and close-out PRs retain their normal gates.

| Round | Reviewer model | Plan author model(s) | Reviewer agent | Reviewed sections hash | Timestamp (UTC) | Verdict | Findings recap (≤200 chars) |
|---|---|---|---|---|---|---|---|
| R1 | claude-opus-5.5 | gpt-6.1-sol | opus-pilot-review (local; no GitHub login) | d2140ed7b656 | 2026-10-22T21:00:35Z | Needs-Fix | Clarify no-bypass scope and human-controlled trust labels; specify ticket deduplication and config protection. |
| R2 | claude-opus-5.5 | gpt-6.1-sol | opus-pilot-r2 (local; no GitHub login) | 18688471252e | 2026-10-22T21:04:09Z | Go | Both blockers resolved; record waiver in PR bodies and cite label probe. These non-hashed clarifications are applied. |
| R3 | claude-opus-5.5 | gpt-6.1-sol | github:opus-pilot-head (local agent instance) | 18688471252e | 2026-10-22T21:51:07Z | Go | Reviewed committed plan df80a758; hash unchanged. Evidence: PR #173 comment 6352130421. Native approval remains separate. |

## Model audit

| Field | Value |
|---|---|
| Implementer models | gpt-6.1-sol |
| Reviewer model | claude-opus-5.5 |
| Implementer agent | github:omni-si |
| Reviewer agent | github:opus-pilot-head |
| Publishing account | henrik-me |
| Notes | Pilot-scoped maintainer clarification: agent fields name logical instances on the github platform, not GitHub login accounts. The Opus local review and native Copilot bot review are separate. |

## Tasks

| Task | State | Owner | Notes |
|---|---|---|---|
| Claim CS22 through normal review | done | omni-si | PR #175 merged as b31a39c; canonical ownership is active. |
| Add the scoped local dispatch exception | active | omni-si | Local-block policy text prepared; normal content review/merge pending. No ticket created. |
| Verify lint and composed-file synchronization | active | omni-si | Local lint 21/0, no sync drift, unchanged hash, and byte-for-byte composition preservation verified; final PR checks pending. |
| Record accepted policy and next setup step | active | omni-si | CONTEXT.md records the merge boundary and separately approved setup; no installation or live-run claim. |
| Close-out: docs + restart state | planned | omni-si | Review final state and complete the normal workboard/clickstop lifecycle. |
| Close-out: learnings + follow-ups | planned | omni-si | Preserve reviewed learning constraints and separately plan later setup/coding work. |

## Notes / Learnings

Plan filing and claiming changed no active policy. The content PR adds only the
reviewed local exception and restart records; it becomes effective after normal merge.
Application code, required checks, harness pin, and deployment remain unchanged.
Pilot PRs must not receive the `workboard-only` label.

Pre-claim harvest disposition, 2026-10-22:

- LRN-027: `skip-for-this-CS`. The engine dependency pin and upstream release boundary
  are unchanged by policy preparation; no engine changes are authorized.
- LRN-029: reviewed; `skip-for-this-CS` for the policy change. Preserve the existing
  ranked-score drain override, module Service Worker registration, and query-insensitive
  offline navigation. Carry these constraints into the later offline-score coding plan.
  These per-CS dispositions do not close the repository-wide learning entries.

Startup at merged revision `64685df` failed only the tip's commit-trailers check:
Copilot's co-author line was separated from the final trailer block. Preserve that
history; use one contiguous required-trailer block on preparation and claim commits.
No lint flags, checks, or protection settings are relaxed to proceed.

Policy-content validation uses the pinned v0.12.0 parser/merge engine in memory:
managed sections and local markers match the baseline, and recomposition preserves
the complete updated instructions byte-for-byte. No mid-CS sync apply is performed.

Review evidence:

- [Committed-plan Opus R3 report](https://github.com/henrik-me/sub-invaders/pull/173#issuecomment-6352130421)
- [Separate native Copilot review](https://github.com/henrik-me/sub-invaders/pull/173#pullrequestreview-5621359086)

Reference sources:

- [Current instructions](../../../INSTRUCTIONS.md)
- [Filing a clickstop](../../../OPERATIONS.md#filing-a-clickstop)
- [Goobers placement](https://github.com/Agent-Clubhouse/Goobers/blob/main/docs/guides/instance-placement.md)
- [Goobers onboarding](https://github.com/Agent-Clubhouse/Goobers/blob/main/docs/guides/arbitrary-repo-onboarding.md)

## Plan-vs-implementation review

Pending implementation and close-out; no completion attestation is made here.

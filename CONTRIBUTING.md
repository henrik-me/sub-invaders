# Contributing to Sub Invaders

Welcome, and thanks for your interest in Sub Invaders! This guide covers the workflow,
conventions, and gates that every contribution must pass.

## Quick start

1. Clone the repo and open `README.md` for local dev setup instructions.
2. Review `ARCHITECTURE.md` for an overview of the codebase structure.
3. Pick an open issue (or open one), branch, make changes, and open a PR.

No CLA and no DCO signoff required — the project is MIT-licensed.

## Branch naming

| Pattern | Use for |
|---------|---------|
| `cs<NN>/<slug>` | Clickstop content branches (orchestrated work) |
| `workboard/cs<NN>-(claim\|close-out)` | WORKBOARD-only PRs |
| `fix/<slug>` | Bug fixes / hotfixes |
| `feat/<slug>` | New features |
| `docs/<slug>` | Documentation-only changes |
| `chore/<slug>` | Repo hygiene, dependency bumps |

Slugs are lowercase kebab-case, ≤40 characters. Do not include dates or ticket numbers
unless they are genuinely disambiguating. Branch names are stable: do not rename a branch
after opening a PR against it.

## Commit conventions

- **Subject line:** short imperative sentence, ≤72 characters, no trailing period.
  Example: `Add enemy wave spawning logic`.
- **Body:** one blank line after the subject, then a paragraph explaining *why* the change
  was made. Wrap at 72 characters.
- **Atomic commits:** each commit must leave the repo in a buildable, testable state. Avoid
  "WIP" or "fixup" commits on branches that will be squash-merged.

### Co-authored-by trailer (required)

Every commit made with agent assistance **must** include the following trailer verbatim:

```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

This is required for attribution and auditability under the LRN-101 pilot. Place the trailer
at the bottom of the commit message, after a blank line:

```
Fix projectile collision detection

Clamp the bounding-box check so projectiles that travel more than one
frame's width do not tunnel through narrow enemies.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

Configure git to add the trailer automatically:

```bash
git config trailer.copilot.key 'Co-authored-by'
git config trailer.copilot.cmd \
  'echo "Copilot <223556219+Copilot@users.noreply.github.com>"'
```

Or paste it manually at the bottom of each commit message.

## Three-PR shape

All orchestrated Clickstop (CS) work produces exactly three PRs in sequence:

1. **Workboard-claim PR** — branch `cs<NN>/claim`; touches only `WORKBOARD.md` and the CS
   file rename (`planned → active`). Label: `workboard-only`.
2. **Content PR** — branch `cs<NN>/content`; all implementation lives here. Standard review
   loop (GPT-5.5 + maintainer). Squash-merge only.
3. **Close-out PR** — branch `cs<NN>/close-out`; moves `WORKBOARD.md` row to done and renames
   the CS file (`active → done`). Label: `workboard-only`.

See [OPERATIONS.md](OPERATIONS.md) for the full procedure, gate requirements, and
plan-vs-implementation review.

## Review

All PRs receive a **GPT-5.5 rubber-duck review** (or an approved fallback model) before
merge. See [REVIEWS.md](REVIEWS.md) for the full review process and independence invariant.

- Draft PRs are welcome for early feedback but must be converted to Ready before the review
  step.
- All review threads must be resolved before merge.
- Rebase (do not merge) if your branch falls behind `main`.

## Merge policy

- **Squash-merge only** on `main`. Linear history is enforced.
- **No force pushes** to `main`. Force-pushing a feature branch before merge is acceptable
  but must be communicated to any co-authors.
- Delete the source branch after merge unless it is a long-lived integration branch.

## Reporting bugs and requesting features

Open an issue using one of the templates under `.github/ISSUE_TEMPLATE/`:

- **Bug report** — for things that don't work.
- **Feature request** — for new capabilities.

For **security issues, do not open a public issue.** See [SECURITY.md](SECURITY.md).

## Code of Conduct

This project adheres to the [Contributor Covenant 2.1](CODE_OF_CONDUCT.md). By
participating you agree to uphold its terms.

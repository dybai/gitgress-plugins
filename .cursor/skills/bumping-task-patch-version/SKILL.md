---
name: bumping-task-patch-version
description: >
  Use when starting a development task that will modify code, before the first
  git commit of that task, or when about to commit the first code change in a
  feature branch or git worktree — especially with parallel worktrees, package.json
  version, patch bump, or fear of version collisions across concurrent tasks.
---

# Bumping Task Patch Version

## Overview

Every code-changing task claims a unique patch on its **first commit**, taken from
the **max** `package.json` version across worktrees/branches (not the local file alone).

**Iron Law:** No first commit of a code-changing task without a patch bump from max+1.

**Violating the letter of the rules is violating the spirit of the rules.**

## When to Use

**Always:** features, bug fixes, refactors, behavior changes — on that task's first commit.

**Skip:** docs/comments/formatting only (no code/behavior change); this task already
bumped version; partner explicitly forbids.

## Procedure (first commit only)

1. Confirm the task modifies code.
2. Collect versions: current `package.json` + every path from `git worktree list`
   (read that path's `package.json` when present). Optionally `git show <ref>:package.json` for other local branches.
3. Parse `MAJOR.MINOR.PATCH`; set `version` to `MAJOR.MINOR.(maxPATCH + 1)` — last segment only.
4. Include that change in the **first** commit of the task.
5. Later commits in the same task: do **not** bump again.
6. If another worktree may race: re-read max immediately before committing.

## Quick Reference

| Situation | Action |
|-----------|--------|
| First commit, code changes | max patch across worktrees/branches + 1 |
| Second+ commit, same task | unchanged |
| Docs-only | unchanged |
| Parallel worktrees starting | each re-reads max right before its first commit |

## Rationalizations

| Excuse | Reality |
|--------|---------|
| "User didn't ask for a release" | Bump tracks **tasks**, not marketplace releases. |
| "Keep the commit feature-only" | Version claim belongs in the first commit. |
| "Bump at merge / release / second commit" | Too late — parallel tasks collide. First commit only. |
| "Bumping causes worktree conflicts" | Skipping duplicates versions. Scan max, then max+1. |
| "No time / dinner / CI waiting" | Patch edit takes seconds. |
| "Only if we publish" | Publish timing ≠ task identity. |

## Red Flags — STOP

- First code commit with unchanged `package.json` version
- Bumping from local file only while other worktrees exist
- Feature commit now, version commit "in 30 seconds"
- "User didn't mention versioning" / "avoid conflicts by skipping"

**All of these mean:** re-read max, set patch to max+1, include in the first commit.

## Common Mistakes

- Bumping minor/major — only the last segment
- Bumping every commit — once per task
- Bumping docs-only — skip
- Two agents both write the same max+1 — re-check max immediately before commit

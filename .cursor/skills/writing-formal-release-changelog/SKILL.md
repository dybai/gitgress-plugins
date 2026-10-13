---
name: writing-formal-release-changelog
description: >-
  Use when the user explicitly asks to write, update, edit, or rewrite
  CHANGELOG.md (or release notes), or when consolidating task patch bumps into
  formal release sections—especially if tempted to add a ## heading per
  package.json patch or to drop intermediate bullets when merging sections.
---

# Writing Formal-Release CHANGELOG

## Overview

`CHANGELOG.md` documents **formal public/marketplace releases** only. Task-level
`package.json` patch bumps are not changelog sections. Intermediate task changes
**roll into the next formal release**—content preserved, headings not.

**Iron Law:** Do not touch `CHANGELOG.md` unless the user explicitly asks in this
conversation. Commits and task patch bumps alone never imply a changelog edit.

**Violating the letter of these rules is violating the spirit of the rules.**

## When to edit CHANGELOG

**Do edit** only if the user clearly asks, e.g. 写/更新/补写 CHANGELOG、release
notes、正式版说明、把某次改动写进 changelog.

**Do not edit** when the user only asks to commit, implement, bump version, open
a PR, or “提交这些改动”—even if `package.json` just moved to a new patch.

## Formal versions vs task patches

| Concept | Meaning |
|---------|---------|
| Task patch | Every code-changing task’s first-commit bump (see project bump rule) |
| Formal release | A version the user names as a public/marketplace release, or that already has a `##` section in `CHANGELOG.md` for that purpose |

Existing `## x.y.z` headings in `CHANGELOG.md` are the formal set unless the user
redefines it (e.g. “正式版是 1.0.0、1.0.4、1.0.7”).

## How to write when asked

1. **Only formal `##` headings.** Never add `##` for a task-only patch (e.g. no
   `## 1.0.10` if formal jumps … → 1.0.9 → 1.0.11).
2. **Roll forward.** Changes from task patches after the previous formal release
   belong under the **next** formal `##` section (create that section if this
   ask is cutting a new formal release).
3. **Preserve bullets.** Rolling up means moving/keeping every notable
   user-facing bullet from intermediate work into that formal section—not
   deleting them and not collapsing many tasks into one vague summary line.
4. **Order.** Newest formal section on top; within a section, chronological or
   thematic grouping is fine as long as content from each rolled-up task remains.

```text
❌ ## 1.0.10 and ## 1.0.11 both added for two task bumps; next formal is 1.0.11
✅ Only ## 1.0.11; bullets cover both the 1.0.10 and 1.0.11 tasks

❌ ## 1.0.7 with one summary line; 1.0.5/1.0.6 details discarded
✅ ## 1.0.7 lists all notable bullets from 1.0.5 + 1.0.6 + 1.0.7 work
```

## Common rationalizations

| Excuse | Reality |
|--------|---------|
| “User named 1.0.10 and 1.0.11 → two ## sections” | They named task versions; only the next **formal** version gets a heading; both tasks’ notes go there |
| “Keep a Changelog = one section per semver bump” | Here changelog sections track **formal releases**, not every task patch |
| “Missing ## 1.0.5 means they forgot” | Intermediate patches are intentionally omitted as headings and folded into the next formal section |
| “I’ll merge sections later before publish” | Write the formal shape when asked—don’t create disposable intermediate headings |
| “Commit should include CHANGELOG for completeness” | Only if the user asked for a changelog update in this conversation |
| “Only formal versions” ⇒ one short blurb per release | Formal **headings** only; intermediate **content** must still appear under the next formal section |

## Red flags — STOP

- Editing `CHANGELOG.md` when the user only asked to commit / implement / bump
- Adding `## x.y.z` for every `package.json` patch
- Deleting intermediate bullets while “consolidating” into a formal section
- Creating `## Unreleased` or per-task sections unless the user explicitly wants that shape

**All of these mean: follow this skill; fix the changelog shape before finishing.**

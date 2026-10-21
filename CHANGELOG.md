# Changelog

All notable changes to GitGress are documented in this file.

## 1.0.18

- Commits keeps a way to pick a repository and branch when the commit list is
  empty: with repositories indexed but none selected the header shows
  `Select repository`, load errors keep both controls, and Select Repository /
  Switch Branch return to the Commits title bar.
- The last effective repository is remembered and restored when a workspace is
  reopened, after the active file's repository and before the automatic
  single-repository fallback.

## 1.0.17

- Select Repository and Switch Branch Quick Picks mark the current item with a
  left check icon and a bracketed marker (`[ Current repository ]` /
  `[ Current branch ]`). Other rows use a blank icon so labels stay left-aligned.
- Opening either picker pre-focuses the current item without reordering the list
  (Enter keeps the current choice). Shared `createQuickPick` helper powers both.

## 1.0.15

- Commits keeps scan progress and the branch header fixed; only the commit
  list scrolls. Files keeps the toolbar fixed; only the file list scrolls.
- Commits shows git tag pills on the tagged commits, visually distinct from
  branch tips (outline tags / filled branches). Refs pack into one row by
  priority (`HEAD` → current branch → tags → other branches); overflow folds
  into `+N`, with the full pill list on the commit hover card. Tip ↑/↓ jump
  stays branch-tips only. Tag tip changes refresh history via `refs/tags`
  watches; tag names display without a `refs/tags/` prefix.
- Commit graph elbows use rounded corners, and each row’s graph gutter shrinks
  to the lanes that row actually uses so sparse history wastes less horizontal
  space.
- Commits title bar no longer shows Select Repository / Switch Branch beside
  Refresh (commands remain in the Command Palette). The header repo and branch
  controls use Codicon `repo` / `git-branch` icons; clicking the branch control
  switches branches. Header left padding aligns with the commit-list / graph.

## 1.0.11

- Select Repository Quick Pick shows the workspace folder short name for the
  current workspace-root repo instead of `.`, and keeps the
  `Current repository` marker. Colliding basenames are disambiguated as
  `parent/name` (same short-name rules as the Commits header).

## 1.0.10

- After the repo index scan finishes, Commits auto-selects a default repository
  when there is no manual preference and no usable active file: prefer the
  unique workspace folder that is itself a Git root; otherwise the unique
  indexed repository. Multi-repo cases with no clear default stay empty until
  Select Repository.
- Empty Commits copy distinguishes “no Git repositories in the workspace”
  from “repositories found but none selected,” and refreshes if the index
  count changes while nothing is selected.
- Re-scans clear index authority until idle again, so default selection does
  not lock a repo mid-scan after workspace folder changes.

## 1.0.9

- Commits history uses a bidirectional sliding window (max 6 × 100 commits)
  with one-page preload at the edges, so memory stays bounded while scrolling
  toward older history or toward the tip (`loadNewer`).
- Auto-refresh watches the selected repo’s gitdir (including worktree
  layouts). After ~1.5s quiet, local tip changes reconcile the window while
  keeping the selected commit when it still exists—Files then stay unchanged.
- Remote-tracking tip pills (e.g. `origin/main`) update when `refs/remotes/**`
  move (push / fetch) without rebuilding the whole commits window.
- Manual Refresh still means “show latest”: reset from tip and rescan; it is
  not the same as auto-refresh.

## 1.0.7

- Files panel shows file and folder icons from the active File Icon Theme
  (SVG or Seti font glyphs), with Codicon fallback when a theme icon is
  unavailable.
- Icons refresh when the icon theme or color theme changes; the Files webview
  CSP allows theme image and font resources.
- Theme image load failures fall back without breaking tree icon slots;
  light-theme file mappings fall back correctly when light-specific entries
  are missing.
- Icons follow Seti-style `languageIds` mappings (e.g. `.java`, `.yaml`, `.ts`)
  via VS Code language contributions, so common types no longer share one
  generic default icon.

## 1.0.4

- Multi-repository discovery and selection: background repo index, Select
  Repository command, sticky selection across scans, and scan progress in
  Commits.
- Commits UI: selected-repo header, HEAD / branch tip pills, two-line rows, and
  in-pill tip jump between loaded tip commits.
- Tip pills skip remote `HEAD` markers and restyle remote branches for clearer
  local vs remote distinction.
- More reliable repo selection from the active editor / open file path.

## 1.0.0

- First public release: multi-lane commit graph, paginated history, commit hover
  overlay, Files webview (list/tree/auto), and parent-commit diffs.
- Keyboard selection navigation in Commits (Arrow/Home/End/PageUp/PageDown).
- Distributable VSIX with VS Marketplace and Open VSX listing metadata.

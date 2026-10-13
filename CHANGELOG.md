# Changelog

All notable changes to GitGress are documented in this file.

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

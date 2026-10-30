# Changelog

All notable changes to GitGress are documented in this file.

## 1.0.31

- The inline blame annotation no longer drifts to the wrong side of the line
  after edits that delete or shift the decorated line (for example repeated
  `Ctrl+D`): it is cleared immediately and recomputed for the new content.
- The Commits view's progress bar is now shared between repository scanning
  and the initial commit load, so it stays visible until commits are actually
  ready instead of disappearing mid-load on slower machines.
- The Commits view now shows "Resolving branch…" instead of a false
  "No commits found on this branch." while the display branch is being
  resolved after a repository is selected.
- The inline blame annotation now hides when the editor loses focus and
  reappears when you click back into the editor.
- The blame hover popup's reveal button now shows the commit's short hash and
  the copy button sits right next to it without a separator.
- Hover popup action spacing was tuned: a thin space between the reveal icon
  and the short hash, and an en-space gap before the copy button (the Unicode
  spaces used are documented in the source so the widths are easy to tune).
- The hover popup's date is now the full localized date and time (for example
  `September 2nd, 2026 6:18 PM`) instead of a short `MM-DD`.
- The inline blame annotation now shows the commit subject after the author
  and time, separated by a bullet; subjects longer than 50 characters are
  truncated with an ellipsis.
- The inline blame annotation sits 50px away from the code and uses a muted
  35%-alpha gray, matching the visual weight of other blame extensions;
  customize it via `gitgress.blameAnnotationForeground` in
  `workbench.colorCustomizations`.
- The extension now activates when the window finishes loading, so the inline
  blame works immediately without first clicking the GitGress view.
- The blame hover popup's actions are icon buttons (reveal / copy); hover an
  icon for its label.
- Inline blame annotation now renders at the end of the cursor line instead
  of being injected before the first character.
- Conflict dialog reworked: generic wording with the detected extension's
  name, two choices (Show both / Hide GitGress's), and detection backed by a
  structured known-extensions list instead of GitLens-only logic.
- Editor shows a current-line blame annotation at the end of the active line
  (`author, relative time (MM-DD) • subject`), with a hover popup for the
  commit message, `+N −M` stats, Reveal in GitGress, and Copy Hash.
- Adds `gitgress.editorBlame.enabled` and `gitgress.editorBlame.conflictMode`
  so GitGress can ask, always show, or defer when GitLens current-line blame
  is also enabled.
- Commit rows show a copy button to the left of the short hash in the meta
  line. It appears on hover or keyboard focus, copies the full commit hash to
  the clipboard, briefly flips to a check mark, and does not change the row
  selection.
- Commits list scrollbar sits flush against the webview's right edge: the
  view now overrides VS Code's injected `body { padding: 0 20px }` on the
  right side only, so the scrollbar no longer floats ~20px away from the
  window edge.

## 1.0.18

- When repositories are indexed, Commits keeps a way to pick a repository and
  branch even if the commit list is empty: with none selected the header shows
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

# Gitgress

Gitgress is a VS Code/Cursor extension for browsing a repository's commit
history as a multi-lane graph (including merge forks), loading more commits via
infinite scroll, inspecting files changed by a selected commit, and opening
diffs against that commit's parent. Commit details appear in a floating hover
overlay (no avatar) that stays aligned while you scroll.

## Install and run

Requirements: Node.js, npm, Git 2.24 or newer, and a VS Code-compatible
editor supporting extension engine `^1.85.0` (including VS Code and Cursor).

1. Clone the repository and run `npm ci`.
2. Open the repository in VS Code or Cursor.
3. Press `F5` and choose **Extension Development Host** if prompted.
4. In the new window, open a Git repository and select **Gitgress** in the
   Activity Bar.

The Commits view shows the selected branch with an SVG lane graph. Scroll toward
the bottom to load older commits until history is exhausted. Use the branch and
refresh buttons in the view title; either action resets the list from the
newest commits. Hover or focus a commit row for the overlay tooltip. Selecting
a commit populates the Files view (first-parent changed paths, same as diffs).

## Architecture

```text
VS Code extension host
  └─ extension.ts (composition root and commands)
      ├─ GitService ── runGit ── local Git CLI
      ├─ SelectionState (repository, branch, selected commit)
      ├─ CommitsViewProvider ── typed messages ── webview (bundled assets)
      ├─ FilesViewProvider ── typed messages ── webview (bundled assets)
      └─ DiffService + GitgressContentProvider ── VS Code diff editor
```

The Git layer has no UI dependencies. Shared selection state coordinates the
Commits and Files webviews; providers translate state and Git results into
protocol messages for the bundled webview apps. History `git log` includes merge
topology; changed-file and diff queries still use first-parent flattening.

Both webviews are built with esbuild from `webview/` into `dist/webview/` via
`npm run build:webview`. `npm run compile` runs the webview build, then
TypeScript (`tsc`). Use `npm run watch:webview` alongside `npm run watch` during
UI work.

## Development and tests

The project was developed with test-driven development. Run the complete test
suite and TypeScript compiler with:

```bash
npm test
npm run compile
```

`npm test` runs the Vitest suite once. Use `npm run test:watch` during
development. `compile` always rebuilds webview bundles before emitting extension
host code.

## Files webview interactions

The Files panel is a custom webview (not a native TreeView). After you select a
commit in Commits:

- **Layout:** Toggle **List**, **Tree**, or **Auto** in the view chrome. **Auto**
  uses a flat list when there are fewer than five changed paths, otherwise a
  tree. The choice persists per workspace (`gitgress.files.layout`).
- **Tree mode:** Paths are shown in compact form (empty intermediate folders are
  not expanded as separate rows).
- **Row content:** Each row shows status letters and `+N` / `−M` line counts.
  Hover shows the absolute path and human-readable status.
- **Click:** Single click selects a row (highlight only; no diff).
- **Double-click:** Opens the parent-commit diff for that path (same as
  `gitgress.openFileDiff`).
- **Open File:** Opens the file in the workspace working tree. Disabled for
  deleted paths (`D`); the host ignores open requests for deletions.

There is no search UI in the Files panel.

## Manual acceptance checklist

Run these checks in an Extension Development Host (e.g. open a repo with merge
history such as `fintech-service`):

### Commits and repository

- [ ] Merge forks are visible in the commit graph (multi-lane layout).
- [ ] Scrolling down loads more commits until no further pages remain.
- [ ] Hover overlay follows the row without layout jump and shows no avatar.
- [ ] Branch switch or refresh clears pagination and reloads from HEAD.
- [ ] Commit hover content includes the complete specified fields.
- [ ] Commits still works (graph, scroll, hover) from bundled assets.
- [ ] A non-Git workspace shows a friendly empty state.

### Files webview (architecture spec)

- [ ] `gitgress.files` is a webview; native files TreeProvider removed.
- [ ] Tree mode shows compact paths without expanding each empty segment.
- [ ] List / Tree / Auto toggle works; preference persists; auto uses threshold 5.
- [ ] Rows show `+N` / `−M` and status letters; hover shows absolute path + status text.
- [ ] Click selects; double-click opens Diff; Open File opens workspace file; `D` disables Open.
- [ ] No search UI in Files.
- [ ] Selecting a commit shows the correct changed files for that commit.
- [ ] Diff and Files still reflect first-parent changes only.

### Build

- [ ] `npm test` and webview build + compile pass (`npm run compile`).

These items require human verification in an Extension Development Host; the
automated test suite does not mark them complete.

## Originality

This implementation was independently authored for Gitgress. It does not copy
third-party extension source code, webview bundles, or proprietary assets.

## License

[MIT](LICENSE)

# Contributing to GitGress

## Development host

Requirements: Node.js, npm, Git 2.24 or newer, and a VS Code-compatible
editor supporting extension engine `^1.85.0` (including VS Code and Cursor).

1. Clone the repository and run `npm ci`.
2. Open the repository in VS Code or Cursor.
3. Press `F5` and choose **Extension Development Host** if prompted.
4. In the new window, open a workspace with at least one Git repository (try a
   monorepo with nested repos or a `.gitmodules` submodule such as
   `.superpowers`) and select **GitGress** in the Activity Bar.

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

## Tests and build

The project was developed with test-driven development. Run the complete test
suite and TypeScript compiler with:

```bash
npm test
npm run compile
```

`npm test` runs the Vitest suite once. Use `npm run test:watch` during
development. `compile` always rebuilds webview bundles before emitting extension
host code.

## Packaging (local)

```bash
npm run package
```

Produces `gitgress-1.0.0.vsix` (version from `package.json`); gitignored; install via **Extensions: Install from VSIX…**

## Publishing (manual)

The publisher must be `dybai`. Never commit tokens or credentials to the repository.

Before publishing, ensure the release is ready: version bump, `CHANGELOG.md`, icon, screenshots, and READMEs are up to date.

1. Run `npm test` && `npm run package`.
2. Smoke-test the VSIX: open a repo → **Commits** → select a commit → **Files** → open a diff.
3. Tag `v1.0.0` and create a GitHub Release on `https://github.com/dybai/gitgress-plugins`; attach the VSIX.
4. **VS Marketplace:** after `vsce` login / PAT, run `npx vsce publish --packagePath gitgress-1.0.0.vsix`.
5. **Open VSX:** run `npx ovsx publish gitgress-1.0.0.vsix -p <token>`.
6. Spot-check both marketplace listings.

## Commits history: pagination and refresh

Commits loads history in pages (`PAGE_SIZE` 100). The extension keeps a
**bidirectional sliding window** in memory instead of an unbounded append-only
list:

- At most **6 pages** (~600 commits) stay loaded at once. Scrolling toward
  older history (`loadMore`) or toward the tip (`loadNewer`) fetches one page
  at a time; when the window would exceed six pages, commits drop from the
  opposite end (the page containing the selected commit is not evicted).
- When you approach the top or bottom edge, the host **preloads one adjacent
  page** asynchronously so the next scroll feels immediate; preload failure is
  ignored.

**Manual Refresh** (`gitgress.refresh`, view title) means “show me the latest”:
it resets the window **from the tip**, keeps existing repository-index rescan
behavior, and reloads branch/history for the current repo. That can discard a
deep scroll position in long histories. Branch switch uses the same “reload from
tip” semantics.

**Auto-refresh** (Phase 2: local Git history watcher) is **not** the same as
manual Refresh. When history changes outside an explicit Refresh, the host
reconciles the current window: if the selected commit still exists, selection
(and the **Files** panel) stay unchanged; new commits above the window surface
as `hasNewer` rather than loading the entire tip into memory. Files behavior
is unchanged in Phase 1 until the watcher ships.

## Manual acceptance checklist

Run these checks in an Extension Development Host (e.g. open a repo with merge
history such as `fintech-service`):

### Multi-repository selection

- [ ] Opening a multi-root or nested-repo workspace lists every discovered repo
      in **GitGress: Select Repository** / Commits title **Select Repository**
      (including submodule paths from `.gitmodules` when present, e.g.
      `.superpowers`).
- [ ] Cached repos appear immediately; a background rescan shows the thin
      indeterminate bar at the top of Commits (no scan text) and hides it when
      idle.
- [ ] Manual repo choice persists across Extension Development Host restarts
      (`gitgress.manualRepoRoot` in workspace state).
- [ ] Sticky selection: after a manual pick, switching editors does not change
      the active repo until you select again; without a manual pick, the active
      editor’s repo is preferred.
- [ ] **Refresh** reloads history for the current repo but does not auto-switch
      to another indexed repository.

### Commits and repository

- [ ] Merge forks are visible in the commit graph (multi-lane layout).
- [ ] Scrolling toward older or newer history loads pages (sliding window, max
      6 in memory) until no further pages remain in that direction.
- [ ] Hover overlay follows the row without layout jump and shows no avatar.
- [ ] With a commit selected, Arrow/Home/End/PageUp/PageDown move selection and sync Files (no list scroll).
- [ ] Branch switch or manual **Refresh** resets the window from tip and
      reloads from HEAD (deep scroll may be lost).
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

This implementation was independently authored for GitGress. It does not copy
third-party extension source code, webview bundles, or proprietary assets.

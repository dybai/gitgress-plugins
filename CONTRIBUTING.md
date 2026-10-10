# Contributing to GitGress

## Development host

Requirements: Node.js, npm, Git 2.24 or newer, and a VS Code-compatible
editor supporting extension engine `^1.85.0` (including VS Code and Cursor).

1. Clone the repository and run `npm ci`.
2. Open the repository in VS Code or Cursor.
3. Press `F5` and choose **Extension Development Host** if prompted.
4. In the new window, open a Git repository and select **GitGress** in the
   Activity Bar.

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

## Manual acceptance checklist

Run these checks in an Extension Development Host (e.g. open a repo with merge
history such as `fintech-service`):

### Commits and repository

- [ ] Merge forks are visible in the commit graph (multi-lane layout).
- [ ] Scrolling down loads more commits until no further pages remain.
- [ ] Hover overlay follows the row without layout jump and shows no avatar.
- [ ] With a commit selected, Arrow/Home/End/PageUp/PageDown move selection and sync Files (no list scroll).
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

This implementation was independently authored for GitGress. It does not copy
third-party extension source code, webview bundles, or proprietary assets.

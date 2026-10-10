# GitGress

[中文说明](README.zh-CN.md)

GitGress is a VS Code / Cursor extension for browsing Git history as a
multi-lane commit graph (including merge forks), loading older commits with
infinite scroll, inspecting files changed by a selected commit, and opening
diffs against that commit's parent.

## Screenshots

![Commits graph](media/screenshots/commits.png)

![Changed files](media/screenshots/files.png)

## Install

### Extension marketplace

- **VS Code:** search for **GitGress** (`dybai.gitgress`) in the Extensions view,
  or install from the Visual Studio Marketplace once published.
- **Open VSX / Cursor:** search for **GitGress** or install from Open VSX once published.

### VSIX / GitHub Release

1. Download `gitgress-1.0.0.vsix` from
   [Releases](https://github.com/dybai/gitgress-plugins/releases).
2. In VS Code or Cursor, run **Extensions: Install from VSIX…** and select the file.

## Requirements

- VS Code-compatible editor with `engines.vscode` `^1.85.0` (VS Code or Cursor)
- Git **2.24** or newer on your `PATH`
- An open workspace that contains at least one Git repository (the workspace
  root does not need to be a repo; nested `.git` directories and paths listed
  in `.gitmodules` are discovered automatically)

## Features

- Multi-repository discovery with cached index, background rescan, and manual
  **Select Repository** when more than one repo is available
- Multi-lane SVG commit graph with merge topology
- Infinite-scroll history pagination
- Commit hover overlay (no avatar) that stays aligned while scrolling
- Files view for the selected commit (list / tree / auto layout)
- Parent-commit diffs from the Files view
- Keyboard selection navigation in Commits (Arrow, Home, End, PageUp, PageDown)

## Usage

1. Open a folder or multi-root workspace that contains one or more Git
   repositories.
2. Select **GitGress** in the Activity Bar.
3. When several repos are indexed, use **Select Repository** on the Commits view
   title (or run **GitGress: Select Repository** from the Command Palette) to
   choose which repo to browse. Your manual choice is remembered for the
   workspace; switching editors may follow the active file’s repo unless you
   picked a repo yourself (sticky selection).
4. Use the Commits view to browse history; hover a row for details; click to
   select. While repositories are being rescanned, a thin indeterminate bar may
   appear at the top of Commits (no status text).
5. Inspect changed paths in Files; double-click a path (or use Open Diff) for
   the parent diff.
6. Use the view title actions to switch branch or refresh. Refresh reloads the
   current repo and branch but does not change which repository is selected.

### Files view notes

- Layout cycles **Auto → List → Tree → Auto** and persists per workspace
  (`gitgress.files.layout`).
- **Auto** uses a flat list when there are five or fewer changed paths, otherwise a tree.
- Single click selects a row; double-click opens the parent-commit diff.
- **Open File** opens the workspace working-tree file (disabled for deletions).

## Develop from source

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)

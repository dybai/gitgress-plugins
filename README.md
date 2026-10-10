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
- An open workspace folder that is a Git repository

## Features

- Multi-lane SVG commit graph with merge topology
- Infinite-scroll history pagination
- Commit hover overlay (no avatar) that stays aligned while scrolling
- Files view for the selected commit (list / tree / auto layout)
- Parent-commit diffs from the Files view
- Keyboard selection navigation in Commits (Arrow, Home, End, PageUp, PageDown)

## Usage

1. Open a Git repository folder.
2. Select **GitGress** in the Activity Bar.
3. Use the Commits view to browse history; hover a row for details; click to
   select.
4. Inspect changed paths in Files; double-click a path (or use Open Diff) for
   the parent diff.
5. Use the view title actions to switch branch or refresh (both reset pagination).

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

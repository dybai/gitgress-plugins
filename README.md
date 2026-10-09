# Gitgress

Gitgress is a VS Code/Cursor extension for browsing a repository's linear commit
history, inspecting the files changed by a selected commit, and opening diffs
against that commit's parent.

## Install and run

Requirements: Node.js, npm, Git, and VS Code or Cursor 1.85+.

1. Clone the repository and run `npm ci`.
2. Open the repository in VS Code or Cursor.
3. Press `F5` and choose **Extension Development Host** if prompted.
4. In the new window, open a Git repository and select **Gitgress** in the
   Activity Bar.

The Commits view displays the selected branch's history. Use the branch and
refresh buttons in the view title. Selecting a commit populates the Files view.

## Architecture

```text
VS Code extension host
  └─ extension.ts (composition root and commands)
      ├─ GitService ── runGit ── local Git CLI
      ├─ SelectionState (repository, branch, selected commit)
      ├─ CommitsViewProvider ── typed messages ── webview
      ├─ ChangedFilesTreeProvider ── VS Code TreeView
      └─ DiffService + GitgressContentProvider ── VS Code diff editor
```

The Git layer has no UI dependencies. Shared selection state coordinates the
Commits webview and Files TreeView; providers translate state and Git results
into their respective VS Code UI models.

## Development and tests

The project was developed with test-driven development. Run the complete test
suite and TypeScript compiler with:

```bash
npm test
npm run compile
```

`npm test` runs the Vitest suite once. Use `npm run test:watch` during
development.

## TreeView click behavior

The product specification describes opening a parent-commit diff on
double-click. VS Code's TreeView API does not expose a reliable double-click
event for tree items; an item's command is invoked by a normal activation
(typically a single click). Gitgress therefore opens the diff when a file leaf
is activated. Folder nodes only expand or collapse.

## Manual acceptance checklist

Run these checks in an Extension Development Host:

- [ ] A Git workspace shows linear commits and the graph line.
- [ ] Commit hover content includes the complete specified fields.
- [ ] The branch Quick Pick switches the displayed branch and refreshes views.
- [ ] Selecting a commit shows the correct changed-file tree.
- [ ] Activating a file leaf opens its diff against the commit's parent
      (single-click TreeView adaptation noted above).
- [ ] A non-Git workspace shows a friendly empty state.

These items require human verification in an Extension Development Host; the
automated test suite does not mark them complete.

## Originality

This implementation was independently authored for Gitgress. It does not copy
third-party extension source code, webview bundles, or proprietary assets.

## License

[MIT](LICENSE)

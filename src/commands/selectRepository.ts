import path from 'node:path';
import type * as vscode from 'vscode';
import { findOwningRepoRoot, normalizeRepoPath } from '../repoIndex/pathNormalize.js';
import { repoShortName } from '../views/commits/repoShortName.js';

type RepoQuickPickItem = vscode.QuickPickItem & { repoRoot: string };

function repoPickLabel(
  repoRoot: string,
  workspaceFolderPaths: readonly string[],
  roots: readonly string[],
): string {
  const normalizedRepo = normalizeRepoPath(repoRoot);
  const owningFolder = findOwningRepoRoot(normalizedRepo, workspaceFolderPaths);
  if (owningFolder === null) {
    return repoRoot;
  }
  const rel = path.relative(owningFolder, normalizedRepo).replace(/\\/g, '/');
  return rel === '' ? repoShortName(repoRoot, roots) : rel;
}

export async function selectRepository(options: {
  roots: readonly string[];
  currentRepoRoot: string | null;
  workspaceFolderPaths: readonly string[];
  showQuickPick: typeof vscode.window.showQuickPick;
  selectManually: (repoRoot: string) => void;
}): Promise<void> {
  const {
    roots,
    currentRepoRoot,
    workspaceFolderPaths,
    showQuickPick,
    selectManually,
  } = options;

  if (roots.length === 0) {
    return;
  }

  const normalizedCurrent =
    currentRepoRoot === null ? null : normalizeRepoPath(currentRepoRoot);

  const items: RepoQuickPickItem[] = roots.map((root) => {
    const normalized = normalizeRepoPath(root);
    return {
      label: repoPickLabel(root, workspaceFolderPaths, roots),
      description:
        normalizedCurrent !== null && normalized === normalizedCurrent
          ? 'Current repository'
          : undefined,
      repoRoot: root,
    };
  });

  const selected = (await showQuickPick(items, {
    placeHolder: 'Select a repository',
  })) as RepoQuickPickItem | undefined;

  if (selected !== undefined) {
    selectManually(selected.repoRoot);
  }
}

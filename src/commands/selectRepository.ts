import path from 'node:path';
import type * as vscode from 'vscode';
import { findOwningRepoRoot, normalizeRepoPath } from '../repoIndex/pathNormalize.js';
import { showQuickPickActive } from '../ui/showQuickPickActive.js';
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
  createQuickPick: typeof vscode.window.createQuickPick;
  createCheckIcon: () => vscode.ThemeIcon;
  createBlankIcon: () => vscode.ThemeIcon;
  selectManually: (repoRoot: string) => void;
}): Promise<void> {
  const {
    roots,
    currentRepoRoot,
    workspaceFolderPaths,
    createQuickPick,
    createCheckIcon,
    createBlankIcon,
    selectManually,
  } = options;

  if (roots.length === 0) {
    return;
  }

  const normalizedCurrent =
    currentRepoRoot === null ? null : normalizeRepoPath(currentRepoRoot);

  const items: RepoQuickPickItem[] = roots.map((root) => {
    const normalized = normalizeRepoPath(root);
    const isCurrent = normalizedCurrent !== null && normalized === normalizedCurrent;
    return {
      label: repoPickLabel(root, workspaceFolderPaths, roots),
      description: isCurrent ? '[Current repository]' : undefined,
      iconPath: isCurrent ? createCheckIcon() : createBlankIcon(),
      repoRoot: root,
    };
  });

  const activeItem =
    normalizedCurrent === null
      ? undefined
      : items.find((item) => normalizeRepoPath(item.repoRoot) === normalizedCurrent);
  const selected = await showQuickPickActive({
    createQuickPick,
    items,
    placeHolder: 'Select a repository',
    activeItem,
  });

  if (selected !== undefined) {
    selectManually(selected.repoRoot);
  }
}

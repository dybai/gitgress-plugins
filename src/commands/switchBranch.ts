import type * as vscode from 'vscode';
import type { GitService } from '../git/GitService';
import type { SelectionState } from '../state/SelectionState';
import { showQuickPickActive } from '../ui/showQuickPickActive.js';

export async function pickBranch(
  branches: string[],
  current: string | null,
  createQuickPick: typeof vscode.window.createQuickPick,
  createCheckIcon: () => vscode.ThemeIcon,
  createBlankIcon: () => vscode.ThemeIcon,
): Promise<string | undefined> {
  const items: vscode.QuickPickItem[] = branches.map((branch) => ({
    label: branch,
    description: branch === current ? '[ Current branch ]' : undefined,
    iconPath: branch === current ? createCheckIcon() : createBlankIcon(),
  }));
  const activeItem = items.find((item) => item.label === current);
  const selected = await showQuickPickActive({
    createQuickPick,
    items,
    placeHolder: 'Select a branch',
    activeItem,
  });
  return selected?.label;
}

export async function switchBranch(
  gitService: Pick<GitService, 'listBranches'>,
  selection: Pick<SelectionState, 'getSnapshot' | 'setBranch'>,
  createQuickPick: typeof vscode.window.createQuickPick,
  createCheckIcon: () => vscode.ThemeIcon,
  createBlankIcon: () => vscode.ThemeIcon,
): Promise<void> {
  const { repoRoot, branch } = selection.getSnapshot();
  if (repoRoot === null) {
    return;
  }

  const branches = await gitService.listBranches(repoRoot);
  const selected = await pickBranch(
    branches,
    branch,
    createQuickPick,
    createCheckIcon,
    createBlankIcon,
  );
  if (selected !== undefined && selected !== branch) {
    selection.setBranch(selected);
  }
}

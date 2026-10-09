import type * as vscode from 'vscode';
import type { GitService } from '../git/GitService';
import type { SelectionState } from '../state/SelectionState';

export async function pickBranch(
  branches: string[],
  current: string | null,
  showQuickPick: typeof vscode.window.showQuickPick,
): Promise<string | undefined> {
  const items: vscode.QuickPickItem[] = branches.map((branch) => ({
    label: branch,
    description: branch === current ? 'Current branch' : undefined,
  }));
  const selected = await showQuickPick(items, {
    placeHolder: 'Select a branch',
  });
  return selected?.label;
}

export async function switchBranch(
  gitService: Pick<GitService, 'listBranches'>,
  selection: Pick<SelectionState, 'getSnapshot' | 'setBranch'>,
  showQuickPick: typeof vscode.window.showQuickPick,
): Promise<void> {
  const { repoRoot, branch } = selection.getSnapshot();
  if (repoRoot === null) {
    return;
  }

  const branches = await gitService.listBranches(repoRoot);
  const selected = await pickBranch(branches, branch, showQuickPick);
  if (selected !== undefined && selected !== branch) {
    selection.setBranch(selected);
  }
}

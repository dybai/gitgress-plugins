import type * as vscode from 'vscode';
import { refreshRepository } from './refresh';
import type { GitService } from '../git/GitService';
import type { SelectionState } from '../state/SelectionState';

type WorkspaceFolder = Pick<vscode.WorkspaceFolder, 'uri'>;

export type ReloadHandlersDeps = {
  gitService: Pick<GitService, 'resolveRepo' | 'currentBranch' | 'listBranches'>;
  selection: Pick<SelectionState, 'getSnapshot' | 'setRepo' | 'setBranch'>;
  workspaceFolders: readonly WorkspaceFolder[];
  filesProvider: { refresh(): void };
  commitsProvider: { refresh(): void };
};

/** Refresh repo/branch state and the files tree; does not force commits webview reload. */
export async function reloadRepositoryState(deps: ReloadHandlersDeps): Promise<void> {
  await refreshRepository(deps.gitService, deps.selection, deps.workspaceFolders);
  deps.filesProvider.refresh();
}

/** Manual Gitgress refresh: sync repository state then reload commits even when branch unchanged. */
export async function explicitRefreshGitgress(deps: ReloadHandlersDeps): Promise<void> {
  await reloadRepositoryState(deps);
  deps.commitsProvider.refresh();
}

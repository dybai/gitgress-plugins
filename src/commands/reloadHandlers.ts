import { refreshRepository } from './refresh';
import type { GitService } from '../git/GitService';
import type { SelectionState } from '../state/SelectionState';

export type ReloadHandlersDeps = {
  gitService: Pick<GitService, 'currentBranch' | 'listBranches'>;
  selection: Pick<SelectionState, 'getSnapshot' | 'setBranch'>;
  filesProvider: { refresh(): void };
  commitsProvider: { refresh(): void };
  repoIndex: { startScan(): void };
  coordinator: {
    resolveInitial(): void;
    onIndexUpdated(): void;
    clearReSelectSuppression(): void;
  };
};

/**
 * Workspace layout changed: restart the repo index scan, re-resolve the
 * selection through the coordinator, ensure the branch, and refresh files.
 * Does not force a commits webview reload.
 */
export async function reloadRepositoryState(deps: ReloadHandlersDeps): Promise<void> {
  deps.repoIndex.startScan();
  deps.coordinator.clearReSelectSuppression();
  deps.coordinator.resolveInitial();
  await refreshRepository(deps.gitService, deps.selection);
  deps.filesProvider.refresh();
}

/**
 * Manual Gitgress refresh: rescan for repositories, ensure the branch for the
 * current (sticky) selection, then reload files and commits even when the
 * branch is unchanged.
 */
export async function explicitRefreshGitgress(deps: ReloadHandlersDeps): Promise<void> {
  deps.repoIndex.startScan();
  await refreshRepository(deps.gitService, deps.selection);
  deps.filesProvider.refresh();
  deps.commitsProvider.refresh();
}

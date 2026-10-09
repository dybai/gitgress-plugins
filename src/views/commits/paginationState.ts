import type { CommitSummary, GitService } from '../../git/GitService';
import type { SelectionState } from '../../state/SelectionState';

export type CommitPaginationState = {
  loaded: CommitSummary[];
  hasMore: boolean;
  loadingMore: boolean;
};

export function createPaginationState(): CommitPaginationState {
  return { loaded: [], hasMore: false, loadingMore: false };
}

export function replacePage(
  _state: CommitPaginationState,
  batch: CommitSummary[],
  pageSize: number,
): CommitPaginationState {
  return {
    loaded: batch,
    hasMore: batch.length === pageSize,
    loadingMore: false,
  };
}

export function beginLoadMore(
  state: CommitPaginationState,
): CommitPaginationState | null {
  if (!state.hasMore || state.loadingMore) {
    return null;
  }
  return { ...state, loadingMore: true };
}

export function appendPage(
  state: CommitPaginationState,
  batch: CommitSummary[],
  pageSize: number,
): CommitPaginationState {
  return {
    loaded: [...state.loaded, ...batch],
    hasMore: batch.length === pageSize,
    loadingMore: false,
  };
}

export function failLoadMore(state: CommitPaginationState): CommitPaginationState {
  return { ...state, loadingMore: false };
}

export async function loadCommitPage(
  gitService: Pick<GitService, 'log'>,
  selection: Pick<SelectionState, 'getSnapshot'>,
  repoRoot: string,
  branch: string,
  pageSize: number,
  offset: number,
): Promise<{ batch: CommitSummary[]; selectedCommitId: string | null }> {
  const batch = await gitService.log(repoRoot, branch, pageSize, offset);
  return {
    batch,
    selectedCommitId: selection.getSnapshot().selectedCommitId,
  };
}

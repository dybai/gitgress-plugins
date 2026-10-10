import { GitCommandFailedError, GitNotFoundError } from '../git/errors';
import type { GitService } from '../git/GitService';
import type { SelectionState } from '../state/SelectionState';

export function gitErrorMessage(error: unknown): string {
  if (error instanceof GitNotFoundError) {
    return `Gitgress: ${error.message}`;
  }
  if (error instanceof GitCommandFailedError) {
    const detail = error.stderr.trim() || error.message;
    return `Gitgress: ${detail}`;
  }
  if (error instanceof Error) {
    return `Gitgress: ${error.message}`;
  }
  return 'Gitgress: An unexpected error occurred';
}

/**
 * Ensure the display branch is valid for the currently selected repository.
 * Never picks a repository: selection of the repo is owned by SelectionCoordinator.
 *
 * The selected repository can change while Git is being queried. Results (and
 * errors) belonging to a repository that is no longer selected are discarded
 * so they can never be applied to, or clear, the newer selection.
 */
export async function refreshRepository(
  gitService: Pick<GitService, 'currentBranch' | 'listBranches'>,
  selection: Pick<SelectionState, 'getSnapshot' | 'setBranch'>,
): Promise<void> {
  const { repoRoot } = selection.getSnapshot();
  if (repoRoot === null) {
    return;
  }
  const isStale = (): boolean => selection.getSnapshot().repoRoot !== repoRoot;

  try {
    const currentBranch = (await gitService.currentBranch(repoRoot)) || 'HEAD';
    if (isStale()) {
      return;
    }
    const { branch } = selection.getSnapshot();
    if (branch === null) {
      selection.setBranch(currentBranch);
      return;
    }

    const branches = await gitService.listBranches(repoRoot);
    if (isStale()) {
      return;
    }
    // The display branch may have changed while branches were listed.
    const latestBranch = selection.getSnapshot().branch;
    if (
      latestBranch !== null &&
      latestBranch !== 'HEAD' &&
      !branches.includes(latestBranch)
    ) {
      selection.setBranch(currentBranch);
    }
  } catch (error) {
    if (isStale()) {
      return;
    }
    throw error;
  }
}

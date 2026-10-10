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
 */
export async function refreshRepository(
  gitService: Pick<GitService, 'currentBranch' | 'listBranches'>,
  selection: Pick<SelectionState, 'getSnapshot' | 'setBranch'>,
): Promise<void> {
  const { repoRoot } = selection.getSnapshot();
  if (repoRoot === null) {
    return;
  }

  const currentBranch = (await gitService.currentBranch(repoRoot)) || 'HEAD';
  const { branch } = selection.getSnapshot();
  if (branch === null) {
    selection.setBranch(currentBranch);
    return;
  }

  const branches = await gitService.listBranches(repoRoot);
  if (branch !== 'HEAD' && !branches.includes(branch)) {
    selection.setBranch(currentBranch);
  }
}

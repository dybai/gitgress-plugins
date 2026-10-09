import type * as vscode from 'vscode';
import { GitCommandFailedError, GitNotFoundError } from '../git/errors';
import type { GitService } from '../git/GitService';
import type { SelectionState } from '../state/SelectionState';

type WorkspaceFolder = Pick<vscode.WorkspaceFolder, 'uri'>;

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

export async function refreshRepository(
  gitService: Pick<GitService, 'resolveRepo' | 'currentBranch'>,
  selection: Pick<SelectionState, 'getSnapshot' | 'setRepo' | 'setBranch'>,
  workspaceFolders: readonly WorkspaceFolder[],
): Promise<void> {
  const repoRoot = await gitService.resolveRepo(
    workspaceFolders.map((folder) => folder.uri.fsPath),
  );
  selection.setRepo(repoRoot);
  if (repoRoot === null) {
    return;
  }

  const currentBranch = (await gitService.currentBranch(repoRoot)) || null;
  if (selection.getSnapshot().branch !== currentBranch) {
    selection.setBranch(currentBranch);
  }
}

import * as vscode from 'vscode';
import type { DiffService } from '../diff/DiffService';
import type { SelectionState } from '../state/SelectionState';
import type { FileTreeNode } from '../views/files/buildFileTree';
import type { DiffTarget } from './diffTarget';

export async function openFileDiffByPath(
  selection: Pick<SelectionState, 'getSnapshot'>,
  diffService: Pick<DiffService, 'open'>,
  target: DiffTarget,
): Promise<void> {
  const { repoRoot, selectedCommitId } = selection.getSnapshot();
  if (repoRoot === null || selectedCommitId === null) {
    return;
  }

  await diffService.open(
    repoRoot,
    selectedCommitId,
    `${selectedCommitId}^`,
    target.path,
    target.status,
  );
}

export function registerOpenFileDiff(
  selection: SelectionState,
  diffService: DiffService,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'gitgress.openFileDiff',
    async (arg?: FileTreeNode | DiffTarget): Promise<void> => {
      const target =
        arg === undefined
          ? undefined
          : 'kind' in arg
            ? arg.kind === 'file' && arg.status !== undefined
              ? { path: arg.path, status: arg.status }
              : undefined
            : arg;
      if (target === undefined) {
        return;
      }
      await openFileDiffByPath(selection, diffService, target);
    },
  );
}

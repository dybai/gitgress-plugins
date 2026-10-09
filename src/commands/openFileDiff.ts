import * as vscode from 'vscode';
import type { DiffService } from '../diff/DiffService';
import type { SelectionState } from '../state/SelectionState';
import type { FileTreeNode } from '../views/files/buildFileTree';

export function registerOpenFileDiff(
  selection: SelectionState,
  diffService: DiffService,
): vscode.Disposable {
  return vscode.commands.registerCommand(
    'gitgress.openFileDiff',
    async (node?: FileTreeNode): Promise<void> => {
      if (node === undefined || node.kind !== 'file' || node.status === undefined) {
        return;
      }

      const { repoRoot, selectedCommitId } = selection.getSnapshot();
      if (repoRoot === null || selectedCommitId === null) {
        return;
      }

      await diffService.open(
        repoRoot,
        selectedCommitId,
        `${selectedCommitId}^`,
        node.path,
        node.status,
      );
    },
  );
}

import type { ChangedFile } from '../../git/GitService';
import { buildFileTree, type FileTreeNode } from './buildFileTree';

export type FilesViewModel =
  | { mode: 'empty'; message: string }
  | { mode: 'error'; message: string }
  | { mode: 'tree'; tree: FileTreeNode[] };

export function filesViewModel(
  commitId: string | null,
  files: ChangedFile[] | null,
  error?: string,
): FilesViewModel {
  if (commitId === null) {
    return { mode: 'empty', message: 'Select a commit' };
  }
  if (error !== undefined) {
    return { mode: 'error', message: error };
  }
  return { mode: 'tree', tree: buildFileTree(files ?? []) };
}

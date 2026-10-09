import type { ChangedFile } from '../../git/GitService';

export type FilesViewModel =
  | { mode: 'empty'; message: string }
  | { mode: 'error'; message: string }
  | { mode: 'loaded'; files: ChangedFile[] };

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
  return { mode: 'loaded', files: files ?? [] };
}

import type { ChangedFile } from '../../git/GitService';
import type { HostToFilesWebview } from '../../protocol/filesMessages';
import {
  resolveFilesLayout,
  type FilesLayoutPreference,
} from './resolveFilesLayout';

export type FilesLoadTarget = {
  repoRoot: string | null;
  commitId: string | null;
};

export function buildFilesMessage(
  target: FilesLoadTarget,
  files: ChangedFile[] | null,
  preference: FilesLayoutPreference,
  error?: string,
): HostToFilesWebview {
  const { repoRoot, commitId } = target;
  if (repoRoot === null || commitId === null) {
    return { type: 'filesEmpty', reason: 'noCommit', message: 'Select a commit' };
  }
  if (error !== undefined) {
    return { type: 'filesError', message: error };
  }
  const list = files ?? [];
  if (list.length === 0) {
    return { type: 'filesEmpty', reason: 'noFiles', message: 'No changed files' };
  }
  return {
    type: 'filesLoaded',
    commitId,
    repoRoot,
    files: list.map((file) => ({
      path: file.path,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      ...(file.oldPath === undefined ? {} : { oldPath: file.oldPath }),
    })),
    layoutPreference: preference,
    effectiveLayout: resolveFilesLayout(preference, list.length),
  };
}

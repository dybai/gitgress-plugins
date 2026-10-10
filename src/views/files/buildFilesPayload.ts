import type { ChangedFile } from '../../git/GitService';
import type { FilesIconsPayload, HostToFilesWebview } from '../../protocol/filesMessages';
import {
  CODICON_FILE,
  CODICON_FOLDER,
  CODICON_FOLDER_OPEN,
} from './codiconFileIcons';
import {
  resolveFilesLayout,
  type FilesLayoutPreference,
} from './resolveFilesLayout';

export function codiconOnlyIcons(paths: readonly string[]): FilesIconsPayload {
  const fileIcons: FilesIconsPayload['files'] = {};
  for (const path of paths) {
    fileIcons[path] = CODICON_FILE;
  }
  return {
    files: fileIcons,
    folder: CODICON_FOLDER,
    folderOpen: CODICON_FOLDER_OPEN,
    fonts: [],
  };
}

export type FilesLoadTarget = {
  repoRoot: string | null;
  commitId: string | null;
};

export function buildFilesMessage(
  target: FilesLoadTarget,
  files: ChangedFile[] | null,
  preference: FilesLayoutPreference,
  icons: FilesIconsPayload | undefined,
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
  const paths = list.map((file) => file.path);
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
    icons: icons ?? codiconOnlyIcons(paths),
  };
}

import * as vscode from 'vscode';

export const GITGRESS_SCHEME = 'gitgress';
export const EMPTY_REVISION = '__empty__';

export type GitgressUriData = {
  repoRoot: string;
  revision: string;
  filePath: string;
};

export function encodeGitgressUri(
  repoRoot: string,
  revision: string,
  filePath: string,
): vscode.Uri {
  const query = `repoRoot=${encodeURIComponent(repoRoot)}&revision=${encodeURIComponent(revision)}`;
  return vscode.Uri.from({
    scheme: GITGRESS_SCHEME,
    path: `/${filePath}`,
    query,
  });
}

export function decodeGitgressUri(uri: vscode.Uri): GitgressUriData {
  const query = new URLSearchParams(uri.query);
  return {
    repoRoot: query.get('repoRoot') ?? '',
    revision: query.get('revision') ?? '',
    filePath: uri.path.startsWith('/') ? uri.path.slice(1) : uri.path,
  };
}

export function resolveDiffRevisions(
  commitId: string,
  parentId: string | null,
  status: string,
): { left: string; right: string } {
  return {
    left: parentId === null || status === 'A' ? EMPTY_REVISION : parentId,
    right: status === 'D' ? EMPTY_REVISION : commitId,
  };
}

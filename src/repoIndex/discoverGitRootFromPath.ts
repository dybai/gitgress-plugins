import { normalizeRepoPath } from './pathNormalize.js';

/**
 * Walk ancestors of a file path looking for a `.git` file or directory.
 * Does not require the repo to already be in the workspace index — used so an
 * open editor can select its owning repo before (or without) a completed scan.
 */
export function discoverGitRootFromPath(
  filePath: string,
  exists: (path: string) => boolean,
): string | null {
  let dir = normalizeRepoPath(filePath);
  const cut = dir.lastIndexOf('/');
  if (cut <= 0) {
    return null;
  }
  dir = dir.slice(0, cut);

  for (;;) {
    if (exists(`${dir}/.git`)) {
      return dir;
    }
    const parentCut = dir.lastIndexOf('/');
    if (parentCut <= 0) {
      return null;
    }
    const parent = dir.slice(0, parentCut);
    if (parent === '' || parent === dir) {
      return null;
    }
    dir = parent;
  }
}

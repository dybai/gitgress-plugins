import path from 'node:path';
import { normalizeRepoPath } from '../repoIndex/pathNormalize.js';

const GITDIR_PREFIX = 'gitdir: ';

export type GitDirectoryLayout = {
  gitDir: string;
  commonDir: string;
};

/**
 * Resolve the worktree-local gitdir and shared Git common directory.
 * - If `.git` is a directory → both paths are `.git`
 * - If `.git` is a file → resolve its gitdir and optional commondir pointer
 * - Else null
 */
export function resolveGitDir(
  repoRoot: string,
  io: {
    exists: (p: string) => boolean;
    isDirectory: (p: string) => boolean;
    readFile: (p: string) => string;
  },
): GitDirectoryLayout | null {
  const gitPath = normalizeRepoPath(path.join(repoRoot, '.git'));
  if (!io.exists(gitPath)) {
    return null;
  }
  if (io.isDirectory(gitPath)) {
    return { gitDir: gitPath, commonDir: gitPath };
  }

  const firstLine = io.readFile(gitPath).split(/\r?\n/)[0]?.trim() ?? '';
  if (!firstLine.startsWith(GITDIR_PREFIX)) {
    return null;
  }

  const raw = firstLine.slice(GITDIR_PREFIX.length).trim();
  if (!raw) {
    return null;
  }

  const resolved = path.isAbsolute(raw) ? raw : path.resolve(repoRoot, raw);
  const gitDir = normalizeRepoPath(resolved);
  const commonDirFile = normalizeRepoPath(path.join(gitDir, 'commondir'));
  if (io.exists(commonDirFile)) {
    const rawCommonDir = io.readFile(commonDirFile).split(/\r?\n/)[0]?.trim() ?? '';
    if (rawCommonDir) {
      const resolvedCommonDir = path.isAbsolute(rawCommonDir)
        ? rawCommonDir
        : path.resolve(gitDir, rawCommonDir);
      return {
        gitDir,
        commonDir: normalizeRepoPath(resolvedCommonDir),
      };
    }
  }

  const worktreesDir = path.dirname(gitDir);
  const commonDir =
    path.basename(worktreesDir).toLowerCase() === 'worktrees'
      ? path.dirname(worktreesDir)
      : gitDir;
  return { gitDir, commonDir: normalizeRepoPath(commonDir) };
}

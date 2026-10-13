import path from 'node:path';
import { normalizeRepoPath } from '../repoIndex/pathNormalize.js';

const GITDIR_PREFIX = 'gitdir: ';

/**
 * Resolve gitdir for a repo root.
 * - If `.git` is a directory → return that path
 * - If `.git` is a file starting with `gitdir: ` → return absolute resolved path
 * - Else null
 */
export function resolveGitDir(
  repoRoot: string,
  io: {
    exists: (p: string) => boolean;
    isDirectory: (p: string) => boolean;
    readFile: (p: string) => string;
  },
): string | null {
  const gitPath = normalizeRepoPath(path.join(repoRoot, '.git'));
  if (!io.exists(gitPath)) {
    return null;
  }
  if (io.isDirectory(gitPath)) {
    return gitPath;
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
  return normalizeRepoPath(resolved);
}

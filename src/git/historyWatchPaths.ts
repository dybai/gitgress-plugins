import type { GitDirectoryLayout } from './resolveGitDir.js';

export type GitHistoryWatchPath = {
  base: string;
  pattern: 'HEAD' | 'packed-refs' | 'refs/heads/**' | 'refs/remotes/**';
};

export function gitHistoryWatchPaths(
  layout: GitDirectoryLayout,
): GitHistoryWatchPath[] {
  return [
    { base: layout.gitDir, pattern: 'HEAD' },
    { base: layout.commonDir, pattern: 'packed-refs' },
    { base: layout.commonDir, pattern: 'refs/heads/**' },
    { base: layout.commonDir, pattern: 'refs/remotes/**' },
  ];
}

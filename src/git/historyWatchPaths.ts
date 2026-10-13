import type { GitDirectoryLayout } from './resolveGitDir.js';

export type GitHistoryWatchPath = {
  base: string;
  pattern: 'HEAD' | 'packed-refs' | 'refs/heads/**';
};

export function gitHistoryWatchPaths(
  layout: GitDirectoryLayout,
): GitHistoryWatchPath[] {
  return [
    { base: layout.gitDir, pattern: 'HEAD' },
    { base: layout.commonDir, pattern: 'packed-refs' },
    { base: layout.commonDir, pattern: 'refs/heads/**' },
  ];
}

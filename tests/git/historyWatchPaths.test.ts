import { describe, expect, it } from 'vitest';
import { gitHistoryWatchPaths } from '../../src/git/historyWatchPaths.js';

describe('gitHistoryWatchPaths', () => {
  it('watches HEAD locally and shared refs in the common directory', () => {
    expect(
      gitHistoryWatchPaths({
        gitDir: 'd:/main/.git/worktrees/feature',
        commonDir: 'd:/main/.git',
      }),
    ).toEqual([
      { base: 'd:/main/.git/worktrees/feature', pattern: 'HEAD' },
      { base: 'd:/main/.git', pattern: 'packed-refs' },
      { base: 'd:/main/.git', pattern: 'refs/heads/**' },
      { base: 'd:/main/.git', pattern: 'refs/remotes/**' },
    ]);
  });
});

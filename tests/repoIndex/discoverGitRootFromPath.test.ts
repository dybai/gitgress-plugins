import { describe, expect, it } from 'vitest';
import { discoverGitRootFromPath } from '../../src/repoIndex/discoverGitRootFromPath.js';

describe('discoverGitRootFromPath', () => {
  it('returns the deepest git root containing the file', () => {
    const exists = (p: string) =>
      p === 'd:/ws/fintech-service/.git' ||
      p === 'd:/ws/fintech-service/.superpowers/.git';

    expect(
      discoverGitRootFromPath(
        'd:/ws/fintech-service/.superpowers/specs/design.md',
        exists,
      ),
    ).toBe('d:/ws/fintech-service/.superpowers');
  });

  it('returns the nested service repo when the workspace root is not a git repo', () => {
    const exists = (p: string) => p === 'd:/ws/fintech/fintech-service/.git';

    expect(
      discoverGitRootFromPath(
        'd:/ws/fintech/fintech-service/src/Main.java',
        exists,
      ),
    ).toBe('d:/ws/fintech/fintech-service');
  });

  it('returns null when no ancestor has a .git entry', () => {
    expect(discoverGitRootFromPath('d:/ws/fintech/readme.md', () => false)).toBeNull();
  });
});

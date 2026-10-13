import { describe, expect, it } from 'vitest';
import { resolveGitDir } from '../../src/git/resolveGitDir.js';

describe('resolveGitDir', () => {
  it('returns the .git directory when .git is a directory', () => {
    const gitPath = 'd:/ws/my-repo/.git';
    const io = {
      exists: (p: string) => p === gitPath,
      isDirectory: (p: string) => p === gitPath,
      readFile: () => {
        throw new Error('readFile should not be called');
      },
    };

    expect(resolveGitDir('d:/ws/my-repo', io)).toBe(gitPath);
  });

  it('resolves an absolute gitdir pointer from a .git file', () => {
    const gitFile = 'd:/ws/worktree/.git';
    const realGitDir = 'D:/main/.git/worktrees/feature';
    const io = {
      exists: (p: string) => p === gitFile,
      isDirectory: () => false,
      readFile: (p: string) => {
        expect(p).toBe(gitFile);
        return `gitdir: ${realGitDir}\n`;
      },
    };

    expect(resolveGitDir('d:/ws/worktree', io)).toBe(
      'd:/main/.git/worktrees/feature',
    );
  });

  it('resolves a relative gitdir pointer against the repo root', () => {
    const gitFile = 'd:/ws/nested/sub/.git';
    const io = {
      exists: (p: string) => p === gitFile,
      isDirectory: () => false,
      readFile: () => 'gitdir: ../../.git/modules/sub\n',
    };

    expect(resolveGitDir('d:/ws/nested/sub', io)).toBe('d:/ws/.git/modules/sub');
  });

  it('returns null when .git is missing', () => {
    expect(
      resolveGitDir('d:/ws/empty', {
        exists: () => false,
        isDirectory: () => false,
        readFile: () => '',
      }),
    ).toBeNull();
  });

  it('returns null when .git file does not start with gitdir:', () => {
    const gitFile = 'd:/ws/bad/.git';
    expect(
      resolveGitDir('d:/ws/bad', {
        exists: (p) => p === gitFile,
        isDirectory: () => false,
        readFile: () => 'not a gitdir file\n',
      }),
    ).toBeNull();
  });
});

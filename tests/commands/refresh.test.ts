import { describe, expect, it, vi } from 'vitest';
import { gitErrorMessage, refreshRepository } from '../../src/commands/refresh';
import { GitCommandFailedError, GitNotFoundError } from '../../src/git/errors';
import { SelectionState } from '../../src/state/SelectionState';

function makeSelection(snapshot: {
  repoRoot: string | null;
  branch: string | null;
  selectedCommitId?: string | null;
}) {
  return {
    getSnapshot: vi.fn(() => ({ selectedCommitId: null, ...snapshot })),
    setRepo: vi.fn(),
    setBranch: vi.fn(),
  };
}

describe('refreshRepository', () => {
  it('is a no-op when no repository is selected', async () => {
    const gitService = {
      currentBranch: vi.fn(),
      listBranches: vi.fn(),
    };
    const selection = makeSelection({ repoRoot: null, branch: null });

    await refreshRepository(gitService, selection);

    expect(gitService.currentBranch).not.toHaveBeenCalled();
    expect(gitService.listBranches).not.toHaveBeenCalled();
    expect(selection.setRepo).not.toHaveBeenCalled();
    expect(selection.setBranch).not.toHaveBeenCalled();
  });

  it('never chooses a repository itself (no resolveRepo / setRepo)', async () => {
    const gitService = {
      resolveRepo: vi.fn(async () => '/other'),
      currentBranch: vi.fn(async () => 'main'),
      listBranches: vi.fn(async () => ['main']),
    };
    const selection = makeSelection({ repoRoot: '/repo', branch: null });

    await refreshRepository(gitService, selection);

    expect(gitService.resolveRepo).not.toHaveBeenCalled();
    expect(selection.setRepo).not.toHaveBeenCalled();
    expect(gitService.currentBranch).toHaveBeenCalledWith('/repo');
  });

  it('initializes the current branch for the selected repo', async () => {
    const gitService = {
      currentBranch: vi.fn(async () => 'main'),
      listBranches: vi.fn(async () => ['main']),
    };
    const selection = makeSelection({ repoRoot: '/repo', branch: null });

    await refreshRepository(gitService, selection);

    expect(selection.setBranch).toHaveBeenCalledWith('main');
    expect(selection.setRepo).not.toHaveBeenCalled();
  });

  it('does not reset display branch when HEAD differs after switchBranch', async () => {
    const gitService = {
      currentBranch: vi.fn(async () => 'main'),
      listBranches: vi.fn(async () => ['main', 'feature']),
    };
    const selection = makeSelection({ repoRoot: '/repo', branch: 'feature' });

    await refreshRepository(gitService, selection);

    expect(selection.setBranch).not.toHaveBeenCalled();
  });

  it('falls back to HEAD branch when the display branch no longer exists', async () => {
    const gitService = {
      currentBranch: vi.fn(async () => 'main'),
      listBranches: vi.fn(async () => ['main']),
    };
    const selection = makeSelection({ repoRoot: '/repo', branch: 'deleted-feature' });

    await refreshRepository(gitService, selection);

    expect(selection.setBranch).toHaveBeenCalledWith('main');
  });

  it('uses HEAD as the detached-HEAD display branch', async () => {
    const gitService = {
      currentBranch: vi.fn(async () => ''),
      listBranches: vi.fn(async () => ['main']),
    };
    const selection = makeSelection({ repoRoot: '/repo', branch: null });

    await refreshRepository(gitService, selection);

    expect(selection.setBranch).toHaveBeenCalledWith('HEAD');
  });

  it('preserves HEAD as a valid detached-HEAD display branch', async () => {
    const gitService = {
      currentBranch: vi.fn(async () => ''),
      listBranches: vi.fn(async () => ['main']),
    };
    const selection = makeSelection({
      repoRoot: '/repo',
      branch: 'HEAD',
      selectedCommitId: 'abc',
    });

    await refreshRepository(gitService, selection);

    expect(selection.setBranch).not.toHaveBeenCalled();
  });

  it('preserves selection when repository and branch are unchanged', async () => {
    const gitService = {
      currentBranch: vi.fn(async () => 'main'),
      listBranches: vi.fn(async () => ['main']),
    };
    const selection = makeSelection({
      repoRoot: '/repo',
      branch: 'main',
      selectedCommitId: 'abc',
    });

    await refreshRepository(gitService, selection);

    expect(selection.setRepo).not.toHaveBeenCalled();
    expect(selection.setBranch).not.toHaveBeenCalled();
  });

  describe('stale results after the selected repository changes', () => {
    function deferred<T>() {
      let resolve!: (value: T) => void;
      let reject!: (reason: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    it('discards a pending currentBranch result for the previous repo', async () => {
      const selection = new SelectionState();
      const lookupA = deferred<string>();
      const gitService = {
        currentBranch: vi.fn((repo: string) =>
          repo === '/a' ? lookupA.promise : Promise.resolve('main-b'),
        ),
        listBranches: vi.fn(async () => ['main-b']),
      };

      selection.setRepo('/a');
      const pendingA = refreshRepository(gitService, selection);
      selection.setRepo('/b');
      await refreshRepository(gitService, selection);
      expect(selection.getSnapshot()).toMatchObject({ repoRoot: '/b', branch: 'main-b' });

      lookupA.resolve('main-a');
      await pendingA;

      expect(selection.getSnapshot()).toMatchObject({ repoRoot: '/b', branch: 'main-b' });
    });

    it('discards a pending listBranches result for the previous repo', async () => {
      const selection = new SelectionState();
      const listA = deferred<string[]>();
      const gitService = {
        currentBranch: vi.fn(async (repo: string) => (repo === '/a' ? 'main-a' : 'main-b')),
        listBranches: vi.fn((repo: string) =>
          repo === '/a' ? listA.promise : Promise.resolve(['main-b']),
        ),
      };

      selection.setRepo('/a');
      selection.setBranch('feature');
      const pendingA = refreshRepository(gitService, selection);
      selection.setRepo('/b');
      selection.setBranch('main-b');

      listA.resolve(['main-a']);
      await pendingA;

      expect(selection.getSnapshot()).toMatchObject({ repoRoot: '/b', branch: 'main-b' });
    });

    it('swallows a stale rejection but still rethrows for the current repo', async () => {
      const selection = new SelectionState();
      const lookupA = deferred<string>();
      const gitService = {
        currentBranch: vi.fn((repo: string) =>
          repo === '/a' ? lookupA.promise : Promise.reject(new Error('boom-b')),
        ),
        listBranches: vi.fn(async () => []),
      };

      selection.setRepo('/a');
      const pendingA = refreshRepository(gitService, selection);
      selection.setRepo('/b');
      lookupA.reject(new Error('boom-a'));
      await expect(pendingA).resolves.toBeUndefined();

      await expect(refreshRepository(gitService, selection)).rejects.toThrow('boom-b');
    });

    it('discards a stale currentBranch result after A → B → A re-selection', async () => {
      const selection = new SelectionState();
      const lookupA1 = deferred<string>();
      let aLookups = 0;
      const gitService = {
        currentBranch: vi.fn((repo: string) => {
          if (repo === '/a') {
            aLookups += 1;
            return aLookups === 1 ? lookupA1.promise : Promise.resolve('main-a-fresh');
          }
          return Promise.resolve('main-b');
        }),
        listBranches: vi.fn(async (repo: string) =>
          repo === '/a' ? ['main-a-fresh'] : ['main-b'],
        ),
      };

      selection.setRepo('/a');
      const pendingA1 = refreshRepository(gitService, selection);
      selection.setRepo('/b');
      await refreshRepository(gitService, selection);
      selection.setRepo('/a');
      await refreshRepository(gitService, selection);
      expect(selection.getSnapshot()).toMatchObject({
        repoRoot: '/a',
        branch: 'main-a-fresh',
      });

      lookupA1.resolve('main-a-stale');
      await pendingA1;

      expect(selection.getSnapshot()).toMatchObject({
        repoRoot: '/a',
        branch: 'main-a-fresh',
      });
    });

    it('swallows a stale rejection after A → B → A re-selection', async () => {
      const selection = new SelectionState();
      const lookupA1 = deferred<string>();
      let aLookups = 0;
      const gitService = {
        currentBranch: vi.fn((repo: string) => {
          if (repo === '/a') {
            aLookups += 1;
            return aLookups === 1 ? lookupA1.promise : Promise.resolve('main-a');
          }
          return Promise.resolve('main-b');
        }),
        listBranches: vi.fn(async () => []),
      };

      selection.setRepo('/a');
      const pendingA1 = refreshRepository(gitService, selection);
      selection.setRepo('/b');
      await refreshRepository(gitService, selection);
      selection.setRepo('/a');
      await refreshRepository(gitService, selection);
      expect(selection.getSnapshot()).toMatchObject({ repoRoot: '/a', branch: 'main-a' });

      lookupA1.reject(new Error('boom-a-stale'));
      await expect(pendingA1).resolves.toBeUndefined();
      expect(selection.getSnapshot()).toMatchObject({ repoRoot: '/a', branch: 'main-a' });
    });
  });

  it('maps typed git errors to actionable messages', () => {
    expect(gitErrorMessage(new GitNotFoundError())).toBe(
      'Gitgress: Git executable was not found',
    );
    expect(
      gitErrorMessage(new GitCommandFailedError(['log'], 'fatal: bad revision\n', 128)),
    ).toBe('Gitgress: fatal: bad revision');
  });
});

import { describe, expect, it, vi } from 'vitest';
import { refreshRepository } from '../../src/commands/refresh';
import { runWithSelectionRecovery } from '../../src/commands/selectionRecovery';
import { GitCommandFailedError, GitNotFoundError } from '../../src/git/errors';
import { SelectionCoordinator } from '../../src/state/SelectionCoordinator';
import { SelectionState } from '../../src/state/SelectionState';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(roots: string[], initialPref: string | null = null) {
  let pref = initialPref;
  const selection = new SelectionState();
  const coordinator = new SelectionCoordinator(
    selection,
    () => roots,
    {
      get: () => pref,
      set: (root) => {
        pref = root;
      },
    },
    () => null,
  );
  const showError = vi.fn(async () => {});
  return { selection, coordinator, showError, getPref: () => pref };
}

describe('runWithSelectionRecovery', () => {
  it('unlocks the coordinator on git failure so the index can re-resolve', async () => {
    const roots = ['/a'];
    const { selection, coordinator, showError } = setup(roots);
    coordinator.selectManually('/a');
    expect(coordinator.isLocked()).toBe(true);

    await runWithSelectionRecovery({ coordinator, showError }, async () => {
      throw new GitNotFoundError();
    });

    expect(selection.getSnapshot().repoRoot).toBeNull();
    expect(coordinator.isLocked()).toBe(false);
    expect(showError).toHaveBeenCalledTimes(1);

    // Global failure keeps the manual preference, so the index can restore it.
    coordinator.onIndexUpdated();
    expect(selection.getSnapshot().repoRoot).toBe('/a');
  });

  it('forgets a matching preference when a git command fails for the repo', async () => {
    const { selection, coordinator, showError, getPref } = setup(['/a']);
    coordinator.selectManually('/a');

    await runWithSelectionRecovery({ coordinator, showError }, async () => {
      throw new GitCommandFailedError(['log'], 'fatal: not a git repository', 128);
    });

    expect(selection.getSnapshot().repoRoot).toBeNull();
    expect(coordinator.isLocked()).toBe(false);
    expect(getPref()).toBeNull();
    coordinator.onIndexUpdated();
    expect(selection.getSnapshot().repoRoot).toBeNull();
  });

  it('does not clear a newer selection when a stale lookup rejects', async () => {
    const { selection, coordinator, showError } = setup(['/a', '/b']);
    const lookupA = deferred<string>();
    const gitService = {
      currentBranch: vi.fn((repo: string) =>
        repo === '/a' ? lookupA.promise : Promise.resolve('main-b'),
      ),
      listBranches: vi.fn(async () => []),
    };

    coordinator.selectManually('/a');
    const pendingA = runWithSelectionRecovery({ coordinator, showError }, () =>
      refreshRepository(gitService, selection),
    );

    coordinator.selectManually('/b');
    await runWithSelectionRecovery({ coordinator, showError }, () =>
      refreshRepository(gitService, selection),
    );
    expect(selection.getSnapshot()).toMatchObject({ repoRoot: '/b', branch: 'main-b' });

    lookupA.reject(new GitCommandFailedError(['branch'], 'fatal', 128));
    await pendingA;

    expect(selection.getSnapshot()).toMatchObject({ repoRoot: '/b', branch: 'main-b' });
    expect(coordinator.isLocked()).toBe(true);
    expect(showError).not.toHaveBeenCalled();
  });
});

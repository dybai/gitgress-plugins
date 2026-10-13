import { describe, expect, it, vi } from 'vitest';
import { refreshRepository } from '../../src/commands/refresh';
import { runWithSelectionRecovery } from '../../src/commands/selectionRecovery';
import { GitCommandFailedError, GitNotFoundError } from '../../src/git/errors';
import { GitService } from '../../src/git/GitService';
import { createRunGit } from '../../src/git/runGit';
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
    () => [],
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

    // Global failure keeps the preference, but re-select waits until scan idle.
    coordinator.onIndexUpdated();
    expect(selection.getSnapshot().repoRoot).toBeNull();

    coordinator.onScanIdle();
    expect(selection.getSnapshot().repoRoot).toBe('/a');
  });

  it('runs recovery only once when index updates arrive before scan idle', async () => {
    const roots = ['/a'];
    const { selection, coordinator, showError } = setup(roots);
    const gitAction = vi.fn(async () => {
      throw new GitNotFoundError();
    });

    coordinator.selectManually('/a');
    selection.subscribe((snapshot) => {
      if (snapshot.repoRoot !== null && snapshot.branch === null) {
        void runWithSelectionRecovery({ coordinator, showError }, gitAction);
      }
    });

    await runWithSelectionRecovery({ coordinator, showError }, gitAction);

    coordinator.onIndexUpdated();
    coordinator.onIndexUpdated();
    await Promise.resolve();

    expect(gitAction).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledTimes(1);
    expect(selection.getSnapshot().repoRoot).toBeNull();
  });

  it('forgets preference when createRunGit rejects a missing repo root', async () => {
    const { selection, coordinator, showError, getPref } = setup(['/gone']);
    coordinator.selectManually('/gone');

    const gitService = new GitService(
      createRunGit(
        vi.fn(async () => ({ code: 0, stdout: 'main\n', stderr: '' })),
        () => false,
      ),
    );

    await runWithSelectionRecovery({ coordinator, showError }, () =>
      refreshRepository(gitService, selection),
    );

    expect(getPref()).toBeNull();
    coordinator.onIndexUpdated();
    expect(selection.getSnapshot().repoRoot).toBeNull();
    expect(showError).toHaveBeenCalledTimes(1);
  });

  it('forgets a matching preference when the selected repository is invalid', async () => {
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

  it('keeps the manual preference on a transient git command failure', async () => {
    const { selection, coordinator, showError, getPref } = setup(['/a']);
    coordinator.selectManually('/a');

    await runWithSelectionRecovery({ coordinator, showError }, async () => {
      throw new GitCommandFailedError(['for-each-ref'], 'fatal: unable to read tree', 128);
    });

    expect(selection.getSnapshot().repoRoot).toBeNull();
    expect(coordinator.isLocked()).toBe(false);
    expect(getPref()).toBe('/a');
    coordinator.onIndexUpdated();
    expect(selection.getSnapshot().repoRoot).toBeNull();
    coordinator.onScanIdle();
    expect(selection.getSnapshot().repoRoot).toBe('/a');
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

  it('does not clear A → B → A when an old A lookup rejects as invalid', async () => {
    const { selection, coordinator, showError, getPref } = setup(['/a', '/b']);
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

    coordinator.selectManually('/a');
    const pendingA1 = runWithSelectionRecovery({ coordinator, showError }, () =>
      refreshRepository(gitService, selection),
    );

    coordinator.selectManually('/b');
    await runWithSelectionRecovery({ coordinator, showError }, () =>
      refreshRepository(gitService, selection),
    );
    coordinator.selectManually('/a');
    await runWithSelectionRecovery({ coordinator, showError }, () =>
      refreshRepository(gitService, selection),
    );
    expect(selection.getSnapshot()).toMatchObject({ repoRoot: '/a', branch: 'main-a' });
    expect(getPref()).toBe('/a');

    lookupA1.reject(
      new GitCommandFailedError(['branch'], 'fatal: not a git repository', 128),
    );
    await pendingA1;

    expect(selection.getSnapshot()).toMatchObject({ repoRoot: '/a', branch: 'main-a' });
    expect(coordinator.isLocked()).toBe(true);
    expect(getPref()).toBe('/a');
    expect(showError).not.toHaveBeenCalled();
  });
});

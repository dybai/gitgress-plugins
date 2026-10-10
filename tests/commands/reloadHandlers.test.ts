import { describe, expect, it, vi } from 'vitest';
import {
  explicitRefreshGitgress,
  reloadRepositoryState,
} from '../../src/commands/reloadHandlers';

function makeDeps(repoRoot: string | null = '/repo') {
  return {
    gitService: {
      currentBranch: vi.fn(async () => 'main'),
      listBranches: vi.fn(async () => ['main']),
    },
    selection: {
      getSnapshot: vi.fn(() => ({
        repoRoot,
        branch: 'main',
        selectedCommitId: 'abc',
      })),
      setRepo: vi.fn(),
      setBranch: vi.fn(),
    },
    filesProvider: { refresh: vi.fn() },
    commitsProvider: { refresh: vi.fn() },
    repoIndex: { startScan: vi.fn() },
    coordinator: {
      resolveInitial: vi.fn(),
      onIndexUpdated: vi.fn(),
      clearReSelectSuppression: vi.fn(),
    },
  };
}

describe('reloadHandlers', () => {
  it('reloadRepositoryState restarts scan, re-resolves, and refreshes files but not commits', async () => {
    const deps = makeDeps();

    await reloadRepositoryState(deps);

    expect(deps.repoIndex.startScan).toHaveBeenCalledOnce();
    expect(deps.coordinator.clearReSelectSuppression).toHaveBeenCalledOnce();
    expect(deps.coordinator.resolveInitial).toHaveBeenCalledOnce();
    expect(deps.filesProvider.refresh).toHaveBeenCalledOnce();
    expect(deps.commitsProvider.refresh).not.toHaveBeenCalled();
    expect(deps.selection.setRepo).not.toHaveBeenCalled();
  });

  it('reloadRepositoryState ensures the branch for the resolved repo after resolveInitial', async () => {
    const deps = makeDeps();
    const order: string[] = [];
    deps.coordinator.clearReSelectSuppression.mockImplementation(() => {
      order.push('clearReSelectSuppression');
    });
    deps.coordinator.resolveInitial.mockImplementation(() => {
      order.push('resolveInitial');
    });
    deps.gitService.currentBranch.mockImplementation(async () => {
      order.push('currentBranch');
      return 'main';
    });
    deps.selection.getSnapshot.mockImplementation(() => ({
      repoRoot: '/repo',
      branch: null,
      selectedCommitId: null,
    }));

    await reloadRepositoryState(deps);

    expect(order).toEqual(['clearReSelectSuppression', 'resolveInitial', 'currentBranch']);
    expect(deps.selection.setBranch).toHaveBeenCalledWith('main');
  });

  it('reloadRepositoryState does nothing for git when no repository is selected', async () => {
    const deps = makeDeps(null);

    await reloadRepositoryState(deps);

    expect(deps.gitService.currentBranch).not.toHaveBeenCalled();
    expect(deps.filesProvider.refresh).toHaveBeenCalledOnce();
  });

  it('explicitRefreshGitgress starts a scan and reloads commits when repo and branch are unchanged', async () => {
    const deps = makeDeps();

    await explicitRefreshGitgress(deps);

    expect(deps.repoIndex.startScan).toHaveBeenCalledOnce();
    expect(deps.coordinator.resolveInitial).not.toHaveBeenCalled();
    expect(deps.filesProvider.refresh).toHaveBeenCalledOnce();
    expect(deps.commitsProvider.refresh).toHaveBeenCalledOnce();
  });
});

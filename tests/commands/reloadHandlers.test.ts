import { describe, expect, it, vi } from 'vitest';
import {
  explicitRefreshGitgress,
  reloadRepositoryState,
} from '../../src/commands/reloadHandlers';

const unchangedSelection = {
  getSnapshot: vi.fn(() => ({
    repoRoot: '/repo',
    branch: 'main',
    selectedCommitId: 'abc',
  })),
  setRepo: vi.fn(),
  setBranch: vi.fn(),
};

const gitService = {
  resolveRepo: vi.fn(async () => '/repo'),
  currentBranch: vi.fn(async () => 'main'),
  listBranches: vi.fn(async () => ['main']),
};

describe('reloadHandlers', () => {
  it('reloadRepositoryState refreshes files but not commits', async () => {
    const filesProvider = { refresh: vi.fn() };
    const commitsProvider = { refresh: vi.fn() };

    await reloadRepositoryState({
      gitService,
      selection: unchangedSelection,
      workspaceFolders: [{ uri: { fsPath: '/repo' } }],
      filesProvider,
      commitsProvider,
    });

    expect(filesProvider.refresh).toHaveBeenCalledOnce();
    expect(commitsProvider.refresh).not.toHaveBeenCalled();
  });

  it('explicitRefreshGitgress reloads commits when repo and branch are unchanged', async () => {
    const filesProvider = { refresh: vi.fn() };
    const commitsProvider = { refresh: vi.fn() };

    await explicitRefreshGitgress({
      gitService,
      selection: unchangedSelection,
      workspaceFolders: [{ uri: { fsPath: '/repo' } }],
      filesProvider,
      commitsProvider,
    });

    expect(filesProvider.refresh).toHaveBeenCalledOnce();
    expect(commitsProvider.refresh).toHaveBeenCalledOnce();
  });
});

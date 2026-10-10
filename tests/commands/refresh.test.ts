import { describe, expect, it, vi } from 'vitest';
import { gitErrorMessage, refreshRepository } from '../../src/commands/refresh';
import { GitCommandFailedError, GitNotFoundError } from '../../src/git/errors';

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

  it('maps typed git errors to actionable messages', () => {
    expect(gitErrorMessage(new GitNotFoundError())).toBe(
      'Gitgress: Git executable was not found',
    );
    expect(
      gitErrorMessage(new GitCommandFailedError(['log'], 'fatal: bad revision\n', 128)),
    ).toBe('Gitgress: fatal: bad revision');
  });
});

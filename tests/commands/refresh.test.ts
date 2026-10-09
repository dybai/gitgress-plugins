import { describe, expect, it, vi } from 'vitest';
import { gitErrorMessage, refreshRepository } from '../../src/commands/refresh';
import { GitCommandFailedError, GitNotFoundError } from '../../src/git/errors';

describe('refreshRepository', () => {
  it('resolves workspace paths and initializes the current branch', async () => {
    const gitService = {
      resolveRepo: vi.fn(async () => '/repo'),
      currentBranch: vi.fn(async () => 'main'),
      listBranches: vi.fn(async () => ['main']),
    };
    const selection = {
      getSnapshot: vi.fn(() => ({
        repoRoot: null,
        branch: null,
        selectedCommitId: null,
      })),
      setRepo: vi.fn(),
      setBranch: vi.fn(),
    };

    await refreshRepository(
      gitService,
      selection,
      [{ uri: { fsPath: '/workspace/a' } }, { uri: { fsPath: '/workspace/b' } }],
    );

    expect(gitService.resolveRepo).toHaveBeenCalledWith(['/workspace/a', '/workspace/b']);
    expect(selection.setRepo).toHaveBeenCalledWith('/repo');
    expect(selection.setBranch).toHaveBeenCalledWith('main');
  });

  it('sets an empty repository state when no workspace is a repository', async () => {
    const gitService = {
      resolveRepo: vi.fn(async () => null),
      currentBranch: vi.fn(),
    };
    const selection = {
      getSnapshot: vi.fn(() => ({
        repoRoot: '/old',
        branch: 'main',
        selectedCommitId: null,
      })),
      setRepo: vi.fn(),
      setBranch: vi.fn(),
    };

    await refreshRepository(gitService, selection, []);

    expect(selection.setRepo).toHaveBeenCalledWith(null);
    expect(gitService.currentBranch).not.toHaveBeenCalled();
    expect(selection.setBranch).not.toHaveBeenCalled();
  });

  it('does not reset display branch when HEAD differs after switchBranch', async () => {
    const gitService = {
      resolveRepo: vi.fn(async () => '/repo'),
      currentBranch: vi.fn(async () => 'main'),
      listBranches: vi.fn(async () => ['main', 'feature']),
    };
    const selection = {
      getSnapshot: vi.fn(() => ({
        repoRoot: '/repo',
        branch: 'feature',
        selectedCommitId: null,
      })),
      setRepo: vi.fn(),
      setBranch: vi.fn(),
    };

    await refreshRepository(gitService, selection, [{ uri: { fsPath: '/repo' } }]);

    expect(selection.setRepo).toHaveBeenCalledWith('/repo');
    expect(selection.setBranch).not.toHaveBeenCalled();
  });

  it('falls back to HEAD when the display branch no longer exists', async () => {
    const gitService = {
      resolveRepo: vi.fn(async () => '/repo'),
      currentBranch: vi.fn(async () => 'main'),
      listBranches: vi.fn(async () => ['main']),
    };
    const selection = {
      getSnapshot: vi.fn(() => ({
        repoRoot: '/repo',
        branch: 'deleted-feature',
        selectedCommitId: null,
      })),
      setRepo: vi.fn(),
      setBranch: vi.fn(),
    };

    await refreshRepository(gitService, selection, [{ uri: { fsPath: '/repo' } }]);

    expect(selection.setBranch).toHaveBeenCalledWith('main');
  });

  it('preserves selection when the resolved repository and branch are unchanged', async () => {
    const gitService = {
      resolveRepo: vi.fn(async () => '/repo'),
      currentBranch: vi.fn(async () => 'main'),
      listBranches: vi.fn(async () => ['main']),
    };
    const selection = {
      getSnapshot: vi.fn(() => ({
        repoRoot: '/repo',
        branch: 'main',
        selectedCommitId: 'abc',
      })),
      setRepo: vi.fn(),
      setBranch: vi.fn(),
    };

    await refreshRepository(gitService, selection, [{ uri: { fsPath: '/repo' } }]);

    expect(selection.setRepo).toHaveBeenCalledWith('/repo');
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

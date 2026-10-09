import { describe, expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';
import { pickBranch, switchBranch } from '../../src/commands/switchBranch';

describe('pickBranch', () => {
  it('marks the current branch and returns the selected branch label', async () => {
    const showQuickPick = vi.fn(async () => ({
      label: 'feature/work',
      description: undefined,
    })) as unknown as typeof vscode.window.showQuickPick;

    await expect(
      pickBranch(['main', 'feature/work'], 'main', showQuickPick),
    ).resolves.toBe('feature/work');
    expect(showQuickPick).toHaveBeenCalledWith(
      [
        { label: 'main', description: 'Current branch' },
        { label: 'feature/work', description: undefined },
      ],
      { placeHolder: 'Select a branch' },
    );
  });

  it('returns undefined when the picker is cancelled', async () => {
    const showQuickPick = vi.fn(async () => undefined) as unknown as
      typeof vscode.window.showQuickPick;

    await expect(pickBranch(['main'], 'main', showQuickPick)).resolves.toBeUndefined();
  });

  it('lists branches and updates selection when a branch is chosen', async () => {
    const gitService = {
      listBranches: vi.fn(async () => ['main', 'feature/work']),
    };
    const selection = {
      getSnapshot: vi.fn(() => ({
        repoRoot: '/repo',
        branch: 'main',
        selectedCommitId: 'abc',
      })),
      setBranch: vi.fn(),
    };
    const showQuickPick = vi.fn(async () => ({
      label: 'feature/work',
    })) as unknown as typeof vscode.window.showQuickPick;

    await switchBranch(gitService, selection, showQuickPick);

    expect(gitService.listBranches).toHaveBeenCalledWith('/repo');
    expect(selection.setBranch).toHaveBeenCalledWith('feature/work');
  });

  it('does nothing when there is no resolved repository', async () => {
    const gitService = { listBranches: vi.fn() };
    const selection = {
      getSnapshot: vi.fn(() => ({
        repoRoot: null,
        branch: null,
        selectedCommitId: null,
      })),
      setBranch: vi.fn(),
    };
    const showQuickPick = vi.fn() as unknown as typeof vscode.window.showQuickPick;

    await switchBranch(gitService, selection, showQuickPick);

    expect(gitService.listBranches).not.toHaveBeenCalled();
    expect(showQuickPick).not.toHaveBeenCalled();
    expect(selection.setBranch).not.toHaveBeenCalled();
  });
});

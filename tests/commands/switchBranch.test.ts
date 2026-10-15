import { describe, expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';
import { pickBranch, switchBranch } from '../../src/commands/switchBranch';
import { createFakeCreateQuickPick } from '../helpers/fakeCreateQuickPick';

const checkIcon = { id: 'check' } as vscode.ThemeIcon;
const blankIcon = { id: 'blank' } as vscode.ThemeIcon;

describe('pickBranch', () => {
  it('marks the current branch with check, blank-aligns others, pre-focuses', async () => {
    const { createQuickPick, quickPick, triggerAccept } = createFakeCreateQuickPick();

    const pending = pickBranch(
      ['main', 'feature/work'],
      'main',
      createQuickPick,
      () => checkIcon,
      () => blankIcon,
    );

    expect(quickPick.placeholder).toBe('Select a branch');
    expect(quickPick.items).toEqual([
      { label: 'main', description: '[Current branch]', iconPath: checkIcon },
      { label: 'feature/work', description: undefined, iconPath: blankIcon },
    ]);
    expect(quickPick.activeItems).toEqual([quickPick.items[0]]);

    quickPick.selectedItems = [quickPick.items[1]];
    triggerAccept();
    await expect(pending).resolves.toBe('feature/work');
  });

  it('returns undefined when the picker is cancelled', async () => {
    const { createQuickPick, triggerHide } = createFakeCreateQuickPick();
    const pending = pickBranch(
      ['main'],
      'main',
      createQuickPick,
      () => checkIcon,
      () => blankIcon,
    );
    triggerHide();
    await expect(pending).resolves.toBeUndefined();
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
    const { createQuickPick, quickPick, triggerAccept } = createFakeCreateQuickPick();

    const pending = switchBranch(
      gitService,
      selection,
      createQuickPick,
      () => checkIcon,
      () => blankIcon,
    );
    await vi.waitFor(() => expect(quickPick.items).toHaveLength(2));
    quickPick.selectedItems = [quickPick.items[1]];
    triggerAccept();
    await pending;

    expect(gitService.listBranches).toHaveBeenCalledWith('/repo');
    expect(selection.setBranch).toHaveBeenCalledWith('feature/work');
  });

  it('keeps the selected commit when the current branch is reselected', async () => {
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
    const { createQuickPick, quickPick, triggerAccept } = createFakeCreateQuickPick();

    const pending = switchBranch(
      gitService,
      selection,
      createQuickPick,
      () => checkIcon,
      () => blankIcon,
    );
    await vi.waitFor(() => expect(quickPick.items).toHaveLength(2));
    quickPick.selectedItems = [quickPick.items[0]];
    triggerAccept();
    await pending;

    expect(selection.setBranch).not.toHaveBeenCalled();
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
    const { createQuickPick } = createFakeCreateQuickPick();

    await switchBranch(
      gitService,
      selection,
      createQuickPick,
      () => checkIcon,
      () => blankIcon,
    );

    expect(gitService.listBranches).not.toHaveBeenCalled();
    expect(createQuickPick).not.toHaveBeenCalled();
    expect(selection.setBranch).not.toHaveBeenCalled();
  });
});

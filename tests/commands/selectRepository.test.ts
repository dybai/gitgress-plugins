import { describe, expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';
import { selectRepository } from '../../src/commands/selectRepository';
import { createFakeCreateQuickPick } from '../helpers/fakeCreateQuickPick';

const checkIcon = { id: 'check' } as vscode.ThemeIcon;
const blankIcon = { id: 'blank' } as vscode.ThemeIcon;

describe('selectRepository', () => {
  it('does nothing when there are no indexed roots', async () => {
    const { createQuickPick } = createFakeCreateQuickPick();
    const selectManually = vi.fn();

    await selectRepository({
      roots: [],
      currentRepoRoot: null,
      workspaceFolderPaths: ['/ws'],
      createQuickPick,
      createCheckIcon: () => checkIcon,
      createBlankIcon: () => blankIcon,
      selectManually,
    });

    expect(createQuickPick).not.toHaveBeenCalled();
    expect(selectManually).not.toHaveBeenCalled();
  });

  it('marks current with check icon, blank-aligns others, pre-focuses, and selects', async () => {
    const { createQuickPick, quickPick, triggerAccept } = createFakeCreateQuickPick<{
      label: string;
      description?: string;
      iconPath?: vscode.ThemeIcon;
      repoRoot: string;
    }>();
    const selectManually = vi.fn();

    const pending = selectRepository({
      roots: ['/ws/apps/api', '/ws/other'],
      currentRepoRoot: '/ws/apps/api',
      workspaceFolderPaths: ['/ws', '/ws/apps'],
      createQuickPick,
      createCheckIcon: () => checkIcon,
      createBlankIcon: () => blankIcon,
      selectManually,
    });

    expect(quickPick.placeholder).toBe('Select a repository');
    expect(quickPick.items).toEqual([
      {
        label: 'api',
        description: '[Current repository]',
        iconPath: checkIcon,
        repoRoot: '/ws/apps/api',
      },
      {
        label: 'other',
        description: undefined,
        iconPath: blankIcon,
        repoRoot: '/ws/other',
      },
    ]);
    expect(quickPick.activeItems).toEqual([quickPick.items[0]]);

    quickPick.selectedItems = [quickPick.items[0]];
    triggerAccept();
    await pending;

    expect(selectManually).toHaveBeenCalledWith('/ws/apps/api');
  });

  it('uses absolute paths when a repo is outside workspace folders', async () => {
    const { createQuickPick, quickPick, triggerHide } = createFakeCreateQuickPick();
    const selectManually = vi.fn();

    const pending = selectRepository({
      roots: ['/standalone/repo'],
      currentRepoRoot: null,
      workspaceFolderPaths: ['/ws'],
      createQuickPick,
      createCheckIcon: () => checkIcon,
      createBlankIcon: () => blankIcon,
      selectManually,
    });

    expect(quickPick.items).toEqual([
      {
        label: '/standalone/repo',
        description: undefined,
        iconPath: blankIcon,
        repoRoot: '/standalone/repo',
      },
    ]);
    expect(quickPick.activeItems).toEqual([]);

    triggerHide();
    await pending;

    expect(selectManually).not.toHaveBeenCalled();
  });

  it('does not select manually when the picker is cancelled', async () => {
    const { createQuickPick, triggerHide } = createFakeCreateQuickPick();
    const selectManually = vi.fn();

    const pending = selectRepository({
      roots: ['/ws/repo'],
      currentRepoRoot: '/ws/repo',
      workspaceFolderPaths: ['/ws'],
      createQuickPick,
      createCheckIcon: () => checkIcon,
      createBlankIcon: () => blankIcon,
      selectManually,
    });

    triggerHide();
    await pending;

    expect(selectManually).not.toHaveBeenCalled();
  });

  it('shows workspace-folder basename instead of "." for the current root repo', async () => {
    const { createQuickPick, quickPick, triggerHide } = createFakeCreateQuickPick();
    const selectManually = vi.fn();

    const pending = selectRepository({
      roots: ['/ws/gitgress-plugins'],
      currentRepoRoot: '/ws/gitgress-plugins',
      workspaceFolderPaths: ['/ws/gitgress-plugins'],
      createQuickPick,
      createCheckIcon: () => checkIcon,
      createBlankIcon: () => blankIcon,
      selectManually,
    });

    expect(quickPick.items).toEqual([
      {
        label: 'gitgress-plugins',
        description: '[Current repository]',
        iconPath: checkIcon,
        repoRoot: '/ws/gitgress-plugins',
      },
    ]);

    triggerHide();
    await pending;

    expect(selectManually).not.toHaveBeenCalled();
  });

  it('disambiguates colliding workspace-root basenames with parent/name', async () => {
    const { createQuickPick, quickPick, triggerHide } = createFakeCreateQuickPick();
    const selectManually = vi.fn();

    const pending = selectRepository({
      roots: ['/work/a/app', '/work/b/app'],
      currentRepoRoot: '/work/a/app',
      workspaceFolderPaths: ['/work/a/app', '/work/b/app'],
      createQuickPick,
      createCheckIcon: () => checkIcon,
      createBlankIcon: () => blankIcon,
      selectManually,
    });

    expect(quickPick.items).toEqual([
      {
        label: 'a/app',
        description: '[Current repository]',
        iconPath: checkIcon,
        repoRoot: '/work/a/app',
      },
      {
        label: 'b/app',
        description: undefined,
        iconPath: blankIcon,
        repoRoot: '/work/b/app',
      },
    ]);

    triggerHide();
    await pending;
  });
});

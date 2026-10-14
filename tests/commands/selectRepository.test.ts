import { describe, expect, it, vi } from 'vitest';
import type * as vscode from 'vscode';
import { selectRepository } from '../../src/commands/selectRepository';

describe('selectRepository', () => {
  it('does nothing when there are no indexed roots', async () => {
    const showQuickPick = vi.fn() as unknown as typeof vscode.window.showQuickPick;
    const selectManually = vi.fn();

    await selectRepository({
      roots: [],
      currentRepoRoot: null,
      workspaceFolderPaths: ['/ws'],
      showQuickPick,
      selectManually,
    });

    expect(showQuickPick).not.toHaveBeenCalled();
    expect(selectManually).not.toHaveBeenCalled();
  });

  it('lists workspace-relative labels, marks the current repo, and selects manually', async () => {
    const showQuickPick = vi.fn(async () => ({
      label: 'api',
      description: undefined,
      repoRoot: '/ws/apps/api',
    })) as unknown as typeof vscode.window.showQuickPick;
    const selectManually = vi.fn();

    await selectRepository({
      roots: ['/ws/apps/api', '/ws/other'],
      currentRepoRoot: '/ws/apps/api',
      workspaceFolderPaths: ['/ws', '/ws/apps'],
      showQuickPick,
      selectManually,
    });

    expect(showQuickPick).toHaveBeenCalledWith(
      [
        {
          label: 'api',
          description: 'Current repository',
          repoRoot: '/ws/apps/api',
        },
        {
          label: 'other',
          description: undefined,
          repoRoot: '/ws/other',
        },
      ],
      { placeHolder: 'Select a repository' },
    );
    expect(selectManually).toHaveBeenCalledWith('/ws/apps/api');
  });

  it('uses absolute paths when a repo is outside workspace folders', async () => {
    const showQuickPick = vi.fn(async () => undefined) as unknown as
      typeof vscode.window.showQuickPick;
    const selectManually = vi.fn();

    await selectRepository({
      roots: ['/standalone/repo'],
      currentRepoRoot: null,
      workspaceFolderPaths: ['/ws'],
      showQuickPick,
      selectManually,
    });

    expect(showQuickPick).toHaveBeenCalledWith(
      [
        {
          label: '/standalone/repo',
          description: undefined,
          repoRoot: '/standalone/repo',
        },
      ],
      { placeHolder: 'Select a repository' },
    );
    expect(selectManually).not.toHaveBeenCalled();
  });

  it('does not select manually when the picker is cancelled', async () => {
    const showQuickPick = vi.fn(async () => undefined) as unknown as
      typeof vscode.window.showQuickPick;
    const selectManually = vi.fn();

    await selectRepository({
      roots: ['/ws/repo'],
      currentRepoRoot: '/ws/repo',
      workspaceFolderPaths: ['/ws'],
      showQuickPick,
      selectManually,
    });

    expect(selectManually).not.toHaveBeenCalled();
  });

  it('shows workspace-folder basename instead of "." for the current root repo', async () => {
    const showQuickPick = vi.fn(async () => undefined) as unknown as
      typeof vscode.window.showQuickPick;
    const selectManually = vi.fn();

    await selectRepository({
      roots: ['/ws/gitgress-plugins'],
      currentRepoRoot: '/ws/gitgress-plugins',
      workspaceFolderPaths: ['/ws/gitgress-plugins'],
      showQuickPick,
      selectManually,
    });

    expect(showQuickPick).toHaveBeenCalledWith(
      [
        {
          label: 'gitgress-plugins',
          description: 'Current repository',
          repoRoot: '/ws/gitgress-plugins',
        },
      ],
      { placeHolder: 'Select a repository' },
    );
    expect(selectManually).not.toHaveBeenCalled();
  });

  it('disambiguates colliding workspace-root basenames with parent/name', async () => {
    const showQuickPick = vi.fn(async () => undefined) as unknown as
      typeof vscode.window.showQuickPick;
    const selectManually = vi.fn();

    await selectRepository({
      roots: ['/work/a/app', '/work/b/app'],
      currentRepoRoot: '/work/a/app',
      workspaceFolderPaths: ['/work/a/app', '/work/b/app'],
      showQuickPick,
      selectManually,
    });

    expect(showQuickPick).toHaveBeenCalledWith(
      [
        {
          label: 'a/app',
          description: 'Current repository',
          repoRoot: '/work/a/app',
        },
        {
          label: 'b/app',
          description: undefined,
          repoRoot: '/work/b/app',
        },
      ],
      { placeHolder: 'Select a repository' },
    );
  });
});

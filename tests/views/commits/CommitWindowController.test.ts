import { describe, expect, it, vi } from 'vitest';
import type { CommitSummary, GitService } from '../../../src/git/GitService';
import { CommitWindowController } from '../../../src/views/commits/CommitWindowController';

type ControllerGit = Pick<
  GitService,
  'log' | 'logOlderThan' | 'logNewerThan' | 'isCommitOnBranch' | 'resolveTip' | 'listTips'
>;

const commit = (id: string): CommitSummary => ({
  id,
  parentIds: [],
  subject: id,
  authorName: 'Author',
  authorDateIso: '2026-10-13T00:00:00.000Z',
  fullMessage: id,
  additions: 0,
  deletions: 0,
});

const createGit = (): ControllerGit => ({
  log: vi.fn().mockResolvedValue([]),
  logOlderThan: vi.fn().mockResolvedValue([]),
  logNewerThan: vi.fn().mockResolvedValue([]),
  isCommitOnBranch: vi.fn().mockResolvedValue(true),
  resolveTip: vi.fn().mockResolvedValue(null),
  listTips: vi.fn().mockResolvedValue([]),
});

describe('CommitWindowController', () => {
  it('resets from the branch tip', async () => {
    const git = createGit();
    vi.mocked(git.log).mockResolvedValue([commit('a'), commit('b')]);
    const controller = new CommitWindowController(git, 2, 3);

    const state = await controller.resetFromTip('/repo', 'main');

    expect(git.log).toHaveBeenCalledWith('/repo', 'main', 2);
    expect(state.loaded.map(({ id }) => id)).toEqual(['a', 'b']);
    expect(state.hasOlder).toBe(true);
    expect(state.hasNewer).toBe(false);
    expect(controller.getState()).toEqual(state);
  });

  it('loads older commits from preload without fetching again', async () => {
    const git = createGit();
    vi.mocked(git.log).mockResolvedValue([commit('a'), commit('b')]);
    vi.mocked(git.logOlderThan).mockResolvedValue([commit('c'), commit('d')]);
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');
    await controller.preloadOlder('/repo', 'main');
    vi.mocked(git.logOlderThan).mockClear();

    await expect(controller.loadOlder('/repo', 'main', null)).resolves.toBe('ok');

    expect(git.logOlderThan).not.toHaveBeenCalled();
    expect(controller.getState().loaded.map(({ id }) => id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(controller.getState().olderPreload).toBeNull();
  });

  it('fetches older commits when no preload exists', async () => {
    const git = createGit();
    vi.mocked(git.log).mockResolvedValue([commit('a'), commit('b')]);
    vi.mocked(git.logOlderThan).mockResolvedValue([commit('c')]);
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');

    await expect(controller.loadOlder('/repo', 'main', null)).resolves.toBe('ok');

    expect(git.logOlderThan).toHaveBeenCalledWith('/repo', 'main', 'b', 2);
    expect(controller.getState().loaded.map(({ id }) => id)).toEqual(['a', 'b', 'c']);
    expect(controller.getState().hasOlder).toBe(false);
  });

  it('loads newer commits toward the branch tip', async () => {
    const git = createGit();
    vi.mocked(git.log).mockResolvedValue([commit('c'), commit('d')]);
    vi.mocked(git.resolveTip).mockResolvedValue('a');
    vi.mocked(git.logNewerThan).mockResolvedValue([commit('a'), commit('b')]);
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');
    await controller.reconcileAfterHistoryChange('/repo', 'main', 'c');

    await expect(controller.loadNewer('/repo', 'main', 'c')).resolves.toBe('ok');

    expect(git.logNewerThan).toHaveBeenCalledWith('/repo', 'main', 'c', 2);
    expect(controller.getState().loaded.map(({ id }) => id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('silently ignores preload failures', async () => {
    const git = createGit();
    vi.mocked(git.log).mockResolvedValue([commit('a'), commit('b')]);
    vi.mocked(git.logOlderThan).mockRejectedValue(new Error('git failed'));
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');

    await expect(controller.preloadOlder('/repo', 'main')).resolves.toBeUndefined();

    expect(controller.getState().olderPreload).toBeNull();
  });

  it('marks newer history available without loading new commits during reconcile', async () => {
    const git = createGit();
    vi.mocked(git.log).mockResolvedValue([commit('old-tip'), commit('selected')]);
    vi.mocked(git.resolveTip).mockResolvedValue('new-tip');
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');
    vi.mocked(git.log).mockClear();

    await expect(
      controller.reconcileAfterHistoryChange('/repo', 'main', 'selected'),
    ).resolves.toEqual({ selectionInvalid: false, tip: 'new-tip' });

    expect(git.isCommitOnBranch).toHaveBeenCalledWith('/repo', 'main', 'selected');
    expect(git.log).not.toHaveBeenCalled();
    expect(git.logNewerThan).not.toHaveBeenCalled();
    expect(controller.getState().loaded.map(({ id }) => id)).toEqual([
      'old-tip',
      'selected',
    ]);
    expect(controller.getState().hasNewer).toBe(true);
  });

  it('resets and reports an invalid selection after history changes', async () => {
    const git = createGit();
    vi.mocked(git.log)
      .mockResolvedValueOnce([commit('old-tip'), commit('selected')])
      .mockResolvedValueOnce([commit('new-tip')]);
    vi.mocked(git.resolveTip).mockResolvedValue('new-tip');
    vi.mocked(git.isCommitOnBranch).mockResolvedValue(false);
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');

    await expect(
      controller.reconcileAfterHistoryChange('/repo', 'main', 'selected'),
    ).resolves.toEqual({ selectionInvalid: true, tip: 'new-tip' });

    expect(controller.getState().loaded.map(({ id }) => id)).toEqual(['new-tip']);
  });
});

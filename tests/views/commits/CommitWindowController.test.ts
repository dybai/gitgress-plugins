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

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

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

  it('returns busy for a concurrent loadOlder', async () => {
    const git = createGit();
    const older = deferred<CommitSummary[]>();
    vi.mocked(git.log).mockResolvedValue([commit('a'), commit('b')]);
    vi.mocked(git.logOlderThan).mockReturnValue(older.promise);
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');

    const firstLoad = controller.loadOlder('/repo', 'main', null);

    await expect(controller.loadOlder('/repo', 'main', null)).resolves.toBe('busy');
    older.resolve([commit('c')]);
    await expect(firstLoad).resolves.toBe('ok');
  });

  it('returns noop without fetching when no older commits are available', async () => {
    const git = createGit();
    vi.mocked(git.log).mockResolvedValue([commit('a')]);
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');

    await expect(controller.loadOlder('/repo', 'main', null)).resolves.toBe('noop');

    expect(git.logOlderThan).not.toHaveBeenCalled();
  });

  it('loads newer commits toward the branch tip', async () => {
    const git = createGit();
    vi.mocked(git.log)
      .mockResolvedValueOnce([commit('c'), commit('d')])
      .mockResolvedValueOnce([commit('c'), commit('d')]);
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

  it('loads newer commits from preload without fetching again', async () => {
    const git = createGit();
    vi.mocked(git.log)
      .mockResolvedValueOnce([commit('c'), commit('d')])
      .mockResolvedValueOnce([commit('c'), commit('d')]);
    vi.mocked(git.resolveTip).mockResolvedValue('a');
    vi.mocked(git.logNewerThan).mockResolvedValue([commit('a'), commit('b')]);
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');
    await controller.reconcileAfterHistoryChange('/repo', 'main', 'c');
    await controller.preloadNewer('/repo', 'main');
    vi.mocked(git.logNewerThan).mockClear();

    await expect(controller.loadNewer('/repo', 'main', 'c')).resolves.toBe('ok');

    expect(git.logNewerThan).not.toHaveBeenCalled();
    expect(controller.getState().loaded.map(({ id }) => id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(controller.getState().newerPreload).toBeNull();
  });

  it('preloads newer commits from the current first commit', async () => {
    const git = createGit();
    vi.mocked(git.log)
      .mockResolvedValueOnce([commit('c'), commit('d')])
      .mockResolvedValueOnce([commit('c'), commit('d')]);
    vi.mocked(git.resolveTip).mockResolvedValue('a');
    vi.mocked(git.logNewerThan).mockResolvedValue([commit('a'), commit('b')]);
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');
    await controller.reconcileAfterHistoryChange('/repo', 'main', 'c');

    await controller.preloadNewer('/repo', 'main');

    expect(git.logNewerThan).toHaveBeenCalledWith('/repo', 'main', 'c', 2);
    expect(controller.getState().newerPreload?.map(({ id }) => id)).toEqual([
      'a',
      'b',
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

  it('rebuilds history from a valid selection during reconcile', async () => {
    const git = createGit();
    vi.mocked(git.log)
      .mockResolvedValueOnce([commit('rewritten'), commit('selected')])
      .mockResolvedValueOnce([commit('selected'), commit('older')]);
    vi.mocked(git.resolveTip).mockResolvedValue('new-tip');
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');
    vi.mocked(git.log).mockClear();

    await expect(
      controller.reconcileAfterHistoryChange('/repo', 'main', 'selected'),
    ).resolves.toEqual({ selectionInvalid: false, tip: 'new-tip' });

    expect(git.isCommitOnBranch).toHaveBeenCalledWith('/repo', 'main', 'selected');
    expect(git.log).toHaveBeenCalledWith('/repo', 'selected', 2);
    expect(git.logNewerThan).not.toHaveBeenCalled();
    expect(controller.getState().loaded.map(({ id }) => id)).toEqual([
      'selected',
      'older',
    ]);
    expect(controller.getState().hasNewer).toBe(true);
  });

  it('resets from tip when reconciling without a selection', async () => {
    const git = createGit();
    vi.mocked(git.log)
      .mockResolvedValueOnce([commit('old-tip')])
      .mockResolvedValueOnce([commit('new-tip')]);
    vi.mocked(git.resolveTip).mockResolvedValue('new-tip');
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');

    await expect(
      controller.reconcileAfterHistoryChange('/repo', 'main', null),
    ).resolves.toEqual({ selectionInvalid: false, tip: 'new-tip' });

    expect(git.log).toHaveBeenLastCalledWith('/repo', 'main', 2);
    expect(controller.getState().loaded.map(({ id }) => id)).toEqual(['new-tip']);
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

  it('discards a stale older preload after resetFromTip', async () => {
    const git = createGit();
    const older = deferred<CommitSummary[]>();
    vi.mocked(git.log)
      .mockResolvedValueOnce([commit('old-a'), commit('old-b')])
      .mockResolvedValueOnce([commit('new-a'), commit('new-b')]);
    vi.mocked(git.logOlderThan).mockReturnValue(older.promise);
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');

    const preload = controller.preloadOlder('/repo', 'main');
    await controller.resetFromTip('/repo', 'main');
    older.resolve([commit('old-c'), commit('old-d')]);
    await preload;

    expect(controller.getState().loaded.map(({ id }) => id)).toEqual([
      'new-a',
      'new-b',
    ]);
    expect(controller.getState().olderPreload).toBeNull();
  });

  it('discards an in-flight older load after resetFromTip', async () => {
    const git = createGit();
    const older = deferred<CommitSummary[]>();
    vi.mocked(git.log)
      .mockResolvedValueOnce([commit('old-a'), commit('old-b')])
      .mockResolvedValueOnce([commit('new-a'), commit('new-b')]);
    vi.mocked(git.logOlderThan).mockReturnValue(older.promise);
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');

    const load = controller.loadOlder('/repo', 'main', null);
    await controller.resetFromTip('/repo', 'main');
    older.resolve([commit('old-c')]);

    await expect(load).resolves.toBe('noop');
    expect(controller.getState().loaded.map(({ id }) => id)).toEqual([
      'new-a',
      'new-b',
    ]);
  });

  it('does not stash a duplicate page when loadOlder wins a preload race', async () => {
    const git = createGit();
    const preloadedOlder = deferred<CommitSummary[]>();
    vi.mocked(git.log).mockResolvedValue([commit('a'), commit('b')]);
    vi.mocked(git.logOlderThan)
      .mockReturnValueOnce(preloadedOlder.promise)
      .mockResolvedValueOnce([commit('c'), commit('d')]);
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');

    const preload = controller.preloadOlder('/repo', 'main');
    await expect(controller.loadOlder('/repo', 'main', null)).resolves.toBe('ok');
    preloadedOlder.resolve([commit('c'), commit('d')]);
    await preload;

    expect(controller.getState().loaded.map(({ id }) => id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(controller.getState().olderPreload).toBeNull();
  });

  it('applies an in-flight older load after a newer preload completes', async () => {
    const git = createGit();
    const older = deferred<CommitSummary[]>();
    const newer = deferred<CommitSummary[]>();
    vi.mocked(git.log)
      .mockResolvedValueOnce([commit('c'), commit('d')])
      .mockResolvedValueOnce([commit('c'), commit('d')]);
    vi.mocked(git.resolveTip).mockResolvedValue('a');
    vi.mocked(git.logOlderThan).mockReturnValue(older.promise);
    vi.mocked(git.logNewerThan).mockReturnValue(newer.promise);
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');
    await controller.reconcileAfterHistoryChange('/repo', 'main', 'c');

    const load = controller.loadOlder('/repo', 'main', 'c');
    const preload = controller.preloadNewer('/repo', 'main');
    newer.resolve([commit('a'), commit('b')]);
    await preload;
    older.resolve([commit('e'), commit('f')]);

    await expect(load).resolves.toBe('ok');
    expect(controller.getState().loaded.map(({ id }) => id)).toEqual([
      'c',
      'd',
      'e',
      'f',
    ]);
    expect(controller.getState().newerPreload?.map(({ id }) => id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('rebuilds during reconcile after a concurrent older load completes', async () => {
    const git = createGit();
    const tip = deferred<string | null>();
    vi.mocked(git.log)
      .mockResolvedValueOnce([commit('old-tip'), commit('selected')])
      .mockResolvedValueOnce([commit('selected'), commit('rewritten-older')]);
    vi.mocked(git.resolveTip).mockReturnValue(tip.promise);
    vi.mocked(git.logOlderThan).mockResolvedValue([commit('old-older')]);
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');

    const reconcile = controller.reconcileAfterHistoryChange(
      '/repo',
      'main',
      'selected',
    );
    await expect(controller.loadOlder('/repo', 'main', 'selected')).resolves.toBe(
      'ok',
    );
    tip.resolve('new-tip');

    await expect(reconcile).resolves.toEqual({
      selectionInvalid: false,
      tip: 'new-tip',
    });
    expect(controller.getState().loaded.map(({ id }) => id)).toEqual([
      'selected',
      'rewritten-older',
    ]);
  });

  it('reports reconcile superseded when resetFromTip races invalid-selection reset', async () => {
    const git = createGit();
    const reconcileResetLog = deferred<CommitSummary[]>();
    let tipLogCalls = 0;
    vi.mocked(git.log).mockImplementation((_repo, ref) => {
      if (ref !== 'main') {
        return Promise.resolve([commit('selected'), commit('older')]);
      }
      tipLogCalls += 1;
      if (tipLogCalls === 1) {
        return Promise.resolve([commit('old-tip'), commit('selected')]);
      }
      if (tipLogCalls === 2) {
        return reconcileResetLog.promise;
      }
      return Promise.resolve([commit('concurrent-reset-tip')]);
    });
    vi.mocked(git.resolveTip).mockResolvedValue('new-tip');
    vi.mocked(git.isCommitOnBranch).mockResolvedValue(false);
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');

    const reconcile = controller.reconcileAfterHistoryChange(
      '/repo',
      'main',
      'selected',
    );
    await vi.waitFor(() => {
      expect(tipLogCalls).toBe(2);
    });
    await controller.resetFromTip('/repo', 'main');
    reconcileResetLog.resolve([commit('stale-reconcile-tip')]);

    await expect(reconcile).resolves.toEqual({
      selectionInvalid: true,
      tip: 'new-tip',
      superseded: true,
    });
    expect(controller.getState().loaded.map(({ id }) => id)).toEqual([
      'concurrent-reset-tip',
    ]);
  });

  it('reports a reconcile superseded by resetFromTip', async () => {
    const git = createGit();
    const tip = deferred<string | null>();
    vi.mocked(git.log)
      .mockResolvedValueOnce([commit('old-tip'), commit('selected')])
      .mockResolvedValueOnce([commit('reset-tip')]);
    vi.mocked(git.resolveTip).mockReturnValue(tip.promise);
    const controller = new CommitWindowController(git, 2, 3);
    await controller.resetFromTip('/repo', 'main');

    const reconcile = controller.reconcileAfterHistoryChange(
      '/repo',
      'main',
      'selected',
    );
    await controller.resetFromTip('/repo', 'main');
    tip.resolve('new-tip');

    await expect(reconcile).resolves.toEqual({
      selectionInvalid: false,
      tip: 'new-tip',
      superseded: true,
    });
    expect(controller.getState().loaded.map(({ id }) => id)).toEqual([
      'reset-tip',
    ]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GitHistoryWatcher,
  type GitHistoryWatcherDeps,
  type HistoryWatchTarget,
} from '../../src/git/GitHistoryWatcher';

type Listener = () => void;

function createWatcherHarness() {
  const listeners: Listener[] = [];
  const registrationDisposables = [
    { dispose: vi.fn() },
    { dispose: vi.fn() },
    { dispose: vi.fn() },
  ];
  const watcherDispose = vi.fn();
  const watcher = {
    onDidCreate: vi.fn((listener: Listener) => {
      listeners.push(listener);
      return registrationDisposables[0];
    }),
    onDidChange: vi.fn((listener: Listener) => {
      listeners.push(listener);
      return registrationDisposables[1];
    }),
    onDidDelete: vi.fn((listener: Listener) => {
      listeners.push(listener);
      return registrationDisposables[2];
    }),
    dispose: watcherDispose,
  };

  return {
    watcher,
    registrationDisposables,
    watcherDispose,
    fire: () => listeners.forEach((listener) => listener()),
  };
}

const target = (
  repoRoot: string,
  repoGeneration: number,
  branch: string | null = 'main',
): HistoryWatchTarget => ({ repoRoot, repoGeneration, branch });

describe('GitHistoryWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('disposes the previous watcher and registrations and clears its timer on retarget', async () => {
    const first = createWatcherHarness();
    const second = createWatcherHarness();
    const createWatcher = vi
      .fn<GitHistoryWatcherDeps['createWatcher']>()
      .mockReturnValueOnce(first.watcher)
      .mockReturnValueOnce(second.watcher);
    const readTip = vi.fn().mockResolvedValue('tip-a');
    const onChanged = vi.fn();
    const watcher = new GitHistoryWatcher(
      {
        debounceMs: 1500,
        resolveGitDir: (repoRoot) => `${repoRoot}/.git`,
        createWatcher,
        readTip,
        setTimeout,
        clearTimeout,
      },
      onChanged,
    );

    watcher.retarget(target('/repo-a', 1));
    await vi.runAllTicks();
    first.fire();
    watcher.retarget(target('/repo-b', 2));
    await vi.advanceTimersByTimeAsync(1500);

    expect(first.watcherDispose).toHaveBeenCalledOnce();
    first.registrationDisposables.forEach((disposable) => {
      expect(disposable.dispose).toHaveBeenCalledOnce();
    });
    expect(readTip).toHaveBeenCalledTimes(2);
    expect(readTip).toHaveBeenNthCalledWith(1, '/repo-a', 'main');
    expect(readTip).toHaveBeenNthCalledWith(2, '/repo-b', 'main');
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('coalesces events within 1.5s and notifies once when the tip changes', async () => {
    const harness = createWatcherHarness();
    const readTip = vi.fn().mockResolvedValueOnce('tip-a').mockResolvedValueOnce('tip-b');
    const onChanged = vi.fn();
    const watcher = new GitHistoryWatcher(
      {
        debounceMs: 1500,
        resolveGitDir: () => '/repo/.git',
        createWatcher: () => harness.watcher,
        readTip,
        setTimeout,
        clearTimeout,
      },
      onChanged,
    );
    const watchTarget = target('/repo', 1);

    watcher.retarget(watchTarget);
    await vi.runAllTicks();
    harness.fire();
    await vi.advanceTimersByTimeAsync(1000);
    harness.fire();
    await vi.advanceTimersByTimeAsync(1499);
    expect(onChanged).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(readTip).toHaveBeenCalledTimes(2);
    expect(onChanged).toHaveBeenCalledOnce();
    expect(onChanged).toHaveBeenCalledWith(watchTarget);
  });

  it('ignores a debounce completion from a stale generation after retarget', async () => {
    const first = createWatcherHarness();
    const second = createWatcherHarness();
    let resolveStaleRead!: (tip: string | null) => void;
    const staleRead = new Promise<string | null>((resolve) => {
      resolveStaleRead = resolve;
    });
    const readTip = vi
      .fn()
      .mockResolvedValueOnce('tip-a')
      .mockReturnValueOnce(staleRead)
      .mockResolvedValueOnce('tip-b');
    const onChanged = vi.fn();
    const watcher = new GitHistoryWatcher(
      {
        debounceMs: 1500,
        resolveGitDir: (repoRoot) => `${repoRoot}/.git`,
        createWatcher: vi
          .fn<GitHistoryWatcherDeps['createWatcher']>()
          .mockReturnValueOnce(first.watcher)
          .mockReturnValueOnce(second.watcher),
        readTip,
        setTimeout,
        clearTimeout,
      },
      onChanged,
    );

    watcher.retarget(target('/repo-a', 1));
    await vi.runAllTicks();
    first.fire();
    await vi.advanceTimersByTimeAsync(1500);
    watcher.retarget(target('/repo-b', 2));
    await vi.runAllTicks();
    resolveStaleRead('tip-a-new');
    await vi.runAllTicks();

    expect(onChanged).not.toHaveBeenCalled();
  });

  it('does not notify when the tip is unchanged after debounce', async () => {
    const harness = createWatcherHarness();
    const readTip = vi.fn().mockResolvedValue('tip-a');
    const onChanged = vi.fn();
    const watcher = new GitHistoryWatcher(
      {
        debounceMs: 1500,
        resolveGitDir: () => '/repo/.git',
        createWatcher: () => harness.watcher,
        readTip,
        setTimeout,
        clearTimeout,
      },
      onChanged,
    );

    watcher.retarget(target('/repo', 1));
    await vi.runAllTicks();
    harness.fire();
    await vi.advanceTimersByTimeAsync(1500);

    expect(readTip).toHaveBeenCalledTimes(2);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('does not treat an unavailable tip as a changed tip', async () => {
    const harness = createWatcherHarness();
    const readTip = vi
      .fn()
      .mockResolvedValueOnce('tip-a')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('tip-a');
    const onChanged = vi.fn();
    const watcher = new GitHistoryWatcher(
      {
        debounceMs: 1500,
        resolveGitDir: () => '/repo/.git',
        createWatcher: () => harness.watcher,
        readTip,
        setTimeout,
        clearTimeout,
      },
      onChanged,
    );

    watcher.retarget(target('/repo', 1));
    await vi.runAllTicks();
    harness.fire();
    await vi.advanceTimersByTimeAsync(1500);
    harness.fire();
    await vi.advanceTimersByTimeAsync(1500);

    expect(onChanged).not.toHaveBeenCalled();
  });

  it('stays idle when detached or when the git directory cannot be resolved', () => {
    const createWatcher = vi.fn();
    const watcher = new GitHistoryWatcher(
      {
        debounceMs: 1500,
        resolveGitDir: () => null,
        createWatcher,
        readTip: vi.fn(),
        setTimeout,
        clearTimeout,
      },
      vi.fn(),
    );

    watcher.retarget(target('/missing', 1));
    watcher.retarget(null);

    expect(createWatcher).not.toHaveBeenCalled();
  });
});

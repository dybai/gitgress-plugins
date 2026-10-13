import type { GitDirectoryLayout } from './resolveGitDir.js';

export type HistoryWatchTarget = {
  repoRoot: string;
  repoGeneration: number;
  branch: string | null;
};

type Disposable = {
  dispose(): void;
};

type HistoryFileWatcher = Disposable & {
  onDidCreate(cb: () => void): Disposable;
  onDidChange(cb: () => void): Disposable;
  onDidDelete(cb: () => void): Disposable;
};

export type GitHistoryWatcherDeps = {
  debounceMs: number;
  resolveGitDir: (repoRoot: string) => GitDirectoryLayout | null;
  createWatcher: (layout: GitDirectoryLayout) => HistoryFileWatcher;
  readTip: (repoRoot: string, branch: string) => Promise<string | null>;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
};

export class GitHistoryWatcher {
  private generation = 0;
  private target: HistoryWatchTarget | null = null;
  private watcher: HistoryFileWatcher | null = null;
  private watcherDisposables: Disposable[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastTip: string | null = null;
  private initialRead: Promise<void> = Promise.resolve();

  constructor(
    private readonly deps: GitHistoryWatcherDeps,
    private readonly onChanged: (target: HistoryWatchTarget) => void,
  ) {}

  retarget(target: HistoryWatchTarget | null): void {
    if (this.hasSameIdentity(target)) {
      return;
    }

    this.detach();
    const generation = ++this.generation;
    this.lastTip = null;
    this.initialRead = Promise.resolve();

    if (target === null) {
      return;
    }

    let layout: GitDirectoryLayout | null;
    try {
      layout = this.deps.resolveGitDir(target.repoRoot);
    } catch (error) {
      console.warn(`GitGress: unable to resolve git directory for ${target.repoRoot}`, error);
      return;
    }
    if (layout === null) {
      return;
    }

    try {
      this.watcher = this.deps.createWatcher(layout);
    } catch (error) {
      console.warn(`GitGress: unable to watch git history in ${layout.gitDir}`, error);
      return;
    }
    const schedule = () => this.scheduleRead(target, generation);
    this.watcherDisposables = [
      this.watcher.onDidCreate(schedule),
      this.watcher.onDidChange(schedule),
      this.watcher.onDidDelete(schedule),
    ];
    this.target = target;

    if (target.branch !== null) {
      this.initialRead = this.recordInitialTip(target, generation);
    }
  }

  dispose(): void {
    this.detach();
    ++this.generation;
  }

  private async recordInitialTip(
    target: HistoryWatchTarget,
    generation: number,
  ): Promise<void> {
    try {
      const tip = await this.deps.readTip(target.repoRoot, target.branch!);
      if (generation === this.generation) {
        this.lastTip = tip;
      }
    } catch {
      // A temporarily unavailable tip is handled by a later file event.
    }
  }

  private scheduleRead(target: HistoryWatchTarget, generation: number): void {
    if (this.timer !== null) {
      this.deps.clearTimeout(this.timer);
    }

    this.timer = this.deps.setTimeout(() => {
      this.timer = null;
      void this.readAfterDebounce(target, generation);
    }, this.deps.debounceMs);
  }

  private async readAfterDebounce(
    target: HistoryWatchTarget,
    generation: number,
  ): Promise<void> {
    await this.initialRead;
    if (generation !== this.generation || target.branch === null) {
      return;
    }

    try {
      const tip = await this.deps.readTip(target.repoRoot, target.branch);
      if (generation !== this.generation || tip === null || tip === this.lastTip) {
        return;
      }

      this.lastTip = tip;
      this.onChanged(target);
    } catch {
      // Keep watching; subsequent git file events will retry the tip read.
    }
  }

  private detach(): void {
    if (this.timer !== null) {
      this.deps.clearTimeout(this.timer);
      this.timer = null;
    }

    for (const disposable of this.watcherDisposables) {
      disposable.dispose();
    }
    this.watcherDisposables = [];
    this.watcher?.dispose();
    this.watcher = null;
    this.target = null;
  }

  private hasSameIdentity(target: HistoryWatchTarget | null): boolean {
    return (
      target !== null &&
      this.target !== null &&
      target.repoRoot === this.target.repoRoot &&
      target.repoGeneration === this.target.repoGeneration &&
      target.branch === this.target.branch
    );
  }
}

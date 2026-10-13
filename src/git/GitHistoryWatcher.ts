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
  resolveGitDir: (repoRoot: string) => string | null;
  createWatcher: (gitDir: string) => HistoryFileWatcher;
  readTip: (repoRoot: string, branch: string) => Promise<string | null>;
  setTimeout: typeof setTimeout;
  clearTimeout: typeof clearTimeout;
};

export class GitHistoryWatcher {
  private generation = 0;
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
    this.detach();
    const generation = ++this.generation;
    this.lastTip = null;
    this.initialRead = Promise.resolve();

    if (target === null) {
      return;
    }

    const gitDir = this.deps.resolveGitDir(target.repoRoot);
    if (gitDir === null) {
      return;
    }

    this.watcher = this.deps.createWatcher(gitDir);
    const schedule = () => this.scheduleRead(target, generation);
    this.watcherDisposables = [
      this.watcher.onDidCreate(schedule),
      this.watcher.onDidChange(schedule),
      this.watcher.onDidDelete(schedule),
    ];

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
  }
}

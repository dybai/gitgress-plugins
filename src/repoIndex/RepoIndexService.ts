import { MEMORY_REPO_CAP } from './constants.js';
import { scanRepos, type ScanFs } from './scanRepos.js';
import type { RepoIndexEntry, RepoIndexStore } from './repoIndexStore.js';

export type ScanStatus = 'idle' | 'scanning';

export type RepoIndexServiceDeps = {
  workspaceRoots: () => readonly string[];
  fs: ScanFs;
  /** May throw {@link RepoIndexDbError} when the on-disk index is unavailable. */
  openStore: () => Promise<RepoIndexStore>;
  openMemoryStore: () => RepoIndexStore;
  now?: () => number;
  /** Throttled by the service: each distinct warning fires at most once. */
  onWarning?: (message: string) => void;
};

const DB_UNAVAILABLE_WARNING =
  'GitGress: Repository index unavailable; using in-memory cache.';
const CAPPED_WARNING = `GitGress: Repository index capped at ${MEMORY_REPO_CAP} entries.`;

/**
 * Background service that scans configured workspace roots for git repositories
 * and keeps a {@link RepoIndexStore} in sync. Scans run asynchronously and can
 * be cancelled by starting a new scan or disposing the service.
 */
export class RepoIndexService {
  private readonly deps: RepoIndexServiceDeps;
  private store: RepoIndexStore;
  private status: ScanStatus = 'idle';
  private readonly listeners = new Set<() => void>();
  private scanController: AbortController | null = null;
  private dbWarned = false;
  private capWarned = false;

  constructor(deps: RepoIndexServiceDeps) {
    this.deps = deps;
    // Seed with an empty memory store so getRepos() is safe before start().
    this.store = deps.openMemoryStore();
  }

  /** Normalized roots currently held by the backing store. */
  getRepos(): string[] {
    return this.store.getEntries().map((e) => e.root);
  }

  getScanStatus(): ScanStatus {
    return this.status;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Open the backing store (falling back to an in-memory store with a warning
   * on failure) and kick off the first scan.
   */
  async start(): Promise<void> {
    try {
      this.store = await this.deps.openStore();
    } catch {
      if (!this.dbWarned) {
        this.dbWarned = true;
        this.deps.onWarning?.(DB_UNAVAILABLE_WARNING);
      }
      this.store = this.deps.openMemoryStore();
    }
    this.notify();
    this.startScan();
  }

  /**
   * Cancel any in-progress scan and begin a new one. The walk runs in the
   * background; callers observe progress via {@link subscribe}.
   */
  startScan(): void {
    this.scanController?.abort();
    const controller = new AbortController();
    this.scanController = controller;
    this.status = 'scanning';
    this.notify();
    void this.runScan(controller);
  }

  private async runScan(controller: AbortController): Promise<void> {
    const signal = controller.signal;
    const now = this.deps.now?.() ?? Date.now();
    const roots = this.deps.workspaceRoots();

    try {
      for await (const repo of scanRepos(roots, this.deps.fs, { signal })) {
        if (signal.aborted) break;
        const result = this.store.upsert({
          root: repo.root,
          source: repo.source,
          lastSeenMs: now,
        });
        if (result === 'rejected') {
          if (!this.capWarned) {
            this.capWarned = true;
            this.deps.onWarning?.(CAPPED_WARNING);
          }
        } else {
          // List changed (added) or entry refreshed (updated); notify either way.
          this.notify();
        }
      }

      if (!signal.aborted) {
        const entries = this.store.getEntries();
        const existing = new Set<string>();
        for (const entry of entries) {
          if (signal.aborted) break;
          try {
            if (await this.deps.fs.exists(entry.root)) {
              existing.add(entry.root);
            }
          } catch {
            // Treat inaccessible roots as missing so they get pruned.
          }
        }
        if (!signal.aborted) {
          const removed = this.store.pruneMissing((root) => existing.has(root));
          if (removed.length > 0) {
            this.notify();
          }
        }
      }
    } finally {
      // Only the active scan owns the status transition. A scan that was
      // superseded leaves status management to the newer scan.
      if (this.scanController === controller) {
        this.scanController = null;
        this.status = 'idle';
        this.notify();
      }
    }
  }

  /** Abort any in-progress scan and release the backing store. */
  dispose(): void {
    this.scanController?.abort();
    this.scanController = null;
    if (this.status !== 'idle') {
      this.status = 'idle';
      this.notify();
    }
    try {
      this.store.close();
    } catch {
      // ignore close errors during teardown
    }
    this.listeners.clear();
  }
}

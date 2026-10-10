import { MEMORY_REPO_CAP } from './constants.js';
import { normalizeRepoPath } from './pathNormalize.js';

export type RepoIndexEntry = {
  root: string;
  source: 'scan' | 'submodule';
  lastSeenMs: number;
};

export type RepoIndexStore = {
  getEntries(): readonly RepoIndexEntry[];
  upsert(entry: RepoIndexEntry): 'added' | 'updated' | 'rejected';
  replaceAll(entries: readonly RepoIndexEntry[]): void;
  pruneMissing(exists: (root: string) => boolean): string[];
  close(): void;
  readonly mode: 'memory' | 'sqlite';
};

export function createMemoryRepoIndexStore(
  cap: number = MEMORY_REPO_CAP,
): RepoIndexStore {
  const entries = new Map<string, RepoIndexEntry>();

  function normalizeEntry(entry: RepoIndexEntry): RepoIndexEntry {
    return { ...entry, root: normalizeRepoPath(entry.root) };
  }

  return {
    mode: 'memory',

    getEntries(): readonly RepoIndexEntry[] {
      return [...entries.values()];
    },

    upsert(entry: RepoIndexEntry): 'added' | 'updated' | 'rejected' {
      const normalized = normalizeEntry(entry);
      if (entries.has(normalized.root)) {
        entries.set(normalized.root, normalized);
        return 'updated';
      }
      if (entries.size >= cap) {
        return 'rejected';
      }
      entries.set(normalized.root, normalized);
      return 'added';
    },

    replaceAll(items: readonly RepoIndexEntry[]): void {
      entries.clear();
      for (const item of items) {
        const normalized = normalizeEntry(item);
        entries.set(normalized.root, normalized);
      }
    },

    pruneMissing(exists: (root: string) => boolean): string[] {
      const removed: string[] = [];
      for (const root of [...entries.keys()]) {
        if (!exists(root)) {
          entries.delete(root);
          removed.push(root);
        }
      }
      return removed;
    },

    close(): void {
      // no-op for in-memory store
    },
  };
}

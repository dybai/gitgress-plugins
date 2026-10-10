import { describe, expect, it } from 'vitest';
import { MEMORY_REPO_CAP } from '../../src/repoIndex/constants.js';
import {
  createMemoryRepoIndexStore,
  type RepoIndexEntry,
} from '../../src/repoIndex/repoIndexStore.js';

function entry(
  root: string,
  overrides: Partial<Omit<RepoIndexEntry, 'root'>> = {},
): RepoIndexEntry {
  return {
    root,
    source: 'scan',
    lastSeenMs: 100,
    ...overrides,
  };
}

describe('createMemoryRepoIndexStore', () => {
  it('exposes memory mode and default cap constant', () => {
    const store = createMemoryRepoIndexStore();
    expect(store.mode).toBe('memory');
    expect(MEMORY_REPO_CAP).toBe(2000);
  });

  it('upsert adds a new entry and returns added', () => {
    const store = createMemoryRepoIndexStore();
    expect(store.upsert(entry('/a/repo'))).toBe('added');
    expect(store.getEntries()).toEqual([
      { root: '/a/repo', source: 'scan', lastSeenMs: 100 },
    ]);
  });

  it('upsert updates an existing root and returns updated', () => {
    const store = createMemoryRepoIndexStore();
    store.upsert(entry('/a/repo', { lastSeenMs: 1 }));
    expect(
      store.upsert(entry('/a/repo', { source: 'submodule', lastSeenMs: 2 })),
    ).toBe('updated');
    expect(store.getEntries()).toEqual([
      { root: '/a/repo', source: 'submodule', lastSeenMs: 2 },
    ]);
  });

  it('normalizes root on upsert so paths dedupe', () => {
    const store = createMemoryRepoIndexStore();
    expect(store.upsert(entry('D:\\proj\\'))).toBe('added');
    expect(store.upsert(entry('d:/proj', { lastSeenMs: 200 }))).toBe('updated');
    expect(store.getEntries()).toHaveLength(1);
    expect(store.getEntries()[0]).toEqual({
      root: 'd:/proj',
      source: 'scan',
      lastSeenMs: 200,
    });
  });

  it('rejects new roots at cap but still updates existing', () => {
    const store = createMemoryRepoIndexStore(2);
    expect(store.upsert(entry('/a'))).toBe('added');
    expect(store.upsert(entry('/b'))).toBe('added');
    expect(store.upsert(entry('/c'))).toBe('rejected');
    expect(store.getEntries()).toHaveLength(2);
    expect(store.upsert(entry('/a', { lastSeenMs: 999 }))).toBe('updated');
    expect(store.getEntries()).toContainEqual(
      entry('/a', { lastSeenMs: 999 }),
    );
  });

  it('replaceAll replaces entries with normalized roots', () => {
    const store = createMemoryRepoIndexStore();
    store.upsert(entry('/old'));
    store.replaceAll([
      entry('C:\\new\\'),
      entry('/other', { source: 'submodule', lastSeenMs: 50 }),
    ]);
    expect(store.getEntries()).toEqual([
      { root: 'c:/new', source: 'scan', lastSeenMs: 100 },
      { root: '/other', source: 'submodule', lastSeenMs: 50 },
    ]);
  });

  it('pruneMissing removes entries whose root fails exists check', () => {
    const store = createMemoryRepoIndexStore();
    store.upsert(entry('/keep'));
    store.upsert(entry('/gone'));
    const removed = store.pruneMissing((root) => root !== '/gone');
    expect(removed).toEqual(['/gone']);
    expect(store.getEntries()).toEqual([
      { root: '/keep', source: 'scan', lastSeenMs: 100 },
    ]);
  });

  it('close is safe to call on memory store', () => {
    const store = createMemoryRepoIndexStore();
    store.upsert(entry('/a'));
    expect(() => store.close()).not.toThrow();
    expect(store.getEntries()).toHaveLength(1);
  });
});

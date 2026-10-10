import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  createSqliteRepoIndexStore,
  RepoIndexDbError,
} from '../../src/repoIndex/sqliteRepoIndexStore.js';
import type { RepoIndexEntry } from '../../src/repoIndex/repoIndexStore.js';

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

let tmpDir: string;

function tmpDbPath(): string {
  return path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'gitgress-sqlite-')),
    'repos.sqlite',
  );
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitgress-sqlite-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('createSqliteRepoIndexStore', () => {
  it('exposes sqlite mode', async () => {
    const dbFilePath = path.join(tmpDir, 'repos.sqlite');
    const store = await createSqliteRepoIndexStore(dbFilePath);
    expect(store.mode).toBe('sqlite');
    store.close();
  });

  it('creates an empty DB file on disk when none exists', async () => {
    const dbFilePath = path.join(tmpDir, 'repos.sqlite');
    expect(fs.existsSync(dbFilePath)).toBe(false);
    const store = await createSqliteRepoIndexStore(dbFilePath);
    store.upsert(entry('/a/repo'));
    store.close();
    expect(fs.existsSync(dbFilePath)).toBe(true);
    expect(fs.statSync(dbFilePath).size).toBeGreaterThan(0);
  });

  it('persists upserts across a new store instance on the same path', async () => {
    const dbFilePath = path.join(tmpDir, 'repos.sqlite');
    const store1 = await createSqliteRepoIndexStore(dbFilePath);
    expect(store1.upsert(entry('/a/repo', { lastSeenMs: 1 }))).toBe('added');
    expect(store1.upsert(entry('/b/repo', { source: 'submodule', lastSeenMs: 2 }))).toBe(
      'added',
    );
    store1.close();

    const store2 = await createSqliteRepoIndexStore(dbFilePath);
    const entries = store2.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual({
      root: '/a/repo',
      source: 'scan',
      lastSeenMs: 1,
    });
    expect(entries).toContainEqual({
      root: '/b/repo',
      source: 'submodule',
      lastSeenMs: 2,
    });
    store2.close();
  });

  it('updates an existing root and returns updated', async () => {
    const dbFilePath = path.join(tmpDir, 'repos.sqlite');
    const store = await createSqliteRepoIndexStore(dbFilePath);
    store.upsert(entry('/a/repo', { lastSeenMs: 1 }));
    expect(
      store.upsert(entry('/a/repo', { source: 'submodule', lastSeenMs: 2 })),
    ).toBe('updated');
    expect(store.getEntries()).toEqual([
      { root: '/a/repo', source: 'submodule', lastSeenMs: 2 },
    ]);
    store.close();
  });

  it('normalizes root on upsert so paths dedupe', async () => {
    const dbFilePath = path.join(tmpDir, 'repos.sqlite');
    const store = await createSqliteRepoIndexStore(dbFilePath);
    expect(store.upsert(entry('D:\\proj\\'))).toBe('added');
    expect(store.upsert(entry('d:/proj', { lastSeenMs: 200 }))).toBe('updated');
    expect(store.getEntries()).toHaveLength(1);
    expect(store.getEntries()[0]).toEqual({
      root: 'd:/proj',
      source: 'scan',
      lastSeenMs: 200,
    });
    store.close();
  });

  it('replaceAll replaces entries and persists', async () => {
    const dbFilePath = path.join(tmpDir, 'repos.sqlite');
    const store = await createSqliteRepoIndexStore(dbFilePath);
    store.upsert(entry('/old'));
    store.replaceAll([
      entry('C:\\new\\'),
      entry('/other', { source: 'submodule', lastSeenMs: 50 }),
    ]);
    expect(store.getEntries()).toEqual([
      { root: 'c:/new', source: 'scan', lastSeenMs: 100 },
      { root: '/other', source: 'submodule', lastSeenMs: 50 },
    ]);
    store.close();

    const store2 = await createSqliteRepoIndexStore(dbFilePath);
    expect(store2.getEntries()).toEqual([
      { root: 'c:/new', source: 'scan', lastSeenMs: 100 },
      { root: '/other', source: 'submodule', lastSeenMs: 50 },
    ]);
    store2.close();
  });

  it('replaceAll dedupes normalized roots with last-value-wins like the memory store', async () => {
    const dbFilePath = path.join(tmpDir, 'repos.sqlite');
    const store = await createSqliteRepoIndexStore(dbFilePath);
    store.upsert(entry('/keep-me-until-replace'));
    store.upsert(entry('/also-old'));
    store.replaceAll([
      entry('D:\\proj\\', { lastSeenMs: 1 }),
      entry('d:/proj', { source: 'submodule', lastSeenMs: 999 }),
    ]);
    expect(store.getEntries()).toEqual([
      { root: 'd:/proj', source: 'submodule', lastSeenMs: 999 },
    ]);
    store.close();

    const store2 = await createSqliteRepoIndexStore(dbFilePath);
    expect(store2.getEntries()).toEqual([
      { root: 'd:/proj', source: 'submodule', lastSeenMs: 999 },
    ]);
    store2.close();
  });

  it('pruneMissing removes entries whose root fails exists check and persists', async () => {
    const dbFilePath = path.join(tmpDir, 'repos.sqlite');
    const store = await createSqliteRepoIndexStore(dbFilePath);
    store.upsert(entry('/keep'));
    store.upsert(entry('/gone'));
    const removed = store.pruneMissing((root) => root !== '/gone');
    expect(removed).toEqual(['/gone']);
    expect(store.getEntries()).toEqual([
      { root: '/keep', source: 'scan', lastSeenMs: 100 },
    ]);
    store.close();

    const store2 = await createSqliteRepoIndexStore(dbFilePath);
    expect(store2.getEntries()).toEqual([
      { root: '/keep', source: 'scan', lastSeenMs: 100 },
    ]);
    store2.close();
  });

  it('does not cap entries (uncapped store)', async () => {
    const dbFilePath = path.join(tmpDir, 'repos.sqlite');
    const store = await createSqliteRepoIndexStore(dbFilePath);
    // Two upserts persist; store is uncapped so neither is rejected.
    expect(store.upsert(entry('/r1'))).toBe('added');
    expect(store.upsert(entry('/r2'))).toBe('added');
    // Sanity: uncapped means a third distinct root is also added, never rejected.
    expect(store.upsert(entry('/r3'))).toBe('added');
    expect(store.getEntries()).toHaveLength(3);
    store.close();
  });

  it('throws RepoIndexDbError when opening a zero-byte db file', async () => {
    const dbFilePath = path.join(tmpDir, 'repos.sqlite');
    fs.writeFileSync(dbFilePath, Buffer.alloc(0));
    await expect(createSqliteRepoIndexStore(dbFilePath)).rejects.toBeInstanceOf(
      RepoIndexDbError,
    );
  });

  it('throws RepoIndexDbError when opening a truncated db file shorter than the SQLite header', async () => {
    const dbFilePath = path.join(tmpDir, 'repos.sqlite');
    fs.writeFileSync(dbFilePath, Buffer.from([0x00]));
    await expect(createSqliteRepoIndexStore(dbFilePath)).rejects.toBeInstanceOf(
      RepoIndexDbError,
    );
  });

  it('throws RepoIndexDbError when opening a corrupt db file', async () => {
    const dbFilePath = path.join(tmpDir, 'repos.sqlite');
    fs.writeFileSync(dbFilePath, Buffer.from('not a sqlite database file!!!'));
    await expect(createSqliteRepoIndexStore(dbFilePath)).rejects.toBeInstanceOf(
      RepoIndexDbError,
    );
  });

  it('RepoIndexDbError carries a message and the db file path', async () => {
    const dbFilePath = path.join(tmpDir, 'repos.sqlite');
    fs.writeFileSync(dbFilePath, Buffer.from('corrupt garbage bytes'));
    try {
      await createSqliteRepoIndexStore(dbFilePath);
      throw new Error('expected createSqliteRepoIndexStore to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(RepoIndexDbError);
      const e = err as RepoIndexDbError;
      expect(typeof e.message).toBe('string');
      expect(e.message.length).toBeGreaterThan(0);
      expect(e.dbFilePath).toBe(dbFilePath);
    }
  });

  it('close flushes the latest state so a subsequent open reads it', async () => {
    const dbFilePath = path.join(tmpDir, 'repos.sqlite');
    const store = await createSqliteRepoIndexStore(dbFilePath);
    store.upsert(entry('/flushed'));
    store.close();

    const store2 = await createSqliteRepoIndexStore(dbFilePath);
    expect(store2.getEntries()).toEqual([
      { root: '/flushed', source: 'scan', lastSeenMs: 100 },
    ]);
    store2.close();
  });
});

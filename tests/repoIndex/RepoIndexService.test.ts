import { describe, expect, it } from 'vitest';
import { MEMORY_REPO_CAP } from '../../src/repoIndex/constants.js';
import { RepoIndexService } from '../../src/repoIndex/RepoIndexService.js';
import { RepoIndexDbError } from '../../src/repoIndex/sqliteRepoIndexStore.js';
import {
  createMemoryRepoIndexStore,
  type RepoIndexStore,
} from '../../src/repoIndex/repoIndexStore.js';
import type { ScanFs } from '../../src/repoIndex/scanRepos.js';

type FsEntry = { kind: 'dir'; names: string[] } | { kind: 'file'; content: string };

function makeFs(entries: Record<string, FsEntry>): ScanFs {
  const map = new Map(Object.entries(entries));
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
  return {
    async readdir(path: string): Promise<string[]> {
      const p = norm(path);
      const e = map.get(p);
      if (!e || e.kind !== 'dir') throw new Error(`not a dir ${p}`);
      return [...e.names];
    },
    async exists(path: string): Promise<boolean> {
      return map.has(norm(path));
    },
    async readFile(path: string): Promise<string> {
      const p = norm(path);
      const e = map.get(p);
      if (!e || e.kind !== 'file') throw new Error(`not a file ${p}`);
      return e.content;
    },
    async isDirectory(path: string): Promise<boolean> {
      const e = map.get(norm(path));
      return !!e && e.kind === 'dir';
    },
  };
}

function waitForIdle(service: RepoIndexService): Promise<void> {
  return new Promise((resolve) => {
    if (service.getScanStatus() === 'idle') {
      resolve();
      return;
    }
    const unsub = service.subscribe(() => {
      if (service.getScanStatus() === 'idle') {
        unsub();
        resolve();
      }
    });
  });
}

describe('RepoIndexService', () => {
  it('start scans workspace roots and discovers repos', async () => {
    const fs = makeFs({
      '/ws': { kind: 'dir', names: ['a', 'b'] },
      '/ws/a': { kind: 'dir', names: ['.git'] },
      '/ws/a/.git': { kind: 'dir', names: [] },
      '/ws/b': { kind: 'dir', names: ['.git'] },
      '/ws/b/.git': { kind: 'dir', names: [] },
    });
    const service = new RepoIndexService({
      workspaceRoots: () => ['/ws'],
      fs,
      openStore: async () => createMemoryRepoIndexStore(),
      openMemoryStore: () => createMemoryRepoIndexStore(),
    });

    await service.start();
    await waitForIdle(service);

    expect(service.getRepos().sort()).toEqual(['/ws/a', '/ws/b']);
    service.dispose();
  });

  it('transitions status from scanning to idle and notifies subscribers', async () => {
    const fs = makeFs({
      '/ws': { kind: 'dir', names: ['repo'] },
      '/ws/repo': { kind: 'dir', names: ['.git'] },
      '/ws/repo/.git': { kind: 'dir', names: [] },
    });
    const service = new RepoIndexService({
      workspaceRoots: () => ['/ws'],
      fs,
      openStore: async () => createMemoryRepoIndexStore(),
      openMemoryStore: () => createMemoryRepoIndexStore(),
    });

    const statuses: ScanStatusLike[] = [];
    service.subscribe(() => statuses.push(service.getScanStatus()));

    await service.start();
    expect(service.getScanStatus()).toBe('scanning');
    await waitForIdle(service);
    expect(service.getScanStatus()).toBe('idle');
    expect(statuses).toContain('scanning');
    expect(statuses).toContain('idle');
    service.dispose();
  });

  it('falls back to memory store with a warning when openStore throws', async () => {
    const fs = makeFs({
      '/ws': { kind: 'dir', names: ['repo'] },
      '/ws/repo': { kind: 'dir', names: ['.git'] },
      '/ws/repo/.git': { kind: 'dir', names: [] },
    });
    const warnings: string[] = [];
    const service = new RepoIndexService({
      workspaceRoots: () => ['/ws'],
      fs,
      openStore: async () => {
        throw new RepoIndexDbError('corrupt', '/x/repos.sqlite');
      },
      openMemoryStore: () => createMemoryRepoIndexStore(),
      onWarning: (m) => warnings.push(m),
    });

    await service.start();
    await waitForIdle(service);

    expect(warnings).toEqual([
      'GitGress: Repository index unavailable; using in-memory cache.',
    ]);
    expect(service.getRepos()).toEqual(['/ws/repo']);
    service.dispose();
  });

  it('emits DB unavailable warning only once per session', async () => {
    const fs = makeFs({
      '/ws': { kind: 'dir', names: ['repo'] },
      '/ws/repo': { kind: 'dir', names: ['.git'] },
      '/ws/repo/.git': { kind: 'dir', names: [] },
    });
    const warnings: string[] = [];
    const service = new RepoIndexService({
      workspaceRoots: () => ['/ws'],
      fs,
      openStore: async () => {
        throw new RepoIndexDbError('corrupt', '/x/repos.sqlite');
      },
      openMemoryStore: () => createMemoryRepoIndexStore(),
      onWarning: (m) => warnings.push(m),
    });

    await service.start();
    await waitForIdle(service);
    service.startScan();
    await waitForIdle(service);

    expect(warnings).toEqual([
      'GitGress: Repository index unavailable; using in-memory cache.',
    ]);
    service.dispose();
  });

  it('emits capped warning once when upsert rejects', async () => {
    const fs = makeFs({
      '/ws': { kind: 'dir', names: ['a', 'b'] },
      '/ws/a': { kind: 'dir', names: ['.git'] },
      '/ws/a/.git': { kind: 'dir', names: [] },
      '/ws/b': { kind: 'dir', names: ['.git'] },
      '/ws/b/.git': { kind: 'dir', names: [] },
    });
    const warnings: string[] = [];
    const service = new RepoIndexService({
      workspaceRoots: () => ['/ws'],
      fs,
      openStore: async () => createMemoryRepoIndexStore(1),
      openMemoryStore: () => createMemoryRepoIndexStore(1),
      onWarning: (m) => warnings.push(m),
    });

    await service.start();
    await waitForIdle(service);

    expect(warnings).toEqual([
      `GitGress: Repository index capped at ${MEMORY_REPO_CAP} entries.`,
    ]);
    service.dispose();
  });

  it('prunes missing repos on scan completion', async () => {
    const fs = makeFs({
      '/ws': { kind: 'dir', names: ['keep'] },
      '/ws/keep': { kind: 'dir', names: ['.git'] },
      '/ws/keep/.git': { kind: 'dir', names: [] },
    });
    const store = createMemoryRepoIndexStore();
    store.upsert({ root: '/ws/gone', source: 'scan', lastSeenMs: 1 });
    const service = new RepoIndexService({
      workspaceRoots: () => ['/ws'],
      fs,
      openStore: async () => store,
      openMemoryStore: () => createMemoryRepoIndexStore(),
    });

    await service.start();
    await waitForIdle(service);

    expect(service.getRepos()).toEqual(['/ws/keep']);
    service.dispose();
  });

  it('aborts the first walk when startScan is called again', async () => {
    const baseFs = makeFs({
      '/ws': { kind: 'dir', names: ['a', 'b'] },
      '/ws/a': { kind: 'dir', names: ['.git'] },
      '/ws/a/.git': { kind: 'dir', names: [] },
      '/ws/b': { kind: 'dir', names: ['.git'] },
      '/ws/b/.git': { kind: 'dir', names: [] },
    });
    const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
    let resolveFirstExists!: (v: boolean) => void;
    let notifyFirstReached!: () => void;
    const firstReached = new Promise<void>((r) => {
      notifyFirstReached = r;
    });
    const firstExists = new Promise<boolean>((r) => {
      resolveFirstExists = r;
    });
    const fs: ScanFs = {
      ...baseFs,
      async exists(path: string): Promise<boolean> {
        if (norm(path) === '/ws/a/.git') {
          notifyFirstReached();
          return firstExists;
        }
        return baseFs.exists(path);
      },
    };
    const warnings: string[] = [];
    const service = new RepoIndexService({
      workspaceRoots: () => ['/ws'],
      fs,
      openStore: async () => createMemoryRepoIndexStore(),
      openMemoryStore: () => createMemoryRepoIndexStore(),
      onWarning: (m) => warnings.push(m),
    });

    service.startScan();
    await firstReached;

    // Second scan aborts the first; resolve the first's pending exists so the
    // aborted walk can unwind. The first walk must NOT add /ws/a.
    service.startScan();
    resolveFirstExists(false);
    await waitForIdle(service);

    expect(service.getRepos()).toEqual(['/ws/b']);
    expect(warnings).toEqual([]);
    service.dispose();
  });

  it('dispose during pending openStore prevents scan and closes resolved store', async () => {
    const fs = makeFs({
      '/ws': { kind: 'dir', names: ['repo'] },
      '/ws/repo': { kind: 'dir', names: ['.git'] },
      '/ws/repo/.git': { kind: 'dir', names: [] },
    });
    let resolveOpen!: (store: RepoIndexStore) => void;
    const openPending = new Promise<RepoIndexStore>((resolve) => {
      resolveOpen = resolve;
    });
    let lateStoreClosed = false;
    const base = createMemoryRepoIndexStore();
    const lateStore: RepoIndexStore = {
      ...base,
      getEntries: () => base.getEntries(),
      upsert: (e) => base.upsert(e),
      replaceAll: (e) => base.replaceAll(e),
      pruneMissing: (exists) => base.pruneMissing(exists),
      close() {
        lateStoreClosed = true;
        base.close();
      },
      mode: base.mode,
    };

    const service = new RepoIndexService({
      workspaceRoots: () => ['/ws'],
      fs,
      openStore: async () => openPending,
      openMemoryStore: () => createMemoryRepoIndexStore(),
    });

    const statuses: ScanStatusLike[] = [];
    service.subscribe(() => statuses.push(service.getScanStatus()));

    const startPromise = service.start();
    service.dispose();
    resolveOpen(lateStore);
    await startPromise;

    expect(lateStoreClosed).toBe(true);
    expect(service.getScanStatus()).toBe('idle');
    expect(service.getRepos()).toEqual([]);
    expect(statuses).not.toContain('scanning');
  });

  it('dispose aborts an in-progress scan', async () => {
    const baseFs = makeFs({
      '/ws': { kind: 'dir', names: ['a'] },
      '/ws/a': { kind: 'dir', names: ['.git'] },
      '/ws/a/.git': { kind: 'dir', names: [] },
    });
    const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
    let resolveExists!: (v: boolean) => void;
    let notifyReached!: () => void;
    const reached = new Promise<void>((r) => {
      notifyReached = r;
    });
    const pending = new Promise<boolean>((r) => {
      resolveExists = r;
    });
    const fs: ScanFs = {
      ...baseFs,
      async exists(path: string): Promise<boolean> {
        if (norm(path) === '/ws/a/.git') {
          notifyReached();
          return pending;
        }
        return baseFs.exists(path);
      },
    };
    const service = new RepoIndexService({
      workspaceRoots: () => ['/ws'],
      fs,
      openStore: async () => createMemoryRepoIndexStore(),
      openMemoryStore: () => createMemoryRepoIndexStore(),
    });

    service.startScan();
    await reached;
    service.dispose();
    resolveExists(true);

    expect(service.getScanStatus()).toBe('idle');
    expect(service.getRepos()).toEqual([]);
  });

  it('subscribe returns an unsubscribe that stops notifications', async () => {
    const fs = makeFs({
      '/ws': { kind: 'dir', names: ['repo'] },
      '/ws/repo': { kind: 'dir', names: ['.git'] },
      '/ws/repo/.git': { kind: 'dir', names: [] },
    });
    const service = new RepoIndexService({
      workspaceRoots: () => ['/ws'],
      fs,
      openStore: async () => createMemoryRepoIndexStore(),
      openMemoryStore: () => createMemoryRepoIndexStore(),
    });

    let count = 0;
    const unsub = service.subscribe(() => count++);
    unsub();

    await service.start();
    await waitForIdle(service);
    expect(count).toBe(0);
    service.dispose();
  });
});

type ScanStatusLike = 'idle' | 'scanning';

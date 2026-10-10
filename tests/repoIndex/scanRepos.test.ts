import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCAN_IGNORE_DIR_NAMES,
  scanRepos,
  type ScanFs,
} from '../../src/repoIndex/scanRepos.js';

type FsEntry = { kind: 'dir'; names: string[] } | { kind: 'file'; content: string };

function makeFs(entries: Record<string, FsEntry>, throwsOn?: string[]): ScanFs {
  const map = new Map(Object.entries(entries));
  const shouldThrow = (p: string) => throwsOn?.includes(p) ?? false;
  const norm = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '');
  const fs: ScanFs = {
    async readdir(path: string): Promise<string[]> {
      const p = norm(path);
      if (shouldThrow(p)) throw new Error(`readdir ${p}`);
      const e = map.get(p);
      if (!e || e.kind !== 'dir') throw new Error(`not a dir ${p}`);
      return [...e.names];
    },
    async exists(path: string): Promise<boolean> {
      const p = norm(path);
      if (shouldThrow(p)) throw new Error(`exists ${p}`);
      return map.has(p);
    },
    async readFile(path: string): Promise<string> {
      const p = norm(path);
      if (shouldThrow(p)) throw new Error(`readFile ${p}`);
      const e = map.get(p);
      if (!e || e.kind !== 'file') throw new Error(`not a file ${p}`);
      return e.content;
    },
    async isDirectory(path: string): Promise<boolean> {
      const p = norm(path);
      if (shouldThrow(p)) throw new Error(`isDirectory ${p}`);
      const e = map.get(p);
      return !!e && e.kind === 'dir';
    },
  };
  return fs;
}

describe('DEFAULT_SCAN_IGNORE_DIR_NAMES', () => {
  it('includes common build/dep directories', () => {
    for (const name of ['node_modules', '.git', 'dist', 'build', '.venv', 'out']) {
      expect(DEFAULT_SCAN_IGNORE_DIR_NAMES.has(name)).toBe(true);
    }
  });
});

describe('scanRepos', () => {
  it('skips dirs in the default ignore set (node_modules)', async () => {
    const fs = makeFs({
      '/root': { kind: 'dir', names: ['node_modules', 'real'] },
      '/root/node_modules': { kind: 'dir', names: ['.git'] },
      '/root/node_modules/.git': { kind: 'dir', names: [] },
      '/root/real': { kind: 'dir', names: ['.git'] },
      '/root/real/.git': { kind: 'dir', names: [] },
    });
    const out = [];
    for await (const r of scanRepos(['/root'], fs)) out.push(r);
    expect(out).toEqual([{ root: '/root/real', source: 'scan' }]);
  });

  it('discovers a deeply nested repo by descending', async () => {
    const fs = makeFs({
      '/ws': { kind: 'dir', names: ['deep'] },
      '/ws/deep': { kind: 'dir', names: ['lib'] },
      '/ws/deep/lib': { kind: 'dir', names: ['.git'] },
      '/ws/deep/lib/.git': { kind: 'dir', names: [] },
    });
    const out = [];
    for await (const r of scanRepos(['/ws'], fs)) out.push(r);
    expect(out).toEqual([{ root: '/ws/deep/lib', source: 'scan' }]);
  });

  it('does not descend into a discovered git root', async () => {
    const fs = makeFs({
      '/ws': { kind: 'dir', names: ['repo'] },
      '/ws/repo': { kind: 'dir', names: ['.git', 'nested-git'] },
      '/ws/repo/.git': { kind: 'dir', names: [] },
      '/ws/repo/nested-git': { kind: 'dir', names: ['.git'] },
      '/ws/repo/nested-git/.git': { kind: 'dir', names: [] },
    });
    const out = [];
    for await (const r of scanRepos(['/ws'], fs)) out.push(r);
    expect(out).toEqual([{ root: '/ws/repo', source: 'scan' }]);
  });

  it('yields submodules listed in .gitmodules', async () => {
    const fs = makeFs({
      '/ws': { kind: 'dir', names: ['with-sub'] },
      '/ws/with-sub': { kind: 'dir', names: ['.git', '.gitmodules', 'sub'] },
      '/ws/with-sub/.git': { kind: 'dir', names: [] },
      '/ws/with-sub/.gitmodules': {
        kind: 'file',
        content: '[submodule "sub"]\n\tpath = sub\n\turl = ./sub.git\n',
      },
      '/ws/with-sub/sub': { kind: 'dir', names: ['.git'] },
      '/ws/with-sub/sub/.git': { kind: 'dir', names: [] },
    });
    const out = [];
    for await (const r of scanRepos(['/ws'], fs)) out.push(r);
    expect(out).toEqual([
      { root: '/ws/with-sub', source: 'scan' },
      { root: '/ws/with-sub/sub', source: 'submodule' },
    ]);
  });

  it('stops yielding once the abort signal fires', async () => {
    const fs = makeFs({
      '/ws': { kind: 'dir', names: ['a', 'b'] },
      '/ws/a': { kind: 'dir', names: ['.git'] },
      '/ws/a/.git': { kind: 'dir', names: [] },
      '/ws/b': { kind: 'dir', names: ['.git'] },
      '/ws/b/.git': { kind: 'dir', names: [] },
    });
    const ctrl = new AbortController();
    const out = [];
    for await (const r of scanRepos(['/ws'], fs, { signal: ctrl.signal })) {
      out.push(r);
      ctrl.abort();
    }
    expect(out).toHaveLength(1);
    expect(out[0].root).toBe('/ws/a');
  });

  it('skips entries whose readdir or isDirectory fails', async () => {
    const fs = makeFs(
      {
        '/ws': { kind: 'dir', names: ['broken', 'good'] },
        '/ws/good': { kind: 'dir', names: ['.git'] },
        '/ws/good/.git': { kind: 'dir', names: [] },
      },
      ['/ws/broken'],
    );
    const out = [];
    for await (const r of scanRepos(['/ws'], fs)) out.push(r);
    expect(out).toEqual([{ root: '/ws/good', source: 'scan' }]);
  });

  it('honors a custom ignore set', async () => {
    const fs = makeFs({
      '/ws': { kind: 'dir', names: ['vendor', 'real'] },
      '/ws/vendor': { kind: 'dir', names: ['.git'] },
      '/ws/vendor/.git': { kind: 'dir', names: [] },
      '/ws/real': { kind: 'dir', names: ['.git'] },
      '/ws/real/.git': { kind: 'dir', names: [] },
    });
    const out = [];
    for await (const r of scanRepos(['/ws'], fs, { ignoreDirNames: new Set(['vendor']) }))
      out.push(r);
    expect(out).toEqual([{ root: '/ws/real', source: 'scan' }]);
  });
});

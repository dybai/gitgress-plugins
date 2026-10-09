import { describe, expect, it } from 'vitest';
import { buildFileTree } from '../../../src/views/files/buildFileTree';

describe('buildFileTree', () => {
  it('builds nested dirs from flat paths with status on files', () => {
    const tree = buildFileTree(
      [
        { path: 'src/a.ts', status: 'M' },
        { path: 'src/b/c.ts', status: 'A' },
      ],
      { compact: false },
    );

    expect(tree).toEqual([
      {
        name: 'src',
        path: 'src',
        kind: 'dir',
        children: [
          {
            name: 'b',
            path: 'src/b',
            kind: 'dir',
            children: [
              {
                name: 'c.ts',
                path: 'src/b/c.ts',
                kind: 'file',
                status: 'A',
                additions: 0,
                deletions: 0,
              },
            ],
          },
          {
            name: 'a.ts',
            path: 'src/a.ts',
            kind: 'file',
            status: 'M',
            additions: 0,
            deletions: 0,
          },
        ],
      },
    ]);
  });

  it('returns empty array for no files', () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it('sorts siblings with dirs first then by name', () => {
    const tree = buildFileTree([
      { path: 'root/z.ts', status: 'M' },
      { path: 'root/a.ts', status: 'M' },
      { path: 'root/middle/n.ts', status: 'M' },
    ]);

    expect(tree[0].children?.map((n) => n.name)).toEqual(['middle', 'a.ts', 'z.ts']);
  });

  it('compacts single-child directory chains by default', () => {
    const tree = buildFileTree([
      { path: 'src/views/commits/a.ts', status: 'M', additions: 1, deletions: 0 },
    ]);
    expect(tree).toEqual([
      {
        name: 'src/views/commits',
        path: 'src/views/commits',
        kind: 'dir',
        children: [
          {
            name: 'a.ts',
            path: 'src/views/commits/a.ts',
            kind: 'file',
            status: 'M',
            additions: 1,
            deletions: 0,
          },
        ],
      },
    ]);
  });

  it('does not compact when compact is false', () => {
    const tree = buildFileTree(
      [{ path: 'src/a.ts', status: 'M', additions: 0, deletions: 0 }],
      { compact: false },
    );
    expect(tree[0]).toMatchObject({ name: 'src', kind: 'dir' });
    expect(tree[0].children?.[0]).toMatchObject({ name: 'a.ts', kind: 'file' });
  });
});

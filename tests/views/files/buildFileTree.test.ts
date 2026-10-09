import { describe, expect, it } from 'vitest';
import { buildFileTree } from '../../../src/views/files/buildFileTree';

describe('buildFileTree', () => {
  it('builds nested dirs from flat paths with status on files', () => {
    const tree = buildFileTree([
      { path: 'src/a.ts', status: 'M' },
      { path: 'src/b/c.ts', status: 'A' },
    ]);

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
              },
            ],
          },
          {
            name: 'a.ts',
            path: 'src/a.ts',
            kind: 'file',
            status: 'M',
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
});

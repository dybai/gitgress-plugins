import { describe, expect, it } from 'vitest';
import { buildFileList } from '../../../src/views/files/buildFileList';

describe('buildFileList', () => {
  it('flattens to basename + parent directory with stats', () => {
    expect(
      buildFileList([
        { path: 'src/views/a.ts', status: 'M', additions: 2, deletions: 1 },
        { path: 'z.ts', status: 'A', additions: 3, deletions: 0 },
      ]),
    ).toEqual([
      {
        name: 'a.ts',
        directory: 'src/views',
        path: 'src/views/a.ts',
        status: 'M',
        additions: 2,
        deletions: 1,
      },
      {
        name: 'z.ts',
        directory: '',
        path: 'z.ts',
        status: 'A',
        additions: 3,
        deletions: 0,
      },
    ]);
  });
});

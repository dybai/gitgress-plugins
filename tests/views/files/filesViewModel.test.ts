import { describe, expect, it } from 'vitest';
import { filesViewModel } from '../../../src/views/files/filesViewModel';

describe('filesViewModel', () => {
  it('asks for a commit when none is selected', () => {
    expect(filesViewModel(null, null)).toEqual({
      mode: 'empty',
      message: 'Select a commit',
    });
  });

  it('shows an error instead of file data', () => {
    expect(
      filesViewModel(
        'abc123',
        [{ path: 'src/a.ts', status: 'M', additions: 1, deletions: 2 }],
        'Unable to load changed files',
      ),
    ).toEqual({
      mode: 'error',
      message: 'Unable to load changed files',
    });
  });

  it('builds a file tree for the selected commit', () => {
    expect(
      filesViewModel('abc123', [
        { path: 'src/a.ts', status: 'M', additions: 1, deletions: 2 },
      ]),
    ).toEqual({
      mode: 'tree',
      tree: [
        {
          name: 'src',
          path: 'src',
          kind: 'dir',
          children: [
            {
              name: 'a.ts',
              path: 'src/a.ts',
              kind: 'file',
              status: 'M',
            },
          ],
        },
      ],
    });
  });
});

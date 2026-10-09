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

  it('returns flat files for the selected commit', () => {
    const files = [{ path: 'src/a.ts', status: 'M', additions: 1, deletions: 2 }];
    expect(filesViewModel('abc123', files)).toEqual({
      mode: 'loaded',
      files,
    });
  });
});

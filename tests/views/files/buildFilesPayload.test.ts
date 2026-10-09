import { describe, expect, it } from 'vitest';
import { isHostToFilesWebview } from '../../../src/protocol/filesMessages';
import { buildFilesMessage } from '../../../src/views/files/buildFilesPayload';

const files = [
  { status: 'M', path: 'a.ts', additions: 1, deletions: 2 },
  { status: 'R', path: 'b.ts', oldPath: 'c.ts', additions: 0, deletions: 0 },
];

describe('buildFilesMessage', () => {
  it('returns noCommit empty when no commit selected', () => {
    expect(buildFilesMessage({ repoRoot: null, commitId: null }, files, 'auto')).toEqual({
      type: 'filesEmpty',
      reason: 'noCommit',
      message: 'Select a commit',
    });
  });

  it('returns noFiles empty for commit with no files', () => {
    const msg = buildFilesMessage({ repoRoot: '/r', commitId: 'abc' }, [], 'auto');
    expect(msg).toEqual({ type: 'filesEmpty', reason: 'noFiles', message: 'No changed files' });
  });

  it('returns filesError when error is given', () => {
    const msg = buildFilesMessage({ repoRoot: '/r', commitId: 'abc' }, null, 'auto', 'boom');
    expect(msg).toEqual({ type: 'filesError', message: 'boom' });
  });

  it('resolves auto layout by file count', () => {
    const msg = buildFilesMessage({ repoRoot: '/r', commitId: 'abc' }, files, 'auto');
    expect(msg).toMatchObject({
      type: 'filesLoaded',
      layoutPreference: 'auto',
      effectiveLayout: 'list',
    });
    expect(isHostToFilesWebview(msg)).toBe(true);
  });

  it('honors explicit tree preference and many files', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      status: 'A',
      path: `f${i}.ts`,
      additions: 1,
      deletions: 0,
    }));
    expect(
      buildFilesMessage({ repoRoot: '/r', commitId: 'abc' }, many, 'auto'),
    ).toMatchObject({ effectiveLayout: 'tree' });
    expect(
      buildFilesMessage({ repoRoot: '/r', commitId: 'abc' }, files, 'tree'),
    ).toMatchObject({ effectiveLayout: 'tree', layoutPreference: 'tree' });
  });
});

import { describe, expect, it } from 'vitest';
import {
  matchesSelection,
  resolveLoadedTarget,
  type LoadedFiles,
} from '../../../src/views/files/loadedFiles';

const loadedA: LoadedFiles = {
  repoRoot: '/repo',
  commitId: 'aaa',
  files: [{ path: 'x.ts', status: 'M', additions: 0, deletions: 0 }],
};

describe('resolveLoadedTarget', () => {
  it('resolves a path when the loaded list matches the current selection', () => {
    expect(
      resolveLoadedTarget(loadedA, { repoRoot: '/repo', selectedCommitId: 'aaa' }, 'x.ts'),
    ).toEqual({ path: 'x.ts', status: 'M' });
  });

  it('rejects actions while a new commit selection is still loading', () => {
    expect(
      resolveLoadedTarget(loadedA, { repoRoot: '/repo', selectedCommitId: 'bbb' }, 'x.ts'),
    ).toBeUndefined();
  });

  it('rejects actions when the repo changed but the commit id is the same', () => {
    expect(
      resolveLoadedTarget(loadedA, { repoRoot: '/other', selectedCommitId: 'aaa' }, 'x.ts'),
    ).toBeUndefined();
  });

  it('rejects actions when nothing is loaded or selection is cleared', () => {
    expect(
      resolveLoadedTarget(null, { repoRoot: '/repo', selectedCommitId: 'aaa' }, 'x.ts'),
    ).toBeUndefined();
    expect(
      resolveLoadedTarget(loadedA, { repoRoot: null, selectedCommitId: null }, 'x.ts'),
    ).toBeUndefined();
  });

  it('returns undefined for paths not in the matching list', () => {
    expect(
      resolveLoadedTarget(loadedA, { repoRoot: '/repo', selectedCommitId: 'aaa' }, 'y.ts'),
    ).toBeUndefined();
  });
});

describe('matchesSelection', () => {
  it('is false for null loaded state', () => {
    expect(matchesSelection(null, { repoRoot: '/repo', selectedCommitId: 'aaa' })).toBe(false);
  });
});

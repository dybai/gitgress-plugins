import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  shouldAllowOpenWorkingFile,
  workingFileUriPath,
} from '../../src/commands/workingFile';
import { resolveDiffTarget } from '../../src/commands/diffTarget';

describe('shouldAllowOpenWorkingFile', () => {
  it('disallows open for deleted status', () => {
    expect(shouldAllowOpenWorkingFile('D')).toBe(false);
    expect(shouldAllowOpenWorkingFile('M')).toBe(true);
    expect(shouldAllowOpenWorkingFile('A')).toBe(true);
    expect(shouldAllowOpenWorkingFile('R')).toBe(true);
  });
});

describe('workingFileUriPath', () => {
  it('joins repo root and relative path', () => {
    const root = path.resolve('repo-root');
    expect(workingFileUriPath(root, 'src/a.ts')).toBe(path.join(root, 'src', 'a.ts'));
  });

  it('rejects paths escaping the repo root', () => {
    const root = path.resolve('repo-root');
    expect(workingFileUriPath(root, '../outside.ts')).toBeUndefined();
    expect(workingFileUriPath(root, path.resolve('other', 'x.ts'))).toBeUndefined();
  });
});

describe('resolveDiffTarget', () => {
  const files = [
    { path: 'a.ts', status: 'M' },
    { path: 'b.ts', status: 'D' },
  ];

  it('finds the file by path', () => {
    expect(resolveDiffTarget(files, 'b.ts')).toEqual({ path: 'b.ts', status: 'D' });
  });

  it('returns undefined for unknown path', () => {
    expect(resolveDiffTarget(files, 'nope.ts')).toBeUndefined();
  });
});

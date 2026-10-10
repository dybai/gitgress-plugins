import { describe, expect, it } from 'vitest';
import { GitCommandFailedError, NotARepositoryError } from '../../src/git/errors';
import { isInvalidSelectedRepositoryError } from '../../src/git/invalidRepository';

describe('isInvalidSelectedRepositoryError', () => {
  it('detects not-a-repository stderr from branch lookup', () => {
    expect(
      isInvalidSelectedRepositoryError(
        new GitCommandFailedError(['branch'], 'fatal: not a git repository', 128),
      ),
    ).toBe(true);
  });

  it('ignores unrelated git command failures', () => {
    expect(
      isInvalidSelectedRepositoryError(
        new GitCommandFailedError(['for-each-ref'], 'fatal: unable to read tree', 128),
      ),
    ).toBe(false);
  });

  it('accepts NotARepositoryError', () => {
    expect(isInvalidSelectedRepositoryError(new NotARepositoryError('/gone'))).toBe(true);
  });
});

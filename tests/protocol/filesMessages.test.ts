import { describe, expect, it } from 'vitest';
import {
  isFilesWebviewToHost,
  isHostToFilesWebview,
} from '../../src/protocol/filesMessages';

const validChangedFile = {
  path: 'src/foo.ts',
  status: 'M',
  additions: 3,
  deletions: 1,
};

function validFilesLoaded(overrides: Record<string, unknown> = {}) {
  return {
    type: 'filesLoaded' as const,
    commitId: 'abc123',
    repoRoot: '/repo',
    files: [validChangedFile],
    layoutPreference: 'auto' as const,
    effectiveLayout: 'list' as const,
    ...overrides,
  };
}

describe('isHostToFilesWebview', () => {
  it('accepts valid filesLoaded', () => {
    expect(isHostToFilesWebview(validFilesLoaded())).toBe(true);
  });

  it('accepts filesLoaded with optional oldPath on files', () => {
    expect(
      isHostToFilesWebview(
        validFilesLoaded({
          files: [{ ...validChangedFile, oldPath: 'src/old.ts' }],
        }),
      ),
    ).toBe(true);
  });

  it('rejects filesLoaded when repoRoot is missing', () => {
    const { repoRoot: _, ...withoutRepoRoot } = validFilesLoaded();
    expect(isHostToFilesWebview(withoutRepoRoot)).toBe(false);
  });

  it('accepts filesEmpty with reason noCommit', () => {
    expect(isHostToFilesWebview({ type: 'filesEmpty', reason: 'noCommit' })).toBe(true);
  });

  it('accepts filesError with message', () => {
    expect(isHostToFilesWebview({ type: 'filesError', message: 'failed' })).toBe(true);
  });
});

describe('isFilesWebviewToHost', () => {
  it('accepts setLayout with valid layout', () => {
    expect(isFilesWebviewToHost({ type: 'setLayout', layout: 'tree' })).toBe(true);
  });

  it('accepts openFileDiff with path', () => {
    expect(isFilesWebviewToHost({ type: 'openFileDiff', path: 'src/foo.ts' })).toBe(true);
  });

  it('rejects setLayout with bad layout', () => {
    expect(isFilesWebviewToHost({ type: 'setLayout', layout: 'grid' })).toBe(false);
  });

  it('rejects openFileDiff with empty path', () => {
    expect(isFilesWebviewToHost({ type: 'openFileDiff', path: '' })).toBe(false);
  });

  it('accepts ready', () => {
    expect(isFilesWebviewToHost({ type: 'ready' })).toBe(true);
  });
});

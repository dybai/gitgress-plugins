import { describe, expect, it } from 'vitest';
import {
  findOwningRepoRoot,
  normalizeRepoPath,
} from '../../src/repoIndex/pathNormalize.js';

describe('normalizeRepoPath', () => {
  it('normalizes separators and trailing slash', () => {
    expect(normalizeRepoPath('D:\\a\\b\\')).toBe('d:/a/b');
    expect(normalizeRepoPath('/a/b/')).toBe('/a/b');
  });
});

describe('findOwningRepoRoot', () => {
  it('returns the deepest matching root', () => {
    const roots = ['/ws/apps/api', '/ws', '/ws/apps'];
    expect(findOwningRepoRoot('/ws/apps/api/src/main.ts', roots)).toBe(
      '/ws/apps/api',
    );
  });

  it('returns null when no root contains the file', () => {
    expect(findOwningRepoRoot('/other/file.ts', ['/ws/repo'])).toBeNull();
  });

  it('does not match partial path segments', () => {
    expect(findOwningRepoRoot('/ws/repo2/a.ts', ['/ws/repo'])).toBeNull();
  });
});

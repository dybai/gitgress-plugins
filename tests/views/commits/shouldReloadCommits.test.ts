import { describe, expect, it } from 'vitest';
import type { SelectionSnapshot } from '../../../src/state/SelectionState';
import { shouldReloadCommits } from '../../../src/views/commits/shouldReloadCommits';

const snapshot = (
  overrides: Partial<SelectionSnapshot> = {},
): SelectionSnapshot => ({
  repoRoot: '/repo',
  branch: 'main',
  selectedCommitId: null,
  repoGeneration: 0,
  ...overrides,
});

describe('shouldReloadCommits', () => {
  it('reloads when there is no previous load context', () => {
    expect(shouldReloadCommits(null, snapshot())).toBe(true);
  });

  it('does not reload when only selectedCommitId changes', () => {
    const prev = snapshot({ selectedCommitId: null });
    const next = snapshot({ selectedCommitId: 'abc123' });
    expect(shouldReloadCommits(prev, next)).toBe(false);
  });

  it('reloads when repoRoot changes', () => {
    const prev = snapshot({ repoRoot: '/a' });
    const next = snapshot({ repoRoot: '/b' });
    expect(shouldReloadCommits(prev, next)).toBe(true);
  });

  it('reloads when branch changes', () => {
    const prev = snapshot({ branch: 'main' });
    const next = snapshot({ branch: 'dev' });
    expect(shouldReloadCommits(prev, next)).toBe(true);
  });

  it('does not reload when repo and branch are unchanged', () => {
    const prev = snapshot();
    const next = snapshot({ selectedCommitId: 'deadbeef' });
    expect(shouldReloadCommits(prev, next)).toBe(false);
  });
});

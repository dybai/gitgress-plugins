import { describe, expect, it } from 'vitest';
import { buildEmptyMessage } from '../../../src/views/commits/buildEmptyMessage.js';

describe('buildEmptyMessage', () => {
  it('omits repo context when none is known', () => {
    expect(buildEmptyMessage({ reason: 'noSelection' })).toEqual({
      type: 'empty',
      reason: 'noSelection',
    });
  });

  it('omits empty-string repo and branch values', () => {
    expect(
      buildEmptyMessage({ reason: 'noSelection', repoRoot: '', branch: '' }),
    ).toEqual({ type: 'empty', reason: 'noSelection' });
  });

  it('includes repoRoot and branch for a branchless-in-history failure', () => {
    expect(
      buildEmptyMessage({
        reason: 'noCommits',
        repoRoot: 'd:/ws/apps/api',
        branch: 'main',
      }),
    ).toEqual({
      type: 'empty',
      reason: 'noCommits',
      repoRoot: 'd:/ws/apps/api',
      branch: 'main',
    });
  });

  it('includes repoRoot without branch when no branch is selected', () => {
    expect(
      buildEmptyMessage({ reason: 'noCommits', repoRoot: 'd:/ws/apps/api' }),
    ).toEqual({
      type: 'empty',
      reason: 'noCommits',
      repoRoot: 'd:/ws/apps/api',
    });
  });

  it('keeps the custom error message', () => {
    expect(
      buildEmptyMessage({
        reason: 'error',
        repoRoot: 'd:/ws/apps/api',
        branch: 'main',
        message: 'Unable to load commits',
      }),
    ).toEqual({
      type: 'empty',
      reason: 'error',
      repoRoot: 'd:/ws/apps/api',
      branch: 'main',
      message: 'Unable to load commits',
    });
  });
});

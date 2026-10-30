import { describe, expect, it } from 'vitest';
import {
  SELECT_REPOSITORY_LABEL,
  resolveCommitsHeader,
} from '../../../src/views/commits/commitsHeaderState.js';

describe('resolveCommitsHeader', () => {
  it('hides both controls when the workspace has no repository', () => {
    expect(resolveCommitsHeader({ reason: 'noRepo' })).toEqual({
      showRepo: false,
      repoLabel: '',
      repoTitle: '',
      showBranch: false,
      branchLabel: '',
    });
  });

  it('shows the select placeholder when repositories exist but none is selected', () => {
    expect(resolveCommitsHeader({ reason: 'noSelection' })).toEqual({
      showRepo: true,
      repoLabel: SELECT_REPOSITORY_LABEL,
      repoTitle: 'Select a repository',
      showBranch: false,
      branchLabel: '',
    });
  });

  it('shows the repository short name and branch for a loaded list', () => {
    expect(
      resolveCommitsHeader({
        reason: 'commitsLoaded',
        repoRoot: 'd:/ws/apps/api',
        branch: 'main',
      }),
    ).toEqual({
      showRepo: true,
      repoLabel: 'api',
      repoTitle: 'd:/ws/apps/api',
      showBranch: true,
      branchLabel: 'main',
    });
  });

  it('keeps the repository name but hides branch when no branch is selected', () => {
    expect(
      resolveCommitsHeader({ reason: 'noCommits', repoRoot: 'd:/ws/apps/api' }),
    ).toEqual({
      showRepo: true,
      repoLabel: 'api',
      repoTitle: 'd:/ws/apps/api',
      showBranch: false,
      branchLabel: '',
    });
  });

  it('keeps both controls visible on a load error', () => {
    const state = resolveCommitsHeader({
      reason: 'error',
      repoRoot: 'd:/ws/apps/api',
      branch: 'release/1.0',
    });
    expect(state.showRepo).toBe(true);
    expect(state.showBranch).toBe(true);
    expect(state.branchLabel).toBe('release/1.0');
  });

  it('falls back to the placeholder for an empty repoRoot string', () => {
    expect(
      resolveCommitsHeader({ reason: 'noSelection', repoRoot: '', branch: '' }),
    ).toEqual({
      showRepo: true,
      repoLabel: SELECT_REPOSITORY_LABEL,
      repoTitle: 'Select a repository',
      showBranch: false,
      branchLabel: '',
    });
  });

  it('keeps the repository control and hides branch while resolving', () => {
    expect(
      resolveCommitsHeader({ reason: 'noBranch', repoRoot: 'd:/ws/apps/api' }),
    ).toEqual({
      showRepo: true,
      repoLabel: 'api',
      repoTitle: 'd:/ws/apps/api',
      showBranch: false,
      branchLabel: '',
    });
  });
});

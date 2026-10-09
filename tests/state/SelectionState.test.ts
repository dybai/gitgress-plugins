import { describe, expect, it, vi } from 'vitest';
import { SelectionState } from '../../src/state/SelectionState';

describe('SelectionState', () => {
  it('starts with an empty snapshot', () => {
    const state = new SelectionState();
    expect(state.getSnapshot()).toEqual({
      repoRoot: null,
      branch: null,
      selectedCommitId: null,
    });
  });

  it('updates repo, branch, and selected commit independently', () => {
    const state = new SelectionState();
    state.setRepo('/repo');
    state.setBranch('main');
    state.selectCommit('abc123');
    expect(state.getSnapshot()).toEqual({
      repoRoot: '/repo',
      branch: 'main',
      selectedCommitId: 'abc123',
    });
  });

  it('clears selectedCommitId when branch changes', () => {
    const state = new SelectionState();
    state.setRepo('/repo');
    state.setBranch('main');
    state.selectCommit('abc123');
    state.setBranch('dev');
    expect(state.getSnapshot()).toEqual({
      repoRoot: '/repo',
      branch: 'dev',
      selectedCommitId: null,
    });
  });

  it('clears branch and selectedCommitId when repo changes', () => {
    const state = new SelectionState();
    state.setRepo('/repo-a');
    state.setBranch('main');
    state.selectCommit('abc123');
    state.setRepo('/repo-b');
    expect(state.getSnapshot()).toEqual({
      repoRoot: '/repo-b',
      branch: null,
      selectedCommitId: null,
    });
  });

  it('clears branch and selectedCommitId when repo is set to null', () => {
    const state = new SelectionState();
    state.setRepo('/repo');
    state.setBranch('main');
    state.selectCommit('abc123');
    state.setRepo(null);
    expect(state.getSnapshot()).toEqual({
      repoRoot: null,
      branch: null,
      selectedCommitId: null,
    });
  });

  it('does not clear branch or commit when setRepo receives the same repo', () => {
    const state = new SelectionState();
    state.setRepo('/repo');
    state.setBranch('main');
    state.selectCommit('abc123');
    state.setRepo('/repo');
    expect(state.getSnapshot()).toEqual({
      repoRoot: '/repo',
      branch: 'main',
      selectedCommitId: 'abc123',
    });
  });

  it('notifies subscribers on changes and supports unsubscribe', () => {
    const state = new SelectionState();
    const listener = vi.fn();
    const unsubscribe = state.subscribe(listener);

    state.setRepo('/repo');
    expect(listener).toHaveBeenLastCalledWith({
      repoRoot: '/repo',
      branch: null,
      selectedCommitId: null,
    });

    unsubscribe();
    state.setBranch('main');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

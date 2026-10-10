import { describe, expect, it, vi } from 'vitest';
import { SelectionState } from '../../src/state/SelectionState';

describe('SelectionState', () => {
  it('starts with an empty snapshot', () => {
    const state = new SelectionState();
    expect(state.getSnapshot()).toEqual({
      repoRoot: null,
      branch: null,
      selectedCommitId: null,
      repoGeneration: 0,
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
      repoGeneration: 1,
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
      repoGeneration: 1,
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
      repoGeneration: 2,
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
      repoGeneration: 2,
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
      repoGeneration: 1,
    });
  });

  it('bumps repoGeneration when the selected repository changes', () => {
    const state = new SelectionState();
    state.setRepo('/a');
    expect(state.getSnapshot().repoGeneration).toBe(1);
    state.setRepo('/b');
    expect(state.getSnapshot().repoGeneration).toBe(2);
    state.setRepo('/a');
    expect(state.getSnapshot().repoGeneration).toBe(3);
    state.setRepo('/a');
    expect(state.getSnapshot().repoGeneration).toBe(3);
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
      repoGeneration: 1,
    });

    unsubscribe();
    state.setBranch('main');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

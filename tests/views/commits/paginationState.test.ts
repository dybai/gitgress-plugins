import { describe, expect, it, vi } from 'vitest';
import type { CommitSummary } from '../../../src/git/GitService';
import {
  appendPage,
  beginLoadMore,
  createPaginationState,
  failLoadMore,
  loadCommitPage,
  replacePage,
} from '../../../src/views/commits/paginationState';

const commit = (id: string): CommitSummary => ({
  id,
  parentIds: [],
  subject: id,
  authorName: 'A',
  authorDateIso: '2024-01-01T00:00:00Z',
  fullMessage: id,
  additions: 0,
  deletions: 0,
});

describe('commit pagination state', () => {
  it('marks a full first page as having more commits', () => {
    const state = replacePage(createPaginationState(), [commit('a'), commit('b')], 2);

    expect(state).toMatchObject({ hasMore: true, loadingMore: false });
    expect(state.loaded.map(({ id }) => id)).toEqual(['a', 'b']);
  });

  it('marks short replacement and appended pages as complete', () => {
    const replaced = replacePage(createPaginationState(), [commit('a')], 2);
    const appendable = replacePage(createPaginationState(), [commit('a'), commit('b')], 2);
    const appended = appendPage(beginLoadMore(appendable)!, [commit('c')], 2);

    expect(replaced.hasMore).toBe(false);
    expect(appended.hasMore).toBe(false);
    expect(appended.loaded.map(({ id }) => id)).toEqual(['a', 'b', 'c']);
  });

  it('guards load more while another page is loading', () => {
    const state = replacePage(createPaginationState(), [commit('a')], 1);
    const loading = beginLoadMore(state);

    expect(loading?.loadingMore).toBe(true);
    expect(beginLoadMore(loading!)).toBeNull();
  });

  it('keeps loaded commits after a load-more error', () => {
    const state = beginLoadMore(
      replacePage(createPaginationState(), [commit('a')], 1),
    )!;

    expect(failLoadMore(state)).toMatchObject({
      loaded: [expect.objectContaining({ id: 'a' })],
      hasMore: true,
      loadingMore: false,
    });
  });

  it('reads the selected commit after the git page resolves', async () => {
    let resolveLog!: (rows: CommitSummary[]) => void;
    const log = vi.fn(
      () => new Promise<CommitSummary[]>((resolve) => {
        resolveLog = resolve;
      }),
    );
    let selectedCommitId: string | null = 'before';
    const pending = loadCommitPage(
      { log },
      {
        getSnapshot: () => ({
          repoRoot: '/repo',
          branch: 'main',
          selectedCommitId,
        }),
      },
      '/repo',
      'main',
      100,
      0,
    );

    selectedCommitId = 'after';
    resolveLog([commit('a')]);

    await expect(pending).resolves.toMatchObject({ selectedCommitId: 'after' });
  });
});

// tests/protocol/messages.test.ts
import { describe, expect, it } from 'vitest';
import { isHostMessage, isWebviewToHost } from '../../src/protocol/messages';

const validCommit = {
  id: 'abc',
  subject: 'subj',
  authorName: 'Ann',
  authorDateIso: '2024-01-01T00:00:00Z',
  fullMessage: 'msg',
  additions: 1,
  deletions: 0,
  parentIds: ['def'],
  lane: 0,
  colorIndex: 1,
};

const validEdge = {
  fromRow: 0,
  toRow: 1,
  fromLane: 0,
  toLane: 0,
  colorIndex: 1,
  truncated: false,
};

function validCommitsLoaded(overrides: Record<string, unknown> = {}) {
  return {
    type: 'commitsLoaded' as const,
    branch: 'main',
    commits: [validCommit],
    edges: [validEdge],
    laneCount: 2,
    hasMore: false,
    mode: 'replace' as const,
    ...overrides,
  };
}

describe('isHostMessage', () => {
  it('accepts commitsLoaded with graph and pagination fields', () => {
    expect(
      isHostMessage(
        validCommitsLoaded({
          commits: [{ ...validCommit, parentIds: [] }, validCommit],
          hasMore: true,
          mode: 'append',
        }),
      ),
    ).toBe(true);
  });

  it('rejects commitsLoaded when parentIds is missing', () => {
    const { parentIds: _, ...withoutParents } = validCommit;
    expect(isHostMessage(validCommitsLoaded({ commits: [withoutParents] }))).toBe(false);
  });

  it('rejects commitsLoaded when parentIds contains empty strings', () => {
    expect(
      isHostMessage(validCommitsLoaded({ commits: [{ ...validCommit, parentIds: [''] }] })),
    ).toBe(false);
  });

  it('rejects commitsLoaded when hasMore is missing', () => {
    const { hasMore: _, ...withoutHasMore } = validCommitsLoaded();
    expect(isHostMessage(withoutHasMore)).toBe(false);
  });

  it('rejects commitsLoaded with invalid mode', () => {
    expect(isHostMessage(validCommitsLoaded({ mode: 'merge' }))).toBe(false);
  });
});

describe('isWebviewToHost', () => {
  it('accepts commitSelected with commitId', () => {
    expect(isWebviewToHost({ type: 'commitSelected', commitId: 'abc' })).toBe(true);
  });

  it('rejects unknown type', () => {
    expect(isWebviewToHost({ type: 'explode' })).toBe(false);
  });

  it('rejects commitSelected without commitId', () => {
    expect(isWebviewToHost({ type: 'commitSelected' })).toBe(false);
  });

  it('accepts loadMore', () => {
    expect(isWebviewToHost({ type: 'loadMore' })).toBe(true);
  });
});

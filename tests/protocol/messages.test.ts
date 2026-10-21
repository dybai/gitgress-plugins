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
  refs: [] as { name: string; kind: 'local' | 'remote' | 'tag' }[],
};

const validEdge = {
  fromRow: 0,
  toRow: 1,
  fromLane: 0,
  viaLane: 1,
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
    hasNewer: false,
    mode: 'replace' as const,
    repoRoot: '/repo',
    headCommitId: 'abc',
    tipCommitIds: ['abc'],
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

  it('rejects commitsLoaded when hasNewer is missing', () => {
    const { hasNewer: _, ...rest } = validCommitsLoaded({ hasNewer: true });
    expect(isHostMessage(rest)).toBe(false);
  });

  it('accepts commitsLoaded with hasNewer false', () => {
    expect(isHostMessage(validCommitsLoaded({ hasNewer: false }))).toBe(true);
  });

  it('rejects commitsLoaded with invalid mode', () => {
    expect(isHostMessage(validCommitsLoaded({ mode: 'merge' }))).toBe(false);
  });

  it('rejects commitsLoaded when an edge is missing viaLane', () => {
    const { viaLane: _, ...withoutViaLane } = validEdge;
    expect(isHostMessage(validCommitsLoaded({ edges: [withoutViaLane] }))).toBe(false);
  });

  it('rejects commitsLoaded when repoRoot is missing', () => {
    const { repoRoot: _, ...rest } = validCommitsLoaded();
    expect(isHostMessage(rest)).toBe(false);
  });

  it('accepts commitsLoaded with empty headCommitId', () => {
    expect(isHostMessage(validCommitsLoaded({ headCommitId: '' }))).toBe(true);
  });

  it('rejects commitsLoaded when headCommitId is missing', () => {
    const { headCommitId: _, ...rest } = validCommitsLoaded();
    expect(isHostMessage(rest)).toBe(false);
  });

  it('rejects commitsLoaded when tipCommitIds is missing', () => {
    const { tipCommitIds: _, ...rest } = validCommitsLoaded();
    expect(isHostMessage(rest)).toBe(false);
  });

  it('rejects commits when refs is missing', () => {
    const { refs: _, ...withoutRefs } = validCommit;
    expect(isHostMessage(validCommitsLoaded({ commits: [withoutRefs] }))).toBe(false);
  });

  it('accepts commits with local and remote refs', () => {
    expect(
      isHostMessage(
        validCommitsLoaded({
          commits: [
            {
              ...validCommit,
              refs: [
                { name: 'main', kind: 'local' },
                { name: 'origin/main', kind: 'remote' },
              ],
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('accepts commits with tag refs', () => {
    expect(
      isHostMessage(
        validCommitsLoaded({
          commits: [
            {
              ...validCommit,
              refs: [
                { name: 'main', kind: 'local' },
                { name: 'v1.2.0', kind: 'tag' },
              ],
            },
          ],
        }),
      ),
    ).toBe(true);
  });

  it('rejects commits with unknown ref kinds', () => {
    expect(
      isHostMessage(
        validCommitsLoaded({
          commits: [
            {
              ...validCommit,
              refs: [{ name: 'x', kind: 'stash' }],
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('accepts scanStatus idle', () => {
    expect(isHostMessage({ type: 'scanStatus', status: 'idle' })).toBe(true);
  });

  it('accepts scanStatus scanning', () => {
    expect(isHostMessage({ type: 'scanStatus', status: 'scanning' })).toBe(true);
  });

  it('rejects scanStatus with invalid status', () => {
    expect(isHostMessage({ type: 'scanStatus', status: 'done' })).toBe(false);
  });

  it('accepts empty with noSelection', () => {
    expect(isHostMessage({ type: 'empty', reason: 'noSelection' })).toBe(true);
  });

  it('accepts empty with noRepo', () => {
    expect(isHostMessage({ type: 'empty', reason: 'noRepo' })).toBe(true);
  });

  it('rejects empty with unknown reason', () => {
    expect(isHostMessage({ type: 'empty', reason: 'noFolder' })).toBe(false);
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

  it('accepts loadNewer from webview', () => {
    expect(isWebviewToHost({ type: 'loadNewer' })).toBe(true);
  });

  it('accepts selectRepository from webview', () => {
    expect(isWebviewToHost({ type: 'selectRepository' })).toBe(true);
  });
});

describe('empty message repo context', () => {
  it('accepts an empty message that carries repoRoot and branch', () => {
    expect(
      isHostMessage({
        type: 'empty',
        reason: 'noCommits',
        repoRoot: 'd:/ws/apps/api',
        branch: 'main',
      }),
    ).toBe(true);
  });

  it('accepts an empty message that carries only repoRoot', () => {
    expect(
      isHostMessage({ type: 'empty', reason: 'noCommits', repoRoot: 'd:/ws/apps/api' }),
    ).toBe(true);
  });

  it('rejects an empty repoRoot string', () => {
    expect(
      isHostMessage({ type: 'empty', reason: 'noSelection', repoRoot: '' }),
    ).toBe(false);
  });

  it('rejects a non-string branch', () => {
    expect(
      isHostMessage({ type: 'empty', reason: 'noCommits', branch: 3 }),
    ).toBe(false);
  });
});

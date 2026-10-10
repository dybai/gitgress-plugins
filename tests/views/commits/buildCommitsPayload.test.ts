import { describe, expect, it } from 'vitest';
import type { CommitSummary } from '../../../src/git/GitService';
import { buildCommitsPayload } from '../../../src/views/commits/buildCommitsPayload';

describe('buildCommitsPayload', () => {
  it('attaches layout lanes and pagination metadata', () => {
    const rows: CommitSummary[] = [
      {
        id: 'b',
        parentIds: ['a'],
        subject: 'b',
        authorName: 'A',
        authorDateIso: 't',
        fullMessage: 'b',
        additions: 1,
        deletions: 0,
      },
      {
        id: 'a',
        parentIds: [],
        subject: 'a',
        authorName: 'A',
        authorDateIso: 't',
        fullMessage: 'a',
        additions: 0,
        deletions: 0,
      },
    ];

    const message = buildCommitsPayload(
      'main',
      rows,
      'replace',
      true,
      null,
      '/repo',
      'b',
      [
        { name: 'main', kind: 'local', commitId: 'b' },
        { name: 'origin/main', kind: 'remote', commitId: 'a' },
      ],
    );

    expect(message.type).toBe('commitsLoaded');
    expect(message.branch).toBe('main');
    expect(message.hasMore).toBe(true);
    expect(message.mode).toBe('replace');
    expect(message.selectedCommitId).toBeNull();
    expect(message.repoRoot).toBe('/repo');
    expect(message.headCommitId).toBe('b');
    expect(message.tipCommitIds).toEqual(['b', 'a']);
    expect(message.commits).toHaveLength(2);
    expect(message.commits[0]).toMatchObject({
      id: 'b',
      parentIds: ['a'],
      refs: [{ name: 'main', kind: 'local' }],
    });
    expect(message.commits[1].refs).toEqual([{ name: 'origin/main', kind: 'remote' }]);
    expect(typeof message.commits[0].lane).toBe('number');
    expect(message.edges).toEqual(expect.any(Array));
    expect(message.edges[0]).toMatchObject({ viaLane: 0 });
    expect(message.laneCount).toBeGreaterThanOrEqual(1);
  });
});

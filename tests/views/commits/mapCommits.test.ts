import { describe, expect, it } from 'vitest';
import type { CommitSummary } from '../../../src/git/GitService';
import { toCommitDto, truncateSubject } from '../../../src/views/commits/mapCommits';

const commit: CommitSummary = {
  id: '0123456789abcdef',
  parentIds: ['fedcba9876543210'],
  subject: 'A concise commit subject',
  authorName: 'Ada Lovelace',
  authorDateIso: '2026-10-09T08:00:00.000Z',
  fullMessage: 'A concise commit subject\n\nWith more detail.',
  additions: 12,
  deletions: 3,
};

describe('truncateSubject', () => {
  it('keeps a subject at the maximum length unchanged', () => {
    expect(truncateSubject('123456', 6)).toBe('123456');
  });

  it('truncates a long subject and appends an ellipsis', () => {
    expect(truncateSubject('1234567', 6)).toBe('12345…');
  });

  it('supports the smallest useful maximum length', () => {
    expect(truncateSubject('abc', 1)).toBe('…');
  });

  it('rejects a non-positive maximum length', () => {
    expect(() => truncateSubject('abc', 0)).toThrow(RangeError);
  });
});

describe('toCommitDto', () => {
  const layout = { lane: 2, colorIndex: 3 };

  it('maps a commit and truncates its displayed subject', () => {
    const longCommit = { ...commit, subject: 'x'.repeat(80) };

    expect(toCommitDto(longCommit, layout)).toEqual({
      id: longCommit.id,
      subject: `${'x'.repeat(71)}…`,
      authorName: longCommit.authorName,
      authorDateIso: longCommit.authorDateIso,
      fullMessage: longCommit.fullMessage,
      additions: longCommit.additions,
      deletions: longCommit.deletions,
      parentIds: longCommit.parentIds,
      lane: layout.lane,
      colorIndex: layout.colorIndex,
    });
  });

  it('does not mutate the source commit', () => {
    const source = { ...commit, subject: 'x'.repeat(80) };

    toCommitDto(source, layout);

    expect(source.subject).toBe('x'.repeat(80));
  });
});

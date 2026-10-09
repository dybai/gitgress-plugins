import { describe, expect, it } from 'vitest';
import type { CommitSummary } from '../../../src/git/GitService';
import { toCommitDto, truncateSubject } from '../../../src/views/commits/mapCommits';

const commit: CommitSummary = {
  id: '0123456789abcdef',
  parentId: 'fedcba9876543210',
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
  it('maps a commit and truncates its displayed subject', () => {
    const longCommit = { ...commit, subject: 'x'.repeat(80) };

    expect(toCommitDto(longCommit)).toEqual({
      ...longCommit,
      subject: `${'x'.repeat(71)}…`,
    });
  });

  it('does not mutate the source commit', () => {
    const source = { ...commit, subject: 'x'.repeat(80) };

    toCommitDto(source);

    expect(source.subject).toBe('x'.repeat(80));
  });
});

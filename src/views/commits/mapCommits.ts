import type { CommitSummary } from '../../git/GitService';
import type { CommitDto } from '../../protocol/messages';

export function truncateSubject(subject: string, max = 72): string {
  if (!Number.isInteger(max) || max <= 0) {
    throw new RangeError('Subject maximum length must be a positive integer');
  }
  if (subject.length <= max) {
    return subject;
  }
  return `${subject.slice(0, max - 1)}…`;
}

export function toCommitDto(
  row: CommitSummary,
  layout: { lane: number; colorIndex: number },
): CommitDto {
  return {
    id: row.id,
    subject: truncateSubject(row.subject),
    authorName: row.authorName,
    authorDateIso: row.authorDateIso,
    fullMessage: row.fullMessage,
    additions: row.additions,
    deletions: row.deletions,
    parentIds: row.parentIds,
    lane: layout.lane,
    colorIndex: layout.colorIndex,
  };
}

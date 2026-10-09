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

export function toCommitDto(row: CommitSummary): CommitDto {
  return {
    ...row,
    subject: truncateSubject(row.subject),
  };
}

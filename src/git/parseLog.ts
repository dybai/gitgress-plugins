import type { LogCommit } from './types';

const RECORD_SEP = '\x1e';
const FIELD_SEP = '\x1f';

export function parseLog(stdout: string): LogCommit[] {
  const records = stdout.split(RECORD_SEP).filter((r) => r.length > 0);
  return records.map((record) => {
    const [id, parents, subject, authorName, authorDateIso, ...bodyParts] = record.split(FIELD_SEP);
    const fullMessage = bodyParts.join(FIELD_SEP);
    // Merge commits: %P may list multiple parents; MVP uses the first parent only.
    const parentId =
      parents.trim() === '' ? null : (parents.trim().split(/\s+/)[0] ?? null);
    return {
      id,
      parentId,
      subject,
      authorName,
      authorDateIso,
      fullMessage,
    };
  });
}

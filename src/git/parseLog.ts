import type { LogCommit } from './types';

const RECORD_SEP = '\x1e';
const FIELD_SEP = '\x1f';

export function parseLog(stdout: string): LogCommit[] {
  const commits: LogCommit[] = [];
  for (const raw of stdout.split(RECORD_SEP)) {
    const record = raw.trimStart();
    if (record.trim() === '') continue;

    const parts = record.split(FIELD_SEP);
    if (parts.length < 5) continue;

    const [idRaw, parentsRaw, subject, authorName, authorDateIso, ...bodyParts] = parts;
    const id = idRaw.trimStart();
    const fullMessage = bodyParts.join(FIELD_SEP);
    // Merge commits: %P may list multiple parents; MVP uses the first parent only.
    const parents = (parentsRaw ?? '').trim();
    const parentId = parents === '' ? null : (parents.split(/\s+/)[0] ?? null);

    commits.push({
      id,
      parentId,
      subject,
      authorName,
      authorDateIso,
      fullMessage,
    });
  }
  return commits;
}

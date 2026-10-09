import type { LogCommit } from './types';
import { parseNumstat } from './parseNumstat';

const RECORD_SEP = '\x1e';
const FIELD_SEP = '\x1f';
const METADATA_END = '\x1d';

export function parseLog(stdout: string): LogCommit[] {
  const commits: LogCommit[] = [];
  for (const raw of stdout.split(RECORD_SEP)) {
    const record = raw.trimStart();
    if (record.trim() === '') continue;

    const metadataEnd = record.indexOf(METADATA_END);
    if (metadataEnd === -1) continue;

    const metadata = record.slice(0, metadataEnd);
    const numstat = record.slice(metadataEnd + METADATA_END.length);
    const parts = metadata.split(FIELD_SEP);
    if (parts.length < 5) continue;

    const [idRaw, parentsRaw, subject, authorName, authorDateIso, ...bodyParts] = parts;
    const id = idRaw.trimStart();
    const fullMessage = bodyParts.join(FIELD_SEP);
    // Merge commits: %P may list multiple parents; MVP uses the first parent only.
    const parents = (parentsRaw ?? '').trim();
    const parentId = parents === '' ? null : (parents.split(/\s+/)[0] ?? null);
    let additions = 0;
    let deletions = 0;
    for (const stats of parseNumstat(numstat).values()) {
      additions += stats.additions;
      deletions += stats.deletions;
    }

    commits.push({
      id,
      parentId,
      subject,
      authorName,
      authorDateIso,
      fullMessage,
      additions,
      deletions,
    });
  }
  return commits;
}

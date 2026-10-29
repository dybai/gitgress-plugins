import { parseNumstat } from '../git/parseNumstat';

export type CommitDetails = {
  fullMessage: string;
  additions: number;
  deletions: number;
};

export function parseShowDetails(stdout: string): CommitDetails | null {
  const first = stdout.indexOf('\x00');
  if (first === -1) {
    return null;
  }
  const second = stdout.indexOf('\x00', first + 1);
  if (second === -1) {
    return null;
  }
  const fullMessage = stdout.slice(first + 1, second);
  const numstat = stdout.slice(second + 1);
  let additions = 0;
  let deletions = 0;
  for (const entry of parseNumstat(numstat).values()) {
    additions += entry.additions;
    deletions += entry.deletions;
  }
  return { fullMessage, additions, deletions };
}

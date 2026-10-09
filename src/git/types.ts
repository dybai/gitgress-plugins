/** Fields align with `CommitDto` where overlapping (no additions/deletions from log). */
export type LogCommit = {
  id: string;
  parentId: string | null;
  subject: string;
  authorName: string;
  authorDateIso: string;
  fullMessage: string;
};

export type NameStatusEntry = {
  status: 'A' | 'M' | 'D' | 'R' | 'C' | 'T' | 'U' | '?';
  path: string;
  oldPath?: string;
};

export type NumstatEntry = {
  additions: number;
  deletions: number;
};

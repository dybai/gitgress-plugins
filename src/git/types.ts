/** Fields align with `CommitDto` where overlapping. */
export type LogCommit = {
  id: string;
  parentId: string | null;
  subject: string;
  authorName: string;
  authorDateIso: string;
  fullMessage: string;
  additions: number;
  deletions: number;
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

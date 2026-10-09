export type CommitDto = {
  id: string;
  subject: string;
  authorName: string;
  authorDateIso: string;
  fullMessage: string;
  additions: number;
  deletions: number;
  parentId: string | null;
};

export type HostToWebview =
  | { type: 'commitsLoaded'; branch: string; commits: CommitDto[] }
  | { type: 'empty'; reason: 'noRepo' | 'noCommits' | 'error'; message?: string }
  | { type: 'selectionCleared' };

export type WebviewToHost =
  | { type: 'ready' }
  | { type: 'commitSelected'; commitId: string }
  | { type: 'switchBranch' }
  | { type: 'retry' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isCommitDto(value: unknown): value is CommitDto {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isNonEmptyString(value.id) &&
    typeof value.subject === 'string' &&
    typeof value.authorName === 'string' &&
    typeof value.authorDateIso === 'string' &&
    typeof value.fullMessage === 'string' &&
    typeof value.additions === 'number' &&
    typeof value.deletions === 'number' &&
    (value.parentId === null || typeof value.parentId === 'string')
  );
}

export function isHostMessage(value: unknown): value is HostToWebview {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }
  switch (value.type) {
    case 'commitsLoaded':
      return (
        typeof value.branch === 'string' &&
        Array.isArray(value.commits) &&
        value.commits.every(isCommitDto)
      );
    case 'empty': {
      const reason = value.reason;
      if (reason !== 'noRepo' && reason !== 'noCommits' && reason !== 'error') {
        return false;
      }
      return value.message === undefined || typeof value.message === 'string';
    }
    case 'selectionCleared':
      return true;
    default:
      return false;
  }
}

export function isWebviewToHost(value: unknown): value is WebviewToHost {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }
  switch (value.type) {
    case 'ready':
    case 'switchBranch':
    case 'retry':
      return true;
    case 'commitSelected':
      return isNonEmptyString(value.commitId);
    default:
      return false;
  }
}

export const isWebviewMessage = isWebviewToHost;

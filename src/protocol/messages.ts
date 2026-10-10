export type GraphEdgeDto = {
  fromRow: number;
  toRow: number;
  fromLane: number;
  viaLane: number;
  toLane: number;
  colorIndex: number;
  truncated: boolean;
};

export type CommitDto = {
  id: string;
  subject: string;
  authorName: string;
  authorDateIso: string;
  fullMessage: string;
  additions: number;
  deletions: number;
  parentIds: string[];
  lane: number;
  colorIndex: number;
};

export type HostToWebview =
  | {
      type: 'commitsLoaded';
      branch: string;
      commits: CommitDto[];
      edges: GraphEdgeDto[];
      laneCount: number;
      hasMore: boolean;
      mode: 'replace' | 'append';
      repoRoot: string;
      headCommitId: string;
      selectedCommitId?: string | null;
    }
  | { type: 'empty'; reason: 'noRepo' | 'noCommits' | 'error'; message?: string }
  | { type: 'selectionCleared' }
  | { type: 'scanStatus'; status: 'idle' | 'scanning' };

export type WebviewToHost =
  | { type: 'ready' }
  | { type: 'commitSelected'; commitId: string }
  | { type: 'switchBranch' }
  | { type: 'selectRepository' }
  | { type: 'retry' }
  | { type: 'loadMore' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isGraphEdgeDto(value: unknown): value is GraphEdgeDto {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.fromRow === 'number' &&
    typeof value.toRow === 'number' &&
    typeof value.fromLane === 'number' &&
    typeof value.viaLane === 'number' &&
    typeof value.toLane === 'number' &&
    typeof value.colorIndex === 'number' &&
    typeof value.truncated === 'boolean'
  );
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
    Array.isArray(value.parentIds) &&
    value.parentIds.every(isNonEmptyString) &&
    typeof value.lane === 'number' &&
    typeof value.colorIndex === 'number'
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
        value.commits.every(isCommitDto) &&
        Array.isArray(value.edges) &&
        value.edges.every(isGraphEdgeDto) &&
        typeof value.laneCount === 'number' &&
        typeof value.hasMore === 'boolean' &&
        (value.mode === 'replace' || value.mode === 'append') &&
        isNonEmptyString(value.repoRoot) &&
        typeof value.headCommitId === 'string' &&
        (value.selectedCommitId === undefined ||
          value.selectedCommitId === null ||
          isNonEmptyString(value.selectedCommitId))
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
    case 'scanStatus':
      return value.status === 'idle' || value.status === 'scanning';
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
    case 'selectRepository':
    case 'retry':
    case 'loadMore':
      return true;
    case 'commitSelected':
      return isNonEmptyString(value.commitId);
    default:
      return false;
  }
}

export const isWebviewMessage = isWebviewToHost;

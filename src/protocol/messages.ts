export type GraphEdgeDto = {
  fromRow: number;
  toRow: number;
  fromLane: number;
  viaLane: number;
  toLane: number;
  colorIndex: number;
  truncated: boolean;
};

export type CommitRefDto = {
  name: string;
  kind: 'local' | 'remote' | 'tag';
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
  refs: CommitRefDto[];
};

export type HostToWebview =
  | {
      type: 'commitsLoaded';
      branch: string;
      commits: CommitDto[];
      edges: GraphEdgeDto[];
      laneCount: number;
      hasMore: boolean;
      hasNewer: boolean;
      mode: 'replace' | 'append';
      repoRoot: string;
      headCommitId: string;
      tipCommitIds: string[];
      selectedCommitId?: string | null;
    }
  | {
      type: 'empty';
      reason: 'noRepo' | 'noCommits' | 'error' | 'noSelection' | 'noBranch';
      message?: string;
      /** Known owning repository, so the header stays actionable in empty states. */
      repoRoot?: string;
      /** Known display branch, so the branch control stays actionable. */
      branch?: string;
    }
  | { type: 'selectionCleared' }
  | { type: 'scanStatus'; status: 'idle' | 'scanning' }
  | { type: 'busyStatus'; active: boolean }
  | { type: 'revealCommit'; commitId: string };

export type WebviewToHost =
  | { type: 'ready' }
  | { type: 'commitSelected'; commitId: string }
  | { type: 'copyCommitHash'; commitId: string }
  | { type: 'switchBranch' }
  | { type: 'selectRepository' }
  | { type: 'retry' }
  | { type: 'loadMore' }
  | { type: 'loadNewer' };

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

function isCommitRefDto(value: unknown): value is CommitRefDto {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isNonEmptyString(value.name) &&
    (value.kind === 'local' || value.kind === 'remote' || value.kind === 'tag')
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
    typeof value.colorIndex === 'number' &&
    Array.isArray(value.refs) &&
    value.refs.every(isCommitRefDto)
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
        typeof value.hasNewer === 'boolean' &&
        (value.mode === 'replace' || value.mode === 'append') &&
        isNonEmptyString(value.repoRoot) &&
        typeof value.headCommitId === 'string' &&
        Array.isArray(value.tipCommitIds) &&
        value.tipCommitIds.every(isNonEmptyString) &&
        (value.selectedCommitId === undefined ||
          value.selectedCommitId === null ||
          isNonEmptyString(value.selectedCommitId))
      );
    case 'empty': {
      const reason = value.reason;
      if (
        reason !== 'noRepo' &&
        reason !== 'noCommits' &&
        reason !== 'error' &&
        reason !== 'noSelection' &&
        reason !== 'noBranch'
      ) {
        return false;
      }
      return (
        (value.message === undefined || typeof value.message === 'string') &&
        (value.repoRoot === undefined || isNonEmptyString(value.repoRoot)) &&
        (value.branch === undefined || typeof value.branch === 'string')
      );
    }
    case 'selectionCleared':
      return true;
    case 'scanStatus':
      return value.status === 'idle' || value.status === 'scanning';
    case 'busyStatus':
      return typeof value.active === 'boolean';
    case 'revealCommit':
      return isNonEmptyString(value.commitId);
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
    case 'loadNewer':
      return true;
    case 'commitSelected':
    case 'copyCommitHash':
      return isNonEmptyString(value.commitId);
    default:
      return false;
  }
}

export const isWebviewMessage = isWebviewToHost;

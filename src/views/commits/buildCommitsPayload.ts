import type { CommitSummary } from '../../git/GitService';
import { layoutCommitGraph } from '../../graph/layoutCommitGraph';
import type { HostToWebview } from '../../protocol/messages';
import { toCommitDto } from './mapCommits';

export const PAGE_SIZE = 100;

export function buildCommitsPayload(
  branch: string,
  rows: CommitSummary[],
  mode: 'replace' | 'append',
  hasMore: boolean,
  selectedCommitId?: string | null,
): Extract<HostToWebview, { type: 'commitsLoaded' }> {
  const layout = layoutCommitGraph(rows);

  return {
    type: 'commitsLoaded',
    branch,
    commits: rows.map((row, index) => {
      const commitLayout = layout.commits[index];
      return toCommitDto(row, {
        lane: commitLayout.lane,
        colorIndex: commitLayout.colorIndex,
      });
    }),
    edges: layout.edges,
    laneCount: layout.laneCount,
    hasMore,
    mode,
    selectedCommitId,
  };
}

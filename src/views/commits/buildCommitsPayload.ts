import type { CommitSummary } from '../../git/GitService';
import { layoutCommitGraph } from '../../graph/layoutCommitGraph';
import type { HostToWebview } from '../../protocol/messages';
import { attachCommitRefs, type TipRef } from './attachCommitRefs';
import { toCommitDto } from './mapCommits';

export const PAGE_SIZE = 100;

export function buildCommitsPayload(
  branch: string,
  rows: CommitSummary[],
  mode: 'replace' | 'append',
  hasMore: boolean,
  hasNewer: boolean,
  selectedCommitId: string | null | undefined,
  repoRoot: string,
  headCommitId: string,
  tips: readonly TipRef[] = [],
): Extract<HostToWebview, { type: 'commitsLoaded' }> {
  const layout = layoutCommitGraph(rows);
  const { refsById, tipCommitIds } = attachCommitRefs(
    rows.map((row) => row.id),
    tips,
  );

  return {
    type: 'commitsLoaded',
    branch,
    commits: rows.map((row, index) => {
      const commitLayout = layout.commits[index];
      return toCommitDto(
        row,
        {
          lane: commitLayout.lane,
          colorIndex: commitLayout.colorIndex,
        },
        refsById.get(row.id) ?? [],
      );
    }),
    edges: layout.edges,
    laneCount: layout.laneCount,
    hasMore,
    hasNewer,
    mode,
    repoRoot,
    headCommitId,
    tipCommitIds,
    selectedCommitId,
  };
}

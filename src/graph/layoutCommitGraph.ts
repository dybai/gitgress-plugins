export type GraphCommitInput = { id: string; parentIds: string[] };

export type GraphEdge = {
  fromRow: number;
  toRow: number;
  fromLane: number;
  viaLane: number;
  toLane: number;
  colorIndex: number;
  truncated: boolean;
};

export type GraphCommitLayout = {
  id: string;
  row: number;
  lane: number;
  colorIndex: number;
};

export type CommitGraphLayout = {
  commits: GraphCommitLayout[];
  edges: GraphEdge[];
  laneCount: number;
};

type ActiveLane = {
  tipId: string;
  colorIndex: number;
  fromRow: number;
  fromLane: number;
  viaLane: number;
};

export function layoutCommitGraph(commits: GraphCommitInput[]): CommitGraphLayout {
  if (commits.length === 0) {
    return { commits: [], edges: [], laneCount: 0 };
  }

  const active: Array<ActiveLane | null> = [];
  const layouts: GraphCommitLayout[] = [];
  const edges: GraphEdge[] = [];
  let nextColor = 0;
  let laneCount = 0;

  const firstFreeLane = (): number => {
    const freeLane = active.findIndex((lane) => lane === null);
    return freeLane === -1 ? active.length : freeLane;
  };

  commits.forEach((commit, row) => {
    const incomingLanes: number[] = [];
    active.forEach((lane, laneIndex) => {
      if (lane?.tipId === commit.id) {
        incomingLanes.push(laneIndex);
      }
    });

    const primaryLane = incomingLanes[0] ?? firstFreeLane();
    const primaryIncoming = incomingLanes.length > 0 ? active[primaryLane] : null;
    const colorIndex = primaryIncoming?.colorIndex ?? nextColor++;

    for (const incomingLane of incomingLanes) {
      const lane = active[incomingLane]!;
      edges.push({
        fromRow: lane.fromRow,
        toRow: row,
        fromLane: lane.fromLane,
        viaLane: lane.viaLane,
        toLane: primaryLane,
        colorIndex: lane.colorIndex,
        truncated: false,
      });
      active[incomingLane] = null;
    }

    layouts.push({ id: commit.id, row, lane: primaryLane, colorIndex });
    active[primaryLane] = null;
    laneCount = Math.max(laneCount, primaryLane + 1);

    commit.parentIds.forEach((parentId, parentIndex) => {
      const laneIndex = parentIndex === 0 ? primaryLane : firstFreeLane();
      const parentColor = parentIndex === 0 ? colorIndex : nextColor++;
      active[laneIndex] = {
        tipId: parentId,
        colorIndex: parentColor,
        fromRow: row,
        fromLane: primaryLane,
        viaLane: laneIndex,
      };
      laneCount = Math.max(laneCount, laneIndex + 1);
    });
  });

  active.forEach((lane, laneIndex) => {
    if (lane) {
      edges.push({
        fromRow: lane.fromRow,
        toRow: -1,
        fromLane: lane.fromLane,
        viaLane: lane.viaLane,
        toLane: laneIndex,
        colorIndex: lane.colorIndex,
        truncated: true,
      });
    }
  });

  return { commits: layouts, edges, laneCount };
}

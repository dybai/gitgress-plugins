export const MAX_LANES = 10;
export const LANE_WIDTH = 14;
export const CORNER_RADIUS = LANE_WIDTH * 0.5;

export const laneX = (lane) =>
  (Math.min(Math.max(0, lane), MAX_LANES - 1) + 0.5) * LANE_WIDTH;

export const graphWidth = (laneCount) =>
  Math.max(1, Math.min(laneCount, MAX_LANES)) * LANE_WIDTH;

export const rowGraphWidth = (occupiedLaneMax) =>
  graphWidth(Math.max(0, occupiedLaneMax) + 1);

const clampRadius = (requested, ...segmentLengths) => {
  let radius = Math.max(0, requested);
  for (const length of segmentLengths) {
    radius = Math.min(radius, Math.abs(length) / 2);
  }
  return radius;
};

/**
 * Orthogonal edge through (viaX, fromY) then (viaX, toY), with filleted corners.
 */
export const roundedEdgePath = (fromX, fromY, viaX, toX, toY, cornerRadius) => {
  if (fromX === viaX && viaX === toX) {
    return `M ${fromX} ${fromY} V ${toY}`;
  }

  const parts = [`M ${fromX} ${fromY}`];
  const topDx = viaX - fromX;
  const midDy = toY - fromY;
  const botDx = toX - viaX;
  const goDown = Math.sign(midDy) || 1;
  const hasTopElbow = topDx !== 0;
  const hasBottomElbow = botDx !== 0;

  // Each elbow already clamps to ≤ |midDy|/2, so both fit the vertical span.
  const rTop = hasTopElbow ? clampRadius(cornerRadius, topDx, midDy) : 0;
  const rBottom = hasBottomElbow
    ? clampRadius(cornerRadius, botDx, midDy)
    : 0;

  let cursorY = fromY;

  if (hasTopElbow) {
    const approachX = viaX - Math.sign(topDx) * rTop;
    const leaveY = fromY + goDown * rTop;
    if (approachX !== fromX) {
      parts.push(`H ${approachX}`);
    }
    parts.push(`Q ${viaX} ${fromY} ${viaX} ${leaveY}`);
    cursorY = leaveY;
  }

  if (hasBottomElbow) {
    const approachY = toY - goDown * rBottom;
    const leaveX = viaX + Math.sign(botDx) * rBottom;
    if (approachY !== cursorY) {
      parts.push(`V ${approachY}`);
    }
    parts.push(`Q ${viaX} ${toY} ${leaveX} ${toY}`);
    if (leaveX !== toX) {
      parts.push(`H ${toX}`);
    }
  } else {
    parts.push(`V ${toY}`);
  }

  return parts.join(' ');
};

export const occupiedLaneMaxForRow = (row, commits, edges) => {
  let maxLane = commits[row]?.lane ?? 0;

  for (const edge of edges) {
    const { fromRow, toRow, fromLane, viaLane, toLane, truncated } = edge;
    if (row === fromRow) {
      maxLane = Math.max(maxLane, fromLane, viaLane);
    }
    if (truncated) {
      if (row > fromRow) {
        maxLane = Math.max(maxLane, viaLane);
      }
      continue;
    }
    if (row > fromRow && row < toRow) {
      maxLane = Math.max(maxLane, viaLane);
    }
    if (row === toRow) {
      maxLane = Math.max(maxLane, viaLane, toLane);
    }
  }

  return maxLane;
};

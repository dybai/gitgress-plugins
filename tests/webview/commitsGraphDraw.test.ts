import { describe, expect, it } from 'vitest';
import {
  CORNER_RADIUS,
  LANE_WIDTH,
  occupiedLaneMaxForRow,
  rowGraphWidth,
  roundedEdgePath,
} from '../../webview/commits/graphDraw.js';

describe('roundedEdgePath', () => {
  it('keeps a straight vertical edge as M/V without curves', () => {
    expect(roundedEdgePath(7, 10, 7, 7, 80, 5)).toBe('M 7 10 V 80');
  });

  it('uses quadratic curves at elbows instead of sharp H/V corners', () => {
    const d = roundedEdgePath(7, 10, 21, 35, 80, 5);
    expect(d).toMatch(/Q /);
    expect(d).not.toMatch(/H 21 V 80 H 35/);
  });

  it('clamps radius when a segment is shorter than 2r', () => {
    // Horizontal span is only 7px; r=10 must clamp to ≤3.5.
    const d = roundedEdgePath(7, 10, 14, 14, 20, 10);
    expect(d).toBe('M 7 10 H 10.5 Q 14 10 14 13.5 V 20');
  });

  it('rounds only the bottom elbow when fromX equals viaX', () => {
    const d = roundedEdgePath(21, 10, 21, 7, 80, 5);
    expect(d).toBe('M 21 10 V 75 Q 21 80 16 80 H 7');
  });

  it('rounds both elbows on a fork-merge path', () => {
    const d = roundedEdgePath(7, 10, 21, 35, 80, 5);
    expect(d).toBe(
      'M 7 10 H 16 Q 21 10 21 15 V 75 Q 21 80 26 80 H 35',
    );
  });
});

describe('occupiedLaneMaxForRow', () => {
  const commits = [{ lane: 0 }, { lane: 0 }, { lane: 1 }, { lane: 0 }];
  const edges = [
    {
      fromRow: 0,
      toRow: 1,
      fromLane: 0,
      viaLane: 0,
      toLane: 0,
      truncated: false,
    },
    {
      fromRow: 1,
      toRow: 3,
      fromLane: 0,
      viaLane: 2,
      toLane: 0,
      truncated: false,
    },
    {
      fromRow: 2,
      toRow: 3,
      fromLane: 1,
      viaLane: 1,
      toLane: 0,
      truncated: false,
    },
  ];

  it('includes the commit node lane', () => {
    expect(occupiedLaneMaxForRow(2, commits, [])).toBe(1);
  });

  it('uses viaLane for rows crossed by a vertical segment', () => {
    expect(occupiedLaneMaxForRow(2, commits, edges)).toBe(2);
  });

  it('includes horizontal elbows at edge endpoints', () => {
    expect(occupiedLaneMaxForRow(1, commits, edges)).toBe(2);
    expect(occupiedLaneMaxForRow(3, commits, edges)).toBe(2);
  });

  it('counts truncated verticals through later rows', () => {
    const truncated = [
      {
        fromRow: 0,
        toRow: 9,
        fromLane: 0,
        viaLane: 3,
        toLane: 3,
        truncated: true,
      },
    ];
    expect(occupiedLaneMaxForRow(0, commits, truncated)).toBe(3);
    expect(occupiedLaneMaxForRow(2, commits, truncated)).toBe(3);
  });
});

describe('rowGraphWidth', () => {
  it('sizes the gutter from occupiedLaneMax + 1 using LANE_WIDTH', () => {
    expect(rowGraphWidth(0)).toBe(LANE_WIDTH);
    expect(rowGraphWidth(2)).toBe(3 * LANE_WIDTH);
  });

  it('exports a mild default corner radius near half a lane', () => {
    expect(CORNER_RADIUS).toBeCloseTo(LANE_WIDTH * 0.5, 5);
  });
});

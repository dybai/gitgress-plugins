import { describe, expect, it } from 'vitest';
import { layoutCommitGraph } from '../../src/graph/layoutCommitGraph';

describe('layoutCommitGraph', () => {
  it('keeps a linear history on one lane', () => {
    const layout = layoutCommitGraph([
      { id: 'c', parentIds: ['b'] },
      { id: 'b', parentIds: ['a'] },
      { id: 'a', parentIds: [] },
    ]);
    expect(layout.commits.map((c) => c.lane)).toEqual([0, 0, 0]);
    expect(layout.laneCount).toBe(1);
  });

  it('opens a side lane for a merge second parent present in the list', () => {
    const layout = layoutCommitGraph([
      { id: 'm', parentIds: ['b', 's'] },
      { id: 'b', parentIds: ['base'] },
      { id: 's', parentIds: ['base'] },
      { id: 'base', parentIds: [] },
    ]);
    expect(layout.commits[0]).toMatchObject({ id: 'm', lane: 0 });
    const lanes = new Set(layout.commits.map((c) => c.lane));
    expect(lanes.size).toBeGreaterThan(1);
    expect(layout.edges.find((e) => e.fromRow === 0 && e.toRow === 2)).toMatchObject({
      fromLane: 0,
      viaLane: 1,
      toLane: 1,
    });
  });

  it('emits a truncated edge when second parent is outside the loaded set', () => {
    const layout = layoutCommitGraph([
      { id: 'm', parentIds: ['b', 'missing'] },
      { id: 'b', parentIds: [] },
    ]);
    expect(layout.edges.find((e) => e.truncated && e.toRow === -1)).toMatchObject({
      fromLane: 0,
      viaLane: 1,
      toLane: 1,
    });
  });

  it('truncates an edge when its parent appeared before its child', () => {
    const layout = layoutCommitGraph([
      { id: 'parent', parentIds: [] },
      { id: 'child', parentIds: ['parent'] },
    ]);

    expect(layout.edges).toContainEqual(
      expect.objectContaining({
        fromRow: 1,
        toRow: -1,
        viaLane: 0,
        truncated: true,
      }),
    );
  });

  it('recomputes stably when the same list is passed twice', () => {
    const input = [
      { id: 'm', parentIds: ['b', 's'] },
      { id: 'b', parentIds: ['base'] },
      { id: 's', parentIds: ['base'] },
      { id: 'base', parentIds: [] },
    ];
    expect(layoutCommitGraph(input)).toEqual(layoutCommitGraph(input));
  });
});

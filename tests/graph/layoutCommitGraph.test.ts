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
    expect(layout.edges.some((e) => e.fromRow === 0)).toBe(true);
  });

  it('emits a truncated edge when second parent is outside the loaded set', () => {
    const layout = layoutCommitGraph([
      { id: 'm', parentIds: ['b', 'missing'] },
      { id: 'b', parentIds: [] },
    ]);
    expect(layout.edges.some((e) => e.truncated && e.toRow === -1)).toBe(true);
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

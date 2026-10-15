import { describe, expect, it } from 'vitest';
import { packRefPills } from '../../../src/views/commits/packRefPills';

describe('packRefPills', () => {
  const more = (n: number) => (n <= 0 ? 0 : 20);

  it('fits all when sum ≤ available', () => {
    expect(packRefPills([10, 10, 10], 40, more)).toEqual({
      visibleCount: 3,
      hiddenCount: 0,
    });
  });

  it('reserves space for +N when hiding', () => {
    // 30+30+30=90; with +N(20) only first fits in 55 → visible 1 hidden 2
    expect(packRefPills([30, 30, 30], 55, more)).toEqual({
      visibleCount: 1,
      hiddenCount: 2,
    });
  });

  it('keeps the first pill when even +N cannot fit', () => {
    expect(packRefPills([40, 40], 30, more)).toEqual({
      visibleCount: 1,
      hiddenCount: 1,
    });
  });
});

import { describe, expect, it } from 'vitest';
import { tipJumpTarget } from '../../../src/views/commits/tipJump';

describe('tipJumpTarget', () => {
  const tips = ['c', 'b', 'a'];
  const indexById = new Map([
    ['c', 0],
    ['x', 1],
    ['b', 2],
    ['y', 3],
    ['a', 5],
  ]);

  it('jumps up toward the list top with distance', () => {
    expect(tipJumpTarget(tips, 'b', 'up', indexById)).toEqual({
      targetId: 'c',
      distance: 2,
    });
  });

  it('jumps down toward the list bottom with distance', () => {
    expect(tipJumpTarget(tips, 'b', 'down', indexById)).toEqual({
      targetId: 'a',
      distance: 3,
    });
  });

  it('returns null at ends', () => {
    expect(tipJumpTarget(tips, 'c', 'up', indexById)).toBeNull();
    expect(tipJumpTarget(tips, 'a', 'down', indexById)).toBeNull();
  });
});

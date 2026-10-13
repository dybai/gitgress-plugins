import { describe, expect, it } from 'vitest';
import { emptyRepoReason } from '../../../src/views/commits/emptyRepoReason';

describe('emptyRepoReason', () => {
  it('returns noRepo when the index is empty', () => {
    expect(emptyRepoReason(0)).toBe('noRepo');
  });

  it('returns noSelection when the index has roots', () => {
    expect(emptyRepoReason(1)).toBe('noSelection');
    expect(emptyRepoReason(3)).toBe('noSelection');
  });
});

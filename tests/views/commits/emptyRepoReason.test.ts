import { describe, expect, it } from 'vitest';
import {
  emptyReasonOnIndexChange,
  emptyRepoReason,
} from '../../../src/views/commits/emptyRepoReason';

describe('emptyRepoReason', () => {
  it('returns noRepo when the index is empty', () => {
    expect(emptyRepoReason(0)).toBe('noRepo');
  });

  it('returns noSelection when the index has roots', () => {
    expect(emptyRepoReason(1)).toBe('noSelection');
    expect(emptyRepoReason(3)).toBe('noSelection');
  });
});

describe('emptyReasonOnIndexChange', () => {
  it('returns null when the reason is unchanged while repo stays unselected', () => {
    expect(emptyReasonOnIndexChange(2, 'noSelection')).toBeNull();
    expect(emptyReasonOnIndexChange(0, 'noRepo')).toBeNull();
  });

  it('returns noSelection when indexed roots grow from zero', () => {
    expect(emptyReasonOnIndexChange(1, 'noRepo')).toBe('noSelection');
  });

  it('returns noRepo when indexed roots shrink to zero', () => {
    expect(emptyReasonOnIndexChange(0, 'noSelection')).toBe('noRepo');
  });
});

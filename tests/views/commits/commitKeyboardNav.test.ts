import { describe, expect, it } from 'vitest';
import {
  computePageStep,
  isCommitNavKey,
  nextCommitIndex,
} from '../../../src/views/commits/commitKeyboardNav.js';

describe('isCommitNavKey', () => {
  it('accepts the six navigation keys', () => {
    for (const key of [
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
    ]) {
      expect(isCommitNavKey(key)).toBe(true);
    }
  });

  it('rejects other keys', () => {
    expect(isCommitNavKey('Enter')).toBe(false);
    expect(isCommitNavKey('a')).toBe(false);
  });
});

describe('computePageStep', () => {
  it('uses floor(viewport/row)-1 with a floor of 1', () => {
    expect(computePageStep(400, 40)).toBe(9);
    expect(computePageStep(40, 40)).toBe(1);
  });

  it('returns 1 when heights are non-positive', () => {
    expect(computePageStep(0, 40)).toBe(1);
    expect(computePageStep(400, 0)).toBe(1);
    expect(computePageStep(-1, -1)).toBe(1);
  });
});

describe('nextCommitIndex', () => {
  const opts = { length: 10, pageStep: 3 };

  it('moves by one for arrows', () => {
    expect(nextCommitIndex(5, 'ArrowUp', opts)).toBe(4);
    expect(nextCommitIndex(5, 'ArrowDown', opts)).toBe(6);
  });

  it('clamps arrows at ends', () => {
    expect(nextCommitIndex(0, 'ArrowUp', opts)).toBe(0);
    expect(nextCommitIndex(9, 'ArrowDown', opts)).toBe(9);
  });

  it('jumps Home and End', () => {
    expect(nextCommitIndex(5, 'Home', opts)).toBe(0);
    expect(nextCommitIndex(5, 'End', opts)).toBe(9);
  });

  it('pages by pageStep', () => {
    expect(nextCommitIndex(5, 'PageUp', opts)).toBe(2);
    expect(nextCommitIndex(5, 'PageDown', opts)).toBe(8);
  });

  it('clamps page jumps', () => {
    expect(nextCommitIndex(1, 'PageUp', opts)).toBe(0);
    expect(nextCommitIndex(8, 'PageDown', opts)).toBe(9);
  });

  it('returns currentIndex when length < 1', () => {
    expect(nextCommitIndex(0, 'ArrowDown', { length: 0, pageStep: 3 })).toBe(0);
  });
});

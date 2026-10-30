import { describe, expect, it } from 'vitest';
import { lineEndCharacter } from '../../src/blame/decorationAnchor';

describe('lineEndCharacter', () => {
  it('returns the last character position of a non-empty line', () => {
    expect(lineEndCharacter('const x = 1;')).toBe(12);
  });

  it('returns 0 for an empty line (anchor stays at column 0)', () => {
    expect(lineEndCharacter('')).toBe(0);
  });

  it('counts leading indentation as position', () => {
    expect(lineEndCharacter('  return;')).toBe(9);
  });
});

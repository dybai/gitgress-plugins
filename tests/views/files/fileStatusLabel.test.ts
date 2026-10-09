import { describe, expect, it } from 'vitest';
import { fileStatusLabel } from '../../../src/views/files/fileStatusLabel';

describe('fileStatusLabel', () => {
  it('maps known git status letters', () => {
    expect(fileStatusLabel('A')).toBe('Added');
    expect(fileStatusLabel('M')).toBe('Modified');
    expect(fileStatusLabel('D')).toBe('Deleted');
    expect(fileStatusLabel('R')).toBe('Renamed');
    expect(fileStatusLabel('C')).toBe('Copied');
  });

  it('returns the raw status for unknown codes', () => {
    expect(fileStatusLabel('T')).toBe('T');
  });
});

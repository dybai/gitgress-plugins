import { describe, expect, it } from 'vitest';
import { formatCompactRelativeTime } from '../../../src/views/commits/formatCompactRelativeTime';

describe('formatCompactRelativeTime', () => {
  const now = Date.parse('2026-10-10T12:00:00.000Z');

  it('formats minutes hours and days compactly', () => {
    expect(formatCompactRelativeTime('2026-10-10T11:41:00.000Z', now)).toBe('19m');
    expect(formatCompactRelativeTime('2026-10-10T11:00:00.000Z', now)).toBe('1h');
    expect(formatCompactRelativeTime('2026-10-07T12:00:00.000Z', now)).toBe('3d');
  });

  it('returns just now under one minute', () => {
    expect(formatCompactRelativeTime('2026-10-10T11:59:30.000Z', now)).toBe('just now');
  });
});

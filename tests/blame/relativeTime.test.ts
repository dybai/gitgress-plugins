import { describe, expect, it } from 'vitest';
import {
  formatBlameAnnotation,
  formatBlameRelativeTime,
} from '../../src/blame/relativeTime';

const NOW = Date.parse('2026-10-29T12:00:00+08:00');

describe('formatBlameRelativeTime', () => {
  it('formats minutes in English', () => {
    const then = NOW - 12 * 60_000;
    expect(formatBlameRelativeTime(then / 1000, NOW, 'en')).toMatch(/12 minutes? ago/);
  });

  it('formats days in Chinese', () => {
    const then = NOW - 3 * 24 * 60 * 60_000;
    expect(formatBlameRelativeTime(then / 1000, NOW, 'zh-CN')).toMatch(/3\s*天前/);
  });
});

describe('formatBlameAnnotation', () => {
  it('joins author, relative time, and MM-DD', () => {
    const thenSec = Math.floor((NOW - 3 * 24 * 60 * 60_000) / 1000);
    const text = formatBlameAnnotation('dybai', thenSec, NOW, 'en');
    expect(text).toMatch(/^dybai, .+ \(10-26\)$/);
  });
});

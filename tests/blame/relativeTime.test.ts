import { describe, expect, it } from 'vitest';
import {
  formatBlameAnnotation,
  formatBlameFullDate,
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

  it('appends the commit subject after the date with a bullet separator', () => {
    const thenSec = Math.floor((NOW - 3 * 24 * 60 * 60_000) / 1000);
    const text = formatBlameAnnotation('dybai', thenSec, NOW, 'en', 'fix: login bug');
    expect(text).toMatch(/^dybai, .+ \(10-26\) • fix: login bug$/);
  });

  it('truncates subjects longer than 50 chars to 47 plus an ellipsis', () => {
    const thenSec = Math.floor(NOW / 1000);
    const text = formatBlameAnnotation('dybai', thenSec, NOW, 'en', 'a'.repeat(51));
    const bullet = text.indexOf(' • ');
    expect(bullet).toBeGreaterThan(-1);
    expect(text.slice(bullet + 3)).toBe('a'.repeat(47) + '…');
  });

  it('keeps a subject of exactly 50 chars untruncated', () => {
    const thenSec = Math.floor(NOW / 1000);
    const text = formatBlameAnnotation('dybai', thenSec, NOW, 'en', 'a'.repeat(50));
    const bullet = text.indexOf(' • ');
    expect(text.slice(bullet + 3)).toBe('a'.repeat(50));
  });

  it('omits the message segment when the subject is empty or blank', () => {
    const thenSec = Math.floor(NOW / 1000);
    expect(formatBlameAnnotation('dybai', thenSec, NOW, 'en', '')).not.toContain(' • ');
    expect(formatBlameAnnotation('dybai', thenSec, NOW, 'en', '   ')).not.toContain(' • ');
  });
});

describe('formatBlameFullDate', () => {
  it('formats an English date with ordinal and 12-hour clock', () => {
    const date = new Date(2026, 8, 2, 18, 18); // Sep 2 2026, 18:18 local
    expect(formatBlameFullDate(Math.floor(date.getTime() / 1000), 'en')).toBe(
      'September 2nd, 2026 6:18 PM',
    );
  });

  it('uses th for 11th-13th and AM for before noon', () => {
    const d1 = new Date(2026, 8, 13, 9, 5);
    expect(formatBlameFullDate(Math.floor(d1.getTime() / 1000), 'en')).toBe(
      'September 13th, 2026 9:05 AM',
    );
    const d2 = new Date(2026, 8, 21, 0, 5);
    expect(formatBlameFullDate(Math.floor(d2.getTime() / 1000), 'en')).toBe(
      'September 21st, 2026 12:05 AM',
    );
  });

  it('formats a Chinese date as YYYY年M月D日 HH:mm', () => {
    const date = new Date(2026, 8, 2, 18, 18);
    expect(formatBlameFullDate(Math.floor(date.getTime() / 1000), 'zh-CN')).toBe(
      '2026年9月2日 18:18',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { repoShortName } from '../../../src/views/commits/repoShortName';

describe('repoShortName', () => {
  it('returns last path segment', () => {
    expect(repoShortName('D:/a/fintech', [])).toBe('fintech');
  });

  it('disambiguates when basename collides', () => {
    expect(repoShortName('D:/work/a/app', ['D:/work/a/app', 'D:/work/b/app'])).toBe('a/app');
  });
});

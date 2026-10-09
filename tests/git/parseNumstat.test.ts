import { describe, expect, it } from 'vitest';
import { parseNumstat } from '../../src/git/parseNumstat';

describe('parseNumstat', () => {
  it('maps paths to additions/deletions and treats binary dash as 0', () => {
    const stdout = ['3\t1\ta.ts', '-\t-\tbin.png'].join('\n');
    const map = parseNumstat(stdout);
    expect(map.get('a.ts')).toEqual({ additions: 3, deletions: 1 });
    expect(map.get('bin.png')).toEqual({ additions: 0, deletions: 0 });
  });
});

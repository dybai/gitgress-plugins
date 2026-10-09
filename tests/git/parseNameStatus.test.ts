import { describe, expect, it } from 'vitest';
import { parseNameStatus } from '../../src/git/parseNameStatus';

describe('parseNameStatus', () => {
  it('parses A/M/D and renames', () => {
    const stdout = ['A\tnew.ts', 'M\tsrc/a.ts', 'D\tobd.ts', 'R100\told.ts\tnewname.ts'].join('\n');
    expect(parseNameStatus(stdout)).toEqual([
      { status: 'A', path: 'new.ts' },
      { status: 'M', path: 'src/a.ts' },
      { status: 'D', path: 'obd.ts' },
      { status: 'R', path: 'newname.ts', oldPath: 'old.ts' },
    ]);
  });
});

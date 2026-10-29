import { describe, expect, it } from 'vitest';
import { parseShowDetails } from '../../src/blame/parseShowDetails';

describe('parseShowDetails', () => {
  it('reads NUL-delimited body and sums numstat', () => {
    const stdout = [
      '\x00fix: keep commits scrollbar flush with the right edge',
      '',
      'Co-authored-by: Cursor <cursoragent@cursor.com>',
      '\x00',
      '',
      '7\t0\tCHANGELOG.md',
      '1\t1\tpackage.json',
      '',
    ].join('\n');
    expect(parseShowDetails(stdout)).toEqual({
      fullMessage:
        'fix: keep commits scrollbar flush with the right edge\n\nCo-authored-by: Cursor <cursoragent@cursor.com>\n',
      additions: 8,
      deletions: 1,
    });
  });

  it('returns null without a closed NUL body', () => {
    expect(parseShowDetails('no markers')).toBeNull();
  });
});

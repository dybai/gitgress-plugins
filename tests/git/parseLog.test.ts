import { describe, expect, it } from 'vitest';
import { parseLog } from '../../src/git/parseLog';

describe('parseLog', () => {
  it('parses two commits and null parent when %P empty', () => {
    const stdout =
      ['aaa', '', 'root', 'Ann', '2024-01-01T00:00:00Z', 'root msg\n'].join('\x1f') +
      '\x1e' +
      ['bbb', 'aaa', 'child', 'Bob', '2024-01-02T00:00:00Z', 'child msg\n'].join('\x1f') +
      '\x1e';
    const rows = parseLog(stdout);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 'aaa', parentId: null, subject: 'root' });
    expect(rows[1]).toMatchObject({ id: 'bbb', parentId: 'aaa', subject: 'child', authorName: 'Bob' });
  });
});

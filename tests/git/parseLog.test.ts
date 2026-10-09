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

  it('parses git log with \\x1e\\n record separators and trailing newline', () => {
    const line = (fields: string[]) => fields.join('\x1f') + '\n';
    const stdout =
      line(['aaa', '', 'root', 'Ann', '2024-01-01T00:00:00Z', 'root msg\n']) +
      '\x1e\n' +
      line(['bbb', 'aaa', 'child', 'Bob', '2024-01-02T00:00:00Z', 'child msg\n']) +
      '\x1e\n';
    const rows = parseLog(stdout);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 'aaa', parentId: null, subject: 'root' });
    expect(rows[1]).toMatchObject({ id: 'bbb', parentId: 'aaa', subject: 'child' });
  });

  it('uses first parent only when %P lists multiple parents', () => {
    const stdout =
      ['merge', 'p1 p2', 'merge subject', 'Ann', '2024-01-03T00:00:00Z', 'merge msg\n'].join('\x1f') +
      '\x1e';
    const rows = parseLog(stdout);
    expect(rows).toHaveLength(1);
    expect(rows[0].parentId).toBe('p1');
  });

  it('skips malformed records without throwing', () => {
    const stdout =
      'garbage-only-record\x1e' +
      ['ok', '', 'subj', 'Ann', '2024-01-01T00:00:00Z', 'msg\n'].join('\x1f') +
      '\x1e\n';
    const rows = parseLog(stdout);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('ok');
  });
});

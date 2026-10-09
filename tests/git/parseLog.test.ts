import { describe, expect, it } from 'vitest';
import { parseLog } from '../../src/git/parseLog';

describe('parseLog', () => {
  it('parses interleaved commit metadata and numstat', () => {
    const stdout =
      ['aaa', '', 'root', 'Ann', '2024-01-01T00:00:00Z', 'root msg\n'].join('\x1f') +
      '\x1d\n2\t1\tsrc/a.ts\n-\t-\timage.png\n\x1e' +
      ['bbb', 'aaa', 'child', 'Bob', '2024-01-02T00:00:00Z', 'child msg\n'].join('\x1f') +
      '\x1d\n3\t4\tsrc/b.ts\n\x1e';
    const rows = parseLog(stdout);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 'aaa',
      parentId: null,
      subject: 'root',
      additions: 2,
      deletions: 1,
    });
    expect(rows[1]).toMatchObject({
      id: 'bbb',
      parentId: 'aaa',
      subject: 'child',
      authorName: 'Bob',
      additions: 3,
      deletions: 4,
    });
  });

  it('parses git log with \\x1e\\n record separators and trailing newline', () => {
    const record = (fields: string[], numstat: string) =>
      fields.join('\x1f') + `\x1d\n${numstat}\x1e\n`;
    const stdout =
      record(
        ['aaa', '', 'root', 'Ann', '2024-01-01T00:00:00Z', 'root msg\n'],
        '1\t0\ta.ts\n',
      ) +
      record(
        ['bbb', 'aaa', 'child', 'Bob', '2024-01-02T00:00:00Z', 'child msg\n'],
        '0\t2\tb.ts\n',
      );
    const rows = parseLog(stdout);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 'aaa', additions: 1, deletions: 0 });
    expect(rows[1]).toMatchObject({ id: 'bbb', additions: 0, deletions: 2 });
  });

  it('uses first parent only when %P lists multiple parents', () => {
    const stdout =
      ['merge', 'p1 p2', 'merge subject', 'Ann', '2024-01-03T00:00:00Z', 'merge msg\n'].join('\x1f') +
      '\x1d\n1\t1\tfile.ts\n\x1e';
    const rows = parseLog(stdout);
    expect(rows).toHaveLength(1);
    expect(rows[0].parentId).toBe('p1');
  });

  it('skips malformed records without throwing', () => {
    const stdout =
      'garbage-only-record\x1e' +
      ['ok', '', 'subj', 'Ann', '2024-01-01T00:00:00Z', 'msg\n'].join('\x1f') +
      '\x1d\n0\t0\tfile.ts\n\x1e\n';
    const rows = parseLog(stdout);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('ok');
  });
});

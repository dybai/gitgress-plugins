import { describe, expect, it } from 'vitest';
import { parseBlamePorcelain } from '../../src/blame/parseBlamePorcelain';

const SAMPLE = [
  '6e31b7212310042c0b58c2e3d7cf13d5199d41b9 5 5 1',
  'author dybai',
  'author-mail <bdy1234567@126.com>',
  'author-time 1793245396',
  'author-tz +0800',
  'committer dybai',
  'committer-mail <bdy1234567@126.com>',
  'committer-time 1793245396',
  'committer-tz +0800',
  'summary feat: add copyCommitHash webview message',
  'previous 4efc0458cd88b47f9d0e7d8026e9c1d675ccb04a package.json',
  'filename package.json',
  '\t  "version": "1.0.20",',
  '',
].join('\n');

describe('parseBlamePorcelain', () => {
  it('parses the first commit record', () => {
    expect(parseBlamePorcelain(SAMPLE)).toEqual({
      commitId: '6e31b7212310042c0b58c2e3d7cf13d5199d41b9',
      authorName: 'dybai',
      authorTimeUnix: 1793245396,
      summary: 'feat: add copyCommitHash webview message',
    });
  });

  it('returns null for empty output', () => {
    expect(parseBlamePorcelain('')).toBeNull();
  });

  it('returns null for the all-zero boundary hash (uncommitted)', () => {
    const uncommitted = [
      '0000000000000000000000000000000000000000 1 1 1',
      'author Not Committed Yet',
      'author-mail <not.committed.yet>',
      'author-time 0',
      'author-tz +0000',
      'committer Not Committed Yet',
      'committer-mail <not.committed.yet>',
      'committer-time 0',
      'committer-tz +0000',
      'summary ',
      'filename foo.ts',
      '\tconst x = 1;',
      '',
    ].join('\n');
    expect(parseBlamePorcelain(uncommitted)).toBeNull();
  });
});

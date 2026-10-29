import { describe, expect, it, vi } from 'vitest';
import { BlameService } from '../../src/blame/BlameService';
import type { RunGit } from '../../src/git/runGit';

describe('BlameService', () => {
  it('blames a single line via porcelain and parses it', async () => {
    const runGit = vi.fn<RunGit>(async (_cwd, args) => {
      expect(args).toEqual([
        'blame',
        '-L',
        '5,5',
        '--porcelain',
        '--',
        'package.json',
      ]);
      return {
        stdout: [
          '6e31b7212310042c0b58c2e3d7cf13d5199d41b9 5 5 1',
          'author dybai',
          'author-time 1793245396',
          'summary feat: add copyCommitHash webview message',
          'filename package.json',
          '\t  "version": "1.0.20",',
          '',
        ].join('\n'),
        stderr: '',
      };
    });
    const service = new BlameService(runGit);
    await expect(service.blameLine('/repo', 'package.json', 5)).resolves.toEqual({
      commitId: '6e31b7212310042c0b58c2e3d7cf13d5199d41b9',
      authorName: 'dybai',
      authorTimeUnix: 1793245396,
      summary: 'feat: add copyCommitHash webview message',
    });
  });

  it('returns null when blame fails', async () => {
    const runGit = vi.fn<RunGit>(async () => {
      throw new Error('boom');
    });
    await expect(new BlameService(runGit).blameLine('/repo', 'a.ts', 1)).resolves.toBeNull();
  });

  it('loads and memoizes commit details from show', async () => {
    const runGit = vi.fn<RunGit>(async (_cwd, args) => {
      expect(args[0]).toBe('show');
      return {
        stdout: '\x00subject\n\nbody\n\x00\n\n1\t0\ta.ts\n',
        stderr: '',
      };
    });
    const service = new BlameService(runGit);
    const first = await service.commitDetails('/repo', 'abc');
    const second = await service.commitDetails('/repo', 'abc');
    expect(first).toEqual({ fullMessage: 'subject\n\nbody\n', additions: 1, deletions: 0 });
    expect(second).toEqual(first);
    expect(runGit).toHaveBeenCalledTimes(1);
  });
});

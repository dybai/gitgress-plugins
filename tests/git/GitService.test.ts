import { describe, expect, it, vi } from 'vitest';
import { GitCommandFailedError, GitNotFoundError } from '../../src/git/errors';
import { GitService } from '../../src/git/GitService';
import type { RunGit } from '../../src/git/runGit';

describe('GitService', () => {
  it('returns the first candidate whose repository root resolves', async () => {
    const runGit = vi.fn<RunGit>(async (cwd, args) => {
      expect(args).toEqual(['rev-parse', '--show-toplevel']);
      if (cwd === '/b') return { stdout: ' /actual/repo\r\n', stderr: '' };
      throw new GitCommandFailedError(args, 'not a repository');
    });
    const service = new GitService(runGit);

    await expect(service.resolveRepo(['/a', '/b', '/c'])).resolves.toBe('/actual/repo');
    expect(runGit).toHaveBeenCalledTimes(2);
  });

  it('returns null when no candidate is a repository', async () => {
    const runGit = vi.fn<RunGit>(async (_cwd, args) => {
      throw new GitCommandFailedError(args, 'not a repository');
    });

    await expect(new GitService(runGit).resolveRepo(['/a'])).resolves.toBeNull();
  });

  it('does not hide a missing Git executable while resolving a repository', async () => {
    const runGit = vi.fn<RunGit>(async () => {
      throw new GitNotFoundError();
    });

    await expect(new GitService(runGit).resolveRepo(['/a'])).rejects.toBeInstanceOf(
      GitNotFoundError,
    );
  });

  it('returns the trimmed current branch', async () => {
    const runGit = vi.fn<RunGit>(async () => ({ stdout: 'main\n', stderr: '' }));

    await expect(new GitService(runGit).currentBranch('/repo')).resolves.toBe('main');
    expect(runGit).toHaveBeenCalledWith('/repo', ['branch', '--show-current']);
  });

  it('resolves a ref tip to a full commit id', async () => {
    const runGit = vi.fn<RunGit>(async () => ({
      stdout: 'abcdef0123456789\n',
      stderr: '',
    }));

    await expect(new GitService(runGit).resolveTip('/repo', 'main')).resolves.toBe(
      'abcdef0123456789',
    );
    expect(runGit).toHaveBeenCalledWith('/repo', [
      'rev-parse',
      '--verify',
      '--end-of-options',
      'main',
    ]);
  });

  it('returns null when tip resolution fails', async () => {
    const runGit = vi.fn<RunGit>(async (_cwd, args) => {
      throw new GitCommandFailedError(args, 'unknown revision');
    });

    await expect(new GitService(runGit).resolveTip('/repo', 'missing')).resolves.toBeNull();
  });

  it('lists local and remote tips and skips remote HEAD', async () => {
    const runGit = vi.fn<RunGit>(async () => ({
      stdout: [
        'aaa refs/heads/main main',
        'bbb refs/heads/feature/x feature/x',
        'ccc refs/remotes/origin/main origin/main',
        // git shortens refs/remotes/origin/HEAD to "origin", not "origin/HEAD"
        'ddd refs/remotes/origin/HEAD origin',
        '',
      ].join('\n'),
      stderr: '',
    }));

    await expect(new GitService(runGit).listTips('/repo')).resolves.toEqual([
      { name: 'main', kind: 'local', commitId: 'aaa' },
      { name: 'feature/x', kind: 'local', commitId: 'bbb' },
      { name: 'origin/main', kind: 'remote', commitId: 'ccc' },
    ]);
    expect(runGit).toHaveBeenCalledWith('/repo', [
      'for-each-ref',
      '--format=%(objectname) %(refname) %(refname:short)',
      'refs/heads',
      'refs/remotes',
    ]);
  });

  it('lists local branches without decoration or blank lines', async () => {
    const runGit = vi.fn<RunGit>(async () => ({
      stdout: 'main\nfeature/one\n\n',
      stderr: '',
    }));

    await expect(new GitService(runGit).listBranches('/repo')).resolves.toEqual([
      'main',
      'feature/one',
    ]);
    expect(runGit).toHaveBeenCalledWith('/repo', [
      'for-each-ref',
      '--format=%(refname:short)',
      'refs/heads',
    ]);
  });

  it('returns structured commits with aggregate stats from one git process', async () => {
    const body =
      ['abc', 'def', 'subj', 'Ann', '2024-01-01T00:00:00Z', 'full\n'].join('\x1f') +
      '\x1d\n2\t1\tfile.ts\n-\t-\timage.png\n\x1e\n';
    const runGit = vi.fn<RunGit>(async () => ({ stdout: body, stderr: '' }));
    const service = new GitService(runGit);

    const rows = await service.log('/repo', 'main', 100);

    expect(rows[0]).toMatchObject({
      id: 'abc',
      parentIds: ['def'],
      subject: 'subj',
      additions: 2,
      deletions: 1,
    });
    expect(runGit).toHaveBeenNthCalledWith(1, '/repo', [
      'log',
      '-n',
      '100',
      '--format=%x1e%H%x1f%P%x1f%s%x1f%an%x1f%aI%x1f%B%x1d',
      '--numstat',
      '--no-renames',
      '--date-order',
      '--end-of-options',
      'main',
      '--',
    ]);
    expect(runGit).toHaveBeenCalledTimes(1);
  });

  it('logs without --first-parent/-m and supports skip', async () => {
    const runGit = vi.fn<RunGit>(async () => ({ stdout: '', stderr: '' }));
    await new GitService(runGit).log('/repo', 'main', 100, 100);
    expect(runGit).toHaveBeenCalledWith('/repo', [
      'log',
      '-n',
      '100',
      '--skip',
      '100',
      '--format=%x1e%H%x1f%P%x1f%s%x1f%an%x1f%aI%x1f%B%x1d',
      '--numstat',
      '--no-renames',
      '--date-order',
      '--end-of-options',
      'main',
      '--',
    ]);
  });

  it('rejects a negative or non-integer skip', async () => {
    const runGit = vi.fn<RunGit>();
    const service = new GitService(runGit);
    await expect(service.log('/repo', 'main', 100, -1)).rejects.toBeInstanceOf(RangeError);
    await expect(service.log('/repo', 'main', 100, 1.5)).rejects.toBeInstanceOf(RangeError);
    expect(runGit).not.toHaveBeenCalled();
  });

  it('rejects a non-positive or non-integer log limit', async () => {
    const runGit = vi.fn<RunGit>();
    const service = new GitService(runGit);

    await expect(service.log('/repo', 'main', 0)).rejects.toBeInstanceOf(RangeError);
    await expect(service.log('/repo', 'main', 1.5)).rejects.toBeInstanceOf(RangeError);
    expect(runGit).not.toHaveBeenCalled();
  });

  it('merges name-status and numstat by path', async () => {
    const runGit = vi.fn<RunGit>(async (_cwd, args) => {
      if (args.includes('--name-status')) {
        return { stdout: 'M\tsrc/a.ts\nD\told.ts\nA\tnew.ts\n', stderr: '' };
      }
      return { stdout: '3\t2\tsrc/a.ts\n0\t4\told.ts\n5\t0\tnew.ts\n', stderr: '' };
    });
    const service = new GitService(runGit);

    await expect(service.changedFiles('/repo', 'abc')).resolves.toEqual([
      { status: 'M', path: 'src/a.ts', additions: 3, deletions: 2 },
      { status: 'D', path: 'old.ts', additions: 0, deletions: 4 },
      { status: 'A', path: 'new.ts', additions: 5, deletions: 0 },
    ]);
    expect(runGit).toHaveBeenNthCalledWith(1, '/repo', [
      'show',
      '--name-status',
      '--format=',
      '--no-renames',
      '-m',
      '--first-parent',
      '--end-of-options',
      'abc',
      '--',
    ]);
    expect(runGit).toHaveBeenNthCalledWith(2, '/repo', [
      'show',
      '--numstat',
      '--format=',
      '--no-renames',
      '-m',
      '--first-parent',
      '--end-of-options',
      'abc',
      '--',
    ]);
  });

  it('returns file content at a revision using argv-safe path syntax', async () => {
    const runGit = vi.fn<RunGit>(async () => ({ stdout: 'contents\n', stderr: '' }));
    const service = new GitService(runGit);

    await expect(service.showFileAtRevision('/repo', 'abc', 'dir/a file.ts')).resolves.toBe(
      'contents\n',
    );
    expect(runGit).toHaveBeenCalledWith('/repo', [
      'show',
      '--end-of-options',
      'abc:dir/a file.ts',
    ]);
  });

  it('returns null when the file is missing at that revision', async () => {
    const runGit = vi.fn<RunGit>(async (_cwd, args) => {
      throw new GitCommandFailedError(args, 'fatal: path does not exist', 128);
    });
    const service = new GitService(runGit);

    await expect(service.showFileAtRevision('/repo', 'abc', 'missing.ts')).resolves.toBeNull();
  });
});

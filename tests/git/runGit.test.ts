import { describe, expect, it, vi } from 'vitest';
import { GitCommandFailedError, GitNotFoundError } from '../../src/git/errors';
import { createRunGit } from '../../src/git/runGit';

describe('createRunGit', () => {
  it('returns stdout and stderr from a successful command', async () => {
    const spawnImpl = vi.fn(async () => ({ code: 0, stdout: 'ok', stderr: 'warning' }));
    const runGit = createRunGit(spawnImpl);

    await expect(runGit('/repo', ['status'])).resolves.toEqual({
      stdout: 'ok',
      stderr: 'warning',
    });
    expect(spawnImpl).toHaveBeenCalledWith('/repo', ['status']);
  });

  it('throws GitNotFoundError on ENOENT', async () => {
    const runGit = createRunGit(async () => {
      const error = new Error('spawn git ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      throw error;
    });

    await expect(runGit('/repo', ['status'])).rejects.toBeInstanceOf(GitNotFoundError);
  });

  it('throws GitCommandFailedError with command details on non-zero exit', async () => {
    const runGit = createRunGit(async () => ({ code: 128, stdout: '', stderr: 'bad revision' }));

    const error = await runGit('/repo', ['show', 'missing']).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(GitCommandFailedError);
    expect(error).toMatchObject({
      stderr: 'bad revision',
      args: ['show', 'missing'],
    });
  });
});

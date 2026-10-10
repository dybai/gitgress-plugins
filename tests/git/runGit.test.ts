import { describe, expect, it, vi } from 'vitest';
import {
  GitCommandFailedError,
  GitNotFoundError,
  NotARepositoryError,
} from '../../src/git/errors';
import { createRunGit } from '../../src/git/runGit';

describe('createRunGit', () => {
  it('returns stdout and stderr from a successful command', async () => {
    const spawnImpl = vi.fn(async () => ({ code: 0, stdout: 'ok', stderr: 'warning' }));
    const runGit = createRunGit(spawnImpl, () => true);

    await expect(runGit('/repo', ['status'])).resolves.toEqual({
      stdout: 'ok',
      stderr: 'warning',
    });
    expect(spawnImpl).toHaveBeenCalledWith('/repo', ['status']);
  });

  it('throws NotARepositoryError when the repo root path is missing', async () => {
    const spawnImpl = vi.fn(async () => ({ code: 0, stdout: '', stderr: '' }));
    const runGit = createRunGit(spawnImpl, () => false);

    await expect(runGit('/missing/repo', ['status'])).rejects.toBeInstanceOf(
      NotARepositoryError,
    );
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it('throws GitNotFoundError on spawn ENOENT when the repo root exists', async () => {
    const runGit = createRunGit(
      async () => {
        const error = new Error('spawn git ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      },
      () => true,
    );

    await expect(runGit('/repo', ['status'])).rejects.toBeInstanceOf(GitNotFoundError);
  });

  it('throws GitCommandFailedError with command details on non-zero exit', async () => {
    const runGit = createRunGit(
      async () => ({ code: 128, stdout: '', stderr: 'bad revision' }),
      () => true,
    );

    const error = await runGit('/repo', ['show', 'missing']).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(GitCommandFailedError);
    expect(error).toMatchObject({
      stderr: 'bad revision',
      args: ['show', 'missing'],
    });
  });
});

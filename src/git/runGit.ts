import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { GitCommandFailedError, GitNotFoundError, NotARepositoryError } from './errors';

export type RunGit = (
  repoRoot: string,
  args: string[],
) => Promise<{ stdout: string; stderr: string }>;

export type SpawnGit = (
  repoRoot: string,
  args: string[],
) => Promise<{ code: number | null; stdout: string; stderr: string }>;

const defaultSpawnGit: SpawnGit = (repoRoot, args) =>
  new Promise((resolve, reject) => {
    const child = spawn('git', ['-c', 'core.quotepath=false', ...args], {
      cwd: repoRoot,
      shell: false,
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.once('error', reject);
    child.once('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });

export type RepoRootExists = (repoRoot: string) => boolean;

const defaultRepoRootExists: RepoRootExists = (repoRoot) => existsSync(repoRoot);

export function createRunGit(
  spawnImpl: SpawnGit = defaultSpawnGit,
  repoRootExists: RepoRootExists = defaultRepoRootExists,
): RunGit {
  return async (repoRoot, args) => {
    if (!repoRootExists(repoRoot)) {
      throw new NotARepositoryError(repoRoot);
    }

    let result: Awaited<ReturnType<SpawnGit>>;
    try {
      result = await spawnImpl(repoRoot, args);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new GitNotFoundError();
      }
      throw error;
    }

    if (result.code !== 0) {
      throw new GitCommandFailedError(args, result.stderr, result.code);
    }
    return { stdout: result.stdout, stderr: result.stderr };
  };
}

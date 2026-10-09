import { GitCommandFailedError, GitNotFoundError } from './errors';
import { parseLog } from './parseLog';
import { parseNameStatus } from './parseNameStatus';
import type { RunGit } from './runGit';
import { parseNumstat } from './parseNumstat';

export type CommitSummary = {
  id: string;
  parentIds: string[];
  subject: string;
  authorName: string;
  authorDateIso: string;
  fullMessage: string;
  additions: number;
  deletions: number;
};

export type ChangedFile = {
  status: string;
  path: string;
  oldPath?: string;
  additions: number;
  deletions: number;
};

export class GitService {
  constructor(private readonly runGit: RunGit) {}

  async resolveRepo(candidates: string[]): Promise<string | null> {
    for (const candidate of candidates) {
      try {
        const { stdout } = await this.runGit(candidate, ['rev-parse', '--show-toplevel']);
        const repoRoot = stdout.trim();
        if (repoRoot !== '') {
          return repoRoot;
        }
      } catch (error) {
        if (error instanceof GitNotFoundError) {
          throw error;
        }
        // A workspace candidate need not be inside a repository.
      }
    }
    return null;
  }

  async currentBranch(repoRoot: string): Promise<string> {
    const { stdout } = await this.runGit(repoRoot, ['branch', '--show-current']);
    return stdout.trim();
  }

  async listBranches(repoRoot: string): Promise<string[]> {
    const { stdout } = await this.runGit(repoRoot, [
      'for-each-ref',
      '--format=%(refname:short)',
      'refs/heads',
    ]);
    return stdout
      .split(/\r?\n/)
      .map((branch) => branch.trim())
      .filter((branch) => branch !== '');
  }

  async log(repoRoot: string, branch: string, limit: number): Promise<CommitSummary[]> {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new RangeError('Git log limit must be a positive integer');
    }
    const { stdout } = await this.runGit(repoRoot, [
      'log',
      '-n',
      String(limit),
      '--format=%x1e%H%x1f%P%x1f%s%x1f%an%x1f%aI%x1f%B%x1d',
      '--numstat',
      '--no-renames',
      '-m',
      '--first-parent',
      '--end-of-options',
      branch,
      '--',
    ]);
    return parseLog(stdout);
  }

  async changedFiles(repoRoot: string, commitId: string): Promise<ChangedFile[]> {
    // Disable rename detection for both outputs so their path keys stay identical.
    const commonArgs = [
      '--format=',
      '--no-renames',
      '-m',
      '--first-parent',
      '--end-of-options',
      commitId,
      '--',
    ];
    const nameStatusResult = await this.runGit(repoRoot, [
      'show',
      '--name-status',
      ...commonArgs,
    ]);
    const numstatResult = await this.runGit(repoRoot, ['show', '--numstat', ...commonArgs]);
    const statsByPath = parseNumstat(numstatResult.stdout);

    return parseNameStatus(nameStatusResult.stdout).map((entry) => {
      const stats = statsByPath.get(entry.path) ?? { additions: 0, deletions: 0 };
      return { ...entry, ...stats };
    });
  }

  async showFileAtRevision(
    repoRoot: string,
    revision: string,
    filePath: string,
  ): Promise<string | null> {
    try {
      const { stdout } = await this.runGit(repoRoot, [
        'show',
        '--end-of-options',
        `${revision}:${filePath}`,
      ]);
      return stdout;
    } catch (error) {
      if (error instanceof GitCommandFailedError && error.exitCode === 128) {
        return null;
      }
      throw error;
    }
  }
}

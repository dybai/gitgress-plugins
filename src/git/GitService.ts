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

  async resolveTip(repoRoot: string, ref: string): Promise<string | null> {
    try {
      const { stdout } = await this.runGit(repoRoot, [
        'rev-parse',
        '--verify',
        '--end-of-options',
        ref,
      ]);
      const tip = stdout.trim();
      return tip === '' ? null : tip;
    } catch (error) {
      if (error instanceof GitCommandFailedError) {
        return null;
      }
      throw error;
    }
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

  async listTips(
    repoRoot: string,
  ): Promise<Array<{ name: string; kind: 'local' | 'remote'; commitId: string }>> {
    const { stdout } = await this.runGit(repoRoot, [
      'for-each-ref',
      '--format=%(objectname) %(refname) %(refname:short)',
      'refs/heads',
      'refs/remotes',
    ]);
    const tips: Array<{ name: string; kind: 'local' | 'remote'; commitId: string }> = [];
    for (const line of stdout.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed === '') {
        continue;
      }
      const firstSpace = trimmed.indexOf(' ');
      if (firstSpace <= 0) {
        continue;
      }
      const commitId = trimmed.slice(0, firstSpace);
      const rest = trimmed.slice(firstSpace + 1).trim();
      const secondSpace = rest.indexOf(' ');
      if (secondSpace <= 0) {
        continue;
      }
      const refname = rest.slice(0, secondSpace);
      const name = rest.slice(secondSpace + 1).trim();
      if (commitId === '' || name === '') {
        continue;
      }
      // Short name may be "origin" (not "origin/HEAD"); key off full refname.
      if (refname.startsWith('refs/remotes/') && refname.endsWith('/HEAD')) {
        continue;
      }
      let kind: 'local' | 'remote';
      if (refname.startsWith('refs/heads/')) {
        kind = 'local';
      } else if (refname.startsWith('refs/remotes/')) {
        kind = 'remote';
      } else {
        continue;
      }
      tips.push({ name, kind, commitId });
    }
    return tips;
  }

  async log(
    repoRoot: string,
    branch: string,
    limit: number,
    skip = 0,
  ): Promise<CommitSummary[]> {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new RangeError('Git log limit must be a positive integer');
    }
    if (!Number.isInteger(skip) || skip < 0) {
      throw new RangeError('Git log skip must be a non-negative integer');
    }
    const args = [
      'log',
      '-n',
      String(limit),
      ...(skip > 0 ? ['--skip', String(skip)] : []),
      '--format=%x1e%H%x1f%P%x1f%s%x1f%an%x1f%aI%x1f%B%x1d',
      '--numstat',
      '--no-renames',
      '--date-order',
      '--end-of-options',
      branch,
      '--',
    ];
    const { stdout } = await this.runGit(repoRoot, args);
    return parseLog(stdout);
  }

  /** Commits older than `commitId` (exclusive), in the same order as log(). */
  async logOlderThan(
    repoRoot: string,
    branch: string,
    commitId: string,
    limit: number,
  ): Promise<CommitSummary[]> {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new RangeError('Git log limit must be a positive integer');
    }
    const commitIds = await this.branchCommitIds(repoRoot, branch);
    const anchorIndex = commitIds.indexOf(commitId);
    if (anchorIndex < 0) {
      return [];
    }
    return this.materializeCommits(
      repoRoot,
      commitIds.slice(anchorIndex + 1, anchorIndex + 1 + limit),
    );
  }

  /** Commits newer than `commitId` toward `branch` tip, in the same order as log(). */
  async logNewerThan(
    repoRoot: string,
    branch: string,
    commitId: string,
    limit: number,
  ): Promise<CommitSummary[]> {
    if (!Number.isInteger(limit) || limit <= 0) {
      throw new RangeError('Git log limit must be a positive integer');
    }
    const commitIds = await this.branchCommitIds(repoRoot, branch);
    const anchorIndex = commitIds.indexOf(commitId);
    if (anchorIndex < 0) {
      return [];
    }
    return this.materializeCommits(
      repoRoot,
      commitIds.slice(Math.max(0, anchorIndex - limit), anchorIndex),
    );
  }

  private async branchCommitIds(repoRoot: string, branch: string): Promise<string[]> {
    const { stdout } = await this.runGit(repoRoot, [
      'rev-list',
      '--date-order',
      '--end-of-options',
      branch,
      '--',
    ]);
    return stdout
      .split(/\r?\n/)
      .map((id) => id.trim())
      .filter((id) => id !== '');
  }

  private async materializeCommits(
    repoRoot: string,
    commitIds: string[],
  ): Promise<CommitSummary[]> {
    if (commitIds.length === 0) {
      return [];
    }

    const { stdout } = await this.runGit(repoRoot, [
      'log',
      '--no-walk=unsorted',
      '--format=%x1e%H%x1f%P%x1f%s%x1f%an%x1f%aI%x1f%B%x1d',
      '--numstat',
      '--no-renames',
      '--date-order',
      '--end-of-options',
      ...commitIds,
      '--',
    ]);
    return parseLog(stdout);
  }

  /** True if `commitId` is reachable from `branch`. */
  async isCommitOnBranch(
    repoRoot: string,
    branch: string,
    commitId: string,
  ): Promise<boolean> {
    try {
      await this.runGit(repoRoot, [
        'merge-base',
        '--is-ancestor',
        '--end-of-options',
        commitId,
        branch,
      ]);
      return true;
    } catch (error) {
      if (
        error instanceof GitCommandFailedError &&
        (error.exitCode === 1 || error.exitCode === 128)
      ) {
        return false;
      }
      throw error;
    }
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

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type MergeHistoryRepo = {
  repoRoot: string;
  commits: {
    root: string;
    main: string;
    side: string;
    merge: string;
  };
  cleanup(): void;
};

function git(repoRoot: string, args: string[], date?: string): string {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: date
      ? {
          ...process.env,
          GIT_AUTHOR_DATE: date,
          GIT_COMMITTER_DATE: date,
        }
      : process.env,
  }).trim();
}

function commitFile(repoRoot: string, fileName: string, date: string): string {
  writeFileSync(join(repoRoot, fileName), `${fileName}\n`, 'utf8');
  git(repoRoot, ['add', fileName]);
  git(repoRoot, ['commit', '-m', fileName], date);
  return git(repoRoot, ['rev-parse', 'HEAD']);
}

export function createMergeHistoryRepo(): MergeHistoryRepo {
  const repoRoot = mkdtempSync(join(tmpdir(), 'gitgress-merge-history-'));
  git(repoRoot, ['init', '-b', 'main']);
  git(repoRoot, ['config', 'user.name', 'GitGress Test']);
  git(repoRoot, ['config', 'user.email', 'gitgress@example.test']);

  const root = commitFile(repoRoot, 'root.txt', '2024-01-01T00:00:00Z');
  git(repoRoot, ['branch', 'side']);
  const main = commitFile(repoRoot, 'main.txt', '2024-01-02T00:00:00Z');

  git(repoRoot, ['checkout', 'side']);
  const side = commitFile(repoRoot, 'side.txt', '2024-01-04T00:00:00Z');

  git(repoRoot, ['checkout', 'main']);
  git(
    repoRoot,
    ['merge', '--no-ff', 'side', '-m', 'merge side'],
    '2024-01-05T00:00:00Z',
  );
  const merge = git(repoRoot, ['rev-parse', 'HEAD']);

  return {
    repoRoot,
    commits: { root, main, side, merge },
    cleanup: () => rmSync(repoRoot, { recursive: true, force: true }),
  };
}

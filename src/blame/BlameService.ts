import type { RunGit } from '../git/runGit';
import { parseBlamePorcelain, type LineBlame } from './parseBlamePorcelain';
import { parseShowDetails, type CommitDetails } from './parseShowDetails';

export class BlameService {
  private readonly detailsCache = new Map<string, CommitDetails>();

  constructor(private readonly runGit: RunGit) {}

  async blameLine(
    repoRoot: string,
    filePath: string,
    line1Based: number,
  ): Promise<LineBlame | null> {
    try {
      const { stdout } = await this.runGit(repoRoot, [
        'blame',
        '-L',
        `${line1Based},${line1Based}`,
        '--porcelain',
        '--',
        filePath,
      ]);
      return parseBlamePorcelain(stdout);
    } catch {
      return null;
    }
  }

  async commitDetails(repoRoot: string, commitId: string): Promise<CommitDetails | null> {
    const cached = this.detailsCache.get(commitId);
    if (cached) {
      return cached;
    }
    try {
      const { stdout } = await this.runGit(repoRoot, [
        'show',
        '--no-ext-diff',
        '--numstat',
        '--format=%x00%B%x00',
        '--end-of-options',
        commitId,
      ]);
      const parsed = parseShowDetails(stdout);
      if (parsed) {
        this.detailsCache.set(commitId, parsed);
      }
      return parsed;
    } catch {
      return null;
    }
  }
}

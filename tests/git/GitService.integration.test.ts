import { afterEach, describe, expect, it } from 'vitest';
import { GitService } from '../../src/git/GitService';
import { createRunGit } from '../../src/git/runGit';
import {
  createMergeHistoryRepo,
  type MergeHistoryRepo,
} from './fixtures/mergeHistoryRepo';

describe('GitService merge-aware pagination', () => {
  let fixture: MergeHistoryRepo | undefined;

  afterEach(() => {
    fixture?.cleanup();
    fixture = undefined;
  });

  it('returns older commits after the anchor in branch date order', async () => {
    fixture = createMergeHistoryRepo();
    const service = new GitService(createRunGit());
    const { repoRoot, commits } = fixture;

    const fullLog = await service.log(repoRoot, 'main', 10);
    expect(fullLog.map(({ id }) => id)).toEqual([
      commits.merge,
      commits.side,
      commits.main,
      commits.root,
    ]);

    const older = await service.logOlderThan(repoRoot, 'main', commits.side, 2);
    expect(older.map(({ id }) => id)).toEqual([commits.main, commits.root]);
  });

  it('returns only commits before the anchor in branch date order', async () => {
    fixture = createMergeHistoryRepo();
    const service = new GitService(createRunGit());
    const { repoRoot, commits } = fixture;

    const newer = await service.logNewerThan(repoRoot, 'main', commits.side, 2);
    expect(newer.map(({ id }) => id)).toEqual([commits.merge]);
  });
});

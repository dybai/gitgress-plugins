import type { CommitSummary, GitService } from '../../git/GitService';
import { PAGE_SIZE } from './buildCommitsPayload';
import {
  MAX_WINDOW_PAGES,
  consumeNewerPreload,
  consumeOlderPreload,
  createCommitWindow,
  mergeNewer,
  mergeOlder,
  replaceFromTip,
  setNewerPreload,
  setOlderPreload,
  type CommitWindowState,
} from './commitWindow';

type CommitWindowGit = Pick<
  GitService,
  'log' | 'logOlderThan' | 'logNewerThan' | 'isCommitOnBranch' | 'resolveTip' | 'listTips'
>;

export class CommitWindowController {
  private state = createCommitWindow<CommitSummary>();
  private loading = false;

  constructor(
    private readonly git: CommitWindowGit,
    private readonly pageSize = PAGE_SIZE,
    private readonly maxPages = MAX_WINDOW_PAGES,
  ) {}

  getState(): CommitWindowState {
    return this.state;
  }

  async resetFromTip(
    repoRoot: string,
    branch: string,
  ): Promise<{
    loaded: CommitSummary[];
    hasOlder: boolean;
    hasNewer: boolean;
  }> {
    const batch = await this.git.log(repoRoot, branch, this.pageSize);
    this.state = replaceFromTip(batch, this.pageSize);
    return this.state;
  }

  async loadOlder(
    repoRoot: string,
    branch: string,
    selectedId: string | null,
  ): Promise<'ok' | 'busy' | 'noop'> {
    if (this.loading) {
      return 'busy';
    }
    if (!this.state.hasOlder || this.state.loaded.length === 0) {
      return 'noop';
    }

    this.loading = true;
    try {
      if (this.state.olderPreload) {
        this.state = consumeOlderPreload(
          this.state,
          this.pageSize,
          this.maxPages,
          selectedId,
        );
      } else {
        const anchor = this.state.loaded.at(-1)!;
        const batch = await this.git.logOlderThan(
          repoRoot,
          branch,
          anchor.id,
          this.pageSize,
        );
        this.state = mergeOlder(
          this.state,
          batch,
          this.pageSize,
          this.maxPages,
          selectedId,
        );
      }
      return 'ok';
    } finally {
      this.loading = false;
    }
  }

  async loadNewer(
    repoRoot: string,
    branch: string,
    selectedId: string | null,
  ): Promise<'ok' | 'busy' | 'noop'> {
    if (this.loading) {
      return 'busy';
    }
    if (!this.state.hasNewer || this.state.loaded.length === 0) {
      return 'noop';
    }

    this.loading = true;
    try {
      if (this.state.newerPreload) {
        this.state = consumeNewerPreload(
          this.state,
          this.pageSize,
          this.maxPages,
          selectedId,
        );
      } else {
        const anchor = this.state.loaded[0];
        const batch = await this.git.logNewerThan(
          repoRoot,
          branch,
          anchor.id,
          this.pageSize,
        );
        this.state = mergeNewer(
          this.state,
          batch,
          this.pageSize,
          this.maxPages,
          selectedId,
        );
      }
      return 'ok';
    } finally {
      this.loading = false;
    }
  }

  async preloadOlder(repoRoot: string, branch: string): Promise<void> {
    if (
      this.state.olderPreload ||
      !this.state.hasOlder ||
      this.state.loaded.length === 0
    ) {
      return;
    }
    const anchor = this.state.loaded.at(-1)!;
    try {
      const batch = await this.git.logOlderThan(
        repoRoot,
        branch,
        anchor.id,
        this.pageSize,
      );
      this.state = setOlderPreload(this.state, batch);
    } catch {
      // Preload is speculative; the regular load path can retry.
    }
  }

  async preloadNewer(repoRoot: string, branch: string): Promise<void> {
    if (
      this.state.newerPreload ||
      !this.state.hasNewer ||
      this.state.loaded.length === 0
    ) {
      return;
    }
    const anchor = this.state.loaded[0];
    try {
      const batch = await this.git.logNewerThan(
        repoRoot,
        branch,
        anchor.id,
        this.pageSize,
      );
      this.state = setNewerPreload(this.state, batch);
    } catch {
      // Preload is speculative; the regular load path can retry.
    }
  }

  async reconcileAfterHistoryChange(
    repoRoot: string,
    branch: string,
    selectedId: string | null,
  ): Promise<{ selectionInvalid: boolean; tip: string | null }> {
    const tip = await this.git.resolveTip(repoRoot, branch);
    if (selectedId === null) {
      await this.resetFromTip(repoRoot, branch);
      return { selectionInvalid: false, tip };
    }

    const selectionIsValid = await this.git.isCommitOnBranch(
      repoRoot,
      branch,
      selectedId,
    );
    if (!selectionIsValid) {
      await this.resetFromTip(repoRoot, branch);
      return { selectionInvalid: true, tip };
    }

    this.state = {
      ...this.state,
      hasNewer: tip !== null && tip !== this.state.loaded[0]?.id,
      newerPreload: null,
    };
    return { selectionInvalid: false, tip };
  }
}

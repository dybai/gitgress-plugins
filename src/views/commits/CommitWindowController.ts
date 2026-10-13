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
  private epoch = 0;

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
    const epoch = ++this.epoch;
    const batch = await this.git.log(repoRoot, branch, this.pageSize);
    if (epoch === this.epoch) {
      this.state = replaceFromTip(batch, this.pageSize);
    }
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
    const epoch = this.epoch;
    try {
      if (this.state.olderPreload) {
        this.state = consumeOlderPreload(
          this.state,
          this.pageSize,
          this.maxPages,
          selectedId,
        );
      } else {
        const firstId = this.state.loaded[0].id;
        const anchor = this.state.loaded.at(-1)!;
        const batch = await this.git.logOlderThan(
          repoRoot,
          branch,
          anchor.id,
          this.pageSize,
        );
        if (
          epoch !== this.epoch ||
          this.state.loaded[0]?.id !== firstId ||
          this.state.loaded.at(-1)?.id !== anchor.id
        ) {
          return 'noop';
        }
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
    const epoch = this.epoch;
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
        const lastId = this.state.loaded.at(-1)!.id;
        const batch = await this.git.logNewerThan(
          repoRoot,
          branch,
          anchor.id,
          this.pageSize,
        );
        if (
          epoch !== this.epoch ||
          this.state.loaded[0]?.id !== anchor.id ||
          this.state.loaded.at(-1)?.id !== lastId
        ) {
          return 'noop';
        }
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
    const epoch = this.epoch;
    const firstId = this.state.loaded[0].id;
    const anchor = this.state.loaded.at(-1)!;
    try {
      const batch = await this.git.logOlderThan(
        repoRoot,
        branch,
        anchor.id,
        this.pageSize,
      );
      if (
        epoch !== this.epoch ||
        this.state.loaded[0]?.id !== firstId ||
        this.state.loaded.at(-1)?.id !== anchor.id
      ) {
        return;
      }
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
    const epoch = this.epoch;
    const anchor = this.state.loaded[0];
    const lastId = this.state.loaded.at(-1)!.id;
    try {
      const batch = await this.git.logNewerThan(
        repoRoot,
        branch,
        anchor.id,
        this.pageSize,
      );
      if (
        epoch !== this.epoch ||
        this.state.loaded[0]?.id !== anchor.id ||
        this.state.loaded.at(-1)?.id !== lastId
      ) {
        return;
      }
      this.state = setNewerPreload(this.state, batch);
    } catch {
      // Preload is speculative; the regular load path can retry.
    }
  }

  /**
   * Rebuilds the window after a history change. `superseded` means a later
   * reset or reconcile replaced this operation while it was awaiting Git.
   */
  async reconcileAfterHistoryChange(
    repoRoot: string,
    branch: string,
    selectedId: string | null,
  ): Promise<{
    selectionInvalid: boolean;
    tip: string | null;
    superseded?: boolean;
  }> {
    const epoch = ++this.epoch;
    const tip = await this.git.resolveTip(repoRoot, branch);
    if (epoch !== this.epoch) {
      return { selectionInvalid: false, tip, superseded: true };
    }
    if (selectedId === null) {
      await this.resetFromTip(repoRoot, branch);
      return { selectionInvalid: false, tip };
    }

    const selectionIsValid = await this.git.isCommitOnBranch(
      repoRoot,
      branch,
      selectedId,
    );
    if (epoch !== this.epoch) {
      return { selectionInvalid: false, tip, superseded: true };
    }
    if (!selectionIsValid) {
      await this.resetFromTip(repoRoot, branch);
      return { selectionInvalid: true, tip };
    }

    const batch = await this.git.log(repoRoot, selectedId, this.pageSize);
    if (epoch !== this.epoch) {
      return { selectionInvalid: false, tip, superseded: true };
    }
    this.state = {
      ...replaceFromTip(batch, this.pageSize),
      hasNewer:
        tip !== null &&
        tip !== selectedId &&
        !batch.some(({ id }) => id === tip),
    };
    return { selectionInvalid: false, tip };
  }
}

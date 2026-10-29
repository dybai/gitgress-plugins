import * as fs from 'node:fs';
import * as vscode from 'vscode';
import type { GitService } from '../../git/GitService';
import {
  isWebviewToHost,
  type HostToWebview,
  type WebviewToHost,
} from '../../protocol/messages';
import type { SelectionSnapshot, SelectionState } from '../../state/SelectionState';
import { buildCommitsPayload } from './buildCommitsPayload';
import { buildEmptyMessage } from './buildEmptyMessage';
import { CommitWindowController } from './CommitWindowController';
import {
  shouldReloadCommits,
  type CommitsLoadContext,
} from './shouldReloadCommits';
import { shouldPostAfterPagination } from './shouldPostAfterPagination';
import {
  emptyReasonOnIndexChange,
  emptyRepoReason,
  type EmptyRepoReason,
} from './emptyRepoReason';
import { scanStatusMessage, type ScanStatus } from './scanStatusMessage';

export class CommitsViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private readonly unsubscribe: () => void;
  private lastLoadedCommitIds = new Set<string>();
  private lastLoadContext: CommitsLoadContext | null = null;
  private loadVersion = 0;
  private lastPostedEmptyReason: EmptyRepoReason | null = null;
  private readonly controller: CommitWindowController;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly selection: SelectionState,
    private readonly gitService: GitService,
    private readonly getScanStatus: () => ScanStatus = () => 'idle',
    private readonly getIndexedRootCount: () => number = () => 0,
  ) {
    this.controller = new CommitWindowController(gitService);
    this.unsubscribe = selection.subscribe((snapshot) => {
      if (!shouldReloadCommits(this.lastLoadContext, snapshot)) {
        return;
      }
      void this.load(snapshot);
    });
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
        vscode.Uri.joinPath(this.extensionUri, 'media'),
      ],
    };
    view.webview.html = this.getHtml(view.webview);

    view.webview.onDidReceiveMessage((message: unknown) => {
      if (isWebviewToHost(message)) {
        void this.handleMessage(message);
      }
    });
    view.onDidDispose(() => {
      if (this.view === view) {
        this.view = undefined;
        this.lastLoadedCommitIds.clear();
        this.lastLoadContext = null;
      }
    });
  }

  refresh(): void {
    void this.load(this.selection.getSnapshot());
  }

  async reconcileFromHistory(): Promise<void> {
    const view = this.view;
    const snapshot = this.selection.getSnapshot();
    const { repoRoot, branch, selectedCommitId } = snapshot;
    if (view === undefined || repoRoot === null || branch === null || branch === '') {
      return;
    }

    const version = ++this.loadVersion;
    try {
      const result = await this.controller.reconcileAfterHistoryChange(
        repoRoot,
        branch,
        selectedCommitId,
      );
      if (result.superseded || !this.isCurrentLoad(version, view)) {
        return;
      }
      const currentSelection = this.selection.getSnapshot();
      if (
        currentSelection.repoGeneration !== snapshot.repoGeneration ||
        currentSelection.repoRoot !== repoRoot ||
        currentSelection.branch !== branch ||
        currentSelection.selectedCommitId !== selectedCommitId
      ) {
        return;
      }
      if (result.selectionInvalid) {
        this.selection.selectCommit(null);
      }
      await this.postWindow(
        { ...snapshot, selectedCommitId: result.selectionInvalid ? null : selectedCommitId },
        version,
        view,
        result.tip,
      );
    } catch {
      // Keep the existing window visible; a later watcher event or refresh can retry.
    }
  }

  /**
   * Remote-tracking tips moved but the display-branch tip did not.
   * Re-post the current window with fresh tip pills; do not touch selection or Files.
   */
  async refreshTipsOnly(): Promise<void> {
    const view = this.view;
    const snapshot = this.selection.getSnapshot();
    const { repoRoot, branch } = snapshot;
    if (
      view === undefined ||
      repoRoot === null ||
      branch === null ||
      branch === '' ||
      this.controller.getState().loaded.length === 0
    ) {
      return;
    }

    const version = ++this.loadVersion;
    try {
      await this.postWindow(snapshot, version, view);
    } catch {
      // Leave the current pills visible; a later event or manual refresh can retry.
    }
  }

  /**
   * Push the current repo-index scan status to the webview so it can toggle
   * the indeterminate progress bar. Does not touch commit load state
   * ({@link loadVersion}) or pagination.
   */
  notifyScanStatus(status: ScanStatus): void {
    this.postScanStatus(status);
  }

  /**
   * Reveal a commit from the editor inline blame in the Commits view.
   * Posts a lightweight message when the commit is already loaded; otherwise
   * rebuilds the window around it, or shows an error empty state when the
   * commit is not on the current branch.
   */
  async revealCommit(commitId: string): Promise<void> {
    const view = this.view;
    const snapshot = this.selection.getSnapshot();
    const { repoRoot, branch } = snapshot;
    if (view === undefined || repoRoot === null || branch === null || branch === '') {
      return;
    }
    if (this.lastLoadedCommitIds.has(commitId)) {
      void view.webview.postMessage({ type: 'revealCommit', commitId });
      this.selection.selectCommit(commitId);
      return;
    }

    const onBranch = await this.gitService.isCommitOnBranch(repoRoot, branch, commitId);
    if (!onBranch) {
      const version = ++this.loadVersion;
      this.applyMessage(
        buildEmptyMessage({
          reason: 'error',
          repoRoot,
          branch,
          message: 'Commit is not on the current branch',
        }),
        version,
        view,
      );
      return;
    }

    const version = ++this.loadVersion;
    const result = await this.controller.reconcileAfterHistoryChange(
      repoRoot,
      branch,
      commitId,
    );
    if (result.superseded || !this.isCurrentLoad(version, view)) {
      return;
    }
    this.selection.selectCommit(commitId);
    await this.postWindow(
      { ...this.selection.getSnapshot(), selectedCommitId: commitId },
      version,
      view,
      result.tip,
    );
  }

  /**
   * Index length changed while no repo is selected; refresh the empty-state
   * reason without starting a new commit load ({@link loadVersion}).
   */
  notifyIndexChanged(): void {
    const view = this.view;
    if (view === undefined) {
      return;
    }
    if (this.selection.getSnapshot().repoRoot !== null) {
      return;
    }
    const next = emptyReasonOnIndexChange(
      this.getIndexedRootCount(),
      this.lastPostedEmptyReason,
    );
    if (next === null) {
      return;
    }
    this.lastPostedEmptyReason = next;
    this.lastLoadedCommitIds.clear();
    void view.webview.postMessage(buildEmptyMessage({ reason: next }));
  }

  private postScanStatus(status: ScanStatus): void {
    const view = this.view;
    if (view === undefined) {
      return;
    }
    void view.webview.postMessage(scanStatusMessage(status));
  }

  dispose(): void {
    this.unsubscribe();
    this.view = undefined;
    this.lastLoadedCommitIds.clear();
    this.lastLoadContext = null;
  }

  private async handleMessage(message: WebviewToHost): Promise<void> {
    switch (message.type) {
      case 'ready':
      case 'retry': {
        const loadPromise = this.load(this.selection.getSnapshot());
        this.postScanStatus(this.getScanStatus());
        await loadPromise;
        return;
      }
      case 'commitSelected':
        if (this.lastLoadedCommitIds.has(message.commitId)) {
          this.selection.selectCommit(message.commitId);
        }
        return;
      case 'copyCommitHash':
        if (this.lastLoadedCommitIds.has(message.commitId)) {
          void vscode.env.clipboard.writeText(message.commitId).then(undefined, () => {
            // Clipboard failures are non-actionable; the webview shows optimistic feedback.
          });
        }
        return;
      case 'loadMore':
        await this.loadDirection('older');
        return;
      case 'loadNewer':
        await this.loadDirection('newer');
        return;
      case 'switchBranch':
        await vscode.commands.executeCommand('gitgress.switchBranch');
        return;
      case 'selectRepository':
        await vscode.commands.executeCommand('gitgress.selectRepository');
        return;
    }
  }

  private async load(snapshot: SelectionSnapshot): Promise<void> {
    const view = this.view;
    if (view === undefined) {
      return;
    }

    const version = ++this.loadVersion;
    const { repoRoot, branch } = snapshot;
    this.lastLoadContext = { repoRoot, branch };
    this.lastLoadedCommitIds.clear();
    if (repoRoot === null) {
      const reason = emptyRepoReason(this.getIndexedRootCount());
      this.lastPostedEmptyReason = reason;
      this.applyMessage(buildEmptyMessage({ reason }), version, view);
      return;
    }
    this.lastPostedEmptyReason = null;
    if (branch === null || branch === '') {
      this.applyMessage(
        buildEmptyMessage({
          reason: 'noCommits',
          repoRoot,
          message: 'No branch selected',
        }),
        version,
        view,
      );
      return;
    }

    try {
      const state = await this.controller.resetFromTip(repoRoot, branch);
      if (!this.isCurrentLoad(version, view)) {
        return;
      }
      if (state.loaded.length === 0) {
        this.applyMessage(
          buildEmptyMessage({ reason: 'noCommits', repoRoot, branch }),
          version,
          view,
        );
        return;
      }
      await this.postWindow(snapshot, version, view);
    } catch {
      if (!this.isCurrentLoad(version, view)) {
        return;
      }
      this.lastLoadedCommitIds.clear();
      this.applyMessage(
        buildEmptyMessage({
          reason: 'error',
          repoRoot,
          branch,
          message: 'Unable to load commits',
        }),
        version,
        view,
      );
    }
  }

  private async loadDirection(direction: 'older' | 'newer'): Promise<void> {
    const view = this.view;
    const snapshot = this.selection.getSnapshot();
    const { repoRoot, branch, selectedCommitId } = snapshot;
    if (
      view === undefined ||
      repoRoot === null ||
      branch === null ||
      branch === ''
    ) {
      return;
    }

    const baselineLoadVersion = this.loadVersion;
    try {
      const result = await (direction === 'older'
        ? this.controller.loadOlder(repoRoot, branch, selectedCommitId)
        : this.controller.loadNewer(repoRoot, branch, selectedCommitId));
      if (
        !shouldPostAfterPagination(
          baselineLoadVersion,
          this.loadVersion,
          result,
        ) ||
        this.view !== view
      ) {
        return;
      }
      const currentSelection = this.selection.getSnapshot();
      if (
        currentSelection.repoGeneration !== snapshot.repoGeneration ||
        currentSelection.repoRoot !== repoRoot ||
        currentSelection.branch !== branch
      ) {
        return;
      }
      const version = ++this.loadVersion;
      await this.postWindow(currentSelection, version, view);
      if (!this.isCurrentLoad(version, view)) {
        return;
      }
      void (direction === 'older'
        ? this.controller.preloadOlder(repoRoot, branch)
        : this.controller.preloadNewer(repoRoot, branch));
    } catch {
      // Keep the existing commits visible so directional loading can be retried.
    }
  }

  private async postWindow(
    snapshot: SelectionSnapshot,
    version: number,
    view: vscode.WebviewView,
    knownTip?: string | null,
  ): Promise<void> {
    const { repoRoot, branch, selectedCommitId } = snapshot;
    if (repoRoot === null || branch === null || branch === '') {
      return;
    }
    const [tip, tips] = await Promise.all([
      knownTip === undefined
        ? this.gitService.resolveTip(repoRoot, branch)
        : Promise.resolve(knownTip),
      this.gitService.listTips(repoRoot),
    ]);
    if (!this.isCurrentLoad(version, view)) {
      return;
    }
    const state = this.controller.getState();
    this.applyMessage(
      buildCommitsPayload(
        branch,
        state.loaded,
        'replace',
        state.hasOlder,
        state.hasNewer,
        selectedCommitId,
        repoRoot,
        tip ?? '',
        tips,
      ),
      version,
      view,
    );
  }

  private isCurrentLoad(version: number, view: vscode.WebviewView): boolean {
    return version === this.loadVersion && this.view === view;
  }

  private applyMessage(
    message: HostToWebview,
    version: number,
    view: vscode.WebviewView,
  ): void {
    if (version !== this.loadVersion || this.view !== view) {
      return;
    }
    this.lastLoadedCommitIds =
      message.type === 'commitsLoaded'
        ? new Set(message.commits.map((commit) => commit.id))
        : new Set();
    void view.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'commits.html');
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'commits.css'),
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'commits.js'),
    );

    return fs
      .readFileSync(htmlPath.fsPath, 'utf8')
      .replaceAll('{{cspSource}}', () => webview.cspSource)
      .replace('{{styleUri}}', () => styleUri.toString())
      .replace('{{scriptUri}}', () => scriptUri.toString());
  }
}

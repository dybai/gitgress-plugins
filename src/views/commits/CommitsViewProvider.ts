import * as fs from 'node:fs';
import * as vscode from 'vscode';
import type { GitService } from '../../git/GitService';
import {
  isWebviewToHost,
  type HostToWebview,
  type WebviewToHost,
} from '../../protocol/messages';
import type { SelectionSnapshot, SelectionState } from '../../state/SelectionState';
import { buildCommitsPayload, PAGE_SIZE } from './buildCommitsPayload';
import {
  shouldReloadCommits,
  type CommitsLoadContext,
} from './shouldReloadCommits';
import {
  appendPage,
  beginLoadMore,
  createPaginationState,
  failLoadMore,
  loadCommitPage,
  replacePage,
} from './paginationState';
import { scanStatusMessage, type ScanStatus } from './scanStatusMessage';

export class CommitsViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private readonly unsubscribe: () => void;
  private lastLoadedCommitIds = new Set<string>();
  private lastLoadContext: CommitsLoadContext | null = null;
  private loadVersion = 0;
  private pagination = createPaginationState();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly selection: SelectionState,
    private readonly gitService: GitService,
    private readonly getScanStatus: () => ScanStatus = () => 'idle',
  ) {
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
        this.resetPagination();
      }
    });
  }

  refresh(): void {
    void this.load(this.selection.getSnapshot());
  }

  /**
   * Push the current repo-index scan status to the webview so it can toggle
   * the indeterminate progress bar. Does not touch commit load state
   * ({@link loadVersion}) or pagination.
   */
  notifyScanStatus(status: ScanStatus): void {
    this.postScanStatus(status);
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
    this.resetPagination();
  }

  private async handleMessage(message: WebviewToHost): Promise<void> {
    switch (message.type) {
      case 'ready':
      case 'retry':
        await this.load(this.selection.getSnapshot());
        this.postScanStatus(this.getScanStatus());
        return;
      case 'commitSelected':
        if (this.lastLoadedCommitIds.has(message.commitId)) {
          this.selection.selectCommit(message.commitId);
        }
        return;
      case 'loadMore':
        await this.loadMore();
        return;
      case 'switchBranch':
        await vscode.commands.executeCommand('gitgress.switchBranch');
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
    this.resetPagination();
    if (repoRoot === null) {
      this.applyMessage({ type: 'empty', reason: 'noRepo' }, version, view);
      return;
    }
    if (branch === null || branch === '') {
      this.applyMessage(
        { type: 'empty', reason: 'noCommits', message: 'No branch selected' },
        version,
        view,
      );
      return;
    }

    try {
      const { batch, selectedCommitId } = await loadCommitPage(
        this.gitService,
        this.selection,
        repoRoot,
        branch,
        PAGE_SIZE,
        0,
      );
      if (!this.isCurrentLoad(version, view)) {
        return;
      }
      if (batch.length === 0) {
        this.applyMessage({ type: 'empty', reason: 'noCommits' }, version, view);
        return;
      }
      this.pagination = replacePage(this.pagination, batch, PAGE_SIZE);
      this.applyMessage(
        buildCommitsPayload(
          branch,
          this.pagination.loaded,
          'replace',
          this.pagination.hasMore,
          selectedCommitId,
        ),
        version,
        view,
      );
    } catch {
      if (!this.isCurrentLoad(version, view)) {
        return;
      }
      this.resetPagination();
      this.applyMessage(
        { type: 'empty', reason: 'error', message: 'Unable to load commits' },
        version,
        view,
      );
    }
  }

  private async loadMore(): Promise<void> {
    const view = this.view;
    const { repoRoot, branch } = this.selection.getSnapshot();
    const loadingPagination = beginLoadMore(this.pagination);
    if (
      view === undefined ||
      repoRoot === null ||
      branch === null ||
      branch === '' ||
      loadingPagination === null
    ) {
      return;
    }

    const version = ++this.loadVersion;
    const offset = loadingPagination.loaded.length;
    this.pagination = loadingPagination;
    try {
      const { batch, selectedCommitId } = await loadCommitPage(
        this.gitService,
        this.selection,
        repoRoot,
        branch,
        PAGE_SIZE,
        offset,
      );
      if (!this.isCurrentLoad(version, view)) {
        return;
      }
      this.pagination = appendPage(this.pagination, batch, PAGE_SIZE);
      this.applyMessage(
        buildCommitsPayload(
          branch,
          this.pagination.loaded,
          'replace',
          this.pagination.hasMore,
          selectedCommitId,
        ),
        version,
        view,
      );
    } catch {
      // Keep the existing commits visible so load more can be retried.
      if (this.isCurrentLoad(version, view)) {
        this.pagination = failLoadMore(this.pagination);
      }
    }
  }

  private isCurrentLoad(version: number, view: vscode.WebviewView): boolean {
    return version === this.loadVersion && this.view === view;
  }

  private resetPagination(): void {
    this.pagination = createPaginationState();
    this.lastLoadedCommitIds.clear();
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

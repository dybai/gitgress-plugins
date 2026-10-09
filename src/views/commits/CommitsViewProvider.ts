import * as fs from 'node:fs';
import * as vscode from 'vscode';
import type { GitService } from '../../git/GitService';
import {
  isWebviewToHost,
  type HostToWebview,
  type WebviewToHost,
} from '../../protocol/messages';
import type { SelectionSnapshot, SelectionState } from '../../state/SelectionState';
import { layoutCommitGraph } from '../../graph/layoutCommitGraph';
import { toCommitDto } from './mapCommits';
import {
  shouldReloadCommits,
  type CommitsLoadContext,
} from './shouldReloadCommits';

export class CommitsViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private readonly unsubscribe: () => void;
  private lastLoadedCommitIds = new Set<string>();
  private lastLoadContext: CommitsLoadContext | null = null;
  private loadVersion = 0;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly selection: SelectionState,
    private readonly gitService: GitService,
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
        vscode.Uri.joinPath(this.extensionUri, 'webview'),
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

  dispose(): void {
    this.unsubscribe();
    this.view = undefined;
    this.lastLoadedCommitIds.clear();
    this.lastLoadContext = null;
  }

  private async handleMessage(message: WebviewToHost): Promise<void> {
    switch (message.type) {
      case 'ready':
      case 'retry':
        await this.load(this.selection.getSnapshot());
        return;
      case 'commitSelected':
        if (this.lastLoadedCommitIds.has(message.commitId)) {
          this.selection.selectCommit(message.commitId);
        }
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
    const { repoRoot, branch, selectedCommitId } = snapshot;
    this.lastLoadContext = { repoRoot, branch };
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
      const commits = await this.gitService.log(repoRoot, branch, 100);
      if (commits.length === 0) {
        this.applyMessage({ type: 'empty', reason: 'noCommits' }, version, view);
        return;
      }
      const graph = layoutCommitGraph(commits);
      const layoutById = new Map(graph.commits.map((entry) => [entry.id, entry]));
      this.applyMessage(
        {
          type: 'commitsLoaded',
          branch,
          commits: commits.map((row) => {
            const layout = layoutById.get(row.id)!;
            return toCommitDto(row, { lane: layout.lane, colorIndex: layout.colorIndex });
          }),
          edges: graph.edges,
          laneCount: graph.laneCount,
          hasMore: commits.length === 100,
          mode: 'replace',
          selectedCommitId,
        },
        version,
        view,
      );
    } catch {
      this.applyMessage(
        { type: 'empty', reason: 'error', message: 'Unable to load commits' },
        version,
        view,
      );
    }
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
    const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'webview', 'commits.html');
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview', 'commits.css'),
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'webview', 'commits.js'),
    );

    return fs
      .readFileSync(htmlPath.fsPath, 'utf8')
      .replaceAll('{{cspSource}}', () => webview.cspSource)
      .replace('{{styleUri}}', () => styleUri.toString())
      .replace('{{scriptUri}}', () => scriptUri.toString());
  }
}

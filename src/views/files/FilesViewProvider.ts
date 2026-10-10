import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import * as vscode from 'vscode';
import { openFileDiffByPath } from '../../commands/openFileDiff';
import { openWorkingFile } from '../../commands/openWorkingFile';
import type { DiffService } from '../../diff/DiffService';
import type { GitService } from '../../git/GitService';
import {
  isFilesWebviewToHost,
  type FilesWebviewToHost,
  type HostToFilesWebview,
} from '../../protocol/filesMessages';
import type { SelectionSnapshot, SelectionState } from '../../state/SelectionState';
import type { FilesIconsPayload } from '../../protocol/filesMessages';
import { buildLanguageIdByExtension } from './buildLanguageIdByExtension';
import { buildFilesMessage, codiconOnlyIcons } from './buildFilesPayload';
import {
  findIconThemeContribution,
  loadThemeDocument,
  resolveIconsForFiles,
} from './fileIconThemeHost';
import { matchesSelection, resolveLoadedTarget, type LoadedFiles } from './loadedFiles';
import { normalizeFilesLayoutPreference, type FilesLayoutPreference } from './resolveFilesLayout';

export const FILES_LAYOUT_KEY = 'gitgress.files.layout';

function readLayout(state: vscode.Memento): FilesLayoutPreference {
  return normalizeFilesLayoutPreference(state.get<unknown>(FILES_LAYOUT_KEY, 'auto'));
}

export class FilesViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private readonly unsubscribe: () => void;
  private readonly disposables: vscode.Disposable[] = [];
  private loadVersion = 0;
  private loaded: LoadedFiles | null = null;
  private selectedPath: string | null = null;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly state: vscode.Memento,
    private readonly selection: SelectionState,
    private readonly gitService: GitService,
    private readonly diffService: DiffService,
  ) {
    this.unsubscribe = selection.subscribe((snapshot) => {
      void this.load(snapshot);
    });
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('workbench.iconTheme')) {
          this.refreshIconsOnly();
        }
      }),
      vscode.window.onDidChangeActiveColorTheme(() => {
        this.refreshIconsOnly();
      }),
    );
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    this.applyResourceRoots(view);
    view.webview.html = this.getHtml(view.webview);

    view.webview.onDidReceiveMessage((message: unknown) => {
      if (isFilesWebviewToHost(message)) {
        void this.handleMessage(message);
      }
    });
    view.onDidDispose(() => {
      if (this.view === view) {
        this.view = undefined;
        this.resetLoaded();
      }
    });
  }

  refresh(): void {
    void this.load(this.selection.getSnapshot());
  }

  dispose(): void {
    this.unsubscribe();
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.view = undefined;
    this.resetLoaded();
  }

  private async handleMessage(message: FilesWebviewToHost): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this.load(this.selection.getSnapshot());
        return;
      case 'setLayout':
        await this.state.update(FILES_LAYOUT_KEY, message.layout);
        await this.load(this.selection.getSnapshot());
        return;
      case 'fileSelected':
        if (this.resolveTarget(message.path) !== undefined) {
          this.selectedPath = message.path;
        }
        return;
      case 'openFileDiff': {
        const target = this.resolveTarget(message.path);
        if (target !== undefined) {
          await openFileDiffByPath(this.selection, this.diffService, target);
        }
        return;
      }
      case 'openWorkingFile': {
        const target = this.resolveTarget(message.path);
        const { repoRoot } = this.selection.getSnapshot();
        if (target !== undefined && repoRoot !== null) {
          await openWorkingFile(repoRoot, target.path, target.status);
        }
        return;
      }
    }
  }

  private async load(snapshot: SelectionSnapshot): Promise<void> {
    const view = this.view;
    if (view === undefined) {
      return;
    }

    const version = ++this.loadVersion;
    const { repoRoot, selectedCommitId } = snapshot;
    // Invalidate immediately so actions cannot use a previous commit's file list
    // while the new selection is still loading.
    if (!matchesSelection(this.loaded, snapshot)) {
      this.resetLoaded();
    }
    const target = { repoRoot, commitId: selectedCommitId };
    const preference = readLayout(this.state);

    if (repoRoot === null || selectedCommitId === null) {
      this.resetLoaded();
      this.post(buildFilesMessage(target, null, preference, undefined), version, view);
      return;
    }

    try {
      const files = await this.gitService.changedFiles(repoRoot, selectedCommitId);
      if (!this.isCurrent(version, view)) {
        return;
      }
      const icons = this.resolveIcons(view, files.map((file) => file.path));
      this.loaded = { repoRoot, commitId: selectedCommitId, files };
      this.post(buildFilesMessage(target, files, preference, icons), version, view);
    } catch {
      if (!this.isCurrent(version, view)) {
        return;
      }
      this.resetLoaded();
      this.post(
        buildFilesMessage(
          target,
          null,
          preference,
          undefined,
          'Unable to load changed files',
        ),
        version,
        view,
      );
    }
  }

  private refreshIconsOnly(): void {
    const view = this.view;
    if (view === undefined) {
      return;
    }
    if (this.loaded === null) {
      this.refresh();
      return;
    }
    const { repoRoot, commitId, files } = this.loaded;
    const target = { repoRoot, commitId };
    const preference = readLayout(this.state);
    const icons = this.resolveIcons(view, files.map((file) => file.path));
    this.post(
      buildFilesMessage(target, files, preference, icons),
      this.loadVersion,
      view,
    );
  }

  private baseResourceRoots(): vscode.Uri[] {
    return [
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview'),
      vscode.Uri.joinPath(this.extensionUri, 'media'),
    ];
  }

  private applyResourceRoots(view: vscode.WebviewView, themeRoot?: vscode.Uri): void {
    const roots = this.baseResourceRoots();
    if (themeRoot !== undefined) {
      roots.push(themeRoot);
    }
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: roots,
    };
  }

  private builtInSetiThemeCandidates(): readonly string[] {
    return [
      join(
        vscode.env.appRoot,
        'extensions',
        'theme-seti',
        'icons',
        'vs-seti-icon-theme.json',
      ),
    ];
  }

  private resolveIcons(
    view: vscode.WebviewView,
    paths: readonly string[],
  ): FilesIconsPayload {
    try {
      const iconThemeId = vscode.workspace
        .getConfiguration()
        .get<string>('workbench.iconTheme');
      const contribution = findIconThemeContribution(
        iconThemeId,
        vscode.extensions.all.map((extension) => ({
          extensionPath: extension.extensionPath,
          packageJSON: extension.packageJSON as {
            contributes?: { iconThemes?: Array<{ id: string; path: string }> };
          },
        })),
        this.builtInSetiThemeCandidates(),
      );

      if (contribution === undefined) {
        this.applyResourceRoots(view);
        return codiconOnlyIcons(paths);
      }

      const document = loadThemeDocument(contribution.jsonFsPath, (fsPath) =>
        fs.readFileSync(fsPath, 'utf8'),
      );
      const themeDirFsPath = dirname(contribution.jsonFsPath);
      const kind = vscode.window.activeColorTheme.kind;
      const light =
        kind === vscode.ColorThemeKind.Light ||
        kind === vscode.ColorThemeKind.HighContrastLight;

      this.applyResourceRoots(view, vscode.Uri.file(contribution.extensionRootFsPath));

      return resolveIconsForFiles({
        theme: document,
        themeDirFsPath,
        paths,
        light,
        languageIdByExtension: buildLanguageIdByExtension(vscode.extensions.all),
        toWebviewUri: (fsPath) =>
          view.webview.asWebviewUri(vscode.Uri.file(fsPath)).toString(),
      });
    } catch {
      this.applyResourceRoots(view);
      return codiconOnlyIcons(paths);
    }
  }

  private resetLoaded(): void {
    this.loaded = null;
    this.selectedPath = null;
  }

  private resolveTarget(path: string) {
    return resolveLoadedTarget(this.loaded, this.selection.getSnapshot(), path);
  }

  private isCurrent(version: number, view: vscode.WebviewView): boolean {
    return version === this.loadVersion && this.view === view;
  }

  private post(
    message: HostToFilesWebview,
    version: number,
    view: vscode.WebviewView,
  ): void {
    if (!this.isCurrent(version, view)) {
      return;
    }
    void view.webview.postMessage(message);
  }

  private getHtml(webview: vscode.Webview): string {
    const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'files.html');
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'files.css'),
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview', 'files.js'),
    );

    return fs
      .readFileSync(htmlPath.fsPath, 'utf8')
      .replaceAll('{{cspSource}}', () => webview.cspSource)
      .replace('{{styleUri}}', () => styleUri.toString())
      .replace('{{scriptUri}}', () => scriptUri.toString());
  }
}

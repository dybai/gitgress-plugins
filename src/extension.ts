import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { registerOpenFileDiff } from './commands/openFileDiff';
import { refreshRepository, gitErrorMessage } from './commands/refresh';
import { runWithSelectionRecovery } from './commands/selectionRecovery';
import {
  explicitRefreshGitgress,
  reloadRepositoryState,
} from './commands/reloadHandlers';
import { selectRepository } from './commands/selectRepository';
import { switchBranch } from './commands/switchBranch';
import { DiffService } from './diff/DiffService';
import { GITGRESS_SCHEME } from './diff/gitgressUri';
import { GitgressContentProvider } from './diff/GitgressContentProvider';
import { pickActiveFilePath } from './extension/activeFilePath';
import { GitHistoryWatcher } from './git/GitHistoryWatcher';
import { GitService } from './git/GitService';
import { gitHistoryWatchPaths } from './git/historyWatchPaths';
import { resolveGitDir, type GitDirectoryLayout } from './git/resolveGitDir';
import { createRunGit } from './git/runGit';
import { tipsFingerprint } from './git/tipsFingerprint';
import { discoverGitRootFromPath } from './repoIndex/discoverGitRootFromPath';
import { createNodeScanFs } from './repoIndex/nodeScanFs';
import { RepoIndexService, type ScanStatus } from './repoIndex/RepoIndexService';
import { createMemoryRepoIndexStore } from './repoIndex/repoIndexStore';
import { createSqliteRepoIndexStore } from './repoIndex/sqliteRepoIndexStore';
import { SelectionCoordinator } from './state/SelectionCoordinator';
import { SelectionState } from './state/SelectionState';
import { CommitsViewProvider } from './views/commits/CommitsViewProvider';
import { FilesViewProvider } from './views/files/FilesViewProvider';

const MANUAL_REPO_ROOT_KEY = 'gitgress.manualRepoRoot';
const HAS_REPOSITORIES_CONTEXT = 'gitgress.hasRepositories';
const HAS_REPOSITORY_CONTEXT = 'gitgress.hasRepository';
const INDEX_DB_FILE = 'repos.sqlite';

function createGitHistoryFileWatcher(layout: GitDirectoryLayout) {
  const watchers: vscode.FileSystemWatcher[] = [];
  try {
    for (const { base, pattern } of gitHistoryWatchPaths(layout)) {
      watchers.push(
        vscode.workspace.createFileSystemWatcher(
          new vscode.RelativePattern(base, pattern),
          false,
          false,
          false,
        ),
      );
    }
  } catch (error) {
    for (const watcher of watchers) {
      watcher.dispose();
    }
    console.warn(`GitGress: unable to watch git history in ${layout.gitDir}`, error);
    return {
      onDidCreate: () => new vscode.Disposable(() => {}),
      onDidChange: () => new vscode.Disposable(() => {}),
      onDidDelete: () => new vscode.Disposable(() => {}),
      dispose: () => {},
    };
  }

  return {
    onDidCreate: (listener: () => void) =>
      vscode.Disposable.from(...watchers.map((watcher) => watcher.onDidCreate(listener))),
    onDidChange: (listener: () => void) =>
      vscode.Disposable.from(...watchers.map((watcher) => watcher.onDidChange(listener))),
    onDidDelete: (listener: () => void) =>
      vscode.Disposable.from(...watchers.map((watcher) => watcher.onDidDelete(listener))),
    dispose: () => {
      for (const watcher of watchers) {
        watcher.dispose();
      }
    },
  };
}

function workspaceRoots(): string[] {
  return (vscode.workspace.workspaceFolders ?? []).map((folder) => folder.uri.fsPath);
}

function tabFileUris(): { scheme: string; fsPath: string }[] {
  const uris: { scheme: string; fsPath: string }[] = [];
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input;
      if (input instanceof vscode.TabInputText) {
        uris.push({ scheme: input.uri.scheme, fsPath: input.uri.fsPath });
      }
    }
  }
  return uris;
}

function activeFilePath(): string | null {
  return pickActiveFilePath({
    activeEditorUri: vscode.window.activeTextEditor?.document.uri ?? null,
    visibleEditorUris: vscode.window.visibleTextEditors.map((editor) => editor.document.uri),
    tabUris: tabFileUris(),
  });
}

function createRepoIndex(context: vscode.ExtensionContext): RepoIndexService {
  const storageDir = (context.storageUri ?? context.globalStorageUri).fsPath;
  const sqlJsDist = path.join(context.extensionPath, 'node_modules', 'sql.js', 'dist');
  return new RepoIndexService({
    workspaceRoots,
    fs: createNodeScanFs(),
    openStore: () =>
      createSqliteRepoIndexStore(path.join(storageDir, INDEX_DB_FILE), {
        locateFile: (file) => path.join(sqlJsDist, file),
      }),
    openMemoryStore: () => createMemoryRepoIndexStore(),
    onWarning: (message) => {
      void vscode.window.showWarningMessage(message);
    },
  });
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const gitService = new GitService(createRunGit());
  const selection = new SelectionState();
  const diffService = new DiffService();
  const index = createRepoIndex(context);
  const coordinator = new SelectionCoordinator(
    selection,
    () => index.getRepos(),
    {
      get: () => context.workspaceState.get<string>(MANUAL_REPO_ROOT_KEY) ?? null,
      set: (root) => {
        void context.workspaceState.update(MANUAL_REPO_ROOT_KEY, root ?? undefined);
      },
    },
    activeFilePath,
    workspaceRoots,
    (filePath) =>
      discoverGitRootFromPath(filePath, (candidate) => fs.existsSync(candidate)),
  );
  const commitsProvider = new CommitsViewProvider(
    context.extensionUri,
    selection,
    gitService,
    () => index.getScanStatus(),
    () => index.getRepos().length,
  );
  const filesProvider = new FilesViewProvider(
    context.extensionUri,
    context.workspaceState,
    selection,
    gitService,
    diffService,
  );
  const historyWatcher = new GitHistoryWatcher(
    {
      debounceMs: 1500,
      resolveGitDir: (repoRoot) =>
        resolveGitDir(repoRoot, {
          exists: fs.existsSync,
          isDirectory: (candidate) => fs.statSync(candidate).isDirectory(),
          readFile: (candidate) => fs.readFileSync(candidate, 'utf8'),
        }),
      createWatcher: createGitHistoryFileWatcher,
      readTip: (repoRoot, branch) => gitService.resolveTip(repoRoot, branch),
      readTipsFingerprint: async (repoRoot) =>
        tipsFingerprint(await gitService.listTips(repoRoot)),
      setTimeout,
      clearTimeout,
    },
    (_target, kind) => {
      if (kind === 'tipsOnly') {
        void commitsProvider.refreshTipsOnly();
        return;
      }
      void commitsProvider.reconcileFromHistory();
    },
  );

  const showError = async (error: unknown): Promise<void> => {
    await vscode.window.showErrorMessage(gitErrorMessage(error));
  };
  const reloadDeps = () => ({
    gitService,
    selection,
    filesProvider,
    commitsProvider,
    repoIndex: index,
    coordinator,
  });

  const recoveryDeps = { coordinator, showError };
  const ensureBranch = (): Promise<void> =>
    runWithSelectionRecovery(recoveryDeps, () => refreshRepository(gitService, selection));

  const reloadRepository = (): Promise<void> =>
    runWithSelectionRecovery(recoveryDeps, () => reloadRepositoryState(reloadDeps()));

  const refreshGitgress = (): Promise<void> =>
    runWithSelectionRecovery(recoveryDeps, () => explicitRefreshGitgress(reloadDeps()));

  let lastScanStatus: ScanStatus | null = null;
  const onIndexChanged = (): void => {
    const status = index.getScanStatus();
    if (status === 'scanning' && lastScanStatus !== 'scanning') {
      coordinator.onScanStarted();
    }
    coordinator.onIndexUpdated();
    commitsProvider.notifyScanStatus(status);
    commitsProvider.notifyIndexChanged();
    void vscode.commands.executeCommand(
      'setContext',
      HAS_REPOSITORIES_CONTEXT,
      index.getRepos().length >= 1,
    );
    if (status === 'idle' && lastScanStatus !== 'idle') {
      coordinator.onScanIdle();
    }
    lastScanStatus = status;
  };

  context.subscriptions.push(
    commitsProvider,
    filesProvider,
    historyWatcher,
    { dispose: () => index.dispose() },
    {
      dispose: selection.subscribe((snapshot) => {
        try {
          historyWatcher.retarget(
            snapshot.repoRoot === null
              ? null
              : {
                  repoRoot: snapshot.repoRoot,
                  repoGeneration: snapshot.repoGeneration,
                  branch: snapshot.branch,
                },
          );
        } catch (error) {
          console.warn('GitGress: unable to retarget git history watcher', error);
        }
      }),
    },
    // A newly selected repo (manual pick, editor rule, index resolution) has no
    // branch yet; initialize it here so every selection path behaves the same.
    {
      dispose: selection.subscribe((snapshot) => {
        if (snapshot.repoRoot !== null && snapshot.branch === null) {
          void ensureBranch();
        }
      }),
    },
    {
      dispose: selection.subscribe((snapshot) => {
        void vscode.commands.executeCommand(
          HAS_REPOSITORY_CONTEXT,
          snapshot.repoRoot !== null,
        );
      }),
    },
    vscode.window.registerWebviewViewProvider(
      'gitgress.commits',
      commitsProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
    vscode.window.registerWebviewViewProvider('gitgress.files', filesProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.workspace.registerTextDocumentContentProvider(
      GITGRESS_SCHEME,
      new GitgressContentProvider(gitService),
    ),
    registerOpenFileDiff(selection, diffService),
    vscode.commands.registerCommand('gitgress.switchBranch', async () => {
      try {
        await switchBranch(
          gitService,
          selection,
          vscode.window.createQuickPick,
          () => new vscode.ThemeIcon('check'),
          () => new vscode.ThemeIcon('blank'),
        );
      } catch (error) {
        await showError(error);
      }
    }),
    vscode.commands.registerCommand('gitgress.selectRepository', async () => {
      try {
        await selectRepository({
          roots: index.getRepos(),
          currentRepoRoot: selection.getSnapshot().repoRoot,
          workspaceFolderPaths: workspaceRoots(),
          createQuickPick: vscode.window.createQuickPick,
          createCheckIcon: () => new vscode.ThemeIcon('check'),
          createBlankIcon: () => new vscode.ThemeIcon('blank'),
          selectManually: (repoRoot) => coordinator.selectManually(repoRoot),
        });
      } catch (error) {
        await showError(error);
      }
    }),
    vscode.commands.registerCommand('gitgress.refresh', refreshGitgress),
    vscode.window.onDidChangeActiveTextEditor(() => {
      coordinator.onActiveEditorChanged();
    }),
    // Webview focus clears activeTextEditor; visible editors / tabs still carry
    // the open file used for auto repo selection.
    vscode.window.onDidChangeVisibleTextEditors(() => {
      coordinator.onActiveEditorChanged();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(reloadRepository),
  );

  await index.start();
  coordinator.resolveInitial();
  // Subscribe before any further await so no scan progress is missed, then sync once.
  context.subscriptions.push({ dispose: index.subscribe(onIndexChanged) });
  onIndexChanged();
  await ensureBranch();
  await vscode.commands.executeCommand(
    HAS_REPOSITORY_CONTEXT,
    selection.getSnapshot().repoRoot !== null,
  );
}

export function deactivate(): void {}

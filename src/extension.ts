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
import { GitService } from './git/GitService';
import { createRunGit } from './git/runGit';
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
const INDEX_DB_FILE = 'repos.sqlite';

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
  );
  const commitsProvider = new CommitsViewProvider(
    context.extensionUri,
    selection,
    gitService,
    () => index.getScanStatus(),
  );
  const filesProvider = new FilesViewProvider(
    context.extensionUri,
    context.workspaceState,
    selection,
    gitService,
    diffService,
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
    coordinator.onIndexUpdated();
    commitsProvider.notifyScanStatus(status);
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
    { dispose: () => index.dispose() },
    // A newly selected repo (manual pick, editor rule, index resolution) has no
    // branch yet; initialize it here so every selection path behaves the same.
    {
      dispose: selection.subscribe((snapshot) => {
        if (snapshot.repoRoot !== null && snapshot.branch === null) {
          void ensureBranch();
        }
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
        await switchBranch(gitService, selection, vscode.window.showQuickPick);
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
          showQuickPick: vscode.window.showQuickPick,
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
}

export function deactivate(): void {}

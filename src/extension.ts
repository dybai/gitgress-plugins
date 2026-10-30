import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  BlameController,
  type DecorationOptionsLike,
  type DecorationTypeLike,
  type TextEditorLike,
} from './blame/BlameController';
import { BlameHoverProvider } from './blame/BlameHoverProvider';
import { BlameService } from './blame/BlameService';
import { conflictModeForChoice, detectConflictingAnnotation } from './blame/conflictPolicy';
import { lineEndCharacter } from './blame/decorationAnchor';
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
import {
  publishHasRepository,
  type ExecuteCommand,
} from './extension/repositoryContext';
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
const LAST_REPO_ROOT_KEY = 'gitgress.lastRepoRoot';
const HAS_REPOSITORIES_CONTEXT = 'gitgress.hasRepositories';
const INDEX_DB_FILE = 'repos.sqlite';

const executeCommand: ExecuteCommand = (command, ...args) =>
  vscode.commands.executeCommand(command, ...args);

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
  const runGit = createRunGit();
  const gitService = new GitService(runGit);
  const blameService = new BlameService(runGit);
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
    {
      get: () => context.workspaceState.get<string>(LAST_REPO_ROOT_KEY) ?? null,
      set: (root) => {
        void context.workspaceState.update(LAST_REPO_ROOT_KEY, root ?? undefined);
      },
    },
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

  // --- Editor inline blame -------------------------------------------------
  const detectConflictEntry = () =>
    detectConflictingAnnotation(
      vscode.extensions.getExtension,
      (section) => vscode.workspace.getConfiguration(section),
    );

  const blameAskChoice = (): Promise<'showBoth' | 'hideGitGress' | undefined> =>
    new Promise((resolve) => {
      const name = detectConflictEntry()?.displayName ?? 'another extension';
      void vscode.window
        .showInformationMessage(
          `Another extension (${name}) also shows a current-line blame annotation. Both will overlap. Which should GitGress do?`,
          'Show both',
          "Hide GitGress's",
        )
        .then((choice) => {
          if (choice === 'Show both') {
            resolve('showBoth');
          } else if (choice === "Hide GitGress's") {
            resolve('hideGitGress');
          } else {
            resolve(undefined);
          }
        });
    });

  const blameDeps = {
    blameService,
    resolveRepo: async (candidates: string[]) =>
      coordinator.resolveRepoForBlame(candidates),
    getLocale: () => vscode.env.language,
    getEnabled: () =>
      vscode.workspace.getConfiguration('gitgress').get<boolean>('editorBlame.enabled', true),
    getConflictMode: () =>
      vscode.workspace.getConfiguration('gitgress').get<'ask' | 'alwaysShow' | 'defer'>(
        'editorBlame.conflictMode',
        'ask',
      ),
    detectConflict: () => detectConflictEntry() !== null,
    askConflict: async (): Promise<void> => {
      const choice = await blameAskChoice();
      if (choice === undefined) {
        return; // dismissal keeps the ask mode for the next session
      }
      const mode = conflictModeForChoice(choice);
      await vscode.workspace
        .getConfiguration('gitgress')
        .update('editorBlame.conflictMode', mode, vscode.ConfigurationTarget.Global);
    },
    onDidChangeTextEditorSelection: (handler: () => void) =>
      vscode.window.onDidChangeTextEditorSelection(handler),
    onDidChangeActiveTextEditor: (handler: () => void) =>
      vscode.window.onDidChangeActiveTextEditor(handler),
    createDecorationType: () =>
      vscode.window.createTextEditorDecorationType({
        after: { color: new vscode.ThemeColor('editorCodeLens.foreground') },
      }),
    applyDecorations: (
      editor: TextEditorLike,
      type: DecorationTypeLike,
      options: DecorationOptionsLike[],
    ) => {
      // The editor here is always the real vscode.TextEditor; TextEditorLike
      // is the narrowed view the controller reasons about.
      const target = editor as vscode.TextEditor;
      const decorationType = type as vscode.TextEditorDecorationType;
      // Editor decoration types only render `renderOptions.after` per-range;
      // the cursor line decoration is drawn by keying the range on the line.
      const line = options[0]?.line0Based;
      if (line === undefined) {
        target.setDecorations(decorationType, []);
        return;
      }
      const line0Based = Math.max(0, line);
      if (line0Based >= target.document.lineCount) {
        target.setDecorations(decorationType, []);
        return;
      }
      const endCharacter = lineEndCharacter(target.document.lineAt(line0Based).text);
      target.setDecorations(decorationType, [
        {
          range: new vscode.Range(line0Based, endCharacter, line0Based, endCharacter),
          renderOptions: {
            after: { contentText: `  ${options[0].contentText}` },
          },
        },
      ]);
    },
    getActiveEditor: () => vscode.window.activeTextEditor,
  };
  const blameController = new BlameController(blameDeps);
  const blameHoverProvider = new BlameHoverProvider({
    resolveRepo: blameDeps.resolveRepo,
    getCachedBlame: (fsPath, line0Based) => blameController.getCachedBlame(fsPath, line0Based),
    commitDetails: (repoRoot, commitId) => blameService.commitDetails(repoRoot, commitId),
    getLocale: blameDeps.getLocale,
  });
  blameController.activate();
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
        publishHasRepository(executeCommand, snapshot.repoRoot !== null);
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
    blameController,
    vscode.languages.registerHoverProvider('*', blameHoverProvider),
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
    vscode.commands.registerCommand('gitgress.copyBlameHash', async (commitId: unknown) => {
      try {
        if (typeof commitId !== 'string' || commitId === '') {
          return;
        }
        await vscode.env.clipboard.writeText(commitId);
      } catch (error) {
        await showError(error);
      }
    }),
    vscode.commands.registerCommand('gitgress.revealFromBlame', async (commitId: unknown) => {
      try {
        if (typeof commitId !== 'string' || commitId === '') {
          return;
        }
        try {
          await vscode.commands.executeCommand('gitgress.commits.focus');
        } catch {
          // Older VS Code without the view-focus command id: fall back to the
          // view container.
          await vscode.commands.executeCommand('workbench.view.extension.gitgress');
        }
        await commitsProvider.revealCommit(commitId);
      } catch (error) {
        await showError(error);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration('gitgress.editorBlame') ||
        event.affectsConfiguration('gitlens.currentLine')
      ) {
        blameController.refresh();
      }
    }),
  );

  await index.start();
  coordinator.resolveInitial();
  // Subscribe before any further await so no scan progress is missed, then sync once.
  context.subscriptions.push({ dispose: index.subscribe(onIndexChanged) });
  onIndexChanged();
  await ensureBranch();
  publishHasRepository(executeCommand, selection.getSnapshot().repoRoot !== null);
}

export function deactivate(): void {}

import * as vscode from 'vscode';
import { registerOpenFileDiff } from './commands/openFileDiff';
import { gitErrorMessage, refreshRepository } from './commands/refresh';
import { switchBranch } from './commands/switchBranch';
import { DiffService } from './diff/DiffService';
import { GITGRESS_SCHEME } from './diff/gitgressUri';
import { GitgressContentProvider } from './diff/GitgressContentProvider';
import { GitService } from './git/GitService';
import { createRunGit } from './git/runGit';
import { SelectionState } from './state/SelectionState';
import { CommitsViewProvider } from './views/commits/CommitsViewProvider';
import { ChangedFilesTreeProvider } from './views/files/ChangedFilesTreeProvider';

export function activate(context: vscode.ExtensionContext): void {
  const gitService = new GitService(createRunGit());
  const selection = new SelectionState();
  const diffService = new DiffService();
  const commitsProvider = new CommitsViewProvider(
    context.extensionUri,
    selection,
    gitService,
  );
  const filesProvider = new ChangedFilesTreeProvider(selection, gitService);

  const showError = async (error: unknown): Promise<void> => {
    await vscode.window.showErrorMessage(gitErrorMessage(error));
  };
  const reloadRepository = async (): Promise<void> => {
    try {
      await refreshRepository(
        gitService,
        selection,
        vscode.workspace.workspaceFolders ?? [],
      );
      commitsProvider.refresh();
      filesProvider.refresh();
    } catch (error) {
      selection.setRepo(null);
      await showError(error);
    }
  };

  context.subscriptions.push(
    commitsProvider,
    filesProvider,
    vscode.window.registerWebviewViewProvider(
      'gitgress.commits',
      commitsProvider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
    vscode.window.registerTreeDataProvider('gitgress.files', filesProvider),
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
    vscode.commands.registerCommand('gitgress.refresh', reloadRepository),
    vscode.workspace.onDidChangeWorkspaceFolders(reloadRepository),
  );

  void reloadRepository();
}

export function deactivate(): void {}

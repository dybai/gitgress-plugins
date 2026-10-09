import * as vscode from 'vscode';
import { registerOpenFileDiff } from './commands/openFileDiff';
import { DiffService } from './diff/DiffService';
import { GITGRESS_SCHEME } from './diff/gitgressUri';
import { GitgressContentProvider } from './diff/GitgressContentProvider';
import { GitService } from './git/GitService';
import { createRunGit } from './git/runGit';
import { SelectionState } from './state/SelectionState';
import { ChangedFilesTreeProvider } from './views/files/ChangedFilesTreeProvider';

export function activate(context: vscode.ExtensionContext): void {
  const gitService = new GitService(createRunGit());
  const selection = new SelectionState();
  const diffService = new DiffService();
  const filesProvider = new ChangedFilesTreeProvider(selection, gitService);

  context.subscriptions.push(
    filesProvider,
    vscode.window.registerTreeDataProvider('gitgress.files', filesProvider),
    vscode.workspace.registerTextDocumentContentProvider(
      GITGRESS_SCHEME,
      new GitgressContentProvider(gitService),
    ),
    registerOpenFileDiff(selection, diffService),
  );
}

export function deactivate(): void {}

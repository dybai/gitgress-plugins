import * as vscode from 'vscode';
import { shouldAllowOpenWorkingFile, workingFileUriPath } from './workingFile';

export async function openWorkingFile(
  repoRoot: string,
  relativePath: string,
  status?: string,
): Promise<void> {
  if (status !== undefined && !shouldAllowOpenWorkingFile(status)) {
    return;
  }
  const fsPath = workingFileUriPath(repoRoot, relativePath);
  if (fsPath === undefined) {
    await vscode.window.showErrorMessage(`Cannot open file: ${relativePath}`);
    return;
  }
  try {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fsPath));
    await vscode.window.showTextDocument(document, { preview: true });
  } catch {
    await vscode.window.showErrorMessage(`Cannot open file: ${relativePath}`);
  }
}

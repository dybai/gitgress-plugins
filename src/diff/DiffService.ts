import * as vscode from 'vscode';
import { encodeGitgressUri, resolveDiffRevisions } from './gitgressUri';

export class DiffService {
  open(
    repoRoot: string,
    commitId: string,
    parentId: string | null,
    filePath: string,
    status: string,
  ): Thenable<void> {
    const { left, right } = resolveDiffRevisions(commitId, parentId, status);
    const leftUri = encodeGitgressUri(repoRoot, left, filePath);
    const rightUri = encodeGitgressUri(repoRoot, right, filePath);
    const title = `${filePath} (parent ↔ ${commitId.slice(0, 7)})`;

    return vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title);
  }
}

import type * as vscode from 'vscode';
import type { GitService } from '../git/GitService';
import { decodeGitgressUri, EMPTY_REVISION } from './gitgressUri';

export class GitgressContentProvider implements vscode.TextDocumentContentProvider {
  constructor(private readonly gitService: GitService) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    const { repoRoot, revision, filePath } = decodeGitgressUri(uri);
    if (revision === EMPTY_REVISION) {
      return '';
    }

    return (await this.gitService.showFileAtRevision(repoRoot, revision, filePath)) ?? '';
  }
}

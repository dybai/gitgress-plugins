import * as vscode from 'vscode';
import type { CommitDetails } from './parseShowDetails';
import type { LineBlame } from './parseBlamePorcelain';
import { buildBlameHoverMarkdown } from './buildBlameHoverMarkdown';

export type BlameHoverProviderDeps = {
  resolveRepo: (candidates: string[]) => Promise<string | null>;
  getCachedBlame: (fsPath: string, line0Based: number) => LineBlame | undefined;
  commitDetails: (repoRoot: string, commitId: string) => Promise<CommitDetails | null>;
  getLocale: () => string;
  nowMs?: () => number;
};

/**
 * Hover provider for the editor inline blame: renders the cached line blame
 * (from `BlameController`) plus `git show` details as trusted markdown.
 */
export class BlameHoverProvider implements vscode.HoverProvider {
  private readonly nowMs: () => number;

  constructor(private readonly deps: BlameHoverProviderDeps) {
    this.nowMs = deps.nowMs ?? (() => Date.now());
  }

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Hover | null> {
    const blame = this.deps.getCachedBlame(document.uri.fsPath, position.line);
    if (blame === undefined) {
      return null;
    }
    const repoRoot = await this.deps.resolveRepo([document.uri.fsPath]);
    if (repoRoot === null) {
      return null;
    }
    const details = await this.deps.commitDetails(repoRoot, blame.commitId);
    const markdown = buildBlameHoverMarkdown({
      commitId: blame.commitId,
      authorName: blame.authorName,
      authorTimeUnix: blame.authorTimeUnix,
      summary: blame.summary,
      fullMessage: details?.fullMessage ?? blame.summary,
      additions: details?.additions ?? 0,
      deletions: details?.deletions ?? 0,
      nowMs: this.nowMs(),
      locale: this.deps.getLocale(),
    });
    const markdownString = new vscode.MarkdownString(markdown, true);
    markdownString.isTrusted = true;
    return new vscode.Hover(markdownString);
  }
}

import * as vscode from 'vscode';
import type { GitService } from '../../git/GitService';
import type { SelectionSnapshot, SelectionState } from '../../state/SelectionState';
import { buildFileTree, type FileTreeNode } from './buildFileTree';
import { filesViewModel } from './filesViewModel';

export class ChangedFilesTreeProvider
  implements vscode.TreeDataProvider<FileTreeNode>, vscode.Disposable
{
  private readonly changeEmitter = new vscode.EventEmitter<
    FileTreeNode | undefined | null | void
  >();
  private readonly unsubscribe: () => void;
  private roots: FileTreeNode[] = [];
  private loadVersion = 0;

  readonly onDidChangeTreeData = this.changeEmitter.event;

  constructor(
    private readonly selection: SelectionState,
    private readonly gitService: GitService,
  ) {
    this.unsubscribe = selection.subscribe((snapshot) => {
      void this.load(snapshot);
    });
    void this.load(selection.getSnapshot());
  }

  getTreeItem(node: FileTreeNode): vscode.TreeItem {
    if (node.contextValue === 'empty' || node.contextValue === 'error') {
      const item = new vscode.TreeItem(node.name, vscode.TreeItemCollapsibleState.None);
      item.contextValue = node.contextValue;
      return item;
    }

    const collapsibleState =
      node.kind === 'dir'
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None;
    const item = new vscode.TreeItem(node.name, collapsibleState);
    item.contextValue = node.kind;
    item.tooltip = node.path;
    item.iconPath = new vscode.ThemeIcon(node.kind === 'dir' ? 'folder' : 'file');

    if (node.kind === 'file') {
      item.description = node.status;
      item.command = {
        command: 'gitgress.openFileDiff',
        title: 'Open File Diff',
        arguments: [node],
      };
    }
    return item;
  }

  getChildren(node?: FileTreeNode): FileTreeNode[] {
    return node?.children ?? (node === undefined ? this.roots : []);
  }

  refresh(): void {
    void this.load(this.selection.getSnapshot());
  }

  dispose(): void {
    this.unsubscribe();
    this.changeEmitter.dispose();
  }

  private async load(snapshot: SelectionSnapshot): Promise<void> {
    const version = ++this.loadVersion;
    const { repoRoot, selectedCommitId } = snapshot;

    if (repoRoot === null || selectedCommitId === null) {
      this.applyViewModel(filesViewModel(null, null), version);
      return;
    }

    try {
      const files = await this.gitService.changedFiles(repoRoot, selectedCommitId);
      this.applyViewModel(filesViewModel(selectedCommitId, files), version);
    } catch {
      this.applyViewModel(
        filesViewModel(selectedCommitId, null, 'Unable to load changed files'),
        version,
      );
    }
  }

  private applyViewModel(
    model: ReturnType<typeof filesViewModel>,
    version: number,
  ): void {
    if (version !== this.loadVersion) {
      return;
    }
    this.roots =
      model.mode === 'loaded'
        ? buildFileTree(model.files, { compact: false })
        : [
            {
              name: model.message,
              path: '',
              kind: 'file',
              contextValue: model.mode,
            },
          ];
    this.changeEmitter.fire();
  }
}

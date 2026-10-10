export type SelectionSnapshot = {
  repoRoot: string | null;
  branch: string | null;
  selectedCommitId: string | null;
  /** Increments whenever {@link SelectionState.setRepo} selects a different root. */
  repoGeneration: number;
};

type Listener = (snapshot: SelectionSnapshot) => void;

export class SelectionState {
  private repoRoot: string | null = null;
  private branch: string | null = null;
  private selectedCommitId: string | null = null;
  private repoGeneration = 0;
  private readonly listeners = new Set<Listener>();

  getSnapshot(): SelectionSnapshot {
    return {
      repoRoot: this.repoRoot,
      branch: this.branch,
      selectedCommitId: this.selectedCommitId,
      repoGeneration: this.repoGeneration,
    };
  }

  setRepo(repoRoot: string | null): void {
    if (this.repoRoot === repoRoot) {
      return;
    }
    this.repoRoot = repoRoot;
    this.repoGeneration += 1;
    this.branch = null;
    this.selectedCommitId = null;
    this.notify();
  }

  setBranch(branch: string | null): void {
    if (this.branch === branch && this.selectedCommitId === null) {
      return;
    }
    this.branch = branch;
    this.selectedCommitId = null;
    this.notify();
  }

  selectCommit(commitId: string | null): void {
    if (this.selectedCommitId === commitId) {
      return;
    }
    this.selectedCommitId = commitId;
    this.notify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

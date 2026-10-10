import { findOwningRepoRoot, normalizeRepoPath } from '../repoIndex/pathNormalize.js';
import type { SelectionState } from './SelectionState.js';

export type ManualRepoPreference = {
  get(): string | null;
  set(root: string | null): void;
};

export class SelectionCoordinator {
  private locked = false;

  constructor(
    private readonly selection: Pick<SelectionState, 'getSnapshot' | 'setRepo'>,
    private readonly getIndexedRoots: () => readonly string[],
    private readonly preference: ManualRepoPreference,
    private readonly getActiveFilePath: () => string | null,
  ) {}

  /** Apply preference → editor → empty. Clears stale preference. */
  resolveInitial(): void {
    const pref = this.preference.get();
    if (pref != null) {
      const normalizedPref = normalizeRepoPath(pref);
      if (this.indexContains(normalizedPref)) {
        this.selection.setRepo(normalizedPref);
        this.locked = true;
        return;
      }
      // Stale preference: clear it and fall through.
      this.preference.set(null);
    }

    const owner = this.editorOwningRoot();
    if (owner != null) {
      this.selection.setRepo(owner);
      this.locked = true;
      return;
    }

    // Nothing matches: empty selection, do not lock.
    this.selection.setRepo(null);
  }

  /**
   * Index grew/changed: if unlocked and empty, try editor rule; if a preferred
   * repo appeared, apply preference. Do not unlock a sticky selection.
   */
  onIndexUpdated(): void {
    if (this.locked) {
      return;
    }

    const pref = this.preference.get();
    if (pref != null) {
      const normalizedPref = normalizeRepoPath(pref);
      if (this.indexContains(normalizedPref)) {
        this.selection.setRepo(normalizedPref);
        this.locked = true;
        return;
      }
    }

    if (this.selection.getSnapshot().repoRoot === null) {
      const owner = this.editorOwningRoot();
      if (owner != null) {
        this.selection.setRepo(owner);
        this.locked = true;
      }
    }
  }

  onActiveEditorChanged(): void {
    if (this.locked) {
      return;
    }
    if (this.selection.getSnapshot().repoRoot !== null) {
      return;
    }
    const owner = this.editorOwningRoot();
    if (owner != null) {
      this.selection.setRepo(owner);
      this.locked = true;
    }
  }

  selectManually(repoRoot: string): void {
    const normalized = normalizeRepoPath(repoRoot);
    this.selection.setRepo(normalized);
    this.locked = true;
    this.preference.set(normalized);
  }

  /** Selected repo vanished: setRepo(null), unlock, then resolveInitial(). */
  onSelectedRepoInvalid(): void {
    this.selection.setRepo(null);
    this.locked = false;
    this.resolveInitial();
  }

  isLocked(): boolean {
    return this.locked;
  }

  private indexContains(normalizedRoot: string): boolean {
    for (const root of this.getIndexedRoots()) {
      if (normalizeRepoPath(root) === normalizedRoot) {
        return true;
      }
    }
    return false;
  }

  private editorOwningRoot(): string | null {
    const activeFile = this.getActiveFilePath();
    if (activeFile == null) {
      return null;
    }
    return findOwningRepoRoot(activeFile, this.getIndexedRoots());
  }
}

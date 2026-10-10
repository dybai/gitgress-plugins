import { findOwningRepoRoot, normalizeRepoPath } from '../repoIndex/pathNormalize.js';
import type { SelectionState } from './SelectionState.js';

export type ManualRepoPreference = {
  get(): string | null;
  set(root: string | null): void;
};

export class SelectionCoordinator {
  private locked = false;
  private indexAuthoritative = false;

  constructor(
    private readonly selection: Pick<SelectionState, 'getSnapshot' | 'setRepo'>,
    private readonly getIndexedRoots: () => readonly string[],
    private readonly preference: ManualRepoPreference,
    private readonly getActiveFilePath: () => string | null,
  ) {}

  /** Apply preference → editor → empty. Clears stale preference when the index is authoritative. */
  resolveInitial(): void {
    const pref = this.preference.get();
    if (pref != null) {
      const normalizedPref = normalizeRepoPath(pref);
      if (this.indexContains(normalizedPref)) {
        this.selection.setRepo(normalizedPref);
        this.locked = true;
        return;
      }
      // Clear a stale preference once the index is authoritative, or when the
      // index is non-empty and provably omits it. An empty non-authoritative
      // index may be transient before the first scan completes, so preserve
      // the preference to allow the preferred-appeared path in onIndexUpdated.
      if (this.indexAuthoritative || this.getIndexedRoots().length > 0) {
        this.preference.set(null);
      }
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
   * repo appeared, apply preference. Do not unlock a sticky selection. Once
   * the index is authoritative, a non-matching preference is cleared so it
   * cannot be silently resurrected later.
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
      if (this.indexAuthoritative || this.getIndexedRoots().length > 0) {
        this.preference.set(null);
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

  /**
   * Scan completed and the index is now authoritative. Clear any preference
   * that is not backed by the index (including an empty index), then apply
   * resolve rules. A locked selection that vanished from the authoritative
   * index is unlocked and re-resolved.
   */
  onScanIdle(): void {
    this.indexAuthoritative = true;
    const pref = this.preference.get();
    if (pref != null && !this.indexContains(normalizeRepoPath(pref))) {
      this.preference.set(null);
    }

    if (this.locked) {
      const current = this.selection.getSnapshot().repoRoot;
      if (current != null && !this.indexContains(current)) {
        this.locked = false;
        this.selection.setRepo(null);
        this.resolveInitial();
      }
      return;
    }

    this.resolveInitial();
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

  /**
   * Selected repo vanished: if the manual preference points at the same
   * vanished root, drop it so the re-resolve cannot resurrect it. Then
   * setRepo(null), unlock, and resolveInitial().
   */
  onSelectedRepoInvalid(): void {
    const current = this.selection.getSnapshot().repoRoot;
    const pref = this.preference.get();
    if (
      current != null &&
      pref != null &&
      normalizeRepoPath(pref) === normalizeRepoPath(current)
    ) {
      this.preference.set(null);
    }
    this.selection.setRepo(null);
    this.locked = false;
    this.resolveInitial();
  }

  /**
   * Git failed for the selected repository. Clear the selection and unlock so
   * later index updates / scan completion / editor changes can re-resolve it.
   * Unlike onSelectedRepoInvalid(), this does not re-resolve immediately, so a
   * persistently failing repo cannot cause a select → fail → select loop.
   * The manual preference is dropped only when `forgetPreference` is set and
   * it points at the failed root (a global failure such as git missing keeps it).
   */
  clearSelection(options: { forgetPreference?: boolean } = {}): void {
    if (options.forgetPreference === true) {
      const current = this.selection.getSnapshot().repoRoot;
      const pref = this.preference.get();
      if (
        current != null &&
        pref != null &&
        normalizeRepoPath(pref) === normalizeRepoPath(current)
      ) {
        this.preference.set(null);
      }
    }
    this.selection.setRepo(null);
    this.locked = false;
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

import { findOwningRepoRoot, normalizeRepoPath } from '../repoIndex/pathNormalize.js';
import type { SelectionState } from './SelectionState.js';

export type ManualRepoPreference = {
  get(): string | null;
  set(root: string | null): void;
};

export class SelectionCoordinator {
  private locked = false;
  private indexAuthoritative = false;
  /** Failed root: skip re-select until scan idle or explicit user action. */
  private reSelectSuppressedRoot: string | null = null;

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
      if (
        this.indexContains(normalizedPref) &&
        !this.isReSelectSuppressed(normalizedPref)
      ) {
        this.selection.setRepo(normalizedPref);
        this.locked = true;
        return;
      }
      // Clear a stale preference only once the index is authoritative (scan
      // idle). A partial or cached-but-in-flight index may omit a repo the walk
      // has not reached yet.
      if (this.indexAuthoritative && !this.indexContains(normalizedPref)) {
        this.preference.set(null);
      }
    }

    if (!this.hasPendingManualPreference()) {
      const owner = this.editorOwningRoot();
      if (owner != null && !this.isReSelectSuppressed(normalizeRepoPath(owner))) {
        this.selection.setRepo(owner);
        this.locked = true;
        return;
      }
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
    const pref = this.preference.get();
    if (pref != null) {
      const normalizedPref = normalizeRepoPath(pref);
      if (
        this.indexContains(normalizedPref) &&
        !this.isReSelectSuppressed(normalizedPref)
      ) {
        this.selection.setRepo(normalizedPref);
        this.locked = true;
        return;
      }
      if (this.indexAuthoritative && !this.indexContains(normalizedPref)) {
        this.preference.set(null);
      }
    }

    if (this.locked) {
      return;
    }

    if (this.hasPendingManualPreference()) {
      return;
    }

    if (this.selection.getSnapshot().repoRoot === null) {
      const owner = this.editorOwningRoot();
      if (owner != null && !this.isReSelectSuppressed(normalizeRepoPath(owner))) {
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
    this.reSelectSuppressedRoot = null;
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
    if (this.hasPendingManualPreference()) {
      return;
    }
    if (this.selection.getSnapshot().repoRoot !== null) {
      return;
    }
    const owner = this.editorOwningRoot();
    if (owner != null && !this.isReSelectSuppressed(normalizeRepoPath(owner))) {
      this.selection.setRepo(owner);
      this.locked = true;
    }
  }

  /** Allow index / coordinator resolution after explicit reload or workspace change. */
  clearReSelectSuppression(): void {
    this.reSelectSuppressedRoot = null;
  }

  selectManually(repoRoot: string): void {
    this.reSelectSuppressedRoot = null;
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
    const current = this.selection.getSnapshot().repoRoot;
    if (options.forgetPreference === true) {
      const pref = this.preference.get();
      if (
        current != null &&
        pref != null &&
        normalizeRepoPath(pref) === normalizeRepoPath(current)
      ) {
        this.preference.set(null);
      }
    }
    if (current != null) {
      this.reSelectSuppressedRoot = normalizeRepoPath(current);
    }
    this.selection.setRepo(null);
    this.locked = false;
  }

  isLocked(): boolean {
    return this.locked;
  }

  private isReSelectSuppressed(normalizedRoot: string): boolean {
    return (
      this.reSelectSuppressedRoot !== null &&
      this.reSelectSuppressedRoot === normalizedRoot
    );
  }

  private indexContains(normalizedRoot: string): boolean {
    for (const root of this.getIndexedRoots()) {
      if (normalizeRepoPath(root) === normalizedRoot) {
        return true;
      }
    }
    return false;
  }

  /** Saved manual root not in the index yet while scan is still in flight. */
  private hasPendingManualPreference(): boolean {
    if (this.indexAuthoritative) {
      return false;
    }
    const pref = this.preference.get();
    if (pref == null) {
      return false;
    }
    return !this.indexContains(normalizeRepoPath(pref));
  }

  private editorOwningRoot(): string | null {
    const activeFile = this.getActiveFilePath();
    if (activeFile == null) {
      return null;
    }
    return findOwningRepoRoot(activeFile, this.getIndexedRoots());
  }
}

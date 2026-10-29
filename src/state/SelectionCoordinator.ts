import { findOwningRepoRoot, normalizeRepoPath } from '../repoIndex/pathNormalize.js';
import type { SelectionState } from './SelectionState.js';

export type ManualRepoPreference = {
  get(): string | null;
  set(root: string | null): void;
};

/**
 * Last effective repository root, used only to restore a selection on startup.
 * Unlike {@link ManualRepoPreference} this is not a user intent and never gates
 * the editor or fallback rules.
 */
export type RepoMemory = {
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
    private readonly getWorkspaceFolderPaths: () => readonly string[],
    /**
     * Fallback when the workspace index does not yet contain the editor file's
     * repo (cold start / scan still running). Typically walks ancestors for `.git`.
     */
    private readonly discoverGitRoot?: (filePath: string) => string | null,
    private readonly memory?: RepoMemory,
  ) {}

  /** Apply preference → editor → remembered → authoritative fallback → empty. Clears stale preference when the index is authoritative. */
  resolveInitial(): void {
    const pref = this.preference.get();
    if (pref != null) {
      const normalizedPref = normalizeRepoPath(pref);
      if (
        this.indexContains(normalizedPref) &&
        !this.isReSelectSuppressed(normalizedPref)
      ) {
        this.select(normalizedPref);
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
        this.select(owner);
        return;
      }
      const remembered = this.rememberedRoot();
      if (remembered != null && !this.isReSelectSuppressed(remembered)) {
        this.select(remembered);
        return;
      }
    }

    const fallback = this.fallbackRepoRoot();
    if (fallback != null && !this.isReSelectSuppressed(fallback)) {
      this.select(fallback);
      return;
    }
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
        this.select(normalizedPref);
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
        this.select(owner);
        return;
      }
      const remembered = this.rememberedRoot();
      if (remembered != null && !this.isReSelectSuppressed(remembered)) {
        this.select(remembered);
      }
    }
  }

  /**
   * Scan completed and the index is now authoritative. Clear any preference
   * that is not backed by the index (including an empty index), then apply
   * resolve rules. A locked selection that vanished from the authoritative
   * index is unlocked and re-resolved.
   */
  /** Scan (re)started; index is incomplete until the next idle transition. */
  onScanStarted(): void {
    this.indexAuthoritative = false;
  }

  onScanIdle(): void {
    this.reSelectSuppressedRoot = null;
    this.indexAuthoritative = true;
    const pref = this.preference.get();
    if (pref != null && !this.indexContains(normalizeRepoPath(pref))) {
      this.preference.set(null);
    }

    const remembered = this.memory?.get() ?? null;
    if (remembered != null && !this.indexContains(normalizeRepoPath(remembered))) {
      this.memory?.set(null);
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
      this.select(owner);
    }
  }

  /**
   * Resolve the Git root that owns a file for the editor inline blame, without
   * changing the repository selection. Prefers the most specific indexed root
   * containing the file; falls back to walking ancestors for `.git`
   * (cold start / scan still running).
   */
  resolveRepoForBlame(candidates: readonly string[]): string | null {
    for (const candidate of candidates) {
      const owner = findOwningRepoRoot(candidate, this.getIndexedRoots());
      if (owner != null) {
        return owner;
      }
      const discovered = this.discoverGitRoot?.(candidate) ?? null;
      if (discovered != null) {
        return normalizeRepoPath(discovered);
      }
    }
    return null;
  }

  /** Allow index / coordinator resolution after explicit reload or workspace change. */
  clearReSelectSuppression(): void {
    this.reSelectSuppressedRoot = null;
  }

  selectManually(repoRoot: string): void {
    this.reSelectSuppressedRoot = null;
    const normalized = normalizeRepoPath(repoRoot);
    this.select(normalized);
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
    if (current != null) {
      this.forgetMemoryFor(normalizeRepoPath(current));
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
      if (current != null) {
        this.forgetMemoryFor(normalizeRepoPath(current));
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
    const fromIndex = findOwningRepoRoot(activeFile, this.getIndexedRoots());
    if (fromIndex != null) {
      return fromIndex;
    }
    return this.discoverGitRoot?.(activeFile) ?? null;
  }

  private fallbackRepoRoot(): string | null {
    if (!this.indexAuthoritative) {
      return null;
    }
    const indexed = this.getIndexedRoots().map((root) => normalizeRepoPath(root));
    const folders = new Set(
      this.getWorkspaceFolderPaths().map((folder) => normalizeRepoPath(folder)),
    );
    const folderMatches = indexed.filter((root) => folders.has(root));
    if (folderMatches.length === 1) {
      return folderMatches[0]!;
    }
    if (indexed.length === 1) {
      return indexed[0]!;
    }
    return null;
  }

  /** Select and lock a repository, recording it as the last effective root. */
  private select(root: string): void {
    this.selection.setRepo(root);
    this.locked = true;
    this.memory?.set(normalizeRepoPath(root));
  }

  /**
   * Remembered root that is present in the index. Clears the memory once the
   * index is authoritative and the root is gone.
   */
  private rememberedRoot(): string | null {
    const remembered = this.memory?.get() ?? null;
    if (remembered == null) {
      return null;
    }
    const normalized = normalizeRepoPath(remembered);
    if (this.indexContains(normalized)) {
      return normalized;
    }
    if (this.indexAuthoritative) {
      this.memory?.set(null);
    }
    return null;
  }

  /** Clear the remembered root when it points at `normalizedRoot`. */
  private forgetMemoryFor(normalizedRoot: string): void {
    const remembered = this.memory?.get() ?? null;
    if (remembered != null && normalizeRepoPath(remembered) === normalizedRoot) {
      this.memory?.set(null);
    }
  }
}

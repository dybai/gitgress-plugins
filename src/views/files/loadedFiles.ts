import { resolveDiffTarget, type DiffTarget } from '../../commands/diffTarget';

export interface LoadedFiles {
  repoRoot: string;
  commitId: string;
  files: readonly DiffTarget[];
}

export interface SelectionKey {
  repoRoot: string | null;
  selectedCommitId: string | null;
}

/** True only when the loaded file list was produced for exactly this selection. */
export function matchesSelection(
  loaded: LoadedFiles | null,
  selection: SelectionKey,
): loaded is LoadedFiles {
  return (
    loaded !== null &&
    loaded.repoRoot === selection.repoRoot &&
    loaded.commitId === selection.selectedCommitId
  );
}

/**
 * Resolve a path against the loaded list, but only if the list belongs to the
 * current selection. A stale list (selection changed, new load pending) yields
 * undefined so actions cannot use old statuses against a new commit.
 */
export function resolveLoadedTarget(
  loaded: LoadedFiles | null,
  selection: SelectionKey,
  path: string,
): DiffTarget | undefined {
  if (!matchesSelection(loaded, selection)) {
    return undefined;
  }
  return resolveDiffTarget(loaded.files, path);
}

import type { SelectionSnapshot } from '../../state/SelectionState';

export type CommitsLoadContext = Pick<SelectionSnapshot, 'repoRoot' | 'branch'>;

export function shouldReloadCommits(
  prev: CommitsLoadContext | null,
  next: SelectionSnapshot,
): boolean {
  if (prev === null) {
    return true;
  }
  return prev.repoRoot !== next.repoRoot || prev.branch !== next.branch;
}

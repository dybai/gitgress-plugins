export type EmptyRepoReason = 'noRepo' | 'noSelection';

export function emptyRepoReason(indexedRootCount: number): EmptyRepoReason {
  return indexedRootCount >= 1 ? 'noSelection' : 'noRepo';
}

/** When the index changes with no repo selected, return the new empty reason or null if unchanged. */
export function emptyReasonOnIndexChange(
  indexedRootCount: number,
  lastPostedReason: EmptyRepoReason | null,
): EmptyRepoReason | null {
  const next = emptyRepoReason(indexedRootCount);
  return next === lastPostedReason ? null : next;
}

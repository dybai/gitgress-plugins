export function emptyRepoReason(indexedRootCount: number): 'noRepo' | 'noSelection' {
  return indexedRootCount >= 1 ? 'noSelection' : 'noRepo';
}

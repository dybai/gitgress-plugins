export type TipJumpTarget = {
  targetId: string;
  distance: number;
};

/**
 * `tipCommitIds` must be ordered by ascending index in the loaded commit list
 * (top of list first). `up` moves toward the top; `down` toward the bottom.
 */
export function tipJumpTarget(
  tipCommitIds: readonly string[],
  currentId: string,
  direction: 'up' | 'down',
  indexById: ReadonlyMap<string, number>,
): TipJumpTarget | null {
  const tipIndex = tipCommitIds.indexOf(currentId);
  if (tipIndex < 0) {
    return null;
  }
  const nextTipIndex = direction === 'up' ? tipIndex - 1 : tipIndex + 1;
  if (nextTipIndex < 0 || nextTipIndex >= tipCommitIds.length) {
    return null;
  }
  const targetId = tipCommitIds[nextTipIndex];
  const currentRow = indexById.get(currentId);
  const targetRow = indexById.get(targetId);
  if (currentRow === undefined || targetRow === undefined) {
    return null;
  }
  const distance = Math.abs(targetRow - currentRow);
  if (distance <= 0) {
    return null;
  }
  return { targetId, distance };
}

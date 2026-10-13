export const chooseScrollAnchorId = (
  selectedCommitId,
  rows,
  viewportTop,
  viewportBottom,
) => {
  if (
    typeof selectedCommitId === 'string' &&
    rows.some((row) => row.id === selectedCommitId)
  ) {
    return selectedCommitId;
  }

  return (
    rows.find(
      (row) => row.bottom > viewportTop && row.top < viewportBottom,
    )?.id ?? null
  );
};

export const anchoredScrollTop = (scrollTop, beforeTop, afterTop) =>
  scrollTop + afterTop - beforeTop;

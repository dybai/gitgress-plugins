export type CommitNavKey =
  | 'ArrowUp'
  | 'ArrowDown'
  | 'Home'
  | 'End'
  | 'PageUp'
  | 'PageDown';

const NAV_KEYS = new Set<string>([
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
]);

export function isCommitNavKey(key: string): key is CommitNavKey {
  return NAV_KEYS.has(key);
}

export function computePageStep(
  viewportHeight: number,
  rowHeight: number,
): number {
  if (!(viewportHeight > 0) || !(rowHeight > 0)) {
    return 1;
  }
  return Math.max(1, Math.floor(viewportHeight / rowHeight) - 1);
}

export function nextCommitIndex(
  currentIndex: number,
  key: CommitNavKey,
  options: { length: number; pageStep: number },
): number {
  const { length, pageStep } = options;
  if (length < 1) {
    return currentIndex;
  }
  const last = length - 1;
  const step = Math.max(1, pageStep);
  let next = currentIndex;
  switch (key) {
    case 'ArrowUp':
      next = currentIndex - 1;
      break;
    case 'ArrowDown':
      next = currentIndex + 1;
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = last;
      break;
    case 'PageUp':
      next = currentIndex - step;
      break;
    case 'PageDown':
      next = currentIndex + step;
      break;
  }
  return Math.min(last, Math.max(0, next));
}

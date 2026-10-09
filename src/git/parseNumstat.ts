import type { NumstatEntry } from './types';

function parseCount(value: string): number {
  if (value === '-') {
    return 0;
  }
  const n = Number.parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

export function parseNumstat(stdout: string): Map<string, NumstatEntry> {
  const map = new Map<string, NumstatEntry>();
  const lines = stdout.split('\n').filter((line) => line.length > 0);
  for (const line of lines) {
    const [additionsRaw, deletionsRaw, path] = line.split('\t');
    if (path === undefined) {
      continue;
    }
    map.set(path, {
      additions: parseCount(additionsRaw ?? '0'),
      deletions: parseCount(deletionsRaw ?? '0'),
    });
  }
  return map;
}

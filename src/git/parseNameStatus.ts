import type { NameStatusEntry } from './types';

const STATUS_LETTERS = new Set(['A', 'M', 'D', 'R', 'C', 'T', 'U', '?']);

function parseStatusToken(token: string): NameStatusEntry['status'] {
  const letter = token.charAt(0);
  if (STATUS_LETTERS.has(letter)) {
    return letter as NameStatusEntry['status'];
  }
  return '?';
}

export function parseNameStatus(stdout: string): NameStatusEntry[] {
  const lines = stdout.split('\n').filter((line) => line.length > 0);
  return lines.map((line) => {
    const parts = line.split('\t');
    const status = parseStatusToken(parts[0] ?? '');
    if (status === 'R' || status === 'C') {
      const oldPath = parts[1] ?? '';
      const path = parts[2] ?? '';
      return { status, path, oldPath };
    }
    const path = parts[1] ?? '';
    return { status, path };
  });
}

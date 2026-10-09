import * as path from 'node:path';

export function shouldAllowOpenWorkingFile(status: string): boolean {
  return status !== 'D';
}

/** Absolute working-tree path, or undefined if the relative path escapes repoRoot. */
export function workingFileUriPath(
  repoRoot: string,
  relativePath: string,
): string | undefined {
  const root = path.resolve(repoRoot);
  const full = path.resolve(root, relativePath);
  const rel = path.relative(root, full);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    return undefined;
  }
  return full;
}

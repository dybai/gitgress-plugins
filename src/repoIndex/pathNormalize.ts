export function normalizeRepoPath(fsPath: string): string {
  let p = fsPath.replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(p)) {
    p = p[0].toLowerCase() + p.slice(1);
  }
  p = p.replace(/\/+$/, '');
  if (/^[a-z]:$/.test(p)) {
    p = `${p}/`;
  }
  return p;
}

function isPathPrefix(root: string, filePath: string): boolean {
  if (filePath === root) {
    return true;
  }
  return filePath.startsWith(`${root}/`);
}

export function findOwningRepoRoot(
  filePath: string,
  repoRoots: readonly string[],
): string | null {
  const normalizedFile = normalizeRepoPath(filePath);
  let best: string | null = null;
  let bestLength = -1;

  for (const root of repoRoots) {
    const normalizedRoot = normalizeRepoPath(root);
    if (!isPathPrefix(normalizedRoot, normalizedFile)) {
      continue;
    }
    if (normalizedRoot.length > bestLength) {
      bestLength = normalizedRoot.length;
      best = normalizedRoot;
    }
  }

  return best;
}

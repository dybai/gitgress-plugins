function normalizeSlashes(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '');
}

function basename(path: string): string {
  const normalized = normalizeSlashes(path);
  const slash = normalized.lastIndexOf('/');
  return slash === -1 ? normalized : normalized.slice(slash + 1);
}

function parentAndBase(path: string): string {
  const normalized = normalizeSlashes(path);
  const parts = normalized.split('/').filter((part) => part !== '');
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  }
  return parts[parts.length - 1] ?? normalized;
}

export function repoShortName(repoRoot: string, allRoots: readonly string[]): string {
  const base = basename(repoRoot);
  const collision = allRoots.some(
    (root) => root !== repoRoot && basename(root) === base && normalizeSlashes(root) !== normalizeSlashes(repoRoot),
  );
  if (collision) {
    return parentAndBase(repoRoot);
  }
  return base;
}

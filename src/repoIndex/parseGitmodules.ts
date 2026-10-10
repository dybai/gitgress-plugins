function normalizeSubmodulePath(raw: string): string {
  let p = raw.trim().replace(/\\/g, '/');
  while (p.startsWith('./')) {
    p = p.slice(2);
  }
  return p;
}

function isRelativeSubmodulePath(normalized: string): boolean {
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith('/')) {
    return false;
  }
  if (/^[a-zA-Z]:/.test(normalized)) {
    return false;
  }
  return true;
}

export function parseGitmodules(content: string): string[] {
  if (!content.trim()) {
    return [];
  }

  const seen = new Set<string>();
  const paths: string[] = [];

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*path\s*=\s*(.+?)\s*$/i);
    if (!match) {
      continue;
    }
    const normalized = normalizeSubmodulePath(match[1]);
    if (!isRelativeSubmodulePath(normalized)) {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    paths.push(normalized);
  }

  return paths;
}

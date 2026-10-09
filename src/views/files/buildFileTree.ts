export type FileTreeNode = {
  name: string;
  path: string;
  kind: 'dir' | 'file';
  status?: string;
  children?: FileTreeNode[];
};

type DirEntry = {
  name: string;
  path: string;
  kind: 'dir';
  childMap: Map<string, TreeEntry>;
};

type FileEntry = {
  name: string;
  path: string;
  kind: 'file';
  status: string;
};

type TreeEntry = DirEntry | FileEntry;

function sortSiblings(nodes: FileTreeNode[]): FileTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) {
      return a.kind === 'dir' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function entryToNode(entry: TreeEntry): FileTreeNode {
  if (entry.kind === 'file') {
    return {
      name: entry.name,
      path: entry.path,
      kind: 'file',
      status: entry.status,
    };
  }
  const children = sortSiblings(
    [...entry.childMap.values()].map(entryToNode),
  );
  return {
    name: entry.name,
    path: entry.path,
    kind: 'dir',
    children,
  };
}

function getOrCreateDir(
  parent: Map<string, TreeEntry>,
  name: string,
  path: string,
): DirEntry {
  const existing = parent.get(name);
  if (existing?.kind === 'dir') {
    return existing;
  }
  const dir: DirEntry = { name, path, kind: 'dir', childMap: new Map() };
  parent.set(name, dir);
  return dir;
}

function insert(
  root: Map<string, TreeEntry>,
  filePath: string,
  status: string,
): void {
  const segments = filePath.split('/').filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  let map = root;
  let prefix = '';

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const isFile = i === segments.length - 1;
    prefix = prefix ? `${prefix}/${seg}` : seg;

    if (isFile) {
      map.set(seg, { name: seg, path: prefix, kind: 'file', status });
    } else {
      const dir = getOrCreateDir(map, seg, prefix);
      map = dir.childMap;
    }
  }
}

export function buildFileTree(
  files: Array<{ path: string; status: string }>,
): FileTreeNode[] {
  const root = new Map<string, TreeEntry>();
  for (const file of files) {
    insert(root, file.path, file.status);
  }
  return sortSiblings([...root.values()].map(entryToNode));
}

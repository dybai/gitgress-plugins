export type FileTreeNode = {
  name: string;
  path: string;
  kind: 'dir' | 'file';
  status?: string;
  additions?: number;
  deletions?: number;
  children?: FileTreeNode[];
  contextValue?: 'empty' | 'error';
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
  additions: number;
  deletions: number;
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
      additions: entry.additions,
      deletions: entry.deletions,
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

function compactNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.map(compactNode);
}

function compactNode(node: FileTreeNode): FileTreeNode {
  if (node.kind === 'file') {
    return node;
  }
  let current = { ...node, children: compactNodes(node.children ?? []) };
  while (
    current.children?.length === 1 &&
    current.children[0].kind === 'dir'
  ) {
    const only = current.children[0];
    current = {
      kind: 'dir',
      name: `${current.name}/${only.name}`,
      path: only.path,
      children: only.children ?? [],
    };
  }
  return current;
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
  additions: number,
  deletions: number,
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
      map.set(seg, {
        name: seg,
        path: prefix,
        kind: 'file',
        status,
        additions,
        deletions,
      });
    } else {
      const dir = getOrCreateDir(map, seg, prefix);
      map = dir.childMap;
    }
  }
}

export function buildFileTree(
  files: Array<{ path: string; status: string; additions?: number; deletions?: number }>,
  options?: { compact?: boolean },
): FileTreeNode[] {
  const root = new Map<string, TreeEntry>();
  for (const file of files) {
    insert(
      root,
      file.path,
      file.status,
      file.additions ?? 0,
      file.deletions ?? 0,
    );
  }
  const nodes = sortSiblings([...root.values()].map(entryToNode));
  return options?.compact === false ? nodes : compactNodes(nodes);
}

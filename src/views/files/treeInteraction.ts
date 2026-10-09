/**
 * DOM-agnostic wiring for the Files webview tree layout.
 *
 * `vscode-tree-item` calls `stopPropagation()` on clicks inside its shadow wrapper, so
 * delegated `click` listeners on a container never see tree clicks. Selection must use
 * the tree's `vsc-tree-select` event, and Open buttons need their own direct listener.
 * Double-click to open Diff is also wired per file item — relying on `#content` delegation
 * is unreliable across the tree shadow boundary in the webview.
 */

export interface TreeItemLike {
  /** Prefer `filePath` — vscode-tree-item owns `path` as its index path (e.g. "0.0"). */
  dataset?: { filePath?: string; path?: string; kind?: string };
}

export interface ListenerTarget {
  addEventListener(type: string, listener: (event: any) => void): void;
}

export interface OpenButtonLike extends ListenerTarget {
  disabled: boolean;
  dataset: { path?: string };
}

export interface TreeFileItemLike extends ListenerTarget {
  dataset: { filePath?: string; path?: string; kind?: string };
}

/** Git relative path stored on tree items (not `data-path`, which vscode-tree-item overwrites). */
export function treeItemFilePath(dataset: TreeItemLike['dataset']): string | undefined {
  const filePath = dataset?.filePath;
  if (typeof filePath === 'string' && filePath !== '') {
    return filePath;
  }
  return undefined;
}

type ClosableTarget = {
  closest?(selector: string): unknown;
};

/**
 * Maps a `vsc-tree-select` detail to the selected file path. The runtime detail is an
 * array of selected items (the typings claim `{ selectedItems }`), so both are accepted.
 * Directory items are ignored.
 */
export function selectedFilePathFromTreeDetail(detail: unknown): string | undefined {
  const items = Array.isArray(detail)
    ? detail
    : Array.isArray((detail as { selectedItems?: unknown } | null)?.selectedItems)
      ? (detail as { selectedItems: unknown[] }).selectedItems
      : [];
  for (const item of items as TreeItemLike[]) {
    const dataset = item?.dataset;
    if (dataset?.kind !== 'file') {
      continue;
    }
    const path = treeItemFilePath(dataset);
    if (path !== undefined) {
      return path;
    }
  }
  return undefined;
}

/** Calls `onSelect(path)` whenever a file item is selected in the tree. */
export function wireTreeSelection(
  tree: ListenerTarget,
  onSelect: (path: string) => void,
): void {
  tree.addEventListener('vsc-tree-select', (event: { detail?: unknown }) => {
    const path = selectedFilePathFromTreeDetail(event.detail);
    if (path !== undefined) {
      onSelect(path);
    }
  });
}

/**
 * Attaches a direct click handler (target phase, so it runs before the tree item's
 * propagation stop). Propagation is stopped so the click does not also change selection.
 */
export function wireOpenButton(
  button: OpenButtonLike,
  onOpen: (path: string) => void,
): void {
  button.addEventListener('click', (event: { stopPropagation(): void }) => {
    event.stopPropagation();
    const path = button.dataset.path;
    if (path !== undefined && !button.disabled) {
      onOpen(path);
    }
  });
}

function isOpenButtonTarget(target: unknown): boolean {
  if (target === null || typeof target !== 'object') {
    return false;
  }
  const closable = target as ClosableTarget;
  return typeof closable.closest === 'function'
    ? closable.closest('button[data-action="open"]') != null
    : false;
}

/** Direct dblclick on a file tree item → open Diff (skips directories and Open button). */
export function wireTreeFileDoubleClick(
  item: TreeFileItemLike,
  onDiff: (path: string) => void,
): void {
  item.addEventListener('dblclick', (event: { target?: unknown }) => {
    if (item.dataset.kind !== 'file') {
      return;
    }
    const path = treeItemFilePath(item.dataset);
    if (path === undefined || isOpenButtonTarget(event.target)) {
      return;
    }
    onDiff(path);
  });
}

export type TreeSelectGesture = 'select' | 'openDiff';

/**
 * `vscode-tree-item` click uses stopPropagation inside shadow DOM; native `dblclick`
 * often never reaches our handlers in the webview. Each click still emits
 * `vsc-tree-select`, so two rapid selects of the same file mean "open Diff".
 */
export function createTreeDoubleSelectDetector(
  thresholdMs = 400,
  now: () => number = Date.now,
): (path: string) => TreeSelectGesture {
  let last: { path: string; at: number } | null = null;
  return (path: string): TreeSelectGesture => {
    const at = now();
    if (last !== null && last.path === path && at - last.at <= thresholdMs) {
      last = null;
      return 'openDiff';
    }
    last = { path, at };
    return 'select';
  };
}

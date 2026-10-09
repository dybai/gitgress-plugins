/**
 * DOM-agnostic wiring for the Files webview tree layout.
 *
 * `vscode-tree-item` calls `stopPropagation()` on clicks inside its shadow wrapper, so
 * delegated `click` listeners on a container never see tree clicks. Selection must use
 * the tree's `vsc-tree-select` event, and Open buttons need their own direct listener.
 */

export interface TreeItemLike {
  dataset?: { path?: string; kind?: string };
}

export interface ListenerTarget {
  addEventListener(type: string, listener: (event: any) => void): void;
}

export interface OpenButtonLike extends ListenerTarget {
  disabled: boolean;
  dataset: { path?: string };
}

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
    if (dataset?.kind === 'file' && typeof dataset.path === 'string' && dataset.path !== '') {
      return dataset.path;
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

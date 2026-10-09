import '@vscode-elements/elements/dist/vscode-badge/vscode-badge.js';
import '@vscode-elements/elements/dist/vscode-tree/vscode-tree.js';
import '@vscode-elements/elements/dist/vscode-tree-item/vscode-tree-item.js';
import type {
  ChangedFileDto,
  FilesWebviewToHost,
  HostToFilesWebview,
} from '../../src/protocol/filesMessages';
import { buildFileList } from '../../src/views/files/buildFileList';
import { buildFileTree, type FileTreeNode } from '../../src/views/files/buildFileTree';
import {
  createTreeDoubleSelectDetector,
  wireOpenButton,
  wireTreeFileDoubleClick,
  wireTreeSelection,
} from '../../src/views/files/treeInteraction';
import {
  layoutToggleIntent,
  rowDoubleClickIntent,
} from '../../src/views/files/filesWebviewIntents';
import {
  fileTooltip,
  formatAdditions,
  formatDeletions,
  isOpenDisabled,
  layoutButtonCaption,
  layoutButtonLabel,
  layoutIconKind,
} from '../../src/views/files/fileRowModel';
import type { FilesLayoutPreference } from '../../src/views/files/resolveFilesLayout';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const vscode = acquireVsCodeApi();
const SVG_NS = 'http://www.w3.org/2000/svg';

const badge = document.getElementById('count') as HTMLElement;
const layoutButton = document.getElementById('layout-btn') as HTMLButtonElement;
const messageEl = document.getElementById('message') as HTMLElement;
const contentEl = document.getElementById('content') as HTMLElement;

type LoadedState = {
  commitId: string;
  repoRoot: string;
  files: ChangedFileDto[];
  layoutPreference: FilesLayoutPreference;
  effectiveLayout: 'list' | 'tree';
};

let loaded: LoadedState | null = null;
let selectedPath: string | null = null;
let selectedCommitId: string | null = null;

function send(message: FilesWebviewToHost): void {
  vscode.postMessage(message);
}

function svgIcon(pathData: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  return svg;
}

// Codicon-style glyphs (list-flat / list-tree / go-to-file) as inline paths: no font needed.
const ICON_LIST = 'M2 3h12v1.5H2V3zm0 4.25h12v1.5H2v-1.5zM2 11.5h12V13H2v-1.5z';
const ICON_TREE =
  'M2 2.5h5V4H2V2.5zm2 4h6V8H4V6.5zm0 3.5h6v1.5H4V10zm-1-7v9h1V3H3zm5.5 8.5h5V13h-5v-1.5z';
/** Distinct from list/tree: list bars + spark mark so Auto is visible when effective layout is list. */
const ICON_AUTO =
  'M1.5 2.5h8V4h-8V2.5zm0 4h6v1.5h-6V6.5zm0 4h8V12h-8v-1.5zM12.2 1.8l.55 1.7h1.75l-1.4 1.05.55 1.7-1.45-1.05-1.45 1.05.55-1.7-1.4-1.05h1.75l.55-1.7z';
const ICON_OPEN =
  'M3 1.5h6.2L13 5.3V14.5H3v-13zm1 1v11h8V6H8.5V2.5H4zm5.5.7V5H11.3L9.5 3.2z';

const LAYOUT_ICONS: Record<FilesLayoutPreference, string> = {
  auto: ICON_AUTO,
  list: ICON_LIST,
  tree: ICON_TREE,
};

function setLayoutChrome(preference: FilesLayoutPreference): void {
  const kind = layoutIconKind(preference);
  const caption = document.createElement('span');
  caption.className = 'layout-caption';
  caption.textContent = layoutButtonCaption(preference);
  layoutButton.replaceChildren(svgIcon(LAYOUT_ICONS[kind]), caption);
}

function renderToolbar(state: LoadedState | null): void {
  layoutButton.disabled = state === null;
  if (state === null) {
    layoutButton.title = 'Change files layout';
    layoutButton.setAttribute('aria-label', 'Change files layout');
    layoutButton.replaceChildren();
    return;
  }
  const label = layoutButtonLabel(state.layoutPreference, state.effectiveLayout);
  layoutButton.title = label;
  layoutButton.setAttribute('aria-label', label);
  setLayoutChrome(state.layoutPreference);
}

function setBadge(count: number): void {
  badge.textContent = String(count);
  badge.hidden = false;
}

function showMessage(text: string, kind: 'empty' | 'error'): void {
  loaded = null;
  contentEl.replaceChildren();
  messageEl.textContent = text;
  messageEl.className = kind;
  messageEl.hidden = false;
  badge.textContent = '0';
  renderToolbar(null);
}

function span(className: string, text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = className;
  el.textContent = text;
  return el;
}

function createOpenButton(path: string, status: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'open-btn';
  button.dataset.action = 'open';
  button.dataset.path = path;
  const disabled = isOpenDisabled(status);
  button.disabled = disabled;
  const label = disabled ? 'Cannot open deleted file' : 'Open file';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.appendChild(svgIcon(ICON_OPEN));
  // Direct listener: vscode-tree-item stops click propagation, so delegation can't be used.
  wireOpenButton(button, (openPath) => send({ type: 'openWorkingFile', path: openPath }));
  return button;
}

function createStats(file: {
  status: string;
  additions: number;
  deletions: number;
}): HTMLSpanElement {
  const stats = document.createElement('span');
  stats.className = 'stats';
  stats.append(
    span('add', formatAdditions(file.additions)),
    span('del', formatDeletions(file.deletions)),
    span(`status status-${file.status}`, file.status),
  );
  return stats;
}

function tooltipFor(state: LoadedState, path: string, status: string): string {
  return fileTooltip(state.repoRoot, path, status);
}

function renderList(state: LoadedState): HTMLElement {
  const list = document.createElement('div');
  list.className = 'file-list';
  list.setAttribute('role', 'list');

  for (const row of buildFileList(state.files)) {
    const el = document.createElement('div');
    el.className = 'file-row';
    el.setAttribute('role', 'listitem');
    el.tabIndex = 0;
    el.dataset.path = row.path;
    el.dataset.status = row.status;
    el.title = tooltipFor(state, row.path, row.status);
    if (row.path === selectedPath) {
      el.classList.add('selected');
    }

    const label = document.createElement('span');
    label.className = 'label';
    label.append(span('name', row.name));
    if (row.directory !== '') {
      label.append(span('directory', row.directory));
    }

    el.append(label, createStats(row), createOpenButton(row.path, row.status));
    list.appendChild(el);
  }
  return list;
}

function fileStatusFor(state: LoadedState, path: string): string {
  return state.files.find((file) => file.path === path)?.status ?? '';
}

function renderTreeNode(state: LoadedState, node: FileTreeNode): HTMLElement {
  const item = document.createElement('vscode-tree-item');
  // Do NOT use data-path: vscode-tree-item overwrites it with its index path ("0.0").
  item.dataset.filePath = node.path;
  item.dataset.kind = node.kind;

  if (node.kind === 'dir') {
    item.setAttribute('branch', '');
    item.setAttribute('open', '');
    item.append(span('name dir-name', node.name));
    for (const child of node.children ?? []) {
      item.appendChild(renderTreeNode(state, child));
    }
    return item;
  }

  const status = node.status ?? fileStatusFor(state, node.path);
  item.dataset.status = status;
  item.title = tooltipFor(state, node.path, status);
  item.append(span('name', node.name));

  const decoration = createStats({
    status,
    additions: node.additions ?? 0,
    deletions: node.deletions ?? 0,
  });
  decoration.slot = 'decoration';
  item.appendChild(decoration);

  const actions = document.createElement('span');
  actions.slot = 'actions';
  actions.appendChild(createOpenButton(node.path, status));
  item.appendChild(actions);

  if (node.path === selectedPath) {
    item.setAttribute('selected', '');
  }
  // Direct dblclick: #content delegation is unreliable for vscode-tree-item.
  wireTreeFileDoubleClick(item, (diffPath) =>
    send({ type: 'openFileDiff', path: diffPath }),
  );
  return item;
}

function renderTree(state: LoadedState): HTMLElement {
  const tree = document.createElement('vscode-tree');
  tree.setAttribute('indent-guides', 'onHover');
  // Prefer double-select: native dblclick often never leaves vscode-tree-item shadow.
  const detectDoubleSelect = createTreeDoubleSelectDetector();
  wireTreeSelection(tree, (path) => {
    if (detectDoubleSelect(path) === 'openDiff') {
      send({ type: 'openFileDiff', path });
      return;
    }
    selectedPath = path;
    send({ type: 'fileSelected', path });
  });
  for (const node of buildFileTree(state.files, { compact: true })) {
    tree.appendChild(renderTreeNode(state, node));
  }
  return tree;
}

function renderLoaded(state: LoadedState): void {
  if (selectedCommitId !== state.commitId) {
    selectedCommitId = state.commitId;
    selectedPath = null;
  } else if (
    selectedPath !== null &&
    !state.files.some((file) => file.path === selectedPath)
  ) {
    selectedPath = null;
  }

  loaded = state;
  messageEl.hidden = true;
  messageEl.textContent = '';
  setBadge(state.files.length);
  renderToolbar(state);
  contentEl.replaceChildren(
    state.effectiveLayout === 'tree' ? renderTree(state) : renderList(state),
  );
}

function rowPath(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) {
    return undefined;
  }
  const row = target.closest<HTMLElement>('[data-path][data-status]');
  return row?.dataset.path;
}

function markListSelection(path: string): void {
  for (const row of contentEl.querySelectorAll<HTMLElement>('.file-row')) {
    row.classList.toggle('selected', row.dataset.path === path);
  }
}

// List layout selection only. Tree selection uses `vsc-tree-select` (see renderTree), and
// Open buttons have direct listeners (see createOpenButton).
contentEl.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const row = target.closest<HTMLElement>('.file-row');
  const path = row?.dataset.path;
  if (path !== undefined) {
    selectedPath = path;
    markListSelection(path);
    send({ type: 'fileSelected', path });
  }
});

contentEl.addEventListener('dblclick', (event) => {
  const onOpenButton =
    event.target instanceof Element &&
    event.target.closest('button[data-action="open"]') !== null;
  const intent = rowDoubleClickIntent(rowPath(event.target), onOpenButton);
  if (intent !== undefined) {
    send(intent);
  }
});

contentEl.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || !(event.target instanceof HTMLElement)) {
    return;
  }
  if (event.target.classList.contains('file-row')) {
    const path = event.target.dataset.path;
    if (path !== undefined) {
      send({ type: 'openFileDiff', path });
    }
  }
});

layoutButton.addEventListener('click', () => {
  const intent = layoutToggleIntent(loaded?.layoutPreference ?? null);
  if (intent !== undefined) {
    send(intent);
  }
});

window.addEventListener('message', (event: MessageEvent<HostToFilesWebview>) => {
  const message = event.data;
  switch (message?.type) {
    case 'filesLoaded':
      renderLoaded({
        commitId: message.commitId,
        repoRoot: message.repoRoot,
        files: message.files,
        layoutPreference: message.layoutPreference,
        effectiveLayout: message.effectiveLayout,
      });
      return;
    case 'filesEmpty':
      showMessage(message.message ?? 'No changed files', 'empty');
      return;
    case 'filesError':
      showMessage(message.message, 'error');
      return;
  }
});

renderToolbar(null);
send({ type: 'ready' });

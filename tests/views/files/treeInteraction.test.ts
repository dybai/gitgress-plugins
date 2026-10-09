import { describe, expect, it, vi } from 'vitest';
import {
  createTreeDoubleSelectDetector,
  selectedFilePathFromTreeDetail,
  wireOpenButton,
  wireTreeFileDoubleClick,
  wireTreeSelection,
} from '../../../src/views/files/treeInteraction';

type Handler = (event: any) => void;

/** Minimal bubbling node: button -> wrapper (stops propagation like vscode-tree-item) -> content. */
class FakeNode {
  private readonly listeners = new Map<string, Handler[]>();
  constructor(readonly parent?: FakeNode) {}
  addEventListener(type: string, handler: Handler): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), handler]);
  }
  dispatch(type: string, extra: object = {}): void {
    let stopped = false;
    const event = { type, ...extra, stopPropagation: () => (stopped = true) };
    for (let node: FakeNode | undefined = this; node && !stopped; node = node.parent) {
      for (const handler of node.listeners.get(type) ?? []) {
        handler(event);
      }
    }
  }
}

function fileItem(path: string, kind = 'file') {
  return { dataset: { filePath: path, kind } };
}

describe('selectedFilePathFromTreeDetail', () => {
  it('ignores vscode-tree-item index path on data-path', () => {
    expect(
      selectedFilePathFromTreeDetail([
        { dataset: { path: '0.0', kind: 'file', filePath: 'src/a.ts' } },
      ]),
    ).toBe('src/a.ts');
    expect(
      selectedFilePathFromTreeDetail([{ dataset: { path: '0.0', kind: 'file' } }]),
    ).toBeUndefined();
  });

  it('maps runtime array detail to the selected file path', () => {
    expect(selectedFilePathFromTreeDetail([fileItem('src/a.ts')])).toBe('src/a.ts');
  });

  it('accepts the typed { selectedItems } detail shape', () => {
    expect(selectedFilePathFromTreeDetail({ selectedItems: [fileItem('b.ts')] })).toBe('b.ts');
  });

  it('ignores directories and empty/invalid detail', () => {
    expect(selectedFilePathFromTreeDetail([fileItem('src', 'dir')])).toBeUndefined();
    expect(selectedFilePathFromTreeDetail([])).toBeUndefined();
    expect(selectedFilePathFromTreeDetail(null)).toBeUndefined();
    expect(selectedFilePathFromTreeDetail(undefined)).toBeUndefined();
  });

  it('skips directories and returns the first file', () => {
    expect(
      selectedFilePathFromTreeDetail([fileItem('src', 'dir'), fileItem('src/a.ts')]),
    ).toBe('src/a.ts');
  });
});

describe('wireTreeSelection', () => {
  it('calls onSelect for file selections only', () => {
    const tree = new FakeNode();
    const onSelect = vi.fn();
    wireTreeSelection(tree, onSelect);

    tree.dispatch('vsc-tree-select', { detail: [fileItem('a.ts')] });
    tree.dispatch('vsc-tree-select', { detail: [fileItem('src', 'dir')] });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('a.ts');
  });
});

describe('wireOpenButton with a propagation-stopping tree item', () => {
  function setup(disabled = false) {
    const content = new FakeNode();
    const delegated = vi.fn();
    content.addEventListener('click', delegated);
    // Mirrors vscode-tree-item's shadow wrapper click handler (calls stopPropagation).
    const wrapper = new FakeNode(content);
    wrapper.addEventListener('click', (e) => e.stopPropagation());
    const button = Object.assign(new FakeNode(wrapper), {
      disabled,
      dataset: { path: 'src/a.ts' },
    });
    return { button, delegated };
  }

  it('documents that delegated content listeners never see tree clicks', () => {
    const { button, delegated } = setup();
    button.dispatch('click');
    expect(delegated).not.toHaveBeenCalled();
  });

  it('direct handler still fires and stops propagation', () => {
    const { button } = setup();
    const onOpen = vi.fn();
    const outer = vi.fn();
    button.parent!.addEventListener('click', outer);
    wireOpenButton(button, onOpen);

    button.dispatch('click');

    expect(onOpen).toHaveBeenCalledWith('src/a.ts');
    expect(outer).not.toHaveBeenCalled();
  });

  it('does not open when the button is disabled', () => {
    const { button } = setup(true);
    const onOpen = vi.fn();
    wireOpenButton(button, onOpen);
    button.dispatch('click');
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('wireTreeFileDoubleClick', () => {
  function setupTreeItem() {
    const content = new FakeNode();
    const delegated = vi.fn();
    content.addEventListener('dblclick', delegated);
    const item = Object.assign(new FakeNode(content), {
      dataset: { filePath: 'src/a.ts', kind: 'file' },
    });
    return { item, content, delegated };
  }

  it('opens diff from a direct dblclick on a file item', () => {
    const { item } = setupTreeItem();
    const onDiff = vi.fn();
    wireTreeFileDoubleClick(item, onDiff);
    item.dispatch('dblclick', { target: item });
    expect(onDiff).toHaveBeenCalledWith('src/a.ts');
  });

  it('ignores directory items and open-button targets', () => {
    const dir = Object.assign(new FakeNode(), {
      dataset: { filePath: 'src', kind: 'dir' },
    });
    const onDiff = vi.fn();
    wireTreeFileDoubleClick(dir, onDiff);
    dir.dispatch('dblclick', { target: dir });
    expect(onDiff).not.toHaveBeenCalled();

    const { item } = setupTreeItem();
    wireTreeFileDoubleClick(item, onDiff);
    const openBtn = {
      closest(selector: string) {
        return selector === 'button[data-action="open"]' ? openBtn : null;
      },
    };
    item.dispatch('dblclick', { target: openBtn });
    expect(onDiff).not.toHaveBeenCalled();
  });
});

describe('createTreeDoubleSelectDetector', () => {
  it('opens diff on second select within the threshold', () => {
    let now = 0;
    const detect = createTreeDoubleSelectDetector(400, () => now);
    now = 1000;
    expect(detect('a.ts')).toBe('select');
    now = 1200;
    expect(detect('a.ts')).toBe('openDiff');
  });

  it('resets after openDiff and ignores slow or different paths', () => {
    let now = 0;
    const detect = createTreeDoubleSelectDetector(400, () => now);
    now = 1000;
    expect(detect('a.ts')).toBe('select');
    now = 1500;
    expect(detect('a.ts')).toBe('select');
    now = 1600;
    expect(detect('b.ts')).toBe('select');
    now = 1700;
    expect(detect('b.ts')).toBe('openDiff');
    now = 1800;
    expect(detect('b.ts')).toBe('select');
  });
});

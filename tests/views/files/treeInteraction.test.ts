import { describe, expect, it, vi } from 'vitest';
import {
  selectedFilePathFromTreeDetail,
  wireOpenButton,
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
  return { dataset: { path, kind } };
}

describe('selectedFilePathFromTreeDetail', () => {
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

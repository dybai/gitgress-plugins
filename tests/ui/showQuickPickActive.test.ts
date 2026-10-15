import { describe, expect, it } from 'vitest';
import type * as vscode from 'vscode';
import { createFakeCreateQuickPick } from '../helpers/fakeCreateQuickPick';
import { showQuickPickActive } from '../../src/ui/showQuickPickActive';

describe('showQuickPickActive', () => {
  it('assigns items, placeholder, and activeItems then shows', async () => {
    const { createQuickPick, quickPick, triggerHide } = createFakeCreateQuickPick();
    const items = [{ label: 'a' }, { label: 'b' }];

    const pending = showQuickPickActive({
      createQuickPick,
      items,
      placeHolder: 'Pick',
      activeItem: items[1],
    });

    expect(quickPick.items).toEqual(items);
    expect(quickPick.placeholder).toBe('Pick');
    expect(quickPick.activeItems).toEqual([items[1]]);
    expect(quickPick.show).toHaveBeenCalledOnce();

    triggerHide();
    await expect(pending).resolves.toBeUndefined();
  });

  it('omits activeItems override when activeItem is not provided', async () => {
    const { createQuickPick, quickPick, triggerHide } = createFakeCreateQuickPick();
    const items = [{ label: 'a' }];

    const pending = showQuickPickActive({
      createQuickPick,
      items,
      placeHolder: 'Pick',
    });

    expect(quickPick.activeItems).toEqual([]);
    triggerHide();
    await pending;
  });

  it('resolves the accepted item and disposes', async () => {
    const { createQuickPick, quickPick, triggerAccept } = createFakeCreateQuickPick();
    const items = [{ label: 'a' }, { label: 'b' }];
    quickPick.selectedItems = [items[0]];

    const pending = showQuickPickActive({
      createQuickPick,
      items,
      placeHolder: 'Pick',
      activeItem: items[0],
    });

    triggerAccept();
    await expect(pending).resolves.toBe(items[0]);
    expect(quickPick.dispose).toHaveBeenCalledOnce();
  });

  it('falls back to activeItems[0] when selectedItems is empty on accept', async () => {
    const { createQuickPick, quickPick, triggerAccept } = createFakeCreateQuickPick();
    const items = [{ label: 'a' }, { label: 'b' }];

    const pending = showQuickPickActive({
      createQuickPick,
      items,
      placeHolder: 'Pick',
      activeItem: items[1],
    });

    quickPick.selectedItems = [];
    quickPick.activeItems = [items[1]];
    triggerAccept();
    await expect(pending).resolves.toBe(items[1]);
  });

  it('resolves undefined on hide and disposes once even if hide follows accept', async () => {
    const { createQuickPick, quickPick, triggerAccept, triggerHide } =
      createFakeCreateQuickPick();
    const items = [{ label: 'a' }];
    quickPick.selectedItems = [items[0]];

    const pending = showQuickPickActive({
      createQuickPick,
      items,
      placeHolder: 'Pick',
    });

    triggerAccept();
    triggerHide();
    await expect(pending).resolves.toBe(items[0]);
    expect(quickPick.dispose).toHaveBeenCalledOnce();
  });
});

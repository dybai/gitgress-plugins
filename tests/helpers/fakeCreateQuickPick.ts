import { vi } from 'vitest';
import type * as vscode from 'vscode';

export type FakeQuickPick<T extends vscode.QuickPickItem> = {
  items: T[];
  placeholder: string | undefined;
  activeItems: T[];
  selectedItems: T[];
  show: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  onDidAccept: (listener: () => void) => { dispose: () => void };
  onDidHide: (listener: () => void) => { dispose: () => void };
};

export function createFakeCreateQuickPick<T extends vscode.QuickPickItem>() {
  const acceptListeners: Array<() => void> = [];
  const hideListeners: Array<() => void> = [];

  const quickPick: FakeQuickPick<T> = {
    items: [],
    placeholder: undefined,
    activeItems: [],
    selectedItems: [],
    show: vi.fn(),
    dispose: vi.fn(),
    onDidAccept: (listener) => {
      acceptListeners.push(listener);
      return { dispose: () => undefined };
    },
    onDidHide: (listener) => {
      hideListeners.push(listener);
      return { dispose: () => undefined };
    },
  };

  const createQuickPick = vi.fn(() => quickPick) as unknown as typeof vscode.window.createQuickPick;

  return {
    createQuickPick,
    quickPick,
    triggerAccept: () => {
      for (const listener of acceptListeners) listener();
    },
    triggerHide: () => {
      for (const listener of hideListeners) listener();
    },
  };
}

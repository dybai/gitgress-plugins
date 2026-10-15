import type * as vscode from 'vscode';

export async function showQuickPickActive<T extends vscode.QuickPickItem>(options: {
  createQuickPick: typeof vscode.window.createQuickPick;
  items: readonly T[];
  placeHolder: string;
  activeItem?: T;
}): Promise<T | undefined> {
  const { createQuickPick, items, placeHolder, activeItem } = options;
  const pick = createQuickPick<T>();
  pick.items = [...items];
  pick.placeholder = placeHolder;
  if (activeItem !== undefined) {
    pick.activeItems = [activeItem];
  }

  return await new Promise<T | undefined>((resolve) => {
    let settled = false;
    const finish = (value: T | undefined) => {
      if (settled) {
        return;
      }
      settled = true;
      pick.dispose();
      resolve(value);
    };

    pick.onDidAccept(() => {
      finish(pick.selectedItems[0] ?? pick.activeItems[0]);
    });
    pick.onDidHide(() => {
      finish(undefined);
    });
    pick.show();
  });
}

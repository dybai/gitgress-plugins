import type { FilesWebviewToHost } from '../../protocol/filesMessages';
import { cycleFilesLayout } from './cycleFilesLayout';
import type { FilesLayoutPreference } from './resolveFilesLayout';

/** Layout toolbar click: next preference, or nothing when no files are loaded. */
export function layoutToggleIntent(
  preference: FilesLayoutPreference | null,
): FilesWebviewToHost | undefined {
  if (preference === null) {
    return undefined;
  }
  return { type: 'setLayout', layout: cycleFilesLayout(preference) };
}

/** Double-click on a file row opens the diff, unless it landed on the Open button. */
export function rowDoubleClickIntent(
  path: string | undefined,
  onOpenButton: boolean,
): FilesWebviewToHost | undefined {
  if (onOpenButton || path === undefined) {
    return undefined;
  }
  return { type: 'openFileDiff', path };
}

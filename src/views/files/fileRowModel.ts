import { cycleFilesLayout } from './cycleFilesLayout';
import { fileStatusLabel } from './fileStatusLabel';
import type { FilesLayoutPreference } from './resolveFilesLayout';

/** Display-only absolute path (forward slashes) + status label on a second line. */
export function fileTooltip(
  repoRoot: string,
  relativePath: string,
  status: string,
): string {
  const full = `${repoRoot.replace(/[\\/]+$/, '')}/${relativePath}`.replace(/\\/g, '/');
  return `${full}\n${fileStatusLabel(status)}`;
}

/** Mirrors host rule (`shouldAllowOpenWorkingFile`) without pulling node:path into the webview. */
export function isOpenDisabled(status: string): boolean {
  return status === 'D';
}

export function formatAdditions(count: number): string {
  return `+${count}`;
}

export function formatDeletions(count: number): string {
  return `\u2212${count}`;
}

const PREFERENCE_NAMES: Record<FilesLayoutPreference, string> = {
  auto: 'Auto',
  list: 'List',
  tree: 'Tree',
};

export function layoutButtonLabel(
  preference: FilesLayoutPreference,
  effective: 'list' | 'tree',
): string {
  const current =
    preference === 'auto'
      ? `${PREFERENCE_NAMES.auto} (showing ${effective})`
      : PREFERENCE_NAMES[preference];
  const next = cycleFilesLayout(preference);
  return `Layout: ${current}. Click for ${next}.`;
}

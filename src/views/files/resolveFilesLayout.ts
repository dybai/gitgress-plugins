export type FilesLayoutPreference = 'list' | 'tree' | 'auto';
export type FilesEffectiveLayout = 'list' | 'tree';
export const FILES_LAYOUT_AUTO_THRESHOLD = 5;

/** Normalizes an untrusted stored value (e.g. workspaceState); anything invalid becomes 'auto'. */
export function normalizeFilesLayoutPreference(value: unknown): FilesLayoutPreference {
  return value === 'list' || value === 'tree' || value === 'auto' ? value : 'auto';
}

export function resolveFilesLayout(
  preference: FilesLayoutPreference,
  fileCount: number,
  threshold: number = FILES_LAYOUT_AUTO_THRESHOLD,
): FilesEffectiveLayout {
  if (preference === 'list' || preference === 'tree') {
    return preference;
  }
  return fileCount <= threshold ? 'list' : 'tree';
}

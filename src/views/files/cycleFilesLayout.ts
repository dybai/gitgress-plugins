import type { FilesLayoutPreference } from './resolveFilesLayout';

export function cycleFilesLayout(
  preference: FilesLayoutPreference,
): FilesLayoutPreference {
  switch (preference) {
    case 'auto':
      return 'list';
    case 'list':
      return 'tree';
    case 'tree':
      return 'auto';
  }
}

export type ConflictMode = 'ask' | 'alwaysShow' | 'defer';

export type KnownBlameExtension = {
  id: string;
  section: string;
  setting: string;
  displayName: string;
};

/**
 * Extensions known to draw their own current-line blame annotation. VS Code
 * exposes no API to observe other extensions' decorations, so detection
 * walks this list; add future blame extensions as new entries.
 */
export const KNOWN_BLAME_EXTENSIONS: KnownBlameExtension[] = [
  {
    id: 'eamodio.gitlens',
    section: 'gitlens',
    setting: 'currentLine.enabled',
    displayName: 'GitLens',
  },
];

type ExtensionLike = { isActive?: boolean } | undefined;
type ConfigSection = { get: (key: string) => unknown };

export function detectConflictingAnnotation(
  getExtension: (id: string) => ExtensionLike,
  getConfiguration: (section: string) => ConfigSection,
): KnownBlameExtension | null {
  for (const entry of KNOWN_BLAME_EXTENSIONS) {
    const ext = getExtension(entry.id);
    if (!ext) {
      continue;
    }
    if (getConfiguration(entry.section).get(entry.setting) === true) {
      return entry;
    }
  }
  return null;
}

export function shouldRenderBlame(
  enabled: boolean,
  mode: ConflictMode,
  conflict: boolean,
): boolean {
  if (!enabled) {
    return false;
  }
  if (conflict && mode === 'defer') {
    return false;
  }
  return true;
}

export function conflictModeForChoice(
  choice: 'showBoth' | 'hideGitGress',
): ConflictMode {
  return choice === 'hideGitGress' ? 'defer' : 'alwaysShow';
}

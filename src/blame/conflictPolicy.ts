export type ConflictMode = 'ask' | 'alwaysShow' | 'defer';

type ExtensionLike = { isActive?: boolean } | undefined;
type ConfigSection = { get: (key: string) => unknown };

export function isGitLensCurrentLineBlameOn(
  getExtension: (id: string) => ExtensionLike,
  getConfiguration: (section: string) => ConfigSection,
): boolean {
  const ext = getExtension('eamodio.gitlens');
  if (!ext) {
    return false;
  }
  return getConfiguration('gitlens').get('currentLine.enabled') === true;
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
  choice: 'keepGitLens' | 'keepGitGress' | 'showBoth',
): ConflictMode {
  if (choice === 'keepGitLens') {
    return 'defer';
  }
  return 'alwaysShow';
}

import { describe, expect, it } from 'vitest';
import {
  conflictModeForChoice,
  isGitLensCurrentLineBlameOn,
  shouldRenderBlame,
} from '../../src/blame/conflictPolicy';

describe('conflictPolicy', () => {
  it('detects GitLens current-line blame', () => {
    expect(
      isGitLensCurrentLineBlameOn(
        (id) => (id === 'eamodio.gitlens' ? { isActive: true } : undefined),
        (section) =>
          section === 'gitlens'
            ? { get: (key: string) => (key === 'currentLine.enabled' ? true : undefined) }
            : { get: () => undefined },
      ),
    ).toBe(true);
  });

  it('is false when GitLens is missing', () => {
    expect(
      isGitLensCurrentLineBlameOn(
        () => undefined,
        () => ({ get: () => true }),
      ),
    ).toBe(false);
  });

  it('defers when conflictMode is defer and conflict exists', () => {
    expect(shouldRenderBlame(true, 'defer', true)).toBe(false);
    expect(shouldRenderBlame(true, 'alwaysShow', true)).toBe(true);
    expect(shouldRenderBlame(true, 'ask', true)).toBe(true);
    expect(shouldRenderBlame(false, 'alwaysShow', false)).toBe(false);
  });

  it('maps choices to modes', () => {
    expect(conflictModeForChoice('keepGitLens')).toBe('defer');
    expect(conflictModeForChoice('keepGitGress')).toBe('alwaysShow');
    expect(conflictModeForChoice('showBoth')).toBe('alwaysShow');
  });
});

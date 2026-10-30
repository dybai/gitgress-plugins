import { describe, expect, it } from 'vitest';
import {
  KNOWN_BLAME_EXTENSIONS,
  conflictModeForChoice,
  detectConflictingAnnotation,
  shouldRenderBlame,
} from '../../src/blame/conflictPolicy';

const GITLENS = KNOWN_BLAME_EXTENSIONS[0];

describe('detectConflictingAnnotation', () => {
  it('detects GitLens current-line blame from the known list', () => {
    expect(
      detectConflictingAnnotation(
        (id) => (id === GITLENS.id ? { isActive: true } : undefined),
        (section) =>
          section === GITLENS.section
            ? { get: (key: string) => (key === GITLENS.setting ? true : undefined) }
            : { get: () => undefined },
      ),
    ).toEqual(GITLENS);
  });

  it('returns null when the extension is missing', () => {
    expect(
      detectConflictingAnnotation(
        () => undefined,
        () => ({ get: () => true }),
      ),
    ).toBeNull();
  });

  it('returns null when the setting is off', () => {
    expect(
      detectConflictingAnnotation(
        (id) => (id === GITLENS.id ? { isActive: true } : undefined),
        (section) =>
          section === GITLENS.section
            ? { get: (key: string) => (key === GITLENS.setting ? false : undefined) }
            : { get: () => undefined },
      ),
    ).toBeNull();
  });

  it('lists GitLens with its current-line setting', () => {
    expect(GITLENS).toEqual({
      id: 'eamodio.gitlens',
      section: 'gitlens',
      setting: 'currentLine.enabled',
      displayName: 'GitLens',
    });
  });
});

describe('conflictModeForChoice', () => {
  it('maps the two choices', () => {
    expect(conflictModeForChoice('showBoth')).toBe('alwaysShow');
    expect(conflictModeForChoice('hideGitGress')).toBe('defer');
  });
});

describe('shouldRenderBlame', () => {
  it('keeps the original truth table', () => {
    expect(shouldRenderBlame(false, 'alwaysShow', false)).toBe(false);
    expect(shouldRenderBlame(true, 'defer', true)).toBe(false);
    expect(shouldRenderBlame(true, 'alwaysShow', true)).toBe(true);
    expect(shouldRenderBlame(true, 'ask', true)).toBe(true);
    expect(shouldRenderBlame(false, 'alwaysShow', true)).toBe(false);
  });
});

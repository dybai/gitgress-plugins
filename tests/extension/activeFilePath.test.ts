import { describe, expect, it } from 'vitest';
import { pickActiveFilePath } from '../../src/extension/activeFilePath.js';

describe('pickActiveFilePath', () => {
  it('prefers the active text editor when it is a file', () => {
    expect(
      pickActiveFilePath({
        activeEditorUri: { scheme: 'file', fsPath: 'D:\\ws\\a\\open.ts' },
        visibleEditorUris: [{ scheme: 'file', fsPath: 'D:\\ws\\b\\other.ts' }],
        tabUris: [{ scheme: 'file', fsPath: 'D:\\ws\\c\\tab.ts' }],
      }),
    ).toBe('D:\\ws\\a\\open.ts');
  });

  it('falls back to a visible file editor when active editor is missing (webview focus)', () => {
    expect(
      pickActiveFilePath({
        activeEditorUri: null,
        visibleEditorUris: [
          { scheme: 'output', fsPath: '' },
          { scheme: 'file', fsPath: 'D:\\ws\\fintech-service\\.superpowers\\specs\\design.md' },
        ],
        tabUris: [],
      }),
    ).toBe('D:\\ws\\fintech-service\\.superpowers\\specs\\design.md');
  });

  it('falls back to an open file tab when no text editor is active or visible', () => {
    expect(
      pickActiveFilePath({
        activeEditorUri: undefined,
        visibleEditorUris: [],
        tabUris: [
          { scheme: 'gitgress', fsPath: '' },
          { scheme: 'file', fsPath: 'D:\\ws\\repo\\README.md' },
        ],
      }),
    ).toBe('D:\\ws\\repo\\README.md');
  });

  it('returns null when no file-scheme document is available', () => {
    expect(
      pickActiveFilePath({
        activeEditorUri: { scheme: 'untitled', fsPath: 'Untitled-1' },
        visibleEditorUris: [{ scheme: 'output', fsPath: 'ext' }],
        tabUris: [],
      }),
    ).toBeNull();
  });
});

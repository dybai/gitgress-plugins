import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  matchFileIcon,
  matchFolderIcon,
} from '../../../src/views/files/matchFileIconTheme';
import type { FileIconThemeDocument } from '../../../src/views/files/fileIconThemeTypes';

const theme = JSON.parse(
  readFileSync(join(__dirname, '../../fixtures/file-icon-theme-mini.json'), 'utf8'),
) as FileIconThemeDocument;

describe('matchFileIcon', () => {
  it('prefers longest fileExtensions suffix (test.ts over ts)', () => {
    expect(matchFileIcon(theme, 'src/SelectionCoordinator.test.ts')).toEqual({
      kind: 'font',
      fontId: 'seti',
      character: '\uE099',
      color: '#cc6d2e',
    });
  });

  it('matches simple extension', () => {
    expect(matchFileIcon(theme, 'src/SelectionCoordinator.ts')).toMatchObject({
      kind: 'font',
      fontId: 'seti',
      color: '#519aba',
    });
  });

  it('matches fileNames then iconPath', () => {
    expect(matchFileIcon(theme, 'docs/README.md')).toEqual({
      kind: 'path',
      relativePath: './icons/file.svg',
    });
  });

  it('falls back to default file icon', () => {
    expect(matchFileIcon(theme, 'weird.unknownext')).toMatchObject({
      kind: 'font',
      character: '\uE023',
    });
  });
});

describe('matchFolderIcon', () => {
  it('returns closed and open folder paths', () => {
    expect(matchFolderIcon(theme, false)).toEqual({
      kind: 'path',
      relativePath: './icons/folder.svg',
    });
    expect(matchFolderIcon(theme, true)).toEqual({
      kind: 'path',
      relativePath: './icons/folder-open.svg',
    });
  });
});

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

  it('light mode falls back default file to top-level when light.file missing', () => {
    const lightTheme: FileIconThemeDocument = {
      iconDefinitions: {
        defaultFile: { fontCharacter: '\uE001' },
        lightOnly: { fontCharacter: '\uE002' },
      },
      file: 'defaultFile',
      light: {},
    };
    expect(
      matchFileIcon(lightTheme, 'unknown.xyz', { light: true }),
    ).toMatchObject({ kind: 'font', character: '\uE001' });
  });

  it('light mode uses light.fileNames and fileExtensions with top-level fallback', () => {
    const lightTheme: FileIconThemeDocument = {
      iconDefinitions: {
        byNameDark: { fontCharacter: '\uE010' },
        byNameLight: { fontCharacter: '\uE011' },
        extDark: { fontCharacter: '\uE020' },
        extLight: { fontCharacter: '\uE021' },
        onlyDarkName: { fontCharacter: '\uE030' },
        onlyDarkExt: { fontCharacter: '\uE031' },
      },
      fileNames: {
        'package.json': 'byNameDark',
        'only-in-dark': 'onlyDarkName',
      },
      fileExtensions: {
        ts: 'extDark',
        darkonly: 'onlyDarkExt',
      },
      light: {
        fileNames: { 'package.json': 'byNameLight' },
        fileExtensions: { ts: 'extLight' },
      },
    };
    expect(
      matchFileIcon(lightTheme, 'package.json', { light: true }),
    ).toMatchObject({ character: '\uE011' });
    expect(matchFileIcon(lightTheme, 'app.ts', { light: true })).toMatchObject(
      { character: '\uE021' },
    );
    expect(
      matchFileIcon(lightTheme, 'only-in-dark', { light: true }),
    ).toMatchObject({ character: '\uE030' });
    expect(
      matchFileIcon(lightTheme, 'x.darkonly', { light: true }),
    ).toMatchObject({ character: '\uE031' });
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

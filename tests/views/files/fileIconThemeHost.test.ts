import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  findIconThemeContribution,
  loadThemeDocument,
  resolveIconsForFiles,
} from '../../../src/views/files/fileIconThemeHost';

const fixtureJson = join(__dirname, '../../fixtures/file-icon-theme-mini.json');
const fixtureDir = join(__dirname, '../../fixtures');

describe('findIconThemeContribution', () => {
  const extensions = [
    {
      extensionPath: '/ext/custom-icons',
      packageJSON: {
        contributes: {
          iconThemes: [{ id: 'my-theme', path: './themes/file-icons.json' }],
        },
      },
    },
    {
      extensionPath: '/ext/theme-seti',
      packageJSON: {
        contributes: {
          iconThemes: [
            { id: 'vscode.theme-seti', path: './icons/vs-seti-icon-theme.json' },
          ],
        },
      },
    },
  ] as const;

  it('finds extension contribution by exact id', () => {
    expect(
      findIconThemeContribution('my-theme', extensions, []),
    ).toEqual({
      jsonFsPath: join('/ext/custom-icons', './themes/file-icons.json'),
      extensionRootFsPath: '/ext/custom-icons',
    });
  });

  it('matches vs-seti setting to vscode.theme-seti contribution', () => {
    expect(findIconThemeContribution('vs-seti', extensions, [])).toEqual({
      jsonFsPath: join('/ext/theme-seti', './icons/vs-seti-icon-theme.json'),
      extensionRootFsPath: '/ext/theme-seti',
    });
  });

  it('falls back to built-in Seti candidate when extension missing', () => {
    const builtIn = ['/vscode/extensions/theme-seti/icons/vs-seti-icon-theme.json'];
    expect(
      findIconThemeContribution('vs-seti', [extensions[0]], builtIn),
    ).toEqual({
      jsonFsPath: builtIn[0],
      extensionRootFsPath: '/vscode/extensions/theme-seti',
    });
  });

  it('returns undefined for unknown theme id', () => {
    expect(findIconThemeContribution('unknown', extensions, [])).toBeUndefined();
    expect(findIconThemeContribution(undefined, extensions, [])).toBeUndefined();
  });
});

describe('loadThemeDocument', () => {
  it('loads fixture and keeps single-code-unit font characters', () => {
    const doc = loadThemeDocument(fixtureJson, (p) =>
      readFileSync(p, 'utf8'),
    );
    expect(doc.iconDefinitions._ts).toMatchObject({
      fontCharacter: '\uE099',
      fontColor: '#519aba',
    });
  });

  it('normalizes Seti-style \\E099 escape strings after JSON.parse', () => {
    const raw = JSON.stringify({
      iconDefinitions: {
        _x: { fontCharacter: '\\E099' },
      },
    });
    const doc = loadThemeDocument('/fake.json', () => raw);
    expect(doc.iconDefinitions._x).toEqual({ fontCharacter: '\uE099' });
  });
});

describe('resolveIconsForFiles', () => {
  const theme = loadThemeDocument(fixtureJson, (p) =>
    readFileSync(p, 'utf8'),
  );

  it('resolves theme paths, fonts, and folders for webview', () => {
    const payload = resolveIconsForFiles({
      theme,
      themeDirFsPath: fixtureDir,
      paths: ['src/a.ts', 'docs/README.md', 'weird.unknownext'],
      light: false,
      toWebviewUri: (fsPath) => `w:${fsPath}`,
    });

    expect(payload.files['src/a.ts']).toEqual({
      kind: 'font',
      fontId: 'seti',
      character: '\uE099',
      color: '#519aba',
    });
    expect(payload.files['docs/README.md']).toEqual({
      kind: 'theme',
      uri: `w:${join(fixtureDir, 'icons/file.svg')}`,
    });
    expect(payload.fonts).toEqual([
      { id: 'seti', uri: `w:${join(fixtureDir, 'seti.woff')}` },
    ]);
    expect(payload.folder).toEqual({
      kind: 'theme',
      uri: `w:${join(fixtureDir, 'icons/folder.svg')}`,
    });
    expect(payload.folderOpen).toEqual({
      kind: 'theme',
      uri: `w:${join(fixtureDir, 'icons/folder-open.svg')}`,
    });
  });

  it('uses codicon defaults when match is none', () => {
    const emptyTheme = loadThemeDocument('/empty.json', () =>
      JSON.stringify({ iconDefinitions: {} }),
    );
    const payload = resolveIconsForFiles({
      theme: emptyTheme,
      themeDirFsPath: fixtureDir,
      paths: ['orphan.txt'],
      light: false,
      toWebviewUri: (p) => p,
    });
    expect(payload.files['orphan.txt']).toEqual({ kind: 'codicon', id: 'file' });
    expect(payload.folder).toEqual({ kind: 'codicon', id: 'folder' });
    expect(payload.folderOpen).toEqual({ kind: 'codicon', id: 'folder-opened' });
  });
});

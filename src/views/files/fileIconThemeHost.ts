import { dirname, join } from 'node:path';
import { buildFilesIconPayload } from './buildFilesIconPayload';
import type { ResolvedFileIcon } from './buildFilesIconPayload';
import {
  matchFileIcon,
  matchFolderIcon,
} from './matchFileIconTheme';
import type {
  FileIconThemeDocument,
  MatchedIcon,
  ThemeIconDefinition,
} from './fileIconThemeTypes';
import type { FilesIconsPayload } from '../../protocol/filesMessages';

export type ThemeLocation = {
  themeDirFsPath: string;
  document: FileIconThemeDocument;
  extensionRootFsPath: string;
};

const SETI_THEME_IDS = new Set(['vs-seti', 'vscode.theme-seti']);

function contributionIdsForSetting(iconThemeId: string): readonly string[] {
  if (SETI_THEME_IDS.has(iconThemeId)) {
    return ['vs-seti', 'vscode.theme-seti'];
  }
  return [iconThemeId];
}

function extensionRootForBuiltInJson(jsonFsPath: string): string {
  const themeDir = dirname(jsonFsPath);
  const base = basenameOnly(themeDir);
  if (base === 'icons') {
    return dirname(themeDir);
  }
  return themeDir;
}

function basenameOnly(fsPath: string): string {
  const normalized = fsPath.replace(/\\/g, '/');
  const i = normalized.lastIndexOf('/');
  return i === -1 ? normalized : normalized.slice(i + 1);
}

export function findIconThemeContribution(
  iconThemeId: string | undefined,
  extensions: ReadonlyArray<{
    extensionPath: string;
    packageJSON: {
      contributes?: { iconThemes?: Array<{ id: string; path: string }> };
    };
  }>,
  builtInCandidates: readonly string[],
): { jsonFsPath: string; extensionRootFsPath: string } | undefined {
  if (iconThemeId === undefined) {
    return undefined;
  }

  const matchIds = new Set(contributionIdsForSetting(iconThemeId));

  for (const ext of extensions) {
    for (const theme of ext.packageJSON.contributes?.iconThemes ?? []) {
      if (matchIds.has(theme.id)) {
        return {
          jsonFsPath: join(ext.extensionPath, theme.path),
          extensionRootFsPath: ext.extensionPath,
        };
      }
    }
  }

  if (SETI_THEME_IDS.has(iconThemeId) && builtInCandidates.length > 0) {
    const jsonFsPath = builtInCandidates[0];
    return {
      jsonFsPath,
      extensionRootFsPath: extensionRootForBuiltInJson(jsonFsPath),
    };
  }

  return undefined;
}

export function normalizeFontCharacter(fontCharacter: string): string {
  if (fontCharacter.length === 1) {
    return fontCharacter;
  }
  const m = fontCharacter.match(/^\\([eE][0-9A-Fa-f]+)$/);
  if (m) {
    return String.fromCharCode(parseInt(m[1], 16));
  }
  return fontCharacter;
}

function normalizeDefinition(def: ThemeIconDefinition): ThemeIconDefinition {
  if (!('fontCharacter' in def) || def.fontCharacter === undefined) {
    return def;
  }
  return {
    ...def,
    fontCharacter: normalizeFontCharacter(def.fontCharacter),
  };
}

export function loadThemeDocument(
  jsonFsPath: string,
  readText: (fsPath: string) => string,
): FileIconThemeDocument {
  const raw = JSON.parse(readText(jsonFsPath)) as FileIconThemeDocument;
  const iconDefinitions: Record<string, ThemeIconDefinition> = {};
  for (const [id, def] of Object.entries(raw.iconDefinitions ?? {})) {
    iconDefinitions[id] = normalizeDefinition(def);
  }
  return { ...raw, iconDefinitions };
}

function joinThemePath(themeDirFsPath: string, relativePath: string): string {
  const cleaned = relativePath.replace(/^\.\//, '').replace(/\\/g, '/');
  return join(themeDirFsPath, cleaned);
}

function fontFsPathForTheme(
  theme: FileIconThemeDocument,
  themeDirFsPath: string,
  fontId: string,
): string | undefined {
  const fonts = theme.fonts;
  if (!fonts?.length) {
    return undefined;
  }
  const fontDef =
    fonts.find((f) => f.id === fontId) ?? fonts[0];
  const rel = fontDef.src[0]?.path;
  if (!rel) {
    return undefined;
  }
  return joinThemePath(themeDirFsPath, rel);
}

function matchedToResolved(
  matched: MatchedIcon,
  theme: FileIconThemeDocument,
  themeDirFsPath: string,
  codiconId: string,
): ResolvedFileIcon {
  try {
    if (matched.kind === 'none') {
      return { kind: 'codicon', id: codiconId };
    }
    if (matched.kind === 'path') {
      return {
        kind: 'theme',
        fsPath: joinThemePath(themeDirFsPath, matched.relativePath),
      };
    }
    const fontFsPath = fontFsPathForTheme(
      theme,
      themeDirFsPath,
      matched.fontId,
    );
    if (!fontFsPath) {
      return { kind: 'codicon', id: codiconId };
    }
    return {
      kind: 'font',
      fontId: matched.fontId,
      character: matched.character,
      ...(matched.color !== undefined ? { color: matched.color } : {}),
      fontFsPath,
    };
  } catch {
    return { kind: 'codicon', id: codiconId };
  }
}

export function resolveIconsForFiles(args: {
  theme: FileIconThemeDocument;
  themeDirFsPath: string;
  paths: readonly string[];
  light: boolean;
  languageIdByExtension?: Readonly<Record<string, string>>;
  toWebviewUri: (fsPath: string) => string;
}): FilesIconsPayload {
  const {
    theme,
    themeDirFsPath,
    paths,
    light,
    languageIdByExtension,
    toWebviewUri,
  } = args;
  const matchOpts = { light, languageIdByExtension };

  return buildFilesIconPayload({
    paths,
    toWebviewUri,
    resolvePath: (relativePath) =>
      matchedToResolved(
        matchFileIcon(theme, relativePath, matchOpts),
        theme,
        themeDirFsPath,
        'file',
      ),
    resolveFolder: (expanded) =>
      matchedToResolved(
        matchFolderIcon(theme, expanded, { light }),
        theme,
        themeDirFsPath,
        expanded ? 'folder-opened' : 'folder',
      ),
  });
}

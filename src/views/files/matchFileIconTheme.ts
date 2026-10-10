import type {
  FileIconThemeDocument,
  MatchedIcon,
  ThemeIconDefinition,
} from './fileIconThemeTypes';

function basename(normalizedPath: string): string {
  const i = normalizedPath.lastIndexOf('/');
  return i === -1 ? normalizedPath : normalizedPath.slice(i + 1);
}

export type MatchFileIconOptions = {
  light?: boolean;
  /**
   * File extension (no leading dot; may be compound e.g. `test.ts`) →
   * VS Code language id. Used when the theme maps icons via `languageIds`
   * (Seti does this for `.java`, `.yaml`, `.ts`, …).
   */
  languageIdByExtension?: Readonly<Record<string, string>>;
};

/** Longest theme / language-map key that equals basename or is a suffix `.key`. */
function longestSuffixKey(
  name: string,
  keys: Iterable<string>,
): string | undefined {
  let bestKey: string | undefined;
  for (const key of keys) {
    const matches = name === key || name.endsWith(`.${key}`);
    if (matches && (!bestKey || key.length > bestKey.length)) {
      bestKey = key;
    }
  }
  return bestKey;
}

function languageIdForBasename(
  name: string,
  languageIdByExtension: Readonly<Record<string, string>> | undefined,
): string | undefined {
  if (!languageIdByExtension) {
    return undefined;
  }
  const key = longestSuffixKey(name, Object.keys(languageIdByExtension));
  return key === undefined ? undefined : languageIdByExtension[key];
}

function resolveDefinitionIdForFile(
  theme: FileIconThemeDocument,
  relativePath: string,
  opts?: MatchFileIconOptions,
): string | undefined {
  const light = opts?.light;
  const name = basename(relativePath.replace(/\\/g, '/'));
  const lightFileNames = light ? theme.light?.fileNames : undefined;
  const topFileNames = theme.fileNames;
  const lightFileExtensions = light ? theme.light?.fileExtensions : undefined;
  const topFileExtensions = theme.fileExtensions;
  const lightLanguageIds = light ? theme.light?.languageIds : undefined;
  const topLanguageIds = theme.languageIds;

  if (lightFileNames || topFileNames) {
    const byName =
      lightFileNames?.[name] ??
      lightFileNames?.[name.toLowerCase()] ??
      topFileNames?.[name] ??
      topFileNames?.[name.toLowerCase()];
    if (byName) {
      return byName;
    }
  }

  if (lightFileExtensions || topFileExtensions) {
    const bestKey = longestSuffixKey(
      name,
      new Set([
        ...Object.keys(lightFileExtensions ?? {}),
        ...Object.keys(topFileExtensions ?? {}),
      ]),
    );
    if (bestKey) {
      return (
        lightFileExtensions?.[bestKey] ?? topFileExtensions?.[bestKey]
      );
    }
  }

  const languageId = languageIdForBasename(name, opts?.languageIdByExtension);
  if (languageId && (lightLanguageIds || topLanguageIds)) {
    const byLang =
      lightLanguageIds?.[languageId] ?? topLanguageIds?.[languageId];
    if (byLang) {
      return byLang;
    }
  }

  return light ? (theme.light?.file ?? theme.file) : theme.file;
}

function definitionToMatched(
  theme: FileIconThemeDocument,
  def: ThemeIconDefinition | undefined,
): MatchedIcon {
  if (!def) {
    return { kind: 'none' };
  }
  if ('iconPath' in def && def.iconPath !== undefined) {
    return { kind: 'path', relativePath: def.iconPath };
  }
  if ('fontCharacter' in def && def.fontCharacter !== undefined) {
    const fontId =
      def.fontId ?? theme.fonts?.[0]?.id ?? 'default';
    const result: MatchedIcon = {
      kind: 'font',
      fontId,
      character: def.fontCharacter,
    };
    if (def.fontColor !== undefined) {
      return { ...result, color: def.fontColor };
    }
    return result;
  }
  return { kind: 'none' };
}

function resolveIconById(
  theme: FileIconThemeDocument,
  id: string | undefined,
): MatchedIcon {
  if (!id) {
    return { kind: 'none' };
  }
  return definitionToMatched(theme, theme.iconDefinitions[id]);
}

export function matchFileIcon(
  theme: FileIconThemeDocument,
  relativePath: string,
  opts?: MatchFileIconOptions,
): MatchedIcon {
  const id = resolveDefinitionIdForFile(theme, relativePath, opts);
  return resolveIconById(theme, id);
}

export function matchFolderIcon(
  theme: FileIconThemeDocument,
  expanded: boolean,
  opts?: { light?: boolean },
): MatchedIcon {
  const light = opts?.light;
  let id: string | undefined;
  if (expanded) {
    id = light
      ? (theme.light?.folderExpanded ?? theme.folderExpanded)
      : theme.folderExpanded;
  } else {
    id = light ? (theme.light?.folder ?? theme.folder) : theme.folder;
  }
  return resolveIconById(theme, id);
}

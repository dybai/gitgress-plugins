/**
 * Build extension → languageId from VS Code `contributes.languages` entries.
 * Keys omit the leading dot (`.java` → `java`). First claim wins.
 */
export function buildLanguageIdByExtension(
  extensions: ReadonlyArray<{
    packageJSON: {
      contributes?: {
        languages?: Array<{
          id?: string;
          extensions?: string[];
        }>;
      };
    };
  }>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const ext of extensions) {
    for (const lang of ext.packageJSON.contributes?.languages ?? []) {
      const id = lang.id;
      if (!id) {
        continue;
      }
      for (const raw of lang.extensions ?? []) {
        const key = raw.startsWith('.') ? raw.slice(1) : raw;
        if (key.length > 0 && map[key] === undefined) {
          map[key] = id;
        }
      }
    }
  }
  return map;
}

import type { FileIconRef, FilesIconsPayload } from '../../protocol/filesMessages';

export type ResolvedFileIcon =
  | { kind: 'theme'; fsPath: string }
  | {
      kind: 'font';
      fontId: string;
      character: string;
      color?: string;
      fontFsPath: string;
    }
  | { kind: 'codicon'; id: string };

function toFileIconRef(
  resolved: ResolvedFileIcon,
  toWebviewUri: (fsPath: string) => string,
  fontsById: Map<string, { id: string; uri: string }>,
): FileIconRef {
  switch (resolved.kind) {
    case 'theme':
      return { kind: 'theme', uri: toWebviewUri(resolved.fsPath) };
    case 'font': {
      if (!fontsById.has(resolved.fontId)) {
        fontsById.set(resolved.fontId, {
          id: resolved.fontId,
          uri: toWebviewUri(resolved.fontFsPath),
        });
      }
      return {
        kind: 'font',
        fontId: resolved.fontId,
        character: resolved.character,
        ...(resolved.color !== undefined ? { color: resolved.color } : {}),
      };
    }
    case 'codicon':
      return { kind: 'codicon', id: resolved.id };
  }
}

export function buildFilesIconPayload(input: {
  paths: readonly string[];
  resolvePath: (relativePath: string) => ResolvedFileIcon;
  resolveFolder: (expanded: boolean) => ResolvedFileIcon;
  toWebviewUri: (fsPath: string) => string;
}): FilesIconsPayload {
  const fontsById = new Map<string, { id: string; uri: string }>();
  const files: Record<string, FileIconRef> = {};

  for (const path of input.paths) {
    files[path] = toFileIconRef(
      input.resolvePath(path),
      input.toWebviewUri,
      fontsById,
    );
  }

  return {
    files,
    folder: toFileIconRef(input.resolveFolder(false), input.toWebviewUri, fontsById),
    folderOpen: toFileIconRef(input.resolveFolder(true), input.toWebviewUri, fontsById),
    fonts: [...fontsById.values()],
  };
}

export type ChangedFileDto = {
  path: string;
  status: string;
  additions: number;
  deletions: number;
  oldPath?: string;
};

export type FileIconRef =
  | { kind: 'theme'; uri: string }
  | { kind: 'font'; fontId: string; character: string; color?: string }
  | { kind: 'codicon'; id: string };

export type FilesIconsPayload = {
  files: Record<string, FileIconRef>;
  folder: FileIconRef;
  folderOpen: FileIconRef;
  fonts: Array<{ id: string; uri: string }>;
};

export type HostToFilesWebview =
  | {
      type: 'filesLoaded';
      commitId: string;
      repoRoot: string;
      files: ChangedFileDto[];
      layoutPreference: 'list' | 'tree' | 'auto';
      effectiveLayout: 'list' | 'tree';
      icons: FilesIconsPayload;
    }
  | { type: 'filesEmpty'; reason: 'noCommit' | 'noFiles'; message?: string }
  | { type: 'filesError'; message: string };

export type FilesWebviewToHost =
  | { type: 'ready' }
  | { type: 'setLayout'; layout: 'list' | 'tree' | 'auto' }
  | { type: 'fileSelected'; path: string }
  | { type: 'openFileDiff'; path: string }
  | { type: 'openWorkingFile'; path: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isLayoutPreference(value: unknown): value is 'list' | 'tree' | 'auto' {
  return value === 'list' || value === 'tree' || value === 'auto';
}

function isEffectiveLayout(value: unknown): value is 'list' | 'tree' {
  return value === 'list' || value === 'tree';
}

function isChangedFileDto(value: unknown): value is ChangedFileDto {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isNonEmptyString(value.path) &&
    typeof value.status === 'string' &&
    typeof value.additions === 'number' &&
    typeof value.deletions === 'number' &&
    (value.oldPath === undefined || typeof value.oldPath === 'string')
  );
}

function isFileIconRef(value: unknown): value is FileIconRef {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return false;
  }
  switch (value.kind) {
    case 'theme':
      return isNonEmptyString(value.uri);
    case 'font':
      return (
        isNonEmptyString(value.fontId) &&
        isNonEmptyString(value.character) &&
        (value.color === undefined || typeof value.color === 'string')
      );
    case 'codicon':
      return isNonEmptyString(value.id);
    default:
      return false;
  }
}

function isFilesIconsPayload(value: unknown): value is FilesIconsPayload {
  if (!isRecord(value)) {
    return false;
  }
  if (!isRecord(value.files)) {
    return false;
  }
  for (const icon of Object.values(value.files)) {
    if (!isFileIconRef(icon)) {
      return false;
    }
  }
  if (!isFileIconRef(value.folder) || !isFileIconRef(value.folderOpen)) {
    return false;
  }
  if (!Array.isArray(value.fonts)) {
    return false;
  }
  for (const font of value.fonts) {
    if (!isRecord(font) || !isNonEmptyString(font.id) || !isNonEmptyString(font.uri)) {
      return false;
    }
  }
  return true;
}

export function isHostToFilesWebview(value: unknown): value is HostToFilesWebview {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }
  switch (value.type) {
    case 'filesLoaded':
      return (
        isNonEmptyString(value.commitId) &&
        isNonEmptyString(value.repoRoot) &&
        Array.isArray(value.files) &&
        value.files.every(isChangedFileDto) &&
        isLayoutPreference(value.layoutPreference) &&
        isEffectiveLayout(value.effectiveLayout) &&
        isFilesIconsPayload(value.icons)
      );
    case 'filesEmpty': {
      const reason = value.reason;
      if (reason !== 'noCommit' && reason !== 'noFiles') {
        return false;
      }
      return value.message === undefined || typeof value.message === 'string';
    }
    case 'filesError':
      return typeof value.message === 'string';
    default:
      return false;
  }
}

export function isFilesWebviewToHost(value: unknown): value is FilesWebviewToHost {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return false;
  }
  switch (value.type) {
    case 'ready':
      return true;
    case 'setLayout':
      return isLayoutPreference(value.layout);
    case 'fileSelected':
    case 'openFileDiff':
    case 'openWorkingFile':
      return isNonEmptyString(value.path);
    default:
      return false;
  }
}

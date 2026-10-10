export type ThemeIconDefinition =
  | { iconPath: string }
  | { fontCharacter: string; fontColor?: string; fontId?: string };

export type FileIconThemeDocument = {
  fonts?: Array<{ id: string; src: Array<{ path: string; format?: string }> }>;
  iconDefinitions: Record<string, ThemeIconDefinition>;
  file?: string;
  folder?: string;
  folderExpanded?: string;
  fileNames?: Record<string, string>;
  fileExtensions?: Record<string, string>;
  light?: {
    file?: string;
    folder?: string;
    folderExpanded?: string;
    fileNames?: Record<string, string>;
    fileExtensions?: Record<string, string>;
  };
};

export type MatchedIcon =
  | { kind: 'path'; relativePath: string }
  | {
      kind: 'font';
      fontId: string;
      character: string;
      color?: string;
    }
  | { kind: 'none' };

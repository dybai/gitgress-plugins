export type FileUriLike = {
  scheme: string;
  fsPath: string;
};

export type ActiveFilePathInput = {
  activeEditorUri?: FileUriLike | null;
  visibleEditorUris?: readonly FileUriLike[];
  tabUris?: readonly FileUriLike[];
};

function isFileUri(uri: FileUriLike | null | undefined): uri is FileUriLike {
  return uri != null && uri.scheme === 'file' && uri.fsPath !== '';
}

/**
 * Resolve the workspace file that should drive auto repo selection.
 *
 * Prefer the focused text editor; when focus is on a webview (e.g. Commits),
 * `activeTextEditor` is undefined even if a file tab remains open — fall back to
 * visible editors, then open file tabs.
 */
export function pickActiveFilePath(input: ActiveFilePathInput): string | null {
  if (isFileUri(input.activeEditorUri)) {
    return input.activeEditorUri.fsPath;
  }
  for (const uri of input.visibleEditorUris ?? []) {
    if (isFileUri(uri)) {
      return uri.fsPath;
    }
  }
  for (const uri of input.tabUris ?? []) {
    if (isFileUri(uri)) {
      return uri.fsPath;
    }
  }
  return null;
}

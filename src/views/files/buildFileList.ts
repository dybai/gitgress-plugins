export type FileListRow = {
  name: string;
  directory: string;
  path: string;
  status: string;
  additions: number;
  deletions: number;
};

export function buildFileList(
  files: Array<{ path: string; status: string; additions: number; deletions: number }>,
): FileListRow[] {
  return [...files]
    .map((file) => {
      const idx = file.path.lastIndexOf('/');
      return {
        name: idx === -1 ? file.path : file.path.slice(idx + 1),
        directory: idx === -1 ? '' : file.path.slice(0, idx),
        path: file.path,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

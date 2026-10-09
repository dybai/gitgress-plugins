const LABELS: Record<string, string> = {
  A: 'Added',
  M: 'Modified',
  D: 'Deleted',
  R: 'Renamed',
  C: 'Copied',
};

export function fileStatusLabel(status: string): string {
  return LABELS[status] ?? status;
}

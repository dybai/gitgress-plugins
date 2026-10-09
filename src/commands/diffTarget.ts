export type DiffTarget = { path: string; status: string };

export function resolveDiffTarget(
  files: readonly DiffTarget[],
  path: string,
): DiffTarget | undefined {
  const match = files.find((file) => file.path === path);
  return match === undefined ? undefined : { path: match.path, status: match.status };
}

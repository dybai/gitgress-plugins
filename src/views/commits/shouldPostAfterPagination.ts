export type PaginationResult = 'ok' | 'busy' | 'noop';

export function shouldPostAfterPagination(
  baselineLoadVersion: number,
  currentLoadVersion: number,
  result: PaginationResult,
): boolean {
  return result === 'ok' && currentLoadVersion === baselineLoadVersion;
}

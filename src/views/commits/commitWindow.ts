import type { CommitSummary } from '../../git/GitService';

export const MAX_WINDOW_PAGES = 6;

export type CommitWindowState<T extends { id: string } = CommitSummary> = {
  loaded: T[];
  hasOlder: boolean;
  hasNewer: boolean;
  olderPreload: T[] | null;
  newerPreload: T[] | null;
};

export function createCommitWindow<
  T extends { id: string } = CommitSummary,
>(): CommitWindowState<T> {
  return {
    loaded: [],
    hasOlder: false,
    hasNewer: false,
    olderPreload: null,
    newerPreload: null,
  };
}

/** Replace window from tip page (manual refresh / branch switch). hasNewer=false. */
export function replaceFromTip<T extends { id: string }>(
  batch: T[],
  pageSize: number,
): CommitWindowState<T> {
  return {
    loaded: batch,
    hasOlder: batch.length === pageSize,
    hasNewer: false,
    olderPreload: null,
    newerPreload: null,
  };
}

/**
 * When selection protection prevents eviction, `loaded.length` may exceed
 * `maxPages * pageSize` until selection moves — matches spec “never evict selected”.
 */
function evictFromNewerEnd<T extends { id: string }>(
  loaded: T[],
  maxLen: number,
  pageSize: number,
  selectedId: string | null,
): { loaded: T[]; didEvict: boolean } {
  let result = loaded;
  let didEvict = false;
  while (result.length > maxLen) {
    const chunk = result.slice(0, pageSize);
    if (selectedId && chunk.some((c) => c.id === selectedId)) {
      break;
    }
    result = result.slice(pageSize);
    didEvict = true;
  }
  return { loaded: result, didEvict };
}

function evictFromOlderEnd<T extends { id: string }>(
  loaded: T[],
  maxLen: number,
  pageSize: number,
  selectedId: string | null,
): { loaded: T[]; didEvict: boolean } {
  let result = loaded;
  let didEvict = false;
  while (result.length > maxLen) {
    const chunk = result.slice(-pageSize);
    if (selectedId && chunk.some((c) => c.id === selectedId)) {
      break;
    }
    result = result.slice(0, -pageSize);
    didEvict = true;
  }
  return { loaded: result, didEvict };
}

/**
 * Append older page at end. If loaded.length > maxPages*pageSize, evict from start
 * unless eviction would remove selectedId — then skip eviction and keep hasNewer as-is.
 * hasOlder = batch.length === pageSize.
 */
export function mergeOlder<T extends { id: string }>(
  state: CommitWindowState<T>,
  batch: T[],
  pageSize: number,
  maxPages: number,
  selectedId: string | null,
): CommitWindowState<T> {
  const maxLen = maxPages * pageSize;
  let loaded = [...state.loaded, ...batch];
  const { loaded: trimmed, didEvict } = evictFromNewerEnd(
    loaded,
    maxLen,
    pageSize,
    selectedId,
  );
  loaded = trimmed;
  return {
    ...state,
    loaded,
    hasOlder: batch.length === pageSize,
    hasNewer: didEvict ? true : state.hasNewer,
    newerPreload: didEvict ? null : state.newerPreload,
  };
}

/** Prepend newer page at start; symmetric eviction from end. */
export function mergeNewer<T extends { id: string }>(
  state: CommitWindowState<T>,
  batch: T[],
  pageSize: number,
  maxPages: number,
  selectedId: string | null,
): CommitWindowState<T> {
  const maxLen = maxPages * pageSize;
  let loaded = [...batch, ...state.loaded];
  const { loaded: trimmed, didEvict } = evictFromOlderEnd(
    loaded,
    maxLen,
    pageSize,
    selectedId,
  );
  loaded = trimmed;
  return {
    ...state,
    loaded,
    hasNewer: batch.length === pageSize,
    hasOlder: didEvict ? true : state.hasOlder,
    olderPreload: didEvict ? null : state.olderPreload,
  };
}

export function setOlderPreload<T extends { id: string }>(
  state: CommitWindowState<T>,
  batch: T[] | null,
): CommitWindowState<T> {
  return { ...state, olderPreload: batch };
}

export function setNewerPreload<T extends { id: string }>(
  state: CommitWindowState<T>,
  batch: T[] | null,
): CommitWindowState<T> {
  return { ...state, newerPreload: batch };
}

/** If preload matches direction, merge it and clear that preload buffer. */
export function consumeOlderPreload<T extends { id: string }>(
  state: CommitWindowState<T>,
  pageSize: number,
  maxPages: number,
  selectedId: string | null,
): CommitWindowState<T> {
  if (!state.olderPreload) {
    return state;
  }
  const batch = state.olderPreload;
  return mergeOlder(
    { ...state, olderPreload: null },
    batch,
    pageSize,
    maxPages,
    selectedId,
  );
}

export function consumeNewerPreload<T extends { id: string }>(
  state: CommitWindowState<T>,
  pageSize: number,
  maxPages: number,
  selectedId: string | null,
): CommitWindowState<T> {
  if (!state.newerPreload) {
    return state;
  }
  const batch = state.newerPreload;
  return mergeNewer(
    { ...state, newerPreload: null },
    batch,
    pageSize,
    maxPages,
    selectedId,
  );
}

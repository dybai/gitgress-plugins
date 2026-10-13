import { describe, expect, it } from 'vitest';
import {
  createCommitWindow,
  mergeOlder,
  mergeNewer,
  replaceFromTip,
  setOlderPreload,
  consumeOlderPreload,
} from '../../../src/views/commits/commitWindow';

const ids = (...xs: string[]) => xs.map((id) => ({ id }));

describe('commitWindow', () => {
  it('replaceFromTip sets hasOlder from full page and hasNewer false', () => {
    const w = replaceFromTip(ids('a', 'b'), 2);
    expect(w.loaded.map((c) => c.id)).toEqual(['a', 'b']);
    expect(w.hasOlder).toBe(true);
    expect(w.hasNewer).toBe(false);
  });

  it('mergeOlder evicts newer end when over cap', () => {
    let w = replaceFromTip(ids('a', 'b'), 2);
    w = mergeOlder(w, ids('c', 'd'), 2, 3, null);
    w = mergeOlder(w, ids('e', 'f'), 2, 3, null);
    w = mergeOlder(w, ids('g', 'h'), 2, 3, null); // 8 > 6 → drop a,b
    expect(w.loaded.map((c) => c.id)).toEqual(['c', 'd', 'e', 'f', 'g', 'h']);
    expect(w.hasNewer).toBe(true);
  });

  it('mergeOlder does not evict when selected would leave the window', () => {
    let w = replaceFromTip(ids('a', 'b'), 2);
    w = mergeOlder(w, ids('c', 'd'), 2, 3, 'a');
    w = mergeOlder(w, ids('e', 'f'), 2, 3, 'a');
    w = mergeOlder(w, ids('g', 'h'), 2, 3, 'a');
    expect(w.loaded.map((c) => c.id)).toContain('a');
    expect(w.loaded.length).toBeGreaterThan(6); // retention over cap allowed when protecting selection
  });

  it('mergeNewer prepends and may evict older end', () => {
    let w = replaceFromTip(ids('c', 'd'), 2);
    w = { ...w, hasNewer: true };
    w = mergeNewer(w, ids('a', 'b'), 2, 3, null);
    expect(w.loaded.map((c) => c.id).slice(0, 2)).toEqual(['a', 'b']);
  });

  it('consumeOlderPreload merges buffer', () => {
    let w = replaceFromTip(ids('a', 'b'), 2);
    w = setOlderPreload(w, ids('c', 'd'));
    w = consumeOlderPreload(w, 2, 3, null);
    expect(w.loaded.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(w.olderPreload).toBeNull();
  });
});

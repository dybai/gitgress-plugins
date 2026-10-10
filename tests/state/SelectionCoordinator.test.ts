import { describe, expect, it, vi } from 'vitest';
import { SelectionState } from '../../src/state/SelectionState.js';
import { SelectionCoordinator } from '../../src/state/SelectionCoordinator.js';
import type { ManualRepoPreference } from '../../src/state/SelectionCoordinator.js';

function makePreference(initial: string | null = null): ManualRepoPreference & {
  raw: string | null;
} {
  const pref: ManualRepoPreference & { raw: string | null } = {
    raw: initial,
    get() {
      return pref.raw;
    },
    set(root: string | null) {
      pref.raw = root;
    },
  };
  return pref;
}

function makeCoordinator(opts: {
  selection?: SelectionState;
  roots?: readonly string[];
  preference?: ManualRepoPreference;
  activeFile?: string | null;
} = {}) {
  const selection = opts.selection ?? new SelectionState();
  const rootsGetter = vi.fn(() => opts.roots ?? []);
  const preference = opts.preference ?? makePreference();
  const activeFileGetter = vi.fn(() => opts.activeFile ?? null);
  const coordinator = new SelectionCoordinator(
    selection,
    rootsGetter,
    preference,
    activeFileGetter,
  );
  return { selection, rootsGetter, preference, activeFileGetter, coordinator };
}

describe('SelectionCoordinator', () => {
  describe('resolveInitial', () => {
    it('applies preference when it is in indexed roots and locks', () => {
      const pref = makePreference('/ws/apps/api');
      const { selection, coordinator } = makeCoordinator({
        roots: ['/ws/apps/api', '/ws'],
        preference: pref,
      });

      coordinator.resolveInitial();

      expect(selection.getSnapshot().repoRoot).toBe('/ws/apps/api');
      expect(coordinator.isLocked()).toBe(true);
    });

    it('clears stale preference and falls back to editor owning root', () => {
      const pref = makePreference('/gone/repo');
      const setSpy = vi.spyOn(pref, 'set');
      const { selection, coordinator } = makeCoordinator({
        roots: ['/ws/apps/api'],
        preference: pref,
        activeFile: '/ws/apps/api/src/main.ts',
      });

      coordinator.resolveInitial();

      expect(setSpy).toHaveBeenCalledWith(null);
      expect(pref.get()).toBeNull();
      expect(selection.getSnapshot().repoRoot).toBe('/ws/apps/api');
      expect(coordinator.isLocked()).toBe(true);
    });

    it('uses editor deepest prefix when no preference', () => {
      const { selection, coordinator } = makeCoordinator({
        roots: ['/ws/apps/api', '/ws', '/ws/apps'],
        activeFile: '/ws/apps/api/src/main.ts',
      });

      coordinator.resolveInitial();

      expect(selection.getSnapshot().repoRoot).toBe('/ws/apps/api');
      expect(coordinator.isLocked()).toBe(true);
    });

    it('sets repo to null and does not lock when nothing matches', () => {
      const { selection, coordinator } = makeCoordinator({
        roots: ['/ws/apps/api'],
        activeFile: '/other/place/file.ts',
      });

      coordinator.resolveInitial();

      expect(selection.getSnapshot().repoRoot).toBeNull();
      expect(coordinator.isLocked()).toBe(false);
    });

    it('sets repo to null and does not lock when there is no active editor', () => {
      const { selection, coordinator } = makeCoordinator({
        roots: ['/ws/apps/api'],
        activeFile: null,
      });

      coordinator.resolveInitial();

      expect(selection.getSnapshot().repoRoot).toBeNull();
      expect(coordinator.isLocked()).toBe(false);
    });

    it('normalizes a Windows-style preference before comparing', () => {
      const pref = makePreference('D:\\ws\\apps\\api');
      const { selection, coordinator } = makeCoordinator({
        roots: ['d:/ws/apps/api'],
        preference: pref,
      });

      coordinator.resolveInitial();

      expect(selection.getSnapshot().repoRoot).toBe('d:/ws/apps/api');
      expect(coordinator.isLocked()).toBe(true);
    });

    it('preserves preference on empty index then applies it when scan completes', () => {
      const pref = makePreference('/ws/apps/api');
      const setSpy = vi.spyOn(pref, 'set');
      const { selection, coordinator, rootsGetter } = makeCoordinator({
        roots: [],
        preference: pref,
        activeFile: null,
      });

      coordinator.resolveInitial();

      expect(setSpy).not.toHaveBeenCalledWith(null);
      expect(pref.get()).toBe('/ws/apps/api');
      expect(selection.getSnapshot().repoRoot).toBeNull();
      expect(coordinator.isLocked()).toBe(false);

      rootsGetter.mockReturnValue(['/ws/apps/api']);
      coordinator.onIndexUpdated();

      expect(selection.getSnapshot().repoRoot).toBe('/ws/apps/api');
      expect(coordinator.isLocked()).toBe(true);
    });
  });

  describe('onActiveEditorChanged', () => {
    it('no-ops when locked', () => {
      const pref = makePreference('/ws/apps/api');
      const { selection, coordinator } = makeCoordinator({
        roots: ['/ws/apps/api'],
        preference: pref,
      });
      coordinator.resolveInitial();
      expect(coordinator.isLocked()).toBe(true);

      coordinator.onActiveEditorChanged();

      expect(selection.getSnapshot().repoRoot).toBe('/ws/apps/api');
      expect(coordinator.isLocked()).toBe(true);
    });

    it('auto-selects and locks when unlocked, empty, and editor matches', () => {
      const { selection, coordinator, activeFileGetter } = makeCoordinator({
        roots: ['/ws/apps/api'],
        activeFile: null,
      });
      coordinator.resolveInitial();
      expect(selection.getSnapshot().repoRoot).toBeNull();
      expect(coordinator.isLocked()).toBe(false);

      activeFileGetter.mockReturnValue('/ws/apps/api/src/main.ts');
      coordinator.onActiveEditorChanged();

      expect(selection.getSnapshot().repoRoot).toBe('/ws/apps/api');
      expect(coordinator.isLocked()).toBe(true);
    });

    it('stays null when unlocked, empty, and editor does not match', () => {
      const { selection, coordinator } = makeCoordinator({
        roots: ['/ws/apps/api'],
        activeFile: '/other/place/file.ts',
      });
      coordinator.resolveInitial();

      coordinator.onActiveEditorChanged();

      expect(selection.getSnapshot().repoRoot).toBeNull();
      expect(coordinator.isLocked()).toBe(false);
    });

    it('keeps the locked selection when editor changes into another repo', () => {
      const { selection, coordinator, activeFileGetter } = makeCoordinator({
        roots: ['/ws/apps/api', '/ws/other'],
        preference: makePreference('/ws/apps/api'),
      });
      coordinator.resolveInitial();
      expect(coordinator.isLocked()).toBe(true);

      activeFileGetter.mockReturnValue('/ws/other/src/file.ts');
      coordinator.onActiveEditorChanged();

      expect(selection.getSnapshot().repoRoot).toBe('/ws/apps/api');
      expect(coordinator.isLocked()).toBe(true);
    });
  });

  describe('selectManually', () => {
    it('sets repo, locks, and stores preference', () => {
      const pref = makePreference();
      const { selection, coordinator } = makeCoordinator({
        roots: ['/ws/apps/api', '/ws/other'],
        preference: pref,
      });

      coordinator.selectManually('/ws/other');

      expect(selection.getSnapshot().repoRoot).toBe('/ws/other');
      expect(coordinator.isLocked()).toBe(true);
      expect(pref.get()).toBe('/ws/other');
    });

    it('makes subsequent editor changes no-op (sticky)', () => {
      const { selection, coordinator, activeFileGetter } = makeCoordinator({
        roots: ['/ws/apps/api', '/ws/other'],
        activeFile: null,
      });
      coordinator.selectManually('/ws/other');

      activeFileGetter.mockReturnValue('/ws/apps/api/src/main.ts');
      coordinator.onActiveEditorChanged();

      expect(selection.getSnapshot().repoRoot).toBe('/ws/other');
      expect(coordinator.isLocked()).toBe(true);
    });
  });

  describe('onIndexUpdated', () => {
    it('does not unlock a sticky selection when index changes', () => {
      const pref = makePreference('/ws/apps/api');
      const { selection, coordinator, rootsGetter } = makeCoordinator({
        roots: ['/ws/apps/api'],
        preference: pref,
      });
      coordinator.resolveInitial();
      expect(coordinator.isLocked()).toBe(true);

      // Index changes (new repo appears); selection must stay sticky.
      rootsGetter.mockReturnValue(['/ws/apps/api', '/ws/new']);
      coordinator.onIndexUpdated();

      expect(selection.getSnapshot().repoRoot).toBe('/ws/apps/api');
      expect(coordinator.isLocked()).toBe(true);
    });

    it('applies preference when a previously-absent preferred repo appears', () => {
      const pref = makePreference('/ws/apps/api');
      const { selection, coordinator, rootsGetter } = makeCoordinator({
        roots: [],
        preference: pref,
        activeFile: null,
      });
      // Preference set before the index has any repos. onIndexUpdated is the
      // entry point when the index first reports repos; resolveInitial is not
      // called yet, so the preference survives and gets applied when the repo
      // appears.
      expect(selection.getSnapshot().repoRoot).toBeNull();
      expect(coordinator.isLocked()).toBe(false);

      rootsGetter.mockReturnValue(['/ws/apps/api']);
      coordinator.onIndexUpdated();

      expect(selection.getSnapshot().repoRoot).toBe('/ws/apps/api');
      expect(coordinator.isLocked()).toBe(true);
    });

    it('applies editor rule when unlocked and empty, and locks', () => {
      const { selection, coordinator, rootsGetter, activeFileGetter } =
        makeCoordinator({
          roots: [],
          activeFile: null,
        });
      coordinator.resolveInitial();
      expect(selection.getSnapshot().repoRoot).toBeNull();

      rootsGetter.mockReturnValue(['/ws/apps/api']);
      activeFileGetter.mockReturnValue('/ws/apps/api/src/main.ts');
      coordinator.onIndexUpdated();

      expect(selection.getSnapshot().repoRoot).toBe('/ws/apps/api');
      expect(coordinator.isLocked()).toBe(true);
    });

    it('does not switch repos when a locked selection persists through index update', () => {
      const { selection, coordinator, rootsGetter, activeFileGetter } =
        makeCoordinator({
          roots: ['/ws/other'],
          preference: makePreference('/ws/other'),
        });
      coordinator.selectManually('/ws/other');
      rootsGetter.mockReturnValue(['/ws/other', '/ws/apps/api']);
      activeFileGetter.mockReturnValue('/ws/apps/api/src/main.ts');
      coordinator.onIndexUpdated();

      expect(selection.getSnapshot().repoRoot).toBe('/ws/other');
      expect(coordinator.isLocked()).toBe(true);
    });
  });

  describe('onSelectedRepoInvalid', () => {
    it('clears repo, unlocks, and re-resolves', () => {
      const pref = makePreference('/ws/apps/api');
      const { selection, coordinator, rootsGetter } = makeCoordinator({
        roots: ['/ws/apps/api'],
        preference: pref,
      });
      coordinator.resolveInitial();
      expect(coordinator.isLocked()).toBe(true);

      // Selected repo vanishes from the index.
      rootsGetter.mockReturnValue([]);
      coordinator.onSelectedRepoInvalid();

      expect(selection.getSnapshot().repoRoot).toBeNull();
      expect(coordinator.isLocked()).toBe(false);
    });

    it('re-resolves to editor after invalidation when editor matches', () => {
      const pref = makePreference('/ws/apps/api');
      const { selection, coordinator, rootsGetter, activeFileGetter } =
        makeCoordinator({
          roots: ['/ws/apps/api'],
          preference: pref,
          activeFile: '/ws/apps/api/src/main.ts',
        });
      coordinator.resolveInitial();
      expect(coordinator.isLocked()).toBe(true);

      // Repo vanishes but then reappears (simulated by re-resolving with the
      // editor still pointing into it). First invalidate with empty index.
      rootsGetter.mockReturnValue([]);
      coordinator.onSelectedRepoInvalid();
      expect(selection.getSnapshot().repoRoot).toBeNull();
      expect(coordinator.isLocked()).toBe(false);

      // Now the repo reappears and editor still matches.
      rootsGetter.mockReturnValue(['/ws/apps/api']);
      activeFileGetter.mockReturnValue('/ws/apps/api/src/main.ts');
      coordinator.onIndexUpdated();
      expect(selection.getSnapshot().repoRoot).toBe('/ws/apps/api');
      expect(coordinator.isLocked()).toBe(true);
    });

    it('clears stale preference during re-resolve once index is authoritative', () => {
      const pref = makePreference('/gone/repo');
      const setSpy = vi.spyOn(pref, 'set');
      const { coordinator, rootsGetter } = makeCoordinator({
        roots: [],
        preference: pref,
      });
      coordinator.resolveInitial();
      expect(setSpy).not.toHaveBeenCalledWith(null);

      rootsGetter.mockReturnValue(['/ws/apps/api']);
      coordinator.onSelectedRepoInvalid();
      expect(setSpy).toHaveBeenCalledWith(null);
      expect(coordinator.isLocked()).toBe(false);
    });
  });

  describe('isLocked', () => {
    it('starts unlocked', () => {
      const { coordinator } = makeCoordinator();
      expect(coordinator.isLocked()).toBe(false);
    });
  });
});

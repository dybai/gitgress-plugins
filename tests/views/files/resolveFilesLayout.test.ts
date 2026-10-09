import { describe, expect, it } from 'vitest';
import {
  FILES_LAYOUT_AUTO_THRESHOLD,
  normalizeFilesLayoutPreference,
  resolveFilesLayout,
} from '../../../src/views/files/resolveFilesLayout';

describe('normalizeFilesLayoutPreference', () => {
  it('keeps valid stored values', () => {
    expect(normalizeFilesLayoutPreference('list')).toBe('list');
    expect(normalizeFilesLayoutPreference('tree')).toBe('tree');
    expect(normalizeFilesLayoutPreference('auto')).toBe('auto');
  });

  it('falls back to auto for invalid values', () => {
    for (const value of [undefined, null, '', 'grid', 'LIST', 1, {}, []]) {
      expect(normalizeFilesLayoutPreference(value)).toBe('auto');
    }
  });
});

describe('resolveFilesLayout', () => {
  it('returns list and tree preferences unchanged', () => {
    expect(resolveFilesLayout('list', 100)).toBe('list');
    expect(resolveFilesLayout('tree', 1)).toBe('tree');
  });

  it('auto uses list when fileCount <= threshold', () => {
    expect(resolveFilesLayout('auto', FILES_LAYOUT_AUTO_THRESHOLD)).toBe('list');
    expect(resolveFilesLayout('auto', FILES_LAYOUT_AUTO_THRESHOLD + 1)).toBe('tree');
  });
});

import { describe, expect, it } from 'vitest';
import {
  FILES_LAYOUT_AUTO_THRESHOLD,
  resolveFilesLayout,
} from '../../../src/views/files/resolveFilesLayout';

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

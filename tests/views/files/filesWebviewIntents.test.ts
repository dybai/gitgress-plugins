import { describe, expect, it } from 'vitest';
import {
  layoutToggleIntent,
  rowDoubleClickIntent,
} from '../../../src/views/files/filesWebviewIntents';

describe('layoutToggleIntent', () => {
  it('posts setLayout with the next preference', () => {
    expect(layoutToggleIntent('auto')).toEqual({ type: 'setLayout', layout: 'list' });
    expect(layoutToggleIntent('list')).toEqual({ type: 'setLayout', layout: 'tree' });
    expect(layoutToggleIntent('tree')).toEqual({ type: 'setLayout', layout: 'auto' });
  });

  it('posts nothing when no files are loaded', () => {
    expect(layoutToggleIntent(null)).toBeUndefined();
  });
});

describe('rowDoubleClickIntent', () => {
  it('posts openFileDiff for a file row', () => {
    expect(rowDoubleClickIntent('src/a.ts', false)).toEqual({
      type: 'openFileDiff',
      path: 'src/a.ts',
    });
  });

  it('ignores clicks off a file row (e.g. directories)', () => {
    expect(rowDoubleClickIntent(undefined, false)).toBeUndefined();
  });

  it('ignores double-clicks on the Open button', () => {
    expect(rowDoubleClickIntent('src/a.ts', true)).toBeUndefined();
  });
});

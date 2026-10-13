import { describe, expect, it } from 'vitest';
import {
  anchoredScrollTop,
  chooseScrollAnchorId,
} from '../../webview/commits/scrollAnchor.js';

describe('chooseScrollAnchorId', () => {
  const rows = [
    { id: 'above', top: -40, bottom: -10 },
    { id: 'first-visible', top: -10, bottom: 20 },
    { id: 'selected', top: 20, bottom: 50 },
  ];

  it('prefers the selected commit when it remains in the DOM', () => {
    expect(chooseScrollAnchorId('selected', rows, 0, 100)).toBe('selected');
  });

  it('falls back to the first visible commit', () => {
    expect(chooseScrollAnchorId('missing', rows, 0, 100)).toBe('first-visible');
  });

  it('does not anchor to an offscreen row when there is no selection', () => {
    expect(
      chooseScrollAnchorId(undefined, [{ id: 'offscreen', top: 110, bottom: 140 }], 0, 100),
    ).toBeNull();
  });
});

describe('anchoredScrollTop', () => {
  it('compensates for rows inserted before the anchor', () => {
    expect(anchoredScrollTop(120, 24, 84)).toBe(180);
  });

  it('compensates for rows evicted before the anchor', () => {
    expect(anchoredScrollTop(180, 84, 24)).toBe(120);
  });
});

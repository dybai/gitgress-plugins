import { describe, expect, it } from 'vitest';
import { scanStatusMessage } from '../../../src/views/commits/scanStatusMessage';

describe('scanStatusMessage', () => {
  it('builds a scanning host message', () => {
    expect(scanStatusMessage('scanning')).toEqual({
      type: 'scanStatus',
      status: 'scanning',
    });
  });

  it('builds an idle host message', () => {
    expect(scanStatusMessage('idle')).toEqual({
      type: 'scanStatus',
      status: 'idle',
    });
  });
});

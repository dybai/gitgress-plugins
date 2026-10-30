import { describe, expect, it } from 'vitest';
import { busyStatusMessage } from '../../../src/views/commits/busyStatusMessage';

describe('busyStatusMessage', () => {
  it('builds an active host message', () => {
    expect(busyStatusMessage(true)).toEqual({
      type: 'busyStatus',
      active: true,
    });
  });

  it('builds an inactive host message', () => {
    expect(busyStatusMessage(false)).toEqual({
      type: 'busyStatus',
      active: false,
    });
  });
});

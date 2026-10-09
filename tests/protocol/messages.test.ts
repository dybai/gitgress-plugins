// tests/protocol/messages.test.ts
import { describe, expect, it } from 'vitest';
import { isWebviewToHost } from '../../src/protocol/messages';

describe('isWebviewToHost', () => {
  it('accepts commitSelected with commitId', () => {
    expect(isWebviewToHost({ type: 'commitSelected', commitId: 'abc' })).toBe(true);
  });

  it('rejects unknown type', () => {
    expect(isWebviewToHost({ type: 'explode' })).toBe(false);
  });

  it('rejects commitSelected without commitId', () => {
    expect(isWebviewToHost({ type: 'commitSelected' })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { shouldPostAfterPagination } from '../../../src/views/commits/shouldPostAfterPagination';

describe('shouldPostAfterPagination', () => {
  it('allows a successful pagination result when no newer load claimed the version', () => {
    expect(shouldPostAfterPagination(4, 4, 'ok')).toBe(true);
  });

  it.each(['busy', 'noop'] as const)(
    'rejects a %s result without claiming the version',
    (result) => {
      expect(shouldPostAfterPagination(4, 4, result)).toBe(false);
    },
  );

  it('rejects a successful result when a newer load claimed the version', () => {
    expect(shouldPostAfterPagination(4, 5, 'ok')).toBe(false);
  });
});

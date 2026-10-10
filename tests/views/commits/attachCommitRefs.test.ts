import { describe, expect, it } from 'vitest';
import {
  attachCommitRefs,
  foldRemoteLabel,
  primaryRef,
  secondaryRefs,
} from '../../../src/views/commits/attachCommitRefs';

describe('attachCommitRefs', () => {
  it('groups refs by commit and orders tipCommitIds by commit list', () => {
    const { refsById, tipCommitIds } = attachCommitRefs(
      ['c', 'b', 'a'],
      [
        { name: 'main', kind: 'local', commitId: 'c' },
        { name: 'origin/main', kind: 'remote', commitId: 'a' },
        { name: 'feature', kind: 'local', commitId: 'b' },
      ],
    );

    expect(tipCommitIds).toEqual(['c', 'b', 'a']);
    expect(refsById.get('c')).toEqual([{ name: 'main', kind: 'local' }]);
    expect(refsById.get('a')).toEqual([{ name: 'origin/main', kind: 'remote' }]);
  });
});

describe('primaryRef / foldRemoteLabel / secondaryRefs', () => {
  const refs = [
    { name: 'main', kind: 'local' as const },
    { name: 'origin/main', kind: 'remote' as const },
    { name: 'github/main', kind: 'remote' as const },
  ];

  it('prefers the display branch', () => {
    expect(primaryRef(refs, 'main')).toEqual({ name: 'main', kind: 'local' });
  });

  it('folds matching remote short label', () => {
    expect(foldRemoteLabel({ name: 'main', kind: 'local' }, refs)).toBe('origin');
  });

  it('excludes primary and folded remote from secondary', () => {
    const primary = { name: 'main', kind: 'local' as const };
    expect(secondaryRefs(refs, primary, 'origin')).toEqual([
      { name: 'github/main', kind: 'remote' },
    ]);
  });
});

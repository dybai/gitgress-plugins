import { describe, expect, it } from 'vitest';
import { tipsFingerprint } from '../../src/git/tipsFingerprint';

describe('tipsFingerprint', () => {
  it('is order-independent and includes name, kind, and commit id', () => {
    const a = tipsFingerprint([
      { name: 'origin/main', kind: 'remote', commitId: 'c1' },
      { name: 'main', kind: 'local', commitId: 'c2' },
    ]);
    const b = tipsFingerprint([
      { name: 'main', kind: 'local', commitId: 'c2' },
      { name: 'origin/main', kind: 'remote', commitId: 'c1' },
    ]);
    expect(a).toBe(b);
    expect(a).toContain('remote\torigin/main\tc1');
    expect(a).toContain('local\tmain\tc2');
  });

  it('changes when a remote tip commit moves', () => {
    const before = tipsFingerprint([
      { name: 'origin/main', kind: 'remote', commitId: 'old' },
    ]);
    const after = tipsFingerprint([
      { name: 'origin/main', kind: 'remote', commitId: 'new' },
    ]);
    expect(before).not.toBe(after);
  });
});

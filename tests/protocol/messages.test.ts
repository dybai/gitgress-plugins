// tests/protocol/messages.test.ts
import { describe, expect, it } from 'vitest';
import { isHostMessage, isWebviewToHost } from '../../src/protocol/messages';

const validCommit = {
  id: 'abc',
  subject: 'subj',
  authorName: 'Ann',
  authorDateIso: '2024-01-01T00:00:00Z',
  fullMessage: 'msg',
  additions: 1,
  deletions: 0,
  parentIds: ['def'],
};

describe('isHostMessage', () => {
  it('accepts commitsLoaded with parentIds', () => {
    expect(
      isHostMessage({
        type: 'commitsLoaded',
        branch: 'main',
        commits: [{ ...validCommit, parentIds: [] }, validCommit],
      }),
    ).toBe(true);
  });

  it('rejects commitsLoaded when parentIds is missing', () => {
    const { parentIds: _, ...withoutParents } = validCommit;
    expect(
      isHostMessage({
        type: 'commitsLoaded',
        branch: 'main',
        commits: [withoutParents],
      }),
    ).toBe(false);
  });

  it('rejects commitsLoaded when parentIds contains empty strings', () => {
    expect(
      isHostMessage({
        type: 'commitsLoaded',
        branch: 'main',
        commits: [{ ...validCommit, parentIds: [''] }],
      }),
    ).toBe(false);
  });
});

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

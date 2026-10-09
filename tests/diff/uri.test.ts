import { describe, expect, it, vi } from 'vitest';

vi.mock('vscode', () => ({
  Uri: {
    from(components: { scheme: string; path: string; query: string }) {
      return components;
    },
  },
}));

import {
  EMPTY_REVISION,
  GITGRESS_SCHEME,
  decodeGitgressUri,
  encodeGitgressUri,
  resolveDiffRevisions,
} from '../../src/diff/gitgressUri';

describe('gitgress URI helpers', () => {
  it('round-trips repository, revision, and file path values', () => {
    const input = {
      repoRoot: 'D:\\work space\\répo & tools',
      revision: 'feature/topic?value=1#fragment',
      filePath: 'src/folder with spaces/a#b?c&d.ts',
    };

    const uri = encodeGitgressUri(input.repoRoot, input.revision, input.filePath);

    expect(uri.scheme).toBe(GITGRESS_SCHEME);
    expect(decodeGitgressUri(uri)).toEqual(input);
  });

  it('round-trips a literal empty revision', () => {
    const uri = encodeGitgressUri('/repo', '', 'empty-revision.txt');

    expect(decodeGitgressUri(uri).revision).toBe('');
  });
});

describe('resolveDiffRevisions', () => {
  it('uses the parent and commit for a modified file', () => {
    expect(resolveDiffRevisions('commit123', 'parent456', 'M')).toEqual({
      left: 'parent456',
      right: 'commit123',
    });
  });

  it('uses an empty left document for an added file', () => {
    expect(resolveDiffRevisions('commit123', 'parent456', 'A')).toEqual({
      left: EMPTY_REVISION,
      right: 'commit123',
    });
  });

  it('uses an empty right document for a deleted file', () => {
    expect(resolveDiffRevisions('commit123', 'parent456', 'D')).toEqual({
      left: 'parent456',
      right: EMPTY_REVISION,
    });
  });

  it('uses an empty left document for a root commit', () => {
    expect(resolveDiffRevisions('commit123', null, 'M')).toEqual({
      left: EMPTY_REVISION,
      right: 'commit123',
    });
  });
});

import { describe, expect, it } from 'vitest';
import { parseGitmodules } from '../../src/repoIndex/parseGitmodules.js';

describe('parseGitmodules', () => {
  it('extracts path entries', () => {
    const content = `
[submodule "superpowers"]
	path = .superpowers
	url = https://example.com/superpowers.git
[submodule "other"]
	path = libs/other
	url = ./other.git
`;
    expect(parseGitmodules(content).sort()).toEqual([
      '.superpowers',
      'libs/other',
    ]);
  });

  it('returns empty for blank input', () => {
    expect(parseGitmodules('')).toEqual([]);
  });
});

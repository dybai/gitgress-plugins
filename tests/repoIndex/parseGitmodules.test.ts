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

  it('returns unique paths in document order', () => {
    const content = `
path = libs/a
path = libs/b
path = libs/a
`;
    expect(parseGitmodules(content)).toEqual(['libs/a', 'libs/b']);
  });

  it('trims path values', () => {
    expect(parseGitmodules('path =  libs/other  ')).toEqual(['libs/other']);
  });

  it('converts backslashes to POSIX separators', () => {
    expect(parseGitmodules('path = libs\\nested\\other')).toEqual([
      'libs/nested/other',
    ]);
  });

  it('strips repeated leading ./ segments', () => {
    expect(parseGitmodules('path = ././libs/other')).toEqual(['libs/other']);
  });

  it('omits empty normalized paths', () => {
    expect(parseGitmodules('path = ./')).toEqual([]);
    expect(parseGitmodules('path = ./\npath = valid')).toEqual(['valid']);
  });

  it('omits absolute and UNC paths', () => {
    expect(parseGitmodules('path = /tmp/repo')).toEqual([]);
    expect(parseGitmodules('path = \\\\server\\repo')).toEqual([]);
    expect(
      parseGitmodules('path = /abs\npath = rel/sub\npath = \\\\unc\\share'),
    ).toEqual(['rel/sub']);
  });
});

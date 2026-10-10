import { describe, expect, it } from 'vitest';
import { buildLanguageIdByExtension } from '../../../src/views/files/buildLanguageIdByExtension';

describe('buildLanguageIdByExtension', () => {
  it('maps contributed language extensions without leading dots', () => {
    const map = buildLanguageIdByExtension([
      {
        packageJSON: {
          contributes: {
            languages: [
              { id: 'java', extensions: ['.java'] },
              { id: 'yaml', extensions: ['.yaml', '.yml'] },
            ],
          },
        },
      },
    ]);
    expect(map).toEqual({
      java: 'java',
      yaml: 'yaml',
      yml: 'yaml',
    });
  });

  it('keeps the first claim when two languages share an extension', () => {
    const map = buildLanguageIdByExtension([
      {
        packageJSON: {
          contributes: {
            languages: [
              { id: 'json', extensions: ['.json'] },
              { id: 'jsonc', extensions: ['.json'] },
            ],
          },
        },
      },
    ]);
    expect(map.json).toBe('json');
  });
});

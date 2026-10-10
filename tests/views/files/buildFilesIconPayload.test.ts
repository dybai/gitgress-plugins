import { describe, expect, it } from 'vitest';
import { buildFilesIconPayload } from '../../../src/views/files/buildFilesIconPayload';

describe('buildFilesIconPayload', () => {
  it('maps theme and font refs and dedupes fonts', () => {
    const payload = buildFilesIconPayload({
      paths: ['a.ts', 'b.ts'],
      resolvePath: (p) =>
        p === 'a.ts'
          ? { kind: 'theme', fsPath: 'C:/theme/a.svg' }
          : {
              kind: 'font',
              fontId: 'seti',
              character: 'X',
              color: '#519aba',
              fontFsPath: 'C:/theme/seti.woff',
            },
      resolveFolder: (expanded) =>
        expanded
          ? { kind: 'codicon', id: 'folder-opened' }
          : { kind: 'codicon', id: 'folder' },
      toWebviewUri: (fsPath) => `webview:${fsPath}`,
    });

    expect(payload.files['a.ts']).toEqual({
      kind: 'theme',
      uri: 'webview:C:/theme/a.svg',
    });
    expect(payload.files['b.ts']).toEqual({
      kind: 'font',
      fontId: 'seti',
      character: 'X',
      color: '#519aba',
    });
    expect(payload.fonts).toEqual([{ id: 'seti', uri: 'webview:C:/theme/seti.woff' }]);
    expect(payload.folder).toEqual({ kind: 'codicon', id: 'folder' });
  });
});

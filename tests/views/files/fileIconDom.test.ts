import { describe, expect, it } from 'vitest';
import type { FileIconRef } from '../../../src/protocol/filesMessages';
import {
  CODICON_PATHS,
  copySlotAttribute,
  describeFileIcon,
  fileIconFontFaceCss,
} from '../../../src/views/files/fileIconDom';

describe('fileIconFontFaceCss', () => {
  it('returns empty string for no fonts', () => {
    expect(fileIconFontFaceCss([])).toBe('');
  });

  it('emits @font-face per font id and uri', () => {
    const css = fileIconFontFaceCss([
      { id: 'seti', uri: 'https://example.test/seti.woff' },
      { id: 'other', uri: 'https://example.test/other.ttf' },
    ]);
    expect(css).toContain('@font-face');
    expect(css).toContain('font-family:"seti"');
    expect(css).toContain('url("https://example.test/seti.woff")');
    expect(css).toContain('font-family:"other"');
    expect(css).toContain('url("https://example.test/other.ttf")');
  });

  it('escapes double quotes in font id and uri', () => {
    const css = fileIconFontFaceCss([{ id: 'a"b', uri: 'https://x.test/a"b.woff' }]);
    expect(css).toContain('font-family:"a\\"b"');
    expect(css).toContain('url("https://x.test/a\\"b.woff")');
  });
});

describe('describeFileIcon', () => {
  it('describes theme icons as img', () => {
    const icon: FileIconRef = { kind: 'theme', uri: 'https://cdn.test/icon.png' };
    expect(describeFileIcon(icon)).toEqual({
      mode: 'img',
      src: 'https://cdn.test/icon.png',
    });
  });

  it('describes font icons with optional color', () => {
    expect(
      describeFileIcon({
        kind: 'font',
        fontId: 'seti',
        character: '\\E001',
      }),
    ).toEqual({
      mode: 'font',
      fontId: 'seti',
      character: '\\E001',
    });

    expect(
      describeFileIcon({
        kind: 'font',
        fontId: 'seti',
        character: 'A',
        color: '#ff00aa',
      }),
    ).toEqual({
      mode: 'font',
      fontId: 'seti',
      character: 'A',
      color: '#ff00aa',
    });
  });

  it('describes codicon icons as svg with known ids', () => {
    expect(describeFileIcon({ kind: 'codicon', id: 'file' })).toEqual({
      mode: 'svg',
      codiconId: 'file',
    });
    expect(describeFileIcon({ kind: 'codicon', id: 'folder' })).toEqual({
      mode: 'svg',
      codiconId: 'folder',
    });
    expect(describeFileIcon({ kind: 'codicon', id: 'folder-opened' })).toEqual({
      mode: 'svg',
      codiconId: 'folder-opened',
    });
  });

  it('passes through unknown codicon ids', () => {
    expect(describeFileIcon({ kind: 'codicon', id: 'debug-alt' })).toEqual({
      mode: 'svg',
      codiconId: 'debug-alt',
    });
  });
});

describe('CODICON_PATHS', () => {
  it('includes paths for file, folder, and folder-opened', () => {
    expect(CODICON_PATHS.file.length).toBeGreaterThan(10);
    expect(CODICON_PATHS.folder.length).toBeGreaterThan(10);
    expect(CODICON_PATHS['folder-opened'].length).toBeGreaterThan(10);
  });
});

describe('copySlotAttribute', () => {
  it('copies slot when present', () => {
    const fromAttrs = new Map([['slot', 'icon-branch']]);
    const toAttrs = new Map<string, string>();
    const from = {
      getAttribute: (name: string) => fromAttrs.get(name) ?? null,
    } as Element;
    const to = {
      getAttribute: (name: string) => toAttrs.get(name) ?? null,
      setAttribute: (name: string, value: string) => {
        toAttrs.set(name, value);
      },
    } as Element;

    copySlotAttribute(from, to);
    expect(toAttrs.get('slot')).toBe('icon-branch');
  });

  it('does nothing when source has no slot', () => {
    const toAttrs = new Map<string, string>();
    const from = { getAttribute: () => null } as Element;
    const to = {
      getAttribute: (name: string) => toAttrs.get(name) ?? null,
      setAttribute: (name: string, value: string) => {
        toAttrs.set(name, value);
      },
    } as Element;

    copySlotAttribute(from, to);
    expect(toAttrs.size).toBe(0);
  });
});

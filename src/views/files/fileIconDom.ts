import type { FileIconRef } from '../../protocol/filesMessages';

const SVG_NS = 'http://www.w3.org/2000/svg';

export const CODICON_PATHS = {
  file: 'M5 1C3.89543 1 3 1.89543 3 3V13C3 14.1046 3.89543 15 5 15H11C12.1046 15 13 14.1046 13 13V5.41421C13 5.01639 12.842 4.63486 12.5607 4.35355L9.64645 1.43934C9.36514 1.15804 8.98361 1 8.58579 1H5ZM4 3C4 2.44772 4.44772 2 5 2H8V4.5C8 5.32843 8.67157 6 9.5 6H12V13C12 13.5523 11.5523 14 11 14H5C4.44772 14 4 13.5523 4 13V3ZM11.7929 5H9.5C9.22386 5 9 4.77614 9 4.5V2.20711L11.7929 5Z',
  folder:
    'M2 4.5V6H5.58579C5.71839 6 5.84557 5.94732 5.93934 5.85355L7.29289 4.5L5.93934 3.14645C5.84557 3.05268 5.71839 3 5.58579 3H3.5C2.67157 3 2 3.67157 2 4.5ZM1 4.5C1 3.11929 2.11929 2 3.5 2H5.58579C5.98361 2 6.36514 2.15804 6.64645 2.43934L8.20711 4H12.5C13.8807 4 15 5.11929 15 6.5V11.5C15 12.8807 13.8807 14 12.5 14H3.5C2.11929 14 1 12.8807 1 11.5V4.5ZM2 7V11.5C2 12.3284 2.67157 13 3.5 13H12.5C13.3284 13 14 12.3284 14 11.5V6.5C14 5.67157 13.3284 5 12.5 5H8.20711L6.64645 6.56066C6.36514 6.84197 5.98361 7 5.58579 7H2Z',
  'folder-opened':
    'M2 4.5V9.10022L2.92389 7.5C3.45979 6.5718 4.45017 6 5.52196 6L11.9146 6C11.7087 5.4174 11.1531 5 10.5 5H7C6.86739 5 6.74021 4.94732 6.64645 4.85355L4.93934 3.14645C4.84557 3.05268 4.71839 3 4.58579 3H3.5C2.67157 3 2 3.67157 2 4.5ZM7.06895 13.9953C7.04641 13.9984 7.02339 14 7 14H3.5C2.11929 14 1 12.8807 1 11.5V4.5C1 3.11929 2.11929 2 3.5 2H4.58579C4.98361 2 5.36514 2.15804 5.64645 2.43934L7.20711 4H10.5C11.724 4 12.7426 4.87965 12.958 6.04127C14.605 6.34148 15.5443 8.22106 14.6616 9.75L13.0766 12.4953C12.5407 13.4235 11.5503 13.9953 10.4785 13.9953H7.06895ZM5.52196 7C4.80743 7 4.14718 7.3812 3.78991 8L2.20492 10.7453C1.62757 11.7453 2.34926 12.9953 3.50396 12.9953L10.4785 12.9953C11.193 12.9953 11.8533 12.6141 12.2105 11.9953L13.7955 9.25C14.3729 8.25 13.6512 7 12.4965 7L5.52196 7Z',
} as const;

export type FileIconDescriptor =
  | { mode: 'img'; src: string }
  | { mode: 'font'; fontId: string; character: string; color?: string }
  | { mode: 'svg'; codiconId: string };

function escapeCssString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function fileIconFontFaceCss(fonts: Array<{ id: string; uri: string }>): string {
  if (fonts.length === 0) {
    return '';
  }
  return fonts
    .map(
      (font) =>
        `@font-face{font-family:"${escapeCssString(font.id)}";src:url("${escapeCssString(font.uri)}");font-weight:normal;font-style:normal;font-display:block;}`,
    )
    .join('\n');
}

export function describeFileIcon(icon: FileIconRef): FileIconDescriptor {
  switch (icon.kind) {
    case 'theme':
      return { mode: 'img', src: icon.uri };
    case 'font':
      return {
        mode: 'font',
        fontId: icon.fontId,
        character: icon.character,
        ...(icon.color !== undefined ? { color: icon.color } : {}),
      };
    case 'codicon':
      return { mode: 'svg', codiconId: icon.id };
  }
}

function codiconPathData(id: string): string {
  if (id === 'file' || id === 'folder' || id === 'folder-opened') {
    return CODICON_PATHS[id];
  }
  return CODICON_PATHS.file;
}

function createCodiconSvg(document: Document, codiconId: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('file-icon');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', codiconPathData(codiconId));
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  return svg;
}

export type CreateFileIconOptions = {
  /** When a theme image fails to load, replace with this icon (typically codicon). */
  imgErrorFallback?: FileIconRef;
};

export function createFileIconElement(
  icon: FileIconRef,
  document: Document,
  options?: CreateFileIconOptions,
): HTMLElement {
  const described = describeFileIcon(icon);

  if (described.mode === 'img') {
    const img = document.createElement('img');
    img.className = 'file-icon file-icon-img';
    img.src = described.src;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    const fallback = options?.imgErrorFallback;
    if (fallback !== undefined) {
      img.addEventListener(
        'error',
        () => {
          img.replaceWith(createFileIconElement(fallback, document));
        },
        { once: true },
      );
    }
    return img;
  }

  if (described.mode === 'font') {
    const span = document.createElement('span');
    span.className = 'file-icon file-icon-font';
    span.setAttribute('aria-hidden', 'true');
    span.style.fontFamily = `"${described.fontId}"`;
    if (described.color !== undefined) {
      span.style.color = described.color;
    }
    span.textContent = described.character;
    return span;
  }

  return createCodiconSvg(document, described.codiconId);
}

export const FILE_ICON_FONTS_STYLE_ID = 'gitgress-file-icon-fonts';

export function ensureFileIconFontFaces(
  document: Document,
  fonts: Array<{ id: string; uri: string }>,
): void {
  const css = fileIconFontFaceCss(fonts);
  let style = document.getElementById(FILE_ICON_FONTS_STYLE_ID) as HTMLStyleElement | null;
  if (style === null) {
    style = document.createElement('style');
    style.id = FILE_ICON_FONTS_STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css;
}

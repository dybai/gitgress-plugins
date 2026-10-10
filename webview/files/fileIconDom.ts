import type { FileIconRef } from '../../src/protocol/filesMessages';
import {
  codiconPathData,
  copySlotAttribute,
  describeFileIcon,
  fileIconFontFaceCss,
} from '../../src/views/files/fileIconDom';

const SVG_NS = 'http://www.w3.org/2000/svg';

export type CreateFileIconOptions = {
  /** When a theme image fails to load, replace with this icon (typically codicon). */
  imgErrorFallback?: FileIconRef;
};

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
          const replacement = createFileIconElement(fallback, document);
          copySlotAttribute(img, replacement);
          img.replaceWith(replacement);
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

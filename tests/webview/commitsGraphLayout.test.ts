import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const webviewDir = join(process.cwd(), 'webview');
const source = readFileSync(join(webviewDir, 'commits.js'), 'utf8');
const html = readFileSync(join(webviewDir, 'commits.html'), 'utf8');
const css = readFileSync(join(webviewDir, 'commits.css'), 'utf8');

describe('commits graph DOM layout', () => {
  it('positions graph nodes from each commit row instead of the button offset parent', () => {
    expect(source).toMatch(
      /button\.closest\(['"]\.commit['"]\)\?\.offsetTop\s*\+\s*button\.offsetHeight\s*\/\s*2/,
    );
  });

  it('measures the real list content bottom without using SVG-inflated scrollHeight', () => {
    expect(source).toMatch(
      /lastCommit\.offsetTop\s*\+\s*lastCommit\.offsetHeight/,
    );
    expect(source).not.toMatch(/const height = commitList\.scrollHeight/);
  });
});

describe('commits hover overlay assets', () => {
  it('declares a single body-level hover card in HTML', () => {
    expect(html.match(/id="hover-card"/g)?.length).toBe(1);
  });

  it('uses fixed overlay hover card CSS without in-flow hover display rule', () => {
    expect(css).toMatch(/\.hover-card\s*\{[\s\S]*position:\s*fixed/);
    expect(css).not.toMatch(/\.commit:hover\s+\.hover-card/);
  });
});

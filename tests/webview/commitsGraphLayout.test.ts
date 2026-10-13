import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const webviewDir = join(process.cwd(), 'webview', 'commits');
const source = readFileSync(join(webviewDir, 'main.js'), 'utf8');
const html = readFileSync(join(webviewDir, 'index.html'), 'utf8');
const css = readFileSync(join(webviewDir, 'styles.css'), 'utf8');

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

  it('routes fork edges horizontally through their allocated lane', () => {
    expect(source).toMatch(/const viaX = laneX\(edge\.viaLane\)/);
    expect(source).toMatch(
      /M \$\{fromX\} \$\{fromY\} H \$\{viaX\} V \$\{toY\} H \$\{toX\}/,
    );
  });
});

describe('commits hover overlay assets', () => {
  it('declares a single body-level hover card in HTML', () => {
    expect(html.match(/id="hover-card"/g)?.length).toBe(1);
  });

  it('uses fixed overlay hover card CSS without in-flow hover display rule', () => {
    expect(css).toMatch(/\.hover-card\s*\{[\s\S]*position:\s*fixed/);
    expect(css).toMatch(/\.hover-card\s*\{[\s\S]*max-height:\s*50vh/);
    expect(css).not.toMatch(/\.commit:hover\s+\.hover-card/);
  });

  it('delays first hover open and hover switch', () => {
    expect(source).toMatch(/HOVER_OPEN_DELAY_MS\s*=\s*500/);
    expect(source).toMatch(/HOVER_SWITCH_DELAY_MS\s*=\s*200/);
    expect(source).toMatch(/scheduleShowHover/);
  });
});

describe('commits window edge pagination', () => {
  it('posts loadNewer and reads hasNewer near the top edge', () => {
    expect(source).toMatch(/lastHasNewer/);
    expect(source).toMatch(/loadNewerSent/);
    expect(source).toMatch(/nearTop/);
    expect(source).toMatch(/scrollTop\s*<\s*80/);
    expect(source).toMatch(/type:\s*['"]loadNewer['"]/);
    expect(source).toMatch(/data\.hasNewer/);
  });

  it('preserves scroll position when prepending commits', () => {
    expect(source).toMatch(/isPrependingReplacement/);
    expect(source).toMatch(
      /scrollTop\s*=\s*savedScroll\.top\s*\+\s*\(\s*el\.scrollHeight\s*-\s*savedScroll\.height\s*\)/,
    );
  });
});

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

  it('routes fork edges through viaLane with rounded corner helper', () => {
    expect(source).toMatch(/const viaX = laneX\(edge\.viaLane\)/);
    expect(source).toMatch(
      /roundedEdgePath\(fromX, fromY, viaX, toX, toY, CORNER_RADIUS\)/,
    );
  });

  it('sets per-row graph gutter from occupied lanes instead of global laneCount', () => {
    expect(source).toMatch(/occupiedLaneMaxForRow\(row, message\.commits, message\.edges\)/);
    expect(source).toMatch(/rowGraphWidth\(/);
    expect(source).toMatch(
      /button\.style\.setProperty\(\s*['"]--graph-width['"]/,
    );
    expect(source).not.toMatch(
      /commitList\.style\.setProperty\(\s*['"]--graph-width['"]/,
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

describe('commits ref pills tags and overflow', () => {
  it('uses nowrap ref-pills and tag/more styles', () => {
    expect(css).toMatch(/\.ref-pills\s*\{[\s\S]*flex-wrap:\s*nowrap/);
    expect(css).toMatch(/\.ref-pill-tag\s*\{/);
    expect(css).toMatch(/\.ref-pill-more\s*\{/);
    expect(css).toMatch(/\.ref-pill\[hidden\]\s*\{[^}]*display:\s*none/);
  });

  it('packs pills and renders hover card ref pills', () => {
    expect(source).toMatch(/packRefPills/);
    expect(source).toMatch(/orderedSecondaryRefs/);
    expect(source).toMatch(/ref-pill-tag/);
    expect(source).toMatch(/ref-pill-more/);
    expect(source).toMatch(/card-refs|hover.*ref-pill/);
    expect(source).not.toMatch(/branchLine\.textContent\s*=\s*branch/);
  });
});

describe('commits sticky chrome', () => {
  it('keeps scan progress and branch header outside a dedicated list scroller', () => {
    expect(html).toMatch(
      /id="scan-progress"[\s\S]*class="branch-header(?: hidden)?"[\s\S]*id="commit-scroll"[\s\S]*id="commit-list"/,
    );
    expect(html).not.toMatch(
      /id="commit-scroll"[\s\S]*class="branch-header/,
    );
  });

  it('fills the webview with flex layout and scrolls only the commit region', () => {
    expect(css).toMatch(/html\s*,\s*body[\s\S]*?height:\s*100%/);
    expect(css).toMatch(/body\s*\{[\s\S]*?overflow:\s*hidden/);
    expect(css).toMatch(/main\s*\{[\s\S]*?display:\s*flex/);
    expect(css).toMatch(/\.content\s*\{[\s\S]*?flex:\s*1/);
    expect(css).toMatch(/\.commit-scroll\s*\{[\s\S]*?overflow:\s*auto/);
  });

  it('overrides the injected body padding so the list scrollbar hugs the right edge', () => {
    expect(css).toMatch(
      /html\s+body\s*\{[^}]*padding-right:\s*0\s*;/,
    );
  });

  it('owns list scroll on #commit-scroll for pagination, anchoring, and page keys', () => {
    expect(source).toMatch(
      /scrollContainer\s*=\s*\(\)\s*=>\s*document\.querySelector\(['"]#commit-scroll['"]\)/,
    );
    expect(source).toMatch(
      /scrollContainer\(\)\.addEventListener\(\s*['"]scroll['"]/,
    );
    expect(source).toMatch(
      /scrollContainer\(\)\.getBoundingClientRect\(\)/,
    );
    expect(source).toMatch(/scrollContainer\(\)\.clientHeight/);
    expect(source).not.toMatch(
      /scrollContainer\s*=\s*\(\)\s*=>\s*document\.scrollingElement/,
    );
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

  it('anchors replace renders by commit id instead of list length', () => {
    expect(source).toMatch(/captureScrollAnchor/);
    expect(source).toMatch(/restoreScrollAnchor/);
    expect(source).toMatch(/chooseScrollAnchorId/);
    expect(source).toMatch(/anchoredScrollTop/);
    expect(source).not.toMatch(/isGrowingReplacement/);
    expect(source).not.toMatch(/isPrependingReplacement/);
  });

  it('suppresses automatic edge requests after an edge-load response', () => {
    expect(source).toMatch(/suppressEdgeRequestsUntilUserScroll/);
    expect(source).toMatch(/completedEdgeLoad/);
    expect(source).toMatch(/resumeEdgeRequestsForUserScroll/);
  });
});

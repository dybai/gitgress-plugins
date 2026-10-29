import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync('webview/commits/index.html', 'utf8');
const css = readFileSync('webview/commits/styles.css', 'utf8');
const js = readFileSync('webview/commits/main.js', 'utf8');

describe('commits webview markup', () => {
  it('keeps the branch header outside the hideable content section', () => {
    const headerIndex = html.indexOf('class="branch-header');
    const contentIndex = html.indexOf('id="content"');
    expect(headerIndex).toBeGreaterThan(-1);
    expect(contentIndex).toBeGreaterThan(-1);
    expect(headerIndex).toBeLessThan(contentIndex);
  });

  it('starts hidden with the Select repository placeholder and a hidden branch control', () => {
    expect(html).toContain('class="branch-header hidden"');
    expect(html).toContain('>Select repository</span>');
    expect(html).toMatch(/id="branch-switch"[^>]*hidden/);
  });

  it('lets attribute and class hiding win over the header/button display rules', () => {
    // `!important` is load-bearing: `.branch-switch` / `.repo-name` set
    // `display: inline-flex` with the same specificity (single class) and are
    // defined later in styles.css, so without `!important` the hidden branch
    // button would stay visible in the noSelection empty state while the
    // suite remained green.
    expect(css).toMatch(/\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
    expect(css).toMatch(/\.branch-header\.hidden\s*\{[^}]*display:\s*none/s);
  });

  it('renders the header from the shared resolver', () => {
    expect(js).toContain('resolveCommitsHeader');
    expect(js).toContain('applyHeader');
    expect(js).not.toContain('repoName.hidden = false');
  });

  it('wires the header into both the render and empty paths', () => {
    // applyHeader( must be called exactly twice: renderCommits and the `empty`
    // handler. The empty path is what keeps noSelection/noRepo headers correct.
    expect(js.match(/applyHeader\(/g)).toHaveLength(2);
    expect(js).toMatch(/data\.type === 'empty'[\s\S]*?applyHeader\(/);
  });

  it('handles revealCommit by selecting and scrolling the matching row', () => {
    expect(js).toMatch(
      /data\.type === 'revealCommit'[\s\S]*?scrollIntoView\(\{\s*block:\s*'nearest'\s*\}\)/,
    );
  });
});

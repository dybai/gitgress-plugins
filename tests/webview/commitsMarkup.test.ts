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
    expect(css).toMatch(/\[hidden\]\s*\{[^}]*display:\s*none/s);
    expect(css).toMatch(/\.branch-header\.hidden\s*\{[^}]*display:\s*none/s);
  });

  it('renders the header from the shared resolver', () => {
    expect(js).toContain('resolveCommitsHeader');
    expect(js).toContain('applyHeader');
    expect(js).not.toContain('repoName.hidden = false');
  });
});

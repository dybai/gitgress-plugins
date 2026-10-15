import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const webviewDir = join(process.cwd(), 'webview', 'files');
const html = readFileSync(join(webviewDir, 'index.html'), 'utf8');
const css = readFileSync(join(webviewDir, 'styles.css'), 'utf8');

describe('files sticky toolbar', () => {
  it('keeps the toolbar before the scrollable content region', () => {
    expect(html).toMatch(
      /class="toolbar"[\s\S]*id="message"[\s\S]*id="content"/,
    );
  });

  it('fills the webview with flex layout and scrolls only #content', () => {
    expect(css).toMatch(/html\s*,\s*body[\s\S]*?height:\s*100%/);
    expect(css).toMatch(/body\s*\{[\s\S]*?overflow:\s*hidden/);
    expect(css).toMatch(/body\s*\{[\s\S]*?display:\s*flex/);
    expect(css).toMatch(/\.toolbar\s*\{[\s\S]*?flex-shrink:\s*0/);
    expect(css).toMatch(/#content\s*\{[\s\S]*?flex:\s*1/);
    expect(css).toMatch(/#content\s*\{[\s\S]*?overflow:\s*auto/);
  });
});

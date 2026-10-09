import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(process.cwd(), 'webview', 'commits.js'), 'utf8');

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

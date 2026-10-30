import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync('src/extension.ts', 'utf8');

describe('inline blame decoration styling', () => {
  it('uses the ghost-text theme color for the annotation', () => {
    expect(src).toMatch(
      /createTextEditorDecorationType\(\{[\s\S]*?editorGhostText\.foreground/,
    );
  });

  it('keeps an 8px margin between the code and the annotation', () => {
    expect(src).toMatch(
      /createTextEditorDecorationType\(\{[\s\S]*?margin:\s*'0 0 0 8px'/,
    );
  });

  it('renders contentText without space padding', () => {
    expect(src).not.toMatch(/contentText:\s*`\s+\$\{options\[0\]\.contentText\}`/);
  });
});

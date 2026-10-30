import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = readFileSync('src/extension.ts', 'utf8');

describe('inline blame decoration styling', () => {
  it('uses the contributed muted theme color for the annotation', () => {
    expect(src).toMatch(
      /createTextEditorDecorationType\(\{[\s\S]*?gitgress\.blameAnnotationForeground/,
    );
  });

  it('keeps a 50px margin between the code and the annotation', () => {
    expect(src).toMatch(
      /createTextEditorDecorationType\(\{[\s\S]*?margin:\s*'0 0 0 50px'/,
    );
  });

  it('renders contentText without space padding', () => {
    expect(src).not.toMatch(/contentText:\s*`\s+\$\{options\[0\]\.contentText\}`/);
  });
});

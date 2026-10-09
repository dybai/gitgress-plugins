import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('package contributes', () => {
  it('registers Files as a webview view', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const files = pkg.contributes.views.gitgress.find(
      (v: { id: string }) => v.id === 'gitgress.files',
    );
    expect(files).toBeDefined();
    expect(files!.type).toBe('webview');
  });
});

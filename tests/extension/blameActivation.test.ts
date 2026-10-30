import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
  activationEvents: string[];
  contributes: {
    colors:
      | {
          id: string;
          description: string;
          defaults: { dark: string; light: string; highContrast: string };
        }[]
        | undefined;
  };
};

describe('extension activation and blame color token', () => {
  it('activates on startup finished so blame works without focusing the view', () => {
    expect(manifest.activationEvents).toContain('onStartupFinished');
  });

  it('contributes the gitgress.blameAnnotationForeground color with GitLens-matching defaults', () => {
    const color = manifest.contributes.colors?.find(
      (entry) => entry.id === 'gitgress.blameAnnotationForeground',
    );
    expect(color).toBeDefined();
    expect(color?.defaults).toEqual({
      dark: '#99999959',
      light: '#99999959',
      highContrast: '#99999999',
    });
    expect(color?.description).toBe(
      'Foreground color of the inline current-line blame annotation',
    );
  });
});

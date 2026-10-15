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

  it('keeps select/switch commands but not in the view title bar', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(
      pkg.contributes.commands.find(
        (c: { command: string }) => c.command === 'gitgress.selectRepository',
      ),
    ).toEqual({
      command: 'gitgress.selectRepository',
      title: 'GitGress: Select Repository',
      icon: '$(repo)',
    });

    expect(
      pkg.contributes.commands.find(
        (c: { command: string }) => c.command === 'gitgress.switchBranch',
      ),
    ).toEqual({
      command: 'gitgress.switchBranch',
      title: 'GitGress: Switch Branch',
      icon: '$(git-branch)',
    });

    const titleMenus: Array<{ command: string }> = pkg.contributes.menus['view/title'];
    expect(titleMenus.some((m) => m.command === 'gitgress.selectRepository')).toBe(false);
    expect(titleMenus.some((m) => m.command === 'gitgress.switchBranch')).toBe(false);
    expect(titleMenus).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'gitgress.refresh',
          when: 'view == gitgress.commits || view == gitgress.files',
          group: 'navigation',
        }),
      ]),
    );
  });
});

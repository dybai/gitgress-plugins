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

  it('keeps select/switch commands and offers them in the view title bar', () => {
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
  });

  it('gates the title-bar entries by repository context', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const titleMenus: Array<{ command: string; when?: string; group?: string }> =
      pkg.contributes.menus['view/title'];

    expect(titleMenus).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: 'gitgress.selectRepository',
          when: 'view == gitgress.commits && gitgress.hasRepositories',
          group: 'navigation@1',
        }),
        expect.objectContaining({
          command: 'gitgress.switchBranch',
          when: 'view == gitgress.commits && gitgress.hasRepository',
          group: 'navigation@2',
        }),
        expect.objectContaining({
          command: 'gitgress.refresh',
          when: 'view == gitgress.commits || view == gitgress.files',
          group: 'navigation@3',
        }),
      ]),
    );
  });

  it('registers editorBlame settings and hidden blame commands', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const props = pkg.contributes.configuration.properties;
    expect(props['gitgress.editorBlame.enabled']).toMatchObject({
      type: 'boolean',
      default: true,
    });
    expect(props['gitgress.editorBlame.conflictMode']).toMatchObject({
      type: 'string',
      default: 'ask',
    });
    expect(props['gitgress.editorBlame.conflictMode'].enum).toEqual([
      'ask',
      'alwaysShow',
      'defer',
    ]);
    for (const command of ['gitgress.revealFromBlame', 'gitgress.copyBlameHash']) {
      expect(
        pkg.contributes.commands.find((c: { command: string }) => c.command === command),
      ).toBeDefined();
      expect(
        pkg.contributes.menus.commandPalette.find(
          (m: { command: string; when?: string }) => m.command === command,
        ),
      ).toEqual({ command, when: 'false' });
    }
  });
});

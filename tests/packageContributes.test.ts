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

  it('registers select repository command and title-bar menu when repos exist', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const command = pkg.contributes.commands.find(
      (c: { command: string }) => c.command === 'gitgress.selectRepository',
    );
    expect(command).toEqual({
      command: 'gitgress.selectRepository',
      title: 'GitGress: Select Repository',
      icon: '$(repo)',
    });

    const menu = pkg.contributes.menus['view/title'].find(
      (m: { command: string }) => m.command === 'gitgress.selectRepository',
    );
    expect(menu).toMatchObject({
      command: 'gitgress.selectRepository',
      when: 'view == gitgress.commits && gitgress.hasRepositories',
      group: 'navigation',
    });
  });
});

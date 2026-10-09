import { describe, expect, it } from 'vitest';
import { shouldAllowOpenWorkingFile } from '../../src/commands/workingFile';
import {
  fileTooltip,
  formatAdditions,
  formatDeletions,
  isOpenDisabled,
  layoutButtonCaption,
  layoutButtonLabel,
  layoutIconKind,
} from '../../src/views/files/fileRowModel';

describe('fileTooltip', () => {
  it('joins repo root, path and status label on two lines', () => {
    expect(fileTooltip('/repo', 'src/a.ts', 'M')).toBe('/repo/src/a.ts\nModified');
  });

  it('normalizes Windows separators and trailing slashes', () => {
    expect(fileTooltip('C:\\work\\repo\\', 'src/a.ts', 'A')).toBe(
      'C:/work/repo/src/a.ts\nAdded',
    );
  });

  it('falls back to raw status for unknown codes', () => {
    expect(fileTooltip('/repo', 'a.ts', 'T')).toBe('/repo/a.ts\nT');
  });
});

describe('isOpenDisabled', () => {
  it('disables Open only for deleted files', () => {
    expect(isOpenDisabled('D')).toBe(true);
    expect(isOpenDisabled('M')).toBe(false);
    expect(isOpenDisabled('A')).toBe(false);
  });

  it('stays consistent with the host-side rule', () => {
    for (const status of ['A', 'M', 'D', 'R', 'C', 'T']) {
      expect(isOpenDisabled(status)).toBe(!shouldAllowOpenWorkingFile(status));
    }
  });
});

describe('stat formatting', () => {
  it('formats additions and deletions with +/− prefixes', () => {
    expect(formatAdditions(3)).toBe('+3');
    expect(formatDeletions(5)).toBe('\u22125');
    expect(formatAdditions(0)).toBe('+0');
  });
});

describe('layoutButtonLabel', () => {
  it('describes the current preference and the next one', () => {
    expect(layoutButtonLabel('auto', 'tree')).toBe(
      'Layout: Auto (showing tree). Click for list.',
    );
    expect(layoutButtonLabel('list', 'list')).toBe('Layout: List. Click for tree.');
    expect(layoutButtonLabel('tree', 'tree')).toBe('Layout: Tree. Click for auto.');
  });
});

describe('layout preference chrome', () => {
  it('maps the toolbar icon and caption to preference, not effective layout', () => {
    expect(layoutIconKind('auto')).toBe('auto');
    expect(layoutIconKind('list')).toBe('list');
    expect(layoutIconKind('tree')).toBe('tree');
    expect(layoutButtonCaption('auto')).toBe('Auto');
    expect(layoutButtonCaption('list')).toBe('List');
    expect(layoutButtonCaption('tree')).toBe('Tree');
  });
});

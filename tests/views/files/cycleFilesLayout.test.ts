import { describe, expect, it } from 'vitest';
import { cycleFilesLayout } from '../../../src/views/files/cycleFilesLayout';

describe('cycleFilesLayout', () => {
  it('cycles auto → list → tree → auto', () => {
    expect(cycleFilesLayout('auto')).toBe('list');
    expect(cycleFilesLayout('list')).toBe('tree');
    expect(cycleFilesLayout('tree')).toBe('auto');
  });
});

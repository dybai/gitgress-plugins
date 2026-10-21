import { describe, expect, it, vi } from 'vitest';
import {
  HAS_REPOSITORY_CONTEXT_KEY,
  publishHasRepository,
} from '../../src/extension/repositoryContext.js';

describe('publishHasRepository', () => {
  it('writes the context through the setContext command', () => {
    const executeCommand = vi.fn();
    publishHasRepository(executeCommand, true);
    expect(executeCommand).toHaveBeenCalledWith(
      'setContext',
      HAS_REPOSITORY_CONTEXT_KEY,
      true,
    );
  });

  it('clears the context when no repository is selected', () => {
    const executeCommand = vi.fn();
    publishHasRepository(executeCommand, false);
    expect(executeCommand).toHaveBeenCalledWith(
      'setContext',
      HAS_REPOSITORY_CONTEXT_KEY,
      false,
    );
  });

  it('uses the key referenced by the view/title menu gate', () => {
    expect(HAS_REPOSITORY_CONTEXT_KEY).toBe('gitgress.hasRepository');
  });
});

export const HAS_REPOSITORY_CONTEXT_KEY = 'gitgress.hasRepository';

export type ExecuteCommand = (command: string, ...args: unknown[]) => unknown;

/**
 * Publish whether a repository is selected. Context keys are written through
 * the built-in `setContext` command; passing the key itself as the command id
 * would reject with "command not found".
 */
export function publishHasRepository(
  executeCommand: ExecuteCommand,
  hasRepository: boolean,
): void {
  void executeCommand('setContext', HAS_REPOSITORY_CONTEXT_KEY, hasRepository);
}

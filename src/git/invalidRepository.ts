import { GitCommandFailedError, NotARepositoryError } from './errors';

/**
 * True when Git failure indicates the selected repository root is missing or
 * not a valid Git repository (as opposed to transient or command-specific errors).
 */
export function isInvalidSelectedRepositoryError(error: unknown): boolean {
  if (error instanceof NotARepositoryError) {
    return true;
  }
  if (!(error instanceof GitCommandFailedError)) {
    return false;
  }
  const stderr = error.stderr.toLowerCase();
  if (stderr.includes('not a git repository') || stderr.includes('not a valid git repository')) {
    return true;
  }
  if (stderr.includes('no such file or directory')) {
    const cmd = error.args[0];
    return cmd === 'branch' || cmd === 'for-each-ref' || cmd === 'rev-parse';
  }
  return false;
}

import { GitCommandFailedError } from '../git/errors';
import type { SelectionCoordinator } from '../state/SelectionCoordinator';

export type SelectionRecoveryDeps = {
  coordinator: Pick<SelectionCoordinator, 'clearSelection'>;
  showError: (error: unknown) => Promise<void>;
};

/**
 * Run a Git-backed action for the current selection. On failure, clear the
 * selection through the coordinator (so its lock state stays consistent with
 * SelectionState) and report the error. A failed command for a specific repo
 * also forgets a matching manual preference; global failures keep it.
 */
export async function runWithSelectionRecovery(
  deps: SelectionRecoveryDeps,
  action: () => Promise<void>,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    deps.coordinator.clearSelection({
      forgetPreference: error instanceof GitCommandFailedError,
    });
    await deps.showError(error);
  }
}

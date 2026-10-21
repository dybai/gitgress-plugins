import type { HostToWebview } from '../../protocol/messages.js';
import type { EmptyRepoReason } from './emptyRepoReason.js';

export type EmptyMessage = Extract<HostToWebview, { type: 'empty' }>;

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value !== '';
}

/**
 * Build an `empty` message, attaching the known repository/branch so the
 * webview header can still offer Select Repository / Switch Branch.
 */
export function buildEmptyMessage(input: {
  reason: EmptyRepoReason | 'noCommits' | 'error';
  repoRoot?: string | null;
  branch?: string | null;
  message?: string;
}): EmptyMessage {
  const message: EmptyMessage = { type: 'empty', reason: input.reason };
  if (nonEmpty(input.repoRoot)) {
    message.repoRoot = input.repoRoot;
  }
  if (nonEmpty(input.branch)) {
    message.branch = input.branch;
  }
  if (input.message !== undefined) {
    message.message = input.message;
  }
  return message;
}

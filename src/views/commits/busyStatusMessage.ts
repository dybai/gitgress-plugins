import type { HostToWebview } from '../../protocol/messages';

/**
 * Build the host-to-webview message that toggles the shared busy indicator
 * bar in the Commits webview. Pure helper so the message shape can be
 * unit-tested without vscode mocks.
 */
export function busyStatusMessage(
  active: boolean,
): Extract<HostToWebview, { type: 'busyStatus' }> {
  return { type: 'busyStatus', active };
}

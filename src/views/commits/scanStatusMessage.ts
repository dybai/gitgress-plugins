import type { HostToWebview } from '../../protocol/messages';

export type ScanStatus = 'idle' | 'scanning';

/**
 * Build the host-to-webview message that toggles the indeterminate scan
 * progress bar in the Commits webview. Pure helper so the message shape can
 * be unit-tested without vscode mocks.
 */
export function scanStatusMessage(
  status: ScanStatus,
): Extract<HostToWebview, { type: 'scanStatus' }> {
  return { type: 'scanStatus', status };
}

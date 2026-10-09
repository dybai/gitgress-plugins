// Stub UI for Task 5; replaced by vscode-elements UI in Task 6.
declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const vscode = acquireVsCodeApi();
const root = document.getElementById('root');

window.addEventListener('message', (event: MessageEvent) => {
  if (root !== null) {
    root.textContent = JSON.stringify(event.data, null, 2);
  }
});

vscode.postMessage({ type: 'ready' });

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type * as vscode from 'vscode';
import type { GitService } from '../../../src/git/GitService';
import { SelectionState } from '../../../src/state/SelectionState';

const { writeText } = vi.hoisted(() => ({
  writeText: vi.fn(async (_text: string) => {}),
}));

vi.mock('vscode', () => ({
  Uri: {
    joinPath: () => ({ fsPath: 'fake-commits.html' }),
  },
  env: {
    clipboard: {
      writeText,
    },
  },
}));

vi.mock('node:fs', () => ({
  readFileSync: () => '<html>{{cspSource}} {{styleUri}} {{scriptUri}}</html>',
}));

import { CommitsViewProvider } from '../../../src/views/commits/CommitsViewProvider';

type MessageHandler = (message: unknown) => void;

const COMMIT_ID = 'a'.repeat(40);

function makeFakeView() {
  const postMessage = vi.fn(async (_message: unknown) => true);
  const messageHandlers: MessageHandler[] = [];
  const view = {
    webview: {
      cspSource: '*',
      asWebviewUri: (uri: unknown) => ({
        toString: () => `fake://${JSON.stringify(uri)}`,
      }),
      onDidReceiveMessage: (handler: MessageHandler) => {
        messageHandlers.push(handler);
      },
      postMessage,
    },
    onDidDispose: (_handler: () => void) => {},
  };
  return { view, postMessage, messageHandlers };
}

function makeHarness() {
  const git = {
    log: vi.fn(async () => [
      {
        id: COMMIT_ID,
        parentIds: [],
        subject: 'Add copy button',
        authorName: 'Ann',
        authorDateIso: '2026-10-29T00:00:00Z',
        fullMessage: 'Add copy button',
        additions: 3,
        deletions: 1,
      },
    ]),
    logOlderThan: vi.fn(async () => []),
    logNewerThan: vi.fn(async () => []),
    isCommitOnBranch: vi.fn(async () => true),
    resolveTip: vi.fn(async () => COMMIT_ID),
    listTips: vi.fn(async () => []),
  } as unknown as GitService;
  const selection = new SelectionState();
  const provider = new CommitsViewProvider({} as vscode.Uri, selection, git);
  const { view, postMessage, messageHandlers } = makeFakeView();
  provider.resolveWebviewView(view as unknown as vscode.WebviewView);
  return { selection, postMessage, messageHandlers };
}

async function loadSingleCommitWindow(harness: ReturnType<typeof makeHarness>) {
  harness.selection.setRepo('/repo');
  harness.selection.setBranch('main');
  await vi.waitFor(() => {
    expect(harness.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'commitsLoaded' }),
    );
  });
}

describe('CommitsViewProvider copyCommitHash', () => {
  beforeEach(() => {
    writeText.mockClear();
  });

  it('writes the full hash for a commit in the loaded window', async () => {
    const harness = makeHarness();
    await loadSingleCommitWindow(harness);

    harness.messageHandlers[0]({ type: 'copyCommitHash', commitId: COMMIT_ID });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(COMMIT_ID);
  });

  it('ignores hashes outside the loaded window', async () => {
    const harness = makeHarness();
    await loadSingleCommitWindow(harness);

    harness.messageHandlers[0]({
      type: 'copyCommitHash',
      commitId: 'b'.repeat(40),
    });

    expect(writeText).not.toHaveBeenCalled();
  });

  it('drops malformed messages before handling', async () => {
    const harness = makeHarness();
    await loadSingleCommitWindow(harness);

    harness.messageHandlers[0]({ type: 'copyCommitHash', commitId: '' });

    expect(writeText).not.toHaveBeenCalled();
  });

  it('survives clipboard write rejections', async () => {
    const harness = makeHarness();
    await loadSingleCommitWindow(harness);
    writeText.mockRejectedValueOnce(new Error('clipboard denied'));

    harness.messageHandlers[0]({ type: 'copyCommitHash', commitId: COMMIT_ID });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(writeText).toHaveBeenCalledWith(COMMIT_ID);
  });
});

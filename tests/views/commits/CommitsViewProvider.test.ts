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

function makeBusy() {
  const releases: Array<() => void> = [];
  const listeners = new Set<(active: boolean) => void>();
  return {
    acquire: vi.fn(() => {
      const release = () => {
        const index = releases.indexOf(release);
        if (index >= 0) {
          releases.splice(index, 1);
        }
      };
      releases.push(release);
      return release;
    }),
    subscribe: (listener: (active: boolean) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getActive: () => releases.length > 0,
    listeners,
  };
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
  const busy = makeBusy();
  const provider = new CommitsViewProvider(
    {} as vscode.Uri,
    selection,
    git,
    busy,
  );
  const { view, postMessage, messageHandlers } = makeFakeView();
  provider.resolveWebviewView(view as unknown as vscode.WebviewView);
  return { selection, postMessage, messageHandlers, provider, git, busy };
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

describe('CommitsViewProvider revealCommit', () => {
  it('posts revealCommit when the id is already loaded', async () => {
    const harness = makeHarness();
    await loadSingleCommitWindow(harness);
    harness.postMessage.mockClear();

    await harness.provider.revealCommit(COMMIT_ID);

    expect(harness.postMessage).toHaveBeenCalledWith({
      type: 'revealCommit',
      commitId: COMMIT_ID,
    });
  });

  it('rebuilds the window when the id is on the branch but not loaded', async () => {
    const olderId = 'b'.repeat(40);
    const harness = makeHarness();
    await loadSingleCommitWindow(harness);
    harness.git.isCommitOnBranch.mockResolvedValue(true);
    harness.git.log.mockImplementation(async (_root: string, ref: string) => {
      if (ref === olderId) {
        return [
          {
            id: olderId,
            parentIds: [],
            subject: 'Older',
            authorName: 'Ann',
            authorDateIso: '2026-10-01T00:00:00Z',
            fullMessage: 'Older',
            additions: 1,
            deletions: 0,
          },
        ];
      }
      return [
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
      ];
    });
    harness.git.logOlderThan.mockResolvedValue([]);
    harness.postMessage.mockClear();

    await harness.provider.revealCommit(olderId);

    await vi.waitFor(() => {
      expect(harness.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'commitsLoaded',
          selectedCommitId: olderId,
        }),
      );
    });
  });

  it('shows an error empty state when the commit is not on the branch', async () => {
    const harness = makeHarness();
    await loadSingleCommitWindow(harness);
    harness.git.isCommitOnBranch.mockResolvedValue(false);
    harness.postMessage.mockClear();

    await harness.provider.revealCommit('c'.repeat(40));

    expect(harness.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'empty',
        reason: 'error',
        message: 'Commit is not on the current branch',
      }),
    );
  });
});

describe('CommitsViewProvider branch resolution empty state', () => {
  it('posts noBranch instead of noCommits while the branch is unresolved', async () => {
    const harness = makeHarness();
    harness.selection.setRepo('/repo');

    await vi.waitFor(() => {
      expect(harness.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'empty', reason: 'noBranch' }),
      );
    });
    expect(harness.postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'empty', reason: 'noCommits' }),
    );
  });
});

describe('CommitsViewProvider busy indicator', () => {
  it('holds the indicator during load and releases at a terminal state', async () => {
    const harness = makeHarness();
    await loadSingleCommitWindow(harness);

    expect(harness.busy.acquire).toHaveBeenCalledTimes(1);
    expect(harness.busy.getActive()).toBe(false);
  });

  it('releases the indicator when the load fails', async () => {
    const harness = makeHarness();
    harness.git.log.mockRejectedValue(new Error('git failed'));
    harness.selection.setRepo('/repo');
    harness.selection.setBranch('main');

    await vi.waitFor(() => {
      expect(harness.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'empty', reason: 'error' }),
      );
    });
    expect(harness.busy.getActive()).toBe(false);
  });

  it('does not acquire while the branch is unresolved', async () => {
    const harness = makeHarness();
    harness.selection.setRepo('/repo');

    await vi.waitFor(() => {
      expect(harness.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'empty', reason: 'noBranch' }),
      );
    });
    expect(harness.busy.acquire).not.toHaveBeenCalled();
  });

  it('syncs the busy state on ready and forwards busy transitions', async () => {
    const harness = makeHarness();
    harness.postMessage.mockClear();

    harness.messageHandlers[0]({ type: 'ready' });
    await vi.waitFor(() => {
      expect(harness.postMessage).toHaveBeenCalledWith({
        type: 'busyStatus',
        active: false,
      });
    });

    for (const listener of harness.busy.listeners) {
      listener(true);
    }
    expect(harness.postMessage).toHaveBeenCalledWith({
      type: 'busyStatus',
      active: true,
    });
  });

  it('stops forwarding busy transitions after dispose', async () => {
    const harness = makeHarness();
    harness.provider.dispose();
    harness.postMessage.mockClear();

    for (const listener of harness.busy.listeners) {
      listener(true);
    }

    expect(harness.postMessage).not.toHaveBeenCalledWith({
      type: 'busyStatus',
      active: true,
    });
    expect(harness.busy.listeners.size).toBe(0);
  });
});

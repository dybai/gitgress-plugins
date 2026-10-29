import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlameController, type BlameControllerDeps } from '../../src/blame/BlameController';
import { formatBlameAnnotation } from '../../src/blame/relativeTime';
import type { LineBlame } from '../../src/blame/parseBlamePorcelain';

const COMMIT_ID = 'a'.repeat(40);
const NOW_MS = 1_795_324_800_000; // 2026-10-29T00:00:00Z

function makeBlame(overrides: Partial<LineBlame> = {}): LineBlame {
  return {
    commitId: COMMIT_ID,
    authorName: 'dybai',
    authorTimeUnix: 1000,
    summary: 'feat: thing',
    ...overrides,
  };
}

type EditorFixture = {
  document: {
    uri: { scheme: string; fsPath: string };
    isUntitled: boolean;
    getText: () => string;
  };
  selection: { active: { line: number; character: number } };
};

type Harness = {
  /** Calls recorded as (editor, type, options) from the injected applyDecorations. */
  applied: Array<[unknown, unknown, unknown[]]>;
  blameLine: ReturnType<typeof vi.fn>;
  askConflict: ReturnType<typeof vi.fn>;
  fireSelection: () => void;
  fireActiveEditor: () => void;
  controller: BlameController;
};

function makeEditor(
  overrides: {
    uri?: { scheme: string; fsPath: string };
    isUntitled?: boolean;
    textLength?: number;
    line?: number;
  } = {},
): EditorFixture {
  const uri = overrides.uri ?? { scheme: 'file', fsPath: 'D:/repo/src/file.ts' };
  return {
    document: {
      uri,
      isUntitled: overrides.isUntitled ?? false,
      getText: () => 'x'.repeat(overrides.textLength ?? 10),
    },
    selection: { active: { line: overrides.line ?? 2, character: 0 } },
  };
}

function makeHarness(
  blameResult: LineBlame | null = makeBlame(),
  overrides: Partial<BlameControllerDeps> = {},
): Harness {
  const applied: Array<[unknown, unknown, unknown[]]> = [];
  const selectionHandlers: Array<() => void> = [];
  const activeHandlers: Array<() => void> = [];
  const blameLine = vi.fn(async () => blameResult);

  const deps: BlameControllerDeps = {
    blameService: { blameLine, commitDetails: vi.fn(async () => null) },
    resolveRepo: vi.fn(async () => 'D:/repo'),
    getLocale: () => 'en',
    getEnabled: () => true,
    getConflictMode: () => 'ask',
    detectConflict: () => false,
    askConflict: vi.fn(async () => {}),
    onDidChangeTextEditorSelection: (handler) => {
      selectionHandlers.push(handler);
    },
    onDidChangeActiveTextEditor: (handler) => {
      activeHandlers.push(handler);
    },
    createDecorationType: vi.fn(() => ({ key: 'decoration', dispose: () => {} })),
    applyDecorations: vi.fn((editor, type, options) => {
      applied.push([editor, type, options]);
    }),
    getActiveEditor: () => makeEditor(),
    nowMs: () => NOW_MS,
    debounceMs: 0,
  };
  // Merge after defaults so e.g. a custom blameService replaces the whole dep.
  const mergedDeps: BlameControllerDeps = { ...deps, ...overrides };

  const controller = new BlameController(mergedDeps);
  controller.activate();

  return {
    applied,
    blameLine: mergedDeps.blameService.blameLine as unknown as ReturnType<typeof vi.fn>,
    askConflict: mergedDeps.askConflict as ReturnType<typeof vi.fn>,
    fireSelection: () => {
      for (const handler of selectionHandlers) handler();
    },
    fireActiveEditor: () => {
      for (const handler of activeHandlers) handler();
    },
    controller,
  };
}

function flushMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function lastAppliedOptions(harness: Harness): unknown[] {
  const last = harness.applied[harness.applied.length - 1];
  return last !== undefined ? last[2] : [];
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('BlameController', () => {
  it('clears decorations when disabled', async () => {
    const h = makeHarness(makeBlame(), { getEnabled: () => false });
    h.fireSelection();
    await flushMicrotasks();
    expect(h.applied.length).toBeGreaterThanOrEqual(1);
    expect(lastAppliedOptions(h)).toEqual([]);
  });

  it('clears decorations when the file is not eligible (no editor, untitled, non-file, too large)', async () => {
    const base = makeHarness();
    base.fireSelection();
    await flushMicrotasks();
    expect(base.blameLine).toHaveBeenCalledTimes(1);

    const cases: Array<{ overrides: Partial<BlameControllerDeps> }> = [
      {
        overrides: {
          getActiveEditor: () => undefined, // no active editor → nothing to clear
        },
      },
      {
        overrides: {
          getActiveEditor: () =>
            makeEditor({
              uri: { scheme: 'untitled', fsPath: 'D:/repo/x.ts' },
              isUntitled: true,
            }),
        },
      },
      {
        overrides: {
          getActiveEditor: () =>
            makeEditor({
              uri: { scheme: 'https', fsPath: 'example.com/x.ts' },
            }),
        },
      },
      {
        overrides: {
          maxFileChars: 100,
          getActiveEditor: () => makeEditor({ textLength: 101 }),
        },
      },
    ];

    for (const { overrides } of cases) {
      const h = makeHarness(undefined, overrides);
      h.fireSelection();
      await flushMicrotasks();
      if (overrides.getActiveEditor === undefined && h.applied.length === 0) {
        // covered by the first case below; keep going
      }
      if (h.applied.length > 0) {
        expect(lastAppliedOptions(h)).toEqual([]);
      }
      expect(h.blameLine).not.toHaveBeenCalled();
    }
  });

  it('shows a decoration matching formatBlameAnnotation when blame hits', async () => {
    const h = makeHarness(makeBlame({ authorName: 'Ann', authorTimeUnix: 0 }));
    h.fireSelection();
    await flushMicrotasks();
    expect(h.applied.length).toBe(1);
    const options = lastAppliedOptions(h) as Array<{
      line0Based: number;
      contentText: string;
    }>;
    expect(options).toHaveLength(1);
    expect(options[0].line0Based).toBe(2);
    expect(options[0].contentText).toBe(
      formatBlameAnnotation('Ann', 0, NOW_MS, 'en'),
    );
  });

  it('only applies the latest request when selections change rapidly (debounce + request id)', async () => {
    let resolveStale: ((value: LineBlame | null) => void) | undefined;
    const pending: Array<Promise<LineBlame | null>> = [];
    const blameLine = vi.fn((_repoRoot: string, _file: string, _line: number) => {
      if (pending.length === 0) {
        const p = Promise.resolve(makeBlame({ authorName: 'firstAuthor' }));
        pending.push(p);
        return p;
      }
      if (pending.length === 1) {
        const p = new Promise<LineBlame | null>((resolve) => {
          resolveStale = resolve;
        });
        pending.push(p);
        return p;
      }
      const p = Promise.resolve(makeBlame({ authorName: 'latestAuthor' }));
      pending.push(p);
      return p;
    });
    const h = makeHarness(makeBlame(), {
      blameService: {
        blameLine,
        commitDetails: vi.fn(async () => null),
      },
    });

    // First selection: resolves and applies.
    h.fireSelection();
    await flushMicrotasks();
    expect(pending.length).toBe(1);
    expect(h.applied.length).toBe(1);
    expect(lastDecorationText(h)).toContain('firstAuthor');

    // Second selection: blame pending.
    h.fireSelection();
    await flushMicrotasks();
    expect(pending.length).toBe(2);
    expect(h.applied.length).toBe(1);

    // Third selection arrives: the second request is now stale.
    h.fireSelection();
    await flushMicrotasks();
    expect(pending.length).toBe(3);
    expect(h.applied.length).toBe(2);
    expect(lastDecorationText(h)).toContain('latestAuthor');

    // The stale second request settles last but must not override the third.
    if (resolveStale) {
      resolveStale(makeBlame({ authorName: 'staleAuthor' }));
    }
    await pending[1];
    await flushMicrotasks();
    expect(h.applied.length).toBe(2);
    expect(lastDecorationText(h)).toContain('latestAuthor');
    expect(lastDecorationText(h)).not.toContain('staleAuthor');
  });

  it('asks about the GitLens conflict once per session and only when it actually conflicts', async () => {
    const conflict = { getConflictMode: () => 'ask' as const, detectConflict: () => true };
    const h = makeHarness(makeBlame(), conflict);
    h.fireSelection();
    await flushMicrotasks();
    expect(h.askConflict).toHaveBeenCalledTimes(1);
    // Render still happens in ask mode when conflicting.
    expect(h.applied.length).toBe(1);

    h.fireSelection();
    await flushMicrotasks();
    expect(h.askConflict).toHaveBeenCalledTimes(1);

    // A fresh controller (new session) asks again.
    const h2 = makeHarness(makeBlame(), conflict);
    h2.fireSelection();
    await flushMicrotasks();
    expect(h2.askConflict).toHaveBeenCalledTimes(1);

    // No conflict → never asks.
    const h3 = makeHarness(makeBlame(), {
      getConflictMode: () => 'ask',
      detectConflict: () => false,
    });
    h3.fireSelection();
    await flushMicrotasks();
    expect(h3.askConflict).not.toHaveBeenCalled();
  });

  it('defers to GitLens when mode is defer and conflict exists', async () => {
    const h = makeHarness(makeBlame(), {
      getConflictMode: () => 'defer',
      detectConflict: () => true,
    });
    h.fireSelection();
    await flushMicrotasks();
    expect(h.applied.length).toBe(1);
    expect(lastAppliedOptions(h)).toEqual([]);
    expect(h.blameLine).not.toHaveBeenCalled();
  });

  it('exposes the cached blame for the hover provider', async () => {
    const h = makeHarness(makeBlame());
    h.fireSelection();
    await flushMicrotasks();
    expect(h.controller.getCachedBlame('D:/repo/src/file.ts', 2)).toEqual(makeBlame());
    expect(h.controller.getCachedBlame('D:/repo/src/other.ts', 2)).toBeUndefined();
  });
});

function lastDecorationText(harness: Harness): string {
  const options = lastAppliedOptions(harness) as Array<{
    contentText: string;
  }>;
  return options.length > 0 ? options[0].contentText : '';
}

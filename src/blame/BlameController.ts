import * as path from 'node:path';
import type { BlameService } from './BlameService';
import type { ConflictMode } from './conflictPolicy';
import { shouldRenderBlame } from './conflictPolicy';
import { formatBlameAnnotation } from './relativeTime';
import type { LineBlame } from './parseBlamePorcelain';

export type DecorationTypeLike = { key: string; dispose(): void };

/** Neutral decoration payload; adapted to the real VS Code API in extension.ts. */
export type DecorationOptionsLike = { line0Based: number; contentText: string };

export type TextEditorLike = {
  document: {
    uri: { scheme: string; fsPath: string };
    isUntitled: boolean;
    getText: () => string;
  };
  selection: { active: { line: number; character: number } };
};

export type BlameControllerDeps = {
  blameService: BlameService;
  resolveRepo: (candidates: string[]) => Promise<string | null>;
  getLocale: () => string;
  getEnabled: () => boolean;
  getConflictMode: () => ConflictMode;
  detectConflict: () => boolean;
  askConflict: () => Promise<void>; // no-op in tests; real impl shows the message
  onDidChangeTextEditorSelection: (handler: (event?: unknown) => void) => unknown;
  onDidChangeActiveTextEditor: (handler: (event?: unknown) => void) => unknown;
  createDecorationType: () => DecorationTypeLike;
  /**
   * Apply decorations to an editor. Injected so tests observe plain calls;
   * the real adapter converts the neutral payload into
   * `DecorationOptions` (`renderOptions.after`) for `editor.setDecorations`.
   */
  applyDecorations: (
    editor: TextEditorLike,
    type: DecorationTypeLike,
    options: DecorationOptionsLike[],
  ) => void;
  getActiveEditor: () => TextEditorLike | undefined;
  debounceMs?: number;
  nowMs?: () => number;
  maxFileChars?: number;
};

const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_MAX_FILE_CHARS = 5 * 1024 * 1024;

type CacheEntry = { blame: LineBlame; tick: number };

const NULL_BLAME_PLACEHOLDER = '';

/**
 * Keeps the current-line blame decoration in sync with the active editor
 * selection. Pure orchestration: all VS Code–specific objects (event
 * subscriptions, decoration type, message box) are injected via deps, so
 * tests run without mocking the `vscode` module.
 */
export class BlameController {
  private readonly decorationType: DecorationTypeLike;
  private readonly debounceMs: number;
  private readonly maxFileChars: number;
  private readonly nowMs: () => number;
  private readonly cache = new Map<string, CacheEntry>();
  private askedThisSession = false;
  private pending: ReturnType<typeof setTimeout> | undefined;
  private requestSeq = 0;
  private appliedRequestSeq = 0;
  private disposed = false;
  private lastDecorated: TextEditorLike | undefined;

  constructor(private readonly deps: BlameControllerDeps) {
    this.debounceMs = deps.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.maxFileChars = deps.maxFileChars ?? DEFAULT_MAX_FILE_CHARS;
    this.nowMs = deps.nowMs ?? (() => Date.now());
    this.decorationType = deps.createDecorationType();
  }

  /** Subscribe to editor events and render once. Called once from extension activation. */
  activate(): void {
    this.deps.onDidChangeTextEditorSelection(() => {
      this.schedule();
    });
    this.deps.onDidChangeActiveTextEditor(() => {
      this.schedule();
    });
    this.schedule();
  }

  refresh(): void {
    this.schedule();
  }

  dispose(): void {
    this.disposed = true;
    if (this.pending !== undefined) {
      clearTimeout(this.pending);
      this.pending = undefined;
    }
    this.decorationType.dispose();
  }

  /**
   * Cached blame for a file/line, for the hover provider. `fsPath` is the
   * absolute path as it appears in the editor; `line0Based` is the cursor line.
   */
  getCachedBlame(fsPath: string, line0Based: number): LineBlame | undefined {
    const key = `${fsPath}\n${String(line0Based)}`;
    let best: CacheEntry | undefined;
    let bestTick = -1;
    for (const [cacheKey, entry] of this.cache.entries()) {
      if (cacheKey.startsWith(`${key}\n`) && entry.tick > bestTick) {
        bestTick = entry.tick;
        best = entry;
      }
    }
    // A null marker (empty commitId) means git could not blame this line.
    if (best === undefined || best.blame.commitId === NULL_BLAME_PLACEHOLDER) {
      return undefined;
    }
    return best.blame;
  }

  private schedule(): void {
    if (this.disposed) {
      return;
    }
    if (this.pending !== undefined) {
      clearTimeout(this.pending);
    }
    this.pending = setTimeout(() => {
      this.pending = undefined;
      void this.evaluate();
    }, this.debounceMs);
  }

  private isEligible(editor: TextEditorLike): boolean {
    const document = editor.document;
    if (document.uri.scheme !== 'file') {
      return false;
    }
    if (document.isUntitled) {
      return false;
    }
    if (document.getText().length > this.maxFileChars) {
      return false;
    }
    return true;
  }

  private async evaluate(): Promise<void> {
    const requestId = ++this.requestSeq;
    // Paints are only ever applied to the editor this request was computed
    // for; a mid-request editor switch is handled by the newer request.
    const startFsPath = this.deps.getActiveEditor()?.document.uri.fsPath;

    const apply = (options: DecorationOptionsLike[]): void => {
      if (this.disposed || requestId < this.appliedRequestSeq) {
        return;
      }
      this.appliedRequestSeq = Math.max(this.appliedRequestSeq, requestId);
      const current = this.deps.getActiveEditor();
      if (current === undefined) {
        // Focus left text editors (webview, sidebar): hide the annotation on
        // the editor that still shows it instead of leaving it painted.
        if (this.lastDecorated !== undefined) {
          this.deps.applyDecorations(this.lastDecorated, this.decorationType, []);
          this.lastDecorated = undefined;
        }
        return;
      }
      if (
        options.length > 0 &&
        startFsPath !== undefined &&
        current.document.uri.fsPath !== startFsPath
      ) {
        return;
      }
      if (this.lastDecorated !== undefined && this.lastDecorated !== current) {
        this.deps.applyDecorations(this.lastDecorated, this.decorationType, []);
      }
      this.deps.applyDecorations(current, this.decorationType, options);
      this.lastDecorated = options.length > 0 ? current : undefined;
    };

    try {
      const editor = this.deps.getActiveEditor();
      if (editor === undefined || !this.isEligible(editor)) {
        apply([]);
        return;
      }
      const enabled = this.deps.getEnabled();
      const mode = this.deps.getConflictMode();
      const conflict = this.deps.detectConflict();
      if (!enabled || !shouldRenderBlame(enabled, mode, conflict)) {
        apply([]);
        return;
      }
      if (mode === 'ask' && conflict && !this.askedThisSession) {
        this.askedThisSession = true;
        await this.deps.askConflict();
        // The ask may have just persisted `defer` (Hide GitGress's); honor the
        // user's choice immediately instead of rendering one last annotation.
        if (!shouldRenderBlame(enabled, this.deps.getConflictMode(), conflict)) {
          apply([]);
          return;
        }
      }
      const fsPath = editor.document.uri.fsPath;
      const repoRoot = await this.deps.resolveRepo([fsPath]);
      if (repoRoot === null) {
        apply([]);
        return;
      }
      let relative: string;
      try {
        relative = path.relative(repoRoot, fsPath);
      } catch {
        apply([]);
        return;
      }
      if (relative === '' || relative.startsWith('..')) {
        apply([]);
        return;
      }
      const gitPath = relative.replace(/\\/g, '/');
      const line1Based = editor.selection.active.line + 1;
      const blame = await this.deps.blameService.blameLine(
        repoRoot,
        gitPath,
        line1Based,
      );
      // A stale response (a newer selection already applied) is dropped
      // entirely, including its cache write.
      if (requestId < this.appliedRequestSeq) {
        return;
      }
      const cacheKey = `${fsPath}\n${String(editor.selection.active.line)}\n`;
      if (blame === null) {
        this.cache.set(`${cacheKey}null`, {
          blame: { commitId: NULL_BLAME_PLACEHOLDER, authorName: '', authorTimeUnix: NaN, summary: '' },
          tick: requestId,
        });
        apply([]);
        return;
      }
      this.cache.set(cacheKey, { blame, tick: requestId });
      apply([
        {
          line0Based: editor.selection.active.line,
          contentText: formatBlameAnnotation(
            blame.authorName,
            blame.authorTimeUnix,
            this.nowMs(),
            this.deps.getLocale(),
            blame.summary,
          ),
        },
      ]);
    } catch {
      apply([]);
    }
  }
}

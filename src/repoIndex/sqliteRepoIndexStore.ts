import { promises as fsPromises } from 'node:fs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import { normalizeRepoPath } from './pathNormalize.js';
import type { RepoIndexEntry, RepoIndexStore } from './repoIndexStore.js';

/**
 * Error thrown when the on-disk SQLite repo index cannot be opened because it
 * is missing, truncated, or otherwise not a valid SQLite database file.
 *
 * Callers may catch this typed error to fall back to an empty in-memory store
 * instead of crashing. The store itself never swallows corruption.
 */
export class RepoIndexDbError extends Error {
  readonly dbFilePath: string;
  readonly cause?: unknown;

  constructor(message: string, dbFilePath: string, cause?: unknown) {
    super(message);
    this.name = 'RepoIndexDbError';
    this.dbFilePath = dbFilePath;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

const TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS repos (
    root TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    last_seen_ms INTEGER NOT NULL
  );
`;

// Cache the initialized sql.js static so we only load the wasm once per
// process even if many stores are created.
let sqlJsPromise: Promise<SqlJsStatic> | null = null;

function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs();
  }
  return sqlJsPromise;
}

function normalizeEntry(entry: RepoIndexEntry): RepoIndexEntry {
  return { ...entry, root: normalizeRepoPath(entry.root) };
}

function rowToEntry(row: { root: string; source: string; last_seen_ms: number }): RepoIndexEntry {
  return {
    root: row.root,
    source: row.source === 'submodule' ? 'submodule' : 'scan',
    lastSeenMs: row.last_seen_ms,
  };
}

async function loadDatabase(dbFilePath: string, SQL: SqlJsStatic): Promise<Database> {
  const dir = path.dirname(dbFilePath);
  await fsPromises.mkdir(dir, { recursive: true });

  let db: Database;
  if (fs.existsSync(dbFilePath)) {
    const stat = fs.statSync(dbFilePath);
    if (!stat.isFile()) {
      throw new RepoIndexDbError(
        `repo index db path is not a file: ${dbFilePath}`,
        dbFilePath,
      );
    }
    const bytes = fs.readFileSync(dbFilePath);
    if (bytes.length === 0) {
      // Empty file: treat as fresh database rather than corrupt.
      db = new SQL.Database();
    } else {
      try {
        db = new SQL.Database(bytes);
      } catch (err) {
        throw new RepoIndexDbError(
          `failed to open repo index db (corrupt or not SQLite): ${dbFilePath}`,
          dbFilePath,
          err,
        );
      }
      // Sanity-check: a file that happens to parse but isn't actually SQLite
      // (e.g. random bytes that emscripten accepts) should still expose the
      // expected schema after migration, but verify the header magic to be
      // safe. SQLite files start with "SQLite format 3\0".
      if (bytes.length >= 16 && bytes.subarray(0, 16).toString('latin1') !== 'SQLite format 3\0') {
        db.close();
        throw new RepoIndexDbError(
          `repo index db is not a valid SQLite file: ${dbFilePath}`,
          dbFilePath,
        );
      }
    }
  } else {
    db = new SQL.Database();
  }

  try {
    db.run(TABLE_DDL);
  } catch (err) {
    db.close();
    throw new RepoIndexDbError(
      `failed to initialize repo index schema: ${dbFilePath}`,
      dbFilePath,
      err,
    );
  }
  return db;
}

function persist(db: Database, dbFilePath: string): void {
  const data = db.export();
  fs.writeFileSync(dbFilePath, data);
}

/**
 * Create or open a SQLite-backed {@link RepoIndexStore} at `dbFilePath`.
 *
 * The store keeps the whole database in memory (via sql.js) and flushes it to
 * disk after every mutating operation using `db.export()` + `fs.writeFileSync`.
 * There is no entry cap; every distinct normalized root is retained.
 *
 * If the file exists but is not a valid SQLite database, a {@link RepoIndexDbError}
 * is thrown so callers can fall back. Corruption is never silently swallowed.
 *
 * @param dbFilePath Absolute path to the SQLite database file.
 */
export async function createSqliteRepoIndexStore(
  dbFilePath: string,
): Promise<RepoIndexStore> {
  const SQL = await getSqlJs();
  const db = await loadDatabase(dbFilePath, SQL);

  const flush = (): void => persist(db, dbFilePath);

  return {
    mode: 'sqlite',

    getEntries(): readonly RepoIndexEntry[] {
      const result = db.exec(
        // ORDER BY rowid preserves insertion order, matching the in-memory
        // store's Map iteration semantics.
        'SELECT root, source, last_seen_ms FROM repos ORDER BY rowid;',
      );
      if (result.length === 0) {
        return [];
      }
      const rows = result[0];
      const colIndex = {
        root: rows.columns.indexOf('root'),
        source: rows.columns.indexOf('source'),
        last_seen_ms: rows.columns.indexOf('last_seen_ms'),
      };
      return rows.values.map((row) =>
        rowToEntry({
          root: String(row[colIndex.root]),
          source: String(row[colIndex.source]),
          last_seen_ms: Number(row[colIndex.last_seen_ms]),
        }),
      );
    },

    upsert(entry: RepoIndexEntry): 'added' | 'updated' | 'rejected' {
      const normalized = normalizeEntry(entry);
      const existed = db.exec('SELECT 1 FROM repos WHERE root = ?;', [normalized.root]);
      db.run(
        'INSERT INTO repos (root, source, last_seen_ms) VALUES (?, ?, ?) ' +
          'ON CONFLICT(root) DO UPDATE SET source = excluded.source, last_seen_ms = excluded.last_seen_ms;',
        [normalized.root, normalized.source, normalized.lastSeenMs],
      );
      flush();
      return existed.length > 0 ? 'updated' : 'added';
    },

    replaceAll(items: readonly RepoIndexEntry[]): void {
      db.run('DELETE FROM repos;');
      const stmt = db.prepare(
        'INSERT INTO repos (root, source, last_seen_ms) VALUES (?, ?, ?);',
      );
      for (const item of items) {
        const normalized = normalizeEntry(item);
        stmt.run([normalized.root, normalized.source, normalized.lastSeenMs]);
      }
      stmt.free();
      flush();
    },

    pruneMissing(exists: (root: string) => boolean): string[] {
      const all = db.exec('SELECT root FROM repos;');
      const removed: string[] = [];
      if (all.length === 0) {
        return removed;
      }
      const roots = all[0].values.map((row) => String(row[0]));
      const stmt = db.prepare('DELETE FROM repos WHERE root = ?;');
      for (const root of roots) {
        if (!exists(root)) {
          stmt.run([root]);
          removed.push(root);
        }
      }
      stmt.free();
      if (removed.length > 0) {
        flush();
      }
      return removed;
    },

    close(): void {
      try {
        flush();
      } finally {
        db.close();
      }
    },
  };
}

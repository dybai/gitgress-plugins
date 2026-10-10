import { normalizeRepoPath } from './pathNormalize.js';
import { parseGitmodules } from './parseGitmodules.js';
import { DEFAULT_SCAN_IGNORE_DIR_NAMES } from './scanIgnore.js';

export { DEFAULT_SCAN_IGNORE_DIR_NAMES } from './scanIgnore.js';

export type ScanFs = {
  readdir(path: string): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  isDirectory(path: string): Promise<boolean>;
};

export type DiscoveredRepo = {
  root: string;
  source: 'scan' | 'submodule';
};

export type ScanReposOptions = {
  ignoreDirNames?: ReadonlySet<string>;
  signal?: AbortSignal;
};

const DOT_GIT = '.git';
const DOT_GITMODULES = '.gitmodules';

function joinPath(parent: string, child: string): string {
  const p = parent.replace(/\\/g, '/').replace(/\/+$/, '');
  const c = child.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!c) return p;
  return `${p}/${c}`;
}

export async function* scanRepos(
  roots: readonly string[],
  fs: ScanFs,
  options?: ScanReposOptions,
): AsyncGenerator<DiscoveredRepo> {
  const ignoreDirNames = options?.ignoreDirNames ?? DEFAULT_SCAN_IGNORE_DIR_NAMES;
  const signal = options?.signal;

  const queue: string[] = [...roots];

  while (queue.length > 0) {
    if (signal?.aborted) return;
    const dir = queue.shift() as string;

    let hasGit: boolean;
    try {
      hasGit = await fs.exists(joinPath(dir, DOT_GIT));
    } catch {
      continue;
    }

    if (hasGit) {
      yield { root: normalizeRepoPath(dir), source: 'scan' };

      let gitmodulesContent: string | null = null;
      try {
        gitmodulesContent = await fs.readFile(joinPath(dir, DOT_GITMODULES));
      } catch {
        gitmodulesContent = null;
      }

      if (gitmodulesContent !== null) {
        for (const sub of parseGitmodules(gitmodulesContent)) {
          if (signal?.aborted) return;
          const subPath = joinPath(dir, sub);
          let subHasGit: boolean;
          try {
            subHasGit = await fs.exists(joinPath(subPath, DOT_GIT));
          } catch {
            continue;
          }
          if (subHasGit) {
            yield { root: normalizeRepoPath(subPath), source: 'submodule' };
          }
        }
      }

      continue;
    }

    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue;
    }

    for (const name of entries) {
      if (ignoreDirNames.has(name)) continue;
      const childPath = joinPath(dir, name);
      let isDir: boolean;
      try {
        isDir = await fs.isDirectory(childPath);
      } catch {
        continue;
      }
      if (isDir) {
        queue.push(childPath);
      }
    }
  }
}

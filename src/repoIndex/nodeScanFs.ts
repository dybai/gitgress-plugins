import { promises as fsPromises } from 'node:fs';
import type { ScanFs } from './scanRepos.js';

/** Adapter from Node `fs.promises` to the {@link ScanFs} used by repo scanning. */
export function createNodeScanFs(): ScanFs {
  return {
    readdir: (p) => fsPromises.readdir(p),
    async exists(p) {
      try {
        await fsPromises.access(p);
        return true;
      } catch {
        return false;
      }
    },
    readFile: (p) => fsPromises.readFile(p, 'utf8'),
    async isDirectory(p) {
      try {
        // stat follows symlinks; use lstat so symlink loops are not traversed.
        return (await fsPromises.lstat(p)).isDirectory();
      } catch {
        return false;
      }
    },
  };
}

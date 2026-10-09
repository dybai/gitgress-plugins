import * as esbuild from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = join(root, 'dist', 'webview');
mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: {
    commits: join(root, 'webview', 'commits', 'main.js'),
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  outdir,
  logLevel: 'info',
});

cpSync(join(root, 'webview', 'commits', 'styles.css'), join(outdir, 'commits.css'));
cpSync(join(root, 'webview', 'commits', 'index.html'), join(outdir, 'commits.html'));

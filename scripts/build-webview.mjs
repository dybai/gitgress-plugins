import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = join(root, 'dist', 'webview');
const watchMode = process.argv.includes('--watch');

const staticAssets = [
  ['commits', 'styles.css', 'commits.css'],
  ['commits', 'index.html', 'commits.html'],
  ['files', 'styles.css', 'files.css'],
  ['files', 'index.html', 'files.html'],
];

function copyStaticAssets() {
  mkdirSync(outdir, { recursive: true });
  for (const [dir, from, to] of staticAssets) {
    cpSync(join(root, 'webview', dir, from), join(outdir, to));
  }
}

const buildOptions = {
  entryPoints: {
    commits: join(root, 'webview', 'commits', 'main.js'),
    files: join(root, 'webview', 'files', 'main.ts'),
  },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  // Bundles @vscode-elements/elements (+ lit) and shared src/views/files helpers into files.js.
  legalComments: 'none',
  outdir,
  logLevel: 'info',
};

mkdirSync(outdir, { recursive: true });

if (!watchMode) {
  await esbuild.build(buildOptions);
  copyStaticAssets();
} else {
  const context = await esbuild.context(buildOptions);
  await context.rebuild();
  await context.watch();
  copyStaticAssets();

  // esbuild watches only the JS/TS import graph; css/html are copied on change.
  let timer;
  const scheduleCopy = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        copyStaticAssets();
        console.log('[watch] copied webview css/html');
      } catch (error) {
        console.error('[watch] copy failed:', error);
      }
    }, 50);
  };
  for (const dir of new Set(staticAssets.map(([d]) => d))) {
    watch(join(root, 'webview', dir), (_event, filename) => {
      if (filename && /\.(css|html)$/.test(String(filename))) {
        scheduleCopy();
      }
    });
  }
  console.log('[watch] watching webview sources (Ctrl+C to stop)');
}

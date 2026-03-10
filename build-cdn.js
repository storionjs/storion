/**
 * Build a single-file, minified UMD bundle for CDN usage.
 *
 * Output: dist-cdn/storion.cdn.js
 *
 * - Exposes Storion under the global name `Storion` when loaded via <script>.
 * - Works as an ES module when imported via bundlers.
 */

import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildCdnBundle() {
  const entry = path.join(__dirname, 'src', 'index.js');
  const outfile = path.join(__dirname, 'dist-cdn', 'storion.cdn.js');

  await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    sourcemap: false,
    format: 'iife',
    globalName: 'Storion',
    platform: 'browser',
    target: ['es2018'],
    outfile,
  });

  console.log('Built CDN bundle:', path.relative(__dirname, outfile));
}

buildCdnBundle().catch((err) => {
  console.error(err);
  process.exit(1);
});


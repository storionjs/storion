/**
 * Build: copy src to dist. Package is ESM.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const srcPath = path.join(src, name);
    const destPath = path.join(dest, name);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });
copyDir(srcDir, distDir);
const typesSrc = path.join(__dirname, 'types', 'index.d.ts');
const typesDest = path.join(distDir, 'index.d.ts');
if (fs.existsSync(typesSrc)) {
  fs.copyFileSync(typesSrc, typesDest);
}
console.log('Built dist/ from src/');

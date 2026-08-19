// Vendors the sibling Praxis repo's skills/ directory into this repo's own
// skills/ directory. Plain ESM on purpose, matching copy-assets.mjs's style.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const sourceDir = path.join(repoRoot, '..', 'Praxis', 'skills');
const destDir = path.join(repoRoot, 'skills');

function isExcluded(name) {
  return name.startsWith('.') || name.startsWith('.git') || name.endsWith('.zip');
}

function copyDir(srcDir, destSubDir) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (isExcluded(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destSubDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`copied ${path.relative(sourceDir, srcPath)}`);
    }
  }
}

fs.rmSync(destDir, { recursive: true, force: true });
fs.mkdirSync(destDir, { recursive: true });
copyDir(sourceDir, destDir);

// Copies the non-TypeScript assets into dist/public/ as part of the build chain.
// Plain ESM on purpose: it has to run before any compiled output exists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const srcPublic = path.join(repoRoot, 'src', 'public');
const distPublic = path.join(repoRoot, 'dist', 'public');

fs.mkdirSync(distPublic, { recursive: true });
console.log(`ensured ${distPublic}`);

for (const name of ['index.html', 'board.html', 'styles.css', 'fonts/fraunces-latin.woff2']) {
  const dest = path.join(distPublic, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(srcPublic, name), dest);
  console.log(`copied ${name}`);
}

// Copies the non-TypeScript assets into dist/public/ as part of the build chain.
// Plain ESM on purpose: it has to run before any compiled output exists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const srcPublic = path.join(repoRoot, 'src', 'public');
const distPublic = path.join(repoRoot, 'dist', 'public');
const distRoot = path.join(repoRoot, 'dist');

fs.mkdirSync(distPublic, { recursive: true });
console.log(`ensured ${distPublic}`);

for (const name of [
  'index.html',
  'board.html',
  'styles.css',
  'img/flowcharge-wordmark.png',
  'img/flowcharge-lockup.png',
  'img/flowcharge-mark.png',
]) {
  const dest = path.join(distPublic, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(srcPublic, name), dest);
  console.log(`copied ${name}`);
}

// Guard: a source map in dist/ would ship the original TypeScript into the packaged app.
// Hand-rolled recursion on purpose: engines allows Node 18.0, and readdirSync's `recursive`
// option only arrived in 18.17. Using dirent.isDirectory() also means symlinked directories
// are not followed, so the walk cannot loop.
// returns paths relative to `dir`, for every file whose name ends in `.map`
function findSourceMaps(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${dirent.name}` : dirent.name;
    if (dirent.isDirectory()) {
      found.push(...findSourceMaps(path.join(dir, dirent.name), relative));
    } else if (dirent.name.endsWith('.map')) {
      found.push(relative);
    }
  }
  return found;
}

const sourceMaps = findSourceMaps(distRoot);
if (sourceMaps.length > 0) {
  throw new Error(
    `source maps must never ship in a packaged build, and ${sourceMaps.length} were found under dist/:\n` +
      sourceMaps.map((name) => `  dist/${name}`).join('\n') +
      '\nTurn off sourceMap, inlineSourceMap and declarationMap in the tsconfig that emitted them.',
  );
}
console.log('checked dist/ for source maps: none found');

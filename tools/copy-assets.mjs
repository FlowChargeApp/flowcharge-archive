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

for (const name of ['index.html', 'styles.css']) {
  fs.copyFileSync(path.join(srcPublic, name), path.join(distPublic, name));
  console.log(`copied ${name}`);
}

// src/public/data.json is a seed fixture, not the live artefact: it is copied in only
// when dist/public/data.json is absent. After the first build it never changes again,
// because `npm run refresh` writes straight to dist/public/data.json and an
// unconditional copy here would clobber freshly refreshed data with the demo snapshot.
const dataSrc = path.join(srcPublic, 'data.json');
const dataDest = path.join(distPublic, 'data.json');
if (fs.existsSync(dataDest)) {
  console.log('skipped data.json (destination already exists)');
} else {
  fs.copyFileSync(dataSrc, dataDest);
  console.log('seeded data.json from src/public/data.json');
}

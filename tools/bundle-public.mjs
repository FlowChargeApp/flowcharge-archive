// Bundles src/public/ into one IIFE per HTML page: home.js for index.html and
// app.js for board.html. Plain ESM on purpose, matching tools/copy-assets.mjs —
// no build framework, one console.log per action.
//
// Order inside this script is what makes it safe: sweep, then bundle into
// memory, then guard, then write. Bundling with write: false keeps the output
// in memory, so a failed guard never leaves a rejected bundle on disk.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const distPublic = path.join(repoRoot, 'dist', 'public');

// One switch, two modes. A CLI flag rather than an environment variable,
// because package:win runs on Windows, where `VAR=1 npm run build` does not
// work in cmd.exe.
const harden = process.argv.includes('--harden');

fs.mkdirSync(distPublic, { recursive: true });
console.log(`ensured ${distPublic}`);

// Sweep every .js file under dist/public/, including dist/public/lib/, before
// bundling. Without it, the per-file outputs a previous build left behind —
// ipc-adapter.js, browser-ipc-shim.js, app-version.js, update-banner.js,
// lib/agentic-tools-scope.js — survive as readable copies of the code this
// script exists to bundle, and electron-builder's dist/**/* glob ships them.
//
// A wildcard over .js, never a fixed list of filenames: the source file count
// changes, and a list would need an edit each time one is added. .js files
// only, never a wholesale dist/ clean — that would take the server and Electron
// outputs with it.
//
// Hand-rolled recursion, same as copy-assets.mjs: engines allows Node 18.0 and
// readdirSync's `recursive` option only arrived in 18.17. dirent.isDirectory()
// also means symlinked directories are not followed, so the walk cannot loop.
function sweepJavaScript(dir) {
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      removed += sweepJavaScript(full);
    } else if (dirent.name.endsWith('.js')) {
      fs.rmSync(full);
      removed += 1;
    }
  }
  return removed;
}

const swept = sweepJavaScript(distPublic);
console.log(`swept ${swept} stale .js file(s) from ${distPublic}`);

// Exactly two entry points. app-version.ts and update-banner.ts are not entry
// points: they arrive inside both bundles through the side-effect imports in
// home.ts and app.ts, so they need no output file and no script tag.
const result = await esbuild.build({
  entryPoints: {
    home: path.join(repoRoot, 'src', 'public', 'home.ts'),
    app: path.join(repoRoot, 'src', 'public', 'app.ts'),
  },
  bundle: true,
  format: 'iife',
  target: 'es2020',
  platform: 'browser',
  charset: 'utf8',
  legalComments: 'none',
  sourcemap: false,
  minify: harden,
  outdir: distPublic,
  write: false,
});
console.log(`bundled ${result.outputFiles.length} entry point(s)${harden ? ' (minified)' : ''}`);

// The eval guard. A substring scan, not a parse: a literal source string
// containing `eval(` would be a false positive, none does today, and the
// documented fix is to narrow the guard, never to remove it. `Function(` also
// matches inside `new Function(`, which is intended.
//
// It runs on the final text of each bundle, before anything is written, so a
// bundle the CSP would refuse to run fails the build loudly instead of shipping.
const FORBIDDEN = ['eval(', 'new Function(', 'Function('];

for (const file of result.outputFiles) {
  for (const bad of FORBIDDEN) {
    if (file.text.includes(bad)) {
      throw new Error(
        `${path.relative(repoRoot, file.path)} contains ${bad}, which the Content-Security-Policy in ` +
          'src/server.ts refuses to run. Nothing was written. Narrow the guard rather than removing it.',
      );
    }
  }
}
console.log(`eval guard clean across ${result.outputFiles.length} bundle(s)`);

// No source map in either mode. One alongside an obfuscated bundle would undo
// the obfuscation for anyone who fetched it.
for (const file of result.outputFiles) {
  fs.mkdirSync(path.dirname(file.path), { recursive: true });
  fs.writeFileSync(file.path, file.text);
  console.log(`wrote ${path.relative(repoRoot, file.path)}`);
}

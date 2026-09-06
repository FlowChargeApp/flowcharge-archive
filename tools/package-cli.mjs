// Compiles the board into a single-file native executable per target, using
// `bun build --compile`. Plain ESM on purpose, matching tools/copy-assets.mjs
// and tools/bundle-public.mjs — no build framework, one console.log per action.
//
// It does not compile dist/server.js directly. It generates dist/cli-entry.js
// first, which declares every file under dist/public/ as an embedded Bun asset,
// injects the version, points the data directory at ~/.flowcharge, and only then
// dynamically imports ./server.js.
//
// This script knows the repository's build layout, the version field and the Bun
// target names. It knows nothing about the server's routes, the board payload,
// flowcharge/ parsing, or Electron.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const distRoot = path.join(repoRoot, 'dist');
const distPublic = path.join(distRoot, 'public');
const cliEntryPath = path.join(distRoot, 'cli-entry.js');
const releaseCli = path.join(repoRoot, 'release', 'cli');

// Every target this script can build, each row a Bun target string and the
// <platform>-<arch> label used in the output filename. win-x64 stays a valid,
// explicitly selectable target — `--target=win-x64` builds it — but it is not
// part of the default selection. See DEFAULT_LABELS below.
const TARGETS = [
  { bunTarget: 'bun-darwin-arm64', label: 'darwin-arm64' },
  { bunTarget: 'bun-darwin-x64', label: 'darwin-x64' },
  { bunTarget: 'bun-linux-x64', label: 'linux-x64' },
  { bunTarget: 'bun-windows-x64', label: 'win-x64' },
];

// The three labels a run with no --target flag builds, and the artefact set the
// release commands under .github/scripts/ expect. Windows is deliberately
// absent: shipping a Windows binary needs a submission to an installer or
// package-manager channel — Chocolatey or Scoop — first, so it is deferred to a
// later release rather than dropped. Adding 'win-x64' back here is the whole
// change when that day comes.
const DEFAULT_LABELS = ['darwin-arm64', 'darwin-x64', 'linux-x64'];

// A repeatable CLI flag rather than an environment variable, for the reason
// tools/bundle-public.mjs:19-21 records: package:win runs on Windows, where
// `VAR=1 npm run build` does not work in cmd.exe.
const requestedLabels = process.argv
  .filter((arg) => arg.startsWith('--target='))
  .map((arg) => arg.slice('--target='.length));

const validLabels = TARGETS.map((row) => row.label);
for (const label of requestedLabels) {
  if (!validLabels.includes(label)) {
    console.error(
      `unknown --target=${label}. Valid targets are: ${validLabels.join(', ')}`,
    );
    process.exit(1);
  }
}

// With no --target flag, the default rows are built. An explicit --target still
// reaches every row in TARGETS, win-x64 included.
const selected =
  requestedLabels.length > 0
    ? TARGETS.filter((row) => requestedLabels.includes(row.label))
    : TARGETS.filter((row) => DEFAULT_LABELS.includes(row.label));
console.log(`selected ${selected.length} target(s): ${selected.map((row) => row.label).join(', ')}`);

const { version } = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
console.log(`packaging version ${version}`);

// Hand-rolled recursion, same as copy-assets.mjs's findSourceMaps: consistency
// with its siblings, and dirent.isDirectory() means symlinked directories are
// not followed, so the walk cannot loop. Not a version constraint — engines is
// node >=20.14, so readdirSync's `recursive` option is in fact available.
// Returns paths relative to `dir`, always with '/' as the separator whatever
// the host, because the separator ends up inside an import specifier.
function findFiles(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${dirent.name}` : dirent.name;
    if (dirent.isDirectory()) {
      found.push(...findFiles(path.join(dir, dirent.name), relative));
    } else {
      found.push(relative);
    }
  }
  return found;
}

// Guard 1. build:release is what fills dist/public/, and package:cli chains it;
// this stays as a second line of defence for a direct `node tools/package-cli.mjs`.
const assets = findFiles(distPublic);
if (assets.length === 0) {
  console.error(
    `dist/public/ is missing or holds no files, so there is nothing to embed. Run \`npm run build:release\` first.`,
  );
  process.exit(1);
}
console.log(`found ${assets.length} file(s) under dist/public/`);

// Guard 2. bun is a PATH tool, not a devDependency. A spawn failure or a
// non-zero exit both mean it is not usable here.
const bunProbe = spawnSync('bun', ['--version'], { encoding: 'utf8' });
if (bunProbe.error || bunProbe.status !== 0) {
  console.error(
    'bun is not resolvable on PATH. Install Bun from https://bun.sh and make sure `bun --version` works, then run this again.',
  );
  process.exit(1);
}
console.log(`found bun ${bunProbe.stdout.trim()}`);

// The generated entry, overwritten on every run and never committed — dist/ is
// already gitignored.
//
// `with { type: 'file' }` is load-bearing: without it Bun applies its JavaScript
// loader to public/app.js, public/home.js and public/theme-init.js and embeds
// transformed code instead of bytes.
//
// The last statement must be a dynamic import, never a static one. server.js,
// src/lib/projects.ts and src/lib/update-prefs.ts all read their environment at
// module scope, and a static import hoists above the two assignments below.
// electron/main.cts:68 carries the same constraint and solves it the same way.
//
// Both guards are explicit emptiness tests, not ??=: an environment variable set
// to '' is '', not undefined, and an explicit value must still win.
const entryLines = [
  ...assets.map((relative) => `import './public/${relative}' with { type: 'file' };`),
  '',
  "import fs from 'node:fs';",
  "import os from 'node:os';",
  "import path from 'node:path';",
  '',
  `if (!process.env.PRAXIS_APP_VERSION) process.env.PRAXIS_APP_VERSION = ${JSON.stringify(version)};`,
  '',
  "if (!process.env.PRAXIS_DATA_DIR) process.env.PRAXIS_DATA_DIR = path.join(os.homedir(), '.flowcharge');",
  'fs.mkdirSync(process.env.PRAXIS_DATA_DIR, { recursive: true });',
  '',
  "await import('./server.js');",
];
fs.writeFileSync(cliEntryPath, `${entryLines.join('\n')}\n`);
console.log(`wrote ${path.relative(repoRoot, cliEntryPath)}`);

// Created if absent. This script never deletes anything.
fs.mkdirSync(releaseCli, { recursive: true });
console.log(`ensured ${path.relative(repoRoot, releaseCli)}`);

for (const row of selected) {
  // The base name only — Bun appends .exe itself for the Windows target.
  const outfile = path.join(releaseCli, `flowcharge-${version}-${row.label}`);
  console.log(`building ${row.label}`);
  const build = spawnSync(
    'bun',
    [
      'build',
      '--compile',
      '--asset-naming=[dir]/[name].[ext]',
      `--target=${row.bunTarget}`,
      `--outfile=${outfile}`,
      cliEntryPath,
    ],
    { stdio: 'inherit' },
  );
  if (build.error || build.status !== 0) {
    console.error(`bun build failed for ${row.label}. Nothing further was built.`);
    process.exit(1);
  }
  console.log(`built ${row.label}`);
}

console.log(`packaged ${selected.length} target(s) into ${path.relative(repoRoot, releaseCli)}`);

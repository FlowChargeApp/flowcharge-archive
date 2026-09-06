---
id: PLN-52-2sztva
type: plan
workstream: WS-62-ytspyd
slug: bundle-and-obfuscate-renderer
title: "Bundle src/public into two ES-module bundles and obfuscate them"
status: done
created: 2026-08-22
updated: 2026-08-22
depends_on: []
links: []
---

# Bundle src/public into two ES-module bundles and obfuscate them

## 1. Requirement

Convert `src/public/` from classic scripts that share globals into real ES modules.
Bundle the module graph into one IIFE per HTML page with esbuild. Then run
`javascript-obfuscator` over each bundle.

Two pages exist. `index.html` gets one bundle named `home.js`. `board.html` gets one
bundle named `app.js`. The output filenames do not change, so no other file in the
repository must change.

This is steps 4 and 5 of an 11-step source-hardening plan. It raises the cost of
reading the shipped code. It is not a security boundary.

Scope is `src/public/`, `tools/`, and `package.json` only. This plan does not touch
`src/server.ts`, `src/lib/`, or any `electron/*` file.

## 2. Acceptance criteria

1. `src/public/tsconfig.json` uses a module setting that permits `import` and `export`.
2. `tsc -p src/public/tsconfig.json` passes with `strict: true` and reports no errors.
3. `npm run build` produces exactly two JavaScript files under `dist/public/`:
   `home.js` and `app.js`.
4. No other `.js` file remains under `dist/public/` after a build, including files
   left by an earlier build.
5. `index.html` loads exactly one script, `home.js`. `board.html` loads exactly one
   script, `app.js`.
6. The home page and the board page work in a plain browser tab through `npm start`.
7. The home page and the board page work in Electron through `npm run electron:dev`.
8. The browser tab path proves `browser-ipc-shim` still installs `window.praxisAPI`
   before any page code calls it.
9. The Electron path proves the shim does not overwrite the preload's `window.praxisAPI`.
10. `npm run build:release` produces obfuscated bundles.
11. The obfuscated bundles contain no `eval(`, no `new Function(`, and no bare
    `Function(` call. A build-time check enforces this and fails the build.
12. Both pages load under the existing CSP with zero CSP violation messages in the
    browser console.
13. `src/server.ts` is not modified. The CSP string is not modified.
14. No file under `electron/` is modified.
15. The footer version line that WS-58 adds still renders on both pages, in a browser
    tab and in Electron, with `app-version.ts` inside the bundle and with no
    `app-version.js` script tag and no `dist/public/app-version.js` file left on disk.
    This criterion belongs to Stage 2, not Stage 3.

## 3. Chosen approach

### 3.1 Summary

Make each `src/public/*.ts` file a real module. Keep `app.ts` and `home.ts` as the two
entry points. Turn `tsc` into a type-checker only. Add one new build script,
`tools/bundle-public.mjs`, that runs esbuild and then, on demand, `javascript-obfuscator`.

The obfuscation and minification pass is gated behind a `--harden` flag on the new
script. `npm run build` produces readable bundles for development. `npm run build:release`
produces hardened bundles and is what the three `package:*` scripts call.

### 3.2 Why the flag

The module conversion is the risky part. It runs on every build, hardened or not, so
the risky part is always exercised. Minification and obfuscation are cosmetic
transforms on top. Gating only the cosmetic layer keeps `npm start` and
`npm run electron:dev` debuggable, and still ships hardened code in every package.

A CLI flag is used instead of an environment variable because `package:win` runs on
Windows, where `VAR=1 npm run build` does not work in `cmd.exe`.

### 3.3 Rejected alternatives

1. **Always obfuscate, one single build chain.** Simplest, and dev output would match
   shipped output exactly. Rejected because this app has a first-class browser mode
   used for real development work, and mangled names plus a base64 string array make
   every `npm start` session hard to debug.
2. **`format: "esm"` with esbuild code splitting and `type="module"` script tags.**
   Would share `ipc-adapter` between the two pages instead of duplicating it.
   Rejected because it adds a chunk-loading network waterfall, adds more output files
   to keep in step with the HTML, and buys nothing: the duplicated code is about 110
   lines. IIFE keeps one file per page, which is the stated target end state.
3. **New wrapper entry files, for example `entry-home.ts`, to force load order.**
   Rejected as unnecessary. An `import './browser-ipc-shim'` placed first in each entry
   file gives the same guarantee with no new files, because ES module evaluation follows
   import declaration order depth-first.
4. **Keep `tsc` emitting, and bundle the emitted `dist/public/*.js`.** Rejected because
   it keeps readable per-file JavaScript on disk inside `dist/`, which
   `electron-builder` ships through its `dist/**/*` glob. That would defeat the point.
5. **`moduleResolution: "node16"` with explicit `.js` specifiers.** Rejected in favour
   of `"bundler"` with extensionless specifiers, which both `tsc` and esbuild resolve
   with no ambiguity and no `.js`-means-`.ts` rewriting rule to rely on.

## 4. Design

### 4.0 The sixth file: `app-version.ts` from WS-58

This plan was first written against five compiled files. WS-58 (`app-version-display`,
plan `PLN-48-jznrar`) adds a sixth, `src/public/app-version.ts`, and the approved
execution order runs WS-58 first. This plan therefore designs for six files.

What WS-58 leaves behind, taken from its own plan text:

- A new `src/public/app-version.ts`, written as a classic script with no `import` and
  no `export`, because `module: "none"` is still in force while WS-58 runs.
- A sixth entry, `"app-version.ts"`, in `src/public/tsconfig.json`'s `include` array.
- A `<div id="app-version" hidden></div>` in the existing `<footer class="note">` of
  both `index.html` and `board.html`.
- A `<script src="app-version.js"></script>` tag on each page, placed after
  `browser-ipc-shim.js`.

The file's whole job is one side effect: call `window.praxisAPI.getAppVersion()` and
write the result into `#app-version`. It exports nothing and nothing calls into it.

**Decision.** `app-version.ts` becomes a real ES module with an explicit `export {};`
and no runtime imports, and each entry file gains a side-effect import
`import './app-version';` placed immediately after `import './browser-ipc-shim';`.
Its logic then reaches both bundles the same way it reached both pages before: once
per page, from that page's own entry point.

Three reasons:

1. It matches the pattern this plan already uses. Section 3.3 rejected wrapper entry
   files because an `import './browser-ipc-shim'` placed first already guarantees load
   order. The same guarantee covers `app-version`: ES module evaluation is depth-first
   in import-declaration order, so the shim's side effect installs `window.praxisAPI`
   before `app-version`'s side effect reads it. In Electron the question does not
   arise, because `electron/preload.cts` installs `window.praxisAPI` through
   `contextBridge` before any renderer script runs at all.
2. It keeps WS-58's single-responsibility design intact. The file stays a self-running
   unit that knows only about `getAppVersion()` and `#app-version`. Exporting an `init`
   function and calling it from both entry points would add a call site in each large
   page script for no behaviour gain.
3. `export {};` is required, not decorative. Without an `import` or an `export` the
   file is a global script, not a module. Under `module: "esnext"` its top-level `const`
   declarations would then sit in the global scope and could collide with another
   file's names, and `isolatedModules` would not protect it. The empty export is the
   smallest change that makes it a module, and it needs no named export because
   nothing imports from it.

It needs no type import either. `window.praxisAPI` is typed by the `declare global`
block that section 4.3 puts in `ipc-adapter.ts`, and a global augmentation applies
across the whole program, not only to files that import it.

Two alternatives were considered and rejected. Making `app-version.ts` a third esbuild
entry point would leave a third output file and a second script tag on each page, which
breaks acceptance criterion 5. Importing it into `ipc-adapter.ts` instead of into the
entry files would make a shared, side-effect-free helper start running I/O on import,
which is worse than one line in each entry file.

This plan does not need WS-58 to have executed before this update was written. It needs
only WS-58's plan, which is exact and complete. The safeguard against drift is unchanged
either way: the downstream task-authoring pass re-reads the live file state before it
writes any SEARCH/REPLACE text, so every anchor in section 4 is an illustration of the
intended target state, not a promise about byte-exact incoming text.

### 4.1 Module graph

Two entry points. Import order inside each entry file is load-bearing.

`home.ts` (entry for `index.html`):
```
import './browser-ipc-shim';
import './app-version';
import { unwrapIpc } from './ipc-adapter';
import type { PraxisIpcResult } from './ipc-adapter';
import { resolveBasePathForScope, isEligibleAtScope } from './lib/agentic-tools-scope';
import type { InstallScope } from './lib/agentic-tools-scope';
```

`app.ts` (entry for `board.html`):
```
import './browser-ipc-shim';
import './app-version';
import { unwrapIpc } from './ipc-adapter';
import type { PraxisIpcResult } from './ipc-adapter';
```

`browser-ipc-shim.ts` imports only a type from `ipc-adapter`, so it has no runtime
dependency on it. Its side effect therefore runs first in both bundles.

`app-version.ts` imports nothing at all, so its side effect runs second, after the
shim and before any other page code. That is the order WS-58's script tags produced,
preserved exactly.

`src/types/praxis-data.d.ts` needs no change. It is a declaration file with no
top-level `import` or `export`, so its interfaces stay ambient globals even when the
files that read them become modules. This was verified, not assumed.

### 4.2 Exports to add

| File | Add `export` to |
| --- | --- |
| `src/public/ipc-adapter.ts` | `unwrapIpc`, type `PraxisIpcResult`, interface `PraxisAPI` |
| `src/public/lib/agentic-tools-scope.ts` | `resolveBasePathForScope`, `isEligibleAtScope`, type `InstallScope`, interface `DetectionResultLike` |
| `src/public/app-version.ts` | nothing named. Add a bare `export {};` only, per section 4.0 |

`httpError` in `ipc-adapter.ts` stays private. Only `unwrapIpc` calls it.

### 4.3 Window augmentation

Both `interface Window { ... }` declarations must move into a `declare global` block,
or they stop merging with the DOM `Window`.

In `src/public/ipc-adapter.ts`:
```ts
declare global {
  interface Window {
    praxisAPI: PraxisAPI;
  }
}
```

In `src/public/home.ts`, the same treatment for `praxisSkillInstallAPI`. That block
references `InstallScope`, which `home.ts` now imports. An imported type is visible
inside `declare global`, so this compiles.

`window.praxisAPI` itself is unchanged at runtime. It is still written either by
`electron/preload.cts` through `contextBridge`, or by the shim's fallback. Only the
type declaration syntax changes.

### 4.4 `src/public/tsconfig.json`

Target state:

```jsonc
{
  "compilerOptions": {
    "target": "es2020",
    "lib": ["dom", "es2020"],
    "module": "esnext",              // real modules; esbuild bundles the graph
    "moduleResolution": "bundler",   // extensionless relative imports, same as esbuild
    "isolatedModules": true,         // esbuild transpiles file-by-file; this catches what it cannot
    "types": [],                     // load-bearing: without it tsc auto-includes @types/node
    "noEmit": true,                  // esbuild owns emit; tsc is the type-check gate only
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["app.ts", "home.ts", "ipc-adapter.ts", "browser-ipc-shim.ts", "app-version.ts", "../types/praxis-data.d.ts", "lib/agentic-tools-scope.ts"]
}
```

Notes on each change:
- `module: "none"` becomes `"esnext"`. `"bundler"` resolution requires `"esnext"`,
  not `"es2020"`.
- `rootDir` and `outDir` are removed. They only controlled emit, and there is no emit.
- `noEmitOnError` is removed. With `noEmit`, `tsc` still exits non-zero on a type
  error, which is what the `&&` chain needs.
- The `include` array keeps every entry it has. Six files are listed once WS-58 has
  landed, not five: `"app-version.ts"` is WS-58's addition and stays.
  `../types/praxis-data.d.ts` is ambient and never imported, so it must stay listed.
  The rest are now reachable by import, but listing them costs nothing and keeps the
  file self-documenting. This section replaces the whole file, so the position of
  `"app-version.ts"` in the incoming array does not matter.
- The comment on `module` is rewritten, not dropped. The comment on `types` is kept
  verbatim, because it is still true and still load-bearing.

### 4.5 `tools/bundle-public.mjs`

Follows `tools/copy-assets.mjs`'s conventions: plain ESM `.mjs`,
`fileURLToPath(import.meta.url)` to find the repository root, one `console.log` per
action, no build framework. It additionally imports `esbuild` and
`javascript-obfuscator`, which are devDependencies.

Behaviour:

1. Read `process.argv` for `--harden`.
2. Sweep `dist/public/` for stale `.js` files and delete them. This removes
   `ipc-adapter.js`, `browser-ipc-shim.js` and `lib/agentic-tools-scope.js` left by
   any earlier build, and `app-version.js` once WS-58 has landed. Without this,
   `electron-builder`'s `dist/**/*` glob would ship readable, unobfuscated copies of
   the very code this workstream hardens. The first three exist in `dist/public/`
   right now. The fourth appears as soon as WS-58 builds. The sweep is a wildcard over
   `.js` files, not a fixed list, so it needs no edit when the file count changes.
3. Run `esbuild.build` once with both entry points:
   ```js
   {
     entryPoints: { home: 'src/public/home.ts', app: 'src/public/app.ts' },
     bundle: true,
     format: 'iife',
     target: 'es2020',
     platform: 'browser',
     charset: 'utf8',
     legalComments: 'none',
     sourcemap: false,
     minify: harden,
     outdir: 'dist/public',
     write: false
   }
   ```
   `write: false` keeps the output in memory, so a failed obfuscation never leaves a
   half-written `dist/public/`.
4. If `--harden`, pass each bundle through `javascript-obfuscator` with the config in
   section 4.6.
5. Run the eval guard from section 4.7 over the final text of each bundle. Throw on a
   hit, before anything is written.
6. Write `dist/public/home.js` and `dist/public/app.js`. Log one line each.

`charset: 'utf8'` matters because the UI strings contain em dashes and other
non-ASCII characters. Without it esbuild escapes them, which bloats the output and
makes the string-array pass noisier.

### 4.6 Obfuscator configuration

```js
{
  target: 'browser',
  compact: true,
  identifierNamesGenerator: 'mangled',
  stringArray: true,
  stringArrayEncoding: ['base64'],
  splitStrings: true,
  splitStringsChunkLength: 8,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  domainLock: [],
  renameGlobals: false,
  renameProperties: false,
  transformObjectKeys: false
}
```

The last four entries are all defaults, but they are stated explicitly because each
one would break this app if it were ever flipped on:

- `renameGlobals: false` — the bundle reads real browser globals: `window`, `document`,
  `fetch`, `localStorage`. Renaming them breaks everything.
- `renameProperties: false` — this is the important one. The renderer calls
  `window.praxisAPI.listProjects`, `window.praxisSkillInstallAPI.detectTools` and four
  more names across the `contextBridge` boundary. Those property names are a contract
  with `electron/preload.cts`, which is compiled separately and is out of scope.
  Renaming them silently breaks Electron mode while the browser mode keeps working.
- `transformObjectKeys: false` — the renderer builds object literals that become JSON
  request bodies for `/api/*`. Key transformation is semantics-preserving in principle,
  but there is no reason to take the risk.
- `domainLock: []` — the app is served from `localhost` and from `file:`-adjacent
  Electron contexts. A domain lock is both wrong here and an `eval` source.

`selfDefending`, `debugProtection` and `domainLock` are excluded by the parent
consultation for reasons unrelated to CSP as well: they trap the app's own debugger
and crash reporting for only hours of attacker delay.

### 4.7 The CSP eval guard

The chosen option set is expected to emit no `eval`-family call. `stringArray` with
`base64` encoding emits a hand-written decoder function. `splitStrings` emits string
concatenation. `identifierNamesGenerator: 'mangled'` only renames. None of these is
documented to construct code at runtime.

This plan does not assert that as verified fact. It makes it a build gate instead.
`tools/bundle-public.mjs` scans the final text of each bundle for `eval(`,
`new Function(` and `Function(`, and throws before writing if any matches. The build
then fails loudly rather than shipping a bundle the CSP will refuse to run.

If the guard ever fires, the documented fallback is to drop `stringArrayEncoding` to
`[]`, which gives a plain, unencoded string array and removes the decoder entirely.

The guard is a substring scan, not a parse. It can produce a false positive if a
literal string in the source contains `eval(`. No such string exists today. If one
appears, the fix is to narrow the guard, not to remove it.

### 4.8 HTML changes

The line numbers below are the state after WS-58 lands. WS-58 inserts one
`<script src="app-version.js"></script>` tag after `browser-ipc-shim.js` on each page,
so each block is one line longer than it is today, and each page's block starts one
line later. Treat the numbers as approximate. The task-authoring pass re-reads both
files and anchors on the tag text, not on the line numbers.

`src/public/index.html`, before, five tags at about lines 71-75:
```html
<script src="ipc-adapter.js"></script>
<script src="browser-ipc-shim.js"></script>
<script src="app-version.js"></script>
<script src="lib/agentic-tools-scope.js"></script>
<script src="home.js"></script>
```
After, one tag:
```html
<script src="home.js"></script>
```

`src/public/board.html`, before, four tags at about lines 129-132:
```html
<script src="ipc-adapter.js"></script>
<script src="browser-ipc-shim.js"></script>
<script src="app-version.js"></script>
<script src="app.js"></script>
```
After, one tag:
```html
<script src="app.js"></script>
```

The single tag absorbs `app-version.js`. Its code is inside the bundle, pulled in by
the `import './app-version';` line in each entry file per section 4.1, so it needs no
tag of its own and no separate output file. Acceptance criterion 5 therefore still
reads "exactly one script per page" with six source files, exactly as it did with five.

The `<div id="app-version" hidden></div>` element that WS-58 adds to each
`<footer class="note">` is not touched. It is markup, not a script, and the bundled
code still finds it by id.

No `defer`, no `async`, no `type="module"`. Both tags stay immediately before
`</body>`, exactly where they are today. This keeps the current execution timing:
the DOM is fully parsed before the bundle runs.

### 4.9 `package.json` scripts

```json
"build:base": "tsc -p tsconfig.json && tsc -p src/public/tsconfig.json && tsc -p electron/tsconfig.json && node tools/copy-assets.mjs",
"build": "npm run build:base && node tools/bundle-public.mjs",
"build:release": "npm run build:base && node tools/bundle-public.mjs --harden",
```

- `prestart`, `prerefresh` and `electron:dev` keep calling `npm run build`. They are
  not edited.
- `package:mac`, `package:linux` and `package:win` change from `npm run build` to
  `npm run build:release`. That is the only edit to those three lines.
- `tsc -p src/public/tsconfig.json` stays in the chain and is now a pure type check.
  It runs before the bundler, and `&&` makes a type error stop the build. That
  replaces the safety net that `noEmitOnError` used to provide.
- `build:base` exists so the two build chains do not duplicate four commands.

### 4.10 devDependencies

Add `esbuild` and `javascript-obfuscator`. Neither is present today, in
`package.json`, `package-lock.json` or `node_modules/`.

esbuild installs a platform-specific native binary through a postinstall step. The
README currently describes `npm install` as "TypeScript toolchain (devDependencies
only)". This is a change in the character of the install, not just its size. It does
not affect the packaged app, because `electron-builder` ships `dist/**/*` and
`package.json` only, never `node_modules/`.

### 4.11 Comments that become false

The current comments document the `module: "none"` regime in detail. Several become
wrong the moment the conversion lands, and must be rewritten in the same change:

| File | Region | What it claims today |
| --- | --- | --- |
| `src/public/tsconfig.json` | the `module` line | that an added import is a compile error |
| `src/public/ipc-adapter.ts` | lines 1-6 | that adding `export` would break the global declarations |
| `src/public/browser-ipc-shim.ts` | lines 1-13 | that it relies on `ipc-adapter.ts`'s file-scope globals |
| `src/public/lib/agentic-tools-scope.ts` | lines 1-2 | "Classic script ... no import/export statements permitted" |
| `src/public/app-version.ts` | its header comment | that it uses no `import` or `export` because `module: "none"` rejects a module file. WS-58's plan writes this comment. It is false the moment `export {};` is added |
| `src/public/home.ts` | lines 1-11 | why `InstallScope` is not redeclared, referring to script tag order |
| `src/public/home.ts` | lines 398-399 | "not imported, since this is a classic script" |
| `src/public/app.ts` | lines 19-21 | that `WS_ID_TAIL` cannot be shared "because this file compiles as a classic script" |

The `app.ts` note needs care. After bundling, the real reason that fragment is not
shared with `src/lib/extract.ts` is that the browser bundle must not pull in
Node-side server code, not that the file is a classic script. Correct the reason;
do not deduplicate the regex. That deduplication is out of scope.

`src/types/praxis-data.d.ts`'s header comment stays as it is. It is still true.

## 5. Stages

Riskiest first. Each stage ends with a working application.

### Stage 1 — Add the two devDependencies

Install `esbuild` and `javascript-obfuscator` as devDependencies. Nothing else changes.
The build still works exactly as before.

Done when: both appear in `package.json` and in the lockfile, and `npm run build`
still succeeds unchanged.

### Stage 2 — Convert to modules and bundle, unhardened

This is the whole risk of the workstream in one slice.

Six source files are converted, not five. The sixth is `src/public/app-version.ts`,
which WS-58 creates. Section 4.0 states the decision for it.

1. Add `export` per section 4.2. That is named exports in `ipc-adapter.ts` and
   `lib/agentic-tools-scope.ts`, and a bare `export {};` in `app-version.ts`.
2. Move both `interface Window` blocks into `declare global` per section 4.3.
3. Add the imports per section 4.1: `import './browser-ipc-shim';` first in each entry
   file, then `import './app-version';`, then the rest.
4. Rewrite `src/public/tsconfig.json` per section 4.4, keeping all six `include`
   entries.
5. Write `tools/bundle-public.mjs` per section 4.5, esbuild only, no obfuscator call
   yet. Include the stale-file sweep and the eval guard from the start.
6. Collapse the script tags per section 4.8. Each page's block loses one more tag than
   this plan first assumed, because `app-version.js` is in it.
7. Rewire `package.json` per section 4.9, adding `build:base` and `build`. Leave
   `build:release` and the `package:*` edits for Stage 3.
8. Fix the comments listed in section 4.11, including `app-version.ts`'s header.

Files this stage targets: `src/public/app.ts`, `src/public/home.ts`,
`src/public/ipc-adapter.ts`, `src/public/browser-ipc-shim.ts`,
`src/public/app-version.ts`, `src/public/lib/agentic-tools-scope.ts`,
`src/public/tsconfig.json`, `src/public/index.html`, `src/public/board.html`,
`tools/bundle-public.mjs` (new), and `package.json`.

Done when acceptance criteria 1 to 9 and criterion 15 pass.

### Stage 3 — Layer on the obfuscator

1. Add the `--harden` branch to `tools/bundle-public.mjs`: `minify: true` for esbuild,
   plus the obfuscator pass with the config in section 4.6.
2. Add `build:release` to `package.json`.
3. Point `package:mac`, `package:linux` and `package:win` at `build:release`.

Done when acceptance criteria 10 to 14 pass.

## 6. Verification

This repository has no test runner. `package.json` has no `test` script and there is
no test directory. Verification is a manual checklist plus the two automated checks
already built into `tools/bundle-public.mjs`, which are the stale-file sweep and the
eval guard.

Run this checklist at the end of Stage 2, and again at the end of Stage 3 against a
`npm run build:release` output.

1. `npm run build` exits zero.
2. `ls -R dist/public` shows exactly two `.js` files, no `dist/public/lib/` directory
   containing JavaScript, and no `dist/public/app-version.js`.
3. `npm start`, then load `http://localhost:4173/`. Project tiles render. The add-project
   form works. The browser console shows no error and no CSP violation.
4. On the home page, open the integrations panel. Tool detection renders and the
   scope switch behaves. This is the path that exercises `resolveBasePathForScope`
   and `isEligibleAtScope` across the new module boundary.
5. From the home page, open a project board. KPIs, columns, panels and the detail
   modal all render. This exercises `unwrapIpc` in `app.ts`.
6. In the same browser tab, confirm `window.praxisAPI` exists. This proves the shim's
   side effect ran, and proves it ran before the page code needed it.
7. `npm run electron:dev`. Both pages render. Confirm the native folder picker button
   appears, which only happens when the preload's `pickProjectFolder` is present.
   This proves the shim did not overwrite the `contextBridge` object.
7a. In both modes and on both pages, confirm the footer still shows WS-58's version
   line. This is acceptance criterion 15. It proves the side-effect import in each
   entry file ran, and that it ran after `window.praxisAPI` was installed.
8. After Stage 3 only: `grep -c 'unwrapIpc' dist/public/app.js` returns 0. That is the
   proof that top-level names are actually being renamed, which is the entire point
   of the bundling work.
9. After Stage 3 only: repeat checks 3 to 7 against the hardened bundles.

Regression risk to watch: a name that was previously global and is now missing an
import will fail at `tsc`, not at runtime, because `strict` and `noImplicitAny` are
on. That is the desired failure mode and is why the type check stays in the chain.

## 7. Assumptions

Each of these is a decision taken because the Context left it open. Each is
reversible.

1. **Obfuscation is release-only, not on every build.** `npm run build` produces
   readable bundles. `npm run build:release` produces hardened ones, and the three
   `package:*` scripts use it. Reasoning in section 3.2.
2. **Minification is tied to the same `--harden` flag.** One switch, two modes, rather
   than two independent knobs. A hardened build is minified and obfuscated. A normal
   build is neither.
3. **No source maps, in either mode.** The build emits none today, and a source map
   alongside an obfuscated bundle would undo the obfuscation for anyone who fetched it.
4. **Version ranges** `esbuild@^0.25` and `javascript-obfuscator@^4` are the intended
   floors. The exact resolved versions come from `npm install` and land in the lockfile.
   These were not verified against the registry while writing this plan.
5. **`moduleResolution: "bundler"` with extensionless relative specifiers.** Both `tsc`
   and esbuild resolve these identically, with no extension-rewriting rule involved.
6. **`isolatedModules: true` is added.** esbuild transpiles each file alone, so it
   cannot see across files. This flag makes `tsc` reject the constructs esbuild would
   silently mishandle. It is a guard on the chosen approach, not a general cleanup.
7. **The eval guard is a build-time substring scan, not a proof.** Section 4.7 explains
   why, and states the fallback.
8. **`dist/` is never cleaned wholesale.** The sweep in section 4.5 removes only `.js`
   files under `dist/public/`. Adding a global `dist/` clean would change build
   behaviour for the server and Electron outputs too, which is out of scope.
9. **WS-58 lands before this workstream, and this plan designs against WS-58's plan,
   not against WS-58's executed output.** The approved execution order puts WS-58
   (`PLN-48-jznrar`) first, so `src/public/app-version.ts` exists when this work starts.
   This plan did not wait for WS-58 to run. WS-58's plan is exact about what it creates,
   which is enough to design against. The safeguard is unchanged by this: the downstream
   task-authoring pass re-reads every target file and re-derives each SEARCH anchor from
   the live text. If WS-58 lands differently from its plan, that pass catches it before
   any SEARCH/REPLACE text is written. The `depends_on` frontmatter key is left empty,
   because the ordering is held by the approved execution order, not by this file.

## 8. Open questions

These need a decision from the user. Nothing downstream should be built on a guess
for any of them.

1. Should obfuscation run on every build instead of only on `build:release`? The plan
   assumes release-only, for renderer debuggability. If the priority is that shipped
   output is byte-identical to what was tested during development, the answer changes
   and section 4.9 collapses to a single chain.
2. The repository contains both `package-lock.json` and `bun.lock`. Adding two
   devDependencies updates one of them. Should `bun.lock` be regenerated in the same
   change, left to go stale, or is it already unused?
3. `README.md`'s "How it fits together" tree lists `tools/copy-assets.mjs` and
   `src/public/tsconfig.json` with descriptions that this change makes incomplete or
   wrong. The Context does not list `README.md` as a file this work touches. Should
   the README tree be updated as part of this workstream, or tracked separately?
4. esbuild's install pulls a platform-specific native binary. Is that acceptable for
   every machine and every CI runner that builds this app, including the Windows and
   Linux package targets?
5. Should `npm run build:release` be reachable from anywhere other than the three
   `package:*` scripts? A developer who wants to reproduce shipped output locally
   currently has to know the script name. No other affordance is planned.

## 9. Out of scope (not actioned)

Noted only. No work is planned for any of these.

- `src/public/app.ts`'s `WS_ID_TAIL` regex duplicates `artefactIdNumber` in
  `src/lib/extract.ts`. Bundling does not make sharing them appropriate, because the
  browser bundle must not pull in Node-side server code.
- `src/public/home.ts` line 400 declares a structural copy of `InstallScope` inline.
  Once `InstallScope` is imported, that copy could use the imported type. Only the
  stale comment above it is corrected by this plan.
- No file under `electron/` is read, edited, or planned against.
- `src/server.ts`, `src/lib/` and their module system are untouched, per the
  constraints already settled upstream.

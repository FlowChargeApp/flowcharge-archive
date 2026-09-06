---
id: TL-44-lappit
type: tasklist
workstream: WS-46-6hl7r7
slug: packaged-app-registry-path
title: "Give the packaged app a writable registry path via PRAXIS_DATA_DIR"
status: done
created: 2026-08-19
updated: 2026-08-19
author: Anthony Koukoullis
depends_on: [PLN-37-6b49ti]
links: []
mode: spec
base_commit: 4d7bd65
---

# PRX Tasks

## Give the packaged app a writable registry path via PRAXIS_DATA_DIR

`src/lib/projects.ts` currently computes its registry directory as a hardcoded
`__dirname`-relative `repoRoot`, which resolves inside the read-only `app.asar`
archive once `electron-builder` packages `dist/`, confirmed by building and
running the packaged macOS app: it created a phantom self-entry project on
first launch and every real add/rename/remove then failed. This task list
implements PLN-37-6b49ti's chosen fix: `src/lib/projects.ts` reads one optional
env var, `PRAXIS_DATA_DIR`, for the registry file's directory, falling back to
today's `repoRoot` computation when unset (dev, browser-tab, and
`electron:dev` behavior stays byte-identical); the same var's mere presence
also gates off `selfEntry()`'s dogfooding `ENOENT` fallback, so a packaged
first launch starts with an empty registry rather than a self-entry pointing
at a bundle with no board data. `electron/main.cts` sets
`process.env.PRAXIS_DATA_DIR = app.getPath('userData')` only when
`app.isPackaged`, immediately before its existing dynamic
`import('../server.js')` call. Two stages, mirroring the plan's own
breakdown: Phase 1 makes the env var meaningful to `projects.ts` and adds unit
coverage; Phase 2 wires `main.cts` to set it. `projects.ts` and
`electron/main.cts` were both read in full during authoring and match what
the plan's Design section assumes exactly (allowing for the plan's own
Design-section snippets being abridged illustrations, not literal quotes) —
no `## Divergences` section is needed.

- [x] 1. Phase 1 — `PRAXIS_DATA_DIR` support and packaged self-entry gate in `projects.ts`

  ```yaml
  description: "src/lib/projects.ts reads PRAXIS_DATA_DIR for the registry directory, falling back to repoRoot when unset, and gates selfEntry()'s ENOENT fallback on the var's presence; new node:test unit coverage for both set-branch behaviors."
  ```

  - [x] 1.1 Update src/lib/projects.ts
    ```yaml
    description: "Add dataDir/isPackaged constants derived from PRAXIS_DATA_DIR, derive registryPath from dataDir, gate readProjects()'s ENOENT branch on isPackaged, and update the file's header comment."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Update the file header comment (lines 1-3, currently 'owns .praxis-projects.json at the repo root and the six operations over it') to note that the registry's directory can be overridden by PRAXIS_DATA_DIR — it no longer unconditionally lives at the repo root."
      - "Immediately after the existing `const repoRoot = path.join(__dirname, '..', '..');` (line 14) and before the existing `const registryPath = path.join(repoRoot, '.praxis-projects.json');` (line 15), insert `const dataDir = process.env.PRAXIS_DATA_DIR || repoRoot;` and rewrite the registryPath line to derive from `dataDir` instead of `repoRoot`. Add `const isPackaged = Boolean(process.env.PRAXIS_DATA_DIR);` alongside it. `repoRoot` itself stays exactly as computed today and keeps being used by selfEntry() (lines 24-32) for its own path — only registryPath's source changes. Illustrative, re-derive against the file as read, do not copy verbatim: `const dataDir = process.env.PRAXIS_DATA_DIR || repoRoot; const registryPath = path.join(dataDir, '.praxis-projects.json'); const isPackaged = Boolean(process.env.PRAXIS_DATA_DIR);`"
      - "Comment the new constants to explain the coupling: electron/main.cts sets PRAXIS_DATA_DIR only when app.isPackaged, so its mere presence doubles as the 'are we running from a packaged app.asar' signal without this file importing 'electron' or knowing anything about packaging beyond one env var — unset in dev, a plain browser tab, and `npm run electron:dev`, so dataDir falls back to repoRoot exactly as before."
      - "In readProjects()'s catch block (current line 59: `return (err as NodeJS.ErrnoException).code === 'ENOENT' ? [selfEntry()] : [];`), change the ENOENT branch so a packaged run (isPackaged true) returns `[]` instead of `[selfEntry()]` on first-run ENOENT; every non-ENOENT error still returns `[]` exactly as today. selfEntry() itself (lines 24-32) stays untouched — it is simply never called when isPackaged is true. Illustrative: `if ((err as NodeJS.ErrnoException).code !== 'ENOENT') return []; return isPackaged ? [] : [selfEntry()];`"
    pattern: "src/lib/projects.ts"
    imports: "node:fs, node:path, node:crypto, node:url — all already imported; no new imports needed"
    compatibility: "Compiled via `tsc -p tsconfig.json` as an ESM module (import.meta.url already in use at line 10); must gain no 'electron' import, preserving the WS-37/WS-38 boundary; follows the same optional-env-var-with-hardcoded-fallback shape as PORT/HOST at src/server.ts:12-13"
    gotcha: "dataDir must fall back to repoRoot byte-identically when PRAXIS_DATA_DIR is unset, or the dev/browser/electron:dev registry location silently moves; isPackaged must be derived from that same env var's presence, not a separate flag, per the plan's rejected-alternative #3; addProject()'s path.resolve(absPath) handling (line 74) must stay untouched — this only changes where the registry file itself lives"
    verify:
      - "npm run build (runs tsc -p tsconfig.json among its other steps) compiles with no errors"
      - "grep -rn \"from 'electron'\" src/lib/*.ts src/server.ts returns nothing"
    checklist:
      - "registryPath is derived from dataDir, not directly from repoRoot"
      - "repoRoot is still computed and still used for selfEntry()'s own path"
      - "isPackaged is Boolean(process.env.PRAXIS_DATA_DIR), not a separate env var or flag"
      - "readProjects()'s ENOENT branch returns [] when isPackaged is true and [selfEntry()] otherwise; non-ENOENT errors still return []"
      - "header comment (lines 1-3) reflects that the registry directory can be overridden"
      - "no 'electron' import added anywhere in src/lib/*.ts or src/server.ts"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Add src/lib/projects.test.ts
    ```yaml
    description: "New node:test unit test file covering the two independently-verifiable behaviors: PRAXIS_DATA_DIR redirects the registry file, and a packaged first run starts empty instead of with a self-entry."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create new file src/lib/projects.test.ts, following the same convention as the existing src/lib/extract.test.ts (read in full this session): a node:test file with a header comment naming its run command (`node --test dist/lib/projects.test.js` after `npm run build`), using os.tmpdir()/fs.mkdtempSync for isolated temp directories, and fs.rmSync(..., { recursive: true, force: true }) cleanup in a finally block."
      - "Because dataDir/isPackaged are read from process.env.PRAXIS_DATA_DIR once at module top-level, ESM module caching means a single test process can't exercise both the unset and set branches by importing the module twice — spawn the compiled dist/lib/projects.js in a child process (node:child_process execFileSync) with a controlled environment for each set-branch case, per the plan's Testing strategy section."
      - "Test 1 — 'PRAXIS_DATA_DIR override redirects the registry file': spawn dist/lib/projects.js's addProject() (via a small child-process driver script or an execFileSync invocation of node -e that imports the compiled module) with PRAXIS_DATA_DIR set to a fresh fs.mkdtempSync directory and a throwaway project path argument; assert .praxis-projects.json was created inside that temp directory, not at the real repo root."
      - "Test 2 — 'packaged first run starts empty, not with a self-entry': same child-process approach, PRAXIS_DATA_DIR set to a fresh empty temp directory (guaranteeing ENOENT on the first readProjects() call); assert the returned list is []."
      - "Do not add a test for the unset-PRAXIS_DATA_DIR (dev/browser/electron:dev) path — per the plan's Testing strategy, doing so would either mutate the real repo's own .praxis-projects.json as a side effect of the test suite, or require refactoring repoRoot/registryPath into injectable parameters purely to make them mockable, which is more production-code surface than this fix calls for. That path's regression coverage is the existing dev workflow itself."
    pattern: "src/lib/projects.test.ts (new file)"
    imports: "node:test, node:assert/strict, node:fs, node:os, node:path, node:child_process (execFileSync); targets the compiled dist/lib/projects.js as its child-process subject"
    compatibility: "Same node:test + tmpdir pattern as src/lib/extract.test.ts; this repository has no npm test script — tests are compiled by `npm run build` and run by hand via `node --test dist/lib/projects.test.js`, per that file's own convention"
    gotcha: "Must not read or write the real repo's own .praxis-projects.json at any point — always operate inside a freshly created fs.mkdtempSync directory passed via PRAXIS_DATA_DIR to the child process, and always clean it up even when an assertion throws"
    verify:
      - "npm run build compiles dist/lib/projects.test.js with no errors"
      - "node --test dist/lib/projects.test.js passes, exercising both new unit tests"
    checklist:
      - "Test file follows the node:test / os.tmpdir()+fs.mkdtempSync pattern used by src/lib/extract.test.ts"
      - "Both set-branch cases spawn the compiled module in a child process with PRAXIS_DATA_DIR set, rather than importing it twice in-process"
      - "Override test asserts .praxis-projects.json is created inside the temp directory, not at the real repo root"
      - "Packaged-first-run test asserts readProjects() returns [] (no self-entry) on a fresh empty temp directory"
      - "No test exercises the unset-PRAXIS_DATA_DIR path in isolation"
      - "Every temp directory created by the test is removed even when an assertion throws"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — Wire electron/main.cts to set the signal when packaged

  ```yaml
  description: "electron/main.cts sets process.env.PRAXIS_DATA_DIR = app.getPath('userData') only when app.isPackaged, immediately before its existing dynamic import('../server.js') call. Depends on Phase 1: the env var must already be meaningful to projects.ts before anything sets it."
  ```

  - [x] 2.1 Update electron/main.cts
    ```yaml
    description: "Insert an if (app.isPackaged) block setting process.env.PRAXIS_DATA_DIR before the existing dynamicImport('../server.js') call inside app.whenReady()."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read as of base_commit 4d7bd65. Apply the SEARCH/REPLACE block below verbatim: it inserts the packaged-signal block immediately before the existing `const dynamicImport = ...` declaration inside `app.whenReady().then(async () => { ... })`, so PRAXIS_DATA_DIR is set before `../server.js` (and therefore projects.ts, which server.ts imports) ever evaluates its top-level consts."
    mode: diff
    pattern: "electron/main.cts"
    imports: "app from 'electron', already imported at electron/main.cts:8; no new imports"
    compatibility: "Compiled via tsc -p electron/tsconfig.json; lands inside the same app.whenReady().then(...) callback that already wires SERVER_URL and registerIpcHandlers() — no new function, no new file"
    gotcha: "app.isPackaged is false under npm run electron:dev, so this block must no-op there, leaving electron:dev behavior unchanged; the assignment must execute strictly before the dynamicImport('../server.js') call or projects.ts's top-level consts will already have evaluated with the var unset"
    verify:
      - "npm run build (runs tsc -p electron/tsconfig.json among its other steps) compiles with no errors"
      - "grep -n \"app.isPackaged\" electron/main.cts confirms the assignment sits inside app.whenReady() and precedes the dynamicImport('../server.js') call; full behavioral proof (npm run package:mac, launch the .dmg, confirm add/rename/remove/list against userData) is WS-39's own Phase 2 task and is intentionally not re-run here"
    checklist:
      - "if (app.isPackaged) block sets process.env.PRAXIS_DATA_DIR = app.getPath('userData')"
      - "the block is placed strictly before the dynamicImport('../server.js') call"
      - "no change to npm run electron:dev behavior (app.isPackaged is false there, so the block no-ops)"
      - "electron/ipc-handlers.cts and electron/preload.cts remain untouched"
    self_eval:
      passed: true
      failures: []
    ```
    ```ts
    electron/main.cts
    <<<<<<< SEARCH
      const dynamicImport = new Function('specifier', 'return import(specifier)') as (
        specifier: string
      ) => Promise<unknown>;
      await dynamicImport('../server.js');
    =======
      // Mirrors src/lib/projects.ts's own PRAXIS_DATA_DIR read: only this
      // packaged-vs-not check belongs here, because only Electron's main process
      // knows app.isPackaged. Unset in `npm run electron:dev` (app.isPackaged is
      // false there), so dev Electron behaves exactly as it does today.
      if (app.isPackaged) {
        process.env.PRAXIS_DATA_DIR = app.getPath('userData');
      }

      const dynamicImport = new Function('specifier', 'return import(specifier)') as (
        specifier: string
      ) => Promise<unknown>;
      await dynamicImport('../server.js');
    >>>>>>> REPLACE
    ```

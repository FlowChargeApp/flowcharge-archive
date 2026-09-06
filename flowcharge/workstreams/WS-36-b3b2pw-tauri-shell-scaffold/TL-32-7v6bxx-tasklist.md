---
id: TL-32-7v6bxx
type: tasklist
workstream: WS-36-b3b2pw
slug: tauri-shell-scaffold
title: "Wrap the frontend in a native Electron shell that starts and points at the existing server"
status: done
created: 2026-08-17
updated: 2026-08-18
author: Anthony Koukoullis
depends_on: [PLN-26-fdxv4m]
links: []
mode: spec
base_commit: 0d82a04
---

# PRX Tasks

## Electron shell scaffold

Implements PLN-26-fdxv4m: wrap the existing, unmodified browser frontend in a native
Electron window pointed at the already-running server's hardcoded URL,
`http://127.0.0.1:4173` (src/server.ts:12-13) — the same way a browser tab hits it
today. Nothing under `src/` changes. A new `electron/` directory (`main.cts`,
`preload.cts`, `tsconfig.json`) carries the main process: it dynamically
`import()`s the already-compiled `dist/server.js`, whose module-evaluation side
effect is `server.listen()` (src/server.ts:332), polls `http://127.0.0.1:4173`
until it answers, then opens a `BrowserWindow` pointed at that URL. Source files
use the `.cts` extension so TypeScript always compiles them to CommonJS `.cjs`
output regardless of the root `package.json`'s `"type": "module"` — the plan's
settled resolution of the CJS-vs-ESM question, not deferred. `electron` (`^43`) is
the only new npm package; `preload.cts` stays a structural stub with no
`contextBridge` calls, since IPC is WS-37's job. The five stages below mirror the
plan's own phases 1–5 one-to-one: scaffold/toolchain wiring, main-process server
bring-up and window, then three sequential native verifies on the three machines
named in the plan (macOS, Debian 11, Windows 11 ARM) — the last of which proves
only the ARM leg, not Intel/AMD Windows, per the plan's stated gap. Both open
questions the plan lists (package-lock.json vs bun.lock; the exact Electron `^43`
pin) are settled for this task list: npm/Node is the canonical toolchain and
`^43` is tasked as written, per the instructions this list was authored under.

- [x] 1. Phase 1 — `electron/` scaffold and toolchain wiring

  ```yaml
  description: "Add the electron/ directory (main.cts, preload.cts, tsconfig.json placeholders) and wire package.json (electron devDependency, main field, extended build script, electron:dev script). New files and additive package.json edits only; no server-bring-up logic yet."
  ```

  - [x] 1.1 Add placeholder `electron/main.cts`
    ```yaml
    description: "Create electron/main.cts as a placeholder that compiles cleanly via the .cts extension. No app.whenReady/server/BrowserWindow logic yet — that is Phase 2 (task 2.1)."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create electron/main.cts as a new file, sibling-to-be of preload.cts and tsconfig.json inside a new electron/ directory (a sibling of src/, dist/, tools/)."
      - "Content is a minimal placeholder only — for example a header comment stating this file becomes the Electron main process in Phase 2, plus a no-op statement (e.g. `export {};`) so the file is a valid module. Do not import 'electron' yet and do not add app.whenReady/server-import/BrowserWindow logic here — that full contract is task 2.1's job, per the plan's Phase 1/Phase 2 split."
      - "Use the .cts extension deliberately, not .ts — per the plan's Design section, TypeScript always compiles .cts to CommonJS .cjs output regardless of the root package.json's \"type\": \"module\", which is the settled resolution of this workstream's one open technical question."
    pattern: "electron/main.cts (new file)"
    imports: "None yet — no 'electron' import in this placeholder"
    compatibility: "Must use the .cts source extension so TypeScript emits main.cjs; must not anticipate Phase 2's server/window logic"
    gotcha: "Do not add an 'electron' import here — the electron devDependency is not installed until task 1.4, so importing it now would leave the placeholder uncompilable until that later task lands, breaking task ordering."
    verify:
      - "After task 1.3 adds electron/tsconfig.json, run `npx tsc -p electron/tsconfig.json` — exits 0"
      - "Confirm dist/electron/main.cjs was produced by that compile"
    checklist:
      - "electron/main.cts exists and uses the .cts extension"
      - "File contains no 'electron' import and no app.whenReady/server/BrowserWindow logic"
      - "No file under src/ was touched"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Add placeholder `electron/preload.cts`
    ```yaml
    description: "Create electron/preload.cts as a placeholder that compiles cleanly via the .cts extension. Stays a near-empty structural stub through Phase 2 as well, per the plan's fixed IPC-is-WS-37's-job boundary."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create electron/preload.cts as a new file alongside main.cts."
      - "Content is a minimal placeholder — a header comment stating this file is the preload script wired via webPreferences.preload in Phase 2, plus a no-op statement (e.g. `export {};`). No contextBridge.exposeInMainWorld call, now or in Phase 2 — per the plan's Scope, that is WS-37's job."
      - "Use the .cts extension for the same CommonJS-emission reason as main.cts."
    pattern: "electron/preload.cts (new file)"
    imports: "None"
    compatibility: "Must use the .cts source extension so TypeScript emits preload.cjs; must contain no contextBridge.exposeInMainWorld call, in this task or any later one in this plan"
    gotcha: "Resist adding contextBridge scaffolding 'for later' — the plan explicitly rejects authoring real IPC code now, even structurally, since there is no IPC surface to expose until WS-37."
    verify:
      - "After task 1.3 adds electron/tsconfig.json, run `npx tsc -p electron/tsconfig.json` — exits 0"
      - "Confirm dist/electron/preload.cjs was produced by that compile"
    checklist:
      - "electron/preload.cts exists and uses the .cts extension"
      - "grep -c contextBridge electron/preload.cts returns 0"
      - "No file under src/ was touched"
    self_eval:
      passed: true
      failures:
        - item: "grep -c contextBridge electron/preload.cts returns 0"
          reason: "First draft's explanatory comment named 'contextBridge.exposeInMainWorld' literally, so grep -c contextBridge matched 1 (a comment line), not the intended 0."
          fix: "Reworded the comment to describe the stub without using the literal string 'contextBridge' — grep -c contextBridge electron/preload.cts now returns 0."
    ```

  - [x] 1.3 Add `electron/tsconfig.json`
    ```yaml
    description: "New tsconfig, sibling to tsconfig.json and src/public/tsconfig.json, compiling main.cts/preload.cts to dist/electron/*.cjs. Matches the plan's Design contract exactly."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create electron/tsconfig.json with exactly the compilerOptions/include from the plan's Design section: target es2022, lib [\"es2022\"], module \"commonjs\", moduleResolution \"node10\", esModuleInterop true, types [\"node\"], rootDir \".\", outDir \"../dist/electron\", strict true, noEmitOnError true, skipLibCheck true; include [\"main.cts\", \"preload.cts\"]."
      - "module: \"commonjs\" is set explicitly even though .cts forces it either way, per the plan's own note — do not omit it as redundant."
      - "Mirror src/public/tsconfig.json's directory-relative-include convention: the include list is bare filenames, not electron/-prefixed paths, because this tsconfig lives inside electron/ itself."
    pattern: "electron/tsconfig.json (new file)"
    imports: "None"
    compatibility: "Must not alter tsconfig.json or src/public/tsconfig.json — this is a third, independent tsconfig"
    gotcha: "outDir is ../dist/electron (relative to electron/), not dist/electron — get this backwards and main.cjs/preload.cjs land in the wrong place, breaking the main field and the preload path task 2.1 computes relative to __dirname."
    verify:
      - "npx tsc -p electron/tsconfig.json — exits 0 once tasks 1.1 and 1.2 have added main.cts/preload.cts"
      - "ls dist/electron — confirms main.cjs and preload.cjs exist"
    checklist:
      - "electron/tsconfig.json's outDir resolves to dist/electron"
      - "include lists exactly main.cts and preload.cts"
      - "module is explicitly \"commonjs\""
      - "tsconfig.json and src/public/tsconfig.json are unchanged"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.4 Wire `package.json` (electron devDependency, main field, build script, electron:dev script)
    ```yaml
    description: "Add electron ^43 as a devDependency, the top-level main field, the third tsc -p electron/tsconfig.json step in build, and the electron:dev script — the four additive package.json edits the plan's Design specifies. No other scripts/keys change."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add a new devDependency: \"electron\": \"^43\" — the current Electron stable major, confirmed by the plan to still ship win32-arm64 prebuilt binaries (Electron 44 drops win32 ia32 and linux armv7l, which is why ^43 is named explicitly rather than left to float)."
      - "Add a new top-level field: \"main\": \"dist/electron/main.cjs\"."
      - "Extend the existing build script to add the third tsc invocation, matching the plan's Design exactly: \"build\": \"tsc -p tsconfig.json && tsc -p src/public/tsconfig.json && tsc -p electron/tsconfig.json && node tools/copy-assets.mjs\"."
      - "Add a new script: \"electron:dev\": \"npm run build && electron .\"."
      - "Read the current package.json (already captured this session: build, prestart, start, prerefresh, refresh scripts; devDependencies @types/node and typescript only) before editing, and change only the four items above — do not reorder or reformat unrelated keys."
      - "No .gitignore change — dist/ is already ignored wholesale (confirmed in the repo's .gitignore) and dist/electron/ falls under it, per the plan's explicit note."
    pattern: "package.json (devDependencies, scripts.build, scripts.electron:dev, top-level main — four keys only)"
    imports: "electron ^43 (new devDependency, via npm install)"
    compatibility: "Must not touch prestart/start/prerefresh/refresh scripts or the existing @types/node/typescript devDependencies; must not introduce any .gitignore change"
    gotcha: "npm install is required after this edit to actually pull the electron ^43 binary and lock it in package-lock.json — the JSON edit alone does not install it. Confirm the package-lock.json (not bun.lock) is updated, per this list's settled npm/Node toolchain assumption."
    verify:
      - "npm install — pulls electron ^43 into node_modules and package-lock.json"
      - "npm run build — exits 0 and produces dist/electron/main.cjs and dist/electron/preload.cjs (the plan's own Phase 1 acceptance check)"
      - "git diff package.json — confirms only the four additive edits (devDependency, main, build script, electron:dev script) changed"
    checklist:
      - "package.json's main field is exactly dist/electron/main.cjs"
      - "build script runs all three tsc invocations plus copy-assets.mjs, in that order"
      - "electron:dev script is exactly \"npm run build && electron .\""
      - "electron is the only new devDependency; prestart/start/prerefresh/refresh scripts are unchanged"
      - "No file under src/ was touched"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — Main-process server bring-up and window

  ```yaml
  description: "Implement main.cts's full contract (dynamic import of dist/server.js, readiness polling, BrowserWindow creation, timeout/error path) and finalize preload.cts as the documented near-empty stub. Dependencies: Phase 1."
  ```

  - [x] 2.1 Implement `electron/main.cts`'s server bring-up and window contract
    ```yaml
    description: "Full main.cts logic per the plan's Design 'main.cts contract': SERVER_URL constant, dynamic import of the compiled server on app.whenReady, readiness polling, BrowserWindow creation with the specified webPreferences, loadURL, and the timeout/error/quit path."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Define a constant SERVER_URL = 'http://127.0.0.1:4173', matching src/server.ts:12-13's own hardcoded host/port defaults exactly."
      - "On app.whenReady(): dynamically import() the compiled server module at a path computed relative to main.cjs's own __dirname — '../server.js', i.e. dist/server.js. This is a plain dynamic import() of an ESM module from CommonJS code (Node supports this), not a require(); the import's module-evaluation side effect is server.listen(port, host, ...) at src/server.ts:332 — no exported start function exists or is added."
      - "Poll SERVER_URL with a plain node:http http.get, at a short fixed interval, up to a bounded timeout — for example every 100ms for up to 10s, matching the plan's stated shape."
      - "On success: create a BrowserWindow with webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.cjs') }, then mainWindow.loadURL(SERVER_URL)."
      - "On timeout: show an error via Electron's dialog module and quit, rather than loading the window against a server that never came up."
      - "main.cts must not read flowcharge/, call /api/* itself, or know anything about the board's data model — it only starts the server module, waits for the port, and opens a window at that URL, per the plan's fixed boundary."
      - "Add no explicit server shutdown logic: src/server.ts registers no signal handlers and calls no process.exit, so Electron's own process teardown on window-close takes the in-process HTTP listener down with it — this satisfies acceptance criterion 4 without new code, per the plan's Design note."
    pattern: "electron/main.cts"
    imports: "electron (app, BrowserWindow, dialog); node:http (readiness poll); node:path (__dirname-relative paths); dynamic import() of ../server.js"
    compatibility: "Must not modify src/server.ts or any src/lib/* module; must rely on server.listen()'s existing side effect, not add a new exported start function to the server"
    gotcha: "The dynamic import path is relative to the compiled main.cjs's own __dirname (dist/electron/), not to the source electron/ directory — '../server.js' from dist/electron/ resolves to dist/server.js, which is correct; getting this relative path wrong is the most likely silent failure mode."
    verify:
      - "npm run build — exits 0 (type-checks and compiles the full contract)"
      - "npm run electron:dev — opens a native window showing the home page at http://127.0.0.1:4173/, and clicking through to a board works identically to the browser (KPIs, columns, cards, issue/severity panels), per the plan's own Phase 2 verify"
    checklist:
      - "SERVER_URL is exactly http://127.0.0.1:4173"
      - "Server bring-up uses dynamic import() of the compiled dist/server.js, not a child_process spawn"
      - "BrowserWindow's webPreferences set contextIsolation: true, nodeIntegration: false, sandbox: true, and point preload at preload.cjs"
      - "Timeout path shows a dialog and quits rather than loading a dead window"
      - "No file under src/ was touched; main.cts contains no flowcharge/ or /api/* references"
    self_eval:
      passed: true
      failures:
        - item: "Server bring-up uses dynamic import() of the compiled dist/server.js, not a child_process spawn"
          reason: "A first draft wrote `await import('../server.js')` (and later a variable-held-specifier variant) directly. TypeScript's module: \"commonjs\" output downlevels a literal import() call into a require()-based helper (`Promise.resolve().then(() => require(s)))`), confirmed by inspecting the emitted dist/electron/main.cjs — this throws ERR_REQUIRE_ESM at runtime because dist/server.js is emitted as ESM (root package.json sets \"type\": \"module\")."
          fix: "Routed the specifier through `new Function('specifier', 'return import(specifier)')`, which hides the import() syntax from tsc's downlevel transform. Re-inspected the emitted dist/electron/main.cjs after rebuilding and confirmed the call is now a genuine native import(), not require()."
    ```

  - [x] 2.2 Finalize `electron/preload.cts` as the documented stub
    ```yaml
    description: "Bring preload.cts to the plan's Design contract: a structural stub whose only purpose is proving the source-to-dist/electron/*.cjs pipeline end-to-end, with a comment explaining why it has no contextBridge calls yet."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Replace the Phase 1 placeholder body with the documented stub described in Design: a comment stating the file exists so webPreferences.preload points at a real compiled file, proving the full build pipeline end-to-end, and that WS-37 will build the IPC bridge on top of it."
      - "Still no contextBridge.exposeInMainWorld call — there is no IPC surface yet, per the plan's fixed boundary."
    pattern: "electron/preload.cts"
    imports: "None"
    compatibility: "Must remain a structural stub only; must not add contextBridge or any 'electron' runtime call"
    gotcha: "It is tempting to add a placeholder contextBridge call 'ready for WS-37' — the plan rejects this outright in Alternatives considered and rejected; keep the file inert."
    verify:
      - "npm run build — exits 0 and produces dist/electron/preload.cjs"
      - "grep -c contextBridge electron/preload.cts — returns 0"
    checklist:
      - "preload.cts contains an explanatory comment, no contextBridge call"
      - "dist/electron/preload.cjs is produced by the build"
      - "webPreferences.preload in main.cts (task 2.1) points at this compiled file"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 3 — macOS build and verify (MacBook Pro M4 Pro, macOS Sequoia)

  ```yaml
  description: "From a clean checkout, npm install then npm run electron:dev on the primary dev machine; confirm home page, board navigation, KPI/issue/severity panels render identically to the browser, and that closing the window leaves nothing listening on port 4173. Verifies acceptance criteria 1, 2, 4 on macOS. Dependencies: Phase 2."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "On the MacBook Pro M4 Pro (macOS Sequoia), from a clean checkout (no server pre-started, no second terminal), run `npm install` followed by `npm run electron:dev`."
    - "Confirm the compiled server comes up and a native Electron window opens showing the same home page (project tiles) as the browser today."
    - "Click a project tile and confirm its board (board.html?project=) renders identically to the browser: KPIs, columns, cards, and issue/severity panels — the same HTTP-served page, unchanged."
    - "Close the Electron window, then confirm no process is left listening on port 4173."
    - "Confirm nothing under src/ was touched by this task, and that npm run build / npm start still work unchanged for a plain-browser user."
  pattern: "No files changed — verification only, on the primary macOS test machine"
  imports: "npm install, npm run electron:dev (as wired in Phase 1 task 1.4)"
  compatibility: "macOS Sequoia, MacBook Pro M4 Pro; must reproduce the browser's rendering exactly, with no Electron-specific visual difference"
  gotcha: "Run from a genuinely clean checkout — a stale dist/ or a server already running in another terminal would mask a real bring-up failure in main.cts's readiness polling."
  verify:
    - "npm install && npm run electron:dev — window opens showing the home page and, after clicking a tile, the full board"
    - "After quitting the app, run `lsof -nP -iTCP:4173 -sTCP:LISTEN` — returns no output, confirming no orphaned process on port 4173"
  checklist:
    - "Home page renders in the native window exactly as in the browser"
    - "Board navigation (KPIs, columns, cards, issue/severity panels) renders exactly as in the browser"
    - "lsof confirms no process listening on port 4173 after the window is closed"
    - "npm run build / npm start remain unaffected; no file under src/ changed"
  self_eval:
    passed: true
    failures: []
  ```

- [x] 4. Phase 4 — Linux build and verify (Dell Latitude, Debian 11)

  ```yaml
  description: "npm install (pulling Electron's prebuilt linux-x64 binary and any documented Electron runtime system packages) then npm run electron:dev on the Dell Latitude; same checks as Phase 3. Verifies acceptance criteria 1, 2, 4 on Debian 11. Sequenced after Phase 3, depends on Phase 2."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "On the Dell Latitude (Debian 11), install any Electron runtime system packages its own documentation calls for on Debian — a documented local prerequisite, not a repo change."
    - "Run `npm install` (pulls Electron's prebuilt linux-x64 binary), then `npm run electron:dev`."
    - "Confirm the same home page and board-navigation rendering as Phase 3 (KPIs, columns, cards, issue/severity panels), and that closing the window leaves nothing listening on port 4173."
    - "Confirm nothing under src/ was touched by this task."
  pattern: "No files changed — verification only, on the Debian 11 test machine"
  imports: "npm install, npm run electron:dev; Electron's documented Debian runtime system packages (local machine prerequisite)"
  compatibility: "Debian 11, Dell Latitude; must reproduce Phase 3's rendering results independently on Linux"
  gotcha: "Debian 11's available runtime packages can differ from newer distros — if a documented Electron Linux prerequisite is unavailable in Debian 11's default repos, that is a real environment gap to record, not to route around with an unrelated workaround."
  verify:
    - "npm install && npm run electron:dev — window opens showing the home page and, after clicking a tile, the full board"
    - "After quitting the app, run `lsof -i :4173` (or `ss -ltnp | grep 4173`) — returns no output, confirming no orphaned process on port 4173"
  checklist:
    - "Home page and board navigation render exactly as in the browser, same as Phase 3"
    - "No orphaned process remains on port 4173 after the window is closed"
    - "No file under src/ changed as part of this task"
  self_eval:
    passed: false
    failures:
      - item: "Not executed"
        reason: "Requires hands-on testing on the physical Dell Latitude (Debian 11) — a machine this Praxis session has no access to. Not attempted, not failed."
        fix: "Deferred at the user's explicit instruction (2026-08-18): checked off so this task list and WS-36 can close and later workstreams can proceed, without deleting or re-authoring this task. The user intends to set up proper Linux testing and revisit this task later; nothing here should be read as 'verified passing' until that happens."
  ```

- [x] 5. Phase 5 — Windows (ARM) build and verify (Windows 11 ARM VM under UTM)

  ```yaml
  description: "npm install (pulling Electron's prebuilt win32-arm64 binary) then npm run electron:dev on the Windows 11 ARM VM; same checks as Phase 3. Verifies acceptance criteria 1, 2, 4 on Windows 11 ARM, and explicitly records that this proves only the ARM build, per acceptance criterion 5. Depends on Phase 2."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "On the Windows 11 ARM VM (UTM on the MacBook), run `npm install` (pulls Electron's prebuilt win32-arm64 binary), then `npm run electron:dev`."
    - "Confirm the same home page and board-navigation rendering as Phase 3 (KPIs, columns, cards, issue/severity panels), and that closing the window leaves nothing listening on port 4173."
    - "Record explicitly, in this task's result, that this leg proves only the win32-arm64 build — it does not exercise win32-x64/ia32, per the plan's Scope item 5. Do not represent this as full Windows coverage anywhere in the task's output."
    - "Confirm nothing under src/ was touched by this task."
  pattern: "No files changed — verification only, on the Windows 11 ARM test machine"
  imports: "npm install, npm run electron:dev"
  compatibility: "Windows 11 ARM (win32-arm64) under UTM; must reproduce Phase 3's rendering results independently, ARM-only"
  gotcha: "UTM's ARM virtualization can surface driver/rendering quirks that would not occur on physical Intel/AMD Windows hardware — a pass here is evidence for win32-arm64 only, and must not be generalized to 'Windows works' in any report of this task's outcome."
  verify:
    - "npm install && npm run electron:dev — window opens showing the home page and, after clicking a tile, the full board"
    - "After quitting the app, run `netstat -ano | findstr :4173` — returns no output, confirming no orphaned process on port 4173"
  checklist:
    - "Home page and board navigation render exactly as in the browser, same as Phase 3"
    - "No orphaned process remains on port 4173 after the window is closed"
    - "The task's own result explicitly states this covers win32-arm64 only, not win32-x64/ia32"
    - "No file under src/ changed as part of this task"
  self_eval:
    passed: false
    failures:
      - item: "Not executed"
        reason: "Requires hands-on testing on the Windows 11 ARM VM under UTM — a machine this Praxis session has no access to. Not attempted, not failed."
        fix: "Deferred at the user's explicit instruction (2026-08-18): checked off so this task list and WS-36 can close and later workstreams can proceed, without deleting or re-authoring this task. The user intends to set up proper Windows testing and revisit this task later; nothing here should be read as 'verified passing' until that happens."
  ```

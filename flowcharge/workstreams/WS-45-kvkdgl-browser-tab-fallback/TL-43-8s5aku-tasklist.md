---
id: TL-43-8s5aku
type: tasklist
workstream: WS-45-kvkdgl
slug: browser-tab-fallback
title: "Restore plain-browser-tab support with a window.praxisAPI fetch shim"
status: done
created: 2026-08-18
updated: 2026-08-18
author: Anthony Koukoullis
depends_on: [PLN-36-vay2my]
links: []
mode: spec
base_commit: 1d1940d
---

# PRX Tasks

## Restore plain-browser-tab support with a window.praxisAPI fetch shim

WS-37 replaced `home.ts`'s and `app.ts`'s `fetch('/api/...')` call sites with direct calls to
`window.praxisAPI.*`, a global that `electron/preload.cts` injects only inside an Electron
`BrowserWindow`. A plain browser tab loading `index.html`/`board.html` over `src/server.ts`'s
plain HTTP server has no `window.praxisAPI`, so those calls throw immediately and nothing
renders — breaking the standing requirement that the browser app and the Electron app run and
test side by side. This task list implements PLN-36-vay2my's chosen fix: one new classic-script
file, `src/public/browser-ipc-shim.ts`, that defines `window.praxisAPI` itself via `fetch()`
against the existing `/api/*` routes, installed only when `window.praxisAPI` is undefined at
script-load time (never a per-call fallback), wired in via one new `<script>` tag in each of
`index.html` and `board.html`, positioned after `ipc-adapter.js` and before `home.js`/`app.js`.
Zero changes to `src/server.ts`, `src/lib/*.ts`, `home.ts`, `app.ts`, `ipc-adapter.ts`, or any
`electron/*.cts` file. Two stages, mirroring the plan's own breakdown: Phase 1 builds and wires
the shim; Phase 2 is a verification-only pass proving both runtimes work side by side, with any
defect it surfaces folded back into Phase 1's files rather than becoming new scope.

No file inspected during authoring diverged from what the plan assumed — see the file states
confirmed at `base_commit` 1d1940d: `src/public/tsconfig.json`'s `include` array, `index.html`
lines 40-41, `board.html` lines 117-118, and `electron/ipc-handlers.cts`'s `loopbackRequest()`
all read exactly as the plan describes them, and `src/public/browser-ipc-shim.ts` does not yet
exist. No `## Divergences` section is needed.

- [x] 1. Phase 1 — Implement and wire the shim

  ```yaml
  description: "Create src/public/browser-ipc-shim.ts and wire it into the build and both HTML pages, exactly as PLN-36-vay2my's Design section specifies."
  ```

  - [x] 1.1 Create src/public/browser-ipc-shim.ts
    ```yaml
    description: "New classic-script module defining fetchIpc() and the six-method window.praxisAPI fallback, installed only when window.praxisAPI is not already present."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create new file `src/public/browser-ipc-shim.ts`. Write it with no `import`/`export` keyword — like `src/public/ipc-adapter.ts` (read in full this session; see its header comment, lines 1-6), every file in `src/public/tsconfig.json`'s `include` list shares one global scope because `module: \"none\"` forces classic scripts, so this file can reference `PraxisIpcResult<T>` and the `Window.praxisAPI`/`PraxisAPI` declarations from `ipc-adapter.ts` (lines 8-10, 28-39) without any import."
      - "Add an internal helper `fetchIpc<T>(method: string, urlPath: string, body?: unknown): Promise<PraxisIpcResult<T>>` that builds a `RequestInit` (JSON body + `Content-Type` header only when `body !== undefined`), calls `fetch(urlPath, init)`, reads the response with `res.text()`, then `JSON.parse`s the raw text inside its own try/catch. This mirrors `electron/ipc-handlers.cts`'s `loopbackRequest()` (read in full this session; its status-to-ok/error mapping and its two-step text-then-parse handling live at that file's response callback, and its network-failure catch-all lives at its `req.on('error')` handler) so the returned shape is contractually identical: it must never reject, and a non-2xx/3xx status or malformed body must resolve `{ ok: false, status, error }` with the real HTTP status attached, never lose the status the way a bare `res.json()` rejection would."
      - "Illustrative shape only (full code is given verbatim in plan.md's Design section, under '### New module: `src/public/browser-ipc-shim.ts`' — copy it from there, it is the literal spec for this file): `if (status < 400) return { ok: true, status, data: parsed as T }; else return { ok: false, status, error: <derived from parsed.error or 'HTTP '+status> };` and a top-level `.catch(err => ({ ok: false, status: 0, error: ... }))` around the whole `fetch()` chain."
      - "Add the six-method fallback: `if (!window.praxisAPI) { window.praxisAPI = { listProjects, addProject, renameProject, removeProject, getProjectData, getWorkstreamDetail }; }`. Each method is a thin wrapper over `fetchIpc()`, matching `electron/ipc-handlers.cts`'s six channels and `electron/preload.cts`'s six `praxisAPI` methods exactly in name, argument order, HTTP method, URL path, and `encodeURIComponent` encoding of `id`/`wsId` (the same encoding `home.ts`'s pre-WS-37 code and `ipc-handlers.cts` already use). The full object literal — all six methods with their exact paths — is given verbatim in plan.md's Design section; copy it from there rather than re-deriving the routes."
      - "The `if (!window.praxisAPI)` guard is the entire fallback decision: a one-time existence check at script-load time, never a per-call try/catch around any of the six methods (see plan.md's '## Alternatives considered and rejected', item 1, for why a per-call fallback is explicitly rejected — it would mask a genuinely broken Electron IPC channel)."
    pattern: "src/public/browser-ipc-shim.ts (new file)"
    imports: "References PraxisIpcResult<T> and the PraxisAPI/Window.praxisAPI declarations from src/public/ipc-adapter.ts via shared global scope — no explicit import statement (module: \"none\")."
    compatibility: "Must compile under src/public/tsconfig.json's strict mode once added to its include array (task 1.2); target es2020, lib dom+es2020; no import/export permitted anywhere in the file."
    gotcha: "Every sendJson() response src/server.ts sends always has a JSON body (confirmed by the plan's own inspection of src/server.ts), so the empty-body branch (raw ? JSON.parse(raw) : undefined) is defensive parity with loopbackRequest(), not a case this server produces today — implement it anyway for contract parity, do not skip it as dead code. A rejected fetch() (network failure, offline, aborted) must resolve, not throw, or callers of unwrapIpc() would see an unhandled rejection instead of the expected thrown Error & { status: number }."
    verify:
      - "npm run build"
      - "test -f dist/public/browser-ipc-shim.js && echo PRESENT"
    checklist:
      - "File contains no import/export keyword anywhere"
      - "fetchIpc() resolves (never rejects) in every branch: 2xx/3xx success, >=400 with parseable body, malformed JSON body, and network failure"
      - "All six window.praxisAPI methods encodeURIComponent their id/wsId arguments exactly like electron/ipc-handlers.cts's six channels"
      - "window.praxisAPI assignment is wrapped in `if (!window.praxisAPI) { ... }` with no per-call try/catch fallback anywhere in the file"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Add browser-ipc-shim.ts to src/public/tsconfig.json's include array
    ```yaml
    description: "Register the new file with the existing tsc -p src/public/tsconfig.json build step so it compiles into dist/public/browser-ipc-shim.js alongside ipc-adapter.js."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In `src/public/tsconfig.json`, add `\"browser-ipc-shim.ts\"` to the `include` array, read this session as `[\"app.ts\", \"home.ts\", \"ipc-adapter.ts\", \"../types/praxis-data.d.ts\"]` (line 15)."
      - |
        SEARCH/REPLACE block:

        ```json
        src/public/tsconfig.json
        <<<<<<< SEARCH
          "include": ["app.ts", "home.ts", "ipc-adapter.ts", "../types/praxis-data.d.ts"]
        =======
          "include": ["app.ts", "home.ts", "ipc-adapter.ts", "browser-ipc-shim.ts", "../types/praxis-data.d.ts"]
        >>>>>>> REPLACE
        ```
      - "No change to tools/copy-assets.mjs: it only copies non-.ts assets; compiled .js output lands in dist/public/ on its own via tsc's rootDir/outDir mapping, the same way ipc-adapter.js does today — do not touch that file."
    pattern: "src/public/tsconfig.json"
    imports: "None."
    compatibility: "Depends on task 1.1's file existing at src/public/browser-ipc-shim.ts before this include entry is exercised by a build; order of authoring the two tasks does not matter, but a build run for verification needs both."
    gotcha: "This is the only tsconfig in the repo governing src/public/ — do not confuse with the root tsconfig.json or electron/tsconfig.json, neither of which this plan touches."
    verify:
      - "npm run build"
      - "grep -n 'browser-ipc-shim.ts' src/public/tsconfig.json"
    checklist:
      - "include array now lists browser-ipc-shim.ts alongside the three existing entries and the .d.ts entry, none removed"
      - "tools/copy-assets.mjs left byte-for-byte unchanged"
      - "npm run build completes with no TypeScript errors"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Add the browser-ipc-shim.js script tag to index.html
    ```yaml
    description: "Load the shim before home.js so window.praxisAPI exists by the time home.ts's top-level initialization runs."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In `src/public/index.html`, insert `<script src=\"browser-ipc-shim.js\"></script>` between the existing `ipc-adapter.js` and `home.js` script tags, read this session at lines 40-41."
      - |
        SEARCH/REPLACE block:

        ```html
        src/public/index.html
        <<<<<<< SEARCH
        <script src="ipc-adapter.js"></script>
        <script src="home.js"></script>
        =======
        <script src="ipc-adapter.js"></script>
        <script src="browser-ipc-shim.js"></script>
        <script src="home.js"></script>
        >>>>>>> REPLACE
        ```
      - "Order relative to ipc-adapter.js does not matter (that file only declares types/functions and never touches window.praxisAPI). Order relative to home.js is load-bearing: home.ts calls window.praxisAPI.* synchronously during its own top-level initialization, so the shim tag must execute before home.js's tag — do not place it after."
    pattern: "src/public/index.html"
    imports: "None."
    compatibility: "Depends on task 1.1 (browser-ipc-shim.ts) and 1.2 (tsconfig include) so dist/public/browser-ipc-shim.js actually exists at the referenced path when this page is served."
    gotcha: "Do not reorder ipc-adapter.js relative to the new tag, and do not place the new tag after home.js — home.ts reads window.praxisAPI synchronously at load time (see home.ts's top-level initialization call)."
    verify:
      - "npm run build"
      - "grep -n 'script src=' dist/public/index.html"
    checklist:
      - "Exactly one new <script> line added, referencing browser-ipc-shim.js"
      - "New tag sits after ipc-adapter.js and before home.js in document order"
      - "No other line in index.html changed"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.4 Add the browser-ipc-shim.js script tag to board.html
    ```yaml
    description: "Load the shim before app.js so window.praxisAPI exists by the time app.ts's top-level initialization runs."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In `src/public/board.html`, insert `<script src=\"browser-ipc-shim.js\"></script>` between the existing `ipc-adapter.js` and `app.js` script tags, read this session at lines 117-118."
      - |
        SEARCH/REPLACE block:

        ```html
        src/public/board.html
        <<<<<<< SEARCH
        <script src="ipc-adapter.js"></script>
        <script src="app.js"></script>
        =======
        <script src="ipc-adapter.js"></script>
        <script src="browser-ipc-shim.js"></script>
        <script src="app.js"></script>
        >>>>>>> REPLACE
        ```
      - "Order relative to ipc-adapter.js does not matter. Order relative to app.js is load-bearing: app.ts calls window.praxisAPI.* synchronously during its own top-level initialization (multiple call sites), so the shim tag must execute before app.js's tag."
    pattern: "src/public/board.html"
    imports: "None."
    compatibility: "Depends on task 1.1 (browser-ipc-shim.ts) and 1.2 (tsconfig include) so dist/public/browser-ipc-shim.js actually exists at the referenced path when this page is served."
    gotcha: "Do not reorder ipc-adapter.js relative to the new tag, and do not place the new tag after app.js — app.ts reads window.praxisAPI synchronously at multiple top-level call sites."
    verify:
      - "npm run build"
      - "grep -n 'script src=' dist/public/board.html"
    checklist:
      - "Exactly one new <script> line added, referencing browser-ipc-shim.js"
      - "New tag sits after ipc-adapter.js and before app.js in document order"
      - "No other line in board.html changed"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — Verify both runtimes side by side
  ```yaml
  description: "Verification-only pass: no code changes expected. If a defect surfaces, fold the fix back into Phase 1's files (tasks 1.1-1.4) rather than authoring new scope here."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Run `npm start` (plain HTTP server, no Electron) and open `http://127.0.0.1:4173` in an ordinary browser tab. Confirm project tiles render via listProjects() populating #project-tiles (Scope acceptance criterion 1)."
    - "In that same plain-browser session, exercise addProject, renameProject, and removeProject, confirming each produces the same UI outcome home.ts's existing .then/.catch chains already implement, including the existing special case where a 404 from removeProject is read as err.status === 404 and silently refreshes a stale tile (Scope acceptance criterion 2)."
    - "Open a project's board (board.html) in the plain browser tab and confirm it loads via getProjectData(); open a workstream's detail modal and confirm it loads via getWorkstreamDetail() (Scope acceptance criterion 3)."
    - "With the same server still running, run `npm run electron:dev` and confirm the Electron window still works exactly as after WS-37 (Scope acceptance criterion 4), and that both runtimes tolerate running concurrently against the same .praxis-projects.json registry (Scope acceptance criterion 6)."
    - "Confirm via browser DevTools (or a temporary console.log, removed before commit — never left in) that the browser tab's window.praxisAPI is the shim's fetchIpc-backed object, and that the Electron window's window.praxisAPI is still preload.cts's IPC-backed object — i.e. the existence check actually branched both ways."
    - "Confirm src/server.ts's /api/* routes and src/lib/*.ts remain byte-for-byte untouched by this workstream (Scope acceptance criterion 5)."
  pattern: "Manual/integration verification across src/public/index.html, src/public/board.html, running under both npm start and npm run electron:dev — no source files edited by this task unless it surfaces a Phase 1 defect."
  imports: "None."
  compatibility: "Depends on Phase 1 (tasks 1.1-1.4) being complete and built."
  gotcha: "This layer has no automated test coverage today (per plan.md's Testing strategy) — home.ts, app.ts, ipc-adapter.ts, and electron/*.cts are integration-verified by hand, which this task follows rather than introducing a new browser-test framework as scope creep. A per-call fallback masking a broken Electron IPC channel would look like a pass here but is exactly the regression this plan exists to prevent — watch specifically that the Electron window's praxisAPI is the IPC-backed object, not the shim, during this check."
  verify:
    - "Manual: npm start, then open http://127.0.0.1:4173 in a plain browser tab and walk through all six Scope acceptance criteria (1-6) listed in implement above, in one sitting, with npm run electron:dev running concurrently for criteria 4 and 6."
    - "git status confirms src/server.ts and every file under src/lib/ show no changes from this workstream (criterion 5)."
  checklist:
    - "Plain-browser tab renders project tiles on load (criterion 1)"
    - "Plain-browser add/rename/remove project all work, including the 404-on-remove stale-tile refresh case (criterion 2)"
    - "Plain-browser board.html and workstream detail modal both load correctly (criterion 3)"
    - "Electron window (npm run electron:dev) still works exactly as after WS-37, using preload.cts's window.praxisAPI, not the shim (criterion 4)"
    - "Both runtimes run concurrently against the same .praxis-projects.json without conflict (criterion 6)"
    - "src/server.ts and src/lib/*.ts remain byte-for-byte untouched (criterion 5)"
  self_eval:
    passed: true
    failures: []
  ```

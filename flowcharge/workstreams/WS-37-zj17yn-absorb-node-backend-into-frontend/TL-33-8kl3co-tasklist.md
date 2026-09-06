---
id: TL-33-8kl3co
type: tasklist
workstream: WS-37-zj17yn
slug: absorb-node-backend-into-frontend
title: "Bridge app.ts/home.ts's fetch calls to server.ts's routes over Electron IPC"
status: done
created: 2026-08-17
updated: 2026-08-18
author: Anthony Koukoullis
depends_on: [PLN-27-wp9kt5]
links: []
mode: spec
base_commit: 0d82a04
---

# PRX Tasks

## Absorb Node Backend Into Frontend

Implements PLN-27-wp9kt5: replaces all seven `fetch('/api/...')` call sites in
`src/public/home.ts` (4) and `src/public/app.ts` (3) with calls through Electron IPC,
exposed to the renderer as `window.praxisAPI.*`. `src/server.ts`'s six route handlers are
not copied or edited — each of six new `ipcMain.handle` channels makes a loopback HTTP
request to the same `http://127.0.0.1:4173/api/...` endpoint the browser calls today and
relays the JSON result back over IPC as a structured `{ok, status, data|error}` value, so
every validation rule keeps living in exactly the one place it lives today. `server.ts`'s
HTTP listener, and everything under `src/lib/*.ts`, stay untouched and fully reachable from
an ordinary browser tab. This plan builds on WS-36's Electron scaffold
(`electron/main.cts`, `electron/preload.cts`, `electron/tsconfig.json`), which is a stated
dependency, not yet landed as of this list's `base_commit` — see Divergence 1. The six
tasks below mirror the plan's own six phases one-to-one, in order: the main-process IPC
bridge, the preload contextBridge exposure, the shared renderer-side adapter, the two
call-site migrations (`home.ts` then `app.ts`), and a final browser-path regression check
that touches no files.

- [x] 1. Phase 1 — Main-process IPC bridge

  ```yaml
  description: "Export main.cts's SERVER_URL constant, add electron/ipc-handlers.cts (the loopbackRequest helper and six ipcMain.handle registrations), and wire main.cts to register them once the readiness poll succeeds and before BrowserWindow.loadURL. Files: electron/main.cts, new electron/ipc-handlers.cts, electron/tsconfig.json."
  ```

  - [x] 1.1 electron/main.cts — export SERVER_URL, register ipc-handlers.cts
    ```yaml
    description: "Add an export keyword to main.cts's existing SERVER_URL constant, and call ipc-handlers.cts's registration function once the readiness poll succeeds, before BrowserWindow.loadURL runs — the only two edits this plan makes to main.cts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "electron/main.cts does not exist in this repo as of base_commit 0d82a04 — WS-36 (TL-32-7v6bxx), which creates it, has status in-progress. This task is authored prose-only, describing the two edits to make once WS-36's main.cts lands, per its own documented shape (a SERVER_URL constant, an app.whenReady() readiness-polling handler, then BrowserWindow creation). See Divergence 1."
      - "Add export to main.cts's existing `const SERVER_URL = 'http://127.0.0.1:4173'` (or equivalent) declaration — the one field ipc-handlers.cts (task 1.2) imports rather than re-hardcoding."
      - "Immediately after the readiness poll resolves (the point where main.cts already knows dist/server.js is answering) and before the BrowserWindow.loadURL(SERVER_URL) call, invoke the registration function ipc-handlers.cts exports (task 1.2) — e.g. `registerIpcHandlers();` — so every window.praxisAPI.* channel is live before the page's own scripts run on load."
    pattern: "electron/main.cts"
    imports: "electron/ipc-handlers.cts's registration function (task 1.2)"
    compatibility: "This is the one and only edit this plan makes to main.cts beyond the registration call — no other line of main.cts changes (plan Scope, acceptance criterion 2's parenthetical)."
    gotcha: "electron/main.cts does not exist yet in this checkout — this task has no file to edit until WS-36 lands. Do not author a literal SEARCH/REPLACE block against content that cannot be read this session. See Divergence 1."
    verify:
      - "Once WS-36 lands and this edit is applied: npm run build exits 0 (electron's tsconfig step, per WS-36's own build script)."
      - "With the Electron app running, an ad-hoc ipcRenderer.invoke('listProjects') from the devtools console (or a temporary console.log in main.cts) resolves — proving SERVER_URL's export and the registration call both wired correctly (plan's own Phase 1 verify step)."
    checklist:
      - "SERVER_URL carries an export keyword and no other part of its declaration changes."
      - "The registration call happens after the readiness poll succeeds and before BrowserWindow.loadURL."
      - "No line of main.cts outside these two edits changes."
      - "npm run build succeeds once WS-36's scaffold and this edit both exist."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 electron/ipc-handlers.cts (new) — loopbackRequest helper, six ipcMain.handle registrations
    ```yaml
    description: "Add the new file carrying the shared loopbackRequest(method, urlPath, body?) helper and the six ipcMain.handle registrations that relay to server.ts's /api/* routes."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create electron/ipc-handlers.cts, a new file with no existing content to diverge from, even though the electron/ directory itself does not exist yet in this checkout — author it against the plan's own contract (Design > IPC channel surface, Design > The structured-result contract) so it is ready to drop in once WS-36's electron/ scaffold lands. See Divergence 1."
      - "Define PraxisIpcResult<T> = {ok:true, status:number, data:T} | {ok:false, status:number, error:string} (illustrative, per plan Design)."
      - "Add loopbackRequest(method, urlPath, body?): a single node:http-based helper (no new dependency), sending to SERVER_URL (imported from main.cts, task 1.1's export). Reads the full response body, JSON.parses it. status < 400 resolves {ok:true, status, data:parsed}; status >= 400 resolves {ok:false, status, error: parsed.error ?? 'HTTP ' + status}. A JSON.parse failure or a connection-level 'error' event resolves {ok:false, status, error: message} rather than rejecting — never a second error path for callers to handle."
      - "Register six ipcMain.handle channels, one per row of the plan's IPC channel surface table: listProjects (GET /api/projects), addProject (POST /api/projects, body {path}), renameProject (PATCH /api/projects/:id, body {name}), removeProject (DELETE /api/projects/:id), getProjectData (GET /api/projects/:id/data), getWorkstreamDetail (GET /api/projects/:id/workstreams/:wsId/detail) — each a one-line call into loopbackRequest, URL-encoding ids/names with encodeURIComponent exactly as home.ts already does today before this change."
      - "Export one registration function (e.g. registerIpcHandlers()) that performs all six ipcMain.handle calls, for main.cts (task 1.1) to call once."
    pattern: "electron/ipc-handlers.cts (new)"
    imports: "node:http; ipcMain from 'electron'; SERVER_URL from './main.cjs' (or the equivalent relative specifier once main.cts compiles to main.cjs, per WS-36's .cts convention)"
    compatibility: "Zero edits to src/server.ts or src/lib/*.ts — every validation rule (path/tilde/absolute, name length/control-chars, WORKSTREAM_ID shape) keeps running exactly where it runs today, exercised as an ordinary HTTP request from server.ts's point of view (plan's Design, Option 1)."
    gotcha: "This file cannot be type-checked or built until electron/tsconfig.json (task 1.3) and electron/main.cts's SERVER_URL export (task 1.1) both exist — author against the plan's contract now, verify once WS-36 lands. See Divergence 1. Six specific named handlers only — never a generic {method, path, body} pass-through channel (plan Scope's explicit exclusion)."
    verify:
      - "Once WS-36's scaffold and task 1.1 both land: npm run build exits 0 and produces dist/electron/ipc-handlers.cjs."
      - "With the Electron app running, an ad-hoc ipcRenderer.invoke('listProjects') from the devtools console returns a {ok:true, status:200, data:{projects:[...]}} shape (plan's own Phase 1 verify step)."
    checklist:
      - "loopbackRequest is the single shared implementation behind all six handlers — no handler duplicates its request/response logic."
      - "Every one of the six channels is a named, narrow function — no generic invoke surface exists."
      - "loopbackRequest never rejects its returned promise for an HTTP-level or JSON.parse failure — both resolve a {ok:false, ...} value."
      - "Ids and names passed into loopback URLs are encodeURIComponent-encoded."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.3 electron/tsconfig.json — add ipc-handlers.cts to include array
    ```yaml
    description: "Add ipc-handlers.cts to electron/tsconfig.json's include array, alongside main.cts and preload.cts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "electron/tsconfig.json does not exist in this repo as of base_commit 0d82a04 — WS-36 (TL-32-7v6bxx), which creates it, has status in-progress. This task is authored prose-only: once that file exists (per WS-36's own documented shape — a .cts-to-.cjs CommonJS-output config, per plan Assumptions), add 'ipc-handlers.cts' to its include array alongside the entries WS-36 already lists for main.cts and preload.cts. See Divergence 1."
    pattern: "electron/tsconfig.json"
    imports: "n/a"
    compatibility: "Must keep the same module/target settings WS-36's electron/tsconfig.json already sets, so ipc-handlers.cts compiles to CommonJS .cjs output exactly like main.cts and preload.cts, per the plan's own .cts convention."
    gotcha: "Do not author a literal SEARCH/REPLACE block against content that cannot be read this session — the file does not exist yet. See Divergence 1."
    verify:
      - "Once WS-36's scaffold lands and this edit is applied: npx tsc -p electron/tsconfig.json --noEmit exits 0."
      - "npm run build produces dist/electron/ipc-handlers.cjs alongside main.cjs and preload.cjs."
    checklist:
      - "ipc-handlers.cts is added to the include array; no other key in electron/tsconfig.json changes."
      - "tsc -p electron/tsconfig.json --noEmit succeeds once the file and task 1.1/1.2 all exist."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — Preload contextBridge exposure
  ```yaml
  description: "Replace preload.cts's stub body with a contextBridge.exposeInMainWorld('praxisAPI', {...}) call exposing six thin ipcRenderer.invoke wrappers, one per channel. File: electron/preload.cts."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "electron/preload.cts does not exist in this repo as of base_commit 0d82a04 — WS-36 (TL-32-7v6bxx), which creates it as 'a structural stub with no contextBridge calls', has status in-progress. This task is authored prose-only, describing the replacement to make once WS-36's stub lands. See Divergence 1."
    - "Replace the stub body with contextBridge.exposeInMainWorld('praxisAPI', { listProjects: () => ipcRenderer.invoke('listProjects'), addProject: (path) => ipcRenderer.invoke('addProject', path), renameProject: (id, name) => ipcRenderer.invoke('renameProject', id, name), removeProject: (id) => ipcRenderer.invoke('removeProject', id), getProjectData: (id) => ipcRenderer.invoke('getProjectData', id), getWorkstreamDetail: (id, wsId) => ipcRenderer.invoke('getWorkstreamDetail', id, wsId) }) — six thin one-line wrappers, matching task 1.2's six channel names exactly."
    - "No adapter or error-translation logic belongs in this file — it only forwards the raw PraxisIpcResult promise, keeping preload.cts as narrow as Electron's own contextBridge guidance recommends (plan Design)."
  pattern: "electron/preload.cts"
  imports: "contextBridge, ipcRenderer from 'electron'"
  compatibility: "Each of the six wrappers must return a Promise (acceptance criterion 3) and match task 1.2's channel names byte-for-byte, or window.praxisAPI.* calls in home.ts/app.ts (tasks 4, 5) reject with Electron's generic \"No handler registered for 'channel'\" error instead of the errors the plan's IPC contract defines."
  gotcha: "electron/preload.cts does not exist yet in this checkout — this task has no file to edit until WS-36 lands. Do not author a literal SEARCH/REPLACE block against content that cannot be read this session. See Divergence 1."
  verify:
    - "Once WS-36's stub lands and this edit is applied: npm run build exits 0."
    - "In the running Electron window's devtools console, window.praxisAPI exists and each of its six methods (listProjects, addProject, renameProject, removeProject, getProjectData, getWorkstreamDetail) is a function (plan's own Phase 2 verify step)."
  checklist:
    - "All six window.praxisAPI methods exist and each returns a Promise."
    - "Each method name matches task 1.2's ipcMain.handle channel name exactly."
    - "No error-translation or adapter logic lives in preload.cts."
    - "npm run build succeeds once WS-36's scaffold and this edit both exist."
  self_eval:
    passed: true
    failures: []
  ```

- [x] 3. Phase 3 — Renderer-side adapter

  ```yaml
  description: "Add the shared src/public/ipc-adapter.ts (PraxisIpcResult, httpError, unwrapIpc, ambient Window.praxisAPI typing), include it in src/public/tsconfig.json, and load it via a new <script> tag ahead of home.js/app.js on both pages. Files: new src/public/ipc-adapter.ts, src/public/tsconfig.json, src/public/index.html, src/public/board.html."
  ```

  - [x] 3.1 src/public/ipc-adapter.ts (new) — PraxisIpcResult, httpError, unwrapIpc, ambient typings
    ```yaml
    description: "Add the one new shared file both home.ts and app.ts depend on: the PraxisIpcResult type, httpError (moved here from home.ts), unwrapIpc, and the ambient PraxisAPI / Window.praxisAPI declaration."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/public/ipc-adapter.ts. Declare type PraxisIpcResult<T> = {ok:true; status:number; data:T} | {ok:false; status:number; error:string} at file scope, per plan Design's structured-result contract."
      - "Move httpError(status, message) here verbatim from home.ts:58-62 (var err = new Error(message) as Error & {status:number}; err.status = status; return err;) — home.ts drops its private copy in task 4."
      - "Add unwrapIpc<T>(result: PraxisIpcResult<T>): T — if (!result.ok) throw httpError(result.status, result.error); return result.data; (illustrative, per plan Design's exact snippet)."
      - "Add the ambient interface PraxisAPI { listProjects(): Promise<PraxisIpcResult<ProjectList>>; addProject(path: string): Promise<PraxisIpcResult<{project: ProjectEntry}>>; renameProject(id: string, name: string): Promise<PraxisIpcResult<{project: ProjectEntry}>>; removeProject(id: string): Promise<PraxisIpcResult<{deleted: ProjectEntry}>>; getProjectData(id: string): Promise<PraxisIpcResult<BoardPayload>>; getWorkstreamDetail(id: string, wsId: string): Promise<PraxisIpcResult<PraxisWorkstreamDetail>>; } and interface Window { praxisAPI: PraxisAPI } — one method per task 1.2/2's six channels, request/response shapes matching what home.ts's/app.ts's existing call sites already expect from their .json() bodies today."
      - "Declare every symbol at file scope with no top-level import or export keyword — src/public/tsconfig.json's module: 'none' (unchanged by this plan) turns an import/export into a compile error, exactly as praxis-data.d.ts's own header comment states for the ambient types home.ts/app.ts already share ('adding a top-level import or export here would turn this file into a module and the interfaces would stop being global')."
    pattern: "src/public/ipc-adapter.ts (new)"
    imports: "n/a — ambient/global declarations only, no import statements permitted"
    compatibility: "Consumed by both home.ts (task 4) and app.ts (task 5) as global functions/types, the same way both files already consume ProjectEntry/BoardPayload from src/types/praxis-data.d.ts without an import."
    gotcha: "A stray top-level export (even on just one declaration) turns the whole file into an ES module under TypeScript's rules, which src/public/tsconfig.json's module: 'none' setting is specifically configured to reject at compile time — every declaration here must be global-scope, unexported, exactly like praxis-data.d.ts's existing pattern."
    verify:
      - "tsc -p src/public/tsconfig.json --noEmit (once task 3.2 adds this file to the include array)"
    checklist:
      - "No import or export keyword appears anywhere in this file."
      - "unwrapIpc's thrown error carries .status, read from the same httpError helper home.ts's delete-handler .catch already expects (acceptance criterion 4)."
      - "The six PraxisAPI methods' names and argument order match task 1.2/2's channel names and argument lists exactly."
      - "src/public/home.ts and src/public/app.ts are untouched by this task (they are migrated separately, in tasks 4 and 5)."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.2 src/public/tsconfig.json — add ipc-adapter.ts to include array
    ```yaml
    description: "Add ipc-adapter.ts to src/public/tsconfig.json's include array so it compiles alongside app.ts and home.ts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "src/public/tsconfig.json"
      - |
        <<<<<<< SEARCH
          "include": ["app.ts", "home.ts", "../types/praxis-data.d.ts"]
        =======
          "include": ["app.ts", "home.ts", "ipc-adapter.ts", "../types/praxis-data.d.ts"]
        >>>>>>> REPLACE
    pattern: "src/public/tsconfig.json"
    imports: "n/a"
    compatibility: "module: 'none' and every other compilerOptions key stay exactly as they are today — this task changes only the include array."
    gotcha: "Ordering in the include array is cosmetic (tsc does not compile in list order for this project's classic-script setup), but keep ipc-adapter.ts's script tag ahead of home.js/app.js at the HTML level (tasks 3.3/3.4) — that ordering is load-bearing, this one is not."
    verify:
      - "tsc -p src/public/tsconfig.json --noEmit"
      - "npm run build produces dist/public/ipc-adapter.js"
    checklist:
      - "ipc-adapter.ts is added to the include array; app.ts, home.ts, and the .d.ts entry are unchanged."
      - "No other compilerOptions key changed."
      - "npm run build still completes end-to-end."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.3 src/public/index.html — add ipc-adapter.js script tag
    ```yaml
    description: "Add a <script src=\"ipc-adapter.js\"></script> tag ahead of the existing home.js tag."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "src/public/index.html"
      - |
        <<<<<<< SEARCH
        <script src="home.js"></script>
        =======
        <script src="ipc-adapter.js"></script>
        <script src="home.js"></script>
        >>>>>>> REPLACE
    pattern: "src/public/index.html"
    imports: "n/a"
    compatibility: "The same 'extra static script tag on the page' mechanism this project already uses for styles.css (plan Design) — no type=\"module\" needed, since ipc-adapter.js stays a classic script like home.js."
    gotcha: "ipc-adapter.js must load before home.js, or home.js's references to unwrapIpc/httpError/window.praxisAPI's ambient type would be reading globals that do not exist yet at parse time of home.js's own top-level code (though home.js only calls them inside functions invoked after both scripts have loaded, so runtime — not just declaration order — still requires this ordering)."
    verify:
      - "Open src/public/index.html in a plain browser tab (once npm start is running) — devtools shows no script-load error; the new script tag defines only globals and does nothing else, so it is inert without window.praxisAPI (plan's own Phase 3 verify step)."
    checklist:
      - "The ipc-adapter.js script tag appears immediately before the home.js tag."
      - "No other part of index.html changed."
      - "Loading the page in a plain browser tab still works (the home page itself, independent of the plain-browser fetch question this plan's Data & compatibility section flags for the pages' scripts once tasks 4/5 land)."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.4 src/public/board.html — add ipc-adapter.js script tag
    ```yaml
    description: "Add a <script src=\"ipc-adapter.js\"></script> tag ahead of the existing app.js tag."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "src/public/board.html"
      - |
        <<<<<<< SEARCH
        <script src="app.js"></script>
        =======
        <script src="ipc-adapter.js"></script>
        <script src="app.js"></script>
        >>>>>>> REPLACE
    pattern: "src/public/board.html"
    imports: "n/a"
    compatibility: "Must mirror task 3.3's index.html change exactly — the same script tag, the same relative ordering ahead of the page's own app.js/home.js tag."
    gotcha: "Same load-order requirement as task 3.3: ipc-adapter.js must precede app.js."
    verify:
      - "Open src/public/board.html in a plain browser tab (once npm start is running) — devtools shows no script-load error (plan's own Phase 3 verify step)."
      - "npm run build exits 0 and produces dist/public/ipc-adapter.js alongside app.js/home.js."
    checklist:
      - "The ipc-adapter.js script tag appears immediately before the app.js tag."
      - "No other part of board.html changed."
      - "board.html's new script tag is identical in form to index.html's (task 3.3)."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 4. Phase 4 — home.ts migration
  ```yaml
  description: "Replace home.ts's four fetch('/api/projects...') call sites with window.praxisAPI calls through unwrapIpc, and remove home.ts's own private httpError (now provided globally by ipc-adapter.js). File: src/public/home.ts."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "loadProjects() (home.ts:224-241): replace the fetch('/api/projects', {cache:'no-store'}).then(r => ...).then(renderTiles).catch(...) chain's fetch+r.json() unwrapping with window.praxisAPI.listProjects().then(unwrapIpc), keeping the existing .then(function (list) { renderTiles(list.projects || []); }) success handler and the existing .catch(err => ...) 'Couldn't load the project list' panel exactly as they are."
    - "submitPath() (home.ts:243-284): replace the fetch('/api/projects', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({path: value})}).then(r => ...) block with window.praxisAPI.addProject(value).then(unwrapIpc), keeping the client-side instant-feedback ~/absolute checks above it (lines 254-261) untouched, keeping the .then(() => { input.value=''; return loadProjects(); }) success handler, and keeping the .catch(err => setError(err.message)) exactly as they are."
    - "The rename save() closure (home.ts:146-168, inside the renameButton click listener): replace the fetch('/api/projects/' + encodeURIComponent(p.id), {method:'PATCH', ...}).then(r => ...) block with window.praxisAPI.renameProject(p.id, nameInput.value).then(unwrapIpc), keeping .then(() => loadProjects()) and .catch(err => setTileError(err.message)) exactly as they are."
    - "The delete handler (home.ts:191-218, inside the deleteButton click listener): replace the fetch('/api/projects/' + encodeURIComponent(p.id), {method:'DELETE'}).then(r => ...) block with window.praxisAPI.removeProject(p.id).then(unwrapIpc), keeping .then(() => loadProjects()) and the .catch(err => { setTileError(err.message); if (err.status === 404) return loadProjects(); }) block exactly as they are — unwrapIpc's thrown error still carries .status, exactly as the old httpError(r.status, ...) did, so this branch needs no logic change (acceptance criterion 4)."
    - "Delete home.ts's own private httpError function (home.ts:56-62) — it is now provided globally by ipc-adapter.js (task 3.1), loaded ahead of home.js (task 3.3)."
  pattern: "src/public/home.ts"
  imports: "window.praxisAPI (from electron/preload.cts, task 2), unwrapIpc (from src/public/ipc-adapter.ts, task 3.1, consumed as a global — no import statement, module stays 'none')"
  compatibility: "Every DOM-building function in home.ts (el, iconSvg, byId, renderTiles, and all closures inside it) stays byte-for-byte unchanged — only these four fetch call sites and the now-redundant httpError function change (plan's explicit boundary, acceptance criterion 5)."
  gotcha: "renameProject's IPC channel takes (id, name) as two arguments per task 1.2/2's contract — do not pass a {name} object the way the old PATCH body did; window.praxisAPI.renameProject(p.id, nameInput.value) is a positional call, not a body object. Confirm no other call site in home.ts still depends on httpError's 404 branch before deleting it (grep httpError home.ts first) — the delete handler is httpError's only remaining caller once the other three sites are migrated."
  verify:
    - "tsc -p src/public/tsconfig.json --noEmit"
    - "grep -n \"fetch(\" src/public/home.ts — returns zero matches once this task is done (acceptance criterion 1)."
    - "grep -n \"httpError\" src/public/home.ts — returns zero matches (home.ts's private copy is deleted; only ipc-adapter.ts's global copy remains, consumed with no local declaration)."
    - "Once WS-36's and Phase 1/2's scaffold all exist and the Electron window runs: load the project list, add a project, rename a project, delete a project (including triggering the 404-refresh path by deleting the same project from two windows, or editing .praxis-projects.json mid-session) — each behaves exactly as it does in a browser tab today (plan's own Phase 4 verify step)."
  checklist:
    - "Zero remaining fetch('/api/projects...') call sites in home.ts."
    - "home.ts's own private httpError function is deleted; the delete handler's err.status === 404 branch is otherwise unchanged."
    - "Every DOM-building function in home.ts is byte-for-byte unchanged."
    - "The three existing client-visible error messages (tilde, non-absolute path, server-side validation failures relayed via unwrapIpc) reproduce verbatim."
  self_eval:
    passed: true
    failures: []
  ```

- [x] 5. Phase 5 — app.ts migration
  ```yaml
  description: "Replace app.ts's three fetch(...) call sites with window.praxisAPI calls through unwrapIpc, including pollOnce()'s raw-text-diff to JSON.stringify-diff adjustment. File: src/public/app.ts."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Initial board load (app.ts:967-992, the `if (!projectParam) {...} else { var dataUrl = ...; fetch(dataUrl, ...) }` block): replace the fetch(dataUrl, {cache:'no-store'}).then(r => r.text()).then(text => {...}) chain with window.praxisAPI.getProjectData(projectParam).then(unwrapIpc).then(function (data) { lastBody = JSON.stringify(data); applyData(data); setLiveStatus(true); setInterval(pollOnce, POLL_MS); }), keeping the existing .catch(err => showLoadState(\"Couldn't load this project\", err.message)) exactly as it is — dropping the r.ok/r.text()/JSON.parse steps since unwrapIpc resolves the BoardPayload object directly."
    - "pollOnce() (app.ts:936-965): replace its fetch(dataUrl, {cache:'no-store'}).then(r => r.text()).then(text => {...}) chain the same way — window.praxisAPI.getProjectData(projectParam).then(unwrapIpc).then(function (data) { var stringified = JSON.stringify(data); if (stringified === lastBody) { setLiveStatus(true); return; } lastBody = stringified; var board = byId('board'); var scrollLeft = board.scrollLeft; applyData(data); board.scrollLeft = scrollLeft; setLiveStatus(true); }) — comparing JSON.stringify(data) against lastBody in place of the old raw-response-text comparison (plan's stated, accepted behavioural adjustment: functionally the same short-circuit, built from the parsed object instead of the wire bytes). Keep the existing .catch(() => setLiveStatus(false)) and .finally(() => { polling = false; }) exactly as they are."
    - "openModal()'s detail fetch (app.ts:842-856): replace the fetch('/api/projects/' + encodeURIComponent(projectParam!) + '/workstreams/' + encodeURIComponent(wsId) + '/detail', {cache:'no-store'}).then(r => ...) block with window.praxisAPI.getWorkstreamDetail(projectParam!, wsId).then(unwrapIpc).then(renderDetail), keeping the existing .catch(err => { ...three setPanelMessage calls... }) exactly as it is — dropping the r.ok/r.json() unwrapping since unwrapIpc resolves the detail object directly or rejects with an Error carrying .message."
  pattern: "src/public/app.ts"
  imports: "window.praxisAPI (from electron/preload.cts, task 2), unwrapIpc (from src/public/ipc-adapter.ts, task 3.1, consumed as a global — no import statement, module stays 'none')"
  compatibility: "lastBody's change-detection role is preserved exactly; only its comparison basis moves from raw response text to JSON.stringify() of the resolved object (plan's Phase 2/Design, explicit). Every DOM-building function (applyData, renderDetail, setPanelMessage, showLoadState, setLiveStatus, and all their callees) stays byte-for-byte unchanged — only these three fetch call sites change (acceptance criterion 5)."
  gotcha: "JSON.stringify() key ordering must stay stable between successive apiGetProjectData/getProjectData calls for the lastBody comparison to behave like the old raw-text diff — BoardPayload's own shape is unchanged by this plan, so this is safe by construction; do not introduce a Map or Set anywhere upstream of this comparison. A key-ordering mismatch between server.ts's own JSON.stringify and this file's JSON.stringify(data) would only ever cause a harmless extra re-render (false positive), never a missed update (false negative), per the plan's own Open questions note — this is a recorded, accepted nuance, not a defect to guard against here."
  verify:
    - "tsc -p src/public/tsconfig.json --noEmit"
    - "grep -n \"fetch(dataUrl\" src/public/app.ts — returns zero matches once this task is done (acceptance criterion 1)."
    - "grep -n \"fetch('/api/projects\" src/public/app.ts — returns zero matches."
    - "Once WS-36's and Phase 1/2's scaffold all exist and the Electron window runs: open a board, confirm KPIs/columns/cards/panels render; open a card's detail modal (Plan/Issues/Tasks tabs); wait for a 5-second poll tick and confirm setLiveStatus still reads 'Live' and the board does not visibly flicker/re-render when nothing changed upstream; edit a flowcharge/ file on disk and confirm the next poll picks it up (plan's own Phase 5 verify step)."
  checklist:
    - "Zero remaining fetch(dataUrl...) or fetch('/api/projects...') call sites in app.ts."
    - "pollOnce's change-detection compares JSON.stringify(data) against lastBody, not raw response text."
    - "A poll failure still leaves the current render untouched, matching the existing .catch comment's stated intent."
    - "Every DOM-building function in app.ts is byte-for-byte unchanged."
  self_eval:
    passed: true
    failures: []
  ```

- [x] 6. Phase 6 — End-to-end verification against the existing browser path
  ```yaml
  description: "With the Electron app running (dist/server.js listening on 4173), confirm every flow still works from an ordinary browser tab hitting the HTTP /api/* surface directly, unchanged — proving that surface was bypassed by IPC, never removed or altered. No files are touched by this task."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "This task is verification-only, per the plan's own Phase 6 (Files touched: none). It depends on tasks 4 and 5 both landing, and, transitively, on WS-36's scaffold and tasks 1-3 all being in place first."
    - "With the Electron app running, open http://127.0.0.1:4173 in an ordinary browser tab and confirm every flow (project list, add/rename/delete, board, poll, detail modal) still works there too, unchanged — proving the HTTP /api/* surface was never removed or altered, only bypassed by the Electron window's own IPC path (plan's own Phase 6 verify step)."
    - "Confirm src/server.ts and every file under src/lib/*.ts are byte-for-byte untouched by this whole workstream (git diff --stat -- src/server.ts src/lib shows no changes) — the one exception on record is main.cts's SERVER_URL export (task 1.1), which is outside src/server.ts/src/lib entirely."
    - "Note, not a defect to fix here: per the plan's own Data & compatibility section, once tasks 4-5 land, index.html/board.html's own served pages stop being independently usable in a plain browser tab (window.praxisAPI is undefined outside Electron) — only the raw /api/* routes themselves (reachable via curl or devtools) stay guaranteed reachable, which is what acceptance criterion 7 is written to mean and no more. Do not treat a plain-browser-tab UI failure as a regression this task should flag."
  pattern: "none — verification only"
  imports: "n/a"
  compatibility: "Confirms acceptance criteria 6, 7, and 8 all hold simultaneously: the Electron window's flows (6), the HTTP /api/* surface's independent reachability (7), and npm run build / npm start continuing to work unchanged for a plain-browser user (8)."
  gotcha: "This is an integration-level, manual check by nature — there is no CI in this repo to extend (no .github/workflows) and standing one up for an Electron-window IPC round trip is disproportionate to this workstream, per the plan's own Testing strategy. Do not substitute a heavier automated E2E suite for this step."
  verify:
    - "npm run build && npm start (independent of the Electron app) — still completes and serves the site exactly as before this workstream (acceptance criterion 8)."
    - "With the Electron app running separately, curl -i http://127.0.0.1:4173/api/projects from a terminal — 200s with the same {projects:[...]} JSON shape server.ts has always returned, proving the route itself was never touched (acceptance criterion 7)."
    - "git diff --stat -- src/server.ts src/lib — reports no changes for the whole workstream."
  checklist:
    - "Every flow verified end to end from a plain browser tab against the running Electron app's server, with no code changes needed to make it work."
    - "src/server.ts and src/lib/*.ts show zero diff for the whole workstream."
    - "npm run build and npm start both succeed unchanged."
    - "curl against a former /api/* path returns the same status/JSON shape it always has."
  self_eval:
    passed: true
    failures: []
  ```

## Divergences

1. **WS-36's Electron scaffold has not landed.** The plan's Assumptions section states
   `electron/main.cts`, `electron/preload.cts`, and `electron/tsconfig.json` are "in place
   before this plan's phases run," per WS-36's own scaffold (PLN-26-fdxv4m). As read at
   `base_commit` `0d82a04`, no `electron/` directory exists anywhere in this repo, and
   WS-36's own record (`flowcharge/workstreams/WS-36-b3b2pw-tauri-shell-scaffold/workstream.md`)
   carries `status: in-progress`, with its task list `TL-32-7v6bxx` not yet executed. Tasks
   1.1, 1.3, and 2 (edits to `main.cts`, `electron/tsconfig.json`, and `preload.cts`) are
   therefore authored prose-only, describing the change to make once WS-36 lands, with no
   literal SEARCH/REPLACE block, since there is no current file content to copy from. Task
   1.2 (`electron/ipc-handlers.cts`) is a wholly new file with no existing content to
   diverge from, but is likewise authored against the plan's contract rather than verified
   buildable this session, for the same reason. Every other file this task list cites
   (`src/server.ts`, `src/public/{app,home}.ts`, `src/public/tsconfig.json`,
   `src/public/{index,board}.html`) matched the plan's own description at authoring time,
   confirmed by reading each one in full this session.

---
id: PLN-27-wp9kt5
type: plan
workstream: WS-37-zj17yn
slug: absorb-node-backend-into-frontend
title: "Bridge app.ts/home.ts's fetch calls to server.ts's routes over Electron IPC"
status: done
created: 2026-08-17
updated: 2026-08-18
depends_on: []
links: []
---

## Summary

`app.ts` and `home.ts` currently reach `src/server.ts`'s six `/api/*` routes with
`fetch()`. This plan replaces every one of those seven call sites (four in `home.ts`, three
in `app.ts`) with a call through Electron IPC, exposed to the renderer as
`window.praxisAPI.*`. `server.ts`'s route logic is not copied, reshaped, or edited: each of
the six new `ipcMain.handle` channels makes a plain loopback HTTP request to the same
`http://127.0.0.1:4173/api/...` endpoint the browser calls today, and relays the result back
over IPC. `server.ts`'s HTTP listener stays exactly as WS-36 leaves it — still the thing that
serves `index.html`/`board.html`/`app.js`/`home.js`/`styles.css` and still fully reachable at
`/api/*` from an ordinary browser tab; only the Electron window's own `fetch()` calls stop
using it, in favour of IPC.

This plan builds directly on WS-36's scaffold (`electron/main.cts`, `electron/preload.cts`,
`electron/tsconfig.json`, plan PLN-26-fdxv4m) and assumes that scaffold is in place before
this plan's phases run — WS-36's `main.cts` already starts `dist/server.js` in-process and
opens a `BrowserWindow` at its URL; this plan adds the IPC surface on top of that, and adds
one new file (`electron/ipc-handlers.cts`) alongside it.

The one real design decision — how an `ipcMain.handle` reaches `server.ts`'s route logic,
given that logic lives in private functions that write straight to an `http.ServerResponse`
— is resolved in favour of the loopback-HTTP-relay option (Design, below). It costs one
extra local network hop per call, stated plainly rather than glossed over, and in exchange
touches zero lines of `server.ts` and keeps every validation rule (path/tilde/absolute, name
length/control-chars, workstream-id shape) living in exactly the one place it lives today.

## Scope

**In scope — acceptance criteria:**

1. Every `fetch('/api/...')` call in `src/public/home.ts` and `src/public/app.ts` is
   replaced with a call to a `window.praxisAPI.*` method. No call site in either file talks
   to `/api/*` directly any more.
2. Six `ipcMain.handle` channels exist — `listProjects`, `addProject`, `renameProject`,
   `removeProject`, `getProjectData`, `getWorkstreamDetail` — one per current route, each
   relaying to the matching `/api/*` route over a loopback HTTP request to
   `http://127.0.0.1:4173`. `src/server.ts` and `src/lib/*.ts` are untouched by this plan
   (one exception, noted in Design: WS-36's existing `SERVER_URL` constant in `main.cts`
   gains an `export` keyword so `ipc-handlers.cts` can reuse it instead of duplicating the
   literal — no behaviour changes).
3. `preload.cts` exposes `window.praxisAPI` via `contextBridge.exposeInMainWorld`, with one
   method per channel, each returning a `Promise`.
4. A 404 from `removeProject` (the case `home.ts`'s delete flow already special-cases to
   silently refresh a stale tile) is still readable by `home.ts` as `err.status === 404`
   after the switch to IPC, with no change to that branch's own logic.
5. `home.ts`'s and `app.ts`'s existing `.then/.catch` chains keep their current shape and
   error-handling behaviour — same messages surfaced to the same UI elements, same recovery
   paths (delete's stale-tile refresh, add/rename's inline error line, the board's
   load-failure panel, the poll's "Not updating" indicator) — with the top of each chain
   swapped from a `fetch(...)` call to a `window.praxisAPI...().then(unwrapIpc)` call.
6. From the Electron window built by WS-36: loading the project list, adding a project,
   renaming a project, deleting a project, loading a board (including the 5-second poll),
   and opening a card's detail modal all work exactly as they do in a browser tab today —
   because they still end up running the same `src/server.ts` route handlers, just reached
   over IPC instead of `fetch`.
7. Opening `http://127.0.0.1:4173` in an ordinary browser tab while the Electron app is
   running still works exactly as before: `server.ts`'s `/api/*` routes are untouched and
   still directly reachable over HTTP, independent of the Electron window's own IPC path.
8. `npm run build` / `npm start` continue to work unchanged for anyone using the app in a
   plain browser tab — nothing under `src/server.ts` or `src/lib/*.ts` changes.

**Out of scope:**

- Any change to `src/server.ts`'s route logic, request validation, or response shapes.
  Option 1 (chosen below) needs none, and Context fixes this as out of scope regardless of
  which option was chosen.
- Any change to `src/lib/{projects,extract,detail,git}.ts`.
- A generic `{method, path, body}` IPC pass-through. Context explicitly rules this out in
  favour of one named channel per route.
- `electron-builder`/packaging, the native folder-picker, and cross-platform build
  verification — WS-38's and WS-39's jobs, per the same boundary WS-36 already drew.
- Wiring the loopback target to the `PORT`/`HOST` environment overrides `server.ts` already
  supports. `ipc-handlers.cts` targets the same hardcoded `http://127.0.0.1:4173` that
  WS-36's `main.cts` already hardcodes as `SERVER_URL` (and this plan reuses that exported
  constant rather than re-hardcoding it) — wiring environment overrides through Electron is
  a WS-36-level concern this plan does not reopen.

**Assumptions:**

- WS-36's scaffold (`electron/main.cts`, `electron/preload.cts`, `electron/tsconfig.json`,
  the `electron` devDependency, the `build`/`electron:dev` scripts) is in place before this
  plan's phases run, in the shape PLN-26-fdxv4m describes: a `SERVER_URL` constant, a
  readiness-polling `app.whenReady()` handler, and a `BrowserWindow` created with
  `contextIsolation: true, nodeIntegration: false, sandbox: true`.
- `ipcMain.handle` registration happens synchronously, in `main.cts`, right after the
  server-readiness poll succeeds and before `BrowserWindow.loadURL` is called — so every
  channel is already registered before the page's own scripts run and call
  `window.praxisAPI.*` on load. This is read as the natural extension of WS-36's existing
  "poll, then act" sequencing, not a new sequencing decision Context left open.
- The loopback request timeout is bounded by Node's own default socket/request behaviour
  (no explicit timeout is added). The server the request targets is the same in-process
  `dist/server.js` WS-36 already confirmed answers before the window opens, so an
  IPC-triggered request hanging indefinitely is not a realistic failure mode this plan needs
  to guard against beyond what `server.ts` itself already does for any HTTP client.
- `src/public/index.html` and `src/public/board.html` each gain one new `<script>` tag (for
  the new shared adapter file, see Design) ahead of their existing `home.js`/`app.js` tag.
  This is the smallest change that lets both classic-script files share one small helper
  without either file gaining an `import` — `src/public/tsconfig.json` sets `module: "none"`
  specifically to keep every file here a classic script, so an ES import is not an option.

## Design

### The central decision: how an IPC handler reaches server.ts's route logic

`server.ts`'s six routes are implemented as private, unexported functions that take
`(req, res)` and write directly to `res` — not pure functions an `ipcMain.handle` callback
can call and get a return value from. Three ways to bridge that gap were weighed:

**Option 1 — chosen. Each `ipcMain.handle` makes a loopback HTTP request to
`http://127.0.0.1:4173/api/...`** (the same server WS-36's `main.cts` already starts
in-process) and relays the JSON response back over IPC as a structured result. Zero edits to
`server.ts`. Every validation rule — path/tilde/absolute in `handleAddProject`, name
length/control-chars in `handleRenameProject`, the `WORKSTREAM_ID` shape guard on the detail
route — keeps running in exactly the one place it runs today, exercised exactly as it is for
a browser client, because the loopback request *is* an ordinary HTTP request from
`server.ts`'s point of view. The one real cost, stated plainly and not glossed over: what
looks like an "IPC bridge" is, one hop down, still a local HTTP round trip — a TCP connection
to `127.0.0.1`, not a direct function call. On loopback this is sub-millisecond in practice
and invisible next to the filesystem work `extractPraxisData`/`extractWorkstreamDetail`
already do per request, but it is a real second hop, not a free abstraction.

**Option 2 — rejected. Export `server.ts`'s private handler functions, reshaped to return
`{status, body}` instead of writing to `res`.** This does satisfy "the same logic, reused,"
but it requires restructuring `server.ts` itself — every `sendJson(res, status, body)` call
becomes a `return {status, body}`, and the request-body-reading path
(`readRequestBody`'s callback style) would need reshaping to fit a function that returns a
value rather than one that drives a response stream. That is a structural edit to the one
file Context is most explicit about not needing to touch for this workstream's chosen
option, in exchange for saving a sub-millisecond loopback hop. Rejected: the cost (touching
`server.ts`'s internals) is disproportionate to the benefit (removing one local network hop
that Option 1 already accepts as a stated, minor cost).

**Option 3 — rejected. New Electron-side code imports `src/lib/*.ts` directly, bypassing
`server.ts` entirely.** This avoids the loopback hop altogether, but it requires copying the
three validation blocks (path/tilde/absolute; name length/control-chars; the
`WORKSTREAM_ID` shape guard) out of `server.ts` and into new Electron-side code — a second
copy of each rule that can silently drift from `server.ts`'s own copy the next time either
is edited. That directly reintroduces the exact duplication Context calls out as the
deciding cost of this option. Rejected on those grounds: Option 1 gets the same "one copy of
validation" property Option 3 sacrifices, at a cost (one loopback hop) far smaller than the
duplication risk Option 3 accepts.

Option 1 wins on the same axis all three are judged against — how many places validation
logic lives — while costing strictly less structural change to `server.ts` than Option 2 and
strictly less duplication risk than Option 3.

### IPC channel surface

Six named channels, one per current route, matching the shapes Context specifies:

| Channel | Method | Path | Body |
|---|---|---|---|
| `listProjects` | GET | `/api/projects` | — |
| `addProject` | POST | `/api/projects` | `{path}` |
| `renameProject` | PATCH | `/api/projects/:id` | `{name}` |
| `removeProject` | DELETE | `/api/projects/:id` | — |
| `getProjectData` | GET | `/api/projects/:id/data` | — |
| `getWorkstreamDetail` | GET | `/api/projects/:id/workstreams/:wsId/detail` | — |

Not a generic `{method, path, body}` channel — six specific, named functions, per Electron's
own guidance (and Context's explicit instruction) to expose only named, narrow functions
through `contextBridge`, never a generic invoke surface.

### The structured-result contract

`ipcMain.handle` errors only serialize an `Error`'s `.message` across the process boundary —
custom properties, such as the `status` code `home.ts`'s delete flow reads to decide whether
to refresh a stale tile on a 404, are dropped. Rather than throw, every handler resolves with
a plain, structured, IPC-safe value:

```ts
type PraxisIpcResult<T> =
  | { ok: true;  status: number; data: T }
  | { ok: false; status: number; error: string };
```

This shape is defined once (`src/public/ipc-adapter.ts`, see below) and mirrored by the
main-process side (`electron/ipc-handlers.cts`). Because it is plain data — no `Error`
instances anywhere in the contract — it survives both hops (`ipcMain.handle` →
`ipcRenderer.invoke`, and `contextBridge`'s own clone from the preload world into the page
world) with no special-casing needed for either boundary.

**`electron/ipc-handlers.cts`** (new file, registered from `main.cts` after the
readiness poll succeeds):
- A single `loopbackRequest(method, urlPath, body?)` helper, built on `node:http` (no new
  dependency — the same module WS-36's `main.cts` already uses for its readiness poll),
  shared by all six handlers so the HTTP-request/response boilerplate exists exactly once:
  - Sends the request to `SERVER_URL` (imported from `main.cts`, which gains an `export` on
    its existing constant — the only edit to `main.cts` needed for this plan).
  - Reads the full response body, `JSON.parse`s it (every `server.ts` route always answers
    with JSON, success or error, so this mirrors what `home.ts`/`app.ts` already assume when
    they call `r.json()` today).
  - `status < 400` → resolves `{ok: true, status, data: parsed}`.
  - `status >= 400` → resolves `{ok: false, status, error: parsed.error ?? 'HTTP ' + status}`,
    reading the `{error}` shape every `server.ts` failure response already uses.
  - A response body that fails to `JSON.parse`, or a connection-level failure (`req`'s own
    `'error'` event — e.g. the loopback connection itself refused), resolves
    `{ok: false, status, error: message}` rather than rejecting the promise. This keeps
    every call site's handling to one path (`.then(unwrapIpc)`, see below) instead of a
    second one for transport failures versus a first for HTTP-level ones.
- Six `ipcMain.handle` registrations, each a one-line call into `loopbackRequest` with the
  method/path/body from the table above (ids and names URL-encoded exactly as `home.ts`
  already does with `encodeURIComponent` before this change).

**`electron/preload.cts`** gains its first real content (WS-36 left it a stub on purpose):
a `contextBridge.exposeInMainWorld('praxisAPI', {...})` call with six thin wrappers, each a
one-line `ipcRenderer.invoke(channelName, ...args)`. No adapter or error-translation logic
lives here — `preload.cts` only forwards the raw `PraxisIpcResult` promise, keeping this file
as narrow as Electron's own contextBridge guidance recommends.

### The renderer-side adapter

`window.praxisAPI.*` resolves with a `PraxisIpcResult<T>`, never rejects on an application-
level failure (a 404, a 400, a validation error) — only a genuine IPC transport failure would
reject the returned promise, and none of the six channels is designed to hit that path under
normal operation. Every existing `.then/.catch` chain in `home.ts`/`app.ts`, though, is
written against a fetch-shaped world: `.then` gets the success value, `.catch` gets a thrown
`Error` (sometimes carrying `.status`, via `home.ts`'s own existing `httpError` helper). To
keep that chain shape and keep each `.catch` block completely unchanged, one small adapter
function converts a `PraxisIpcResult` back into that shape:

```ts
function unwrapIpc<T>(result: PraxisIpcResult<T>): T {
  if (!result.ok) throw httpError(result.status, result.error);
  return result.data;
}
```

Each call site becomes `window.praxisAPI.someMethod(...).then(unwrapIpc).then(...).catch(...)`
— one new `.then(unwrapIpc)` inserted where the old `.then(r => r.json().then(...))`
parsing/error-checking step used to be, with everything below it (the success handler, the
`.catch` block) untouched.

**Where this lives — the one point Context leaves genuinely open, resolved here.**
`home.ts` and `app.ts` are two separate classic scripts (`src/public/tsconfig.json` sets
`module: "none"` precisely so neither can gain an `import`), loaded on two different pages
that never share a document. `httpError` already exists, once, inside `home.ts`; `app.ts` has
no equivalent today because none of its call sites currently need to read `.status` off an
error. Both files now need `unwrapIpc`. Two ways to give it to them:

- **Chosen: one new shared file, `src/public/ipc-adapter.ts`**, compiling to
  `ipc-adapter.js`, holding `PraxisIpcResult`, `httpError` (moved here from `home.ts`, which
  drops its private copy), `unwrapIpc`, and the ambient `interface Window { praxisAPI:
  PraxisAPI }` declaration the rest of this plan's typed call sites need. Included via its
  own `<script src="ipc-adapter.js">` tag, ahead of `home.js`/`app.js`, on both
  `index.html` and `board.html` — the same "extra static script tag on the page" mechanism
  the project already uses for `styles.css`. Added to `src/public/tsconfig.json`'s
  `include` array alongside `app.ts`/`home.ts`.
- **Rejected: duplicate `httpError`/`unwrapIpc` once into each of `home.ts` and `app.ts`.**
  Roughly ten lines, so the duplication cost is small in absolute terms — but it is still two
  copies of the same status-carrying-error convention that could drift (for example, if a
  future change adjusts what a "transport failure" error message looks like, one file would
  need remembering to update while the other stays stale). A third shared script file is a
  well-precedented pattern in this codebase already (every page loads a shared `styles.css`)
  and costs one new file plus one new `<script>` tag per page — smaller than the drift risk
  of keeping two copies of the same logic in sync by hand.

### Call-site migration (7 sites → 6 channels)

**`home.ts`** (4 sites):
- `loadProjects()` — `fetch('/api/projects', {cache:'no-store'})` →
  `window.praxisAPI.listProjects().then(unwrapIpc)`. Same success handler
  (`renderTiles(list.projects || [])`), same `.catch` (renders the "Couldn't load the
  project list" panel from `err.message`).
- `submitPath()` — `fetch('/api/projects', {method:'POST', ...})` →
  `window.praxisAPI.addProject(value).then(unwrapIpc)`. Same success handler (clears the
  input, reloads), same `.catch` (`setError(err.message)`).
- Rename `save()` — `fetch('/api/projects/:id', {method:'PATCH', ...})` →
  `window.praxisAPI.renameProject(p.id, nameInput.value).then(unwrapIpc)`. Same success
  handler (reloads, exiting edit mode), same `.catch` (`setTileError(err.message)`).
- Delete handler — `fetch('/api/projects/:id', {method:'DELETE'})` →
  `window.praxisAPI.removeProject(p.id).then(unwrapIpc)`. Same success handler (reloads),
  same `.catch` — including the `if (err.status === 404) return loadProjects();` branch,
  which keeps working unchanged because `unwrapIpc`'s thrown error still carries `.status`,
  exactly as the old `httpError(r.status, ...)` did.

**`app.ts`** (3 sites):
- Initial board load — `fetch(dataUrl, {cache:'no-store'})` →
  `window.praxisAPI.getProjectData(projectParam).then(unwrapIpc)`. Same success handler
  (`applyData`, `setLiveStatus(true)`, starts the poll interval), same `.catch`
  (`showLoadState`).
- `pollOnce()` — same channel, `window.praxisAPI.getProjectData(projectParam).then(unwrapIpc)`.
  One real behavioural adjustment, not just a call-site swap: the existing change-detection
  compares the *raw response text* (`text === lastBody`) to skip re-rendering when nothing
  changed. IPC hands back an already-parsed object (`data`), not the original response
  bytes, and the six-channel contract is kept uniform — `data` is always parsed JSON, never a
  raw string for one route and an object for the other five (the alternative, having only
  `getProjectData` carry an extra raw-text field, was considered and rejected for that
  inconsistency). `pollOnce` is adjusted to compare `JSON.stringify(data)` against
  `lastBody` instead of comparing the original response text — functionally the same
  short-circuit (skip `applyData`/re-render when nothing changed), built from the parsed
  object instead of the wire bytes. `lastBody`'s type/role stays "the last-applied payload
  as a string," it is just now produced by `JSON.stringify` on this file's own side instead
  of read verbatim off the response.
- `openModal()`'s detail fetch — `fetch('/api/projects/:id/workstreams/:wsId/detail')` →
  `window.praxisAPI.getWorkstreamDetail(projectParam, wsId).then(unwrapIpc)`. Same success
  handler (`renderDetail`), same `.catch` (sets all three panel messages to `err.message`).

## Staged task breakdown

**Phase 1 — Main-process IPC bridge.** Effort: medium. Dependencies: WS-36's scaffold in
place.
- Export `main.cts`'s existing `SERVER_URL` constant.
- Add `electron/ipc-handlers.cts`: the `loopbackRequest` helper and the six
  `ipcMain.handle` registrations.
- Wire `main.cts` to call `ipc-handlers.cts`'s registration function once, right after the
  readiness poll succeeds and before `BrowserWindow.loadURL`.
- Add `ipc-handlers.cts` to `electron/tsconfig.json`'s `include` array.
- Files touched: `electron/main.cts`, new `electron/ipc-handlers.cts`,
  `electron/tsconfig.json`.
- Verify: `npm run build` exits 0 and produces `dist/electron/ipc-handlers.cjs`; with the
  Electron app running, an ad-hoc `ipcRenderer.invoke('listProjects')` from the devtools
  console (or a temporary console.log in `main.cts`) returns a `{ok:true, status:200,
  data:{projects:[...]}}` shape.

**Phase 2 — Preload contextBridge exposure.** Effort: small. Dependencies: Phase 1.
- Replace `preload.cts`'s stub body with the six-method `contextBridge.exposeInMainWorld`
  call described in Design.
- Files touched: `electron/preload.cts`.
- Verify: `npm run build` exits 0; in the running Electron window's devtools console,
  `window.praxisAPI` exists and each of its six methods is a function.

**Phase 3 — Renderer-side adapter.** Effort: small. Dependencies: none (can run in
parallel with Phase 1–2).
- Add `src/public/ipc-adapter.ts`: `PraxisIpcResult`, `httpError`, `unwrapIpc`, and the
  ambient `PraxisAPI`/`Window.praxisAPI` typings.
- Add `ipc-adapter.ts` to `src/public/tsconfig.json`'s `include` array.
- Add `<script src="ipc-adapter.js"></script>` to `index.html` and `board.html`, each ahead
  of its existing `home.js`/`app.js` tag.
- Files touched: new `src/public/ipc-adapter.ts`, `src/public/tsconfig.json`,
  `src/public/index.html`, `src/public/board.html`.
- Verify: `npm run build` exits 0 and produces `dist/public/ipc-adapter.js`; loading either
  page in a plain browser tab still works (the new script defines globals and does nothing
  else, so it is inert without `window.praxisAPI`).

**Phase 4 — `home.ts` migration.** Effort: small. Dependencies: Phase 2, Phase 3.
- Replace `home.ts`'s four `fetch(...)` call sites per Design; remove `home.ts`'s own
  `httpError` (now provided globally by `ipc-adapter.js`).
- Files touched: `src/public/home.ts`.
- Verify: in the Electron window, load the project list, add a project, rename a project,
  delete a project (including triggering the 404-refresh path by deleting the same project
  from two windows, or by editing `.praxis-projects.json` mid-session) — all behave exactly
  as they do in a browser tab today.

**Phase 5 — `app.ts` migration.** Effort: medium. Dependencies: Phase 2, Phase 3.
- Replace `app.ts`'s three `fetch(...)` call sites per Design, including `pollOnce`'s
  text-diff → `JSON.stringify`-diff adjustment.
- Files touched: `src/public/app.ts`.
- Verify: in the Electron window, open a board, confirm KPIs/columns/cards/panels render;
  open a card's detail modal (Plan/Issues/Tasks tabs); wait for a 5-second poll tick and
  confirm `setLiveStatus` still reads "Live" and the board does not visibly flicker/re-render
  when nothing changed upstream; edit a `flowcharge/` file on disk and confirm the next poll
  picks it up.

**Phase 6 — End-to-end verification against the existing browser path.** Effort: small.
Dependencies: Phase 4, Phase 5.
- With the Electron app running (and therefore `dist/server.js` listening on 4173), open
  `http://127.0.0.1:4173` in an ordinary browser tab and confirm every flow (project list,
  add/rename/delete, board, poll, detail modal) still works there too, unchanged — proving
  the HTTP `/api/*` surface was never removed or altered, only bypassed by the Electron
  window's own calls.
- Files touched: none (verification only).
- Verify: acceptance criteria 6, 7, 8 all pass.

Phases 1–3 have no dependency on each other and can be built in any order; Phases 4–5 each
depend on 2 and 3; Phase 6 depends on both migrations landing.

## Data & compatibility

No data model exists in this change; no migrations. `.praxis-projects.json`'s shape,
`server.ts`'s `/api/*` response bodies, and every `src/lib/*` module are untouched — this
plan only changes which transport (`fetch` vs IPC) `home.ts`/`app.ts` use to reach the same
unchanged responses.

**The compatibility story, stated plainly rather than left implicit:** once this plan lands,
`home.ts`/`app.ts` call `window.praxisAPI.*` unconditionally — there is no `fetch` fallback
left in either file. That means a plain browser tab opened at
`http://127.0.0.1:4173` (no Electron, no `window.praxisAPI`) would throw immediately on
`window.praxisAPI.listProjects()` / `window.praxisAPI.getProjectData(...)` being
`undefined`, breaking the plain-browser path Context's endpoint catalogue and README both
still describe as a supported way to use this dashboard. Context resolves this directly: "The
frontend's own `fetch()` calls switch to IPC exclusively going forward; the HTTP `/api/*`
routes remain physically present and reachable regardless (e.g. if opened in an ordinary
browser tab), just unused by the Electron window from now on." Read literally, this means the
HTTP *routes* stay reachable (satisfied — `server.ts` is untouched), but the *pages*
(`index.html`/`board.html`, once rebuilt with the migrated `home.js`/`app.js`) stop being
independently usable in a plain browser tab after this workstream, since their scripts no
longer know how to call `fetch` at all. This is accepted as the intended, stated outcome of
Context's own instruction, not a defect this plan introduces silently — but it is flagged
here because it changes what acceptance criterion 7 can mean: a browser tab can still *call*
`/api/*` directly (e.g. via `curl` or its own devtools), but the *served pages* are, from this
workstream forward, an Electron-window-only UI. Acceptance criterion 7 above is written
narrowly ("the routes are reachable") to match what this plan actually keeps true, not the
page's usability from a bare browser tab, which is deliberately dropped by Context's own
resolution.

**Rollback:** revert `electron/main.cts`, `electron/preload.cts`, `electron/tsconfig.json`,
delete `electron/ipc-handlers.cts`; revert `src/public/home.ts`, `src/public/app.ts`,
`src/public/index.html`, `src/public/board.html`, `src/public/tsconfig.json`; delete
`src/public/ipc-adapter.ts`. `server.ts` and `src/lib/*` were never touched, so rollback
needs no data or migration story — the plain-browser `fetch`-based flow returns exactly as
it was.

## Testing strategy

- `loopbackRequest` (in `electron/ipc-handlers.cts`) is a self-contained function over
  `node:http` and is the one piece of genuinely new logic this plan adds. It is a reasonable
  candidate for a `node --test` unit test (matching `src/lib/extract.test.ts`'s existing
  convention) against a throwaway local HTTP server standing in for `server.ts` — asserting
  the `{ok,status,data}` / `{ok,status,error}` split on 200/4xx/5xx responses and on a
  connection failure. This is optional polish: the function is short, and the real risk (does
  a live Electron window's `window.praxisAPI` calls actually reach a live `server.ts` and
  come back correctly) is integration-level and not something this unit test substitutes for.
- Everything else in this plan is integration-level and manual by nature, exercised through
  Phases 3–6's verify steps above: no CI exists in this repo to extend
  (`.github/workflows` does not exist, confirmed during WS-36), and standing one up for an
  Electron-window IPC round trip is disproportionate to this workstream.
- No new tests are needed for `src/server.ts` or `src/lib/*` — neither changes.

## Open questions

1. **Whether the plain-browser page path is meant to survive this workstream at all.** As
   set out in Data & compatibility, migrating `home.ts`/`app.ts` to call
   `window.praxisAPI.*` unconditionally (no `fetch` fallback) means `index.html`/
   `board.html`, once rebuilt, stop being independently usable in a plain browser tab —
   only the HTTP routes themselves stay reachable, not the served UI. Context's own
   resolution note reads this as the intended outcome ("just unused by the Electron window
   from now on"), and this plan follows that reading. If a plain-browser UI (not just raw
   route access) needs to keep working going forward — for instance, for a machine running
   `npm start` without ever launching the Electron app — that would need an explicit
   `typeof window.praxisAPI === 'undefined'` fallback to the old `fetch` calls in every one
   of the seven call sites, which this plan does not add because Context does not ask for
   it and adding it silently would be a scope decision this plan is not positioned to make
   unasked.
2. **Whether `JSON.stringify(data)`-based change detection in `pollOnce` can ever
   false-negative against the old raw-text comparison.** If `server.ts`'s own
   `JSON.stringify(payload)` (building the wire response) and this file's
   `JSON.stringify(data)` (rebuilding a comparison string from the parsed object) ever
   produce different key ordering for the same logical payload, `pollOnce` would treat an
   unchanged payload as changed and re-render once extra — a harmless, self-correcting
   false positive (never a false negative, since a truly identical object always
   restringifies identically), so this is recorded as a known, low-severity behavioural note
   rather than a blocking concern.

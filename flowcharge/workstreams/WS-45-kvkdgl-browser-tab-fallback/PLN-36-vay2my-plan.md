---
id: PLN-36-vay2my
type: plan
workstream: WS-45-kvkdgl
slug: browser-tab-fallback
title: "Restore plain-browser-tab support with a window.praxisAPI fetch shim"
status: done
created: 2026-08-18
updated: 2026-08-18
depends_on: []
links: []
---

## Summary

WS-37 replaced `home.ts`'s four and `app.ts`'s three `fetch('/api/...')` call sites with
direct calls to `window.praxisAPI.*`, a global that `electron/preload.cts` injects via
`contextBridge` only inside an Electron `BrowserWindow`. `src/server.ts` still serves
`index.html`/`board.html`/`home.js`/`app.js` over plain HTTP and its `/api/*` routes are
untouched, but a plain browser tab loading those same pages has no `window.praxisAPI`, so
`home.ts`'s and `app.ts`'s calls throw immediately and nothing renders. This breaks the
user's standing requirement that the browser-based app and the Electron app be runnable and
testable side by side.

This plan adds one new file, `src/public/browser-ipc-shim.ts`, that defines
`window.praxisAPI` itself — backed by `fetch()` against the existing `/api/*` routes — but
only when `window.praxisAPI` is not already present, checked once at script-load time. It is
loaded via a new `<script>` tag in `index.html` and `board.html`, positioned after
`ipc-adapter.js` and before `home.js`/`app.js`. In Electron, `preload.cts`'s
`contextBridge.exposeInMainWorld` call runs before any of the page's own `<script>` tags
execute, so `window.praxisAPI` already exists by the time the shim's existence check runs and
the shim is a no-op there. In a plain browser tab, no preload script ever runs, the check
finds `window.praxisAPI` undefined, and the shim installs a `fetch()`-backed implementation
with the exact same six-method surface and the exact same `Promise<PraxisIpcResult<T>>`
return shape `electron/preload.cts` already returns — so `home.ts`, `app.ts`, and
`ipc-adapter.ts`'s `unwrapIpc()` need zero changes and work identically against either path.

`src/server.ts` and `src/lib/*.ts` are not touched by this plan. No IPC work from WS-37 is
reverted or altered.

## Scope

**In scope — acceptance criteria:**

1. Loading `index.html` in a plain browser tab (server started with `npm start`, no
   Electron) renders the project tiles exactly as it did before WS-37 — `listProjects()`
   succeeds and populates `#project-tiles`.
2. From that same plain-browser session: adding a project (`addProject`), renaming a project
   (`renameProject`), and removing a project (`removeProject`) all work and produce the same
   UI outcomes `home.ts`'s existing `.then/.catch` chains already implement, including the
   existing special case where a 404 from `removeProject` is read as `err.status === 404` and
   silently refreshes a stale tile.
3. Opening a project's board (`board.html`) in a plain browser tab loads via
   `getProjectData()`, and opening a workstream's detail modal loads via
   `getWorkstreamDetail()`.
4. Running the compiled app inside Electron (`npm run electron:dev`) continues to work
   exactly as WS-37 left it — `window.praxisAPI` is still the IPC-backed implementation from
   `preload.cts`, not the new shim. This plan changes zero lines in `electron/preload.cts`,
   `electron/ipc-handlers.cts`, `electron/main.cts`, `home.ts`, `app.ts`, or `ipc-adapter.ts`.
5. `src/server.ts`'s `/api/*` routes and `src/lib/*.ts` remain byte-for-byte untouched.
6. The two runtimes (plain browser tab via `npm start`, and Electron via
   `npm run electron:dev`) can run at the same time against the same project registry, per
   the user's standing requirement.

**Out of scope:**

- Any change to `src/server.ts` or `src/lib/*.ts` — explicitly excluded by the brief.
- Any change to `home.ts`, `app.ts`, or `ipc-adapter.ts` — the chosen approach needs none.
- A per-call try/catch fallback pattern — explicitly rejected by the brief (see
  Alternatives).
- WS-38's native project-folder picker work — a separate, later workstream.
- Automated browser/UI test coverage for `home.ts`/`app.ts` — no such coverage exists today
  for this layer (see Testing strategy); adding it would be a separate, larger effort than
  this plan's brief calls for.

**Assumptions (none require confirmation — all are direct, low-risk readings of the brief
and the existing code):**

- `npm start` (which runs `dist/server.js` directly, per `package.json`) is the intended way
  to run the plain-browser path for testing, exactly as it was before WS-37.
- The shim only needs to cover the six methods WS-37 introduced; no other `/api/*` route
  (there are none beyond the six) needs a shim method.
- Deployment/release constraints: this repository has no production deployment and no live
  users yet — it is a pre-release desktop-app pivot (per `WS-36`/`WS-37`'s workstream
  records) with a single local developer as its only "user" so far. There is no production
  data to protect and no migration/rollback window to plan around beyond the ordinary
  revert-a-commit story captured under Data & compatibility below.

## Design

### New module: `src/public/browser-ipc-shim.ts`

Compiled the same way `ipc-adapter.ts` is: added to `src/public/tsconfig.json`'s `include`
array (currently `["app.ts", "home.ts", "ipc-adapter.ts", "../types/praxis-data.d.ts"]`),
compiled by the existing `tsc -p src/public/tsconfig.json` build step straight into
`dist/public/browser-ipc-shim.js` (no bundler, no import/export — `module: "none"` in that
tsconfig already forces every file in `src/public/` to be a classic script, which is exactly
what this file needs to be). `tools/copy-assets.mjs` needs no change: it only copies
non-`.ts` assets (`index.html`, `board.html`, `styles.css`, the font); compiled `.js` output
already lands in `dist/public/` on its own via `tsc`'s `rootDir`/`outDir` mapping, the same
way `ipc-adapter.js` does today.

The file relies on `ipc-adapter.ts`'s ambient, file-scope declarations
(`PraxisIpcResult<T>`, the `PraxisAPI` interface, the `Window.praxisApi` typing) being
visible — true today because none of those files use `import`/`export`, so TypeScript
treats every file in the `include` list as one shared global scope, exactly as
`ipc-adapter.ts`'s own header comment (lines 1-6) describes.

**Internal helper**, mirroring `electron/ipc-handlers.cts`'s `loopbackRequest()` contract
exactly, so its `Promise<PraxisIpcResult<T>>` result is indistinguishable from what
`preload.cts`'s six methods return:

```ts
function fetchIpc<T>(method: string, urlPath: string, body?: unknown): Promise<PraxisIpcResult<T>> {
  var init: RequestInit = body === undefined
    ? { method: method }
    : { method: method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };

  return fetch(urlPath, init)
    .then(function (res) {
      return res.text().then(function (raw) {
        var status = res.status;
        var parsed: unknown;
        try {
          parsed = raw ? JSON.parse(raw) : undefined;
        } catch (err) {
          return { ok: false, status: status, error: err instanceof Error ? err.message : String(err) } as PraxisIpcResult<T>;
        }
        if (status < 400) {
          return { ok: true, status: status, data: parsed as T } as PraxisIpcResult<T>;
        }
        var errorMessage =
          parsed && typeof parsed === 'object' && 'error' in parsed
            ? String((parsed as { error: unknown }).error)
            : 'HTTP ' + status;
        return { ok: false, status: status, error: errorMessage } as PraxisIpcResult<T>;
      });
    })
    .catch(function (err) {
      // A rejected fetch() (network failure, server unreachable, aborted) still
      // resolves — never rejects — exactly like loopbackRequest()'s req.on('error').
      return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) } as PraxisIpcResult<T>;
    });
}
```

This reads the body as text first, then `JSON.parse`s it inside its own `try/catch` — the
same two-step `loopbackRequest()` uses (`electron/ipc-handlers.cts:44-53`) — so a malformed
response body resolves `{ ok: false, ... }` with the real HTTP status attached, rather than
losing the status the way a bare `res.json()` rejection would. Every `sendJson()` response
`src/server.ts` sends (confirmed by inspection: every branch, success and error alike, calls
`sendJson`) always has a JSON body, so the empty-body branch (`raw ? JSON.parse(raw) :
undefined`) is defensive parity with `loopbackRequest()`, not a case this server ever
actually produces today.

**The six methods**, matching `electron/ipc-handlers.cts`'s six channels and
`electron/preload.cts`'s six `praxisAPI` methods exactly — same names, same argument order,
same `encodeURIComponent` encoding of ids/names that both `electron/ipc-handlers.cts` and
`home.ts`'s pre-WS-37 code already used:

```ts
if (!window.praxisAPI) {
  window.praxisAPI = {
    listProjects: function () {
      return fetchIpc('GET', '/api/projects');
    },
    addProject: function (path) {
      return fetchIpc('POST', '/api/projects', { path: path });
    },
    renameProject: function (id, name) {
      return fetchIpc('PATCH', '/api/projects/' + encodeURIComponent(id), { name: name });
    },
    removeProject: function (id) {
      return fetchIpc('DELETE', '/api/projects/' + encodeURIComponent(id));
    },
    getProjectData: function (id) {
      return fetchIpc('GET', '/api/projects/' + encodeURIComponent(id) + '/data');
    },
    getWorkstreamDetail: function (id, wsId) {
      return fetchIpc(
        'GET',
        '/api/projects/' + encodeURIComponent(id) + '/workstreams/' + encodeURIComponent(wsId) + '/detail'
      );
    },
  };
}
```

The `if (!window.praxisAPI)` guard is the entire fallback decision — a one-time check at
script-load time, never a per-call try/catch. This is deliberate (see Alternatives): a
per-call fallback would let a real, broken Electron IPC channel silently degrade to the
browser path instead of surfacing the failure, masking exactly the kind of regression this
plan exists to fix.

**What this module knows about:** the shape of `/api/*` request/response bodies (method,
path, JSON body), because that is the contract it must speak to stand in for
`window.praxisAPI`. **What it must NOT know about:** DOM structure, UI state, or anything
`home.ts`/`app.ts` do with the result — exactly the same boundary `electron/ipc-handlers.cts`
already keeps (it relays; it does not interpret).

### Script tag wiring

`src/public/index.html` (currently lines 40-41) and `src/public/board.html` (currently
lines 117-118) both add one line:

```html
<script src="ipc-adapter.js"></script>
<script src="browser-ipc-shim.js"></script>
<script src="home.js"></script>   <!-- app.js in board.html -->
```

Order relative to `ipc-adapter.js` does not matter (that file only declares types/functions
and never touches `window.praxisAPI` itself). Order relative to `home.js`/`app.js` is
load-bearing: both call `window.praxisAPI.*` synchronously during their own top-level
initialization (`home.ts:198`, `app.ts:842`/`933`/`964` and others), so `window.praxisAPI`
must exist before either script runs — the shim tag must load and execute before both.

### Contracts already fixed by WS-37 (unchanged by this plan)

- `PraxisIpcResult<T>` (`src/public/ipc-adapter.ts:8-10`)
- `PraxisAPI` interface / `Window.praxisAPI` ambient typing (`ipc-adapter.ts:28-39`)
- `unwrapIpc()` (`ipc-adapter.ts:21-26`) — the single place that turns a `PraxisIpcResult`
  into either a resolved value or a thrown `Error & { status: number }`; both the IPC path
  and the new shim path feed it identically.

## Staged task breakdown

### Phase 1 — Implement and wire the shim (small)

**What to build:**
- Create `src/public/browser-ipc-shim.ts` with `fetchIpc()` and the six-method
  `window.praxisAPI` assignment, exactly as specified in Design.
- Add `"browser-ipc-shim.ts"` to `src/public/tsconfig.json`'s `include` array.
- Add the `<script src="browser-ipc-shim.js"></script>` tag to `src/public/index.html`
  (between `ipc-adapter.js` and `home.js`) and to `src/public/board.html` (between
  `ipc-adapter.js` and `app.js`).

**Files touched:** `src/public/browser-ipc-shim.ts` (new), `src/public/tsconfig.json`,
`src/public/index.html`, `src/public/board.html`.

**Dependencies:** none — this is the whole implementation.

**Verify:** `npm run build` completes with no TypeScript errors (`tsc -p
src/public/tsconfig.json` picks up the new file via the `include` change) and
`dist/public/browser-ipc-shim.js` exists after the build.

### Phase 2 — Verify both runtimes side by side (small)

**What to do:** no further code changes expected; this phase is verification, with fixes
folded back into Phase 1's files if it surfaces a defect.

- Run `npm start` (plain HTTP server, no Electron) and open `http://127.0.0.1:4173` in an
  ordinary browser tab. Confirm project tiles render, and exercise add/rename/remove project
  and the board/workstream-detail views (Scope acceptance criteria 1-3).
- With the same server still running, run `npm run electron:dev` and confirm the Electron
  window still works exactly as after WS-37 — this proves the shim is inert there (Scope
  acceptance criterion 4) and that both runtimes tolerate running concurrently against the
  same `.praxis-projects.json` registry (Scope acceptance criterion 6).
- Confirm via browser DevTools (or a temporary `console.log`, removed before commit) that
  the browser tab's `window.praxisAPI` is the shim's `fetchIpc`-backed object, and that the
  Electron window's `window.praxisAPI` is still `preload.cts`'s IPC-backed object — i.e. the
  existence check actually branched both ways.

**Files touched:** none, unless Phase 1 needs a fix.

**Dependencies:** Phase 1.

**Verify:** all six Scope acceptance criteria observed directly, in both runtimes, in one
sitting.

## Data & compatibility

No data model, storage format, or migration is involved — `.praxis-projects.json`'s shape,
`src/lib/*.ts`, and `src/server.ts`'s routes are all untouched. Backward compatibility is the
entire point of this plan: it restores a previously-working path (plain-browser `fetch()`
against `/api/*`) without touching the newer IPC path WS-37 added, so existing Electron
behavior is preserved exactly.

**Rollback story:** fully reversible by deleting `src/public/browser-ipc-shim.ts`, removing
its `tsconfig.json` include entry, and removing the two `<script>` tags — a three-file revert
with zero blast radius elsewhere, since no other file is edited by this plan.

## Testing strategy

This repository's only existing automated tests are `node:test` unit tests for pure backend
logic (`src/lib/extract.test.ts`, run via `node --test dist/lib/extract.test.js` after
`npm run build`, per that file's own header comment). None of `home.ts`, `app.ts`,
`ipc-adapter.ts`, or `electron/*.cts` have automated coverage today — this layer is
integration-verified by hand, and this plan follows that existing convention rather than
introducing a new browser-test framework as a side effect of a small fix (that would be
scope creep against YAGNI).

- **Manual/integration (this plan's actual verification):** Phase 2 above — both runtimes,
  all six `window.praxisAPI` methods, exercised through the real UI.
- **Unit-test candidate for a later, separate pass (not this plan):** `fetchIpc()`'s
  response-shape logic (status-to-`ok`/`error` mapping, malformed-JSON handling) is a pure
  function apart from its one `fetch()` call, so it could be extracted and unit-tested the
  way `extract.ts` is, if a browser-side test harness is ever added. Flagging it here rather
  than building it now, since no such harness exists yet and adding one is out of this plan's
  scope.

## Open questions

1. **Should `npm start`'s plain-HTTP path get a mention in project docs/README as the
   supported way to test alongside Electron?** The brief only asks that both paths work, not
   that they be documented. Recommendation: skip for this plan; a docs pass is a separate,
   cheap follow-up if the user wants it.
2. **Does the user want the shim's existence check to log anything (e.g. a
   `console.info('[browser-ipc-shim] window.praxisAPI not found — using fetch fallback')`) to
   make it obvious at a glance which path is active during manual testing?** Not requested by
   the brief and not needed for correctness. Recommendation: leave it out to keep the module
   minimal (YAGNI); easy to add later if manual testing proves confusing without it.

Neither question blocks Phase 1 or Phase 2 — both default to "no" (minimal shim, no docs
change) unless the user says otherwise.

## Alternatives considered and rejected

1. **Per-call try/catch fallback at each of the seven `window.praxisAPI.*` call sites in
   `home.ts`/`app.ts`.** This was the workstream record's own tentative "likely direction"
   before investigation, and is explicitly rejected by this plan's brief: a per-call fallback
   would catch a genuinely broken Electron IPC channel (a real bug) and silently retry over
   `fetch()`, making the Electron path look like it "worked" when it actually fell back to
   HTTP — masking exactly the class of regression this plan exists to prevent. It would also
   touch `home.ts` and `app.ts` at seven sites instead of zero, and duplicate the encoding/
   error-shape logic seven times instead of once.

2. **Server-side user-agent or request-based branching in `src/server.ts`** (e.g. inject a
   different script tag, or a different global, depending on how the page was requested).
   Rejected because the brief explicitly requires `src/server.ts` to stay untouched, and
   because user-agent sniffing is inherently fragile — Electron's `BrowserWindow` and a real
   browser can present similar or spoofable user-agent strings, whereas checking
   `window.praxisAPI` at runtime is exact and requires no sniffing at all.

3. **Two separate build variants of `home.ts`/`app.ts`** (one Electron-only, one
   browser-only), selected at build or serve time. Rejected as needless duplication of two
   already-large files (`app.ts` is ~51KB) for a difference that is fully contained in six
   small methods; the shim isolates that difference in one new ~60-line file instead.

## Final summary

Chosen approach: one new file, `src/public/browser-ipc-shim.ts`, defines `window.praxisAPI`
via `fetch()` against the existing `/api/*` routes, installed only when `window.praxisAPI` is
undefined at script-load time (never per-call), loaded via a new `<script>` tag in
`index.html`/`board.html` after `ipc-adapter.js` and before `home.js`/`app.js`. Two small
phases: (1) build and wire the shim, (2) verify both the plain-browser and Electron runtimes
side by side. Zero changes to `src/server.ts`, `src/lib/*.ts`, `home.ts`, `app.ts`,
`ipc-adapter.ts`, or any `electron/*.cts` file. Top risks: the load-order dependency between
the new script tag and `home.js`/`app.js` (mitigated by placing it directly after
`ipc-adapter.js` in both HTML files); and the `fetchIpc()` response contract silently
drifting from `loopbackRequest()`'s if either is edited later without the other (mitigated by
both now being explicitly documented against each other in this plan and in code comments).
Two open questions, both low-stakes and defaulted to "no" unless the user says otherwise:
whether to document the dual-runtime testing setup, and whether the shim should log which
path it activated.

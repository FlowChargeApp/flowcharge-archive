---
id: PLN-48-jznrar
type: plan
workstream: WS-58-06dvnk
slug: app-version-display
title: "Expose the running app's own version and show it in the footer"
status: done
created: 2026-08-22
updated: 2026-08-22
depends_on: []
links: []
---

# Expose and display the app's own version

## Summary

The app must know its own version at runtime and show it to the user. This is the
groundwork WS-59 (update-check-and-notify) depends on. It is not the update check.

The chosen approach adds one new method, `getAppVersion()`, to the existing
`window.praxisAPI` surface. Electron answers it in the main process with
`app.getVersion()`. A plain browser tab answers it through the existing shim, backed by
a new `GET /api/version` route that reports `package.json`'s `version` field. One small
shared renderer script writes the value into the `<footer class="note">` element that
already exists on both `index.html` and `board.html`.

The feature is purely additive. No existing file changes behaviour.

## Scope

### Acceptance criteria

1. A user who runs `npm run electron:dev`, or who opens a packaged build, sees the line
   `Version 1.0.0` in the footer of the home page and in the footer of any board page.
2. A user who runs `npm start` and opens `http://localhost:4173` sees the same line, on
   both pages.
3. `GET /api/version` answers `200` with the body `{"version":"1.0.0"}`.
4. A user who edits `version` in `package.json` and rebuilds sees the new string in
   both cases above. `package.json` stays the single source of truth.
5. If the version cannot be obtained, the footer shows no version line. The page shows
   no error, and the browser console shows no uncaught exception.
6. Nothing else changes. The filter row stays hidden. The board's sort, KPI, panel, and
   modal behaviour is identical. The project registry is untouched.

### Out of scope

- The update check itself: the GitHub Releases comparison, the notification banner, and
  the settings toggle. That is WS-59.
- Any About dialog, settings panel, or preferences window. This plan adds no new screen.
- Any change to `package.json`'s `version` value, or to the electron-builder config.
- Any change to how `flowcharge/` is read, extracted, or rendered.

### Assumptions taken (settled here, not confirmed by the user)

- **A1 — The plain browser tab shows the version too.** The Context left this open. I
  settle it as "yes, show it everywhere", for three reasons. First, `README.md` documents
  `npm start` as the Quick start, so a browser-tab user is a real audience, not an
  internal fallback path. Second, the `pickProjectFolder` precedent does not apply:
  that method is Electron-only because a browser genuinely cannot open a native folder
  dialog. A version string has no such capability gap, because `src/server.ts` can read
  `package.json` directly. Third, making the method required on `PraxisAPI` removes the
  optional-method feature detection and the conditionally hidden markup that the
  Electron-only reading would force into both page scripts.
  The design keeps this decision cheap to reverse. See Open questions, item 1.
- **A2 — The displayed text is `Version 1.0.0`.** The word `Version` is spelled in full,
  and the string is plain text with no link.
- **A3 — Deployment and release constraints are minimal.** This app is private and
  closed-source, it holds no production data and has no live users, and it ships as an
  unsigned local build. So no feature flag, no dark launch, and no staged rollout is
  planned. Each phase below still leaves the app fully working.
- **A4 — `app.getVersion()` reports the correct value in dev and in packaged mode.**
  Taken from the Context as settled. It is not re-verified in this plan.

## Design

### Contract 1 — the renderer-facing method

`src/public/ipc-adapter.ts` gains one **required** method on `PraxisAPI`:

```ts
getAppVersion(): Promise<string | null>;
```

It resolves to the version string, or to `null` when the version cannot be obtained.

Two grounded reasons for the raw `string | null` shape, rather than the
`PraxisIpcResult<T>` envelope the other six methods use:

- The main-process path is not an HTTP call, so an envelope would force this plan to
  invent a `status: 200` for a call that has no status. `pickProjectFolder` already
  establishes the raw shape for a direct, non-relayed handler: `electron/preload.cts:18`
  declares it as `Promise<string | null>`, and `electron/ipc-handlers.cts:105` returns a
  bare value, not an envelope.
- The value is cosmetic. A failure has no message worth surfacing to the user, so no
  caller needs `unwrapIpc`'s thrown `Error` with its `status` field.

Because the method is **required**, `browser-ipc-shim.ts`'s object literal fails to
compile until it implements it. `src/public/tsconfig.json` sets `noEmitOnError: true`,
so the build enforces this. The interface edit and the shim edit must therefore land in
the same task. This is why they are paired in Task 1.1 below.

### Contract 2 — the server route

`GET /api/version` answers `200` with:

```json
{ "version": "1.0.0" }
```

It answers `500` with `{ "error": "..." }` if `package.json` could not be read. It takes
no input, no query string, and no body.

### Where each piece attaches

| Piece | File | What it does |
|---|---|---|
| Main-process handler | `electron/ipc-handlers.cts` | `ipcMain.handle('getAppVersion', () => app.getVersion())`, registered inside the existing `registerIpcHandlers()` |
| Preload bridge | `electron/preload.cts` | one more key in the existing `praxisAPI` object literal |
| Type contract | `src/public/ipc-adapter.ts` | the `getAppVersion` line on `interface PraxisAPI` |
| Browser fallback | `src/public/browser-ipc-shim.ts` | one more method, reusing the file's own `fetchIpc` helper |
| Server route | `src/server.ts` | one branch in `handleApi`, above its closing `sendJson(res, 404, ...)` |
| Renderer display | `src/public/app-version.ts` (new) | reads the value, writes it into `#app-version` |
| Markup | `src/public/index.html`, `src/public/board.html` | one element in the existing footer, one `<script>` tag |
| Build list | `src/public/tsconfig.json` | the new file added to `include` |

### `electron/main.cts` needs no change

The Context named it as a candidate. Reconnaissance shows it is not needed.
`main.cts` already calls `registerIpcHandlers()` after the server is ready, and
`ipc-handlers.cts` can import `app` from `electron` beside its existing
`ipcMain, dialog` import. Adding the handler in `main.cts` would split one concern
across two files for no gain.

### The main-process handler

`electron/ipc-handlers.cts` today imports `{ ipcMain, dialog }`. Add `app` to that
import, then register beside `pickProjectFolder`:

```ts
ipcMain.handle('getAppVersion', () => app.getVersion());
```

This is the direct pattern, not the loopback relay. It performs no HTTP request, so it
does not depend on `SERVER_URL`. `app.getVersion()` is synchronous and does not throw.

### The server route

`src/server.ts` reads its own `package.json` **once at module load**, not per request:

```ts
const APP_VERSION: string | null = (() => {
  try {
    const raw = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { version?: string };
    return typeof parsed.version === 'string' ? parsed.version : null;
  } catch (err) {
    console.error('Could not read package.json for the app version:', err);
    return null;
  }
})();
```

`__dirname` in the compiled `dist/server.js` is `dist/`, so `../package.json` is the
repository root's `package.json`. That path also holds inside a packaged build, because
`package.json` is listed in the `build.files` array of `package.json` itself. In a
packaged build no client calls this route, because the renderer uses IPC there. The
route stays correct anyway, and both paths derive from the same `version` field.

The route branch goes in `handleApi`, above its final `sendJson(res, 404, ...)`:

```ts
if (reqPath === '/api/version' && method === 'GET') {
  if (APP_VERSION === null) {
    sendJson(res, 500, { error: 'Could not read the app version' });
    return;
  }
  sendJson(res, 200, { version: APP_VERSION });
  return;
}
```

### The renderer module

New file `src/public/app-version.ts`. Like `ipc-adapter.ts` and `browser-ipc-shim.ts`,
it uses no `import` or `export` keyword, because `src/public/tsconfig.json` sets
`module: "none"` and rejects a module file.

What it knows: how to call `window.praxisAPI.getAppVersion()`, and how to write the
result into the element with id `app-version`.

What it must NOT know: projects, boards, workstreams, the registry, the KPI strip, the
filters, or anything about `flowcharge/`. It reads no other DOM element and calls no other
API method.

It no-ops when the element is absent, and no-ops when the value is `null`, so
acceptance criterion 5 holds without a visible error path.

`src/public/tsconfig.json`'s `include` array must gain `"app-version.ts"`, because that
array is an explicit file list, not a glob.

### Markup and load order

Both `index.html:35-40` and `board.html:79-84` already carry
`<footer class="note">`. Add one element as the last child of each:

```html
<div id="app-version" hidden></div>
```

A `<div>` is used, not a `<span>`, so the line sits on its own row with no new CSS.
`src/public/styles.css` needs no change: `footer.note` at `styles.css:481` already sets
the colour and the font size, and the child inherits both. This keeps the "no other
file's behaviour changes" constraint literal for the stylesheet.

The script tag goes after `browser-ipc-shim.js` on both pages, because the shim installs
`window.praxisAPI` at script-load time in a browser tab:

```html
<script src="app-version.js"></script>
```

`tools/copy-assets.mjs` needs no change. It already copies `index.html` and
`board.html`, and `tsc -p src/public/tsconfig.json` emits `dist/public/app-version.js`
through the existing `rootDir`/`outDir` pair.

### Why the footer, and not the board masthead's `.meta` block

The Context offered both. The footer wins for two reasons:

- `index.html` has no `.meta` block. Only `board.html` does, at `board.html:20-24`.
  Choosing `.meta` would therefore force two different placements and two different
  render sites, one in `app.ts` and one in `home.ts`. The footer exists on both pages
  with the same class, so one element id and one shared script cover both.
- The `.meta` block holds live, per-project data: the generated date, the workstream and
  issue counts, the git branch, and the live-refresh status. `app.ts:1174-1179` fills it
  from the board payload. The app's own version is not project data. Putting it there
  would mix two concerns in one block.

## Staged task breakdown

### Phase 1 — Both providers answer the new method

The contract and its two implementations land first. No UI changes yet, so nothing the
user sees can break.

**Task 1.1 — Server route, shim method, and the type contract.**
- Build: the `APP_VERSION` constant and the `/api/version` branch in `src/server.ts`;
  the `getAppVersion` line on `interface PraxisAPI` in `src/public/ipc-adapter.ts`; the
  `getAppVersion` implementation in `src/public/browser-ipc-shim.ts`, reusing that
  file's own `fetchIpc` helper and mapping a failed result to `null`.
- Files: `src/server.ts`, `src/public/ipc-adapter.ts`, `src/public/browser-ipc-shim.ts`.
- Effort: small.
- Depends on: nothing.
- Verify: run `npm start`. Then `curl http://localhost:4173/api/version` prints
  `{"version":"1.0.0"}`. In the browser tab's console,
  `await window.praxisAPI.getAppVersion()` returns `"1.0.0"`. The board and the home
  page still load and behave exactly as before.

**Task 1.2 — Main-process handler and preload bridge.**
- Build: add `app` to the `electron` import in `electron/ipc-handlers.cts`, register
  `ipcMain.handle('getAppVersion', () => app.getVersion())` inside
  `registerIpcHandlers()`, and add the matching forwarder key to the `praxisAPI` object
  in `electron/preload.cts`.
- Files: `electron/ipc-handlers.cts`, `electron/preload.cts`.
- Effort: small.
- Depends on: Task 1.1, for the `PraxisAPI` type line only.
- Verify: run `npm run electron:dev`. In the window's devtools console,
  `await window.praxisAPI.getAppVersion()` returns `"1.0.0"`. Adding a project, opening
  a board, and the folder picker all still work.

### Phase 2 — The user sees the version

**Task 2.1 — The shared renderer module and the footer markup.**
- Build: the new `src/public/app-version.ts`; the `<div id="app-version" hidden>`
  element in both footers; the `<script src="app-version.js"></script>` tag after
  `browser-ipc-shim.js` on both pages; the `"app-version.ts"` entry in
  `src/public/tsconfig.json`'s `include` array.
- Files: `src/public/app-version.ts` (new), `src/public/index.html`,
  `src/public/board.html`, `src/public/tsconfig.json`.
- Effort: small.
- Depends on: Task 1.1 and Task 1.2.
- Gotcha: omitting the `include` entry means `tsc` emits no `app-version.js`, the
  `<script>` tag 404s, and the footer silently stays empty. Check that
  `dist/public/app-version.js` exists after the build.
- Verify: run `npm run electron:dev` and confirm the footer reads `Version 1.0.0` on the
  home page and on a board page. Run `npm start`, open both pages in a browser tab, and
  confirm the same line. Change `version` in `package.json` to `1.0.1`, rebuild, and
  confirm both paths show `Version 1.0.1`. Restore the value. Stop the server, open a
  stale browser tab, and confirm the footer shows no version line and the console shows
  no uncaught exception.

## Data & compatibility

- **Migrations:** none. This feature persists nothing and reads no stored state. The
  `.praxis-projects.json` registry is untouched.
- **Backward compatibility:** every change is additive. The six existing `praxisAPI`
  methods keep their names, arguments, and return shapes. No existing route changes. No
  existing DOM element changes, because the new element is appended inside the footer.
- **Forward contract:** WS-59 will consume `getAppVersion()`. Its name and its
  `Promise<string | null>` return shape should be treated as settled from this plan on,
  so that WS-59 does not have to rename it.
- **Rollback:** delete the additions. Nothing depends on them. In order, that is: the
  `<script>` tag and the `<div>` from both HTML pages, `app-version.ts` and its
  `include` entry, the preload key, the `ipcMain.handle` call and the `app` import, the
  shim method, the `PraxisAPI` line, and the server route with its `APP_VERSION`
  constant. The feature is fully reversible at every phase.

## Testing strategy

This repository has no test runner. `package.json` declares no `test` script and no test
dependency, and no test directory exists. So verification is the per-task manual check
above, plus the compiler.

- **The compile gate is real coverage here.** Both `src/public/tsconfig.json` and
  `electron/tsconfig.json` set `noEmitOnError: true`. A missing required method on the
  shim, or a wrong return type, fails `npm run build` and blocks the emit.
- **Manual integration checks, per phase:** the `curl` check and the two console checks
  in Phase 1, and the four visual checks in Phase 2.
- **Pointer for a later write-tests pass**, if a runner is ever added to this repo: the
  two units worth covering are the shim's `getAppVersion` mapping a failed `fetchIpc`
  result to `null`, and the server route answering `500` when `APP_VERSION` is `null`.
  The main-process handler is a one-line delegation to an Electron API and needs no
  test.

## Non-functional notes

- **Performance:** the server parses `package.json` once at module load, not per
  request. The renderer makes one call per page load. Both costs are negligible.
- **Security:** the new route is a `GET` with no input, so there is no new validation
  boundary. It sits behind the existing `passesOriginCheck` in `src/server.ts`, like
  every other route. It discloses only a version string, which is far less than the
  project content the same server already serves. The Content Security Policy needs no
  change, because `script-src 'self'` already permits the new same-origin script file.
- **Observability:** the server logs once at startup if `package.json` cannot be read.
  The renderer stays silent on failure, by design, because the display is cosmetic.

## Open questions

1. **Should the plain browser tab show the version?** I settled this as "yes" in
   assumption A1, because `README.md` treats `npm start` as first-class. The options are:
   (a) show it everywhere, which is this plan; or (b) Electron only, following the
   `pickProjectFolder` precedent. Option (b) is a strict subset of this plan: it would
   delete the `/api/version` route, delete the shim method, mark `getAppVersion` optional
   on `PraxisAPI`, and add a `typeof` feature check in `app-version.ts`.
   **Recommendation: keep (a).** Tell me before Phase 1 if you want (b), because the
   route and the shim method are Task 1.1's whole content.
2. **Is `Version 1.0.0` the wording you want?** Alternatives are `v1.0.0` and
   `Praxis Board 1.0.0`. **Recommendation: `Version 1.0.0`**, because the footer already
   uses full-sentence prose. This is a one-string change at any time.
3. **Does WS-59 need a reserved place for the update notice?** This plan reserves none.
   It adds only the version line, and the footer may not be where an update banner
   belongs. **Recommendation: leave it unreserved**, and let WS-59 choose its own
   location. Confirm that you are happy for WS-59 to add markup of its own.

## Alternatives considered and rejected

- **Relay the version through the loopback pattern in `electron/ipc-handlers.cts`.**
  Every other handler in that file relays to an `/api/*` route, and the new
  `/api/version` route would make this possible. Rejected because the Context settles
  `app.getVersion()` as the main-process source, and because that value comes from the
  packaged `Info.plist`, which is the true version of the running application. A relay
  would report the bundled `package.json` instead, and would add a needless HTTP round
  trip inside one process.
- **Show the version in the board masthead's `.meta` block.** Rejected because
  `index.html` has no such block, which would force two placements and two render sites,
  and because `.meta` holds per-project live data while the app version is not project
  data. See the Design section.
- **Render the version inside `app.ts` and `home.ts` instead of a new shared file.**
  Rejected because it duplicates the same fetch-and-write logic in two large page
  scripts, and because it couples a page's board or registry logic to app metadata. One
  small file with a single responsibility is the better fit, and it matches how
  `ipc-adapter.js` and `browser-ipc-shim.js` are already shared between both pages.
- **Return the `PraxisIpcResult<T>` envelope from `getAppVersion()`.** Rejected because
  the Electron path is not an HTTP call and would have to invent a status code, and
  because the value is cosmetic, so no caller needs `unwrapIpc`'s typed error. The raw
  shape matches `pickProjectFolder`, the one existing direct handler.
- **Add an About dialog to hold the version.** Rejected as gold-plating. The Context
  asks only that the app knows and can display its version. Two suitable homes already
  exist in the markup, so a new screen is not needed.

## Final summary

The approach: one new `getAppVersion()` method on the existing `praxisAPI` surface,
answered by `app.getVersion()` in Electron and by a new `GET /api/version` route in a
browser tab, displayed by one small shared script in the footer of both pages.

Three tasks in two phases, all small. Roughly one sitting of work in total.

Top risks:
1. Forgetting the `"app-version.ts"` entry in `src/public/tsconfig.json`'s `include`
   array. The build then emits no script and the footer stays empty with no error.
2. Making `getAppVersion` required on `PraxisAPI` before the shim implements it, which
   breaks the build until both edits land. Task 1.1 pairs them for this reason.
3. Reversing open question 1 after Phase 1 wastes Task 1.1's work.

Needs your answer: open questions 1, 2, and 3. Only question 1 changes the plan.

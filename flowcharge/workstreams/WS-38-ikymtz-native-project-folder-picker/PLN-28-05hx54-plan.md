---
id: PLN-28-05hx54
type: plan
workstream: WS-38-ikymtz
slug: native-project-folder-picker
title: "Add Electron's native folder-picker dialog alongside the typed project path"
status: done
created: 2026-08-17
updated: 2026-08-18
depends_on: []
links: []
---

## Summary

This plan adds a "Choose folder" button to `src/public/home.ts` that opens Electron's native OS
folder-picker dialog via `dialog.showOpenDialog`, and feeds the dialog's result straight into
WS-37's already-planned `window.praxisAPI.addProject(path)` IPC call. **Revision note (this
version):** an earlier version of this plan replaced the typed-path `#add-form`/`#project-path`
input outright with this button. That is now known to violate a standing requirement — surfaced
by sibling workstream WS-45-kvkdgl, already committed, which added
`src/public/browser-ipc-shim.ts` so a plain browser tab can run the whole app (six of
`window.praxisAPI`'s methods, backed by `fetch()`) with no possible way to implement
`pickProjectFolder` in a tab, since a browser cannot invoke a native OS dialog. The typed-path
form is the only way to add a project in a plain browser tab and must stay. This plan therefore
keeps **both** paths side by side and chooses between them once, at page-load/init time, by
feature-detecting `window.praxisAPI.pickProjectFolder` — present (a function) in Electron, absent
in the browser shim — never by per-submit branching and never by a bare `window.praxisAPI`
truthiness check (WS-45's shim always defines `window.praxisAPI` in a browser tab, just without
this one method, so a bare-existence check would wrongly select the native-only button there).

The picker itself is exposed as a seventh IPC channel, `pickProjectFolder`, added to WS-37's own
`electron/ipc-handlers.cts` and `electron/preload.cts` rather than to `main.cts` or a new file
(Design, below). Unlike WS-37's six channels, `pickProjectFolder` resolves a plain
`Promise<string | null>` — not wrapped in WS-37's `PraxisIpcResult<T>` envelope — because it
never calls `server.ts` over loopback HTTP and so has no status code to carry (Design, below).
Because WS-45's shim object literal has no `pickProjectFolder` property, this plan declares the
method **optional** (`pickProjectFolder?(): ...`) on `ipc-adapter.ts`'s `PraxisAPI` interface, so
the shim continues to type-check under TypeScript's strict structural typing with zero changes to
`browser-ipc-shim.ts` itself — that file is owned by WS-45 and is correct as-is once the
interface property is optional (Design, Decision 3, below). This plan touches only what feeds
`addProject` its path, plus the coexistence/feature-detect wiring: WS-37's IPC bridge,
`hasPrxwork` check, and registry write are untouched and not re-planned, and WS-45's shim file is
not modified.

## Scope

**In scope — acceptance criteria:**

1. A user in the **Electron app** who clicks "Choose folder", picks a folder that contains
   `flowcharge/`, sees that folder appear as a new tile — with `#add-form`/`#project-path` hidden
   and not part of that flow.
2. A user who picks a folder that does **not** contain `flowcharge/` sees the existing message in
   `#add-error`: `` No flowcharge/ folder found under <path> — a project is a directory containing
   flowcharge/ `` — `server.ts`'s own string, surfaced unchanged through WS-37's `addProject`
   IPC call and `unwrapIpc` — proving the `hasPrxwork` check still runs on any folder the
   dialog can return.
3. A user who opens the dialog and cancels it (`pickProjectFolder` resolves `null`) sees no
   error message and no change to the tile list — a silent no-op, not a failure state.
4. `src/public/index.html`'s "Add a project" section contains **both** `#add-form`
   (with `#project-path`) and `#choose-folder-button`, unchanged from today except for the new
   button and a `hidden` attribute on each so init-time script can show exactly one. Neither is
   deleted.
5. `src/public/home.ts` still contains `submitPath()`, `ABSOLUTE_PATH_MESSAGE`,
   `TILDE_MESSAGE`, and the `#add-form` submit listener, working exactly as they do today — none
   of these are deleted. New init-time logic (Design, below) decides which of `#add-form` /
   `#choose-folder-button` is visible; it does not touch `submitPath()`'s own behavior.
6. With the Electron app running (WS-36/WS-37's shell), clicking "Choose folder" opens the
   real OS-native folder picker (Finder-style on macOS, the GTK picker on Linux, the Windows
   picker on Windows) via `dialog.showOpenDialog` — not an HTML `<input type="file">`
   fallback. `#add-form` is hidden and not reachable in this mode.
7. `window.praxisAPI.pickProjectFolder()` exists as a seventh method alongside WS-37's six,
   typed in `src/public/ipc-adapter.ts`'s `PraxisAPI` interface as
   `pickProjectFolder?(): Promise<string | null>` (**optional**, per Design Decision 3) —
   distinct from the other six methods, which are required and resolve
   `Promise<PraxisIpcResult<T>>`.
8. A user in a **plain browser tab** (WS-45's `browser-ipc-shim.ts` active, no
   `pickProjectFolder`) sees `#choose-folder-button` hidden and `#add-form` visible at page
   load, and can add a project by typing an absolute path and submitting the form exactly as
   today — `submitPath()` runs unchanged, calling `window.praxisAPI.addProject(...)`, which
   WS-45's shim provides via `fetch()`.
9. The feature-detect that chooses between the two runs once, at init time (page load), using
   `typeof window.praxisAPI.pickProjectFolder === 'function'` — never a bare
   `window.praxisAPI` truthiness check (which is always true under WS-45's shim and would
   wrongly select the button in a browser tab), and never re-evaluated per submit/click.
10. `browser-ipc-shim.ts` (WS-45-owned) is not modified by this plan, and continues to
    type-check against the now-optional `pickProjectFolder` member of `PraxisAPI` with no
    changes to its object literal.

**Out of scope:**

- Everything WS-37 already places inside its `addProject` channel (the loopback relay to
  `POST /api/projects`, `hasPrxwork` check, registry write) — not re-planned or duplicated
  here.
- Rename and delete flows in `home.ts` — untouched, per Context's own scope note.
- Trimming `handleAddProject`'s empty-value/`~`-prefix/non-absolute checks in `src/server.ts`
  — **superseded by this revision**: these remain fully reachable, since `#add-form` and
  `submitPath()`'s client-side guards stay live for the browser-tab path (Context point 2 below
  keeps them, contradicting the prior version's "delete outright"). Not this workstream's job
  regardless.
- Modifying `src/public/browser-ipc-shim.ts` — owned by WS-45, correct as-is once
  `pickProjectFolder` is optional on `PraxisAPI` (Design Decision 3). This plan reads it for
  context only.
- Cross-platform packaging (WS-39) and anything about distributable-build verification — this
  plan only wires the picker into the existing dev/build shell WS-36/WS-37 establish.
- A `defaultPath` for the dialog, or scoping the dialog to a specific `BrowserWindow` instance
  for modality — Context's own investigation gives the call shape as
  `dialog.showOpenDialog({ properties: ['openDirectory'] })`, with no window argument and no
  `defaultPath`; this plan follows that shape verbatim rather than adding either. Flagged
  under Open questions.

**Assumptions:**

- **Execution order.** WS-37 (plan PLN-27-wp9kt5) has landed: `electron/main.cts`,
  `electron/preload.cts`, `electron/ipc-handlers.cts`, and `src/public/ipc-adapter.ts` all now
  exist in the repo with the six `ipcMain.handle` channels, confirmed by this revision's own
  reread (`grep` for `pickProjectFolder`/`dialog` across those files returns nothing, so
  Phase 1 below is still unstarted work). **Revision update:** the original version of this
  plan noted `electron/` didn't exist yet at authoring time and built forward from WS-37's plan
  document rather than code on disk; that gap has since closed — WS-37 has landed, and sibling
  workstream WS-45-kvkdgl has also landed, adding `src/public/browser-ipc-shim.ts` (Context,
  above), which is the concrete trigger for this revision.
- Electron is the target shell (not Tauri), per Context's own restatement of the user's
  explicit pivot decision; this supersedes the earlier Tauri-targeted version of this plan
  entirely.
- The dialog is a single-folder picker only (`properties: ['openDirectory']`, no `multiSelections`)
  — Context's own description of the handler doesn't mention multi-folder selection, and no
  multi-folder batch-add is in scope.
- **Coexistence, not replacement (this revision).** Per Context's explicit instruction, the
  typed-path form and the native-dialog button both stay in the DOM permanently; which one is
  visible is decided once at init time by feature-detecting `pickProjectFolder`, not by removing
  either. This supersedes the earlier "single button, form deleted" version of this plan
  entirely, for the reason given in Summary (browser-tab support has no way to implement a
  native OS dialog).
- The button's exact label and placement ("Choose folder", positioned as a second control
  alongside the existing "Add project" button/form under the existing "Add a project" heading,
  each toggled by `hidden`) is this plan's
  reasonable default, not a confirmed decision — flagged under Open questions.

## Design

### Decision 1 — where the new handler lives: `electron/ipc-handlers.cts`, not `main.cts`

Both are defensible; this plan commits to extending WS-37's `electron/ipc-handlers.cts` with a
seventh `ipcMain.handle('pickProjectFolder', ...)` registration, called from the same
registration entrypoint `main.cts` already invokes once for WS-37's six channels, right after
the readiness poll succeeds and before `BrowserWindow.loadURL`.

Reasoning: `ipc-handlers.cts` is already the one file that answers "what IPC channels does this
app expose" — WS-37 deliberately gives every `ipcMain.handle` registration a single home so the
channel surface is visible in one place, rather than split across files by which channels
happen to need a loopback HTTP call and which don't. `main.cts`'s job, per WS-36/WS-37, is app
bootstrap and window lifecycle (starting `dist/server.js`, polling for readiness, creating the
`BrowserWindow`) — adding a channel implementation there would mix a new concern into a file
whose scope WS-36/WS-37 already established as narrower. The one cost of the chosen option is
that `ipc-handlers.cts` gains a channel that doesn't use its shared `loopbackRequest` helper
(Rejected alternative, below, weighs this against the alternative directly).

### Decision 2 — envelope shape: plain `Promise<string | null>`, not `PraxisIpcResult<T>`

WS-37's six channels all resolve `PraxisIpcResult<T>` (`{ok,status,data}` / `{ok,status,error}`)
because each one proxies an HTTP response carrying a real status code from `server.ts`.
`pickProjectFolder` makes no HTTP call and has no status code to carry — its only two outcomes
are "a folder was chosen" (a path string) and "the user cancelled" (`null`), which is exactly
`dialog.showOpenDialog`'s own return shape once collapsed by the handler
(`result.canceled || !result.filePaths.length ? null : result.filePaths[0]`). Forcing that
through `{ok: true, status: 200, data: path}` would manufacture a status code that corresponds
to nothing, and `null`-on-cancel would need inventing a fake failure status where none exists —
cancelling a folder picker is not an error condition.

This plan commits to breaking the "every channel uses the same envelope" uniformity for this
one channel, accepting the inconsistency as the smaller cost: a reader of `ipc-adapter.ts`'s
`PraxisAPI` interface sees six methods returning `Promise<PraxisIpcResult<T>>` and one
returning `Promise<string | null>`, distinguishable by name and by the fact that only the
latter has no `.then(unwrapIpc)` step at its call site. The alternative — wrapping it anyway —
is weighed and rejected below.

### Decision 3 (this revision) — `pickProjectFolder` is optional on `PraxisAPI`, and both UI
paths coexist behind a `typeof` feature-detect

WS-45-kvkdgl's `browser-ipc-shim.ts` (already committed, out of this plan's ownership — Out of
scope, above) defines `window.praxisAPI` as an object literal with exactly six methods, in a
plain browser tab where no native OS folder dialog can exist at all. If this plan's Design
(below) added `pickProjectFolder(): Promise<string | null>;` as a **required** member of the
`PraxisAPI` interface, WS-45's object literal would stop satisfying that interface under
TypeScript's structural typing the moment this plan's interface change lands — a compile break
in a file this workstream doesn't own and was told not to touch.

This plan resolves that by making the member optional —
`pickProjectFolder?(): Promise<string | null>;` — which does two things at once: WS-45's
existing six-method object literal continues to satisfy `PraxisAPI` with zero edits to
`browser-ipc-shim.ts`, and TypeScript narrows `typeof window.praxisAPI.pickProjectFolder ===
'function'` into a valid, idiomatic optional-method feature-detect exactly the way Context
requires and exactly the pattern TypeScript expects for an optional interface member — no `as`
cast needed at `initAddProjectControl()`'s own `if` check (`home.ts`, below). That narrowing is
scoped to the block it happens in, though: it cannot carry across to the separate
`#choose-folder-button` click-handler closure, which runs later, on a different call stack, with
no way for TypeScript to know `initAddProjectControl()` already ran and chose this branch. That
one remaining call site (`window.praxisAPI.pickProjectFolder!()` in the click handler, below)
still needs a `!`-assertion — safe in practice because the handler is only reachable while the
button is visible, which `initAddProjectControl()` only allows once the method is confirmed
present, but not something the type system can verify across the two closures on its own.

The corollary this plan commits to: the UI itself must offer both paths permanently, not pick
one at build/ship time, because the same compiled `src/public/*.js` bundle is loaded by both an
Electron `BrowserWindow` (real `pickProjectFolder`) and a plain browser tab hitting
`src/server.ts` directly (shimmed, no `pickProjectFolder`) — Context's standing requirement.
`index.html` therefore ships both `#add-form` and `#choose-folder-button` unconditionally, and
`home.ts` chooses which is visible once, at init, using the same `typeof ... === 'function'`
check — never a bare `window.praxisAPI` truthiness check, which is always `true` under WS-45's
shim and would wrongly select the native-only button in a browser tab where it can never
resolve.

### IPC channel — contract

```ts
// electron/ipc-handlers.cts — one addition alongside WS-37's six registrations
ipcMain.handle('pickProjectFolder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return result.canceled || !result.filePaths.length ? null : result.filePaths[0];
});
```

```ts
// electron/preload.cts — one addition alongside WS-37's six contextBridge wrappers
pickProjectFolder: (): Promise<string | null> => ipcRenderer.invoke('pickProjectFolder'),
```

```ts
// src/public/ipc-adapter.ts — the one line of a WS-37-owned file this workstream touches,
// mirroring how WS-37 itself added one export to WS-36's main.cts (a small wiring necessity,
// not a re-plan of WS-37's ambient PraxisAPI interface). The `?` is this revision's Decision 3:
// optional, so WS-45's six-method shim object literal keeps satisfying this interface unchanged.
interface PraxisAPI {
  // ...WS-37's six existing methods, each Promise<PraxisIpcResult<T>>, unchanged...
  pickProjectFolder?(): Promise<string | null>;
}
```

`dialog` is imported from Electron's `electron` module directly in `ipc-handlers.cts` — no new
dependency, matching Context's confirmed finding that `dialog` is main-process-only and
therefore can only be called from code that already runs in the main process, which
`ipc-handlers.cts` does.

### `home.ts` — init-time feature-detect, plus the new click handler

`submitPath()`, `ABSOLUTE_PATH_MESSAGE`, `TILDE_MESSAGE`, and the `#add-form` submit listener
(lines 2–3, 213–248 of the current file) are **kept, unmodified** — this is the change from the
prior version of this plan (Context point 2). What's new is (a) a `#choose-folder-button` click
handler, added alongside the existing `#add-form` listener rather than replacing it, and (b) a
one-time init block that decides which of the two is visible:

```ts
// src/public/home.ts — new code, added alongside the untouched submitPath()/#add-form listener

// Runs once, at script-load/init time — never per-submit, never per-click. `pickProjectFolder`
// is optional on PraxisAPI (ipc-adapter.ts Decision 3); a `typeof` check is the correct
// feature-detect for an optional method, and is NOT the same as `if (window.praxisAPI)`, which
// WS-45's browser-ipc-shim.ts makes true unconditionally in a plain browser tab.
function initAddProjectControl() {
  if (typeof window.praxisAPI.pickProjectFolder === 'function') {
    byId('add-form').hidden = true;
    byId('choose-folder-button').hidden = false;
  } else {
    byId('choose-folder-button').hidden = true;
    byId('add-form').hidden = false;
  }
}

byId('choose-folder-button').addEventListener('click', function () {
  setError('');
  // Non-null assertion is safe here: this listener only ever fires while the button is
  // visible, which initAddProjectControl() only allows when the method is present.
  window.praxisAPI.pickProjectFolder!()
    .then(function (path) {
      if (path == null) return; // cancelled — silent no-op, per acceptance criterion 3
      return window.praxisAPI.addProject(path).then(unwrapIpc).then(function () {
        return loadProjects();
      });
    })
    .catch(function (err) {
      setError(err.message);
    });
});

initAddProjectControl();
```

This mirrors `submitPath()`'s existing shape (`setError('')` first, then a `.then()/.catch()`
chain ending in `loadProjects()` or `setError(err.message)`) closely enough that the rest of
`home.ts` (`renderTiles`, `loadProjects`, the rename/delete handlers, and `submitPath()` itself)
needs no change. Note the asymmetry the two envelope decisions above produce at this one call
site: `pickProjectFolder()` is awaited directly (no `unwrapIpc`, per Decision 2), while the
nested `addProject(path)` call still goes through `.then(unwrapIpc)` exactly as WS-37's plan
already specifies, because `addProject` is one of the six HTTP-backed channels and keeps
WS-37's envelope.

`initAddProjectControl()` is called once, near the bottom of the IIFE alongside the existing
`loadProjects()` call (order between the two doesn't matter — they touch disjoint elements).
Nothing is deleted from `home.ts`. `httpError` and `setError` are unaffected — `httpError`
already moves to `ipc-adapter.ts` under WS-37's plan, and `setError` keeps writing to the same
`#add-error` element, shared by both the form and the button's error path.

### `index.html` and `styles.css` — both controls ship, `hidden` picks one

```html
<!-- src/public/index.html — before (unchanged from today) -->
<form class="add-form" id="add-form">
  <input type="text" id="project-path" autocomplete="off" placeholder="/Users/you/Work/your-project">
  <button type="submit">Add project</button>
</form>
<div id="add-error"></div>

<!-- after (this revision) — #add-form is unchanged; #choose-folder-button is new; both start
     hidden, and initAddProjectControl() (above) removes exactly one hidden attribute at
     init time, before the user can perceive either state -->
<form class="add-form" id="add-form" hidden>
  <input type="text" id="project-path" autocomplete="off" placeholder="/Users/you/Work/your-project">
  <button type="submit">Add project</button>
</form>
<button type="button" id="choose-folder-button" hidden>Choose folder</button>
<div id="add-error"></div>
```

Both start `hidden` in the markup (not only toggled from script) so that a slow-loading script,
or a user with JavaScript disabled, sees neither half-wired control rather than a flash of the
wrong one — `initAddProjectControl()` runs synchronously in the same inline module load as
`loadProjects()`, so in the normal case the flash is not observable either way; the static
`hidden` is the defensive floor under that.

**CSS approach (architect's choice — this revision).** Context leaves the mechanism open
("share a class, or duplicate the button's visual rules under `#choose-folder-button` —
architect's choice, state which you pick and why"). This plan chooses **selector-list reuse**
over introducing a shared class name: `src/public/styles.css` (currently lines 624–647) keeps
`.add-form` and `.add-form input` exactly as they are (the form is still live for the browser
path, so both rules still have a surviving element to style — nothing here is removed, contrary
to the prior version of this plan). `.add-form button`, `.add-form button:hover`, and
`.add-form button:focus-visible` each gain `#choose-folder-button` as a second selector in the
same comma-separated rule, e.g.:

```css
.add-form button, #choose-folder-button {
  border: 1px solid var(--line-strong);
  border-radius: 6px;
  background: var(--accent);
  color: var(--paper-raised);
  padding: 6px 14px;
  font-size: 12.5px;
  cursor: pointer;
}
.add-form button:hover, #choose-folder-button:hover { background: var(--accent-ink); }
.add-form button:focus-visible, #choose-folder-button:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
```

Reasoning: a shared class (e.g. adding `class="add-form-button"` to both buttons) would need an
edit to `index.html`'s existing `<button type="submit">Add project</button>` markup for a
rule that's otherwise untouched, and would leave two names in play for one visual style (the
class and the `.add-form button` descendant selector some other rule might still target).
Comma-joining the selector is the smaller, more local diff — one rule definition, still DRY (no
duplicated property list), zero markup churn on the existing button — at the minor cost that a
future third consumer of this look would need a third selector appended to the same three
rules rather than just applying a class; with exactly two consumers today, that trade favors
the simpler option (KISS/YAGNI: don't build the class-based reuse mechanism until a third
consumer actually shows up). `hidden` is the plain HTML boolean attribute, so no CSS rule is
needed for it — the browser's built-in `[hidden] { display: none }` UA-stylesheet rule
(present in every browser this app targets) handles both elements identically.

### What each new/changed piece knows and does not know

- The `pickProjectFolder` handler in `ipc-handlers.cts` knows only how to open a native folder
  dialog and collapse its result to `string | null`. It must not know what a project is, what
  `flowcharge/` is, or call anything project-registry-related — that stitching lives entirely in
  `home.ts`'s click handler, the same boundary WS-37 already draws around each of its own
  channel handlers (each one relays exactly one route, nothing more).
- `home.ts`'s click handler knows "get a path, hand it to `addProject`, refresh or show the
  error" — the same shape `submitPath()` already had. Unlike the prior version of this plan,
  the client-side path-shape guards in `submitPath()` are **not** removed, because `submitPath()`
  itself is not removed — it remains the only add-project path in a browser tab, where its
  guards are still the first line of feedback before the round trip to `server.ts`.
- `initAddProjectControl()` knows only "which one control should be visible," decided from one
  fact (`typeof window.praxisAPI.pickProjectFolder === 'function'`). It must not know why the
  method might be absent (WS-45's shim vs. some future third `praxisAPI` implementation) — that
  distinction is WS-45's to own, not this plan's to encode.
- `server.ts`'s validation is not touched and stays the sole authority on what a valid project
  path is — the `hasPrxwork` check remains genuinely live and necessary on both paths, since
  either a dialog-picked folder or a typed path can lack `flowcharge/`.

## Staged task breakdown

**Phase 1 — `pickProjectFolder` IPC channel (main process, preload, adapter types).**
Effort: small. Dependencies: WS-37 landed (Assumptions, above — confirmed landed).
- Add the `ipcMain.handle('pickProjectFolder', ...)` registration to
  `electron/ipc-handlers.cts`, alongside WS-37's six, per the IPC channel contract above.
  Import `dialog` from `electron`.
- Add the `pickProjectFolder` wrapper to `electron/preload.cts`'s
  `contextBridge.exposeInMainWorld('praxisAPI', {...})` call, alongside WS-37's six.
- Extend the `PraxisAPI` interface in `src/public/ipc-adapter.ts` with
  `pickProjectFolder?(): Promise<string | null>` — **optional**, per Decision 3. Do not touch
  `src/public/browser-ipc-shim.ts`; confirm after this edit that it still compiles unchanged
  (its object literal has no `pickProjectFolder` property, which is exactly why the interface
  member must be optional).
- Files touched: `electron/ipc-handlers.cts`, `electron/preload.cts`,
  `src/public/ipc-adapter.ts`.
- Verify: `npm run build` exits 0 (this is also the first point at which WS-45's shim is
  type-checked against this plan's interface change — a build failure here means the `?` was
  dropped); with the Electron app running, evaluate
  `await window.praxisAPI.pickProjectFolder()` from the devtools console on the home page —
  the real OS folder picker opens and resolves to a path (or `null` on cancel), proving the
  registration, preload exposure, and typing all work together before `home.ts` depends on
  them.

**Phase 2 — coexisting UI controls and `home.ts` init logic.**
Effort: small. Dependencies: Phase 1; WS-37's `addProject` channel already exists.
- Edit `src/public/index.html`: keep `#add-form`/`#project-path` exactly as they are, add the
  new `#choose-folder-button` as a sibling, and give both a static `hidden` attribute, per the
  UI change above.
- Edit `src/public/home.ts`: keep `submitPath()`, `ABSOLUTE_PATH_MESSAGE`, `TILDE_MESSAGE`, and
  the `#add-form` submit listener untouched; add the `#choose-folder-button` click handler and
  `initAddProjectControl()` per the contract above, and call the latter once near
  `loadProjects()`.
- Edit `src/public/styles.css`: keep `.add-form`/`.add-form input` untouched; extend
  `.add-form button` and its `:hover`/`:focus-visible` rules to also match
  `#choose-folder-button` via comma-separated selectors (CSS approach, above) — no rule bodies
  duplicated, no rule removed.
- Files touched: `src/public/index.html`, `src/public/home.ts`, `src/public/styles.css`.
- Verify (Electron app running — WS-36/WS-37's shell): on page load, `#choose-folder-button` is
  visible and `#add-form` is hidden. Click "Choose folder" — the OS picker opens; picking a
  real `flowcharge/`-containing folder adds a tile exactly as the old typed-path flow did; picking
  a folder without `flowcharge/` shows the same "No flowcharge/ folder found under..." text in
  `#add-error`; cancelling the dialog changes nothing and shows no error. Confirm `#add-form`
  is present in the DOM but `hidden`, not removed.
- Verify (plain browser tab — `npm run <dev-server-script>` and open the URL directly, no
  Electron shell, WS-45's shim active): on page load, `#add-form` is visible and
  `#choose-folder-button` is hidden. Typing an absolute path containing `flowcharge/` and
  submitting the form adds a tile exactly as before this plan existed; the empty-value, `~`,
  and non-absolute client-side messages (`ABSOLUTE_PATH_MESSAGE`, `TILDE_MESSAGE`) still fire
  exactly as today. This is the acceptance criterion (Scope, item 8) that the prior version of
  this plan would have broken.

Both phases are sequential, each leaves the app in a working, demonstrable state, and neither
touches rename/delete or anything inside WS-37's `addProject` channel itself.

## Data & compatibility

No data model or registry schema changes — WS-37's `addProject(path: string)` IPC call is
unchanged from its own plan; this workstream only changes what supplies its argument, and adds
a second, coexisting supplier. No migration is needed. `server.ts`'s route logic, `src/lib/*.ts`,
and `.praxis-projects.json`'s shape are all untouched. `browser-ipc-shim.ts` (WS-45) needs no
change and stays compatible because `pickProjectFolder` is optional on `PraxisAPI`.

**Rollback:** reverting Phase 2 alone removes `#choose-folder-button`, its click handler, and
`initAddProjectControl()`, restoring the pre-Phase-2 state where `#add-form` is always visible
(its static `hidden` attribute reverts too) — a clean return to typed-path-only entry, with
WS-37's `addProject` channel and WS-45's shim both untouched underneath and no data loss.
Reverting Phase 1 as well removes the `pickProjectFolder` channel, its preload wrapper, and its
now-optional `PraxisAPI` member, returning `electron/` and `ipc-adapter.ts` to exactly WS-37's
own end state. At every rollback point the browser-tab path (`#add-form`/`submitPath()`) was
never touched, so it is never at risk from a rollback of this workstream.

## Testing strategy

- The `pickProjectFolder` handler is a one-line collapse of `dialog.showOpenDialog`'s own
  result (`canceled`/`filePaths` → `string | null`) with no branching logic beyond that
  ternary — there is nothing meaningfully pure to unit-test, and a native OS dialog cannot be
  driven by `node --test` in this repo's existing lightweight testing convention. It is
  covered by the manual per-phase Verify steps above, matching WS-37's own testing-strategy
  reasoning for its Electron-IPC-backed I/O.
- `initAddProjectControl()`'s branch (`typeof ... === 'function'`) is pure and small enough to
  be worth a light manual check rather than a dedicated unit test, given this repo's existing
  convention of `node --test` for `src/lib/*.ts` logic and manual Verify steps for DOM/IPC
  wiring (WS-37's own precedent) — the two Verify passes above (Electron shell vs. plain
  browser tab) are what actually exercises both branches of the `typeof` check, which a unit
  test would otherwise have to fake a `window.praxisAPI` shape to reach anyway.
- No changes are made to any function currently covered by `src/lib/extract.test.ts`; that
  suite is unaffected and needs no update.
- **This revision adds one regression scenario Testing must not lose**: running the plain
  browser tab and the compiled Electron app side by side (Context's standing requirement) and
  confirming both can independently add a project — one via typed path, one via native dialog
  — without either code path regressing the other. This is exactly what the two Phase 2 Verify
  passes above are for.

## Open questions

1. **Button copy and placement.** Context doesn't specify exact wording. This plan's default
   (Assumptions, above) is a "Choose folder" button placed as a sibling of `#add-form` under
   the existing "Add a project" heading, occupying the same position `#add-form` occupies when
   `#add-form` is hidden. Recommendation: accept this as the simplest reading; it's a one-line
   copy change later if a different label is wanted.
2. **Dialog starting directory and window modality.** Context's own investigation gives the
   call as `dialog.showOpenDialog({ properties: ['openDirectory'] })` — no `defaultPath`, no
   `BrowserWindow` argument (which would make the dialog modal to that window rather than a
   free-floating system dialog). This plan follows that shape verbatim (Out of scope, above).
   Recommendation: accept this; add `defaultPath` (e.g. the user's home directory) or a window
   argument for modality only if real usage shows the current behavior is inconvenient.
3. **Third `praxisAPI` implementation, if one is ever added (new, this revision).** Decision 3's
   `typeof window.praxisAPI.pickProjectFolder === 'function'` check treats "method present" as
   the only signal that matters, on the assumption that exactly two implementations of
   `window.praxisAPI` will ever exist (Electron's real preload bridge, WS-45's browser shim).
   Not blocking — nothing in this plan or Context suggests a third is coming — but flagged
   because the feature-detect pattern (rather than, say, an explicit `window.isElectron` flag)
   is a design choice that would need revisiting if a third implementation ever had a reason to
   omit `pickProjectFolder` for a different cause than "this runtime cannot show a native
   dialog." Recommendation: accept the `typeof` check as sufficient for the current two
   implementations; revisit only if a third implementation actually appears.

## Alternatives considered and rejected

- **Wrapping `pickProjectFolder` in `PraxisIpcResult<T>` for envelope uniformity with WS-37's
  six channels.** Rejected (Decision 2, above): the envelope exists to carry a real HTTP status
  code, which this channel never has: `pickProjectFolder` makes no loopback HTTP call and its
  only outcomes are "path" or "cancelled," neither of which is an application-level error.
  Forcing it through the envelope would manufacture a status code that means nothing and add
  an unnecessary `.then(unwrapIpc)` step at every call site for a channel that can't fail in
  the way the envelope exists to describe.
- **Registering `pickProjectFolder` directly in `main.cts`, not `electron/ipc-handlers.cts`.**
  Rejected (Decision 1, above): `ipc-handlers.cts` is already the single file WS-37 uses to
  answer "what IPC channels exist," and `main.cts`'s established scope is app bootstrap and
  window lifecycle. Splitting channel registrations across two files by whether they happen to
  use the shared `loopbackRequest` helper would make the channel surface harder to see at a
  glance, for no offsetting benefit.
- **An HTML `<input type="file" webkitdirectory>` element, avoiding a new IPC channel
  entirely.** Rejected: Context's own investigation confirms `dialog` is main-process-only and
  explicitly calls for `ipcMain.handle`/`dialog.showOpenDialog`; a file-input element is also
  sandboxed to `File`/`FileList` objects rather than a real filesystem path string, giving
  `addProject` nothing usable even if it worked.
- **A custom native module wrapping an OS-specific folder-picker API directly, instead of
  Electron's built-in `dialog` module.** Rejected: Electron's `dialog.showOpenDialog` already
  wraps the native picker on macOS, Linux, and Windows — Context's investigation already
  settles on it — so a hand-rolled native module would duplicate what Electron ships for no
  benefit and add real platform-specific build complexity this app has no other need for.
- **Deleting `#add-form`/`#project-path`/`submitPath()` outright and shipping only the native
  dialog (the prior version of this plan).** Rejected in this revision: this was viable only
  under the assumption that Electron is the sole runtime the compiled UI ever loads in. WS-45's
  already-committed `browser-ipc-shim.ts` established a standing requirement that a plain
  browser tab remain a fully usable, testable way to run the app, and there is no possible
  browser implementation of a native OS folder dialog — so a dialog-only "Add a project" flow
  would make the browser tab unable to add any project at all, permanently. Kept, per Context's
  explicit instruction, as the corrected direction: both controls coexist, selected by
  feature-detection.
- **A class-based shared style (e.g. `class="primary-button"` on both buttons) instead of
  comma-joining `.add-form button`'s existing selectors with `#choose-folder-button`.**
  Rejected (CSS approach, above): it would require editing the existing, otherwise-untouched
  `<button type="submit">Add project</button>` markup to add a new class name, in exchange for
  no benefit over selector-list reuse at the current scale of exactly two consumers of this
  visual style; revisit only if a third consumer appears.
- **An explicit runtime flag (e.g. `window.isElectron`) instead of feature-detecting
  `pickProjectFolder` itself.** Rejected: Context specifies the `typeof
  window.praxisAPI.pickProjectFolder === 'function'` check directly, and it is also the more
  accurate signal — it asks "can this runtime actually do the thing," not "is this Electron,"
  which stays correct even if a future third `praxisAPI` implementation exists that isn't
  Electron but also can't show a native dialog. A separate flag would be one more piece of
  state that could drift out of sync with what `praxisAPI` actually implements.
- **A required (non-optional) `pickProjectFolder` on `PraxisAPI`, with WS-45's shim updated to
  add a stub that always resolves `null`.** Rejected: Context explicitly forbids modifying
  `browser-ipc-shim.ts` in this plan — it's WS-45-owned and correct as-is. A stub that always
  resolves `null` would also be actively misleading: `null` is defined (Decision 2, above) to
  mean "the user cancelled the dialog," which is not what "this runtime has no dialog at all"
  means; conflating the two would make `initAddProjectControl()`'s own `typeof` check
  unnecessary in the first place, since the button would always appear to "work" (immediately
  cancel) in a browser tab instead of correctly staying hidden.

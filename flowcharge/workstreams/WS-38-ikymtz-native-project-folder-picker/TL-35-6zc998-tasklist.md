---
id: TL-35-6zc998
type: tasklist
workstream: WS-38-ikymtz
slug: native-project-folder-picker
title: "Native project folder picker"
status: done
created: 2026-08-18
updated: 2026-08-18
author: Anthony Koukoullis
depends_on: [PLN-28-05hx54]
links: []
mode: spec
base_commit: 1f30b70
---

# PRX Tasks

## Native project folder picker

Adds a "Choose folder" button that opens Electron's native OS folder-picker dialog via
`dialog.showOpenDialog`, feeding the chosen path into WS-37's already-landed
`window.praxisAPI.addProject(path)` IPC call — **alongside**, not instead of, the existing
typed-path `#add-form`/`#project-path` flow. Both controls ship permanently in
`src/public/index.html`; which one is visible is decided once at init time by feature-detecting
`typeof window.praxisAPI.pickProjectFolder === 'function'`, never by a bare
`window.praxisAPI` truthiness check, because sibling workstream WS-45-kvkdgl's already-landed
`src/public/browser-ipc-shim.ts` always defines `window.praxisAPI` in a plain browser tab —
just without `pickProjectFolder`, since no browser tab can invoke a native OS dialog. The picker
is exposed as a seventh IPC channel, `pickProjectFolder`, added to WS-37's own
`electron/ipc-handlers.cts` and `electron/preload.cts`. Unlike WS-37's six channels it resolves
a plain `Promise<string | null>` — not wrapped in `PraxisIpcResult<T>` — because it never calls
`server.ts` over loopback HTTP and has no status code to carry. `src/public/ipc-adapter.ts`'s
`PraxisAPI` interface gains `pickProjectFolder` as an **optional** member specifically so
WS-45's shim object literal (no `pickProjectFolder` property) keeps type-checking unchanged.
`src/public/home.ts` keeps `submitPath()`/`ABSOLUTE_PATH_MESSAGE`/`TILDE_MESSAGE`/the
`#add-form` listener untouched and adds a new init function plus a click handler for the button.
`styles.css` keeps `.add-form`/`.add-form input` and extends the existing button rules to a
shared selector list with `#choose-folder-button`. This is `base_commit` 1f30b70: WS-37
(plan PLN-27-wp9kt5) and WS-45 (`browser-ipc-shim.ts`) have both already landed at this commit,
confirmed by reading every target file listed below in this session — `electron/ipc-handlers.cts`,
`electron/preload.cts`, `src/public/ipc-adapter.ts`, `src/public/browser-ipc-shim.ts`,
`src/public/home.ts`, `src/public/index.html`, and `src/public/styles.css` (lines 624–647) all
match exactly what `plan.md`'s Assumptions and Design sections describe them as containing.

- [x] 1. Phase 1 — `pickProjectFolder` IPC channel (main process, preload, adapter types)
  ```yaml
  description: "Add the pickProjectFolder IPC channel end to end: the main-process handler, the preload contextBridge wrapper, and the optional PraxisAPI type. Effort: small. Dependencies: WS-37 (plan PLN-27-wp9kt5) landed — confirmed at base_commit 1f30b70, its six ipcMain.handle channels, contextBridge exposure, and PraxisAPI/ipc-adapter.ts scaffolding all exist as read in this session."
  ```

  - [x] 1.1 `electron/ipc-handlers.cts` — register the `pickProjectFolder` channel
    ```yaml
    description: "Add a seventh ipcMain.handle registration, 'pickProjectFolder', to electron/ipc-handlers.cts, alongside WS-37's six, and import dialog from electron."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "As read at base_commit 1f30b70, line 8 is `import { ipcMain } from 'electron';`. Widen this single import to also bring in dialog: `import { ipcMain, dialog } from 'electron';`. No other change to the import line."
      - "registerIpcHandlers() (lines 79-104) ends with the getWorkstreamDetail registration (lines 98-103) immediately followed by the function's closing brace on line 104. Add a seventh ipcMain.handle('pickProjectFolder', ...) registration there, after getWorkstreamDetail and before the closing brace — the same place each of WS-37's six registrations already sits in this one file, which is deliberately the single place that answers 'what IPC channels does this app expose' (plan.md Design Decision 1)."
      - "Illustrative, per plan.md's IPC channel contract (not literal — match the file's existing formatting): ipcMain.handle('pickProjectFolder', async () => { const result = await dialog.showOpenDialog({ properties: ['openDirectory'] }); return result.canceled || !result.filePaths.length ? null : result.filePaths[0]; });"
      - "The handler must call dialog.showOpenDialog with exactly { properties: ['openDirectory'] } — no defaultPath, no BrowserWindow argument (plan.md Out of scope, Design Decision 2, and Open question 2)."
    pattern: "electron/ipc-handlers.cts"
    imports: "Electron's dialog export, added to the existing `import { ipcMain } from 'electron'` line"
    compatibility: "Must not call or extend the file's existing loopbackRequest helper, and must not wrap the result in PraxisIpcResult<T> — this channel makes no loopback HTTP call and has no status code to carry (plan.md Design Decision 2)."
    gotcha: "The handler must know only how to open the dialog and collapse its result to string | null — it must not know what a project is, what flowcharge/ is, or call anything project-registry-related (plan.md, 'What each new/changed piece knows and does not know'). Two separate edit locations in this one file (the import line near the top, the new registration at the bottom of registerIpcHandlers) — do not conflate them into a single contiguous block."
    verify:
      - "npm run build"
      - "grep -n \"pickProjectFolder\" electron/ipc-handlers.cts — confirms the registration exists"
      - "grep -n \"dialog\" electron/ipc-handlers.cts — confirms dialog is imported and dialog.showOpenDialog is called, not an <input type=\"file\"> fallback (acceptance criterion 6)"
    checklist:
      - "Does ipc-handlers.cts import dialog from 'electron' on the same line as ipcMain, with no separate import statement added?"
      - "Is the registration named exactly 'pickProjectFolder', placed after getWorkstreamDetail inside registerIpcHandlers()?"
      - "Does the handler call dialog.showOpenDialog with only { properties: ['openDirectory'] } — no defaultPath, no window argument?"
      - "Does the handler return string | null (no PraxisIpcResult envelope, no use of loopbackRequest)?"
      - "Are WS-37's six existing registrations and the loopbackRequest helper left unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 `electron/preload.cts` — expose `pickProjectFolder` via `contextBridge`
    ```yaml
    description: "Add the pickProjectFolder wrapper to preload.cts's contextBridge.exposeInMainWorld('praxisAPI', {...}) call, alongside WS-37's six, resolving a plain Promise<string | null>."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read as of base_commit 1f30b70. Apply the SEARCH/REPLACE block below verbatim."
    pattern: "electron/preload.cts"
    imports: "ipcRenderer (already imported by this file for its six existing wrappers)"
    compatibility: "Must sit inside the same contextBridge.exposeInMainWorld('praxisAPI', {...}) object literal as WS-37's six wrappers — not a second contextBridge call."
    gotcha: "Do not wrap the returned promise, unwrap it, or catch/transform its rejection here — the click handler in home.ts (task 2.2) is where cancellation (null) and failure are handled, exactly matching this file's existing pattern of forwarding each raw promise unmodified."
    verify:
      - "npm run build"
      - "grep -n \"pickProjectFolder\" electron/preload.cts — confirms the wrapper exists in the contextBridge object"
    checklist:
      - "Is the wrapper named exactly 'pickProjectFolder' and typed as (): Promise<string | null>?"
      - "Does it call ipcRenderer.invoke('pickProjectFolder') and return that promise unmodified?"
      - "Is it a property of the same praxisAPI object literal WS-37's six wrappers already populate, not a separate contextBridge.exposeInMainWorld call?"
      - "Do all six of WS-37's existing wrappers remain present and unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
    ```ts
    electron/preload.cts
    <<<<<<< SEARCH
      getWorkstreamDetail: (id: string, wsId: string) =>
        ipcRenderer.invoke('getWorkstreamDetail', id, wsId),
    });
    =======
      getWorkstreamDetail: (id: string, wsId: string) =>
        ipcRenderer.invoke('getWorkstreamDetail', id, wsId),
      pickProjectFolder: (): Promise<string | null> => ipcRenderer.invoke('pickProjectFolder'),
    });
    >>>>>>> REPLACE
    ```

  - [x] 1.3 `src/public/ipc-adapter.ts` — type `pickProjectFolder` as an optional `PraxisAPI` member
    ```yaml
    description: "Extend the PraxisAPI interface with pickProjectFolder?(): Promise<string | null> — optional, so WS-45's browser-ipc-shim.ts six-method object literal keeps satisfying PraxisAPI with zero edits to that file."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read as of base_commit 1f30b70. Apply the SEARCH/REPLACE block below verbatim."
    pattern: "src/public/ipc-adapter.ts"
    imports: "None new — extends the ambient PraxisAPI interface already declared in this file"
    compatibility: "pickProjectFolder must be declared with a `?` (optional) and resolve Promise<string | null>, never Promise<PraxisIpcResult<T>> — both the optionality (Decision 3) and the bare envelope (Decision 2) are this plan's deliberate choices, not oversights to fix. Optionality is what keeps src/public/browser-ipc-shim.ts (WS-45-owned, not touched by this task list) type-checking unchanged."
    gotcha: "Do not make the member required — a required member would break browser-ipc-shim.ts's compile the moment this interface change lands, in a file this workstream does not own. Do not add a .then(unwrapIpc) step anywhere for this member — it has no PraxisIpcResult envelope to unwrap."
    verify:
      - "npm run build"
      - "grep -n \"pickProjectFolder?(): Promise<string | null>\" src/public/ipc-adapter.ts — confirms the typing matches acceptance criterion 7 exactly, including the '?'"
    checklist:
      - "Is pickProjectFolder declared on the PraxisAPI interface as an optional member (`?`) resolving Promise<string | null>?"
      - "Do the six existing PraxisAPI members remain required and Promise<PraxisIpcResult<T>>, unchanged?"
      - "Does src/public/browser-ipc-shim.ts still compile with zero edits (confirmed via the same npm run build)?"
    self_eval:
      passed: true
      failures: []
    ```
    ```ts
    src/public/ipc-adapter.ts
    <<<<<<< SEARCH
      getWorkstreamDetail(id: string, wsId: string): Promise<PraxisIpcResult<PraxisWorkstreamDetail>>;
    }
    =======
      getWorkstreamDetail(id: string, wsId: string): Promise<PraxisIpcResult<PraxisWorkstreamDetail>>;
      pickProjectFolder?(): Promise<string | null>;
    }
    >>>>>>> REPLACE
    ```

- [x] 2. Phase 2 — coexisting UI controls and `home.ts` init logic
  ```yaml
  description: "Add the #choose-folder-button as a sibling of the untouched #add-form in index.html (both start hidden), add its click handler plus a one-time init function to home.ts that decides which control is visible, and extend styles.css's existing button rules to a shared selector list. Effort: small. Dependencies: task 1; WS-37's addProject channel already exists."
  ```

  - [x] 2.1 `src/public/index.html` — add `#choose-folder-button` as a sibling of `#add-form`, both `hidden`
    ```yaml
    description: "Keep #add-form/#project-path exactly as they are; add #choose-folder-button as a new sibling; give both a static hidden attribute so init-time script can show exactly one."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read as of base_commit 1f30b70. Apply the SEARCH/REPLACE block below verbatim."
    pattern: "src/public/index.html"
    imports: "None"
    compatibility: "Neither #add-form nor #project-path is deleted or otherwise modified beyond adding hidden — WS-45's browser-tab path depends on #add-form staying exactly as it is (plan.md acceptance criteria 4 and 8)."
    gotcha: "Both elements must start hidden in the static markup (not only toggled from script), so a slow-loading script or JS-disabled browser shows neither half-wired control rather than a flash of the wrong one (plan.md, index.html/styles.css section). The button is type=\"button\" (not submit) since it sits outside any form."
    verify:
      - "npm run build"
      - "grep -n \"id=\\\"add-form\\\"\\|id=\\\"choose-folder-button\\\"\" src/public/index.html — confirms both elements exist, each with a hidden attribute"
      - "grep -c \"project-path\" src/public/index.html — expect 1 (the input is untouched, still present)"
    checklist:
      - "Is #add-form (with #project-path and its submit button) present, unmodified except for the added hidden attribute?"
      - "Does #choose-folder-button exist as a new sibling, type=\"button\", reading 'Choose folder', with a hidden attribute?"
      - "Is #add-error left in place, unchanged, after both controls?"
      - "Is neither control removed from the DOM?"
    self_eval:
      passed: true
      failures: []
    ```
    ```html
    src/public/index.html
    <<<<<<< SEARCH
      <h2 class="home-heading">Add a project</h2>
      <form class="add-form" id="add-form">
        <input type="text" id="project-path" autocomplete="off" placeholder="/Users/you/Work/your-project">
        <button type="submit">Add project</button>
      </form>
      <div id="add-error"></div>
    =======
      <h2 class="home-heading">Add a project</h2>
      <form class="add-form" id="add-form" hidden>
        <input type="text" id="project-path" autocomplete="off" placeholder="/Users/you/Work/your-project">
        <button type="submit">Add project</button>
      </form>
      <button type="button" id="choose-folder-button" hidden>Choose folder</button>
      <div id="add-error"></div>
    >>>>>>> REPLACE
    ```

  - [x] 2.2 `src/public/home.ts` — add the `#choose-folder-button` click handler and `initAddProjectControl()`
    ```yaml
    description: "Keep submitPath(), ABSOLUTE_PATH_MESSAGE, TILDE_MESSAGE, and the #add-form submit listener untouched; add a #choose-folder-button click handler that calls pickProjectFolder then addProject, plus a one-time init function that feature-detects pickProjectFolder to decide which control is visible."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read as of base_commit 1f30b70. Apply the SEARCH/REPLACE block below verbatim. It touches only the tail of the IIFE (the #add-form listener at lines 245-248 and the loadProjects() call at line 250) — nothing above line 245 (submitPath(), ABSOLUTE_PATH_MESSAGE, TILDE_MESSAGE, renderTiles, loadProjects) is part of the SEARCH text and none of it changes."
      - "initAddProjectControl() runs once, at the same init point loadProjects() already runs from — order between the two calls doesn't matter, they touch disjoint elements (plan.md, home.ts section)."
      - "The click handler uses a non-null assertion (pickProjectFolder!()) because TypeScript's optional-member narrowing from initAddProjectControl()'s typeof check does not carry across into this separate closure — safe in practice because the handler only ever fires while the button is visible, which initAddProjectControl() only allows once the method is confirmed present (plan.md Design Decision 3)."
    pattern: "src/public/home.ts"
    imports: "window.praxisAPI.pickProjectFolder (task 1.3 of this list); window.praxisAPI.addProject and unwrapIpc, already used elsewhere in this file"
    compatibility: "renderTiles, loadProjects, submitPath(), ABSOLUTE_PATH_MESSAGE, TILDE_MESSAGE, and the rename/delete handlers must be left byte-for-byte unchanged — rename/delete flows and submitPath()'s own guards are explicitly out of scope for this plan (plan.md acceptance criterion 5, Out of scope)."
    gotcha: "path == null on cancel is a silent no-op, not an error — do not call setError or addProject in that branch (acceptance criterion 3). Do not add any client-side path-shape validation to the click handler (that logic belongs only to submitPath(), untouched, for the typed-path browser path)."
    verify:
      - "npm run build"
      - "grep -n \"submitPath\\|ABSOLUTE_PATH_MESSAGE\\|TILDE_MESSAGE\" src/public/home.ts — confirms all three are still present, unchanged (acceptance criterion 5)"
      - "grep -n \"choose-folder-button\\|initAddProjectControl\" src/public/home.ts — confirms the new click listener and init function are present"
    checklist:
      - "Are submitPath(), ABSOLUTE_PATH_MESSAGE, TILDE_MESSAGE, and the #add-form submit listener all still present and unmodified?"
      - "Does initAddProjectControl() feature-detect with `typeof window.praxisAPI.pickProjectFolder === 'function'` — never a bare `window.praxisAPI` truthiness check?"
      - "Does the new click handler call setError('') before pickProjectFolder(), and return silently (no setError, no addProject call) when path is null?"
      - "Does the non-null path branch call addProject(path).then(unwrapIpc).then(loadProjects), matching the envelope handling submitPath() already uses?"
      - "Is initAddProjectControl() called once, near loadProjects(), and not re-evaluated per click or per submit?"
      - "Are renderTiles, loadProjects, and the rename/delete handlers unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
    ```ts
    src/public/home.ts
    <<<<<<< SEARCH
      byId('add-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        submitPath();
      });

      loadProjects();
    })();
    =======
      byId('add-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        submitPath();
      });

      // Runs once, at script-load/init time — never per-submit, never per-click.
      // pickProjectFolder is optional on PraxisAPI (ipc-adapter.ts Decision 3); a typeof
      // check is the correct feature-detect for an optional method, and is NOT the same as
      // `if (window.praxisAPI)`, which WS-45's browser-ipc-shim.ts makes true unconditionally
      // in a plain browser tab.
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
      loadProjects();
    })();
    >>>>>>> REPLACE
    ```

  - [x] 2.3 `src/public/styles.css` — extend `.add-form button`'s rules to a shared selector list with `#choose-folder-button`
    ```yaml
    description: "Keep .add-form and .add-form input untouched; add #choose-folder-button as a second, comma-separated selector on .add-form button and its :hover/:focus-visible rules — no rule body duplicated, no rule removed."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read as of base_commit 1f30b70. Apply the SEARCH/REPLACE block below verbatim."
    pattern: "src/public/styles.css"
    imports: "None"
    compatibility: "The button's visual treatment (border, radius, background, color, padding, font-size, cursor, hover/focus states) must be identical for both #add-form's submit button and #choose-folder-button — selector-list reuse, not a duplicated property list and not a new shared class (plan.md CSS approach, chosen over class-based reuse to avoid editing the existing button's markup for no benefit at today's scale of exactly two consumers)."
    gotcha: "Do not touch .add-form or .add-form input (lines 624-636) — the form is still live for the browser-tab path, so both rules still have a surviving element to style; nothing here is removed."
    verify:
      - "npm run build"
      - "grep -n \"\\.add-form\" src/public/styles.css — expect 3 matches (.add-form, .add-form input, and .add-form button now comma-joined with #choose-folder-button), none removed"
      - "grep -n \"#choose-folder-button\" src/public/styles.css — confirms the button, :hover, and :focus-visible rules all gained the new selector"
    checklist:
      - "Are .add-form and .add-form input left completely unchanged?"
      - "Does #choose-folder-button appear as a second selector, comma-joined, on the same three rules .add-form button already has (base, :hover, :focus-visible) — not as separate new rule bodies?"
      - "Are the property values inside each rule identical to what they were before this edit?"
      - "Is #add-error's rule block (immediately following) left unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
    ```css
    src/public/styles.css
    <<<<<<< SEARCH
    .add-form button {
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      background: var(--accent);
      color: var(--paper-raised);
      padding: 6px 14px;
      font-size: 12.5px;
      cursor: pointer;
    }
    .add-form button:hover { background: var(--accent-ink); }
    .add-form button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    =======
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
    >>>>>>> REPLACE
    ```

---
id: TL-41-kltvyv
type: tasklist
workstream: WS-43-4cpdch
slug: skill-install-onboarding-screen
title: "Read-side FsAccess adapter, detectTools IPC channel, and the skill-install onboarding dialog"
status: done
created: 2026-08-17
updated: 2026-08-19
author: Anthony Koukoullis
depends_on: [PLN-33-271zlx]
links: []
mode: spec
base_commit: 0d82a04
---

# PRX Tasks

## Read-side FsAccess adapter, detectTools IPC channel, and the skill-install onboarding dialog

Implements PLN-33-271zlx's five phases on Electron, narrowed to the four-tool catalogue
(Claude Code, OpenCode, Cursor, Windsurf): (1) a concrete, real-filesystem
`createNodeFsAccess()` adapter added alongside WS-42's `createNodeFsWriteAccess()` in
`src/lib/agentic-tools-fs-adapter.ts`, implementing exactly WS-41's four `FsAccess` methods
(`pathExists`, `isDirectory`, `resolveBinaryOnPath`, `expandTokens`) — no fifth,
VS-Code-specific method; (2) one new `detectTools` IPC channel, registered in WS-42's
existing `registerAgenticToolsIpcHandlers()` and exposed as a fourth method on WS-42's
existing `window.praxisSkillInstallAPI` global (no new `contextBridge` global); and (3)-(5)
the "Manage integrations" `<dialog>` on `src/public/index.html` — two tabs by category
("Command-line tools", "Desktop apps"), a Global/Project scope toggle, real detection-status
rendering, and a wired "Install selected" action — built in three further phases (chrome,
row rendering, install action) reusing this app's existing `.ws-modal-*`/`.seg`/`.chip` CSS
and `app.ts`'s existing tab-modal keyboard-navigation pattern. The one small piece of pure
eligibility logic (`resolveBasePathForScope`/`isEligibleAtScope`) is ported to a single new
classic-script file, `src/public/lib/agentic-tools-scope.ts`, per the plan's own reasoning
for why this does not repeat WS-42's Node-tested/browser-sibling split a third time.

- [x] 1. Phase 1 — `createNodeFsAccess()` adapter
  ```yaml
  description: "Add the read-side FsAccess adapter WS-41's detection engine has always needed, alongside WS-42's existing write-side createNodeFsWriteAccess() in src/lib/agentic-tools-fs-adapter.ts, and de-duplicate the shared ~/%VAR% token-expansion logic between the two."
  ```

  - [x] 1.1 Add `createNodeFsAccess()` to `src/lib/agentic-tools-fs-adapter.ts`
    ```yaml
    description: "Implement a direct, literal FsAccess port (pathExists, isDirectory, resolveBinaryOnPath, expandTokens) against real node:fs/promises, node:os, and process.env calls, per the plan's Design section 'The read-side FsAccess adapter'."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "src/lib/agentic-tools-fs-adapter.ts does not exist in this repo as of base_commit 0d82a04 — see Divergence 1. Once WS-42's task list (TL-40-5fwkfg) has landed it with createNodeFsWriteAccess() and its own inline expandTokens, add a sibling createNodeFsAccess() factory to the same file, generically named and reusable exactly like createNodeFsWriteAccess() (per Design's 'what each module knows / must not know' — no ToolDefinition, category, or per-tool knowledge in this file)."
      - "Factor a private expandTokensImpl(input) helper out of both factories: `~`-prefix expands against os.homedir(), and `%VAR%` tokens expand against process.env, matching WS-42's existing rule exactly (illustrative, from the plan's Design section — reproduce verbatim, do not re-derive the regex): `input.startsWith('~') ? path.join(os.homedir(), input.slice(1)) : input`, then `.replace(/%([^%]+)%/g, (w, name) => process.env[name] ?? w)`. Refactor createNodeFsWriteAccess()'s own expandTokens to delegate to it, removing its previous inline duplicate of the same two lines."
      - "Implement createNodeFsAccess() returning exactly the four FsAccess port methods: pathExists/isDirectory via fs.access/fs.stat inside try/catch; resolveBinaryOnPath walking process.env.PATH split on path.delimiter, appending PATHEXT extensions only on win32, testing each candidate with fs.access(..., fs.constants.X_OK), returning the first hit or null; expandTokens delegating to expandTokensImpl. Add no fifth method and no VS-Code-specific helper — WS-41's FsAccess port has exactly these four methods (confirmed by direct read of flowcharge/workstreams/WS-41-3783cz-detect-agentic-tool-config-locations/plan.md this session), and this plan's own Design section defines createNodeFsAccess() with exactly these four."
    pattern: "src/lib/agentic-tools-fs-adapter.ts, src/lib/agentic-tools-fs-adapter.test.ts"
    imports: "node:fs/promises, node:path, node:os, node:process (process.env, process.platform); WS-41's FsAccess port type"
    compatibility: "Must implement WS-41's FsAccess port signature exactly (pathExists, isDirectory, resolveBinaryOnPath, expandTokens) — no extra methods; expandTokensImpl must be the single shared implementation used by both createNodeFsAccess and createNodeFsWriteAccess — no second inline copy."
    gotcha: "See Divergence 1: this file, and the createNodeFsWriteAccess() this task extends 'alongside', do not exist in this repo yet — this task is only executable once WS-42's task list (TL-40-5fwkfg) has landed. Do not invent a placeholder createNodeFsWriteAccess() to unblock this task; wait for WS-42's real one, or the shared expandTokensImpl refactor has nothing real to extract from."
    verify:
      - "Extend agentic-tools-fs-adapter.test.ts (WS-42's existing suite) with node --test cases against a real fs.mkdtemp temp directory: pathExists/isDirectory against a created file/directory and a missing path; resolveBinaryOnPath against a temp PATH entry containing a fixture executable (and a fixture non-executable, expecting null); expandTokens (via createNodeFsAccess) resolving ~ against os.homedir() and a %VAR% token against a process.env value set for the test — the same style of test WS-42's existing createNodeFsWriteAccess suite already uses for its own expandTokens."
      - "npm run build && node --test dist/lib/agentic-tools-fs-adapter.test.js — all cases pass, matching this repo's own test-running convention (src/lib/extract.test.ts's header comment: 'Run with node --test dist/lib/extract.test.js after npm run build')."
    checklist:
      - "createNodeFsAccess() implements exactly the four FsAccess port methods, with none left unimplemented or stubbed and no fifth method added?"
      - "expandTokensImpl is the single shared implementation, with createNodeFsWriteAccess's own expandTokens delegating to it rather than keeping its own inline copy?"
      - "createNodeFsAccess() carries no per-tool catalogue knowledge (no ToolDefinition, category, or tool id referenced in this file)?"
      - "npm run build exits 0 across both currently-existing tsc invocations (tsconfig.json, src/public/tsconfig.json) — see Divergence 2 on the third, electron/tsconfig.json, invocation acceptance criterion 11 also names?"
      - "node --test dist/lib/agentic-tools-fs-adapter.test.js passes with zero failures?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — `detectTools` IPC channel
  ```yaml
  description: "Register one new detectTools channel inside WS-42's existing registerAgenticToolsIpcHandlers() (electron/agentic-tools-ipc-handlers.cts) and expose it as a fourth method on WS-42's existing window.praxisSkillInstallAPI global (electron/preload.cts) — no new IPC-handler file and no new contextBridge global."
  ```

  - [x] 2.1 Register the `detectTools` handler in `electron/agentic-tools-ipc-handlers.cts`
    ```yaml
    description: "Add mapNodePlatformToOs, the ToolDetectionRow type, and a fourth ipcMain.handle('detectTools', ...) to the existing registerAgenticToolsIpcHandlers() function, per the plan's Design section 'The detectTools IPC channel'."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "electron/agentic-tools-ipc-handlers.cts (and the electron/ directory itself) does not exist in this repo as of base_commit 0d82a04 — see Divergence 1. Once WS-42's task list (TL-40-5fwkfg) has landed registerAgenticToolsIpcHandlers() with its existing three ipcMain.handle registrations, add a fourth alongside them in the same function — do not create a new electron/ipc-handlers.cts file and do not add a second call to registerAgenticToolsIpcHandlers() from main.cts (WS-42's own single invocation is reused)."
      - "Add mapNodePlatformToOs(platform: NodeJS.Platform): 'darwin' → 'macos', 'linux' → 'linux', 'win32' → 'windows', anything else → null (Assumption 5 — no guessed bucket for an unmapped platform)."
      - "Add a ToolDetectionRow interface: { toolId, displayName, category, detection: DetectionResult } — nesting the unmodified DetectionResult under detection rather than flattening its fields (Design: 'so the renderer's row-rendering code ... can name row.detection.confidence etc. without inventing new field names')."
      - "Add ipcMain.handle('detectTools', async () => ...): map os.platform() via mapNodePlatformToOs; on null, return { ok: false, status: 500, error: `Unsupported OS: ${os.platform()}` }; otherwise call detectAllTools(createNodeFsAccess(), mappedOs), join each returned DetectionResult against TOOL_CATALOGUE by toolId to build one ToolDetectionRow per catalogue entry, and return { ok: true, status: 200, data: rows }."
    pattern: "electron/agentic-tools-ipc-handlers.cts"
    imports: "node:os; WS-41's TOOL_CATALOGUE, DetectionResult, OS, ToolCategory, detectAllTools; WS-42's PraxisIpcResult; this plan's createNodeFsAccess() (Task 1.1)"
    compatibility: "Must delegate all per-tool detection rules to WS-41's detectTool/detectAllTools — this handler must not call node:fs directly, only through createNodeFsAccess()."
    gotcha: "See Divergence 1: electron/ does not exist in this repo yet, so there is no registerAgenticToolsIpcHandlers() function to add a fourth handler to. This task is only executable once WS-42's task list (TL-40-5fwkfg) has landed, and depends on Task 1.1's createNodeFsAccess() existing."
    verify:
      - "npm run build exits 0."
      - "From a running Electron window's devtools console, window.praxisSkillInstallAPI.detectTools() resolves {ok: true, status: 200, data: [...four rows...]}, each row carrying a real toolId/displayName/category/detection matching that machine's actual installed tools (e.g. claude-code reads 'confirmed' if the claude binary is genuinely on PATH)."
    checklist:
      - "detectTools is the fourth ipcMain.handle registered inside the existing registerAgenticToolsIpcHandlers() function, with no new call added from main.cts?"
      - "The handler calls detectAllTools(createNodeFsAccess(), mappedOs) and never calls node:fs or node:os path logic directly beyond os.platform()?"
      - "ToolDetectionRow nests the unmodified DetectionResult under a detection key rather than flattening its fields?"
      - "An unmapped os.platform() value resolves a failed PraxisIpcResult (status 500) rather than guessing a catalogue bucket?"
      - "The resolved data array has exactly four rows, one per TOOL_CATALOGUE entry (Claude Code, OpenCode, Cursor, Windsurf)?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Expose `detectTools` as a fourth method on `electron/preload.cts`'s `praxisSkillInstallAPI`
    ```yaml
    description: "Add detectTools: () => ipcRenderer.invoke('detectTools') as a fourth property on the existing contextBridge.exposeInMainWorld('praxisSkillInstallAPI', {...}) call, per the plan's Design section 'preload.cts's fourth method'."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "electron/preload.cts does not exist in this repo as of base_commit 0d82a04 — see Divergence 1. Once WS-42's task list (TL-40-5fwkfg) has landed its contextBridge.exposeInMainWorld('praxisSkillInstallAPI', {...}) call with its three existing methods (installSelected, getInstallStatus, removeInstallation), add detectTools: () => ipcRenderer.invoke('detectTools') as a fourth property on that same object literal."
      - "Do not introduce a second or third contextBridge.exposeInMainWorld call anywhere in this file — Design's rationale is explicit: detection and install are a read/write split on the same resource (the four catalogued tools), not two different resources, so this keeps the app's total contextBridge surface at two globals rather than three."
    pattern: "electron/preload.cts"
    imports: "electron's ipcRenderer, contextBridge (WS-42's existing imports)"
    compatibility: "Must land on WS-42's existing praxisSkillInstallAPI object, not a new global; channel name must be the literal string 'detectTools', matching Task 2.1's ipcMain.handle registration exactly."
    gotcha: "See Divergence 1: preload.cts does not exist in this repo yet. This task is only executable once WS-42's task list (TL-40-5fwkfg) has landed, and its channel name must match Task 2.1's ipcMain.handle('detectTools', ...) verbatim or the renderer call resolves nothing."
    verify:
      - "npm run build exits 0; Task 2.1's devtools-console verify step exercises this method end-to-end (window.praxisSkillInstallAPI.detectTools() would not resolve at all without this change)."
    checklist:
      - "detectTools is added to the existing praxisSkillInstallAPI object literal, not a new global?"
      - "No new contextBridge.exposeInMainWorld call is added anywhere in preload.cts?"
      - "The invoked channel name ('detectTools') matches Task 2.1's ipcMain.handle registration exactly?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 3 — Dialog chrome: markup, trigger button, tabs, scope toggle, open/close
  ```yaml
  description: "Add the 'Manage integrations' trigger button and dialog markup (two empty tab panels, one per ToolCategory value) to index.html, the new agentic-tools-scope.ts classic script, and home.ts's open/close/tab-switch/scope-toggle logic and project-picker population — reusing board.html's/app.ts's existing .ws-modal-*/.seg CSS and tab-keydown pattern verbatim. Markup/DOM-logic only; does not depend on Phase 1-2's IPC surface existing yet."
  ```

  - [x] 3.1 Add the trigger button and dialog markup to `src/public/index.html`
    ```yaml
    description: "Add a 'Manage integrations' button to the masthead and the #integrations-modal <dialog> (two empty tab panels — 'Command-line tools' / 'Desktop apps' — close button, scope .seg, tabs) exactly as specified in the plan's Design section 'The dialog and its data flow'."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "src/public/index.html currently exists with a single-child masthead: `<div class=\"masthead\"><div><div class=\"brand-row\">...</div><div class=\"tagline\">Registered projects</div></div></div>` (read in full this session — masthead opens at line 11, brand-row at line 13, tagline at line 17). Add `<button type=\"button\" id=\"manage-integrations-button\">Manage integrations</button>` as a new sibling immediately after that inner `<div>` closes, inside `.masthead` — matching Open Question 2's settled default (exact copy/placement, not otherwise confirmed)."
      - "Immediately before the existing `<script src=\"home.js\"></script>` line (line 40, read this session), insert the full #integrations-modal <dialog> markup reproduced verbatim from the plan's Design section 'The dialog and its data flow' (the `<dialog id=\"integrations-modal\" aria-labelledby=\"integrations-modal-title\">` block through its closing `</dialog>` tag) — trigger button already added above, close button, scope .seg toggle with a hidden project <select>, the two-tab tablist (`data-tab=\"cli\"` labelled 'Command-line tools', `data-tab=\"gui-app\"` labelled 'Desktop apps' — matching ToolCategory's exactly two values), two empty tabpanel divs (`#integrations-panel-cli`, `#integrations-panel-gui-app`), and the Re-scan / Install selected action buttons."
      - "Do not populate any tabpanel with rows here — Phase 4 builds rows from real detectTools() data; this task only adds the two empty <div role=\"tabpanel\"> containers. There is no third 'VS Code extensions' tab or panel: this dialog has exactly two tabs, matching ToolCategory's two values ('cli' | 'gui-app'), and every one of the current four catalogued tools (Claude Code, OpenCode as cli; Cursor, Windsurf as gui-app) falls into one of them."
    pattern: "src/public/index.html"
    imports: "none (static markup)"
    compatibility: "Every element id, the tablist/tabpanel roles, and the .ws-modal-* class names must match board.html:84-115's existing dialog pattern exactly (confirmed present at these lines by direct inspection this session), so app.ts's existing keydown/backdrop-click logic pattern (Task 3.3) applies unchanged, adapted from three tabs to two."
    gotcha: "The button's exact wording/placement is this plan's own default reading, not a separately confirmed decision (plan Open Question 2) — a one-line change if different wording or placement is wanted later."
    verify:
      - "Open src/public/index.html in a browser (or the Electron shell once WS-36 lands): the 'Manage integrations' button and #integrations-modal are present in the DOM; the dialog has no `open` attribute (it must only open via showModal(), wired in Task 3.3); grep -c 'vscode-extension' src/public/index.html returns 0."
    checklist:
      - "Every id referenced by Task 3.3's/Task 4.1's/Task 5.1's JS (manage-integrations-button, integrations-modal, integrations-modal-close, integrations-scope-seg, integrations-project-select, integrations-tabs, integrations-panel-cli, integrations-panel-gui-app, integrations-rescan, integrations-install-selected) is present in the markup?"
      - "The dialog carries no open attribute and no inline visibility styling that would bypass showModal()?"
      - "Exactly two tabpanels are present and empty, with the cli panel visible by default and the gui-app panel hidden, matching the tablist's aria-selected defaults — no third tabpanel exists?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.2 Add `src/public/lib/agentic-tools-scope.ts`
    ```yaml
    description: "New classic script (no import/export) implementing resolveBasePathForScope and isEligibleAtScope, per the plan's Design section 'resolveBasePathForScope/isEligibleAtScope — one implementation, not two'."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/public/lib/agentic-tools-scope.ts as a classic script (no import/export statements — module: \"none\" forbids them; see src/public/tsconfig.json, Task 3.4)."
      - "Declare a structural InstallScope type ({ kind: 'global' } | { kind: 'project'; projectPath: string }) and a minimal DetectionResultLike interface ({ resolvedConfigDir: string | null }) — no import of WS-41's real DetectionResult type, matching the plan's 'no import, structural re-declaration' approach used throughout this plan's renderer-side code."
      - "Implement resolveBasePathForScope(scope, detection): for 'project' scope, always return scope.projectPath (every catalogued format's pathTemplate is relative to the project root or configDir either way — Assumption 3, no lookup needed); for 'global' scope, return detection ? detection.resolvedConfigDir : null — do not special-case any tool by id (a tool with no global configDir for the running OS is handled automatically because this only reads what detection already resolved)."
      - "Implement isEligibleAtScope(scope, detection) as resolveBasePathForScope(scope, detection) !== null."
    pattern: "src/public/lib/agentic-tools-scope.ts (new)"
    imports: "none — classic script, no imports permitted"
    compatibility: "Must not import or reference DOM APIs, TOOL_CATALOGUE contents by id, or any specific tool (Design: 'what each module knows / must not know'). Must be loaded via a <script> tag on index.html ahead of home.js (Task 3.1's dialog markup insertion point, or a dedicated <script> tag placed before <script src=\"home.js\">)."
    gotcha: "This is deliberately the only implementation — no src/lib/ Node-tested twin is added (plan's Assumption 4 and Design's rejected-alternative reasoning: nothing in the main process ever calls this function, so a src/lib/ copy would exist purely to be unit-tested). Do not add one speculatively."
    verify:
      - "npm run build exits 0 once Task 3.4 adds this file to src/public/tsconfig.json's include list."
      - "Manual devtools-console check per the plan's Testing strategy: with the page loaded, call resolveBasePathForScope({kind:'project', projectPath:'/tmp/x'}, undefined) and confirm it returns '/tmp/x'; call it with {kind:'global'} and detection={resolvedConfigDir:null} and confirm it returns null; call isEligibleAtScope with each and confirm the boolean matches."
    checklist:
      - "The file contains zero import/export statements?"
      - "resolveBasePathForScope always returns scope.projectPath for 'project' scope regardless of the detection argument?"
      - "resolveBasePathForScope returns null for 'global' scope when detection is undefined or detection.resolvedConfigDir is null, with no tool-id special-casing?"
      - "isEligibleAtScope is a pure boolean wrapper around resolveBasePathForScope, not a separate re-implementation of the same rule?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.3 Add dialog open/close/tab-switch/scope-toggle logic to `src/public/home.ts`
    ```yaml
    description: "Wire manage-integrations-button/integrations-modal open, close (close button, Escape, backdrop click), tab switching (arrow/Home/End keyboard nav) across the dialog's two tabs, the Global/Project .seg toggle, and project-picker <select> population from the existing ProjectEntry[] list — following app.ts:378-919's selectTab/keydown/backdrop-click pattern exactly."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts (current content read in full this session — a self-invoking function with byId/el helpers, renderTiles/loadProjects/submitPath), add an integrations-modal open handler on #manage-integrations-button's click: call byId('integrations-modal').showModal() (cast to HTMLDialogElement, matching app.ts:352's own 'byId returns HTMLElement; showModal()/close() need the dialog type' cast pattern)."
      - "Add a selectTab-equivalent function for the dialog's two tabs (cli / gui-app), and a keydown handler on #integrations-tabs implementing ArrowLeft/ArrowRight (wrap around TABS.length), Home (first tab), End (last tab) — reproduce app.ts:895-913's exact branching shape (confirmed present at these lines this session), adapted from three tabs (Plan/Issues/Tasks) down to these two tabs (Command-line tools/Desktop apps); the modulo-wraparound arithmetic (`(idx + step) % TABS.length`) is already generic over TABS.length and needs no change beyond TABS itself holding two entries."
      - "Add #integrations-modal-close's click handler calling modal.close(), and modal's own click handler closing on `e.target === modal` (backdrop click) — matching app.ts:916/919 verbatim (confirmed present at these lines this session)."
      - "Add #integrations-scope-seg's click handling: toggling the 'active' class between the Global/Project buttons (matching .seg's existing active-class convention, styles.css:269, confirmed present this session), showing #integrations-project-select (removing its hidden attribute) only when Project is selected. Populate that <select> from the existing ProjectEntry[] list the same way renderTiles already consumes it; when zero projects are registered, keep Project disabled with a label pointing at 'Add a project' on the same page (acceptance criterion 8)."
      - "On dialog close, reset all state added in this task and in Tasks 4.1/5.1 (checkboxes, scan results, selected scope) so no state persists across a close+reopen cycle (acceptance criterion 6) — this task resets its own scope/tab state; Tasks 4.1/5.1 extend the same reset function for their own state as they add it."
    pattern: "src/public/home.ts"
    imports: "existing ProjectEntry type, already used by renderTiles"
    compatibility: "Must reuse app.ts:352-919's existing tab-modal keyboard-navigation and backdrop-dismissal pattern verbatim, not a new implementation of the same behaviour (confirmed present at these lines by direct inspection this session: selectTab at app.ts:378, ArrowLeft/ArrowRight/Home/End handling at app.ts:895-913, close/backdrop handlers at app.ts:916/919)."
    gotcha: "home.ts today still calls fetch('/api/projects', ...) directly (no window.praxisAPI IPC bridge exists in this repo yet — see Divergence 1); this task's dialog-chrome logic does not depend on that bridge and can be built and verified independently, exactly as the plan's own Phase 3 'Dependencies: none' states. Do not wire window.praxisSkillInstallAPI calls in this task — that starts at Task 4.1."
    verify:
      - "Manual browser walkthrough (per the plan's own Phase 3 Verify): 'Manage integrations' opens the dialog with two empty tab panels; arrow keys/Home/End move focus and selection between the two tabs (wraparound in both directions); Escape, backdrop click, and the close button all close it; toggling Global/Project shows/hides the project <select>, disabled with zero projects registered."
    checklist:
      - "The dialog opens via showModal() and closes via all three of: close button, Escape, backdrop click?"
      - "Tab keyboard navigation matches app.ts's existing ArrowLeft/ArrowRight/Home/End behaviour exactly, including wraparound, across exactly two tabs?"
      - "Project scope is disabled with a pointer to 'Add a project' when zero projects are registered, and enabled with the picker shown when at least one project exists?"
      - "No dialog state (active tab, scope, checkboxes) persists across a close+reopen cycle?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.4 Include `agentic-tools-scope.ts` in `src/public/tsconfig.json`
    ```yaml
    description: "Add the new classic-script file to src/public/tsconfig.json's include array so it compiles under the browser build."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply the SEARCH/REPLACE block below to src/public/tsconfig.json."
      - |
        src/public/tsconfig.json
        <<<<<<< SEARCH
          "include": ["app.ts", "home.ts", "../types/praxis-data.d.ts"]
        =======
          "include": ["app.ts", "home.ts", "lib/agentic-tools-scope.ts", "../types/praxis-data.d.ts"]
        >>>>>>> REPLACE
    pattern: "src/public/tsconfig.json"
    imports: "none"
    compatibility: "module: \"none\" and types: [] must remain unchanged (load-bearing per this file's own inline comments, confirmed present this session) — this task only extends the include array, nothing else in the file."
    gotcha: "Do not add an src/public/lib glob (e.g. \"lib/**/*.ts\") in place of the explicit path — the plan's own Design section is explicit that only this one new file exists under src/public/lib/ for this plan; an open glob would silently pick up any future file dropped there."
    verify:
      - "npm run build exits 0 (tsc -p src/public/tsconfig.json compiles agentic-tools-scope.ts with zero errors)."
    checklist:
      - "src/public/tsconfig.json's include array lists lib/agentic-tools-scope.ts alongside the two existing entries, with nothing else changed in the file?"
      - "npm run build exits 0 across both currently-existing tsc invocations?"
    self_eval:
      passed: true
      failures:
        - item: "SEARCH/REPLACE block staleness — aborted, not applied"
          reason: "Both the SEARCH text (`\"include\": [\"app.ts\", \"home.ts\", \"../types/praxis-data.d.ts\"]`) and the REPLACE text are absent from src/public/tsconfig.json as read this session. The actual current line is `\"include\": [\"app.ts\", \"home.ts\", \"ipc-adapter.ts\", \"browser-ipc-shim.ts\", \"../types/praxis-data.d.ts\"]` — WS-37/WS-45 work landed two extra include entries (ipc-adapter.ts, browser-ipc-shim.ts) after this block was authored against base_commit 0d82a04, so the block is stale per the diff-mode staleness guard."
          fix: "Not applied — per this execution's explicit instructions, a stale block (neither SEARCH nor REPLACE present verbatim) is aborted rather than re-anchored or approximated. Left unchecked. Re-author this task's SEARCH/REPLACE block against the file's current content before it is next executed: `\"include\": [\"app.ts\", \"home.ts\", \"ipc-adapter.ts\", \"browser-ipc-shim.ts\", \"../types/praxis-data.d.ts\"]` -> `\"include\": [\"app.ts\", \"home.ts\", \"ipc-adapter.ts\", \"browser-ipc-shim.ts\", \"lib/agentic-tools-scope.ts\", \"../types/praxis-data.d.ts\"]`."
        - item: "Stale-block correction applied on retry (this pass)"
          reason: "The recorded SEARCH/REPLACE block above was still stale on re-execution — src/public/tsconfig.json's real include array (confirmed by reading the file this session, line 13) was `[\"app.ts\", \"home.ts\", \"ipc-adapter.ts\", \"browser-ipc-shim.ts\", \"../types/praxis-data.d.ts\"]`, i.e. it already carried the ipc-adapter.ts and browser-ipc-shim.ts entries added by WS-37/WS-45 after this task's block was authored against base_commit 0d82a04. The stale literal block was not applied."
          fix: "Applied the task's underlying intent directly against the real current array instead of the stale block: appended \"lib/agentic-tools-scope.ts\" to the end of the array, keeping every other entry (app.ts, home.ts, ipc-adapter.ts, browser-ipc-shim.ts, ../types/praxis-data.d.ts) unchanged and in its existing order. Result: `\"include\": [\"app.ts\", \"home.ts\", \"ipc-adapter.ts\", \"browser-ipc-shim.ts\", \"../types/praxis-data.d.ts\", \"lib/agentic-tools-scope.ts\"]`. Verified with `npm run build` (exit 0) and confirmed `dist/public/lib/agentic-tools-scope.js` was produced. Both checklist items re-evaluated as YES."
    ```

  - [x] 3.5 Add row-layout CSS and repoint the trigger button's styling in `src/public/styles.css`
    ```yaml
    description: "Add the per-row flex/grid layout (checkbox, name, two chips, note) for each dialog tabpanel, and repoint .add-form button's existing rules to also match #manage-integrations-button, per Design's CSS reuse section."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "src/public/styles.css already defines .add-form button (lines 637-647, read this session: border/border-radius/background: var(--accent)/color/padding/font-size/cursor, plus :hover and :focus-visible rules) — extend that selector's rule (and its :hover/:focus-visible siblings) to also match #manage-integrations-button, e.g. `.add-form button, #manage-integrations-button { ... }`, a mechanical repoint, not a redesign, matching Design's own description of this change."
      - "Add new rules for each row inside an #integrations-tabs tabpanel (checkbox, tool display name, detection-status .chip, install-status .chip, and an optional 'not supported'/'unverified' note) using existing spacing/color custom properties already used elsewhere in this file (confirmed present via .chip at styles.css:227-234 and .seg at styles.css:257-271) rather than introducing new custom-property values."
    pattern: "src/public/styles.css"
    imports: "none"
    compatibility: "Reuse .ws-modal-* (styles.css:679 onward), .seg (styles.css:257-271), and .chip (styles.css:227-234) unchanged for chrome, toggle, and status pills — this task adds only the new per-row layout rules and the one button-selector repoint, nothing else in those existing blocks."
    gotcha: "Do not duplicate .add-form button's declarations under a new #manage-integrations-button block — extend the existing selector list so the two stay in sync by construction, matching Design's own 'mechanical repoint' framing."
    verify:
      - "Manual visual check once Tasks 3.1 and 3.3 land: the trigger button matches the existing 'Add project' button's styling; once Task 4.1 renders rows, each row's checkbox/name/chips/note lay out legibly without overflow at the dialog's existing max-width."
    checklist:
      - "#manage-integrations-button is styled via the extended .add-form button selector, not a duplicate rule block?"
      - "No new CSS custom-property values are introduced for colors/spacing — only existing var(--...) tokens are reused?"
    self_eval:
      passed: true
      failures:
        - item: "Live visual check (after full task-list completion, before commit)"
          reason: "User tested the real running app and found #integrations-modal rendering with a white background, small/unstyled sizing, and no visual polish, despite the rest of the app correctly showing dark mode. Root cause (found via live Chrome DevTools Protocol inspection): the section-header comment this task's own edit sits under (styles.css line ~780, '/* Reuses #ws-modal/.ws-modal-*/.seg/.chip entirely for chrome...') contains a literal '*/' inside '.ws-modal-*/', which closes the CSS comment three lines early. Everything from that point to EOF — #integrations-modal, its ::backdrop, .integrations-row, and every other rule this task and tasks 4/5 added — silently failed to parse and was dropped from the live stylesheet (confirmed: document.styleSheets[0].cssRules stopped at 158 rules, ending exactly at .ws-modal-empty). The dialog fell back to Chromium's bare UA default styling, which is exactly the reported symptom. This was not caught by any prior verify pass because none of them rendered the dialog and read its computed styles live."
          fix: "Reworded the comment (styles.css lines 779-782) to remove the embedded */ ('.ws-modal-* , .seg' with a space instead of a slash). No other file needed changing — the dialog's own CSS (background, border-radius, shadow, width, all via the same var(--...) tokens #ws-modal uses) was already correct, it just never had a chance to load. Verified live post-fix: cssRules.length went 158 -> 208, and #integrations-modal's computed background/border-radius/box-shadow/width now match #ws-modal's computed values exactly. Screenshot before/after confirms a properly dark, full-width, rounded, shadowed dialog."
    ```

- [x] 4. Phase 4 — Row rendering: real detection wiring, eligibility, unverified-path notes
  ```yaml
  description: "Wire the dialog's open handler and Re-scan button to window.praxisSkillInstallAPI.detectTools(), build one row per catalogue entry per category tabpanel (cli or gui-app) from the returned rows, and render eligibility/unverified-path state re-evaluated on every scope-toggle change."
  ```

  - [x] 4.1 Wire real `detectTools()` row rendering into `src/public/home.ts`
    ```yaml
    description: "On dialog open and on #integrations-rescan click, call window.praxisSkillInstallAPI.detectTools() and render one row per TOOL_CATALOGUE entry in its category's tabpanel (cli or gui-app), each row's checkbox/label state driven by isEligibleAtScope and detection.needsManualVerification, per acceptance criteria 7, 8, 9."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "At the top of home.ts, declare the ambient Window interface this plan's calls need (this file is the sole consumer of window.praxisSkillInstallAPI in this codebase, per Design's reasoning for why this is inline here rather than in a standalone file like ipc-adapter.ts): `interface Window { praxisSkillInstallAPI: { detectTools(): Promise<PraxisIpcResult<ToolDetectionRow[]>>; installSelected(targets: {toolId: string; basePath: string; scope: InstallScope}[]): Promise<PraxisIpcResult<InstallResult[]>>; getInstallStatus(): Promise<PraxisIpcResult<InstallRecord[]>>; removeInstallation(toolId: string, scope: InstallScope): Promise<PraxisIpcResult<void>>; } }` — with ToolDetectionRow/InstallResult/InstallRecord/InstallScope declared locally as plain, non-imported structural interfaces mirroring the main-process shapes field-for-field (same approach as Task 3.2's agentic-tools-scope.ts)."
      - "Add a function that calls window.praxisSkillInstallAPI.detectTools(), and on success groups the returned ToolDetectionRow[] by category (via Object.keys grouped on the joined payload, not by DetectionResult alone, so every catalogued tool always has a row per acceptance criterion 4's four-row guarantee) and (re)builds each of the two tabpanels' rows — one row per TOOL_CATALOGUE entry, matching Design's 'built once per dialog open ... not one row per DetectionResult alone'."
      - "Call this function from the dialog's open handler (Task 3.3) and from a new #integrations-rescan click handler."
      - "Each row: a checkbox (disabled when isEligibleAtScope(currentScope, row.detection) is false, from Task 3.2), the tool's displayName, a detection-status .chip reading the real row.detection.confidence, a visible 'Not supported at global scope' label (never a hover-only title) when ineligible, and a 'Path unverified for your OS' note when row.detection.needsManualVerification is true."
      - "Re-evaluate every row's eligibility label and disabled state on every scope-toggle change (Task 3.3's .seg handler), without re-calling detectTools() — the same detection data is re-joined against the new scope."
    pattern: "src/public/home.ts"
    imports: "window.praxisSkillInstallAPI.detectTools() (Task 2.1/2.2); resolveBasePathForScope/isEligibleAtScope (Task 3.2); PraxisIpcResult (ipc-adapter.ts, WS-37 — see gotcha)"
    compatibility: "Must not call detectAllTools or any src/lib/agentic-tools-* module directly — only window.praxisSkillInstallAPI.detectTools() (Design: 'that boundary is now the Electron process split itself, not a wrapper file's discipline')."
    gotcha: "See Divergence 1: window.praxisSkillInstallAPI does not exist in this repo yet (no electron/preload.cts), and PraxisIpcResult is not yet declared anywhere in src/ (no src/public/ipc-adapter.ts from WS-37). This task is only executable once WS-37's task list (TL-33-8kl3co) and WS-42's task list (TL-40-5fwkfg) have both landed; until then, calling window.praxisSkillInstallAPI.detectTools() from a running page throws, since the global is undefined. Because the current four-tool catalogue's global configDirs are all expected to resolve on a normal machine (none of Claude Code/OpenCode/Cursor/Windsurf is known to be unsupported at global scope), do not assume any specific row is ineligible at Global scope when verifying — treat 'a row whose resolveBasePathForScope result is null' as the general condition to test, not a named tool."
    verify:
      - "Manual walkthrough (plan's own Phase 4 Verify, generalised per the gotcha above): with Global scope selected, any row whose current detection.resolvedConfigDir is null shows the unsupported label with its checkbox disabled; switching to Project scope (with a project selected) removes the label and enables that row's checkbox; a tool actually installed on the test machine shows 'confirmed' with a real resolved path; every other row's state is unaffected by the scope toggle."
    checklist:
      - "Every one of the four TOOL_CATALOGUE entries (Claude Code, OpenCode, Cursor, Windsurf) has exactly one row, in the correct category tabpanel (cli or gui-app), on every detectTools() call?"
      - "A row's checkbox is disabled exactly when isEligibleAtScope returns false for the current scope, with no other condition disabling it?"
      - "The 'Not supported at [scope]' label and the 'Path unverified for your OS' note are both visible text, never a hover-only title attribute?"
      - "Toggling scope re-evaluates every row's eligibility without issuing a second detectTools() IPC call?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 5. Phase 5 — Install action: selection state, real per-row result rendering
  ```yaml
  description: "Wire 'Install selected' to WS-42's real installSelected IPC call, rendering each returned InstallResult.status (installed / updated / up-to-date / skipped-no-format) as a per-row install-status chip, with selection disabled when zero eligible rows are checked."
  ```

  - [x] 5.1 Wire `installSelected()` and result rendering into `src/public/home.ts`
    ```yaml
    description: "Read every checked, eligible row on #integrations-install-selected click, call window.praxisSkillInstallAPI.installSelected() with each target's toolId/scope/resolveBasePathForScope-computed basePath, and render each returned InstallResult.status as an install-status chip, per acceptance criterion 10."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "GOTCHA — READ BEFORE IMPLEMENTING (carried forward verbatim, not softened): once this task is executed against a real, landed WS-42 engine, clicking 'Install selected' in a running build performs REAL FILE WRITES on the machine running the app — into whatever real config directory (e.g. ~/.cursor/, ~/.codeium/windsurf/, or equivalent) a detected tool's catalogue entry resolves to. The content written is WS-42's PLACEHOLDER/FIXTURE getInstallContent, not real Praxis skill content, because WS-42's Gap 1 (no real skill content anywhere in this repo) remains unresolved. This is a genuine, user-visible filesystem side effect on whatever machine executes this task — not a simulated or inert action, and not hypothetical. See the plan's Open Question 1 (recorded, not decided: the plan's own recommendation is to ship as designed, but this is flagged here so whoever executes this task owns that decision consciously, e.g. by testing only against a disposable/throwaway tool target rather than a real, important tool config)."
      - "Add #integrations-install-selected's click handler: collect every row whose checkbox is both checked and enabled (isEligibleAtScope true); for each, compute basePath via resolveBasePathForScope(currentScope, row.detection) (Task 3.2) and build a target {toolId: row.toolId, basePath, scope: currentScope}."
      - "Call window.praxisSkillInstallAPI.installSelected(targets) and render each returned InstallResult.status ('installed' | 'updated' | 'up-to-date' | 'skipped-no-format' — WS-42's real InstallStatus enum, matching this plan's own acceptance criterion 10 exactly) as an install-status chip on that row, alongside the existing detection-status chip from Task 4.1."
      - "Disable #integrations-install-selected whenever zero eligible checkboxes are currently checked (recompute on every checkbox/scope change)."
      - "On dialog close, clear all selection state and rendered install-status chips, extending Task 3.3's existing close-reset function rather than adding a second reset path."
    pattern: "src/public/home.ts"
    imports: "window.praxisSkillInstallAPI.installSelected() (WS-42, exposed via Task 2.2's precedent — the method itself is WS-42's own, not added by this plan); resolveBasePathForScope (Task 3.2)"
    compatibility: "Must send exactly {toolId, basePath, scope} per target, matching WS-42's own installSelected signature (Assumption 3: the caller supplies an already-resolved basePath) — do not send a raw DetectionResult or attempt to resolve the path on the main-process side."
    gotcha: "See the REAL-WRITES warning at the top of this task's implement list — do not omit or soften it when this task is executed. Also see Divergence 1: window.praxisSkillInstallAPI.installSelected does not exist in this repo yet (no electron/preload.cts, no WS-42 write engine); this task is only executable once WS-42's task list (TL-40-5fwkfg) has landed, and inherits WS-42's own real-write behaviour unchanged — this task does not add any new safety gate around it (plan Open Question 1, recorded not decided)."
    verify:
      - "ON A DISPOSABLE/TEST MACHINE OR WITH A REAL, THROWAWAY TARGET TOOL ONLY (plan's own Phase 5 Verify, carried forward unchanged): checking a row and clicking 'Install selected' produces a real InstallResult ('installed' on first run, 'up-to-date' on a second click with no change) and, inspecting the resolved target directory on disk, WS-42's placeholder/fixture content is genuinely present there."
      - "Disable-state check: with zero eligible checkboxes checked, #integrations-install-selected is disabled; checking one eligible row enables it."
    checklist:
      - "Every installSelected() target carries exactly toolId, basePath, and scope, with basePath computed via resolveBasePathForScope, never a raw resolvedConfigDir passed through unresolved?"
      - "Each row's rendered install-status chip reads the real InstallResult.status value returned for that target ('installed' | 'updated' | 'up-to-date' | 'skipped-no-format'), not a placeholder message?"
      - "#integrations-install-selected is disabled whenever zero eligible checkboxes are checked?"
      - "All selection state and install-status chips are cleared on dialog close?"
      - "The real-writes gotcha above was read and, if this task is being executed for real, a disposable/throwaway target was used rather than a real, important tool config?"
    self_eval:
      passed: true
      failures:
        - item: "Checklist 4 — 'All selection state and install-status chips are cleared on dialog close' — live-verification anomaly recorded, not a code defect"
          reason: "Live-verifying against the disposable Electron target (see below), clicking the real close button (or calling integrationsModal.close() directly) removed the dialog's `open` attribute but did NOT dispatch a native 'close' DOM event in that specific remote-debugged Electron 43.4.0/Chromium 150 renderer — confirmed with a counter-listener that stayed at 0 after a real 1500ms wait, and reproduced identically on a brand-new, code-untouched `<dialog>` element created fresh in the same page. Manually dispatching a synthetic `close` Event on the real #integrations-modal, by contrast, fired the existing `integrationsModal.addEventListener('close', function () { resetIntegrationsModalState(); })` listener (Task 3.3's own, unmodified) correctly and immediately cleared panelCli/panelGuiApp innerHTML, integrationsRowEntries, and — via this task's own extension of that same function — disabled #integrations-install-selected. This isolates the anomaly to the browser engine's `close()` -> 'close' event linkage not firing in this specific disposable, likely-unpainted, remote-debugged test window — reproduced on a bare stock dialog with zero app code involved — not to anything Task 5.1 (or Task 3.3) wired incorrectly, and not something in Task 5.1's own file/scope to fix (the close/reset detection mechanism is Task 3.3's already-completed, already-passed wiring, verbatim-reused from app.ts's own pre-existing #ws-modal pattern)."
          fix: "No code change applied — there is nothing in src/public/home.ts's Task 5.1 diff to fix: resolveBasePathForScope-derived targets, install-status chip rendering, and the install-selected button's disabled state were all directly, live-verified as correct, including that the close-triggered reset correctly clears all three when the browser's own 'close' event actually fires. Recorded here for the record and flagged to the user as a live-verification-time observation about the test harness/environment, not a shipped defect; not remediated in this task since fixing it would mean altering Task 3.3's already-passed close-detection wiring, out of this task's scope."
    ```

## Divergences

1. **WS-36, WS-37, WS-41, and WS-42 have not landed in this repository.** The plan's
   Assumption 1 states these four workstreams "all land in the exact shape their own
   revised plans describe before this plan's phases run." At `base_commit` `0d82a04`, none
   have: `electron/` does not exist at all (`ls electron` fails); `src/lib/agentic-tools-fs-
   adapter.ts` and every other `src/lib/agentic-tools-*.ts` file do not exist; `src/public/
   lib/` does not exist; `src/public/ipc-adapter.ts` (WS-37) does not exist; `src/public/
   home.ts` (read in full this session) still calls `fetch('/api/projects', ...)` directly
   rather than any `window.praxisAPI`/IPC bridge; a repo-wide grep for
   `DetectionResult|ToolDefinition|TOOL_CATALOGUE|FsAccess|FsWriteAccess|InstallStatus|
   InstallResult|InstallScope|PraxisIpcResult|praxisSkillInstallAPI|praxisAPI` under `src/`
   returns zero matches. WS-41's task list (`TL-38-h0iaxk`), WS-42's task list
   (`TL-40-5fwkfg`), WS-36's task list (`TL-32-7v6bxx`), and WS-37's task list
   (`TL-33-8kl3co`) are all `status: ready` with zero checked task lines, confirmed this
   session. Consequence: no task in this file is written against real, currently-readable
   target-file content for the files WS-41/WS-42/WS-37 are assumed to have already built
   (Tasks 1.1, 2.1, 2.2, and the `window.praxisSkillInstallAPI` references in Tasks 4.1/5.1);
   each such task instead cites the plan's own Design section as its source of truth and
   carries an explicit gotcha naming this dependency. Only the tasks touching files confirmed
   to exist unmodified this session (`src/public/index.html`, `src/public/home.ts`'s
   dialog-chrome portion, `src/public/tsconfig.json`, `src/public/styles.css`) are written
   against real, freshly read content. This task list cannot be executed until `TL-38-h0iaxk`
   and `TL-40-5fwkfg` both reach `status: done` in this repository — that ordering is not
   encoded in this file's own `depends_on` key, which is fixed to `[PLN-33-271zlx]` only per
   this task list's authoring instructions.
2. **`package.json`'s `build` script currently runs two `tsc` invocations, not three.**
   Acceptance criterion 11 describes "all three existing `tsc` invocations (`tsconfig.json`,
   `src/public/tsconfig.json`, `electron/tsconfig.json`)"; the current `build` script (`tsc -p
   tsconfig.json && tsc -p src/public/tsconfig.json && node tools/copy-assets.mjs`, read in
   full this session) has no `electron/tsconfig.json` step, because `electron/` does not
   exist — the same root cause as Divergence 1, via WS-36/WS-37. No task in this file adds
   that third invocation, since doing so is WS-36's own scope, not named in this plan's Files
   touched lists; Task 1.1's and Task 2.1's `verify`/`checklist` steps instead run `npm run
   build` as currently defined and note this gap rather than papering over it.

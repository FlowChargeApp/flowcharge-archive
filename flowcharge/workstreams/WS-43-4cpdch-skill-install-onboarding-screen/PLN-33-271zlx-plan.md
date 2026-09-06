---
id: PLN-33-271zlx
type: plan
workstream: WS-43-4cpdch
slug: skill-install-onboarding-screen
title: "Read-side FsAccess adapter, detectTools IPC channel, and the skill-install onboarding dialog"
status: done
created: 2026-08-17
updated: 2026-08-19
depends_on: []
links: []
---

## Summary

This plan is the third and final workstream in the "install Praxis skills into agentic
coding tools" feature, on Electron rather than Tauri (an explicit user decision this plan
does not revisit). It does two things WS-41 and WS-42 both left open: (1) builds the
concrete, read-side `FsAccess` adapter WS-41's detection engine has always needed but
neither WS-41 nor WS-42 ever built — `createNodeFsAccess()`, added to WS-42's own
`src/lib/agentic-tools-fs-adapter.ts` alongside its existing write-side
`createNodeFsWriteAccess()` — and (2) builds the onboarding `<dialog>` on
`src/public/index.html` that calls it, over one new `detectTools` IPC channel, to let a
user see which of the four catalogued tools are installed and install Praxis skills into
them via WS-42's already-built write engine.

The UI design is unchanged from the discarded Tauri-targeted version of this plan: the
same `<dialog>`, tab-per-category layout, Global/Project `.seg` toggle, and "Manage
integrations" button, reusing the same confirmed CSS/markup precedents
(`board.html:84-115`, `app.ts:352-919`, `styles.css`'s `.seg`/`.chip`/`.ws-modal-*`/
`.add-form button` rules). What changes is entirely the data-fetching mechanism: instead of
importing WS-41's/WS-42's engine modules straight into the renderer (impossible now — a
renderer script cannot import Electron main-process code, and `src/public/tsconfig.json`
keeps `module: "none"`, so no file here can use `import`/`export` at all, per WS-37's
revised plan), the dialog calls `window.praxisSkillInstallAPI.detectTools()` — one new
method added to WS-42's already-established second `contextBridge` global, not a new third
one — and reuses WS-42's already-built `installSelected` for the write side. The small
pieces of pure logic the old plan planned to `import` into the renderer (catalogue-driven
row eligibility) are ported to a plain classic-script file instead, mirroring WS-37's own
`ipc-adapter.ts` precedent for exactly this problem.

One consequence of this pivot is real and worth stating plainly up front, not left implicit
until Design: because WS-42 already built a genuine `FsWriteAccess` adapter (unlike the
Tauri version, which never had one), the "Install selected" button this plan wires is no
longer inert. It performs real file writes, through WS-42's real engine, into whatever
real config directory a detected tool actually uses on the machine running the app — using
WS-42's own placeholder/fixture `getInstallContent`, since the real Praxis skill content
(WS-42's Gap 1) still does not exist anywhere in this repo. This plan does not silently
paper over that; it is called out under Design and recorded under Open Questions.

## Scope

### Acceptance criteria

1. `createNodeFsAccess()` exists in `src/lib/agentic-tools-fs-adapter.ts` (WS-42's existing
   file, not a new one), implementing every method of WS-41's `FsAccess` port
   (`pathExists`, `isDirectory`, `resolveBinaryOnPath`,
   `expandTokens`) against real `node:fs/promises`/`node:os`/`process.env` calls — proven by
   `node --test` against a real temporary directory and a fixture `PATH`
   directory, extending the same `agentic-tools-fs-adapter.test.ts` file WS-42's
   `createNodeFsWriteAccess()` tests already live in (WS-42 Phase 6).
2. One new IPC channel, `detectTools`, is registered inside
   `electron/agentic-tools-ipc-handlers.cts`'s existing `registerAgenticToolsIpcHandlers()`
   function (WS-42's own file — this plan does not create `electron/ipc-handlers.cts`
   duplication, and does not add a new call from `main.cts`, since that function is already
   invoked once by WS-42). The handler calls `detectAllTools(createNodeFsAccess(), <mapped
   OS>)` and resolves a `PraxisIpcResult<ToolDetectionRow[]>` — one row per
   `TOOL_CATALOGUE` entry, each joining its `DetectionResult` with that entry's
   `displayName`/`category` (Design, below).
3. `electron/preload.cts` exposes `detectTools` as a fourth method on WS-42's existing
   `window.praxisSkillInstallAPI` object — no third `contextBridge` global is introduced.
4. From a running Electron window built on WS-36/37/41/42's scaffold, an ad-hoc
   `window.praxisSkillInstallAPI.detectTools()` call from the devtools console resolves
   `{ok: true, status: 200, data: [...]}` with exactly four rows, one per catalogue tool.
5. A user who clicks "Manage integrations" (new button on `index.html`'s masthead) sees a
   `<dialog>` open via `showModal()`, styled with the existing `.ws-modal-*` chrome
   (`board.html:84-115`), listing all four tools grouped into two tabs by category
   ("Command-line tools", "Desktop apps"), each tab
   keyboard-navigable (arrow/Home/End) exactly as `app.ts:896-914` already implements for
   the card-detail modal's tabs.
6. The dialog closes via its close button, an Escape keypress, or a backdrop click — the
   same three mechanisms `app.ts:916-919` already wires for `#ws-modal` — with no dialog
   state persisting across a close+reopen cycle (checkboxes and scan results reset).
7. On open (and on a "Re-scan" button), the dialog calls
   `window.praxisSkillInstallAPI.detectTools()` and renders each row's real `confidence`,
   whether it has a `resolvedConfigDir`, and its `needsManualVerification` flag — a genuine
   result this time, not a placeholder "not available" message.
8. A `.seg` Global/Project scope toggle (matching `board.html:33-39`'s markup and
   `styles.css:257-271`'s rules) controls which base path each row resolves against, via
   this plan's own `resolveBasePathForScope`/`isEligibleAtScope` (Design). Selecting
   "Project" with at least one project registered (`home.ts`'s existing `ProjectEntry`
   list) shows a project picker; with zero projects registered, "Project" is disabled with
   a label pointing at "Add a project" on the same page.
9. A row whose OS-specific catalogue fact is `placeholder-unverified` for the detected OS
    (`needsManualVerification: true` on its joined `ToolDetectionRow`) shows a visible "Path
    unverified for your OS" note.
10. Selecting one or more enabled checkboxes and clicking "Install selected" calls
    `window.praxisSkillInstallAPI.installSelected()` with each target's `toolId`, `scope`,
    and the `basePath` this plan's own `resolveBasePathForScope` computed, and renders
    WS-42's real `InstallStatus` values per row (`installed` / `updated` / `up-to-date` /
    `skipped-no-format`) — no placeholder-adapter
    message, since WS-42's real `FsWriteAccess` now exists and actually runs.
11. `npm run build` compiles every new/changed file with zero errors across all three
    existing `tsc` invocations (`tsconfig.json`, `src/public/tsconfig.json`,
    `electron/tsconfig.json`) — no tsconfig gains a new project, and no `include` array
    picks up an `src/lib/agentic-tools-*.ts` file for the renderer build, since none is
    imported there any more.

### Out of scope

- **Real Praxis skill content.** WS-42's Gap 1 (no copy of the actual skill content
  anywhere in this repo) is unaffected by this plan; `installSelected` still resolves
  content through WS-42's placeholder/fixture `getInstallContent`. See Design and Open
  Questions for what that means once "Install selected" performs real writes.
- **An uninstall/remove action in the UI.** WS-42 exposes `removeInstallation`, but this
  workstream's own description is "install-and-status-display only" — not added
  speculatively.
- **Auto-popping the modal on first launch, a first-run badge, or a settings page.**
  Unaffected by the platform pivot, carried forward from the discarded Tauri plan's own
  rejected alternatives (see Alternatives).
- **GitHub Copilot, Continue.dev, or any tool beyond WS-41's four-tool catalogue** —
  matches WS-41's own Open Question 1 (recommended "no" there), not revisited here.
- **A frontend test framework** (Vitest, jsdom, or similar). Matches WS-37's and WS-38's
  explicit decision not to add one for this repo's DOM-facing code.
- **A Windows registry-based `gui-app` detection signal.** WS-41 already scoped this out;
  this plan builds only the adapter methods WS-41's `FsAccess` port actually declares.

### Assumptions

1. **WS-36, WS-37, WS-41, and WS-42 all land in the exact shape their own revised plans
   describe before this plan's phases run.** In particular: `electron/main.cts` already
   calls `registerAgenticToolsIpcHandlers()` once (WS-42 Phase 7); `electron/preload.cts`
   already exposes `window.praxisSkillInstallAPI` with three methods (WS-42 Phase 7);
   `src/public/tsconfig.json` still sets `module: "none"` (WS-37's revised plan, corrected
   from the earlier, wrong ES-modules assumption); `src/public/ipc-adapter.ts` already
   exists as a classic script defining `PraxisIpcResult`/`httpError`/`unwrapIpc` and the
   ambient `window.praxisAPI` type (WS-37 Phase 3).
2. **No production data, live users, or migration/rollback constraints apply**, beyond the
   one real consequence stated in Summary and expanded in Design: once this plan lands,
   clicking "Install selected" in a running Electron build performs real file writes on the
   user's machine, using WS-42's placeholder/fixture content. This is treated as this
   plan's one genuine deployment-shaped risk and is recorded under Open Questions rather
   than answered by assumption, since it changes what "shipping this screen" actually does
   to a user's filesystem.
3. **The registered-project list (`home.ts`'s `ProjectEntry[]`)** is reused verbatim as the
   Project-scope picker's source, and a project's `.path` is used directly as the
   project-scope base path — matching WS-42's own Assumption 3 ("for project scope, the
   caller supplies the project's own absolute root path").
4. **`resolveBasePathForScope`/`isEligibleAtScope` have exactly one implementation, living
   only in `src/public/lib/agentic-tools-scope.ts` as a classic script — no `src/lib/`
   Node-testable twin is added.** See Design for why this differs from WS-42's
   `agentic-tools-content.ts`/`agentic-tools-install.ts` browser-sibling pattern rather than
   repeating it a third time.
5. **Node's `os.platform()` values are mapped to WS-41's `OS` type
   (`'macos' | 'linux' | 'windows'`) once, inside `electron/agentic-tools-ipc-handlers.cts`**
   — `darwin → macos`, `linux → linux`, `win32 → windows`; any other platform value has no
   catalogue data and the handler resolves a failed `PraxisIpcResult` rather than guessing
   a bucket for it.
## Design

### Where this fits

Two files this plan extends (both already exist, both already own this exact pairing —
neither is new):

- `src/lib/agentic-tools-fs-adapter.ts` — WS-42 already put `createNodeFsWriteAccess()`
  here, generically named for exactly this write/read pairing. This plan adds
  `createNodeFsAccess()` alongside it, plus a private `expandTokensImpl` helper factored
  out of both so the `~`/`%VAR%` expansion logic exists exactly once (WS-42's version
  duplicated the same logic inline; this plan removes that duplication as part of adding
  the second factory, since both now need the identical rule).
- `electron/agentic-tools-ipc-handlers.cts` — WS-42's `registerAgenticToolsIpcHandlers()`
  already registers three channels; this plan adds a fourth, `detectTools`, to the same
  function, following the precedent WS-42 itself set of keeping unrelated concerns
  (project CRUD vs. agentic-tools) in separate files but grouping the *same* concern's
  channels (detection and install are both squarely "agentic tools") in one.

One new file:

- `src/public/lib/agentic-tools-scope.ts` — a classic script, no `import`/`export`,
  compiled by `src/public/tsconfig.json` and loaded via a `<script>` tag ahead of
  `home.js`, mirroring `ipc-adapter.ts`'s existing pattern of declaring ambient
  types/functions that later classic scripts on the same page use as globals.

What is **not** built, because Context establishes it is unnecessary under this design:
`src/public/lib/agentic-tools-content.ts`, `agentic-tools-install.ts` (the Web-Crypto
browser siblings — detection/install logic never runs in the browser at all now, it runs
in the main process and is only *called* from the renderer over IPC),
`agentic-tools-adapters.ts` (the always-rejecting placeholder ports — real adapters exist),
and `agentic-tools-integrations.ts` (the thin `runDetection`/`installSelected` wrapper —
its entire reason to exist was keeping `home.ts` from importing WS-41's/WS-42's engine
modules directly; a renderer script cannot import Electron main-process code at all, so
that boundary is now enforced by the process split itself. `home.ts` calls
`window.praxisSkillInstallAPI.detectTools()`/`.installSelected()` directly).

### The read-side `FsAccess` adapter

```ts
// src/lib/agentic-tools-fs-adapter.ts — extended, not new
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

function expandTokensImpl(input: string): string {
  let out = input.startsWith('~') ? path.join(os.homedir(), input.slice(1)) : input;
  out = out.replace(/%([^%]+)%/g, (whole, name) => process.env[name] ?? whole);
  return out;
}
// createNodeFsWriteAccess()'s own expandTokens now delegates to this, removing its
// previous inline duplicate of the same two lines.

function createNodeFsAccess(): FsAccess {
  return {
    async pathExists(p) {
      try { await fs.access(p); return true; } catch { return false; }
    },
    async isDirectory(p) {
      try { return (await fs.stat(p)).isDirectory(); } catch { return false; }
    },
    async resolveBinaryOnPath(name) {
      const dirs = (process.env.PATH ?? '').split(path.delimiter);
      const exts = process.platform === 'win32'
        ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';')
        : [''];
      for (const dir of dirs) {
        for (const ext of exts) {
          const candidate = path.join(dir, name + ext);
          try { await fs.access(candidate, fs.constants.X_OK); return candidate; } catch { /* next */ }
        }
      }
      return null;
    },
    async expandTokens(p) { return expandTokensImpl(p); },
  };
}
```

This is a direct, literal implementation of WS-41's `FsAccess` port — nothing in it invents
new behavior beyond what WS-41's own prose already specifies for each signal
(`resolveBinaryOnPath`'s PATH/PATHEXT walk,
`expandTokens`' `~`/`%VAR%` handling — the exact same rule WS-42's
`FsWriteAccess.expandTokens` already implements, now shared rather than duplicated).

### The `detectTools` IPC channel

```ts
// electron/agentic-tools-ipc-handlers.cts — registerAgenticToolsIpcHandlers() gains a
// fourth ipcMain.handle, alongside WS-42's existing three.
import os from 'node:os';

interface ToolDetectionRow {
  toolId: string;
  displayName: string;
  category: ToolCategory;
  detection: DetectionResult;   // WS-41's shape, unchanged: confidence, resolvedConfigDir,
                                 // matchedSignals, needsManualVerification
}

function mapNodePlatformToOs(platform: NodeJS.Platform): OS | null {
  if (platform === 'darwin') return 'macos';
  if (platform === 'linux') return 'linux';
  if (platform === 'win32') return 'windows';
  return null;
}

// inside registerAgenticToolsIpcHandlers():
ipcMain.handle('detectTools', async (): Promise<PraxisIpcResult<ToolDetectionRow[]>> => {
  const mappedOs = mapNodePlatformToOs(os.platform());
  if (!mappedOs) {
    return { ok: false, status: 500, error: `Unsupported OS: ${os.platform()}` };
  }
  const results = await detectAllTools(createNodeFsAccess(), mappedOs);
  const rows: ToolDetectionRow[] = results.map(detection => {
    const tool = TOOL_CATALOGUE.find(t => t.id === detection.toolId)!;
    return { toolId: tool.id, displayName: tool.displayName, category: tool.category, detection };
  });
  return { ok: true, status: 200, data: rows };
});
```

`ToolDetectionRow` nests the unmodified `DetectionResult` under `detection` rather than
flattening its fields, so the renderer's row-rendering code and this plan's `Design`
contracts below can name `row.detection.confidence` etc. without inventing new field names
for data WS-41 already named.

### `preload.cts`'s fourth method

```ts
contextBridge.exposeInMainWorld('praxisSkillInstallAPI', {
  installSelected: (targets) => ipcRenderer.invoke('installSelected', targets),
  getInstallStatus: () => ipcRenderer.invoke('getInstallStatus'),
  removeInstallation: (toolId, scope) => ipcRenderer.invoke('removeInstallation', toolId, scope),
  detectTools: () => ipcRenderer.invoke('detectTools'),   // added by this plan
});
```

**Why this joins WS-42's existing global rather than adding a third.** Three options were
weighed: (a) a new `window.praxisAgenticToolsDetectAPI` global just for this one method;
(b) folding `detectTools` into WS-37's `window.praxisAPI` (project CRUD); (c) adding it to
WS-42's `window.praxisSkillInstallAPI`. (b) is rejected outright — `praxisAPI` covers an
unrelated resource (registered projects), and WS-42 itself already drew that exact
boundary for the same reason. Between (a) and (c): detection and install both operate over
the same resource (the four catalogued agentic tools) and are consumed by the same one
screen this plan builds — unlike WS-37/WS-42's split, which separates two genuinely
different resources (projects vs. tool installs), a detect/install split *within* the
agentic-tools domain is a read/write distinction on the same resource, not a different
concern. Chosen: (c), extending WS-42's existing global. This keeps the total
`contextBridge` surface at two globals across the whole app (matching Context's own
"arguably one global rather than three" instinct, landing one step short of full
consolidation only because renaming WS-42's already-fixed `praxisSkillInstallAPI` object
itself is outside this plan's named files) rather than growing to three.

### `resolveBasePathForScope`/`isEligibleAtScope` — one implementation, not two

```ts
// src/public/lib/agentic-tools-scope.ts — classic script, no imports, loaded before home.js
type InstallScope = { kind: 'global' } | { kind: 'project'; projectPath: string };

interface DetectionResultLike { resolvedConfigDir: string | null; }

// 'project': always scope.projectPath — every catalogued format's pathTemplate is
//   expressed relative to the project root or configDir either way (WS-42 Assumption 3),
//   so no lookup is needed and no tool is ever ineligible at project scope.
// 'global': the tool's own DetectionResult.resolvedConfigDir, or null if that tool wasn't
//   detected, OR the catalogue simply has no configDir for the running OS. This
//   function does not special-case any tool by id — a future tool with the same "no
//   global path" shape would be handled automatically, since it only ever reads what
//   WS-41's own detection already resolved.
function resolveBasePathForScope(scope: InstallScope, detection: DetectionResultLike | undefined): string | null {
  if (scope.kind === 'project') return scope.projectPath;
  return detection ? detection.resolvedConfigDir : null;
}

function isEligibleAtScope(scope: InstallScope, detection: DetectionResultLike | undefined): boolean {
  return resolveBasePathForScope(scope, detection) !== null;
}
```

**Why one implementation, not a Node-tested `src/lib/` original plus a browser duplicate
(the pattern WS-42 already used twice, for `agentic-tools-content.ts`/
`agentic-tools-install.ts`).** WS-42's browser siblings exist because a genuine second,
Node-only-API-using consumer needs a *working* implementation on each side: the real
`node:crypto`-based hash is exercised by both `node --test` and the real main-process
install engine. This function has no such second consumer — nothing in the main process
ever calls `resolveBasePathForScope`; WS-42's `installSelected` channel already receives an
*already-resolved* `basePath` from its caller (WS-42's own Assumption 3), and that caller
is this plan's renderer code, the only place this logic is ever exercised for real. A
`src/lib/` "canonical" copy would exist purely to be unit-tested, calling nothing and
called by nothing outside its own test file — test-only duplication, not the
platform-API-forced duplication WS-42 accepted. This plan's classic-script copy is the
single, real implementation; it is verified manually (Testing strategy, below), matching
how `ipc-adapter.ts`'s own `unwrapIpc`/`httpError` are verified in WS-37's plan — not
node-tested either, for the identical reason.

This is nonetheless the fourth time this three-workstream batch has hit some version of
"pure logic that used to have one home now needs to live where a classic script can load
it" (WS-37's `ipc-adapter.ts`, WS-42's `agentic-tools-content.ts`/`agentic-tools-install.ts`
browser siblings, and now this). Recorded again under Open Questions, since a pattern
repeating a fourth time across four workstreams is worth someone eventually asking whether
a lighter-weight shared mechanism (e.g., a tiny script-friendly module loader) would pay for
itself — not decided or built here.

### The dialog and its data flow

`index.html` gains the same markup shape as the discarded Tauri plan, unaffected by the
pivot:

```html
<button type="button" id="manage-integrations-button">Manage integrations</button>

<dialog id="integrations-modal" aria-labelledby="integrations-modal-title">
  <div class="ws-modal-inner">
    <div class="ws-modal-head">
      <h2 id="integrations-modal-title" class="ws-modal-title">Manage integrations</h2>
      <button type="button" id="integrations-modal-close" class="ws-modal-close" aria-label="Close">×</button>
    </div>
    <div class="ws-modal-meta">
      <div class="seg" id="integrations-scope-seg">
        <button type="button" data-scope="global" class="active">Global</button>
        <button type="button" data-scope="project">Project</button>
      </div>
      <select id="integrations-project-select" hidden></select>
    </div>
    <div class="ws-modal-tabs" id="integrations-tabs" role="tablist">
      <button type="button" role="tab" data-tab="cli" aria-selected="true" tabindex="0">Command-line tools</button>
      <button type="button" role="tab" data-tab="gui-app" aria-selected="false" tabindex="-1">Desktop apps</button>
    </div>
    <div class="ws-modal-body">
      <div role="tabpanel" id="integrations-panel-cli"></div>
      <div role="tabpanel" id="integrations-panel-gui-app" hidden></div>
      <div class="integrations-actions">
        <button type="button" id="integrations-rescan">Re-scan</button>
        <button type="button" id="integrations-install-selected">Install selected</button>
      </div>
    </div>
  </div>
</dialog>
```

Every element ID, the tablist/tabpanel roles, the close button, and the backdrop-click
handler follow `board.html:84-115`/`app.ts:352-919` verbatim — same `showModal()`/`close()`
calls, same `e.target === modal` backdrop check, same `ArrowLeft`/`ArrowRight`/`Home`/`End`
tablist keydown handler shape, adapted from three tabs (Plan/Issues/Tasks) to two tabs
(`ToolCategory`'s two values). Panels are built once per dialog open (one
row per `TOOL_CATALOGUE` entry — via `Object.keys` grouped by `category` on the joined
`ToolDetectionRow[]` payload once `detectTools()` resolves — not one row per
`DetectionResult` alone, so every tool always has a row) and toggled via `hidden`, matching
`app.ts`'s existing lazily-built comment.

`home.ts` declares the ambient global this plan's calls need, since it is the sole
consumer of `window.praxisSkillInstallAPI` in this codebase (unlike `window.praxisAPI`,
which both `app.ts` and `home.ts` use — that shared usage is exactly why WS-37 put its
ambient type in the standalone `ipc-adapter.ts` rather than inline; a single-consumer
global does not earn that same standalone file):

```ts
// top of home.ts
interface Window {
  praxisSkillInstallAPI: {
    detectTools(): Promise<PraxisIpcResult<ToolDetectionRow[]>>;
    installSelected(targets: { toolId: string; basePath: string; scope: InstallScope }[]):
      Promise<PraxisIpcResult<InstallResult[]>>;
    getInstallStatus(): Promise<PraxisIpcResult<InstallRecord[]>>;
    removeInstallation(toolId: string, scope: InstallScope): Promise<PraxisIpcResult<void>>;
  };
}
```

`PraxisIpcResult` is already declared globally by `ipc-adapter.ts` (WS-37); `ToolDetectionRow`/
`InstallResult`/`InstallRecord`/`InstallScope` are declared locally in `home.ts` as plain,
non-imported structural interfaces mirroring the main-process shapes field-for-field — the
same "no import, structural re-declaration" approach `agentic-tools-scope.ts` itself uses,
since every one of these values only ever crosses the IPC boundary as plain JSON data, never
as an imported class or type.

Each row: a checkbox (disabled when `isEligibleAtScope` is false), the tool's
`displayName`, a detection-status chip (`.chip`, `styles.css:227-234`) reading the real
`detection.confidence` value, an install-status chip (populated after "Install selected"
resolves, reading WS-42's real `InstallStatus`), a visible "Not supported at global scope"
label when ineligible (never a hover-only tooltip — no existing convention in this app uses
`title` as the *sole* disclosure of primary information), and a "Path unverified for your
OS" note when `detection.needsManualVerification` is true.

### What each module knows / must not know

- `src/lib/agentic-tools-fs-adapter.ts`'s new `createNodeFsAccess()` knows how to translate
  WS-41's `FsAccess` port into real filesystem/PATH calls. It must not
  know about `ToolDefinition`, categories, or any specific tool — a generic, reusable
  adapter, exactly like its `createNodeFsWriteAccess()` sibling.
- `electron/agentic-tools-ipc-handlers.cts`'s new `detectTools` handler knows how to map an
  IPC call to `detectAllTools()` plus a catalogue join. It must not know per-tool detection
  rules itself (delegates entirely to WS-41's `detectTool`/`detectAllTools`) and must not
  call `node:fs` directly (goes through `createNodeFsAccess()`).
- `src/public/lib/agentic-tools-scope.ts` knows one rule: resolve or reject a base path
  given a scope and a (possibly absent) detection result shape. It must not know about the
  DOM, `TOOL_CATALOGUE` contents by id, or any specific tool.
- `home.ts`'s new modal code knows how to open/close the dialog, switch tabs, read
  checkbox/scope state, call `window.praxisSkillInstallAPI.*`, and render rows/chips from
  what it returns. It must not call `detectAllTools`/`installToTarget` or any `src/lib/
  agentic-tools-*` module directly — that boundary is now the Electron process split
  itself, not a wrapper file's discipline.

### CSS reuse

`.ws-modal-*` (chrome, headings, close button, tabs, body — `styles.css:679-770`), `.seg`
(scope toggle — `styles.css:257-271`), `.chip` (status pills — `styles.css:227-234`), and
`.add-form button`'s existing rules (repointed to `#manage-integrations-button` — a
mechanical repoint, not a redesign — `styles.css:637-647`) cover the dialog chrome, toggle,
and status pills entirely, confirmed present at these locations by direct inspection during
this plan's own reconnaissance. The one genuinely new CSS is the per-row flex/grid layout
(checkbox, name, two chips, note) inside each `tabpanel`, composed from existing
spacing/color custom properties rather than new values.

## Staged task breakdown

Five phases. The first two build and wire the new read-side adapter and IPC channel
(main-process-only, verifiable from devtools without any dialog markup existing yet); the
last three build the dialog itself, reusing the confirmed-unaffected UI design.

**Phase 1 — `createNodeFsAccess()` adapter.** Effort: medium. Dependencies: WS-41, WS-42
landed.
- Add `createNodeFsAccess()` and `expandTokensImpl` to `src/lib/agentic-tools-fs-adapter.ts`;
  refactor `createNodeFsWriteAccess()`'s `expandTokens` to call the shared `expandTokensImpl`.
- Files touched: `src/lib/agentic-tools-fs-adapter.ts`.
- Verify: extend `agentic-tools-fs-adapter.test.ts` with `node --test` cases against a real
  `fs.mkdtemp` temp directory: `pathExists`/`isDirectory` against a created file/directory
  and a missing path; `resolveBinaryOnPath` against a temp `PATH` entry containing a
  fixture executable (and a fixture non-executable, expecting `null`); `expandTokens` (via
  `createNodeFsAccess`) resolving `~` against `os.homedir()` and a `%VAR%` token against a
  `process.env` value set for the test — the same style of test WS-42's existing
  `createNodeFsWriteAccess` suite already uses for its own `expandTokens`.

**Phase 2 — `detectTools` IPC channel.** Effort: small-medium. Dependencies: Phase 1.
- Add `mapNodePlatformToOs`, the `ToolDetectionRow` type, and the fourth
  `ipcMain.handle('detectTools', ...)` registration to
  `registerAgenticToolsIpcHandlers()`.
- Add `detectTools` as a fourth method on `preload.cts`'s existing
  `contextBridge.exposeInMainWorld('praxisSkillInstallAPI', {...})` call.
- Files touched: `electron/agentic-tools-ipc-handlers.cts`, `electron/preload.cts`.
- Verify: `npm run build` exits 0; from a running Electron window's devtools console,
  `window.praxisSkillInstallAPI.detectTools()` resolves `{ok: true, status: 200, data:
  [...8 rows...]}`, each row carrying a real `toolId`/`displayName`/`category`/`detection`
  matching that machine's actual installed tools (e.g., `claude-code` reads `'confirmed'`
  if the `claude` binary is genuinely on `PATH`).

**Phase 3 — Dialog chrome: markup, trigger button, tabs, scope toggle, open/close.**
Effort: medium. Dependencies: none (markup/DOM-logic only; can build in parallel with
Phases 1-2).
- Add the trigger button and dialog markup to `index.html`, with all three tab panels
  present but empty.
- Add `src/public/lib/agentic-tools-scope.ts` and a `<script>` tag for it on `index.html`,
  ahead of `home.js`.
- Add open/close/tab-switch/scope-toggle logic to `home.ts`, following
  `app.ts:378-919`'s `selectTab`/keydown/backdrop-click pattern, and the project-picker
  `<select>` population from the existing `ProjectEntry[]` list.
- Files touched: `src/public/index.html`, new `src/public/lib/agentic-tools-scope.ts`,
  `src/public/home.ts`, `src/public/tsconfig.json` (include the new file),
  `src/public/styles.css` (row-layout + button-repoint rules).
- Verify: manual browser/Electron walkthrough — "Manage integrations" opens the dialog with
  three empty tab panels; arrow keys/Home/End move focus and selection across tabs; Escape,
  backdrop click, and the close button all close it; toggling Global/Project shows/hides
  the project `<select>`, disabled with zero projects registered.

**Phase 4 — Row rendering: real detection wiring, eligibility, unverified-path notes.**
Effort: medium. Dependencies: Phase 2, Phase 3.
- On dialog open (and "Re-scan"), call `window.praxisSkillInstallAPI.detectTools()`; build
  one row per catalogue entry in its category's panel from the returned rows, each
  checkbox's disabled state and eligibility label driven by `isEligibleAtScope`, each
  detection chip reading the real `detection.confidence`.
- Render the "Not supported at [scope]" label and the "Path unverified for your OS" note
  per row, re-evaluated on every scope-toggle change.
- Files touched: `src/public/home.ts`.
- Verify: a tool actually installed on the test machine shows `'confirmed'` with a real
  resolved path; every row's eligibility label and checkbox state responds correctly when
  the Global/Project scope toggle changes.

**Phase 5 — Install action: selection state, real per-row result rendering.** Effort:
medium. Dependencies: Phase 4.
- Wire "Install selected" to read every checked, eligible row, call
  `window.praxisSkillInstallAPI.installSelected()` with each target's `toolId`, `scope`,
  and `resolveBasePathForScope`-computed `basePath`, and render each returned
  `InstallResult.status` as an install-status chip.
- Disable "Install selected" when zero eligible checkboxes are checked; clear all selection
  and rendered result chips on dialog close.
- Files touched: `src/public/home.ts`.
- Verify (**on a disposable/test machine or with a real, throwaway target tool — see Open
  Questions**): checking a row and clicking "Install selected" produces a real
  `InstallResult` (`'installed'` on first run, `'up-to-date'` on a second click with no
  change) and, inspecting the resolved target directory on disk, WS-42's placeholder/
  fixture content is genuinely present there — proving the full chain end-to-end while
  confirming, deliberately, that this is real file I/O and not a simulated result.

## Data & compatibility

No schema or migration concerns for this plan's own new code: `src/lib/
agentic-tools-fs-adapter.ts`'s addition and `electron/agentic-tools-ipc-handlers.cts`'s
fourth channel are purely additive, read-only (detection performs no writes). The one real
compatibility-shaped fact is stated in Summary and Design: this plan's own "Install
selected" wiring, once it exists, causes WS-42's already-built write engine to run for
real, creating or overwriting real files (WS-42's placeholder/fixture skill content) under
whatever directory a detected tool's catalogue entry resolves to on the machine running the
built app — `.praxis-installs.json` at the repo root (WS-42's own registry file) is created
on first real install. Rollback: delete `createNodeFsAccess`/`expandTokensImpl`
from `agentic-tools-fs-adapter.ts`
and revert `createNodeFsWriteAccess`'s `expandTokens` to its own inline copy; delete the
`detectTools` handler and preload method; delete `src/public/lib/agentic-tools-scope.ts`;
revert `index.html`, `home.ts`, `styles.css`, `src/public/tsconfig.json`. Nothing pre-
existing (`server.ts`, `src/lib/projects.ts`, WS-41's/WS-42's own files beyond the two
additive edits named above) is structurally changed, so rollback needs no data-migration
story — any real `.praxis-installs.json` or real per-tool skill files a test run already
wrote are simply left on disk, unmanaged once the code is gone, exactly as WS-42's own
rollback story already accepts.

## Testing strategy

- `createNodeFsAccess()`: `node --test` against a real temporary directory and a fixture
  `PATH` directory, extending WS-42's existing `agentic-tools-fs-adapter.test.ts`
  — the same real-I/O testing posture WS-42 Phase 6 already established for this exact
  file, for the same reason (the adapter's entire value is doing real filesystem/PATH
  operations correctly; a mocked `node:fs` would only prove the mock was called right).
- `electron/agentic-tools-ipc-handlers.cts`'s `detectTools` handler: no automated test — no
  CI exists in this repo (confirmed during WS-36/37/41/42) and an Electron-window IPC round
  trip against the real installed-tool state of a given machine is integration-level and
  manual by nature, matching WS-42's own testing posture for its equivalent handler file.
  Verified manually per Phase 2's Verify step.
- `src/public/lib/agentic-tools-scope.ts`: no automated test, per Design's own reasoning —
  verified manually via a browser/Electron devtools console call per Phase 3, matching
  `ipc-adapter.ts`'s `unwrapIpc`/`httpError` precedent in WS-37's plan.
- Everything DOM-facing (dialog open/close, tab navigation, scope toggle, row rendering,
  checkbox/install wiring): manual walkthroughs per phase's Verify step, matching WS-37's
  and WS-38's explicit "no frontend test framework" decision for this class of code.
- No test in this plan exercises a real install against a genuinely important tool
  config — see Open Questions for the real-write risk Phase 5's own Verify step already
  flags and how to test it safely.

## Open questions

1. **"Install selected" now performs real, live file writes using placeholder/fixture
   content, not a safe inert action — is that acceptable to ship as this workstream's v1?**
   Because WS-42 already built a genuine `FsWriteAccess` adapter, wiring this screen's
   install button to WS-42's real `installSelected` channel means a user (or a developer
   testing this workstream) who checks a row and clicks "Install selected" gets real files
   written into their actual `~/.cursor/rules/`, `~/.codeium/windsurf/`, or equivalent
   directory — containing WS-42's placeholder/fixture skill content, not real Praxis
   skills, since Gap 1 remains unresolved. Options: (a) ship as designed, accepting that a
   real but meaningless file lands in a real tool's config directory until Gap 1 is
   resolved elsewhere; (b) gate "Install selected" behind an explicit confirmation dialog
   naming this risk; (c) keep the button wired but visually/functionally disabled (e.g.,
   "Install (coming soon)") until a real `getInstallContent` exists. *Recommendation:* (a),
   since Context's own brief for this plan describes the screen as letting a user "install
   Praxis skills into them" without naming any gating — but this is recorded here rather
   than decided silently, since it is a real, user-visible filesystem side effect a
   confirmed decision should own.
2. **Trigger button exact copy and masthead placement.** This plan's default ("Manage
   integrations" in `index.html`'s masthead) is a reasonable reading, not a confirmed
   decision — a one-line change if different wording or placement is wanted.
3. **A fourth instance of the "pure logic needs a classic-script home" duplication pattern
   has now appeared** (`ipc-adapter.ts`, WS-42's two browser siblings, and this plan's
   `agentic-tools-scope.ts`), though this plan avoided doubling it into a fifth by not also
   keeping a Node-tested `src/lib/` twin. *Recommendation:* worth a future, explicitly
   -scoped workstream considering a lighter-weight shared mechanism across all instances —
   not undertaken here, since it would mean touching WS-37's and WS-42's already-fixed
   files.
4. **This note about the general duplication trade-off (Open Question 3 above) is
   unaffected by the Tauri-to-Electron pivot** — it was true of the discarded Tauri plan and
   remains true here, carried forward rather than re-litigated, per Context's own
   instruction.

## Alternatives considered and rejected

- **A new third `contextBridge` global (`window.praxisAgenticToolsDetectAPI` or similar)
  for `detectTools` alone**, instead of extending WS-42's `window.praxisSkillInstallAPI`.
  Rejected: detection and install are a read/write split on the *same* resource (the four
  catalogued tools), unlike WS-37 vs. WS-42's split, which separates two genuinely
  different resources (projects vs. tool installs). A third global would grow this app's
  total `contextBridge` surface to three for what this plan's own screen treats as one
  concern; extending WS-42's existing global keeps it at two.
- **Folding `detectTools` into WS-37's `window.praxisAPI`.** Rejected outright — that
  object is WS-37's own project-CRUD surface, unrelated to agentic-tools detection; WS-42
  already established (and this plan follows) the precedent that agentic-tools concerns get
  their own global(s), separate from project CRUD.
- **Computing `resolveBasePathForScope`/`isEligibleAtScope` once in the main process and
  returning the result as part of the `detectTools` response**, instead of a renderer-side
  classic script. Rejected: eligibility and the resolved base path both depend on which
  scope (`Global`/`Project`) the user currently has toggled — a UI-only, frequently-changing
  input the main process has no way to know about without either a second IPC channel per
  toggle change or re-running `detectTools` on every toggle. Keeping this small, pure
  computation client-side avoids both, and Context's own instruction to keep `detectTools`
  a single read-only sweep argues against adding a second channel just to re-evaluate
  scope.
- **A `src/lib/` Node-tested "canonical" copy of `resolveBasePathForScope`/
  `isEligibleAtScope` plus a browser duplicate**, mirroring WS-42's `agentic-tools-content.ts`/
  `agentic-tools-install.ts` split a third time. Rejected: that split exists because a real
  second, Node-only-API-using consumer needs a working implementation on each side; nothing
  in the main process ever calls this function (WS-42's `installSelected` already receives
  a pre-resolved `basePath` from its caller), so a `src/lib/` copy would exist purely to be
  unit-tested — test-only duplication, not the platform-forced duplication WS-42 accepted.
- **A third HTML entry point (`onboarding.html`).** Rejected per the same reasoning the
  discarded Tauri plan already gave, unaffected by the pivot: a dedicated page needs its
  own routing/back-navigation for what is a one-off utility screen, and the single "Manage
  integrations" button on `index.html` already satisfies reachability without a settings
  area this workstream was never asked to build.
- **Auto-popping the modal on first launch.** Rejected, unaffected by the pivot:
  `home.ts`'s existing "No projects yet" empty state is manual, not auto-triggering, and is
  the one existing first-run precedent in this app; a forced-open modal would be the first
  exception to it.
- **A hover-only tooltip for "not supported at this scope."** Rejected, unaffected by the
  pivot: no existing convention in this app discloses primary information via hover-only
  `title` text, and it would also fail on touch devices.

### Final summary

Chosen approach: build the missing read-side `FsAccess` adapter
(`createNodeFsAccess()`, in WS-42's existing `agentic-tools-fs-adapter.ts`) and one new,
single `detectTools` IPC channel (in WS-42's existing `agentic-tools-ipc-handlers.cts`,
exposed as a fourth method on WS-42's existing `window.praxisSkillInstallAPI` global — no
new `contextBridge` global), then wire the already-designed `<dialog>` UI to it and to
WS-42's already-built `installSelected`, with the one small piece of pure eligibility logic
(`resolveBasePathForScope`/`isEligibleAtScope`) ported to a single classic-script file
rather than duplicated into a Node-tested-plus-browser pair. Five phases, small-to-medium
effort each, the first two fully verifiable from a devtools console before any dialog
markup exists. Top risk: this plan makes "Install selected" perform genuine file writes
using WS-42's placeholder/fixture content into a real tool's real config directory, which
was never true under the Tauri-blocked version of this screen — flagged as Open Question 1
rather than decided silently. Other open questions needing your answer: whether to gate the
install action given that new risk (Open Question 1), and the low-stakes trigger-button
copy/placement question (Open Question 2) — the recurring classic-script-duplication note
(Open Question 3) is carried forward unchanged from the discarded Tauri plan and needs no
new decision from this pivot.

---
id: PLN-32-m51bp8
type: plan
workstream: WS-42-7fm9ak
slug: skill-install-sync-engine
title: "Write, format, track, and expose over IPC the Praxis skill install engine, on Electron"
status: done
created: 2026-08-17
updated: 2026-08-19
depends_on: []
links: []
---

## Summary

This plan builds the write/format/track engine that turns a WS-41 detection result (a tool
and its known integration format) into an actual write of the Praxis skill integration at
that target, in the target's native format, plus a durable record of what was written so a
later run can update or remove it — then wires that engine into Electron's main process and
exposes it to the renderer (WS-43's UI) over IPC. This plan **replaces** an earlier
Tauri-targeted plan at this same path, reusing the same plan ID since it revises the same
artefact rather than creating a new one; the earlier Tauri-specific content (a capability
file, a scope-grant command, an `@tauri-apps/plugin-fs`-not-resolvable rejection reason) is
fully superseded, not merged.

The engine's real behavior — content formatting per target-format kind, and install-state
bookkeeping — stays pure, `src/lib/`-resident, and fully `node --test`-testable, continuing
WS-41's own data-driven, port-injected shape exactly (`FsWriteAccess`, the write-side sibling
of WS-41's `FsAccess`; `getInstallContent`, the still-open Gap 1 seam). What changes under
Electron: the concrete `FsWriteAccess` adapter, previously blocked on a Tauri capability
system that doesn't exist yet, is buildable today as plain `fs.promises` calls — so it
becomes a real phase in this plan, not an open question. And because Electron's main process
*is* Node, this workstream's own new IPC channels (`installSelected`, `getInstallStatus`,
`removeInstallation`) call the `src/lib/agentic-tools-install.ts` functions directly,
in-process, through a new `electron/agentic-tools-ipc-handlers.cts` — no loopback HTTP relay,
because (unlike WS-37's six project-CRUD channels) none of this workstream's logic has any
prior existence in `src/server.ts` for a relay to reuse.

## Scope

### Acceptance criteria

1. A pure `formatForTarget(format, content)` function exists that turns an `InstallContent`
   payload into a list of relative-path/content file writes, correctly for every
   `IntegrationFormat.kind` WS-41's catalogue actually uses for the four tools
   (`skill-directory`, `rule-directory`, `single-rule-file`) — and
   throws (never silently no-ops) if ever called with `kind: 'mcp-json'`, since Gap 2 commits
   that kind out of this engine's install flow entirely.
2. `selectPrimaryFormat(tool)` returns the first non-`mcp-json` entry in a `ToolDefinition`'s
   `integrationFormats`, or `null` if none exists — proving by test that Cursor and Windsurf,
   which both carry an `mcp-json` entry alongside a rules entry per WS-41's catalogue, always
   resolve to their rules format.
3. `installToTarget(target, content, registryPath, deps)` writes the formatted files through
   an injected `FsWriteAccess` port, using the same atomic tmp-file-then-rename pattern as
   `src/lib/projects.ts`'s `writeProjects` (`src/lib/projects.ts:42-47`) for every file it
   writes, and returns an `InstallResult` recording what was written and at what resolved path.
4. A second `installToTarget` call with byte-identical `InstallContent` is a no-op against the
   filesystem (`FsWriteAccess.writeTextFileAtomic` is not called again) and returns
   `status: 'up-to-date'`, proven by a test asserting zero write calls on the fake port's
   second invocation.
5. A third call with changed `InstallContent` overwrites the previously written files and
   updates the tracking record's `updatedAt`/content hash, proven by test.
6. `removeInstallation(toolId, scope, registryPath, deps)` deletes the previously written
   file(s)/directory for that `(toolId, scope)` pair and removes its tracking record, proven
   by test.
7. `installAllGlobal(catalogue, deps)` runs every catalogue tool at global scope and returns
   one `InstallResult` per tool, proven by test.
8. An install-tracking registry module (`agentic-tools-install-tracking.ts`) exposes pure
   `parseInstallRegistry`/`serializeInstallRegistry`/`upsertInstallRecord`/`findInstallRecord`/
   `removeInstallRecord` functions operating on an `InstallRecord[]` in memory, with the exact
   fields Context specifies (`toolId`, `resolvedPath`, `format`, `scope`, `installedAt`,
   `updatedAt`, a required content hash/version) — proven by a round-trip test.
9. A concrete `FsWriteAccess` implementation (`createNodeFsWriteAccess()`) exists, built on
   `node:fs/promises`, implementing every port method (`readTextFile`, `writeTextFileAtomic`,
   `mkdir`, `remove`, `expandTokens`) for real — proven by tests against a real temporary
   directory (see Open questions for the one design point this raises), not only by the fake
   used in the pure-logic tests above.
10. Three `ipcMain.handle` channels — `installSelected`, `getInstallStatus`,
    `removeInstallation` — exist in `electron/agentic-tools-ipc-handlers.cts`, registered from
    `main.cts`, each calling `src/lib/agentic-tools-install.ts`'s functions directly with the
    concrete `FsWriteAccess` from criterion 9 — no loopback HTTP request anywhere in this
    workstream's own code.
11. `electron/preload.cts` exposes a second `contextBridge.exposeInMainWorld` global,
    `window.praxisSkillInstallAPI`, with one method per channel from criterion 10, each
    returning a `Promise` of a structured `PraxisIpcResult<T>` (WS-37's own shape, mirrored
    here per this workstream's own copy, matching how WS-37 itself mirrors that shape across
    the preload boundary).
12. From a running Electron window built on WS-36+WS-37's scaffold, an ad-hoc
    `window.praxisSkillInstallAPI.getInstallStatus()` call from the devtools console resolves
    with `{ok: true, status: 200, data: []}` against a fresh checkout (empty registry) —
    proving the full chain (renderer → preload → IPC → `src/lib` engine → concrete adapter →
    real `.praxis-installs.json`) is wired end-to-end, even though no real skill content
    exists yet (see Assumptions).
13. Every test in this workstream's `src/lib/agentic-tools-*.test.ts` files runs against an
    in-memory fake `FsWriteAccess` and a fixture `getInstallContent`, except the concrete
    adapter's own tests (criterion 9), which run against a real temp directory — no test in
    this workstream touches a real detected tool's actual config directory.
14. `npm run build` (root `tsconfig.json`, which already includes `src/lib/**/*.ts` with zero
    config change needed, plus the `electron/tsconfig.json` WS-36/WS-37 establish) compiles
    every new file with zero errors.

### Out of scope

- **Any concrete implementation of `getInstallContent`.** Stays a port with only
  fixture/placeholder implementations, in both this workstream's tests and its real IPC
  wiring (criterion 12 above proves the *plumbing*, not real content flowing through it).
  Gap 1 — the actual Praxis skill content has no copy anywhere in this repo — is unchanged by
  this pivot and still applies exactly as before; see Open questions.
- **Any onboarding, settings, or "which targets to install into" UI.** WS-43-4cpdch's job;
  this plan's IPC methods are called by that UI, never render one.
- **A concrete `FsAccess` (detection-side, read-only) adapter**, i.e. wiring WS-41's own
  `detectTool`/`detectAllTools` to a real filesystem/PATH implementation. WS-41's plan names
  WS-42 as the workstream that does this, but Context (this plan's brief) scopes this pivot to
  the write-side `FsWriteAccess` adapter specifically and does not ask for the read side —
  building it here would be scope creep beyond what Context requests. See Open questions for
  the resulting handoff gap this leaves for whichever workstream resolves a real `basePath` at
  runtime.
- **Deleting files for skills that existed in a previous `InstallContent` version but are
  absent from the current one ("pruning" on update).** `installToTarget` overwrites/creates
  exactly what the current `InstallContent` produces and nothing more.
- **Per-skill install tracking or partial per-skill enable/disable.** One `InstallRecord` per
  `(toolId, scope)` pair, matching Context's given record shape.
- **Windows registry-based writes, elevated/admin-permission installs, or any install location
  requiring privileges beyond the current OS user's own file permissions.** No tool in WS-41's
  catalogue needs this.
- **Any Tauri-backed adapter design, capability file, or scope-grant command.** These do not
  exist under Electron and are not designed, referenced, or left as placeholders anywhere in
  this plan.

### Assumptions

1. **No production data, live users, or migration/rollback constraints apply.** This
   workstream's `src/lib/` code is net-new and unwired into the shipped app's UI until WS-43
   lands (criterion 12's manual devtools check is the only "real" execution path this plan
   itself exercises). Standard per-run deployment question, answered here as "none apply";
   recorded under Open questions per process.
2. **Praxis skill ids are, and remain, `prx-`-prefixed** (`prx-orchestrate`, `prx-plan-feature`,
   etc.). This plan relies on that prefix for namespacing writes inside a shared directory
   without inventing a separate collision-avoidance scheme. Unaffected by the platform pivot.
3. **`installToTarget`/`installSelected` receive an already-resolved base path**, not a raw
   `ToolDefinition`/OS pair. The caller (eventually WS-43's UI, via whatever mechanism it uses
   to get a `DetectionResult.resolvedConfigDir`) resolves this; this plan's engine only ever
   joins that base path with a format's `pathTemplate`. This plan does not itself decide which
   candidate global path is "the" configDir and does not read `process.platform` internally,
   matching WS-41's own `os`-as-parameter convention. A real ambiguity this uncovers in WS-41's
   `pathTemplate` contract (global-relative vs. project-relative templates are not currently
   distinguished) is carried forward as an open question, unaffected by the pivot.
4. **New files live flat under `src/lib/`**, named
   `agentic-tools-{content,format,install,install-tracking,fs-adapter}.ts`, continuing WS-41's
   own flat `agentic-tools-*.ts` convention in the same directory — confirmed against
   `tsconfig.json`'s existing `"src/lib/**/*.ts"` include, unchanged, zero config edit needed.
5. **The install-tracking file is `.praxis-installs.json`, at the repo root — the SAME
   location convention `.praxis-projects.json` actually uses today**, not `$APPDATA`. Read
   directly from `src/lib/projects.ts:10-15`: `registryPath` is computed as two directories up
   from the compiled module's own `__dirname` (`dist/lib/projects.js` → `dist/lib` → `dist` →
   repo root), and neither WS-36's nor WS-37's revised plans touch `src/lib/projects.ts` or
   relocate that file — confirmed by reading both plans in full (WS-37's Data & compatibility
   section states `server.ts`/`src/lib/*` are untouched). The earlier Tauri-targeted version of
   this plan incorrectly claimed a `$APPDATA` relocation that was never real; this plan corrects
   that and applies the same two-levels-up computation to the new registry file, since
   `dist/lib/` and `dist/electron/` are siblings at the same depth under `dist/`, so the
   identical `path.join(__dirname, '..', '..')` pattern resolves to the repo root from either
   location.
6. **One `getInstallContent(toolId)` call is assumed cheap enough to call once per target per
   sync run** (no caching layer inside this engine).
7. **This workstream's IPC channels call `src/lib/agentic-tools-install.ts` directly,
   in-process — no loopback HTTP relay, unlike WS-37's six channels.** WS-37's relay pattern
   exists specifically because `server.ts`'s six project-CRUD routes already existed as
   private functions writing to `res`; nothing in `server.ts` currently calls, or has ever
   called, any function this workstream builds, so there is no pre-existing server-side logic
   for a relay to reuse. Confirmed by reading WS-37's revised plan in full and by inspecting
   `src/server.ts`'s route table, which has no install/sync-related route.
8. **`electron/preload.cts` exposes this workstream's three methods under a second, distinct
   global (`window.praxisSkillInstallAPI`), not by adding methods to WS-37's existing
   `window.praxisAPI` object.** See Design and Alternatives for the reasoning (decoupling two
   unrelated concerns — project CRUD vs. skill installs — that would otherwise both need to
   agree on one shared object literal's shape).
9. **The real IPC wiring (criterion 12) uses the same placeholder/fixture `getInstallContent`
   implementation as this workstream's own tests**, since Gap 1 is unresolved. This is a
   stated, visible limitation of what "wired end-to-end" means here — the plumbing works; the
   content flowing through it is not yet real. Not hidden or glossed over: recorded again
   under Open questions.

## Design

### Where this fits

Continues WS-41's `src/lib/agentic-tools-*.ts` family (`catalogue.ts`, `signals.ts`,
`detect.ts`) with five new sibling modules, each with a `*.test.ts` sibling per this repo's
`node --test` convention (`src/lib/extract.test.ts` is the live precedent), plus one new
Electron main-process file:

- `src/lib/agentic-tools-content.ts` — `SkillContent`, `InstallContent` types, the
  `GetInstallContent` port type, and `hashInstallContent()`.
- `src/lib/agentic-tools-format.ts` — pure per-`IntegrationFormat.kind` formatters,
  `formatForTarget()`, and `selectPrimaryFormat()`.
- `src/lib/agentic-tools-install-tracking.ts` — the install-state registry's pure
  parse/serialize/upsert/find/remove functions and the `InstallRecord` type.
- `src/lib/agentic-tools-install.ts` — the `FsWriteAccess` port, and the orchestration
  functions (`installToTarget`, `removeInstallation`, `installAllGlobal`) that tie formatting,
  writing, and tracking together.
- `src/lib/agentic-tools-fs-adapter.ts` — **new in this pivot.** `createNodeFsWriteAccess()`,
  a concrete `FsWriteAccess` built on `node:fs/promises`. Plain Node code, not
  Electron-specific — it works identically whether called from `node --test` or from
  Electron's main process, exactly like WS-41's own `os`-as-parameter reasoning: no bundler
  obstacle, no capability grant, nothing Electron-only about it.
- `electron/agentic-tools-ipc-handlers.cts` — **new in this pivot.** Registers this
  workstream's three `ipcMain.handle` channels, wiring them to `agentic-tools-install.ts`'s
  functions with `createNodeFsWriteAccess()` and the repo-root `registryPath` (Assumption 5).

All `src/lib/` modules import `ToolDefinition`, `IntegrationFormat`, `DetectionResult`, and
`OS` from WS-41's `agentic-tools-catalogue.ts`/`agentic-tools-signals.ts` rather than
redefining them.

### Contracts — pure engine (unchanged in shape from the discarded Tauri plan)

```ts
// agentic-tools-content.ts
interface SkillContent {
  id: string;                 // e.g. 'prx-orchestrate' — assumed prx-prefixed
  name: string;
  description: string;
  body: string;                // the skill's markdown content
  files?: { relativePath: string; content: string }[];
}

interface InstallContent {
  version: string;             // caller-supplied content identity, informational only
  skills: SkillContent[];
}

// The Gap 1 seam — still open. Implemented for real only once the not-yet-created
// content-vendoring workstream exists; this workstream uses only fixture/placeholder
// implementations, in tests AND in the real IPC wiring (Assumption 9).
type GetInstallContent = (toolId: string) => Promise<InstallContent>;

function hashInstallContent(content: InstallContent): string;
// SHA-256 (node:crypto, matching src/lib/projects.ts's crypto.createHash precedent) over a
// canonical JSON encoding of `skills`, sorted by `id`, so field order never changes the hash.
```

```ts
// agentic-tools-format.ts
interface FileWrite { relativePath: string; content: string; }

function selectPrimaryFormat(tool: ToolDefinition): IntegrationFormat | null;
// First integrationFormats entry whose kind !== 'mcp-json'.

function formatForTarget(format: IntegrationFormat, content: InstallContent): FileWrite[];
// Throws if format.kind === 'mcp-json'.
// 'skill-directory'        -> one FileWrite per skill at `<pathTemplate with <name>
//                              substituted>/SKILL.md`, plus one per skill.files entry.
// 'rule-directory'         -> one FileWrite per skill, body only.
// 'single-rule-file' |
// 'markdown-context-file'  -> one FileWrite: all skills concatenated under one document.
```

```ts
// agentic-tools-install-tracking.ts
type InstallScope = { kind: 'global' } | { kind: 'project'; projectPath: string };

interface InstallRecord {
  toolId: string;
  resolvedPath: string;
  format: IntegrationFormat['kind'];
  scope: InstallScope;
  installedAt: string;         // ISO date, set once
  updatedAt: string;           // ISO date, bumped on every content change
  contentHash: string;         // hashInstallContent() output — required
}

function parseInstallRegistry(raw: string): InstallRecord[];   // [] on parse failure
function serializeInstallRegistry(records: InstallRecord[]): string;
function upsertInstallRecord(records: InstallRecord[], record: InstallRecord): InstallRecord[];
function findInstallRecord(records: InstallRecord[], toolId: string, scope: InstallScope): InstallRecord | undefined;
function removeInstallRecord(records: InstallRecord[], toolId: string, scope: InstallScope): InstallRecord[];
```

```ts
// agentic-tools-install.ts
interface FsWriteAccess {
  readTextFile(path: string): Promise<string | null>;   // null if it doesn't exist, never throws on ENOENT
  writeTextFileAtomic(path: string, content: string): Promise<void>; // sibling tmp file, then rename
  mkdir(path: string): Promise<void>;                    // recursive, idempotent
  remove(path: string): Promise<void>;                   // file or directory; idempotent
  expandTokens(path: string): Promise<string>;            // '~'/'%VAR%' resolution
}

interface InstallTarget { tool: ToolDefinition; basePath: string; scope: InstallScope; }
type InstallStatus = 'installed' | 'updated' | 'up-to-date' | 'skipped-no-format';
interface InstallResult { toolId: string; status: InstallStatus; resolvedPath: string | null; }

function installToTarget(target: InstallTarget, content: InstallContent, registryPath: string, deps: { fsWrite: FsWriteAccess }): Promise<InstallResult>;
function removeInstallation(toolId: string, scope: InstallScope, registryPath: string, deps: { fsWrite: FsWriteAccess }): Promise<void>;
function installAllGlobal(catalogue: ToolDefinition[], resolveGlobalBasePath: (tool: ToolDefinition) => string, registryPath: string, deps: { fsWrite: FsWriteAccess; getInstallContent: GetInstallContent }): Promise<InstallResult[]>;
```

### New in this pivot — the concrete `FsWriteAccess` adapter

```ts
// agentic-tools-fs-adapter.ts
import fs from 'node:fs/promises';
import os from 'node:os';

function createNodeFsWriteAccess(): FsWriteAccess {
  return {
    async readTextFile(path) {
      try { return await fs.readFile(path, 'utf8'); }
      catch (err) { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null; throw err; }
    },
    async writeTextFileAtomic(path, content) {
      const tmpPath = `${path}.${process.pid}.tmp`;
      await fs.writeFile(tmpPath, content);
      await fs.rename(tmpPath, path);
      // Same reasoning as src/lib/projects.ts:42-47's writeProjects: a sibling tmp file
      // (not one under the OS temp dir) keeps fs.rename atomic and same-filesystem.
    },
    async mkdir(path) { await fs.mkdir(path, { recursive: true }); },
    async remove(path) { await fs.rm(path, { recursive: true, force: true }); }, // force: idempotent on already-absent paths
    async expandTokens(path) {
      let out = path.startsWith('~') ? path.replace('~', os.homedir()) : path;
      out = out.replace(/%([^%]+)%/g, (whole, name) => process.env[name] ?? whole); // Windows %VAR% tokens
      return out;
    },
  };
}
```

This is a direct, literal implementation of WS-41's own `FsAccess.expandTokens` shape and
`src/lib/projects.ts`'s atomic-write pattern generalized from one fixed `registryPath` to any
caller-supplied path — nothing new is invented, only reused and generalized. `mkdir`'s
`recursive: true` and `remove`'s `force: true` are what make both idempotent, satisfying the
port's documented "idempotent" contract for real.

### New in this pivot — the IPC surface

```ts
// electron/agentic-tools-ipc-handlers.cts
interface InstallTargetRequest { toolId: string; basePath: string; scope: InstallScope; }

// PraxisIpcResult<T> — WS-37's own shape (electron/ipc-handlers.cts, mirrored again here,
// exactly as WS-37 itself mirrors it a second time into src/public/ipc-adapter.ts — a
// third mirror of an already-twice-mirrored shape is this codebase's own established
// pattern for crossing the IPC boundary, not a new one).
type PraxisIpcResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string };

function registerAgenticToolsIpcHandlers(): void {
  const fsWrite = createNodeFsWriteAccess();
  const registryPath = path.join(repoRoot, '.praxis-installs.json'); // same two-levels-up computation as src/lib/projects.ts

  ipcMain.handle('installSelected', async (_event, targets: InstallTargetRequest[]): Promise<PraxisIpcResult<InstallResult[]>> => {
    // Look up each target's ToolDefinition in WS-41's TOOL_CATALOGUE by toolId; resolve
    // InstallContent via the placeholder getInstallContent (Assumption 9); call
    // installToTarget per target; collect results. A toolId not found in the catalogue
    // produces one failed InstallResult for that entry, not an aborted batch.
  });
  ipcMain.handle('getInstallStatus', async (): Promise<PraxisIpcResult<InstallRecord[]>> => {
    // Read registryPath via fsWrite, parseInstallRegistry, return the array.
  });
  ipcMain.handle('removeInstallation', async (_event, toolId: string, scope: InstallScope): Promise<PraxisIpcResult<void>> => {
    // Direct call to agentic-tools-install.ts's removeInstallation.
  });
}
```

Registered from `main.cts` alongside WS-37's own `registerIpcHandlers()` call, in the same
"after readiness, before `loadURL`" sequencing WS-37 already establishes — so
`window.praxisSkillInstallAPI` exists before any renderer script that might call it on load.
`electron/tsconfig.json`'s `include` array gains this one new file (WS-36/WS-37 already
established that file; no new tsconfig).

### `preload.cts`'s second global

```ts
contextBridge.exposeInMainWorld('praxisSkillInstallAPI', {
  installSelected: (targets: InstallTargetRequest[]) => ipcRenderer.invoke('installSelected', targets),
  getInstallStatus: () => ipcRenderer.invoke('getInstallStatus'),
  removeInstallation: (toolId: string, scope: InstallScope) => ipcRenderer.invoke('removeInstallation', toolId, scope),
});
```

Added as a second `contextBridge.exposeInMainWorld` call in the same `preload.cts` file
WS-37 already populates with its own `praxisAPI` call — two calls, two distinct global names,
one file. See Alternatives for why this is a second global rather than three more methods
bolted onto WS-37's `praxisAPI` object.

### What each module knows / must not know

- `agentic-tools-content.ts` knows the shape of installable content and how to hash it. Must
  not know about any specific tool, format kind, or filesystem path.
- `agentic-tools-format.ts` knows how to turn content into target-shaped file writes for a
  given format kind. Must not know how those writes reach disk, or which tool a format
  belongs to.
- `agentic-tools-install-tracking.ts` knows the registry's record shape and how to
  parse/serialize/upsert it in memory. Must not know how the registry file reaches disk.
- `agentic-tools-install.ts` knows all of the above plus the `FsWriteAccess` port; the
  orchestration layer, direct analog of WS-41's own `agentic-tools-detect.ts`. Must not know
  `node:fs` or any concrete adapter directly — those live entirely behind `FsWriteAccess`.
- `agentic-tools-fs-adapter.ts` knows how to translate the `FsWriteAccess` port's methods into
  real `node:fs/promises` calls and token expansion. Must not know about tools, formats,
  installs, or IPC — a generic file-write utility, reusable by anything that needs the port.
- `electron/agentic-tools-ipc-handlers.cts` knows how to map an IPC call into a call against
  `agentic-tools-install.ts`'s public functions, and owns the `registryPath`
  constant/`createNodeFsWriteAccess()` wiring. Must not know per-tool format details itself
  (delegates entirely to `agentic-tools-install.ts`) and must not call `node:fs` directly
  (goes through the adapter, keeping the IPC layer thin — matching WS-37's own "handler is
  thin, logic lives one layer down" shape).

## Staged task breakdown

Six phases. The first four build the pure engine (unchanged in spirit from the discarded
Tauri plan, corrected for the registry-location fact and stripped of Tauri references); the
last two are new to this pivot — a real filesystem adapter, then the Electron wiring that
makes the whole engine reachable from a renderer.

**Phase 1 — Content/format contracts, `skill-directory` kind, Claude Code end-to-end
install.** (medium)
1. Define `SkillContent`, `InstallContent`, `GetInstallContent`, `hashInstallContent`. File:
   `agentic-tools-content.ts`. Effort: small. Depends on: nothing. Verify: `node --test` — same
   `skills` array in different property order hashes identically.
2. Define `FileWrite`, `selectPrimaryFormat`, and the `skill-directory` formatter. File:
   `agentic-tools-format.ts`. Effort: small. Depends on: task 1. Verify: `node --test` against
   a two-skill fixture, one `SKILL.md` FileWrite per skill plus each skill's `files[]` entries.
3. Define `FsWriteAccess`, `InstallTarget`, `InstallResult`, `installToTarget` for the
   `skill-directory` case only (no tracking yet — Phase 3). File: `agentic-tools-install.ts`.
   Effort: medium. Depends on: task 2. Verify: `node --test` — a fake `FsWriteAccess` records
   every `writeTextFileAtomic` call; the Claude Code catalogue entry (from WS-41) with a
   two-skill fixture produces exactly the expected writes at exactly the expected paths.

**Phase 2 — `rule-directory`/`single-rule-file` kinds, `mcp-json` exclusion proof.** (medium)
1. Implement the `rule-directory` and `single-rule-file`/`markdown-context-file` formatters.
   File: `agentic-tools-format.ts`. Effort: medium. Depends on: Phase 1.
2. Test `selectPrimaryFormat` against Cursor's and Windsurf's real WS-41 catalogue entries
   (each carrying a rules format and an `mcp-json` entry), asserting the rules format always
   wins and `formatForTarget` throws on `mcp-json` directly. File:
   `agentic-tools-format.test.ts`. Effort: small. Depends on: task 1.
3. `installToTarget` test against Cursor (global, rule-directory). File:
   `agentic-tools-install.test.ts`. Effort: small.
   Depends on: task 1, Phase 1 task 3.

**Phase 3 — Install-state tracking, update/no-op/uninstall semantics.** (medium)
1. Implement `InstallRecord` and the five pure registry functions. File:
   `agentic-tools-install-tracking.ts`. Effort: small. Depends on: nothing. Verify:
   `node --test` — parse/serialize round trip; `upsertInstallRecord` replaces rather than
   duplicates.
2. Wire tracking into `installToTarget`: read the registry via `deps.fsWrite`, compare
   `hashInstallContent(content)` against any existing record, skip writes and return
   `'up-to-date'` on a match, otherwise write and `upsertInstallRecord` + persist. Implement
   `removeInstallation`. File: `agentic-tools-install.ts`. Effort: medium. Depends on: task 1,
   Phase 1 task 3.
3. Tests proving acceptance criteria 4-6 directly. File: `agentic-tools-install.test.ts`.
   Effort: small. Depends on: task 2.

**Phase 4 — Full-catalogue global-run orchestration.** (small-medium)
1. Implement `installAllGlobal`, calling `resolveGlobalBasePath` per tool. File:
   `agentic-tools-install.ts`. Effort: small. Depends on: Phase 3.
2. A full four-tool integration test: fixture `resolveGlobalBasePath` returning a path for
   all four tools, a fixture `getInstallContent`, an in-memory
   `FsWriteAccess` — one `InstallResult` per tool, no `mcp-json` ever reached. File:
   `agentic-tools-install.test.ts`. Effort: medium. Depends on: task 1, every prior phase's
   formatter.

**Phase 5 — Concrete `FsWriteAccess` adapter (new — was blocked under Tauri, unblocked
here).** (medium)
1. Implement `createNodeFsWriteAccess()` per Design. File: `agentic-tools-fs-adapter.ts`.
   Effort: medium. Depends on: nothing (a standalone adapter; no dependency on Phases 1-4's
   ports beyond the `FsWriteAccess` type they already define).
2. Tests against a real temporary directory (`fs.mkdtemp(path.join(os.tmpdir(), ...))`,
   cleaned up after each test): `writeTextFileAtomic` produces the exact content and leaves no
   stray tmp file; `remove` is a no-op (does not throw) on an already-absent path; `mkdir` is
   idempotent on an already-existing directory; `expandTokens` resolves `~` against
   `os.homedir()` and a `%VAR%` token against a `process.env` value set for the test. File:
   `agentic-tools-fs-adapter.test.ts`. Effort: medium (real I/O setup/teardown is the fiddly
   part). Depends on: task 1. See Open questions for the real-temp-dir-vs-mocked design point
   this phase settles by choosing real I/O.

**Phase 6 — Electron IPC wiring.** (medium)
1. Implement `electron/agentic-tools-ipc-handlers.cts`'s `registerAgenticToolsIpcHandlers()`
   per Design, importing `TOOL_CATALOGUE` (WS-41) and `agentic-tools-install.ts`'s functions,
   using `createNodeFsWriteAccess()` (Phase 5) and a placeholder `getInstallContent`
   (Assumption 9). File: new `electron/agentic-tools-ipc-handlers.cts`. Effort: medium.
   Depends on: Phase 4, Phase 5, and WS-36+WS-37 shipped (`main.cts`, `preload.cts`,
   `electron/tsconfig.json` in place).
2. Wire `main.cts` to call `registerAgenticToolsIpcHandlers()` once, alongside WS-37's own
   registration call. Add the new file to `electron/tsconfig.json`'s `include` array. Files:
   `electron/main.cts`, `electron/tsconfig.json`. Effort: small. Depends on: task 1.
3. Extend `electron/preload.cts` with the second `contextBridge.exposeInMainWorld` call
   (`window.praxisSkillInstallAPI`) per Design. File: `electron/preload.cts`. Effort: small.
   Depends on: task 1.
4. Manual verification (criterion 12): from the running Electron window's devtools console on
   a fresh checkout, `window.praxisSkillInstallAPI.getInstallStatus()` resolves
   `{ok: true, status: 200, data: []}`; `window.praxisSkillInstallAPI.removeInstallation('claude-code', {kind:'global'})`
   against a nonexistent record resolves without throwing (idempotent remove, per the
   adapter's own contract). Effort: small. Depends on: tasks 1-3.

All six phases are sequential in the order above (each depends only on earlier phases,
matching a solo, sequential plan); Phase 5 has no dependency on Phases 1-4 beyond the shared
`FsWriteAccess` type and could technically run in parallel with them, but is sequenced last
among the "pure engine" phases since it has no urgency until Phase 6 needs it.

## Data & compatibility

No migrations against existing data: `.praxis-installs.json` is a brand-new file with no
prior format. It lives at the repo root, following `.praxis-projects.json`'s actual current
location and its atomic tmp-file-then-rename write pattern (`src/lib/projects.ts:10-15,42-47`)
— corrected from the discarded Tauri plan's incorrect `$APPDATA` claim (Assumption 5). All new
`src/lib/` modules are purely additive; nothing in `src/server.ts` or any pre-existing
`src/lib/*.ts` file imports them. `electron/main.cts` and `electron/preload.cts` (WS-36/WS-37
artefacts) each gain a small, additive edit — one new registration call, one new
`contextBridge.exposeInMainWorld` call — neither removes or changes WS-37's own six channels
or its `praxisAPI` global.

**Rollback:** delete `src/lib/agentic-tools-{content,format,install,install-tracking,
fs-adapter}.ts` and their `*.test.ts` siblings; delete `electron/agentic-tools-ipc-handlers.cts`;
revert `main.cts`'s one added registration call, `preload.cts`'s one added
`contextBridge.exposeInMainWorld` call, and `electron/tsconfig.json`'s `include` entry.
Nothing pre-existing was structurally changed, so rollback is a plain deletion/revert with no
data or migration story — any `.praxis-installs.json` already written by a real run is simply
left on disk, unread by anything once the code is gone.

## Testing strategy

Every module gets `node --test` coverage, following `src/lib/extract.test.ts`'s pattern (run
via `node --test dist/lib/*.test.js` after `npm run build`):

- `agentic-tools-content.ts`: hash stability under key/property reordering; hash changes when
  any skill's `body` changes.
- `agentic-tools-format.ts`: one test per format kind, including the `mcp-json`-throws case.
- `agentic-tools-install-tracking.ts`: parse/serialize round trip; upsert replaces rather than
  duplicates; corrupted-file parse returns `[]`.
- `agentic-tools-install.ts`: the full install/no-op/update/remove lifecycle per target
  (Phase 3), plus the full-catalogue global run (Phase 4) — both against the in-memory
  fake `FsWriteAccess`.
- `agentic-tools-fs-adapter.ts` (**new**): the only test file in this workstream exercising
  real I/O, against a real temp directory created and torn down per test — see Open questions
  for why this departs from every other module's fake-based approach.
- `electron/agentic-tools-ipc-handlers.cts`: no automated test (no CI exists in this repo —
  `.github/workflows` does not exist, confirmed during WS-36/WS-37 — and Electron-window IPC
  round trips are integration-level and manual by nature, matching WS-37's own testing
  posture for its equivalent handler file). Verified manually per Phase 6 task 4.

No integration test against a real detected tool's actual config directory is in scope — that
needs the still-undesigned read-side `FsAccess` adapter (Open questions) and real content
(Gap 1), neither of which this workstream builds.

## Open questions

1. **Content-source gap (Gap 1) is real and unresolved by this plan, as directed by Context.**
   This repository has no copy of the actual Praxis skill content anywhere; `getInstallContent`
   is fully specified and tested/wired against fixtures/placeholders only. *Recommendation:*
   create a new, separate workstream — suggested name **"vendor Praxis skill content into the
   repo"** — to copy a canonical version of `~/.claude/skills/prx-*` into this repo and wire it
   into the build. Not created here.

2. **Should the concrete `FsWriteAccess` adapter's tests (Phase 5) run against a real temporary
   directory, or purely mocked `node:fs` calls?** This plan recommends and designs for real I/O
   (a real `fs.mkdtemp`-created directory, cleaned up per test) because the adapter's entire
   value is doing real filesystem operations correctly (atomic rename, idempotent
   remove/mkdir) — mocking `node:fs` itself would only prove the mock is called with the right
   arguments, not that the operations actually behave atomically/idempotently on a real
   filesystem. *Recommendation:* real temp directory, as designed in Phase 5 above; confirm
   before implementation if a stronger preference exists for keeping every test in this
   workstream fake-only for speed/hermeticity.

3. **This plan does not wire WS-41's own detection-side `FsAccess` adapter**, and neither does
   any other plan yet — WS-41 named WS-42 as the workstream that would do it, but this plan's
   own Context scopes it to the write-side `FsWriteAccess` adapter specifically. That leaves a
   real gap: whoever builds WS-43's onboarding UI needs *some* real implementation of
   `detectTool`/`detectAllTools` to get a real `basePath` to pass into `installSelected`
   (Assumption 3), and nothing built so far provides one. *Recommendation:* resolve this
   explicitly when WS-43 is scoped — either WS-43 builds the read-side `FsAccess` adapter
   itself (since it is the workstream that actually needs a real `DetectionResult` to render
   the onboarding screen), or a small follow-up workstream builds both the read- and
   write-side adapters together. Not decided here, since it is a question about WS-43's scope,
   not this plan's.

4. **WS-41's `IntegrationFormat.pathTemplate` does not distinguish a global-relative template
   from a project-relative one** (e.g. Cursor's global rules under `~/.cursor/rules/*.mdc` vs.
   project rules under `<project>/.cursor/rules/*.mdc`). This plan sidesteps the question by
   having its caller supply an already-resolved `basePath` (Assumption 3), but the ambiguity
   itself is real and unaffected by the platform pivot. *Recommendation:* resolve by either a
   second `projectPathTemplate` field on WS-41's `IntegrationFormat`, or a documented single
   rule for deriving one path shape from the other — a small addition to WS-41's contract, not
   something this plan invents unilaterally.

5. **No production data, live users, or migration/rollback constraints apply** — the standard
   per-run deployment question, answered here since this workstream ships no wiring into the
   running app's UI (only a manual devtools-console check, criterion 12). Recorded for
   completeness.

## Alternatives considered and rejected

- **A loopback HTTP relay for this workstream's IPC channels, mirroring WS-37's chosen
  pattern.** Rejected: WS-37's relay exists specifically because `server.ts`'s six routes
  already existed as private functions writing to `res`, so relaying through HTTP avoided
  restructuring that file. Nothing this workstream builds has ever existed in `server.ts` —
  there is no pre-existing server-side logic for a relay to reuse, so adding one would only
  cost an unnecessary local network hop and (worse) require inventing new `/api/*` routes
  purely to have something to relay to, for zero benefit over calling
  `agentic-tools-install.ts`'s functions directly from the main process, which is already
  running Node with direct access to them.
- **Extending WS-37's existing `window.praxisAPI` object with this workstream's three
  methods, instead of a second `window.praxisSkillInstallAPI` global.** Rejected: `praxisAPI`
  is WS-37's own object, covering six unrelated project-CRUD channels; folding in three more
  methods for a completely different concern (skill installs) means every future edit to
  either concern touches the same shared object literal and risks the two workstreams'
  changes colliding. A second, distinctly-named global costs one extra
  `contextBridge.exposeInMainWorld` call (Electron supports multiple calls with different
  keys in one preload script) and keeps the two concerns' preload wiring fully decoupled —
  directly following separation of concerns.
- **Building the concrete detection-side `FsAccess` adapter in this plan too, now that it is
  technically unblocked under Electron.** Rejected: Context's brief for this pivot names only
  the write-side `FsWriteAccess` adapter as newly buildable; the read-side adapter is a
  separate concern WS-41 assigned to "WS-42" before this pivot's Context narrowed this
  workstream's actual scope. Building it unasked would be scope creep; recorded instead as
  Open question 3 for whoever scopes WS-43.
- **One bespoke per-tool install function instead of the three-layer content/format/install
  split.** Rejected for the same reason WS-41 rejected a per-tool detector file: the three
  format kinds already capture 100% of the real behavioral variance across the four tools.
- **Treating `mcp-json` as a valid, lower-priority install format.** Rejected outright per
  Gap 2's own finding: an MCP entry names an executable server process, and this workstream
  ships no server binary — there is no content this engine could correctly put in an
  `mcp-json` file.
- **One `InstallRecord` per individual skill instead of per `(toolId, scope)`.** Rejected:
  Context's given record shape and "the Praxis integration" framing both point at one unit
  per target.
- **Pruning removed skills from an already-installed target on update.** Rejected: real
  `InstallContent` doesn't exist yet (Gap 1), so designing removal-detection against a shape
  that might not match the real, eventually-vendored content risks building the wrong thing.

### Final summary

Chosen approach: continue WS-41's data-driven, port-injected `src/lib/agentic-tools-*.ts`
family with the write/format/track engine (four phases, unchanged in spirit from the
discarded Tauri plan, corrected for the real `.praxis-projects.json`-pattern registry
location), then add a concrete `node:fs/promises`-backed `FsWriteAccess` adapter (Phase 5,
newly buildable under Electron) and wire it into Electron's main process via three new
`ipcMain.handle` channels exposed as a second preload global, `window.praxisSkillInstallAPI`
(Phase 6) — calling the engine directly, in-process, with no loopback HTTP hop, since none of
this logic ever existed in `server.ts` for a relay to reuse. Six phases total, small-to-
medium effort each. Top risks: the real skill-content source (Gap 1) and the real
detection-side `FsAccess` adapter (Open question 3) are both still missing, so this workstream
alone proves the write/track engine and its IPC plumbing work, not that a real install button
in WS-43 can yet do anything against real content. Open questions needing your answer: whether
to spin up the recommended content-vendoring workstream now (question 1), whether the concrete
adapter's tests should use a real temp directory as designed or stay fake-only (question 2),
who builds the read-side detection adapter WS-43 will need (question 3), and whether WS-41's
`pathTemplate` contract should gain a project/global distinction (question 4).

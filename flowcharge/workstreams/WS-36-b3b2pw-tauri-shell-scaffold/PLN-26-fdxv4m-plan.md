---
id: PLN-26-fdxv4m
type: plan
workstream: WS-36-b3b2pw
slug: tauri-shell-scaffold
title: "Wrap the frontend in a native Electron shell that starts and points at the existing server"
status: done
created: 2026-08-17
updated: 2026-08-18
depends_on: []
links: []
---

## Summary

This plan wraps the existing, unmodified browser frontend in a native Electron window. It
adds a new `electron/` directory (`main.cts`, `preload.cts`, `tsconfig.json`) whose main
process starts the existing HTTP server in-process — by dynamically `import()`-ing the
already-compiled `dist/server.js`, which runs `server.listen()` as a side effect
(`src/server.ts:332`) — polls `http://127.0.0.1:4173` until it answers, then opens a
`BrowserWindow` pointed at that same URL, exactly as a browser tab does today. No backend
logic, no `src/` file, and no API contract changes. `electron` is the only new npm package.
The one open technical question named in Context — CommonJS vs ESM for the main/preload
code under this repo's `"type": "module"` — is resolved here, not deferred: source files use
the `.cts` extension, which TypeScript always compiles to CommonJS `.cjs` output regardless
of the root `"type": "module"`, so Electron's Node loader treats them as CommonJS purely by
their `.cjs` file extension. This sidesteps every historical ESM-preload constraint outright
instead of chasing which Electron version relaxes it.

## Scope

**In scope — acceptance criteria:**

1. A developer running `npm run electron:dev` from a clean checkout (no server
   pre-started, no second terminal) ends with the compiled server running and a native
   Electron window open, showing the same home page (project tiles) as the browser today.
2. From that native window, clicking a project tile opens its board
   (`board.html?project=`), and the board renders identically to the browser: KPIs,
   columns, cards, issue/severity panels — because it is the same HTTP-served page,
   unchanged.
3. `npm run electron:dev` completes this successfully on each of the three test
   machines: the MacBook Pro M4 Pro (macOS Sequoia), the Dell Latitude (Debian 11), and
   the Windows 11 ARM VM under UTM.
4. On each of the three machines, closing the Electron window ends the app (and its
   in-process server) cleanly — no orphaned process left listening on port 4173.
5. The Windows leg (criterion 3–4) only proves the win32-arm64 build. Electron's own
   docs confirm win32-arm64 is a genuine, supported prebuilt target (has been since
   Electron 6.0.8), but this milestone does not exercise win32-x64/ia32 — that is a
   real, stated gap, not silently claimed as full Windows coverage.
6. Nothing under `src/` changes. `npm run build` / `npm start` continue to work exactly
   as before, unchanged, for anyone still using the app in a plain browser tab.

**Out of scope (per the fixed decision in Context, not attempted or anticipated here):**

- Any IPC bridge or `contextBridge.exposeInMainWorld` call from `preload.cts` — WS-37's
  job. `preload.cts` in this plan is a structural stub only.
- Any Rust/Tauri artefact — this plan fully replaces the discarded Tauri-targeted plan
  at this same path; no `src-tauri/` or Cargo tooling is introduced.
- `electron-builder`/`electron-forge`, installers, code signing, notarization,
  auto-update, or a multi-arch build matrix — WS-39's (Electron) job.
- The native folder-picker — WS-38's (Electron) job, via Electron's own `dialog` module.
- Any change to `src/`, `dist/` generation, or the existing `/api/*` contracts.

**Assumptions (stated, not confirmed by a user — this plan runs without one):**

- The window loads a hardcoded `http://127.0.0.1:4173`, matching `src/server.ts`'s own
  hardcoded defaults (`src/server.ts:12-13`), not wired to the `PORT`/`HOST` environment
  overrides the server already supports. Wiring those through is unneeded for "prove it
  builds and runs" and would be gold-plating.
- Electron's current stable major, `^43`, is used (confirmed current as of this plan's
  writing; see Design). The exact minor/patch is resolved by `npm install` and locked in
  `package-lock.json`, matching how `typescript`/`@types/node` are already pinned today.
- The window title is `"Praxis Board"`, matching the product name used throughout
  README.md. No app icon is set beyond Electron's own default — a custom icon is
  packaging polish, deferred to WS-39.
- "The existing server still running exactly as it does today" is read, per Context's
  own resolution note, as: the server is the same `dist/server.js` build, serving the
  same routes on the same host/port — just started by Electron's main process instead
  of by a person running `npm start` in a terminal. This is not the same as WS-37's IPC
  bridge; the frontend still talks to the server over `fetch()`/HTTP exactly as before,
  nothing routes through Electron IPC in this plan.
- `package-lock.json` (not `bun.lock`) is treated as the canonical lockfile for this
  workstream's `npm install`/`npm run electron:dev` commands, since `package.json`'s
  `engines` field and every existing script already assume Node. This mirrors the
  discarded Tauri plan's same assumption; the dual-lockfile question itself remains
  open (see Open Questions) — it is pre-existing, not created by this plan.

## Design

**New directory, sibling to `src/`, `dist/`, `tools/` — nothing under `src/` moves:**

```
electron/
├── main.cts         Main-process entry point (compiles to dist/electron/main.cjs).
│                     Starts the existing server in-process, waits for it to answer,
│                     then opens the BrowserWindow pointed at it.
├── preload.cts       Near-empty stub (compiles to dist/electron/preload.cjs).
│                     contextIsolation: true, nodeIntegration: false, sandbox: true
│                     wiring target only — no contextBridge.exposeInMainWorld calls,
│                     because there is no IPC surface to expose until WS-37.
└── tsconfig.json     Third tsconfig, alongside tsconfig.json and src/public/tsconfig.json.
```

**Module-format decision (the one open technical question in Context, resolved here).**
`electron/main.cts` and `electron/preload.cts` use TypeScript's `.cts` source extension.
TypeScript always compiles `.cts` files to CommonJS `.cjs` output, regardless of the
`module` compiler option and regardless of the root `package.json`'s `"type": "module"`
— and a `.cjs` file extension always tells Node's (and therefore Electron's) module
loader "this is CommonJS", overriding any ancestor `package.json`'s `"type"` field. This
is chosen over two alternatives: (a) emitting plain `.js` from a CommonJS-mode tsconfig
and relying on a second, nested `dist/electron/package.json` with `{"type":"commonjs"}`
to override the root's ESM default — works, but adds a build-output file that
`tools/copy-assets.mjs` would need to know to place, for no benefit over just naming the
source files correctly; and (b) writing ESM main/preload code and depending on a modern
Electron version's relaxed preload constraints — rejected because it makes the
module-format story version-dependent on Electron internals rather than settled by a
TypeScript compiler feature designed exactly for this "CJS file inside an ESM package"
case. `.cts`/`.cjs` is the narrowest, most defensible, and best-documented answer, so
this is a decision, not a deferred open question.

**`electron/tsconfig.json`** (sits inside `electron/`, mirroring `src/public/tsconfig.json`'s
own directory-relative-include convention):
```
{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["es2022"],
    "module": "commonjs",
    "moduleResolution": "node10",
    "esModuleInterop": true,
    "types": ["node"],
    "rootDir": ".",
    "outDir": "../dist/electron",
    "strict": true,
    "noEmitOnError": true,
    "skipLibCheck": true
  },
  "include": ["main.cts", "preload.cts"]
}
```
`module: "commonjs"` is set explicitly for clarity even though `.cts` forces it either way.

**`main.cts` contract** (the interface this plan defines — described precisely since it's
the one new module with real logic):
- A constant `SERVER_URL = 'http://127.0.0.1:4173'`, matching `src/server.ts:12-13`'s own
  hardcoded defaults.
- On `app.whenReady()`: dynamically `import()` the compiled server module at a path
  computed relative to `main.cjs`'s own `__dirname` (`../server.js`, i.e. `dist/server.js`).
  Node's dynamic `import()` can load an ESM module from CommonJS code, so this works even
  though `dist/server.js` itself stays plain ESM (unchanged, per Context's decision not to
  touch `src/`). The import's module-evaluation side effect is `server.listen(port, host,
  ...)` (`src/server.ts:332`) — no exported "start" function is needed or added.
- Poll `SERVER_URL` with a plain `http.get`, at a short fixed interval, up to a bounded
  timeout (e.g. every 100ms for up to 10s) — the same readiness-polling shape the discarded
  Tauri plan used, just run from Electron's own main process instead of a separate wrapper
  script, since Electron's main process already *is* Node.
- On success: create a `BrowserWindow` with `webPreferences: { contextIsolation: true,
  nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.cjs') }`,
  then `mainWindow.loadURL(SERVER_URL)`.
- On timeout: show an error via Electron's `dialog` module and quit, rather than loading
  the window against a server that never came up.
- `main.cts` must not read `flowcharge/`, call `/api/*` itself, or know anything about the
  board's data model — that boundary stays entirely in `src/server.ts` and its `src/lib/*`
  modules, per the fixed decision that this workstream doesn't touch backend logic. It
  knows only "start the server module, wait for the port, open a window at that URL."
- No explicit server shutdown logic is added: `src/server.ts` registers no signal
  handlers and calls no `process.exit` (confirmed by reading the file), so Electron's own
  process teardown on window-close takes the in-process HTTP listener down with it —
  matching acceptance criterion 4 without new code.

**`preload.cts` contract:** a structural stub only — it exists so `webPreferences.preload`
points at a real compiled file and the full build pipeline (source → `dist/electron/*.cjs`)
is proven end-to-end, which is what WS-37 will build on. It contains no
`contextBridge.exposeInMainWorld` calls, because there is no IPC surface yet.

**`package.json` changes:**
- New devDependency: `"electron": "^43"` — the current Electron stable major, confirmed
  today to still ship win32-arm64 prebuilt binaries (win32 ia32 and linux armv7l are
  dropped starting Electron 44, which is exactly why `^43`, not `latest`, is named
  explicitly here rather than left to float).
- New top-level field: `"main": "dist/electron/main.cjs"`.
- `build` script extended to also run `tsc -p electron/tsconfig.json`, alongside the
  existing two `tsc` invocations:
  `"build": "tsc -p tsconfig.json && tsc -p src/public/tsconfig.json && tsc -p electron/tsconfig.json && node tools/copy-assets.mjs"`.
- New script: `"electron:dev": "npm run build && electron ."`.
- No `.gitignore` change — `dist/` is already ignored wholesale, and `dist/electron/`
  falls under it.

**What is reused, not reinvented:** the build pipeline (`npm run build`,
`tools/copy-assets.mjs`, `tsconfig.json` / `src/public/tsconfig.json`) is untouched and
still the only way the server/frontend halves of `dist/` get produced; `src/server.ts`'s
existing `server.listen()` behavior is the thing `main.cts` triggers by importing it, not a
reimplementation of it.

## Staged task breakdown

**Phase 1 — `electron/` scaffold and toolchain wiring.** Effort: small. Dependencies: none.
- Add `electron` as a devDependency (`^43`).
- Add `electron/tsconfig.json` per the Design contract above.
- Add placeholder `electron/main.cts` and `electron/preload.cts` (compile successfully,
  logic added in Phase 2).
- Extend the `build` script with the third `tsc -p electron/tsconfig.json` invocation; add
  the `"main"` field and the `electron:dev` script.
- Files touched: new `electron/**`; `package.json` (devDependencies, scripts, main).
- Verify: `npm run build` exits 0 and produces `dist/electron/main.cjs` and
  `dist/electron/preload.cjs`.

**Phase 2 — Main-process server bring-up and window.** Effort: medium. Dependencies: Phase 1.
- Implement `main.cts`'s full contract: dynamic import of `dist/server.js`, readiness
  polling of `http://127.0.0.1:4173`, `BrowserWindow` creation with the specified
  `webPreferences`, `loadURL`, and the timeout/error path.
- Leave `preload.cts` as the near-empty stub described in Design.
- Files touched: `electron/main.cts`, `electron/preload.cts`.
- Verify: on the primary dev machine, `npm run electron:dev` opens a native window
  showing the home page at `http://127.0.0.1:4173/`, and clicking through to a board
  works identically to the browser (KPIs, columns, cards, issue/severity panels).

**Phase 3 — macOS build and verify (MacBook Pro M4 Pro, macOS Sequoia).** Effort: small.
Dependencies: Phase 2.
- Run `npm run electron:dev` from a clean checkout (fresh `npm install` first, no
  server pre-started).
- Confirm home page, board navigation, KPI panel, and issue/severity panels all render
  and behave exactly as in the browser; confirm closing the window leaves nothing
  listening on port 4173.
- Verify: acceptance criteria 1, 2, 4 pass on macOS.

**Phase 4 — Linux build and verify (Dell Latitude, Debian 11).** Effort: small.
Dependencies: Phase 2 (sequenced after Phase 3 since this is a solo, sequential plan).
- `npm install` (pulls Electron's prebuilt linux-x64 binary; install any Electron
  runtime system packages its own docs call for on Debian — a documented local
  prerequisite, not a repo change), then `npm run electron:dev`.
- Same checks as Phase 3.
- Verify: acceptance criteria 1, 2, 4 pass on Debian 11.

**Phase 5 — Windows (ARM) build and verify (Windows 11 ARM VM under UTM).** Effort: small.
Dependencies: Phase 2.
- `npm install` (pulls Electron's prebuilt win32-arm64 binary), then
  `npm run electron:dev`.
- Same checks as Phase 3.
- Verify: acceptance criteria 1, 2, 4 pass on Windows 11 ARM; record explicitly that
  this proves only the ARM build, per acceptance criterion 5.

All five phases are sequential, each small-to-medium, each independently verifiable, and
each leaves the app in a working, demonstrable state — no phase depends on a later one's
output.

## Data & compatibility

No data model exists in this change; no migrations. The existing `/api/*` contracts,
`src/lib/*` modules, and the plain-browser flow (`npm start` + open
`http://127.0.0.1:4173` in any browser) are untouched and continue to work exactly as
before — Electron is purely an additive second consumer of the same HTTP server, not a
replacement for the first, and the server code path is identical either way (it is the
same `dist/server.js`, just started by a different caller).

**Rollback:** delete `electron/`, revert the four `package.json` changes (devDependency,
`main` field, the extra `build` step, the `electron:dev` script), and remove
`node_modules/electron`. Nothing under `src/` was touched, so rollback is a pure deletion
with no data or migration story to reverse.

## Testing strategy

- `main.cts`'s readiness-polling loop is a small, pure-enough piece of logic that it
  could be extracted into a testable function and covered with `node --test`, matching
  the existing convention in `src/lib/extract.test.ts` — for example, asserting it
  retries until a mock HTTP server answers and times out cleanly when one never does.
  This is optional polish, not required for this plan's acceptance criteria, since the
  logic is short and the real risk (does a real Electron window actually render the real
  server's pages on each real OS) is not something a unit test can substitute for.
- Everything else in this plan (window chrome, in-process server bring-up, on-device
  rendering) is integration-level and manual by nature — this is exactly why Context
  specifies the three physical/virtual test machines rather than assuming CI: there is
  no existing CI config in this repo (`.github/workflows` does not exist) to extend, and
  standing one up for three-OS native Electron runs is disproportionate to a
  scaffold-proof workstream.
- No new tests are needed for `src/` — nothing there changes.

## Open questions

1. **`package-lock.json` vs `bun.lock`.** Both exist in the repo root today, pre-dating
   this plan. This plan's `electron:dev` script and Phase 3-5 verification assume a
   system `node`/`npm` toolchain (matching `package.json`'s `engines` and every existing
   script), not `bun`. If Bun is meant to be the canonical package manager going
   forward, `npm install`/`npm run electron:dev` in this plan would need to become
   `bun install`/an equivalent Bun script, and one of the two lockfiles should probably
   be retired. Recommendation: keep npm/Node as the assumption (it's what every existing
   script already uses) and treat the lockfile question as independent cleanup, not
   blocking this plan — this is the same open item the discarded Tauri plan flagged,
   carried forward unchanged because Context does not resolve it for Electron either.
2. **Electron major-version pin.** This plan names `^43` as the current stable major
   (confirmed to still ship win32-arm64, win32-ia32, and linux-armv7l; Electron 44 drops
   the latter two). If implementation happens meaningfully later than this plan's
   writing and a newer major has since become current, confirm whether to track that
   newer major instead — the module-format decision (`.cts`/`.cjs`) and the
   dynamic-`import()` server bring-up in Design do not depend on the exact major, so this
   does not block writing the code, only which `^N` gets typed into `package.json`.

## Alternatives considered and rejected

- **Spawn `node dist/server.js` as a child process from `main.cts`**, instead of
  dynamically importing the compiled server module in-process. This was explicitly
  offered as an option by the investigation notes. Rejected: it requires locating a
  `node` executable at runtime (not guaranteed on a machine that only has the packaged
  Electron app, since Electron bundles its own Node but that is not the same as a
  system `node` on `PATH`), and it adds process-lifecycle management (tracking the
  child's pid, killing it on quit) that the in-process `import()` approach avoids for
  free — Electron's own process teardown already takes an in-process HTTP listener down
  with it. Dynamic `import()` is strictly less new surface area for the same
  acceptance bar.
- **A separate wrapper script (`tools/run-electron-dev.mjs`), mirroring the discarded
  Tauri plan's `tools/run-tauri-dev.mjs`.** Rejected: this was a genuine necessity for
  Tauri because Rust and Node are different processes with no shared runtime, requiring
  an external readiness-polling handoff. Electron's main process *is* Node, so
  `main.cts` itself can start the server and poll it — folding the wrapper script's
  entire job into the file that already has to exist. Keeping a separate script would
  duplicate that logic for no benefit.
- **Nested `dist/electron/package.json` with `{"type":"commonjs"}`**, instead of the
  `.cts`/`.cjs` extension approach, to resolve the CommonJS-vs-ESM question. Rejected:
  functionally equivalent, but it adds a build-output file that `tools/copy-assets.mjs`
  would need to know to place (it isn't a static asset copy today, and this plan does
  not touch `src/`'s build pipeline for anything else), whereas naming the TypeScript
  source files `.cts` is a zero-extra-file, compiler-native way to get the same
  guarantee.
- **Author `preload.cts` with real `contextBridge.exposeInMainWorld` calls now, on the
  assumption WS-37 will need them anyway.** Rejected outright — this is the fixed
  boundary in Context: this plan must not anticipate WS-37's IPC work. The stub exists
  so the compile/load wiring is proven, nothing more.

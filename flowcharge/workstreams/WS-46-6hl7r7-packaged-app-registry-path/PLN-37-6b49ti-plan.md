---
id: PLN-37-6b49ti
type: plan
workstream: WS-46-6hl7r7
slug: packaged-app-registry-path
title: "Give the packaged app a writable registry path via PRAXIS_DATA_DIR"
status: done
created: 2026-08-19
updated: 2026-08-19
depends_on: []
links: []
---

## Summary

`src/lib/projects.ts` computes `repoRoot` as `path.join(__dirname, '..', '..')`
(lines 14-15) and uses it to locate `.praxis-projects.json`. In dev (`npm start`,
a plain browser tab, or `npm run electron:dev`) that correctly lands at the repo
root. Once `electron-builder` packs `dist/` into `app.asar` (WS-39's packaging
work, already committed, `asar: true` by default since `package.json`'s `build`
block sets no `asar: false`), the same computation resolves inside the read-only
archive instead — confirmed by building and running the packaged macOS app: it
created a bogus phantom self-entry project on first launch and every real
add/rename/remove then failed with "Could not write the project registry."

This plan keeps `projects.ts` fully platform-agnostic — no `electron` import,
preserving the boundary WS-37/WS-38 established and that no file under
`src/lib/*.ts` or `src/server.ts` crosses today. `projects.ts` reads one optional
env var, `PRAXIS_DATA_DIR`, for the directory the registry file lives in, falling
back to today's `__dirname`-relative `repoRoot` when the var is unset — so dev,
browser, and `electron:dev` behavior stays byte-identical. `electron/main.cts`
sets `process.env.PRAXIS_DATA_DIR = app.getPath('userData')` only when
`app.isPackaged`, immediately before its existing dynamic `import('../server.js')`
call — the one place in the codebase already permitted to know about packaging
state and about `dist/server.js`'s module-load timing.

The same env var's mere presence also serves as the "are we packaged" signal
needed for the second bug riding along: `selfEntry()`'s dogfooding fallback
(registering the dashboard's own checkout as a project tile on first-run
`ENOENT`) is meaningless in a packaged build regardless of path correctness,
because WS-39's `package.json` `build.files` allowlist (`["dist/**/*",
"package.json"]`) never ships `flowcharge/` — so even a correctly-resolved
self-entry would point at a project with no board data. `readProjects()`'s
`ENOENT` branch is gated so a packaged first run starts with an empty registry
array instead. Total surface: two files, `src/lib/projects.ts` and
`electron/main.cts`.

## Scope

**In scope — acceptance criteria:**

1. A packaged build (`.dmg`/`.deb`/`.exe`, produced by `npm run package:mac` /
   `:linux` / `:win`) resolves its registry file under the OS's per-user app-data
   directory (`app.getPath('userData')`), not inside `app.asar`, and can write to
   it — add, rename, and remove all succeed.
2. A packaged build's first launch starts with an empty project list (no phantom
   self-entry tile), because `selfEntry()`'s `ENOENT` fallback is skipped whenever
   `PRAXIS_DATA_DIR` is set.
3. `npm start` (plain Node/browser), a plain browser tab, and `npm run
   electron:dev` (unpackaged Electron) are all unaffected: `PRAXIS_DATA_DIR` is
   never set in any of these paths, so `repoRoot`'s computation and
   `selfEntry()`'s first-run fallback both stay exactly as they behave today.
4. `src/lib/projects.ts` and `src/server.ts` gain no `electron` import — the
   architectural boundary from WS-37/WS-38 stays intact.
5. `addProject()`'s handling of caller-supplied paths (`path.resolve(absPath)`,
   `src/lib/projects.ts:74`) is untouched — this plan only changes where the
   registry *file itself* lives, never how a user-registered project path is
   resolved.

**Out of scope:**

- Actually re-running `npm run package:mac` and launching the packaged `.dmg` to
  do final proof — that re-verification is WS-39's own Phase 2 task, which this
  plan unblocks but does not perform. This plan's own verification is everything
  that can be checked without a full package build (see Testing strategy).
- Migrating an existing dev-mode `.praxis-projects.json` into the packaged app's
  `userData` directory on first launch. Not warranted or feasible: a packaged app
  has no reliable way to locate an arbitrary dev checkout's repo root, and a fresh
  empty registry on first packaged launch is correct and expected.
- Any change to `addProject`, `removeProject`, `renameProject`, `findProject`,
  `projectId`, or the registry's JSON shape — none of those are affected by where
  the file lives.
- Any change to `electron/ipc-handlers.cts` or `electron/preload.cts` — both are
  pure IPC plumbing, uninvolved in this bug.
- Any change to `src/server.ts`'s `PORT`/`HOST` env-var pattern beyond following
  it as precedent (see Design) — that pattern is reused, not modified.

**Assumptions (none require confirmation — direct readings of the brief and the
existing code):**

- `PRAXIS_DATA_DIR` is the correct env-var name (given explicitly in the brief)
  and follows the existing `PORT`/`HOST` precedent (`src/server.ts:12-13`) of a
  plain, unprefixed-by-nothing environment override with a hardcoded fallback.
- The fix applies uniformly to every packaged target `package.json`'s `build`
  block produces (macOS `dmg`/`zip`, Linux `deb`/`AppImage`, Windows `nsis`) —
  `app.isPackaged` and `app.getPath('userData')` are both cross-platform Electron
  APIs with no macOS-specific behavior, and WS-39's own scope already covers all
  three platforms.
- Deployment/release constraints: this repository has no production deployment
  and no live users — a pre-release desktop-app pivot (per WS-36/WS-37/WS-38's
  workstream records). There is no production data to protect and no
  migration/rollback window beyond the ordinary revert-a-commit story under Data
  & compatibility below.

## Design

### `src/lib/projects.ts` — env-var-driven registry directory + packaged self-entry gate

Current (lines 10-15):

```ts
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..', '..');
const registryPath = path.join(repoRoot, '.praxis-projects.json');
```

New:

```ts
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// This file compiles to dist/lib/projects.js, so two levels up is the repo
// root — still used below for the self-entry's own path even when the
// registry file itself lives elsewhere.
const repoRoot = path.join(__dirname, '..', '..');

// electron/main.cts sets this to app.getPath('userData') before importing the
// server, but only when app.isPackaged — so its mere presence, checked once
// below as `isPackaged`, doubles as the "are we running from a packaged
// app.asar" signal without this file importing 'electron' or knowing anything
// about packaging beyond one env var. Unset in dev, in a plain browser tab,
// and in `npm run electron:dev`: repoRoot is used exactly as before.
const dataDir = process.env.PRAXIS_DATA_DIR || repoRoot;
const registryPath = path.join(dataDir, '.praxis-projects.json');
const isPackaged = Boolean(process.env.PRAXIS_DATA_DIR);
```

`readProjects()`'s `ENOENT` branch (current line 59):

```ts
} catch (err) {
  return (err as NodeJS.ErrnoException).code === 'ENOENT' ? [selfEntry()] : [];
}
```

becomes:

```ts
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') return [];
  // A packaged first run gets an empty registry, not a self-entry pointing at
  // the app bundle: WS-39's package.json `files` allowlist never ships
  // flowcharge/, so even a correctly-resolved self-entry would have no board data.
  return isPackaged ? [] : [selfEntry()];
}
```

`selfEntry()` itself (lines 24-32) is untouched — it still resolves against
`repoRoot`, and is simply never called when `isPackaged` is true.

**What this module knows about:** one optional environment variable and its
value as a directory path. **What it must NOT know about:** Electron, `app.asar`,
`BrowserWindow`, or any other packaging concept by name — the boundary this plan
is required to preserve.

### `electron/main.cts` — set the signal before the server module loads

Current (`app.whenReady().then(...)`, lines 50-68):

```ts
app.whenReady().then(async () => {
  // ... dynamicImport helper comment ...
  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<unknown>;
  await dynamicImport('../server.js');
  ...
```

New, one `if` block inserted immediately before the existing `dynamicImport`
call so it is set before `../server.js` (and therefore `projects.ts`, which
`server.ts` imports at `src/server.ts:6`) ever evaluates its top-level `const`s:

```ts
app.whenReady().then(async () => {
  // Mirrors src/lib/projects.ts's own PRAXIS_DATA_DIR read: only this
  // packaged-vs-not check belongs here, because only Electron's main process
  // knows app.isPackaged. Unset in `npm run electron:dev` (app.isPackaged is
  // false there), so dev Electron behaves exactly as it does today.
  if (app.isPackaged) {
    process.env.PRAXIS_DATA_DIR = app.getPath('userData');
  }

  const dynamicImport = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<unknown>;
  await dynamicImport('../server.js');
  ...
```

This lands in the same function that already wires `SERVER_URL` and
`registerIpcHandlers()` — no new function, no new file. `app` is already
imported at `main.cts:8`.

### Contracts

No new data shape, API route, or IPC channel. The only "contract" this plan
introduces is the env var itself:

| Var | Set by | Read by | Value |
|---|---|---|---|
| `PRAXIS_DATA_DIR` | `electron/main.cts`, only when `app.isPackaged` | `src/lib/projects.ts`, at module load | Absolute path to a writable directory (`app.getPath('userData')`) |

This is the same shape as the existing `PORT`/`HOST` precedent
(`src/server.ts:12-13`): an optional override read once, with a hardcoded
fallback, no validation needed because the only writer is trusted first-party
code (`main.cts`), not user input.

## Staged task breakdown

### Phase 1 — `PRAXIS_DATA_DIR` support and packaged self-entry gate in `projects.ts` (small)

**What to build:** the `src/lib/projects.ts` changes in Design above — `dataDir`/
`isPackaged` constants, `registryPath` now derived from `dataDir`, and
`readProjects()`'s `ENOENT` branch gated on `isPackaged`. Update the file's header
comment (currently "owns `.praxis-projects.json` at the repo root", line 1-3) to
reflect that the registry's directory can be overridden.

Add `src/lib/projects.test.ts`, a `node:test` unit test (same pattern as the
existing `src/lib/extract.test.ts`: temp dirs via `os.tmpdir()`/
`fs.mkdtempSync`), covering the two behaviors that are independently verifiable
without an Electron process — see Testing strategy for exact cases and why the
unset-var/dev-path case is verified by inspection instead of an isolated
automated test.

**Files touched:** `src/lib/projects.ts`, `src/lib/projects.test.ts` (new).

**Dependencies:** none.

**Verify:**
- `npm run build` (`tsc -p tsconfig.json`, which includes `src/lib/**/*.ts`)
  compiles with no errors.
- `node --test dist/lib/projects.test.js` passes, exercising both new unit
  tests.
- `grep -rn "from 'electron'" src/lib/*.ts src/server.ts` returns nothing.

### Phase 2 — Wire `electron/main.cts` to set the signal when packaged (small)

**What to build:** the `electron/main.cts` change in Design above — the
`if (app.isPackaged)` block setting `process.env.PRAXIS_DATA_DIR`, placed
immediately before the existing `dynamicImport('../server.js')` call.

**Files touched:** `electron/main.cts`.

**Dependencies:** Phase 1 (the env var must already be meaningful to
`projects.ts` before anything sets it).

**Verify:**
- `npm run build` (`tsc -p electron/tsconfig.json`) compiles with no errors.
- Code inspection confirms the assignment executes before the dynamic import,
  and that `npm run electron:dev` (`app.isPackaged === false`) takes the
  unchanged branch — no `PRAXIS_DATA_DIR` is set, so `projects.ts` falls back to
  `repoRoot` exactly as before.
- Full behavioral proof — `npm run package:mac`, launch the built `.dmg`, and
  confirm project add/rename/remove/list all work against a registry file under
  `~/Library/Application Support/Praxis Board/` — is WS-39's own Phase 2 task
  (`flowcharge/workstreams/WS-39-20u3dv-tauri-cross-platform-packaging/tasklist.md`),
  which this plan unblocks. It is intentionally not re-run here.

## Data & compatibility

No registry JSON shape change, no schema migration. `addProject`/`removeProject`/
`renameProject`/`findProject`/`projectId` are all untouched — only the directory
`registryPath` is computed from changes.

**Backward compatibility:** dev, browser-tab, and `electron:dev` users keep the
exact `.praxis-projects.json` file they have today, at the exact path they have
today (`PRAXIS_DATA_DIR` unset → `dataDir === repoRoot`, byte-identical to the
current hardcoded computation). No existing user-visible registry moves or is
migrated. A packaged app's first launch starts with a fresh, empty registry under
its own `userData` directory — expected and, per the brief, not something a
migration should attempt to backfill.

**Rollback story:** fully reversible by reverting the two commits/files
(`src/lib/projects.ts`, `electron/main.cts`) — zero data risk, since the only
behavior change under an unset `PRAXIS_DATA_DIR` is none at all, and the packaged
app's registry is freshly created regardless of which version of this fix (if
any) was present at its first launch.

## Testing strategy

This repository's only existing automated tests are `node:test` unit tests for
pure backend logic (`src/lib/extract.test.ts`, run via `node --test
dist/lib/extract.test.js`, per that file's own header comment) — there is no
`npm test` script; tests are compiled and run by hand. `src/lib/projects.test.ts`
follows that exact convention.

Because `dataDir`/`isPackaged` are computed once, at module top-level, from
`process.env.PRAXIS_DATA_DIR` read at import time, a single test process can't
exercise both the "unset" and "set" branches by importing the module twice (ESM
module caching) — so the set-branch tests below spawn the compiled module in a
child process with a controlled environment, the standard way to test
import-time environment reads:

- **`PRAXIS_DATA_DIR` override redirects the registry file** — spawn
  `dist/lib/projects.js` in a child process (`node:child_process.execFileSync`)
  with `PRAXIS_DATA_DIR` set to a fresh `fs.mkdtempSync` directory, call
  `addProject()` with a throwaway path, and assert
  `.praxis-projects.json` was created inside that temp directory (not at the
  real repo root).
- **Packaged first run starts empty, not with a self-entry** — same child-process
  approach, `PRAXIS_DATA_DIR` set to a fresh empty temp directory (guaranteeing
  `ENOENT` on first `readProjects()` call), assert the returned list is `[]`.
- **Unset `PRAXIS_DATA_DIR` (dev/browser/electron:dev path) is not covered by an
  isolated automated test** — doing so would mean either mutating the real
  repo's own `.praxis-projects.json` as a side effect of running the test suite,
  or refactoring `repoRoot`/`registryPath` into injectable parameters purely to
  make them mockable, which is more production-code surface than this fix
  calls for. This path is unchanged code (the `dataDir` fallback and
  `selfEntry()` gate both no-op when the var is unset), so its regression
  coverage is the existing, ongoing dev workflow itself (`npm start` /
  `electron:dev`) — consistent with how this codebase already treats
  `home.ts`/`app.ts`/`electron/*.cts` (no automated coverage, verified by hand
  per WS-45's plan).

- **Build/typecheck (both phases):** `npm run build` — `tsc -p tsconfig.json`
  and `tsc -p electron/tsconfig.json` both succeed.
- **Boundary check (both phases):** `grep -rn "from 'electron'" src/lib/*.ts
  src/server.ts` returns nothing, confirming the architectural boundary held.
- **Final integration proof (out of scope for this plan, belongs to WS-39):**
  `npm run package:mac` + launching the packaged `.dmg`, confirming project
  add/remove/list all work — the re-verification this fix unblocks.

## Open questions

1. **Should `PRAXIS_DATA_DIR`'s presence alone serve as the "packaged" signal
   for gating `selfEntry()`, or should a second, explicit flag be introduced?**
   This plan infers "packaged" from the env var's mere presence, since
   `main.cts` only ever sets it when `app.isPackaged` is true — one fact, one
   variable. Recommendation: keep the single-variable design; a second flag
   would just be a second place that has to stay in sync with the same fact,
   for no behavioral benefit.
2. **Does the fix need platform-specific verification beyond macOS before this
   plan is considered fully proven?** WS-39's own scope covers Linux/Windows
   packaging; `app.isPackaged`/`app.getPath('userData')` are both
   cross-platform Electron APIs, so this plan assumes the fix is
   platform-uniform. Recommendation: let WS-39's own Linux/Windows
   build-and-verify tasks (if scheduled) be the confirmation; no separate task
   needed here.

Neither question blocks Phase 1 or Phase 2 — both default to this plan's stated
design unless the user says otherwise.

## Alternatives considered and rejected

1. **Import `electron`'s `app.getPath('userData')` directly inside
   `projects.ts`, guarded by a `try`/`catch` or a runtime check for the
   `electron` module.** Rejected: breaks the architectural boundary WS-37/WS-38
   established and that the brief requires stay intact (no `electron` import
   anywhere under `src/lib/*.ts` or `src/server.ts`), and it would make
   `projects.ts` fail to load — or need defensive module-resolution
   gymnastics — under plain Node (`npm start`, `npm run refresh`), where no
   `electron` package is even a runtime dependency of that code path.
2. **Detect packaging by string-matching `__dirname` for `app.asar` (e.g.
   `__dirname.includes('app.asar')`).** Rejected: a fragile heuristic tied to
   `electron-builder`'s current default `asar: true` naming, versus an explicit
   signal set by the one process (`main.cts`) that already knows packaging
   state authoritatively via `app.isPackaged` — and it still wouldn't answer
   "where is `userData`", so a second heuristic would be needed for that half
   of the fix regardless.
3. **A separate, dedicated `PRAXIS_PACKAGED` env var alongside
   `PRAXIS_DATA_DIR`, so the "packaged" signal doesn't ride on a variable
   named for a different purpose.** Rejected as redundant: `main.cts` only ever
   sets `PRAXIS_DATA_DIR` when `app.isPackaged`, so the two facts ("packaged"
   and "registry dir is overridden") are already 1:1 in practice; a second
   variable is one more thing to keep in sync for no new information.
4. **Migrate an existing dev-mode `.praxis-projects.json` into the packaged
   app's `userData` directory on first launch.** Rejected per the brief: a
   packaged app has no reliable way to locate an arbitrary dev checkout's repo
   root, and a fresh empty registry on first packaged launch is correct and
   expected — there is nothing to migrate from, in general.

## Final summary

Chosen approach: `src/lib/projects.ts` reads an optional `PRAXIS_DATA_DIR` env
var for the registry file's directory (falling back to today's `repoRoot`
computation when unset) and reuses that same var's presence to gate
`selfEntry()`'s first-run fallback off in a packaged build;
`electron/main.cts` sets `PRAXIS_DATA_DIR = app.getPath('userData')` only when
`app.isPackaged`, right before its existing dynamic `import('../server.js')`.
Two small phases: (1) `projects.ts` changes plus new `node:test` unit coverage,
(2) the one-`if`-block wiring in `main.cts`. Zero new files besides one test
file, zero `electron` imports added to `src/lib/*.ts` or `src/server.ts`, zero
changes to the registry's JSON shape or to `addProject`/`removeProject`/
`renameProject`/`findProject`. Top risks: the `isPackaged`-from-env-var-presence
inference silently breaking if a future change sets `PRAXIS_DATA_DIR` for some
other reason without also meaning "packaged" (mitigated by the single call site
in `main.cts` and the comment explaining the coupling); and this plan's own
verification stopping short of an actual packaged-app launch, deferred by
design to WS-39's Phase 2. Two low-stakes open questions, both defaulted to this
plan's design: whether the packaged signal should be its own variable (no), and
whether platform coverage beyond macOS needs a separate check here (no, WS-39
owns that).

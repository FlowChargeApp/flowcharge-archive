---
id: PLN-79-w9eeom
type: plan
workstream: WS-89-t2g5to
slug: bun-cli-binary-packaging
title: "Compile FlowCharge Board into single-file Bun CLI binaries"
status: done
created: 2026-09-04
updated: 2026-09-04
depends_on: []
links: []
---

# Compile FlowCharge Board into single-file Bun CLI binaries

## Summary

FlowCharge Board ships as a single-file native executable for macOS (arm64 and x64), Linux (x64) and Windows (x64). Running the executable starts the existing HTTP server from `src/server.ts`, and the user opens the board at `http://127.0.0.1:4173`.

The approach compiles a small generated entry file, `dist/cli-entry.js`, rather than `dist/server.js` directly. That entry does three things before it dynamically imports `./server.js`: it declares every file under `dist/public/` as an embedded asset, it sets a writable data directory, and it injects the version string. A new Node script, `tools/package-cli.mjs`, generates that entry and drives `bun build --compile` once per target.

The generated entry is compiled with `--asset-naming='[dir]/[name].[ext]'`. That flag makes the embedded assets land at `/$bunfs/root/public/...`, which is exactly where `src/server.ts:29`'s `root` constant already looks. The static-file branch at `src/server.ts:874-908` therefore needs no change at all.

Two one-line seams in `src/server.ts` do need to change, because two constants there resolve outside the read-only embedded filesystem. Both changes are env-gated, so behaviour with the environment unset is byte-for-byte today's behaviour.

## Scope

### Acceptance criteria

1. `npm run package:cli` writes four executables to `release/cli/`, named `flowcharge-<version>-darwin-arm64`, `flowcharge-<version>-darwin-x64`, `flowcharge-<version>-linux-x64` and `flowcharge-<version>-win-x64.exe`, where `<version>` is `package.json`'s `version` field.
2. Running the macOS arm64 executable with no arguments and no files beside it logs `FlowCharge running at http://127.0.0.1:4173` and binds that port.
3. With that executable running, `GET /` and `GET /board.html` return 200, and every asset those two pages reference returns 200 and its correct content type.
4. `GET /api/version` returns 200 with the `version` value that was in `package.json` when the executable was built.
5. Adding a project through the running executable returns 201 and the project is still listed after the executable is stopped and started again.
6. Installing a skill through the executable's `/api/integrations/installs` route succeeds and the resulting install is reported by a later read, with the registry file written inside the executable's data directory.
7. `PRAXIS_DATA_DIR`, `PORT` and `HOST` set in the environment still override the executable's defaults.
8. `npm start`, `npm run electron:dev`, `npm run package:mac` and `npm test` behave exactly as they did before the change.

### Out of scope

- Code signing and notarization. These are deferred by D-26 and parked as WS-94-ked1ye.
- The public release repository, WS-90-1gmwvj.
- Publishing these executables as release assets, and any CI wiring, WS-91-mecfuo.
- Any change to `electron/`. A pre-existing defect sits at `electron/agentic-tools-ipc-handlers.cts:251-252`, where `registryPath` resolves inside the read-only `app.asar` for a packaged Electron build. It is not this workstream's file and this plan does not act on it.
- Opening a browser automatically. D-26 states the user opens `localhost:4173` themselves.
- Any change to `dist/public/`'s content, the build chain in `tools/copy-assets.mjs`, or `tools/bundle-public.mjs`.

### Assumptions

- `bun` is on the developer's `PATH`. `tools/package-cli.mjs` fails with a clear message when it is not. Bun is not added to `devDependencies`; WS-91-mecfuo owns making the toolchain reproducible in CI.
- The four Bun target strings `bun-darwin-arm64`, `bun-darwin-x64`, `bun-linux-x64` and `bun-windows-x64` are correct for Bun 1.3.14. All four were compiled successfully against the installed version during reconnaissance.
- The non-baseline x64 targets are the right choice over their `-baseline` variants. Every Intel Mac and every current x86_64 Linux host has AVX. The `-baseline` variants exist for the older CPUs that do not.
- Changing `src/server.ts`'s install-registry constant does not affect a packaged Electron build. `src/public/browser-ipc-shim.ts:90` installs the HTTP-backed `window.praxisSkillInstallAPI` only when the property is absent, and `electron/preload.cts` injects it inside an Electron window. The integrations HTTP routes are therefore unreachable in Electron.
- There is no production data and there are no live users. This is a first distribution form at version `0.1.0`, so there is no migration and no compatibility window to hold open.
- The app stays shippable throughout. Both `src/server.ts` seams are additive and env-gated, and every other change is a new file or a new npm script.

## Key flows

**Start the board from the executable** — **Actor:** a user who has downloaded one executable for their platform. **Preconditions:** the file is on disk and marked executable; nothing else is installed; no `flowcharge/` project is registered yet. **Main flow:** the user runs the executable from a terminal; it creates its data directory if absent, starts the HTTP server on `127.0.0.1:4173`, and prints the URL; the user opens that URL and sees the home page with an empty project list; the user adds a project folder and the board renders it. **Outcome:** the board serves entirely from inside the single file, and the project registry persists in the data directory across restarts. **Edge cases:** port 4173 already bound, which the existing error listener at `src/server.ts:921-924` already reports and rejects on; a `PORT` or `HOST` value supplied in the environment, which still wins; a data directory that cannot be created, which surfaces as the entry's own `mkdirSync` failure before the server starts.

## Design

### What breaks in a compiled binary, and why

Reconnaissance compiled the real `dist/` tree and ran the result. In a Bun standalone executable `import.meta.url` is `file:///$bunfs/root/<binary-name>`, so `src/server.ts:28`'s `__dirname` is `/$bunfs/root`. That is a read-only virtual filesystem containing only the files the bundler embedded. Three `__dirname`-relative resolutions therefore miss:

| Constant | Resolves to in the binary | Consequence |
| --- | --- | --- |
| `src/server.ts:29` `root` | `/$bunfs/root/public` | Fixed by embedding, no code change. |
| `src/server.ts:74` `APP_VERSION` | `/$bunfs/package.json` | `ENOENT`, so `/api/version` answers 500. |
| `src/server.ts:88` `INSTALL_REGISTRY_PATH` | `/$bunfs/.praxis-installs.json` | Integrations installs cannot be recorded or read back. |

`src/lib/projects.ts:22` and `src/lib/update-prefs.ts:20` already read `process.env.PRAXIS_DATA_DIR` and need no change. Setting that variable is enough for both.

### Contract: `dist/cli-entry.js`, generated

Generated by `tools/package-cli.mjs` into `dist/`, overwritten on every run, never committed. `dist/` is already gitignored. Its required content, in this order:

1. One `import './public/<relative-path>' with { type: 'file' };` statement per file found by a recursive walk of `dist/public/`, with `/` as the separator on every host. The `type: 'file'` attribute is load-bearing: without it Bun applies its JavaScript loader to `public/app.js`, `public/home.js` and `public/theme-init.js` instead of embedding them as bytes.
2. `import fs from 'node:fs';`, `import os from 'node:os';` and `import path from 'node:path';`.
3. A guarded assignment of `process.env.PRAXIS_APP_VERSION` to the version string read from `package.json` at generation time, applied only when the variable is absent or empty. `??=` is wrong here, because an environment variable set to the empty string is `''`, not `undefined`.
4. A guarded assignment of `process.env.PRAXIS_DATA_DIR` to the CLI data directory, `path.join(os.homedir(), '.flowcharge')`, applied under the same emptiness test, followed by `fs.mkdirSync(dir, { recursive: true })`.
5. `await import('./server.js');` as the last statement.

Step 5 must be a dynamic import, not a static one. `src/server.ts`, `src/lib/projects.ts` and `src/lib/update-prefs.ts` all read their environment at module scope, and a static import would hoist and evaluate before steps 3 and 4 run. `electron/main.cts:68` carries the same constraint and solves it the same way.

Setting `PRAXIS_DATA_DIR` also makes `src/lib/projects.ts:24`'s `isPackaged` true, which suppresses the app's own repository self-entry. That is the correct behaviour for a distributed executable, and reconnaissance confirmed the binary starts with an empty project list.

### Contract: `tools/package-cli.mjs`

A plain ESM Node script, matching `tools/copy-assets.mjs` and `tools/bundle-public.mjs`: no build framework, one `console.log` per action, options as CLI flags rather than environment variables, for the reason `tools/bundle-public.mjs:19-21` already records.

- Target table, four rows, each carrying a Bun target string and the `<platform>-<arch>` label used in the output filename: `bun-darwin-arm64` to `darwin-arm64`, `bun-darwin-x64` to `darwin-x64`, `bun-linux-x64` to `linux-x64`, `bun-windows-x64` to `win-x64`.
- `--target=<label>` filters to one or more rows, repeatable. With no such flag every row is built.
- Reads `version` from `package.json` and uses it in every output name.
- Refuses to run, with a message naming `npm run build:release`, when `dist/public/` is missing or holds no files.
- Refuses to run, with a message, when `bun` is not resolvable on `PATH`.
- Generates `dist/cli-entry.js`, then runs `bun build --compile --asset-naming='[dir]/[name].[ext]' --target=<bunTarget> --outfile=release/cli/flowcharge-<version>-<label> dist/cli-entry.js` per selected row. Bun appends `.exe` itself for the Windows target, so the script passes the base name.
- Creates `release/cli/` if absent. It never deletes anything.

The `package:cli` npm script is `npm run build:release && node tools/package-cli.mjs`, matching the `package:mac` precedent. Chaining `build:release` is what makes acceptance criterion 1 hold on a clean checkout, and it is what applies the `--harden` obfuscation pass that a distributed executable should carry. The script's own `dist/public/` existence guard above stays as a second line of defence, for a direct `node tools/package-cli.mjs` invocation.

This script knows the repository's build layout, the version field and the Bun target names. It must not know anything about the server's routes, the board payload, `flowcharge/` parsing, or Electron.

### Contract: the two `src/server.ts` seams

`APP_VERSION` at `src/server.ts:67-81`: the IIFE returns `process.env.PRAXIS_APP_VERSION` when that value is a non-empty string, and otherwise performs today's `package.json` read unchanged. The surrounding comment is updated to state both sources.

`INSTALL_REGISTRY_PATH` at `src/server.ts:83-88`: the directory becomes `process.env.PRAXIS_DATA_DIR` when set and non-empty, and otherwise `path.join(__dirname, '..')` as today. The filename stays `.praxis-installs.json`. This mirrors `src/lib/projects.ts:22` and `src/lib/update-prefs.ts:20` exactly, so the codebase has one data-directory seam rather than two. The existing comment, which states that `PRAXIS_DATA_DIR` is deliberately not consulted, is replaced by one that records why it now is and why the Electron transport is unaffected.

### Naming, versioning and output location

Output goes to `release/cli/`. `release/` is already gitignored and is already electron-builder's output directory, so no new ignore entry is needed, and the `cli/` subdirectory keeps the two producers' artefacts apart.

The filename pattern is `flowcharge-<version>-<platform>-<arch>`. `<version>` comes from `package.json`, which is `0.1.0`. That version correction is already an uncommitted change in the working tree and is folded into this workstream's first commit.

## Stages

1. **Compiled host binary that works end to end.** Add the two `src/server.ts` seams, add `tools/package-cli.mjs` and the `package:cli` npm script, and build the `darwin-arm64` target. This holds first position because every unknown in the workstream is a runtime question about the embedded filesystem, and only a running binary answers it. Observable at the end: `npm run package:cli -- --target=darwin-arm64` produces `release/cli/flowcharge-0.1.0-darwin-arm64`, and that file satisfies acceptance criteria 2 through 7.
2. **The remaining three targets.** Extend the run to `darwin-x64`, `linux-x64` and `win-x64` and produce all four in one invocation. It holds second position because cross-compilation is a flag change over a mechanism the previous stage already proved. Observable at the end: `npm run package:cli` writes four correctly named files to `release/cli/`, each one reporting the expected executable format for its platform, and the `darwin-x64` file additionally runs here under Rosetta 2 and satisfies acceptance criteria 2 and 3 only. That Rosetta run carries the AVX caveat the Testing strategy states, so it is not evidence about genuine Intel hardware.

## Data & compatibility

There is no migration. The CLI executable starts with an empty data directory and writes `.praxis-projects.json`, `.praxis-update.json` and `.praxis-installs.json` into it as the user acts.

Backward compatibility is unconditional in both directions. With `PRAXIS_APP_VERSION` and `PRAXIS_DATA_DIR` unset, both `src/server.ts` seams evaluate to today's expressions, so `npm start`, `npm run electron:dev` and `npm test` are unaffected. A packaged Electron build already sets `PRAXIS_DATA_DIR` at `electron/main.cts:61`, so its HTTP transport would now resolve the install registry into `userData` rather than into the read-only `app.asar`. That is a strict improvement, and it changes nothing a user sees, because the Electron renderer reaches the integrations engine over IPC rather than over HTTP.

Rollback is a plain revert. The two seams, one new tool script and one new npm script are the whole change, nothing persistent is created in the repository, and `release/cli/` is untracked. A user rolls back by deleting the executable; the `npm start` path is untouched.

## Testing strategy

Stage 1:

- Unit coverage for the `PRAXIS_APP_VERSION` seam, following the child-process pattern `src/lib/projects.test.ts:21-40` already established for exactly this problem. A module-scope environment read cannot be re-evaluated inside one process, so the test drives the compiled module from a child process with the variable set, and a second child with it unset to prove the `package.json` fallback still holds.
- Unit coverage for the `INSTALL_REGISTRY_PATH` seam by the same child-process method, asserting the registry lands inside the temporary directory and not at the repository root, mirroring `src/lib/projects.test.ts:40-50`.
- Integration verification against the running `darwin-arm64` executable, covering acceptance criteria 2 through 7, run from a temporary data directory.

Stage 2:

- Structural verification of all four artefacts: each file exists, is non-empty, and reports its expected format. Reconnaissance confirmed `file` reports `Mach-O 64-bit executable arm64`, `Mach-O 64-bit executable x86_64`, `ELF 64-bit LSB executable, x86-64` and `PE32+ executable (console) x86-64` for the four targets.

The compile step is not wired into `npm test`. Each artefact is 64 MB to 100 MB and a full four-target run downloads a Bun runtime per target on first use, which would make the test command unusable as a fast loop. WS-93-pxw80u owns the CI gate.

Three verification limits are real and are stated rather than worked around. The `linux-x64` and `win-x64` executables cannot be run on this macOS development machine, so their verification stops at the structural check above; a runtime check needs a Linux host and a Windows host. The `darwin-x64` executable does run here under Rosetta 2, but it prints `warn: CPU lacks AVX support, strange crashes may occur`, because Rosetta 2 does not emulate AVX. A real Intel Mac has AVX and does not print it. A Rosetta run is therefore a partial check only, and is not evidence about the binary's behaviour on genuine Intel hardware.

The third limit sits in acceptance criterion 8. Its `npm run package:mac` claim is verified by `npm run build:release` plus a structural diff check on the `build` block in `package.json`, not by a real `package:mac` run. A real run needs Apple signing credentials this environment does not have, and signing and notarization are out of scope here and deferred to WS-94-ked1ye. This plan accepts that gap rather than working around it: the substitute proves the electron-builder configuration and the shared build chain are unchanged, and it proves nothing about a signed `.dmg`.

## Open questions

None. The one question this plan raised — the CLI data directory location, `~/.flowcharge/` versus Electron's `app.getPath('userData')` path — has already been settled: adopted as `~/.flowcharge/`, per the plan's own recommendation. The reason stands as recorded: it is one line of `os.homedir()` and `path.join`, it is the ordinary convention for a CLI tool, and it does not couple the executable to Electron's own path algorithm, which is Electron's implementation detail and may change. The accepted cost is that a user running both distribution forms keeps two separate project lists.

## Adjacent opportunities

Not requested. None of these is planned, and none appears in a stage, a criterion or a contract.

- Windows executable metadata through Bun's `--windows-icon`, `--windows-title` and `--windows-publisher` flags. Skip: this belongs with the release presentation in WS-91-mecfuo.
- A `--open` flag that launches the default browser at the bound URL. Skip: D-26 states the user opens `localhost:4173` themselves.
- README instructions for building and running the CLI executable. Skip: WS-90-1gmwvj and WS-92-t964y8 own the public-facing text.

## Alternatives considered and rejected

- Ship `dist/public/` as a data directory beside the executable. Rejected: it defeats single-file distribution, which is the whole point of D-26.
- Generate a module of base64-encoded asset strings compiled into `dist/`. Rejected: it adds a generated source surface and holds every asset in memory twice, when `--asset-naming='[dir]/[name].[ext]'` already makes the existing `fs.readFile` path at `src/server.ts:896` work unchanged.
- Split the packaging script per platform as `package:cli-mac`, `package:cli-linux` and `package:cli-win`, mirroring `package:mac` and its siblings. Rejected: electron-builder forces that split because it cannot cross-build, while Bun produces all four targets from one host, so a single `package:cli` with an optional `--target` filter is the honest shape.
- Compile `dist/server.js` directly and embed the assets by passing them as extra entry points. Rejected: `bun build --help` on the installed version documents no multi-entry embedding for `--compile`, and the generated entry is needed regardless, to set both environment variables before `server.js` evaluates.
- Use `--bytecode` for faster startup. Rejected: it requires `--format=cjs`, the entry needs a top-level `await import()`, and startup time is not a stated problem.

## Final summary

The approach compiles a generated `dist/cli-entry.js` that embeds `dist/public/` as Bun assets and sets two environment variables before importing the existing server. Two stages, both small: a working macOS arm64 binary first, then the other three targets. The change set is two one-line env-gated seams in `src/server.ts`, one new `tools/package-cli.mjs`, and one new `package:cli` npm script.

Top risks: the Linux and Windows binaries cannot be run on this machine, so their verification is structural only; the `darwin-x64` binary can only be partially checked here, under Rosetta 2, which reports a spurious AVX warning; and each artefact is 64 MB to 100 MB, which is inherent to Bun's runtime being embedded.

The one question this plan raised is settled: the CLI executable's data directory is `~/.flowcharge/`, not Electron's per-OS `userData` path.

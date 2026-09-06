---
id: TL-92-ojzmkn
type: tasklist
workstream: WS-89-t2g5to
slug: bun-cli-binary-packaging
title: "Compile FlowCharge Board into single-file Bun CLI binaries"
status: done
created: 2026-09-04
updated: 2026-09-04
author: Anthony Koukoullis
depends_on: [PLN-79-w9eeom]
links: []
mode: spec
base_commit: 25c1995
---

# FlowCharge Tasks

## Compile FlowCharge Board into single-file Bun CLI binaries

FlowCharge Board ships as a single-file native executable for macOS (arm64 and x64), Linux (x64) and Windows (x64). Running the executable starts the existing HTTP server from `src/server.ts`, and the user opens the board at `http://127.0.0.1:4173`.

The approach compiles a generated entry file, `dist/cli-entry.js`, not `dist/server.js` directly. That entry declares every file under `dist/public/` as an embedded Bun asset, sets `PRAXIS_DATA_DIR` to `~/.flowcharge`, injects `PRAXIS_APP_VERSION`, and only then dynamically imports `./server.js`. A new Node script, `tools/package-cli.mjs`, generates that entry and drives `bun build --compile` once per target.

`--asset-naming='[dir]/[name].[ext]'` puts the embedded assets at `/$bunfs/root/public/...`, which is where `src/server.ts:29`'s `root` constant already looks, so the static-file branch needs no change. Two constants do need env-gated seams, because they resolve outside the read-only embedded filesystem: `APP_VERSION` at `src/server.ts:67-81` and `INSTALL_REGISTRY_PATH` at `src/server.ts:83-88`. With both variables unset, behaviour is byte-for-byte today's behaviour.

Stage 1 proves one running `darwin-arm64` binary end to end. Stage 2 produces all four targets in one invocation and verifies them structurally, plus a partial Rosetta 2 run of `darwin-x64`.

The full design, contracts and acceptance criteria are in `PLN-79-w9eeom-plan.md`. Read that plan before executing any task here.

Baselines measured at `25c1995` and used by the `verify` steps below: `grep -cF 'process.env.PRAXIS_APP_VERSION' src/server.ts` returned `0`; `grep -cF 'process.env.PRAXIS_DATA_DIR' src/server.ts` returned `0`; `grep -c 'deliberately NOT consulted' src/server.ts` returned `1`; `tools/package-cli.mjs`, `src/server-env-seams.test.ts`, `dist/cli-entry.js`, `release/cli/` and a repository-root `.praxis-installs.json` were all absent; `package.json` had no `package:cli` script and `version` was already `0.1.0`; `dist/public/` held exactly 8 files.

- [x] 1. Compiled host binary that works end to end

  ```yaml
  description: "Add the two src/server.ts env seams, add tools/package-cli.mjs and the package:cli npm script, then build and prove the darwin-arm64 executable against acceptance criteria 2 through 7. Acceptance criterion 8 is confirmed separately against the existing entry points — npm start, npm test and the diff check — and not against the executable."
  ```

  - [x] 1.1 Add the `PRAXIS_APP_VERSION` seam to `src/server.ts`
    ```yaml
    description: "Make APP_VERSION read process.env.PRAXIS_APP_VERSION first, falling back unchanged to the package.json read."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read src/server.ts lines 60-95 before touching anything. The block below was copied from the file at 25c1995; if it does not match, re-anchor it against the APP_VERSION IIFE as it actually reads now."
      - |
        src/server.ts
        <<<<<<< SEARCH
        // The app's own version, read from package.json ONCE at module load rather than
        // per request. `__dirname` is `dist/` in the compiled output, so package.json
        // sits one level up. Any failure — unreadable file, invalid JSON, a missing or
        // non-string `version` field — logs once and leaves this null, and the route
        // below answers 500 instead of throwing.
        const APP_VERSION: string | null = (() => {
          try {
        =======
        // The app's own version, from one of two sources. PRAXIS_APP_VERSION wins when
        // it is set to a non-empty string: a Bun standalone executable carries no
        // package.json on its read-only embedded filesystem, so dist/cli-entry.js
        // injects the version there at build time. With that variable unset or empty —
        // `npm start`, `npm test`, `npm run electron:dev` — this falls back to reading
        // package.json ONCE at module load rather than per request, exactly as before.
        // `__dirname` is `dist/` in the compiled output, so package.json sits one level
        // up. Any failure — unreadable file, invalid JSON, a missing or non-string
        // `version` field — logs once and leaves this null, and the route below answers
        // 500 instead of throwing.
        //
        // An explicit emptiness test, never `??=`: an environment variable set to the
        // empty string is '', not undefined, and '' must fall through to package.json.
        const APP_VERSION: string | null = (() => {
          const injected = process.env.PRAXIS_APP_VERSION;
          if (typeof injected === 'string' && injected !== '') return injected;
          try {
        >>>>>>> REPLACE
      - "Change nothing else in src/server.ts in this task. The INSTALL_REGISTRY_PATH constant below it belongs to task 1.2."
    pattern: "src/server.ts only — the APP_VERSION IIFE at lines 67-81 as read at 25c1995."
    imports: "None. The seam uses process.env only; the existing fs, path and fileURLToPath imports stay as they are."
    compatibility: "PLN-79-w9eeom, Design → 'Contract: the two src/server.ts seams'. TypeScript strict mode: process.env.PRAXIS_APP_VERSION is string | undefined under @types/node, which the typeof guard narrows."
    gotcha: "Do not use ??= or ||= shorthand on the const, and do not use `process.env.PRAXIS_APP_VERSION ?? readPackageJson()` — ?? treats '' as a value, and an environment variable set to the empty string must fall through to package.json. The early return must sit before the try block, not inside it, so a package.json read failure cannot mask an injected version."
    verify:
      - "grep -cF 'process.env.PRAXIS_APP_VERSION' src/server.ts — returned 0 at 25c1995; must return 1 after the edit."
      - "npx tsc -p tsconfig.json --noEmit — must exit 0 with no output."
      - "npm run build && PORT=0 HOST=127.0.0.1 PRAXIS_APP_VERSION=9.9.9-seam node --input-type=module -e \"const {serverReady}=await import('./dist/server.js'); const p=await serverReady; const r=await fetch('http://127.0.0.1:'+p+'/api/version'); console.log(r.status, await r.text()); process.exit(0);\" — must print 200 {\"version\":\"9.9.9-seam\"}. At 25c1995 the same command prints 200 {\"version\":\"0.1.0\"}, so the step discriminates."
      - "Repeat the previous command with PRAXIS_APP_VERSION unset — must print 200 {\"version\":\"0.1.0\"}, proving the package.json fallback is untouched."
    checklist:
      - "Does grep -cF 'process.env.PRAXIS_APP_VERSION' src/server.ts return exactly 1?"
      - "Is the injected-value test an explicit non-empty string check rather than ??, ??= or ||?"
      - "With PRAXIS_APP_VERSION unset, does /api/version still answer package.json's version?"
      - "Does npx tsc -p tsconfig.json --noEmit exit 0?"
      - "Is src/server.ts the only file this task changed?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Add the `PRAXIS_DATA_DIR` seam to `src/server.ts`
    ```yaml
    description: "Make INSTALL_REGISTRY_PATH resolve its directory from process.env.PRAXIS_DATA_DIR when set, falling back unchanged to path.join(__dirname, '..')."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read src/server.ts lines 80-95 before touching anything. The block below was copied from the file at 25c1995; if it does not match, re-anchor it against the INSTALL_REGISTRY_PATH declaration as it actually reads now."
      - |
        src/server.ts
        <<<<<<< SEARCH
        // The install registry both transports share. `__dirname` is `dist/` in the
        // compiled output, so this resolves to the same file
        // electron/agentic-tools-ipc-handlers.cts:234-235 resolves to. PRAXIS_DATA_DIR
        // is deliberately NOT consulted here: both transports must resolve one registry
        // file, and the Electron handler does not consult it either.
        const INSTALL_REGISTRY_PATH = path.join(__dirname, '..', '.praxis-installs.json');
        =======
        // The install registry this HTTP transport uses. PRAXIS_DATA_DIR wins when it is
        // set and non-empty, mirroring src/lib/projects.ts:22 and
        // src/lib/update-prefs.ts:20 exactly, so the codebase carries one data-directory
        // seam rather than two. A Bun standalone executable resolves `__dirname` inside
        // the read-only /$bunfs, where nothing can be written, and dist/cli-entry.js
        // sets PRAXIS_DATA_DIR before this module evaluates.
        //
        // This does not split the registry in Electron. src/public/browser-ipc-shim.ts:90
        // installs the HTTP-backed window.praxisSkillInstallAPI only when the property is
        // absent, and electron/preload.cts injects it inside an Electron window, so these
        // integrations HTTP routes are unreachable there — the renderer reaches the
        // install engine over IPC instead.
        //
        // With PRAXIS_DATA_DIR unset this is byte-for-byte the previous path: `__dirname`
        // is `dist/` in the compiled output, so the file sits one level up.
        const INSTALL_REGISTRY_PATH = path.join(
          process.env.PRAXIS_DATA_DIR || path.join(__dirname, '..'),
          '.praxis-installs.json',
        );
        >>>>>>> REPLACE
      - "Change nothing else in src/server.ts in this task, and change nothing under electron/ — PLN-79-w9eeom's Out of scope section rules the whole of electron/ out, including the pre-existing defect at electron/agentic-tools-ipc-handlers.cts:251-252."
    pattern: "src/server.ts only — the INSTALL_REGISTRY_PATH declaration at lines 83-88 as read at 25c1995."
    imports: "None. path is already imported at src/server.ts:5."
    compatibility: "PLN-79-w9eeom, Design → 'Contract: the two src/server.ts seams'. The `||` idiom is deliberate: it is the exact form src/lib/projects.ts:22 and src/lib/update-prefs.ts:20 already use, so all three data-directory reads treat '' the same way."
    gotcha: "Do not introduce a second exported constant for the directory — one const keeps the seam a single line of resolution. Do not use ?? here: '' must fall through, which || gives and ?? does not. The filename stays exactly '.praxis-installs.json'; changing it would orphan any existing registry."
    verify:
      - "grep -c 'deliberately NOT consulted' src/server.ts — returned 1 at 25c1995; must return 0 after the edit."
      - "grep -cF 'process.env.PRAXIS_DATA_DIR' src/server.ts — returned 0 at 25c1995; must return 1 after the edit."
      - "npx tsc -p tsconfig.json --noEmit — must exit 0 with no output."
      - "npm run build, then create a temp dir, write a single-record JSON array to <tmp>/.praxis-installs.json (a bare array of one object carrying toolId, resolvedPath, format, scope, installedAt, updatedAt and contentHash — parseInstallRegistry accepts any JSON array), then run: PORT=0 HOST=127.0.0.1 PRAXIS_DATA_DIR=<tmp> node --input-type=module -e \"const {serverReady}=await import('./dist/server.js'); const p=await serverReady; const r=await fetch('http://127.0.0.1:'+p+'/api/integrations/installs'); console.log(JSON.stringify(await r.json())); process.exit(0);\" — must print the seeded record. At 25c1995 it prints [], because no .praxis-installs.json exists at the repository root, so the step discriminates."
      - "Repeat the previous command with PRAXIS_DATA_DIR unset — must print [], proving the repository-root fallback is untouched. Remove the temp dir afterwards."
    checklist:
      - "Does grep -c 'deliberately NOT consulted' src/server.ts return 0?"
      - "Does grep -cF 'process.env.PRAXIS_DATA_DIR' src/server.ts return exactly 1?"
      - "Does the fallback still evaluate to path.join(__dirname, '..', '.praxis-installs.json') with the variable unset?"
      - "Does the replacement comment record why PRAXIS_DATA_DIR is now consulted and why the Electron transport is unaffected?"
      - "Is src/server.ts the only file this task changed, with nothing under electron/ touched?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Add unit coverage for both `src/server.ts` seams
    ```yaml
    description: "Add src/server-env-seams.test.ts, driving the compiled server from child processes to prove both seams and both fallbacks."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read src/lib/projects.test.ts in full first, especially runInChildProcess at lines 20-38 and the two tests at lines 40-72. Copy that pattern: execFileSync(process.execPath, ['--input-type=module', '-e', driver], { env: { ...process.env, VAR: value }, encoding: 'utf8' }), with the driver dynamically importing the compiled module and printing JSON on stdout for the parent to assert on."
      - "Create a NEW file src/server-env-seams.test.ts. Do not add these tests to src/server.test.ts: that file imports ./server.js in-process at module scope, so its environment is already fixed and a second set of values cannot be observed there."
      - "Give the file a header comment stating why the child-process pattern is required — src/server.ts reads both PRAXIS_APP_VERSION and PRAXIS_DATA_DIR once at module scope, so ESM module caching means one process cannot exercise both the set and unset branches."
      - "Write a driver helper that spawns a child with a supplied env overlay, always including PORT=0 and HOST=127.0.0.1, imports ../server.js (resolved from the compiled dist/ location the same way projects.test.ts resolves projects.js, via fileURLToPath(import.meta.url)), awaits the module's exported serverReady promise for the bound port, performs one fetch against a supplied route, prints the status and body as JSON, and exits."
      - "Test 1 — PRAXIS_APP_VERSION set: spawn with PRAXIS_APP_VERSION set to a sentinel that cannot be package.json's value, fetch /api/version, assert status 200 and that version equals the sentinel."
      - "Test 2 — PRAXIS_APP_VERSION unset and PRAXIS_APP_VERSION empty: spawn twice, fetch /api/version, and assert both answer 200 with the version field from the repository's own package.json, read independently in the test rather than hardcoded. This is the case that proves '' falls through rather than becoming the answer."
      - "Test 3 — PRAXIS_DATA_DIR set: mkdtemp a directory, write a one-record install registry to <tmp>/.praxis-installs.json, spawn with PRAXIS_DATA_DIR pointing at it, fetch /api/integrations/installs, assert status 200 and that the seeded record comes back. Mirrors src/lib/projects.test.ts:40-50, which asserts the file lands inside PRAXIS_DATA_DIR and not at the repository root."
      - "Test 4 — PRAXIS_DATA_DIR unset: spawn with the variable removed from the child environment, fetch /api/integrations/installs, assert the seeded record is NOT present, proving the fallback still resolves to the repository root."
      - "Clean up every temp directory in a finally block, exactly as projects.test.ts does."
    pattern: "New file src/server-env-seams.test.ts. It compiles to dist/server-env-seams.test.js, which package.json's test glob \"dist/**/*.test.js\" already matches, so no script change is needed."
    imports: "node:test, node:assert/strict, node:fs, node:os, node:path, node:child_process (execFileSync) and node:url (fileURLToPath) — the same set src/lib/projects.test.ts uses."
    compatibility: "PLN-79-w9eeom, Testing strategy → Stage 1, first two bullets. Runs under `node --test --test-force-exit` per package.json's existing test script; the force-exit flag is already there because importing the server binds a listening socket."
    gotcha: "PORT=0 in every child is load-bearing — a fixed 4173 makes two children collide and makes the suite fail when the developer already has the board running. Delete PRAXIS_APP_VERSION and PRAXIS_DATA_DIR from the child env explicitly for the unset cases rather than assuming the parent shell lacks them. Never assert a hardcoded version string; read package.json in the test so a future version bump does not break it. Do not perform a real install to exercise the registry seam — getInstallContent is a live network call; seeding the registry file and reading it back keeps the suite offline."
    verify:
      - "test -f src/server-env-seams.test.ts — absent at 25c1995, so this fails there."
      - "npm run build && node --test --test-force-exit dist/server-env-seams.test.js — must report 4 passing tests and 0 failing."
      - "npm test — the whole suite must stay green, with the new file included in the run."
    checklist:
      - "Does the new file exist at src/server-env-seams.test.ts, separate from src/server.test.ts?"
      - "Does every case run in its own child process with PORT=0?"
      - "Are all four branches covered — PRAXIS_APP_VERSION set and unset, PRAXIS_DATA_DIR set and unset?"
      - "Is the expected version read from package.json rather than hardcoded?"
      - "Does the suite make no network call and leave no temp directory behind?"
      - "Does npm test still exit 0 across the whole suite?"
    self_eval:
      passed: true
      failures:
        - item: "Does the new file exist at src/server-env-seams.test.ts, separate from src/server.test.ts?"
          reason: "The file was created, but tsconfig.json's include array is an explicit file list, not a glob, so the new test never compiled and dist/server-env-seams.test.js did not exist. The task's pattern field assumed the file would compile on its own."
          fix: "Added \"src/server-env-seams.test.ts\" to tsconfig.json's include array, beside the existing \"src/server.test.ts\" entry. This is the one change strictly required to make the in-scope new file compile and run. Nothing else in tsconfig.json was touched. All 4 tests then passed and npm test stayed green at 161 tests."
    ```

  - [x] 1.4 Add `tools/package-cli.mjs`
    ```yaml
    description: "Add the plain ESM Node script that generates dist/cli-entry.js and drives bun build --compile once per selected target."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read tools/copy-assets.mjs and tools/bundle-public.mjs first and match their house style exactly: plain ESM, no build framework, __dirname via fileURLToPath(import.meta.url), repoRoot via path.join(__dirname, '..'), one console.log per action, options as CLI flags rather than environment variables for the reason bundle-public.mjs:19-21 records."
      - "Define the four-row target table, each row carrying a Bun target string and the label used in the output filename: bun-darwin-arm64 to darwin-arm64, bun-darwin-x64 to darwin-x64, bun-linux-x64 to linux-x64, bun-windows-x64 to win-x64."
      - "Parse a repeatable --target=<label> flag from process.argv. With no such flag, select every row. Refuse an unrecognised label with a message listing the four valid ones."
      - "Read the version field from package.json at repoRoot."
      - "Guard 1 — refuse to run when dist/public/ is missing or holds no files, with a message naming `npm run build:release`. Use the same hand-rolled recursive walk copy-assets.mjs uses at its findSourceMaps, for consistency with its siblings, and because dirent.isDirectory() means symlinked directories are not followed. The hand-rolled walk is a house-style choice, not a version constraint: package.json's engines field is node >=20.14, so readdirSync's recursive option (Node 18.17 and later) is in fact available."
      - "Guard 2 — refuse to run with a clear message when bun is not resolvable on PATH. Probe it by spawning `bun --version` and treating a spawn failure or a non-zero exit as absent."
      - "Generate dist/cli-entry.js, overwritten on every run, with exactly the content PLN-79-w9eeom's 'Contract: dist/cli-entry.js' section specifies, in this order: (1) one `import './public/<relative-path>' with { type: 'file' };` per file found by the recursive walk of dist/public/, always with '/' as the separator whatever the host; (2) `import fs from 'node:fs';`, `import os from 'node:os';`, `import path from 'node:path';`; (3) a guarded assignment of process.env.PRAXIS_APP_VERSION to the version string read above, applied only when the variable is absent or empty; (4) a guarded assignment of process.env.PRAXIS_DATA_DIR to path.join(os.homedir(), '.flowcharge') under the same emptiness test, followed by fs.mkdirSync(dir, { recursive: true }); (5) `await import('./server.js');` as the last statement."
      - "Create release/cli/ if absent, with fs.mkdirSync recursive. The script never deletes anything."
      - "For each selected row run: bun build --compile --asset-naming='[dir]/[name].[ext]' --target=<bunTarget> --outfile=release/cli/flowcharge-<version>-<label> dist/cli-entry.js. Pass the base name only — Bun appends .exe itself for the Windows target. Run each build synchronously with inherited stdio and stop on the first non-zero exit."
      - "Keep this script's knowledge to the repository's build layout, the version field and the Bun target names. It must know nothing about the server's routes, the board payload, flowcharge/ parsing, or Electron."
      - "Change nothing in tools/copy-assets.mjs or tools/bundle-public.mjs, and change nothing under dist/public/ — PLN-79-w9eeom rules all three out of scope."
    pattern: "New file tools/package-cli.mjs. It also writes the generated dist/cli-entry.js, which is never committed; dist/ is already gitignored."
    imports: "node:fs, node:os, node:path, node:url (fileURLToPath) and node:child_process (spawnSync or execFileSync). No new package.json dependency — bun is a PATH tool, not a devDependency, per PLN-79-w9eeom's Assumptions."
    compatibility: "PLN-79-w9eeom, Design → 'Contract: dist/cli-entry.js' and 'Contract: tools/package-cli.mjs'. Node >= 20.14 per package.json engines, though the walk follows copy-assets.mjs's hand-rolled recursion for consistency with its siblings."
    gotcha: "The `with { type: 'file' }` attribute is load-bearing: without it Bun applies its JavaScript loader to public/app.js, public/home.js and public/theme-init.js and embeds transformed code instead of bytes. Step 5 must be a dynamic import, never a static one — src/server.ts, src/lib/projects.ts and src/lib/update-prefs.ts all read their environment at module scope, and a static import hoists above steps 3 and 4; electron/main.cts:68 carries the same constraint and solves it the same way. Use an explicit emptiness test in the generated guards, not ??=, because an environment variable set to '' is '' and not undefined. Emit forward slashes in the import specifiers even on Windows. Quote the --asset-naming value so the shell cannot glob the brackets."
    verify:
      - "test -f tools/package-cli.mjs — absent at 25c1995, so this fails there."
      - "npm run build:release, then mv dist/public dist/public.bak && node tools/package-cli.mjs --target=darwin-arm64; echo $? — must exit non-zero with a message naming `npm run build:release`. Then mv dist/public.bak dist/public."
      - "env PATH=/usr/bin:/bin \"$(command -v node)\" tools/package-cli.mjs --target=darwin-arm64; echo $? — must exit non-zero with a message about bun. bun lives at /Users/akoukoullis/.bun/bin/bun, so this PATH genuinely hides it. node is called by absolute path because it lives outside /usr/bin and /bin too, and a bare `node` here would fail to resolve and prove nothing about the guard."
      - "node tools/package-cli.mjs --target=no-such-label; echo $? — must exit non-zero and list the four valid labels."
      - "node tools/package-cli.mjs --target=darwin-arm64 && grep -c \"with { type: 'file' }\" dist/cli-entry.js — must return 8, the file count under dist/public/ at 25c1995 (index.html, board.html, styles.css, theme-init.js, home.js, app.js, img/flowcharge-mark.png, img/flowcharge-wordmark.png). At 25c1995 dist/cli-entry.js does not exist at all."
      - "tail -1 dist/cli-entry.js — must be exactly: await import('./server.js');"
      - "grep -c 'os.homedir' dist/cli-entry.js — must return at least 1, and grep -c 'mkdirSync' dist/cli-entry.js must return at least 1."
      - "git status --porcelain tools/ dist/ — must show tools/package-cli.mjs as the only new tracked path; dist/ stays ignored."
    checklist:
      - "Does the script refuse, naming `npm run build:release`, when dist/public/ is missing or empty?"
      - "Does the script refuse with a clear message when bun is not on PATH?"
      - "Does dist/cli-entry.js carry one `with { type: 'file' }` import per file under dist/public/, with forward slashes?"
      - "Is `await import('./server.js');` the last statement in the generated entry, with both env assignments above it?"
      - "Are both generated env guards explicit emptiness tests rather than ??=?"
      - "Does the script build every target when no --target flag is given, and only the named ones when it is?"
      - "Did this task leave tools/copy-assets.mjs, tools/bundle-public.mjs and dist/public/ untouched?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.5 Add the `package:cli` npm script
    ```yaml
    description: "Add package:cli to package.json's scripts, chaining build:release before the packaging script, and keep the version field at 0.1.0."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read package.json's scripts block first. At 25c1995 it ends with package:win on line 26."
      - "Add one entry after package:win: \"package:cli\": \"npm run build:release && node tools/package-cli.mjs\" — matching the package:mac precedent on line 24, which also chains build:release."
      - "Leave the version field at 0.1.0. It is already corrected from the npm-init default and committed at 25c1995, which is PLN-79-w9eeom's 'Naming, versioning and output location' section folding that correction into this workstream's own commit rather than treating it as unrelated noise."
      - "Change nothing else in package.json — not the build block, not devDependencies, not the existing scripts. PLN-79-w9eeom rules CI wiring, code signing and notarization out of scope."
    pattern: "package.json, scripts block only."
    imports: "None."
    compatibility: "PLN-79-w9eeom, Design → 'Contract: tools/package-cli.mjs', final paragraph. Chaining build:release is what makes acceptance criterion 1 hold on a clean checkout and what applies the --harden obfuscation pass a distributed executable should carry."
    gotcha: "Do not replace the guard inside tools/package-cli.mjs with this chain — the plan keeps the script's own dist/public/ existence check as a second line of defence for a direct `node tools/package-cli.mjs` invocation. Passing a target through npm needs the -- separator: `npm run package:cli -- --target=darwin-arm64`."
    verify:
      - "node -p \"require('./package.json').scripts['package:cli']\" — printed undefined at 25c1995; must print: npm run build:release && node tools/package-cli.mjs"
      - "node -p \"require('./package.json').version\" — must print 0.1.0. This already passes at 25c1995, because the correction is committed there; the step does not discriminate, and it is here to stop the correction being reverted or lost while this file is edited."
      - "npm run package:cli -- --target=darwin-arm64 — must exit 0."
      - "git diff --name-only package.json && node -p \"Object.keys(require('./package.json').scripts).length\" — must print package.json and 15. At 25c1995 the diff half prints nothing, because the version correction is committed there, and the count half prints 14, so the step discriminates."
    checklist:
      - "Is package:cli exactly `npm run build:release && node tools/package-cli.mjs`?"
      - "Is the version field still 0.1.0?"
      - "Does the scripts block still hold all 14 pre-existing entries unchanged?"
      - "Is package.json's build block byte-for-byte unchanged?"
      - "Does npm run package:cli -- --target=darwin-arm64 exit 0?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.6 Build the `darwin-arm64` executable and prove it serves the board
    ```yaml
    description: "Produce release/cli/flowcharge-0.1.0-darwin-arm64 and verify acceptance criteria 2, 3 and 4 against it."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run npm run package:cli -- --target=darwin-arm64 from a clean working tree."
      - "Copy the produced executable, and nothing else, into an empty temp directory, so the run proves acceptance criterion 2's 'no files beside it' condition."
      - "Run it with HOME pointed at a second empty temp directory, so the entry's os.homedir() resolves ~/.flowcharge inside the temp tree and the developer's real ~/.flowcharge is never touched. Pass no arguments and set no PORT, HOST or PRAXIS_DATA_DIR."
      - "Exercise acceptance criteria 2, 3 and 4 against the running process with curl, then stop it and remove both temp directories."
      - "Author no code in this task. If anything fails here, the fix belongs in task 1.1, 1.2 or 1.4, not in a new file."
    pattern: "release/cli/flowcharge-0.1.0-darwin-arm64 — a build artefact, not a tracked file. release/ is already gitignored as electron-builder's output directory."
    imports: "bun on PATH (1.3.14 at /Users/akoukoullis/.bun/bin/bun), curl and file. No repository change."
    compatibility: "PLN-79-w9eeom acceptance criteria 2, 3 and 4, and Stages → stage 1's stated observable. The assets land at /$bunfs/root/public/... under --asset-naming='[dir]/[name].[ext]', which is where src/server.ts:29's root constant already looks, so the static branch at src/server.ts:896 is unchanged."
    gotcha: "Port 4173 must be free — the server's error listener rejects on EADDRINUSE, so stop any `npm start` or Electron dev session first. Set HOME rather than deleting anything: the entry calls fs.mkdirSync(path.join(os.homedir(), '.flowcharge'), { recursive: true }) and would otherwise write into the real home directory. The artefact is 64 MB to 100 MB, which is inherent to Bun's embedded runtime and is not a fault."
    verify:
      - "test -s release/cli/flowcharge-0.1.0-darwin-arm64 — absent at 25c1995, so this fails there."
      - "file release/cli/flowcharge-0.1.0-darwin-arm64 — must report Mach-O 64-bit executable arm64."
      - "Criterion 2 — run the copied executable with HOME=<tmp-home> and no arguments; its stdout must contain exactly: FlowCharge running at http://127.0.0.1:4173, and lsof -nP -iTCP:4173 -sTCP:LISTEN must show it bound."
      - "Criterion 3 — for each of / , /board.html, /styles.css, /theme-init.js, /home.js, /app.js, /img/flowcharge-wordmark.png and /img/flowcharge-mark.png run: curl -s -o /dev/null -w '%{http_code} %{content_type}\\n' http://127.0.0.1:4173<path> — all eight must return 200, with text/html; charset=utf-8 for the two pages, text/css; charset=utf-8 for the stylesheet, text/javascript; charset=utf-8 for the three scripts and image/png for the two images. These eight are every asset src/public/index.html and src/public/board.html reference, confirmed by grep at 25c1995."
      - "Criterion 3, content — curl -s http://127.0.0.1:4173/styles.css | cmp - dist/public/styles.css must report no difference, and the same for /home.js against dist/public/home.js."
      - "Criterion 4 — curl -s http://127.0.0.1:4173/api/version must return 200 with body {\"version\":\"0.1.0\"}, matching package.json's version at build time."
      - "Stop the process and confirm both temp directories are removed."
    checklist:
      - "Does release/cli/flowcharge-0.1.0-darwin-arm64 exist, non-empty, and report Mach-O 64-bit executable arm64?"
      - "Does the executable run alone in an empty directory and log FlowCharge running at http://127.0.0.1:4173?"
      - "Do all eight referenced assets return 200 with the correct content type?"
      - "Does an embedded asset's bytes match its dist/public/ source?"
      - "Does /api/version return 200 with the build-time version 0.1.0?"
      - "Was the developer's real ~/.flowcharge left untouched, because HOME pointed at a temp directory?"
    self_eval:
      passed: true
      failures: []
    notes:
      - "Port 4173 first blocked this task: a developer session held it (PID 10787, `node dist/server.js` under `bun start:lan`, running since Wed Sep 2 13:27), and stopping another person's process was outside this executor's authority. The developer confirmed and stopped it, and every check in this task was then re-run on the real default port with no PORT override. The log line matched exactly, by `grep -Fxq`: FlowCharge running at http://127.0.0.1:4173, with lsof showing the binary bound to 127.0.0.1:4173."
      - "The byte-for-byte asset check is only meaningful when dist/public/ still holds the same build mode the binary embedded. A first attempt reported home.js differing, because task 1.8's `npm run build` had rewritten dist/public/ unhardened after `package:cli` built the binary from the hardened `build:release` output. Re-running `npm run package:cli -- --target=darwin-arm64` put binary and sources back in one build mode, and styles.css, home.js, app.js and img/flowcharge-mark.png then all compared identical. The binary was never at fault; only the on-disk comparison source had moved."
    ```

  - [x] 1.7 Prove the `darwin-arm64` executable's data directory behaviour
    ```yaml
    description: "Verify acceptance criteria 5, 6 and 7 against the running darwin-arm64 executable."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Use the same executable and the same HOME-into-a-temp-directory technique as task 1.6."
      - "Criterion 5 — create a temp project directory containing a flowcharge/ subdirectory, because POST /api/projects refuses a path with no workstream tree. POST {\"path\": \"<abs path>\"} to /api/projects and expect 201. Stop the executable, start it again with the same HOME, and confirm GET /api/projects still lists the project. Confirm <tmp-home>/.flowcharge/.praxis-projects.json exists."
      - "Criterion 6 — with that project registered, GET /api/integrations/tools to pick a toolId, then POST to /api/integrations/installs with {\"targets\": [{\"toolId\": \"<id>\", \"basePath\": \"<the temp project path>\", \"scope\": {\"kind\": \"project\", \"projectPath\": \"<the same temp project path>\"}}]}. Project scope is the right choice here: permittedRootFor at src/server.ts:224-234 permits a registered project path, so nothing outside the temp tree is written. Expect 200 with a non-skipped result, then confirm a later GET /api/integrations/installs reports the install and that <tmp-home>/.flowcharge/.praxis-installs.json exists."
      - "Criterion 7 — stop the executable and start it three more times: once with PORT set to a free port, once with HOST set to 127.0.0.1 explicitly alongside that PORT, and once with PRAXIS_DATA_DIR pointed at a third temp directory. Confirm the startup log reports the overridden host and port, and that the third run writes its registry into PRAXIS_DATA_DIR rather than into <tmp-home>/.flowcharge."
      - "Remove every temp directory afterwards. Author no code in this task."
    pattern: "release/cli/flowcharge-0.1.0-darwin-arm64 and temp directories only. No repository file changes."
    imports: "The executable from task 1.6, curl, and network access for the install step."
    compatibility: "PLN-79-w9eeom acceptance criteria 5, 6 and 7. PRAXIS_DATA_DIR set by the entry also makes src/lib/projects.ts:24's isPackaged true, which correctly suppresses the app's own repository self-entry, so the first project list is empty."
    gotcha: "POST /api/integrations/installs performs a REAL network fetch through getInstallContent and REAL file writes, so this step needs network access and must target the temp project only. A project-scope install is refused unless the project is already registered, so criterion 5 must run before criterion 6. The integrations routes are refused to a non-loopback peer by the gate at src/server.ts:807, so drive them from this machine over 127.0.0.1. Setting PRAXIS_DATA_DIR explicitly overrides the entry's own guarded assignment precisely because that assignment is guarded — an unguarded assignment would silently break criterion 7."
    verify:
      - "Criterion 5 — curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{\"path\":\"<tmp-project>\"}' http://127.0.0.1:4173/api/projects must print 201; after a stop and restart, curl -s http://127.0.0.1:4173/api/projects must still list that path; test -f <tmp-home>/.flowcharge/.praxis-projects.json must succeed. All three fail at 25c1995, where no executable exists."
      - "Criterion 6 — the install POST must return 200 with a result whose status is not skipped-no-format, a following GET /api/integrations/installs must return that record, and test -f <tmp-home>/.flowcharge/.praxis-installs.json must succeed."
      - "Criterion 7, PORT and HOST — run with PORT=4199 HOST=127.0.0.1; stdout must contain FlowCharge running at http://127.0.0.1:4199 and curl -s http://127.0.0.1:4199/api/version must return 200."
      - "Criterion 7, PRAXIS_DATA_DIR — run with PRAXIS_DATA_DIR=<tmp-data>; after adding a project, test -f <tmp-data>/.praxis-projects.json must succeed and the file must NOT have been rewritten under <tmp-home>/.flowcharge/."
      - "Remove <tmp-home>, <tmp-project> and <tmp-data>, then confirm the real ~/.flowcharge was never created by this task."
    checklist:
      - "Does adding a project return 201 and survive a stop and restart?"
      - "Do .praxis-projects.json and .praxis-installs.json both land inside the executable's data directory?"
      - "Does a skill install through /api/integrations/installs succeed and appear in a later read?"
      - "Do PORT and HOST still override the executable's defaults?"
      - "Does an explicit PRAXIS_DATA_DIR still win over the entry's own guarded assignment?"
      - "Were all temp directories removed and the real home directory left untouched?"
    self_eval:
      passed: true
      failures: []
    notes:
      - "Every check ran on PORT=4199 rather than the default 4173, for the reason recorded in task 1.6's self_eval: another developer session holds 4173. No checklist item here names a port, and criterion 7's own PORT override is what the alternate port exercises, so the substitution weakens nothing this task asserts."
      - "Criterion 6 performed a real install: toolId claude-code, project scope, into the temp project only. It returned 200 with status `installed`, not a skipped result, and the record came back from a later GET after a full stop and restart."
    ```

  - [x] 1.8 Confirm the existing entry points are unchanged
    ```yaml
    description: "Verify acceptance criterion 8 — npm start, npm run electron:dev, npm run package:mac and npm test behave exactly as before."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run the project's own commands with PRAXIS_APP_VERSION and PRAXIS_DATA_DIR both unset, which is the condition under which both new seams must evaluate to their previous expressions."
      - "Establish the change's blast radius from the diff rather than from a heavyweight build: confirm the only changed or added paths are package.json, src/server.ts, src/server-env-seams.test.ts and tools/package-cli.mjs, and that nothing under electron/, src/public/ or tools/copy-assets.mjs and tools/bundle-public.mjs moved."
      - "Do not run npm run package:mac. package.json's build.mac block sets notarize: true and hardenedRuntime: true, so a real run needs signing credentials, and PLN-79-w9eeom rules code signing and notarization out of scope as WS-94-ked1ye. Cover it instead by proving npm run build:release still succeeds — it is package:mac's only non-electron-builder half — and that the diff touches neither the build block nor electron/."
      - "Author no code in this task."
    pattern: "Whole-repository verification. No file changes."
    imports: "None beyond the project's own npm scripts."
    compatibility: "PLN-79-w9eeom acceptance criterion 8 and Data & compatibility → 'Backward compatibility is unconditional in both directions'."
    gotcha: "npm test alone does not discriminate: it already passed at 25c1995. The diff-scope assertion below is what makes this task fail at 25c1995, where git diff --name-only reports package.json alone. Electron is a further reason not to run package:mac here — a packaged Electron build already sets PRAXIS_DATA_DIR at electron/main.cts:61, which now redirects the install registry from the read-only app.asar into userData; that is the strict improvement the plan records, and it changes nothing a user sees because the Electron renderer reaches the integrations engine over IPC."
    verify:
      - "git status --porcelain --untracked-files=all -- package.json src electron tools | sort — must list exactly four paths: package.json, src/server.ts, src/server-env-seams.test.ts and tools/package-cli.mjs, with nothing under electron/, nothing under src/public/ and no change to tools/copy-assets.mjs or tools/bundle-public.mjs. At 25c1995 the same command lists nothing at all, because the version correction is committed there, so the step discriminates."
      - "node -e \"const b=require('./package.json').build; const s=JSON.stringify(b); console.log(require('crypto').createHash('sha1').update(s).digest('hex'))\" — must print 200164528b6645031020271a29b16e288b5c0008, the value measured at 25c1995, proving the electron-builder configuration is byte-for-byte unchanged. This step cannot fail at 25c1995, because that is where the value was taken; it exists to catch an accidental edit to the build block while package.json's scripts are being changed in task 1.5."
      - "npm test — must exit 0, with the whole suite green including src/server.test.ts and the new src/server-env-seams.test.ts."
      - "npm run build:release — must exit 0, which is npm run package:mac's own first half and the only half this machine can run without signing credentials."
      - "PORT=0 npm start with PRAXIS_APP_VERSION and PRAXIS_DATA_DIR unset — must start, and /api/version must answer 0.1.0 from package.json, not from an injected value."
      - "npm run electron:dev — must build and open the Electron window as before, then close it."
    checklist:
      - "Do only the four expected paths appear as changed or added?"
      - "Is package.json's build block unchanged?"
      - "Does npm test exit 0 across the whole suite?"
      - "Does npm run build:release exit 0?"
      - "Does npm start still answer /api/version from package.json with both variables unset?"
      - "Does npm run electron:dev still start the app?"
    self_eval:
      passed: true
      failures:
        - item: "Do only the four expected paths appear as changed or added?"
          reason: "Five paths changed, not four. The scoped command in this task's verify list, `git status --porcelain --untracked-files=all -- package.json src electron tools`, does report exactly the four expected paths, so that step passes as written. A fifth file, tsconfig.json, sits outside that command's scope and is also modified."
          fix: "None applied, and none should be. tsconfig.json's include array is an explicit file list, so task 1.3's new src/server-env-seams.test.ts would never compile without an entry there. It is the one change strictly required to make an in-scope file work. It is recorded here rather than reverted, and the four-path claim in this task's implement field should be widened to five when this artefact is next revised."
        - item: "Does npm run electron:dev still start the app?"
          reason: "Not run. It opens an Electron GUI window, which is a heavyweight interactive step this executor was directed to skip, and the machine already carries a live developer server session."
          fix: "Covered by substitution, on the same reasoning PLN-79-w9eeom applies to npm run package:mac: `npm run electron:dev` is `npm run build && electron .`, the build half exits 0, and the diff touches nothing under electron/. Run the command by hand to close this item."
    notes:
      - "passed is true by explicit coordinator waiver, not because the two failures above were resolved. Both were disclosed and accepted as non-blocking, and both are kept above verbatim so nothing is hidden: tsconfig.json is a fifth changed path, and npm run electron:dev was never run. Read this task as four of six items verified and two waived."
      - "The four remaining items all passed on their own terms: package.json's build block hashes to 200164528b6645031020271a29b16e288b5c0008, matching the recorded 25c1995 baseline; npm test exits 0 at 161 tests; npm run build:release exits 0; and the npm start entry point answers /api/version with 0.1.0 from package.json with both PRAXIS_APP_VERSION and PRAXIS_DATA_DIR unset."
    ```

- [x] 2. The remaining three targets

  ```yaml
  description: "Produce all four executables in one npm run package:cli invocation, verify each artefact's format structurally, and run the darwin-x64 binary under Rosetta 2 as a partial check."
  ```

  - [x] 2.1 Build all four targets in one invocation and verify them structurally
    ```yaml
    description: "Run npm run package:cli with no --target flag and verify acceptance criterion 1 — four correctly named, non-empty files in release/cli/, each reporting its expected executable format."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Remove any stale release/cli/ contents by hand first, so the four files this run produces cannot be confused with task 1.6's artefact. tools/package-cli.mjs never deletes anything, by design."
      - "Run npm run package:cli with no --target flag."
      - "Verify the four filenames, their sizes and their formats. Author no code in this task; a failure here is a defect in tools/package-cli.mjs's target table, which belongs to task 1.4."
      - "Record that linux-x64 and win-x64 verification stops at the structural check. Neither can run on this macOS machine; a runtime check needs a Linux host and a Windows host, and PLN-79-w9eeom's Testing strategy states this limit rather than working around it."
    pattern: "release/cli/ only. No repository file changes."
    imports: "bun on PATH and the file command. First use of a cross-target downloads a Bun runtime per target."
    compatibility: "PLN-79-w9eeom acceptance criterion 1, Testing strategy → Stage 2, and Stages → stage 2's stated observable."
    gotcha: "Bun appends .exe itself for bun-windows-x64, so the Windows file is flowcharge-0.1.0-win-x64.exe while the script passed the base name — do not treat the extra extension as a naming bug. The first run per target downloads a Bun runtime, so allow for a slow first invocation and a network requirement. Each artefact is 64 MB to 100 MB, so four of them are several hundred megabytes; release/ is gitignored, so none of it reaches the repository."
    verify:
      - "npm run package:cli — must exit 0."
      - "ls release/cli | sort — must list exactly four entries: flowcharge-0.1.0-darwin-arm64, flowcharge-0.1.0-darwin-x64, flowcharge-0.1.0-linux-x64 and flowcharge-0.1.0-win-x64.exe. release/cli/ did not exist at 25c1995."
      - "for f in release/cli/*; do test -s \"$f\" || echo \"EMPTY $f\"; done — must print nothing."
      - "file release/cli/flowcharge-0.1.0-darwin-arm64 — must report Mach-O 64-bit executable arm64."
      - "file release/cli/flowcharge-0.1.0-darwin-x64 — must report Mach-O 64-bit executable x86_64."
      - "file release/cli/flowcharge-0.1.0-linux-x64 — must report ELF 64-bit LSB executable, x86-64."
      - "file release/cli/flowcharge-0.1.0-win-x64.exe — must report PE32+ executable (console) x86-64."
      - "git status --porcelain --untracked-files=all release — must print nothing, confirming release/ stays ignored and no new ignore entry was needed."
    checklist:
      - "Did one npm run package:cli invocation with no flag produce all four files?"
      - "Are all four names exactly flowcharge-<version>-<label>, with .exe only on the Windows target?"
      - "Is every file non-empty and reporting its expected format under file?"
      - "Does <version> match package.json's version field, 0.1.0?"
      - "Is release/ still untracked, with no .gitignore change made?"
      - "Is it recorded that linux-x64 and win-x64 got structural verification only?"
    self_eval:
      passed: true
      failures: []
    notes:
      - "linux-x64 and win-x64 verification stops at the structural check, as PLN-79-w9eeom's Testing strategy states. This is an arm64 macOS host: it cannot execute an ELF binary or a PE32+ binary, and no Linux host and no Windows host was available. Both files were checked for name, non-zero size and reported format only. Nothing here is evidence that either binary runs."
      - "The stale release/cli/flowcharge-0.1.0-darwin-arm64 from task 1.6 was removed by hand before the run, so all four files present afterwards came from this one invocation. tools/package-cli.mjs deletes nothing, by design."
      - "One `npm run package:cli` with no --target flag produced all four files. Sizes: darwin-arm64 64238690, darwin-x64 69959760, linux-x64 95373440, win-x64.exe 99261952 bytes. Formats reported by `file`: Mach-O 64-bit executable arm64; Mach-O 64-bit executable x86_64; ELF 64-bit LSB executable, x86-64; PE32+ executable (console) x86-64. `git status --porcelain --untracked-files=all release` printed nothing, and .gitignore was not changed."
    ```

  - [x] 2.2 Run the `darwin-x64` executable under Rosetta 2
    ```yaml
    description: "Run flowcharge-0.1.0-darwin-x64 on this arm64 Mac under Rosetta 2 and check acceptance criteria 2 and 3 only, recording the AVX caveat that makes this a partial check."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Copy release/cli/flowcharge-0.1.0-darwin-x64 alone into an empty temp directory and run it with HOME set to a second temp directory, exactly as task 1.6 did for the arm64 binary."
      - "Check acceptance criterion 2 — the startup log and the bound port — and acceptance criterion 3 — the two pages and every asset they reference."
      - "Do NOT extend this run to criteria 4 through 7. PLN-79-w9eeom's stage 2 observable limits the Rosetta run to criteria 2 and 3."
      - "Record the exact caveat in the task result: the binary prints `warn: CPU lacks AVX support, strange crashes may occur`, because Rosetta 2 does not emulate AVX. A real Intel Mac has AVX and does not print it. This run is therefore a partial check and is not evidence about the binary's behaviour on genuine Intel hardware."
      - "Remove both temp directories. Author no code in this task."
    pattern: "release/cli/flowcharge-0.1.0-darwin-x64 and temp directories only. No repository file changes."
    imports: "Rosetta 2 installed on this arm64 Mac, plus curl."
    compatibility: "PLN-79-w9eeom acceptance criteria 2 and 3, Stages → stage 2, and Testing strategy → 'Two verification limits are real and are stated rather than worked around'."
    gotcha: "The AVX warning is expected and is not a failure — do not chase it, and do not switch to a -baseline Bun target because of it. PLN-79-w9eeom's Assumptions choose the non-baseline x64 targets deliberately: every Intel Mac and every current x86_64 Linux host has AVX. Port 4173 must be free, so stop the arm64 binary from task 1.6 first. Rosetta 2 must be present; if it is not, macOS prompts to install it and the run cannot proceed until it is."
    verify:
      - "Criterion 2 — run the copied darwin-x64 executable with HOME=<tmp-home> and no arguments; its stdout must contain FlowCharge running at http://127.0.0.1:4173, and lsof -nP -iTCP:4173 -sTCP:LISTEN must show it bound. This fails at 25c1995, where no executable exists."
      - "Criterion 3 — for each of / , /board.html, /styles.css, /theme-init.js, /home.js, /app.js, /img/flowcharge-wordmark.png and /img/flowcharge-mark.png run: curl -s -o /dev/null -w '%{http_code} %{content_type}\\n' http://127.0.0.1:4173<path> — all eight must return 200 with the same content types task 1.6 asserted."
      - "Capture the process's stderr and confirm the only unexpected line is the Rosetta AVX warning; record its exact text in the task result."
      - "Stop the process and remove both temp directories."
    checklist:
      - "Does the darwin-x64 binary start under Rosetta 2 and log the expected URL?"
      - "Do all eight referenced assets return 200 with the correct content type?"
      - "Is the AVX warning recorded verbatim, with its cause and its consequence for what this run proves?"
      - "Is it recorded that criteria 4 through 7 were deliberately not checked on this binary?"
      - "Was the real home directory left untouched, because HOME pointed at a temp directory?"
    self_eval:
      passed: true
      failures: []
    notes:
      - "The binary printed this line on stderr, verbatim, across two lines: `warn: CPU lacks AVX support, strange crashes may occur. Reinstall Bun or use *-baseline build:` followed by `  https://github.com/oven-sh/bun/releases/download/bun-v1.3.14/bun-darwin-x64-baseline.zip`. The cause is Rosetta 2, which does not emulate AVX. A genuine Intel Mac has AVX and does not print it. This run is therefore a partial check only, and it is not evidence about the binary's behaviour on real Intel hardware. It was the only unexpected line on stderr."
      - "Criteria 4 through 7 were deliberately NOT checked on this binary. PLN-79-w9eeom's stage 2 observable limits the Rosetta run to criteria 2 and 3."
      - "Criterion 2 passed on the real default port 4173, which was free before the run. `grep -Fxq` matched stdout exactly against `FlowCharge running at http://127.0.0.1:4173`, and lsof showed PID 32929 bound to 127.0.0.1:4173. The binary was copied alone into an empty temp directory, and it was started with PORT, HOST, PRAXIS_DATA_DIR and PRAXIS_APP_VERSION all removed from its environment."
      - "Criterion 3 passed for all eight assets: / and /board.html returned text/html; charset=utf-8, /styles.css returned text/css; charset=utf-8, /theme-init.js, /home.js and /app.js returned text/javascript; charset=utf-8, and /img/flowcharge-wordmark.png and /img/flowcharge-mark.png returned image/png. Every response was 200."
      - "HOME pointed at a second temp directory. `.flowcharge` was created inside that temp directory, and the real /Users/akoukoullis/.flowcharge did not exist before the run and still does not exist after it. Both temp directories were removed and port 4173 was released."
    ```

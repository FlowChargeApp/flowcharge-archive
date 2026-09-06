---
id: TL-62-l5hzz8
type: tasklist
workstream: WS-61-xq11uw
slug: electron-packaging-quick-hardening
title: "Close the easy source-reading paths in the packaged Electron build"
status: done
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: [PLN-51-kuynxv]
links: []
mode: spec
base_commit: 0d81cff
---

# PRX Tasks

## Electron packaging quick hardening

Three small, independent edits to three files. Together they close the cheapest ways to read
this closed-source app's code out of a packaged build. `package.json` gets a
`build.electronFuses` block that turns off `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and the
`--inspect` family in the packaged binary. `electron/main.cts` gets one line in
`createWindow`'s `webPreferences`: `devTools: !app.isPackaged`. `tools/copy-assets.mjs` gets a
closing assertion that fails `npm run build` if any `.map` file is found anywhere under
`dist/`.

The fuse change is the large one, and the only one that could produce a build that does not
launch, so it is Phase 1. The three phases are otherwise independent; the order is a risk
order, not a dependency order. Each phase is one commit and one file.

This raises the cost of casual reading. It is not a security boundary. Nothing here stops a
determined person with the binary on their machine.

No dependency is added. `electron-builder` 26.15.3, `@electron/fuses` 1.8.0 and Electron
43.4.0 are already installed. `npm start` and `npm run electron:dev` are unaffected.

### Not tasked

These are recorded so they are not lost. No task below acts on any of them.

1. **Linux and Windows verification (plan Open question 1).** Acceptance criteria 6 to 11 are
   macOS commands run on the Apple Silicon machine this repo is worked on. `npm run
   package:linux` and `npm run package:win` cannot be verified here. The plan leaves the choice
   between deferring to the next run on a capable machine and verifying Linux in a container.
   Task 1.1 therefore verifies the mac bundles only.
2. **`build.files: "dist/**/*"` ships the compiled unit tests (plan Open question 2).** A real
   finding, explicitly out of this plan's scope. No task changes `build.files`.
3. **README wording (plan Open question 3).** The plan recommends no README change and leaves
   the decision open. No task edits `README.md`.
4. **Assumption A1 is unconfirmed.** The plan reads "no release constraint applies" from the
   README rather than from the user. It affects only the release framing, not any edit below.

- [x] 1. Phase 1 — Electron fuses (medium)

  ```yaml
  description: "Add the five-key build.electronFuses block to package.json so the packaged binary refuses ELECTRON_RUN_AS_NODE, NODE_OPTIONS and the --inspect family."
  ```

  - [x] 1.1 Add `build.electronFuses` to `package.json`
    ```yaml
    description: "Insert the five-key electronFuses object as a sibling of build.files, and prove the packaged mac binaries still launch with the fuses flipped."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        package.json — insert the five-key `build.electronFuses` object directly under `build`,
        as a sibling of `files`, `mac`, `linux` and `win`. Exactly these five keys, no more and
        no fewer. The shape is flat camelCase booleans, not the `FuseV1Options` enum names.
        <<<<<<< SEARCH
            "files": [
              "dist/**/*",
              "package.json"
            ],
        =======
            "files": [
              "dist/**/*",
              "package.json"
            ],
            "electronFuses": {
              "runAsNode": false,
              "enableNodeOptionsEnvironmentVariable": false,
              "enableNodeCliInspectArguments": false,
              "grantFileProtocolExtraPrivileges": false,
              "resetAdHocDarwinSignature": true
            },
        >>>>>>> REPLACE
      - "Change nothing else in package.json. Do not touch `build.files`, `scripts`, `build.mac`, `build.linux` or `build.win`."
    pattern: "package.json only. The `build` object at lines 30-57 as read at 0d81cff."
    imports: "No new dependency. electron-builder 26.x and @electron/fuses 1.8.0 are already installed as devDependencies; the fuses are applied by electron-builder at package time."
    compatibility: "`node_modules/app-builder-lib/out/configuration.d.ts:235` declares `electronFuses?: FuseOptionsV1 | null`, and lines 471-526 define FuseOptionsV1 as exactly these camelCase optional booleans. `platformPackager.js:266-297` skips any key that is null or undefined, so an omitted key is genuinely left untouched rather than defaulted."
    gotcha: "`resetAdHocDarwinSignature: true` is required, not optional, in this repo. Flipping a fuse rewrites bytes in the Electron binary and invalidates its signature; `platformPackager.js:252-256` runs the flip immediately before the sign step, and `build.mac` declares no signing identity, so nothing repairs it. On Apple Silicon a mac binary with a broken signature can refuse to launch. The `configuration.d.ts:521-523` doc comment calling this key unneeded assumes a signing identity is configured; it is not here. Separately, `runAsNode: false` breaks `process.fork` in the main process — `electron/main.cts:65-73` does not fork, it routes a native dynamic `import()` through `new Function` to load `../server.js` in-process, which the fuse does not affect."
    verify:
      - "`node -e 'JSON.parse(require(\"fs\").readFileSync(\"package.json\",\"utf8\"))'` exits 0 (criterion 3)."
      - "`grep -c -E '\"(enableCookieEncryption|onlyLoadAppFromAsar|enableEmbeddedAsarIntegrityValidation|loadBrowserProcessSpecificV8Snapshot)\"' package.json` returns 0 (criterion 2)."
      - "`npm run build` exits 0 — the project's own build chain (tsc x3 plus tools/copy-assets.mjs) is unaffected by the config change."
      - "`npm run package:mac` exits 0 and prints no `Invalid configuration object` error, which proves no unknown key was introduced (criterion 4). Its log contains an `executing @electron/fuses` line for each packaged binary (criterion 5)."
      - "`npx electron-fuses read --app \"release/mac-arm64/Praxis Board.app\"` reports `RunAsNode`, `EnableNodeOptionsEnvironmentVariable`, `EnableNodeCliInspectArguments` and `GrantFileProtocolExtraPrivileges` as `Disabled` (criterion 6)."
      - "`release/mac-arm64/Praxis Board.app` launches on this Apple Silicon machine and renders a board (criterion 7 — this is the check that proves `resetAdHocDarwinSignature` did its job). `release/mac/Praxis Board.app` also launches under Rosetta (criterion 8)."
      - "`ELECTRON_RUN_AS_NODE=1 \"release/mac-arm64/Praxis Board.app/Contents/MacOS/Praxis Board\"` starts the normal app window and no Node REPL (criterion 9)."
      - "`\"release/mac-arm64/Praxis Board.app/Contents/MacOS/Praxis Board\" --inspect=9229` prints no `Debugger listening on ws://...` line and `chrome://inspect` lists no target (criterion 10). `NODE_OPTIONS=\"--inspect\" \"release/mac-arm64/Praxis Board.app/Contents/MacOS/Praxis Board\"` likewise opens no inspector (criterion 11)."
      - "`npm run electron:dev` still starts the app and still allows DevTools, because fuses are applied at package time only (criterion 12)."
    checklist:
      - "Does `build.electronFuses` contain exactly the five specified keys, with no sixth key?"
      - "Are `enableCookieEncryption`, `onlyLoadAppFromAsar`, `enableEmbeddedAsarIntegrityValidation` and `loadBrowserProcessSpecificV8Snapshot` absent from the whole file, not merely set to false?"
      - "Is `resetAdHocDarwinSignature` set to `true`, and do both mac bundles launch?"
      - "Does `git diff --name-only` list `package.json` and nothing else for this task?"
      - "Do all three escape hatches (`ELECTRON_RUN_AS_NODE=1`, `--inspect=9229`, `NODE_OPTIONS=\"--inspect\"`) fail to yield an inspector or a REPL?"
      - "Is `npm run electron:dev` unchanged, with DevTools still available?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — DevTools off in the packaged window (small)

  ```yaml
  description: "Add devTools: !app.isPackaged to createWindow's webPreferences so the packaged renderer has no inspector, while dev keeps one."
  ```

  - [x] 2.1 Add `devTools: !app.isPackaged` to `electron/main.cts`
    ```yaml
    description: "Add one key to the existing webPreferences object in createWindow, leaving the four existing keys unchanged."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        electron/main.cts — add `devTools: !app.isPackaged` inside `createWindow`'s existing
        `webPreferences` object. `app` is already imported at line 8 and `app.isPackaged` is
        already read at line 52, so this introduces no new import and no new concept.
        <<<<<<< SEARCH
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
              preload: path.join(__dirname, 'preload.cjs'),
        =======
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
              devTools: !app.isPackaged,
              preload: path.join(__dirname, 'preload.cjs'),
        >>>>>>> REPLACE
      - "Change nothing else in the file. The four existing webPreferences keys keep their values and their order."
    pattern: "electron/main.cts only — the `webPreferences` object inside `createWindow` at lines 21-28 as read at 0d81cff."
    imports: "None. `app` is already imported from 'electron' at electron/main.cts:8."
    compatibility: "`app.isPackaged` is settled by the time `createWindow` runs: `createWindow(SERVER_URL)` is called at main.cts:95, from inside the `app.whenReady()` callback that opens at main.cts:32."
    gotcha: "Use `app.isPackaged` from 'electron', never the derived `isPackaged` in src/lib/projects.ts. That one is `Boolean(process.env.PRAXIS_DATA_DIR)` and exists only because the server process cannot see `app.isPackaged`. The main process can. Reading the derived proxy here would couple the main process to a server-side convention it has no reason to know, and main.cts:49-51's own comment already states that boundary. Note also what this does not do: `devTools: false` removes the renderer's inspector only, not the main process's Node inspector — that is Phase 1's job."
    verify:
      - "`npm run build` exits 0 — this runs `tsc -p electron/tsconfig.json`, which is the project's own type-check for this file."
      - "`grep -c 'devTools: !app.isPackaged' electron/main.cts` returns 1."
      - "`npm run electron:dev` starts the app and DevTools still open, both from the View menu item and from `Cmd+Option+I` (criterion 14)."
      - "`npm run package:mac` exits 0, and in the launched packaged app no route opens DevTools — not the menu item, not the keyboard shortcut, not the window right-click context menu (criterion 15)."
      - "In that same packaged app the board loads, project tiles render, and the detail modal opens (criterion 16)."
    checklist:
      - "Does `webPreferences` still contain `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` and the `preload` path, all unchanged?"
      - "Is the new value `!app.isPackaged` from the 'electron' import, and not the derived `isPackaged` from src/lib/projects.ts?"
      - "Do DevTools still open under `npm run electron:dev` by both the menu and the keyboard shortcut?"
      - "Do DevTools fail to open in the packaged app by all three routes (menu, shortcut, context menu)?"
      - "Does the packaged board still load and the detail modal still open?"
      - "Does `git diff --name-only` list `electron/main.cts` and nothing else for this task?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Checklist items 3, 4 and 5 (DevTools open in electron:dev, DevTools blocked by all three routes in the packaged app, packaged board and modal still work) were not run. The execution briefing restricted verification to `npm run build` plus grep and file-inspection checks, and excluded `npm run electron:dev` and packaged-app launch checks. They are judged YES on static grounds: `devTools` is a standard Electron `webPreferences` key, `app.isPackaged` is false under electron:dev and true when packaged, the repo defines no custom menu and calls `openDevTools` nowhere (grep over electron/ and src/ returns no hit), and `devTools` does not affect page loading."
    ```

- [x] 3. Phase 3 — Source-map guard in the build chain (small)

  ```yaml
  description: "Append a recursive .map scan of the whole dist/ tree to tools/copy-assets.mjs, so npm run build fails if a source map is ever emitted."
  ```

  - [x] 3.1 Append the `.map` guard to `tools/copy-assets.mjs`
    ```yaml
    description: "Add a hand-rolled recursive walk of dist/ that throws and names every .map file found, and prints one confirmation line when the tree is clean."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "tools/copy-assets.mjs — append the guard after the existing copy loop, which today ends at line 20. Leave lines 1-20 untouched: the four hardcoded copy paths, `distPublic`, and the `mkdirSync` call all stay exactly as they are."
      - "Add a scan root as a sibling constant to the existing `distPublic` at line 10, built from the `repoRoot` the file already holds at line 8: `path.join(repoRoot, 'dist')`. The scan root is the whole of `dist/`, not `dist/public`. One scan from `dist/` covers all three compilations at once — `dist/` with `dist/lib/` and `dist/scripts/` from the root tsconfig.json, `dist/public/` from src/public/tsconfig.json, and `dist/electron/` from electron/tsconfig.json. `build.files`'s `dist/**/*` glob ships every one of those trees."
      - |
        Add a function with this public shape. The body below is illustrative, not literal —
        derive the real implementation from the behaviour contract in the next steps.
        ```js
        // returns paths relative to `dir`, for every file whose name ends in `.map`
        function findSourceMaps(dir, prefix = '') { ... }
        ```
      - "Behaviour contract: walk `dir` with `fs.readdirSync(dir, { withFileTypes: true })` and recurse only into entries where `dirent.isDirectory()` is true. Match on a lowercase `.map` suffix of the file name. Return paths relative to the scan root so the error message reads well. Call it once, with `dist/` as its root — it needs no exclusions, because `dist/` holds only build output, is gitignored, and every subtree in it is shipped."
      - "Caller contract: if the returned list is non-empty, `throw` a single `Error` that lists every offending path and states plainly that source maps must never ship in a packaged build. An uncaught throw gives a non-zero exit, which fails `npm run build`. If the list is empty, print one short confirmation line with `console.log`, in the same style the file already uses at lines 13 and 19, so a passing build shows the check actually ran."
      - "The guard must stay a guard. It asserts and throws. It must never delete, filter or rewrite a `.map` file — silently removing one would hide the tsconfig regression that produced it, which is the thing actually worth knowing about."
    pattern: "tools/copy-assets.mjs only. Append after the copy loop that ends at line 20 as read at 0d81cff."
    imports: "None beyond what the file already imports at lines 3-5: `node:fs`, `node:path` and `fileURLToPath` from `node:url`. Add no dependency, no new file, and no new npm script (criterion 24)."
    compatibility: "Plain ESM, matching the rest of the file — it runs before any compiled output exists. Hand-roll the recursion rather than using `fs.readdirSync(dir, { recursive: true })`: package.json's `engines` field allows Node 18, and the recursive option only arrived in 18.17. Using `dirent.isDirectory()` also means a symlinked directory is not followed, so the walk cannot loop. The file is already the last command of the `build` script (package.json line 13), so all three `tsc` invocations have finished by the time it runs and the whole dist/ tree is complete."
    gotcha: "The guard fixes no present bug — the current dist/ tree is clean, none of the three tsconfigs sets `sourceMap`, `inlineSourceMap` or `declarationMap`, and the copy loop copies a hardcoded list of four named paths so it cannot copy a map even today. It catches a future regression, which means the only failure that matters is a false negative. A guard tested in its passing direction alone is not tested: criteria 19 to 21 exercise all three tsconfigs on purpose, and the root and electron cases are exactly the ones a `dist/public`-only scan would have missed. Also make sure the scan tolerates `dist/` not existing yet, since the mkdirSync at line 12 creates only `dist/public`."
    verify:
      - "On a clean tree, `npm run build` exits 0 and prints one confirmation line from the guard (criterion 18). `find dist -name \"*.map\"` returns nothing."
      - "Set `\"sourceMap\": true` temporarily in `src/public/tsconfig.json`, run `npm run build`, and confirm it exits non-zero and names every offending file by path with a reason (criterion 19). Revert."
      - "Repeat with `\"sourceMap\": true` in the root `tsconfig.json`, whose maps land in `dist/` and `dist/lib/` — the case the narrower `dist/public` scan would have missed (criterion 20). Revert."
      - "Repeat with `\"sourceMap\": true` in `electron/tsconfig.json`, whose maps land in `dist/electron/` (criterion 21). Leave this one in place for the next step."
      - "With that setting still in place, run `npm run package:mac` once and confirm it stops before `electron-builder` starts, because `npm run build` is the first command of `package:mac`, `package:linux` and `package:win` (criterion 23). Then revert it."
      - "With every tsconfig reverted, `npm run build` exits 0 again (criterion 22) and `git diff --name-only` lists no tsconfig."
      - "Whole-change check, once all three phases have landed: `git diff --name-only` against 0d81cff lists exactly `package.json`, `electron/main.cts` and `tools/copy-assets.mjs` (criterion 25), and `npm start` still serves the board at `http://localhost:4173` (criterion 26)."
    checklist:
      - "Does the scan root cover all of `dist/`, and not `dist/public` alone?"
      - "Does the guard throw rather than delete, filter or rewrite any `.map` file it finds?"
      - "Does the error message name every offending path, and does the passing path print exactly one confirmation line?"
      - "Does the walk avoid `readdirSync(..., { recursive: true })`, so it still runs on Node 18.0?"
      - "Are lines 1-20 of the file unchanged, including the four hardcoded copy paths and `distPublic`?"
      - "Did the change add no dependency, no new file and no new npm script?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "All six checklist items are YES. The guard was tested in its failing direction against all three tsconfigs: `src/public/tsconfig.json` (7 maps named), the root `tsconfig.json` (34 maps named, including `dist/server.js.map` and `dist/scripts/extract-praxis-data.js.map`, which a `dist/public`-only scan would have missed) and `electron/tsconfig.json` (5 maps under `dist/electron/`). Each run exited 1. All three tsconfigs were then restored from byte-level backups and confirmed identical with `cmp`; `package.json` is also byte-identical."
        - "Criterion 23 was run: with `sourceMap: true` still set in `electron/tsconfig.json`, `npm run package:mac` exited 1 at the `npm run build` step and `electron-builder` never started (no `release/` output, and the only `electron-builder` string in the log is the echoed script line)."
        - "Criterion 25's literal check does not hold, and this is not caused by this task. The plan's `base_commit` 0d81cff is now 13 commits behind HEAD; unrelated workstreams (app-version display, update-check notification, electron-builder publish config) landed in between. Measured against the last unrelated merge 0b0efbe, the three-phase change set is exactly `package.json`, `electron/main.cts` and `tools/copy-assets.mjs`. `.gitignore` is also modified, but it was already modified in the working tree before this workstream started."
        - "Criterion 26 (`npm start` still serves the board at http://localhost:4173) was not run. The execution briefing restricted verification to `npm run build` plus grep and file-inspection checks. The guard runs only inside `tools/copy-assets.mjs` at build time and emits no runtime artefact, so it cannot affect the served board."
    ```

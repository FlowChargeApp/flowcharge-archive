---
id: TL-59-23bpix
type: tasklist
workstream: WS-58-06dvnk
slug: app-version-display
title: "Expose the app version and show it in the footer"
status: done
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: [PLN-48-jznrar]
links: []
mode: spec
base_commit: 0d81cff
---

# PRX Tasks

## Expose and display the app's own version

The app must know its own version at runtime and show it to the user. One new
required method, `getAppVersion(): Promise<string | null>`, joins the existing
`window.praxisAPI` surface. Electron answers it in the main process with
`app.getVersion()`. A plain browser tab answers it through `browser-ipc-shim.ts`,
backed by a new `GET /api/version` route that reports `package.json`'s `version`
field. One small shared renderer script, `src/public/app-version.ts`, writes the
string `Version 1.0.0` into the `<footer class="note">` element that both
`index.html` and `board.html` already carry.

Every change is additive. `package.json` stays the single source of truth. The
update check itself, any About dialog, and any change to the electron-builder
config are out of scope — those belong to WS-59 or to nothing at all.

The plan's three open questions are settled: the plain browser tab shows the
version too, the wording is `Version 1.0.0`, and no placeholder markup is
reserved for WS-59.

Phase 1 (task 1) makes both providers answer the new method, with no visible
change. Phase 2 (task 2) puts the string on screen.

- [x] 1. Phase 1 — Both providers answer the new method

  ```yaml
  description: "Land the contract and its two implementations: the server route, the shim, the type line, the main-process handler, and the preload bridge. No UI changes yet, so nothing the user sees can break."
  ```

  - [x] 1.1 Add the `APP_VERSION` constant and the `GET /api/version` route to `src/server.ts`
    ```yaml
    description: "Read package.json's version once at module load, and answer GET /api/version with it."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor A — module scope, beside the other hoisted constants. `src/server.ts:44-48` already declares `WORKSTREAM_ID` and `LOOPBACK_HOSTS` at module scope. Add an `APP_VERSION: string | null` constant in that same region, initialised by an immediately-invoked function that reads and parses package.json ONCE at module load, never per request."
      - "Reuse the existing `__dirname`. `src/server.ts:11` already declares `const __dirname = path.dirname(fileURLToPath(import.meta.url));`. Do not redeclare it and do not import anything new — `fs`, `path` and `fileURLToPath` are already imported at the top of the file. In the compiled `dist/server.js`, `__dirname` is `dist/`, so the target path is `path.join(__dirname, '..', 'package.json')`."
      - "The initialiser must swallow its own throws: on any failure, log once with `console.error` and return `null`. It must also return `null` when the parsed `version` field is not a string. Illustrative only, not literal: `try { const raw = fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'); const parsed = JSON.parse(raw) as { version?: string }; return typeof parsed.version === 'string' ? parsed.version : null; } catch (err) { console.error('Could not read package.json for the app version:', err); return null; }`"
      - "Anchor B — inside `handleApi` (declared at `src/server.ts:245`), immediately ABOVE its final `sendJson(res, 404, { error: 'Not found' });` line at `src/server.ts:370`. Add one branch that matches `reqPath === '/api/version'` and `method === 'GET'`. When `APP_VERSION` is `null`, answer `sendJson(res, 500, { error: 'Could not read the app version' })` and return. Otherwise answer `sendJson(res, 200, { version: APP_VERSION })` and return."
      - "The route takes no query string and no body. Add no new validation, no new helper, and no caching layer — the value is already read once."
    pattern: "src/server.ts only. No other file changes in this task."
    imports: "None new. `fs`, `path`, `fileURLToPath` and the `sendJson` helper are already present in src/server.ts."
    compatibility: "The root tsconfig.json compiles this file with module node16 and noEmitOnError true, so a type error blocks the emit. The new branch sits below the existing Content-Type guard at the head of handleApi, so it inherits it, and it sits behind the existing passesOriginCheck like every other route. The GET path carries no body, so that guard leaves it alone."
    gotcha: "Placing the branch BELOW the final 404 line makes it dead code and the route answers 404 — it must go above it. Declaring a second `__dirname` is a redeclaration error under strict mode. Reading package.json per request instead of at module load contradicts the plan's performance note. The path is `'..'` relative to `dist/`, not relative to `src/`."
    verify:
      - "`npm run build` exits 0."
      - "Start the server with `npm start` in a background shell, then run `curl -si http://localhost:4173/api/version`. Confirm the status line reads `HTTP/1.1 200` and the body is exactly `{\"version\":\"1.0.0\"}`. Stop the server."
      - "`git diff --name-only -- src/public electron` returns zero lines — this task touches no renderer or Electron file."
    checklist:
      - "Does `APP_VERSION` read and parse package.json exactly once, at module load, and not inside handleApi?"
      - "Does the initialiser return null on a read failure, a parse failure, and a non-string version field, logging once with console.error?"
      - "Does the new route branch sit above the final `sendJson(res, 404, { error: 'Not found' });` line in handleApi?"
      - "Does the route answer 500 with an `error` key when APP_VERSION is null, and 200 with a `version` key otherwise?"
      - "Is `__dirname` reused from src/server.ts:11 rather than redeclared, and were no new imports added?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Declare `getAppVersion` on `interface PraxisAPI` in `src/public/ipc-adapter.ts`
    ```yaml
    description: "Add the one required method line to the renderer-facing type contract."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add one required method to `interface PraxisAPI`, between the `getWorkstreamDetail` line and the optional `pickProjectFolder` line. The method is REQUIRED, not optional, and returns the raw `Promise<string | null>` shape rather than the `PraxisIpcResult<T>` envelope — matching `pickProjectFolder`, the file's one existing direct, non-relayed method."
      - |
        Apply this block to src/public/ipc-adapter.ts:
        <<<<<<< SEARCH
          getWorkstreamDetail(id: string, wsId: string): Promise<PraxisIpcResult<PraxisWorkstreamDetail>>;
          pickProjectFolder?(): Promise<string | null>;
        =======
          getWorkstreamDetail(id: string, wsId: string): Promise<PraxisIpcResult<PraxisWorkstreamDetail>>;
          getAppVersion(): Promise<string | null>;
          pickProjectFolder?(): Promise<string | null>;
        >>>>>>> REPLACE
      - "Add no import and no export keyword to this file, and change nothing else in it. The file relies on `src/public/tsconfig.json`'s `module: \"none\"` to keep its declarations global."
    pattern: "src/public/ipc-adapter.ts only."
    imports: "None."
    compatibility: "src/public/tsconfig.json sets noEmitOnError: true and module: \"none\". Because the method is required, src/public/browser-ipc-shim.ts's object literal stops satisfying PraxisAPI the moment this line lands. That intermediate broken build is expected and is cleared by task 1.3 — do not soften the method to optional to make the build pass."
    gotcha: "Marking the method optional with `?` would defeat the compile gate the plan relies on and would force a `typeof` feature check into app-version.ts. Returning `Promise<PraxisIpcResult<string>>` would contradict the plan's Contract 1 and would break the forward contract WS-59 depends on."
    verify:
      - "`grep -c 'getAppVersion(): Promise<string | null>;' src/public/ipc-adapter.ts` returns 1."
      - "`npx tsc -p src/public/tsconfig.json --noEmit` now reports a missing-property error against src/public/browser-ipc-shim.ts naming `getAppVersion`. This is the expected intermediate state and task 1.3 clears it — do not run `npm run build` as a pass/fail gate until 1.3 has landed."
    checklist:
      - "Is `getAppVersion` declared as required, with no `?` before the parentheses?"
      - "Is the return type exactly `Promise<string | null>` rather than a PraxisIpcResult envelope?"
      - "Does the line sit inside `interface PraxisAPI` and nowhere else?"
      - "Does the file still contain no `import` and no `export` keyword?"
      - "Were the six existing method signatures left byte-for-byte unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Implement `getAppVersion` in `src/public/browser-ipc-shim.ts`
    ```yaml
    description: "Back the new method in a plain browser tab with a fetch against GET /api/version, mapping any failure to null."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the object literal assigned to `window.praxisAPI` inside the `if (!window.praxisAPI)` guard. Add one method after the existing `getWorkstreamDetail` entry, keeping the file's `function () {}` style rather than arrow syntax, to match its six siblings."
      - "The method must reuse the file's own `fetchIpc` helper with the response type `{ version: string }`, calling `fetchIpc<{ version: string }>('GET', '/api/version')`, then map the result: return `result.data.version` when `result.ok` is true, and `null` in every other case."
      - "Add no `.catch`. `fetchIpc` already resolves rather than rejects on a network failure, returning `{ ok: false, status: 0, ... }`, so the `ok` test alone satisfies acceptance criterion 5's no-uncaught-exception requirement."
      - "Add no import or export keyword, and change nothing else in the file. Leave the `if (!window.praxisAPI)` guard exactly as it is, so Electron's preload-installed surface still wins."
    pattern: "src/public/browser-ipc-shim.ts only."
    imports: "None. `fetchIpc` is declared in this same file and PraxisAPI comes from ipc-adapter.ts's global scope."
    compatibility: "Depends on task 1.1's /api/version route and on task 1.2's interface line. src/public/tsconfig.json sets module \"none\", strict true and noEmitOnError true, so the object literal must satisfy PraxisAPI exactly — this task is what makes the build green again after 1.2."
    gotcha: "Returning `result.data` rather than `result.data.version` yields an object, not a string, and fails the type check. Adding a `.catch` is redundant because fetchIpc never rejects. Declaring `pickProjectFolder` here would be wrong — it stays Electron-only and optional."
    verify:
      - "`npm run build` exits 0. This is the first green build since task 1.2."
      - "Start the server with `npm start`, open `http://localhost:4173` in a browser tab, and in the console run `await window.praxisAPI.getAppVersion()`. It returns the string `\"1.0.0\"`."
      - "In the same console, confirm the home page still lists projects and a board page still opens — the six existing methods are unchanged."
    checklist:
      - "Does the method call `fetchIpc` with method GET and path `/api/version`, reusing the existing helper rather than calling fetch directly?"
      - "Does it resolve to the version string on success and to `null` on every failure, including a status-0 network failure?"
      - "Was the `if (!window.praxisAPI)` guard left unchanged, so Electron's preload surface still takes precedence?"
      - "Does the file still contain no `import` and no `export` keyword?"
      - "Does `npm run build` exit 0 with no type error against PraxisAPI?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.4 Register the main-process handler in `electron/ipc-handlers.cts`
    ```yaml
    description: "Answer the getAppVersion channel directly with Electron's app.getVersion(), not through the loopback relay."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor A — the import at the top of the file, currently `import { ipcMain, dialog } from 'electron';`. Add `app` to that named import list. Add no new import statement and do not import from 'electron/main'."
      - "Anchor B — inside `registerIpcHandlers()`, beside the existing `pickProjectFolder` handler at the end of the function. Register one handler: `ipcMain.handle('getAppVersion', () => app.getVersion());`"
      - "This is the direct pattern, not the loopback relay. Do NOT route it through `loopbackRequest`, and do not touch `SERVER_URL`. `app.getVersion()` is synchronous and does not throw, so no try/catch and no envelope are needed."
      - "Change `electron/main.cts` in no way. It already calls `registerIpcHandlers()` after the server is ready, and splitting this one concern across two files would gain nothing."
    pattern: "electron/ipc-handlers.cts only."
    imports: "`app` added to the existing `{ ipcMain, dialog }` named import from 'electron'."
    compatibility: "electron/tsconfig.json compiles this file as commonjs with strict true and noEmitOnError true. The handler returns a bare string, matching the PraxisAPI contract's `Promise<string | null>` after the ipcRenderer.invoke round trip — deliberately unlike the six relayed handlers, which return PraxisIpcResult envelopes."
    gotcha: "Wrapping the value in a `{ ok: true, status: 200, data }` envelope would contradict Contract 1 and break the renderer's expectation of a raw string. Relaying to /api/version would report the bundled package.json rather than the packaged Info.plist version, which is the whole reason the plan rejected that alternative. Registering the handler outside registerIpcHandlers() would leave the channel unwired."
    verify:
      - "`npm run build` exits 0."
      - "`grep -c 'app.getVersion()' electron/ipc-handlers.cts` returns 1, and `grep -n \"ipcMain.handle('getAppVersion'\" electron/ipc-handlers.cts` shows the line inside registerIpcHandlers()."
      - "`git diff --name-only -- electron/main.cts` returns zero lines."
    checklist:
      - "Is `app` added to the existing named import from 'electron' rather than pulled in by a new import statement?"
      - "Is the handler registered inside registerIpcHandlers() on the channel name `getAppVersion`?"
      - "Does the handler return the bare value from app.getVersion(), with no PraxisIpcResult envelope?"
      - "Does the handler avoid loopbackRequest and SERVER_URL entirely?"
      - "Is electron/main.cts unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.5 Forward the channel from `electron/preload.cts`
    ```yaml
    description: "Add the matching key to the praxisAPI object literal exposed via contextBridge."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add one forwarder key to the existing `praxisAPI` object literal, beside `pickProjectFolder`. It only forwards — no adapter logic, no error translation, exactly like its seven siblings."
      - |
        Apply this block to electron/preload.cts:
        <<<<<<< SEARCH
          pickProjectFolder: (): Promise<string | null> => ipcRenderer.invoke('pickProjectFolder'),
        });
        =======
          pickProjectFolder: (): Promise<string | null> => ipcRenderer.invoke('pickProjectFolder'),
          getAppVersion: (): Promise<string | null> => ipcRenderer.invoke('getAppVersion'),
        });
        >>>>>>> REPLACE
      - "Leave the second global, `praxisSkillInstallAPI`, completely untouched. It is a separate concern with its own handlers."
    pattern: "electron/preload.cts only."
    imports: "None new. `contextBridge` and `ipcRenderer` are already imported."
    compatibility: "The channel name must match task 1.4's `ipcMain.handle('getAppVersion', ...)` exactly — an invoke on an unregistered channel rejects at runtime. electron/tsconfig.json sets noEmitOnError true."
    gotcha: "Adding the key to `praxisSkillInstallAPI` instead of `praxisAPI` exposes it on the wrong global and the renderer finds nothing. A channel-name typo compiles cleanly and fails only at runtime."
    verify:
      - "`npm run build` exits 0."
      - "Run `npm run electron:dev`. In the window's devtools console, `await window.praxisAPI.getAppVersion()` returns the string `\"1.0.0\"`."
      - "In the same session, confirm adding a project, opening a board, and the Choose folder picker all still work."
    checklist:
      - "Is the key added to the `praxisAPI` object literal and not to `praxisSkillInstallAPI`?"
      - "Does the channel string match `getAppVersion` exactly, as registered in task 1.4?"
      - "Does the wrapper only forward, adding no error translation or adapter logic?"
      - "Were the seven existing keys left unchanged?"
      - "Does `await window.praxisAPI.getAppVersion()` return a string in the Electron window, not an envelope object?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — The user sees the version

  ```yaml
  description: "Add the shared renderer module, put it in the build list, and add the footer element and script tag to both pages. This is where the acceptance criteria become visible."
  ```

  - [x] 2.1 Create `src/public/app-version.ts`
    ```yaml
    description: "One small shared script that reads the version and writes it into #app-version, and no-ops on any failure."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create the new file `src/public/app-version.ts`. It must contain no `import` and no `export` keyword, exactly like ipc-adapter.ts and browser-ipc-shim.ts, because src/public/tsconfig.json sets `module: \"none\"` and rejects a module file."
      - "The file knows exactly two things: how to call `window.praxisAPI.getAppVersion()`, and how to write the result into the element with id `app-version`. Give it a single top-level function invoked immediately."
      - "Look the element up with `document.getElementById('app-version')`. If it is null, return without calling the API at all."
      - "Call `window.praxisAPI.getAppVersion()`. On a resolved value that is a non-empty string, set the element's `textContent` to `'Version ' + version` and remove its `hidden` attribute. On `null`, return and leave the element hidden, so acceptance criterion 5 holds with no visible error."
      - "Attach a `.catch` that swallows the rejection and returns, so a rejected IPC invoke can never surface as an uncaught exception in the console."
      - "The file must NOT know about projects, boards, workstreams, the registry, the KPI strip, or the filter chips. It reads no other DOM element and calls no other praxisAPI method. Add no CSS class, no inline style, and no link."
    pattern: "src/public/app-version.ts — a new file. No existing file changes in this task."
    imports: "None. `PraxisAPI` and `Window.praxisAPI` come from ipc-adapter.ts's ambient global declarations, which are in scope because module is \"none\"."
    compatibility: "Compiled by src/public/tsconfig.json with target es2020, lib [dom, es2020], types [], strict true, noEmitOnError true. Because `types` is empty there are no Node globals — use DOM APIs only. Output lands at dist/public/app-version.js through the existing rootDir/outDir pair."
    gotcha: "An `import` or `export` keyword turns the file into a module and the ambient PraxisAPI declarations stop resolving. Writing only the bare number without the word `Version` fails the settled wording. Removing the `hidden` attribute before the value arrives shows an empty row. Setting `innerHTML` instead of `textContent` opens an injection path for no gain."
    verify:
      - "`grep -cE '^(import|export)\\b' src/public/app-version.ts` returns 0."
      - "`grep -o \"getElementById([^)]*)\" src/public/app-version.ts | grep -vc \"app-version\"` returns 0 — the file looks up no element other than #app-version."
      - "`grep -c 'praxisAPI\\.' src/public/app-version.ts` returns 1, and that one call is getAppVersion — the file calls no other API method."
      - "`npx tsc -p src/public/tsconfig.json --noEmit` still exits 0. The new file is not compiled yet, because task 2.2 has not added it to the include array."
    checklist:
      - "Does the file contain no `import` and no `export` keyword?"
      - "Does it return early and call no API when `#app-version` is absent?"
      - "Does it leave the element hidden and show no error when getAppVersion resolves to null?"
      - "Does it catch a rejected promise so no uncaught exception can reach the console?"
      - "Does it set `textContent` to the word `Version`, a space, then the version string?"
      - "Does it touch no DOM element other than `#app-version` and call no praxisAPI method other than getAppVersion?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Add `app-version.ts` to `src/public/tsconfig.json`'s include array
    ```yaml
    description: "Put the new file in the explicit build list so tsc emits dist/public/app-version.js."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "The `include` array in src/public/tsconfig.json is an explicit file list, not a glob, so a new file is invisible to tsc until it is named there. Add `\"app-version.ts\"` to it."
      - |
        Apply this block to src/public/tsconfig.json:
        <<<<<<< SEARCH
          "include": ["app.ts", "home.ts", "ipc-adapter.ts", "browser-ipc-shim.ts", "../types/praxis-data.d.ts", "lib/agentic-tools-scope.ts"]
        =======
          "include": ["app.ts", "home.ts", "ipc-adapter.ts", "browser-ipc-shim.ts", "app-version.ts", "../types/praxis-data.d.ts", "lib/agentic-tools-scope.ts"]
        >>>>>>> REPLACE
      - "Change no compilerOptions value in this file. Do not replace the include array with a glob."
    pattern: "src/public/tsconfig.json only."
    imports: "None."
    compatibility: "The file carries `// ...` comments, so it is JSONC and any tooling that reads it must tolerate them. rootDir is `..` and outDir is `../../dist`, so app-version.ts emits to dist/public/app-version.js with no further configuration."
    gotcha: "This is the plan's top risk. Omitting this entry means tsc emits no app-version.js, the <script> tag added in tasks 2.3 and 2.4 404s, and the footer silently stays empty with no error anywhere. Adding the entry before task 2.1's file exists makes the build fail on a missing input file."
    verify:
      - "`npm run build` exits 0."
      - "`test -f dist/public/app-version.js && echo OK` prints OK."
      - "`git diff -- src/public/tsconfig.json` shows one changed line and no change to any compilerOptions value."
    checklist:
      - "Is `\"app-version.ts\"` present in the include array?"
      - "Was the array kept as an explicit file list rather than converted to a glob?"
      - "Are all six pre-existing include entries still present and unchanged?"
      - "Were the compilerOptions and the file's comments left untouched?"
      - "Does dist/public/app-version.js exist after `npm run build`?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.3 Add the footer element and the script tag to `src/public/index.html`
    ```yaml
    description: "One div inside the existing footer, one script tag after browser-ipc-shim.js."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor A — the `<footer class=\"note\">` block at src/public/index.html:35-40. Add `<div id=\"app-version\" hidden></div>` as the LAST child of that footer, on its own line immediately before the closing `</footer>` tag. Leave the existing prose inside the footer byte-for-byte unchanged."
      - "Use a `<div>`, not a `<span>`, so the line sits on its own row with no new CSS. Give it no class and no inline style — `footer.note` at src/public/styles.css:481 already sets the colour and font size and the child inherits both."
      - "Anchor B — the script block at the end of the body. `<script src=\"browser-ipc-shim.js\"></script>` is at src/public/index.html:71. Add `<script src=\"app-version.js\"></script>` on the line immediately after it, before the existing `lib/agentic-tools-scope.js` and `home.js` tags. The shim installs window.praxisAPI at script-load time in a browser tab, so the new script must come after it."
      - "Change src/public/styles.css in no way, and change src/public/home.ts in no way."
    pattern: "src/public/index.html only."
    imports: "The emitted dist/public/app-version.js from task 2.2."
    compatibility: "tools/copy-assets.mjs already copies index.html, so it needs no change. The server's Content-Security-Policy allows `script-src 'self'`, so the new same-origin script file needs no policy change. The `hidden` attribute keeps the row invisible until app-version.js fills it."
    gotcha: "Placing the script tag before browser-ipc-shim.js means window.praxisAPI is undefined when it runs in a browser tab. Omitting the `hidden` attribute leaves an empty row visible when the version cannot be obtained, which breaks acceptance criterion 5. Adding a class to the div would pull in styles.css, which the plan forbids."
    verify:
      - "`npm run build` exits 0."
      - "Run `npm start`, open `http://localhost:4173`, and confirm the footer's last line reads exactly `Version 1.0.0`."
      - "`git diff --name-only -- src/public/styles.css src/public/home.ts src/public/app.ts` returns zero lines."
    checklist:
      - "Is the div the last child of `<footer class=\"note\">`, with id `app-version` and the `hidden` attribute?"
      - "Is it a `<div>` with no class and no inline style?"
      - "Does the `app-version.js` script tag sit after `browser-ipc-shim.js`?"
      - "Is the existing footer prose unchanged?"
      - "Are styles.css, home.ts and app.ts all unmodified?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.4 Add the footer element and the script tag to `src/public/board.html`, then check every acceptance criterion
    ```yaml
    description: "The same two edits on the board page, plus the plan's full end-to-end verification pass."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor A — the `<footer class=\"note\">` block at src/public/board.html:79-84. Add `<div id=\"app-version\" hidden></div>` as the LAST child of that footer, immediately before the closing `</footer>` tag. Use the exact same markup as index.html, so one shared script covers both pages. Leave the existing footer prose byte-for-byte unchanged."
      - "Anchor B — `<script src=\"browser-ipc-shim.js\"></script>` at src/public/board.html:129. Add `<script src=\"app-version.js\"></script>` on the line immediately after it, before the existing `app.js` tag."
      - "Change src/public/styles.css, src/public/app.ts, and the `#filter-chips` block at src/public/board.html:50 in no way. The filter row stays hidden and the board's sort, KPI, panel, and modal behaviour must be identical."
    pattern: "src/public/board.html only."
    imports: "The emitted dist/public/app-version.js from task 2.2."
    compatibility: "tools/copy-assets.mjs already copies board.html. The element id must match index.html's exactly, because both pages share one app-version.ts. The CSP needs no change."
    gotcha: "Using a different element id here would leave one page blank. Placing the script tag after app.js still works but drifts from the plan's stated load order — keep it directly after browser-ipc-shim.js. Reformatting the surrounding markup would make the diff misleading about what actually changed."
    verify:
      - "`npm run build` exits 0."
      - "Run `npm run electron:dev`. Confirm the footer reads `Version 1.0.0` on the home page and on a board page (acceptance criterion 1)."
      - "Run `npm start` and open both `http://localhost:4173` and a board page in a browser tab. Confirm the same line on both (acceptance criterion 2)."
      - "With the server running, `curl -si http://localhost:4173/api/version` returns `HTTP/1.1 200` and the body `{\"version\":\"1.0.0\"}` (acceptance criterion 3)."
      - "Change `version` in package.json to `1.0.1`, run `npm run build`, and confirm both the Electron window and the browser tab show `Version 1.0.1`. Restore the value to `1.0.0` and rebuild (acceptance criterion 4)."
      - "Stop the server, reload a stale browser tab, and confirm the footer shows no version line and the browser console shows no uncaught exception (acceptance criterion 5)."
      - "`git diff --name-only` lists exactly these nine paths and nothing else: src/server.ts, src/public/ipc-adapter.ts, src/public/browser-ipc-shim.ts, src/public/app-version.ts, src/public/tsconfig.json, src/public/index.html, src/public/board.html, electron/ipc-handlers.cts, electron/preload.cts. In particular `git diff --name-only -- src/public/styles.css src/public/app.ts src/public/home.ts electron/main.cts package.json` returns zero lines (acceptance criterion 6)."
      - "`grep -n 'id=\"filter-chips\"' src/public/board.html` still shows the `hidden` attribute on that element, and `.praxis-projects.json` is unmodified."
    checklist:
      - "Is the div the last child of board.html's `<footer class=\"note\">`, with the same id and `hidden` attribute as index.html's?"
      - "Does the `app-version.js` script tag sit between `browser-ipc-shim.js` and `app.js`?"
      - "Do all six acceptance criteria pass, including the 1.0.1 rebuild check with the value restored to 1.0.0 afterwards?"
      - "Does the stale-tab case show no version line and no uncaught console exception?"
      - "Does `git diff --name-only -- src/public/styles.css src/public/app.ts src/public/home.ts electron/main.cts package.json` return zero lines?"
      - "Is `#filter-chips` still hidden and the project registry untouched?"
    self_eval:
      passed: true
      failures: []
    ```

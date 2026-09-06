---
id: TL-87-sb1ghy
type: tasklist
workstream: WS-83-vskjrr
slug: disable-integrations-button-over-lan
title: "Disable Manage integrations when the dashboard is viewed over LAN"
status: ready
created: 2026-08-31
updated: 2026-08-31
author: Anthony Koukoullis
depends_on: [PLN-74-npqccu]
links: []
mode: spec
base_commit: fe1e9c9
---

# PRX Tasks

## Disable Manage integrations when the dashboard is viewed over LAN

The server already refuses every `/api/integrations/*` request from a non-loopback peer
with HTTP 403 (`isLoopbackRemote`, `src/server.ts:167`, applied at `src/server.ts:807`).
The "Manage integrations" button does not know this, so a LAN viewer opens the dialog and
every action fails with no explanation.

This list implements PLN-74-npqccu in full. The server gains one new ungated route,
`GET /api/local-access`, which answers with the result of the *same* `isLoopbackRemote`
call the gate uses. The home page ships the button `disabled` with an explanatory `title`,
and a new browser module `src/public/lib/integrations-access.ts` enables it only when that
route reports `local: true`. The client fails closed: any non-200, any unparseable body,
and any network failure leaves the button disabled.

The loopback gate itself is not touched. The Electron build reaches integrations through
native IPC and always loads its window from `http://127.0.0.1:<port>`, so the same fetch
answers `local: true` there by construction and no LAN logic is added to the IPC transport.

Stage order follows the plan: the server fact first, because it is the only part that can
be wrong in a way the UI cannot reveal, then the client gate.

Out of scope, per the plan and enforced by the checklists below: any change to
`isLoopbackRemote`, `isLoopbackHost`, `LOOPBACK_HOSTS` or `passesOriginCheck`; any change
to the integrations dialog's contents, rows, scope segment or install flow; any
authentication or per-user permission mechanism; any gating of non-integrations features
over LAN; and any change to `board.html`.

- [ ] 1. Server fact — expose `GET /api/local-access`

  ```yaml
  description: "Add the ungated GET /api/local-access route and the two integration tests that prove it from a loopback peer and from a non-loopback peer."
  ```

  - [ ] 1.1 Add the `GET /api/local-access` route to `src/server.ts`
    ```yaml
    description: "Add one new route block inside handleApi that answers 200 with { local: isLoopbackRemote(req) }, placed above the /api/integrations/ branch so the loopback gate never sees it."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/server.ts and locate the /api/version block inside handleApi (src/server.ts:790-797) and the `if (reqPath.startsWith('/api/integrations/'))` branch that follows it (src/server.ts:799)."
      - "Insert one new route block between those two, after the /api/version block's closing brace and before the /api/integrations/ branch. Position is the contract: a block placed after line 799 would be answered with 403 by the gate at src/server.ts:807, which is exactly the case this route exists to report."
      - "On method GET, answer 200 through the existing sendJson helper with a body whose single field is `local`, set to the return of `isLoopbackRemote(req)`. Call that function directly — add no second implementation, no new helper, no module-scope state, and no filesystem read."
      - "On any other method, answer 405 through sendJson with { error: 'Method not allowed' }, matching the shape the integrations routes already use (src/server.ts:814)."
      - "Add a short comment above the block stating why the path deliberately does not begin with /api/integrations/."
    pattern: "src/server.ts — handleApi only. No other file."
    imports: "None new. isLoopbackRemote (src/server.ts:167) and sendJson are already module-local."
    compatibility: "PLN-74-npqccu, Design — Server contract. Root tsconfig.json is module/moduleResolution node16, target es2022, strict, noEmitOnError. The `local` field is required, is always a boolean, and is never null."
    gotcha: "Placing the block below the /api/integrations/ branch silently inverts the whole feature. Do not edit isLoopbackRemote, isLoopbackHost, LOOPBACK_HOSTS or passesOriginCheck — the plan puts all four out of scope. The route needs no protection beyond passesOriginCheck (src/server.ts:872), which every route already sits behind."
    verify:
      - "npm run build"
      - "PORT=4173 node dist/server.js & then curl -s http://127.0.0.1:4173/api/local-access — the body must be exactly {\"local\":true}"
      - "curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{}' http://127.0.0.1:4173/api/local-access — must print 405. Stop the server afterwards."
      - "git diff -- src/server.ts | grep -cE '^[-+].*(function isLoopbackRemote|function isLoopbackHost|LOOPBACK_HOSTS|function passesOriginCheck)' — must print 0"
    checklist:
      - "Is the new block positioned after the /api/version block and before the `reqPath.startsWith('/api/integrations/')` branch?"
      - "Does the 200 body carry exactly one field, `local`, whose value is the direct return of isLoopbackRemote(req)?"
      - "Does a non-GET method answer 405 with { error: 'Method not allowed' }?"
      - "Is the diff confined to src/server.ts, with no new module-scope state, no new helper function, and no filesystem read?"
      - "Does the grep over the diff for isLoopbackRemote, isLoopbackHost, LOOPBACK_HOSTS and passesOriginCheck definitions print 0?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 1.2 Add the loopback cases to `src/server.test.ts`
    ```yaml
    description: "Append two node:test cases proving GET /api/local-access answers 200 with local: true from the loopback peer this suite already binds, and that a non-GET answers 405."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/server.test.ts. It already drives a real server bound to 127.0.0.1 with PORT=0, and exposes `base` (src/server.test.ts:23-27) and a `postJson(route, body)` helper (src/server.test.ts:38-45). Reuse both — add no new server, no new import beyond what the file already has."
      - "Append a test asserting that fetch(base + '/api/local-access') answers status 200 and that the parsed body's `local` is strictly true."
      - "Append a second test asserting that postJson('/api/local-access', {}) answers status 405 and that the parsed body's `error` is 'Method not allowed'."
      - "Place both after the existing tests. Do not modify any existing case, the tmpDir fixture, or the `after` hook."
    pattern: "src/server.test.ts only."
    imports: "None new — test and assert are already imported at src/server.test.ts:10-11."
    compatibility: "PLN-74-npqccu, Testing strategy, stage 1 integration. node:test plus node:assert/strict, matching the file's existing pattern. Run against the built dist output, not the TypeScript source."
    gotcha: "Use the existing postJson helper for the 405 case. A bare POST without a Content-Type of application/json is refused with 403 by the check at src/server.ts:670 before any route match, so a hand-rolled fetch would assert the wrong status. The runner needs --test-force-exit: importing the server binds a listening socket as a module side effect and nothing exports a close handle."
    verify:
      - "npm run build"
      - "node --test --test-force-exit dist/server.test.js — every test passes, including the two new cases"
    checklist:
      - "Do both new tests use the module-level `base` rather than binding a second server?"
      - "Does the 405 case go through the existing postJson helper, so the Content-Type check is satisfied?"
      - "Does the 200 case assert `local` strictly equals true, not merely that the field is truthy?"
      - "Are all pre-existing tests in the file unmodified and still passing?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 1.3 Register `src/server-lan.test.ts` in the root `tsconfig.json`
    ```yaml
    description: "Add the new non-loopback test file to the root tsconfig include array, so it is compiled into dist/ and can be run by node --test. See Divergence 1."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "The root tsconfig.json names its test inputs one by one rather than by glob, so a test file that is imported by nothing is never compiled unless it is listed. Add src/server-lan.test.ts beside the existing src/server.test.ts entry. This task is ordered before the file is created on purpose: a tsconfig include entry that matches nothing is ignored without error, so this edit is safe on its own, and it lets task 1.4 verify itself by running the built test."
      - |
        tsconfig.json
        <<<<<<< SEARCH
          "include": ["src/server.ts", "src/server.test.ts", "src/lib/**/*.ts", "src/scripts/**/*.ts", "src/types/**/*.d.ts"]
        =======
          "include": ["src/server.ts", "src/server.test.ts", "src/server-lan.test.ts", "src/lib/**/*.ts", "src/scripts/**/*.ts", "src/types/**/*.d.ts"]
        >>>>>>> REPLACE
    pattern: "tsconfig.json at the repository root only. Do not touch src/public/tsconfig.json or electron/tsconfig.json here."
    imports: "None."
    compatibility: "PLN-74-npqccu, Testing strategy, stage 1 non-loopback peer. rootDir src, outDir dist, so the file compiles to dist/server-lan.test.js."
    gotcha: "Order inside the array is cosmetic, but keeping the new entry next to src/server.test.ts keeps the two test inputs together. Adding the file to `files` instead of `include` would error while the file is still absent."
    verify:
      - "npx tsc -p tsconfig.json --noEmit — exits 0"
      - "grep -c 'src/server-lan.test.ts' tsconfig.json — must print 1"
    checklist:
      - "Is src/server-lan.test.ts present in the root tsconfig.json include array?"
      - "Are all pre-existing include entries unchanged and in their original order?"
      - "Does npx tsc -p tsconfig.json --noEmit still exit 0?"
      - "Is src/public/tsconfig.json untouched by this task?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 1.4 Add `src/server-lan.test.ts` — the non-loopback peer case
    ```yaml
    description: "Create a second integration test file that binds HOST=0.0.0.0, requests /api/local-access at a real non-internal IPv4 address, and asserts local: false while /api/integrations/* still answers 403."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/server-lan.test.ts. Model its shape on src/server.test.ts:1-27 — a header comment stating the run command, node:test plus node:assert/strict imports, then the environment variables set BEFORE the single dynamic `await import('./server.js')`."
      - "Set process.env.PORT to '0' and process.env.HOST to '0.0.0.0' before that import. The server reads both at module evaluation time, so assigning them afterwards is too late."
      - "Read the bound port back from the exported serverReady promise (src/server.ts:916), exactly as src/server.test.ts:25-26 does. PORT=0 asks the OS for an ephemeral port, so it cannot be hardcoded."
      - "Find the first non-internal IPv4 address from os.networkInterfaces(). When the host has none, skip the tests rather than failing — a build machine with no LAN interface is a valid environment."
      - "Assert that a GET of /api/local-access at http://<that address>:<port> answers status 200 with `local` strictly false. This is the first single-machine reproduction of the non-loopback path."
      - "Assert that a GET of /api/integrations/tools at the same address still answers 403, proving the plan's acceptance criterion 6: the new route is reachable from a non-loopback peer and no /api/integrations/* request changes behaviour."
      - "Do not add this to src/server.test.ts. That file forces HOST=127.0.0.1 before its single module import, and the server reads the host once."
    pattern: "src/server-lan.test.ts — a new file. src/server.test.ts must not be edited by this task."
    imports: "node:test, node:assert/strict, node:os, and a dynamic import of './server.js'."
    compatibility: "PLN-74-npqccu, Testing strategy, stage 1 non-loopback peer. Root tsconfig.json: module node16, so the import specifier carries the .js extension. Requires task 1.3 for the file to reach dist/."
    gotcha: "The Host header on these requests is a bare IPv4 literal, which passesOriginCheck accepts through net.isIP (src/server.ts:143), so no ALLOWED_HOSTS value is needed. The runner needs --test-force-exit for the same reason src/server.test.ts states. Binding 0.0.0.0 opens the port to the LAN for the duration of the run."
    verify:
      - "npm run build"
      - "node --test --test-force-exit dist/server-lan.test.js — passes, or reports the tests as skipped on a host with no non-internal IPv4 interface"
      - "node --test --test-force-exit dist/server.test.js — still passes, proving the two suites do not interfere"
    checklist:
      - "Are PORT and HOST assigned before the dynamic import of './server.js', and is HOST set to '0.0.0.0'?"
      - "Is the port read back from serverReady rather than hardcoded?"
      - "Does the suite skip cleanly when os.networkInterfaces() yields no non-internal IPv4 address?"
      - "Does the /api/local-access assertion require `local` to be strictly false?"
      - "Does the suite also assert that /api/integrations/tools still answers 403 from the same non-loopback address?"
      - "Is src/server.test.ts unmodified by this task?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 2. Client gate — ship the button disabled and enable it only on `local: true`

  ```yaml
  description: "Add the browser module that reads the route, ship the Manage integrations button disabled with its explanatory title, enable it from home.ts, style the disabled state, and verify the three surfaces."
  ```

  - [ ] 2.1 Register `lib/integrations-access.ts` in `src/public/tsconfig.json`
    ```yaml
    description: "Add the new browser module to the public tsconfig include array, which names every browser module explicitly. See Divergence 2."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "src/public/tsconfig.json lists each browser module by name, including both existing lib/ files. Add lib/integrations-access.ts beside lib/agentic-tools-api.ts so the array stays exhaustive. tsc would reach the module anyway through home.ts's import, so this changes no build output — it keeps the file's own convention true."
      - |
        src/public/tsconfig.json
        <<<<<<< SEARCH
          "include": ["app.ts", "home.ts", "theme.ts", "theme-init.ts", "theme-toggle.ts", "ipc-adapter.ts", "browser-ipc-shim.ts", "app-version.ts", "update-banner.ts", "../types/praxis-data.d.ts", "lib/agentic-tools-scope.ts", "lib/agentic-tools-api.ts"]
        =======
          "include": ["app.ts", "home.ts", "theme.ts", "theme-init.ts", "theme-toggle.ts", "ipc-adapter.ts", "browser-ipc-shim.ts", "app-version.ts", "update-banner.ts", "../types/praxis-data.d.ts", "lib/agentic-tools-scope.ts", "lib/agentic-tools-api.ts", "lib/integrations-access.ts"]
        >>>>>>> REPLACE
    pattern: "src/public/tsconfig.json only. The root tsconfig.json is not touched here."
    imports: "None."
    compatibility: "PLN-74-npqccu, Design — Client contract: the module needs no script tag and no bundler change. This edit adds neither; it only keeps the type-check input list exhaustive."
    gotcha: "An include entry that matches no file is ignored without error, so this edit is safe before task 2.2 creates the module. Do not add the module to tools/bundle-public.mjs — that script bundles the import graph from home.ts and needs no per-file list."
    verify:
      - "npx tsc -p src/public/tsconfig.json — exits 0"
      - "grep -c 'lib/integrations-access.ts' src/public/tsconfig.json — must print 1"
    checklist:
      - "Is lib/integrations-access.ts present in the src/public/tsconfig.json include array?"
      - "Are all pre-existing include entries unchanged and in their original order?"
      - "Is tools/bundle-public.mjs untouched?"
      - "Does npx tsc -p src/public/tsconfig.json still exit 0?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 2.2 Create `src/public/lib/integrations-access.ts`
    ```yaml
    description: "Add the browser module exporting isLocalAccess(): Promise<boolean>, which resolves true only on a 200 whose parsed body's local is exactly true, and never rejects."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/public/lib/integrations-access.ts with a single named export matching the plan's contract exactly: `export function isLocalAccess(): Promise<boolean>`."
      - "The function performs its own fetch of '/api/local-access'. Resolve true only when the response status is 200 AND the parsed body's `local` is strictly equal to true. Resolve false for every other status, an unparseable body, and a network failure."
      - "Wrap the fetch and the body parse together so a throw from either resolves false. The function must never reject — the plan's fail-closed rule depends on it."
      - "Open the file with a header comment in the style of src/public/lib/agentic-tools-api.ts:1-13, stating the two things this module knows (the route's URL and its response shape) and the things it must not know: the button, the dialog, any DOM API, window.praxisSkillInstallAPI, window.praxisAPI, and PraxisIpcResult."
      - "State in that comment why it does not reuse browser-ipc-shim.ts's module-private fetchIpc: it needs a boolean, not the status-and-error envelope that helper builds."
      - "Type the parsed body defensively rather than asserting a shape — an unknown value narrowed to a boolean is enough, and it keeps the strict flag satisfied without a cast that could hide a null."
    pattern: "src/public/lib/integrations-access.ts — a new file beside agentic-tools-api.ts and agentic-tools-scope.ts."
    imports: "None. The module imports nothing and is imported only by home.ts (task 2.4)."
    compatibility: "PLN-74-npqccu, Design — Client contract. src/public/tsconfig.json: target es2020, lib dom + es2020, types [], strict, isolatedModules. connect-src 'self' in the server's CSP (src/server.ts:47-50) already permits the request."
    gotcha: "res.json() throws on an unparseable body, so it must sit inside the same guarded region as the fetch. `types: []` in the public tsconfig is load-bearing — do not reference any Node type here. isolatedModules is on, so any type-only export must use `export type`. Do not import from ipc-adapter or agentic-tools-api."
    verify:
      - "npx tsc -p src/public/tsconfig.json — exits 0"
      - "npm run build — succeeds, and dist/public/home.js is produced"
      - "grep -cE 'praxisSkillInstallAPI|praxisAPI|PraxisIpcResult|document\\.|getElementById' src/public/lib/integrations-access.ts — must print 0"
    checklist:
      - "Does the module export exactly one symbol, isLocalAccess, returning Promise<boolean>?"
      - "Does it resolve true only when the status is 200 and `local` is strictly true?"
      - "Does it resolve false rather than rejecting on a network failure and on an unparseable body?"
      - "Does the grep for DOM and IPC identifiers print 0, proving the module knows nothing about the button, the dialog, or the IPC surface?"
      - "Does the module import nothing, and reference no Node type?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 2.3 Ship the button `disabled` with its explanatory `title` in `src/public/index.html`
    ```yaml
    description: "Make the disabled state the resting state of the Manage integrations button, and carry the reason in a title attribute, so no click can reach the dialog before the server answers."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "The button at src/public/index.html:15 currently ships enabled. Add the `disabled` attribute and a `title` stating that integrations are available only on the machine that runs the server. Per PLN-74-npqccu's Assumptions, the explanation is delivered by the title attribute alone — add no visible toolbar text."
      - |
        src/public/index.html
        <<<<<<< SEARCH
          <button type="button" id="manage-integrations-button" class="tb-button">Manage integrations</button>
        =======
          <button type="button" id="manage-integrations-button" class="tb-button" disabled title="Integrations are available only on the machine that runs the server">Manage integrations</button>
        >>>>>>> REPLACE
    pattern: "src/public/index.html only. src/public/board.html carries no integrations button and must not be edited."
    imports: "None."
    compatibility: "PLN-74-npqccu, Design — Markup, and acceptance criteria 2 and 8. The button keeps its id, its type, its class and its text, so home.ts's byId lookup and the toolbar layout are unchanged."
    gotcha: "Reverting only home.ts later while leaving this attribute in place would disable the button for every user, local ones included — the plan's rollback note requires stage 2 to be reverted as a unit. Do not change the id, the class, or the button text; both home.ts and styles.css key off them."
    verify:
      - "grep -c 'id=\"manage-integrations-button\"' src/public/index.html — must print 1"
      - "grep -c 'id=\"manage-integrations-button\" class=\"tb-button\" disabled title=' src/public/index.html — must print 1"
      - "git diff --name-only -- src/public/board.html — must print nothing"
    checklist:
      - "Does the button carry both the disabled attribute and a title attribute?"
      - "Does the title state that integrations are available only on the machine that runs the server?"
      - "Are the id, type, class and visible text of the button unchanged?"
      - "Is src/public/board.html untouched, and is no visible toolbar text added anywhere?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 2.4 Enable the button from `src/public/home.ts` on `local: true`
    ```yaml
    description: "Import isLocalAccess and call it once at init, clearing the button's disabled attribute and title only when it resolves true."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add an import of isLocalAccess from './lib/integrations-access' alongside the existing './lib/agentic-tools-scope' import at src/public/home.ts:22-23. The import order note at the top of the file governs the side-effect imports at lines 16-19 only; this is a value import and belongs with the other value imports below them."
      - "At the integrations wiring block, immediately after the click handler registered at src/public/home.ts:896-902, call isLocalAccess() once at init time."
      - "On true, clear the button's disabled state and remove its title, mirroring the pattern already used at src/public/home.ts:357-358 for the Project scope button. On false, do nothing — the resting state set by task 2.3 is already correct."
      - "byId (src/public/home.ts:82) returns HTMLElement, which has no `disabled` property, so narrow the element to HTMLButtonElement before clearing it."
      - "Add no rejection handler. isLocalAccess never rejects by contract, and a rejection path that enabled the button would break the fail-closed rule. Do not add a second guard inside the dialog: the button at src/public/home.ts:896 is its only opener."
      - "Do not modify the click handler's body, populateIntegrationsProjectSelect, resetIntegrationsModalState, or any other integrations function."
    pattern: "src/public/home.ts only — one import line and one init-time call."
    imports: "isLocalAccess from './lib/integrations-access' (task 2.2)."
    compatibility: "PLN-74-npqccu, Design — Wiring, and acceptance criteria 1, 3 and 4. src/public/tsconfig.json is strict with isolatedModules; esbuild bundles this file and its import graph into dist/public/home.js."
    gotcha: "This file owns the DOM effect and nothing about how the answer is computed — do not move any fetch or URL knowledge into home.ts. The Electron window loads from http://127.0.0.1:<port> (electron/main.cts:98), so the same call answers true there; add no Electron branch and no window.praxisSkillInstallAPI check."
    verify:
      - "npx tsc -p src/public/tsconfig.json — exits 0"
      - "npm run build — succeeds"
      - "npm start, then open http://127.0.0.1:4173 — the Manage integrations button is enabled and the dialog opens and behaves exactly as before"
      - "grep -cE \"fetch\\(|/api/local-access\" src/public/home.ts — must print 0, proving the route URL stayed inside the new module"
    checklist:
      - "Is isLocalAccess imported from './lib/integrations-access' and called exactly once, at init time?"
      - "Does the true branch clear both the disabled state and the title, and does the false branch do nothing?"
      - "Is the element narrowed to HTMLButtonElement rather than cast in a way that bypasses strict checking?"
      - "Is there no rejection handler, no Electron branch, and no second guard inside the dialog?"
      - "Does the grep prove that no fetch call and no reference to /api/local-access was added to home.ts?"
      - "Are the click handler body and every other integrations function unchanged?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 2.5 Add the disabled styling in `src/public/styles.css`
    ```yaml
    description: "Give .tb-button a greyed, non-interactive disabled appearance and narrow the existing hover rule so it does not apply while disabled, keeping the button's box metrics unchanged."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "The hover rule at src/public/styles.css:247 currently applies to a disabled button as well, so a greyed control would still light up under the pointer. Narrow it with :not(:disabled) and add a .tb-button:disabled rule beneath the focus rule. The box, border width and padding stay as they are, so `.toolbar .tb-button { margin-left: auto }` at src/public/styles.css:254 keeps right-aligning the toolbar."
      - |
        src/public/styles.css
        <<<<<<< SEARCH
        .tb-button:hover { background: color-mix(in srgb, var(--toolbar-bg) 90%, var(--toolbar-shade) 10%); color: var(--toolbar-ink); }
        .tb-button:focus-visible { outline: 2px solid var(--toolbar-ink); outline-offset: 2px; }
        =======
        .tb-button:hover:not(:disabled) { background: color-mix(in srgb, var(--toolbar-bg) 90%, var(--toolbar-shade) 10%); color: var(--toolbar-ink); }
        .tb-button:focus-visible { outline: 2px solid var(--toolbar-ink); outline-offset: 2px; }
        /* Greyed and non-interactive. Colour and cursor only: the border width, the
           padding and the font size are untouched, so the button's box never resizes
           and `.toolbar .tb-button { margin-left: auto }` below keeps right-aligning
           the toolbar. */
        .tb-button:disabled { color: var(--toolbar-ink-faint); cursor: not-allowed; opacity: 0.6; }
        >>>>>>> REPLACE
    pattern: "src/public/styles.css only, in the .tb-button block at lines 242-255."
    imports: "None. --toolbar-ink-faint is already in use at src/public/styles.css:243 and 253."
    compatibility: "PLN-74-npqccu, Design — Styling, and acceptance criterion 1. The rule targets .tb-button generally; board.html's toolbar carries no .tb-button, so no other page is affected."
    gotcha: "Do not add display: none or visibility: hidden — the plan rejects hiding the button, because removing it also removes the margin-left: auto anchor that right-aligns the toolbar. Do not change flex, border-width, padding or font-size in the disabled rule; any of those would resize the box and shift the theme toggle."
    verify:
      - "npm run build — succeeds"
      - "npm start, then open http://127.0.0.1:4173 — the enabled button still hovers and focuses exactly as before"
      - "In the browser dev tools, force the :disabled state on the button and confirm it greys, shows a not-allowed cursor, does not change its hover background, and does not change width — the theme toggle stays in the same position"
      - "grep -cE 'tb-button:disabled|tb-button:hover:not\\(:disabled\\)' src/public/styles.css — must print 2"
    checklist:
      - "Is the hover rule narrowed with :not(:disabled) so it cannot apply to a disabled button?"
      - "Does the disabled rule grey the button and set a not-allowed cursor?"
      - "Does the disabled rule leave flex, border-width, padding and font-size untouched, so the box does not resize?"
      - "Is the button still rendered rather than hidden, so margin-left: auto still anchors the toolbar?"
      - "Are the focus-visible and margin rules unchanged?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 2.6 Verify the three surfaces against the plan's acceptance criteria
    ```yaml
    description: "Run the plan's stage 2 manual checks across LAN, loopback and Electron, confirming the disabled state, the tooltip, the enabled state, and that no other feature changed over LAN."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "src/public/ carries no test harness and PLN-74-npqccu adds none, so stage 2 is proven by running the app on all three surfaces. Change no source file in this task. If a check fails, fix it in the task that owns the file (2.2 to 2.5) and re-run these steps."
      - "LAN surface: run npm run start:lan and open the dashboard at the machine's own LAN address. The peer address is then the LAN address rather than loopback, so the disabled state reproduces without a second device; a second device on the LAN is the fallback."
      - "Loopback surface: run npm start and open http://127.0.0.1:4173."
      - "Electron surface: run npm run electron:dev."
      - "Record the outcome of each acceptance criterion in the checklist below before marking this task complete."
    pattern: "No file is edited. The whole of stage 2 is under test."
    imports: "None."
    compatibility: "PLN-74-npqccu, Testing strategy stage 2, covering acceptance criteria 1, 2, 3, 4, 7 and 8."
    gotcha: "Native tooltips on disabled buttons are inconsistent across browsers; the plan accepts this and ships title-only, so an invisible tooltip is a recorded observation, not a fix to make here. A browser holding a cached home.js against a freshly served index.html leaves the button disabled until a reload — reload before judging a failure. npm run start:lan binds 0.0.0.0, which exposes the port to the LAN for the duration of the run."
    verify:
      - "npm run start:lan, then open http://<this machine's LAN IPv4>:4173 — the Manage integrations button is greyed and cannot be clicked, and hovering it shows the title"
      - "On the same LAN page, confirm the project tiles, project browsing into a board, the theme toggle, the version row and the update banner all behave as they do today"
      - "npm start, then open http://127.0.0.1:4173 — the button is enabled and the dialog opens and works"
      - "npm run electron:dev — the button is enabled and integrations behave exactly as before"
      - "npm run build && node --test --test-force-exit dist/server.test.js && node --test --test-force-exit dist/server-lan.test.js — both suites pass"
    checklist:
      - "Criterion 1 and 8: over LAN, is the button greyed, non-interactive, and disabled from the moment the page loads rather than after a fetch?"
      - "Criterion 2: does the disabled button carry a title stating integrations are available only on the machine that runs the server?"
      - "Criterion 3: over loopback, is the button enabled and does the dialog open exactly as it does today?"
      - "Criterion 4: in the Electron build, is the button enabled with no change to any integrations behaviour?"
      - "Criterion 7: over LAN, do the board, project browsing, theme toggle, version row and update banner behave exactly as they do today?"
      - "Do both server test suites still pass after every stage 2 edit?"
    self_eval:
      passed: false
      failures: []
    ```

## Divergences

1. **The root tsconfig names its test inputs one by one.** PLN-74-npqccu's Testing strategy adds a second test file, `src/server-lan.test.ts`, and assumes no build-configuration change is needed. `tsconfig.json:15`, read at `fe1e9c9`, carries an exhaustive `include` array that names `src/server.ts` and `src/server.test.ts` individually and globs only `src/lib`, `src/scripts` and `src/types`. A test file that nothing imports is therefore never compiled into `dist/`, and `node --test dist/server-lan.test.js` would find no file. Consequence: task 1.3 was added to register it, and task 1.4 depends on that registration.

2. **The public tsconfig names every browser module.** PLN-74-npqccu's Design — Client contract states that the new module "needs no script tag and no bundler change", which is correct — `tools/bundle-public.mjs` bundles the import graph from `home.ts` and holds no per-file list. `src/public/tsconfig.json:13`, read at `fe1e9c9`, additionally names each browser module explicitly, including both existing `lib/` files. tsc would still type-check the new module through `home.ts`'s import, so nothing breaks if it is omitted, but the array would no longer be exhaustive. Consequence: task 2.1 adds `lib/integrations-access.ts` to that array. It changes no build output.

Every other file the plan cites — `src/server.ts`, `src/server.test.ts`, `src/public/index.html`, `src/public/home.ts` and `src/public/styles.css` — matched the plan's stated line anchors and content when read at `fe1e9c9`.

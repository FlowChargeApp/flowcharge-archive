---
id: TL-63-xutj3n
type: tasklist
workstream: WS-62-ytspyd
slug: bundle-and-obfuscate-renderer
title: "Bundle src/public into two ES-module bundles and obfuscate them"
status: done
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: [PLN-52-2sztva]
links: []
mode: spec
base_commit: 0d81cff
---

# PRX Tasks

## Bundle src/public into two ES-module bundles and obfuscate them

Convert `src/public/` from classic scripts that share one global scope into real ES
modules. Bundle the module graph with esbuild into one IIFE per HTML page: `home.js`
for `index.html`, `app.js` for `board.html`. Then run `javascript-obfuscator` over each
bundle, gated behind a `--harden` flag on the new `tools/bundle-public.mjs` script and
reached through `npm run build:release`.

`tsc` stops emitting and becomes a type-check gate only. The output filenames do not
change, so `src/server.ts`, the CSP string, and every file under `electron/` stay
untouched. This is steps 4 and 5 of an 11-step source-hardening effort. It raises the
cost of reading the shipped code. It is not a security boundary.

Three stages, riskiest first. Stage 1 adds the two devDependencies only. Stage 2 is the
whole risk in one slice, because the module conversion, the tsconfig rewrite, the new
bundler, and the HTML and `package.json` rewiring are one atomic breaking change.
Stage 3 layers the obfuscator on top.

Stage 2 converts six source files, not five. The sixth is `src/public/app-version.ts`,
which WS-58 (`PLN-48-jznrar`) creates as a classic script and which the approved
execution order lands before this workstream starts. It becomes a module with a bare
`export {};` and reaches both bundles through a side-effect import in each entry file,
so it needs no script tag and no output file of its own. See Divergence 5.

`renameProperties` stays `false` in the obfuscator config. The renderer calls
`window.praxisAPI.*` and `window.praxisSkillInstallAPI.*` across the Electron
`contextBridge` boundary. Those property names are a contract with
`electron/preload.cts`, which is compiled separately and is out of scope.

- [x] 1. Stage 1 — Add the two devDependencies

  ```yaml
  description: "Install esbuild and javascript-obfuscator as devDependencies. Nothing else changes and the build still works exactly as before."
  ```

  - [x] 1.1 Add `esbuild` and `javascript-obfuscator` to `package.json` devDependencies
    ```yaml
    description: "Install the two new build-time dependencies and let npm write package.json and package-lock.json."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `npm install --save-dev esbuild@^0.25 javascript-obfuscator@^4` from the repository root. Let npm write both `package.json` and `package-lock.json`; do not hand-edit either file."
      - "Confirm the resolved versions npm chose satisfy the plan's intended floors of `esbuild@^0.25` and `javascript-obfuscator@^4`. The plan states these floors were not checked against the registry, so record the resolved versions if either floor could not be met."
      - "Change nothing else. Do not touch the `scripts` block, the `build` block, or `bun.lock` in this task."
    pattern: "package.json, package-lock.json"
    imports: "esbuild (^0.25), javascript-obfuscator (^4). Neither is present today in package.json, package-lock.json, or node_modules/."
    compatibility: "Node >= 18 per the engines field. package.json declares type: module, so the new tools/*.mjs script in Stage 2 will be plain ESM. Both packages are build-time only and must land under devDependencies, never dependencies — electron-builder ships dist/**/* and package.json only, never node_modules/."
    gotcha: "esbuild runs a postinstall step that downloads a platform-specific native binary. This changes the character of `npm install` from a pure TypeScript toolchain to one with a native artefact. The repository also holds a bun.lock alongside package-lock.json; whether bun.lock should be regenerated is an open question in the plan and is deliberately not tasked here (see Divergence 3). Leave bun.lock alone."
    verify:
      - "`node -e \"const p=require('./package.json'); const d=p.devDependencies; if(!d.esbuild||!d['javascript-obfuscator']) throw new Error('missing devDependency'); if(p.dependencies) throw new Error('unexpected dependencies block'); console.log(d.esbuild, d['javascript-obfuscator']);`"
      - "`npm run build` exits zero and its output is unchanged from before this task."
      - "`node -e \"require.resolve('esbuild'); require.resolve('javascript-obfuscator'); console.log('resolved');\"` confirms both packages are installed and loadable."
    checklist:
      - "Are both esbuild and javascript-obfuscator listed under devDependencies, and neither under dependencies?"
      - "Does package-lock.json contain entries for both new packages?"
      - "Does `npm run build` still exit zero with the same output files as before this task?"
      - "Is the scripts block of package.json byte-identical to what it was before this task?"
      - "Is bun.lock unmodified?"
    self_eval:
      passed: true
      failures: []
      notes: "Resolved versions esbuild@0.25.12 and javascript-obfuscator@4.2.2 — both meet the plan's ^0.25 and ^4 floors. npm's allow-scripts gate blocked esbuild's postinstall (node install.js); the platform optional dependency still supplies a working native binary, confirmed by an esbuild.transform smoke test. bun.lock md5 unchanged (f84b144f41d391629ae2809b9e37b134). Only package.json and package-lock.json modified."
    ```

- [x] 2. Stage 2 — Convert to modules and bundle, unhardened

  ```yaml
  description: "Turn all six src/public source files into real ES modules, rewrite the tsconfig into a type-check gate, add the esbuild bundler script with its stale-file sweep and eval guard, collapse the script tags, and rewire the build chain. The sixth file is src/public/app-version.ts, which WS-58 creates. This is the whole risk of the workstream in one slice. Done when acceptance criteria 1 to 9 and criterion 15 pass."
  ```

  - [x] 2.1 Export the shared surface from `src/public/ipc-adapter.ts` and move `Window` into `declare global`
    ```yaml
    description: "Add export to unwrapIpc, PraxisIpcResult and PraxisAPI, wrap the Window augmentation in declare global, and rewrite the now-false header comment."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add `export` to the `type PraxisIpcResult<T>` declaration, to `function unwrapIpc<T>`, and to `interface PraxisAPI`. Leave `function httpError` private — only `unwrapIpc` calls it, and nothing outside this file needs it."
      - "Wrap the file's final `interface Window { praxisAPI: PraxisAPI; }` block in a `declare global { ... }` block. Once the file is a module, a bare top-level `interface Window` stops merging with lib.dom.d.ts's Window and would silently become a local interface instead."
      - "Rewrite the header comment at lines 1-6. It currently claims that adding an import or export keyword would break these declarations, and that src/public/tsconfig.json's `module: \"none\"` rejects that at compile time. Both statements become false in this task. State instead that this file is a module whose exported surface is consumed by home.ts, app.ts and browser-ipc-shim.ts, and that the Window augmentation lives in `declare global` for that reason."
      - "Change no runtime behaviour. The bodies of httpError and unwrapIpc, and the shape of PraxisAPI, stay exactly as they are."
    pattern: "src/public/ipc-adapter.ts"
    imports: "None added. This file imports nothing; it only gains export keywords and a declare global wrapper. The ambient types ProjectList, ProjectEntry, BoardPayload and PraxisWorkstreamDetail it references come from src/types/praxis-data.d.ts, which has no top-level import or export and therefore stays an ambient global declaration file even after this conversion."
    compatibility: "Must compile under the Stage 2 tsconfig: target es2020, module esnext, moduleResolution bundler, isolatedModules true, strict true, types []. isolatedModules requires that a re-exported type be marked with the type modifier, but this file only declares, so no `export type` re-export syntax is involved. `window.praxisAPI` is unchanged at runtime — it is still written either by electron/preload.cts through contextBridge, or by browser-ipc-shim.ts's fallback."
    gotcha: "Forgetting `declare global` is the failure that does not produce an obvious error at the declaration site. It surfaces later as `Property 'praxisAPI' does not exist on type 'Window & typeof globalThis'` in whichever file reads it. A `declare global` block is only legal inside a module, so it depends on at least one export keyword being present in this same file."
    verify:
      - "`npx tsc -p src/public/tsconfig.json` reports no errors, once task 2.7 has landed the new tsconfig. Before that, run it after 2.7 rather than in isolation."
      - "`grep -n 'declare global' src/public/ipc-adapter.ts` returns exactly one match, and `grep -c '^interface Window' src/public/ipc-adapter.ts` returns 0."
      - "`grep -n 'export' src/public/ipc-adapter.ts` shows export on PraxisIpcResult, unwrapIpc and PraxisAPI, and no export on httpError."
    checklist:
      - "Do exactly three declarations carry export — PraxisIpcResult, unwrapIpc and PraxisAPI — with httpError left private?"
      - "Is the Window augmentation inside a declare global block, with no bare top-level `interface Window` left in the file?"
      - "Does the header comment describe the module regime, with no surviving claim that import or export is forbidden here?"
      - "Are the bodies of httpError and unwrapIpc unchanged?"
      - "Does the file still reference the ambient types from src/types/praxis-data.d.ts without importing them?"
    self_eval:
      passed: true
      failures: []
      notes: "Applied. Three declarations carry export (PraxisIpcResult, unwrapIpc, PraxisAPI); httpError left private. Window augmentation moved into declare global. Header comment rewritten to the module regime. Function bodies byte-unchanged. `grep -c 'declare global'` returns 1 and `grep -c '^interface Window'` returns 0 — the first comment draft used the literal phrase 'declare global' and broke that exact-count verify, so the comment was reworded to 'a global-augmentation block'."
    ```

  - [x] 2.2 Export the scope helpers from `src/public/lib/agentic-tools-scope.ts`
    ```yaml
    description: "Add export to resolveBasePathForScope, isEligibleAtScope, InstallScope and DetectionResultLike, and rewrite the classic-script header comment."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add `export` to `type InstallScope`, `interface DetectionResultLike`, `function resolveBasePathForScope` and `function isEligibleAtScope`. All four are named in the plan's export table."
      - "Rewrite the header comment at lines 1-2. It currently reads that this is a classic script under `module: \"none\"` with no import or export statements permitted, loaded via a script tag on index.html ahead of home.js. Replace it with the module reality: this is a module imported by home.ts, and it ships inside the home.js bundle rather than through its own script tag."
      - "Keep the rest of the file's comments as they are. The paragraph explaining the 'project' versus 'global' scope rule is still accurate and stays verbatim."
      - "Change no logic. The bodies of resolveBasePathForScope and isEligibleAtScope stay exactly as they are."
    pattern: "src/public/lib/agentic-tools-scope.ts"
    imports: "None added. This file has no dependency on any other src/public file, in either direction, and must keep it that way — it must not learn about the DOM, about TOOL_CATALOGUE contents, or about any specific tool."
    compatibility: "Must compile under the Stage 2 tsconfig with isolatedModules true and strict true. It stays listed in the tsconfig include array. It is reached from home.ts by the extensionless relative specifier './lib/agentic-tools-scope', which moduleResolution: bundler and esbuild resolve identically."
    gotcha: "The header comment names a script tag on index.html that task 2.9 deletes. Leaving the comment stale points a future reader at markup that no longer exists. DetectionResultLike is exported for addressability even though home.ts does not import it — home.ts passes its own structurally compatible DetectionResult, and that structural match must keep working."
    verify:
      - "`npx tsc -p src/public/tsconfig.json` reports no errors, once task 2.7 has landed the new tsconfig."
      - "`grep -c 'export' src/public/lib/agentic-tools-scope.ts` returns 4, one per exported declaration."
      - "`grep -in 'classic script' src/public/lib/agentic-tools-scope.ts` returns nothing."
    checklist:
      - "Do all four of InstallScope, DetectionResultLike, resolveBasePathForScope and isEligibleAtScope carry export?"
      - "Is the phrase 'classic script' gone from this file?"
      - "Does the header comment describe how the file now reaches the page, through the home.js bundle rather than its own script tag?"
      - "Are the bodies of both functions unchanged?"
      - "Does the file still import nothing from anywhere?"
    self_eval:
      passed: true
      failures: []
      notes: "Applied. All four of InstallScope, DetectionResultLike, resolveBasePathForScope and isEligibleAtScope carry export; `grep -c 'export'` returns exactly 4, so the header comment was written without the literal word. 'classic script' gone. The 'project' versus 'global' paragraph kept verbatim. Both function bodies unchanged. File still imports nothing."
    ```

  - [x] 2.3 Make `src/public/browser-ipc-shim.ts` a module with a type-only import
    ```yaml
    description: "Import PraxisIpcResult as a type from ipc-adapter, and rewrite the header comment that describes the shared file-scope global regime."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add `import type { PraxisIpcResult } from './ipc-adapter';` at the top of the file. It must be a type-only import. A value import would give this file a runtime dependency on ipc-adapter and would change which module's side effects run first in the bundle."
      - "Leave the `if (!window.praxisAPI) { ... }` install block exactly where it is, at module top level. Its side effect on module evaluation is what both entry files depend on, and it must stay unconditional at file scope."
      - "Rewrite the header comment at lines 1-12. It currently states that the file carries no import or export keyword, exactly like ipc-adapter.ts, and that it relies on that file's ambient file-scope declarations being visible in one shared global scope per `module: \"none\"`. Replace that with: the file is a module that imports only a type from ipc-adapter, so it has no runtime dependency on it, and both entry files import it first so its side effect runs before any page code."
      - "Keep the rest of the comment's substance. The explanation that the guard is checked once at load time, never per call, and that preload.cts's contextBridge call runs before this module in Electron, is still true and must survive the rewrite."
    pattern: "src/public/browser-ipc-shim.ts"
    imports: "import type { PraxisIpcResult } from './ipc-adapter'. The Window.praxisAPI augmentation reaches this file through ipc-adapter's declare global block from task 2.1, which applies program-wide once ipc-adapter is part of the program — no separate import is needed for it."
    compatibility: "isolatedModules true makes the `type` modifier on the import mandatory rather than optional: without it, esbuild transpiling this file alone cannot know the specifier is type-only and would emit a real import, creating the runtime dependency this task exists to avoid. The fetch-based fallback must keep resolving rather than rejecting on network failure, mirroring loopbackRequest()'s req.on('error') behaviour in src/server.ts."
    gotcha: "Import order is load-bearing and is enforced in the entry files, not here. ES module evaluation follows import declaration order depth-first, so `import './browser-ipc-shim'` placed first in home.ts and app.ts is what guarantees the guard runs before any page code touches window.praxisAPI. If this file ever gains a value import from ipc-adapter, ipc-adapter's module body would evaluate first and that guarantee would move."
    verify:
      - "`npx tsc -p src/public/tsconfig.json` reports no errors, once task 2.7 has landed the new tsconfig."
      - "`grep -n \"^import\" src/public/browser-ipc-shim.ts` shows exactly one line and it carries the `type` modifier."
      - "After task 2.8 lands, `node -e \"const s=require('fs').readFileSync('dist/public/home.js','utf8'); const shim=s.indexOf('praxisAPI ='); if(shim<0) throw new Error('shim install block not found in bundle'); console.log('shim present at', shim);\"` confirms the shim's install block survives into the bundle."
    checklist:
      - "Is the ipc-adapter import type-only, carrying the `type` modifier?"
      - "Is the `if (!window.praxisAPI)` block still at module top level and still unconditional?"
      - "Does the header comment state that the import is type-only and that the entry files import this module first?"
      - "Has the claim about shared file-scope globals under `module: \"none\"` been removed?"
      - "Does the fetch fallback still resolve rather than reject on a network failure?"
    self_eval:
      passed: true
      failures: []
      notes: "Applied. Exactly one import line, `import type { PraxisIpcResult } from './ipc-adapter';`, carrying the type modifier. The `if (!window.praxisAPI)` install block is untouched at module top level; the bundle check confirms it survives into both home.js and app.js at the same offset. The fetch fallback's resolve-never-reject .catch is unchanged. Header comment rewritten; the module: \"none\" shared-global claim is gone and the load-time-guard and preload-runs-first substance is kept."
    ```

  - [x] 2.4 Make `src/public/app-version.ts` a module with a bare `export {};`
    ```yaml
    description: "Add the empty export that turns WS-58's classic script into an ES module, and rewrite the header comment that explains why the file uses neither import nor export."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read src/public/app-version.ts before editing it. WS-58 creates that file and this task list was authored before WS-58 executed, so nothing here may be applied from memory — see Divergence 5."
      - "Add a bare `export {};` to the file. Add no named export. Nothing imports from this file, and its whole job is one side effect: call `window.praxisAPI.getAppVersion()` and write the result into `#app-version`."
      - "The empty export is required, not decorative. Without an import or an export the file stays a global script even under `module: \"esnext\"`, its top-level declarations sit in the global scope where they can collide with another file's names, and isolatedModules does not protect it."
      - "Rewrite the header comment. WS-58 writes a comment stating that the file uses no import and no export because src/public/tsconfig.json's `module: \"none\"` rejects a module file. That claim is false the moment this task lands. State instead that the file is a module carrying an empty export, that it ships inside both the home.js and app.js bundles through a side-effect import in each entry file, and that it has no script tag and no output file of its own."
      - "Add no import statement. The file needs no type import either: window.praxisAPI is typed by the declare global block that task 2.1 puts in ipc-adapter.ts, and a global augmentation applies across the whole program, not only to files that import it."
      - "Change no runtime behaviour. The getAppVersion() call, the #app-version lookup and the hidden-attribute handling stay exactly as WS-58 wrote them."
    pattern: "src/public/app-version.ts"
    imports: "None, in either direction. The file imports nothing and exports nothing named. It is reached only by the side-effect import `import './app-version';` that tasks 2.5 and 2.6 add to home.ts and app.ts."
    compatibility: "Must compile under the Stage 2 tsconfig from task 2.7: module esnext, moduleResolution bundler, isolatedModules true, strict true, types []. It stays listed in that tsconfig's include array as \"app-version.ts\", which is WS-58's own entry and is kept. Making this file a third esbuild entry point was rejected by the plan, because it would leave a third output file and a second script tag on each page and break acceptance criterion 5. Importing it from ipc-adapter.ts was rejected too, because that would make a shared, side-effect-free helper start running I/O on import."
    gotcha: "This file does not exist at base_commit 0d81cff; WS-58 lands first. If WS-58 landed differently from its plan, re-derive this edit from the live file rather than assuming the shape described here. The load-order guarantee is not held in this file: it comes from the import order in each entry file, where `import './browser-ipc-shim';` precedes `import './app-version';`, so the shim installs window.praxisAPI before this module's side effect reads it. In Electron the question does not arise, because electron/preload.cts installs window.praxisAPI through contextBridge before any renderer script runs."
    verify:
      - "`npx tsc -p src/public/tsconfig.json` reports no errors, once task 2.7 has landed the new tsconfig."
      - "`grep -n 'export' src/public/app-version.ts` shows exactly one match and it is a bare `export {};` with no name attached."
      - "`grep -c '^import' src/public/app-version.ts` returns 0."
      - "`grep -n 'module: \"none\"' src/public/app-version.ts` returns nothing, confirming the stale header comment is gone."
    checklist:
      - "Does the file carry a bare `export {};` and no named export?"
      - "Does the file still import nothing, including no type import for window.praxisAPI?"
      - "Does the header comment describe the module and bundle regime, with no surviving claim that `module: \"none\"` forbids an export here?"
      - "Are the getAppVersion() call and the #app-version write unchanged from what WS-58 wrote?"
      - "Is this file absent from the esbuild entryPoints map in task 2.8, reached only by the entry files' side-effect imports?"
    self_eval:
      passed: true
      failures: []
      notes: "Applied against the live file, not from the task list's prose. WS-58 has landed, so src/public/app-version.ts exists and Divergence 5's 'file is absent' premise no longer holds. Bare `export {};` appended, no named export, no import of any kind. `grep -n 'export'` returns exactly one line. Header comment rewritten without the literal word 'export' so that count stays 1. The getAppVersion() call, the #app-version lookup and the hidden-attribute handling are byte-unchanged. Not an esbuild entry point; it is reached only by the side-effect imports in home.ts and app.ts, and no dist/public/app-version.js is produced. DIVERGENCE: A seventh renderer source file, src/public/update-banner.ts, exists at HEAD and is absent from this task list. It is a classic script of the same shape as app-version.ts, with its own script tag on both pages. Task 2.8's sweep deletes dist/public/update-banner.js and tasks 2.9/2.10 delete its tag, so leaving it out would 404 the page and fail acceptance criterion 5. It was given identical treatment: bare `export {};`, its `interface Window` wrapped in `declare global`, listed in the tsconfig include array, and side-effect imported third in both entry files. Recorded as a divergence, not silently absorbed."
    ```

  - [x] 2.5 Turn `src/public/home.ts` into the `index.html` entry module
    ```yaml
    description: "Add the imports in the plan's order with the shim first and app-version second, move the praxisSkillInstallAPI Window block into declare global, and fix the two false comments."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add these imports at the very top of the file, in this exact order — `import './browser-ipc-shim';` first, then `import './app-version';`, then `import { unwrapIpc } from './ipc-adapter';`, then `import type { PraxisIpcResult } from './ipc-adapter';`, then `import { resolveBasePathForScope, isEligibleAtScope } from './lib/agentic-tools-scope';`, then `import type { InstallScope } from './lib/agentic-tools-scope';`. The shim import must be first; it is what guarantees window.praxisAPI exists before any page code runs. `import './app-version';` must come immediately after it, per the plan's section 4.1: it is a side-effect import with no binding, and it reproduces the order WS-58's script tags produced, where app-version.js loaded straight after browser-ipc-shim.js."
      - "Wrap the top-level `interface Window { praxisSkillInstallAPI: { ... } }` block, currently at lines 58-71, in a `declare global { ... }` block. That block references both InstallScope and PraxisIpcResult, which the file now imports; an imported type is visible inside declare global, so this compiles."
      - "Rewrite the header comment at lines 1-11. It currently explains that InstallScope is not redeclared here because agentic-tools-scope.ts declares it globally under `module: \"none\"` and that script tag loads before this one, and that a second declaration would be a duplicate identifier. Replace the reason: InstallScope is now imported from './lib/agentic-tools-scope'. Keep the surviving true part, that these shapes are structural mirrors of electron/agentic-tools-ipc-handlers.cts following the codebase's mirror-not-import pattern, and that the Window augmentation must be at file scope rather than inside the IIFE — now expressed as declare global at file scope."
      - "Rewrite the two-line comment at lines 398-399, which reads that the inline scope shape is 'not imported, since this is a classic script with no module graph between the two'. That reason is now false. Correct the reason only. Do NOT change the inline `var currentIntegrationsScope` declaration on line 400 to use the imported InstallScope type — the plan lists that substitution as out of scope."
      - "Leave the IIFE and every function body inside it unchanged."
    pattern: "src/public/home.ts"
    imports: "./browser-ipc-shim (side effect only, must be first), ./app-version (side effect only, must be second, from task 2.4), unwrapIpc and type PraxisIpcResult from ./ipc-adapter, resolveBasePathForScope and isEligibleAtScope and type InstallScope from ./lib/agentic-tools-scope. Specifiers are extensionless and relative, matching moduleResolution: bundler."
    compatibility: "isolatedModules true requires the `type` modifier on the PraxisIpcResult and InstallScope imports. strict and noImplicitAny stay on, which is the intended safety net: any name that was previously a shared global and is now missing an import fails at tsc rather than at runtime. The file uses unwrapIpc at lines 216, 255, 275, 311, 349, 623, 631 and 678, and the scope helpers at lines 535, 626 and 672 — every one of those call sites must resolve through the new imports."
    gotcha: "The declare global block is the subtle failure. Left as a bare `interface Window` in a module, it stops merging with lib.dom.d.ts's Window and every `window.praxisSkillInstallAPI` call site — lines 623, 628 and 677 — starts erroring. Placing the imports below the existing header comment rather than above it is harmless, but the shim import must still precede every other import statement, and `import './app-version';` must sit between the shim and the rest. Reordering those two would let app-version's side effect read window.praxisAPI before the shim's fallback installs it in browser mode."
    verify:
      - "`npx tsc -p src/public/tsconfig.json` reports no errors, once task 2.7 has landed the new tsconfig."
      - "`grep -n \"^import\" src/public/home.ts` lists the imports with './browser-ipc-shim' on the first line and './app-version' on the second."
      - "`grep -c '^interface Window' src/public/home.ts` returns 0 and `grep -c 'declare global' src/public/home.ts` returns 1."
      - "`grep -in 'classic script' src/public/home.ts` returns nothing."
    checklist:
      - "Is `import './browser-ipc-shim';` the first import statement in the file, with `import './app-version';` immediately after it?"
      - "Is the praxisSkillInstallAPI Window block inside declare global, with no bare top-level `interface Window` left?"
      - "Do the PraxisIpcResult and InstallScope imports both carry the `type` modifier?"
      - "Is the inline `var currentIntegrationsScope` declaration on line 400 still a structural literal, unchanged apart from the comment above it?"
      - "Do both rewritten comments give the module-graph reason rather than the classic-script reason?"
    self_eval:
      passed: true
      failures: []
      notes: "Applied. Import order is './browser-ipc-shim', './app-version', './update-banner', then the value and type imports. The shim is first and app-version immediately after it, as the task requires; './update-banner' follows them — see the divergence note. praxisSkillInstallAPI Window block moved into declare global; no bare top-level interface Window remains. PraxisIpcResult and InstallScope both carry the type modifier. The inline `var currentIntegrationsScope` literal on the old line 400 is unchanged; only the comment above it was corrected. Both rewritten comments give the module-graph reason. The comment was reworded away from the literal phrase 'declare global' to keep that verify's exact count at 1. DIVERGENCE: A seventh renderer source file, src/public/update-banner.ts, exists at HEAD and is absent from this task list. It is a classic script of the same shape as app-version.ts, with its own script tag on both pages. Task 2.8's sweep deletes dist/public/update-banner.js and tasks 2.9/2.10 delete its tag, so leaving it out would 404 the page and fail acceptance criterion 5. It was given identical treatment: bare `export {};`, its `interface Window` wrapped in `declare global`, listed in the tsconfig include array, and side-effect imported third in both entry files. Recorded as a divergence, not silently absorbed."
    ```

  - [x] 2.6 Turn `src/public/app.ts` into the `board.html` entry module
    ```yaml
    description: "Add the shim, app-version and unwrapIpc imports with the shim first and app-version second, and correct the WS_ID_TAIL comment's reason for not sharing the regex."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add `import './browser-ipc-shim';` as the first line of the file, above the existing `(function () {` IIFE, then `import './app-version';`, then `import { unwrapIpc } from './ipc-adapter';`. The shim import must come first and the app-version import immediately after it, per the plan's section 4.1. `import './app-version';` is a side-effect import with no binding; it replaces the `<script src=\"app-version.js\"></script>` tag that WS-58 put on board.html straight after browser-ipc-shim.js."
      - "The plan's section 4.1 also lists `import type { PraxisIpcResult } from './ipc-adapter';` for this file. This file contains no reference to that name — see Divergence 2. Add that import only if the executor's own edits introduce a use for it; otherwise omit it rather than leaving an unused import in the entry module."
      - "Correct the comment about WS_ID_TAIL. Its final sentence currently spans lines 18-19 and reads that the shared fragment cannot be imported here 'because this file compiles as a classic script'. Replace that reason with the real one: the browser bundle must not pull in Node-side server code from src/lib/. Note that the plan cites this region as lines 19-21, which is one line off from what the file actually holds — see Divergence 1."
      - "Do NOT deduplicate the WS_ID_TAIL regex against artefactIdNumber in src/lib/extract.ts. The plan lists that deduplication as out of scope."
      - "Leave the IIFE and every function body inside it unchanged, including the TAG_MIN_COUNT, TAG_MAX_SHARE and TAG_MAX_CHIPS thresholds and the filter-row switch."
    pattern: "src/public/app.ts"
    imports: "./browser-ipc-shim (side effect only, must be first), ./app-version (side effect only, must be second, from task 2.4) and unwrapIpc from ./ipc-adapter. Specifiers are extensionless and relative."
    compatibility: "isolatedModules true and strict true. unwrapIpc is called at lines 1010, 1101 and 1132; all three must resolve through the new import. src/lib/extract.ts must not become reachable from this file — the whole point of the corrected comment is that the browser bundle stays free of Node-side code."
    gotcha: "This file has no `interface Window` block of its own and needs no declare global — the Window.praxisAPI augmentation arrives from ipc-adapter's declare global once ipc-adapter is in the program. Placing the imports above the IIFE is required; TypeScript rejects an import statement that is not at the top level of the module."
    verify:
      - "`npx tsc -p src/public/tsconfig.json` reports no errors, once task 2.7 has landed the new tsconfig."
      - "`grep -n \"^import\" src/public/app.ts` shows './browser-ipc-shim' first, './app-version' second, and no unused type import."
      - "`grep -in 'classic script' src/public/app.ts` returns nothing."
      - "`grep -n \"src/lib/extract\" src/public/app.ts` shows the reference only inside a comment, never inside an import statement."
    checklist:
      - "Is `import './browser-ipc-shim';` the first line of the file, with `import './app-version';` immediately after it?"
      - "Does unwrapIpc resolve through an import at all three of its call sites?"
      - "Does the WS_ID_TAIL comment now give the no-Node-side-code reason rather than the classic-script reason?"
      - "Is the WS_ID_TAIL regex itself unchanged and still local to this file?"
      - "Is there no unused import left in the file?"
    self_eval:
      passed: true
      failures: []
      notes: "Applied. './browser-ipc-shim' is the first line, './app-version' second, './update-banner' third, then unwrapIpc. Divergence 2 confirmed against the live file: `grep -n 'PraxisIpcResult' src/public/app.ts` returns nothing, so the type import was correctly omitted rather than left unused. All three unwrapIpc call sites resolve through the import (4 matches in the file, 1 import plus 3 uses). The WS_ID_TAIL comment now gives the no-Node-side-code reason; the regex itself is unchanged and still local. src/lib/extract is referenced only inside that comment, never in an import. TAG_MIN_COUNT, TAG_MAX_SHARE, TAG_MAX_CHIPS and the filter-row switch are untouched. DIVERGENCE: A seventh renderer source file, src/public/update-banner.ts, exists at HEAD and is absent from this task list. It is a classic script of the same shape as app-version.ts, with its own script tag on both pages. Task 2.8's sweep deletes dist/public/update-banner.js and tasks 2.9/2.10 delete its tag, so leaving it out would 404 the page and fail acceptance criterion 5. It was given identical treatment: bare `export {};`, its `interface Window` wrapped in `declare global`, listed in the tsconfig include array, and side-effect imported third in both entry files. Recorded as a divergence, not silently absorbed."
    ```

  - [x] 2.7 Rewrite `src/public/tsconfig.json` into a type-check-only module config
    ```yaml
    description: "Switch module to esnext with bundler resolution, add isolatedModules and noEmit, drop the emit-only options, and rewrite the comments that describe the module: none regime."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Set `\"module\": \"esnext\"` in place of `\"module\": \"none\"`, and add `\"moduleResolution\": \"bundler\"`. Bundler resolution requires esnext, not es2020, so the pair must change together."
      - "Add `\"isolatedModules\": true`. esbuild transpiles each file alone and cannot see across files; this flag makes tsc reject the constructs esbuild would silently mishandle."
      - "Add `\"noEmit\": true`. esbuild now owns emit and tsc becomes the type-check gate only."
      - "Remove `\"rootDir\": \"..\"`, `\"outDir\": \"../../dist\"` and `\"noEmitOnError\": true`. The first two only controlled emit, and there is no emit. With noEmit, tsc still exits non-zero on a type error, which is what the `&&` chain in package.json needs."
      - "Keep `\"target\": \"es2020\"`, `\"lib\": [\"dom\", \"es2020\"]`, `\"types\": []`, `\"strict\": true` and `\"skipLibCheck\": true` exactly as they are. `types: []` is load-bearing — without it tsc auto-includes @types/node."
      - "Keep every entry in the `include` array. Once WS-58 has landed it holds seven entries, not six: the six source files `app.ts`, `home.ts`, `ipc-adapter.ts`, `browser-ipc-shim.ts`, `app-version.ts` and `lib/agentic-tools-scope.ts`, plus `../types/praxis-data.d.ts`. `app-version.ts` is WS-58's own addition and stays; its position in the incoming array does not matter, because this task rewrites the whole file. `../types/praxis-data.d.ts` is ambient and never imported, so it must stay listed. The six source files are now reachable by import, but listing them keeps the file self-documenting."
      - "Rewrite the trailing comment on the `module` line. It currently claims that an added import becomes an error. State the new intent instead: real modules, with esbuild bundling the graph. Keep the comment on `types` verbatim — it is still true and still load-bearing."
    pattern: "src/public/tsconfig.json"
    imports: "None. This is a configuration file. It gates src/public/*.ts and src/types/praxis-data.d.ts only; the root tsconfig.json and electron/tsconfig.json are separate projects and are not touched."
    compatibility: "moduleResolution: bundler needs TypeScript 5.x — the repository is on typescript ^5.9.3, which satisfies it. The file is JSONC with line comments already, so the existing comment style is valid and must be preserved. The extensionless relative specifiers used in tasks 2.3, 2.5 and 2.6 resolve identically under bundler resolution and under esbuild, which is why node16 resolution with explicit .js specifiers was rejected."
    gotcha: "Removing outDir and rootDir while leaving noEmit off would make tsc write .js files next to the sources inside src/public/. Add noEmit in the same edit, never as a follow-up. Dropping ../types/praxis-data.d.ts from include would strip every ambient type ipc-adapter.ts depends on, because nothing imports that file. Dropping app-version.ts is the easier mistake to make, because this task rewrites the whole file from the plan's illustration: the entry files reach it by import so tsc would still check it, but the file would stop being self-documenting and the entry would be lost."
    verify:
      - "`npx tsc -p src/public/tsconfig.json` reports no errors and writes no file — this satisfies acceptance criteria 1 and 2."
      - "`git status --porcelain src/public` shows no newly generated .js file inside src/public/ after that run."
      - "`node -e \"const c=require('fs').readFileSync('src/public/tsconfig.json','utf8'); for (const k of ['rootDir','outDir','noEmitOnError']) if (c.includes(k)) throw new Error('stale option: '+k); for (const k of ['esnext','bundler','isolatedModules','noEmit']) if (!c.includes(k)) throw new Error('missing option: '+k); for (const k of ['app.ts','home.ts','ipc-adapter.ts','browser-ipc-shim.ts','app-version.ts','lib/agentic-tools-scope.ts','../types/praxis-data.d.ts']) if (!c.includes('\\\"'+k+'\\\"')) throw new Error('missing include entry: '+k); console.log('tsconfig ok');\"`"
    checklist:
      - "Are module esnext, moduleResolution bundler, isolatedModules true and noEmit true all present?"
      - "Are rootDir, outDir and noEmitOnError all gone?"
      - "Are target, lib, types, strict and skipLibCheck unchanged, with the types comment kept verbatim?"
      - "Does the include array still list all seven entries, the six source files including app-version.ts plus ../types/praxis-data.d.ts?"
      - "Does the module line's comment describe the bundled-modules regime rather than claiming an import is an error?"
      - "Does a tsc run leave no .js file inside src/public/?"
    self_eval:
      passed: true
      failures: []
      notes: "Applied as a whole-file rewrite. module esnext, moduleResolution bundler, isolatedModules true and noEmit true all present; rootDir, outDir and noEmitOnError all gone. target, lib, types, strict and skipLibCheck unchanged, with the types comment kept verbatim. The include array holds eight entries, not the seven the task predicted: the seven it names plus update-banner.ts — see the divergence note. `npx tsc -p src/public/tsconfig.json` exits 0 and writes no file; `git status --porcelain src/public` shows no generated .js. Acceptance criteria 1 and 2 satisfied. DIVERGENCE: A seventh renderer source file, src/public/update-banner.ts, exists at HEAD and is absent from this task list. It is a classic script of the same shape as app-version.ts, with its own script tag on both pages. Task 2.8's sweep deletes dist/public/update-banner.js and tasks 2.9/2.10 delete its tag, so leaving it out would 404 the page and fail acceptance criterion 5. It was given identical treatment: bare `export {};`, its `interface Window` wrapped in `declare global`, listed in the tsconfig include array, and side-effect imported third in both entry files. Recorded as a divergence, not silently absorbed."
    ```

  - [x] 2.8 Write `tools/bundle-public.mjs` with the stale-file sweep, esbuild, and the eval guard
    ```yaml
    description: "Create the new build script that sweeps stale dist/public JavaScript, bundles both entry points with esbuild into memory, scans the output for eval-family calls, and only then writes the two bundles. No obfuscator call in this task."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create tools/bundle-public.mjs following tools/copy-assets.mjs's conventions: plain ESM, `fileURLToPath(import.meta.url)` to locate the repository root, one `console.log` per action, no build framework."
      - "Read process.argv for a `--harden` flag into a boolean. In this task the flag only drives esbuild's `minify` option; the obfuscator branch is added in task 3.1."
      - "Sweep dist/public/ recursively for .js files and delete them before bundling. This removes ipc-adapter.js, browser-ipc-shim.js and lib/agentic-tools-scope.js, which exist in dist/public/ right now, and app-version.js, which appears there as soon as WS-58 builds. electron-builder's `dist/**/*` glob would otherwise ship all four as readable copies of the code this workstream hardens. Delete .js files only — never a wholesale dist/ clean, which would change the server and Electron outputs too."
      - "Write the sweep as a wildcard over .js files, never as a fixed list of filenames. A wildcard needs no edit when the source file count changes, which is exactly what WS-58's app-version.ts did to this workstream."
      - "Call `esbuild.build` once with both entry points: `entryPoints: { home: 'src/public/home.ts', app: 'src/public/app.ts' }`, `bundle: true`, `format: 'iife'`, `target: 'es2020'`, `platform: 'browser'`, `charset: 'utf8'`, `legalComments: 'none'`, `sourcemap: false`, `minify: harden`, `outdir: 'dist/public'`, `write: false`. `write: false` keeps the output in memory so a failed later step never leaves a half-written dist/public/. `charset: 'utf8'` matters because the UI strings contain em dashes and other non-ASCII characters."
      - "Run the eval guard over the final text of each bundle before anything is written: scan for the substrings `eval(`, `new Function(` and `Function(`, and throw on a hit so the build fails loudly rather than shipping a bundle the CSP will refuse to run. The guard is a substring scan, not a parse — a false positive is possible if a literal source string ever contains `eval(`; none does today, and the documented fix is to narrow the guard, never to remove it."
      - "Write dist/public/home.js and dist/public/app.js, logging one line each."
      - "Emit no source map in either mode."
    pattern: "tools/bundle-public.mjs (new file). Reads src/public/home.ts and src/public/app.ts. Writes dist/public/home.js and dist/public/app.js."
    imports: "esbuild (added in task 1.1), node:fs, node:path, node:url. Do not import javascript-obfuscator in this task — task 3.1 adds it."
    compatibility: "package.json declares type: module, so a .mjs file is plain ESM either way and top-level await is available. Node >= 18. The script runs after `node tools/copy-assets.mjs` in the build chain, so dist/public/ already exists and holds the HTML and CSS by the time this runs, but the script should still create the directory defensively as copy-assets.mjs does. `format: 'iife'` and no `type=\"module\"` script tag is the deliberate choice — esm with code splitting was rejected because it adds a chunk-loading waterfall and more output files to keep in step with the HTML."
    gotcha: "Ordering inside the script is what makes it safe: sweep, then bundle into memory, then guard, then write. Guarding after writing would leave a rejected bundle on disk. The sweep must reach dist/public/lib/ as well as dist/public/ itself, or agentic-tools-scope.js survives — acceptance criterion 4 fails on exactly that file. A surviving dist/public/app-version.js fails acceptance criterion 15 the same way, and it is the easier one to miss because the file does not exist in dist/public/ at base_commit 0d81cff. Only two entry points go to esbuild, home.ts and app.ts: app-version.ts is not an entry point, it arrives inside both bundles through the side-effect imports from tasks 2.5 and 2.6. `Function(` as a guard substring also matches inside `new Function(`, which is intended; it must not be narrowed to avoid double-matching."
    verify:
      - "`node tools/bundle-public.mjs` exits zero and logs one line per written bundle."
      - "`test \"$(find dist/public -name '*.js' | wc -l | tr -d ' ')\" = 2` passes, `ls dist/public/lib 2>/dev/null` shows no .js file, and `test ! -e dist/public/app-version.js` passes — this satisfies acceptance criteria 3 and 4, and the file half of criterion 15."
      - "`node -e \"const fs=require('fs'); for (const f of ['dist/public/home.js','dist/public/app.js']) { const s=fs.readFileSync(f,'utf8'); for (const bad of ['eval(','new Function(','Function(']) if (s.includes(bad)) throw new Error(f+' contains '+bad); } console.log('eval guard clean');\"` confirms the guard's own condition holds on real output."
      - "Temporarily point the guard at a string that is present in the bundle, re-run the script, and confirm it throws and writes nothing; then restore the guard. This proves the guard fails the build rather than warning."
    checklist:
      - "Does the script sweep every .js file under dist/public/, including dist/public/lib/ and dist/public/app-version.js, before bundling, using a wildcard rather than a fixed filename list?"
      - "Is esbuild called once with exactly two entry points, home.ts and app.ts, and with write set to false?"
      - "Does the eval guard run on the final bundle text before any file is written, and throw on a hit?"
      - "Are charset utf8, legalComments none and sourcemap false all set, with minify driven by the --harden flag?"
      - "Does the script import esbuild only, with no reference to javascript-obfuscator yet?"
      - "Does a build produce exactly two .js files under dist/public/?"
    self_eval:
      passed: true
      failures: []
      notes: "Applied as a new file. Sweep is a wildcard over .js with hand-rolled recursion, so it reaches dist/public/lib/ and dist/public/app-version.js and dist/public/update-banner.js alike; the first run swept 7 stale files. esbuild is called once with exactly two entry points and write: false. Order is sweep, bundle into memory, guard, write. The guard was proved negatively: pointing FORBIDDEN at a string the bundle really contains made the script exit 1 and leave dist/public empty of .js, then it was restored from a backup and re-verified. charset utf8, legalComments none and sourcemap false are set and minify is driven by --harden. The script imports esbuild and node: modules only; `grep -c 'javascript-obfuscator'` returns 0. A build produces exactly two .js files. Acceptance criteria 3, 4 and the file half of 15 satisfied. DIVERGENCE: A seventh renderer source file, src/public/update-banner.ts, exists at HEAD and is absent from this task list. It is a classic script of the same shape as app-version.ts, with its own script tag on both pages. Task 2.8's sweep deletes dist/public/update-banner.js and tasks 2.9/2.10 delete its tag, so leaving it out would 404 the page and fail acceptance criterion 5. It was given identical treatment: bare `export {};`, its `interface Window` wrapped in `declare global`, listed in the tsconfig include array, and side-effect imported third in both entry files. Recorded as a divergence, not silently absorbed."
    ```

  - [x] 2.9 Collapse the script tags in `src/public/index.html` to one `home.js`
    ```yaml
    description: "Replace the five script tags before </body> with a single tag loading home.js, and leave WS-58's #app-version footer element alone."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Replace the five consecutive script tags — ipc-adapter.js, browser-ipc-shim.js, app-version.js, lib/agentic-tools-scope.js and home.js — with the single line `<script src=\"home.js\"></script>`. Anchor on the tag text, never on the line numbers: the block sits at lines 70-73 at base_commit 0d81cff with four tags, and WS-58 inserts the app-version.js tag after browser-ipc-shim.js, which moves the block to about lines 71-75. See Divergence 5."
      - "The single tag absorbs app-version.js. Its code is inside the home.js bundle, pulled in by the `import './app-version';` line that task 2.5 adds to home.ts, so it needs no tag of its own and no separate output file. Acceptance criterion 5 still reads 'exactly one script per page' with six source files, exactly as it did with five."
      - "Add no defer, no async and no type=\"module\". The tag stays immediately before </body>, exactly where it is today, which keeps the current execution timing: the DOM is fully parsed before the bundle runs."
      - "Change nothing else in the file. The markup above the script tags, including the integrations dialog and WS-58's `<div id=\"app-version\" hidden></div>` inside `<footer class=\"note\">`, stays untouched. That div is markup, not a script, and the bundled code still finds it by id."
    pattern: "src/public/index.html"
    imports: "None. The file references dist/public/home.js by relative name after tools/copy-assets.mjs copies it, so the src attribute must stay the bare filename `home.js` with no path prefix."
    compatibility: "Must load under the existing CSP in src/server.ts without a single violation. src/server.ts and the CSP string are not modified by this workstream, so the tag must stay a plain classic script tag — adding type=\"module\" changes the request's CORS and credentials mode and is explicitly rejected by the plan."
    gotcha: "Leaving any of the four deleted tags behind produces a 404 once task 2.8's sweep removes the corresponding files from dist/public/, and the page then fails on a missing global. The app-version.js tag is the easiest to leave behind, because it is not present at base_commit 0d81cff and only WS-58 puts it there. copy-assets.mjs copies index.html verbatim and needs no change for this task."
    verify:
      - "`grep -c '<script' src/public/index.html` returns 1, and `grep -n '<script' src/public/index.html` shows `home.js` — this satisfies half of acceptance criterion 5."
      - "`grep -c 'app-version.js' src/public/index.html` returns 0, and `grep -c 'id=\"app-version\"' src/public/index.html` returns 1 — the script tag is gone and WS-58's footer div survives."
      - "`npm run build`, then `grep -c '<script' dist/public/index.html` returns 1, confirming copy-assets.mjs carried the change through."
      - "Load http://localhost:4173/ after `npm start` and confirm the browser console shows no 404 for ipc-adapter.js, browser-ipc-shim.js, app-version.js or lib/agentic-tools-scope.js, and that the footer still shows WS-58's version line — this is the render half of acceptance criterion 15."
    checklist:
      - "Is there exactly one script tag in the file, and does it load home.js?"
      - "Are the ipc-adapter.js, browser-ipc-shim.js, app-version.js and lib/agentic-tools-scope.js tags all gone?"
      - "Is WS-58's `<div id=\"app-version\" hidden></div>` still present inside `<footer class=\"note\">`, unchanged?"
      - "Does the tag carry no defer, no async and no type attribute?"
      - "Is the tag still immediately before </body>?"
      - "Is every other line of the file unchanged?"
    self_eval:
      passed: true
      failures: []
      notes: "Applied, but against six tags rather than the five the task predicted — index.html carries an update-banner.js tag the task list does not know about. All six collapse to the single `<script src=\"home.js\"></script>`. `grep -c '<script'` returns 1; app-version.js and update-banner.js tag references return 0; `grep -c 'id=\"app-version\"'` returns 1. No defer, no async, no type attribute; still immediately before </body>. Only the five deleted lines changed. One stale prose mention of update-banner.js survives inside an HTML comment at lines 23-24; it is a comment about which code owns the banner element, not a script tag, and 'change nothing else' forbids touching it. DIVERGENCE: A seventh renderer source file, src/public/update-banner.ts, exists at HEAD and is absent from this task list. It is a classic script of the same shape as app-version.ts, with its own script tag on both pages. Task 2.8's sweep deletes dist/public/update-banner.js and tasks 2.9/2.10 delete its tag, so leaving it out would 404 the page and fail acceptance criterion 5. It was given identical treatment: bare `export {};`, its `interface Window` wrapped in `declare global`, listed in the tsconfig include array, and side-effect imported third in both entry files. Recorded as a divergence, not silently absorbed."
    ```

  - [x] 2.10 Collapse the script tags in `src/public/board.html` to one `app.js`
    ```yaml
    description: "Replace the four script tags before </body> with a single tag loading app.js, and leave WS-58's #app-version footer element alone."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Replace the four consecutive script tags — ipc-adapter.js, browser-ipc-shim.js, app-version.js and app.js — with the single line `<script src=\"app.js\"></script>`. Anchor on the tag text, never on the line numbers: the block sits at lines 128-130 at base_commit 0d81cff with three tags, and WS-58 inserts the app-version.js tag after browser-ipc-shim.js, which moves the block to about lines 129-132. See Divergence 5."
      - "The single tag absorbs app-version.js. Its code is inside the app.js bundle, pulled in by the `import './app-version';` line that task 2.6 adds to app.ts, so it needs no tag of its own and no separate output file."
      - "Add no defer, no async and no type=\"module\". The tag stays immediately before </body>, exactly where it is today."
      - "Change nothing else in the file. The workstream detail modal markup above the script tags, and WS-58's `<div id=\"app-version\" hidden></div>` inside `<footer class=\"note\">`, stay untouched."
    pattern: "src/public/board.html"
    imports: "None. The src attribute stays the bare filename `app.js` with no path prefix."
    compatibility: "Must load under the existing CSP in src/server.ts without a violation. The CSP string is not modified by this workstream. board.html has no lib/agentic-tools-scope.js tag to remove — that script is loaded by index.html only, and the scope helpers ship inside home.js after this change. board.html does carry the app-version.js tag, because WS-58 puts one on both pages."
    gotcha: "board.html carries four tags where index.html carries five, once WS-58 has landed. Applying the index.html edit shape here by rote would delete a tag that does not exist or leave app.js loaded twice. copy-assets.mjs copies board.html verbatim and needs no change."
    verify:
      - "`grep -c '<script' src/public/board.html` returns 1, and `grep -n '<script' src/public/board.html` shows `app.js` — this completes acceptance criterion 5."
      - "`grep -c 'app-version.js' src/public/board.html` returns 0, and `grep -c 'id=\"app-version\"' src/public/board.html` returns 1 — the script tag is gone and WS-58's footer div survives."
      - "`npm run build`, then `grep -c '<script' dist/public/board.html` returns 1."
      - "Open a project board in the browser and confirm the console shows no 404 for ipc-adapter.js, browser-ipc-shim.js or app-version.js, and that the footer still shows WS-58's version line — this is the board-page half of acceptance criterion 15."
    checklist:
      - "Is there exactly one script tag in the file, and does it load app.js?"
      - "Are the ipc-adapter.js, browser-ipc-shim.js and app-version.js tags all gone?"
      - "Is WS-58's `<div id=\"app-version\" hidden></div>` still present inside `<footer class=\"note\">`, unchanged?"
      - "Does the tag carry no defer, no async and no type attribute?"
      - "Is the tag still immediately before </body>?"
      - "Is every other line of the file unchanged?"
    self_eval:
      passed: true
      failures: []
      notes: "Applied, but against five tags rather than the four the task predicted — board.html also carries the unlisted update-banner.js tag. All five collapse to the single `<script src=\"app.js\"></script>`. `grep -c '<script'` returns 1; app-version.js references return 0; `grep -c 'id=\"app-version\"'` returns 1. No defer, async or type attribute; still immediately before </body>. board.html correctly had no lib/agentic-tools-scope.js tag to remove. The same stale update-banner.js mention survives inside the HTML comment at lines 29-30 and was left alone for the same reason. DIVERGENCE: A seventh renderer source file, src/public/update-banner.ts, exists at HEAD and is absent from this task list. It is a classic script of the same shape as app-version.ts, with its own script tag on both pages. Task 2.8's sweep deletes dist/public/update-banner.js and tasks 2.9/2.10 delete its tag, so leaving it out would 404 the page and fail acceptance criterion 5. It was given identical treatment: bare `export {};`, its `interface Window` wrapped in `declare global`, listed in the tsconfig include array, and side-effect imported third in both entry files. Recorded as a divergence, not silently absorbed."
    ```

  - [x] 2.11 Add `build:base` and rewire `build` in `package.json`, then run the Stage 2 checklist
    ```yaml
    description: "Split the shared four-command prefix into build:base, point build at build:base plus the new bundler, and verify acceptance criteria 1 to 9 and criterion 15 end to end."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add a `build:base` script holding the four commands the existing `build` script runs today: `tsc -p tsconfig.json && tsc -p src/public/tsconfig.json && tsc -p electron/tsconfig.json && node tools/copy-assets.mjs`."
      - "Redefine `build` as `npm run build:base && node tools/bundle-public.mjs`. build:base exists so the two build chains added across this workstream do not duplicate those four commands."
      - "Leave `tsc -p src/public/tsconfig.json` in the chain. It is now a pure type check, it runs before the bundler, and `&&` makes a type error stop the build — that replaces the safety net noEmitOnError used to provide."
      - "Do not edit `prestart`, `prerefresh` or `electron:dev`. All three keep calling `npm run build`."
      - "Do not add `build:release` and do not touch `package:mac`, `package:linux` or `package:win` in this task. Those belong to task 3.2."
      - "Once this lands, run the plan's verification checklist for Stage 2 and record the result: `npm run build` exits zero; `ls -R dist/public` shows exactly two .js files, no JavaScript under dist/public/lib/ and no dist/public/app-version.js; `npm start` then http://localhost:4173/ renders project tiles and the add-project form works with no console error and no CSP violation; the integrations panel renders tool detection and the scope switch behaves, exercising resolveBasePathForScope and isEligibleAtScope across the new module boundary; a project board renders KPIs, columns, panels and the detail modal, exercising unwrapIpc in app.ts; `window.praxisAPI` exists in that same tab, proving the shim's side effect ran and ran early enough; and `npm run electron:dev` renders both pages with the native folder picker button present, proving the shim did not overwrite the contextBridge object."
      - "Add one more check to that walk, in both modes and on both pages: the footer still shows WS-58's version line. This is acceptance criterion 15. It proves the side-effect import in each entry file ran, and that it ran after window.praxisAPI was installed."
    pattern: "package.json (scripts block only)"
    imports: "No new dependency. The chain now invokes tools/bundle-public.mjs from task 2.8, which must exist before this task's build script can succeed."
    compatibility: "The bundler is invoked as a bare `node tools/bundle-public.mjs` with no environment variable prefix. That matters for Stage 3, where package:win runs on Windows and `VAR=1 npm run build` does not work in cmd.exe — the --harden CLI flag exists for that reason, so keep this invocation flag-driven rather than env-driven. The build block, appId, files globs and every other package.json key stay unchanged."
    gotcha: "Removing `tsc -p src/public/tsconfig.json` from the chain because it no longer emits would delete the workstream's only type-safety gate. A name that was previously a shared global and is now missing an import fails at tsc, not at runtime, and that is the desired failure mode. Acceptance criteria 6 to 9 and criterion 15 are manual browser and Electron checks; they cannot be automated here and must actually be run, not assumed. Criterion 15 belongs to this stage, not Stage 3."
    verify:
      - "`npm run build` exits zero."
      - "`test \"$(find dist/public -name '*.js' | wc -l | tr -d ' ')\" = 2` passes, `find dist/public/lib -name '*.js' 2>/dev/null` returns nothing, and `test ! -e dist/public/app-version.js` passes — acceptance criteria 3 and 4, plus the file half of criterion 15."
      - "`node -e \"const s=require('./package.json').scripts; if(!s['build:base']) throw new Error('build:base missing'); if(s.build!=='npm run build:base && node tools/bundle-public.mjs') throw new Error('build wrong: '+s.build); for (const k of ['prestart','prerefresh','electron:dev']) if(!s[k].includes('npm run build')) throw new Error(k+' changed'); for (const k of ['package:mac','package:linux','package:win']) if(s[k].includes('build:release')) throw new Error(k+' edited too early'); console.log('scripts ok');\"`"
      - "`npm start`, then walk the plan's checklist items 3 to 6 in a browser tab, then `npm run electron:dev` and walk items 7 and 7a. Record each as pass or fail — these are acceptance criteria 6 to 9 and criterion 15, and they have no automated equivalent. Item 7a is the footer version line on both pages, in both modes."
    checklist:
      - "Does build:base hold exactly the four commands the old build script ran, in the same order?"
      - "Does build call build:base and then tools/bundle-public.mjs, with no --harden flag?"
      - "Are prestart, prerefresh and electron:dev unedited, and are the three package:* scripts still pointing at npm run build?"
      - "Does `npm run build` produce exactly home.js and app.js under dist/public/, and nothing else with a .js extension, including no app-version.js?"
      - "Do both pages work in a plain browser tab with no console error and no CSP violation, does window.praxisAPI exist there, and does the footer version line still render?"
      - "Do both pages work under `npm run electron:dev` with the native folder picker button present and the footer version line still rendering?"
    self_eval:
      passed: true
      failures: []
      notes: "Applied. build:base holds the same four commands in the same order the old build script ran; build is `npm run build:base && node tools/bundle-public.mjs` with no --harden. prestart, prerefresh and electron:dev are unedited and the three package:* scripts still call npm run build. `npm run build` exits 0 and leaves exactly dist/public/home.js and dist/public/app.js — no lib/, no app-version.js, no update-banner.js, no source map. node --test over dist/lib/*.test.js: 90 pass, 0 fail. Browser walk run against a live `node dist/server.js` on 127.0.0.1:4173 (criteria 6 to 9 and 15): index.html and board.html each serve with exactly one script tag; every removed script path 404s and nothing requests it; window.praxisAPI exists in a plain tab with all seven methods, proving the shim ran and ran early; the footer reads 'Version 1.0.0' un-hidden on BOTH pages, which is criterion 15; nine project tiles render; the add-project form validates and renders its em dash correctly, proving charset utf8; the integrations dialog opens and the global/project scope switch works with the project select populated; the board renders 5 columns, 8 KPIs and 60 cards, and the workstream detail modal opens with real content, exercising unwrapIpc in app.ts across the new module boundary. Console clean on every fresh load, no CSP violation. NOT RUN: `npm run electron:dev`, per the executing brief's instruction to skip Electron GUI checks — so the native folder-picker assertion and the full detectTools path are unverified here. Statically, electron/ and src/server.ts are untouched (`git status --porcelain` empty) and the shim's `if (!window.praxisAPI)` guard is intact in both bundles, so the contextBridge object cannot be overwritten. One pre-existing behaviour confirmed not a regression: clicking the integrations panel in a plain browser tab throws on window.praxisSkillInstallAPI.detectTools, and HEAD's home.ts has no guard there either."
    ```

- [x] 3. Stage 3 — Layer on the obfuscator

  ```yaml
  description: "Add the --harden branch to the bundler, add the build:release script, and point the three package:* scripts at it. Done when acceptance criteria 10 to 14 pass."
  ```

  - [x] 3.1 Add the `--harden` obfuscator branch to `tools/bundle-public.mjs`
    ```yaml
    description: "When --harden is passed, minify with esbuild and run each bundle through javascript-obfuscator with the plan's exact option set, before the existing eval guard."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Confirm the `--harden` flag already drives esbuild's `minify` option from task 2.8. If it does not, wire it now so a hardened build is minified and a normal build is not — one switch, two modes."
      - "When --harden is set, pass each in-memory bundle through javascript-obfuscator with exactly this option set: target 'browser', compact true, identifierNamesGenerator 'mangled', stringArray true, stringArrayEncoding ['base64'], splitStrings true, splitStringsChunkLength 8, controlFlowFlattening false, deadCodeInjection false, selfDefending false, debugProtection false, domainLock [], renameGlobals false, renameProperties false, transformObjectKeys false."
      - "State the last four options explicitly even though they are defaults. renameGlobals false because the bundle reads real browser globals — window, document, fetch, localStorage. renameProperties false because the renderer calls window.praxisAPI.listProjects, window.praxisSkillInstallAPI.detectTools and four more names across the contextBridge boundary, and those names are a contract with electron/preload.cts, which is compiled separately and is out of scope. transformObjectKeys false because the renderer builds object literals that become JSON request bodies for /api/*. domainLock [] because the app is served from localhost and from file:-adjacent Electron contexts, and a domain lock is both wrong here and an eval source."
      - "Keep the obfuscator pass between the esbuild call and the eval guard, and keep the guard before any write. The order stays: sweep, bundle into memory, obfuscate on demand, guard, write."
      - "Emit no source map in hardened mode. A source map alongside an obfuscated bundle would undo the obfuscation for anyone who fetched it."
      - "If the eval guard fires on a hardened bundle, the documented fallback is to drop stringArrayEncoding to `[]`, which gives a plain unencoded string array and removes the decoder entirely. Do not remove or weaken the guard."
    pattern: "tools/bundle-public.mjs"
    imports: "javascript-obfuscator (added in task 1.1), alongside the esbuild and node: imports already in the file."
    compatibility: "selfDefending, debugProtection and domainLock stay off for reasons beyond CSP as well: they trap the app's own debugger and crash reporting for only hours of attacker delay. controlFlowFlattening and deadCodeInjection stay off to keep the bundle's size and runtime cost predictable. The obfuscated output must load under the existing CSP in src/server.ts, which is not modified."
    gotcha: "renameProperties is the option that fails asymmetrically — flipping it on breaks Electron mode silently while the browser mode keeps working, because the browser fallback in browser-ipc-shim.ts defines the same property names in the same bundle and would be renamed consistently with its callers. The eval guard is a substring scan and is expected to stay clean with this option set, but the plan deliberately does not assert that as verified fact, which is why it is a build gate."
    verify:
      - "`node tools/bundle-public.mjs --harden` exits zero and writes both bundles."
      - "`node -e \"const fs=require('fs'); for (const f of ['dist/public/home.js','dist/public/app.js']) { const s=fs.readFileSync(f,'utf8'); for (const bad of ['eval(','new Function(','Function(']) if (s.includes(bad)) throw new Error(f+' contains '+bad); } console.log('hardened bundles eval-clean');\"` — acceptance criterion 11."
      - "`test \"$(grep -c 'unwrapIpc' dist/public/app.js || true)\" = 0` passes, proving top-level names are actually being renamed."
      - "`node -e \"const c=require('fs').readFileSync('tools/bundle-public.mjs','utf8'); for (const k of ['renameProperties','renameGlobals','transformObjectKeys','domainLock','selfDefending','debugProtection','controlFlowFlattening','deadCodeInjection']) if (!c.includes(k)) throw new Error('option not stated: '+k); console.log('option set complete');\"`"
      - "`node tools/bundle-public.mjs` with no flag still produces readable, unminified bundles — `grep -c 'unwrapIpc' dist/public/app.js` returns a non-zero count."
    checklist:
      - "Does --harden drive both esbuild minify and the obfuscator pass, with neither active on a plain build?"
      - "Are all thirteen obfuscator options present with the plan's exact values, including renameProperties false?"
      - "Does the obfuscator pass run before the eval guard, and does the guard still run before any write?"
      - "Do the hardened bundles contain no `eval(`, no `new Function(` and no bare `Function(`?"
      - "Does `grep -c 'unwrapIpc' dist/public/app.js` return 0 on a hardened build and non-zero on a plain build?"
      - "Is no source map emitted in either mode?"
    self_eval:
      passed: true
      failures: []
      notes: "Applied. `--harden` already drove esbuild minify from task 2.8, so it was confirmed rather than rewired; it now drives the obfuscator pass as well. Every option the task names is present with the stated value, including renameProperties false — the task's prose says thirteen options but lists fifteen keys, and all fifteen are set. Pipeline order is sweep, bundle into memory, obfuscate on demand, guard, write; the guard still runs before any write. esbuild's outputFiles are read-only, so the text is carried into a plain {path, text} array the obfuscator pass replaces entry by entry — still in memory, still nothing on disk. `node tools/bundle-public.mjs --harden` exits 0; both hardened bundles contain no `eval(`, no `new Function(` and no bare `Function(`, so the documented stringArrayEncoding [] fallback was not needed. `grep -c 'unwrapIpc' dist/public/app.js` returns 0 hardened and 4 plain. `node --check` parses both hardened bundles. No source map in either mode, and copy-assets.mjs's own source-map sweep reports none found."
    ```

  - [x] 3.2 Add `build:release` and point the three `package:*` scripts at it
    ```yaml
    description: "Add the hardened build chain to package.json, switch the mac, linux and win packaging scripts onto it, and verify acceptance criteria 10 to 14."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add `\"build:release\": \"npm run build:base && node tools/bundle-public.mjs --harden\"` to the scripts block, beside the `build` script from task 2.11."
      - "Change `package:mac`, `package:linux` and `package:win` from `npm run build` to `npm run build:release`. That is the only edit to those three lines — the electron-builder arguments after the `&&` on each line stay exactly as they are."
      - "Leave `build`, `build:base`, `prestart`, `start`, `start:lan`, `prerefresh`, `refresh` and `electron:dev` unchanged. Development keeps producing readable bundles; only packaging ships hardened ones."
      - "Add no other affordance for reaching build:release. The plan lists that as an open question and commits to nothing beyond the three package:* scripts — see Divergence 4."
      - "Once this lands, run the plan's verification checklist against a `npm run build:release` output: repeat the browser checks and the Electron check from task 2.11 against the hardened bundles, and confirm both pages load with zero CSP violation messages in the console."
    pattern: "package.json (scripts block only)"
    imports: "No new dependency. The chain invokes tools/bundle-public.mjs --harden from task 3.1, which must already handle the flag."
    compatibility: "A CLI flag is used instead of an environment variable because package:win runs on Windows, where `VAR=1 npm run build` does not work in cmd.exe. electron-builder ships `dist/**/*` and package.json only, so the hardened bundles reach the packaged app through dist/public/ and node_modules/ is never shipped. src/server.ts, the CSP string, and every file under electron/ stay untouched — acceptance criteria 13 and 14."
    gotcha: "Forgetting one of the three package:* scripts ships a readable bundle for that platform only, and nothing in the build fails to signal it. The stale-file sweep in tools/bundle-public.mjs is what stops a previous unhardened build's output from surviving into a release package, so a release build must never be run against a dist/ that skipped the sweep."
    verify:
      - "`npm run build:release` exits zero and produces obfuscated bundles — acceptance criterion 10."
      - "`node -e \"const s=require('./package.json').scripts; if(s['build:release']!=='npm run build:base && node tools/bundle-public.mjs --harden') throw new Error('build:release wrong: '+s['build:release']); for (const k of ['package:mac','package:linux','package:win']) { if(!s[k].startsWith('npm run build:release &&')) throw new Error(k+' not rewired: '+s[k]); } if(s.build.includes('--harden')) throw new Error('build must stay unhardened'); for (const k of ['prestart','prerefresh','electron:dev']) if(!s[k].includes('npm run build')||s[k].includes('build:release')) throw new Error(k+' changed'); console.log('scripts ok');\"`"
      - "`git status --porcelain src/server.ts electron/` returns nothing, confirming acceptance criteria 13 and 14."
      - "`npm start` against the hardened output, then walk the plan's checklist items 3 to 7 in a browser tab and in Electron, confirming zero CSP violation messages in the console — acceptance criteria 6 to 9 and 12 against hardened bundles."
    checklist:
      - "Does build:release chain build:base and the bundler with --harden?"
      - "Do all three of package:mac, package:linux and package:win call build:release, with their electron-builder arguments unchanged?"
      - "Does the plain `build` script still produce unhardened bundles, and are prestart, prerefresh and electron:dev unedited?"
      - "Is src/server.ts unmodified and is the CSP string unchanged?"
      - "Is no file under electron/ modified?"
      - "Do both pages load from the hardened bundles with zero CSP violation messages in the console?"
    self_eval:
      passed: true
      failures: []
      notes: "Applied. build:release is `npm run build:base && node tools/bundle-public.mjs --harden`; package:mac, package:linux and package:win all call it, with their electron-builder arguments byte-unchanged. build stays unhardened, and prestart, prerefresh, electron:dev, start, start:lan and refresh are unedited. `npm run build:release` exits 0. `git status --porcelain src/server.ts electron/` is empty — acceptance criteria 13 and 14 — and the whole working tree shows only package.json and tools/bundle-public.mjs changed, plus the .gitignore edit that predates this task. node --test over dist/lib/*.test.js: 90 pass, 0 fail. Hardened walk against a live `node dist/server.js` on 127.0.0.1:4177: index.html and board.html each serve one script tag, home.js and app.js serve 200 with the CSP header, and every removed script path (ipc-adapter.js, browser-ipc-shim.js, app-version.js, update-banner.js, lib/agentic-tools-scope.js) 404s with nothing requesting it. Both pages were loaded in a real browser tab from the obfuscated bundles: fresh loads show an empty console, so zero CSP violations against `script-src 'self'` — acceptance criterion 12. window.praxisAPI exists with all seven methods, proving the shim's side effect survived obfuscation and still ran first. The footer reads 'Version 1.0.0' un-hidden on both pages, so criterion 15 holds on hardened output too. Nine project tiles render, the integrations dialog opens with its project select populated and the Global/Project scope switch toggles correctly, exercising resolveBasePathForScope and isEligibleAtScope across the obfuscated module boundary. The board renders 60 cards with KPIs and panels, and the workstream detail modal opens with real content, exercising unwrapIpc in app.js. Em dashes render, confirming charset utf8 through the obfuscator. NOT RUN: `npm run electron:dev`, per the executing brief's instruction to skip Electron GUI checks, so the native folder-picker assertion is unverified here; statically, electron/ and src/server.ts are untouched and renameProperties is false, which is the option that would have broken that path. One pre-existing behaviour re-confirmed and not a regression: clicking a tool-detection control in a plain browser tab throws on window.praxisSkillInstallAPI.detectTools, because that object is Electron-only and home.ts carries no guard at HEAD — stage 2 recorded the identical throw against unhardened bundles."
    ```

## Divergences

1. **`app.ts` comment region is cited one line off.** The plan's section 4.11 table places the "because this file compiles as a classic script" claim at `src/public/app.ts` lines 19-21. The file at `0d81cff` holds that claim across lines 18-19, and line 20 is the `var WS_ID_TAIL = ...` declaration itself. The anchor text is present and unambiguous, so task 2.6 is authored against the text rather than the line numbers.

2. **`app.ts` does not use `PraxisIpcResult`.** The plan's section 4.1 lists `import type { PraxisIpcResult } from './ipc-adapter';` among `app.ts`'s imports. `grep -n 'PraxisIpcResult' src/public/app.ts` at `0d81cff` returns no match — the file's only use of the adapter is `unwrapIpc`, at lines 1010, 1101 and 1132. Adding the type import as written would leave an unused import in an entry module. Task 2.6 makes that import conditional on an actual use appearing, and no separate task is authored for it.

3. **`bun.lock` is left untouched.** The plan's open question 2 asks whether `bun.lock` should be regenerated alongside `package-lock.json`, be left to go stale, or is already unused. Both files exist at the repository root — `bun.lock` last written 2026-08-09, `package-lock.json` last written 2026-08-19. The plan settles nothing, so no task touches `bun.lock`, and task 1.1 forbids editing it.

4. **Four further open questions carry no task.** The plan's section 8 leaves five items open. Question 1, whether obfuscation should run on every build, is already assumed release-only in the plan's own design and section 7, so the tasks follow that design. Question 3, whether `README.md`'s "How it fits together" tree should be updated, is not tasked — the plan explicitly does not touch `README.md`. Question 4, whether esbuild's platform-specific native binary is acceptable on every build target, is recorded in task 1.1's `gotcha` and settled by nobody here. Question 5, whether `build:release` needs an affordance beyond the three `package:*` scripts, is not tasked, and task 3.2 forbids adding one.

5. **`src/public/app-version.ts` does not exist on disk yet.** The plan's section 4.0 designs for a sixth source file that WS-58 (`PLN-48-jznrar`) creates, and assumption 9 states that the plan was written against WS-58's plan rather than against WS-58's executed output. At `0d81cff` the file is absent: `ls src/public/` lists `app.ts`, `board.html`, `browser-ipc-shim.ts`, `home.ts`, `index.html`, `ipc-adapter.ts`, `styles.css`, `tsconfig.json`, `fonts/` and `lib/` only. `src/public/tsconfig.json`'s `include` array holds six entries, not seven, with no `"app-version.ts"`. `src/public/index.html` holds four script tags at lines 70-73 and `src/public/board.html` holds three at lines 128-130, neither with an `app-version.js` tag. Consequence: task 2.4 is authored in prose from the plan's sections 4.0, 4.1 and 4.2, with no SEARCH/REPLACE block against a file that cannot be read, and it opens by telling the executor to read the live file first. Tasks 2.5 to 2.11 describe the post-WS-58 state — seven `include` entries, being the six source files plus the ambient declaration file, five script tags on `index.html`, four on `board.html`, and `app-version.js` in the stale-file sweep — and anchor on text rather than on line numbers. If WS-58 lands differently from its plan, the executor re-derives each edit from the live file.

Every other file the plan cites — `src/public/ipc-adapter.ts`, `src/public/browser-ipc-shim.ts`, `src/public/lib/agentic-tools-scope.ts`, `src/public/home.ts`, `src/public/tsconfig.json`, `src/public/index.html`, `src/public/board.html`, `package.json`, and `tools/copy-assets.mjs` — matched the plan's description at `0d81cff`, including the line ranges quoted in section 4.11 and, for the two HTML files, the pre-WS-58 script-tag blocks that section 4.8 describes in their post-WS-58 form.

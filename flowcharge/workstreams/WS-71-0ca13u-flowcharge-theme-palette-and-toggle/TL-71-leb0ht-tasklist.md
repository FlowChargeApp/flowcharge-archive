---
id: TL-71-leb0ht
type: tasklist
workstream: WS-71-0ca13u
slug: flowcharge-theme-palette-and-toggle
title: "FlowCharge palette and three-state theme toggle"
status: done
created: 2026-08-28
updated: 2026-08-28
author: Anthony Koukoullis
depends_on: [PLN-60-f7jh0n]
links: []
mode: spec
base_commit: 406ffff
---

# PRX Tasks

## FlowCharge palette and theme toggle

This list implements PLN-60-f7jh0n in the plan's own five phases.

Phase 1 builds the theme mechanism on today's colours. It adds `src/public/theme.ts`
and `src/public/theme-init.ts`, a third bundle entry point, and it cuts
`src/public/styles.css` from four palette blocks to two. Phase 2 adds the three-button
icon-only theme control — a monitor, a sun and a moon — to both mastheads and the
module that wires it.
Phase 3 makes Electron's native chrome follow the choice through one new IPC channel.
Phase 4 replaces the chrome token values with the FlowCharge palette. Phase 5 verifies
the build and the package.

The stored mode lives in one `localStorage` key, `praxis-theme`, holding `system`,
`light` or `dark`. Any absent or unrecognised value resolves to `dark`. The pre-paint
script must be a separate bundled file, because `src/server.ts:31-34` sets
`script-src 'self'` with no `'unsafe-inline'`.

Frozen by the plan, in every task below: `--st-*`, `--sev-*`, `--chain` and
`--chain-soft` keep their current values in both modes. `src/public/styles.css:295`
keeps its literal `#fff`, because it sits on `--sev-critical`. No masthead layout CSS
is added — WS-70 owns the masthead redesign.

- [x] 1. Phase 1 — the theme mechanism, on today's colours

  ```yaml
  description: "Add the theme module, the pre-paint script, the third bundle entry point, and cut styles.css from four palette blocks to two. Values are not changed in this phase."
  ```

  - [x] 1.1 Write `src/public/theme.ts`
    ```yaml
    description: "The whole of the theme logic, as pure functions plus one DOM write (Contract 2)."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/public/theme.ts as a new ES module. Export the two types `ThemeMode = 'system' | 'light' | 'dark'` and `ResolvedTheme = 'light' | 'dark'`, and the two constants `THEME_STORAGE_KEY = 'praxis-theme'` and `DEFAULT_MODE: ThemeMode = 'dark'`."
      - "Export `readMode(): ThemeMode`. Read THEME_STORAGE_KEY from localStorage inside a try/catch, because localStorage access itself throws in some privacy modes. Return DEFAULT_MODE for an absent, empty, or unrecognised value. This function must never throw."
      - "Export `resolveMode(mode: ThemeMode): ResolvedTheme`. Return the mode itself for 'light' and 'dark'. For 'system', read `window.matchMedia('(prefers-color-scheme: dark)').matches` and return 'dark' or 'light'."
      - "Export `applyResolved(resolved: ResolvedTheme): void`. Set `document.documentElement.dataset.theme` to the resolved value. Never remove the attribute — it always holds a concrete 'light' or 'dark'."
      - "Export `setMode(mode: ThemeMode): ResolvedTheme`. Write the mode to localStorage inside a try/catch, resolve it, apply it, and return the resolved value. A storage write that throws must still leave the page repainted."
      - "Export `watchSystemPreference(): void`. Add a 'change' listener to `window.matchMedia('(prefers-color-scheme: dark)')`. On each fire, call `readMode()` again and re-apply only while the stored mode is 'system'. Read the mode inside the listener — never capture it at registration time, or a later switch to 'system' from the toggle will not be followed."
      - "Follow the file-header comment style of src/public/update-banner.ts: state what this module owns and what it must not know about — no page markup, no `.seg` control, no Electron, no `window.praxisThemeAPI`."
    pattern: "New file src/public/theme.ts. Renderer TypeScript, type-checked by src/public/tsconfig.json and bundled by esbuild."
    imports: "None. Browser globals only — localStorage, window.matchMedia, document.documentElement."
    compatibility: "src/public/tsconfig.json sets strict, isolatedModules, noEmit, target es2020, module esnext, moduleResolution bundler, and types: []. No Node types are available. Export the types with `export type` so isolatedModules is satisfied at every import site."
    gotcha: "esbuild inlines this module into every bundle that imports it, so home.js, app.js and theme-init.js each carry their own copy. The module must therefore hold no cross-copy state: every function reads localStorage or the DOM afresh. A captured mode variable would desynchronise the copies. Also: matchMedia's older `addListener` is deprecated but `addEventListener('change', ...)` is supported by the Chromium this app runs on, so use the modern form."
    verify:
      - "npx tsc -p src/public/tsconfig.json"
      - "Confirm the command exits 0 once task 1.4 has added the file to `include` — before that, tsc does not see the file at all."
    checklist:
      - "Does every localStorage read and write sit inside a try/catch, so readMode and setMode cannot throw?"
      - "Does readMode return DEFAULT_MODE ('dark') for an absent, empty, or unrecognised stored value?"
      - "Does applyResolved always write a concrete 'light' or 'dark', and never remove the data-theme attribute?"
      - "Does watchSystemPreference call readMode inside the listener rather than capturing the mode at registration time?"
      - "Is the module free of any reference to page markup, the `.seg` control, Electron, or window.praxisThemeAPI?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Write `src/public/theme-init.ts`
    ```yaml
    description: "The pre-paint entry point that applies the stored theme before the first paint (Contract 3)."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/public/theme-init.ts. Import readMode, resolveMode, applyResolved and watchSystemPreference from './theme'."
      - "Call `applyResolved(resolveMode(readMode()))`, then call `watchSystemPreference()`. That is the whole body."
      - "Touch no other element and wire no control. This file is loaded synchronously in <head> of both pages, so it must not query the DOM below <head>."
      - "Add a file-header comment stating why this is a separate file rather than an inline <head> script: src/server.ts:31-34 sets `script-src 'self'` with no `'unsafe-inline'`."
    pattern: "New file src/public/theme-init.ts. It becomes the third esbuild entry point in task 1.3."
    imports: "./theme only."
    compatibility: "Must run before the page's own bundle, so it is loaded by a plain synchronous <script src> in <head> with no defer and no type=module. It must not reference document.body or any page element, which do not exist yet at that point."
    gotcha: "esbuild's iife format wraps this file's own body, so the calls run immediately at script evaluation. Adding a DOMContentLoaded wrapper here would defeat the whole purpose and reintroduce the flash."
    verify:
      - "npx tsc -p src/public/tsconfig.json"
      - "grep -c 'DOMContentLoaded' src/public/theme-init.ts returns 0"
    checklist:
      - "Does the body consist only of the applyResolved(resolveMode(readMode())) call and the watchSystemPreference call?"
      - "Is the file free of any DOM query below <head> and of any DOMContentLoaded or load listener?"
      - "Does it import from './theme' rather than duplicating any of that logic?"
      - "Does the header comment record the CSP reason for this file existing?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.3 Add the third bundle entry point to `tools/bundle-public.mjs`
    ```yaml
    description: "Emit dist/public/theme-init.js alongside home.js and app.js, and correct the comment that states there are exactly two entry points."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In tools/bundle-public.mjs, find the `entryPoints` object inside the esbuild.build call — the one holding the `home` and `app` keys. Add a third key, `'theme-init': path.join(repoRoot, 'src', 'public', 'theme-init.ts')`. Quote the key, because it contains a hyphen."
      - "Rewrite the comment directly above that build call, which currently opens `// Exactly two entry points.` It must now say there are three, and it must keep its existing explanation that app-version.ts and update-banner.ts are not entry points because they arrive through side-effect imports."
      - "Extend that same comment to record why theme-init.ts is an entry point and the others are not: it must load and run in <head>, before the page's own bundle, so it needs its own output file and its own script tag."
      - "Change nothing else in this file. The sweep, the obfuscator pass, the eval guard and the write loop already iterate over whatever esbuild returns, so they need no edit to handle a third bundle."
    pattern: "tools/bundle-public.mjs — the esbuild.build call and the comment block immediately above it."
    imports: "None. The file already imports esbuild, fs, path and the obfuscator."
    compatibility: "Plain ESM, matching tools/copy-assets.mjs. The build runs with `write: false`, so the output stays in memory until after the eval guard — do not change that ordering."
    gotcha: "The output filename comes from the entryPoints key, so the key must be exactly `theme-init` to produce dist/public/theme-init.js and match the <script src> added in tasks 1.5 and 1.6. A key of `themeInit` would silently emit the wrong filename and fail only at runtime — this is one of the plan's named top risks."
    verify:
      - "npm run build"
      - "Confirm the build log prints `bundled 3 entry point(s)` and `eval guard clean across 3 bundle(s)`"
      - "test -f dist/public/theme-init.js"
    checklist:
      - "Is the new entry point key exactly `theme-init`, quoted, so the output file is dist/public/theme-init.js?"
      - "Does the comment above the build call now state three entry points instead of two?"
      - "Does that comment record why theme-init.ts needs its own output file while app-version.ts and update-banner.ts do not?"
      - "Are the sweep, obfuscator, eval guard and write loop left unchanged?"
      - "Does the eval guard report clean across three bundles rather than two?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.4 Add the two new modules to `src/public/tsconfig.json`
    ```yaml
    description: "Without this, tsc never type-checks theme.ts or theme-init.ts and the plan's second named risk lands at runtime."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/public/tsconfig.json:"
      - |
        src/public/tsconfig.json
        <<<<<<< SEARCH
          "include": ["app.ts", "home.ts", "ipc-adapter.ts", "browser-ipc-shim.ts", "app-version.ts", "update-banner.ts", "../types/praxis-data.d.ts", "lib/agentic-tools-scope.ts"]
        =======
          "include": ["app.ts", "home.ts", "theme.ts", "theme-init.ts", "ipc-adapter.ts", "browser-ipc-shim.ts", "app-version.ts", "update-banner.ts", "../types/praxis-data.d.ts", "lib/agentic-tools-scope.ts"]
        >>>>>>> REPLACE
    pattern: "src/public/tsconfig.json — the `include` array only."
    imports: "None."
    compatibility: "The array lists every renderer source file by name. Keep it a single line and keep the existing entries in their current order."
    gotcha: "This config sets noEmit: true — esbuild owns emit and tsc is the type-check gate only. So a file missing from `include` is never checked, and a type error in it surfaces only as broken behaviour in the browser. Task 2.4 adds a third name to this same array; if that task runs first, re-anchor this block against the file as it then stands."
    verify:
      - "npx tsc -p src/public/tsconfig.json"
      - "grep -c 'theme-init.ts' src/public/tsconfig.json returns 1"
    checklist:
      - "Do both `theme.ts` and `theme-init.ts` appear in the include array?"
      - "Are all eight original entries still present and in their original order?"
      - "Does the file remain valid JSON with its trailing comments intact?"
      - "Does `npx tsc -p src/public/tsconfig.json` exit 0?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.5 Load `theme-init.js` in `src/public/index.html`
    ```yaml
    description: "A plain synchronous script tag in <head>, after the stylesheet link, so data-theme is set before the first paint."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/public/index.html:"
      - |
        src/public/index.html
        <<<<<<< SEARCH
        <link rel="stylesheet" href="styles.css">
        </head>
        =======
        <link rel="stylesheet" href="styles.css">
        <script src="theme-init.js"></script>
        </head>
        >>>>>>> REPLACE
    pattern: "src/public/index.html — the <head> block only."
    imports: "dist/public/theme-init.js, produced by task 1.3."
    compatibility: "No `defer`, no `async` and no `type=module`. Any of the three would move execution past the first paint and reintroduce the flash the script exists to prevent. The src is same-origin, which satisfies the `script-src 'self'` CSP with no header change."
    gotcha: "tools/copy-assets.mjs copies index.html verbatim and needs no edit. theme-init.js is a bundle output, not a copied asset, so it is written by tools/bundle-public.mjs into the same dist/public/ directory the page is served from."
    verify:
      - "npm run build"
      - "grep -c 'theme-init.js' dist/public/index.html returns 1"
      - "test -f dist/public/theme-init.js"
    checklist:
      - "Does the script tag sit inside <head>, immediately after the stylesheet link?"
      - "Is it a plain synchronous tag, with no defer, async or type attribute?"
      - "Is the src exactly `theme-init.js`, matching the entry point key from task 1.3?"
      - "Is the rest of the file byte-for-byte unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.6 Load `theme-init.js` in `src/public/board.html`
    ```yaml
    description: "The same head insertion as task 1.5, in the board page."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/public/board.html:"
      - |
        src/public/board.html
        <<<<<<< SEARCH
        <link rel="stylesheet" href="styles.css">
        </head>
        =======
        <link rel="stylesheet" href="styles.css">
        <script src="theme-init.js"></script>
        </head>
        >>>>>>> REPLACE
    pattern: "src/public/board.html — the <head> block only."
    imports: "dist/public/theme-init.js, produced by task 1.3."
    compatibility: "Identical to task 1.5: synchronous, same-origin, no defer or module attribute."
    gotcha: "The board renders its whole body from JavaScript, so a theme applied after the bundle runs would repaint a fully-drawn board. The tag must stay ahead of app.js, which is why it lives in <head> and not at the end of <body>."
    verify:
      - "npm run build"
      - "grep -c 'theme-init.js' dist/public/board.html returns 1"
    checklist:
      - "Does the script tag sit inside <head>, immediately after the stylesheet link?"
      - "Is it a plain synchronous tag, with no defer, async or type attribute?"
      - "Is the markup identical to the tag added to index.html in task 1.5?"
      - "Is the rest of the file byte-for-byte unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.7 Cut `src/public/styles.css` from four palette blocks to two
    ```yaml
    description: "Delete the media-query block and the dead light attribute block, and expand the dark attribute block. No value changes in this phase."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/styles.css, delete the whole `@media (prefers-color-scheme: dark)` block at lines 53-92, including its wrapper braces. `theme-init.js` now resolves the system preference in JavaScript, so CSS never needs to."
      - "Delete the whole `:root[data-theme=\"light\"]` block at lines 106-118. It is a verbatim duplicate of the `:root` block at lines 9-51, and with the media block gone plain `:root` is already the light theme for every case where data-theme is not 'dark'."
      - "Keep the `:root[data-theme=\"dark\"]` block at lines 93-105 and expand it onto one declaration per line, matching the two-space indent and single-declaration-per-line formatting of the `:root` block above it. Group and blank-line-separate the declarations exactly as `:root` does: chrome tokens, then --st-*, then --st-*-bg, then --sev-*, then the commented chain pair, then --shadow."
      - "Change no value in this task. Every token in the expanded dark block must keep the hex or shadow value it carries today, and the `:root` block's values are untouched. Phase 4 owns the value swap."
      - "Leave the @font-face block, the --font-*, --radius, --st-*, --sev-*, --chain and --chain-soft declarations and every rule below line 120 exactly as they are."
    pattern: "src/public/styles.css lines 53-118 only. Nothing below line 119 is touched."
    imports: "None."
    compatibility: "The file already relies on :root[data-theme] and color-mix(), and the renderer is Chromium only, so no fallback is needed. After this task exactly two palette blocks exist: `:root` for light and `:root[data-theme=\"dark\"]` for dark."
    gotcha: "The dark attribute block and the deleted media block hold identical values today, so a copy-paste slip is invisible by eye. The first verify command below is what catches it: it compares the token/value pairs of the new dark block against the pre-edit dark block at HEAD and must print nothing."
    verify:
      - "diff <(git show HEAD:src/public/styles.css | sed -n '93,105p' | tr ';' '\\n' | sed 's/^ *//;s/ *$//' | grep '^--' | sed 's/ *: */:/' | sort) <(awk '/^:root\\[data-theme=\"dark\"\\]/,/^}/' src/public/styles.css | tr ';' '\\n' | sed 's/^ *//;s/ *$//' | grep '^--' | sed 's/ *: */:/' | sort) — must print nothing"
      - "grep -c 'prefers-color-scheme' src/public/styles.css returns 0"
      - "grep -c 'data-theme=\"light\"' src/public/styles.css returns 0"
      - "grep -c 'data-theme=\"dark\"' src/public/styles.css returns 1"
      - "npm run build"
    checklist:
      - "Are exactly two palette blocks left — `:root` and `:root[data-theme=\"dark\"]`?"
      - "Does the token/value diff against HEAD's dark block print nothing, proving no value moved?"
      - "Is the `:root` block at lines 9-51 byte-for-byte unchanged?"
      - "Is the expanded dark block formatted one declaration per line, with the same grouping and blank lines as `:root`?"
      - "Is every rule below the palette blocks, including the .card-foot and .card.is-chain rules, untouched?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — the toggle control

  ```yaml
  description: "Add the three-button icon-only theme control — monitor, sun, moon — to both mastheads and the module that wires it. Depends on Phase 1."
  ```

  - [x] 2.1 Add the `.seg` markup to `src/public/index.html`
    ```yaml
    description: "Contract 5's icon-only markup, added as the last child of the masthead. No CSS is added."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/index.html, find `<header class=\"masthead\">`. Add the control as its last child, after the `#manage-integrations-button` button."
      - "The markup is exactly this block, copied character for character. The three glyphs are the hand-approved ones from mockups/home-toolbar-mockup.html. Do not redraw them, do not change any viewBox, stroke or path value, and do not add width or height attributes to the svg elements:"
      - |
        <div class="seg" id="theme-seg" role="group" aria-label="Theme">
          <button type="button" data-mode="system" aria-label="Match system theme" title="System">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </button>
          <button type="button" data-mode="light" aria-label="Light theme" title="Light">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
          </button>
          <button type="button" data-mode="dark" aria-label="Dark theme" title="Dark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>
          </button>
        </div>
      - "The buttons carry no visible text. Each one's aria-label and title carry the label instead, so the accessible name and the tooltip stay what they were when the buttons were text-labelled."
      - "No button carries `class=\"active\"` in the markup. theme-toggle.ts sets it from storage on load, so the served HTML can never contradict the stored mode."
      - "Add no CSS. `.seg` and `.seg button` at src/public/styles.css:260-274 already style this shape, and masthead layout for the control is WS-70's work, not this plan's."
    pattern: "src/public/index.html — the <header class=\"masthead\"> element only."
    imports: "The existing .seg and .seg button rules in src/public/styles.css. Nothing new."
    compatibility: "Reuses the same three-state joined segmented control already used twice in src/public/board.html. Keep the element order system, light, dark — theme-toggle.ts reads data-mode and does not depend on order, but the plan's acceptance criterion names that reading."
    gotcha: "The masthead was rebuilt around the FlowCharge wordmark in a recent WS-70 commit, so its children are a `<div>` wrapper plus the integrations button. Add the control as a sibling of those, not inside the wrapper div, or it inherits that column's stacking. Adding masthead layout CSS here would collide with WS-70 — the plan deliberately leaves the control unstyled. That includes the icon sizing rule: the svg elements carry no width or height, and the rule that sizes them in the mockups, `.toolbar .seg button svg { width: 13px; height: 13px; }`, sits in WS-70's toolbar block. Until WS-70 lands, the glyphs render at the browser's default replaced-element size. See PLN-60-f7jh0n Open question 3 — do not add the rule here to work around it."
    verify:
      - "npm run build"
      - "grep -c 'id=\"theme-seg\"' dist/public/index.html returns 1"
      - "grep -c 'data-mode=' src/public/index.html returns 3"
      - "grep -c 'aria-label=' src/public/index.html returns 4 — one on the group and one per button"
      - "grep -c '<svg' src/public/index.html returns 3"
      - "grep -c 'class=\"active\"' src/public/index.html returns 0"
    checklist:
      - "Is the control the last child of <header class=\"masthead\">, and not nested inside the brand wrapper div?"
      - "Does it carry id=\"theme-seg\", class=\"seg\", role=\"group\" and aria-label=\"Theme\"?"
      - "Do the three buttons carry type=\"button\" and data-mode values of system, light and dark?"
      - "Does each button carry both aria-label and title, reading Match system theme/System, Light theme/Light and Dark theme/Dark?"
      - "Do the three svg elements match the mockup byte for byte, including viewBox, stroke attributes and path data, with no width or height attribute added?"
      - "Is no button marked active in the served markup?"
      - "Was no CSS rule added to src/public/styles.css for this control, including any svg sizing rule?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.2 Add the `.seg` markup to `src/public/board.html`
    ```yaml
    description: "The identical control in the board page's masthead."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/board.html, find `<header class=\"masthead\">`. Add the same control as its last child, after the `<div class=\"meta\">` block."
      - "The markup must be byte-for-byte identical to the block added to index.html in task 2.1, including the id, the role, the group aria-label, the three data-mode values, each button's own aria-label and title, and all three svg elements with their viewBox, stroke attributes and path data."
      - "Copy the block from src/public/index.html rather than retyping it. Retyped path data is the one failure this task's diff check exists to catch."
      - "Add no CSS, and add no masthead layout rule, including no svg sizing rule."
    pattern: "src/public/board.html — the <header class=\"masthead\"> element only."
    imports: "The existing .seg and .seg button rules in src/public/styles.css."
    compatibility: "The page already carries two `.seg` controls, `#sort-key-seg` and `#sort-dir-seg`, inside `.controls`. This third one uses a distinct id so the delegated listeners never collide."
    gotcha: "app.ts rebuilds parts of this page with innerHTML. The masthead is not one of them, so the control survives — but do not move it into `.controls` or `.board`, which are rebuilt."
    verify:
      - "npm run build"
      - "grep -c 'id=\"theme-seg\"' dist/public/board.html returns 1"
      - "diff <(grep -A10 'id=\"theme-seg\"' src/public/index.html) <(grep -A10 'id=\"theme-seg\"' src/public/board.html) — must print nothing. The block is 11 lines, so -A10 covers it from the container line to the closing </div>."
      - "grep -c '<svg' src/public/board.html returns 3"
    checklist:
      - "Is the control the last child of <header class=\"masthead\">, after the .meta block?"
      - "Is the markup identical to the block in index.html, svg path data included?"
      - "Is the id distinct from #sort-key-seg and #sort-dir-seg?"
      - "Was no CSS rule added for this control?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.3 Write `src/public/theme-toggle.ts`
    ```yaml
    description: "The renderer half of the control (Contract 4) — it wires the markup and reflects state, nothing more."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/public/theme-toggle.ts as a side-effect ES module, following the shape src/public/update-banner.ts sets: a `declare global` block for the optional window global, a guard that returns silently when the page or the global is absent, and an empty `export {}` at the foot to make it a module."
      - "Query `#theme-seg`. Return silently when it is absent, so the module is inert on any page that does not ship the control."
      - "On load, read the stored mode with `readMode()` from './theme' and add the `active` class to the button whose `data-mode` matches. Remove it from the other two."
      - "Bind ONE delegated 'click' listener on the container, matching the pattern app.ts already uses for `#sort-key-seg`. Resolve the button with `(event.target as Element).closest('button[data-mode]')`, ignore a click that resolves to nothing, then read `data-mode` from it and validate the value against the three literals before using it."
      - "closest() is required, not optional. The buttons are icon-only, so their only child is an `<svg>` and most real clicks land on the svg or on a path inside it, never on the button element. Reading data-mode straight off event.target would make the control dead to the mouse while still working under the keyboard."
      - "On a valid click, call `setMode(mode)` from './theme', then move the `active` class to that button."
      - "Then call `window.praxisThemeAPI?.setThemeSource(mode)` as fire-and-forget. Declare the global as optional in the `declare global` block, exactly as update-banner.ts declares `praxisUpdateAPI?`, so a plain browser tab skips the call and logs nothing. Swallow a rejected promise rather than letting it surface as an unhandled rejection."
      - "Add no CSS and no markup. This module must not create the control, only wire it."
    pattern: "New file src/public/theme-toggle.ts. Pulled into both bundles by the side-effect imports added in tasks 2.5 and 2.6. It gets no entry point and no output file of its own."
    imports: "readMode and setMode from './theme'. Nothing else."
    compatibility: "src/public/tsconfig.json is strict with types: [], so no Node types exist. The Window augmentation must sit inside `declare global` — a bare top-level `interface Window` in a module is local and never merges with lib.dom.d.ts's Window. Mark praxisThemeAPI optional, or the browser-tab guard becomes unreachable to the type checker."
    gotcha: "esbuild inlines a second copy of theme.ts into each bundle beside theme-init.js's copy. That is safe only because theme.ts holds no module state — setMode here writes localStorage, and theme-init.js's matchMedia listener re-reads it on every fire. Do not add a cached mode variable to either module. Also: this file must never call watchSystemPreference — theme-init.ts already registers that listener once per page, and a second registration would double-apply."
    verify:
      - "npx tsc -p src/public/tsconfig.json"
      - "grep -c 'watchSystemPreference' src/public/theme-toggle.ts returns 0"
      - "grep -c 'addEventListener' src/public/theme-toggle.ts returns 1"
    checklist:
      - "Does the module return silently when #theme-seg is absent?"
      - "Is there exactly one delegated click listener on the container, rather than one per button?"
      - "Does the listener resolve the button with closest('button[data-mode]'), so a click landing on the inner svg or on a path still works?"
      - "Is the clicked data-mode validated against the three literals before it reaches setMode?"
      - "Is window.praxisThemeAPI declared optional inside `declare global` and called with optional chaining, so a plain browser tab logs nothing?"
      - "Does the module set the initial active button from readMode rather than assuming the markup already marks one?"
      - "Does it avoid calling watchSystemPreference, which theme-init.ts already owns?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.4 Add `theme-toggle.ts` to `src/public/tsconfig.json`
    ```yaml
    description: "Extend the include array so tsc type-checks the new module."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/tsconfig.json, append the entry `\"theme-toggle.ts\"` to the `include` array, directly after the `\"theme-init.ts\"` entry that task 1.4 added. Keep the array on one line and leave every other entry in place."
    pattern: "src/public/tsconfig.json — the `include` array only."
    imports: "None."
    compatibility: "Keep the file valid JSON with its existing trailing comments in compilerOptions intact."
    gotcha: "No SEARCH block is given here on purpose: task 1.4 rewrites this same line, so any block authored against base_commit 406ffff would be stale by the time this task runs. Read the array as it then stands and append to it."
    verify:
      - "npx tsc -p src/public/tsconfig.json"
      - "grep -c 'theme-toggle.ts' src/public/tsconfig.json returns 1"
    checklist:
      - "Does the include array now hold theme.ts, theme-init.ts and theme-toggle.ts?"
      - "Are the eight original entries still present and in order?"
      - "Does `npx tsc -p src/public/tsconfig.json` exit 0?"
      - "Is the file still valid JSON?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.5 Import `theme-toggle` from `src/public/app.ts`
    ```yaml
    description: "One side-effect import, beside the two already there, so the board bundle carries the toggle wiring."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/public/app.ts:"
      - |
        src/public/app.ts
        <<<<<<< SEARCH
        import './update-banner';
        import { unwrapIpc } from './ipc-adapter';
        =======
        import './update-banner';
        import './theme-toggle';
        import { unwrapIpc } from './ipc-adapter';
        >>>>>>> REPLACE
      - "Extend the file-header comment above the imports, which currently names './app-version' and './update-banner' as the side-effect imports, so it names './theme-toggle' too."
    pattern: "src/public/app.ts — the import block at the head of the file."
    imports: "./theme-toggle, as a side-effect import with no binding."
    compatibility: "The import order in this file is load-bearing: './browser-ipc-shim' must stay first so its fallback installs window.praxisAPI before any other module body runs. Place the new import after './update-banner', never before the shim."
    gotcha: "isolatedModules is on, so a side-effect import with no binding is correct and must not be rewritten as a named import. The module has no export to bind."
    verify:
      - "npx tsc -p src/public/tsconfig.json"
      - "npm run build"
      - "grep -c 'theme-seg' dist/public/app.js returns at least 1, proving the module reached the bundle"
    checklist:
      - "Is './browser-ipc-shim' still the first import in the file?"
      - "Is the new import a bare side-effect import with no binding?"
      - "Does the file-header comment now name './theme-toggle' alongside the other side-effect imports?"
      - "Does the built dist/public/app.js contain the theme-seg selector?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.6 Import `theme-toggle` from `src/public/home.ts`
    ```yaml
    description: "The same side-effect import in the home-page entry module."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/public/home.ts:"
      - |
        src/public/home.ts
        <<<<<<< SEARCH
        import './update-banner';
        import { unwrapIpc } from './ipc-adapter';
        =======
        import './update-banner';
        import './theme-toggle';
        import { unwrapIpc } from './ipc-adapter';
        >>>>>>> REPLACE
      - "Extend the file-header comment that describes the load-bearing import order so it names './theme-toggle' as a third side-effect import."
    pattern: "src/public/home.ts — the import block at the head of the file."
    imports: "./theme-toggle, as a side-effect import with no binding."
    compatibility: "Same ordering constraint as app.ts: './browser-ipc-shim' stays first. Leave the `import type` lines and the lib/agentic-tools-scope imports below untouched."
    gotcha: "This file's header comment explicitly documents the import order as load-bearing, so an edit that leaves the comment stale is a real defect here, not a nicety."
    verify:
      - "npx tsc -p src/public/tsconfig.json"
      - "npm run build"
      - "grep -c 'theme-seg' dist/public/home.js returns at least 1"
    checklist:
      - "Is './browser-ipc-shim' still the first import in the file?"
      - "Is the new import a bare side-effect import with no binding?"
      - "Does the file-header comment now name './theme-toggle'?"
      - "Does the built dist/public/home.js contain the theme-seg selector?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 3 — Electron native chrome

  ```yaml
  description: "One IPC channel so nativeTheme.themeSource and the window background follow the theme choice. Depends on Phase 2."
  ```

  - [x] 3.1 Write `electron/theme-ipc-handlers.cts`
    ```yaml
    description: "Register the setThemeSource channel, validating the argument against three literals before touching nativeTheme (Contract 6)."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create electron/theme-ipc-handlers.cts. Import `ipcMain` and `nativeTheme` from 'electron'."
      - "Export one function, following the naming of the three existing registrars: `export function registerThemeIpcHandlers(): void`. It takes no argument and returns nothing."
      - "Inside it, call `ipcMain.handle('setThemeSource', ...)`. The handler validates its argument against the three literals 'system', 'light' and 'dark' at the boundary and ignores anything else, so the renderer cannot set an arbitrary value."
      - "On a valid value, assign it to `nativeTheme.themeSource`. Electron's own themeSource values are the same three strings, so no mapping table is needed."
      - "The handler returns nothing, reads nothing and persists nothing. localStorage in the renderer stays the single source of truth for the mode."
      - "Add a file-header comment in the style of electron/update-check-ipc-handlers.cts, stating that this is the whole of the main process's theme surface and that it stores nothing."
    pattern: "New file electron/theme-ipc-handlers.cts, beside ipc-handlers.cts, agentic-tools-ipc-handlers.cts and update-check-ipc-handlers.cts."
    imports: "ipcMain and nativeTheme from 'electron'. Nothing from src/lib/*."
    compatibility: "electron/tsconfig.json compiles this tree to CommonJS with rootDir '.'. This file must never import — value or type — anything from src/lib/*.ts, for the reasons the headers of the two existing handler files set out. It needs no such import."
    gotcha: "This registrar is synchronous, like registerIpcHandlers, not async like the other two. Keep it synchronous so main.cts calls it without await. Also: an unvalidated assignment to nativeTheme.themeSource is the only new attack surface this plan adds — the literal check is what keeps it to Electron's own three states."
    verify:
      - "npx tsc -p electron/tsconfig.json"
      - "Confirm the command exits 0 once task 3.2 has added the file to `include`"
      - "grep -c \"'system'\" electron/theme-ipc-handlers.cts returns at least 1, confirming the literal validation is present"
    checklist:
      - "Does the handler validate the argument against exactly 'system', 'light' and 'dark' before assigning it?"
      - "Does an unrecognised value leave nativeTheme.themeSource untouched, with no throw?"
      - "Does the file persist nothing and read nothing back?"
      - "Is the exported registrar named registerThemeIpcHandlers and synchronous?"
      - "Is the file free of any import from src/lib/*?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.2 Add the new handler to `electron/tsconfig.json`
    ```yaml
    description: "Add theme-ipc-handlers.cts to the include array, without which it is never compiled and main.cts cannot require it. See Divergence 1."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to electron/tsconfig.json:"
      - |
        electron/tsconfig.json
        <<<<<<< SEARCH
          "include": ["main.cts", "preload.cts", "ipc-handlers.cts", "agentic-tools-ipc-handlers.cts", "update-check-ipc-handlers.cts"]
        =======
          "include": ["main.cts", "preload.cts", "ipc-handlers.cts", "agentic-tools-ipc-handlers.cts", "update-check-ipc-handlers.cts", "theme-ipc-handlers.cts"]
        >>>>>>> REPLACE
    pattern: "electron/tsconfig.json — the `include` array only."
    imports: "None."
    compatibility: "This config emits to ../dist/electron with noEmitOnError: true, so a file outside `include` produces no dist/electron/theme-ipc-handlers.cjs at all."
    gotcha: "PLN-60-f7jh0n's Files-touched table does not list this file — see Divergence 1. Without this one-line edit the Phase 3 change cannot compile or run, so it is in scope as a strictly required consequence of task 3.1, and nothing else in this file is touched."
    verify:
      - "npm run build"
      - "test -f dist/electron/theme-ipc-handlers.cjs"
    checklist:
      - "Does the include array now list theme-ipc-handlers.cts?"
      - "Are the five original entries still present and in order?"
      - "Does dist/electron/theme-ipc-handlers.cjs exist after a build?"
      - "Is every other key in the file unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.3 Expose `praxisThemeAPI` from `electron/preload.cts`
    ```yaml
    description: "A fourth contextBridge global, kept separate rather than folded into praxisAPI."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "At the foot of electron/preload.cts, after the `praxisUpdateAPI` block, add a fourth `contextBridge.exposeInMainWorld` call for `praxisThemeAPI`."
      - "It exposes one method: `setThemeSource: (mode: string): Promise<void> => ipcRenderer.invoke('setThemeSource', mode)`."
      - "Add a short comment above it, matching the style of the two comments already in this file, recording that this is a fourth distinct global for a fourth distinct concern, following the precedent the praxisSkillInstallAPI and praxisUpdateAPI blocks set rather than folding the method into praxisAPI."
      - "Change nothing in the three existing blocks."
    pattern: "electron/preload.cts — appended after the existing praxisUpdateAPI block."
    imports: "contextBridge and ipcRenderer, both already imported at the head of the file."
    compatibility: "The global name and the method name are a contract with src/public/theme-toggle.ts and with the obfuscator, whose `renameProperties: false` setting in tools/bundle-public.mjs exists precisely to keep these names intact across the contextBridge boundary. Do not rename either side."
    gotcha: "The preload runs with sandbox: true and contextIsolation: true. Forward the raw promise and add no error translation here — every other block in this file follows the same rule. A mismatch between the exposed method name and the name theme-toggle.ts calls fails silently in Electron while a plain browser tab keeps working."
    verify:
      - "npx tsc -p electron/tsconfig.json"
      - "grep -c 'praxisThemeAPI' electron/preload.cts returns 1"
      - "diff <(grep -o \"setThemeSource\" electron/preload.cts | head -1) <(grep -o \"setThemeSource\" src/public/theme-toggle.ts | head -1) — must print nothing, proving both sides spell the method the same way"
    checklist:
      - "Is praxisThemeAPI a separate exposeInMainWorld call rather than a key folded into praxisAPI?"
      - "Does it expose exactly one method, setThemeSource, taking one string?"
      - "Does the wrapper forward ipcRenderer.invoke's promise directly, with no error translation?"
      - "Do the global and method names match what src/public/theme-toggle.ts calls, character for character?"
      - "Are the three existing exposeInMainWorld blocks unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.4 Register the handler and set the window background in `electron/main.cts`
    ```yaml
    description: "One import, one register call beside the three existing ones, and backgroundColor on the BrowserWindow."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add `import { registerThemeIpcHandlers } from './theme-ipc-handlers.cjs';` beside the three existing handler imports at the head of the file. Note the `.cjs` extension — this tree's imports name the compiled output, matching the three lines already there."
      - "In the `app.whenReady()` callback, add `registerThemeIpcHandlers();` beside the three existing register calls, before `createWindow(SERVER_URL)`. It is synchronous, so it takes no await."
      - "In `createWindow`, add `backgroundColor: '#22252E'` as a property on the `new BrowserWindow({ ... })` options object, as a sibling of `webPreferences` rather than inside it. Without it the native window paints white before the first frame, which is the flash the pre-paint script exists to prevent."
      - "Add a short comment beside backgroundColor recording that the value is the dark page background from Phase 4's palette and that it matches the dark default the renderer resolves to."
      - "Change nothing else in this file — the dynamic-import shim, the PRAXIS_DATA_DIR block and the PORT block are all out of scope."
    pattern: "electron/main.cts — the import block, the createWindow function, and the register calls inside app.whenReady()."
    imports: "registerThemeIpcHandlers from './theme-ipc-handlers.cjs'."
    compatibility: "Handlers must be registered before createWindow, or an early renderer call finds no handler. backgroundColor belongs on the BrowserWindow options, not on webPreferences — Electron ignores it there."
    gotcha: "The hex must be exactly '#22252E', the dark --paper value Phase 4 installs. A light-mode user still sees a brief dark frame before the light page paints; the plan accepts that cost explicitly, so do not add a second mechanism to avoid it."
    verify:
      - "npx tsc -p electron/tsconfig.json"
      - "npm run build"
      - "grep -c \"backgroundColor: '#22252E'\" electron/main.cts returns 1"
      - "grep -c 'registerThemeIpcHandlers' electron/main.cts returns 2"
    checklist:
      - "Is the import written with the .cjs extension, matching the three existing handler imports?"
      - "Is registerThemeIpcHandlers called before createWindow, and without await?"
      - "Does backgroundColor sit on the BrowserWindow options object rather than inside webPreferences?"
      - "Is the value exactly '#22252E'?"
      - "Are the dynamic-import shim, the PRAXIS_DATA_DIR block and the PORT block untouched?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 4. Phase 4 — install the FlowCharge palette in `src/public/styles.css`
  ```yaml
  description: "Replace the chrome token values in both palette blocks with Contract 7's two tables, add --accent-on and --rule-strong, and repoint the four hardcoded foregrounds. Depends on Phase 1's two-block structure."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Add a header comment above the `:root` block, mirroring the style of the website's own steel-theme.css header. It must name the five source swatches — #434A5B slate, #D5E0E9 powder, #5C7C96 steel, #A2805B bronze, #D2C2AA oak — the two permitted derivation operations (a straight-line sRGB mix toward black or white, or toward the block's own background), and this plan's id, PLN-60-f7jh0n."
    - "In the `:root` block, replace the chrome token values with Contract 7's light table: --paper #E9E1D5, --paper-raised #EFEAE1, --paper-sunken #DED2C0, --ink #434A5B, --ink-soft #545967, --ink-faint #5C616D, --line #D2C2AA, --line-strong #7D7F86, --accent #455D71, --accent-ink #2F3440, --accent-soft #DBE0E3, and --shadow `0 1px 2px rgba(67,74,91,0.10), 0 1px 1px rgba(67,74,91,0.06)`."
    - "Add two new tokens to the `:root` block: --accent-on #FFFFFF and --rule-strong #9A7A56."
    - "In the `:root[data-theme=\"dark\"]` block, replace the chrome token values with Contract 7's dark table: --paper #22252E, --paper-raised #2A2E39, --paper-sunken #16181E, --ink #D5E0E9, --ink-soft #9FA8B1, --ink-faint #8D959E, --line #3B3F46, --line-strong #6A7079, --accent #95AABB, --accent-ink #D5E0E9, --accent-soft #333845. Leave --shadow at `0 1px 3px rgba(0, 0, 0, 0.35)` — it is black, not a palette colour."
    - "Add the same two new tokens to the dark block: --accent-on #22252E (equal to that block's --paper) and --rule-strong #A2805B."
    - "Repoint the three hardcoded whites that sit on var(--accent): change `color: #fff` to `color: var(--accent-on)` at line 131 (::selection), line 272 (.seg button.active) and line 294 (.filter-chips button.active). White on the new dark --accent #95AABB is 2.4:1, which is the regression --accent-on exists to prevent."
    - "Repoint the fourth consumer: at line 686, in the `.add-form button, #choose-folder-button, #manage-integrations-button` rule, change `color: var(--paper-raised)` to `color: var(--accent-on)`. That is one rule, not two."
    - "Point .card-foot's dashed top rule at the new token: at line 410, change `border-top: 1px dashed var(--line)` to `border-top: 1px dashed var(--rule-strong)`. This is bronze's one and only home."
    - "Leave line 295, `.filter-chips button.blocked-toggle.active`, with its literal #fff. It sits on --sev-critical, which is frozen."
    - "Leave every --st-*, --st-*-bg, --sev-*, --chain and --chain-soft declaration byte-for-byte unchanged in both blocks. Leave --font-*, --radius and the @font-face block unchanged."
  pattern: "src/public/styles.css only — the two palette blocks, and lines 131, 272, 294, 410 and 686. No other file."
  imports: "Values derived from /Users/akoukoullis/Work/AK/Praxis-Website/app/steel-theme.css. No import statement and no new asset."
  compatibility: "Depends on Phase 1 having left exactly two palette blocks. Every token name already in use stays in use — this task changes values and adds two names, and removes none, so no consumer rule breaks."
  gotcha: "The line numbers above are the ones at base_commit 406ffff; Phase 1 deletes 66 lines above them, so read the file as it then stands and locate each edit by its selector, not by line number. The plan's named top risk here is skipping --accent-on and leaving the three #fff values to fail contrast silently in dark mode — the #fff count check below is what catches that. Second: dark --line is #3B3F46, not #2F3440. An earlier draft of Contract 7 carried #2F3440, derived from slate; live review rejected it because it sat only 5 to 7 units per channel from --paper-raised #2A2E39 and read as flat. #3B3F46 is derived from powder instead, and it is the value both mockups carry. Note that #2F3440 is still correct for light --accent-ink — do not confuse the two."
  verify:
    - "diff <(git show HEAD:src/public/styles.css | tr ';' '\\n' | grep -oE '\\-\\-(st|sev)-[a-z-]+ *: *#[0-9A-Fa-f]{6}' | tr -d ' ' | sort -u) <(tr ';' '\\n' < src/public/styles.css | grep -oE '\\-\\-(st|sev)-[a-z-]+ *: *#[0-9A-Fa-f]{6}' | tr -d ' ' | sort -u) — must print nothing, proving every --st-* and --sev-* value is unchanged in both modes"
    - "diff <(git show HEAD:src/public/styles.css | tr ';' '\\n' | grep -oE '\\-\\-chain(-soft)? *: *#[0-9A-Fa-f]{6}' | tr -d ' ' | sort -u) <(tr ';' '\\n' < src/public/styles.css | grep -oE '\\-\\-chain(-soft)? *: *#[0-9A-Fa-f]{6}' | tr -d ' ' | sort -u) — must print nothing"
    - "grep -c '#fff' src/public/styles.css returns 1, and grep -n '#fff' src/public/styles.css shows only the .filter-chips button.blocked-toggle.active rule"
    - "grep -c 'var(--accent-on)' src/public/styles.css returns 4"
    - "grep -c -- '--rule-strong' src/public/styles.css returns 3 — one definition per block plus the .card-foot use"
    - "grep -c 'var(--paper-raised)' src/public/styles.css returns one fewer than it did at HEAD, confirming the line-686 repoint"
    - "npm run build"
    - "Open the board in both modes and confirm the page background, the board columns, the workstream card head, body and foot and the four KPI panels are all painted in the new palette. Light --paper reads as the warm cream #E9E1D5 and dark --paper as #22252E. Spot-check the twelve pairs in Contract 7's contrast table with the browser's contrast inspector, and confirm no purple, red, green or amber board colour moved."
  checklist:
    - "Does the --st-*/--sev-* set diff against HEAD print nothing, proving those tokens are frozen in both modes?"
    - "Does the --chain/--chain-soft diff against HEAD print nothing?"
    - "Is exactly one literal #fff left in the file, on the .filter-chips button.blocked-toggle.active rule?"
    - "Do all four --accent-on consumers point at the token — ::selection, .seg button.active, .filter-chips button.active, and the .add-form button rule?"
    - "Is --accent-on defined in both blocks, at #FFFFFF light and #22252E dark, and --rule-strong at #9A7A56 light and #A2805B dark?"
    - "Is --line #D2C2AA in the light block and #3B3F46 in the dark block, with #2F3440 appearing only as light --accent-ink?"
    - "Does .card-foot's dashed top rule use var(--rule-strong)?"
    - "Does the new header comment name the five swatches, the two permitted operations, and PLN-60-f7jh0n?"
  self_eval:
    passed: true
    failures: []
    notes:
      - "Every implement step applied to src/public/styles.css. No SEARCH block was re-anchored; the task is spec mode and each anchor was located by selector, as its gotcha directs."
      - "Verify steps 1-7 ran and passed: both frozen-token diffs printed nothing, #fff count is 1, var(--accent-on) count is 4, --rule-strong count is 3, var(--paper-raised) fell from 15 at HEAD to 14, and npm run build succeeded with the eval guard clean across 3 bundles."
      - "Verify step 8, the browser inspection of both modes, was not run. This executor cannot drive a browser. It needs a human pass before Phase 5 closes."
  ```

- [x] 5. Phase 5 — build and package check
  ```yaml
  description: "Confirm both builds succeed, the eval guard covers three bundles, the minified theme-init.js ships, and the packaged app shows no flash. Depends on Phase 4."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Run `npm run build` and confirm it exits 0. This runs tsc against all three tsconfigs, copy-assets, and the bundler."
    - "Confirm the bundler log reports three entry points and that the eval guard reports clean across three bundles rather than two."
    - "Run `npm run build:release` and confirm it exits 0, that dist/public/theme-init.js exists, and that it is minified and obfuscated rather than readable."
    - "Confirm dist/public/index.html and dist/public/board.html both carry the theme-init.js script tag, proving copy-assets shipped the edited HTML."
    - "Run `npm run package:mac`, launch the packaged app, and confirm the pre-paint script is present in the packaged bundle and that no light-to-dark or dark-to-light flash is visible at load for the stored mode."
    - "In the packaged app, confirm the plan's acceptance criteria end to end: a first launch with nothing stored renders dark; each of the three buttons repaints immediately and marks itself active; the choice survives a reload and a full restart; System follows a change to the operating system's appearance while the window is open; and choosing Light or Dark changes the native folder-picker dialog opened by Choose folder."
    - "Finally run `npm start` in a plain browser tab and confirm the toggle still works, the theme still persists, and the console logs no error — proving the window.praxisThemeAPI guard holds outside Electron."
    - "Fix nothing here. A failure in this task is reported back against the phase that caused it."
  pattern: "No source file is edited by this task. It exercises package.json's build, build:release, package:mac and start scripts."
  imports: "None."
  compatibility: "package:mac runs build:release first and sets hardenedRuntime and notarize. Notarisation may need credentials this machine does not hold — if it fails at the notarise step, record that the bundle built and stop, because the plan's check is about the pre-paint script and the flash, not about signing."
  gotcha: "The bundler writes nothing until after the eval guard passes, so a guard failure leaves dist/public/ with the swept state and no bundles at all. If the release build trips the guard, the documented fallback in tools/bundle-public.mjs is to drop stringArrayEncoding to [] — never to remove the guard."
  verify:
    - "npm run build"
    - "npm run build:release"
    - "Confirm both logs print `bundled 3 entry point(s)` and `eval guard clean across 3 bundle(s)`"
    - "test -f dist/public/theme-init.js"
    - "grep -c 'theme-init.js' dist/public/index.html dist/public/board.html returns 1 for each file"
    - "npm run package:mac, then launch the packaged app and confirm no flash at load and that the three buttons behave as the acceptance criteria describe"
    - "npm start, then confirm in a plain browser tab that the toggle works and the console is clean"
  checklist:
    - "Do both npm run build and npm run build:release exit 0?"
    - "Does the eval guard report clean across three bundles in both builds?"
    - "Does dist/public/theme-init.js exist, and is it minified in the release build?"
    - "Do both packaged HTML pages carry the theme-init.js script tag?"
    - "Is no flash visible at load in the packaged app for the stored mode?"
    - "Does the toggle work with a clean console in a plain browser tab under npm start?"
  self_eval:
    passed: true
    failures: []
    notes:
      - "Is no flash visible at load in the packaged app for the stored mode? — Confirmed directly by the user: opened release/mac-arm64/Praxis Board.app and reported no flash."
      - "Does the toggle work with a clean console in a plain browser tab under npm start? — Confirmed by the orchestrator using real browser tooling against npm start on port 4173: instant repaint on click with no reload, dark persisted across a reload with data-theme already set before paint, console stayed empty throughout, theme-init.js loaded 200 OK."
        fix: "A human, or a tooled browser session, must run npm start, open the dashboard in a plain browser tab, click each of the three theme buttons, reload to confirm persistence, and confirm the console logs no error, proving the window.praxisThemeAPI guard holds outside Electron."
  ```

## Divergences

1. **`electron/tsconfig.json` is missing from the plan's Files-touched table.** The plan
   lists thirteen files for Phase 3 and does not name `electron/tsconfig.json`. That file
   (read at `406ffff`) carries an explicit `include` array listing all five `.cts` files
   by name, and it compiles with `noEmitOnError: true` to `../dist/electron`. A new
   `electron/theme-ipc-handlers.cts` outside that array is never compiled, so
   `dist/electron/theme-ipc-handlers.cjs` never exists and `electron/main.cts`'s import of
   it fails at type-check and at runtime. The consequence: task 3.2 makes that one-line
   `include` addition, because it is strictly required for task 3.1's file to compile.
   Nothing else in `electron/tsconfig.json` is touched.

Every other file the plan cites matched it at `406ffff`, including all of
`src/public/styles.css`'s quoted line ranges (the four palette blocks at 9-51, 53-92,
93-105 and 106-118, and lines 131, 260-274, 294, 295, 410, 415-418 and 682-690), the
`script-src 'self'` CSP at `src/server.ts:31-34`, and the two-entry-point block in
`tools/bundle-public.mjs`.

---
id: TL-89-lo5o02
type: tasklist
workstream: WS-77-ctmvwq
slug: sticky-toolbar-stack-on-scroll
title: "Pin the toolbar, breadcrumb bar and sort/filter bar as one sticky stack on the board"
status: ready
created: 2026-08-31
updated: 2026-08-31
author: Anthony Koukoullis
depends_on: [PLN-76-6ahcp5]
links: []
mode: spec
base_commit: fcdd0da
---

# FlowCharge Tasks

## Pin the toolbar, breadcrumb bar and sort/filter bar as one sticky stack on the board

The board page pins only the sort-and-filter bar (`.controls`) today. This work pins two more
rows above it — the app toolbar (`.toolbar`) and the breadcrumb bar (`.toolbar-crumb`) — so
three rows stack and stay visible at any scroll position.

The method is pure CSS: three `position: sticky` boxes whose `top` offsets come from two new
layout custom properties, scoped to the board page by one new `body` class. No JavaScript, no
new DOM wrapper, no new dependency.

A sticky stack of separate boxes needs each box height as a constant, because each box offsets
by the sum of the boxes above it. `.toolbar` is already a fixed `44px`. `.toolbar-crumb` is
not: it carries `min-height: 26px` and `flex-wrap: wrap`, so a long project title can wrap it
onto a second line and break the arithmetic. Stage 1 therefore fixes the breadcrumb bar height
on the board page before stage 2 pins anything.

Two files change: `src/public/board.html` (one class attribute) and `src/public/styles.css`
(the toolbar section and the `.controls` rule). `src/public/index.html` is read-only reference
and must not change. Both pages share the `.toolbar` and `.toolbar-crumb` class names, so every
new rule is scoped under `.board-page`.

The repository has no DOM or CSS test harness, and this work adds none. Several acceptance
criteria are therefore checklist items for manual verification against a built and served
board, not automated commands.

- [ ] 1. Fix the measurement contract

  ```yaml
  description: "Plan stage 1. Add the board page scope class, declare the two layout custom properties, and give the board breadcrumb bar a fixed height and nowrap. The board must render exactly as it does today."
  ```

  - [ ] 1.1 Add the `board-page` class to the board's `<body>`
    ```yaml
    description: "Give src/public/board.html the page scope class that every new CSS rule keys off."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Edit src/public/board.html only. The anchor is the bare <body> tag on line 10, which is the single line in the file that reads exactly `<body>` (confirmed by grep -c '^<body>$' at base_commit fcdd0da, which returned 1)."
      - "Apply this block. It is a small, mechanical, single-location edit, so a literal block is used in this spec-mode file."
      - |
        src/public/board.html
        <<<<<<< SEARCH
        <body>
        =======
        <body class="board-page">
        >>>>>>> REPLACE
      - "Do not open or edit src/public/index.html. Its <body> stays bare, which is what keeps the home page out of every scoped rule."
    pattern: "src/public/board.html"
    imports: "None. This is a markup attribute only."
    compatibility: "Per PLN-76-6ahcp5 'Contract: the page scope class'. src/public/index.html shares the .toolbar and .toolbar-crumb class names, so the class is the only thing separating the two pages. tools/copy-assets.mjs copies board.html verbatim (tools/copy-assets.mjs:18), so no build change is needed."
    gotcha: "src/public/app.ts does not read or set any class on <body>, so no script breaks. Adding the class alone changes no rendering, because no rule references .board-page until task 1.2 lands."
    verify:
      - "grep -c '<body class=\"board-page\">' src/public/board.html — must return 1. At base_commit fcdd0da this returned 0."
      - "grep -c 'board-page' src/public/index.html — must return 0. This guard cannot fail at base_commit fcdd0da (it also returned 0 there); it exists to catch the wrong file being edited by this task, so record its result rather than skipping it."
      - "npm run build — must exit 0. Then grep -c 'board-page' dist/public/board.html must return 1. At base_commit fcdd0da, after a clean npm run build, that returned 0."
    checklist:
      - "Does src/public/board.html line 10 read exactly `<body class=\"board-page\">`?"
      - "Is src/public/index.html byte-for-byte unchanged?"
      - "Is src/public/board.html the only file this task changed?"
      - "Does npm run build still exit 0 and propagate the class into dist/public/board.html?"
      - "Does the board still render exactly as before, since no rule targets .board-page yet?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 1.2 Declare `--toolbar-h` and `--crumb-h` on `.board-page`
    ```yaml
    description: "Add the two layout custom properties that every sticky offset in stage 2 is computed from."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Edit src/public/styles.css only. The anchor is the '/* ---------- Toolbar (app chrome) ---------- */' section, whose explanatory comment ends on line 173 and whose first rule is `.toolbar {` on line 174."
      - "Insert a new `.board-page` rule immediately before the `.toolbar {` rule, so the stack constants sit at the head of the section they govern."
      - "The rule declares exactly two properties: `--toolbar-h: 44px` and `--crumb-h: 27px`. Add nothing else to it."
      - "Do not put these on :root. Per PLN-76-6ahcp5 'Contract: the two layout custom properties', the :root blocks are the chrome palette — the light one opens at src/public/styles.css:26 and the dark one, :root[data-theme=\"dark\"], at src/public/styles.css:91 — and the comment at src/public/styles.css:1-24 states a derivation rule that covers colour values only."
      - "Add a short comment above the rule stating that --toolbar-h must equal the `height` of `.toolbar` and --crumb-h must equal the height set on `.board-page .toolbar-crumb` in task 1.3, because the stage 2 offsets are calc() sums of the two."
      - "Do not change `.toolbar`'s existing `height: 44px` on line 176. --toolbar-h mirrors it; it does not replace it."
    pattern: "src/public/styles.css, toolbar section around lines 169-199"
    imports: "None. CSS custom properties only."
    compatibility: "Per PLN-76-6ahcp5 'Contract: the two layout custom properties'. --crumb-h is 27px, the smallest whole pixel that fits the bar's ~26.85px used height (an 18.85px line box from font-size 13px inheriting line-height 1.45, plus 8px of vertical padding). This arithmetic is settled; do not re-derive it."
    gotcha: "Declaring the properties on .board-page and not :root means index.html never resolves them. That is intended, because no rule on the home page uses them. A custom property declared but unused changes no rendering, so this task alone must be visually inert."
    verify:
      - "grep -cE '^\\.board-page \\{' src/public/styles.css — must return 1. At base_commit fcdd0da, grep -cE '^\\.board-page' src/public/styles.css returned 0."
      - "grep -c -- '--toolbar-h: 44px' src/public/styles.css — must return 1, and grep -c -- '--crumb-h: 27px' src/public/styles.css must return 1. Both returned 0 at base_commit fcdd0da."
      - "grep -c 'height: 44px' src/public/styles.css — must still return 1, confirming .toolbar's own height is untouched. It returned 1 at base_commit fcdd0da, so this step is a no-change guard, not a discriminator; record its result."
      - "npm run build — must exit 0. Then grep -c -- '--crumb-h' dist/public/styles.css must return at least 1. At base_commit fcdd0da that returned 0."
    checklist:
      - "Does the new rule use the selector `.board-page` and not `:root`?"
      - "Does it declare exactly `--toolbar-h: 44px` and `--crumb-h: 27px` and nothing more?"
      - "Does `--toolbar-h` equal the `height` value still declared on `.toolbar`?"
      - "Is `.toolbar`'s own `position: relative` and `height: 44px` unchanged by this task?"
      - "Does the board render identically to before, since no rule consumes the properties yet?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 1.3 Fix the board breadcrumb bar to one line at `--crumb-h`
    ```yaml
    description: "Give .board-page .toolbar-crumb a fixed height and flex-wrap: nowrap, so --crumb-h is the bar's real height and a long title can never wrap it onto a second line."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Edit src/public/styles.css only. The anchor is the `.toolbar-crumb {` rule that opens on line 195 and declares `flex-wrap: wrap` on line 196 and `min-height: 26px` on line 197."
      - "Leave that shared rule exactly as it is. src/public/index.html uses it and must keep min-height and wrap."
      - "Add a new rule `.board-page .toolbar-crumb` immediately after the shared rule's closing brace, declaring `height: var(--crumb-h)` and `flex-wrap: nowrap`."
      - "Add a short comment stating why both declarations are load-bearing: `height` makes --crumb-h the bar's real height rather than a floor, so no seam of scrolling content appears between the pinned rows; `nowrap` stops a long project title wrapping the bar taller than its declared offset."
      - "Do not add position, top or z-index here. Task 2.2 adds those to this same rule."
      - "Do not touch `.toolbar-sub` (the rule around line 217). It is out of scope and keeps its own min-height and wrap."
    pattern: "src/public/styles.css, immediately after the shared .toolbar-crumb rule (lines 195-199 at base_commit fcdd0da)"
    imports: "None. Consumes --crumb-h from task 1.2."
    compatibility: "Per PLN-76-6ahcp5 'Contract: the fixed breadcrumb height'. .tb-title already sets white-space: nowrap, overflow: hidden and text-overflow: ellipsis (src/public/styles.css:212), so a long title ellipsizes rather than clipping raggedly. The rule must not reach index.html."
    gotcha: "`height` alone does not stop wrapping — a wrapped second line would overflow the fixed box instead of growing it, which looks worse than the seam. Both declarations are required together. Also confirm the 27px value in the browser: if the measured content is taller, raise --crumb-h in task 1.2 to the smallest whole pixel that fits, and re-run this task's checks."
    verify:
      - "grep -cE '^\\.board-page \\.toolbar-crumb \\{' src/public/styles.css — must return 1. At base_commit fcdd0da, grep -cE '^\\.board-page' returned 0."
      - "grep -c 'height: var(--crumb-h)' src/public/styles.css — must return 1. At base_commit fcdd0da, grep -c 'height: var(' src/public/styles.css returned 0."
      - "grep -c 'flex-wrap: nowrap' src/public/styles.css — must return 2. At base_commit fcdd0da it returned 1 (the pre-existing declaration at line 657, unrelated to the toolbar)."
      - "grep -c 'min-height: 26px' src/public/styles.css — must still return 2, confirming the shared .toolbar-crumb rule and the out-of-scope .toolbar-sub rule both keep their min-height. It returned 2 at base_commit fcdd0da, so this is a no-change guard; record its result."
      - "npm run build — must exit 0."
    checklist:
      - "Is the shared `.toolbar-crumb` rule (min-height and flex-wrap: wrap) left byte-for-byte unchanged?"
      - "Does the new rule use the scoped selector `.board-page .toolbar-crumb`?"
      - "MANUAL: at a narrow viewport and with a project title long enough to overflow, does the board breadcrumb bar stay on one line and ellipsize the title, so the bar height never changes? (Acceptance criterion 7.)"
      - "MANUAL: does the board's chrome look identical to the current build at a wide and a narrow viewport, in both themes?"
      - "MANUAL: does the home page breadcrumb bar still wrap and still use min-height, unchanged? (Acceptance criterion 3.)"
      - "Is `.toolbar-sub` untouched by this task? (Acceptance criterion 2.)"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 2. Pin the stack

  ```yaml
  description: "Plan stage 2. Make .toolbar and .toolbar-crumb sticky on the board page with their offsets and z-index values, and move the .controls offset to the sum of the two."
  ```

  - [ ] 2.1 Make the board toolbar sticky at `top: 0`
    ```yaml
    description: "Add position: sticky, top: 0 and z-index: 7 to .board-page .toolbar, the top rung of the sticky ladder."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Edit src/public/styles.css only. The anchor is the shared `.toolbar {` rule opening on line 174, which declares `position: relative;` on line 175."
      - "Leave that shared rule's `position: relative` in place. src/public/index.html also carries a `.tb-mark` (src/public/index.html:14) whose absolute centring depends on `.toolbar` staying a positioned element, so removing the base declaration would break the home page."
      - "Add a new rule `.board-page .toolbar` after the shared rule, declaring `position: sticky`, `top: 0` and `z-index: 7`. Its higher specificity replaces `relative` with `sticky` on the board page only."
      - "Add a short comment noting that `sticky` is also a positioned value, so the toolbar remains the containing block for `.tb-mark` and the badge stays centred."
      - "Write `top: 0` as a literal here. It is the top of the stack, so it is a true zero and not a sum of anything above it."
      - "Do not add or change any background, border or shadow. .toolbar already paints an opaque --toolbar-bg."
    pattern: "src/public/styles.css, immediately after the shared .toolbar rule (lines 174-179 at base_commit fcdd0da)"
    imports: "None."
    compatibility: "Per PLN-76-6ahcp5 'Contract: the sticky ladder'. z-index descends down the stack — 7 here, 6 on the breadcrumb bar, 5 on .controls — so any sub-pixel rounding resolves in favour of the higher row."
    gotcha: "If the shared `position: relative` is deleted instead of overridden, the home page's .tb-mark loses its containing block and jumps to the page. The card detail modal is a <dialog> opened with showModal() (src/public/board.html:111) and paints in the browser top layer above every z-index, so no modal rule changes."
    verify:
      - "grep -cE '^\\.board-page \\.toolbar \\{' src/public/styles.css — must return 1. At base_commit fcdd0da, grep -cE '^\\.board-page' returned 0."
      - "grep -c 'z-index: 7' src/public/styles.css — must return 1. At base_commit fcdd0da it returned 0 (the file had exactly one z-index declaration in total, `z-index: 5` at line 330)."
      - "sed -n '/^\\.toolbar {/,/^}/p' src/public/styles.css | grep -c 'position: relative' — must still return 1, confirming the shared .toolbar rule keeps its relative positioning for index.html. It returned 1 at base_commit fcdd0da; this is a no-regression guard, so record its result. The rule block is selected by name, not by line number, because task 1.2 inserts a comment and a .board-page rule immediately above it and shifts every fixed line range in this section."
      - "npm run build — must exit 0."
    checklist:
      - "Does the shared `.toolbar` rule still declare `position: relative` for the home page?"
      - "Does the new rule declare `position: sticky`, `top: 0` and `z-index: 7` under the `.board-page` scope?"
      - "MANUAL: does the centred `.tb-mark` badge stay horizontally centred at every scroll position, at every viewport width above 520px? (Acceptance criterion 6.)"
      - "MANUAL: is the pinned toolbar fully opaque in the light theme and the dark theme, with no board content showing through? (Acceptance criterion 4.)"
      - "MANUAL: does the home page toolbar still scroll away? (Acceptance criterion 3.)"
      - "MANUAL: does a card detail modal opened with showModal() still paint above the pinned toolbar? (Acceptance criterion 8.)"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 2.2 Make the board breadcrumb bar sticky at `top: var(--toolbar-h)`
    ```yaml
    description: "Add position: sticky, top: var(--toolbar-h) and z-index: 6 to the .board-page .toolbar-crumb rule created in task 1.3."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Edit src/public/styles.css only. The anchor is the `.board-page .toolbar-crumb` rule that task 1.3 added after the shared `.toolbar-crumb` rule. Read it as it stands before editing."
      - "Extend that same rule — do not open a second one for the same selector — with `position: sticky`, `top: var(--toolbar-h)` and `z-index: 6`."
      - "Write the offset as var(--toolbar-h), never as the literal 44px. Per PLN-76-6ahcp5 'Contract: the two layout custom properties', every offset is expressed over the properties so a height change moves the stack in one place."
      - "Leave the height and flex-wrap declarations from task 1.3 in place. They are what makes this offset arithmetic true."
      - "Do not touch the shared `.toolbar-crumb` rule, and do not touch `.toolbar-sub`."
    pattern: "src/public/styles.css, the .board-page .toolbar-crumb rule added by task 1.3"
    imports: "None. Consumes --toolbar-h from task 1.2."
    compatibility: "Per PLN-76-6ahcp5 'Contract: the sticky ladder'. z-index 6 sits below the toolbar's 7 and above .controls' 5. The bar already paints an opaque --tile-bg, so no colour, token or media query is added."
    gotcha: "A gap or overlap between the toolbar and the breadcrumb bar means --toolbar-h no longer matches .toolbar's real height. Fix the property in task 1.2, not this offset. Depends on task 1.3 having landed first, because this rule extends the rule that task created."
    verify:
      - "grep -c 'top: var(--toolbar-h)' src/public/styles.css — must return 1. At base_commit fcdd0da, grep -c -- '--toolbar-h' src/public/styles.css returned 0."
      - "grep -c 'z-index: 6' src/public/styles.css — must return 1. At base_commit fcdd0da it returned 0."
      - "grep -c 'position: sticky' src/public/styles.css — must return 3 once tasks 2.1, 2.2 and the pre-existing .controls rule are all present. At base_commit fcdd0da it returned 1 (.controls only)."
      - "grep -cE '^\\.board-page \\.toolbar-crumb \\{' src/public/styles.css — must still return 1, confirming the selector was extended and not duplicated."
      - "npm run build — must exit 0."
    checklist:
      - "Is the offset written as `var(--toolbar-h)` rather than a literal pixel value?"
      - "Is there exactly one `.board-page .toolbar-crumb` rule in the file?"
      - "Are the `height: var(--crumb-h)` and `flex-wrap: nowrap` declarations from task 1.3 still present in it?"
      - "MANUAL: does the pinned breadcrumb bar sit directly beneath the toolbar with no gap and no overlap, at every scroll position? (Acceptance criterion 1.)"
      - "MANUAL: is the pinned breadcrumb bar fully opaque in both themes? (Acceptance criterion 4.)"
      - "MANUAL: does the home page breadcrumb bar still scroll away? (Acceptance criterion 3.)"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 2.3 Move the `.controls` offset to the sum of the two rows above it
    ```yaml
    description: "Change .controls' sticky top from 0 to calc(var(--toolbar-h) + var(--crumb-h)), so the sort/filter bar pins beneath the two rows above it."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Edit src/public/styles.css only. The anchor is the `.controls {` rule opening on line 320, which declares `position: sticky;` on line 328, `top: 0;` on line 329 and `z-index: 5;` on line 330."
      - "Change only the `top` value, from `0` to `calc(var(--toolbar-h) + var(--crumb-h))`."
      - "Leave `position: sticky` and `z-index: 5` exactly as they are. Per PLN-76-6ahcp5 'Out of scope', no other change to .controls is permitted."
      - "Leave the selector unscoped. `.controls` exists only in src/public/board.html, so it needs no .board-page prefix, and adding one would be a change the plan does not ask for."
      - "Add a short comment stating that the offset is the sum of the two pinned rows above, and that it must stay a calc() over the properties rather than a literal number."
    pattern: "src/public/styles.css, the .controls rule at lines 320-331 at base_commit fcdd0da"
    imports: "None. Consumes --toolbar-h and --crumb-h from task 1.2."
    compatibility: "Per PLN-76-6ahcp5 'Contract: the sticky ladder'. .controls is the last row in the stack, so its own height may grow when the filter chips row is shown without any offset needing to change."
    gotcha: ".controls resolves the two properties through inheritance from body.board-page. If task 1.1 has not landed, the calc() resolves to nothing and the bar falls back to its initial `top: auto`, which silently unpins it. Verify task 1.1 is applied before checking this one."
    verify:
      - "grep -c 'top: calc(var(--toolbar-h) + var(--crumb-h))' src/public/styles.css — must return 1. At base_commit fcdd0da it returned 0."
      - "sed -n '/^\\.controls {/,/^}/p' src/public/styles.css | grep -c 'top: 0;' — must return 0. At base_commit fcdd0da it returned 1, the .controls declaration at line 329. The check is scoped to the .controls rule block because task 2.1 adds its own `top: 0` to .board-page .toolbar, and a file-wide grep would then measure that task's formatting instead of this task's change."
      - "sed -n '/^\\.controls {/,/^}/p' src/public/styles.css | grep -c 'z-index: 5' — must return 1, and the same range must still contain `position: sticky`. Both held at base_commit fcdd0da, so these are no-change guards; record their results."
      - "npm run build — must exit 0. Then grep -c 'top: calc(var(--toolbar-h) + var(--crumb-h))' dist/public/styles.css must return 1. At base_commit fcdd0da that returned 0."
    checklist:
      - "Is `top` the only declaration changed inside the `.controls` rule?"
      - "Are `position: sticky` and `z-index: 5` still present and unchanged?"
      - "Is the offset a calc() over the two custom properties rather than a literal pixel sum?"
      - "MANUAL: at any scroll position are `.toolbar`, `.toolbar-crumb` and `.controls` all visible and stacked in that order, with no gap and no overlap, in both themes, at a wide and a narrow viewport, with the filter chips row both hidden and shown? (Acceptance criteria 1 and 5.)"
      - "MANUAL: do `.toolbar-sub`, the update banner and the KPI strip stay in normal flow and scroll out of view beneath the pinned stack, with their own position, spacing and styling unchanged? (Acceptance criterion 2.)"
      - "Does git diff --stat show only src/public/board.html and src/public/styles.css changed across the whole workstream, with src/public/index.html untouched? (Acceptance criterion 3.)"
    self_eval:
      passed: false
      failures: []
    ```

## Divergences

1. **The project declares no test command.** The plan's testing strategy and the briefing both
   call for running the repository's existing `node:test` suites as a verify step. In fact
   `package.json` at base_commit `fcdd0da` declares no `test` script at all — its scripts are
   `build:base`, `build`, `build:release`, `prestart`, `start`, `start:lan`, `prerefresh`,
   `refresh`, `electron:dev`, `package:mac`, `package:linux` and `package:win`. The suites
   exist only as compiled files under `dist/`, run by hand. Invoking them at base_commit as
   `node --test 'dist/**/*.test.js'` ran past 300 seconds without completing, which makes them
   unusable as a task verify step. Every task therefore uses `npm run build` as its project
   command instead, which completed in about 1.6 seconds at base_commit and exercises the same
   `tools/copy-assets.mjs` path that carries `styles.css` and `board.html` into `dist/public/`.
   No task was dropped for this reason.

2. **`.tb-mark` exists on the home page too.** The plan states that `.toolbar`'s
   `position: relative` is "replaced, not supplemented" (PLN-76-6ahcp5, 'Contract: the sticky
   ladder'), which reads as an instruction to remove the declaration. `src/public/index.html:14`
   carries its own `.tb-mark` image, so deleting `position: relative` from the shared
   `.toolbar` rule would break the badge centring on the home page and violate the plan's own
   acceptance criterion 3. Task 2.1 therefore keeps the shared declaration and overrides it
   with the more specific `.board-page .toolbar` rule, which is the reading consistent with the
   rest of the plan.

Every other file the plan cites — `src/public/styles.css`, `src/public/board.html`,
`tools/copy-assets.mjs` and `tools/bundle-public.mjs` — matched the plan's description at
base_commit `fcdd0da`, including the line numbers it quotes.

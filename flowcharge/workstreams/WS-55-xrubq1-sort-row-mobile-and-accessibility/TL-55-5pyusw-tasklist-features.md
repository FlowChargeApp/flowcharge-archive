---
id: TL-55-5pyusw
type: tasklist
workstream: WS-55-xrubq1
slug: sort-row-mobile-and-accessibility
title: "Accessible sort controls and a mobile select and icon toggle"
status: ready
created: 2026-08-21
updated: 2026-08-31
author: Anthony Koukoullis
depends_on: [PLN-45-xh9o61, TL-54-w3me1p]
links: []
mode: spec
base_commit: fe1e9c9
---

# PRX Tasks

## Accessible sort controls and a mobile select and icon toggle

This task list implements `PLN-45-xh9o61` in the plan's own four phases. It adds two
features to the board's sort row.

Feature 1 makes the sort state readable by assistive technology. The seven segment
buttons in `src/public/board.html` lines 61-71 carry `aria-pressed`, the sort block
becomes a group named `Sort`, `#sort-dir-seg` becomes a group named `Sort direction`,
and the severity colour dot becomes `aria-hidden`.

Feature 2 gives viewports of 880px or less a native `<select>` for the sort key and a
single icon button for the sort direction. Both control variants stay in the DOM at the
same time. CSS `display: none` at the existing 880px breakpoint shows exactly one
variant, which removes the other from the tab order and from the accessibility tree at
the same moment. `display: none` is required here, not preferred: `visibility: hidden`
and off-screen positioning both leave one variant behind.

Every sort change routes through two new functions, `applySortKey(key)` and
`applySortDir(dir)`. Each function owns every side effect of a sort change: the module
variable, the button classes, the ARIA attributes, the select value, the icon state, and
the `renderBoard()` call. There is therefore no second synchronisation path that can
drift, and the two variants cannot disagree.

Three files change, and no others: `src/public/board.html`, `src/public/styles.css`, and
`src/public/app.ts`. There is no server change, no API change, no data-model change, and
no new dependency. Sort state stays in the two module variables at `src/public/app.ts`
lines 47-48 and dies with the page, exactly as today.

**Execution gate.** `TL-54-w3me1p` must land first. It adds three wrap declarations
inside the existing `@media (max-width: 880px)` block. Every anchor in this file was
re-read at `base_commit` `fe1e9c9`, which is before that task list executed. Each task
that touches the 880px block says where its anchor is expected to have moved.

**Settled decisions**, recorded so no task re-opens them. The severity option reads
`Severity (worst open)`. The direction button's `aria-label` names the current state,
`Sort ascending` or `Sort descending`, not the action the click performs. The arrow swap
carries no transition, so nothing needs `prefers-reduced-motion` gating. The three wrap
rules from `TL-54-w3me1p` stay in the file after phase 4, even though they become inert;
removing them belongs to that task list's own decision. `npm start` is the release
target; phases 3 and 4 each carry one `npm run electron:dev` parity check as verification
only, and no packaging step is added anywhere.

**Out of scope**, per the plan. No new sort key and no change to the comparator at
`src/public/app.ts` lines 447-455. No persistence of sort state to a URL parameter or to
storage. The filter row, the filter chips, and every part of WS-56. `#integrations-scope-seg`
in `src/public/index.html` line 64, and `#theme-seg`, the toolbar theme switch, which also
carries `class="seg"` at `src/public/board.html` line 15 and `src/public/index.html`
line 16. Keyboard-navigation JavaScript for the segmented controls. A `radiogroup` /
`role="radio"` pattern. Any new breakpoint. A browser-side test harness.

- [ ] 1. Phase 1 — Accessibility on the existing sort controls

  ```yaml
  description: "Make the existing sort controls readable by assistive technology: aria-pressed on all seven segment buttons, a named group for the sort block and for the direction segment, a styled replacement for the invalid Sort label, and aria-hidden on the severity dot. Child order is markup, then CSS, then script, because task 1.2 restores the styling that task 1.1 removes from the Sort label."
  ```

  - [ ] 1.1 Add the ARIA group, the group label, and the starting `aria-pressed` values to `board.html`

    ```yaml
    description: "In src/public/board.html, add role=group and an accessible name to the sort block and to the direction segment, replace the invalid Sort label with a styleable span, and ship the correct starting aria-pressed value on each of the seven segment buttons."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Work only inside the `.controls` block at src/public/board.html lines 58-72. Do not edit line 79's `<label>Filter</label>`. That row belongs to WS-56 and must render exactly as it does today."
      - "Anchor: the `<div class=\"group\">` opening tag at line 59, the only occurrence of that bare class in the file. Give it `role=\"group\"` and `aria-labelledby=\"sort-group-label\"`, so the block reports itself as a group with the accessible name `Sort`."
      - "Anchor: `<label>Sort</label>` at line 60. Replace the whole element with a span that carries the class `group-label` and the id `sort-group-label`, keeping the visible text `Sort` byte-for-byte. The `<label>` is invalid today: it has no `for` attribute and it wraps no control. The id is what the `aria-labelledby` above resolves against."
      - "Anchor: the `<div class=\"seg\" id=\"sort-dir-seg\">` opening tag at line 68. Add `role=\"group\"` and `aria-label=\"Sort direction\"`."
      - "Give every one of the seven segment buttons a starting `aria-pressed` attribute. The button at line 62 with `data-key=\"id\"` and the button at line 69 with `data-dir=\"asc\"` get `\"true\"`. The other five get `\"false\"`. Those two values must match the `class=\"active\"` already present on exactly those two buttons."
      - "Do not touch the toolbar theme switch `#theme-seg` at lines 15-25. It also carries `class=\"seg\"` and it already ships `role=\"group\" aria-label=\"Theme\"` and per-button `aria-label` values. It is out of scope. See Divergence 3."
      - "Ship the starting state in the markup only, exactly as the tablist at lines 139-142 already ships `aria-selected` and its roving `tabindex`. Do not add any startup script call that would set these values instead. This is plan assumption A6: the apply functions added in phase 2 call `renderBoard()`, so calling one at startup would erase the `Loading this project…` block at lines 87-90 before the fetch resolves."
      - "Add no `style=\"…\"` attribute. The Content-Security-Policy at src/server.ts lines 47-50 sets `style-src 'self'` with no `'unsafe-inline'`, so an inline style attribute is blocked. All styling for the new span lands in task 1.2."
    pattern: "src/public/board.html lines 58-72 only. Read-only references in the same file: line 79 (the Filter label, which must stay untouched), lines 15-25 (the toolbar theme switch, also untouched), and lines 139-142 (the tablist, the project's existing pattern for shipping initial ARIA state in markup)."
    imports: "None. Plain HTML attributes only. No script tag, no stylesheet link, and no package."
    compatibility: "role=group with aria-labelledby / aria-label plus aria-pressed is the settled ARIA pattern for this workstream. A radiogroup with role=radio and a roving tabindex was considered and rejected, because it needs new keyboard-navigation JavaScript and it changes the tab order that ISS-20-en7s3l's fix was verified against. The tab order must stay exactly as it is after TL-54-w3me1p lands. The new `group-label` class has no CSS rule until task 1.2, so run these two tasks together. tools/copy-assets.mjs copies board.html into dist/, so no edit reaches the served page before npm run build."
    gotcha: "Four traps. First, between this task and task 1.2 the `Sort` text renders unstyled, because `.controls label` at styles.css line 333 no longer matches it. That is expected and task 1.2 closes it; do not fix it by keeping the `<label>`. Second, aria-pressed=\"true\" must land on the same two buttons that already carry class=\"active\", or the page ships in a state the phase 1 verify step fails on immediately. Third, do not add aria-pressed to any button outside these two segments — that now matters more than it did, because #theme-seg's three buttons are also `.seg` buttons on this same page. Fourth, the severity button at line 64 gains a child span at runtime from renderSeverity(); adding the attribute to the button element itself is unaffected by that injection."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "Serve the page with `npm start`, open the board at 1280px, and run `document.querySelectorAll('#sort-key-seg button[aria-pressed]').length` in the console. Confirm it is 5. Run the same query on `#sort-dir-seg` and confirm it is 2."
      - "Run `document.querySelectorAll('#sort-key-seg [aria-pressed=\"true\"]').length` and confirm it is 1. Run the same query on `#sort-dir-seg` and confirm it is 1."
      - "Run `document.querySelectorAll('#theme-seg button[aria-pressed]').length` and confirm it is 0, proving no attribute leaked onto the toolbar switch."
      - "Confirm the single `aria-pressed=\"true\"` button in each segment is the same button that carries `class=\"active\"`."
      - "Open the browser's accessibility tree and confirm it shows a group with the accessible name `Sort` and a group with the accessible name `Sort direction`."
      - "Confirm `grep -c 'style=' src/public/board.html` reports no new inline style attribute, and that the browser console shows no CSP violation."
    checklist:
      - "Do exactly seven segment buttons carry aria-pressed, with exactly one \"true\" per segment, on the same buttons that carry class=\"active\"?"
      - "Does the sort block report as a group named `Sort`, and `#sort-dir-seg` as a group named `Sort direction`?"
      - "Has the bare `<label>Sort</label>` been replaced by a span carrying both the `group-label` class and the `sort-group-label` id?"
      - "Is `src/public/board.html` line 79's `<label>Filter</label>` byte-for-byte unchanged, and is `#theme-seg` at lines 15-25 unchanged?"
      - "Does the tab order through the controls row match the pre-change build, with no new or removed tab stop?"
      - "Were zero inline `style=` attributes added, and does the console show no CSP violation?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 1.2 Widen the `.controls label` rule so it also styles the new group label

    ```yaml
    description: "In src/public/styles.css, extend the .controls label selector list to also match .controls .group-label, so the new Sort span renders in the same font, size, colour, and letter spacing as before, while the WS-56 Filter label keeps the identical declarations it has today."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the `.controls label {` rule that opens at src/public/styles.css line 333 and closes at line 339. It sets font-family, font-size, text-transform, letter-spacing, and color."
      - "Widen the selector by appending, so it reads `.controls label, .controls .group-label {`. Leave all five declarations inside the block byte-for-byte unchanged."
      - "Widening rather than replacing is load-bearing. src/public/board.html line 79 still holds a bare `<label>Filter</label>` that this rule styles, and that row belongs to WS-56. Replacing the selector would restyle it."
      - "Change nothing else in this file in this task. The remaining CSS work for this feature belongs to tasks 3.3 and 4.3."
    pattern: "src/public/styles.css, the single rule at lines 333-339. Read-only references: src/public/board.html line 60 (the span added in task 1.1) and line 79 (the Filter label)."
    imports: "None. No custom property, no @import, and no new file."
    compatibility: "A comma-appended selector cannot change what the existing match receives, because both selectors resolve to the same declaration block. `.controls` exists only on the board page, so this rule cannot reach src/public/index.html, including `#integrations-scope-seg` at line 64. It also cannot reach `#theme-seg` on either page, because that element sits in `.toolbar`, not in `.controls`. Specificity rises from 0-1-1 to 0-2-0 for the new half only, which is above the class-only rules around it and below any id rule, so nothing that styles the Filter label today is displaced. tools/copy-assets.mjs copies styles.css into dist/, so the change reaches the served page only after npm run build."
    gotcha: "Three traps. First, do not replace `.controls label` with `.controls .group-label`; the Filter label depends on the original selector and is out of scope to change. Second, do not add a separate duplicate rule block for `.group-label`, which would create a second place to edit the same five declarations. Third, this file already holds two width breakpoints, `@media (max-width: 520px)` at line 190 and `@media (max-width: 880px)` at line 535, plus one prefers-reduced-motion query at line 601; do not add a fourth media query here. See Divergence 2."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "Open the board at 1280px and confirm the `Sort` text renders in the same font, size, colour, letter spacing, and uppercase transform as the pre-change build."
      - "Confirm the `Filter` label is visually identical to the pre-change build. Reveal it by typing a query that produces filter chips, or by clearing the `hidden` attribute on `#filter-chips` in the inspector."
      - "In the inspector, select the `Sort` span and confirm the computed font-family, font-size, letter-spacing, text-transform, and color match those computed on the `Filter` label."
      - "Confirm `grep -n '@media' src/public/styles.css` still reports exactly three media queries: the 520px one, the 880px one, and the prefers-reduced-motion one."
    checklist:
      - "Does `.controls .group-label` receive the same five declarations as `.controls label`, from one shared rule block rather than a duplicate?"
      - "Is the rendered `Filter` label visually identical to the pre-change build?"
      - "Does the `Sort` text render identically to how the old `<label>Sort</label>` rendered?"
      - "Were zero declarations inside the rule block changed?"
      - "Was no new media query and no new rule block added by this task?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 1.3 Move `aria-pressed` with the `active` class in both click handlers, and hide the severity dot

    ```yaml
    description: "In src/public/app.ts, set aria-pressed in the same loop body that already toggles the active class in both sort click handlers, so the two can never disagree, and mark the injected severity dot aria-hidden so the button announces as Severity."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the `byId('sort-key-seg').addEventListener('click', …)` handler that opens at src/public/app.ts line 477. Its body reads `sortKey = btn.dataset.key;` then `this.querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b === btn); });` then `renderBoard();`."
      - "Inside that forEach body, compute the on-state once and use it for both writes. Illustrative only, not literal: `var on = b === btn; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false');`. One loop body sets both, so the class and the ARIA state are structurally unable to drift. This is the invariant style the project already documents for selectTab() at lines 553-556."
      - "Anchor: the `byId('sort-dir-seg').addEventListener('click', …)` handler that opens at line 484. Apply the same change to its forEach body."
      - "Keep the object-identity comparison `b === btn` in both handlers at this phase. Phase 2 changes it to a dataset comparison; changing it here would make this task's regression check ambiguous."
      - "Anchor: `dot = el('span', 'dot-sm');` at line 1403, inside the `renderSeverity()` IIFE that opens at line 1392. Immediately after that line, and before the `sevBtn.insertBefore(dot, sevBtn.firstChild);` call on line 1404, set `aria-hidden=\"true\"` on the dot. A screen reader then announces the button as `Severity` and not as an unnamed image."
      - "Leave `dot.style.background` at line 1408 and `sevBtn.title` at line 1409 alone. That CSSOM write is not governed by the CSP and it keeps working."
      - "Do not add the aria-hidden attribute anywhere else, and do not change what renderSeverity() computes or when it runs."
    pattern: "src/public/app.ts, the two click handlers at lines 477-491 and the dot creation at line 1403. Read-only reference: selectTab() at lines 559-575, the existing one-loop-body invariant pattern."
    imports: "None. src/public/tsconfig.json sets \"module\": \"esnext\" with \"moduleResolution\": \"bundler\" and \"noEmit\": true, and tools/bundle-public.mjs bundles the module graph with esbuild, so an import is now technically possible. This task needs none and must add none. See Divergence 4."
    compatibility: "src/public/tsconfig.json sets \"strict\": true and \"noEmit\": true, so tsc is a type-check gate ahead of the esbuild bundle and a type error exits non-zero and stops the build chain. `b` inside the forEach is HTMLButtonElement and `dot` is HTMLElement, so setAttribute needs no cast. `btn.dataset.key` stays `string | undefined` and `sortKey` / `sortDir` stay declared `string | undefined` at lines 47-48; this task changes neither declaration. The starting aria-pressed values ship in board.html from task 1.1, so these handlers only handle changes."
    gotcha: "Four traps. First, do not add a second forEach pass for aria-pressed. A second loop is exactly the drift this invariant exists to prevent. Second, aria-pressed takes the strings \"true\" and \"false\", never a boolean and never attribute removal; removing it would make the button announce as an ordinary button. Third, renderSeverity() creates the dot only when a dominant severity exists and only after the fetch resolves, so verify this with a project loaded that has at least one open issue. Fourth, the dot span holds no text, so adding aria-hidden cannot change sevBtn.textContent, which task 3.2 later reads to build the option labels."
    verify:
      - "Run `npm run build` and confirm it exits zero. That script runs build:base — three tsc passes and node tools/copy-assets.mjs — and then node tools/bundle-public.mjs, the esbuild bundling step."
      - "Open the board and click each of the five sort keys in turn. After each click confirm `document.querySelectorAll('#sort-key-seg [aria-pressed=\"true\"]').length` is 1, and that the button holding it is the one holding `class=\"active\"`."
      - "Click both `Asc` and `Desc` and confirm the same two properties hold for `#sort-dir-seg`, and that the board re-sorts on each click."
      - "With a project loaded that has at least one open issue, confirm the severity button announces as `Severity` in the accessibility tree and that the dot is not announced."
      - "Inspect the injected dot and confirm it carries `aria-hidden=\"true\"` and still carries its `background` style from the CSSOM write."
      - "Confirm the console shows no CSP violation and no type or runtime error."
    checklist:
      - "Does one loop body set both `classList.toggle('active', on)` and `setAttribute('aria-pressed', …)` in each handler, with no second pass?"
      - "After clicking every key and both directions, does exactly one button per segment hold aria-pressed=\"true\", always the button holding class=\"active\"?"
      - "Does the injected severity dot carry aria-hidden=\"true\", and does the severity button announce as `Severity`?"
      - "Does the board still re-sort correctly on every key and both directions?"
      - "Do `sortKey` and `sortDir` at lines 47-48 keep their existing `string | undefined` declarations?"
      - "Does `npm run build` exit zero with strict type-checking unchanged, and were zero imports added to src/public/app.ts?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 2. Phase 2 — Extract `applySortKey` and `applySortDir`, with no behaviour change

  ```yaml
  description: "In src/public/app.ts, add applySortKey(key) and applySortDir(dir) to the IIFE scope and move each click handler's body into them, leaving each handler as a guard plus one call. This phase is a single file and a single coherent change, so it is an adult task with no children. It has no user-visible effect on purpose: it is the contract that phases 3 and 4 both build against, and cutting it would mean writing the synchronisation twice and then deleting one copy."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Anchor: the sort variables `var sortKey: string | undefined = 'id';` and `var sortDir: string | undefined = 'asc';` at src/public/app.ts lines 47-48, and the two click handlers at lines 477-491. Declare both new functions in the same IIFE scope as those variables and before the listeners at line 477."
    - "Add `function applySortKey(key: string): void`. It does exactly five things, in this order: assign `sortKey = key;`; loop every `button` inside `#sort-key-seg` computing `var on = b.dataset.key === key;` and setting `b.classList.toggle('active', on)` and `b.setAttribute('aria-pressed', on ? 'true' : 'false')` in the same loop body; set the mobile select's value, which is deferred to task 3.2 because the select does not exist yet; touch nothing that belongs to the direction; and call `renderBoard()`."
    - "Add `function applySortDir(dir: string): void` mirroring it against `#sort-dir-seg` and `b.dataset.dir`. Its icon-button work is deferred to task 4.2."
    - "Give each function a short comment saying it is the only writer of its module variable after startup, and that the desktop buttons, the mobile select, and any future caller all route through it so no two controls can disagree."
    - "Change the comparison from object identity to a dataset comparison. The handlers today compare `b === btn` at lines 482 and 489. The apply functions must compare `b.dataset.key === key` and `b.dataset.dir === dir` instead, because a later caller is the select's change event, which has no button to compare against. The two forms are equivalent for a button click, because each data-key and each data-dir value appears exactly once in board.html."
    - "Reduce each click handler to a guard plus one call. Keep the existing `closest('button')` early return, then add an early return when the dataset value is absent, then call the apply function. Illustrative only, not literal: `var key = btn.dataset.key; if (!key) return; applySortKey(key);`."
    - "The dataset guard is required, not defensive style: `btn.dataset.key` is `string | undefined` and src/public/tsconfig.json sets \"strict\": true, so passing it straight into a `string` parameter fails the type-check gate."
    - "Call neither function at startup. Plan assumption A6: board.html ships the initial state, and calling either function during startup would run renderBoard() and erase the `Loading this project…` block at board.html lines 87-90 before the fetch resolves."
    - "Leave the comparator at lines 447-455 untouched. It stays the only place that reads sortKey and sortDir for sorting. The apply functions know which controls display the sort state; they do not know how the board is sorted."
    - "Scope both segment queries by id, `#sort-key-seg` and `#sort-dir-seg`. Do not select by a bare `.seg` or `.seg button` selector: the toolbar theme switch `#theme-seg` also carries `class=\"seg\"` on this same page. See Divergence 3."
  pattern: "src/public/app.ts only. Nothing else changes in this phase — src/public/board.html and src/public/styles.css are untouched. Read-only references: the comparator at lines 447-455, and selectTab() at lines 559-575 for the one-loop-body invariant style."
  imports: "None. Both functions use only byId, querySelectorAll, classList, setAttribute, and the existing renderBoard(). An import is now technically possible under \"module\": \"esnext\" plus esbuild bundling, but none is needed and none may be added. See Divergence 4."
  compatibility: "Function declarations in the IIFE scope hoist, so placing them before line 477 is a readability choice rather than a requirement, but keep them there for the reader. \"strict\": true plus the tsc type-check gate means the string | undefined handling around dataset.key and dataset.dir is caught at build time. The `string | undefined` declarations of sortKey and sortDir at lines 47-48 do not need to change: assigning a `string` parameter to them is valid. The apply functions must preserve the aria-pressed behaviour task 1.3 added, because phase 1's checks are re-run here unchanged."
  gotcha: "Five traps. First, this phase must have no user-visible change; any behaviour difference is a defect, not an improvement. Second, do not call the apply functions at startup, for the reason in the implement steps. Third, do not let either function touch the other's variable or segment; the plan states applySortKey touches nothing belonging to the direction. Fourth, `this` inside the old handlers referred to the segment element; the apply functions are not handlers, so they must select their segment by id instead of relying on `this`. Fifth, keep renderBoard() as the last statement of each function, so callers never have to remember to re-render."
  verify:
    - "Run `npm run build` and confirm it exits zero."
    - "Confirm the build catches nothing that was silently ignored: check that each click handler contains an early return before its apply call, so no `string | undefined` value is passed into a `string` parameter."
    - "Re-run every phase 1 check unchanged. Click all five sort keys and both directions, and confirm the board re-sorts each time and that both the `active` class and `aria-pressed=\"true\"` move exactly as before."
    - "Confirm `document.querySelectorAll('#sort-key-seg [aria-pressed=\"true\"]').length` stays 1 after every click, and the same for `#sort-dir-seg`."
    - "Confirm clicking the toolbar theme switch still works and that its buttons gained no aria-pressed attribute."
    - "Confirm the page still shows the `Loading this project…` block before the fetch resolves, by throttling the network or reloading with the server slow to answer."
    - "Confirm `git diff --name-only` lists only src/public/app.ts for this task."
  checklist:
    - "Do applySortKey and applySortDir exist in the IIFE scope, declared before the listeners at line 477, and is each the only writer of its module variable after startup?"
    - "Does each function set the class and aria-pressed in one shared loop body, and end with renderBoard()?"
    - "Do both functions compare `b.dataset.key === key` and `b.dataset.dir === dir` rather than object identity, and do both scope their query by segment id rather than by a bare `.seg` selector?"
    - "Does each click handler consist of the closest() guard, a dataset guard, and one apply call, with no synchronisation logic left in it?"
    - "Is neither function called at startup, and does the `Loading this project…` block still appear before the fetch resolves?"
    - "Is the behaviour identical to phase 1 in every phase 1 check, and is src/public/app.ts the only changed file?"
  self_eval:
    passed: false
    failures: []
  ```

- [ ] 3. Phase 3 — Mobile sort-key select

  ```yaml
  description: "Add a native <select> for the sort key that replaces #sort-key-seg at 880px and below. Child order is markup, then script, then CSS, so that at every child boundary the select is either absent or fully populated and functional; landing the CSS swap first would briefly leave mobile viewports with no sort-key control at all."
  ```

  - [ ] 3.1 Add the empty `<select id="sort-key-select">` to `board.html`

    ```yaml
    description: "In src/public/board.html, add an empty native select for the sort key as a sibling inside the sort group, shipped with no options because task 3.2 builds them from the buttons at startup."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the closing `</div>` of `<div class=\"seg\" id=\"sort-dir-seg\">`, which opens at src/public/board.html line 68 and closes at line 71, inside the `.group` block that task 1.1 gave `role=\"group\"`."
      - "Immediately after that closing tag, and still inside `.group`, add `<select id=\"sort-key-select\" aria-label=\"Sort by\"></select>`."
      - "Ship it with no option elements at all. The five options are built at startup in task 3.2 from the five buttons of `#sort-key-seg`, so the four unchanged labels have exactly one source of truth. Hard-coding the labels here would create a second source that drifts the first time a label is reworded."
      - "`aria-label=\"Sort by\"` is the select's accessible name. Do not add a visible `<label>` for it; the `Sort` group label already names the block, and a second visible label would change the row's layout."
      - "Do not touch `#sort-key-seg` at lines 61-67, `#sort-dir-seg` at lines 68-71, the `Filter` label at line 79, or `#theme-seg` at lines 15-25. Both sort segments stay in the DOM; the variants are swapped by CSS in task 3.3, never by removing markup."
      - "Add no `style=\"…\"` attribute, for the CSP reason in task 1.1. All styling lands in task 3.3."
    pattern: "src/public/board.html, one added line inside the `.group` block at lines 58-72. Read-only references: lines 61-67 (the five buttons whose labels and data-key values the select mirrors) and line 79 (the Filter label, unchanged)."
    imports: "None. One native HTML element and two attributes."
    compatibility: "A real native `<select>` is required, not a restyled `.seg`. A `<div class=\"seg\">` cannot become a native picker, which is the whole point of the mobile variant on a phone. The element renders visible on every viewport until task 3.3 adds `display: none` as its desktop default, so run 3.1, 3.2, and 3.3 together. The element must sit inside `.group`, because every new CSS rule for it is written under `.controls` or an id and the 880px swap rules assume it is a sibling of the two segments."
    gotcha: "Three traps. First, do not give the select a `name` or wrap it in a `<form>`; nothing here submits. Second, an empty select renders as a narrow empty box between this task and task 3.2, which is expected. Third, do not add `hidden` to it as a stand-in for the desktop default: `hidden` cannot be overridden cleanly by the 880px `display` rule, and the plan's swap is a CSS `display` swap on both variants."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "Open the board and confirm `document.getElementById('sort-key-select')` returns the element and that it is a direct child of the `.group` block, after `#sort-dir-seg`."
      - "Confirm `document.querySelectorAll('#sort-key-select option').length` is 0 at this task, and that its accessible name reads `Sort by` in the accessibility tree."
      - "Confirm `#sort-key-seg` and `#sort-dir-seg` are both still present in the DOM and both still work."
      - "Confirm the console shows no CSP violation."
    checklist:
      - "Does `#sort-key-select` exist inside `.group`, immediately after `#sort-dir-seg`, with `aria-label=\"Sort by\"`?"
      - "Does it ship with zero option elements and no `name`, no `hidden`, and no inline style?"
      - "Are both `#sort-key-seg` and `#sort-dir-seg` still present in the markup and unmodified by this task?"
      - "Is `src/public/board.html` line 79's `<label>Filter</label>` still unchanged, and is `#theme-seg` untouched?"
      - "Does `npm run build` exit zero?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 3.2 Build the select's options, extend `applySortKey`, and bind its `change` event

    ```yaml
    description: "In src/public/app.ts, build the select's five options from the five sort-key buttons at startup with a named severity override, extend applySortKey to set the select's value, and route the select's change event through applySortKey."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the top-level listener block in src/public/app.ts, where `byId('sort-key-seg').addEventListener('click', …)` opens at line 477 and `byId('search').addEventListener('input', …)` opens at line 492."
      - "Add a per-key label override map beside the new code. Illustrative only, not literal: `var SORT_KEY_OPTION_LABEL: Record<string, string> = { severity: 'Severity (worst open)' };`. This is the one label that must differ from its button, and it differs in one visible, named place. The wording is settled; do not shorten it to `Severity` and do not reword it to `Worst open severity`."
      - "After the two sort click listeners are bound, loop the five buttons of `#sort-key-seg` in document order. For each button create an `<option>` whose value is `b.dataset.key` and whose text is the override from the map when one exists, otherwise `b.textContent`. Append each option to `#sort-key-select` in that same order, so the select's option order matches the button order exactly."
      - "In the same loop body, set `option.selected = (b.dataset.key === sortKey)`. That is how the select ships its initial state without calling applySortKey, which would trigger renderBoard() at startup. See plan assumption A6."
      - "Extend `applySortKey` from phase 2 with its deferred third step: set the select's `value` to the key it was given. Place it after the button loop and before the `renderBoard()` call, so one function still owns every side effect of a sort-key change."
      - "Bind the select's `change` event to `applySortKey(select.value)`. Use `change`, not `input`, and add no confirm step: choosing an option must re-sort the board immediately."
      - "The startup loop must run before the severity dot is injected, and it does: the dot is created inside `renderSeverity()` at line 1403, which runs only after the fetch resolves. Even after injection `textContent` is unaffected, because the dot span holds no text."
      - "Do not add a matchMedia listener, a resize handler, or any other viewport logic. Which variant a user sees is a CSS question only, so the state can never fall out of step with the layout."
    pattern: "src/public/app.ts only, the top-level listener block around lines 477-497 plus the applySortKey body added in phase 2. Read-only references: src/public/board.html lines 61-67 (the five buttons that are the labels' source of truth) and renderSeverity() at lines 1392-1414."
    imports: "None. document.createElement, textContent, dataset, and the existing byId helper at line 76. An import is possible under the current esbuild bundling but must not be added. See Divergence 4."
    compatibility: "\"strict\": true means `b.dataset.key` is `string | undefined`, so the loop needs a guard or a non-null handling step before it is used as an option value, and `byId('sort-key-select')` returns HTMLElement so it needs a cast to HTMLSelectElement before `.value` or `.selected` is reached — the project already uses this cast style, for example `byId('ws-modal') as HTMLDialogElement` at line 534. Setting `select.value` to a key that has no matching option silently yields an empty string, so build the options before any applySortKey call can run. The severity option's label is static text, so renderSeverity() needs no update when the dominant severity changes."
    gotcha: "Five traps. First, do not hard-code the four unchanged labels; read them from the buttons, or the two copies drift. Second, do not give the change handler its own synchronisation code — that is the exact drift applySortKey exists to prevent. Third, `b.textContent` on the severity button would include no dot text but the override replaces it anyway, so the map lookup must come first. Fourth, build the options after the listeners are bound but before any code path can call applySortKey. Fifth, keep `option.selected` in the same loop as the option creation, so the initial state has one source."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "Open the board and confirm `document.querySelectorAll('#sort-key-select option').length` is 5, that their values match the five `data-key` values in document order, and that the severity option's text reads `Severity (worst open)`."
      - "Confirm the initially selected option is the one whose value matches the starting `sortKey`, and that the page still shows the `Loading this project…` block before the fetch resolves."
      - "Choose each of the five options in turn and confirm the board re-sorts immediately, with no confirm step."
      - "After choosing `Name` in the select, confirm `document.querySelector('#sort-key-seg [aria-pressed=\"true\"]').dataset.key` is `name` and that the same button carries `class=\"active\"`."
      - "Click the `Created` button and confirm `document.getElementById('sort-key-select').value` becomes `created`."
      - "Run `npm run electron:dev`, and in the Electron window confirm the select holds the same five options and re-sorts the board on change, exactly as in the browser. This is a parity check only; add no packaging step."
    checklist:
      - "Does the select hold exactly five options, in button order, with values equal to the five data-key values?"
      - "Does the severity option read `Severity (worst open)`, sourced from a single named override map, with the other four labels read from the buttons?"
      - "Does choosing an option re-sort the board immediately and move both the `active` class and aria-pressed on the matching button?"
      - "Does clicking a sort-key button update the select's value, through applySortKey and not through separate code in the change handler?"
      - "Is applySortKey still the only writer of sortKey after startup, still ending in renderBoard(), and is it still never called at startup?"
      - "Were zero matchMedia listeners, zero resize handlers, and zero imports added?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 3.3 Style the select and swap it for `#sort-key-seg` at the existing 880px breakpoint

    ```yaml
    description: "In src/public/styles.css, give #sort-key-select the same visual treatment as the integrations modal's select by widening that rule, set its desktop default to display: none, and add the 880px rules that hide #sort-key-seg and show the select."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the `#integrations-project-select {` rule that opens at src/public/styles.css line 949 and sets margin-top, padding, border, border-radius, background, color, and font-size. Widen the selector by appending, so it reads `#integrations-project-select, #sort-key-select {`. Leave every declaration inside the block byte-for-byte unchanged."
      - "Immediately after that block, add `#sort-key-select { margin-top: 0; display: none; }`. The `margin-top: 0` cancels the modal rule's `margin-top: 6px`, which would otherwise push the select off the centre line of the `align-items: center` controls row. The `display: none` is the desktop default that task 3.1's markup needs."
      - "Anchor: the `@media (max-width: 880px)` block at line 535. At base_commit fe1e9c9 it is one line holding `.lower { grid-template-columns: 1fr; }` and `.kpi-strip { grid-template-columns: repeat(2, 1fr); }`. Expect it to have grown by the time this task runs: TL-54-w3me1p adds `.controls .group { flex-wrap: wrap; }`, `.controls .seg { flex-wrap: wrap; }`, and `.controls .seg button { white-space: nowrap; }` to that same block, and may have reformatted it across several lines. Read the block as it actually stands, keep every declaration already in it, and add to it."
      - "Add two declarations inside that block: `.controls #sort-key-seg { display: none; }` and `#sort-key-select { display: inline-block; }`. Do not add a new media query and do not change the 880px value. Leave the unrelated `@media (max-width: 520px)` block at line 190 alone. See Divergence 2."
      - "Leave the three wrap rules from TL-54-w3me1p in place even though `.controls .seg` becoming display: none makes them inert below 880px. That is expected, it is not a fault, and removing them is that task list's own decision."
      - "`display: none` is required, not a preference. It is what removes the hidden variant from the tab order and from the accessibility tree at the same moment. `visibility: hidden` and off-screen positioning both leave one variant behind, which would make the phase 1 accessibility work worse."
      - "Specificity check to confirm while editing: `.controls #sort-key-seg` carries an id and therefore beats `.seg { display: inline-flex; }` at line 340. `.seg button[data-key=\"severity\"] { display: inline-flex; }` at line 353 is on the button, not on the segment, so a hidden parent still hides it."
    pattern: "src/public/styles.css only: the rule at lines 949-957, one new rule immediately after it, and the existing 880px media query at line 535. Read-only references: src/public/index.html line 64 (`#integrations-scope-seg`) and src/public/board.html line 15 (`#theme-seg`), neither of which any new rule may match."
    imports: "None. No custom property, no container query, and no new browser feature."
    compatibility: "Appending a selector cannot change what the integrations modal receives, because both selectors resolve to one declaration block. Every new rule carries either `.controls` or an id, and `.controls` exists only on the board page and never wraps the toolbar, so nothing here can reach `#integrations-scope-seg` in src/public/index.html or `#theme-seg` on either page. The stylesheet already holds two width breakpoints, 520px and 880px, and the project convention is to reuse the 880px one for the board's responsive layout rather than adding a third. Task 4.3 adds the direction-toggle rules to the same 880px block, so expect that block to be edited once more after this task."
    gotcha: "Five traps. First, the 880px block's anchor has almost certainly moved: TL-54-w3me1p executes before this task list and edits that exact block. Read it fresh rather than matching the one-line form quoted above. Second, omitting `margin-top: 0` leaves the select visibly off the row's centre line, which is easy to miss on desktop where the select is hidden. Third, do not write bare `#sort-key-seg` inside the media query without the `.controls` prefix; keep the prefix so the rule reads as board-page-scoped like its neighbours. Fourth, do not remove `overflow: hidden` from `.seg` at line 340 or touch `.seg button:last-child` at line 350. Fifth, `#sort-dir-seg` stays visible below 880px until task 4.3, which is the expected intermediate state."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "At 375px confirm the select is visible, `#sort-key-seg` is not visible, and `document.documentElement.scrollWidth === document.documentElement.clientWidth` is true. Repeat at 320px, 390px, and 430px."
      - "At 375px, tab through the controls row and confirm focus never reaches a `#sort-key-seg` button, and confirm those buttons are absent from the accessibility tree."
      - "At 881px and at 1280px confirm the select is not visible, is not tabbable, is absent from the accessibility tree, and that the five buttons work exactly as they did in phase 2."
      - "Choose `Name` at 375px, widen the window past 880px, and confirm the `Name` button is the active button carrying aria-pressed=\"true\". Then click `Created`, narrow the window again, and confirm the select reads `Created`."
      - "Confirm the select sits on the same centre line as the rest of the controls row at 375px, with no 6px vertical offset."
      - "At 375px and at 500px confirm the toolbar `#theme-seg` is unchanged, including below the 520px breakpoint where `.tb-mark` is hidden."
      - "Open src/public/index.html, open the integrations modal, and confirm `#integrations-project-select` is visually unchanged and `#integrations-scope-seg` still renders as one unwrapped row."
      - "Confirm `grep -c '@media' src/public/styles.css` still reports exactly three media queries."
    checklist:
      - "Below 880px, is the select visible and `#sort-key-seg` removed from the layout, the tab order, and the accessibility tree by `display: none`?"
      - "Above 880px, is the select removed from all three by `display: none`, with the five buttons unchanged?"
      - "Is there no horizontal overflow at 320px, 375px, 390px, and 430px, measured as scrollWidth === clientWidth?"
      - "Does crossing 880px in either direction leave the two variants agreeing on the current sort key?"
      - "Are `#integrations-project-select`, `#integrations-scope-seg`, and `#theme-seg` all visually unchanged?"
      - "Were the new rules added to the existing 880px block, with its pre-existing declarations including the three TL-54-w3me1p wrap rules kept, and with no new media query added?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 4. Phase 4 — Mobile direction icon toggle

  ```yaml
  description: "Add a single icon button that replaces #sort-dir-seg at 880px and below, holding two inline SVG arrows and an aria-label that names the current direction. Child order is markup, then script, then CSS, matching phase 3, so the button is fully wired before the CSS makes it the only direction control on mobile."
  ```

  - [ ] 4.1 Add the `#sort-dir-toggle` button with its two inline SVG arrows to `board.html`

    ```yaml
    description: "In src/public/board.html, add a direction toggle button holding two inline SVG arrows, with the down arrow shipped hidden, both SVGs aria-hidden, and a starting aria-label that names the current ascending direction."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the `<select id=\"sort-key-select\" aria-label=\"Sort by\"></select>` line added by task 3.1, inside the `.group` block. Add the new button immediately after it, still inside `.group`."
      - "Add `<button type=\"button\" id=\"sort-dir-toggle\" aria-label=\"Sort ascending\">` holding two inline SVG arrows, one ascending and one descending."
      - "Draw both arrows in the style of the existing search icon at src/public/board.html line 74: `stroke=\"currentColor\"`, `fill=\"none\"`, a 24-unit viewBox, and a 13px rendered size. Match that icon's stroke-width so the two read as one icon set."
      - "Ship the down arrow with the `hidden` attribute, so the ascending arrow is the visible one. That matches the starting `aria-label` and the `data-dir=\"asc\"` button that already carries `class=\"active\"` and aria-pressed=\"true\"."
      - "Give each SVG `aria-hidden=\"true\"`. The button's aria-label already carries the meaning, so an announced graphic would duplicate it."
      - "Give the button an aria-label that names the current state, `Sort ascending`, not the action the click performs. This is settled: it matches the aria-pressed semantics of the desktop variant, so both variants describe the world the same way. A known and accepted limit is that some screen readers do not re-announce a changed aria-label on an element that already holds focus; adding a visually hidden live region is out of scope."
      - "Do not add aria-pressed to this button. A direction toggle has no meaningful off state, so a pressed state would mislead; the dynamic aria-label states the value instead."
      - "Use two inline SVGs, not one rotated glyph. A CSS rotate is motion, which would need prefers-reduced-motion gating, and a rotated ascending arrow is not necessarily the descending glyph a designer would draw."
      - "Use no `data:` URI anywhere and no `style=\"…\"` attribute. The CSP at src/server.ts lines 47-50 sets `img-src 'self'`, which blocks a `data:` URI outright, and `style-src 'self'`, which blocks an inline style."
      - "Leave `#sort-dir-seg` at lines 68-71 in the DOM and unmodified, and leave `#theme-seg` at lines 15-25 alone. Both sort variants stay; task 4.3 swaps them with CSS."
    pattern: "src/public/board.html, added lines inside the `.group` block at lines 58-72. Read-only reference: the search icon SVG at line 74, the style the arrows must match. The three theme SVGs at lines 15-25 are also drawn in that style and may be read for reference, but must not be edited."
    imports: "None. Inline SVG only. No icon font, no sprite sheet, no image file, and no package."
    compatibility: "The button must be `type=\"button\"`, so it never behaves as a submit control. Both arrows must be siblings inside the one button, because task 4.2 toggles the `hidden` attribute between them and reads them from that button. The `hidden` attribute is the correct mechanism here, unlike on the select in task 3.1: only one arrow is ever shown, the swap is a script decision rather than a viewport decision, and no CSS rule competes for the arrows' display value. tools/copy-assets.mjs copies board.html into dist/, so the change reaches the served page only after npm run build."
    gotcha: "Four traps. First, the button renders visible on every viewport until task 4.3 gives it a desktop default of display: none, so run 4.1, 4.2, and 4.3 together. Second, `hidden` is overridden by any rule that sets an explicit `display` on the SVG, and note that `.toolbar .seg button svg { width: 13px; height: 13px; }` at styles.css line 265 already sets a size but no display on toolbar SVGs — task 4.3 must not set a display value on this button's arrows. Third, a bare `aria-hidden` SVG inside a button with no accessible text would leave the button unnamed, which is why the aria-label is not optional. Fourth, the two glyphs must be distinguishable at 13px, so keep them simple: a shaft and a head, matching the search icon's stroke weight."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "Open the board and confirm `document.getElementById('sort-dir-toggle')` returns the button, that it sits inside `.group` after `#sort-key-select`, and that it contains exactly two `svg` children."
      - "Confirm the ascending arrow is visible, the descending arrow carries `hidden`, and both SVGs carry `aria-hidden=\"true\"`."
      - "Confirm the button's accessible name reads `Sort ascending` and that `document.getElementById('sort-dir-toggle').hasAttribute('aria-pressed')` is false."
      - "Confirm `grep -c 'data:' src/public/board.html` finds no `data:` URI, and that the console shows no CSP violation."
      - "Confirm `#sort-dir-seg` is still present in the DOM and still works."
    checklist:
      - "Does `#sort-dir-toggle` exist inside `.group` after the select, with `type=\"button\"` and `aria-label=\"Sort ascending\"`?"
      - "Does it hold exactly two inline SVG arrows, both `aria-hidden=\"true\"`, with the descending one shipped `hidden`?"
      - "Do the arrows match the search icon's style: `stroke=\"currentColor\"`, `fill=\"none\"`, a 24-unit viewBox, and a 13px rendered size?"
      - "Does the button carry no aria-pressed attribute?"
      - "Does `src/public/board.html` contain no `data:` URI and no new inline `style=` attribute?"
      - "Are `#sort-dir-seg` and `#theme-seg` still present and unmodified by this task?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 4.2 Extend `applySortDir` for the icon button and bind its click

    ```yaml
    description: "In src/public/app.ts, extend applySortDir to set the toggle button's aria-label and swap which arrow carries hidden, and bind the button's click to applySortDir with the flipped direction."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the `applySortDir` function added in phase 2, in the IIFE scope before the listeners at line 477."
      - "Extend it with its deferred steps, after the `#sort-dir-seg` button loop and before the `renderBoard()` call, so one function still owns every side effect of a direction change."
      - "Set the toggle button's aria-label to `Sort ascending` when the direction is `asc` and `Sort descending` when it is `desc`. The label names the current state, not the action; the wording is settled and must not be inverted."
      - "Swap which of the two inline SVGs carries the `hidden` attribute, so the visible glyph always matches the current direction. Set and remove the attribute explicitly on both arrows in one place, rather than toggling one and leaving the other alone."
      - "Add no transition and no animation to this swap. It is an instant glyph swap, which is settled, so nothing here needs prefers-reduced-motion gating. If a transition is ever wanted later it goes inside the existing `@media (prefers-reduced-motion: no-preference)` block at src/public/styles.css line 601, and that is a separate decision."
      - "Bind the button's click to `applySortDir(sortDir === 'asc' ? 'desc' : 'asc')`, so the click flips the direction, re-sorts the board, and swaps the glyph through the one shared function."
      - "Give the two arrows stable handles, either by id or by a data attribute on each SVG, and select them once. Do not re-query the DOM on every call with a positional selector such as nth-child, which would silently break if the markup order ever changes."
      - "Do not call applySortDir at startup. board.html ships the starting aria-label and the starting `hidden` arrow, per plan assumption A6."
      - "Do not add aria-pressed to the button from script, and do not add a matchMedia listener or a resize handler."
    pattern: "src/public/app.ts only: the applySortDir body from phase 2 and the top-level listener block around lines 477-497. Read-only reference: the two arrows added to src/public/board.html by task 4.1."
    imports: "None. setAttribute, removeAttribute, and the existing byId helper at line 76. An import is possible under the current esbuild bundling but must not be added. See Divergence 4."
    compatibility: "\"strict\": true means byId returns HTMLElement, so reaching `.hidden` on the SVG elements needs the right element type or the attribute API instead; using setAttribute and removeAttribute avoids the question entirely and works on SVGElement. `sortDir` stays declared `string | undefined` at line 48, so the click handler's ternary must be written so its result is a `string` before it is passed in. The desktop `#sort-dir-seg` buttons and the icon button both route through applySortDir, which is what keeps the two variants agreeing across the breakpoint."
    gotcha: "Four traps. First, do not invert the aria-label wording to name the action; the two readings are opposites and only one is settled. Second, do not toggle `hidden` on just one arrow, because a single missed state leaves both arrows visible or both hidden. Third, `sortDir` is `string | undefined`, so a bare `sortDir === 'asc' ? 'desc' : 'asc'` is safe but any wider read of it is not; keep the ternary as the whole expression. Fourth, do not re-render from the click handler directly — applySortDir already calls renderBoard(), and a second call would sort twice."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "Open the board and click the icon button. Confirm the board order flips, the visible arrow changes, and the aria-label changes between `Sort ascending` and `Sort descending`, matching the new direction."
      - "Confirm exactly one arrow carries `hidden` after every click, never zero and never two."
      - "Confirm `document.getElementById('sort-dir-toggle').hasAttribute('aria-pressed')` stays false after clicking."
      - "Click the desktop `Desc` button and confirm the toggle button's aria-label and visible arrow both switch to the descending state, through applySortDir and not through separate code."
      - "Confirm the page still shows the `Loading this project…` block before the fetch resolves, proving applySortDir is not called at startup."
      - "Run `npm run electron:dev` and confirm the toggle flips the board order and swaps the glyph in the Electron window exactly as in the browser. This is a parity check only; add no packaging step."
    checklist:
      - "Does applySortDir set the aria-label to the wording that names the current state, and swap `hidden` explicitly on both arrows?"
      - "Does the icon button's click call applySortDir with the flipped direction, with no synchronisation or render logic of its own?"
      - "Does exactly one arrow carry `hidden` at all times, and does the visible glyph always match the current direction?"
      - "Does using the desktop `Asc` or `Desc` button update the icon button's label and glyph through the same shared function?"
      - "Does the button still carry no aria-pressed attribute, and was no transition or animation added?"
      - "Is applySortDir still never called at startup, and were no matchMedia handlers, resize handlers, or imports added?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 4.3 Style the icon button and swap it for `#sort-dir-seg` at the existing 880px breakpoint

    ```yaml
    description: "In src/public/styles.css, style #sort-dir-toggle to match the segment buttons, set its desktop default to display: none, and add the 880px rules that hide #sort-dir-seg and show the button."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add a `#sort-dir-toggle` rule with `display: none;` as its desktop default, plus the few declarations that make it match the segment buttons visually."
      - "Reuse the existing `.seg button` values at src/public/styles.css lines 341-349 for padding, border, and colour rather than inventing new ones. Read at fe1e9c9 that rule sets `background: var(--paper-raised)`, `color: var(--line-strong)`, `padding: 5px 12px`, `font-size: 12.5px`, and `border-right: 1px solid var(--line)`, and the segment's own `border: 1px solid var(--line)` and 6px radius come from `.seg` at line 340. Copy the values from the file as it stands, not from this description. See Divergence 5. The button must read as a peer of the controls it replaces."
      - "Place the rule near the other sort-row rules rather than at the end of the file, so the sort controls stay readable as one region. Keep it below the `.toolbar .seg` rules at lines 253-267, which belong to the toolbar theme switch and must not be touched."
      - "Anchor: the `@media (max-width: 880px)` block at line 535, which task 3.3 has already extended. Read it as it actually stands, keep every declaration already in it, and add two more: `.controls #sort-dir-seg { display: none; }` and `#sort-dir-toggle { display: inline-flex; }`."
      - "Do not add a new media query and do not change the 880px value. The stylesheet already holds two width breakpoints, 520px at line 190 and 880px at line 535, and the convention for the board's responsive layout is to reuse the 880px one. Leave the 520px block alone. See Divergence 2."
      - "Set no `display` value on the arrow SVGs themselves. An explicit display on an SVG would override the `hidden` attribute that task 4.2 toggles, and both arrows would show at once."
      - "Add no `background-image` anywhere. Both glyphs are inline SVG; a `data:` URI in a background-image is blocked by the CSP at src/server.ts lines 47-50 and the icon would not render at all."
      - "Add no transition on the button or its arrows, per the settled instant-swap decision. The existing `@media (prefers-reduced-motion: no-preference)` block at line 601 stays untouched."
      - "Leave the three inert wrap rules from TL-54-w3me1p in the 880px block. After this task both segments are display: none there, so those rules can never apply, which is expected and is not a fault. Removing them belongs to TL-54-w3me1p's own decision."
      - "Confirm the button carries a visible focus outline. `.seg button:focus-visible, .filter-chips button:focus-visible, input:focus-visible, .card:focus-visible` at line 354 does not match `#sort-dir-toggle`, so either extend that selector list or give the button its own matching `:focus-visible` rule, so the WCAG 2.4.11 behaviour that ISS-20-en7s3l covers is not lost on the mobile variant."
    pattern: "src/public/styles.css only: one new rule near the sort-row rules at lines 332-354, an addition to the focus-visible rule at line 354, and two declarations added to the existing 880px media query at line 535. Read-only references: `.seg` at line 340, `.seg button` at lines 341-349, and `.toolbar .seg` at lines 253-267, which must not be edited."
    imports: "None. No custom property beyond the existing `--paper-raised`, `--line-strong`, and `--line` tokens that `.seg` and `.seg button` already use, and no new browser feature."
    compatibility: "Every new selector carries either `.controls` or an id, and `.controls` exists only on the board page and never wraps the toolbar, so nothing here can reach `#integrations-scope-seg` in src/public/index.html line 64, `#integrations-project-select`, or `#theme-seg` on either page. `display: inline-flex` is what centres the 13px SVG inside the button, matching `.seg button[data-key=\"severity\"]` at line 353. `display: none` on `#sort-dir-seg` removes it from the layout, the tab order, and the accessibility tree in one move, which is required rather than preferred."
    gotcha: "Five traps. First, the 880px block has been edited twice before this task, by TL-54-w3me1p and by task 3.3, so its anchor has moved from the one-line form recorded at base_commit fe1e9c9; read it fresh. Second, setting a display value on the arrows breaks the hidden-attribute swap. Third, forgetting the focus-visible rule leaves the mobile direction control with no visible focus indicator, which reintroduces the WCAG failure this workstream fixed. Fourth, `.seg button:last-child { border-right: none; }` at line 350 does not apply to this button, so give it a full border rather than assuming the segment's. Fifth, do not centralise the shared button styling by rewriting `.seg button`; append a selector or add a peer rule instead, so the existing segment buttons and the toolbar theme buttons receive exactly what they receive today."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "At 375px confirm the icon button is visible, `#sort-dir-seg` is not visible, and `document.documentElement.scrollWidth === document.documentElement.clientWidth` is true. Repeat at 320px, 390px, and 430px."
      - "At 375px, tab through the controls row and confirm focus never reaches a `#sort-dir-seg` button, that it does reach `#sort-dir-toggle`, and that the toggle shows a visible focus outline."
      - "At 881px and at 1280px confirm the icon button is not visible, is not tabbable, is absent from the accessibility tree, and that the two direction buttons work exactly as in phase 2."
      - "Set the direction to descending at 375px, widen past 880px, and confirm the `Desc` button is the active button carrying aria-pressed=\"true\". Then click `Asc`, narrow the window again, and confirm the toggle shows the ascending glyph and the ascending aria-label."
      - "At 375px and at 500px confirm the toolbar `#theme-seg` still renders and behaves exactly as before, including its own focus outlines."
      - "Confirm `grep -c 'background-image' src/public/styles.css` reports no new occurrence and `grep -c 'data:' src/public/board.html` finds none."
      - "Reload the page with the network panel filtered to images and confirm no image request appears and no CSP violation is logged in the console."
      - "At 375px confirm the whole sort block fits on one line, or wraps within the page with no overflow."
      - "Run `npm run electron:dev`, narrow the Electron window below 880px, and confirm the select and the icon button both appear and behave exactly as in the browser. This is a parity check only; add no packaging step."
    checklist:
      - "Below 880px, is the icon button visible and `#sort-dir-seg` removed from the layout, the tab order, and the accessibility tree by `display: none`?"
      - "Above 880px, is the icon button removed from all three by `display: none`, with the two direction buttons unchanged?"
      - "Does the icon button show a visible focus outline at mobile widths, and is `#theme-seg` visually and behaviourally unchanged?"
      - "Is there still no horizontal overflow at 320px, 375px, 390px, and 430px, and does the sort block fit or wrap without overflow at 375px?"
      - "Does crossing 880px in either direction leave the two direction variants agreeing?"
      - "Does the page use no `background-image`, no `data:` URI, and no new transition, with zero image requests and zero CSP violations on load?"
    self_eval:
      passed: false
      failures: []
    ```

## Divergences

1. **`dot.style.background` sat four lines below the line the plan cited.** As first
   recorded at `6c14319`, the plan's CSP discussion cited the existing CSSOM write as
   `src/public/app.ts:1323`, while the statement was at line 1327 and line 1323 was the
   `if (!dot) {` guard. That citation was corrected during the `fe1e9c9` refresh: the write
   now sits at `src/public/app.ts:1408`, the dot creation `dot = el('span', 'dot-sm');` at
   line 1403, and `sevBtn.insertBefore(dot, sevBtn.firstChild);` at line 1404. No task was
   changed by this and none was withheld; task 1.3 anchors on the creation line and names
   the surrounding statements.

2. **The stylesheet gained a second width breakpoint.** At `6c14319` `src/public/styles.css`
   was about 1086 lines and `@media (max-width: 880px)` was its only width breakpoint. At
   `fe1e9c9` the file is about 1250 lines and also holds
   `@media (max-width: 520px) { .tb-mark { display: none; } }` at line 190, added by
   unrelated toolbar work. Every "exactly one breakpoint" and "exactly two media queries"
   statement in this file was corrected. The design is unaffected: the 880px block still
   owns the board's responsive layout, the 520px block only hides the toolbar mark, and
   tasks 3.3 and 4.3 still add no new breakpoint. The `grep -c '@media'` verify steps now
   expect three matches, not two.

3. **A second bare-`.seg` consumer now exists, and it is on the board page itself.** At
   `6c14319` the only other `.seg` element was `#integrations-scope-seg` in
   `src/public/index.html`. At `fe1e9c9` the toolbar theme switch `#theme-seg` also carries
   `class="seg"`, at `src/public/board.html:15` and `src/public/index.html:16`, styled by
   `.toolbar .seg` at `src/public/styles.css:253`. Every rule and every selector this task
   list adds already carries a `.controls` prefix or an id, so all of them still avoid it,
   and `.controls` never wraps the toolbar. Only the rationale and the regression checks
   were updated: tasks 1.1, 2, 3.1, 3.3, 4.1, and 4.3 now name `#theme-seg` as a control to
   leave alone and to check for regressions.

4. **The browser build is no longer a classic script.** At `6c14319`
   `src/public/tsconfig.json` set `"module": "none"`, and this file stated in four places
   that no import could be added to `src/public/app.ts`. At `fe1e9c9` that file sets
   `"module": "esnext"`, `"moduleResolution": "bundler"`, `"isolatedModules": true`, and
   `"noEmit": true`, and `tools/bundle-public.mjs` bundles the module graph with esbuild
   into one IIFE per page. `npm run build` is now `build:base` — `tsc -p tsconfig.json`,
   `tsc -p src/public/tsconfig.json`, `tsc -p electron/tsconfig.json`,
   `node tools/copy-assets.mjs` — followed by `node tools/bundle-public.mjs`. An import into
   `src/public/app.ts` is therefore possible today. No task needs one and every task now
   forbids adding one, so the design is unchanged; the false impossibility claim was
   replaced with an explicit prohibition. `src/public/tsconfig.json` also has no
   `"noEmitOnError"` key — only `tsconfig.json` and `electron/tsconfig.json` set it — but a
   `tsc` failure still exits non-zero and stops the `&&` chain, so the type-check gate
   behaves as the tasks assume.

5. **The `.seg` colour tokens changed.** At `6c14319` `.seg` used
   `border: 1px solid var(--line-strong)` and `.seg button` used `color: var(--ink-soft)`
   with `border-right: 1px solid var(--line-strong)`. At `fe1e9c9` `src/public/styles.css`
   line 340 reads `border: 1px solid var(--line)` and lines 341-349 read
   `color: var(--line-strong)` with `border-right: 1px solid var(--line)`. Task 4.3 quoted
   the old values as the ones to reuse for `#sort-dir-toggle`; the quotation was corrected
   and the task now also instructs the executor to copy the values from the file as it
   stands. The intent, that the toggle reads as a peer of the segment buttons, is unchanged.

Every other file, line, and symbol the plan cites was re-read at `fe1e9c9` and matched what
the plan assumes, including the `.controls label` rule at `styles.css:333`, `.seg` at
`:340`, `.seg button` at `:341-349`, the 880px block at `:535`, the
`prefers-reduced-motion` block at `:601`, `#integrations-project-select` at `:949`, the
sort variables at `app.ts:47-48`, the comparator at `app.ts:447-455`, the two click
handlers at `app.ts:477-491`, `selectTab()` at `app.ts:559-575`, `renderSeverity()` at
`app.ts:1392-1414`, the CSP at `server.ts:47-50`, and the controls markup at
`board.html:58-83`.

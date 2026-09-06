---
id: TL-57-m9aegg
type: tasklist
workstream: WS-56-kdu68p
slug: filter-row-scale-and-mobile
title: "A tag overflow popover, a shrunk chip row, and a mobile filter rail"
status: ready
created: 2026-08-21
updated: 2026-08-21
author: Anthony Koukoullis
depends_on: [PLN-46-n2lpvt, TL-56-4mxmju, TL-55-5pyusw]
links: []
mode: spec
base_commit: 6c14319
---

# PRX Tasks

## Filter row scale and mobile

This task list implements `PLN-46-n2lpvt` in the plan's own seven phases, one parent task
per phase, one child task per file. It scales the board's filter row for a tag vocabulary
that grows over months, and gives that row the mobile behaviour it does not have today.

The chosen approach reuses the app's existing `<dialog>` idiom for the overflow panel,
opened with `showModal()`. That one decision supplies focus containment, Escape-to-close,
`::backdrop`, focus restoration, and the top layer. The top layer is what stops the sticky
`.controls` stacking context at `src/public/styles.css` lines 242-253 from clipping the
panel. The app already runs this idiom twice, for `#ws-modal` at `src/public/board.html`
line 90 and for the integrations dialog.

The second load-bearing decision is one writer. A new `toggleTag(key)` owns every side
effect of a tag toggle, and a widened `syncFilterActive()` owns the painted state of both
surfaces. The fast-path chip row and the popover therefore have no independent path that
can drift apart.

Three files change, and no others: `src/public/board.html`, `src/public/styles.css`, and
`src/public/app.ts`. There is no server change, no API change, no data-model change, and
no new dependency. `src/public/app.ts` compiles as a classic script with `"module": "none"`
in `src/public/tsconfig.json`, so no import can be added and none is needed. The file's
style is ES5-era — `var`, function expressions, no arrow functions — and every new
function must match it. Filter state stays in `activeTags` and `blockedOnly` at
`src/public/app.ts` lines 37-38 and dies with the page, exactly as today.

**Execution gate.** Both `TL-56-4mxmju` and `TL-55-5pyusw` must land first, and neither
had executed when this file was authored. `TL-56-4mxmju` corrects the tag-qualification
expression at `src/public/app.ts` line 349. `TL-55-5pyusw` widens `.controls label` at
`src/public/styles.css` line 255 into `.controls label, .controls .group-label`, which is
the rule task 3 reuses instead of writing its own. `TL-54-w3me1p` is an indirect
prerequisite only; it reaches this list through `TL-55-5pyusw`.

**Every anchor in this file was read at `base_commit` `6c14319`**, which is before any of
those three task lists executed. Each task that touches a shared anchor says where that
anchor is expected to have moved. The `@media (max-width: 880px)` block at
`src/public/styles.css` line 432 is the sharpest case: by the time task 7 runs it already
holds `TL-54-w3me1p`'s three wrap rules, `TL-55-5pyusw`'s four swap rules, and possibly
rules added by an earlier task in this same file. Read that block fresh and append to it.
Never rewrite it and never reorder it.

**Settled decisions**, recorded so that no task re-opens them. `TAG_MIN_COUNT` stays at
`2`; the brief's request to drop it to `1` is unsafe against the corrected ceiling and no
task here implements it (see Divergence 2). The cutoff indicator reads `Top N of M`, plain
text, no parentheses. `Clear` is not routed through `refreshFilterTags()`, so a pinned
chip may survive a `Clear` until the next data change; that is existing behaviour and it
stays. The popover shows no count of the tags an active search is hiding. `npm start` is
the release target; tasks 2.3 and 7 each carry one `npm run electron:dev` parity check as
verification only, and no packaging step is added anywhere.

**Out of scope**, per the plan. The qualification expression at `src/public/app.ts` line
349, which `TL-56-4mxmju` owns and no task here re-touches. Removing the now-dead bare
`.controls label` selector at `src/public/styles.css` line 255. The three existing
`calc(100vh - 64px)` uses at lines 709, 724, and 841. Every element `TL-55-5pyusw` owns:
`<label>Sort</label>`, `#sort-key-seg`, `#sort-dir-seg`, `#sort-key-select`, and
`#sort-dir-toggle`. A `+N more` expander, invented tag categories, and a dropdown
replacement for the chips. A lower chip cap on mobile. Persisting filter state to a URL
parameter or to storage. Any change to how or when the `hidden` attribute on
`#filter-chips` is toggled at `src/public/app.ts` lines 480-482. A browser test harness.

- [ ] 1. Phase 1 — `toggleTag`, and `aria-pressed` on the fast-path row

  ```yaml
  description: "Extract the single tag-toggle writer, route the delegated listener's tag branch through it, and make the fast-path row report its pressed state. Child order is script first, then markup: task 1.1 makes syncFilterActive maintain aria-pressed on every filter button, so the static default task 1.2 ships in board.html is correct from the first paint instead of going stale on the first click."
  ```

  - [ ] 1.1 Add `toggleTag`, the shared `paintTag` painter, and `aria-pressed` upkeep in `app.ts`

    ```yaml
    description: "In src/public/app.ts, add a toggleTag(key) function that owns every side effect of a tag toggle, route the delegated filter listener's tag branch through it, widen syncFilterActive so the active class and aria-pressed always move together, and rewrite the now-false comment that says refreshFilterTags is called from applyData only."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the function `syncFilterActive` that opens at src/public/app.ts line 316. Its body is one forEach over `byId('filter-chips').querySelectorAll('button')` with three branches keyed on `b.id`. Keep those three branches and their order exactly as they are."
      - "Inside syncFilterActive, declare a local helper named paintTag that takes one button and sets both the `active` class and the `aria-pressed` attribute from the same boolean, so the two can never drift. Call it from the tag branch. Illustrative only, not a literal block — match the file's ES5 style and its existing indentation: `function paintTag(b) { var on = activeTags[b.dataset.tag || ''] === true; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }`."
      - "In the same forEach, give the `filter-blocked` branch an `aria-pressed` set from `blockedOnly`, alongside the class toggle it already performs. Leave the `filter-clear` branch alone: Clear is an action, not a toggle, and must carry no aria-pressed."
      - "Add a new function toggleTag(key) in the same IIFE scope, declared above the delegated listener that opens at line 460. It does exactly three things in this order: flip the key in activeTags with `if (activeTags[key]) delete activeTags[key]; else activeTags[key] = true;`, then call refreshFilterTags(), then call renderBoard(). Do not add a fourth step and do not call syncFilterActive() from it — refreshFilterTags already ends with that call at line 378."
      - "Calling refreshFilterTags from a toggle is the whole point: the existing PIN step at lines 354-359 already guarantees an active key gets a chip, and running it at toggle time rather than only at data time is what will later let the popover pin an out-of-cap tag with no extra code."
      - "Anchor: the delegated listener at line 460 registered on `byId('filter-chips')`. Change only its `else if (btn.dataset.tag)` branch, at lines 471-474: replace the inline flip with `toggleTag(btn.dataset.tag); return;`. The early return is required, because toggleTag has already run both refreshFilterTags and renderBoard. Leave the `filter-clear` and `filter-blocked` branches, and the trailing `syncFilterActive(); renderBoard();` pair at lines 477-478, exactly as they are."
      - "Keep the guard on `btn.dataset.tag` before the call. dataset.tag is `string | undefined` and src/public/tsconfig.json sets `\"strict\": true`, so this is a type requirement, not a style choice."
      - "Anchor: the three-line comment at lines 324-326 that ends `It is called from applyData only — never from renderBoard`. That sentence becomes false in this task. Rewrite it so it names both callers, applyData and toggleTag, and keeps the still-true point that it is never called from renderBoard, which runs on every search keystroke and every sort click."
      - "Change nothing else in this file in this task. The popover wiring is task 2.3, the ordering and count work is task 4.3, and the cap constant is task 5."
    pattern: "src/public/app.ts only: syncFilterActive at lines 313-322, the comment at lines 324-326, the delegated listener at lines 457-479, and one new function declared between them. Read-only references in the same file: activeTags at line 37, the PRUNE step at lines 342-344, the PIN step at lines 354-359, and the GUARD step at lines 363-377."
    imports: "None. Every identifier used is already in the same IIFE scope: activeTags, blockedOnly, refreshFilterTags, renderBoard, syncFilterActive, and byId. The file compiles with \"module\": \"none\" as a classic script, so no import statement is possible."
    compatibility: "Match the file's ES5-era style exactly — var, function expressions, no arrow functions, no let or const, no template literals. tsc runs with \"strict\": true and \"noEmitOnError\": true, so a string | undefined leak fails the build rather than the browser. One writer is the settled pattern for this workstream, mirroring applySortKey and applySortDir from PLN-45-xh9o61 and the selectTab invariant documented at lines 512-517. TL-56-4mxmju executes before this task and edits line 349 inside refreshFilterTags; this task must not touch that expression. tools/copy-assets.mjs copies the built app.js into dist/, so no edit reaches the served page before npm run build."
    gotcha: "Five traps. First, forgetting the early return in the routed tag branch makes refreshFilterTags and renderBoard run twice per click, which is wasteful and can drop a chip's hover state. Second, calling syncFilterActive from inside toggleTag as well as leaving refreshFilterTags to call it produces a double repaint for no benefit. Third, the aria-pressed sweep must not reach #filter-clear; an action that reports a pressed state is worse than one that reports none. Fourth, toggleTag must be declared before the delegated listener runs, not merely before it is registered — declare it at the same nesting level as the other IIFE-scope functions. Fifth, leaving the comment at lines 324-326 as it stands ships a documented invariant that the same commit breaks; the plan names this as one of its top three risks."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "Serve the board with `npm start`, open it at 1280px, click a tag chip, and confirm the board filters. Click the same chip again and confirm the board unfilters."
      - "In the console run `document.querySelectorAll('#filter-chips [aria-pressed=\"true\"]').length` and compare it against `document.querySelectorAll('#filter-chips button.active').length`. Confirm the two are equal after activating one chip, after activating a second chip, after toggling Blocked only, and after clicking Clear."
      - "Confirm `document.querySelectorAll('#filter-chips [aria-pressed=\"true\"]')` holds exactly the same element list as `document.querySelectorAll('#filter-chips button.active')`, not merely the same count."
      - "Confirm `document.getElementById('filter-clear').hasAttribute('aria-pressed')` reports false."
      - "Activate a tag that ranks below the display cap by editing a workstream's tags on disk so the tag falls out of the top ranks, wait for the poll, and confirm the pinned chip is still present and still active."
      - "Confirm `grep -n 'from applyData only' src/public/app.ts` returns nothing."
    checklist:
      - "Does toggleTag perform exactly three steps — flip, refreshFilterTags, renderBoard — with no fourth step and no direct syncFilterActive call?"
      - "Does the delegated listener's tag branch call toggleTag and return early, leaving the filter-clear and filter-blocked branches unchanged?"
      - "Do the `active` class and `aria-pressed` come from one shared boolean inside syncFilterActive, on every tag button and on #filter-blocked?"
      - "Does #filter-clear carry no aria-pressed attribute at any point?"
      - "Has the comment at lines 324-326 been rewritten to name both callers of refreshFilterTags?"
      - "Is the expression at line 349 that TL-56-4mxmju owns byte-for-byte untouched by this task?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 1.2 Ship the starting `aria-pressed` value for `Blocked only` in `board.html`

    ```yaml
    description: "In src/public/board.html, add aria-pressed=\"false\" to the #filter-blocked button so the control reports a pressed state before the first fetch resolves, matching the project's existing habit of shipping initial ARIA state in markup."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the single line at src/public/board.html line 53 that reads `<button type=\"button\" id=\"filter-blocked\" class=\"blocked-toggle\">Blocked only</button>`, inside the `.filter-chips` block that opens at line 50."
      - "Add `aria-pressed=\"false\"` to that button. `false` is correct because blockedOnly initialises to false at src/public/app.ts line 38, and nothing sets it before the first click."
      - "Add no aria-pressed to #filter-clear, and add none to #filter-tags or to any other element in this block. Every tag chip is created by JavaScript and painted by syncFilterActive in the same pass that creates it, so no tag button needs a markup default."
      - "Do not touch line 51's `<label>Filter</label>` in this task. Task 3 replaces it, and it must stay as it is until TL-55-5pyusw has landed."
      - "Add no `style=\"…\"` attribute anywhere. The Content-Security-Policy at src/server.ts lines 29-32 sets `style-src 'self'` with no `'unsafe-inline'`, so an inline style attribute is blocked."
    pattern: "src/public/board.html line 53 only, inside the .filter-chips block at lines 50-55. Read-only references: line 51 (the Filter label, untouched until task 3) and lines 114-117 (the tablist, the project's existing pattern for shipping initial ARIA state in markup)."
    imports: "None. One plain HTML attribute. No script tag, no stylesheet link, and no package."
    compatibility: "Task 1.1 must land first or at the same time. It is what keeps this attribute honest after the first click; on its own the attribute would go stale as soon as the button is pressed. tools/copy-assets.mjs copies board.html into dist/, so the change reaches the served page only after npm run build."
    gotcha: "Three traps. First, the value must be `false`, matching both the missing `active` class on this button in the shipped markup and blockedOnly's initial value. Second, do not add the attribute to #filter-clear, which is an action rather than a toggle. Third, this button carries `class=\"blocked-toggle\"`, which the styles at src/public/styles.css line 297 key on; do not disturb the class while adding the attribute."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "Run `grep -n 'id=\"filter-blocked\"' src/public/board.html` and confirm the line carries both `class=\"blocked-toggle\"` and `aria-pressed=\"false\"`."
      - "Open the board with `npm start`, and before clicking anything confirm `document.getElementById('filter-blocked').getAttribute('aria-pressed')` reads \"false\"."
      - "Click Blocked only and confirm the attribute reads \"true\". Click it again and confirm it reads \"false\"."
      - "Confirm `document.getElementById('filter-clear').hasAttribute('aria-pressed')` reports false."
      - "Confirm the browser console shows no Content-Security-Policy violation."
    checklist:
      - "Does #filter-blocked ship `aria-pressed=\"false\"` in the markup?"
      - "Does the attribute track the button's pressed state on every click, through syncFilterActive?"
      - "Was aria-pressed added to no other element in the filter row?"
      - "Is line 51's `<label>Filter</label>` byte-for-byte unchanged by this task?"
      - "Were zero inline `style=` attributes added, and does the console show no CSP violation?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 2. Phase 2 — The overflow popover

  ```yaml
  description: "Add a modal <dialog> that lists every distinct tag with its workstream count, filtered by an in-panel search, whose chips toggle the same filter state the fast-path row toggles. Child order is markup, then CSS, then script: a <dialog> without an `open` attribute renders display: none by default, and the unwired #filter-more button falls through the delegated listener's final `return`, so each intermediate state is inert rather than broken."
  ```

  - [ ] 2.1 Add the `More tags…` button and the `#tag-popover` dialog to `board.html`

    ```yaml
    description: "In src/public/board.html, add a More tags… button between the tag area and Blocked only, and add one new top-level <dialog id=\"tag-popover\"> as a sibling of #ws-modal, reusing the .ws-modal-close, .search-wrap, and .filter-chips classes the file and stylesheet already carry."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the `.filter-chips` block that opens at src/public/board.html line 50. Insert a new button between `<span id=\"filter-tags\"></span>` at line 52 and the `#filter-blocked` button at line 53. It reads `<button type=\"button\" id=\"filter-more\">More tags…</button>` and uses the real ellipsis character, matching the placeholder text at line 47."
      - "The new button sits inside #filter-chips but outside #filter-tags. That placement is load-bearing: it is what makes the existing `.filter-chips button` rule at src/public/styles.css line 286 style it, the shared `:focus-visible` rule at line 276 cover it, and the delegated listener at src/public/app.ts line 460 reach it, all with no new rule and no new listener."
      - "Anchor: the `</dialog>` that closes #ws-modal at line 126, followed by a blank line and the three script tags at lines 128-130. Insert the new dialog between them, as a sibling of #ws-modal and before the scripts."
      - "The new dialog is `<dialog id=\"tag-popover\" aria-labelledby=\"tag-popover-title\">` with no `open` attribute, exactly like #ws-modal. app.ts calls showModal()."
      - "Inside it place one `<div class=\"tag-popover-inner\">` holding, in order: a `<div class=\"tag-popover-head\">` containing `<h2 id=\"tag-popover-title\" class=\"tag-popover-title\">Filter by tag</h2>` and `<button type=\"button\" id=\"tag-popover-close\" class=\"ws-modal-close\" aria-label=\"Close\">×</button>`; a `<div class=\"search-wrap\">` holding the magnifier SVG and `<input type=\"text\" id=\"tag-popover-search\" placeholder=\"Search tags…\" autocomplete=\"off\" autofocus>`; a `<div class=\"filter-chips tag-popover-list\" id=\"tag-popover-list\"></div>`; and `<p class=\"tag-popover-empty\" id=\"tag-popover-empty\" hidden>No tag matches that search.</p>`."
      - "Copy the magnifier SVG verbatim from line 46 of this same file. It is duplicated on purpose: board.html has no templating and app.ts cannot import."
      - "The `autofocus` attribute on the input is the native way to focus inside a dialog opened with showModal(). The dialog's focusing steps honour it on every open, so no focus() call belongs in app.ts. Do not remove it and do not add a script-side focus call in its place."
      - "The list container must carry both `filter-chips` and `tag-popover-list`. `.filter-chips` is what gives its buttons the chip styling at src/public/styles.css lines 286-297 and the shared focus ring at line 276, none of which are scoped by `.controls`."
      - "Put every declaration in styles.css. Add no `style=\"…\"` attribute: the Content-Security-Policy at src/server.ts lines 29-32 sets `style-src 'self'` with no `'unsafe-inline'`."
      - "Do not touch line 51's `<label>Filter</label>` and do not add the cutoff span in this task. Those are tasks 3 and 4.1."
    pattern: "src/public/board.html only: one inserted line inside the .filter-chips block at lines 50-55, and one new dialog inserted between line 126 and the script tags at lines 128-130. Read-only references in the same file: line 46 (the magnifier SVG to copy), lines 86-89 (the comment explaining why #ws-modal carries no padding), and lines 90-126 (#ws-modal, the structural model for the new dialog)."
    imports: "None. Plain HTML only. No script tag, no stylesheet link, and no package. Every class used already exists in src/public/styles.css: .ws-modal-close at lines 755-768, .search-wrap and .search-wrap input at lines 299-309, and .filter-chips at lines 286-297."
    compatibility: "The dialog must be a top-level sibling of #ws-modal, not a descendant of .controls. Nesting it inside the sticky bar would put it back inside the stacking context the top layer exists to escape. `padding: 0` on the dialog is load-bearing and lands in task 2.2, so the head, the search, and the list must all live inside .tag-popover-inner and never directly under the dialog. Use the real ellipsis character in `More tags…` and `Search tags…`, matching the existing placeholder at line 47 rather than three periods. tools/copy-assets.mjs copies board.html into dist/, so no edit reaches the served page before npm run build."
    gotcha: "Five traps. First, do not add an `open` attribute; the dialog would render immediately and non-modally, outside the top layer. Second, do not drop the `filter-chips` class from the list container as redundant — it is the entire styling mechanism for the popover's chips, per the plan's assumption A6. Third, between this task and task 2.3 the More tags… button is visible and does nothing; that is expected, because the delegated listener's final `else return;` catches it. Fourth, the close button must keep `.ws-modal-close`, not a new class, or it ships unstyled. Fifth, the empty-state paragraph ships with `hidden` set; task 2.3 owns when that attribute moves."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "Open the board with `npm start` at 1280px and confirm a `More tags…` chip renders in the filter row, after the tag chips and before Blocked only, styled identically to the other chips."
      - "Confirm the dialog is not visible on load, and that `document.getElementById('tag-popover').open` reports false."
      - "In the console run `document.getElementById('tag-popover').showModal()` and confirm the panel opens above the sticky controls bar and is not clipped by it."
      - "With the panel open, confirm `document.activeElement.id` reads \"tag-popover-search\"."
      - "Confirm `document.querySelector('#tag-popover-list').classList.contains('filter-chips')` reports true."
      - "Press Escape and confirm the panel closes without any script wiring."
      - "Confirm `grep -c 'style=' src/public/board.html` reports no new inline style attribute, and the console shows no CSP violation."
    checklist:
      - "Does #filter-more sit inside #filter-chips but outside #filter-tags, between the tag area and #filter-blocked?"
      - "Is #tag-popover a top-level sibling of #ws-modal, with no `open` attribute and no ancestor inside .controls?"
      - "Does the dialog contain exactly one .tag-popover-inner holding the head, the .search-wrap, the list, and the empty-state paragraph, with nothing else directly under the dialog element?"
      - "Does #tag-popover-list carry both the `filter-chips` and `tag-popover-list` classes?"
      - "Does #tag-popover-search carry `autofocus` and `autocomplete=\"off\"`, and does the close button carry `.ws-modal-close` and `aria-label=\"Close\"`?"
      - "Were zero inline `style=` attributes added, and is line 51's `<label>Filter</label>` unchanged?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 2.2 Add the `#tag-popover` dialog section to `styles.css`

    ```yaml
    description: "In src/public/styles.css, add one new dialog section for #tag-popover modelled line for line on the #ws-modal rules, so the panel gets the same width, height cap, chrome, backdrop, and internal scroll behaviour as the two dialogs the app already ships."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the `/* ---------- Card detail modal ---------- */` section that opens at src/public/styles.css line 700, specifically the `#ws-modal` rule at lines 705-716, its `::backdrop` line at 717, and the `.ws-modal-inner` rule at lines 721-725. Read all three before writing; they are the template."
      - "Append a new commented section for the tag popover. Put it after the integrations dialog section that begins at line 833, at the end of the file's dialog rules, so the three dialog sections read in one place. Do not insert it inside the card-detail or integrations sections."
      - "Give #tag-popover the same shape as #ws-modal: `padding: 0`, a `width: min(…, calc(100vw - 48px))` and matching `max-width`, `max-height: calc(100vh - 64px)`, the same `border: 1px solid var(--line)`, `border-radius: var(--radius)`, `background: var(--paper-raised)`, `color: var(--ink)`, `box-shadow: var(--shadow)`, and `overflow: hidden`. Choose a narrower width than #ws-modal's 880px, because this panel holds a search box and a wrapped chip list rather than a document; a value around 560px suits it, and the `min()` with `calc(100vw - 48px)` is what keeps it inside a narrow window."
      - "Add `#tag-popover::backdrop` with the same `background: color-mix(in srgb, var(--ink) 46%, transparent)` as line 717."
      - "Add `.tag-popover-inner` as a column flex container with `max-height: calc(100vh - 64px)`, matching .ws-modal-inner at lines 721-725. Repeat the cap here on purpose, exactly as that rule does — the dialog caps its own height and the inner box caps its children."
      - "Add `.tag-popover-head` as a row flex container that separates the title from the close button, with a bottom hairline `1px solid var(--line)` and padding matched to `.ws-modal-head` at lines 727-734. Add `.tag-popover-title` with `margin: 0` and the display font, matched to `.ws-modal-title` at lines 743-750 but at a smaller size, because this is a panel heading rather than a workstream title."
      - "Put the scroll on the list host, not on the dialog: give `#tag-popover-list` `overflow-y: auto` and its own padding, so the head and the search input stay pinned while the tags scroll. This mirrors what `.ws-modal-body` at lines 821-825 does for the card modal."
      - "Give the `.search-wrap` inside the popover the padding it needs to sit clear of the head. Do not edit the shared `.search-wrap` rule at line 299; scope any new declaration under `#tag-popover` so the board's own search box is untouched."
      - "Add `.tag-popover-empty` as quiet centred text using `var(--ink-faint)`, matched to the existing `.ws-modal-empty` rule at lines 826-831."
      - "Write the whole section against the file's own tokens — `--line`, `--radius`, `--paper-raised`, `--ink`, `--ink-faint`, `--shadow`, `--font-display` — and introduce no new custom property and no hard-coded colour."
      - "Add no media query in this task. The mobile sheet rules belong to task 7 and go inside the existing 880px block."
    pattern: "src/public/styles.css only: one new section appended after the integrations dialog section that begins at line 833. Read-only references in the same file: #ws-modal at lines 705-717, .ws-modal-inner at 721-725, .ws-modal-head at 727-734, .ws-modal-title at 743-750, .ws-modal-close at 755-768, .ws-modal-body at 821-825, .ws-modal-empty at 826-831, .search-wrap at 299-309, .filter-chips at 286-297, and the shared focus ring at 276."
    imports: "None. No @import, no font file, and no new custom property. Every value comes from a token already defined at the top of this file."
    compatibility: "`padding: 0` on the dialog is required, not cosmetic. Task 2.3's backdrop dismissal tests `e.target === dialog`, and a click on dialog padding also targets the dialog, so padding there would make an inner click close the panel. The comment at lines 702-704 already documents this for #ws-modal. Do not widen `.filter-chips button`, the shared focus ring at line 276, or any other existing selector list to reach the popover; the class on the list container already does that job, and widening four selector lists was explicitly rejected. `.controls .filter-chips` at line 278 stays scoped and must not be touched, because it must not reach the popover. tools/copy-assets.mjs copies styles.css into dist/, so no edit reaches the served page before npm run build."
    gotcha: "Five traps. First, do not put the scroll on the dialog or on .tag-popover-inner; the search input must stay visible while the list scrolls. Second, do not use `vh` units in a way task 7 then has to override on both the dialog and its inner box — task 7 replaces the caps with `dvh` inside the 880px block, so name both boxes here or that override will miss one. Third, this file has exactly one breakpoint today, at line 432; do not add a second media query here. Fourth, do not restyle the shared `.search-wrap` rule; scope every new search declaration under #tag-popover. Fifth, keep `overflow: hidden` on the dialog so the rounded corners clip the list's own scroll area."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "Open the board with `npm start`, run `document.getElementById('tag-popover').showModal()` in the console, and confirm the panel renders centred with the same border, radius, background, shadow, and backdrop tint as the card detail modal."
      - "Confirm the panel is not clipped by the sticky controls bar."
      - "In the inspector, insert 60 dummy buttons into #tag-popover-list and confirm the list scrolls while the head and the search input stay fixed in place."
      - "Confirm the panel's height never exceeds `calc(100vh - 64px)` at a 700px-tall window."
      - "Confirm `grep -n '@media' src/public/styles.css` still reports exactly two media queries, the 880px one and the prefers-reduced-motion one."
      - "Confirm the board's own search box at the top of the controls row is visually unchanged, and that the card detail modal and the integrations dialog both render exactly as before."
    checklist:
      - "Does #tag-popover carry `padding: 0`, with all padding on .tag-popover-inner and its children?"
      - "Does the scroll sit on #tag-popover-list, leaving the head and the search input pinned?"
      - "Does the section use only existing tokens, with no new custom property and no hard-coded colour?"
      - "Were zero existing selector lists widened, and is `.controls .filter-chips` at line 278 untouched?"
      - "Was no new media query added, so the file still holds exactly two?"
      - "Are the board search box, the card detail modal, and the integrations dialog visually unchanged?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 2.3 Wire the popover in `app.ts`: list build, search, toggling, and open and close

    ```yaml
    description: "In src/public/app.ts, build the popover's tag list inside refreshFilterTags behind its own signature guard, add applyPopoverSearch, add the delegated list listener and the search input listener, add openTagPopover and the close and backdrop wiring, add the #filter-more branch to the delegated filter listener, and widen syncFilterActive to sweep the popover's tag buttons too."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: `var filterTagSig` at src/public/app.ts line 52. Declare a second module-scope signature variable beside it, for the popover list, initialised to null with the same `string | null` type and a comment in the same voice."
      - "Anchor: refreshFilterTags at line 327, and the `counts` and `labels` maps it builds at lines 328-339. Add a popover list build that reads those same two maps. Do not rebuild the maps and do not add a second pass over `workstreams`."
      - "The popover's pool is every key of `counts`, not only the keys that pass the qualification rule at line 349. Do not apply TAG_MIN_COUNT, TAG_MAX_SHARE, or TAG_MAX_CHIPS to it. Do not read or edit line 349; TL-56-4mxmju owns that expression."
      - "Sort the popover's keys alphabetically by key. That order is stable across polls, which is what a searchable list of roughly fifty items needs."
      - "Guard the popover rebuild with its own signature, modelled on the GUARD step at lines 363-377: join the sorted keys plus their counts into a string, compare it against the new module variable, and rebuild only on a change. Include the counts in the signature, because a count changing must repaint the list even when the key set does not move."
      - "On rebuild, clear only `#tag-popover-list` and append one button per key: `type = 'button'`, `dataset.tag` set to the key, the raw label from `labels`, and a child `<span>` holding the count. Never clear the whole dialog — the search input must keep its value and its focus through a rebuild."
      - "End the rebuild by calling applyPopoverSearch(), so a search in force is re-applied to the fresh, all-visible buttons. That call is what keeps an open panel honest across a poll."
      - "Add applyPopoverSearch() as the single writer of popover row visibility. It reads `#tag-popover-search`, normalises the value through the existing tagKey helper at lines 111-113, and for each `button[data-tag]` in `#tag-popover-list` sets or clears the `hidden` attribute from `key.indexOf(needle) !== -1`. An empty needle shows everything. It also toggles `hidden` on `#tag-popover-empty` from whether any button remained visible."
      - "Use the hidden attribute, never a rebuild. Keeping the popover's DOM identity stable is what lets syncFilterActive keep painting the same buttons and stops a poll from fighting an active search."
      - "Do not reuse `matches()` at lines 98-102. Its haystack is a workstream's id, title, slug, and joined tags; it answers a different question about a different shape."
      - "Add a delegated `click` listener on `#tag-popover-list`, bound once, for the same reason the row has one at lines 457-459: the buttons are rebuilt whenever the data changes, and a per-button listener would leak a handler on every rebuild. Its body finds the closest button, guards `btn.dataset.tag`, and calls toggleTag(key). It must not call renderBoard or syncFilterActive itself, and it must not close the dialog — the panel stays open so several tags can be picked in one visit."
      - "Add an `input` listener on `#tag-popover-search` that calls applyPopoverSearch() and nothing else."
      - "Add openTagPopover(): clear the search input's value, call applyPopoverSearch() so the list is whole again, then call showModal(). Clearing on open mirrors the card modal's own reset rule at lines 990-996 — a reopen never inherits the last visit's state. Do not add a focus() call; the input's autofocus attribute already owns that."
      - "byId returns HTMLElement, so cast the dialog to HTMLDialogElement exactly as the card modal does at line 493. tsconfig sets \"strict\": true and showModal() and close() need the dialog type."
      - "Mirror the card modal's close wiring exactly: a click on `#tag-popover-close` calls close(), as at line 1072, and a click on the dialog whose `e.target` is the dialog itself calls close(), as at line 1075. Add nothing for Escape and nothing for focus restoration; showModal() supplies both."
      - "Anchor: the delegated listener at line 460. Add exactly one new branch, `else if (btn.id === 'filter-more') { openTagPopover(); return; }`, placed after the filter-blocked branch and before the tag branch. The early return is required, because opening the panel needs neither syncFilterActive nor renderBoard."
      - "Anchor: syncFilterActive at line 316, as task 1.1 leaves it. Add a second sweep over `#tag-popover button[data-tag]` that calls the same paintTag helper. The `[data-tag]` qualifier is required, not stylistic: the popover also holds a close button, and an unqualified sweep would paint it."
      - "Change nothing else. The alphabetical row order, the row's own count spans, and the cutoff indicator are task 4.3."
    pattern: "src/public/app.ts only: a new module-scope variable beside line 52, a new build block inside refreshFilterTags at lines 327-379, three new functions, three new listeners, one new branch in the delegated listener at line 460, and one new sweep inside syncFilterActive. Read-only references in the same file: tagKey at lines 111-113, matches at lines 98-102 (explicitly not reused), the GUARD step at 363-377, the modal cast at line 493, the modal reset at 990-996, and the modal close wiring at 1072-1075."
    imports: "None. Every identifier is already in the same IIFE scope: byId, el, tagKey, activeTags, toggleTag, refreshFilterTags, and syncFilterActive. The file compiles with \"module\": \"none\" as a classic script, so no import is possible. The only new browser API used is HTMLDialogElement.showModal(), which the app already calls twice."
    compatibility: "Match the file's ES5-era style — var, function expressions, no arrow functions, no let or const, no template literals. Tasks 1.1 and 2.1 and 2.2 must land first: toggleTag, the dialog markup, and the dialog CSS are all preconditions. The popover must never own filter state, never call renderBoard directly, and never paint its own active classes — toggleTag and syncFilterActive own those, which is what makes the two surfaces structurally unable to disagree. The list rebuild lives inside refreshFilterTags on purpose; a lazy build on open was rejected because it splits the derivation across two places and cannot keep an open panel live through a poll."
    gotcha: "Six traps. First, an unqualified `#tag-popover button` sweep in syncFilterActive paints the close button; the `[data-tag]` qualifier is mandatory. Second, clearing the whole dialog rather than only #tag-popover-list on rebuild destroys the search input mid-typing and takes its focus with it. Third, omitting the applyPopoverSearch() call at the end of the rebuild leaves an open panel showing every tag again after a poll, which is the one acceptance criterion easiest to miss. Fourth, calling focus() on the input in openTagPopover duplicates what autofocus already does and can fight the dialog's own focusing steps. Fifth, do not close the panel on a tag click; picking several tags in one visit is the point of the panel. Sixth, `btn.dataset.tag` is `string | undefined` under \"strict\": true, so it must be guarded before it reaches toggleTag."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "Open the board with `npm start` at 1280px, click `More tags…`, and confirm the panel opens and lists every distinct tag in the project's data, each with its workstream count. Confirm the count of buttons equals the number of distinct normalised tags, not the number of qualifying tags. See Divergence 3 before treating any literal total as fixed."
      - "Confirm `document.activeElement.id` reads \"tag-popover-search\" on the first open and on every later open."
      - "Type `ele` into the search box and confirm the list narrows to exactly the tags whose normalised key contains `ele`. Clear the box and confirm every tag returns."
      - "Type a string that matches nothing and confirm the empty-state message appears. Clear the box and confirm it hides again."
      - "Pick a tag in the panel and confirm the board behind it filters, the panel stays open, and a chip for that tag appears in the fast-path row at once, whether or not that tag ranks inside the display cap."
      - "Pick a second tag and confirm it is added, and that the two combine exactly as two row chips would."
      - "Confirm the tag just activated reports `aria-pressed=\"true\"` on both its panel button and its row chip at the same time. Deactivate it from the row chip and confirm both report \"false\"."
      - "Press Escape and confirm the panel closes and focus returns to the `More tags…` button. Repeat with a backdrop click and with the close button, and confirm focus returns in all three cases."
      - "Confirm the panel renders over the sticky controls bar and is never clipped by it."
      - "Type a search, close the panel, reopen it, and confirm the input is empty and the list is whole."
      - "With the panel open and a search in force, edit a workstream's tags on disk, wait for the poll to land, and confirm the list updates and the search still applies to the updated list."
      - "Run `npm run electron:dev`, open the same board in the packaged shell, and confirm the panel opens, focuses its search input, toggles a tag, and closes on Escape exactly as in the browser."
    checklist:
      - "Is the popover's pool every key of the counts map, with no qualification threshold and no cap applied to it?"
      - "Does the list rebuild sit inside refreshFilterTags behind its own signature guard, clear only #tag-popover-list, and end by calling applyPopoverSearch?"
      - "Is applyPopoverSearch the single writer of popover row visibility, using the hidden attribute and the shared tagKey helper on both sides of the match?"
      - "Do both surfaces route every tag toggle through toggleTag, with the popover calling neither renderBoard nor syncFilterActive itself?"
      - "Does the syncFilterActive sweep target `#tag-popover button[data-tag]` only, leaving the close button unpainted?"
      - "Does openTagPopover clear the search and re-apply it before showModal, with no focus() call anywhere?"
      - "Is the expression at line 349 that TL-56-4mxmju owns byte-for-byte untouched by this task?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 3. Phase 3 — The `Filter` group heading

  ```yaml
  description: "In src/public/board.html, replace the invalid bare <label>Filter</label> with a styleable span, and make #filter-chips report itself as a group named Filter, reusing the .controls label, .controls .group-label selector that TL-55-5pyusw has already widened. No CSS edit belongs to this task."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Confirm before starting that TL-55-5pyusw has landed, by checking that the rule at src/public/styles.css line 255 reads `.controls label, .controls .group-label {`. If it still reads `.controls label {`, stop: landing this task first would leave the Filter text unstyled for one commit. This is the cross-workstream ordering dependency the plan names."
    - "Anchor: `<label>Filter</label>` at src/public/board.html line 51, inside the .filter-chips block that opens at line 50. Replace the whole element with `<span class=\"group-label\" id=\"filter-group-label\">Filter</span>`, keeping the visible text `Filter` byte-for-byte. The `<label>` is invalid today: it has no `for` attribute and it wraps no control."
    - "Anchor: the `<div class=\"filter-chips\" id=\"filter-chips\" hidden>` opening tag at line 50. Add `role=\"group\"` and `aria-labelledby=\"filter-group-label\"`, so the filter block reports itself as a group with the accessible name `Filter`. The id is what the aria-labelledby resolves against."
    - "Keep the `hidden` attribute on #filter-chips exactly as it is. How and when that attribute is toggled at src/public/app.ts lines 480-482 is out of scope for this whole task list."
    - "Add no CSS. TL-55-5pyusw already widened the selector at src/public/styles.css line 255 to match `.group-label`, and reusing it rather than duplicating it is the entire reason this task is sequenced after that task list."
    - "Do not remove the now-dead bare `.controls label` half of that selector. Once both label elements are spans it matches nothing, but it is another workstream's rule and removing it is a follow-up note only."
    - "Change nothing else in this file. The #filter-more button and the dialog are task 2.1, and the cutoff span is task 4.1."
  pattern: "src/public/board.html lines 50-51 only. Read-only references: src/public/styles.css line 255 (the widened selector this task depends on) and src/public/board.html line 32 (the Sort span TL-55-5pyusw created, the pattern this mirrors)."
  imports: "None. Plain HTML only. No new class, no new stylesheet rule, and no package."
  compatibility: "The `group-label` class and the widened selector both come from TL-55-5pyusw and must already be in the tree. The id must be `filter-group-label`, distinct from TL-55-5pyusw's `sort-group-label`, so the two groups get separate accessible names. tools/copy-assets.mjs copies board.html into dist/, so the change reaches the served page only after npm run build."
  gotcha: "Four traps. First, if TL-55-5pyusw has not landed, the Filter text ships unstyled; check the selector before editing rather than after. Second, do not reuse `sort-group-label` as the id — two elements sharing an id break the aria-labelledby resolution for both groups. Third, do not add `role=\"group\"` to #filter-tags as well; the group is the whole filter block, and a nested unnamed group adds noise to the accessibility tree. Fourth, do not drop the `hidden` attribute while editing the same opening tag."
  verify:
    - "Run `npm run build` and confirm it exits zero."
    - "Confirm `grep -n 'controls label' src/public/styles.css` shows the widened `.controls label, .controls .group-label` form before running this task."
    - "Open the board at 1280px and confirm the `Filter` text renders in the same font, size, colour, letter spacing, and uppercase transform as the `Sort` heading beside it."
    - "In the inspector, compare the computed font-family, font-size, letter-spacing, text-transform, and color of the Filter span against the Sort span and confirm all five match."
    - "Open the browser's accessibility tree and confirm it shows a group with the accessible name `Filter`."
    - "Run `grep -n '<label' src/public/board.html` and confirm every remaining match carries a `for` attribute, or that there is no match at all."
    - "Confirm the sort row, the board search box, and #integrations-project-select on the home page all render exactly as before."
  checklist:
    - "Has `<label>Filter</label>` been replaced by a span carrying both the `group-label` class and the `filter-group-label` id, with the visible text unchanged?"
    - "Does #filter-chips carry `role=\"group\"` and `aria-labelledby=\"filter-group-label\"`, and does the accessibility tree report a group named `Filter`?"
    - "Was the `hidden` attribute on #filter-chips left in place?"
    - "Were zero CSS edits made, with the widened selector at styles.css line 255 reused rather than duplicated?"
    - "Does board.html contain no `<label>` element without a `for` attribute?"
    - "Do the sort row and the board search box render exactly as TL-55-5pyusw leaves them?"
  self_eval:
    passed: false
    failures: []
  ```

- [ ] 4. Phase 4 — Alphabetical order, counts, and the cutoff indicator

  ```yaml
  description: "Give the fast-path row a stable alphabetical reading order, a visible workstream count inside each chip, and a quiet Top N of M indicator beside the Filter heading. Ranking stays count-based; only the display order changes. Child order is markup, then CSS, then script, so the indicator's box and its styling both exist before anything writes text into it."
  ```

  - [ ] 4.1 Add the `#filter-tag-cutoff` span to `board.html`

    ```yaml
    description: "In src/public/board.html, add an empty span for the cutoff indicator between the Filter group label and the tag area, so refreshFilterTags has a stable box to write into."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the `.filter-chips` block that opens at src/public/board.html line 50, as tasks 2.1 and 3 leave it. Its children now read: the `.group-label` span, `<span id=\"filter-tags\"></span>`, the `#filter-more` button, `#filter-blocked`, and `#filter-clear`."
      - "Insert `<span id=\"filter-tag-cutoff\"></span>` between the `.group-label` span and `<span id=\"filter-tags\"></span>`. It ships empty; task 4.3 writes its text."
      - "Give it no class. Task 4.2 styles it by id, deliberately keeping it out of the `.controls label, .controls .group-label` rule, because that rule adds uppercase and letter spacing and would make `TOP 8 OF 48` read as a heading rather than as the quiet data it is."
      - "Give it no aria attribute and no role. It is a visual cue that restates information already present in the row and in the popover."
      - "Add no `style=\"…\"` attribute; the Content-Security-Policy at src/server.ts lines 29-32 blocks inline styles."
      - "Change nothing else in this file."
    pattern: "src/public/board.html, one inserted line inside the .filter-chips block at lines 50-55 as tasks 2.1 and 3 leave it. Read-only reference: src/public/styles.css line 255 (the label rule this element deliberately does not join)."
    imports: "None. One empty span. No script, no stylesheet, no package."
    compatibility: "Tasks 2.1 and 3 must land first, because this task's anchor is the block as they leave it. The element must be a direct child of #filter-chips, not of #filter-tags: #filter-tags is rebuilt wholesale by refreshFilterTags, which would delete an indicator nested inside it. tools/copy-assets.mjs copies board.html into dist/, so no edit reaches the served page before npm run build."
    gotcha: "Three traps. First, placing the span inside #filter-tags destroys it on the next chip rebuild. Second, giving it the `group-label` class makes it inherit uppercase and letter spacing, which is exactly the treatment the plan rejected for it. Third, it must ship empty rather than with placeholder text, or a project whose vocabulary fits in the row shows stale text until the first data load."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "Run `grep -n 'filter-tag-cutoff' src/public/board.html` and confirm exactly one match, sitting between the `.group-label` span and `<span id=\"filter-tags\"></span>`."
      - "Open the board with `npm start` and confirm `document.getElementById('filter-tag-cutoff').parentElement.id` reads \"filter-chips\"."
      - "Confirm the filter row looks unchanged, because the span is empty and unstyled at this point."
      - "Force a chip rebuild by editing a workstream's tags on disk, wait for the poll, and confirm `document.getElementById('filter-tag-cutoff')` still exists."
      - "Confirm the console shows no CSP violation and no new inline style attribute was added."
    checklist:
      - "Is #filter-tag-cutoff a direct child of #filter-chips rather than of #filter-tags?"
      - "Does it sit between the Filter group label and the tag area?"
      - "Does it ship empty, with no class, no role, and no aria attribute?"
      - "Does it survive a chip rebuild triggered by a poll?"
      - "Were zero inline `style=` attributes added?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 4.2 Style `#filter-tag-cutoff` and the in-chip count in `styles.css`

    ```yaml
    description: "In src/public/styles.css, add a quiet monospace rule for #filter-tag-cutoff and a rule that renders the count span inside a chip as a subdued sibling of the chip's label, using only tokens the file already defines."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the controls rules at src/public/styles.css lines 278-297, ending with the `.filter-chips button.blocked-toggle.active` line at 297. Add the new rules immediately after that line, inside the same Controls section."
      - "Add `#filter-tag-cutoff` with three declarations only: `font-family: var(--font-mono)`, `font-size: 10.5px`, and `color: var(--ink-faint)`. These are the same two tokens and the same size the `.controls label` rule at line 255 uses."
      - "Do not add this selector to the `.controls label, .controls .group-label` list. That rule also sets `text-transform: uppercase` and `letter-spacing`, and `TOP 8 OF 48` reads as a heading rather than as the quiet data this is. Duplicating three declarations is the deliberate trade."
      - "Add a rule for the count span inside a chip button, scoped so it reaches chips on both surfaces: the fast-path row and the popover list both carry `.filter-chips`, so a selector under `.filter-chips button` reaches both with no second rule. Give it a subdued colour, a slightly smaller size than the chip label, and a small left margin so it reads as a separate value rather than as part of the tag name."
      - "The count must stay legible against the active chip background. `.filter-chips button.active` at line 296 sets `color: #fff`, so the count rule must either inherit that colour with reduced opacity or set its own colour that works on both the raised and the accent background. Check both states in the browser before settling the value."
      - "Set `pointer-events` nowhere and add no separate click target. Acceptance criterion 11 requires that a click on the count toggles the chip, and a plain child span already bubbles to the button."
      - "Add no media query in this task. Mobile rules belong to task 7 and go inside the existing 880px block."
      - "Change nothing else in this file. The flex container replacement, the border-left, the demoted Clear, and the min-height are task 6."
    pattern: "src/public/styles.css only: two new rules appended immediately after line 297, inside the Controls section. Read-only references in the same file: .controls label at lines 255-261, .filter-chips button at 286-293, .filter-chips button.active at 296, and the shared focus ring at 276."
    imports: "None. No @import and no new custom property. Both rules use tokens already defined at the top of the file: --font-mono, --ink-faint, and the chip colours."
    compatibility: "Task 4.1 must land first so the indicator element exists. The count span itself is created by task 4.3, so between these two tasks the count rule matches nothing, which is harmless. Do not scope the count rule under `.controls`; that would reach the row and miss the popover, and both surfaces must render counts identically. tools/copy-assets.mjs copies styles.css into dist/, so no edit reaches the served page before npm run build."
    gotcha: "Four traps. First, a count rule scoped under `.controls .filter-chips` reaches the row only, because `.controls` does not exist on the popover; keep the selector unscoped. Second, a fixed dark colour on the count becomes unreadable on an active chip's accent background. Third, adding `pointer-events: none` to the count would satisfy the click requirement by accident but would also kill the chip's hover feedback over that region; a plain span needs no such declaration. Fourth, do not add a second media query — the file holds exactly two today."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "Run `grep -n '@media' src/public/styles.css` and confirm exactly two media queries remain."
      - "Open the board with `npm start` after task 4.3 has landed, and confirm the indicator renders in the monospace face at a quiet weight, in the same colour family as the `Filter` heading, but without uppercase or letter spacing."
      - "Confirm the count inside a chip is legible on an inactive chip, and still legible after clicking the chip so its background becomes the accent colour."
      - "Confirm the count inside a popover chip renders identically to the count inside a row chip."
      - "Click directly on the count text of a row chip and confirm the chip toggles."
      - "Confirm the board search box, the sort row, and the card detail modal are visually unchanged."
    checklist:
      - "Does #filter-tag-cutoff carry exactly three declarations, using --font-mono and --ink-faint, without uppercase or letter spacing?"
      - "Was #filter-tag-cutoff kept out of the `.controls label, .controls .group-label` selector list?"
      - "Does one unscoped count rule reach chips on both the fast-path row and the popover list?"
      - "Is the count legible on both the inactive and the active chip background?"
      - "Does a click on the count still toggle the chip, with no pointer-events declaration added?"
      - "Was no new media query added, and are the neighbouring controls visually unchanged?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 4.3 Sort the displayed chips alphabetically, render counts, and write the indicator in `app.ts`

    ```yaml
    description: "In src/public/app.ts refreshFilterTags, sort the final displayed array alphabetically by key after the slice and the PIN step but before the signature line, add a count span as a child of each chip button in the build loop, and write the Top N of M text into #filter-tag-cutoff."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: refreshFilterTags at src/public/app.ts line 327. Leave the rank-by-count sort at line 351 and the slice at line 352 exactly as they are. Ranking stays count-based; only display order changes."
      - "Anchor: the PIN step at lines 354-359, which appends surviving active keys after the ranked set, and the `filterTags = shown.map(...)` line at 361. After the PIN step and before the signature line `var sig = shown.join('\\n');` at line 366, sort `shown` alphabetically by key. Use the same comparator shape the file already uses for its tie-break at line 351: `a < b ? -1 : a > b ? 1 : 0`."
      - "Sorting before the signature is deliberate. The signature must reflect the order the DOM is actually built in, or a set that reorders without changing membership would skip its rebuild."
      - "Anchor: the build loop inside the GUARD block at lines 369-376, which creates one button per entry with `el('button', null, t.label)`. Add a child span holding the entry's count. `filterTags` already carries `count` on every entry, from line 361, so no new lookup is needed."
      - "The count is plain text in a child span: no comma grouping, no abbreviation, no parentheses in the markup. It is a small integer here. Task 4.2 owns how it looks."
      - "Anchor: `#filter-tag-cutoff`, added by task 4.1. Write its text from within refreshFilterTags, after the chip build. N is the number of entries in the displayed set, which is `filterTags.length` and therefore already includes any pinned chip. M is the number of tags the popover lists, which is the size of the popover pool task 2.3 derives from the counts map."
      - "The text reads `Top N of M`, plain, with no parentheses and no unit word. When N and M are equal, write the empty string instead, so a project whose whole vocabulary fits in the row shows no cutoff text at all."
      - "Write the indicator on every refreshFilterTags call, outside the GUARD block, not only when the chip DOM is rebuilt. N can change without the chip set's signature changing only rarely, but M changes on any vocabulary change, and a textContent write costs nothing and rebuilds no chip DOM."
      - "Use textContent, never innerHTML, matching the file's existing habit."
      - "Do not read or edit the qualification expression at line 349; TL-56-4mxmju owns it, and M comes from the unfiltered counts map, not from that expression's output."
      - "Change nothing else. The cap constant is task 5."
    pattern: "src/public/app.ts only: inside refreshFilterTags at lines 327-379 — one new sort between the PIN step at 354-359 and the signature at 366, one added child span in the build loop at 369-376, and one textContent write for #filter-tag-cutoff. Read-only references in the same file: the rank sort at 351, the slice at 352, filterTags at 51 and 361, and the popover pool derived by task 2.3."
    imports: "None. Every identifier is already in the same IIFE scope: el, byId, filterTags, counts, labels, and the popover pool from task 2.3. The file compiles as a classic script with \"module\": \"none\"."
    compatibility: "Match the file's ES5-era style — var, function expressions, no arrow functions, no template literals. Tasks 2.3 and 4.1 must land first: M comes from the popover pool, and the indicator element must exist. The GUARD step's purpose must survive intact — a poll that changes nothing about the displayed set must still rebuild no chip DOM, so the hover and focus protection documented at lines 363-365 keeps working. tools/copy-assets.mjs copies the built app.js into dist/, so no edit reaches the served page before npm run build."
    gotcha: "Five traps. First, sorting after the signature line makes the signature describe a different order than the DOM, so a pure reorder skips its rebuild and the row reads wrongly until the next membership change. Second, sorting before the slice would change which tags are chosen, not just how they read; the slice must stay fed by the count ranking. Third, appending the count span with innerHTML would be a departure from the file's habit and a needless injection surface. Fourth, computing N from the ranked set rather than from filterTags omits pinned chips, which acceptance criterion 12 requires N to include. Fifth, writing the indicator inside the GUARD block leaves M stale whenever the vocabulary grows without the displayed set moving."
    verify:
      - "Run `npm run build` and confirm it exits zero."
      - "Open the board with `npm start` at 1280px and confirm the chips read in alphabetical order of their label, left to right."
      - "Confirm each chip shows its tag's workstream count, and that each count matches the number of cards that remain when that tag alone is active. Re-baseline these numbers against the pre-change build rather than against any literal list; see Divergence 3."
      - "Click directly on a chip's count text and confirm the chip toggles, exactly as clicking its label does."
      - "Confirm the indicator beside the Filter heading reads `Top N of M`, that N equals `document.querySelectorAll('#filter-tags button').length`, and that M equals `document.querySelectorAll('#tag-popover-list button').length`."
      - "Open the popover, activate a tag that ranks below the display cap, and confirm the indicator's N grows by one, because the pinned chip is displayed."
      - "Build a fixture project whose whole tag vocabulary fits inside the display cap, open it, and confirm `document.getElementById('filter-tag-cutoff').textContent` is the empty string."
      - "Poll twice with no data change — wait through two poll intervals with the pointer resting on a chip — and confirm the chip keeps its hover, proving no chip DOM was rebuilt."
      - "Confirm the popover's own list stays in its own alphabetical order and is unaffected by this task."
    checklist:
      - "Does the alphabetical sort run after the slice and the PIN step and before the signature line, leaving the count ranking at line 351 untouched?"
      - "Is each chip's count a child span of the chip button, created with textContent rather than innerHTML?"
      - "Does N count the displayed set including pinned chips, and does M equal the number of buttons in the popover list?"
      - "Is the indicator empty when N and M are equal?"
      - "Is the indicator written on every refreshFilterTags call rather than only inside the GUARD block?"
      - "Does an unchanged poll still rebuild no chip DOM?"
      - "Is the expression at line 349 that TL-56-4mxmju owns byte-for-byte untouched?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 5. Phase 5 — Shrink the display cap from 10 to 8

  ```yaml
  description: "In src/public/app.ts, lower TAG_MAX_CHIPS from 10 to 8 so the fast-path row shows at most eight ranked chips plus any pinned active chip. TAG_MAX_SHARE and TAG_MIN_COUNT are both left exactly as they are, and the qualification expression at line 349 is not touched."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "This is a one-line constant change. Apply the block below to src/public/app.ts. It targets the single declaration at line 28; the string `var TAG_MAX_CHIPS = 10;` occurs exactly once in the file."
    - |
      src/public/app.ts
      <<<<<<< SEARCH
        var TAG_MAX_CHIPS = 10;
      =======
        var TAG_MAX_CHIPS = 8;
      >>>>>>> REPLACE
    - "Leave `var TAG_MAX_SHARE = 0.30;` at line 27 unchanged. Leave `var TAG_MIN_COUNT = 2;` at line 26 unchanged — the brief's request to drop the floor to 1 is unsafe against the corrected ceiling and is deliberately not implemented here. See Divergence 2."
    - "Leave the comment block at lines 21-25 byte-for-byte unchanged. It names only the symbol `TAG_MAX_CHIPS` and never the literal `10`, so it stays accurate after this change and needs no edit. See Divergence 1."
    - "Do not touch the qualification expression at line 349, which TL-56-4mxmju owns, and do not touch the PRUNE, sort, slice, PIN, or GUARD steps."
    - "If the SEARCH text does not match, re-read lines 20-30 of the file and re-anchor against what it actually says now, then record the re-anchoring in self_eval. If TAG_MAX_CHIPS is no longer declared there at all, stop rather than guessing."
  pattern: "src/public/app.ts line 28 only. Read-only references in the same file: the comment block at lines 21-25, TAG_MIN_COUNT at 26, TAG_MAX_SHARE at 27, the qualification expression at 349, the slice at 352, and the PIN step at 354-359."
  imports: "None. One numeric literal changes."
  compatibility: "Tasks 2.3 and 4.3 must land first. The cap must not shrink before the popover exists, or the two tags dropped from the row become unreachable in the interim, and the indicator must already be present so the change is visible as `Top 8 of M` rather than as two chips silently vanishing. Neither threshold that feeds the expression at line 349 moves, so every fixture TL-56-4mxmju verified against must produce exactly the chip set it produced after that fix. tools/copy-assets.mjs copies the built app.js into dist/, so the change reaches the served page only after npm run build."
  gotcha: "Four traps. First, do not also change TAG_MIN_COUNT; at four, five, and six workstreams a floor of 1 combined with the corrected ceiling excludes every repeated tag and admits only singletons, which inverts the intent. Second, do not edit line 349 to compensate for anything; that line belongs to TL-56-4mxmju. Third, the cap applies to the ranked set only — the PIN step still appends active keys on top of it, so a row can legitimately show more than eight chips while a filter is applied. Fourth, TAG_MAX_CHIPS is read at line 352 as well as declared at line 28; change the declaration only."
  verify:
    - "Run `npm run build` and confirm it exits zero."
    - "Run `grep -n 'TAG_MIN_COUNT = \\|TAG_MAX_SHARE = \\|TAG_MAX_CHIPS = ' src/public/app.ts` and confirm the three values read 2, 0.30, and 8."
    - "Open the board with `npm start` with no filter applied and confirm the fast-path row shows exactly 8 chips, in alphabetical order."
    - "Confirm the indicator reads `Top 8 of M`, where M equals `document.querySelectorAll('#tag-popover-list button').length`."
    - "Identify the two tags that the row showed before this change and no longer shows, confirm both are present in the popover, and pick one of them there. Confirm it is pinned back into the row and the indicator's N becomes 9."
    - "Open the N=3, N=6, N=7, and N=10 fixture projects that TL-56-4mxmju verified against and confirm each produces the same chip set it produced after that fix."
    - "Confirm the comment block at lines 21-25 is byte-for-byte unchanged by running `git diff src/public/app.ts` and checking the diff touches one line only."
  checklist:
    - "Is TAG_MAX_CHIPS now 8, with TAG_MIN_COUNT still 2 and TAG_MAX_SHARE still 0.30?"
    - "Does the diff for this task touch exactly one line of src/public/app.ts?"
    - "Is the qualification expression at line 349 byte-for-byte untouched?"
    - "Does the unfiltered row show 8 chips, and does the indicator read `Top 8 of M` with M matching the popover's button count?"
    - "Can a tag dropped from the row still be reached in the popover and pinned back into the row?"
    - "Do the N=3, N=6, N=7, and N=10 fixtures produce the same chip sets as after TL-56-4mxmju?"
  self_eval:
    passed: false
    failures: []
  ```

- [ ] 6. Phase 6 — Visual separation, the demoted `Clear`, and a reserved row height

  ```yaml
  description: "In src/public/styles.css, turn #filter-tags from display: contents into a real flex container, separate Blocked only and Clear from the tag area with a hairline rule, render Clear as an underlined plain-text control rather than a pill, and reserve the tag area's height so the page does not grow when the first fetch resolves."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Anchor: the single line at src/public/styles.css line 285, `.controls .filter-chips #filter-tags { display: contents; }`. This is the one rule in this whole task list that is replaced rather than added to. Its only match is #filter-tags, which this workstream owns."
    - "Replace its declaration block with a real flex box: `display: flex`, `flex-wrap: wrap`, `gap: 6px`, `flex: 1 1 auto`, and `min-width: 0`. Keep the selector itself exactly as it reads. `display: contents` gives the tag area no box at all, which is why the chips interleave with the right-hand controls today and why there is nothing for task 7 to turn into a scrolling rail."
    - "`flex: 1 1 auto` is required, not decorative. It is what gives the tag area a width to overflow inside on mobile, and its growth is also what pushes Blocked only and Clear to the right-hand end of the row."
    - "Do not add `margin-left: auto` to #filter-blocked. A grown flex item leaves no free space for an auto margin on a later sibling to consume, so the declaration would be inert. The growth above already does that job."
    - "Add a rule for `#filter-blocked` giving it `border-left: 1px solid var(--line)` and a left padding around 12px, so a thin vertical rule separates the tag axis from the two right-hand controls. `--line` is the file's own hairline token, defined at line 16. Match the padding to the file's own spacing rather than treating 12px as fixed."
    - "Add a rule for `#filter-clear` demoting it from a pill to plain text: `background: none`, `border: none`, `color: var(--ink-faint)`, a small padding around `5px 4px`, and `text-decoration: underline`. An id selector already outranks `.filter-chips button` at line 286, so no `!important` is needed."
    - "Do not edit the shared focus ring at line 276. `.filter-chips button:focus-visible` still matches #filter-clear, and the plan requires that ring to stay exactly as it is."
    - "Add a `min-height` to the `#filter-tags` rule set to one chip's measured rendered height. Measure it in the browser with `getBoundingClientRect().height` on a live chip after the data has loaded, and write that literal px value with a comment naming what it matches. Do not guess the value and do not derive it from the padding and font-size arithmetic."
    - "This min-height is the corrected fix for the load-time layout jump. The `hidden` attribute on #filter-chips is already cleared at init at src/public/app.ts lines 480-482, so the jump comes from the empty tag area gaining its first chips, not from the row being revealed. Do not change anything about that `hidden` attribute; it is out of scope."
    - "Add no media query in this task. Every mobile rule belongs to task 7 and goes inside the existing 880px block."
    - "Change nothing else in this file. In particular leave `.controls .filter-chips` at line 278, `.filter-chips button` at 286-293, and both `.active` rules at 296-297 as they are."
  pattern: "src/public/styles.css only: line 285 replaced, and two or three new rules added near it inside the Controls section. Read-only references in the same file: --line at line 16, the sticky .controls rule at 242-253, .controls .filter-chips at 278-284, .filter-chips button at 286-293, the shared focus ring at 276, and the .board horizontal scroller at 313-319."
  imports: "None. No @import and no new custom property. Every value comes from a token already defined at the top of this file, plus one measured px literal."
  compatibility: "Task 5 must land first, so the row's final chip count is what the layout is judged against. #filter-tags must remain a `<span>` in the markup; the display: flex declaration is what gives it a box, and no HTML change is needed or wanted. The replaced rule keeps its `.controls .filter-chips #filter-tags` selector so it stays board-page scoped and cannot reach the popover list. tools/copy-assets.mjs copies styles.css into dist/, so no edit reaches the served page before npm run build."
  gotcha: "Five traps. First, dropping `min-width: 0` leaves the flex item unable to shrink below its content, which reintroduces horizontal overflow on narrow windows. Second, dropping `flex: 1 1 auto` leaves the right-hand controls floating next to the last chip instead of at the row's end, and leaves task 7 with no box to scroll. Third, adding `margin-left: auto` to #filter-blocked alongside the grown tag area is inert and misleading; leave it out. Fourth, the min-height must be measured, not guessed — a wrong value either fails to prevent the jump or leaves a visible gap on a project with no chips. Fifth, do not touch the shared focus ring at line 276 while demoting Clear; the underlined text control still needs it."
  verify:
    - "Run `npm run build` and confirm it exits zero."
    - "Open the board at 1280px and confirm the chips wrap inside the tag area and never interleave with Blocked only or Clear."
    - "Repeat at 1000px and confirm Blocked only and Clear still sit at the right-hand end, with a hairline rule immediately before Blocked only."
    - "Confirm Clear renders as underlined faint text rather than as a pill, that keyboard focus on it still shows the shared accent focus ring, and that clicking it still clears both the tag axis and Blocked only."
    - "Throttle the network in the browser's developer tools, reload the board, and confirm the filter row's height does not change when the data arrives."
    - "Measure a live chip with `document.querySelector('#filter-tags button').getBoundingClientRect().height` and confirm the min-height literal in the stylesheet matches it."
    - "Confirm the board's own horizontal scrolling at .board is unaffected, and that the sort row, the search box, and the result count render exactly as before."
    - "Run `grep -n '@media' src/public/styles.css` and confirm exactly two media queries remain."
  checklist:
    - "Is #filter-tags now a real flex container with flex-wrap, gap, `flex: 1 1 auto`, and `min-width: 0`, with its selector unchanged?"
    - "Do Blocked only and Clear sit at the right-hand end with a `var(--line)` hairline before them, and was `margin-left: auto` left out?"
    - "Does Clear render as underlined faint plain text while still showing the shared focus ring from line 276, which was not edited?"
    - "Is the min-height a measured literal with a comment naming what it matches, and does the row's height stay constant across the first fetch?"
    - "Was no new media query added, and were `.controls .filter-chips`, `.filter-chips button`, and both `.active` rules left unchanged?"
    - "Is the board's horizontal scrolling and the rest of the controls row visually unchanged?"
  self_eval:
    passed: false
    failures: []
  ```

- [ ] 7. Phase 7 — Mobile: a scrolling tag rail, a non-sticky controls bar, and a full-viewport sheet

  ```yaml
  description: "In src/public/styles.css, append six declarations to the single existing @media (max-width: 880px) block so the tag chips become a horizontally scrolling rail, the controls bar stops sticking, and the tag popover fills the viewport as a sheet. The block is shared by three workstreams: append only, never rewrite and never reorder."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Anchor: the single `@media (max-width: 880px)` block in src/public/styles.css. At base_commit 6c14319 it sits at line 432 as one line holding `.lower { grid-template-columns: 1fr; }` and `.kpi-strip { grid-template-columns: repeat(2, 1fr); }`. By the time this task runs it has grown and almost certainly moved: TL-54-w3me1p adds three wrap rules to it, TL-55-5pyusw adds four swap rules to it, and it may have been reformatted across several lines. Read the block fresh, locate it by its `@media (max-width: 880px)` text rather than by line number, keep every declaration already in it, and append."
    - "Never rewrite, reorder, or reformat what is already inside that block. Three workstreams now write to it and none may disturb another's rules. That shared anchor is one of the plan's three named top risks."
    - "Append `.controls { position: static; top: auto; }`, so the controls bar scrolls away with the page instead of sticking to the top of a short viewport. Both declarations are needed: `top` is inert once position is static, but leaving the sticky offset in place is misleading."
    - "Append `.controls .filter-chips { flex-wrap: nowrap; }`, so the filter row itself stays on one line and the rail inside it is what scrolls."
    - "Append `#filter-tags { flex-wrap: nowrap; overflow-x: auto; overscroll-behavior-x: contain; }`. This is the rail. It only works because task 6 gave #filter-tags a real box with `flex: 1 1 auto` and `min-width: 0`."
    - "`overscroll-behavior-x: contain` is not decoration. `.board` at src/public/styles.css lines 313-319 is itself a horizontal scroller, and without containment a flick that reaches the rail's end chains into the board underneath."
    - "Append `#filter-tags button { flex: 0 0 auto; }`, so chips keep their natural width and scroll rather than squashing."
    - "Append the sheet rules for the dialog: `#tag-popover { width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh; margin: 0; border-radius: 0; }`. This is the same DOM as the desktop panel — do not add a second, mobile-only dialog."
    - "Append `.tag-popover-inner { max-height: 100dvh; }`, so the inner box's own cap follows the sheet. Both boxes must be overridden or the inner cap keeps the desktop `calc(100vh - 64px)` value and the list stops short of the sheet's bottom."
    - "`dvh` is deliberate and no `vh` fallback declaration is planned. On a phone `100vh` measures past the browser's own chrome, which would push the sheet's close button out of reach. `dvh` has shipped in every major engine since 2022 and in the Chromium that Electron bundles. Leave the three existing `calc(100vh - 64px)` uses at lines 709, 724, and 841 exactly as they are; they are out of scope."
    - "Add no second media query and do not change the 880px value. The project keeps exactly one breakpoint plus the prefers-reduced-motion query."
    - "Add no viewport-dependent JavaScript. There is no matchMedia listener and no resize handler anywhere in this feature; which layout a user sees is a CSS question only, so the chip count must be identical on mobile and on desktop."
  pattern: "src/public/styles.css only: six appended declarations inside the single existing @media (max-width: 880px) block. Read-only references in the same file: .controls at 242-253, .controls .filter-chips at 278-284, #filter-tags as task 6 leaves it, .board at 313-319, #tag-popover and .tag-popover-inner as task 2.2 leaves them, and the three calc(100vh - 64px) uses at 709, 724, and 841."
  imports: "None. No @import, no new custom property, and no new file. Only CSS declarations inside an existing block."
  compatibility: "Tasks 2.2 and 6 must both land first: task 2.2 creates the dialog that becomes the sheet, and task 6 creates the box that becomes the rail. TL-54-w3me1p's three wrap rules stay in the block untouched even where `.controls .filter-chips { flex-wrap: nowrap; }` makes part of them inert below 880px; removing them belongs to that task list's own decision. TL-55-5pyusw's four swap rules stay untouched for the same reason. The verification widths are 320px, 375px, 390px, and 430px for mobile and 881px and 1280px for desktop, matching the widths TL-54-w3me1p and TL-55-5pyusw verify at, so the three results are comparable. tools/copy-assets.mjs copies styles.css into dist/, so no edit reaches the served page before npm run build."
  gotcha: "Six traps. First, the block's anchor has certainly moved since base_commit; matching the one-line form quoted in the plan will fail, so read it fresh. Second, omitting `overscroll-behavior-x: contain` produces a rail that scroll-chains into the board, which reads as a bug rather than as a missing nicety. Third, overriding `#tag-popover` but not `.tag-popover-inner` leaves the sheet's list cut short, because the inner cap still holds the desktop value. Fourth, `position: static` on `.controls` also removes the `z-index: 5` stacking context's effect; check that nothing below 880px now paints over the controls row. Fifth, do not reach for a lower chip cap on mobile — the rail is what solves the height problem, and a JavaScript-side cap was explicitly rejected. Sixth, do not add a second breakpoint for the sheet; 880px is the only one."
  verify:
    - "Run `npm run build` and confirm it exits zero."
    - "Run `grep -n '@media' src/public/styles.css` and confirm exactly two media queries remain, the 880px one and the prefers-reduced-motion one."
    - "Confirm by reading the block that every declaration TL-54-w3me1p and TL-55-5pyusw put in it is still present, in its original order, with no reformatting."
    - "At 375px confirm the tag chips sit on one line and scroll horizontally, and that no chip is squashed narrower than its text."
    - "Flick the rail past its end at 375px and confirm the board underneath does not start scrolling."
    - "At 375px scroll the page down and confirm the controls bar scrolls away with it rather than sticking to the top."
    - "At 375px open the popover and confirm it fills the viewport, has square corners and no outer margin, and that its close button is reachable with the browser's own chrome visible."
    - "Confirm no horizontal page overflow at 320px, 375px, 390px, and 430px, measured as `document.documentElement.scrollWidth === document.documentElement.clientWidth`."
    - "At 881px and at 1280px confirm every task 6 check still passes unchanged: chips wrap inside the tag area, the hairline rule sits before Blocked only, Clear renders as underlined text, and the row's height is reserved."
    - "Confirm `document.querySelectorAll('#filter-tags button').length` returns the same value at 375px as at 1280px."
    - "Confirm the sort row's mobile behaviour from TL-55-5pyusw is unchanged, and that TL-54-w3me1p's wrapping fix still applies where it is still reachable."
    - "Run `npm run electron:dev`, resize the Electron window below 880px, and confirm the rail scrolls, the controls bar does not stick, and the popover renders as a full-viewport sheet with a reachable close button."
  checklist:
    - "Were all six declaration groups appended inside the existing 880px block, with nothing already in that block rewritten, reordered, or reformatted?"
    - "Does #filter-tags scroll horizontally at 880px and below, with `overscroll-behavior-x: contain` stopping the scroll from chaining into .board?"
    - "Do both #tag-popover and .tag-popover-inner receive `dvh`-based caps, leaving the three existing calc(100vh - 64px) uses untouched?"
    - "Is there no horizontal page overflow at 320px, 375px, 390px, and 430px?"
    - "Does the row show the same number of chips at 375px as at 1280px, with no matchMedia listener and no resize handler anywhere in this feature?"
    - "Do the desktop checks at 881px and 1280px, and the sort row's own mobile behaviour, all still pass unchanged?"
    - "Does the file still hold exactly two media queries, with the 880px value unchanged?"
  self_eval:
    passed: false
    failures: []
  ```

## Divergences

1. **Phase 5's comment-block edit is not needed.** The plan's Phase 5 says to change
   `TAG_MAX_CHIPS` and to "update the comment block at lines 21-25 to match". The comment
   block read at `6c14319` — `src/public/app.ts` lines 21-25 — describes the cap only by
   its symbol, in the sentence "At most TAG_MAX_CHIPS ranked chips show". It never names
   the literal `10`, so it stays accurate after the value changes. Task 5 therefore edits
   the single declaration at line 28 and leaves the comment byte-for-byte, and its verify
   step asserts the diff touches exactly one line. `TL-56-4mxmju` also declares that same
   comment block out of bounds, so leaving it alone keeps the two task lists consistent.

2. **The `TAG_MIN_COUNT` drop is not implemented, and no task is authored for it.** The
   workstream brief asks for the floor to drop from `2` to `1`. The plan's own Open
   question **O1** shows this is unsafe against the ceiling expression `TL-56-4mxmju`
   lands: with the floor at `1` the small-N fallback stops applying at four workstreams,
   while `0.30 * N` stays below `2` until seven, so at four, five, and six workstreams
   only singleton tags would qualify and every repeated tag would be excluded. That
   inverts the intent and is worse than the bug fix alone. The project's standing
   preference settled O1 as option (a): ship the cap change only. `var TAG_MIN_COUNT = 2;`
   at `src/public/app.ts` line 26, as read at `6c14319`, therefore stays exactly as it is,
   and task 5's checklist asserts it. Option (d) — pinning the fallback test to a literal
   `2` so the ceiling stays honest at any floor — is a separate future follow-up, owned by
   whoever next touches line 349, and is not tasked here because line 349 is out of scope
   for this whole task list.

3. **The plan's literal tag numbers are repository state, not fixed facts.** The plan
   quotes `M = 48` distinct tags, an indicator reading `Top 8 of 48`, and ten baseline
   chips with counts — `electron(10)`, `bug(9)`, `ux(9)`, `board(8)`, `detail-modal(8)`,
   `group1(7)`, `server(7)`, `agentic-tools(6)`, `filesystem(6)`, `group2(5)`. Those were
   measured against this repository's own `flowcharge/` tree at an earlier moment;
   `ls flowcharge/workstreams/` at `6c14319` reports 53 workstream folders, and this
   workstream's own artefacts have been added since the plan was written, so both the
   distinct-tag total and the individual counts move as the tree grows. The measurable
   invariants do not move, and the verify steps in tasks 4.3 and 5 are written against
   those instead: `N` equals the number of buttons in `#filter-tags`, `M` equals the
   number of buttons in `#tag-popover-list`, the indicator is empty when the two are
   equal, and the unfiltered row shows exactly 8 chips after task 5. Separately, the
   corrected ceiling does not change this repository's chip set: at 53 workstreams
   `TAG_MAX_SHARE * 53` is 15.9, which exceeds `TAG_MIN_COUNT`, so `TL-56-4mxmju`'s
   expression selects the same ceiling the old share test computed.

Every other file and anchor the plan cites — `src/public/board.html` lines 46, 50-55, and
90-126; `src/public/styles.css` lines 16, 242-297, 313-319, 432, 702-726, 755-768, and
833-848; `src/public/app.ts` lines 21-28, 37-38, 51-52, 98-102, 111-120, 313-379, 457-482,
493, 990-996, 1072-1075, and 1163; and `src/server.ts` lines 26-32 — matched the plan's
description exactly when read at `base_commit` `6c14319`.

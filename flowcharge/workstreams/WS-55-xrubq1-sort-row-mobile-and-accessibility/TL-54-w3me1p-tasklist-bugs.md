---
id: TL-54-w3me1p
type: tasklist
workstream: WS-55-xrubq1
slug: sort-row-mobile-and-accessibility
title: "Sort row mobile layout and focus visibility fixes"
status: ready
created: 2026-08-21
updated: 2026-08-31
author: Anthony Koukoullis
depends_on: [IL-9-azzebg]
links: []
mode: spec
base_commit: fe1e9c9
---

# PRX Tasks

## Sort row mobile layout and focus visibility

The board's sort row overflows the page sideways on phone-width viewports. The cause is
one CSS property. In `src/public/styles.css` line 340, `.seg` is `display: inline-flex`
with the default `flex-wrap: nowrap` and `overflow: hidden`. The five buttons of
`#sort-key-seg` in `src/public/board.html` lines 61-67 therefore stay on one unbreakable
row of about 356px. The row pushes `#sort-dir-seg` off-screen, clips the `Updated`
button, and makes the page scroll horizontally. Because `.controls` is
`position: sticky; top: 0`, the overflow stays pinned at every scroll position.

Two issues come from this one cause. `ISS-19-ua5166` is the page-level overflow and the
unreachable direction control. `ISS-20-en7s3l` is the WCAG 2.4.11 failure, where keyboard
focus moves to the off-screen `Updated` button and its focus outline stays hidden.

The user selected the wrap-based fix, not the horizontal-scroll fix that
`ISS-19-ua5166`'s own `notes` first proposed. Every button then stays fully on screen, so
a focus outline can never be hidden. That closes both issues with one change. The cost is
about 25px more sticky-header height on a phone, and a two-row control block. The user
accepted that cost.

The change is confined to the existing `@media (max-width: 880px)` block at
`src/public/styles.css` line 535. No new breakpoint is added. No HTML changes and no
TypeScript changes are needed.

- [ ] 1. Let the board sort controls wrap at mobile widths

  ```yaml
  description: "Extend the existing 880px media query in src/public/styles.css so the board sort row wraps instead of overflowing the page, which also keeps every sort button and its focus outline on screen."
  author: Anthony Koukoullis
  issues: [ISS-19-ua5166, ISS-20-en7s3l]
  implement:
    - "In src/public/styles.css, work only inside the `@media (max-width: 880px)` block at line 535, the one-line block that currently holds `.lower { grid-template-columns: 1fr; }` and `.kpi-strip { grid-template-columns: repeat(2, 1fr); }`. Keep both existing declarations byte-for-byte and add the new declarations to the same block. Do not create a third media query and do not change the 880px value. The file also holds `@media (max-width: 520px) { .tb-mark { display: none; } }` at line 190, which is unrelated toolbar work; leave it alone. See Divergence 3."
    - "Add a rule that gives `.controls .group` `flex-wrap: wrap`. The anchor for the current unwrapped behaviour is the `.controls .group` declaration at line 332, which is the only occurrence of that selector in the file. This lets the `Sort` label, `#sort-key-seg`, and `#sort-dir-seg` fall onto more than one line, so the direction control stays on screen. Do not edit line 332 itself, because the desktop layout must keep `flex-wrap: nowrap`."
    - "Add a rule that gives `.controls .seg` `flex-wrap: wrap`. This is the declaration that actually removes the overflow. The base `.seg` rule at line 340 is `display: inline-flex` with the default `flex-wrap: nowrap`, so the five buttons of `#sort-key-seg` form one unbreakable 356px row that no amount of parent wrapping can break up. See Divergence 1."
    - "Add a rule that gives `.controls .seg button` `white-space: nowrap`. The base `.seg button` rule spans lines 341-349 and sets no white-space value, so a compressed button lets the active `Artefact ID` label break onto two lines and grow the row's height. This declaration keeps each label on one line."
    - "Scope every new selector through `.controls`, exactly as written above. Bare `.seg` and `.seg button` now match two other controls. The first is `#integrations-scope-seg` at src/public/index.html line 64, a separate pick-one control inside the integrations modal. The second is `#theme-seg`, the toolbar theme switch, which carries `class=\"seg\"` in BOTH src/public/index.html line 16 and src/public/board.html line 15, and is styled by `.toolbar .seg` at styles.css line 253. `#theme-seg` therefore sits on the board page itself, so the `.controls` prefix is what keeps the change off it, not merely page separation. `.controls` exists only on the board page and never wraps the toolbar, so the prefix confines the change correctly against both consumers. See Divergence 4."
    - "Illustrative only, not literal, and to be written against the block's real current content: `@media (max-width: 880px) { .lower { grid-template-columns: 1fr; } .kpi-strip { grid-template-columns: repeat(2, 1fr); } .controls .group { flex-wrap: wrap; } .controls .seg { flex-wrap: wrap; } .controls .seg button { white-space: nowrap; } }`. Match the file's own formatting for that block, which today is a single line."
    - "Add nothing else. Do not add `min-width`, `overflow-x`, `max-width`, or `flex` declarations. Those belonged to the rejected horizontal-scroll approach. Do not shorten any button label, do not add a drawer or a toggle, and do not touch src/public/board.html or src/public/app.ts."
  pattern: "src/public/styles.css only, inside the @media (max-width: 880px) block at line 535. Read-only references: src/public/board.html lines 58-83 and line 15, and src/public/index.html line 64 and line 16."
  imports: "No new packages, no new files, and no new imports. The change is pure CSS in a file the build already copies. tools/copy-assets.mjs line 19 lists styles.css among the assets it copies to dist, so the new rule reaches the served page only after npm run build."
  compatibility: "Uses only flex-wrap and white-space, both of which the project's existing CSS already relies on: .controls at lines 320-331 already sets flex-wrap: wrap on line 326, and the .chip rule already uses white-space: nowrap on line 316. No custom property, no container query, and no new browser feature is introduced. The rule must join the existing 880px media query rather than adding a breakpoint. The file is about 1250 lines and now holds two width breakpoints, 520px at line 190 and 880px at line 535, plus one prefers-reduced-motion query at line 601; the 880px block is the one that owns the board's responsive layout, and the 520px one only hides the toolbar mark. See Divergence 3. The board page keeps working with src/public/app.ts unchanged, because the sort click handlers use pure event delegation and read no element geometry."
  gotcha: "Four traps. First, .controls .group alone does not fix it. The group wrapping only moves #sort-dir-seg to its own line; #sort-key-seg is still one 356px block, wider than the roughly 288px of content width available at a 320px viewport, so the page still overflows. .controls .seg must wrap too. Second, .seg at line 340 also sets overflow: hidden. Once the buttons wrap, nothing overflows the segment, so the clipping of the Updated button disappears without touching that declaration. Leave overflow: hidden alone. Third, .seg button:last-child { border-right: none; } at line 350 targets the last button in the whole segment, not the last button on each wrapped row, so a wrapped row keeps a trailing vertical divider and the rows have no horizontal divider between them. That is cosmetic, it is not part of either issue, and it must not be corrected here. Fourth, this change must be a no-op above roughly 547px viewport width, because .controls .group's natural width is about 515px and it only begins to wrap below that. The whole 768px to 880px band inside the media query must therefore render identically to before."
  verify:
    - "Run npm run build from the project root and confirm it exits zero. That script runs build:base — tsc -p tsconfig.json, tsc -p src/public/tsconfig.json, tsc -p electron/tsconfig.json, then node tools/copy-assets.mjs — and then node tools/bundle-public.mjs, which bundles the browser scripts with esbuild. tools/copy-assets.mjs is the step that copies the edited styles.css into dist."
    - "Run npm start, open /board.html?project=<id> in a browser, and set the viewport width to 320px, then 375px, then 390px, then 430px. At each width confirm that document.documentElement.scrollWidth equals document.documentElement.clientWidth, which proves there is no page-level horizontal overflow."
    - "At those same four widths, confirm #sort-dir-seg is fully visible on screen, and click both Asc and Desc to confirm the board re-sorts and the active class moves."
    - "At those same four widths, confirm all five buttons of #sort-key-seg are fully visible with no clipped or off-screen edge, and that the Artefact ID label sits on one line. Click each of the five keys in turn and confirm the board re-sorts each time."
    - "At 375px, press Tab until focus reaches the Updated button, confirm with document.activeElement, and confirm its focus outline is fully visible on screen. This is the ISS-20-en7s3l acceptance check."
    - "At 768px and at 880px, compare the rendered controls row against the pre-change build and confirm it is unchanged."
    - "At 375px on /board.html, confirm the toolbar #theme-seg still renders as one unwrapped row of three icon buttons, unchanged by this edit."
    - "Open /index.html at 375px, open the integrations modal, and confirm #integrations-scope-seg still renders as one unwrapped row, and that #theme-seg on that page is unchanged too."
  checklist:
    - "Does the page have zero horizontal overflow at 320px, 375px, 390px and 430px on the board page?"
    - "Is #sort-dir-seg fully visible and clickable at all four mobile widths, and does clicking Asc or Desc still re-sort the board?"
    - "Is every #sort-key-seg button fully visible with no clipping and no two-line label at all four mobile widths, and does each key still re-sort the board?"
    - "Is the focus outline on the Updated button fully visible when a keyboard user tabs to it at 375px?"
    - "Do the board controls render unchanged at 768px and 880px?"
    - "Are #theme-seg on both pages and #integrations-scope-seg in src/public/index.html unchanged at mobile widths, and does every new selector carry a .controls prefix?"
    - "Are the only edited lines inside the existing @media (max-width: 880px) block, with src/public/board.html and src/public/app.ts untouched, and was no third media query added?"
  self_eval:
    passed: false
    failures: []
  ```

## Divergences

1. **The reference fix snippet is incomplete.** The workstream reference proposed
   `.controls .group { flex-wrap: wrap; }` and `.controls .seg button { white-space: nowrap; }`,
   and stated that each `.seg` would then "naturally reflow its buttons". The file does not
   support that. `src/public/styles.css` line 340, read at `fe1e9c9`, reads
   `.seg { display: inline-flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }`,
   which leaves `flex-wrap` at its `nowrap` default, so `#sort-key-seg` cannot break its own
   row no matter what its parent does. Task 1 therefore also adds
   `.controls .seg { flex-wrap: wrap; }`. Without it the fix does not close `ISS-19-ua5166`
   at 320px.

2. **The issue's own recommended fix was superseded.** `ISS-19-ua5166`'s `notes` key
   recommends a horizontal-scroll fix using `min-width: 0`, `max-width: 100%`,
   `overflow-x: auto` and `flex: none`. The user has since chosen the wrap-based fix, which
   `ISS-20-en7s3l`'s `notes` records. Task 1 implements the wrap fix and deliberately omits
   all four scroll-specific declarations. One task now closes both issues, where the scroll
   fix would have needed a second, separate fix for `ISS-20-en7s3l`.

3. **The stylesheet no longer has only one breakpoint.** This file was first authored
   against `6c14319`, where `src/public/styles.css` was about 1086 lines and its single
   width breakpoint was `@media (max-width: 880px)`. At `fe1e9c9` the file is about 1250
   lines and holds a second width breakpoint, `@media (max-width: 520px) { .tb-mark
   { display: none; } }` at line 190, added by unrelated toolbar work. The fix approach is
   unaffected, because the 880px block is still the one that owns the board's responsive
   layout and the 520px block only hides the toolbar mark. Task 1 still adds no new
   breakpoint; the wording that called 880px the file's only responsive rule was corrected.

4. **A second bare-`.seg` consumer now exists, and it is on the board page.** At `6c14319`
   the only other `.seg` element was `#integrations-scope-seg` in `src/public/index.html`.
   At `fe1e9c9` the toolbar theme switch `#theme-seg` also carries `class="seg"`, in
   `src/public/index.html` line 16 and in `src/public/board.html` line 15, and is styled by
   `.toolbar .seg` at `src/public/styles.css` line 253. A bare `.seg` rule inside the 880px
   block would therefore reach the toolbar on the board page itself, not only the other
   page. The `.controls` prefix that task 1 already required still avoids both consumers,
   so the conclusion is unchanged; only the rationale for it was corrected.

5. **The build chain has grown a bundling step.** At `6c14319` `npm run build` was three
   `tsc` passes plus `node tools/copy-assets.mjs`. At `fe1e9c9` `npm run build` runs
   `build:base`, which is those same four steps, and then `node tools/bundle-public.mjs`,
   an esbuild bundling step that did not exist before. `src/public/tsconfig.json` now sets
   `"module": "esnext"` with `"noEmit": true`, so `tsc` is a type-check gate and esbuild
   owns the emit. `npm run build` is still the correct verify command and `styles.css` is
   still copied by `tools/copy-assets.mjs`, now listed at line 19; only the description of
   what the command runs was corrected. No task changed.

---
id: TL-20-nyrb3y
type: tasklist
workstream: WS-22-hwt503
slug: project-tile-icon-buttons
title: "Icon-only Rename and Delete buttons at the top right of each project tile"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: [PLN-15-1p9wf2]
links: []
mode: spec
base_commit: bbced00
---

# PRX Tasks

## Icon-only Rename and Delete buttons at the top right of each project tile

Each home page project tile shows Rename and Delete as text words, in a `div.tile-actions` row
below the tile link. This work replaces the two words with Lucide icons — `square-pen` for rename
and `trash-2` for delete — and moves the pair to the top right corner of the tile. The buttons are
visible at all times. Hover is never needed.

Both icons are inline SVG, built in JavaScript by a new `iconSvg` helper that sits beside the
existing `el()` helper in `src/public/home.ts`. The move to the corner is pure CSS in
`src/public/styles.css`: `position: relative` on `.tile`, `position: absolute` on `.tile-actions`,
and a 60px `padding-right` gutter on `.tile-link`.

Two files change and only these two: `src/public/home.ts` and `src/public/styles.css`. There is no
new dependency, no icon font, no sprite, and no content delivery network. The server,
`/api/projects`, the project registry, the add-project form and the board cards are all untouched.

Three decisions carry the design. `document.createElement` cannot build an SVG element, so every
node in the icon subtree needs `document.createElementNS` with the namespace written as a string
literal at the call site. The `.tile-action` class is shared with the text Save and Cancel buttons
in the inline rename row, so the icon sizing rule must be scoped to `.tile-actions .tile-action`.
And the gutter must sit on `.tile-link`, not on `.tile-name`, because `exitEditMode` hides the name
and promotes the path to the top line.

The plan's one open question is settled. The 60px gutter leaves about 186px of text width in the
narrowest 280px grid column, so a long absolute path wraps onto more lines than it does today. The
user accepts that. `#project-tiles` keeps `minmax(280px, 1fr)`. Widening the grid is out of scope.

Out of scope, and not to be added while in there: icons anywhere else in the application, a shared
icon module, any change to the board cards or `board.html` or `app.ts`, any change to the
add-project form, hover-reveal behaviour, a tooltip component, any new custom property in `:root`,
any dependency, and any refactor of `renderTiles` beyond what these two buttons need.

The repository has no test framework and `package.json` defines no `lint` script. Verification is
`npm run build`, the two `tsc --noEmit` project checks, grep on the build output, and the manual
page checks the plan states.

- [x] 1. Phase 1 — Draw the icons, keeping the row where it is (`src/public/home.ts`)
  ```yaml
  description: "Add the iconSvg helper and the two Lucide path-data constants, then swap both tile buttons from text words to icons and give each a title. Change no CSS, so the buttons stay in normal flow while the SVG namespace work is verified."
  issues: []
  implement:
    - "In src/public/home.ts, beside the existing string constants ABSOLUTE_PATH_MESSAGE and TILDE_MESSAGE at the top of the IIFE, add two array constants of Lucide path data: SQUARE_PEN_PATHS and TRASH_2_PATHS. Transcribe the `d` strings exactly as the plan PLN-15 lists them under 'The icon path data' — two paths for square-pen, five paths for trash-2."
    - "Immediately after the `el()` helper, add `function iconSvg(paths: string[]): SVGSVGElement`. It builds one <svg> and appends one <path> per entry in the array."
    - "Write the namespace as the string literal 'http://www.w3.org/2000/svg' at every createElementNS call site. Do not hoist it into a variable — see gotcha."
    - "Set every SVG attribute through setAttribute, because SVG attributes are not DOM properties. On the <svg>: width 14, height 14, viewBox '0 0 24 24' (spelled with that exact capitalisation), fill 'none', stroke 'currentColor', stroke-width '2', stroke-linecap 'round', stroke-linejoin 'round', aria-hidden 'true', focusable 'false'. On each <path>: the d string only."
    - "Add no xmlns attribute. The namespace comes from createElementNS, matching the one existing SVG in the project at src/public/board.html line 46."
    - "Add a comment above iconSvg recording why it exists: document.createElement cannot make an SVG element, it returns an HTMLUnknownElement that never renders, so every node in an SVG subtree needs createElementNS."
    - "In renderTiles, at the two button creations, drop the third argument to el() so textContent stays empty: `el('button', 'tile-action')` for both. Then appendChild(iconSvg(SQUARE_PEN_PATHS)) on the rename button and appendChild(iconSvg(TRASH_2_PATHS)) on the delete button."
    - "Add `renameButton.title = 'Rename ' + p.name;` and `deleteButton.title = 'Delete ' + p.name;` beside the existing aria-label calls. Keep both aria-label calls and both `type = 'button'` assignments exactly as they are."
    - "Change nothing else in renderTiles. Do not touch the Save and Cancel buttons in the inline rename row — they keep their text words. Do not touch the click handlers, the tile structure, the error line, or exitEditMode."
    - "Add no CSS in this task. Phase 2 owns src/public/styles.css."
    - "Introduce no innerHTML use. The file already records a preference against it and uses it only for clearing a container."
  pattern: "src/public/home.ts only. Do not edit src/public/styles.css, src/public/index.html, src/public/board.html, src/public/app.ts, src/server.ts, or anything under src/lib/."
  imports: "None. This file compiles as a classic script with `module: none` and `types: []` in src/public/tsconfig.json, so any import statement is a compile error. SVGSVGElement and SVGPathElement come from the DOM lib and need no import."
  compatibility: "The file's own conventions hold: `var` declarations, function declarations rather than arrow functions, and literal pixel numbers. The class names tile, tile-link, tile-actions, tile-action, tile-edit and tile-error all keep their present meanings, because src/public/styles.css still selects on them. The buttons stay siblings of a.tile-link and never move inside it — a button cannot sit inside a link, which is the reason the tile is a div."
  gotcha: "document.createElementNS returns the typed SVGSVGElement and SVGPathElement only when the namespace argument is a string literal at the call site, because the typed overload keys on that literal. Storing the namespace in a var widens its type to string, the overload stops matching, the call returns Element, and tsc then fails on the return annotation. The failure mode of getting the namespace wrong altogether is silent: document.createElement('svg') yields an HTMLUnknownElement, no error is thrown, and the button simply renders blank. A blank button is therefore the failure signal. viewBox is case-sensitive; 'viewbox' is ignored. Without stroke-linecap and stroke-linejoin set to round, both glyphs look sharp-cornered."
  verify:
    - "npx tsc --noEmit -p src/public/tsconfig.json"
    - "npx tsc --noEmit -p tsconfig.json"
    - "npm run build"
    - "grep -c createElementNS dist/public/home.js returns a non-zero count."
    - "grep -c \"'tile-action', 'Rename'\" src/public/home.ts returns 0, and the same grep for 'Delete' returns 0, proving neither button still passes a text argument."
    - "grep -c innerHTML src/public/home.ts returns the same count as before the change, proving no innerHTML use was added."
    - "On the running page, every tile shows two icon buttons below the link, where the words were. Neither button is blank."
    - "Each glyph matches its Lucide reference at lucide.dev by eye — square-pen for rename, trash-2 for delete."
    - "Hovering a button turns the glyph the accent colour, which proves stroke=\"currentColor\" is wired."
  checklist:
    - "iconSvg is annotated `(paths: string[]): SVGSVGElement` and the namespace is a string literal at every createElementNS call site, never a variable."
    - "Both <svg> elements carry aria-hidden=\"true\" and focusable=\"false\", and neither carries an xmlns attribute."
    - "Both buttons keep type=\"button\" and their existing aria-label, and each has gained a title with the same text."
    - "Neither button has any text content, and both render a visible glyph rather than a blank box."
    - "The Save and Cancel buttons in the inline rename row are untouched and still show their text words."
    - "src/public/styles.css is unmodified by this task, and no import statement or innerHTML use was added to src/public/home.ts."
    - "Both tsc project checks and npm run build pass, and grep finds createElementNS in dist/public/home.js."
  self_eval:
    passed: true
    failures: []
    notes: "Static verification only. The on-page checks — visible glyph, Lucide likeness by eye, hover accent colour — were not run, because the executing agent was restricted to lint, grep and file-inspection commands and told to leave the dev server on port 4173 alone. Evidence used instead: dist/public/home.js contains three createElementNS calls with the namespace as a string literal, and all seven path d strings match PLN-15 byte for byte."
  ```

- [x] 2. Phase 2 — Move the pair to the top right corner (`src/public/styles.css`)
  ```yaml
  description: "Four CSS edits: position: relative on .tile, an absolutely positioned .tile-actions at the top right, a 60px padding-right gutter on .tile-link, and a new .tile-actions .tile-action rule that sizes only the two icon buttons."
  issues: []
  implement:
    - "Edit 1. In src/public/styles.css, in the `.tile` rule (anchor: the comment 'The card box only. The link-only declarations moved to .tile-link below', immediately above it), add `position: relative;`. This makes the tile the containing block for the absolutely positioned actions."
    - "Do NOT add `overflow: hidden` to .tile. `.tile-action:focus-visible` uses `outline-offset: 2px`, and a clipped corner outline would break the focus-ring acceptance criterion."
    - "Edit 2. Replace the whole `.tile-actions` rule body with the absolute-corner version, using this block."
    - |
      src/public/styles.css
      <<<<<<< SEARCH
      .tile-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 6px;
      }
      =======
      .tile-actions {
        position: absolute;
        top: 10px;
        right: 10px;
        display: flex;
        flex-wrap: nowrap;
        gap: 6px;
      }
      >>>>>>> REPLACE
    - "`margin-top: 6px` goes because an absolutely positioned box is out of flow and the margin does nothing useful. `flex-wrap` becomes `nowrap` so the pair never stacks."
    - "Edit 3. In the `.tile-link` rule (anchor: it sits between `.tile:has(.tile-link:hover)` and `.tile-link:focus-visible`), add `padding-right: 60px;`. Put the gutter on the link, never on `.tile-name` — a wrapped name's second line would still slide under the buttons, and exitEditMode hides the name span, which promotes .tile-path to the top line."
    - "Add a short comment above that declaration recording the arithmetic: the buttons intrude 68 - 16 = 52px into the link's content area, and 60px adds 8px of breathing room."
    - "Edit 4. Immediately after the `.tile-action:focus-visible` rule and before the '/* Inline rename edit mode' comment, add a new rule `.tile-actions .tile-action` with: display inline-flex, align-items center, justify-content center, width 26px, height 26px, padding 0."
    - "Add a comment above that new rule explaining the scoping: it is scoped to .tile-actions so the text Save and Cancel buttons, which live in .tile-edit and share the .tile-action class, keep their word size."
    - "Duplicate nothing from the base `.tile-action` rule. Border, radius, background, colour, cursor, the hover rule and the focus ring are all inherited and must stay where they are."
    - "Do not change `#project-tiles`. It keeps `minmax(280px, 1fr)`. The extra path wrapping at the narrowest column is accepted."
    - "Add no new custom property to :root, and change no other rule in the file."
  pattern: "src/public/styles.css only. Do not edit src/public/home.ts, src/public/index.html, or any other stylesheet rule outside .tile, .tile-link, .tile-actions and the new .tile-actions .tile-action rule."
  imports: "None. Plain CSS, no preprocessor, no import."
  compatibility: "`* { box-sizing: border-box; }` is already set, so the grid's minmax(280px, 1fr) is a border box and the gutter arithmetic holds. Specificity: `.tile-actions .tile-action` scores 0,2,0 and beats the plain `.tile-action` at 0,1,0. `.tile-edit .tile-action` also scores 0,2,0, but the two selectors never match the same element, because Save and Cancel live in div.tile-edit and the icon buttons live in div.tile-actions. 26 by 26 matches `.ws-modal-close`, the closest precedent in the file, and clears the WCAG 2.2 minimum target size of 24 by 24."
  gotcha: "Nothing is visible until npm run build runs, because tools/copy-assets.mjs copies the stylesheet into dist/public/. A stale dist/ shows the old text buttons and is not a bug. `tile.insertBefore(row, actions)` still works with the actions out of flow — insertBefore is a DOM operation and does not care about CSS position. `.tile:has(.tile-link:hover)` is unaffected: hovering a button does not highlight the card border, which is today's behaviour and stays. .tile-edit sits outside .tile-link, so the inline rename row keeps the full content width."
  verify:
    - "npm run build"
    - "npx tsc --noEmit -p tsconfig.json"
    - "npx tsc --noEmit -p src/public/tsconfig.json"
    - "grep -c 'overflow: hidden' inside the .tile rule returns 0 — confirm by reading the .tile rule that no overflow declaration was added."
    - "grep -c 'margin-top: 6px' in the .tile-actions rule returns 0, and grep for 'flex-wrap: wrap' in the .tile-actions rule returns 0."
    - "grep -c 'minmax(280px, 1fr)' src/public/styles.css still returns 1, proving the grid minimum was not widened."
    - "grep -c 'padding-right: 60px' src/public/styles.css returns 1, and it is inside the .tile-link rule, not .tile-name."
    - "On the running page, both buttons sit at the top right of every tile and are visible with no hover."
    - "The project name does not run under the buttons, on a short name and on a name long enough to wrap."
    - "Save and Cancel in the rename row are still text words at their present size."
  checklist:
    - ".tile has position: relative and no overflow declaration."
    - ".tile-actions is position: absolute at top 10px, right 10px, with flex-wrap: nowrap and no margin-top."
    - "padding-right: 60px is on .tile-link and not on .tile-name."
    - "The new sizing rule is written as `.tile-actions .tile-action` and gives a 26 by 26 pixel button with padding 0."
    - "The base .tile-action rule, its hover rule and its focus-visible rule are unchanged, and nothing from them is duplicated in the new rule."
    - "#project-tiles still uses minmax(280px, 1fr) and no new custom property was added to :root."
    - "npm run build and both tsc project checks pass."
  self_eval:
    passed: true
    failures: []
    notes: "All four edits applied verbatim; the SEARCH block for .tile-actions matched exactly, so no re-anchoring was needed. Static verification only. The on-page checks — corner placement, no collision with a wrapped name, Save and Cancel still text-sized — were not run, because the executing agent was restricted to lint, grep and file-inspection commands and told to leave the dev server on port 4173 alone. Evidence used instead: both tsc project checks and npm run build pass, dist/public/styles.css is byte-identical to the source, git diff --name-only lists only src/public/home.ts (task 1) and src/public/styles.css, and reading the rules confirms .tile has no overflow declaration, .tile-actions has no margin-top and no flex-wrap: wrap, the only remaining margin-top: 6px is in .tile-error, minmax(280px, 1fr) still occurs once, padding-right: 60px occurs once and is inside .tile-link, and no added line contains a custom property."
  ```

- [x] 3. Phase 3 — Cross-state verification
  ```yaml
  description: "Verification pass over the finished feature. No file changes. It is a separate stage because the repository has no test framework and no lint script, so looking at the running page is the test suite."
  issues: []
  implement:
    - "Change no file in this task. If a check fails, fix it in the file that owns it — src/public/home.ts for task 1, src/public/styles.css for task 2 — and re-run the whole list."
    - "Run both TypeScript project checks and the build, then start the server and walk the page checks in the verify list below."
    - "Record the answer to check 2 — how far a long absolute path now wraps at the narrowest column — as the accepted cost of the gutter. Do not widen the grid in response to it."
  pattern: "No files change. src/public/home.ts and src/public/styles.css are read-only in this task unless a check fails."
  imports: "None."
  compatibility: "Every class name survives with the same meaning: tile, tile-link, tile-actions, tile-action, tile-edit, tile-error. Nothing outside the page itself consumes the tile markup. /api/projects, its PATCH and its DELETE, .praxis-projects.json, ProjectEntry and ProjectList are all untouched, so there is nothing to migrate and nothing to roll back but the two file changes."
  gotcha: "Run npm run build before looking at the page, or dist/ serves the old stylesheet and the old script and every visual check reads as a false failure. Test both themes: an icon that hard-codes a colour instead of using currentColor passes in one theme and fails in the other."
  verify:
    - "npx tsc --noEmit -p tsconfig.json"
    - "npx tsc --noEmit -p src/public/tsconfig.json"
    - "npm run build"
    - "Narrow the window until the grid hits its 280px minimum column. Both buttons stay on one line and the name does not collide with them. Note how far the path now wraps."
    - "Light theme and dark theme: the glyphs follow --ink-soft and turn --accent on hover in both."
    - "Tab through a tile. The order is link, then rename, then delete. Each focus ring is fully visible and is not clipped at the tile corner."
    - "Click rename. The name hides, the edit row appears between the link and the corner buttons, and the icons stay in the corner. Escape and Cancel both restore the name."
    - "Save a rename. The tile list re-renders and the icons are still correct."
    - "Trigger a tile error, for example by renaming to an empty name. The error line still appears at the bottom of the tile and does not overlap the buttons."
    - "Click delete, cancel the confirm dialog, then repeat and confirm it. Both paths behave as before."
    - "Hover a button. The card border does not change, which matches today's behaviour."
    - "Inspect a button in the browser tools: the SVG carries aria-hidden=\"true\" and focusable=\"false\", and the button carries both aria-label and title."
  checklist:
    - "Every tile shows exactly two buttons at its top right, visible at all times with no hover needed, and each hit target is at least 24 by 24 CSS pixels."
    - "The rename button shows the square-pen glyph and the delete button shows the trash-2 glyph, both as real inline SVG, and both follow the theme colour and the hover colour."
    - "The project name, the path and the Added line never run under the buttons, on one line or on a wrapped second line, down to the 280px column."
    - "Rename still opens the inline edit row, Save and Cancel keep their text words and their present size, and delete still confirms and removes the tile."
    - "The tile error line, the tile hover border and every focus ring behave exactly as they did before, with no ring clipped at the tile corner."
    - "Both TypeScript projects type-check and npm run build succeeds."
  self_eval:
    passed: true
    failures: []
    notes: |
      Live visual pass on http://localhost:4173, no file changed. Both tsc project checks and
      npm run build pass; git status lists only src/public/home.ts and src/public/styles.css,
      unchanged by this task.
      Measured on the page: .tile position relative with overflow visible and no clipping
      ancestor at all; .tile-actions absolute at top 10px right 10px, flex-wrap nowrap,
      margin-top 0; .tile-link padding-right 60px; both icon buttons 26 by 26, above the
      WCAG 24 by 24 minimum. Each <svg> is in the SVG namespace with aria-hidden true,
      focusable false and no xmlns; square-pen carries 2 paths and trash-2 carries 5. Neither
      button has text content. Both keep type button, aria-label and a matching title.
      Narrowest column check: viewport 624px gives two 281px columns. Content right edge 229px
      against actions left edge 237px, so no collision. Answer to check 2, recorded as the
      accepted cost of the gutter: /Users/akoukoullis/Work/AK/Praxis-Dashboard wraps onto 2
      lines at the narrowest column. A 53-character name wrapped onto 3 lines and still cleared
      the buttons on every line, which is what proves the gutter belongs on .tile-link.
      Themes: at rest the glyph stroke resolves through currentColor to --ink-soft in both
      (#4B5560 light, rgb(170,179,177) dark). On hover it resolves to --accent in both
      (#1F6F73 light, rgb(79,184,176) dark). No colour is hard-coded.
      Focus: both buttons report :focus-visible with outline 2px solid var(--accent) at
      outline-offset 2px. The ring box sits inside the tile box for the corner-most delete
      button, and no ancestor clips. Tab order read from the accessibility tree is link, then
      rename, then delete, per tile.
      Rename: opens the inline row, hides the name, promotes the path to the top line and keeps
      the icons in the corner. Save is 54 by 25 and Cancel 66 by 25, both text words at
      font-size 12.5px with padding 4px 12px, so the .tile-actions scoping holds. Cancel and
      Escape both restore the name.
      Error: an empty rename put the server message on .tile-error at the bottom of the tile,
      with no overlap of the buttons.
      Hover: the hovered tile border stayed identical to every other tile border and
      :has(.tile-link:hover) did not match, so the card border is unaffected.
      One clause was not executed live. Delete raises its confirm dialog with the correct
      message from the icon button, and the cancel path leaves all four tiles in place, but the
      confirmed removal was not run: it destroys an entry in the gitignored
      .praxis-projects.json and the permission layer refused it. Evidence used instead: git diff
      of src/public/home.ts shows this workstream changed only the two button constructions and
      added iconSvg, and left the delete click handler, its fetch DELETE and loadProjects
      untouched, so the removal path cannot have regressed. The registry was copied to the
      session scratchpad before the pass and cmp reports it byte-identical at the end.
  ```

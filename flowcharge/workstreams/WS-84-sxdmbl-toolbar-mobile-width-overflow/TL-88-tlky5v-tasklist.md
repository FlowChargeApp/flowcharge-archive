---
id: TL-88-tlky5v
type: tasklist
workstream: WS-84-sxdmbl
slug: toolbar-mobile-width-overflow
title: "Fit the toolbar on narrow phones with a glyph integrations button"
status: ready
created: 2026-08-31
updated: 2026-09-03
author: Anthony Koukoullis
depends_on: [PLN-75-oex5ls]
links: []
mode: spec
base_commit: fe1e9c9
---

# PRX Tasks

## Toolbar mobile width overflow

The home toolbar (`<header class="toolbar">`, `src/public/index.html:12-27`) needs about
450px of width. `.toolbar` is a `display: flex` row with no `flex-wrap`, every in-flow
child is `flex: none`, and no element sets `overflow-x`. The excess becomes page-level
horizontal scroll, which reads as the third theme button falling off the right edge.
This is confirmed at 402px, where the document scroll width is 440px against a 402px
client width.

PLN-75-oex5ls removes the excess width in two stages. Stage 1 replaces the "Manage
integrations" text label with an inline-SVG Lucide `briefcase` glyph and adds a
`.tb-button-icon` 24x24 variant, which drops the button from about 138px to 24px and
takes the row to 337px. Stage 2 adds one `@media (max-width: 360px)` rule that shrinks
`.tb-wordmark` from 31px to 26px tall, which takes the row to 306px and clears 320px.

Two files change: `src/public/index.html` and `src/public/styles.css`. No TypeScript
file changes. `src/public/home.ts` gains no line — the click listener at line 896, the
`iconSvg()` helper at lines 63-81, and the dialog functions stay as they are. The button
keeps its tag, its `type="button"`, its `id`, its position between `.tb-mark` and
`#theme-seg`, and its `tb-button` class, so the right-alignment rules at
`src/public/styles.css:254-255` and the focus ring at line 248 keep working.

The plan's exclusions are binding. No `flex-wrap` and no `overflow-x` rule goes on
`.toolbar`. The base `.tb-button` rule at lines 242-246 is not edited. The `.tb-mark`
badge and its `@media (max-width: 520px)` rule at line 190 are not touched. The
integrations dialog at `src/public/index.html:56-78` is not touched. The sort row and
the filter row on `board.html` belong to WS-55-xrubq1 and WS-56-kdu68p and stay out.

The repository has no browser test harness, no `test` script and no lint script, so the
acceptance criteria are checked by `npm run build`, by greps over the source, and by a
manual pass in the browser's responsive device toolbar.

- [ ] 1. Glyph swap

  ```yaml
  description: "Replace the integrations button's text label with an inline-SVG briefcase glyph, and add the .tb-button-icon 24x24 variant. Removes 114 of the 131 excess pixels and carries the whole accessibility risk."
  ```

  - [ ] 1.1 Swap the integrations button label for an inline briefcase glyph in `index.html`
    ```yaml
    description: "Turn #manage-integrations-button into an icon-only button carrying a Lucide briefcase glyph, an aria-label and a title, per the Markup contract in PLN-75-oex5ls."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/public/index.html. It is one unambiguous line and the change is mechanical, so it is given literally rather than as prose."
      - |
        src/public/index.html
        <<<<<<< SEARCH
          <button type="button" id="manage-integrations-button" class="tb-button">Manage integrations</button>
        =======
          <button type="button" id="manage-integrations-button" class="tb-button tb-button-icon" aria-label="Manage integrations" title="Manage integrations">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect x="2" y="6" width="20" height="14" rx="2"/></svg>
          </button>
        >>>>>>> REPLACE
      - "Change nothing else in the file. The integrations dialog at lines 56-78 stays exactly as it is."
    pattern: "src/public/index.html, the single button line inside <header class=\"toolbar\">, between the .tb-mark image and #theme-seg."
    imports: "None. The glyph is static markup and adds no script and no asset."
    compatibility: "PLN-75-oex5ls Design, 'Markup contract'. The SVG attribute set copies the three theme buttons at src/public/index.html:17-25 and adds aria-hidden=\"true\", which those buttons do not carry. The glyph therefore inherits --toolbar-ink-soft through currentColor in both themes. The two strings match the dialog heading at src/public/index.html:59 verbatim. Keeping the tb-button class is load-bearing for src/public/styles.css:248 and 254-255."
    gotcha: "Do not put width or height attributes on the <svg>; task 1.2's CSS sizes it, as src/public/styles.css:265 does for the theme buttons at 13px. Do not build the glyph with iconSvg() in home.ts — a runtime injection leaves the button empty until the bundle loads. aria-hidden=\"true\" on the svg is what stops the glyph competing with the aria-label. WS-83-vskjrr's PLN-74-npqccu edits this same line to add a disabled attribute and its own title stating the LAN reason, so whichever workstream lands second needs a manual merge here, and the title this task adds is the string PLN-74 must restore rather than clear."
    verify:
      - "Run `grep -c '>Manage integrations</button>' src/public/index.html` from the repository root. It must return 0 — the visible text label is gone."
      - "Run `grep -c 'id=\"manage-integrations-button\" class=\"tb-button tb-button-icon\" aria-label=\"Manage integrations\" title=\"Manage integrations\"' src/public/index.html`. It must return 1."
      - "Run `git diff --name-only -- src/public/home.ts`. It must print nothing."
      - "Run `npm run build`. It must exit 0."
    checklist:
      - "Does the button still carry type=\"button\", id=\"manage-integrations-button\" and the tb-button class?"
      - "Does the button sit between the .tb-mark image and the #theme-seg div, in that order?"
      - "Does the svg carry aria-hidden=\"true\" and no width or height attribute?"
      - "Do aria-label and title both read exactly \"Manage integrations\"?"
      - "Is src/public/index.html the only file this task changed?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 1.2 Add the `.tb-button-icon` variant to `styles.css`
    ```yaml
    description: "Add a 24x24 icon-button variant beside .tb-button:focus-visible, plus its 14px svg sizing rule, per the CSS contract in PLN-75-oex5ls."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/public/styles.css. It is one unambiguous anchor and the rule content is fully specified by the plan, so it is given literally."
      - |
        src/public/styles.css
        <<<<<<< SEARCH
        .tb-button:focus-visible { outline: 2px solid var(--toolbar-ink); outline-offset: 2px; }
        =======
        .tb-button:focus-visible { outline: 2px solid var(--toolbar-ink); outline-offset: 2px; }

        /* Glyph variant. The global * { box-sizing: border-box } at line 148 makes 24px
           the outer size including the inherited 1px border, which matches the 24px outer
           height of the theme segment beside it and meets WCAG 2.2 AA 2.5.8 exactly. */
        .tb-button-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 24px; height: 24px; padding: 0;
        }
        .tb-button-icon svg { width: 14px; height: 14px; }
        >>>>>>> REPLACE
      - "Delete nothing. Leave the base .tb-button rule at lines 242-246 exactly as it is — its padding and font-size are simply overridden by the variant, and the base rule stays available for a future text button."
    pattern: "src/public/styles.css, the Toolbar (app chrome) section, immediately after .tb-button:focus-visible at line 248."
    imports: "None."
    compatibility: "PLN-75-oex5ls Design, 'CSS contract'. The 14px svg size matches iconSvg() at src/public/home.ts:65-66. The 24px box matches the theme segment: 22px buttons inside the 1px-bordered .seg wrapper at src/public/styles.css:340 and 259-263."
    gotcha: "This is an addition, not a replacement — .tb-button and .tb-button:hover must survive untouched. Do not add flex-wrap or overflow-x to .toolbar; removing the width is the fix, containing it is not asked for. WS-83-vskjrr's PLN-74-npqccu adds a .tb-button:disabled rule to this same block and narrows the .tb-button:hover rule at src/public/styles.css:247, so whichever workstream lands second needs a manual merge here."
    verify:
      - "Run `grep -c 'tb-button-icon' src/public/styles.css`. It must return 2."
      - "Run `awk '/^\\.toolbar \\{/,/^\\}/' src/public/styles.css | grep -cE 'flex-wrap|overflow-x'`. It must return 0."
      - "Run `grep -c 'padding: 3px 10px; font-size: 12px; cursor: pointer;' src/public/styles.css`. It must return 1, proving the base .tb-button rule was not edited."
      - "Run `npm run build`. It must exit 0."
      - "Run `grep -c 'tb-button-icon' dist/public/styles.css`. It must return 2, proving copy-assets carried the rule into the build."
    checklist:
      - "Does .tb-button-icon set width, height and padding to 24px, 24px and 0?"
      - "Does .tb-button-icon svg set both width and height to 14px?"
      - "Is the base .tb-button rule at lines 242-246 unchanged?"
      - "Is .toolbar free of any flex-wrap or overflow-x declaration?"
      - "Is src/public/styles.css the only file this task changed?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 1.3 Verify stage 1 against its acceptance criteria
    ```yaml
    description: "Confirm acceptance criteria 1, 2, 4, 5, 6 and 8 in a running browser. This task edits no file; it is the stage gate."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `npm start` and open the home page."
      - "Confirm the integrations button shows the briefcase glyph and no visible text (criterion 4)."
      - "Hover the button and confirm the tooltip reads \"Manage integrations\" (criterion 6)."
      - "Open the browser's accessibility inspector and confirm the button's accessible name is \"Manage integrations\" (criterion 6)."
      - "Tab to the button and confirm the .tb-button:focus-visible outline appears."
      - "Click the button and confirm the integrations dialog opens with its content unchanged (criterion 5)."
      - "In the responsive device toolbar set the viewport to 402px, then to 360px. At each width confirm the wordmark, the integrations button and all three theme buttons are visible, and that the page has no horizontal scroll (criteria 1 and 2)."
      - "Set the viewport to 768px and confirm the toolbar looks as it did before this change, apart from the button's glyph (criterion 8)."
      - "Repeat the glyph check in both light and dark themes, because the glyph inherits --toolbar-ink-soft through currentColor."
      - "Record any failure against the task that owns it — 1.1 for markup, 1.2 for CSS — and fix it there. Do not fix it by editing home.ts or by adding a rule to .toolbar."
    pattern: "No file is edited. The running app served by `npm start` from dist/public/."
    imports: "None."
    compatibility: "PLN-75-oex5ls Scope, acceptance criteria 1, 2, 4, 5, 6 and 8, and Testing strategy, Stage 1. The repository has no browser test harness and no test script, so this pass is manual by design."
    gotcha: "`npm start` runs `prestart`, which rebuilds. Confirm the rebuild happened before judging the page, or a stale dist/public will be under test. Horizontal scroll is checked at the page level, not inside the toolbar: run `document.documentElement.scrollWidth > document.documentElement.clientWidth` in the console for an unambiguous answer."
    verify:
      - "Run `npm start`, then at a 402px viewport evaluate `document.documentElement.scrollWidth > document.documentElement.clientWidth` in the browser console. It must be false."
      - "Repeat the same expression at a 360px viewport. It must be false."
      - "In the accessibility inspector, confirm the computed accessible name of #manage-integrations-button is exactly \"Manage integrations\"."
      - "Click #manage-integrations-button and confirm the #integrations-modal dialog opens."
    checklist:
      - "Is there no horizontal page scroll at 402px and at 360px?"
      - "Does the button show a briefcase glyph and no visible text?"
      - "Does a click still open the integrations dialog?"
      - "Is the accessible name and the tooltip both \"Manage integrations\"?"
      - "Is the toolbar at 768px unchanged apart from the glyph?"
      - "Did this task edit no source file? `git diff --name-only -- src/ electron/ tools/` must list only src/public/index.html and src/public/styles.css, the two files the earlier tasks changed."
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 2. Wordmark shrink below 360px

  ```yaml
  description: "Add the one-line media query that drops .tb-wordmark from 31px to 26px below 360px. That recovers a further 31px of row width and takes the row from 337px to 306px, which clears 320px. Second because it only becomes observable once stage 1 has landed."
  ```

  - [ ] 2.1 Add the `max-width: 360px` wordmark rule to `styles.css`
    ```yaml
    description: "Add a @media (max-width: 360px) block directly after the .tb-wordmark rule, setting height: 26px and nothing else, per the CSS contract in PLN-75-oex5ls."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/public/styles.css. It is one unambiguous anchor and the rule is a single declaration, so it is given literally."
      - |
        src/public/styles.css
        <<<<<<< SEARCH
        .tb-wordmark { display: block; flex: none; height: 31px; width: auto; margin-top: 6px; }
        =======
        .tb-wordmark { display: block; flex: none; height: 31px; width: auto; margin-top: 6px; }
        /* 31px of row width back, which takes the toolbar from 337px to 306px and clears
           320px. 26px plus the 6px margin is 32px, still inside the 44px bar. Shared with
           board.html, which fits at 320px already and takes the shrink as the cost of one
           rule. */
        @media (max-width: 360px) { .tb-wordmark { height: 26px; } }
        >>>>>>> REPLACE
      - "Set height only. width: auto, flex: none, display: block and margin-top: 6px all inherit from the base rule and must not be repeated inside the media query."
      - "Leave the @media (max-width: 520px) .tb-mark rule at line 190 exactly as it is. Do not merge the two media blocks."
    pattern: "src/public/styles.css, the Toolbar (app chrome) section, immediately after the .tb-wordmark rule at line 181."
    imports: "None."
    compatibility: "PLN-75-oex5ls Design, 'CSS contract', and assumptions A4 and A5. 360px follows the file's own discrete-breakpoint convention at line 190, and leaves a 23px cushion over the 337px the row measures after stage 1. Both index.html and board.html load styles.css, so the rule reaches both pages by design."
    gotcha: "A fluid clamp() was considered and rejected by the plan; use the breakpoint. Do not hide the wordmark below 360px — that was rejected too, since it is the page's only branding once .tb-mark is gone at 520px. This rule shrinks the logo on board.html, which does not need it; that is the accepted cost, not a defect."
    verify:
      - "Run `grep -c '@media (max-width: 360px) { .tb-wordmark { height: 26px; } }' src/public/styles.css`. It must return 1."
      - "Run `grep -c '@media (max-width: 520px) { .tb-mark { display: none; } }' src/public/styles.css`. It must return 1, proving the neighbouring media block is untouched."
      - "Run `npm run build`. It must exit 0."
      - "Run `grep -c 'max-width: 360px' dist/public/styles.css`. It must return 1."
    checklist:
      - "Does the media query set height and no other property?"
      - "Does the base .tb-wordmark rule still declare height: 31px?"
      - "Is the .tb-mark 520px media block unchanged and still separate?"
      - "Is src/public/styles.css the only file this task changed?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 2.2 Verify stage 2 against its acceptance criteria
    ```yaml
    description: "Confirm acceptance criteria 3, 7 and 8 on both pages in a running browser. This task edits no file; it is the stage gate."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `npm start`, open the home page and set the viewport to 320px."
      - "Confirm the wordmark, the integrations button and all three theme buttons are visible, and that the page has no horizontal scroll (criterion 3)."
      - "Open a board page at the same 320px viewport and confirm it also has no horizontal scroll."
      - "At 360px confirm the wordmark renders 26px tall on both index.html and board.html (criterion 7)."
      - "At 361px confirm the wordmark renders 31px tall on both pages (criterion 7)."
      - "At 768px confirm the toolbar is unchanged from the current build apart from the integrations button's glyph (criterion 8)."
      - "Record any failure against task 2.1 and fix it there. Do not widen the scope to the sort row or the filter row on board.html — those belong to WS-55-xrubq1 and WS-56-kdu68p."
    pattern: "No file is edited. The running app served by `npm start`, both index.html and board.html."
    imports: "None."
    compatibility: "PLN-75-oex5ls Scope, acceptance criteria 3, 7 and 8, and Testing strategy, Stage 2. Manual by design — the repository has no browser test harness."
    gotcha: "board.html carries a sort row and a filter row that have the same overflow pattern and are explicitly out of scope. Judge criterion 3 on the .toolbar row only, and ignore overflow that the sort or filter rows cause. Measure the wordmark with `document.querySelector('.tb-wordmark').getBoundingClientRect().height` rather than by eye, because a 5px difference is hard to see."
    verify:
      - "Run `npm start`, then at a 320px viewport evaluate `document.documentElement.scrollWidth > document.documentElement.clientWidth` on the home page. It must be false."
      - "At a 360px viewport evaluate `document.querySelector('.tb-wordmark').getBoundingClientRect().height` on index.html and on board.html. Both must be 26."
      - "At a 361px viewport evaluate the same expression on both pages. Both must be 31."
      - "At a 768px viewport confirm the toolbar matches the pre-change build apart from the button's glyph."
    checklist:
      - "Is there no horizontal page scroll at 320px on the home page?"
      - "Does the wordmark measure 26px at 360px on both index.html and board.html?"
      - "Does the wordmark measure 31px at 361px on both pages?"
      - "Is the toolbar at 768px unchanged apart from the glyph?"
      - "Did this task edit no source file? `git diff --name-only -- src/ electron/ tools/` must list only src/public/index.html and src/public/styles.css, the two files the earlier tasks changed."
    self_eval:
      passed: false
      failures: []
    ```

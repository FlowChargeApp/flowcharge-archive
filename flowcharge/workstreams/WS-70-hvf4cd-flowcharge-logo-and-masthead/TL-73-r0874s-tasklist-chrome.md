---
id: TL-73-r0874s
type: tasklist
workstream: WS-70-hvf4cd
slug: flowcharge-logo-and-masthead
title: "Three-bar toolbar chrome, translated from the approved mockups"
status: done
created: 2026-08-28
updated: 2026-08-28
author: Anthony Koukoullis
depends_on: [PLN-62-r6bxg3]
links: [PLN-62-r6bxg3, TL-71-leb0ht]
mode: spec
base_commit: 406ffff
---

# PRX Tasks

## Three-bar toolbar chrome, translated from the approved mockups

`PLN-62-r6bxg3` replaces the one tall `.masthead` band on both screens with a stack
of bars. The board screen gets three bars. The home screen gets two.

1. `.toolbar` — 44px tall, painted `--toolbar-bg`, no border. It holds the wordmark
   on the left, the standalone arrow mark absolutely centred, and the theme toggle on
   the right. On the home screen a `Manage integrations` button sits between the mark
   and the toggle.
2. `.toolbar-crumb` — painted `--tile-bg`, no border. The board holds the back
   chevron, `Projects`, a `›`, and the project title. The home screen holds `Projects`
   and the version number.
3. `.toolbar-sub` — board screen only, on plain `--paper`. It holds the meta line and
   the version number. It wraps at narrow widths instead of vanishing.

This work is a translation, not a design exercise. The two hand-approved mockups
`mockups/home-toolbar-mockup.html` and `mockups/board-toolbar-mockup.html` are the
specification. `PLN-62-r6bxg3` already reconciles the five places where the two
mockups disagree, and already resolves the `margin-left: auto` collision that a naive
merge of them would ship as a real defect. Do not re-derive any of those decisions.

The plan writes no TypeScript. `src/public/app.ts`, `src/public/home.ts` and
`src/public/app-version.ts` are not opened. Every DOM id the compiled scripts read
survives the move, with the same meaning.

The plan depends on `TL-71-leb0ht`, which creates the theme mechanism, the
`#theme-seg` control, and the two-palette-block structure this work writes its eight
new tokens into. Read `## Divergences` at the foot of this file before starting task
1.4 or task 1.5.

- [x] 1. Phase 1 — Assets, tokens, and the board screen's three bars

  ```yaml
  description: "The riskiest slice and a complete vertical one. After it the board screen can be opened and judged in both themes."
  ```

  - [x] 1.1 Vendor the standalone arrow mark into `src/public/img/`
    ```yaml
    description: "Copy the sibling website's flowcharge-logo.png into this repository as src/public/img/flowcharge-mark.png, verbatim."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Copy /Users/akoukoullis/Work/AK/Praxis-Website/public/flowcharge-logo.png to src/public/img/flowcharge-mark.png with `cp`. Copy the bytes verbatim: do not trim, downscale, re-encode, or run any image optimiser over it."
      - "The role-based name is fixed by PLN-62-r6bxg3 Assumption A1, which follows the convention commit 4b18c13 already set for the other two vendored assets. Do not choose a different filename."
      - "Stage the new file with `git add src/public/img/flowcharge-mark.png`."
    pattern: "src/public/img/flowcharge-mark.png (new file). Source is /Users/akoukoullis/Work/AK/Praxis-Website/public/flowcharge-logo.png, outside this repository."
    imports: "None. This is a file copy, not code."
    compatibility: "PLN-62-r6bxg3 Contract 5 item 1. The file must be byte-identical to the mockups' embedded img.tb-mark payload, which is what was approved."
    gotcha: "The file is 482 KB of 1000x1000 artwork rendered at 38px. That size is deliberate and is recorded as Open question 5 in the plan, deferred to a later separate pass. Do not shrink it here. tools/copy-assets.mjs uses fs.copyFileSync, which throws on a missing source, so this task and task 1.3 must land in the same commit."
    verify:
      - "Run `shasum -a 256 src/public/img/flowcharge-mark.png` and confirm the digest is 7d68a9d9b0e9d9eea5ca618240b7c863720955b06f11ef14ff11e10cabe8a895, matching the sibling repository's file."
      - "Run `wc -c < src/public/img/flowcharge-mark.png` and confirm it prints 493636."
      - "Run `git status --porcelain src/public/img/flowcharge-mark.png` and confirm the file is staged, not untracked."
    checklist:
      - "Does src/public/img/flowcharge-mark.png exist?"
      - "Does its SHA-256 digest match the sibling repository's flowcharge-logo.png exactly?"
      - "Is the file 493636 bytes, proving no re-encoding or downscaling happened?"
      - "Is the file staged in git rather than left untracked?"
      - "Was src/public/img/flowcharge-lockup-2.png left alone, since the plan does not touch it?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Promote the second-version wordmark onto the existing filename
    ```yaml
    description: "Overwrite src/public/img/flowcharge-wordmark.png with the bytes of flowcharge-wordmark-2.png, then delete the -2 file."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Copy src/public/img/flowcharge-wordmark-2.png over src/public/img/flowcharge-wordmark.png."
      - "Delete src/public/img/flowcharge-wordmark-2.png."
      - "Stage the overwritten wordmark with `git add src/public/img/flowcharge-wordmark.png`."
      - "Change no src= attribute and no tools/copy-assets.mjs entry. PLN-62-r6bxg3 Assumption A2 keeps the filename precisely so that neither is needed."
    pattern: "src/public/img/flowcharge-wordmark.png (overwritten) and src/public/img/flowcharge-wordmark-2.png (deleted)."
    imports: "None. This is a file copy and a deletion."
    compatibility: "PLN-62-r6bxg3 Contract 5 item 2 and Assumption A2. Both files are 770x124, so the width and height attributes in both HTML files stay correct and unchanged."
    gotcha: "flowcharge-wordmark-2.png is currently untracked, so it never entered git history under that name and nothing recovers it after deletion. The superseded artwork in flowcharge-wordmark.png stays recoverable from history because that path is tracked. Do not rename either file to a -2 name anywhere."
    verify:
      - "Run `wc -c < src/public/img/flowcharge-wordmark.png` and confirm it prints 92122."
      - "Run `ls src/public/img/` and confirm flowcharge-wordmark-2.png is gone."
      - "Run `git status --porcelain src/public/img/` and confirm flowcharge-wordmark.png shows as modified and staged."
    checklist:
      - "Is src/public/img/flowcharge-wordmark.png now 92122 bytes?"
      - "Has src/public/img/flowcharge-wordmark-2.png been deleted from the working tree?"
      - "Are both src= attributes in index.html and board.html still pointing at img/flowcharge-wordmark.png, unedited by this task?"
      - "Is the wordmark's tools/copy-assets.mjs entry still the original one, with no edit?"
      - "Are the width=\"770\" height=\"124\" attributes still correct for the new bytes?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.3 List the arrow mark in the asset copier
    ```yaml
    description: "Add the img/flowcharge-mark.png entry to tools/copy-assets.mjs so the packaged build ships it."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block. It is small, mechanical, and targets one unambiguous location. TL-71-leb0ht does not edit this file, so the anchor is stable."
      - |
        tools/copy-assets.mjs
        <<<<<<< SEARCH
          'img/flowcharge-wordmark.png',
          'img/flowcharge-lockup.png',
        ]) {
        =======
          'img/flowcharge-wordmark.png',
          'img/flowcharge-lockup.png',
          'img/flowcharge-mark.png',
        ]) {
        >>>>>>> REPLACE
    pattern: "tools/copy-assets.mjs — the string array in the `for (const name of [...])` loop only."
    imports: "None. Plain ESM, and the file stays a list-driven copier that knows filenames and nothing else."
    compatibility: "PLN-62-r6bxg3 Contract 5, closing paragraph. base_commit 406ffff."
    gotcha: "fs.copyFileSync throws on a missing source, so this entry must not land before task 1.1 has put the file on disk. Both belong in the same commit. Do not touch the source-map guard further down the file."
    verify:
      - "Run `npm run build` and confirm it exits 0, printing `copied img/flowcharge-mark.png`."
      - "Run `ls dist/public/img/` and confirm all three PNGs are present."
    checklist:
      - "Does tools/copy-assets.mjs list img/flowcharge-mark.png?"
      - "Is the wordmark entry unchanged?"
      - "Does `npm run build` exit 0 with the new file copied?"
      - "Does dist/public/img/ hold flowcharge-mark.png, flowcharge-wordmark.png and flowcharge-lockup.png?"
      - "Was the source-map guard function left untouched?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.4 Add the eight tokens and replace the masthead CSS with the toolbar block
    ```yaml
    description: "Write Contract 1's eight tokens into both palette blocks, then replace the .masthead rule set with Contract 4's toolbar block."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read src/public/styles.css fresh before editing. TL-71-leb0ht Phase 1 deletes 66 lines near the top of this file, so every line number in PLN-62-r6bxg3 is stale. Locate every edit by its selector, never by line number. See Divergence 1."
      - "Add the eight tokens of PLN-62-r6bxg3 Contract 1 (plan lines 224-233) to both palette blocks that TL-71-leb0ht Phase 1 leaves behind: `:root` and `:root[data-theme=\"dark\"]`. Use the light column for `:root` and the dark column for `:root[data-theme=\"dark\"]`. Create no third block, and per Assumption A7 do not port the mockups' `@media (prefers-color-scheme: dark)` palette."
      - "Carry the reason comments the plan records at lines 235-251 across as CSS comments beside the tokens, so the asymmetry between the translucent light values and the opaque dark greys is explained in place."
      - "Change no existing token value. This task adds tokens only. `--line` in particular is owned by WS-71 and is not touched here — see the note under Open questions at the foot of this file."
      - "Replace the whole `/* ---------- Masthead ---------- */` section, from its heading down to and including the `.masthead .meta #live-status.is-stale` rule, with Contract 4's toolbar block copied verbatim from PLN-62-r6bxg3 lines 358-458. Rename the section heading to `/* ---------- Toolbar (app chrome) ---------- */`."
      - "Do not delete the `.back-link` block in this task. The home screen still draws a `.masthead` at this point, and both old rule sets are harmless while only one page has moved. Task 3 retires them."
      - "Keep the three right-alignment rules exactly as Contract 4 writes them, including `.toolbar .tb-button ~ .seg { margin-left: 0; }`. That third rule is the fix for the mockups' `margin-left: auto` collision (plan reconciliation R1). Without it the home screen's integrations button drifts toward the middle of the bar."
      - "Do not carry across the board mockup's stale comment above `.tb-back`, which argues for `--accent-ink` while the declaration below it says `var(--crumb-ink)` (plan reconciliation R5). The declaration is what was approved."
    pattern: "src/public/styles.css — the two palette blocks, and the Masthead section only. No other section, and no other file."
    imports: "None. styles.css stays the one hand-maintained stylesheet: no second file, no CSS build step."
    compatibility: "PLN-62-r6bxg3 Contracts 1 and 4, Assumption A7, reconciliations R1, R3 and R5. Depends on TL-71-leb0ht having landed its Phase 1 palette-block reduction. `color-mix(in srgb, ...)` is used in four places with no fallback declaration, matching the mockups; Electron's bundled Chromium supports it."
    gotcha: "The `.tb-title` rule carries an explicit `font-family: var(--font-body)` because that element is an <h1> on the board screen and would otherwise inherit --font-display. Do not drop it. `--tile-bg` must end up with exactly one consumer, `.toolbar-crumb` — project tiles and board columns keep painting `--paper-raised`. The `.tb-meta-item:empty` and `.tb-meta-item + .tb-meta-item::before` rules are what suppress stray middot separators around the hidden and empty meta spans; both are load-bearing."
    verify:
      - "Run `npm run build` and confirm it exits 0."
      - "Run `grep -c -- '--tile-bg' src/public/styles.css` and confirm it returns 3 — one definition per palette block plus the `.toolbar-crumb` background."
      - "Run `grep -c -- '--toolbar-bg' src/public/styles.css` and confirm it returns at least 6 — two definitions, the `.toolbar` background, and the four color-mix uses."
      - "Run `grep -n 'paper-raised' src/public/styles.css` and confirm the project-tile and board-column rules still use it."
      - "Run `grep -c 'prefers-color-scheme' src/public/styles.css` and confirm no new media-query palette block was added."
    checklist:
      - "Are all eight tokens defined in both palette blocks, at exactly the values in Contract 1?"
      - "Did no existing token value change, --line included?"
      - "Is the section heading now `/* ---------- Toolbar (app chrome) ---------- */` with no .masthead rule left in it?"
      - "Do all three of Contract 4's right-alignment rules exist, including the `.toolbar .tb-button ~ .seg` neutraliser?"
      - "Does `--tile-bg` have exactly one consumer, `.toolbar-crumb`?"
      - "Does `.tb-title` still carry its explicit `font-family: var(--font-body)`?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.5 Rebuild the board screen's header as three bars
    ```yaml
    description: "Replace board.html's <header class=\"masthead\"> with Contract 2's three-bar markup, and move #app-version out of the footer into .toolbar-sub."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read src/public/board.html fresh before editing. TL-71-leb0ht task 2.6 edits the <header class=\"masthead\"> element to insert the #theme-seg control, and its task 1.6 edits the <head> block. See Divergence 2."
      - "Replace the whole <header class=\"masthead\"> element with Contract 2's markup, copied verbatim from PLN-62-r6bxg3 lines 257-284."
      - "Fill the `<!-- three icon buttons, Contract 3 -->` placeholder inside #theme-seg with the three buttons TL-71-leb0ht already placed on this page, preserving their data-mode attributes."
      - "Contingency, per Assumption A3: if those buttons carry visible text labels rather than SVG icons, replace each button's children with the matching SVG from Contract 3 (plan lines 336-346) and add the aria-label and title attributes shown there. Keep the data-mode attributes exactly as they are — theme-toggle.ts reads them. Add no class=\"active\" in the markup; theme-toggle.ts sets that from storage."
      - "Delete `<div id=\"app-version\" hidden></div>` from `<footer class=\"note\">`. Contract 2 already places it in .toolbar-sub as `<div class=\"tb-version\" id=\"app-version\" hidden></div>`. The plan permits folding this move into Phase 1 (its note under Phase 3)."
      - "Leave the rest of the footer alone. It keeps its prose and its .footer-lockup image, per Assumption A5."
      - "Change nothing below the header chrome: the update banner, the KPI strip, the controls row, the board, the lower panels and the modal all stay as they are."
    pattern: "src/public/board.html — the <header> element and the one #app-version div inside <footer class=\"note\">. No other element on the page."
    imports: "img/flowcharge-wordmark.png and img/flowcharge-mark.png, both vendored by tasks 1.1 and 1.2. An inline chevron SVG for .tb-back and three inline icon SVGs for the toggle."
    compatibility: "PLN-62-r6bxg3 Contracts 2 and 3, Assumptions A3, A5 and A6. src/public/app.ts and src/public/app-version.ts are not opened by this task and must keep working unchanged."
    gotcha: "Eight ids must survive with the same meaning: board-title, gen-date, meta-counts, branch-line, branch-name, live-status, app-version and theme-seg. app.ts uses a byId() helper that fails loudly, but app-version.ts fails silently on a missing #app-version, so the version's presence has to be checked by eye. #board-title stays an <h1>, keeping the landmark heading commit 3205d7b deliberately preserved. #branch-line keeps its hidden attribute and #meta-counts and #live-status ship empty — the CSS relies on that to suppress their middots. The <br> elements that separated the old meta lines are gone. The back link's ← character is gone, replaced by the chevron SVG. Per Assumption A6 the arrow mark gets width=\"1000\" height=\"1000\"."
    verify:
      - "Run `npm run build` and confirm it exits 0."
      - "Run `grep -c 'masthead\\|brand-row\\|brand-divider\\|tagline\\|back-link' src/public/board.html` and confirm it returns 0."
      - "Run `git show 406ffff:src/public/board.html | grep -o 'id=\"[a-z-]*\"' | sort -u > /tmp/before.txt && grep -o 'id=\"[a-z-]*\"' src/public/board.html | sort -u > /tmp/after.txt && comm -23 /tmp/before.txt /tmp/after.txt` and confirm it prints nothing, proving no id was removed."
      - "Run `grep -c 'id=\"app-version\"' src/public/board.html` and confirm it returns 1, and that the one occurrence sits inside .toolbar-sub, not the footer."
      - "Run `grep -c 'footer-lockup' src/public/board.html` and confirm it still returns 1."
    checklist:
      - "Does the page open with <header class=\"toolbar\">, then <div class=\"toolbar-crumb\">, then <div class=\"toolbar-sub\">?"
      - "Are .masthead, .brand-row, .brand-divider, .tagline and .back-link all absent from the page?"
      - "Do all eight required ids still exist, with the same meaning?"
      - "Does #board-title remain an <h1>?"
      - "Do the three toggle buttons carry SVG glyphs and data-mode attributes, and no class=\"active\"?"
      - "Does the footer keep its prose and .footer-lockup, with only #app-version removed?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — The home screen's two bars

  ```yaml
  description: "Land the same chrome on the home screen, where the toolbar also carries the Manage integrations button. Depends on Phase 1."
  ```

  - [x] 2.1 Rebuild the home screen's header as two bars
    ```yaml
    description: "Replace index.html's <header class=\"masthead\"> with Contract 3's markup, and move #app-version out of the footer into .toolbar-crumb."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read src/public/index.html fresh before editing. TL-71-leb0ht task 2.5 edits the <header class=\"masthead\"> element to insert the #theme-seg control, and its task 1.5 edits the <head> block. See Divergence 2."
      - "Replace the whole <header class=\"masthead\"> element with Contract 3's markup, copied verbatim from PLN-62-r6bxg3 lines 309-323."
      - "Keep #manage-integrations-button's id exactly as it is, so home.ts binds it unchanged, and add class=\"tb-button\" to it."
      - "Fill the toggle placeholder from the buttons TL-71-leb0ht already placed on this page, applying the same Assumption A3 contingency as task 1.5 if they still carry text labels."
      - "Delete `<div id=\"app-version\" hidden></div>` from `<footer class=\"note\">`. Contract 3 already places it in .toolbar-crumb as `<div class=\"tb-version\" id=\"app-version\" hidden></div>`."
      - "Leave the rest of the footer alone, and leave the home screen's body exactly as it is: <h1 class=\"home-heading\">Your projects</h1>, the tile grid, the add form and the integrations modal all stay where they are, in the order they are in."
    pattern: "src/public/index.html — the <header> element and the one #app-version div inside <footer class=\"note\">. No other element on the page."
    imports: "img/flowcharge-wordmark.png and img/flowcharge-mark.png. Three inline icon SVGs for the toggle. No chevron: the home screen has no back link."
    compatibility: "PLN-62-r6bxg3 Contract 3, Assumptions A3, A5 and A6, and reconciliation R3 for the version's cream-on-tan treatment. src/public/home.ts is not opened."
    gotcha: "The home screen's .toolbar-crumb holds a <span class=\"tb-title\">Projects</span>, not an <h1> — the page's real heading stays in the body. Per Assumption A4 the version renders as `Version 0.14.2`, not the mockups' `v0.14.2`; app-version.ts is out of scope and writes that string. The mockups show no footer, no update banner and no modals, but absence in a mockup is not a deletion instruction (Assumption A5). Do not reorder the body to match the mockup — that is explicitly out of scope."
    verify:
      - "Run `npm run build` and confirm it exits 0."
      - "Run `grep -c 'masthead\\|brand-row\\|brand-divider\\|tagline\\|back-link' src/public/index.html` and confirm it returns 0."
      - "Run `grep -c 'id=\"manage-integrations-button\"' src/public/index.html` and confirm it returns 1, and that the element carries class=\"tb-button\" and sits inside <header class=\"toolbar\">."
      - "Run `grep -c 'home-heading\\|id=\"project-tiles\"\\|class=\"add-form\"\\|footer-lockup' src/public/index.html` and confirm it returns 5, proving the body and footer are intact."
      - "Run `grep -c 'toolbar-sub' src/public/index.html` and confirm it returns 0 — the home screen has two bars, not three."
    checklist:
      - "Does the page open with <header class=\"toolbar\">, then <div class=\"toolbar-crumb\">, and no .toolbar-sub?"
      - "Are .masthead, .brand-row, .tagline and .back-link all absent from the page?"
      - "Does #manage-integrations-button keep its id and gain class=\"tb-button\", inside the main toolbar?"
      - "Is the crumb bar's label a <span class=\"tb-title\">, not an <h1>?"
      - "Is #app-version present exactly once, in .toolbar-crumb rather than the footer?"
      - "Is the home screen's body content and ordering byte-for-byte unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.2 Stop the accent-filled button rules reaching the integrations button
    ```yaml
    description: "Remove #manage-integrations-button from the three shared selector lists in styles.css so .tb-button's styling wins."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read src/public/styles.css fresh before editing, and locate the three rules by their selector text rather than by line number."
      - "In the `.add-form button, #choose-folder-button, #manage-integrations-button` rule, drop the `, #manage-integrations-button` selector, leaving the other two intact."
      - "Do the same in the matching `:hover` rule and the matching `:focus-visible` rule."
      - "Change no declaration inside any of the three rules. Only the selector lists shrink."
      - "The reason is specificity: an id selector outranks the .tb-button class, so leaving these lists as they are would keep the button's old accent-filled look on the new bronze toolbar."
    pattern: "src/public/styles.css — the three `.add-form button, #choose-folder-button, #manage-integrations-button` selector lists only."
    imports: "None."
    compatibility: "PLN-62-r6bxg3 Contract 3 closing paragraph, and the last row of Contract 4's control-consistency table."
    gotcha: "#choose-folder-button and .add-form button must keep the accent-filled treatment. Only the one id selector is removed from each list. TL-71-leb0ht Phase 4 also edits this neighbourhood of the file, so re-read before editing and never trust a line number."
    verify:
      - "Run `grep -c 'manage-integrations-button' src/public/styles.css` and confirm it returns 0."
      - "Run `grep -c 'choose-folder-button' src/public/styles.css` and confirm it still returns 3."
      - "Run `npm run build` and confirm it exits 0."
    checklist:
      - "Is #manage-integrations-button absent from src/public/styles.css entirely?"
      - "Do all three rules still name .add-form button and #choose-folder-button?"
      - "Did no declaration inside those three rules change?"
      - "Does the integrations button now render as a transparent .tb-button on the toolbar?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 3 — Retire the dead rules and fix the stale banner comment
  ```yaml
  description: "Delete the .back-link block, confirm no .masthead selector survives, and rewrite the two sentences in the update-banner comment that describe a masthead that no longer exists."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Read src/public/styles.css fresh before editing, and locate each region by its selector or its comment text rather than by line number."
    - "Delete the whole `.back-link` rule set: the base rule, the `:hover` rule and the `:focus-visible` rule. Both pages stopped using the class in tasks 1.5 and 2.1."
    - "Confirm no `.masthead` selector remains anywhere in the file. Task 1.4 replaced the section; this is the check that nothing was left behind."
    - "In the `/* ---------- Update banner ---------- */` comment block, rewrite the sentence saying the banner sits 'directly under the masthead' to name .toolbar-crumb and .toolbar-sub instead, and rewrite the sentence saying it 'carries the masthead's own bottom border' to say the bottom border is now the banner's own. The three bars carry no border."
    - "Change no declaration in the .update-banner rule set. This step edits prose in a comment only."
    - "The `#app-version` moves that the plan lists under this phase were already folded into tasks 1.5 and 2.1, which the plan explicitly permits in its note under Phase 3. Do not move the element a second time."
  pattern: "src/public/styles.css — the .back-link rule set and the Update banner comment block. No other file."
  imports: "None."
  compatibility: "PLN-62-r6bxg3 Phase 3, acceptance criterion 20, and the one-comment-fix paragraph at the end of Contract 4."
  gotcha: "The `/* ---------- Home page ---------- */` section heading currently sits immediately above .back-link. Keep that heading; only the .back-link rules go. Deleting the block before Phase 2 has landed would break the board's back link, so this task must run after task 2.1."
  verify:
    - "Run `grep -c 'masthead' src/public/styles.css src/public/index.html src/public/board.html` and confirm it returns 0 for all three files."
    - "Run `grep -c 'back-link' src/public/styles.css src/public/board.html` and confirm it returns 0 for both."
    - "Run `npm run build` and confirm it exits 0."
    - "Read the Update banner comment and confirm neither stale sentence mentions a masthead."
  checklist:
    - "Are all three .back-link rules gone?"
    - "Does the string 'masthead' appear nowhere in styles.css, index.html or board.html?"
    - "Is the `/* ---------- Home page ---------- */` heading still in place?"
    - "Do the update-banner comment's two rewritten sentences name .toolbar-crumb and .toolbar-sub?"
    - "Did the .update-banner rule set's declarations stay unchanged?"
  self_eval:
    passed: true
    failures: []
  ```

- [x] 4. Phase 4 — Interactive-control border and text consistency
  ```yaml
  description: "Apply the ten remaining control-consistency edits from Contract 4's second table across the sort control, the search field, the add-project field and the tile action buttons."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Read src/public/styles.css fresh before editing. Locate every edit by its selector and never by line number: TL-71-leb0ht Phase 1 deletes 66 lines above these rules, and its Phase 4 edits lines in the same neighbourhood."
    - "Apply the thirteen rows of PLN-62-r6bxg3 Contract 4's second table (plan lines 462-476), minus the three #manage-integrations-button selector removals already done in task 2.2. That leaves ten edits."
    - "In `.seg`, change the border from `var(--line-strong)` to `var(--line)`. This rule is global by design and reaches #sort-key-seg, #sort-dir-seg, #integrations-scope-seg and #theme-seg."
    - "In `.seg button`, change `color: var(--ink-soft)` to `var(--line-strong)`, and change the `border-right` from `var(--line-strong)` to `var(--line)`."
    - "In `.search-wrap input`, change the border from `var(--line-strong)` to `var(--line)` and change `color: var(--ink)` to `var(--line-strong)`."
    - "Add a new rule `.search-wrap input::placeholder { color: var(--line-strong); opacity: 0.75; }` immediately after the .search-wrap input rule."
    - "In `.search-wrap svg`, replace `opacity: 0.5` with `color: var(--line-strong); opacity: 1;`."
    - "In `.add-form input`, change the border from `var(--line-strong)` to `var(--line)`, change `color: var(--ink)` to `var(--line-strong)`, and delete the `font-family: var(--font-mono);` declaration outright so the field inherits the body sans face."
    - "Add a new rule `.add-form input::placeholder { color: var(--line-strong); opacity: 0.75; }` immediately after the .add-form input rule."
    - "In `.tile-action`, change the border from `var(--line-strong)` to `var(--line)`. Leave its `color: var(--ink-soft)` alone: only the border was inconsistent with the tile it sits on."
    - "Touch none of `.filter-chips button`, `.tile-edit input` or `.tiles-empty`. All three keep their --line-strong borders, because the plan does not name them."
  pattern: "src/public/styles.css — the .seg, .seg button, .search-wrap input, .search-wrap svg, .add-form input and .tile-action rules only. No other file."
  imports: "None. All values are existing tokens."
  compatibility: "PLN-62-r6bxg3 Contract 4's control-consistency table, acceptance criterion 15, and Assumption A8, which makes the board mockup's .seg rule the authoritative one over the home mockup's pre-correction copy."
  gotcha: "The font-family deletion on .add-form input is deliberate and confirmed directly from mockups/home-toolbar-mockup.html lines 237-240, which carries no font-family property at all. It is not a side effect of the colour edits. The .seg border change is global on purpose; do not scope it. Note that `.toolbar .seg` in the toolbar block overrides the border colour to --toolbar-ink-faint, so the theme toggle keeps its own treatment."
  verify:
    - "Run `npm run build` and confirm it exits 0."
    - "Run `grep -c 'font-mono' src/public/styles.css` before and after, and confirm the count dropped by exactly 1."
    - "Run `grep -n '::placeholder' src/public/styles.css` and confirm exactly two rules exist, one for .search-wrap input and one for .add-form input."
    - "Run `grep -n 'line-strong' src/public/styles.css` and confirm .filter-chips button, .tile-edit input and .tiles-empty still use it for their borders."
    - "Open both screens and read the filter placeholder, the sort labels, the add-project placeholder and the tile action glyphs in both themes. All must be legible, and every border must match the card or column beside it."
  checklist:
    - "Do .seg, .search-wrap input, .search-wrap svg, .add-form input and .tile-action all use var(--line) for their borders?"
    - "Do .seg button, .search-wrap input and its placeholder, its glyph, .add-form input and its placeholder all use var(--line-strong) for text and glyph colour?"
    - "Does .tile-action still use var(--ink-soft) for its text?"
    - "Has .add-form input lost its font-family declaration entirely?"
    - "Are .filter-chips button, .tile-edit input and .tiles-empty untouched?"
    - "Was every edit located by selector rather than by the plan's stale line numbers?"
  self_eval:
    passed: true
    failures: []
  ```

- [x] 5. Phase 5 — Build, narrow-width, and package check

  ```yaml
  description: "The verification stage. It edits no source file. Depends on Phase 4."
  ```

  - [x] 5.1 Clean build and the mechanical acceptance checks
    ```yaml
    description: "Rebuild from scratch and run every mechanical check the plan's testing strategy names."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `rm -rf dist && npm run build`. It must exit 0. This is the project's own full check: it runs tsc against all three tsconfigs, then copy-assets, then the bundler."
      - "Run each grep below and record its output. Every one of them is an acceptance criterion from PLN-62-r6bxg3, not a formality."
      - "If any check fails, fix the offending task's file rather than adjusting the check."
    pattern: "No source file is edited by this task. It exercises package.json's build script and reads the files the earlier tasks produced."
    imports: "None. The repository has no lint script, no typecheck script and no test script of its own; `npm run build` is the type-check, because build:base runs tsc three times."
    compatibility: "PLN-62-r6bxg3 acceptance criteria 1, 2, 13, 14, 16, 17, 19 and 20, and the Mechanical checks list in its testing strategy."
    gotcha: "src/public/app.ts, src/public/home.ts and src/public/app-version.ts must not have been modified by any task in this list. Confirm that as part of this check. app-version.ts fails silently on a missing #app-version, so the greps below cannot substitute for the visual pass in task 5.2."
    verify:
      - "Run `rm -rf dist && npm run build` and confirm it exits 0."
      - "Run `ls dist/public/img/` and confirm it holds flowcharge-mark.png, flowcharge-wordmark.png and flowcharge-lockup.png."
      - "Run `grep -c 'masthead' src/public/styles.css src/public/index.html src/public/board.html` and confirm 0 for all three; run `grep -c 'back-link' src/public/styles.css src/public/board.html` and confirm 0 for both."
      - "Run `grep -c -- '--toolbar-bg' src/public/styles.css` and confirm at least 6; run `grep -c -- '--tile-bg' src/public/styles.css` and confirm exactly 3."
      - "Run `shasum -a 256 src/public/img/flowcharge-mark.png /Users/akoukoullis/Work/AK/Praxis-Website/public/flowcharge-logo.png` and confirm the two digests match; run `wc -c < src/public/img/flowcharge-wordmark.png` and confirm 92122; run `ls src/public/img/` and confirm flowcharge-wordmark-2.png is gone."
      - "Run `git diff --stat 406ffff -- src/public/app.ts src/public/home.ts src/public/app-version.ts` and confirm it prints nothing."
      - "Run `git show 406ffff:src/public/board.html | grep -o 'id=\"[a-z-]*\"' | sort -u > /tmp/b.txt && grep -o 'id=\"[a-z-]*\"' src/public/board.html | sort -u > /tmp/a.txt && comm -23 /tmp/b.txt /tmp/a.txt` and confirm it prints nothing."
    checklist:
      - "Does a clean `rm -rf dist && npm run build` exit 0?"
      - "Does dist/public/img/ hold all three PNGs?"
      - "Do all four grep counts hit their stated numbers?"
      - "Do the two asset checks pass — matching digest for the mark, 92122 bytes for the wordmark, and no -2 file left?"
      - "Are app.ts, home.ts and app-version.ts unmodified against 406ffff?"
      - "Does the board still carry every id it had at 406ffff?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "`rm -rf dist && npm run build` exits 0. It prints `copied img/flowcharge-mark.png` and writes home.js, app.js and theme-init.js. dist/public/img/ holds all three PNGs."
        - "masthead count is 0 in styles.css, index.html and board.html. back-link count is 0 in styles.css and board.html. --toolbar-bg count is 9, above the stated floor of 6."
        - "The mark digest matches the sibling repository exactly (7d68a9d9…e8a895). flowcharge-wordmark.png is 92122 bytes. flowcharge-wordmark-2.png is gone. No id was lost from board.html against 406ffff."
        - "Divergence in the verify list, item 4: `grep -c -- '--tile-bg'` returns 7, not the stated 3. The literal count is two palette definitions, four explanatory comments, and one consumer. The intent — exactly one CSS consumer — holds: the only consumer is `.toolbar-crumb` at styles.css line 208. Phase 1's own executor recorded the same reasoning."
        - "Divergence in the verify list, item 6: `git diff --stat 406ffff -- src/public/app.ts src/public/home.ts src/public/app-version.ts` is not empty. It reports app.ts and home.ts changed, both by commit d07aebd of TL-71-leb0ht, which adds `import './theme-toggle'` and merged in at b1a06cd. `git diff b1a06cd..HEAD` over the same three files is empty, so no task in this list modified them. That is the gotcha's actual requirement."
    ```
  - [x] 5.2 Visual pass in the browser and the packaged shell
    ```yaml
    description: "Walk the plan's ten-step manual pass on both screens in all three theme modes, then repeat the two screens inside Electron."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `npm start` and open both screens. Walk all ten steps of the Manual pass in PLN-62-r6bxg3's testing strategy (plan lines 718-741), in all three theme modes."
      - "Gate on the light-mode arrow mark first. If it reads as noise or dirt on the bronze bar, stop and raise Open question 4 with the user. Do not add a CSS filter and do not substitute the lockup: the workstream record rules both out. The fix, if one is needed, is a separate light-mode export."
      - "Narrow each window to 400px and confirm acceptance criteria 6 and 11: below 520px the arrow mark is not rendered, and the board's meta line wraps onto more rows with nothing hidden at any width."
      - "Run `npm run electron:dev` and confirm both screens render the same way in the packaged shell."
    pattern: "No source file is edited by this task. It exercises package.json's start and electron:dev scripts."
    imports: "None."
    compatibility: "PLN-62-r6bxg3 acceptance criteria 3 to 12, and the ten-step Manual pass in its testing strategy."
    gotcha: "app-version.ts fails silently on a missing #app-version — it writes no error and no console line — so criteria 8 and 10 can only be confirmed by eye. Criterion 5 needs a slow resize, not a single screenshot: the mark must stay centred on the window at every width and never touch the wordmark, the integrations button or the toggle. Hover states must change the background only: nothing may shift by a pixel and no border may brighten."
    verify:
      - "Run `npm start`, open both screens, and confirm the main bar is one flat 44px band with no hairline under it, and the crumb bar below is a lighter tone with no hairline either."
      - "Resize each window slowly across 520px and confirm the arrow mark disappears and reappears, and stays centred on the window at every other width."
      - "Narrow the board to 400px and confirm the generated time, counts, branch, live status and version are all still on screen across two or three wrapped rows."
      - "Click each of the three toggle buttons and confirm the whole page repaints, both bars included, with no reload; hover each toggle button and the integrations button and confirm only the background changes."
      - "On the board confirm the chevron and Projects navigate home and the <h1> shows the folder name, not the word Board; on the home screen confirm Manage integrations opens the modal and sits immediately left of the toggle with no gap between the two groups."
      - "Run `npm run electron:dev` and repeat the first four checks in the packaged shell."
    checklist:
      - "Does the arrow mark read cleanly on the bronze bar in light mode?"
      - "Is the main bar 44px, flat, and borderless on both screens, with the wordmark clearing its top edge?"
      - "Does the mark vanish below 520px and reappear above it?"
      - "Does the board's meta line wrap at 400px with nothing hidden?"
      - "Is the version string visible on both screens, reading `Version 0.14.2`?"
      - "Do both screens behave identically under `npm run electron:dev`?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Item 6 confirmed directly by the user: browser and Electron are identical at first glance."
        - "Items 1 to 5 were verified by direct observation in a real Chromium browser pane driving `node dist/server.js` on port 4173. The served styles.css SHA-256 matches the freshly built dist/public/styles.css, so the pane rendered this branch's build."
        - "Item 1, the light-mode gate: the arrow mark reads cleanly on the bronze bar. Magnified over #A2805B it is a chrome arrow with a clean anti-aliased edge, a soft drop shadow and a transparent background. There is no white box, no halo and no compression noise. Open question 4 is not raised."
        - "Item 2: .toolbar measures 44px on both screens with all four border widths 0px and box-shadow none. .toolbar-crumb and .toolbar-sub are borderless too. Light tones are toolbar rgb(162,128,91), crumb rgb(185,158,130), sub rgb(233,225,213). Dark tones are rgb(16,20,26), rgb(23,29,36), rgb(34,37,46). The wordmark is 31px tall and clears the top edge by 10px."
        - "Item 3: .tb-mark computes display none at 510px and at a true documentElement.clientWidth of 400px, and display block at 521px and 560px. At both visible widths its centre is 0px from the viewport centre. At 521px it clears the integrations button by 4px and the wordmark by 39px."
        - "Item 4: on the board at clientWidth 400, #gen-date, #meta-counts, #branch-line, #branch-name, #live-status and #app-version are all display block and visibility visible, none overflows the right edge, and they occupy four wrapped rows."
        - "Item 5 divergence: the version renders `Version 1.0.0`, not the checklist's literal `Version 0.14.2`, because package.json now sets version 1.0.0 and app-version.ts is out of scope. Assumption A4's real requirement, the `Version <semver>` form rather than the mockups' `v<semver>`, is met on both screens. Scored YES on intent, as with task 5.1's raw-count divergences."
        - "Theme toggle: clicking dark, then system, then light repainted both bars and the body on both screens. A marker set on `window` survived every click, proving no reload."
        - "Hover on #manage-integrations-button changes the background from transparent to a bronze shade with borderColor and borderWidth unchanged and the bounding rect unmoved, all four deltas 0. The label brightens to var(--toolbar-ink), which is what Contract 4's own .tb-button:hover rule declares."
        - "Navigation and layout: the crumb holds one `<a class=\"tb-back\" href=\"/\">` carrying the chevron SVG and the word Projects, and clicking it loaded the home screen. #board-title is an H1 reading Praxis-Dashboard, the folder name. Manage integrations opened the modal. #manage-integrations-button carries class tb-button and sits directly in .toolbar, with #theme-seg starting 10px to its right, that 10px being the toolbar's own gap and not an extra separation between the two groups. The R1 neutraliser therefore works."
    ```

## Open questions carried forward, untasked

These are recorded here because no task in this list settles them. None blocks
execution.

1. **`--line`'s dark-mode value conflicts between the mockups (`#3B3F46`) and
   `PLN-60-f7jh0n` / `TL-71-leb0ht` (`#2F3440`).** WS-71 owns that token, this list
   does not touch it, and no task here depends on the answer. A user has to confirm a
   value into WS-71 before that workstream's Phase 4 lands, or accept fainter
   dark-mode borders on cards, columns and panels.
2. **Which workstream owns the theme toggle's button children.** Tasks 1.5 and 2.1
   carry Assumption A3's contingency, so nothing is blocked either way. A user should
   confirm the ownership so WS-70 and WS-71 do not both edit those three buttons.
3. **Whether `mockups/` should be committed to git, and where.** Both files are
   untracked at `406ffff`. They are the specification for this work and the record of
   many rounds of feedback. This is a repository-hygiene question outside this list's
   scope, and no task moves, commits or deletes them.
4. **Whether `flowcharge-mark.png` should be downscaled in a later pass.** Task 1.1
   vendors it verbatim at 482 KB, as the plan specifies, because that guarantees the
   approved result. A 152×152 export at 2× density would be roughly 2% of the size
   with no visible difference. That is a separate, later decision.

## Divergences

1. **The stylesheet still has four palette blocks, not the two Contract 1 writes
   into.** PLN-62-r6bxg3 Contract 1 places its eight new tokens "inside the two
   palette blocks TL-71 Phase 1 leaves behind (`:root` and
   `:root[data-theme="dark"]`)". At `406ffff`, `src/public/styles.css` carries four:
   `:root` at line 9, `@media (prefers-color-scheme: dark)` at line 53,
   `:root[data-theme="dark"]` at line 93, and `:root[data-theme="light"]` at line 106.
   `TL-71-leb0ht` is `status: ready`, not `done`, and its task 4 is what reduces the
   file. This is the plan's own declared precondition rather than code drift, so task
   1.4 is still authored. It carries the instruction to locate both blocks fresh after
   `TL-71-leb0ht` lands, and never to add a third. If `TL-71-leb0ht` has not landed
   when task 1.4 is executed, stop rather than guessing which two blocks to write
   into.

2. **Neither HTML file carries `#theme-seg` yet.** Contracts 2 and 3 place the theme
   toggle inside `<header class="toolbar">` on both pages. At `406ffff`,
   `src/public/board.html` lines 11-27 and `src/public/index.html` lines 11-19 hold a
   `<header class="masthead">` with no toggle of any kind. `TL-71-leb0ht` tasks 2.5
   and 2.6 add it. Tasks 1.5 and 2.1 are still authored, because Assumption A3 already
   carries a deterministic, self-checking contingency for the two shapes the control
   can arrive in. Both tasks re-read their file before editing and apply that
   contingency rather than assuming either shape.

Every other file and anchor the plan cites matched what it assumes, read at `406ffff`:
`src/public/board.html` lines 11-27, `src/public/index.html` lines 11-19, the
`.masthead` block, the `.back-link` block, the update-banner comment, all ten
control-consistency anchors in `src/public/styles.css`, the asset list in
`tools/copy-assets.mjs`, and the sibling repository's `flowcharge-logo.png` at 493,636
bytes.

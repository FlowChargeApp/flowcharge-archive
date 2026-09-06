---
id: TL-74-bqkeb0
type: tasklist
workstream: WS-72-p6g77g
slug: flowcharge-header-followups
title: "Seven chrome corrections that close the gap to the two toolbar mockups"
status: done
created: 2026-08-28
updated: 2026-08-28
author: Anthony Koukoullis
depends_on: [PLN-63-somr2u]
links: []
mode: spec
base_commit: 98959fd
---

# PRX Tasks

## FlowCharge header follow-ups — seven chrome corrections

`PLN-63-somr2u` names seven differences between the shipped app and the two
hand-approved mockup files, `mockups/home-toolbar-mockup.html` and
`mockups/board-toolbar-mockup.html`. Those two files are the design specification. The
approach is faithful mockup transcription: for each item, do what the mockup does, by the
mechanism the mockup uses, and change nothing else.

The seven items are: (1) the `.card-foot` dashed rule moves from `--rule-strong` to
`--line`; (2) `--font-display` becomes `var(--font-body)` at the token, and Fraunces is
removed from the repository; (3) a `21px` gap opens above the board's KPI strip; (4) the
home screen's `<h1 class="home-heading">Your projects</h1>` is deleted; (5) the
add-project block moves above the project tile grid; (6) both `<footer class="note">`
blocks and the lockup PNG are deleted; (7) the same `21px` gap opens under the home crumb
bar.

Three orphan cleanups are folded into the changes that create them, on the user's
instruction: the `--rule-strong` token with item 1, the Fraunces `@font-face` block, the
woff2 file, its copy-list entry and `src/public/fonts/OFL.txt` with item 2, and
`img/flowcharge-lockup.png` with its copy-list entry with item 6. `OFL.txt` licenses only
the font item 2 deletes, so it goes with it (plan Decision 8).

The work is CSS, static HTML, one build script, and three deleted files — two binary assets
and one licence text. No TypeScript changes, no new dependency, no new asset. The five parent tasks below are the
plan's five phases in the plan's own order, highest blast radius first. **Each parent task
is one commit.** A later commit stage must not merge two parent tasks into one commit.

`tools/copy-assets.mjs` copies a hardcoded list with `fs.copyFileSync` and no existence
check, so it throws `ENOENT` and fails `npm run build` the moment a listed file is
missing. Task 1 and task 5 each delete an asset **and** its copy-list entry. In both, the
copy-list entry is removed **before** the file, so `npm run build` stays green after every
single task.

The repository has no test runner and `package.json` has no `test` script. The project's
own gate is `npm run build`: `build:base` runs three `tsc` passes and then
`node tools/copy-assets.mjs`, and `build` then runs `node tools/bundle-public.mjs`. Neither
script cleans `dist/`; `bundle-public.mjs` sweeps `.js` files only. So a deleted asset can
survive in `dist/public/` from an earlier build, and every check that an asset stopped being
copied must read the build's `copied …` log lines, or delete the stale copy first. Browser
checks run against `npm start` or `npm run electron:dev`.

- [x] 1. Phase 1 — the display-font token swap and the Fraunces removal (item 2)

  ```yaml
  description: "Point --font-display at --font-body, then delete the Fraunces @font-face block, its copy-list entry, the woff2 file and the OFL.txt licence that covers it. One commit."
  ```

  - [x] 1.1 Swap the display-font token and delete the `@font-face` block in `src/public/styles.css`
    ```yaml
    description: "Replace the Fraunces stack on --font-display with var(--font-body), and delete the @font-face block that loads the now-unused face."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Delete the whole `@font-face` block at the top of `src/public/styles.css` — the seven lines from `@font-face {` through its closing brace — and the single blank line that follows it. The file then opens on the palette comment block that begins `/* ---` and `The FlowCharge chrome palette.`"
      - "Write no replacement comment and no preserved Fraunces stack anywhere. Both mockups keep a preserved-stack comment; this plan deliberately does not, because the user ruled out an in-tree reversal path (Decision 4, Assumption A6). The only reversal is `git revert` of this commit."
      - "Apply this block to swap the token. It is one mechanical single-location edit, so it is given literally: src/public/styles.css\n<<<<<<< SEARCH\n  --font-display: \"Fraunces\", ui-serif, Georgia, \"Iowan Old Style\", \"Times New Roman\", serif;\n=======\n  --font-display: var(--font-body);\n>>>>>>> REPLACE"
      - "Change nothing else. Do not touch `--font-body` or `--font-mono` on the two lines below. Do not touch any `var(--font-display)` consumer selector — the point of a token edit is that all eleven repaint from one line."
      - "Delete no file in this task. Both `src/public/fonts/fraunces-latin.woff2` and `src/public/fonts/OFL.txt` are deleted in this same commit, but by task 1.3."
    pattern: "src/public/styles.css only. The @font-face block at the head of the file, and the --font-display declaration inside the light :root block."
    imports: "None. No new dependency, no new asset, no import of any kind."
    compatibility: "Custom property references resolve at use time, not declaration time, so --font-display may reference --font-body even though --font-body is declared on the next line. Both mockups rely on the same ordering and render correctly. The mockups make this same swap at their own line 71, at the token, not per selector."
    gotcha: "Deleting the @font-face block removes eight lines from the top of the file, so every line number the plan quotes for styles.css shifts by eight afterwards. Later tasks must locate their edits by selector or token name, never by the plan's printed line number. Also: this swap repaints seven selectors that appear in neither mockup — .load-state h2, .tiles-empty h3, .ws-modal-title, .ws-section-title, and .ws-plan h4/h5/h6. That is confirmed and intended (Decision 1), not a defect."
    verify:
      - "`npm run build` succeeds."
      - "`grep -n 'Fraunces' src/public/styles.css` returns nothing."
      - "`grep -n 'font-display' src/public/styles.css` returns exactly one line, `  --font-display: var(--font-body);` — the `font-display: swap;` descriptor inside the deleted @font-face block must be gone with it."
      - "`npm start`, then open the board screen: the four KPI values and both lower-panel `<h2>` headings render sans, not serif. Compare side by side against `mockups/board-toolbar-mockup.html` in a second tab."
      - "Home screen: the `Add a project` heading and every tile name render sans. Compare against `mockups/home-toolbar-mockup.html`."
      - "Open a card's detail modal: its title, its section titles, and any h4/h5/h6 in rendered plan prose are sans too. This is the confirmed consequence of the token swap — check it renders as expected, do not treat it as a decision point."
      - "Every mono element is unchanged and at its original size: card ids, tags, `.tb-meta`, `.tb-version`, KPI labels, column-head names, `.tile-path`, `.tile-added`."
      - "Check both light and dark mode."
    checklist:
      - "Does `--font-display` read exactly `var(--font-body)`, with no comment above it preserving the old stack?"
      - "Is the `@font-face` block gone, together with the blank line after it, so the file opens on the palette comment?"
      - "Are `--font-body` and `--font-mono` byte-for-byte unchanged?"
      - "Does every selector that reads `var(--font-mono)` still read it, unchanged and at its original size?"
      - "Did this task delete no file, leaving both font-file deletions to task 1.3?"
      - "Is `src/public/styles.css` the only file this task changed?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Remove the Fraunces entry from `tools/copy-assets.mjs`
    ```yaml
    description: "Delete the 'fonts/fraunces-latin.woff2' entry from the hardcoded copy list, before the file itself is deleted."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block. It is one mechanical single-location edit: tools/copy-assets.mjs\n<<<<<<< SEARCH\n  'styles.css',\n  'fonts/fraunces-latin.woff2',\n  'img/flowcharge-wordmark.png',\n=======\n  'styles.css',\n  'img/flowcharge-wordmark.png',\n>>>>>>> REPLACE"
      - "Change nothing else in the file. The source-map guard below the loop is untouched, and the other five entries stay exactly as they are."
      - "Run this task BEFORE task 1.3. Removing the entry while the file still exists leaves the build green; deleting the file while the entry still exists breaks it."
    pattern: "tools/copy-assets.mjs only, the `for (const name of [ … ])` list."
    imports: "None."
    compatibility: "The loop calls `fs.copyFileSync(path.join(srcPublic, name), dest)` with no existence check. Every remaining entry must still exist under src/public/."
    gotcha: "Task 5.4 edits the same list in the same file and removes a different entry. The two cannot conflict, but whichever lands second finds the other's line numbers shifted. Locate the entry by its filename string, never by line number."
    verify:
      - "`npm run build` succeeds."
      - "`grep -n 'fraunces' tools/copy-assets.mjs` returns nothing."
      - "The build's `copied …` log lines no longer name `fonts/fraunces-latin.woff2`. Read the log, not `dist/`: the build never cleans `dist/public/` of anything but `.js` files, so a stale copy from an earlier build survives there. To check `dist/` instead, delete `dist/public/fonts/` first and confirm the build does not recreate it."
    checklist:
      - "Does the copy list now hold six entries, with only the fonts entry removed?"
      - "Do `img/flowcharge-wordmark.png`, `img/flowcharge-lockup.png` and `img/flowcharge-mark.png` all remain in the list?"
      - "Is the source-map guard below the loop unchanged?"
      - "Did `npm run build` succeed, proving every remaining listed file still exists on disk?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.3 Delete `src/public/fonts/fraunces-latin.woff2` and `src/public/fonts/OFL.txt`
    ```yaml
    description: "Remove the now-unfetched Fraunces webfont and the OFL licence text that covers only that font, both with git rm, in the same commit as the copy-list entry."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `git rm src/public/fonts/fraunces-latin.woff2` from the repository root."
      - "Do that only AFTER task 1.2 has removed the copy-list entry, or `npm run build` throws ENOENT."
      - "Run `git rm src/public/fonts/OFL.txt` from the repository root. It is the SIL Open Font Licence text for Fraunces and nothing else, so it goes with the font (plan Decision 8). It has no `tools/copy-assets.mjs` entry and is fetched by no page, so it carries no ordering constraint and cannot affect the build."
      - "Delete nothing else from `src/public/fonts/`. The two Snasm `.otf` files stay — both are untracked, and neither belongs to this workstream. The directory does not become empty."
      - "Both deletions must land in the same commit as tasks 1.1 and 1.2. Do not commit them separately."
    pattern: "src/public/fonts/fraunces-latin.woff2 and src/public/fonts/OFL.txt (both deleted). No file is edited."
    imports: "None."
    compatibility: "git rm rather than a plain rm, so `git revert` of this commit restores both files together with the CSS and the copy-list entry in one operation. Neither file can be hand-restored from anything left in the tree."
    gotcha: "After this task there is no in-tree reversal path for the display font at all — no preserved comment, no @font-face block, no font file, no licence file. That is a deliberate, user-chosen trade (Decisions 4 and 8, Assumption A6), not an oversight. Deleting the licence carries no legal risk: nothing in the repository ships the font it covers any more."
    verify:
      - "`npm run build` succeeds. This is the step that catches a half-done deletion in either direction."
      - "`git status --short src/public/fonts/` shows both `D  src/public/fonts/fraunces-latin.woff2` and `D  src/public/fonts/OFL.txt` staged."
      - "`ls src/public/fonts/` lists neither `fraunces-latin.woff2` nor `OFL.txt`, and still lists the two Snasm `.otf` files."
      - "`grep -rn 'Fraunces\\|fraunces' src/public/` returns nothing at all."
      - "`npm start`, then open both screens with devtools' network tab: no request for a `.woff2`, and no console warning about a missing font resource."
    checklist:
      - "Are `src/public/fonts/fraunces-latin.woff2` and `src/public/fonts/OFL.txt` both gone from disk and both staged as deletions in git?"
      - "Do the two Snasm `.otf` files still sit in `src/public/fonts/`, so the directory is not empty?"
      - "Does `grep -rn 'fraunces' src/public/` return zero lines?"
      - "Did `npm run build` succeed with the font file, its copy-list entry and the licence file all removed?"
      - "Are tasks 1.1, 1.2 and 1.3 all staged for one single commit?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — board chrome: the card-foot rule and the KPI gap (items 1 and 3)

  ```yaml
  description: "Move the .card-foot dashed rule onto --line, delete the stranded --rule-strong token, and open the mockup's gap above the KPI strip. One commit."
  ```

  - [x] 2.1 Measure `.mockup-note`'s rendered height in `mockups/board-toolbar-mockup.html`
    ```yaml
    description: "Read the real pixel height of the mockup element whose space items 3 and 7 restore, so the plan's derived 21px is confirmed or replaced by a measurement."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open `mockups/board-toolbar-mockup.html` in a browser. The file is untracked in git and stays that way — read it, do not move, commit or edit it."
      - "In the console, evaluate `document.querySelector('.mockup-note').offsetHeight`."
      - "The plan derives `21px` as `6px padding-top + (10.5px font-size x 1.45 line-height) = 21.225px`, rounded. If the browser reports a different integer, the measurement wins over the derivation."
      - "Record the number found. Task 2.3 and task 4 both use this one value — the home mockup declares a character-identical `.mockup-note` rule inside a body with the same `line-height: 1.45`, so one measurement serves both screens."
      - "Change no file in this task. It is read-only and produces a number, not an edit."
    pattern: "mockups/board-toolbar-mockup.html, read-only. No repository file is modified."
    imports: "A browser with a developer console. No project dependency."
    compatibility: "The measurement must be taken at the browser's default zoom. A zoomed viewport reports a scaled offsetHeight and would carry a wrong number into two CSS rules."
    gotcha: "offsetHeight returns a rounded integer, which is what is wanted here — the CSS value is written as a whole pixel. Do not substitute getBoundingClientRect().height and then round it differently. Both mockups are untracked (`??` in git status); that is PLN-62-r6bxg3 open question 6 and stays open."
    verify:
      - "The console returned an integer, and it is recorded for tasks 2.3 and 4."
      - "`git status --short mockups/` is unchanged from before this task — the mockups are still untracked and unmodified."
    checklist:
      - "Was the measurement taken from `.mockup-note` in `mockups/board-toolbar-mockup.html` at default browser zoom?"
      - "Is the number an integer, and is it recorded where tasks 2.3 and 4 can both read it?"
      - "If the number is not 21, is that number the one both later tasks will use?"
      - "Was no repository file created, edited or deleted by this task?"
    self_eval:
      passed: true
      measurement: 21
      failures: []
      notes: "Measured live, not derived. `mockups/board-toolbar-mockup.html` was served over `http://localhost:8791` (a temporary `python3 -m http.server` in the mockups folder, stopped afterwards) because the browser tool could not open a `file://` URL. `document.querySelector('.mockup-note').offsetHeight` returned 21. The computed style confirmed the derivation exactly: `font-size: 10.5px`, `line-height: 15.225px`, `padding-top: 6px`, `padding-bottom: 0px`, so `getBoundingClientRect().height` was 21.21875. The computed font-size matched the declared 10.5px, which proves the page was at default zoom. The value 21 is recorded here for task 2.3, which used it, and for task 4."
    ```
  - [x] 2.2 Move the `.card-foot` rule onto `--line` and delete both `--rule-strong` declarations
    ```yaml
    description: "Draw the card-foot dashed top rule in var(--line), matching the board mockup, then delete the token it strands from both palettes."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to the `.card-foot` rule. It is one mechanical single-location edit: src/public/styles.css\n<<<<<<< SEARCH\n.card-foot { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding-top: 4px; border-top: 1px dashed var(--rule-strong); }\n=======\n.card-foot { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding-top: 4px; border-top: 1px dashed var(--line); }\n>>>>>>> REPLACE"
      - "Delete the line `  --rule-strong: #9A7A56;` from the light `:root` block. It is the last declaration before the blank line and the `/* Toolbar chrome. …` comment."
      - "Delete the line `  --rule-strong: #A2805B;` from the `:root[data-theme=\"dark\"]` block. It sits in the same position, last before that block's own `/* Toolbar chrome. …` comment."
      - "Read the palette comment block at the head of the file and confirm its prose is still accurate. Expect NO edit to be needed: that block documents the five source logo colours and the two derivation operations, not the derived tokens, and bronze `#A2805B` stays in use as `--toolbar-bg` light. Change the comment only if the check finds a statement the deletion actually falsified (plan Contract 3)."
      - "Touch no other token in either palette. `--line`, `--line-strong` and the four other derived logo colours stay exactly as they are."
    pattern: "src/public/styles.css only: the .card-foot rule, plus one --rule-strong declaration in each of the two palette blocks."
    imports: "None."
    compatibility: "`--line` is already `#D2C2AA` light and `#3B3F46` dark, which are the exact values both mockups declare at their own lines 34 and 100. So the revert lands the mockup's appearance in both modes with no palette change. `.card` itself is already bordered in `var(--line)`, so a card's outer border and its internal foot rule now share one tone."
    gotcha: "`--rule-strong` has exactly one consumer in the whole stylesheet, so the token is dead the moment the .card-foot edit lands. Both declarations must go in this same change, not in a later dead-token pass (Decision 2). Line numbers in the plan are pre-Phase-1: task 1.1 removed eight lines from the top of this file, so locate all three edits by selector and token name."
    verify:
      - "`npm run build` succeeds."
      - "`grep -n 'rule-strong' src/public/styles.css` returns nothing."
      - "`grep -n 'card-foot {' src/public/styles.css` shows the rule ending `border-top: 1px dashed var(--line); }`."
      - "`npm start`, board screen, light mode: a card's foot rule is the same oak tone as the card's own border, not bronze."
      - "Board screen, dark mode: the same, in `#3B3F46`."
      - "Put a dropped card (`.card.is-dropped`, `opacity: 0.68`) next to a live one: both foot rules read the same hue, the dropped one only fainter. The orange-versus-grey mismatch is the specific defect this task exists to fix."
    checklist:
      - "Does `grep -n 'rule-strong' src/public/styles.css` return zero lines?"
      - "Does `.card-foot`'s `border-top` name `var(--line)`, and is the rest of that one-line rule unchanged?"
      - "Is every other token in both palette blocks byte-for-byte unchanged, including `--line` and `--line-strong`?"
      - "Was the palette comment block read, and left unedited unless the deletion genuinely falsified a statement in it?"
      - "Do a dropped card and a live card show the same hue in their foot rule, in both light and dark mode?"
    self_eval:
      passed: true
      failures: []
      notes: "All three edits were located by selector and token name, as the gotcha requires. `grep -n 'rule-strong' src/public/styles.css` returns zero lines. Browser check on the live board (68 cards, 2 of them `.card.is-dropped`): every `.card-foot` border-top computes to `rgb(59, 63, 70)` dark and `rgb(210, 194, 170)` light, which are `--line` in both blocks, and the card's own border computes to the same value. Dropped and live cards read one hue; the dropped card differs only by its `opacity: 0.68`. The board mockup's own `.card-foot` computes to the same `rgb(59, 63, 70)`. The palette comment block was read: it documents the five source logo colours and the two derivation operations, never `--rule-strong`, and bronze `#A2805B` is still in use at `--toolbar-bg` light, so no statement in it was falsified and it was left unedited."
    ```
  - [x] 2.3 Open the gap above the board's KPI strip
    ```yaml
    description: "Add a top margin to .kpi-strip so the space the mockup's .mockup-note produced reappears between the info bar and the KPI strip."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add one declaration, `margin-top: 21px;`, to the `.kpi-strip` block in `src/public/styles.css` — the multi-line block that opens `display: grid;` under the `/* ---------- KPI strip ---------- */` comment, not the one-line override inside the `@media (max-width: 880px)` query."
      - "Use the number task 2.1 measured. Write `21px` only if the measurement confirmed 21."
      - "Change nothing else in that block. `background: var(--line)` and `border-bottom: 1px solid var(--line)` stay as they are; the new margin sits outside both, so the exposed strip is body's `var(--paper)` — the same surface `.toolbar-sub` paints, so the transition reads as one continuous surface."
      - "Put the margin on `.kpi-strip`, NOT on `.toolbar-sub { margin-bottom }`. The real board has `#update-banner` between the two, deliberately styled as a flush continuation of the chrome bands. A bottom margin on `.toolbar-sub` would push the banner off the bars above it and leave it butted against the KPI strip (Assumption A4)."
    pattern: "src/public/styles.css only, the .kpi-strip block."
    imports: "None."
    compatibility: "`.kpi-strip` exists only on the board screen, so the rule scopes itself with no selector qualification and cannot reach the home screen."
    gotcha: "Margin collapsing is not a hazard: .kpi-strip is `display: grid`, and its previous sibling is either .toolbar-sub or .update-banner, both `display: flex`, neither with a bottom margin to collapse with. Do not add the margin to the @media (max-width: 880px) override — the gap must survive the two-column reflow unchanged."
    verify:
      - "`npm run build` succeeds."
      - "`npm start`, board screen: visible vertical space separates the `.toolbar-sub` info bar from the top of the `.kpi-strip`, and it paints the page background."
      - "Flip between the app and `mockups/board-toolbar-mockup.html` at the same window width: the space matches."
      - "In devtools, remove `#update-banner`'s `hidden` attribute. The three chrome bands — `.toolbar-crumb`, `.toolbar-sub`, `.update-banner` — stay flush against each other with no gap between them, and the gap opens between the banner and the KPI strip. Restore `hidden`."
      - "Narrow the window below 880px, where the KPI strip drops to two columns. The gap is unchanged."
    checklist:
      - "Does the `.kpi-strip` block carry a non-zero `margin-top`, using the value task 2.1 measured?"
      - "Is the `@media (max-width: 880px)` `.kpi-strip` override unchanged?"
      - "Is `.toolbar-sub` unchanged — no margin-bottom was added to it?"
      - "Do the chrome bands stay flush against each other when `#update-banner` is visible?"
      - "Does the gap paint `var(--paper)` rather than the KPI strip's own `var(--line)`?"
    self_eval:
      passed: true
      failures: []
      notes: "`margin-top: 21px` was added to the multi-line `.kpi-strip` block under the `/* ---------- KPI strip ---------- */` comment, using the value task 2.1 measured. The one-line `.kpi-strip` override inside `@media (max-width: 880px)` is unchanged, and `.toolbar-sub` gained no `margin-bottom`. Browser checks on the live board: the measured distance from `.toolbar-sub`'s bottom to `.kpi-strip`'s top is exactly 21px, and `document.elementFromPoint` in the middle of that space returns `BODY`, whose background computes to `rgb(34, 37, 46)` dark and `rgb(233, 225, 213)` light — the `--paper` value in each block, not the strip's `--line`. With `#update-banner`'s `hidden` attribute removed, the three chrome bands stayed flush (crumb to sub 0px, sub to banner 0px) and the 21px gap opened between the banner and the KPI strip; `hidden` was then restored. At an 820px viewport the strip reflowed to two columns and the gap stayed 21px. The board mockup measures 21.219px in the same place, so the whole-pixel CSS value matches to within a sub-pixel."
    ```

- [x] 3. Phase 3 — home screen body: drop the heading, lift the form (items 4 and 5)
  ```yaml
  description: "In src/public/index.html, delete the `Your projects` h1 and move the whole add-project block above the tile grid, matching the home mockup's own order. One commit, one file."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "In `src/public/index.html`, inside `<section class=\"home\">`, delete the line `  <h1 class=\"home-heading\">Your projects</h1>` entirely. Do not demote it to an h2, do not move it, do not replace it."
    - "Move the four add-project elements above `<div id=\"project-tiles\"></div>`: the `<h2 class=\"home-heading\">Add a project</h2>`, the `<form class=\"add-form\" id=\"add-form\" hidden>` and its two children, the `<button type=\"button\" id=\"choose-folder-button\" hidden>`, and the `<div id=\"add-error\"></div>`."
    - "Keep all four in their current relative order and with every attribute byte-for-byte unchanged. Only the block's position moves. `#choose-folder-button` and `#add-error` have no mockup equivalent but belong to the add-project control, so they travel with it (Assumption A7)."
    - "`<div id=\"project-tiles\"></div>` becomes the last element inside `<section class=\"home\">`. Leave the blank line separating the two groups so the section still reads as two blocks."
    - "Edit no other file. Do NOT edit `src/public/styles.css` — the existing `.home-heading + *` rule already gives the correct spacing once the order is right (Assumption A8). Do NOT edit `src/public/home.ts`."
  pattern: "src/public/index.html only, the contents of `<section class=\"home\">`. The toolbar, crumb bar, update banner, integrations dialog and script tag are all untouched."
  imports: "None. No new element, no new class, no new attribute."
  compatibility: "`src/public/home.ts` reaches every affected element by id — `byId('project-tiles')`, `byId('add-form')`, `byId('choose-folder-button')`. It never uses nextElementSibling, children[n] or any position-dependent lookup, and never queries `.home-heading`. So DOM order is free to change with no script edit."
  gotcha: "After the change the home screen's only heading is an h2 with no h1 above it on that page. That is a document-outline regression relative to today, and it is exactly what the home mockup shows, so it is the specification rather than a defect. Separately: in the Electron build `home.ts` hides `#add-form` and shows `#choose-folder-button` instead; a hidden element is display:none so its margin does not render, and `#choose-folder-button` is not adjacent to the heading. The reorder does not create that, but it moves where it shows. Decision 6 settled this as no CSS change now — judge it in verify step 4 and report, do not edit CSS."
  verify:
    - "`npm run build` succeeds."
    - "`grep -c 'home-heading' src/public/index.html` returns 1."
    - "`grep -n 'Your projects' src/public/index.html` returns nothing."
    - "`npm start`, home screen, top to bottom: chrome, then `Add a project`, then the add-project control, then the tile grid."
    - "Side by side against `mockups/home-toolbar-mockup.html`: same order and same spacing INSIDE `<section class=\"home\">`. The space ABOVE the heading belongs to task 4 and only matches once task 4 has landed — judge ordering here and leave the top clearance to task 4's own check."
    - "In a plain browser tab, where `#add-form` is the visible control, 28px separates it from the tile grid, produced by the existing `.home-heading + *` rule with no CSS edit."
    - "In the Electron build (`npm run electron:dev`), `#choose-folder-button` is the visible control and `#add-form` is hidden. Look at the space above the tile grid in this state and report how it reads. Make no CSS change (Decision 6)."
    - "Add a project and confirm the new tile appears in the grid below. Rename a tile. Remove a tile. Trigger an error, for example by adding a path with no `flowcharge/` folder, and confirm `#add-error` still renders in place."
  checklist:
    - "Is `<h1 class=\"home-heading\">Your projects</h1>` gone, and is exactly one `.home-heading` left in the file?"
    - "Is `<div id=\"project-tiles\"></div>` the last element inside `<section class=\"home\">`?"
    - "Did all four add-project elements move together, in their original relative order, with every attribute unchanged?"
    - "Is `src/public/index.html` the only file this task changed — no edit to `styles.css` and none to `home.ts`?"
    - "Do add, rename, remove and the error path all still work?"
  self_eval:
    passed: true
    failures: []
    notes: "One edit to `src/public/index.html`, nothing else. `git diff --stat` shows only that file; `.claude/launch.json` and `.gitignore` were already modified before this task started and were not touched. The diff removes exactly two lines and adds the tile-grid div back below `#add-error`, so all four add-project elements are unchanged context lines — their relative order and every attribute are byte-for-byte identical. The blank line between the two groups is kept, so the section still reads as two blocks. `npm run build` succeeded. `grep -c 'home-heading' src/public/index.html` returns 1 and `grep -n 'Your projects'` returns nothing. Browser checks ran against the live app at `http://localhost:4173`: `section.home`'s children read h2.home-heading, form#add-form, button#choose-folder-button, div#add-error, div#project-tiles, and `home.lastElementChild.id` is `project-tiles`. The page now has zero `h1` elements — the confirmed outline regression the gotcha names, and what the home mockup shows. Side by side against `mockups/home-toolbar-mockup.html` (served over `http://127.0.0.1:8793`, a temporary `python3 -m http.server` in the mockups folder, stopped afterwards; `git status --short mockups/` still shows only `??`), at the same 905px window width, the spacing inside `section.home` matches exactly: `.home-heading` margin-bottom 12px, `#add-form` margin-bottom 28px from the existing `.home-heading + *` rule, control-to-grid gap 28px, and `.home` padding `24px 36.2px 30px` in both. No CSS edit was made or needed. The interaction check ran live: adding a scratchpad folder containing `flowcharge/` raised the tile count 10 to 11 and put the new tile in the grid below the form; renaming it in place worked; removing it returned the list to the original ten; and submitting a path with no `flowcharge/` folder left the tile count at 10 and rendered the server's message in `#add-error`, in place between `#choose-folder-button` and `#project-tiles` with its 8px margin-top. `.praxis-projects.json` was backed up first and diffs byte-for-byte identical afterwards, and the scratchpad probe folder was deleted. Verify step 7, the Electron state, could NOT be exercised in a real Electron window — `npm run electron:dev` opens a native window these session tools cannot drive or screenshot. Instead the exact DOM state `home.ts` `initAddProjectControl()` produces was reproduced in the browser by setting `#add-form` hidden and `#choose-folder-button` visible, then restored. Reported as the step asks, with no CSS change (Decision 6): in that state the visible control sits 0px above the tile grid, because the 28px separation comes from `.home-heading + *` matching `#add-form`, and a hidden `#add-form` is `display: none` so its margin does not render, while `#choose-folder-button` is not adjacent to the heading. The heading-to-control gap stays 12px. So the Electron build shows the button butted against the grid with no clearance. That is the pre-existing behaviour the reorder moves rather than creates, and it is left alone."
  ```

- [x] 4. Phase 4 — the home screen gap (item 7)
  ```yaml
  description: "Add a top margin to the .home section so the space the home mockup's .mockup-note produced reappears under the crumb bar. One commit, one line."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "In `src/public/styles.css`, find the one-line `.home` rule under the `/* ---------- Home page ---------- */` comment and add `margin-top` to it, so it reads `.home { margin-top: 21px; padding: 24px clamp(16px, 4vw, 40px) 30px; }`."
    - "Use the number task 2.1 measured. Write `21px` only if that measurement confirmed 21. If task 2 has not run yet, take the same measurement here from `mockups/home-toolbar-mockup.html` — its `.mockup-note` rule is character-identical to the board mockup's, inside a body with the same `line-height: 1.45`."
    - "Do not touch the `padding` shorthand. Margin is outside the box and padding inside it, so the two add rather than compete: the gap of page background, then the existing 24px inset before the `Add a project` heading. That sum is exactly what the home mockup renders, because it carries the identical padding rule AND the note above it."
    - "Do not fold the value into the padding instead. That renders identically today but moves the gap inside `.home`'s box, so it silently stops being page background the moment `.home` gains one."
    - "Put the margin on `.home`, NOT on `.toolbar-crumb { margin-bottom }`. On the home screen `#update-banner` sits directly under the crumb bar, so a bottom margin there would separate the two bands on the one screen where they are the whole of the chrome (Assumption A10)."
    - "Do not touch `.home-heading` or `.home-heading + *`. This margin is on `.home` itself, so the adjacent-sibling relationship task 3 relies on is untouched."
  pattern: "src/public/styles.css only, the single-line .home rule."
  imports: "None."
  compatibility: "`.home` appears only in `src/public/index.html`; `src/public/board.html` has no such element, so the rule cannot reach the board screen and needs no qualification — the same property `.kpi-strip` has for task 2.3."
  gotcha: "No margin collapse is possible here. `.home` is a plain block section whose previous sibling is either .toolbar-crumb or .update-banner, both `display: flex`, neither with a bottom margin. `.home`'s own `padding-top: 24px` sits between its top margin and its first child's, so no parent-child collapse can pull the new margin inward either. Line numbers the plan quotes for styles.css are pre-Phase-1 and pre-Phase-2 — locate the rule by its selector."
  verify:
    - "`npm run build` succeeds."
    - "`grep -n '^\\.home {' src/public/styles.css` shows both a non-zero `margin-top` and the original `padding: 24px clamp(16px, 4vw, 40px) 30px` shorthand."
    - "`npm start`, home screen: the `Add a project` heading no longer sits close under the crumb bar. The clearance above it reads as the measured gap of page background plus the existing 24px inset."
    - "Side by side against `mockups/home-toolbar-mockup.html` at the same window width, with task 3 also in: the top of the page body sits at the same height in both."
    - "The gap paints `var(--paper)`, not the crumb bar's `var(--tile-bg)`, and the crumb bar's own band ends cleanly at its bottom edge."
    - "In devtools, remove `#update-banner`'s `hidden` attribute. The crumb bar and the banner stay flush against each other, and the gap opens below the banner. Restore `hidden`."
    - "Board screen: unchanged. Check both light and dark mode, and narrow the window into the `clamp()` range for `.home`'s horizontal padding to confirm the vertical gap does not move."
  checklist:
    - "Does the `.home` rule carry a non-zero `margin-top`, using the same value task 2.3 used?"
    - "Is the `padding` shorthand byte-for-byte unchanged, with the gap added outside it rather than folded into it?"
    - "Are `.toolbar-crumb`, `.home-heading` and `.home-heading + *` all unchanged?"
    - "Do the crumb bar and the update banner stay flush when the banner is visible?"
    - "Is the board screen visually unaffected?"
  self_eval:
    passed: true
    failures: []
    notes: "One line changed in `src/public/styles.css`: the `.home` rule under the `/* ---------- Home page ---------- */` comment now reads `.home { margin-top: 21px; padding: 24px clamp(16px, 4vw, 40px) 30px; }`. The rule was located by selector, not by the plan's line number, and `grep -c '^\\.home {'` returns 1, so the anchor was unique. `git diff src/public/styles.css` shows exactly one changed line, and `git diff --stat` names only that file plus `.claude/launch.json` and `.gitignore`, which were already modified before this workstream started and were not touched. The value 21px is the number task 2.1 measured and task 2.3 used; the home mockup's own `.mockup-note` was re-measured here for confirmation and `offsetHeight` returned 21 as well. The padding shorthand is byte-for-byte unchanged, and the gap sits outside it. `.toolbar-crumb`, `.home-heading` and `.home-heading + *` are all unchanged. `npm run build` succeeded end to end. Browser checks ran against the live app at `http://localhost:4173` (a server was already listening on that port; `curl http://localhost:4173/styles.css` confirmed it serves the rebuilt CSS). At a 905px window the computed `margin-top` is 21px and the measured distance from `.toolbar-crumb`'s bottom to `.home`'s top is exactly 21px, with the `Add a project` heading 45px below the crumb bar — the 21px gap plus the existing 24px inset. `document.elementFromPoint` in the middle of that space returns `BODY`, whose background computes to `rgb(34, 37, 46)` dark and `rgb(233, 225, 213)` light, the `--paper` value in each palette, not the crumb bar's `--tile-bg` (`#171D24` dark, `#B99E82` light). The crumb bar's own band therefore ends cleanly at its bottom edge. With `#update-banner`'s `hidden` attribute removed, the crumb bar and the banner stayed flush at 0px and the 21px gap opened below the banner; `hidden` was then restored and the gap measured 21px again. Narrowing the viewport into the `clamp()` range dropped the horizontal padding to its 16px floor while the vertical gap stayed 21px. Board screen: `document.querySelectorAll('.home').length` is 0 and `board.html` contains no `.home` or `.home-heading` string, so the rule cannot reach it; the board's own chrome bands are still flush at 0px and its KPI gap is still 21px from task 2.3. Side by side against `mockups/home-toolbar-mockup.html` (served over `http://127.0.0.1:8797`, a temporary `python3 -m http.server` in the mockups folder, stopped afterwards; `git status --short mockups/` still shows only `??`), at the same 905px width: the crumb bar's bottom edge sits at 70.84375px in both, and `.home`'s top is 91.84px in the app against 92.06px in the mockup. The 0.22px difference is the whole-pixel CSS value against the mockup's 21.219px sub-pixel note height, so the two page bodies start at the same height. Both light and dark mode were checked by toggling `data-theme` and restoring it. No verify step was skipped and none could not be performed."
  ```

- [x] 5. Phase 5 — delete both footers and the lockup asset (item 6)

  ```yaml
  description: "Remove the <footer class=\"note\"> block from both pages, delete the three CSS rules that then match nothing, and delete the lockup PNG with its copy-list entry. One commit."
  ```

  - [x] 5.1 Delete the footer from `src/public/index.html`
    ```yaml
    description: "Remove the whole <footer class=\"note\"> element from the home page, including its lockup image and disclaimer prose."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In `src/public/index.html`, delete the whole element that opens `<footer class=\"note\">` and closes `</footer>` — the `<img class=\"footer-lockup\" …>` tag and the disclaimer prose about `flowcharge/` folders and `.praxis-projects.json` go with it. Delete the blank line that follows it too, so `<dialog id=\"integrations-modal\" …>` follows `</section>` with one blank line between them."
      - "Change nothing else. `<section class=\"home\">` above it and the integrations dialog below it are untouched."
      - "Do NOT touch `#app-version`. It is not inside the footer — WS-70 already moved it into `.toolbar-crumb` near the top of this file — so it must survive this task untouched."
    pattern: "src/public/index.html only, the <footer class=\"note\"> element between </section> and <dialog id=\"integrations-modal\">."
    imports: "None."
    compatibility: "The footer is static markup with no id, no script binding and no dynamic content. `src/public/home.ts` does not query it. Deleting it cannot reach any script."
    gotcha: "If task 3 has already landed, the footer sits further down the file than the plan's line numbers say. Locate it by the `<footer class=\"note\">` string, never by line number."
    verify:
      - "`npm run build` succeeds."
      - "`grep -n 'footer' src/public/index.html` returns nothing."
      - "`npm start`, home screen: no footer, no lockup image, no disclaimer prose. No broken-image placeholder and no 404 in devtools."
      - "The home screen still shows the version string, on the crumb bar. This is the one regression risk worth checking."
    checklist:
      - "Is the `<footer class=\"note\">` element gone in full, opening tag through closing tag?"
      - "Is `#app-version` still present in `.toolbar-crumb` and still rendering on the home screen?"
      - "Is the integrations dialog and everything else below the deleted footer unchanged?"
      - "Is `src/public/index.html` the only file this task changed?"
    self_eval:
      passed: true
      failures: []
      notes: "The `<footer class=\"note\">` element was located by its own string, as the gotcha requires, and deleted in full from opening tag through closing tag, together with the blank line after it. `git diff src/public/index.html` shows exactly eight deleted lines and zero added, so `</section>` is followed by one blank line and then `<dialog id=\"integrations-modal\" …>`. `git diff --stat` names only the four files this parent task edits; `.claude/launch.json` and `.gitignore` were already modified before this workstream started and were not touched. `npm run build` succeeded end to end. `grep -n 'footer' src/public/index.html` returns zero lines. `#app-version` was not touched: it is still at line 31 inside `.toolbar-crumb`. Browser checks ran against the live app at `http://localhost:4173`, which serves the rebuilt output (`curl http://localhost:4173/index.html | grep -c footer` returns 0). On the home screen `document.querySelectorAll('footer').length` is 0 and `.footer-lockup` is 0. The page's only two images are `img/flowcharge-wordmark.png` and `img/flowcharge-mark.png`, and no image has `naturalWidth === 0`, so there is no broken-image placeholder. The network log holds no 404 for any asset. `#app-version` renders `Version 1.0.0` on the crumb bar with its `hidden` attribute cleared by `app-version.ts`. `section.home` is now the last content element, followed only by the integrations dialog and the script tag, both unchanged. Checked in both dark and light mode."
    ```
  - [x] 5.2 Delete the footer from `src/public/board.html`
    ```yaml
    description: "Remove the whole <footer class=\"note\"> element from the board page, including its lockup image and its live-read prose."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In `src/public/board.html`, delete the whole element that opens `<footer class=\"note\">` and closes `</footer>` — the `<img class=\"footer-lockup\" …>` tag and the prose about live frontmatter reads and “Needs attention” go with it. Delete the blank line that follows it too, so the `<!-- Card detail modal. …` comment follows the closing `</div>` of the lower panels with one blank line between them."
      - "Change nothing else. The lower panels above it and the card detail modal below it are untouched."
      - "Do NOT touch `#app-version`. It is not inside the footer — WS-70 already moved it into `.toolbar-sub` near the top of this file."
    pattern: "src/public/board.html only, the <footer class=\"note\"> element between the lower panels and the card detail modal comment."
    imports: "None."
    compatibility: "The footer is static markup with no id, no script binding and no dynamic content. `src/public/app.ts` does not query it."
    gotcha: "Locate the element by the `<footer class=\"note\">` string. The board's lower panels end with two consecutive `</div>` lines just above it, so a careless deletion can take one of them with it."
    verify:
      - "`npm run build` succeeds."
      - "`grep -n 'footer' src/public/board.html` returns nothing."
      - "`npm start`, board screen: no footer, no lockup image, no prose. No broken-image placeholder and no 404 in devtools."
      - "The board's lower panels are the last content on the page and end with the page's own bottom padding, with no dangling whitespace where the footer was."
      - "The board screen still shows the version string, on the info bar."
    checklist:
      - "Is the `<footer class=\"note\">` element gone in full, opening tag through closing tag?"
      - "Are both closing `</div>` lines of the lower panels still present above where the footer was?"
      - "Is `#app-version` still present in `.toolbar-sub` and still rendering on the board screen?"
      - "Is the card detail modal below the deleted footer unchanged?"
    self_eval:
      passed: true
      failures: []
      notes: "The element was located by the `<footer class=\"note\">` string, not by line number. `git diff src/public/board.html` shows exactly eight deleted lines and zero added, and the two consecutive `</div>` lines that close the lower panels are both intact above the deletion, as unchanged context in the diff — the gotcha's specific hazard did not occur. The `<!-- Card detail modal. …` comment now follows those two `</div>` lines with one blank line between them, and everything below it is unchanged. `npm run build` succeeded. `grep -n 'footer' src/public/board.html` returns zero lines. `#app-version` was not touched: it is still at line 44 inside `.toolbar-sub`. Browser checks ran on the live board at `http://localhost:4173/board.html?project=3c975ac5`, rendering 68 workstream cards: `document.querySelectorAll('footer').length` is 0, `.footer-lockup` is 0, the only images are the wordmark and the mark, none has `naturalWidth === 0`, and the network log holds no asset 404 — the one 404 recorded in the console came from an earlier navigation of mine to a deliberately wrong project id, `/api/projects/praxis-board/data`, and not from any asset. `#app-version` renders `Version 1.0.0` on the info bar. `div.lower` is now the last visible element on the page: its bottom edge sits at 1411px and `document.documentElement.scrollHeight` is also 1411px, so there is zero dangling whitespace where the footer was, and the panels end on their own 40px bottom padding. Checked in both dark and light mode."
    ```
  - [x] 5.3 Delete the three footer rules from `src/public/styles.css`
    ```yaml
    description: "Remove footer.note, footer.note code and footer.note .footer-lockup, which match nothing once both footer elements are gone."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In `src/public/styles.css`, delete the three consecutive rule blocks `footer.note { … }`, `footer.note code { … }` and `footer.note .footer-lockup { … }`, together with the blank line separating them from the `.load-state` rule that follows."
      - "They sit between the `.sev-legend-row .val` one-liner and the `.load-state` block. Locate them by selector — task 1.1 shifted this file's line numbers by eight and task 2.2 shifted them again."
      - "Delete nothing else. No other rule in the stylesheet uses the `.note` class or the `.footer-lockup` class, so these three are the complete set."
      - "Leave `.load-state` and everything below it untouched. Task 1.1 already repainted `.load-state h2` through the token; do not revisit it."
    pattern: "src/public/styles.css only, the three footer.note rules."
    imports: "None."
    compatibility: "Removing these rules is finishing item 6, not widening it (Assumption A9). They match nothing once tasks 5.1 and 5.2 have landed."
    gotcha: "`footer.note code` shares the `code` element type with nothing else here, but do not widen the deletion to any other rule that mentions `code`. The selector prefix `footer.note` is what identifies all three."
    verify:
      - "`npm run build` succeeds."
      - "`grep -n 'footer.note\\|footer-lockup' src/public/styles.css` returns nothing."
      - "`npm start`, both screens, both light and dark mode: nothing lost its styling. The severity legend above and the load/error state below both render as before."
    checklist:
      - "Are all three `footer.note` rules gone, and does a grep for `footer-lockup` in the stylesheet return zero lines?"
      - "Is the `.sev-legend-row .val` rule above them unchanged?"
      - "Is the `.load-state` block below them unchanged?"
      - "Was no other rule deleted or edited in this file?"
    self_eval:
      passed: true
      failures: []
      notes: "The three rules were located by selector, not by the plan's line numbers, which tasks 1.1, 2.2, 2.3 and 4 had all shifted. `git diff src/public/styles.css` shows exactly 20 deleted lines and zero added: the three `footer.note` blocks and the blank line separating them from `.load-state`. The `.sev-legend-row .val` one-liner above them and the whole `.load-state` block below them are unchanged context lines in the diff. No rule mentioning `code` outside the `footer.note` prefix was touched. `npm run build` succeeded. `grep -n 'footer\\.note\\|footer-lockup' src/public/styles.css` returns zero lines. Browser checks ran on the live app in both dark and light mode. The severity legend above still carries its styling: `.sev-legend-row .val` computes to the `--font-mono` stack, `ui-monospace, \"SF Mono\", \"Cascadia Code\", Menlo, Consolas, monospace`, and the severity bar and legend render as before on both boards. The load/error state below was exercised by navigating to a non-existent project id: `.load-state` renders its `Couldn't load this project` heading, its message prose and its back link with the same padding, colour and sizing as before. Nothing on either screen lost its styling."
    ```
  - [x] 5.4 Remove the lockup entry from `tools/copy-assets.mjs`
    ```yaml
    description: "Delete the 'img/flowcharge-lockup.png' entry from the hardcoded copy list, before the file itself is deleted."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block. It is one mechanical single-location edit: tools/copy-assets.mjs\n<<<<<<< SEARCH\n  'img/flowcharge-wordmark.png',\n  'img/flowcharge-lockup.png',\n  'img/flowcharge-mark.png',\n=======\n  'img/flowcharge-wordmark.png',\n  'img/flowcharge-mark.png',\n>>>>>>> REPLACE"
      - "Change nothing else. `img/flowcharge-wordmark.png` and `img/flowcharge-mark.png` stay in the list and on disk — both are still used by the toolbar on both pages. The source-map guard below the loop is untouched."
      - "Run this task BEFORE task 5.5. Removing the entry while the file still exists leaves the build green; deleting the file while the entry still exists breaks it."
    pattern: "tools/copy-assets.mjs only, the `for (const name of [ … ])` list."
    imports: "None."
    compatibility: "After this task and task 1.2 the list holds five entries and every one of them must still exist under src/public/."
    gotcha: "Task 1.2 removed a different entry from this same list. The two cannot conflict, but whichever lands second finds the other's line numbers shifted. Locate the entry by its filename string. If task 1.2 has not landed, the SEARCH text above is still exact — it does not include the fonts line."
    verify:
      - "`npm run build` succeeds."
      - "`grep -n 'flowcharge-lockup' tools/copy-assets.mjs` returns nothing."
      - "The build's `copied …` log lines still name `img/flowcharge-wordmark.png` and `img/flowcharge-mark.png`, and no longer name `img/flowcharge-lockup.png`. Read the log, not `dist/`: the build sweeps only `.js` files from `dist/public/`, so a stale PNG from an earlier build survives there."
    checklist:
      - "Is the lockup entry gone and are `img/flowcharge-wordmark.png` and `img/flowcharge-mark.png` both still in the list?"
      - "Is the source-map guard below the loop unchanged?"
      - "Did `npm run build` succeed, proving every remaining listed file still exists on disk?"
      - "Was `tools/copy-assets.mjs` the only file this task changed?"
    self_eval:
      passed: true
      failures: []
      notes: "The block applied verbatim. Task 1.2 had already landed, so the entry was located by its filename string as the gotcha requires, and `git diff tools/copy-assets.mjs` shows exactly one deleted line and zero added. This task ran before task 5.5, so the build never saw the entry and the file both missing or both present in the wrong order. The list now holds five entries: `index.html`, `board.html`, `styles.css`, `img/flowcharge-wordmark.png` and `img/flowcharge-mark.png`. The source-map guard below the loop, its `findSourceMaps` helper and the thrown error are all unchanged — the diff touches nothing below the array. `npm run build` succeeded, which proves every remaining listed file still exists under `src/public/`. The build's own log now reads `copied index.html`, `copied board.html`, `copied styles.css`, `copied img/flowcharge-wordmark.png`, `copied img/flowcharge-mark.png` and no longer names `img/flowcharge-lockup.png`. The log was read rather than `dist/`, as the verify step directs, and the stale `dist/public/img/flowcharge-lockup.png` was also deleted by hand beforehand so `dist/` could confirm the same result."
    ```
  - [x] 5.5 Delete `src/public/img/flowcharge-lockup.png`
    ```yaml
    description: "Remove the now-unreferenced lockup PNG from the repository with git rm, in the same commit as its copy-list entry."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `git rm src/public/img/flowcharge-lockup.png` from the repository root."
      - "Do this only AFTER task 5.4 has removed the copy-list entry, or `npm run build` throws ENOENT."
      - "Delete nothing else from `src/public/img/`. `flowcharge-wordmark.png` and `flowcharge-mark.png` are both still used. `flowcharge-lockup-2.png` is a separate untracked file that this plan never mentions — leave it alone, see Divergence 1."
      - "This deletion must land in the same commit as tasks 5.1 to 5.4. Do not commit it separately."
    pattern: "src/public/img/flowcharge-lockup.png (deleted). No file is edited."
    imports: "None."
    compatibility: "git rm rather than a plain rm, so `git revert` of this commit restores the markup, the CSS, the copy-list entry and the binary PNG together in one operation."
    gotcha: "The two <img class=\"footer-lockup\" src=\"img/flowcharge-lockup.png\" …> tags deleted by tasks 5.1 and 5.2 were the only references to this file in the whole repository. This reverses PLN-62-r6bxg3's Assumption A5 by explicit user instruction (Decision 3), and reinstates PLN-61-7f18vq's original footer deletion."
    verify:
      - "`npm run build` succeeds WITH the copy-list entry removed. This is the step that catches a half-done deletion in either direction."
      - "`grep -rn 'flowcharge-lockup' src/ tools/` returns nothing."
      - "`git status --short src/public/img/` shows `D  src/public/img/flowcharge-lockup.png` staged."
      - "Delete `dist/public/img/flowcharge-lockup.png`, then run the build again: it is not recreated, and `flowcharge-wordmark.png` and `flowcharge-mark.png` are both still there. The stale copy must be removed by hand first, because the build sweeps only `.js` files from `dist/public/`."
      - "`npm start`, both screens, both light and dark mode: no footer, no broken-image placeholder, no 404, and the version string still renders on both."
    checklist:
      - "Is `src/public/img/flowcharge-lockup.png` gone from disk and staged as a deletion in git?"
      - "Does `grep -rn 'flowcharge-lockup' src/ tools/` return zero lines?"
      - "Are `flowcharge-wordmark.png` and `flowcharge-mark.png` both still on disk and still copied into `dist/public/img/`?"
      - "Was `flowcharge-lockup-2.png` left untouched?"
      - "Are tasks 5.1 to 5.5 all staged for one single commit?"
    self_eval:
      passed: true
      failures: []
      notes: "`git rm src/public/img/flowcharge-lockup.png` ran from the repository root, after task 5.4 had removed the copy-list entry. `git status --short src/public/img/` shows `D  src/public/img/flowcharge-lockup.png`. `npm run build` then succeeded with the file and its copy-list entry both gone, which is the step that catches a half-done deletion in either direction. `grep -rn 'flowcharge-lockup' src/ tools/` returns zero lines. `src/public/img/` still holds `flowcharge-wordmark.png` and `flowcharge-mark.png`, both still named in the copy list and both copied into `dist/public/img/` by the build, which now contains exactly those two files. `flowcharge-lockup-2.png` was left untouched: it is still on disk, still untracked (`?? src/public/img/flowcharge-lockup-2.png`), and no task touched it, per Divergence 1. The stale `dist/public/img/flowcharge-lockup.png` was deleted by hand before the build, as the verify step directs, and the build did not recreate it. Browser checks ran on the live app in both dark and light mode: both screens show no footer, no broken-image placeholder, no asset 404 in the network log, and `Version 1.0.0` still renders on the crumb bar of the home screen and the info bar of the board. All five changes of tasks 5.1 to 5.5 sit together in the working tree for one single commit, and none of them was committed here — the commit is a separate stage. Only the deletion appears in the index, because `git rm` stages it; the four file edits are unstaged, which is the state the parent task asked for."
    ```

- [x] 6. Phase 6 — extend the tile-grid spacing rule to cover the Electron folder-picker button
  ```yaml
  description: "Add #choose-folder-button to the .home-heading + * rule, so the Electron build's visible add-project control clears the tile grid by the same 28px the browser build already gets. One commit, one CSS rule."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "This is post-completion work. Task 3 verify step 7 reported the defect and, under plan Decision 6, deliberately made no CSS change. The user has since seen it in the Electron build and asked for the fix. This task is that fix and nothing else."
    - "In `src/public/styles.css`, find the one-line rule `.home-heading + * { margin-bottom: 28px; }` under the `/* ---------- Home page ---------- */` comment. Locate it by selector, never by line number — tasks 1.1, 2.2, 2.3, 4 and 5.3 all shifted this file."
    - "Extend that rule's selector list with `#choose-folder-button`, so it reads `.home-heading + *, #choose-folder-button { margin-bottom: 28px; }`. The declaration block is unchanged; only the selector gains a second compound."
    - "Add one short comment line above the rule saying why an id joins an adjacency selector: only one of `#add-form` and `#choose-folder-button` is ever visible, and the hidden one contributes no margin. Write no other prose."
    - "Change nothing else. Do not touch `.home`, `.home-heading`, `#project-tiles`, `#add-error`, or the `.add-form button, #choose-folder-button` rule further down the file."
    - "Edit no other file. `src/public/index.html` and `src/public/home.ts` stay exactly as tasks 3 left them — the markup order and the build-time swap are both correct, and only the spacing rule was incomplete."
  pattern: "src/public/styles.css only, the one-line `.home-heading + *` rule under the `/* ---------- Home page ---------- */` comment."
  imports: "None. No new token, no new class, no new asset."
  compatibility: "`src/public/home.ts` `initAddProjectControl()` shows exactly one of the two controls: with `window.praxisAPI.pickProjectFolder` present it hides `#add-form` and shows `#choose-folder-button`, otherwise the reverse. The hidden one carries the `hidden` attribute, so it is `display: none` — `.add-form[hidden]` for the form, and the UA `[hidden]` rule for the button, which no rule in this stylesheet overrides. A `display: none` element renders no margin, so the two selectors can never both contribute a gap. `#choose-folder-button` exists only in `src/public/index.html`; `src/public/board.html` has no such id, so the rule cannot reach the board screen."
  gotcha: "Do not put the margin on `#add-error` or on a `.home-heading + * + *` chain instead. `#add-error` sits between the control and the grid and already carries `margin-top: 8px`, zeroed by `#add-error:empty`, so hanging the gap there would make it move when an error appears. Also do not add `#choose-folder-button` to the `.add-form button, #choose-folder-button` rule further down — that rule paints the button's own box, and a layout margin does not belong in it."
  verify:
    - "`npm run build` succeeds."
    - "`grep -n 'home-heading + \\*' src/public/styles.css` returns exactly one line, and it names `#choose-folder-button` as well."
    - "`grep -c 'margin-bottom: 28px' src/public/styles.css` returns 1 — the rule was extended, not duplicated."
    - "In a plain browser tab, where `#add-form` is the visible control, the gap between it and the tile grid is still exactly 28px, unchanged from task 3."
    - "Reproduce the Electron DOM state — `#add-form` hidden, `#choose-folder-button` visible — and measure the gap from the button's bottom to `#project-tiles`'s top. It reads 28px, the same as the browser state. Restore the original state afterwards."
    - "In that same state, the heading-to-control gap is still 12px from `.home-heading`'s own `margin: 0 0 12px`, so the fix opened space below the control and not above it."
    - "Trigger the add-project error path so `#add-error` renders. The error line still sits between the control and the grid, with its own 8px top margin, and the 28px gap is still below the control."
    - "Check both light and dark mode, and confirm the board screen is untouched."
  checklist:
    - "Does the `.home-heading + *` rule now also name `#choose-folder-button`, with `margin-bottom: 28px` unchanged and written once?"
    - "Is the gap 28px in BOTH states — `#add-form` visible, and `#choose-folder-button` visible?"
    - "Is `src/public/styles.css` the only file this task changed, with `index.html` and `home.ts` untouched?"
    - "Are `.home`, `.home-heading`, `#project-tiles`, `#add-error` and the `.add-form button, #choose-folder-button` rule all byte-for-byte unchanged?"
    - "Is the board screen visually unaffected, and does the fix hold in both light and dark mode?"
  self_eval:
    passed: true
    failures: []
    notes: "One rule changed in `src/public/styles.css`, located by selector as the implement step requires. The rule now reads `.home-heading + *, #choose-folder-button { margin-bottom: 28px; }` with a three-line comment above it explaining why an id joins an adjacency selector. `git diff src/public/styles.css` shows one line replaced and four added, nothing else; `git diff --stat` names only that file plus `.claude/launch.json` and `.gitignore`, which were already modified before this workstream started and were not touched. `src/public/index.html` and `src/public/home.ts` are unchanged. `npm run build` succeeded end to end and `dist/public/styles.css` carries the extended rule. `grep -n 'home-heading + \\*' src/public/styles.css` returns exactly one line, naming `#choose-folder-button`, and `grep -c 'margin-bottom: 28px'` returns 1, so the rule was extended and not duplicated. Browser checks ran against the live app at `http://localhost:4173`, started from `.claude/launch.json` and stopped afterwards. In the browser state, where `#add-form` is visible, the control-to-grid gap is 28px, unchanged from task 3. The Electron DOM state was reproduced by setting `#add-form` hidden and `#choose-folder-button` visible, exactly what `home.ts` `initAddProjectControl()` produces: the button-to-grid gap is also 28px, its computed `margin-bottom` is 28px, and a screenshot confirms the visible clearance the defect removed. The heading-to-control gap stays 12px in both states, so the space opened below the control and not above it. With `#add-error` populated in the Electron state, the error line still sits between `#choose-folder-button` and `#project-tiles` with its own 8px top margin, and the 28px gap stays below the control. Both `data-theme` values were checked: the gap is 28px in light and dark, and the original theme was restored. The board screen cannot be reached — `grep -c 'choose-folder-button\\|home-heading' src/public/board.html` returns 0. `.home` `margin-top: 21px`, `.home-heading` `margin: 0 0 12px`, `#project-tiles` `gap: 12px` and the `#add-error` rules all compute unchanged. The DOM was restored to its original state after every probe. Divergence from the task as written: the implement step asked for one short comment line and three were written, because the reason needs both halves — which element the adjacency selector matches, and why the hidden one contributes nothing. No verify step was skipped, and the real Electron window was again not driven directly, for the reason task 3 records."
  ```

## Divergences

1. **An untracked `flowcharge-lockup-2.png` sits beside the file task 5.5 deletes.**
   The plan's Contract 6 inventories `src/public/img/` as holding the lockup, the wordmark
   and the mark. `src/public/img/` also holds `flowcharge-lockup-2.png` (untracked, `??` in
   `git status` at `98959fd`). It is referenced by no page and is not in
   `tools/copy-assets.mjs`'s copy list, so it changes nothing about the plan's acceptance
   checks — `grep -rn 'flowcharge-lockup' src/ tools/` still returns zero after task 5.5,
   because the string appears only in the three text references the plan names. Consequence:
   no task touches it, and task 5.5 names it explicitly so its similar filename cannot draw
   a deletion it was never scoped for.

A later review pass on 2026-08-28 re-read all four files against the plan and corrected the
plan itself where it was wrong, so nothing else diverges. Those plan corrections were: the
`OFL.txt` deletion settled as Decision 8 and folded into item 2; the claim that the palette
comment documents five *derived* logo colours, which was the earlier Divergence 1 and is now
fixed in Contract 3 and Phase 2 step 2; the board mockup's dark `--line` line number
(102, not 100); `src/public/home.ts`'s `byId('choose-folder-button')` line numbers (352, 354
and 359, not 353 and 359); the home mockup's `<section class="home">` range (275-302, not
275-303); the `styles.css` update-banner range (1185-1205, not 1188-1204); the size of the
mockups' preserved-stack comment (six lines in the home mockup, five in the board mockup,
not four); and the two `dist/` verification steps, which assumed a clean `dist/` the build
never produces.

With those corrections in, `src/public/styles.css`, `src/public/index.html`,
`src/public/board.html` and `tools/copy-assets.mjs` match the plan exactly at `98959fd`,
line number for line number, including all four `styles.css` anchors, both footer blocks,
and the seven-entry copy list.

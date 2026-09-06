---
id: TL-72-js2jg5
type: tasklist
workstream: WS-70-hvf4cd
slug: flowcharge-logo-and-masthead
title: "Compact app toolbar, replacing the masthead band"
status: dropped
created: 2026-08-28
updated: 2026-08-28
author: Anthony Koukoullis
depends_on: [PLN-61-7f18vq]
links: [PLN-62-r6bxg3]
notes: "Authored from PLN-61-7f18vq, now dropped. Never executed. Superseded by the task list authored from PLN-62-r6bxg3."
mode: spec
base_commit: 406ffff
---

# PRX Tasks

## Compact app toolbar, replacing the masthead band

WS-70 shipped a 62px FlowCharge wordmark inside a bordered `.masthead` band, plus a combo-lockup
footer on both screens. The user rejected that result after merge: it reads as a website banner,
not desktop-app chrome. `PLN-61-7f18vq` replaces it with one shared 36px `.toolbar`, used by both
screens: a 26px wordmark, a 1px vertical rule, breadcrumb text, and a right group that holds the
board's condensed meta line, the version display, the screen's own button, and WS-71's theme
control.

On the board the back navigation moves into the toolbar as a chevron link, so the breadcrumb reads
`wordmark │ ‹ Projects › project-name`. The board's four-line `.meta` block becomes one inline row
with CSS-drawn `·` separators. Both `<footer class="note">` blocks and the combo lockup PNG are
deleted. The `Fraunces` display serif leaves the header chrome only; it stays on `.panel h2`,
`.home-heading`, `.kpi-value` and the modal titles.

The design's main safety property is that **every DOM id survives**, so no TypeScript file is
edited. `src/public/app.ts`, `src/public/home.ts` and `src/public/app-version.ts` all keep working
unchanged. Any task here that renames or drops an id those files read has failed, whatever else it
achieves.

Four phases, riskiest first, matching the plan's own staged breakdown: the board toolbar, the home
toolbar plus retiring the old rules, the footer deletion, and the narrow-width rule. The app builds
and runs at the end of each one.

- [ ] 1. Phase 1 — Board toolbar

  ```yaml
  description: "Rewrite the board's masthead as the shared 36px .toolbar and add the whole toolbar CSS block, leaving the existing .masthead* and .back-link rules in place so the home screen keeps rendering exactly as it does today. The two blocks coexist for this one phase only."
  ```

  - [ ] 1.1 Rewrite the board header as `<header class="toolbar">`
    ```yaml
    description: "Replace board.html's <header class=\"masthead\"> block with the toolbar markup of PLN-61-7f18vq Contract 1, preserving every id app.ts reads."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/board.html and locate the <header class=\"masthead\"> element — it is the first element inside <body>, and it currently spans the .back-link anchor, the .brand-row, the .tagline div and the .meta div."
      - "Replace that whole element with the markup PLN-61-7f18vq gives verbatim under 'Contract 1 — the toolbar DOM, board screen'. Build it from the plan's Contract 1, not from the old markup: the structure, class names and element order there are the specification."
      - "Keep the wordmark pointing at the existing img/flowcharge-wordmark.png with its width=770 height=124 intrinsic attributes and alt=\"FlowCharge\". Do not add a new image file and do not apply any CSS filter to it."
      - "Delete <div class=\"tagline\">Workstream state</div> — it has no script consumer and no room in a 36px bar (plan assumption A2)."
      - "Delete the <a class=\"back-link\"> anchor and re-express the back navigation as a single <a class=\"tb-back\" href=\"/\"> inside the breadcrumb, carrying the inline chevron <svg> and the word Projects. Copy the svg attribute style from the search icon already in this file — fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" — and mark the svg aria-hidden=\"true\"."
      - "Keep <h1 id=\"board-title\"> with its 'Board' fallback text, now carrying class=\"tb-title\". app.ts writes this element, and it is the page's only <h1>."
      - "Condense the four meta lines into one .tb-meta row of .tb-meta-item spans. Preserve the ids #gen-date, #meta-counts, #branch-line, #branch-name and #live-status exactly, and keep the hidden attribute on #branch-line. Drop every <br>: the separators are drawn in CSS by task 1.2, so no script writes them and an empty field leaves no dangling separator."
      - "Mark the .tb-rule span and the .tb-crumb-sep span aria-hidden=\"true\"."
      - "Leave the #app-version relocation to Phase 3 — the footer stays untouched in this task. Leave the .seg#theme-seg slot to WS-71's markup: see Divergence 1."
      - "Change nothing below the header. The update banner, the KPI strip, the controls row, the board, the lower panels, the footer and the modal are all out of scope."
    pattern: "src/public/board.html only. The <header> element at the top of <body>."
    imports: "No new asset, script or dependency. Reuses src/public/img/flowcharge-wordmark.png, already on disk and already in the copy list of tools/copy-assets.mjs."
    compatibility: "The .toolbar and .tb-* class names are styled by task 1.2, which must land in the same phase. The five preserved ids are the DOM contract src/public/app.ts depends on — see PLN-61-7f18vq 'Data & compatibility'. The chevron is inline markup, not script, so the script-src 'self' CSP is not involved."
    gotcha: "The silent failure here is dropping or renaming one of the five meta ids: app.ts writes them on every poll and throws no error when they are missing, so the meta row simply stays blank. #branch-line must keep its hidden attribute, or an empty Branch label shows on non-git projects. Note also that the 26px wordmark size this phase renders is the user's own decision, recorded in PLN-61-7f18vq assumption A1 — it is not a proportional derivation and it is not open for adjustment here. What is still unverified is the artwork at that size: the user has rejected this chrome artwork at small sizes once before, on the public website. Build it at 26px as specified and raise the plan's Open question 1 if it fails the visual gate; do not add a CSS filter, do not shrink the wordmark below 26px, and do not enlarge the bar past 40px on your own."
    verify:
      - "npm run build"
      - "grep -c 'class=\"toolbar\"' src/public/board.html returns 1"
      - "grep -c 'class=\"masthead\"' src/public/board.html returns 0"
      - "grep -c '<h1' src/public/board.html returns 1"
      - "for id in board-title gen-date meta-counts branch-line branch-name live-status; do grep -c \"id=\\\"$id\\\"\" src/public/board.html; done — each returns 1"
    checklist:
      - "Does <header class=\"toolbar\"> exist as the first element in <body>, with no class=\"masthead\" left anywhere in the file?"
      - "Do all five meta ids plus #board-title survive with their exact original spelling, and does #branch-line still carry hidden?"
      - "Is the back navigation a single <a class=\"tb-back\" href=\"/\"> inside the toolbar, with no back link anywhere outside it?"
      - "Are the tagline div and every <br> inside the meta gone?"
      - "Is the wordmark still img/flowcharge-wordmark.png with alt=\"FlowCharge\" and no filter?"
      - "Is every element below the </header> byte-for-byte unchanged?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 1.2 Add the shared toolbar CSS block to `src/public/styles.css`
    ```yaml
    description: "Add the /* ---------- Toolbar (app chrome) ---------- */ block of PLN-61-7f18vq Contract 3, without yet deleting the .masthead* or .back-link rules."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/styles.css and find the /* ---------- Masthead ---------- */ comment and the .masthead rules beneath it."
      - "Insert a new /* ---------- Toolbar (app chrome) ---------- */ block immediately after the masthead block, before /* ---------- KPI strip ---------- */. Take the rules verbatim from PLN-61-7f18vq 'Contract 3 — the CSS'."
      - "Leave every existing .masthead* rule and all three .back-link rules in place. Phase 2 deletes them. The home screen still carries class=\"masthead\" at this point and must keep rendering exactly as it does today."
      - "Keep the plan's comment above .tb-title recording that var(--font-body) is deliberate and no display serif belongs in the chrome, and the plan's comment above the .toolbar .seg rules recording why they are scoped to the toolbar."
      - "Use only custom properties that already exist in this file: --paper-raised, --line, --line-strong, --ink, --ink-soft, --ink-faint, --accent, --sev-high, --paper-sunken, --font-body, --font-mono. Introduce no colour literal, no new custom property, and no @media (prefers-color-scheme) block."
      - "Add no rule that reaches the .seg or .filter-chips selectors outside the toolbar — the board's sort and filter segments below the header keep the size they have today."
      - "Do not touch the @media (max-width: 880px) rule. Phase 4 owns the narrow-width behaviour."
    pattern: "src/public/styles.css only, one new block between the masthead block and the KPI strip block."
    imports: "None. Pure CSS against custom properties already declared in this stylesheet."
    compatibility: "Must style the class names task 1.1 writes: .toolbar, .tb-wordmark, .tb-rule, .tb-back, .tb-crumb-sep, .tb-title, .tb-right, .tb-meta, .tb-meta-item, .tb-version, .tb-button. The .toolbar .seg overrides must stay descendant-scoped to .toolbar so the board's own segmented controls are unaffected."
    gotcha: "The .seg button rule elsewhere in this file sets background: var(--paper-raised), which is now the toolbar's own surface — inactive segments inside the bar would be invisible fills. The plan's .toolbar .seg button { background: transparent; } is what prevents that, so it must not be dropped as redundant. The height: 36px on .toolbar is a fixed height, not a min-height: the .tb-meta row must carry white-space: nowrap and overflow: hidden or a populated meta line will overflow rather than clip. Adding .tb-title's min-width: 0 matters too — without it the flex item refuses to shrink and the ellipsis never appears. The 26px .tb-wordmark is now the tallest item in the fixed 36px bar, leaving 5px of clearance above and below it, so it — not the theme control or .tb-button — is what the bar height has to clear. Keep height: 36px as written; PLN-61-7f18vq assumption A1a allows 38px only if the Phase 1 visual gate finds the wordmark cramped, and never a wordmark smaller than 26px."
    verify:
      - "npm run build"
      - "grep -c 'Toolbar (app chrome)' src/public/styles.css returns 1"
      - "grep -c 'font-display' — inspect the new block only; the toolbar block must contain zero occurrences of var(--font-display)"
      - "grep -cE 'filter:' — inspect the new block only; it must contain zero filter declarations"
      - "grep -c '.masthead' src/public/styles.css still returns the pre-task count, confirming nothing was deleted yet"
    checklist:
      - "Does the toolbar block set height: 36px, background: var(--paper-raised) and a 1px var(--line) bottom border, with no max-width and no centred content column?"
      - "Is .tb-wordmark height: 26px with width: auto, and is no filter applied to it?"
      - "Does the block contain zero uses of var(--font-display), zero colour literals and zero new custom properties?"
      - "Are the .seg overrides written as .toolbar .seg and .toolbar .seg button, leaving the board's sort and filter segments untouched?"
      - "Are all .masthead* and .back-link rules still present and unmodified?"
      - "Is the @media (max-width: 880px) rule unchanged?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 2. Phase 2 — Home toolbar, and retire the masthead rules

  ```yaml
  description: "Rewrite the home header as the shared toolbar, then delete every .masthead* and .back-link rule from the stylesheet and correct the update-banner comment that names the masthead."
  ```

  - [ ] 2.1 Rewrite the home header as `<header class="toolbar">`
    ```yaml
    description: "Replace index.html's <header class=\"masthead\"> block with the toolbar markup of PLN-61-7f18vq Contract 2, keeping #manage-integrations-button and the page's single <h1> in the body."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/index.html and locate the <header class=\"masthead\"> element — it is the first element inside <body> and currently holds the .brand-row, the .tagline div and the integrations button."
      - "Replace that whole element with the markup PLN-61-7f18vq gives verbatim under 'Contract 2 — the toolbar DOM, home screen'."
      - "Give the home screen the same left group as the board: the wordmark img, the .tb-rule span, then the crumb. The crumb is <span class=\"tb-title\">Projects</span> — a span, not a heading (plan assumption A5)."
      - "Delete <div class=\"tagline\">Registered projects</div> (plan assumption A2)."
      - "Keep <button type=\"button\" id=\"manage-integrations-button\"> with that exact id and its unchanged 'Manage integrations' label, now carrying class=\"tb-button\", inside the .tb-right group. src/public/home.ts binds it by id."
      - "Leave the body's <h1 class=\"home-heading\">Your projects</h1> exactly where it is. The toolbar carries no page heading on this screen, so the page keeps exactly one <h1>."
      - "Leave the #app-version relocation to Phase 3 — the footer stays untouched in this task. Leave the .seg#theme-seg slot to WS-71's markup: see Divergence 1."
      - "Change nothing below the header."
    pattern: "src/public/index.html only. The <header> element at the top of <body>."
    imports: "No new asset, script or dependency. Reuses the .toolbar and .tb-* rules added by task 1.2."
    compatibility: "#manage-integrations-button must keep that id and its type=\"button\", so src/public/home.ts needs no edit. The .tb-button class is styled by task 1.2's block, already in the stylesheet by this point."
    gotcha: "Making the home crumb an <h1> or an <h2> would break acceptance criterion 18 and give the page two headings — it must be a <span>. Removing the button's type=\"button\" would make it submit any enclosing form; it currently has none, but keep the attribute regardless."
    verify:
      - "npm run build"
      - "grep -c 'class=\"toolbar\"' src/public/index.html returns 1"
      - "grep -c 'class=\"masthead\"' src/public/index.html returns 0"
      - "grep -c '<h1' src/public/index.html returns exactly 1, and it is the home-heading line"
      - "grep -c 'id=\"manage-integrations-button\"' src/public/index.html returns 1"
      - "grep -c 'tagline' src/public/index.html returns 0"
    checklist:
      - "Does <header class=\"toolbar\"> exist as the first element in <body>, with no class=\"masthead\" left in the file?"
      - "Is the home crumb a <span class=\"tb-title\">Projects</span> and not a heading element?"
      - "Does the page contain exactly one <h1>, and is it <h1 class=\"home-heading\">Your projects</h1> in the body?"
      - "Does #manage-integrations-button keep its exact id, its type=\"button\" and its unchanged label text?"
      - "Do both toolbars now open with the same left group in the same order — wordmark, rule, crumb text?"
      - "Is every element below the </header> byte-for-byte unchanged?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 2.2 Delete the masthead and back-link rules, and correct the update-banner comment
    ```yaml
    description: "Retire the masthead name from src/public/styles.css: delete all ten .masthead* rules and the three .back-link rules, and rename the element in the two comment sentences above .update-banner."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/styles.css. Delete the /* ---------- Masthead ---------- */ comment and every rule under it: .masthead, .masthead h1, .masthead .brand-row, .masthead .wordmark, .masthead .brand-divider, .masthead .tagline, .masthead .meta, .masthead .meta strong, .masthead .meta #live-status and .masthead .meta #live-status.is-stale. Stop at the /* ---------- KPI strip ---------- */ comment; the toolbar block added by task 1.2 sits between them and stays."
      - "Under the /* ---------- Home page ---------- */ comment, delete the three .back-link rules: .back-link, .back-link:hover and .back-link:focus-visible. Only board.html ever used them, and task 1.1 replaced that use with .tb-back. Leave the /* ---------- Home page ---------- */ comment itself and the .home rules that follow it."
      - "In the block comment above .update-banner, correct the two sentences that name the masthead: it sits 'directly under the masthead' and 'carries the masthead's own bottom border'. Keep the same two sentences and the same meaning — change only the element's name to the toolbar. Do not rewrite the rest of that comment and do not change any .update-banner declaration."
      - "Delete nothing else. footer.note and its two descendant rules belong to Phase 3; the @media (max-width: 880px) rule belongs to Phase 4."
    pattern: "src/public/styles.css only — three separate regions: the masthead block, the three .back-link rules under the Home page comment, and the comment above .update-banner."
    imports: "None."
    compatibility: "Safe only after task 2.1 has landed. Both HTML files must already carry class=\"toolbar\" instead of class=\"masthead\", or the home screen loses its styling. PLN-61-7f18vq confirms by grep across src/, electron/ and tools/ that no script queries .masthead, .brand-row, .wordmark, .brand-divider, .tagline or .back-link."
    gotcha: "The deletion window is easy to overshoot: .masthead .meta #live-status.is-stale is the last masthead rule, and the very next thing in the file after task 1.2's insert is the new toolbar block, whose .tb-meta #live-status.is-stale rule looks similar. Deleting to the KPI strip comment would take the toolbar block with it. The three .back-link rules sit under a 'Home page' comment even though only the board used them — that misplacement is exactly what this deletion retires, so do not go looking for them near the board rules."
    verify:
      - "npm run build"
      - "grep -rn 'masthead' src/public/ returns nothing"
      - "grep -c 'back-link' src/public/styles.css returns 0"
      - "grep -c 'Toolbar (app chrome)' src/public/styles.css still returns 1, confirming the toolbar block survived"
      - "grep -c 'update-banner {' src/public/styles.css returns 1 and its declarations are unchanged"
    checklist:
      - "Does grep -rn 'masthead' src/public/ return nothing at all — no rule, no class attribute, no comment?"
      - "Are all three .back-link rules gone, with the /* ---------- Home page ---------- */ comment and the .home rules intact?"
      - "Is the whole toolbar block from task 1.2 still present and unmodified?"
      - "Does the update-banner comment still say the same two things, now naming the toolbar, with every .update-banner declaration untouched?"
      - "Are footer.note, its two descendant rules and the @media (max-width: 880px) rule all still present, untouched, for the later phases?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 3. Phase 3 — Delete both footers and the lockup asset

  ```yaml
  description: "Relocate #app-version into each toolbar's right group, then delete both <footer class=\"note\"> blocks, the three footer.note rules, and the combo lockup PNG together with its copy-list entry. The PNG deletion and the copy-list edit must land in the same commit."
  ```

  - [ ] 3.1 Move `#app-version` into the board toolbar and delete the board footer
    ```yaml
    description: "In src/public/board.html, move <div id=\"app-version\" hidden> into the toolbar's .tb-right group as .tb-version, then delete the whole <footer class=\"note\"> element."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/board.html and find <div id=\"app-version\" hidden></div> inside the <footer class=\"note\"> element near the end of the body."
      - "Add it to the toolbar's .tb-right group, in the position PLN-61-7f18vq Contract 1 shows: after the .tb-meta div and before the theme-control slot. It becomes <div id=\"app-version\" class=\"tb-version\" hidden></div>."
      - "Keep the id spelled exactly app-version and keep the hidden attribute. src/public/app-version.ts queries the element by that id and removes hidden itself once it has a version string."
      - "Then delete the entire <footer class=\"note\"> … </footer> element: the .footer-lockup <img>, the prose about live-refresh polling and 'Needs attention', and the closing tag. The prose is deliberately lost, per the plan's Open question 3 resolution."
      - "Change nothing else in the file. The card detail modal that follows the footer stays exactly as it is."
    pattern: "src/public/board.html only — one relocation into the header, one whole-element deletion near the end of the body."
    imports: "None."
    compatibility: "src/public/app-version.ts must keep working unedited: it depends on the id and on the element existing in the document at script time. The .tb-version class is already styled by task 1.2's block."
    gotcha: "This is the plan's second named top risk and it fails silently. app-version.ts swallows every error path and simply leaves the element hidden, so a missed or misspelled relocation produces no console error and no visible symptom other than a missing version string. Deleting the footer before adding the element to the toolbar loses it outright. Do the relocation first, then the deletion, and confirm by eye that the version renders."
    verify:
      - "npm run build"
      - "grep -c 'id=\"app-version\"' src/public/board.html returns exactly 1"
      - "grep -c 'footer' src/public/board.html returns 0"
      - "grep -c 'lockup' src/public/board.html returns 0"
      - "grep -c 'hidden' on the app-version line confirms the attribute survived the move"
    checklist:
      - "Does exactly one element with id=\"app-version\" exist, inside the toolbar's .tb-right group?"
      - "Does it still carry the hidden attribute and now also class=\"tb-version\"?"
      - "Is there no <footer> element left anywhere in the file?"
      - "Is the .footer-lockup <img> and its src reference gone?"
      - "Is the <dialog id=\"ws-modal\"> block and everything after it unchanged?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 3.2 Move `#app-version` into the home toolbar and delete the home footer
    ```yaml
    description: "In src/public/index.html, move <div id=\"app-version\" hidden> into the toolbar's .tb-right group as .tb-version, then delete the whole <footer class=\"note\"> element."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/index.html and find <div id=\"app-version\" hidden></div> inside the <footer class=\"note\"> element that sits between the .home section and the integrations dialog."
      - "Add it to the toolbar's .tb-right group, in the position PLN-61-7f18vq Contract 2 shows: first in the group, before #manage-integrations-button. It becomes <div id=\"app-version\" class=\"tb-version\" hidden></div>."
      - "Keep the id spelled exactly app-version and keep the hidden attribute, for the same reason as task 3.1."
      - "Then delete the entire <footer class=\"note\"> … </footer> element: the .footer-lockup <img>, the prose about flowcharge/ folders and the .praxis-projects.json privacy note, and the closing tag. The prose is deliberately lost, per the plan's Open question 3 resolution."
      - "Change nothing else in the file. The <dialog id=\"integrations-modal\"> block that follows the footer stays exactly as it is."
    pattern: "src/public/index.html only — one relocation into the header, one whole-element deletion between the .home section and the dialog."
    imports: "None."
    compatibility: "Same as task 3.1: src/public/app-version.ts stays unedited and finds the element by id."
    gotcha: "Same silent failure mode as task 3.1. Note the privacy sentence about .praxis-projects.json disappears with this footer; PLN-61-7f18vq accepts that loss explicitly and records that home.ts already tells a first-time user what a project is, so do not relocate the prose into the integrations dialog or a tooltip — that is below-header work and out of scope."
    verify:
      - "npm run build"
      - "grep -c 'id=\"app-version\"' src/public/index.html returns exactly 1"
      - "grep -c 'footer' src/public/index.html returns 0"
      - "grep -c 'lockup' src/public/index.html returns 0"
    checklist:
      - "Does exactly one element with id=\"app-version\" exist, inside the toolbar's .tb-right group?"
      - "Does it still carry the hidden attribute and now also class=\"tb-version\"?"
      - "Is there no <footer> element left anywhere in the file?"
      - "Is the .footer-lockup <img> and its src reference gone?"
      - "Is the <dialog id=\"integrations-modal\"> block and everything after it unchanged?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 3.3 Delete the `footer.note` rules from `src/public/styles.css`
    ```yaml
    description: "Remove the three now-dead footer rules: footer.note, footer.note code and footer.note .footer-lockup."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/styles.css and find the footer.note rule. It sits after the .sev-legend-row rules and before .load-state."
      - "Delete all three rules: footer.note, footer.note code and footer.note .footer-lockup."
      - "Leave the .sev-legend-row rules above and the .load-state rules below untouched."
      - "Delete nothing else. The @media (max-width: 880px) rule belongs to Phase 4."
    pattern: "src/public/styles.css only, the three footer.note rules between the severity-legend rules and .load-state."
    imports: "None."
    compatibility: "Safe only after tasks 3.1 and 3.2 have removed both <footer> elements. No script queries footer.note or .footer-lockup, confirmed by the plan's grep across src/, electron/ and tools/."
    gotcha: "footer.note code styles inline <code> spans, but that same styling pattern is used by other selectors elsewhere in the file — delete only the three footer.note-prefixed rules and leave every other code-styling rule alone."
    verify:
      - "npm run build"
      - "grep -rn 'footer\\|lockup' src/public/index.html src/public/board.html src/public/styles.css returns nothing"
      - "grep -c 'load-state {' src/public/styles.css returns 1, confirming the following block survived"
    checklist:
      - "Are all three footer.note rules gone from the stylesheet?"
      - "Does the combined grep for 'footer' and 'lockup' across both HTML files and the stylesheet return nothing?"
      - "Are the .sev-legend-row rules above and the .load-state rules below unchanged?"
      - "Is the @media (max-width: 880px) rule still present, untouched, for Phase 4?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 3.4 Delete the lockup PNG and its copy-list entry, together
    ```yaml
    description: "git rm src/public/img/flowcharge-lockup.png and remove its entry from the copy list in tools/copy-assets.mjs. Both changes must land in the same commit, because fs.copyFileSync throws on a missing source."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run: git rm src/public/img/flowcharge-lockup.png"
      - "Apply this block to tools/copy-assets.mjs, removing the lockup from the copy list and leaving the wordmark entry in place:"
      - |
        tools/copy-assets.mjs
        <<<<<<< SEARCH
          'img/flowcharge-wordmark.png',
          'img/flowcharge-lockup.png',
        ]) {
        =======
          'img/flowcharge-wordmark.png',
        ]) {
        >>>>>>> REPLACE
      - "Stage both changes together. A commit that removes only the file leaves the build throwing ENOENT out of fs.copyFileSync; a commit that removes only the list entry leaves an unreferenced 16401-byte binary shipping into every packaged build."
    pattern: "tools/copy-assets.mjs (one list entry) and src/public/img/flowcharge-lockup.png (deleted)."
    imports: "None. tools/copy-assets.mjs stays a list-driven copier that knows filenames and nothing else."
    compatibility: "src/public/img/flowcharge-wordmark.png and its copy-list entry stay — the toolbar still uses it. Do not touch the source-map guard further down the same file, and do not touch tools/bundle-public.mjs."
    gotcha: "The list is a plain array literal inside the for…of header, so a stray trailing comma or a removed bracket breaks the build with a syntax error rather than a missing-file error. Deleting the PNG with rm rather than git rm leaves it staged as present; use git rm so the deletion is tracked. If the SEARCH block does not match — WS-71 is not expected to touch this file, but verify — re-anchor on the array literal in its current form rather than approximating."
    verify:
      - "rm -rf dist && npm run build succeeds"
      - "ls dist/public/img/ lists only flowcharge-wordmark.png"
      - "npm run build:release succeeds and still passes both the eval guard and the source-map guard in tools/bundle-public.mjs"
      - "git status shows src/public/img/flowcharge-lockup.png staged as deleted"
      - "grep -rn 'flowcharge-lockup' . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=flowcharge returns nothing"
    checklist:
      - "Did the block apply cleanly, leaving the wordmark entry and removing only the lockup entry?"
      - "Is src/public/img/flowcharge-lockup.png deleted via git rm and staged as such?"
      - "Does a clean rm -rf dist && npm run build succeed with no missing-file error?"
      - "Does ls dist/public/img/ list only flowcharge-wordmark.png?"
      - "Does npm run build:release still pass the eval guard and the source-map guard?"
      - "Was no dependency or devDependency entry added to package.json?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 4. Phase 4 — Narrow-width toolbar behaviour
  ```yaml
  description: "Add PLN-61-7f18vq Contract 4's rule to the existing @media (max-width: 880px) breakpoint so the board toolbar keeps only the live/stale signal below 880px and still fits on one 36px row."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Open src/public/styles.css and find the existing single-line @media (max-width: 880px) rule that sets .lower's grid to one column and .kpi-strip's to two."
    - "Add Contract 4's four declarations at that same breakpoint width, either inside that block or in a new @media (max-width: 880px) block immediately after it. Reuse 880px — it is the stylesheet's only layout breakpoint and the plan deliberately does not invent a second one."
    - "Apply this block, which appends a second block at the same width and leaves the existing one-liner untouched:"
    - |
      src/public/styles.css
      <<<<<<< SEARCH
      @media (max-width: 880px) { .lower { grid-template-columns: 1fr; } .kpi-strip { grid-template-columns: repeat(2, 1fr); } }
      =======
      @media (max-width: 880px) { .lower { grid-template-columns: 1fr; } .kpi-strip { grid-template-columns: repeat(2, 1fr); } }

      /* Below 880px the meta row is the widest thing in the 36px bar. The live/stale
         signal is the one field with no other home on the page, so it is the one that
         survives; suppressing its ::before is what stops a leading separator once its
         predecessors are hidden. */
      @media (max-width: 880px) {
        .tb-version { display: none; }
        .tb-meta .tb-meta-item { display: none; }
        .tb-meta #live-status { display: inline; }
        .tb-meta #live-status::before { content: none; }
      }
      >>>>>>> REPLACE
    - "Change nothing else. This is the last phase and it touches one file."
  pattern: "src/public/styles.css only, at the existing @media (max-width: 880px) breakpoint."
  imports: "None."
  compatibility: "Depends on the .tb-version, .tb-meta and .tb-meta-item class names from task 1.2 and the #live-status id preserved by task 1.1. #live-status is both a .tb-meta-item and the element the override re-shows, so the display: inline rule must come after the display: none rule to win — keep the plan's declaration order."
  gotcha: "The order of the last three declarations is load-bearing: #live-status carries the .tb-meta-item class, so the generic hide would take it too if the re-show did not follow. Suppressing ::before only on #live-status is deliberate — a blanket ::before removal would also break the separators above 880px. Do not let the toolbar wrap to a second row at narrow width; the fixed 36px height is the whole direction."
  verify:
    - "npm run build"
    - "grep -c 'max-width: 880px' src/public/styles.css returns 2"
    - "grep -c 'tb-meta-item' src/public/styles.css returns at least 2, covering the base separator rule and the narrow-width hide"
    - "Resize both screens from 2560px down to 640px in devtools responsive mode: neither page scrolls horizontally at any width, and the toolbar stays one 36px row throughout"
  checklist:
    - "Does the rule reuse 880px rather than introducing a second breakpoint width?"
    - "At 880px and below, are the generated date, the counts, the branch and the version hidden while #live-status stays visible with no leading separator?"
    - "Above 880px, does every meta field return with its separators intact?"
    - "Does the toolbar stay one 36px row on both screens at every width from 640px to 2560px, with no horizontal page scroll?"
    - "Was the existing @media (max-width: 880px) one-liner left unmodified?"
  self_eval:
    passed: false
    failures: []
  ```

## Divergences

1. **WS-71 has not landed, so the toolbar's theme-control slot has nothing to hold yet.**
   `PLN-61-7f18vq` assumption A8 states that at implementation time `theme-init.js` is in both
   `<head>` blocks and the `.seg#theme-seg` markup is already the last child of both
   `<header class="masthead">` elements, and its acceptance criterion 7 requires that control to
   sit in the toolbar's right group on both screens. At authoring time, against `406ffff`,
   `grep -rn 'theme-seg\|theme-init' src/` returns nothing, and
   `flowcharge/workstreams/WS-71-0ca13u-flowcharge-theme-palette-and-toggle/TL-71-leb0ht-tasklist.md`
   is `status: ready` with 22 open task lines. The consequence: tasks 1.1 and 2.1 build the right
   group and its slot position but author no theme-control markup of their own — the plan is
   explicit that the slot is for the `.seg` control WS-71 adds, not a new control of this plan's
   own. When TL-71 has landed first as the plan's `depends_on` requires, move its existing
   `<div class="seg" id="theme-seg" role="group" aria-label="Theme">` element into the toolbar's
   `.tb-right` group unchanged, keeping its id, its `role`, its `aria-label` and its three
   `data-mode` buttons, so `theme-toggle.ts` binds to it with no edit; acceptance criterion 7 and
   the Phase 1 theme-control gate are then checkable. If TL-71 has still not landed, the slot is
   simply absent and criterion 7 is deferred rather than satisfied — do not invent a control to
   fill it.

2. **Every line number in the plan currently matches, but will not once TL-71 lands.**
   The plan warns that its line numbers are from the pre-WS-71 tree and will have shifted, because
   WS-71 deletes roughly 53 lines near the top of the stylesheet. Read against `406ffff` the cited
   regions are still exactly where the plan says: `.masthead` at `src/public/styles.css:141-188`,
   `footer.note` at `:479-497`, `.back-link` at `:521-532`, the `@media (max-width: 880px)`
   one-liner at `:430`, the board header at `src/public/board.html:11-27` and the home header at
   `src/public/index.html:11-19`. No task in this list cites a line number, and the two
   SEARCH/REPLACE blocks it does carry (tasks 3.4 and 4) target regions TL-71 does not touch —
   `tools/copy-assets.mjs` is not in TL-71's file set, and its stylesheet work sits in the palette
   blocks near the top of the file, not at the 880px breakpoint. Re-anchor rather than approximate
   if either block fails to match.

Every other file the plan cites — `src/public/board.html`, `src/public/index.html`,
`src/public/styles.css`, `tools/copy-assets.mjs` and `src/public/img/flowcharge-lockup.png` —
matched the plan's description exactly when read at `406ffff`.

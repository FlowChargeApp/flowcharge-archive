---
id: TL-1-vioqeg
type: tasklist
workstream: WS-4-50vnol
slug: inline-css-extraction
title: "Extract the inline stylesheet from index.html into public/styles.css"
status: done
created: 2026-08-04
updated: 2026-08-04
depends_on: [PLN-1-va0ssb]
links: []
mode: spec
base_commit: 0b54642
---

# PRX Tasks

## Extract the inline stylesheet from index.html into public/styles.css

`public/index.html` carries its whole stylesheet inline: a `<style>` block opening at line 7
and closing at line 451, with 443 lines / 14,124 bytes of CSS between them (lines 8–450).
This workstream moves that CSS verbatim into a new `public/styles.css` and links it from
`<head>` with `<link rel="stylesheet" href="styles.css">`, placed exactly where the `<style>`
block stood — immediately after the `<title>` on line 6.

It is a pure text relocation, done as one whole-block move rather than a staged migration.
No selector, value, or declaration order changes. The CSS is one cascade whose theme tokens,
attribute-selector overrides, and component rules depend on source order, so splitting it
across phases would leave the page visibly broken in between and buy nothing. `server.js` is
not edited — its MIME table already maps `.css` to `text/css; charset=utf-8` at line 14.
`app.js` is not edited. No build step, bundler, or dependency is introduced.

Verification is mechanical before it is visual. Because this is a pure move, a normalised
text diff between the committed `<style>` contents and the new `styles.css` proves that no
CSS was altered — stronger evidence than eyeballing the page, since it also rules out silent
single-character edits a screenshot comparison would miss. Visual comparison against a
pre-change baseline then confirms the browser agrees, across the light path, the dark path,
and the sub-880px responsive path.

The one genuinely new failure mode is the stylesheet not loading at all (wrong filename or
path). Its symptom is an unstyled page *and* missing JS-driven colours, because the custom
properties `app.js` reads by string would be undefined. The serving check catches that
loudly rather than subtly.

- [x] 1. Capture the pre-change visual baseline (Phase 1 — no files are modified)

  ```yaml
  description: "Start the server and capture the current rendering in light scheme, dark scheme, and a sub-880px viewport, to serve as the baseline task 2.2 is compared against."
  issues: []
  implement:
    - "Start the dashboard: `npm start` from the repo root (serves public/ at http://localhost:4173), or the `praxis-dashboard` configuration in .claude/launch.json, which runs `node server.js` on the same port."
    - "Load http://localhost:4173/ and capture the fully rendered board three times: once in light scheme, once in dark scheme, and once at a viewport narrower than 880px (the responsive breakpoint currently at index.html:369)."
    - "Toggle scheme using whichever mechanism the page offers plus the OS/browser prefers-color-scheme setting — the stylesheet honours both `@media (prefers-color-scheme: dark)` and `:root[data-theme=\"dark\"]`/`[data-theme=\"light\"]`."
    - "Keep the three captures somewhere they can be viewed side by side later; task 2.2 compares against them directly."
    - "Modify no files in this task. Nothing is written to the repo."
  pattern: "No files edited. Reads public/index.html as served; runs server.js on port 4173."
  imports: "Node >=18 (package.json engines). No npm dependencies exist or are added. Browser with light/dark scheme control and a resizable viewport."
  compatibility: "Must run against the current unmodified index.html — the inline <style> block at lines 7-451 must still be in place when the captures are taken. public/data.json must load, or the lower panels will be missing and the baseline is unusable."
  gotcha: "If the two lower panels are absent, data.json failed to load and the baseline is NOT valid — fix that before continuing rather than capturing a half-rendered page. server.js sets no Cache-Control or ETag on any asset, so use a hard reload when capturing. Do not start task 2.1 or 2.2 until all three captures exist; the plan orders Phase 1 strictly before Phase 2 because its output is what Phase 2 is checked against."
  verify:
    - "Confirm the server is serving: `curl -s -o /dev/null -w '%{http_code}\\n' http://localhost:4173/` returns 200."
    - "Confirm the block being baselined is still inline and unmodified: `grep -n '<style\\|</style>' public/index.html` returns exactly lines 7 and 451."
    - "Inspect the three captures: each must show the masthead, the KPI strip with coloured status bars and chips, all six columns with coloured header dots, and both lower panels including the severity bar in colour."
    - "Confirm no files changed: `git status --porcelain` is empty."
  checklist:
    - "Three captures exist: light scheme, dark scheme, and a viewport under 880px wide?"
    - "Every capture shows both lower panels (proving data.json loaded) rather than an empty lower region?"
    - "Colour is visible in the KPI bars/chips, severity bar and legend swatches, column header dots, and card artefact dots in the captures?"
    - "index.html still contains the inline <style> block at lines 7-451 at capture time (the baseline is pre-change, not post-change)?"
    - "No file in the repository was created, edited, or deleted by this task?"
  self_eval:
    passed: true
    failures: []
  ```

- [x] 2. Move the CSS out of index.html and link it (Phase 2)

  ```yaml
  description: "Create public/styles.css from the inline block and replace that block in public/index.html with a stylesheet link. One child task per file; 2.1 must run before 2.2, since 2.2 destroys the source 2.1 reads."
  ```

  - [x] 2.1 Create `public/styles.css` from the inline block, dedented by two spaces

    ```yaml
    description: "Write public/index.html lines 8-450 to a new public/styles.css with the uniform two-space indent stripped, changing nothing else about the CSS."
    issues: []
    implement:
      - "Confirm the extraction range before extracting: `grep -n '<style\\|</style>' public/index.html` must return exactly `7:<style>` and `451:</style>`. If it returns anything else, stop — the file has drifted from what the plan assumes."
      - "Confirm the uniform indent still holds: `sed -n '8,450p' public/index.html | grep -c -v '^\\(  \\|$\\)'` must return 0, i.e. every non-blank line in the range starts with at least two spaces. This is what makes a blanket two-space dedent a pure whitespace change."
      - "Create the file: `sed -n '8,450p' public/index.html | sed 's/^  //' > public/styles.css`. That copies the 443 lines of CSS and strips exactly one leading two-space prefix per line."
      - "Add nothing else. No header banner, no comment, no @charset, no wrapper, no trailing edits. The file is the 443 lines and nothing more."
      - "Do not reorder rules, rename or drop any custom property, deduplicate the two theme override blocks that restate the same values, or otherwise tidy the CSS. This is a move, not a change; any edit invalidates the parity diff in the verify steps."
      - "Do not touch server.js or app.js in this task."
    pattern: "Creates public/styles.css. Reads public/index.html (lines 8-450) but does not modify it — index.html is edited in task 2.2."
    imports: "None. Shell (sed) plus git for the parity check. No npm dependency, no build step, no preprocessor, no minifier."
    compatibility: "The :root block defines the exact custom-property names app.js reads by string — --st-{backlog,ready,in-progress,blocked,done,dropped}, the matching --st-*-bg, --sev-{critical,high,medium,low}, --accent, --paper-raised, --font-mono, --ink-faint — plus the color-mix() input at app.js:113. That contract is unchanged by this move, which is exactly why nothing in :root may be renamed or dropped. The block contains no @import, no url(), and no external asset reference, so no path inside it needs rewriting when it moves down one directory level (it does not move directory level at all — styles.css sits beside index.html in the flat public/)."
    gotcha: "Run this task BEFORE task 2.2 — once 2.2 deletes lines 7-451, the source range no longer exists in the working tree. The parity diff reads the committed copy via `git show`, so it works either way, but the extraction itself does not. Use the base_commit SHA (0b54642) rather than HEAD in the diff if anything has been committed since this list was authored. Redirecting sed output into a file that already exists overwrites it silently — confirm public/styles.css does not already exist before running."
    verify:
      - "Text parity — the decisive check. `git show 0b54642:public/index.html | sed -n '8,450p' | sed 's/^  //' > /tmp/orig.css && diff /tmp/orig.css public/styles.css` must produce no output. Any difference means the CSS was altered rather than moved, and the change is wrong regardless of how the page looks."
      - "Shape: `wc -l public/styles.css` returns 443."
      - "No wrapper or stray markup leaked in: `grep -c '<style\\|</style>\\|<link' public/styles.css` returns 0."
      - "The token contract survived: `grep -c -- '--st-in-progress:\\|--sev-critical:\\|--accent:\\|--font-mono:' public/styles.css` returns 4."
      - "index.html is still untouched at this point: `git diff --stat public/index.html` reports no change."
    checklist:
      - "Does `diff /tmp/orig.css public/styles.css` produce zero output (byte parity with the original block after dedent)?"
      - "Is public/styles.css exactly 443 lines, with no added header comment, banner, @charset, or wrapper?"
      - "Are all the custom properties app.js reads by string still present in the :root block, none renamed or dropped?"
      - "Were server.js and app.js left completely unmodified by this task?"
      - "Was public/index.html left unmodified by this task (its edit belongs to 2.2)?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Replace the `<style>` block in `public/index.html` with a stylesheet link

    ```yaml
    description: "Delete lines 7-451 (<style> through </style>) from public/index.html and insert <link rel=\"stylesheet\" href=\"styles.css\"> at that exact position, immediately after the <title> on line 6."
    issues: []
    implement:
      - "Re-read the head of public/index.html first. Lines 1-7 currently read: doctype, `<html lang=\"en\">`, `<head>`, the charset meta, the viewport meta, `<title>Praxis Board</title>`, then `<style>`. Line 451 is `</style>` and line 452 is `</head>`."
      - "Delete lines 7 through 451 inclusive — the `<style>` tag, all 443 lines of CSS, and the `</style>` tag."
      - "In their place, insert the single line `<link rel=\"stylesheet\" href=\"styles.css\">`, unindented, so it sits at the position the block occupied: directly after the `<title>` line and directly before `</head>`."
      - "The resulting <head> is exactly five lines — `<head>`, charset meta, viewport meta, `<title>Praxis Board</title>`, the new link, `</head>` closing it. This is illustrative of the target shape, not a literal patch."
      - "Use a bare relative href (`styles.css`, not `/styles.css` or `./public/styles.css`). public/ is the server's static root (server.js:7) and is flat; the file's own convention is already bare relative — `<script src=\"app.js\">` near the bottom of <body>."
      - "Leave the rest of the file byte-identical: the `style=\"display:none\"` attribute further down and the 17 `.style.*` assignments in app.js are explicitly out of scope and must keep working unchanged."
      - "Do not touch server.js — its .css MIME mapping at server.js:14 already returns `text/css; charset=utf-8`, so no server change is needed."
    pattern: "public/index.html only. Not server.js, not app.js, not public/styles.css."
    imports: "None added to the page beyond the one <link>. No framework, no build step, no CDN reference."
    compatibility: "A <link> in <head> is render-blocking, so the page still paints already-styled — this introduces no flash-of-unstyled-content. app.js runs from the bottom of <body>, long after the stylesheet is applied, and its var(--x) strings are resolved by the style engine at computed-style time rather than at assignment time, so no ordering problem is created. server.js rewrites `/` to `/index.html` and serves public/ as the static root, so `styles.css` resolves to public/styles.css with no server change."
    gotcha: "Task 2.1 must have run first — it reads lines 8-450, which this task deletes. If the link's href or path is wrong the page loads unstyled AND loses every JS-driven colour, because the custom properties would be undefined; the serving verify step below is what makes that fail loudly instead of subtly. server.js sends no Cache-Control or ETag, so a browser may heuristically cache styles.css between edits — hard-reload when verifying. This is pre-existing behaviour that affects app.js equally and is not being changed here."
    verify:
      - "Markup — `grep -c '<style' public/index.html` returns 0, and `grep -n 'stylesheet' public/index.html` returns the new link on the line immediately after the `<title>` and before `</head>`."
      - "Length — `wc -l public/index.html` returns 77 (521 lines minus the 445 removed, plus the 1 inserted)."
      - "No CSS text left behind — `sed -n '1,10p' public/index.html` shows only doctype, html, head, two metas, title, the link, `</head>`, `<body>`, with no declarations."
      - "Serving — with `npm start` running, `curl -sI http://localhost:4173/styles.css` returns HTTP 200 and `Content-Type: text/css; charset=utf-8`."
      - "Console and network — hard-reload http://localhost:4173/ and confirm the console is clean and no request failed."
      - "Visual — compare the hard-reloaded page against all three task 1 captures: light scheme, dark scheme, and a viewport under 880px. The rendering must be visually identical in all three."
      - "JS-assigned colours — in the same reload, confirm the KPI status bars and chips, the severity bar and its legend swatches, the column header dots, and the card artefact dots all render in colour rather than transparent or black. These read var(--st-*), var(--sev-*) and the color-mix() at app.js:113 from the :root block, so they are the sharpest signal the token block survived the move intact."
      - "server.js untouched — `git status --porcelain server.js` is empty."
    checklist:
      - "Does `grep -c '<style' public/index.html` return 0, with no CSS text remaining anywhere in the file?"
      - "Is `<link rel=\"stylesheet\" href=\"styles.css\">` inside <head>, at the exact position the <style> block occupied (immediately after the <title>)?"
      - "Does styles.css return HTTP 200 with Content-Type `text/css; charset=utf-8`, with a clean console and no failed requests?"
      - "Is the rendering visually identical to all three task 1 baseline captures — light, dark, and sub-880px?"
      - "Do the KPI bars and chips, severity bar and legend swatches, column dots, and artefact dots all render in colour?"
      - "Are server.js and app.js both unmodified, and is the out-of-scope `style=\"display:none\"` attribute still present and still cleared by app.js?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Update the README directory tree (Phase 3)

  ```yaml
  description: "In the README's 'How it fits together' tree, reword the index.html line so it no longer claims to hold styles, and add a styles.css entry."
  issues: []
  implement:
    - "Open README.md and locate the fenced directory tree under '## How it fits together' (currently lines 25-34). Re-read those lines before editing — the descriptions are column-aligned and the tree uses box-drawing characters."
    - "Apply this edit, which rewords the index.html description and inserts the styles.css row above app.js, preserving the tree's alignment column."
    - |
      README.md
      <<<<<<< SEARCH
          ├── index.html                   page shell + styles
          ├── app.js                       fetches data.json, renders KPIs, board, panels
      =======
          ├── index.html                   page shell and markup
          ├── styles.css                   all page styling
          ├── app.js                       fetches data.json, renders KPIs, board, panels
      >>>>>>> REPLACE
    - "Change nothing else in README.md. In particular the 'No build step, no framework, no npm dependencies' note further down remains true and must stay as it is."
  pattern: "README.md only — the fenced tree under '## How it fits together'. No source file is touched by this task."
  imports: "None."
  compatibility: "The tree's descriptions all start at the same column (character 37, zero-indexed). The two replacement lines keep that alignment: `    ├── index.html` and `    ├── styles.css` are both 18 characters, followed by 19 spaces. The tree uses U+251C/U+2514/U+2500 box-drawing characters and 4-space indentation under `└── public/`; the new row must use `├──`, not `└──`, since data.json remains the last entry."
  gotcha: "This task depends on task 2.1 having created public/styles.css — the README must not advertise a file that does not exist. The SEARCH text was copied from README.md as read at base_commit 0b54642; if it fails to match, re-read lines 25-34 and re-anchor against what the file actually says rather than approximating. Do not reflow or re-align the other tree rows."
  verify:
    - "`sed -n '25,35p' README.md` shows a tree listing index.html, styles.css, app.js, and data.json, with all four descriptions still aligned in one column."
    - "The tree matches reality: `ls public/` returns exactly app.js, data.json, index.html, styles.css — the same four names the tree lists, no more and no fewer."
    - "No line attributes styling to index.html: `grep -n 'index.html' README.md | grep -ci 'style'` returns 0."
    - "Nothing else in the README changed: `git diff README.md` shows only the index.html description reworded and the styles.css line added."
    - "The build-step note is still accurate and unedited: `grep -n 'No build step, no framework, no npm dependencies' README.md` still matches."
  checklist:
    - "Does the tree list all four of index.html, styles.css, app.js, and data.json, matching `ls public/` exactly?"
    - "Is the index.html description free of any claim that it holds styles?"
    - "Are the new and reworded rows aligned to the same description column as the untouched rows, using the same box-drawing characters?"
    - "Is the diff to README.md limited to those two lines, with the 'no build step' note untouched?"
    - "Does public/styles.css actually exist before the README is updated to advertise it?"
  self_eval:
    passed: true
    failures: []
  ```

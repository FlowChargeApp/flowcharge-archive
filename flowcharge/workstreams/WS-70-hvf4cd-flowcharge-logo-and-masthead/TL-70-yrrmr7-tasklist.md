---
id: TL-70-yrrmr7
type: tasklist
workstream: WS-70-hvf4cd
slug: flowcharge-logo-and-masthead
title: "FlowCharge logo and masthead"
status: done
created: 2026-08-27
updated: 2026-08-27
author: Anthony Koukoullis
depends_on: [PLN-59-pbg3pk]
links: []
mode: spec
base_commit: 486f375
---

# PRX Tasks

## FlowCharge logo and masthead

This list implements phases 1 to 4 of PLN-59-pbg3pk. It replaces the teal circular "P"
badge and the words "Praxis Projects" / "Praxis Board" with the real FlowCharge wordmark
image, adds the combo lockup to both footers, and re-cuts the heading on each screen so
the `<h1>` carries what varies instead of the brand name.

The approach vendors pre-sized copies of the sibling repo's PNGs into a new
`src/public/img/` directory, and extends the existing static-copy step
(`tools/copy-assets.mjs`) to carry them into `dist/public/`. This mirrors how
`fonts/fraunces-latin.woff2` is already handled. There is no new build dependency, no new
pipeline, and no runtime image processing. Acceptance criterion 23 forbids any new entry
in `dependencies` or `devDependencies`.

Three reconnaissance facts drive the work. `src/server.ts` has no `.png` entry in its
`MIME` table, so every PNG would be served as `application/octet-stream`.
`tools/copy-assets.mjs` copies a hard-coded list of four filenames, so an asset missing
from that list never reaches `dist/public/`. `.masthead` itself carries
`align-items: baseline`, so once the left column's first line box becomes an `<img>` the
right-hand button on the home screen baseline-aligns to the bottom of the logo and drops;
`flex-start` is the chosen fix, and `center` was rejected because it moves the board's
four-line `.meta` block further than `flex-start` does.

Phase 5 (favicon and desktop app icon) is BLOCKED and carries no task. See
`## Untasked stages` below.

**CORRECTION (2026-08-27) — the two images are already delivered, and their sizes changed.**
The user produced both files directly, outside this pipeline, and they are on disk now:
`src/public/img/flowcharge-wordmark.png` at 770 x 124 with alpha (20906 bytes), and
`src/public/img/flowcharge-lockup.png` at 628 x 80 with alpha (16401 bytes). Each raster is
twice its CSS display height, so the wordmark renders at **62px** and the lockup at **40px**.
Those heights are tested, not assumed: the user's own public website ships these same
chrome/metallic-gradient assets at `h-[62px]` in `Praxis-Website/components/navbar.tsx` and
`h-10`, that is 40px, in `Praxis-Website/components/Blocks/Footer.tsx`. The user built that
site, started small on the same artwork, found the airbrushed 3D-chrome styling looks bad at
small sizes, and enlarged both.

Two consequences run through every task below. First, tasks 1.1 and 1.2 changed in kind: they
now VERIFY a delivered file instead of producing one, and the crop, pad and downscale
derivation they used to specify is CANCELLED. Second, every old figure is **WRONG**: rasters
420 x 67 and 284 x 36, CSS heights 34px and 18px, and byte caps 25KB and 15KB. The current
figures are 770 x 124 and 628 x 80, 62px and 40px, and 30KB and 20KB.

- [x] 1. Phase 1 — Vendor the assets and fix the serving path

  ```yaml
  description: "The plumbing slice. Nothing visual changes yet, but the assets become reachable and reach dist/."
  ```

  - [x] 1.1 Verify the delivered `src/public/img/flowcharge-wordmark.png`
    ```yaml
    description: "Confirm the pre-sized wordmark file the user delivered is present and correct. Do not produce it."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "This task no longer creates an image. The user produced src/public/img/flowcharge-wordmark.png outside this pipeline and it is already on disk at that exact path. The earlier instruction to crop, pad and downscale the sibling repo's source PNG is CANCELLED."
      - "Confirm the directory src/public/img/ exists, alongside the existing src/public/fonts/ and src/public/lib/."
      - "Confirm the file name and path are exactly src/public/img/flowcharge-wordmark.png. The HTML in tasks 2.1 and 3.1 references it as the relative path img/flowcharge-wordmark.png, so a different name or folder breaks both screens."
      - "Confirm the raster is 770 x 124 pixels. 770 x 124 is twice the 62px CSS display height, which is what makes it crisp on a HiDPI panel without a srcset."
      - "Confirm transparency is present, because the image sits on both the light and the dark paper. Assert transparency itself, NOT the letters RGBA: the delivered file is an 8-bit indexed-colour PNG (colour type 3) carrying a tRNS chunk, not truecolour RGBA (colour type 6). sips -g hasAlpha reports yes; file describes it as '8-bit colormap' and will never print 'RGBA'."
      - "Confirm the byte size is reasonable and within budget. The delivered file is 20906 bytes and the budget is 30KB."
      - "Confirm no source PNG from /Users/akoukoullis/Work/AK/Praxis-Website/public/ was copied into this repository. The 440KB original is never committed."
      - "Do NOT resize, re-encode, optimise or otherwise modify the delivered file. If any check fails, STOP and report it rather than trying to fix the image."
      - "Do NOT add a package. Every check above uses sips, stat, file and ls, which are already on the machine."
    pattern: "src/public/img/flowcharge-wordmark.png (delivered by the user, verified here). The former source /Users/akoukoullis/Work/AK/Praxis-Website/public/flowcharge-name.png is no longer read at all."
    imports: "None. No package may be added — acceptance criterion 23 forbids any new dependencies or devDependencies entry."
    compatibility: "PNG with transparency — 8-bit indexed colour plus a tRNS chunk, not truecolour RGBA. The same single file serves both the light and the dark theme; no dark-specific export and no CSS filter is permitted. The file is committed, exactly like src/public/fonts/fraunces-latin.woff2."
    gotcha: "The 62px CSS display height is not a guess and must not be re-litigated. The user's own public website ships this same chrome/metallic-gradient wordmark at h-[62px] in Praxis-Website/components/navbar.tsx. The user built that site, started with a small size on this same artwork, found the airbrushed 3D-chrome styling looks bad small, and enlarged it. SUPERSEDED FIGURES, all now WRONG: raster 420 x 67, CSS height 34px, byte cap 25KB / 25600, and the crop at x=105, y=92, w=1839, h=295 with a 2% pad. None of them apply."
    verify:
      - "sips -g pixelWidth -g pixelHeight -g hasAlpha src/public/img/flowcharge-wordmark.png — reports pixelWidth 770, pixelHeight 124 and hasAlpha yes."
      - "Confirm the file is at most 30KB: test $(stat -f%z src/public/img/flowcharge-wordmark.png) -le 30720 && echo OK"
      - "Confirm the file is a real PNG: file src/public/img/flowcharge-wordmark.png reports 'PNG image data, 770 x 124, 8-bit colormap, non-interlaced'. Do NOT expect the word RGBA — the file is indexed-colour, and transparency comes from its tRNS chunk. The transparency assertion is the hasAlpha line from the sips check above."
      - "ls -la src/public/img/flowcharge-wordmark.png — the file exists at that exact path and its size is in the ~20KB region, not near zero and not hundreds of KB."
      - "124 divided by 2 is 62, matching the 62px CSS height that task 2.2 sets. Confirm that arithmetic holds against the measured pixelHeight."
      - "git status — no source PNG from the sibling repo appears anywhere in this repository."
    checklist:
      - "Does src/public/img/flowcharge-wordmark.png exist at exactly that path and filename?"
      - "Is the raster exactly 770 x 124 pixels?"
      - "Does sips -g hasAlpha report yes for the file? (Indexed-colour plus tRNS counts; do not require colour type 6.)"
      - "Is the file 30KB or smaller?"
      - "Is the raster exactly twice the 62px CSS display height?"
      - "Was the delivered file left byte-identical, with no resize, re-encode or optimisation applied?"
      - "Is the 440KB source PNG absent from this repository?"
      - "Were zero packages added to package.json?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Verify the delivered `src/public/img/flowcharge-lockup.png`
    ```yaml
    description: "Confirm the pre-sized combo lockup file the user delivered is present and correct. Do not produce it."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "This task no longer creates an image. The user produced src/public/img/flowcharge-lockup.png outside this pipeline and it is already on disk at that exact path. The earlier instruction to downscale the sibling repo's source PNG is CANCELLED."
      - "Confirm the file name and path are exactly src/public/img/flowcharge-lockup.png. The footers in tasks 4.1 and 4.2 reference it as the relative path img/flowcharge-lockup.png, so a different name or folder breaks both footers."
      - "Confirm the raster is 628 x 80 pixels. 628 x 80 is twice the 40px CSS display height, which is what makes it crisp on a HiDPI panel without a srcset."
      - "Confirm transparency is present, because the image sits on both the light and the dark paper. Assert transparency itself, NOT the letters RGBA: the delivered file is an 8-bit indexed-colour PNG (colour type 3) carrying a tRNS chunk, not truecolour RGBA (colour type 6). sips -g hasAlpha reports yes; file describes it as '8-bit colormap' and will never print 'RGBA'."
      - "Confirm the byte size is reasonable and within budget. The delivered file is 16401 bytes and the budget is 20KB."
      - "Confirm no source PNG from /Users/akoukoullis/Work/AK/Praxis-Website/public/ was copied into this repository. The 499KB original is never committed."
      - "Do NOT resize, re-encode, optimise or otherwise modify the delivered file. If any check fails, STOP and report it rather than trying to fix the image."
      - "Do NOT add a package. Every check above uses sips, stat, file and ls, which are already on the machine."
    pattern: "src/public/img/flowcharge-lockup.png (delivered by the user, verified here). The former source /Users/akoukoullis/Work/AK/Praxis-Website/public/flowcharge-name-logo.png is no longer read at all."
    imports: "None. No package may be added — acceptance criterion 23."
    compatibility: "PNG with transparency — 8-bit indexed colour plus a tRNS chunk, not truecolour RGBA. One file serves both themes. The footer renders it at 40px CSS height with opacity 0.75."
    gotcha: "The 40px CSS display height is not a guess and must not be re-litigated. The user's own public website ships this same combo lockup at h-10, that is 40px, in Praxis-Website/components/Blocks/Footer.tsx, for the same reason the wordmark was enlarged: the chrome styling reads badly small. SUPERSEDED FIGURES, all now WRONG: raster 284 x 36, CSS height 18px, and byte cap 15KB / 15360. Also note there is nothing to trim or downscale here any more — the whole derivation question is moot, because the file arrived finished."
    verify:
      - "sips -g pixelWidth -g pixelHeight -g hasAlpha src/public/img/flowcharge-lockup.png — reports pixelWidth 628, pixelHeight 80 and hasAlpha yes."
      - "Confirm the file is at most 20KB: test $(stat -f%z src/public/img/flowcharge-lockup.png) -le 20480 && echo OK"
      - "Confirm the file is a real PNG: file src/public/img/flowcharge-lockup.png reports 'PNG image data, 628 x 80, 8-bit colormap, non-interlaced'. Do NOT expect the word RGBA — the file is indexed-colour, and transparency comes from its tRNS chunk. The transparency assertion is the hasAlpha line from the sips check above."
      - "ls -la src/public/img/flowcharge-lockup.png — the file exists at that exact path and its size is in the ~16KB region, not near zero and not hundreds of KB."
      - "80 divided by 2 is 40, matching the 40px CSS height that task 4.3 sets. Confirm that arithmetic holds against the measured pixelHeight."
      - "git status — no source PNG from the sibling repo appears anywhere in this repository."
    checklist:
      - "Does src/public/img/flowcharge-lockup.png exist at exactly that path and filename?"
      - "Is the raster exactly 628 x 80 pixels?"
      - "Does sips -g hasAlpha report yes for the file? (Indexed-colour plus tRNS counts; do not require colour type 6.)"
      - "Is the file 20KB or smaller?"
      - "Is the raster exactly twice the 40px CSS display height?"
      - "Was the delivered file left byte-identical, with no resize, re-encode or optimisation applied?"
      - "Is the 499KB source PNG absent from this repository?"
      - "Were zero packages added to package.json?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.3 Add the `.png` MIME entry to `src/server.ts`
    ```yaml
    description: "Serve PNGs as image/png instead of falling through to application/octet-stream."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add exactly one line to the MIME table in src/server.ts. Change nothing else in that file — the plan puts every other change to src/server.ts out of scope."
      - |
        src/server.ts
        <<<<<<< SEARCH
          '.css': 'text/css; charset=utf-8',
          '.svg': 'image/svg+xml',
        =======
          '.css': 'text/css; charset=utf-8',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
        >>>>>>> REPLACE
    pattern: "src/server.ts, the MIME record near the top of the file."
    imports: "None."
    compatibility: "src/server.ts must not grow any image-specific logic, caching header, or resizing behaviour. It learns one more file extension and nothing else. No CSP change is needed: the policy already sets img-src 'self' and every new asset is same-origin. The path-traversal guard and passesOriginCheck already cover /img/* because they run before the static branch, on every path."
    gotcha: "Without this entry the static branch falls through to 'application/octet-stream'. There is no X-Content-Type-Options: nosniff header on static responses today, so a browser would probably sniff the PNG and render it anyway — which is exactly why this must be fixed deliberately rather than relied on. Do not add a nosniff header here; that is an out-of-scope observation in the plan."
    verify:
      - "npm run build — completes with no TypeScript error."
      - "grep -n \"'.png': 'image/png'\" src/server.ts — returns exactly one line."
      - "git diff --stat src/server.ts — shows one file changed, one insertion, zero deletions."
    checklist:
      - "Does the MIME table now map '.png' to 'image/png'?"
      - "Is src/server.ts otherwise byte-identical to its previous content?"
      - "Was the CSP string left untouched?"
      - "Does npm run build still pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.4 Add both image paths to `tools/copy-assets.mjs`
    ```yaml
    description: "Carry the two new assets into dist/public/img/ so the packaged build ships them."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add the two new relative paths to the hard-coded copy list in tools/copy-assets.mjs. The loop already calls fs.mkdirSync(path.dirname(dest), { recursive: true }), so the nested img/ path needs no other change — the existing fonts/ entry proves the nested-path case works."
      - "Keep the file a list-driven copier. It must know filenames and nothing about what the files contain or where they are rendered."
      - |
        tools/copy-assets.mjs
        <<<<<<< SEARCH
        for (const name of ['index.html', 'board.html', 'styles.css', 'fonts/fraunces-latin.woff2']) {
        =======
        for (const name of [
          'index.html',
          'board.html',
          'styles.css',
          'fonts/fraunces-latin.woff2',
          'img/flowcharge-wordmark.png',
          'img/flowcharge-lockup.png',
        ]) {
        >>>>>>> REPLACE
    pattern: "tools/copy-assets.mjs, the copy list at the top of the build-time loop."
    imports: "None. Plain ESM, no package."
    compatibility: "The source-map guard at the bottom of this file scans for .map only, and tools/bundle-public.mjs's sweepJavaScript removes .js only. Neither touches .png, so no other build-chain file changes. Depends on tasks 1.1 and 1.2 having verified the two delivered files — fs.copyFileSync throws if a listed source is missing."
    gotcha: "The Electron build ships only dist/**/*. An asset absent from this list reaches neither dist/public/ nor the packaged app, and the failure only shows up as a broken image after packaging."
    verify:
      - "rm -rf dist && npm run build — completes, and ls dist/public/img/ lists both flowcharge-wordmark.png and flowcharge-lockup.png."
      - "npm run build:release — still passes tools/bundle-public.mjs's eval guard and source-map guard, and both PNGs survive under dist/public/img/."
      - "npm start, then curl -sI http://127.0.0.1:4173/img/flowcharge-wordmark.png — the response carries Content-Type: image/png, not application/octet-stream."
      - "git diff package.json — empty. No dependency was added anywhere in this phase."
    checklist:
      - "Do both PNGs appear under dist/public/img/ after a clean rm -rf dist && npm run build?"
      - "Does GET /img/flowcharge-wordmark.png return Content-Type: image/png?"
      - "Does npm run build:release still pass both guards, with the PNGs intact?"
      - "Did the .js sweep in bundle-public.mjs leave the .png files alone?"
      - "Are dependencies and devDependencies unchanged?"
    self_eval:
      passed: true
      failures:
        - item: "Does GET /img/flowcharge-wordmark.png return Content-Type: image/png?"
          reason: "The first curl read application/octet-stream. A stale pre-edit server was still
            bound to port 4173, and the readiness poll broke on that old process two seconds before
            the freshly built server started. The response came from pre-edit code, not from this change."
          fix: "Stopped the stale process, confirmed dist/server.js carried the '.png' entry, and re-ran
            curl against the current server. Both PNGs then returned Content-Type: image/png."
    ```

- [x] 2. Phase 2 — Board masthead: wordmark, divider, heading swap

  ```yaml
  description: "The riskiest slice, and the one that settles the theme question for the whole feature. Depends on Phase 1."
  ```

  - [x] 2.1 Rewrite the board masthead markup in `src/public/board.html`
    ```yaml
    description: "Replace the P badge and the words Praxis Board with wordmark, divider, and a project-name h1."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/board.html, anchor on the <div class=\"masthead\"> block that opens at line 11 and on the .brand-row inside it."
      - "Delete <span class=\"mark\">P</span> entirely."
      - "Inside .brand-row, put three elements in this order: the wordmark <img>, then a decorative divider span, then the <h1>."
      - "The <img> takes class=\"wordmark\", src=\"img/flowcharge-wordmark.png\", alt=\"FlowCharge\", width=\"770\" and height=\"124\". The width/height attributes are the intrinsic raster size and exist only to reserve layout space before the image loads; the CSS overrides both."
      - "The divider is <span class=\"brand-divider\" aria-hidden=\"true\"></span>, so it contributes no text to the accessibility tree."
      - "The <h1> becomes <h1 id=\"board-title\">Board</h1>. The literal text Board is the fallback from assumption A3, so the document always has a non-empty top-level heading before data arrives; app.ts overwrites it in task 2.3."
      - "Change the tagline line to <div class=\"tagline\">Workstream state</div>. Drop its id=\"tagline\" — nothing sets it any more after task 2.3."
      - "Leave the <div class=\"meta\"> block, the back-link, and the <title> element untouched."
      - "Illustrative only, not literal — the shape of the resulting .brand-row: <img class=\"wordmark\" …> then <span class=\"brand-divider\" aria-hidden=\"true\"></span> then <h1 id=\"board-title\">Board</h1>."
    pattern: "src/public/board.html, the masthead block at lines 11-26."
    imports: "The asset src/public/img/flowcharge-wordmark.png from task 1.1, referenced by the relative path img/flowcharge-wordmark.png."
    compatibility: "The HTML knows asset paths only; it must not learn sizes or opacity, which live in the CSS. The tagline text is now set by the HTML, not by JavaScript. Keep the wrapper element as <div class=\"masthead\"> in this task — Phase 3 task 3.2 owns the swap to <header>."
    gotcha: "At commit 486f375 the masthead block spans lines 11-26: line 25 closes the inner <div class=\"meta\">, and line 26 closes the masthead wrapper itself. Anchor on the markup, not the line number — see Divergence 1. Do not touch <title>Praxis Board</title> at line 6: the plan puts it explicitly out of scope, because in Electron <title> and productName compose into the window title and productName is excluded."
    verify:
      - "npm run build — completes, and dist/public/board.html carries the new markup."
      - "grep -c 'class=\"mark\"' src/public/board.html — returns 0."
      - "grep -n 'id=\"board-title\"\\|class=\"brand-divider\"\\|class=\"wordmark\"' src/public/board.html — returns one line each."
      - "grep -n 'id=\"tagline\"' src/public/board.html — returns 0."
      - "grep -n '<title>' src/public/board.html — still reads Praxis Board, unchanged."
    checklist:
      - "Is <span class=\"mark\">P</span> gone from this file?"
      - "Does .brand-row read wordmark, then divider, then <h1>, in that order?"
      - "Does the <img> carry alt=\"FlowCharge\" plus width=\"770\" and height=\"124\"?"
      - "Is the divider aria-hidden=\"true\" and empty of text?"
      - "Does the tagline read the constant Workstream state, with no id?"
      - "Is <title>Praxis Board</title> unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.2 Apply the masthead CSS changes in `src/public/styles.css`
    ```yaml
    description: "Fix the flex alignment, style the wordmark and divider, and delete the .mark rule."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Work inside the /* ---------- Masthead ---------- */ block that opens at line 141."
      - "In the .masthead rule, change align-items: baseline to align-items: flex-start. This is load-bearing, not cosmetic: a flex container's baseline comes from its first flex item's first line box, and once the left column's first line box is a replaced element the right-hand item aligns to the image's bottom margin edge. align-items: center was considered and rejected, because it moves the board's four-line .meta block further from where it sits today than flex-start does; acceptance criterion 5 makes least movement the tiebreaker."
      - "In the .masthead .brand-row rule, change align-items: baseline to align-items: center. Keep display: flex and gap: 10px as they are."
      - "Add .masthead .wordmark with display: block, height: 62px, width: auto. 62px is the tested size from the user's own website, which ships this same wordmark at h-[62px] in Praxis-Website/components/navbar.tsx. The wordmark is therefore taller than the 30px Fraunces <h1> beside it, and that is intended. SUPERSEDED: this step previously said height: 34px, chosen to sit optically level with that <h1>. That rationale is overruled — the chrome styling looks bad at small sizes."
      - "Add .masthead .brand-divider with flex: none, width: 1px, height: 22px, background: var(--line-strong)."
      - "Delete the whole .masthead .mark rule at lines 160-172."
      - "Apply no CSS filter to the wordmark in any theme, and add no @media (prefers-color-scheme: …) block. var(--line-strong) is already redefined in all four theme blocks — :root, the @media (prefers-color-scheme: dark) block, :root[data-theme=\"dark\"] and :root[data-theme=\"light\"] — which is the discipline this stylesheet keeps."
    pattern: "src/public/styles.css, the Masthead block at lines 141-190."
    imports: "The existing custom property --line-strong, already declared at lines 17, 62, 96 and 109 — one declaration in each of the four theme blocks that open at lines 9, 53, 93 and 106."
    compatibility: "The CSS knows sizes only; it must not learn asset paths beyond what already exists. No new custom property is introduced in this task. .masthead h1 at line 151 keeps its 30px Fraunces styling and is unchanged."
    gotcha: "Deleting .masthead .mark must not disturb the adjacent .masthead .tagline rule that follows it. Nothing in TypeScript references .mark — a grep of src/public/ confirms class=\"mark\" appears only in the two HTML files and .mark in this one CSS rule, so deleting all three is complete."
    verify:
      - "npm run build — completes, and dist/public/styles.css carries the new rules."
      - "grep -c '\\.masthead \\.mark' src/public/styles.css — returns 0."
      - "grep -n 'align-items' src/public/styles.css | head — the .masthead rule reads flex-start and .brand-row reads center."
      - "grep -n 'brand-divider\\|\\.masthead \\.wordmark' src/public/styles.css — returns the two new rules."
      - "grep -c 'prefers-color-scheme' src/public/styles.css — unchanged from its pre-edit count."
    checklist:
      - "Is .masthead now align-items: flex-start?"
      - "Is .masthead .brand-row now align-items: center?"
      - "Does .masthead .wordmark set height: 62px with width: auto?"
      - "Does .masthead .brand-divider use var(--line-strong) at 1px by 22px?"
      - "Is the .masthead .mark rule deleted in full?"
      - "Was no CSS filter and no new @media block added?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.3 Point the board title assignment at the new heading in `src/public/app.ts`
    ```yaml
    description: "Move the project folder name from the tagline into the h1, keeping the same data and the same branch."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Replace the one expression that writes the tagline. It sits with the other byId(…).textContent assignments; byId is the local helper defined earlier in the same file. This is a one-expression edit, not a refactor."
      - "Preserve .split('/') verbatim, backslash behaviour and all. The plan records the Windows-path weakness as an out-of-scope observation that this change neither introduces nor fixes."
      - |
        src/public/app.ts
        <<<<<<< SEARCH
            byId('tagline').textContent = raw.source
              ? 'Workstream state · ' + raw.source.split('/').pop()
              : 'Workstream state';
        =======
            byId('board-title').textContent = raw.source
              ? raw.source.split('/').pop()!
              : 'Board';
        >>>>>>> REPLACE
    pattern: "src/public/app.ts, the byId('tagline') assignment at lines 1213-1215."
    imports: "None. byId is already in scope in this file."
    compatibility: "app.ts must know the DOM id board-title and the shape of raw.source, and nothing else. It must not learn anything about the wordmark, the divider, or the assets — those stay pure markup and CSS. app.js is loaded only by board.html, so the new id carries no cross-page risk. Requires task 2.1 to have added id=\"board-title\" first."
    gotcha: "The non-null assertion after .pop() is required: .pop() is typed string | undefined and textContent takes string | null. Omitting it fails the src/public/tsconfig.json compile. #tagline loses its only consumer here, which is why task 2.1 drops the id."
    verify:
      - "npm run build — completes with no TypeScript error from src/public/tsconfig.json."
      - "grep -c \"byId('tagline')\" src/public/app.ts — returns 0."
      - "grep -n \"byId('board-title')\" src/public/app.ts — returns exactly one line."
      - "npm run electron:dev on a real project: the masthead reads wordmark, divider, project folder name, and the tagline reads Workstream state with no folder name appended."
      - "Open two boards on two different projects — the two <h1> values differ."
      - "Before data loads the heading reads Board, and there is no layout shift when it is replaced."
      - "THEME GATE, manual and blocking: with the board open at the real 62px render size, toggle the OS appearance between light and dark. On light, every letterform must stay individually legible on #F3F5F4 — measurement puts only 19% of the wordmark's body pixels above 4.5:1 on light, versus 77% on dark, with the readable signal carried by the thin near-black outline peaking at 19.18:1. If it fails, STOP and request a separate light export. Do NOT add a filter."
      - "The .meta block on the right has not jumped vertically relative to a pre-change screenshot."
    checklist:
      - "Does the assignment now target board-title instead of tagline?"
      - "Is the raw.source branch preserved, with Board as the fallback?"
      - "Was .split('/') carried over verbatim?"
      - "Does npm run build type-check cleanly?"
      - "Did the light-theme visual gate pass at 62px, with no CSS filter added?"
      - "Does the .meta block sit where it did before the alignment change?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 3 — Home masthead and heading demotion

  ```yaml
  description: "Bring the home screen to the new treatment and make both masthead wrappers a landmark. Depends on Phase 2, which owns the shared CSS."
  ```

  - [x] 3.1 Rewrite the home masthead and promote the section heading in `src/public/index.html`
    ```yaml
    description: "Wordmark only, no divider, no h1 in the masthead; Your projects becomes the page's single h1."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/index.html, anchor on the <div class=\"masthead\"> block that opens at line 11."
      - "Change that wrapper from <div class=\"masthead\"> to <header class=\"masthead\">, and its matching closing tag to </header>, so the region is announced as a landmark now that the visible heading has left it."
      - "Delete <span class=\"mark\">P</span> and delete <h1>Praxis Projects</h1> entirely."
      - "Inside .brand-row put the wordmark <img> alone: class=\"wordmark\", src=\"img/flowcharge-wordmark.png\", alt=\"FlowCharge\", width=\"770\", height=\"124\". Add NO divider on this screen."
      - "Leave <div class=\"tagline\">Registered projects</div> and the Manage integrations button exactly as they are."
      - "Promote the first section heading: change <h2 class=\"home-heading\">Your projects</h2> to <h1 class=\"home-heading\">Your projects</h1>. Keep the class, so its 18px Fraunces styling is unchanged."
      - "Leave the second <h2 class=\"home-heading\">Add a project</h2> as an <h2>."
      - "Leave <title>Praxis Projects</title> untouched — the plan puts it explicitly out of scope."
    pattern: "src/public/index.html, the masthead block at lines 11-20 and the section heading at line 33."
    imports: "The asset src/public/img/flowcharge-wordmark.png from task 1.1, and the .masthead / .brand-row / .wordmark CSS from task 2.2."
    compatibility: ".home-heading is a class selector, not element-scoped, so the 18px Fraunces rule survives the h2-to-h1 promotion untouched. The .home-heading + * sibling rule is also selector-based and unaffected. .masthead h1 is scoped inside .masthead, so it does not reach the promoted heading. No TypeScript file queries .masthead or the removed elements — a grep of src/public/ confirms it."
    gotcha: "At commit 486f375 the Your projects heading is at line 33 and <footer class=\"note\"> is at line 45 — the plan's earlier citations of 32 and 44 were off by one and have been corrected there. Anchor on the markup, not the line number — see Divergence 1. Also: after this task the page must have exactly one <h1>, so the masthead h1 deletion and the section promotion must land together, in this one edit."
    verify:
      - "npm run build — completes, and dist/public/index.html carries the new markup."
      - "grep -c 'class=\"mark\"' src/public/index.html — returns 0."
      - "grep -c '<h1>Praxis Projects</h1>' src/public/index.html — returns 0."
      - "grep -c '<h1' src/public/index.html — returns exactly 1, and it is the home-heading line."
      - "grep -n '<header class=\"masthead\">' src/public/index.html — returns one line, with a matching </header>."
      - "grep -n '<title>' src/public/index.html — still reads Praxis Projects, unchanged. NOTE: because of this, the plan's own broader grep for the string Praxis Projects can never return zero; see Divergence 2."
      - "npm start and open the home screen: the wordmark shows with no P badge, and the Manage integrations button sits at the top of the masthead row rather than dropping to the wordmark's bottom edge."
      - "In devtools, Your projects still renders at 18px Fraunces, exactly as it did as an <h2>."
    checklist:
      - "Is the masthead wrapper now a <header> with a matching closing tag?"
      - "Are both the P badge and the <h1>Praxis Projects</h1> gone?"
      - "Does the masthead show the wordmark only, with no divider on this screen?"
      - "Does the page now contain exactly one <h1>, and does Add a project remain an <h2>?"
      - "Does Your projects keep class=\"home-heading\" and its 18px Fraunces size?"
      - "Does the Manage integrations button stay at the top of the row?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.2 Make the board masthead wrapper a `<header>` in `src/public/board.html`
    ```yaml
    description: "Symmetry with the home screen: the board masthead becomes a landmark element too."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/board.html, change the masthead wrapper from <div class=\"masthead\"> to <header class=\"masthead\">, and change its matching closing tag to </header>."
      - "Change nothing else in this file. The masthead's inner content was already settled by task 2.1."
    pattern: "src/public/board.html, the masthead wrapper opening at line 11 and its closing tag at line 26."
    imports: "None."
    compatibility: ".masthead is a class selector in styles.css, so every masthead rule applies unchanged to a <header>. No TypeScript file queries the masthead element — a grep of src/public/ confirms it."
    gotcha: "The masthead block contains nested <div> elements, and the LAST closing tag in the block is the wrapper's own: at commit 486f375 line 25 closes <div class=\"meta\"> and line 26 closes the masthead. Retag only the outermost wrapper; retagging an inner <div> by mistake would leave unbalanced markup that the build will not catch, because nothing validates the HTML."
    verify:
      - "npm run build — completes."
      - "grep -c '<header class=\"masthead\">' src/public/board.html — returns 1."
      - "grep -c '<div class=\"masthead\">' src/public/board.html — returns 0."
      - "npm start and open a board: the layout is visually identical to before this task, and devtools shows a banner landmark for the masthead."
    checklist:
      - "Is the wrapper now <header class=\"masthead\"> with a matching </header>?"
      - "Are the nested <div> elements inside the masthead untouched?"
      - "Is the rendered board layout unchanged?"
      - "Does npm run build still pass?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 4. Phase 4 — Footer lockup on both screens

  ```yaml
  description: "Add the combo lockup above the existing footer prose on both pages. Depends on Phase 1."
  ```

  - [x] 4.1 Insert the footer lockup in `src/public/index.html`
    ```yaml
    description: "Add the decorative lockup image as the first child of the home page footer."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/index.html, anchor on <footer class=\"note\"> at line 45."
      - "Insert this element as its FIRST child, before the existing prose: <img class=\"footer-lockup\" src=\"img/flowcharge-lockup.png\" alt=\"\" aria-hidden=\"true\" width=\"628\" height=\"80\">"
      - "The empty alt plus aria-hidden is deliberate — the lockup repeats the masthead brand and must not be announced a second time."
      - "Change no other line in the footer."
    pattern: "src/public/index.html, the <footer class=\"note\"> block at line 45."
    imports: "The asset src/public/img/flowcharge-lockup.png from task 1.2, referenced as img/flowcharge-lockup.png."
    compatibility: "The width and height attributes are the intrinsic raster size and reserve layout space before load; the CSS from task 4.3 overrides both to a 40px CSS height."
    gotcha: "At commit 486f375 <footer class=\"note\"> is at line 45; the plan's earlier citation of 44 was off by one and has been corrected there. Anchor on the markup — see Divergence 1. Accessibility criterion 19 fails if alt is given any text, so leave it as the empty string."
    verify:
      - "npm run build — completes."
      - "grep -n 'footer-lockup' src/public/index.html — returns one line, and it sits immediately after the <footer class=\"note\"> line."
      - "grep -n 'footer-lockup' src/public/index.html | grep -c 'alt=\"\" aria-hidden=\"true\"' — returns 1."
    checklist:
      - "Is the <img> the first child of <footer class=\"note\">?"
      - "Does it carry alt=\"\" and aria-hidden=\"true\"?"
      - "Does it carry width=\"628\" and height=\"80\"?"
      - "Is the existing footer prose otherwise unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.2 Insert the footer lockup in `src/public/board.html`
    ```yaml
    description: "Add the same decorative lockup image as the first child of the board page footer."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/board.html, anchor on <footer class=\"note\"> at line 89."
      - "Insert this element as its FIRST child, before the existing prose: <img class=\"footer-lockup\" src=\"img/flowcharge-lockup.png\" alt=\"\" aria-hidden=\"true\" width=\"628\" height=\"80\">"
      - "Use the identical markup to task 4.1, so the two footers stay in step."
      - "Change no other line in the footer, and leave the hidden #app-version div where it is."
    pattern: "src/public/board.html, the <footer class=\"note\"> block at line 89."
    imports: "The asset src/public/img/flowcharge-lockup.png from task 1.2."
    compatibility: "Same intrinsic-size attributes as task 4.1, overridden by the CSS from task 4.3."
    gotcha: "board.html has other <footer>-adjacent structure below it, including the card detail <dialog>. Insert inside <footer class=\"note\"> only. The empty alt is required — an alt with text would announce the brand twice on this page."
    verify:
      - "npm run build — completes."
      - "grep -n 'footer-lockup' src/public/board.html — returns one line, immediately after the <footer class=\"note\"> line."
      - "grep -n 'footer-lockup' src/public/board.html | grep -c 'alt=\"\" aria-hidden=\"true\"' — returns 1."
    checklist:
      - "Is the <img> the first child of <footer class=\"note\">?"
      - "Does it carry alt=\"\" and aria-hidden=\"true\"?"
      - "Is its markup identical to the one added in task 4.1?"
      - "Is the hidden #app-version div still present and unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.3 Add the footer lockup rule to `src/public/styles.css`
    ```yaml
    description: "Size and mute the footer lockup on both screens."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Append a footer.note .footer-lockup rule to the footer.note block that runs from line 481, after the existing footer.note code rule."
      - "The rule sets display: block, height: 40px, width: auto, opacity: 0.75, margin-bottom: 10px."
      - "Add no @media (prefers-color-scheme: …) block. One opacity value serves both themes as the starting point."
      - "If the visual check below shows dark needs its own value, do NOT add a media query. The codebase-consistent mechanism is a --lockup-opacity custom property declared in all four theme blocks in this file, which open at lines 9, 53, 93 and 106. Treat that as a follow-up decision to raise, not something to introduce pre-emptively."
    pattern: "src/public/styles.css, the footer.note rules starting at line 481, after the footer.note code rule."
    imports: "None. No new custom property unless the visual check forces the A5 fallback."
    compatibility: "The CSS knows sizes and opacity; it must not learn asset paths or build behaviour. This rule is scoped under footer.note so it cannot reach the masthead wordmark."
    gotcha: "At 0.75 opacity the lockup sits below the wordmark's already-weak light-theme contrast — 18.4% of its body pixels reach 4.5:1 against #F3F5F4, versus 77.9% against #10141A. This is the second place a separate export could turn out to be needed. Never reach for a CSS filter as the remedy."
    verify:
      - "npm run build — completes, and dist/public/styles.css carries the new rule."
      - "grep -n 'footer-lockup' src/public/styles.css — returns the new rule inside the footer.note block."
      - "grep -c 'prefers-color-scheme' src/public/styles.css — unchanged from its pre-edit count."
      - "npm start: both footers open with a small muted lockup above the prose, rendered at a 40px CSS height."
      - "Manual: check the lockup in both light and dark themes at 0.75 opacity. If the two themes want different opacities, stop and raise the A5 custom-property option rather than adding a media query or a filter."
    checklist:
      - "Does footer.note .footer-lockup set height: 40px with width: auto?"
      - "Is the opacity 0.75, with margin-bottom: 10px?"
      - "Was no @media (prefers-color-scheme) block added?"
      - "Was no CSS filter applied to the lockup?"
      - "Do both footers render the lockup above their prose in both themes?"
    self_eval:
      passed: true
      failures: []
    ```

## Untasked stages

**Phase 5 — Favicon and desktop app icon — BLOCKED, no task authored.** The phase depends
on redrawn small-size icon artwork (512, 180, 64, 32 and 16px, plus an SVG if available)
that does not exist. Each size must be drawn for its size, not mechanically downscaled
from the 512px file — the plan's decision 5 requires it, and the measurement backs it up:
the standalone arrow mark reaches 4.5:1 on only 10.9% of its body pixels against the light
paper. Nothing in this repository, and nothing in
`/Users/akoukoullis/Work/AK/Praxis-Website/public/`, is that redrawn art; that folder holds
only three 1000px+ source PNGs and eight old screenshots. The phase must not be attempted
with a placeholder or a resized `flowcharge-logo.png`. Phases 1 to 4 run now without
waiting on it. The plan itself marks this phase BLOCKED.

**Open question 3 — how `build/icon.ico` gets assembled — unresolved, no task authored.**
macOS ships `iconutil` for `.icns` but has no `.ico` tool, and this repository has no image
dependency. The plan's options are (a) let electron-builder downscale `build/icon.png`,
(b) add `png-to-ico` or `png2icons` to `devDependencies`, or (c) generate the `.ico`
offline and commit the binary. This is the user's call. It is downstream of Phase 5's own
block in any case, because no artwork exists to assemble an icon from.

**Deliberate exclusions carried into every task above.** The `<title>` elements on both
pages stay untouched, together with `package.json`'s `productName` and `appId`, the
`README.md` prose, every internal `praxis` identifier, any `icon` option on
`new BrowserWindow(...)`, and any change to `src/server.ts` beyond the one MIME entry.

## Divergences

1. **Line-number drift in the plan's `index.html` and `board.html` citations — since
   corrected in the plan.** The plan originally cited `src/public/index.html:32` for
   `<h2 class="home-heading">Your projects</h2>`, `src/public/index.html:44` for
   `<footer class="note">`, and `src/public/board.html:11-24` for the masthead block. At
   commit `486f375` those elements sit at `src/public/index.html:33`,
   `src/public/index.html:45`, and `src/public/board.html:11-26` respectively — the
   `board.html` masthead runs one line past line 25, which closes the inner
   `<div class="meta">`, to line 26, which closes the wrapper. Those three citations have
   been corrected in `PLN-59-pbg3pk-plan.md`. The markup itself matches the plan byte for
   byte in every case, and `src/public/board.html:89` and `src/public/styles.css:141-190`
   matched the plan's line references exactly from the start. Consequence: no task was
   dropped. Every affected task anchors on the markup rather than on the line number, and
   each one carries a `gotcha` pointing here.

2. **Phase 3's originally stated grep check could not return zero, because the `<title>`
   it would match is out of scope — since corrected in the plan.** The plan's
   testing-strategy table originally gave Phase 3 the mechanical check
   `grep -rn 'class="mark"\|Praxis Projects' src/public/` returning nothing. But the plan
   also puts the `<title>` elements explicitly out of scope, and
   `src/public/index.html:6` reads `<title>Praxis Projects</title>` at commit `486f375`.
   That line still matches after the phase lands, so the check as first written could only
   ever fail. Consequence: task 3.1 carries the narrowed, satisfiable checks —
   `grep -c 'class="mark"' src/public/index.html` returning 0,
   `grep -c '<h1>Praxis Projects</h1>' src/public/index.html` returning 0, and
   `grep -c '<h1' src/public/index.html` returning exactly 1 — plus an explicit check that
   line 6 is unchanged. The plan's own table now carries the same narrowed commands. The
   acceptance criteria behind the check (criteria 1, 7 and 9) are fully covered; only the
   command form changed.

3. **Further stale citations in the plan, all corrected there, none of which changed any
   task.** `tools/copy-assets.mjs`'s copy list is at line **16**, not 17, and holds **four**
   filenames, not five. `sweepJavaScript` in `tools/bundle-public.mjs` spans lines **41-54**,
   not 50 or 50-64. `passesOriginCheck` is defined at `src/server.ts:112` and called at
   `:422`, not at `:421`; the path-traversal guard runs `:426-434`, not `:426-432`; the CSP
   constant is `:30-33` with `img-src 'self'` on `:32`. The `.home-heading` rule is
   `styles.css:530-535` (536 is the separate `.home-heading + *` rule); the `footer.note`
   rules run `:481-492`; the four theme blocks open at `:9`, `:53`, `:93` and `:106`, not
   `:52`, `:92` and `:105`. The `byId(…).textContent` run in `app.ts` is `1212-1217`, not
   `1212-1218`. The home masthead's badge and heading are `index.html:14-15`, not `14-16`.
   `Praxis-Website/public/` holds **eight** old screenshots, not seven. The task list's own
   line references were already correct in every one of these cases.

4. **The delivered PNGs are indexed-colour, not RGBA.** Both
   `src/public/img/flowcharge-wordmark.png` and `src/public/img/flowcharge-lockup.png` are
   8-bit colour-type-3 PNGs whose transparency comes from a `tRNS` chunk. `sips -g hasAlpha`
   reports `yes`, but `file` prints `8-bit colormap` and never `RGBA`. Tasks 1.1 and 1.2
   originally asserted "RGBA, not RGB", which would have failed against the correct
   delivered files; both now assert transparency instead of the encoding. The plan's
   Contract 1 records the same fact.

Every other file the plan cites — `src/server.ts`, `tools/copy-assets.mjs`,
`tools/bundle-public.mjs`, `src/public/app.ts`, `src/public/styles.css` and
`src/public/board.html` — matched the plan's substantive assumptions at commit `486f375`,
including the exact text of the three SEARCH blocks above, which were re-checked character
by character against the working tree. Only the line numbers listed in Divergences 1 and 3
were off.

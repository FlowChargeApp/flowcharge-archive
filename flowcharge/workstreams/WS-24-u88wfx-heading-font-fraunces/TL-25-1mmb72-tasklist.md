---
id: TL-25-1mmb72
type: tasklist
workstream: WS-24-u88wfx
slug: heading-font-fraunces
title: "Self-host Fraunces as the heading font, carried by the build and served locally"
status: done
created: 2026-08-09
updated: 2026-08-09
depends_on: [PLN-20-vxawxm]
links: []
mode: spec
base_commit: bfcc7c5
---

# PRX Tasks

## Self-hosted Fraunces heading font

Implements PLN-20. Replaces the system-serif `--font-display` stack (`src/public/styles.css:33`)
with the free Google Font Fraunces, self-hosted as one vendored `woff2` under
`src/public/fonts/`. The build carries the file into `dist/public/` through the existing
explicit manifest in `tools/copy-assets.mjs`, and `src/server.ts` gains one `.woff2` entry in
its `MIME` map. One `@font-face` with `font-weight: 600 700` and `font-display: swap` is
declared at the top of `styles.css`, and `--font-display` keeps its whole current stack as the
fallback tail.

The change is purely visual. No page markup, no client TypeScript, no other CSS variable, and
no other font (`--font-body`, `--font-mono`) is touched. No `Cache-Control` header, no
Content-Security-Policy, and no `SOFT`/`WONK` optical axes are added.

This file mirrors the plan's three phases: one top-level task per phase, in the plan's order,
with one child per touched file in Phase 1. Phase 1 delivers the build and serving pipeline
first, because it is the only part that can fail silently. Phase 2 is a single-file change and
Phase 3 touches no files, so both stay parent-level adult tasks.

Two of the plan's items are deliberately untasked because they await the user's decision:
`src/public/fonts/OFL.txt` (assumption 3 / Open question 4) and the `latin-ext` second
subset (Open question 1). `size-adjust` (Open question 2) and the `.masthead h1`
`letter-spacing` (Open question 3) are likewise not tasked — the plan's recommendation for
both is to leave them alone.

- [x] 1. Phase 1 — Vendor the asset and make the pipeline carry it

  ```yaml
  description: "Vendor the Fraunces latin woff2 under src/public/fonts/, extend the copy-assets manifest to carry it into dist/public/ through a nested path, and add the .woff2 MIME entry to the server. Changes nothing visible; independently shippable."
  ```

  - [x] 1.1 Acquire `src/public/fonts/fraunces-latin.woff2`

    ```yaml
    description: "Download the latin-subset Fraunces variable woff2 from Google's own CSS endpoint and commit it as a new vendored binary asset at src/public/fonts/fraunces-latin.woff2."
    issues: []
    implement:
      - "This is a one-time manual acquisition step, not a build step. Nothing in the build chain reaches the network, before or after this change. There is no prior file content to edit against."
      - "Create the new directory src/public/fonts/."
      - "Request Google's CSS for the wanted axes only: https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600..700&display=swap — requesting only opsz and wght leaves SOFT and WONK at their defaults of 0, which is plain Fraunces, and avoids the larger full-axis download."
      - "From the returned CSS, take the URL inside the block commented /* latin */ — not latin-ext, not any other subset — and download that woff2."
      - "Save it as src/public/fonts/fraunces-latin.woff2. The file name is a convention choice, not load-bearing: only the @font-face src and the copy manifest refer to it."
      - "Commit the binary. dist/ is gitignored, so src/public/ must be the source of truth. Roughly 67KB of binary enters git history permanently (plan assumption 1)."
      - "Do NOT download latin-ext, and do NOT download the full all-axis variable font. Both are explicitly rejected by the plan."
    pattern: "src/public/fonts/fraunces-latin.woff2 (new file, binary)"
    imports: "Network access for this one manual download. No package, module, or build-time dependency is added."
    compatibility: "Must be a variable woff2 covering weights 600-700 in one file, so the @font-face range descriptor in Phase 2 resolves both weights without the browser synthesising bold. Google returns the same woff2 regardless of how the weight sub-range is narrowed; only the font-weight descriptor in its CSS differs, so there is no byte saving from narrowing further."
    gotcha: "Requesting the URL without a modern browser User-Agent returns a ttf/older-format URL instead of woff2 — confirm the downloaded file's magic bytes are wOF2. Saving the CSS instead of the font it points at is the other easy mistake. Taking the latin-ext block's URL by accident produces a file that is missing the plain latin glyph coverage this change relies on."
    verify:
      - "test -f src/public/fonts/fraunces-latin.woff2 && ls -l src/public/fonts/fraunces-latin.woff2 — the file exists and is roughly 67KB."
      - "head -c 4 src/public/fonts/fraunces-latin.woff2 — prints wOF2, confirming a real woff2 container rather than saved CSS, a ttf, or an HTML error page."
      - "git status --porcelain src/public/fonts/ — shows the new file as untracked or staged, confirming dist/ was not used as the source of truth."
    checklist:
      - "src/public/fonts/fraunces-latin.woff2 exists and its first four bytes are wOF2."
      - "The file came from the latin block of the CSS response, not latin-ext and not the full all-axis font."
      - "The requested axes were opsz and wght only, leaving SOFT and WONK at 0."
      - "The file sits under src/public/, not under dist/, and is added to git."
      - "No second font file, no CSS file, and no other asset was added alongside it."
    self_eval:
      passed: true
      failures: []
      notes:
        - "Scope amendment directed by the user before execution: src/public/fonts/OFL.txt was added alongside the woff2, holding the SIL Open Font License 1.1 text with the Fraunces copyright line. It is the licence for the redistributed binary. No page references it and the copy manifest does not carry it into dist/. The final checklist item is read as satisfied on its intent: no second font file and no CSS file were added."
        - "Source used: the latin block of https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600..700&display=swap (Fraunces v38), requested with a desktop browser User-Agent."
    ```

  - [x] 1.2 `tools/copy-assets.mjs` — carry the font through a nested destination path

    ```yaml
    description: "Add the per-file mkdirSync so a nested destination path works, and add fonts/fraunces-latin.woff2 to the existing explicit copy manifest."
    issues: []
    implement:
      - "File: tools/copy-assets.mjs. Anchor: the `for (const name of [...])` loop at lines 15-18. It calls fs.copyFileSync with no directory creation beyond the top-level mkdirSync at line 12, so a nested destination path currently fails. Add the one missing capability and the one manifest entry, keeping the explicit-manifest convention."
      - "Do NOT convert the manifest to a recursive copy of src/public/ and do NOT use fs.cpSync — both are explicitly rejected by the plan. A recursive copy would silently start carrying app.ts, home.ts, and tsconfig.json, which are deliberately excluded today, and fs.cpSync was still experimental on Node 18, the declared engine floor."
      - |
        <<<<<<< SEARCH
        for (const name of ['index.html', 'board.html', 'styles.css']) {
          fs.copyFileSync(path.join(srcPublic, name), path.join(distPublic, name));
          console.log(`copied ${name}`);
        }
        =======
        for (const name of ['index.html', 'board.html', 'styles.css', 'fonts/fraunces-latin.woff2']) {
          const dest = path.join(distPublic, name);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(path.join(srcPublic, name), dest);
          console.log(`copied ${name}`);
        }
        >>>>>>> REPLACE
    pattern: "tools/copy-assets.mjs"
    imports: "None. fs and path are already imported at the top of the file."
    compatibility: "Plain ESM on purpose — this script runs before any compiled output exists, so it must stay dependency-free and Node-18-safe. mkdirSync with { recursive: true } is stable on every supported Node. The forward slash in the manifest entry is normalised by path.join on every platform."
    gotcha: "The manifest entry must stay a relative path with a forward slash ('fonts/fraunces-latin.woff2'), because the same string is used for both the source join and the destination join, and it is what the build log prints. This task requires task 1.1 to have landed — copyFileSync throws ENOENT if the source font is missing."
    verify:
      - "npm run build — succeeds and prints `copied fonts/fraunces-latin.woff2` (this script runs last in the build chain, after both tsc passes)."
      - "cmp src/public/fonts/fraunces-latin.woff2 dist/public/fonts/fraunces-latin.woff2 — exits 0, confirming dist/public/fonts/fraunces-latin.woff2 exists and matches the source file byte for byte."
      - "grep -c 'cpSync' tools/copy-assets.mjs — returns 0, confirming the rejected recursive-copy approach was not used."
    checklist:
      - "npm run build prints `copied fonts/fraunces-latin.woff2` and exits 0."
      - "dist/public/fonts/fraunces-latin.woff2 exists and is byte-identical to the source."
      - "The manifest is still an explicit array of four names — app.ts, home.ts, and tsconfig.json are still not copied."
      - "fs.cpSync is not used, and the copy is still fs.copyFileSync plus fs.mkdirSync."
      - "The script still has zero package dependencies and still runs as plain ESM."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 `src/server.ts` — map `.woff2` to `font/woff2`

    ```yaml
    description: "Add one '.woff2': 'font/woff2' entry to the MIME map so the font is served with the correct Content-Type instead of the application/octet-stream fallback."
    issues: []
    implement:
      - "File: src/server.ts. Anchor: the MIME record at lines 15-22. The static handler at lines 319-320 looks the extension up in this map and falls back to application/octet-stream, so the font would otherwise be served as an opaque binary."
      - "Add exactly one entry. Do NOT add Cache-Control headers and do NOT add a Content-Security-Policy — the server sets neither today, and the plan puts both out of scope."
      - "Do NOT touch the path-traversal guard at line 297 (`filePath.startsWith(root)`). path.join(root, '/fonts/x.woff2') stays inside root, so a subdirectory under dist/public/ is already served correctly."
      - |
        <<<<<<< SEARCH
          '.ico': 'image/x-icon',
        };
        =======
          '.ico': 'image/x-icon',
          '.woff2': 'font/woff2',
        };
        >>>>>>> REPLACE
    pattern: "src/server.ts"
    imports: "None."
    compatibility: "MIME is typed Record<string, string>, so the new entry needs no type change. Browsers ignore the Content-Type when loading a font through @font-face, so this is correctness rather than a functional requirement — but it is additive and has no consumer that could break."
    gotcha: "This is the only .ts file the plan permits changing, and the MIME map is the only region of it that may change. Serving the font is verified against the built dist/server.js, so npm run build must run before npm start (prestart already does this)."
    verify:
      - "npm run build — succeeds; this is also the project's type-check, since the build script runs tsc against both tsconfig.json and src/public/tsconfig.json before copying assets."
      - "npm start in one shell, then: curl -sI http://localhost:4173/fonts/fraunces-latin.woff2 — returns HTTP/1.1 200 and Content-Type: font/woff2, not application/octet-stream."
      - "git diff --name-only -- 'src/**/*.ts' — lists src/server.ts and nothing else, confirming no other TypeScript file was touched."
      - "Open the home page and a board — both render exactly as before, because nothing references the font yet."
    checklist:
      - "The MIME map contains '.woff2': 'font/woff2' and the other six entries are unchanged."
      - "curl -sI on the font path returns 200 with Content-Type: font/woff2."
      - "No Cache-Control header and no Content-Security-Policy was added."
      - "The path-traversal guard and every other part of src/server.ts are unchanged."
      - "No .ts file other than src/server.ts was modified."
    self_eval:
      passed: true
      failures: []
      notes:
        - "Port 4173 was already held by a server process outside this session, running pre-change code. It was left untouched. The curl check ran against the same built dist/server.js on port 4199 instead, and returned HTTP 200 with Content-Type: font/woff2."
    ```

- [x] 2. Phase 2 — Declare the face and switch `--font-display`

  ```yaml
  description: "In src/public/styles.css only: add the @font-face block at the top of the file, prepend \"Fraunces\" to --font-display keeping the whole existing tail, and add font-optical-sizing: auto to the body rule. Depends on Phase 1 — the file must be reachable, or every heading silently stays on Georgia and the phase cannot be verified."
  issues: []
  implement:
    - "File: src/public/styles.css. Anchor 1: the very top of the file, above the first `:root {` at line 1. Add one @font-face block there, so it is not buried inside a themed block. The src URL is relative to the stylesheet, which is served from dist/public/styles.css, so it resolves to /fonts/fraunces-latin.woff2."
    - |
      /* Illustrative, not literal — the plan's exact declared face: */
      @font-face {
        font-family: "Fraunces";
        src: url("fonts/fraunces-latin.woff2") format("woff2");
        font-weight: 600 700;
        font-style: normal;
        font-display: swap;
      }
    - "font-weight: 600 700 is a range descriptor, correct for a variable font: it tells the browser this one file covers both weights, so the browser never synthesises bold. font-display: swap is chosen over optional, which can skip the webfont entirely on a slow first load."
    - "Anchor 2: the --font-display declaration at line 33, inside the first :root. Prepend \"Fraunces\", keeping the whole existing tail intact so a missing or unbuilt font still yields readable headings: `--font-display: \"Fraunces\", ui-serif, Georgia, \"Iowan Old Style\", \"Times New Roman\", serif;`"
    - "Anchor 3: the body rule at lines 104-111. Add one declaration, font-optical-sizing: auto;. It is the browser default and changes nothing functionally; it is written down because Fraunces carries opsz 9..144 and the display headings span 11.5px to 30px, so the declaration records that the automatic behaviour is intended."
    - "Do NOT touch --font-body (line 34) or --font-mono (line 35). Do NOT touch the three theme override blocks (lines 41-76, 77-88, 89-100) — they redefine colours only and must never define --font-display."
    - "Hard constraint: do NOT add font-variation-settings: \"wght\" … at any of the 13 call sites. That would disable automatic optical sizing and duplicate what font-weight already does. Every one of the 13 selectors keeps its existing numeric font-weight untouched."
    - "Do NOT add size-adjust (Open question 2) and do NOT change .masthead h1's letter-spacing at line 132 (Open question 3). Both are the user's call after Phase 3."
  pattern: "src/public/styles.css — the only file this phase touches."
  imports: "None. The only new external reference is the relative font URL, resolved same-origin."
  compatibility: "The @font-face and the font-weight range descriptor are supported by every browser that already runs this dashboard's ES-module client code, so this adds no new browser floor. Rollback is reverting this one file: every heading returns to the current serif stack immediately, with the font file and MIME entry left harmlessly in place."
  gotcha: "The src URL is relative to the stylesheet, so it must be fonts/fraunces-latin.woff2 with no leading slash and no src/public/ prefix — the stylesheet is served from dist/public/. Placing the @font-face inside :root or inside a @media block is the other easy mistake; it must sit above the first :root. A dist/ that predates Phase 1 has no font file, so the request 404s and headings render from the fallback tail — degraded, never broken; npm start always builds first via prestart, so this is hard to reach."
  verify:
    - "npm run build && npm start, then open the home page: the browser network panel shows fraunces-latin.woff2 fetched once with status 200."
    - "In DevTools, the Computed panel for .masthead h1 lists Fraunces as the rendered font, and the Fonts pane reports it as a network resource, not a synthesised fallback."
    - "Compare .masthead .mark at weight 700 against .masthead h1 at weight 600 — visibly different weights, confirming the variable range resolves from one file."
    - "grep -c 'font-variation-settings' src/public/styles.css — must return 0 (the plan's hard constraint)."
    - "grep -c -- '--font-display:' src/public/styles.css — must return 1, confirming the variable is declared once and no theme block redefines it."
    - "grep -n -- '--font-body\\|--font-mono' src/public/styles.css and git diff src/public/styles.css — confirm neither variable changed and body/monospace text is visually unchanged."
    - "Temporarily rename dist/public/fonts/, reload, and confirm headings fall back to the serif stack with the page fully readable. Restore the directory afterwards."
  checklist:
    - "One @font-face for \"Fraunces\" sits above the first :root, with font-weight: 600 700, font-style: normal, and font-display: swap."
    - "--font-display reads \"Fraunces\" followed by the complete unchanged tail: ui-serif, Georgia, \"Iowan Old Style\", \"Times New Roman\", serif."
    - "font-optical-sizing: auto is present on the body rule and nowhere else."
    - "grep for font-variation-settings returns zero matches, and all 13 call sites keep their existing numeric font-weight."
    - "--font-body and --font-mono are byte-identical to before, and no theme override block mentions --font-display."
    - "With the font directory renamed, every heading still renders readably in the serif fallback."
    - "src/public/styles.css is the only file this task changed."
  self_eval:
    passed: true
    failures: []
    notes:
      - "All three anchors were found in their described form and edited as specified: the @font-face sits above the first :root, --font-display gained the \"Fraunces\" prefix with its whole tail intact, and font-optical-sizing: auto was added to the body rule."
      - "Verified live against the built output. Port 4173 was still held by an unrelated server process outside this session, so the check ran on port 4199 with PORT=4199 node dist/server.js. The font served with HTTP 200 and Content-Type: font/woff2."
      - "document.fonts reported one loaded face, family Fraunces, weight range 600 700. Both document.fonts.check('600 20px Fraunces') and the 700 form returned true, and the resource entry showed one 67388-byte fetch, so both weights resolve from the single file with no synthesised bold."
      - "Fallback check: dist/public/fonts was renamed temporarily, the page reloaded, the font request returned 404, and the masthead heading rendered readably in the serif tail. The directory was restored and confirmed byte-identical to the source."
      - "grep counts on src/public/styles.css: font-variation-settings 0, --font-display 1, font-optical-sizing 1. git diff shows only the three intended hunks in that file; --font-body and --font-mono are untouched and no theme block declares --font-display."
      - "The other modified files in the working tree (src/server.ts, tools/copy-assets.mjs, src/public/fonts/) come from Phase 1 and were not touched by this task."
  ```

- [x] 3. Phase 3 — Visual sweep of all 13 `--font-display` call sites

  ```yaml
  description: "Walk every --font-display site in light and dark themes and at a narrow window width, confirming nothing clips, overflows, or wraps badly now that glyphs are wider than Georgia at the same size. Record anything that looks wrong rather than fixing it. Depends on Phase 2."
  issues: []
  implement:
    - "This task expects to touch no files. Any fix is one of the plan's Open questions and needs the user's call first — do not adjust sizes, spacing, letter-spacing, or size-adjust ad hoc."
    - "Run npm run build && npm start, then open the home page and a board."
    - "Check all 13 sites, with their line numbers in src/public/styles.css: .masthead h1 (128), .masthead .mark (144), .kpi .kpi-value (192), .panel h2 (375), .load-state h2 (434), .home-heading (465), .tile-name (567), .tiles-empty h3 (594), .ws-modal-title (676), .ws-section-title (768), .ws-plan h4 (894), .ws-plan h5 (901), .ws-plan h6 (908)."
    - "Give extra attention to the constrained ones: .masthead h1 uses text-wrap: balance and sits in a flex row that wraps; .kpi .kpi-value at 30px sits in a fixed KPI tile; .tile-name sits in a tile grid; .ws-modal-title uses overflow-wrap: anywhere inside the modal header; .ws-plan h6 at 11.5px is the smallest display text in the app and is where optical sizing matters most."
    - "Repeat the pass in light theme and in dark theme, and at a narrow window width where the masthead and the tile grid reflow."
    - "Confirm the weights render correctly: 600 everywhere except .masthead .mark at 700, and the browser-default bold on .load-state h2. No heading may fall back to a synthesised (faux-bold) weight."
    - "Confirm body text and monospace text are visually unchanged."
    - "Write down any heading that clips, overlaps, or overflows, with its selector and the theme and width it happened at. Report it; do not fix it."
  pattern: "No files expected to change. Observation only, against src/public/styles.css's 13 call sites."
  imports: "A running local build (npm run build && npm start) and a browser with DevTools."
  compatibility: "Fraunces is wider and heavier per glyph than Georgia at the same size, so headings grow somewhat. That growth is the intended visual change, not a defect — only clipping, overlap, or overflow counts as a finding."
  gotcha: "The plan's Open questions 1, 2, and 3 (latin-ext subset, size-adjust, .masthead h1 letter-spacing) are exactly the fixes this sweep might tempt you into. All three are the user's decision. An accented character in a workstream title or project name rendering in Georgia beside Fraunces neighbours is Open question 1, not a bug to fix here."
  verify:
    - "A completed pass over all 13 sites in both light and dark themes, at a normal and a narrow window width, with no clipped, overlapping, or overflowing heading."
    - "In DevTools, no heading reports a synthesised bold — .masthead .mark resolves at 700 and the rest at 600 from the same file."
    - "git status --porcelain — returns no modified file from this task, confirming the expected zero-file-change outcome."
  checklist:
    - "All 13 enumerated selectors were checked, in both light and dark themes."
    - "The constrained sites (.masthead h1, .kpi .kpi-value, .tile-name, .ws-modal-title, .ws-plan h6) were checked at a narrow width where the masthead and tile grid reflow."
    - "No heading clips, overlaps, or overflows; any that does is recorded with selector, theme, and width."
    - "No heading renders in a synthesised faux-bold weight."
    - "Body and monospace text are visually unchanged."
    - "No file was modified by this task."
  self_eval:
    passed: true
    failures: []
    notes:
      - "All 13 selectors in the task's list were first confirmed present in src/public/styles.css at their shifted line numbers (the @font-face block moved every line down by 8): .masthead h1 137, .masthead .mark 153, .kpi .kpi-value 201, .panel h2 384, .load-state h2 443, .home-heading 474, .tile-name 576, .tiles-empty h3 603, .ws-modal-title 685, .ws-section-title 777, .ws-plan h4 903, .ws-plan h5 910, .ws-plan h6 917. The set matches the task's enumeration exactly."
      - "Every one of the 13 was reached live and measured. The home page covered .masthead h1, .masthead .mark, .home-heading, .tile-name and .tiles-empty h3. The board covered .masthead h1, .masthead .mark, .kpi .kpi-value, .panel h2 and .load-state h2. The workstream modal covered .ws-modal-title, .ws-section-title and .ws-plan h4/h5/h6. The two empty states and the error load state were reached by injecting their exact markup from home.ts and app.ts into the live DOM; no file was edited to reach them."
      - "The plan tab of a workstream with h5 and h6 headings was found by inspection (LAD WS-181, whose plan uses ### and #### and so renders h5 and h6 through app.ts:437). All 'Show more' blocks were expanded first, giving 10 h4, 10 h5 and 5 h6 to measure."
      - "Both themes were swept at 1280px wide and at 420px wide, on both pages and inside the modal. Every display site rendered from Fraunces with zero horizontal overflow and zero vertical overflow, and no element crossed its parent's content edge."
      - "Findings: none. Nothing clipped, overlapped, or overflowed in either theme at either width."
      - "One measurement was checked and dismissed. .kpi .kpi-value has line-height: 1 at 30px, so its ink box stands 3-4px taller than its line box. An A/B against the original serif tail gave the same effect at 2px, so this predates Fraunces. overflow is visible, the box height does not change, and the flex gap absorbs it, so it is neither a clip nor an overlap."
      - "No synthesised bold. document.fonts reports exactly one loaded face, family Fraunces, weight range 600 700, from a single 67388-byte fetch, and document.fonts.check returns true at both 600 and 700. Every one of the 13 sites computes to 600, except .masthead .mark at 700 and .load-state h2 at the browser-default bold of 700 — all three values sit inside the declared range, so the browser resolves a real instance rather than emboldening one."
      - "Body and monospace text are unchanged. git diff on src/public/styles.css shows only the three intended hunks, and --font-body and --font-mono are byte-identical."
      - "Zero files changed. git status --porcelain after the sweep is identical to before it: the same five entries left by Phase 1 and Phase 2 (src/public/fonts/OFL.txt, src/public/fonts/fraunces-latin.woff2, src/public/styles.css, src/server.ts, tools/copy-assets.mjs)."
  ```

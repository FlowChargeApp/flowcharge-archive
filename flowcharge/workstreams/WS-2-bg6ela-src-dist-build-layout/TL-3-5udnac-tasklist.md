---
id: TL-3-5udnac
type: tasklist
workstream: WS-2-bg6ela
slug: src-dist-build-layout
title: "Relocate hand-written source into src/, mirroring today's layout"
status: done
created: 2026-08-05
updated: 2026-08-05
depends_on: [PLN-2-7k9ycf]
links: []
mode: spec
base_commit: 640a29c
---

# PRX Tasks

## Relocate hand-written source into src/, mirroring today's layout

Implements PLN-2. Six files — `server.js`, `scripts/extract-praxis-data.mjs`, and the four
files under `public/` — move into `src/` in a shape that mirrors today's folder relationships
exactly (`src/server.js`, `src/scripts/extract-praxis-data.mjs`, `src/public/{...}`). Because
`server.js:7` computes its static root as `path.join(__dirname, 'public')` and the extractor's
line 16 computes its default output as `path.join(__dirname, '..', 'public', 'data.json')`,
preserving the relationships means **both expressions keep resolving with zero code edits**.
The three browser-side references (`href="styles.css"`, `src="app.js"`, `fetch('./data.json')`)
are document-relative and likewise untouched.

Exactly three functional edits exist in the whole workstream: two `package.json` script lines
and one `.claude/launch.json` `runtimeArgs` entry. Everything else is a `git mv` or a human-facing
string.

`dist/` is deliberately **not** created here — no compiler or bundler exists in this repo to
emit into it. That half of the card transfers to WS-1 (TypeScript conversion). Nothing in this
list creates `dist/`, edits `.gitignore`, changes `server.js`'s traversal guard, or touches
WS-4's completed CSS extraction beyond letting `styles.css` travel with the rest of `public/`.

Four phases, strictly ordered. Phase 2 is the only one that changes behaviour; Phases 3 and 4
are text. Phase 2 is a `git mv` task — the six files must move as **renames**, never as
delete-and-recreate, because the 100%-similarity rename evidence is the plan's primary
acceptance check (AC2).

- [x] 1. Capture the baseline (Phase 1 — establish what "unchanged" means)

  ```yaml
  description: "Record the pre-move content manifest, render, refresh output path, and graceful-degradation behaviour, so Phase 2 has something concrete to be checked against. No files in the repo are touched."
  ```

  - [x] 1.1 Record the content manifest of the six files that will move
    ```yaml
    description: "Capture SHA-256 hashes of the six files, in a fixed order, to a scratch file outside the repo — the baseline half of Phase 2's decisive content-parity check."
    issues: []
    implement:
      - "From the repo root, run the plan's manifest command verbatim and redirect it to a path outside the repo so no stray file lands in the working tree: shasum -a 256 server.js scripts/extract-praxis-data.mjs public/index.html public/app.js public/styles.css public/data.json > /tmp/prx-ws2-baseline-manifest.txt"
      - "Keep the file order exactly as written — Phase 2 re-runs the same command against the new paths in the same order and compares the hash column positionally."
      - "Do not commit the manifest, and do not write it anywhere under the repo root."
    pattern: "Repo root; output to /tmp/prx-ws2-baseline-manifest.txt (outside the repo)"
    imports: "shasum (macOS/BSD coreutils), a shell at the repo root"
    compatibility: "Acceptance criterion 1 lists exactly what must exist after the move; a manifest file inside the repo would be an unlisted addition. Keep it in /tmp."
    gotcha: "Running shasum from a different cwd changes the path column and breaks the positional diff in Phase 2 — always run from the repo root. Working tree must be clean before capturing, or the baseline records uncommitted content."
    verify:
      - "Confirm the manifest exists and holds exactly six lines: wc -l /tmp/prx-ws2-baseline-manifest.txt"
      - "Confirm the six paths listed are the six the plan names, in the plan's order."
    checklist:
      - "Does the manifest contain exactly six entries?"
      - "Were all six hashes produced with cwd = repo root?"
      - "Is the manifest stored outside the repo working tree?"
      - "Is the file order identical to the plan's command?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Capture the pre-move rendered board
    ```yaml
    description: "Run npm start and record how the board renders today, so the Phase 2 render check has a reference."
    issues: []
    implement:
      - "Run `npm start` from the repo root and open http://localhost:4173/."
      - "Confirm and record that the masthead, the KPI strip with its coloured bars, all six board columns, and both lower panels (including the severity bar in colour) render."
      - "Light scheme alone is sufficient — WS-4 already proved the theme paths; do not re-verify theming here."
      - "Stop the server when done. Change no file."
    pattern: "npm start at the repo root; browser at http://localhost:4173/"
    imports: "Node >=18, the existing `start` script (`node server.js`)"
    compatibility: "This is the reference for acceptance criterion 3, which requires the post-move page to render identically."
    gotcha: "Port 4173 may already be in use from an earlier session — a stale server would serve stale content and silently invalidate the capture. Confirm the process you started is the one answering."
    verify:
      - "Load http://localhost:4173/ and confirm the board renders."
      - "In devtools, confirm styles.css, app.js and data.json each return 200 and the console is clean — this is the same evidence Phase 2 must reproduce."
    checklist:
      - "Did the masthead and KPI strip render with coloured bars?"
      - "Did all six columns render?"
      - "Did both lower panels render, with the severity bar in colour?"
      - "Was the browser console clean?"
      - "Was no repo file modified while capturing?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.3 Record the extractor's current default output path
    ```yaml
    description: "Run the refresh script with no --out and note the absolute outPath it logs — the value Phase 2 must see change to .../src/public/data.json."
    issues: []
    implement:
      - "From the repo root run: npm run refresh -- --root ."
      - "Record the absolute path from the line the extractor logs at line 166 (`Wrote <outPath> — N workstreams, ...`). Today it must end `/public/data.json` at the repo root."
      - "Do not pass --out. The whole point is to observe the default, which comes from `path.join(__dirname, '..', 'public', 'data.json')` at line 16."
    pattern: "npm run refresh at the repo root; scripts/extract-praxis-data.mjs"
    imports: "The existing `refresh` script (`node scripts/extract-praxis-data.mjs`)"
    compatibility: "Acceptance criterion 5 requires the post-move default to be src/public/data.json, resolved independently of cwd."
    gotcha: "This run rewrites public/data.json. That is expected and harmless — the file is generated — but do it before capturing task 1.1's manifest only if you intend the manifest to record the refreshed content. If 1.1 already ran, re-run 1.1 afterwards so the baseline hashes match what will actually be moved."
    verify:
      - "Confirm the logged outPath is absolute and ends with /public/data.json under the repo root."
      - "Confirm no --out flag was passed."
    checklist:
      - "Was the command run with cwd = repo root?"
      - "Was the logged absolute outPath recorded verbatim?"
      - "Was --out omitted?"
      - "Does the baseline manifest from 1.1 still match public/data.json's current content?"
    self_eval:
      passed: true
      failures:
        - item: "Does the baseline manifest from 1.1 still match public/data.json's current content?"
          reason: "The mandated `npm run refresh -- --root .` regenerated public/data.json from this repo's own flowcharge/ (4 workstreams), overwriting the checked-in 174-workstream LAD snapshot and invalidating the 1.1 hash."
          fix: "Restored the committed content with `git checkout -- public/data.json`. It re-hashes to 945972fe4c8cc448e2904f66919b9412467846998db2fa3c6e952edc334f2427, matching the 1.1 manifest line, and `git status --short` is clean — so Phase 2's rename diff stays at 100% similarity."
    ```
  - [x] 1.4 Confirm the graceful-degradation panel works today
    ```yaml
    description: "With data.json absent, confirm the page shows the 'Couldn't load data.json' panel rather than a blank page or an uncaught error — then restore the file."
    issues: []
    implement:
      - "Move public/data.json aside to a scratch location outside the repo, e.g. /tmp/prx-ws2-data.json.bak."
      - "Hard-reload http://localhost:4173/ and confirm the load-state panel with the refresh instructions appears, not a blank page and not an uncaught console error."
      - "Restore the file to public/data.json immediately afterwards and confirm the board renders again."
      - "Confirming this now is far cheaper than debugging it after the move — this is the behaviour Phase 2's step 6 must still see."
    pattern: "public/data.json; public/app.js's fetch('./data.json') failure path at line 20; index.html's .load-state block"
    imports: "A running `npm start` server"
    compatibility: "Acceptance criterion 7 — npm start must never require a refresh first."
    gotcha: "Forgetting to restore data.json leaves the repo with a deleted tracked file and breaks the manifest from 1.1. Restore it and confirm `git status` is clean before moving on."
    verify:
      - "With data.json moved aside, hard-reload and observe the degradation panel."
      - "Restore the file, reload, and confirm the board renders; then confirm `git status --short` reports no changes."
    checklist:
      - "Did the degradation panel appear instead of a blank page?"
      - "Was the console free of uncaught errors?"
      - "Was public/data.json restored byte-identically?"
      - "Is `git status --short` clean afterwards?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Move the six files into src/ and repoint the wiring (Phase 2)
  ```yaml
  description: "git mv the six files into src/ as pure renames, and in the same step repoint package.json's two scripts and .claude/launch.json's runtimeArgs. Move and wiring stay together because splitting them would leave npm start broken between phases."
  issues: []
  implement:
    - "THIS IS A `git mv` TASK, NOT AN EDIT TASK. Move each file with `git mv` so git records a rename. Do NOT `rm` a file and hand-recreate it at the new path, do NOT copy-then-delete, and do NOT recreate any file's contents from memory or from the plan's quoted snippets — that destroys the 100%-similarity rename evidence this task's primary acceptance check (AC2) depends on, and it is the one way this task can silently fail while looking finished."
    - "Create the destination folders first: mkdir -p src/scripts src/public"
    - "Then run exactly these six moves from the repo root: git mv server.js src/server.js ; git mv scripts/extract-praxis-data.mjs src/scripts/extract-praxis-data.mjs ; git mv public/index.html src/public/index.html ; git mv public/app.js src/public/app.js ; git mv public/styles.css src/public/styles.css ; git mv public/data.json src/public/data.json"
    - "The now-empty scripts/ and public/ directories disappear with the move — git does not track empty directories. If either directory still exists afterwards, something was left behind; investigate rather than deleting it blindly."
    - "In package.json, change the two lines in the `scripts` object (currently line 11 `\"start\": \"node server.js\"` and line 12 `\"refresh\": \"node scripts/extract-praxis-data.mjs\"`) to `\"start\": \"node src/server.js\"` and `\"refresh\": \"node src/scripts/extract-praxis-data.mjs\"`. Change nothing else in that file."
    - "In .claude/launch.json, change the `runtimeArgs` entry of the `praxis-dashboard` configuration (currently line 7, `\"runtimeArgs\": [\"server.js\"]`) to `\"runtimeArgs\": [\"src/server.js\"]`. Leave `runtimeExecutable`, `name`, and `port` untouched."
    - "EDIT NOTHING INSIDE THE MOVED FILES. No comment, no display string, no path expression — the stale strings inside the extractor and index.html are Phase 3, deliberately kept out of this commit so the rename diff stays pure."
    - "Create no dist/ directory and make no change to .gitignore."
    - "Commit this phase on its own, as the plan's Open Question 5 default requires, so the pure-rename diff stays reviewable in isolation."
  pattern: "server.js, scripts/extract-praxis-data.mjs, public/{index.html,app.js,styles.css,data.json} → src/; package.json scripts block; .claude/launch.json runtimeArgs"
  imports: "git (rename detection), Node >=18, npm"
  compatibility: "server.js:7 (`path.join(__dirname, 'public')`) and extract-praxis-data.mjs:16 (`path.join(__dirname, '..', 'public', 'data.json')`) must both keep resolving with zero edits — that is what the mirrored layout buys. Keeping the scripts/ sub-folder inside src/ is what preserves the extractor's single `..` hop; flattening it would break line 16. Keeping the folder name `public` inside src/ is what preserves server.js:7; renaming it to web/ or client/ would force edits to both lines."
  gotcha: "Anyone with muscle memory for `node server.js` or `node scripts/extract-praxis-data.mjs` will now get 'Cannot find module' — expected and unavoidable, which is why the npm scripts exist. Separately, a scripted `npm run refresh -- --out public/data.json` would silently recreate a root-level public/data.json that nothing serves; the symptom is the board's 'Data generated' date not moving after a refresh, and verify step 3 checks for exactly that."
  verify:
    - "Content parity — the decisive check. `git status` and `git diff --cached -M --stat` must show six rename entries at 100%. Independently, re-run the Phase 1 manifest against the new paths in the same order: shasum -a 256 src/server.js src/scripts/extract-praxis-data.mjs src/public/index.html src/public/app.js src/public/styles.css src/public/data.json > /tmp/prx-ws2-after-manifest.txt — then diff the hash columns and require empty output: diff <(awk '{print $1}' /tmp/prx-ws2-baseline-manifest.txt) <(awk '{print $1}' /tmp/prx-ws2-after-manifest.txt)"
    - "Layout. `ls` at the repo root shows no server.js, no scripts/ and no public/; `find src -type f` lists exactly the six new paths."
    - "Server root. Run `npm start` from the repo root and open http://localhost:4173/. The board renders as in the Phase 1 capture. In devtools, styles.css, app.js and data.json are all 200 with correct Content-Type, and the console is clean. This proves server.js:7 still resolves — no assertion needed."
    - "Extractor default output. `npm run refresh -- --root .` from the repo root prints an outPath ending /src/public/data.json, and no public/ folder reappears at the repo root. Reload the page and confirm the 'Data generated' date reflects the new run — proving the extractor writes to the same file the server serves."
    - "cwd-independence of the default. Run `node /abs/path/to/project/src/scripts/extract-praxis-data.mjs --root /abs/path/to/project` from a different cwd and confirm it still targets src/public/data.json."
    - "--out still cwd-relative. `npm run refresh -- --root . --out /tmp/probe.json` writes /tmp/probe.json and leaves src/public/data.json alone. Delete the probe afterwards."
    - "Graceful degradation. Move src/public/data.json aside, hard-reload, see the 'Couldn't load data.json' panel; restore it."
    - "Launch config. Start via the `praxis-dashboard` configuration in .claude/launch.json and confirm the preview reaches a working board."
    - "No dist/. `ls` shows no dist/ directory, and `git diff .gitignore` is empty."
  checklist:
    - "Does `git diff --cached -M --stat` show all six files as renames at 100% similarity?"
    - "Is the hash-column diff between the Phase 1 and Phase 2 manifests empty?"
    - "Do the repo root's server.js, scripts/ and public/ all no longer exist, with the six src/ paths present in their place?"
    - "Is src/public/data.json still tracked (`git ls-files --error-unmatch src/public/data.json` succeeds), so a fresh clone plus npm start still shows a populated board?"
    - "Were exactly three functional edits made outside the moved files — two in package.json, one in .claude/launch.json — and zero edits inside any moved file?"
    - "Is there no dist/ directory and no change to .gitignore?"
  self_eval:
    passed: true
    failures: []
  ```

- [x] 3. Refresh the stale path strings inside the moved source (Phase 3)

  ```yaml
  description: "Update the human-facing text inside the moved files that now names paths which no longer exist. Kept out of Phase 2 so that phase's rename evidence stays at 100%."
  ```

  - [x] 3.1 Update the extractor's header comment and usage text
    ```yaml
    description: "In src/scripts/extract-praxis-data.mjs, repoint the four cosmetic path mentions (header comment, usage comment, usage() invocation line, --out default description) to the new src/ paths. No executable line changes."
    issues: []
    implement:
      - "Open src/scripts/extract-praxis-data.mjs and edit only comment and display strings. Change no expression."
      - "Line 2, header comment: `// Reads a Praxis project's flowcharge/ frontmatter and writes public/data.json` → the same sentence naming `src/public/data.json`."
      - "Line 7, usage comment: `//   node scripts/extract-praxis-data.mjs --root /path/to/project [--out public/data.json]` → the same line naming `node src/scripts/extract-praxis-data.mjs` and `src/public/data.json`."
      - "Line 29, inside the usage() template literal: `  node scripts/extract-praxis-data.mjs --root <project-dir> [--out <file.json>]` → `  node src/scripts/extract-praxis-data.mjs --root <project-dir> [--out <file.json>]`."
      - "Line 32, the --out description in the same template literal: `  --out    Where to write the JSON payload (default: public/data.json)` → the same line naming `src/public/data.json`."
      - "Do NOT touch line 16 (`path.join(__dirname, '..', 'public', 'data.json')`) or line 162 (`path.resolve(args.out)`) — those are the path expressions the whole plan exists to leave alone."
    pattern: "src/scripts/extract-praxis-data.mjs — lines 2, 7, 29, 32 only"
    imports: "None. Comment and string edits only."
    compatibility: "Acceptance criterion 11 — no file under src/ may contain a path expression that differs from its pre-move version; the only permitted edits inside moved files are comment and display strings. The extractor's behaviour, CLI flags and output format are explicitly out of scope."
    gotcha: "Lines 29 and 32 sit inside a template literal whose leading whitespace is part of the printed output — preserve the exact indentation. Editing line 16 by reflex while 'fixing paths' would break the plan's central safety property and invalidate its verification story."
    verify:
      - "Run: node src/scripts/extract-praxis-data.mjs --help — the printed usage must name src/scripts/extract-praxis-data.mjs and src/public/data.json."
      - "Copy the command line exactly as printed, supply a real --root, run it, and confirm it works."
      - "Run: grep -rn \"public/data.json\" src/ | grep -v \"src/public/data.json\" — must return nothing."
      - "Run: git diff src/scripts/extract-praxis-data.mjs — every changed line must be a comment or a string inside usage(); lines 16 and 162 must be absent from the diff."
    checklist:
      - "Do all four cosmetic mentions now name src/ paths?"
      - "Are lines 16 and 162 untouched?"
      - "Does the grep for a non-src public/data.json return zero matches?"
      - "Does --help print a command line that runs successfully when copy-pasted?"
      - "Is the template literal's indentation preserved?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.2 Update the index.html footer paths
    ```yaml
    description: "In src/public/index.html, repoint the footer's two <code> path mentions to src/public/data.json and src/scripts/extract-praxis-data.mjs, so the footer names files that exist."
    issues: []
    implement:
      - "Apply this block to src/public/index.html. The SEARCH text is byte-identical to the file's line 69 as it stands at base_commit 640a29c; Phase 2 moves the file as a pure rename, so it is unchanged at the new path."
      - |
        src/public/index.html
        <<<<<<< SEARCH
          Reads <code>public/data.json</code>, produced by <code>scripts/extract-praxis-data.mjs</code> from a project's
        =======
          Reads <code>src/public/data.json</code>, produced by <code>src/scripts/extract-praxis-data.mjs</code> from a project's
        >>>>>>> REPLACE
      - "Change nothing else in the footer or elsewhere in the file — in particular leave `href=\"styles.css\"` (line 7) and `src=\"app.js\"` (line 75) alone; both are document-relative and correct."
    pattern: "src/public/index.html — footer <code> spans on line 69 only"
    imports: "None. Markup text edit only."
    compatibility: "Acceptance criterion 11 — display strings are the only permitted edit inside a moved file. WS-4's CSS extraction is complete and out of scope; do not re-inline or otherwise touch the stylesheet link."
    gotcha: "If the SEARCH block does not match, re-read src/public/index.html and re-anchor against its current content — do not approximate. A mismatch here most likely means Phase 2 did not move the file as a pure rename, which is itself worth investigating before editing."
    verify:
      - "Run: grep -n \"src/public/data.json\" src/public/index.html — must match the footer line."
      - "Run: grep -rn \"<code>public/data.json</code>\\|<code>scripts/extract-praxis-data.mjs</code>\" src/ — must return nothing."
      - "Reload http://localhost:4173/ and read the footer — every path it names must exist on disk."
    checklist:
      - "Do both footer <code> spans now name src/ paths?"
      - "Are the stylesheet link and script src still document-relative and unchanged?"
      - "Does the page still render with the footer intact?"
      - "Does a grep for the old footer paths return zero matches?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 4. Update the README to describe the new layout (Phase 4)
  ```yaml
  description: "Repoint README.md's quick-start comment, checked-in-snapshot sentence, directory tree, Scripts table and --out note at the src/ layout, leaving the 'No build step' note exactly as it is."
  issues: []
  implement:
    - "Edit README.md only. Five regions change, all of them prose or a code block; no behaviour is involved."
    - "Line 16, the quick-start comment: `# extract flowcharge/ into public/data.json` → `src/public/data.json`. The commands themselves (`npm run refresh -- --root ...`, `npm start`) are unchanged, since both npm scripts were repointed in Phase 2."
    - "Line 20, the checked-in-snapshot sentence: `A snapshot of the LAD project is checked in at \\`public/data.json\\`` → `src/public/data.json`. The 'works out of the box' promise itself stays — the file is still committed and still served."
    - "Lines 25–35, the directory tree: nest server.js, scripts/ and public/ inside a src/ node, mirroring the plan's target layout — src/server.js, src/scripts/extract-praxis-data.mjs, src/public/{index.html, styles.css, app.js, data.json}. Update the tree's inline annotations that name paths (the extractor line currently reads `reads <project>/flowcharge/ → writes public/data.json`)."
    - "Lines 45–46, the Scripts table: `npm start` serves `src/public/`; `npm run refresh -- --root <dir>` regenerates `src/public/data.json`."
    - "Line 48, the --out note: `write somewhere other than \\`public/data.json\\`` → `src/public/data.json`."
    - "Leave line 52 — 'No build step, no framework, no npm dependencies' — exactly as it is. This plan keeps it true; do not soften, qualify, or remove it."
    - "Do not document a dist/ folder, a build script, or any prebuild/prestart hook. None exists."
  pattern: "README.md — quick-start block, snapshot sentence, directory tree, Scripts table, --out note"
  imports: "None. Documentation edit only."
  compatibility: "Acceptance criterion 12 — the tree, quick-start block and Scripts table must describe the new layout, and the 'No build step' note at line 52 must still be present and still true. The README's 'works out of the box' promise must survive verbatim, which it does because src/public/data.json stays tracked."
  gotcha: "The directory tree's box-drawing characters and column alignment are easy to mangle when adding a nesting level — re-read the rendered block after editing. Also resist updating line 52 'for accuracy': adding a build step is precisely what this plan declined to do."
  verify:
    - "Run: find src -type f — every path the README's tree shows must exist, and the tree must show no path that does not."
    - "Copy-paste the two commands from the quick-start block verbatim and run them; both must succeed, and the second must serve a working board."
    - "Run: grep -n \"No build step\" README.md — the note must still be present."
    - "Run: grep -n \"public/data.json\" README.md | grep -v \"src/public/data.json\" — must return nothing."
  checklist:
    - "Does every path in the README exist on disk per `find src -type f`?"
    - "Do both quick-start commands run successfully exactly as written?"
    - "Is the 'No build step, no framework, no npm dependencies' note still present and unmodified?"
    - "Does the Scripts table name src/public/ and src/public/data.json?"
    - "Is dist/ absent from the README, and is the directory tree still correctly aligned?"
  self_eval:
    passed: true
    failures: []
  ```

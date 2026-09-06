---
id: TL-82-s9bwq9
type: tasklist
workstream: WS-80-lgot3j
slug: flowcharge-prose-rename-sweep
title: "FlowCharge prose rename sweep"
status: done
created: 2026-08-30
updated: 2026-08-30
author: Anthony Koukoullis
depends_on: [PLN-71-lo4omy]
links: []
mode: spec
base_commit: c768f6b
---

# PRX Tasks

## FlowCharge prose rename sweep

This list implements PLN-71-lo4omy. The app still calls itself "Praxis", "Praxis Board" and
"Praxis Dashboard" in tab titles, runtime dialogs, server output, the README and source
comments, while its masthead already reads FlowCharge. Seven parent tasks mirror the plan's
seven stages, in the plan's order, from most user-visible to least.

Every edit is text-only. No identifier, file name, CSS class, API route, data field, `appId`
or URL constant changes. The plan's decision table is final: `praxisAPI`, `PraxisWorkstream`,
`PraxisData`, `CANONICAL_PRAXIS_SKILL_IDS`, `PRAXIS_DATA_DIR`, `.praxis-projects.json`,
`.praxis-update.json`, `.praxis-installs.json`, `board.html`, the `.board` CSS class,
`extract-praxis-data.ts`, `praxis-data.d.ts`, `package.json`'s `name` and `appId`, and
`PRAXIS_REPO_BASE_URL` all stay exactly as found.

Decision rule 2 (the folder-name trap) governs source comments: a comment loses its branding
noun only, and its `prxwork/` folder name is left alone, because `flowcharge/` holds zero bare
ids (228 suffixed ids at the time of writing), so a mechanical folder rename makes the comment
false. No bare id exists anywhere in this repo, `prxwork-bak/` included. The README is the
plan's single exception and gets a whole-document pass on both names.

Files the plan rules out and this list therefore never touches: `src/lib/extract.ts:62`,
`src/lib/projects.ts:5`, `src/lib/git.ts:3`, `src/public/styles.css:105`, `.gitignore:7-10`,
`src/public/board.html:34`, `src/public/app.ts:1251`, the README tree fence's real path
names, `src/lib/agentic-tools-canonical-skills.ts:2-4`, and the "Manage integrations" dialog
copy in `src/public/index.html` and `src/public/home.ts`.

The project has no `test` script and no lint or type-check script of its own; `npm run build`
is the compile gate, and it is the primary verify step throughout. It runs `build:base` (`tsc`
over three projects plus `tools/copy-assets.mjs`) and then `tools/bundle-public.mjs`, so a
browser-side type error fails it just as a Node-side one does.

- [x] 1. Browser tab titles (plan stage 1)

  ```yaml
  description: "Both documents' <title> read FlowCharge, so a tab no longer says Praxis while the page renders the FlowCharge wordmark."
  ```

  - [x] 1.1 Retitle the home document
    ```yaml
    description: "Set src/public/index.html's <title> to the plan's contract wording."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/public/index.html
        <<<<<<< SEARCH
        <title>Praxis Projects</title>
        =======
        <title>FlowCharge — Projects</title>
        >>>>>>> REPLACE
    pattern: "src/public/index.html line 6 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy Design → Contracts. The product name leads so a truncated tab still reads FlowCharge, and the two documents stay distinguishable when both are open."
    gotcha: "The separator is an em dash (—), not a hyphen. Nothing else in this file changes: the Manage integrations dialog copy on lines 59-79 is explicitly out of scope."
    verify:
      - "npm run build"
      - "grep -n '<title>' src/public/index.html — shows FlowCharge — Projects and no 'Praxis'."
    checklist:
      - "Does the title read exactly 'FlowCharge — Projects' with an em dash?"
      - "Is line 6 the only changed line in this file?"
      - "Is the integrations dialog copy on lines 59-79 untouched?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Retitle the board document
    ```yaml
    description: "Set src/public/board.html's <title> to the plan's contract wording."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/public/board.html
        <<<<<<< SEARCH
        <title>Praxis Board</title>
        =======
        <title>FlowCharge — Board</title>
        >>>>>>> REPLACE
    pattern: "src/public/board.html line 6 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy Design → Contracts."
    gotcha: "The <h1 class=\"tb-title\" id=\"board-title\">Board</h1> on line 34 must stay verbatim, its class attribute included. It is the static markup for the element that shows the project name once data loads, and its JS fallback in src/public/app.ts:1251 stays too."
    verify:
      - "npm run build"
      - "grep -n '<title>' src/public/board.html — shows FlowCharge — Board and no 'Praxis'."
    checklist:
      - "Does the title read exactly 'FlowCharge — Board' with an em dash?"
      - "Is the h1 on line 34 still 'Board'?"
      - "Do both documents' titles now start with 'FlowCharge'?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Runtime user-facing strings (plan stage 2)

  ```yaml
  description: "Every remaining string a running user can read on screen names FlowCharge, never 'Praxis' and never 'the dashboard'."
  ```

  - [x] 2.1 Rename the product in the remove-project confirm
    ```yaml
    description: "src/public/home.ts's delete-button confirm names FlowCharge instead of 'the dashboard'."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/public/home.ts
        <<<<<<< SEARCH
                  'Remove "' + p.name + '" from the dashboard?\n\n' +
        =======
                  'Remove "' + p.name + '" from FlowCharge?\n\n' +
        >>>>>>> REPLACE
    pattern: "src/public/home.ts line 217 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy acceptance criterion 2 and the closing grep in Testing strategy, which requires zero hits for 'the dashboard'."
    gotcha: "The second sentence of the confirm is unchanged. The integrations dialog strings at lines 435, 439, 615-617, 637 and 656-658 are out of scope — introducing 'FlowCharge Core' there is new copy authoring, not a rename."
    verify:
      - "npm run build"
      - "grep -n 'from FlowCharge?' src/public/home.ts — one hit; grep -n 'the dashboard' src/public/home.ts — zero hits."
    checklist:
      - "Does the confirm's first line name FlowCharge?"
      - "Is the second sentence of the confirm unchanged?"
      - "Are the integrations dialog strings untouched?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.2 Rename the product in the update banner
    ```yaml
    description: "src/public/update-banner.ts's notice text names FlowCharge instead of 'Praxis Board'."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/public/update-banner.ts
        <<<<<<< SEARCH
                text.textContent = 'Praxis Board ' + notice.version + ' is available.';
        =======
                text.textContent = 'FlowCharge ' + notice.version + ' is available.';
        >>>>>>> REPLACE
    pattern: "src/public/update-banner.ts line 78 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy acceptance criterion 2. The banner reads its version from the update notice, so only the product word changes."
    gotcha: "Keep the trailing space inside the literal, or the version number runs into the product name."
    verify:
      - "npm run build"
      - "grep -n \"'FlowCharge ' + notice.version\" src/public/update-banner.ts — one hit."
    checklist:
      - "Does the banner text read 'FlowCharge <version> is available.'?"
      - "Is the trailing space inside the string literal preserved?"
      - "Is the notice/version plumbing unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.3 Reword the board loading line
    ```yaml
    description: "src/public/board.html's load-state paragraph names the local server instead of 'the dashboard server'."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/public/board.html
        <<<<<<< SEARCH
            <p>Reading the project's <code>flowcharge/</code> folder through the dashboard server. Larger projects take a moment.</p>
        =======
            <p>Reading the project's <code>flowcharge/</code> folder through the local server. Larger projects take a moment.</p>
        >>>>>>> REPLACE
    pattern: "src/public/board.html line 89 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy Design → Contracts: 'local server' is chosen over 'the FlowCharge server' because the folder name in the same sentence already reads flowcharge/, and src/server.ts binds loopback by default."
    gotcha: "The <code>flowcharge/</code> span is already correct and must not be re-edited. The <h2>Loading this project…</h2> above it stays as found."
    verify:
      - "npm run build"
      - "grep -n 'the local server' src/public/board.html — one hit; grep -n 'dashboard' src/public/board.html — zero hits."
    checklist:
      - "Does the paragraph read 'through the local server'?"
      - "Is the <code>flowcharge/</code> span unchanged?"
      - "Is the loading heading unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.4 Rename the product in the Electron startup-failure dialog
    ```yaml
    description: "electron/main.cts's showErrorBox title names FlowCharge instead of 'Praxis Dashboard'."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        electron/main.cts
        <<<<<<< SEARCH
              'Praxis Dashboard failed to start',
        =======
              'FlowCharge failed to start',
        >>>>>>> REPLACE
    pattern: "electron/main.cts line 90 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy acceptance criterion 2. This is the dialog shown when serverModule.serverReady rejects."
    gotcha: "The dialog's body string on the next line carries the underlying error and names no product; leave it alone."
    verify:
      - "npm run build"
      - "grep -n 'FlowCharge failed to start' electron/main.cts — one hit."
    checklist:
      - "Does the dialog title read 'FlowCharge failed to start'?"
      - "Is the dialog body message unchanged?"
      - "Is the surrounding try/catch control flow unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Product identity (plan stage 3)

  ```yaml
  description: "How the product names itself to macOS, to a reader of the package manifest, and to GitHub. Held to its own stage because it changes the packaged bundle's filename."
  ```

  - [x] 3.1 Reword the package description
    ```yaml
    description: "package.json's description names FlowCharge, drops the word 'dashboard', and describes the data folder as flowcharge/."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        package.json
        <<<<<<< SEARCH
          "description": "Local Kanban dashboard for Praxis (prx) project-management workstreams — a bird's-eye view of any project's prxwork/ state.",
        =======
          "description": "Local Kanban view of FlowCharge project-management workstreams — a bird's-eye view of any project's flowcharge/ state.",
        >>>>>>> REPLACE
    pattern: "package.json line 4 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy Design → Contracts. 'View' replaces 'dashboard', and the word 'dashboard' leaves the product description entirely."
    gotcha: "The plan quotes the folder name in backticks because it renders as Markdown; this JSON string carries no backticks anywhere today, so the folder name is written bare. The name field on line 2 (praxis-dashboard) is a structural identifier and stays."
    verify:
      - "npm run build"
      - "node -e \"console.log(require('./package.json').description)\" — prints the new sentence with no 'dashboard' and no 'prxwork'."
    checklist:
      - "Does the description name FlowCharge and the flowcharge/ folder?"
      - "Is the word 'dashboard' absent from the description?"
      - "Is package.json still valid JSON?"
      - "Is the name field on line 2 unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.2 Rename the packaged product
    ```yaml
    description: "package.json's build.productName becomes FlowCharge, so the next packaged macOS bundle is FlowCharge.app."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        package.json
        <<<<<<< SEARCH
            "productName": "Praxis Board",
        =======
            "productName": "FlowCharge",
        >>>>>>> REPLACE
    pattern: "package.json line 36 only, inside the build block."
    imports: "None."
    compatibility: "PLN-71-lo4omy Assumptions and Data & compatibility. appId stays com.praxisboard.app, so app identity and update continuity are untouched."
    gotcha: "Do not add a test asserting productName. An existing 'Praxis Board.app' on disk is not replaced by the new build; the author deletes the old bundle by hand. This edit changes the bundle filename only at the next npm run package:mac."
    verify:
      - "npm run build"
      - "node -e \"const p=require('./package.json'); console.log(p.build.productName, p.build.appId)\" — prints 'FlowCharge com.praxisboard.app'."
    checklist:
      - "Is productName exactly 'FlowCharge'?"
      - "Is appId still com.praxisboard.app?"
      - "Is every other key in the build block unchanged?"
      - "Is package.json still valid JSON?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.3 Track the bundle filename in the README quarantine command
    ```yaml
    description: "README.md's xattr example quotes FlowCharge.app, matching the new productName."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        README.md
        <<<<<<< SEARCH
          xattr -dr com.apple.quarantine "Praxis Board.app"
        =======
          xattr -dr com.apple.quarantine "FlowCharge.app"
        >>>>>>> REPLACE
    pattern: "README.md line 133, inside the Packaged builds section's bash fence."
    imports: "None."
    compatibility: "PLN-71-lo4omy acceptance criterion 3 and its per-file decision record: the .app filename changes with productName."
    gotcha: "This is the only README line stage 3 touches. Task 4 does the whole-document pass and must not re-edit this line. Do not expect 'Praxis Board' to be gone from the README after this task: the H1 on line 1 still reads '# Praxis Board' until task 4.1 rewrites it in the next stage."
    verify:
      - "grep -n 'com.apple.quarantine' README.md — quotes \"FlowCharge.app\"."
      - "grep -n 'Praxis Board' README.md — exactly one hit, the H1 on line 1, which task 4.1 owns. Line 133 is no longer among the hits."
    checklist:
      - "Does the command quote \"FlowCharge.app\"?"
      - "Does the quoted filename match package.json's productName?"
      - "Is the rest of the Packaged builds section unchanged?"
      - "Is the bash fence still well formed?"
      - "Is the H1 on line 1 still untouched, left for task 4.1?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.4 Rename the product in the GitHub User-Agent
    ```yaml
    description: "src/lib/update-check.ts sends FlowCharge as its User-Agent product name."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/lib/update-check.ts
        <<<<<<< SEARCH
                'User-Agent': 'PraxisBoard',
        =======
                'User-Agent': 'FlowCharge',
        >>>>>>> REPLACE
    pattern: "src/lib/update-check.ts line 136 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy Assumptions: the comment three lines above calls this the product name, and GitHub only requires the header to be non-empty — nothing keys off the value."
    gotcha: "The Accept header, the timeout and the release URL builder stay as found. No token, credential or cookie is added."
    verify:
      - "npm run build"
      - "grep -n \"User-Agent\" src/lib/update-check.ts — value is 'FlowCharge'."
    checklist:
      - "Is the User-Agent value exactly 'FlowCharge'?"
      - "Is the header still non-empty and still the only identifying header?"
      - "Are the Accept header and AbortSignal timeout unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 4. README whole-document pass (plan stage 4)

  ```yaml
  description: "The README's product name and data-folder name are made consistent top to bottom, so no sentence contradicts another. This is the plan's single exception to Decision rule 2."
  ```

  - [x] 4.1 Rewrite the H1 and the lead paragraphs
    ```yaml
    description: "README.md lines 1-15 name FlowCharge, name FlowCharge Core, and describe the convention folder as flowcharge/."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Change the H1 on line 1 from '# Praxis Board' to '# FlowCharge'."
      - "Reword the lead sentence on lines 6-7. It must drop the word 'dashboard', name the product FlowCharge, name the sibling suite FlowCharge Core, say the convention folder is flowcharge/, and name the skill fc-orchestrate. Keep the existing bracketed link target https://github.com exactly as found — the plan records it as a placeholder that stays."
      - "In the paragraph at lines 9-15, change 'Reads a project's prxwork/ frontmatter' to flowcharge/, and change the 'prx-*' skills reference on line 13 to 'fc-*'."
      - "Leave the words 'board' and 'board movement' as found on lines 10-15: they name the kanban screen, which Decision rule 1 keeps."
      - "Leave the private-repository notice on lines 3-4 untouched."
    pattern: "README.md lines 1-15."
    imports: "None."
    compatibility: "PLN-71-lo4omy Design → Contracts for README.md:6-7 and :13, and Decision rule 3 for where FlowCharge Core is introduced. The fc-orchestrate skill and its scripts/fc-index.mjs are confirmed real."
    gotcha: "The lead is a reworded sentence, not a substitution — do not simply swap 'Praxis' for 'FlowCharge' and leave the word 'dashboard' in place. Line 13's 'board movement' is legitimate technical use and stays."
    verify:
      - "sed -n '1,15p' README.md — the H1 reads FlowCharge, the lead names FlowCharge Core, flowcharge/ and fc-orchestrate, and no line says 'dashboard' or 'prx-'."
      - "sed -n '1,15p' README.md | grep -n 'prxwork\\|prx-\\|dashboard' — zero hits, which is a non-zero exit status. This scopes the check to the lines this task owns; hits further down the file are still expected until tasks 4.2 to 4.4 run."
    checklist:
      - "Does the H1 read '# FlowCharge'?"
      - "Does the lead name FlowCharge, FlowCharge Core, flowcharge/ and fc-orchestrate?"
      - "Is the word 'dashboard' gone from lines 1-15?"
      - "Is the https://github.com link target unchanged?"
      - "Does 'board movement' still appear on line 13?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.2 Correct the Quick start section
    ```yaml
    description: "README.md's Quick start section names the flowcharge/ folder and stops calling the product 'the dashboard'."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In the paragraph at lines 24-26, change 'any directory containing a prxwork/ folder' to 'a flowcharge/ folder'."
      - "In the paragraph at lines 31-34, change \"the dashboard's own prxwork/\" to a FlowCharge-named phrasing that describes this repo's own flowcharge/ tree, so the sentence matches the rest of the document."
      - "Leave the npm commands, ports and the .praxis-projects.json registry filename exactly as found."
    pattern: "README.md lines 17-34."
    imports: "None."
    compatibility: "PLN-71-lo4omy acceptance criterion 4 and Decision rule 2's README exception: the README describes current app behaviour, so its folder names are corrected."
    gotcha: "The registry file really is named .praxis-projects.json — it is a structural name and must not be renamed anywhere in this file. The word 'board' as the name of the kanban screen stays."
    verify:
      - "sed -n '17,34p' README.md — names flowcharge/ and no longer says 'dashboard' or 'prxwork'."
      - "grep -n '.praxis-projects.json' README.md — still present and unchanged."
    checklist:
      - "Does the add-a-project paragraph say flowcharge/?"
      - "Is 'the dashboard's own prxwork/' replaced by a FlowCharge phrasing naming flowcharge/?"
      - "Is .praxis-projects.json unchanged?"
      - "Are the npm commands and the port unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.3 Correct the How it fits together section
    ```yaml
    description: "README.md's tree diagram keeps every real path name, while its descriptive text and the paragraph below it are corrected."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Inside the tree fence at lines 38-67, change only descriptive text that follows a path. On line 43, 'pure extraction library — prxwork/ → PraxisData' becomes 'flowcharge/ → PraxisData'."
      - "Keep every real path name in the fence exactly as found: the Praxis-Dashboard/ root on line 39, extract-praxis-data.ts, praxis-data.d.ts, .praxis-projects.json and dist/scripts/extract-praxis-data.js. The diagram is a map of the real filesystem."
      - "In the paragraph at lines 69-71, change the 'prx-*' skills reference to 'fc-*' and 'prx-index.mjs' to 'fc-index.mjs'."
    pattern: "README.md lines 36-71."
    imports: "None."
    compatibility: "PLN-71-lo4omy Design → Contracts for README.md:70-71, and its per-file decision record for README.md:39 (keep — real on-disk path)."
    gotcha: "A tree diagram that does not match the tree is worse than one carrying the old name — the Praxis-Dashboard/ root stays because the checkout really is named that. Renaming the on-disk directory is explicitly out of scope."
    verify:
      - "sed -n '36,71p' README.md — line 43 reads flowcharge/ → PraxisData, and the paragraph names fc-* and fc-index.mjs."
      - "grep -n 'Praxis-Dashboard/\\|extract-praxis-data\\|praxis-data.d.ts' README.md — all still present."
    checklist:
      - "Does the extract.ts row read 'flowcharge/ → PraxisData'?"
      - "Is the Praxis-Dashboard/ tree root unchanged?"
      - "Are all four structural file names in the fence unchanged?"
      - "Do the skills and index-script references read fc-* and fc-index.mjs?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.4 Correct the Scripts and Notes sections
    ```yaml
    description: "README.md's scripts table and notes name the flowcharge/ folder and the FlowCharge convention."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In the scripts table row for npm run refresh (line 79), change '<dir>/prxwork/' to '<dir>/flowcharge/'."
      - "In the Notes list (line 116), change 'the Praxis prxwork/ convention' to 'the FlowCharge flowcharge/ convention'."
      - "Leave the machine-local filenames .praxis-projects.json (line 92) and .praxis-update.json (line 110) exactly as found, and leave ALLOWED_HOSTS=board.local (line 104) as found — it is an example hostname."
      - "Leave the HOST, ALLOWED_HOSTS and update-check explanations otherwise unchanged; they name no product."
    pattern: "README.md lines 73-117."
    imports: "None."
    compatibility: "PLN-71-lo4omy acceptance criterion 4 and its per-file decision record for README.md:104."
    gotcha: "Line 79 documents what npm run refresh reads, so its folder name must match the flowcharge/ name used elsewhere in the file. The two dotfile names are structural and are read back as data."
    verify:
      - "grep -n 'prxwork' README.md — zero hits, or only a deliberate legacy mention."
      - "grep -n 'board.local\\|.praxis-update.json\\|.praxis-projects.json' README.md — all still present and unchanged."
    checklist:
      - "Does the refresh row read <dir>/flowcharge/?"
      - "Does the Notes entry name the FlowCharge flowcharge/ convention?"
      - "Are .praxis-projects.json, .praxis-update.json and board.local unchanged?"
      - "Does the whole README now contain no sentence contradicting another about the product name or the data folder?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 5. Server and CLI output (plan stage 5)

  ```yaml
  description: "Text an operator reads in a terminal names FlowCharge. This stage also corrects the stale prxwork/ in the non-loopback warning and in the --root help line, because both sit in clauses it rebrands anyway."
  ```

  - [x] 5.1 Rename the product in the bind-failure message
    ```yaml
    description: "src/server.ts's server error listener names FlowCharge."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/server.ts
        <<<<<<< SEARCH
            console.error(`Praxis Dashboard could not bind ${host}:${port}:`, err);
        =======
            console.error(`FlowCharge could not bind ${host}:${port}:`, err);
        >>>>>>> REPLACE
    pattern: "src/server.ts line 888 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy acceptance criterion 5. The listener still rejects serverReady with the original error."
    gotcha: "Do not narrow the listener to one error code and do not change the reject(err) call. The template placeholders ${host} and ${port} must survive."
    verify:
      - "npm run build"
      - "grep -n 'could not bind' src/server.ts — names FlowCharge."
    checklist:
      - "Does the bind-failure line name FlowCharge?"
      - "Are the ${host} and ${port} placeholders intact?"
      - "Is reject(err) unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 5.2 Rename the product in the startup message
    ```yaml
    description: "src/server.ts's listen callback logs FlowCharge running at the bound address."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/server.ts
        <<<<<<< SEARCH
            console.log(`Praxis Dashboard running at http://${host}:${port}`);
        =======
            console.log(`FlowCharge running at http://${host}:${port}`);
        >>>>>>> REPLACE
    pattern: "src/server.ts line 899 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy acceptance criterion 5."
    gotcha: "The resolve() call above this line reads the port back from address(); leave it alone. Only the log string changes."
    verify:
      - "npm run build"
      - "npm start, then read the last console line before the process settles — it reads 'FlowCharge running at http://127.0.0.1:4173'. npm start runs prestart (the whole build) first, so build output precedes it. 127.0.0.1 and 4173 are src/server.ts's defaults at lines 30-31. Stop the server afterwards."
    checklist:
      - "Does the startup line name FlowCharge?"
      - "Is the URL still built from ${host} and ${port}?"
      - "Is the resolve() call unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 5.3 Rename the product and correct the folder in the non-loopback warning
    ```yaml
    description: "src/server.ts's non-loopback warning names FlowCharge and cites the flowcharge/ folder."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/server.ts
        <<<<<<< SEARCH
                `WARNING: bound to ${host}, which is not loopback-only — this dashboard is now ` +
                `reachable from other devices on the network. There is no authentication: any ` +
                `device that can reach ${host}:${port} can read every registered project's ` +
                `prxwork/ content and can add, rename, or remove project registry entries. ` +
        =======
                `WARNING: bound to ${host}, which is not loopback-only — FlowCharge is now ` +
                `reachable from other devices on the network. There is no authentication: any ` +
                `device that can reach ${host}:${port} can read every registered project's ` +
                `flowcharge/ content and can add, rename, or remove project registry entries. ` +
        >>>>>>> REPLACE
    pattern: "src/server.ts lines 902-905, inside the isLoopbackHost guard."
    imports: "None."
    compatibility: "PLN-71-lo4omy stage 5, which folds the stale prxwork/ into this stage because it sits in a clause the stage rebrands anyway."
    gotcha: "This is a warning about real network exposure — no part of its meaning may soften. The final line about paths resolving on THIS machine's filesystem stays as found, and the isLoopbackHost condition is unchanged."
    verify:
      - "npm run build"
      - "HOST=0.0.0.0 npm start, then read the warning — it names FlowCharge and flowcharge/ content. Stop the server afterwards."
    checklist:
      - "Does the warning name FlowCharge instead of 'this dashboard'?"
      - "Does it cite flowcharge/ content?"
      - "Is the 'no authentication' clause word-for-word intact?"
      - "Is the isLoopbackHost guard unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 5.4 Rename the product in the extractor's help text
    ```yaml
    description: "src/scripts/extract-praxis-data.ts's usage banner names FlowCharge and the flowcharge/ folder."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/scripts/extract-praxis-data.ts
        <<<<<<< SEARCH
        Praxis Dashboard — standalone data extractor

        Writes a project's Praxis state to a JSON file. The dashboard does not read this
        file: it extracts each registered project's data live through the server.

          npm run refresh -- --root <project-dir> [--out <file.json>]

          --root   Path to the project containing a prxwork/ folder (required)
        =======
        FlowCharge — standalone data extractor

        Writes a project's FlowCharge state to a JSON file. The app does not read this
        file: it extracts each registered project's data live through the server.

          npm run refresh -- --root <project-dir> [--out <file.json>]

          --root   Path to the project containing a flowcharge/ folder (required)
        >>>>>>> REPLACE
    pattern: "src/scripts/extract-praxis-data.ts lines 32-39, inside usage()'s template literal."
    imports: "None."
    compatibility: "PLN-71-lo4omy acceptance criterion 5 and stage 5, which includes the stale prxwork/ in the --root help line."
    gotcha: "The script's own filename extract-praxis-data.ts is structural and must not be renamed. The --out line below the edited region and the column alignment of the option descriptions stay as found."
    verify:
      - "npm run build"
      - "npm run refresh -- --help — the banner reads 'FlowCharge — standalone data extractor' and the --root line says flowcharge/."
    checklist:
      - "Does the banner name FlowCharge?"
      - "Does the --root help line say flowcharge/?"
      - "Is the word 'dashboard' gone from the usage text?"
      - "Is the file still named extract-praxis-data.ts?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 6. FlowCharge Core naming (plan stage 6)

  ```yaml
  description: "The sibling skill suite gets its new name, including the four fetch-failure strings the integrations dialog surfaces. Per Decision rule 3, 'FlowCharge Core' is introduced in exactly these places."
  ```

  - [x] 6.1 Rename the suite in the skill-fetch module header
    ```yaml
    description: "src/lib/skill-content-fetch.ts's opening comment names the FlowCharge Core skill suite."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/lib/skill-content-fetch.ts
        <<<<<<< SEARCH
        // Fetches the Praxis skill suite live from the self-hosted Gitea instance's
        =======
        // Fetches the FlowCharge Core skill suite live from the self-hosted Gitea instance's
        >>>>>>> REPLACE
    pattern: "src/lib/skill-content-fetch.ts line 1 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy Decision rule 3."
    gotcha: "PRAXIS_REPO_BASE_URL on line 38 is out of scope and must not change — the sibling repo is still literally named Praxis at that URL, and changing the constant breaks the fetch. The plan flags this as a live coupling, not a defect to fix here."
    verify:
      - "npm run build"
      - "grep -n 'FlowCharge Core skill suite' src/lib/skill-content-fetch.ts — one hit on line 1."
    checklist:
      - "Does line 1 name the FlowCharge Core skill suite?"
      - "Is PRAXIS_REPO_BASE_URL unchanged?"
      - "Is the rest of the header comment unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 6.2 Rename the suite in the four fetch-failure strings
    ```yaml
    description: "The four user-visible error strings in src/lib/skill-content-fetch.ts say 'FlowCharge Core skill archive'."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/skill-content-fetch.ts, replace 'Praxis skill archive' with 'FlowCharge Core skill archive' in exactly four throw sites: the Content-Length cap in readCappedBody (line 188), the missing-body error in readCappedBody (line 194), the streamed-size cap in readCappedBody (line 208), and the non-ok response error in getInstallContent (line 226)."
      - "Change nothing else in these statements: the byte counts, the ${maxBytes}, ${declared}, ${res.status} and ${res.statusText} placeholders, and the surrounding control flow all stay."
      - "These are the only strings in this module a user reads. getInstallContent throws, the installSelected IPC handler catches and returns the message as a failed PraxisIpcResult, unwrapIpc rethrows it, and src/public/home.ts:688 shows it in a window.alert reading \"Couldn't install the selected tools. Detail: <message>\". That alert is the surface, not the dialog's own error box — renderIntegrationsFailure serves the tool-detection path only."
    pattern: "src/lib/skill-content-fetch.ts lines 188, 194, 208 and 226."
    imports: "None."
    compatibility: "PLN-71-lo4omy acceptance criterion 6 and Decision rule 3. The wording is 'skill archive', not 'skill suite': these four strings describe the downloaded tarball, and task 6.1 covers the module header that names the suite."
    gotcha: "Four separate locations in one file — a blind single-occurrence replace leaves three behind. The reader.cancel() before the streamed-size throw must stay, or the connection stays open behind the abandoned read."
    verify:
      - "npm run build"
      - "grep -c 'FlowCharge Core skill archive' src/lib/skill-content-fetch.ts — returns 4; grep -c 'Praxis skill archive' src/lib/skill-content-fetch.ts — returns 0."
      - "Optional manual check, editing nothing: with the Gitea host at PRAXIS_REPO_BASE_URL unreachable, open Manage integrations, tick a tool and press Install selected. The alert names the FlowCharge Core skill archive."
    checklist:
      - "Do all four error strings name the FlowCharge Core skill archive?"
      - "Are all template placeholders and byte counts unchanged?"
      - "Is the await reader.cancel() call still before its throw?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 6.3 Rename the suite in the canonical-skills header, branding word only
    ```yaml
    description: "src/lib/agentic-tools-canonical-skills.ts line 1 names the FlowCharge Core skill suite, and lines 2-4 stay byte-for-byte."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/lib/agentic-tools-canonical-skills.ts
        <<<<<<< SEARCH
        // Provisional, hand-maintained duplicate of the canonical Praxis skill suite.
        =======
        // Provisional, hand-maintained duplicate of the canonical FlowCharge Core skill suite.
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-canonical-skills.ts line 1 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy per-file decision record and open question 1, resolved as a deferral: only line 1's branding word changes."
    gotcha: "Lines 2-4 must not be touched. They quote WS-44-h5cpzp's title verbatim as a citation, and its status clause is stale in a way this workstream deliberately does not correct — writing 'status: done' would be a fabrication. The CANONICAL_PRAXIS_SKILL_IDS identifier and every id in the array also stay."
    verify:
      - "npm run build"
      - "git diff --unified=0 src/lib/agentic-tools-canonical-skills.ts — exactly one changed line, and it is line 1."
    checklist:
      - "Does line 1 name the FlowCharge Core skill suite?"
      - "Are lines 2-4 byte-for-byte as found, including the quoted WS-44 title and the status clause?"
      - "Is CANONICAL_PRAXIS_SKILL_IDS and its array unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 6.4 Rename the suite in the skill-presence header
    ```yaml
    description: "src/lib/agentic-tools-skill-presence.ts's opening comment names the canonical FlowCharge Core skill suite."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/lib/agentic-tools-skill-presence.ts
        <<<<<<< SEARCH
        // Real filesystem presence detection for the canonical Praxis skill suite,
        =======
        // Real filesystem presence detection for the canonical FlowCharge Core skill suite,
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-skill-presence.ts line 1 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy Decision rule 3."
    gotcha: ".praxis-installs.json on line 3 is a structural filename read back as data and must not change."
    verify:
      - "npm run build"
      - "grep -n 'FlowCharge Core skill suite' src/lib/agentic-tools-skill-presence.ts — one hit on line 1."
    checklist:
      - "Does line 1 name the canonical FlowCharge Core skill suite?"
      - "Is .praxis-installs.json unchanged?"
      - "Is the read-only note about FsAccess unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 7. Source comment branding (plan stage 7)

  ```yaml
  description: "Developer-facing prose only. No comment in these files names the product 'Praxis', 'Praxis Board', 'Praxis Dashboard' or 'the dashboard'. Under Decision rule 2, a comment's prxwork/ folder name is never rewritten."
  ```

  - [x] 7.1 Drop the branding noun from the app.ts id-suffix comment
    ```yaml
    description: "src/public/app.ts's workstream-id comment says 'this app's own prxwork/ tree', leaving the factual clause as found."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/public/app.ts
        <<<<<<< SEARCH
          // must stay OPTIONAL, because this dashboard's own prxwork/ tree holds both
        =======
          // must stay OPTIONAL, because this app's own prxwork/ tree holds both
        >>>>>>> REPLACE
    pattern: "src/public/app.ts line 27 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy Decision rule 2, which states this exact wording: the branding word goes and the factual clause is left exactly as found."
    gotcha: "Do not rewrite prxwork/ to flowcharge/ here. That rewrite would make the comment false — flowcharge/ holds zero bare ids (228 suffixed ids at the time of writing), so it would no longer justify the optional suffix group. The comment is in fact already false about this repo, because no bare id exists anywhere in it; correcting that is a separate workstream and this task changes the branding noun only. The comment on line 1207 about the board rendering one project at a time also stays, and so does the \": 'Board';\" fallback on line 1251."
    verify:
      - "npm run build"
      - "sed -n '25,31p' src/public/app.ts — reads \"this app's own prxwork/ tree\" and still says the group must stay OPTIONAL."
    checklist:
      - "Does the comment say \"this app's own prxwork/ tree\"?"
      - "Is the folder name still prxwork/?"
      - "Is the regex and its non-capturing suffix group unchanged?"
      - "Are lines 1207 and 1251 untouched?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 7.2 Rename the product in the detail library header
    ```yaml
    description: "src/lib/detail.ts's header comment says it knows FlowCharge markdown structure."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/lib/detail.ts
        <<<<<<< SEARCH
        // payload — nothing here feeds /api/projects/<id>/data. Knows Praxis markdown
        =======
        // payload — nothing here feeds /api/projects/<id>/data. Knows FlowCharge markdown
        >>>>>>> REPLACE
    pattern: "src/lib/detail.ts line 3 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy acceptance criterion 7."
    gotcha: "The /api/projects/<id>/data route name in the same sentence is a real route and stays."
    verify:
      - "npm run build"
      - "grep -n 'Praxis' src/lib/detail.ts — zero hits."
    checklist:
      - "Does the comment say 'Knows FlowCharge markdown structure'?"
      - "Is the API route name unchanged?"
      - "Is the rest of the header comment unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 7.3 Rename the product in the extract.ts id-suffix comment
    ```yaml
    description: "src/lib/extract.ts line 57 calls it a FlowCharge artefact id, and line 62's stale prxwork/ clause stays untouched."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/lib/extract.ts
        <<<<<<< SEARCH
        // The optional final segment of a Praxis artefact id: `TYPE-N` became
        =======
        // The optional final segment of a FlowCharge artefact id: `TYPE-N` became
        >>>>>>> REPLACE
    pattern: "src/lib/extract.ts line 57 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy Decision rule 2 and its per-file decision record, which excludes src/lib/extract.ts:62 from every stage."
    gotcha: "Line 62 (\"this project's own prxwork/ tree holds bare and suffixed ids together\") is in the same comment block and carries no branding. It is explicitly out of scope — leave it exactly as found, stale fact and all. The ID_SUFFIX constant and its value do not change."
    verify:
      - "npm run build"
      - "git diff --unified=0 src/lib/extract.ts — exactly one changed line, and it is line 57."
    checklist:
      - "Does line 57 say 'a FlowCharge artefact id'?"
      - "Is line 62's prxwork/ clause byte-for-byte as found?"
      - "Is the ID_SUFFIX value unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 7.4 Drop 'the dashboard' from the ambient payload declarations
    ```yaml
    description: "src/types/praxis-data.d.ts's header comment no longer calls the product 'the dashboard'."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/types/praxis-data.d.ts
        <<<<<<< SEARCH
        // writes and the dashboard reads. Shared by both compilations without an import
        =======
        // writes and the app reads. Shared by both compilations without an import
        >>>>>>> REPLACE
    pattern: "src/types/praxis-data.d.ts line 2 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy acceptance criterion 7 and the closing grep, which requires zero hits for 'the dashboard'."
    gotcha: "This file must stay a script, not a module. Add no import and no export — a top-level import here would stop the interfaces being global. The filename praxis-data.d.ts and the PraxisData interface names are structural and stay."
    verify:
      - "npm run build"
      - "grep -n 'dashboard' src/types/praxis-data.d.ts — zero hits."
    checklist:
      - "Is the phrase 'the dashboard' gone from this file?"
      - "Are the PraxisData interface names unchanged?"
      - "Is the file still free of any top-level import or export?"
      - "Does npm run build pass for both compilations?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 7.5 Drop 'the dashboard' from the self-entry comment
    ```yaml
    description: "src/lib/projects.ts's selfEntry comment no longer calls this repo 'the dashboard repo'."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/lib/projects.ts
        <<<<<<< SEARCH
        // The dashboard repo is its own first project, built through the same id and name
        =======
        // This app's repo is its own first project, built through the same id and name
        >>>>>>> REPLACE
    pattern: "src/lib/projects.ts line 30 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy acceptance criterion 7 and its per-file decision record, which excludes src/lib/projects.ts:5."
    gotcha: "Line 5 names prxwork as a parsing concern, carries no branding, and is explicitly out of scope. The path.basename(resolved) tile name on line 37 also stays, along with the path.resolve(repoRoot) on line 34 that feeds it: the home tile reads 'Praxis-Dashboard' only because the checkout folder is named that, and the plan records this as expected residue, not an acceptance failure."
    verify:
      - "npm run build"
      - "git diff --unified=0 src/lib/projects.ts — exactly one changed line, and it is line 30."
    checklist:
      - "Does the comment avoid the phrase 'the dashboard'?"
      - "Is line 5 byte-for-byte as found?"
      - "Is the basename-derived tile name logic unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 7.6 Rename the product in the extract test header
    ```yaml
    description: "src/lib/extract.test.ts's header comment says FlowCharge ids."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/lib/extract.test.ts
        <<<<<<< SEARCH
        // Unit tests for the id-shape compatibility rules in extract.ts. Praxis ids
        =======
        // Unit tests for the id-shape compatibility rules in extract.ts. FlowCharge ids
        >>>>>>> REPLACE
    pattern: "src/lib/extract.test.ts line 1 only."
    imports: "None."
    compatibility: "PLN-71-lo4omy Testing strategy: no test asserts any string this plan changes, so no assertion is edited — only this comment."
    gotcha: "Change no assertion, no case name and no expected value. Both id shapes (TYPE-N and TYPE-N-SUFFIX) must still be asserted."
    verify:
      - "npm run build"
      - "git diff --unified=0 src/lib/extract.test.ts — exactly one changed line, and it is line 1."
    checklist:
      - "Does line 1 say 'FlowCharge ids'?"
      - "Is every assertion and case name unchanged?"
      - "Are both id shapes still covered?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 7.7 Run the closing regression check for the whole sweep
    ```yaml
    description: "Prove the sweep is complete and structural: the branding grep returns zero hits, the build passes, and the diff carries only string, comment and Markdown edits."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run the plan's closing grep over src, electron, README.md and package.json for the four branding phrases. It must return zero hits, which means a non-zero exit status from grep. The fourth phrase is '[Tt]he dashboard', not 'the dashboard': src/lib/projects.ts:30 reads 'The dashboard repo' with a capital T, so a plain case-sensitive 'the dashboard' would pass even if task 7.5 had been skipped."
      - "Run npm run build. A pass proves every structural Praxis* identifier still resolves, because none of them was renamed."
      - "Read git diff for the whole sweep and confirm every hunk is a string literal, a comment or Markdown. If any hunk touches an identifier, a file name, a CSS class, an API route, a data field, appId or a URL constant, revert that hunk."
      - "Confirm the two by-design residues are still present and are not treated as failures: the home-page tile named from path.basename(repoRoot), and the gitignored .praxis-projects.json entries."
    pattern: "Repository-wide check. No file is edited by this task unless the diff review finds a structural change to revert."
    imports: "None."
    compatibility: "PLN-71-lo4omy Testing strategy and acceptance criterion 8."
    gotcha: "Keep the grep case-sensitive apart from the one bracketed initial in '[Tt]he dashboard'. A fully case-insensitive run matches package.json's name field (praxis-dashboard) and src/public/styles.css line 105 ('the original dashboard's page background'), both of which the plan keeps on purpose; neither matches the bracketed pattern, because 'the' is followed by 'original' there. Run this only after tasks 1 to 7.6 are done."
    verify:
      - "grep -rn -e 'Praxis Dashboard' -e 'Praxis Board' -e 'PraxisBoard' -e '[Tt]he dashboard' src electron README.md package.json — zero hits."
      - "npm run build — passes."
      - "git diff --stat — lists only the files named by tasks 1 to 7.6."
    checklist:
      - "Does the four-phrase grep, with '[Tt]he dashboard' as its fourth pattern, return zero hits across src, electron, README.md and package.json?"
      - "Does npm run build pass?"
      - "Does the diff contain only string-literal, comment and Markdown changes?"
      - "Are package.json's name and appId, and every Praxis* identifier and filename, unchanged?"
      - "Are styles.css line 105 and the .gitignore Praxis-managed block unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

## Divergences

1. **`package.json`'s description carries no backticks.** The plan's Contracts section quotes
   the new description with the folder name in backticks (`` `flowcharge/` ``), because the plan
   renders as Markdown. The live string at `package.json:4`, read at `c768f6b`, uses no backticks
   anywhere. Task 3.1 therefore writes the folder name bare, so the field keeps its existing
   style; the wording is otherwise the plan's contract word for word.

2. **The plan was corrected before this list was reviewed.** A verification pass against the
   working tree found six facts in PLN-71-lo4omy that no longer matched, or never matched, the
   source. All six were fixed in the plan, and this list now follows the corrected plan:
   - Decision rule 2 said "three source comments" claim this repo's tree is `prxwork/`. Only two
     do — `src/public/app.ts:27` and `src/lib/extract.ts:62`. `src/lib/projects.ts:5` names
     `prxwork` as a parsing concern and makes no claim about id shapes.
   - Decision rule 2 said the bare ids "live in `prxwork-bak/`". They do not. No bare artefact id
     exists anywhere in this repo. The rule's conclusion is unchanged and in fact stronger: the
     comments are already false, so only their branding noun changes.
   - The suffixed-id count is 228, not 226. It grows as artefacts are added, so "zero bare ids"
     is the load-bearing half.
   - The home-tile expression is `path.basename(resolved)` at `src/lib/projects.ts:37`, not
     `path.basename(repoRoot)` at line 36.
   - The board heading markup is `<h1 class="tb-title" id="board-title">Board</h1>`; the plan
     quoted it without its class attribute.
   - Acceptance criteria 2, 6 and 7 each contradicted the plan's own Design or Assumptions. They
     now match: the board loading line names the local server rather than the product, the
     fetch-failure strings say "skill archive" and surface in a `window.alert` from
     "Install selected" rather than in the dialog's error box, and `src/public/styles.css:105` is
     named as criterion 7's one kept exception.

3. **The closing grep needed a bracketed initial.** The plan's regression grep used the
   case-sensitive phrase `the dashboard`, which misses `src/lib/projects.ts:30`
   ("The dashboard repo"). Both the plan and task 7.7 now use `[Tt]he dashboard`, which still
   excludes `praxis-dashboard` and styles.css line 105.

Every other file the plan cites matched the plan's assumptions at `c768f6b`, including all
remaining line numbers quoted in the stage list and the per-file decision record. The plan's
"427 structural hits" reconnaissance figure was not reproducible from the plan's own description
and was left as written; nothing in this list depends on it.

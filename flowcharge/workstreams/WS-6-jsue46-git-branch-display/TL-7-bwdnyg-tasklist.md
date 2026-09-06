---
id: TL-7-bwdnyg
type: tasklist
workstream: WS-6-jsue46
slug: git-branch-display
title: "Current git branch in the board masthead, read from .git/HEAD server-side"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: [PLN-6-3wzsc6]
links: []
mode: spec
base_commit: a439d4d
---

# PRX Tasks

## Current git branch in the board masthead

The board masthead says which project you are looking at and when its data was read, but not
which branch the project is on. PLN-6 adds that in three additive moves, with zero new
dependencies and no `child_process` anywhere.

1. **`src/lib/git.ts`** — a new pure library exporting exactly one function,
   `readBranch(root: string): string | null`, which resolves a project directory to its current
   branch name by reading `.git/HEAD` and returns `null` from every failure path instead of
   throwing. The branch name is literally the text in `HEAD` (`ref: refs/heads/<branch>`); the
   one non-trivial case — `.git` as a *file* holding a `gitdir:` pointer, covering both
   worktrees and submodules — is one extra hop.
2. **A transport-layer merge in `server.ts`'s existing data route.** `GET
   /api/projects/<id>/data` answers `{ ...extractPraxisData(entry.path), branch: readBranch(entry.path) }`.
   `extract.ts` and `PraxisData` are untouched, so the `npm run refresh` dump keeps its current
   shape byte for byte; the new field lives on an additive `BoardPayload extends PraxisData`.
3. **A third masthead line that hides itself when there is nothing to show.** `.meta`'s lines
   are joined by literal `<br>` tags, so the `<br>` goes *inside* the hideable span — absence
   then costs zero vertical space at `line-height: 1.6`. Same pattern `#lower` already uses.

Committed defaults carried from the plan, not open for re-litigation during execution: a
detached HEAD shows nothing (identical to no repository); the branch is a third line in `.meta`
and never appended to `#tagline` (which CSS uppercases and would mangle a case-sensitive branch
name); the label is literally `Branch <name>`; no feature flag or environment machinery.

Out of scope throughout: any git operation beyond the current branch name (no status, dirty
flag, ahead/behind, SHA, commit metadata, branch list or switching); live updates; any change to
`PraxisData`, `extract.ts`, `findProject`, `addProject`, `readProjects` or
`.praxis-projects.json`; the home page tiles; and anything belonging to the in-flight WS-5
detail work.

- [x] 1. Phase 1 — `readBranch` and the route field

  ```yaml
  description: "Add src/lib/git.ts, the BoardPayload interface, and the two-line merge in server.ts's data route. Dark-launched: the payload gains a field nothing reads yet."
  ```

  - [x] 1.1 Create `src/lib/git.ts` with `readBranch` as its only export
    ```yaml
    description: "New pure library resolving a project directory to its current branch name by reading .git/HEAD, returning null from every failure path."
    issues: []
    implement:
      - "Create the new file src/lib/git.ts. It imports only `fs` from 'node:fs' and `path` from 'node:path' — no other import, and under no circumstances `node:child_process`."
      - "Open the file with this header comment and export exactly this signature, verbatim from the plan: `// Git branch reader: resolves a project directory to the name of the branch its` / `// checkout is on, by reading .git/HEAD. Knows a filesystem path and git's on-disk` / `// HEAD format; knows nothing about the registry, the transport layer, flowcharge, or` / `// the board payload.` then `export function readBranch(root: string): string | null`."
      - "readBranch is the module's ONLY export. It must not know that projects have ids, that a registry exists, that an HTTP response is being assembled, or that a masthead will display the result. It takes a path and returns a string or null; nothing else."
      - "Algorithm step 1: `gitPath = path.join(path.resolve(root), '.git')`."
      - "Algorithm step 2: `fs.statSync(gitPath)` — if it is a **directory**, the git directory *is* `gitPath`."
      - "Algorithm step 3: if it is a **file**, read it and match `/^gitdir:\\s*(.+)$/m`. No match → `null`. Otherwise the git directory is `path.resolve(path.dirname(gitPath), captured.trim())`, which handles both the absolute pointer git normally writes and a legal relative one in a single call. This is one hop and ONLY one hop — a worktree's `…/.git/worktrees/<name>` and a submodule's `…/.git/modules/<name>` both contain a real `HEAD`, so there is no second pointer to chase."
      - "Algorithm step 4: read `<gitDir>/HEAD` as utf8, `.trim()`, and match `/^ref:\\s*refs\\/heads\\/(.+)$/`."
      - "Algorithm step 5: match → return capture group 1, trimmed (branch names may contain `/`, which `(.+)` keeps intact). No match → `null`. A bare 40-hex SHA (detached HEAD) falls into this branch by construction — that is the committed default, not an oversight. Do not special-case it, do not return a SHA, do not return a placeholder marker."
      - "Algorithm step 6: the ENTIRE body sits inside one `try { … } catch { return null }`. This is the same degradation contract readProjects() established in src/lib/projects.ts:39-52 — every failure mode returns a value, none throws, and the caller never needs a guard."
      - "readBranch logs nothing. A null is a normal, expected state, not an error, exactly as readProjects() logs nothing on its failure paths."
      - "Do not implement ref resolution, packed-refs handling, or any object-store read: the branch NAME is the text in HEAD and never needs resolving to a SHA."
      - "Do not add a size cap on the HEAD read (plan assumption 5), and add no special symlink handling — fs.statSync follows symlinks by default (assumption 4)."
    pattern: "src/lib/git.ts (new file, only file touched by this task)"
    imports: "node:fs and node:path only. No new package.json dependency. Explicitly NOT node:child_process, execSync or spawn."
    compatibility: "ESM with NodeNext resolution — the project is \"type\": \"module\" and sibling libs use `import fs from 'node:fs'`. Compiled by the Node-side tsconfig.json under strict + noEmitOnError, so the null-returning paths must satisfy the declared `string | null` return type on every branch. Mirror the single-responsibility header-comment style of src/lib/extract.ts and src/lib/projects.ts."
    gotcha: "A worktree's .git file pointer is absolute in git's normal output but is legal relative — path.resolve against path.dirname(gitPath) covers both, so do not path.join or assume absolute. `fs.statSync` throws ENOENT when there is no .git at all, which is why the whole body (not just the reads) must be inside the single try/catch. A branch name legitimately contains `/`, so the capture must be `(.+)` and must never be split. An empty HEAD, a chmod-000 HEAD, and garbage in HEAD must all return null rather than throw or return a partial string."
    verify:
      - "npm run build — completes with no type errors (tsc runs strict with noEmitOnError, so a build that emits is a build that type-checked)."
      - "grep -rn 'child_process\\|execSync\\|spawn' src/ tools/ — returns no matches, satisfying acceptance criterion 11."
      - "grep -c '^export' src/lib/git.ts — returns exactly 1."
      - "grep -n 'dependencies' package.json — still zero runtime dependencies and exactly two devDependencies, satisfying the rest of criterion 11."
    checklist:
      - "readBranch is the file's only export, and its signature is exactly `readBranch(root: string): string | null`"
      - "The whole function body is wrapped in one try/catch whose catch returns null, so no input can make it throw"
      - "The branch capture is `(.+)` and the returned value is never split on `/`"
      - "The gitdir: pointer is followed exactly one hop, resolved with path.resolve against path.dirname(gitPath)"
      - "No child_process, execSync or spawn appears anywhere in src/ or tools/, and no new dependency was added"
      - "The module contains no reference to project ids, the registry, HTTP, flowcharge, or the board payload, and logs nothing"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Add the `BoardPayload` interface to `src/types/praxis-data.d.ts`
    ```yaml
    description: "Additive ambient interface extending PraxisData with the branch field. PraxisData itself is not edited — that is the type-level guarantee that extractPraxisData and the CLI dump stay untouched."
    issues: []
    implement:
      - "Apply this SEARCH/REPLACE block to src/types/praxis-data.d.ts. It adds BoardPayload immediately below PraxisData and leaves PraxisData byte-identical:"
      - |
        src/types/praxis-data.d.ts
        <<<<<<< SEARCH
        interface PraxisData {
          generated: string;
          source: string;
          workstreams: PraxisWorkstream[];
          issues: PraxisIssue[];
        }
        =======
        interface PraxisData {
          generated: string;
          source: string;
          workstreams: PraxisWorkstream[];
          issues: PraxisIssue[];
        }

        // What the board route sends: the extractor's payload plus the fields the server
        // adds at the transport layer. PraxisData itself stays exactly what
        // extractPraxisData() returns and what `npm run refresh` dumps.
        interface BoardPayload extends PraxisData {
          branch: string | null;
        }
        >>>>>>> REPLACE
      - "Add nothing else to this file. In particular do not add a top-level import or export — that would turn the ambient declaration file into a module and every interface in it would stop being global, breaking both compilations."
    pattern: "src/types/praxis-data.d.ts only"
    imports: "None — ambient global declarations, consumed by both tsconfigs without an import on either side."
    compatibility: "`branch` must be `string | null` and always present on the response object, never optional: nullability is part of the route contract so a consumer can distinguish 'no branch' from 'old server'. Because branch lives on BoardPayload and not on PraxisData, tsc (strict, noEmitOnError) fails the build if the extractor or the CLI ever drifts into needing it."
    gotcha: "Editing PraxisData itself instead of extending it would break extractPraxisData's return type and would add a branch key to the npm run refresh dump — the exact regression acceptance criterion 8 exists to catch."
    verify:
      - "npm run build — completes with no type errors."
      - "grep -n -A 6 'interface PraxisData' src/types/praxis-data.d.ts — PraxisData still has exactly its four original fields (generated, source, workstreams, issues) and no branch key."
    checklist:
      - "BoardPayload extends PraxisData and declares `branch: string | null` as a required, non-optional field"
      - "PraxisData is byte-identical to before the edit"
      - "The file still contains no top-level import or export statement, so its interfaces remain ambient globals"
      - "npm run build type-checks clean under both tsconfigs"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.3 Merge `branch` into the data route in `src/server.ts`
    ```yaml
    description: "Import readBranch and merge branch: readBranch(entry.path) into the /api/projects/<id>/data response. Two lines; no other route or guard changes."
    issues: []
    implement:
      - "Edit 1 — the import. src/server.ts line 6 currently reads `import { readProjects, findProject, addProject } from './lib/projects.js';`. Add immediately after it, as its own line: `import { readBranch } from './lib/git.js';` — the .js extension is required, matching every sibling import in this file."
      - "Edit 2 — the response. Inside the `dataMatch` branch of handleApi, the single response line currently reads `      sendJson(res, 200, extractPraxisData(entry.path));` (server.ts:148, immediately after the hasPrxwork 410 guard). Replace that one line with these two, verbatim from the plan: `const payload: BoardPayload = { ...extractPraxisData(entry.path), branch: readBranch(entry.path) };` then `sendJson(res, 200, payload);` — both at the same six-space indentation as the line they replace."
      - "`entry.path` — the absolute, path.resolve'd path already in hand from findProject(id) — is the ONLY root ever passed to readBranch. projects.ts's module-level `repoRoot` constant is the DASHBOARD's own directory and must never be used here; doing so would make every project's board display the dashboard repo's branch and would break acceptance criterion 6."
      - "Introduce no new path resolution or validation. The route already 404s an unknown id and 410s a path that has lost its flowcharge/, and both guards run before this line."
      - "Leave the route's existing try/catch exactly as it is. It is now redundant for the branch read specifically (readBranch cannot throw), which is fine — it still guards extractPraxisData."
      - "Change nothing else in this file: the 404, 410, 405 and 500 responses stay unchanged in every respect, and no other route is touched."
    pattern: "src/server.ts only — the import block and the dataMatch branch of handleApi"
    imports: "readBranch from './lib/git.js'. BoardPayload needs NO import — it is an ambient global from src/types/praxis-data.d.ts, the same way ProjectList is already used unimported at server.ts:115."
    compatibility: "Response must gain exactly one new top-level key. generated, source, workstreams and issues keep their exact names, types and values — the spread puts branch last and cannot disturb them. The CLI path (npm run refresh → extract-praxis-data.ts → extractPraxisData) must be entirely unaffected."
    gotcha: "Fixture registration gotcha for the verify steps: a directory is only registerable as a project if it contains a flowcharge/ folder — hasPrxwork gates both POST /api/projects and the data route's 410. So `mkdir -p <fixture>/flowcharge` in every fixture, including the plain non-git one. A bare empty flowcharge/ is enough; extractPraxisData returns empty workstreams and issues and still answers 200. Also: omitting the `.js` extension on the git import compiles but fails at runtime under ESM."
    verify:
      - "npm run build, then npm start (server listens on http://localhost:4173)."
      - "Build the scratch fixture tree OUTSIDE this repo, four directories, each with a `mkdir -p <dir>/flowcharge`: (a) a normal checkout on a slash-containing branch — `git init`, an empty commit, `git checkout -b feature/ws-6-git-branch-display`; (b) a linked worktree — `git -C <a> worktree add <b> -b wt-branch`, then `mkdir -p <b>/flowcharge`; (c) a checkout on a detached HEAD — `git init`, a commit, `git checkout $(git rev-parse HEAD)`; (d) a plain directory with no .git at all."
      - "Register each: `curl -s -X POST localhost:4173/api/projects -H 'Content-Type: application/json' -d '{\"path\":\"<abs fixture path>\"}'` and keep each returned project id."
      - "For each of the four: `curl -s -o /dev/null -w '%{http_code}\\n' localhost:4173/api/projects/<id>/data` returns 200, and `curl -s localhost:4173/api/projects/<id>/data | head -c 400` shows (a) \"branch\":\"feature/ws-6-git-branch-display\" in full with its slash intact, (b) \"branch\":\"wt-branch\" — the worktree's own branch, not the main checkout's, (c) \"branch\":null for the detached HEAD, (d) \"branch\":null for the plain directory. This is acceptance criteria 4, 5 and 6."
      - "Corruption cases against the same fixtures, one at a time: point the worktree's .git file `gitdir:` at a deleted path; `chmod 000` a HEAD; truncate a HEAD to empty; write junk into a HEAD. After each, the same curl returns 200 with \"branch\":null and the server process is still up (acceptance criterion 9). Restore the fixture between cases."
      - "Diff the response against a pre-change capture: the four existing keys generated, source, workstreams and issues are byte-identical, and `branch` is the only new top-level key (acceptance criterion 7)."
      - "npm run refresh -- --root . then inspect the written JSON — it has NO branch key (acceptance criterion 8)."
      - "Open a board in the browser — it renders exactly as before, since nothing reads the new field yet."
    checklist:
      - "The response gains exactly one new top-level key, `branch`, whose value is a non-empty string or null; the other four keys are unchanged in name, type and content"
      - "readBranch is called with entry.path and never with projects.ts's repoRoot, so no project shows the dashboard repo's branch"
      - "All four fixtures and all four corruption cases return 200 and the server process stays up throughout"
      - "The npm run refresh dump still has no branch key"
      - "The 404, 410, 405 and 500 branches, the existing try/catch, and every other route are unchanged"
      - "The git import carries the .js extension and BoardPayload is used without an import"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — The masthead line

  ```yaml
  description: "Render the branch as a third line in the board masthead's .meta block, hiding itself with its own line break when there is no branch. Depends on task 1 — the payload field must exist first."
  ```

  - [x] 2.1 Add the `#branch-line` markup to `src/public/board.html`
    ```yaml
    description: "Third .meta line, shipped hidden, with the <br> INSIDE the hideable span so absence costs zero vertical space."
    issues: []
    implement:
      - "Apply this SEARCH/REPLACE block to src/public/board.html — the .meta block of the masthead:"
      - |
        src/public/board.html
        <<<<<<< SEARCH
          <div class="meta">
            Data generated <strong id="gen-date">—</strong><br>
            <span id="meta-counts"></span>
          </div>
        =======
          <div class="meta">
            Data generated <strong id="gen-date">—</strong><br>
            <span id="meta-counts"></span>
            <span id="branch-line" style="display:none"><br>Branch <strong id="branch-name"></strong></span>
          </div>
        >>>>>>> REPLACE
      - "THE LOAD-BEARING DETAIL: the `<br>` is INSIDE `#branch-line`, before the word `Branch`. Hiding the span therefore removes the line break with it, so absence costs zero vertical space. The naive `<br><span id=\"branch-line\" style=\"display:none\">…</span>` would leave a visible blank gap at line-height: 1.6. Do not 'tidy' the markup by moving the <br> out."
      - "Ship the span with style=\"display:none\" in the markup. That is what makes the pre-boot state and every error path correct with no extra code, and is the same pattern #lower already uses at board.html:54."
      - "The label text is literally `Branch ` followed by the value in a <strong>. Do not reword it."
      - "Add no CSS. .masthead .meta and .masthead .meta strong (styles.css:157-164) already style the label and the emphasised value correctly. Do not touch src/public/styles.css."
      - "Do not touch #tagline. The branch never goes there — .tagline is text-transform: uppercase and would mangle a case-sensitive branch name."
    pattern: "src/public/board.html only — the .meta block in the masthead"
    imports: "None."
    compatibility: "board.html is copied verbatim into dist/public/ by tools/copy-assets.mjs during npm run build — there is no template step, so the served markup is exactly this text. The new ids #branch-line and #branch-name must not collide with any existing id in the document."
    gotcha: "The whitespace between </span> and the new <span> collapses to a single trailing space at the end of the counts line and is discarded at line-end in normal white-space processing — no visual effect in the right-aligned block. The failure mode this markup guards against (a blank line at line-height: 1.6) is invisible in the DOM and visible only on screen, so it must be checked visually, not by inspecting elements."
    verify:
      - "npm run build, then confirm the same markup landed in dist/public/board.html: grep -n 'branch-line' dist/public/board.html shows the <br> inside the span."
      - "grep -c 'id=\"branch-line\"\\|id=\"branch-name\"' src/public/board.html returns 2, and neither id appears anywhere else in the document."
      - "git diff --stat src/public/styles.css — no change, confirming no CSS was added."
      - "Before this task's edit, screenshot the masthead of the no-.git fixture's board. After the edit and task 2.2, screenshot it again and compare: identical masthead height, no gap, no stray blank line (acceptance criterion 3)."
    checklist:
      - "The <br> sits inside #branch-line, before the word Branch, not before the span"
      - "#branch-line ships with style=\"display:none\" in the markup, so the pre-boot and error paths need no extra handling"
      - "The label reads exactly `Branch ` with the value in a <strong id=\"branch-name\">"
      - "No CSS was added or changed, and #tagline is untouched"
      - "The no-.git board's masthead is visually identical to before, with no blank gap"
    self_eval:
      passed: true
      failures: []
      notes: "SEARCH block matched src/public/board.html exactly despite the WS-5 merge (WS-5 added the #ws-modal dialog lower in the document, leaving the .meta block untouched); applied verbatim. Verify-step wording is off by one on the id count: `grep -c 'id=\"branch-line\"\\|id=\"branch-name\"'` returns 1, not 2, because grep -c counts matching LINES and both ids sit on the same line. `grep -o … | wc -l` returns 2, and each id appears exactly once in the document, so the intent of the step is satisfied. Before/after masthead measured on the no-.git fixture board: masthead 138.375px and .meta 36.78125px both before and after, byte-identical, no blank gap."
    ```
  - [x] 2.2 Render the branch in `src/public/app.ts`
    ```yaml
    description: "Widen boot's parameter to BoardPayload and add the three-line branch block immediately after the #meta-counts write."
    issues: []
    implement:
      - "Apply this SEARCH/REPLACE block to src/public/app.ts. It covers both edits — the signature and the new block — in one contiguous region:"
      - |
        src/public/app.ts
        <<<<<<< SEARCH
          function boot(raw: PraxisData) {
            var workstreams = raw.workstreams || [];
            var issues = raw.issues || [];

            byId('gen-date').textContent = raw.generated || '—';
            byId('tagline').textContent = raw.source
              ? 'Workstream state · ' + raw.source.split('/').pop()
              : 'Workstream state';
            byId('meta-counts').textContent =
              workstreams.length + ' workstreams · ' + issues.length + ' issues';
            byId('lower').style.display = '';
        =======
          function boot(raw: BoardPayload) {
            var workstreams = raw.workstreams || [];
            var issues = raw.issues || [];

            byId('gen-date').textContent = raw.generated || '—';
            byId('tagline').textContent = raw.source
              ? 'Workstream state · ' + raw.source.split('/').pop()
              : 'Workstream state';
            byId('meta-counts').textContent =
              workstreams.length + ' workstreams · ' + issues.length + ' issues';
            if (raw.branch) {
              byId('branch-name').textContent = raw.branch;
              byId('branch-line').style.display = '';
            }
            byId('lower').style.display = '';
        >>>>>>> REPLACE
      - "The falsy check covers both null and the empty string, so the client needs no knowledge of git at all — it renders a string if it got one. Add no git-specific client logic, no SHA detection, no placeholder text, no formatting."
      - "textContent, not innerHTML — it keeps the branch name inert as text and renders slashes verbatim, which is what acceptance criterion 2 requires."
      - "#gen-date, #tagline and #meta-counts behaviour must be untouched. In particular the branch value is never split on '/' the way raw.source is."
      - "Change nothing else in app.ts. The failure path needs no handling: #branch-line is hidden in the markup, so an unknown project or network error simply never un-hides it."
    pattern: "src/public/app.ts only — the boot() function's masthead writes"
    imports: "None. BoardPayload is an ambient global from src/types/praxis-data.d.ts, already visible to the browser tsconfig the same way PraxisData is today."
    compatibility: "Compiled by src/public/tsconfig.json, which sets \"types\": [] — no Node globals are available here, so use nothing beyond DOM APIs. byId() returns HTMLElement via a non-null assertion, so .style is available without a cast. The file's existing style is var-declared, ES5-flavoured DOM code inside one IIFE — match it."
    gotcha: "Widening the parameter to BoardPayload is what makes the compiler the unit test for the contract: with strict + noEmitOnError, any mismatch between what the server sends and what boot() reads becomes a build failure. Placing the new block after byId('lower').style.display instead of after #meta-counts still works but drifts from the plan — keep it in the masthead group."
    verify:
      - "npm run build — completes with no type errors, and dist/public/app.js contains the branch block."
      - "npm start, open the dashboard's own board at /board.html?project=<id> — the masthead's right block shows a third line reading `Branch <name>`, styled like the generated date, and the name matches `git branch --show-current` run in this repo (acceptance criterion 1)."
      - "Check out a branch whose name contains '/', reload, and confirm the full name renders with the slash intact and nothing truncated (acceptance criterion 2)."
      - "Open the no-.git fixture's board and compare against the screenshot taken in task 2.1: identical masthead, no gap, no stray blank line (acceptance criterion 3)."
      - "Open the worktree fixture's board — its own branch shows, not the main checkout's (acceptance criterion 4)."
      - "Open two projects sitting on different branches in two tabs — each shows its own, and neither shows the dashboard repo's branch (acceptance criterion 6)."
      - "Open /board.html?project=nonexistent — the existing guidance panel appears, no branch line is visible, and the browser console shows no error from the branch code (acceptance criterion 10)."
    checklist:
      - "boot's parameter is BoardPayload and the file still compiles clean with \"types\": []"
      - "The branch is written with textContent and is never split, truncated or reformatted, so a slash-containing name renders in full"
      - "The un-hide happens only when raw.branch is truthy, so null and empty string both leave the line hidden"
      - "#gen-date, #tagline and #meta-counts render exactly as before"
      - "The error and unknown-project paths show the guidance panel with no branch line and no console error"
      - "Two projects on different branches each show their own branch"
    self_eval:
      passed: true
      failures: []
      notes: "SEARCH block matched src/public/app.ts exactly despite the WS-5 merge (WS-5's additions sit outside boot()'s masthead group); applied verbatim, block placed after the #meta-counts write as specified. npm run build clean under both tsconfigs. Browser pass: dashboard board shows `Branch feature/ws-6-git-branch-display` with the slash intact (branch-name is a single text node, nodeType 3, exact string match, confirming textContent not innerHTML); worktree fixture shows its own `wt-branch`; detached-HEAD and no-.git fixtures leave the line hidden at the baseline .meta height of 36.78125px; LAD (develop) and Praxis (master) open in two tabs simultaneously each show their own branch and neither shows the dashboard's; /board.html?project=nonexistent shows the guidance panel with the line hidden and no JS error (the only console entry is the pre-existing 404 resource log from the data fetch)."
    ```

- [x] 3. Phase 3 — List `src/lib/git.ts` in the README file tree
  ```yaml
  description: "Add one line for src/lib/git.ts to the README's 'How it fits together' tree, alongside extract.ts and projects.ts."
  issues: []
  implement:
    - "Apply this SEARCH/REPLACE block to README.md, inside the 'How it fits together' code fence:"
    - |
      README.md
      <<<<<<< SEARCH
      │   ├── lib/
      │   │   ├── extract.ts               pure extraction library — flowcharge/ → PraxisData
      │   │   └── projects.ts              the project registry: read, find, add
      =======
      │   ├── lib/
      │   │   ├── extract.ts               pure extraction library — flowcharge/ → PraxisData
      │   │   ├── git.ts                   current branch reader — .git/HEAD → branch name
      │   │   └── projects.ts              the project registry: read, find, add
      >>>>>>> REPLACE
    - "Keep the description column aligned with the neighbouring lines: the descriptions all start at the same column, so `git.ts` is followed by 19 spaces."
    - "Change nothing else in README.md — no other section, and no other line of the tree."
  pattern: "README.md only — the 'How it fits together' tree, the src/lib/ subtree"
  imports: "None."
  compatibility: "The tree uses box-drawing characters and a fixed description column; the last entry in each subtree carries └── and every earlier one ├──, so extract.ts stays ├──, git.ts becomes ├──, and projects.ts keeps └──."
  gotcha: "Copy the box-drawing characters exactly rather than retyping them — they are U+2502/U+251C/U+2514, not ASCII pipes and dashes, and a retyped line will look right in a diff while breaking the tree in a monospace render."
  verify:
    - "Read the rendered tree and confirm it lists every file that exists under src/lib/ on disk: compare `ls src/lib/` against the three entries in the tree — extract.ts, git.ts, projects.ts, with nothing missing and nothing listed that does not exist."
    - "Confirm the descriptions of extract.ts, git.ts and projects.ts all begin at the same column in a monospace view, and that the ├──/└── connectors are correct for the subtree."
  checklist:
    - "src/lib/git.ts appears in the tree between extract.ts and projects.ts"
    - "Every file under src/lib/ on disk is listed, and nothing listed is absent from disk"
    - "The description column stays aligned and the box-drawing connectors are correct (├── on extract.ts and git.ts, └── on projects.ts)"
    - "No other line or section of README.md was changed"
  self_eval:
    passed: true
    failures:
      - item: "Every file under src/lib/ on disk is listed, and nothing listed is absent from disk"
        reason: "Half of this item no longer holds, through no fault of this task. Every entry the tree lists does exist on disk (extract.ts, git.ts, projects.ts), but src/lib/ now also contains detail.ts and yaml-block.ts, added by WS-5 (card detail modal) after this task list was authored. The verify step's premise — that `ls src/lib/` returns exactly three files — was true at authoring time and is no longer true."
        fix: "Not actioned here. The two missing lines are WS-5's own scope; this task's SEARCH/REPLACE block names only git.ts, and adding unrelated entries would be scope creep. Left for WS-5 or a later README pass."
    notes: "SEARCH text matched README.md lines 37-39 byte for byte; block applied verbatim, nothing else in README.md touched (git diff shows a single added line). Verified by codepoint dump rather than by eye: extract.ts and git.ts carry U+251C U+2500 U+2500, projects.ts carries U+2514 U+2500 U+2500, and all three descriptions start at column 37 — git.ts is followed by the specified 19 spaces. `npm run build` clean under both tsconfigs (unchanged by this doc-only edit, run as the workstream's type-check). Known divergence recorded in failures: src/lib/ holds five files on disk, not the three the verify step assumed."
  ```

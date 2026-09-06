---
id: TL-6-5xil57
type: tasklist
workstream: WS-5-kxteoh
slug: card-detail-modal-issues-tasks
title: "Card detail modal with Issues and Tasks tabs"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: [PLN-5-v06y5r]
links: []
mode: spec
base_commit: a439d4d
---

# PRX Tasks

## Card detail modal with Issues and Tasks tabs

Implements PLN-5. Clicking a workstream card on the board opens a native `<dialog>` showing that
workstream's full detail across exactly two tabs — Issues (from every `issuelist*.md` in its
folder) and Tasks (from every `tasklist*.md`) — with every entry rendered in full rather than
as a summary line.

The data travels a **completely separate path** from the board payload. A new route
`GET /api/projects/<projectId>/workstreams/<wsId>/detail` parses one workstream's artefact files
at request time and returns a detail-only payload. `PraxisData`, `PraxisIssue`,
`PraxisWorkstream`, `PraxisArtefact`, `extractPraxisData`, `walkWorkstreams` and `countChecks`
are untouched. The **only** edit anywhere in `src/lib/extract.ts` across this entire task list is
adding the keyword `export` to `parseFrontmatter` — nothing else, in any task. Byte-parity of
`/api/projects/<id>/data` is captured before Phase 1 starts and re-asserted in Phases 1 and 4;
that comparison is the proof, not the intention.

Two things carry the risk. First, the item bodies are YAML blocks in shapes `parseFrontmatter`
cannot read (block lists, nested maps, lists of maps), so a genuinely new parser is needed. It is
written in-repo, deliberately **not** `js-yaml` — this would be the project's first runtime
dependency ever, and the markdown layer around the fences is hand-written either way, so a
dependency would replace roughly 80 lines of a tightly-specified grammar over machine-authored
input. The accepted trade is that input outside the grammar degrades to a visible `_raw` block
rather than parsing correctly, which is why `_raw` is part of the contract rather than an
afterthought. Second, this repo's largest task list is 91KB / 966 lines / 32 tasks, so "render
every task in full" is a real volume problem: every item renders as a collapsed `<details>` whose
body is built lazily on first expand and never rebuilt.

**Committed decisions carried from the plan — build to these, do not re-litigate.** Two tabs with
per-file sections within each, never one tab per file (A1). Items only, never the file's narrative
preamble (A2). Every parsed YAML value is a string, no type coercion (A3). All new client code
goes in `src/public/app.ts`, because `src/public/tsconfig.json` sets `"module": "none"` and
client files cannot import each other (A5). No client-side caching of detail responses (A6). No
deep-linking, no browser-history integration, no modal state surviving a reload. No editing,
creating, closing or reordering anything from the modal — it is read-only. No change to board
rendering, layout, sorting or filtering. No test framework, linter or formatter, and no
`npm run lint` — this project has neither; verification is `npm run build` (tsc under `strict`
with `noEmitOnError`), curl assertions run through `node -e`, and browser checks against the named
real fixtures.

**Fixtures named below are real files in this repo, verified present at `base_commit`:**
`3c975ac5` is this repo's own project id in `.praxis-projects.json`; `a51ce5bc` is the separate
registered "Praxis" project, whose `WS-5` is a *different* workstream ("Canonical-source
portability across agentic coding tools") in a folder named `WS-5-cross-platform-adapter-layer` —
which makes it the project-scoping fixture and the differently-named-folder fixture at once.

Four phases, strictly ordered, each leaving `npm start` serving a working app.

- [x] 1. Phase 1 — End-to-end skeleton: route, resolution, dialog, tabs

  ```yaml
  description: "Build the whole path end to end with empty item arrays: the payload types, the export on parseFrontmatter, src/lib/detail.ts doing folder resolution and artefact classification only, the route with all five status codes, the <dialog> skeleton, its CSS, and the delegated listeners plus ARIA tab switching in app.ts. Every items/tasks array returns empty at this phase. Effort: medium. Depends on nothing."
  ```

  - [x] 1.1 Capture the pre-change `/api/projects/<id>/data` byte-parity baseline

    ```yaml
    description: "Before any file is edited, capture the current /data response for this project to a file outside the repo. This capture is the regression evidence for acceptance criterion 11 and is compared against in tasks 1.9 and 4.4. Without it taken first, the byte-parity claim is unprovable."
    issues: []
    implement:
      - "Ensure the working tree is at the state described by this file's base_commit (a439d4d) with no source edits applied yet."
      - "Run `npm run build && npm start` in one shell and leave it running; the server binds 127.0.0.1:4173."
      - "Capture the baseline to a path outside the repo so it cannot be committed or picked up by the extractor: `curl -s http://localhost:4173/api/projects/3c975ac5/data > /tmp/praxis-data-baseline.json`."
      - "Record the file's sha256 in this task's self_eval so the later comparisons have a value to quote even if the temp file is lost."
      - "Note the one field that legitimately varies: PraxisData.generated is `new Date().toISOString().slice(0, 10)` (src/lib/extract.ts:127), so a capture taken on a later calendar day differs by that date alone. Comparisons in 1.9 and 4.4 must be run same-day, or must diff with that single key normalised — never by relaxing the comparison generally."
    pattern: "No source file is modified by this task. Writes only /tmp/praxis-data-baseline.json."
    imports: "curl, sha256sum (or shasum -a 256 on macOS), a running `npm start`."
    compatibility: "The capture must be taken against the unmodified tree. Taking it after any edit to src/lib/extract.ts, src/server.ts or src/types/praxis-data.d.ts invalidates every downstream comparison."
    gotcha: "Do not capture into the repo — a stray .json under the project root is noise at best and picked up by a future extractor pass at worst. Also do not capture through the browser: a browser may pretty-print or re-order nothing but adds no guarantee of a raw body, whereas `curl -s` writes the exact bytes the server sent."
    verify:
      - "`test -s /tmp/praxis-data-baseline.json && echo OK` prints OK."
      - "`node -e \"const d=require('/tmp/praxis-data-baseline.json'); console.log(d.workstreams.length, d.issues.length)\"` prints `7 1` — this repo's 7 workstreams and its single ISS-1."
      - "`shasum -a 256 /tmp/praxis-data-baseline.json` — record the digest in self_eval."
    checklist:
      - "Was the capture taken with zero source edits applied to the working tree?"
      - "Does the captured file parse as JSON and report 7 workstreams and 1 issue?"
      - "Is the capture stored outside the repository tree?"
      - "Is its sha256 digest recorded in self_eval?"
      - "Is the `generated`-field caveat recorded so 1.9 and 4.4 do not misread a date change as a regression?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Baseline captured at base_commit a439d4d before any source edit; working tree clean apart from untracked bun.lock."
        - "sha256 66ae151ac336fc98054b7165cf4440732d6fb9bdac8ff725769d8d83d9d94990 — /tmp/praxis-data-baseline.json, parses as JSON, 7 workstreams and 1 issue."
        - "Stored outside the repository tree, so it can neither be committed nor picked up by a future extractor pass."
        - "`generated` caveat: PraxisData.generated is new Date().toISOString().slice(0, 10) (src/lib/extract.ts:127). The 1.9 comparison ran on the same calendar day (2026-08-06) and came back byte-identical, so no key normalisation was needed and none was applied."
    ```

  - [x] 1.2 Append the detail payload types to `src/types/praxis-data.d.ts`

    ```yaml
    description: "Add the seven new type declarations the detail path needs. Existing interfaces are untouched. This file is an ambient global declaration file consumed by BOTH compilations without an import on either side, so the new declarations must stay import/export-free."
    issues: []
    implement:
      - "Append the following to the end of src/types/praxis-data.d.ts, after the existing ProjectList interface. Transcribe verbatim — these are the plan's contract, not a sketch:"
      - |
        type PraxisYamlValue = string | PraxisYamlValue[] | { [key: string]: PraxisYamlValue };

        interface PraxisDetailArtefact {
          id: string;       // IL-1 / TL-5
          file: string;     // basename, e.g. "tasklist-status-colour-fix.md"
          title: string;
          status: string;
          updated: string;
        }

        interface PraxisIssueDetail {
          id: string;       // ISS-1
          title: string;
          checked: boolean;
          fields: Record<string, PraxisYamlValue>;   // {} when the item has no yaml fence
        }

        interface PraxisTaskDetail {
          number: string;   // "1" or "1.1"
          title: string;
          checked: boolean;
          fields: Record<string, PraxisYamlValue>;
          children: PraxisTaskDetail[];              // always present; [] for a leaf
        }

        interface PraxisIssueListDetail { artefact: PraxisDetailArtefact; items: PraxisIssueDetail[]; }
        interface PraxisTaskListDetail  { artefact: PraxisDetailArtefact; tasks: PraxisTaskDetail[]; }

        interface PraxisWorkstreamDetail {
          id: string;
          slug: string;
          title: string;
          status: string;
          archived: boolean;
          issueLists: PraxisIssueListDetail[];
          taskLists: PraxisTaskListDetail[];
        }
      - "Do not modify PraxisArtefact, PraxisWorkstream, PraxisIssue, PraxisData, ProjectEntry or ProjectList in any way — not their keys, not their comments, not their ordering."
      - "Do not add a top-level `import` or `export` anywhere in this file. `fields` is deliberately an untyped-key generic tree rather than a per-type field list: the prx skills own the item schemas and add keys over time, and the same key takes different shapes in different files (`notes` is a scalar in inline-css-extraction/issuelist.md and a block list under self_eval in inline-css-extraction/tasklist-status-colour-fix.md). A schema-driven type would have to pick one and be wrong half the time."
    pattern: "src/types/praxis-data.d.ts — append only."
    imports: "None. No import statement may appear in this file."
    compatibility: "Included by BOTH tsconfigs — root tsconfig.json via `src/types/**/*.d.ts` and src/public/tsconfig.json via the explicit `../types/praxis-data.d.ts` entry. A top-level import or export turns the file into a module and every interface in it stops being global, breaking both compilations at once. `PraxisYamlValue` is a recursive type alias, which requires the object/array indirection shown — TypeScript permits recursion through those but not through a bare alias."
    gotcha: "The recursive alias must be written as `{ [key: string]: PraxisYamlValue }` and not as `Record<string, PraxisYamlValue>` inside its own definition — the Record form is a circular-reference error under `strict`. The interfaces that consume it (PraxisIssueDetail.fields, PraxisTaskDetail.fields) may use Record freely, as shown."
    verify:
      - "`npm run build` — both tsc passes and copy-assets complete with no error."
      - "`grep -nE '^(import|export) ' src/types/praxis-data.d.ts` returns nothing."
      - "`git diff src/types/praxis-data.d.ts` shows additions only, with no line removed or altered above the new block."
    checklist:
      - "Are all seven declarations (PraxisYamlValue plus six interfaces) present and byte-faithful to the plan's contract?"
      - "Is the file still free of any top-level import or export?"
      - "Are the six pre-existing declarations completely unmodified?"
      - "Does `npm run build` pass under `strict` with `noEmitOnError`?"
      - "Does the recursive PraxisYamlValue alias compile without a circular-reference error?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "All seven declarations appended verbatim; `git diff --stat` reports 38 insertions and 0 deletions, so the six pre-existing declarations are untouched."
        - "`grep -nE \"^(import|export) \"` returns nothing — the file is still an ambient global declaration file for both compilations."
        - "The recursive PraxisYamlValue alias compiles under strict with noEmitOnError using the { [key: string]: PraxisYamlValue } indirection."
    ```

  - [x] 1.3 Export `parseFrontmatter` from `src/lib/extract.ts`

    ```yaml
    description: "Add the keyword `export` to parseFrontmatter so src/lib/detail.ts can reuse it. This is the ONLY edit to src/lib/extract.ts anywhere in this task list. It changes nothing at runtime."
    issues: []
    implement:
      - "Apply this single mechanical edit. The SEARCH text was read from the file at base_commit a439d4d:"
      - |
        src/lib/extract.ts
        ```typescript
        <<<<<<< SEARCH
        function parseFrontmatter(text: string): Record<string, string | string[]> {
        =======
        export function parseFrontmatter(text: string): Record<string, string | string[]> {
        >>>>>>> REPLACE
        ```
      - "Make no other change to this file. Not to fmStr, countChecks, walkWorkstreams, hasPrxwork or extractPraxisData; not to a comment; not to whitespace. The byte-parity comparisons in 1.9 and 4.4 exist to catch exactly that."
    pattern: "src/lib/extract.ts — one keyword, one line."
    imports: "None."
    compatibility: "Adding `export` to a function in an already-module file is runtime-inert: the emitted function body and every existing call site are unchanged. extract.ts is already an ES module (it exports hasPrxwork and extractPraxisData), so this adds a named export to an existing export list rather than changing the file's module status."
    gotcha: "parseFrontmatter's key regex is `/^([a-zA-Z_]+):\\s*(.*)$/` — it matches letters and underscores only, and it is line-oriented over the first `---`-delimited block. detail.ts must accept that contract as-is and must not 'improve' it; any change here would alter what the board payload reads."
    verify:
      - "`npm run build` passes."
      - "`git diff --stat src/lib/extract.ts` shows exactly 1 insertion and 1 deletion."
      - "`grep -n 'export function parseFrontmatter' src/lib/extract.ts` returns exactly one line."
    checklist:
      - "Did the SEARCH block apply cleanly against the current file?"
      - "Is the diff for this file exactly one changed line?"
      - "Is `parseFrontmatter` now importable from other modules under node16 resolution?"
      - "Are countChecks, walkWorkstreams and extractPraxisData byte-for-byte unchanged?"
      - "Does `npm run build` pass?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "SEARCH block applied cleanly against the file as read at a439d4d — no re-anchoring was needed."
        - "`git diff --stat src/lib/extract.ts` reports exactly 1 insertion and 1 deletion; fmStr, countChecks, walkWorkstreams, hasPrxwork and extractPraxisData are byte-for-byte unchanged."
        - "Importability confirmed by src/lib/detail.ts importing it from ./extract.js and the build passing."
    ```

  - [x] 1.4 Create `src/lib/detail.ts` — workstream resolution and artefact classification

    ```yaml
    description: "New module exporting extractWorkstreamDetail(root, workstreamId). At this phase it resolves the workstream folder by scanning frontmatter, classifies each file as an issue list or a task list, and returns the full PraxisWorkstreamDetail with every items/tasks array EMPTY. Item parsing lands in Phases 2 and 3."
    issues: []
    implement:
      - "Create src/lib/detail.ts with this exact exported signature: `export function extractWorkstreamDetail(root: string, workstreamId: string): PraxisWorkstreamDetail | null;`. It returns null when no workstream carries that id, which the route in task 1.5 turns into a 404."
      - "Resolution: resolve `root`, then scan `<root>/flowcharge/workstreams/` first and `<root>/flowcharge/archive/` second. For each subdirectory that is a directory and contains workstream.md, read that file and run the imported parseFrontmatter over it. Return the first whose frontmatter `id` equals workstreamId. Set `archived` to false for a hit under workstreams/ and true for a hit under archive/. Set `slug` to the folder's own basename."
      - "The wsId is NEVER joined into a filesystem path. Resolution compares parsed frontmatter ids, so the URL segment cannot escape the tree. Folders on disk are named by bare slug in this repo (card-detail-modal-issues-tasks/) while CONVENTIONS.md documents <WS-N>-<slug> and the separately registered Praxis project uses that form (WS-5-cross-platform-adapter-layer/) — scanning frontmatter is correct under both, which is exactly why the folder name is not used as a key."
      - "Classification: for every file in the resolved folder other than workstream.md, read it and parse its frontmatter. Frontmatter `type` is the sole source of truth — `issuelist` makes it an issue list, `tasklist` makes it a task list, anything else (including `plan`) is skipped. Filename is used only for ordering and display, never for classification. This mirrors how walkWorkstreams already decides (src/lib/extract.ts:66)."
      - "Build a PraxisDetailArtefact per matched file from its frontmatter: `id`, `title`, `status`, `updated`, plus `file` set to the basename. Order both lists by filename ascending."
      - "Populate `issueLists` with `{ artefact, items: [] }` and `taskLists` with `{ artefact, tasks: [] }`. The empty arrays are correct and intentional for this phase."
      - "Import parseFrontmatter from './extract.js' (note the .js extension — node16 module resolution requires it on relative specifiers)."
      - "This module knows Praxis markdown structure: folder layout, which frontmatter type means what, and later how an item line is written and how a fence attaches to it. It must NOT know YAML syntax details (it will delegate to yaml-block.ts in Phase 2), and must NOT know about HTTP, the project registry, or the board payload. Import nothing from server.ts or projects.ts."
      - "Do not refactor walkWorkstreams to share its directory loop. Repeating a few lines of that loop here is deliberate: refactoring the function that produces the board's entire payload, in order to add a feature that must not touch the board, is the worse trade."
    pattern: "src/lib/detail.ts (new). Picked up automatically by the root tsconfig's `src/lib/**/*.ts` include — no build wiring change."
    imports: "node:fs, node:path, and { parseFrontmatter } from './extract.js'."
    compatibility: "Node16 ESM under `strict` and `noEmitOnError`. parseFrontmatter returns Record<string, string | string[]>, so every frontmatter read needs a narrowing or an assertion before it can satisfy the string-typed fields of PraxisDetailArtefact — extract.ts's own fmStr helper is NOT exported and must not be exported by this task list (task 1.3 permits exactly one keyword in that file), so handle the narrowing locally in detail.ts. Types come from the ambient globals added in 1.2; do not import them."
    gotcha: "fs.readdirSync order is not guaranteed to be sorted on every platform — sort explicitly rather than relying on it. flowcharge/archive/ is EMPTY in this repo, so the archived branch cannot be verified against a real local fixture; guard it with fs.existsSync so a missing archive/ directory is a normal case, not a throw. A file with no frontmatter `type` (or no frontmatter at all) must be skipped silently, not throw."
    verify:
      - "`npm run build` passes."
      - "Verification of behaviour happens through the route in task 1.5 and the gate in 1.9 — this module has no CLI entry point and this project has no test framework."
      - "`grep -n \"from '\\./extract.js'\" src/lib/detail.ts` shows the import carries the .js extension."
      - "`grep -nE \"require|http|projects\\.js\" src/lib/detail.ts` returns nothing — the module has no transport or registry knowledge."
    checklist:
      - "Is the exported signature exactly `extractWorkstreamDetail(root: string, workstreamId: string): PraxisWorkstreamDetail | null`?"
      - "Does resolution compare parsed frontmatter ids and never join workstreamId into a path?"
      - "Is classification driven solely by frontmatter `type`, with filename used only for ordering and display?"
      - "Does a missing flowcharge/archive/ directory return normally rather than throw?"
      - "Are all items and tasks arrays empty at this phase, with the artefact metadata fully populated?"
      - "Does the module import nothing from server.ts, projects.ts or a YAML library?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Missing flowcharge/archive/ verified against a scratch fixture outside the repo: a hit returned the workstream normally and a miss returned null, with no throw. A missing flowcharge/ entirely also returns null rather than throwing."
        - "Files whose frontmatter type is neither issuelist nor tasklist are skipped silently — WS-4 returns only IL-1, TL-1 and TL-2, never its plan.md."
        - "Both lists are ordered by filename ascending as this task instructs. For WS-4 that places TL-2 (tasklist-status-colour-fix.md) before TL-1 (tasklist.md), because \"-\" sorts before \".\" — see task 1.9, whose verify literal lists them the other way round."
    ```

  - [x] 1.5 Add the detail route to `src/server.ts`

    ```yaml
    description: "One new matched route placed immediately after the existing /data route in handleApi, implementing the plan's five status codes exactly. The route does registry lookup, boundary validation and status codes — and nothing else. It must not know how any file is parsed."
    issues: []
    implement:
      - "Add a new import line `import { extractWorkstreamDetail } from './lib/detail.js';` beneath the existing extract and projects imports at the top of src/server.ts (currently src/server.ts:5-6). Do not extend the existing `from './lib/extract.js'` import — detail.ts is a separate module."
      - "In handleApi, immediately after the `if (dataMatch) { ... }` block closes and before the final `sendJson(res, 404, { error: 'Not found' });`, add the new matched route. The match is exactly `/^\\/api\\/projects\\/([^/]+)\\/workstreams\\/([^/]+)\\/detail$/`."
      - "Implement the five status codes exactly as specified, mirroring the /data route's conventions and wording: 405 `{ error: 'Method not allowed' }` when the method is not GET; 400 when wsId does not match `/^WS-\\d+$/`; 404 `{ error: `Unknown project ${id}` }` for an unknown project id AND 404 when extractWorkstreamDetail returns null (no workstream with that id in the project); 410 `{ error: `${entry.path} no longer contains a flowcharge/ folder` }` when hasPrxwork(entry.path) is false — same wording as the /data route; 500 for anything thrown, logged with console.error and answered as `{ error: 'Detail extraction failed' }`."
      - "Order the checks: method first, then wsId shape, then findProject, then hasPrxwork, then extraction — so a malformed wsId is rejected before any filesystem work happens."
      - "Wrap the findProject/hasPrxwork/extract sequence in try/catch exactly as the /data route does. The 500 branch is not optional: an uncaught throw inside an http.createServer handler takes the process down."
      - "The project path comes from the registry via findProject, never from the URL. Introduce no new write path."
      - "Do not modify the existing /api/projects branch, the dataMatch branch, handleAddProject, readRequestBody, sendJson, the static-file fallthrough or the listen call."
    pattern: "src/server.ts — one new import line and one new route block inside handleApi, placed after the dataMatch block (currently src/server.ts:131-154)."
    imports: "{ extractWorkstreamDetail } from './lib/detail.js' — the .js extension is required under node16 resolution. findProject and hasPrxwork are already imported at src/server.ts:5-6."
    compatibility: "handleApi's signature and its existing branch order are unchanged; the new branch is additive and sits between the dataMatch block and the trailing 404. The outer try/catch in the createServer callback (src/server.ts:171-179) already exists as a backstop, but the route's own 500 branch is still required so the error message is the specified one rather than 'Internal server error'."
    gotcha: "reqPath is already decodeURIComponent'd at src/server.ts:161, so a percent-encoded traversal attempt arrives decoded — the `[^/]+` capture plus the `/^WS-\\d+$/` guard is what rejects it, and the guard must run before findProject. A wsId like `WS/../x` cannot even reach the regex (it contains a slash, so the route pattern will not match and the request falls through to the trailing 404) — the 400 case is for a decoded single segment that is not WS-N, such as `WS-abc` or `../etc`. Note the plan's Verify wording expects 400 for the malformed-wsId case; verify both shapes in 1.9 and record which code each produced."
    verify:
      - "`npm run build` passes."
      - "`npm start`, then `curl -s -o /dev/null -w '%{http_code}\\n' -X POST http://localhost:4173/api/projects/3c975ac5/workstreams/WS-5/detail` prints 405."
      - "`curl -s -o /dev/null -w '%{http_code}\\n' http://localhost:4173/api/projects/3c975ac5/workstreams/WS-abc/detail` prints 400."
      - "`curl -s -o /dev/null -w '%{http_code}\\n' http://localhost:4173/api/projects/deadbeef/workstreams/WS-5/detail` prints 404."
      - "`curl -s -o /dev/null -w '%{http_code}\\n' http://localhost:4173/api/projects/3c975ac5/workstreams/WS-99/detail` prints 404."
      - "`curl -s http://localhost:4173/api/projects/3c975ac5/workstreams/WS-5/detail | node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);console.log(d.id,d.slug,d.archived)})\"` prints `WS-5 card-detail-modal-issues-tasks false`."
    checklist:
      - "Does the route regex match exactly `/^\\/api\\/projects\\/([^/]+)\\/workstreams\\/([^/]+)\\/detail$/` and sit immediately after the dataMatch block?"
      - "Do all five status codes (405, 400, 404, 410, 500) exist as distinct branches with the specified bodies?"
      - "Is the 410 wording identical to the /data route's?"
      - "Is the wsId validated against `/^WS-\\d+$/` before any filesystem access?"
      - "Is the whole extraction path wrapped in try/catch with a console.error and `{ error: 'Detail extraction failed' }`?"
      - "Is every pre-existing branch of handleApi unmodified?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "405, 400 and both 404 branches exercised live against a server started on the fresh build."
        - "The 410 branch is verified by inspection only: exercising it needs a registered project whose flowcharge/ has since disappeared, which cannot be produced without mutating a registered project on disk. Its wording is character-identical to the /data route’s (src/server.ts:146 and :179)."
        - "Both malformed-wsId shapes recorded as the gotcha asks: `WS-abc` decodes to a single segment, matches the route and is rejected with 400; `..%2Fetc` and `WS%2F..%2Fx` decode to multi-segment paths, so the route regex never matches and they fall through to the trailing 404."
        - "`git diff --stat src/server.ts` reports 39 insertions and 0 deletions — every pre-existing branch of handleApi is unmodified."
    ```

  - [x] 1.6 Add the `<dialog>` skeleton to `src/public/board.html`

    ```yaml
    description: "Static modal markup with full ARIA tab wiring, which app.ts fills at runtime. No behaviour in this task — markup only."
    issues: []
    implement:
      - "Insert a `<dialog id=\"ws-modal\">` into src/public/board.html after the `<footer class=\"note\">` element and before the `<script src=\"app.js\"></script>` line."
      - "The dialog element itself must carry NO padding (set `padding: 0` in the CSS added by task 1.7) and all its content must live in an inner wrapper div. This is load-bearing, not cosmetic: backdrop dismissal is implemented as `if (e.target === dialog) dialog.close()`, which works because a backdrop click targets the dialog element itself — with padding on the dialog, a click on that padding also targets the dialog and closes it, which is a surprise."
      - "Inside the wrapper, add a header region containing: an element `#ws-modal-id` for the workstream id, an element `#ws-modal-title` for the title, an element `#ws-modal-status` for the status, and a close button `#ws-modal-close` with `type=\"button\"` and an accessible name (`aria-label=\"Close\"`)."
      - "Add a tablist: a container with `role=\"tablist\"` (`id=\"ws-modal-tabs\"`) holding exactly two `<button type=\"button\" role=\"tab\">` elements — `#ws-tab-issues` and `#ws-tab-tasks`, in that order, each with a `data-tab` attribute (`issues` / `tasks`) for the delegated handler to read."
      - "Add exactly two panels: `<div role=\"tabpanel\" id=\"ws-panel-issues\">` and `<div role=\"tabpanel\" id=\"ws-panel-tasks\">`."
      - "Wire the ARIA statically: each tab gets `aria-controls` pointing at its panel and each panel gets `aria-labelledby` pointing at its tab. Ship the initial state in the markup — Issues selected: `#ws-tab-issues` with `aria-selected=\"true\"` and `tabindex=\"0\"`, `#ws-tab-tasks` with `aria-selected=\"false\"` and `tabindex=\"-1\"`, and `#ws-panel-tasks` carrying the `hidden` attribute. app.ts toggles these; it should not have to establish them."
      - "Give the dialog an accessible name by pointing `aria-labelledby` at `#ws-modal-title`."
      - "Exactly two tabs. Never one tab per file — multiple issue lists or task lists become sections WITHIN a tab (assumption A1)."
      - "Change nothing else in this file: the masthead, kpi-strip, controls, board, lower panels, footer and script tag all stay exactly as they are."
    pattern: "src/public/board.html — one new <dialog> block. Already in tools/copy-assets.mjs's copy list, so no build wiring change."
    imports: "None — plain HTML."
    compatibility: "Native <dialog> with showModal(). The browser floor this sets is already exceeded by this codebase: src/public/app.ts:129 uses `color-mix(in srgb, …)`, which requires materially newer browsers than <dialog> does. Do not hand-roll an overlay <div> — showModal() gives focus containment, an inert background, Escape-to-close, ::backdrop and focus restoration for free, and the hand-rolled alternative is roughly 60 lines reimplementing platform behaviour, each line a chance to trap a keyboard user."
    gotcha: "A <dialog> without the `open` attribute is hidden by default, which is what we want — do not add `open`. Buttons inside a dialog default to `type=submit` in some contexts, so every button here needs an explicit `type=\"button\"` or a click will attempt a form submission. The `hidden` attribute on the inactive panel is the mechanism that keeps it out of the accessibility tree; a CSS-only `display:none` set later would work visually but this task ships the attribute."
    verify:
      - "`npm run build` then confirm `dist/public/board.html` contains the dialog: `grep -c 'ws-modal' dist/public/board.html` returns a non-zero count."
      - "`grep -cE 'role=\"tab\"' src/public/board.html` returns exactly 2."
      - "`grep -cE 'role=\"tabpanel\"' src/public/board.html` returns exactly 2."
      - "Load the board in a browser and confirm the page renders exactly as before — the dialog is not visible and occupies no space."
    checklist:
      - "Is there exactly one `<dialog id=\"ws-modal\">`, with no `open` attribute, and an inner content wrapper?"
      - "Are there exactly two `role=\"tab\"` buttons and exactly two `role=\"tabpanel\"` containers?"
      - "Does every tab carry `aria-controls` and every panel `aria-labelledby`, pairing them correctly?"
      - "Is the initial state shipped in the markup — Issues `aria-selected=\"true\"`/`tabindex=\"0\"`, Tasks `aria-selected=\"false\"`/`tabindex=\"-1\"`, tasks panel `hidden`?"
      - "Does every button carry an explicit `type=\"button\"`?"
      - "Is every pre-existing element in board.html unchanged?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "One <dialog id=\"ws-modal\"> with no open attribute and a .ws-modal-inner wrapper; exactly two role=\"tab\" buttons and two role=\"tabpanel\" containers; aria-controls/aria-labelledby pairing confirmed in the browser."
        - "Initial state ships in the markup and the dialog occupies no space before showModal() — measured height 0 on load."
        - "The three new dialog buttons all carry type=\"button\". The four pre-existing .seg buttons at board.html:32-37 do not, and were left untouched as this task’s \"change nothing else in this file\" instruction requires."
    ```

  - [x] 1.7 Add the modal CSS section and the card affordance to `src/public/styles.css`

    ```yaml
    description: "A new `/* ---------- Card detail modal ---------- */` section covering the dialog, its backdrop, header, tablist and panels, plus the card's new pointer cursor and hover border. Every colour comes from an existing custom property."
    issues: []
    implement:
      - "Change the card cursor. The SEARCH text was read from the file at base_commit a439d4d:"
      - |
        src/public/styles.css
        ```css
        <<<<<<< SEARCH
        .card {
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 9px 10px 8px;
          background: var(--paper);
          cursor: default;
        }
        =======
        .card {
          border: 1px solid var(--line);
          border-radius: 6px;
          padding: 9px 10px 8px;
          background: var(--paper);
          cursor: pointer;
        }
        >>>>>>> REPLACE
        ```
      - "Immediately after that rule, add a hover rule reusing the existing `.tile:hover` pattern (styles.css:486): `.card:hover { border-color: var(--line-strong); }`. Nothing else about `.card` or its DOM changes — `.card:focus-visible` at styles.css:249 already exists and needs no change."
      - "Append a new `/* ---------- Card detail modal ---------- */` section at the end of the file, after the `#add-error:empty` rule."
      - "In that section style: `#ws-modal` itself with `padding: 0` (load-bearing — see task 1.6), a sensible max-width and max-height, `border: 1px solid var(--line)`, `border-radius: var(--radius)`, `background: var(--paper-raised)`, `color: var(--ink)` and `box-shadow: var(--shadow)`; `#ws-modal::backdrop`; the inner wrapper with its own padding and a scrolling body region; the header row; the tablist as underlined labels; and the two panels."
      - "Style the tabs as UNDERLINED LABELS, not as `.seg`'s joined pills. `.seg` is a behavioural precedent for this feature, not a visual one. Use `--accent` for the selected tab's underline and text, `--ink-soft` for the unselected."
      - "Give the tabs and the close button a `:focus-visible` outline consistent with the existing `outline: 2px solid var(--accent); outline-offset: 2px;` convention at styles.css:249."
      - "ZERO new literal colour values. styles.css defines its palette four times — `:root`, the `@media (prefers-color-scheme: dark)` block, `:root[data-theme=\"dark\"]` and `:root[data-theme=\"light\"]` — so a raw hex would be correct in one of them and wrong in three. Every colour must be `var(--…)` referencing a property that already exists."
      - "Do not touch any existing rule other than the `.card` block named above."
    pattern: "src/public/styles.css — one SEARCH/REPLACE on the `.card` rule (styles.css:307-313), one adjacent hover rule, and one appended section. Already in tools/copy-assets.mjs's copy list."
    imports: "None."
    compatibility: "Must render correctly under all four palette blocks. The `::backdrop` pseudo-element does not inherit custom properties from `:root` in every engine — set its background with a literal `rgba()` only if a var-based value provably fails, and if so record that exception explicitly in self_eval rather than letting it pass as a normal colour."
    gotcha: "The `::backdrop` inheritance caveat above is the one place the no-literal-colours rule can legitimately bend, and it must be recorded if it does. Also: a `max-height` on the dialog without `overflow: auto` on an inner region gives a dialog that clips its content with no way to scroll — put the scroll on the inner body region, not on the dialog element, so the header and tablist stay pinned."
    verify:
      - "`npm run build` then confirm the section reached the served copy: `grep -c 'Card detail modal' dist/public/styles.css` returns 1."
      - "`git diff src/public/styles.css | grep -E '^\\+' | grep -iE '#[0-9a-f]{3,8}\\b|\\brgb'` returns nothing, or returns only the recorded ::backdrop exception."
      - "In the browser, hover a card and confirm the cursor is a pointer and the border colour changes; confirm no other board styling shifted."
    checklist:
      - "Did the `.card` SEARCH block apply cleanly, changing only `cursor: default` to `cursor: pointer`?"
      - "Does `#ws-modal` carry `padding: 0`, with content padding on the inner wrapper?"
      - "Is the scroll region an inner element, so the header and tablist stay visible?"
      - "Are the tabs styled as underlined labels rather than `.seg` pills?"
      - "Does every new colour reference an existing custom property, with any ::backdrop exception explicitly recorded?"
      - "Is every pre-existing rule other than `.card` untouched?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "No ::backdrop exception was needed, so zero literal colour values were added: `#ws-modal::backdrop { background: color-mix(in srgb, var(--ink) 46%, transparent); }` resolves through inheritance in the target engine. Computed values confirmed in both palettes — light color(srgb 0.086 0.106 0.133 / 0.46), dark color(srgb 0.914 0.929 0.925 / 0.46)."
        - "`git diff src/public/styles.css | grep -E \"^\\+\" | grep -iE \"#[0-9a-f]{3,8}\\b|\\brgb\"` returns nothing."
        - "The .card SEARCH block applied cleanly; the only removed line in the entire file is `cursor: default;`. #ws-modal computes padding 0px, with the scroll on the inner .ws-modal-body so the header and tablist stay pinned."
    ```

  - [x] 1.8 Wire the modal in `src/public/app.ts` — delegated listeners, fetch, header, ARIA tabs, empty states

    ```yaml
    description: "The client half of the skeleton: a delegated click and keydown listener on #board, the detail fetch, the header fill, tab switching with full ARIA and arrow-key movement, close/backdrop/Escape handling, and a placeholder empty state in each panel. No item rendering — that arrives in Phases 2 and 3."
    issues: []
    implement:
      - "All new client code goes in src/public/app.ts. src/public/tsconfig.json sets `\"module\": \"none\"`, so client files compile as classic scripts that cannot import each other; a second file would have to share state through a `window` global. Do not create one."
      - "In buildCard (currently app.ts:232), set `card.dataset.ws = w.id` and add `card.setAttribute('role', 'button')` and `card.setAttribute('aria-haspopup', 'dialog')`. `card.tabIndex = 0` already exists at app.ts:234 and needs no change. Change nothing else about the card's DOM, class list or content."
      - "Add a SINGLE delegated `click` listener on `#board`, not a per-card listener. renderBoard clears and rebuilds board.innerHTML on every sort, direction and search change (app.ts:288), so per-card listeners would be re-created continuously and leak. The handler reads `(e.target as HTMLElement).closest('.card')?.dataset.ws` and opens the modal for that id. Delegation matches the existing control listeners at app.ts:328-345 and survives every re-render."
      - "Add a delegated `keydown` listener on `#board` that opens the modal on Enter or Space when the event target is a card, calling preventDefault() for Space so the page does not scroll."
      - "Fetch `'/api/projects/' + encodeURIComponent(projectParam) + '/workstreams/' + encodeURIComponent(wsId) + '/detail'` with `{ cache: 'no-store' }`. `projectParam` is already in scope in boot's closure (app.ts:35), so no new plumbing is needed — and reading it, rather than any other source, is what scopes the modal to the project whose board is open. On a non-ok response, surface the JSON `{ error }` string verbatim with the same two-step fallback the existing loader uses at app.ts:41-49."
      - "Refetch on every open. Do not cache detail responses client-side (assumption A6) — on localhost the cost is milliseconds, and the DOM cost, which is the real one, is handled by lazy expansion in Phase 2."
      - "Open with `dialog.showModal()`. It provides focus containment, an inert background, Escape-to-close, ::backdrop and focus restoration to the invoking element for free — do not hand-roll any of those."
      - "Fill the header from the payload: `#ws-modal-id` from `id`, `#ws-modal-title` from `title`, `#ws-modal-status` from `status`. Use textContent, never innerHTML, for every value that came from a file."
      - "Reset the modal to the Issues tab on every open, so a reopen never inherits the previous session's selected tab."
      - "Tab switching: one delegated click listener on the tablist, reading the button's `data-tab` attribute — the same shape as the existing `.seg` handlers at app.ts:328-341. On switch, set `aria-selected` on both tabs, move the roving `tabindex` (0 on the selected tab, -1 on the other), toggle the `hidden` attribute on both panels, and move focus to the newly selected tab."
      - "Keyboard: on the tablist, ArrowLeft/ArrowRight move between the two tabs (wrapping), Home selects Issues and End selects Tasks. This goes beyond `.seg`, which has no accessibility at all — a modal is precisely where a keyboard user gets stuck."
      - "Closing: `#ws-modal-close` calls `dialog.close()`; a click on the dialog with `e.target === dialog` calls `dialog.close()` (backdrop dismissal); Escape is handled by the platform. Confirm focus returns to the card that opened it — showModal() restores it automatically."
      - "Tab labels carry counts. Render them as label plus count now (both zero at this phase) so the mechanism exists before Phases 2 and 3 supply real numbers."
      - "Both panels show a placeholder empty state at this phase. Final copy for all four empty-state cases lands in task 4.1."
      - "Change nothing about renderBoard, buildCard's existing content, the sort/direction/search handlers, the KPI strip, the attention panel or the severity panel beyond the three card attributes named above."
    pattern: "src/public/app.ts — additions inside the existing IIFE. buildCard gains three attribute lines; the rest is new code in boot's closure."
    imports: "None — `\"module\": \"none\"` makes any import statement a compile error. Types come from the ambient globals in src/types/praxis-data.d.ts, which src/public/tsconfig.json already includes explicitly."
    compatibility: "Written in the file's existing idiom: `var`, function expressions, the el()/byId() helpers at app.ts:7-13, and no arrow functions or template literals where the surrounding code uses neither. `HTMLDialogElement` is available because the public tsconfig has `\"lib\": [\"dom\", \"es2020\"]`; byId() returns HTMLElement, so the dialog reference needs a cast to HTMLDialogElement to reach showModal()/close()."
    gotcha: "`byId` uses a non-null assertion, so a typo in an element id fails at runtime rather than compile time — cross-check every id against the markup written in task 1.6. Space keydown on a focused card scrolls the page unless preventDefault() is called. A delegated keydown must also ignore key events that originated inside the dialog, which is a descendant of document but not of #board — scoping the listener to #board handles that, so do not attach it to document."
    verify:
      - "`npm run build` passes."
      - "`npm start`, open http://localhost:4173/board.html?project=3c975ac5, click any card: the modal opens showing that workstream's id, title and status."
      - "Tab to a card with the keyboard and press Enter: the same modal opens. Press Space on a card: the modal opens and the page does not scroll."
      - "With the modal open, click the Tasks tab, then use ArrowLeft/ArrowRight/Home/End on the tablist — selection follows, `aria-selected` and the `hidden` attribute track it in devtools, and focus follows the selected tab."
      - "Press Escape, then reopen and click the backdrop, then reopen and click the close button — all three close it, and after each close the card that opened it has focus (check `document.activeElement` in the console)."
      - "Open a card, close it, then use the sort, direction and search controls: all behave exactly as before."
    checklist:
      - "Is there exactly ONE click listener and ONE keydown listener on #board, both delegated, with no per-card listener anywhere?"
      - "Does the fetch URL use the in-scope projectParam, so the modal is scoped to the open project?"
      - "Does the modal open via showModal(), with no hand-rolled focus trap, Escape handler or inertness code?"
      - "Do tab switches update aria-selected, the roving tabindex and the panels' hidden attribute together?"
      - "Do ArrowLeft, ArrowRight, Home and End all move tab selection?"
      - "Does every close route (Escape, backdrop, close button) return focus to the invoking card?"
      - "Is all file-sourced text set with textContent rather than innerHTML?"
      - "Do the board's sort, direction and search controls still behave identically?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Exactly one delegated click listener and one delegated keydown listener on #board, with no per-card listener anywhere; both survive a re-render — after changing sort, direction and search, clicking the filtered card still opened the right workstream (WS-6)."
        - "Six opens produced six /api/projects/3c975ac5/workstreams/<id>/detail requests, confirming the project-scoped URL and the refetch-on-every-open with no client-side caching."
        - "Escape-to-close could not be exercised directly: this automation harness delivers a trusted Escape keydown to the document but does not trigger Chrome’s UA close watcher, so no cancel event fires. Verified by mechanism instead — the dialog matches :modal, so it was opened with showModal() and the platform owns Escape, and app.ts registers no Escape handler and no preventDefault that could suppress it."
        - "Space likewise: the harness dispatches Space with an empty key value. Dispatching a KeyboardEvent with key \" \" (and the legacy \"Spacebar\") on a focused card opened the modal and left defaultPrevented true, so the page cannot scroll; a letter key was correctly ignored."
        - "Close button and backdrop click both closed the modal with document.activeElement returning to the originating .card[data-ws=\"WS-5\"]. Reopening always resets to the Issues tab. Sort, direction and search behave exactly as before, with no console errors."
    ```

  - [x] 1.9 Phase 1 verification gate

    ```yaml
    description: "Run the plan's Phase 1 checks in full, chief among them the byte-parity comparison against the baseline captured in task 1.1. Do not start Phase 2 until every check passes."
    issues: []
    implement:
      - "This task writes no source code. If a check fails, fix it in the child task that owns the file, then re-run the whole gate."
      - "Run `npm run build` and confirm both tsc passes and copy-assets complete with no error, and that `git diff package.json` is empty — no new runtime dependency, and in particular no js-yaml (acceptance criterion 13)."
      - "Start the server and run the route checks against WS-4, WS-5, WS-99 and a malformed wsId as listed in verify below."
      - "Run the browser checks: modal opens with the right title, tabs switch by mouse and by arrow keys, both tabs show their empty state, and Escape / backdrop / close button each close it and return focus to the card."
      - "Run the byte-parity comparison against /tmp/praxis-data-baseline.json from task 1.1. If the capture is from an earlier calendar day, the only permitted difference is the `generated` key — compare with that key normalised and say so explicitly in self_eval; any other difference is a regression to fix, not to explain away."
      - "Run the project-scoping check (acceptance criterion 12) using the two registered projects: this repo (3c975ac5) and the separate Praxis project (a51ce5bc). Both have a WS-5; they are different workstreams, and the Praxis one lives in a folder named WS-5-cross-platform-adapter-layer, which also exercises the <WS-N>-<slug> folder-naming form."
    pattern: "No file is modified. Verification only, across src/lib/detail.ts, src/server.ts, src/public/board.html, src/public/styles.css, src/public/app.ts."
    imports: "curl, node, a browser with devtools, a running `npm start`."
    compatibility: "This gate asserts acceptance criteria 1, 2, 3, 4 (structure only — counts are zero here), 9, 10, 11, 12 and 13. Criteria 5, 6, 7 and 8 are gated in Phases 2, 3 and 4."
    gotcha: "Run the byte comparison against a server started AFTER the build, not one left running from before the edits — a stale process serves pre-change code and would pass the comparison for the wrong reason."
    verify:
      - "`npm run build` completes with no error; `git diff package.json` is empty and `grep -c js-yaml package.json` returns 0."
      - "`curl -s http://localhost:4173/api/projects/3c975ac5/workstreams/WS-4/detail | node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);console.log(d.issueLists.length, d.taskLists.length, d.issueLists.map(l=>l.artefact.id).join(','), d.taskLists.map(l=>l.artefact.id+':'+l.artefact.file).join(','))})\"` prints `1 2 IL-1 TL-1:tasklist.md,TL-2:tasklist-status-colour-fix.md`."
      - "The same WS-4 response has every items[] and tasks[] array empty at this phase: `… .every(l=>l.items.length===0)` and `… .every(l=>l.tasks.length===0)` both true."
      - "`curl -s http://localhost:4173/api/projects/3c975ac5/workstreams/WS-5/detail | node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);console.log(d.issueLists.length,d.taskLists.length)})\"` prints `0 0` before this task list's own file exists on disk, or `0 1` once it does — record which, and that the artefact metadata is correct either way."
      - "`curl -s -o /dev/null -w '%{http_code}\\n' http://localhost:4173/api/projects/3c975ac5/workstreams/WS-99/detail` prints 404; the same for `WS-abc` prints 400; `-X POST` prints 405."
      - "`curl -s http://localhost:4173/api/projects/a51ce5bc/workstreams/WS-5/detail | node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).title))\"` prints `Canonical-source portability across agentic coding tools`, NOT this repo's `Card detail modal with Issues and Tasks tabs`."
      - "`curl -s http://localhost:4173/api/projects/3c975ac5/data > /tmp/praxis-data-after-p1.json && diff /tmp/praxis-data-baseline.json /tmp/praxis-data-after-p1.json && echo BYTE-IDENTICAL` prints BYTE-IDENTICAL (or differs in the `generated` key alone, explicitly recorded)."
      - "Browser: click a card, confirm header id/title/status, switch tabs by mouse and by ArrowLeft/ArrowRight/Home/End, confirm both empty states, then close via Escape, backdrop and close button in three separate opens, checking `document.activeElement` is the originating card after each."
    checklist:
      - "Does `npm run build` pass with package.json unchanged and no js-yaml anywhere?"
      - "Does WS-4 return exactly 1 issue list and 2 task lists with the ids IL-1, TL-1 and TL-2 and their correct basenames?"
      - "Do all four status-code checks (405, 400, 404 unknown-project, 404 unknown-workstream) return the specified codes?"
      - "Does project a51ce5bc's WS-5 return a different workstream than project 3c975ac5's WS-5?"
      - "Is /api/projects/3c975ac5/data byte-identical to the Phase 1 baseline, apart from at most the `generated` date, explicitly recorded?"
      - "Do all four modal open/close routes work with focus returning to the originating card?"
      - "Do the board's sort, direction and search controls still behave exactly as before?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Byte parity holds: /tmp/praxis-data-baseline.json and /tmp/praxis-data-after-p1.json are byte-identical with the same sha256 66ae151ac336fc98054b7165cf4440732d6fb9bdac8ff725769d8d83d9d94990. Same calendar day, so the `generated` key needed no normalisation and none was applied."
        - "The comparison ran against a server started after the build; the stale pre-edit process holding port 4173 was stopped first."
        - "`git diff package.json` is empty and `grep -c js-yaml package.json` returns 0 — no new runtime dependency."
        - "WS-4 returns 1 issue list and 2 task lists with ids IL-1, TL-1 and TL-2, correct basenames, and every items[] and tasks[] empty. Ordering differs from this task’s verify literal: the response is `TL-2:tasklist-status-colour-fix.md,TL-1:tasklist.md`, because task 1.4 mandates filename-ascending order and \"-\" sorts before \".\". No sort produces the literal’s sequence, so 1.4’s rule was followed and the discrepancy recorded rather than the code bent to match."
        - "WS-5 in this project returns `0 1` — the branch of the verify step that applies now this task list exists on disk. Its artefact metadata is TL-6 / tasklist.md / ready / 2026-08-06."
        - "Project scoping holds: a51ce5bc’s WS-5 returns \"Canonical-source portability across agentic coding tools\" with slug WS-5-cross-platform-adapter-layer, a different workstream from 3c975ac5’s WS-5 and an exercise of the <WS-N>-<slug> folder form."
        - "Status codes: POST 405, WS-abc 400, unknown project 404, WS-99 404. Modal open/close routes covered in task 1.8’s notes, including the Escape harness limitation."
    ```

- [x] 2. Phase 2 — The block parser and the Issues tab

  ```yaml
  description: "Build src/lib/yaml-block.ts to the plan's fully-specified grammar including the _raw escape hatch, add issue-item splitting and fence attachment to detail.ts, and render the Issues tab in app.ts through a generic PraxisYamlValue renderer with lazy <details> accordions. Effort: medium. Depends on Phase 1."
  ```

  - [x] 2.1 Create `src/lib/yaml-block.ts` — the YAML-subset parser

    ```yaml
    description: "A single pure exported function implementing the plan's grammar exactly. It knows one YAML subset's syntax and nothing else — not what a task, an issue, a workstream or a file is. Input is a list of lines; output is a value tree. It must never throw and never silently drop a line."
    issues: []
    implement:
      - "Create src/lib/yaml-block.ts with this exact exported signature: `export function parseYamlBlock(lines: string[]): Record<string, PraxisYamlValue>;`"
      - "The function receives the lines between a ```yaml fence and its closing ```, with common leading indentation stripped. Implement the grammar below verbatim — it is the plan's specification, not a paraphrase, and a re-derived equivalent-but-different rule set would silently diverge from it."
      - "GRAMMAR, at each indentation level. (a) `key: <non-empty>` is a scalar. A double-quoted value is unquoted with `\\\"` and `\\\\` unescaped; a `[a, b]` value becomes a string array, with `[]` becoming `[]`; anything else is the trimmed text."
      - "GRAMMAR (b) `key:` with nothing after it — look at the following more-indented lines. If they ALL start with `- `, the value is a list; otherwise it is a nested map, parsed by recursion."
      - "GRAMMAR (c) A list item `- <text>` is a string. A list item whose text is itself `key: value`, followed by sibling lines at the item's content indentation that are also `key: value`, is a map — this is the `self_eval.failures` shape, a list of `{item, reason, fix}` maps."
      - "GRAMMAR (d) Anything the grammar does not recognise is appended VERBATIM to the enclosing map under the key `_raw`, which is an array of strings. The parser never throws and never silently drops a line. `_raw` renders in the modal under an 'Unparsed' heading, so a shape this grammar cannot read is visible rather than invisible."
      - "NOT SUPPORTED, because nothing in the Praxis schema produces it: block scalars (`|`, `>`), anchors, aliases, multi-document streams, flow maps. If one appears it lands in `_raw`. Do not add support for any of them."
      - "Every value in the output tree is a string, a string array, or a nested map — never a number, boolean or null. `passed: true` becomes the string `\"true\"` (assumption A3). The renderer never has to care."
      - "Do NOT add js-yaml or any other runtime dependency. This would be the project's first runtime dependency ever, and the decision against it is settled in the plan's Design section. package.json must be unchanged by this task."
      - "This module must know NOTHING about Praxis: no ISS-/TL- ids, no filenames, no markdown, no fences. It takes lines and returns a tree."
      - "Keep it a single exported pure function with no filesystem access and no module-level mutable state — it is the one component here with non-trivial branching, and this shape lets a later write-tests pass cover it with no refactor."
    pattern: "src/lib/yaml-block.ts (new). Picked up automatically by the root tsconfig's `src/lib/**/*.ts` include — no build wiring change."
    imports: "None. No node builtins, no packages. Types come from the ambient global PraxisYamlValue added in task 1.2."
    compatibility: "Node16 ESM under `strict` and `noEmitOnError`. The return type is Record<string, PraxisYamlValue>, so recursion into nested maps returns the same type. Because PraxisYamlValue is a union, narrowing is required at every consumption point in the renderer — that is the renderer's problem, not this module's."
    gotcha: "Real fixtures in this repo exercise every branch: `tasks: [TL-2 task 1]` in inline-css-extraction/issuelist.md is an inline array whose single element contains spaces and must not be split on them; `steps_to_reproduce` in the same file is a block list of quoted strings; `self_eval.failures` in multi-project-home-page/tasklist.md:525-528 is a list of {item, reason, fix} maps; `self_eval.notes` in inline-css-extraction/tasklist-status-colour-fix.md is a block list while top-level `notes` in that workstream's issue list is a scalar. A description value can exceed 1400 characters on one line — do not assume any length bound. Indentation inside a fence is spaces in every fixture, but a tab must land in _raw rather than crash the indentation arithmetic."
    verify:
      - "`npm run build` passes."
      - "`grep -c 'js-yaml' package.json` returns 0 and `git diff package.json` is empty."
      - "`grep -nE \"^import |require\\(\" src/lib/yaml-block.ts` returns nothing."
      - "`grep -niE 'ISS-|TL-|tasklist|issuelist|fence|markdown' src/lib/yaml-block.ts` returns nothing — the module has no Praxis knowledge."
      - "Behavioural verification runs through the route once task 2.2 wires it in; this project has no test framework, so the gate is task 2.5's fixture check."
    checklist:
      - "Is the exported signature exactly `parseYamlBlock(lines: string[]): Record<string, PraxisYamlValue>`?"
      - "Are all four grammar rules — scalar, empty-key list-or-map, list item including the list-of-maps shape, and _raw catch-all — implemented as specified?"
      - "Does a double-quoted scalar get unquoted with \\\" and \\\\ unescaped, and does `[]` produce an empty array?"
      - "Is every output value a string, string array or nested map, with no type coercion anywhere?"
      - "Can the function throw on any input, or drop any line without recording it under _raw?"
      - "Is package.json unchanged, with no js-yaml and no other runtime dependency?"
      - "Does the module reference any Praxis concept — an id prefix, a filename, a fence, a markdown construct?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "All four grammar rules exercised directly against the built module: quoted scalars unescape \\\" and \\\\ only; `[]` yields [] and `[TL-2 task 1]` yields a one-element array whose element keeps its spaces; a `key:` whose children all start with `- ` becomes a list and otherwise a nested map; the list-of-maps shape yields [{item, reason, fix}]. No coercion anywhere — `42` returns the string \"42\" and `true` the string \"true\"."
        - "_raw verified as a catch-all rather than a throw: a tabbed line, an unrecognised line and a block scalar each land in _raw with the enclosing map's other keys intact. _raw is written last, so the file's own field order survives into the payload ahead of it."
        - "Two deliberate readings of the grammar, both recorded rather than assumed. First, rule (b)'s \"if they ALL start with `- `\" is applied to the child lines AT THE CHILD INDENT, not to every more-indented descendant. The literal all-descendants reading would make rule (c) unreachable, since a list of maps always has more-indented non-`- ` lines, so the per-level reading is the only one under which all four rules can coexist."
        - "Second, the NOT SUPPORTED clause says a block scalar lands in _raw, so `key: |` sends its indicator line AND its body to _raw rather than leaving the bare string \"|\" as a value. The `- |` list-item form does the same. This form appears 34 times as `- |` and zero times as `key: |` across flowcharge/, so only the list-item path is exercised by real input."
        - "Blank lines are skipped rather than recorded in _raw. A blank line carries no shape, so nothing is dropped by skipping it, and recording it would put stray empty entries under the 'Unparsed' heading and undermine the signal _raw exists to give."
        - "The module carries no Praxis knowledge: `grep -niE 'ISS-|TL-|tasklist|issuelist|fence|markdown'` returns nothing. Two early comments did match and were reworded. The only remaining Praxis token is the ambient type name PraxisYamlValue, which task 2.1's own mandated signature requires."
        - "No imports of any kind, no filesystem access, no module-level mutable state, and package.json is untouched with zero js-yaml."
    ```

  - [x] 2.2 Add issue-item splitting and fence attachment to `src/lib/detail.ts`

    ```yaml
    description: "Fill the issueLists[].items arrays left empty in Phase 1. detail.ts learns how an issue item line is written and how a fence attaches to it; it delegates all YAML syntax to parseYamlBlock."
    issues: []
    implement:
      - "Import parseYamlBlock from './yaml-block.js' (the .js extension is required under node16 resolution)."
      - "ISSUE ITEM LINE — use exactly this regex: `^-\\s*\\[([ xX])\\]\\s*(ISS-\\d+)\\.\\s*(.*)$`. This is the same shape src/lib/extract.ts:76 already matches, so the two paths cannot disagree about what an issue is. Do not write a different-but-equivalent pattern."
      - "Build one PraxisIssueDetail per matched line: `id` from capture 2, `title` from capture 3 trimmed, `checked` from capture 1 lowercased equalling 'x', and `fields` from the attached fence."
      - "FENCE ATTACHMENT — after an item line, the FIRST ```yaml fence encountered before the next item line belongs to that item. An item with no fence gets `fields: {}` and still renders, title and checkbox only."
      - "Pass the fence's inner lines to parseYamlBlock with the common leading indentation stripped — that stripping is detail.ts's job, since it is a markdown-layout concern, and parseYamlBlock's contract assumes it has already happened."
      - "Preserve the file's own field order. parseYamlBlock returns an object; rely on JS insertion order through JSON serialisation so the renderer receives fields in the order the file carries them (acceptance criterion 5)."
      - "Render items only, never the file's narrative preamble between frontmatter and the first item (assumption A2)."
      - "detail.ts must NOT implement any YAML syntax itself — no key/value splitting, no quote unescaping, no list detection. All of that belongs to yaml-block.ts."
      - "Leave the taskLists[].tasks arrays empty — those land in Phase 3. Do not modify the resolution or classification logic written in task 1.4."
    pattern: "src/lib/detail.ts — additions only; the Phase 1 resolution and classification code is unchanged."
    imports: "{ parseYamlBlock } from './yaml-block.js', alongside the existing node:fs, node:path and parseFrontmatter imports."
    compatibility: "The issue regex must stay character-identical to extract.ts:76's shape so the modal and the board's shallow issues[] array agree on what an issue is. detail.ts still must not know about HTTP, the project registry or the board payload."
    gotcha: "extract.ts splits issue blocks with `text.split(/\\n(?=-\\s*\\[[ xX]\\]\\s*ISS-\\d+\\.)/)` — a lookahead split, not a line scan. Either approach is acceptable here, but the item regex itself must match extract.ts:76's shape. A fence opener may be written as ```yaml with trailing whitespace; match the opener loosely but the closer as a bare ``` at the fence's own indentation, or a nested fence inside a description string would terminate the block early. In this repo every item fence is indented two spaces under the item line."
    verify:
      - "`npm run build` passes."
      - "`npm start`, then `curl -s http://localhost:4173/api/projects/3c975ac5/workstreams/WS-4/detail | node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);const it=d.issueLists[0].items;console.log(it.length, it[0].id, it[0].checked, Object.keys(it[0].fields).join(','))})\"` prints `1 ISS-1 true` followed by `id,status,severity,description,steps_to_reproduce,expected,actual,affected,environment,tasks,notes` — all eleven keys, in the file's own order."
      - "The same response: `it[0].fields.steps_to_reproduce` is an array of length 3; `it[0].fields.tasks` is an array of length 1 whose single element is `TL-2 task 1`; `it[0].fields.notes` is a string, not an array; `it[0].fields.description.length` is greater than 1400."
      - "`… JSON.stringify(d.issueLists[0].items).includes('_raw')` is false — no field in this fixture falls outside the grammar."
      - "`grep -nE \"unescape|split\\(':'\\)|replace\\(/\\^\\\"\" src/lib/detail.ts` returns nothing — no YAML syntax handling leaked out of yaml-block.ts."
    checklist:
      - "Is the issue item regex exactly `^-\\s*\\[([ xX])\\]\\s*(ISS-\\d+)\\.\\s*(.*)$`?"
      - "Does the first ```yaml fence before the next item line attach to the preceding item, and does an item with no fence get `fields: {}` while still appearing?"
      - "Does WS-4's ISS-1 return all eleven fields in the file's own order, with steps_to_reproduce as a 3-item array and notes as a string?"
      - "Is `_raw` absent from the WS-4 issue payload?"
      - "Does detail.ts delegate every YAML syntax concern to parseYamlBlock, implementing none itself?"
      - "Are the taskLists[].tasks arrays still empty and the Phase 1 resolution code unmodified?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "WS-4's ISS-1 returns all eleven fields in the file's own order — id, status, severity, description, steps_to_reproduce, expected, actual, affected, environment, tasks, notes — with steps_to_reproduce a 3-element array, tasks a one-element array holding `TL-2 task 1`, notes a string, and no _raw anywhere."
        - "One verify literal does not hold and the code was NOT bent to make it: this task's verify asserts `it[0].fields.description.length` is greater than 1400, but the value is 846 characters. The fixture's description LINE is 863 bytes, of which `  description: \"` is 16 and the closing quote 1, leaving exactly 846 — so the parser returns the field whole and the >1400 figure is a fixture-fact error in the verify step, not a truncation. The same figure is re-asserted in task 2.5 and fails there for the same reason."
        - "Fence attachment verified against a scratch fixture outside the repo covering the cases WS-4 has no example of: an item with no fence gets fields {} and still renders; only the FIRST yaml fence attaches, a second one before the next item is ignored; a ```typescript fence is skipped and the yaml fence after it still attaches; and a fence whose body contains a nested ``` is not terminated early, because the closer must be a bare ``` at the opener's own indentation."
        - "Item lines are never scanned inside a fence — a literal `- [ ] ISS-999.` line placed inside a yaml block did not become a fourth issue. This is the same guard task 3.1 depends on."
        - "The narrative preamble between frontmatter and the first item is never read (assumption A2), since only item lines and their attached fences are collected."
        - "No YAML syntax leaked out of yaml-block.ts: detail.ts does no key/value splitting, quote unescaping or list detection, and the verify grep returns nothing. The fence-attachment helper collectItems takes the item regex as a parameter specifically so task 3.1 can reuse it rather than write a second one."
        - "taskLists[].tasks are still empty for WS-4 (2 lists, both empty) and the Phase 1 resolution and classification code is unchanged apart from hoisting the already-read file text into a variable so the item parser can use it."
    ```

  - [x] 2.3 Build the generic value renderer and the Issues panel in `src/public/app.ts`

    ```yaml
    description: "The generic PraxisYamlValue tree renderer, field-name humanising, per-file sections, and the lazy <details> accordion. The renderer is the load-bearing piece: Phase 3's Tasks tab reuses it UNCHANGED, so it must not know the name of any issue or task field."
    issues: []
    implement:
      - "Write a generic renderer over PraxisYamlValue: a string becomes a paragraph; an array becomes a list; a map becomes a nested definition list, recursing. It must NOT know the names of any issue or task field — no special case for description, severity, verify, checklist or anything else."
      - "The one keyed exception is `_raw`: render it as a `<pre>` under an 'Unparsed' heading, so a shape the grammar could not read is visible rather than invisible. This is the committed failure mode, not a debug affordance."
      - "Humanise field names for display: `steps_to_reproduce` becomes 'Steps to reproduce' — replace underscores with spaces and capitalise the first letter only. This is presentation; the underlying keys are untouched."
      - "Per-file sections: within the Issues tab, render one section per PraxisIssueListDetail, headed by that file's artefact id and title, in the payload's order. Two files means two sections in ONE tab — never a third tab (assumption A1)."
      - "Every issue renders as a `<details>` whose `<summary>` carries the checkbox state, the ISS-N id and the title. Everything is COLLAPSED on open (acceptance criterion 7)."
      - "LAZY BODY CONSTRUCTION: a `<details>` body is built on its FIRST `toggle` event and kept thereafter — never rebuilt on subsequent collapses and expands. Rendering all of it eagerly means several thousand DOM nodes per open on the large fixtures. Use `<details>`/`<summary>` rather than a hand-rolled disclosure widget, for the same reason as `<dialog>`: the platform already has the semantics and the keyboard behaviour."
      - "Set the Issues tab label's count from the number of issues across all issue lists in the payload."
      - "Use textContent for every value that came from a file, never innerHTML — these strings contain markdown, backticks, angle brackets and quoted code."
      - "Render items only, never the file's narrative prose (assumption A2). Render nothing editable: no checkbox the user can toggle, no button that writes. The modal is read-only."
      - "Keep this in src/public/app.ts. Do not create a second client file — `\"module\": \"none\"` means it could only share state through a window global."
    pattern: "src/public/app.ts — new render functions plus the Issues panel fill, inside the existing IIFE."
    imports: "None — `\"module\": \"none\"`. Types come from the ambient globals."
    compatibility: "PraxisYamlValue is a recursive union, so the renderer must narrow with `typeof v === 'string'` then `Array.isArray(v)` then the object case — under `strict` the object branch needs the narrowing to have eliminated the other two. Written in the file's existing idiom: var, function expressions, and the el()/byId() helpers at app.ts:7-13."
    gotcha: "Attach the `toggle` listener once per <details> and have it check whether the body has already been built — `toggle` fires on every open AND every close, so an unguarded handler rebuilds the body each time and defeats the whole point. A definition list nested inside a definition list is valid HTML only when the inner <dl> sits inside a <dd>, not directly inside the outer <dl>. Long single-line values (a 1400-character description) need the overflow handling that lands in task 4.2 — do not solve it here with a literal width."
    verify:
      - "`npm run build` passes."
      - "Browser, http://localhost:4173/board.html?project=3c975ac5 — open the `inline-css-extraction` (WS-4) card, the only workstream in this repo with an issue list. The Issues tab shows one section headed IL-1 with its title, containing one collapsed `<details>` summarising `ISS-1` with a checked state."
      - "Expand ISS-1: it shows its ~1400-character description, its 3-item steps_to_reproduce list, and expected, actual, affected, environment, tasks and notes — with notes rendering as a PARAGRAPH, since it is a scalar in that file. No field may be missing."
      - "No `_raw` block and no 'Unparsed' heading appears anywhere in that modal."
      - "Devtools, before and after: with ISS-1 collapsed, inspect the `<details>` and confirm its body is ABSENT from the DOM; click the summary and confirm the body appears; collapse and re-expand and confirm the same nodes are reused rather than rebuilt."
      - "Field labels read as 'Steps to reproduce', not 'steps_to_reproduce'."
    checklist:
      - "Does the renderer handle string, array and map generically, with `_raw` as its only keyed special case?"
      - "Does the renderer reference the name of any issue or task field anywhere?"
      - "Is every issue collapsed on open, with its body built on first toggle and never rebuilt?"
      - "Does WS-4's ISS-1 show all eleven of its fields, in the file's order, with notes as a paragraph?"
      - "Are multiple issue lists rendered as sections within the one Issues tab rather than as extra tabs?"
      - "Is every file-sourced value set with textContent rather than innerHTML?"
      - "Is the Issues tab count populated from the payload?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "The renderer is three functions — renderValue narrows string, then array, then map, and renderMap walks the keys. It names no issue or task field anywhere, so Phase 3's Tasks tab can call it unchanged. Its only keyed special case is _raw."
        - "LAZY CONSTRUCTION OBSERVED IN DEVTOOLS, not inferred. With ISS-1 collapsed the <details> children are exactly [SUMMARY] — the body is absent from the DOM, and the freshly-opened modal holds 24 element nodes. After expanding, the children are [SUMMARY, DL]. A data-stamp was then written onto the built <dl>, the row collapsed and re-expanded, and afterwards there was still exactly ONE <dl>, it was the same node object by identity, and the stamp survived. The toggle handler therefore builds once and never rebuilds."
        - "A useful accident confirmed the laziness independently: a first attempt read the body synchronously right after clicking the summary and found nothing, because `toggle` fires asynchronously. Had the body been built eagerly, that read would have succeeded."
        - "WS-4's ISS-1 shows all eleven fields in the file's own order with humanised labels — `steps_to_reproduce` displays as 'Steps to reproduce'. steps_to_reproduce renders as a UL of 3, tasks as a UL of 1, and notes as a P, which is the shape-driven-not-schema-driven proof: the same key is a list elsewhere in this workstream."
        - "textContent proven rather than assumed: ISS-1's description contains a literal `<style>`, and the rendered <dd> contains that text with querySelector('style') returning null — nothing was parsed as markup."
        - "The multi-section and _raw paths have no real fixture in this repo (no workstream has two issue lists, and no issue list in either registered project produces _raw), so both were exercised by stubbing window.fetch with a synthetic two-list payload and reopening the modal. Result: two .ws-section blocks headed IL-1 and IL-2 inside the ONE Issues tab with the tab count still 2 and the label reading 'Issues (2)'; _raw rendered as a <pre> under an 'Unparsed' heading, positioned last; and an item with fields {} still rendered its summary row with an empty body. The real fetch was then restored and the live WS-4 path re-checked."
        - "All of this lives in src/public/app.ts inside the existing IIFE, in the file's var-and-function-expression idiom, with no second client file."
    ```

  - [x] 2.4 Style the issue sections, accordions and value tree in `src/public/styles.css`

    ```yaml
    description: "Extend the Card detail modal section added in task 1.7 to cover per-file section headings, <details>/<summary> rows, the definition-list value tree, and the _raw <pre>."
    issues: []
    implement:
      - "Add rules inside the existing `/* ---------- Card detail modal ---------- */` section — do not open a second section."
      - "Style the per-file section heading (artefact id plus title), using --font-mono for the id in the established manner of .card-id (styles.css:316) and --font-display for headings as the .panel h2 rule does (styles.css:370)."
      - "Style the `<summary>` row: the checkbox state, the ISS-N id in --font-mono, and the title. Give it `cursor: pointer` and a `:focus-visible` outline matching the `outline: 2px solid var(--accent); outline-offset: 2px;` convention at styles.css:249."
      - "Style the definition-list value tree: term labels in --ink-soft, values in --ink, with clear indentation for nesting so a nested map reads as nested."
      - "Style the `_raw` `<pre>` and its 'Unparsed' heading using the existing .load-state pre pattern (styles.css:431-439) — --paper-sunken background, --line border, --font-mono."
      - "ZERO new literal colour values. Every colour must be `var(--…)` referencing an existing custom property, for the same four-palette-block reason recorded in task 1.7."
      - "Do not restyle the disclosure triangle away — the default marker is part of the platform affordance this feature deliberately reuses."
      - "Touch no rule outside the Card detail modal section."
    pattern: "src/public/styles.css — additions within the existing modal section only."
    imports: "None."
    compatibility: "Must render correctly under all four palette blocks (:root, the prefers-color-scheme dark block, and both data-theme overrides). The dark-theme pass in task 4.2 will re-check this; getting it right here means that pass finds nothing."
    gotcha: "`<summary>` has a default `display: list-item` — changing it to flex removes the disclosure marker in some engines, so if a flex layout is needed, keep the marker with `::marker` or `::-webkit-details-marker` handling rather than losing it silently. Long unbroken values need `overflow-wrap: anywhere` (the .tile-path pattern at styles.css:498), which task 4.2 applies systematically — do not pre-empt it with a literal width here."
    verify:
      - "`npm run build` then `grep -c 'Card detail modal' dist/public/styles.css` returns 1 — still one section, not two."
      - "`git diff src/public/styles.css | grep -E '^\\+' | grep -iE '#[0-9a-f]{3,8}\\b|\\brgb'` returns nothing, or only the ::backdrop exception already recorded in task 1.7."
      - "Browser: open WS-4, expand ISS-1, and confirm the section heading, summary row, nested definition lists and long description all read clearly with visible nesting."
      - "Tab through the modal with the keyboard and confirm each summary shows a visible focus ring."
    checklist:
      - "Are all new rules inside the single existing Card detail modal section?"
      - "Does every new colour reference an existing custom property?"
      - "Is the disclosure marker still present on every summary?"
      - "Does nesting in the value tree read as nesting?"
      - "Does every focusable element in the modal show a focus ring consistent with the existing convention?"
      - "Is every rule outside the modal section unchanged?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "All rules were appended inside the single existing `/* ---------- Card detail modal ---------- */` section, which runs to the end of the file — `grep -c 'Card detail modal' dist/public/styles.css` still returns 1, so no second section was opened."
        - "Zero literal colours: `git diff src/public/styles.css | grep -E '^\\+' | grep -iE '#[0-9a-f]{3,8}\\b|\\brgb'` returns nothing, and the ::backdrop exception recorded in task 1.7 was not needed here either. Computed values were read in both palettes — the section id resolves to rgb(31, 111, 115) and a field label to rgb(75, 85, 96) under data-theme=\"light\", and both render correctly under the dark block."
        - "The section id uses --font-mono in the manner of .card-id and the section title --font-display in the manner of .panel h2; the _raw <pre> reuses the .load-state pre pattern of --paper-sunken, --line and --font-mono."
        - "The disclosure marker is intact: the summary computes display: list-item, so no engine loses the triangle. Focus was moved onto a summary and the :focus-visible rule matches the existing `outline: 2px solid var(--accent); outline-offset: 2px;` convention."
        - "Nesting reads as nesting — a nested .ws-fields inside a <dd> takes a left border and 12px of padding, so a nested map is visually contained by its parent."
        - "One specificity note: .ws-fields dt sets the label colour, so the Unparsed label is written as `.ws-fields dt.ws-raw-label` to outrank it. An earlier draft used !important and was replaced, since the codebase uses none."
    ```

  - [x] 2.5 Phase 2 verification gate

    ```yaml
    description: "Run the plan's Phase 2 verification against WS-4, the only workstream in this repo with an issue list. Do not start Phase 3 until every check passes."
    issues: []
    implement:
      - "This task writes no source code. If a check fails, fix it in the child task that owns the file, then re-run the whole gate."
      - "Run `npm run build` and confirm package.json is unchanged — still no runtime dependency, still no js-yaml (acceptance criterion 13)."
      - "Run the WS-4 route assertions, then the browser checks including the devtools lazy-construction check, which must be observed rather than assumed."
    pattern: "No file is modified. Verification across src/lib/yaml-block.ts, src/lib/detail.ts, src/public/app.ts, src/public/styles.css."
    imports: "curl, node, a browser with devtools, a running `npm start`."
    compatibility: "This gate asserts acceptance criteria 5 and 7 for the Issues half, and re-asserts 13. Criterion 6 is gated in Phase 3, criterion 8 in Phase 4."
    gotcha: "The lazy-construction check is the one that cannot be inferred from source reading — the plan calls for it in devtools specifically because a toggle handler that rebuilds on every open still looks correct in the rendered page."
    verify:
      - "`npm run build` passes; `git diff package.json` is empty; `grep -c js-yaml package.json` returns 0."
      - "`curl -s http://localhost:4173/api/projects/3c975ac5/workstreams/WS-4/detail | node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const f=JSON.parse(s).issueLists[0].items[0].fields;console.log(Object.keys(f).length, Array.isArray(f.steps_to_reproduce)&&f.steps_to_reproduce.length, typeof f.notes, f.description.length>1400, JSON.stringify(f).includes('_raw'))})\"` prints `11 3 string true false`."
      - "Browser: open WS-4's card. Issues tab is selected on open and its label carries the count 1."
      - "One section headed `IL-1` with its title, containing one collapsed ISS-1 row showing its checked state and title."
      - "Expand ISS-1: description, the 3-item steps_to_reproduce list, expected, actual, affected, environment, tasks and notes all appear; notes renders as a paragraph; no field is missing; no `_raw` or 'Unparsed' block appears."
      - "Devtools: the `<details>` body is absent from the DOM before the first expand and present after; a collapse-then-expand cycle reuses the same nodes."
      - "Field labels display humanised ('Steps to reproduce')."
    checklist:
      - "Does the WS-4 payload return all 11 fields with the correct shapes and no _raw?"
      - "Does the Issues tab open selected, with a correct count in its label?"
      - "Are all eleven of ISS-1's fields visible on expand, in the file's own order?"
      - "Does notes render as a paragraph, confirming shape-driven rather than schema-driven parsing?"
      - "Was the lazy body construction observed in devtools, before and after expanding?"
      - "Is package.json still free of any runtime dependency?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "`npm run build` passes under strict with noEmitOnError, `git diff package.json` is empty and `grep -c js-yaml package.json` returns 0 — still no runtime dependency of any kind."
        - "The gate assertion returns `11 3 string false false` against an expected `11 3 string true false`. The single difference is the fourth field, `description.length>1400`, and it is a fixture-fact error in the verify literal rather than a defect. The description LINE in flowcharge/workstreams/inline-css-extraction/issuelist.md is 863 bytes; removing the 16-byte `  description: \"` prefix and the closing quote leaves exactly 846 characters, which is what the payload carries. Nothing is truncated, and the code was not bent to satisfy the number. This is the second such literal in this task list, after the artefact-ordering one recorded in task 1.9."
        - "Browser checks all pass against WS-4: the Issues tab is selected on open with the label 'Issues (1)', one section headed IL-1 'Inline CSS extraction findings' holds one collapsed ISS-1 row showing its checked state and title, and expanding it shows all eleven fields in the file's own order with 'Steps to reproduce' humanised, its 3-item list intact and notes rendered as a paragraph. No _raw and no 'Unparsed' block appears anywhere in that modal."
        - "The lazy-construction check was OBSERVED in devtools as this task requires. Collapsed, the <details> children are exactly [SUMMARY] and the fresh modal holds 24 element nodes; expanded they are [SUMMARY, DL]. A stamp written onto the built <dl> survived a collapse-then-expand cycle and the node compared identical by reference, with still exactly one <dl> — so the body is built once and reused, not rebuilt."
        - "No console errors on open, expand, collapse or close."
    ```

- [x] 3. Phase 3 — The Tasks tab and its two-level tree

  ```yaml
  description: "The plan's largest and most complex phase — this is where the volume and the shape variety land. In detail.ts: task-item splitting, the dot-depth-derived parent/child tree, and orphan handling. In app.ts: the Tasks panel with per-file sections, parent groups showing description and containing their children, children rendering their full field set through the Phase 2 renderer UNCHANGED. Verified against three real fixtures, each chosen for what it breaks. Effort: large. Depends on Phase 2."
  ```

  - [x] 3.1 Add task-item splitting and fence attachment to `src/lib/detail.ts`

    ```yaml
    description: "Produce the FLAT, ordered list of tasks from every tasklist*.md — item line matching and fence attachment only. The parent/child tree is task 3.2's job; keeping the two separate is what makes each provable on its own."
    issues: []
    implement:
      - "TASK ITEM LINE — use exactly this regex: `^(\\s*)-\\s*\\[([ xX])\\]\\s*(\\d+(?:\\.\\d+)*)\\.?\\s+(.*)$`. Note the OPTIONAL trailing period: in this repo parents are written `- [x] 1. Phase 1 — …` and children `- [x] 1.1 Capture the …`. Do not write a different-but-equivalent pattern."
      - "Capture 1 is the leading whitespace. Capture it because the regex specifies it, but do NOT use it for structure — see task 3.2. Capture 2 is the checkbox state, capture 3 the task number, capture 4 the title."
      - "Build one flat PraxisTaskDetail per matched line, in file order: `number` from capture 3, `title` from capture 4 trimmed, `checked` from capture 2 lowercased equalling 'x', `fields` from the attached fence, and `children` initialised to []."
      - "FENCE ATTACHMENT — identical rule to issues: after an item line, the FIRST ```yaml fence encountered before the next item line belongs to that item. A task with no fence gets `fields: {}` and still renders, title and checkbox only. Reuse the same fence-attachment helper written in task 2.2 rather than writing a second one."
      - "Strip the fence's common leading indentation before passing its lines to parseYamlBlock — child-task fences in this repo are indented four spaces, parent fences two, and parseYamlBlock's contract assumes the stripping has already happened."
      - "Reuse parseYamlBlock UNCHANGED. Phase 3 adds no grammar and no parser branch; if a task field will not parse, it lands in `_raw`, which is the committed failure mode."
      - "Do not attach the file's narrative preamble, its `## Feature` heading, its phase summary or any trailing section such as `## Skipped` (assumption A2). Only item lines and their fences."
      - "Leave the result flat in this task — populate taskLists[].tasks with the flat ordered list so 3.2 has something concrete to restructure."
    pattern: "src/lib/detail.ts — additions only; Phase 1 resolution/classification and Phase 2 issue handling are unchanged."
    imports: "Already-present parseYamlBlock from './yaml-block.js'."
    compatibility: "The fence-attachment helper is shared with the issue path; if issue and task attachment diverge, that is a bug in one of them. detail.ts still must not implement YAML syntax and must not know about HTTP, the registry or the board payload."
    gotcha: "A markdown checkbox line that is NOT a task can appear inside a task's own body — a 'Definition of Done' bullet list inside an implement string, for instance. The regex requires a leading number followed by an optional period and whitespace, which excludes most of those, but a fenced block's contents must never be scanned for item lines at all: scan only outside fences. Also, `countChecks` (src/lib/extract.ts:31) counts EVERY `- [ ]` line in the file including any such stray, which is why the tab-count cross-check in task 3.7 compares against the card's fraction and records any difference rather than assuming equality."
    verify:
      - "`npm run build` passes."
      - "`curl -s http://localhost:4173/api/projects/3c975ac5/workstreams/WS-3/detail | node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const t=JSON.parse(s).taskLists[0].tasks;console.log(t.length, t[0].number, t[1].number, t.filter(x=>x.number.indexOf('.')===-1).length)})\"` prints `32 1 1.1 5` — 32 tasks total, first two numbered 1 and 1.1, 5 of them top-level."
      - "The same response: every task has a `children` key that is an array, and the parent task numbered `1` has `Object.keys(fields)` equal to `['description']` — parent tasks carry description only."
      - "`… .find(x=>x.number==='3.7').fields.self_eval.failures` is an array of length 1 whose single element has the keys item, reason and fix — the list-of-maps shape from multi-project-home-page/tasklist.md:525-528."
    checklist:
      - "Is the task item regex exactly `^(\\s*)-\\s*\\[([ xX])\\]\\s*(\\d+(?:\\.\\d+)*)\\.?\\s+(.*)$`?"
      - "Does it match both the trailing-period parent form and the no-period child form?"
      - "Does WS-3's TL-5 return exactly 32 tasks in file order, with fences correctly attached?"
      - "Is the fence-attachment helper shared with the issue path rather than duplicated?"
      - "Are item lines scanned only outside fences, so a checkbox bullet inside a task body is not mistaken for a task?"
      - "Was parseYamlBlock left completely unchanged by this task?"
    self_eval:
      passed: true
      failures:
        - item: "Verify step 4 — `… .find(x=>x.number==='3.7').fields.self_eval.failures` is an array of length 1"
          reason: "Fixture-fact error in the step, not a defect in the code. The only non-empty failures block in multi-project-home-page/tasklist.md is at lines 525-528, exactly where the task says, but those lines belong to task 3.3 (whose item spans lines 494-530), not to task 3.7. The block's own text reads \"Found during task 3.7 check 4\", which is where the number was taken from. Task 3.7's self_eval.failures is [], as are the other 26 in that file."
          fix: "Re-ran the assertion against the block's actual owner rather than adjusting anything. Task 3.3's self_eval.failures parses as a one-element list of maps with exactly the keys item, reason and fix, and the item value survives its embedded colon intact. No code change — the list-of-maps grammar shape the step exists to prove is verified."
        - item: "Verify step 2 — the flat list returns 32 entries"
          reason: "Task 3.2 restructures that same array into a tree, so once 3.2 landed the endpoint returns 5 top-level entries and the literal command prints `5 1 2 5`. The step is only observable at the 3.1 stage."
          fix: "Ran the step before 3.2 was written: it printed `32 1 1.1 5` exactly as specified — 32 tasks, first two numbered 1 and 1.1, 5 top-level. The flat count is re-asserted permanently by 3.2's tree-total invariant, which holds at 5 + 27 = 32."
    ```

  - [x] 3.2 Derive the two-level parent/child tree from dot depth, with orphan handling

    ```yaml
    description: "Turn the flat list from 3.1 into the two-level tree the payload contract specifies. Nesting comes from the dot depth of the task NUMBER — never from markdown indentation. Every task in the flat list must survive into the tree, including a child whose parent does not exist."
    issues: []
    implement:
      - "Nesting is derived from the DOT DEPTH OF THE NUMBER, not from leading whitespace. Indentation is presentational and drifts; the numbering does not. The regex in 3.1 captures the leading whitespace, and this task must ignore it."
      - "A task whose number has no dot (`N`) is top-level. A task numbered `N.M` attaches to the MOST RECENT `N` parent — most recent in file order, not the first or the numerically matching one."
      - "ORPHAN HANDLING: an `N.M` child with no matching preceding `N` parent becomes a TOP-LEVEL entry rather than being dropped. Nothing in the flat list may disappear."
      - "Two levels only. A number with more than one dot (`N.M.K`) is not produced by the prx skills; treat it as a child of its `N` parent by first-segment match rather than building a third level, and record that behaviour in self_eval if any fixture exercises it."
      - "Preserve file order at both levels: top-level entries in the order their lines appeared, and each parent's children in the order theirs did."
      - "Assert the invariant explicitly: the total count of tasks in the tree — top-level entries plus all their children — must equal the length of the flat list from 3.1. This is the check that catches a dropped orphan."
      - "Do not modify parseYamlBlock, the issue path, or the resolution and classification code."
    pattern: "src/lib/detail.ts — the tree-building step, applied to the flat list produced in task 3.1."
    imports: "None beyond what detail.ts already imports."
    compatibility: "PraxisTaskDetail.children is `always present; [] for a leaf` per the payload contract — every node, parent or child, must carry the key. The route and the renderer both rely on it being an array without a null check."
    gotcha: "`parseInt` on '1.10' gives 1, but string comparison of the first dot-segment is what the rule actually specifies — split on '.' and compare the first segment as a string, so a hypothetical task 10.1 attaches to 10 and not to 1. The 'most recent' rule matters when a file numbers a second phase's children before closing the first, which is malformed but must not crash. This repo's archive/ is empty, so no archived fixture exercises this path locally."
    verify:
      - "`npm run build` passes."
      - "`curl -s http://localhost:4173/api/projects/3c975ac5/workstreams/WS-3/detail | node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const t=JSON.parse(s).taskLists[0].tasks;const total=t.length+t.reduce((a,p)=>a+p.children.length,0);console.log(t.length, total, t.map(p=>p.children.length).join(','))})\"` prints `5 32` and a per-parent child-count list summing to 27."
      - "The same response: `t.every(p => Array.isArray(p.children))` is true and `t.every(p => p.children.every(c => Array.isArray(c.children) && c.children.length === 0))` is true — every node carries children, and no third level was built."
      - "Every child's number starts with its parent's number followed by a dot: `t.every(p => p.children.every(c => c.number.split('.')[0] === p.number))` is true."
      - "Orphan check: temporarily point the dashboard at a scratch copy of a task list whose first child line is `- [ ] 9.1 Orphan` with no task 9, confirm it appears as a TOP-LEVEL entry and that the total count is unchanged, then delete the scratch copy. Record the result in self_eval."
    checklist:
      - "Is nesting derived solely from the number's dot depth, with leading whitespace ignored?"
      - "Does an `N.M` child attach to the most recent `N` parent in file order?"
      - "Does an orphan child become a top-level entry rather than being dropped?"
      - "Does the tree's total node count equal the flat list's length for WS-3 (32)?"
      - "Does every node carry a `children` array, with leaves carrying an empty one and no third level built?"
      - "Is file order preserved at both levels?"
    self_eval:
      passed: true
      failures:
        - item: "Verify step 5 — the orphan check, plus the task's request to record third-level behaviour"
          reason: "No fixture in this repo holds an orphan child or an N.M.K number, so neither path could be exercised by a real file. Recorded here rather than left unstated."
          fix: "Ran extractWorkstreamDetail against a scratch root outside the repo — never through the registry, so .praxis-projects.json was untouched — holding a list numbered 9.1, 1, 1.1, 1.2, 2. The orphan 9.1 came back as the FIRST top-level entry, top-level order was 9.1,1,2, and the tree total stayed at 5 of 5 flat entries. A second scratch list numbered 1, 10, 10.1, 1, 1.1 confirmed 10.1 attaches to 10 rather than to 1, and that 1.1 attaches to the REOPENED 1 — the first-segment string comparison and the most-recent rule both hold. Both scratch copies deleted. No fixture produced an N.M.K number, so the third-level path was not observed in practice; by construction such a task attaches to its first-segment parent and no third level is built."
    ```

  - [x] 3.3 Render the Tasks panel in `src/public/app.ts`

    ```yaml
    description: "Per-file sections, parent groups showing their description and containing their children, and children rendering their full field set through the Phase 2 generic renderer UNCHANGED. Same lazy <details> discipline as the Issues tab."
    issues: []
    implement:
      - "Reuse the generic PraxisYamlValue renderer built in task 2.3 WITHOUT modifying it. If the Tasks tab needs a change to that renderer, the renderer was built field-aware and the fix belongs in 2.3, not here."
      - "Per-file sections: one section per PraxisTaskListDetail, headed by that file's artefact id and title, in the payload's order. inline-css-extraction has TWO task lists and they become two sections in the ONE Tasks tab — never a third tab (assumption A1)."
      - "A parent task renders as a group showing its `description` inline and containing its children. Parent tasks carry description only; do not attempt to render a field set for them."
      - "A child task renders as a `<details>` whose `<summary>` carries the checkbox state, the number and the title, with the full field set in the lazily-built body."
      - "Everything is COLLAPSED on open, and every body is built on its first `toggle` event and never rebuilt — the same guard as task 2.3. Opening the modal on the 32-task workstream must build roughly 40 summary rows, not roughly 3000 nodes."
      - "TAB COUNT: the Tasks label counts EVERY task line, parents and children alike — the same thing countChecks counts for the card's done/total fraction (src/lib/extract.ts:31). Counting only leaves would put a different number in the modal than on the card behind it, for the same workstream, on the same screen."
      - "Use textContent for every file-sourced value. Render nothing editable — no toggleable checkbox, no reorder control, no write of any kind."
      - "Keep this in src/public/app.ts. Do not create a second client file."
      - "Do not touch the Issues panel code, the board renderers, or the tab-switching mechanism built in task 1.8."
    pattern: "src/public/app.ts — the Tasks panel fill, reusing the Phase 2 renderer."
    imports: "None — `\"module\": \"none\"`. Types come from the ambient globals."
    compatibility: "PraxisTaskDetail.children is always an array, so no null guard is needed. The renderer's signature and behaviour must be identical to what the Issues tab uses — verify by confirming both tabs call the same function."
    gotcha: "A parent group that is itself a <details> containing child <details> nests disclosure widgets, and a nested <details> inside a collapsed parent is not in the layout but IS in the DOM — which would defeat the volume goal if parent groups were built eagerly with all their children's bodies. Build the parent group's summary rows for its children, but not those children's bodies, until each child is itself expanded. Also: the two task lists in inline-css-extraction have different ids (TL-1 and TL-2) but the same filename prefix; head each section by its artefact id AND title so they are distinguishable."
    verify:
      - "`npm run build` passes."
      - "Browser: open `multi-project-home-page` (WS-3). The Tasks tab label shows a count; the panel shows one section headed TL-5 with 5 parent groups; expanding a parent shows its children as collapsed summary rows."
      - "Expand child 3.7 and confirm its self_eval.failures renders as a nested map with visible item, reason and fix keys."
      - "Open `inline-css-extraction` (WS-4): the Tasks tab shows TWO sections, headed TL-1 and TL-2 with their own titles, under the one Tasks tab."
      - "Devtools: with the modal freshly opened on WS-3, confirm the node count is in the tens rather than the thousands, and that no child body exists in the DOM until that child is expanded."
      - "Confirm the Issues tab still renders exactly as it did at the end of Phase 2 — the renderer was reused, not modified."
    checklist:
      - "Is the Phase 2 generic renderer reused without modification, and called by both tabs?"
      - "Do multiple task lists render as sections within the one Tasks tab, each headed by its artefact id and title?"
      - "Does a parent group show its description inline and contain its children?"
      - "Does the Tasks count include parents and children alike?"
      - "Is every body — parent group children and child field sets alike — built lazily on first expand and never rebuilt?"
      - "Is every file-sourced value set with textContent, with nothing editable rendered?"
      - "Does the Issues tab still behave exactly as at the end of Phase 2?"
    self_eval:
      passed: true
      failures:
        - item: "Implement step 3 — a parent task renders as a group showing its description"
          reason: "Taken literally for every top-level entry, this would hide the field set of a top-level task that has no children, and this repo has three of them: inline-css-extraction's TL-1 tasks 1 and 3, and TL-2's only task, which is the very task 3.6 requires expanded to prove the block-list shape of `notes`. A promoted orphan would lose its fields the same way."
          fix: "Rendered a top-level entry as a group only when it actually has children; a childless top-level entry renders through buildItem with its full field set, exactly as a child does. Verified on WS-4: TL-1's rows come back as 1:item, 2:group, 3:item with 2.1 and 2.2 under the group, and TL-2's single task renders its self_eval in full. Nothing in the tree can lose a field."
        - item: "Implement step 3 — the parent's description renders inline"
          reason: "The parent group is a collapsed <details> like every other row, so its description is in the group's lazily-built body rather than visible while collapsed. Recorded because \"inline\" could be read as visible-while-collapsed, which would contradict implement step 5's \"everything is COLLAPSED on open\" and put five long descriptions in the DOM before anything is opened."
          fix: "Description is rendered inline within the group body — a plain value through the same renderer, not a field set — and appears the moment the parent is expanded, above its children. All five WS-3 parents showed a description on expand. Freshly-opened node count stayed at 44."
    ```

  - [x] 3.4 Style the task tree in `src/public/styles.css`

    ```yaml
    description: "Extend the Card detail modal section to cover parent groups, the child rows nested inside them, and the task number's typographic treatment."
    issues: []
    implement:
      - "Add rules inside the existing `/* ---------- Card detail modal ---------- */` section — still one section, not a second."
      - "Style the parent group: its heading row (number, title, checkbox state), its inline description, and the visual containment of its children so the two-level structure reads at a glance."
      - "Style the child rows nested inside a parent, indented enough to read as children without pushing long content off the panel."
      - "Set the task number in --font-mono, consistent with .card-id (styles.css:316) and the a-id treatment (styles.css:345)."
      - "Reuse the summary-row, value-tree and _raw styling added in task 2.4 rather than duplicating it — the two tabs should look like one component."
      - "ZERO new literal colour values, for the same four-palette-block reason recorded in task 1.7."
      - "Touch no rule outside the Card detail modal section."
    pattern: "src/public/styles.css — additions within the existing modal section only."
    imports: "None."
    compatibility: "Must render correctly under all four palette blocks. Task 4.2's dark-theme pass re-checks this."
    gotcha: "Nested indentation compounds: a child <details> inside a parent group inside a panel with its own padding can leave very little width for a 1400-character value. Keep the per-level indent small, and rely on the overflow handling from task 4.2 rather than on available width."
    verify:
      - "`npm run build` then `grep -c 'Card detail modal' dist/public/styles.css` returns 1."
      - "`git diff src/public/styles.css | grep -E '^\\+' | grep -iE '#[0-9a-f]{3,8}\\b|\\brgb'` returns nothing, or only the recorded ::backdrop exception."
      - "Browser: open WS-3 and confirm the parent/child structure reads clearly, that a child row is visibly nested under its parent, and that the Issues tab's appearance is unchanged."
      - "Tab through the Tasks panel with the keyboard and confirm every summary shows a visible focus ring."
    checklist:
      - "Are all new rules inside the single existing Card detail modal section?"
      - "Does every new colour reference an existing custom property?"
      - "Does the two-level structure read as two levels?"
      - "Do the Issues and Tasks tabs look like one component rather than two?"
      - "Does keyboard focus remain visible on every summary in the Tasks panel?"
      - "Is every rule outside the modal section unchanged?"
    self_eval:
      passed: true
      failures:
        - item: "Implement step 4 — set the task number in --font-mono"
          reason: "No new rule was needed. The number renders in the .ws-item-id span the Issues tab already uses, and task 2.4 gave that class font-family: var(--font-mono) at styles.css:707. A second declaration would have duplicated the rule the two tabs exist to share."
          fix: "Confirmed in the browser rather than assumed: getComputedStyle on a Tasks-panel .ws-item-id returns the ui-monospace stack, the same treatment as .card-id and .a-id. The one new rule touching the number is the parent group's accent colour, which distinguishes a group's number from a child's — and it references an existing custom property. `git diff src/public/styles.css | grep -E '^\\+' | grep -iE '#[0-9a-f]{3,8}\\b|\\brgb'` returns nothing, and dist/public/styles.css still holds exactly one Card detail modal section."
    ```

  - [x] 3.5 Verify against `multi-project-home-page` (WS-3) — the volume fixture

    ```yaml
    description: "The plan's volume case: 91KB, 966 lines, 32 tasks — 5 parents and 27 children. This fixture is what the lazy-rendering design exists for, and the DOM-node claim must be OBSERVED in devtools rather than assumed."
    issues: []
    implement:
      - "This task writes no source code. If a check fails, fix it in the child task that owns the file (3.1, 3.2, 3.3 or 3.4) and re-run this fixture in full."
      - "Fixture facts verified at base_commit a439d4d: flowcharge/workstreams/multi-project-home-page/tasklist.md is 91147 bytes and 966 lines, carries id TL-5, and holds 5 top-level task lines and 27 child task lines — 32 in total."
      - "Its task 3.7 carries the only non-empty `self_eval.failures` in that file (lines 525-528), a one-element list of maps with item, reason and fix keys — the list-of-maps grammar shape."
    pattern: "No file is modified. Verification of src/lib/detail.ts, src/lib/yaml-block.ts, src/public/app.ts, src/public/styles.css against WS-3."
    imports: "curl, node, a browser with devtools, a running `npm start`."
    compatibility: "Asserts acceptance criteria 6 and 7 against the largest real input this repo has."
    gotcha: "'Opens without perceptible delay' is a real requirement, not a courtesy — if the modal stalls on this fixture, the lazy construction is not working, regardless of what the code reads like. Measure the node count with the modal freshly opened and nothing expanded."
    verify:
      - "`curl -s http://localhost:4173/api/projects/3c975ac5/workstreams/WS-3/detail | node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const l=JSON.parse(s).taskLists;const t=l[0].tasks;console.log(l.length, l[0].artefact.id, t.length, t.reduce((a,p)=>a+p.children.length,0))})\"` prints `1 TL-5 5 27`."
      - "`… .find(x=>x.number==='3.7').fields.self_eval.failures[0]` has exactly the keys item, reason and fix."
      - "Browser: open the WS-3 card. The modal opens without perceptible delay."
      - "All 5 parents appear as groups, and all 27 children appear under the correct parents — count them against the fixture's `grep -c '^  - \\[' flowcharge/workstreams/multi-project-home-page/tasklist.md` result of 27."
      - "Expand child 3.7: its self_eval.failures entry renders as a nested map showing item, reason and fix."
      - "Devtools with the modal freshly opened and nothing expanded: `document.getElementById('ws-modal').querySelectorAll('*').length` is in the tens, not the thousands. Record the actual number in self_eval."
      - "Expand and collapse several children and confirm the same nodes are reused rather than rebuilt."
    checklist:
      - "Does the WS-3 payload report exactly 5 parents and 27 children under artefact TL-5?"
      - "Do all 5 parents and all 27 children appear in the right groups in the rendered modal?"
      - "Does the modal open on this fixture without perceptible delay?"
      - "Is the freshly-opened node count in the tens rather than the thousands, and recorded?"
      - "Does task 3.7's self_eval.failures render as a nested map with its item, reason and fix keys?"
      - "Are child bodies reused rather than rebuilt across collapse/expand cycles?"
    self_eval:
      passed: true
      failures:
        - item: "Verify step 6 — record the freshly-opened node count"
          reason: "Recorded as the step requires; the claim is observed, not inferred from the code."
          fix: "document.getElementById('ws-modal').querySelectorAll('*').length is 44 with the WS-3 modal freshly opened and nothing expanded — tens, not thousands. Payload to first render was 36ms. With all five parents expanded it rises to 199, still with zero field sets in the DOM, because a child's body waits for that child. WS-1, a second 81KB fixture, also opens at 44."
        - item: "Verify step 7 — child bodies are reused rather than rebuilt"
          reason: "Recorded because the lazyBody guard is the whole reason <details> was chosen, and a rebuild would be invisible without checking node identity."
          fix: "Held a reference to child 3.3's field set, then collapsed and expanded it three times: the same node object was still in place afterwards, and the child held exactly one .ws-fields throughout."
        - item: "Verify step 5 — expand child 3.7 and confirm its self_eval.failures renders as a nested map"
          reason: "Same fixture-fact error recorded against task 3.1: the non-empty failures block at lines 525-528 belongs to task 3.3, not 3.7. Task 3.7's failures is []."
          fix: "Expanded task 3.3 instead. Its Self eval renders as a nested map showing Passed, then Failures, then the nested Item, Reason and Fix keys with their full values. Verified in the browser and in the DOM."
    ```

  - [x] 3.6 Verify against `inline-css-extraction` (WS-4) — the multi-file and shape-variety fixture

    ```yaml
    description: "The plan's multi-file case, and the one that proves the parser is shape-driven rather than schema-driven: the SAME field name takes different shapes in different files of the same workstream, and both must render correctly in one modal session."
    issues: []
    implement:
      - "This task writes no source code. If a check fails, fix it in the child task that owns the file and re-run this fixture in full."
      - "Fixture facts verified at base_commit a439d4d: flowcharge/workstreams/inline-css-extraction/ holds issuelist.md (IL-1), tasklist.md (TL-1, 'Extract the inline stylesheet from index.html into public/styles.css') and tasklist-status-colour-fix.md (TL-2, 'Fix the in-progress status colour custom-property mismatch'), plus plan.md which must NOT appear in either tab."
      - "The shape-variety proof: `notes` is a top-level SCALAR string in issuelist.md's ISS-1, and a BLOCK LIST under `self_eval` in tasklist-status-colour-fix.md. Both must render correctly — the scalar as a paragraph, the list as a list — within one open modal, by switching tabs."
    pattern: "No file is modified. Verification of src/lib/detail.ts, src/lib/yaml-block.ts, src/public/app.ts against WS-4."
    imports: "curl, node, a browser, a running `npm start`."
    compatibility: "Asserts acceptance criteria 5 and 6 together, and assumption A1 (two tabs, N sections per tab)."
    gotcha: "plan.md sits in the same folder and has frontmatter with an id — it must be excluded by its `type: plan`, which is the check that proves classification is frontmatter-driven and not filename-driven. Rendering the plan in the modal is explicitly out of scope."
    verify:
      - "`curl -s http://localhost:4173/api/projects/3c975ac5/workstreams/WS-4/detail | node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const d=JSON.parse(s);console.log(d.issueLists.length, d.taskLists.length, d.taskLists.map(l=>l.artefact.id+'|'+l.artefact.file).join(' '))})\"` prints `1 2 TL-1|tasklist.md TL-2|tasklist-status-colour-fix.md`."
      - "`… JSON.stringify(d).includes('PLN-')` is false — plan.md was excluded by frontmatter type, not by filename."
      - "`… typeof d.issueLists[0].items[0].fields.notes` is `string`, and in the TL-2 list the corresponding `fields.self_eval.notes` is an Array — the same key, two shapes, one payload."
      - "Browser: open the WS-4 card. The Tasks tab shows exactly TWO sections, headed TL-1 and TL-2 with their own titles, under ONE Tasks tab. There is no third tab."
      - "In one modal session: expand ISS-1 on the Issues tab and confirm `notes` renders as a paragraph, then switch to the Tasks tab, expand the TL-2 task carrying self_eval, and confirm its `notes` renders as a list."
      - "Both tab labels carry counts matching their sections' item totals."
    checklist:
      - "Does WS-4 return 1 issue list and 2 task lists, with plan.md excluded?"
      - "Do the two task lists render as two sections within the one Tasks tab, each headed by its artefact id and title?"
      - "Does `notes` render as a paragraph in the issue and as a list in the task, within one modal session?"
      - "Was classification driven by frontmatter type rather than filename?"
      - "Do both tab labels carry counts matching their contents?"
      - "Did any part of this fixture produce a `_raw` block? If so, is the exact input recorded in self_eval?"
    self_eval:
      passed: true
      failures:
        - item: "Checklist 6 — did any part of this fixture produce a `_raw` block?"
          reason: "Yes, one. TL-1's task 3 carries a block scalar in its implement list, and block scalars are outside the grammar by decision, so the construct lands in _raw. Recorded with its exact input, since an unrecorded _raw is what the checklist forbids, not a _raw as such."
          fix: "The input is flowcharge/workstreams/inline-css-extraction/tasklist.md's implement item `- |` followed by its indented body — README.md, then a SEARCH/REPLACE pair of directory-tree lines, ten lines in total. It renders under a visible \"Unparsed\" label in the modal rather than being dropped, which is the committed failure mode behaving as specified. No other _raw appears anywhere in WS-4."
        - item: "Verify step 1 — the expected order `TL-1|tasklist.md TL-2|tasklist-status-colour-fix.md`"
          reason: "The order is correct but reversed from the step's expectation, and the step is what is wrong. Task 1.x committed detail.ts to filename-ascending order, and '-' (0x2D) sorts before '.' (0x2E), so tasklist-status-colour-fix.md precedes tasklist.md. Everything else in the step matches: 1 issue list, 2 task lists, both files present."
          fix: "Left the sort alone. Re-ordering to sort by artefact id would change Phase 1 code from inside Phase 3 to satisfy an expectation the plan itself contradicts. Both sections are headed by artefact id AND title, so the two are distinguishable however they are ordered — verified in the browser as \"TL-2 — Fix the in-progress status colour custom-property mismatch\" and \"TL-1 — Extract the inline stylesheet from index.html into public/styles.css\"."
        - item: "Verify step 5 — the shape-variety proof, one field name in two shapes in one session"
          reason: "Recorded because it is the point of the whole fixture."
          fix: "In one open modal: ISS-1's `notes` renders as <p class=\"ws-val\"> carrying the scalar, and after switching tabs TL-2's task 1 renders self_eval.notes as <ul class=\"ws-list\"> with 5 items. Both field sets were live in the DOM at the same moment. The payload agrees — typeof issue notes is string, task self_eval.notes is an Array. plan.md was excluded by frontmatter type: the payload contains no 'PLN-' anywhere. Tab labels read Issues (1) and Tasks (6), matching 1 item and 1+5 tasks."
    ```

  - [x] 3.7 Verify against `typescript-source-conversion` (WS-1) and cross-check the tab count against the card

    ```yaml
    description: "The plan's second large fixture as a cross-check, plus the count reconciliation: the Tasks tab total must agree with the TL fraction on the card behind it, for the same workstream, on the same screen."
    issues: []
    implement:
      - "This task writes no source code. If a check fails, fix it in the child task that owns the file and re-run this fixture in full."
      - "Fixture facts verified at base_commit a439d4d: flowcharge/workstreams/typescript-source-conversion/tasklist.md is 81181 bytes and carries id TL-4. It holds 11 non-empty `self_eval.failures` blocks, the densest concentration of the list-of-maps shape in this repo."
      - "The count reconciliation: the Tasks tab counts EVERY task line, parents and children alike, which is the same thing countChecks counts for the card's done/total fraction (src/lib/extract.ts:31). Compare the modal's Tasks count against the card's TL fraction denominator for the same workstream, with the modal open over the board."
      - "If the two numbers differ, do not adjust the modal to match the card. Diagnose it: countChecks counts every `- [ ]`-shaped line in the file, including any checkbox bullet embedded in a task's own body, whereas task 3.1 scans only outside fences. Record the exact source of any discrepancy in self_eval rather than papering over it."
    pattern: "No file is modified. Verification of src/lib/detail.ts, src/lib/yaml-block.ts, src/public/app.ts against WS-1, and a count cross-check against the board."
    imports: "curl, node, a browser, a running `npm start`."
    compatibility: "Asserts acceptance criterion 6 on a second large input, and the plan's 'Counts shown on the tabs' requirement."
    gotcha: "This file's task 2.2-era self_eval blocks include a failures entry whose `item` value is itself a long sentence containing a colon — a naive `key: value` split on the first colon is correct here, but a split on the LAST colon would corrupt it. If any value in this fixture renders truncated at a colon, the bug is in parseYamlBlock's scalar rule, not in the renderer."
    verify:
      - "`curl -s http://localhost:4173/api/projects/3c975ac5/workstreams/WS-1/detail | node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const l=JSON.parse(s).taskLists[0];const t=l.tasks;console.log(l.artefact.id, t.length, t.reduce((a,p)=>a+p.children.length,0))})\"` prints `TL-4` followed by the parent and child counts — record both."
      - "`… JSON.stringify(l).split('\\\"failures\\\":[{').length - 1` equals 11 — every non-empty failures block parsed as a list of maps."
      - "`… JSON.stringify(l).includes('_raw')` — record the result. If true, quote the offending lines in self_eval; `_raw` is a legitimate outcome, an unrecorded one is not."
      - "Browser: open the WS-1 card, expand several children across different parents, and confirm no value renders truncated at a colon and no field is missing."
      - "Count reconciliation: with the WS-1 modal open, read the Tasks tab count and compare it to the `TL·4` fraction's denominator on the card behind it. The totals must agree, or the difference must be traced and recorded."
      - "Repeat the reconciliation for WS-3 and WS-4."
    checklist:
      - "Does WS-1's TL-4 parse with every task accounted for and no field missing?"
      - "Did all 11 non-empty failures blocks parse as lists of maps?"
      - "Is any `_raw` output from this fixture explicitly recorded with its input?"
      - "Does any value render truncated at a colon?"
      - "Does the Tasks tab count agree with the card's TL fraction denominator for WS-1, WS-3 and WS-4?"
      - "Is any discrepancy traced to its source rather than adjusted away?"
    self_eval:
      passed: true
      failures:
        - item: "Verify step 1 — record the parent and child counts"
          reason: "Recorded as the step requires."
          fix: "TL-4 returns 5 parents and 23 children, 28 nodes in total, matching the 28 checkbox lines the file holds. All 11 non-empty failures blocks parsed as lists of maps — `JSON.stringify(l).split('\\\"failures\\\":[{').length - 1` is exactly 11."
        - item: "Verify step 3 — `_raw` present in this fixture, record it"
          reason: "True, and in nine places, so it is recorded rather than left as a bare boolean."
          fix: "Every occurrence is the same construct: a `- |` block scalar inside an implement list, in tasks 1.3, 1.5, 1.6, 1.7, 2.2, 3.1, 4.2, 4.3 and 5.2. Their bodies are transcribed tsconfig.json and .d.ts contents and SEARCH/REPLACE pairs. Block scalars are outside the grammar by decision, so each surfaces under a visible \"Unparsed\" label — verified in the browser on tasks 3.1 and 5.2. No other construct in this fixture produced _raw."
        - item: "Verify step 4 — no value renders truncated at a colon"
          reason: "One rendered value does end at a colon, so it was traced rather than passed over."
          fix: "The value is task 5.2's implement item ending \"(currently line 69):\". The source line at tasklist.md:865 is `- \"Apply this edit to the footer's first line (currently line 69):\"` — the string genuinely ends in a colon, introducing the block scalar on the next line. Nothing is truncated. The dense colon case the gotcha warns about also survives: 10 failures entries in this file have an `item` whose sentence contains a colon, and every one renders whole, so the first-colon split is behaving."
        - item: "Verify steps 5 and 6 — the count reconciliation against the card"
          reason: "The task requires the comparison be made and any difference traced, so the numbers are recorded whether or not they agree."
          fix: "They agree exactly, for all three workstreams, read from the modal's tab label and from the card's own TL fraction behind it. WS-1: card TL·4 28/28, modal Tasks (28). WS-3: card TL·5 32/32, modal Tasks (32). WS-4: card TL·2 1/1 plus TL·1 5/5, modal Tasks (6). No discrepancy arose, so nothing needed adjusting away. The reason they agree is that neither fixture embeds a checkbox-shaped bullet inside a task body: countChecks's regex over each whole file returns 28, 32, 5 and 1, matching the modal's per-file totals line for line. A file that did embed one would diverge, and the divergence would sit in countChecks, which scans inside fences, not in the modal, which does not."
    ```

- [x] 4. Phase 4 — Empty states, hardening and regression check

  ```yaml
  description: "Final empty-state copy for all four cases, the reduced-motion and dark-theme pass, long-value overflow handling, and the full regression pass including a re-run of the Phase 1 byte-parity comparison. Effort: small–medium. Depends on Phase 3."
  ```

  - [x] 4.1 Write the final empty-state copy for all four cases in `src/public/app.ts`

    ```yaml
    description: "Four distinct cases, each needing its own explanatory copy: no issue-list file at all, an issue-list file present but with no items, and the same two for task lists. A workstream with neither — 3 of this repo's 7 — must open cleanly with both tabs empty and no error."
    issues: []
    implement:
      - "Replace the Phase 1 placeholder empty states with final copy covering all four cases: (a) Issues tab, no issuelist*.md file in the folder; (b) Issues tab, file present but zero items parsed; (c) Tasks tab, no tasklist*.md file; (d) Tasks tab, file present but zero tasks parsed."
      - "Cases (a) and (c) are the common ones and should explain what the modal looked for — an issue list or task list in that workstream's folder — rather than reading as an error."
      - "Cases (b) and (d) are the diagnostic ones: a file exists but produced nothing, which is worth distinguishing from the file being absent, because it is the signal that item recognition failed on real input."
      - "A workstream with neither file must open cleanly with both tabs empty and NO console error (acceptance criterion 8). Three of this repo's seven workstreams are in that state: card-detail-modal-issues-tasks (WS-5, until this file lands), git-branch-display (WS-6) and live-board-refresh (WS-7)."
      - "The tab count for an empty tab is 0 — render the count, do not hide the label."
      - "Do not change the tab structure, the fetch, the renderers or the board code. Copy and the empty-state branch only."
    pattern: "src/public/app.ts — the empty-state branches in both panel renderers."
    imports: "None."
    compatibility: "The empty-state branch must distinguish 'no file' from 'file with no items', which means checking the length of issueLists/taskLists separately from the summed item counts. Both signals are already in the payload; no payload change is needed and none may be made."
    gotcha: "An empty state is easy to render once and then leave stale when the user switches tabs or reopens the modal on a different workstream — clear each panel on every open, which the Phase 1 reset already does for the tab selection but may not for panel contents."
    verify:
      - "`npm run build` passes."
      - "Browser: open `git-branch-display` (WS-6) and `live-board-refresh` (WS-7). Both tabs show the 'no file' empty state, both counts read 0, and the console is clean."
      - "Open `inline-css-extraction` (WS-4): neither tab shows an empty state."
      - "Open a workstream, then reopen the modal on a different one, and confirm the panels show the second workstream's content with none of the first's left behind."
      - "Verify the file-present-but-no-items copy by pointing the dashboard at a scratch project whose workstream holds a task list with frontmatter but no task lines, then delete the scratch project and remove its registry entry."
    checklist:
      - "Are all four empty-state cases distinguishable in the rendered copy?"
      - "Do WS-6 and WS-7 open cleanly with both tabs empty, counts of 0, and no console error?"
      - "Does reopening the modal on a different workstream fully clear the previous one's panels?"
      - "Was the 'file present but no items' copy exercised, not just written?"
      - "Was the payload shape left unchanged by this task?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "All four cases carry distinct copy. (a) no issue list: \"No issue list in this workstream. The modal looked for a issuelist file in its folder and found none.\" (b) issue list present, zero items: \"This issue list is present but produced no items — nothing in it was recognised as an issue entry.\" (c) and (d) are the same pair worded for task lists. (a)/(c) name what was looked for; (b)/(d) name the file that produced nothing, and render under that file's own section header so the artefact id and title identify it."
        - "The task's premise that WS-5, WS-6 and WS-7 have NEITHER file is now stale — each has since gained a task list (TL-6, TL-7, TL-8). All three open cleanly with the Issues tab showing case (a) at count 0 and a populated Tasks tab, console clean. No workstream in this repo exercises case (c), and none but WS-4 has an issue list, so cases (b), (c) and (d) were exercised on a scratch project instead, as the verify step directs."
        - "Scratch project registered through the app's own POST /api/projects, holding one workstream with an issue list and a task list that carry frontmatter but zero item lines (cases b and d) and one workstream with neither file (cases a and c). All four rendered their intended copy. The scratch tree was then deleted and the registry restored byte-identically from a backup taken before registration — the three original projects and nothing else."
        - "Panel clearing across workstreams confirmed: after opening a workstream with content and reopening on one without, both panels held zero leftover .ws-section nodes and the Issues tab was re-selected."
        - "Payload shape untouched — this task changed four string literals and added four comments in src/public/app.ts, nothing else. src/lib/detail.ts and src/types/praxis-data.d.ts were not edited."
    ```

  - [x] 4.2 Dark-theme, reduced-motion and overflow pass on `src/public/styles.css`

    ```yaml
    description: "Harden the modal styling: confirm zero literal colours across the whole Card detail modal section, add reduced-motion handling consistent with the existing block, and make long values incapable of widening the dialog."
    issues: []
    implement:
      - "Audit every rule in the `/* ---------- Card detail modal ---------- */` section for literal colour values. styles.css defines its palette FOUR times — `:root` (lines 1-39), the `@media (prefers-color-scheme: dark)` block (41-76), `:root[data-theme=\"dark\"]` (77-88) and `:root[data-theme=\"light\"]` (89-100) — so a raw hex would be correct in one and wrong in three. Replace any literal with an existing custom property. Do NOT define new custom properties: that would mean editing all four blocks, which is a change to the shared palette rather than to this feature."
      - "Add long-value overflow handling: `overflow-wrap: anywhere` on the value elements, matching the existing `.tile-path` rule at styles.css:498. A 400-character `implement` string, or ISS-1's 1400-character description, must not widen the dialog. Verify the dialog's rendered width is identical with and without such a value expanded."
      - "Add reduced-motion handling consistent with the existing `@media (prefers-reduced-motion: no-preference)` block at styles.css:441-443. If the modal introduced no transition or animation, add none and record that the block needed no extension."
      - "Do not add any new custom property, do not edit any of the four palette blocks, and do not touch a rule outside the Card detail modal section."
    pattern: "src/public/styles.css — the Card detail modal section, plus the existing prefers-reduced-motion block only if the modal actually animates."
    imports: "None."
    compatibility: "The modal must render correctly in all four palette states: system-light, system-dark, explicit data-theme=\"light\" and explicit data-theme=\"dark\". Note from a prior workstream's execution record that this app has no theme toggle control — nothing in the app ever sets data-theme — so the two data-theme blocks are exercised by setting the attribute directly in devtools and removing it afterwards."
    gotcha: "The ::backdrop exception from task 1.7, if it was taken, is the one permitted literal and must still be recorded here rather than quietly passing the audit. Setting `data-theme` in devtools changes the document until you remove it — remove it, or the next check runs against a state the app never produces."
    verify:
      - "`sed -n '/Card detail modal/,$p' src/public/styles.css | grep -inE '#[0-9a-f]{3,8}\\b|\\brgb'` returns nothing, or only the recorded ::backdrop exception."
      - "`npm run build` passes and the section reaches dist/public/styles.css."
      - "Browser, WS-4 with ISS-1 expanded: measure the dialog's `getBoundingClientRect().width` with the long description collapsed and expanded — the two values are identical."
      - "Render the modal in all four palette states: system-light, system-dark, and each data-theme override set manually in devtools and then removed. Every text/background pair stays legible in all four; record the states checked."
      - "With `prefers-reduced-motion: reduce` emulated in devtools, open and close the modal and confirm no animation runs that the existing block would have suppressed."
    checklist:
      - "Does the Card detail modal section contain any literal colour value other than a recorded ::backdrop exception?"
      - "Were any new custom properties added, or any of the four palette blocks edited?"
      - "Does an expanded 1400-character value leave the dialog's width unchanged?"
      - "Was the modal checked in all four palette states, with the data-theme attribute removed afterwards?"
      - "Is reduced-motion handling consistent with the existing block, or explicitly recorded as not needed?"
      - "Is every rule outside the modal section unchanged?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "NO EDIT WAS NEEDED. All three requirements were already satisfied by the CSS as shipped in tasks 1.7, 2.4 and 3.4; the audit is the deliverable. Nothing was changed to look busier."
        - "Literal colours: `sed -n '/Card detail modal/,$p' src/public/styles.css | grep -inE '#[0-9a-f]{3,8}\\b|\\brgb'` returns nothing across the whole 226-line section. No ::backdrop exception was ever taken — #ws-modal::backdrop uses color-mix(in srgb, var(--ink) 46%, transparent), which resolves through inheritance, so there is no permitted literal to re-record. (The `srgb` in color-mix is not matched by `\\brgb`: s and r are both word characters, so there is no word boundary.) No new custom property was defined and none of the four palette blocks was touched."
        - "Overflow: overflow-wrap: anywhere was already on all four value-bearing elements (.ws-modal-title, .ws-section-title, .ws-item-title, .ws-val), matching .tile-path. Measured in WS-4 with ISS-1 expanded: dialog getBoundingClientRect().width is 816px collapsed and 816px expanded. Pushed past the task's bar with a synthetic probe — 1400 chars with zero spaces (only overflow-wrap can break it) and 1400 chars of prose — width stayed 816px in every state, .ws-modal-body scrollWidth stayed equal to clientWidth (814), and document.documentElement never overflowed horizontally. Probe reverted. The dialog cannot widen in any case: it sets `width: min(880px, calc(100vw - 48px))`, a fixed width, and the scroll lives on .ws-modal-body."
        - "Reduced motion: the block needed NO extension. Every element in the modal computes transition-duration 0s and animation-name none — measured across 20 selectors plus ::backdrop, zero animate. The one animated rule nearby is the pre-existing `.card { transition: border-color 120ms ease }`, which already sits inside the existing @media (prefers-reduced-motion: no-preference) block at styles.css:441-443; the .card:hover affordance added in task 1.7 reuses that guarded transition rather than adding one."
        - "All four palette states checked by computing actual foreground/background contrast ratios for twelve modal text elements. system-light (dialog bg rgb(255,255,255)); system-dark (rgb(23,29,36)); :root[data-theme=\"light\"] asserted against a dark system scheme; :root[data-theme=\"dark\"] asserted against a light system scheme — each override deliberately opposed to the system setting so it proves the block wins. Every pair cleared 3.0:1; the floor was 3.86 (light) and 4.46 (dark) on .ws-modal-status, and the empty-state copy measured 3.86. The data-theme attribute was removed afterwards and the document verified to carry none."
    ```

  - [x] 4.3 Final `src/public/board.html` pass

    ```yaml
    description: "Confirm the dialog markup shipped in Phase 1 still satisfies the two structural requirements the later phases depend on, and correct it only if it does not. Making no edit is a legitimate outcome and must be recorded as one."
    issues: []
    implement:
      - "Confirm the dialog element carries no padding of its own and all content sits in an inner wrapper. This is what makes `if (e.target === dialog) dialog.close()` correct: with padding on the dialog, a click on that padding also targets the dialog and closes it."
      - "Confirm the initial ARIA state is still shipped statically and still matches what app.ts toggles: Issues `aria-selected=\"true\"`/`tabindex=\"0\"`, Tasks `aria-selected=\"false\"`/`tabindex=\"-1\"`, tasks panel `hidden`, each tab's `aria-controls` and each panel's `aria-labelledby` correctly paired."
      - "Confirm the dialog has an accessible name via `aria-labelledby` pointing at #ws-modal-title."
      - "Confirm no placeholder copy from the Phase 1 skeleton survives in the markup — empty-state text is app.ts's responsibility as of task 4.1."
      - "If all four hold, make NO edit and record that in self_eval. Do not restructure working markup to look tidier."
      - "Change nothing outside the dialog block."
    pattern: "src/public/board.html — the <dialog id=\"ws-modal\"> block only."
    imports: "None."
    compatibility: "Already in tools/copy-assets.mjs's copy list; no build wiring change either way."
    gotcha: "The padding-0 requirement is enforced in CSS (task 1.7), not in the markup — so the markup check here is specifically that the inner wrapper exists for that CSS to apply to. Checking one without the other passes for the wrong reason."
    verify:
      - "`grep -nE 'aria-selected|tabindex|hidden|aria-controls|aria-labelledby' src/public/board.html` — the values match the list above exactly."
      - "Browser: click the dialog's own padding area, if any is visible, and confirm the modal does not close; click the backdrop outside the dialog and confirm it does."
      - "Devtools accessibility pane: the dialog exposes its title as its accessible name, and exactly two tabs and two tabpanels are exposed with correct pairing."
      - "`npm run build` passes and dist/public/board.html matches src/public/board.html."
    checklist:
      - "Does the dialog have an inner content wrapper, with padding applied there rather than to the dialog?"
      - "Does a click inside the dialog's own chrome fail to close it, while a backdrop click closes it?"
      - "Is the static ARIA initial state intact and consistent with what app.ts toggles?"
      - "Does the dialog expose an accessible name?"
      - "Is any Phase 1 placeholder copy still present in the markup?"
      - "If no edit was needed, is that recorded explicitly rather than left implicit?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "ZERO EDITS MADE to src/public/board.html. All four conditions held as shipped in task 1.6, so the confirm-only outcome this task anticipates is the one that occurred. Recording it explicitly, as instructed: no change was needed and none was made."
        - "Inner wrapper: #ws-modal computes padding 0px and .ws-modal-inner is its ONLY child element, with the padding living on .ws-modal-head (16px 18px 12px). The gotcha's pairing was checked both ways rather than one — the markup has the wrapper AND the CSS puts padding on it, so neither passes for the wrong reason."
        - "Backdrop dismissal proven by real coordinate clicks, not synthetic events. document.elementFromPoint at the backdrop area returns #ws-modal itself, confirming that region targets the dialog. A click on the dialog's own chrome (over #ws-modal-id) left it open; a click in the backdrop closed it and returned focus to the invoking .card[data-ws=WS-6]."
        - "Static ARIA intact and consistent with what app.ts toggles: ws-tab-issues aria-selected=\"true\" tabindex=\"0\", ws-tab-tasks aria-selected=\"false\" tabindex=\"-1\", ws-panel-tasks hidden. Pairing verified live — issues tab aria-controls=ws-panel-issues against panel aria-labelledby=ws-tab-issues, and the same for tasks. Exactly two role=\"tab\" and two role=\"tabpanel\"; all three dialog buttons carry type=\"button\"."
        - "Accessible name: the dialog's aria-labelledby=\"ws-modal-title\" resolved to the live title text (\"Extract the inline stylesheet out of index.html into its own CSS file\" on WS-4), so the name tracks the open workstream."
        - "No Phase 1 placeholder copy survives in the markup — both panels ship empty and all empty-state text is app.ts's, per task 4.1. The only `placeholder` in the file is the pre-existing search input's attribute at board.html:42, outside the dialog block and untouched."
    ```

  - [x] 4.4 Phase 4 verification gate and full regression pass

    ```yaml
    description: "The plan's final gate: all four empty-state workstreams, both themes, the board's controls after a modal session, a re-run of the Phase 1 byte-parity comparison, and a sweep of all thirteen acceptance criteria."
    issues: []
    implement:
      - "This task writes no source code. If a check fails, fix it in the child task that owns the file, then re-run the whole gate."
      - "Re-run the byte-parity comparison against /tmp/praxis-data-baseline.json from task 1.1. This is the plan's proof that the board's payload never changed, and it is asserted twice — in Phase 1 and here — precisely because the intervening phases touched detail.ts, server.ts and app.ts."
      - "Sweep all thirteen acceptance criteria and record each as met or not, with the evidence: (1) card click opens the modal; (2) Enter and Space open it from keyboard focus; (3) header shows id, title and status; (4) exactly two tabs with counts, Issues selected on open; (5) Issues tab shows every issue from every issue-list file, grouped per file, with all fields in file order and lists/nested maps rendered as such; (6) Tasks tab does the same as a two-level tree; (7) everything collapsed on open with bodies built once; (8) all four empty states; (9) Escape, backdrop and close button each close it with focus returning to the card; (10) focus stays inside and the board behind is inert; (11) board rendering, columns, sort, direction and search unchanged and /data byte-identical; (12) the modal is project-scoped; (13) `npm run build` succeeds with no new runtime dependency."
      - "Confirm the exclusions held: no editing/creating/closing/reordering from the modal, no change to PraxisData/PraxisIssue/PraxisWorkstream/PraxisArtefact, no change to countChecks or the card totals, no board rendering or sort/filter change, no js-yaml or any other runtime dependency, no deep-linking or history integration, no test framework, linter or formatter added, and no server-side caching of detail responses."
    pattern: "No file is modified. Full-feature verification."
    imports: "curl, node, diff, git, a browser with devtools, a running `npm start`."
    compatibility: "Closes out all thirteen acceptance criteria. When it passes, set this file's frontmatter status to done, bump `updated`, and regenerate the index with `node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/Praxis-Dashboard`."
    gotcha: "Run the byte comparison against a server started AFTER the final build. If the baseline capture is from an earlier calendar day, the ONLY permitted difference is the `generated` key (src/lib/extract.ts:127) — say so explicitly; any other difference is a regression to fix, not to explain away."
    verify:
      - "`npm run build` completes with no error; `git diff package.json` is empty; `grep -c js-yaml package.json` returns 0."
      - "`git diff --stat src/lib/extract.ts` shows exactly 1 insertion and 1 deletion — the `export` keyword and nothing else, across the whole task list."
      - "`git diff src/types/praxis-data.d.ts` shows additions only, with PraxisArtefact, PraxisWorkstream, PraxisIssue, PraxisData, ProjectEntry and ProjectList unmodified."
      - "`curl -s http://localhost:4173/api/projects/3c975ac5/data > /tmp/praxis-data-after-p4.json && diff /tmp/praxis-data-baseline.json /tmp/praxis-data-after-p4.json && echo BYTE-IDENTICAL` prints BYTE-IDENTICAL (or differs in the `generated` key alone, explicitly recorded)."
      - "Browser: open `card-detail-modal-issues-tasks` (WS-5), `git-branch-display` (WS-6) and `live-board-refresh` (WS-7) — confirm each opens cleanly with its empty states and no console error."
      - "Confirm the modal renders correctly in light and dark, using the four palette states from task 4.2."
      - "After opening and closing a modal, exercise the board's sort key, sort direction and search controls and confirm all three behave exactly as before; confirm the column layout and card contents are unchanged."
      - "With the modal open, press Tab repeatedly and confirm focus never leaves the dialog, and that elements behind it cannot be reached or clicked."
      - "`curl -s http://localhost:4173/api/projects/a51ce5bc/workstreams/WS-5/detail | node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).title))\"` still prints `Canonical-source portability across agentic coding tools` — project scoping holds."
      - "`grep -rniE 'popstate|history\\.pushState|\\?ws=' src/public/app.ts` returns nothing — no deep-linking was introduced."
    checklist:
      - "Are all thirteen acceptance criteria met, each with recorded evidence?"
      - "Is /api/projects/3c975ac5/data byte-identical to the Phase 1 baseline, apart from at most the `generated` date?"
      - "Is the entire diff to src/lib/extract.ts exactly one keyword?"
      - "Are the six pre-existing declarations in praxis-data.d.ts unmodified?"
      - "Do the board's sort, direction and search controls behave identically after a modal session?"
      - "Does focus stay inside the open dialog with the board behind it inert?"
      - "Did every stated exclusion hold — no runtime dependency, no deep-linking, no test framework, no modal-side writes, no board changes, no server-side caching?"
    self_eval:
      passed: true
      failures:
        - item: "Is /api/projects/3c975ac5/data byte-identical to the Phase 1 baseline, apart from at most the `generated` date?"
          reason: "Initially NO. The raw diff against /tmp/praxis-data-baseline.json differs in one further field: WS-5's TL-6 artefact reads `\"total\":29,\"done\":0` in the baseline and `\"done\":24` now. `generated` is identical (both 2026-08-06, same calendar day). The cause is that this repo is its own fixture — the endpoint reads flowcharge/, and flowcharge/ contains THIS task list, whose checkboxes tasks 1.x-3.x ticked between the baseline capture and now. So countChecks reads a different number off changed markdown. The baseline comparison cannot distinguish a code regression from a data change when the data is the task list recording the work, which the plan did not anticipate."
          fix: "Replaced the confounded test with a differential that holds the data constant and varies only the code. Checked out base_commit a439d4d into a separate git worktree, built it, copied in the (gitignored, therefore absent) .praxis-projects.json so it resolved the same project — projects.ts derives the registry path from its own __dirname, so each build reads its own worktree's copy — and ran it on PORT=4174 against this same repo's current flowcharge/. Captured /api/projects/3c975ac5/data from both servers at the same moment. Result: BYTE-IDENTICAL. Run twice: once mid-task (both sha256 27f11be29833be0acbd059bd536863e0fb084cce657ee1da702f0d8df1b3c913) and again after this file's own checkboxes were ticked (both sha256 1dbc13c6c0652fc95a6ce2fa533b9f3b5c3c0fed119f44d3f21d35d1e31f46a4) — the digests move together with the data and never diverge between the two builds. Control: the detail route answers 404 on the base server and 200 on the current one, so the two servers are provably different builds and the comparison is not accidentally against itself. Re-checked: PASS. Acceptance criterion 11 is met — for identical input the pre-change and post-change code emit the same bytes, which is what byte-parity was asserting. The worktree was removed and pruned afterwards."
      notes:
        - "AC1 card click opens the modal — MET. Delegated click on #board opened the right workstream for every card tried, including after a re-render."
        - "AC2 Enter and Space open it from keyboard focus — MET. Enter on a focused card opened it; Space opened it with defaultPrevented true, so the page cannot scroll."
        - "AC3 header shows id, title and status — MET. WS-4 rendered \"WS-4\" / \"Extract the inline stylesheet out of index.html into its own CSS file\" / \"done\"."
        - "AC4 exactly two tabs with counts, Issues selected on open — MET. Two role=\"tab\" and two role=\"tabpanel\"; labels read \"Issues (1) | Tasks (6)\" for WS-4, \"Issues (0) | Tasks (29)\" for WS-5; aria-selected on the Issues tab was \"true\" on every open, including reopens on a different workstream."
        - "AC5 Issues tab shows every issue from every file, grouped per file, fields in file order, lists and nested maps rendered as such — MET. WS-4's ISS-1 rendered eleven fields in file order (Id, Status, Severity, Description, Steps to reproduce, Expected, Actual, Affected, Environment, Tasks, Notes) with a ul.ws-list present."
        - "AC6 Tasks tab does the same as a two-level tree — MET. WS-4 shows two task-list sections in the one tab. WS-5 task 1.1 rendered ten fields including a nested map (Self eval -> Passed/Failures/Notes) and block lists; no third level exists (no .ws-task-children inside .ws-task-children)."
        - "AC7 everything collapsed on open with bodies built once — MET. Every <details> was closed on open with zero bodies in the DOM. Expand/collapse/expand/expand on one item gave body counts 0 -> 1 -> 1 -> 1 -> 1, so the lazyBody guard holds."
        - "AC8 all four empty states — MET. See task 4.1: three exercised on a scratch project, case (a) exercised on WS-5, WS-6 and WS-7, all with a clean console."
        - "AC9 Escape, backdrop and close button each close it with focus returning to the card — MET, with the Escape route proven by mechanism rather than by a simulated keypress. Backdrop (real coordinate click) and close button both closed it and restored focus to the invoking .card. Escape could not be driven by this harness: a TRUSTED Escape keydown reaches document capture phase with defaultPrevented false — so no app handler suppresses it — yet the UA emits no `cancel` event, which is the signature of Chrome's close watcher not being engaged by synthetic input rather than of app interference. Confirmed the underlying path is intact by calling dialog.requestClose(), which drives the same cancel-then-close sequence Escape uses: a trusted `cancel` fired, then `close`, the dialog closed, and focus returned to .card[data-ws=WS-4]. app.ts registers no Escape handler at all."
        - "AC10 focus stays inside and the board behind is inert — MET. The dialog matches :modal. Of 13 focusable elements outside the dialog, NONE could take focus when .focus() was called on each in turn; the active element stayed within the dialog throughout."
        - "AC11 board rendering, columns, sort, direction and search unchanged and /data byte-identical — MET. Sort key Name reordered the cards, direction Desc reversed them within each status column, search \"branch\" gave \"1 / 7 workstreams shown\", and restoring the controls reproduced the baseline card order exactly. Byte-parity established by the base-code differential recorded in failures above."
        - "AC12 the modal is project-scoped — MET. /api/projects/a51ce5bc/workstreams/WS-5/detail still returns \"Canonical-source portability across agentic coding tools\" while 3c975ac5's WS-5 returns \"Card detail modal with Issues and Tasks tabs\" — same wsId, two projects, two different workstreams, one of them in a folder named WS-5-cross-platform-adapter-layer."
        - "AC13 npm run build succeeds with no new runtime dependency — MET. Build clean under strict/noEmitOnError; package.json `dependencies` is {}, `git diff package.json` is empty, `grep -c js-yaml package.json` is 0."
        - "Exclusions all held. src/lib/extract.ts's entire diff across the whole task list is one keyword (1 insertion, 1 deletion, `function` -> `export function` on parseFrontmatter). praxis-data.d.ts has zero deleted lines, so PraxisArtefact, PraxisWorkstream, PraxisIssue, PraxisData, ProjectEntry and ProjectList are unmodified. No deep-linking (no popstate, history.pushState or ?ws=). No caching in detail.ts or the route. No write calls in detail.ts. No test framework, linter or formatter added. dist/public/board.html and dist/public/styles.css are identical to their sources."
        - "Per the spawn's instructions, the Praxis bookkeeping this task's `compatibility` block describes — setting frontmatter status to done and regenerating the index — was deliberately NOT done here and is left to the orchestrating session."
    ```

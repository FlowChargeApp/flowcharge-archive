---
id: TL-90-8hg6yz
type: tasklist
workstream: WS-85-qwdpix
slug: search-does-not-match-child-artefact-ids
title: "Board search matches child artefact IDs and titles"
status: ready
created: 2026-09-01
updated: 2026-09-01
author: Anthony Koukoullis
depends_on: [PLN-77-v2atsx]
links: []
mode: spec
base_commit: fcdd0da
---

# FlowCharge Tasks

## Board search matches child artefact IDs and titles

The board's `#search` box matches only a workstream's own `id`, `title`, `slug` and `tags`,
because `matches(w, q)` at `src/public/app.ts:114-118` builds its haystack from those four
fields alone. A plan, task-list, issue-list or issue ID never finds the workstream that owns it.

PLN-77-v2atsx fixes this in two stages. Stage 1 publishes each artefact's frontmatter `title`
from the extractor: `PraxisArtefact` gains a required `title: string`, and `src/lib/extract.ts`
fills it with the same empty-string guard the file already uses for `description` and `blocked`.
Stage 2 adds a per-workstream search index to `src/public/app.ts`, built in `applyData` where
the data changes rather than on every keystroke, and rewrites `matches()` into a lookup against
it with a fallback to the four fields it uses today.

Three source files change plus one test file. The change is purely additive: every query that
matched before still matches. Baseline readings at `fcdd0da`, taken while authoring: `npm run
build` exits 0; `node --test dist/lib/extract.test.js` reports 18 tests, 18 pass; `node --test
dist/lib/detail.test.js` reports 9 tests, 9 pass; a `npm run refresh` payload holds 169 artefact
entries and 0 of them carry a `title` string.

- [ ] 1. Artefact titles reach the payload

  ```yaml
  description: "Plan stage 1 — extend PraxisArtefact with a required title and populate it in the extractor, so child artefact titles reach the browser payload."
  ```

  - [ ] 1.1 Add the required `title` field to `PraxisArtefact`
    ```yaml
    description: "Add title: string to the PraxisArtefact interface in the shared ambient declaration file."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/types/praxis-data.d.ts
        <<<<<<< SEARCH
        interface PraxisArtefact {
          id: string;
          type: string;
          status: string;
        =======
        interface PraxisArtefact {
          id: string;
          type: string;
          title: string;   // '' when the source file's frontmatter declares no title
          status: string;
        >>>>>>> REPLACE
      - "Leave PraxisIssue, PraxisWorkstream, PraxisData, PraxisWorkstreamDetail and PraxisDetailArtefact untouched. The plan changes one interface only."
      - "Expect this task alone to break the Node compilation. Task 1.2 repairs it; do not make the field optional to keep the build green."
    pattern: "src/types/praxis-data.d.ts only."
    imports: "None. This file declares ambient globals and must stay import-free and export-free, or the interfaces stop being global (file header, lines 1-4)."
    compatibility: "PLN-77-v2atsx, Payload contract. The field is required, never optional, so no consumer needs a presence check. It sits beside `type` because both come from the same frontmatter block."
    gotcha: "Adding a top-level import or export to this file turns it into a module and both compilations lose every interface. The field is read by two TypeScript projects (tsconfig.json and src/public/tsconfig.json), so an optional field would silently defeat the compiler check the plan relies on."
    verify:
      - "Run: sed -n '/^interface PraxisArtefact/,/^}/p' src/types/praxis-data.d.ts | grep -c 'title: string;' — must return 1. It returned 0 at base_commit fcdd0da."
      - "Run: npx tsc -p tsconfig.json --noEmit — must report exactly one error, TS2741 at src/lib/extract.ts(158,13), Property 'title' is missing. This is the discriminating check: the same command exits 0 with no output at base_commit fcdd0da, and the error proves the field is required rather than optional. Task 1.2 clears it."
    checklist:
      - "Does PraxisArtefact declare title as a required string, not an optional one?"
      - "Does title sit between type and status, as the plan's contract shows?"
      - "Is the file still free of any top-level import or export statement?"
      - "Are PraxisIssue, PraxisWorkstream, PraxisData and PraxisWorkstreamDetail unchanged?"
      - "Is the only tsc error the expected TS2741 at src/lib/extract.ts line 158?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 1.2 Populate `title` in the extractor's artefact entry
    ```yaml
    description: "Fill the new title field from the already-parsed frontmatter in walkWorkstreams, with an empty-string fallback."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/lib/extract.ts
        <<<<<<< SEARCH
              const entry: PraxisArtefact = { id: fmStr(fm.id), type: fmStr(fm.type), status: fmStr(fm.status), updated: fmStr(fm.updated) };
        =======
              const entry: PraxisArtefact = { id: fmStr(fm.id), type: fmStr(fm.type), title: typeof fm.title === 'string' ? fm.title : '', status: fmStr(fm.status), updated: fmStr(fm.updated) };
        >>>>>>> REPLACE
      - "Change nothing else in walkWorkstreams. The artefact sort comparator, the issue-block scan and the pushed workstream record all stay as they are."
    pattern: "src/lib/extract.ts, the per-file loop that builds `entry` (line 158). `fm` is already parsed at line 156, so no second read of the file is needed."
    imports: "None. `parseFrontmatter` and `fmStr` are already in scope in this file."
    compatibility: "PLN-77-v2atsx, Extractor. The guard is the `typeof x === 'string' ? x : ''` shape the same function already applies to `description` and `blocked` at lines 215-216, not the bare `fmStr` cast used for keys the walk requires."
    gotcha: "A `fmStr` cast would put the literal string `undefined` into the payload for a file with no title, which is exactly what the browser index must never index. The extractor must stay ignorant of search: it publishes the title because the title is part of the artefact."
    verify:
      - "Run: grep -c 'fm.title' src/lib/extract.ts — must return 1. It returned 0 at base_commit fcdd0da."
      - "Run: npm run build — must exit 0. It cannot fail at base_commit (the build is green there); it discriminates only in sequence after task 1.1, whose TS2741 error this task clears."
      - "Run: npm run refresh -- --root . --out /tmp/pln77-payload.json, then node -e \"const d=require('/tmp/pln77-payload.json');const a=d.workstreams.flatMap(w=>w.artefacts);console.log(a.length, a.filter(x=>typeof x.title==='string').length)\" — the two numbers must be equal, and neither may be 0. At base_commit fcdd0da the same command printed 169 and 0. Then remove /tmp/pln77-payload.json."
    checklist:
      - "Does every artefact entry in a freshly dumped payload carry a title string (acceptance criterion 7)?"
      - "Does an artefact file with no frontmatter title contribute an empty string rather than the literal `undefined`?"
      - "Is the guard the same shape as the description and blocked guards at lines 215-216?"
      - "Are the artefact sort comparator and the issue-block scan byte-for-byte unchanged?"
      - "Does npm run build pass all three TypeScript projects?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 1.3 Assert the artefact title in the extract suite
    ```yaml
    description: "Extend src/lib/extract.test.ts to assert the fixture's issue-list artefact carries its frontmatter title, and confirm the detail suite still passes."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add one test to src/lib/extract.test.ts. Put it beside the existing per-generation extraction tests, inside the `for (const generation of FIXTURE_GENERATIONS)` loop that starts at line 75, so the assertion is run once per name generation like the two cases above it."
      - "Use the module-local `data(root)` helper at line 152 to reach the fixture workstream's artefacts, find the entry whose `type` is 'issuelist', and assert its `title` equals 'Fixture issues'."
      - "Name the test so its title contains the words `frontmatter title` — the verify step below greps the runner output for that phrase."
      - "Do not modify src/lib/fixture-project.ts. Its ISSUELIST_FILE already declares `title: \"Fixture issues\"` at line 36, and the builder is shared with the detail suite."
    pattern: "src/lib/extract.test.ts only. Tests are Node-side and run with `node --test dist/lib/<name>.test.js` after `npm run build` (file header, line 8)."
    imports: "None beyond what the file already imports — `test` from node:test, `assert` from node:assert/strict, `extractPraxisData` and the shared fixture builder."
    compatibility: "PLN-77-v2atsx, Testing strategy, stage 1 unit. The suite has no DOM harness and gains none here."
    gotcha: "Importing one test file from another registers the imported file's tests twice (file header, lines 19-23) — reach the fixture through fixture-project.js, which extract.test.ts already imports. The fixture writes exactly one artefact file, so `data(root)` returns a one-element array; asserting on a hard-coded index still works but the type filter is what the plan asks for."
    verify:
      - "Run: npm run build && node --test dist/lib/extract.test.js — must report 20 tests, 20 pass, 0 fail. The new test sits inside the FIXTURE_GENERATIONS loop, which runs 2 generations, so one test() call registers 2 tests. At base_commit fcdd0da the same command reported 18 tests, 18 pass, 0 fail."
      - "Run: node --test dist/lib/extract.test.js 2>&1 | grep -c 'frontmatter title' — must return 1 or more. It returned 0 at base_commit fcdd0da."
      - "Run: node --test dist/lib/detail.test.js — must report 9 tests, 9 pass, 0 fail, the same reading as at base_commit fcdd0da. Both suites import the same fixture builder, so this is the regression guard the plan asks for; it cannot fail at base_commit because the fixture is unchanged there."
    checklist:
      - "Does the new test assert the issue-list artefact's title equals the fixture's frontmatter title?"
      - "Does the new test run once per FIXTURE_GENERATIONS entry, like the extraction tests beside it?"
      - "Is src/lib/fixture-project.ts unchanged?"
      - "Does the detail suite still report 9 of 9 passing?"
      - "Does the extract suite report two more tests than the 18 counted at base_commit, one per FIXTURE_GENERATIONS entry?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 2. The search index and the widened match

  ```yaml
  description: "Plan stage 2 — add searchIndex and buildSearchIndex() to src/public/app.ts, call the builder from applyData, rewrite matches() to read the index, then verify the widened search on a running board."
  ```

  - [ ] 2.1 Add the `searchIndex` variable and `buildSearchIndex()`
    ```yaml
    description: "Add a module-scope per-workstream haystack map and the builder that fills it, beside the existing dependency graph."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/app.ts, declare `var searchIndex: Record<string, string> = {};` in the module (IIFE) scope block at lines 46-68, beside the `dependsOn` and `dependedBy` declarations at lines 63-64, so both derived structures live together. Comment it as: workstream id to lowercased haystack."
      - "Add `function buildSearchIndex(): void` immediately after `buildDepIndex()` ends at line 203, matching that function's shape: it reassigns `searchIndex` to a fresh empty object on every call, reads only the module-scope `workstreams` and `issues` arrays, and touches no DOM."
      - "Build each workstream's haystack as the lowercased concatenation, in this order: the workstream's own `id`, `title`, `slug` and `tags` — the same four fields in the same order matches() uses today at line 116 — then each entry of `w.artefacts` contributing its `id` and then its `title`, then the `id` and `title` of every issue in `issues` whose `workstream` equals the workstream's `id`."
      - "Join fields with a single space and lowercase the finished string once. An empty title contributes nothing but its separator."
      - "Grouping the issues by workstream in one pass before the per-workstream loop is preferred over rescanning `issues` for each workstream, but either is acceptable — this runs only on a data change."
      - "The builder must not read sortKey, sortDir, query, activeTags or blockedOnly, must not touch the DOM, and must not know about the card's abbreviated ID form. tagMatch and blockedOnly stay separate filter axes."
    pattern: "src/public/app.ts only — the module-scope declarations at lines 46-68 and the region just after buildDepIndex() at line 203."
    imports: "None. PraxisWorkstream, PraxisArtefact and PraxisIssue are ambient globals from src/types/praxis-data.d.ts, already included by src/public/tsconfig.json."
    compatibility: "PLN-77-v2atsx, Browser search index and Case handling. src/public/tsconfig.json runs with strict: true and target es2020; this module uses `var` and `function` declarations throughout, so match that style rather than introducing const/let/arrow forms beside them."
    gotcha: "This task depends on task 1.1's `title` field being on PraxisArtefact, or the artefact title read will not type-check. A stale dist/ can pair a new bundle with an old payload whose artefacts have no title, so read the artefact title defensively enough that a missing value contributes an empty string and never the literal `undefined`. The tsconfig sets no noUnusedLocals, so the builder compiles cleanly before task 2.2 wires it up."
    verify:
      - "Run: grep -c 'function buildSearchIndex' src/public/app.ts — must return 1. It returned 0 at base_commit fcdd0da, where grep -c searchIndex src/public/app.ts returned 0."
      - "Run: npm run build — must exit 0, proving the browser project type-checks under strict mode with the new declarations."
      - "Run: sed -n '/function buildSearchIndex/,/^  }/p' src/public/app.ts | grep -cE 'document|byId|querySelector|activeTags|blockedOnly|sortKey' — must return 0, proving the builder knows nothing about the DOM or the other filter axes. This step cannot fail at base_commit because the function does not exist there; it guards the plan's stated boundary for the new code."
    checklist:
      - "Is searchIndex declared at module scope beside dependsOn and dependedBy?"
      - "Does the haystack start with the workstream's id, title, slug and tags, in that order?"
      - "Does it then add each artefact's id and title, then each of its issues' id and title?"
      - "Is the finished haystack already lowercased, so no per-keystroke lowercasing is added?"
      - "Does an artefact or issue with an empty title contribute no literal `undefined` to the string?"
      - "Does the builder reference no DOM API, no sort state and no tag or blocked filter state?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 2.2 Call `buildSearchIndex()` from `applyData`
    ```yaml
    description: "Rebuild the search index where the data changes, immediately after the dependency graph."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/public/app.ts
        <<<<<<< SEARCH
            // The graph is rebuilt exactly where the data changes, not in renderBoard,
            // which runs on every keystroke in the search box.
            buildDepIndex();
        =======
            // The graph is rebuilt exactly where the data changes, not in renderBoard,
            // which runs on every keystroke in the search box. The search index is
            // rebuilt here for the same reason, and on the same data.
            buildDepIndex();
            buildSearchIndex();
        >>>>>>> REPLACE
      - "Add no second call site. buildSearchIndex() must never be called from renderBoard()."
    pattern: "src/public/app.ts, inside applyData at line 1225, where `workstreams` and `issues` have both just been assigned at lines 1226-1227."
    imports: "None."
    compatibility: "PLN-77-v2atsx, Browser search index. applyData runs only when the polled response bytes differ from the last applied payload (lines 1181-1185), so the index is rebuilt only on a real data change."
    gotcha: "The call must sit after both `workstreams` and `issues` are assigned, or a workstream indexes no issue titles. Calling it from renderBoard() would rebuild the whole index on every keystroke, which is the cost this design exists to avoid."
    verify:
      - "Run: grep -c 'buildSearchIndex();' src/public/app.ts — must return 1. It returned 0 at base_commit fcdd0da."
      - "Run: grep -n -A1 'buildDepIndex();' src/public/app.ts — the line after the call must be buildSearchIndex(). At base_commit fcdd0da the line after it was blank."
      - "Run: npm run build && grep -c buildSearchIndex dist/public/app.js — must return 1 or more, proving the builder reached the shipped bundle. It returned 0 at base_commit fcdd0da."
      - "Run: grep -n 'buildSearchIndex();' src/public/app.ts — must print exactly one line, and its line number must fall inside applyData, which opens at line 1225, not inside renderBoard, which opens at line 420. One call site in the whole file is what proves the per-keystroke path never rebuilds the index. At base_commit fcdd0da the command printed nothing."
    checklist:
      - "Is buildSearchIndex() called exactly once, from applyData?"
      - "Does the call sit immediately after buildDepIndex(), with both data arrays already assigned?"
      - "Is there no call from renderBoard() or from any per-keystroke path?"
      - "Does the rebuilt bundle at dist/public/app.js contain the builder?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 2.3 Rewrite `matches()` to read the index
    ```yaml
    description: "Turn matches(w, q) into a lookup against searchIndex, with a fallback to the workstream's own four fields."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |
        src/public/app.ts
        <<<<<<< SEARCH
          function matches(w: PraxisWorkstream, q: string) {
            if (!q) return true;
            var hay = (w.id + ' ' + w.title + ' ' + w.slug + ' ' + (w.tags || []).join(' ')).toLowerCase();
            return hay.indexOf(q) !== -1;
          }
        =======
          // Reads the per-workstream haystack built by buildSearchIndex(), which folds
          // the workstream's own four fields together with its artefact and issue IDs
          // and titles. The fallback is not decoration: a gap in the index must never
          // make a card silently unfindable, so a missing entry still matches on the
          // four fields this function used before the index existed.
          function matches(w: PraxisWorkstream, q: string) {
            if (!q) return true;
            var hay = searchIndex[w.id];
            if (hay === undefined) hay = (w.id + ' ' + w.title + ' ' + w.slug + ' ' + (w.tags || []).join(' ')).toLowerCase();
            return hay.indexOf(q) !== -1;
          }
        >>>>>>> REPLACE
      - "Leave the call site at line 443 unchanged. The three filter axes still combine with AND, and tagMatch and isBlocked are untouched."
      - "Leave query normalisation unchanged. renderBoard() already lowercases and trims query once at line 423 before calling matches()."
    pattern: "src/public/app.ts, matches() at lines 114-118. Its single call site is the column filter at line 443."
    imports: "None."
    compatibility: "PLN-77-v2atsx, Browser search index and Case handling. The signature and the empty-query early return are unchanged, so no caller changes."
    gotcha: "Reading a missing key from a Record<string, string> yields undefined under strict mode without a type error, which is why the explicit undefined test is load-bearing rather than defensive noise. Do not lowercase the haystack again here — buildSearchIndex() already stores it lowercased."
    verify:
      - "Run: sed -n '/function matches(/,/^  }$/p' src/public/app.ts | grep -cF 'searchIndex[w.id]' — must return 1. It returned 0 at base_commit fcdd0da."
      - "Run: sed -n '/function matches(/,/^  }$/p' src/public/app.ts | grep -c 'if (!q) return true;' — must return 1, proving the empty-query early return survived the rewrite."
      - "Run: npm run build — must exit 0."
      - "Run: node --test dist/lib/extract.test.js && node --test dist/lib/detail.test.js — must report 20 of 20 and 9 of 9 passing. This is a regression guard on the Node side and cannot fail at base_commit; no browser-side test harness exists in this repository to extend."
    checklist:
      - "Does matches() keep its signature and its empty-query early return?"
      - "Does it read searchIndex[w.id] instead of concatenating the fields inline?"
      - "Does a missing index entry fall back to the workstream's own id, title, slug and tags?"
      - "Is the query lowercased exactly once, in renderBoard, and never again in matches()?"
      - "Is the call site at line 443 unchanged, with the three axes still combined by AND?"
    self_eval:
      passed: false
      failures: []
    ```
  - [ ] 2.4 Run the manual acceptance pass on a live board
    ```yaml
    description: "Confirm the plan's acceptance criteria on this repository's own board. No source file changes in this task."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run npm start and open http://localhost:4173, then click this repository's tile to open its board."
      - "Work through the verify list below in one pass, without reloading between queries — the index is built once per data change, not per keystroke."
      - "Change no source file in this task. If a check fails, record the failure in self_eval and fix it in the owning task (2.1, 2.2 or 2.3), not here."
      - "Stop the server when the pass is complete."
    pattern: "No file changes. Verification only, against a running board served from dist/."
    imports: "A built dist/ — run npm run build first, or let npm start build for you via its prestart script."
    compatibility: "PLN-77-v2atsx, Testing strategy, stage 2 manual. The plan records that matches() and buildSearchIndex() get no automated test, because standing up a DOM harness for src/public/ is a larger change than this fix."
    gotcha: "A stale dist/ pairs a new bundle with an old server: rebuild before testing or artefact titles will be missing and only IDs will match. Assumption 2 of the plan applies — the card's abbreviated form (PLN-77 rendered with a middle dot) is not a supported query, while PLN-77 and 77 both match by substring."
    verify:
      - "Type a plan ID, for example PLN-77-v2atsx: only the workstream that owns that plan stays visible on the board (acceptance criterion 1)."
      - "Type a task-list ID, then an issue-list ID, for example TL-90-8hg6yz and IL-13-b7y4ud: each leaves only the workstream that owns it visible (acceptance criterion 2)."
      - "Type an issue ID beginning ISS-: only the workstream whose issue list holds that issue stays visible (acceptance criterion 3)."
      - "Type a fragment of a plan, task-list or issue-list title: the owning workstream stays visible (acceptance criterion 4)."
      - "Type a fragment of an issue title: the workstream that owns that issue stays visible (acceptance criterion 5)."
      - "Type a workstream ID, then its title, then its slug, then one of its tags, each in mixed case: every one still matches, as it did before this change (acceptance criterion 6)."
      - "Read the #result-count line and the per-column No matches placeholders during the checks above: both report the widened match, with no change to how they are worded (acceptance criterion 8)."
      - "Type a string that belongs to no workstream and no artefact: every column empties and each shows its No matches placeholder."
      - "Clear the search box: every card returns and the result count reports the full set."
    checklist:
      - "Did a plan, task-list, issue-list and issue ID each narrow the board to the right card?"
      - "Did a fragment of a child artefact title narrow the board to the right card?"
      - "Did every workstream-level query — id, title, slug, tag — behave exactly as before?"
      - "Did an unmatched string empty every column, and did clearing the box restore every card?"
      - "Were the #search placeholder, the #filter-chips row and the detail modal left untouched?"
      - "Was no source file changed by this task?"
    self_eval:
      passed: false
      failures: []
    ```

---
id: TL-78-cvo4l8
type: tasklist
workstream: WS-76-de6gt7
slug: board-info-row-count-redundancy
title: "Remove the redundant workstream and issue counts from the board info row"
status: done
created: 2026-08-29
updated: 2026-08-29
author: Anthony Koukoullis
depends_on: [PLN-67-xultmk]
links: []
mode: spec
base_commit: f4f12e7
---

# PRX Tasks

## Remove the redundant workstream and issue counts from the board info row

The board screen's info row (`.toolbar-sub` in `src/public/board.html`) carries a counts
item that reads `N workstreams · M issues`. The KPI strip below it already publishes both
figures: KPI Tile 1 shows `workstreams.length`, and KPI Tile 2's sub-line shows the raw
issue total. The counts item is pure duplication, so PLN-67-xultmk removes the element and
its writer in full.

Two source lines go: the `<span class="tb-meta-item" id="meta-counts"></span>` node in
`src/public/board.html`, and the `byId('meta-counts').textContent = ...` statement inside
`applyData(raw: BoardPayload)` in `src/public/app.ts`. The id `#meta-counts` is retired and
must not be reused. No stub span is kept, no feature flag is added, and the counts are not
relocated into a tooltip or a `title` attribute.

The two edits are one unit. `byId` is `document.getElementById(id)!`, a non-null assertion
the compiler trusts and the runtime does not. If the span goes and the write stays, the
write throws a `TypeError` and aborts `applyData` before `renderKpis` runs and before
`#lower` is revealed, which gives a blank board. Task 1.1 and task 1.2 therefore ship
together in one commit, and task 1.3 gates the pair.

Nothing else changes. `#gen-date`, `#branch-line`, `#branch-name`, `#live-status` and
`#app-version` keep their ids, markup, `hidden` attributes and behaviour. `renderKpis` and
the KPI tiles are untouched. `src/public/styles.css` is untouched — the middot separator
rule generates the separator inside the second element of each adjacent pair, so deleting
an element deletes its own separator, and the `.tb-meta-item:empty` rule is still needed by
`#live-status`.

- [x] 1. Remove the counts item and its writer (plan stage 1 — one atomic change across two files)

  ```yaml
  description: "Delete the #meta-counts span from board.html and its textContent writer from app.ts, then prove the board still builds and renders correctly."
  ```

  - [x] 1.1 Delete the `#meta-counts` span from the board info row markup
    ```yaml
    description: "Remove the empty counts span from the .tb-meta block in src/public/board.html, leaving exactly three .tb-meta-item spans."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Edit src/public/board.html only. Inside the .tb-meta block in the .toolbar-sub div, delete the whole line that holds the counts span."
      - |
        src/public/board.html
        <<<<<<< SEARCH
          <div class="tb-meta">
            <span class="tb-meta-item">Generated <strong id="gen-date">—</strong></span>
            <span class="tb-meta-item" id="meta-counts"></span>
            <span class="tb-meta-item" id="branch-line" hidden>Branch <strong id="branch-name"></strong></span>
        =======
          <div class="tb-meta">
            <span class="tb-meta-item">Generated <strong id="gen-date">—</strong></span>
            <span class="tb-meta-item" id="branch-line" hidden>Branch <strong id="branch-name"></strong></span>
        >>>>>>> REPLACE
      - "Do not add a replacement element, a stub span, a comment, or a title attribute in its place."
      - "Leave the surrounding .toolbar-sub div, the .tb-version/#app-version sibling, and every other line in the file exactly as they are."
    pattern: "src/public/board.html — the .tb-meta block inside .toolbar-sub."
    imports: "None. This is a markup deletion with no new dependency."
    compatibility: "PLN-67-xultmk DOM contract. After the change .tb-meta holds exactly three .tb-meta-item spans in this order: the Generated/#gen-date span, the #branch-line span with its hidden attribute and nested #branch-name strong, and the empty #live-status span."
    gotcha: "This edit alone leaves the board broken at runtime, because src/public/app.ts still writes to #meta-counts through a non-null-asserted getElementById. Task 1.2 must land in the same commit. Do not open the board between 1.1 and 1.2. The id meta-counts is retired and must not be reused."
    verify:
      - "grep -n 'meta-counts' src/public/board.html — must return no matches."
      - "grep -c 'tb-meta-item' src/public/board.html — must return 3."
      - "grep -n 'gen-date\\|branch-line\\|branch-name\\|live-status\\|app-version' src/public/board.html — all five ids must still be present, with #branch-line and #app-version keeping their hidden attributes."
    checklist:
      - "Is the #meta-counts span gone from src/public/board.html?"
      - "Does .tb-meta now hold exactly three .tb-meta-item spans, in the order Generated, branch, live-status?"
      - "Do #gen-date, #branch-line, #branch-name, #live-status and #app-version keep their ids, markup and hidden attributes?"
      - "Was no stub span, comment, tooltip or title attribute added in place of the removed element?"
      - "Is src/public/board.html the only file this task changed?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Delete the `#meta-counts` write from `applyData` in the board script
    ```yaml
    description: "Remove the two-line byId('meta-counts').textContent assignment from applyData in src/public/app.ts, with no replacement write."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Edit src/public/app.ts only. Inside applyData(raw: BoardPayload), between the #board-title write and the if (raw.branch) block, delete the two physical lines that assign textContent to #meta-counts."
      - |
        src/public/app.ts
        <<<<<<< SEARCH
            byId('meta-counts').textContent =
              workstreams.length + ' workstreams · ' + issues.length + ' issues';
            if (raw.branch) {
        =======
            if (raw.branch) {
        >>>>>>> REPLACE
      - "Add nothing back: no replacement write, no guarded getElementById lookup, no placeholder comment. applyData must know nothing about counts after this change."
      - "Leave applyData's signature and parameter type unchanged, and leave the #gen-date, #board-title, #branch-name, #branch-line and #lower writes exactly as they are."
    pattern: "src/public/app.ts — the applyData(raw: BoardPayload) function body, near the #gen-date and #board-title writes."
    imports: "None. This is a deletion; the workstreams and issues arrays it read stay in use by other consumers."
    compatibility: "PLN-67-xultmk script contract. byId is document.getElementById(id)! — a non-null assertion, so a surviving write against a removed element throws at runtime, not at compile time. renderKpis (the IIFE later in applyData) is out of scope and keeps reading the same workstreams and issues arrays."
    gotcha: "This edit must land in the same commit as task 1.1. On its own it leaves the duplicated counts markup with nothing filling it, which .tb-meta-item:empty would hide — that intermediate state is not the intended outcome. Do not touch renderKpis while in this file."
    verify:
      - "grep -n 'meta-counts' src/public/app.ts — must return no matches."
      - "npx tsc -p src/public/tsconfig.json --noEmit — must complete with no error under strict mode."
      - "grep -n \"byId('gen-date')\\|byId('board-title')\\|byId('branch-name')\\|byId('branch-line')\\|byId('lower')\" src/public/app.ts — all five writes must still be present."
    checklist:
      - "Is the byId('meta-counts') assignment gone from src/public/app.ts?"
      - "Was nothing added in its place — no replacement write, no guarded lookup, no comment?"
      - "Do applyData's signature, parameter type and every other write in that block stay unchanged?"
      - "Is renderKpis (the KPI tile builder) byte-for-byte unchanged?"
      - "Is src/public/app.ts the only file this task changed?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Gate the paired change with the build, the grep and a board read
    ```yaml
    description: "Prove the combined 1.1 and 1.2 change builds clean, retires the id repo-wide, and renders the info row correctly in all three data states."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Change no source file in this task. It is the acceptance gate for tasks 1.1 and 1.2 together, and it runs only after both have landed."
      - "Run the project build and confirm it completes clean, including the strict type-check of src/public/app.ts and the eval guard in tools/bundle-public.mjs."
      - "Run the plan's grep gate across src/, electron/ and tools/ and confirm the id is gone from the whole repository."
      - "Confirm src/public/styles.css carries no change from this workstream."
      - "Open a project board and read the info row in three data states: branch present, branch absent, and before the first poll completes. In each state confirm exactly one middot between each pair of visible items, no leading or trailing middot, and no workstream count or issue count anywhere in the row."
      - "On the same board confirm KPI Tile 1 still shows the workstream total, KPI Tile 2 still shows the open-issue count over its 'filed total across all issue lists' sub-line, the #lower section is revealed, and the browser console is clean."
    pattern: "Whole-change verification. Reads src/public/board.html, src/public/app.ts and src/public/styles.css; writes none of them."
    imports: "The project's own npm build chain: tsc, tools/copy-assets.mjs and tools/bundle-public.mjs."
    compatibility: "PLN-67-xultmk acceptance criteria 1 through 8. dist/ is generated output — tools/copy-assets.mjs copies board.html verbatim and tools/bundle-public.mjs re-bundles app.js, so no compiled file is hand-edited."
    gotcha: "Run this only after both 1.1 and 1.2 are applied. Running it after 1.1 alone gives a blank board and a console TypeError, which is the broken intermediate state, not a real failure of the change. A stale dist/ can mask the fix, so let npm run build rebuild before reading the board."
    verify:
      - "npm run build — must complete with exit code 0 and no type error or eval-guard failure."
      - "grep -rn 'meta-counts' src/ electron/ tools/ — must return zero matches."
      - "git diff --stat -- src/public/styles.css — must report no change to that file."
      - "git diff --stat -- src/public/ — must list src/public/board.html and src/public/app.ts only, one deleted line and two deleted lines respectively."
    checklist:
      - "Does npm run build complete clean, including the strict type-check and the eval guard?"
      - "Does grep -rn 'meta-counts' src/ electron/ tools/ return zero matches?"
      - "Does the info row show the generated date, the branch when present and the live status, with exactly one middot between visible items and none leading or trailing, in all three data states?"
      - "Does the info row show no workstream count and no issue count in any data state?"
      - "Are the KPI tiles unchanged, with #lower revealed and the browser console free of errors?"
      - "Is src/public/styles.css unchanged, and are src/public/board.html and src/public/app.ts the only changed files?"
    self_eval:
      passed: true
      failures: []
    ```

---
id: TL-16-dcvng1
type: tasklist
workstream: WS-15-o60iyw
slug: task-count-vs-tasks-tab-mismatch
title: "Child-count cue on collapsed parent rows in the Tasks tab"
status: done
created: 2026-08-07
updated: 2026-08-08
depends_on: [PLN-13-2t0o9i]
links: []
mode: spec
base_commit: dc47e01
---

# PRX Tasks

## Child-count cue on collapsed parent rows in the Tasks tab

The detail modal labels its Tasks tab `Tasks (N)`, where `N` counts parents and children
alike. At rest the tab body shows only the top-level rows, so a workstream with 4 parents
and 20 children reads `Tasks (24)` above 4 rows. That looks like data loss. It is not —
the children are in the payload and appear on expand.

This work adds one inline text span to the `<summary>` row of every collapsed parent task,
reading `N subtasks` (or `1 subtask`). The reader can then add the visible rows to the
visible cue numbers and land on the tab label. It is a client-side presentation change
only: no package, no server route, no wire shape, no extraction change, and no change to
`countTasks()` or the tab label text.

Two files change: `src/public/app.ts` (`buildTaskGroup()`) and `src/public/styles.css`
(one new `.ws-task-count` rule). Phase 2 is a manual walkthrough against named fixtures,
because this repository has no test framework and no lint script.

- [x] 1. Build the cue

  ```yaml
  description: "Phase 1 of PLN-13 — add the child-count span in buildTaskGroup() and the .ws-task-count rule in styles.css."
  ```

  - [x] 1.1 Add the child-count span to `buildTaskGroup()` in `src/public/app.ts`
    ```yaml
    description: "Append a fourth span to the parent group's summary row, reading the parent's child count, plus a one-line comment recording the caller invariant."
    issues: []
    implement:
      - "Anchor: function buildTaskGroup() in src/public/app.ts, the summary row built from three el() spans immediately before d.appendChild(sum)."
      - "Append one further span with class 'ws-task-count' after the 'ws-item-title' span. Its text is task.children.length followed by ' subtask' when the count is 1, and ' subtasks' otherwise."
      - "Build the string inline with a ternary. There is exactly one call site, so no helper function is added. The inline ternary matches the check-glyph ternary already on the line above."
      - "Add NO guard for a zero count. renderTasksPanel() is the sole caller and already branches on task.children.length, so zero cannot reach here. Record that invariant in a one-line comment in the style of the existing comments above buildTaskGroup() and inside renderTasksPanel()."
      - "Do not touch lazyBody(). The cue must render on the collapsed row without the lazy body ever having run."
      - "Do not touch buildItem(), countTasks(), setTabLabels(), or renderTasksPanel()."
      - |
        Apply this block:
        src/public/app.ts
        <<<<<<< SEARCH
            sum.appendChild(el('span', 'ws-item-title', task.title));
            d.appendChild(sum);
        =======
            sum.appendChild(el('span', 'ws-item-title', task.title));
            // renderTasksPanel is the only caller and reaches here only when
            // task.children.length is non-zero, so the cue never reads '0 subtasks'
            // and needs no guard of its own.
            var n = task.children.length;
            sum.appendChild(el('span', 'ws-task-count', n + (n === 1 ? ' subtask' : ' subtasks')));
            d.appendChild(sum);
        >>>>>>> REPLACE
    pattern: "src/public/app.ts only. The SEARCH text is unique because buildItem() passes the bare `title`, not `task.title`."
    imports: "None. el() is already defined in this file. No import statement may be added."
    compatibility: "src/public/tsconfig.json compiles with module: 'none' and noEmitOnError: true, so dist/public/app.js must stay a classic script with no import or export. The file uses `var` and function declarations throughout — match that style. Zero runtime dependencies; add no package."
    gotcha: "Placing the span inside lazyBody() would hide the cue until the parent is expanded, which defeats the feature. Folding the count into the title string is explicitly rejected by PLN-13, because the title span holds the file's own title verbatim. A defensive `n === 0` branch is also rejected — it would duplicate the caller's decision."
    verify:
      - "npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p src/public/tsconfig.json — both complete with no error. This repository has no lint script and no test framework, so `npm run lint` and a bare `npx tsc --noEmit` do not work here."
      - "npm run build — completes with no error."
      - "grep -cE '^[[:space:]]*(import|export)[[:space:]]' dist/public/app.js — must print 0 (acceptance criterion 9)."
      - "git diff -- src/public/app.ts | grep -c 'countTasks' — must print 0 (acceptance criterion 6)."
      - "git diff -- src/public/app.ts | grep -c 'buildItem' — must print 0 (acceptance criterion 7)."
    checklist:
      - "Does the span carry the class name ws-task-count exactly?"
      - "Is the span appended in the summary row, outside lazyBody(), so it renders while the parent is collapsed?"
      - "Does a count of 1 produce '1 subtask' and any other count produce 'N subtasks'?"
      - "Is the file still free of any import or export statement, and free of any new package?"
      - "Are buildItem(), countTasks(), setTabLabels() and renderTasksPanel() all byte-for-byte unchanged?"
      - "Is the caller invariant recorded as a comment rather than as a zero-guard branch?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Add the `.ws-task-count` rule to `src/public/styles.css`
    ```yaml
    description: "Add one flat .ws-task-count rule after the existing parent-group rule, using only existing theme tokens."
    issues: []
    implement:
      - "Anchor: the last rule in src/public/styles.css, `.ws-task-group > .ws-item-summary .ws-item-id { color: var(--accent); }`, which is currently the final line of the file. Place the new rule immediately after it, so all parent-group summary styling stays in one block."
      - "Because this is a pure append at the end of the file, append it with a shell heredoc rather than an in-place edit."
      - |
        The rule, exactly (5 declarations, flat selector):
        .ws-task-count {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--ink-faint);
          margin-left: 8px;
          white-space: nowrap;
        }
      - "Define no new CSS custom property. --font-mono and --ink-faint already exist in all three theme blocks."
      - "Keep the selector flat, not scoped under .ws-task-group, matching how .ws-check, .ws-item-id and .ws-item-title are written."
      - "Do not modify .ws-item-summary. Its `display: list-item` keeps the native <details> disclosure marker, and the comment above it records that as deliberate. Switching it to flex for right-alignment is out of scope."
      - "Do not modify the existing accent tint on `.ws-task-group > .ws-item-summary .ws-item-id`."
      - "Add no `[open]` rule. PLN-13 commits to the cue staying visible when the parent is expanded."
    pattern: "src/public/styles.css only. The file is 793 lines and the anchor is line 793."
    imports: "None. No stylesheet import and no font file."
    compatibility: "--ink-faint is the same token .column-head .count and .result-count already use for count text, so the cue reads as the same class of information and needs no light/dark handling of its own. --font-mono at 11px matches .ws-item-id in the same row."
    gotcha: "Without `white-space: nowrap` the number and the word split across lines when a long parent title wraps — .ws-item-title carries `overflow-wrap: anywhere`, so wrapping is a real case. A `content:` declaration must not be used: the file has none today, and generated content is exposed inconsistently to assistive technology."
    verify:
      - "npm run build — completes with no error, and tools/copy-assets.mjs copies the stylesheet to dist/public/styles.css."
      - "grep -c 'ws-task-count' dist/public/styles.css — must print 1."
      - "grep -c 'content:' src/public/styles.css — must print 0, confirming no generated-content mechanism was introduced."
      - "git diff -- src/public/styles.css — shows an addition only, with no change to .ws-item-summary or to the .ws-task-group accent rule."
    checklist:
      - "Does the new rule sit immediately after the .ws-task-group accent rule?"
      - "Does the rule use only existing tokens, with no new CSS custom property declared?"
      - "Is `white-space: nowrap` present?"
      - "Is `.ws-item-summary` still `display: list-item`, with its comment intact?"
      - "Is the selector flat, with no `.ws-task-group` scoping and no `[open]` rule?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Walk the range and the regressions

  ```yaml
  description: "Phase 2 of PLN-13 — the manual browser walkthrough that stands in for the test suite this repository does not have. Builds nothing. Any defect it finds is fixed in the two files from task 1."
  issues: []
  implement:
    - "Depends on task 1 being complete. Run `npm start`, which rebuilds through prestart, then open the board in a browser."
    - "Fixture 1 — the reported case. Open the project at /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD and open workstream WS-124-service-reference-inconsistencies-issue-list. Child counts are [2, 0, 16, 2]. Confirm four rows at rest, three cues, one leaf with no cue, and 4 + 20 = 24 against the `Tasks (24)` label."
    - "Fixture 2 — singular. Open LAD WS-52-controllers-bug-hunt-round-3. Counts are [15, 8, 1, 3, 7, 2, 2]. The third row must read `1 subtask`, not `1 subtasks`. This repository's own flowcharge/ has no single-child parent, so this check needs the LAD fixture."
    - "Fixture 3 — the wide end. Open LAD WS-50-controllers-bug-hunt-round-1, whose widest parent has 35 children and which has 18 top-level rows including two leaves. Confirm the cue stays on one line and the row layout holds."
    - "Fixture 4 — long titles. In the same fixture, narrow the browser window until a parent title wraps. The cue must stay whole on one line and must not split between its number and its word."
    - "Fixture 5 — expanded state. Expand a parent. The cue stays visible and unchanged, the description and child rows render as before, and each child row carries no cue."
    - "Fixture 6 — regressions. In the same modal, confirm the accent tint on the parent's number, the native disclosure triangle, and the ✓ / ○ glyph all still render. Switch to the Issues tab and confirm no issue row gained a cue."
    - "Fixture 7 — themes. Repeat one modal in light and in dark. The cue must be legible in both."
    - "Fixture 8 — two task lists. Open this repository's own inline-css-extraction workstream, which has two task lists in one Tasks tab. Confirm both sections get cues and the tab label still reconciles across the pair."
    - "Also confirm this repository's card-detail-modal-issues-tasks workstream (counts [9, 5, 7, 4], so 4 + 25 = 29) and git-branch-display (counts [3, 2, 0], so two cues and one leaf with none)."
    - "Change no file in this task unless the walkthrough finds a defect. A defect is fixed in src/public/app.ts or src/public/styles.css only."
  pattern: "No file is edited. Browser walkthrough over this repository's flowcharge/ and the LAD project's flowcharge/."
  imports: "A running dashboard via `npm start`, a browser, and read access to /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD."
  compatibility: "The LAD fixtures are read-only. flowcharge/ is gitignored in these projects, so the fixture files exist on disk only and are in no repository. Open them in the dashboard; never edit them. The untracked bun.lock at this repository's root is pre-existing and must not be staged, edited or removed."
  gotcha: "Fixture counts can drift if a fixture's task list is edited between authoring and execution. If a count no longer matches, re-derive it from the file rather than assuming the plan's number is wrong, and record the drift. Do not use the LAD endpoint test suite or the full LAD workflow for any of this."
  verify:
    - "npm start, then walk fixtures 1 to 8 above in a browser and record the observed cue text for each."
    - "For every workstream opened, confirm by eye: visible top-level rows + sum of the visible cue numbers = the number in the `Tasks (N)` tab label (acceptance criterion 5)."
    - "git status --porcelain — shows no modified file from this task beyond any defect fix, and still shows bun.lock as the only untracked entry."
  checklist:
    - "Does LAD WS-124 reconcile as 4 rows + 20 = 24 against its tab label?"
    - "Does the single-child parent in LAD WS-52 read `1 subtask` in the singular?"
    - "Does the 35-child cue in LAD WS-50 stay on one line, including when a long title wraps?"
    - "Does the cue stay visible and unchanged when a parent is expanded, with no cue on any child row?"
    - "Do the accent tint, the native disclosure triangle and the ✓ / ○ glyph all still render, and does the Issues tab render exactly as before?"
    - "Is the cue legible in both light and dark themes, and do both task lists in inline-css-extraction show cues?"
  self_eval:
    passed: true
    failures: []
    walkthrough: "Run 2026-08-08 against the live dashboard at http://localhost:4173, both projects, no file edited. Fixture 1 — LAD WS-124: label Tasks (78), 18 top-level rows over two sections (TL-174 and TL-175), cues summing 60, so 18 + 60 = 78. The plan's expected counts [2, 0, 16, 2] appear exactly as TL-175's four rows; TL-174's 14 rows are additional and were invisible before the WS-16 fence fix landed, which is why the reported label read 24. Fixture 2 — LAD WS-52: label Tasks (45), 7 rows, counts [15, 8, 1, 3, 7, 2, 2] exactly as planned, third row reads '1 subtask' in the singular, 7 + 38 = 45. Fixture 3 — LAD WS-50: label Tasks (147), 18 rows, widest cue '35 subtasks', two leaves with no cue, 18 + 129 = 147; every cue occupies exactly one client rect. Fixture 4 — viewport narrowed to 524px wide: all 18 titles wrapped and 0 of 16 cues split across lines, confirming white-space: nowrap. Fixture 5 — expanded a parent: cue stayed visible and unchanged at '13 subtasks', 13 child rows rendered matching the cue, 0 child rows carried a cue, description rendered. Fixture 6 — regressions: parent number still var(--accent) rgb(79, 184, 176), .ws-item-summary still display: list-item so the native disclosure marker is intact, check glyph still renders, and 0 of 19 issue rows gained a cue. Fixture 7 — themes: cue colour resolves to the --ink-faint token in both schemes and is byte-identical to the colour .result-count and .column-head .count already use, so it reads as the same class of information; measured contrast in light is 3.86:1 against white at 11px, which is the app's existing standard for count text and not a change introduced here. Fixture 8 — this repository's WS-4 inline-css-extraction: label Tasks (6) over two task-list sections in one tab, 4 rows, 4 + 2 = 6, so the label reconciles across the pair. Also WS-5 card-detail-modal-issues-tasks: label Tasks (29), counts [9, 5, 7, 4], 4 + 25 = 29 as planned; and WS-6 git-branch-display: label Tasks (8), counts [3, 2, 0], two cues and one leaf with none, 3 + 5 = 8 as planned. No defect was found, so no file was edited by this task."
  ```

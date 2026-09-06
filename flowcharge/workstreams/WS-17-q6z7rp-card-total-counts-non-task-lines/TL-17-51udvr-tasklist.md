---
id: TL-17-51udvr
type: tasklist
workstream: WS-17-q6z7rp
slug: card-total-counts-non-task-lines
title: "Card task total counts checkbox lines that are not tasks"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: [IL-4-il5cwb]
links: []
mode: spec
base_commit: 4d7ef84
---

# PRX Tasks

## Card total counts non-task lines

ISS-5 records one defect with one cause. `countChecks()` in `src/lib/extract.ts` counts every
line that looks like `- [ ]`, while the detail modal counts only lines that carry an issue ID
or a task number. Two rules over one file give two numbers, and the user sees both at once:
LAD `WS-74-express-stack-guidance-fixes` reads 98 on the card and 86 in the modal, a gap of
exactly the twelve unnumbered checklist bullets nested inside one task's body.

The modal is correct and the card converges on it. The fix removes the duplication instead of
adding a third rule: the two item-shape constants move from `src/lib/detail.ts` into
`src/lib/extract.ts` as exported constants, `detail.ts` imports them, and `countChecks()`
counts only lines matching the shape that suits the artefact type. That direction is the only
cycle-free one, because `detail.ts` already imports `parseFrontmatter` from `./extract.js`.
The constants move rather than being re-declared because a duplicated pattern is exactly what
produced this drift; the comment above `ISSUE_ITEM` shows the previous author was already
holding the issue side of that pairing together by hand.

Out of scope, deliberately: fence tracking in `countChecks()`, any change to the modal's own
counting, and `countTasks()` in `src/public/app.ts`.

- [x] 1. Count only real items on the board card, per artefact type (ISS-5)

  ```yaml
  description: "Make the card's done/total fraction use the same item shapes the detail modal uses, by moving the two shape constants into extract.ts and making countChecks() shape-aware. Two files change, so one child task per file."
  ```

  - [x] 1.1 Export the item shapes from extract.ts and make countChecks() shape-aware

    ```yaml
    description: "src/lib/extract.ts becomes the single home of the two item-shape regexes and counts a checkbox line only when the shape for that artefact type matches it."
    issues: [ISS-5-b8j9k1]
    implement:
      - "src/lib/extract.ts, in the region above countChecks(): add two exported constants, ISSUE_ITEM and TASK_ITEM, holding the two item shapes that are module-private consts today at src/lib/detail.ts lines 15 and 21. Move them; do not re-type them from the issue text. Carry each constant's existing explanatory comment across unchanged, except for the ISSUE_ITEM comment's self-reference to 'src/lib/extract.ts:76', which must be reworded to point at the issues[] regex now sitting in the same file."
      - "Record on each constant which capture group holds the checkbox mark: group 1 for ISSUE_ITEM, group 2 for TASK_ITEM, because TASK_ITEM's group 1 is the leading whitespace. The executor needs that fact and so does every later reader."
      - "src/lib/extract.ts, countChecks(): give the function the item shape and the mark's capture index as parameters, match each line against that shape instead of the inline /^\\s*-\\s*\\[( |x|X)\\]/, and read the mark from the given capture index instead of from m[1]. Everything else in the function stays as it is. Illustrative only, roughly the new shape of the loop body: `const m = line.match(itemRe); if (m) { total++; if (m[markGroup].toLowerCase() === 'x') done++; }`."
      - "src/lib/extract.ts, walkWorkstreams(), inside the existing `if (fm.type === 'issuelist' || fm.type === 'tasklist')` branch that sets entry.total and entry.done: pass ISSUE_ITEM for an issuelist and TASK_ITEM for a tasklist. That branch already knows the type, so countChecks() must never sniff the type itself."
      - "Do NOT add fence tracking to countChecks(). Fence handling belongs to collectItems() in src/lib/detail.ts, and the shape rule alone is what ISS-5 records. Adding it here would duplicate a second piece of logic and widen the change past the issue."
      - "Leave countChecks() module-private. Nothing outside this file calls it, and exporting it adds reach nobody asked for."
    pattern: "src/lib/extract.ts only. src/lib/detail.ts is task 1.2 and must not be edited here. src/public/app.ts is out of scope entirely."
    imports: "No new import and no new package. Zero runtime dependencies is absolute in this repository and has been defended in every workstream so far. The two constants are DECLARED in extract.ts, so extract.ts still imports nothing from detail.ts — the dependency arrow must stay detail.ts to extract.ts, because detail.ts already imports parseFrontmatter from './extract.js' and the reverse direction would be a module cycle. src/lib is ordinary ESM: relative imports carry a .js extension, matching the existing style exactly."
    compatibility: "tsconfig.json compiles src/lib with strict: true, noEmitOnError: true, module/moduleResolution node16, target es2022. entry.total and entry.done are the optional number fields declared on PraxisArtefact in src/types/praxis-data.d.ts, so their type does not change. The board's shallow issues[] array is built further down walkWorkstreams() by a separate split and match over issue-list files; it is not part of this change and must keep agreeing with the issue-list card total. src/public/ compiles with module: 'none' and is untouched by this task."
    gotcha: "The mark's capture index is the trap. ISSUE_ITEM holds the mark in group 1, TASK_ITEM in group 2, so a countChecks() that keeps reading m[1] will silently take TASK_ITEM's leading whitespace as the mark and report done as 0 or as nonsense for every task list. Do not try to find the mark by scanning the groups for a ' ', 'x' or 'X' value: a task line indented by exactly one space gives TASK_ITEM a group 1 of ' ', which is indistinguishable from an unchecked mark. Pass the index. ISSUE_ITEM is anchored at column zero and TASK_ITEM requires a numeric task number followed by whitespace, so both totals will drop for files that hold checkbox-shaped prose — that is the correction, not a regression. This task leaves the two constants declared in BOTH files for the moment; that duplication is transient, type-checks cleanly and is removed by task 1.2. The dashboard is read-only over other projects' flowcharge/ folders and cannot repair malformed source files. flowcharge/ is gitignored in these projects, so the LAD corpus exists on disk only — read it, never edit it. Capture a baseline extraction JSON over LAD BEFORE editing, so the issue-list totals can be compared afterwards. The untracked bun.lock at the repository root must never be touched."
    verify:
      - "npx tsc --noEmit -p tsconfig.json — substituted for a bare `npx tsc --noEmit`, which resolves no tsconfig from the repository root."
      - "npm run build — substituted for `npm run lint`, which this repository does not define; package.json declares only build, prestart, start, prerefresh and refresh."
      - "npm run refresh -- --root /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD --out /tmp/lad-after.json, then read the artefact of type tasklist under the workstream whose id is WS-74 and confirm its total. Expect 86, down from 98. Re-measure rather than trusting that figure, and record any drift in self_eval."
    checklist:
      - "A task list's card total equals the number of numbered task lines the modal shows for that same file, with LAD WS-74 reading 86 on both."
      - "The done count is still correct for task lists, so a file whose tasks are all checked reports done equal to total and not 0."
      - "Issue-list card totals are unchanged against the pre-edit baseline, and each issue list's total still matches the number of issues the board's shallow issues[] array holds for it."
      - "countChecks() applies no fence logic, and src/lib/detail.ts is byte-identical to its pre-task state."
      - "src/lib/extract.ts imports nothing from src/lib/detail.ts, so no module cycle exists."
      - "No package was added and no dependency appeared in package.json."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Import the shared item shapes into detail.ts instead of re-declaring them

    ```yaml
    description: "src/lib/detail.ts stops declaring its own ISSUE_ITEM and TASK_ITEM and takes both from './extract.js', so one declaration serves both counters."
    issues: [ISS-5-b8j9k1]
    implement:
      - "src/lib/detail.ts, the region between the import block and the FENCE constant: delete the module-private ISSUE_ITEM and TASK_ITEM consts together with the comments that moved to extract.ts in task 1.1, so neither the patterns nor their comments survive in two places. FENCE stays here — it is not shared."
      - "src/lib/detail.ts, the existing `import { parseFrontmatter } from './extract.js';` statement: extend it to bring in ISSUE_ITEM and TASK_ITEM as well, rather than adding a second import from the same module."
      - "Change nothing else. collectItems(), parseIssueItems(), flatTasks(), buildTaskTree() and parseTaskItems() keep their current behaviour, because the modal's counting is already correct and is not what ISS-5 records."
      - "Do not renumber or otherwise reshape the capture groups while moving the patterns. parseIssueItems() reads m[1], m[2] and m[3]; flatTasks() reads m[2], m[3] and m[4]; buildTaskTree()'s comment states that capture 1 of TASK_ITEM is never consulted. All of that must stay true."
    pattern: "src/lib/detail.ts only. src/lib/extract.ts was finished in task 1.1 and is not edited again."
    imports: "ISSUE_ITEM and TASK_ITEM come from './extract.js' — the .js extension is required by moduleResolution node16 and matches the file's existing parseFrontmatter import. No new package. extract.ts must not gain an import from detail.ts, which is why the constants live in extract.ts and travel in this direction only."
    compatibility: "Strict TypeScript, ESM, node16 resolution, target es2022, noEmitOnError. The detail payload shapes PraxisIssueDetail and PraxisTaskDetail are unchanged, so src/public/app.ts needs no edit and must not receive one — it compiles separately with module: 'none'. The comment near buildTaskTree() about capture 1 of TASK_ITEM remains accurate only while the group order is preserved."
    gotcha: "This task depends on task 1.1 having landed; run it second or the imports resolve to nothing. The regexes must not be edited in transit — a stray change to TASK_ITEM's group order would break flatTasks()'s m[2]/m[3]/m[4] reads and buildTaskTree() would then throw its 'task tree lost N of M tasks' guard, or worse, mis-key the parent map. The comment above ISSUE_ITEM explains why the shape matches the board's issues[] regex; it belongs with the constant in extract.ts now, so do not leave a copy behind. detail.ts's own str() helper and the note that extract.ts's fmStr is not exported and must not become exported both still stand — this task exports the two constants, nothing else."
    verify:
      - "npx tsc --noEmit -p tsconfig.json — substituted for a bare `npx tsc --noEmit`, which resolves no tsconfig from the repository root."
      - "npm run build — substituted for `npm run lint`, which this repository does not define."
    checklist:
      - "Each item shape is declared in exactly one place in the codebase, and neither pattern appears twice."
      - "The detail modal's issue list and task tree render the same items as before the change for a sampled workstream, including nesting."
      - "No module cycle exists: detail.ts imports from extract.ts and extract.ts imports nothing from detail.ts."
      - "No caller of the detail payload is broken; src/public/app.ts is unedited and still compiles."
      - "The explanatory comments that travelled with the constants exist once, in extract.ts, and none was dropped."
    self_eval:
      passed: true
      failures: []
    ```

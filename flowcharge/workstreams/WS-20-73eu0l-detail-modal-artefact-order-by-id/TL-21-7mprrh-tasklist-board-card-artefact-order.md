---
id: TL-21-7mprrh
type: tasklist
workstream: WS-20-73eu0l
slug: detail-modal-artefact-order-by-id
title: "Board card artefact order by type then ID"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: [PLN-16-1x7tg5]
links: []
mode: spec
base_commit: 72e3fef
---

# PRX Tasks

## Board card artefact order by type, then by artefact ID

A board card lists a workstream's artefact rows in raw `readdirSync` order, so LAD's
WS-124 card reads `IL·85`, `IL·84`, `TL·174`, `TL·175`. A hyphen is byte `0x2D` and a
full stop is `0x2E`, so `issuelist-<qualifier>.md` always precedes
`issuelist.md`, whatever IDs the two files hold.

This is the second pass under WS-20. The first pass (TL-19, commit `2fe5500`) fixed the
same symptom in the detail modal, inside `extractWorkstreamDetail()` in
`src/lib/detail.ts`. That function feeds a different route and could never have reached
the card. This is a parallel defect, not a regression.

PLN-16 adds one comparator to `walkWorkstreams()` in `src/lib/extract.ts`, applied to the
`artefacts` array after the file loop closes and before `out.push`. The comparator ranks
by artefact type first (plan 0, issue list 1, task list 2, anything else last), then by
the numeric part of the ID ascending, then by the ID string as a total-order tie-break.
The `artefactIdNumber()` helper moves from `src/lib/detail.ts` into `src/lib/extract.ts`
and is exported there, so one rule serves both surfaces.

Two files change. No new package, no type change, no client change, and no change to any
count or KPI. Phase 1 is a behaviour-free move, kept separate so an import or cycle
failure is diagnosed before any visible order change.

Out of scope, per PLN-16: the detail modal's own two sorts, the card sort in
`src/public/app.ts`, the `issues[]` array built inside the same file loop, WS-21, any
change to `src/types/praxis-data.d.ts`, and adding a test framework.

Verification note: this repository has no lint script and no test framework, and a bare
`npx tsc --noEmit` resolves neither tsconfig. The working equivalents used below are
`npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p src/public/tsconfig.json`,
`npm run build`, a read-only replay of this repository's own extraction over the LAD
corpus, and a browser walkthrough.

- [x] 1. Phase 1 — Move the helper, change no behaviour

  ```yaml
  description: "Move artefactIdNumber() from src/lib/detail.ts into src/lib/extract.ts, export it there, and consume it from detail.ts. Zero behaviour change."
  ```

  - [x] 1.1 Add the exported `artefactIdNumber()` helper to `src/lib/extract.ts`
    ```yaml
    description: "Add artefactIdNumber() to src/lib/extract.ts as an exported function, with a comment rewritten for its new home."
    issues: []
    implement:
      - "Open src/lib/extract.ts. The anchor is the module-scope region between the exported TASK_ITEM regex and the countChecks() function."
      - "Add an exported function artefactIdNumber(id: string): number there. Its body is moved verbatim from src/lib/detail.ts and must not change: take Number() of the substring after the final hyphen, and return it only when Number.isFinite() holds, otherwise 0."
      - "Follow the file's established export-for-detail.ts pattern: ISSUE_ITEM and TASK_ITEM are already exported from this file for detail.ts to consume, each carrying a comment that states why."
      - "Rewrite the comment for the new home. It must say that the number orders a set of ids that ALREADY share a prefix, and that grouping by type is what supplies that precondition on the board side. The old wording claims every id in one result array shares a prefix, which is true of detail.ts and false of the board's mixed artefacts array."
      - "The rewritten comment must not name str(), which lives in detail.ts and is not in scope here. State the fallback in terms of the helper itself: an id carrying no parsable number falls back to 0, never NaN, because a NaN sort key makes sort order implementation-defined."
      - "Illustrative only, not literal — the body to preserve is: const n = Number(id.slice(id.lastIndexOf('-') + 1)); return Number.isFinite(n) ? n : 0;"
      - "Do not add any import to src/lib/extract.ts. It must never import from src/lib/detail.ts — that is the cycle this move direction exists to avoid."
    pattern: "src/lib/extract.ts only. No other file changes in this task."
    imports: "None added. The helper needs no import: it uses only Number, Number.isFinite and String.prototype.slice."
    compatibility: "Ordinary ESM under tsconfig.json; relative imports in src/lib/ carry .js extensions. The helper must not throw when id holds a string[] at runtime, which fmStr() at line 29 permits because it asserts rather than coerces. It currently returns 0 in that case, through Array.prototype.slice and Number() of an array. Preserve that behaviour exactly."
    gotcha: "Re-declaring the helper instead of moving it is what caused WS-17 / ISS-5 — two hand-maintained copies of the task-line rule across these same two files drifted, and the card read 98 where the modal read 86. Do not leave a second copy behind. Also, an id such as 'IL-84' has its number after the FINAL hyphen, so lastIndexOf is load-bearing."
    verify:
      - "npx tsc --noEmit -p tsconfig.json"
      - "npx tsc --noEmit -p src/public/tsconfig.json"
      - "grep -c \"from './detail\" src/lib/extract.ts — must print 0 (acceptance criterion 12)."
      - "grep -n 'export function artefactIdNumber' src/lib/extract.ts — must print exactly one line."
    checklist:
      - "Is artefactIdNumber exported from src/lib/extract.ts?"
      - "Is the function body byte-for-byte the same logic as the detail.ts original, including the Number.isFinite fallback to 0?"
      - "Does the rewritten comment state the shared-prefix precondition and name type grouping as what supplies it on the board side?"
      - "Is str() absent from the rewritten comment?"
      - "Does src/lib/extract.ts still import nothing from src/lib/detail.ts?"
      - "Do both tsconfig projects type-check with no error?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Delete the `src/lib/detail.ts` copy and import the helper instead
    ```yaml
    description: "Remove the module-private artefactIdNumber() from src/lib/detail.ts and add the name to the existing ./extract.js import."
    issues: []
    implement:
      - "Open src/lib/detail.ts. Add artefactIdNumber to the existing import from './extract.js'. That edit is small, mechanical and single-location, so it is given as a literal block:"
      - |
        src/lib/detail.ts
        <<<<<<< SEARCH
        import { ISSUE_ITEM, TASK_ITEM, parseFrontmatter } from './extract.js';
        =======
        import { ISSUE_ITEM, TASK_ITEM, artefactIdNumber, parseFrontmatter } from './extract.js';
        >>>>>>> REPLACE
      - "Then delete the local artefactIdNumber() declaration and its whole leading comment block. The anchor is the region between the str() helper and the WorkstreamLocation interface."
      - "Change nothing else in src/lib/detail.ts. The two sorts inside extractWorkstreamDetail() that call artefactIdNumber() are already correct and stay exactly as they are — they are named out of scope by PLN-16, beyond this import line."
    pattern: "src/lib/detail.ts only. Depends on task 1.1 having exported the helper first."
    imports: "artefactIdNumber joins the existing named import from './extract.js'. Keep the .js extension — src/lib/ is ordinary ESM."
    compatibility: "detail.ts already imports from extract.js, so the direction is established and no cycle is created. Nothing in the repository imports detail.ts."
    gotcha: "Delete the comment block above the function as well as the function; a stranded comment describing a moved helper is exactly the drift WS-17 / ISS-5 punished. Do not delete str(), which sits directly above it and is still used throughout detail.ts."
    verify:
      - "npx tsc --noEmit -p tsconfig.json"
      - "npx tsc --noEmit -p src/public/tsconfig.json"
      - "npm run build"
      - "grep -c 'function artefactIdNumber' src/lib/detail.ts — must print 0."
      - "npm start, then open a board and open the detail modal for a workstream holding both a qualified and a plain artefact file. Confirm the Issues tab and the Tasks tab still read in ascending ID order. Board cards are unchanged at this point, by design."
    checklist:
      - "Is the local artefactIdNumber() declaration gone from src/lib/detail.ts, together with its leading comment?"
      - "Does the './extract.js' import now list artefactIdNumber, with the .js extension kept?"
      - "Are the two sorts inside extractWorkstreamDetail() unchanged?"
      - "Is str() still present and still used?"
      - "Do both tsconfig projects type-check and does npm run build succeed?"
      - "Does the detail modal still list Issues and Tasks in ascending ID order?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — Add the comparator to `walkWorkstreams()` and confirm the order
  ```yaml
  description: "Add ARTEFACT_TYPE_RANK, UNRANKED_TYPE and one artefacts.sort(...) call to walkWorkstreams() in src/lib/extract.ts, after the file loop closes and before out.push."
  issues: []
  implement:
    - "Open src/lib/extract.ts. At module scope, above walkWorkstreams(), declare the type ranking: ARTEFACT_TYPE_RANK as Record<string, number> holding plan 0, issuelist 1, tasklist 2, and UNRANKED_TYPE as 3."
    - "Comment that declaration with why the order is not alphabetical: neither the labels (IL, PLN, TL) nor the frontmatter keys (issuelist, plan, tasklist) sort into plan-issues-tasks alphabetically, and both put the plan second. Also state that 'workstream' is deliberately not ranked, because workstream.md is skipped by filename inside the walk, so a workstream-typed file only reaches the array under another name and lands in the trailing bucket."
    - "Inside walkWorkstreams(), sort the artefacts array between the close of the per-file for loop and the out.push({...}) call. At that point the array is complete and the issues[] pushes inside the loop have already happened."
    - "The comparator ranks by type first, then by artefactIdNumber(id) numerically, then by the id string using < and >. Illustrative only, not literal: const ra = ARTEFACT_TYPE_RANK[a.type] ?? UNRANKED_TYPE; const rb = ARTEFACT_TYPE_RANK[b.type] ?? UNRANKED_TYPE; if (ra !== rb) return ra - rb; const na = artefactIdNumber(a.id); const nb = artefactIdNumber(b.id); if (na !== nb) return na - nb; return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;"
    - "Comment the sort with why the string tie-break exists: it is what makes the comparator TOTAL. Stability is not enough, because what a stable sort preserves here is readdirSync order, and this walk never sorts its listing, unlike detail.ts which sorts its listing explicitly."
    - "Touch nothing else. The issues[] pushes at the top of the loop, src/public/app.ts, src/types/praxis-data.d.ts and src/scripts/extract-praxis-data.ts all stay exactly as they are."
  pattern: "src/lib/extract.ts only. Depends on task 1.1 for the exported artefactIdNumber()."
  imports: "None added. artefactIdNumber() now lives in this same file, so it is called directly and is not imported."
  compatibility: "PraxisArtefact and PraxisWorkstream in src/types/praxis-data.d.ts keep every field and every type — only the array's order changes. src/public/app.ts renders w.artefacts in the order it receives and must keep doing so. The JSON that npm run refresh writes inherits the same order for free, because both read the same array."
  gotcha: "Three properties are load-bearing and each has a named failure mode. First, '?? UNRANKED_TYPE' is required, not defensive habit: fmStr() asserts and never coerces, so a.type is typed string but holds undefined when the key is absent, and undefined - undefined is NaN, which makes the whole sort implementation-defined. Second, the number comparison must be numeric, not string: a string comparison breaks seven LAD workstreams, for example WS-75-file-service (TL-53, TL-164, TL-165) and WS-103 (TL-78, TL-172). Third, the final tie-break must use < and >, never localeCompare, which depends on the runtime's locale and ICU build and would put back the machine dependence the tie-break exists to remove. Also, placing the sort inside the file loop instead of after it would sort a partial array on every iteration."
  verify:
    - "npx tsc --noEmit -p tsconfig.json"
    - "npm run build"
    - "grep -c 'localeCompare' src/lib/extract.ts — must print 0."
    - "grep -c \"from './detail\" src/lib/extract.ts — must print 0 (acceptance criterion 12)."
    - "npm start, then check by eye on the named cards: LAD WS-124 reads IL·84, IL·85, TL·174, TL·175; this repository's inline-css-extraction reads PLN·1, IL·1, TL·1, TL·2; LAD WS-55 reads IL·23, IL·81, IL·82, IL·83, TL·40, TL·166, TL·169; LAD WS-156 reads PLN·33, IL·79, TL·149, TL·150 (acceptance criteria 3 to 6)."
    - "Replay this repository's own extraction read-only over the LAD corpus and confirm the 17 wrong workstreams now read correctly and no previously correct workstream has changed. Write the dump outside the LAD tree, which is read-only: npm run refresh -- --root /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD --out <scratch>/lad-after.json. Capture the same dump before the change for the comparison."
    - "Run the same replay twice over the same folder and diff the two dumps. The artefacts order must be identical (acceptance criterion 7)."
    - "In the running board, confirm every open-issue count, severity chip, task-completion KPI and 'Needs attention' count holds the value it holds today (acceptance criterion 11)."
    - "Confirm the artefacts arrays in the refresh JSON carry the same order as the cards (acceptance criterion 10)."
  checklist:
    - "Do all board cards group rows as plan, then issue list, then task list, with any other type after all three?"
    - "Within one type group, do rows ascend by the ID number compared as a number, so IL·9 precedes IL·85?"
    - "Do the four named fixture cards read exactly as acceptance criteria 3 to 6 state?"
    - "Does the sort call sit after the per-file loop closes and before out.push, so the issues[] pushes are untouched?"
    - "Does an artefact with an absent type fall into the single trailing bucket rather than producing an undefined sort key, and does an artefact whose id carries no parsable number sort as 0 rather than NaN, with no throw?"
    - "Do two runs of the extraction over the same folder produce byte-identical artefact order, with no localeCompare anywhere?"
    - "Do every open-issue count, severity chip, task-completion KPI and 'Needs attention' count hold their present values?"
    - "Are src/public/app.ts and src/types/praxis-data.d.ts both unchanged?"
  self_eval:
    passed: true
    failures: []
  ```

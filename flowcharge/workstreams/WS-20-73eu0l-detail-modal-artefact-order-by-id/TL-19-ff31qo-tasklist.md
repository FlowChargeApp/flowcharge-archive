---
id: TL-19-ff31qo
type: tasklist
workstream: WS-20-73eu0l
slug: detail-modal-artefact-order-by-id
title: "Detail modal artefact ordering fixes"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: [IL-5-tioy3x]
links: []
mode: spec
base_commit: d3046c8
---

# PRX Tasks

## Detail modal artefact order by ID

The workstream detail modal shows one section per artefact, and each section
header prints the artefact ID. `extractWorkstreamDetail()` in `src/lib/detail.ts`
builds `issueLists` and `taskLists` by walking the workstream folder in
filename-ascending order, so the visible IDs do not ascend. A hyphen sorts before
a full stop in ASCII, so `issuelist-<qualifier>.md` always precedes
`issuelist.md`, whatever IDs the two files carry.

The correction orders the two result arrays by artefact ID after the walk. Three
decisions are already fixed and are not open to the executor. Order by artefact
ID, because the ID is what the reader sees and the filename is never shown. Keep
`issueLists` and `taskLists` as two separate arrays feeding two separate tabs —
do not interleave them and do not change the tab structure. Change no client
file: `src/public/app.ts` and `src/public/board.html` stay untouched, because the
client renders whatever order it receives.

- [x] 1. Order the detail payload's artefact sections by artefact ID

  ```yaml
  description: "Sort issueLists and taskLists by artefact ID in extractWorkstreamDetail(), so the modal's section headers ascend numerically."
  issues: [ISS-6-quhxra]
  implement:
    - "In src/lib/detail.ts, add one module-level comparison helper beside the existing str() helper, above the WorkstreamLocation interface. It takes an artefact id string such as 'IL-84' or 'TL-175' and returns the number after the final hyphen, for use as a sort key. Every id inside one array shares a prefix, so the number alone orders that array correctly. Illustrative only, not literal: `function idNum(id: string): number { const n = Number(id.slice(id.lastIndexOf('-') + 1)); return Number.isFinite(n) ? n : 0; }`"
    - "In src/lib/detail.ts, inside extractWorkstreamDetail(), after the `for (const file of fs.readdirSync(found.dir).sort())` loop closes and before the returned object literal that carries `issueLists` and `taskLists`, sort each of the two arrays in place, ascending, by the helper applied to its entry's `artefact.id`. Sort the two arrays separately — they stay separate collections."
    - "Update the two-line comment that currently begins 'readdirSync order is not guaranteed sorted on every platform' so it still records why the explicit .sort() on the walk exists, and no longer claims the two lists come back in filename-ascending order. Display order is now set after the walk, by ID."
    - "Do not remove or weaken the `.sort()` on `fs.readdirSync(found.dir)`. It is what makes the walk deterministic across platforms, and deleting it reintroduces platform-dependent output."
  pattern: "src/lib/detail.ts only. src/public/app.ts, src/public/board.html and src/lib/extract.ts must not change."
  imports: "No new import and no new package. The repository has zero runtime dependencies and that is absolute. detail.ts already imports node:fs, node:path, ISSUE_ITEM/TASK_ITEM/parseFrontmatter from './extract.js' and parseYamlBlock from './yaml-block.js'; none of these need touching. The detail payload types (PraxisDetailArtefact, PraxisIssueListDetail, PraxisTaskListDetail) are ambient globals declared in src/types/praxis-data.d.ts, so they need no import statement."
  compatibility: "src/lib/ is ordinary ESM and uses .js extensions on relative imports — keep that if any import is added, though none should be. tsconfig.json sets target es2022 with strict true, so Array.prototype.sort is stable and ties keep the walk's filename order. The helper must be a plain local function in this module: extract.ts's own private helpers are not exported and must not become exported by this workstream. src/public/tsconfig.json compiles with module 'none', but that constrains src/public/ only and nothing here touches it."
  gotcha: "A plain string sort on the id is the same class of defect as the one being fixed — it puts IL-9 after IL-85. The numeric part must compare numerically. Do not build a general natural-sort utility for this; all ids inside one array share a prefix, so the number after the hyphen is sufficient (YAGNI). str(fm.id) returns '' when an artefact's frontmatter carries no id, so the comparator must never yield NaN — a NaN key makes sort order implementation-defined and non-deterministic, which is the very failure being fixed. Give unparsable ids a fixed fallback number. The interleaving question (whether issue lists and task lists should share one ordered collection) is deliberately open in ISS-6 and must not be answered here. The dashboard is read-only over other projects' flowcharge/ folders — read the LAD fixture, never write to it. The untracked bun.lock at the repository root must not be touched."
  verify:
    - "npx tsc --noEmit -p tsconfig.json"
    - "npm run build"
  checklist:
    - "For LAD workstream WS-124, the Issues tab presents IL-84 before IL-85, and the Tasks tab presents TL-174 before TL-175."
    - "An id whose number is smaller but shorter sorts first — IL-9 precedes IL-85 — proving numeric and not lexical comparison."
    - "The directory walk still calls .sort() on fs.readdirSync(found.dir), so the walk stays deterministic across platforms."
    - "issueLists and taskLists remain two separate arrays with unchanged shapes, and no artefact moved between them."
    - "No file outside src/lib/detail.ts changed, and no package was added."
    - "This repository's own inline-css-extraction workstream still shows both of its task lists in one Tasks tab, in ascending TL order."
  self_eval:
    passed: true
    failures: []
  ```

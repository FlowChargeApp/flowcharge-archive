---
id: TL-31-m0bhqi
type: tasklist
workstream: WS-35-970q8q
slug: new-id-format-compatibility-bugs
title: "New artefact ID format compatibility bugs"
status: done
created: 2026-08-17
updated: 2026-08-17
author: Anthony Koukoullis
depends_on: [IL-6-ngnx6e]
links: []
mode: spec
base_commit: 34f6a2e
---

# PRX Tasks

## New artefact ID format compatibility bugs

Praxis artefact ids gained an optional final segment: `TYPE-N` became `TYPE-N-SUFFIX`, where
`SUFFIX` is exactly six lowercase base-36 characters (`[0-9a-z]{6}`). Three sites in this
dashboard were written before that change and still assume the bare `TYPE-N` shape. The
server rejects a suffixed workstream id with HTTP 400 (ISS-7). The issue-line parser drops
suffixed issues silently, with no error and no warning (ISS-8). The artefact sort key reads
the random suffix instead of the sequence number (ISS-9).

Both shapes are live at the same time. A count across every project this dashboard tracks
found old-shape-only projects, fully new-shape projects, and — decisively — this dashboard's
own `flowcharge/` tree holding 86 old-shape and 5 new-shape artefacts together. So the suffix
must be an OPTIONAL group in one pattern that matches both shapes at once. A per-project
switch cannot work.

`src/server.ts` and `src/lib/extract.ts` compile together as one Node ESM build, and
`server.ts` already imports from `extract.ts`. The three tasks below therefore share ONE
exported source fragment for the optional suffix, declared in `extract.ts` by task 1 and
consumed by tasks 2 and 3. That is the only new export. Nothing else is added: no new module,
no id-parsing abstraction, no option, no capability. Run the tasks in number order, because
tasks 2 and 3 consume what task 1 declares.

- [x] 1. Recognise suffixed issue ids in all three issue-line patterns

  ```yaml
  description: "Make the three issue-checkbox patterns in extract.ts accept an optional six-character id suffix, so suffixed issues stop vanishing from the extracted data."
  author: Anthony Koukoullis
  issues: [ISS-8-8httpx]
  implement:
    - "In src/lib/extract.ts, immediately above the exported ISSUE_ITEM constant (line 53), declare and export one string constant holding the optional-suffix regex source fragment for the TYPE-N-SUFFIX shape. It is a source fragment, not a RegExp, because two of its three consumers embed it inside a larger pattern. Give it a comment stating that SUFFIX is exactly six lowercase base-36 characters and that the group must stay OPTIONAL so both id shapes match."
    - "Rebuild ISSUE_ITEM (line 53) from that fragment so the id capture accepts an optional suffix. The suffix must sit inside the EXISTING id capture group as a NON-capturing group — see the compatibility note. Illustrative, not literal: `export const ID_SUFFIX = '(?:-[0-9a-z]{6})?';` then `export const ISSUE_ITEM = new RegExp(String.raw`^-\\s*\\[([ xX])\\]\\s*(ISS-\\d+${ID_SUFFIX})\\.\\s*(.*)$`);`"
    - "Rebuild the block-splitting pattern inside walkWorkstreams' issuelist branch (line 130, the `text.split(...)` lookahead) from the same fragment. This pattern has no capture groups; keep it that way."
    - "Rebuild the per-block match pattern on the next line (line 132, `b.match(...)` assigned to `idm`) from the same fragment. It is deliberately unanchored and cannot simply reuse ISSUE_ITEM, whose `^` and `$` anchors and missing `m` flag stop it matching inside a multi-line block. Keep its three capture groups in their current order."
    - "Update the comment block at lines 49-51, which asserts ISSUE_ITEM is character-identical in shape to the issues[] block pattern, so it now records that all three patterns compose from the one shared fragment."
  pattern: "src/lib/extract.ts — the ISSUE_ITEM export at line 53, and the block-split and per-block patterns at lines 130 and 132 inside walkWorkstreams."
  imports: "No new package or module import. This task ADDS one export to src/lib/extract.ts that tasks 2 and 3 import; nothing else in the repo may be renamed to suit it. Composition needs String.raw or an escaped string literal, both plain TypeScript."
  compatibility: "ISSUE_ITEM's capture groups are consumed POSITIONALLY by two callers, so the suffix group MUST be non-capturing. extract.ts:123 passes markGroup 1 into countChecks for the done/total counts. src/lib/detail.ts:106-112 reads entry.m[1] as the checkbox mark, entry.m[2] as the id and entry.m[3] as the title. Writing the suffix as its own capturing group shifts the title to m[4] and silently breaks both. Both id shapes must match: bare ISS-18 and suffixed ISS-18-awinon. FRONTMATTER at line 15 documents why no pattern here carries the g flag; do not add one to the rebuilt patterns, or lastIndex state will leak between callers."
  gotcha: "The line-130 split pattern is a lookahead used to cut the file into per-issue blocks. If its suffix handling drifts from line 132's, blocks split at one set of lines while ids are read from another, and issues are mis-attributed rather than merely lost. If line 53 drifts from line 130-132, the artefact done/total counts and the extracted issues[] array disagree — the exact split-brain the existing comment warns about. Escaping is the likely error: inside String.raw a backslash is literal, inside a plain string it needs doubling. Note that a lowercase base-36 suffix can be all digits, for example -000123, so the pattern must not assume a letter is present."
  verify:
    - "Run `npm run build` from the repository root and confirm it completes with no TypeScript errors. It type-checks both tsconfig.json and src/public/tsconfig.json."
    - "Run `grep -n 'ISS-' src/lib/extract.ts` and confirm the three issue-line patterns all compose from the shared fragment, and that no pattern still hard-codes a bare ISS-\\d+ followed immediately by a dot."
  checklist:
    - "A line of the form '- [x] ISS-18-awinon. Some title' is recognised as an issue line by all three patterns."
    - "A line of the form '- [x] ISS-18. Some title' is still recognised by all three patterns."
    - "The mark, id and title stay at capture positions 1, 2 and 3 in ISSUE_ITEM, so extract.ts:123 and detail.ts:106-112 need no change."
    - "The artefact done/total count and the extracted issues[] array report the same set of issues for a file that mixes both id shapes."
    - "The optional suffix is defined once in this file and the other two patterns reuse that definition."
  self_eval:
    passed: true
    failures: []
    notes: "Shared fragment exported as ID_SUFFIX from src/lib/extract.ts. All three patterns compose from it via String.raw. Verified on the repo's own flowcharge/ tree: 10 issues extracted, 4 of them suffixed, and every issuelist's done/total count matches its extracted issues[] set."
  ```

- [x] 2. Read the artefact sort key from the sequence number, not the suffix

  ```yaml
  description: "Correct artefactIdNumber in extract.ts so it returns the sequence number for both the bare and the suffixed id shape, restoring the intended artefact ordering."
  author: Anthony Koukoullis
  issues: [ISS-9-xzo6ao]
  implement:
    - "In src/lib/extract.ts, rewrite the body of the exported artefactIdNumber function (line 70). It currently reads everything after the id's LAST hyphen, which is the random suffix once an id carries one. Replace that with a match for a hyphen, the digits, an optional suffix, and end-of-string, and return the digits. Build the pattern from the shared suffix fragment declared by task 1 rather than repeating the suffix here."
    - "Hoist the composed pattern to a module-level constant so it is compiled once, not per call, and keep it free of the g flag for the reason recorded at lines 8-14."
    - "Illustrative, not literal: `const ID_TAIL = new RegExp(String.raw`-(\\d+)${ID_SUFFIX}$`);` then inside the function `const m = id.match(ID_TAIL); const n = m ? Number(m[1]) : NaN; return Number.isFinite(n) ? n : 0;`"
    - "Update the doc comment at lines 62-69, which states the key is 'the number after the final hyphen'. That sentence is now wrong. Record instead that the key is the sequence number, that the optional suffix is skipped, and keep the two existing rationales: the IL-9 before IL-85 ordering intent, and the 0 fallback."
  pattern: "src/lib/extract.ts — the artefactIdNumber export at line 70 and its doc comment at lines 62-69."
  imports: "No new package import. Consumes the optional-suffix fragment that task 1 exports from this same file, so task 1 must land first."
  compatibility: "There are TWO call sites, and the filed issue names only one. The first is the artefacts comparator in this file at lines 160-161. The second is src/lib/detail.ts:250-252, which sorts plans, issueLists and taskLists for the detail modal and imports the function at detail.ts:9. One function change fixes both, but the executor must confirm detail.ts's ordering as well, not only extract.ts's. The signature stays `(id: string) => number`; do not change it, and do not export anything new. The non-NaN fallback of 0 must survive, because a NaN sort key makes sort order implementation-defined. The id-string tie-break at extract.ts:163 must survive too — it is what keeps the comparator total."
  gotcha: "Expected values from the issue: 'TL-175-ab12cd' must give 175, not 0; 'IL-9-000123' must give 9, not 123. The 000123 case is the trap — an all-digit suffix parses as a number, so a fix that merely guards against NaN still returns the wrong key silently. Old-shape ids such as 'IL-84' and 'TL-175' must keep working. An id with no parsable number at all must still return 0 rather than NaN or a throw. Anchoring at end-of-string is what makes the match deterministic; without the `$` the pattern can settle on the wrong hyphen."
  verify:
    - "Run `npm run build` from the repository root and confirm it completes with no TypeScript errors."
    - "Open a workstream detail view for a project whose artefacts use suffixed ids, and confirm the plans, issue lists and task lists each read in ascending sequence-number order — this exercises the detail.ts:250-252 call site, which the filed issue does not name."
  checklist:
    - "artefactIdNumber returns the sequence number for a suffixed id, including one whose suffix is all digits."
    - "artefactIdNumber returns the sequence number for a bare TYPE-N id."
    - "An id with no parsable sequence number returns 0 and never NaN."
    - "Both call sites order correctly: the artefacts comparator in extract.ts and the three sorts in detail.ts."
    - "The function signature and export name are unchanged, so no caller needed editing."
  self_eval:
    passed: true
    failures: []
    notes: "artefactIdNumber now matches against a hoisted module-level ID_TAIL constant composed from ID_SUFFIX and anchored at end-of-string, with no g flag. Checked values: TL-175-ab12cd gives 175, IL-9-000123 gives 9, IL-84 gives 84, TL-175 gives 175, an unparsable id gives 0 and never NaN. Both call sites were exercised on this repo's own flowcharge/ tree, which mixes both id shapes: 59 comparator type-groups in extract.ts and 93 detail.ts lists all read in ascending sequence-number order. The signature, the export name and the id-string tie-break are unchanged."
  ```

- [x] 3. Accept suffixed workstream ids in the detail request shape check

  ```yaml
  description: "Widen the workstream-id shape check in server.ts to accept an optional six-character id suffix, so the detail endpoint stops returning HTTP 400 for valid migrated ids."
  author: Anthony Koukoullis
  issues: [ISS-7-2zokm9]
  implement:
    - "In src/server.ts, extend the existing import from './lib/extract.js' (line 5, currently `extractPraxisData, hasPrxwork`) to also bring in the optional-suffix fragment that task 1 exports. Do not add a second import statement for the same module."
    - "Declare a module-level constant near the other module-level constants at the top of src/server.ts holding the workstream-id shape, composed from that fragment, so the pattern is compiled once rather than per request. Illustrative, not literal: `const WORKSTREAM_ID = new RegExp(String.raw`^WS-\\d+${ID_SUFFIX}$`);`"
    - "In the `detailMatch` branch, replace the inline `/^WS-\\d+$/.test(wsId)` check at line 262 with a test against that constant. Change nothing else in the branch: the 400 response and its `Malformed workstream id ${wsId}` message stay as they are."
    - "Keep the three-line comment directly above the check, which explains that the shape test runs before any filesystem work because reqPath is already decoded. It is still true and still the reason the check exists."
  pattern: "src/server.ts — the import at line 5, the module-level constant region near the top, and the shape check at line 262 inside the detailMatch branch."
  imports: "Consumes the optional-suffix fragment that task 1 exports from src/lib/extract.ts, so task 1 must land first. src/server.ts already imports from './lib/extract.js', so no new module wiring is needed — extend the existing named-import list. Keep the .js extension: this is a Node ESM build."
  compatibility: "The check is a security guard as well as a validation. reqPath is already decodeURIComponent'd before it reaches here, so a decoded segment such as `../etc` arrives as wsId and is rejected on shape. The `^` and `$` anchors are what make that true and must both survive. The suffix character class must stay `[0-9a-z]` exactly — it contains no dot and no slash, so it cannot widen the traversal surface. Both id shapes must pass: WS-16 and WS-16-a3x9k2. The downstream call extractWorkstreamDetail(entry.path, wsId) is unchanged, and an id that is well-formed but unknown must still return 404, not 400."
  gotcha: "Do not relax the anchors to make the suffix fit — an unanchored or partially anchored pattern turns a shape guard into a substring test and lets a traversal segment through. Do not widen the class to `\\w` or `[a-z0-9-]`, which would admit further hyphenated segments. The rejection path is the only place this id is validated, so anything wrong here is either a live 400 on valid input or a hole. Note that server.ts is compiled by tsconfig.json while src/public has its own tsconfig; `npm run build` runs both, so a broken import surfaces there rather than at runtime."
  verify:
    - "Run `npm run build` from the repository root and confirm it completes with no TypeScript errors."
    - "Start the server with `npm start`, then request the detail endpoint for a workstream whose id carries a suffix, for example WS-16-a3x9k2, against a project that uses the suffixed shape. Confirm the response is the detail payload and not HTTP 400."
  checklist:
    - "A detail request for a suffixed workstream id returns detail data instead of HTTP 400."
    - "A detail request for a bare WS-N workstream id still returns detail data."
    - "A decoded traversal segment such as ../etc is still rejected with HTTP 400 before any filesystem access."
    - "A well-formed but unknown workstream id still returns HTTP 404, not 400."
    - "The suffix definition is imported from extract.ts and not duplicated in server.ts."
  self_eval:
    passed: true
    failures: []
  ```

- [x] 4. Read the board sort key from the sequence number, not the stripped digits

  ```yaml
  description: "Correct wsIdNum in the browser-side app.ts so it returns the workstream sequence number for both the bare and the suffixed id shape, restoring the board's id sort order."
  author: Anthony Koukoullis
  issues: [ISS-10-5b1rra]
  implement:
    - "In src/public/app.ts, rewrite the one-line wsIdNum function at line 60, under the `/* ---------------- Board ---------------- */` comment. It currently reads `function wsIdNum(id: string) { return parseInt(String(id).replace(/\\D+/g, ''), 10) || 0; }`, which strips every non-digit character and so fuses the sequence number with the digit characters inside the random suffix. Replace the strip-and-parse body with a match for a hyphen, the digits, an OPTIONAL six-character base-36 suffix, and end-of-string, and return the digits."
    - "Hoist the pattern to a module-level constant beside POLL_MS and PLAN_BLOCK_LIMIT at the top of the IIFE, in the existing `var NAME = …` UPPER_SNAKE_CASE style, so it is compiled once rather than per comparison. Give it a comment stating that the suffix group must stay OPTIONAL, that this mirrors artefactIdNumber in src/lib/extract.ts, and that the shared fragment cannot be imported here."
    - "Illustrative, not literal: `var WS_ID_TAIL = /-(\\d+)(?:-[0-9a-z]{6})?$/;` then inside the function `var m = String(id).match(WS_ID_TAIL); var n = m ? Number(m[1]) : NaN; return Number.isFinite(n) ? n : 0;`"
    - "Change nothing at the single call site, the board card comparator at line 284 (`if (sortKey === 'id') cmp = wsIdNum(a.id) - wsIdNum(b.id);`). The signature stays `(id: string) => number` and the function stays local to the IIFE."
  pattern: "src/public/app.ts — the wsIdNum function at line 60, plus one new module-level constant in the constant block at lines 2-12. The call site at line 284 is read-only context."
  imports: "No import of any kind is possible or permitted here, and four independent reasons each block it on their own. First, src/public/tsconfig.json sets `module: none`, and its own inline comment states this guarantees a classic script and makes an added import a compile error. Second, board.html loads the output with a plain `<script src=\"app.js\"></script>` at line 117, not a module script. Third, app.ts is a single IIFE with zero import or export statements today. Fourth, src/lib/extract.ts imports Node's fs and path, so it could never load in a browser even if the first three were solved. The fix must therefore be entirely self-contained inside app.ts."
  compatibility: "The behaviour must be IDENTICAL to the fix task 2 specifies for artefactIdNumber in src/lib/extract.ts — same anchoring on hyphen, digits, optional suffix and end-of-string, and the same 0-not-NaN fallback discipline. Do not model the fix on extract.ts's current code, which still carries the old bug until task 2 lands. The suffix must be a NON-capturing group so the digits stay at capture position 1. The suffix class stays `[0-9a-z]` exactly and the group stays OPTIONAL, because this dashboard's own flowcharge/ tree holds both id shapes at once. Do not add the g flag, or lastIndex state leaks between comparisons on a hoisted constant. app.ts has no existing module-level regex constant — its three regexes are inline literals inside render helpers — so follow the POLL_MS naming convention, not the ID_SUFFIX name used in extract.ts."
  gotcha: "Duplicating the suffix shape in this file is deliberate and is the only available option; do not propose a second compiled script, a bundler, or a change to tools/copy-assets.mjs to remove the duplication, because that is a build-architecture change and is out of scope for this defect. The all-digit suffix is the trap: a base-36 suffix can be all digits, so `WS-9-000123` must give 9, never 9000123 and never 123. The reported case is `WS-16-a3x9k2`, which currently gives 16392 and must give 16. Old-shape ids such as `WS-16` must keep working. An id with no parsable number must return 0, because a NaN sort key makes the sort order implementation-defined. The existing `|| 0` supplies that fallback today, so a rewrite must not drop it. Sequencing note: this task shares no code with tasks 1-3 and is not blocked on them, but running it after task 2 lets the two equivalent functions be read side by side and confirmed identical in shape."
  verify:
    - "Run `npm run build` from the repository root and confirm it completes with no TypeScript errors. It type-checks src/public/tsconfig.json as well as the Node-side config, so an accidental import statement fails here."
    - "Start the server with `npm start`, open the board for a project whose workstream ids carry a suffix, set the sort control to 'id', and confirm the cards in each column read in ascending sequence-number order."
  checklist:
    - "wsIdNum returns the sequence number for a suffixed id, so 'WS-16-a3x9k2' gives 16 and not 16392."
    - "wsIdNum returns the sequence number for a bare id, so 'WS-16' still gives 16."
    - "An all-digit suffix is skipped rather than fused or read, so 'WS-9-000123' gives 9 and not 9000123 or 123."
    - "An id with no parsable sequence number returns 0 and never NaN."
    - "app.ts still contains no import or export statement, and the board comparator at line 284 needed no edit."
  self_eval:
    passed: true
    failures: []
    notes: "wsIdNum now matches a hoisted module-level WS_ID_TAIL constant in the POLL_MS style, anchored at end-of-string, with a non-capturing OPTIONAL suffix and no g flag. Checked values: WS-16-a3x9k2 gives 16, WS-16 gives 16, WS-9-000123 gives 9, WS-175-ab12cd gives 175, and WS, empty string and WS-abc each give 0 and never NaN. npm run build passes both tsconfig.json and src/public/tsconfig.json. app.ts still holds zero import and export statements, and the board comparator at the sortKey === 'id' branch is unedited. The browser sort-order verify step was not run, because this pass runs only static checks."
  ```

## Divergences

1. **ISS-9 names one call site of `artefactIdNumber`; the code has two.** The issue's
   `affected` field cites only `src/lib/extract.ts:160-161`, the artefacts comparator. Reading
   the code at `34f6a2e` shows `src/lib/detail.ts:9` imports the function and
   `src/lib/detail.ts:250-252` calls it three times, to order the detail modal's plans, issue
   lists and task lists. The consequence is confined to verification: one function change fixes
   both call sites, so task 2 stays a single-file task, but its `compatibility` and `verify`
   steps now require the executor to confirm the detail modal's ordering as well.

2. **ISS-8 does not name `detail.ts` as a positional consumer of `ISSUE_ITEM`.** The issue's
   `affected` field cites `src/lib/extract.ts` lines 53, 130 and 132, and names line 123 as the
   consumer of `ISSUE_ITEM`. Reading the code at `34f6a2e` shows a second consumer:
   `src/lib/detail.ts:106-112` reads `entry.m[1]`, `entry.m[2]` and `entry.m[3]` from the same
   constant. The consequence is a hard constraint rather than extra work — task 1's new suffix
   group must be non-capturing, or the title shifts to `m[4]` and `detail.ts` breaks silently.

Every other location cited by the three issues matched the code exactly as filed:
`src/server.ts:262`, and `src/lib/extract.ts` lines 53, 70, 123, 130, 132 and 160-161.

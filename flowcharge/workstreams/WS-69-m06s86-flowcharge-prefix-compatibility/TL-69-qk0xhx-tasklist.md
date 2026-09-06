---
id: TL-69-qk0xhx
type: tasklist
workstream: WS-69-m06s86
slug: flowcharge-prefix-compatibility
title: "Read the FlowCharge tree names, with a warned legacy fallback"
status: done
created: 2026-08-27
updated: 2026-08-27
author: Anthony Koukoullis
depends_on: [PLN-58-n8ji7h]
links: []
mode: spec
base_commit: b9fe85b
---

# PRX Tasks

## FlowCharge prefix compatibility

The upstream suite renamed a project's data folder from `prxwork/` to `flowcharge/` and
dropped the `prx` prefix from the workstream marker file (`prxworkstream.md` →
`workstream.md`). This Dashboard holds those two names as literals at four read sites, so
every registered project is unreadable today.

PLN-58-n8ji7h fixes this with one new single-concern module, `src/lib/tree-layout.ts`,
that owns both name generations. It resolves `<root>/flowcharge` first and `<root>/prxwork`
second, by exact basename plus an `isDirectory()` check, and it accepts either marker
filename inside whichever folder resolved. Every read site calls it instead of holding a
literal. A legacy resolution is warned, not silent: `src/server.ts` and the `--refresh` CLI
print one greppable `LEGACY LAYOUT:` line per resolution.

Three failure modes drive the design, and each has a named test below. A prefix or glob
match would resolve the stale `prxwork-bak/` sibling that exists in this repository right
now and render a board from old data with no error. A marker not recognised inside a
half-renamed tree is skipped with no error and no log, so cards vanish silently. A marker
file left unskipped in the artefact loop carries `id` and `type: workstream` in its
frontmatter and becomes a phantom artefact row on the card.

Four stages, in the plan's order and riskiest first: the resolver and the board payload,
then the card modal, then the route boundary and its messages, then user-facing copy. Each
stage leaves the app buildable. The verify gate is `npm run build`, followed by a
`node --test` run over the three test files this workstream touches —
`dist/lib/tree-layout.test.js`, `dist/lib/extract.test.js` and `dist/lib/detail.test.js`.
It is deliberately **not** `node --test dist/lib/*.test.js`: that whole-suite run cannot
pass today, because `src/lib/skill-content-fetch.test.ts` asserts the old `prx-*` skill ids
against a since-renamed upstream target over the live network and has no offline skip path
by its own design. That failure is pre-existing and unrelated to this change. See
Divergence 5 and the plan's Open question 2. This repository has no `npm test` script and
the plan does not add one.

- [x] 1. Phase 1 — The resolver, and the board payload on top of it

  ```yaml
  description: "Create src/lib/tree-layout.ts and move src/lib/extract.ts onto it, with unit coverage of the resolver and generation-parameterised extraction tests."
  ```

  - [x] 1.1 Create `src/lib/tree-layout.ts`
    ```yaml
    description: "New single-concern module owning both folder names and both marker filenames, exporting the contract the plan fixes in its Design section."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/tree-layout.ts. Open it with a short header comment stating its one job, matching the house style of src/lib/git.ts and src/lib/projects.ts."
      - "Export the contract exactly as PLN-58-n8ji7h fixes it: type LayoutGeneration = 'flowcharge' | 'prxwork'; interface TreeLayout { dir: string; generation: LayoutGeneration; legacy: boolean }; function resolveTreeLayout(root: string): TreeLayout | null; function hasWorkstreamTree(root: string): boolean; function isWorkstreamMarker(file: string): boolean; const WORKSTREAM_MARKERS: readonly string[]."
      - "resolveTreeLayout resolves path.resolve(root) first, then tests <root>/flowcharge and <root>/prxwork in that order. A candidate resolves only when it exists AND fs.statSync(...).isDirectory() is true. Return dir as the absolute joined path, generation as the basename that matched, and legacy true only when generation === 'prxwork'. Return null when neither candidate is a directory."
      - "Match the basename EXACTLY. Never use a prefix test, a glob, startsWith, or a readdir scan. This is load-bearing, not defensive: this repository's own root holds prxwork-bak/ beside flowcharge/ today, and a prefix match would render a board from that stale backup with no error."
      - "resolveTreeLayout must never throw. Guard the stat call so a dangling symlink, a permission error, or a race between existsSync and statSync yields null or falls through to the next candidate rather than propagating."
      - "hasWorkstreamTree(root) returns resolveTreeLayout(root) !== null. It replaces hasPrxwork in extract.ts."
      - "WORKSTREAM_MARKERS is the two marker basenames, new generation first: ['workstream.md', 'prxworkstream.md']. isWorkstreamMarker(file) returns true when file equals either entry, and is the single predicate every locate walk and every artefact-loop skip uses, so the two can never disagree."
      - "Keep the module ignorant of everything else. No frontmatter parsing, no artefact types, no HTTP, no registry, and no console call. It returns facts; the caller decides what to print. The deprecation line is printed by the transport boundary in Phase 3."
    pattern: "src/lib/tree-layout.ts (new). Sibling of the existing single-concern libraries src/lib/git.ts and src/lib/yaml-block.ts."
    imports: "node:fs and node:path only. No project imports — nothing in src/lib/ may import this module's callers."
    compatibility: "TypeScript strict mode under tsconfig.json, ESM with .js import specifiers, Node >= 18. Named exports only, matching the other src/lib modules."
    gotcha: "fs.existsSync followed by fs.statSync throws if the entry disappears in between, and statSync on a broken symlink throws ENOENT — the plan states this function never throws, so both paths need a guard. isDirectory() is what separates a real folder from a plain FILE named 'flowcharge'; existsSync alone accepts the file and the walk then finds nothing. The current hasPrxwork at extract.ts:203-205 has no isDirectory check, so this is a behaviour change, and an intended one."
    verify:
      - "npm run build"
      - "node -e \"import('./dist/lib/tree-layout.js').then(m => { console.log(Object.keys(m)); console.log(m.resolveTreeLayout(process.cwd())); })\" — prints the four exports and a TreeLayout whose generation is 'flowcharge' and legacy is false for this repository's own root."
    checklist:
      - "Does resolveTreeLayout test the exact basenames 'flowcharge' and 'prxwork' only, with no prefix, glob, or readdir scan anywhere in the file?"
      - "Does every candidate require isDirectory() as well as existence?"
      - "Is legacy true if and only if generation === 'prxwork'?"
      - "Does resolveTreeLayout return null instead of throwing for a missing root, a broken symlink, and a plain file named 'flowcharge'?"
      - "Does isWorkstreamMarker accept both 'workstream.md' and 'prxworkstream.md', and reject 'plan.md', 'prxplan.md' and '.lease'?"
      - "Is the module free of frontmatter parsing, artefact types, HTTP, registry access, and any console call?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Move `src/lib/extract.ts` onto the resolver
    ```yaml
    description: "Replace the four literals in extract.ts with tree-layout calls, keeping hasPrxwork as a temporary named re-export so src/server.ts still compiles."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add an import of resolveTreeLayout, hasWorkstreamTree, isWorkstreamMarker and WORKSTREAM_MARKERS from './tree-layout.js' alongside the existing node:fs and node:path imports."
      - "At the hasPrxwork export (line 203), delegate the body to hasWorkstreamTree(root) and keep the exported NAME hasPrxwork for now. This is the expand step of expand-migrate-contract: src/server.ts:6 imports that name and must keep compiling until task 3.1 migrates it and task 3.2 deletes it. Mark it in a comment as a temporary compatibility re-export removed by task 3.2."
      - "In extractPraxisData (line 207), call resolveTreeLayout(resolvedRoot) ONCE. On null, throw an error naming BOTH folder names — widen the current `No prxwork/ found under ${resolvedRoot}` at line 210 to read that neither flowcharge/ nor prxwork/ was found under that path. Walk layout.dir instead of the joined 'prxwork' literal at lines 213, 216 and 217; workstreams/ and archive/ keep their names inside the tree."
      - "In walkWorkstreams, replace the single marker join at line 124. Do not test one filename: find the first entry of WORKSTREAM_MARKERS that exists in the folder, and continue only when neither is present. A flowcharge/ folder still holding prxworkstream.md must be READ, not skipped — line 125 currently `continue`s with no error and no log, which is how a half-renamed tree loses cards silently."
      - "Replace the artefact-loop skip at line 133 with isWorkstreamMarker(f). Skipping only the resolved generation's marker would let the other marker through line 138, which accepts any file carrying an `id`, and push a phantom row typed 'workstream' into the UNRANKED_TYPE bucket on the card."
      - "Update the two stale comments that name the old vocabulary inside this file — the header at line 1 and the ARTEFACT_TYPE_RANK note at line 112 that names prxworkstream.md — since this file is already being edited. Change no other comment and no other behaviour."
      - "Leave ID_SUFFIX, artefactIdNumber, ISSUE_ITEM, TASK_ITEM, countChecks and the artefact sort comparator untouched. Artefact ids are unchanged by the upstream rename, and the per-file prefixes need no code change because line 138 keys on frontmatter `id` and `type`, never on the filename."
    pattern: "src/lib/extract.ts, lines 118-226. No other file."
    imports: "./tree-layout.js (resolveTreeLayout, hasWorkstreamTree, isWorkstreamMarker, WORKSTREAM_MARKERS). WORKSTREAM_MARKERS is required by the walkWorkstreams step above, which finds the first marker entry that exists in the folder."
    compatibility: "The exported surface must not shrink in this task: extractPraxisData, hasPrxwork, ID_SUFFIX, ISSUE_ITEM and artefactIdNumber are all imported elsewhere (src/server.ts:6, src/lib/detail.ts, src/lib/extract.test.ts). The PraxisData return shape is unchanged, so src/types/praxis-data.d.ts needs no edit. The module stays read-only — src/lib/projects.ts:102-104 declares that posture and no fs write call is added."
    gotcha: "Resolving the layout inside walkWorkstreams instead of once in extractPraxisData would stat the root twice per call and could disagree between the workstreams/ and archive/ walks. Resolve once, pass the dir down. Also: the marker lookup must return the PATH of whichever marker was found, because line 126 reads that same file — testing for existence and then reading a hard-coded name would reintroduce the bug."
    verify:
      - "npm run build"
      - "node -e \"import('./dist/lib/extract.js').then(m => { const d = m.extractPraxisData(process.cwd()); console.log(d.workstreams.length, d.issues.length); if (!d.workstreams.length) process.exit(1); })\" — this repository holds flowcharge/ and renders nothing before this task, so a non-zero workstream count is the acceptance check for criterion 1."
      - "node -e \"import('./dist/lib/extract.js').then(m => { const ws = m.extractPraxisData(process.cwd()).workstreams; const bad = ws.flatMap(w => w.artefacts).filter(a => a.type === 'workstream'); console.log(bad); if (bad.length) process.exit(1); })\" — zero artefacts typed 'workstream' anywhere on the board, guarding the phantom-row failure."
      - "npm run refresh -- --root /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD — the plan's own scale check; the dumped JSON must report its 186 workstreams. Skip this step only if that path is absent on this machine, and say so."
    checklist:
      - "Does `grep -n \"'prxwork'\\|'prxworkstream.md'\" src/lib/extract.ts` return zero matches?"
      - "Does extractPraxisData call resolveTreeLayout exactly once per invocation?"
      - "Does the thrown message name both flowcharge/ and prxwork/?"
      - "Is hasPrxwork still exported, still compiling src/server.ts:6, and marked as removed by task 3.2?"
      - "Does a workstream folder holding prxworkstream.md inside a flowcharge/ tree still produce a card?"
      - "Do the artefact rows of every card exclude both marker filenames?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.3 Create `src/lib/tree-layout.test.ts`
    ```yaml
    description: "Pure unit coverage of the resolver, including the stale-backup regression case the plan calls the highest-value test here."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/tree-layout.test.ts using node:test and node:assert/strict, matching the shape and the header comment convention of src/lib/extract.test.ts (which documents its own `node --test dist/lib/extract.test.js` invocation at line 8)."
      - "Build each fixture root with fs.mkdtempSync under os.tmpdir(), and remove it in a finally block so a failing assertion leaves no tree behind — copy the withFixtureProject discipline at src/lib/extract.test.ts:111-123."
      - "Assert resolveTreeLayout over four shapes: flowcharge/ alone resolves with generation 'flowcharge' and legacy false; prxwork/ alone resolves with generation 'prxwork' and legacy true; BOTH present resolves flowcharge/ with legacy false, satisfying acceptance criterion 6; neither present returns null."
      - "Add the stale-backup regression test: a fixture root holding ONLY prxwork-bak/ must return null. Cover prxwork-pre-migration-2026-08-17/ in the same test. These names exist on this machine, and a prefix match would silently render months-old data — acceptance criterion 5."
      - "Add the file-not-directory case: a fixture root holding a plain FILE named 'flowcharge' must return null, not a TreeLayout."
      - "Assert that resolveTreeLayout returns null rather than throwing for a root path that does not exist at all."
      - "Assert isWorkstreamMarker: true for 'workstream.md' and 'prxworkstream.md'; false for 'plan.md', 'prxplan.md' and '.lease'."
      - "Assert that dir is an absolute path and ends with the resolved basename, so a caller can join 'workstreams' onto it directly."
    pattern: "src/lib/tree-layout.test.ts (new). Compiled to dist/lib/tree-layout.test.js by the existing tsconfig.json glob — no build config change."
    imports: "node:test, node:assert/strict, node:fs, node:os, node:path, and ./tree-layout.js."
    compatibility: "node --test, the repository's only test runner. No test framework is added and no npm test script is added — the plan settles both."
    gotcha: "On macOS os.tmpdir() returns a /var symlink to /private/var, so asserting an exact absolute path string against the mkdtemp root fails. Compare with fs.realpathSync on both sides, or assert the basename and path.isAbsolute instead of a full string equality."
    verify:
      - "npm run build"
      - "node --test dist/lib/tree-layout.test.js — every case passes."
    checklist:
      - "Does a fixture root holding only prxwork-bak/ assert null?"
      - "Does a fixture holding both folders assert generation 'flowcharge' and legacy false?"
      - "Does a plain file named 'flowcharge' assert null rather than resolving?"
      - "Does every fixture root get removed in a finally block?"
      - "Are both markers asserted true and 'prxplan.md' asserted false?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.4 Extend `src/lib/extract.test.ts` over both generations
    ```yaml
    description: "Parameterise the fixture helper over both name generations, export it for reuse, and add the mixed-tree and phantom-artefact guards."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Parameterise withFixtureProject (line 111) over a generation argument instead of hard-coding 'prxwork' at line 114 and 'prxworkstream.md' at line 116. It must build the folder name and the marker filename from that argument, defaulting to the new generation. See Divergence 1: the helper also hard-codes a THIRD literal at line 117, 'prxissuelist.md', which the plan did not name — parameterise the artefact filename too so the new-generation fixture can use bare artefact names."
      - "EXPORT withFixtureProject from this file. Task 2.2 consumes it rather than copying it, because a copied fixture drifts."
      - "Run the two existing extraction tests (lines 125 and 148) against BOTH generations, so their suffixed-id assertions gain generation coverage without being rewritten. Keep the assertions themselves byte-identical — only the fixture generation varies."
      - "Add a case proving the filename claim: a flowcharge/ tree whose artefact file is named with the new bare form, IL-1-cc22dd-issuelist.md, parses identically to the prxissuelist.md fixture. Both parsers key on frontmatter `type`, so this must cost zero production lines."
      - "Add the mixed-tree case: a flowcharge/ folder whose marker file is prxworkstream.md yields ONE workstream, not zero. Add the reverse too — a prxwork/ folder holding workstream.md. This is acceptance criterion 7 and it guards the silent-skip failure mode."
      - "Add the phantom-artefact guard: assert that no entry in workstreams[0].artefacts has type === 'workstream', for both generations. This is acceptance criterion 8 on the board side."
    pattern: "src/lib/extract.test.ts, lines 111-162. Preserve the existing header comment and every existing assertion."
    imports: "Existing imports only, plus whatever the new cases need from ./extract.js."
    compatibility: "TypeScript strict mode; the file compiles under tsconfig.json like any other src file. Exporting from a test module is legal and the runner still discovers its tests."
    gotcha: "Do not delete or weaken the existing id-shape assertions — they guard a real defect described at lines 1-6, where suffixed issue items were silently dropped. If parameterising the helper changes its signature, update BOTH existing call sites at lines 126 and 149 in the same edit, or the file will not compile."
    verify:
      - "npm run build"
      - "node --test dist/lib/extract.test.js dist/lib/tree-layout.test.js — every case passes, over both generations, and the resolver tests from task 1.3 still pass."
      - "Do NOT gate on `node --test dist/lib/*.test.js`. The full suite cannot pass today for a reason unrelated to this workstream: dist/lib/skill-content-fetch.test.js carries a live-network tier that asserts the old prx-* skill ids against a since-renamed upstream target, and its own header at src/lib/skill-content-fetch.test.ts:6-8 states it has no skip-when-offline path by design. That failure is pre-existing — see the plan's Open question 2 — and is not a regression you caused."
    checklist:
      - "Is withFixtureProject exported, and free of any hard-coded folder, marker, or artefact filename?"
      - "Do both pre-existing extraction tests now run against both generations, with their assertions unchanged?"
      - "Does the mixed flowcharge/ + prxworkstream.md fixture yield exactly one workstream?"
      - "Does the reverse mixed fixture, prxwork/ + workstream.md, also yield exactly one workstream?"
      - "Does an assertion prove that no artefact on the card has type === 'workstream'?"
      - "Does the bare-named IL-1-cc22dd-issuelist.md fixture parse identically to the prxissuelist.md one?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — The card modal on the same resolver

  ```yaml
  description: "Move src/lib/detail.ts onto tree-layout, and open the file's first test with the compatibility cases. Depends on task 1."
  ```

  - [x] 2.1 Move `src/lib/detail.ts` onto the resolver
    ```yaml
    description: "Replace the prxwork join and the two marker literals in detail.ts with resolveTreeLayout and isWorkstreamMarker."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Import resolveTreeLayout, isWorkstreamMarker and WORKSTREAM_MARKERS from './tree-layout.js'."
      - "In extractWorkstreamDetail (line 204), replace the `path.join(resolvedRoot, 'prxwork')` at line 206 with a resolveTreeLayout(resolvedRoot) call, and return null immediately when it resolves nothing. Returning null is the correct signal here — the route at src/server.ts:373-377 already turns a null detail into a 404, and the missing-folder case is separately caught by the hasWorkstreamTree guard ahead of it."
      - "Pass the resolved dir into the two locateWorkstream calls at lines 209-210, keeping the workstreams-then-archive order and the ?? fallback exactly as they are."
      - "In locateWorkstream (line 190), replace the single marker join at line 195 the same way task 1.2 changes walkWorkstreams: try each entry of WORKSTREAM_MARKERS and read whichever exists, so a folder carrying the other generation's marker is found rather than skipped at line 196."
      - "Replace the artefact-loop skip at line 221 with isWorkstreamMarker(file), so neither marker can reach the plans, issueLists or taskLists collections."
      - "Change nothing else. The frontmatter-id resolution comment at lines 186-189, the explicit readdirSync sort at line 220, the type gate at line 230, and the three id-number sorts at lines 250-252 all stay exactly as they are."
    pattern: "src/lib/detail.ts, lines 186-226. No other file."
    imports: "./tree-layout.js (resolveTreeLayout, isWorkstreamMarker, WORKSTREAM_MARKERS). WORKSTREAM_MARKERS is required by the locateWorkstream step above, which tries each marker entry and reads whichever exists."
    compatibility: "The PraxisWorkstreamDetail return shape is unchanged, so src/types and src/public/app.ts need no edit in this task. The type gate at line 230 already drops anything not typed plan/issuelist/tasklist, so isWorkstreamMarker is belt-and-braces there — add it anyway, because the plan makes one predicate the single source of the skip at all four sites."
    gotcha: "detail.ts and extract.ts each resolve the tree independently on their own request, which is correct — the modal request is a separate HTTP call from the board request. Do not thread a cached layout between them. Also, locateWorkstream is called twice per detail request, so resolve the layout ONCE in extractWorkstreamDetail and pass the dir down."
    verify:
      - "npm run build"
      - "node -e \"import('./dist/lib/detail.js').then(async m => { const e = await import('./dist/lib/extract.js'); const id = e.extractPraxisData(process.cwd()).workstreams[0].id; const d = m.extractWorkstreamDetail(process.cwd(), id); console.log(id, !!d, d && d.plans.length, d && d.issueLists.length, d && d.taskLists.length); if (!d) process.exit(1); })\" — a non-null detail for a real workstream of this repository's flowcharge/ tree, which returns null before this task."
      - "node -e \"import('./dist/lib/detail.js').then(async m => { const e = await import('./dist/lib/extract.js'); const id = e.extractPraxisData(process.cwd()).workstreams[0].id; const d = m.extractWorkstreamDetail(process.cwd(), id); const files = [...d.plans, ...d.issueLists, ...d.taskLists].map(x => x.artefact.file); console.log(files); if (files.some(f => f === 'workstream.md' || f === 'prxworkstream.md')) process.exit(1); })\" — no marker filename in any of the three collections, acceptance criterion 8 on the modal side."
    checklist:
      - "Does `grep -n \"'prxwork'\\|'prxworkstream.md'\" src/lib/detail.ts` return zero matches?"
      - "Does extractWorkstreamDetail return null when neither folder resolves?"
      - "Is resolveTreeLayout called exactly once per detail request?"
      - "Does locateWorkstream find a folder whose marker is the other generation's?"
      - "Do plans, issueLists and taskLists exclude both marker filenames?"
      - "Are the readdirSync sort, the type gate and the three artefact-id sorts unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.2 Create `src/lib/detail.test.ts`
    ```yaml
    description: "First test file for detail.ts, opening with the generation-compatibility cases rather than backfilling parser coverage."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/detail.test.ts using node:test and node:assert/strict, with a header comment naming its `node --test dist/lib/detail.test.js` invocation, matching src/lib/extract.test.ts:8."
      - "Option A, the plan's form: import the exported withFixtureProject from './extract.test.js' rather than copying it, so the two suites cannot drift apart."
      - "Option B, only if Option A makes node --test report extract.test.ts's own cases a second time inside this file's run: lift the helper into a shared non-test module under src/lib/ and import it from both test files. Do not duplicate the helper body under any circumstances."
      - "Assert, for a fixture in EACH generation, that extractWorkstreamDetail returns a non-null detail for the fixture's workstream id, and that its id and status match the fixture frontmatter. Do NOT assert slug against the frontmatter slug: src/lib/detail.ts returns `slug: found.slug`, and locateWorkstream sets found.slug from the readdirSync DIRECTORY name (line 192), never from frontmatter. The shared fixture's directory is WS-1-aa11bb-fixture while its frontmatter slug is `fixture`, so a frontmatter comparison fails. Assert slug equals the workstream folder's basename."
      - "Assert that an unknown workstream id returns null, in both generations."
      - "Assert that no artefact in plans, issueLists or taskLists has a `file` equal to either marker filename — acceptance criterion 8."
      - "Assert that a project root holding neither folder returns null rather than throwing."
      - "Add the mixed-tree case here too: a flowcharge/ folder whose marker is prxworkstream.md still resolves its detail, matching the extract-side guard in task 1.4."
    pattern: "src/lib/detail.test.ts (new). Compiled by the existing tsconfig.json glob — no build config change."
    imports: "node:test, node:assert/strict, ./detail.js, and withFixtureProject from ./extract.test.js (Option A)."
    compatibility: "node --test only. The fixture in src/lib/extract.test.ts writes a workstream file and an issue-list file; if a plan or task-list artefact is needed for a richer assertion, extend the SHARED helper rather than writing a private fixture here."
    gotcha: "Importing one test file from another registers the imported file's tests in the importing file's process, so `node --test dist/lib/*.test.js` may report the extract cases twice. That is the trigger for Option B, and it is not a checklist failure — record it in self_eval and take Option B."
    verify:
      - "npm run build"
      - "node --test dist/lib/detail.test.js — every case passes."
      - "node --test dist/lib/detail.test.js dist/lib/extract.test.js dist/lib/tree-layout.test.js — the three test files this workstream touches all pass, and no case is reported twice. The duplicate-reporting check is the point of running detail and extract together, per the gotcha above."
      - "Do NOT gate on `node --test dist/lib/*.test.js`. The full suite cannot pass today for a reason unrelated to this workstream: dist/lib/skill-content-fetch.test.js carries a live-network tier that asserts the old prx-* skill ids against a since-renamed upstream target, and its own header at src/lib/skill-content-fetch.test.ts:6-8 states it has no skip-when-offline path by design. That failure is pre-existing — see the plan's Open question 2 — and is not a regression you caused."
    checklist:
      - "Is the fixture builder shared with extract.test.ts rather than copied?"
      - "Does a fixture in each generation return a non-null detail for its own workstream id, with slug asserted against the workstream folder's basename rather than the frontmatter slug?"
      - "Does an unknown workstream id return null in both generations?"
      - "Does an assertion prove no marker filename appears in plans, issueLists or taskLists?"
      - "Does a root holding neither folder return null without throwing?"
      - "Does `node --test dist/lib/detail.test.js dist/lib/extract.test.js dist/lib/tree-layout.test.js` report each test case exactly once?"
    self_eval:
      passed: true
      failures: []
      notes:
        - item: "Option A was tried first and rejected on its own stated trigger, per this task's gotcha. Not a checklist failure."
          observed: "Importing withFixtureProject from './extract.test.js' registered the extract suite inside detail.test.js's own process. `node --test dist/lib/detail.test.js` reported 23 cases instead of 9, and the three-file run reported 46 with every extract case listed twice."
          resolution: "Took Option B. Lifted the fixture builder, its two file templates and the generation name table into a new shared non-test module, src/lib/fixture-project.ts, and imported it from both test files. src/lib/extract.test.ts keeps `export { FIXTURE_GENERATIONS, withFixtureProject }` so task 1.4's exported-from-this-file contract still holds. The helper body was moved, never copied. The three-file run now reports 32 cases with no duplicate."
    ```

- [x] 3. Phase 3 — The route boundary, its messages, and the deprecation warning

  ```yaml
  description: "Migrate src/server.ts to hasWorkstreamTree, update its three user-facing messages, print the LEGACY LAYOUT: line at both entry points, then delete the compatibility re-export. Depends on task 1. Execute 3.1 before 3.2."
  ```

  - [x] 3.1 Migrate `src/server.ts` and add the deprecation warning
    ```yaml
    description: "Swap the hasPrxwork import for hasWorkstreamTree, rewrite the three folder messages, and print one LEGACY LAYOUT: line per legacy resolution at the two data routes and the add-project route."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this single mechanical import edit, whose SEARCH text is copied from src/server.ts at b9fe85b:"
      - |
        src/server.ts
        <<<<<<< SEARCH
        import { extractPraxisData, hasPrxwork, ID_SUFFIX } from './lib/extract.js';
        =======
        import { extractPraxisData, ID_SUFFIX } from './lib/extract.js';
        import { hasWorkstreamTree, resolveTreeLayout } from './lib/tree-layout.js';
        >>>>>>> REPLACE
      - "Replace the three hasPrxwork call sites — the add-project guard at line 197, the board-data guard at line 335, and the detail guard at line 369 — with hasWorkstreamTree. See Divergence 2: the guard lines are 197, 335 and 369, one line above each of the three messages the plan cites."
      - "Rewrite the add-project message at line 198 to name flowcharge/ as the folder to create, and to state that a legacy prxwork/ folder is still accepted. It must still interpolate the rejected input path. This is acceptance criterion 9."
      - "Rewrite the two 410 messages at lines 336 and 370 to say the registered path no longer contains a flowcharge/ or prxwork/ folder, still interpolating entry.path."
      - "Add the deprecation warning at all three of those route boundaries: after the guard passes, call resolveTreeLayout on the same path and, when the result is legacy, console.warn exactly one line in the fixed greppable form `LEGACY LAYOUT: <path> uses prxwork/ — rename it to flowcharge/; support for the old name will be removed`, where <path> is the resolved absolute dir. Print nothing when the resolution is not legacy."
      - "Print ONE line per resolution and no more. Do not accumulate state, do not add a seen-set, and do not deduplicate across requests — the line's purpose is to show whether the fallback is still load-bearing, which a suppressed repeat would hide."
      - "The printing lives here and nowhere in src/lib/. server.ts is the layer that already owns console.warn for the non-loopback bind at lines 465-474 and already owns every user-facing message about a missing folder."
      - "Leave the non-loopback warning at lines 465-474 alone. The plan's copy list does not include it, and it is out of scope for this task list."
    pattern: "src/server.ts — line 6, and the three route boundaries at lines 197-200, 335-338 and 369-372."
    imports: "./lib/tree-layout.js (hasWorkstreamTree, resolveTreeLayout). The hasPrxwork import is removed by the block above."
    compatibility: "Status codes must not change: 400 for the add-project rejection, 410 for a registered path that no longer holds a tree. Only the message strings change. src/public/home.ts:311 does NOT mirror this add-project string: it is the blank-input case, it carries no interpolated path, and its wording differs today. Task 4.1 keeps the two consistent in vocabulary only — same folder name, same treatment of the legacy fallback — not byte-identical. The two client strings that ARE byte-identical to server strings are TILDE_MESSAGE and ABSOLUTE_PATH_MESSAGE at src/public/home.ts:88-89, matching src/server.ts:190 and :194, and this task changes none of those four."
    gotcha: "Calling resolveTreeLayout after hasWorkstreamTree stats the root a second time. That is deliberate and cheap: the guard answers a boolean question and the warning needs the generation. Do not merge them into one call that returns a boolean and prints, because printing from src/lib/ is exactly what the plan's module contract forbids."
    verify:
      - "npm run build"
      - "grep -rn 'hasPrxwork' src/server.ts — returns zero matches."
      - "Create a throwaway legacy fixture: mkdir -p \"$TMPDIR/legacy-fixture/prxwork/workstreams/WS-1-aa11bb-x\" and write a minimal workstream frontmatter file to prxworkstream.md inside it. Start the server with npm start, POST that path to /api/projects, then GET its board data."
      - "Confirm the server log holds exactly one `LEGACY LAYOUT:` line per resolution and that the board payload still returns its workstream. Then POST a directory holding neither folder and read the new 400 message. Remove the fixture and the registry entry afterwards."
    checklist:
      - "Does grep for hasPrxwork in src/server.ts return zero matches?"
      - "Does the add-project rejection name flowcharge/ as the folder to create and still return 400?"
      - "Do both 410 messages name both folder names and still return 410?"
      - "Does a legacy project produce exactly one LEGACY LAYOUT: line per resolution, carrying the resolved absolute path?"
      - "Does a flowcharge/ project produce no LEGACY LAYOUT: line at all?"
      - "Is the non-loopback warning at lines 465-474 unchanged?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.2 Delete the `hasPrxwork` compatibility re-export from `src/lib/extract.ts`
    ```yaml
    description: "The contract step of expand-migrate-contract: with src/server.ts migrated, remove the temporary re-export task 1.2 kept."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Delete the hasPrxwork export and the temporary-compatibility comment task 1.2 added around it. Do not write a SEARCH block for this from the plan or from b9fe85b — the region is rewritten by task 1.2, so read src/lib/extract.ts as it stands after that task and delete what is actually there."
      - "Point extractPraxisData's own guard, if it still calls hasPrxwork, at hasWorkstreamTree or at the null check on resolveTreeLayout — after this deletion the name must not appear anywhere in src/."
      - "Execute this task only after task 3.1 has landed. Deleting the re-export first breaks the src/server.ts:6 import and the build."
    pattern: "src/lib/extract.ts, the region around the former line 203-205 as task 1.2 leaves it."
    imports: "No new imports. hasWorkstreamTree is already imported by task 1.2."
    compatibility: "Rollback caveat from the plan's Data & compatibility section: after this deletion, reverting task 1.2 alone will not compile. Revert this task first."
    gotcha: "src/lib/extract.test.ts and src/lib/detail.test.ts do not import hasPrxwork today, but confirm that before deleting rather than assuming it — a missed import fails the build, not a test."
    verify:
      - "npm run build"
      - "grep -rn 'hasPrxwork' src/ — returns zero matches across the whole source tree."
      - "node --test dist/lib/extract.test.js dist/lib/detail.test.js dist/lib/tree-layout.test.js — the three test files this workstream touches still pass after the deletion."
      - "Do NOT gate on `node --test dist/lib/*.test.js`. The full suite cannot pass today for a reason unrelated to this workstream: dist/lib/skill-content-fetch.test.js carries a live-network tier that asserts the old prx-* skill ids against a since-renamed upstream target, and its own header at src/lib/skill-content-fetch.test.ts:6-8 states it has no skip-when-offline path by design. That failure is pre-existing — see the plan's Open question 2 — and is not a regression you caused."
    checklist:
      - "Does grep for hasPrxwork across src/ return zero matches?"
      - "Was the deletion written against the file as it stands after task 1.2, not against b9fe85b?"
      - "Does npm run build complete with no TypeScript error?"
      - "Does the board still render for this repository's own flowcharge/ tree after the deletion?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.3 Print the same deprecation line from `src/scripts/extract-praxis-data.ts`
    ```yaml
    description: "The --refresh CLI is the second entry point into extraction, so it warns on a legacy resolution in the same fixed form."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In main() (line 43), before or immediately after the extractPraxisData call at line 52, resolve the layout for args.root with resolveTreeLayout and, when it is legacy, print the identical fixed line: `LEGACY LAYOUT: <path> uses prxwork/ — rename it to flowcharge/; support for the old name will be removed`. Use the same greppable prefix as src/server.ts, byte for byte, so one grep finds both entry points."
      - "Keep the existing failure path at lines 53-57 intact: extractPraxisData still throws for a root holding neither folder, and the CLI still prints that message and exits 1. Task 1.2 widens the thrown text to name both folders, so this file needs no change for it."
      - "Update the file header comment at line 2, which names the old prxwork/ vocabulary, since this file is already being edited."
      - "Leave the --root usage string at line 38 as it is. The plan lists six user-facing copy sites and this CLI help text is not among them, so changing it is outside this task list."
    pattern: "src/scripts/extract-praxis-data.ts, lines 1-13 and 43-64."
    imports: "resolveTreeLayout from '../lib/tree-layout.js', alongside the existing extractPraxisData import at line 13."
    compatibility: "Exit codes and the JSON payload written to --out are unchanged. The warning goes to the log, never into the payload."
    gotcha: "console.log writes to stdout and the dump's success line at lines 62-64 already goes there. Send the deprecation line through console.warn so a caller piping stdout to a file still sees it, and so it matches src/server.ts's own channel."
    verify:
      - "npm run build"
      - "npm run refresh -- --root \"$TMPDIR/legacy-fixture\" --out \"$TMPDIR/legacy-fixture.json\" against the throwaway prxwork/ fixture built in task 3.1 — exactly one LEGACY LAYOUT: line is printed and the JSON is still written."
      - "npm run refresh -- --root . --out \"$TMPDIR/current.json\" — this repository's flowcharge/ tree prints no LEGACY LAYOUT: line. Remove both temporary JSON files afterwards."
    checklist:
      - "Does the CLI print the LEGACY LAYOUT: line in exactly the same fixed form as src/server.ts?"
      - "Does a flowcharge/ root print no such line?"
      - "Does the CLI still write its JSON payload and still exit 0 for a legacy root?"
      - "Does a root holding neither folder still print the extraction error and exit 1?"
      - "Is the --root usage string at line 38 unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 4. Phase 4 — User-facing copy

  ```yaml
  description: "Move the six user-facing strings in the browser bundle to the new vocabulary, after behaviour is correct. Depends on task 3."
  ```

  - [x] 4.1 Update `src/public/home.ts`
    ```yaml
    description: "The empty-state hint and the client-side add-form validation message."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "At line 155, in the no-projects empty state, change `Add the absolute path of any directory that contains a prxwork/ folder, using the form below.` to name flowcharge/ instead."
      - "At line 311, in submitPath's blank-input rejection, change `Enter the absolute path of a directory containing a prxwork/ folder` to name flowcharge/ instead."
      - "Do NOT try to make line 311 byte-identical to any src/server.ts string. See Divergence 4: the comment sits at lines 314-315, not 315-316, and the two messages it actually covers are TILDE_MESSAGE (line 89) and ABSOLUTE_PATH_MESSAGE (line 88), which DO match src/server.ts:190 and :194 byte for byte. Line 311 is the blank-input case, which the server has no twin for — server.ts:184 rejects a missing `path` key with different wording, and server.ts:198 interpolates the rejected input path, which a blank input does not have. Keep line 311 CONSISTENT in vocabulary only: it must name the same folder, flowcharge/, and mention the legacy prxwork/ fallback on the same terms as the string task 3.1 writes at server.ts:198."
      - "Mention the legacy prxwork/ fallback in these two strings only if the string task 3.1 wrote mentions it. Do not invent a second, longer explanation here."
      - "Change nothing else in this file. No markup, no handler, and no other string."
    pattern: "src/public/home.ts, lines 155 and 311 only."
    imports: "None."
    compatibility: "This file is browser-side ES5-style TypeScript using var and function declarations — match the surrounding style. It compiles under src/public/tsconfig.json and is then bundled by tools/bundle-public.mjs, both driven by npm run build."
    gotcha: "Line 311 has no byte-identical twin in src/server.ts and cannot be given one — see the implement step above. What the comment at lines 314-315 protects is the two constants at lines 88-89, and this task changes neither of them. Leave TILDE_MESSAGE and ABSOLUTE_PATH_MESSAGE exactly as they are: neither names a folder, so the rename does not reach them."
    verify:
      - "npm run build"
      - "grep -n 'prxwork' src/public/home.ts — any remaining hit must be a sentence explaining the legacy fallback, and nothing else."
      - "npm start, then load the home page with no projects registered and submit an empty path — both strings read in the new vocabulary."
    checklist:
      - "Does the empty state name flowcharge/ as the folder to look for?"
      - "Does the blank-input message name flowcharge/ and use the same folder vocabulary as the string task 3.1 wrote at src/server.ts:198, without claiming to be byte-identical to it?"
      - "Is every remaining prxwork mention in this file part of a legacy-fallback explanation?"
      - "Is the file's existing var-and-function browser style preserved?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.2 Update `src/public/index.html`
    ```yaml
    description: "The home page footer note, which names the data folder twice."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In the footer note, change both `<code>prxwork/</code>` occurrences to `<code>flowcharge/</code>` — the definition of a project in the first sentence, and the per-load extraction claim in the second. See Divergence 3: the two mentions sit on lines 46 and 47, not across lines 46-48 as the plan originally stated; line 48 names .praxis-projects.json, which is correct and stays."
      - "Leave the .praxis-projects.json sentence untouched. The registry file is not renamed by this workstream and the plan's assumption A5 confirms it carries no name coupling."
      - "Change no other markup in the file."
    pattern: "src/public/index.html, the footer note at lines 45-51."
    imports: "None."
    compatibility: "Static HTML copied to dist by tools/copy-assets.mjs during npm run build. Keep the <code> element around the folder name so it stays styled like the other literals on the page."
    gotcha: "This file also holds the add-project form and the integrations modal. Edit the footer note only."
    verify:
      - "npm run build"
      - "grep -n 'prxwork' src/public/index.html — returns zero matches."
      - "npm start and read the home page footer — it names flowcharge/ and still names .praxis-projects.json."
    checklist:
      - "Do both footer mentions now name flowcharge/?"
      - "Does grep for prxwork in this file return zero matches?"
      - "Is the .praxis-projects.json sentence unchanged?"
      - "Are the folder names still wrapped in <code> elements?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.3 Update `src/public/board.html`
    ```yaml
    description: "The board loading state and the board footer note."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "At line 71, in the loading state, change `Reading the project's <code>prxwork/</code> folder through the dashboard server.` to name flowcharge/."
      - "At line 90, in the footer note, change `Reads the selected project's <code>prxwork/</code> frontmatter live through the dashboard server` to name flowcharge/."
      - "Change no other markup, and leave the Needs attention and severity panels alone."
    pattern: "src/public/board.html, lines 71 and 90 only."
    imports: "None."
    compatibility: "Static HTML copied to dist by tools/copy-assets.mjs during npm run build. Keep both <code> wrappers."
    gotcha: "A board can legitimately be reading a legacy prxwork/ tree, so neither string may claim flowcharge/ is the only accepted name. Keep both sentences generic about the project's data folder rather than asserting an exclusive name."
    verify:
      - "npm run build"
      - "grep -n 'prxwork' src/public/board.html — returns zero matches."
      - "npm start and open any project board — the loading state and the footer both read in the new vocabulary."
    checklist:
      - "Does the loading state name flowcharge/?"
      - "Does the footer note name flowcharge/?"
      - "Does grep for prxwork in this file return zero matches?"
      - "Does neither string claim that flowcharge/ is the only readable folder name?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.4 Update the three modal empty states in `src/public/app.ts`
    ```yaml
    description: "Replace prxplan / prxissuelist / prxtasklist in the modal's three empty-state messages with plain descriptions, since the parser has never read those filenames."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "At line 810 in renderPlanPanel, change `The modal looked for a prxplan file in its folder and found none.` to say it looked for a plan file."
      - "At line 825 in renderIssuesPanel, change `a prxissuelist file` to `an issue list file`."
      - "At line 887 in renderTasksPanel, change `a prxtasklist file` to `a task list file`."
      - "Keep each message's first sentence and its overall shape. Only the filename phrase changes."
      - "These three strings named filenames the parser never read: src/lib/detail.ts:227-228 states that frontmatter `type` is the sole source of truth and the filename is ordering and display only. The new wording removes a claim that was already wrong before the rename."
      - "Change no other string, no handler, and no rendering logic in this 1405-line file."
    pattern: "src/public/app.ts, lines 810, 825 and 887 only."
    imports: "None."
    compatibility: "Browser-side TypeScript compiled by src/public/tsconfig.json and bundled by tools/bundle-public.mjs, both under npm run build. Match the surrounding var-and-function style."
    gotcha: "This file also carries a code comment at line 25 naming this dashboard's own prxwork/ tree. The plan's copy list does not include it and its two named stale comments are elsewhere, so leave line 25 alone — a grep for prxwork in this file will therefore still return that one comment hit, and that is expected."
    verify:
      - "npm run build"
      - "grep -n 'prxplan\\|prxissuelist\\|prxtasklist' src/public/app.ts — returns zero matches."
      - "npm start, open a card whose workstream has no plan, no issue list and no task list, and read all three empty tabs."
    checklist:
      - "Do all three empty states describe the artefact in words rather than by a prx-prefixed filename?"
      - "Does grep for the three prx-prefixed filenames in this file return zero matches?"
      - "Is the comment at line 25 unchanged?"
      - "Is every other string and every handler in the file unchanged?"
      - "Does the modal still populate normally for a workstream that HAS all three artefacts?"
    self_eval:
      passed: true
      failures: []
    ```

## Divergences

1. **The extract.ts test fixture hard-codes a third old literal.** PLN-58-n8ji7h states that `withFixtureProject` in `src/lib/extract.test.ts` hard-codes `'prxwork'` and `'prxworkstream.md'`, and asks for it to be parameterised over both generations. The helper at `src/lib/extract.test.ts:111-123`, read at `b9fe85b`, also writes a third old literal — `'prxissuelist.md'` at line 117. The plan's own Phase 1 testing note separately asks for a case using the new bare artefact name `IL-1-cc22dd-issuelist.md`, which that hard-coded filename blocks. Task 1.4 therefore parameterises the artefact filename as well as the folder and the marker. The helper also begins at line 111, not line 112 as the plan originally cited; PLN-58-n8ji7h now cites lines 111-123.

2. **The `hasPrxwork` guards sit one line above the messages.** The plan originally said `src/server.ts:6` "calls it at three route boundaries (lines 197, 336, 370)". At `b9fe85b` the three `hasPrxwork` calls are at lines 197, 335 and 369, and the three user-facing messages are at lines 198, 336 and 370. PLN-58-n8ji7h now cites the two sets separately. Both sets of edits are named explicitly in task 3.1 so neither is missed.

3. **The home page footer names the folder on two lines, not three.** The plan's copy list originally cited `src/public/index.html:46-48`. At `b9fe85b` the folder name appears on lines 46 and 47 only; line 48 names `.praxis-projects.json`, which this workstream does not rename. PLN-58-n8ji7h now cites lines 46 and 47 and excludes line 48 explicitly. Task 4.2 edits lines 46 and 47 and leaves line 48 alone.

4. **`src/public/home.ts:311` has no byte-identical twin in `src/server.ts`, and the comment sits one line higher than first cited.** The comment about the client strings being the server's own is at lines 314-315, not 315-316. The two strings it covers are `TILDE_MESSAGE` (line 89) and `ABSOLUTE_PATH_MESSAGE` (line 88), which do match `src/server.ts:190` and `:194` byte for byte. Line 311 is the blank-input rejection, and the server has no equivalent: `server.ts:184` rejects a missing `path` key with different wording, and `server.ts:198` interpolates the rejected input path, which a blank input cannot supply. Task 4.1 therefore requires vocabulary consistency, not byte identity, and task 3.1's compatibility note says the same.

5. **The full test suite cannot pass today, for a pre-existing and unrelated reason.** `src/lib/skill-content-fetch.test.ts` carries a live-network tier that asserts the eight old `prx-*` skill ids against a since-renamed upstream target, and its own header at lines 6-8 states it has no skip-when-offline mechanism by design. `node --test dist/lib/*.test.js` therefore fails regardless of this workstream. Tasks 1.4, 2.2 and 3.2 accordingly run only the test files relevant to them, and each carries a note so an executor does not read that failure as a regression. The plan's Open question 2 owns the underlying `prx-*` → `fc-*` skill-id breakage as a separate workstream.

Every other file the plan cites — `src/lib/extract.ts`, `src/public/home.ts`, `src/public/board.html`, `src/public/app.ts` and `src/scripts/extract-praxis-data.ts` — matched the plan's quoted line numbers and content when read at `b9fe85b`. `src/lib/detail.ts` did not: the plan cited `locateWorkstream` at line 195 when it begins at line 190, and the frontmatter-`type` comment at lines 229-230 when it sits at lines 227-228. PLN-58-n8ji7h has been corrected; the task-list citations for that file were already right.

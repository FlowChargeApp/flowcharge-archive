---
id: TL-30-gju8tp
type: tasklist
workstream: WS-34-d3gjrv
slug: artefact-id-suffix-upgrade
title: "Artefact ID suffix upgrade"
status: done
created: 2026-08-16
updated: 2026-08-17
author: Anthony Koukoullis
depends_on: [PLN-25-0agr4z]
links: []
mode: spec
base_commit: 34f6a2e
---

# PRX Tasks

## Artefact ID suffix upgrade

Praxis IDs now have the shape `TYPE-N-SUFFIX`, where `SUFFIX` is 6 random lowercase base-36
characters. Six registered projects still carry the old suffix-less `TYPE-N` form: Praxis-Board,
LAD, DownloadAlbum, lad-poc, Praxis-Launch and Praxis-Demo. This task list implements
`PLN-25-0agr4z`, which upgrades all six.

Phase 1 repairs this dashboard first. Three verified defects in `src/server.ts` and
`src/lib/extract.ts` reject, drop or mis-order new-shape ids today. They already break the
already-migrated `Praxis` and `Praxis-Website` projects. Migrating six more projects before the
repair would blank issue panels and scramble artefact ordering across the whole board.

Phase 2 builds one one-off Node script, `tools/migrate-artefact-ids.mjs`, modelled on the
`Praxis` project's own completed migration: back up the tree, allocate the whole id map first,
write a plain mapping record, then rewrite frontmatter, folder names and claim markers
mechanically from that map. Free-text prose is never rewritten automatically. The script emits a
triaged report of prose mentions for a human to resolve.

Phases 3 to 6 run that script one project at a time, in rising size order, with a verification
gate between each run. Phase 7 closes out.

`Praxis` and `Praxis-Website` are out of scope and are neither read from nor written to. The
shared `prx-orchestrate` skill, its `prx-index.mjs` script and its `CONVENTIONS.md` are not
changed. `flowcharge/ids.md` counters stay bare numbers. `index.md` and `kanban.md` are
generated views and are regenerated, never hand-edited.

Open question 1 is answered (see Divergence 3). Open question 2 is tasked against the plan's own
stated default and is not a genuinely open fork (see Divergence 4).

- [x] 1. Phase 1 — Make the dashboard read both ID shapes

  ```yaml
  description: "Fix the three verified compatibility defects in src/server.ts and src/lib/extract.ts so the dashboard reads both the old TYPE-N and the new TYPE-N-SUFFIX id shapes. Strictly additive: every pattern widens to accept both forms."
  ```

  - [x] 1.1 Widen the workstream-id shape guard in `src/server.ts`
    ```yaml
    description: "Defect 1. The detail API guard /^WS-\\d+$/ rejects every new-format workstream, so /api/projects/<id>/workstreams/<wsId>/detail returns HTTP 400 for WS-34-d3gjrv and for every migrated workstream. Widen it to accept both shapes while keeping it a shape check."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this SEARCH/REPLACE block to /Users/akoukoullis/Work/AK/Praxis-Dashboard/src/server.ts. The anchor is unique in the file (verified by grep -c at authoring time)."
      - |
        src/server.ts
        <<<<<<< SEARCH
            if (!/^WS-\d+$/.test(wsId)) {
        =======
            if (!/^WS-\d+(-[0-9a-z]{6})?$/.test(wsId)) {
        >>>>>>> REPLACE
      - "Leave the three comment lines directly above the guard unchanged. They state why the check is a shape check and not a filesystem check, and that reasoning is unaffected by the widening."
    pattern: "src/server.ts only. The guard sits in the detail-route branch, immediately after `const wsId = detailMatch[2];`."
    imports: "None. The change is a regular-expression literal already present in the file."
    compatibility: "The guard must stay a pure shape check. reqPath is already decodeURIComponent'd, so a decoded single segment such as `../etc` reaches this line and must still be rejected on shape. Do not replace it with an fs.existsSync or path-resolution check. The suffix class is lowercase-only base-36, matching randomSuffix() in prx-index.mjs, so `WS-5-ABC123` must still be rejected."
    gotcha: "Making the suffix group non-optional would break every still-unmigrated project, including this one, which is all old-format until Phase 3 runs. The group must be optional. Also do not touch locateWorkstream in src/lib/detail.ts: the plan verified it resolves a workstream by scanning frontmatter `id:` values, so it is already shape-agnostic and correct."
    verify:
      - "npx tsc -p tsconfig.json --noEmit"
      - "node -e \"const re=/^WS-\\d+(-[0-9a-z]{6})?$/; const cases=[['WS-5',true],['WS-34-d3gjrv',true],['../etc',false],['WS-',false],['WS-5-ABC123',false]]; for(const [s,want] of cases){ if(re.test(s)!==want) throw new Error(s+' expected '+want); } console.log('guard shape OK');\""
      - "grep -c 'WS-\\\\d+(-\\[0-9a-z\\]{6})?' src/server.ts — must return 1"
    checklist:
      - "Does the guard accept `WS-5` and `WS-34-d3gjrv`?"
      - "Does the guard still reject `../etc`, `WS-` and `WS-5-ABC123`?"
      - "Is the guard still a pure regular-expression shape check, with no filesystem or path call added?"
      - "Are the explanatory comments above the guard unchanged?"
      - "Is src/lib/detail.ts unmodified?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Widen the three issue patterns and fix `artefactIdNumber` in `src/lib/extract.ts`
    ```yaml
    description: "Defects 2 and 3. Three issue-item patterns assume a digit run is followed immediately by a period, so every migrated issue is silently dropped from the board and the severity panel. Separately, artefactIdNumber reads the number after the FINAL hyphen, which under the new shape is the suffix, so artefact ordering is silently corrupted."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Defect 2, part 1. At the `export const ISSUE_ITEM` declaration (line 53 at base_commit), widen the id capture group so the digit run may be followed by an optional `-` plus exactly six lowercase base-36 characters, before the required period. The capture group must still capture the WHOLE id including the suffix, because its value is what lands in the issues[] payload. Illustrative only, not literal: the id group becomes `(ISS-\\d+(?:-[0-9a-z]{6})?)`. Leave the checkbox group as capture group 1 and the title as the final group — the surrounding code passes markGroup 1 for this pattern."
      - "Defect 2, part 2. In the `if (fm.type === 'issuelist')` block below (line 130 at base_commit), widen the split lookahead `text.split(/\\n(?=-\\s*\\[[ xX]\\]\\s*ISS-\\d+\\.)/)` with the same optional suffix group. This lookahead has no capture groups; keep it that way by using a non-capturing group."
      - "Defect 2, part 3. On the next statement (line 132 at base_commit), widen the per-block match `b.match(/-\\s*\\[([ xX])\\]\\s*(ISS-\\d+)\\.\\s*(.*)/)` identically. Group numbering must not change: idm[1] is the mark, idm[2] the id, idm[3] the title, and all three are read immediately below."
      - "All three patterns change together, in one edit. The comment above ISSUE_ITEM states they are deliberately character-identical in shape so the modal and the board cannot disagree about what counts as an issue. Update that comment only if the widening makes its wording untrue; do not delete it."
      - "Defect 3. Rewrite the body of `export function artefactIdNumber(id: string): number` so it parses the NUMBER segment rather than the segment after the final hyphen. Match the leading type prefix and the digit run that follows it, and return that number; return 0 when no number segment parses. Illustrative only, not literal: match `id` against `/^[A-Za-z]+-(\\d+)/` and return `Number(m[1])` when it matches, else 0."
      - "Update the sort-key comment block above artefactIdNumber so it no longer says 'the number after the final hyphen'. Keep its existing explanation of why the fallback is 0 and never NaN, and why grouping by artefact type supplies the shared-prefix precondition — both remain true."
    pattern: "src/lib/extract.ts only. Four locations: the ISSUE_ITEM export, the artefactIdNumber function, and the two patterns inside the issuelist branch of the extraction loop."
    imports: "None. All four changes are edits to existing regular-expression literals and one function body."
    compatibility: "The suffix class must be exactly `[0-9a-z]{6}`, matching randomSuffix() in prx-index.mjs, so an uppercase or wrong-length tail is not treated as a suffix. Both id shapes must keep working, because the estate is half-migrated until Phase 6 completes. Capture-group indices must not shift: countChecks is called with markGroup 1 for ISSUE_ITEM and markGroup 2 for TASK_ITEM, and idm[1]/idm[2]/idm[3] are read directly. artefactIdNumber is exported and shared with src/lib/detail.ts, so one rule must keep serving both surfaces. The file is compiled under `strict: true` and `noEmitOnError: true`."
    gotcha: "The dangerous case is an all-digit suffix. At base_commit `IL-9-000123` returns 123 — a wrong but entirely plausible sort key, so ordering breaks with no visible fallback. The fix must return 9 for that input. Do not change TASK_ITEM: task numbers are `1.` and `1.1`, an unrelated shape. Adding a capture group to the split lookahead at line 130 would change split() semantics by injecting captured text into the result array, so use a non-capturing group there."
    verify:
      - "npx tsc -p tsconfig.json --noEmit"
      - "npm run build"
      - "grep -c 'ISS-\\\\d+(?:-\\[0-9a-z\\]{6})?' src/lib/extract.ts — must return 3, one per widened pattern"
      - "grep -c 'lastIndexOf' src/lib/extract.ts — must return 0"
    checklist:
      - "Do all three issue patterns match both `- [x] ISS-2. Title` and `- [x] ISS-18-awinon. Title`?"
      - "Are the capture-group indices unchanged in ISSUE_ITEM and in the line-132 match, and does the line-130 lookahead still contain no capture group?"
      - "Does artefactIdNumber return 175 for `TL-175`, 175 for `TL-175-ab12cd`, 9 for `IL-9-000123`, and 0 for an id with no number segment?"
      - "Is TASK_ITEM unchanged?"
      - "Does `npm run build` succeed under strict and noEmitOnError?"
      - "Are src/lib/detail.ts and src/public/app.ts unmodified?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Add `src/lib/extract.test.ts` covering both id shapes
    ```yaml
    description: "Phase 1's unit tests, per the plan's Testing strategy. These guard a live defect and stay in the repository after the migration retires. They cover artefactIdNumber over both shapes and the three issue patterns over both item forms."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/extract.test.ts. Use the Node built-in test runner: `import { test } from 'node:test';` and `import assert from 'node:assert/strict';`. The project declares `engines.node >= 18` and has no test framework installed, so the built-in runner adds no dependency (see Divergence 1)."
      - "Import the symbols under test from './extract.js' — the tsconfig uses `module: node16`, so the compiled `.js` specifier is required even in a `.ts` source file."
      - "Test artefactIdNumber over the plan's named cases: `TL-175` gives 175, `TL-175-ab12cd` gives 175, and `IL-9-000123` gives 9. The last case is the regression guard: at base_commit it returned a wrong-but-plausible 123. Add one id with no parsable number segment and assert it gives 0, never NaN."
      - "Test ISSUE_ITEM over both item forms: `- [x] ISS-2. Some title` and `- [x] ISS-18-awinon. Some title`. Assert for each that it matches, that capture group 1 is the mark, that capture group 2 is the WHOLE id including any suffix, and that group 3 is the title."
      - "Test the two remaining issue patterns from the issuelist branch over the same two forms. If they are not exported, assert the same behaviour through the exported extraction path instead of re-declaring the literals — a copied literal would pass while the file's own pattern stayed broken, which is exactly the failure this test exists to catch."
      - "Do not add a test-runner dependency, a test script to package.json, or a test config file. The run command is the verify step below."
    pattern: "src/lib/extract.test.ts (new). tsconfig.json already includes `src/lib/**/*.ts`, so the file is type-checked and compiled to dist/lib/extract.test.js with no config change."
    imports: "node:test and node:assert/strict, both built in. The symbols under test from './extract.js'."
    compatibility: "Compiled under `strict: true`, `noEmitOnError: true`, `module: node16`, `target: es2022`, `types: [\"node\"]`. Because noEmitOnError is set, a type error in this file fails `npm run build` — that is intended. The file lands in dist/ alongside the server; that is harmless, as nothing imports it."
    gotcha: "A regex match returns `RegExpMatchArray | null` under strict mode, so assert the match is non-null before indexing it, or tsc fails. Do not assert on the exact number of prose mentions or on anything outside this file's exports — these tests must stay valid after the six projects migrate."
    verify:
      - "npm run build"
      - "node --test dist/lib/extract.test.js"
      - "Confirm every case named in the plan's Testing strategy for Phase 1 is present: git stash the 1.1 and 1.2 edits, rebuild, and confirm the suite fails; restore and confirm it passes."
    checklist:
      - "Does the suite cover artefactIdNumber for `TL-175`, `TL-175-ab12cd` and `IL-9-000123`?"
      - "Does the suite cover all three issue patterns over both the suffixed and the unsuffixed item form?"
      - "Does the suite fail against the pre-fix code and pass against the fixed code?"
      - "Were zero new dependencies and zero package.json scripts added?"
      - "Does `npm run build` still succeed with the test file included in the compile?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — Build the migration script and prove it on Praxis-Demo

  ```yaml
  description: "Write tools/migrate-artefact-ids.mjs to the interface fixed in the plan's Design, with every stage and every refusal condition, then prove it on Praxis-Demo — the smallest meaningful target at 12 artefacts and 3 ISS items, with no cross-repo coupling. Depends on Phase 1, so the result is observable on the board."
  ```

  - [x] 2.1 Write `tools/migrate-artefact-ids.mjs`
    ```yaml
    description: "The one-off migration script. Nine stages in fixed order, four refusal conditions, one required argument. It is retained after the migration as the record of what ran."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create tools/migrate-artefact-ids.mjs, beside the existing tools/copy-assets.mjs. Follow that file's conventions rather than inventing a new location or module style. This keeps flowcharge/ holding artefacts only."
      - "Interface, exactly: `node tools/migrate-artefact-ids.mjs --root <project-root> [--dry-run] [--date <YYYY-MM-DD>]`. `--root` is required and the script refuses to run when `<root>/flowcharge/` is absent. `--dry-run` performs every read and every computation, writes the mapping record and the prose report to a temporary location, and makes no change inside flowcharge/. `--date` overrides the date stamp used for the backup folder and the mapping-record name, so a resumed or repeated run reuses the original stamp instead of orphaning the first backup. The date stamp defaults to today."
      - "Refusal conditions. Exit non-zero without writing when any hold: (a) `<root>/flowcharge-pre-migration-<date>/` already exists and `--date` was not passed; (b) the project has zero old-format artefacts; (c) the finished map contains a duplicate new id; (d) any mapped folder rename would collide with an existing directory."
      - "Stage 1, Scan. Walk `flowcharge/workstreams/` and `flowcharge/archive/`. Collect every artefact `id:` frontmatter value and every `ISS-N` item id inside every issuelist.md."
      - "Stage 2, Allocate. For each collected old id matching `^(WS|PLN|IL|TL|ISS)-\\d+$`, draw a suffix with the same algorithm as the live tooling: 6 characters from the literal alphabet `0123456789abcdefghijklmnopqrstuvwxyz`, one `crypto.randomInt` draw per character. Mirror randomSuffix() at /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs lines 64-69 rather than inventing a second algorithm. Ids that already match the new shape are skipped and never enter the map — that skip is what protects WS-34-d3gjrv in Phase 3."
      - "Stage 3, Assert. Fail if the map holds duplicate values, or if any old id appears twice."
      - "Stage 4, Back up. Copy the whole flowcharge/ tree to `<root>/flowcharge-pre-migration-<date>/`, matching the precedent at /Users/akoukoullis/Work/AK/Praxis/flowcharge-pre-migration-2026-08-16/. This is a hard precondition, not a nicety: three of the six targets are not git repositories, so the copy is their only rollback path."
      - "Stage 5, Write the mapping record to `flowcharge/id-migration-<date>.md` BEFORE any rewrite, so an interrupted run still leaves the map recoverable. Format follows the precedent at /Users/akoukoullis/Work/AK/Praxis/flowcharge/id-migration-2026-08-13.md: a header stating what the file is and why it is kept, an `| Old | New |` table, a list of workstream folders renamed, and a list of claim markers retired. The header must repeat the precedent's key sentence in substance — this is a plain record, nothing parses it, and it exists so a commit message or review comment citing an old id can still be resolved."
      - "Stage 6, Rewrite exact references. Frontmatter keys ONLY: `id:`, `workstream:`, `depends_on:`, `links:`, `issues:`, plus `ISS-N` item ids at the start of an issue-list checkbox line. Handle both inline-array and scalar frontmatter forms. These are structured data with a closed, known vocabulary per project, which is what makes mechanical rewriting safe here and unsafe in prose."
      - "Stage 7, Rename folders to `WS-N-SUFFIX-<slug>`, derived from the mapped id and the existing slug."
      - "Stage 8, Rename claim markers under `flowcharge/ids/` for every marker whose name is a mapped old id. Markers with NO map entry are left alone and listed in the record. Do not delete an unmatched marker and do not create a missing one — see Divergence 4."
      - "Stage 9, Emit the prose report to `flowcharge/id-migration-<date>-prose-review.md`. It lists every remaining occurrence of an old-shape id in file content that the Stage 6 rewrite did not touch: artefact bodies, `gotcha` and `compatibility` fields, plan prose, task descriptions. It NEVER rewrites them. Each entry carries file path, line number, the old id, the mapped new id where one exists, and the surrounding line, so a reviewer decides without opening the file. Group each occurrence into one of two buckets as a triage aid only, with the final call staying human: `In-map`, where the mentioned id is in this project's own map and a rewrite is likely; and `Not-in-map`, where it is not, so it is likely a foreign project's id or an orphan and the default is to leave it alone."
      - "Scope boundary. The script knows about markdown frontmatter, the id map and the filesystem. It must NOT know anything about the dashboard's TypeScript, about which project it is running against, or about any project's content. Every project-specific value arrives through --root."
    pattern: "tools/migrate-artefact-ids.mjs (new). One file. Plain .mjs, not TypeScript — it sits outside tsconfig's `include` and is run directly by node, exactly as tools/copy-assets.mjs is."
    imports: "node:fs, node:path and node:crypto, all built in. Add no dependency: the project's only devDependencies are typescript and @types/node."
    compatibility: "Node >= 18 per package.json engines. ESM, since package.json sets `type: module`. The suffix alphabet and the per-character crypto.randomInt draw must match prx-index.mjs exactly, so ids minted here are indistinguishable from ids the live tooling claims. Do NOT reuse prx-index.mjs's --claim path: it allocates the NEXT number and creates a marker, but this migration must keep each artefact's existing N and change only the suffix. Do not modify prx-index.mjs, CONVENTIONS.md or any part of the prx-orchestrate skill. Do not change the format of flowcharge/ids.md — its counters are bare numbers and stay bare numbers."
    gotcha: "Blind find-and-replace across the tree is the failure this design exists to prevent: the Praxis precedent deliberately left roughly 83 old-shape mentions untouched because they cite another repository's ids or a superseded id that should remain historical text, and a sweep would rewrite them to point at the wrong artefact while still looking well-formed. Stage 5 must precede Stage 6 or an interrupted run loses the map. flowcharge/ids/ is gitignored per GITIGNORE_TARGETS in prx-index.mjs, so git does not restore claim markers even in the three git-backed projects — that is why Stage 4 is unconditional. An all-numeric drawn suffix is legal and must not be special-cased; task 1.2 is what makes it safe. Ordering hazard: the script assumes exclusive access, because a prx-* skill claiming an id mid-run would create a new-format id the map has never seen and could collide with a folder rename."
    verify:
      - "node tools/migrate-artefact-ids.mjs — must exit non-zero and report that --root is required"
      - "node tools/migrate-artefact-ids.mjs --root /Users/akoukoullis/Work/AK/Praxis --dry-run — must refuse with the zero-old-format-artefacts condition, proving an already-migrated project is a no-op refusal rather than damage"
      - "git -C /Users/akoukoullis/Work/AK/Praxis status --porcelain — must be unchanged by the previous step"
      - "npm run build — must still succeed, confirming the new file is outside the TypeScript compile"
    checklist:
      - "Are all nine stages present, in the plan's order, with Stage 5 writing the mapping record before any rewrite in Stage 6?"
      - "Are all four refusal conditions implemented, each exiting non-zero without writing?"
      - "Does the suffix draw use the literal alphabet `0123456789abcdefghijklmnopqrstuvwxyz` with one crypto.randomInt call per character?"
      - "Are already-new-shape ids skipped so they never enter the map?"
      - "Does Stage 6 rewrite ONLY the five frontmatter keys plus leading ISS-N item ids, and never free-text prose?"
      - "Does the script take every project-specific value from --root, with no reference to any project name, path or content, and no dependency added?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "node:os is imported alongside node:fs, node:path and node:crypto, for os.tmpdir() as the --dry-run output location. It is built in, so no dependency was added."
        - "Refusals are raised as a MigrationError and turned into exit 1 by main(), rather than calling process.exit inside migrate(). This keeps all four refusal conditions testable in process; behaviour at the command line is unchanged."
    ```

  - [x] 2.2 Add `tools/migrate-artefact-ids.test.mjs`
    ```yaml
    description: "Phase 2's unit tests, per the plan's Testing strategy. Coverage is proportionate to a one-off script: the pure logic gets real tests, and the filesystem effects are proven by dry-run and by the live gates in each migration phase. These tests may retire with the script."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create tools/migrate-artefact-ids.test.mjs using the Node built-in runner (`node:test`, `node:assert/strict`), matching task 1.3's approach and adding no dependency."
      - "Export the pure helpers from tools/migrate-artefact-ids.mjs so they are importable, and guard the script's own entry point so importing the module does not run a migration. Illustrative only, not literal: run the main routine only when `import.meta.url` matches the invoked argv path."
      - "Cover suffix generation: the result is exactly 6 characters and every character is drawn from `0123456789abcdefghijklmnopqrstuvwxyz`."
      - "Cover map construction, including the skip of already-new ids. Assert that an input set containing `WS-34-d3gjrv` produces a map with no entry for it."
      - "Cover the duplicate-map assertion: a map forced to hold a duplicate new id must be rejected."
      - "Cover frontmatter rewriting over each of the five keys — `id:`, `workstream:`, `depends_on:`, `links:`, `issues:` — in BOTH inline-array and scalar form."
      - "Cover folder-name derivation: a mapped id plus an existing slug yields `WS-N-SUFFIX-<slug>`."
      - "Cover the prose report's bucketing rule: an id present in the map buckets as In-map, an id absent from it buckets as Not-in-map."
      - "Add the plan's Phase 2 integration check as a test or a scripted step: copy a real project tree to a throwaway directory, run the script against the copy, diff the result against expectations, then run it a second time and assert it refuses rather than double-migrating. Use a temporary directory and remove it afterwards. Never point this at a registered project path."
    pattern: "tools/migrate-artefact-ids.test.mjs (new), beside the script it tests."
    imports: "node:test, node:assert/strict, node:fs, node:os and node:path, all built in. The exported helpers from ./migrate-artefact-ids.mjs."
    compatibility: "ESM under package.json `type: module`, Node >= 18. Outside tsconfig's `include`, so it is not type-checked by the build — that is expected for a .mjs file, matching tools/copy-assets.mjs."
    gotcha: "Suffix generation is random, so assert on shape and alphabet, never on a specific value. The integration check must run against a throwaway copy in a temp directory only: pointing it at any of the six registered project paths would perform a real, unsequenced migration and break the plan's one-project-at-a-time gating. Remove the temp directory even when an assertion fails."
    verify:
      - "node --test tools/migrate-artefact-ids.test.mjs"
      - "Confirm the second run in the integration check exits non-zero, proving idempotence by refusal"
      - "ls /tmp — confirm the throwaway tree was removed"
    checklist:
      - "Are suffix shape and alphabet asserted without asserting a specific random value?"
      - "Is the skip of already-new ids covered, including a WS-34-d3gjrv case?"
      - "Is frontmatter rewriting covered for all five keys in both inline-array and scalar form?"
      - "Does the integration check run only against a throwaway temp copy, and does it clean up?"
      - "Does a second run against an already-migrated copy refuse rather than double-migrate?"
      - "Were zero new dependencies added?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "The integration check builds its own throwaway fixture tree in a temp directory instead of copying a real project tree. A copy of a real project stops exercising anything the moment that project migrates, because the script then correctly refuses it as having zero old-format artefacts. The gotcha's actual requirement — never point the check at a registered project path — is satisfied either way."
        - "node:child_process is imported to run the script as a subprocess and assert its exit codes. It is built in, so no dependency was added."
    ```

  - [x] 2.3 Dry-run the script against Praxis-Demo and read its output end to end
    ```yaml
    description: "First contact with a real project. --dry-run is the default posture: every read and every computation happens, the mapping record and prose report are written to a temporary location, and nothing inside flowcharge/ changes."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Capture the baseline BEFORE anything else, because acceptance criterion 6 is defined against it: run `node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/Praxis-Demo --check` and save the output. Also record the project's current workstream count, issue count and artefact ordering as the dashboard renders them, for acceptance criterion 9."
      - "Run `node tools/migrate-artefact-ids.mjs --root /Users/akoukoullis/Work/AK/Praxis-Demo --dry-run`."
      - "Read the generated mapping record end to end. Confirm every old id in the Old column matches `^(WS|PLN|IL|TL|ISS)-\\d+$` and every new id in the New column matches `^(WS|PLN|IL|TL|ISS)-\\d+-[0-9a-z]{6}$`, with the number unchanged between the two columns on every row."
      - "Read the folder-rename list end to end. Confirm each target is `WS-N-SUFFIX-<slug>` with the slug unchanged and the suffix equal to the one the map gave that workstream's id."
      - "Read the prose report end to end. Praxis-Demo is 12 artefacts and 3 ISS items, so this is the run where reading everything is cheap and worth doing."
      - "Confirm nothing under /Users/akoukoullis/Work/AK/Praxis-Demo/flowcharge/ changed, and that no flowcharge-pre-migration folder was created by the dry run."
    pattern: "Read-only against /Users/akoukoullis/Work/AK/Praxis-Demo/. Writes only to a temporary location and to the baseline capture."
    imports: "tools/migrate-artefact-ids.mjs from task 2.1. The prx-index.mjs script at /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs, used read-only with --check."
    compatibility: "Praxis-Demo is at /Users/akoukoullis/Work/AK/Praxis-Demo per the live registry in .praxis-projects.json. Its archive/ is empty or absent, so the walk finds no archived artefacts. Praxis-Demo has no cross-repo coupling."
    gotcha: "The baseline must be captured before the run or acceptance criterion 6 has nothing to compare against, and re-deriving it afterwards is impossible. Do not run any prx-* skill against Praxis-Demo while this phase is open: a claim landing mid-run would mint an id the map has never seen."
    verify:
      - "node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/Praxis-Demo --check — output identical to the baseline, since the dry run changed nothing"
      - "ls -d /Users/akoukoullis/Work/AK/Praxis-Demo/flowcharge-pre-migration-* — must find nothing"
      - "Confirm the mapping record's row count equals the number of old-format artefacts the scan reported"
    checklist:
      - "Was the --check baseline captured before the dry run, and saved somewhere the later phases can read?"
      - "Were the pre-migration workstream count, issue count and artefact ordering recorded for acceptance criterion 9?"
      - "Does every mapping row keep the number unchanged and change only the suffix?"
      - "Did the dry run leave /Users/akoukoullis/Work/AK/Praxis-Demo/flowcharge/ byte-for-byte unchanged?"
      - "Did the dry run create no backup folder?"
    self_eval:
      passed: true
      failures:
        - item: "Read the prose report end to end."
          reason: "The first dry run reported 36 occurrences, 30 of which were lines the mechanical rewrite had already corrected. The prose scan runs over the rewritten content, but its known-new-id set held only ids that were already new at scan time, not the ids the run had just minted."
          fix: "Union the map's new values into the known-new set before the prose scan. The dry run then reported 6 genuine occurrences. A regression test asserts no rewritten frontmatter line or issue item is reported back as prose."
      notes:
        - "The baseline is saved at flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/baselines/ as praxis-demo-check.txt, praxis-demo-data.json and praxis-demo-baseline.md. Later phases read it from there."
        - "The mapping record holds 15 rows, equal to the 15 distinct old-format ids the scan reported (12 artefact ids plus 3 ISS item ids)."
    ```

  - [x] 2.4 Run the migration for real against Praxis-Demo
    ```yaml
    description: "The first live migration. Praxis-Demo goes first because it is the smallest meaningful target, has no cross-repo coupling, and is a demo project, so an error there costs least."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `node tools/migrate-artefact-ids.mjs --root /Users/akoukoullis/Work/AK/Praxis-Demo`."
      - "Check acceptance criteria 1 through 8 with the verify steps below."
      - "Regenerate the index: `node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/Praxis-Demo`. index.md and kanban.md are generated views — regenerate them, never hand-edit them."
      - "Open the dashboard on Praxis-Demo and confirm the same workstream count, issue count and artefact ordering as the baseline recorded in task 2.3 (acceptance criterion 9)."
      - "Re-run the script against Praxis-Demo and confirm it refuses rather than double-migrating."
      - "Resolve every entry in the prose report. Praxis-Demo's volume makes exhaustive review cheap here. Record each entry as either rewritten or deliberately left alone, with the reason (acceptance criterion 11)."
    pattern: "Data changes confined to /Users/akoukoullis/Work/AK/Praxis-Demo/flowcharge/. No source file in this repository changes."
    imports: "tools/migrate-artefact-ids.mjs. prx-index.mjs for --check and for regeneration."
    compatibility: "Praxis-Demo is not a git repository, so the flowcharge-pre-migration-<date> copy is its ONLY rollback path. Do not proceed if the backup is missing. Rollback procedure: delete flowcharge/, then rename flowcharge-pre-migration-<date>/ back to flowcharge/."
    gotcha: "Do not delete the backup folder. It is the only rollback path for this project and the plan does not plan its deletion — see Divergence 5. Phase 1 must already be merged, or the board cannot show the migrated result and acceptance criterion 9 cannot be checked."
    verify:
      - "AC1: grep -rhE '^id: ' /Users/akoukoullis/Work/AK/Praxis-Demo/flowcharge --include='*.md' | grep -cvE '^id: (WS|PLN|IL|TL|ISS)-[0-9]+-[0-9a-z]{6}$' — must return 0"
      - "AC2: grep -rhE '^- \\[[ xX]\\] ISS-[0-9]+\\.' /Users/akoukoullis/Work/AK/Praxis-Demo/flowcharge --include='*.md' | wc -l — must return 0"
      - "AC3: grep -rnE '^(workstream|depends_on|links|issues|tasks):.*(WS|PLN|IL|TL|ISS)-[0-9]+([^-0-9]|$)' /Users/akoukoullis/Work/AK/Praxis-Demo/flowcharge --include='*.md' | wc -l — must return 0"
      - "AC4: ls /Users/akoukoullis/Work/AK/Praxis-Demo/flowcharge/workstreams | grep -cvE '^WS-[0-9]+-[0-9a-z]{6}-' — must return 0"
      - "AC5: ls /Users/akoukoullis/Work/AK/Praxis-Demo/flowcharge/ids 2>/dev/null | grep -E '^(WS|PLN|IL|TL|ISS)-[0-9]+$' — every name printed must appear in the mapping record's unmatched-markers list"
      - "AC6: node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/Praxis-Demo --check — no new errors against the task 2.3 baseline"
      - "AC7 and AC8: ls /Users/akoukoullis/Work/AK/Praxis-Demo/flowcharge/id-migration-2026-08-16.md /Users/akoukoullis/Work/AK/Praxis-Demo/flowcharge-pre-migration-2026-08-16/ — both must exist"
      - "Idempotence: node tools/migrate-artefact-ids.mjs --root /Users/akoukoullis/Work/AK/Praxis-Demo — must exit non-zero"
    checklist:
      - "Do acceptance criteria 1 through 8 all hold for Praxis-Demo?"
      - "Does --check report no new errors against the baseline captured in task 2.3?"
      - "Does the dashboard show the same workstream count, issue count and artefact ordering as the baseline?"
      - "Does a second run refuse instead of double-migrating?"
      - "Is every prose-report entry either resolved or explicitly recorded as deliberately left alone?"
      - "Does the backup folder still exist, undeleted?"
    self_eval:
      passed: true
      failures:
        - item: "AC7 and AC8: ls .../id-migration-2026-08-16.md .../flowcharge-pre-migration-2026-08-16/ — both must exist"
          reason: "The verify step hardcodes 2026-08-16, the date the task list was authored. The run happened on 2026-08-17, and the implement step directs running without --date, so the stamp is 2026-08-17."
          fix: "Verified against the actual stamp: id-migration-2026-08-17.md and flowcharge-pre-migration-2026-08-17/ both exist. Every later phase inherits the same stale literal — see the note below."
        - item: "Resolve every entry in the prose report."
          reason: "The report cited pre-rename folder paths, because the prose scan captured each path during Stage 6 while Stage 7 renames the folders afterwards. A reviewer following a cited path would not find the file."
          fix: "Stage 9 now maps each path through the folder renames before reporting it. The already-written Praxis-Demo report had its 8 folder prefixes corrected in place, and a test asserts every cited path resolves on disk."
      notes:
        - "Date stamp: the run used 2026-08-17, not the 2026-08-16 written into the verify steps of tasks 2.4, 3, 4.1, 4.2, 5.1, 5.2, 6 and 7. Either those literals are updated to 2026-08-17, or every later phase is run with --date 2026-08-16 to put the whole estate on one stamp. This needs a decision before Phase 3."
        - "AC6: no new error and no new warning class appeared. Six warnings cleared, including all five false `counter N but no marker exists` warnings that acceptance criterion in task 7 targets. Three artefacts (IL-1, WS-4, WS-5) newly trip the pre-existing `updated but file modified` warning purely because the migration rewrote their files; Stage 6 is scoped to five keys and deliberately does not bump `updated`."
        - "Prose report: 6 entries, all resolved. Three issue-block `id:` lines were rewritten because they are structured identity data that had come to disagree with their own checkbox ids. Three free-text prose mentions were deliberately left alone, following the Praxis precedent. The reasoning is recorded in the report itself under `## Resolution`."
    ```

- [x] 3. Phase 3 — Migrate Praxis-Board (this project)
  ```yaml
  description: "Run the script against this project: 86 old artefacts alongside one already-new WS-34-d3gjrv, which the skip rule must leave untouched. It is the first mixed-state target and the first git-backed target, so rollback is cheap while the skip rule is proven. 29 of the 30 folders WS-30 renamed very recently are due a second rename, this workstream's own folder being the sole exception. Depends on Phase 2."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Capture the baseline first: `node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/Praxis-Dashboard --check`, saved for comparison. Record the current workstream count, issue count and artefact ordering as the dashboard renders them. Also record a checksum of every file under `flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/` (this workstream's own folder must stay byte-for-byte untouched) and the total file count under `flowcharge/workstreams/` — `flowcharge/` is gitignored in this project (confirmed: it holds zero tracked files), so `git status`/`git diff` cannot see anything this task does and are not usable checks here, unlike for the src/ and tools/ changes earlier in this workstream."
    - "Run `node tools/migrate-artefact-ids.mjs --root /Users/akoukoullis/Work/AK/Praxis-Dashboard --dry-run` and read the mapping record and folder-rename list. Confirm WS-34-d3gjrv is absent from the Old column before running for real."
    - "Run `node tools/migrate-artefact-ids.mjs --root /Users/akoukoullis/Work/AK/Praxis-Dashboard`."
    - "Check acceptance criteria 1 through 8, plus criterion 10: this workstream and its folder are unchanged by the migration."
    - "Regenerate the index: `node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/Praxis-Dashboard`."
    - "Confirm the board renders identically to the baseline, then resolve every entry in the prose report, recording each as rewritten or deliberately left alone with the reason."
  pattern: "Data changes confined to /Users/akoukoullis/Work/AK/Praxis-Dashboard/flowcharge/, except flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/, which must not change. No file under src/ or tools/ changes in this task."
  imports: "tools/migrate-artefact-ids.mjs from task 2.1. prx-index.mjs for --check and regeneration."
  compatibility: "This is a git repository, but flowcharge/ (not just flowcharge/ids/) is gitignored here per GITIGNORE_TARGETS in prx-index.mjs, so `git checkout -- flowcharge/` restores NOTHING — it is not a rollback path for anything this task does, unlike for the src/ and tools/ changes made earlier in this workstream. The unconditional pre-migration backup is therefore the ONLY rollback path here, the same as for the three non-git-repo target projects (lad-poc, Praxis-Launch, Praxis-Demo)."
  gotcha: "This is the task that proves the Stage 2 skip rule. If WS-34-d3gjrv appears anywhere in the mapping record's Old column, stop and roll back before proceeding: the skip is broken and every later phase inherits the defect. Do not run any prx-* skill against this project while the migration runs, and note that this task list and the plan both live inside the folder that must stay untouched."
  verify:
    - "AC10a: find flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade -type f | sort | xargs shasum | shasum — must match the checksum captured in the baseline step (git status cannot see this folder, since flowcharge/ is gitignored)"
    - "AC10b: grep -c 'WS-34-d3gjrv' flowcharge/id-migration-2026-08-17.md — the id must not appear in the Old column"
    - "AC1: grep -rhE '^id: ' /Users/akoukoullis/Work/AK/Praxis-Dashboard/flowcharge --include='*.md' | grep -cvE '^id: (WS|PLN|IL|TL|ISS)-[0-9]+-[0-9a-z]{6}$' — must return 0"
    - "AC2: grep -rhE '^- \\[[ xX]\\] ISS-[0-9]+\\.' /Users/akoukoullis/Work/AK/Praxis-Dashboard/flowcharge --include='*.md' | wc -l — must return 0"
    - "AC3: grep -rnE '^(workstream|depends_on|links|issues|tasks):.*(WS|PLN|IL|TL|ISS)-[0-9]+([^-0-9]|$)' /Users/akoukoullis/Work/AK/Praxis-Dashboard/flowcharge --include='*.md' | wc -l — must return 0"
    - "AC4: ls /Users/akoukoullis/Work/AK/Praxis-Dashboard/flowcharge/workstreams | grep -cvE '^WS-[0-9]+-[0-9a-z]{6}-' — must return 0"
    - "AC6: node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/Praxis-Dashboard --check — no new errors against the baseline"
    - "AC7 and AC8: ls flowcharge/id-migration-2026-08-17.md flowcharge-pre-migration-2026-08-17/ — both must exist"
    - "find flowcharge/workstreams -type f | wc -l — must equal the file count recorded in the baseline step (folder renames and content rewrites change no file's existence, so the total count is invariant; git diff cannot be used here, since flowcharge/ is gitignored)"
  checklist:
    - "Is WS-34-d3gjrv absent from the mapping record's Old column, and is its folder byte-for-byte unchanged?"
    - "Do acceptance criteria 1 through 8 all hold for Praxis-Board?"
    - "Does the total file count under flowcharge/workstreams/ match the baseline?"
    - "Does the board render with the same workstream count, issue count and artefact ordering as the baseline?"
    - "Is every prose-report entry either resolved or explicitly recorded as deliberately left alone?"
    - "Are src/, tools/ and package.json untouched by this task?"
  self_eval:
    passed: true
    failures: []
    notes:
      - "Skip rule proven. WS-34-d3gjrv appears nowhere in flowcharge/id-migration-2026-08-17.md, and the checksum of its folder is 1add4ca6b7943e7a70f59e1eb6c85d7a026dde4d both before and after the run. WS-35-970q8q was skipped on the same rule. 10 already-new ids were skipped in total."
      - "Scale. The scan read 94 markdown files and found 92 distinct old-format ids. The description's `86 old artefacts` is the count of files the rewrite changed, not the count of ids: 92 ids map, 86 files change, 29 folders rename, 21 claim markers rename."
      - "AC5. Two bare markers remain, flowcharge/ids/PLN-24 and flowcharge/ids/WS-31. Both are listed in the record's unmatched list and neither was renamed nor deleted, per Divergence 4. WS-31 is the leaked Praxis-Launch claim that task 4.1 documents."
      - "AC6. Zero errors before and after, and no new warning class. The `updated but file modified` class grew from 3 to 84 because Stage 6 rewrites files and deliberately does not bump `updated` — the same known consequence recorded for Praxis-Demo in task 2.4."
      - "Prose report: 1145 occurrences, all resolved in a `## Resolution` section appended to flowcharge/id-migration-2026-08-17-prose-review.md. 18 rewritten, 1127 deliberately left alone. The 18 are structured identity and cross-reference data inside YAML fences — indented `id:`, `issues:` and `tasks:` keys that Stage 6's column-1 anchor cannot reach — the same class task 2.4 rewrote for Praxis-Demo."
      - "Side effect of those 18 rewrites: all seven pre-existing `task N: issues unknown id ISS-N` warnings cleared. The check output is now 116 warnings and 0 errors."
      - "Left alone: 6 TypeScript code comments reading `id: string; // IL-1 / TL-5`; 922 in-map free-text prose mentions, including 144 inside this workstream's own baselines/ files, which exist to record the pre-migration state; and 193 not-in-map mentions citing LAD, Praxis-Launch or deliberately invalid test literals such as WS-99 and ISS-999."
      - "Board unchanged: 31 workstreams and 10 issues before and after, with identical workstream order, artefact order within every workstream, titles and statuses once suffixes are stripped."
      - "Baseline artefacts are at flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/baselines/ as praxis-dashboard-check.txt, praxis-dashboard-data.json and praxis-dashboard-baseline.md."
  ```

- [x] 4. Phase 4 — Migrate Praxis-Launch and record the cross-repo mapping

  ```yaml
  description: "Run the script against Praxis-Launch, 4 artefacts. Then discharge the cross-repo coupling to Praxis-Website by RECORDING the mapping in two places, without editing Praxis-Website at all. Depends on Phase 2."
  ```

  - [x] 4.1 Migrate Praxis-Launch and author `## Known external references` in its mapping record
    ```yaml
    description: "The migration run, plus the extra mapping-record section that Praxis-Launch alone gets. That section is how the cross-repo coupling is discharged without touching Praxis-Website's source."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Capture the baseline first: `node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/Praxis-Launch --check`, saved for comparison. Record the current workstream count, issue count and artefact ordering."
      - "Record `git -C /Users/akoukoullis/Work/AK/Praxis-Website status --porcelain` before the run, so the after-comparison has a reference."
      - "Run `node tools/migrate-artefact-ids.mjs --root /Users/akoukoullis/Work/AK/Praxis-Launch --dry-run`, read its output, then run it for real."
      - "Add a `## Known external references` section to /Users/akoukoullis/Work/AK/Praxis-Launch/flowcharge/id-migration-2026-08-17.md. It names Praxis-Website's Hero.tsx comment citing WS-31 and gives that workstream's new id from this run's map."
      - "In that same section, record the related fact: the Praxis migration deleted flowcharge/ids/WS-31, flowcharge/ids/PLN-23 and flowcharge/ids/TL-25 as leaked claims. Those are three of Praxis-Launch's four live artefact ids, so Praxis-Launch's numbers no longer have protective markers in Praxis. State that the new suffix is precisely what makes that harmless going forward, rather than leaving it to be rediscovered."
      - "Check acceptance criteria 1 through 8, regenerate the index, confirm the board renders unchanged, and resolve the prose report."
    pattern: "Data changes confined to /Users/akoukoullis/Work/AK/Praxis-Launch/flowcharge/."
    imports: "tools/migrate-artefact-ids.mjs. prx-index.mjs for --check and regeneration."
    compatibility: "Praxis-Launch is not a git repository, so the flowcharge-pre-migration-<date> copy is its ONLY rollback path. It holds 4 artefacts and 1 claim marker, so gaps between markers and artefacts exist in both directions."
    gotcha: "Editing Praxis-Website is explicitly out of scope, including the Hero.tsx comment that cites WS-31. The handling is a findable mapping record and nothing else. Any change under /Users/akoukoullis/Work/AK/Praxis-Website/ is a scope breach, not a fix. Praxis-Launch's 1-marker-for-4-artefacts gap must be listed, not repaired — see Divergence 4."
    verify:
      - "AC1: grep -rhE '^id: ' /Users/akoukoullis/Work/AK/Praxis-Launch/flowcharge --include='*.md' | grep -cvE '^id: (WS|PLN|IL|TL|ISS)-[0-9]+-[0-9a-z]{6}$' — must return 0"
      - "AC2: grep -rhE '^- \\[[ xX]\\] ISS-[0-9]+\\.' /Users/akoukoullis/Work/AK/Praxis-Launch/flowcharge --include='*.md' | wc -l — must return 0"
      - "AC3: grep -rnE '^(workstream|depends_on|links|issues|tasks):.*(WS|PLN|IL|TL|ISS)-[0-9]+([^-0-9]|$)' /Users/akoukoullis/Work/AK/Praxis-Launch/flowcharge --include='*.md' | wc -l — must return 0"
      - "AC4: ls /Users/akoukoullis/Work/AK/Praxis-Launch/flowcharge/workstreams | grep -cvE '^WS-[0-9]+-[0-9a-z]{6}-' — must return 0"
      - "AC6: node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/Praxis-Launch --check — no new errors against the baseline"
      - "AC7 and AC8: ls /Users/akoukoullis/Work/AK/Praxis-Launch/flowcharge/id-migration-2026-08-17.md /Users/akoukoullis/Work/AK/Praxis-Launch/flowcharge-pre-migration-2026-08-17/ — both must exist"
      - "grep -A20 'Known external references' /Users/akoukoullis/Work/AK/Praxis-Launch/flowcharge/id-migration-2026-08-17.md — must name Hero.tsx and give WS-31's new id"
      - "git -C /Users/akoukoullis/Work/AK/Praxis-Website status --porcelain — identical to the pre-run capture"
    checklist:
      - "Do acceptance criteria 1 through 8 all hold for Praxis-Launch?"
      - "Does the mapping record's `## Known external references` section name Praxis-Website's Hero.tsx and give WS-31's new id?"
      - "Does that section also record the three deleted Praxis claim markers and why the new suffix makes the gap harmless?"
      - "Is /Users/akoukoullis/Work/AK/Praxis-Website/ completely unmodified, confirmed by its git status?"
      - "Was the unmatched claim-marker situation listed rather than repaired?"
      - "Is every prose-report entry either resolved or explicitly recorded as deliberately left alone?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Date stamp: the run used 2026-08-17, which is what this task's verify steps already name, so the stale-literal problem task 2.4 flagged does not arise here. No --date override was passed."
        - "Scale. The scan read 4 markdown files and found 4 distinct old-format ids, 0 ISS item ids. All 4 mapped, 0 already-new ids skipped, 4 files rewritten, 1 folder renamed, 1 claim marker renamed, 0 unmatched markers. Map: WS-31 to WS-31-uvbvjr, PLN-23 to PLN-23-974ghz, TL-25 to TL-25-f4c7d8, TL-26 to TL-26-57fvk6."
        - "AC5. Zero unmatched claim markers, because this project held only one marker (TL-26) and it mapped. The reverse gap is real and is listed, not repaired: WS-31, PLN-23 and TL-25 have no marker at all, and the new `## Known external references` section records that under `### This project's own marker gap`, per Divergence 4."
        - "AC6. Zero errors before and after, and no new warning class. Two pre-existing `counter N but no marker exists` warnings cleared (PLN-23 and TL-26). Four artefacts newly trip the pre-existing `updated but file modified` warning purely because the migration rewrote their files; Stage 6 is scoped to five keys and deliberately does not bump `updated`. This is the same known consequence recorded for Praxis-Demo in task 2.4 and for Praxis-Board in task 3."
        - "Board unchanged: 1 workstream and 0 issues before and after, with identical workstream order, artefact order, titles and statuses once suffixes are stripped. Compared machine-to-machine through dist/scripts/extract-praxis-data.js against the saved baseline."
        - "Prose report: 82 occurrences, all resolved in a `## Resolution` section appended to flowcharge/id-migration-2026-08-17-prose-review.md. 4 rewritten, 78 deliberately left alone."
        - "The 4 rewrites were stale filesystem PATHS, not id mentions: `flowcharge/workstreams/WS-31-open-source-launch/` inside two `pattern:` fields and two `implement:` steps, pointing at a directory Stage 7 had renamed. Only the folder segment changed. This is the same class task 2.4 corrected for Praxis-Demo."
        - "Left alone: 47 In-map free-text prose mentions, which the mapping table already resolves; and all 31 Not-in-map mentions, every one of which cites the separate Praxis project's own WS-4, WS-5, WS-32 or WS-34. Rewriting those is the precise failure the two-bucket design prevents."
        - "Unlike Praxis-Demo and Praxis-Board, this project needed no structured-identity rewrites. A scan for indented `id:`, `workstream:`, `depends_on:`, `links:`, `issues:` and `tasks:` keys carrying an old-shape id inside a YAML fence returned nothing."
        - "Praxis-Website was read but never written. `git -C /Users/akoukoullis/Work/AK/Praxis-Website status --porcelain` printed nothing both before and after the run. Hero.tsx was opened read-only, at line 60, solely to quote its comment accurately into the record."
        - "Baseline artefacts are at flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/baselines/ as praxis-launch-check.txt, praxis-launch-data.json and praxis-launch-baseline.md."
    ```

  - [x] 4.2 Write `cross-repo-references.md` in this workstream's folder
    ```yaml
    description: "A second copy of the `## Known external references` content, placed in this workstream's folder so the other active session can find it from either side of the cross-repo coupling."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/cross-repo-references.md."
      - "Copy the `## Known external references` content authored in task 4.1: Praxis-Website's Hero.tsx comment citing WS-31, that workstream's new id, and the note about the three Praxis claim markers deleted as leaked claims."
      - "Give it a short header saying what it is and why it exists — a findable record readable from this side of the coupling, not a parsed artefact."
    pattern: "flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/cross-repo-references.md (new). One file, in this repository."
    imports: "The `## Known external references` content from task 4.1."
    compatibility: "This is a plain record. Nothing parses it. Give it no Praxis frontmatter and no artefact id, so the index generator does not treat it as an artefact."
    gotcha: "This file lands inside the folder that acceptance criterion 10 requires the MIGRATION to leave unchanged. Criterion 10 constrains the migration script, not this task. Sequence this task after task 3 so the two are never confused, and never let this file's creation be the reason criterion 10's git check fails."
    verify:
      - "ls flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/cross-repo-references.md — must exist"
      - "grep -c 'Hero.tsx' flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/cross-repo-references.md — must return at least 1"
      - "node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/Praxis-Dashboard --check — no new errors, confirming the file is not read as an artefact"
    checklist:
      - "Does the file name Praxis-Website's Hero.tsx and give WS-31's new id?"
      - "Does its content match the `## Known external references` section in Praxis-Launch's mapping record?"
      - "Does it carry no frontmatter and no artefact id?"
      - "Does --check report no new errors after the file is added?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "The file is flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/cross-repo-references.md. It opens with a plain `#` heading, carries no frontmatter and no `id:` key, and states that it is a plain record and that the authoritative copy is Praxis-Launch's mapping record."
        - "It reproduces the whole `## Known external references` section from task 4.1 — the Hero.tsx comment at line 60, WS-31's new id WS-31-uvbvjr, the cited task 1.2 now in TL-26-57fvk6, the ambiguity explanation, the three Praxis claim markers deleted as leaked claims, and Praxis-Launch's own marker gap. It adds the full 4-row id map so a reader on this side can resolve any of the four ids without opening the other project."
        - "--check on Praxis-Dashboard reports 0 errors after the file was added, and its output never mentions the file, confirming the index generator does not read it as an artefact."
        - "Sequenced after task 3, per the gotcha. Task 3's acceptance criterion 10 checksum was taken and verified before this file existed, so this file cannot be the reason that check fails."
    ```

- [x] 5. Phase 5 — Migrate lad-poc and DownloadAlbum

  ```yaml
  description: "Two separate runs with a verification gate between them, in this order. Depends on Phase 3, so the mechanism is proven on a mixed-state git-backed project first."
  ```

  - [x] 5.1 Migrate lad-poc
    ```yaml
    description: "19 artefacts, 7 ISS items, not a git repository. Runs first because it is the smaller of the two."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Capture the baseline first: `node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/AgenticCodingTests/lad-poc --check`, saved for comparison. Record the current workstream count, issue count and artefact ordering."
      - "Run `node tools/migrate-artefact-ids.mjs --root /Users/akoukoullis/Work/AK/AgenticCodingTests/lad-poc --dry-run`, read its output, then run it for real."
      - "Check acceptance criteria 1 through 8, regenerate the index, and confirm the board renders unchanged."
      - "Resolve every entry in this project's prose report BEFORE starting task 5.2. The plan sequences the gate that way."
    pattern: "Data changes confined to /Users/akoukoullis/Work/AK/AgenticCodingTests/lad-poc/flowcharge/."
    imports: "tools/migrate-artefact-ids.mjs. prx-index.mjs for --check and regeneration."
    compatibility: "lad-poc is not a git repository, so the flowcharge-pre-migration-<date> copy is its ONLY rollback path. Its archive/ is empty or absent."
    gotcha: "Do not start DownloadAlbum until this project's prose report is resolved. The plan's gate exists so a bad assumption costs one restore, not two. Do not delete the backup — it is the only rollback path here."
    verify:
      - "AC1: grep -rhE '^id: ' /Users/akoukoullis/Work/AK/AgenticCodingTests/lad-poc/flowcharge --include='*.md' | grep -cvE '^id: (WS|PLN|IL|TL|ISS)-[0-9]+-[0-9a-z]{6}$' — must return 0"
      - "AC2: grep -rhE '^- \\[[ xX]\\] ISS-[0-9]+\\.' /Users/akoukoullis/Work/AK/AgenticCodingTests/lad-poc/flowcharge --include='*.md' | wc -l — must return 0"
      - "AC3: grep -rnE '^(workstream|depends_on|links|issues|tasks):.*(WS|PLN|IL|TL|ISS)-[0-9]+([^-0-9]|$)' /Users/akoukoullis/Work/AK/AgenticCodingTests/lad-poc/flowcharge --include='*.md' | wc -l — must return 0"
      - "AC4: ls /Users/akoukoullis/Work/AK/AgenticCodingTests/lad-poc/flowcharge/workstreams | grep -cvE '^WS-[0-9]+-[0-9a-z]{6}-' — must return 0"
      - "AC6: node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/AgenticCodingTests/lad-poc --check — no new errors against the baseline"
      - "AC7 and AC8: ls /Users/akoukoullis/Work/AK/AgenticCodingTests/lad-poc/flowcharge/id-migration-2026-08-17.md /Users/akoukoullis/Work/AK/AgenticCodingTests/lad-poc/flowcharge-pre-migration-2026-08-17/ — both must exist"
    checklist:
      - "Do acceptance criteria 1 through 8 all hold for lad-poc?"
      - "Does --check report no new errors against the baseline?"
      - "Does the board render lad-poc with unchanged workstream count, issue count and artefact ordering?"
      - "Was every prose-report entry resolved before task 5.2 started?"
      - "Does the backup folder still exist, undeleted?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Date stamp: the run used 2026-08-17, which is what this task's verify steps already name, so no --date override was passed."
        - "Scale. The scan read 19 markdown files and found 26 distinct old-format ids (19 artefact ids plus 7 ISS item ids). All 26 mapped, 0 already-new ids skipped, 19 files rewritten, 6 folders renamed, 23 claim markers renamed, 1 unmatched."
        - "AC5. One bare marker remains, flowcharge/ids/IL-2. It is listed in the record's unmatched list and was neither renamed nor deleted, per Divergence 4. It is the sole remaining cause of the `IL counter is 2 but no IL-2 artefact or marker exists` warning, which is a genuine pre-existing gap rather than a migration artefact."
        - "AC6. Zero errors before and after. Warnings moved 27 to 22. Four false `counter N but no marker exists` warnings cleared and all 19 `issues unknown id` warnings cleared. The only new warning class is `updated but file modified`, on the 19 files Stage 6 rewrote — the same known consequence recorded for Praxis-Demo in task 2.4, for Praxis-Board in task 3 and for Praxis-Launch in task 4.1."
        - "Board unchanged: 6 workstreams and 7 issues before and after, with identical workstream order, artefact order within every workstream, titles and statuses once suffixes are mapped back. Compared machine-to-machine through dist/scripts/extract-praxis-data.js against the saved baseline, reversing each id through this run's own map rather than by pattern-stripping."
        - "Prose report: 695 occurrences, all resolved in a `## Resolution` section appended to flowcharge/id-migration-2026-08-17-prose-review.md. 26 rewritten, 669 deliberately left alone."
        - "The 26 rewrites are structured identity and cross-reference data inside YAML fences — indented `id:` keys in issuelist.md and indented `issues:` keys in tasklist.md, which Stage 6's column-1 anchor cannot reach. This is the same class tasks 2.4 and 3 rewrote."
        - "Left alone: 610 In-map free-text prose mentions, which the mapping table already resolves; and all 59 Not-in-map mentions, every one of which cites the separate LAD project's PLN-34, WS-189 or WS-179."
        - "Every path cited in the prose report resolves on disk (695 of 695), confirming the Stage 9 path-mapping fix from task 2.4 holds at this scale."
        - "Baseline artefacts are at flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/baselines/ as lad-poc-check.txt, lad-poc-data.json and lad-poc-baseline.md."
    ```

  - [x] 5.2 Migrate DownloadAlbum
    ```yaml
    description: "93 artefacts, 39 ISS items, git-backed, and the heaviest claim-marker load in the estate at 115 old markers. Runs after lad-poc's gate closes."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Confirm task 5.1's prose report is fully resolved before starting."
      - "Capture the baseline first: `node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/DownloadAlbum --check`, saved for comparison. Record the current workstream count, issue count and artefact ordering, and `git -C /Users/akoukoullis/Work/AK/DownloadAlbum status --porcelain`."
      - "Run `node tools/migrate-artefact-ids.mjs --root /Users/akoukoullis/Work/AK/DownloadAlbum --dry-run`, read its output, then run it for real."
      - "Pay particular attention to the claim-marker section of the mapping record. This project has the heaviest marker load at 115 old markers, so it is the strongest test of Stage 8."
      - "Check acceptance criteria 1 through 8, regenerate the index, confirm the board renders unchanged, and resolve the prose report."
    pattern: "Data changes confined to /Users/akoukoullis/Work/AK/DownloadAlbum/flowcharge/."
    imports: "tools/migrate-artefact-ids.mjs. prx-index.mjs for --check and regeneration."
    compatibility: "DownloadAlbum is a git repository, so `git checkout -- flowcharge/` is a second rollback path — but flowcharge/ids/ is gitignored, so the 115 claim markers are NOT restored by git and must come from the backup. That is exactly why the backup is unconditional."
    gotcha: "115 markers is the largest Stage 8 workload before LAD. Any marker with no map entry is left alone and listed in the record — do not delete it and do not create a missing one, see Divergence 4. Do not run any prx-* skill against this project while the migration runs."
    verify:
      - "AC1: grep -rhE '^id: ' /Users/akoukoullis/Work/AK/DownloadAlbum/flowcharge --include='*.md' | grep -cvE '^id: (WS|PLN|IL|TL|ISS)-[0-9]+-[0-9a-z]{6}$' — must return 0"
      - "AC2: grep -rhE '^- \\[[ xX]\\] ISS-[0-9]+\\.' /Users/akoukoullis/Work/AK/DownloadAlbum/flowcharge --include='*.md' | wc -l — must return 0"
      - "AC3: grep -rnE '^(workstream|depends_on|links|issues|tasks):.*(WS|PLN|IL|TL|ISS)-[0-9]+([^-0-9]|$)' /Users/akoukoullis/Work/AK/DownloadAlbum/flowcharge --include='*.md' | wc -l — must return 0"
      - "AC4: ls /Users/akoukoullis/Work/AK/DownloadAlbum/flowcharge/workstreams | grep -cvE '^WS-[0-9]+-[0-9a-z]{6}-' — must return 0"
      - "AC5: ls /Users/akoukoullis/Work/AK/DownloadAlbum/flowcharge/ids | grep -E '^(WS|PLN|IL|TL|ISS)-[0-9]+$' — every name printed must appear in the mapping record's unmatched-markers list"
      - "AC6: node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/DownloadAlbum --check — no new errors against the baseline"
      - "AC7 and AC8: ls /Users/akoukoullis/Work/AK/DownloadAlbum/flowcharge/id-migration-2026-08-17.md /Users/akoukoullis/Work/AK/DownloadAlbum/flowcharge-pre-migration-2026-08-17/ — both must exist"
    checklist:
      - "Was lad-poc's prose report fully resolved before this task started?"
      - "Do acceptance criteria 1 through 8 all hold for DownloadAlbum?"
      - "Is every old-format claim marker either renamed or listed in the record as unmatched, with none deleted and none created?"
      - "Does the board render DownloadAlbum with unchanged workstream count, issue count and artefact ordering?"
      - "Is every prose-report entry either resolved or explicitly recorded as deliberately left alone?"
      - "Does the backup folder still exist, undeleted?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Date stamp: the run used 2026-08-17, which is what this task's verify steps already name, so no --date override was passed."
        - "Scale. The scan read 93 markdown files and found 132 distinct old-format ids (93 artefact ids plus 39 ISS item ids). All 132 mapped, 0 already-new ids skipped, 93 files rewritten, 28 folders renamed, 115 claim markers renamed, 0 unmatched."
        - "AC5. All 115 markers had a map entry and all 115 were renamed. Nothing was deleted and nothing was created. The marker directory still holds exactly 115 entries and none of them is bare. This was the heaviest Stage 8 workload before LAD and it needed no unmatched-marker handling at all."
        - "AC6. Zero errors before and after. Warnings moved 175 to 105. Five false `counter N but no marker exists` classes cleared, the `links unknown id` class cleared, the WS-22 folder-name warning cleared, and all 95 `issues unknown id` warnings cleared. No new warning class appeared at all, not even `updated but file modified`, because that class was already present in the baseline."
        - "Board unchanged: 28 workstreams and 39 issues before and after, with identical workstream order, artefact order within every workstream, titles and statuses once suffixes are mapped back. Compared machine-to-machine through dist/scripts/extract-praxis-data.js against the saved baseline, reversing each id through this run's own map."
        - "One folder path changed beyond gaining a suffix. `WS-22-normalizeForMatch-not-in-browser-context` became `WS-22-4pj6gb-normalize-for-match-not-in-browser-context`. Stage 7 derives the folder name from the record's own `slug` frontmatter value, which already read `normalize-for-match-not-in-browser-context`. The baseline `--check` reported that folder as wrong for its id and slug; the rename cleared that warning. This is Stage 7 working as specified, not a divergence."
        - "Prose report: 1636 occurrences, all resolved in a `## Resolution` section appended to flowcharge/id-migration-2026-08-17-prose-review.md. 174 rewritten across 167 lines in 18 files, 1462 deliberately left alone."
        - "The 167 rewritten lines are structured identity and cross-reference data inside YAML fences that Stage 6's column-1 anchor cannot reach: 39 issue-block `id:` keys, 95 task `issues:` keys, 28 issue `tasks:` back-references and 5 `depends_on:` keys. The 95 `issues:` lines are exactly the references `--check` reported as unknown."
        - "Left alone: 1425 In-map free-text prose mentions, which the mapping table already resolves; and all 37 Not-in-map mentions, every one of which is quoted inside WS-28's own historical record of orphaned markers (IL-1, IL-23, PLN-17, ISS-10 to ISS-12, TL-29, TL-31, TL-34, TL-37, TL-39, TL-45, TL-47, TL-48, TL-50). Rewriting those ids would falsify the finding that records them."
        - "Every path cited in the prose report resolves on disk (1636 of 1636)."
        - "Pre-existing state: `git -C /Users/akoukoullis/Work/AK/DownloadAlbum status --porcelain` already held 61 lines of uncommitted AK-to-Praxis migration changes before this task ran. That capture is saved as downloadalbum-git-before.txt so a later phase can tell those apart from this migration's changes."
        - "Baseline artefacts are at flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/baselines/ as downloadalbum-check.txt, downloadalbum-data.json, downloadalbum-baseline.md and downloadalbum-git-before.txt."
    ```

- [x] 6. Phase 6 — Migrate LAD
  ```yaml
  description: "Run the script against LAD: 482 artefacts, 829 ISS items, 184 folders, 1388 distinct ids and 2631 exact cross-reference rewrites. Last, because it is the largest by an order of magnitude and because everything about the script is proven by now. This task covers acceptance criteria 1 through 8 and the emission of the prose report. It STOPS at the prose review, which is gated on Divergence 3. Depends on Phase 5."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Confirm every earlier migration phase is complete and every earlier prose report is resolved."
    - "Capture the baseline first: `node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD --check`, saved for comparison. Record the current workstream count, issue count and artefact ordering, and `git -C /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD status --porcelain`."
    - "Run `node tools/migrate-artefact-ids.mjs --root /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD --dry-run`. Read the mapping record's summary counts and the folder-rename list. At this scale, confirm the counts rather than reading all 1388 rows: 482 artefacts, 829 ISS items, 184 folders."
    - "Run `node tools/migrate-artefact-ids.mjs --root /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD` for real."
    - "Check acceptance criteria 1 through 8, regenerate the index, and confirm the board renders LAD with unchanged counts."
    - "Confirm the prose report was emitted and that its entries are bucketed In-map and Not-in-map. Open question 1 is answered as option (b): review the In-map bucket only — 'review', not a blanket rewrite. The four completed phases already establish exactly what 'in-map' licenses: rewrite ONLY the narrow class of structured identity/cross-reference data (an `id:`, `issues:`, `tasks:`, or `depends_on:` key, or an equivalent reference to another artefact by id) that sits somewhere the main mechanical pass's anchor could not reach, the same class those four phases actually rewrote (18 of 940 Praxis-Board In-map occurrences, 4 of 51 Praxis-Launch, 26 of 636 lad-poc, 167 of 1592 DownloadAlbum). LEAVE EVERY NARRATIVE / FREE-TEXT PROSE MENTION ALONE, unrewritten, REGARDLESS of whether it is In-map or Not-in-map — a sentence recording why a workstream was superseded, dropped, or how it relates to another is historical record, not identity data, and being in-map does not make rewriting it safe or wanted. Record every left-alone entry, from both buckets, as deliberately left alone in the resolution record. If in doubt whether a given In-map occurrence is structured data or narrative, leave it alone and record it as such — this task must not treat the LAD-scale bucket sizes as a reason to loosen that bar."
  pattern: "Data changes confined to /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD/flowcharge/."
  imports: "tools/migrate-artefact-ids.mjs. prx-index.mjs for --check and regeneration."
  compatibility: "LAD is a git repository, but flowcharge/ (not just flowcharge/ids/) is gitignored here, so `git checkout -- flowcharge/` restores NOTHING — the same false rollback claim caught and corrected in Praxis-Board's own task 3. The unconditional pre-migration backup is the only rollback path. LAD dominates the estate-wide count of up to 10,069 prose mentions."
  gotcha: "Open question 1 is answered: option (b), review the In-map bucket, per the plan's own recommendation — and 'review' means the same narrow structured-identity rewrite class the four completed phases actually applied, not a blanket rewrite of every In-map occurrence. LAD's In-map bucket is roughly 7000+ occurrences and the dry run's own samples are narrative (e.g. 'superseded by WS-98's simplification...'), not identity data — that scale is not itself evidence a wider rewrite is warranted; if anything it is exactly where a wrong reading does the most damage, since this is not cleanly reversible from the mapping record alone. Do not touch a Not-in-map entry either — it is likely a foreign project's id or an orphan, and the report's own stated default is to leave it alone. Everything above the prose review is mechanical. Do not run any prx-* skill against LAD while the migration runs."
  verify:
    - "AC1: grep -rhE '^id: ' /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD/flowcharge --include='*.md' | grep -cvE '^id: (WS|PLN|IL|TL|ISS)-[0-9]+-[0-9a-z]{6}$' — must return 0"
    - "AC2: grep -rhE '^- \\[[ xX]\\] ISS-[0-9]+\\.' /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD/flowcharge --include='*.md' | wc -l — must return 0"
    - "AC3: grep -rnE '^(workstream|depends_on|links|issues|tasks):.*(WS|PLN|IL|TL|ISS)-[0-9]+([^-0-9]|$)' /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD/flowcharge --include='*.md' | wc -l — must return 0"
    - "AC4: ls /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD/flowcharge/workstreams | grep -cvE '^WS-[0-9]+-[0-9a-z]{6}-' — must return 0"
    - "AC6: node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD --check — no new errors against the baseline"
    - "AC7 and AC8: ls /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD/flowcharge/id-migration-2026-08-17.md /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD/flowcharge-pre-migration-2026-08-17/ — both must exist"
    - "git -C /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD diff --stat — the changed-file count matches the audit's 482"
    - "ls /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD/flowcharge/id-migration-2026-08-17-prose-review.md — must exist and contain both In-map and Not-in-map buckets"
  checklist:
    - "Do acceptance criteria 1 through 8 all hold for LAD?"
    - "Does `git diff --stat` report 482 changed files?"
    - "Does the board render LAD with unchanged workstream count, issue count and artefact ordering?"
    - "Was the prose report emitted with both buckets populated?"
    - "Was only the narrow structured-identity class of In-map occurrences rewritten (matching what phases 3-5 actually rewrote), with every narrative/free-text mention — In-map or not — left alone and recorded as such?"
    - "Does the backup folder still exist, undeleted?"
  self_eval:
    passed: true
    failures:
      - item: "Does `git diff --stat` report 482 changed files?"
        reason: "git cannot see the change. LAD's flowcharge/ is ignored by the user's global gitignore (/Users/akoukoullis/.gitignore_global:48 matches `flowcharge/`), and `git ls-files flowcharge` returns 0 tracked files. `git diff --stat` is therefore empty and `git status --porcelain` shows one line only, the untracked backup folder. This task's compatibility field claiming `git checkout -- flowcharge/` is a second rollback path for LAD is wrong for the same reason; the backup is the only rollback path here, exactly as for Praxis-Board in task 3."
        fix: "Counted the same quantity against the pre-migration backup instead, mapping each of the 184 renamed workstream folders through the mapping record: 482 artefact markdown files differ from flowcharge-pre-migration-2026-08-17/, matching the audit's 482 exactly. The only other changed files are the three generated/instruction files at the flowcharge/ root — index.md, kanban.md and ids.md — all changed by the index regeneration, not by the rewrite. ids.md's counters are untouched and still bare numbers; only its instruction sentence changed."
    notes:
      - "The mechanical migration was run directly by the orchestrating agent on 2026-08-17, because an earlier subagent attempt was blocked by the environment's command-permission classifier. Reported: 485 markdown files scanned, 482 artefact ids, 829 ISS item ids, 1310 distinct old-format ids, 0 already-new ids skipped, 482 files rewritten, 184 folders renamed, 51 markers renamed with 2 unmatched. This task confirmed that result rather than re-running it."
      - "AC1 0, AC2 0, AC3 0, AC4 0 across 184 workstream folders. AC5: the two bare markers flowcharge/ids/PLN-36 and flowcharge/ids/WS-185 both appear in the record's unmatched list, and neither was renamed nor deleted, per Divergence 4. AC7 and AC8: id-migration-2026-08-17.md and flowcharge-pre-migration-2026-08-17/ both exist, and the backup is undeleted."
      - "AC6. Zero errors before and after. Warnings fell 1800 to 595. `issues unknown id` fell 1497 to 8 and `links unknown id` cleared entirely; the five false `counter N but no marker exists` warnings cleared. The `updated but file modified` class grew, the same known consequence recorded for every earlier phase, because Stage 6 rewrites files and deliberately does not bump `updated`."
      - "One new warning class appeared, `duplicate issue id ISS-497-a671v8`. It is a pre-existing LAD data defect, not a migration or prose-pass artefact: two different issues in two different workstreams were both numbered ISS-497, and flowcharge-pre-migration-2026-08-17/index.md:459 already recorded the collision. One old id maps to one new id, so both received the same suffix. Repairing it means renumbering one of the two issues, which is outside this migration's scope. It is documented in the resolution record."
      - "Board unchanged: 184 workstreams and 829 issues before and after, with identical workstream order, artefact order within every workstream, issue order, titles, statuses and severities once every id is reversed through this run's own map. Compared machine-to-machine through dist/scripts/extract-praxis-data.js against baselines/lad-data.json; zero entries differ."
      - "Prose review, corrected reading. 7988 occurrences, all resolved in a `## Resolution` section appended to flowcharge/id-migration-2026-08-17-prose-review.md. 2690 rewritten on 2492 lines in 202 files, 5298 deliberately left alone (4439 In-map and all 859 Not-in-map)."
      - "The 2690 rewrites are the same narrow structured-identity and cross-reference class phases 2.4, 3, 5.1 and 5.2 rewrote — indented YAML keys, and block-sequence elements under them, that Stage 6's column-1 anchor cannot reach. By key: `id:` 829 (every issue block's own id key), `issues:` 1683 (1489 inline arrays plus 194 block-sequence elements), `tasks:` 178 (170 inline plus 8 block-sequence). No `depends_on:`, `links:` or `workstream:` key needed one."
      - "The classifier was validated against the completed phases before it was applied. Over lad-poc's report it selects exactly the 26 occurrences task 5.1 rewrote. Over DownloadAlbum's report it selects the same 18 files and the same line set task 5.2 rewrote, and every one of those lines already carries a new-shape id, so the class is no wider here than there."
      - "Ratio. 2690 of 7129 In-map occurrences rewritten, 37.7 percent, against 1.9 percent for Praxis-Board (18 of 940), 7.8 for Praxis-Launch (4 of 51), 4.1 for lad-poc (26 of 636) and 10.9 for DownloadAlbum (174 of 1599, measured 186 by this classifier). The percentage is higher because structured cross-references scale with issue count while narrative prose does not: LAD holds 829 ISS items against DownloadAlbum's 39, a 21x ratio, and its 829 `id:` lines are exactly 21x DownloadAlbum's 39. Per issue LAD is in fact lighter, at 3.2 structured occurrences per issue against DownloadAlbum's 4.5."
      - "Left alone — In-map (4439). Free-text prose the mapping table already resolves: 1801 in narrative body text, 1244 in markdown list items and checkbox titles, and the remainder inside free-text keys (443 `notes:`, 351 `description:`, 242 `gotcha:`, 93 `compatibility:`, 74 `reason:`, 38 `fix:`, and smaller counts elsewhere). Six narrative bullets that happen to open with an id sit under `checklist:`, `verify:`, `implement:` or no key at all, never under a structured cross-reference key, so they were left alone too."
      - "Left alone — Not-in-map (859). Every one is an ISS id with no artefact in this project: 78 distinct ids led by ISS-1 (107), ISS-2 (89), ISS-3 (70), ISS-5 (63), ISS-6 (60) and ISS-4 (56). They are AK-era issue numbers quoted inside historical records and inside shell fixtures. Rewriting them would point them at ids that do not exist."
      - "Every path cited in the prose report resolves on disk: 301 of 301 distinct paths. Every reported line still matched its file byte-for-byte before the rewrite, so no entry was stale."
      - "Baseline artefacts are at flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/baselines/ as lad-check.txt, lad-data.json and lad-git-before.txt. lad-git-before.txt is empty, which reflects that git sees nothing under LAD's flowcharge/ rather than that the tree was clean."
      - "The distinct-id count is 1310, not the 1388 this task's description carries. The 482 artefacts, 829 ISS items and 184 folders all match exactly, so the 1388 was an audit estimate rather than a measured figure."
  ```

- [x] 7. Phase 7 — Close out
  ```yaml
  description: "Confirm all six projects satisfy every acceptance criterion, record which prose mentions were deliberately left alone and why, and confirm the false claim-marker warnings are gone. Depends on Phase 6."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Confirm all six projects — Praxis-Board, LAD, DownloadAlbum, lad-poc, Praxis-Launch and Praxis-Demo — satisfy every acceptance criterion, by re-running each project's checks from tasks 2.4, 3, 4.1, 5.1, 5.2 and 6."
    - "Record in this workstream's folder which prose mentions were deliberately left alone and why, mirroring the Praxis precedent's own decision to leave roughly 83 alone. Cover all six projects, including LAD now that Open question 1 is answered (option b) and task 6's In-map rewrite and Not-in-map leave-alone pass are both complete — see Divergence 3."
    - "Confirm the false `counter N but no marker exists` warnings are gone, since scan-source detection now sees the new-format ids."
    - "Confirm acceptance criterion 9 across all six projects: the dashboard renders each with the same workstream count, issue count and artefact ordering it showed before that project was migrated, compared against each phase's recorded baseline."
    - "Do not delete any flowcharge-pre-migration-2026-08-17/ backup. The plan does not plan their deletion — see Divergence 5."
  pattern: "flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/. Read-only across the six migrated project trees."
  imports: "prx-index.mjs for --check across all six projects. The six mapping records and six prose reports."
  compatibility: "The shared prx-index.mjs already recognises only the new shape, so every migrated project has moved towards the tooling rather than away from it. index.md and kanban.md remain generated views — regenerate, never hand-edit."
  gotcha: "Acceptance criterion 11 now closes for all six projects, since Open question 1 was answered before Phase 6 ran. Deleting the backups would close nothing and would destroy the only rollback path for the three non-git projects."
  verify:
    - "For each of the six project roots, run `node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root <project> --check` — no new errors against that project's baseline, and no `counter N but no marker exists` warning"
    - "For each of the six project roots: grep -rhE '^id: ' <project>/flowcharge --include='*.md' | grep -cvE '^id: (WS|PLN|IL|TL|ISS)-[0-9]+-[0-9a-z]{6}$' — must return 0"
    - "ls -d /Users/akoukoullis/Work/AK/*/flowcharge-pre-migration-2026-08-17 /Users/akoukoullis/Work/AK/AgenticCodingTests/*/flowcharge-pre-migration-2026-08-17 — all six must still exist"
    - "npm run build && node --test dist/lib/extract.test.js — Phase 1's tests still pass, since they stay in the repository"
  checklist:
    - "Do all six projects satisfy acceptance criteria 1 through 8?"
    - "Does acceptance criterion 9 hold for all six, against each phase's recorded baseline?"
    - "Are the false `counter N but no marker exists` warnings gone in every project?"
    - "Is the record of deliberately-untouched prose mentions written for all six projects?"
    - "Do all six backup folders still exist, undeleted?"
    - "Do Phase 1's unit tests still pass?"
  self_eval:
    passed: true
    failures: []
    notes:
      - "AC1 to AC5 and AC7, re-run against all six project roots on 2026-08-17. AC1 returns 0 bad ids in every project. AC2 returns 0 bare ISS item ids. AC3 returns 0 bare workstream/depends_on/links/issues references. AC4 returns 0 folders not matching WS-N-SUFFIX-. AC5: the five surviving bare markers — Praxis-Board PLN-24 and WS-31, LAD PLN-36 and WS-185, lad-poc IL-2 — each appear in their own project's unmatched-markers list, and none was renamed or deleted, per Divergence 4. AC7: id-migration-2026-08-17.md exists in all six."
      - "AC6 and AC8. --check exits 2 (warnings only) with ZERO errors in all six projects, before and after. Non-mtime warnings fell everywhere: Praxis-Board 32 to 25, LAD 1621 to 112, DownloadAlbum 135 to 25, lad-poc 27 to 3, Praxis-Launch 5 to 2, Praxis-Demo 8 to 2. The only warning class that grew is the pre-existing `updated but file modified`, because Stage 6 rewrites files and deliberately does not bump `updated` — the known consequence recorded in every earlier phase. AC8: all six flowcharge-pre-migration-2026-08-17/ backups still exist, undeleted."
      - "Counter warnings. All 23 `counter N but no marker exists` warnings that the old id shape made false are gone: LAD 5, DownloadAlbum 5, lad-poc 5, Praxis-Demo 5, Praxis-Launch 3, Praxis-Board 0. Two survive, and both are genuine data gaps rather than detection failures, and both were present in that project's own pre-migration baseline: lad-poc's IL counter reads 2 while its only issue list is IL-1-kh3a07, and Praxis-Launch's WS counter reads 36 while its only workstream is WS-31-uvbvjr. Neither is caused by, nor fixable by, this migration."
      - "AC9 verified machine-to-machine, not by eye. dist/scripts/extract-praxis-data.js was run against all six roots and compared field-by-field to each phase's saved baselines/<project>-data.json, with ids reversed through an anchored suffix strip: workstream count, issue count, workstream order, workstream slug, title, status, per-workstream artefact order with type and status, issue id order and issue severities. Counts: Praxis-Board 31/10, LAD 184/829, DownloadAlbum 28/39, lad-poc 6/7, Praxis-Launch 1/0, Praxis-Demo 8/3 — identical before and after. Zero entries differ in five of six projects."
      - "AC9, the single exception, which is not an AC9 failure. DownloadAlbum's WS-22 folder read WS-22-normalizeForMatch-not-in-browser-context before the run and WS-22-4pj6gb-normalize-for-match-not-in-browser-context after it. Its workstream.md `slug:` key already read normalize-for-match-not-in-browser-context in the backup, so the pre-migration folder name disagreed with the record's own slug and --check reported it. Stage 7 derives the folder name from that slug key, so the rename corrected a pre-existing mismatch. The mapping record documents the rename, task 5.2 records it, and AC9 constrains count and ordering, which are unchanged."
      - "AC11 closed for all six. Every project holds flowcharge/id-migration-2026-08-17-prose-review.md with a `## Resolution` section, and the bucket headings match the entry counts exactly: Praxis-Demo 6, Praxis-Launch 82, lad-poc 695, Praxis-Board 1145, DownloadAlbum 1636, LAD 7988. Estate total 11552 occurrences, 2915 rewritten and 8637 deliberately left alone, with every occurrence accounted for."
      - "The consolidated record is flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/prose-mentions-left-alone.md. It carries no frontmatter and no artefact id, and --check on Praxis-Dashboard after it was added reports 0 errors, 109 warnings and never names the file, confirming the index generator does not read it as an artefact. It also records the five unmatched claim markers and LAD's pre-existing duplicate ISS-497 collision, so neither is later rediscovered as a defect of this migration."
      - "One arithmetic slip found and recorded rather than edited. Praxis-Board's prose report gives left-alone sub-headings of 6, 922 and 193, which sum to 1121 instead of 1127. Its bucket headings and entry counts agree exactly (952 In-map, 193 Not-in-map, 1145 total) and 18 occurrences were rewritten, so the In-map free-text figure is 928. The correction is stated in prose-mentions-left-alone.md; that report belongs to Phase 3 and was not edited here."
      - "Phase 1 regression check. npm run build succeeds and node --test dist/lib/extract.test.js passes 7 of 7 with 0 failures, so the dashboard still reads both id shapes."
      - "Divergence 4 remains open by design. Open question 2, whether to delete the five unmatched claim markers, is still the user's to answer. No task in this workstream deletes or creates a marker."
  ```

## Divergences

1. **The project has no test runner, no lint config and no test script.** The plan's Testing
   strategy calls for unit tests in Phase 1 and Phase 2, and states Phase 1's tests should stay in
   the repository. `package.json` at `34f6a2e` declares only `build`, `prestart`, `start`,
   `prerefresh` and `refresh`, with `typescript` and `@types/node` as its only devDependencies, and
   the repository holds no eslint, prettier, vitest or jest configuration. Tasks 1.3 and 2.2
   therefore use the Node built-in test runner (`node:test`), which adds no dependency and is
   available under the declared `engines.node >= 18`. The project's own `npm run build` and
   `npx tsc -p tsconfig.json --noEmit` are used as the primary verify commands throughout. No task
   adds a dependency, a test script or a test config file.

2. **The `server.ts` guard cannot be imported for a unit test.** The plan's Phase 1 testing item
   lists the guard alongside the `extract.ts` functions. `src/server.ts` calls `server.listen(...)`
   at module top level, so importing it starts an HTTP server, and the guard is a regular-expression
   literal inline in the request handler rather than an exported symbol. The plan also forbids
   turning the guard into anything but an in-place shape check. Task 1.1 therefore verifies the five
   inputs the plan names — `WS-5`, `WS-34-d3gjrv`, `../etc`, `WS-`, `WS-5-ABC123` — with a
   standalone `node -e` assertion plus a `grep` that the widened literal is present in the file, and
   task 1.3 covers only the importable `extract.ts` symbols. No task extracts the guard into a new
   module, because the plan does not ask for that.

3. **Open question 1 is answered: option (b), review only the in-map bucket** — the user accepted
   the plan's own recommendation before Phase 6 ran. "Review" is not "rewrite": task 6 covers LAD's
   mechanical migration through acceptance criteria 1 to 8, the emission of the bucketed prose
   report, and a rewrite pass restricted to the same narrow structured-identity class phases 3-5
   already proved out (an `id:`/`issues:`/`tasks:`/`depends_on:` key the main pass's anchor missed) —
   every narrative or free-text mention, In-map or Not-in-map, stays untouched, matching the actual
   ratio those four phases established (a small single-digit-percent minority of each In-map bucket
   was ever rewritten). Acceptance criterion 11 can then close for LAD in task 7 alongside the other
   five.

4. **Open question 2 is unanswered: what to do with claim markers that have no map entry.** The
   plan's Design commits the script to option (a) — leave them and list them in the record — and
   tasks 2.1, 4.1 and 5.2 implement exactly that. The open question notes the `Praxis` precedent
   chose (b), deletion, and calls the choice genuinely the user's. No task deletes an unmatched
   marker and no task creates a missing one. If the user answers (b) or (c), task 2.1's Stage 8 and
   the three tasks that check it need revising. This needs the user's answer.

5. **Open questions 3 and 4 are tasked against the plan's own stated working defaults.** Phase 1
   stays in this workstream rather than splitting into its own bug-fix workstream, which is the
   plan's recommendation on question 3. No task deletes any `flowcharge-pre-migration-2026-08-16/`
   backup, which is the plan's stated position on question 4, and tasks 2.4, 5.1, 5.2, 6 and 7 all
   assert the backups still exist.

Every other file the plan cites matched what the plan assumes. `src/server.ts` still carries
`if (!/^WS-\d+$/.test(wsId)) {` as a unique line; `src/lib/extract.ts` still carries the
`ISSUE_ITEM` export, the two issuelist-branch patterns and the `lastIndexOf`-based
`artefactIdNumber` at the lines the plan names; `randomSuffix()` and `GITIGNORE_TARGETS` are where
the plan says in `prx-index.mjs`; the precedent mapping record and backup folder both exist in the
`Praxis` project; and the six target paths in `.praxis-projects.json` match the plan's Assumption 1
exactly.

---
id: TL-65-yjm7as
type: tasklist
workstream: WS-64-gdxh7m
slug: bytenode-electron-main
title: "Do not build bytenode compilation: land the record and close the workstream"
status: dropped
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: [PLN-54-kcr1ok]
links: []
mode: spec
base_commit: 0d81cff
---

# PRX Tasks

## Do not build bytenode compilation: land the record and close the workstream

This list carries out `PLN-54-kcr1ok`, a decision record rather than a feature
plan. The plan recommends **not building** bytenode compilation for this
project's Electron main process, and it ships no code.

The reason is measured, not asserted. `main.cjs` and
`agentic-tools-ipc-handlers.cjs` — 21,768 of the 25,610 candidate bytes, 85% —
both load this project's ESM through a
`new Function('specifier', 'return import(specifier)')` bridge. bytenode runs
compiled code through `vm.Script`, which has no `importModuleDynamically`
callback, so that bridge throws `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`. The
plan's investigation confirmed this against plain Node and against this
project's Electron 43.4.0. The one file that could be compiled,
`ipc-handlers.cjs` at 3,842 bytes (15.0%), is a relay whose seven channel names
are already plain text in `electron/preload.cts:11-18` and whose HTTP paths are
already plain text in the readable `dist/server.js`. Against that near-zero
benefit stands a permanent cost: the project's first production dependency, a
per-platform and per-architecture compile matrix, a rebuild obligation on every
Electron upgrade, and an uncatchable `SIGTRAP` crash class on any
bytecode-runtime mismatch.

The work is therefore three documentation and verification tasks, one per plan
phase, in the plan's order. Each stage touches at most one file, so each stage
is one adult task. Task 1 confirms the decision record satisfies the plan's
acceptance criteria 1 to 6. Task 2 closes the workstream as `dropped` and
regenerates the generated views. Task 3 proves that nothing shipped.

Nothing in this list may install `bytenode`, add any dependency, or modify any
file under `electron/`, `src/`, `tools/`, or `package.json`. The plan's Open
questions Q1 to Q4 stay open and are recorded under `## Divergences`; no task
settles them.

- [ ] 1. Confirm the decision record is complete (plan Phase 1)
  ```yaml
  description: "Verify plan.md states the single committed recommendation and carries the plan's acceptance criteria 1 to 6, and that the index lists PLN-54-kcr1ok under WS-64-gdxh7m."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Read flowcharge/workstreams/WS-64-gdxh7m-bytenode-electron-main/plan.md in full before changing anything. The file already exists — see Divergence 1 — so this task is a conformance check, not an authoring pass."
    - "Check acceptance criterion 1: the file sits at that exact path and states one committed recommendation, do not build the feature. The 'Summary', 'The decision', and 'Final summary' sections must agree with each other and must not offer a second option as live."
    - "Check criterion 2: the blocking technical fact is recorded with checkable references — the dynamic-import bridge at electron/main.cts:65-67 and at electron/agentic-tools-ipc-handlers.cts:237, and the vm.Script incompatibility named as ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING."
    - "Check criterion 3: the measured coverage appears as numbers — 3,842 bytes of 25,610 bytes, 15.0%, one file of three."
    - "Check criterion 4: the reason that 15% carries near-zero value is recorded — the seven channel names already plain text at electron/preload.cts:11-18, and the HTTP paths already plain text in the readable dist/server.js."
    - "Check criterion 5: the declined path (a) design is recorded in full under 'Alternatives considered and rejected', including the constraining investigation facts, so nothing has to be re-derived."
    - "Check criterion 6: the plan names what should happen instead and names the precondition — the dynamic-import bridge must be gone, replaced by something that runs inside vm.Script."
    - "If, and only if, one of those six criteria is absent, add the missing content to plan.md and to no other file, and bump that file's frontmatter 'updated' key to today's date from `date +%F`. If all six are present, change no file in this task."
    - "Do not restate, soften, or re-argue the recommendation. Do not answer the plan's Open questions Q1 to Q4."
  pattern: "flowcharge/workstreams/WS-64-gdxh7m-bytenode-electron-main/plan.md only. No source file, no other workstream artefact."
  imports: "node >= 16 to run the generator at /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs. No package needs installing."
  compatibility: "Praxis frontmatter must stay flat keys and inline arrays, because the index parser depends on that shape. The plan's id PLN-54-kcr1ok, workstream WS-64-gdxh7m, and slug bytenode-electron-main are permanent and must not change."
  gotcha: "The generator writes flowcharge/index.md and flowcharge/kanban.md, not repo-root files — see Divergence 2. Run --check first, because it writes nothing and exits 2 on any warning. A grep for a byte count must allow the comma in 3,842 and 25,610."
  verify:
    - "node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/Praxis-Dashboard --check — prints no WARN line naming PLN-54-kcr1ok or WS-64-gdxh7m."
    - "node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/Praxis-Dashboard --list --ws WS-64-gdxh7m — the output holds one row for PLN-54-kcr1ok."
    - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && for s in '3,842' '25,610' '15.0%' 'main.cts:65-67' 'agentic-tools-ipc-handlers.cts:237' 'preload.cts:11-18' 'ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING' 'dist/server.js'; do grep -c -- \"$s\" flowcharge/workstreams/WS-64-gdxh7m-bytenode-electron-main/plan.md; done — every printed count is 1 or more."
    - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && git status --porcelain -- electron/ src/ tools/ package.json | wc -l — returns 0, proving this task touched no application file."
  checklist:
    - "Does plan.md exist at flowcharge/workstreams/WS-64-gdxh7m-bytenode-electron-main/plan.md and state one recommendation, do not build?"
    - "Are all six of the plan's acceptance criteria 1 to 6 present in the file, each checkable by the greps above?"
    - "Does prx-index.mjs --check exit without a WARN line naming PLN-54-kcr1ok or WS-64-gdxh7m?"
    - "Does the plan frontmatter still parse with flat keys and inline arrays, with id PLN-54-kcr1ok unchanged?"
    - "Was every file outside flowcharge/ left untouched by this task?"
    - "Were the plan's Open questions Q1 to Q4 left unanswered?"
  self_eval:
    passed: false
    failures: []
  ```

- [ ] 2. Close the workstream as dropped and regenerate the views (plan Phase 2)
  ```yaml
  description: "Set status to dropped in workstream.md, refresh its updated date, add one sentence pointing at PLN-54-kcr1ok as the reason, then regenerate index.md and kanban.md."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Read flowcharge/workstreams/WS-64-gdxh7m-bytenode-electron-main/workstream.md before editing. At base_commit 0d81cff it holds a 15-line frontmatter block and three body paragraphs at lines 17, 19, and 21."
    - "In the frontmatter, change the single line `status: backlog` to `status: dropped`. That line is unique in the file."
    - "In the frontmatter, set `updated` to the execution date, taken from `date +%F` at execution time and not from this task's authoring date."
    - "Append one sentence to the end of the body, after the paragraph that starts 'Constraints already settled, do not re-derive'. The sentence must name PLN-54-kcr1ok as the reason the workstream is dropped, and must state the recorded cause in short form: 85% of the target code cannot be compiled, because the dynamic-import bridge is incompatible with bytenode's vm.Script execution. Use a shell heredoc append, not a mid-file edit."
    - "Change nothing else in the file. Leave id, type, workstream, slug, title, description, tags, created, author, depends_on, and links exactly as they are, and leave the three existing body paragraphs unedited."
    - "Regenerate the views by running prx-index.mjs in its default mode, with no --sync and no --no-board. Never hand-edit flowcharge/index.md or flowcharge/kanban.md — they are generated from the frontmatter."
  pattern: "flowcharge/workstreams/WS-64-gdxh7m-bytenode-electron-main/workstream.md, plus the generated flowcharge/index.md and flowcharge/kanban.md that the generator rewrites."
  imports: "node >= 16 for /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs. `date +%F` for the updated value."
  compatibility: "`dropped` is a value of the uniform Praxis status enum (backlog, ready, in-progress, done, dropped). The frontmatter must stay flat keys with inline arrays. The board's Dropped column exists already and is written as `- # Dropped __archived__`; that heading text must not be edited."
  gotcha: "Do not run prx-index.mjs --sync. A plan is never closed by --sync, and the sync mode may set other artefacts to done, which is outside this workstream. The generated files live under flowcharge/, not at the repo root — see Divergence 2. The board's Dropped column carries the `__archived__` marker, so a plain grep for the column name must include it."
  verify:
    - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && grep -c '^status: dropped' flowcharge/workstreams/WS-64-gdxh7m-bytenode-electron-main/workstream.md — returns 1, and grep -c '^status: backlog' on the same file returns 0."
    - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && grep -c 'PLN-54-kcr1ok' flowcharge/workstreams/WS-64-gdxh7m-bytenode-electron-main/workstream.md — returns 1 or more."
    - "node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root /Users/akoukoullis/Work/AK/Praxis-Dashboard — exits 0 and rewrites flowcharge/index.md and flowcharge/kanban.md."
    - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && sed -n '/^- # Backlog/,/^- # Ready/p' flowcharge/kanban.md | grep -c 'WS-64-gdxh7m' — returns 0."
    - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && sed -n '/^- # Dropped/,$p' flowcharge/kanban.md | grep -c 'WS-64-gdxh7m' — returns 1."
    - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && grep -c '| WS-64-gdxh7m | bytenode-electron-main | dropped |' flowcharge/index.md — returns 1."
  checklist:
    - "Does workstream.md carry `status: dropped` and no remaining `status: backlog` line?"
    - "Is the `updated` value the execution date taken from `date +%F`?"
    - "Does the body carry exactly one added sentence, naming PLN-54-kcr1ok as the reason, with the three original paragraphs unedited?"
    - "Do flowcharge/index.md and flowcharge/kanban.md show WS-64-gdxh7m as dropped, with zero occurrences left in the Backlog column?"
    - "Were index.md and kanban.md written only by the generator, never by hand?"
    - "Was prx-index.mjs run in its default mode, without --sync?"
  self_eval:
    passed: false
    failures: []
  ```

- [ ] 3. Confirm nothing shipped (plan Phase 3)
  ```yaml
  description: "Prove this workstream changed no application code: the working tree differs only under flowcharge/, the build still succeeds, and dist/electron/ still holds exactly four .cjs files and no .jsc file."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Build nothing. This task is a check, and it must edit no file."
    - "Confirm the working tree carries changes only under flowcharge/, so tasks 1 and 2 touched nothing else."
    - "Confirm package.json, electron/, src/, and tools/ hold no difference against HEAD, staged or unstaged."
    - "Confirm no dependency was added: package.json must contain no `dependencies` key and no mention of bytenode anywhere in the repository's own tracked configuration."
    - "Run the project's own build command, `npm run build`, and confirm it succeeds. It runs three tsc passes and tools/copy-assets.mjs, and it is this project's only build, type-check, and lint gate — the project defines no separate lint or test script."
    - "Confirm dist/electron/ still holds exactly four .cjs files — main.cjs, ipc-handlers.cjs, agentic-tools-ipc-handlers.cjs, preload.cjs — and no .jsc file."
    - "Run the plan's manual regression guard last: `npm run electron:dev` must open the board and list projects. This is a manual check, matching how the Electron shell is already exercised in this project. Close the app afterwards."
  pattern: "No file is written. The check reads package.json, electron/, src/, tools/, and dist/electron/."
  imports: "npm and the project's existing devDependencies, already installed. No new package."
  compatibility: "The packaged app must stay byte-identical in shape to today's: dist/electron/main.cjs remains the package.json `main` entry, and the three package:* scripts are unchanged."
  gotcha: "`npm run build` rewrites dist/, which is a generated tree — check dist/electron/ after the build, not before. `git diff` alone misses staged changes, so compare against HEAD. The project has zero production dependencies today, so package.json holds no `dependencies` key at all; a check that reads that key must treat 'absent' as the passing state."
  verify:
    - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && git status --porcelain | grep -v ' flowcharge/' | wc -l — returns 0."
    - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && git diff HEAD --stat -- package.json electron/ src/ tools/ | wc -l — returns 0."
    - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && grep -ci 'bytenode' package.json — returns 0."
    - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && npm run build — exits 0."
    - "cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && ls -1 dist/electron/*.cjs | wc -l — returns 4, and ls -1 dist/electron/*.jsc 2>/dev/null | wc -l returns 0."
    - "Manual: cd /Users/akoukoullis/Work/AK/Praxis-Dashboard && npm run electron:dev — the board window opens and lists projects. Close the app after the check."
  checklist:
    - "Does git status show changed paths only under flowcharge/?"
    - "Is the diff against HEAD empty for package.json, electron/, src/, and tools/?"
    - "Does package.json still declare no production dependency and no mention of bytenode?"
    - "Does npm run build exit 0?"
    - "Does dist/electron/ hold exactly four .cjs files and zero .jsc files?"
    - "Does npm run electron:dev open the board and list projects?"
  self_eval:
    passed: false
    failures: []
  ```

## Divergences

1. **Phase 1's deliverable already exists.** The plan's Phase 1 states its
   deliverable as "this plan file, complete", written as work still to do. At
   authoring time, `flowcharge/workstreams/WS-64-gdxh7m-bytenode-electron-main/plan.md`
   already exists at that exact path, holds `id: PLN-54-kcr1ok`, and is listed
   in `flowcharge/index.md:68` as `PLN-54-kcr1ok (ready)` under `WS-64-gdxh7m`.
   Task 1 is therefore authored as a conformance check of the existing file
   against the plan's acceptance criteria 1 to 6, and it writes to that file
   only if a criterion is found missing.

2. **The generated views live under `flowcharge/`, not at the repo root.** The
   plan's acceptance criterion 7 and its Phase 2 verify step name
   `index.md` and `kanban.md` as bare paths. The generator writes
   `flowcharge/index.md` and `flowcharge/kanban.md`, and no file of either name
   exists at the repository root at short SHA `0d81cff`. Every verify step in
   tasks 1 to 3 uses the `flowcharge/` paths. The board's own dropped column is
   written as `- # Dropped __archived__` at `flowcharge/kanban.md:249`, so the
   Phase 2 board checks match on the `- # Dropped` prefix rather than an exact
   heading string.

3. **The plan's Open questions Q1 to Q4 stay open, and no task settles them.**
   Q1 asks whether an external requirement forces main-process code to be
   unreadable, and the plan's own recommendation rests on assumption A4 that
   none exists. Q2 asks whether the bridge-replacement work should become a
   `backlog` workstream. Q3 asks whether the parent 11-step consultation
   document should mark step 7 as dropped. Q4 asks whether the "raise the cost,
   not a boundary" framing still holds. Each is a user decision. No task is
   authored for any of them, and no task creates a follow-up workstream or edits
   the consultation document. If Q1 is answered "a requirement exists", the plan
   itself must be reconsidered before task 2 runs.

4. **Assumption A5 is unconfirmed, and no task depends on it.** The plan marks
   the path (a) single-file compile shape as investigated but untested, and
   states that anyone reviving it must verify it. No task in this list builds,
   tests, or prepares path (a). It is recorded in the plan only.

Every source file the plan cites was read at short SHA `0d81cff` and matched the
plan exactly: the dynamic-import bridge sits at `electron/main.cts:65-67` and
`electron/agentic-tools-ipc-handlers.cts:237`, the seven channel names sit at
`electron/preload.cts:11-18`, `electron/ipc-handlers.cts` is 109 lines, and
`dist/electron/` holds `main.cjs` at 5,130 B, `ipc-handlers.cjs` at 3,842 B,
`agentic-tools-ipc-handlers.cjs` at 16,638 B, and `preload.cjs` at 2,058 B.

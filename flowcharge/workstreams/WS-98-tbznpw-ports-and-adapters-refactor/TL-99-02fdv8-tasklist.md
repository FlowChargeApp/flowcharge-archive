---
id: TL-99-02fdv8
type: tasklist
workstream: WS-98-tbznpw
slug: ports-and-adapters-refactor
title: "Ports and adapters refactor with test folder restructure"
status: ready
created: 2026-09-09
updated: 2026-09-09
author: Anthony Koukoullis
depends_on: [PLN-85-7knnfj]
links: []
mode: spec
base_commit: 279fb26
---

# FlowCharge Tasks

## Ports and adapters refactor with test folder restructure

Restructure `praxis-dashboard` (product FlowCharge) into a ports-and-adapters architecture
across four boundaries: the `flowcharge/` markdown store, the project registry
`.praxis-projects.json`, the HTTP layer `src/server.ts`, and the CLI entry point
`tools/package-cli.mjs` / `dist/cli-entry.js`. The approach is **interfaces first, adapters
in place**: ports become TypeScript interfaces under a new `src/ports/`, orchestration moves
behind those ports into a new `src/core/`, HTTP transport moves into a new `src/http/`, and
the driven-adapter implementations stay at their current `src/lib/` paths. That last
constraint is load-bearing: `electron/agentic-tools-ipc-handlers.cts:335-359` resolves eight
`src/lib` modules through untyped dynamic-import strings, `electron/main.cts:78` resolves
`'../server.js'` the same way, and neither `tsc` nor the WS-97-7fvoc0 boundary suite covers
that path.

The same workstream folds in the test-folder restructure into `src/test/boundary/` and
`src/test/unit/`. It runs first, as Stage 1, so every later stage is written and verified
once, in the final layout.

No user-visible behavior changes. Every route, status code, payload shape, log line and
on-disk file format is preserved byte for byte. No stage adds a new test case — WS-99-qxgzip
owns the domain-unit suite. No stage may edit an assertion in a WS-97-7fvoc0 file; a stage
that appears to need one has stopped being internal and must stop and report.

**Baseline captured at `279fb26`**, on this host, after `npm run build`:

| Command | Result at `279fb26` |
|---|---|
| `npm test` | `tests 281`, `pass 280`, `fail 1`, `skipped 0`, exit code `1` — see Divergence 1 |
| `node --test --test-force-exit dist/server-projects.test.js dist/server-board.test.js dist/server-guards.test.js` | `tests 42`, `pass 42`, `fail 0` |
| `node --test --test-force-exit dist/lib/extract.test.js dist/lib/detail.test.js dist/lib/projects.test.js dist/lib/tree-layout.test.js dist/lib/update-prefs.test.js` | `tests 44`, `pass 44`, `fail 0` |
| `node --test --test-force-exit dist/server.test.js` | `tests 10`, `pass 10`, `fail 0` |
| `node --test dist/cli-binary.test.js` | `tests 7`, `pass 7`, `fail 0` — see Divergence 2 |

Every `verify` step below that asserts a count, a file's existence, or the presence of a
string was run at `279fb26` while authoring, and records the value it actually returned there.

- [x] 1. Stage 1 — test folder relocation

  ```yaml
  description: "Move the five WS-97-7fvoc0 boundary files into src/test/boundary/, the twenty remaining test files into src/test/unit/, and fixture-project.ts into src/test/; re-base the four __dirname-derived path constants, tsconfig.json's include, and the five stale DEVELOPMENT.md statements."
  ```

  - [x] 1.1 Capture the `279fb26` test case-name baseline

    ```yaml
    description: "Run npm test at base_commit 279fb26, extract the full list of test case names, and write it to flowcharge/workstreams/WS-98-tbznpw-ports-and-adapters-refactor/baseline-279fb26-test-names.txt, so every stage gate in this file can diff against it after the test files have moved."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Do this first, before any other task in this stage. Once task 1.3 runs, the 279fb26 case-name list is no longer reachable without checking out and rebuilding that commit, and the plan's name-diff gate becomes unusable."
      - "Confirm the tree is at the base commit with `git rev-parse --short HEAD`; it must print 279fb26. Then run `npm run build`."
      - "Run `npm test 2>&1 | grep -E '^..(✔|✖)' | sed -E 's/ \\([0-9.]+m?s\\)$//; s/^..(✔|✖) //' | sort > flowcharge/workstreams/WS-98-tbznpw-ports-and-adapters-refactor/baseline-279fb26-test-names.txt`. The grep is the same extraction task 1.11 already uses; the two sed steps drop the per-run duration and the tick or cross marker, so the file holds one bare case name per line and a later run compares on names alone."
      - "Write the file at that path and nowhere under src/. No task in this workstream moves or rewrites anything under flowcharge/workstreams/, so the file stays reachable at every later stage gate."
      - "Commit the file with the rest of Stage 1, so an executor on a fresh clone has the baseline as well."
      - "Do not regenerate or edit this file later in the workstream. It is the fixed 279fb26 reference that tasks 1.11, 2.4, 3.5, 4.4, 5.8, 6.3 and 7.4 each diff against."
    pattern: "flowcharge/workstreams/WS-98-tbznpw-ports-and-adapters-refactor/baseline-279fb26-test-names.txt, new file. No source file changes in this task."
    imports: "None."
    compatibility: "PLN-85-7knnfj Testing strategy, 'Stage 1', and acceptance criterion 1 — the same test names and the same pass count at the end of every stage."
    gotcha: "npm test exits 1 at 279fb26 because one network-dependent case fails — see Divergence 1. Capture the names anyway: the failing case name belongs in the baseline, and the pipeline takes grep's exit code rather than npm test's."
    verify:
      - "Run `wc -l < flowcharge/workstreams/WS-98-tbznpw-ports-and-adapters-refactor/baseline-279fb26-test-names.txt`. It must return a non-zero count, and that count must equal the `tests` number of the same run, which is 281 at 279fb26. If the two disagree, the extraction misses cases and must be widened before this stage continues."
      - "Run `grep -cE '^..(✔|✖)' flowcharge/workstreams/WS-98-tbznpw-ports-and-adapters-refactor/baseline-279fb26-test-names.txt`. It must return 0 — the markers are stripped and the file holds bare case names."
      - "Run `grep -c 'getInstallContent installs the newest live release' flowcharge/workstreams/WS-98-tbznpw-ports-and-adapters-refactor/baseline-279fb26-test-names.txt`. It must return 1 — the case that fails at 279fb26 for lack of network reach is part of the baseline, per Divergence 1."
    checklist:
      - "Was the capture taken at 279fb26, before any file in this stage moved?"
      - "Does the file sit outside src/, at a path no later task in this workstream touches?"
      - "Does it hold one bare case name per line, with no duration and no tick or cross marker?"
      - "Does its line count match the `tests` count of the same npm test run?"
    self_eval:
      passed: true
      failures:
        - item: "Does its line count match the `tests` count of the same npm test run?"
          reason: "The extraction pipeline this task specifies, `grep -E '^..(✔|✖)'`, matched no line on this host: node's spec reporter prints the tick or cross at column 0, with no two leading characters. Dropping the `..` and matching the marker anywhere returned 283 lines, not the 281 the run reports, because the trailing `✖ failing tests:` header and its repeated failure line were counted too."
          fix: "Narrowed the extraction to `sed '/^✖ failing tests:/,$d' | grep -E '^(✔|✖)' | sed -E 's/ \\([0-9.]+m?s\\)$//; s/^(✔|✖) //' | sort`. It drops the summary block, strips the marker and the duration, and returns exactly 281 bare case names, matching the run's `tests 281`. Re-checked: all four checklist items pass."
    ```

  - [x] 1.2 Widen `tsconfig.json`'s `include` to the final folder shape

    ```yaml
    description: "Replace the seven explicitly named files in tsconfig.json's include — six *.test.ts files plus server-harness.ts — with the folder globs the finished layout needs, so every later move in this stage compiles without another tsconfig edit."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open tsconfig.json and locate the `include` array. At 279fb26 it names src/server.ts plus seven individual files under src/, then src/lib/**/*.ts, src/scripts/**/*.ts and src/types/**/*.d.ts."
      - "Replace the whole array with the plan's final form: [\"src/server.ts\", \"src/cli-bootstrap.ts\", \"src/core/**/*.ts\", \"src/http/**/*.ts\", \"src/lib/**/*.ts\", \"src/ports/**/*.ts\", \"src/scripts/**/*.ts\", \"src/test/**/*.ts\", \"src/types/**/*.d.ts\"]."
      - "Leave compilerOptions untouched. rootDir stays \"src\" and outDir stays \"dist\", so the compiled output becomes dist/test/boundary/*.js and dist/test/unit/*.js, which package.json's existing dist/**/*.test.js glob already matches."
      - "Do this before any file move. tsc 5.9 does not error on an include entry that matches nothing, so naming src/cli-bootstrap.ts, src/core/, src/http/ and src/ports/ ahead of their existence is safe — this was probed against the repo's own typescript build before the task was written."
    pattern: "tsconfig.json only. No source file changes in this task."
    imports: "None."
    compatibility: "PLN-85-7knnfj, 'The test folder layout'. package.json's test glob dist/**/*.test.js is unchanged and must stay unchanged."
    gotcha: "Do not widen rootDir. Alternative 3 in the plan rejects a root-level test/ folder precisely because rootDir would have to move, which reshapes all of dist/ and breaks tools/copy-assets.mjs, tools/package-cli.mjs and package.json's main."
    verify:
      - "Run `grep -o 'test\\.ts' tsconfig.json | wc -l`. At 279fb26 it returns 6 (the six named *.test.ts entries). After this task it must return 0."
      - "Run `grep -c 'src/test/\\*\\*/\\*.ts' tsconfig.json`. At 279fb26 it returns 0. After this task it must return 1."
      - "Run `npm run build`. It must exit 0, exactly as it does at 279fb26."
    checklist:
      - "Does the include array contain all nine entries the plan lists, in that order?"
      - "Is `rootDir` still \"src\" and `outDir` still \"dist\"?"
      - "Is package.json's `test` script byte-for-byte unchanged?"
      - "Does `npm run build` still exit 0 with no TS6053 or TS18003 diagnostic?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Move `fixture-project.ts` to `src/test/` and re-point its importers

    ```yaml
    description: "git mv src/lib/fixture-project.ts to src/test/fixture-project.ts and fix the specifier in the four files that import it, per assumption A5."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/test/ and run `git mv src/lib/fixture-project.ts src/test/fixture-project.ts`. Use git mv, not a copy-and-delete, so the file's history follows it."
      - "Four files import it at 279fb26, found with `grep -rln fixture-project src/`: src/server-board.test.ts, src/server-harness.ts, src/lib/detail.test.ts and src/lib/extract.test.ts. Re-point each import specifier to the new location as it stands at the moment of the edit — those four files have not moved yet in this stage, so from src/ the specifier becomes './test/fixture-project.js' and from src/lib/ it becomes '../test/fixture-project.js'."
      - "Change nothing inside fixture-project.ts. It derives no path from its own location — confirm that by reading it before the move, and if it does, re-base the constant here and say so in self_eval."
      - "Its header states the same no-`.test.`-in-the-filename rule src/server-harness.ts follows; leave that comment intact."
    pattern: "src/lib/fixture-project.ts -> src/test/fixture-project.ts, plus the import line in src/server-board.test.ts, src/server-harness.ts, src/lib/detail.test.ts, src/lib/extract.test.ts."
    imports: "None added."
    compatibility: "PLN-85-7knnfj assumption A5 — the helper sits at the shared parent of boundary/ and unit/, not inside either."
    gotcha: "Tasks 1.4 and 1.6 move three of those four importers again. The specifiers written here are correct only for this intermediate state and are rewritten in those tasks; do not try to write the final specifier early."
    verify:
      - "Run `ls src/lib/fixture-project.ts`. At 279fb26 it lists the file; after this task it must fail with 'No such file or directory'."
      - "Run `ls src/test/fixture-project.ts`. At 279fb26 it fails; after this task it must list the file."
      - "Run `npm run build`. It must exit 0."
      - "Run `node --test --test-force-exit dist/lib/extract.test.js dist/lib/detail.test.js dist/lib/projects.test.js dist/lib/tree-layout.test.js dist/lib/update-prefs.test.js`. It must report `tests 44`, `pass 44`, `fail 0`, matching 279fb26."
    checklist:
      - "Was the move made with `git mv`, so `git status` shows a rename rather than an add plus a delete?"
      - "Do all four importers resolve, with `npm run build` exiting 0?"
      - "Is the body of fixture-project.ts unchanged apart from nothing at all?"
      - "Does `grep -rn 'lib/fixture-project' src/` return no match?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.4 Move the five WS-97-7fvoc0 files into `src/test/boundary/`

    ```yaml
    description: "git mv server-harness.ts, server-projects.test.ts, server-board.test.ts, server-guards.test.ts and cli-binary.test.ts from src/ into src/test/boundary/, and re-point their relative import specifiers only."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/test/boundary/ and `git mv` these five files into it from src/: server-harness.ts, server-projects.test.ts, server-board.test.ts, server-guards.test.ts, cli-binary.test.ts."
      - "Re-point relative import specifiers only. './server-harness.js' stays './server-harness.js' because all five sit in the same folder; the fixture import written in task 1.3 becomes '../fixture-project.js'."
      - "Do not touch a single assertion. The plan's testing strategy forbids it: import specifiers and __dirname-derived path constants are the only permitted edits, and the path constants are handled separately in task 1.5."
      - "These files carry header comments naming their own run command, for example 'node --test --test-force-exit dist/server-board.test.js'. Update those comment strings to the new dist/test/boundary/ path so the documented command still works. A comment is not an assertion."
    pattern: "src/server-harness.ts, src/server-projects.test.ts, src/server-board.test.ts, src/server-guards.test.ts, src/cli-binary.test.ts -> src/test/boundary/."
    imports: "None added."
    compatibility: "PLN-85-7knnfj acceptance criterion 3 — the five files keep every assertion unchanged."
    gotcha: "server-harness.ts carries no `.test.` segment on purpose, so importing it does not register a second copy of the importer's cases. Keep the name exactly as it is. cli-binary.test.ts also needs its REPO_ROOT re-based, which is task 1.5, not this one — this task may leave that file temporarily wrong."
    verify:
      - "Run `ls src/test/boundary/ | wc -l`. At 279fb26 the directory does not exist; after this task it must return 5."
      - "Run `git diff --stat 279fb26 -- src/test/boundary/`. Confirm the only changed lines inside the moved test bodies are import specifiers and header comments."
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/boundary/server-projects.test.js dist/test/boundary/server-board.test.js dist/test/boundary/server-guards.test.js`. It must report `tests 42`, `pass 42`, `fail 0`, matching the 279fb26 figure for the same three suites at their old paths."
    checklist:
      - "Are all five moves recorded as renames by `git status`?"
      - "Does `git diff 279fb26 -- src/test/boundary/` show zero changes to any `assert.` line?"
      - "Do the three HTTP boundary suites report 42 passing cases, the 279fb26 count?"
      - "Is server-harness.ts still free of a `.test.` segment in its filename?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.5 Re-base `REPO_ROOT` in `src/test/boundary/cli-binary.test.ts`

    ```yaml
    description: "Correct the repository-root derivation in the moved cli-binary suite, which is now three levels up from dist/test/boundary/ rather than one level up from dist/."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/boundary/cli-binary.test.ts, find the HERE / REPO_ROOT pair. At 279fb26 (src/cli-binary.test.ts:40-41) it reads HERE from `new URL('.', import.meta.url).pathname` and then `path.resolve(HERE, '..')`, with the comment 'The compiled file is dist/cli-binary.test.js, so the root is one level up.'"
      - "Change the resolve to three levels up, because the compiled file is now dist/test/boundary/cli-binary.test.js. Update the comment to name that path so the reasoning still matches the code."
      - "Leave the deliberate use of `new URL('.', import.meta.url).pathname` in place — its own comment records that node:url's fileURLToPath was avoided on purpose to keep the import set small."
      - "PACKAGE_VERSION reads package.json from REPO_ROOT, so it is fixed by this change and needs no separate edit."
    pattern: "src/test/boundary/cli-binary.test.ts only."
    imports: "None added."
    compatibility: "PLN-85-7knnfj, 'The test folder layout' table, row one."
    gotcha: "REPO_ROOT also feeds the release/cli/ binary lookup and the spawn of the packaged executable. A wrong depth makes the suite skip or fail on a path that looks unrelated to this edit, so verify by asserting the case count, not just the exit code."
    verify:
      - "Run `npm run build`, then `node --test dist/test/boundary/cli-binary.test.js`. On this Bun-equipped host it must report `tests 7`, `pass 7`, `fail 0` — the figure the suite returned at 279fb26 from dist/cli-binary.test.js. See Divergence 2 for hosts without Bun."
      - "Run `grep -n \"resolve(HERE\" src/test/boundary/cli-binary.test.ts`. The line must resolve three levels up, not one as it did at 279fb26."
    checklist:
      - "Does the comment beside REPO_ROOT name dist/test/boundary/cli-binary.test.js rather than dist/cli-binary.test.js?"
      - "Does the suite report 7 passing cases rather than skipping?"
      - "Was no assertion in the file edited?"
      - "Is PACKAGE_VERSION still read from package.json at REPO_ROOT rather than hardcoded?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.6 Move the twenty remaining test files into `src/test/unit/`

    ```yaml
    description: "git mv the eighteen src/lib/*.test.ts files plus src/server.test.ts and src/server-env-seams.test.ts into src/test/unit/, and re-point their relative import specifiers only."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/test/unit/ and `git mv` all eighteen files matching src/lib/*.test.ts into it. At 279fb26 `ls src/lib/*.test.ts | wc -l` returns 18."
      - "Also `git mv` src/server.test.ts and src/server-env-seams.test.ts into src/test/unit/, per assumption A4."
      - "Re-point every relative import specifier. A src/lib/foo.test.ts importing './foo.js' becomes '../../lib/foo.js'; the fixture import written in task 1.3 becomes '../fixture-project.js'."
      - "Update run-command strings in header comments to the new dist/test/unit/ paths, as in task 1.4. Change no assertion."
      - "Three of these files derive a path from their own location and are re-based in tasks 1.7, 1.8 and 1.9; this task may leave those three temporarily wrong."
    pattern: "src/lib/*.test.ts (18 files), src/server.test.ts, src/server-env-seams.test.ts -> src/test/unit/."
    imports: "None added."
    compatibility: "PLN-85-7knnfj assumption A4 and 'The test folder layout'. The twenty-one production modules left under src/lib/ after task 1.3 do not move — Decision 2 keeps src/lib/ exactly where it is."
    gotcha: "Move only the *.test.ts files out of src/lib/. Moving a production module would break the untyped dynamic-import strings in electron/agentic-tools-ipc-handlers.cts:335-359 with no compiler error and no test failure — the top risk this whole plan is shaped around."
    verify:
      - "Run `ls src/*.test.ts src/lib/*.test.ts 2>/dev/null | wc -l`. At 279fb26 it returns 24. After this task and task 1.4 it must return 0, satisfying acceptance criterion 2."
      - "Run `ls src/test/unit/*.test.ts | wc -l`. At 279fb26 the directory does not exist; after this task it must return 20."
      - "Run `ls src/lib/*.ts | wc -l`. It must return 21 — the production modules only, none removed. At 279fb26 src/lib/ holds 22 production modules and 18 test files; task 1.3 moves fixture-project.ts out, so 21 remain."
      - "Run `npm run build`. It must exit 0."
    checklist:
      - "Is every one of the twenty moves recorded as a rename by `git status`?"
      - "Did every production module under src/lib/ stay put?"
      - "Does `ls src/*.test.ts src/lib/*.test.ts` now find nothing?"
      - "Was no assertion edited in any of the twenty files?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.7 Re-base the two path constants in `src/test/unit/server-env-seams.test.ts`

    ```yaml
    description: "Correct serverJsPath and packageJsonPath, which are now two and three levels up from dist/test/unit/."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/server-env-seams.test.ts, find the __dirname block. At 279fb26 (src/server-env-seams.test.ts:23-25) serverJsPath is path.join(__dirname, 'server.js') and packageJsonPath is path.join(__dirname, '..', 'package.json')."
      - "Change them to '../../server.js' and '../../../package.json' respectively, because the compiled file is now dist/test/unit/server-env-seams.test.js."
      - "PACKAGE_VERSION reads packageJsonPath, so it needs no separate edit."
      - "Change no assertion. This suite spawns the compiled server in a child process and greps a SEAM-RESULT line out of its stdout; the spawn target is serverJsPath, so a wrong depth surfaces as a spawn failure, not as a clear path error."
    pattern: "src/test/unit/server-env-seams.test.ts only."
    imports: "None added."
    compatibility: "PLN-85-7knnfj, 'The test folder layout' table, row two."
    gotcha: "This suite drives the server over a child process rather than testing a pure function, so it is slow and its failures are indirect. Assumption A4 records that a later `git mv` may reclassify it into boundary/; do not reclassify it here."
    verify:
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/unit/server-env-seams.test.js`. It must report `fail 0`."
      - "Run `grep -n \"server.js'\\|package.json'\" src/test/unit/server-env-seams.test.ts`. The two joins must show '../../' and '../../../' segments, not the bare and single-'..' forms they had at 279fb26."
    checklist:
      - "Does serverJsPath resolve to dist/server.js from dist/test/unit/?"
      - "Does packageJsonPath resolve to the repository's own package.json?"
      - "Does the suite report `fail 0`?"
      - "Was no assertion edited?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.8 Re-base `projectsJsPath` in `src/test/unit/projects.test.ts`

    ```yaml
    description: "Correct the compiled-module path this suite imports in a child process, now two levels up and into lib/."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/projects.test.ts, find projectsJsPath. At 279fb26 (src/lib/projects.test.ts:18) it is path.join(__dirname, 'projects.js')."
      - "Change it to '../../lib/projects.js', because the compiled file is now dist/test/unit/projects.test.js and the module it drives stays at dist/lib/projects.js."
      - "Change no assertion. This suite exists to prove that PRAXIS_DATA_DIR is observed by the module's top-level consts, which is why it imports through a child process rather than directly."
    pattern: "src/test/unit/projects.test.ts only."
    imports: "None added."
    compatibility: "PLN-85-7knnfj, 'The test folder layout' table, row three."
    gotcha: "src/lib/projects.ts stays at its path for the whole workstream — Decision 2 and the __dirname/../.. repo-root derivation at src/lib/projects.ts:16 both depend on its depth. This task re-bases only the test's view of it."
    verify:
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/unit/projects.test.js`. It must report `fail 0`."
      - "Run `grep -n projectsJsPath src/test/unit/projects.test.ts`. The join must contain '../../lib/projects.js', not the bare 'projects.js' it had at 279fb26."
    checklist:
      - "Does projectsJsPath resolve to dist/lib/projects.js?"
      - "Does the suite report `fail 0`?"
      - "Did src/lib/projects.ts itself stay untouched by this task?"
      - "Was no assertion edited?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.9 Re-base `prefsJsPath` and `repoRoot` in `src/test/unit/update-prefs.test.ts`

    ```yaml
    description: "Correct both location-derived constants in the moved update-prefs suite."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/update-prefs.test.ts, find prefsJsPath. At 279fb26 (src/lib/update-prefs.test.ts:20) it is path.join(__dirname, 'update-prefs.js'); change it to '../../lib/update-prefs.js'."
      - "Find the local repoRoot inside the PRAXIS_DATA_DIR redirection case. At 279fb26 (src/lib/update-prefs.test.ts:122) it is path.join(__dirname, '..', '..'); change it to three levels up, because the compiled file is now dist/test/unit/update-prefs.test.js."
      - "Change no assertion. That case asserts .praxis-update.json is created inside PRAXIS_DATA_DIR and not at the real repo root, so a wrong repoRoot makes it assert against the wrong directory and pass or fail for the wrong reason."
    pattern: "src/test/unit/update-prefs.test.ts only."
    imports: "None added."
    compatibility: "PLN-85-7knnfj, 'The test folder layout' table, row four."
    gotcha: "Both constants must move together. Fixing only prefsJsPath leaves a green suite that no longer proves anything about the repo root, which is the exact failure this task is here to prevent."
    verify:
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/unit/update-prefs.test.js`. It must report `fail 0`."
      - "Run `grep -cn \"'\\.\\.', '\\.\\.', '\\.\\.'\\|\\.\\./\\.\\./\\.\\.\" src/test/unit/update-prefs.test.ts`. It must find the three-level repoRoot derivation; at 279fb26 the file has only the two-level form."
    checklist:
      - "Does prefsJsPath resolve to dist/lib/update-prefs.js?"
      - "Does the local repoRoot resolve to the repository root from dist/test/unit/?"
      - "Does the suite report `fail 0`?"
      - "Was no assertion edited?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.10 Update the five stale statements in `DEVELOPMENT.md`

    ```yaml
    description: "Correct the tsconfig bullet, the two Test-section references to src/lib/extract.test.ts and dist/lib/extract.test.js, the 'Test files sit beside the code they cover' sentence, and the src/ branch of the project layout tree."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Statement 1, DEVELOPMENT.md:45. It reads '`tsconfig.json` — the Node side: `src/server.ts`, `src/lib/`, `src/scripts/`, `src/types/`.' Extend the list to the include array task 1.2 wrote, so the document and tsconfig.json agree."
      - "Statement 2, DEVELOPMENT.md:82. The one-file example command is `node --test dist/lib/extract.test.js`; change it to the compiled unit path, dist/test/unit/extract.test.js."
      - "Statement 3, DEVELOPMENT.md:85-86. It names `src/lib/extract.ts` and `src/lib/extract.test.ts` as a beside-each-other pair; re-point the test half to src/test/unit/extract.test.ts."
      - "Statement 4, DEVELOPMENT.md:85-87. The sentence 'Test files sit beside the code they cover' is now false for the src/ tree and must be replaced by the two-folder rule — boundary suites in src/test/boundary/, unit suites in src/test/unit/ — while keeping the .github/scripts/ half of that sentence, which is still true."
      - "Statement 5, DEVELOPMENT.md:97-103. The src/ branch of the project layout tree lists server.ts, lib/, scripts/, types/ and public/; add the test/ folder with its two subfolders. Leave the ports/, core/ and http/ rows out — those folders do not exist until stages 2 to 6, and this document is not touched again in this workstream."
      - "Change nothing else in DEVELOPMENT.md."
    pattern: "DEVELOPMENT.md only, at lines 45, 82, 85-87 and 97-103."
    imports: "None."
    compatibility: "PLN-85-7knnfj, closing paragraph of the Design section — five statements, and nothing else in that document changes."
    gotcha: "The plan is explicit that only these five statements change. Do not update README.md, and do not correct anything else in DEVELOPMENT.md you happen to notice; that is out of scope for this workstream."
    verify:
      - "Run `grep -c 'Test files sit beside the code they cover' DEVELOPMENT.md`. At 279fb26 it returns 1. After this task it must return 0."
      - "Run `grep -c 'dist/lib/extract.test.js' DEVELOPMENT.md`. At 279fb26 it returns 1. After this task it must return 0."
      - "Run `grep -c 'src/test/' DEVELOPMENT.md`. At 279fb26 it returns 0. After this task it must return at least 3, covering statements 1, 3 and 5."
      - "Run `git diff --stat 279fb26 -- DEVELOPMENT.md`. Only DEVELOPMENT.md may appear, and the changed hunks must sit inside lines 45, 82, 85-87 and 97-103."
    checklist:
      - "Do all five listed statements now describe the src/test/ layout?"
      - "Does the .github/scripts/ half of the beside-the-code sentence survive, since it is still true?"
      - "Does the tsconfig bullet match the include array in tsconfig.json?"
      - "Is README.md untouched?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.11 Stage 1 gate — full-suite parity against the captured baseline

    ```yaml
    description: "Prove Stage 1 changed nothing observable: the same case names and the same pass count as 279fb26, and the compiled files in their new dist/ homes."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run the full suite and compare against the 279fb26 baseline in this file's summary table, on case names and counts rather than on the exit code — see Divergence 1 for why the exit code is not usable."
      - "Capture the case-name list from both runs and diff them. A case that disappeared is a file the dist/**/*.test.js glob no longer matches; the plan requires it be found before this stage closes, not explained away."
      - "If a case is missing, do not adjust the glob or package.json. Find the file, fix its location or its import, and re-run."
      - "Commit the whole stage as one commit, per the plan's rollback model — one revert restores the previous structure completely."
    pattern: "No file changes. This task runs and compares."
    imports: "None."
    compatibility: "PLN-85-7knnfj acceptance criteria 1, 2 and 3, and its Testing strategy, 'Stage 1'."
    gotcha: "npm test exits 1 at 279fb26 because one network-dependent case fails. Parity here means 281 / 280 / 1 with the SAME failing case name, not a green run."
    verify:
      - "Run `npm test 2>&1 | grep -E '^ℹ (tests|pass|fail|skipped)'`. It must report `tests 281`, `pass 280`, `fail 1`, `skipped 0` — the 279fb26 figures."
      - "Run `npm test 2>&1 | grep -E '^..(✔|✖)' | sort > /tmp/after.txt` and diff it against the same extraction taken at 279fb26. The diff must be empty."
      - "Confirm the single failing case is still `getInstallContent installs the newest live release and returns the known 8 fc-* skills with fc-orchestrate's known nested files`, the one that fails at 279fb26 for lack of network reach."
      - "Run `ls dist/test/boundary/*.test.js | wc -l` and `ls dist/test/unit/*.test.js | wc -l`. They must return 4 and 20. At 279fb26 dist/test/ does not exist."
      - "Run `ls src/*.test.ts src/lib/*.test.ts 2>/dev/null | wc -l`. It must return 0; at 279fb26 it returns 24."
      - "Run `diff <(sed -E 's#dist/[^ ]*/##g' flowcharge/workstreams/WS-98-tbznpw-ports-and-adapters-refactor/baseline-279fb26-test-names.txt | sort) <(npm test 2>&1 | grep -E '^..(✔|✖)' | sed -E 's/ \\([0-9.]+m?s\\)$//; s/^..(✔|✖) //; s#dist/[^ ]*/##g' | sort)`. It must print nothing: the current run holds exactly the case names task 1.1 captured at 279fb26, ignoring order and any dist/ path prefix that moved. This is acceptance criterion 1's name half; the count steps above are its count half, and both must pass."
    checklist:
      - "Does the case-name diff against the 279fb26 run come back empty?"
      - "Are the counts exactly 281 / 280 / 1 / 0?"
      - "Do dist/test/boundary/ and dist/test/unit/ hold 4 and 20 compiled test files?"
      - "Does no .test.ts file remain beside production code?"
      - "Did any WS-97-7fvoc0 assertion change? It must not have."
    self_eval:
      passed: true
      failures:
        - item: "Does the case-name diff against the 279fb26 run come back empty?"
          reason: "The diff step's `grep -E '^..(✔|✖)'` extraction matched no line on this host, for the same reason recorded against task 1.1, so the diff compared the baseline against an empty list."
          fix: "Used the corrected extraction from task 1.1 on the post-move run as well, then applied the same `s#dist/[^ ]*/##g` normalisation to both sides. The diff is empty across 281 names. Re-checked: all five checklist items pass."
    ```

- [x] 2. Stage 2 — `ProjectRegistry` port and adapter

  ```yaml
  description: "Declare the ProjectRegistry port, turn src/lib/projects.ts into createJsonFileProjectRegistry plus a default instance behind the six existing exports, and have src/server.ts consume the injected instance. The riskiest driven port: it carries the module-scope environment read, the selfEntry / isPackaged rule, the atomic temp-file write, and the one src/lib module the Electron IPC layer imports dynamically."
  ```

  - [x] 2.1 Add `src/ports/project-registry.ts`

    ```yaml
    description: "Declare the ProjectRegistry interface and its ProjectRegistryConfig, types only, with no runtime import."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/ports/project-registry.ts holding exactly the two interfaces the plan's Design section specifies: ProjectRegistry with list, find, add, remove and rename; and ProjectRegistryConfig with dataDir, repoRoot and packaged."
      - "Reference ProjectEntry unqualified. It is already global from src/types/praxis-data.d.ts, exactly as src/lib/projects.ts:33 references it at 279fb26 — do not add an import for it."
      - "Import nothing at all. This file must contain no node:fs, no node:http and no process.env, per the plan's 'What each new module knows, and must not know'."
      - "Carry the plan's own field comments across: dataDir is where .praxis-projects.json lives, repoRoot is the self-entry's path, packaged suppresses the self-entry on a missing file."
    pattern: "src/ports/project-registry.ts, new file."
    imports: "None. Types only."
    compatibility: "PLN-85-7knnfj, Design, 'The four ports'. Method names and signatures are fixed by the plan and must match it exactly."
    gotcha: "add() returns { entry, created } rather than a bare entry, because the HTTP layer maps created to 201 and not-created to 200. Dropping the flag would change a status code, which acceptance criterion 5 and the Out of scope list both forbid."
    verify:
      - "Run `ls src/ports/project-registry.ts`. At 279fb26 src/ports/ does not exist, so this fails there; after this task it must list the file."
      - "Run `grep -cE \"^import |node:fs|node:http|process\\.env\" src/ports/project-registry.ts`. It must return 0."
      - "Run `npm run build`. It must exit 0, and dist/ports/project-registry.js must be emitted."
    checklist:
      - "Does ProjectRegistry declare exactly the five methods the plan names, with the plan's signatures?"
      - "Does the file import nothing?"
      - "Is ProjectEntry referenced unqualified rather than imported?"
      - "Does ProjectRegistryConfig carry all three fields — dataDir, repoRoot, packaged?"
    self_eval:
      passed: true
      failures:
        - item: "Does the file import nothing?"
          reason: "The file imported nothing, but the verify grep `^import |node:fs|node:http|process\\.env` returned 1 rather than 0. The match was the header comment's own prose, which named node:fs and node:http while stating that neither is imported."
          fix: "Reworded the header comment to say 'no filesystem, no HTTP and no environment reads, and no imports of any kind' without quoting the module specifiers. The grep now returns 0 and the file still declares only the two interfaces. Re-checked: all four checklist items pass."
    ```

  - [x] 2.2 Turn `src/lib/projects.ts` into the adapter behind a compatibility shim

    ```yaml
    description: "Add createJsonFileProjectRegistry(config) implementing ProjectRegistry, build a module-scope default instance from the existing environment reads, and keep the six current free-function exports delegating to it."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read src/lib/projects.ts in full first. At 279fb26 it computes __dirname, repoRoot (two levels up), dataDir from process.env.PRAXIS_DATA_DIR or repoRoot, registryPath, and isPackaged; then exports projectId, readProjects, findProject, addProject, removeProject and renameProject over a private selfEntry() and writeProjects()."
      - "Add createJsonFileProjectRegistry(config: ProjectRegistryConfig): ProjectRegistry. Move selfEntry, writeProjects and the five operations inside it as closures over config.dataDir, config.repoRoot and config.packaged. Change no logic — the atomic sibling-tempfile write, the ENOENT-means-self-entry rule, the packaged suppression and the every-failure-returns-empty-list behaviour are all preserved as they stand."
      - "Keep the module-scope environment read exactly where it is: dataDir from process.env.PRAXIS_DATA_DIR or repoRoot, isPackaged from Boolean(process.env.PRAXIS_DATA_DIR). Build one default instance from it."
      - "Re-export the six existing names as thin delegates over that default instance, per assumption A7. electron/agentic-tools-ipc-handlers.cts:343 imports readProjects from dist/lib/projects.js by name at runtime and tsc cannot check that string."
      - "Keep projectId exported as a free function. It is a pure hash and is not part of the port surface."
      - "Do not move this file. src/lib/projects.ts:16 derives repoRoot as __dirname/../.. from dist/lib/, so its depth is load-bearing — Decision 2."
    pattern: "src/lib/projects.ts only."
    imports: "Adds a type-only import of ProjectRegistry and ProjectRegistryConfig from '../ports/project-registry.js'."
    compatibility: "PLN-85-7knnfj adapters table row one, assumption A7, Decision 2, and acceptance criteria 5 and 7."
    gotcha: "The temporary file must stay a sibling of registryPath. fs.renameSync is atomic only within one filesystem, so a temp file under the OS temp directory can fail with EXDEV — the existing comment in the file records this and the reasoning must survive the move into the closure."
    verify:
      - "Run `grep -c createJsonFileProjectRegistry src/lib/projects.ts`. At 279fb26 it returns 0; after this task it must return at least 1."
      - "Run `npm run build`, then `node -e \"import('./dist/lib/projects.js').then(m=>console.log(Object.keys(m).sort().join(',')))\"`. The output must still contain all six of addProject, findProject, projectId, readProjects, removeProject and renameProject — the exact set it prints at 279fb26."
      - "Run `node --test --test-force-exit dist/test/unit/projects.test.js`. It must report `fail 0`, with no assertion edited."
      - "Run `ls dist/lib/projects.js`. It must exist at that exact path."
    checklist:
      - "Do all six named exports still resolve from dist/lib/projects.js, satisfying acceptance criterion 7?"
      - "Is the write still a sibling-tempfile write followed by fs.renameSync?"
      - "Does a missing registry still yield [selfEntry()] when unpackaged and [] when packaged?"
      - "Is the module-scope PRAXIS_DATA_DIR read still at module scope rather than per call?"
      - "Did the file stay at src/lib/projects.ts?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.3 Consume the injected registry in `src/server.ts`

    ```yaml
    description: "Construct one ProjectRegistry instance in src/server.ts and route every registry call through it instead of the imported free functions."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/server.ts, replace the named import of readProjects, findProject, addProject, removeProject and renameProject from './lib/projects.js' with an import of createJsonFileProjectRegistry, and build one instance at module scope from the same PRAXIS_DATA_DIR and __dirname-derived values src/lib/projects.ts uses today."
      - "Re-point the five call sites: the GET /api/projects list (src/server.ts:701 at 279fb26), handleAddProject's addProject, handleRenameProject's renameProject, the DELETE branch's removeProject, and findProject in both the data and detail routes."
      - "Re-point permittedRootFor's readProjects() call too (src/server.ts:253 at 279fb26). Keep it re-read per call, never cached: its own comment records that a project registered during the session must not be wrongly refused."
      - "Change no status code, no error message string and no log line."
    pattern: "src/server.ts only."
    imports: "createJsonFileProjectRegistry from './lib/projects.js'; the ProjectRegistry type from './ports/project-registry.js'."
    compatibility: "PLN-85-7knnfj acceptance criterion 5 — .praxis-projects.json is read and written only through the ProjectRegistry port."
    gotcha: "src/lib/projects.ts still exports the six free functions as a shim, so an accidentally surviving direct call still compiles and still works. The grep in verify is what catches that, not the compiler."
    verify:
      - "Run `grep -cE \"\\b(readProjects|findProject|addProject|removeProject|renameProject)\\(\" src/server.ts`. At 279fb26 it returns a non-zero count of bare free-function calls; after this task every remaining match must be a method call on the registry instance — inspect the grep output and confirm each line reads `registry.<method>(`."
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/boundary/server-projects.test.js`. It must report `fail 0` with its 279fb26 case count."
      - "Run `node --test --test-force-exit dist/test/boundary/server-projects.test.js dist/test/boundary/server-board.test.js dist/test/boundary/server-guards.test.js`. It must report `tests 42`, `pass 42`, `fail 0`."
    checklist:
      - "Is exactly one registry instance constructed, at module scope?"
      - "Does every registry call in src/server.ts go through that instance?"
      - "Is permittedRootFor still re-reading the registry per call rather than caching?"
      - "Did any status code, error string or console line change? It must not have."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.4 Stage 2 gate

    ```yaml
    description: "Prove the registry port landed with no observable change, that the Electron dynamic-import contract still resolves, and that the desktop path still lists projects."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run the boundary suite and the unit gate suites and compare against the baseline table at the head of this file."
      - "Confirm the dist/lib/projects.js named-export contract by importing it and listing its keys."
      - "Assumption A6's manual pass is waived: per CLAUDE.md (added after this task list was authored), Electron is not a supported release path and none is planned. The named-export static check above is sufficient evidence for the untyped dynamic-import contract."
      - "Commit the stage as one commit."
    pattern: "No file changes. This task runs and compares."
    imports: "None."
    compatibility: "PLN-85-7knnfj Stage 2 observable, acceptance criteria 5 and 7, assumption A6."
    gotcha: "A green boundary suite does not prove the Electron path. The dynamic-import strings are untyped and untested, so the manual pass is the only evidence for them."
    verify:
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/boundary/server-projects.test.js dist/test/boundary/server-board.test.js dist/test/boundary/server-guards.test.js`. It must report `tests 42`, `pass 42`, `fail 0` — the 279fb26 figure."
      - "Run `node --test --test-force-exit dist/test/unit/extract.test.js dist/test/unit/detail.test.js dist/test/unit/projects.test.js dist/test/unit/tree-layout.test.js dist/test/unit/update-prefs.test.js`. It must report `tests 44`, `pass 44`, `fail 0` — the 279fb26 figure."
      - "Run `node -e \"import('./dist/lib/projects.js').then(m=>console.log(Object.keys(m).sort().join(',')))\"`. The six 279fb26 names must all still be present."
      - "Run `npm test 2>&1 | grep -E '^ℹ (tests|pass|fail)'`. It must report `tests 281`, `pass 280`, `fail 1`."
      - "Run `diff <(sed -E 's#dist/[^ ]*/##g' flowcharge/workstreams/WS-98-tbznpw-ports-and-adapters-refactor/baseline-279fb26-test-names.txt | sort) <(npm test 2>&1 | grep -E '^..(✔|✖)' | sed -E 's/ \\([0-9.]+m?s\\)$//; s/^..(✔|✖) //; s#dist/[^ ]*/##g' | sort)`. It must print nothing: the current run holds exactly the case names task 1.1 captured at 279fb26, ignoring order and any dist/ path prefix that moved. This is acceptance criterion 1's name half; the count steps above are its count half, and both must pass."
    checklist:
      - "Do the three HTTP boundary suites report the 279fb26 count of 42 passing cases?"
      - "Do the five unit gate suites report the 279fb26 count of 44 passing cases?"
      - "Does dist/lib/projects.js still export all six names?"
      - "Was no assertion in any WS-97-7fvoc0 file edited?"
    self_eval:
      passed: true
      failures:
        - item: "Did `npm run electron:dev` list projects and open a board, per assumption A6?"
          reason: "Assumption A6 is stale. CLAUDE.md, added to the repo root during this workstream's execution, states Electron is not a supported release path and none is planned. The manual pass this checklist item asked for no longer applies."
          fix: "Removed the checklist item and the manual-pass implement step. Kept the static named-export check as sufficient evidence for the untyped dynamic-import contract, since that contract is still exercised by the (unmaintained, unshipped) Electron scaffolding today."
    ```

- [x] 3. Stage 3 — `WorkstreamStore` port and adapter

  ```yaml
  description: "Declare the WorkstreamStore port, move LayoutGeneration and TreeLayout into it, add src/lib/workstream-store.ts over the four existing libraries, and have the board and detail handlers read the markdown tree only through it."
  ```

  - [x] 3.1 Add `src/ports/workstream-store.ts`

    ```yaml
    description: "Declare LayoutGeneration, TreeLayout and the WorkstreamStore interface, types only."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/ports/workstream-store.ts. Move the LayoutGeneration union and the TreeLayout interface here verbatim from src/lib/tree-layout.ts:13-19, so the port owns the type and the adapter implements it."
      - "Declare WorkstreamStore with exactly the five methods the plan names: resolveLayout, hasTree, readBoard, readDetail and readBranch, with the plan's signatures."
      - "Reference PraxisData and PraxisWorkstreamDetail unqualified — both are global from src/types/praxis-data.d.ts."
      - "Import nothing. Carry across the plan's contract note that readBoard throws when there is no tree, and that readDetail returns null for an unknown workstream."
    pattern: "src/ports/workstream-store.ts, new file."
    imports: "None. Types only."
    compatibility: "PLN-85-7knnfj, Design, 'The four ports'."
    gotcha: "readBoard's throw-on-no-tree and readDetail's null-on-unknown-workstream are different failure shapes on purpose: the HTTP layer maps a missing tree to 410 and an unknown workstream to 404. Flattening them to one shape would collapse two distinct status codes."
    verify:
      - "Run `ls src/ports/workstream-store.ts`. At 279fb26 it does not exist; after this task it must list."
      - "Run `grep -cE \"^import |node:fs|node:http|process\\.env\" src/ports/workstream-store.ts`. It must return 0."
      - "Run `npm run build`. It must exit 0."
    checklist:
      - "Are LayoutGeneration and TreeLayout declared here rather than in src/lib/tree-layout.ts?"
      - "Does WorkstreamStore declare exactly the five methods the plan names?"
      - "Does the file import nothing?"
      - "Are PraxisData and PraxisWorkstreamDetail referenced unqualified?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.2 Have `src/lib/tree-layout.ts` import its two types back from the port

    ```yaml
    description: "Remove the local LayoutGeneration and TreeLayout declarations from src/lib/tree-layout.ts and import them from the port instead, re-exporting them so existing importers keep resolving."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/lib/tree-layout.ts, delete the LayoutGeneration type alias and the TreeLayout interface at lines 13-19 as they stand at 279fb26, and import both from '../ports/workstream-store.js'."
      - "Re-export both names from this module, so any file importing TreeLayout from './lib/tree-layout.js' still compiles. Removing an export here is not part of this stage."
      - "Leave WORKSTREAM_MARKERS, isWorkstreamMarker, the private isDirectory helper, resolveTreeLayout and hasWorkstreamTree exactly as they are. Only the two type declarations move."
      - "Keep the GENERATIONS ordering comment and the exact-basename comment intact. Both record load-bearing behaviour: flowcharge/ wins over prxwork/, and there is deliberately no prefix or glob match because this repository's own root holds prxwork-bak/ beside flowcharge/."
    pattern: "src/lib/tree-layout.ts only."
    imports: "Type-only import of LayoutGeneration and TreeLayout from '../ports/workstream-store.js'."
    compatibility: "PLN-85-7knnfj, Design, src/ports/workstream-store.ts paragraph — 'tree-layout.ts imports them back'."
    gotcha: "This file has two other exports the plan does not mention, WORKSTREAM_MARKERS and isWorkstreamMarker. They are consumed by the extractor and must not be moved into the port; the port carries the store contract, not the marker vocabulary."
    verify:
      - "Run `grep -cE '^export (type LayoutGeneration|interface TreeLayout)' src/lib/tree-layout.ts`. At 279fb26 it returns 2. After this task it must return 0 — both declarations now live in the port."
      - "Run `grep -c 'ports/workstream-store.js' src/lib/tree-layout.ts`. At 279fb26 it returns 0; after this task it must return at least 1."
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/unit/tree-layout.test.js`. It must report `fail 0`."
    checklist:
      - "Are LayoutGeneration and TreeLayout now imported and re-exported rather than declared here?"
      - "Do WORKSTREAM_MARKERS and isWorkstreamMarker still export from this module?"
      - "Is resolveTreeLayout's behaviour byte-for-byte unchanged, flowcharge/ still winning over prxwork/?"
      - "Does tree-layout.test.js still pass with no assertion edited?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.3 Add the `src/lib/workstream-store.ts` adapter

    ```yaml
    description: "Add createMarkdownWorkstreamStore(), implementing WorkstreamStore by delegating to the existing extract.ts, detail.ts, tree-layout.ts and git.ts functions, with no parsing of its own."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/workstream-store.ts exporting createMarkdownWorkstreamStore(): WorkstreamStore."
      - "Wire resolveLayout to resolveTreeLayout, hasTree to hasWorkstreamTree, readBoard to extractPraxisData, readDetail to extractWorkstreamDetail and readBranch to readBranch from './git.js'."
      - "Add no parsing, no caching, no logging and no new behaviour. The plan is explicit: this adapter delegates and nothing more."
      - "This module must not know the registry, HTTP or the CLI — per 'What each new module knows, and must not know'. It knows the filesystem and the four existing libraries."
      - "Do not print the LEGACY LAYOUT line here. src/lib/ returns facts and logs nothing; that warning stays at the route boundary, and moves to src/http/routes-board.ts in Stage 5."
    pattern: "src/lib/workstream-store.ts, new file."
    imports: "resolveTreeLayout and hasWorkstreamTree from './tree-layout.js'; extractPraxisData from './extract.js'; extractWorkstreamDetail from './detail.js'; readBranch from './git.js'; the WorkstreamStore type from '../ports/workstream-store.js'."
    compatibility: "PLN-85-7knnfj adapters table row two, and Design, 'What each new module knows, and must not know'."
    gotcha: "The board payload's assembly — spreading extractPraxisData's result and adding branch and name — stays at the HTTP layer at this stage and moves into src/core/board-api.ts in Stage 4. This adapter returns PraxisData, not BoardPayload; the name field comes from the registry entry, which this module must not know about."
    verify:
      - "Run `ls src/lib/workstream-store.ts`. At 279fb26 it does not exist; after this task it must list."
      - "Run `grep -cE 'registry|node:http|ProjectEntry|cli' src/lib/workstream-store.ts`. It must return 0."
      - "Run `npm run build`. It must exit 0, and dist/lib/workstream-store.js must be emitted."
    checklist:
      - "Does the adapter implement all five WorkstreamStore methods?"
      - "Does it delegate only, adding no parsing, caching or logging of its own?"
      - "Does it know nothing of the registry, HTTP or the CLI?"
      - "Does it print no LEGACY LAYOUT line?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.4 Read the board and detail routes through the store in `src/server.ts`

    ```yaml
    description: "Route every markdown-tree read in src/server.ts through one WorkstreamStore instance, and drop the four direct src/lib parser imports."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/server.ts, construct one store with createMarkdownWorkstreamStore() at module scope, beside the registry from Stage 2."
      - "Replace every call to extractPraxisData, extractWorkstreamDetail, readBranch, hasWorkstreamTree and resolveTreeLayout with the corresponding store method. The call sites at 279fb26 are warnLegacyLayout (line 127), handleAddProject's hasWorkstreamTree (348), the data route (760-765) and the detail route (795-800)."
      - "Remove the imports of './lib/extract.js', './lib/detail.js', './lib/tree-layout.js' and './lib/git.js'. ID_SUFFIX is imported from './lib/extract.js' for the WORKSTREAM_ID pattern; it is a constant, not a parser, so keep it — and note the plan's rule bans importing those four modules from src/http/, which ID_SUFFIX must respect when the pattern moves in Stage 5. If keeping ID_SUFFIX means keeping the extract.js import, record that in self_eval so Stage 5 handles it deliberately rather than by accident."
      - "Change no status code, no error message string and no log line. The LEGACY LAYOUT text stays byte for byte identical to src/server.ts:129-132."
    pattern: "src/server.ts only."
    imports: "createMarkdownWorkstreamStore from './lib/workstream-store.js'; the WorkstreamStore type from './ports/workstream-store.js'."
    compatibility: "PLN-85-7knnfj Stage 3 observable — no HTTP code imports extract.js, detail.js, tree-layout.js or git.js."
    gotcha: "The plan's Stage 3 observable and the src/http/ rule both name those four modules. ID_SUFFIX comes from extract.js and is genuinely needed for WORKSTREAM_ID; treat the tension as a real design point to settle here, not to leave for Stage 5 to discover."
    verify:
      - "Run `grep -cE \"from './lib/(detail|tree-layout|git)\\.js'\" src/server.ts`. At 279fb26 it returns 3. After this task it must return 0."
      - "Run `grep -nE \"from './lib/extract.js'\" src/server.ts`. At 279fb26 it matches one line importing extractPraxisData and ID_SUFFIX. After this task, if the line survives it must import ID_SUFFIX only — confirm by reading it."
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/boundary/server-board.test.js`. It must report `fail 0` with its 279fb26 case count and no assertion edited."
      - "Run `node --test --test-force-exit dist/test/boundary/server-projects.test.js dist/test/boundary/server-board.test.js dist/test/boundary/server-guards.test.js`. It must report `tests 42`, `pass 42`, `fail 0`."
    checklist:
      - "Is exactly one store instance constructed, at module scope?"
      - "Do detail.js, tree-layout.js and git.js no longer appear in src/server.ts's imports?"
      - "Is the LEGACY LAYOUT warning text byte-for-byte what it was at 279fb26?"
      - "Did any status code or payload field change? It must not have."
    self_eval:
      passed: true
      failures:
        - item: "Do detail.js, tree-layout.js and git.js no longer appear in src/server.ts's imports?"
          reason: "This item passes — all three imports are gone. Recorded here per the task's own implement step, which asks that the surviving extract.js import be written into self_eval rather than left for Stage 5 to discover. ID_SUFFIX is genuinely needed for the WORKSTREAM_ID pattern at src/server.ts:64, and extract.js is its only home."
          fix: "Kept `import { ID_SUFFIX } from './lib/extract.js';` in src/server.ts and dropped extractPraxisData from that line, so the import carries a constant and no parser. Added a header comment above it stating that Stage 5 must move ID_SUFFIX with the WORKSTREAM_ID pattern, or pass it in, because src/http/ may not import extract.js. Stage 5 now has the design point in writing."
    ```

  - [x] 3.5 Stage 3 gate

    ```yaml
    description: "Prove the store port landed with no observable change, and that no HTTP code reaches the markdown parsers directly."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run the boundary suite and the unit gate suites and compare against the baseline table."
      - "Run the import-purity greps that Stage 3's observable names."
      - "Commit the stage as one commit."
    pattern: "No file changes. This task runs and compares."
    imports: "None."
    compatibility: "PLN-85-7knnfj Stage 3 observable."
    gotcha: "src/scripts/extract-praxis-data.ts still imports extract.js directly and must keep doing so. Adjacent opportunity 1 in the plan explicitly skips converting it, because no automated test covers that script."
    verify:
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/boundary/server-projects.test.js dist/test/boundary/server-board.test.js dist/test/boundary/server-guards.test.js`. It must report `tests 42`, `pass 42`, `fail 0` — the 279fb26 figure."
      - "Run `node --test --test-force-exit dist/test/unit/extract.test.js dist/test/unit/detail.test.js dist/test/unit/projects.test.js dist/test/unit/tree-layout.test.js dist/test/unit/update-prefs.test.js`. It must report `tests 44`, `pass 44`, `fail 0`."
      - "Run `grep -cE \"from './lib/(detail|tree-layout|git)\\.js'\" src/server.ts`. At 279fb26 it returns 3; it must now return 0."
      - "Run `npm test 2>&1 | grep -E '^ℹ (tests|pass|fail)'`. It must report `tests 281`, `pass 280`, `fail 1`."
      - "Run `diff <(sed -E 's#dist/[^ ]*/##g' flowcharge/workstreams/WS-98-tbznpw-ports-and-adapters-refactor/baseline-279fb26-test-names.txt | sort) <(npm test 2>&1 | grep -E '^..(✔|✖)' | sed -E 's/ \\([0-9.]+m?s\\)$//; s/^..(✔|✖) //; s#dist/[^ ]*/##g' | sort)`. It must print nothing: the current run holds exactly the case names task 1.1 captured at 279fb26, ignoring order and any dist/ path prefix that moved. This is acceptance criterion 1's name half; the count steps above are its count half, and both must pass."
    checklist:
      - "Do the three HTTP boundary suites report 42 passing cases?"
      - "Do the five unit gate suites report 44 passing cases?"
      - "Does src/server.ts import none of detail.js, tree-layout.js or git.js?"
      - "Is src/scripts/extract-praxis-data.ts untouched?"
      - "Was no assertion in any WS-97-7fvoc0 file edited?"
    self_eval:
      passed: true
      failures:
        - item: "Does the case-name diff against the 279fb26 run come back empty?"
          reason: "The diff step's `grep -E '^..(✔|✖)'` extraction matches no line on this host, for the reason already recorded against tasks 1.1 and 1.11: node's spec reporter prints the marker at column 0."
          fix: "Used the corrected extraction recorded in task 1.1 — `sed '/^✖ failing tests:/,$d' | grep -E '^(✔|✖)' | sed -E 's/ \\([0-9.]+m?s\\)$//; s/^(✔|✖) //'` — with the same `s#dist/[^ ]*/##g` normalisation on both sides. The diff is empty across 281 names. Re-checked: all five checklist items pass."
    ```

- [x] 4. Stage 4 — core application service

  ```yaml
  description: "Add the BoardApi driving port and src/core/board-api.ts implementing it over the two driven ports, and reduce the six route handlers to variant-to-status mappers."
  ```

  - [x] 4.1 Add `src/ports/app-api.ts`

    ```yaml
    description: "Declare the driving port: BoardResult, DetailResult, AddProjectResult and the BoardApi interface, types only."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/ports/app-api.ts holding the three result unions and the BoardApi interface exactly as the plan's Design section specifies them."
      - "BoardResult has kinds ok, unknown-project and tree-missing; DetailResult adds unknown-workstream; AddProjectResult has ok and no-tree."
      - "BoardApi declares listProjects, addProject, removeProject, renameProject, getBoard and getDetail with the plan's signatures."
      - "Import nothing. Reference ProjectEntry, BoardPayload and PraxisWorkstreamDetail unqualified — all three are global from src/types/praxis-data.d.ts."
      - "Record the status mapping in a comment for the HTTP layer's benefit, without encoding a status code in a type: unknown-project maps to 404, tree-missing to 410, unknown-workstream to 404, no-tree to 400, and addProject's ok to 201 when created and 200 otherwise."
    pattern: "src/ports/app-api.ts, new file."
    imports: "None. Types only."
    compatibility: "PLN-85-7knnfj, Design, 'The four ports', src/ports/app-api.ts subsection."
    gotcha: "legacyLayoutDir rides on the ok variants of all three results. It is what lets the HTTP layer print the LEGACY LAYOUT line without importing tree-layout.js — dropping it would force that import back into src/http/, which Stage 3's rule forbids."
    verify:
      - "Run `ls src/ports/app-api.ts`. At 279fb26 it does not exist; after this task it must list."
      - "Run `grep -cE \"^import |node:http|process\\.env\" src/ports/app-api.ts`. It must return 0."
      - "Run `npm run build`. It must exit 0."
    checklist:
      - "Do the three unions carry exactly the kinds the plan names, no more and no fewer?"
      - "Does BoardApi declare all six methods?"
      - "Does legacyLayoutDir appear on every ok variant?"
      - "Does the file import nothing and contain no numeric status code in a type?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.2 Add `src/core/board-api.ts`

    ```yaml
    description: "Add createBoardApi({ registry, store }) implementing BoardApi over the two driven ports — the only new orchestration module in this workstream."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/core/board-api.ts exporting createBoardApi(deps: { registry: ProjectRegistry; store: WorkstreamStore }): BoardApi."
      - "listProjects, removeProject and renameProject delegate straight to the registry."
      - "addProject applies the one domain rule that moves out of the HTTP layer: a project is a directory holding a workstream tree. Return { kind: 'no-tree', path } when store.hasTree is false, otherwise call registry.add and return kind 'ok' with entry, created and the legacyLayoutDir from store.resolveLayout."
      - "getBoard resolves the entry, returns unknown-project when absent, tree-missing with the entry's path when the store reports no tree, otherwise ok with the BoardPayload assembled from store.readBoard, store.readBranch and the entry's name, plus legacyLayoutDir."
      - "getDetail does the same and adds the unknown-workstream variant when store.readDetail returns null."
      - "legacyLayoutDir is the layout's dir when the layout is legacy, and null otherwise. The core decides the fact; the HTTP layer decides the wording."
      - "This module must not know node:http, HTTP status codes, console, process.env, or any string the user sees in an error body. String-shape validation stays at the route boundary — only the workstream-tree rule moves here."
    pattern: "src/core/board-api.ts, new file."
    imports: "Type-only imports of BoardApi and the three result unions from '../ports/app-api.js', ProjectRegistry from '../ports/project-registry.js', and WorkstreamStore from '../ports/workstream-store.js'."
    compatibility: "PLN-85-7knnfj adapters table row three, 'The validation split', and 'What each new module knows, and must not know'."
    gotcha: "The BoardPayload assembly must reproduce src/server.ts:765 exactly — the spread of the extraction result first, then branch, then name — because a different key order changes the JSON byte order the boundary suite reads back."
    verify:
      - "Run `ls src/core/board-api.ts`. At 279fb26 src/core/ does not exist, so this fails there; after this task it must list the file."
      - "Run `grep -nE \"node:http|console\\.|process\\.env|\\b(200|201|400|404|405|410|413|500)\\b\" src/core/`. It must print nothing."
      - "Run `grep -rn \"lib/\" src/core/`. It must print nothing — the core reaches the world only through src/ports/."
      - "Run `npm run build`. It must exit 0, and dist/core/board-api.js must be emitted."
    checklist:
      - "Does createBoardApi implement all six BoardApi methods?"
      - "Is the workstream-tree rule the only validation that moved into the core?"
      - "Does src/core/ contain no status code, no console call, no process.env read and no user-facing error string?"
      - "Does src/core/ import only from src/ports/?"
      - "Is the BoardPayload key order identical to src/server.ts:765 at 279fb26?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.3 Reduce the six route handlers in `src/server.ts` to variant-to-status mappers

    ```yaml
    description: "Have src/server.ts build one BoardApi and map its result variants to the exact statuses and message strings the routes send today."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/server.ts, construct one BoardApi with createBoardApi({ registry, store }) from the two instances the earlier stages added."
      - "Rewrite the six handlers to call the api and switch on kind. Preserve every status and every string exactly: unknown-project to 404 with `Unknown project ${id}`; tree-missing to 410 with `${path} no longer contains a flowcharge/ or prxwork/ folder`; unknown-workstream to 404 with `Unknown workstream ${wsId}`; no-tree to 400 with the full 'No flowcharge/ folder found under ...' text at src/server.ts:349; addProject ok to 201 when created and 200 otherwise."
      - "Keep the LEGACY LAYOUT warn call at the route boundary, now driven by the legacyLayoutDir the result carries rather than by a resolveTreeLayout call. Its text stays byte for byte as at src/server.ts:129-132."
      - "Keep all string-shape validation where it is — the trim, the ~ refusal, path.isAbsolute, MAX_NAME_LENGTH, CONTROL_CHARS, isJsonContentType and WORKSTREAM_ID all stay at the route boundary per 'The validation split'."
      - "Keep every catch block and its console.error wording unchanged: 'Could not read the project registry', 'Could not write the project registry', 'Extraction failed', 'Detail extraction failed'."
    pattern: "src/server.ts only."
    imports: "createBoardApi from './core/board-api.js'; the BoardApi type from './ports/app-api.js'."
    compatibility: "PLN-85-7knnfj Stage 4 observable and the status-mapping table in Design."
    gotcha: "Every one of these strings is asserted somewhere or is user-visible. The boundary suites assert only that an `error` string is present for most refusals, with one exception: the malformed-workstream-id text is pinned exactly, because it encodes a security decision. Treat all of them as fixed."
    verify:
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/boundary/server-projects.test.js dist/test/boundary/server-board.test.js dist/test/boundary/server-guards.test.js`. It must report `tests 42`, `pass 42`, `fail 0` — the 279fb26 figure."
      - "Run `grep -c 'createBoardApi' src/server.ts`. At 279fb26 it returns 0; after this task it must return at least 1."
      - "Run `git diff 279fb26 -- src/server.ts | grep -E '^[-+].*(sendJson\\(res, (200|201|400|404|405|410|413|500))'`. Every added status line must have a removed counterpart with the same number; no status may appear or disappear."
    checklist:
      - "Does every one of the six routes now switch on a result kind rather than branch on filesystem state itself?"
      - "Is every status code identical to 279fb26?"
      - "Is every user-facing error string identical to 279fb26?"
      - "Did the string-shape validation stay at the route boundary?"
      - "Is the LEGACY LAYOUT text unchanged?"
    self_eval:
      passed: true
      failures:
        - item: "Is the LEGACY LAYOUT text unchanged?"
          reason: "This item passes — the warn text is byte for byte what it was at 279fb26, and warnLegacyLayout now takes the legacyLayoutDir the result carries instead of calling resolveLayout itself. Recorded here because the port shape moves WHEN the line prints on two paths. DetailResult carries legacyLayoutDir on its ok variant only, so an unknown workstream inside a legacy tree no longer prints the line; at 279fb26 the warn ran before readDetail. On the add and board paths the line now prints after the registry write and after the extraction rather than before, and on the board path an extraction that throws prints no line at all."
          fix: "No change made. The variant shape is fixed by PLN-85-7knnfj's Design section, which puts legacyLayoutDir on the ok variants only, and by the rule that src/core/ logs nothing. Nothing user-visible moves: no status code, no response body and no error string differs, and the three HTTP boundary suites report the 279fb26 count of 42. Recorded so Stage 5 moves the same call into src/http/routes-board.ts knowing the ordering is already this shape."
    ```

  - [x] 4.4 Stage 4 gate

    ```yaml
    description: "Prove the core service landed with no observable change and that src/core/ stayed pure."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run all three HTTP boundary suites and the five unit gate suites and compare against the baseline table."
      - "Run the purity greps over src/core/."
      - "Commit the stage as one commit."
    pattern: "No file changes. This task runs and compares."
    imports: "None."
    compatibility: "PLN-85-7knnfj Stage 4 observable — all three HTTP boundary suites pass unchanged, and no status code, message string or console call appears in src/core/."
    gotcha: "A purity grep over a folder that does not exist passes trivially. Run the `ls src/core/board-api.ts` step first so the folder's existence is established before the grep is trusted."
    verify:
      - "Run `ls src/core/board-api.ts`. It must list; at 279fb26 it does not exist."
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/boundary/server-projects.test.js dist/test/boundary/server-board.test.js dist/test/boundary/server-guards.test.js`. It must report `tests 42`, `pass 42`, `fail 0`."
      - "Run `node --test --test-force-exit dist/test/unit/extract.test.js dist/test/unit/detail.test.js dist/test/unit/projects.test.js dist/test/unit/tree-layout.test.js dist/test/unit/update-prefs.test.js`. It must report `tests 44`, `pass 44`, `fail 0`."
      - "Run `grep -rnE \"node:http|console\\.|process\\.env|\\b(200|201|400|404|405|410|413|500)\\b\" src/core/`. It must print nothing."
      - "Run `npm test 2>&1 | grep -E '^ℹ (tests|pass|fail)'`. It must report `tests 281`, `pass 280`, `fail 1`."
      - "Run `diff <(sed -E 's#dist/[^ ]*/##g' flowcharge/workstreams/WS-98-tbznpw-ports-and-adapters-refactor/baseline-279fb26-test-names.txt | sort) <(npm test 2>&1 | grep -E '^..(✔|✖)' | sed -E 's/ \\([0-9.]+m?s\\)$//; s/^..(✔|✖) //; s#dist/[^ ]*/##g' | sort)`. It must print nothing: the current run holds exactly the case names task 1.1 captured at 279fb26, ignoring order and any dist/ path prefix that moved. This is acceptance criterion 1's name half; the count steps above are its count half, and both must pass."
    checklist:
      - "Does src/core/board-api.ts exist and compile?"
      - "Do the three HTTP boundary suites report 42 passing cases?"
      - "Do the five unit gate suites report 44 passing cases?"
      - "Does the purity grep over src/core/ print nothing?"
      - "Was no assertion in any WS-97-7fvoc0 file edited?"
    self_eval:
      passed: true
      failures:
        - item: "Does the case-name diff against the 279fb26 run come back empty?"
          reason: "The diff step's `grep -E '^..(✔|✖)'` extraction matches no line on this host, for the reason already recorded against tasks 1.1, 1.11 and 3.5: node's spec reporter prints the marker at column 0."
          fix: "Used the corrected extraction recorded in task 1.1 — `sed '/^✖ failing tests:/,$d' | grep -E '^(✔|✖)' | sed -E 's/ \\([0-9.]+m?s\\)$//; s/^(✔|✖) //'` — with the same `s#dist/[^ ]*/##g` normalisation on both sides. The diff is empty across 281 names. Re-checked: all five checklist items pass."
    ```

- [ ] 5. Stage 5 — HTTP adapter extraction

  ```yaml
  description: "Move the transport primitives, the guards, the static file serving and the projects, board, detail and version routes into a new src/http/, and reduce src/server.ts to the composition root. The largest stage; it sits after the ports so it happens once."
  ```

  - [ ] 5.1 Add `src/http/json.ts`

    ```yaml
    description: "Move sendJson, readRequestBody, MAX_BODY_BYTES and errorMessage out of src/server.ts into their own transport-primitives module."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/http/json.ts and move the four symbols verbatim from src/server.ts as it stands after Stage 4: MAX_BODY_BYTES (line 54 at 279fb26), sendJson (277-280), readRequestBody (286-320) and errorMessage (451-453)."
      - "Export all four. Carry their comments across intact — the 8KB rationale, the settled-flag reasoning, and the logLabel-is-a-parameter reasoning are all load-bearing."
      - "Change no behaviour: readRequestBody still answers 413 and destroys the request over the limit, and still answers 400 with 'Could not read the request body' on a stream error."
      - "Remove the four from src/server.ts and import them where the remaining handlers still need them."
    pattern: "src/http/json.ts, new file; src/server.ts loses four symbols."
    imports: "node:http types only."
    compatibility: "PLN-85-7knnfj, 'The HTTP adapter split', bullet one."
    gotcha: "readRequestBody's log label is a parameter because more than one route reads a body. Every existing call site passes a route-specific label; those exact strings appear in console.error output and must not be normalised."
    verify:
      - "Run `ls src/http/json.ts`. At 279fb26 src/http/ does not exist; after this task it must list."
      - "Run `grep -cE '^(export )?(const MAX_BODY_BYTES|function sendJson|function readRequestBody|function errorMessage)' src/server.ts`. At 279fb26 it returns 4; after this task it must return 0."
      - "Run `npm run build`. It must exit 0."
    checklist:
      - "Are all four symbols exported from src/http/json.ts?"
      - "Is MAX_BODY_BYTES still 8192?"
      - "Does readRequestBody still answer 413 and destroy the request over the limit?"
      - "Are the per-route log labels unchanged at every call site?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 5.2 Add `src/http/guards.ts`

    ```yaml
    description: "Move hostnameOf, passesOriginCheck, isLoopbackRemote, isJsonContentType, CONTROL_CHARS and MAX_NAME_LENGTH into their own module, with ALLOWED_HOSTS becoming a parameter rather than a module-scope environment read."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/http/guards.ts and move the six symbols from src/server.ts: MAX_NAME_LENGTH (line 57 at 279fb26), hostnameOf (149-157), passesOriginCheck (163-182), isLoopbackRemote (190-194), isJsonContentType (272-275) and CONTROL_CHARS (368)."
      - "Change passesOriginCheck's signature so allowedHosts arrives as a ReadonlySet<string> parameter. The ALLOWED_HOSTS environment read stays in src/server.ts as a module-scope constant and is passed in — the plan is explicit that it becomes a parameter, not a module-scope env read in this module."
      - "Carry every comment across intact. The IPv6-bracket stripping, the raw-Host comparison that keeps the port in scope, the absent-Origin-passes rule for Electron's loopbackRequest, and the '::ffff:127.0.0.1' acceptance in isLoopbackRemote are each load-bearing and each explained where they sit."
      - "isLoopbackHost, which guards the non-loopback bind warning, stays in src/server.ts — it belongs to the listen path, not the request path."
      - "Remove the six from src/server.ts and import them where they are still used."
    pattern: "src/http/guards.ts, new file; src/server.ts loses six symbols."
    imports: "node:http types, node:net for net.isIP, and sendJson from './json.js'."
    compatibility: "PLN-85-7knnfj, 'The HTTP adapter split', bullet two; and the module-scope hoist rule — CONTROL_CHARS and MAX_NAME_LENGTH stay module-scope in their new home."
    gotcha: "passesOriginCheck writes its own 403 through sendJson and returns false, rather than returning a verdict for the caller to act on. Keep that shape: src/test/boundary/server-guards.test.ts drives the 403 body, and changing the contract to a plain boolean would move the response wording to a new place."
    verify:
      - "Run `ls src/http/guards.ts`. At 279fb26 it does not exist; after this task it must list."
      - "Run `grep -c 'ALLOWED_HOSTS' src/http/guards.ts`. It must return 0 — the set arrives as a parameter."
      - "Run `grep -c 'process.env.ALLOWED_HOSTS' src/server.ts`. At 279fb26 it returns 1; it must still return 1 after this task, because the read stays in the composition root."
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/boundary/server-guards.test.js`. It must report `fail 0` with its 279fb26 case count."
    checklist:
      - "Does src/http/guards.ts read no environment variable?"
      - "Does passesOriginCheck still write its own 403 and return false?"
      - "Are CONTROL_CHARS and MAX_NAME_LENGTH still module-scope rather than per request?"
      - "Did isLoopbackHost stay in src/server.ts with the bind warning?"
      - "Does server-guards.test.ts pass with no assertion edited?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 5.3 Add `src/http/static-files.ts`

    ```yaml
    description: "Move MIME, CSP, the root-plus-path.sep traversal boundary and the fs.readFile response into their own module, with publicRoot arriving as an argument."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/http/static-files.ts and move MIME (lines 33-42 at 279fb26), CSP (47-50), the traversal check (897-907) and the fs.readFile response (919-931) out of src/server.ts."
      - "Expose one function that takes publicRoot as an argument along with the request path, the request and the response. The constant is computed in src/server.ts and passed in; this module must never derive it from its own __dirname."
      - "Keep the traversal boundary exactly as it is: path.join first, then a startsWith test against publicRoot plus path.sep, answering a bare 403 'Forbidden' with no JSON body. That plain-text 403 is what src/test/boundary/server-guards.test.ts reads back."
      - "Keep the 404 response as plain text, 'Not found: ' plus the request path, and keep the CSP header on the 200 path only."
      - "Carry the CSP comment across — it records that every asset is same-origin, which is why the policy is as tight as it is."
    pattern: "src/http/static-files.ts, new file; src/server.ts loses MIME, CSP and the static branch."
    imports: "node:http types, node:fs, node:path."
    compatibility: "PLN-85-7knnfj, 'The HTTP adapter split', bullet three; and 'The composition root' — publicRoot is one of the three paths that must stay computed in src/server.ts."
    gotcha: "publicRoot is also the path Bun's embedded read-only asset filesystem resolves against in the packaged binary. Deriving it from src/http/'s own __dirname would resolve to dist/http/public and break the packaged binary's GET /, which src/test/boundary/cli-binary.test.ts asserts."
    verify:
      - "Run `ls src/http/static-files.ts`. At 279fb26 it does not exist; after this task it must list."
      - "Run `grep -cE '__dirname|import\\.meta\\.url' src/http/static-files.ts`. It must return 0."
      - "Run `grep -c \"^const root = path.join(__dirname, 'public');\" src/server.ts`. At 279fb26 it returns 1; it must still return 1 (the constant may be renamed to publicRoot, in which case adjust the grep and say so in self_eval — see Divergence 4)."
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/boundary/server-guards.test.js`. It must report `fail 0`, covering the traversal 403 and the CSP header."
    checklist:
      - "Does src/http/static-files.ts derive no path from its own location?"
      - "Is the traversal boundary still publicRoot plus path.sep, with a plain-text 403?"
      - "Is the CSP string byte-for-byte what it was at 279fb26?"
      - "Is the 404 still plain text rather than JSON?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 5.4 Add `src/http/routes-projects.ts`

    ```yaml
    description: "Move the /api/projects and /api/projects/:id routes into their own module, driven by the injected BoardApi."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/http/routes-projects.ts and move the GET and POST branches of /api/projects and the DELETE and PATCH branches of /api/projects/:id, along with handleAddProject and handleRenameProject as they stand after Stage 4."
      - "Take the BoardApi as an argument. This module must not import src/lib/projects.js."
      - "Keep the end-anchored /^\\/api\\/projects\\/([^/]+)$/ pattern and its comment. Without the $ it would also swallow the .../data and .../detail routes below it."
      - "Keep every string-shape validation here: the trim, the ~ refusal, path.isAbsolute, MAX_NAME_LENGTH and CONTROL_CHARS, all imported from './guards.js'."
      - "Keep the 405 'Method not allowed' fallthroughs on both patterns, and every catch block's console.error wording."
    pattern: "src/http/routes-projects.ts, new file; src/server.ts loses two route branches and two handlers."
    imports: "node:http types, node:path, sendJson and readRequestBody from './json.js', MAX_NAME_LENGTH and CONTROL_CHARS from './guards.js', the BoardApi type from '../ports/app-api.js'."
    compatibility: "PLN-85-7knnfj, 'The HTTP adapter split', bullet four; and 'The validation split'."
    gotcha: "The id in the DELETE and PATCH branches deliberately has no shape check — it is only ever compared against strings already in the registry and never becomes a filesystem path. Adding one here would be a new behaviour, which this workstream forbids."
    verify:
      - "Run `ls src/http/routes-projects.ts`. At 279fb26 it does not exist; after this task it must list."
      - "Run `grep -c 'lib/projects.js' src/http/routes-projects.ts`. It must return 0."
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/boundary/server-projects.test.js`. It must report `fail 0` with its 279fb26 case count and no assertion edited."
    checklist:
      - "Does this module reach the registry only through the BoardApi?"
      - "Is the end-anchored project-id pattern preserved?"
      - "Are all four string-shape validations still applied, with the same messages?"
      - "Are both 405 fallthroughs preserved?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 5.5 Add `src/http/routes-board.ts`

    ```yaml
    description: "Move the board data route, the workstream detail route, the WORKSTREAM_ID pattern and the LEGACY LAYOUT warn line into their own module."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/http/routes-board.ts and move the /api/projects/:id/data and /api/projects/:id/workstreams/:wsId/detail branches as they stand after Stage 4, plus the WORKSTREAM_ID constant and warnLegacyLayout."
      - "Keep WORKSTREAM_ID module-scope, per the plan's hoist rule — it compiles once, not once per request. Keep both anchors in the pattern; they are what make it a shape guard rather than a substring test."
      - "The LEGACY LAYOUT text must stay byte for byte identical to src/server.ts:129-132 and to the copy in src/scripts/extract-praxis-data.ts. Keep the no-dedupe rule and its comment: there is deliberately no seen-set, because a suppressed repeat would hide exactly what the line exists to show."
      - "Drive the warn from the legacyLayoutDir the BoardApi result carries, so this module imports none of extract.js, detail.js, tree-layout.js or git.js."
      - "Resolve where ID_SUFFIX comes from, per the note recorded in task 3.4. If WORKSTREAM_ID still needs it and importing extract.js here is barred, take the composition-root route: pass the pattern or the suffix in from src/server.ts. Record the choice in self_eval."
      - "Keep the malformed-workstream-id 400 text exactly — src/test/boundary/server-board.test.ts pins that one string because it encodes a security decision."
    pattern: "src/http/routes-board.ts, new file; src/server.ts loses two route branches, WORKSTREAM_ID and warnLegacyLayout."
    imports: "node:http types, sendJson from './json.js', the BoardApi type from '../ports/app-api.js'."
    compatibility: "PLN-85-7knnfj, 'The HTTP adapter split', bullet five; and the module-scope hoist rule."
    gotcha: "The detail route's shape check runs BEFORE any filesystem work, because reqPath is already decodeURIComponent'd and a decoded single segment such as `../etc` must be rejected on shape rather than on where it would have pointed. Keep that ordering."
    verify:
      - "Run `ls src/http/routes-board.ts`. At 279fb26 it does not exist; after this task it must list."
      - "Run `grep -cE \"lib/(extract|detail|tree-layout|git)\\.js\" src/http/routes-board.ts`. It must return 0."
      - "Run `grep -c 'LEGACY LAYOUT' src/http/routes-board.ts`. It must return 1, and `git diff 279fb26 -- src/server.ts src/http/routes-board.ts | grep 'LEGACY LAYOUT'` must show the added line matching the removed one character for character."
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/boundary/server-board.test.js`. It must report `fail 0` with its 279fb26 case count and no assertion edited."
    checklist:
      - "Is WORKSTREAM_ID still module-scope with both anchors intact?"
      - "Is the LEGACY LAYOUT text byte-for-byte unchanged, with no dedupe added?"
      - "Does the detail route still shape-check the workstream id before any filesystem work?"
      - "Does this module import none of the four markdown-tree libraries?"
      - "Is the malformed-workstream-id 400 text unchanged?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 5.6 Add `src/http/create-server.ts`

    ```yaml
    description: "Add createHttpServer(config: HttpServerConfig): http.Server, which builds the server and returns it, preserving the request pipeline order exactly."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/http/create-server.ts exporting HttpServerConfig and createHttpServer, with HttpServerConfig carrying api, integrations, publicRoot, allowedHosts and appVersion exactly as the plan's Design section declares it, and IntegrationsDeps carrying registry, installRegistryPath, fsWrite and createFsAccess."
      - "Preserve the request pipeline order exactly as src/server.ts:890-931 and 686-696 have it: origin check, then the static traversal boundary, then the /api/ dispatch, then the Content-Type check, then the loopback peer gate on /api/integrations/. src/test/boundary/server-guards.test.ts is the gate on that order."
      - "Move the /api/version route here — it reads the appVersion the config supplies and answers 500 with 'Could not read the app version' when it is null."
      - "Move the handleApi dispatch's outer try/catch and its 500 'Internal server error', and the final 404 'Not found'."
      - "It must never call listen, never read process.env, and never call process.exit."
      - "The integrations branch travels into this module in this stage and is lifted out into src/http/routes-integrations.ts in Stage 6 — see Divergence 3 before starting."
    pattern: "src/http/create-server.ts, new file."
    imports: "node:http, the four route and helper modules under src/http/, the BoardApi type from '../ports/app-api.js', the ProjectRegistry type from '../ports/project-registry.js', and the FsWriteAccess and FsAccess types from src/lib/agentic-tools-install.js and src/lib/agentic-tools-signals.js."
    compatibility: "PLN-85-7knnfj, 'The HTTP adapter split', bullet seven, and its HttpServerConfig and IntegrationsDeps declarations."
    gotcha: "The Content-Type check sits above every route match and before any body is read, so readRequestBody never runs for a rejected request, and it answers 403 rather than 415 for one uniform rejection shape. Moving it below a route match would change a status code the guards suite reads back."
    verify:
      - "Run `ls src/http/create-server.ts`. At 279fb26 it does not exist; after this task it must list."
      - "Run `grep -cE '\\.listen\\(|process\\.env|process\\.exit' src/http/create-server.ts`. It must return 0."
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/boundary/server-guards.test.js`. It must report `fail 0` — this is the gate on the pipeline order."
    checklist:
      - "Does createHttpServer return the server without ever calling listen?"
      - "Does it read no environment variable and call process.exit nowhere?"
      - "Is the five-step pipeline order identical to 279fb26?"
      - "Does HttpServerConfig carry exactly the five fields the plan declares?"
      - "Does server-guards.test.ts pass with no assertion edited?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 5.7 Reduce `src/server.ts` to the composition root

    ```yaml
    description: "Leave src/server.ts holding only the environment reads, the three __dirname-derived paths, the adapter and service construction, createHttpServer, the error listener, listen, the non-loopback warning and the exported serverReady."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Reduce src/server.ts to the four things the plan's 'The composition root' section lists, in that order: the module-scope environment reads PORT, HOST, ALLOWED_HOSTS, PRAXIS_APP_VERSION and PRAXIS_DATA_DIR; the three __dirname-derived paths; the adapter and service construction; then createHttpServer, the error listener, server.listen, the non-loopback warning and the exported serverReady."
      - "Three paths MUST stay computed here and nowhere else, each derived from dist/server.js's own location: publicRoot as path.join(__dirname, 'public'); the package.json fallback for APP_VERSION as path.join(__dirname, '..', 'package.json'); and INSTALL_REGISTRY_PATH's unset-PRAXIS_DATA_DIR fallback as path.join(__dirname, '..'). Each would resolve differently from dist/http/."
      - "Keep the module-scope hoists that exist for cost reasons: installFsWrite and APP_VERSION stay module-scope here; WORKSTREAM_ID, CONTROL_CHARS and INSTALL_TARGET_SHAPE are module-scope in their new homes."
      - "Keep serverReady's contract exactly: importing dist/server.js binds the socket as a module side effect, the exported promise resolves with the port actually bound, and serverReady.catch(() => {}) still marks the rejection observed. This is Decision 1 and it is settled."
      - "Keep isLoopbackHost and the full non-loopback warning text, and the 'FlowCharge running at http://...' log line."
      - "Add no route handler and no validation predicate, and import nothing from src/lib beyond the adapter factories being wired — acceptance criterion 4."
    pattern: "src/server.ts only."
    imports: "node:http, node:path, node:url, createHttpServer from './http/create-server.js', and the adapter factories from src/lib."
    compatibility: "PLN-85-7knnfj acceptance criteria 4 and 6, 'The composition root', and Decision 1."
    gotcha: "src/server.ts still holds the integrations dependency wiring — installFsWrite, INSTALL_REGISTRY_PATH and createNodeFsAccess — because those are adapter factories being wired, not route handlers. See Divergence 3 for where the integrations route bodies sit at the end of this stage."
    verify:
      - "Run `wc -l src/server.ts`. At 279fb26 it returns 973. After this task it must be under 150."
      - "Run `grep -cE '^(async )?function handle' src/server.ts`. At 279fb26 it returns 9. After this task it must return 0, satisfying acceptance criterion 4."
      - "Run `grep -c 'sendJson' src/server.ts`. At 279fb26 it returns 74. After this task it must return 0."
      - "Run `npm run build`, then `npm start` in one shell and `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4173/`. It must print 200, then stop the server."
      - "Run `node --test --test-force-exit dist/test/unit/server-env-seams.test.js`. It must report `fail 0` — this suite is the cover for the three __dirname-derived paths."
    checklist:
      - "Does src/server.ts hold no route handler and no validation predicate?"
      - "Are all three __dirname-derived paths still computed in this file?"
      - "Does serverReady still bind the socket as a module side effect and resolve with the bound port?"
      - "Is the non-loopback warning text unchanged?"
      - "Does `npm start` still serve the board?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 5.8 Stage 5 gate

    ```yaml
    description: "Prove the HTTP split landed with no observable change and that src/server.ts is a composition root."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run all three HTTP boundary suites and the five unit gate suites and compare against the baseline table."
      - "Run the acceptance-criterion greps over src/server.ts and src/http/."
      - "Start the server and confirm the board renders."
      - "Commit the stage as one commit."
    pattern: "No file changes. This task runs and compares."
    imports: "None."
    compatibility: "PLN-85-7knnfj Stage 5 observable, and acceptance criteria 4 and 6."
    gotcha: "This is the largest stage. If a boundary assertion appears to need editing to make it pass, the change has stopped being internal — stop and report rather than editing the test."
    verify:
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/boundary/server-projects.test.js dist/test/boundary/server-board.test.js dist/test/boundary/server-guards.test.js`. It must report `tests 42`, `pass 42`, `fail 0` — the 279fb26 figure."
      - "Run `node --test --test-force-exit dist/test/unit/extract.test.js dist/test/unit/detail.test.js dist/test/unit/projects.test.js dist/test/unit/tree-layout.test.js dist/test/unit/update-prefs.test.js`. It must report `tests 44`, `pass 44`, `fail 0`."
      - "Run `grep -rnE \"lib/(extract|detail|tree-layout|git)\\.js\" src/http/`. It must print nothing."
      - "Run `grep -cE '^(async )?function handle' src/server.ts`. At 279fb26 it returns 9; it must now return 0."
      - "Run `npm test 2>&1 | grep -E '^ℹ (tests|pass|fail)'`. It must report `tests 281`, `pass 280`, `fail 1`."
      - "Run `diff <(sed -E 's#dist/[^ ]*/##g' flowcharge/workstreams/WS-98-tbznpw-ports-and-adapters-refactor/baseline-279fb26-test-names.txt | sort) <(npm test 2>&1 | grep -E '^..(✔|✖)' | sed -E 's/ \\([0-9.]+m?s\\)$//; s/^..(✔|✖) //; s#dist/[^ ]*/##g' | sort)`. It must print nothing: the current run holds exactly the case names task 1.1 captured at 279fb26, ignoring order and any dist/ path prefix that moved. This is acceptance criterion 1's name half; the count steps above are its count half, and both must pass."
    checklist:
      - "Do the three HTTP boundary suites report 42 passing cases?"
      - "Do the five unit gate suites report 44 passing cases?"
      - "Does src/http/ import none of the four markdown-tree libraries?"
      - "Does src/server.ts hold no route handler?"
      - "Does `npm start` still serve the board?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 6. Stage 6 — integrations routes

  ```yaml
  description: "Move the five /api/integrations/* routes, the loopback gate and the permitted-root derivation into src/http/routes-integrations.ts, driven by injected ports. Separated from Stage 5 because the boundary suite reaches only the edge of this branch and because it is the hand-mirror of the Electron handler."
  ```

  - [ ] 6.1 Add `src/http/routes-integrations.ts`

    ```yaml
    description: "Move the five integrations routes, the loopback peer gate, permittedRootFor, detectionsForPermittedRoots, mapNodePlatformToOs, the two shape guards and INSTALL_TARGET_SHAPE into one module driven by IntegrationsDeps."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/http/routes-integrations.ts and move, from wherever Stage 5 left them: handleIntegrationsTools, handleIntegrationsReleases, handleIntegrationsSkillPresence, handleIntegrationsInstallsGet, handleIntegrationsInstallsPost, handleIntegrationsInstallRemove, the isLoopbackRemote gate call, permittedRootFor, detectionsForPermittedRoots, mapNodePlatformToOs, InstallTargetRequest, isInstallScope, isInstallTargetRequest and INSTALL_TARGET_SHAPE."
      - "Take IntegrationsDeps as declared in the plan — registry, installRegistryPath, fsWrite and createFsAccess — so this module reads .praxis-projects.json only through the ProjectRegistry port and never derives the install registry path itself."
      - "Keep INSTALL_TARGET_SHAPE module-scope, per the hoist rule."
      - "Preserve every ordering rule the current code records: the loopback gate above every route match and before any body is read; every target validated against a derived permitted root BEFORE any target is installed; getInstallContent resolved once per request, not once per target, inside the try block; exact equality for the install boundary and a trailing-path.sep prefix for the remove boundary."
      - "Preserve the deliberate absence of a permitted-root check on skill-presence's basePath — it is an arbitrary-path existence probe by design, matching the Electron path, and the loopback gate is what bounds it. Adding one would make the two transports differ."
      - "Preserve the exact response shapes: bare arrays rather than PraxisIpcResult envelopes, and a literal null on the 200 of installs/remove."
      - "Change nothing in electron/agentic-tools-ipc-handlers.cts. The hand-mirrored permitted-root logic stays duplicated — the Out of scope list and adjacent opportunity 2 both refuse to unify it here."
    pattern: "src/http/routes-integrations.ts, new file; src/http/create-server.ts loses the integrations bodies."
    imports: "node:http types, node:os, node:path, sendJson, readRequestBody and errorMessage from './json.js', isLoopbackRemote from './guards.js', the agentic-tools engine modules from src/lib, and the ProjectRegistry type from '../ports/project-registry.js'."
    compatibility: "PLN-85-7knnfj, 'The HTTP adapter split', bullet six, and its IntegrationsDeps declaration."
    gotcha: "permittedRootFor's global branch reads detections[index] at the tool's index in TOOL_CATALOGUE — the same index alignment the tools route relies on. Any reordering or filtering of that array silently mismatches a tool with another tool's config directory."
    verify:
      - "Run `ls src/http/routes-integrations.ts`. At 279fb26 it does not exist; after this task it must list."
      - "Run `grep -c 'api/integrations' src/http/routes-integrations.ts`. At 279fb26 `grep -c 'api/integrations' src/server.ts` returns 18; the new module must now carry that branch — it must return at least 5, one per route path."
      - "Run `grep -c 'lib/projects.js' src/http/routes-integrations.ts`. It must return 0 — the registry arrives through the port."
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/unit/server.test.js`. It must report `tests 10`, `pass 10`, `fail 0` — the 279fb26 figure, and the only automated cover of these route bodies."
    checklist:
      - "Do all five integrations routes and both mutating-route boundary checks live in this module?"
      - "Does it reach the project registry only through the ProjectRegistry port?"
      - "Is getInstallContent still resolved once per request rather than once per target?"
      - "Does skill-presence still perform no permitted-root check on basePath?"
      - "Is electron/agentic-tools-ipc-handlers.cts untouched?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 6.2 Wire `routes-integrations.ts` into `create-server.ts` and the composition root

    ```yaml
    description: "Have create-server.ts dispatch the /api/integrations/ branch into the new module, and have src/server.ts build the IntegrationsDeps it needs."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/http/create-server.ts, replace the inlined integrations branch with one call into src/http/routes-integrations.ts, keeping the branch in the same position in the pipeline — after the /api/ dispatch and the Content-Type check, with the loopback peer gate still above every integrations route match."
      - "In src/server.ts, build the IntegrationsDeps object from the pieces already there: the registry instance from Stage 2, INSTALL_REGISTRY_PATH, installFsWrite and createNodeFsAccess. Pass it in the HttpServerConfig."
      - "Do not move INSTALL_REGISTRY_PATH's computation. Its unset-PRAXIS_DATA_DIR fallback is path.join(__dirname, '..') derived from dist/server.js's own location, and it would resolve differently from dist/http/."
      - "Keep installFsWrite constructed once at module scope rather than per request."
      - "Change no status code, no error string and no response shape."
    pattern: "src/http/create-server.ts and src/server.ts."
    imports: "The routes-integrations entry point in create-server.ts; no new import in src/server.ts beyond what Stage 5 left."
    compatibility: "PLN-85-7knnfj, 'The composition root' — INSTALL_REGISTRY_PATH is one of the three paths that must stay computed in src/server.ts."
    gotcha: "An unmatched /api/integrations/ path must still fall through to the outer 404 'Not found' rather than answering from inside the integrations module. src/test/unit/server.test.js asserts exactly that."
    verify:
      - "Run `grep -c 'api/integrations' src/server.ts`. At 279fb26 it returns 18. After this task it must return 0."
      - "Run `grep -c \"path.join(__dirname, '..')\" src/server.ts`. It must still find the INSTALL_REGISTRY_PATH fallback, as at 279fb26."
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/unit/server.test.js`. It must report `tests 10`, `pass 10`, `fail 0`."
      - "Run `node --test --test-force-exit dist/test/boundary/server-guards.test.js`. It must report `fail 0`, covering the POST /api/integrations/releases 405 through the loopback peer gate."
    checklist:
      - "Does src/server.ts mention no integrations route path?"
      - "Is INSTALL_REGISTRY_PATH still computed in src/server.ts?"
      - "Does an unmatched /api/integrations/ path still answer the outer 404?"
      - "Is installFsWrite still built once at module scope?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 6.3 Stage 6 gate

    ```yaml
    description: "Prove the integrations move landed with no observable change. Assumption A6's manual Electron pass is waived — see CLAUDE.md."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run server.test.js and the guards boundary suite and compare against the baseline table. Those two are the whole automated cover of this branch — the boundary suite reaches only its edge."
      - "Assumption A6's manual pass is waived: per CLAUDE.md (added after this task list was authored), Electron is not a supported release path and none is planned."
      - "Commit the stage as one commit."
    pattern: "No file changes. This task runs and compares."
    imports: "None."
    compatibility: "PLN-85-7knnfj Stage 6 observable and assumption A6."
    gotcha: "src/test/unit/server.test.js is the only automated cover of these route bodies, and the guards boundary suite reaches only the 405 at the branch edge. A green run here is weaker evidence than in any other stage, which is why the manual pass is required."
    verify:
      - "Run `npm run build`, then `node --test --test-force-exit dist/test/unit/server.test.js`. It must report `tests 10`, `pass 10`, `fail 0` — the 279fb26 figure."
      - "Run `node --test --test-force-exit dist/test/boundary/server-projects.test.js dist/test/boundary/server-board.test.js dist/test/boundary/server-guards.test.js`. It must report `tests 42`, `pass 42`, `fail 0`."
      - "Run `grep -rnE \"lib/(extract|detail|tree-layout|git)\\.js\" src/http/`. It must print nothing."
      - "Run `npm test 2>&1 | grep -E '^ℹ (tests|pass|fail)'`. It must report `tests 281`, `pass 280`, `fail 1`."
      - "Run `diff <(sed -E 's#dist/[^ ]*/##g' flowcharge/workstreams/WS-98-tbznpw-ports-and-adapters-refactor/baseline-279fb26-test-names.txt | sort) <(npm test 2>&1 | grep -E '^..(✔|✖)' | sed -E 's/ \\([0-9.]+m?s\\)$//; s/^..(✔|✖) //; s#dist/[^ ]*/##g' | sort)`. It must print nothing: the current run holds exactly the case names task 1.1 captured at 279fb26, ignoring order and any dist/ path prefix that moved. This is acceptance criterion 1's name half; the count steps above are its count half, and both must pass."
    checklist:
      - "Does server.test.js report the 279fb26 count of 10 passing cases?"
      - "Do the three HTTP boundary suites report 42 passing cases?"
      - "Was no assertion in any WS-97-7fvoc0 file edited?"
      - "Is electron/agentic-tools-ipc-handlers.cts still untouched?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 7. Stage 7 — CLI bootstrap port

  ```yaml
  description: "Add src/cli-bootstrap.ts behind a typed port and reduce the body tools/package-cli.mjs generates to the asset imports, one bootstrap call and the final dynamic server import. Last, because it is the only stage whose verification needs Bun on the host."
  ```

  - [ ] 7.1 Add `src/ports/cli-bootstrap.ts`

    ```yaml
    description: "Declare CliBootstrapInput and CliBootstrapResult, types only."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/ports/cli-bootstrap.ts holding exactly the two interfaces the plan declares: CliBootstrapInput with version, homeDir and env; and CliBootstrapResult with dataDir."
      - "Carry the plan's field comments across: version is injected at build time from package.json, homeDir is os.homedir(), and env is NodeJS.ProcessEnv mutated in place."
      - "Import nothing at runtime. NodeJS.ProcessEnv is an ambient type and needs no import."
    pattern: "src/ports/cli-bootstrap.ts, new file."
    imports: "None. Types only."
    compatibility: "PLN-85-7knnfj, Design, 'The four ports', src/ports/cli-bootstrap.ts subsection."
    gotcha: "env is mutated in place rather than returned. That is what lets the generated entry call applyCliDefaults as a statement whose effects are visible to the dynamically imported server; returning a new object instead would break the whole ordering contract."
    verify:
      - "Run `ls src/ports/cli-bootstrap.ts`. At 279fb26 it does not exist; after this task it must list."
      - "Run `grep -cE \"^import |node:fs|node:os|node:path\" src/ports/cli-bootstrap.ts`. It must return 0."
      - "Run `npm run build`. It must exit 0."
    checklist:
      - "Does CliBootstrapInput carry version, homeDir and env?"
      - "Does CliBootstrapResult carry dataDir?"
      - "Does the file import nothing?"
      - "Is the in-place mutation of env stated in a comment?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 7.2 Add `src/cli-bootstrap.ts` with `applyCliDefaults`

    ```yaml
    description: "Add the typed replacement for the generated environment lines, reproducing tools/package-cli.mjs:135-138 exactly."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/cli-bootstrap.ts exporting applyCliDefaults(input: CliBootstrapInput): CliBootstrapResult. It compiles to dist/cli-bootstrap.js."
      - "Reproduce the generated lines exactly as they stand at tools/package-cli.mjs:135-138 at 279fb26: an explicit emptiness test rather than ??= for both variables; PRAXIS_APP_VERSION defaulting to the injected version; PRAXIS_DATA_DIR defaulting to path.join(homeDir, '.flowcharge'); then a recursive fs.mkdirSync of the resolved directory."
      - "Return the resolved dataDir as CliBootstrapResult."
      - "The explicit emptiness test is load-bearing and its comment must survive: an environment variable set to '' is '', not undefined, and an explicit value must still win."
      - "Place this file at src/, not under src/lib/ or src/http/. dist/cli-bootstrap.js is what the generated entry imports."
    pattern: "src/cli-bootstrap.ts, new file."
    imports: "node:fs, node:path, and the CliBootstrapInput and CliBootstrapResult types from './ports/cli-bootstrap.js'."
    compatibility: "PLN-85-7knnfj, 'The CLI entry point'."
    gotcha: "The mkdirSync must be recursive and must run on the RESOLVED directory, whether it came from the environment or from the homeDir default. A packaged Bun executable resolves __dirname inside the read-only /$bunfs, so this directory is the only writable place the app has."
    verify:
      - "Run `ls src/cli-bootstrap.ts`. At 279fb26 it does not exist; after this task it must list."
      - "Run `npm run build`, then `ls dist/cli-bootstrap.js`. It must exist."
      - "Run `node -e \"const {applyCliDefaults}=await import('./dist/cli-bootstrap.js'); const env={}; const r=applyCliDefaults({version:'9.9.9',homeDir:process.env.TMPDIR||'/tmp',env}); console.log(env.PRAXIS_APP_VERSION, r.dataDir);\" --input-type=module`. It must print 9.9.9 and a path ending in /.flowcharge, and that directory must then exist. Remove it afterwards."
      - "Run `node -e \"const {applyCliDefaults}=await import('./dist/cli-bootstrap.js'); const env={PRAXIS_APP_VERSION:''}; applyCliDefaults({version:'9.9.9',homeDir:process.env.TMPDIR||'/tmp',env}); console.log(JSON.stringify(env.PRAXIS_APP_VERSION));\" --input-type=module`. It must print \"9.9.9\", proving the empty string falls through rather than winning."
    checklist:
      - "Are both defaults applied with an explicit emptiness test rather than ??=?"
      - "Does an environment variable set to '' fall through to the default?"
      - "Is the mkdirSync recursive and applied to the resolved directory?"
      - "Does the module compile to dist/cli-bootstrap.js at exactly that path?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 7.3 Reduce the body `tools/package-cli.mjs` generates

    ```yaml
    description: "Replace the generated environment lines with one applyCliDefaults call, keeping the three ordering rules the generated entry depends on."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In tools/package-cli.mjs, edit the entryLines array (lines 128-141 at 279fb26). Keep the asset imports first and static, so Bun embeds bytes rather than transformed code — the `with { type: 'file' }` attribute is what makes that work."
      - "Replace the node:fs / node:os / node:path imports and the four environment lines with a static import of applyCliDefaults from './cli-bootstrap.js' plus one call statement passing the injected version, os.homedir() and process.env. Keep node:os if homedir is still read in the generated body."
      - "The applyCliDefaults call must be a STATEMENT, so it runs before anything imports the server even though its own import is hoisted."
      - "Keep './server.js' as the final DYNAMIC import, so the environment is already in place when the server's module-scope constants evaluate."
      - "Change nothing else in this file. Target selection, the two guards, reading version, the Bun flags and the release/cli/ output naming all keep every responsibility they have."
    pattern: "tools/package-cli.mjs, the entryLines array only."
    imports: "None added to the script itself; the generated body imports applyCliDefaults from './cli-bootstrap.js'."
    compatibility: "PLN-85-7knnfj, 'The CLI entry point' — three ordering rules, none negotiable."
    gotcha: "dist/cli-bootstrap.js must exist before bun build runs. package:cli chains build:release, which now emits it, but a direct `node tools/package-cli.mjs` against a stale dist/ would fail at bundle time rather than at the existing guards. Consider whether guard 1's dist/public/ check needs a sibling, and if you add one, say so in self_eval — the plan does not ask for it."
    verify:
      - "Run `grep -c \"process.env.PRAXIS_DATA_DIR = path.join\" tools/package-cli.mjs`. At 279fb26 it returns 1. After this task it must return 0."
      - "Run `grep -c applyCliDefaults tools/package-cli.mjs`. At 279fb26 it returns 0. After this task it must return at least 1."
      - "Run `npm run package:cli`, then `grep -n \"await import\" dist/cli-entry.js`. The './server.js' dynamic import must be the last line of the generated file."
      - "Run `head -3 dist/cli-entry.js`. The first lines must still be static `with { type: 'file' }` asset imports."
    checklist:
      - "Are the asset imports still first and still static with the type attribute?"
      - "Is the applyCliDefaults call a statement rather than part of an import?"
      - "Is './server.js' still the final dynamic import?"
      - "Did target selection, the two guards, the version read, the Bun flags and the output naming all stay unchanged?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 7.4 Stage 7 gate

    ```yaml
    description: "Prove the packaged binary still behaves exactly as cli-binary.test.ts asserts, with PRAXIS_APP_VERSION and PRAXIS_DATA_DIR set and unset."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run `npm run package:cli` followed by the cli-binary boundary suite on a host with Bun on PATH."
      - "On a Node-only host the suite skips with its stated reason and the CI job stays green, exactly as it does today. This authoring host has Bun and the suite runs — see Divergence 2."
      - "Run the full suite once more and compare against the baseline table, closing the workstream."
      - "Commit the stage as one commit."
    pattern: "No file changes. This task runs and compares."
    imports: "None."
    compatibility: "PLN-85-7knnfj acceptance criterion 8, Stage 7 observable, and Testing strategy, 'Stage 7'."
    gotcha: "The suite covers all four cases acceptance criterion 8 names — /api/version, /api/projects and GET / answered by the binary, with PRAXIS_APP_VERSION and PRAXIS_DATA_DIR set and unset. A skip is not a pass; assert the case count."
    verify:
      - "Run `npm run package:cli`. It must exit 0 and write binaries under release/cli/."
      - "Run `node --test dist/test/boundary/cli-binary.test.js`. On this Bun-equipped host it must report `tests 7`, `pass 7`, `fail 0` — the 279fb26 figure from dist/cli-binary.test.js."
      - "Run `npm test 2>&1 | grep -E '^ℹ (tests|pass|fail|skipped)'`. It must report `tests 281`, `pass 280`, `fail 1`, `skipped 0` — the 279fb26 figures."
      - "Run `ls src/*.test.ts src/lib/*.test.ts 2>/dev/null | wc -l`. It must return 0; at 279fb26 it returns 24."
      - "Run `node -e \"import('./dist/lib/projects.js').then(m=>console.log(Object.keys(m).sort().join(',')))\"`. All six 279fb26 names must still be present, closing acceptance criterion 7."
      - "Run `diff <(sed -E 's#dist/[^ ]*/##g' flowcharge/workstreams/WS-98-tbznpw-ports-and-adapters-refactor/baseline-279fb26-test-names.txt | sort) <(npm test 2>&1 | grep -E '^..(✔|✖)' | sed -E 's/ \\([0-9.]+m?s\\)$//; s/^..(✔|✖) //; s#dist/[^ ]*/##g' | sort)`. It must print nothing: the current run holds exactly the case names task 1.1 captured at 279fb26, ignoring order and any dist/ path prefix that moved. This is acceptance criterion 1's name half; the count steps above are its count half, and both must pass."
    checklist:
      - "Does the cli-binary suite report 7 passing cases rather than skipping?"
      - "Does the full suite still report 281 / 280 / 1 / 0 with the same failing case name?"
      - "Does dist/lib/projects.js still export all six names?"
      - "Do dist/server.js, dist/lib/*.js and dist/public/* all still sit at their original paths?"
      - "Was no assertion in any WS-97-7fvoc0 file edited across the whole workstream?"
    self_eval:
      passed: false
      failures: []
    ```

## Divergences

1. **`npm test` is not green at `base_commit`.** The plan's Testing strategy says to capture `npm test`'s full output as the baseline and compare every later stage against it, and acceptance criterion 1 asks for "the same test names and the same pass count". It does not say the baseline is green, and it is not: at `279fb26`, after `npm run build`, `npm test` reports `tests 281`, `pass 280`, `fail 1`, `skipped 0` and exits `1`. The failing case is `getInstallContent installs the newest live release and returns the known 8 fc-* skills with fc-orchestrate's known nested files` in `dist/lib/skill-content-fetch.test.js`, which calls a fixed remote host that was unreachable from this machine at authoring time. Consequence: no task in this file uses `npm test`'s exit code as a verify step. Every full-suite step asserts the `281 / 280 / 1 / 0` counts and the identity of that one failing case instead. An executor who sees a green `npm test` should treat that as a changed baseline and re-derive the counts, not as a success.

2. **The `cli-binary` suite does not skip on this host.** The plan's Stage 7 and its Testing strategy both say the suite "skips there with its stated reason" on a Node-only host such as CI. At `279fb26` this authoring host has Bun on PATH at `/Users/akoukoullis/.bun/bin/bun`, and `node --test dist/cli-binary.test.js` reports `tests 7`, `pass 7`, `fail 0`, `skipped 0`. Consequence: tasks 1.5 and 7.4 assert 7 passing cases rather than a skip, and both name the Bun dependency so the same steps read correctly on a Node-only host, where a skip is the expected result.

3. **Stage 5 and Stage 6 disagree about where the integrations route bodies sit at the end of Stage 5.** The plan's Stage 5 observable says "`src/server.ts` holds no route handler", and acceptance criterion 4 says the same. But Stage 6 still owns moving the five `/api/integrations/*` routes into `src/http/routes-integrations.ts`, and Stage 5's own bullet list of moved routes names only projects, board, detail and version. The two cannot both hold unless the integrations bodies land somewhere in `src/http/` during Stage 5. Consequence: task 5.6 moves them into `src/http/create-server.ts` as a temporary home so Stage 5's observable is satisfiable, and task 6.1 lifts them out into `src/http/routes-integrations.ts`. Tasks 5.6, 5.7 and 6.1 each point at this entry. This reading was chosen because it is the only one that leaves both stages independently verifiable; it is raised as an open question rather than settled, and an executor told otherwise should follow the correction instead.

4. **The public-assets constant is named `root`, not `publicRoot`.** The plan's "The composition root" section calls it `publicRoot` and cites `src/server.ts:29`. At `279fb26` line 29 reads `const root = path.join(__dirname, 'public');`. The path and the derivation are exactly what the plan describes; only the identifier differs. Consequence: task 5.3's verify step greps for the `root` form and says what to do if the executor renames it to `publicRoot` while extracting the static-file module. No task is blocked.

Every other file the plan cites — `src/server.ts` at the line ranges named for `handleApi`, `permittedRootFor`, `createServer` and the three `__dirname`-derived paths; `src/lib/projects.ts:16,22-24,33`; `src/lib/tree-layout.ts:13-19`; `tools/package-cli.mjs:128-141` and `:135-138`; and `DEVELOPMENT.md` at lines 45, 82, 85-87 and 97-103 — matched the plan's description when read at `279fb26`.

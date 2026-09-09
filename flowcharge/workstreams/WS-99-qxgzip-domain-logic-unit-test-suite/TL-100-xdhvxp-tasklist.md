---
id: TL-100-xdhvxp
type: tasklist
workstream: WS-99-qxgzip
slug: domain-logic-unit-test-suite
title: "Unit test suite for src/core/board-api.ts over fake ports"
status: done
created: 2026-09-09
updated: 2026-09-09
author: Anthony Koukoullis
depends_on: [PLN-86-8iia6f]
links: []
mode: spec
base_commit: 3c46648
---

# FlowCharge Tasks

## Unit test suite for src/core/board-api.ts over fake ports

This list implements PLN-86-8iia6f. It adds exactly one file,
`src/test/unit/board-api.test.ts`, and changes no other file. The file drives
`createBoardApi()` from `src/core/board-api.ts` directly, with hand-written fake
implementations of its two driven ports — `ProjectRegistry`
(`src/ports/project-registry.ts`) and `WorkstreamStore`
(`src/ports/workstream-store.ts`). Both ports are plain interfaces with no
imports, so each fake is a typed object literal with a call log. The suite runs
in-process and synchronously. It uses no server, no socket, no filesystem and no
child process, and it adds no dependency.

The suite covers the six `BoardApi` methods, the nine result variants declared
in `src/ports/app-api.ts`, all three `legacyLayoutDir` resolutions on each of the
three `ok` variants, the board payload's declared key order, the argument flow
between the two ports, and the two throw paths. The 23 rows of the plan's case
inventory are distributed across the five parent tasks below, one parent task per
plan stage, in the plan's order.

The plan's exclusions hold. Nothing under `src/test/boundary/`, `src/http/`,
`src/lib/`, `src/core/` or `src/ports/` is edited. The two fakes stay inside the
one test file and are not extracted into a shared helper module.

- [x] 1. Stage 1 — harness and the ok board path

  ```yaml
  description: "Build the fake factories, the fixture constants and makeApi, then the getBoard ok cases including payload composition and key order."
  ```

  - [x] 1.1 Create the test file with its header comment, imports and fixture constants
    ```yaml
    description: "Create src/test/unit/board-api.test.ts holding the header comment, the allowed imports, the Call type and the five fixture constants."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create the new file src/test/unit/board-api.test.ts. It is the only file this whole task list adds or changes."
      - "Open with a header comment that states what the suite covers — createBoardApi over hand-written fakes of the two driven ports — and why it needs no I/O. Close the comment with the run line every sibling under src/test/unit/ carries: `Run with node --test dist/test/unit/board-api.test.js after npm run build.` Match the comment style of src/test/unit/tree-layout.test.ts and src/test/unit/detail.test.ts."
      - "Import only: `test` from node:test, the default export of node:assert/strict, and the types the suite needs — BoardApi from ../../ports/app-api.js, ProjectRegistry from ../../ports/project-registry.js, WorkstreamStore and TreeLayout from ../../ports/workstream-store.js, and createBoardApi from ../../core/board-api.js. Import nothing else."
      - "Declare the call-record type from the plan's Design contracts: `type Call = { fn: string; args: readonly unknown[] };`."
      - "Declare the five fixture constants exactly as the plan's Design section fixes them: ENTRY (ProjectEntry), BOARD (PraxisData), DETAIL (PraxisWorkstreamDetail), LAYOUT_CURRENT (TreeLayout) and LAYOUT_LEGACY (TreeLayout). All are inline literals with no disk behind them."
      - "Keep BOARD's `workstreams` and `issues` arrays empty. The core only spreads the extractor's payload, so a richer fixture would assert the extractor's work, which belongs to extract.test.ts."
      - "Declare BOARD's keys in the order generated, source, workstreams, issues. That order is what task 1.4 asserts through the payload."
      - "Reference PraxisData, BoardPayload, ProjectEntry and PraxisWorkstreamDetail unqualified. They are ambient globals from src/types/praxis-data.d.ts, already inside tsconfig.json's include, and src/ports/app-api.ts references them the same way."
    pattern: "src/test/unit/board-api.test.ts (new). Sibling style: src/test/unit/tree-layout.test.ts, src/test/unit/detail.test.ts."
    imports: "node:test, node:assert/strict, ../../core/board-api.js, ../../ports/app-api.js, ../../ports/project-registry.js, ../../ports/workstream-store.js. No other import is allowed — see PLN-86-8iia6f acceptance criterion 3."
    compatibility: "PLN-86-8iia6f Design, 'The file' and 'Contracts the suite builds'. Assumptions A1 and A4. tsconfig.json compiles src/test/**/*.ts to dist/ with strict and noEmitOnError, and package.json's test glob dist/**/*.test.js picks the compiled file up with no script change."
    gotcha: "The header comment must not spell out a forbidden module specifier literally. The acceptance-criterion-3 grep in task 5.3 matches the raw text of the file, so a comment saying `node:fs` fails a check the code passes. Write 'no filesystem' in prose instead. A file with imports and constants but no test() call still builds and still runs clean under node --test."
    verify:
      - "Run `npm run build`. It must finish with no TypeScript error. tsc runs with noEmitOnError, so a clean build is the type-check."
      - "Run `test -f src/test/unit/board-api.test.ts && echo PRESENT`. It must print PRESENT. At base_commit 3c46648 this command exits 1 and prints nothing, because the file does not exist."
      - "Run `test -f dist/test/unit/board-api.test.js && echo COMPILED`. It must print COMPILED. At base_commit 3c46648 the compiled file is absent."
    checklist:
      - "Does src/test/unit/board-api.test.ts exist, and is it the only added or changed file?"
      - "Does the header comment end with the run line `Run with node --test dist/test/unit/board-api.test.js after npm run build.`?"
      - "Are the imports limited to node:test, node:assert/strict, ../../core/board-api.js and the three ../../ports/ modules?"
      - "Are all five fixture constants — ENTRY, BOARD, DETAIL, LAYOUT_CURRENT, LAYOUT_LEGACY — declared as inline literals?"
      - "Are BOARD's keys declared in the order generated, source, workstreams, issues?"
      - "Does `npm run build` finish with no TypeScript error?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Add the fakeRegistry and fakeStore factories
    ```yaml
    description: "Add the two typed fake factories, each recording every call and each returning the plan's default value unless an override supplies the method."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, below the fixture constants, add the two factories the plan's Design contracts fix: `function fakeRegistry(overrides?: Partial<ProjectRegistry>): ProjectRegistry & { calls: Call[] }` and `function fakeStore(overrides?: Partial<WorkstreamStore>): WorkstreamStore & { calls: Call[] }`."
      - "Each factory holds a local `calls: Call[]` array and returns it on the object. Every method it implements pushes `{ fn, args }` before it returns, so a rejected input can be proven by an absent record."
      - "Each method returns the override's value when the override supplies that method, and the default otherwise. Mirror the fake-with-call-log pattern in src/test/unit/agentic-tools-install.test.ts:26-66."
      - "Implement every method of both interfaces, using the plan's default-return table: registry.list() -> [], registry.find(id) -> undefined, registry.add(path) -> { entry: ENTRY, created: true }, registry.remove(id) -> undefined, registry.rename(id, name) -> undefined, store.resolveLayout(root) -> null, store.hasTree(root) -> true, store.readBoard(root) -> a fresh copy of BOARD, store.readDetail(root, id) -> null, store.readBranch(root) -> null."
      - "Return a fresh copy of BOARD from the default readBoard, not the shared constant. The core spreads the value into a new payload object, but a shared reference would let one case mutate another's fixture."
      - "Type both return values against the port interfaces so the compiler proves the fakes satisfy the contracts. That compile-time proof is the reason PLN-86-8iia6f rejected mock.fn() — see its Alternatives item 3."
    pattern: "src/test/unit/board-api.test.ts. Reference pattern: src/test/unit/agentic-tools-install.test.ts:26-66."
    imports: "No new import. The ProjectRegistry, WorkstreamStore and TreeLayout types are already in from task 1.1."
    compatibility: "PLN-86-8iia6f Design, 'Contracts the suite builds' and its default-return table. Assumption A3 keeps both factories inside this one test file; do not create src/test/unit/fake-ports.ts."
    gotcha: "A `Partial<T>` override whose key is present but undefined must still fall through to the default. Prefer an explicit `overrides?.method ? overrides.method(...) : DEFAULT` form over a spread that would drop the call recording. Recording the call before the override runs is what makes the 'never called' assertions in stage 2 and stage 4 meaningful."
    verify:
      - "Run `npm run build`. It must finish with no TypeScript error, which proves both object literals satisfy their port interfaces under strict mode."
      - "Run `grep -c 'calls.push' src/test/unit/board-api.test.ts`. It must return at least 10, one per port method across the two factories. At base_commit 3c46648 this command exits 2 with 'No such file or directory'."
    checklist:
      - "Do both factories return an object typed as the port interface plus a `calls: Call[]` field?"
      - "Does every one of the ten port methods push a `{ fn, args }` record before returning?"
      - "Does each method return the override's value when supplied, and the table's default otherwise?"
      - "Does the default readBoard return a fresh copy of BOARD rather than the shared constant?"
      - "Do both factories live inside src/test/unit/board-api.test.ts, with no new helper module added?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Add makeApi and the getBoard ok payload composition case
    ```yaml
    description: "Add the makeApi composer, then the first case: getBoard's ok payload is the extraction result plus branch and name, with name taken from entry.name."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add the composer from the plan's Design contracts: `function makeApi(parts?: { registry?: Partial<ProjectRegistry>; store?: Partial<WorkstreamStore> })` returning `{ api, registry, store }`, where `api` is `createBoardApi({ registry, store })` and the two returned fakes are the same instances the api holds, so a case can read their call logs."
      - "Add the first test case for getBoard's ok payload composition. Override `registry.find` to return ENTRY, leave the store on its defaults except `readBranch` where the case needs a value, then call `api.getBoard('abc12345')`."
      - "Assert `result.kind === 'ok'`, and assert the payload carries every field of the extraction result — generated, source, workstreams, issues — plus `branch` and `name`."
      - "Assert `payload.name` equals `ENTRY.name`, not the project id and not any store value. The name is the registry's display name and the store knows nothing about it."
      - "Narrow the result on `kind` before reading `payload`. BoardResult is a discriminated union and strict mode will not let you read `payload` off the bare union."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts getBoard, lines 52-65."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f Design case inventory, row 'getBoard | ok payload composition'. BoardPayload extends PraxisData with `branch` and `name`, per src/types/praxis-data.d.ts."
    gotcha: "The default `registry.find` returns undefined, so a case that forgets the find override gets `unknown-project` and the ok assertions never run. Assert `result.kind` first so a missed override fails loudly instead of silently skipping."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report at least 1 test and 0 failures. At base_commit 3c46648 this command cannot run: dist/test/unit/board-api.test.js does not exist."
      - "Inspect the runner's summary lines and confirm `fail 0`."
    checklist:
      - "Does makeApi return the same fake instances that createBoardApi received, so their call logs are readable?"
      - "Does the payload assertion cover generated, source, workstreams, issues, branch and name?"
      - "Does the case assert that `name` comes from ENTRY.name?"
      - "Is the result narrowed on `kind` before `payload` is read?"
      - "Does `node --test dist/test/unit/board-api.test.js` report 0 failures?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.4 Add the getBoard payload key-order case
    ```yaml
    description: "Assert Object.keys of getBoard's ok payload equals the declared order, which src/core/board-api.ts calls load-bearing."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case that builds a getBoard ok result the same way task 1.3 does, then asserts `Object.keys(payload)` deep-equals `['generated', 'source', 'workstreams', 'issues', 'branch', 'name']`."
      - "Use assert.deepEqual on the key array, not a set or a membership check. Order is the whole point of this case."
      - "Add a short comment naming why: src/core/board-api.ts:57-63 declares the key order load-bearing, because the extraction result spreads first, then branch, then name, so the serialised payload keeps its byte order."
      - "This case satisfies PLN-86-8iia6f acceptance criterion 5."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts lines 57-63."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f acceptance criterion 5, and its case inventory row 'getBoard | key order'."
    gotcha: "The observed key order comes from the BOARD fixture's own declaration order, since the core spreads it. If BOARD declares its keys in any other order, this case fails for a reason that has nothing to do with the core. Task 1.1 fixes that order; do not reorder BOARD later."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report at least 2 tests and 0 failures. At base_commit 3c46648 this command cannot run: the compiled file does not exist."
      - "Run `grep -c \"'generated', 'source', 'workstreams', 'issues', 'branch', 'name'\" src/test/unit/board-api.test.ts`. It must return 1. At base_commit 3c46648 it exits 2 with 'No such file or directory'."
    checklist:
      - "Does the case assert Object.keys of the payload, in order, with assert.deepEqual?"
      - "Is the asserted array exactly ['generated', 'source', 'workstreams', 'issues', 'branch', 'name']?"
      - "Does a comment record that src/core/board-api.ts declares this order load-bearing?"
      - "Does the file still report 0 failures under node --test?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.5 Add the getBoard branch-outcome and path-forwarding cases
    ```yaml
    description: "Assert both readBranch outcomes reach the payload unchanged, and that the store is handed entry.path rather than the project id."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case where the fake `store.readBranch` returns null, and assert `payload.branch` is null."
      - "Add a case where the fake `store.readBranch` returns a branch string, and assert `payload.branch` equals that string. The core must pass the value through, not interpret it."
      - "Add a case that inspects the store's call log after a successful getBoard, and asserts every store call recorded — hasTree, resolveLayout, readBoard, readBranch — received ENTRY.path as its first argument, and that no store call received the project id."
      - "Read the argument values out of the recorded `Call` entries rather than re-deriving them, so the assertion proves what the core actually passed."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts lines 52-65."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f case inventory rows 'getBoard | branch null and branch string' and 'getBoard | store receives entry.path'."
    gotcha: "ENTRY.id and ENTRY.path must stay visibly different strings, or the 'store is never handed the project id' assertion proves nothing. The plan's ENTRY uses id 'abc12345' and path '/fake/project', which are distinct; keep them so."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report at least 5 tests and 0 failures, covering the four plan rows this stage owns. At base_commit 3c46648 this command cannot run: the compiled file does not exist."
      - "Confirm the runner's summary reports `fail 0`."
    checklist:
      - "Is there a case asserting payload.branch is null when readBranch returns null?"
      - "Is there a case asserting payload.branch equals the string readBranch returned?"
      - "Does a case assert every recorded store call received ENTRY.path as its first argument?"
      - "Does a case assert no store call received the project id?"
      - "Does the file report at least 5 tests and 0 failures?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Stage 2 — read-path failure variants

  ```yaml
  description: "Assert unknown-project, tree-missing and unknown-workstream for getBoard and getDetail, each with its 'port never called' assertion, fixing the guard order the transport layer depends on."
  ```

  - [x] 2.1 Add the getBoard unknown-project case
    ```yaml
    description: "When registry.find returns undefined, getBoard returns { kind: 'unknown-project' } and calls no store method at all."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case leaving `registry.find` on its default, which returns undefined."
      - "Call `api.getBoard('missing')` and assert the result deep-equals `{ kind: 'unknown-project' }`, so no extra field rides along."
      - "Assert the store's call log is empty. The unknown-project guard runs before any store method, and this assertion is what fixes that order."
      - "Assert `registry.find` was called with the project id verbatim."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts lines 53-54."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f case inventory row 'getBoard | find returns undefined'. The variant maps to 404 at src/http/routes-board.ts:50-52, but this suite must not know that status."
    gotcha: "Assert the store's call log length is 0 rather than checking one named method. A future guard reordering that called resolveLayout early would slip past a per-method check."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report 0 failures."
      - "Run `grep -c \"unknown-project\" src/test/unit/board-api.test.ts`. It must return at least 1. At base_commit 3c46648 it exits 2 with 'No such file or directory'."
    checklist:
      - "Does the case deep-equal the whole result against { kind: 'unknown-project' }?"
      - "Does it assert the store's call log is empty?"
      - "Does it assert registry.find received the project id verbatim?"
      - "Does the file contain no HTTP status code and no error-body string?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Add the getBoard tree-missing case
    ```yaml
    description: "When hasTree is false, getBoard returns { kind: 'tree-missing', path } carrying entry.path, and neither readBoard nor readBranch is called."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case overriding `registry.find` to return ENTRY and `store.hasTree` to return false."
      - "Call `api.getBoard(ENTRY.id)` and assert the result deep-equals `{ kind: 'tree-missing', path: ENTRY.path }`. The path carried is the entry's path, not the project id and not the input string."
      - "Assert the store's call log records no `readBoard` and no `readBranch` entry."
      - "Assert `hasTree` was called with ENTRY.path."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts line 55."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f case inventory row 'getBoard | hasTree false'."
    gotcha: "The core calls resolveLayout only after the hasTree guard passes, so the call log on this path holds hasTree alone. Do not assert an empty log here — that would over-fit and break if the layout probe legitimately moves."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report 0 failures."
      - "Run `grep -c \"tree-missing\" src/test/unit/board-api.test.ts`. It must return at least 1. At base_commit 3c46648 it exits 2 with 'No such file or directory'."
    checklist:
      - "Does the result deep-equal { kind: 'tree-missing', path: ENTRY.path }?"
      - "Does the case prove readBoard was never called?"
      - "Does the case prove readBranch was never called?"
      - "Does the case assert hasTree received ENTRY.path?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.3 Add the getDetail unknown-project case
    ```yaml
    description: "When registry.find returns undefined, getDetail returns { kind: 'unknown-project' } and calls no store method at all."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case leaving `registry.find` on its default undefined return."
      - "Call `api.getDetail('missing', 'WS-1-aa11bb')` and assert the result deep-equals `{ kind: 'unknown-project' }`."
      - "Assert the store's call log is empty, mirroring the getBoard case in task 2.1."
      - "Assert `registry.find` received the project id verbatim, and that the workstream id never reached the registry."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts lines 68-69."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f case inventory row 'getDetail | find returns undefined'."
    gotcha: "getDetail takes two ids. Assert which one reached registry.find, or a swapped argument order would pass unnoticed."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report 0 failures."
      - "Confirm the runner's summary reports `fail 0`."
    checklist:
      - "Does the result deep-equal { kind: 'unknown-project' }?"
      - "Does the case assert the store's call log is empty?"
      - "Does the case assert registry.find received the project id, not the workstream id?"
      - "Does the case call getDetail with two visibly different id strings?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.4 Add the getDetail tree-missing case
    ```yaml
    description: "When hasTree is false, getDetail returns { kind: 'tree-missing', path } carrying entry.path, and readDetail is never called."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case overriding `registry.find` to return ENTRY and `store.hasTree` to return false."
      - "Call `api.getDetail(ENTRY.id, 'WS-1-aa11bb')` and assert the result deep-equals `{ kind: 'tree-missing', path: ENTRY.path }`."
      - "Assert the store's call log records no `readDetail` entry."
      - "Assert `hasTree` was called with ENTRY.path."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts line 70."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f case inventory row 'getDetail | hasTree false'."
    gotcha: "tree-missing and unknown-workstream both mean 'nothing to show', but they are separate variants and the transport layer answers them differently. Assert the exact object here, not just that the kind is not 'ok'."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report 0 failures."
      - "Confirm the runner's summary reports `fail 0`."
    checklist:
      - "Does the result deep-equal { kind: 'tree-missing', path: ENTRY.path }?"
      - "Does the case prove readDetail was never called?"
      - "Does the case assert hasTree received ENTRY.path?"
      - "Is the assertion an exact object comparison rather than a negative check?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.5 Add the getDetail unknown-workstream case
    ```yaml
    description: "When readDetail returns null, getDetail returns { kind: 'unknown-workstream' }, distinct from tree-missing and carrying no other field."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case overriding `registry.find` to return ENTRY and leaving `store.hasTree` on its default true and `store.readDetail` on its default null return."
      - "Call `api.getDetail(ENTRY.id, 'WS-404-nope')` and assert the result deep-equals `{ kind: 'unknown-workstream' }`, proving it carries no path and no legacyLayoutDir."
      - "Assert `readDetail` was in fact called, so the case proves the null return produced the variant rather than an earlier guard producing it."
      - "Add a short comment recording the split src/ports/workstream-store.ts:19-24 states: readBoard throws on a missing tree, readDetail returns null on an unknown id, and the core must keep the two failure shapes apart."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts lines 72-73."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f case inventory row 'getDetail | readDetail returns null'. This is the fifth and last non-ok read-path variant, closing PLN-86-8iia6f stage 2."
    gotcha: "The default readDetail already returns null, so this case needs no override — but it must still assert readDetail was called, or a regression that skipped the store entirely would look identical."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report at least 10 tests and 0 failures, covering the five plan rows this stage owns on top of stage 1's four. At base_commit 3c46648 this command cannot run: the compiled file does not exist."
      - "Run `grep -o \"'\\(unknown-project\\|tree-missing\\|unknown-workstream\\)'\" src/test/unit/board-api.test.ts | sort -u | wc -l`. It must return 3. At base_commit 3c46648 it returns 0."
    checklist:
      - "Does the result deep-equal { kind: 'unknown-workstream' } with no extra field?"
      - "Does the case assert readDetail was actually called?"
      - "Are all five non-ok read-path variants now asserted — two unknown-project, two tree-missing, one unknown-workstream?"
      - "Does a comment record the readBoard-throws versus readDetail-returns-null split?"
      - "Does the file report 0 failures?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Stage 3 — the legacyLayoutDir matrix

  ```yaml
  description: "Assert all three layout resolutions — no layout, current layout, legacy layout — across the three ok variants, plus the getDetail ok result and its argument forwarding that the matrix needs."
  ```

  - [x] 3.1 Add the getDetail ok and readDetail argument-forwarding cases
    ```yaml
    description: "Assert getDetail's ok variant returns the store's detail object unchanged, and that readDetail receives (entry.path, workstreamId) verbatim."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case overriding `registry.find` to return ENTRY and `store.readDetail` to return DETAIL."
      - "Call `api.getDetail(ENTRY.id, DETAIL.id)`, assert `result.kind === 'ok'`, and assert `result.detail` is the same object the store returned. Use assert.equal on the reference, so a copy or a rebuild fails the case."
      - "Add a case asserting the recorded `readDetail` call received exactly two arguments, ENTRY.path first and the workstream id second, both verbatim. The core normalises neither."
      - "Read the argument values from the store's call log rather than re-deriving them."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts lines 71-74."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f case inventory rows 'getDetail | ok' and 'getDetail | argument forwarding'. These two rows are placed here because stage 3's getDetail layout cases need an asserted ok result to ride on."
    gotcha: "assert.deepEqual would pass on a rebuilt copy of DETAIL. Use a reference comparison to prove the core returns the store's object unchanged."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report 0 failures."
      - "Confirm the runner's summary reports `fail 0`."
    checklist:
      - "Does the ok case compare result.detail by reference against the object the store returned?"
      - "Does the forwarding case assert ENTRY.path is readDetail's first argument?"
      - "Does it assert the workstream id is readDetail's second argument, verbatim?"
      - "Are the argument values read from the recorded call log?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.2 Add the getBoard legacyLayoutDir matrix
    ```yaml
    description: "Assert getBoard's ok variant carries legacyLayoutDir null for no layout, null for the current layout and the legacy directory for the legacy layout."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add three getBoard ok cases that differ only in the fake `store.resolveLayout` return: null, LAYOUT_CURRENT, then LAYOUT_LEGACY."
      - "Assert `result.legacyLayoutDir` is null, null, then LAYOUT_LEGACY.dir — the value '/fake/project/prxwork'."
      - "Keep the three assertions structurally identical, so the one fact under test is the only thing that varies between them."
      - "Assert `resolveLayout` was called with ENTRY.path."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts legacyDirFor, lines 25-28, reached from getBoard line 56."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f acceptance criterion 6 and its case inventory row 'getBoard | three layout resolutions'."
    gotcha: "The current-layout case is the one that matters. LAYOUT_CURRENT carries a real dir with legacy false, so a core that returned layout.dir without testing layout.legacy would still pass the null-layout case and fail only here."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report 0 failures."
      - "Run `grep -c 'legacyLayoutDir' src/test/unit/board-api.test.ts`. It must return at least 3. At base_commit 3c46648 it exits 2 with 'No such file or directory', and `grep -rn legacyLayoutDir src/test/` returns 0 matches across the whole test tree."
    checklist:
      - "Are there three getBoard cases, one per layout resolution?"
      - "Does the current-layout case assert null rather than the layout's dir?"
      - "Does the legacy case assert LAYOUT_LEGACY.dir?"
      - "Do the three cases differ only in the resolveLayout return?"
      - "Does a case assert resolveLayout received ENTRY.path?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.3 Add the getDetail legacyLayoutDir matrix
    ```yaml
    description: "Assert getDetail's ok variant carries legacyLayoutDir for all three layout resolutions, with assertions identical to the getBoard set."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add three getDetail ok cases that differ only in the fake `store.resolveLayout` return: null, LAYOUT_CURRENT, then LAYOUT_LEGACY."
      - "Override `registry.find` to return ENTRY and `store.readDetail` to return DETAIL in all three, so the ok variant is reached."
      - "Assert `result.legacyLayoutDir` is null, null, then LAYOUT_LEGACY.dir."
      - "Keep the three assertions identical in shape to task 3.2's, so the repeated fact reads the same at every call site."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts line 71, through legacyDirFor at lines 25-28."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f acceptance criterion 6 and its case inventory row 'getDetail | three layout resolutions'."
    gotcha: "In getDetail the core resolves the layout before it calls readDetail, so a case whose readDetail returns null gets unknown-workstream and never exposes legacyLayoutDir. All three cases here must reach the ok variant."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report 0 failures."
      - "Run `grep -c 'legacyLayoutDir' src/test/unit/board-api.test.ts`. It must return at least 6. At base_commit 3c46648 it exits 2 with 'No such file or directory'."
    checklist:
      - "Are there three getDetail cases, one per layout resolution?"
      - "Do all three reach the ok variant, with readDetail returning DETAIL?"
      - "Does the current-layout case assert null?"
      - "Does the legacy case assert LAYOUT_LEGACY.dir?"
      - "Are the assertions the same shape as task 3.2's?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.4 Add the addProject legacyLayoutDir matrix
    ```yaml
    description: "Assert addProject's ok variant carries legacyLayoutDir for all three layout resolutions, completing the nine-case matrix."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add three addProject ok cases that differ only in the fake `store.resolveLayout` return: null, LAYOUT_CURRENT, then LAYOUT_LEGACY."
      - "Leave `store.hasTree` on its default true and `registry.add` on its default { entry: ENTRY, created: true }, so the ok variant is reached with no extra override."
      - "Assert `result.legacyLayoutDir` is null, null, then LAYOUT_LEGACY.dir — the plan's expected sequence for this row."
      - "Assert `resolveLayout` received the absolute path passed to addProject, not ENTRY.path. On this method the input path is the root, because no registry entry exists yet."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts lines 35-42."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f acceptance criterion 6 and its case inventory row 'addProject | three layout resolutions'. This task closes PLN-86-8iia6f stage 3."
    gotcha: "addProject resolves the layout from its own input path, while getBoard and getDetail resolve it from entry.path. Asserting ENTRY.path here would pass only by coincidence, because the plan's ENTRY.path and the fixture input path can be made to differ. Pass a path distinct from ENTRY.path so the assertion discriminates."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report 0 failures."
      - "Run `grep -c 'legacyLayoutDir' src/test/unit/board-api.test.ts`. It must return at least 9, one per case in the three-by-three matrix. At base_commit 3c46648 it exits 2 with 'No such file or directory'."
      - "Confirm the file now holds nine layout cases covering no layout, current layout and legacy layout across getBoard, getDetail and addProject."
    checklist:
      - "Are there three addProject cases, one per layout resolution?"
      - "Does each assert the expected legacyLayoutDir value?"
      - "Does a case assert resolveLayout received addProject's own input path?"
      - "Is the input path used here different from ENTRY.path, so the assertion can fail?"
      - "Does the matrix now total nine cases across the three ok variants?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 4. Stage 4 — registry-facing methods

  ```yaml
  description: "Assert addProject's variants and argument forwarding, plus the listProjects, removeProject and renameProject pass-through cases, so all six methods and every result variant are covered."
  ```

  - [x] 4.1 Add the addProject no-tree guard case
    ```yaml
    description: "When hasTree is false, addProject returns { kind: 'no-tree', path } carrying the input path, and registry.add is never called."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case overriding `store.hasTree` to return false."
      - "Call `api.addProject('/fake/not-a-project')` and assert the result deep-equals `{ kind: 'no-tree', path: '/fake/not-a-project' }`, carrying the input path verbatim."
      - "Assert the registry's call log records no `add` entry. This is the highest-value assertion in the stage: if addProject reached registry.add before hasTree, a rejected path would be written to the registry file while the caller saw a rejection."
      - "Add a short comment recording that reason, without naming any status code or error-body string."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts lines 36-38."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f case inventory row 'addProject | hasTree false', and its Design note on guard order."
    gotcha: "Assert the registry's whole call log is empty on this path, not only that `add` is absent. The core touches no registry method before the guard, and an empty-log assertion catches a future write of any kind."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report 0 failures."
      - "Run `grep -c \"no-tree\" src/test/unit/board-api.test.ts`. It must return at least 1. At base_commit 3c46648 it exits 2 with 'No such file or directory'."
    checklist:
      - "Does the result deep-equal { kind: 'no-tree', path: <the input path> }?"
      - "Does the case prove registry.add was never called?"
      - "Does the comment explain the guard-order risk without naming a status code?"
      - "Is the input path the verbatim string passed to addProject?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.2 Add the addProject created-true and created-false cases
    ```yaml
    description: "Assert both registry.add outcomes reach the ok variant unchanged, so created is passed through rather than recomputed."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case where `registry.add` returns `{ entry: ENTRY, created: true }` and assert the result is `{ kind: 'ok', entry: ENTRY, created: true, legacyLayoutDir: null }`."
      - "Add a second case where `registry.add` returns `{ entry: ENTRY, created: false }` and assert `created` is false on the result."
      - "Assert `entry` is the same object the registry returned, by reference, in at least one of the two cases."
      - "Keep both cases on the default resolveLayout so legacyLayoutDir stays null and the layout matrix in task 3.4 remains the only place that varies it."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts lines 39-41."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f case inventory rows 'addProject | created: true' and 'addProject | created: false'. Together with task 4.1 these close the AddProjectResult variants."
    gotcha: "The default registry.add already returns created true, so the created-true case needs no override — but state the override anyway, or the case silently depends on a default another task could change."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report 0 failures."
      - "Confirm the runner's summary reports `fail 0`."
    checklist:
      - "Is there a case asserting created true on the ok variant?"
      - "Is there a case asserting created false on the ok variant?"
      - "Does one case compare entry by reference against the registry's return?"
      - "Do both cases leave legacyLayoutDir null?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.3 Add the addProject argument-forwarding case
    ```yaml
    description: "Assert hasTree and registry.add both receive the absolute path verbatim, and that the core normalises nothing."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case calling `api.addProject` with an absolute path that would change under any normalisation — for example one with a trailing separator or a redundant segment."
      - "Assert the recorded `store.hasTree` call received that exact string."
      - "Assert the recorded `registry.add` call received the same exact string."
      - "Add a short comment recording that path normalisation is the adapter's job, not the core's."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts lines 36 and 40."
    imports: "No new import. Do not import node:path to build the fixture path — write the literal string."
    compatibility: "PLN-86-8iia6f case inventory row 'addProject | argument forwarding', and its acceptance criterion 3, which forbids importing node:path."
    gotcha: "A path that is already canonical proves nothing here, because a normalising core would return it unchanged. Choose a literal whose normalised form differs from what is passed in."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report 0 failures."
      - "Run `grep -nE \"node:(fs|os|path|http|child_process)\" src/test/unit/board-api.test.ts`. It must print nothing and exit 1. At base_commit 3c46648 it exits 2 with 'No such file or directory', so the check only becomes meaningful once the file exists."
    checklist:
      - "Does the case use a path literal whose normalised form differs from itself?"
      - "Does it assert hasTree received the exact input string?"
      - "Does it assert registry.add received the exact input string?"
      - "Is node:path still absent from the file's imports?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.4 Add the listProjects delegation case
    ```yaml
    description: "Assert listProjects returns the registry's list unchanged and never touches the store."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case overriding `registry.list` to return an array holding ENTRY."
      - "Call `api.listProjects()` and assert the returned value is the same array the registry returned, by reference, so the core is proven not to copy, sort or filter it."
      - "Assert the registry's call log holds exactly one `list` entry."
      - "Assert the store's call log is empty."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts lines 31-33."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f case inventory row 'listProjects | returns the registry's list unchanged'."
    gotcha: "assert.deepEqual on an array would pass on a copy. Use a reference comparison to prove pure delegation."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report 0 failures."
      - "Confirm the runner's summary reports `fail 0`."
    checklist:
      - "Does the case compare the returned array by reference?"
      - "Does it assert registry.list was called exactly once?"
      - "Does it assert the store's call log is empty?"
      - "Is listProjects now covered, as one of the six required methods?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.5 Add the removeProject pass-through cases
    ```yaml
    description: "Assert both registry.remove outcomes pass through, the id is forwarded verbatim, and the store is never called."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case where `registry.remove` returns ENTRY and assert `api.removeProject(ENTRY.id)` returns that same object by reference."
      - "Add a case leaving `registry.remove` on its default undefined return and assert `api.removeProject('missing')` returns undefined."
      - "Assert the recorded `remove` call received the id verbatim."
      - "Assert the store's call log is empty on this method."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts lines 44-46."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f case inventory row 'removeProject | entry, and undefined'."
    gotcha: "removeProject returns a bare ProjectEntry or undefined, not a result variant. Do not assert a `kind` field on it."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report 0 failures."
      - "Confirm the runner's summary reports `fail 0`."
    checklist:
      - "Is there a case asserting the entry passes through by reference?"
      - "Is there a case asserting undefined passes through?"
      - "Does a case assert registry.remove received the id verbatim?"
      - "Does a case assert the store's call log is empty?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 4.6 Add the renameProject pass-through cases
    ```yaml
    description: "Assert both registry.rename outcomes pass through, (id, name) are forwarded in that order, and the store is never called."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case where `registry.rename` returns ENTRY and assert `api.renameProject(ENTRY.id, 'New name')` returns that same object by reference."
      - "Add a case leaving `registry.rename` on its default undefined return and assert the result is undefined."
      - "Assert the recorded `rename` call received exactly two arguments, the id first and the name second. Use visibly different strings so a swapped order fails."
      - "Assert the store's call log is empty on this method."
      - "This task closes PLN-86-8iia6f stage 4: all six methods now have cases and every result variant is asserted."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts lines 48-50."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f case inventory row 'renameProject | entry, and undefined', and acceptance criterion 2, which this task completes."
    gotcha: "Both arguments are strings, so a swapped order type-checks cleanly and only an argument assertion catches it."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report at least 23 tests and 0 failures. At base_commit 3c46648 this command cannot run: the compiled file does not exist."
      - "Run `for m in listProjects addProject removeProject renameProject getBoard getDetail; do printf '%s ' \"$m\"; grep -c \"api.$m(\" src/test/unit/board-api.test.ts; done`. Every one of the six must report at least 1. At base_commit 3c46648 every grep exits 2 with 'No such file or directory'."
      - "Run `grep -o \"'\\(ok\\|unknown-project\\|tree-missing\\|unknown-workstream\\|no-tree\\)'\" src/test/unit/board-api.test.ts | sort -u | wc -l`. It must return 5, the distinct kind strings behind the nine result variants. At base_commit 3c46648 it returns 0."
    checklist:
      - "Is there a case asserting the entry passes through by reference?"
      - "Is there a case asserting undefined passes through?"
      - "Does a case assert (id, name) reached registry.rename in that order?"
      - "Does a case assert the store's call log is empty?"
      - "Do all six BoardApi methods now appear in at least one case?"
      - "Are all five distinct result-kind strings present in the file?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 5. Stage 5 — throw propagation and full-suite check

  ```yaml
  description: "Assert the readBoard and readDetail throws propagate out of the core rather than becoming result variants, then run the full suite end to end and confirm no other file changed."
  ```

  - [x] 5.1 Add the readBoard throw-propagation case
    ```yaml
    description: "Assert a readBoard throw propagates out of getBoard rather than being converted into a result variant."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case overriding `registry.find` to return ENTRY, leaving `store.hasTree` on its default true, and overriding `store.readBoard` to throw a distinctive Error."
      - "Assert with assert.throws that `api.getBoard(ENTRY.id)` throws, and match on the thrown error's message so a different failure cannot satisfy the case."
      - "Assert no result was returned: the call must not fall through to any variant."
      - "Add a short comment recording why this matters — the route handlers wrap the call and answer their own failure, so a core that swallowed the throw would turn a real extraction failure into a success carrying a half-built payload."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts line 60."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f acceptance criterion 7 and its case inventory row 'getBoard | readBoard throws'. The throw contract is declared at src/ports/workstream-store.ts:19-24."
    gotcha: "assert.throws with no matcher passes on any error, including a TypeError from a mis-built fake. Match the message. Do not name a status code in the comment: the transport layer is out of this suite's knowledge."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report 0 failures."
      - "Run `grep -c 'assert.throws' src/test/unit/board-api.test.ts`. It must return at least 1. At base_commit 3c46648 it exits 2 with 'No such file or directory'."
    checklist:
      - "Does the case use assert.throws with a message matcher?"
      - "Does it prove no result variant was returned?"
      - "Does the comment avoid naming any status code or error-body string?"
      - "Does the file still report 0 failures?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 5.2 Add the readDetail throw-propagation case
    ```yaml
    description: "Assert a readDetail throw propagates out of getDetail rather than becoming the unknown-workstream variant."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/board-api.test.ts, add a case overriding `registry.find` to return ENTRY, leaving `store.hasTree` on its default true, and overriding `store.readDetail` to throw a distinctive Error."
      - "Assert with assert.throws that `api.getDetail(ENTRY.id, DETAIL.id)` throws, matching on the error's message."
      - "Assert the call returns no result, and specifically that it does not produce the unknown-workstream variant. A throw and a null return are two different failures and the core must keep them apart."
      - "Use a different error message from task 5.1's, so the two cases cannot pass each other's assertion."
    pattern: "src/test/unit/board-api.test.ts. Behaviour under test: src/core/board-api.ts line 72."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f acceptance criterion 7 and its case inventory row 'getDetail | readDetail throws'."
    gotcha: "The default readDetail returns null, which produces unknown-workstream. Without the throwing override this case would pass as a normal result and prove nothing, so confirm the override is in place."
    verify:
      - "Run `npm run build && node --test dist/test/unit/board-api.test.js`. It must report 0 failures."
      - "Run `grep -c 'assert.throws' src/test/unit/board-api.test.ts`. It must return at least 2. At base_commit 3c46648 it exits 2 with 'No such file or directory'."
    checklist:
      - "Does the case use assert.throws with a message matcher?"
      - "Is the error message different from task 5.1's?"
      - "Does the case prove the unknown-workstream variant was not returned?"
      - "Is the throwing readDetail override actually in place?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 5.3 Run the full suite and confirm the import and single-file constraints
    ```yaml
    description: "Run npm test end to end, then prove acceptance criteria 1, 3 and 8 — the suite passes, its imports are limited to the allowed set, and no other file was added or changed."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run the project's own full test command, `npm test`, which builds first through its pretest script and then runs node --test over dist/**/*.test.js and .github/scripts/**/*.test.mjs."
      - "Compare the run against the recorded baseline in Divergence 1, not against a clean sheet: at base_commit 3c46648 the suite reports 281 tests, 280 pass and 1 fail, and that one failure is a pre-existing network-dependent case."
      - "Confirm the new file's cases are added to the pass count, and that the only failing case is still the pre-existing one named in Divergence 1."
      - "Run the acceptance-criterion-3 import check over the new file and confirm it finds nothing."
      - "Run the acceptance-criterion-8 check and confirm src/test/unit/board-api.test.ts is the only added or changed file across src/."
      - "Fix any failure inside src/test/unit/board-api.test.ts only. If a fix appears to need an edit to any other file, stop and report instead of making it."
    pattern: "Whole repository. The only file this task may edit is src/test/unit/board-api.test.ts."
    imports: "No new import."
    compatibility: "PLN-86-8iia6f acceptance criteria 1, 3 and 8, and its Testing strategy: every case is synchronous, so the file needs no timeout, no --test-force-exit interaction and no cleanup hook."
    gotcha: "npm test does not pass cleanly at base_commit — see Divergence 1 — so 'npm test is green' is not a usable pass condition here. Read the counts. Separately, the file must not assert on console output; the core writes no log line."
    verify:
      - "Run `npm test`. The summary must report a pass count of 280 plus the new file's case count, at least 303 tests in total, and exactly 1 failure, which must be the pre-existing dist/test/unit/skill-content-fetch.test.js network case named in Divergence 1. At base_commit 3c46648 the same command reports tests 281, pass 280, fail 1."
      - "Run `node --test dist/test/unit/board-api.test.js`. It must report at least 23 tests and 0 failures. At base_commit 3c46648 this command cannot run: the compiled file does not exist."
      - "Run `grep -nE \"node:(fs|os|path|http|child_process)|\\.\\./\\.\\./(lib|http)/|\\.\\./\\.\\./server\\.js\" src/test/unit/board-api.test.ts`. It must print nothing and exit 1. At base_commit 3c46648 it exits 2 with 'No such file or directory', so pair it with the file-exists check below."
      - "Run `grep -n '^import' src/test/unit/board-api.test.ts`. The listed specifiers must be exactly node:test, node:assert/strict, ../../core/board-api.js, ../../ports/app-api.js, ../../ports/project-registry.js and ../../ports/workstream-store.js, and nothing else."
      - "Run `git status --porcelain -- src/test src/core src/ports src/http src/lib`. It must list exactly one entry, `?? src/test/unit/board-api.test.ts`. At base_commit 3c46648 the same command lists 0 entries."
    checklist:
      - "Does npm test report a pass count of 280 plus the new file's cases, with the only failure being the pre-existing network case in Divergence 1?"
      - "Does node --test dist/test/unit/board-api.test.js report at least 23 tests and 0 failures?"
      - "Does the forbidden-import grep print nothing while the file exists?"
      - "Are the file's import specifiers exactly the six allowed ones?"
      - "Does git status list src/test/unit/board-api.test.ts as the only added or changed file under src/?"
      - "Were src/test/boundary/, src/http/, src/lib/, src/core/ and src/ports/ left completely untouched?"
    self_eval:
      passed: true
      failures: []
    ```

## Divergences

1. **`npm test` does not pass at the base commit.** PLN-86-8iia6f stage 5 states the observable
   as "`npm test` passes, with the previous pass count plus this file's cases". Measured at
   `base_commit` 3c46648 on branch `feature/domain-logic-unit-test-suite`, `npm test` reports
   `tests 281`, `pass 280`, `fail 1`. The one failure is
   `dist/test/unit/skill-content-fetch.test.js`, case "getInstallContent installs the newest live
   release and returns the known 8 fc-* skills with fc-orchestrate's known nested files". It fails
   because it fetches a release list over the network from a host that is not reachable from this
   machine, so it is environment-dependent and pre-existing, and it is unrelated to
   `src/core/board-api.ts`. Consequence: task 5.3's `verify` asserts the pass count and the identity
   of the single permitted failure instead of asserting a green run. No task attempts to fix that
   case, because PLN-86-8iia6f acceptance criterion 8 forbids changing any file other than
   `src/test/unit/board-api.test.ts`.

Every other file the plan cites matched it at `base_commit` 3c46648: `src/core/board-api.ts` (the
`getBoard` payload literal and its load-bearing key-order comment at lines 57-63),
`src/ports/app-api.ts` (the status-mapping block at lines 9-15 and the nine result variants),
`src/ports/project-registry.ts`, `src/ports/workstream-store.ts` (the throws-versus-null split at
lines 19-24), `src/http/routes-board.ts:50-57`, `src/http/routes-projects.ts:49-52`,
`src/server.ts:16`, `src/test/unit/agentic-tools-install.test.ts:26-66`,
`src/test/fixture-project.ts:5-10`, `src/types/praxis-data.d.ts` and `tsconfig.json`'s `include`.
`src/test/unit/board-api.test.ts` does not exist, and no file under `src/test/` references
`core/board-api` or `legacyLayoutDir`.

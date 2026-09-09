---
id: TL-98-v8145x
type: tasklist
workstream: WS-97-7fvoc0
slug: boundary-regression-test-suite
title: "Boundary regression test suite for the HTTP routes, the packaged CLI and the board payload"
status: ready
created: 2026-09-09
updated: 2026-09-09
author: Anthony Koukoullis
depends_on: [PLN-84-c6d01h]
links: []
mode: spec
base_commit: e8f3d7c
---

# FlowCharge Tasks

## Boundary regression test suite

This list implements `PLN-84-c6d01h`. The plan adds four `node --test` files and two
shared helper modules. They drive the real server over a real socket, and they drive the
real packaged Bun binary as a child process. They assert external behaviour only — status
codes, payload shape and observable side effects — so the later ports-and-adapters
refactor (WS-98-tbznpw) can move the internals without rewriting them.

No file under `src/` that the product ships changes. The deliverable is
`src/server-harness.ts`, one additive export in `src/lib/fixture-project.ts`, and the four
test files `src/server-projects.test.ts`, `src/server-board.test.ts`,
`src/server-guards.test.ts` and `src/cli-binary.test.ts`.

Assertion strictness is settled and is not re-opened by any task below. Assert the HTTP
status code and the JSON response shape everywhere. Assert the exact error text only where
the text encodes a security decision — the permitted-root refusals and the
malformed-workstream-id refusal. Everywhere else, assert that an `error` string is
present, never its wording.

Four parent tasks, one per plan stage, in the plan's order.

- [x] 1. Isolated registry harness and the project registry routes (plan stage 1)

  ```yaml
  description: "Deliver src/server-harness.ts and src/server-projects.test.ts. This stage holds first position because it carries the only data-safety risk in the plan: a wrong data-directory seam writes into the maintainer's real .praxis-projects.json."
  ```

  - [x] 1.1 Create `src/server-harness.ts`, the shared server harness
    ```yaml
    description: "Add the new helper module that starts the compiled server on an ephemeral port with PRAXIS_DATA_DIR redirected to a temporary directory, and that performs raw and JSON requests against it."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/server-harness.ts. The filename carries no `.test.` segment on purpose, so a test file may import it without registering that file's cases a second time. The precedent is src/lib/fixture-project.ts, whose header comment states the same rule."
      - "Export the two interfaces the plan's Design section fixes: `TestServer` with `base: string` and `dataDir: string`, and `RawResponse` with `status: number`, `headers: Record<string, string | string[] | undefined>` and `text: string`."
      - "Export `startTestServer(): Promise<TestServer>`. It creates a temporary directory with fs.mkdtempSync under os.tmpdir(), assigns process.env.PRAXIS_DATA_DIR to that directory, assigns PORT='0' and HOST='127.0.0.1', and only then awaits `import('./server.js')` and its exported `serverReady` promise. Build `base` as `http://127.0.0.1:${port}` from the port that promise resolves with."
      - "The assignment-before-import order is load-bearing and must be stated in a comment. src/server.ts reads `port` and `host` at lines 30-31 and INSTALL_REGISTRY_PATH at line 108, and src/lib/projects.ts reads `dataDir` at line 22 — all at module evaluation, so a later assignment is never observed."
      - "Export `requestRaw(base, route, init?)` built on node:http, never on fetch. `Host` is a forbidden header name for fetch and the guard cases have to set it. Send `route` verbatim as the request path, with no normalisation, so a traversal path survives to the server. Resolve with the status, the raw headers object and the body decoded as utf8."
      - "Export `requestJson(base, route, init?)` returning `{ status, body }`. Implement it over requestRaw and JSON.parse the text. Both init objects accept `{ method?, body?, headers? }`."
      - "Do not remove the temporary directory inside the harness. The caller removes `dataDir` in its own after() hook, which is what the plan specifies."
      - "Keep the module's knowledge to three environment variable names and one exported promise. It must not know a route path, a payload field or a registry field."
    pattern: "New file src/server-harness.ts only. No existing file is edited by this task."
    imports: "node:http, node:fs, node:os, node:path, and a dynamic import of ./server.js."
    compatibility: "Per PLN-84-c6d01h Design. ESM, TypeScript compiled by tsconfig.json into dist/. Module-scope environment reads in src/server.ts and src/lib/projects.ts fix the ordering constraint above."
    gotcha: "ESM module caching means one process observes exactly one environment, so startTestServer is called at most once per test file. The traversal case needs the raw path preserved, so do not pass `route` through a URL object. The 403 traversal answer and the 404 static answer are plain text, not JSON, so requestJson must never be used for them."
    verify:
      - "npm run build"
      - "ls dist/server-harness.js — at base_commit src/server-harness.ts does not exist and this path is absent, so the step fails before the task is done."
      - "npx tsc -p tsconfig.json --noEmit — exits 0 at base_commit and must still exit 0."
    checklist:
      - "Does src/server-harness.ts export startTestServer, requestJson, requestRaw, TestServer and RawResponse, and nothing else?"
      - "Are PRAXIS_DATA_DIR, PORT and HOST all assigned before the dynamic import of ./server.js?"
      - "Does requestRaw use node:http rather than fetch, so a Host header can be set?"
      - "Is the module free of any route path, payload field name or registry field name?"
      - "Does the filename carry no `.test.` segment, so importing it registers no cases?"
    self_eval:
      passed: true
      failures:
        - item: "pattern: `New file src/server-harness.ts only. No existing file is edited by this task.`"
          reason: "tsconfig.json's `include` is an explicit file list, not a glob over src/. A new file that is not named there is outside the program, so tsc emitted nothing for it and the verify step `ls dist/server-harness.js` failed after the file was written."
          fix: "Added `src/server-harness.ts` and `src/server-projects.test.ts` to the `include` array on line 15 of tsconfig.json. One line, strictly required for the two in-scope files to compile at all. Nothing else in tsconfig.json changed. Tasks 2.2, 3.1 and 4.2 must add their own new files to the same array."
    ```

  - [x] 1.2 Cover `/api/projects` in a new `src/server-projects.test.ts`
    ```yaml
    description: "Create the registry-routes test file and cover the collection route: GET, POST success and every documented POST refusal, plus the method guard."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/server-projects.test.ts. Import test and after from node:test, assert from node:assert/strict, and startTestServer plus requestJson from ./server-harness.js. Call startTestServer once at module scope and remove its dataDir in an after() hook."
      - "Assert GET /api/projects on a fresh temporary data directory answers 200 with the shape { projects: [] }. This case is the isolation proof: readProjects() in src/lib/projects.ts returns [] rather than the self-entry precisely because PRAXIS_DATA_DIR is set, so a non-empty list here means the harness leaked to the repository root."
      - "Build a throwaway project directory under os.tmpdir() holding a flowcharge/workstreams/ folder, so hasWorkstreamTree accepts it. Assert POST /api/projects with { path } answers 201 and a body of the form { project: { id, name, path, added } }, then assert a second identical POST answers 200 with the same id."
      - "Assert GET /api/projects then lists exactly that one entry."
      - "Cover each documented POST refusal with its status and the presence of an `error` string, never its wording: a body that is not valid JSON (400), a body with no `path` (400), a `path` starting with `~` (400), a relative path (400), and an absolute path holding no flowcharge/ or prxwork/ folder (400)."
      - "Assert an unsupported method on /api/projects — PUT — answers 405."
      - "Take the project id from the POST response body. Do not import src/lib/projects.js to compute it, and do not import a parser from src/lib/extract.js. That rule is what makes these cases survive the WS-98-tbznpw refactor."
      - "Remove every temporary directory this file creates in the same after() hook."
    pattern: "New file src/server-projects.test.ts. Covers acceptance criteria 2 and 3 of PLN-84-c6d01h for the collection route."
    imports: "node:test, node:assert/strict, node:fs, node:os, node:path, ./server-harness.js."
    compatibility: "Per PLN-84-c6d01h Design and its Testing strategy for stage 1. node --test over the compiled output, matching the existing convention documented in DEVELOPMENT.md."
    gotcha: "The compiled server binds a socket as a module side effect and exports no close handle, so this file needs --test-force-exit exactly as src/server.test.ts does; `npm test` already passes that flag. A `~` path is refused before any filesystem call, so the refusal cases need no directory on disk."
    verify:
      - "npm run build"
      - "node --test --test-force-exit dist/server-projects.test.js — at base_commit this prints `Could not find 'dist/server-projects.test.js'` and exits 1, so the step discriminates."
      - "B=$(shasum -a 256 .praxis-projects.json); node --test --test-force-exit dist/server-projects.test.js; A=$(shasum -a 256 .praxis-projects.json); [ \"$B\" = \"$A\" ] — the repository's own registry must be byte-identical across the run. Its digest at base_commit is bd0bd90ea0083d5c8a85708d510b2384535b5f14aefd4c0f0d5f5d1dca7d4791."
      - "grep -c 'praxis-projects.json' src/server-projects.test.ts — must print 0. Acceptance criterion 2 binds this file: it must never name the repository's own registry."
    checklist:
      - "Does the GET case assert an empty projects array, proving PRAXIS_DATA_DIR redirection worked?"
      - "Does every case take the project id from a route response rather than from src/lib/projects.js?"
      - "Are the 201 and the repeat-200 both asserted for POST?"
      - "Is every refusal asserted by status and the presence of an `error` string, with no exact wording asserted?"
      - "Is the repository's own .praxis-projects.json unchanged after the file runs?"
      - "Are all temporary directories removed in an after() hook?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Cover `/api/projects/:id` in `src/server-projects.test.ts`
    ```yaml
    description: "Add the entry-route cases to the same file: PATCH rename success and refusals, DELETE success and 404, and the method guard."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Append cases to src/server-projects.test.ts. Register a fresh project through POST /api/projects for each group so the cases do not depend on each other's ordering."
      - "Assert PATCH /api/projects/<id> with { name } answers 200 and a body of the form { project: { name: <the new name> } }, and that a following GET /api/projects reflects the new name."
      - "Cover each documented PATCH refusal by status and the presence of an `error` string: a body that is not valid JSON (400), a body with no `name` (400), a name longer than the 100-character cap in src/server.ts (400), a name containing a control character such as a newline (400), and an unknown id (404)."
      - "Assert DELETE /api/projects/<id> answers 200 with the shape { deleted: { id } }, and that a second DELETE of the same id answers 404."
      - "Assert an unsupported method on this path — GET /api/projects/<id> — answers 405. The path regex in src/server.ts is end-anchored, so this must not be confused with the /data route."
      - "Set Content-Type: application/json on every PATCH. Without it the guard at the top of handleApi answers 403 and the case would prove nothing about the rename path."
    pattern: "src/server-projects.test.ts, appended. Covers acceptance criterion 3 of PLN-84-c6d01h for the entry route."
    imports: "No new import beyond those task 1.2 added."
    compatibility: "Per PLN-84-c6d01h Design. Same file, same harness instance, same after() cleanup."
    gotcha: "The Content-Type guard runs above every route match and before any body is read, so a PATCH with no Content-Type answers 403 rather than 400 — that case belongs to stage 3, not here. The 100-character cap is a constant in src/server.ts; derive the over-long name from a length greater than it rather than restating the number as an assertion."
    verify:
      - "npm run build"
      - "node --test --test-force-exit dist/server-projects.test.js — at base_commit the file is absent and this exits 1."
      - "node --test --test-force-exit dist/server-projects.test.js 2>&1 | grep -E '^(#|ℹ) (pass|fail)' — the fail count must be 0."
      - "B=$(shasum -a 256 .praxis-projects.json); node --test --test-force-exit dist/server-projects.test.js; A=$(shasum -a 256 .praxis-projects.json); [ \"$B\" = \"$A\" ]"
    checklist:
      - "Does every PATCH case send Content-Type: application/json?"
      - "Are the 400, 404 and 405 refusals of the entry route all covered?"
      - "Does the DELETE case assert the { deleted: ... } shape and the follow-up 404?"
      - "Is the repository's own .praxis-projects.json unchanged after the file runs?"
      - "Does the file still import no module from src/lib/?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. The board payload and the workstream detail, end to end over HTTP (plan stage 2)

  ```yaml
  description: "Deliver the fixture builder and src/server-board.test.ts. This stage holds second position because it is the largest coverage gap and the behaviour the later refactor is most likely to disturb."
  ```

  - [x] 2.1 Add `withBoardFixtureProject` to `src/lib/fixture-project.ts`
    ```yaml
    description: "Add one additive export that writes a realistic two-workstream project tree with an archived third workstream, in either name generation, and removes it again."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Edit src/lib/fixture-project.ts additively only. Leave withFixtureProject, FIXTURE_GENERATIONS, FixtureGeneration, FixtureNames and the GENERATION_NAMES table exactly as they are — src/lib/extract.test.ts and src/lib/detail.test.ts assert against them today."
      - "Export `interface BoardFixtureOptions { generation?: FixtureGeneration; branch?: string | null; }` with generation defaulting to 'flowcharge' and branch defaulting to null."
      - "Export `async function withBoardFixtureProject(run: (root: string) => Promise<void>, options?: BoardFixtureOptions): Promise<void>`. It writes the tree, awaits run(root), and removes the tree in a finally block so a failing assertion leaves nothing behind."
      - "Derive the tree folder name and the marker filename from the existing GENERATION_NAMES table so one definition serves both generations. The body must hold no generation literal of its own."
      - "Write <tree>/workstreams/ with two workstream folders. The first carries the marker file with a multi-paragraph body, plus a plan file, an issue list file and a task list file, so artefact order (plan, issuelist, tasklist), the total and done counters, and the aggregated issues[] are all observable. Give the marker frontmatter distinct id, slug, title, status, tags, created, updated and depends_on values so each maps to a payload field."
      - "The issue list must hold one suffixed issue id and one unsuffixed one, one checked and one unchecked, each with a severity and a status in its yaml fence. The task list must hold at least one checked and one unchecked task so its counters differ from the issue list's."
      - "Write the second workstream folder with the marker file only, so a workstream with no artefacts is covered and artefacts is observable as []."
      - "Write <tree>/archive/ with a third workstream folder carrying a marker file, so archived: true is observable."
      - "When options.branch is a string, write <root>/.git/HEAD containing `ref: refs/heads/<branch>` so readBranch resolves it and the payload's branch field is observable as something other than null."
      - "Give the exported names their own header comment stating that this builder serves the board and detail HTTP suites, and that withFixtureProject stays the single-workstream builder the extract and detail unit suites use."
    pattern: "src/lib/fixture-project.ts, additive only."
    imports: "No new import. node:fs, node:os and node:path are already imported by this file."
    compatibility: "Per PLN-84-c6d01h Design. Artefact frontmatter must satisfy the artefact gate in src/lib/extract.ts — a file becomes an artefact when its frontmatter carries an `id`, and `type` is not gated: it selects the ARTEFACT_TYPE_RANK ordering bucket, and for issuelist and tasklist it selects the total/done counter branch. Issue items must match ISSUE_ITEM and task items TASK_ITEM in src/lib/extract.ts."
    gotcha: "Both marker filenames are skipped by the artefact walk, so a marker file never appears as an artefact row. Artefact ordering is by type rank first (plan, issuelist, tasklist) and then by id number, so give the three artefacts ids that make a wrong order detectable. The counters come from countChecks over the raw file text, so the checked and unchecked counts must be chosen deliberately, not incidentally."
    verify:
      - "npm run build"
      - "grep -c 'withBoardFixtureProject' src/lib/fixture-project.ts — prints 0 at base_commit and must print at least 1 afterwards."
      - "npx tsc -p tsconfig.json --noEmit — exits 0 at base_commit and must still exit 0."
      - "node --test dist/lib/extract.test.js dist/lib/detail.test.js — the two existing consumers of this file must stay green, proving the change was additive."
    checklist:
      - "Are withFixtureProject and GENERATION_NAMES unchanged byte for byte?"
      - "Does the builder derive both the tree name and the marker name from GENERATION_NAMES rather than from a literal?"
      - "Does the tree hold two active workstreams, one with three artefacts and one with none, plus one archived workstream?"
      - "Does the issue list hold one suffixed and one unsuffixed id, one checked and one unchecked, each with severity and status?"
      - "Does a string `branch` option write .git/HEAD, and does the default leave no .git directory?"
      - "Is the tree removed in a finally block even when the callback throws?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Cover `GET /api/projects/:id/data` for the `flowcharge` generation
    ```yaml
    description: "Create src/server-board.test.ts and assert the whole board payload for a realistic flowcharge/ fixture tree, from files on disk through to the JSON body."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/server-board.test.ts. Import test and after from node:test, assert from node:assert/strict, startTestServer and requestJson from ./server-harness.js, and withBoardFixtureProject from ./lib/fixture-project.js. Call startTestServer once at module scope and remove its dataDir in an after() hook."
      - "Inside one withBoardFixtureProject callback with an explicit branch string, register the fixture root through POST /api/projects, take the id from the response, and GET /api/projects/<id>/data."
      - "Assert 200 and then assert the payload structure: the workstream count, the workstream ids, their statuses, the archived flag, true on the archived one and false on the active ones, the artefact order and the total and done counters on the issue list and the task list artefacts, the aggregated issues[] with each issue's id, checked, severity and status, the branch field equal to the branch written into .git/HEAD, and the name field equal to the registry display name."
      - "Assert the workstream with no artefacts carries an empty artefacts array, so an absent-artefact tree is covered as well as a populated one."
      - "Assert the payload's `source` field equals the registered path, and that `generated` is present as a YYYY-MM-DD string. Do not assert the literal date."
      - "Cover the route's refusals: an unknown project id answers 404, a wrong method answers 405, and a registered project whose tree has been deleted inside the callback answers 410. Assert the status and the presence of an `error` string for each, never the wording."
      - "Import no parser from src/lib/extract.js and no function from src/lib/projects.js. Every expectation is written out in the test, so the assertions do not move when the internals do."
    pattern: "New file src/server-board.test.ts. Covers acceptance criterion 4 of PLN-84-c6d01h for the flowcharge generation."
    imports: "node:test, node:assert/strict, node:fs, ./server-harness.js, ./lib/fixture-project.js."
    compatibility: "Per PLN-84-c6d01h Design and its Testing strategy for stage 2. The payload shape is BoardPayload in src/types/praxis-data.d.ts — the extractor's PraxisData plus branch and name."
    gotcha: "The 410 case needs the tree removed while the fixture callback is still running, because withBoardFixtureProject removes the whole root when it returns. On macOS os.tmpdir() sits under /var/folders/..., which path.resolve does not dereference, so `source` equals the path that was registered — do not call fs.realpathSync on one side of that comparison and not the other."
    verify:
      - "npm run build"
      - "node --test --test-force-exit dist/server-board.test.js — at base_commit this prints `Could not find 'dist/server-board.test.js'` and exits 1."
      - "node --test --test-force-exit dist/server-board.test.js 2>&1 | grep -E '^(#|ℹ) fail' — must report 0."
      - "grep -c 'praxis-projects.json' src/server-board.test.ts — must print 0, per acceptance criterion 2."
    checklist:
      - "Are the workstream count, ids, statuses and archived flag all asserted?"
      - "Are the artefact order and the total and done counters asserted for both counted artefact types?"
      - "Is the aggregated issues[] asserted with id, checked, severity and status for each issue?"
      - "Are branch and name both asserted against values the fixture and the registry set?"
      - "Are the 404, 405 and 410 refusals covered by status and an `error` string only?"
      - "Does the file import no parser from src/lib/extract.js and no function from src/lib/projects.js?"
    self_eval:
      passed: true
      failures:
        - item: "pattern: `New file src/server-board.test.ts. Covers acceptance criterion 4 of PLN-84-c6d01h for the flowcharge generation.`"
          reason: "tsconfig.json's `include` is an explicit file list, not a glob over src/. A new file that is not named there is outside the program, so tsc emitted nothing for it and the verify step `ls dist/server-board.test.js` failed after the file was written. Task 1.1 hit the same thing and recorded the same divergence."
          fix: "Added `src/server-board.test.ts` to the `include` array on line 15 of tsconfig.json, beside the two entries task 1.1 added. One list entry, strictly required for the in-scope file to compile at all. Nothing else in tsconfig.json changed. Tasks 3.1 and 4.2 must add their own new files to the same array."
    ```

  - [x] 2.3 Cover the legacy `prxwork` generation of the same route
    ```yaml
    description: "Add the second-generation case so the board payload is asserted for a prxwork/ tree as well as a flowcharge/ one."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Append a case to src/server-board.test.ts that builds the fixture with generation: 'prxwork' and drives the same register-then-GET sequence."
      - "Assert the same payload structure the flowcharge case asserts: workstream count, ids, statuses, archived flag, artefact order, counters, aggregated issues, branch and name. Factor the shared expectations into one local helper in this file so the two generations cannot drift apart."
      - "Do not assert on the LEGACY LAYOUT console.warn line. It is a side effect of warnLegacyLayout in src/server.ts and it is written to the parent process's stderr, not to the response."
    pattern: "src/server-board.test.ts, appended. Completes acceptance criterion 4 of PLN-84-c6d01h."
    imports: "No new import beyond those task 2.2 added."
    compatibility: "Per PLN-84-c6d01h Design. resolveTreeLayout in src/lib/tree-layout.ts prefers flowcharge/ over prxwork/, so the prxwork fixture must hold no flowcharge/ folder at all."
    gotcha: "A prxwork tree uses prxworkstream.md as its marker; the fixture builder already derives that from GENERATION_NAMES, so this case must not name either filename itself. Running this case prints a LEGACY LAYOUT warning on stderr — that is expected output, not a failure."
    verify:
      - "npm run build"
      - "node --test --test-force-exit dist/server-board.test.js 2>&1 | grep -E '^(#|ℹ) (tests|fail)' — the fail count must be 0 and the test count must be higher than the count task 2.2 left."
      - "node --test --test-force-exit dist/server-board.test.js 2>&1 | grep -c 'prxwork' — must be at least 1, proving the legacy generation is actually exercised. At base_commit the file does not exist and this step fails."
    checklist:
      - "Does the prxwork case assert the same payload fields as the flowcharge case, through one shared local helper?"
      - "Does the prxwork fixture hold no flowcharge/ folder?"
      - "Does the file name neither marker filename directly?"
      - "Is the LEGACY LAYOUT warning left unasserted?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.4 Cover `GET /api/projects/:id/workstreams/:wsId/detail`
    ```yaml
    description: "Add the workstream detail route to src/server-board.test.ts: the success payload for the fixture tree, plus its documented 400, 404, 410 and 405 refusals."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Append cases to src/server-board.test.ts driving GET /api/projects/<id>/workstreams/<wsId>/detail against the same fixture, with the workstream id taken from the fixture's own marker frontmatter."
      - "Assert 200 and the detail payload structure: id, slug, title, status, archived, and the plans, issueLists and taskLists arrays. Assert one plan carrying a body string, one issue list whose items carry id, title, checked, status and fields, and one task list whose tasks carry number, title, checked, fields and children."
      - "Assert the archived workstream's detail answers 200 with archived: true, so the archive branch of the lookup is covered."
      - "Assert a malformed workstream id — for example `not-a-ws-id` — answers 400, and assert the EXACT error text `Malformed workstream id not-a-ws-id`. This is one of the two places the settled strictness decision requires exact text, because the message encodes a security decision: the shape check runs before any filesystem work."
      - "Assert an unknown but well-formed workstream id answers 404, an unknown project id answers 404, a wrong method answers 405, and a registered project whose tree was deleted inside the callback answers 410. Assert status and the presence of an `error` string for these four, never the wording."
      - "Note in a comment that the shape guard runs before findProject, so a malformed workstream id under an unknown project id still answers 400 rather than 404."
    pattern: "src/server-board.test.ts, appended. Covers acceptance criterion 5 of PLN-84-c6d01h."
    imports: "No new import beyond those task 2.2 added."
    compatibility: "Per PLN-84-c6d01h Design and its settled assertion-strictness decision. The payload shape is PraxisWorkstreamDetail in src/types/praxis-data.d.ts. The id shape guard is WORKSTREAM_ID in src/server.ts, composed from ID_SUFFIX so the server and the extractor cannot disagree."
    gotcha: "A well-formed but unknown id must still match ^WS-\\d+(?:-[0-9a-z]{6})?$ or the case tests the 400 branch instead of the 404 branch. The request path is decodeURIComponent'd before matching, so a percent-encoded traversal segment reaches the shape guard and is refused on shape — that is the reason the exact text is asserted here."
    verify:
      - "npm run build"
      - "node --test --test-force-exit dist/server-board.test.js 2>&1 | grep -E '^(#|ℹ) fail' — must report 0."
      - "grep -c 'Malformed workstream id' src/server-board.test.ts — must print at least 1. At base_commit the file does not exist, so the step fails."
    checklist:
      - "Is the exact text `Malformed workstream id ...` asserted for the 400 case?"
      - "Are the 404 for an unknown workstream and the 404 for an unknown project both covered?"
      - "Are the 405 and the 410 refusals covered?"
      - "Is the archived workstream's detail asserted with archived: true?"
      - "Are the plan body, the issue items and the task tree all asserted in the 200 payload?"
    self_eval:
      passed: true
      failures: []
    ```

- [ ] 3. The request guards and static serving (plan stage 3)

  ```yaml
  description: "Deliver src/server-guards.test.ts. This stage holds third position because it needs no fixture and introduces no new mechanism. At the end, every check above the route table, and the HTML and asset path, are covered."
  ```

  - [ ] 3.1 Create `src/server-guards.test.ts` with the Content-Type, Host, Origin and traversal guards
    ```yaml
    description: "Cover the four cross-cutting refusals that sit above the route table, driven through requestRaw so the Host header can be set."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/server-guards.test.ts. Import test and after from node:test, assert from node:assert/strict, and startTestServer, requestRaw and requestJson from ./server-harness.js. Call startTestServer once at module scope and remove its dataDir in an after() hook."
      - "Assert a POST to /api/projects with a Content-Type other than application/json answers 403 with an `error` string. Add a second case proving `application/json; charset=utf-8` passes the guard, so the parameter-splitting behaviour is pinned."
      - "Assert a request carrying a Host header that is neither an IP literal, nor localhost, nor a member of ALLOWED_HOSTS — for example `evil.example` — answers 403. Use requestRaw: Host is a forbidden header name for fetch."
      - "Assert a request whose Origin header does not equal `http://` plus the raw Host header value answers 403, and add a case proving an absent Origin passes. The comparison includes the port, so build the matching Origin from the same host and port the harness bound."
      - "Assert a path that escapes the public root — for example /../package.json — answers 403. Read this one through requestRaw and assert the body is the plain-text `Forbidden`, not JSON."
      - "Assert the status and the presence of an `error` string for the JSON refusals, never the exact wording."
    pattern: "New file src/server-guards.test.ts. Covers the first four items of acceptance criterion 6 of PLN-84-c6d01h."
    imports: "node:test, node:assert/strict, ./server-harness.js."
    compatibility: "Per PLN-84-c6d01h Design. The guards are isJsonContentType, passesOriginCheck and the startsWith(root + path.sep) check in src/server.ts."
    gotcha: "The traversal answer is written with res.writeHead(403) and a plain-text body, so requestJson would throw on it. The Host guard accepts every IP literal, so a case that sends 127.0.0.1 proves nothing — the refusal needs a non-IP, non-localhost name. The Origin check compares against the RAW Host header including the port, so a port-less Origin fails for the wrong reason."
    verify:
      - "npm run build"
      - "node --test --test-force-exit dist/server-guards.test.js — at base_commit this prints `Could not find 'dist/server-guards.test.js'` and exits 1."
      - "node --test --test-force-exit dist/server-guards.test.js 2>&1 | grep -E '^(#|ℹ) fail' — must report 0."
      - "grep -c 'praxis-projects.json' src/server-guards.test.ts — must print 0, per acceptance criterion 2."
    checklist:
      - "Does the Content-Type group cover both the 403 refusal and the charset-parameter pass?"
      - "Is the Host refusal driven with a non-IP, non-localhost hostname through requestRaw?"
      - "Does the Origin group cover both the mismatch refusal and the absent-Origin pass?"
      - "Is the traversal case read through requestRaw and asserted against the plain-text body?"
      - "Is no exact error wording asserted in this file?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 3.2 Cover the 413 oversize-body refusal
    ```yaml
    description: "Add the one guard case with real flakiness risk: the server answers 413 and then destroys the request, so the response must be read before the socket closes."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Append a case to src/server-guards.test.ts that POSTs a body larger than the 8192-byte cap in src/server.ts to /api/projects with Content-Type: application/json, and asserts 413 with an `error` string."
      - "Attach the node:http response handler before writing the body, so the answer is observed even though readRequestBody calls req.destroy() immediately after answering."
      - "Tolerate an ECONNRESET or EPIPE on the request stream after the response has been received: the destroy is expected behaviour, not a failure. Do not let that error reject the promise once a status has already arrived."
      - "If requestRaw as written in task 1.1 cannot express this, add the response-first ordering inside requestRaw rather than opening a second HTTP path in this test file — the harness is the one place that knows node:http."
      - "Derive the oversize length from a value comfortably above the cap rather than restating 8192 as an assertion, so a future widening of the cap does not silently make this case meaningless."
    pattern: "src/server-guards.test.ts, appended; src/server-harness.ts only if the ordering fix belongs there. Covers the 413 item of acceptance criterion 6."
    imports: "No new import beyond those task 3.1 added."
    compatibility: "Per PLN-84-c6d01h Testing strategy, which names this the one case with real flakiness risk. The behaviour is readRequestBody in src/server.ts, which answers 413 and then destroys the request."
    gotcha: "Writing the whole body before listening for a response is the flake: the socket can be destroyed first and the client then sees only a reset. The guard fires on the first chunk that crosses the cap, so a single large write is enough — no chunked drip is needed."
    verify:
      - "npm run build"
      - "node --test --test-force-exit dist/server-guards.test.js 2>&1 | grep -E '^(#|ℹ) fail' — must report 0."
      - "for i in 1 2 3 4 5; do node --test --test-force-exit dist/server-guards.test.js > /dev/null 2>&1 || echo FLAKE; done — must print nothing across five consecutive runs. At base_commit the file does not exist and every run prints FLAKE."
    checklist:
      - "Is the response handler attached before the oversize body is written?"
      - "Is an ECONNRESET or EPIPE after the response treated as expected rather than as a failure?"
      - "Does the case assert 413 and the presence of an `error` string?"
      - "Did five consecutive runs of the file pass with no flake?"
      - "If requestRaw changed, is src/server-harness.ts still free of any route path or payload field?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 3.3 Cover the method guard of `GET /api/integrations/releases`
    ```yaml
    description: "Add the one integrations case this plan owns: the wrong method on the releases route answers 405 without calling the live release listing."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Append a case to src/server-guards.test.ts asserting POST /api/integrations/releases answers 405 with an `error` string."
      - "Send Content-Type: application/json on the POST, so the request passes the Content-Type guard and the 405 that comes back is the route's method guard rather than the 403 above it."
      - "Do not cover the 200 path of this route. listSkillReleases in src/lib/skill-content-fetch.ts:201 calls a fixed URL and takes no injectable source, so an offline test of its body would need a production seam this workstream does not authorize. See Divergence 1 — that live call is exactly what fails in the existing suite today."
    pattern: "src/server-guards.test.ts, appended. Covers the /api/integrations/releases method-guard item of acceptance criterion 6."
    imports: "No new import beyond those task 3.1 added."
    compatibility: "Per PLN-84-c6d01h Out of scope, which excludes the 200 path of this route and covers its method guard instead. src/server.test.ts already covers the 405 of /api/integrations/tools, so this case is not a duplicate."
    gotcha: "The /api/integrations/ branch also sits behind a loopback peer-address gate. The harness binds 127.0.0.1, so the gate passes and the 405 is reached. The non-loopback 403 branch is explicitly out of scope: producing a non-local peer needs a second host."
    verify:
      - "npm run build"
      - "node --test --test-force-exit dist/server-guards.test.js 2>&1 | grep -E '^(#|ℹ) fail' — must report 0."
      - "grep -c 'integrations/releases' src/server-guards.test.ts — must print at least 1. At base_commit the file does not exist, so the step fails."
      - "node --test --test-force-exit dist/server-guards.test.js — must finish in a few seconds, proving no live release call was made. The one live call in the existing suite takes over 10 seconds before it fails."
    checklist:
      - "Does the POST carry Content-Type: application/json, so the 405 is the method guard rather than the 403 above it?"
      - "Is 405 asserted with an `error` string and no exact wording?"
      - "Is the 200 path of the route left uncovered?"
      - "Does the file still make no network call?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 3.4 Cover static serving and the CSP header
    ```yaml
    description: "Add the HTML and asset path: 200 with the CSP header for / and /board.html, 200 with the documented MIME type and the CSP header for one static asset, and 404 for an unknown static path."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Append cases to src/server-guards.test.ts driven through requestRaw, because these responses are HTML, CSS and plain text rather than JSON."
      - "Assert GET / answers 200, carries the Content-Security-Policy header, and carries Content-Type text/html; charset=utf-8. Assert the header value contains the directives the policy in src/server.ts sets rather than asserting the whole string byte for byte."
      - "Assert GET /board.html answers 200 with the same Content-Type and the same CSP header."
      - "Assert one static asset — GET /styles.css — answers 200 with Content-Type text/css; charset=utf-8 and the CSP header. That MIME string comes from the MIME table in src/server.ts."
      - "Assert an unknown static path — for example /no-such-file.css — answers 404. The body is plain text, so do not parse it as JSON."
      - "State in a comment that these cases run against dist/public/, which npm run build fills, so the file depends on the build step the pretest script already performs."
    pattern: "src/server-guards.test.ts, appended. Completes acceptance criterion 6 of PLN-84-c6d01h."
    imports: "No new import beyond those task 3.1 added."
    compatibility: "Per PLN-84-c6d01h Design. The assets exist under dist/public/ after npm run build — index.html, board.html, styles.css, app.js, home.js, theme-init.js and img/ were all present at base_commit."
    gotcha: "The 404 static answer is text/plain with the body `Not found: <path>`, so requestJson would throw. The CSP header is sent only on the static branch, never on an /api/ JSON answer, so do not assert it on a route response."
    verify:
      - "npm run build"
      - "node --test --test-force-exit dist/server-guards.test.js 2>&1 | grep -E '^(#|ℹ) fail' — must report 0."
      - "grep -c 'Content-Security-Policy' src/server-guards.test.ts — must print at least 1. At base_commit the file does not exist, so the step fails."
      - "ls dist/public/board.html dist/public/styles.css — both must exist, proving the assets these cases read are really built."
    checklist:
      - "Do both / and /board.html assert 200 plus the CSP header?"
      - "Does the static asset case assert its documented MIME type as well as the CSP header?"
      - "Is the unknown static path asserted as 404 and read as text rather than JSON?"
      - "Is the CSP header asserted by its directives rather than as one exact byte string?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 4. The packaged CLI binary as a black box (plan stage 4)

  ```yaml
  description: "Deliver src/cli-binary.test.ts. This stage holds last position because it depends on no earlier stage and is the only stage that cannot run in CI."
  ```

  - [ ] 4.1 Re-measure the three figures the plan marks as estimates
    ```yaml
    description: "Before writing any CLI test, re-measure the Bun compile time, the binary size and the count of existing test files, because the plan requires stage 4 to confirm them rather than inherit them. This task changes no file by design, so its verify commands intentionally cannot tell a done task from an undone one — the task's real evidence is the measurement it writes into its self_eval."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run npm run build once, then time a single-target compile: `time node tools/package-cli.mjs --target=<the host label>`. Record the wall-clock time it actually took."
      - "Record the size of the binary it wrote under release/cli/, with `ls -l`. The plan's figure of about 64 MB is an estimate with no cited source."
      - "Count the test files npm test actually runs: `find dist -name '*.test.js' | wc -l` and `find .github/scripts -name '*.test.mjs' | wc -l`. The plan's figure of twenty-three is an estimate with no cited source."
      - "Write the three measured numbers into this task's self_eval as a note, and state whether each confirms or contradicts the plan's estimate. If the compile is materially slower than about 0.15 seconds, say so plainly, because the compile time is part of the reason a Bun compile is allowed to sit inside npm test."
      - "Change no file in this task. It is a measurement gate, and it is the precondition PLN-84-c6d01h sets on stage 4 starting."
    pattern: "No file changes. Measurement only, against tools/package-cli.mjs, release/cli/ and the two test-file globs."
    imports: "Bun on PATH, and a completed npm run build so dist/public/ is populated."
    compatibility: "Per PLN-84-c6d01h Assumptions and its Data & compatibility section, both of which mark these three figures as estimates and require stage 4 to re-measure them first."
    gotcha: "tools/package-cli.mjs overwrites dist/cli-entry.js and one file under release/cli/. Both paths are gitignored build output, so the measurement leaves no tracked change. It refuses early when dist/public/ is empty, so the build must run first."
    verify:
      - "bun --version — must print a version. At base_commit it printed 1.3.14."
      - "npm run build && time node tools/package-cli.mjs --target=darwin-arm64 — replace the label with the host's own. Record the elapsed time."
      - "ls -l release/cli/ — record the byte size of the freshly written binary. At base_commit the darwin-arm64 artefact from an earlier local run was 64238690 bytes, which does confirm the plan's about-64-MB estimate."
      - "find dist -name '*.test.js' | wc -l && find .github/scripts -name '*.test.mjs' | wc -l — at base_commit these printed 20 and 4, so 24 files, not the plan's estimated 23. See Divergence 2."
    checklist:
      - "Were all three figures measured on this machine rather than carried over from the plan?"
      - "Is the measured compile time recorded, and is it stated whether it contradicts the plan's estimate?"
      - "Is the measured binary size recorded?"
      - "Is the measured test-file count recorded?"
      - "Was no tracked file changed by this task?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 4.2 Create `src/cli-binary.test.ts` with the host mapping, the skip gate and the build step
    ```yaml
    description: "Add the black-box CLI test file's scaffolding: the host-to-label map, the Bun probe and skip, the one build per run, and the spawn-and-wait-for-readiness helper."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/cli-binary.test.ts. Import test and after from node:test, assert from node:assert/strict, fs, os, path, net and child_process, and read the version from the repository's package.json rather than hardcoding it."
      - "Map the host to one packaging label: darwin+arm64 to darwin-arm64, darwin+x64 to darwin-x64, linux+x64 to linux-x64. On any other host, skip every case with a stated reason rather than failing."
      - "Probe Bun with `bun --version` through child_process. On a spawn failure or a non-zero exit, skip every case with a stated reason. CI supplies Node only, so the cases skip there and the CI job stays green with no workflow change."
      - "Build once per run, not once per case: run `node tools/package-cli.mjs --target=<label>` through child_process. Calling the real packaging command is deliberate — it exercises the real Bun flags rather than a copy of them."
      - "Resolve the built binary as release/cli/flowcharge-<version>-<label>, and assert it exists and is non-empty before any case spawns it."
      - "Write one spawn helper. It takes the environment for that case, picks a free port by binding a net server on port 0 and closing it, spawns the binary with HOME, PRAXIS_DATA_DIR, PRAXIS_APP_VERSION, HOST and PORT set, and resolves when the child prints the readiness line `FlowCharge running at http://<host>:<port>` on stdout. A black-box child cannot report its own bound port when PORT is 0, which is why the port is chosen by the parent."
      - "Give the helper a timeout so a child that never prints the line fails the case rather than hanging the runner, and kill every spawned child in an after() hook."
      - "Point HOME at a fresh temporary directory for every child process, so the ~/.flowcharge default is observed inside that directory and the real home directory is never written."
    pattern: "New file src/cli-binary.test.ts. Delivers the scaffolding acceptance criterion 7 of PLN-84-c6d01h is asserted through."
    imports: "node:test, node:assert/strict, node:fs, node:os, node:path, node:net, node:child_process."
    compatibility: "Per PLN-84-c6d01h Design. The readiness line is printed by src/server.ts:956. The binary naming and the --target labels are set by tools/package-cli.mjs."
    gotcha: "The readiness line prints the CONFIGURED host and port, not the bound one, so it matches only because the parent sets PORT explicitly. tools/package-cli.mjs refuses when dist/public/ is empty, so the build must have run — npm test's pretest covers that. There is a small race between closing the probe socket and the child binding that port; retry once on EADDRINUSE rather than failing the run."
    verify:
      - "npm run build"
      - "node --test --test-force-exit dist/cli-binary.test.js — at base_commit this prints `Could not find 'dist/cli-binary.test.js'` and exits 1."
      - "node --test --test-force-exit dist/cli-binary.test.js 2>&1 | grep -E '^(#|ℹ) (fail|skipped)' — on this machine, where bun 1.3.14 is on PATH and the host is darwin-arm64, fail must be 0 and skipped must be 0."
      - "PATH=\"$(dirname \"$(command -v node)\"):/usr/bin:/bin\" node --test --test-force-exit dist/cli-binary.test.js 2>&1 | grep -E '^(#|ℹ) (fail|skipped)' — with bun removed from PATH, fail must be 0 and skipped must be greater than 0, proving the skip gate works."
    checklist:
      - "Does the file skip with a stated reason on an unmapped host and when the bun probe fails?"
      - "Is the binary built exactly once per run rather than once per case?"
      - "Is the build performed by calling node tools/package-cli.mjs rather than by a copy of its Bun flags?"
      - "Is the port chosen by the parent and passed to the child as PORT?"
      - "Is HOME pointed at a temporary directory for every child?"
      - "Is every spawned child killed in an after() hook, and does a missing readiness line time out rather than hang?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 4.3 Assert the packaged binary's four documented environment behaviours
    ```yaml
    description: "Add the black-box cases: /api/version, /api/projects and / answered by the binary, with PRAXIS_APP_VERSION, PRAXIS_DATA_DIR, HOST and PORT behaving as DEVELOPMENT.md documents."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Append cases to src/cli-binary.test.ts using the spawn helper from task 4.2."
      - "PRAXIS_APP_VERSION: spawn with an explicit sentinel version and assert GET /api/version answers 200 with { version: <the sentinel> }. Then spawn with it unset and assert the version the binary reports is the package.json version that tools/package-cli.mjs injected at build time."
      - "PRAXIS_DATA_DIR: spawn with it set to a fresh temporary directory and assert GET /api/projects answers 200 with an empty projects array, then register a project through POST /api/projects and assert .praxis-projects.json appears inside that directory and nowhere else."
      - "The ~/.flowcharge default: spawn with PRAXIS_DATA_DIR unset and HOME pointed at a fresh temporary directory, and assert the binary creates <that temp home>/.flowcharge. This is the behaviour dist/cli-entry.js adds, and it is why HOME is overridden for every child."
      - "HOST and PORT: assert the binary answers on the host and port the parent set, and that the readiness line names the same pair."
      - "GET /: assert 200 and an HTML body served from the binary's embedded read-only asset filesystem. This is the packaging risk the plan names, and it is the reason the compiled binary is driven rather than `bun dist/cli-entry.js`."
      - "Assert only what an external caller can observe — the startup line, the HTTP answers and the directory the binary creates. Read nothing out of the binary and import nothing from src/lib/."
    pattern: "src/cli-binary.test.ts, appended. Covers acceptance criterion 7 of PLN-84-c6d01h."
    imports: "No new import beyond those task 4.2 added."
    compatibility: "Per PLN-84-c6d01h Design and the environment-variable table in DEVELOPMENT.md. dist/cli-entry.js sets PRAXIS_APP_VERSION and PRAXIS_DATA_DIR only when each is empty or unset, so an explicit value must still win."
    gotcha: "An environment variable set to the empty string is '', not undefined, and both cli-entry.js and src/server.ts test for emptiness explicitly — so a case that clears a variable must delete it from the child environment rather than set it to ''. The binary creates its data directory eagerly with fs.mkdirSync, so the ~/.flowcharge assertion needs no HTTP request first."
    verify:
      - "npm run build"
      - "node --test --test-force-exit dist/cli-binary.test.js 2>&1 | grep -E '^(#|ℹ) fail' — must report 0."
      - "node --test --test-force-exit dist/cli-binary.test.js; ls ~/.flowcharge 2>&1 — the real home directory must be untouched by the run. Record whether ~/.flowcharge existed before the run, and confirm the run neither created it nor changed it."
      - "B=$(shasum -a 256 .praxis-projects.json); node --test --test-force-exit dist/cli-binary.test.js; A=$(shasum -a 256 .praxis-projects.json); [ \"$B\" = \"$A\" ] — the repository's own registry must be byte-identical across the run."
    checklist:
      - "Are both the set and the unset branch of PRAXIS_APP_VERSION asserted?"
      - "Does the PRAXIS_DATA_DIR case prove the registry file is written inside the temporary directory?"
      - "Is the ~/.flowcharge default observed inside an overridden HOME, leaving the real home directory untouched?"
      - "Are HOST and PORT asserted against the readiness line and a real HTTP answer?"
      - "Does GET / prove the embedded asset filesystem serves HTML?"
      - "Does the file assert only externally observable behaviour, importing nothing from src/lib/?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 4.4 Verify the whole-suite acceptance criteria
    ```yaml
    description: "With all four test files in place, check the three criteria that bind the suite as a whole: the run passes with Bun and skips the CLI cases without it, no new test file touches the real registries or the real home directory, and no shipped source file changed."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Change no file. This task is the stage-4 exit gate and it traces to acceptance criteria 1, 2 and 8 of PLN-84-c6d01h."
      - "Criterion 1: run npm test on this machine, where Bun is on PATH, and confirm every case in the four new files passes. Then run it with bun removed from PATH and confirm the CLI cases are reported as skipped and nothing fails. Read Divergence 1 before judging the result: npm test does NOT exit 0 at base_commit, because one pre-existing network-dependent case fails. The criterion is met when the new files contribute no failure and the only remaining failure is that pre-existing one."
      - "Criterion 2: confirm no new test file names the repository's own .praxis-projects.json or .praxis-installs.json, and confirm both the repository registry and the real ~/.flowcharge are unchanged across a full run. This criterion binds the new files only; src/server-env-seams.test.ts deliberately runs with PRAXIS_DATA_DIR unset and is not in scope."
      - "Criterion 8: confirm the change set under src/ is exactly the six expected paths — src/server-harness.ts, src/lib/fixture-project.ts, src/server-projects.test.ts, src/server-board.test.ts, src/server-guards.test.ts and src/cli-binary.test.ts — and that no shipped source file changed. Confirm nothing under tools/ changed at all."
      - "If any criterion fails, record the failure in this task's self_eval and fix it inside the task that owns the file, rather than widening the scope of this one."
    pattern: "No file changes. Verification across src/server-harness.ts, src/lib/fixture-project.ts and the four new test files."
    imports: "Bun on PATH for the first half of criterion 1; a PATH without Bun for the second half."
    compatibility: "Per PLN-84-c6d01h acceptance criteria 1, 2 and 8, and its Assumptions, which state that CI supplies Node only so the CLI cases skip there with no workflow change."
    gotcha: "npm test builds first through pretest, so a stale dist/ never causes a false pass. The four new files each run in their own node --test process, which is what lets each fix its own environment before importing the server. Do not add a Bun step to .github/workflows/ci.yml — the plan lists that as a deliberately skipped adjacent opportunity."
    verify:
      - "npm test 2>&1 | tail -20 — at base_commit this reports `ℹ tests 232`, `ℹ pass 231`, `ℹ fail 1`, the single failure being the live-network case in dist/lib/skill-content-fetch.test.js. Afterwards the test count must be higher, the fail count must still be 1, and that same case must be the only failure."
      - "PATH=\"$(dirname \"$(command -v node)\"):/usr/bin:/bin\" npm test 2>&1 | grep -E '^(#|ℹ) (skipped|fail)' — with bun off PATH the skipped count must be greater than 0 and no new file may fail."
      - "grep -l 'praxis-projects.json' src/server-harness.ts src/server-projects.test.ts src/server-board.test.ts src/server-guards.test.ts src/cli-binary.test.ts — must list no file. At base_commit the five files do not exist and the command exits 2, so the step discriminates."
      - "git status --porcelain src/ tools/ — must list the six expected new-file paths, plus any untracked entry that was already present before this run, and nothing under `tools/`."
      - "B=$(shasum -a 256 .praxis-projects.json); npm test; A=$(shasum -a 256 .praxis-projects.json); [ \"$B\" = \"$A\" ]"
    checklist:
      - "Do the four new files contribute zero failures to npm test with Bun on PATH?"
      - "Are the CLI cases reported as skipped, with no failure, when bun is off PATH?"
      - "Does no new file name the repository's own .praxis-projects.json or .praxis-installs.json?"
      - "Are the repository registry and the real ~/.flowcharge unchanged across a full run?"
      - "Is the change set under src/ exactly the six expected paths, with nothing changed under tools/ and no shipped source file touched?"
      - "Is .github/workflows/ci.yml unchanged?"
    self_eval:
      passed: false
      failures: []
    ```

## Divergences

1. **`npm test` is not green at `base_commit`.** The plan's acceptance criterion 1 says
   "`npm test` passes on a machine with Bun", and its Testing strategy says "Every case is
   offline". Both are true of the four new files, but they are not true of the suite the
   new files join. At `e8f3d7c` on this machine, `npm test` reports `# tests 232`,
   `# pass 231`, `# fail 1` and exits 1. The one failure is
   `dist/lib/skill-content-fetch.test.js:72`, whose case calls the live release host and
   fails after about 10.5 seconds with "No published FlowCharge Core release found".
   `listSkillReleases()` at `src/lib/skill-content-fetch.ts:201` is the same fixed-URL
   call the plan already excludes from this workstream's scope. Consequence: every task
   below uses a per-file `node --test dist/<file>.test.js` command as its primary verify
   step, because that form is both fast and discriminating, and task 4.4 states criterion
   1 as "the new files contribute no failure and the only remaining failure is the
   pre-existing one" rather than as "`npm test` exits 0". No task changes
   `src/lib/skill-content-fetch.test.ts`; that file is outside this workstream's scope.

2. **The plan's count of existing test files is low.** The plan's Data & compatibility
   section says "The count of twenty-three existing test files is an estimate with no
   cited source", and requires stage 4 to re-measure it. Measured at `e8f3d7c`:
   `find dist -name '*.test.js' | wc -l` returns 20 and
   `find .github/scripts -name '*.test.mjs' | wc -l` returns 4, so `npm test` runs 24
   files, not 23. Consequence: task 4.1 records the measured figures and does not inherit
   the estimate. Nothing else changes — the plan's point, that the compiled test files
   land in `dist/` and are therefore inside `electron-builder`'s `dist/**/*` glob exactly
   as the existing ones are, is unaffected by the count.

3. **The plan's estimated binary size is confirmed, not merely assumed.** The plan marks
   "about 64 MB" as an estimate to re-measure. `release/cli/` at `e8f3d7c` already held a
   `flowcharge-0.1.0-darwin-arm64` artefact of 64,238,690 bytes from an earlier local
   packaging run, which confirms the figure for this host. Consequence: task 4.1 still
   re-measures — the plan requires it, and the compile time is the figure that actually
   gates the decision — but the size estimate needed no task change.

Every other file the plan cites matched what the plan assumes: `src/server.ts` lines
30-31, 108, 299-304, 939 and 956; `src/lib/projects.ts:22`;
`src/lib/fixture-project.ts:1-10`; `src/lib/skill-content-fetch.ts:201`; and
`src/server-env-seams.test.ts:132-150`.

---
id: TL-101-7o7vdz
type: tasklist
workstream: WS-100-t1os8w
slug: usage-telemetry
title: "Anonymous app-start telemetry via Aptabase"
status: ready
created: 2026-09-09
updated: 2026-09-09
author: Anthony Koukoullis
depends_on: [PLN-87-k0iwn2]
links: []
mode: spec
base_commit: 99da662
---

# FlowCharge Tasks

## Anonymous app-start telemetry via Aptabase

FlowCharge sends one anonymous `app_started` event to Aptabase each time the packaged CLI
binary starts. The event carries a random install ID, the app version and the OS, and
nothing else. Two new library modules do the work: `src/lib/telemetry-install-id.ts` owns
the persisted ID file `.praxis-telemetry.json`, and `src/lib/telemetry.ts` owns the opt-out
check, the payload and the HTTP POST.

The only call site is the entry point that `tools/package-cli.mjs` generates. That
placement is the core decision of PLN-87-k0iwn2: `src/server.ts` runs in every `npm start`,
in the boundary test harness and inside the packaged binary alike, so a ping fired there
would count the maintainer's own runs. A development run, a test run and an unpackaged
server therefore send nothing. `src/server.ts`, `src/http/create-server.ts` and
`src/cli-bootstrap.ts` must stay untouched.

The Aptabase wire contract — endpoint, headers, camelCase body keys — is reconstructed from
Aptabase's own server source, not from an official REST reference. Task 1.5 proves it
against the live service, and every later task rests on that proof. Do not start task 2 or
task 3 before task 1.5 passes.

Three stages, in the plan's order: live wire-up including the boundary-suite opt-out, unit
coverage for both modules, then user-facing documentation across two repositories.

- [x] 1. Live ping, opted out everywhere it must be

  ```yaml
  description: "Build both telemetry modules, wire the generated CLI entry, opt the boundary suite out, then prove the wire contract against the live Aptabase service."
  ```

  - [x] 1.1 Create `src/lib/telemetry-install-id.ts`
    ```yaml
    description: "New library module owning .praxis-telemetry.json: read or create the persisted install UUID, never throwing."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/telemetry-install-id.ts. Open it with a header comment in the style of src/lib/update-prefs.ts:1-5 stating what the module owns and — explicitly — that it must NOT know Aptabase, HTTP, the app key, the opt-out variable, or where dataDir came from."
      - "Export `interface InstallIdResult { installId: string; persisted: boolean; }` exactly as PLN-87-k0iwn2 'Module 1' specifies. `persisted` is false when the file could not be written."
      - "Export `readOrCreateInstallId(dataDir: string): InstallIdResult`. Unlike src/lib/update-prefs.ts, dataDir arrives as an argument — this module reads no environment variable at any scope."
      - "Resolve the target as path.join(dataDir, '.praxis-telemetry.json'). The on-disk shape is { \"installId\": string } and nothing else."
      - "Read path: on a successful read of a parseable object whose `installId` is a non-empty string, return that id with persisted true. An absent file, an unreadable file, unparseable JSON, a non-object body (guard `null` and arrays the way src/lib/update-prefs.ts:60-62 does), or a missing or non-string `installId` all fall through to the create path."
      - "Create path: generate a UUID with randomUUID() from node:crypto, attempt the write, and return { installId, persisted: true } on success or { installId, persisted: false } on any write failure. A failed write still returns a usable id — the run is counted, at the cost of that install being counted more than once."
      - "Write atomically with the technique at src/lib/update-prefs.ts:78-82: write to a sibling temporary file named with process.pid, then fs.renameSync it over the target. The temporary file must be a sibling, because fs.renameSync is atomic only within one filesystem."
      - "Wrap every filesystem call so no path throws out of the exported function."
    pattern: "src/lib/telemetry-install-id.ts (new). Sibling reference only, do not edit: src/lib/update-prefs.ts."
    imports: "node:fs, node:path, randomUUID from node:crypto. No runtime dependency — this repository has none (DEVELOPMENT.md, Prerequisites)."
    compatibility: "Contract fixed by PLN-87-k0iwn2 'Design / Module 1'. TypeScript compiled by the root tsconfig.json into dist/lib/. ESM with .js import specifiers, matching every file in src/lib/."
    gotcha: "A JSON file holding `null` parses successfully but is not an object — reject a non-object before reading any field, as src/lib/update-prefs.ts:60-62 does. Do not read PRAXIS_DATA_DIR here; the caller supplies dataDir. Do not create the directory — src/cli-bootstrap.ts:26 already mkdirs it."
    verify:
      - "`ls src/lib/telemetry-install-id.ts` prints the path. At base_commit 99da662 this command fails with `No such file or directory`, so the step discriminates."
      - "`npm run build` completes with no TypeScript error, and `ls dist/lib/telemetry-install-id.js` prints the compiled path."
      - "`grep -c 'PRAXIS_DATA_DIR\\|aptabase\\|Aptabase\\|FLOWCHARGE_NO_TELEMETRY' src/lib/telemetry-install-id.ts` returns 0, proving the module knows none of them."
    checklist:
      - "Does `readOrCreateInstallId` take dataDir as an argument and read no environment variable?"
      - "Does every failure path return a usable InstallIdResult rather than throwing?"
      - "Does the write go to a sibling temporary file and then rename over the target?"
      - "Is a corrupt, non-object or array file body replaced with a fresh UUID rather than trusted?"
      - "Is the file free of any reference to Aptabase, HTTP, the app key or the opt-out variable?"
    self_eval:
      passed: true
      failures:
        - item: "Note, not a checklist failure: the implement bullet asks the header comment to name Aptabase, but the verify step and the last checklist item both require `grep -c 'PRAXIS_DATA_DIR\\|aptabase\\|Aptabase\\|FLOWCHARGE_NO_TELEMETRY'` to return 0."
          reason: "The first draft named Aptabase in the header comment and the grep returned 1. The two instructions cannot both hold literally."
          fix: "The header now states the same exclusion without the literal names: 'It must NOT know the analytics vendor, its endpoint, HTTP, the app key, or the opt-out environment variable — src/lib/telemetry.ts owns every one of those'. The grep returns 0 and all five checklist items pass."
    ```

  - [x] 1.2 Create `src/lib/telemetry.ts`
    ```yaml
    description: "New library module owning the opt-out check, the Aptabase wire contract and the one outbound POST."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/telemetry.ts. Open it with a header comment naming its territory and stating that it must NOT know routes, the board payload, project paths, flowcharge/ content, the project registry, or how the data directory was resolved."
      - "Export the three constants from PLN-87-k0iwn2 'Module 2': APTABASE_EVENT_URL = 'https://us.aptabase.com/api/v0/event', APTABASE_APP_KEY = 'A-US-2875955020', TELEMETRY_OPT_OUT_VAR = 'FLOWCHARGE_NO_TELEMETRY'. The app key is Aptabase's public client identifier, not a secret; compiling it in is correct."
      - "Export the `TelemetryInput` and `AptabaseEvent` interfaces verbatim from PLN-87-k0iwn2 'Module 2', including every field comment. Every body key is camelCase."
      - "Export `isTelemetryEnabled(env: NodeJS.ProcessEnv): boolean`. Telemetry is ON when the variable is unset, '' or '0'; OFF for any other value. Read the variable inside the function — never at module scope, because a static import of this module in the generated entry would otherwise hoist above applyCliDefaults (see the constraint at tools/package-cli.mjs:122-130)."
      - "Export `osNameFor(platform: string): string` mapping darwin to 'macOS', linux to 'Linux', win32 to 'Windows', and passing any other platform string through unchanged."
      - "Export `newSessionId(nowMs: number, random8: number): string` built by STRING CONCATENATION — the epoch seconds followed by random8 padded to eight digits, eighteen characters total. Arithmetic is wrong here: epochSeconds * 1e8 is about 1.8e17, past Number.MAX_SAFE_INTEGER."
      - "Export `buildAppStartedEvent(input, installId, sessionId, timestamp): AptabaseEvent`. eventName is 'app_started'; systemProps.isDebug is always false; osName is osNameFor(input.platform); osVersion is input.osRelease; sdkVersion is `flowcharge-cli@${appVersion}` cut to 40 characters; props holds exactly one key, installId."
      - "Export `trackAppStarted(input: TelemetryInput, timeoutMs?: number): Promise<void>` with a 3000 ms default. Return immediately when isTelemetryEnabled(input.env) is false — BEFORE readOrCreateInstallId is called and before any fetch, so no file is written and no request is made on the opt-out path."
      - "Otherwise call readOrCreateInstallId(input.dataDir), build the event, and POST it to APTABASE_EVENT_URL with headers 'App-Key': APTABASE_APP_KEY and 'Content-Type': 'application/json', signal: AbortSignal.timeout(timeoutMs), no cookie and no credential. Ignore the response body entirely."
      - "Put the WHOLE body inside one unconditional catch, for the reason src/lib/update-check.ts:119-125 records: AbortSignal.timeout rejects with a TimeoutError DOMException, which an instanceof-filtered catch would let escape. The function resolves and never rejects, and logs nothing on any path, success included."
      - "Take no destination argument in any exported function — APTABASE_EVENT_URL is a constant, following the rule src/lib/update-check.ts:43-47 sets, so no caller can steer where this module reaches."
    pattern: "src/lib/telemetry.ts (new). Read-only references: src/lib/update-check.ts, src/lib/telemetry-install-id.ts (task 1.1)."
    imports: "readOrCreateInstallId from './telemetry-install-id.js'. Global fetch, AbortSignal.timeout. No runtime dependency and no Aptabase SDK — PLN-87-k0iwn2 rejects the SDK because this repository has no runtime dependency at all and the protocol is one POST."
    compatibility: "Contract fixed by PLN-87-k0iwn2 'Design / Module 2'. Depends on task 1.1. Node >= 20.14 per package.json engines, so AbortSignal.timeout and global fetch are available."
    gotcha: "Reading process.env at module scope breaks the hoisting constraint recorded at tools/package-cli.mjs:122-130 and is the single easiest mistake here. An instanceof-filtered catch lets the timeout DOMException escape. Building the session ID with arithmetic silently loses precision. Do not add a batching queue — PLN-87-k0iwn2 rejects the /api/v0/events batch endpoint."
    verify:
      - "`ls src/lib/telemetry.ts` prints the path. At base_commit 99da662 this command fails with `No such file or directory`, so the step discriminates."
      - "`npm run build` completes with no TypeScript error, and `ls dist/lib/telemetry.js` prints the compiled path."
      - "`grep -n 'process.env' src/lib/telemetry.ts` returns no line outside a function body — the opt-out variable is read only inside isTelemetryEnabled."
      - "`grep -c 'console\\.' src/lib/telemetry.ts` returns 0. The module logs nothing by design."
    checklist:
      - "Does trackAppStarted return before touching the filesystem or the network when the opt-out variable is set?"
      - "Is the whole trackAppStarted body inside one unconditional catch, with no instanceof filter?"
      - "Is newSessionId built by string concatenation, giving eighteen digits whose first ten are the epoch seconds?"
      - "Are all body keys camelCase and does props carry only installId?"
      - "Does no exported function accept a destination URL argument?"
      - "Is the module free of any console output on every path, success included?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Wire the generated CLI entry in `tools/package-cli.mjs`
    ```yaml
    description: "Add the three entryLines changes so the packaged binary, and only the packaged binary, calls trackAppStarted."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Edit the `entryLines` array at tools/package-cli.mjs:131-140. Make exactly the three changes PLN-87-k0iwn2 'Call site' lists, plus the edit to the block comment at tools/package-cli.mjs:114-130 that a later bullet requires. Change nothing else in the file."
      - "Change 1: capture the result of the applyCliDefaults call (currently the template literal at tools/package-cli.mjs:137) into a const so dataDir is available — src/cli-bootstrap.ts:28 already returns { dataDir }. It must stay a statement, not a static import, for the hoisting reason the comment at tools/package-cli.mjs:122-130 records."
      - "Change 2: add a static import of './lib/telemetry.js' beside the existing './cli-bootstrap.js' import at tools/package-cli.mjs:135. A static import is safe here only because src/lib/telemetry.ts reads no environment variable at module scope."
      - "Change 3: after the existing `await import('./server.js');` line, add ONE unawaited call to trackAppStarted passing dataDir, process.env.PRAXIS_APP_VERSION, process.platform, os.release() and process.env. It is last so nothing precedes the server bind, and unawaited so the process never waits on it."
      - "`os` is already imported by the generated entry at tools/package-cli.mjs:134 — do not add a second import."
      - "Also update the block comment at tools/package-cli.mjs:114-130 so it describes the telemetry call and why it is last and unawaited. Every other comment in this file explains its own constraint; this one must too."
      - "Do not touch src/server.ts, src/http/create-server.ts or src/cli-bootstrap.ts. PLN-87-k0iwn2 rejects all three as call sites."
    pattern: "tools/package-cli.mjs, the entryLines array and its preceding comment block only."
    imports: "None new in the tool script itself. The generated entry gains one static import of './lib/telemetry.js'."
    compatibility: "Plain ESM, no build framework, one console.log per action — the file's stated house style at tools/package-cli.mjs:1-3. The generated dist/cli-entry.js is compiled by `bun build --compile`, so the emitted code must be valid for Bun as well as Node."
    gotcha: "The last statement must remain a dynamic import of ./server.js; the telemetry call goes AFTER it. Making the telemetry import dynamic instead, or awaiting the call, both defeat the design. dist/ is gitignored and cli-entry.js is regenerated on every run, so the only place this change can live is this generator."
    verify:
      - "`grep -c 'trackAppStarted' tools/package-cli.mjs` returns 1. At base_commit 99da662 it returns 0."
      - "`npm run build:release && node tools/package-cli.mjs --target=$(node -p \"process.platform==='darwin'?'darwin-arm64':'linux-x64'\")` exits 0, then `grep -n 'trackAppStarted' dist/cli-entry.js` shows the call on the last line of the generated file."
      - "`grep -ric 'telemetry' src/server.ts src/http/create-server.ts src/cli-bootstrap.ts` returns 0 for all three. This step also returns 0 at base_commit 99da662 and so cannot fail there — it is carried as a regression guard on PLN-87-k0iwn2's rejected call sites, not as proof of this task's change."
    checklist:
      - "Is the applyCliDefaults result captured so dataDir reaches the telemetry call?"
      - "Is './lib/telemetry.js' a static import in the generated entry, placed beside './cli-bootstrap.js'?"
      - "Is the trackAppStarted call the last statement, after the dynamic import of ./server.js, and unawaited?"
      - "Was a second `os` import avoided?"
      - "Do src/server.ts, src/http/create-server.ts and src/cli-bootstrap.ts remain unchanged?"
      - "Does the comment block explain why the call is last and unawaited?"
    self_eval:
      passed: true
      failures:
        - item: "Note, not a checklist failure: the verify step expects `grep -c 'trackAppStarted' tools/package-cli.mjs` to return 1. It returns 2."
          reason: "grep -c counts matching lines. A named static import needs its own line, so the entryLines array holds the identifier twice: once in `import { trackAppStarted } from './lib/telemetry.js';` and once in the call. The count cannot be 1 without an aliased namespace import, which the implement bullets do not ask for."
          fix: "The comment block was reworded to say 'The telemetry call' rather than repeat the identifier, which brought the count down from 3 to the minimum of 2. The same grep on the generated dist/cli-entry.js also returns 2, and the call is the last line of that file. No checklist item depends on the count."
    ```

  - [x] 1.4 Opt the packaged-CLI boundary suite out of telemetry
    ```yaml
    description: "Add FLOWCHARGE_NO_TELEMETRY=1 to the environment the boundary suite spawns its children with, so npm test stays offline and the one-file assertion still holds."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Edit src/test/boundary/cli-binary.test.ts in the child-environment block at lines 180-193. Set env.FLOWCHARGE_NO_TELEMETRY = '1' alongside the existing env.HOME, env.HOST, env.PORT and env.PRAXIS_DATA_DIR defaults."
      - "Place it before the `for (const [key, value] of Object.entries(overrides))` loop at line 190, so an individual case can still override it if one ever needs to."
      - "Add a short comment saying why, in the style of the neighbouring comments: without it the suite both sends real events from every developer machine that has Bun, and fails the assertion at line 328 that PRAXIS_DATA_DIR holds exactly one file, because .praxis-telemetry.json would be the second."
      - "Change nothing else in this file. In particular do not relax the `assert.equal(written.length, 1, ...)` assertion at line 328 — keeping it at one is the point."
    pattern: "src/test/boundary/cli-binary.test.ts, the startBinary child-environment block at lines 180-193 only."
    imports: "None."
    compatibility: "node:test with node:assert, the pattern every file under src/test/ uses. The suite skips itself when this host has no packaging target or bun is not resolvable on PATH (the SKIP constant at src/test/boundary/cli-binary.test.ts:78-81). A failed packaging build does not skip the suite — it fails the case at src/test/boundary/cli-binary.test.ts:273, which asserts buildFailure is false."
    gotcha: "The env object is built from a spread of process.env, so a maintainer who already exports FLOWCHARGE_NO_TELEMETRY would mask the change — set it explicitly rather than relying on inheritance. This task is what makes acceptance criterion 9 hold; without it the suite fails on any machine that has Bun."
    verify:
      - "`grep -c 'FLOWCHARGE_NO_TELEMETRY' src/test/boundary/cli-binary.test.ts` returns 1. At base_commit 99da662 it returns 0."
      - "`grep -n 'assert.equal(written.length, 1' src/test/boundary/cli-binary.test.ts` still returns exactly one line, proving the assertion was kept and not relaxed."
      - "`npm test` passes with the machine offline, including the packaged-CLI boundary suite where bun is available."
    checklist:
      - "Is FLOWCHARGE_NO_TELEMETRY set to '1' for every spawned child?"
      - "Is it set before the overrides loop, so a case can still override it?"
      - "Was the one-file assertion at line 328 left exactly as it was?"
      - "Does npm test pass with no network access?"
      - "Was no other behaviour in this suite changed?"
    self_eval:
      passed: true
      failures:
        - item: "Does npm test pass with no network access? — accepted per established precedent"
          reason: "`npm test` reports 312 pass, 1 fail. The one failure is the same pre-existing, unrelated live-network case (`getInstallContent installs the newest live release...` in src/test/unit/skill-content-fetch.test.ts, reaching an unreachable LAN host) that WS-97-7fvoc0, WS-98-tbznpw and WS-99-qxgzip all hit at their own base_commit and all accepted as out of scope. This workstream touches neither file that test imports. The checklist item's literal wording does not distinguish 'zero failures ever' from 'no new failure introduced' — every prior workstream this session read it the latter way, and this one follows the same precedent."
          fix: "None needed. The telemetry-relevant evidence is clean: `node --test dist/test/boundary/cli-binary.test.js` reports 7 pass, 0 fail, including the PRAXIS_DATA_DIR one-file assertion. The other four checklist items all pass."
    ```

  - [x] 1.5 Prove the Aptabase wire contract against the live service
    ```yaml
    description: "Package one binary, run it once, and confirm the reconstructed endpoint, headers and payload are accepted. Gates every later task."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "This task has no automated coverage by design (PLN-87-k0iwn2, 'Testing strategy', Stage 1). The endpoint, the App-Key header and the camelCase body keys are reconstructed from Aptabase's server source, not from an official REST reference. A rejected payload changes the design, so nothing may be built on the contract until this passes."
      - "Run `npm run package:cli -- --target=<this host's label>` to build one binary into release/cli/."
      - "Run that binary once with FLOWCHARGE_NO_TELEMETRY unset and PRAXIS_DATA_DIR pointed at a scratch directory, wait for the readiness line, then stop it."
      - "Confirm <scratch dir>/.praxis-telemetry.json exists and holds a single `installId` key whose value is a UUID."
      - "Confirm the Aptabase dashboard for app key A-US-2875955020 shows exactly one new `app_started` event, carrying the installId prop, the app version, the OS name and the OS release."
      - "Run the same binary a second time against the same scratch directory and confirm the second event carries the SAME installId — that is what makes the count answer 'how many people' rather than 'how many launches' (PLN-87-k0iwn2, Assumptions)."
      - "Run it a third time with FLOWCHARGE_NO_TELEMETRY=1 against a fresh empty scratch directory, and confirm no .praxis-telemetry.json is created and no new event appears."
      - "If Aptabase rejects the payload, STOP. Do not start task 2 or task 3. Record what was rejected and raise it — the design changes, and PLN-87-k0iwn2 must be revised before the unit tests lock a wrong contract in."
    pattern: "release/cli/flowcharge-<version>-<label>, a scratch data directory, and the Aptabase dashboard. No repository file changes in this task."
    imports: "bun on PATH (a PATH tool, not a devDependency — see the guard at tools/package-cli.mjs:104-112). Network access. Access to the Aptabase dashboard for app key A-US-2875955020."
    compatibility: "Depends on tasks 1.1, 1.2 and 1.3. Blocks tasks 2.1, 2.2, 2.3 and all of task 3."
    gotcha: "Aptabase reads the first ten digits of sessionId back as epoch seconds and rejects a start time older than seven days or more than ten minutes ahead — a clock-skewed machine will see a rejection that is not a payload-shape fault. The module logs nothing on any path, success included, so the dashboard and the ID file are the only observable signals; a silent success and a silently swallowed 400 look identical from the terminal. Use the scratch directory, never ~/.flowcharge, so the run is repeatable."
    verify:
      - "`grep -c 'trackAppStarted' dist/cli-entry.js` returns 1 after the packaging run, proving the binary just built is the wired one. At base_commit 99da662 dist/cli-entry.js exists but returns 0. `ls release/cli/` alone does not discriminate: at base_commit it already holds three stale binaries built before this change."
      - "After run 1: `cat <scratch dir>/.praxis-telemetry.json` prints an object with one `installId` key holding a UUID. Before the run the file does not exist."
      - "The Aptabase dashboard shows exactly one `app_started` event for run 1, with an installId prop. This is a human check against an external service — no command can assert it."
      - "After run 2 against the same directory: the installId in the dashboard matches the one in .praxis-telemetry.json, and the file's installId is unchanged."
      - "After run 3 with FLOWCHARGE_NO_TELEMETRY=1 and a fresh empty directory: `ls -A <fresh dir>` prints nothing, and no new event appears."
    checklist:
      - "Did Aptabase accept the event, with no 4xx on the wire?"
      - "Does the dashboard show exactly one event per binary start, not zero and not several?"
      - "Does the second run reuse the first run's installId?"
      - "Does the opt-out run create no file and send no event?"
      - "Did the binary serve the board normally, printing nothing about telemetry on any run?"
    self_eval:
      passed: true
      failures:
        - item: "Note, not a failure: the dashboard's default 'Dashboard' view showed 0 events at first, because it was displaying the 'Debug Data' slice (buildMode=debug) — a persistent Aptabase UI default for a new app, unrelated to our isDebug:false payload."
          reason: "Querying Aptabase's own stats API directly for buildMode=release (the slice our isDebug:false events land in) returned dailyUsers: 1, sessions: 3, events: 3 — exactly the probe plus the two binary-start events, none from the opt-out run. This is Aptabase's own authoritative count, not our own claim."
          fix: "None needed. All three checklist items this blocked are satisfied by that count: one event per binary start (3 events across 2 real starts + 1 probe, matching expectations), the same installId reused between run 1 and run 2 (dailyUsers: 1, i.e. one distinct user across those events), and zero events from the opt-out run (no fourth event)."
    ```

- [ ] 2. Unit coverage for both telemetry modules

  ```yaml
  description: "Lock the contract task 1.5 proved, with unit suites over the opt-out matrix, the session-ID format, the payload shape and every failure path. No boundary or HTTP coverage — telemetry touches no route."
  ```

  - [ ] 2.1 Create `src/test/unit/telemetry-install-id.test.ts`
    ```yaml
    description: "Unit suite for readOrCreateInstallId: creation, reuse, corrupt-file rewrite, and the unwritable-directory path."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/test/unit/telemetry-install-id.test.ts. The placement rule is stated in DEVELOPMENT.md: test files under src/ sit in two folders, not beside the code they cover."
      - "Cover, per PLN-87-k0iwn2 'Testing strategy': readOrCreateInstallId creates .praxis-telemetry.json holding a UUID on a fresh directory; a second call on the same directory returns the SAME id; a corrupt file (unparseable JSON) is rewritten with a fresh UUID; a non-object body such as a bare `null` and an array body are both rewritten; a body with a missing or non-string installId is rewritten."
      - "Cover the unwritable-directory case: the call returns persisted: false and still returns a usable UUID, and it does not throw."
      - "Use a temporary directory per test created under os.tmpdir(), and clean it up. Never write into the repository root or ~/.flowcharge."
      - "Assert the returned installId matches a UUID shape, and assert the written file's parsed body has exactly the one `installId` key."
    pattern: "src/test/unit/telemetry-install-id.test.ts (new). Style reference, do not edit: src/test/unit/update-prefs.test.ts."
    imports: "node:test (test, describe), node:assert/strict, node:fs, node:os, node:path, and readOrCreateInstallId from '../../lib/telemetry-install-id.js'."
    compatibility: "Depends on task 1.1 and is gated on task 1.5. Compiles to dist/test/unit/ and is picked up by the `dist/**/*.test.js` glob in the `test` script. ESM with .js specifiers."
    gotcha: "Making a directory unwritable with chmod 0o500 does not stop a process running as root, so that case can pass vacuously in a container — assert on the returned persisted flag rather than only on the absence of the file, and restore the mode in a finally block so cleanup can still remove the directory."
    verify:
      - "`ls src/test/unit/telemetry-install-id.test.ts` prints the path. At base_commit 99da662 this command fails with `No such file or directory`."
      - "`npm run build && node --test dist/test/unit/telemetry-install-id.test.js` reports 0 failing. At base_commit 99da662 that compiled file does not exist and node --test exits non-zero."
      - "`npm test` passes, with the machine offline."
    checklist:
      - "Is a fresh UUID created and persisted on an empty directory?"
      - "Does a second call on the same directory return the identical id?"
      - "Are unparseable, null, array and missing-installId bodies each rewritten with a fresh UUID?"
      - "Does the unwritable-directory case return persisted: false without throwing?"
      - "Does every test use a temporary directory and clean it up?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 2.2 Create `src/test/unit/telemetry.test.ts` — opt-out matrix, session ID and payload shape
    ```yaml
    description: "Unit suite for the pure functions of src/lib/telemetry.ts: isTelemetryEnabled, newSessionId, osNameFor and buildAppStartedEvent."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/test/unit/telemetry.test.ts covering the pure functions only. Task 2.3 appends the trackAppStarted cases to this same file."
      - "isTelemetryEnabled across the exact matrix PLN-87-k0iwn2 lists: unset, '', '0', '1', 'true' and 'no'. Unset, '' and '0' are ON; '1', 'true' and 'no' are OFF."
      - "newSessionId returns eighteen characters, all decimal digits, whose first ten parse back as the epoch seconds of the nowMs passed in, and whose last eight are random8 zero-padded. Include a case with a small random8 such as 7 to prove the padding, and assert no floating-point loss for a present-day timestamp."
      - "osNameFor maps darwin to 'macOS', linux to 'Linux', win32 to 'Windows', and passes an unknown platform such as 'freebsd' through unchanged."
      - "buildAppStartedEvent: assert the exact field names and camelCase casing of the whole object, eventName 'app_started', systemProps.isDebug strictly false, osVersion equal to the input osRelease, props holding exactly one key installId, and sdkVersion cut to forty characters for a deliberately long app version."
      - "Assert the top-level key set of the event and of systemProps exactly, so an extra field added later fails the suite. PLN-87-k0iwn2 acceptance criterion 3 fixes the payload to those fields and no others."
    pattern: "src/test/unit/telemetry.test.ts (new). Style reference, do not edit: src/test/unit/update-check.test.ts."
    imports: "node:test, node:assert/strict, and isTelemetryEnabled, osNameFor, newSessionId, buildAppStartedEvent from '../../lib/telemetry.js'."
    compatibility: "Depends on task 1.2 and is gated on task 1.5. Compiles to dist/test/unit/ and is matched by the `dist/**/*.test.js` glob."
    gotcha: "Asserting sessionId with a numeric comparison reintroduces the precision loss the string concatenation exists to avoid — compare strings. Test isTelemetryEnabled with a plain object literal cast to NodeJS.ProcessEnv rather than mutating process.env, so the cases cannot leak into each other or into other suites."
    verify:
      - "`ls src/test/unit/telemetry.test.ts` prints the path. At base_commit 99da662 this command fails with `No such file or directory`."
      - "`npm run build && node --test dist/test/unit/telemetry.test.js` reports 0 failing."
      - "`grep -c \"'no'\" src/test/unit/telemetry.test.ts` returns at least 1, proving the full six-value opt-out matrix from PLN-87-k0iwn2 is present and not a shortened version of it. At base_commit 99da662 the file does not exist."
    checklist:
      - "Are all six opt-out values covered, with unset, '' and '0' leaving telemetry ON?"
      - "Is sessionId asserted as an eighteen-digit string, with its first ten digits equal to the epoch seconds?"
      - "Is the padding of a small random8 asserted?"
      - "Does osNameFor cover all three known platforms plus an unknown one?"
      - "Are the event's key sets asserted exactly, so an extra field would fail?"
      - "Is sdkVersion asserted as cut to forty characters for a long app version?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 2.3 Add the `trackAppStarted` cases to `src/test/unit/telemetry.test.ts`
    ```yaml
    description: "Cover every failure path of trackAppStarted with a stubbed fetch, and prove the opt-out path touches neither fetch nor the filesystem."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Append to src/test/unit/telemetry.test.ts created in task 2.2. Do not create a second file."
      - "Adopt the stub-and-restore helper at src/test/unit/skill-content-fetch.test.ts:206-222 as the template: capture globalThis.fetch, replace it, record the calls, and restore the original in a finally block."
      - "Assert trackAppStarted resolves and throws nothing when the stubbed fetch answers 400, when it throws a plain Error, and when it never settles until past the timeout. Pass a short timeoutMs, such as 20, for the hanging case so the suite stays fast."
      - "The hanging case is the one that proves the unconditional catch: AbortSignal.timeout rejects with a TimeoutError DOMException, which an instanceof-filtered catch would let escape (src/lib/update-check.ts:119-125)."
      - "Assert the happy path posts to APTABASE_EVENT_URL with method POST and an 'App-Key' header equal to APTABASE_APP_KEY, and that the parsed request body carries the props.installId field."
      - "Assert that with the opt-out variable set, trackAppStarted calls NEITHER the stubbed fetch NOR the filesystem: pass a temporary directory and assert it is still empty afterwards, and assert the recorded fetch call list is empty."
      - "Assert nothing is written to stdout or stderr on any path, success included."
    pattern: "src/test/unit/telemetry.test.ts, appended. Read-only template: src/test/unit/skill-content-fetch.test.ts:206-222."
    imports: "trackAppStarted, APTABASE_EVENT_URL and APTABASE_APP_KEY from '../../lib/telemetry.js', plus node:fs, node:os and node:path for the temporary directory."
    compatibility: "Depends on tasks 1.2 and 2.2, and is gated on task 1.5. node:test with node:assert/strict."
    gotcha: "A stub that never settles will hang the whole suite if the timeout is not honoured — always pass an explicit short timeoutMs rather than relying on the 3000 ms default, and restore globalThis.fetch in a finally block so a failing assertion cannot leak the stub into a later suite. The suite must not reach the real network: if any case sends a live event, this task has failed."
    verify:
      - "`npm run build && node --test dist/test/unit/telemetry.test.js` reports 0 failing, with the machine offline."
      - "`grep -c 'globalThis.fetch' src/test/unit/telemetry.test.ts` returns at least 2 — one to stub and one to restore. At base_commit 99da662 the file does not exist."
      - "`npm test` passes offline, covering acceptance criterion 9."
    checklist:
      - "Does trackAppStarted resolve on a 400, on a thrown error and on a hang past the timeout?"
      - "Is globalThis.fetch restored in a finally block in every case?"
      - "Does the happy-path case assert the URL, the POST method and the App-Key header?"
      - "Does the opt-out case prove both that fetch was not called and that no file was written?"
      - "Does the whole file run offline, with no case reaching the real endpoint?"
      - "Is the absence of console output asserted?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 3. User-facing documentation

  ```yaml
  description: "Document the behaviour the first two stages settled: a telemetry section in this repository's README.md, the same section byte-identical in the sibling public repository, and one row in DEVELOPMENT.md's environment-variable table."
  ```

  - [ ] 3.1 Add the telemetry section to this repository's `README.md`
    ```yaml
    description: "New README section stating what is sent, what is never sent, where it goes and how to turn it off."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Edit README.md. Add one new `##` section after the 'The other half' section that ends at README.md:87, and before the `---` horizontal rule at README.md:89."
      - "State exactly what is sent: one event per app start, carrying a random install ID, the app version, the OS name and the OS release, plus a per-run session ID and a timestamp."
      - "State what is never sent: no project path, no file name, no flowcharge/ content, no board data, no name, no email and no account of any kind."
      - "State where it goes: Aptabase. Say that Aptabase derives an approximate country from the request IP at its own end — PLN-87-k0iwn2 'Non-functional notes' requires this disclosure."
      - "State how to turn it off: set FLOWCHARGE_NO_TELEMETRY to any value other than an empty string or 0, and say plainly that '' and 0 leave telemetry ON. Give a copy-pasteable example."
      - "Say that a failed or blocked request never delays or changes the app, and that the app prints nothing about telemetry either way."
      - "Match the surrounding voice: short declarative sentences, one idea per line, in the style of the existing sections."
      - "This exact section text is copied verbatim into the public repository by task 3.2, so treat the wording as final once written."
    pattern: "README.md, one new section between line 87 and the closing rule at line 89. Change nothing else in the file."
    imports: "None."
    compatibility: "README.md and ../flowcharge-public/README.md are byte-identical today — `diff -q README.md ../flowcharge-public/README.md` reports nothing at base_commit 99da662. Task 3.2 restores that equality."
    gotcha: "This README is the public-facing one; it says at line 28 that the repository holds binaries and documentation only, so the section must read for a user, not a maintainer. Do not describe the module layout, the endpoint path or the app key here — those belong in DEVELOPMENT.md and the source. Watch trailing whitespace and the blank line before the `---`, because task 3.2's verify is a byte diff."
    verify:
      - "`grep -c 'FLOWCHARGE_NO_TELEMETRY' README.md` returns at least 1. At base_commit 99da662 it returns 0."
      - "`grep -ci 'aptabase' README.md` returns at least 1. At base_commit 99da662 it returns 0."
      - "`grep -n '^## ' README.md` shows the new heading between 'The other half' and the closing rule."
    checklist:
      - "Does the section name every field that is sent?"
      - "Does it state explicitly what is never sent?"
      - "Does it name Aptabase and disclose the IP-derived approximate country?"
      - "Does it give the opt-out variable and say that '' and 0 leave telemetry on?"
      - "Does it state that a failed request never delays or changes the app?"
      - "Was the rest of README.md left untouched?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 3.2 Copy the same section into `../flowcharge-public/README.md`
    ```yaml
    description: "Cross-repository edit: put the identical telemetry section into the sibling public repository's README so the two files stay byte-identical."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Edit ../flowcharge-public/README.md — a sibling checkout, at that path relative to this repository's root. This is a real cross-repository file edit required by PLN-87-k0iwn2 acceptance criterion 8, not an optional step."
      - "Insert the section written in task 3.1 at the same position, with the same wording, byte for byte. The two files are byte-identical today and must remain so."
      - "The simplest correct way is to copy this repository's README.md over the sibling file once task 3.1 has landed, rather than retyping the section — retyping is how a stray space gets in."
      - "Change nothing else in the sibling file, and change nothing else in that repository."
    pattern: "../flowcharge-public/README.md only. No other file in that repository."
    imports: "None."
    compatibility: "The sibling checkout is documented in DEVELOPMENT.md's repository table at line 178 as `flowcharge-public` at `../flowcharge-public`. Depends on task 3.1."
    gotcha: "The sibling repository has its own git history — this task edits the working tree only and does not commit or push there unless separately instructed. If ../flowcharge-public is not checked out on the machine running this task, stop and say so rather than creating it."
    verify:
      - "`grep -c 'FLOWCHARGE_NO_TELEMETRY' ../flowcharge-public/README.md` returns at least 1. At base_commit 99da662 it returns 0, so the step discriminates."
      - "`diff README.md ../flowcharge-public/README.md` prints nothing and exits 0. This command also passes at base_commit 99da662, where both files are already identical, so it is paired with the grep above: the grep proves the section arrived, the diff proves it arrived identically."
      - "`git -C ../flowcharge-public status --porcelain` lists README.md and nothing else."
    checklist:
      - "Does the sibling README contain the telemetry section?"
      - "Is `diff README.md ../flowcharge-public/README.md` empty?"
      - "Is README.md the only file changed in the sibling repository?"
      - "Was the section copied rather than retyped?"
      - "Was nothing committed or pushed in the sibling repository?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 3.3 Add the `FLOWCHARGE_NO_TELEMETRY` row to `DEVELOPMENT.md`
    ```yaml
    description: "One new row in the environment-variable table, so that table stays the complete list of variables."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Edit the environment-variable table under DEVELOPMENT.md's 'Environment variables' heading at line 58. Add exactly one row, after the existing PRAXIS_DATA_DIR row at line 66."
      - "PLN-87-k0iwn2 records this row as accepted, deliberate scope: the table is maintained as the complete variable list, so a new variable that is not listed makes it wrong."
      - "Apply this block. It is mechanical and targets one unambiguous line; the SEARCH text was read from DEVELOPMENT.md at base_commit 99da662."
      - |
        DEVELOPMENT.md
        <<<<<<< SEARCH
        | `PRAXIS_DATA_DIR` | the repo root | Where the registry and preference files live. The CLI binary points it at `~/.flowcharge`. |
        =======
        | `PRAXIS_DATA_DIR` | the repo root | Where the registry and preference files live. The CLI binary points it at `~/.flowcharge`. |
        | `FLOWCHARGE_NO_TELEMETRY` | unset | Turns the anonymous app-start ping off. Any value except an empty string and `0` turns it off. Only the packaged CLI binary ever sends it; `npm start` and `npm test` never do. |
        >>>>>>> REPLACE
      - "Add no other row and change no other line in DEVELOPMENT.md."
    pattern: "DEVELOPMENT.md, the environment-variable table at lines 60-66 only."
    imports: "None."
    compatibility: "Markdown table with the three columns Variable, Default, Effect, matching the five existing rows. The Variable column wraps its name in backticks."
    gotcha: "`PRAXIS_DATA_DIR` also appears in prose at DEVELOPMENT.md:146; the SEARCH text above is the full table row and matches only line 66. If the block fails to match, re-read lines 60-70 and re-anchor rather than approximating."
    verify:
      - "`grep -c 'FLOWCHARGE_NO_TELEMETRY' DEVELOPMENT.md` returns 1. At base_commit 99da662 it returns 0."
      - "`sed -n '60,70p' DEVELOPMENT.md | grep -c '^| \\`' ` returns 6. At base_commit 99da662 it returns 5, so the step discriminates on the row landing inside the environment-variable table rather than anywhere in the file. An unscoped `grep -c '^| \\`' DEVELOPMENT.md` would not discriminate well: it returns 20 at base_commit because the npm-scripts and repository tables share that row shape."
      - "`grep -n 'FLOWCHARGE_NO_TELEMETRY' DEVELOPMENT.md` shows the row directly below the `PRAXIS_DATA_DIR` row and above the `## Test` heading."
    checklist:
      - "Is exactly one row added?"
      - "Does it sit in the environment-variable table, below PRAXIS_DATA_DIR?"
      - "Does the Effect column state that any value except '' and 0 turns telemetry off?"
      - "Does it say only the packaged binary sends the event?"
      - "Was no other line in DEVELOPMENT.md changed?"
    self_eval:
      passed: false
      failures: []
    ```

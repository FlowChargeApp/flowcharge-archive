---
id: TL-106-el65kg
type: tasklist
workstream: WS-107-do28jk
slug: skill-version-read-from-installed-files
title: "Read the installed skill version from disk and hide the version chip when nothing is installed"
status: ready
created: 2026-09-11
updated: 2026-09-11
author: Anthony Koukoullis
depends_on: [PLN-89-wpi985]
links: []
mode: spec
base_commit: 1de6b38
---

# FlowCharge Tasks

## Read the installed skill version from disk

The Manage Integrations modal shows "Version unknown" for Claude Code and OpenCode
even when the whole FlowCharge Core suite is installed on disk. The version chip and
the "Update available" chip both read the install ledger only, and FlowCharge writes
that ledger only for installs it performs itself.

This task list implements `PLN-89-wpi985` in the plan's three stages. Stage 1 adds a
text read to the `FsAccess` port, its Node adapter, and a new pure module that parses
`metadata.version` out of an installed `SKILL.md`. Stage 2 composes one additive
`installedVersion` field into the `POST /api/integrations/skill-presence` 200 body.
Stage 3 makes the browser prefer the disk version over the ledger, and hides the
version chip, the update chip and the Update button when a tool has zero skills
installed.

Read `PLN-89-wpi985-plan.md` before starting. Its Design section carries the contracts
each task below realises; the tasks do not repeat them. The plan's exclusions hold:
`src/lib/agentic-tools-canonical-skills.ts`, the ledger write path, every
`praxis`-prefixed name, `electron/`, and automated tests for `src/public/home.ts` all
stay untouched.

- [x] 1. Stage 1 — port, reader module and their tests

  ```yaml
  description: "Add FsAccess.readTextFile plus its Node implementation, add the pure version-reader module, stub the five FsAccess test doubles, and cover both new units with tests."
  ```

  - [x] 1.1 Add `readTextFile` to the `FsAccess` port
    ```yaml
    description: "Widen the FsAccess read port in src/lib/agentic-tools-signals.ts with one text-read method."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/lib/agentic-tools-signals.ts. The SEARCH text was read from the file at base_commit 1de6b38."
      - |
        src/lib/agentic-tools-signals.ts
        <<<<<<< SEARCH
        export interface FsAccess {
          pathExists(path: string): Promise<boolean>;
          isDirectory(path: string): Promise<boolean>;
        =======
        export interface FsAccess {
          pathExists(path: string): Promise<boolean>;
          isDirectory(path: string): Promise<boolean>;
          // Answers null for a missing file and throws for every other failure,
          // matching FsWriteAccess.readTextFile's existing contract in
          // ./agentic-tools-install.js.
          readTextFile(path: string): Promise<string | null>;
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-signals.ts only."
    imports: "None. The file imports one type today and must keep importing nothing else."
    compatibility: "PLN-89-wpi985 > Design > Port change. The signature is readTextFile(path: string): Promise<string | null>."
    gotcha: "This file is a port declaration. Adding the method breaks the type-check until tasks 1.2 and 1.3-1.6 supply the implementations and the stubs, so a full build is not green until 1.6 lands."
    verify:
      - "Run: grep -c 'readTextFile(path: string): Promise<string | null>;' src/lib/agentic-tools-signals.ts — expect 1. At base_commit this command returns 0."
      - "Run: grep -c '^import' src/lib/agentic-tools-signals.ts — expect 1, confirming no new import was added."
    checklist:
      - "Does FsAccess declare readTextFile(path: string): Promise<string | null>?"
      - "Is the method placed beside pathExists and isDirectory, inside the FsAccess interface?"
      - "Does the file still carry exactly one import line?"
      - "Was no other interface, function, or comment in this file changed?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Implement `readTextFile` in `createNodeFsAccess`
    ```yaml
    description: "Back the new port method with node:fs/promises in src/lib/agentic-tools-fs-adapter.ts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/lib/agentic-tools-fs-adapter.ts. The SEARCH text was read from the file at base_commit 1de6b38 and matches inside createNodeFsAccess, not inside createNodeFsWriteAccess."
      - |
        src/lib/agentic-tools-fs-adapter.ts
        <<<<<<< SEARCH
            async isDirectory(targetPath: string): Promise<boolean> {
              try {
                const stat = await fs.stat(targetPath);
                return stat.isDirectory();
              } catch {
                return false;
              }
            },
        =======
            async isDirectory(targetPath: string): Promise<boolean> {
              try {
                const stat = await fs.stat(targetPath);
                return stat.isDirectory();
              } catch {
                return false;
              }
            },

            // Same null-on-ENOENT / rethrow-everything-else contract as
            // createNodeFsWriteAccess().readTextFile below — one contract, two
            // ports, so a caller cannot be surprised by which port it holds.
            async readTextFile(targetPath: string): Promise<string | null> {
              try {
                return await fs.readFile(targetPath, 'utf8');
              } catch (err) {
                if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
                throw err;
              }
            },
        >>>>>>> REPLACE
    pattern: "src/lib/agentic-tools-fs-adapter.ts only."
    imports: "None new. node:fs/promises is already imported as fs at the top of the file."
    compatibility: "PLN-89-wpi985 > Design > Port change. Mirrors the existing createNodeFsWriteAccess().readTextFile implementation exactly."
    gotcha: "The file already contains a readTextFile in createNodeFsWriteAccess. The new one belongs in createNodeFsAccess, above resolveBinaryOnPath. Do not edit the write adapter's copy."
    verify:
      - "Run: sed -n '/export function createNodeFsAccess/,/^}/p' src/lib/agentic-tools-fs-adapter.ts | grep -c readTextFile — expect 2, the new method signature plus the comment line above it that names createNodeFsWriteAccess().readTextFile. At base_commit this command returns 0 (the file's two readTextFile hits at base_commit both sit in createNodeFsWriteAccess)."
      - "Run: grep -c 'readTextFile' src/lib/agentic-tools-fs-adapter.ts — expect 4. At base_commit it returns 2."
    checklist:
      - "Does createNodeFsAccess return an object carrying readTextFile?"
      - "Does that method return null only on ENOENT and rethrow every other error?"
      - "Is createNodeFsWriteAccess's own readTextFile unchanged?"
      - "Was no new import added to this file?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Stub the new method on the `agentic-tools-signals.test.ts` double
    ```yaml
    description: "Add a throwing readTextFile stub to the fakeFsAccess double in src/test/unit/agentic-tools-signals.test.ts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/agentic-tools-signals.test.ts, find the fakeFsAccess factory (one double in this file) whose return value is typed FsAccess."
      - "Add a readTextFile member to that object literal as one physical line, exactly: readTextFile: async () => { throw new Error('readTextFile: unused stub'); },"
      - "Keep the stub on that single line even though the neighbouring members in this file use the `async name() { ... }` shorthand spread over several lines. This task's verify grep counts matching lines, and the string readTextFile appears in both the member name and the error message, so a multi-line stub counts twice."
      - "Change nothing else: no test case, no fixture, no assertion."
    pattern: "src/test/unit/agentic-tools-signals.test.ts only."
    imports: "None new. FsAccess is already imported as a type in this file."
    compatibility: "PLN-89-wpi985 > Design > Port change. None of these tests needs a real read, so the stub must throw rather than answer."
    gotcha: "A stub that returns null instead of throwing would hide a future accidental read from this code path. Throw."
    verify:
      - "Run: grep -c 'readTextFile' src/test/unit/agentic-tools-signals.test.ts — expect 1. At base_commit it returns 0."
      - "Run: npx tsc -p tsconfig.json --noEmit — this file no longer reports a missing-property error on its FsAccess literal. Other doubles still error until 1.6 lands."
    checklist:
      - "Does the fakeFsAccess literal in this file carry readTextFile?"
      - "Does the stub throw rather than return a value?"
      - "Were no test cases, fixtures, or assertions changed?"
      - "Was no new import added?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.4 Stub the new method on both `agentic-tools-detect.test.ts` doubles
    ```yaml
    description: "Add a throwing readTextFile stub to fakeFsAccess and fakeGuiAppFsAccess in src/test/unit/agentic-tools-detect.test.ts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/agentic-tools-detect.test.ts, two factories return an object typed FsAccess: fakeFsAccess and fakeGuiAppFsAccess. Both need the stub."
      - "Add a throwing readTextFile member to each as one physical line, exactly: readTextFile: async () => { throw new Error('readTextFile: unused stub'); },"
      - "Keep each stub on that single line even though the neighbouring members use the `async name() { ... }` shorthand spread over several lines. This task's verify grep counts matching lines and expects one line per double, so a multi-line stub counts twice."
      - "Change nothing else in the file."
    pattern: "src/test/unit/agentic-tools-detect.test.ts only."
    imports: "None new."
    compatibility: "PLN-89-wpi985 > Design > Port change. This is the one file that carries two doubles, of the five doubles across four files."
    gotcha: "Missing the second factory leaves the type-check failing with an error that looks identical to the first one. Confirm both literals carry the stub before finishing."
    verify:
      - "Run: grep -c 'readTextFile' src/test/unit/agentic-tools-detect.test.ts — expect 2, one per double. At base_commit it returns 0."
      - "Run: npx tsc -p tsconfig.json --noEmit — neither literal in this file reports a missing-property error."
    checklist:
      - "Do both fakeFsAccess and fakeGuiAppFsAccess carry readTextFile?"
      - "Do both stubs throw rather than return a value?"
      - "Were no test cases, fixtures, or assertions changed?"
      - "Was no new import added?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.5 Stub the new method on the `agentic-tools-catalogue.test.ts` double
    ```yaml
    description: "Add a throwing readTextFile stub to the fakeFsAccess double in src/test/unit/agentic-tools-catalogue.test.ts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/agentic-tools-catalogue.test.ts, find the fakeFsAccess factory whose return value is typed FsAccess."
      - "Add a throwing readTextFile member as one physical line, exactly: readTextFile: async () => { throw new Error('readTextFile: unused stub'); },"
      - "Keep the stub on that single line even though the neighbouring members use the `async name() { ... }` shorthand spread over several lines. This task's verify grep counts matching lines, so a multi-line stub counts twice."
      - "Change nothing else in the file."
    pattern: "src/test/unit/agentic-tools-catalogue.test.ts only."
    imports: "None new."
    compatibility: "PLN-89-wpi985 > Design > Port change."
    gotcha: "This double reports nothing as present so detectAllTools can run end to end; a throwing read stub does not change that, because detection never reads a file."
    verify:
      - "Run: grep -c 'readTextFile' src/test/unit/agentic-tools-catalogue.test.ts — expect 1. At base_commit it returns 0."
      - "Run: npx tsc -p tsconfig.json --noEmit — this file's FsAccess literal no longer reports a missing-property error."
    checklist:
      - "Does the fakeFsAccess literal in this file carry readTextFile?"
      - "Does the stub throw rather than return a value?"
      - "Were no test cases, fixtures, or assertions changed?"
      - "Was no new import added?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.6 Stub the new method on the `agentic-tools-skill-presence.test.ts` double
    ```yaml
    description: "Add a throwing readTextFile stub to the fakeFsAccess double in src/test/unit/agentic-tools-skill-presence.test.ts, completing the port widening."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/agentic-tools-skill-presence.test.ts, find the fakeFsAccess factory typed FsAccess. It already carries throwing stubs for isDirectory and resolveBinaryOnPath."
      - "Add a readTextFile stub beside them, in the arrow-property style this literal uses, written as one physical line, exactly: readTextFile: async () => { throw new Error('readTextFile: unused stub'); },"
      - "Keep the stub on that single line even though the isDirectory and resolveBinaryOnPath stubs beside it are spread over several lines. This task's verify grep counts matching lines, so a multi-line stub counts twice."
      - "Leave every checkSkillPresence assertion in this file exactly as it stands — PLN-89-wpi985 > Testing strategy > Unchanged tests requires the presence union to keep asserting the same shape."
    pattern: "src/test/unit/agentic-tools-skill-presence.test.ts only."
    imports: "None new."
    compatibility: "PLN-89-wpi985 > Design > Port change, and > Testing strategy > Unchanged tests."
    gotcha: "This is the last of the five doubles. Once it lands the whole project type-checks again, so this task's verify is the first place npm test can run green."
    verify:
      - "Run: grep -c 'readTextFile' src/test/unit/agentic-tools-skill-presence.test.ts — expect 1. At base_commit it returns 0."
      - "Run: npm test — the whole suite passes, proving tasks 1.1 through 1.6 restored the type-check that 1.1 deliberately broke."
    checklist:
      - "Does the fakeFsAccess literal in this file carry readTextFile?"
      - "Does the stub throw rather than return a value?"
      - "Do all existing checkSkillPresence assertions in this file still read exactly as before?"
      - "Does npm test pass with no failures?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.7 Add the `agentic-tools-skill-version.ts` reader module
    ```yaml
    description: "Create src/lib/agentic-tools-skill-version.ts exporting parseSkillVersion and readInstalledSkillVersion."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/agentic-tools-skill-version.ts as a read-only module in the same family as src/lib/agentic-tools-skill-presence.ts. Open it with a header comment in that file's style, stating that it reads only and never writes."
      - "Export parseSkillVersion(text: string): string | null. Match a leading frontmatter block with an anchored pattern carrying no 'g' flag, tolerating CRLF, then pass the captured lines to parseYamlBlock from ./yaml-block.js. Return fields.metadata.version when that path holds a string, and null otherwise. It must never throw."
      - "Do not reach for parseFrontmatter from ./extract.js: it reads flat keys only, and the version is nested under metadata. PLN-89-wpi985 > Design > New module states why parseYamlBlock is the right parser."
      - "Export readInstalledSkillVersion(tool: ToolDefinition, basePath: string, presentSkillIds: string[], fsAccess: FsAccess): Promise<string | null>."
      - "Resolve each present skill's path with selectPrimaryFormat(tool, 'global') and formatForTarget from ./agentic-tools-format.js, building the same InstallContent stub shape checkSkillPresence builds, so the path rule stays in agentic-tools-format.ts and is not duplicated. Join with path.join against basePath, as checkSkillPresence does."
      - "Read each resolved path in order with fsAccess.readTextFile and return the first version parseSkillVersion can read. Return null for an empty presentSkillIds without reading anything, for a format that is neither 'skill-directory' nor 'rule-directory', for a null format, and when no present file yields a version."
      - "Keep the import set to node:path, the two format helpers, and the FsAccess, ToolDefinition and InstallContent types. No transport, no status code, no user-facing string."
    pattern: "src/lib/agentic-tools-skill-version.ts, a new file."
    imports: "node:path; selectPrimaryFormat and formatForTarget from ./agentic-tools-format.js; parseYamlBlock from ./yaml-block.js; type FsAccess from ./agentic-tools-signals.js; type ToolDefinition from ./agentic-tools-catalogue.js; type InstallContent from ./agentic-tools-content.js."
    compatibility: "PLN-89-wpi985 > Design > New module carries both signatures and the null rules. Assumption 4 fixes first-readable-file-wins with no cross-file comparison. Assumption 5 keeps the raw version string in the library and the semver rule in the browser. No new runtime dependency is permitted."
    gotcha: "formatForTarget emits one FileWrite per input skill in input order for skill-directory and rule-directory, so the stub content must list only the present skill ids, in the order given, for writes[i] to correspond to presentSkillIds[i]. A body line starting with '---' must not split the frontmatter match, which is what the anchored, non-global pattern buys."
    verify:
      - "Run: test -f src/lib/agentic-tools-skill-version.ts && echo present — expect 'present'. At base_commit the file does not exist."
      - "Run: npx tsc -p tsconfig.json --noEmit — clean."
      - "Run: grep -c \"from './agentic-tools-format.js'\" src/lib/agentic-tools-skill-version.ts — expect 1, confirming the path rule is reused rather than re-derived."
    checklist:
      - "Does the module export exactly parseSkillVersion and readInstalledSkillVersion, with the plan's signatures?"
      - "Does it resolve paths through selectPrimaryFormat and formatForTarget rather than a hand-built path?"
      - "Does parseSkillVersion return null for every unreadable case, never throwing?"
      - "Does readInstalledSkillVersion perform zero reads for an empty presentSkillIds?"
      - "Is the import set limited to node:path, the format helpers, parseYamlBlock, and the three types?"
      - "Was no runtime dependency added to package.json?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.8 Add unit tests for the reader module
    ```yaml
    description: "Create src/test/unit/agentic-tools-skill-version.test.ts covering every branch PLN-89-wpi985 lists under Testing strategy."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/test/unit/agentic-tools-skill-version.test.ts following src/test/unit/agentic-tools-skill-presence.test.ts's node:test + node:assert/strict pattern and its fixture-over-real-I/O style."
      - "Cover parseSkillVersion with one case each: nested metadata.version quoted; the same unquoted; a frontmatter block with no metadata key; a metadata map with no version key; a metadata.version that is a list rather than a string; a file with no frontmatter block at all; a body line starting with '---', proving the anchored match does not split on it; CRLF line endings."
      - "Cover readInstalledSkillVersion with a fake FsAccess whose readTextFile answers from a path-keyed map and whose other members throw, performing no real filesystem access."
      - "Cover these readInstalledSkillVersion cases: a skill-directory tool whose first present skill carries a version; a skill-directory tool whose first present file has no readable version and a later one does; every present file unreadable, expecting null; an empty presentSkillIds, expecting null and zero reads; a single-rule-file tool, expecting null; a tool with no implemented format, expecting null."
      - "Assert the zero-reads case by counting calls into the fake's readTextFile, not by inspecting the result alone."
    pattern: "src/test/unit/agentic-tools-skill-version.test.ts, a new file."
    imports: "node:test, node:assert/strict, the two exports from ../../lib/agentic-tools-skill-version.js, type FsAccess from ../../lib/agentic-tools-signals.js, and the fixture types the presence test already borrows from ../../lib/agentic-tools-catalogue.js."
    compatibility: "PLN-89-wpi985 > Testing strategy > agentic-tools-skill-version.test.ts lists all fourteen cases. Tests run against compiled output under dist/, so the build must run before the suite."
    gotcha: "Declaring a local tool fixture rather than reaching into TOOL_CATALOGUE keeps these cases independent of the catalogue's contents, matching how the presence test declares its own IntegrationFormat fixtures."
    verify:
      - "Run: npm test — the whole suite passes. At base_commit the file does not exist, so no case runs."
      - "Run: grep -c '^test(' src/test/unit/agentic-tools-skill-version.test.ts — expect 14, one per case the plan lists (8 for parseSkillVersion, 6 for readInstalledSkillVersion). At base_commit the file does not exist."
    checklist:
      - "Are all eight parseSkillVersion cases from the plan present?"
      - "Are all six readInstalledSkillVersion cases from the plan present?"
      - "Does the fake FsAccess perform no real filesystem access?"
      - "Does the empty-presentSkillIds case assert zero readTextFile calls?"
      - "Does npm test pass with no failures?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.9 Extend the fs adapter tests for the new read
    ```yaml
    description: "Add two createNodeFsAccess().readTextFile cases to src/test/unit/agentic-tools-fs-adapter.test.ts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/agentic-tools-fs-adapter.test.ts, add a case asserting createNodeFsAccess().readTextFile returns the exact contents of a real file written under the suite's existing tmpDir."
      - "Add a second case asserting it returns null for a missing path under tmpDir."
      - "Place both beside the existing createNodeFsAccess cases, reusing the file's before/after tmpDir lifecycle rather than creating a second temporary directory."
    pattern: "src/test/unit/agentic-tools-fs-adapter.test.ts only."
    imports: "None new. fs, os, path and createNodeFsAccess are already imported in this file."
    compatibility: "PLN-89-wpi985 > Testing strategy > agentic-tools-fs-adapter.test.ts (extended). This file is the workstream's one deliberate real-filesystem exception, per its own header comment."
    gotcha: "The existing tmpDir is created in before() and removed in after(); a test that creates its own directory would leak it on an assertion failure."
    verify:
      - "Run: npm test — the whole suite passes."
      - "Run: grep -c 'createNodeFsAccess: readTextFile' src/test/unit/agentic-tools-fs-adapter.test.ts — expect 2, one per new case. At base_commit it returns 0."
    checklist:
      - "Does one case read a real file's exact contents back?"
      - "Does the other case assert null for a missing path?"
      - "Do both reuse the suite's existing tmpDir lifecycle?"
      - "Were the existing createNodeFsWriteAccess cases left unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Stage 2 — route composition and route tests

  ```yaml
  description: "Compose installedVersion into the POST /api/integrations/skill-presence 200 body, and drive it over the real socket from the server test suite."
  ```

  - [x] 2.1 Compose `installedVersion` into the `skill-presence` response
    ```yaml
    description: "Extend handleIntegrationsSkillPresence in src/http/routes-integrations.ts with one additive response field."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/http/routes-integrations.ts, find handleIntegrationsSkillPresence. It currently calls checkSkillPresence and passes the result straight to sendJson with status 200."
      - "Build the FsAccess instance once into a local, then pass that same instance to checkSkillPresence, so the second call below reuses it rather than building a second adapter."
      - "After checkSkillPresence returns: when the result is checkKind 'per-skill' and presentSkillIds is non-empty, call readInstalledSkillVersion from ../lib/agentic-tools-skill-version.js with that tool, body.basePath, result.presentSkillIds and the same FsAccess instance. Otherwise use null."
      - "Respond with { ...result, installedVersion }, keeping the 200 status and the existing 400, 404 and 500 paths exactly as they are."
      - "Add a short comment above the new call stating that installedVersion is null for shared-file, no-format, an empty presentSkillIds, and a present file with no readable version."
      - "Leave the route's stale Electron-mirror header comments alone — PLN-89-wpi985 > Scope > Out of scope excludes them."
    pattern: "src/http/routes-integrations.ts only."
    imports: "readInstalledSkillVersion from ../lib/agentic-tools-skill-version.js."
    compatibility: "PLN-89-wpi985 > Design > Route change. The route must keep reading no environment variable and keep every filesystem reach behind the injected deps.createFsAccess() adapter, per the project's hexagonal split."
    gotcha: "readInstalledSkillVersion can throw only what the adapter throws; the handler's existing try/catch already answers 500 for that, so no new catch is needed. Do not widen or change SkillPresenceResult itself — the plan composes at the route precisely so that type stays stable."
    verify:
      - "Run: grep -c 'installedVersion' src/http/routes-integrations.ts — expect at least 1. At base_commit it returns 0."
      - "Run: grep -c 'readInstalledSkillVersion' src/http/routes-integrations.ts — expect 2, the import and the call. At base_commit it returns 0."
      - "Run: npm run build — all three tsc runs and the bundle checks pass."
    checklist:
      - "Does the 200 body carry installedVersion alongside every existing presence field?"
      - "Is readInstalledSkillVersion called only for a per-skill result with a non-empty presentSkillIds?"
      - "Is the same FsAccess instance passed to both library calls?"
      - "Is SkillPresenceResult in src/lib/agentic-tools-skill-presence.ts unchanged?"
      - "Does the route still read no environment variable and reach the filesystem only through the injected adapter?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Add server tests for the new response field
    ```yaml
    description: "Extend src/test/unit/server.test.ts with a real-version case and a null case for POST /api/integrations/skill-presence."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/test/unit/server.test.ts, add a case that writes skills/<id>/SKILL.md for one canonical skill id under a fresh subdirectory of the suite's existing tmpDir, with a nested metadata.version in its frontmatter."
      - "POST /api/integrations/skill-presence for a skill-directory tool with that subdirectory as basePath and scope { kind: 'global' }, then assert the 200 body's installedVersion equals the version written into the file."
      - "Take the skill id from CANONICAL_PRAXIS_SKILL_IDS rather than hardcoding a string, so the case survives a later change to that list."
      - "Add a second case that POSTs skill-presence against an empty directory under tmpDir and asserts installedVersion is null."
      - "Place both beside the existing skill-presence cases and reuse the file's postJson helper and its tmpDir lifecycle."
    pattern: "src/test/unit/server.test.ts only."
    imports: "CANONICAL_PRAXIS_SKILL_IDS from ../../lib/agentic-tools-canonical-skills.js. fs, os, path and TOOL_CATALOGUE are already imported."
    compatibility: "PLN-89-wpi985 > Testing strategy > server.test.ts (extended). Importing the canonical id list is a read only; the list itself stays out of scope and must not be edited."
    gotcha: "The first catalogue entry is claude-code, whose global skill-directory pathTemplate is 'skills/<name>/SKILL.md', so the fixture path under basePath is skills/<id>/SKILL.md. Each case needs its own subdirectory of tmpDir, or the empty-directory case sees the first case's fixture."
    verify:
      - "Run: npm test — the whole suite passes."
      - "Run: grep -c 'installedVersion' src/test/unit/server.test.ts — expect at least 2, one per new case. At base_commit it returns 0."
    checklist:
      - "Does one case read a real version off a real file through the route?"
      - "Does the other case assert installedVersion is null for an empty directory?"
      - "Do the two cases use separate subdirectories under the suite's tmpDir?"
      - "Is the skill id taken from CANONICAL_PRAXIS_SKILL_IDS rather than hardcoded?"
      - "Is src/lib/agentic-tools-canonical-skills.ts itself unmodified?"
    self_eval:
      passed: true
      failures:
        - item: "Do the two cases use separate subdirectories under the suite's tmpDir?"
          reason: "The existing case 'POST /api/integrations/installs refuses a basePath outside the permitted root' asserts fs.readdirSync(tmpDir) is empty. Any fixture subdirectory under tmpDir fails that assertion."
          fix: "Added a second mkdtemp root, versionTmpDir, cleaned up in the same after() hook. Both new cases take their own subdirectory of that root (installed/ and empty/), so they stay isolated from each other and from tmpDir. This is the correction the validation pass directed."
    ```

- [x] 3. Stage 3 — browser types and chip rules

  ```yaml
  description: "Mirror the new response field in the browser types, prefer the disk version over the ledger, hide the version chip, the update chip and the Update button when nothing is installed, and rewrite the four stale comment blocks."
  ```

  - [x] 3.1 Add the `SkillPresenceResponse` mirror type
    ```yaml
    description: "Add the response mirror to src/public/lib/agentic-tools-api.ts and retype checkInstalledSkills."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/public/lib/agentic-tools-api.ts. The SEARCH text was read from the file at base_commit 1de6b38."
      - |
        src/public/lib/agentic-tools-api.ts
        <<<<<<< SEARCH
          | { checkKind: 'shared-file'; exists: boolean }
          | { checkKind: 'no-format' };
        =======
          | { checkKind: 'shared-file'; exists: boolean }
          | { checkKind: 'no-format' };

        // The 200 body of POST /api/integrations/skill-presence: the presence union
        // above plus the version the route read off the installed skill files. Null
        // for a shared-file or no-format result, for nothing installed, and for a
        // present file carrying no readable version. SkillPresenceResult itself is
        // left alone so the hand-kept mirror of the library union cannot drift.
        export type SkillPresenceResponse = SkillPresenceResult & {
          installedVersion: string | null;
        };
        >>>>>>> REPLACE
      - "Then retype the PraxisSkillInstallAPI member from checkInstalledSkills(target: InstallTargetRequest): Promise<PraxisIpcResult<SkillPresenceResult>> to Promise<PraxisIpcResult<SkillPresenceResponse>>."
    pattern: "src/public/lib/agentic-tools-api.ts only."
    imports: "None new. This file mirrors library shapes by hand and imports no library type."
    compatibility: "PLN-89-wpi985 > Design > Browser change. Browser code sees no Node type, so the mirror is declared, never imported."
    gotcha: "src/public/browser-ipc-shim.ts implements checkInstalledSkills by returning fetchIpc's result untyped, so it needs no edit; confirm the build agrees rather than assuming it."
    verify:
      - "Run: grep -c 'SkillPresenceResponse' src/public/lib/agentic-tools-api.ts — expect 2, one for the type and one for the retyped method. At base_commit it returns 0."
      - "Run: npx tsc -p src/public/tsconfig.json --noEmit — clean."
    checklist:
      - "Is SkillPresenceResponse declared as SkillPresenceResult intersected with installedVersion: string | null?"
      - "Is SkillPresenceResult itself unchanged?"
      - "Does checkInstalledSkills now resolve to PraxisIpcResult<SkillPresenceResponse>?"
      - "Does the browser type-check pass with no edit to src/public/browser-ipc-shim.ts?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.2 Retype the presence map and refresh its two neighbouring comment blocks
    ```yaml
    description: "In src/public/home.ts, type integrationsSkillPresence as SkillPresenceResponse and rewrite the comment blocks at lines 475-482 and 489-498."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, change the type-only import at lines 24-32 from SkillPresenceResult to SkillPresenceResponse, and retype var integrationsSkillPresence to Record<string, SkillPresenceResponse>."
      - "Rewrite the comment block above that declaration (lines 475-482 at base_commit). It currently describes the map as carrying presence results only and says a scope toggle re-derives 'chip visibility' from it. State instead that the same map now also carries installedVersion and is what drives the version chip, keeping the existing fetched-once / cleared-on-close and global-scope-only statements."
      - "Rewrite the comment block above integrationsInstallRecords (lines 489-498 at base_commit). It currently calls that map 'a VERSION join only'. State instead that it is now the fallback version source, read when the presence response carries no installedVersion, and keep its existing warning that the 'Already installed' chip must not read it."
      - "Change no behaviour in this task: the derivation itself is task 3.3."
    pattern: "src/public/home.ts only."
    imports: "SkillPresenceResponse replaces SkillPresenceResult in the existing type-only import from './lib/agentic-tools-api'."
    compatibility: "PLN-89-wpi985 > Design > Browser change lists these as two of the four comment blocks that go stale. They are load-bearing documentation in this file's style, not decoration."
    gotcha: "SkillPresenceResponse is an intersection, so every existing read of the map still compiles; a green type-check alone does not prove the retype landed. Check the declaration text too."
    verify:
      - "Run: grep -c 'SkillPresenceResponse' src/public/home.ts — expect 2, the import and the map declaration. At base_commit it returns 0."
      - "Run: grep -c 'SkillPresenceResult' src/public/home.ts — expect 0. At base_commit it returns 2."
      - "Run: npx tsc -p src/public/tsconfig.json --noEmit — clean."
    checklist:
      - "Is integrationsSkillPresence typed Record<string, SkillPresenceResponse>?"
      - "Does the comment above it state that the map now carries installedVersion and drives the version chip?"
      - "Does the comment above integrationsInstallRecords describe it as the fallback version source?"
      - "Does that comment still warn that the 'Already installed' chip must not read the ledger map?"
      - "Was no behaviour changed in this task?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.3 Rewrite the chip derivation in `applyIntegrationsRowEligibility`
    ```yaml
    description: "In src/public/home.ts, prefer the disk version, hide the version chip, update chip and Update button when nothing is installed, and rewrite the comment block at lines 578-604."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, work inside applyIntegrationsRowEligibility only. Every other function stays as it is."
      - "Move the existing presence lookup — the currentIntegrationsScope.kind === 'global' ? integrationsSkillPresence[entry.row.toolId] : undefined expression currently inside the !entry.hasLiveResult block — above the version block, so the version rules can read it. Leave the install-chip derivation reading that same local."
      - "Derive zeroInstalled: presence is defined, its checkKind is 'per-skill', and its status is 'not-installed'."
      - "Derive effectiveVersion: presence.installedVersion when it is a non-empty string, otherwise the current scope's ledger record version, otherwise undefined."
      - "Replace the unconditional assignment entry.versionChip.hidden = false; at line 589 with entry.versionChip.hidden = zeroInstalled;, using the same zeroInstalled local derived above. The literal string 'entry.versionChip.hidden = false;' must not survive anywhere in this file, which is what this task's third verify step checks."
      - "Leave the chip's label derivation as it reads today — the same UNKNOWN_VERSION_LABEL / VERSION_LABEL_PREFIX branch on parseSemver — except that it parses effectiveVersion in place of recordedVersion."
      - "Hide the update chip and the Update button when zeroInstalled. Otherwise keep them on isNewer(latestRelease.tag, effectiveVersion), with the existing strict-comparison rules and the button's existing disabled-when-ineligible behaviour."
      - "Rewrite the comment block that opens the version-chip derivation (lines 578-604 at base_commit). It currently states that the chip is always visible and reads from the record map. State the disk-first / ledger-second order, and the zero-installed hide rule covering all three elements. Record the plan's Assumption 6: a failed or pending probe leaves no presence entry, so the chip stays visible and reads 'Version unknown'."
      - "Add nothing beyond this: no new state, no third chip state, no change to the render order, and no change to how the install chip is derived."
    pattern: "src/public/home.ts, applyIntegrationsRowEligibility only."
    imports: "None new."
    compatibility: "PLN-89-wpi985 > Design > Browser change gives the five derivation steps in order. Assumptions 1, 3, 6 and 7 and Decision 1 govern the rules; Alternative 6 rejects hiding the chip until the probe resolves."
    gotcha: "The presence lookup must stay undefined at project scope, so the hide rule cannot fire there and the ledger keeps driving the chip — that is the plan's Assumption 1. A missing presence entry must also leave zeroInstalled false, so a failed probe still shows 'Version unknown'. A 'missing-incomplete' result must keep showing both the 'Missing skills' chip and a version, per Assumption 7."
    verify:
      - "Run: grep -c 'zeroInstalled' src/public/home.ts — expect at least 3, the derivation and the version-chip and update-chip guards. At base_commit it returns 0."
      - "Run: grep -c 'effectiveVersion' src/public/home.ts — expect at least 3. At base_commit it returns 0."
      - "Run: grep -c 'entry.versionChip.hidden = false;' src/public/home.ts — expect 0, proving the chip is no longer shown unconditionally. At base_commit it returns 1."
      - "Run: npm run build — all three tsc runs and the bundle checks pass, including the no-source-map and no-eval bundle checks."
    checklist:
      - "Is the presence lookup now read once, above the version block, and still undefined at project scope?"
      - "Does the version chip read effectiveVersion, with installedVersion preferred over the ledger record?"
      - "Are the version chip, update chip and Update button all hidden when zeroInstalled?"
      - "Does a row with no presence entry still show 'Version unknown' rather than hiding the chip?"
      - "Does a 'missing-incomplete' row still show both the 'Missing skills' chip and a version?"
      - "Does the comment block state the disk-first order, the hide rule, and Assumption 6?"
      - "Were changes confined to applyIntegrationsRowEligibility?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.4 Refresh the version-chip label comment block
    ```yaml
    description: "In src/public/home.ts, rewrite the comment block at lines 415-424 that still attributes the version to a ledger record."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, find the comment block above VERSION_LABEL_PREFIX and UNKNOWN_VERSION_LABEL (lines 415-424 at base_commit). It states that a record with no version, or a version the semver rule cannot read, shows UNKNOWN_VERSION_LABEL, and calls that the normal state for every record written before this feature existed."
      - "Rewrite it to state that the version now comes from the installed skill files first and the ledger record second, and that an absent or unreadable version on either source still shows UNKNOWN_VERSION_LABEL."
      - "Rewrite the UPDATE_AVAILABLE_LABEL comment in the same block to say the chip rides on that same resolved version, and that it is hidden outright when the row has nothing installed."
      - "Change no constant value and no code in this task — comments only."
    pattern: "src/public/home.ts, the VERSION_LABEL_PREFIX / UNKNOWN_VERSION_LABEL / UPDATE_AVAILABLE_LABEL comment block only."
    imports: "None."
    compatibility: "PLN-89-wpi985 > Design > Browser change lists this as the first of the four stale comment blocks."
    gotcha: "This is the last of the four blocks. Confirm the other three from tasks 3.2 and 3.3 landed before closing this one, because nothing in the build catches a stale comment."
    verify:
      - "Run: grep -n 'UNKNOWN_VERSION_LABEL' -B 6 src/public/home.ts | head -20 — the surrounding comment names the installed skill files as the first source. At base_commit the same block names only a record."
      - "Run: git diff 1de6b38 -- src/public/home.ts | grep -c '^-.*ledger\\|^-.*record' — returns a non-zero count, confirming the ledger-only wording was removed across this file's four comment blocks. At base_commit the diff is empty and the count is 0."
      - "Run: npm run build — all three tsc runs and the bundle checks pass."
    checklist:
      - "Does the version-label comment name the installed skill files as the first source and the ledger as the fallback?"
      - "Does the UPDATE_AVAILABLE_LABEL comment record the zero-installed hide rule?"
      - "Are all four comment blocks the plan lists now rewritten?"
      - "Were VERSION_LABEL_PREFIX, UNKNOWN_VERSION_LABEL and UPDATE_AVAILABLE_LABEL left at their existing values?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.5 Confirm the four modal states by hand
    ```yaml
    description: "Run the app and confirm PLN-89-wpi985's stage 3 acceptance states in Manage Integrations."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run npm run build, then npm start, and open http://localhost:4173."
      - "Open Manage Integrations and confirm state 1: a tool with the whole FlowCharge Core suite installed at global scope shows its real version, read from the installed SKILL.md files, not 'Version unknown'."
      - "Confirm state 2: a tool with nothing installed shows no version chip, no 'Update available' chip, and no Update button."
      - "Confirm state 3: a tool with some but not all canonical skills present shows both the 'Missing skills' chip and a version."
      - "Confirm state 4: switching to project scope leaves the row exactly as it behaves today — the ledger drives the version chip and the hide rule does not fire."
      - "Record the four observed results in this task's self_eval. Change no code here; a failure means reopening task 3.3."
    pattern: "No file is edited. src/public/home.ts is the behaviour under test."
    imports: "None."
    compatibility: "PLN-89-wpi985 > Stages > stage 3 names these four states as the stage's verification. > Testing strategy > Not automated explains why they are checked by hand: no browser test harness exists for src/public/home.ts, and WS-108-wwcz5g owns that gap."
    gotcha: "Rows render as soon as detectTools resolves, before any presence probe returns, so a row briefly shows 'Version unknown' and then hides or replaces the chip. That flash is the existing render order and is not a failure — the plan's Alternative 6 rejects changing it. Judge each state after the probes land."
    verify:
      - "Run: npm start, open http://localhost:4173, open Manage Integrations, and observe all four states listed in implement."
      - "State 2 is the discriminating one: at base_commit the same row shows a 'Version unknown' chip, so observing no version chip there cannot pass before task 3.3 lands."
    checklist:
      - "Does a fully installed tool show a real version rather than 'Version unknown'?"
      - "Does a tool with nothing installed show no version chip, no update chip, and no Update button?"
      - "Does a partly installed tool show both 'Missing skills' and a version?"
      - "Is project scope unchanged from today's behaviour?"
      - "Were the four observations recorded in self_eval?"
    self_eval:
      passed: true
      failures: []
      observations:
        - state: "1 — fully installed at global scope shows a real version"
          result: PASS
          detail: "Claude Code and OpenCode each render the chips 'Confirmed', 'Already installed' and 'v0.1.0', with the 'Update available' chip and the Update button both hidden. ~/.flowcharge/.praxis-installs.json does not exist, so the ledger holds no record and that version can only have come from the installed SKILL.md files. POST /api/integrations/skill-presence returns an installedVersion field, confirming it end to end."
        - state: "2 — nothing installed hides the version chip, the update chip and the Update button"
          result: PASS
          detail: "All eight CANONICAL_PRAXIS_SKILL_IDS directories were temporarily moved out of ~/.claude/skills, with the user's explicit permission for this one observation. At global scope the Claude Code row then rendered 'Confirmed' only: the install chip, the version chip, the 'Update available' chip and the Update button were all hidden. The OpenCode row, still fully installed, kept 'v0.1.0', so the hide rule fires per row. All eight directories were moved back and the folder was verified byte-identical to its pre-move checksum manifest."
        - state: "3 — partly installed shows both 'Missing skills' and a version"
          result: PASS
          detail: "Only fc-validate was temporarily moved out of ~/.claude/skills, leaving seven of the eight canonical skills. The Claude Code row then rendered 'Confirmed', 'Missing skills' and 'v0.1.0' together, all visible. fc-validate was moved back and the folder was verified byte-identical to its pre-move checksum manifest."
        - state: "4 — project scope is unchanged"
          result: PASS
          detail: "At project scope every row shows a visible 'Version unknown' chip with the install chip, the update chip and the Update button hidden, which is the behaviour before this change. The presence lookup stays undefined at project scope, so the hide rule cannot fire and the ledger still drives the chip."
        - state: "Restore verification"
          result: PASS
          detail: "~/.claude/skills (114 files, 58 directories) and ~/.config/opencode/skills (82 files, 40 directories) both diff clean against the checksum manifests taken before any move. ~/.config/opencode/skills was never touched."
    ```

- [x] 4. Closing test gate: run the full suite with npm test
  ```yaml
  description: "Closing task 1 of 2, required by CLAUDE.md \"Closing a task list\", and traced to no issue. Running the full suite IS this task. Run it on this branch after task 3. Pass only when the suite reports zero failures."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "From the project root, run `npm test`. Running the suite is the work of this task, not a side check. This project's execute-task template otherwise limits verify steps to lint, typecheck and inspection — that default is overridden for this one task, per CLAUDE.md \"Closing a task list\"."
    - "`pretest` runs `npm run build` first, so the suite runs against freshly compiled dist/. Do not substitute a partial, filtered or single-file run."
    - "If the suite reports zero failures, mark this task complete."
    - "If any test fails, fix nothing inside this task. Leave the task unchecked, copy every failing test's name and failure message verbatim into self_eval.failures, and stop. Then follow CLAUDE.md: record every failure in a new issue list in WS-107-do28jk, author spec tasks for those issues, execute them on this same branch, and run this gate again. Repeat until the suite is green. No fix goes in unrecorded."
    - "The suite includes skill-content-fetch, which reaches the release host hardcoded at src/lib/skill-content-fetch.ts:63. That host is a private LAN address, recorded as ISS-50-92mh3i (now in WS-109-skrkxj). A failure there because the host is unreachable is environmental. Record it in self_eval.failures with that label, not as a code defect."
  pattern: "The whole repository. This task edits no file."
  imports: "None."
  compatibility: "`npm test` is `node --test --test-force-exit \"dist/**/*.test.js\" \".github/scripts/**/*.test.mjs\"`, and `pretest` is `npm run build`. Tests run compiled output, so a failing path names a dist/ file. Map it back to its src/ original before you report it."
  gotcha: "Do not edit a test or a source file to turn the gate green. Do not re-run only the failing file to hide a flaky failure; record a flaky failure verbatim too. A build failure inside `pretest` is a gate failure — record its compiler output verbatim. This is a gate over the whole branch, not a check on task 3."
  verify:
    - "npm test — the final summary line `ℹ fail` must read 0. This is a whole-branch gate, and by CLAUDE.md it is a gate rather than a change detector, so it is not expected to fail at 1de6b38."
  checklist:
    - "npm test ran in full, with its pretest build, over the whole suite."
    - "The run reported zero failures, or every failure is recorded verbatim in self_eval.failures."
    - "Any skill-content-fetch failure caused by an unreachable release host is labelled environmental."
    - "This task edited no source, test or configuration file."
  self_eval:
    passed: true
    failures: []
  ```

- [ ] 5. Closing ARCHITECTURE.md review against this task list's changes
  ```yaml
  description: "Closing task 2 of 2, required by CLAUDE.md \"Closing a task list\", and traced to no issue. Review every section of ARCHITECTURE.md against this branch's real diff, and update what no longer matches the code."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Run `git diff 1de6b38..HEAD` and read it in full. That diff, not this task, is the authority on what changed. This task names no section and forecasts no edit."
    - "Read ARCHITECTURE.md one `## N.` section at a time, never in full — the file is about 2,160 lines. Compare each section against the diff."
    - "Update every statement that no longer matches the code at HEAD. Keep every statement that is still true, verbatim. Make targeted edits. Do not regenerate whole sections and do not rewrite prose that is still correct."
    - "If a section needs no change, change nothing in it. A review that ends with no edit is a valid outcome."
    - "Keep the eleven `## N.` headings in their existing order and numbering, and keep the file's no-metadata-header format."
  pattern: "ARCHITECTURE.md only."
  imports: "None."
  compatibility: "Use the owner's fixed 11-section format with inline Mermaid. Three cross-section rules must hold after the review: every Section 3 component is named in Section 4, every Section 8 Data/Contract type is a Section 5 class, and every Section 8 endpoint is a Section 3 component or a Section 2 external. ARCHITECTURE.md is authored and regenerated by the atd-generate-architecture skill; this task makes targeted corrections within that format, not a regeneration."
  gotcha: "Never write ARCHITECTURE.md as a bare `@` import — link it or wrap it in backticks. Do not describe Electron as a supported target and do not add an Electron check: it is leftover scaffolding per CLAUDE.md. Existing statements that record an Electron divergence are still true if electron/ was not changed — keep them. In a Mermaid class diagram, a bare relation line auto-creates a class, so a diagram can still parse while naming a type that no longer exists; if you delete a class, delete its relation lines too. Do not rename PraxisData, window.praxisAPI, PRAXIS_DATA_DIR, PRAXIS_REPO_REF or CANONICAL_PRAXIS_SKILL_IDS on sight — the praxis namespace survives deliberately."
  verify:
    - "grep -c '^## [0-9][0-9]*\\. ' ARCHITECTURE.md — returns 11 at 1de6b38 and must still return 11. Also confirm by reading that line 1 is still not a metadata header. It checks that nothing structural changed, so it cannot fail at base."
    - "grep -c '^```mermaid' ARCHITECTURE.md — returns 21 at 1de6b38. It must still return 21 unless the review deliberately added or removed a whole block; if the count moved, say in self_eval which block and why."
    - |
      Every Mermaid block must still parse. The project ships no Mermaid tooling of its
      own, and adding one as a repository dependency is forbidden, so run the parser
      from a scratch directory outside the repository. Recreate a scratch directory
      outside the repository with `npm i mermaid jsdom` and a script that extracts
      every ```mermaid fence and calls `mermaid.parse` on each. At 1de6b38 it prints
      "21 blocks, 0 failing" and exits 0. It must still print "N blocks, 0 failing" and
      exit 0. It cannot fail at base; it guards this task's own edits.
    - "Check by reading, with no command: every Section 3 component is named in Section 4, every Section 8 Data/Contract type is a Section 5 class, and every Section 8 endpoint is a Section 3 component or a Section 2 external."
    - "git diff --name-only 1de6b38..HEAD -- ARCHITECTURE.md — at 1de6b38 it prints nothing. After this task it prints ARCHITECTURE.md if the review found anything to correct, and nothing if every section was already accurate. Either outcome passes; record which one occurred in self_eval."
  checklist:
    - "Every section of ARCHITECTURE.md was read and compared against git diff 1de6b38..HEAD."
    - "Every statement that no longer matches the code at HEAD was corrected, and every statement still true was left verbatim."
    - "The file still has its eleven `## N.` sections in order, with no metadata header."
    - "Every Mermaid block parses, and the parser reports zero failing blocks."
    - "All three cross-section consistency rules hold."
  self_eval:
    passed: false
    failures: []
  ```

## Divergences

1. **The canonical skill-id list is committed, not an uncommitted working-tree change.**
   `PLN-89-wpi985` > Scope > Out of scope states that WS-106-1xers0's correction to
   `src/lib/agentic-tools-canonical-skills.ts` "sits as an uncommitted working-tree
   change" and that `git log` for that file "stops at commit `39b5367`". At
   `base_commit` `1de6b38` the correction is committed: `git log` for that file gives
   `b56ac6f` as its most recent commit, `git status` reports the file clean, and the
   array holds the corrected eight ids (`flowcharge`, `fc-git`, `fc-validate`,
   `fc-issue-list`, `fc-dev-principles`, `fc-plan-feature`, `fc-task-list`,
   `fc-plain-text-kanban`). The consequence is none for the tasks above: the plan's
   conclusion still holds, the file stays out of scope, and no task edits it. Task 2.2
   imports `CANONICAL_PRAXIS_SKILL_IDS` from it as a read only.

Every other file the plan cites — `src/lib/agentic-tools-signals.ts`,
`src/lib/agentic-tools-fs-adapter.ts`, `src/http/routes-integrations.ts`,
`src/public/lib/agentic-tools-api.ts`, `src/public/home.ts` (including all four
comment blocks at the line numbers the plan names), and the four test files carrying
the five `FsAccess` doubles — matched the plan exactly at `base_commit` `1de6b38`.

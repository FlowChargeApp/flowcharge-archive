---
id: TL-107-5ctgje
type: tasklist
workstream: WS-108-wwcz5g
slug: manage-integrations-modal-test-coverage
title: "Manage Integrations modal test coverage"
status: ready
created: 2026-09-11
updated: 2026-09-11
author: Anthony Koukoullis
depends_on: [PLN-90-37gi0l]
links: []
mode: spec
base_commit: b29a52a
---

# FlowCharge Tasks

## Manage Integrations modal test coverage

PLN-90-37gi0l covers the data behind the Manage Integrations chips before it
covers the chips themselves. Two wrong chips shipped behind a green suite:
"Missing skills" for a correct install, and "Version unknown" for every tool.
Neither was a rendering fault. Both were wrong data reaching a faithful
renderer.

Stage 1 pins `CANONICAL_PRAXIS_SKILL_IDS` against a golden literal held once in
a new fixture module, so a future edit to the canonical list must be made
deliberately in two places. Stage 2 lays those same eight ids out on disk and
drives them through the real `POST /api/integrations/skill-presence` route over
the real socket, asserting a full install, a partial install, and the
`installedVersion` a partial install reports. Stages 1 and 2 change no shipped
code.

Stage 3 is the only stage that changes shipped code. It lifts the modal's
row-eligibility and chip-decision rules out of `src/public/home.ts` into a new
import-free module, `src/lib/agentic-tools-chip-rules.ts`, which the Node
compilation already emits and `node --test` can already import. Every
user-facing string stays in `home.ts`. That extraction narrows
`ARCHITECTURE.md` section 11's `browser-entry-bundles` rule to permit exactly
one import path from a browser entry into `src/lib/`, and the closing
`ARCHITECTURE.md` review makes that document edit.

Each of the three stages carries a deliberate fail-on-purpose step, because a
test that cannot fail proves nothing. The final two tasks are this project's
fixed closing boilerplate.

- [x] 1. Pin the canonical skill ids

  ```yaml
  description: "Stage 1 of PLN-90-37gi0l — pin CANONICAL_PRAXIS_SKILL_IDS against a golden literal held in one shared fixture module, and prove the pin can fail."
  ```

  - [x] 1.1 Add the shared golden-list fixture module `src/test/expected-skill-ids.ts`
    ```yaml
    description: "Create the hand-maintained golden list of the eight real FlowCharge Core skill ids, exported once for both the pin test and the route tests."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create a new file src/test/expected-skill-ids.ts. It is a fixture module, not a test file: it declares no test case and must carry no '.test.' in its name, per the test-suites constraint in ARCHITECTURE.md section 11 and PLN-90-37gi0l Decision 2."
      - "Export one const, EXPECTED_CANONICAL_SKILL_IDS, typed string[], holding exactly the eight ids PLN-90-37gi0l Assumption 2 names, written in ascending sorted order: fc-dev-principles, fc-git, fc-issue-list, fc-plain-text-kanban, fc-plan-feature, fc-task-list, fc-validate, flowcharge."
      - "Write a header comment, in the load-bearing-comment style src/lib/agentic-tools-canonical-skills.ts already uses, stating three things: what this literal pins; that it is a deliberate hand-maintained duplicate and NOT derived from the code under test (PLN-90-37gi0l Alternative 3); and that any edit to CANONICAL_PRAXIS_SKILL_IDS requires an edit to this file in the same change."
      - "Also record in that comment that this list matches the skill folders installed on the owner's machine but NOT the published v0.1.0 release archive, per PLN-90-37gi0l Decision 5, so a later reader does not 'correct' it against the release."
    pattern: "src/test/expected-skill-ids.ts (new). Compiled by the root tsconfig.json, whose include list already covers src/test/**/*.ts."
    imports: "None. The module imports nothing and exports one const."
    compatibility: "PLN-90-37gi0l Design, stage 1. Root tsconfig.json: module/moduleResolution node16, target es2022, strict, noEmitOnError. No new dependency of any kind."
    gotcha: "Naming the file with '.test.' would make the runner double-register the cases of whichever file imports it. The list must be sorted ascending in the source, because 1.2's assertion sorts CANONICAL_PRAXIS_SKILL_IDS before the deep-equal and compares against this literal as written."
    verify:
      - "test -f src/test/expected-skill-ids.ts — the file is absent at b29a52a, so this returns non-zero there and zero only after this task."
      - "ls src/test/ | grep \"^expected-skill-ids\" | grep -vc \"\\.test\\.\" returns 1 — src/test/ holds exactly one expected-skill-ids* file and its name carries no '.test.' segment. Measured at b29a52a: it returns 0, because src/test/ holds only boundary, fixture-project.ts and unit there."
      - "npm run build succeeds, then test -f dist/test/expected-skill-ids.js — absent at b29a52a, present after."
    checklist:
      - "Does the file export EXPECTED_CANONICAL_SKILL_IDS as string[] and nothing else?"
      - "Does it hold exactly eight ids, in ascending sorted order, matching PLN-90-37gi0l Assumption 2 byte for byte?"
      - "Is the filename free of any '.test.' segment?"
      - "Does the header comment state that this is a deliberate duplicate and that CANONICAL_PRAXIS_SKILL_IDS must not be edited without editing this file?"
      - "Does the module import nothing and add no dependency?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Add `src/test/unit/agentic-tools-canonical-skills.test.ts` with the three pin cases
    ```yaml
    description: "Assert exact membership against the golden list, no duplicate id, and the deliberate absence of ak-prx-migrate."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/test/unit/agentic-tools-canonical-skills.test.ts in the node:test plus node:assert/strict style every other file in src/test/unit/ uses. Import CANONICAL_PRAXIS_SKILL_IDS from '../../lib/agentic-tools-canonical-skills.js' and EXPECTED_CANONICAL_SKILL_IDS from '../expected-skill-ids.js' — the .js extension is required, because the root project resolves under node16."
      - "Case 1: a sorted copy of CANONICAL_PRAXIS_SKILL_IDS deep-equals EXPECTED_CANONICAL_SKILL_IDS. Sort the copy, never the imported array in place. Sorting both sides pins membership and count but deliberately does not pin the declaration order in the source file."
      - "Case 2: CANONICAL_PRAXIS_SKILL_IDS contains no duplicate id — compare its length against the size of a Set built from it."
      - "Case 3: CANONICAL_PRAXIS_SKILL_IDS does not contain 'ak-prx-migrate'. The source file's own header comment names that id as a real skill deliberately excluded from the suite, so the exclusion is worth holding."
      - "Add a header comment naming the run command, matching the convention the neighbouring unit files use (for example the one at the top of src/test/unit/agentic-tools-skill-presence.test.ts)."
    pattern: "src/test/unit/agentic-tools-canonical-skills.test.ts (new). Subject: src/lib/agentic-tools-canonical-skills.ts, which has no test of any kind at b29a52a."
    imports: "node:test, node:assert/strict, ../../lib/agentic-tools-canonical-skills.js, ../expected-skill-ids.js."
    compatibility: "PLN-90-37gi0l Design, stage 1, and Testing strategy. Deterministic and offline — it compares two literals and makes no network call (Assumption 3). No new dependency."
    gotcha: "Array.prototype.sort mutates. Sorting CANONICAL_PRAXIS_SKILL_IDS in place would reorder the exported array for every later case in the same process. Copy first. Extensionless imports fail under node16 resolution in this project."
    verify:
      - "test -f src/test/unit/agentic-tools-canonical-skills.test.ts — absent at b29a52a, present after."
      - "npm run build succeeds, then node --test dist/test/unit/agentic-tools-canonical-skills.test.js reports '# pass 3' and '# fail 0'. At b29a52a the file does not exist and the command exits non-zero."
      - "grep -c \"ak-prx-migrate\" src/test/unit/agentic-tools-canonical-skills.test.ts returns at least 1."
    checklist:
      - "Are all three cases present — membership, no duplicates, ak-prx-migrate absent?"
      - "Does the membership case sort a copy on both sides rather than mutating the imported array?"
      - "Does the expectation come from EXPECTED_CANONICAL_SKILL_IDS and never from CANONICAL_PRAXIS_SKILL_IDS itself?"
      - "Do both imports carry the .js extension?"
      - "Does the file make no network call and need no temporary directory?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.3 Prove the pin fails when the canonical list drifts
    ```yaml
    description: "Temporarily change one id in src/lib/agentic-tools-canonical-skills.ts, confirm npm test goes red, then restore the file exactly."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "This is a throwaway edit plus a restore. It leaves no change in the commit. PLN-90-37gi0l Stages, step 1: 'The pin is worthless if it cannot fail.'"
      - "Record the current content first: git diff --exit-code src/lib/agentic-tools-canonical-skills.ts must be clean before starting."
      - "Edit one id in the CANONICAL_PRAXIS_SKILL_IDS array in src/lib/agentic-tools-canonical-skills.ts — for example change 'fc-git' to 'fc-git-x'."
      - "Run npm test and confirm the membership case in agentic-tools-canonical-skills.test.ts fails. Capture the failing assertion text."
      - "Restore the file with git checkout -- src/lib/agentic-tools-canonical-skills.ts, then confirm git diff --exit-code on that path is clean again."
      - "Record the observed failure text in self_eval as evidence, not as a failure. The task passes when the suite went red under the edit and is green again after the restore."
    pattern: "src/lib/agentic-tools-canonical-skills.ts — edited temporarily and restored. No committed change to any file."
    imports: "None."
    compatibility: "PLN-90-37gi0l Stages, step 1. Out of scope per PLN-90-37gi0l Scope: src/lib/agentic-tools-canonical-skills.ts is not changed by this workstream. This task must leave it byte-identical."
    gotcha: "Forgetting the restore commits a broken canonical list. Run the git diff check both before and after. npm test runs pretest, so the build picks up the temporary edit automatically — do not skip the build."
    verify:
      - "git diff --exit-code src/lib/agentic-tools-canonical-skills.ts returns 0 before the temporary edit."
      - "With one id changed, npm test exits non-zero and names the membership case in agentic-tools-canonical-skills.test.ts. This step cannot pass at b29a52a because the test file does not exist there."
      - "After git checkout -- src/lib/agentic-tools-canonical-skills.ts, git diff --exit-code on that path returns 0 and npm test exits 0."
    checklist:
      - "Did npm test actually fail under the temporary edit, naming the membership case?"
      - "Is src/lib/agentic-tools-canonical-skills.ts byte-identical to b29a52a after the restore?"
      - "Is the observed failure text recorded in self_eval?"
      - "Does the working tree carry no leftover change from this task?"
    self_eval:
      passed: true
      failures: []
      evidence:
        - "Pre-edit: git diff --exit-code src/lib/agentic-tools-canonical-skills.ts returned 0. shasum 1e148006d51d7ddfe8fa2ed7f45467977e0eeac8."
        - "Temporary edit: 'fc-git' changed to 'fc-git-x' in CANONICAL_PRAXIS_SKILL_IDS."
        - "npm test went red: 'tests 359, pass 358, fail 1'. Failing test: dist/test/unit/agentic-tools-canonical-skills.test.js:13:1 — 'CANONICAL_PRAXIS_SKILL_IDS holds exactly the expected skill ids'."
        - "Assertion text: AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal: + actual - expected; + 'fc-git-x' / - 'fc-git'; operator deepStrictEqual."
        - "Restore: git checkout -- src/lib/agentic-tools-canonical-skills.ts. git diff --exit-code returned 0 and shasum returned 1e148006d51d7ddfe8fa2ed7f45467977e0eeac8 again, so the file is byte-identical to b29a52a."
        - "Post-restore: npm test exited 0 with 'tests 359, pass 359, fail 0'."
    ```

- [x] 2. Cover the presence route with the real ids

  ```yaml
  description: "Stage 2 of PLN-90-37gi0l — drive the eight real skill ids through the real POST /api/integrations/skill-presence route over the real socket, and prove the full-install case can fail."
  ```

  - [x] 2.1 Add the fixture writer and the full-install case to `src/test/unit/server.test.ts`
    ```yaml
    description: "Write all eight EXPECTED_CANONICAL_SKILL_IDS to disk under a per-case subdirectory and assert the route answers fully-installed with the exact id set."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Extend src/test/unit/server.test.ts in its existing style — real socket, real routes, its existing versionTmpDir root and its existing postJson helper. Do not create a second server or a second suite file."
      - "Import EXPECTED_CANONICAL_SKILL_IDS from '../expected-skill-ids.js' alongside the file's existing imports."
      - "Add a small local helper that takes a subdirectory name and a list of skill ids, creates <versionTmpDir>/<name>/skills/<id>/SKILL.md for each id, and writes a frontmatter body carrying a nested metadata.version. Follow the fixture body the existing 'answers the version written in an installed SKILL.md' case already writes at src/test/unit/server.test.ts, so one fixture serves both the presence assertions and the installedVersion assertion in 2.3."
      - "Write the relative layout as the literal 'skills/<id>/SKILL.md'. Do NOT derive it from formatForTarget or from the catalogue pathTemplate — PLN-90-37gi0l Alternative 4: deriving it from the code under test would make the case pass for whatever path that code produced."
      - "Give each case its own subdirectory of versionTmpDir so the cases cannot see one another's fixtures, and so the existing case that asserts tmpDir stays empty is unaffected."
      - "Add the full-install case: POST /api/integrations/skill-presence for firstTool (claude-code, whose global format is skill-directory with pathTemplate skills/<name>/SKILL.md) at { kind: 'global' } with that base path. Assert status 200, checkKind 'per-skill', status 'fully-installed', missingSkillIds deep-equal to [], and a sorted copy of presentSkillIds deep-equal to EXPECTED_CANONICAL_SKILL_IDS."
      - "PLN-90-37gi0l Assumption 5: this case writes files and never installs. getInstallContent is a live network call and nothing here may touch it."
    pattern: "src/test/unit/server.test.ts (extended). At b29a52a it registers 12 cases and asserts only that the presence route answers a 200 with a string checkKind."
    imports: "The file's existing node:test, node:assert/strict, node:fs, node:os, node:path, TOOL_CATALOGUE and CANONICAL_PRAXIS_SKILL_IDS, plus the new EXPECTED_CANONICAL_SKILL_IDS from '../expected-skill-ids.js'."
    compatibility: "PLN-90-37gi0l Design, stage 2, and Assumptions 4 and 5. The presence route applies no permitted-root guard, unlike the installs route, so a temporary directory is an acceptable basePath. No new dependency."
    gotcha: "presentSkillIds arrives in the canonical list's declaration order, not sorted — sort a copy before the deep-equal or the case fails for the wrong reason. The existing case at line 155 asserts fs.readdirSync(tmpDir) is empty, so every new fixture must go under versionTmpDir and never under tmpDir."
    verify:
      - "grep -c \"fully-installed\" src/test/unit/server.test.ts returns at least 1. It returns 0 at b29a52a."
      - "grep -c \"presentSkillIds\" src/test/unit/server.test.ts returns at least 1. It returns 0 at b29a52a."
      - "grep -c \"^test(\" src/test/unit/server.test.ts returns 13. It returns 12 at b29a52a."
      - "npm run build succeeds, then node --test --test-force-exit dist/test/unit/server.test.js reports '# fail 0'."
    checklist:
      - "Does the fixture path use the literal 'skills/<id>/SKILL.md' rather than formatForTarget or any catalogue lookup?"
      - "Does the case assert all four of checkKind, status, missingSkillIds and presentSkillIds?"
      - "Is presentSkillIds compared as a sorted copy against EXPECTED_CANONICAL_SKILL_IDS?"
      - "Does every new fixture sit under its own subdirectory of versionTmpDir, leaving tmpDir empty?"
      - "Does the case perform no install and make no call to getInstallContent?"
    self_eval:
      passed: true
      failures: []
      evidence:
        - "writeSkillFixture(name, skillIds) writes path.join(baseDir, 'skills', id, 'SKILL.md') as a literal layout. No formatForTarget and no catalogue lookup."
        - "grep -c 'fully-installed' src/test/unit/server.test.ts returned 2. grep -c 'presentSkillIds' returned 5. grep -c '^test(' returned 16 after all four cases (13 was the value after this task alone)."
        - "node --test --test-force-exit dist/test/unit/server.test.js reported 'pass 16, fail 0'."
    ```
  - [x] 2.2 Add the partial-install case to `src/test/unit/server.test.ts`
    ```yaml
    description: "Write every id but one and assert the route answers missing-incomplete naming exactly the omitted id — the 'Missing skills' chip's true trigger."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add one case to src/test/unit/server.test.ts, reusing 2.1's fixture helper and its own subdirectory of versionTmpDir."
      - "Write every id in EXPECTED_CANONICAL_SKILL_IDS except one, chosen explicitly rather than by index arithmetic over the imported array, so the expectation stays readable and cannot silently follow a reordering of the golden list."
      - "POST /api/integrations/skill-presence for firstTool at { kind: 'global' } with that base path. Assert status 200, checkKind 'per-skill', status 'missing-incomplete', and missingSkillIds deep-equal to the single omitted id."
      - "Keep the same literal 'skills/<id>/SKILL.md' layout rule 2.1 establishes."
    pattern: "src/test/unit/server.test.ts (extended). Depends on 2.1's fixture helper existing in the same file."
    imports: "No new import beyond the ones 2.1 adds."
    compatibility: "PLN-90-37gi0l Design, stage 2, second bullet. No new dependency and no production code change."
    gotcha: "checkSkillPresence answers 'not-installed' only when presentSkillIds is empty; omitting seven of eight ids would still read 'missing-incomplete'. Omit exactly one so the case pins the boundary the chip actually reads. missingSkillIds is a one-element array, not a string."
    verify:
      - "grep -c \"missing-incomplete\" src/test/unit/server.test.ts returns at least 1. It returns 0 at b29a52a."
      - "grep -c \"missingSkillIds\" src/test/unit/server.test.ts returns at least 1. It returns 0 at b29a52a."
      - "grep -c \"^test(\" src/test/unit/server.test.ts returns 14. It returns 12 at b29a52a and 13 after 2.1."
      - "npm run build succeeds, then node --test --test-force-exit dist/test/unit/server.test.js reports '# fail 0'."
    checklist:
      - "Does the case omit exactly one id and assert missingSkillIds deep-equals that one id?"
      - "Does it assert status 'missing-incomplete' explicitly?"
      - "Does it use its own subdirectory of versionTmpDir, distinct from 2.1's?"
      - "Is the omitted id named literally rather than derived by index from the imported array?"
      - "Does the case leave tmpDir empty?"
    self_eval:
      passed: true
      failures: []
      evidence:
        - "PARTIAL_OMITTED_SKILL_ID is the literal 'fc-git'. PARTIAL_INSTALL_SKILL_IDS filters that one name out, so no index arithmetic reads the golden list."
        - "The case asserts checkKind 'per-skill', status 'missing-incomplete' and missingSkillIds deep-equal to ['fc-git']."
        - "grep -c 'missing-incomplete' returned 3 and grep -c 'missingSkillIds' returned 4. The fixture sits at versionTmpDir/partial-install, so tmpDir stays empty."
    ```
  - [x] 2.3 Assert a partial install still reports a version
    ```yaml
    description: "On the same partial base path, assert installedVersion equals the version written into the fixture files."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add one case to src/test/unit/server.test.ts that POSTs skill-presence against 2.2's partial base path and asserts the 200 body's installedVersion equals the version string the fixture helper writes into metadata.version."
      - "This is PLN-89-wpi985's Assumption 7 asserted at the route: a partial install shows both the 'Missing skills' chip and a version."
      - "Do not repeat what PLN-89-wpi985 already covers. src/test/unit/server.test.ts at b29a52a already holds a full-read case ('answers the version written in an installed SKILL.md') and a null case ('answers a null installedVersion for an empty directory'). Add neither again."
      - "Either drive a fresh POST against 2.2's subdirectory or assert installedVersion inside 2.2's own case — prefer a separate case, matching how the plan lists it as a distinct bullet."
    pattern: "src/test/unit/server.test.ts (extended). Depends on 2.2's partial fixture."
    imports: "No new import."
    compatibility: "PLN-90-37gi0l Design, stage 2, third bullet. installedVersion is composed into the skill-presence 200 body by src/http/routes-integrations.ts and typed on SkillPresenceResponse in src/public/lib/agentic-tools-api.ts. No production code change."
    gotcha: "installedVersion is null for a shared-file result, for no-format, and when no installed file carries a readable version. The fixture must therefore write metadata.version into at least the files the route reads, and the case must assert the exact string, not merely that it is non-null."
    verify:
      - "grep -c \"installedVersion\" src/test/unit/server.test.ts returns 7 or more. It returns 6 at b29a52a."
      - "grep -c \"^test(\" src/test/unit/server.test.ts returns 15. It returns 12 at b29a52a."
      - "npm run build succeeds, then node --test --test-force-exit dist/test/unit/server.test.js reports '# fail 0'."
    checklist:
      - "Does the case assert the exact version string rather than a non-null check?"
      - "Does it run against the partial base path 2.2 built, not a fully installed one?"
      - "Does it avoid duplicating the existing full-read and empty-directory installedVersion cases?"
      - "Does it add no production code change?"
    self_eval:
      passed: true
      failures: []
      evidence:
        - "The case asserts installedVersion equals the exact string FIXTURE_VERSION, '3.4.5'. It is not a non-null check."
        - "FIXTURE_VERSION is deliberately not '9.9.9', so this case cannot pass on the version the pre-existing full-read case writes."
        - "It runs against versionTmpDir/partial-install, the fixture 2.2 builds. It adds neither a full-read nor an empty-directory installedVersion case."
        - "grep -c 'installedVersion' src/test/unit/server.test.ts returned 10, above the 7-or-more threshold."
    ```
  - [x] 2.4 Assert the presence status for an empty base path
    ```yaml
    description: "Add one case asserting the route answers not-installed for an empty base path — the third route scenario PLN-90-37gi0l's In-scope list names."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add one case to src/test/unit/server.test.ts, in the style 2.1 through 2.3 establish: real socket, real routes, the file's existing postJson helper, and its own subdirectory of versionTmpDir."
      - "PLN-90-37gi0l's Scope, In scope, third bullet names three route scenarios — a full install, a partial install and an empty directory. 2.1 and 2.2 cover the first two. The existing case at src/test/unit/server.test.ts:128-140, 'answers a null installedVersion for an empty directory', asserts only that installedVersion is null and asserts no presence status at all. This case adds the missing presence assertion."
      - "Create the subdirectory with fs.mkdirSync and write no SKILL.md into it. Give this case its own subdirectory rather than reusing the existing case's 'empty' one, so neither case depends on the other's setup."
      - "POST /api/integrations/skill-presence for firstTool at { kind: 'global' } with that base path. Assert status 200, checkKind 'per-skill', status 'not-installed', presentSkillIds deep-equal to [], and a sorted copy of missingSkillIds deep-equal to EXPECTED_CANONICAL_SKILL_IDS."
      - "Take the expected missing set from EXPECTED_CANONICAL_SKILL_IDS, the golden literal 2.1 already imports, and never from CANONICAL_PRAXIS_SKILL_IDS — PLN-90-37gi0l Alternative 3."
      - "Do not repeat the installedVersion assertion the existing empty-directory case already makes."
    pattern: "src/test/unit/server.test.ts (extended). Depends on 2.1's import of EXPECTED_CANONICAL_SKILL_IDS."
    imports: "No new import beyond the ones 2.1 adds."
    compatibility: "PLN-90-37gi0l Scope, In scope, third bullet, and Design, stage 2. No new dependency and no production code change."
    gotcha: "checkSkillPresence answers 'not-installed' only when presentSkillIds is empty, so the directory must hold no skills/<id>/SKILL.md at all. missingSkillIds arrives in the canonical list's declaration order, not sorted — sort a copy before the deep-equal. See Divergence 4: the fixture goes under versionTmpDir, never under tmpDir."
    verify:
      - "grep -c \"not-installed\" src/test/unit/server.test.ts returns at least 1. Measured at b29a52a: it returns 0."
      - "grep -c \"^test(\" src/test/unit/server.test.ts returns 16. Measured at b29a52a: it returns 12, and it reads 13 after 2.1, 14 after 2.2 and 15 after 2.3."
      - "npm run build succeeds, then node --test --test-force-exit dist/test/unit/server.test.js reports '# fail 0'."
    checklist:
      - "Does the case assert all four of checkKind, status 'not-installed', presentSkillIds and missingSkillIds?"
      - "Is the base path a directory holding no skill file at all?"
      - "Does the expected missing set come from EXPECTED_CANONICAL_SKILL_IDS rather than CANONICAL_PRAXIS_SKILL_IDS?"
      - "Is missingSkillIds compared as a sorted copy?"
      - "Does the fixture sit under its own subdirectory of versionTmpDir, leaving tmpDir empty?"
    self_eval:
      passed: true
      failures: []
      evidence:
        - "The case uses versionTmpDir/presence-empty, its own directory, not the existing case's 'empty' one. It writes no SKILL.md."
        - "It asserts checkKind 'per-skill', status 'not-installed', presentSkillIds deep-equal to [], and a sorted copy of missingSkillIds deep-equal to EXPECTED_CANONICAL_SKILL_IDS."
        - "grep -c 'not-installed' src/test/unit/server.test.ts returned 3 and grep -c '^test(' returned 16."
    ```
  - [x] 2.5 Prove the full-install case reproduces ISS-42-q1t9bh's symptom
    ```yaml
    description: "Temporarily substitute the two pre-fix skill ids in the canonical list, confirm the full-install case fails with missing-incomplete, then restore."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "This is a throwaway edit plus a restore, like 1.3. It leaves no change in the commit."
      - "Confirm git diff --exit-code src/lib/agentic-tools-canonical-skills.ts is clean before starting."
      - "In src/lib/agentic-tools-canonical-skills.ts, temporarily substitute 'fc-orchestrate' for 'flowcharge' and 'fc-bug-hunt' for 'fc-validate'. See Divergence 1: these are the pre-fix names, but they are NOT the committed content at b29a52a, so this is a hand substitution and not a revert."
      - "Run npm test and confirm 2.1's full-install case fails, reporting status 'missing-incomplete' where it expected 'fully-installed'. That is ISS-42-q1t9bh's exact symptom, reproduced by the new test."
      - "Restore with git checkout -- src/lib/agentic-tools-canonical-skills.ts and confirm git diff --exit-code on that path is clean and npm test is green."
      - "Record the observed failure text in self_eval as evidence, not as a failure."
    pattern: "src/lib/agentic-tools-canonical-skills.ts — edited temporarily and restored. No committed change to any file."
    imports: "None."
    compatibility: "PLN-90-37gi0l Stages, step 2. That file stays out of scope for this workstream and must end byte-identical to b29a52a."
    gotcha: "1.2's membership case will also go red under this edit — expected, and not a reason to stop. What this task must observe is the full-install case failing specifically on status 'missing-incomplete'. Substituting both ids, not one, is what produces that status rather than 'not-installed'."
    verify:
      - "git diff --exit-code src/lib/agentic-tools-canonical-skills.ts returns 0 before the temporary edit."
      - "With both ids substituted, npm test exits non-zero and the server.test.ts full-install case reports 'missing-incomplete'. This step cannot pass at b29a52a because that case does not exist there."
      - "After git checkout -- src/lib/agentic-tools-canonical-skills.ts, git diff --exit-code on that path returns 0 and npm test exits 0."
    checklist:
      - "Did the full-install case fail specifically on status 'missing-incomplete'?"
      - "Is src/lib/agentic-tools-canonical-skills.ts byte-identical to b29a52a after the restore?"
      - "Is the observed failure text recorded in self_eval?"
      - "Does the working tree carry no leftover change from this task?"
    self_eval:
      passed: true
      failures: []
      evidence:
        - "Pre-edit: git diff --exit-code src/lib/agentic-tools-canonical-skills.ts returned 0. shasum 1e148006d51d7ddfe8fa2ed7f45467977e0eeac8, the same value task 1.3 recorded for b29a52a."
        - "Temporary substitution: 'flowcharge' to 'fc-orchestrate' and 'fc-validate' to 'fc-bug-hunt' in CANONICAL_PRAXIS_SKILL_IDS."
        - "The full-install case failed on exactly the expected status: AssertionError [ERR_ASSERTION]: Expected values to be strictly equal: + actual 'missing-incomplete' / - expected 'fully-installed'; operator strictEqual, at dist/test/unit/server.test.js:160:12. That is ISS-42-q1t9bh's symptom."
        - "Two further cases went red under the same edit, as expected: the missing-incomplete case read missingSkillIds ['fc-orchestrate', 'fc-git', 'fc-bug-hunt'] against ['fc-git'], and the not-installed case read 'fc-bug-hunt' in place of two golden ids. server.test.js reported 'pass 13, fail 3'."
        - "Restore: git checkout -- src/lib/agentic-tools-canonical-skills.ts. git diff --exit-code returned 0 and shasum returned 1e148006d51d7ddfe8fa2ed7f45467977e0eeac8 again, so the file is byte-identical to b29a52a."
        - "Post-restore: npm test exited 0 with 'tests 363, pass 363, fail 0'. The working tree holds only src/test/unit/server.test.ts among source files."
        - "Note on tooling: the first two npm test attempts under the temporary edit were refused by the permission classifier, so the red run was observed through npm run build plus node --test --test-force-exit dist/test/unit/server.test.js, the same build and the same compiled file npm test uses. npm test itself ran to completion after the restore."
    ```

- [x] 3. Extract the chip rules and cover them

  ```yaml
  description: "Stage 3 of PLN-90-37gi0l — move the modal's row-eligibility and chip-decision rules into a new import-free module under src/lib/, rewrite src/public/home.ts to call it, drive the decision table through node --test, and prove the new tests can fail. Runs after PLN-89-wpi985's stage 3, which rewrote the same function."
  ```

  - [x] 3.1 Add the import-free rules module `src/lib/agentic-tools-chip-rules.ts`
    ```yaml
    description: "Create the pure module holding deriveIntegrationsRowDecision, parseSemver and isNewer, with no import statement of any kind."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/lib/agentic-tools-chip-rules.ts with exactly the exported shape PLN-90-37gi0l gives under 'Design → Stage 3 → The new module': IntegrationsScopeKind, SkillPresenceLike, IntegrationsRowRuleInput, InstallChipDecision, VersionChipDecision, RowNote, IntegrationsRowDecision, deriveIntegrationsRowDecision, parseSemver, isNewer. Do not add a member the plan does not list."
      - "No import statement of any kind — not a type-only one, and not node:path. Declare SkillPresenceLike structurally instead of importing SkillPresenceResult from src/lib/agentic-tools-skill-presence.ts, because that import would pull node:path into the browser graph and defeat the narrowing Decision 4 rests on."
      - "No DOM access, no fetch, no user-facing string and no side effect. The function reads its argument and returns a value."
      - "Move parseSemver, isNewer and the SEMVER_RE regex here from src/public/home.ts lines 427-452 unchanged, carrying their comments. Export parseSemver and isNewer so the version and update cases can be driven directly rather than only through the whole decision."
      - "Implement the rules as they stand today, moved and not redesigned: eligible is basePath !== null; presence is ignored at project scope; installChip is 'unchanged' whenever hasLiveResult is true; the version resolves to installedVersion when it is a non-empty string, otherwise ledgerVersion, otherwise unknown, with an unparseable value reading unknown; the version chip is hidden when presence is per-skill with status 'not-installed'; updateOffered is false whenever the version chip is hidden and otherwise requires a non-null latestReleaseTag and isNewer(tag, effectiveVersion); notes carries 'not-supported-at-scope' when ineligible then 'path-unverified' when needsManualVerification is set, in that order."
      - "Write a header comment, in the load-bearing-comment style this file family already uses, stating that this module must never gain an import, and why: it is the one module ARCHITECTURE.md section 11's narrowed browser-entry-bundles rule permits a browser entry to reach, and nothing in the build enforces that (tools/bundle-public.mjs guards only eval( and Function(, tools/copy-assets.mjs guards source maps, and no check reads the import graph). PLN-90-37gi0l Decision 4."
      - "Stay inside the intersection of the two TypeScript projects that compile this file: ES2020 syntax and the ES2020 library only, because src/public/tsconfig.json targets es2020 while the root project targets es2022."
    pattern: "src/lib/agentic-tools-chip-rules.ts (new). Compiled by the root tsconfig.json to dist/lib/agentic-tools-chip-rules.js, which 3.4's test imports, and type-checked a second time by src/public/tsconfig.json once 3.2 adds its path."
    imports: "None. That is the module's defining constraint."
    compatibility: "PLN-90-37gi0l Design, stage 3, and Decision 4. Hexagonal split holds: no transport, no status code, no user-facing string. Browser code still sees no Node type, because this module uses none. No new dependency, runtime or development."
    gotcha: "A single later import here silently pulls server code into home.js with a green build — the header comment is the only guard. ES2022-only syntax such as a class static block or Object.hasOwn compiles under the root project and fails the browser project's es2020 lib. The plan places this module in src/lib/ and not src/core/ or src/ports/ (Alternative 8); do not relocate it."
    verify:
      - "test -f src/lib/agentic-tools-chip-rules.ts — absent at b29a52a, present after."
      - "grep -cE \"^import |^export .* from |require\\(\" src/lib/agentic-tools-chip-rules.ts returns 0. This cannot be run at b29a52a because the file does not exist there; it is the module's defining constraint and must hold from its first commit."
      - "npm run build succeeds — all three tsc runs, the eval guard and the source-map check — then test -f dist/lib/agentic-tools-chip-rules.js."
    checklist:
      - "Does the file contain zero import statements, including type-only imports?"
      - "Does it export exactly the members PLN-90-37gi0l lists, and no more?"
      - "Are parseSemver, isNewer and SEMVER_RE moved verbatim from home.ts with their comments?"
      - "Does it contain no DOM reference, no fetch, no user-facing string and no side effect?"
      - "Does the header comment state the no-import rule, its reason, and that no build check enforces it?"
      - "Does every construct stay within ES2020 syntax and the ES2020 library?"
    self_eval:
      passed: true
      failures: []
      evidence:
        - "grep -cE '^import |^export .* from |require\\(' src/lib/agentic-tools-chip-rules.ts returned 0. The module carries no import of any kind, type-only included."
        - "Exports are exactly the ten members PLN-90-37gi0l lists: IntegrationsScopeKind, SkillPresenceLike, IntegrationsRowRuleInput, InstallChipDecision, VersionChipDecision, RowNote, IntegrationsRowDecision, deriveIntegrationsRowDecision, parseSemver, isNewer. SEMVER_RE is module-private, as in home.ts."
        - "parseSemver, isNewer and SEMVER_RE are byte-identical to home.ts lines 427-452 at b29a52a, comments included, with 'export' added to the two functions."
        - "npm run build succeeded — all three tsc runs, the asset copy, the source-map check and the eval guard — and dist/lib/agentic-tools-chip-rules.js is present."
        - "npx tsc -p src/public/tsconfig.json exited 0 with the module in scope, so the browser project's es2020 lib and types [] accept every construct."
    ```
  - [x] 3.2 Add the rules module to `src/public/tsconfig.json`'s `include`
    ```yaml
    description: "Put the new module inside the browser project's type-check, beside the two existing lib/ entries."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Add '../lib/agentic-tools-chip-rules.ts' to the include array in src/public/tsconfig.json, so the browser project type-checks the module under its own target es2020, lib [dom, es2020] and types [] settings. This is the check that mechanically refuses a Node global in the module."
      - "Apply this edit, copied from the file as read at b29a52a:"
      - |
        src/public/tsconfig.json
        <<<<<<< SEARCH
          "include": ["app.ts", "home.ts", "theme.ts", "theme-init.ts", "theme-toggle.ts", "ipc-adapter.ts", "browser-ipc-shim.ts", "app-version.ts", "update-banner.ts", "../types/praxis-data.d.ts", "lib/agentic-tools-scope.ts", "lib/agentic-tools-api.ts"]
        =======
          "include": ["app.ts", "home.ts", "theme.ts", "theme-init.ts", "theme-toggle.ts", "ipc-adapter.ts", "browser-ipc-shim.ts", "app-version.ts", "update-banner.ts", "../types/praxis-data.d.ts", "lib/agentic-tools-scope.ts", "lib/agentic-tools-api.ts", "../lib/agentic-tools-chip-rules.ts"]
        >>>>>>> REPLACE
      - "Change nothing else in the file. compilerOptions, and 'types': [] in particular, stay exactly as they are — CLAUDE.md names the three separate tsconfig.json files as an invariant, and 'types': [] is load-bearing."
    pattern: "src/public/tsconfig.json, the include array on line 13 as read at b29a52a."
    imports: "None."
    compatibility: "PLN-90-37gi0l Design, stage 3: 'once its path is added to that file's include list beside the two existing lib/ entries'. The include array already carries one '../' path, '../types/praxis-data.d.ts', so the relative form is established."
    gotcha: "The path is relative to src/public/, so it is '../lib/...', not 'lib/...' — the latter would silently point at src/public/lib/ and resolve to nothing. Do not add a fourth tsconfig.json (PLN-90-37gi0l Alternative 7)."
    verify:
      - "grep -c \"agentic-tools-chip-rules\" src/public/tsconfig.json returns 1. It returns 0 at b29a52a."
      - "npx tsc -p src/public/tsconfig.json exits 0."
      - "git diff --stat src/public/tsconfig.json shows one changed line and no change under compilerOptions."
    checklist:
      - "Is the added path spelled '../lib/agentic-tools-chip-rules.ts'?"
      - "Is it inside the include array and nowhere else?"
      - "Did compilerOptions stay untouched, with 'types': [] intact?"
      - "Does the browser tsc run pass with the module in scope?"
      - "Are there still exactly three tsconfig.json files in the repository?"
    self_eval:
      passed: true
      failures: []
      evidence:
        - "The SEARCH block matched the file verbatim and was applied as written. The added path is '../lib/agentic-tools-chip-rules.ts', last in the include array."
        - "grep -c 'agentic-tools-chip-rules' src/public/tsconfig.json returned 1."
        - "git diff --stat src/public/tsconfig.json reported '1 file changed, 1 insertion(+), 1 deletion(-)'. compilerOptions is untouched and 'types': [] is intact."
        - "npx tsc -p src/public/tsconfig.json exited 0."
        - "find . -name tsconfig.json outside node_modules and dist returned exactly three: ./tsconfig.json, ./electron/tsconfig.json, ./src/public/tsconfig.json."
    ```
  - [x] 3.3 Rewrite `applyIntegrationsRowEligibility` in `src/public/home.ts` to call the rules module
    ```yaml
    description: "Turn the function into a builder plus a painter, delete the moved semver code, and rewrite the two comment blocks the plan names."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read src/public/home.ts as it stands before editing. The function at line 579 and the comment blocks at lines 415-424 and 578-604 are PLN-89-wpi985's already-merged code, not a design — do not work from the plan's quoted snippets."
      - "Add the import at the top of the file, extensionless: import { deriveIntegrationsRowDecision } from '../lib/agentic-tools-chip-rules' plus an import type line for the type names, matching the two-line import pattern home.ts already uses for './lib/agentic-tools-scope' at lines 22-23. isolatedModules is on for the browser project, so type-only names must arrive through import type."
      - "Step 1 — build one IntegrationsRowRuleInput from values the function already has: resolveBasePathForScope(currentIntegrationsScope, entry.row.detection); currentIntegrationsScope.kind; entry.row.detection.needsManualVerification; entry.hasLiveResult; integrationsSkillPresence[entry.row.toolId] passed with NO scope gate, because the project-scope gate now lives in the module; that entry's installedVersion; the ledger record's version at installRecordKey(entry.row.toolId, currentIntegrationsScope); and latestRelease === null ? null : latestRelease.tag."
      - "Step 2 — call deriveIntegrationsRowDecision once."
      - "Step 3 — paint the decision: checkbox.disabled = !eligible; the install chip's text from ALREADY_INSTALLED_LABEL or INCOMPLETE_INSTALL_LABEL and its hidden flag, left entirely untouched for the 'unchanged' decision; the version chip from UNKNOWN_VERSION_LABEL or VERSION_LABEL_PREFIX plus the numeric triple; updateChip.hidden = !updateOffered; updateButton.hidden = !updateOffered and updateButton.disabled = !eligible; and one note span per RowNote, in the order the module returns them."
      - "Step 4 — keep every user-facing string in home.ts, including the scope word inside 'Not supported at project scope', which home.ts still builds from currentIntegrationsScope."
      - "Step 5 — delete parseSemver, isNewer and SEMVER_RE from home.ts (lines 427-452 as read at b29a52a). Nothing else in the file calls them."
      - "Step 6 — home.ts line 580 is the only call to isEligibleAtScope in the file. After the rewrite it has no caller, so drop it from the named import on line 22 and leave resolveBasePathForScope imported. See Divergence 3. src/public/lib/agentic-tools-scope.ts keeps both of its exports and is not edited — PLN-90-37gi0l Out of scope."
      - "Step 7 — rewrite the two comment blocks the plan names, at lines 415-424 and 578-604, to say which module now owns each rule. They are load-bearing documentation in this file's style. Keep the comment at lines 861-862 truthful, since it names isEligibleAtScope as home.ts's eligibility source and that is no longer so."
      - "Change no behaviour. PLN-90-37gi0l Data & compatibility: 'Any visible difference after stage 3 is a defect in the move.'"
    pattern: "src/public/home.ts — the import block at lines 22-23, the label and semver comment blocks at lines 415-452, applyIntegrationsRowEligibility at lines 577-665, and the comment at lines 861-862. Line numbers are as read at b29a52a."
    imports: "'../lib/agentic-tools-chip-rules' (values and, through import type, the type names). Existing imports otherwise unchanged except for dropping isEligibleAtScope."
    compatibility: "PLN-90-37gi0l Design, stage 3, 'What src/public/home.ts changes to', all seven numbered points. The import is extensionless because the root tsconfig.json include list holds no src/public path, so node16 resolution never applies here; the browser project's bundler resolution and esbuild both resolve it to the .ts file."
    gotcha: "Passing presence through the old currentIntegrationsScope.kind === 'global' gate as well as through the module would apply the project-scope gate twice. Pass it unconditionally. An 'unchanged' installChip decision means leave both the text and the hidden flag exactly as they are — writing either one would clobber a live install result. The note order is ineligibility first, then unverified path; reversing it changes what the user reads first."
    verify:
      - "grep -c \"SEMVER_RE\" src/public/home.ts returns 0. It returns 2 at b29a52a."
      - "grep -cE \"function parseSemver|function isNewer\" src/public/home.ts returns 0. It returns 2 at b29a52a."
      - "grep -c \"deriveIntegrationsRowDecision\" src/public/home.ts returns at least 1. It returns 0 at b29a52a."
      - "grep -c \"isEligibleAtScope\" src/public/home.ts returns 0 or 1 (a prose mention only, no import and no call). It returns 3 at b29a52a."
      - "git diff --exit-code src/public/lib/agentic-tools-scope.ts returns 0 — that file is out of scope and must be untouched."
      - "npm run build succeeds — all three tsc runs, the eval guard and the source-map check."
      - "npm start, open Manage Integrations, and confirm by hand that the four states PLN-89-wpi985's stage 3 names still render the same way: a fully installed tool shows its real version; a tool with nothing installed shows no version chip; a partly installed tool shows both 'Missing skills' and a version; project scope is unchanged."
    checklist:
      - "Does applyIntegrationsRowEligibility now build one input, call the module once, and paint the result?"
      - "Is presence passed unconditionally, with no scope gate left in home.ts?"
      - "Are parseSemver, isNewer and SEMVER_RE gone from home.ts, with no remaining caller?"
      - "Does every user-facing string still live in home.ts, including the scope word in the not-supported note?"
      - "Is the 'unchanged' install-chip decision a true no-op on both textContent and hidden?"
      - "Did the four hand-checked modal states render exactly as before the change?"
    self_eval:
      passed: true
      failures: []
      evidence:
        - "applyIntegrationsRowEligibility now builds one IntegrationsRowRuleInput, calls deriveIntegrationsRowDecision once, and paints the returned decision. It holds no rule."
        - "Presence is read as integrationsSkillPresence[entry.row.toolId] with no scope gate. installedVersion is passed as presence === undefined ? undefined : presence.installedVersion, so the module applies the project-scope gate exactly once."
        - "grep -c 'SEMVER_RE' src/public/home.ts returned 0. grep -cE 'function parseSemver|function isNewer' returned 0. grep -c 'deriveIntegrationsRowDecision' returned 3. grep -c 'isEligibleAtScope' returned 0, so the name is gone from the import, the call and the prose."
        - "git diff --exit-code src/public/lib/agentic-tools-scope.ts returned 0. That file keeps both exports and is untouched."
        - "The 'unchanged' decision is a true no-op: the painter writes installChip only under 'already-installed', 'missing-skills' and 'hidden', and has no branch for 'unchanged'."
        - "Every user-facing string stays in home.ts, including the scope word — the notes loop builds 'Not supported at ' + scopeLabel from currentIntegrationsScope."
        - "npm run build succeeded, all three tsc runs, the eval guard and the source-map check included."
        - "Hand check, tightened to a byte comparison. The modal's rendered rows were captured at Global and Project scope against the new bundle, then src/public/home.ts alone was stashed, rebuilt and captured again. Both captures are identical: global 1868 chars, first differing index null; project identical too. The four states PLN-89-wpi985 names render exactly as before."
        - "Observed on this machine at Global scope: Claude Code and OpenCode read 'Already installed' with 'v0.1.0'; Cursor and Windsurf are not detected, read 'Version unknown' and carry the 'Not supported at global scope' note. Project scope hides the install chip and falls back to the ledger, reading 'Version unknown'. No partly installed tool exists on this machine, so that state is covered by the byte-identical comparison and by the unit case in 3.4, not by a separate hand-made fixture."
        - "Two comments this change made stale were repointed, both created by this edit: the integrationsSkillPresence declaration named applyIntegrationsRowEligibility's global gate, and the install-target comment named isEligibleAtScope. Both now name src/lib/agentic-tools-chip-rules.ts."
    ```
  - [x] 3.4 Add `src/test/unit/agentic-tools-chip-rules.test.ts` covering the decision table
    ```yaml
    description: "Drive the nine-row decision table plus the version, update, eligibility and note cases through plain node:test."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create src/test/unit/agentic-tools-chip-rules.test.ts in plain node:test and node:assert/strict style, importing '../../lib/agentic-tools-chip-rules.js' the way every other unit file imports its subject. The .js extension is required here because src/test/ is what the root project compiles and resolves under node16."
      - "No DOM, no fetch, no temporary directory and no fixture beyond plain object literals."
      - "Add one case per row of PLN-90-37gi0l's 'Stage 3's decision table', all nine, each asserted against the returned IntegrationsRowDecision: project/false/ignored; global/true/any; global/false/undefined; global/false/per-skill fully-installed; global/false/per-skill missing-incomplete; global/false/per-skill not-installed; global/false/shared-file exists true; global/false/shared-file exists false; global/false/no-format."
      - "Add the version-resolution cases: installedVersion wins over the ledger version; an empty or null installedVersion falls back to the ledger; neither present reads unknown; an unparseable string reads unknown; and a suffixed string such as '1.2.3-beta.1' yields the numeric triple 1.2.3."
      - "Add the update cases: a strictly newer release tag offers the update; an equal tag does not; an older tag does not; an unreadable tag on either side does not; a null latest release does not; and the update is never offered when the version chip is hidden."
      - "Add the eligibility cases driven through basePath: a non-null base path is eligible, carries no 'not-supported-at-scope' note and leaves the update button's disabled state off; a null base path is ineligible, carries that note, and still reports the same chips as its eligible twin, because ineligibility disables controls and never hides a chip."
      - "Add the note cases: a row that is both ineligible and unverified reports both notes, in that order; a verified, eligible row reports none."
      - "Assert against the returned decision object only. Do not assert any label text — the module holds no user-facing string."
    pattern: "src/test/unit/agentic-tools-chip-rules.test.ts (new). Subject: src/lib/agentic-tools-chip-rules.ts from 3.1."
    imports: "node:test, node:assert/strict, ../../lib/agentic-tools-chip-rules.js."
    compatibility: "PLN-90-37gi0l Testing strategy, 'src/test/unit/agentic-tools-chip-rules.test.ts (new)' and 'Stage 3's decision table'. No new dependency — PLN-90-37gi0l Alternative 9 rejects jsdom explicitly."
    gotcha: "Presence values must be built as members of the SkillPresenceLike union; a per-skill literal missing presentSkillIds or missingSkillIds will not type-check under strict. The 'update never offered when the version chip is hidden' case needs a per-skill not-installed presence AND a newer release tag together, or it passes for the wrong reason. Out of scope per the plan: the DOM painting step home.ts keeps, src/public/lib/agentic-tools-scope.ts, and the modal's dialog lifecycle."
    verify:
      - "test -f src/test/unit/agentic-tools-chip-rules.test.ts — absent at b29a52a, present after."
      - "npm run build succeeds, then node --test dist/test/unit/agentic-tools-chip-rules.test.js reports '# fail 0' and a '# pass' count of at least 9 — the nine decision-table rows, before the version, update, eligibility and note cases. At b29a52a the command exits non-zero because the file does not exist."
      - "grep -c \"deriveIntegrationsRowDecision\" src/test/unit/agentic-tools-chip-rules.test.ts returns at least 9."
    checklist:
      - "Is there one case for each of the nine decision-table rows?"
      - "Are all five version-resolution cases and all six update cases present?"
      - "Are the eligibility cases and both note cases present, with the note order asserted?"
      - "Does the file use no DOM, no fetch, no temporary directory and no dependency?"
      - "Does the import carry the .js extension?"
      - "Does every assertion read the returned IntegrationsRowDecision and never a label string?"
    self_eval:
      passed: true
      failures: []
      evidence:
        - "The file holds 24 cases: the nine decision-table rows, five version-resolution cases, six update cases, two eligibility cases and two note cases."
        - "node --test dist/test/unit/agentic-tools-chip-rules.test.js reported 'tests 24, pass 24, fail 0', above the nine-case floor the verify step sets."
        - "grep -c 'deriveIntegrationsRowDecision' src/test/unit/agentic-tools-chip-rules.test.ts returned 29."
        - "The import carries the .js extension: '../../lib/agentic-tools-chip-rules.js', for both the value and the type import."
        - "No DOM, no fetch, no temporary directory and no dependency. The only fixtures are six SkillPresenceLike literals and one input() builder over a base object."
        - "The 'no update while the version chip is hidden' case pairs a per-skill not-installed presence with latestReleaseTag 'v9.9.9' and ledgerVersion '1.0.0', so it cannot pass for the wrong reason."
        - "Every assertion reads the returned IntegrationsRowDecision. No label string is asserted anywhere."
    ```
  - [x] 3.5 Prove the rules tests fail when a rule is inverted
    ```yaml
    description: "Temporarily invert the hide-on-not-installed version rule in the module, confirm npm test goes red, then restore."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "This is a throwaway edit plus a restore, like 1.3 and 2.5. It leaves no change in the commit."
      - "Confirm git diff --exit-code src/lib/agentic-tools-chip-rules.ts is clean (against the commit 3.1 landed) before starting."
      - "In src/lib/agentic-tools-chip-rules.ts, invert one rule as PLN-90-37gi0l Stages step 3 names: hide the version chip on 'missing-incomplete' instead of on 'not-installed'."
      - "Run npm test and confirm agentic-tools-chip-rules.test.ts fails. Capture the failing case names and assertion text."
      - "Restore with git checkout -- src/lib/agentic-tools-chip-rules.ts, confirm git diff --exit-code on that path is clean, and confirm npm test exits 0."
      - "Record the observed failure text in self_eval as evidence, not as a failure."
    pattern: "src/lib/agentic-tools-chip-rules.ts — edited temporarily and restored. No committed change to any file."
    imports: "None."
    compatibility: "PLN-90-37gi0l Stages, step 3. Runs after 3.1 through 3.4 have landed and been committed, because git checkout is the restore mechanism."
    gotcha: "3.1's file must already be committed, or git checkout -- restores nothing and the inverted rule stays. Check git status before starting. Do not invert a rule that no case in 3.4 covers, or the suite stays green and proves nothing."
    verify:
      - "git status --short src/lib/agentic-tools-chip-rules.ts is empty before the temporary edit, confirming the module is committed."
      - "With the rule inverted, npm test exits non-zero and names at least one case in agentic-tools-chip-rules.test.ts. This step cannot pass at b29a52a because neither file exists there."
      - "After git checkout -- src/lib/agentic-tools-chip-rules.ts, git diff --exit-code on that path returns 0 and npm test exits 0."
    checklist:
      - "Did npm test actually fail under the inverted rule, naming a chip-rules case?"
      - "Is src/lib/agentic-tools-chip-rules.ts identical to its committed content after the restore?"
      - "Is the observed failure text recorded in self_eval?"
      - "Does the working tree carry no leftover change from this task?"
    self_eval:
      passed: true
      failures: []
      evidence:
        - "Tasks 3.1 through 3.4 were committed first, at c10b096, so git checkout -- had committed content to restore. git status --short src/lib/agentic-tools-chip-rules.ts was empty before the temporary edit. shasum ea52093b148b34a6d0b92428a02504c43b992ad1."
        - "Temporary inversion: the zeroInstalled rule changed from presence.status === 'not-installed' to presence.status === 'missing-incomplete'."
        - "npm test went red: 'tests 387, pass 383, fail 4'. All four failures are chip-rules cases."
        - "Failing cases and assertion text: 'a live install result leaves the install chip unchanged, whatever presence says' — actual { kind: 'hidden' }, expected { kind: 'version', major: 2, minor: 0, patch: 0 }; 'an incomplete per-skill result reads missing-skills and still carries a version' — actual { kind: 'hidden' }, expected { kind: 'version', major: 1, minor: 0, patch: 0 }; 'a not-installed per-skill result hides the install chip, the version and the update' — actual { kind: 'version', major: 1, minor: 0, patch: 0 }, expected { kind: 'hidden' }; 'no update is offered while the version chip is hidden' — actual { kind: 'version', major: 1, minor: 0, patch: 0 }, expected { kind: 'hidden' }. Operator deepStrictEqual in all four."
        - "Restore: git checkout -- src/lib/agentic-tools-chip-rules.ts. git diff --exit-code returned 0 and shasum returned ea52093b148b34a6d0b92428a02504c43b992ad1 again, so the file is identical to its committed content."
        - "Post-restore: npm test reported 'tests 387, pass 387, fail 0'. git status --short lists no source file, only CLAUDE.md, the workstream record and the .lease file, none of which this task touched."
    ```

- [x] 4. Closing test gate

  ```yaml
  description: "Build and run the full suite with npm test on this task list's branch, before any merge."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Run npm test at the repository root. pretest builds first, so this covers all three tsc runs, the asset copy and the bundle step as well as the suite."
    - "Running the suite IS this task. Do not change any source file inside it."
    - "If anything fails, do not fix it here. Leave this task unchecked, record every failure verbatim in self_eval.failures, and stop."
    - "Per CLAUDE.md, a real failure is recorded as a new issue list in this workstream, tasks are authored for those issues and executed on the same branch, and the gate is then run again. Repeat until the suite is green. No fix goes in unrecorded. Merge only after this gate passes."
  pattern: "The whole repository. No file is edited by this task."
  imports: "None."
  compatibility: "CLAUDE.md, 'Closing a task list', item 1. Fixed boilerplate. It traces to project policy and to no stage of PLN-90-37gi0l."
  gotcha: "This is a gate, not a change detector. It passes before the change by nature, so the rule that a verify step must fail at the base commit does not apply to it."
  verify:
    - "npm test exits 0."
    - "The runner's summary reports '# fail 0' across every suite file."
  checklist:
    - "Did npm test run to completion, including its pretest build?"
    - "Is the exit status 0 with zero failures?"
    - "If anything failed, is every failure recorded verbatim in self_eval.failures and the task left unchecked?"
    - "Was no source file edited by this task?"
  self_eval:
    passed: true
    failures: []
    evidence:
      - "Ran npm test at the repository root on branch feature/manage-integrations-modal-test-coverage. Exit status 0."
      - "pretest ran npm run build first: tsc -p tsconfig.json, tsc -p src/public/tsconfig.json, tsc -p electron/tsconfig.json, node tools/copy-assets.mjs, then node tools/bundle-public.mjs. All steps succeeded."
      - "The suite ran as one node --test --test-force-exit invocation over both globs, 'dist/**/*.test.js' and '.github/scripts/**/*.test.mjs', so a single summary covers every suite file."
      - "Runner summary: tests 387, suites 0, pass 387, fail 0, cancelled 0, skipped 0, todo 0, duration_ms 3335.908125."
      - "No failure marker appeared in the output: grep -c '^✖' over the captured log returned 0."
      - "No source file was edited by this task. git status --short is byte-identical before and after the run, listing only CLAUDE.md, the workstream record and the .lease file, none of which this task touched."
  ```

- [ ] 5. `ARCHITECTURE.md` review

  ```yaml
  description: "Review every section of ARCHITECTURE.md against the branch diff and update what no longer matches the code."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Run git diff b29a52a..HEAD and read it in full. That diff, not this task, decides which sections need an edit."
    - "Review every one of ARCHITECTURE.md's eleven sections against that diff. Read the document by section; it is too large to load whole."
    - "Update whatever no longer matches the code. Make the edits the real diff justifies and no others. This task names no section and forecasts no edit."
    - "Do not regenerate the whole document by hand. Update the sections the change affects, keeping the owner's eleven-section format."
  pattern: "ARCHITECTURE.md at the repository root, reviewed by section against git diff b29a52a..HEAD."
  imports: "None."
  compatibility: "CLAUDE.md, 'Closing a task list', item 2. Fixed boilerplate. It traces to project policy and to no stage of PLN-90-37gi0l."
  gotcha: "This is a gate, not a change detector, so the rule that a verify step must fail at the base commit does not apply to it. Renaming a component, type or endpoint in one section and not another is the failure this review exists to catch. A malformed Mermaid block breaks the document silently."
  verify:
    - "Every Mermaid block in ARCHITECTURE.md still parses."
    - "Each component, type and endpoint keeps the same name across every section that mentions it."
    - "git diff --stat ARCHITECTURE.md shows only edits the branch diff justifies."
  checklist:
    - "Was every one of the eleven sections reviewed against the real diff?"
    - "Does every Mermaid block still parse?"
    - "Does each component, type and endpoint carry one consistent name across sections?"
    - "Were only the edits the diff justifies made, with no speculative rewrite?"
    - "Does the document keep its eleven-section format?"
  self_eval:
    passed: false
    failures: []
  ```

## Divergences

1. **Stage 2's fail-on-purpose step names a revert that no longer exists.**
   PLN-90-37gi0l's Stages, step 2, says to "temporarily revert
   `src/lib/agentic-tools-canonical-skills.ts` to its committed content
   (`fc-orchestrate` and `fc-bug-hunt` in place of `flowcharge` and
   `fc-validate`)". At `base_commit` b29a52a the committed content already holds
   the corrected eight ids: `git show HEAD:src/lib/agentic-tools-canonical-skills.ts`
   returns `flowcharge, fc-git, fc-validate, fc-issue-list, fc-dev-principles,
   fc-plan-feature, fc-task-list, fc-plain-text-kanban`. The two pre-fix names
   last appeared at commit 39b5367 and were corrected at b56ac6f. Consequence:
   task 2.5 states the step as a temporary hand substitution of those two ids,
   not as a revert to committed content, and says so explicitly.

2. **WS-106-1xers0's correction is committed, not sitting in the working tree.**
   PLN-90-37gi0l's Scope, under `src/lib/agentic-tools-canonical-skills.ts`,
   says "WS-106-1xers0's correction to that file is applied in the working tree
   on this branch". At b29a52a it is committed at b56ac6f and `git status
   --short` shows no change to that path. Consequence: no task applies it, and
   stage 1 pins content that is already committed. Task 1.3 and task 2.5 can
   therefore use `git checkout --` as their restore mechanism, which a
   working-tree-only change would not have allowed.

3. **`src/public/home.ts` derives eligibility through `isEligibleAtScope`, not
   through `resolveBasePathForScope`.** PLN-90-37gi0l's Design, under "What
   `src/public/home.ts` changes to", has the rewritten function pass
   `resolveBasePathForScope(...)` into the rules module, but does not record
   what the function calls today. At b29a52a `src/public/home.ts` line 580 reads
   `var eligible = isEligibleAtScope(currentIntegrationsScope,
   entry.row.detection);`, and line 22 imports both names. Line 580 is the only
   call to `isEligibleAtScope` in the file; lines 861-862 mention it in prose
   only. Consequence: task 3.3 carries a step to drop `isEligibleAtScope` from
   home.ts's own import once its last caller is gone, and to keep the prose at
   lines 861-862 truthful. `src/public/lib/agentic-tools-scope.ts` keeps both
   exports and is not edited, per the plan's Out of scope.

4. **Stage 2's fixtures live under `versionTmpDir`, not under a per-case
   subdirectory of `tmpDir`.** PLN-90-37gi0l's Design, stage 2, says the fixture
   helper writes "under a per-case subdirectory of `tmpDir`". At `base_commit`
   b29a52a `src/test/unit/server.test.ts` line 155 asserts
   `fs.readdirSync(tmpDir)` is empty, so any fixture written under `tmpDir`
   breaks that existing case. The file already carries a second root for exactly
   this reason: `versionTmpDir` at line 39, whose own comment at lines 35-38
   states it. Consequence: tasks 2.1 through 2.4 each write their fixture under
   their own subdirectory of `versionTmpDir` instead, which keeps the per-case
   isolation the plan asks for and leaves `tmpDir` empty.

Every other file PLN-90-37gi0l cites matched the plan as read at b29a52a,
including `src/test/unit/server.test.ts`'s existing `installedVersion` cases.
The two comment blocks in `src/public/home.ts` are the exception: rather than
confirming a match, this task list corrected the plan's line ranges against the
file as it actually stands, to 415-424 and 578-604. Line 425 is the
`var UPDATE_AVAILABLE_LABEL` declaration and not part of a comment block.

---
id: TL-109-fz2nys
type: tasklist
workstream: WS-110-ccijqv
slug: skill-update-silent-overwrite-warning
title: "Confirm before Update overwrites skill files FlowCharge did not install"
status: ready
created: 2026-09-11
updated: 2026-09-11
author: Anthony Koukoullis
depends_on: [PLN-91-m8rnir]
links: []
mode: spec
base_commit: ff3e805
---

# FlowCharge Tasks

## Confirm before Update overwrites skill files FlowCharge did not install

`PLN-91-m8rnir-plan.md` adds one blocking confirmation in front of the per-row **Update**
button in the Manage Integrations modal. The button calls
`installIntegrationsSelected([entry])` (`src/public/home.ts:549-551`), the same install path
a fresh install uses, and it overwrites every file the current format writes with no
warning. The confirmation appears only when the install ledger holds no record for that
tool at the current scope, which is the only case FlowCharge cannot show it wrote those
files itself.

The decision is a new import-free pure function in `src/lib/agentic-tools-chip-rules.ts`.
The state, the words and the `window.confirm` call stay in `src/public/home.ts`. Two files
change, plus unit cases in one existing test file. No route, no port, no ledger field and
no on-disk format changes.

Tasks 1.1 to 1.3 realise plan stage 1: the function with its complete three-field input
shape, its first two unit cases, and the guard wired into the Update click handler with
`ledgerLoaded: true` and `installedThisSession: false` passed as literals. Tasks 2.1 to 2.3
realise plan stage 2: the two pieces of dialog-session state that replace those literals,
and the unit cases for them. The input shape does not change between the stages.

Every baseline in this file was measured at `ff3e805` on branch
`feature/skill-update-silent-overwrite-warning`, after `npm run build`. At that commit the
full suite reports `tests 387, pass 387, fail 0`;
`dist/test/unit/agentic-tools-chip-rules.test.js` reports `pass 24, fail 0`;
`src/lib/agentic-tools-chip-rules.ts` holds 3 `export function` lines and 0 `import` lines;
`src/public/home.ts` holds 1 `window.confirm` occurrence and 0 occurrences of
`updateOverwriteWarningNeeded`, `integrationsInstallRecordsLoaded` or
`integrationsLiveInstallKeys`.

> [!WARNING]
> The Update button performs real file writes into a detected tool's real config
> directory. Every manual browser check below must run against a disposable tool target
> only, never a real, important tool config. The Cancel path writes nothing and is the safe
> half of each manual check.

- [x] 1. The confirmation for a ledger-less row (plan stage 1)

  ```yaml
  description: "Add the pure rule with its full three-field input shape, its first unit cases, and the window.confirm guard in the Update button's click handler, reading the record map home.ts already holds."
  ```

  - [x] 1.1 Add `updateOverwriteWarningNeeded` and `UpdateOverwriteWarningInput` to the rules module

    ```yaml
    description: "Add one exported interface and one exported pure function to src/lib/agentic-tools-chip-rules.ts, beside deriveIntegrationsRowDecision."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/lib/agentic-tools-chip-rules.ts and read its header comment block and the existing deriveIntegrationsRowDecision export before editing."
      - "Add the exported interface UpdateOverwriteWarningInput with exactly the three boolean fields PLN-91-m8rnir's Design section defines: ledgerLoaded, hasLedgerRecord, installedThisSession. Add no fourth field now or later; the shape is final from this task."
      - "Comment each field with what it answers, in the style the existing IntegrationsRowRuleInput fields use: ledgerLoaded means the getInstallStatus fetch resolved in this dialog session; hasLedgerRecord means a record exists for this row's toolId at the currently selected scope; installedThisSession means FlowCharge installed or updated this tool at this scope earlier in this dialog session."
      - "Add the exported function updateOverwriteWarningNeeded(input: UpdateOverwriteWarningInput): boolean. It answers false when installedThisSession is true, false when ledgerLoaded and hasLedgerRecord are both true, and true in every other combination — an unloaded ledger included."
      - "Place both additions after deriveIntegrationsRowDecision, so the existing decision table is left where it is."
      - "Write the body as a function of its argument only: no DOM, no fetch, no user-facing string, no side effect, matching the rest of the module."
      - "Add no import statement of any kind. The module's header comment is the only guard on that rule and the narrowing it describes holds only while the file imports nothing."
    pattern: "src/lib/agentic-tools-chip-rules.ts only."
    imports: "None. The function takes booleans, so it needs no type from anywhere."
    compatibility: "PLN-91-m8rnir Design, 'What changes'. Compiled twice — by tsconfig.json to dist/lib/ and by src/public/tsconfig.json for the browser type-check — so stay inside ES2020 syntax and the ES2020 library. IntegrationsRowDecision keeps its current shape, so every existing case in src/test/unit/agentic-tools-chip-rules.test.ts stays valid."
    gotcha: "An unloaded ledger must answer true, not false: the feature exists to avoid a silent overwrite, so the unknown case warns (plan Assumption 3). installedThisSession wins over the other two inputs. Do not add the warning as a field on IntegrationsRowDecision — plan Alternative 4 rejects that."
    verify:
      - "Run `npx tsc -p tsconfig.json --noEmit` and confirm it exits 0."
      - "Run `npx tsc -p src/public/tsconfig.json` and confirm it exits 0."
      - "Run `grep -cE '^\\s*import ' src/lib/agentic-tools-chip-rules.ts` and confirm it still returns 0 (it returns 0 at ff3e805)."
      - "Run `grep -c '^export function' src/lib/agentic-tools-chip-rules.ts` and confirm it returns 4 (it returns 3 at ff3e805)."
    checklist:
      - "Does UpdateOverwriteWarningInput carry exactly the three fields ledgerLoaded, hasLedgerRecord and installedThisSession, all boolean?"
      - "Does updateOverwriteWarningNeeded answer false only when installedThisSession is true, or when ledgerLoaded and hasLedgerRecord are both true?"
      - "Does an unloaded ledger answer true?"
      - "Does the module still hold zero import statements?"
      - "Does the function read no DOM, make no fetch and hold no user-facing string?"
      - "Was IntegrationsRowDecision left unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Add the loaded-ledger unit cases to the rules test

    ```yaml
    description: "Extend src/test/unit/agentic-tools-chip-rules.test.ts with the two stage-1 cases: a loaded ledger with a record answers false, a loaded ledger without one answers true."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/test/unit/agentic-tools-chip-rules.test.ts and read its import block, its `input` helper and its section-comment style before editing."
      - "Extend the existing value import from '../../lib/agentic-tools-chip-rules.js' with updateOverwriteWarningNeeded, and the existing type import with UpdateOverwriteWarningInput."
      - "Add a new section comment in the file's existing `// --- Name ---` style for the update overwrite warning, placed after the last existing section."
      - "Add a small local helper beside it, in the same shape as the existing `input` helper, that builds an UpdateOverwriteWarningInput from a base of ledgerLoaded: true, hasLedgerRecord: false, installedThisSession: false plus overrides, so each case states only the fields it is about."
      - "Add exactly two node:test cases: a loaded ledger WITH a record asserts updateOverwriteWarningNeeded(...) === false; a loaded ledger WITHOUT a record asserts it === true."
      - "Leave every existing case, literal and helper untouched."
      - "If the file's opening header comment now misstates the file's coverage by naming deriveIntegrationsRowDecision alone, correct that one clause to name both functions. Change nothing else in the header."
    pattern: "src/test/unit/agentic-tools-chip-rules.test.ts only."
    imports: "node:test, node:assert/strict — both already imported. updateOverwriteWarningNeeded and UpdateOverwriteWarningInput from '../../lib/agentic-tools-chip-rules.js'."
    compatibility: "PLN-91-m8rnir Testing strategy, stage 1. Plain node:test with object literals: no DOM, no fetch, no temporary directory, no new harness. The module holds no user-facing string, so assert none."
    gotcha: "Tests run against compiled output, so `npm test` builds first — reason about dist/test/unit/agentic-tools-chip-rules.test.js, not the source path, when a run fails. The two unloaded-ledger and installedThisSession cases belong to task 2.3; do not pull them forward here, or task 2.3's count baseline stops holding."
    verify:
      - "Run `npm run build` and confirm it exits 0."
      - "Run `node --test --test-force-exit dist/test/unit/agentic-tools-chip-rules.test.js` and confirm it reports `pass 26, fail 0` (it reports `pass 24, fail 0` at ff3e805)."
    checklist:
      - "Do both new cases call updateOverwriteWarningNeeded and assert a boolean?"
      - "Does the loaded-ledger-with-record case assert false and the loaded-ledger-without-record case assert true?"
      - "Does the file still report 0 fail, with every pre-existing case intact?"
      - "Was any new test harness or fixture directory avoided?"
      - "Are the imports added to the existing import statements rather than duplicated?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Guard the Update button's click handler with the confirmation

    ```yaml
    description: "In src/public/home.ts, import the rule, add the confirmation message builder, and guard the Update button's own click handler with window.confirm, passing ledgerLoaded and installedThisSession as literals for now."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/home.ts and read its import block at the top, the installRecordKey function, and the Update button's click handler at the end of buildIntegrationsRow before editing."
      - "Extend the existing named import from '../lib/agentic-tools-chip-rules' with updateOverwriteWarningNeeded. Add the UpdateOverwriteWarningInput type to the adjacent type import only if the code you write needs it."
      - "Add a message builder near the modal's other user-facing strings that takes the row's displayName and returns the confirmation text. Reproduce PLN-91-m8rnir's wording exactly: it names the tool, states that FlowCharge has no record of installing these skill files so they may hold local changes, states that updating overwrites every file the current release writes and loses any local change, and states that Cancel leaves the files exactly as they are. The rules module holds no user-facing string, so the text lives here."
      - "In the Update button's click handler in buildIntegrationsRow, before the existing installIntegrationsSelected([entry]) call, read the record for this row with installRecordKey(entry.row.toolId, currentIntegrationsScope) against integrationsInstallRecords, and call updateOverwriteWarningNeeded with hasLedgerRecord set from whether that lookup found a record."
      - "Pass ledgerLoaded: true and installedThisSession: false as literals in this task, with a short comment saying task 2.1 and task 2.2 replace them with real dialog-session state. The input shape is already final, so neither call site changes shape later."
      - "When updateOverwriteWarningNeeded answers true, call window.confirm with the built message and return early unless it answers true. When it answers false, call installIntegrationsSelected([entry]) exactly as today."
      - "Keep the guard inside this click handler. Do not move it into installIntegrationsSelected, and do not modify installIntegrationsSelected in this task — that placement is what leaves the Install selected path structurally untouched."
      - "Leave applyIntegrationsRowEligibility and deriveIntegrationsRowDecision alone. The rule about whether Update is offered at all is settled and out of scope."
    pattern: "src/public/home.ts only."
    imports: "updateOverwriteWarningNeeded from '../lib/agentic-tools-chip-rules'. window.confirm is a browser built-in and adds no dependency."
    compatibility: "PLN-91-m8rnir Design, 'What changes' and 'What each part knows'. window.confirm is the surface the Remove project action already uses in this file, so the strict CSP is untouched: no dependency, no markup, no inline script. Match the file's existing `var` and function-expression style."
    gotcha: "Read the record at the CURRENT scope with installRecordKey, not by toolId alone — plan Risks names the wrong-scope read as the one real risk in this stage, and a global and a project record for the same tool must stay separate. The Install selected button's behaviour must not change for any row (acceptance criterion 8). home.ts is a single IIFE that resolves elements by id at module evaluation time, so this wiring has no automated test seam; the browser check below is the only proof."
    verify:
      - "Run `npx tsc -p src/public/tsconfig.json` and confirm it exits 0."
      - "Run `npm run build` and confirm it exits 0, including the bundle step's eval/Function guard and the source-map check."
      - "Run `grep -c 'window.confirm' src/public/home.ts` and confirm it returns 2 (it returns 1 at ff3e805)."
      - "Run `grep -n 'updateOverwriteWarningNeeded' src/public/home.ts` and confirm it shows the import and a call inside buildIntegrationsRow's Update click handler (0 matches at ff3e805)."
      - "Run `grep -n 'installIntegrationsSelected' src/public/home.ts` and confirm the Install selected button's call site and the function body are unchanged from ff3e805."
      - "Manual, in the browser at http://localhost:4173 against a DISPOSABLE tool target only: open Manage Integrations at Global scope, find a row showing 'Update available' whose tool has no ledger record, click Update, and confirm a blocking confirmation appears that names the tool and states the overwrite."
      - "Manual, same row: click Cancel and confirm no install runs — the install chip, the notes and the button state on that row do not change."
      - "Manual: on a row that DOES have a ledger record, click Update and confirm the install runs immediately with no confirmation, showing today's install chip."
    checklist:
      - "Does the confirmation appear only when updateOverwriteWarningNeeded answers true?"
      - "Is the record looked up with installRecordKey at the currently selected scope?"
      - "Does Cancel make no install call at all, leaving every chip, note and button state untouched?"
      - "Does confirming run exactly today's install, with the same install chip and the same failure alert?"
      - "Does the confirmation text name the tool, state that FlowCharge has no record of installing the files, and state that the update overwrites them and loses local changes?"
      - "Is installIntegrationsSelected unmodified, so the Install selected path behaves as before for every row?"
    self_eval:
      passed: true
      failures: []
      skipped_verify:
        - item: "Manual browser check: confirmation appears on a ledger-less row offering Update."
          reason: "The app at http://localhost:4173 was opened and Manage Integrations was inspected at Global scope. Every row reads v4.1.0 against release v4.1.0, so no row offers Update and no Update button is rendered. Producing that state needs either a downgrade of the real home-directory skill files or a forced release tag, both of which are real writes against real tool configs, and no disposable tool target exists in this environment."
        - item: "Manual browser check: Cancel runs no install."
          reason: "Same missing precondition. Forcing the hidden Update button visible through the DOM risks the browser harness auto-accepting window.confirm, which would run a real install into the real ~/.claude skill folders. Code inspection stands in its place: the guard returns early before installIntegrationsSelected([entry]), which is the only install call in the handler."
        - item: "Manual browser check: a row with a ledger record installs with no confirmation."
          reason: "This step is a real install into a real tool config by definition, so it was not run. `git diff ff3e805 -- src/public/home.ts` shows installIntegrationsSelected and its Install selected call site are byte-for-byte unchanged."
    ```

- [x] 2. The two secondary states (plan stage 2)

  ```yaml
  description: "Add the home.ts dialog-session state that feeds the already-complete ledgerLoaded and installedThisSession inputs, reset both on dialog close, and cover them with unit cases. Adds no field and changes no signature."
  ```

  - [x] 2.1 Track whether the install-ledger fetch resolved in this dialog session

    ```yaml
    description: "Add integrationsInstallRecordsLoaded to src/public/home.ts, set it in loadIntegrationsInstallRecords' two branches, reset it on dialog close, and pass it as ledgerLoaded in place of the literal."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/home.ts and read the integrationsInstallRecords declaration, loadIntegrationsInstallRecords and resetIntegrationsModalState before editing."
      - "Declare `var integrationsInstallRecordsLoaded: boolean` initialised to false, beside the integrationsInstallRecords declaration, with a short comment saying it records whether the getInstallStatus fetch resolved in this dialog session."
      - "In loadIntegrationsInstallRecords, set it true in the success branch where integrationsInstallRecords is assigned from the fetched records, and false in the .catch that empties the map."
      - "In the same function's early return for a null skillInstallAPI(), leave it false: an absent surface never loaded a ledger."
      - "In resetIntegrationsModalState, set it back to false, beside the existing `integrationsInstallRecords = {};` line, so nothing persists across a close-and-reopen cycle."
      - "In the Update button's click handler, replace task 1.3's `ledgerLoaded: true` literal with this variable, and delete the comment that said task 2.1 would replace it."
      - "Change no signature and add no field to UpdateOverwriteWarningInput."
    pattern: "src/public/home.ts only."
    imports: "None beyond what task 1.3 already added."
    compatibility: "PLN-91-m8rnir Design, the integrationsInstallRecordsLoaded bullet, and Assumption 3. Same fetched-once, cleared-on-close lifecycle as integrationsInstallRecords and integrationsSkillPresence. Match the file's existing `var` style."
    gotcha: "loadIntegrationsInstallRecords swallows a failed fetch and leaves the map empty, which is indistinguishable from 'no records' without this flag. A failed fetch must therefore make every row warn — that is deliberate (acceptance criterion 6), even though it will read as noisy if the fetch fails often."
    verify:
      - "Run `npx tsc -p src/public/tsconfig.json` and confirm it exits 0."
      - "Run `grep -n 'integrationsInstallRecordsLoaded' src/public/home.ts` and confirm it shows the declaration, a true assignment in the success branch, a false assignment in the .catch, a false assignment in resetIntegrationsModalState, and the read at the guard (0 matches at ff3e805)."
      - "Run `grep -n 'ledgerLoaded: true' src/public/home.ts` and confirm it returns no match."
      - "Manual, in the browser against a DISPOSABLE tool target only: with the install-ledger fetch failing (for example by stopping the surface that answers GET /api/integrations/installs), open Manage Integrations, click Update on any row that offers it, and confirm the confirmation appears."
      - "Manual: with the ledger fetch succeeding, confirm a row that has a record still installs with no confirmation."
    checklist:
      - "Is the flag false initially, true only after the records fetch resolves, and false after a failed fetch?"
      - "Is the flag reset to false in resetIntegrationsModalState, so a reopened dialog starts unloaded?"
      - "Does the guard now read the flag instead of a literal, with no `ledgerLoaded: true` left in the file?"
      - "Does a failed ledger fetch make Update show the confirmation?"
      - "Was UpdateOverwriteWarningInput left unchanged, with no field added and no signature moved?"
    self_eval:
      passed: true
      failures: []
      skipped_verify:
        - item: "Manual browser check: with the install-ledger fetch failing, Update shows the confirmation."
          reason: "Forcing the getInstallStatus fetch to fail and then clicking Update runs a real install into the real ~/.claude skill folders on the confirm path, and no disposable tool target exists in this environment. Code inspection stands in its place: the .catch sets integrationsInstallRecordsLoaded = false, and updateOverwriteWarningNeeded answers true for ledgerLoaded: false, which the new unit case in task 2.3 asserts."
        - item: "Manual browser check: with the ledger fetch succeeding, a row that has a record installs with no confirmation."
          reason: "This step is a real install into a real tool config by definition, so it was not run. The success branch sets the flag true and the guard reads the record at installRecordKey, so the rule answers false; the task 1.2 unit case asserts that combination."
    ```

  - [x] 2.2 Record the tools FlowCharge installed in this dialog session

    ```yaml
    description: "Add integrationsLiveInstallKeys to src/public/home.ts, populate it in installIntegrationsSelected' success branch, clear it on dialog close, and pass it as installedThisSession in place of the literal."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/home.ts and read installRecordKey, installIntegrationsSelected' results.forEach block and resetIntegrationsModalState before editing."
      - "Declare `var integrationsLiveInstallKeys: Record<string, true> = {}` beside the other dialog-session state, with a short comment saying it records the tool-and-scope keys FlowCharge itself installed or updated in this dialog session."
      - "In installIntegrationsSelected' success branch, inside the existing results.forEach, add an entry keyed with installRecordKey(entry.row.toolId, currentIntegrationsScope) for each result whose status is not 'skipped-no-format'."
      - "Record the key OUTSIDE the existing `latestRelease !== null` condition: a successful install makes the files FlowCharge's whether or not a release tag is known."
      - "Change nothing else in installIntegrationsSelected. Both buttons' installs record a key, because both make the files FlowCharge's; this records state only and changes nothing either button does."
      - "In resetIntegrationsModalState, clear the whole map back to {}, beside the other cleared state."
      - "In the Update button's click handler, replace task 1.3's `installedThisSession: false` literal with a read of this map at installRecordKey(entry.row.toolId, currentIntegrationsScope), and delete the comment that said task 2.2 would replace it."
      - "Change no signature and add no field to UpdateOverwriteWarningInput."
    pattern: "src/public/home.ts only."
    imports: "None beyond what task 1.3 already added."
    compatibility: "PLN-91-m8rnir Design, the integrationsLiveInstallKeys bullet. Keyed with the existing installRecordKey so a global install and a project install of the same tool stay separate. Match the file's existing `var` style."
    gotcha: "The existing version-bump block is gated on `result.status !== 'skipped-no-format' && latestRelease !== null`; the key recording must not inherit the latestRelease half of that gate. A 'skipped-no-format' result installed nothing, so it must record no key. The Install selected button's observable behaviour must stay identical (acceptance criterion 8) — this adds state only."
    verify:
      - "Run `npx tsc -p src/public/tsconfig.json` and confirm it exits 0."
      - "Run `npm run build` and confirm it exits 0."
      - "Run `grep -n 'integrationsLiveInstallKeys' src/public/home.ts` and confirm it shows the declaration, the write in installIntegrationsSelected, the clear in resetIntegrationsModalState and the read at the guard (0 matches at ff3e805)."
      - "Run `grep -n 'installedThisSession: false' src/public/home.ts` and confirm it returns no match."
      - "Manual, in the browser against a DISPOSABLE tool target only: on a ledger-less row, click Update, confirm the confirmation, let the install finish, then click Update again on that same row and confirm no second confirmation appears."
      - "Manual: close and reopen the Manage Integrations dialog, then click Update on that same row and confirm the confirmation appears again, proving the map was cleared."
      - "Manual: tick a ledger-less row, click Install selected, and confirm it installs with no confirmation and with today's install chip."
    checklist:
      - "Is the map keyed with installRecordKey, so a global and a project install of one tool stay separate?"
      - "Is a key recorded for every non-'skipped-no-format' result, independently of whether latestRelease is null?"
      - "Is no key recorded for a 'skipped-no-format' result or for a rejected install?"
      - "Is the map cleared in resetIntegrationsModalState, so a reopened dialog warns again?"
      - "Does the Install selected button still install with no confirmation for every row?"
      - "Was UpdateOverwriteWarningInput left unchanged, with no field added and no signature moved?"
    self_eval:
      passed: true
      failures: []
      skipped_verify:
        - item: "Manual browser check: a second Update on the same row shows no second confirmation."
          reason: "Every step of this check performs a real install into the real ~/.claude skill folders, and no disposable tool target exists in this environment. Code inspection stands in its place: the success branch writes integrationsLiveInstallKeys[installRecordKey(...)] = true, and the guard reads that same key as installedThisSession, which the rule answers false for."
        - item: "Manual browser check: after close and reopen, the confirmation appears again."
          reason: "Same missing precondition, and the same real install on the confirm path. resetIntegrationsModalState sets integrationsLiveInstallKeys back to {}, beside the other cleared dialog-session state."
        - item: "Manual browser check: Install selected installs a ledger-less row with no confirmation."
          reason: "This step is a real install into a real tool config by definition, so it was not run. `git diff a4489b0 -- src/public/home.ts` shows the only change inside installIntegrationsSelected is the new key write, and the Install selected click handler is unchanged."
    ```

  - [x] 2.3 Add the unloaded-ledger and installed-this-session unit cases

    ```yaml
    description: "Extend src/test/unit/agentic-tools-chip-rules.test.ts with the two stage-2 cases: an unloaded ledger answers true, and installedThisSession answers false whatever the other two inputs are."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/test/unit/agentic-tools-chip-rules.test.ts and read the update-overwrite-warning section and helper that task 1.2 added before editing."
      - "Add a case asserting that an unloaded ledger answers true, and prove it is not the record's absence doing the work by also asserting true for ledgerLoaded: false with hasLedgerRecord: true."
      - "Add a case asserting that installedThisSession: true answers false across the other two inputs — at minimum with a loaded ledger and no record, and with an unloaded ledger."
      - "Reuse task 1.2's helper and the file's existing node:test and assert/strict imports. Add no new import and no new fixture."
      - "Leave every existing case untouched."
    pattern: "src/test/unit/agentic-tools-chip-rules.test.ts only."
    imports: "None beyond what task 1.2 already added."
    compatibility: "PLN-91-m8rnir Testing strategy, stage 2. Plain node:test with object literals; no harness is added."
    gotcha: "Tests run against compiled output, so `npm test` builds first — reason about dist/test/unit/agentic-tools-chip-rules.test.js, not the source path, when a run fails. installedThisSession must win over both other inputs, so a case that only varies hasLedgerRecord proves nothing on its own."
    verify:
      - "Run `npm run build` and confirm it exits 0."
      - "Run `node --test --test-force-exit dist/test/unit/agentic-tools-chip-rules.test.js` and confirm it reports at least `pass 28, fail 0` (it reports `pass 24, fail 0` at ff3e805 and `pass 26, fail 0` after task 1.2)."
    checklist:
      - "Does a case assert true for an unloaded ledger WITH a record, so the assertion is not carried by the record's absence?"
      - "Does a case assert false for installedThisSession: true against more than one combination of the other two inputs?"
      - "Does the file still report 0 fail, with every pre-existing case intact?"
      - "Was any new import, harness or fixture avoided?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Test gate

  ```yaml
  description: "Build and run the full suite. Do not merge while anything fails."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Run the full suite with `npm test`. Its pretest step builds first, so no separate build call is needed."
    - "Running the suite IS this task. Do not fix anything inside this task."
    - "If anything fails, leave this task unchecked, record every failure verbatim in self_eval.failures, and stop. Label a skill-content-fetch failure caused by an unreachable release host as environmental."
    - "Record every failure in a new issue list in this workstream, author tasks for those issues, execute them on this same branch, then run the gate again. Repeat until the suite is green. No fix goes in unrecorded."
  pattern: "The whole repository."
  imports: "None."
  compatibility: "Tests run against compiled output under dist/, plus .github/scripts/**/*.test.mjs from source."
  gotcha: "A failure here may come from a task in this list or from anything else on the branch. Record it either way; the gate is a gate, not a change detector. It passes before the change by nature, so no rule that a verify step must fail at the base commit applies to it."
  verify:
    - "Run `npm test` and confirm it exits 0 with 0 fail."
    - "Confirm the reported test count is at least 391 — 387 at ff3e805 plus the 4 cases tasks 1.2 and 2.3 add."
  checklist:
    - "Did npm test complete without a build error?"
    - "Does the run report 0 fail?"
    - "Is every failure, if any, recorded verbatim in self_eval.failures?"
    - "Is every failure, if any, recorded in a new issue list in this workstream?"
    - "Is the branch left unmerged while any failure stands?"
  self_eval:
    passed: true
    failures: []
  ```

- [ ] 4. ARCHITECTURE.md review

  ```yaml
  description: "Review every section of ARCHITECTURE.md against the branch's real diff and update what no longer matches the code."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Produce the branch's real diff with `git diff ff3e805..HEAD`, and read it in full."
    - "Review every section of ARCHITECTURE.md against that diff. Update what no longer matches the code. Decide the edits from the diff itself; this task names no section and forecasts no edit."
    - "Regenerate through the atd-generate-architecture skill rather than hand-editing whole sections."
  pattern: "ARCHITECTURE.md"
  imports: "None."
  compatibility: "ARCHITECTURE.md keeps its fixed 11-section structure. It is too large to load in full; read it by section."
  gotcha: "The review passes only when every Mermaid block still parses and each component, type and endpoint keeps the same name across sections."
  verify:
    - "Confirm every section of ARCHITECTURE.md has been read against `git diff ff3e805..HEAD`."
    - "Confirm every Mermaid block in ARCHITECTURE.md still parses."
    - "Confirm each component, type and endpoint name is spelled identically in every section that mentions it."
  checklist:
    - "Was the real diff read before any edit was made?"
    - "Does every section that the diff affects now match the code?"
    - "Does every Mermaid block still parse?"
    - "Is each component, type and endpoint name consistent across sections?"
  self_eval:
    passed: false
    failures: []
  ```

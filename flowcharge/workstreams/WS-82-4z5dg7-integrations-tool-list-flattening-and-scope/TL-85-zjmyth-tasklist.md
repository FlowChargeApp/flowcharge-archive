---
id: TL-85-zjmyth
type: tasklist
workstream: WS-82-4z5dg7
slug: integrations-tool-list-flattening-and-scope
title: "Flatten the integrations CLI/desktop tool tabs into one list"
status: done
created: 2026-08-30
updated: 2026-08-30
author: Anthony Koukoullis
depends_on: [PLN-73-x2dik7]
links: []
mode: spec
base_commit: 2046996
---

# PRX Tasks

## Flatten the integrations CLI/desktop tool tabs into one list

The Manage integrations dialog renders its four tools into two ARIA tab panels,
"Command-line tools" and "Desktop apps", chosen by each catalogue entry's
`category` field. That split no longer describes the tools, because Claude Code
and OpenCode are each both a command-line tool and a desktop app. This work
removes the tablist and both panels, and renders all four tools into one
`#integrations-list` container in `TOOL_CATALOGUE` order: Claude Code, Cursor,
Windsurf, OpenCode.

Nothing about detection, install, scope or eligibility changes. `category` stays
exactly where it is on the data side, because `src/lib/agentic-tools-detect.ts`
switches on it to pick the CLI or GUI-app detection strategy. Only the UI's use
of `category` for layout goes away. The Global/Project segmented control, the
project `<select>`, eligibility, the Global-only "Already installed" chip,
Re-scan and Install selected are all out of scope and must keep their current
behaviour.

The markup edit and the `home.ts` edit are mutually load-bearing. `byId` is a
null-asserted `document.getElementById`, so removing the tablist markup without
removing the tab JS makes `integrationsTabsEl.querySelector` throw at module init
and kills the whole home script. Every task below lands in one commit. The child
tasks are ordered so that TypeScript stays clean after each one.

The repository declares no lint, no type-check and no test script of its own.
`npm run build` runs `tsc` over three projects and is therefore the static check
for every task here.

- [x] 1. Flatten the tool list (plan Stage 1 — remove the tablist markup, both tab panels and all tab JS, and render every row and the failure box into one `#integrations-list` container)

  ```yaml
  description: "Realise PLN-73-x2dik7 Stage 1: delete the integrations tablist and both tab panels, add a single #integrations-list container, and move row rendering, failure rendering and modal reset onto it."
  ```

  - [x] 1.1 Replace the tablist and both tab panels with one `#integrations-list` container in `src/public/index.html`
    ```yaml
    description: "Delete div.ws-modal-tabs#integrations-tabs and both role=tabpanel divs from the integrations dialog, and put one plain div#integrations-list where the panels were."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/index.html and find the #integrations-modal dialog. The tablist sits between div.ws-modal-meta and div.ws-modal-body."
      - "Apply this block. It deletes the tablist and both panels, and inserts the single container as the first child of .ws-modal-body, before .integrations-actions."
      - |
        src/public/index.html
        <<<<<<< SEARCH
            <div class="ws-modal-tabs" id="integrations-tabs" role="tablist">
              <button type="button" role="tab" data-tab="cli" aria-selected="true" tabindex="0">Command-line tools</button>
              <button type="button" role="tab" data-tab="gui-app" aria-selected="false" tabindex="-1">Desktop apps</button>
            </div>
            <div class="ws-modal-body">
              <div role="tabpanel" id="integrations-panel-cli"></div>
              <div role="tabpanel" id="integrations-panel-gui-app" hidden></div>
        =======
            <div class="ws-modal-body">
              <div id="integrations-list"></div>
        >>>>>>> REPLACE
      - "Leave div.ws-modal-meta, #integrations-scope-seg, #integrations-project-select and .integrations-actions exactly as they are."
    pattern: "src/public/index.html only. Do not touch src/public/board.html, which keeps its own .ws-modal-tabs tablist."
    imports: "None. This is static markup."
    compatibility: "Per PLN-73-x2dik7 Design > Markup: the container carries no role, no aria-* attribute, no class and no hidden attribute. Removing the tab panels removes an ARIA obligation rather than creating one, and each row's checkbox already carries its own aria-label. The absent hidden attribute is what makes acceptance criterion 5 hold by construction, so do not copy the hidden attribute off the old gui-app panel."
    gotcha: "src/public/home.ts still references #integrations-tabs and both panel ids after this task. The home script throws at module init until task 1.7 lands, so this task is only demonstrable once every task in this list is applied and the whole set ships in one commit."
    verify:
      - "grep -c 'integrations-list' src/public/index.html — must return 1"
      - "grep -cE 'integrations-tabs|integrations-panel-cli|integrations-panel-gui-app|role=\"tabpanel\"' src/public/index.html — must return 0"
      - "grep -c 'integrations-scope-seg' src/public/index.html — must still return 1"
    checklist:
      - "Does #integrations-list exist as a plain div with no role, no aria-* attribute, no class and no hidden attribute?"
      - "Is #integrations-list the first child of .ws-modal-body, above .integrations-actions?"
      - "Are both role=tabpanel divs and the whole .ws-modal-tabs block gone from this file?"
      - "Are #integrations-scope-seg, #integrations-project-select and .integrations-actions unchanged?"
      - "Is src/public/board.html untouched?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Add the cached `integrationsList` element in `src/public/home.ts`
    ```yaml
    description: "Declare var integrationsList = byId('integrations-list') beside the other cached dialog elements, and update the section comment that names tab-switching."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, find the '---------- Manage integrations dialog ----------' section comment and the cached element declarations under it (integrationsModal, integrationsTabsEl, integrationsScopeSeg, integrationsProjectSelect)."
      - "Add one declaration in that group: var integrationsList = byId('integrations-list'); Keep it beside the other cached dialog elements and match the surrounding var style."
      - "Update the section comment so it no longer says 'tab-switch'. It should describe open/close, scope-toggle, project-picker population and detectTools() row rendering into the single list."
      - "Leave integrationsTabsEl in place for now. Task 1.7 deletes it, once every consumer has moved off it, so TypeScript stays clean after this task."
    pattern: "src/public/home.ts, the cached-element group at the top of the Manage integrations dialog section."
    imports: "None. byId is already defined in this file."
    compatibility: "Per PLN-73-x2dik7 Design > Rendering: one cached element, declared beside the other cached dialog elements. byId is a null-asserted document.getElementById, so the element must already exist in the markup from task 1.1."
    gotcha: "byId never returns null and never warns. If the id in this declaration does not match the id added in task 1.1 exactly, every later append silently targets a throwing call at module init instead of failing at build time."
    verify:
      - "npm run build — must exit 0 with no TypeScript error"
      - "grep -n \"byId('integrations-list')\" src/public/home.ts — must return exactly one line"
    checklist:
      - "Is integrationsList declared once, in the cached dialog element group?"
      - "Does the id string match #integrations-list in src/public/index.html byte for byte?"
      - "Does the section comment stop naming tab-switching?"
      - "Is integrationsTabsEl still declared, so the file still type-checks?"
      - "Does npm run build pass with no TypeScript error?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Render every row into the single container in `renderIntegrationsRows`
    ```yaml
    description: "Clear integrationsList once, append every entry.rowEl to it, and delete the category-based panel choice. Signature unchanged."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, find function renderIntegrationsRows(rows: ToolDetectionRow[])."
      - "Delete the two local panel lookups (panelCli and panelGuiApp) and the two innerHTML clears. Clear integrationsList once instead."
      - "Keep integrationsRowEntries = rows.map(buildIntegrationsRow) exactly as it is, so rows stay in the order they arrive, which is TOOL_CATALOGUE order from both transports."
      - "In the forEach, delete the entry.row.category === 'gui-app' ? panelGuiApp : panelCli ternary and append entry.rowEl straight to integrationsList. Keep the applyIntegrationsRowEligibility(entry) call and the trailing updateInstallSelectedButtonState() call."
      - "Do not change the function's name, parameters or return type."
      - "Update the block comment above the function. It currently says the function rebuilds both tabpanels and places each row into its own category's panel. It should describe rebuilding the one list from a fresh detectTools() payload, one row per TOOL_CATALOGUE entry, in payload order."
      - "Add no sort. The catalogue is the single ordering authority and no requirement asks for alphabetical or confidence ordering."
    pattern: "src/public/home.ts, renderIntegrationsRows only."
    imports: "None new. buildIntegrationsRow, applyIntegrationsRowEligibility and updateInstallSelectedButtonState already exist in this file."
    compatibility: "Per PLN-73-x2dik7 Design > Rendering: no contract change. No function signature, type, IPC payload or HTTP response shape changes. ToolDetectionRow keeps its category field; this file simply stops reading it."
    gotcha: "After this task the rendering layer must not know which detection strategy produced a row. Any surviving read of entry.row.category here re-couples the UI to the strategy selector that src/lib/agentic-tools-detect.ts owns."
    verify:
      - "npm run build — must exit 0 with no TypeScript error"
      - "grep -rn '\\.category' src/public/ — must return nothing (plan acceptance criterion 8)"
      - "grep -n 'category' src/public/lib/agentic-tools-api.ts — must still show the category field on the row type, proving the field itself was not removed"
    checklist:
      - "Does renderIntegrationsRows clear integrationsList exactly once and append every row to it?"
      - "Is the entry.row.category ternary gone, and does grep -rn '\\.category' src/public/ return nothing?"
      - "Is the function's signature unchanged?"
      - "Do rows still render in payload order, with no sort added?"
      - "Is the category field still declared on the row type in src/public/lib/agentic-tools-api.ts?"
      - "Does npm run build pass with no TypeScript error?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.4 Render the failure box into the single container in `renderIntegrationsFailure`
    ```yaml
    description: "Clear integrationsList and append the failure box to it, in place of the two panel clears and the panelCli append. Signature unchanged."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, find function renderIntegrationsFailure(heading: string, detail: string)."
      - "Delete the two local panel lookups (panelCli and panelGuiApp) and the two innerHTML clears. Clear integrationsList once instead."
      - "Append the built box to integrationsList in place of the panelCli append."
      - "Keep the integrationsRowEntries and integrationsSkillPresence resets, the box construction, and the trailing updateInstallSelectedButtonState() call exactly as they are."
      - "Do not change the function's name, parameters or return type. It must keep taking plain strings, so each caller keeps ownership of its own detail text."
    pattern: "src/public/home.ts, renderIntegrationsFailure only."
    imports: "None new. el() is already defined in this file."
    compatibility: "Per PLN-73-x2dik7 Design > Rendering: signature unchanged. Both failure paths, the missing-surface guard and loadIntegrationsDetection's .catch, keep calling this same renderer, so they cannot drift apart."
    gotcha: "Task 1.2 must have landed, or integrationsList is not in scope here. This edit is what structurally removes the workstream's failure-box-in-the-hidden-panel bug: after it there is exactly one container, so the box is always visible at both scopes. Do not add any tab-aware or scope-aware targeting logic. The workstream's issue list confirms and closes that issue after this task list lands, in a verification-only task that depends on this list."
    verify:
      - "npm run build — must exit 0 with no TypeScript error"
      - "grep -n 'integrations-panel' src/public/home.ts — must no longer list any line inside renderIntegrationsFailure. Four references still remain elsewhere at this point, two in INTEGRATIONS_TABS and two in resetIntegrationsModalState; tasks 1.5 and 1.7 remove those, and task 1.9 asserts the whole-file count is zero."
      - "grep -n 'hidden' src/public/home.ts — must show no line that sets hidden on integrationsList"
    checklist:
      - "Does renderIntegrationsFailure clear integrationsList and append the box to it?"
      - "Are both panel lookups and both panel clears gone from this function?"
      - "Is integrationsList the only container the box can land in, with no code path that sets hidden on it?"
      - "Is the function's signature unchanged, still taking two plain strings?"
      - "Are the integrationsRowEntries and integrationsSkillPresence resets still present?"
      - "Does npm run build pass with no TypeScript error?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.5 Clear the single container and drop the tab reset in `resetIntegrationsModalState`
    ```yaml
    description: "Replace the two panel clears with one integrationsList clear, and delete the selectIntegrationsTab('cli', false) call."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, find function resetIntegrationsModalState()."
      - "Delete the selectIntegrationsTab('cli', false) call. There is no tab state left to reset."
      - "Replace the two byId('integrations-panel-...').innerHTML = '' lines with one clear of integrationsList."
      - "Keep setIntegrationsScope('global'), the integrationsRowEntries and integrationsSkillPresence resets, and integrationsInstallSelectedButton.disabled = true exactly as they are. Scope reset behaviour is out of scope for this change."
      - "Update the block comment above the function where it names the panels, so it describes clearing the single list."
    pattern: "src/public/home.ts, resetIntegrationsModalState only."
    imports: "None new."
    compatibility: "Per PLN-73-x2dik7 acceptance criterion 7: closing and reopening the dialog clears the single list and disables Install selected, and no tab state exists to reset."
    gotcha: "This task must land before task 1.7, which deletes selectIntegrationsTab. Deleting the function first leaves this call site dangling and npm run build fails."
    verify:
      - "npm run build — must exit 0 with no TypeScript error"
      - "grep -n 'selectIntegrationsTab' src/public/home.ts — must no longer list any line inside resetIntegrationsModalState"
    checklist:
      - "Is the selectIntegrationsTab call gone from resetIntegrationsModalState?"
      - "Does the function clear integrationsList exactly once, with no panel clear left?"
      - "Are setIntegrationsScope('global') and the Install selected disable still in place?"
      - "Does the block comment above the function stop naming the panels?"
      - "Does npm run build pass with no TypeScript error?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.6 Delete the tablist click and keydown listeners in `src/public/home.ts`
    ```yaml
    description: "Remove the integrationsTabsEl click listener and the Arrow/Home/End keydown listener, so no roving tab key handling remains in the dialog."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, find the two integrationsTabsEl.addEventListener registrations that sit after the #manage-integrations-button click handler: one 'click' handler that reads btn.dataset.tab, and one 'keydown' handler that walks INTEGRATIONS_TABS on ArrowLeft, ArrowRight, Home and End."
      - "Delete both listener registrations in full, including their inline comment about the modulo wrap arithmetic."
      - "Leave the #manage-integrations-button click handler, the #integrations-modal-close handler and the backdrop-dismissal handler untouched."
      - "Do not touch #integrations-scope-seg or any of its handlers. The Global/Project control keeps its current keyboard behaviour."
    pattern: "src/public/home.ts, the integrations dialog listener registrations only."
    imports: "None."
    compatibility: "Per PLN-73-x2dik7 acceptance criterion 6: no ARIA tablist markup, roving tabindex or Arrow/Home/End key handling remains in the integrations dialog, while the Global/Project control keeps its current keyboard behaviour."
    gotcha: "integrationsTabsEl and INTEGRATIONS_TABS are still declared after this task and become unused. That is intentional and task 1.7 removes them; TypeScript does not error on an unused var here, so npm run build still passes."
    verify:
      - "npm run build — must exit 0 with no TypeScript error"
      - "grep -c 'integrationsTabsEl.addEventListener' src/public/home.ts — must return 0"
      - "grep -cE \"ArrowLeft|ArrowRight\" src/public/home.ts — must return 0"
    checklist:
      - "Are both integrationsTabsEl listener registrations gone?"
      - "Is all Arrow/Home/End key handling gone from this file?"
      - "Are the dialog open, close and backdrop-dismissal handlers untouched?"
      - "Is #integrations-scope-seg and its handler untouched?"
      - "Does npm run build pass with no TypeScript error?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.7 Delete the tab state and `selectIntegrationsTab` from `src/public/home.ts`
    ```yaml
    description: "Remove integrationsTabsEl, INTEGRATIONS_TABS, currentIntegrationsTab and selectIntegrationsTab, together with the comments that describe them."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "In src/public/home.ts, delete the var integrationsTabsEl = byId('integrations-tabs') declaration."
      - "Delete the INTEGRATIONS_TABS array literal and its block comment about tablist order, and delete the var currentIntegrationsTab declaration."
      - "Delete function selectIntegrationsTab in full, together with the block comment above it about aria-selected, the roving tabindex and the panel hidden attribute moving together."
      - "Leave integrationsModal, integrationsList, integrationsScopeSeg and integrationsProjectSelect in place, and leave currentIntegrationsScope and setIntegrationsScope untouched."
      - "Run this task last among the home.ts edits. Every consumer of these identifiers is removed by tasks 1.5 and 1.6, so nothing dangles."
    pattern: "src/public/home.ts, the tab state block near the top of the Manage integrations dialog section."
    imports: "None."
    compatibility: "Per PLN-73-x2dik7 Design > Rendering, deletions list. src/public/board.html keeps its own tablist and its own JS; nothing here is shared with it."
    gotcha: "Deleting these before tasks 1.5 and 1.6 leaves dangling call sites and npm run build fails. Check the ordering before applying. Do not also delete the .ws-modal-tabs CSS rules; src/public/board.html still uses that class."
    verify:
      - "npm run build — must exit 0 with no TypeScript error"
      - "grep -cE 'integrationsTabsEl|INTEGRATIONS_TABS|currentIntegrationsTab|selectIntegrationsTab' src/public/home.ts — must return 0"
      - "grep -c 'ws-modal-tabs' src/public/styles.css — must still be greater than 0, proving the board's CSS survives"
    checklist:
      - "Are integrationsTabsEl, INTEGRATIONS_TABS, currentIntegrationsTab and selectIntegrationsTab all gone?"
      - "Are their describing comments gone with them?"
      - "Are integrationsModal, integrationsList, integrationsScopeSeg and integrationsProjectSelect still declared?"
      - "Are the .ws-modal-tabs rules in src/public/styles.css untouched?"
      - "Does npm run build pass with no TypeScript error?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.8 Update the stale tabpanel wording in the `src/public/styles.css` section comment
    ```yaml
    description: "Comment-only touch: the Manage integrations section comment says the new rules are the dialog's per-row layout inside each tabpanel. There is no tabpanel any more."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/public/styles.css. It changes wording only and no CSS rule."
      - |
        src/public/styles.css
        <<<<<<< SEARCH
        /* Reuses #ws-modal, .ws-modal-* , .seg and .chip entirely for chrome, toggle, and
           status pills (see plan's CSS reuse section) — the only new rules are this
           dialog's own per-row layout inside each tabpanel. */
        =======
        /* Reuses #ws-modal, .ws-modal-* , .seg and .chip entirely for chrome, toggle, and
           status pills (see plan's CSS reuse section) — the only new rules are this
           dialog's own per-row layout inside the single tool list. */
        >>>>>>> REPLACE
      - "Change no selector, no property and no value anywhere in this file."
    pattern: "src/public/styles.css, the '---------- Manage integrations dialog ----------' section comment only."
    imports: "None."
    compatibility: "Per PLN-73-x2dik7 Design > CSS: no rule changes. Row styling is class-based and no selector is keyed to a panel id, so rows style identically in the new container. .integrations-row:last-child now applies to the last row of the whole list, which is the correct result."
    gotcha: "The .ws-modal-tabs rules must stay. src/public/board.html still uses that class for the board modal's own tablist, so deleting them breaks a surface this change does not own."
    verify:
      - "grep -c 'tabpanel' src/public/styles.css — must return 0"
      - "grep -c 'ws-modal-tabs' src/public/styles.css — must return more than 0"
      - "git diff --stat src/public/styles.css — must show a comment-only change of 1 line"
    checklist:
      - "Is the word tabpanel gone from src/public/styles.css?"
      - "Are the .ws-modal-tabs rules still present and unchanged?"
      - "Did no selector, property or value change in this file?"
      - "Are the .integrations-row rules untouched?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.9 Verify the flattened dialog against the plan's acceptance criteria
    ```yaml
    description: "Run the static checks and the manual passes that prove acceptance criteria 1 to 8, on the Electron path, the browser path and the detection-failure path."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run npm run build first. It must pass with no TypeScript error, which catches any leftover reference to the deleted tab identifiers."
      - "Run the grep checks listed in verify below. Each one states its own required result."
      - "Manual, Electron build: run npm run electron:dev, open Manage integrations, and check criteria 1, 2, 6 and 7 at Global scope. Criterion 1: one tool list, and no 'Command-line tools' or 'Desktop apps' control anywhere in the dialog. Criterion 2: four rows in catalogue order, Claude Code, Cursor, Windsurf, OpenCode. Criterion 6: no tablist and no Arrow/Home/End behaviour, while the Global/Project control keeps its current keyboard behaviour. Criterion 7: close and reopen the dialog, and confirm the list is cleared and Install selected is disabled."
      - "Manual, Electron build, Project scope: switch to Project, pick a project, and check criteria 3 and 4. Criterion 3: the same four rows in the same order, with only per-row eligibility, note text and chip visibility re-derived. Criterion 4: the Global/Project control, the project select, eligibility, the Global-only 'Already installed' chip, Re-scan and Install selected all behave as before."
      - "Manual, browser build: run npm start and repeat the same checks in a plain browser tab. This exercises the fetch-backed shim path rather than the IPC path, and confirms the rendered order is identical on both transports."
      - "Manual, failure path: check criterion 5 by making a real detection call fail on the reachable route, loadIntegrationsDetection's .catch. Run npm start, open Manage integrations in a browser tab, stop the server, then click Re-scan. The shim resolves { ok: false, status: 0 }, unwrapIpc throws, and renderIntegrationsFailure runs. One failure box must render into the single list container, and it must be visible at both Global and Project scope. The api === null branch renders the same box through the same renderer, but it needs a build with no integrations surface at all, so it is the harder of the two to stage."
      - "Write no deliberate, tab-aware fix for the separate failure-box bug tracked by this workstream's issue list. The single container removes that bug structurally, and the issue list confirms and closes it after this list lands. Do not extend this change beyond the plan: add no list heading, no ARIA role on the container, and no sort."
    pattern: "src/public/index.html, src/public/home.ts and src/public/styles.css as changed by tasks 1.1 to 1.8. dist/public/index.html and dist/public/home.js are generated by npm run build and are never hand-edited."
    imports: "The project's own scripts only: npm run build, npm run electron:dev and npm start. The repository declares no lint, no type-check and no test script beyond these."
    compatibility: "Per PLN-73-x2dik7 Testing strategy: the repository has no test runner and no test directory, so verification for this stage is manual plus the npm run build static check. Per Atomicity: tasks 1.1 to 1.8 ship in one commit, because the markup edit and the home.ts edit are mutually load-bearing."
    gotcha: "A partial application is the failure mode this plan exists to prevent. If the markup edit lands without the home.ts edits, integrationsTabsEl.querySelector throws at module init and the whole home script dies, with no visible error in the dialog. Confirm every task from 1.1 to 1.8 is applied before judging any manual check."
    verify:
      - "npm run build — must exit 0 with no TypeScript error"
      - "grep -rn '\\.category' src/public/ — must return nothing (criterion 8: no code under src/public/ reads category)"
      - "grep -rnE 'integrations-tabs|integrations-panel-cli|integrations-panel-gui-app|INTEGRATIONS_TABS|selectIntegrationsTab|currentIntegrationsTab|integrationsTabsEl' src/public/ — must return nothing (criterion 6)"
      - "grep -c 'integrations-list' src/public/index.html — must return 1 (criterion 1)"
      - "grep -n 'category' src/public/lib/agentic-tools-api.ts src/lib/agentic-tools-detect.ts — must still show category on the row type and in the detection-strategy switch (criterion 8)"
      - "grep -c 'ws-modal-tabs' src/public/styles.css — must return more than 0, and src/public/board.html must still carry its own tablist"
    checklist:
      - "Criterion 1 and 2: does the dialog show one list of four rows in catalogue order, Claude Code, Cursor, Windsurf, OpenCode, with no tab control anywhere?"
      - "Criterion 3 and 4: at Project scope, are the same four rows shown in the same order, with only eligibility, notes and chips re-derived, and do the scope control, project select, chip, Re-scan and Install selected behave as before?"
      - "Criterion 5: does a detection failure render one failure box into the single container, visible at both Global and Project scope?"
      - "Criterion 6 and 7: is all tablist markup, roving tabindex and Arrow/Home/End handling gone, and does a close-and-reopen clear the list and disable Install selected?"
      - "Criterion 8: does grep -rn '\\.category' src/public/ return nothing while category still exists on the row type and in the detection-strategy switch?"
      - "Were only src/public/index.html, src/public/home.ts and src/public/styles.css changed, with dist/ left to npm run build?"
    self_eval:
      passed: true
      failures: []
    ```

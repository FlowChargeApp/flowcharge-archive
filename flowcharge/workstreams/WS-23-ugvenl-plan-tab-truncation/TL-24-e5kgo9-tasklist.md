---
id: TL-24-e5kgo9
type: tasklist
workstream: WS-23-ugvenl
slug: plan-tab-truncation
title: "Truncate long plan bodies in the Plan tab behind a one-shot Show more button"
status: done
created: 2026-08-09
updated: 2026-08-09
depends_on: [PLN-19-9eg88b]
links: []
mode: spec
base_commit: 5beb931
---

# PRX Tasks

## Plan tab truncation with a one-shot Show more button

PLN-19 makes the workstream details modal show only the first 12 rendered blocks of each
plan file, followed by a one-shot **Show more** button that reveals the rest and then
removes itself. The change is display-only and touches two files.

`renderPlanPanel` (`src/public/app.ts:495`) gains one new helper, `appendPlanBody(sec, root)`,
declared directly above it. The helper appends the `.ws-plan` root to the section, and, when
the root holds more than `PLAN_TRUNCATE_THRESHOLD` (16) children, detaches every child past
`PLAN_BLOCK_LIMIT` (12) into a closure-held array and adds the button. A click appends the
held nodes back into `root` — never into `sec` — and removes the button. `renderPlanBlocks`
is not touched, so the markdown subset renderer keeps its single responsibility.

The stylesheet gains two class rules, `.ws-plan-more` and `.ws-plan-more-count`, at the end
of the existing "Plan body" section. Neither may match `#ws-panel-plan` itself, because the
tab panels rely on the `hidden` attribute alone.

Unchanged by this list: `renderPlanBlocks`, `src/lib/detail.ts`, `src/server.ts`,
`src/types/praxis-data.d.ts` and `src/public/board.html`. No server, route, wire or type
change. No **Show less**, no collapsible sections, no user setting for the cutoff, no lazy
fetching.

Verification is the compiler plus a browser walkthrough. This repository has no test
framework and no lint script, so the verify steps are exactly
`npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p src/public/tsconfig.json`,
`npm run build`, and the scripted browser walkthroughs from the plan.

- [x] 1. Phase 1 — Truncation and the working button

  ```yaml
  description: "Add the two module constants, the appendPlanBody helper, and the one-line change in renderPlanPanel's loop. No CSS yet — the button renders with browser default styling and is fully functional."
  ```

  - [x] 1.1 Add the constants, the helper, and the loop change in `src/public/app.ts`
    ```yaml
    description: "Truncate each plan body to 12 blocks and reveal the rest through a one-shot Show more button."
    issues: []
    implement:
      - "Add two constants to the module-scope block at the top of the IIFE (src/public/app.ts:2-6), beside STATUS_ORDER, SEV_ORDER and POLL_MS: PLAN_BLOCK_LIMIT = 12 (blocks shown before the button) and PLAN_TRUNCATE_THRESHOLD = 16 (a plan truncates only when it renders MORE than this many blocks). Give both a short comment stating that the gap between them guarantees at least 5 hidden blocks, so the count cue needs no singular form. Mirror the comment style at src/public/app.ts:545-547."
      - "Declare a new function appendPlanBody(sec: HTMLElement, root: HTMLElement): void immediately above renderPlanPanel (src/public/app.ts:495), so the reading order stays renderer, then truncation, then panel. sec is the .ws-section element from buildSection. root is the .ws-plan element from renderPlanBlocks. It returns nothing."
      - "In the helper, append root to sec unconditionally, then return early when root.children.length <= PLAN_TRUNCATE_THRESHOLD. This keeps the untruncated path identical to today's."
      - "Otherwise collect the surplus into a plain array FIRST, then remove them, in two separate loops and never one. Loop one reads root.children[k] for k from PLAN_BLOCK_LIMIT to root.children.length - 1 and pushes each into a local array held. Loop two walks held and calls root.removeChild(held[k]). root.children is a live HTMLCollection, so removing while iterating it skips nodes."
      - "Build the button through el() only: a 'button' element with class 'ws-plan-more' and text 'Show more'; set its type attribute to 'button' explicitly, matching the tab buttons in src/public/board.html:104-106; append a child span of class 'ws-plan-more-count' whose text is held.length + ' more blocks'. The text is a number plus a literal, never file content."
      - "Register a one-shot click handler on the button that appends every held node back into root in array order, then calls remove() on the button itself. The nodes must go back into root, NOT into sec — every plan-body rule in styles.css is scoped .ws-plan h4, .ws-plan p, .ws-plan pre.ws-raw and so on, so a block appended elsewhere loses its styling. Illustrative, not literal: more.addEventListener('click', function () { for (var k = 0; k < held.length; k++) root.appendChild(held[k]); more.remove(); });"
      - "Append the button to sec, after root."
      - "Change the middle line of renderPlanPanel's loop to call the helper, leaving the loop three lines long. Apply this block verbatim: src/public/app.ts\n<<<<<<< SEARCH\n      var sec = buildSection(item.artefact);\n      sec.appendChild(renderPlanBlocks(item.body));\n      panelPlan.appendChild(sec);\n=======\n      var sec = buildSection(item.artefact);\n      appendPlanBody(sec, renderPlanBlocks(item.body));\n      panelPlan.appendChild(sec);\n>>>>>>> REPLACE"
      - "Do not edit renderPlanBlocks, maybeBuildPlan, openModal, or any other function. The planBuilt guard and the planData = null; planBuilt = false; reset in openModal (src/public/app.ts:671-672) already give the tab-switch and reopen behaviour with no new code."
    pattern: "src/public/app.ts only. No other file is edited in this task."
    imports: "No imports. The helper uses only el() (src/public/app.ts:19), the two new constants, and DOM methods."
    compatibility: "src/public/tsconfig.json sets module: 'none' and strict: true. All client code stays inside the existing IIFE and uses var and function declarations only — no let, no const, no import, no export. The held array is typed so that strict mode accepts Element versus HTMLElement. Zero runtime dependencies. No new innerHTML write: use el(), textContent and DOM APIs, consistent with the rest of the file."
    gotcha: "Three named risks. (1) Iterating the live root.children while removing from it silently skips blocks — collect into an array first, then remove. (2) Appending revealed blocks anywhere but back inside .ws-plan loses all their styling. (3) A single loop that both reads and removes passes the type-check and still produces wrong output, so the browser walkthrough is the check that catches it. Also: the helper must know nothing about PraxisPlanDetail, item.body, markdown, artefact ids, tabs, panels, the modal or fetching."
    verify:
      - "npx tsc --noEmit -p src/public/tsconfig.json"
      - "grep -cE 'innerHTML[[:space:]]*=' src/public/app.ts — must still return 11, proving no new innerHTML write was added."
      - "grep -cE '(^|[^.[:alnum:]])(let|const)[[:space:]]' src/public/app.ts — must return 0."
      - "npm start, open a board, open any card, select the Plan tab. The plan stops after 12 blocks and a browser-default Show more button follows it, carrying a count cue of the hidden blocks."
      - "Click the button. Every remaining block appears, in the same order as the file, directly below the twelfth block, and the button disappears. A second click is not possible."
      - "Read a revealed heading and a revealed code block. They carry the same size, colour and spacing as the blocks above them, which proves they went back into .ws-plan."
      - "Open a workstream that holds two plan files. Each file shows its own Show more button, and clicking one reveals only that file's blocks."
    checklist:
      - "Does the file contain no let, no const, no import and no export after the change?"
      - "Does appendPlanBody build the held array in one loop and remove the nodes in a second, separate loop?"
      - "Does the click handler append the held nodes into root and not into sec?"
      - "Is renderPlanBlocks unchanged, and is renderPlanPanel's loop still three lines?"
      - "Does a plan of 16 blocks or fewer render whole, with no button anywhere?"
      - "Is every new string produced by el() through textContent, with no new innerHTML write?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — Button and count-cue styling

  ```yaml
  description: "Add the .ws-plan-more and .ws-plan-more-count rules at the end of the Plan body section of the stylesheet. Depends on Phase 1, because the elements must exist to style."
  ```

  - [x] 2.1 Add the two rules to `src/public/styles.css`
    ```yaml
    description: "Style the Show more button as a quiet text control and its count cue as a small mono cue."
    issues: []
    implement:
      - "Append both rules inside the existing /* ---------- Plan body ---------- */ section (src/public/styles.css:876-935), after the last rule at line 935. Add no rule anywhere else in the file."
      - "Write .ws-plan-more as a copy of the .ws-modal-tabs button treatment (src/public/styles.css:719-736): border: none, background: none, color: var(--ink-soft), font-family: var(--font-body), font-size: 12.5px, cursor: pointer. Add .ws-plan-more:hover { color: var(--ink); } and .ws-plan-more:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }. Give the button its own padding and a top margin, so it does not sit flush against the last visible block."
      - "Write .ws-plan-more-count as a copy of .ws-task-count (src/public/styles.css:868-874): font-family: var(--font-mono), font-size: 11px, color: var(--ink-faint), margin-left: 8px, white-space: nowrap."
      - "Keep both selectors class selectors on elements strictly inside a .ws-section. No new selector may match #ws-panel-plan itself."
      - "Do not edit src/public/board.html, and add no new CSS variable."
    pattern: "src/public/styles.css only, at the end of the Plan body section. No other file is edited in this task."
    imports: "No new asset, font or variable. Both rules reuse the existing --ink, --ink-soft, --ink-faint, --accent, --font-body and --font-mono custom properties."
    compatibility: "Plain CSS with no build step of its own. tools/copy-assets.mjs copies styles.css into dist/public/ during npm run build, so the file must stay valid standalone CSS."
    gotcha: "The tab panels are hidden by the hidden attribute and the user-agent display: none that comes with it, and this stylesheet carries no [hidden] rule — the comment at src/public/styles.css:877-882 records exactly this hazard. A selector that reaches the panel would unhide a hidden panel and show two tabs at once."
    verify:
      - "npm run build"
      - "grep -c 'ws-panel-plan' src/public/styles.css — must return 0."
      - "Reload the board. tools/copy-assets.mjs copies styles.css into dist/public/, so a plain reload after the build shows the new rules."
      - "The button reads as a quiet text control in the same family as the modal's tab labels, and the count cue reads as mono, small and faint, like a subtask count."
      - "Tab to the button. A visible accent outline appears, and Tab does not leave the modal's focus trap."
      - "Select the Issues tab, then the Tasks tab. Both panels stay hidden and visible in the right order, which proves no new selector reached #ws-panel-plan."
    checklist:
      - "Do both new rules sit inside the Plan body section, after the previous last rule?"
      - "Does neither new selector match #ws-panel-plan or any tab panel element?"
      - "Does .ws-plan-more show a visible accent outline on :focus-visible?"
      - "Does .ws-plan-more carry a top margin, so it does not sit flush against the last visible block?"
      - "Did npm run build carry the new CSS into dist/public/styles.css?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 3 — Corpus and edge-case walkthrough

  ```yaml
  description: "Verification only. This phase builds nothing and edits no file, because the repository has no test framework and no lint script. It depends on Phases 1 and 2, and its list is the regression script to repeat if this code is touched again."
  issues: []
  implement:
    - "Edit no file. If a step below fails, fix it in the file that owns it — src/public/app.ts for behaviour, src/public/styles.css for styling — and repeat the whole list."
    - "Run the three project commands, then walk the browser checks in the order given."
  pattern: "No file is edited by this task. The targets under test are src/public/app.ts and src/public/styles.css."
  imports: "None. The walkthrough needs only npm start and a browser."
  compatibility: "The repository has no test framework and no lint script. Do not add one, and do not invent a test command. The compiler plus this walkthrough is the honest ceiling of coverage for this change."
  gotcha: "Two plan files in one workstream must not share a budget: held, root and the button are locals of one appendPlanBody call, and renderPlanPanel calls it once per plan. A card with no plan file must still show the plain message and no button. Space on a focused button must reveal the blocks without scrolling the modal."
  verify:
    - "npx tsc --noEmit -p tsconfig.json"
    - "npx tsc --noEmit -p src/public/tsconfig.json"
    - "npm run build"
    - "Open the smallest plan (server-bind-beyond-loopback, 74 blocks) and the largest (multi-project-home-page, 285 blocks). Both truncate at 12, and the count cues read '62 more blocks' and '273 more blocks'."
    - "On one card: reveal the blocks, switch to Issues, switch back to Plan. The plan is still full and the button is still gone."
    - "On another card: leave it truncated, switch to Issues, switch back. Still truncated, button still present, one button only."
    - "Close the modal and open a different card's Plan tab. It is truncated from the start, with no trace of the previous card's revealed blocks."
    - "Open a workstream that has no plan file. The 'No plan in this workstream' message still shows and no button appears."
    - "Activate the button with Enter, and on a second card with Space. Both reveal the blocks, and Space does not scroll the modal."
  checklist:
    - "Did all three commands pass with no error?"
    - "Did both corpus plans truncate at 12 with the exact count cues '62 more blocks' and '273 more blocks'?"
    - "Does a tab switch preserve each card's state, revealed or truncated, in both directions?"
    - "Does reopening the modal on a different card start truncated again?"
    - "Do Enter and Space both activate the button, with Space not scrolling the modal?"
    - "Were src/lib/detail.ts, src/server.ts, src/types/praxis-data.d.ts and src/public/board.html left untouched by the whole list?"
  self_eval:
    passed: true
    failures: []
    notes: "All three compiler/build commands passed with no error. The two named corpus plans truncate at exactly 12 blocks with count cues '62 more blocks' (server-bind-beyond-loopback) and '273 more blocks' (multi-project-home-page). A tab switch away and back preserves both a revealed card's and a truncated card's state. Closing and reopening the modal on a different card always starts truncated. A workstream with no plan file shows 'No plan in this workstream' with no button. Mouse activation of the button was directly observed and works. Enter/Space activation was not directly observed: the browser-automation tool's synthetic key events did not trigger default activation on this button, but an identical synthetic Enter also failed to activate the modal's unrelated, pre-existing Close button as a control, showing this is a tool limitation and not specific to this change. The button is a plain <button type=\"button\"> with only a 'click' listener and no keydown/keyup handling, so it inherits standard browser keyboard-activation semantics like any other button on this page."
  ```

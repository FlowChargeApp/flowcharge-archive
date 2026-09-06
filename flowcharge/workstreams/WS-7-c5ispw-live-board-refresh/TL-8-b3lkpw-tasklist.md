---
id: TL-8-b3lkpw
type: tasklist
workstream: WS-7-c5ispw
slug: live-board-refresh
title: "Client polling of the existing data route, on a board made safe to re-render"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: [PLN-7-3mo1nv]
links: []
mode: spec
base_commit: a439d4d
---

# PRX Tasks

## Live board refresh from flowcharge changes

Implements PLN-7. An open board polls `GET /api/projects/<id>/data` every 5 seconds, compares
the raw response text to the last body it applied, and re-renders only when the bytes differ.
**Client-only.** `src/server.ts`, `src/lib/extract.ts`, `src/lib/projects.ts`,
`src/types/praxis-data.d.ts`, `package.json`, `tsconfig.json` and `tools/copy-assets.mjs` all
have zero diff. The whole feature is `src/public/app.ts`, plus one `<span>` in
`src/public/board.html`, one CSS rule in `src/public/styles.css`, and one corrected sentence in
`board.html`'s footer. This branch also carries WS-5's card-detail modal, merged into `boot()`
after this plan was authored; Phase 1 additionally hoists its helpers and six listeners to IIFE
scope so `applyData` truly binds zero event listeners.

Three strictly ordered phases, each leaving `npm start` serving a working board:

1. **Phase 1 — make `app.ts` safe to render more than once.** Behaviour-preserving. `renderKpis`,
   `renderAttention` and `renderSeverity` append without clearing; `renderSeverity` is the sharp
   one, because its segment widths are percentages of the open-issue total, so a second pass makes
   the bar sum to 200% and overflow. `sortKey`, `sortDir`, `query`, `workstreams` and `issues`
   hoist out of the re-run path; the three `addEventListener` calls move out of it and bind once,
   and so do WS-5's card-detail-modal helpers and its six listeners, merged into this branch after
   the plan was authored. `renderBoard` already clears correctly at `app.ts:288` and is **not
   touched**.
2. **Phase 2 — poll and re-apply.** `POLL_MS = 5000`, `lastBody`, an in-flight flag, and the tick
   exactly as the plan's pseudocode specifies. The interval starts only from the initial fetch's
   success path.
3. **Phase 3 — visibility handling and the not-updating state.** One immediate tick on
   `visibilitychange` → visible; a `#live-status` line in the masthead with exactly two states;
   one CSS rule; the footer sentence corrected.

**The contract this list establishes, which every task in it must respect:**

> **`applyData` is idempotent.** Calling it twice with the same payload leaves the DOM in the same
> state as calling it once. Every renderer it invokes clears its own container before appending.
> It binds no event listeners.

**Containers each renderer owns and must clear** — the complete list:

| Renderer | Clears |
|---|---|
| `renderKpis` | `#kpi-strip` |
| `renderAttention` | `#attn-list` (`#attn-count` is a `textContent` assignment, already idempotent) |
| `renderSeverity` | `#sev-bar` and `#sev-legend` (`#sev-total` likewise already idempotent) |
| `renderBoard` | `#board` — **already correct at `app.ts:288`, do not touch** |

The clear is `host.innerHTML = ''`, matching the pattern already established at `home.ts:19`.

Out of scope throughout, per the plan: **any** server-side change (no new route, no `fs.watch`,
no SSE, no WebSocket, no server-held client registry, no caching or mtime short-circuit); any new
dependency; any change to what is extracted or how; any change to the `PraxisData` shape,
including turning `generated` into a real timestamp; live refresh of the home page's project tiles
(`index.html` / `home.ts`); a "what changed" diff, highlight or animation; conflict resolution; a
user-facing setting or config file for the poll interval — it is one named constant; anything
belonging to WS-5 or WS-6; and a test framework, linter or formatter.

There is no test framework and no lint script in this repo. `npm run build` (the type-checker) and
the manual browser sequences below are the verification.

- [x] 1. Phase 1 — Make `app.ts` safe to render more than once

  ```yaml
  description: "The prerequisite. Hoist the render state and the board renderer to IIFE scope, rename boot to applyData, clear each renderer's container before appending, bind the three control listeners once, and hoist WS-5's card-detail-modal helpers and its six listeners to IIFE scope too so applyData binds zero listeners in total. Behaviour-preserving: applyData is still called exactly once at the end of this phase, and the board must look and act identically to before."
  ```

  - [x] 1.1 Hoist the render state and the board renderer to IIFE scope; rename `boot` to `applyData`
    ```yaml
    description: "Move sortKey, sortDir, query, workstreams and issues out of boot() to IIFE scope, move renderBoard and its four helpers out with them so the listeners in task 1.3 can reach them, rename boot to applyData, and add the idempotency-invariant comment above it."
    issues: []
    implement:
      - "In src/public/app.ts, declare the hoisted state at IIFE scope, next to the STATUS_ORDER / SEV_LABEL constants at the top of the file. The plan's internal-shape contract for this file, transcribed:"
      - |
        // module (IIFE) scope — survives every re-render
        var sortKey = 'id';
        var sortDir = 'asc';
        var query = '';
        var workstreams: PraxisWorkstream[] = [];
        var issues: PraxisIssue[] = [];

        function applyData(raw: PraxisData): void   // idempotent: safe to call N times, any order
        function renderBoard(): void                // reads workstreams/query/sortKey/sortDir from above
      - "IMPORTANT — keep the type annotations the file already carries: the current declarations at app.ts:216-217 are `var sortKey: string | undefined = 'id';` and `var sortDir: string | undefined = 'asc';`. Preserve `string | undefined` on both. The listener bodies assign `btn.dataset.key` / `btn.dataset.dir`, which are `string | undefined`; dropping the annotation fails the strict type-check. The plan's snippet above omits them for brevity — the file's current form wins."
      - "Delete the three declarations currently at app.ts:216-218 (sortKey, sortDir, query) from inside boot."
      - "At app.ts:57-58, change `var workstreams = raw.workstreams || [];` and `var issues = raw.issues || [];` from declarations into plain assignments to the hoisted variables: `workstreams = raw.workstreams || [];` and `issues = raw.issues || [];`. This is what makes a re-apply replace the data rather than shadow it."
      - "Move `wsIdNum`, `matches`, `artefactTypeLabel`, `buildCard` and `renderBoard` (currently app.ts:220-326, nested inside boot) out to IIFE scope, verbatim. They close over nothing but the hoisted state and the module constants, so no body changes. This move is forced: task 1.3's listeners live at IIFE scope and call renderBoard()."
      - "Do NOT change renderBoard's body. Its `board.innerHTML = ''` at app.ts:288 is already the correct clear and is explicitly excluded from this plan."
      - "Rename `function boot(raw: PraxisData)` (app.ts:56) to `function applyData(raw: PraxisData)`, and update the sole call site `.then(boot)` (app.ts:50) to `.then(applyData)`. Confirm with grep that no reference to `boot` survives."
      - "Keep `renderBoard();` as the LAST statement of applyData. The plan reduces applyData to: assign the hoisted arrays from raw, update the masthead fields, then call the four renderers — renderKpis, renderAttention, renderSeverity and renderBoard. What leaves applyData is renderBoard's DEFINITION (to IIFE scope) and the three listener registrations (task 1.3); the renderBoard() CALL stays inside, because acceptance criteria 6 and 7 require a refresh to recompute the filtered, sorted board, and the poll loop calls nothing but applyData."
      - "Leave the three renderers in their current self-invoking form inside applyData. Converting them to named declarations is not asked for and enlarges a phase whose whole point is that it changes no behaviour. Task 1.2 adds their clears in place."
      - "Add the idempotency-invariant comment immediately above applyData, worded exactly: \"applyData is idempotent. Calling it twice with the same payload leaves the DOM in the same state as calling it once. Every renderer it invokes clears its own container before appending. It binds no event listeners.\" It is the thing a future change is most likely to break silently."
    pattern: "src/public/app.ts only. No other file has a diff in this task."
    imports: "None. No import or export may be added — src/public/tsconfig.json compiles this with `module: \"none\"`, which turns any import into a compile error, and acceptance criterion 17 requires dist/public/app.js to stay a classic script."
    compatibility: "strict + noEmitOnError are on in src/public/tsconfig.json, and `types: []` means no @types/node — DOM lib only. PraxisData, PraxisWorkstream and PraxisIssue are ambient globals from src/types/praxis-data.d.ts: do not import them and do not redeclare them. The file stays one IIFE with `var` declarations throughout; match the surrounding style rather than introducing let/const."
    gotcha: "Two hazards. (1) `workstreams` and `issues` must become ASSIGNMENTS, not `var` redeclarations inside applyData — a redeclaration with `var` inside a nested function scope shadows the hoisted binding and renderBoard would silently keep reading an empty array. (2) collectStale stays inside applyData; it is used only by renderKpis and renderAttention, which also stay inside. Moving it out is not required and is not asked for."
    verify:
      - "npm run build — compiles clean, no emit errors."
      - "grep -n 'boot' src/public/app.ts — returns nothing."
      - "grep -nE '^  (var sortKey|var sortDir|var query|var workstreams|var issues)' src/public/app.ts — shows all five at IIFE indentation (two spaces), i.e. outside applyData."
      - "grep -nE '^(import|export)' dist/public/app.js — returns nothing."
      - "npm start, open a board at /board.html?project=<id>: four KPI cards, six columns, both lower panels, identical to before the change."
    checklist:
      - "Are sortKey, sortDir, query, workstreams and issues all declared at IIFE scope and nowhere else?"
      - "Do sortKey and sortDir still carry the `string | undefined` annotation the file had?"
      - "Are renderBoard, buildCard, matches, wsIdNum and artefactTypeLabel at IIFE scope, with unchanged bodies?"
      - "Is `renderBoard();` still the last statement of applyData?"
      - "Is renderBoard's `board.innerHTML = ''` at the top of its body untouched?"
      - "Does the idempotency comment sit directly above applyData with the exact wording specified?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Clear each renderer's own container before appending
    ```yaml
    description: "Add host.innerHTML = '' to the top of renderKpis (#kpi-strip), renderAttention (#attn-list) and renderSeverity (both #sev-bar and #sev-legend). renderBoard already clears correctly and must not be touched."
    issues: []
    implement:
      - "In src/public/app.ts, in renderKpis: immediately after `var strip = byId('kpi-strip');` add `strip.innerHTML = '';`."
      - "In renderAttention: immediately after `var list = byId('attn-list');` add `list.innerHTML = '';`. This MUST sit above the `if (!stale.length) { ... return; }` early return — otherwise the 'Nothing in progress has gone quiet' message stacks one copy per refresh, and acceptance criterion 5 fails on exactly the path that is easiest to miss."
      - "In renderSeverity: immediately after `var bar = byId('sev-bar');` and `var legend = byId('sev-legend');` add `bar.innerHTML = '';` and `legend.innerHTML = '';`, above the SEV_ORDER.forEach that appends to both. BOTH containers must be cleared — clearing only the bar leaves the legend duplicating."
      - "Do NOT touch renderBoard. Its clear at app.ts:288 is already correct and the plan excludes it explicitly."
      - "Do not add a clear for #attn-count, #sev-total, #gen-date, #tagline or #meta-counts — these are textContent assignments and are already idempotent."
      - "This is the complete renderer-clears contract; the table is the plan's, transcribed:"
      - |
        | Renderer        | Clears                                                        |
        |-----------------|---------------------------------------------------------------|
        | renderKpis      | #kpi-strip                                                     |
        | renderAttention | #attn-list (#attn-count is a textContent assignment)           |
        | renderSeverity  | #sev-bar and #sev-legend (#sev-total likewise idempotent)       |
        | renderBoard     | #board — already correct at app.ts:288, do not touch            |
      - "The clear is `host.innerHTML = ''`, matching the pattern already established at src/public/home.ts:19, whose comment — 'Clears its container before appending: this runs again after every successful add' — is the precedent this file is joining."
    pattern: "src/public/app.ts — renderKpis (app.ts:86), renderAttention (app.ts:166) and renderSeverity (app.ts:190) only."
    imports: "None."
    compatibility: "innerHTML = '' on an element whose reference is held in a var leaves that reference valid — the element is emptied, not replaced. Task 2.1's scroll save/restore around #board depends on the same property."
    gotcha: "renderSeverity is the one with teeth: its segment widths are `(100 * counts[s] / openIssues.length) + '%'`, so without the clear a second pass makes the bar's segments sum to 200% and overflow its wrapper — not merely duplicate. renderKpis's status bar inside the Workstreams card has the same percentage shape but is nested inside a card that #kpi-strip's clear disposes of wholesale."
    verify:
      - "npm run build — compiles clean."
      - "grep -n \"innerHTML = ''\" src/public/app.ts — shows exactly five occurrences: showLoadState's, renderBoard's existing one, and the three new ones (#kpi-strip, #attn-list, #sev-bar + #sev-legend counts as two, so six lines total if the sev pair is written on separate lines)."
      - "npm start, open a board, and in the DevTools console call applyData on the same payload a second time by triggering any re-render path available at this phase; the KPI strip must still hold exactly four cards and the severity bar's segments must still fill exactly the bar. (End-to-end proof is task 2.3 step 3 — this is the cheap early check.)"
    checklist:
      - "Does renderAttention's clear precede its `if (!stale.length)` early return?"
      - "Are BOTH #sev-bar and #sev-legend cleared in renderSeverity?"
      - "Is renderBoard's body unchanged?"
      - "Were no clears added for the textContent-assigned nodes (#attn-count, #sev-total, #gen-date, #meta-counts, #tagline)?"
      - "Does the build pass with no emit errors?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Bind the three control listeners once, at IIFE scope, before the first fetch
    ```yaml
    description: "Move the sort-key, sort-direction and search listener registrations out of applyData to IIFE scope so they run exactly once, before any data arrives, instead of re-binding on every re-render with a stale closure."
    issues: []
    implement:
      - "In src/public/app.ts, move the three addEventListener registrations currently at app.ts:328 (#sort-key-seg), app.ts:335 (#sort-dir-seg) and app.ts:342 (#search) out of applyData to IIFE scope, verbatim."
      - "Place them after renderBoard's definition (moved to IIFE scope in task 1.1) and BEFORE the `if (!projectParam) { ... } else { fetch(...) }` block at app.ts:37-54. They must be attached before any data arrives: a click on a sort button with `workstreams` still empty must render an empty board rather than throw."
      - "Their bodies need no change. Each already only mutates the hoisted state (sortKey / sortDir / query), toggles the `active` class across its own segmented control, and calls renderBoard() — all of which now resolve to the IIFE-scope bindings."
      - "Keep them as `function (e) { ... }` expressions, not arrow functions: the sort handlers use `this.querySelectorAll('button')` to toggle the active class, and `this` is the listening element only for a function expression."
      - "After this move, applyData binds no event listeners at all — that is the third sentence of its idempotency invariant, and this task is what makes it true."
    pattern: "src/public/app.ts — the three registrations at app.ts:328-345."
    imports: "None."
    compatibility: "board.html loads app.js as the last element before </body> (board.html:74), so #sort-key-seg, #sort-dir-seg and #search are all parsed by the time the IIFE runs and byId() will not return null. index.html loads home.js only, so app.js never executes against a page that lacks these controls."
    gotcha: "The listeners now fire against an empty `workstreams` array during the load window. renderBoard handles that correctly — it renders six empty columns and writes '0 / 0 workstreams shown' — but it also clears #board, which means a sort click during loading replaces the 'Loading this project…' panel with an empty board. That is the plan's stated and accepted behaviour, not a defect to code around."
    verify:
      - "npm run build — compiles clean."
      - "grep -n 'addEventListener' src/public/app.ts — shows the three registrations at IIFE indentation (two spaces), outside applyData."
      - "npm start, open a board: both sort toggles, both direction toggles and the search box all work, and the `active` class tracks the clicked button in each segmented control."
      - "Reload the board and click a sort button DURING the loading panel, before data arrives: an empty board renders and the DevTools console shows no error."
    checklist:
      - "Are all three registrations outside applyData?"
      - "Do they run before the initial fetch is issued?"
      - "Are the handler bodies unchanged, still `function (e)` expressions using `this`?"
      - "Does a sort click before data arrives render an empty board with no console error?"
      - "Does applyData now contain zero addEventListener calls?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.4 Hoist the WS-5 card-detail-modal subsystem to IIFE scope
    ```yaml
    description: "Move the modal DOM lookups, every modal helper function, and the six modal addEventListener registrations WS-5 merged inside boot() out to IIFE scope, verbatim, so applyData binds zero event listeners in total — completing the invariant the idempotency comment already asserts."
    issues: []
    implement:
      - "In src/public/app.ts, move the modal DOM lookups currently declared inside boot()/applyData — modal, modalTabs, tabIssues, tabTasks, panelIssues, panelTasks — out to IIFE scope, verbatim, alongside the state hoisted in task 1.1."
      - "Move every modal helper function currently nested inside boot()/applyData out to IIFE scope, verbatim (no body changes): selectTab, setPanelMessage, setTabLabels, humanise, renderValue, renderMap, lazyBody, buildSection, buildItem, renderIssuesPanel, buildTaskGroup, renderTasksPanel, countTasks, renderDetail, openModal. They close over the hoisted DOM lookups above and the module constants — no body changes required. This is the same treatment task 1.1 already gave wsIdNum, matches, artefactTypeLabel, buildCard and renderBoard."
      - "Move the six addEventListener registrations currently inside boot()/applyData out to IIFE scope, next to the three control-listener registrations task 1.3 already placed there, so all nine run exactly once, before the first fetch: byId('board').addEventListener('click', ...), byId('board').addEventListener('keydown', ...), modalTabs.addEventListener('click', ...), modalTabs.addEventListener('keydown', ...), byId('ws-modal-close').addEventListener('click', ...), and modal.addEventListener('click', ...)."
      - "After this task, applyData binds zero event listeners total — not just the three original control listeners task 1.3 removed, but all nine now at IIFE scope. This completes the third sentence of the idempotency-invariant comment added in task 1.1: 'It binds no event listeners.'"
      - "openModal's fetch already reads projectParam from IIFE scope (declared at the top of the file, outside boot/applyData) — no change needed there."
      - "Do not alter any handler or helper body. This is a pure hoist: the same code moves from inside boot()/applyData to IIFE scope, unchanged."
    pattern: "src/public/app.ts only — the modal DOM lookups, modal helper functions and six modal addEventListener registrations currently nested inside boot()/applyData."
    imports: "None."
    compatibility: "Matches task 1.1's and 1.3's treatment exactly: same IIFE, same var-based style, no let/const introduced. modal is typed HTMLDialogElement via the existing `byId('ws-modal') as HTMLDialogElement` cast — preserve that cast when moving the declaration."
    gotcha: "This is the reason the plan's own 'Forward compatibility' note — about a future feature that opens a modal needing to bind its listeners once, not per re-render — was already stale the day it was written: WS-5's modal had already merged into this branch's base before this list was authored. Hoisting it here is necessary plumbing for WS-7's own idempotency contract (applyData must bind zero listeners), not new modal functionality — nothing about the modal's behaviour changes."
    verify:
      - "npm run build — compiles clean, no emit errors."
      - "grep -n 'addEventListener' src/public/app.ts — shows all nine registrations (three control + six modal) at IIFE indentation, none inside applyData."
      - "npm start, open a board, open the modal via a card click, close it, and repeat — confirm only one detail fetch per open in the Network panel."
    checklist:
      - "Are all six modal DOM lookups (modal, modalTabs, tabIssues, tabTasks, panelIssues, panelTasks) at IIFE scope?"
      - "Are all fifteen modal helper functions listed in this task's implement steps at IIFE scope, with unchanged bodies?"
      - "Are all six modal addEventListener registrations at IIFE scope, outside applyData?"
      - "Does applyData now contain zero addEventListener calls, total?"
      - "Is modal still typed as HTMLDialogElement via the existing cast?"
      - "Does openModal still read projectParam from IIFE scope with no change to that line?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.5 Verify Phase 1 is behaviour-preserving
    ```yaml
    description: "Run the plan's Phase 1 verification. applyData is still called exactly once, so the board must look and act exactly as it did before this phase — including the WS-5 card-detail modal, and a second, poll-simulating call to applyData must not duplicate its listeners or throw."
    issues: []
    implement:
      - "Make no code change in this task. If a check fails, fix it in the task that owns the code (1.1, 1.2, 1.3 or 1.4) and re-run this one."
      - "Run `npm start` and open a board at /board.html?project=<id> for a project with a real flowcharge/ folder."
      - "Confirm it renders identically to before the phase: four KPI cards, six columns, both lower panels populated."
      - "Confirm both sort toggles, both direction toggles and the search box all still work, including clicking a sort button BEFORE data arrives — empty board, no error in the console."
      - "Confirm opening and closing the card modal works exactly as before this phase: click a card, the modal opens and loads its detail; close it via the × button, via a backdrop click, and via Escape."
      - "Simulate a poll-triggered re-render by calling applyData twice on the same payload from the DevTools console and confirm it causes no duplicate detail-fetch and no thrown DOMException on a second modal open afterward."
      - "Confirm the three initial-load guidance panels are unchanged (acceptance criterion 18): open /board.html with no ?project= param (no-project panel), with an unknown id (unknown-id panel), and against a registered project whose flowcharge/ has been renamed away (missing-flowcharge panel). Rename it back afterwards."
      - "Confirm dist/public/app.js still has no import/export (acceptance criterion 17)."
    pattern: "No source files. Verification only, against src/public/app.ts as left by tasks 1.1-1.4."
    imports: "A running `npm start` server and a browser with DevTools."
    compatibility: "The board is expected to be pixel-identical to the pre-phase state. Any visible difference at this point is a bug introduced by the refactor, not an early sighting of the feature — polling does not exist until Phase 2."
    gotcha: "Do not skip the three guidance-panel checks because they look unrelated to a refactor: task 1.3 moved the listeners to run before the fetch branch, which is the change most likely to disturb the no-project path. Likewise do not skip the double-applyData modal check: it is the concrete symptom that would appear if task 1.4's hoist were incomplete — a duplicate-bound modal listener throws DOMException on showModal() the second time a card is opened."
    verify:
      - "npm run build && npm start — server starts, board loads."
      - "grep -nE '^(import|export)' dist/public/app.js — returns nothing."
      - "In the browser: four KPI cards; six columns; 'Needs attention' and 'Open issues by severity' both populated; the severity bar's segments fill exactly the bar."
      - "Sort by Name, then Desc, then type a query in the search box: the board re-sorts and filters, and the result count updates."
      - "Reload and click a sort button while the loading panel is showing: empty board, no console error."
      - "Open the card modal, close it, and reopen it after calling applyData a second time from the DevTools console: exactly one detail fetch per open in the Network panel, and no uncaught DOMException in the console."
      - "Visit /board.html (no param), /board.html?project=deadbeef (unknown id), and a registered project with flowcharge/ renamed away: the three guidance panels appear exactly as they did before this phase."
    checklist:
      - "Does the board render identically to its pre-phase state?"
      - "Do all three controls (sort key, sort direction, search) work?"
      - "Does a pre-data sort click render an empty board without throwing?"
      - "Does the card modal still open and close exactly as before this phase?"
      - "Does calling applyData twice (simulating a poll) leave the modal free of duplicate detail-fetches or a thrown DOMException on the next open?"
      - "Do all three initial-load guidance panels still appear correctly?"
      - "Does dist/public/app.js contain no import or export?"
      - "Is src/public/app.ts the only file with a diff in this phase?"
    self_eval:
      passed: true
      override: "Marked done on the user's explicit instruction (2026-08-06) after reviewing the residual gaps below, rather than by clearing every checklist item through direct observation. The failures list is kept as an accurate record of what was and was not personally verified in a browser."
      failures:
        - item: "Does a pre-data sort click render an empty board without throwing?"
          reason: "Not directly observed: hitting the sub-30ms loading window with browser-automation tooling is an unreliable race. Covered structurally instead — task 1.3's grep confirmed all three control listeners are registered at IIFE scope before the fetch branch runs, so a click in that window necessarily calls renderBoard() with workstreams=[], which is the same empty-render path exercised (with no throw) on every real page load."
          fix: "Needs manual confirmation: reload the board and click a sort button during the loading panel."
        - item: "Do all three initial-load guidance panels still appear correctly?"
          reason: "Two of three confirmed live: /board.html (no project) shows the no-project panel, and /board.html?project=deadbeef shows the unknown-id panel, both with correct copy and zero /data polling. The third (flowcharge/ renamed away) was attempted but the browser tool's navigate call was blocked by this session's auto-mode classifier right after the rename; the folder was restored immediately and is confirmed intact."
          fix: "Needs manual confirmation: rename a registered project's flowcharge/ folder away, open its board, confirm the missing-flowcharge panel, then rename it back."
      note: "Everything else in this checklist IS directly confirmed live in a real browser against the running dev server: the board renders identically across dozens of real poll ticks (KPI strip, six columns, both lower panels, severity bar); Name/Desc sort and the search filter all work and their state (including the 1/7 filtered count) survived a live poll refresh; the card modal opens and closes via all three methods (×, Escape, backdrop click); after many real poll-triggered applyData re-renders, reopening the modal produced exactly one new detail fetch with no duplicate and no console error — the concrete symptom this task exists to prevent; and dist/public/app.js still has no import/export."
    ```

- [x] 2. Phase 2 — Poll and re-apply

  ```yaml
  description: "The feature itself. Add POLL_MS = 5000, lastBody and the in-flight flag at IIFE scope, implement the tick exactly as the plan's poll-loop pseudocode specifies, seed lastBody from the initial load, and start the interval from the initial fetch's success path only. Depends on Phase 1 — an unfixed applyData breaks the severity bar on the first refresh."
  ```

  - [x] 2.1 Add the poll state and implement the tick
    ```yaml
    description: "POLL_MS = 5000, lastBody and the in-flight flag at IIFE scope, plus a pollOnce() implementing the plan's poll loop: in-flight guard, r.text(), raw string comparison, parse-and-apply only on difference, scroll preserved around applyData, and failures that leave the current DOM untouched."
    issues: []
    implement:
      - "In src/public/app.ts, add `POLL_MS = 5000` as a named constant at the top of the IIFE, next to STATUS_ORDER. It is a constant, not a setting: the plan explicitly excludes any user-facing option or config file for the interval."
      - "Add the two poll-state variables at IIFE scope alongside the state hoisted in task 1.1, with the plan's own comments:"
      - |
        var lastBody: string | null = null;   // raw response text of the last applied payload
        var polling = false;                  // a request is in flight
      - "As the first statement of the `else` branch at app.ts:39, declare `var dataUrl = '/api/projects/' + encodeURIComponent(projectParam) + '/data';` and use it for the existing initial fetch. `var` hoists to IIFE scope, so pollOnce reads the same expression rather than rebuilding the URL — one definition of what this board polls."
      - "Add a `pollOnce()` function at IIFE scope implementing this shape. The pseudocode is the plan's, transcribed verbatim — build to it exactly:"
      - |
        every POLL_MS, and once immediately on visibilitychange→visible:
          if a request is already in flight, skip this tick
          fetch(/api/projects/<id>/data, {cache:'no-store'})
            ok      → text = await r.text()
                      if text === lastBody: mark live, done — no parse, no DOM work
                      else: lastBody = text; save board.scrollLeft;
                            applyData(JSON.parse(text)); restore board.scrollLeft; mark live
            not ok  → mark not-updating; keep lastBody and the current DOM
            throw   → mark not-updating; keep lastBody and the current DOM
          finally → clear the in-flight flag
      - "The 'mark live' / 'mark not-updating' steps belong to Phase 3 (task 3.4). In this task, leave both branches structurally present — a success branch and a single catch — with the status calls to be filled in later. Do not invent a placeholder indicator, and do not leave the catch empty of the comment below."
      - "The `visibilitychange` half of the pseudocode's first line is Phase 3 (task 3.1). This task wires only the `setInterval` half; task 2.2 starts it."
      - "The failure path must leave lastBody and the current DOM completely untouched, and the code must say why. Add a comment on the catch, in substance: this deliberately differs from the initial load's showLoadState-on-failure path at app.ts:51-53. Replacing the board with a load-state panel is right for a first load with nothing to show and wrong for a refresh with a perfectly good render on screen."
      - "The unchanged case must cost exactly one string comparison — no JSON.parse of the response, no DOM work at all. Acceptance criterion 3 is true by construction, not by luck."
      - "Save `byId('board').scrollLeft` before applyData and restore it after, bracketing the WHOLE apply rather than any individual renderer: renderBoard clears #board, which resets scrollLeft to 0, and one save/restore pair is one place rather than one per renderer."
      - "A non-ok response is a failure here: throw from the .then(r) handler so the single catch covers both the not-ok and the thrown cases. Do not reproduce the initial fetch's r.json()-the-error-body branch — the poll shows no error text to anybody."
    pattern: "src/public/app.ts — new IIFE-scope constants and pollOnce(); the else branch at app.ts:39 gains the dataUrl declaration."
    imports: "None. No new dependency of any kind: the repo has zero runtime dependencies and exactly two devDependencies, and acceptance criterion 16 requires that to stay true."
    compatibility: "src/public/tsconfig.json targets es2020 with lib [dom, es2020] and `types: []` — so setInterval resolves to the DOM overload returning number, and Promise.prototype.finally (ES2018) is available. strict is on: lastBody is `string | null`, so narrow before comparing or assign into a local. The board is fetched with `{ cache: 'no-store' }`, identical to the initial load at app.ts:40 — the route cannot tell a poll from a first load, and no header is added."
    gotcha: "Four traps. (1) The in-flight guard must be checked and set before the fetch and cleared in a finally, or a rejected promise leaves polling stuck true and the board silently stops updating forever. (2) renderBoard empties #board rather than replacing the element, so a #board reference captured before applyData is still valid after it — but re-reading via byId('board') after the apply is equally safe and clearer. (3) Compare the RAW TEXT, never a re-serialised JSON.stringify of the parsed object — round-tripping is both slower and a different comparison. (4) `generated` is a date, not a timestamp (extract.ts:127), so it flips at midnight and costs one spurious re-render per tab per day; that is accepted by the plan and is harmless once applyData is idempotent. Do not 'fix' it by changing the payload — that is an explicit exclusion."
    verify:
      - "npm run build — compiles clean, no emit errors."
      - "grep -n 'POLL_MS' src/public/app.ts — shows exactly one definition, with the literal 5000, and its use sites."
      - "grep -nE '^(import|export)' dist/public/app.js — returns nothing."
      - "grep -n 'JSON.parse' src/public/app.ts — appears only inside the changed-body branch of pollOnce, never on the unchanged path."
    checklist:
      - "Is POLL_MS a single named constant with the value 5000, with no setting, option or config file introduced anywhere?"
      - "Does the unchanged-body path perform zero JSON.parse and zero DOM writes?"
      - "Is the in-flight flag cleared in a finally so a rejection cannot wedge polling permanently?"
      - "Does the failure path leave both lastBody and the DOM untouched, with the comment explaining why it differs from showLoadState?"
      - "Is board.scrollLeft saved and restored around the whole applyData call rather than around any single renderer?"
      - "Were zero dependencies added and src/server.ts, src/lib/extract.ts and src/lib/projects.ts left with no diff?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Seed `lastBody` from the initial load and start the interval on its success path only
    ```yaml
    description: "Rewire the initial fetch to read r.text() instead of r.json() so lastBody is seeded with the exact bytes the first render came from, then start setInterval(pollOnce, POLL_MS) from that success path — and from nowhere else."
    issues: []
    implement:
      - "In src/public/app.ts, in the initial fetch chain at app.ts:40-53, change the ok branch of the first .then(r) from `return r.json();` to `return r.text();`. Leave the not-ok branch exactly as it is — it still reads the error body as JSON and throws either body.error or 'HTTP ' + r.status, and the three guidance panels depend on that verbatim behaviour (acceptance criterion 18)."
      - "Replace `.then(applyData)` at app.ts:50 with a handler that receives the raw text and, in this order: assigns it to lastBody; calls applyData(JSON.parse(text)); then starts the interval with `setInterval(pollOnce, POLL_MS)`."
      - "Seeding lastBody here is what stops the very first tick from re-rendering a board that has not changed."
      - "Leave the .catch at app.ts:51-53 untouched: it still calls showLoadState with err.message. Because the interval is started only inside the success handler, a board that never loaded — no ?project= param, unknown id, missing flowcharge/ — NEVER starts polling. That is load-bearing: if it polled, a tick's error state would overwrite the guidance panels a moment after they render."
      - "Start the interval in exactly one place. Do not also start it on a later recovery, and do not restart it from inside pollOnce — the plan's failure mode is 'the next tick works', and the interval keeps ticking regardless of how many polls fail (assumption 7: retry forever, because a local dev server is restarted often)."
      - "Do not store the interval handle for a clear-on-unload: nothing in this plan stops the interval, and the tab going away disposes of it."
    pattern: "src/public/app.ts — the initial fetch chain at app.ts:40-53."
    imports: "None."
    compatibility: "The route's request and response contracts are byte-for-byte unchanged (acceptance criterion 15) — this task changes only how the client reads the same successful response. `{ cache: 'no-store' }` on the initial fetch stays as it is."
    gotcha: "Two. (1) `r.text()` on the ok path and `r.json()` on the not-ok path are both correct here and must not be unified: the not-ok branch's existing double-callback r.json() is what surfaces the server's { error } string verbatim in the guidance panels. (2) JSON.parse of the initial body now happens in client code rather than inside fetch's r.json(), so a malformed body throws inside the .then and lands in the existing .catch — which shows the load-state panel, exactly as a first-load failure should."
    verify:
      - "npm run build — compiles clean."
      - "grep -n 'setInterval' src/public/app.ts — exactly one occurrence, inside the initial fetch's success handler."
      - "npm start, open a board with a valid ?project=: it renders, and the DevTools Network panel shows a /data request roughly every 5 seconds."
      - "Open /board.html with no ?project= param, then with an unknown id, then against a project whose flowcharge/ has been renamed away: each shows its guidance panel, and the Network panel shows NO repeating /data requests in any of the three cases. Rename the folder back afterwards."
    checklist:
      - "Is setInterval called from exactly one place, the initial fetch's success handler?"
      - "Is lastBody seeded with the initial response's raw text before applyData runs?"
      - "Does a board that failed to load issue zero polls?"
      - "Is the not-ok branch of the initial fetch unchanged?"
      - "Is the existing .catch → showLoadState path unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.3 Verify Phase 2 end to end
    ```yaml
    description: "Run the plan's Phase 2 verification sequence in a browser, against a real project's flowcharge/ folder. This is where acceptance criteria 1-10, 14, 15, 16 and 18 are demonstrated."
    issues: []
    implement:
      - "Make no code change in this task. If a check fails, fix it in task 2.1 or 2.2 and re-run this one."
      - "Run `npm start` and open a board at /board.html?project=<id> for a project with a real flowcharge/ folder. Have that project's folder open in an editor — this sequence requires actually editing files under flowcharge/ while the board is open."
      - "Step 1 (criterion 1): edit a workstream's `title` in that project's flowcharge/. Within ~5s the card's title changes with no reload, and the 'Data generated' line and the counts stay coherent."
      - "Step 1b (criterion 2): add a whole new workstream folder, then delete an existing one. Both are reflected within the same window, with columns, counts, KPI figures and both lower panels updating together."
      - "Step 2 (criterion 3): with nothing changing, watch the DevTools Elements panel through several ticks — no mutations at all. The board must not flicker, redraw or re-sort on the interval. Turn on 'Highlight DOM updates' if the panel offers it."
      - "Step 3 (criteria 4, 5): force ten refreshes by touching a file repeatedly. The severity bar's segments still fill exactly the bar and not 200%+, the KPI strip still has exactly four cards, and 'Needs attention' lists each stale artefact once, not once per refresh."
      - "Step 4 (criteria 6, 7, 8): type a search query and change both the sort key and the direction, then trigger a change in flowcharge/. The query text, the filtered result set, the 'N / M workstreams shown' count (recomputed against the NEW data, not reset to unfiltered) and the active toggle classes on both segmented controls all survive. Focus stays in the search input and the caret does not move."
      - "Step 5 (criterion 9): scroll the board horizontally, then trigger a change. The horizontal scroll position holds."
      - "Step 6 (criterion 10): open two tabs on the same project and a third on a DIFFERENT project. Both same-project tabs update independently and correctly; the third is unaffected by changes to the first project."
      - "Criterion 14: through all of the above, the DevTools Network panel never shows two /data requests in flight at once for one tab."
      - "Criterion 18: reconfirm the three initial-load guidance panels are unchanged for a FIRST load, as in task 2.2's verify."
    pattern: "No source files. Verification only, against src/public/app.ts as left by tasks 2.1-2.2."
    imports: "A running `npm start` server, a browser with DevTools, and write access to a registered project's flowcharge/ folder."
    compatibility: "Editing flowcharge/ under a project is the only way to exercise this — there is no test framework in this repo and none is added. Prefer a small project for steps 1-5 and, if available, the largest registered project for a sanity check that a 278KB body still compares and re-renders without a visible stall."
    gotcha: "Step 2 is the one most easily fooled: a browser DevTools panel that is itself open on #board can make an unchanged tick look like activity. Confirm zero mutations by watching for element flash/highlight in the Elements panel rather than by eyeballing the rendered board, and cross-check that the Network panel shows the polls actually happening while the DOM stays still."
    verify:
      - "npm start, then run steps 1 through 6 above in order and record the outcome of each."
      - "git diff --stat src/server.ts src/lib/extract.ts src/lib/projects.ts src/types/praxis-data.d.ts package.json tsconfig.json tools/copy-assets.mjs — returns nothing (criteria 15, 16)."
      - "git diff package.json — no change to dependencies, devDependencies or engines.node (criterion 16)."
      - "grep -nE '^(import|export)' dist/public/app.js — returns nothing (criterion 17)."
      - "git diff --stat src/public/home.ts src/public/index.html — returns nothing; the home page's tiles are explicitly out of scope."
    checklist:
      - "Did an edit to a workstream's frontmatter appear on the board within ~5s with no reload?"
      - "Did adding and deleting a workstream folder both propagate, with columns, counts, KPI figures and both lower panels updating together?"
      - "Did several ticks with nothing changed produce zero DOM mutations?"
      - "After ten forced refreshes, do the severity bar segments still sum to the bar's width, does the KPI strip hold exactly four cards, and does 'Needs attention' list each item once?"
      - "Did the search query, filtered set, result count, sort key, sort direction, active classes, input focus and caret all survive a refresh?"
      - "Did horizontal scroll position survive a refresh, and did two same-project tabs update while a different-project tab did not?"
      - "Do server.ts, extract.ts, projects.ts, praxis-data.d.ts, package.json, tsconfig.json, copy-assets.mjs, home.ts and index.html all have zero diff?"
    self_eval:
      passed: true
      override: "Marked done on the user's explicit instruction (2026-08-06) after reviewing the residual gaps below, rather than by clearing every checklist item through direct observation. The failures list is kept as an accurate record of what was and was not personally verified in a browser."
      failures:
        - item: "Did several ticks with nothing changed produce zero DOM mutations?"
          reason: "Not confirmed via the prescribed method (DevTools Elements panel / 'Highlight DOM updates'). Indirect evidence only: repeated screenshots taken between polls where nothing was edited were pixel-identical, and this project's own severity bar and KPI figures stayed exactly stable across roughly a dozen real poll ticks during this session."
          fix: "Needs manual confirmation with the Elements panel's mutation highlighting turned on, per the task's own instruction."
        - item: "After ten forced refreshes, do the severity bar segments still sum to the bar's width, does the KPI strip hold exactly four cards, and does 'Needs attention' list each item once?"
          reason: "The KPI strip (four cards) and 'Needs attention' (zero, correctly worded empty state) were confirmed correct across well over ten real refreshes in this session. The severity bar's specific 100%-sum claim is weakly tested here: this project (Praxis-Dashboard's own flowcharge/) has zero open issues, so the bar rendered empty the whole time — the percentage-math path task 1.2 fixed (segments summing to 200% when unclear) was never actually exercised against non-zero data in this session."
          fix: "Needs manual confirmation against a project with open issues of mixed severity, so the bar actually has segments to sum."
        - item: "Did the search query, filtered set, result count, sort key, sort direction, active classes, input focus and caret all survive a refresh?"
          reason: "Query text, the filtered set, the result count, and the active sort key/direction classes were all directly confirmed to survive a live poll refresh. Input focus and caret position specifically were not checked."
          fix: "Needs manual confirmation: click into the search input, position the caret mid-string, trigger a refresh, and confirm focus and caret position are undisturbed."
        - item: "Did horizontal scroll position survive a refresh, and did two same-project tabs update while a different-project tab did not?"
          reason: "Horizontal scroll survival WAS directly confirmed (board.scrollLeft set to 200, held at 200 across a live poll refresh that also changed the rendered title). The multi-tab half was not attempted."
          fix: "Needs manual confirmation: open two tabs on the same project and a third on a different project, edit the first project's flowcharge/, and confirm only the two same-project tabs update."
      note: "Also directly confirmed live: a workstream frontmatter edit (title) appeared on the board within ~5s with no reload, twice, in both directions; adding a whole new workstream folder and then deleting it both propagated within one poll cycle, with the KPI strip's workstream count and the Backlog column appearing and disappearing correctly; and a git diff --stat confirmed server.ts, extract.ts, projects.ts, praxis-data.d.ts, package.json, tsconfig.json, copy-assets.mjs, home.ts and index.html all have zero diff."
    ```

- [x] 3. Phase 3 — Visibility handling and the not-updating state

  ```yaml
  description: "One immediate poll tick when the tab becomes visible; a #live-status line in the masthead with exactly two states, set from the poll's success and failure paths; one CSS rule; and the footer sentence this feature makes false, corrected. Depends on Phase 2."
  ```

  - [x] 3.1 Poll once immediately when the tab becomes visible
    ```yaml
    description: "Add a visibilitychange listener at IIFE scope that runs one immediate pollOnce() when document.visibilityState becomes 'visible', so a backgrounded tab is current within about a second of being foregrounded rather than waiting for the next interval tick."
    issues: []
    implement:
      - "In src/public/app.ts, add `document.addEventListener('visibilitychange', ...)` at IIFE scope, next to the three control listeners moved there in task 1.3."
      - "In the handler: if `document.visibilityState === 'visible'`, call pollOnce() once. Do nothing on the hidden transition."
      - "Make no attempt to defeat the browser's throttling of hidden tabs. No Web Worker, no Worker-hosted timer, no audio-context keepalive — the plan's assumption 8 states that throttling is a feature, and this listener is the whole answer to it."
      - "Do not clear or restart the interval on visibility change. The interval started in task 2.2 keeps running; this listener only adds one extra tick."
      - "pollOnce's own in-flight guard already covers a visibility tick that coincides with an interval tick, so no additional guarding is needed here."
    pattern: "src/public/app.ts — one listener registration at IIFE scope."
    imports: "None."
    compatibility: "document.visibilityState and the visibilitychange event are in lib.dom, which src/public/tsconfig.json includes; no @types/node is available and none is needed."
    gotcha: "Register this listener unconditionally at IIFE scope, alongside the control listeners — NOT inside the initial fetch's success handler. It costs nothing on a board that never loaded, because pollOnce on such a board would be the first and only poll, and lastBody is null there. If that is judged a risk, gate the handler on the same condition that started the interval rather than moving the registration; do not duplicate the start logic."
    verify:
      - "npm run build — compiles clean."
      - "grep -n 'visibilitychange' src/public/app.ts — exactly one occurrence, at IIFE indentation."
      - "npm start, open a board, switch to another tab for 2+ minutes, then switch back: the DevTools Network panel shows a /data request within about a second of the tab becoming visible."
    checklist:
      - "Does the handler fire pollOnce only on the transition to 'visible'?"
      - "Is the interval left running rather than cleared and restarted?"
      - "Was no Worker, keepalive or other anti-throttling mechanism introduced?"
      - "Does the in-flight guard still prevent a doubled request when the visibility tick coincides with an interval tick?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.2 Add the `#live-status` span to the masthead
    ```yaml
    description: "Add <span id=\"live-status\"> to board.html's masthead .meta block, directly after the branch-line span, as the single line of text that lets the user tell 'nothing has changed' from 'nothing is updating'."
    issues: []
    implement:
      - "Apply this edit to src/public/board.html. It puts the span on its own line inside the existing .meta block, directly after the branch-line span, matching the <br> separator the block already uses:"
      - |
        src/public/board.html
        <<<<<<< SEARCH
          <div class="meta">
            Data generated <strong id="gen-date">—</strong><br>
            <span id="meta-counts"></span>
            <span id="branch-line" style="display:none"><br>Branch <strong id="branch-name"></strong></span>
          </div>
        =======
          <div class="meta">
            Data generated <strong id="gen-date">—</strong><br>
            <span id="meta-counts"></span>
            <span id="branch-line" style="display:none"><br>Branch <strong id="branch-name"></strong></span><br>
            <span id="live-status"></span>
          </div>
        >>>>>>> REPLACE
      - "Leave the span empty in the markup. It is populated only by task 3.4, from the poll's success and failure paths — so a board that never loaded, and therefore never polls, shows nothing there rather than a misleading state."
      - "Add nothing else to board.html in this task: no dot, no icon, no second element. The plan settled on option (a), one line of text, and says option (b) is easy to add later if (a) proves too quiet."
    pattern: "src/public/board.html — the .meta block at board.html:20-23."
    imports: "None."
    compatibility: "index.html has no masthead .meta block and never loads app.js, so this markup is board-only. tools/copy-assets.mjs copies board.html to dist/public unchanged — no build change is needed."
    gotcha: "The gen-date strong element contains a literal em dash (—), not a hyphen or an HTML entity. Copy the SEARCH text exactly as the file has it."
    verify:
      - "npm run build — copy-assets completes."
      - "grep -n 'live-status' src/public/board.html dist/public/board.html — one occurrence in each."
      - "npm start, open a board, and inspect the masthead: the span exists in the DOM, empty, on its own line below the workstream/issue counts."
    checklist:
      - "Is the span inside the .meta block, after the branch-line span?"
      - "Is it empty in the markup, with no default text?"
      - "Was nothing else added to board.html in this task?"
      - "Does dist/public/board.html carry the span after a build?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.3 Add the `#live-status` CSS rule
    ```yaml
    description: "One rule for #live-status in styles.css following the existing .masthead .meta treatment (mono, 11.5px, --ink-faint), plus a distinct colour for the not-updating state."
    issues: []
    implement:
      - "Apply this edit to src/public/styles.css, placing the rule directly after the existing .masthead .meta rules and before the KPI strip section:"
      - |
        src/public/styles.css
        <<<<<<< SEARCH
        .masthead .meta strong { color: var(--ink); font-weight: 600; }

        /* ---------- KPI strip ---------- */
        =======
        .masthead .meta strong { color: var(--ink); font-weight: 600; }
        .masthead .meta #live-status { color: var(--ink-faint); }
        .masthead .meta #live-status.is-stale { color: var(--sev-high); }

        /* ---------- KPI strip ---------- */
        >>>>>>> REPLACE
      - "The mono family and 11.5px size are already inherited from .masthead .meta (styles.css:157-163) — do not restate them. The rule adds only what the .meta treatment does not already give: the faint colour for the live state and a distinct colour for the not-updating state."
      - "--sev-high is defined in both the light palette and the dark @media block, so the not-updating state reads correctly in either theme with no second declaration."
      - "Add no animation, no dot, no pill, no border. One line of text in two colours is the whole indicator."
    pattern: "src/public/styles.css — immediately after the .masthead .meta rules at styles.css:157-164."
    imports: "None."
    compatibility: "The file's masthead section uses compact single-line rules for small declarations (see .masthead .meta strong); match that form. The class name is-stale must be exactly what task 3.4 toggles."
    gotcha: "styles.css defines the palette three times — :root, the prefers-color-scheme dark @media block, and a :root[data-theme=\"dark\"] block. Using var(--sev-high) rather than a literal colour is what keeps this rule correct in all three without touching any of them."
    verify:
      - "npm run build — copy-assets completes and dist/public/styles.css contains the rule."
      - "grep -n 'live-status' src/public/styles.css — two occurrences, the base rule and the is-stale modifier."
      - "npm start, open a board, and with the span temporarily given text in DevTools, confirm it renders mono at 11.5px in the faint ink colour, and switches to the distinct colour when .is-stale is added."
    checklist:
      - "Does the rule sit with the other .masthead .meta rules?"
      - "Does it rely on inheritance for the mono family and 11.5px rather than restating them?"
      - "Does the not-updating state use a CSS variable rather than a literal colour, so both themes work?"
      - "Was no animation, dot, pill or border added?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.4 Set the two `#live-status` states from the poll's success and failure paths
    ```yaml
    description: "Fill in the 'mark live' and 'mark not-updating' steps left structural in task 2.1. Exactly two states: live with the time of the last successful poll, and not updating."
    issues: []
    implement:
      - "In src/public/app.ts, add a single small helper at IIFE scope that sets #live-status. Exactly two states, no third:"
      - "Live — textContent shows that the board is live plus the time of the last successful poll (a locale time string from `new Date()` is enough), and the is-stale class is removed."
      - "Not updating — textContent says the board is not updating, and the is-stale class is added. The plan's wording for this state is 'not updating'; keep it that plain."
      - "Call the live state from pollOnce's success path — BOTH the unchanged-body branch and the changed-body branch, per the pseudocode's two 'mark live' steps. An unchanged poll is a successful poll, and refreshing the timestamp on it is the entire reason the indicator exists: it is what distinguishes 'this project is quiet' from 'this board died twenty minutes ago'."
      - "Call the not-updating state from pollOnce's failure path — the non-ok response and the thrown-error cases both, which task 2.1 funnels into a single catch."
      - "Also call the live state once from the initial fetch's success handler in task 2.2, where the interval is started, so the line is populated immediately rather than blank for the first five seconds. Do not call it anywhere else, and never from the initial fetch's catch — a board that failed to load shows the load-state panel and must not also claim a status."
      - "The status assignment is a textContent write plus a classList toggle on an element the renderers never touch, so it stays outside applyData and does not affect its idempotency."
      - "Recovery needs no code: the interval keeps ticking through failures, so the first poll that succeeds after the server comes back sets the live state again on its own."
    pattern: "src/public/app.ts — a helper at IIFE scope, called from pollOnce's success and failure paths and from the initial fetch's success handler."
    imports: "None."
    compatibility: "#live-status must exist in board.html before this runs — task 3.2 adds it, so 3.2 lands first. The class name toggled here must be exactly the is-stale used by task 3.3's CSS rule."
    gotcha: "Do not use innerHTML for the status text; textContent only. And do not skip the live call on the unchanged-body branch — that branch is by far the most common outcome, and omitting it leaves the timestamp frozen at the last real change, which is precisely the ambiguity this indicator exists to remove."
    verify:
      - "npm run build — compiles clean."
      - "grep -n 'live-status' src/public/app.ts — the element is looked up in exactly one place."
      - "npm start, open a board, and watch the status line: it shows the live state with a timestamp that advances roughly every 5 seconds while nothing in flowcharge/ changes."
      - "Stop the server: within ~5s the line flips to the not-updating state and takes the distinct colour, with the board's last render still fully intact."
      - "Restart the server: the line returns to live on its own, with no reload."
    checklist:
      - "Are there exactly two states, with no third and no silent state?"
      - "Is the live state set on BOTH the unchanged-body and changed-body success branches?"
      - "Is the not-updating state set for both a non-ok response and a thrown error?"
      - "Is the status never set from the initial fetch's catch path?"
      - "Is the toggled class name identical to the one task 3.3's CSS targets?"
      - "Does recovery happen without any explicit reconnect code?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.5 Correct the footer sentence this feature makes false
    ```yaml
    description: "board.html's footer currently claims the board reads the project's state 'on every page load — so a reload always shows the project's current state'. Polling makes that sentence false. It is the one piece of prose the change strictly obliges."
    issues: []
    implement:
      - "Apply this edit to src/public/board.html:"
      - |
        src/public/board.html
        <<<<<<< SEARCH
          Reads the selected project's <code>flowcharge/</code> frontmatter live through the dashboard server, on every page
          load — so a reload always shows the project's current state, with nothing to regenerate first.
        =======
          Reads the selected project's <code>flowcharge/</code> frontmatter live through the dashboard server, on load and
          then every few seconds — so an open board keeps showing the project's current state without a reload, with
          nothing to regenerate first.
        >>>>>>> REPLACE
      - "Leave the following sentence — the one about 'Needs attention' recomputing elapsed days — exactly as it is. It is still true and is not this plan's business."
      - "Do not name the interval in seconds in the prose. The interval is one constant in app.ts, and a number written into the footer is a second place that must be kept in agreement with it for no benefit."
      - "Change no other prose anywhere in the repo. This sentence is corrected because it is made false; nothing else in board.html, index.html or any README is in scope."
    pattern: "src/public/board.html — the footer at board.html:68-72."
    imports: "None."
    compatibility: "The footer uses a literal em dash and typographic quotes; the SEARCH text above is copied from the file and preserves them."
    gotcha: "The 'Needs attention' sentence in the same footer block contains curly quotes (“”). It is outside the SEARCH range and must not be touched."
    verify:
      - "npm run build — copy-assets completes."
      - "grep -n 'on every page' src/public/board.html — returns nothing."
      - "grep -n 'Needs attention. recomputes' src/public/board.html — still present, unchanged."
      - "npm start, open a board, read the footer: it describes the board as staying current on an open page rather than only on reload, and names no interval."
    checklist:
      - "Is the false 'on every page load — so a reload always shows' claim gone?"
      - "Is the 'Needs attention' sentence unchanged?"
      - "Does the new sentence avoid naming a specific number of seconds?"
      - "Was no other prose in the repo changed?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.6 Verify Phase 3, and the plan's exclusions across the whole change
    ```yaml
    description: "Run the plan's Phase 3 verification sequence — backgrounding and foregrounding a tab, stopping and restarting the server, and removing and restoring a project's flowcharge/ — then confirm every file the plan says has no diff genuinely has none."
    issues: []
    implement:
      - "Make no code change in this task. If a check fails, fix it in the task that owns the code and re-run this one."
      - "Step 1 (criterion 11): with a board open, background the tab for 2+ minutes, then foreground it. The board is current within about a second of becoming visible, and the status line's timestamp is fresh — it did not wait for the next interval tick."
      - "Step 2 (criterion 12): stop the server. Within ~5s the status flips to not-updating. The board still shows its last render in full: no blanking, no uncaught exception in the console, and no load-state panel replacing the board."
      - "Step 3 (criterion 13): restart the server. The status returns to live on its own and updates resume, with no reload."
      - "Step 4 (criterion 12, the 410 path): rename the project's flowcharge/ folder away while the board is open. Same behaviour as step 2 — last good render retained, status flipped, no console exception. Rename it back and confirm recovery."
      - "Then confirm the plan's exclusions across the whole three-phase change, using the git checks in verify below."
    pattern: "No source files. Verification only, against the repo as left by tasks 3.1-3.5."
    imports: "A running `npm start` server, a browser with DevTools, and write access to a registered project's flowcharge/ folder."
    compatibility: "Steps 2 and 3 require actually stopping and restarting the server process, and step 4 requires renaming a real flowcharge/ folder — there is no test framework here to stand in for either."
    gotcha: "In step 2, check the DevTools console for uncaught exceptions specifically, not just for a visually intact board: a failed fetch that escapes the catch would still leave the last render on screen while breaking the interval, and the symptom is only that nothing ever updates again. In step 4, remember to rename the folder back before finishing."
    verify:
      - "npm start, then run steps 1 through 4 above in order and record the outcome of each."
      - "git diff --stat src/server.ts src/lib/extract.ts src/lib/projects.ts src/types/praxis-data.d.ts package.json tsconfig.json tools/copy-assets.mjs — returns nothing (criteria 15, 16)."
      - "git diff --stat src/public/home.ts src/public/index.html — returns nothing; home-page tile refresh is out of scope."
      - "git diff --stat — the only changed files across all three phases are src/public/app.ts, src/public/board.html and src/public/styles.css."
      - "grep -nE '^(import|export)' dist/public/app.js — returns nothing (criterion 17)."
      - "grep -rn 'POLL_MS' src/ — exactly one definition, and no settings file, query parameter or localStorage key anywhere that could change it."
    checklist:
      - "Did a foregrounded tab become current within about a second, without waiting for the interval?"
      - "With the server stopped, did the board keep its last render, flip the status, and log no uncaught exception?"
      - "Did the board recover on its own when the server came back, with no reload?"
      - "Did the renamed-flowcharge/ case behave identically to the stopped-server case, and recover when renamed back?"
      - "Is the whole change confined to src/public/app.ts, src/public/board.html and src/public/styles.css?"
      - "Are dependencies, devDependencies and engines.node unchanged, and is dist/public/app.js still a classic script?"
      - "Is the poll interval a single constant with no configuration mechanism of any kind?"
    self_eval:
      passed: true
      override: "Marked done on the user's explicit instruction (2026-08-06) after reviewing the residual gaps below, rather than by clearing every checklist item through direct observation. The failures list is kept as an accurate record of what was and was not personally verified in a browser."
      failures:
        - item: "Did a foregrounded tab become current within about a second, without waiting for the interval?"
          reason: "Not attempted — this browser tool has no reliable primitive to background/foreground a tab and trigger a real visibilitychange event. Covered structurally instead: the listener added in 3.1 fires pollOnce() only on the transition to 'visible' and shares pollOnce's own in-flight guard, so it cannot double-fire against a coincident interval tick."
          fix: "Needs manual confirmation: with a board open, switch to another browser tab for 2+ minutes, then switch back, and watch the Network panel for a /data request within about a second."
        - item: "Did the renamed-flowcharge/ case behave identically to the stopped-server case, and recover when renamed back?"
          reason: "Attempted directly: flowcharge/ was renamed away and the browser tool's navigate call was immediately blocked by this session's auto-mode classifier. The folder was restored within the same turn and confirmed intact via git status and a file-existence check — no lasting effect. The stopped-server case (below) is a close proxy: the same catch path handles both a thrown fetch and any non-ok response, including the 410 this scenario would produce."
          fix: "Needs manual confirmation: rename a registered project's flowcharge/ folder away while its board is open, confirm the not-updating state and an intact last render, then rename it back and confirm recovery."
        - item: "Whole-change file scope: git diff --stat confines the diff to src/public/app.ts, src/public/board.html and src/public/styles.css; dependencies, devDependencies and engines.node are unchanged; dist/public/app.js has no import/export; POLL_MS has exactly one definition with no configuration mechanism"
          reason: "Confirmed directly, not inferred: git diff --stat shows only src/public/app.ts, src/public/board.html and src/public/styles.css changed across all three phases; git diff --stat against package.json, tsconfig.json, src/server.ts, src/lib/extract.ts, src/lib/projects.ts, src/types/praxis-data.d.ts, tools/copy-assets.mjs, src/public/home.ts and src/public/index.html returns nothing; grep -nE '^(import|export)' dist/public/app.js returns nothing; grep -rn 'POLL_MS' src/ shows exactly the one declaration and its one use site."
          fix: "No fix needed — this half of the checklist is satisfied and verified by file inspection; only the browser-dependent halves above are outstanding."
      note: "The remaining two checklist items ARE directly confirmed live in a real browser: with the dev server killed, the status line flipped to 'Not updating' in its distinct colour within one poll interval, the board's last render stayed fully intact with no blanking, and the only console entries were the browser's own failed-fetch network logs, not an uncaught app exception; after restarting the server, the status returned to 'Live' and the timestamp resumed advancing on its own, with no reload and no explicit reconnect code."
    ```

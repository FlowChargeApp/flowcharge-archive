---
id: TL-22-2l1fwv
type: tasklist
workstream: WS-21-m6g1do
slug: plan-artefact-not-readable
title: "Make a workstream's plan readable in a Plan tab and from the card's PLN row"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: [PLN-17-987y5h]
links: []
mode: spec
base_commit: 7357cba
---

# PRX Tasks

## Make a workstream's plan readable in a Plan tab and from the card's PLN row

`plan.md` is the only Praxis artefact type the dashboard names but cannot open. The detail
modal has no Plan tab, and the board card draws a `PLN` row that leads nowhere. WS-20 made that
row sort first on every card that holds a plan, so a dead row now leads most cards.

PLN-17 adds a third tab to the detail modal, renders the plan body with a small DOM-built
Markdown subset renderer, and makes the card's `PLN` row open the modal on that tab. The server
reads the plan file, strips its frontmatter with the anchored regex `parseFrontmatter()` already
uses, and puts the raw body string in the detail payload. It parses nothing else. The browser
owns all rendering, and every element is emitted through the existing `el(tag, cls, text)`
helper, so `textContent` stays the only path from file content to the DOM.

These tasks mirror the plan's own four phases, in the plan's order, one child task per file:

1. Phase 1 — the server read (`praxis-data.d.ts`, `extract.ts`, `detail.ts`).
2. Phase 2 — the third tab, with a temporary `<pre>` body as deliberate scaffolding
   (`board.html`, `app.ts`).
3. Phase 3 — the block renderer, which deletes that `<pre>` (`app.ts`, `styles.css`).
4. Phase 4 — the card deep link (`app.ts`).

Each phase leaves the app working and is revertible on its own. Absolute constraints carried from
the plan: zero runtime dependencies, so no Markdown library; no `innerHTML` content write, since
every `innerHTML` assignment in `src/` today is `= ''`, a container clear; and no `import` or
`export` in `src/public/app.ts` or `src/types/praxis-data.d.ts`.

**A note on verify commands.** This repository has no lint script and no test framework.
`package.json` defines only `build`, `prestart`, `start`, `prerefresh` and `refresh`, so
`npm run lint` fails with "Missing script: lint", and a bare `npx tsc --noEmit` resolves neither
tsconfig. Every task below therefore substitutes the working equivalents the plan's Testing
strategy names: `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p src/public/tsconfig.json`
and `npm run build`.

**Read-only over LAD.** The LAD replay named in the Phase 1 and Phase 3 verify lists opens files
for reading only. It must never write into
`/Users/akoukoullis/Work/AK/AgenticCodingTests/LAD`. The script lives in the session scratchpad
and is never committed. The untracked `bun.lock` at this repository's root must not be touched.

- [x] 1. Phase 1 — Server reads the plan

  ```yaml
  description: "Admit `type: plan` in the detail walk, strip the frontmatter with the anchored regex, and carry the raw body on a new `plans` array field of the detail payload. Depends on nothing."
  ```

  - [x] 1.1 Add `PraxisPlanDetail` and the `plans` field to the ambient type declarations
    ```yaml
    description: "Declare the plan-detail interface and add the `plans` collection to PraxisWorkstreamDetail, keeping the file a non-module."
    issues: []
    implement:
      - "Apply this block to src/types/praxis-data.d.ts. It adds the new interface beside its two sibling collections and adds the field to PraxisWorkstreamDetail in one contiguous region. `plans` is placed before `issueLists` to match ARTEFACT_TYPE_RANK's plan → issues → tasks order in src/lib/extract.ts:79 and the tab order in assumption A2."
      - |
        src/types/praxis-data.d.ts
        <<<<<<< SEARCH
        interface PraxisIssueListDetail { artefact: PraxisDetailArtefact; items: PraxisIssueDetail[]; }
        interface PraxisTaskListDetail  { artefact: PraxisDetailArtefact; tasks: PraxisTaskDetail[]; }

        interface PraxisWorkstreamDetail {
          id: string;
          slug: string;
          title: string;
          status: string;
          archived: boolean;
          issueLists: PraxisIssueListDetail[];
          taskLists: PraxisTaskListDetail[];
        }
        =======
        // `body` is the plan file's text with its frontmatter block removed. It is raw
        // markdown, and nothing on the Node side reads it — the browser owns rendering.
        // An ARRAY, not a nullable single object: the detail walk loops on frontmatter
        // `type`, not on filename, so a second file declaring `type: plan` would
        // otherwise be left at readdir's mercy. The array also makes this the third
        // collection of the same shape as the two below.
        interface PraxisPlanDetail      { artefact: PraxisDetailArtefact; body: string; }
        interface PraxisIssueListDetail { artefact: PraxisDetailArtefact; items: PraxisIssueDetail[]; }
        interface PraxisTaskListDetail  { artefact: PraxisDetailArtefact; tasks: PraxisTaskDetail[]; }

        interface PraxisWorkstreamDetail {
          id: string;
          slug: string;
          title: string;
          status: string;
          archived: boolean;
          plans: PraxisPlanDetail[];
          issueLists: PraxisIssueListDetail[];
          taskLists: PraxisTaskListDetail[];
        }
        >>>>>>> REPLACE
    pattern: "src/types/praxis-data.d.ts only. No other file changes in this task."
    imports: "None, and none may be added. The file's own header comment records that a top-level import or export would turn it into a module and the interfaces would stop being global. It is included by both tsconfig.json and src/public/tsconfig.json."
    compatibility: "Contract 1 of PLN-17. `PraxisDetailArtefact` already exists at line 65 and is reused unchanged. Both compilations must still see these interfaces as globals."
    gotcha: "Adding `export` before either interface, or any `import` line, silently breaks the browser compilation as well as the Node one. Type-only additions emit no JavaScript, so `npm run build` alone is not proof the field is populated — that is task 1.3's job."
    verify:
      - "npx tsc --noEmit -p tsconfig.json"
      - "npx tsc --noEmit -p src/public/tsconfig.json"
      - "grep -cE '^\\s*(import|export)\\b' src/types/praxis-data.d.ts returns 0"
    checklist:
      - "Does `PraxisPlanDetail` declare exactly `artefact: PraxisDetailArtefact` and `body: string`, and nothing else?"
      - "Is `plans` typed `PraxisPlanDetail[]`, an array rather than a nullable single object?"
      - "Does the file still contain zero top-level `import` and zero `export` keywords?"
      - "Do both tsconfig compilations still resolve every one of these interfaces as a global?"
      - "Is every other interface in the file byte-identical to before?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Hoist `FRONTMATTER` and export `stripFrontmatter()` from the extraction library
    ```yaml
    description: "Give one definition of 'frontmatter' to both the parser and a new stripper, using the anchored regex and a slice from its match end."
    issues: []
    implement:
      - "In src/lib/extract.ts, hoist the inline literal in `parseFrontmatter()` (currently `text.match(/^---\\n([\\s\\S]*?)\\n---/)` on line 9) into a module-level constant named FRONTMATTER, declared immediately above `parseFrontmatter`. Change `parseFrontmatter` only to use the constant — its behaviour must stay identical."
      - "Add a named export `stripFrontmatter(text: string): string` directly beside `parseFrontmatter`. It matches FRONTMATTER, and on a match returns `text.slice(m[0].length)` with any leading newlines removed; with no match it returns the text unchanged, never an empty string. Roughly four lines, per Contract 2 of PLN-17."
      - "Comment the two load-bearing facts at the constant: the regex carries no `g` flag, so `match` is not stateful and the shared constant cannot develop a `lastIndex` bug between its two callers; and the anchor plus the slice-from-match-end is the whole defence against a `split('---')` corrupting the 19 corpus plan files that hold body lines starting `---`."
      - "Change nothing else in this file. In particular leave `walkWorkstreams()`'s own `split('---')` body extraction at lines 92-93 exactly as it is — PLN-17 records it as out of scope, since it feeds the card's body preview."
    pattern: "src/lib/extract.ts only. The regex currently appears once, inline at line 9."
    imports: "None added. The file already imports only node:fs and node:path. `stripFrontmatter` is a pure string function with no filesystem access."
    compatibility: "Contract 2 of PLN-17. The stripper lives beside the parser so one definition of frontmatter serves both. src/lib/detail.ts already imports parseFrontmatter, artefactIdNumber, ISSUE_ITEM and TASK_ITEM from here, so one more named export follows the existing seam. src/lib/ is ordinary ESM with .js extensions on relative imports, and this file is Node-side only — it is not part of the src/public compilation."
    gotcha: "Adding a `g` flag to the hoisted constant would make `lastIndex` shared mutable state across the two callers and produce intermittent misses — the regex must stay flagless. A `split('---')` implementation would corrupt the 19 plan files holding body `---` lines and up to 31 such lines in one LAD file. A file with no frontmatter at all must return unchanged, not empty."
    verify:
      - "npx tsc --noEmit -p tsconfig.json"
      - "npm run build"
      - "grep -n 'split(.---.)' src/lib/extract.ts returns only the pre-existing lines 92-93 in walkWorkstreams, and nothing inside stripFrontmatter"
      - "grep -c '\\^---.n' src/lib/extract.ts shows the frontmatter pattern is written once, not twice"
    checklist:
      - "Is the frontmatter regex now written exactly once in the file, as a module constant?"
      - "Does `parseFrontmatter()` produce identical output to before for a file with frontmatter, a file without, and a file whose frontmatter is malformed?"
      - "Does `stripFrontmatter()` return the input unchanged when the text has no frontmatter block?"
      - "Does the constant carry no `g` flag?"
      - "Is `walkWorkstreams()`'s existing `split('---')` at lines 92-93 untouched?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.3 Admit `plan` in the detail walk and return the sorted `plans` array
    ```yaml
    description: "Collect every `type: plan` file in the workstream folder, strip its frontmatter, sort by artefact id number, and add the array to the returned detail payload."
    issues: []
    implement:
      - "In src/lib/detail.ts, import `stripFrontmatter` from './extract.js', adding it to the existing named-import list on line 9 alongside ISSUE_ITEM, TASK_ITEM, artefactIdNumber and parseFrontmatter."
      - "Declare `const plans: PraxisPlanDetail[] = [];` beside the existing `issueLists` and `taskLists` declarations in `extractWorkstreamDetail()`."
      - "Widen the type filter — currently `if (type !== 'issuelist' && type !== 'tasklist') continue;` at line 229 — so a `plan` type is also admitted. The `artefact` object built immediately below is reused unchanged for all three types."
      - "In the branch that dispatches on `type`, push `{ artefact, body: stripFrontmatter(text) }` into `plans` when the type is `plan`, keeping the issuelist and tasklist branches exactly as they are."
      - "Sort `plans` with the same `artefactIdNumber` comparator already applied to `issueLists` and `taskLists`, on the line above them, and add `plans` to the returned object before `issueLists`."
      - "Add nothing that parses, counts or inspects the body. Per the plan's 'What each piece must not know', this file must not know that a renderer exists."
    pattern: "src/lib/detail.ts only. src/server.ts and src/scripts/extract-praxis-data.ts need NO change — the detail route passes its result straight to sendJson, and the extractor script never calls extractWorkstreamDetail()."
    imports: "One added named import, `stripFrontmatter` from './extract.js' (the .js extension is required by this repository's ESM setup). `PraxisPlanDetail` is ambient and must NOT be imported."
    compatibility: "Contract 1 and Contract 2 of PLN-17. `plans` is an added field on the detail response only; the board payload from /api/projects/<id>/data is unchanged, so the KPI strip, severity panel, attention panel and card rendering cannot regress. An old browser tab against a new server ignores the field and keeps working with two tabs."
    gotcha: "The walk already sorts readdir output, but display order must still come from artefactIdNumber, not filename. A file whose frontmatter is malformed yields an empty `type` and is skipped, so its plan vanishes from both surfaces — this is trap 4 in PLN-17, matches today's behaviour for issue and task lists, and is deliberately kept. `plans` must be `[]` for the 5-of-21 local and 141-of-175 LAD workstreams that hold no plan, never undefined."
    verify:
      - "npx tsc --noEmit -p tsconfig.json"
      - "npx tsc --noEmit -p src/public/tsconfig.json"
      - "npm run build, then npm start, then curl -s 'http://localhost:4173/api/projects/3c975ac5/workstreams/WS-5/detail' | head -c 400 — the response holds a `plans` array whose one entry's `body` starts at the plan's H1, not at `---`"
      - "curl the same route for WS-21 and confirm it returns \"plans\":[]"
      - "Run the read-only LAD replay: a throwaway Node script in the session scratchpad, never committed and never writing to LAD, that imports dist/lib/detail.js and calls extractWorkstreamDetail('/Users/akoukoullis/Work/AK/AgenticCodingTests/LAD', id) for every WS-N in LAD, asserting: no call throws; exactly 34 workstreams return a non-empty plans array and none returns more than one entry; no body's first non-blank line is `---`; every body is non-empty; and the count of body lines equal to `---` matches the count found by grep on the source file"
      - "Reload the board in the browser and confirm it still renders — the browser ignores the new field"
    checklist:
      - "Does a workstream with no plan file return `plans: []` rather than undefined or an error?"
      - "Does the LAD replay's last assertion pass, proving the strip removed the frontmatter delimiters and nothing else?"
      - "Is `plans` ordered by `artefactIdNumber`, using the same comparator as the two existing collections?"
      - "Does this file still contain no code that reads, counts or parses a plan body?"
      - "Are src/server.ts and src/scripts/extract-praxis-data.ts unmodified?"
      - "Did the replay open LAD files for reading only, writing nothing into that tree?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — A third tab that shows the plan verbatim

  ```yaml
  description: "Add the Plan tab and panel, replace the two-tab boolean machinery with the list-driven TABS version, and render each plan body into a temporary `<pre>`. Depends on Phase 1. The `<pre>` is deliberate scaffolding that Phase 3 deletes — it keeps this phase's acceptance check purely about the tab machinery, the deferral and the empty state."
  ```

  - [x] 2.1 Add the `Plan` tab button and the `ws-panel-plan` div to the board markup
    ```yaml
    description: "Ship the third tab and its panel in the markup, first in the tablist, with the initial ARIA state that keeps Issues selected."
    issues: []
    implement:
      - "In src/public/board.html, add a third tab button to the `.ws-modal-tabs` tablist (currently two buttons, at lines 104-105). Place it FIRST, before the Issues button, per assumption A2 of PLN-17: this matches ARTEFACT_TYPE_RANK's documented plan → issues → tasks chain and the card's own artefact row order."
      - "Mirror the shape of the two existing buttons exactly: `type=\"button\"`, `role=\"tab\"`, `id=\"ws-tab-plan\"`, `data-tab=\"plan\"`, `aria-controls=\"ws-panel-plan\"`, `aria-selected=\"false\"` and `tabindex=\"-1\"`."
      - "The button's text is exactly `Plan`, with no parenthesis and no count (trap 8, and acceptance criterion 2). The markup ships this label and nothing ever rewrites it, so `setTabLabels()` needs no change and gains no argument."
      - "Leave the Issues button's `aria-selected=\"true\"` and `tabindex=\"0\"` as they are. The first tab is deliberately not the selected tab; Issues stays the default (acceptance criterion 3)."
      - "Add a matching `<div role=\"tabpanel\" id=\"ws-panel-plan\" aria-labelledby=\"ws-tab-plan\" hidden></div>` inside `.ws-modal-body` (lines 108-111), first, before the issues panel, matching the two existing panels' shape. The `hidden` attribute is required — it is the only thing keeping the panel invisible."
    pattern: "src/public/board.html only, in the `<dialog id=\"ws-modal\">` block."
    imports: "None. board.html loads only styles.css and app.js, both already linked."
    compatibility: "Contract 3 of PLN-17, and acceptance criteria 1, 2 and 3. The existing delegated click handler in app.ts already reads `btn.dataset.tab`, so it needs no change to see the new button."
    gotcha: "Omitting `hidden` on the new panel makes it visible on load beside the Issues panel, because the panels rely entirely on the `hidden` attribute and the user-agent `display: none` that comes with it — styles.css carries no `[hidden]` rule. Omitting `data-tab=\"plan\"` makes the button silently unclickable, since the delegated handler returns early without it. Putting `aria-selected=\"true\"` on the new button would give the modal two selected tabs on first open."
    verify:
      - "npm run build, then open a workstream card's modal in the browser"
      - "Three tabs show, reading Plan | Issues | Tasks, with Issues selected and the Plan label carrying no count"
      - "In devtools, exactly one tab has aria-selected=\"true\" and tabIndex 0, and exactly two panels carry the hidden attribute"
      - "grep -c 'role=\"tab\"' src/public/board.html returns 3, and grep -c 'role=\"tabpanel\"' returns 3"
    checklist:
      - "Is the Plan button first in the tablist, with Issues still the selected tab?"
      - "Is the Plan button's label exactly `Plan`, with no count and no parenthesis?"
      - "Does the new panel div carry the `hidden` attribute in the shipped markup?"
      - "Does every tab button carry `data-tab`, `aria-controls`, `aria-selected` and `tabindex`?"
      - "Does each panel's `aria-labelledby` point at its own tab's id?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "The browser walkthrough steps were left to the orchestrator, which runs them directly after this execution."
    ```
  - [x] 2.2 Replace the two-tab machinery with the list-driven version and add the deferred plan panel
    ```yaml
    description: "Make selectTab and the keydown handler list-driven, add the deferred-build state, and write renderPlanPanel with its empty state and a temporary `<pre>` body."
    issues: []
    implement:
      - "In src/public/app.ts, inside the existing IIFE, replace the `tabIssues`/`tabTasks`/`panelIssues`/`panelTasks` element lookups and the boolean `selectTab()` (currently lines 220-237) with the TABS list from Contract 3 of PLN-17: an array of three `{ name, btn, panel }` entries in the order plan, issues, tasks, plus `var currentTab = 'issues';`. Keep whatever `panelIssues` and `panelTasks` bindings the existing renderers still need, or reach them through TABS — either is acceptable, but the three tabs must be declared exactly once."
      - "Rewrite `selectTab(name, focusTab)` to find the entry's index, fall back to index 0 for an unknown name, then set `aria-selected`, `tabIndex` and `panel.hidden` inside ONE loop body, and update `currentTab`. Putting all three in one loop is the point: the invariant that they always move together becomes structural instead of a comment over three paired assignments (trap 7). Record in a comment that the index-0 fallback now lands on Plan rather than Issues, and that no caller passes an unknown name, so no reachable behaviour changes."
      - "Rewrite the tablist keydown handler (currently lines 527-539) to read `currentTab`, find its index, and move modulo `TABS.length` for ArrowLeft and ArrowRight. `Home` selects `TABS[0]` and `End` selects `TABS[TABS.length - 1]`. No literal tab name may survive in it."
      - "Leave the tablist CLICK handler alone — it already reads `btn.dataset.tab`. Leave `setTabLabels(issueCount, taskCount)` alone — it gains no argument, because the Plan label ships in board.html and nothing rewrites it."
      - "Add the deferred-build state and hook from Contract 5: `var planData: PraxisPlanDetail[] | null = null;` where null means the detail has not been fetched yet, `var planBuilt = false;`, and `function maybeBuildPlan()` which returns early when `planBuilt` is true, `planData` is null, or `currentTab !== 'plan'`, and otherwise sets `planBuilt = true` and calls `renderPlanPanel(planData)`."
      - "Wire the three call sites: `openModal()` resets `planData` to null and `planBuilt` to false and shows the `Loading…` message in the plan panel the same way it already does for the issues and tasks panels; `renderDetail()` sets `planData = detail.plans || []` and then calls `maybeBuildPlan()`; and `selectTab()` calls `maybeBuildPlan()` after it has switched. Both the renderDetail and selectTab call sites are needed, and their order is not fixed — a deep link selects the tab before the fetch resolves, a plain open resolves the fetch before the tab is ever selected. Either way the panel builds exactly once per modal open. Also add the plan panel to the fetch `.catch` block that already surfaces the error message in the other two panels."
      - "Write `renderPlanPanel(plans: PraxisPlanDetail[])` copying `renderIssuesPanel()`'s structure literally: clear the panel with `innerHTML = ''`, show a plain empty-state message through the existing `setPanelMessage()` when `plans.length` is zero, otherwise emit one `buildSection(item.artefact)` per file with the body appended. Word the empty state in the pattern the Issues and Tasks panels already use — it is the majority case, not an error (trap 1, acceptance criterion 7)."
      - "For THIS PHASE ONLY, render each body into a temporary `<pre>` — `sec.appendChild(el('pre', 'ws-raw', item.body))`, about two lines. This is deliberate scaffolding, not the shipping renderer, and task 3.1 deletes it."
      - "Do not use `lazyBody()` here, and do not reach `buildItem()`, `buildTaskGroup()`, `renderValue()` or `renderMap()` from this path — all four take a YAML field set and a plan has none."
    pattern: "src/public/app.ts only, all of it inside the existing IIFE. Touch no board rendering, no KPI strip, no severity panel and no attention panel (acceptance criterion 14)."
    imports: "None, and none may be added. src/public/tsconfig.json sets module: \"none\", so any import or export in this file is a compile error rather than a broken page. PraxisPlanDetail is ambient from src/types/praxis-data.d.ts, which that tsconfig already includes. Reuse the existing el(), byId(), setPanelMessage() and buildSection() helpers."
    compatibility: "Contracts 3 and 5 of PLN-17, and acceptance criteria 3, 6, 7, 11, 12 and 13. `.ws-modal-body` already sets overflow: auto and `.ws-modal-inner` caps the height, so a 1570-line plan needs no new scroll container."
    gotcha: "Leaving a literal 'issues' or 'tasks' in the keydown handler reintroduces the hardcoding this rewrite exists to remove. Forgetting to reset planBuilt in openModal makes the second card opened in a session show the first card's plan. Forgetting the maybeBuildPlan call in selectTab leaves the deep-link path with an empty panel; forgetting the one in renderDetail leaves the plain-open path never building. Every text node must still come from el()'s textContent — the only innerHTML use permitted here is the `= ''` container clear."
    verify:
      - "npx tsc --noEmit -p src/public/tsconfig.json"
      - "npx tsc --noEmit -p tsconfig.json"
      - "npm run build, then open WS-5: three tabs show, Issues is selected, the Plan label carries no count; click Plan and the plan text appears"
      - "Open WS-21: the Plan tab shows the empty-state message, not an error"
      - "With the modal open and a tab focused: ArrowRight steps forward and wraps from Tasks to Plan; ArrowLeft steps back and wraps; Home selects Plan; End selects Tasks"
      - "In devtools, at every step of that walkthrough, exactly one tab has aria-selected=\"true\" and tabIndex 0, and exactly two panels carry hidden"
      - "Open a workstream that has a plan, close it without touching Plan, and confirm #ws-panel-plan holds only the Loading… message — the body was never built"
      - "Reopen the same card and confirm the Plan tab is not inherited: it opens on Issues"
      - "grep -n \"innerHTML\" src/public/app.ts shows every assignment is still = '' and never a content write"
    checklist:
      - "Are the three tabs declared exactly once, in one TABS array?"
      - "Does one loop body set aria-selected, tabIndex and panel.hidden together, with no paired assignments left?"
      - "Does the keydown handler contain no literal tab name, and does it wrap modulo TABS.length?"
      - "Is the plan panel built exactly once per modal open, on both the deep-link and the plain-open orderings?"
      - "Does a workstream with no plan show a plain message rather than an error?"
      - "Does src/public/app.ts still contain zero import and zero export statements?"
      - "Are setTabLabels() and the tablist click handler unchanged?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "The verify step naming WS-21 as the empty-plan case is stale: WS-21 now holds PLN-17. Use WS-17, WS-18, WS-14 or WS-16 for the empty case."
        - "The browser walkthrough steps were left to the orchestrator, which runs them directly after this execution."
    ```

- [x] 3. Phase 3 — The block renderer

  ```yaml
  description: "Replace the Phase 2 `<pre>` with a hand-built Markdown subset block renderer and give the plan body its typography. Depends on Phase 2."
  ```

  - [x] 3.1 Write `renderPlanBlocks()` and delete the Phase 2 `<pre>`
    ```yaml
    description: "One forward pass over the body's lines that emits headings, paragraphs, code blocks, lists and rules through el() only."
    issues: []
    implement:
      - "In src/public/app.ts, inside the existing IIFE, add `function renderPlanBlocks(body: string): HTMLElement`. It returns ONE container element, walks the body's lines once in order, and emits through `el()` only. Expected size is 70 to 90 lines. `collectItems()` in src/lib/detail.ts:48 is the precedent for the walk."
      - "Implement exactly the grammar in Contract 4 of PLN-17 and nothing more. A ``` opener and every line up to a closing ``` become one `<pre>` holding the inner lines joined by newlines. Outside a fence: `# ` or `## ` becomes `<h4>`; `### ` becomes `<h5>`; `#### ` or deeper becomes `<h6>`; `---`, `***` or `___` alone on a line becomes `<hr>`; a run of `- `, `* ` or `+ ` lines becomes one `<ul>` of `<li>`; a run of `N. ` or `N) ` lines becomes one `<ol>` of `<li>` with `start` set from the first number; a run of other non-blank lines becomes one `<p>` with the lines joined by a single space; and a blank line closes any open run."
      - "Track fence state BEFORE anything else. Inside a fence no line is interpreted, which is the whole defence against trap 3: three LAD plans hold more than one `# ` line only because bash comments inside fences look like H1s."
      - "An unterminated fence runs to the end of the body. This deliberately differs from collectItems(), which treats an unterminated opener as ordinary text — that rule exists there to stop an opener swallowing item lines, and there are no item lines here. Running to the end matches CommonMark. Both rules are lossless; record the difference in a comment."
      - "Drop the fence info string. A language tag taken from file content must never reach a class attribute, both because textContent is the only content path and because a file-supplied class name could collide with the page's own CSS."
      - "Test the `<hr>` rule BEFORE the list rules, so `* * *` cannot be read as a list item. Note in a comment that `---` cannot match a list rule anyway, because the list rules require a space after the marker."
      - "A line starting `|` ends the current paragraph run and becomes its own paragraph. Without this break, the paragraph joiner fuses a whole pipe table into one unreadable line. Pipe tables are NOT parsed into real `<table>` elements — PLN-17 puts that out of scope and open question 2 recommends shipping the paragraph fall-through."
      - "Flatten nested list indentation into one flat `<ul>` or `<ol>` per run; only 73 of 1559 corpus list lines are indented at all. Give blockquotes no rule — a `> ` line falls through to a paragraph and keeps its literal `> `. Parse no inline markup at all: backticks, `**` pairs and link brackets stay as literal characters (acceptance criterion 10)."
      - "Headings start at `<h4>` because the panel's section header is already an `<h3>` (buildSection, src/public/app.ts:310) inside the modal's `<h2>` title. Three source levels map to three output levels, so the visual hierarchy survives."
      - "In `renderPlanPanel()`, replace the temporary `<pre>` from task 2.2 with `sec.appendChild(renderPlanBlocks(item.body))`. Give the returned container the class `.ws-plan` so task 3.2's typography can target it."
      - "renderPlanBlocks() takes a string and returns an element. Per the plan's 'What each piece must not know', it must NOT know about tabs, panels, artefacts, fetching or the modal."
    pattern: "src/public/app.ts only. src/public/styles.css is task 3.2."
    imports: "None, and none may be added — no Markdown library, and package.json declares zero runtime dependencies. Use only the existing el() helper plus document.createTextNode where a text node is genuinely needed. module: \"none\" makes any import a compile error."
    compatibility: "Contract 4 of PLN-17, and acceptance criteria 8, 9 and 10. The renderer is a single forward pass with no backtracking, so it is linear in file size; the corpus maximum is 1570 lines and 90 KB."
    gotcha: "Reading a heading before checking fence state is trap 3 and is the single most likely defect here. Writing to innerHTML anywhere in this function would break the repository's standing guard that every innerHTML assignment in src/ is a container clear. Setting a class from the fence info string leaks file content into an attribute. Joining paragraph lines without the pipe-line break fuses a 573-line corpus of table rows into single lines. Omitting `start` on the `<ol>` renumbers every list that does not begin at 1."
    verify:
      - "npx tsc --noEmit -p src/public/tsconfig.json"
      - "npx tsc --noEmit -p tsconfig.json"
      - "npm run build, then open WS-5's plan: it shows headings, wrapped paragraphs, code blocks, bullet lists and numbered lists"
      - "A hard-wrapped paragraph in this repository's plans reflows to the panel width instead of breaking at the source line ends"
      - "Open the LAD workstream WS-179-hosted-engine-pivot (1570 lines, 31 body `---` lines): it opens without error and its rules render as `<hr>`, with no content lost after the first one"
      - "Open the LAD workstream WS-86-lad-opencode-client-unit-tests (3 lines starting `# `, two of them bash comments inside fences): those two lines show inside a code block, not as headings"
      - "Open a plan holding a pipe table: it renders one paragraph per row, not one fused line"
      - "Open a plan holding a backtick or a `**` pair: those characters show literally"
      - "Inspect the panel's DOM: every text node came from textContent, and the DOM holds no element named by the file's content"
      - "Re-run the read-only LAD replay from task 1.3 and confirm it still passes over all 175 LAD workstreams, writing nothing into LAD"
      - "grep -n \"innerHTML\" src/public/app.ts shows every assignment is still = ''"
    checklist:
      - "Does a `# comment` line inside a fenced block render as code rather than as a heading?"
      - "Does an unterminated fence run to the end of the body without losing content?"
      - "Is the fence info string discarded rather than written to any attribute?"
      - "Do backticks, `**` pairs and link brackets survive as literal characters?"
      - "Does the temporary `<pre>` from task 2.2 no longer exist anywhere in renderPlanPanel?"
      - "Does renderPlanBlocks reference no tab, panel, artefact, fetch or modal symbol?"
      - "Is every element emitted through el(), with no innerHTML content write added?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "The verify step naming LAD WS-86-lad-opencode-client-unit-tests as the fence trap is inaccurate: its three `# ` lines sit at lines 13, 401 and 472, all OUTSIDE fences, so they correctly render as headings. The real fixture is LAD WS-1-ak-artifact-lifecycle line 87, `# an issue file is closed when it has no open issue lines`, inside a ```bash fence. It was checked and lands in a <pre>, never a heading."
        - "Renderer regression replay over all 51 plan bodies in this repository and LAD (19566 lines): no throw, no content loss, no fenced line became a heading, no element carried a class taken from file content, and every <hr> count matched the source thematic-break count exactly."
        - "The browser walkthrough steps were left to the orchestrator, which runs them directly after this execution."
    ```
  - [x] 3.2 Add the plan body typography under a `.ws-plan` container class
    ```yaml
    description: "Style the rendered plan body without putting any display rule on the panel div."
    issues: []
    implement:
      - "In src/public/styles.css, append a `.ws-plan` block after the existing modal styles, following the file's own commented-section convention. Cover: sizes and spacing for `h4`, `h5` and `h6`; paragraph spacing; list indent; and a `<pre>` treatment reusing the `.ws-raw` styling already in the file (background var(--paper-sunken), 1px var(--line) border, 6px radius, var(--font-mono), white-space: pre-wrap, overflow-x: auto)."
      - "Ensure long prose wraps and reflows rather than overflowing — the reader must never meet a wall of monospace text (acceptance criterion 8). `.ws-val` and `.ws-section-title` already use overflow-wrap: anywhere as the precedent."
      - "Put NO `display` rule on `#ws-panel-plan` or on any panel div. This is trap 9 of PLN-17: the panels rely on the `hidden` attribute and the user-agent `display: none` that comes with it, and styles.css carries no `[hidden]` rule today. Style a container INSIDE the panel instead."
      - "Add no new scroll container. `.ws-modal-body` already sets overflow: auto and `.ws-modal-inner` already caps the height."
    pattern: "src/public/styles.css only, appended after the existing .ws-task-* block at the end of the file."
    imports: "None. No web font, no external stylesheet, no asset. Use the CSS custom properties the file already defines: --paper-sunken, --line, --ink, --ink-soft, --ink-faint, --font-mono, --font-body, --font-display, --accent."
    compatibility: "Phase 3 of PLN-17 and trap 9. The dashboard has zero runtime dependencies, so no CSS framework may be introduced. Existing selectors must not be redefined — .ws-raw, .ws-section-* and .ws-modal-* stay exactly as they are."
    gotcha: "A `display` rule reaching #ws-panel-plan through any selector makes a hidden panel visible, which breaks acceptance criterion 13 in a way that is easy to miss because the tab still looks correct. Setting a fixed height or overflow on the panel would fight the modal's existing scroll. Heading sizes must sit below the .ws-section-title 14px so the plan's h4 does not out-shout the section header above it."
    verify:
      - "npm run build, then open a plan-bearing workstream and read the rendered body: headings, paragraphs, lists, rules and code blocks are visually distinct and legible"
      - "grep -nE '#ws-panel-plan|display' src/public/styles.css shows no display rule targeting any panel div"
      - "In devtools, switch tabs and confirm exactly one panel is visible at every step and the hidden panels compute to display: none"
      - "Resize the modal and confirm long prose reflows instead of overflowing horizontally"
    checklist:
      - "Does styles.css contain no `display` rule reaching #ws-panel-plan or any tabpanel div?"
      - "Do hidden panels still compute to display: none from the user-agent rule?"
      - "Are the plan's h4, h5 and h6 sizes all below the existing .ws-section-title size?"
      - "Does the plan `<pre>` reuse the .ws-raw treatment rather than inventing a second code style?"
      - "Were any existing selectors redefined or removed?"
      - "Was any new scroll container added?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Every new selector is scoped under .ws-plan, a container INSIDE the panel. styles.css still holds no rule reaching #ws-panel-plan or any tabpanel div, and the only `display` word in the new block is inside a comment."
        - "The code block reuses the .ws-raw class itself rather than restating its six declarations, so there is one code style in the file, not two. `.ws-plan pre.ws-raw` adds only the spacing between blocks."
        - "The browser walkthrough steps were left to the orchestrator, which runs them directly after this execution."
    ```

- [x] 4. Phase 4 — The card's PLN row deep-links to the Plan tab
  ```yaml
  description: "Give each artefact row its type, give openModal an initialTab parameter, and have the board's existing delegated click handler open the modal on Plan when a PLN row was clicked. Depends on Phase 2. It is last because it is the smallest change and the only one that is meaningless until the tab it targets is worth landing on."
  issues: []
  implement:
    - "In src/public/app.ts, in `buildCard()`, set `row.dataset.artefactType = a.type;` immediately after the artefact row element is created (currently `var row = el('div', 'artefact-row');` at line 107). This is the only new data the deep link needs."
    - "Give `openModal(wsId)` a second parameter, `initialTab`, and pass it to its existing `selectTab(..., false)` call (currently `selectTab('issues', false);` at line 483) in place of the literal 'issues'. Keep the surrounding comment's intent: a reopen must still never inherit the last session's tab."
    - "In the board's EXISTING delegated click listener, after resolving the card, also read `var row = (e.target as HTMLElement).closest('.artefact-row') as HTMLElement | null;` and call `openModal(card.dataset.ws, row && row.dataset.artefactType === 'plan' ? 'plan' : 'issues')`."
    - "In the board's keydown listener, pass 'issues' unconditionally. The card is the focus target and the row is not, so the keyboard has no row context to read. A keyboard reader still reaches the plan with one Tab and one ArrowLeft inside the modal."
    - "Add NO new listener and NO new focusable element. Artefact rows stay non-interactive — making them buttons would add three tab stops to every card. Contract 6 of PLN-17 is explicit about this."
  pattern: "src/public/app.ts only. board.html, styles.css, detail.ts, extract.ts and praxis-data.d.ts are all unchanged by this task."
  imports: "None, and none may be added. module: \"none\" makes any import a compile error. dataset.artefactType maps to the data-artefact-type attribute automatically; no attribute name is written by hand."
  compatibility: "Contract 6 of PLN-17, and acceptance criteria 4 and 5. The board uses ONE delegated listener each for click and keydown, on #board, because renderBoard() rebuilds board.innerHTML on every sort, direction and search change — per-card listeners would be re-created continuously and leak. The deep link must ride that existing listener."
  gotcha: "Binding a listener to the row instead of using the delegated one leaks on every re-render and stops working after the first sort or search. Giving the row tabIndex or a role adds three tab stops per card. Reading dataset.artefactType before setting it in buildCard() yields undefined and silently falls back to Issues, which looks like the feature simply not working."
  verify:
    - "npx tsc --noEmit -p src/public/tsconfig.json"
    - "npx tsc --noEmit -p tsconfig.json"
    - "npm run build, then click a card's PLN row: the modal opens on Plan with the body rendered"
    - "Click the same card's IL or TL row: the modal opens on Issues"
    - "Click the card's title, tags or footer: the modal opens on Issues"
    - "Focus a card and press Enter: the modal opens on Issues"
    - "Sort and search the board, then click a PLN row again: the single delegated listener still works after renderBoard() has rebuilt the DOM"
    - "grep -c \"addEventListener\" src/public/app.ts is unchanged from before this task — no listener was added"
  checklist:
    - "Does clicking a PLN row open the modal on the Plan tab with the body rendered?"
    - "Does clicking an IL row, a TL row, the title, the tags or the footer open the modal on Issues?"
    - "Does the keyboard Enter path still open on Issues?"
    - "Does the deep link still work after a sort, a direction change and a search have each rebuilt the board?"
    - "Were zero listeners and zero focusable elements added?"
    - "Do artefact rows still carry no tabIndex and no role?"
  self_eval:
    passed: true
    failures: []
    notes:
      - "Six lines of behaviour changed, all in src/public/app.ts: the dataset write in buildCard, the openModal parameter, the selectTab call inside openModal, the row lookup and the two openModal call sites. No other file was touched."
      - "openModal(wsId, initialTab) makes initialTab required rather than defaulted, so both call sites must state the tab. That keeps a reopen from inheriting the last session's tab structurally."
      - "The once-per-open guard was traced rather than assumed: openModal resets planData to null and planBuilt to false BEFORE selectTab runs, so the deep link's selectTab('plan') call to maybeBuildPlan returns early on planData === null, and renderDetail's later call is the one that builds. The plain-open path builds on the selectTab call instead. Exactly one build either way."
      - "The keyboard path is stated, not silently divergent: the keydown listener passes 'issues' unconditionally, because the card is the focus target and the row carries no focus. ARIA is unchanged, since both paths reach the same selectTab."
      - "The verify step naming WS-21 as the empty-plan case is stale across this file: WS-21 now holds PLN-17. WS-17, WS-18, WS-14 and WS-16 are the correct empty-case fixtures."
      - "The browser walkthrough steps were left to the orchestrator, which runs them directly after this execution. Checklist items 1 to 4 were evaluated by code trace and by grep over the compiled dist/public/app.js."
  ```

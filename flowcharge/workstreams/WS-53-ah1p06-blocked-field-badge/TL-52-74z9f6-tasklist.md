---
id: TL-52-74z9f6
type: tasklist
workstream: WS-53-ah1p06
slug: blocked-field-badge
title: "Drop the Blocked column and render the blocked frontmatter field as a card badge and modal line"
status: done
created: 2026-08-21
updated: 2026-08-21
author: Anthony Koukoullis
depends_on: [PLN-43-943hna, TL-51-49a6fh]
links: []
mode: spec
base_commit: ab29357
---

# PRX Tasks

## Blocked field badge

Upstream Praxis removed `blocked` from the workstream status enum and replaced it with an
optional `blocked` frontmatter key whose value is the reason. Presence means blocked,
absence means not, and a workstream can be blocked at any status. This dashboard still
hardcodes the old model.

This task list implements `PLN-43-943hna` in its four phases, in the plan's order, one
child task per file. Phase 1 removes the `blocked` entry from `STATUS_ORDER` and
`STATUS_LABEL` in `src/public/app.ts`, which drops the board column, the KPI bar segment
and the KPI chip together, and corrects the six-column sentence in `README.md`. Phase 2
carries the new key from frontmatter to the browser through `src/lib/extract.ts` and
`src/types/praxis-data.d.ts`. Phase 3 paints a small red pill on the card. Phase 4 paints a
labelled reason line as the first child of the detail modal's meta block.

Six files change: `src/public/app.ts`, `README.md`, `src/lib/extract.ts`,
`src/types/praxis-data.d.ts`, `src/public/board.html`, `src/public/styles.css`. No new
dependency is added. `src/lib/detail.ts`, `src/server.ts` and `electron/ipc-handlers.cts`
stay untouched. `matches()` stays untouched, so the reason never joins the search haystack.
`--st-blocked` and `--st-blocked-bg` stay defined and unmodified in all four theme blocks,
because `.attn-row .a-days` still consumes `--st-blocked`. No new KPI, filter or sort is
added.

The data path copies `WS-52-rjis6j` / `PLN-42-oldpkh` exactly, which adds the sibling
`description` field through the identical mechanism. Both workstreams edit the same two
anchors, so this list declares `depends_on: [PLN-43-943hna, TL-51-49a6fh]` and Praxis's own
gate blocks execution until WS-52's task list is `done`. WS-52 had not executed when these
tasks were authored — see Divergence 1 for what each anchor looks like today and how it
shifts once WS-52 lands.

The manual test value is a temporary local edit to one workstream record's frontmatter,
made in task 2.2 and reverted in task 4.3. It is never a permanent addition to any
repository's workstream records.

- [x] 1. Phase 1 — remove the Blocked column

  ```yaml
  description: "Drop the blocked status from the board, the KPI bar and the KPI chip row, and correct the README's column sentence."
  ```

  - [x] 1.1 Remove the `blocked` entry from `STATUS_ORDER` and `STATUS_LABEL`
    ```yaml
    description: "Delete the blocked status from both constants at the top of src/public/app.ts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block. Both constants sit on adjacent lines at the top of the IIFE, so this is one contiguous edit at one location."
      - |
        src/public/app.ts
        <<<<<<< SEARCH
          var STATUS_ORDER = ['backlog', 'ready', 'in-progress', 'blocked', 'done', 'dropped'];
          var STATUS_LABEL: Record<string, string> = { backlog: 'Backlog', ready: 'Ready', 'in-progress': 'In Progress', blocked: 'Blocked', done: 'Done', dropped: 'Dropped' };
        =======
          var STATUS_ORDER = ['backlog', 'ready', 'in-progress', 'done', 'dropped'];
          var STATUS_LABEL: Record<string, string> = { backlog: 'Backlog', ready: 'Ready', 'in-progress': 'In Progress', done: 'Done', dropped: 'Dropped' };
        >>>>>>> REPLACE
      - "Change nothing else in the file. Add no migration branch and no fallback for a record still carrying status: blocked."
    pattern: "src/public/app.ts lines 2-3 only."
    imports: "None. Both constants are plain module-level literals inside the file's IIFE."
    compatibility: "renderBoard seeds byStatus from STATUS_ORDER and renders one column per entry with STATUS_LABEL[status] as the heading. renderKpis seeds wsByStatus and draws one bar segment and one chip per entry. Both loop the constants, so this single edit removes the column, the segment and the chip with no other code change. .board is display: flex, not a fixed grid, so no CSS changes."
    gotcha: "A record still holding status: blocked must keep landing in Backlog through the existing (byStatus[w.status] || byStatus.backlog) fallback — do not add new handling for it. The pre-existing KPI bar undercount for unrecognised statuses is explicitly out of scope: do not touch renderKpis's counting logic. Do not delete --st-blocked or --st-blocked-bg from src/public/styles.css; .attn-row .a-days at line 432 still consumes --st-blocked for the Attention panel's stale-days colour."
    verify:
      - "npm run build"
      - "grep -c 'blocked' src/public/app.ts returns 0."
      - "grep -c 'st-blocked' src/public/styles.css still returns 9, and git diff --name-only does not list src/public/styles.css (see Divergence 2)."
      - "npm start, then open the board. Five columns appear in order: Backlog, Ready, In Progress, Done, Dropped. The KPI strip's workstream bar and chip row show the same five statuses and no Blocked segment or chip. The Attention panel's stale-days figures still render in their red."
      - "Temporarily set one local workstream record's frontmatter to status: blocked, reload, and confirm the card appears in the Backlog column. Revert that edit."
    checklist:
      - "STATUS_ORDER holds exactly five entries in the order backlog, ready, in-progress, done, dropped."
      - "STATUS_LABEL holds exactly the same five keys and no others."
      - "No other line of src/public/app.ts changed."
      - "renderKpis's counting logic is unchanged, and no new status handling or fallback was added."
      - "npm run build compiles clean across all three tsconfig projects."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Correct the README board sentence to five columns
    ```yaml
    description: "Change the six-column board sentence in README.md to name the five columns the board now renders."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block. The sentence spans README.md lines 9-11; only line 10 carries the column count and the column list, and that line is unique in the file."
      - |
        README.md
        <<<<<<< SEARCH
        six-column board (Backlog · Ready · In Progress · Blocked · Done · Dropped), sortable by
        =======
        five-column board (Backlog · Ready · In Progress · Done · Dropped), sortable by
        >>>>>>> REPLACE
      - "Leave the rest of the paragraph and every other README section exactly as they are."
    pattern: "README.md line 10 only."
    imports: "None."
    compatibility: "The column names and their order must match STATUS_LABEL and STATUS_ORDER as task 1.1 leaves them."
    gotcha: "The separator between column names is U+00B7 MIDDLE DOT, not a hyphen or a bullet — copy it, do not retype it. The line has no trailing punctuation because the sentence continues on line 11; do not add any. Assumption A7 restricts this task to this one sentence."
    verify:
      - "grep -c 'six-column' README.md returns 0."
      - "grep -n 'five-column' README.md returns one line naming Backlog, Ready, In Progress, Done and Dropped in that order."
      - "git diff -- README.md shows exactly one changed line."
    checklist:
      - "The sentence reads five-column and lists exactly five names."
      - "The listed order matches the board's render order from task 1.1."
      - "The U+00B7 separators are preserved and the word Blocked is gone."
      - "No other README section or paragraph was edited."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — the field reaches the browser

  ```yaml
  description: "Read the optional blocked frontmatter key during extraction and carry it on the PraxisWorkstream payload type, so it rides the existing transport to the board with no server change."
  ```

  - [x] 2.1 Add `blocked?: string;` to the `PraxisWorkstream` interface
    ```yaml
    description: "Declare the new optional key on the shared ambient payload interface in src/types/praxis-data.d.ts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/types/praxis-data.d.ts and find the interface PraxisWorkstream block. At authoring time its last key is artefacts: PraxisArtefact[]; and it holds no description key (see Divergence 1)."
      - "Add one line, blocked?: string;, as a sibling of the other keys. WS-52 may have already added description?: string; to the same interface when this task executes — in that case place blocked?: string; immediately after it, wherever it ended up. Otherwise place it after artefacts: PraxisArtefact[];."
      - "Declare it optional, never nullable. Absent means absent — never null, never the empty string. JSON.stringify drops an undefined key, which is what keeps the payload byte-identical for the entire existing corpus."
      - "Add no other key, no comment block, and no import or export statement."
    pattern: "src/types/praxis-data.d.ts, the interface PraxisWorkstream block only."
    imports: "None, and none may be added — see compatibility."
    compatibility: "This file is an ambient global declaration shared by three tsconfig projects. A top-level import or export turns it into a module and every interface in it stops being global. Adding one optional key does not disturb that. The key is optional, so every existing producer and consumer of PraxisWorkstream still typechecks with no edit."
    gotcha: "Do not use string | undefined or string | null in place of the optional marker — an explicitly undefined-valued required key is not the same contract and would force every construction site to supply it. Do not touch PraxisWorkstreamDetail; the chosen data flow reads the board payload, not the detail payload."
    verify:
      - "npm run build"
      - "grep -cE '^(import|export) ' src/types/praxis-data.d.ts returns 0, so the file is still an ambient global declaration."
      - "grep -n 'blocked' src/types/praxis-data.d.ts returns exactly one line, inside interface PraxisWorkstream."
    checklist:
      - "PraxisWorkstream declares blocked as optional, typed string, not nullable."
      - "The file still has no top-level import and no top-level export."
      - "No other interface in the file was edited."
      - "npm run build compiles clean across all three tsconfig projects."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.2 Read the `blocked` key in the workstream extraction literal
    ```yaml
    description: "Add the guarded blocked key to the workstream out.push({...}) object literal in src/lib/extract.ts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/lib/extract.ts and find the out.push({ ... }) call inside walkWorkstreams. At authoring time it sits at line 184 and its keys run id, slug, title, status, tags, created, updated, depends_on, body, archived, artefacts, with no description key (see Divergence 1)."
      - "Add one key to that object literal. WS-52 may have already added a description key to the same literal when this task executes — add blocked as its immediate sibling, directly after it, wherever it ended up. Otherwise add it after the archived key and before artefacts."
      - "Use an inline typeof guard, not the existing fmStr helper. Illustrative, not literal: blocked: typeof wsFm.blocked === 'string' ? wsFm.blocked : undefined,"
      - "Change nothing in parseFrontmatter. Its key regex /^([a-zA-Z_]+):\\s*(.*)$/ already matches a blocked key and its val.replace(/^\"(.*)\"$/, '$1') already strips the surrounding double quotes."
      - "Do not trim, truncate, validate or sanitise the value here. Trimming belongs at render time only, in both render sites."
      - "Create the manual test value for phases 2 to 4: add blocked: \"Test reason with <angle> & \\\"quotes\\\".\" to one workstream record's frontmatter in a local flowcharge/ tree. Task 4.3 reverts it."
    pattern: "src/lib/extract.ts, the workstream out.push object literal inside walkWorkstreams only."
    imports: "None. wsFm is already in scope as the parsed frontmatter of workstream.md."
    compatibility: "out is declared const out: PraxisWorkstream[], so the literal is checked against task 2.1's interface — that task must land first. Transport needs no change: extractPraxisData() returns the workstream objects whole, src/server.ts spreads the payload into GET /api/projects/<id>/data with no per-field mapping, and the Electron proxy passes the same object through. A new optional key rides along for free."
    gotcha: "fmStr is documented in this same file as asserting v as string rather than coercing. Using it would type an absent blocked as string and lie to every consumer. The typeof guard also handles the one odd input the parser can produce: an unquoted value that both starts with [ and ends with ] is parsed into an array, and the guard turns that into undefined, which is the correct graceful outcome. Presence semantics only — a value of \"false\" or \"no\" is an ordinary reason string and marks the workstream blocked; add no boolean coercion. parseFrontmatter reads line by line, so only a single-line scalar is supported (assumption A3), and no \\\" unescaping is performed (assumption A4)."
    verify:
      - "npm run build"
      - "npm start, then request GET /api/projects/<id>/data. The edited workstream object carries \"blocked\" with the exact text, including the literal <angle> and & characters."
      - "Count the occurrences of \"blocked\" in that response body — exactly one, proving every other workstream object carries no blocked key at all."
      - "git diff --name-only lists neither src/lib/detail.ts, nor src/server.ts, nor electron/ipc-handlers.cts."
    checklist:
      - "The new key uses an inline typeof guard and not fmStr."
      - "parseFrontmatter is unchanged, and no trimming, truncation or sanitising was added in extract.ts."
      - "A workstream record with no blocked key produces no blocked key in the JSON payload."
      - "src/lib/detail.ts, src/server.ts and electron/ipc-handlers.cts are untouched."
      - "npm run build compiles clean across all three tsconfig projects."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 3 — the card badge

  ```yaml
  description: "Paint a small red Blocked pill on the card, on its own row between the ID/date row and the title, with the full reason as a native tooltip."
  ```

  - [x] 3.1 Add the `.card-blocked` and `.blocked-pill` rules
    ```yaml
    description: "Add two purely additive rules to src/public/styles.css beside the existing .tag rule."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/styles.css and find the .tag rule. At authoring time it starts at line 362, directly after .card-tags at line 361."
      - "Add two new rules beside it, in the card block. Illustrative, not literal — derive the exact size, padding and radius from the neighbouring .tag rule you just read."
      - "Illustrative: .card-blocked { display: flex; margin-bottom: 5px; } and .blocked-pill { font-family: var(--font-mono); font-size: 9.5px; font-weight: 600; color: var(--sev-critical); background: color-mix(in srgb, var(--sev-critical) 12%, transparent); padding: 1px 6px; border-radius: 999px; letter-spacing: 0.02em; }"
      - "Use --sev-critical for both the ink and the background mix. Do not add a new --sev-critical-bg custom property to the theme blocks, and do not reuse --st-blocked or --st-blocked-bg."
      - "Mix with transparent, not with var(--paper). The same .blocked-pill rule serves the card, whose background is var(--paper), and task 4.2's modal wrapper, which inherits the modal's surface. An alpha tint composites correctly over both from one rule."
      - "Add nothing else. No new custom property, no edit to any existing rule, no edit to any theme block."
    pattern: "src/public/styles.css, the card rules region beside .tag."
    imports: "None. --sev-critical and --font-mono are already defined."
    compatibility: "--sev-critical is defined in all four theme blocks at lines 36, 81, 102 and 115, and is used elsewhere only as a foreground color, so it is already tuned to read as ink against each theme's paper. color-mix() is already in this stylesheet in the same 'mix a themed variable with transparent' shape, at the two ::backdrop rules on lines 683 and 801."
    gotcha: "The plan describes the pill's weight as derived from .tag, but .tag itself declares no font-weight — 600 is a deliberate addition for the pill, not a copy. --st-blocked and --st-blocked-bg must remain defined and unmodified in all four theme blocks: --st-blocked has one live unrelated consumer, .attn-row .a-days at line 432, which supplies the Attention panel's stale-days colour, and deleting the pair would break that panel."
    verify:
      - "npm run build, which re-runs tools/copy-assets.mjs so the stylesheet is republished."
      - "git diff -- src/public/styles.css is purely additive — no existing rule was modified or removed."
      - "grep -c 'st-blocked' src/public/styles.css still returns 9, and grep -c 'sev-critical-bg' src/public/styles.css returns 0."
      - "Reload the board and cycle all four themes. The Attention panel's stale-days figures still render in their red in each."
    checklist:
      - "Exactly two new rules were added, .card-blocked and .blocked-pill."
      - "The pill's colour comes from --sev-critical, not from --st-blocked or --st-blocked-bg."
      - "No new custom property was added to any theme block."
      - "The diff against src/public/styles.css is additive only."
      - "The Attention panel's stale-days colour is visually unchanged in all four themes."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.2 Build the badge row in `buildCard`
    ```yaml
    description: "Insert the blocked pill row into buildCard in src/public/app.ts, between the card-top append and the card-title append."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/app.ts and find buildCard. At authoring time card.appendChild(top); sits at line 212 and card.appendChild(el('div', 'card-title', w.title)); at line 214, with one blank line between them."
      - "Insert the badge block between those two statements, so the pill row renders below the workstream-ID and date row and above the card title."
      - "Trim w.blocked into a local first, and build the row only when the trimmed value is non-empty. Absent, empty and whitespace-only all take the same branch and produce no element at all."
      - "Illustrative, not literal: var b = (w.blocked || '').trim(); if (b) { var row = el('div', 'card-blocked'); var pill = el('span', 'blocked-pill', 'Blocked'); pill.title = b; row.appendChild(pill); card.appendChild(row); }"
      - "Write the pill's label through the el() helper and the reason through the title property. Add no escaping helper and write no HTML."
      - "Leave matches() completely untouched. The reason does not join the search haystack."
    pattern: "src/public/app.ts, buildCard only."
    imports: "None. el() and the card element are already in scope inside buildCard."
    compatibility: "The el() helper assigns text through textContent and pill.title is a property assignment, so a reason containing <, &, \" or ' renders as literal text and never as markup. The card is built fresh on every render, so there is no hide branch to write and no stale-state path — an unblocked card simply never gains the element, which is why it adds no vertical space. buildCard reads only from the PraxisWorkstream it is handed; keep it that way."
    gotcha: "buildCard must not fetch anything and must not learn about the modal. The trim happens here, at render time, not during extraction. Do not reach for w.blocked before the null-safe (w.blocked || '') guard — the key is optional and absent on almost every record."
    verify:
      - "npm run build, so tools/copy-assets.mjs republishes the browser bundle."
      - "npm start with task 2.2's test value still in place. The edited workstream's card shows a small red pill reading Blocked, on its own row below the ID/date row and above the title."
      - "Hover the pill. The full reason appears as a native tooltip and the <angle> text appears literally, not as markup."
      - "Every other card is unchanged, with no pill and no extra vertical space. Cycle all four themes and confirm the pill stays legible in each."
      - "Set the test value to blocked: \"   \" and reload. No pill appears. Restore the original test value afterwards."
      - "Search the board for a word that appears only in the reason. Nothing matches. git diff -- src/public/app.ts | grep -c 'matches' returns 0."
    checklist:
      - "The pill row sits between the ID/date row and the card title in the rendered DOM."
      - "The full reason is readable as a hover tooltip and renders as literal text."
      - "A whitespace-only value and an absent value both produce no element and no extra vertical space."
      - "No innerHTML write and no escaping helper were added."
      - "matches() is unchanged."
      - "npm run build compiles clean."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 4. Phase 4 — the modal line

  ```yaml
  description: "Show the full reason, labelled by the same pill, as the first line inside the detail modal's meta block."
  ```

  - [x] 4.1 Add the `#ws-modal-blocked` wrapper to the modal meta block
    ```yaml
    description: "Insert the hidden blocked wrapper as the first child of .ws-modal-meta in src/public/board.html."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/board.html and find <div class=\"ws-modal-meta\" id=\"ws-modal-meta\">. At authoring time it sits at line 98 and holds exactly two children, #ws-modal-tags then #ws-modal-dates, with no description paragraph (see Divergence 1)."
      - "Insert one new element as the FIRST child of that block. WS-52 may have already added a <p id=\"ws-modal-description\"> when this task executes — the blocked wrapper still goes first, above it, so WS-52's description element becomes the second child."
      - "Illustrative, not literal: <div id=\"ws-modal-blocked\" class=\"ws-modal-blocked\" hidden><span class=\"blocked-pill\">Blocked</span><span id=\"ws-modal-blocked-reason\"></span></div>"
      - "Ship the wrapper with the hidden attribute already set, so an unblocked workstream shows nothing on the very first paint, before any script runs."
      - "Keep the pill span as static markup with its literal Blocked text, so task 4.3 performs exactly one textContent write and one hidden toggle."
      - "Change no other element in the file."
    pattern: "src/public/board.html, inside .ws-modal-meta only."
    imports: "None. The .blocked-pill class already exists from task 3.1."
    compatibility: "The ordering is settled: a blocked reason is an alert and the description is background context, so the alert reads first. The wrapper's shape follows the precedent of the existing #ws-modal-tags row — a container with a hidden attribute that the render function toggles."
    gotcha: "The reason span must be empty in the markup, never seeded with placeholder text. The wrapper must carry hidden in the source, not be hidden by a CSS rule, because the global [hidden] { display: none !important; } at src/public/styles.css line 136 is what makes the attribute win over .ws-modal-meta's flex gap. Do not touch the modal's tabs, panels or header."
    verify:
      - "npm run build, so tools/copy-assets.mjs republishes the page."
      - "grep -n 'ws-modal-blocked' src/public/board.html returns two lines, the wrapper and the reason span, both inside .ws-modal-meta."
      - "Reload the board and open any workstream. No blocked line appears before its script runs, and the meta block spacing matches a pre-change screenshot."
    checklist:
      - "The wrapper is the first child of .ws-modal-meta, above any description paragraph."
      - "The wrapper carries the hidden attribute in the markup as shipped."
      - "The pill span carries the literal text Blocked and the reason span is empty."
      - "No other element in src/public/board.html changed."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.2 Add the `.ws-modal-blocked` rule
    ```yaml
    description: "Add one additive rule for the modal wrapper to src/public/styles.css."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/styles.css and find the .ws-modal-meta rule. At authoring time it starts at line 736, followed by .ws-modal-meta .card-tags at line 743 and .ws-modal-dates at line 744."
      - "Add one rule for .ws-modal-blocked beside those, in the modal region."
      - "Illustrative, not literal: .ws-modal-blocked { display: flex; align-items: baseline; gap: 6px; font-size: 12.5px; color: var(--ink); overflow-wrap: anywhere; }"
      - "Include overflow-wrap: anywhere, copying the intent of the existing .ws-modal-title rule at line 709, so a long reason wraps inside the modal instead of forcing horizontal overflow."
      - "Reuse .blocked-pill from task 3.1 for the pill itself. Add no second pill rule and no theme-block edit."
    pattern: "src/public/styles.css, the modal rules region beside .ws-modal-meta."
    imports: "None. --ink is already defined in all four theme blocks."
    compatibility: "The rule must not compete with the global [hidden] { display: none !important; } at line 136. That declaration carries the !important that makes the hidden attribute win over any later class rule, and it is what stops the wrapper consuming .ws-modal-meta's flex gap: 6px when it is hidden."
    gotcha: "Do not add a display declaration with !important, and do not add a .ws-modal-blocked[hidden] override — the global rule already handles it. Do not restyle .ws-modal-meta, .ws-modal-dates or .ws-modal-meta .card-tags."
    verify:
      - "npm run build"
      - "git diff -- src/public/styles.css for this task is purely additive — one new rule, no existing rule modified or removed."
      - "grep -c 'st-blocked' src/public/styles.css still returns 9."
      - "Open a blocked workstream's modal and confirm the pill and reason sit on one baseline-aligned row. Set the test value to 500 characters, reload, and confirm the line wraps inside the modal with no horizontal scrolling."
    checklist:
      - "Exactly one new rule, .ws-modal-blocked, was added."
      - "The rule includes overflow-wrap: anywhere and no !important declaration."
      - "The pill in the modal is styled by the shared .blocked-pill rule from task 3.1."
      - "--st-blocked and --st-blocked-bg are still unmodified in all four theme blocks."
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.3 Write and hide the blocked line in `renderModalMeta`
    ```yaml
    description: "Extend renderModalMeta in src/public/app.ts to fill the wrapper, hide it when there is no reason, and clear it on the no-workstream path."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/app.ts and find renderModalMeta(w: PraxisWorkstream | undefined). At authoring time it starts at line 786, fetches sevDot, tagsEl and datesEl with byId, clears tagsEl.innerHTML, then has an if (!w) early-return branch, and it holds no description handling (see Divergence 1)."
      - "Fetch ws-modal-blocked and ws-modal-blocked-reason with the existing byId helper, beside the tagsEl and datesEl lookups."
      - "In the if (!w) early-return branch, clear the reason element's text and set the wrapper's hidden = true, beside the existing sevDot, tagsEl and datesEl resets."
      - "In the main path, before any description write, trim w.blocked into a local. If it is a non-empty string, assign it with textContent and set the wrapper's hidden = false. Otherwise clear the text and set hidden = true. Absent, empty and whitespace-only all take the same branch."
      - "Write the reason through textContent only. Add no innerHTML content write and no escaping helper."
      - "Leave matches() completely untouched, and do not read from the detail payload or fetch anything."
      - "When verification is complete, remove the temporary blocked line added to the workstream record in task 2.2 and confirm that flowcharge/ tree is back to unmodified."
    pattern: "src/public/app.ts, renderModalMeta only."
    imports: "None. byId and the workstreams array are already in scope."
    compatibility: "The value comes from the board's already-loaded workstreams array, the same source renderModalMeta already reads. renderModalMeta runs synchronously at the top of openModal, before modal.showModal(), so opening a blocked workstream, closing it, then opening an unblocked one shows no stale reason — no reset in openModal is needed and there is no window in which the previous reason is on screen. Follow the shape the tags row already uses."
    gotcha: "renderModalMeta must not fetch anything and must not reach into detail-payload state. src/lib/detail.ts stays untouched. The trim happens here at render time, matching task 3.2, not during extraction. Do not skip the clear-and-hide on the else branch — hiding without clearing would leave the previous reason in the DOM."
    verify:
      - "npm run build, so tools/copy-assets.mjs republishes the browser bundle."
      - "npm start with task 2.2's test value still in place. Open the edited workstream's card. The modal shows the pill and the full reason as the first line in the meta block, above the description line, the tags row and the dates line. The <angle> text appears literally."
      - "Close it and open a workstream with no blocked key. No blocked line appears, and the meta block spacing matches a pre-change screenshot."
      - "Set the test value to blocked: \"   \", reload, and confirm the modal shows no blocked line."
      - "grep -n 'innerHTML' src/public/app.ts shows every match is still a clear (= ''), with no HTML content write added. git diff -- src/public/app.ts | grep -c 'matches' returns 0."
      - "Remove the temporary blocked line from the workstream record, then confirm git status shows that flowcharge/ tree unmodified."
    checklist:
      - "The blocked line renders as the first line inside .ws-modal-meta for a blocked workstream."
      - "Opening a blocked workstream then an unblocked one leaves no stale reason on screen."
      - "Absent, empty and whitespace-only values all hide the wrapper and clear its text."
      - "The reason is written with textContent, and no innerHTML content write or escaping helper was added."
      - "matches(), src/lib/detail.ts, src/server.ts and electron/ipc-handlers.cts are all untouched."
      - "The temporary blocked frontmatter value was reverted and no flowcharge/ record retains it."
    self_eval:
      passed: true
      failures: []
    ```

## Divergences

1. **WS-52's anchors are not present yet.** The plan's assumption A1 describes
   `src/lib/extract.ts`'s `out.push({...})` literal, the `PraxisWorkstream` interface and
   the `.ws-modal-meta` block as they will read *after* WS-52's task list `TL-51-49a6fh`
   applies its `description` changes. At authoring time, against commit `ab29357`, none of
   those changes exist: `src/lib/extract.ts` line 184 pushes eleven keys ending
   `archived, artefacts` with no `description`; `src/types/praxis-data.d.ts` declares
   `PraxisWorkstream` ending at `artefacts: PraxisArtefact[];` with no `description?: string;`;
   and `src/public/board.html` line 98 opens a `.ws-modal-meta` holding exactly two
   children, `#ws-modal-tags` then `#ws-modal-dates`, with no `#ws-modal-description`.
   `TL-51-49a6fh` is `status: ready`, not `done`. Consequence: no task was dropped. Tasks
   2.1, 2.2, 4.1 and 4.3 describe the anchors as they read today and state explicitly where
   each one shifts once WS-52 lands, so the executor can place the new key or element
   correctly in either state. This list's `depends_on` still gates execution on
   `TL-51-49a6fh` reaching `done`.

2. **The `st-blocked` grep count is nine, not eight.** The plan's phase 1 verification step
   5 states that `grep -n "st-blocked" src/public/styles.css` still returns eight matches.
   Against commit `ab29357` that command returns nine lines — 25, 32, 70, 77, 99, 101, 112,
   114 and 432 — because `--st-blocked-bg` also contains the substring. Consequence: the
   count is a regression guard, not a design decision, so the check was carried into tasks
   1.1, 3.1 and 4.2 with the accurate figure of 9. Nothing else in the plan depends on the
   number.

Every other file the plan cites matched what the plan assumes, including
`parseFrontmatter`'s key regex and quote stripping in `src/lib/extract.ts`, the `fmStr`
helper's assert-not-coerce comment, `STATUS_ORDER` and `STATUS_LABEL` at
`src/public/app.ts` lines 2-3, the six-column sentence at `README.md` line 10, the `.tag`
rule at `src/public/styles.css` line 362, the global `[hidden]` rule at line 136,
`.attn-row .a-days` at line 432, the four `--sev-critical` definitions at lines 36, 81, 102
and 115, and the two `color-mix` `::backdrop` rules at lines 683 and 801.

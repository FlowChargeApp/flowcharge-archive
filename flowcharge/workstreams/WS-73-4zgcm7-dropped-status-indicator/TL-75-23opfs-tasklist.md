---
id: TL-75-23opfs
type: tasklist
workstream: WS-73-4zgcm7
slug: dropped-status-indicator
title: "Shared dropped-status indicator for the board card and the detail modal"
status: done
created: 2026-08-28
updated: 2026-08-28
author: Anthony Koukoullis
depends_on: [PLN-64-umu2n5]
links: []
mode: spec
base_commit: 6113fa4
---

# PRX Tasks

## Shared dropped-status indicator

The `dropped` status is invisible in three places. A dropped task list or issue
list shows nothing on the board card when no item is checked (`ISS-22-049ixu`).
A dropped artefact has no cue in the detail modal section header. A dropped issue
item shows the same green check mark a done issue shows.

This list builds PLN-64-umu2n5 without change. It adds ONE helper,
`statusBadge(status)`, in `src/public/app.ts`, and ONE `.st-badge` class in
`src/public/styles.css`. Three call sites use the helper, and each one gates on
`status === 'dropped'`. The helper reads the existing `--st-*` palette and the
existing `STATUS_LABEL` map, so no new colour and no new label text enters the
codebase. One data-layer change supports the third call site: the issue item
`status` becomes a typed field on `PraxisIssueDetail`, populated in
`src/lib/detail.ts` from the fence `collectItems` already attaches.

The four parent tasks map one-to-one to the plan's four phases, so each parent
can be committed on its own. Phases 2, 3 and 4 each depend on Phase 1 only, and
are independent of each other.

Individual task items get no indicator. The plan proves no per-task status data
exists. Open questions 1 to 4 of the plan stay open, and this list authors no
task for any of them. See **Open questions carried forward** at the end.

The project gate is `npm run build`. It runs three `tsc` passes, then the asset
copy, then the bundler. There is no lint script and no test script. A
`node --test` suite exists under `src/lib/*.test.ts` and is compiled by the Node
pass, so it runs from `dist/`.

- [x] 1. Phase 1 — the shared primitive

  ```yaml
  description: "Add the statusBadge helper and the .st-badge class. No call site yet, so nothing on screen changes."
  ```

  - [x] 1.1 Add the `statusBadge` helper to `src/public/app.ts`
    ```yaml
    description: "Add one shared status-pill builder inside the app IIFE. It knows how a badge looks, never when to show one."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/app.ts. The whole file is one IIFE that opens at line 13. STATUS_LABEL is declared at line 15 inside it."
      - "Add a new function statusBadge(status: string): HTMLElement immediately after the artefactTypeLabel helper (line 138-140). That block holds the small shared builders, and both buildCard and the modal builders sit below it, so both can call it."
      - "Build the element with the existing el() helper (line 70): el('span', 'st-badge', STATUS_LABEL[status]). el() sets className and textContent, so no innerHTML path is opened."
      - "Set the two colours inline, copying the KPI chip at lines 1268-1270 exactly: style.background = 'var(--st-' + status + '-bg)' and style.color = 'var(--st-' + status + ')'. Return the element."
      - "Add a short comment above it stating that the caller decides WHEN a status deserves a badge, and this decides only how one looks."
      - "Do NOT hard-code 'dropped' or '--st-dropped' inside the function. The status argument is the whole point — it removes three token-name duplications at the three call sites."
      - "Do NOT touch the KPI chip code at lines 1248-1272. Folding it into this helper is out of scope by the plan."
    pattern: "src/public/app.ts — one new function after artefactTypeLabel at line 140."
    imports: "No new import. Uses the existing el() helper and the existing STATUS_LABEL map, both already in scope inside the IIFE."
    compatibility: "The file is ES5-flavoured TypeScript: var declarations, function expressions, no arrow functions and no template literals in this file's style. Match it. The public tsconfig type-checks against src/types/praxis-data.d.ts."
    gotcha: "Neither tsconfig sets noUnusedLocals, so a helper with no caller compiles cleanly in this phase. STATUS_LABEL has no 'dropped' gap — it maps dropped to 'Dropped'. Every --st-<status> and --st-<status>-bg pair exists in both the light and the dark block of styles.css, so the inline var() reference resolves in both themes."
    verify:
      - "npm run build"
      - "grep -n 'function statusBadge' src/public/app.ts returns exactly one line."
      - "grep -c \"'dropped'\" on the new function body region returns 0 — the helper names no specific status."
    checklist:
      - "Does statusBadge take a status argument and read no hard-coded status name?"
      - "Does it build the element through el(), with no innerHTML and no string-built markup?"
      - "Does it set background from var(--st-<status>-bg) and color from var(--st-<status>), matching lines 1268-1270?"
      - "Is the KPI chip code at lines 1248-1272 unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 1.2 Add the `.st-badge` rule to `src/public/styles.css`
    ```yaml
    description: "Add the pill shape for the badge. Shape only — every colour arrives from the inline style the helper sets."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/styles.css and read the .tag rule at lines 462-470. It is the card-sized pill this app already uses."
      - "Add a .st-badge rule that copies .tag's metrics: font-family var(--font-mono), font-size 9.5px, padding 1px 6px, border-radius 999px, letter-spacing 0.02em. Add white-space: nowrap and flex-shrink: 0, copying .blocked-pill at lines 472-483, because the badge lands in flex rows."
      - "Do NOT put a color or a background declaration in this rule. Both arrive inline from statusBadge, and a rule-level colour would fight it."
      - "Place the rule beside .tag and .blocked-pill in the card block, so the three pill shapes stay together."
      - "Do NOT edit .tag, .blocked-pill or any other existing rule. This task is an addition only."
    pattern: "src/public/styles.css — one new rule near .tag (line 462) and .blocked-pill (line 472)."
    imports: "None. Plain CSS, no preprocessor in this project."
    compatibility: "The stylesheet is hand-written plain CSS with a --token palette defined twice, once for light at lines ~50-80 and once for dark at lines ~120-140. A rule that carries no colour needs no dark-block twin."
    gotcha: "Never write a bare .is-dropped rule here. Line 460 already holds an UNSCOPED .is-dropped .card-title selector, so any further unscoped .is-dropped rule leaks across the card and the modal. This task adds no .is-dropped rule at all; the later phases add scoped ones."
    verify:
      - "npm run build"
      - "grep -n '^\\.st-badge' src/public/styles.css returns exactly one line."
      - "grep -c '^\\.is-dropped' src/public/styles.css still returns 1 — only the pre-existing line 460 rule."
    checklist:
      - "Does .st-badge exist and carry the pill metrics of .tag?"
      - "Is .st-badge free of any color or background declaration?"
      - "Is every pre-existing rule, .tag and .blocked-pill included, byte-for-byte unchanged?"
      - "Does the unscoped .is-dropped count in the file stay at 1?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — board card cue, closing ISS-22-049ixu

  ```yaml
  description: "Apply call site 1. The dropped artefact row on a board card gains a Dropped badge and a faded bar, and keeps its fraction."
  ```

  - [x] 2.1 Show the badge on the dropped artefact row in `src/public/app.ts`
    ```yaml
    description: "In buildCard's issuelist/tasklist branch, mark a dropped row and append the shared badge after the fraction."
    author: Anthony Koukoullis
    issues: [ISS-22-049ixu]
    implement:
      - "Open src/public/app.ts and read the artefact-row loop inside buildCard, lines 279-305. The issuelist/tasklist branch is lines 288-295 and the plan branch is lines 296-301."
      - "Keep line 292 as it stands. The zero-width segment recolour is harmless and reverting it is not asked for."
      - "In the issuelist/tasklist branch only, after the a-frac span is appended at line 295, add: when a.status === 'dropped', add the class is-dropped to the row element and append statusBadge('dropped') to it."
      - "Add the class with row.classList.add('is-dropped'), not by rewriting row.className, so the artefact-row class survives."
      - "Do NOT touch the else branch at lines 296-301. It serves plans and already prints a dot plus the status word. Plan open question 3 leaves its lower-case status word alone."
      - "Do NOT change the progress bar width calculation at line 290, and do NOT change the a-frac fraction text at line 295. Acceptance criterion 2 requires both to survive."
    pattern: "src/public/app.ts — buildCard, the issuelist/tasklist branch at lines 288-295."
    imports: "None. statusBadge comes from task 1.1 in the same IIFE."
    compatibility: "a.status on PraxisWorkstream.artefacts is already a string in the board payload, declared on PraxisArtefact at src/types/praxis-data.d.ts line 9. src/lib/extract.ts line 160 writes it as fmStr(fm.status), which passes the frontmatter value through UNCHANGED — extract.ts lower-cases only the per-item issue status and severity, at lines 179-180. The new === 'dropped' test therefore relies on the lower-case status the frontmatter convention writes, exactly as the existing line 292 test already does, so it adds no new risk and needs no toLowerCase call. No type change and no payload change is needed here."
    gotcha: "The board column is narrow. The badge is added as a third flex child beside the bar and the fraction, so it can crowd the row. The .st-badge rule from task 1.2 already sets flex-shrink: 0 and nowrap, and the .a-bar keeps flex: 1, so the bar yields the space. Confirm this at the narrowest board column width."
    verify:
      - "npm run build"
      - "npm start, then open this repository's own board and find the card for WS-64-gdxh7m. Its TL-65-yjm7as row is dropped at 0 of 3, and the row must now read 'Dropped' while still showing 0/3."
      - "Replay the reproduction ISS-22-049ixu states: on the same board, open the card for WS-70-hvf4cd and find its TL-72-js2jg5 row, which is dropped at 0 of 12. The row must now read 'Dropped' while still showing 0/12. This is the check that closes the issue."
      - "On the same board, compare any non-dropped task-list row at 0 of N. It must be visually identical to before the change."
      - "Narrow the window to the smallest board column width, and toggle the light and the dark theme. The badge must stay on one line and stay legible in both."
    checklist:
      - "Does a dropped artefact row show the text 'Dropped' when 0 of N items are checked?"
      - "Does that row still show its progress bar and its done/total fraction?"
      - "Is every non-dropped artefact row unchanged, and is the plan branch at lines 296-301 untouched?"
      - "Is the class added with classList.add, leaving artefact-row in place?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 2.2 Fade the dropped row's bar and fraction in `src/public/styles.css`
    ```yaml
    description: "Add the two scoped .artefact-row.is-dropped rules so a dropped row reads as inactive."
    author: Anthony Koukoullis
    issues: [ISS-22-049ixu]
    implement:
      - "Open src/public/styles.css and read lines 485-489, the .artefact-row rules. Line 484 is .card-artefacts and line 490 is .dot-sm, so neither is part of this block."
      - "Add .artefact-row.is-dropped .a-bar span, which fades the filled segment. Add .artefact-row.is-dropped .a-frac, which fades the fraction text. Use the existing --ink-faint and --st-dropped tokens or an opacity value; introduce no new colour token."
      - "Place both rules directly after line 489, inside the same .artefact-row block."
      - "Scope both selectors to .artefact-row.is-dropped exactly as written. Never write a bare .is-dropped rule."
      - "Do NOT edit lines 487-489 themselves. These are additions only."
    pattern: "src/public/styles.css — two new rules after .artefact-row .a-frac at line 489."
    imports: "None."
    compatibility: "--st-dropped and --st-dropped-bg are defined in both palette blocks, at lines 65 and 72 for light and lines 127 and 134 for dark, so a single theme toggle proves both."
    gotcha: "Line 460 is the unscoped .is-dropped .card-title selector. An unscoped .is-dropped rule added here would apply inside the modal as well as on the card. Both new selectors must carry the .artefact-row element class. Note also that the bar fade cannot show on the case ISS-22-049ixu describes: at 0 of N the filled segment has zero width, so the .a-bar span rule paints nothing. Both dropped lists in this repository sit at 0 of N. The faded fraction and task 2.1's badge carry the cue there, and the bar fade shows only on a dropped list that has at least one checked item."
    verify:
      - "npm run build"
      - "grep -c '^\\.is-dropped' src/public/styles.css returns 1 — still only the pre-existing line 460 rule."
      - "grep -n 'artefact-row.is-dropped' src/public/styles.css returns exactly two lines."
      - "In the running app, the dropped row's fraction reads as faded, and no modal element changed appearance. Expect no visible bar change on WS-70-hvf4cd or WS-64-gdxh7m, because both dropped rows are at 0 of N and the filled segment has zero width."
    checklist:
      - "Are both new selectors scoped with the .artefact-row element class?"
      - "Does the unscoped .is-dropped count in the file stay at 1?"
      - "Is every existing .artefact-row rule unchanged?"
      - "Do both new rules use only tokens the palette already defines?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 3 — modal section headers

  ```yaml
  description: "Apply call site 2. A dropped plan, issue list or task list shows the badge and a struck title in its modal section header, on all three tabs at once."
  ```

  - [x] 3.1 Badge the dropped section header in `src/public/app.ts`
    ```yaml
    description: "In buildSection, mark a dropped artefact's section and append the shared badge to its head."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/app.ts and read buildSection at lines 621-628. It already receives the whole PraxisDetailArtefact, so artefact.status is in hand and no new argument and no new payload field is needed."
      - "After the ws-section-title h3 is appended at line 625: when artefact.status === 'dropped', add the class is-dropped to the sec element with classList.add, and append statusBadge('dropped') to head."
      - "Change nothing else in the function. A non-dropped section must produce byte-identical DOM."
      - "Add no argument to buildSection and change no caller. renderPlanPanel at line 816, renderIssuesPanel at line 831 and renderTasksPanel at line 893 all call it already, so all three tabs are served by this one edit."
    pattern: "src/public/app.ts — buildSection at lines 621-628."
    imports: "None. statusBadge comes from task 1.1."
    compatibility: "PraxisDetailArtefact.status is declared at src/types/praxis-data.d.ts line 71 as a plain string. src/lib/detail.ts line 255 writes it as str(fm.status), which passes the frontmatter value through UNCHANGED — the str helper at line 174 only narrows string | string[] to a string, joining an array with ', ' and returning '' for undefined, and it does NOT lower-case. extract.ts lower-cases only the per-item issue status and severity, at lines 179-180, and the detail path runs no equivalent. The new === 'dropped' test therefore relies on the lower-case status the frontmatter convention writes, exactly as task 2.1's board-side test does. A file written as 'Dropped' does NOT match, and that is accepted here, so no toLowerCase call is added. No type change and no payload change is needed."
    gotcha: "buildSection serves plans, issue lists and task lists. Do not add any artefact-type test inside it — the plan requires the badge on all three."
    verify:
      - "npm run build"
      - "npm start, then open the WS-64-gdxh7m card. Its Tasks tab section header for TL-65-yjm7as shows 'Dropped' and a struck title."
      - "Open the WS-70-hvf4cd card. Its Plan tab holds two dropped plans, PLN-59-pbg3pk and PLN-61-7f18vq, and both must show the badge."
      - "Check any non-dropped section header on the same cards. It must be unchanged."
    checklist:
      - "Does a dropped plan, issue list and task list each show 'Dropped' in its section header?"
      - "Is a section header for any other status visually unchanged?"
      - "Was buildSection's signature left alone and no caller edited?"
      - "Is the class added with classList.add, leaving ws-section in place?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 3.2 Strike the dropped section title in `src/public/styles.css`
    ```yaml
    description: "Add the one scoped .ws-section.is-dropped rule, matching the card's existing dropped-title treatment."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/styles.css and read .ws-section-title at lines 963-970, and the existing card treatment at line 460."
      - "Add .ws-section.is-dropped .ws-section-title with text-decoration: line-through and text-decoration-color: var(--ink-faint), matching line 460 so one visual language covers the card and the modal."
      - "Place the rule directly after the .ws-section-title block at line 970."
      - "Scope the selector to .ws-section.is-dropped exactly as written. Never write a bare .is-dropped rule."
      - "Do NOT edit line 460 and do NOT edit the .ws-section-title block."
    pattern: "src/public/styles.css — one new rule after .ws-section-title at line 970."
    imports: "None."
    compatibility: "--ink-faint is defined in both palette blocks, so no dark-block twin rule is needed."
    gotcha: "Without the .ws-section element class this rule collides with the unscoped .is-dropped .card-title selector at line 460 and leaks across surfaces."
    verify:
      - "npm run build"
      - "grep -c '^\\.is-dropped' src/public/styles.css returns 1."
      - "grep -n 'ws-section.is-dropped' src/public/styles.css returns exactly one line."
      - "In the running app, a dropped section title is struck through and a non-dropped one is not."
    checklist:
      - "Is the new selector scoped with the .ws-section element class?"
      - "Does the unscoped .is-dropped count in the file stay at 1?"
      - "Does the struck treatment match line 460's decoration and colour?"
      - "Is every existing rule unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 4. Phase 4 — issue item status

  ```yaml
  description: "Promote the issue item status to a typed field, then apply call site 3 so a dropped issue row shows the badge and a dropped-coloured check mark. The type lands before the reader, and the reader before the browser."
  ```

  - [x] 4.1 Add `status` to `PraxisIssueDetail` in `src/types/praxis-data.d.ts`
    ```yaml
    description: "Declare the contract first. One new required string field on the issue detail interface."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/types/praxis-data.d.ts and read the PraxisIssueDetail interface at lines 75-80."
      - "Apply this block. It is small, mechanical and targets one unambiguous location:"
      - |
        src/types/praxis-data.d.ts
        <<<<<<< SEARCH
        interface PraxisIssueDetail {
          id: string;       // ISS-1
          title: string;
          checked: boolean;
          fields: Record<string, PraxisYamlValue>;   // {} when the item has no yaml fence
        }
        =======
        interface PraxisIssueDetail {
          id: string;       // ISS-1
          title: string;
          checked: boolean;
          status: string;   // per-item YAML status, '' when the item has no fence
          fields: Record<string, PraxisYamlValue>;   // {} when the item has no yaml fence
        }
        >>>>>>> REPLACE
      - "Do NOT change PraxisTaskDetail at lines 82-88. No per-task status data exists, and the plan forbids inventing one."
      - "Do NOT change PraxisDetailArtefact at lines 67-73."
    pattern: "src/types/praxis-data.d.ts — interface PraxisIssueDetail, lines 75-80."
    imports: "None. This is an ambient declaration file with no imports."
    compatibility: "The field is required, not optional, because the server and the browser compile and ship together from the same dist/. There is no version skew to absorb. The empty-string default follows the str() convention already used across the detail payload; the board payload's separate PraxisIssue.status stays string | null and is not touched."
    gotcha: "Adding a required field makes every construction site of PraxisIssueDetail a compile error until task 4.2 lands. That is intended — the two tasks land in one commit."
    verify:
      - "npm run build is expected to FAIL at this point, on the object literal in src/lib/detail.ts parseIssueItems, which task 4.2 fixes. Confirm the failure names that literal and nothing else."
      - "grep -n 'status' src/types/praxis-data.d.ts shows the new line inside PraxisIssueDetail and shows PraxisTaskDetail unchanged."
    checklist:
      - "Is status declared as a required string on PraxisIssueDetail?"
      - "Is PraxisTaskDetail unchanged?"
      - "Does the fields key survive alongside the new status key?"
      - "Is the only build error the object literal in parseIssueItems?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.2 Populate `status` in `parseIssueItems` in `src/lib/detail.ts`
    ```yaml
    description: "Read the per-item status out of the fence collectItems already attached, lower-case it, and default it to an empty string."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/lib/detail.ts and read parseIssueItems at lines 106-115. collectItems already attaches every fence key to entry.fields, so no parser change is needed."
      - "In the returned object literal, add a status property between checked and fields, so it mirrors the field order of the interface."
      - "Derive it from entry.fields.status: narrow with typeof entry.fields.status === 'string', lower-case it, and fall back to ''. PraxisYamlValue is a union of string, array and object, so the typeof narrowing is mandatory, not defensive."
      - "The lower-casing copies src/lib/extract.ts line 180, so a fence written as 'Dropped' still matches the browser's === 'dropped' test."
      - "Leave fields exactly as it is. The raw bag still feeds the expanded body's Status row through renderMap, and removing that row is out of scope."
      - "Do NOT change flatTasks at lines 119-129 and do NOT change collectItems."
    pattern: "src/lib/detail.ts — parseIssueItems, lines 106-115."
    imports: "None. entry.fields is already in scope from collectItems."
    compatibility: "This file runs on the Node side and is compiled by the root tsconfig pass. PraxisYamlValue is string | PraxisYamlValue[] | { [key: string]: PraxisYamlValue }, so a non-string fence value must fall through to ''. An issue item written before status was a required key therefore yields '' and renders exactly as it renders today."
    gotcha: "src/lib/detail.test.ts covers parseIssueItems. The plan verified it holds no deepStrictEqual on a whole item object, so an added field breaks nothing. Confirm that by running the compiled test rather than assuming it."
    verify:
      - "npm run build now passes, clearing the failure task 4.1 left."
      - "node --test dist/lib/detail.test.js passes with no failing case."
      - "grep -n 'status' src/lib/detail.ts shows the new property inside parseIssueItems and no change inside flatTasks."
    checklist:
      - "Is entry.fields.status narrowed with a typeof string test before use?"
      - "Is the value lower-cased, and does a missing or non-string value yield ''?"
      - "Is the fields key still returned unchanged alongside the new status?"
      - "Are flatTasks and collectItems untouched?"
      - "Do npm run build and node --test dist/lib/detail.test.js both pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.3 Badge the dropped issue row in `src/public/app.ts`
    ```yaml
    description: "Give buildItem an optional trailing status parameter, pass item.status from the Issues panel only, and badge a dropped row."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/app.ts and read buildItem at lines 631-640. It is shared by issues and by tasks, so it must not reach into an issue field itself."
      - "Add an OPTIONAL trailing parameter to the signature: status?: string, after the existing fields parameter. Illustrative, not literal: function buildItem(checked: boolean, id: string, title: string, fields: Record<string, PraxisYamlValue>, status?: string): HTMLElement"
      - "Inside buildItem, after the ws-item-title span is appended at line 636: when status === 'dropped', add the class is-dropped to the d details element with classList.add, and append statusBadge('dropped') to sum."
      - "In renderIssuesPanel, at the buildItem call on line 839, pass item.status as the fifth argument."
      - "Leave the three task-side call sites alone: line 876 inside buildTaskGroup and line 906 inside renderTasksPanel. They pass nothing, so status is undefined and the test is false. Acceptance criterion 8 requires task rows to be unchanged."
      - "Do NOT change buildTaskGroup at lines 852-882 in any other way."
    pattern: "src/public/app.ts — buildItem at lines 631-640, and the single call at line 839 in renderIssuesPanel."
    imports: "None. statusBadge comes from task 1.1, and item.status comes from task 4.1."
    compatibility: "The public tsconfig pass is noEmit and type-checks app.ts against praxis-data.d.ts, so both the new PraxisIssueDetail.status field and the new optional parameter are checked there. An optional trailing parameter keeps the three task call sites compiling with no edit."
    gotcha: "A stale cached app.js served against a fresh server reads undefined for item.status, so the === 'dropped' test is simply false and the row renders as it does today. That is degradation, not a crash, and needs no guard."
    verify:
      - "npm run build"
      - "grep -n 'buildItem(' src/public/app.ts returns four lines: the definition, the issues call now carrying item.status, and the two task calls still at four arguments."
      - "Manual fixture, per the plan's testing strategy: copy one workstream folder to this session's scratchpad directory, set one issue's fence to status: dropped with its checkbox as [x], register that copy as a project, and open its card. Do NOT edit any real file under flowcharge/workstreams/ for this."
      - "On that fixture, the dropped issue row shows 'Dropped', and its neighbouring rows stay green when done or hollow when not."
    checklist:
      - "Is the new status parameter optional and last in the signature?"
      - "Does only renderIssuesPanel pass it, with the two task call sites left at four arguments?"
      - "Does buildItem still read no issue-specific field of its own?"
      - "Are task rows in the Tasks tab visually unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```
  - [x] 4.4 Recolour the dropped issue check mark in `src/public/styles.css`
    ```yaml
    description: "Add the one scoped .ws-item.is-dropped rule that overrides the hard-coded done green on a dropped item's check mark."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/styles.css and read .ws-check at lines 986-989 and .ws-check.is-checked at line 990."
      - "Add .ws-item.is-dropped .ws-check.is-checked with color: var(--st-dropped). Its specificity is 0-4-0 against line 990's 0-2-0, so it wins with no !important."
      - "Place the rule directly after line 990."
      - "Do NOT add !important, and do NOT edit line 990 itself. A done issue's check mark must stay --st-done."
      - "Scope the selector to .ws-item.is-dropped exactly as written. Never write a bare .is-dropped rule."
    pattern: "src/public/styles.css — one new rule after .ws-check.is-checked at line 990."
    imports: "None."
    compatibility: "--st-dropped is defined at line 65 for light and line 127 for dark, so one theme toggle proves both. .ws-item is also carried by .ws-task-group at app.ts line 853, but no task path ever adds is-dropped, so a task group cannot match this rule."
    gotcha: "The override depends on specificity alone. Adding the rule ABOVE line 990 still wins on specificity, but keeping it below matches how the rest of this stylesheet is ordered and makes the override readable."
    verify:
      - "npm run build"
      - "grep -c '^\\.is-dropped' src/public/styles.css returns 1."
      - "grep -n 'ws-item.is-dropped' src/public/styles.css returns exactly one line, and grep -c '!important' on that line returns 0."
      - "On the task 4.3 scratchpad fixture, the dropped and checked issue row shows a dropped-coloured check mark, while a done row beside it stays green. Toggle the theme and confirm both colours follow."
    checklist:
      - "Is the new selector scoped with the .ws-item element class?"
      - "Is the override free of !important, and is line 990 unedited?"
      - "Does a done issue row's check mark stay --st-done?"
      - "Does the unscoped .is-dropped count in the file stay at 1?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 5. Phase 5 — replace the pill with the app's own dot-plus-word indicator

  ```yaml
  description: "The shipped badge is a coloured pill, but this app already shows a per-row status as a small coloured dot followed by the status word. Rework the one shared helper and its one CSS rule so all four status indicators on a page use the same mechanism."
  ```

  - [x] 5.1 Rebuild the shared helper as a dot plus a label in `src/public/app.ts`
    ```yaml
    description: "Rename statusBadge to statusIndicator and change what it builds: a wrapper span holding a dot-sm dot and the status word, mirroring the artefact row's plan branch."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/app.ts. Read statusBadge at lines 142-150, and read the pattern it must now copy: the plan branch of buildCard's artefact-row loop at lines 312-317. That branch builds el('span', 'dot-sm'), sets dot.style.background to 'var(--st-' + a.status + ')', appends it, then appends a span carrying the raw status word."
      - "Rename the function to statusIndicator, keeping the same signature and the same HTMLElement return type: function statusIndicator(status: string): HTMLElement."
      - "Replace the body. Build a wrapper with el('span', 'st-ind'). Build the dot with el('span', 'dot-sm') and set dot.style.background = 'var(--st-' + status + ')', copying line 314 exactly. Append the dot to the wrapper. Append el('span', 'st-ind-label', status) to the wrapper. Return the wrapper."
      - "Use the status argument itself as the label text. Do NOT use STATUS_LABEL[status]. This app prints the raw lower-case frontmatter word wherever a status sits beside content: the plan branch at line 316 and #ws-modal-status at line 953. STATUS_LABEL stays where it belongs, on the column heads at line 454 and the KPI chips at line 1292."
      - "Do not set style.color on the wrapper or the label. The dot carries the status colour, and the label colour comes from the stylesheet, exactly as the plan branch works today."
      - "Update the comment above the function: it now builds a dot and the status word, it still knows nothing about WHEN a status deserves one, and it still names no specific status."
      - "Update the three call sites to the new name and nothing else: line 310 in buildCard, line 644 in buildSection, line 659 in buildItem. Each keeps its single appendChild, because the helper still returns one element."
      - "Do NOT change any classList.add('is-dropped') call, any === 'dropped' test, or the order in which anything is appended. Only the helper's output shape and its name change."
      - "Do NOT touch the plan branch at lines 312-317, the KPI chip at lines 1285-1292, or the STATUS_LABEL map at line 15."
    pattern: "src/public/app.ts — statusBadge at lines 142-150, and the three calls at lines 310, 644 and 659."
    imports: "No new import. Uses the existing el() helper, already in scope inside the IIFE. STATUS_LABEL is no longer read by this helper, but stays in use elsewhere in the file."
    compatibility: "The file is ES5-flavoured TypeScript: var declarations, function expressions, string concatenation instead of template literals. Match it. The public tsconfig pass is noEmit and type-checks app.ts against src/types/praxis-data.d.ts; the signature and the return type are unchanged, so no call site's types move."
    gotcha: ".dot-sm at styles.css line 506 sets width, height, border-radius and flex, but NO display. An empty inline span ignores width and height, so the dot only becomes a circle when its parent is a flex container. .artefact-row and .ws-section-head are flex, but .ws-item-summary at styles.css line 995 is display: list-item. That is why this helper must return a wrapper element that is itself a flex container, and not a DocumentFragment of two siblings — a fragment would work on the card and in the section head and collapse to nothing in the issue row."
    verify:
      - "npm run build"
      - "grep -n 'function statusIndicator' src/public/app.ts returns exactly one line."
      - "grep -c 'statusBadge' src/public/app.ts returns 0."
      - "grep -c 'st-badge' src/public/app.ts returns 0."
      - "grep -n 'statusIndicator(' src/public/app.ts returns four lines: the definition and the three call sites."
      - "grep -n 'STATUS_LABEL' src/public/app.ts still returns the declaration at line 15, the column head at line 454, and the two KPI lines near 1285-1292, and returns no line inside statusIndicator."
      - "npm start, then open this repository's own board. The WS-64-gdxh7m card's TL-65-yjm7as row and the WS-70-hvf4cd card's TL-72-js2jg5 row each show a dot and the word 'dropped', and each still shows its 0/3 and 0/12 fraction. Compare each with the plan row on the same card: the two must look like the same thing."
      - "Open the WS-70-hvf4cd card. Its Plan tab section headers for PLN-59-pbg3pk and PLN-61-7f18vq both show the dot and the word, and both titles stay struck through."
      - "Open the WS-64-gdxh7m card's Tasks tab. The TL-65-yjm7as section header shows the dot and the word. Every non-dropped section header is unchanged, and every task row is unchanged."
      - "Toggle the light theme and the dark theme on both cards. The dot follows --st-dropped in both, and the label stays legible in both."
    checklist:
      - "Does statusIndicator return one wrapper span holding a dot-sm dot and a label span?"
      - "Does the dot take its colour inline from var(--st-<status>), exactly as line 314 does?"
      - "Is the label the raw status argument, with no STATUS_LABEL lookup left in the helper?"
      - "Do all three call sites still append one element, with their is-dropped logic untouched?"
      - "Are the plan branch, the KPI chip and STATUS_LABEL itself unchanged?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
      notes: "Build passed. All greps returned the stated counts. Verified in the browser on this repository's own board: the WS-70-hvf4cd card now shows PLN-59, PLN-61 and TL-72 with the same dot and the same lower-case word 'dropped', and TL-72 keeps its 0/12; the WS-64-gdxh7m card shows TL-65 at 0/3 with the same pair. Section headers verified on the WS-70-hvf4cd Plan tab (PLN-59, PLN-61) and Tasks tab (TL-72), and on the WS-64-gdxh7m Tasks tab (TL-65); non-dropped headers and all task rows were unchanged. Light and dark both correct: the dot reads #8A7E93 light and #B3A6C2 dark."
    ```
  - [x] 5.2 Replace `.st-badge` with the indicator rules in `src/public/styles.css`
    ```yaml
    description: "Retire the pill rule and add the three rules the dot-plus-word wrapper needs. The dot itself reuses the existing .dot-sm rule untouched."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/styles.css. Read .st-badge with its comment at lines 484-494, .artefact-row .a-frac at line 500, and .dot-sm at line 506."
      - "Delete the .st-badge rule and its two-line comment at lines 484-494. Nothing else in either file references the class after task 5.1."
      - "In the same place, add .st-ind with: display inline-flex, align-items center, gap 6px, flex-shrink 0, white-space nowrap. The 6px gap is the gap .artefact-row already sets at line 496, so on the card the new dot-to-word spacing matches the plan row exactly."
      - "Add .st-ind-label with font-family var(--font-mono) and color var(--ink-faint), copying .artefact-row .a-frac at line 500, which is the rule the plan row's status word already uses."
      - "Do NOT set a font-size on .st-ind-label. The label inherits its context, so it sits at 10.8px on a card row beside the fraction, and at the modal's own size in a section head or an item summary."
      - "Do NOT set a background or a color on .st-ind or on the dot. The dot colour arrives inline from statusIndicator."
      - "Write a short comment above the pair, stating that the dot is the shared .dot-sm rule and that the wrapper exists so the dot gets a flex parent even inside the list-item .ws-item-summary."
      - "Add .ws-item-summary .st-ind with margin-left: 6px. .artefact-row and .ws-section-head are flex and space the indicator with their own gap, but .ws-item-summary at line 995 is display: list-item and has none, so without this the indicator touches the item title. This copies how .ws-item-id at line 1009 already carries its own margin."
      - "Do NOT edit .dot-sm, .tag, .blocked-pill, .artefact-row .a-frac, .ws-item-summary itself, or any .is-dropped rule. Only the .st-badge block is removed and only the three new rules are added."
    pattern: "src/public/styles.css — the .st-badge block at lines 484-494, replaced in place. All three new rules stay together there, including the .ws-item-summary-scoped one, because their subject is the indicator."
    imports: "None. Plain CSS, no preprocessor in this project."
    compatibility: "--ink-faint and --st-dropped are both defined in the light palette block and the dark palette block, so one theme toggle proves both. No new token is introduced."
    gotcha: "Never write a bare .is-dropped rule here. Line 460 already holds an UNSCOPED .is-dropped .card-title selector. This task adds no .is-dropped rule at all, so the file's unscoped count must still be 1 when it is done."
    verify:
      - "npm run build"
      - "grep -c 'st-badge' src/public/styles.css returns 0, and grep -rc 'st-badge' across src/ returns 0."
      - "grep -n '^\\.st-ind' src/public/styles.css returns exactly two lines, and grep -n 'ws-item-summary .st-ind' returns exactly one more."
      - "grep -c '^\\.is-dropped' src/public/styles.css returns 1."
      - "In the running app, the dot is a 6px circle on all three surfaces: the board card row, the modal section head, and a dropped issue row's summary. It must not collapse to nothing anywhere."
      - "In the running app, the label is muted mono text on all three surfaces, and no pill background is left anywhere."
      - "In the running app, the indicator is spaced away from its neighbour on all three surfaces, the item summary included."
    checklist:
      - "Is .st-badge gone from the stylesheet and unreferenced anywhere in src/?"
      - "Do .st-ind and .st-ind-label exist, with no color or background on the wrapper?"
      - "Is .dot-sm byte-for-byte unchanged, and are .tag, .blocked-pill and every .artefact-row rule unchanged?"
      - "Does the unscoped .is-dropped count in the file stay at 1?"
      - "Does the dot render as a circle inside the list-item .ws-item-summary, and is the indicator spaced away from the item title?"
      - "Does npm run build pass?"
    self_eval:
      passed: true
      failures: []
      notes: "Build passed and every grep returned the stated count, with the unscoped .is-dropped count still 1. One real defect was found by eye during verification and fixed inside this task: the indicator touched the item title in .ws-item-summary, because that element is display: list-item and supplies no flex gap. The .ws-item-summary .st-ind margin rule was added for it, and the implement steps above record it. The item-summary surface has no live fixture in this repository, so it was verified on a throwaway copy of this workstream carrying one extra dropped issue item, served by a second server run with PRAXIS_DATA_DIR pointed at the session scratchpad; the real project registry was never touched, and the copy was deleted afterwards. On that fixture the dot rendered as a 6px circle inside the summary, the dropped row's check mark took --st-dropped, and the done row beside it stayed --st-done, in both themes."
    ```

## Open questions carried forward

These four questions belong to PLN-64-umu2n5 and stay open. This list authors no
task for any of them, and nothing above depends on an answer.

1. Should individual tasks get a dropped state at all? No per-task status data
   exists in any file in this project, so it cannot be built here. The plan
   builds its recommendation (a): tasks have no dropped state, and the dropped
   section header from Phase 3 carries the signal instead.
2. Should task rows inside a dropped task list be dimmed? Not built. It implies
   a per-task state that does not exist.
3. Should the badge read "Dropped", or match the plan row's lower-case status
   word? CLOSED by Phase 5. Phases 1 to 4 read "Dropped" from STATUS_LABEL and
   accepted the case difference. Phase 5 makes the indicator the same dot and
   word the plan row uses, which puts the two side by side on one card, so the
   difference stopped being acceptable. The indicator now prints the raw
   lower-case status word, and STATUS_LABEL keeps the column heads and the KPI
   chips.
4. Should the KPI strip `.chip` builder be folded into statusIndicator? Deferred.
   The workstream brief puts the KPI strip out of scope, so the duplication is
   accepted knowingly.

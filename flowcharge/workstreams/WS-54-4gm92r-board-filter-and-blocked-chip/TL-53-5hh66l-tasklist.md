---
id: TL-53-5hh66l
type: tasklist
workstream: WS-54-4gm92r
slug: board-filter-and-blocked-chip
title: "Add a blocked-count KPI chip and a tag/blocked filter row to the board"
status: done
created: 2026-08-21
updated: 2026-08-21
author: Anthony Koukoullis
depends_on: [PLN-44-m70dil, TL-52-74z9f6]
links: []
mode: spec
base_commit: ab29357
---

# PRX Tasks

## Board filter and blocked chip

WS-53 (`TL-52-74z9f6`) removes the Blocked board column and replaces it with a per-card
badge driven by the optional `blocked` frontmatter key. That leaves two gaps this
workstream closes. First, a blocked workstream can now sit in any of five columns and no
aggregate count exists, so one small chip is appended to the existing Workstreams KPI
tile's chip row, shown only when the blocked count is above zero and coloured with
`--sev-critical` to match the card badge. Second, the board's only filter is one
free-text substring box, so a wrapped row of multi-select toggle chips is added inside the
existing `.controls` bar: one chip per selective tag derived from the project's own data,
one Blocked-only toggle, and one Clear control.

Three files change: `src/public/app.ts`, `src/public/board.html`, and
`src/public/styles.css`. No Node-side change is needed. `src/lib/extract.ts`,
`src/lib/detail.ts`, `src/server.ts`, `src/types/praxis-data.d.ts`, and
`electron/ipc-handlers.cts` stay untouched — both features read only
`PraxisWorkstream.tags`, already a required `string[]` on the payload, and
`PraxisWorkstream.blocked`, which WS-53 adds.

The four tasks follow the plan's four phases in order. Task 1 extracts the one shared
`isBlocked()` predicate and repoints WS-53's two inline copies at it. Task 2 appends the
blocked KPI chip. Task 3 adds the filter row's markup and styling, shipped `hidden` so it
is independently releasable. Task 4 adds the filter state, the tag derivation, the
signature-guarded chip rebuild, the one delegated listener, and the wiring.

Filter state is in-memory only — no URL parameter, no `localStorage`, no session restore.
The three tag-selection thresholds (count floor 2, share ceiling 30 percent, display cap
10) ship as plain constants and are not made configurable. The `Blocked only` toggle
carries no count in its label. The active-fill contrast treatment matches
`.seg button.active` exactly and no colour value is changed. The blocked KPI chip is
inert — no listener, no `role`, no `tabIndex`. `matches()` is never edited, and the
blocked reason never joins the free-text haystack.

Execution is gated on `TL-52-74z9f6` reaching `status: done`. Every anchor in this file
was read at `ab29357`, which predates both WS-52 and WS-53 — see the `Divergences`
section for what each anchor is expected to look like once they land.

- [x] 1. Extract the shared `isBlocked()` helper and repoint WS-53's two inline checks
  ```yaml
  description: "Add one isBlocked() predicate beside matches() in src/public/app.ts and repoint the buildCard and renderModalMeta blocked checks at it, changing no rendered output."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Open src/public/app.ts and find matches(), which begins at line 83 at authoring time and sits with the file's other small predicate helpers (wsIdNum, severityCmp, dominantSeverity). This is where the new helper belongs."
    - "Add exactly one function beside matches() that answers whether a workstream is blocked. It reads only w.blocked and knows nothing about cards, modals, chips or filters. Illustrative, not literal: function isBlocked(w: PraxisWorkstream): boolean { return !!(w.blocked || '').trim(); }"
    - "Find buildCard, which begins at line 181 at authoring time. After TL-52-74z9f6 lands, its task 3.2 has inserted a blocked pill row between the card-top append and the card-title append, holding a trimmed local, an if branch on that local, and a pill.title assignment carrying the trimmed reason (see Divergence 1)."
    - "Find renderModalMeta, which begins at line 786 at authoring time. After TL-52-74z9f6 lands, its task 4.3 has added a trimmed local, a wrapper hidden toggle, and a textContent write of the trimmed reason."
    - "Repoint both call sites so the file holds exactly ONE occurrence of the literal expression (w.blocked || '').trim(), and that occurrence is inside the new helper. Both sites still need the trimmed reason TEXT, not only the boolean (see Divergence 2), so only the truth test moves."
    - "Option A: keep a local for the reason text written in a form other than the literal expression — for example a ternary on w.blocked, or String(w.blocked).trim() inside a branch already guarded by isBlocked(w) — and branch on isBlocked(w)."
    - "Option B: trim once into a local and branch on that local, leaving isBlocked() with the KPI chip and the filter row as its callers. The plan accepts either, provided the single-occurrence rule above holds."
    - "Keep the helper a plain function declaration inside the existing IIFE. Do not create a shared module and do not add an import — this file compiles as a classic script, which the WS_ID_TAIL comment at line 13 already documents."
    - "Change nothing else. matches() is not edited, no markup and no CSS is added, and the rendered card pill and modal reason line must be byte-identical to WS-53's output."
  pattern: "src/public/app.ts only — the new helper beside matches(), plus the two WS-53 call sites inside buildCard and renderModalMeta. No other file is touched."
  imports: "None. PraxisWorkstream is ambient from src/types/praxis-data.d.ts, which is a global declaration file with no imports; its optional blocked?: string key arrives with TL-52-74z9f6 task 2.1."
  compatibility: "src/public/app.ts compiles under src/public/tsconfig.json as a classic script with DOM libs and no Node types. Declare the helper with the same var/function style the surrounding code uses. Presence semantics only — a reason of \"false\" or \"no\" is an ordinary string and marks the workstream blocked, so add no boolean coercion. Absent, empty and whitespace-only must all remain false."
  gotcha: "This task is a pure refactor and must change no pixel. The single-occurrence rule of acceptance criterion 1 applies to the whole file, so a second literal (w.blocked || '').trim() left behind in buildCard fails the task even though it compiles and renders correctly. Do not narrow with a non-null assertion that would break under a future strict setting without checking the file's own tsconfig first. Do not add blocked to the matches() haystack. If the two WS-53 call sites are absent when this task runs, TL-52-74z9f6 has not executed and this task must not proceed — the dependency gate exists for exactly that case."
  verify:
    - "npm run build compiles clean across all three TypeScript projects."
    - "grep -c \"(w.blocked || '').trim()\" src/public/app.ts returns 1."
    - "grep -n 'function isBlocked' src/public/app.ts returns exactly one line."
    - "With a temporary blocked value on one local workstream record, the card pill and the modal reason line render exactly as they did before this task. Set the value to whitespace only and confirm neither appears. Revert the record afterwards."
    - "git diff -- src/public/app.ts touches only the helper and the two call sites, and git diff --name-only lists src/public/app.ts and nothing else."
  checklist:
    - "Does the file declare exactly one function that answers whether a workstream is blocked?"
    - "Does the literal expression (w.blocked || '').trim() appear exactly once in src/public/app.ts, inside that helper?"
    - "Do the card pill and the modal reason line render identically to WS-53's output for present, absent, empty and whitespace-only values?"
    - "Is matches() completely unedited?"
    - "Were src/public/board.html, src/public/styles.css and every Node-side file left untouched?"
    - "Was the helper added as a plain local function, with no new module, import or build-config change?"
  self_eval:
    passed: true
    failures: []
  ```

- [x] 2. Append the blocked KPI chip to the Workstreams tile
  ```yaml
  description: "Append one conditional, inert, crimson blocked-count chip to the Workstreams KPI chip row inside renderKpis in src/public/app.ts."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Open src/public/app.ts and find the renderKpis IIFE, which begins at line 1028 at authoring time inside applyData."
    - "Locate the STATUS_ORDER loop that fills chips1 (lines 1050 to 1056 at authoring time) and the k1.appendChild(chips1); statement immediately after it at line 1057. After TL-52-74z9f6 lands, that loop iterates five statuses rather than six, because its task 1.1 removes the blocked entry from STATUS_ORDER (see Divergence 1)."
    - "Between the close of that loop and k1.appendChild(chips1), count the blocked workstreams with the task 1 helper — workstreams.filter(isBlocked).length — and append one further chip to chips1 ONLY when the count is above zero."
    - "Build the chip with the existing el() helper as a span carrying the chip class, with text naming the count, for example 'Blocked ' + blockedCount. Do not add a new CSS rule: .chip at src/public/styles.css line 232 already supplies the shape and .kpi .kpi-chips at line 231 already wraps."
    - "Colour it by copying the two style assignments from the Open-issues severity chips at lines 1072 and 1073, substituting the literal critical for the loop variable — background color-mix(in srgb, var(--sev-critical) 16%, var(--paper-raised)) and color var(--sev-critical). Use no --st- custom property anywhere in this chip."
    - "Set a native tooltip through the title PROPERTY, stating that the blocked count overlaps the status counts above rather than adding to them, because a blocked workstream also sits at one of the five statuses. A property assignment is never parsed as markup."
    - "Make the chip inert: bind no listener, set no role, set no tabIndex. Clicking it must do nothing and it must not be a tab stop."
    - "This is a pure addition. Do not edit wsByStatus, the KPI bar loop, the status chip loop, or any other tile. renderKpis must not read or write the filter state task 4 adds."
  pattern: "src/public/app.ts — the renderKpis IIFE only, and within it only the Workstreams tile's chip row. src/public/styles.css is not edited by this task."
  imports: "None. el(), workstreams and isBlocked() from task 1 are all already in scope."
  compatibility: "color-mix(in srgb, ...) is already used by the Open-issues severity chips in this same function, so it needs no fallback and no capability check. --sev-critical is defined in all four theme blocks of src/public/styles.css (lines 36, 81, 102 and 115 at authoring time), so the chip resolves in every theme with no new custom property. renderKpis runs inside applyData, which repaints the whole strip from scratch on every applied payload, so there is no hide branch and no stale-state path."
  gotcha: "Appending after k1.appendChild(chips1) would place the chip outside the chip row — it must go before that statement, so it lands last inside chips1. The chip row is often described as summing to the workstream total; that property is already false today for an unrelated reason, is asserted nowhere in this codebase, and is deliberately not restored — the tooltip states the overlap instead. Do not make the chip clickable: putting board-filter state inside renderKpis is a settled exclusion, not an oversight. Do not add a whole blocked KPI tile."
  verify:
    - "npm run build, which also re-runs tools/copy-assets.mjs and republishes the browser bundle."
    - "With no workstream blocked, the Workstreams chip row is identical to a pre-change screenshot and no extra chip appears."
    - "Add a blocked value to two local workstream records at two different statuses. The chip reads Blocked 2, sits last in the row, and is crimson rather than a --st- colour."
    - "Hover the chip. The overlap tooltip appears."
    - "Click the chip. Nothing happens — no filter applies, no modal opens, and no console error is logged."
    - "Tab through the KPI strip. The chip is not a tab stop."
    - "Cycle all four themes. The chip stays legible in each."
    - "git diff -- src/public/styles.css is empty for this task, and git diff -- src/public/app.ts shows only added lines inside renderKpis."
    - "Remove the temporary blocked values and confirm git status shows the flowcharge/ tree unmodified."
  checklist:
    - "Does the chip appear only when at least one workstream is blocked, and sit last in the Workstreams chip row?"
    - "Does the chip use var(--sev-critical) for its ink and a color-mix of the same colour for its fill, with no --st- property?"
    - "Is the chip inert — no listener, no role, no tabIndex, and not a tab stop?"
    - "Is the overlap tooltip set through the title property rather than any markup write?"
    - "Are the KPI bar segments, the status chips and every other tile unchanged?"
    - "Was src/public/styles.css left untouched by this task?"
  self_eval:
    passed: true
    failures: []
  ```

- [x] 3. Add the filter row markup and styling

  ```yaml
  description: "Ship the filter row's markup and CSS, hidden and inert, so the phase is independently releasable and the page looks exactly as it does today."
  ```

  - [x] 3.1 Add the `#filter-chips` block to the `.controls` bar in `src/public/board.html`
    ```yaml
    description: "Insert the hidden filter row as a further flex child of .controls, after .result-count, in src/public/board.html."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/board.html and find the .controls div, which spans lines 30 to 50 at authoring time and holds the Sort group, the search wrap, and the result count. Neither WS-52 nor WS-53 edits this block, so the anchor below is expected to be unchanged when this task runs."
      - |
        src/public/board.html
        <<<<<<< SEARCH
          <div class="result-count" id="result-count"></div>
        </div>
        =======
          <div class="result-count" id="result-count"></div>
          <div class="filter-chips" id="filter-chips" hidden>
            <label>Filter</label>
            <span id="filter-tags"></span>
            <button type="button" id="filter-blocked" class="blocked-toggle">Blocked only</button>
            <button type="button" id="filter-clear" class="filter-clear">Clear</button>
          </div>
        </div>
        >>>>>>> REPLACE
      - "Ship it with the hidden attribute already set. The row stays inert until task 4 clears the attribute at init, which is the same hidden-until-wired pattern #branch-line already uses at line 23."
      - "Do not add a second controls bar and do not move the block outside .controls. .controls is position: sticky; top: 0, and a second sticky sibling at the same offset would overlap it on scroll."
      - "Leave the Sort group, the search wrap and the result count exactly where they are. Add no count to the Blocked only label."
    pattern: "src/public/board.html — the .controls block only. The masthead, the KPI strip, the board, the lower panels and the whole #ws-modal dialog stay as they are."
    imports: "None. No new script tag and no new stylesheet link is added."
    compatibility: ".controls is already display: flex with flex-wrap: wrap, so a child given flex-basis: 100% by task 3.2 wraps onto its own second line inside the same sticky bar. The bare <label> reuses the existing .controls label rule, the same uppercase mono treatment the Sort label at line 32 already has. Both buttons carry type=\"button\" so neither can submit anything."
    gotcha: "The tag chips must live in their own <span id=\"filter-tags\"> — task 4's rebuild replaces that container's children and must never touch the blocked toggle or the Clear button, which are static and must keep their identity and their active state across rebuilds. Removing the hidden attribute in this task would ship a visibly broken, unwired row. styles.css and board.html are copied into dist/ by tools/copy-assets.mjs during npm run build, so an unbuilt change will not appear in the browser."
    verify:
      - "npm run build, so tools/copy-assets.mjs republishes board.html."
      - "grep -n 'filter-chips' src/public/board.html returns one line, inside the .controls block, and grep -n 'filter-chips' dist/public/board.html confirms the built copy carries it."
      - "Reload the board. The page looks exactly as it does today — the row is hidden and occupies no space, and the sort controls, the search box and the result count are in their existing positions."
      - "git diff -- src/public/board.html is purely additive and touches only the .controls block."
    checklist:
      - "Is the block a child of .controls rather than a sibling bar?"
      - "Does it ship with the hidden attribute set, so the page is visually unchanged?"
      - "Does it hold a Filter label, an empty #filter-tags span, the #filter-blocked toggle, and the #filter-clear control, in that order?"
      - "Is the Blocked only label plain, with no count suffix?"
      - "Do both buttons carry type=\"button\"?"
      - "Were the sort controls, the search box and the result count left in their existing positions?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 3.2 Add the `.filter-chips` rules and extend the focus-visible rule in `src/public/styles.css`
    ```yaml
    description: "Add the filter row's styling beside .seg in the Controls section, and extend the one shared focus-visible rule to cover the new buttons."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/styles.css and find the Controls section. At authoring time .controls begins at line 241 with position: sticky at line 250, .seg is at line 262, .seg button spans lines 263 to 271, .seg button.active is at line 274, and the shared focus-visible rule is at line 276. Neither WS-52 nor WS-53 edits this section, so these anchors are expected to be unchanged when this task runs."
      - "Add a .controls .filter-chips rule after the .seg rules: flex-basis: 100% so it wraps onto its own second line inside the sticky bar, plus display: flex, flex-wrap: wrap, align-items: center, and a small gap."
      - "Add a .controls .filter-chips #filter-tags rule with display: contents, so the chips participate in the parent's flex wrap directly and a long tag list wraps chip by chip rather than as one unbreakable block."
      - "Add a .filter-chips button rule: 1px solid var(--line-strong) border, var(--paper-raised) background, var(--ink-soft) colour, border-radius 999px, cursor pointer, and the padding and font-size copied deliberately from .seg button at lines 267 and 268 so the new control reads as the same family as the sort controls."
      - "Add a .filter-chips button:hover rule with a var(--paper-sunken) background, matching .seg button:hover at line 273."
      - "Add a .filter-chips button.active rule with a solid var(--accent) fill, #fff text and a matching border colour — the same treatment .seg button.active already uses at line 274."
      - "Add a .filter-chips button.blocked-toggle.active rule with a solid var(--sev-critical) fill, #fff text and a matching border colour, so the blocked axis reads as crimson and the tag axis as accent teal."
      - |
        src/public/styles.css
        <<<<<<< SEARCH
        .seg button:focus-visible, input:focus-visible, .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        =======
        .seg button:focus-visible, .filter-chips button:focus-visible, input:focus-visible, .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        >>>>>>> REPLACE
      - "That one line is the ONLY non-additive edit in this workstream. Every other change here appends a new rule."
      - "Do not reuse or widen .seg. It is display: inline-flex with overflow: hidden and border-right dividers, it does not wrap, and all three of its existing users are pick-one controls — eleven chips would clip and the pick-one appearance would misrepresent a multi-select OR."
      - "Add no overflow: hidden inside any .filter-chips rule. Add no new custom property and edit no theme block. Change no colour value: matching .seg button.active's existing contrast treatment is a settled decision."
    pattern: "src/public/styles.css — new rules in the Controls section beside .seg, plus the single focus-visible line. The theme blocks at lines 9, 53, 93 and 106, the .chip rule at line 232, and the .seg rules themselves are not edited."
    imports: "None. --line-strong, --paper-raised, --paper-sunken, --ink-soft, --accent and --sev-critical are all already defined."
    compatibility: "All six custom properties used here are defined in every one of the four theme blocks — :root at line 9, the prefers-color-scheme dark block at line 53, :root[data-theme=\"dark\"] at line 93, and :root[data-theme=\"light\"] at line 106 — so the row resolves in each with no per-theme rule. --st-blocked and --st-blocked-bg stay defined and unused by this task; .attn-row .a-days still consumes --st-blocked."
    gotcha: "flex-basis: 100% is what puts the row on its own line; without it the chips crowd in beside the result count. display: contents on #filter-tags is load-bearing for chip-by-chip wrapping — a plain span would wrap as one block. The focus-visible edit must extend the existing selector list rather than add a second rule, or the two rules will drift apart. styles.css is copied into dist/ by tools/copy-assets.mjs during npm run build, so an unbuilt change will not appear in the browser."
    verify:
      - "npm run build, so tools/copy-assets.mjs republishes styles.css."
      - "Temporarily remove the hidden attribute in the built page through devtools. The row appears on a second line inside the sticky bar, the bar still scrolls as one element, and no second sticky element overlaps it."
      - "Still in devtools, add ten dummy buttons to #filter-tags. They wrap onto further lines with no clipping and no horizontal overflow."
      - "git diff -- src/public/styles.css shows exactly one modified line — the focus-visible rule — and everything else added."
      - "grep -n 'overflow: hidden' src/public/styles.css shows no match inside any .filter-chips rule."
      - "grep -c 'st-blocked' src/public/styles.css is unchanged from its pre-task value, confirming no theme block was touched."
      - "Cycle all four themes with the row temporarily visible. The idle, hover and active states read correctly in each."
    checklist:
      - "Is the diff purely additive apart from the single focus-visible line?"
      - "Does .controls .filter-chips carry flex-basis: 100% and wrap inside the existing sticky bar rather than as a second sticky element?"
      - "Does #filter-tags use display: contents so chips wrap individually?"
      - "Does an active tag chip use a solid var(--accent) fill and an active blocked toggle a solid var(--sev-critical) fill?"
      - "Is there no overflow: hidden in any .filter-chips rule, and was .seg left unedited?"
      - "Were all four theme blocks and every custom property definition left unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 4. Add the filter state, the tag derivation, and the wiring
  ```yaml
  description: "Add the filter state, the ranked tag derivation with its prune, pin and signature guard, the single delegated listener, the combined render filter, and the corrected empty-column message, all in src/public/app.ts."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "STATE. Open src/public/app.ts and find the module-scope IIFE state block. At authoring time sortKey, sortDir and query sit at lines 23 to 25, and dependsOn, dependedBy, chainRoot and chainSet at lines 34 to 37. Beside sortKey/sortDir/query add activeTags as a Record<string, true> initialised to {} and blockedOnly as a boolean initialised to false. Beside dependsOn/dependedBy add filterTags, an array of { key, label, count }, and filterTagSig, a string or null initialised to null."
    - "Use a presence map for activeTags, not an array, so membership is one property read per card per render. This mirrors chainSet, already a Record<string, true> in this same file for the same reason. Do not add URL, query-string or localStorage persistence — the state is in-memory only, exactly like query."
    - "DERIVATION. Add a function that derives the displayed tag set from the workstreams array and nothing else. Walk workstreams; for each raw tag compute key = tag.trim().toLowerCase(); skip an empty key; count each key at most once per workstream; and record the FIRST raw form seen for a key as its display label."
    - "Keep a key whose count is at least 2 AND whose share of workstreams.length is below 0.30. Sort the kept keys by count descending, then by key ascending. Take the first 10. Write 2, 0.30 and 10 as plain literal constants — do not make them configurable and do not add an options object."
    - "PRUNE. Delete from activeTags any key that no longer appears anywhere in the data at all, mirroring the chainRoot safety already at lines 992 to 996, which clears a highlighted root that a poll dropped out of the data."
    - "PIN. Union the surviving activeTags keys back into the displayed set even when they fall outside the top 10 or below the count floor, appending them AFTER the ranked ten so the ordinary ranking is not disturbed. An active filter must never become unclearable."
    - "PLACEMENT. Run the derivation, the prune, the pin and the rebuild inside applyData, after buildDepIndex() at line 985 and before the renderBoard() call at line 1179 — NOT inside renderBoard, which runs on every keystroke in the search box and on every sort click. The comment at line 983 already states this split for the dependency graph."
    - "GUARD. Join the displayed keys into a signature string, compare it with filterTagSig, and rebuild the #filter-tags children ONLY on a mismatch, then store the new signature. On a match, touch no DOM at all — this is what stops a five-second poll replacing a chip under the pointer."
    - "CHIPS. Build each chip with the existing el() helper as a button carrying type=\"button\", its normalised key on data-tag, and its first-seen raw form as its text. Write no innerHTML content and never interpolate a tag into a selector."
    - "SYNC. Add syncFilterActive(), which toggles the active class on every button in #filter-chips from activeTags and blockedOnly. Call it after every chip rebuild and after every click, so a rebuilt chip for a still-active tag comes back active. Active state is a class refresh over existing buttons, never a rebuild."
    - "LISTENER. Bind exactly ONE delegated click listener on #filter-chips at init time, beside the existing #sort-key-seg and #sort-dir-seg listeners at lines 325 to 331. It resolves the nearest button, returns early on a miss, then clears both axes for #filter-clear, flips blockedOnly for #filter-blocked, toggles the data-tag key in activeTags for a chip, and returns for anything else. It ends by calling syncFilterActive() and renderBoard(). Bind no per-chip listener, at init or on any rebuild."
    - "TAG PREDICATE. Add tagMatch(w), returning true when no tag is active, and otherwise true when any of w.tags normalises to a key present in activeTags. That is the OR within the tag axis."
    - "RENDER FILTER. Extend the per-column filter at line 291 so the three axes combine with AND. Illustrative, not literal: byStatus[status].filter(function (w) { return matches(w, q) && tagMatch(w) && (!blockedOnly || isBlocked(w)); }). Use the isBlocked() helper from task 1."
    - "EMPTY COLUMN. Beside var q at line 275, compute an any-filter-active flag from q, blockedOnly and the size of activeTags. At line 314, replace the q condition in el('div', 'column-empty', q ? 'No matches' : 'Empty') with that flag, so a column emptied purely by a chip filter reads No matches rather than falsely claiming the project holds no work at that status."
    - "INIT. Clear the hidden attribute on #filter-chips once at init, so task 3's row becomes visible now that it is wired."
    - "BOUNDARIES. Do not edit matches() — the blocked reason and the filter state never join the free-text haystack. Do not let renderBoard derive the tag list or rebuild the chip row. Do not let renderKpis read or write activeTags or blockedOnly. Do not touch sortKey, sortDir, or any comparator. Do not add a count to the Blocked only label. Do not add status, severity, date or dependency filtering."
  pattern: "src/public/app.ts only — the state block, a new derivation and a new tagMatch helper, the applyData body, renderBoard's filter and empty-column line, and one new init-time listener. src/public/board.html and src/public/styles.css are not edited by this task."
  imports: "None. el(), byId(), workstreams, renderBoard() and isBlocked() from task 1 are all already in scope. No package is added."
  compatibility: "The file compiles as a classic script under src/public/tsconfig.json with DOM libs, so declare everything as plain vars and functions inside the existing IIFE and add no import or export. Element.closest and dataset are already used by the #board and #sort-key-seg listeners in this same file, so they need no shim. Tags reach the browser unnormalised — src/lib/extract.ts carries wsFm.tags verbatim into the payload with no trimming and no case folding — so normalisation is the browser's job and belongs nowhere else. Normalisation is trim plus lowercase only: no stemming, no singular/plural folding, no punctuation stripping."
  gotcha: "Deriving the tags inside renderBoard is the single mistake this design exists to avoid — renderBoard runs on every keystroke. Rebuilding the chip row on every applyData without the signature guard is the second: a poll can change for a reason unrelated to tags, such as an updated date, and tearing down ten buttons under the pointer every five seconds is a visible defect. The prune and the pin are two halves of one guarantee and must both ship — the prune alone can leave a board filtered by a tag that has no chip, and the pin alone can leave a stale key active forever. Rebuild only #filter-tags: replacing the whole #filter-chips subtree would destroy the static blocked toggle and Clear button and silently drop the delegated listener's targets. The Clear control must not clear the free-text search box and must not touch the sort controls. Clicking Clear with nothing active is a harmless no-op re-render, not an error path."
  verify:
    - "npm run build compiles clean across all three TypeScript projects."
    - "Open this repository's own board. The tag chips read exactly, in order: electron 10, bug 9, detail-modal 8, group1 7, server 7, ux 7, agentic-tools 6, board 6, filesystem 6, group2 5. feature (18, 36 percent) and ui (16, 32 percent) do not appear, and no tag carried by exactly one workstream appears."
    - "Click board. Only workstreams carrying the board tag remain and the N / M workstreams shown counter updates. Click it again and the full board returns."
    - "Click board and bug together. Workstreams carrying EITHER tag show."
    - "With board and bug active, type modal in the search box. Only cards satisfying both the tag OR and the text match remain."
    - "Click Blocked only with a tag still active. Only blocked workstreams carrying an active tag show. Confirm the toggle is visible and enabled even when nothing is blocked."
    - "Click Clear. Both chip axes reset, the chips lose their fills, and the search box keeps its text and keeps filtering. Click Clear again with nothing active: nothing changes and no error is logged."
    - "Activate a tag that empties one column. That column reads No matches, not Empty. Clear the filter and confirm a genuinely empty status column still reads Empty."
    - "With a tag chip active, hover a chip and wait through three poll cycles, over 15 seconds. The chip is not replaced, the hover state survives, and the active fill survives."
    - "Rename that tag out of every local workstream record. On the next poll the tag drops from both the chip row and the active set, and the board is not left showing nothing."
    - "Restore the tag on exactly one record so it falls below the count floor, having activated it before the change. Its chip stays pinned and clickable."
    - "Add a tag as ' Board ' on one record and as 'board' on another. One chip appears, its count includes both, and its label shows the first-seen raw form."
    - "Confirm the Blocked only toggle's active fill is crimson and the tag chips' active fill is the accent teal."
    - "Tab into the row. Every chip is a tab stop with a visible focus ring, and Enter toggles it."
    - "git diff -- src/public/app.ts | grep -c 'function matches' returns 0."
    - "Search for a tag not in the top ten, such as packaging. The free-text box still finds it."
    - "grep -c \"addEventListener\" on the new code confirms exactly one listener is bound for the whole filter row, and no listener is bound inside the chip rebuild."
    - "Remove every temporary blocked and tag edit and confirm git status shows the flowcharge/ tree unmodified."
  checklist:
    - "Does the derived chip set match the ten-tag acceptance table exactly, in that order, on this repository's own 50 records?"
    - "Do the tag axis, the blocked axis and the free-text search combine with AND, with OR inside the tag axis?"
    - "Does an unchanged poll leave the chip DOM completely untouched, preserving hover and focus?"
    - "Is exactly one delegated listener bound for the whole row, with no per-chip listener at init or on rebuild?"
    - "Does an active tag that vanishes from the data get pruned, and one that falls out of the top ten stay pinned and clickable?"
    - "Does a column emptied by any active filter read No matches while a genuinely empty status column still reads Empty?"
    - "Are matches(), the sort controls and every comparator completely unedited, and is renderKpis still free of any filter-state read?"
  self_eval:
    passed: true
    failures: []
  ```

## Divergences

1. **WS-52 and WS-53 have not executed.** The plan's assumption A1 describes `buildCard`, `renderModalMeta`, `renderKpis` and `STATUS_ORDER` as they read *after* `TL-52-74z9f6` applies its changes. As read at `ab29357`, `src/public/app.ts` still declares `blocked` in `STATUS_ORDER` at line 2 and in `STATUS_LABEL` at line 3, `src/types/praxis-data.d.ts` declares no `blocked` key, `buildCard` at lines 181 to 270 holds no blocked pill row, `renderModalMeta` at lines 786 to 814 holds no blocked line, and the board still renders a six-column layout including Blocked. `src/public/board.html` likewise holds no `#ws-modal-blocked` wrapper and no `#ws-modal-description` paragraph. The consequence is that tasks 1 and 2 are authored as prose against the expected post-WS-53 shape, with no SEARCH/REPLACE block for `src/public/app.ts`; the `depends_on: [PLN-44-m70dil, TL-52-74z9f6]` gate blocks execution until `TL-52-74z9f6` reaches `status: done`, and the executor reads the file fresh at that point. Tasks 3.1 and 3.2 are unaffected, because neither `TL-51-49a6fh` nor `TL-52-74z9f6` edits the `.controls` block of `src/public/board.html` or the Controls section of `src/public/styles.css`.

2. **`buildCard` needs the trimmed reason, not only the boolean.** The plan's Contract 1 names only `renderModalMeta` as still needing the trimmed *value*, and describes `buildCard` as a plain truth-test call site. `TL-52-74z9f6` task 3.2 in fact specifies that `buildCard` writes the trimmed reason to `pill.title`, so it needs the value too. The consequence is that task 1's `implement` applies the value-versus-boolean split to BOTH call sites, and acceptance criterion 1's single-occurrence rule is stated as a whole-file constraint covering both. No design change follows from this — the plan already permits either a differently written local trim or a trim-once-and-test-the-local form at a call site.

Every other anchor the plan cites was confirmed against the working tree at `ab29357`: `matches()` at line 83, the state block at lines 23 to 25, the derivation caches' neighbours at lines 34 to 35, the per-column filter at line 291, the empty-column line at line 314, the delegation rationale comment at line 853, the applyData split comment at line 983, the `chainRoot` safety at lines 992 to 996, the severity chip styling at lines 1072 to 1073, the `Sort` label at line 32 of `src/public/board.html`, and `.controls`' sticky positioning at lines 250 to 252, `.seg` at line 262, `.seg button.active` at line 274 and the shared `focus-visible` rule at line 276 of `src/public/styles.css`. The plan's acceptance criterion 11 was also re-derived from this repository's own 50 workstream records and reproduces the plan's table exactly, including the two ceiling exclusions and the 19 single-workstream tags.

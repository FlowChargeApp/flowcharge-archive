---
id: TL-13-6l7bz9
type: tasklist
workstream: WS-13-6ul85v
slug: detail-modal-tags-dates-severity
title: "Tags, dates and a severity dot for the workstream detail modal"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: [PLN-12-sx5vq3]
links: []
mode: spec
base_commit: 2f5cfa0
---

# PRX Tasks

## Tags, dates and a severity dot for the workstream detail modal

Implements PLN-12. Gives the workstream detail modal (`#ws-modal`,
`src/public/board.html:84-105`, populated by `openModal()`/`renderDetail()` in
`src/public/app.ts:425-468`) the same picture of a workstream its board card
already shows: tags, created/updated dates, and a dominant-severity dot — all
three already live in the client-side `workstreams` array and `sevMix` (module
scope), so this is a pure DOM/markup change with no server route, no wire-shape
change, and no new network round trip. The severity dot goes in the header next
to `#ws-modal-id`, styled and colored exactly like `buildCard()`'s own `idWrap`
dot (WS-9); tags and dates go in a new `.ws-modal-meta` section between
`.ws-modal-head` and `.ws-modal-tabs`, reusing the card's own `.card-tags`/`.tag`
classes verbatim. All three are set synchronously at modal-open time from the
already-loaded `workstreams`/`sevMix` data, before the `/detail` fetch resolves,
and do not live-refresh across a poll tick while the modal stays open. The plan
is small enough for one stage; this file mirrors that with one parent task and
one child per touched file, in the plan's own order, plus the plan's own
manual-verification child. Every anchor below was read fresh against the
repository at commit `2f5cfa0` and matches the plan's own line references
exactly — no divergence found.

- [x] 1. Stage 1 — Modal meta block
  ```yaml
  description: "Wrap the modal header's ID in a new row with a severity-dot placeholder and add a new tags/dates section to board.html, add the three scoped CSS rules, add renderModalMeta() and its call site in app.ts, then manually verify against live data, per PLN-12's single stage."
  ```

  - [x] 1.1 Markup: header row + new meta section
    ```yaml
    description: "Wrap #ws-modal-id in a new .ws-modal-id-row with a hidden #ws-modal-sev-dot placeholder, and insert the new #ws-modal-meta section (#ws-modal-tags, #ws-modal-dates) between .ws-modal-head and .ws-modal-tabs."
    issues: []
    implement:
      - "File: src/public/board.html. Anchor: the `<dialog id=\"ws-modal\">` block (current lines 84-105) — specifically `.ws-modal-headings` (lines 87-91) and the gap between `.ws-modal-head`'s closing `</div>` (line 93) and `.ws-modal-tabs` (line 95)."
      - "Inside `.ws-modal-headings`, wrap the existing `#ws-modal-id` span in a new `.ws-modal-id-row` div together with a new `#ws-modal-sev-dot` span (`class=\"dot-sm\"`, `hidden`, `aria-hidden=\"true\"`) placed immediately before it. `#ws-modal-id`'s own id/class/attributes are untouched — only its wrapper changes."
      - "Between `.ws-modal-head` and `.ws-modal-tabs`, insert a new `<div class=\"ws-modal-meta\" id=\"ws-modal-meta\">` containing `<div class=\"card-tags\" id=\"ws-modal-tags\" hidden></div>` and `<div class=\"ws-modal-dates\" id=\"ws-modal-dates\"></div>`, both empty/hidden until task 1.3 populates them."
      - |
        <<<<<<< SEARCH
              <div class="ws-modal-headings">
                <span id="ws-modal-id" class="ws-modal-id"></span>
                <h2 id="ws-modal-title" class="ws-modal-title"></h2>
                <span id="ws-modal-status" class="ws-modal-status"></span>
              </div>
              <button type="button" id="ws-modal-close" class="ws-modal-close" aria-label="Close">×</button>
            </div>

            <div class="ws-modal-tabs" id="ws-modal-tabs" role="tablist">
        =======
              <div class="ws-modal-headings">
                <div class="ws-modal-id-row">
                  <span id="ws-modal-sev-dot" class="dot-sm" hidden aria-hidden="true"></span>
                  <span id="ws-modal-id" class="ws-modal-id"></span>
                </div>
                <h2 id="ws-modal-title" class="ws-modal-title"></h2>
                <span id="ws-modal-status" class="ws-modal-status"></span>
              </div>
              <button type="button" id="ws-modal-close" class="ws-modal-close" aria-label="Close">×</button>
            </div>

            <div class="ws-modal-meta" id="ws-modal-meta">
              <div class="card-tags" id="ws-modal-tags" hidden></div>
              <div class="ws-modal-dates" id="ws-modal-dates"></div>
            </div>

            <div class="ws-modal-tabs" id="ws-modal-tabs" role="tablist">
        >>>>>>> REPLACE
    pattern: "src/public/board.html"
    imports: "None. `.dot-sm` and `.card-tags`/`.tag` already exist (styles.css) from WS-9; no new markup vocabulary."
    compatibility: "`#ws-modal-id`, `#ws-modal-title`, `#ws-modal-status`, `#ws-modal-tabs`, `#ws-panel-issues`, `#ws-panel-tasks` keep their exact ids/classes/attributes — renderDetail()/openModal()/selectTab() must keep working unmodified against this markup."
    gotcha: "The new elements carry `hidden` (tags, dot) or are simply empty (dates) so nothing is visible or affects layout until tasks 1.2-1.3 land — this task alone must be a no-op visually."
    verify:
      - "Reload the board and open a card's modal — layout is unchanged except for the (currently invisible, hidden) new elements; no console errors."
      - "grep -c 'id=\"ws-modal-meta\"' src/public/board.html — exactly 1."
    checklist:
      - "`#ws-modal-id` retains its exact id, class, and empty textContent — only its wrapper changed."
      - "`#ws-modal-sev-dot` carries `class=\"dot-sm\"`, `hidden`, and `aria-hidden=\"true\"`."
      - "`#ws-modal-tags` carries `class=\"card-tags\"` and `hidden`; `#ws-modal-dates` carries `class=\"ws-modal-dates\"` and is empty."
      - "`#ws-modal-meta` sits between `.ws-modal-head`'s closing tag and `.ws-modal-tabs`, not inside either."
      - "No other markup in the file (tabs, panels, close button) is altered."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 CSS: the three scoped rules
    ```yaml
    description: "Add .ws-modal-id-row, .ws-modal-meta (+ its .card-tags override), and .ws-modal-dates near the existing .ws-modal-* rules."
    issues: []
    implement:
      - "File: src/public/styles.css. Anchor: the existing `.ws-modal-*` rule block (current lines 576-658) — specifically right after `.ws-modal-headings` (line 592) for the id-row rule, and right after `.ws-modal-close:focus-visible` (line 624, just before the `.ws-modal-tabs` comment) for the meta/dates rules. Depends on task 1.1."
      - "Add `.ws-modal-id-row { display: flex; align-items: center; gap: 4px; }` immediately after `.ws-modal-headings`, mirroring `buildCard()`'s `idWrap` inline styles (app.ts:78-80) as a named class."
      - "Add `.ws-modal-meta` (flex column, `gap: 6px`, `padding: 12px 18px`, `border-bottom: 1px solid var(--line)`), a `.ws-modal-meta .card-tags { margin-bottom: 0; }` override (so `.ws-modal-meta`'s own `gap` isn't doubled by `.card-tags`'s `margin-bottom: 6px`, styles.css:337), and `.ws-modal-dates` (duplicating `.card-foot .updated`'s three declarations at styles.css:355 — mono font, `10px`, `var(--ink-faint)` — under this new, narrowly-scoped class rather than broadening that existing selector) immediately after `.ws-modal-close:focus-visible`."
      - |
        <<<<<<< SEARCH
        .ws-modal-headings { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .ws-modal-id {
        =======
        .ws-modal-headings { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .ws-modal-id-row { display: flex; align-items: center; gap: 4px; }
        .ws-modal-id {
        >>>>>>> REPLACE
    pattern: "src/public/styles.css"
    imports: "var(--line), var(--ink-faint), var(--font-mono) — all existing custom properties, no new tokens."
    compatibility: "`.ws-modal-meta .card-tags` overrides only `margin-bottom`; every other `.card-tags`/`.tag` declaration (styles.css:337-346) must pass through unchanged so tags render identically to the card. `.ws-modal-dates` is a new, separately-scoped class — `.card-foot .updated` (styles.css:355) itself must not be touched or widened."
    gotcha: "Two separate insertion points in the same file (id-row near line 592, meta/dates near line 624) — this task adds both via one block spanning that contiguous region, per the plan's own single 'CSS' task. Still nothing is visible after this task alone: the elements it styles remain `hidden`/empty until task 1.3."
    verify:
      - "Reload the board and open a modal — still nothing new visible (all content-bearing elements are empty/hidden until task 1.3)."
      - "npx tsc -p src/public/tsconfig.json --noEmit — CSS is untyped, but this confirms task 1.1's markup didn't regress the TS build."
    checklist:
      - "`.ws-modal-id-row` reads exactly `display: flex; align-items: center; gap: 4px;`."
      - "`.ws-modal-meta` has `display: flex; flex-direction: column; gap: 6px; padding: 12px 18px; border-bottom: 1px solid var(--line);`."
      - "`.ws-modal-meta .card-tags` sets only `margin-bottom: 0` — no other property overridden."
      - "`.ws-modal-dates` uses `var(--font-mono)`, `font-size: 10px`, `color: var(--ink-faint)` — matching `.card-foot .updated` verbatim."
      - "`.card-foot .updated` and the base `.card-tags`/`.tag` rules are byte-identical to before this task."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Logic: renderModalMeta() and its call site
    ```yaml
    description: "Add renderModalMeta() next to renderDetail()/openModal(), reading workstreams/sevMix synchronously, and call it as the first line of openModal()."
    issues: []
    implement:
      - "File: src/public/app.ts. Anchor: `renderDetail()` (current lines 425-437) and `openModal()` (current lines 439-468). Depends on tasks 1.1-1.2 (the DOM ids and CSS classes must already exist)."
      - "Add a new `renderModalMeta(w: PraxisWorkstream | undefined)` function between `renderDetail()` and `openModal()`. On `!w`: hide `#ws-modal-sev-dot` and remove its `title`, hide `#ws-modal-tags` (after clearing its `innerHTML`), clear `#ws-modal-dates` — then return. Otherwise: compute `dominantSeverity(sevMix![w.id])` and, when truthy, unhide the dot, set `.style.background = 'var(--sev-' + dominant + ')'` and `.title = SEV_LABEL[dominant] + ' severity (open issues)'` — byte-for-byte the same call and message `buildCard()` already makes (app.ts:81,85) — else hide it and remove its `title`; when `w.tags && w.tags.length`, clear then repopulate `#ws-modal-tags` with one `el('span', 'tag', t)` per tag and unhide it, else hide it; unconditionally set `#ws-modal-dates`'s textContent to `'created ' + fmtDate(w.created) + ' · updated ' + fmtDate(w.updated)`, matching the card footer's phrasing (app.ts:129 style — the tag/updated helpers already used by `buildCard()`)."
      - "Clear `#ws-modal-tags`'s `innerHTML` at the top of every branch (not only the `!w` branch) so a reopen never leaves a prior workstream's tag pills behind (criterion 7/idempotence) — the dot's `background`/`title` and the dates' `textContent` are likewise unconditionally overwritten, never conditionally patched, for the same reason."
      - "Add exactly one call, `renderModalMeta(workstreams.find(function (ws) { return ws.id === wsId; }));`, as the very first line of `openModal(wsId)` — before the existing `byId('ws-modal-id').textContent = wsId;` line — so tags/dates/severity render synchronously before the `/detail` fetch starts (criterion 5). Do not touch anything else in `openModal()` or `renderDetail()`: the fetch chain, `.catch`, tab reset, and panel population stay exactly as they are (criteria 6, 9)."
      - |
        <<<<<<< SEARCH
          function renderDetail(detail: PraxisWorkstreamDetail) {
            // textContent everywhere — every value here came out of a file.
            byId('ws-modal-id').textContent = detail.id;
            byId('ws-modal-title').textContent = detail.title;
            byId('ws-modal-status').textContent = detail.archived ? detail.status + ' · archived' : detail.status;

            var issueCount = 0;
            (detail.issueLists || []).forEach(function (l) { issueCount += l.items.length; });
            setTabLabels(issueCount, countTasks(detail.taskLists || []));

            renderIssuesPanel(detail.issueLists || []);
            renderTasksPanel(detail.taskLists || []);
          }

          function openModal(wsId: string) {
            byId('ws-modal-id').textContent = wsId;
        =======
          function renderDetail(detail: PraxisWorkstreamDetail) {
            // textContent everywhere — every value here came out of a file.
            byId('ws-modal-id').textContent = detail.id;
            byId('ws-modal-title').textContent = detail.title;
            byId('ws-modal-status').textContent = detail.archived ? detail.status + ' · archived' : detail.status;

            var issueCount = 0;
            (detail.issueLists || []).forEach(function (l) { issueCount += l.items.length; });
            setTabLabels(issueCount, countTasks(detail.taskLists || []));

            renderIssuesPanel(detail.issueLists || []);
            renderTasksPanel(detail.taskLists || []);
          }

          function renderModalMeta(w: PraxisWorkstream | undefined) {
            var sevDot = byId('ws-modal-sev-dot');
            var tagsEl = byId('ws-modal-tags');
            var datesEl = byId('ws-modal-dates');
            tagsEl.innerHTML = '';
            if (!w) {
              sevDot.hidden = true;
              sevDot.removeAttribute('title');
              tagsEl.hidden = true;
              datesEl.textContent = '';
              return;
            }
            var dominant = dominantSeverity(sevMix![w.id]);
            if (dominant) {
              sevDot.style.background = 'var(--sev-' + dominant + ')';
              sevDot.title = SEV_LABEL[dominant] + ' severity (open issues)';
              sevDot.hidden = false;
            } else {
              sevDot.hidden = true;
              sevDot.removeAttribute('title');
            }
            if (w.tags && w.tags.length) {
              w.tags.forEach(function (t) { tagsEl.appendChild(el('span', 'tag', t)); });
              tagsEl.hidden = false;
            } else {
              tagsEl.hidden = true;
            }
            datesEl.textContent = 'created ' + fmtDate(w.created) + ' · updated ' + fmtDate(w.updated);
          }

          function openModal(wsId: string) {
            renderModalMeta(workstreams.find(function (ws) { return ws.id === wsId; }));
            byId('ws-modal-id').textContent = wsId;
        >>>>>>> REPLACE
    pattern: "src/public/app.ts"
    imports: "dominantSeverity() (app.ts:54-57), SEV_LABEL (app.ts:5), fmtDate() (app.ts:26), el()/byId() (app.ts:19-25), sevMix/workstreams (module scope, app.ts:12,17) — all already exist, no new import, no new dependency."
    compatibility: "`PraxisWorkstreamDetail` and the `/detail` fetch chain (app.ts:452-467) are untouched — `renderModalMeta()` reads only the in-memory `workstreams`/`sevMix` structures, never `detail`. `renderDetail()` itself is not modified. Casts `sevDot`/`tagsEl` as `HTMLElement` consistently with `byId()`'s existing return type (no `as HTMLInputElement` or similar narrowing needed since only `.hidden`/`.title`/`.style`/`.innerHTML`/`.textContent` are used)."
    gotcha: "`sevDot.hidden`/`tagsEl.hidden` are DOM `HTMLElement.hidden` boolean properties, matching how `hidden` is already used elsewhere in this file (e.g. panelTasks toggling) — not a `.style.display` toggle. `workstreams.find(...)` can return `undefined` if called before the board's data has loaded; the `!w` branch handles that by hiding the whole block rather than assuming a match (Assumption 4), matching this file's existing defensive style even though no code path is designed to exercise it. Must not add the call inside `renderDetail()` or the fetch `.then`/`.catch` — it belongs only at the top of `openModal()`, so it fires before the network round trip, not gated behind it."
    verify:
      - "npx tsc -p tsconfig.json --noEmit"
      - "npx tsc -p src/public/tsconfig.json --noEmit"
      - "npm run build"
      - "grep -E \"^\\s*(import|export)\\s\" dist/public/app.js — must return no matches, confirming app.js remains a classic script."
    checklist:
      - "renderModalMeta() is inserted between renderDetail() and openModal(), and is the only new function added."
      - "The call `renderModalMeta(workstreams.find(...))` is the first line inside openModal(), before byId('ws-modal-id').textContent = wsId."
      - "#ws-modal-tags's innerHTML is cleared on every call (both branches), so a reopen leaves no stale tag pills."
      - "The dot's background/title and the dates' textContent are unconditionally overwritten (never conditionally skipped) on every call."
      - "renderDetail(), the fetch chain, and the .catch error-state handler are byte-identical to before this task."
      - "Both tsc -p projects and npm run build complete with zero errors; dist/public/app.js has no import/export; no new package.json dependency was added; no file under src/server (or equivalent server path) was touched."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.4 Manual verification against live data
    ```yaml
    description: "No code changes. Open several workstreams' modals and confirm every PLN-12 acceptance criterion by eye, per the plan's own Stage 1 task 4."
    issues: []
    implement:
      - "No source-code changes. Depends on tasks 1.1-1.3. Run npm run build, reload the board, and open several workstreams' modals in turn."
      - "Confirm tags render as .tag pills inside a .card-tags row, visually identical to that workstream's card tags, and are absent (no gap) for a workstream with no tags (criteria 1, 4)."
      - "Confirm created/updated dates match the card footer's values and 'created {date} · updated {date}' format exactly (criterion 2)."
      - "Confirm the severity dot's presence/color/tooltip matches that workstream's card dot exactly — check one workstream with zero open issues (no dot) and one with open issues of a known severity (dot present, correct color, correct tooltip) (criterion 3)."
      - "Confirm all three (tags, dates, dot) appear immediately on open, before the Issues/Tasks tabs finish loading (criterion 5), and remain visible and correct if the /detail fetch is made to fail (e.g. via devtools network throttling/offline) while only the title and Issues/Tasks panels switch to the existing error state (criterion 6)."
      - "Reopen a different workstream's modal and confirm the previous tags/dates/dot are fully replaced with no leftovers (criterion 7)."
      - "Leave a modal open across a WS-7 poll tick (>=5s, POL_MS) and confirm the meta block does not change (criterion 8)."
      - "Confirm Issues/Tasks tab content, tab switching, and the fetch error state are all unaffected (criterion 9), and that WS-9's per-card dots and WS-11's sort-button dot are visually and functionally unchanged (criterion 10)."
    pattern: "No file touched by this task."
    imports: "None."
    compatibility: "No test framework exists in this repo (matching WS-7 through WS-11 precedent) — this walkthrough plus npm run build is the verification, per PLN-12's own Testing strategy."
    gotcha: "Criterion 3's zero-open-issues case and known-severity case both need real or temporarily-observed data; if this project's own flowcharge/ has no open issues at verification time, note that limitation rather than fabricating a positive result."
    verify:
      - "npm run build — zero errors, immediately before starting the walkthrough."
      - "Manual walkthrough in a browser against the live dev server, covering every bullet in implement above."
    checklist:
      - "Tags match the card's tag pills exactly, and are absent (no empty row) when a workstream has no tags (criteria 1, 4)."
      - "Dates match the card footer's format and values (criterion 2)."
      - "The severity dot's presence/color/tooltip matches the card's dot in both the zero-open-issues and known-severity cases (criterion 3)."
      - "All three render before the /detail fetch resolves, and survive a fetch failure unaffected (criteria 5, 6)."
      - "Reopening a different workstream leaves no stale tags/dot/dates, and the meta block is unchanged across a poll tick while the modal stays open (criteria 7, 8)."
      - "Issues/Tasks tabs, tab switching, the fetch error state, WS-9's card dots, and WS-11's sort-button dot are all unaffected (criteria 9, 10)."
    self_eval:
      passed: true
      failures: []
      note: "Directly confirmed live in a real browser (127.0.0.1:4173), not by code trace. WS-4 (tags frontend/structure, zero open issues): modal showed the exact same tags as its card, dates 'created 2026-08-04 · updated 2026-08-04' matching the card footer, and no severity dot (hidden, no title) — read immediately after the click, before any network delay, confirming synchronous render (criterion 5). Temporarily gave WS-4's one real issue an open high severity: the modal's dot appeared with background rgb(232,130,94) and title 'High severity (open issues)', byte-identical to the card's own dot's computed style and title (criterion 3, known-severity case). Reopening on WS-9 (tags feature/ui, zero open issues) fully replaced WS-4's tags/dot/dates with WS-9's own — no leftovers (criterion 7). Left the modal open for 7s (> POLL_MS): tags, dates, and dot state were unchanged afterward, modal stayed open (criterion 8). Temporarily cleared WS-2's tags to an empty list: #ws-modal-tags rendered hidden with empty innerHTML, no empty row (criterion 4, no-tags case). Temporarily monkey-patched window.fetch in-page to reject the /detail request: tags and dates stayed correctly populated throughout while the title correctly switched to the existing 'Couldn't load this workstream' error state, no console error (criterion 6). Tab switching (Issues to Tasks) still worked correctly; the sort-button severity dot (WS-11) and per-card dots (WS-9) were structurally unaffected (criteria 9, 10). All three fixture edits (WS-4's issue, WS-2's tags, window.fetch) reverted/restored and confirmed byte-identical via diff and md5 before this was marked passed."
    ```

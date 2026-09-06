---
id: PLN-44-m70dil
type: plan
workstream: WS-54-4gm92r
slug: board-filter-and-blocked-chip
title: "Add a blocked-count KPI chip and a tag/blocked filter row to the board"
status: done
created: 2026-08-21
updated: 2026-08-21
depends_on: []
links: []
---

# A blocked KPI chip and a board filter row

## Summary

WS-53 (`PLN-43-943hna` / `TL-52-74z9f6`) removes the Blocked board column and
replaces it with a per-card badge driven by the optional `blocked` frontmatter
key. That leaves two gaps this workstream closes.

1. **No aggregate blocked count.** A blocked workstream can now sit in any of
   five columns. This plan adds one small chip to the existing Workstreams KPI
   tile's chip row, shown only when the blocked count is above zero, coloured
   with `--sev-critical` to match the card badge.
2. **No exact filtering.** The board's only filter is one free-text substring
   box, which is unreliable for tags, and WS-53 deliberately keeps `blocked` out
   of that haystack entirely. This plan adds a wrapped row of multi-select
   toggle chips inside the existing `.controls` bar: one chip per *selective*
   tag derived from the project's own data, one Blocked-only toggle, and one
   Clear control.

Three files change: `src/public/app.ts`, `src/public/board.html`, and
`src/public/styles.css`. No Node-side change is needed. `src/lib/extract.ts`,
`src/lib/detail.ts`, `src/server.ts`, `src/types/praxis-data.d.ts`, and
`electron/ipc-handlers.cts` all stay untouched — both features read only
`PraxisWorkstream.tags`, which is already a required `string[]` on the payload,
and `PraxisWorkstream.blocked`, which WS-53 adds.

The two features share no state, no DOM, and no event wiring. Their only shared
code is one predicate. Phase 1 extracts that predicate into a single
`isBlocked()` helper and repoints WS-53's two inline copies at it, so the
codebase never holds three copies of the same expression.

## Scope

### Acceptance criteria

**The shared helper**

1. `src/public/app.ts` declares exactly one function that answers "is this
   workstream blocked", and the expression `(w.blocked || '').trim()` appears
   exactly once in the file.
2. The card badge and the modal reason line behave exactly as WS-53's
   acceptance criteria 5 to 9 and 11 describe. The refactor changes no rendered
   output.

**The blocked KPI chip**

3. When at least one workstream carries a non-empty `blocked` value, the
   Workstreams KPI tile's chip row shows one extra chip, last in the row, whose
   text names the blocked count.
4. That chip's ink is `var(--sev-critical)` and its background is a faint mix of
   the same colour, matching the Open-issues tile's severity chips. It uses no
   `--st-` colour.
5. When no workstream is blocked, no such chip appears and the chip row is
   byte-identical to today's.
6. Hovering the chip shows a native tooltip saying the blocked count overlaps
   the status counts rather than adding to them.
7. The chip is not clickable, carries no `role`, and no `tabIndex`. Clicking it
   does nothing.
8. The KPI bar segments, the status chips, and every other tile are unchanged.

**The filter row**

9. The `.controls` bar shows a second line holding a `Filter` label, zero or
   more tag chips, a `Blocked only` toggle, and a `Clear` control. The bar has
   no second sticky sibling and the existing sort and search controls keep their
   positions.
10. A tag chip appears when its tag is carried by at least 2 workstreams **and**
    by fewer than 30 percent of all workstreams. Qualifying tags rank by count
    descending, then by normalised name ascending, and at most 10 are shown.
11. Against this repository's own 50 workstream records the displayed set is
    exactly, in order: `electron` 10, `bug` 9, `detail-modal` 8, `group1` 7,
    `server` 7, `ux` 7, `agentic-tools` 6, `board` 6, `filesystem` 6, `group2`
    5. `feature` (18, 36 percent) and `ui` (16, 32 percent) are excluded by the
    share ceiling. The 19 tags carried by exactly one workstream are excluded by
    the count floor.
12. Clicking a tag chip toggles it. Multiple active tag chips combine with OR: a
    card shows when it carries any active tag.
13. The tag axis, the blocked axis, and the free-text search combine with AND. A
    card shows only when it satisfies all three.
14. The `Blocked only` toggle shows only workstreams for which `isBlocked()` is
    true. It is always visible, whatever the blocked count.
15. An active tag chip renders with the same solid `--accent` fill that
    `.seg button.active` already uses. An active `Blocked only` toggle renders
    with a solid `--sev-critical` fill instead.
16. `Clear` resets every active tag chip and the blocked toggle. It does not
    clear the free-text search box and does not touch the sort controls.
17. A column emptied by any active filter — text, tag chips, or blocked toggle —
    shows `No matches`. A column that is empty because the project holds no
    workstream at that status shows `Empty`.
18. The `N / M workstreams shown` counter reflects the combined filter.
19. Tag chips are rebuilt only when the derived tag list changes. A five-second
    poll that returns the same tags leaves the chip DOM untouched, so a chip
    under the pointer is neither replaced nor loses its hover state.
20. Exactly one delegated click listener serves the whole filter row. No
    per-chip listener is bound, at init or on any rebuild.
21. A tag whose raw frontmatter form carries surrounding whitespace or a
    different case is counted under one normalised key, and its chip label shows
    the first-seen raw form.
22. An active tag that disappears from the data entirely is dropped from the
    active set on the next `applyData`, and the board is not left filtered by a
    tag with no chip.
23. An active tag that still exists in the data but falls out of the top-10 cap
    stays pinned in the displayed set, so its chip remains clickable to clear.
24. A tag below the cap is still reachable through the free-text search box,
    whose behaviour is unchanged.
25. `matches()` is unchanged. The blocked reason never joins the free-text
    haystack.
26. The filter row is legible and usable in all four theme blocks defined in
    `src/public/styles.css`.

### Out of scope

- **A clickable KPI chip.** The blocked chip does **not** apply the blocked
  filter when clicked. This is a settled exclusion, not an oversight. Making it
  clickable would put board-filter state inside `renderKpis` and couple two
  features that otherwise share nothing but one predicate. Criterion 7 asserts
  the exclusion.
- **A blocked KPI tile.** WS-53 settled that a whole tile would be empty most of
  the time. This plan adds a chip inside an existing tile and nothing more.
- **Adding `blocked` to `matches()`.** WS-53 settled that the reason stays out
  of the free-text haystack. The blocked toggle is the answer to finding blocked
  work, not a widened substring search.
- **Persisting filter state.** No URL query parameter, no `localStorage`, no
  session restore. See assumption A3.
- **A count on the `Blocked only` toggle label.** The toggle ships as static
  markup with a fixed label. See open question 3.
- **Filtering by status, by severity, by date, or by dependency.** The
  workstream asks for a tag axis and a blocked axis. Nothing else is added.
- **Sorting changes.** The sort controls, `sortKey`, `sortDir`, and every
  comparator are untouched.
- **Any Node-side change.** `src/lib/extract.ts`, `src/lib/detail.ts`,
  `src/server.ts`, `src/types/praxis-data.d.ts`, and
  `electron/ipc-handlers.cts` are confirmed already sufficient and stay
  untouched.
- **The pre-existing KPI chip-row invariant.** The chip row is often described
  as summing to the workstream total. That property is already false today for
  an unrelated reason WS-53's plan documents, it is asserted nowhere in this
  codebase, and no test covers it. Criterion 6 adds a tooltip that states the
  overlap. Nothing is authored to restore the invariant.
- **The pre-existing active-fill contrast shortfall.** `.seg button.active`
  paints `#fff` on `var(--accent)`, which is below WCAG AA in the dark theme
  today. Criterion 15 matches that existing treatment rather than diverging from
  it. Fixing the contrast of active controls is a separate, board-wide concern.
  See open question 4.
- **`--st-blocked` and `--st-blocked-bg`.** Untouched, exactly as WS-53 leaves
  them. `.attn-row .a-days` still consumes `--st-blocked`.

### Assumptions

Taken as the most reasonable reading, not confirmed by a user. Each is stated so
it can be corrected before code is written.

- **A1 — WS-53 has already executed.** This plan describes `buildCard`,
  `renderModalMeta`, `renderKpis`, and `STATUS_ORDER` as they read *after*
  `TL-52-74z9f6` has applied its changes, not as they read today. Phase 1's
  refactor targets two call sites that do not exist yet, and Phase 2 appends to
  a chip row from which WS-53 has already removed the Blocked status chip. The
  task list this plan produces must therefore declare
  `depends_on: [PLN-44-m70dil, TL-52-74z9f6]`, so Praxis's own dependency gate
  blocks execution until `TL-52-74z9f6` reaches `status: done`. This is a
  settled decision, recorded here as the assumption every edit anchor rests on.
- **A2 — Release constraints.** This is a local developer dashboard. There is no
  production deployment, no live user base, and no persisted application
  database. No feature flag, no dark launch, and no migration are needed.
  Rollback is `git revert` per phase.
- **A3 — Filter state is in-memory only.** `activeTags` and `blockedOnly` live
  in the module-scope IIFE state block beside `sortKey`, `sortDir`, and `query`,
  exactly as those three already do. A reload clears them, exactly as it clears
  the search box. Nothing is written to the URL or to storage.
- **A4 — The three thresholds are the investigation's, adopted as given.** The
  count floor of 2, the share ceiling of 30 percent, and the display cap of 10
  come from the prior investigation stage, which verified them against this
  project's 50 records. This plan adopts them verbatim and does not re-derive
  them. They are taste calls, not measured optima. See open question 1.
- **A5 — Always-on controls.** The `Blocked only` toggle and the `Clear` control
  are always visible and always enabled, whatever the data holds. Clicking
  `Clear` with nothing active is a harmless no-op re-render. The alternative — a
  disabled or hidden state — costs extra CSS and an extra state read to express
  something the user learns in one click.
- **A6 — An empty derived tag list is a normal state.** A project whose tags all
  fail the floor or the ceiling shows a `Filter` label, no tag chips, the
  blocked toggle, and `Clear`. No placeholder text and no empty-state message
  are added.
- **A7 — Tag normalisation is trim plus lowercase only.** No stemming, no
  singular/plural folding, no punctuation stripping. `Board` and ` board ` fold
  onto `board`; `boards` does not.

## Design

### Contract 1 — the shared predicate

One function in `src/public/app.ts`, placed beside `matches()` at line 83, which
is where the file's other small predicate helpers already live:

```ts
function isBlocked(w: PraxisWorkstream): boolean {
  return !!(w.blocked || '').trim();
}
```

Three callers: `buildCard`, `renderModalMeta`, and the new KPI chip. The filter
row's blocked axis is a fourth. The helper cannot live in a shared module —
`src/public/app.ts` compiles as a classic script, which the `WS_ID_TAIL` comment
at line 13 already documents as the reason another shared fragment could not be
imported. A local function is the correct answer here, not a workaround.

`renderModalMeta` still needs the trimmed *value*, not only the boolean, because
it writes the reason text. It therefore keeps its own local trim for the text
and uses `isBlocked(w)` for the branch, or trims once and tests the local — both
are acceptable, provided the file ends with exactly one occurrence of the
`(w.blocked || '').trim()` expression (criterion 1).

### Contract 2 — the module-scope state

Two additions to the existing IIFE state block in `src/public/app.ts`, beside
`sortKey`, `sortDir`, and `query` at lines 23-25:

```ts
var activeTags: Record<string, true> = {};   // normalised tag key → active
var blockedOnly = false;
```

Plus two derivation caches, beside `dependsOn` / `dependedBy` at lines 34-35:

```ts
var filterTags: { key: string; label: string; count: number }[] = [];
var filterTagSig: string | null = null;   // joined keys of the last rendered set
```

`activeTags` is a presence map, not an array, so membership is one property read
per card per render rather than a scan. This mirrors `chainSet`, which is
already a `Record<string, true>` in the same file for the same reason.

### Contract 3 — the tag derivation

Runs inside `applyData`, **not** inside `renderBoard`. `renderBoard` runs on
every keystroke in the search box and on every sort click; `applyData` runs on
load and on a five-second poll that actually changed. The file already states
this split explicitly at line 983: "The graph is rebuilt exactly where the data
changes, not in renderBoard, which runs on every keystroke in the search box."
The derivation follows that precedent.

The rule, in order:

1. Walk `workstreams`. For each raw tag, compute `key = tag.trim().toLowerCase()`.
   Skip an empty key. Count each key once per workstream, and record the first
   raw form seen for that key as its display label.
2. Keep a key whose count is at least **2** and whose share
   (`count / workstreams.length`) is below **0.30**.
3. Sort the kept keys by count descending, then by key ascending.
4. Take the first **10**.
5. **Prune.** Delete from `activeTags` any key that no longer appears anywhere in
   the data at all. This mirrors the `chainRoot` safety already at lines 992-996,
   which clears a highlighted root that a poll dropped out of the data.
6. **Pin.** Union the surviving `activeTags` keys back into the displayed set,
   even when they fall outside the top 10 or below the floor. An active filter
   must never become unclearable. Pinned entries append after the ranked ten, so
   the ranking of the ordinary set is not disturbed.

Steps 5 and 6 are two halves of one guarantee: every active tag has a visible
chip, and no tag stays active without data behind it.

**Worked example — this repository's own 50 records, verified.** 48 distinct
normalised tags. `feature` (18, 36.0 percent) and `ui` (16, 32.0 percent) fail
the share ceiling. 19 tags carried by exactly one workstream fail the count
floor. 27 tags qualify; the cap takes the first 10:

| Rank | Tag | Count | Share |
|---|---|---|---|
| 1 | `electron` | 10 | 20.0% |
| 2 | `bug` | 9 | 18.0% |
| 3 | `detail-modal` | 8 | 16.0% |
| 4 | `group1` | 7 | 14.0% |
| 5 | `server` | 7 | 14.0% |
| 6 | `ux` | 7 | 14.0% |
| 7 | `agentic-tools` | 6 | 12.0% |
| 8 | `board` | 6 | 12.0% |
| 9 | `filesystem` | 6 | 12.0% |
| 10 | `group2` | 5 | 10.0% |

Ranks 4, 5, and 6 tie at 7 and rank alphabetically. Ranks 7, 8, and 9 tie at 6
and do the same. This table is the concrete acceptance example for criterion 11.

Tags reach the browser unnormalised. `src/lib/extract.ts` line 189 carries
`wsFm.tags` verbatim into the payload with no trimming and no case folding, so
the normalisation above is the browser's job and belongs nowhere else.

### Contract 4 — the chip rebuild guard

After deriving the displayed set, join its keys into a signature string and
compare with `filterTagSig`. Rebuild the tag-chip DOM only on a mismatch, then
store the new signature. On a match, do nothing to the DOM.

This is criterion 19, and it is the whole reason the derivation lives in
`applyData` rather than in a render function. A poll every five seconds that
tore down and rebuilt ten buttons would drop the hover state and the focus ring
of whichever chip the user's pointer or keyboard was on.

Active state is a separate concern from the chip set: the `active` class on each
chip is refreshed from `activeTags` on every click and on every rebuild, and
that refresh is a class toggle over the existing buttons, not a rebuild.

### Contract 5 — the filter markup

Inside the existing `.controls` bar in `src/public/board.html`, as a further
flex child after `.result-count`:

```html
<div class="filter-chips" id="filter-chips" hidden>
  <label>Filter</label>
  <span id="filter-tags"></span>
  <button type="button" id="filter-blocked" class="blocked-toggle">Blocked only</button>
  <button type="button" id="filter-clear" class="filter-clear">Clear</button>
</div>
```

Four decisions in that fragment:

- **It ships inside `.controls`, not as a sibling bar.** `.controls` is
  `position: sticky; top: 0` (`src/public/styles.css` lines 250-252). A second
  sticky element at `top: 0` would overlap it as the board scrolls.
  `.controls` is already `display: flex; flex-wrap: wrap`, so a child with
  `flex-basis: 100%` wraps onto its own second line and scrolls with the bar it
  belongs to.
- **The tag chips go in their own `<span id="filter-tags">`.** The rebuild in
  Contract 4 replaces that one container's children and never touches the
  blocked toggle or the Clear button, which are static and must keep their
  identity and their state across rebuilds.
- **It ships with `hidden` set.** The row is inert until Phase 4 wires it, so
  Phase 3 is independently shippable — the page looks exactly as it does today.
  Phase 4's init clears the attribute. `#branch-line` in the same file already
  uses this hidden-until-wired pattern.
- **The `Filter` label reuses `.controls label`**, which is the same uppercase
  mono treatment the `Sort` label already has at line 32.

### Contract 6 — the filter styling

New rules in `src/public/styles.css`, placed beside `.seg` in the Controls
section:

```
.controls .filter-chips { flex-basis: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.controls .filter-chips #filter-tags { display: contents; }
.filter-chips button {
  border: 1px solid var(--line-strong);
  background: var(--paper-raised);
  color: var(--ink-soft);
  padding: 5px 12px;
  font-size: 12.5px;
  border-radius: 999px;
  cursor: pointer;
}
.filter-chips button:hover { background: var(--paper-sunken); }
.filter-chips button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.filter-chips button.blocked-toggle.active { background: var(--sev-critical); color: #fff; border-color: var(--sev-critical); }
```

Illustrative, not literal. The padding and font-size are copied deliberately
from `.seg button` at lines 267-268, and the `.active` treatment from
`.seg button.active` at line 274, so the new control reads as the same family as
the sort controls.

One existing rule changes, and it is the only non-additive edit in the whole
plan. Line 276 becomes:

```
.seg button:focus-visible, .filter-chips button:focus-visible, input:focus-visible, .card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

**Why a new class and not `.seg`.** `.seg` is `display: inline-flex` with
`overflow: hidden` and `border-right` dividers between adjacent buttons. It has
no wrap. Every existing use — `#sort-key-seg`, `#sort-dir-seg`,
`#integrations-scope-seg` on the home page — is a pick-one control, and the
divider-and-fill visual says so. Eleven or more chips in an `overflow: hidden`
inline-flex would clip, and the pick-one appearance would misrepresent a
multi-select OR. `.filter-chips` wraps, uses separate rounded pills, and reuses
`.seg button`'s size and active tokens rather than its container.

`display: contents` on `#filter-tags` lets the chips participate in the parent's
flex wrap directly, so a long tag list wraps chip-by-chip rather than as one
unbreakable block.

### Contract 7 — the filter predicate

`renderBoard`'s per-column filter at line 291 gains two conjuncts:

```ts
var items = byStatus[status].filter(function (w) {
  return matches(w, q) && tagMatch(w) && (!blockedOnly || isBlocked(w));
});
```

`tagMatch(w)` returns `true` when no tag is active, and otherwise `true` when
any of `w.tags` normalises to a key present in `activeTags`. That is the OR
within the tag axis; the `&&` chain is the AND across axes.

`matches()` itself is not edited. It keeps its haystack of id, title, slug, and
joined tags, which is what keeps criterion 24 and criterion 25 both true: the
chips are a fast, exact path over the ten most selective tags, and the search
box remains the way to reach every other tag and every blocked-free text.

### Contract 8 — the empty-column message

Line 314 of `src/public/app.ts` today reads:

```ts
body.appendChild(el('div', 'column-empty', q ? 'No matches' : 'Empty'));
```

The condition is wrong the moment a second filter axis exists: a column emptied
purely by a chip filter, with the search box untouched, would read `Empty` and
tell the user the project has no work at that status. Replace `q` with an
any-filter-active test computed once at the top of `renderBoard`, beside the
existing `var q`:

```ts
var filtering = !!q || blockedOnly || Object.keys(activeTags).length > 0;
```

This is criterion 17. It is a fix to existing behaviour that this feature makes
reachable, not a widening of scope.

### Contract 9 — the blocked KPI chip

Inside `renderKpis` in `src/public/app.ts`, after the `STATUS_ORDER` chip loop
closes and before `k1.appendChild(chips1)`:

```ts
var blockedCount = workstreams.filter(isBlocked).length;
if (blockedCount) {
  var cb = el('span', 'chip', 'Blocked ' + blockedCount);
  cb.style.background = 'color-mix(in srgb, var(--sev-critical) 16%, var(--paper-raised))';
  cb.style.color = 'var(--sev-critical)';
  cb.title = 'Blocked workstreams. This count overlaps the status counts above rather than adding to them — a blocked workstream also sits at one of the five statuses.';
  chips1.appendChild(cb);
}
```

Illustrative, not literal. The two style assignments are copied exactly from the
Open-issues tile's severity chips at lines 1072-1073, substituting `critical`
for the loop variable. No new CSS rule is needed: `.chip` at
`src/public/styles.css` line 232 already supplies the shape, and
`.kpi .kpi-chips` at line 231 already wraps.

Three notes:

- **It goes last.** The crimson fill is what separates it from the `--st-`
  status chips. No separator element and no extra CSS are needed to make that
  read.
- **It is a pure addition.** Six lines, nothing removed, no existing statement
  edited. `wsByStatus`, the bar loop, and the status chip loop are untouched.
- **It is inert.** No listener, no `role`, no `tabIndex`. The tooltip is a
  `title` property assignment, so its text is never parsed as markup.

### Contract 10 — the delegated listener

One listener, bound once at init time on `#filter-chips`:

```ts
byId('filter-chips').addEventListener('click', function (e) {
  var btn = (e.target as HTMLElement).closest('button');
  if (!btn) return;
  if (btn.id === 'filter-clear') { activeTags = {}; blockedOnly = false; }
  else if (btn.id === 'filter-blocked') { blockedOnly = !blockedOnly; }
  else if (btn.dataset.tag) {
    if (activeTags[btn.dataset.tag]) delete activeTags[btn.dataset.tag];
    else activeTags[btn.dataset.tag] = true;
  } else return;
  syncFilterActive();
  renderBoard();
});
```

`syncFilterActive()` toggles the `active` class on every button in the row from
`activeTags` and `blockedOnly`. It is also called after every chip rebuild in
Contract 4, so a rebuilt chip for a still-active tag comes back active.

Delegation is not a preference here. `src/public/app.ts` line 853 already
carries the justification for the identical choice on `#board`: "renderBoard()
rebuilds board.innerHTML on every sort, direction and search change, so per-card
listeners would be re-created continuously and leak." The tag chips are rebuilt
on a data change for the same reason and would leak the same way.

Each tag chip carries its normalised key on `data-tag` and its raw first-seen
form as its text. The listener therefore reads the key it needs without parsing
the label, and criterion 21 holds with no lookup table at click time.

### What each piece must not know

- `isBlocked` knows one field. It must not know about cards, modals, chips, or
  filters.
- `renderKpis` knows how to paint the KPI strip from `workstreams` and `issues`.
  It must not read `activeTags` or `blockedOnly`, must not write them, and must
  bind no listener. This is the mechanical form of the clickable-chip exclusion.
- The tag derivation knows how to rank tags from `workstreams`. It must not
  touch the DOM beyond the one container it owns, and must not call
  `renderBoard`.
- `renderBoard` knows how to paint columns from `workstreams` under the current
  filter and sort. It must not derive the tag list and must not rebuild the chip
  row.
- `matches()` must not learn that `blocked`, `activeTags`, or `blockedOnly`
  exist.

## Staged task breakdown

Four phases. Each leaves the app working and shippable if execution stops after
it. Phases 1 and 2 are the KPI-chip half; phases 3 and 4 are the filter half.
The order is deliberate: the chip is smaller and creates the visible motivation
for the filter, and Phase 1's helper is the one thing both halves need.

### Phase 1 — the shared `isBlocked()` helper

**Build.** Add `isBlocked()` beside `matches()` in `src/public/app.ts`. Repoint
WS-53's two inline `(w.blocked || '').trim()` checks — one in `buildCard`, one
in `renderModalMeta` — at the helper. `renderModalMeta` keeps whatever local it
needs for the reason *text*; only the truth test moves.

**Files.** `src/public/app.ts`.

**Effort.** Small.

**Depends on.** `TL-52-74z9f6` reaching `status: done` (assumption A1). Both
call sites are WS-53's.

**Verify.**
1. `npm run build` compiles clean.
2. `grep -c "(w.blocked || '').trim()" src/public/app.ts` returns 1.
3. `grep -n 'function isBlocked' src/public/app.ts` returns one line.
4. With a temporary `blocked` value on one local workstream record, the card
   pill and the modal reason line render exactly as they did before this phase.
   A whitespace-only value still produces neither.
5. `git diff -- src/public/app.ts` touches only the helper and the two call
   sites. No rendered output changed.

### Phase 2 — the blocked KPI chip

**Build.** Append the blocked chip inside `renderKpis` per Contract 9.

**Files.** `src/public/app.ts`.

**Effort.** Small.

**Depends on.** Phase 1 for `isBlocked()`.

**Verify.**
1. `npm run build`, which re-runs `tools/copy-assets.mjs`.
2. With no workstream blocked, the Workstreams chip row is identical to a
   pre-change screenshot.
3. Add a `blocked` value to two local workstream records at two different
   statuses. The chip reads `Blocked 2`, sits last in the row, and is crimson,
   not a `--st-` colour.
4. Hover the chip. The overlap tooltip appears.
5. Click the chip. Nothing happens — no filter applies, no modal opens, no
   console error.
6. Tab through the KPI strip. The chip is not a tab stop.
7. Cycle all four themes. The chip stays legible in each.
8. `git diff -- src/public/styles.css` is empty for this phase.

### Phase 3 — the filter row markup and styling

**Build.** Add the `#filter-chips` block to `.controls` in
`src/public/board.html` per Contract 5, shipped with `hidden`. Add the
`.filter-chips` rules to `src/public/styles.css` per Contract 6, and extend the
`focus-visible` rule at line 276.

**Files.** `src/public/board.html`, `src/public/styles.css`.

**Effort.** Small.

**Depends on.** Nothing. Independent of phases 1 and 2.

**Verify.**
1. `npm run build`.
2. Reload the board. The page looks exactly as it does today — the row is
   `hidden` and occupies no space. The sort controls, the search box, and the
   result count are in their existing positions.
3. Temporarily remove the `hidden` attribute in the built page through devtools.
   The row appears on a second line inside the sticky bar, the bar still scrolls
   as one element, and no second sticky element overlaps it.
4. Still in devtools, add ten dummy buttons to `#filter-tags`. They wrap onto
   further lines with no clipping and no horizontal overflow.
5. `git diff -- src/public/styles.css` shows exactly one modified line — the
   `focus-visible` rule — and everything else added.
6. `grep -n 'overflow: hidden' src/public/styles.css` shows no match inside any
   `.filter-chips` rule.
7. Cycle all four themes with the row temporarily visible. The idle and hover
   states read correctly in each.

### Phase 4 — the filter state, derivation, and wiring

**Build.** Add `activeTags`, `blockedOnly`, `filterTags`, and `filterTagSig` to
the module state per Contract 2. Add the derivation, the prune, the pin, and the
signature-guarded chip rebuild inside `applyData` per Contracts 3 and 4. Add
`syncFilterActive()` and the one delegated listener per Contract 10. Add
`tagMatch()` and extend the `renderBoard` filter per Contract 7. Replace the
empty-column condition per Contract 8. Clear the row's `hidden` attribute at
init.

**Files.** `src/public/app.ts`.

**Effort.** Medium. This is the largest phase and the only one with real
sequencing inside it.

**Depends on.** Phase 3 for the markup and the classes. Phase 1 for
`isBlocked()`.

**Verify.**
1. `npm run build`.
2. Open this repository's own board. The tag chips read exactly the ten names
   in Contract 3's table, in that order. `feature` and `ui` do not appear.
3. Click `board`. Only workstreams carrying the `board` tag remain. The counter
   updates. Click it again. The full board returns.
4. Click `board` and `bug` together. Workstreams carrying either tag show.
5. With `board` and `bug` active, type `modal` in the search box. Only cards
   satisfying both the tag OR and the text match remain.
6. Click `Blocked only` with a tag still active. Only blocked workstreams
   carrying an active tag show.
7. Click `Clear`. Both chip axes reset, the chips lose their fills, and the
   search box keeps its text and keeps filtering.
8. Click `Clear` again with nothing active. Nothing changes and no error is
   logged.
9. Activate a tag that empties one column. That column reads `No matches`, not
   `Empty`. Clear the filter and confirm a genuinely empty status column still
   reads `Empty`.
10. With a tag chip active, hover a chip and wait through three poll cycles
    (over 15 seconds). The chip is not replaced, the hover state survives, and
    the active fill survives.
11. Rename that tag out of every local workstream record. On the next poll the
    tag drops from both the chip row and the active set, and the board is not
    left showing nothing.
12. Restore the tag on exactly one record, so it falls below the count floor,
    and activate it before the change. Its chip stays pinned and clickable.
13. Add a tag as ` Board ` on one record and as `board` on another. One chip
    appears, its count includes both, and its label shows the first-seen raw
    form.
14. Confirm the `Blocked only` toggle's active fill is crimson and the tag
    chips' is the accent teal.
15. Tab into the row. Every chip is a tab stop with a visible focus ring, and
    Enter toggles it.
16. `git diff -- src/public/app.ts | grep -c 'function matches'` returns 0.
17. Search for a tag not in the top ten, such as `packaging`. The free-text box
    still finds it.
18. Remove every temporary `blocked` and tag edit and confirm `git status`
    shows the `flowcharge/` tree unmodified.

## Data & compatibility

- **Migrations.** None. There is no database and no persisted app state.
- **Payload.** Unchanged. Both features read fields the payload already carries:
  `tags`, a required `string[]` since the extractor was written, and `blocked`,
  which WS-53 adds. `GET /api/projects/<id>/data` is byte-identical before and
  after this workstream.
- **Backward compatibility.** Total. The KPI chip is additive and conditional.
  The filter row starts with nothing active, so a board with the feature behaves
  identically to one without until the user clicks something.
- **Forward compatibility.** A project whose tags all fail the floor or the
  ceiling gets an empty chip region and a working blocked toggle (assumption
  A6). A project with hundreds of tags gets ten chips plus any pinned actives.
  Neither case needs new handling.
- **Rollback.** `git revert` per phase, then `npm run build`. Reverting Phase 1
  alone requires reverting phases 2 and 4 first, because both call the helper.
  The feature writes nothing to disk.
- **Non-functional.** The tag derivation is one pass over `workstreams` and
  their tags, run on load and on a changed poll only — for 50 workstreams
  averaging 2 tags each that is roughly 100 string operations every five seconds
  at worst, against a poll that already re-parses a JSON payload. The chip
  rebuild guard means the DOM cost is zero on an unchanged poll. `tagMatch` adds
  one presence lookup per tag per card per render, on a render that already
  builds every card from scratch.
- **Security.** No new trust boundary. Every string written to the DOM goes
  through `el()`'s `textContent` or a `title` property assignment. Tag values
  come from the user's own local `flowcharge/` frontmatter, the same source the
  existing `.tag` spans already render. No `innerHTML` content write is added.
  `data-tag` holds a normalised tag and is read back with `dataset`, never
  interpolated into a selector.

## Testing strategy

This repository has no test framework and no test directory. `npm run build` is
the only automated gate, and it is a TypeScript compile. This section is a
pointer for a later pass with the write-tests skill, not a request to add a test
runner as part of this feature.

- **Compile-time (available now).** `npm run build` runs `tsc` over the library,
  the browser bundle, and the Electron main process.
- **Unit, if a runner is later added.** The tag derivation is the one piece here
  worth isolating, because it is a pure function from a workstream array to a
  ranked tag list. Cases: the floor boundary at exactly 2, the ceiling boundary
  at exactly 30 percent, a count tie broken alphabetically, the cap at exactly
  10 and at 11, a case-and-whitespace variant folding onto one key, an active
  tag pinned from outside the cap, and an active tag pruned because its data
  vanished. `isBlocked` deserves the same four cases WS-53 already lists:
  absent, empty, whitespace-only, and present.
- **Integration, if a runner is later added.** None needed. Neither feature
  crosses the HTTP boundary.
- **Manual (this feature's real gate).** The per-phase verification steps above
  are the acceptance test. Phase 4's step 2 is the concrete acceptance example
  from Contract 3's table, and steps 10 to 13 cover the four derivation edge
  cases that the guard, the prune, the pin, and the normalisation exist for.

## Open questions

None of these blocks any phase. Each has a recommendation the phases already
follow, so task authoring can proceed on all five.

1. **Are 2, 30 percent, and 10 the right thresholds?** They come from the prior
   investigation and are adopted verbatim under assumption A4. They produce a
   good result on this project's 50 records, which is one sample. On a project
   with 300 workstreams the 30 percent ceiling would admit a tag on 89 records,
   which is not selective in any useful sense. **Recommendation: ship as
   specified,** and revisit only if a real second project reads badly. Changing
   any of the three later is a one-line edit in one function.
2. **Should filter state survive a reload?** Not asked for, and assumption A3
   says no. A URL query parameter would make a filtered board shareable and
   bookmarkable, which fits a dashboard. **Recommendation: no for now.** It is a
   self-contained follow-up that touches only the state block and init.
3. **Should the `Blocked only` toggle show the blocked count in its label?** It
   would be useful and it duplicates the Phase 2 KPI chip. It also converts a
   static button into one more thing `applyData` must rewrite. **Recommendation:
   no,** as planned. The KPI chip already carries the count.
4. **Should the active fills be solid or tinted?** Criterion 15 matches
   `.seg button.active`'s solid `#fff`-on-colour treatment for family
   consistency. Measured, `#fff` on the dark theme's `--accent` (`#4FB8B0`) is
   about 2.4:1 and on its `--sev-critical` (`#E2536B`) about 3.7:1 — both below
   WCAG AA for text this size. The first of those already ships today on the
   sort controls, so this plan inherits a shortfall rather than creating one. A
   tinted treatment like the KPI chips' would pass. **Recommendation: match the
   existing controls,** and fix contrast board-wide in its own workstream rather
   than leaving one control styled unlike its neighbours.
5. **Deployment and release constraints.** Assumption A2 takes this as a local
   developer tool with no deployment gate. Had a user been available, the
   question would have been whether any packaged Electron build is pinned to a
   released version this UI change must be staged against.

## Alternatives considered and rejected

1. **Make the KPI chip clickable to apply the blocked filter.** The obvious
   candidate, and the reason it is named as an explicit exclusion rather than
   left unmentioned. Rejected: it puts board-filter state inside `renderKpis`,
   which today reads only `workstreams` and `issues`, and it couples two
   features whose entire shared surface is otherwise one four-token predicate.
   The blocked toggle already sits eight pixels below the chip.
2. **Reuse `.seg` for the filter row.** The workstream text suggested this, so
   it deserves a reason. Rejected on three counts: `.seg` is `overflow: hidden`
   inline-flex with no wrap, so eleven chips would clip; its `border-right`
   dividers and single-fill treatment read as pick-one, which misrepresents a
   multi-select OR; and all three existing users of the class are genuinely
   pick-one controls, so widening its meaning would degrade them too.
   `.filter-chips` reuses `.seg button`'s size and active tokens without
   inheriting its container semantics.
3. **A second controls bar below `.controls`.** Rejected: `.controls` is
   `position: sticky; top: 0`, and a second sticky element at the same offset
   would overlap it on scroll. Fixing that means coordinating two `top` values
   against a height that changes when the first bar wraps. A `flex-basis: 100%`
   child inside the existing bar costs one declaration and cannot desynchronise.
4. **Hardcode the tag list.** Rejected: this dashboard opens any registered
   project, and a list tuned to this repository's tags would be noise on every
   other one. The derivation is roughly fifteen lines and runs on data the
   browser already holds.
5. **Derive the tags in `renderBoard`.** Rejected: `renderBoard` runs on every
   keystroke in the search box and on every sort click. The file already draws
   this exact line at line 983 for the dependency graph, and the tag list is the
   same kind of data-derived index.
6. **Rebuild the chip row on every `applyData` without a signature guard.**
   Rejected: `applyData` runs on any changed poll, and a poll can change for a
   reason that has nothing to do with tags — an `updated` date, a task count.
   Tearing down ten buttons under the user's pointer every five seconds is a
   visible defect, and the guard that prevents it is one string comparison.
7. **One click listener per chip.** Rejected for the reason `src/public/app.ts`
   line 853 already records for `#board`: a rebuilt DOM re-creates every listener
   and leaks the old ones. One delegated listener on a container that is never
   itself replaced is the pattern this file already uses.
8. **Drop the count from the KPI chip and show a bare `Blocked` marker.** The
   workstream offered this as the way to preserve the chip row's sums-to-total
   reading. Rejected: the count is the entire point — a marker that does not say
   how many is strictly less useful than the card badges it summarises. The
   invariant it would protect is already false today for an unrelated reason and
   is asserted nowhere in this codebase, so a tooltip that states the overlap is
   an honest and much cheaper answer.
9. **Add `blocked` to the `matches()` haystack instead of a toggle.** Rejected
   twice over: WS-53 settled that the reason stays out of the haystack, and the
   substring unreliability the workstream measured for tags applies equally to
   reason text. A toggle answers "show me blocked work" exactly; a substring
   search over reasons answers it approximately.
10. **Put `isBlocked()` in a shared module both `app.ts` and the Node side can
    import.** Rejected: `src/public/app.ts` compiles as a classic script, which
    the `WS_ID_TAIL` comment at line 13 already documents as the reason a shared
    regex fragment could not be imported. Adding a module system for one
    four-token predicate is the wrong trade, and the Node side has no use for
    it — extraction deliberately does not interpret the field.
11. **Keep `activeTags` as a string array.** Rejected: membership becomes a scan
    per card per render, and toggling becomes an index-and-splice. The file
    already uses `Record<string, true>` for `chainSet` for exactly this reason.
12. **Normalise tags during extraction in `src/lib/extract.ts`.** Rejected:
    extraction carries frontmatter verbatim by design, and normalising there
    would silently change the `.tag` spans already rendered on every card and
    the `matches()` haystack that joins them. The browser normalises for
    comparison and displays the raw form, which changes nothing that already
    ships.
13. **Show all qualifying tags with no cap.** Rejected: 27 tags qualify on this
    project alone, which would push the controls bar to three or four wrapped
    lines and cost board height on a `max-height: 78vh` column layout. The cap
    plus the free-text fallback covers the long tail without that cost.
14. **Hide the `Blocked only` toggle when nothing is blocked.** Rejected under
    assumption A5: a control that appears and disappears with the data is harder
    to find than one that is always there, and a user who has never seen a
    blocked workstream is exactly the user who needs to discover that the filter
    exists.

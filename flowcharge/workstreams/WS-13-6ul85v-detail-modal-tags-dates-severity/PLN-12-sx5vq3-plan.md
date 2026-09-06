---
id: PLN-12-sx5vq3
type: plan
workstream: WS-13-6ul85v
slug: detail-modal-tags-dates-severity
title: "Tags, dates and a severity dot for the workstream detail modal"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: []
links: []
---

# Tags, dates and a severity dot for the workstream detail modal

## Summary

Give the workstream detail modal (`#ws-modal`, `src/public/board.html:84-105`, populated
by `openModal()`/`renderDetail()` in `src/public/app.ts`) the same picture of a
workstream that its board card already shows: tags, created/updated dates, and a
dominant-severity dot. All three values already live in the client-side `workstreams`
array (`PraxisWorkstream[]`, module scope) and in `sevMix` (module scope, seeded once
per `renderBoard()` call) — nothing needed here is missing from the client, so this is
a pure DOM/markup change with **no server route, no wire-shape change, and no new
network round trip**.

Two placement decisions, both settled here per the workstream card's instruction not
to ask:

1. **Severity dot** goes in the header, immediately before `#ws-modal-id`, styled and
   colored exactly like `buildCard()`'s own `idWrap` dot (WS-9) — same `.dot-sm` class,
   same `dominantSeverity(sevMix![w.id])` lookup, same `SEV_LABEL` tooltip text. This
   keeps the modal's dot physically anchored to the same "ID" position the card uses,
   so it reads as literally the same cue, not a re-derived one.
2. **Tags and dates** go in a new section, `.ws-modal-meta`, inserted between the
   existing `.ws-modal-head` and `.ws-modal-tabs`. Reusing the card's own `.card-tags`/
   `.tag` classes verbatim for tags; a small new `.ws-modal-dates` rule, styled like
   the card footer's `.updated` text, for the created/updated line.

All three values are set **synchronously at modal-open time**, from the already-loaded
`workstreams` array — not from the `/detail` fetch, which stays exactly as-is and
continues to supply only Issues/Tasks. This means tags/dates/severity appear the
instant the modal opens, before the network round trip resolves, and — per Context
item 7 — do not live-refresh while the modal stays open across a poll tick, matching
the Issues/Tasks tabs' existing static-at-open-time behavior.

## Scope

### Acceptance criteria

1. Opening a workstream's modal shows that workstream's tags as `.tag` pills inside a
   `.card-tags` row — the identical classes, and therefore identical visual style, the
   board card already uses for the same workstream's tags.
2. The modal shows the workstream's created and updated dates, each formatted via the
   existing `fmtDate()` helper, in the same "created {date} · updated {date}" phrasing
   the card footer already uses (`app.ts:129`).
3. The modal shows a small colored dot (`.dot-sm`) next to `#ws-modal-id`, colored via
   `var(--sev-<level>)` where `<level>` is `dominantSeverity(sevMix![w.id])` — present
   under exactly the same condition as the card's own dot (at least one open issue for
   that workstream) and absent otherwise. For a given workstream, the modal's dot can
   never disagree with that workstream's card dot, since both read the same `sevMix`
   entry through the same helper.
4. When a workstream has no tags, the tags row is hidden entirely (no empty gap) —
   matching the card's own conditional render (`w.tags && w.tags.length` at
   `app.ts:98`), not an empty visible row.
5. Tags, dates and the severity dot are set the moment `openModal()` runs, synchronously
   from the `workstreams` array — visible before the `/detail` fetch resolves, and
   unaffected by whether that fetch succeeds or fails.
6. If the `/detail` fetch subsequently fails, the tags/dates/severity block set at open
   time remains visible and correct; only the title and Issues/Tasks panels switch to
   the existing error state (`openModal()`'s `.catch`, `app.ts:463-467`, untouched).
7. Reopening the modal — for the same workstream or a different one — replaces the
   previous tags/dates/severity with the newly-opened workstream's own values; no
   stale tag pills, no stale dot color, no stale dates left over from a prior open.
8. The meta block does not update while the modal stays open across a WS-7 poll tick —
   an explicit decision (Context item 7), not an oversight; matches the Issues/Tasks
   tabs' existing static-at-open-time behavior.
9. Issues/Tasks tab content, tab switching, the `/detail` fetch, and the
   `PraxisWorkstreamDetail` wire shape are all unchanged.
10. WS-9's per-card dot and WS-11's sort-button dot are visually and functionally
    unchanged.
11. `npm run build` completes with zero errors across both `tsconfig.json` and
    `src/public/tsconfig.json`; `dist/public/app.js` remains a classic script (no
    `import`/`export`).
12. Zero new runtime dependencies; no server file touched.

### Out of scope

- Any change to `PraxisWorkstreamDetail` or the `/detail` route's wire shape.
- Live-refreshing the open modal's meta block (or its Issues/Tasks tabs) on poll ticks.
- Any change to the Issues/Tasks tabs themselves, or to `renderDetail()`'s issue/task
  rendering.
- Any change to WS-9's per-card dot or WS-11's sort-button dot.
- The home page's project tiles.
- A `.chip`-style severity treatment (considered and rejected below) or any new
  severity vocabulary beyond `SEV_ORDER`/`SEV_LABEL`/`--sev-*`/`.dot-sm`.

### Assumptions

1. **No deployment or release constraints apply.** Same footing as every prior
   workstream this session: a `localhost` single-user developer tool, no production
   data, no live users, no migration, no flag needed. Rollback is `git revert`.
   Recorded as Open Question 1, asked every run per process.
2. **Severity indicator: a `.dot-sm` dot, not a `.chip`.** Settled in Design below;
   recorded as Open Question 2 in case the shipped cue proves too subtle.
3. **Placement: severity dot in the header next to `#ws-modal-id`; tags and dates in a
   new section between `.ws-modal-head` and `.ws-modal-tabs`.** Settled in Design
   below; recorded as Open Question 3.
4. **`workstreams.find(w => w.id === wsId)` always finds a match** when `openModal()`
   runs, because it is only ever triggered by clicking an already-rendered card, whose
   `data-ws` came from that same array. The rendering code defends against a miss
   anyway (hides the whole meta block) rather than assuming it can't happen, but no
   code path is designed to exercise that branch.

## Design

### Approach: chosen and rejected

**Chosen — read `workstreams`/`sevMix` synchronously inside `openModal()`, render into
new static markup, using the card's own classes wherever one already exists.** Zero
new state, zero new fetch, zero server change. The severity dot is visually and
logically identical to the card's, by construction, because it is produced by the same
helper reading the same precomputed structure — not a re-derivation that could drift.

**Rejected — extend `PraxisWorkstreamDetail`/the `/detail` route to carry tags/created/
updated/severity.** Would duplicate data the client already has loaded, add a field to
a wire shape explicitly out of scope per the workstream card, and gain nothing: the
`/detail` fetch would still be needed for Issues/Tasks regardless, so this doesn't even
remove a round trip — it just makes an existing one heavier and introduces a second
source of truth for created/updated/tags that would need to be reconciled with the
`workstreams` array the card renders from.

**Rejected — `.chip` (KPI-strip style, `color-mix()` background) for the severity
indicator.** `.chip` in this codebase renders a *breakdown across tiers* — one chip per
nonzero severity, each carrying a count (`app.ts:660-668`) — a different concept from
"this one workstream's single dominant tier," which `.dot-sm` already expresses
everywhere else (the card, the sort button). Using `.chip` for a single-tier indicator
would introduce a visual idiom this codebase has never used at that granularity, for a
value that already has an established, cheaper, zero-drift-risk treatment. Investigation
flagged `.chip`'s self-labeling text as a legibility advantage, but the header already
carries a `title` tooltip on the dot (mirroring the card and the sort button), so the
label is one hover away, not absent — the same tradeoff WS-9 and WS-11 already made and
that this modal should stay consistent with.

**Rejected — cramming tags and dates into `.ws-modal-headings` alongside ID/title/
status.** That column (`display: flex; flex-direction: column; gap: 4px;`,
`styles.css:592`) sits in a row squeezed against the close button
(`justify-content: space-between`, `styles.css:584-591`) and was sized for three
single-line elements. A wrapping tag row and a dates line would need new width/wrap
handling inside an already-tight flex row, for no benefit over a dedicated section —
and the card itself keeps tags and dates in visually separate places (tags under the
title, dates in a distinct footer row), so mirroring that separation in the modal is
more consistent with the card's own layout, not less.

**Rejected — severity dot placed in the new `.ws-modal-meta` section instead of the
header.** Would cost nothing extra to build, but separates the dot from the ID it
describes, weakening the "reads as literally the same cue as the card" property the
header placement gets for free — on the card, the dot sits directly beside the ID too
(`app.ts:76-89`).

### Where the markup goes

`src/public/board.html`, inside the existing `<dialog id="ws-modal">` (currently lines
84-105). Two changes:

**1. Header — wrap the ID and a new severity-dot placeholder in a row, inside
`.ws-modal-headings`:**

```html
<div class="ws-modal-headings">
  <div class="ws-modal-id-row">
    <span id="ws-modal-sev-dot" class="dot-sm" hidden aria-hidden="true"></span>
    <span id="ws-modal-id" class="ws-modal-id"></span>
  </div>
  <h2 id="ws-modal-title" class="ws-modal-title"></h2>
  <span id="ws-modal-status" class="ws-modal-status"></span>
</div>
```

`#ws-modal-id` itself is untouched — `openModal()`/`renderDetail()` keep setting its
`.textContent` exactly as today (`app.ts:427,440`); only its wrapper changes. The dot
is a static placeholder, toggled via `.hidden` and colored via `.style.background` in
JS, not created/destroyed on each render — unlike WS-11's sort-button dot (which had to
create/remove because that button's markup predates any per-render dot), this modal's
scaffolding is authored fresh here, so a permanent element is simpler and matches how
`#ws-modal-id`/`#ws-modal-title`/`#ws-modal-status` are already always-present elements
mutated in place.

**2. New section between `.ws-modal-head` and `.ws-modal-tabs`:**

```html
<div class="ws-modal-meta" id="ws-modal-meta">
  <div class="card-tags" id="ws-modal-tags" hidden></div>
  <div class="ws-modal-dates" id="ws-modal-dates"></div>
</div>
```

`#ws-modal-tags` reuses `.card-tags` verbatim (the class the card itself uses,
`app.ts:99`) so `.tag` children dropped into it need no new CSS. `#ws-modal-dates` is a
new element/class for the created/updated line (Design's CSS section below).

### Where the logic goes

A new small function in `src/public/app.ts`, next to `renderDetail()`/`openModal()`
(currently `app.ts:425-468`), plus one call site at the top of `openModal()`:

```ts
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
  // ...unchanged from here down
```

Notes on this shape:

- `dominantSeverity(sevMix![w.id])` and the `SEV_LABEL`/tooltip text are byte-for-byte
  the same call and message `buildCard()` already makes (`app.ts:81,85`) — same
  presence rule (dot shows only when an open issue exists), same wording style.
- `workstreams.find(...)` matches this file's existing use of `Array#find`
  (`dominantSeverity` itself uses `SEV_ORDER.find`, `app.ts:55`), so no new idiom.
- **Idempotence (criterion 7):** `tagsEl.innerHTML = ''` at the top of every call
  clears any tags left over from a prior open before appending the current
  workstream's own; the dot and dates are unconditionally overwritten (`.style
  .background`, `.title`, `.textContent`) rather than conditionally patched, so a
  second call with different data always leaves the DOM fully in sync with the new
  `w` — no stale state can survive a reopen.
- The `!w` branch (Assumption 4) hides the whole block rather than showing partial or
  placeholder content, on the same "don't invent a state nothing else in this modal
  has" reasoning the workstream card applies elsewhere.
- Called before the loading-state lines (`byId('ws-modal-id').textContent = wsId`,
  etc.) so tags/dates/severity are visible the instant the dialog opens, not gated
  behind the `/detail` fetch — consistent with criterion 5 and Context item 7's
  static-at-open-time framing (this data was never dependent on that fetch to begin
  with).
- `renderDetail()` is untouched: it already only sets `#ws-modal-id` / `#ws-modal-title`
  / `#ws-modal-status` text and the two panels; it has no reason to touch the meta
  block, which `openModal()` alone owns.

### CSS — three small, scoped rules

```css
.ws-modal-id-row { display: flex; align-items: center; gap: 4px; }

.ws-modal-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--line);
}
.ws-modal-meta .card-tags { margin-bottom: 0; }
.ws-modal-dates { font-family: var(--font-mono); font-size: 10px; color: var(--ink-faint); }
```

- `.ws-modal-id-row` mirrors `buildCard()`'s `idWrap` inline styles (`display: flex;
  align-items: center; gap: 4px;`, `app.ts:78-80`) as a class instead of inline
  styles — this element is static HTML, not JS-built per render, so a named CSS rule
  matches this file's own convention (every other `.ws-modal-*` element is styled via
  a class in `styles.css`, not inline).
- `.ws-modal-meta` gets its own padding/border-bottom, matching the visual rhythm of
  `.ws-modal-head` (`styles.css:584-591`) and `.ws-modal-tabs`
  (`styles.css:628-632`), which it sits between.
- `.ws-modal-meta .card-tags` only overrides `margin-bottom` (the card's `.card-tags`
  rule sets `margin-bottom: 6px` for card-internal spacing, `styles.css:337`; here
  `.ws-modal-meta`'s own `gap: 6px` already provides that spacing, so the rule is
  zeroed to avoid doubling it) — everything else about `.card-tags`/`.tag` styling
  passes through unchanged, per the instruction to reuse rather than fork.
- `.ws-modal-dates` duplicates `.card-foot .updated`'s three declarations
  (`styles.css:355`) rather than broadening that selector to be reusable — the
  existing rule is scoped to `.card-foot` specifically, and widening a WS-9/WS-11-era
  selector to serve a new caller is a larger, less-contained change than adding three
  duplicate lines under a new, narrowly-scoped class name.

### What this piece knows / must not know

- `renderModalMeta()` knows the `workstreams` array, `sevMix`, `dominantSeverity`,
  `SEV_LABEL`, `fmtDate`, and the three new/rewrapped DOM ids. It does not know
  anything about `PraxisWorkstreamDetail`, the `/detail` fetch, or the Issues/Tasks
  panels — it is called once, synchronously, from data already in memory, fully
  independent of whether that fetch ever resolves.
- `openModal()`'s existing fetch/`.then`/`.catch` chain does not know about
  `renderModalMeta()`'s output and never needs to touch it — the two are sequenced
  (meta renders first, fetch starts after) but not coupled.

## Staged task breakdown

Small enough for a single stage; four small tasks, sequenced so the app stays working
after each and the visible change lands last.

**Stage 1 — Modal meta block**

1. **Markup: header row + new meta section.** File: `src/public/board.html`. Wrap
   `#ws-modal-id` in `.ws-modal-id-row` with the `#ws-modal-sev-dot` placeholder
   (inside `.ws-modal-headings`); insert the new `#ws-modal-meta` section (containing
   `#ws-modal-tags` and `#ws-modal-dates`) between `.ws-modal-head` and
   `.ws-modal-tabs`. Effort: small. Depends on: nothing. Verify: reload the board and
   open a card's modal — layout is unchanged except for the (currently invisible,
   `hidden`) new elements; no console errors.

2. **CSS: the three scoped rules.** File: `src/public/styles.css`. Add
   `.ws-modal-id-row`, `.ws-modal-meta` (+ its `.card-tags` override), and
   `.ws-modal-dates` near the existing `.ws-modal-*` rules (`styles.css:576-658`).
   Effort: small. Depends on: task 1. Verify: reload; still nothing visible yet (all
   new content-bearing elements are empty/hidden until task 3).

3. **Logic: `renderModalMeta()` and its call site.** File: `src/public/app.ts`. Add the
   function next to `renderDetail()`/`openModal()`; call it as the first line of
   `openModal()`. Effort: small. Depends on: tasks 1-2. Verify: `npm run build` (both
   tsconfig projects) with zero errors; `dist/public/app.js` still has no
   `import`/`export`.

4. **Manual verification against live data.** No code changes. Open several
   workstreams' modals and confirm: tags render as pills identical in style to the
   same workstream's card tags, and are absent (no gap) for a workstream with no tags
   (criteria 1, 4); created/updated dates match the card footer's values and format
   (criterion 2); the severity dot's presence/color/tooltip matches that workstream's
   card dot exactly — including a workstream with zero open issues (no dot) and one
   with open issues of a known severity (dot present, correct color) (criterion 3);
   all three appear immediately on open, before the Issues/Tasks tabs finish loading
   (criterion 5); reopening a different workstream fully replaces the previous one's
   tags/dates/dot with no leftovers (criterion 7); the meta block does not change if
   left open across a poll tick (criterion 8); Issues/Tasks tabs, tab switching, and
   the fetch error state are all unaffected (criteria 6, 9); WS-9's card dots and
   WS-11's sort-button dot are unaffected (criterion 10). Effort: small. Depends on:
   task 3.

## Data & compatibility

No migrations, no data model changes, no wire-shape changes. Fully backward
compatible: `PraxisWorkstreamDetail` and the `/detail` route are untouched (criterion
9), and the `workstreams`/`sevMix` structures this reads are already produced by
existing code, unmodified. Rollback, if ever needed, is `git revert` on the commit(s) —
same story as every prior workstream this session.

## Testing strategy

No test framework exists in this repo and this plan does not add one, matching the
project's own precedent (WS-7 through WS-11) — `npm run build` plus the manual
walkthrough in Stage 1 task 4 is the verification. For a later `write-tests` pass, if a
framework ever lands:

- `renderModalMeta()` is the one new function with non-trivial branching (present vs.
  missing workstream, tags vs. no tags, dominant severity vs. none) — each branch is a
  DOM-presence/attribute assertion: given a `PraxisWorkstream`-shaped fixture and a
  `sevMix` entry, the right `.tag` children, `.ws-modal-dates` text, and
  `#ws-modal-sev-dot` `hidden`/`background`/`title` state come out; and calling it
  twice with two different fixtures leaves no residue from the first call
  (idempotence, criterion 7).
- No existing function's behavior changes, so no regression coverage is needed beyond
  confirming `openModal()` still calls the fetch chain and `renderDetail()` still
  populates the panels exactly as before.

## Open questions

1. **Deployment and release constraints — confirming there are none.** Assumed per
   Assumption 1: no production data, no live users, no migration, no flag needed,
   rollback is `git revert`. Asked every run because the answer varies per project.
   *Recommendation: confirm the assumption; nothing in this plan would change shape if
   it's wrong, since there's no server-side surface to stage a rollout for.*

2. **Is `.dot-sm` the right severity treatment for the modal, or would `.chip`'s
   self-labeling text read better in the modal's roomier header?** Options: (a) dot,
   this plan's choice — visually identical to the card and sort-button cues, a tooltip
   supplies the label on hover, minimal new CSS; (b) `.chip` — always-visible label,
   but repurposes a "breakdown across tiers" idiom for a "single dominant tier" value,
   introducing a mismatch this codebase hasn't had before. *Recommendation: (a) for
   this pass, for consistency with WS-9/WS-11; revisit only if the dot proves too
   subtle in practice, as its own small follow-up.*

3. **Is header-placement for the severity dot (vs. placing all three — tags, dates,
   severity — together in the new `.ws-modal-meta` section) the right call?** This plan
   keeps the dot next to `#ws-modal-id` specifically so it reads as the same cue as the
   card's ID-adjacent dot; grouping all three in one section would be visually tidier
   but severs that positional echo. *Recommendation: ship as designed; regrouping later
   is a small, purely-markup change if the split placement reads as inconsistent in
   practice.*

4. **Exact dates-line and tags-row wording/order** (e.g. whether tags should appear
   above or below the dates line within `.ws-modal-meta`). This plan places tags first,
   dates second, matching the card's own top-to-bottom order (tags under the title,
   dates in the footer). *Recommendation: ship as ordered; a one-line markup swap if a
   different order is preferred.*

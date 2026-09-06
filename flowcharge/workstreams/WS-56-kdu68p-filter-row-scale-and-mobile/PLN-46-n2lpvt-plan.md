---
id: PLN-46-n2lpvt
type: plan
workstream: WS-56-kdu68p
slug: filter-row-scale-and-mobile
title: "A tag overflow popover, a shrunk fast-path chip row, and a mobile filter rail"
status: ready
created: 2026-08-21
updated: 2026-08-21
depends_on: []
links: []
---

# Filter row scale and mobile

## Summary

This plan scales the board's filter row for a tag vocabulary that grows over months, and
gives it mobile behaviour it does not have today. It adds six things: an overflow popover
holding every tag, a shorter fast-path chip row with counts and a stable alphabetical
order, a cutoff indicator, looser display caps, a visual split between the tag axis and
`Blocked only` / `Clear`, a mobile rail plus sheet, and `aria-pressed` on both surfaces.

The chosen approach reuses the app's existing `<dialog>` idiom for the popover, opened
with `showModal()`. That single decision supplies focus containment, Escape-to-close,
`::backdrop`, focus restoration, and the top layer — the last of which is what stops the
sticky `.controls` stacking context at `src/public/styles.css:242-253` from clipping the
panel. The app already runs this idiom twice, at `src/public/board.html:90` for `#ws-modal`
and in the integrations modal, and `src/public/app.ts:998-1000` already documents exactly
why.

The second load-bearing decision is one writer. A new `toggleTag(key)` owns every side
effect of a tag toggle, and the widened `syncFilterActive()` owns the painted state of
both surfaces. The fast-path row and the popover therefore have no independent path that
can drift. This mirrors the `applySortKey` / `applySortDir` pattern that `PLN-45-xh9o61`
uses for the sort row, and the `selectTab()` invariant already documented at
`src/public/app.ts:512-517`.

One item from the brief does not survive the arithmetic. Dropping `TAG_MIN_COUNT` to `1`
interacts badly with the corrected ceiling expression that `TL-56-4mxmju` lands. See
Open question **O1**; Phase 5 is deliberately cut so that only the safe half of Feature C
is planned.

This plan implements nothing.

## Prerequisites

- **`TL-56-4mxmju` must execute and land first.** It corrects the qualification
  expression at `src/public/app.ts:349`. Every phase here sits on top of that line, and
  Phase 5 reasons about its landed form directly.
- **`TL-55-5pyusw` (WS-55's features task list) must land before this plan's Phase 3.**
  That task list widens `.controls label` at `src/public/styles.css:255` into
  `.controls label, .controls .group-label`. Phase 3 replaces
  `src/public/board.html:51`'s `<label>Filter</label>` with a `.group-label` span and
  reuses that widened selector rather than duplicating the rule. If Phase 3 landed first,
  the `Filter` text would lose its styling for one commit.
- **The task list derived from this plan must declare
  `depends_on: [PLN-46-n2lpvt, TL-56-4mxmju, TL-55-5pyusw]`.** That is what makes the
  Praxis dependency gate hold execution until both are in.
- `TL-54-w3me1p` is an indirect prerequisite only. It reaches this plan through
  `TL-55-5pyusw`, which already depends on it.

## Scope

### Acceptance criteria, Feature A (the overflow popover)

1. A `More tags…` button sits in the filter row, after the tag area and before
   `Blocked only`. Clicking it opens a modal panel listing every distinct tag in the
   project's data, each with its workstream count.
2. The panel contains a text input. Typing in it hides every tag button whose normalised
   key does not contain the typed text as a substring. Clearing the input restores them
   all.
3. The input holds keyboard focus the moment the panel opens, on every open, without a
   `focus()` call in `app.ts`.
4. Clicking a tag button in the panel toggles that tag's filter state, re-renders the
   board behind the panel, and leaves the panel open, so several tags can be picked in
   one visit.
5. Every tag made active from the panel also renders as a chip in the fast-path row, at
   once, whether or not it ranks inside the display cap.
6. `Escape` closes the panel. Clicking the backdrop closes the panel. The close button
   closes the panel. After any close, focus returns to the `More tags…` button.
7. The panel renders above the sticky controls bar and is never clipped by it.
8. Re-opening the panel shows an empty search input and the full list, never the previous
   visit's search text.
9. A poll that changes the project's tag set while the panel is open updates the panel's
   list, and the search text in force still applies to the updated list.

### Acceptance criteria, Feature B (fast-path row: order, counts, cutoff)

10. The chips in the fast-path row read in alphabetical order of their label, left to
    right. Which tags are selected for the row is still decided by count rank.
11. Each chip shows its tag's workstream count as a child element of the chip button.
    Clicking anywhere on a chip, including on the count, still toggles that chip's tag.
12. A quiet `Top N of M` indicator sits beside the `Filter` heading. `N` is the number of
    chips the row is showing right now, including any pinned chip. `M` is the number of
    tags the popover lists.
13. The indicator is empty when `N` and `M` are equal, so a project whose whole
    vocabulary fits in the row shows no cutoff text.
14. A poll that changes nothing about the displayed set rebuilds no chip DOM, exactly as
    today.

### Acceptance criteria, Feature C (display caps)

15. The fast-path row shows at most 8 ranked chips, down from 10, plus any pinned active
    chip.
16. `TAG_MAX_SHARE` is unchanged at `0.30`.
17. `TAG_MIN_COUNT` is unchanged at `2` in this plan. See Open question **O1**.

### Acceptance criteria, Feature D (visual separation, demoted Clear)

18. `#filter-tags` is a real flex container, not `display: contents`. Its chips wrap
    inside it and never interleave with `Blocked only` or `Clear`.
19. `Blocked only` and `Clear` sit at the right-hand end of the filter row, separated
    from the tag area by a thin vertical rule.
20. `Clear` renders as an underlined plain-text control, not as a pill. Its focus ring is
    the existing shared one at `src/public/styles.css:276`, unchanged.

### Acceptance criteria, Feature E (mobile)

21. At 880px and below the tag chips sit on one line and scroll horizontally. They do not
    wrap and they do not squash.
22. Scrolling the tag rail to either end does not start scrolling the board underneath.
23. At 880px and below the controls bar does not stick to the top of the viewport. It
    scrolls away with the page.
24. At 880px and below the popover fills the viewport as a sheet, with no rounded corners
    and no outer margin. It is the same DOM as the desktop panel.
25. The filter row occupies its final height before the first fetch resolves, so the page
    does not grow under the user's thumb when data arrives.
26. At 320px, 375px, 390px, and 430px the board page has no horizontal overflow, measured
    as `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
27. The number of chips shown is the same on mobile as on desktop. No viewport-dependent
    JavaScript exists.

### Acceptance criteria, Feature F (accessibility)

28. Every tag button, in the row and in the popover, reports `aria-pressed="true"` when
    its tag is active and `aria-pressed="false"` when it is not, on both surfaces at once.
29. `Blocked only` reports its own pressed state on the same rule, and ships
    `aria-pressed="false"` in the markup.
30. `Clear` carries no `aria-pressed`, because it is an action and not a toggle.
31. The filter block reports itself as a group named `Filter`. The bare
    `<label>Filter</label>` at `src/public/board.html:51` no longer exists.
32. The sort row renders exactly as `TL-55-5pyusw` leaves it. No element WS-55 owns is
    edited.

### Out of scope

- The qualification expression at `src/public/app.ts:349`. `TL-56-4mxmju` owns it. No
  phase here re-touches it.
- Removing the now-dead bare `.controls label` selector at
  `src/public/styles.css:255`. Once both `<label>` elements become `.group-label` spans,
  that half of the selector matches nothing in `board.html`. Removing it is a follow-up
  note only, matching WS-55's own open item on the same rule.
- The three `calc(100vh - 64px)` uses already in `src/public/styles.css` at lines 709,
  724, and 841. They stay as they are.
- Every element WS-55 owns: `<label>Sort</label>`, `#sort-key-seg`, `#sort-dir-seg`,
  `#sort-key-select`, `#sort-dir-toggle`.
- A `+N more` expander that unwraps into more wrapped lines, invented tag categories or
  grouping, and replacing the chips with a dropdown. All three were rejected by the
  reviewer in the workstream record.
- A lower chip cap on mobile. Settled this session; see Alternatives.
- Persisting filter state to a URL parameter or to storage. It stays in memory at
  `src/public/app.ts:37-38`, exactly as today.
- Any change to how or when the `hidden` attribute on `#filter-chips` is toggled at
  `src/public/app.ts:480-482`.
- A browser test harness. See Testing strategy.

### Assumptions (mine, not confirmed by the user)

- **A1. Deployment and release.** This dashboard is local, single-user, and read-only. It
  runs from `npm start` or as a packaged Electron app. There is no production data, no
  live user, no migration, and no rollback constraint. No phase needs a feature flag, and
  each phase can ship on its own.
- **A2. The popover's pool is every distinct tag.** The workstream record asks for "the
  complete tag list", so the popover lists every key of the `counts` map built in
  `refreshFilterTags()`, not only the tags that pass the qualification rule. This makes
  `M` in the `Top N of M` indicator larger than the reviewer's illustrative `Top 8 of 27`:
  on this repository it reads `Top 8 of 48`. The brief's own rule — `M` is the popover's
  pool size — is what forces this, and the two numbers agreeing matters more than
  matching the illustration.
- **A3. The indicator's wording is `Top N of M`.** Plain text, no parentheses, quiet
  colour. See Open question **O2**.
- **A4. `margin-left: auto` on `#filter-blocked` is not used.** `#filter-tags` carries
  `flex: 1 1 auto`, which is required for the mobile rail to have a width to overflow
  inside. A grown flex item leaves no free space for an auto margin on a later sibling to
  consume, so the declaration would be inert. The growth itself pushes `Blocked only` to
  the right, and the `border-left` supplies the visual separation the brief asked for.
  The brief offered these as alternatives and marked its values illustrative.
- **A5. The mobile sheet uses `dvh`; the desktop panel uses `vh`.** The sheet's height is
  `100dvh`, because `100vh` on a phone measures past the browser's own chrome and the
  sheet's close button would sit under it. The desktop panel keeps
  `max-height: calc(100vh - 64px)`, byte-identical to `#ws-modal` at
  `src/public/styles.css:709` and `#integrations-modal` at line 841. `dvh` has been in
  every major engine since 2022 and in the Chromium that Electron bundles, so no `vh`
  fallback declaration is planned. This is the unit decision the brief asked the plan to
  state.
- **A6. Popover chips reuse the chip styling by class, not by a widened selector.** The
  list container carries `class="filter-chips tag-popover-list"`. The rules at
  `src/public/styles.css:286-297` and the shared focus ring at line 276 are not scoped by
  `.controls`, so they match, while `.controls .filter-chips` at line 278 does not. This
  needs zero selector-list edits. Only `.controls .filter-chips` and
  `.controls .filter-chips #filter-tags` are `.controls`-scoped, which is what makes the
  trick safe.
- **A7. Initial ARIA state ships in the markup for static buttons only.** `#filter-blocked`
  carries `aria-pressed="false"` in `board.html`. Every tag button is created by
  JavaScript and is painted by `syncFilterActive()` in the same pass that creates it, so
  no tag button needs a markup default. This mirrors assumption A6 of `PLN-45-xh9o61`.
- **A8. Counts inside a chip are plain text in a child `<span>`.** No comma grouping, no
  abbreviation. A count is a small integer here.

## Design

### Where this attaches

Three files, and no others.

| File | Role in this feature |
| --- | --- |
| `src/public/board.html` | The filter row at lines 50-55, and one new top-level `<dialog>` beside `#ws-modal` at line 90-126. |
| `src/public/styles.css` | The controls rules at lines 242-297, the existing 880px block at line 432, and a new dialog section modelled on lines 702-726. |
| `src/public/app.ts` | `syncFilterActive()` at 313-322, `refreshFilterTags()` at 324-379, the delegated click listener at 457-479, and the constants at 26-28. |

There is no server change, no API change, no data-model change, and no new dependency.
`src/public/app.ts` compiles as a classic script with `"module": "none"` in
`src/public/tsconfig.json`, so no import can be added and none is needed. The file's
style is ES5-era: `var`, function expressions, no arrow functions. Match it.

### Contract: the state writers

Three functions own all filter-tag state and all painted state. They live in the same
IIFE scope as `activeTags` at `src/public/app.ts:37`, and are declared before the
delegated listener at line 460.

```ts
// The only writer of activeTags after startup. Flips one key, rebuilds the
// derived chip row so an out-of-cap active tag gets pinned, then re-renders.
// Both the fast-path row's click handler and the popover's click handler call
// this, so the two surfaces cannot take different paths to the same state.
function toggleTag(key: string): void

// Paints the active class and aria-pressed over every button already on either
// surface. Active state is always a repaint, never a rebuild.
function syncFilterActive(): void          // widened, already exists at :316

// Reads #tag-popover-search and toggles the hidden attribute on each tag button
// in the popover list. The single writer of that visibility.
function applyPopoverSearch(): void
```

`toggleTag(key)` does exactly three things, in this order:

1. `if (activeTags[key]) delete activeTags[key]; else activeTags[key] = true;`
2. `refreshFilterTags();` — which prunes, ranks, pins, rebuilds if the signature moved,
   and ends by calling `syncFilterActive()`.
3. `renderBoard();`

Step 2 is the reason the popover satisfies acceptance criterion 5 with no extra code: the
existing PIN step at `src/public/app.ts:354-359` already guarantees that an active key
gets a chip. It just has to run at toggle time rather than only at data time.

**This changes a documented invariant.** The comment at `src/public/app.ts:324-326` states
that `refreshFilterTags()` is called from `applyData` only. After this change it is also
called from `toggleTag`, one call per click, never from `renderBoard`. The comment must be
rewritten in the same edit, or it becomes a lie. The cost is one extra pass over
`workstreams` per tag click, which is the same pass the app already runs on every data
change at `src/public/app.ts:1163`.

`syncFilterActive()` grows a second sweep and a shared painter:

```ts
function syncFilterActive(): void {
  // one body sets the class and the ARIA state, so they cannot drift
  function paintTag(b: HTMLButtonElement): void {
    var on = activeTags[b.dataset.tag || ''] === true;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  // #filter-chips: the id branches stay exactly as they are today
  // #tag-popover: button[data-tag] only, so the close button and the search
  // input's siblings are never touched
}
```

The `[data-tag]` qualifier on the popover sweep is required, not stylistic. The popover
also holds a close button.

### The one-writer map after this plan

| Event | Writer called | Surfaces repainted |
| --- | --- | --- |
| Fast-path chip click | `toggleTag(key)` | both |
| Popover chip click | `toggleTag(key)` | both |
| `Blocked only` click | existing branch, then `syncFilterActive()` | both |
| `Clear` click | existing branch, then `syncFilterActive()` | both |
| Poll with changed data | `refreshFilterTags()` from `applyData` | both |
| Popover search keystroke | `applyPopoverSearch()` | popover visibility only |

`Clear` is the one row in this table that does not call `refreshFilterTags()`. See Open
question **O3**.

### Search inside the popover

The match is `key.indexOf(needle) !== -1`, where `key` is the tag's already-normalised
`tagKey()` value from `src/public/app.ts:111-113` and `needle` is the input's value put
through the same `tagKey()`. Normalising both sides through one helper is what makes the
match case-insensitive and whitespace-tolerant without a second normalising rule.

Do **not** reuse `matches()` at `src/public/app.ts:98-102`. Its haystack is a workstream's
id, title, slug, and joined tags. It answers a different question about a different shape.

Visibility is the `hidden` attribute on each tag button, not a rebuild. That keeps the
popover's DOM identity stable, so `syncFilterActive()` keeps painting the same buttons and
a poll during a search does not fight the search.

`applyPopoverSearch()` is called from two places: the input's `input` event, and the end
of the popover list rebuild. The second call is what satisfies acceptance criterion 9 — a
rebuild produces fresh, all-visible buttons, and the search in force has to be re-applied
to them.

### Building the popover list

The list is built inside `refreshFilterTags()`, from the same `counts` and `labels` maps
it already builds at `src/public/app.ts:328-339`, behind its own signature guard modelled
on the existing GUARD step at lines 363-377. A second module-scope signature variable sits
beside `filterTagSig` at line 52.

The list's own order is alphabetical by key, which is stable across polls and is what a
searchable list of 48 items needs.

Rebuilding here rather than on open is deliberate: it keeps the popover live while it is
open, which is the same promise the rest of this board makes, and it reuses an idiom
already in the file rather than adding a lazy-build path. The rebuild clears only
`#tag-popover-list`, never the whole dialog, so the search input keeps its value and its
focus through a rebuild.

### Markup, `src/public/board.html`

The filter row at lines 50-55 becomes, in this order:

```html
<div class="filter-chips" id="filter-chips" hidden role="group" aria-labelledby="filter-group-label">
  <span class="group-label" id="filter-group-label">Filter</span>
  <span id="filter-tag-cutoff"></span>
  <span id="filter-tags"></span>
  <button type="button" id="filter-more">More tags…</button>
  <button type="button" id="filter-blocked" class="blocked-toggle" aria-pressed="false">Blocked only</button>
  <button type="button" id="filter-clear" class="filter-clear">Clear</button>
</div>
```

`#filter-more` sits inside `#filter-chips` but outside `#filter-tags`, so it is styled by
the existing `.filter-chips button` rule at line 286, covered by the shared
`:focus-visible` rule at line 276, and reached by the existing delegated listener — all
with no new rule and no new listener.

One new top-level `<dialog>` joins `#ws-modal`, as a sibling, before the script tags:

```html
<dialog id="tag-popover" aria-labelledby="tag-popover-title">
  <div class="tag-popover-inner">
    <div class="tag-popover-head">
      <h2 id="tag-popover-title" class="tag-popover-title">Filter by tag</h2>
      <button type="button" id="tag-popover-close" class="ws-modal-close" aria-label="Close">×</button>
    </div>
    <div class="search-wrap">
      <svg …>…</svg>
      <input type="text" id="tag-popover-search" placeholder="Search tags…" autocomplete="off" autofocus>
    </div>
    <div class="filter-chips tag-popover-list" id="tag-popover-list"></div>
    <p class="tag-popover-empty" id="tag-popover-empty" hidden>No tag matches that search.</p>
  </div>
</dialog>
```

Four reuses, none of them new invention:

- `.ws-modal-close` on the close button, styled at `src/public/styles.css:755-768`. The
  integrations dialog already reuses the `.ws-modal-*` chrome wholesale; the comment at
  `src/public/styles.css:834-836` says so.
- `.search-wrap` around the input, so the input picks up `.search-wrap input` at lines
  300-308 and the icon picks up `.search-wrap svg` at line 309. The magnifier SVG is a
  second copy of the one at `src/public/board.html:46`. It is duplicated deliberately:
  `board.html` has no templating and `app.ts` cannot import.
- `.filter-chips` on the list container, per assumption A6.
- `padding: 0` on the dialog itself, with all padding on `.tag-popover-inner`. This is
  load-bearing and is documented at `src/public/styles.css:702-705`: backdrop dismissal
  tests `e.target === dialog`, and a click on dialog padding also targets the dialog.

`autofocus` on the input is the native way to focus inside a dialog opened with
`showModal()`. The dialog's focusing steps honour it on every open, so no `focus()` call
belongs in `app.ts`.

### Wiring, `src/public/app.ts`

The delegated listener at line 460 gains exactly one branch, and one branch changes:

```ts
if (btn.id === 'filter-clear')        { … }                       // unchanged
else if (btn.id === 'filter-blocked') { … }                       // unchanged
else if (btn.id === 'filter-more')    { openTagPopover(); return; }  // new
else if (btn.dataset.tag)             { toggleTag(btn.dataset.tag); return; }  // routed
else return;
```

The two routed branches return early, because `toggleTag` already ends with
`syncFilterActive()` (through `refreshFilterTags`) and `renderBoard()`, and opening the
popover needs neither.

The popover gets its own delegated listener on `#tag-popover-list`, for the same reason
the row has one: its buttons are rebuilt whenever the data changes, and a per-button
listener would leak a handler on every rebuild. That reason is already written down at
`src/public/app.ts:457-459`.

`openTagPopover()` clears the search input, calls `applyPopoverSearch()` so the list is
whole again, then calls `showModal()`. Clearing on open mirrors the card modal's own rule
at `src/public/app.ts:993-996` — a reopen never inherits the last visit's state.

Close wiring mirrors the card modal exactly: a close-button click calls `close()`, as at
`src/public/app.ts:1072`, and a click whose `e.target` is the dialog itself calls
`close()`, as at line 1075. Escape and focus restoration need no code at all.

`byId()` returns `HTMLElement`, so the dialog needs the same cast the card modal takes at
`src/public/app.ts:493`. `btn.dataset.tag` is `string | undefined` and
`src/public/tsconfig.json` sets `"strict": true`, so the guard before `toggleTag` is a
type requirement, not a style choice.

### CSS, `src/public/styles.css`

Every edit is additive except one replacement, which is the point of Feature D.

1. **Replace line 285.** `.controls .filter-chips #filter-tags { display: contents; }`
   becomes a real flex box: `display: flex; flex-wrap: wrap; gap: 6px; flex: 1 1 auto;
   min-width: 0;`. `display: contents` gives the tag area no box at all, which is why an
   auto margin on a later sibling only affects the last wrapped line today, and why there
   is nothing to turn into a rail on mobile.
2. **Separate the right-hand controls.** `#filter-blocked { border-left: 1px solid
   var(--line); padding-left: 12px; }` — values illustrative, matched to the file's own
   spacing. `--line` is the file's own hairline token, defined at line 16.
3. **Demote `Clear`.** `#filter-clear { background: none; border: none; color:
   var(--ink-faint); padding: 5px 4px; text-decoration: underline; }`. An id selector
   already outranks `.filter-chips button` at line 286, so no `!important` is needed.
   Line 276's shared focus ring still matches and is not edited.
4. **The cutoff indicator.** `#filter-tag-cutoff { font-family: var(--font-mono);
   font-size: 10.5px; color: var(--ink-faint); }`. It deliberately does not join WS-55's
   widened `.controls label, .controls .group-label` list: that rule adds
   `text-transform: uppercase` and letter spacing, and `TOP 8 OF 48` reads as a heading
   rather than as the quiet data it is. Three declarations, reusing the same two tokens
   the label rule uses.
5. **Reserve the row's height.** `min-height` on `#filter-tags`, set to one chip's
   measured rendered height. Measure it in the browser with
   `getBoundingClientRect().height` on a live chip and write that literal px value with a
   comment naming what it matches; do not guess it. This is the corrected fix for the
   load-time jump: the `hidden` attribute is already cleared at init at
   `src/public/app.ts:480-482`, so the jump is the empty tag area, not the reveal.
6. **A new dialog section** for `#tag-popover`, modelled line for line on `#ws-modal` at
   lines 702-717 and `.ws-modal-inner` at 719-726: `padding: 0`, a `width: min(…, calc(100vw
   - 48px))`, `max-height: calc(100vh - 64px)`, the same border, radius, background,
   shadow, and `overflow: hidden`, plus a `::backdrop` line matching line 717. The list
   host carries the scroll, exactly as `.ws-modal-body` does, so the head and the search
   input stay pinned.
7. **Append to the existing 880px block at line 432.** Six declarations, appended, never
   reordered or rewritten:
   - `.controls { position: static; top: auto; }`
   - `.controls .filter-chips { flex-wrap: nowrap; }`
   - `#filter-tags { flex-wrap: nowrap; overflow-x: auto; overscroll-behavior-x: contain; }`
   - `#filter-tags button { flex: 0 0 auto; }`
   - `#tag-popover { width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh;
     margin: 0; border-radius: 0; }`
   - `.tag-popover-inner { max-height: 100dvh; }`

`overscroll-behavior-x: contain` is not decoration. `.board` at
`src/public/styles.css:313-319` is itself a horizontal scroller, and without containment a
flick that reaches the rail's end chains into it.

Put every declaration in `styles.css`. Do not add a `style="…"` attribute to `board.html`:
the CSP at `src/server.ts:29-32` sets `style-src 'self'` with no `'unsafe-inline'`. Runtime
CSSOM writes such as `dot.style.background` are unaffected and keep working.

### What each part must not know

- `toggleTag` knows how to flip one key and whom to tell. It does not know which surface
  called it, and it does not know whether the popover is open.
- The popover knows how to list tags and how to hide the ones a search excludes. It does
  not own filter state, does not call `renderBoard()` itself, and does not paint its own
  active classes — `syncFilterActive()` does that for both surfaces.
- `refreshFilterTags()` keeps its one job: derive both displayed sets from the data. It
  learns one new output, the popover list, from the same maps it already builds. It does
  not learn about clicks; `toggleTag` calls it, not the other way round.
- Nothing in this feature knows the viewport width. There is no `matchMedia` listener and
  no resize handler. Which layout a user sees is a CSS question only, so it cannot fall
  out of step with the filter state.
- `renderBoard()` is unchanged. `tagMatch()` at `src/public/app.ts:117-120` stays the only
  reader of `activeTags` for filtering.

### Shared surfaces, and who owns what

| Surface | Owner | This plan's relationship |
| --- | --- | --- |
| `.controls label` / `.controls .group-label`, `styles.css:255` | `TL-55-5pyusw` | Reuses it. Never edits it. Phase 3 is sequenced after it. |
| `@media (max-width: 880px)`, `styles.css:432` | Shared by three workstreams | Appends only. `TL-54-w3me1p` and `TL-55-5pyusw` have both appended by the time this runs. |
| `src/public/app.ts:349` | `TL-56-4mxmju` | Reads it. Never edits it. |
| `<label>Sort</label>` and the sort segments | `TL-55-5pyusw` | Never touched. |
| `<label>Filter</label>`, `board.html:51` | This plan | WS-55 explicitly does not touch it. |

## Staged task breakdown

Seven phases. Each leaves the app building, working, and demonstrable.

### Phase 1 — `toggleTag`, and `aria-pressed` on the row

**Build.** Extract `toggleTag(key)` per the contract, and route the delegated listener's
tag branch through it. Rewrite the stale comment at `src/public/app.ts:324-326`. Add the
`paintTag` helper inside `syncFilterActive()` so the `active` class and `aria-pressed`
move in one statement pair. Add `aria-pressed` to the `#filter-blocked` branch. Add the
static `aria-pressed="false"` to `#filter-blocked` in `board.html`.

**Files.** `src/public/app.ts`, `src/public/board.html`.

**Effort.** Small.

**Depends on.** `TL-56-4mxmju`.

**Verify.**
- `npm run build` exits zero.
- Clicking a chip still filters the board, and clicking it again still unfilters it.
- `document.querySelectorAll('#filter-chips [aria-pressed="true"]')` holds exactly the
  buttons carrying `class="active"`, after every click, including after `Clear`.
- An active tag that ranks below the cap still keeps its pinned chip.

### Phase 2 — The overflow popover

**Build.** Add the `<dialog id="tag-popover">` markup. Add the popover list build inside
`refreshFilterTags()`, behind its own signature guard. Add `applyPopoverSearch()`, the
input listener, the delegated list listener, `openTagPopover()`, the close-button and
backdrop close wiring, and the `#filter-more` branch. Widen `syncFilterActive()` with the
`#tag-popover button[data-tag]` sweep. Add the `#filter-more` button and the new dialog
CSS section.

**Files.** `src/public/board.html`, `src/public/styles.css`, `src/public/app.ts`.

**Effort.** Medium.

**Depends on.** Phase 1.

**Verify.**
- `npm run build` exits zero.
- `More tags…` opens the panel. It lists 48 tags on this repository, each with a count.
- The search input has focus on open, on the first open and on every later open.
- Typing `ele` narrows the list to the tags whose key contains `ele`. Clearing restores
  all of them.
- Picking a tag from the panel filters the board behind it, leaves the panel open, and
  puts a chip for that tag in the fast-path row at once.
- Picking a second tag adds it. The two combine exactly as two row chips would.
- `Escape`, the backdrop, and the close button each close the panel, and focus returns to
  `More tags…` in all three cases.
- The panel renders over the sticky controls bar, not clipped by it.
- Type a search, close, reopen: the input is empty and the list is whole.
- With the panel open and a search in force, edit a workstream's tags on disk, wait for
  the poll, and confirm the list updates and the search still applies.
- A tag activated in the panel reports `aria-pressed="true"` on both its panel button and
  its row chip.

### Phase 3 — The `Filter` group heading

**Build.** Replace `src/public/board.html:51`'s `<label>Filter</label>` with
`<span class="group-label" id="filter-group-label">Filter</span>`, and add
`role="group" aria-labelledby="filter-group-label"` to `#filter-chips`. No CSS edit: WS-55
has already widened the rule at `src/public/styles.css:255`.

**Files.** `src/public/board.html` only.

**Effort.** Small.

**Depends on.** Phase 2, and **`TL-55-5pyusw`**. This is the cross-workstream ordering
dependency. Landing this before WS-55's selector widening would leave the `Filter` text
unstyled for one commit.

**Verify.**
- `npm run build` exits zero.
- The `Filter` text renders in the same font, size, colour, letter spacing, and case as
  the `Sort` heading beside it.
- The accessibility tree shows a group named `Filter`.
- `board.html` contains no `<label>` element without a `for` attribute.

### Phase 4 — Alphabetical order, counts, and the cutoff indicator

**Build.** In `refreshFilterTags()`, after the existing slice at
`src/public/app.ts:352` and the PIN step at 354-359, sort the final displayed array
alphabetically by key, before the signature line at 366. Keep the rank-by-count sort at
351 and the slice exactly as they are — ranking stays count-based, only display order
changes. Add a count `<span>` as a child of each chip button in the build loop at 371-376.
Add the `#filter-tag-cutoff` span and its CSS rule, written by `refreshFilterTags()`.

**Files.** `src/public/app.ts`, `src/public/board.html`, `src/public/styles.css`.

**Effort.** Medium.

**Depends on.** Phase 3, for the final markup around the heading. Phase 2, because `M` is
the popover's pool size.

**Verify.**
- `npm run build` exits zero.
- The chips read alphabetically, left to right.
- Each chip shows its count, and this repository's counts match the pre-change baseline
  chips: `electron(10)`, `bug(9)`, `ux(9)`, `board(8)`, `detail-modal(8)`, `group1(7)`,
  `server(7)`, `agentic-tools(6)`, `filesystem(6)`, `group2(5)`.
- Clicking the count text toggles the chip, exactly as clicking its label does.
- The indicator reads `Top 10 of 48` on this repository before Phase 5, and its `M`
  equals the number of buttons in the popover list.
- Activate an out-of-cap tag from the popover and confirm the indicator's `N` grows by
  one, because the pinned chip is displayed.
- Build a fixture project whose whole vocabulary fits in the row and confirm the
  indicator renders empty.
- Poll twice with no data change and confirm no chip DOM is rebuilt: a chip under the
  pointer keeps its hover.

### Phase 5 — Shrink the display cap

**Build.** Change `TAG_MAX_CHIPS` at `src/public/app.ts:28` from `10` to `8`, and update
the comment block at lines 21-25 to match. Leave `TAG_MAX_SHARE` at `0.30`. Leave
`TAG_MIN_COUNT` at `2`, pending Open question **O1**. Do not touch line 349.

**Files.** `src/public/app.ts` only.

**Effort.** Small.

**Depends on.** Phase 4, and Phase 2 — the cap must not shrink before the escape hatch
exists, or reachability gets worse in the interim.

**Verify.**
- `npm run build` exits zero.
- This repository's row shows 8 chips, alphabetically ordered, and the indicator reads
  `Top 8 of 48`.
- The two tags dropped from the row are present in the popover, and picking one of them
  pins it back into the row.
- The `N=3`, `N=6`, `N=7`, and `N=10` fixtures that `TL-56-4mxmju` verified against
  produce the same chip sets they produced after that fix, because neither threshold that
  feeds line 349 has moved.

### Phase 6 — Visual separation and the demoted `Clear`

**Build.** Replace `src/public/styles.css:285` with the real flex container. Add the
`border-left` and padding on `#filter-blocked`, and the plain-text rules for
`#filter-clear`. Add the `min-height` on `#filter-tags` from a measured chip height.

**Files.** `src/public/styles.css` only.

**Effort.** Small.

**Depends on.** Phase 5.

**Verify.**
- Chips wrap inside the tag area and never interleave with `Blocked only` or `Clear`.
- `Blocked only` and `Clear` sit at the right-hand end, with a hairline rule before them,
  at 1280px and at 1000px.
- `Clear` renders as underlined faint text, still shows the shared focus ring on keyboard
  focus, and still clears both axes.
- With the network throttled, load the board and confirm the filter row's height does not
  change when the data arrives.
- The board's own horizontal scrolling is unaffected.

### Phase 7 — Mobile

**Build.** Append the six declarations to the existing `@media (max-width: 880px)` block
at `src/public/styles.css:432`. Append only: `TL-54-w3me1p`'s and `TL-55-5pyusw`'s rules
are already in that block and are neither rewritten nor reordered.

**Files.** `src/public/styles.css` only.

**Effort.** Medium.

**Depends on.** Phase 6, which creates the box that becomes the rail, and Phase 2, which
creates the dialog that becomes the sheet.

**Verify.**
- `npm run build` exits zero.
- At 375px the chips sit on one line and scroll horizontally. No chip is squashed.
- Flicking the rail past its end does not scroll the board underneath.
- At 375px the controls bar scrolls away with the page and does not stick.
- At 375px the popover fills the viewport, has square corners, and its close button is
  reachable with the browser's own chrome visible.
- No horizontal page overflow at 320px, 375px, 390px, and 430px, measured with
  `document.documentElement.scrollWidth === document.documentElement.clientWidth`.
- At 881px and above, every Phase 6 check still passes unchanged.
- The row shows the same 8 chips at 375px as at 1280px.
- The sort row's mobile behaviour from `TL-55-5pyusw` is unchanged, and so is
  `TL-54-w3me1p`'s wrapping fix where it still applies.

## Data and compatibility

- **Data models.** None are touched. This feature reads no new field of `PraxisData` and
  writes nothing back. The dashboard is read-only by design.
- **Migrations.** None. There is no database, and `.praxis-projects.json` is not touched.
- **Persisted state.** None. Filter state lives in `activeTags` and `blockedOnly` at
  `src/public/app.ts:37-38` and dies with the page, exactly as today.
- **API contracts.** Unchanged. `src/server.ts` is not edited. The CSP is a constraint on
  this work, not a target of it.
- **Existing consumers.** The one CSS rule this plan replaces rather than adds is
  `styles.css:285`, whose only match is `#filter-tags`, which this plan owns. Every other
  edit is a new rule or a new declaration on an id this plan introduces. `.filter-chips
  button` gains a second matching context through the popover list, which is the intent,
  and gains nothing else: `.controls .filter-chips` stays scoped and does not reach it.
- **Behaviour compatibility.** Chips are still rebuilt only when the displayed set moves,
  so the hover and focus protection at `src/public/app.ts:363-365` survives. The PIN step
  and the PRUNE step are unchanged. Sort, search, and `Blocked only` are untouched.
- **Build.** `tools/copy-assets.mjs` copies `board.html` and `styles.css` into `dist/`, so
  every change reaches the served page only after `npm run build`. `npm start` and
  `npm run refresh` both build first.
- **Rollback.** Each phase is one commit and reverts on its own, in reverse order. Phases
  5, 6, and 7 revert independently of each other. Nothing is written to disk, so a revert
  leaves no residue. Reverting all seven returns the page to the state `TL-56-4mxmju` and
  `TL-55-5pyusw` leave it in.
- **Electron.** The packaged app loads the same `dist/public/` files, so the change
  reaches it through the normal build. A packaged build needs a re-package to pick it up.
  See Open question **O5**.

## Testing strategy

The project's automated tests are Node-side only: `node:test` files beside their subjects
in `src/lib/`. `src/public/app.ts` compiles with `"module": "none"` as a classic script,
so nothing can import it, there is no DOM harness, and `package.json` has no `test`
script. This plan therefore adds no unit tests, and adding a harness stays out of scope.

Verification is:

- **Type and build coverage, every phase.** `npm run build` runs `tsc` with
  `"strict": true` and `"noEmitOnError": true`. It catches the `string | undefined`
  handling around `dataset.tag` and the `HTMLDialogElement` cast.
- **Manual browser checks, every phase.** The per-phase `Verify` lists above are the test
  plan.
- **Fixed viewport widths.** 320px, 375px, 390px, and 430px for mobile, and 881px and
  1280px for desktop. These are the widths `TL-54-w3me1p` and `TL-55-5pyusw` verify at, so
  the three results are comparable.
- **Fixture projects.** Phases 4 and 5 reuse the `N=3`, `N=6`, `N=7`, and `N=10` synthetic
  fixtures that `TL-56-4mxmju` already defines and verifies against, rather than inventing
  a second fixture scheme. Phase 4 adds one fixture whose vocabulary fits inside the cap,
  to prove the indicator hides itself.
- **The two-surface check** is the one most worth repeating if this code is touched again:
  activate a tag on one surface, and confirm the other surface's class and `aria-pressed`
  agree, in both directions, including after a poll.
- **A regression check on the neighbours** in phases 3 and 6: the `Sort` heading, the
  search box, and `#integrations-project-select` on the home page.

If a browser-side harness is ever added, the natural first targets are `toggleTag` and
`applyPopoverSearch` against a small DOM fixture. That is separate work.

## Open questions

1. **O1. Should `TAG_MIN_COUNT` drop to 1, given the corrected ceiling?** The brief asks
   for `1`. The arithmetic says that is unsafe against the expression `TL-56-4mxmju`
   lands. That expression picks its ceiling with `TAG_MAX_SHARE * N > TAG_MIN_COUNT`.
   With the floor at `1` the fallback branch stops applying at `N >= 4`, while
   `0.30 * N` is still below `2` until `N >= 7`. The result at `N = 4`, `5`, and `6` is
   that only tags carried by exactly one workstream qualify, and every repeated tag is
   excluded — the opposite of what the reviewer wants, and worse than what the bug fix
   alone produces. Options: (a) leave the floor at `2`, as this plan's Phase 5 does, and
   ship only the cap change; (b) drop the floor to `1` and accept that projects of 4 to 6
   workstreams show only singleton tags; (c) drop the floor to `1` and re-decide the
   ceiling expression, which means re-touching `src/public/app.ts:349`, something the
   brief rules out for this plan; (d) drop the floor to `1` and pin the fallback test to a
   literal `2` instead of to `TAG_MIN_COUNT`, which keeps the ceiling honest at any floor
   but is still an edit to line 349. **Recommendation: (a) now, and (d) as a separate
   follow-up** owned by whoever owns line 349. This is the one item of the brief this plan
   does not carry out, and it needs your answer before any task is authored for it.
2. **O2. The cutoff indicator's exact wording.** This plan assumes `Top 8 of 48`. Options:
   (a) `Top 8 of 48`, matching the reviewer's own phrasing; (b) `8 of 48 tags`, which
   names the unit; (c) `+40 more`, which is shorter but reads as the `+N more` expander
   the reviewer rejected. **Recommendation: (a).** Wording only, settleable at execution
   time.
3. **O3. Should `Clear` also call `refreshFilterTags()`?** Today `Clear` empties
   `activeTags` and repaints, but does not re-derive the row, so a chip pinned by the PIN
   step stays on screen until the next data change. This is existing behaviour, and this
   plan makes it more visible, because Feature A makes pinning easy from the popover.
   Options: (a) leave it, and accept a stale pinned chip that is at least inactive and
   harmless; (b) route `Clear` through `refreshFilterTags()` too, making the row's
   derivation consistent across all four writers. **Recommendation: (b)**, one line, but it
   is a behaviour change the brief did not ask for, so no phase above plans it.
4. **O4. Does the popover need a count of the tags it is hiding while a search is
   active?** The list can hold 48 buttons, and a search that matches two of them shows no
   indication of how many were excluded. This plan ships only the empty-result message.
   **Recommendation: no.** The search box's own contents already explain the shortened
   list, and the workstream did not ask for it.
5. **O5. Release.** Assumption A1 says there is no deployment constraint, no live user, and
   no production data, so each phase can ship as it lands. The one thing I would have
   asked: does a packaged Electron build need re-packaging with `npm run package:mac` or a
   sibling script as part of this work, or is the `npm start` path the only one that
   matters? **Recommendation: treat `npm start` as the target and re-package on the
   project's normal cadence**, since these are browser-side asset changes with no
   main-process effect.

## Alternatives considered and rejected

- **`<details>` / `<summary>` for the overflow panel.** Cheaper, no JavaScript to open it.
  Rejected: no focus trap, no Escape-to-close, no top layer, so the sticky `.controls`
  stacking context at `src/public/styles.css:242-253` can clip it. Settled this session.
- **The native `popover` attribute with CSS anchor positioning.** The most modern fit for
  an anchored panel. Rejected: it introduces a second overlay idiom beside the two
  `<dialog>` instances the app already runs, and anchor positioning has real
  browser-support risk. Settled this session.
- **An anchored panel on desktop instead of a centred modal.** Rejected: it needs
  measured-offset JavaScript, and the app already teaches "click, then modal" through its
  cards. No clear payoff. Settled this session.
- **Reusing `matches()` for the popover search.** Rejected: its haystack is a workstream's
  id, title, slug, and joined tags. Feeding it a tag key answers a different question about
  a different shape.
- **Building the popover list lazily on open.** It would avoid rebuilding roughly 50
  buttons on a data change. Rejected: it splits the derivation across two places, it
  cannot keep an open panel live through a poll, and the rebuild is already guarded by a
  signature so it does not run on an unchanged poll.
- **Giving the popover its own toggle code instead of calling `toggleTag`.** Rejected:
  that is the exact drift `toggleTag` exists to prevent, and it would need a second copy
  of the PIN behaviour to keep the row honest.
- **A lower chip cap on mobile.** Rejected: the rail removes the height problem the lower
  cap was meant to solve, and a JavaScript-side mobile cap needs a `matchMedia` listener
  plus a second `refreshFilterTags()` path. `PLN-45-xh9o61` rejected `matchMedia` for the
  equivalent sort-row problem for the same reason. Settled this session.
- **Pinning only the search box and the result count on mobile.** Rejected: `TL-54-w3me1p`'s
  own task text forbids a second sticky element at the same offset.
- **Changing when the `hidden` attribute on `#filter-chips` is cleared.** Rejected: the
  investigation showed it is already cleared at init at `src/public/app.ts:480-482`, so it
  is not the cause of the layout jump. A `min-height` on the empty tag area is.
- **A second, mobile-only DOM variant of the popover.** Rejected: one dialog plus five
  declarations inside the existing 880px block does the whole job, and two variants would
  need synchronising.
- **`100vh` for the mobile sheet, matching the file's three existing uses.** Rejected: on
  a phone `100vh` measures past the browser's own chrome, which would push the sheet's
  close button out of reach. See assumption A5.
- **Widening `.filter-chips button` to also match `#tag-popover-list button`.** Rejected:
  four selector lists would need widening, including the shared focus ring at
  `styles.css:276`. Putting the existing class on the list container costs nothing and
  reaches all four.
- **Removing the now-dead bare `.controls label` selector.** Rejected for this plan: it is
  another workstream's rule, and WS-55 already carries the same item as an open note.
  Recorded as a follow-up.

## Final summary

- **Approach:** one new `<dialog>` opened with `showModal()` holds the whole tag
  vocabulary, and one new `toggleTag()` plus a widened `syncFilterActive()` keep the row
  and the popover structurally unable to disagree. Everything else is CSS on boxes that
  already exist.
- **Size:** seven phases, three files, no new dependency. Four small, three medium;
  roughly one sitting each.
- **Top risks:** (1) the two surfaces drifting, which the single writer and the two-surface
  check exist to catch; (2) the shared 880px block at `styles.css:432`, which three
  workstreams now append to and none may rewrite; (3) `refreshFilterTags()` gaining a
  second caller, which makes the comment at `app.ts:324-326` wrong unless it is rewritten
  in the same edit.
- **Blocked until:** `TL-56-4mxmju` lands, and — for Phase 3 onward — `TL-55-5pyusw`
  lands. The derived task list must declare
  `depends_on: [PLN-46-n2lpvt, TL-56-4mxmju, TL-55-5pyusw]`.
- **Needs your answer:** **O1** the `TAG_MIN_COUNT` drop, which the arithmetic says is
  unsafe as briefed and which no phase above implements; O2 the indicator's wording; O3
  whether `Clear` re-derives the row; O4 a hidden-count in the popover search; O5 whether
  an Electron re-package is part of this work.

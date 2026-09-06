---
id: PLN-45-xh9o61
type: plan
workstream: WS-55-xrubq1
slug: sort-row-mobile-and-accessibility
title: "Accessible sort controls and a mobile select and icon toggle"
status: ready
created: 2026-08-21
updated: 2026-08-31
depends_on: []
links: []
---

# Sort row accessibility and mobile controls

## Summary

This plan adds two features to the board's sort row. Feature 1 makes the sort state
readable by assistive technology. Feature 2 replaces the sort controls with a native
`<select>` and a single direction icon button below the existing 880px breakpoint.

The chosen approach keeps two control variants in the DOM at the same time. CSS
`display: none` at the 880px breakpoint shows exactly one variant. Both variants call
the same two functions, `applySortKey(key)` and `applySortDir(dir)`. Each function owns
every side effect of a sort change: the module variable, the button classes, the ARIA
attributes, the select value, the icon state, and the `renderBoard()` call. There is
therefore no second synchronisation path that can drift.

This plan does not implement anything. It also does not re-open the three decisions the
user settled this session: `aria-pressed` instead of a `radiogroup`, the existing 880px
breakpoint instead of a new one, and the severity meaning folded into the option text.

## Prerequisites

- `TL-54-w3me1p` must execute and land first. That task list wraps `.controls .group`,
  `.controls .seg`, and `.controls .seg button` inside the existing
  `@media (max-width: 880px)` block at `src/public/styles.css:535`. This plan's work sits
  on top of that change.
- The task list derived from this plan must declare
  `depends_on: [PLN-45-xh9o61, TL-54-w3me1p]`. That entry is what makes Praxis's
  dependency gate block execution until the bug fix has landed.

## Scope

### Acceptance criteria, Feature 1 (accessibility)

1. A screen reader user who reaches a `#sort-key-seg` button hears its pressed state.
   The button for the current sort key reports `aria-pressed="true"`. The other four
   report `aria-pressed="false"`.
2. A screen reader user who reaches a `#sort-dir-seg` button hears its pressed state, on
   the same rule.
3. Clicking any sort key or direction button moves `aria-pressed="true"` to the clicked
   button in the same statement that moves the `active` class. The two can never disagree.
4. The sort control block reports itself as a group with the accessible name `Sort`.
   The bare `<label>Sort</label>` at `src/public/board.html:60` no longer exists.
5. `#sort-dir-seg` reports itself as a group with the accessible name `Sort direction`.
6. The severity dot injected at `src/public/app.ts:1403` carries `aria-hidden="true"`, so
   a screen reader announces the button as `Severity` and not as an unnamed image.
7. The `Filter` row renders exactly as it does today. `src/public/board.html:79` is
   unchanged.

### Acceptance criteria, Feature 2 (mobile controls)

8. At a viewport width of 880px or less, the board shows one native `<select>` for the
   sort key and one icon button for the sort direction. `#sort-key-seg` and
   `#sort-dir-seg` are not visible, are not in the tab order, and are not in the
   accessibility tree.
9. Above 880px the page renders exactly as Feature 1 leaves it. The select and the icon
   button are not visible, are not in the tab order, and are not in the accessibility
   tree.
10. The `<select>` holds exactly five options, in the order of the five buttons of
    `#sort-key-seg`. Four option labels are the button labels themselves. The severity
    option's label states its meaning in words.
11. Choosing an option re-sorts the board immediately, with no confirm step.
12. Clicking the direction icon button flips the sort direction, re-sorts the board, and
    swaps the visible arrow glyph.
13. The direction icon button carries an `aria-label` that states the current direction,
    and the label updates on every toggle. The button carries no `aria-pressed`.
14. Both arrow glyphs are inline SVG. No `data:` URI and no CSS `background-image` is
    used anywhere in this feature.
15. Resizing the window across 880px never leaves the two variants disagreeing. Whichever
    variant becomes visible already shows the current sort key and direction.
16. At 320px, 375px, 390px, and 430px the board page has no horizontal overflow, measured
    as `document.documentElement.scrollWidth === document.documentElement.clientWidth`.

### Out of scope

- Any new sort key, and any change to the comparator at `src/public/app.ts:447-455`.
- Persisting sort state to a URL parameter or to storage. Sort state stays in memory at
  `src/public/app.ts:47-48`, exactly as today.
- The filter row, the filter chips, and every part of the WS-56 workstream.
- `#integrations-scope-seg` in `src/public/index.html:64`, which is a different pick-one
  control in the integrations modal.
- The toolbar theme switch `#theme-seg`, which also carries `class="seg"` at
  `src/public/board.html:15` and `src/public/index.html:16`. No rule in this plan may
  reach it.
- Keyboard-navigation JavaScript for the segmented controls. The tab order stays as it is.
- A `radiogroup` / `role="radio"` ARIA pattern.
- Any new breakpoint.
- A test harness for browser-side code. See Testing strategy.

### Assumptions (mine, not confirmed by the user)

- **A1. Deployment and release.** This dashboard is local, single-user, and read-only. It
  is started with `npm start` or run as a packaged Electron app. There is no production
  deployment, no live user, no server-side data, and no migration. The feature therefore
  needs no feature flag and no dark launch. Each phase can ship on its own.
- **A2. Severity option text.** The severity option reads `Severity (worst open)`. The
  button's colour dot and its `title` tooltip are visual-only affordances that a native
  option cannot carry, so the words replace them. See Open question O1 for the wording.
- **A3. Accessible names.** The mobile select's accessible name is `Sort by`. The
  direction button's `aria-label` is `Sort ascending` or `Sort descending`, matching the
  current direction. See Open question O2.
- **A4. Arrow glyphs.** Two inline SVG arrows, drawn in the style of the existing search
  icon at `src/public/board.html:74`: `stroke="currentColor"`, `fill="none"`, a 24-unit
  `viewBox`, and a 13px rendered size.
- **A5. No new animation.** The direction control swaps one glyph for another with no
  transition, so no motion is introduced and nothing needs
  `prefers-reduced-motion` gating. If a transition is ever added, it goes inside the
  existing `@media (prefers-reduced-motion: no-preference)` block at
  `src/public/styles.css:601`. See Open question O3.
- **A6. Initial state ships in the markup.** `board.html` carries the correct starting
  `aria-pressed`, `aria-label`, and `hidden` values, exactly as the tablist at
  `src/public/board.html:139-142` does. The apply functions only handle changes. This
  matters: they call `renderBoard()`, and calling them at startup would erase the
  `Loading this project…` block at `src/public/board.html:87-90` before the fetch
  resolves.

## Design

### Where this attaches

Three files, and no others.

| File | Role in this feature |
| --- | --- |
| `src/public/board.html` | The controls markup at lines 58-72. Adds the select and the icon button, replaces the `Sort` label, adds the ARIA attributes. |
| `src/public/styles.css` | The controls rules at lines 320-354, the 880px block at line 535, and the select rule at line 949. |
| `src/public/app.ts` | The two click handlers at lines 477-491, the sort variables at lines 47-48, and the severity dot at line 1403. |

There is no server change, no API change, no data-model change, and no new dependency.
`src/public/tsconfig.json` sets `"module": "esnext"` with `"moduleResolution": "bundler"`
and `"noEmit": true`; `tools/bundle-public.mjs` bundles the module graph with esbuild into
one IIFE per page. An import into `src/public/app.ts` is therefore possible today, unlike
at the time this plan was first written, but this feature needs none and adds none.

### Contract: the two apply functions

Both functions live in the same IIFE scope as `sortKey` and `sortDir`, and are declared
before the listeners at `src/public/app.ts:477`. They are the only writers of `sortKey`
and `sortDir` after startup.

```ts
// Sets the sort key and every control that displays it, then re-renders.
// The desktop buttons, the mobile select, and any future caller all route
// through here, so no two controls can disagree about the current key.
function applySortKey(key: string): void

// Sets the sort direction and every control that displays it, then re-renders.
function applySortDir(dir: string): void
```

`applySortKey(key)` does exactly five things, in this order:

1. `sortKey = key;`
2. For each `button` in `#sort-key-seg`: compute `var on = b.dataset.key === key;`, then
   `b.classList.toggle('active', on);` and `b.setAttribute('aria-pressed', on ? 'true' : 'false');`
   in the same loop body. One loop body sets both, so the class and the ARIA state are
   structurally unable to drift. This is the invariant style already documented at
   `src/public/app.ts:553-556` for `selectTab()`.
3. Set the select's `value` to `key`.
4. Nothing else touches the direction.
5. `renderBoard();`

`applySortDir(dir)` mirrors it, and additionally sets the icon button's `aria-label` and
swaps which of the two inline SVGs carries the `hidden` attribute.

Note the comparison change. The handlers today compare object identity, `b === btn` at
`src/public/app.ts:482` and `:489`. The apply functions compare `b.dataset.key === key`
instead, because the caller may be the select's `change` event, which has no button to
compare against. The two forms are equivalent for a button click, because each
`data-key` value appears once.

Type note: `btn.dataset.key` is `string | undefined`, and
`src/public/tsconfig.json` sets `"strict": true`. The click handlers must therefore guard
with an early return when `dataset.key` or `dataset.dir` is absent, before calling the
apply function. `sortKey` and `sortDir` are declared `string | undefined` at
`src/public/app.ts:47-48`; that declaration does not need to change.

### Callers

| Caller | Call |
| --- | --- |
| `#sort-key-seg` click, `app.ts:477` | `applySortKey(btn.dataset.key)` after the guard |
| `#sort-dir-seg` click, `app.ts:484` | `applySortDir(btn.dataset.dir)` after the guard |
| `#sort-key-select` `change` | `applySortKey(select.value)` |
| `#sort-dir-toggle` click | `applySortDir(sortDir === 'asc' ? 'desc' : 'asc')` |

Startup calls neither function. See assumption A6.

### Markup, `src/public/board.html`

The `.group` container at line 59 becomes
`<div class="group" role="group" aria-labelledby="sort-group-label">`.

Line 60's `<label>Sort</label>` becomes
`<span class="group-label" id="sort-group-label">Sort</span>`. The `<label>` is invalid
today: it has no `for`, and it wraps no control.

Line 68's `#sort-dir-seg` gains `role="group" aria-label="Sort direction"`.

Every button in both segments gains a starting `aria-pressed` value. `data-key="id"` and
`data-dir="asc"` get `"true"`; the other five get `"false"`. That matches the `class="active"`
already baked into those two buttons.

Two new siblings join the group, after `#sort-dir-seg`:

- `<select id="sort-key-select" aria-label="Sort by"></select>`, shipped with no options.
- `<button type="button" id="sort-dir-toggle" aria-label="Sort ascending">`, holding two
  inline SVG arrows. The down arrow ships with the `hidden` attribute. Both SVGs carry
  `aria-hidden="true"`, because the button's `aria-label` already carries the meaning.

`src/public/board.html:79`, the `Filter` label, is not edited.

### Building the options

At startup, after the listeners are bound, loop the five buttons of `#sort-key-seg` in
document order. For each, create an `<option>` whose `value` is `b.dataset.key` and whose
text is `b.textContent`, except that a per-key override map supplies the severity label:

```ts
var SORT_KEY_OPTION_LABEL: Record<string, string> = { severity: 'Severity (worst open)' };
```

The four unchanged labels then have exactly one source of truth, the buttons. The one
label that must differ differs in one visible, named place. Set
`option.selected = (b.dataset.key === sortKey)` in the same loop, which is how the select
ships its initial state without calling `applySortKey`.

This loop must run before the severity dot is injected, which it does: the dot is added
inside `renderSeverity()` at `src/public/app.ts:1399-1404`, which runs only after the
fetch resolves. Even after injection, `textContent` would be unaffected, because the dot
`<span>` holds no text.

### CSS, `src/public/styles.css`

Four edits, all additive.

1. **Widen the label rule at line 333.** `.controls label { … }` becomes
   `.controls label, .controls .group-label { … }`. Widening rather than replacing is
   load-bearing: `src/public/board.html:79` still has a bare `<label>Filter</label>` that
   this rule styles, and that row belongs to WS-56.
2. **Widen the select rule at line 949.** `#integrations-project-select { … }` becomes
   `#integrations-project-select, #sort-key-select { … }`. Appending a selector cannot
   change what the integrations modal receives. Follow it with
   `#sort-key-select { margin-top: 0; display: none; }`. The `margin-top: 0` cancels the
   modal rule's `margin-top: 6px`, which would push the select off the centre line of the
   `align-items: center` controls row. The `display: none` is the desktop default.
3. **Hide the icon button on desktop.** `#sort-dir-toggle { display: none; }`, plus the
   few declarations that make it match the segment buttons visually. Reuse the existing
   `.seg button` values at lines 341-349 for padding, border, and colour rather than
   inventing new ones.
4. **Swap the variants inside the existing 880px block at line 535.** Add
   `.controls #sort-key-seg, .controls #sort-dir-seg { display: none; }`,
   `#sort-key-select { display: inline-block; }`, and
   `#sort-dir-toggle { display: inline-flex; }`. No new media query, and the 880px value
   is not changed.

`display: none` is required, not a preference. It is what removes the hidden variant from
the tab order and the accessibility tree at the same time. `visibility: hidden` or
off-screen positioning would leave one of the two behind.

Specificity check: `.controls #sort-key-seg` carries an id and beats `.seg` at line 340.
`.seg button[data-key="severity"] { display: inline-flex; }` at line 353 is on the button,
not the segment, so a hidden parent still hides it. Every new rule must also keep its
`.controls` or id prefix so it cannot reach `#theme-seg`, the toolbar theme switch, which
carries `class="seg"` on the board page itself and is styled by `.toolbar .seg` at line
253.

Put every new declaration in `styles.css`. Do not add a literal `style="…"` attribute to
`board.html`. The CSP at `src/server.ts:47-50` sets `style-src 'self'`, with no
`'unsafe-inline'`. Existing runtime styling such as `dot.style.background` at
`src/public/app.ts:1408` is CSSOM, which the CSP does not govern, and it keeps working.

### What each part must not know

- `applySortKey` and `applySortDir` know which controls display the sort state. They do
  not know how the board is sorted. The comparator at `src/public/app.ts:447-455` stays
  the only place that reads `sortKey` and `sortDir` for sorting.
- The controls know nothing about viewport width. No `matchMedia` listener and no resize
  handler is added for this feature. Which variant a user sees is a CSS question only, so
  it can never fall out of step with the state, and there is no resize thrash.
- `renderSeverity()` at `src/public/app.ts:1392` keeps its one job. It gains one
  `aria-hidden` attribute on the dot it already creates and learns nothing about the
  mobile controls. The select's severity label is static text, so it needs no update when
  the dominant severity changes.

### Known overlap with `TL-54-w3me1p`

Once phase 3 and phase 4 land, the three wrap rules that `TL-54-w3me1p` adds inside the
880px block become inert. `.controls .seg` is `display: none` below 880px, and above
880px the media query does not apply at all. This is expected and is not a fault. The bug
fix still closes `ISS-19-ua5166` and `ISS-20-en7s3l` on its own, and it stays in the file
as the fallback if the mobile variant is ever removed. This plan does not delete it. See
Open question O4.

## Staged task breakdown

Each phase leaves the app building, working, and demonstrable.

### Phase 1 — Accessibility on the existing controls (Feature 1)

**Build.** Add `aria-pressed` to all seven segment buttons in `board.html`, with the
correct starting values. Replace the `Sort` `<label>` with the `<span class="group-label"
id="sort-group-label">`, and add `role="group" aria-labelledby="sort-group-label"` to
`.group`. Add `role="group" aria-label="Sort direction"` to `#sort-dir-seg`. Widen
`.controls label` at `styles.css:333` to also match `.controls .group-label`. In both
click handlers at `app.ts:477-491`, set `aria-pressed` in the same loop body as the
existing `classList.toggle`. Add `dot.setAttribute('aria-hidden', 'true')` where the dot
is created at `app.ts:1403`.

**Files.** `src/public/board.html`, `src/public/styles.css`, `src/public/app.ts`.

**Effort.** Small.

**Depends on.** `TL-54-w3me1p`.

**Verify.**
- `npm run build` exits zero.
- In the browser, `document.querySelectorAll('#sort-key-seg [aria-pressed="true"]').length`
  is `1`, and it stays `1` after clicking each of the five keys in turn. Same for
  `#sort-dir-seg`.
- The button carrying `aria-pressed="true"` is the one carrying `class="active"`, at every
  step.
- The accessibility tree shows a group named `Sort` and a group named `Sort direction`.
- The `Sort` text renders in the same font, size, colour, and letter spacing as before,
  and the `Filter` label is visually identical to before.
- With a project loaded, the severity button announces as `Severity` and the dot is not
  announced.

### Phase 2 — Extract the apply functions (no behaviour change)

**Build.** Add `applySortKey` and `applySortDir` to the IIFE scope, per the contract
above, moving the body of each click handler into them. The handlers become a guard plus
one call. The functions still touch only the buttons at this phase, because the select and
the icon button do not exist yet.

**Files.** `src/public/app.ts` only.

**Effort.** Small.

**Depends on.** Phase 1.

**Verify.**
- `npm run build` exits zero.
- Every phase 1 check still passes, unchanged. This phase is a pure regression check:
  clicking all five keys and both directions re-sorts the board and moves both the
  `active` class and `aria-pressed` exactly as before.

This phase has no user-visible change on purpose. It is the contract that phases 3 and 4
both build against, and cutting it after them would mean writing the synchronisation
twice and then deleting one copy.

### Phase 3 — Mobile sort-key select (Feature 2, part 1)

**Build.** Add the empty `<select id="sort-key-select" aria-label="Sort by">` to
`board.html`. Add the startup loop that builds its five options from the buttons, with the
severity override. Extend `applySortKey` to set the select's `value`. Bind the select's
`change` event to `applySortKey(select.value)`. Add the CSS: widen the rule at
`styles.css:949`, add the `margin-top: 0; display: none;` override, and add the 880px
rules that hide `#sort-key-seg` and show the select.

**Files.** `src/public/board.html`, `src/public/styles.css`, `src/public/app.ts`.

**Effort.** Medium.

**Depends on.** Phase 2.

**Verify.**
- `npm run build` exits zero.
- At 375px the select is visible, `#sort-key-seg` is not, and
  `document.documentElement.scrollWidth === document.documentElement.clientWidth`. Repeat
  at 320px, 390px, and 430px.
- At 375px, tabbing through the controls never reaches a `#sort-key-seg` button.
- The select holds five options, in button order, and the severity option reads in words.
- Choosing each of the five options re-sorts the board.
- At 881px and above the select is not visible, is not tabbable, and the five buttons work
  exactly as in phase 2.
- Choose `Name` at 375px, widen the window past 880px, and confirm the `Name` button is
  the active, `aria-pressed="true"` one. Then click `Created` and narrow the window again,
  and confirm the select reads `Created`.
- Open the integrations modal on `index.html` and confirm
  `#integrations-project-select` is visually unchanged.

### Phase 4 — Mobile direction icon toggle (Feature 2, part 2)

**Build.** Add the `<button type="button" id="sort-dir-toggle">` with its two inline SVG
arrows to `board.html`, with the down arrow `hidden` and both SVGs `aria-hidden="true"`.
Extend `applySortDir` to set the button's `aria-label` and swap which SVG is `hidden`.
Bind the button's click to `applySortDir(sortDir === 'asc' ? 'desc' : 'asc')`. Add the CSS
for the button, plus the 880px rules that hide `#sort-dir-seg` and show the button.

**Files.** `src/public/board.html`, `src/public/styles.css`, `src/public/app.ts`.

**Effort.** Medium.

**Depends on.** Phase 3.

**Verify.**
- `npm run build` exits zero.
- At 375px the icon button is visible, `#sort-dir-seg` is not, and there is still no
  horizontal overflow at 320px, 375px, 390px, and 430px.
- Clicking the icon button flips the board order, flips which arrow is visible, and
  changes `aria-label` between the ascending and descending wording.
- The button carries no `aria-pressed` attribute.
- `board.html` contains no `data:` URI, and `styles.css` gains no `background-image`.
- Load the page with the network panel filtered to images and confirm no image request and
  no CSP violation appears in the console.
- Set direction to descending at 375px, widen past 880px, and confirm the `Desc` button is
  the active, `aria-pressed="true"` one, and the reverse.
- The whole sort block at 375px fits on one line, or wraps within the page with no
  overflow.

## Data and compatibility

- **Data models.** None are touched. This feature reads no new field of `PraxisData` and
  writes nothing back. The dashboard is read-only by design.
- **Migrations.** None. There is no database, and `.praxis-projects.json` is not touched.
- **Persisted state.** None. Sort state lives in the two module variables at
  `src/public/app.ts:47-48` and dies with the page, exactly as today.
- **API contracts.** Unchanged. `src/server.ts` is not edited. The CSP is a constraint on
  this work, not a target of it.
- **Existing consumers.** The only shared CSS this plan edits is two widened selector
  lists, at `styles.css:333` and `:949`. Both widen by appending a selector, so the
  existing matches, the `Filter` label and `#integrations-project-select`, receive exactly
  the same declarations as before. `#integrations-scope-seg` in `src/public/index.html:64`
  is not matched by any new rule, because every new rule carries `.controls` or an id, and
  `.controls` exists only on the board page. The same prefix keeps every new rule off
  `#theme-seg`, the toolbar theme switch, which carries `class="seg"` at
  `src/public/board.html:15` and `src/public/index.html:16` and is styled by
  `.toolbar .seg` at `styles.css:253`.
- **Build.** `tools/copy-assets.mjs` copies `board.html` and `styles.css` into `dist/`, and
  `tools/bundle-public.mjs` then bundles the browser TypeScript output with esbuild, so
  every change reaches the served page only after `npm run build`. `npm start` and
  `npm run refresh` both build first.
- **Rollback.** Each phase is one commit and is revertible on its own, in reverse order.
  Phases 3 and 4 revert independently of each other and of phase 1. Nothing is written to
  disk or to a user's data, so a revert leaves no residue. Reverting all four phases
  returns the page to the state that `TL-54-w3me1p` leaves it in.
- **Electron.** The packaged app loads the same `dist/public/` files, so the change
  reaches it through the normal build. A packaged build needs a re-package to pick it up.
  See Open question O5.

## Testing strategy

The project's automated tests are Node-side only: `node:test` files beside their subjects
in `src/lib/`, such as `src/lib/projects.test.ts`. `src/public/app.ts` is an ES module
bundled by esbuild into one IIFE for `board.html`, so importing it in a test is
theoretically possible, but there is no DOM test harness and no browser test runner in the
repository. `package.json` has no `test` script.

This plan therefore does not add unit tests, and adding a browser test harness is out of
scope. Verification is:

- **Type and build coverage, every phase.** `npm run build` runs `build:base` — the three
  `tsc` passes over `tsconfig.json`, `src/public/tsconfig.json`, and
  `electron/tsconfig.json`, then `node tools/copy-assets.mjs` — and then
  `node tools/bundle-public.mjs`. All three tsconfigs set `"strict": true`; the two Node
  ones also set `"noEmitOnError": true`, while `src/public/tsconfig.json` sets
  `"noEmit": true` and acts as a pure type-check gate ahead of the esbuild bundle. A type
  error in either case exits non-zero and stops the chain, so it fails the build rather
  than shipping. That catches the `string | undefined` handling around `dataset.key`,
  `dataset.dir`, and the apply-function parameters.
- **Manual browser checks, every phase.** The per-phase `Verify` lists above are the test
  plan. They are written as observable checks a person can run in one sitting.
- **Fixed viewport widths.** 320px, 375px, 390px, and 430px for the mobile variant, and
  881px and 1280px for the desktop variant. These are the same widths
  `TL-54-w3me1p` verifies at, so the two results are comparable.
- **The cross-breakpoint check** in phases 3 and 4 is the one that proves the shared apply
  functions did their job. It is the check most worth repeating if any of this code is
  touched again.
- **A regression check on the neighbours** in phases 1 and 3: the `Filter` label, and
  `#integrations-project-select` and `#integrations-scope-seg` on the home page.

If a browser-side test harness is added later, the natural first target is
`applySortKey` / `applySortDir` against a small DOM fixture. That is a separate decision
and a separate piece of work.

## Open questions

1. **O1. The severity option's wording.** This plan assumes `Severity (worst open)`. The
   button's tooltip today reads `Worst open severity, board-wide: <label>`. Options:
   (a) `Severity (worst open)`, short and matches the four other option labels in length;
   (b) `Worst open severity`, closer to the tooltip's wording; (c) plain `Severity`, which
   would contradict the settled decision to fold the meaning into the text.
   **Recommendation: (a).** This is a wording call only. It changes no structure, so it can
   be settled at execution time.
2. **O2. The direction button's `aria-label` wording.** This plan assumes `Sort ascending`
   and `Sort descending`, which name the current state, matching how the desktop buttons
   read. The alternative is to name the action the click will perform, such as
   `Sort descending` while the board is ascending. The two are opposites, so one must be
   chosen. **Recommendation: name the current state.** It matches the `aria-pressed`
   semantics of the desktop variant, so both variants describe the world the same way.
   A related caveat, not a blocker: some screen readers do not re-announce a changed
   `aria-label` on the element that already holds focus. Naming the current state makes the
   next `Tab` or re-read correct, which is the settled `aria-label` approach's known limit.
   Adding a visually hidden live region would fix the immediate announcement and is out of
   scope here.
3. **O3. Should the arrow swap have a transition?** This plan assumes no, so nothing needs
   `prefers-reduced-motion` gating and assumption A5 holds. If a transition is wanted, it
   must go inside the existing block at `styles.css:601`, and phase 4 grows slightly.
   **Recommendation: no transition.** A direction flip reads clearly without one.
4. **O4. What happens to the now-inert wrap rules from `TL-54-w3me1p`?** After phase 4 the
   three wrap declarations inside the 880px block can never apply, because both segments
   are `display: none` there. Options: (a) leave them, as this plan does; (b) remove them
   in a later, separate change. **Recommendation: (a) for now.** Removing them is an edit
   to another task list's output and belongs to its own decision, not to this feature.
5. **O5. Release.** Assumption A1 says there is no deployment constraint, no live user, and
   no production data, so each phase can ship as it lands. The one thing I would have asked:
   does a packaged Electron build need re-packaging, with `npm run package:mac` or a sibling
   script, as part of this work, or is the `npm start` path the only one that matters here?
   **Recommendation: treat `npm start` as the target and re-package on the project's normal
   cadence**, since these are browser-side asset changes with no main-process effect.

## Alternatives considered and rejected

- **A `radiogroup` with `role="radio"` and a roving tabindex.** More correct ARIA for a
  pick-one control, and the project already has the roving-tabindex pattern in
  `selectTab()` at `src/public/app.ts:559`. Rejected: it needs new keyboard-navigation
  JavaScript, and it changes the tab order that `ISS-20-en7s3l`'s fix was verified against.
  It changes far more surface than the workstream asks for. Settled this session.
- **A new breakpoint near 600px for the mobile variant.** It would keep the segmented
  buttons across the roughly 550px to 880px tablet band, where they work once the bug fix
  lands. Rejected: it adds a third width breakpoint to a stylesheet that already carries
  two — `@media (max-width: 520px)` at `styles.css:190`, which only hides the toolbar mark,
  and `@media (max-width: 880px)` at `styles.css:535`, which owns the board's responsive
  layout — and the workstream's framing is the 880px reuse. Settled this session.
- **Restyling `.seg` into something select-like instead of adding a real `<select>`.** It
  would avoid a second element. Rejected: a `<div class="seg">` cannot become a native
  picker, which is the whole point of the mobile variant on a phone.
- **Hiding the unused variant with `visibility: hidden` or off-screen positioning.**
  Rejected: both leave the hidden variant in the tab order, the accessibility tree, or
  both. That would make the accessibility work of Feature 1 worse, not better.
- **Swapping the DOM at the breakpoint with a `matchMedia` listener.** One control set
  would exist at a time. Rejected: it puts layout logic in JavaScript, adds a resize path
  that can fall out of step with the sort state, and abandons the CSS-only guarantee that
  the two variants can never disagree.
- **A CSS `rotate(180deg)` transform on one arrow instead of two glyphs.** Rejected: it is
  motion, so it needs `prefers-reduced-motion` gating, and a rotated ascending arrow is not
  necessarily the descending glyph a designer would draw. Two inline SVGs cost a few lines
  and are exact.
- **A `data:` URI arrow in a CSS `background-image`.** Rejected outright: the CSP at
  `src/server.ts:47-50` sets `img-src 'self'`, which blocks `data:` URIs. The icon would
  not render at all.
- **Hard-coding the five option labels in the select's markup or in a JavaScript array.**
  Rejected: it creates a second source of truth for labels that already exist in
  `board.html`, and the two would drift the first time a label is reworded.
- **Giving the select's `change` handler its own synchronisation code.** Rejected: that is
  the exact drift the shared `applySortKey` and `applySortDir` exist to prevent.
- **`aria-pressed` on the mobile direction button.** Rejected: a direction toggle has no
  meaningful off state, so a pressed state would mislead. A dynamic `aria-label` states the
  value instead. Settled this session.

## Final summary

- **Approach:** keep both control variants in the DOM, swap them with `display: none` at
  the existing 880px breakpoint, and route every sort change through one
  `applySortKey` / `applySortDir` pair so the variants cannot disagree.
- **Size:** four phases, three files, no new dependency. Two small phases and two medium
  phases; roughly one sitting each.
- **Top risks:** (1) the two variants drifting out of sync, which the shared apply
  functions and the cross-breakpoint checks in phases 3 and 4 exist to catch; (2) the
  widened selectors at `styles.css:333` and `:949` accidentally changing the WS-56 `Filter`
  label or the integrations modal, which the phase 1 and phase 3 regression checks cover;
  (3) `board.html` and `app.ts` carrying the initial state in two places, which assumption
  A6 handles by shipping it only in the markup, as the tablist already does.
- **Blocked until:** `TL-54-w3me1p` lands. The derived task list must declare
  `depends_on: [PLN-45-xh9o61, TL-54-w3me1p]`.
- **Needs your answer:** O1 severity option wording, O2 direction `aria-label` wording,
  O3 transition or not, O4 the fate of the inert wrap rules, O5 whether an Electron
  re-package is part of this work.

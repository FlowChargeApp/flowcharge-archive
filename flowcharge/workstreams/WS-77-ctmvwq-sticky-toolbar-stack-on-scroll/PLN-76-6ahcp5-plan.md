---
id: PLN-76-6ahcp5
type: plan
workstream: WS-77-ctmvwq
slug: sticky-toolbar-stack-on-scroll
title: "Pin the toolbar, breadcrumb bar and sort/filter bar as one sticky stack on the board"
status: ready
created: 2026-08-31
updated: 2026-08-31
depends_on: []
links: []
---

# Pin the toolbar, breadcrumb bar and sort/filter bar as one sticky stack on the board

## Summary

The board page keeps only the sort-and-filter bar (`.controls`) pinned to the top of the
viewport during scroll. This plan pins two more rows above it — the app toolbar
(`.toolbar`) and the breadcrumb bar (`.toolbar-crumb`) — so three rows stack and stay
visible at any scroll position.

The chosen approach is pure CSS: three `position: sticky` boxes with fixed `top` offsets
computed from two new layout custom properties, scoped to the board page by one new class
on its `<body>`. No JavaScript, no new DOM wrapper, and no new dependency. This matches the
page's existing chrome, which is CSS-only, and it matches the mechanism `.controls` already
uses at `src/public/styles.css:328-330`.

A sticky stack made of separate boxes needs each box's height as a constant, because the box
below must offset by the sum of the boxes above. `.toolbar` is already a fixed 44px
(`src/public/styles.css:176`). `.toolbar-crumb` is not: it carries `min-height: 26px` and
`flex-wrap: wrap` (`src/public/styles.css:196-197`), so a long project title can wrap it onto
a second line and break the arithmetic. The plan therefore fixes the breadcrumb bar's height
on the board page as part of the same change.

## Scope

### Acceptance criteria

1. At any scroll position on the board page, `.toolbar`, `.toolbar-crumb` and `.controls` are all visible at the top of the viewport, stacked in that order, with no gap and no overlap between them.
2. `.toolbar-sub`, the update banner and the KPI strip stay in normal flow and scroll out of view underneath the pinned stack, with their own position, spacing and styling unchanged.
3. The home page (`src/public/index.html`) keeps its current behaviour: its `.toolbar` and `.toolbar-crumb` scroll away and are not pinned.
4. The three pinned rows are fully opaque in the light theme and in the dark theme, so no board content shows through them.
5. When pinned, each row paints above every scrolled page element it passes over, and above the rows below it in the stack.
6. The centred `.tb-mark` badge stays horizontally centred in the toolbar at every scroll position, at every viewport width above 520px.
7. On a narrow viewport, and with a project title long enough to overflow, the breadcrumb bar stays one line and the title ellipsizes, so the pinned stack height never changes.
8. A card detail modal opened with `showModal()` still paints above the three pinned rows.

### Out of scope

- `.toolbar-sub` (`src/public/board.html:37`). It stays non-sticky and unchanged.
- The update banner, the KPI strip, the board columns, the lower panels and the modal.
- Any behaviour change on `src/public/index.html`.
- Any change to `.controls` other than its sticky `top` offset.
- Any new automated test harness for CSS or DOM. The repository has none today.

### Assumptions

- There are no deployment or release constraints for this change. The app is a private, local, single-user tool with no server-side state, no production data and no live users. The change ships whole in one build, needs no feature flag, and rolls back by reverting two files.
- The breadcrumb bar's used height on the board today is about 26.85px, not 26px. `.tb-title` is `font-size: 13px` (`src/public/styles.css:211`) and declares no `line-height`, so it inherits the unitless `1.45` from `body` (`src/public/styles.css:156`) and makes an 18.85px line box. Added to the 8px of vertical padding (`src/public/styles.css:197`, 4px top and 4px bottom), that gives about 26.85px. The `min-height: 26px` is a floor the content already exceeds, not the used height. `--crumb-h: 27px`, the smallest whole pixel that fits 26.85px, therefore reproduces the current appearance. The implementer confirms this in the browser and raises the value to the smallest whole pixel that fits if the measured content is taller.
- Forcing the board breadcrumb bar to one line is acceptable. A long title ellipsizes instead of wrapping. `.tb-title` already sets `white-space: nowrap`, `overflow: hidden` and `text-overflow: ellipsis` (`src/public/styles.css:212`), so this is the treatment the element was already written for.
- The pinned stack needs no shadow, border or other separator. The three bars already read as separate bands through their own background colours (`src/public/styles.css:170-173`).

## Key flows

**Scroll the board with the stack pinned** — **Actor:** a person reading a project board.
**Preconditions:** `board.html` is open with a project loaded, and the page is tall enough to
scroll. **Main flow:** the person scrolls down; `.toolbar` reaches the top of the viewport
and stops there; `.toolbar-crumb` follows and stops directly beneath it; `.toolbar-sub`, the
update banner (when shown) and the KPI strip pass underneath both and leave the screen;
`.controls` reaches the bottom edge of `.toolbar-crumb` and stops there; the board columns
continue to scroll under all three. **Outcome:** the wordmark, theme switcher, breadcrumb,
board title, sort controls, search field and filter chips stay reachable at any scroll
depth. **Edge cases:** a viewport narrower than 520px hides `.tb-mark` by the existing rule
at `src/public/styles.css:190` and the stack height is unchanged; a long project title
ellipsizes rather than wrapping, so the stack height is unchanged; when the filter chips row
is visible, `.controls` is taller and the stack is correspondingly taller, which needs no
offset change because `.controls` is the last row.

## Design

### Files changed

- `src/public/board.html` — one attribute added to the `<body>` tag.
- `src/public/styles.css` — the toolbar section (around lines 169-199) and the `.controls`
  rule (lines 320-331).

No other file changes. `styles.css` and `board.html` are copied verbatim into `dist/public/`
by `tools/copy-assets.mjs`, and `tools/bundle-public.mjs` does not process CSS, so the build
pipeline needs no change.

### Contract: the page scope class

`src/public/board.html` gets `<body class="board-page">`. `src/public/index.html` gets no
class and is not edited.

This class exists for one reason: both pages use the same two class names, `.toolbar` and
`.toolbar-crumb` (`board.html:12-35` and `index.html:12-32`), so every rule written against
those selectors reaches both pages. The markup inside the two bars is not identical — the
home page's `.toolbar` also holds a `<button id="manage-integrations-button">`, and its
`.toolbar-crumb` holds a `<span class="tb-title">` and a version element where the board's
holds a back link, a separator and an `<h1 class="tb-title">`. The shared class names, not
shared markup, are what makes the scope class necessary. Only the board page's bars become
sticky, so every new rule that changes the two bars is written under `.board-page`.
`.controls` needs no scoping, because it exists only in `board.html`.

### Contract: the two layout custom properties

Declared on `.board-page`, not on `:root`. The `:root` blocks in `styles.css` are the chrome
palette and carry a stated derivation rule for colour values only
(`src/public/styles.css:1-24`); layout constants do not belong there.

| Property | Value | Meaning |
|---|---|---|
| `--toolbar-h` | `44px` | The pinned height of `.toolbar`. Must equal its `height` at `src/public/styles.css:176`. |
| `--crumb-h` | `27px` | The pinned height of `.toolbar-crumb` on the board page. |

These two values are the whole contract of the stack. Every `top` offset below is written as
a `calc()` over them, never as a literal number, so that changing a bar's height changes the
stack in one place.

### Contract: the sticky ladder

| Element | `position` | `top` | `z-index` |
|---|---|---|---|
| `.board-page .toolbar` | `sticky` | `0` | `7` |
| `.board-page .toolbar-crumb` | `sticky` | `var(--toolbar-h)` | `6` |
| `.controls` | `sticky` (unchanged) | `calc(var(--toolbar-h) + var(--crumb-h))` | `5` (unchanged) |

The `z-index` values descend down the stack. The rows never overlap while the offsets are
exact, so the ladder is a guard: any sub-pixel rounding resolves in favour of the higher row
rather than letting a lower row cover it. `5` is the existing value at
`src/public/styles.css:330` and is kept, so the new values sit above it and above all
unpositioned board content.

`.toolbar` currently declares `position: relative` (`src/public/styles.css:175`) so that
`.tb-mark` can centre itself absolutely (`src/public/styles.css:184-187`). `sticky` is also a
positioned value, so the toolbar stays the containing block for that badge and the centring is
preserved. The `relative` declaration is replaced, not supplemented.

The card detail modal is a `<dialog>` opened with `showModal()` (`src/public/board.html:111`),
which paints in the browser's top layer above every `z-index`, so no modal rule changes.

### Contract: the fixed breadcrumb height

`.board-page .toolbar-crumb` sets `height: var(--crumb-h)` and `flex-wrap: nowrap`. Both are
required by the sticky ladder, not cosmetic:

- `height` replaces `min-height` as the operative sizing on the board page, so `--crumb-h` is
  the bar's real height and not a lower bound. A bar whose real height exceeds its declared
  offset leaves a seam of scrolling content between the rows.
- `flex-wrap: nowrap` overrides `flex-wrap: wrap` at `src/public/styles.css:196`. Without it a
  long title wraps the bar onto a second line at narrow widths, the bar becomes taller than
  `--crumb-h`, and `.controls` pins on top of the wrapped line.

Neither declaration reaches `index.html`, whose breadcrumb bar keeps `min-height` and `wrap`.

### Opacity and theming

All three bars already paint an opaque background from a theme token: `.toolbar` uses
`--toolbar-bg`, `.toolbar-crumb` uses `--tile-bg`, `.controls` uses `--paper`. Each token is
a plain hex colour, defined once in the light `:root` block and again in the
`:root[data-theme="dark"]` block at `src/public/styles.css:91`. The change adds no colour,
no token and no media query, and theme handling is therefore complete by construction.

### Non-functional notes

- Performance: `position: sticky` is composited by the browser; three sticky boxes on one page cost nothing measurable. No scroll listener is added.
- Security: none. The change is presentational CSS and one class attribute.
- Observability: none needed. There is no runtime behaviour to log.

## Stages

1. **Fix the measurement contract.** Add `class="board-page"` to the board's `<body>`, declare `--toolbar-h` and `--crumb-h` on that class, and give the board's breadcrumb bar a fixed height and `nowrap`. This stage comes first because every offset in stage 2 depends on those two values being true, and because a wrong `--crumb-h` is the one failure mode that produces a visible seam. Observable at the end: the board renders exactly as it does today, and the breadcrumb bar stays one line at narrow widths and with a long project title.
2. **Pin the stack.** Make `.toolbar` and `.toolbar-crumb` sticky with their offsets and z-index values, and change the `.controls` offset from `top: 0` to the sum of the two. Observable at the end: all three rows stay pinned at every scroll position, `.toolbar-sub` and the KPI strip scroll away beneath them, and the home page is unchanged.

## Data & compatibility

- No data model, no stored state, no migration. Nothing is persisted and nothing is read back.
- No API or interface contract changes. `src/public/app.ts` neither queries nor measures any of the three bars.
- Backward compatibility: the home page shares the two toolbar elements and is protected by the `.board-page` scope. The `.controls` rule keeps its existing selector, `position` and `z-index`; only its `top` value changes.
- Rollback: revert `src/public/board.html` and `src/public/styles.css` and rebuild. There is no partial state to unwind and no rollout to reverse.

## Testing strategy

The repository's tests are `node:test` suites over `src/lib/` and `src/server.ts`. There is
no DOM or CSS test harness, and this plan adds none. Verification is manual, against a built
and served board.

- Stage 1: run the existing suite and confirm it is unaffected. Then compare the board's chrome against the current build at a wide and a narrow viewport, and confirm the breadcrumb bar holds one line with a long project title.
- Stage 2: scroll the board to the bottom and confirm the three rows are pinned, contiguous and correctly ordered. Repeat in the light theme and the dark theme, at a wide and a narrow viewport, with the filter chips row both hidden and shown. Confirm the home page still scrolls its toolbars away. Confirm a card detail modal opens above the pinned rows.
- A later automated pass, if one is ever wanted, belongs to the write-tests skill and would need a browser-driving harness this repository does not have.

## Open questions

1. **Should the home page's toolbar and breadcrumb bar also become sticky?** The brief names the board only, and the two elements are shared markup. Options: leave the home page untouched (recommended — it is what the brief asks for, and the `.board-page` scope makes adding it later a one-selector change), or drop the scope class and pin both pages.
2. **Should the stack behave differently on a short viewport?** Pinned chrome costs 71px permanently, plus the height of `.controls`, which grows when the filter chips row is shown. On a short laptop window that leaves less room for the board. Options: ship as specified with no special case (recommended — the board columns already scroll independently, and a height-based media query would be a second sizing rule to keep in step with `--toolbar-h` and `--crumb-h`), or hide a row below a viewport-height threshold.

## Adjacent opportunities

Not requested, and none of them is written into a criterion, stage or contract.

1. Add `scroll-padding-top` to the root equal to the stack height, so the dependency jump at `src/public/app.ts:161` never lands a card underneath the pinned rows. Recommend building later, as its own small change.
2. Reduce `.column { max-height: 78vh }` (`src/public/styles.css:407`) to account for the taller pinned chrome. Recommend skipping: the columns scroll on their own and the current value still fits.
3. Give the pinned stack a shadow or bottom border when it is stuck. Recommend skipping: the three bars are already set apart by their own background colours, by deliberate design.

## Alternatives considered and rejected

1. Wrap `.toolbar` and `.toolbar-crumb` in one sticky container — adds a DOM element to both shared pages and still needs the container's height as a constant for the `.controls` offset, so it buys nothing.
2. Move `.toolbar-sub` below `.controls` so all three sticky rows are contiguous in the DOM — changes the page's visual order and edits an element the brief puts out of scope.
3. Use `position: fixed` with compensating `padding-top` on the body — takes the bars out of normal flow, needs the same two constants plus a third, and makes the shared markup harder to keep working on the home page.
4. Measure the bar heights in JavaScript with a `ResizeObserver` and write them into custom properties — robust against wrapping and font changes, but adds a script file, a build entry and a runtime dependency to a chrome layer that is CSS-only today; fixing the breadcrumb height achieves the same guarantee in two declarations.
5. Scope the sticky rules with `body:has(.toolbar-sub)` instead of a class — avoids editing `board.html`, but couples the toolbar rules to an element the brief puts out of scope and reads as a trick to the next reader.

## Final summary

- Approach: three CSS `position: sticky` boxes with `top` offsets computed from two new layout custom properties, scoped to the board page by a new `body.board-page` class.
- Size: 2 stages, both small — one class attribute in `src/public/board.html` and roughly a dozen declarations in `src/public/styles.css`. Well under a day.
- Risks: a wrong `--crumb-h` leaves a visible seam between the pinned rows; forcing the breadcrumb bar to one line ellipsizes long titles at narrow widths; the shared toolbar markup means a missed `.board-page` scope would change the home page too.
- Needs your answer: 1) leave the home page's toolbars non-sticky, as recommended? 2) accept 71px of permanent chrome on short viewports with no height media query, as recommended?

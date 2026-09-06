---
id: PLN-21-n34okg
type: plan
workstream: WS-25-u72qbt
slug: card-dependency-highlighting
title: "Clickable dependency links and chain highlighting on board cards"
status: done
created: 2026-08-09
updated: 2026-08-09
depends_on: []
links: []
---

# Clickable dependency links and chain highlighting on board cards

## Summary

The board renders each card's `depends_on` list as one inert, faint text span in the card
footer (`src/public/app.ts:141`). This plan makes that line usable and adds a whole-board view
of a dependency chain.

Two additive, front-end-only behaviours:

1. Each dependency ID in a card footer becomes its own clickable control. A click scrolls the
   board to that dependency's card and flashes it briefly.
2. A click on a card highlights its full dependency chain — every card it depends on and every
   card that depends on it, transitively, in every column — and still opens the existing detail
   modal. The highlight persists until the next card click or a click on the board background.

The chosen approach extends the two delegated listeners already on `#board`
(`src/public/app.ts:738` and `src/public/app.ts:746`) with an early-return branch, holds the
highlight state in IIFE module scope beside `sortKey`, `query` and `workstreams`
(`src/public/app.ts:15-18`), and seeds the highlight class inside `buildCard`
(`src/public/app.ts:75`) so a re-render restores it for free. Only `src/public/app.ts` and
`src/public/styles.css` change. No server, schema, or payload change: `depends_on` is already
extracted (`src/lib/extract.ts:174`) and already typed on the client
(`src/types/praxis-data.d.ts:23`).

## Scope

### Acceptance criteria

Dependency links:

1. A card whose `depends_on` holds three IDs shows three separately clickable IDs in its
   footer, after the existing `⤷` glyph, separated by commas.
2. A user who clicks a dependency ID sees the board scroll until that dependency's card is
   visible, in both the horizontal board scroller and the vertical column scroller.
3. The dependency's card shows a coloured outline for about one second after the scroll, then
   the outline disappears.
4. A user who clicks a dependency ID does not see the detail modal open.
5. A user who presses Enter or Space on a focused dependency ID gets the same scroll and flash,
   and does not see the detail modal open.
6. A user who clicks a dependency ID whose card is absent from the board sees nothing happen.
   The page shows no error and the console logs no error. A card is absent when the target
   workstream does not exist, or when the current search filter removed it
   (`src/public/app.ts:167`).
7. A user with `prefers-reduced-motion: reduce` sees the board jump to the target immediately,
   with no smooth scroll and no fade.

Chain highlighting:

8. A user who clicks a card sees that card and every card in its transitive dependency chain
   outlined, in every column. The chain includes cards the clicked card depends on, cards that
   depend on the clicked card, and every further hop in both directions.
9. The clicked card carries a stronger outline than the other chain members.
10. A user who clicks a card still sees the detail modal open, with the same tab selection rule
    the code uses today (`src/public/app.ts:744`).
11. The chain outline stays on screen after the user closes the modal.
12. A user who clicks a different card sees the previous chain outline replaced by the new
    card's chain.
13. A user who clicks the board or column background sees the chain outline disappear.
14. A user who changes the sort key, the sort direction, or the search text keeps the chain
    outline on every chain card that is still on the board.
15. A poll that finds changed data (`src/public/app.ts:802`) re-renders the board and keeps the
    chain outline. A poll that finds unchanged data does not touch the board.
16. A dependency graph that contains a cycle produces a finite chain and does not hang the page.
17. The outline is readable in the light theme and the dark theme, under both the
    `prefers-color-scheme` default and the explicit `data-theme` override.

### Out of scope

- Any server, extractor, or schema change. The client already holds everything it needs.
- Drawing connector lines or arrows between cards.
- Any change to the detail modal's content, tabs, or behaviour.
- Filtering the board down to a chain, or any new control in the toolbar.
- Showing reverse dependencies ("depended on by") as text in the card footer. Only the existing
  `depends_on` line becomes interactive.
- Deep-linking a chain through the URL.

### Assumptions

These are decisions the request left open. Each is taken here with a stated reason. Any of them
can be reversed without changing the plan's structure.

- **A1 — Root card styling.** The clicked card gets a distinct, stronger treatment
  (`is-chain-root`) than the other chain members (`is-chain`). Reason: without it the user
  cannot tell which card produced the highlight, which defeats the purpose when the chain
  spans several columns.
- **A2 — Dependency click and chain highlight are independent.** A dependency-link click
  scrolls and flashes only. It does not set a chain highlight, and it does not clear an existing
  one. Reason: the two gestures answer two different questions, and the early return that keeps
  the modal closed gives this behaviour with no extra code.
- **A3 — Unresolvable dependency target.** A silent no-op, with no tooltip, no message, and no
  visual state on the link itself. Reason: the request asks for a no-op, and a dangling ID is a
  data problem in the source project, not a board problem.
- **A4 — Dependency links are keyboard reachable.** Each link gets `tabindex="0"` and
  `role="link"`. Reason: the request explicitly asks the keydown handler to early-return for a
  focused dependency link, which only matters if the link can take focus. See the accessibility
  note in Design.
- **A5 — Re-clicking the same card does not toggle the chain off.** A card click always sets
  the chain to that card's chain. Reason: the request says the highlight persists "until
  something else is clicked", and a toggle would make the modal open with no highlight on the
  second click.
- **A6 — The flash is transient and is not restored by a re-render.** If a data-change poll
  re-renders the board while a flash is on screen, the flash is lost. Reason: the flash is a
  sub-second navigation cue, and the window for the collision is tiny.
- **A7 — Release constraints.** There is no production deployment, no live user, and no
  persisted state for this feature. The board is a local read-only dashboard
  (`README.md`, "read-only and non-interactive by design"). No feature flag, no dark launch,
  and no migration is planned. See Open questions if this is wrong.

## Design

### What already exists and is reused

| Existing thing | Location | How this feature uses it |
|---|---|---|
| `el(tag, cls, text)` helper | `src/public/app.ts:25` | Builds every new element. No new helper. |
| Module-scope state that survives re-render | `src/public/app.ts:15-18` | Holds the new highlight state the same way. |
| `buildCard(w)` | `src/public/app.ts:75` | Emits the new footer links and seeds the highlight class. |
| One delegated `click` listener on `#board` | `src/public/app.ts:738` | Gains an early-return branch, exactly like the `.artefact-row` test at line 743. |
| One delegated `keydown` listener on `#board` | `src/public/app.ts:746` | Gains the same early-return branch. |
| `applyData(raw)` | `src/public/app.ts:863` | Rebuilds the dependency index when it replaces `workstreams`. |
| `renderBoard()` | `src/public/app.ts:148` | Unchanged. It calls `buildCard`, which does the seeding. |
| `.card-foot .deps` rule | `src/public/styles.css:365` | Stays as the container's style. The new link rule sits under it. |
| The `--accent` link colour precedent | `src/public/styles.css:122` | The dependency links use `--accent` for text colour, like every other link. |
| The one reduced-motion transition rule | `src/public/styles.css:454-456` | Extended with `box-shadow`, not duplicated. |
| The four theme blocks | `src/public/styles.css:9`, `:49`, `:85`, `:97` | Each gains the two new colour variables. |

No new dependency, no new file, no new build step.

### New module-scope state

All of it lives inside the existing IIFE, next to `sortKey` and `query`. Nothing is added to
`window`, and nothing is persisted.

```ts
// Dependency graph, rebuilt whenever applyData replaces `workstreams`.
var dependsOn: Record<string, string[]> = {};   // WS id -> the ids it declares in depends_on
var dependedBy: Record<string, string[]> = {};  // WS id -> the ids that declare it

// Chain highlight. Both are null when nothing is highlighted.
var chainRoot: string | null = null;            // the clicked card's id
var chainSet: Record<string, true> | null = null; // every id in the root's chain, root included

// Flash. One at a time.
var flashId: string | null = null;
var flashTimer: number | null = null;
```

### New function contracts

Define these before any phase references them.

```ts
// Rebuilds `dependsOn` and `dependedBy` from `workstreams` in one pass.
// Records an edge only when both ends name a workstream that exists, so a dangling
// depends_on entry never enters the graph.
function buildDepIndex(): void;

// Every id reachable from `id` by following dependsOn and dependedBy edges in both
// directions, `id` itself included. A visited map makes cycles and self-references safe.
// Returns an empty-but-non-null map when `id` is unknown.
function chainOf(id: string): Record<string, true>;

// Sets the chain root and recomputes `chainSet`, then repaints. Pass null to clear.
function setChain(id: string | null): void;

// Adds or removes `is-chain` / `is-chain-root` on every card currently in the DOM, to match
// `chainSet` and `chainRoot`. Touches classes only. Never re-renders.
function paintChain(): void;

// Scrolls the board to the card for `id` and flashes it. A no-op when no such card is in
// the DOM. Cancels any flash already running.
function jumpToDep(id: string): void;
```

`setChain` calls `paintChain` rather than `renderBoard`. This matters: `renderBoard`
(`src/public/app.ts:148`) clears `#board` and rebuilds every column, which would drop keyboard
focus and reset each column's scroll position on every card click. A class toggle over the
cards already in the DOM costs one pass and disturbs nothing.

`buildCard` seeds the same two classes from `chainSet` and `chainRoot` when it builds a card.
That is what makes the highlight survive a sort change, a search change, and a data-change
re-render, with no extra pass and no post-render fix-up.

### Changed footer DOM contract

`src/public/app.ts:141` today appends one span holding joined text. It becomes one container
span holding one child element per dependency ID:

```html
<span class="deps">
  ⤷ <span class="dep-link" role="link" tabindex="0" data-dep="WS-5">WS-5</span>,
    <span class="dep-link" role="link" tabindex="0" data-dep="WS-9">WS-9</span>
</span>
```

The `⤷ ` prefix and the `, ` separators are plain text nodes inside `.deps`, so they are not
clickable. `data-dep` carries the exact ID, which matches `card.dataset.ws`
(`src/public/app.ts:78`) byte for byte, so `#board .card[data-ws="WS-5"]` resolves a target
with one `querySelector`.

### Event flow

Both delegated listeners keep their single-listener shape. The comment at
`src/public/app.ts:735-737` explains why, and it still holds.

Click listener, in order:

1. `closest('.dep-link')` — if it hits, call `jumpToDep(link.dataset.dep)` and **return**. The
   modal code below never runs, and neither does the chain code. This is the same shape as the
   existing `.artefact-row` test.
2. `closest('.card')` — if it misses, the click landed on column or board background: call
   `setChain(null)` and return.
3. Otherwise: call `setChain(card.dataset.ws)`, then `openModal(...)` exactly as today. Both
   happen, in that order, on one click.

Keydown listener, in order:

1. Key is not Enter, Space, or Spacebar — return, unchanged.
2. `closest('.dep-link')` — if it hits, `preventDefault()`, `jumpToDep(...)`, and **return**.
3. Otherwise: the existing card path, plus `setChain(card.dataset.ws)` before `openModal`.

No `stopPropagation` anywhere, no per-card listener, nothing to clean up on re-render.

### Scrolling and flashing

`jumpToDep` calls `scrollIntoView({ behavior, block: 'nearest', inline: 'nearest' })` on the
target card. One call covers both scroll containers — the horizontal `.board`
(`src/public/styles.css:277-283`) and the vertical `.column-body` under its 78vh column cap
(`src/public/styles.css:292`, `:316`). `behavior` is `'smooth'` normally and `'auto'` when
`matchMedia('(prefers-reduced-motion: reduce)').matches` is true.

The flash adds `is-flash` to the target card, records `flashId`, and sets a timer to remove the
class after about 900 ms. A second dependency click clears the pending timer and removes the
class from the previous target first, so two rapid clicks never leave a stuck outline.

The fade-out comes from the extended `box-shadow` transition inside the existing
`prefers-reduced-motion: no-preference` block, not from a keyframe animation. The file has no
`@keyframes` today and gains none.

### CSS contract

Two new variables, added in all four theme blocks (`src/public/styles.css:9`, `:49-50`, `:85`,
`:97`):

- `--chain` — the outline colour for a highlighted card and for the flash.
- `--chain-soft` — the wider, lower-contrast halo used only by the root card.

They are deliberately not `--accent`. `--accent` already means focus or active state in seven
or more `:focus-visible` rules, so reusing it would make a highlighted card read as focused.

Three new rules on `.card`, all built on `box-shadow`:

```css
.card.is-chain      { box-shadow: 0 0 0 2px var(--chain); }
.card.is-chain-root { box-shadow: 0 0 0 2px var(--chain), 0 0 0 5px var(--chain-soft); }
.card.is-flash      { box-shadow: 0 0 0 2px var(--chain); }
```

`box-shadow` is used rather than `outline` or `border` because `.card:focus-visible` already
owns `outline` (`src/public/styles.css:261`) and because a border-width change would move the
card's content. `box-shadow` paints outside the box and costs no layout.

One new rule pair for the links:

```css
.card-foot .deps .dep-link { color: var(--accent); cursor: pointer; }
.card-foot .deps .dep-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
```

One existing rule is extended, not duplicated:

```css
@media (prefers-reduced-motion: no-preference) {
  .card { transition: border-color 120ms ease, box-shadow 300ms ease; }
}
```

### Module boundaries

The new code is one cohesive group inside the existing IIFE. Its responsibilities:

- The graph functions (`buildDepIndex`, `chainOf`) know about the shape of `PraxisWorkstream`
  and nothing else. They must not touch the DOM, read `query` or `sortKey`, or know that a
  highlight exists.
- The paint functions (`paintChain`, `jumpToDep`) know about the DOM and the class names. They
  must not walk the graph, must not call `renderBoard`, and must not open the modal.
- `setChain` is the only thing that writes `chainRoot` and `chainSet`.
- `buildCard` reads `chainSet` and `chainRoot` and must not write them.
- `openModal` is untouched and learns nothing about the chain.

### Non-functional notes

- **Performance.** The graph is rebuilt only inside `applyData`, which already runs a full
  re-render on the same call. Board size is tens of workstreams. `chainOf` is one traversal
  per card click, bounded by the visited map. `paintChain` is one pass over the cards in the
  DOM. None of this is measurable.
- **Security.** No new input, no new network call, no new endpoint, no `innerHTML`. Every ID
  reaches the DOM through `textContent` and `dataset`, matching the file's existing rule
  (`src/public/app.ts:788`).
- **Observability.** None is added. The feature is a local, front-end interaction with no
  failure mode worth logging, and the project has no client logging convention.
- **Accessibility caveat.** The dependency links sit inside `.card`, which carries
  `role="button"` (`src/public/app.ts:79`). Nesting a focusable `role="link"` inside a
  `role="button"` is not valid ARIA, and a screen reader may flatten or mis-announce it. The
  plan accepts this because the request requires the links to be keyboard-reachable (A4). The
  alternative is in Open questions.

## Staged task breakdown

Three phases. Each leaves the board working and each is demonstrable on its own.

### Phase 1 — Clickable dependency links, scroll and flash

**Build.** Split the footer `deps` span into one `.dep-link` per ID. Add `jumpToDep`, the
`flashId` and `flashTimer` state, and the `.dep-link` early-return branch in both delegated
listeners. Add `--chain` and `--chain-soft` to all four theme blocks, the `.is-flash` rule, the
`.dep-link` rules, and the `box-shadow` term in the reduced-motion transition.

**Files.** `src/public/app.ts` (`buildCard` footer at line 138-143; the click listener at line
738; the keydown listener at line 746; new module-scope state near line 15-23).
`src/public/styles.css` (lines 9, 49-50, 85, 97 for the variables; near line 365 for the link
rules; line 454-456 for the transition).

**Effort.** Small.

**Depends on.** Nothing.

**Verify.** Run `npm start` and open a board of a project whose workstreams declare
`depends_on`. Click a dependency ID on a card in one column whose target sits in a different
column. The board scrolls to the target, the target flashes, and the modal stays closed. Tab to
a dependency link and press Enter: same result. Click a dependency ID for a workstream that does
not exist: nothing happens and the console stays clean. Set the OS reduce-motion setting and
repeat: the board jumps instead of gliding. Covers acceptance criteria 1 to 7.

### Phase 2 — Chain highlight on card click

**Build.** Add `dependsOn`, `dependedBy`, `chainRoot`, `chainSet`, and the functions
`buildDepIndex`, `chainOf`, `setChain`, `paintChain`. Call `buildDepIndex` inside `applyData`
immediately after it assigns `workstreams`. Seed `is-chain` and `is-chain-root` in `buildCard`.
Call `setChain(card.dataset.ws)` before `openModal` in both listeners, and `setChain(null)` on
the background-click path. Add the `.is-chain` and `.is-chain-root` CSS rules.

**Files.** `src/public/app.ts` (new state near line 15-23; new functions near `buildCard` at
line 75; `buildCard` card creation at line 76; the two listeners at lines 738 and 746;
`applyData` at line 863-865). `src/public/styles.css` (near line 365).

**Effort.** Medium.

**Depends on.** Phase 1, for the two colour variables.

**Verify.** Click a card that sits in a multi-hop chain. Every card in the chain is outlined
across all columns, the clicked card is outlined more strongly, and the detail modal opens.
Close the modal: the outlines remain. Click a different card: the outlines move to the new
chain. Click empty space in a column: the outlines disappear. Change the sort key and the search
text: the outlines stay on every chain card still on the board. Covers acceptance criteria 8 to
14.

### Phase 3 — Robustness and presentation pass

**Build.** Prune a stale root inside `applyData`: after `buildDepIndex`, if `chainRoot` no
longer names a workstream in the new data, clear `chainRoot` and `chainSet`; otherwise recompute
`chainSet` from the new graph before `renderBoard()` runs at line 1048. Confirm the visited map
in `chainOf` handles a cycle and a self-reference. Tune the two colour values for contrast in
both themes.

**Files.** `src/public/app.ts` (`applyData` at line 863-865). `src/public/styles.css` (the four
theme blocks).

**Effort.** Small.

**Depends on.** Phase 2.

**Verify.** Highlight a chain, then edit the source project's `workstream.md` files so a poll
picks up a change: within five seconds the board re-renders and the highlight is still correct.
Delete or archive the highlighted root workstream in the source project and wait for the next
poll: the highlight clears and nothing throws. Hand-edit two workstreams into a
`depends_on` cycle and click one: the page stays responsive and both cards are outlined. Check
the outline against the light theme and the dark theme, under the OS preference and under the
explicit `data-theme` toggle. Covers acceptance criteria 15 to 17.

## Data & compatibility

- **Migrations.** None. No data is written, read from disk, or persisted anywhere.
- **Payload compatibility.** The `/api/projects/:id/data` response is unchanged.
  `depends_on` is already present on every workstream (`src/types/praxis-data.d.ts:23`,
  `src/lib/extract.ts:174`), and `extract.ts` already normalises a scalar or missing value into
  an array, so a card with no dependencies keeps its current footer exactly.
- **Existing behaviour.** The only changed existing behaviour is that a card click now sets a
  highlight in addition to opening the modal, and that a click on a footer dependency ID no
  longer opens the modal. Every other click target on a card, including the `.artefact-row`
  plan deep link at `src/public/app.ts:743`, behaves as before, because the new branch is
  tested and returns before that code.
- **Server and CLI.** `npm run refresh` and `src/scripts/extract-praxis-data.ts` are untouched.
- **Rollback.** Fully reversible at any point. Revert the commits for the two files. There is
  no state to unwind, no stored preference, and no consumer outside these two files. A partial
  rollback is also safe: Phase 1 stands alone without Phase 2, and Phase 2 without Phase 3
  leaves only the stale-root edge case.

## Testing strategy

The repository has no test framework and no `test` script (`package.json` lines 10-16), and it
has no runtime dependency by design (`README.md`, Notes). This plan does not add one. Adding a
browser test harness is a separate decision, out of this feature's scope.

Verification therefore has two layers.

**Static.** `npm run build` runs both TypeScript compilations. It is the gate for every phase:
`src/public/tsconfig.json` type-checks the browser code, so a wrong `dataset` key, a missing
null guard, or a bad element type fails the build.

**Manual.** Each phase above carries its own verification steps. Run them in order against a
real project board, not a fixture. The cases worth repeating at the end of Phase 3:

- A card with no dependencies, one dependency, and several dependencies.
- A dependency target in the same column and in a different column.
- A dependency target that does not exist, and one hidden by the search filter.
- A chain of three or more hops, and a chain that reaches into a `dropped` column.
- A cycle and a self-reference.
- Both themes, both under the OS preference and under the explicit `data-theme` override.
- Reduced motion on and off.
- Keyboard only: Tab to a card, Enter; Tab to a dependency link, Enter.

If a test-writing pass is commissioned later, `chainOf` and `buildDepIndex` are the two
functions worth unit coverage: they are pure over `workstreams` and hold all the traversal
logic, including the cycle guard. They would need to be reachable from outside the IIFE first,
which is a structural change this plan does not make.

## Open questions

1. **Release constraints.** This plan assumes there is no deployment, no live user, and no
   rollback obligation, because the dashboard is a local read-only tool (A7). If the dashboard
   is in fact served to other people, say so — the answer does not change the design, but it
   changes whether the three phases can land separately or must land together.
   *Recommendation: confirm A7 and land the phases separately.*
2. **The nested-interactive accessibility trade-off.** The dependency links are focusable
   controls inside a card that carries `role="button"`, which is invalid ARIA (see Design).
   Option (a) accept it, as planned, and keep the links keyboard-reachable. Option (b) make the
   links mouse-only with no `tabindex`, which is valid ARIA but leaves keyboard users without
   the feature. Option (c) drop `role="button"` from the card and open the modal from a real
   control inside it, which is correct but touches existing behaviour outside this feature's
   scope. *Recommendation: option (a), which is what the request's own note about the keydown
   early return implies.*
3. **The two new colour values.** The plan fixes the variable names, the four places they are
   declared, and the `box-shadow` mechanism, but not the hex values. They need to be picked
   against the light and dark palettes and must not read as `--accent`. *Recommendation: pick
   them during Phase 3 with both themes side by side, rather than guessing them in Phase 1.*
4. **Chain highlight for a `dropped` card.** `.card.is-dropped` sets `opacity: 0.68`
   (`src/public/styles.css:327`), which dims the outline along with the card. Option (a) leave
   it dimmed. Option (b) exempt the outline from the fade. *Recommendation: option (a), until
   it proves hard to see in practice.*

## Alternatives considered and rejected

- **Per-card click listeners with direct DOM mutation.** Attach a listener to each card in
  `buildCard` and toggle classes directly. Rejected: `renderBoard()` rebuilds `#board`'s
  contents on every sort, direction, and search change, so the listeners would be re-created
  continuously. The file already rejected this pattern for the same reason and says so in the
  comment at `src/public/app.ts:735-737`.
- **Native anchors with `:target` styling.** Render each dependency ID as `<a href="#WS-5">`,
  give each card an `id`, and style the jumped-to card with `:target` and `scroll-margin`.
  Rejected on three counts: it puts workstream IDs into the document's global `id` namespace
  alongside `board`, `lower`, `live-status` and the rest; it pushes a hash onto the URL, which
  pollutes the back button on a page whose URL already carries the `?project=` identity; and
  `:target` is permanent, so a flash that fades after a second is not expressible without
  scripting the class removal anyway.
- **Re-rendering the board on every card click.** Call `renderBoard()` from `setChain` and let
  `buildCard` do all the class work, with no `paintChain`. Rejected: `renderBoard` clears
  `#board` and rebuilds all six columns, so every card click would drop keyboard focus and
  reset each column's scroll position, and the click that just opened the modal would destroy
  the element it came from.
- **Drawing connector lines between related cards.** An SVG or canvas overlay with arrows from
  each card to its dependencies. Rejected: the request does not ask for it, and the board has
  two nested scroll containers, so every line would need repositioning on every scroll, sort,
  search and resize. That is a far larger feature with a much worse cost-to-value ratio than an
  outline.
- **Computing the reverse index inside `renderBoard`.** Rejected: `renderBoard` runs on every
  keystroke in the search box, while the graph only changes when `applyData` replaces
  `workstreams`. Building it in `applyData` puts the work where the data changes and keeps
  `renderBoard` a pure view pass, matching how `sevMix` is handled today
  (`src/public/app.ts:158-164`).
- **Extracting the graph on the server.** Ship a precomputed adjacency map in the payload.
  Rejected: it breaks the stated front-end-only scope, changes the API contract for a
  computation that costs one pass over tens of records, and would put a view concern into
  `src/lib/extract.ts`.

## Final summary

Chosen approach: extend the two existing delegated `#board` listeners with early-return
branches, hold the chain state in IIFE module scope, and seed the highlight class in
`buildCard` so re-renders restore it for free.

Three phases: dependency links with scroll and flash (small), chain highlight on card click
(medium), robustness and colour pass (small). Two files change, `src/public/app.ts` and
`src/public/styles.css`. Fully reversible by revert.

Top risks: the nested-interactive ARIA trade-off on the dependency links; the two new colour
values needing real contrast work in four theme blocks; and the stale-root case when a poll
removes the highlighted workstream, which Phase 3 exists to close.

Needs your answer: the four Open questions, above all question 2 (accept the ARIA trade-off, or
drop keyboard access) and question 1 (confirm there is no release constraint).

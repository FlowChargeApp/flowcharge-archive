---
id: PLN-57-oevt8p
type: plan
workstream: WS-68-6c1lua
slug: card-relationship-visualization
title: "Two-kind relationship display: depends_on and links on board cards"
status: ready
created: 2026-08-25
updated: 2026-08-25
depends_on: []
links: []
---

# Two-kind relationship display: depends_on and links on board cards

## Summary

The board shows one relationship kind today. `buildCard` renders `depends_on` as a `⤷` run of
clickable IDs in the card footer (`src/public/app.ts:307-321`), and a card click paints the whole
transitive dependency chain (`src/public/app.ts:191-226`). The `links` relationship is invisible: it
is not read by the extractor, not typed on the payload, and not drawn anywhere.

This plan makes both kinds visible and tells them apart with four simultaneous cues — glyph,
position, ring style, and colour — while extending the WS-25 machinery rather than replacing it.

The chosen approach is **extend in place**:

1. Read `links` in `src/lib/extract.ts` and type it on `PraxisWorkstream`, using the same
   array-coercion the file already applies to `depends_on` and `tags`
   (`src/lib/extract.ts:189,192`). Two lines, matching commit `befaec1`.
2. Build one extra, **mirrored** client-side edge map, `linkedWith`, beside the existing
   `dependsOn` / `dependedBy` pair. Mirroring is mandatory: the real data is not reciprocal.
3. Add a second footer run, `.rels`, as a sibling of the existing `.deps` span. `.deps` and its
   DOM keep their exact current shape, so the dependency path is regression-free by construction.
4. Reuse the existing `.dep-link` class and `data-dep` attribute for link IDs, so **neither
   delegated `#board` listener changes at all** (`src/public/app.ts:1057-1084`).
5. Paint soft links as a **one-hop, dashed** ring from the clicked card only, in its own colour
   token, while the transitive solid chain stays exactly as WS-25 built it.
6. Add a relationships block to the card-detail modal's meta region, which shows none today
   (`src/public/board.html:115-125`), so the complete list survives the footer cap.

No SVG overlay, no new file, no new dependency, no new network call, no schema or ID change.
Six files change: `src/lib/extract.ts`, `src/types/praxis-data.d.ts`, `src/lib/extract.test.ts`,
`src/public/app.ts`, `src/public/styles.css` and `src/public/board.html`.

## Scope

### Acceptance criteria

Payload:

1. A workstream whose `workstream.md` holds `links: [WS-2-bg6ela]` arrives at the client with
   `links` equal to `["WS-2-bg6ela"]`.
2. A workstream with no `links` key, an empty `links: []`, or a scalar `links: WS-2-bg6ela` arrives
   with `links` equal to `[]`, `[]`, and `["WS-2-bg6ela"]` respectively.
3. `links` is present on every workstream in the payload, never absent and never `undefined`.

Footer:

4. A card whose own frontmatter declares `links` shows a `⇄` run of those IDs in its footer.
5. A card that is *named by* another workstream's `links`, and declares none itself, shows that
   other workstream's ID in its own `⇄` run. WS-15 shows `⇄ WS-16-sg71an` although its own `links`
   is empty.
6. A card that has both kinds shows the `⤷` dependency run first and the `⇄` link run second, on
   the same footer line when both fit.
7. A user who clicks or presses Enter on an ID in the `⇄` run gets the same scroll and flash a
   dependency ID gives today, and the detail modal stays closed.
8. A card footer never shows more than `REL_FOOTER_MAX` IDs per kind. The surplus collapses into
   one `+k` marker whose hover text names every hidden ID.
9. A user who clicks the `+k` marker sees the detail modal open, because the marker is inert and
   the click reaches the card.
10. A card with no relationship of either kind keeps exactly the footer it has today.
11. A footer too wide for the 268px column wraps onto a second line instead of overflowing it.

Highlight:

12. A user who clicks a card sees its transitive `depends_on` chain outlined exactly as today —
    same colour, same solid ring, same root treatment, same transitive walk in both directions.
13. The same click also outlines every card **one hop** away along `links` from the clicked card,
    with a dashed ring in a colour that is not `--chain`.
14. A card that is both the root and a link neighbour paints as root. A card that is both a chain
    member and a link neighbour paints as a chain member. Root beats chain beats link.
15. A link neighbour more than one hop away from the clicked card is not outlined.
16. The dashed link ring survives a sort change, a sort-direction change, a search change, and a
    poll that finds changed data, on every card still on the board.
17. A click on the board or column background clears the dashed ring together with the chain.
18. The dashed ring is readable in the light theme and the dark theme, under both the
    `prefers-color-scheme` default and the explicit `data-theme` override, and is not confusable
    with the chain ring, the focus ring, or any status or severity colour.

Modal:

19. A user who opens a card with either kind of relationship sees a relationships block in the
    modal's meta region, above the tabs, listing every ID of both kinds with no cap.
20. The block names the two kinds in words — "Depends on" and "Related" — so the glyphs are not
    the only way to learn what the runs mean.
21. A user who opens a card with neither kind sees no relationships block and no empty label.

### Out of scope

- Any SVG, canvas, or overlay drawing of connector lines or arrows between cards. See Alternatives.
- Reverse dependencies ("depended on by") anywhere in the footer or the modal. WS-25 put that out
  of scope and this plan keeps it out. Open question 3.
- Making the modal's relationship IDs clickable jump targets. Open question 2.
- Any change to `depends_on` semantics, its transitive walk, its glyph, its colour, or its
  `.deps` DOM, beyond the shared footer cap in criterion 8.
- Any change to the board's filters, sort controls, search, KPI strip, or lower panels.
- Any writeback to the source project, any schema change, any ID-format change.
- Fixing the pre-existing silent no-op when a jump target is absent from the DOM. See
  Out-of-scope observations.
- A legend, a key, or any new toolbar control.
- Deep-linking a highlight through the URL.

### Assumptions

Each is a decision the request left open. Each is taken here with a stated reason, and each can be
reversed without changing the plan's structure.

- **A1 — `links` is undirected and mirrored.** The client records every `links` entry as an edge in
  both directions. Reason: the real data proves it is not reciprocal. `WS-16-sg71an` names
  `WS-15-o60iyw` and `WS-15-o60iyw` names nothing; `WS-27-wg5q18` names `WS-5-kxteoh` and
  `WS-5-kxteoh` names nothing back. Without mirroring, half of every relationship stays invisible on
  one of the two cards.
- **A2 — The link footer run is drawn from the mirrored index, not from `w.links`.** A2 is what
  makes criterion 5 true. It has one consequence: a `links` entry naming a workstream that does not
  exist is dropped and never rendered, because the index records an edge only when both ends are
  known. The dependency run keeps rendering raw `w.depends_on`, dangling IDs included, because
  changing that would be a dependency-side regression. The asymmetry is deliberate. Open question 6.
- **A3 — One hop, from the clicked card only.** The dashed ring reaches the clicked card's direct
  link neighbours. It does not reach link neighbours of chain members, and it does not walk further
  along `links`. Reason: a soft link is explicitly non-transitive, and a second hop on a board this
  dense would outline most of a column.
- **A4 — Precedence is resolved in the data, not only in CSS.** `linkSet` is computed with the root
  and every chain member removed, so a card never carries two highlight classes at once. Reason: it
  makes the precedence rule readable in one place and stops CSS source order from being
  load-bearing.
- **A5 — `REL_FOOTER_MAX` is 3, per kind.** Reason: this repository's largest relationship list holds
  two IDs, and the largest mirrored link degree is two, so 3 leaves headroom and truncates nothing
  today while still bounding an unfamiliar project's card.
- **A6 — The `+k` marker is inert.** It carries no `role`, no `tabindex`, and no listener, so a click
  bubbles to the card and opens the modal, which is where the full list lives. Reason: it is the
  behaviour the request wants and it costs no code.
- **A7 — The dependency footer run is capped too.** Criterion 8 applies to both kinds. Reason: a cap
  on one kind only would make a long dependency list the new clutter. Today's data never reaches the
  cap, so no card on this board changes. Open question 4.
- **A8 — The modal relationship IDs are plain text.** They are not clickable and not focusable,
  matching the tags and dates already in that region. Reason: a jump from inside a `<dialog>` needs a
  close-then-scroll interaction the request does not ask for. Open question 2.
- **A9 — Both footer runs get a `title` attribute** naming their kind, so hovering explains the
  glyph. Reason: the constraint forbids a legend being the only way to tell the kinds apart, and a
  per-run tooltip is the cheapest non-legend affordance. Adding `title` to the existing `.deps` span
  is additive and changes no behaviour.
- **A10 — The dashed ring appears and disappears instantly.** It is a pseudo-element, so the
  `.card` transition in the reduced-motion block does not reach it
  (`src/public/styles.css:511-513`). Reason: it is a state, not a flash, and WS-25's fade exists for
  the transient jump flash only.
- **A11 — Release constraints.** There is no deployment, no live user, no production data, and no
  persisted client state. The dashboard is a local desktop and localhost tool that re-extracts every
  board on request. No feature flag, no dark launch, no migration, no rollback obligation beyond
  `git revert`. Open question 5.
- **A12 — The existing names stay.** `jumpToDep`, `setChain`, `paintChain` and `chainOf` keep their
  names although two of them now serve both kinds. Reason: the constraint is that the WS-25
  mechanism keeps working exactly as today, and the smallest diff is the strongest evidence of that.
  A comment records the widened contract. This is a readability cost taken knowingly.

## Design

### What already exists and is reused

| Existing thing | Location | How this feature uses it |
|---|---|---|
| Array coercion for `depends_on` and `tags` | `src/lib/extract.ts:189,192` | Copied verbatim for `links`. |
| `blocked` field precedent | commit `befaec1` | The same two-file, two-line shape. |
| `withFixtureProject` and `WORKSTREAM_FILE` | `src/lib/extract.test.ts:64-123` | Gains an override parameter; existing tests untouched. |
| `el(tag, cls, text)` | `src/public/app.ts:68` | Builds every new element. No new helper. |
| Module-scope state that survives re-render | `src/public/app.ts:44-66` | Holds `linkedWith` and `linkSet` the same way. |
| `buildDepIndex` | `src/public/app.ts:169-184` | Gains a sibling; its own "both ends known" rule is factored out. |
| `setChain` / `paintChain` | `src/public/app.ts:210-226` | Extended to the third class. Still the only writer / only painter. |
| `buildCard` class seeding | `src/public/app.ts:229-235` | Seeds the third class the same way, so re-render restores it free. |
| `.dep-link` + `data-dep` + `jumpToDep` | `src/public/app.ts:142-164,307-321` | Reused unchanged for link IDs. Zero listener edits. |
| The two delegated `#board` listeners | `src/public/app.ts:1057-1084` | **Unchanged.** |
| `applyData`'s index-rebuild and stale-root prune | `src/public/app.ts:1189-1205` | The new index is rebuilt on the same line group. |
| `renderModalMeta` | `src/public/app.ts:942-999` | Gains one show/hide block, same shape as the tags block. |
| `#ws-modal-meta` scroll cap | `src/public/styles.css:781-784` | Already absorbs a taller meta region. WS-65 built it. |
| The four theme blocks | `src/public/styles.css:9,53,93,106` | Each gains one variable, exactly as `--chain` was added. |
| `.card-foot .deps` rule | `src/public/styles.css:414` | Gains `.rels` as a second selector. DRY, one rule. |

No new package, no new file, no new build step. `tools/bundle-public.mjs` needs no change: `app.ts`
stays the single entry point.

### Contract 1 — the payload

`src/types/praxis-data.d.ts:23`, one line after `depends_on`:

```ts
interface PraxisWorkstream {
  // …
  depends_on: string[];
  links: string[];        // NEW — always an array, never absent
  // …
}
```

Required, not optional, and deliberately unlike `blocked?: string`: the extractor coerces it to an
array on every record, exactly as it already does for `depends_on` and `tags`, so an optional type
would describe a state that cannot occur.

`src/lib/extract.ts`, one line after line 192:

```ts
links: Array.isArray(wsFm.links) ? wsFm.links : (wsFm.links ? [wsFm.links] : []),
```

Nothing else on the Node side changes. `/api/projects/:id/data` in `src/server.ts` and the Electron
`getProjectData` handler at `electron/ipc-handlers.cts:94-96` both proxy whatever
`extractPraxisData()` returns, so the field rides the existing transport with no edit.

### Contract 2 — the client relationship model

New module-scope state, inside the existing IIFE beside `dependsOn` and `chainSet`
(`src/public/app.ts:61-64`). Nothing goes on `window` and nothing is persisted.

```ts
// Undirected and MIRRORED: an entry in either end's `links` puts both ids in the
// other's list. Deduped, self-edges dropped, and — like dependsOn — an edge is
// recorded only when both ends name a workstream that exists.
var linkedWith: Record<string, string[]> = {};

// The clicked card's DIRECT link neighbours, with the root and every chain member
// already removed (A4). Null when nothing is highlighted.
var linkSet: Record<string, true> | null = null;
```

New and changed function contracts. Define these before any phase references them.

```ts
// The "both ends must exist" rule, stated once. buildDepIndex switches to it so
// the rule cannot drift between the two indexes.
function knownIds(): Record<string, true>;

// Rebuilds `linkedWith` from `workstreams` in one pass. For every w and every id
// in w.links: skip an unknown id, skip w.id itself, then push each end onto the
// other's list unless it is already there. Touches no DOM, reads no view state.
function buildLinkIndex(): void;

// UNCHANGED contract, one-line body change: it now calls knownIds().
function buildDepIndex(): void;

// UNCHANGED contract and behaviour. depends_on only, transitive, both directions.
function chainOf(id: string): Record<string, true>;

// WIDENED: still the only writer of chainRoot and chainSet, and now also of
// linkSet. It sets linkSet to the one-hop neighbours of `id` in linkedWith, minus
// `id` itself and minus every member of chainSet, then calls paintChain(). Null
// clears all three. It still never calls renderBoard.
function setChain(id: string | null): void;

// WIDENED: one class-only pass that now toggles three classes — is-chain,
// is-chain-root and is-linked — over the cards currently in #board. It still
// never re-renders, never walks a graph and never opens the modal.
function paintChain(): void;

// The IDs a card's footer shows for one kind, already capped.
// Returns the visible slice and the hidden remainder, so the caller renders the
// run and the +k marker from one call.
function footerRun(ids: string[]): { shown: string[]; hidden: string[] };
```

`jumpToDep` (`src/public/app.ts:142-164`) is **not changed**. Its comment gains one line saying it
now serves both relationship kinds, because both render `.dep-link` elements carrying `data-dep`.

### Contract 3 — the footer DOM

`buildCard`'s footer (`src/public/app.ts:305-322`) today appends `.updated` and, when
`w.depends_on` is non-empty, one `.deps` span. It gains a third, independent sibling:

```html
<div class="card-foot">
  <span class="updated">created 2026-08-09 · updated 2026-08-09</span>
  <span class="deps" title="Depends on">⤷ <span class="dep-link" role="link" tabindex="0"
        data-dep="WS-9-8d98ve">WS-9-8d98ve</span></span>
  <span class="rels" title="Related to">⇄ <span class="dep-link" role="link" tabindex="0"
        data-dep="WS-16-sg71an">WS-16-sg71an</span><span class="rel-more" title="WS-4-50vnol, WS-7-c5ispw">+2</span></span>
</div>
```

Four things make this shape the right one:

- `.deps` keeps its class, its `⤷` prefix, its `.dep-link` children, its `data-dep` attributes and
  its comma text nodes. The only change inside it is the cap (A7) and the new `title` (A9).
- `.rels` is built by the same loop with a different glyph and a different source array, so the
  two runs share `footerRun` and the element-building code.
- The link IDs carry `.dep-link` and `data-dep`, so **both delegated listeners already handle them**
  (`src/public/app.ts:1060-1061,1074-1075`). The colour difference comes from the container:
  `.card-foot .rels .dep-link`, not from a modifier class on the link.
- Dependency first, always, so position is a cue independent of glyph and colour.

`.rels` is built when `linkedWith[w.id]` is non-empty, independently of `.deps`. A card with links
and no dependencies gets `.rels` alone.

### Contract 4 — the modal relationships block

New markup in `src/public/board.html`, inside `#ws-modal-meta`, after the tags row at line 123 and
before the dates row at line 124:

```html
<div id="ws-modal-rels" class="ws-modal-rels" hidden>
  <div id="ws-modal-rels-deps" class="ws-modal-rel-row" hidden>
    <span class="ws-modal-rel-label">Depends on</span>
    <span id="ws-modal-rels-deps-ids" class="ws-modal-rel-ids"></span>
  </div>
  <div id="ws-modal-rels-linked" class="ws-modal-rel-row" hidden>
    <span class="ws-modal-rel-label">Related</span>
    <span id="ws-modal-rels-linked-ids" class="ws-modal-rel-ids"></span>
  </div>
</div>
```

`renderModalMeta` (`src/public/app.ts:942`) fills it with the same show/hide shape it already uses
for tags: clear the two id containers, append one `span.ws-modal-rel-id` per ID with `textContent`,
hide a row whose list is empty, and hide `#ws-modal-rels` when both rows are hidden. Its `!w`
early-return branch (`src/public/app.ts:951-963`) clears and hides all three.

Sources, deliberately different per row and matching the footer:

- **Depends on** — `w.depends_on`, raw and uncapped, dangling IDs included.
- **Related** — `linkedWith[w.id]`, mirrored and uncapped, known IDs only (A2).

The words "Depends on" and "Related" are what satisfy the no-legend constraint: the glyphs are
never the only place the kinds are named.

### Contract 5 — the CSS

One new variable, `--linked`, added to all four theme blocks
(`src/public/styles.css:9`, `:53`, `:93`, `:106`) in each block's own formatting — one declaration
per line in the first two, packed lines in the last two. It carries both the dashed ring colour and
the footer/modal link-ID text colour, so it must clear text contrast against the card background,
which automatically clears the ring's lower bar. `--chain` already does exactly this dual duty at
7.4:1 light and 6.2:1 dark, so the precedent holds. No `--linked-soft`: the link treatment has no
halo, because the halo is the root card's exclusive cue.

Rules, all placed in the card block near `src/public/styles.css:414-422`:

```css
/* existing rule, second selector added — one rule, not two */
.card-foot .deps, .card-foot .rels { font-family: var(--font-mono); font-size: 10px; color: var(--ink-faint); }
.card-foot .rels .dep-link { color: var(--linked); cursor: pointer; }
.card-foot .rel-more { color: var(--ink-faint); margin-left: 3px; cursor: pointer; }

/* Dashed one-hop link ring. A pseudo-element, NOT outline: .card:focus-visible
   owns outline at src/public/styles.css:276, which sits far EARLIER in the file,
   so an .card.is-linked outline rule down here would beat the focus ring. */
.card { position: relative; }                     /* one declaration added to the existing rule */
.card.is-linked::after {
  content: ''; position: absolute; inset: -3px;
  border: 2px dashed var(--linked); border-radius: 8px; pointer-events: none;
}
```

And one declaration on the existing `.card-foot` rule (`src/public/styles.css:412`):

```css
.card-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; … }
```

`flex-wrap: wrap` is a no-op whenever the footer already fits, so a one-relationship card looks
exactly as it does today. It matters because the column is 268px wide
(`src/public/styles.css:324`) and the `created … · updated …` span alone is close to the card's
usable width at 10px mono — a second run without wrapping would overflow into `.column-body`'s
clipped horizontal axis.

`.card.is-chain`, `.card.is-chain-root` and `.card.is-flash` (`src/public/styles.css:417-420`) are
**not touched**, and neither is the `--chain` pair.

### Module boundaries

- `knownIds` and `buildLinkIndex` know the shape of `PraxisWorkstream` and nothing else. They must
  not touch the DOM, must not read `query`, `sortKey`, `activeTags` or `blockedOnly`, and must not
  know a highlight exists.
- `setChain` is the only writer of `chainRoot`, `chainSet` and `linkSet`, and the only place the
  root-beats-chain-beats-link precedence is expressed.
- `paintChain` knows the DOM and the three class names. It must not walk a graph, must not call
  `renderBoard`, and must not open the modal.
- `footerRun` is pure over an array. It knows nothing about kinds, glyphs, colours or the DOM.
- `buildCard` reads `chainSet`, `chainRoot`, `linkSet` and `linkedWith`, and writes none of them.
- `renderModalMeta` reads `linkedWith` the same way it already reads `sevMix`. It must not write
  the index and must not trigger a repaint.
- `jumpToDep`, `openModal`, `renderBoard` and both delegated listeners learn nothing new.

### Non-functional notes

- **Performance.** `buildLinkIndex` is one extra pass over tens of workstreams, inside `applyData`,
  which already re-renders on the same call. `linkSet` is one array read per card click.
  `paintChain` gains one `classList.toggle` per card. `renderBoard` is untouched, so the
  per-keystroke path costs nothing new. None of this is measurable at 64 workstreams; at 10,000 the
  board's existing full-`innerHTML` rebuild would dominate long before these passes did.
- **Security.** No new input, no new endpoint, no new network call, no `innerHTML`. Every ID reaches
  the DOM through `textContent` and `dataset`, matching the file's existing rule. See the
  out-of-scope observation on `jumpToDep`'s selector below.
- **Observability.** None is added. This is a local front-end interaction with no failure mode worth
  logging, and the project has no client logging convention.
- **Accessibility.** The link IDs inherit WS-25's accepted trade-off: a focusable `role="link"`
  inside a card carrying `role="button"` (`src/public/app.ts:238`) is invalid ARIA. This plan does
  not widen or fix it; it reuses the exact element shape already shipped. The `+k` marker is inert
  by design (A6), so it adds no new focusable node. The modal block names both kinds in words (A9,
  criterion 20), which is the one accessibility gain here.

## Staged task breakdown

Four phases. Each leaves the board working and is demonstrable on its own.

### Phase 1 — `links` in the payload

**Build.** Add `links: string[]` to `PraxisWorkstream`. Add the array-coercion read to the workstream
object in `walkWorkstreams`. Give `withFixtureProject` an optional workstream-file override so the
existing tests keep their current fixture, then add cases for `links` present as an array, absent,
empty, and scalar.

**Files.** `src/types/praxis-data.d.ts` (line 23). `src/lib/extract.ts` (line 192).
`src/lib/extract.test.ts` (the `WORKSTREAM_FILE` constant at line 64, `withFixtureProject` at line
111, new tests at the end).

**Effort.** Small.

**Depends on.** Nothing.

**Verify.** `npm run build` passes both compilations. `node --test dist/lib/extract.test.js` passes,
including the new cases. `npm start`, then read `/api/projects/<id>/data` and confirm every
workstream object carries a `links` array, that `WS-27-wg5q18` carries two entries, and that
`WS-15-o60iyw` carries an empty one. The board looks identical, because nothing renders it yet.
Covers criteria 1 to 3.

### Phase 2 — the mirrored index and the footer link run

**Build.** Add `linkedWith` and the `REL_FOOTER_MAX` constant. Add `knownIds`, switch `buildDepIndex`
to it, add `buildLinkIndex`, and call it from `applyData` beside the existing `buildDepIndex()` call.
Add `footerRun`. Rewrite `buildCard`'s footer block to build both runs through one shared
element-builder, dependency first, each capped, each with its `title` and its `+k` marker whose own
`title` names the hidden IDs. Add `--linked` to the four theme blocks with a provisional value, add
the `.rels` selector to the existing `.deps` rule, add the `.rels .dep-link` and `.rel-more` rules,
and add `flex-wrap: wrap` to `.card-foot`.

**Files.** `src/public/app.ts` (module scope at 44-66; `buildDepIndex` at 169-184; new functions
beside it; `buildCard` footer at 305-322; `applyData` at 1189-1194).
`src/public/styles.css` (theme blocks at 9, 53, 93, 106; `.card-foot` at 412; `.deps` rule at 414;
new rules after 422).

**Effort.** Medium.

**Depends on.** Phase 1.

**Verify.** `npm run build` passes. `npm start` on this repository's own board. `WS-16-sg71an` shows
`⇄ WS-15-o60iyw`, and `WS-15-o60iyw` shows `⇄ WS-16-sg71an` although its own `links` is empty — this
is the mirroring proof. `WS-3-9gbugs` shows two link IDs it declares none of. `WS-1-bacexa` and
`WS-2-bg6ela` name each other, so each must show the other exactly once, not twice — this is the
dedupe proof. Clicking a `⇄` ID scrolls to and flashes the target and leaves the modal closed; Enter
on a focused one does the same. Confirm no card's footer overflows its column, and that a card with
neither kind is pixel-identical to today.

Two cases have no example in this repository's own data and need a hand-edited
`workstream.md`, because no workstream here carries both kinds and none carries more than two
IDs in a list. Give one workstream both a `depends_on` list and a `links` list: its `⤷` run must
come first and its `⇄` run second. Give one workstream five `links` entries: the footer shows three
and a `+2` whose tooltip names the other two, and clicking the `+2` opens the modal. Covers
criteria 4 to 11.

### Phase 3 — the one-hop dashed link highlight

**Build.** Add `linkSet`. Extend `setChain` to compute it with the root and every chain member
removed. Extend `paintChain` to toggle `is-linked`. Seed `is-linked` in `buildCard` next to the two
existing chain classes. Add `position: relative` to `.card` and the `.card.is-linked::after` rule.

**Files.** `src/public/app.ts` (module scope at 44-66; `setChain` at 210-214; `paintChain` at
218-226; `buildCard` at 229-235). `src/public/styles.css` (`.card` at 355-361; new rule after 422).

**Effort.** Medium.

**Depends on.** Phase 2, for `linkedWith` and `--linked`.

**Verify.** `npm run build` passes.

Dependency regression check first: click `WS-9-8d98ve` and confirm `WS-8-nlelsj`, `WS-9-8d98ve` and
`WS-11-vtcy55` paint the same solid chain, with the same root treatment, as they did before this
phase. `WS-9-8d98ve` has no link of either direction, so no dashed ring may appear.

Link check: click `WS-27-wg5q18`. It paints as root, `WS-5-kxteoh` and `WS-7-c5ispw` paint dashed,
and `WS-3-9gbugs` — two link hops away, through `WS-7-c5ispw` — must not paint at all. Close the
modal: the rings remain. Change the sort key, the direction and the search text: they remain on
every card still on the board. Click column background: they clear. Edit a source
`workstream.md` so the next poll finds changed data: within five seconds the board re-renders
with both ring kinds intact.

Precedence needs a hand-edited fixture, because no workstream in this repository carries both
kinds. Add a `links` entry to a workstream that is already inside a dependency chain, then click
that chain's root: the overlapping card must paint solid, not dashed, and the root must keep its
halo. Covers criteria 12 to 17.

### Phase 4 — modal relationships block, colour tuning, presentation pass

**Build.** Add the `#ws-modal-rels` markup to `board.html` and its rules to `styles.css`. Extend
`renderModalMeta`, including its `!w` branch. Replace the provisional `--linked` value with values
chosen against the light and the dark palette, keeping `:root` identical to
`:root[data-theme="light"]` and the `prefers-color-scheme: dark` block identical to
`:root[data-theme="dark"]`. Walk the footer-wrap, dropped-column and reduced-motion cases.

**Files.** `src/public/board.html` (the meta region at 115-125).
`src/public/app.ts` (`renderModalMeta` at 942-999).
`src/public/styles.css` (the four theme blocks; new modal rules near 785).

**Effort.** Medium.

**Depends on.** Phase 3.

**Verify.** `npm run build` passes. Open `WS-13-6ul85v`: the meta region lists "Depends on
WS-5-kxteoh, WS-9-8d98ve" above the tabs, and shows no "Related" row. Open `WS-15-o60iyw`: it lists
"Related WS-16-sg71an" and shows no "Depends on" row. Open `WS-24-u88wfx`, which has neither: no
block and no stray label. Open the card hand-edited in Phase 2 to five links: the modal lists all
five while the footer still shows three and a `+2`. Open the card hand-edited in Phase 2 to both
kinds: both rows appear, "Depends on" above "Related".
Shrink the window until `#ws-modal-meta` hits its 40vh cap and confirm the block scrolls with the
description rather than clipping. Check both ring kinds and both footer runs in all four theme
combinations, in the dropped column, and with reduced motion on. Covers criteria 18 to 21.

## Data & compatibility

- **Migrations.** None. Nothing is written, stored, or persisted. The board re-extracts every project
  on request.
- **Source-data compatibility.** `links: []` is already present in every Praxis workstream
  frontmatter this repository writes, and the coercion handles a missing key, an empty array, and a
  scalar identically to `depends_on`. No `flowcharge/` file is edited, moved, or read differently.
- **Payload compatibility.** `links` is additive. The only consumer of `PraxisData` outside the board
  is `src/scripts/extract-praxis-data.ts`, which serialises whatever it is given; `npm run refresh`
  output gains a key nobody reads. `src/server.ts` and `electron/ipc-handlers.cts` proxy the payload
  and need no edit. A stale `dist/public/data.json` from an earlier `npm run refresh` is never read
  by the board.
- **Typing compatibility.** Making `links` required rather than optional is safe because the field is
  produced and consumed inside one build: the server calls `extractPraxisData()` per request, so a
  payload without the key cannot reach a client that expects it.
- **Existing behaviour.** Exactly three existing behaviours change, all deliberate: the footer wraps
  instead of overflowing when it no longer fits; the footer caps each kind at three IDs (A7, no
  visible effect on this repository's data); and a card click now paints a third, dashed ring
  alongside the two it already paints. Every other click target, the modal, the filters, the sort and
  the poll behave exactly as before.
- **Rollback.** Fully reversible by `git revert` at any phase boundary, with no state to unwind.
  Phase 1 stands alone and ships an unused field. Phase 2 stands alone without the highlight. Phase 3
  stands alone without the modal block. Phase 4 without its colour tuning leaves a provisional
  `--linked` value, not a broken board.

## Testing strategy

The repository has one test file and no `test` script. `src/lib/extract.test.ts` is compiled by the
root `tsconfig.json` (`include` covers `src/lib/**/*.ts`) and run with
`node --test dist/lib/extract.test.js` after `npm run build`. There is no browser test harness and
this plan does not add one; adding one is a separate decision.

**Unit — Phase 1 only.** The extractor is the one piece of this feature that is pure and reachable
from Node, so it is the one piece that gets real tests. Four cases against a parameterised
`withFixtureProject` fixture: `links` as a populated array, as `links: []`, absent entirely, and as a
scalar. Each asserts the exact array on the extracted workstream. The existing tests must keep
passing unchanged, which the default-parameter shape guarantees.

**Static — every phase.** `npm run build` runs all three TypeScript compilations plus the esbuild
bundle. `src/public/tsconfig.json` type-checks the browser code, so a wrong `dataset` key, a missing
null narrowing on `linkSet`, or a bad element type fails the build before anything renders.

**Manual — every phase.** Each phase carries its own steps above. The cases worth repeating once at
the end of Phase 4:

- A card with dependencies only, links only, both, and neither.
- A non-reciprocal link pair, checked from both ends. `WS-16-sg71an` and `WS-15-o60iyw`.
- A reciprocal link pair, checked for a duplicated ID in the run. `WS-1-bacexa` and `WS-2-bg6ela`.
- A `links` entry naming a workstream that does not exist, and one naming the card itself.
- A hand-edited card with more than `REL_FOOTER_MAX` relationships of each kind.
- A card whose `depends_on` and `links` name the same ID.
- A link target in the same column and in a different column.
- A chain that overlaps a link neighbour, and a root that is also a link neighbour.
- All four theme combinations, the dropped column, and reduced motion on and off.
- Keyboard only: Tab to a `⇄` ID, Enter; Tab to a card, Enter, then Tab through the modal meta.

If a later test-writing pass is commissioned, `buildLinkIndex` and `footerRun` are the two client
functions worth unit coverage — both are pure — but they would need to be reachable from outside the
IIFE first, which is a structural change this plan does not make.

## Open questions

1. **The `--linked` hue.** The plan fixes the variable name, its four declaration sites, its dual
   text-and-ring duty, and the requirement that it is not `--chain`, not `--accent`, and not any
   `--st-*` or `--sev-*` value. It does not fix the hex. The palette's free room is narrow: violet is
   taken by `--chain`, teal by `--accent`, blue by `--st-ready`, amber by `--st-in-progress`, rose by
   `--st-blocked`, green by `--st-done`. *Recommendation: a blue-indigo, separated from `--st-ready`
   by chroma and lightness rather than hue, picked in Phase 4 with both themes side by side, as WS-25
   did for `--chain`.* Answer this if you want a specific family instead.
2. **Clickable modal relationship IDs.** Option (a) plain text, as planned (A8). Option (b) clickable:
   close the modal, then jump and flash. Option (b) is roughly one small task and makes the modal a
   navigation surface, not just a reference. *Recommendation: (a) now, (b) as its own workstream if
   the reference list proves frustrating.*
3. **Reverse dependencies.** The chain highlight already walks `dependedBy`, so the board knows which
   cards depend on a given card, but nothing names them in text. Option (a) leave it out, as WS-25
   decided and this plan keeps. Option (b) add a third modal row, "Depended on by". *Recommendation:
   (a). It is a third relationship kind and the request names two.*
4. **The footer cap.** `REL_FOOTER_MAX = 3` applies to both kinds (A5, A7). Option (a) as planned.
   Option (b) cap links only and leave the dependency run uncapped, which is a smaller change to
   existing behaviour but reintroduces the clutter on the dependency side. *Recommendation: (a).*
5. **Release constraints.** A11 assumes no deployment, no live user, no migration and no rollback
   obligation. The answer does not change the design, only whether the four phases may land
   separately. *Recommendation: confirm A11 and land them separately.*
6. **Dangling `links` IDs.** A2 drops them silently, while the dependency run still shows dangling
   IDs. Option (a) as planned, asymmetric. Option (b) render an unresolvable link ID as inert grey
   text. Option (c) make the two runs symmetric by also filtering the dependency run, which would
   change WS-25 behaviour. *Recommendation: (a). Option (c) is excluded by the regression-free
   constraint.*

## Alternatives considered and rejected

- **An SVG or canvas overlay drawing real edges between cards.** Rejected, and this is the plan's
  biggest deliberate omission. Four independent reasons, all grounded in this board: anchors would
  need recomputing against two nested scroll axes (`.board` is a horizontal flex scroller at
  `src/public/styles.css:313-319`, each `.column` has its own vertical scroll under a 78vh cap at
  `:328`) after every one of the full `board.innerHTML` rebuilds `renderBoard` performs on every
  keystroke, sort click and five-second poll; a line crossing a column boundary would need clipping
  or it paints over the sticky column heads; a target hidden by the search, tag or blocked filter has
  no DOM anchor to draw to at all; and the actual density does not justify it — 64 workstreams, 18
  with `depends_on`, 12 with `links`, and almost every list holding one or two IDs, so the hairball
  the overlay would exist to manage does not occur here. A ring is legible at that density and costs
  a class toggle.
- **A dashed `outline` for the link ring instead of a pseudo-element.** Rejected on a concrete file
  fact: `.card:focus-visible` sets `outline` at `src/public/styles.css:276`, in the shared controls
  rule, at the same (0,2,0) specificity as `.card.is-linked` would carry. A card rule placed in the
  card block near line 420 sits later in the source and would therefore beat the focus ring, hiding
  keyboard focus on any link-highlighted card. Moving the new rule above line 276 would put a card
  rule inside the controls section. The pseudo-element avoids the collision entirely for the cost of
  one `position: relative` declaration.
- **A `box-shadow` ring for links, distinguished by colour and weight only.** Rejected: it works, and
  it is the smaller diff, but at 1-2px on a 268px card a colour-and-weight difference is a weak
  at-a-glance cue, and the constraint asks for the two kinds to be distinguishable without a legend.
  Solid versus dashed is legible at a glance and survives a colour-blind reader; colour alone does
  not.
- **A dashed `border` on the card for the link ring.** Rejected: the card's border is 1px and already
  carries the hover cue (`.card:hover { border-color: var(--line-strong) }`,
  `src/public/styles.css:362`), so a link-highlighted card would lose its hover feedback, and a 1px
  dash reads as noise rather than as a ring.
- **Rendering the link run from `w.links` instead of the mirrored index.** Rejected: it is simpler,
  and it is wrong on this data. `WS-3-9gbugs`, `WS-5-kxteoh`, `WS-15-o60iyw`, `WS-50-wnvfyq`,
  `WS-53-ah1p06` and `WS-56-kdu68p` are all named by another workstream's `links` and declare none
  themselves, so half of every relationship on this board would stay invisible.
- **A third delegated listener, or a `data-link` attribute distinct from `data-dep`.** Rejected:
  reusing `.dep-link` and `data-dep` for both kinds means neither `#board` listener changes, which is
  the strongest possible evidence that the WS-25 click and keyboard behaviour is regression-free.
  The kind is carried by the container, which is where the colour rule already needs it.
- **A transitive walk for `links`, or link hops radiating from every chain member.** Rejected: a
  soft link is explicitly non-transitive, so a transitive walk would misrepresent the semantics; and
  radiating from every chain member would outline most of a column on a card with a four-hop chain.
- **Merging `links` into `chainOf` as a second edge type with a weight.** Rejected: it would change
  the transitive dependency closure `chainOf` returns today, which is exactly the WS-25 behaviour the
  constraint protects, and it buys nothing a separate one-hop set does not give.
- **Extracting the mirrored index on the server and shipping an adjacency map.** Rejected: it breaks
  the front-end-only scope, changes the API contract for a computation that costs one pass over tens
  of records, and would put a view concern into `src/lib/extract.ts`.
- **A new module file for the relationship code.** Rejected: `src/public/` is now real ES modules
  bundled by `tools/bundle-public.mjs`, so a new file is possible, but the new code is roughly sixty
  lines that read and write module-scope state already living inside `app.ts`'s IIFE. Extracting it
  would mean either exporting that state or passing it through every call. Fit-before-invention: the
  code goes where its state is.
- **Renaming `jumpToDep`, `setChain`, `paintChain` and the `.dep-link` class to kind-neutral names.**
  Rejected for this workstream: the names are cited in comments across `app.ts` and in WS-25's own
  task record, and the rename would inflate a diff whose main property is that it proves the
  dependency path is untouched. Recorded as a knowing readability cost (A12).

## Out-of-scope observations

Reported, not actioned. None is fixed by this plan and none should be folded into it.

- `jumpToDep` (`src/public/app.ts:143`) silently no-ops when its target card is not in the DOM — a
  dangling ID, or a target the search, tag, or blocked filter is currently hiding. Phase 2 routes a
  second source of IDs into the same function, so the gap becomes reachable one more way, but it is
  neither caused nor worsened in kind by this feature. The existing dependency behaviour is
  identical.
- `jumpToDep` builds its selector by string concatenation:
  `document.querySelector('#board .card[data-ws="' + id + '"]')`. An ID containing a double quote
  would throw a `SyntaxError` inside the click handler. IDs come from a local `flowcharge/` tree the
  user owns and follow a `WS-N-SUFFIX` shape, so this is latent rather than live. It predates this
  feature and belongs to a separate pass.
- `WS-67-o2byn9`'s `depends_on` names `WS-69-k3rvhf`, which has no workstream folder in this
  repository. `buildDepIndex` already drops the edge; the footer still renders the ID as a
  clickable no-op. This is source data, not code.

## Final summary

Chosen approach: extend WS-25 in place — read `links` into the payload, mirror it into one extra
client edge map, render it as a second `⇄` footer run that reuses the existing `.dep-link` element
so neither `#board` listener changes, paint it as a one-hop dashed ring in its own colour, and put
the uncapped list in the modal's meta region.

Four phases, medium overall: payload plus extractor tests (small), mirrored index plus footer run
(medium), one-hop dashed highlight (medium), modal block plus colour tuning (medium). Six files
change. Fully reversible by revert at every phase boundary.

Top risks: finding a `--linked` hue that clears `--chain`, `--accent` and eight status and severity
colours in four theme blocks; the 268px column footer, which is already near its width limit before
a second run is added; and the dashed ring's interaction with the focus ring, which the
pseudo-element exists to sidestep.

Needs your answer: the six Open questions, above all question 1 (the link colour family), question 3
(whether "Depended on by" belongs here at all) and question 5 (confirm there is no release
constraint).

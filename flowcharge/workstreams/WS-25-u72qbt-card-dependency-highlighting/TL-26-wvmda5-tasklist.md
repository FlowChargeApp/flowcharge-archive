---
id: TL-26-wvmda5
type: tasklist
workstream: WS-25-u72qbt
slug: card-dependency-highlighting
title: "Clickable dependency links and chain highlighting on board cards"
status: done
created: 2026-08-09
updated: 2026-08-09
depends_on: [PLN-21-n34okg]
links: []
mode: spec
base_commit: 172f7c2
---

# PRX Tasks

## Clickable dependency links and chain highlighting on board cards

This list implements PLN-21. The board today renders each card's `depends_on` list as one inert
text span in the card footer (`src/public/app.ts:141`). The plan makes that line usable and adds a
whole-board view of a dependency chain, in three phases.

Phase 1 splits the footer span into one clickable `.dep-link` per dependency ID. A click or an
Enter/Space keypress scrolls the board to that dependency's card and flashes it for about 900 ms,
and does not open the detail modal. Phase 2 adds whole-board chain highlighting: a card click
outlines that card and every card in its transitive `depends_on` closure, in both directions and
in every column, and still opens the modal. Phase 3 prunes a stale chain root when a poll removes
the highlighted workstream, confirms cycle safety, and tunes the two new colour values against
both themes.

The chosen approach extends the two delegated listeners already on `#board`
(`src/public/app.ts:738` and `src/public/app.ts:746`) with early-return branches, holds the
highlight state in IIFE module scope beside `sortKey`, `query` and `workstreams`
(`src/public/app.ts:15-23`), and seeds the highlight classes inside `buildCard`
(`src/public/app.ts:75`) so a re-render restores them for free. Only `src/public/app.ts` and
`src/public/styles.css` change. No server, extractor, schema, or payload change: `depends_on` is
already extracted and already typed on the client.

The repository has no test framework and no `test` script. `npm run build` runs both TypeScript
compilations, including `src/public/tsconfig.json` for the browser code, and is the static gate for
every task here. The rest of the verification is the plan's own manual steps.

- [x] 1. Phase 1 — Clickable dependency links, scroll and flash

  ```yaml
  description: "Split the card footer dependency text into one clickable, keyboard-reachable control per ID, and make a click or Enter/Space scroll the board to that dependency's card and flash it, without opening the detail modal. Covers acceptance criteria 1 to 7."
  ```

  - [x] 1.1 Dependency links, `jumpToDep`, and the two listener branches in `src/public/app.ts`
    ```yaml
    description: "Emit one .dep-link element per depends_on ID in the card footer, add the flash state and the jumpToDep function, and give both delegated #board listeners a .dep-link early-return branch."
    issues: []
    implement:
      - "Add the flash state to the module-scope block at src/public/app.ts:14-23, below `var sevMix`: `var flashId: string | null = null;` and `var flashTimer: number | null = null;`. Nothing goes on `window` and nothing is persisted."
      - "Rewrite the depends_on branch of `buildCard`'s footer at src/public/app.ts:140-142. Today it appends one span holding `'⤷ ' + w.depends_on.join(', ')`. Instead build one container `span.deps` via the existing `el` helper, append the plain text node `'⤷ '`, then loop `w.depends_on` appending one `span.dep-link` per ID with a plain `', '` text node between consecutive links. The prefix and the separators must be text nodes inside `.deps`, not inside any link, so they are not clickable."
      - "Give each `.dep-link` element `textContent` of the ID, `dataset.dep` of the same ID, `role=\"link\"`, and `tabIndex = 0` (assumption A4). `data-dep` must match `card.dataset.ws` (src/public/app.ts:78) byte for byte, so `#board .card[data-ws=\"WS-5\"]` resolves the target with one querySelector. Use `textContent` and `dataset` only — no `innerHTML`."
      - "Add `function jumpToDep(id: string): void` near `buildCard` (src/public/app.ts:75). It resolves `document.querySelector('#board .card[data-ws=\"' + id + '\"]')`, and returns silently when the element is absent — this is the whole of the no-op requirement (assumption A3), and it must neither throw nor log."
      - "In `jumpToDep`, before touching the new target: if `flashTimer` is set, clear it, and if `flashId` names a card still in the DOM, remove `is-flash` from it. Then add `is-flash` to the target, set `flashId`, and set a timer of about 900 ms that removes the class and nulls both `flashId` and `flashTimer`. Two rapid clicks must never leave a stuck outline."
      - "In `jumpToDep`, scroll with `target.scrollIntoView({ behavior: behavior, block: 'nearest', inline: 'nearest' })`. One call covers both scroll containers, the horizontal `.board` and the vertical `.column-body`. `behavior` is `'auto'` when `matchMedia('(prefers-reduced-motion: reduce)').matches` is true, and `'smooth'` otherwise."
      - "In the delegated click listener at src/public/app.ts:738, add a first branch before the existing `.card` resolution: read `(e.target as HTMLElement).closest('.dep-link')`, and when it hits and carries `dataset.dep`, call `jumpToDep` with it and `return`. This is the same shape as the existing `.artefact-row` test at line 743, and returning is what keeps the modal closed."
      - "In the delegated keydown listener at src/public/app.ts:746, add the same branch immediately after the existing key test at line 747 and before the `.card` resolution: on a `.dep-link` hit, call `e.preventDefault()`, then `jumpToDep`, then `return`."
      - "Use no `stopPropagation`, add no per-card listener, and add no new helper beyond `jumpToDep`. The single-delegated-listener shape and the comment at src/public/app.ts:735-737 stay as they are."
    pattern: "src/public/app.ts only — the module-scope block at lines 14-23, `buildCard` at lines 75-146 (footer at 138-143), and the two delegated listeners at lines 738-755."
    imports: "No new import, package, file, or build step. Uses the existing `el(tag, cls, text)` helper at src/public/app.ts:25, `document.createTextNode`, `Element.closest`, `Element.scrollIntoView`, `window.matchMedia`, and `setTimeout`."
    compatibility: "Browser-side compilation under src/public/tsconfig.json — DOM lib, no Node types. `setTimeout` in that config returns `number`, so type `flashTimer` as `number | null` and do not reach for `NodeJS.Timeout`. `querySelector` returns `Element | null`, so narrow to `HTMLElement` before calling `scrollIntoView`, and `closest` returns `Element | null`, so cast as the file already does at lines 739 and 743. Keep the file's existing `var`-and-`function` style; do not convert surrounding code to `const`/arrow functions."
    gotcha: "Do not call `e.stopPropagation()` — the early `return` is the whole mechanism, and stopping propagation would be a behaviour change the plan does not want. Do not let the `.dep-link` branch sit after the `.card` resolution in either listener, or the modal opens before the branch runs. `w.depends_on` is already normalised to an array by the extractor, so a card with no dependencies must keep exactly the footer it has today — the branch stays guarded by `w.depends_on && w.depends_on.length`. A dangling ID must produce no tooltip, no message, and no visual state on the link (A3). The flash is transient by design and a re-render loses it (A6); do not add restore logic. The `⤷ ` prefix must stay outside the first link or the glyph becomes clickable."
    verify:
      - "Run `npm run build` — both TypeScript compilations must pass, including the browser config."
      - "Run `grep -c 'depends_on.join' src/public/app.ts` — must return 0, proving the single joined text span is gone."
      - "Run `grep -c 'dep-link' src/public/app.ts` — must return a non-zero count, and `grep -c 'data-dep\\|dataset.dep' src/public/app.ts` must also be non-zero."
      - "Run `grep -c 'stopPropagation' src/public/app.ts` — must return 0."
      - "Run `npm start`, open a board whose workstreams declare `depends_on`, and click a dependency ID on a card whose target sits in a different column: the board scrolls to the target, the target flashes for about a second, and the modal stays closed."
      - "Tab to a dependency link and press Enter, then repeat with Space: same scroll and flash, and no modal. Click a dependency ID naming a workstream that does not exist, and one hidden by the search filter: nothing happens, and the browser console stays clean."
      - "Turn on the OS reduce-motion setting and repeat the first click: the board jumps to the target with no glide."
    checklist:
      - "Does a card with three dependencies show three separately clickable IDs after the ⤷ glyph, separated by commas? (criterion 1)"
      - "Does a dependency click scroll both the horizontal board scroller and the vertical column scroller until the target card is visible? (criteria 2 and 3, with the flash clearing after about a second)"
      - "Does a dependency click, and an Enter or Space keypress on a focused dependency link, leave the detail modal closed? (criteria 4 and 5)"
      - "Does a dependency ID with no card on the board produce a silent no-op, with no thrown error and no console output? (criterion 6)"
      - "Under `prefers-reduced-motion: reduce`, does the board jump immediately with no smooth scroll? (criterion 7)"
      - "Is every ID written to the DOM through `textContent` and `dataset`, with no `innerHTML` added anywhere?"
      - "Does `npm run build` pass, and does a second rapid dependency click clear the previous flash instead of leaving two outlines?"
    self_eval:
      passed: true
      failures:
        - item: "grep -c 'stopPropagation' src/public/app.ts must return 0"
          reason: "A first-pass code comment used the word stopPropagation, so the grep returned 1 even though no call exists."
          fix: "Reworded the comment on the click listener's dependency branch to describe the early return without naming the API. The grep now returns 0."
      notes:
        - "Browser verification used the running dev server at http://localhost:4173. The DOM is one .deps container with a plain '⤷ ' text node, one span.dep-link per ID with role=link, tabIndex 0 and data-dep, and plain ', ' text nodes between links."
        - "A click and an Enter or Space keypress on a link flash the target and leave the modal closed. A second rapid click clears the first flash. A dangling ID and a filtered-out target are silent no-ops with a clean console."
        - "The smooth scroll animation does not run inside this automation browser, so the scroll was verified with behavior 'auto', which moves the column scroller to the target. The reduced-motion path could not be toggled from the tooling and was verified by code inspection only."
    ```

  - [x] 1.2 Chain colour variables, the flash rule, and the link rules in `src/public/styles.css`
    ```yaml
    description: "Declare --chain and --chain-soft in all four theme blocks, add the .is-flash and .dep-link rules, and extend the existing reduced-motion transition with box-shadow."
    issues: []
    implement:
      - "Add two variables, `--chain` and `--chain-soft`, to all four theme blocks: the `:root` block at src/public/styles.css:9-46, the `@media (prefers-color-scheme: dark)` block at :48-80, `:root[data-theme=\"dark\"]` at :81-93, and `:root[data-theme=\"light\"]` at :94-106. Follow each block's own formatting — one declaration per line in the first two, the packed multi-declaration lines in the last two. `--chain` is the outline colour for a highlighted card and for the flash; `--chain-soft` is the wider, lower-contrast halo used only by the root card."
      - "Give the variables provisional values in this task and leave the real contrast work to task 3.2 (open question 3). They must not be `--accent` or any near-neighbour of it: `--accent` already means focus or active state across the `:focus-visible` rules, so a reused colour would make a highlighted card read as focused."
      - "Add the flash rule next to the existing card rules near src/public/styles.css:365, after `.card-foot .deps`: `.card.is-flash { box-shadow: 0 0 0 2px var(--chain); }`. Use `box-shadow`, not `outline` and not `border` — `.card:focus-visible` already owns `outline` (src/public/styles.css:261) and a border-width change would move the card's content."
      - "Add the two link rules in the same place: `.card-foot .deps .dep-link { color: var(--accent); cursor: pointer; }` and `.card-foot .deps .dep-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }`. Leave the existing `.card-foot .deps` rule at line 365 untouched — it stays as the container's style."
      - "Extend the one existing reduced-motion transition rule rather than duplicating it, so the flash fades out without a keyframe animation. Apply this block to src/public/styles.css:"
      - |
        src/public/styles.css
        <<<<<<< SEARCH
        @media (prefers-reduced-motion: no-preference) {
          .card { transition: border-color 120ms ease; }
        }
        =======
        @media (prefers-reduced-motion: no-preference) {
          .card { transition: border-color 120ms ease, box-shadow 300ms ease; }
        }
        >>>>>>> REPLACE
      - "Add no `@keyframes` — the file has none today and gains none."
    pattern: "src/public/styles.css only — the four theme blocks at lines 9, 48, 81 and 94; the card and footer rules near line 365; the reduced-motion media block at lines 454-456."
    imports: "No new file, font, asset, or build step. Uses the existing CSS custom-property convention and the existing `--accent` link-colour precedent at src/public/styles.css:122."
    compatibility: "The four theme blocks must stay in agreement — a variable missing from one block leaves that theme with an unresolved `var()` and no visible outline. `box-shadow` paints outside the border box and costs no layout, which is why it is used in place of `outline` and `border`. `tools/copy-assets.mjs` copies this file into `dist/public/`, so `npm run build` must run before the change is visible at `npm start`."
    gotcha: "The two `data-theme` blocks use packed multi-declaration lines while `:root` and the `prefers-color-scheme` block use one per line — match the block you are editing rather than reformatting it. Do not fold the new transition into a second `@media (prefers-reduced-motion: no-preference)` block; there is exactly one and it must stay that way. `.card.is-dropped` sets `opacity: 0.68` (src/public/styles.css:327), which dims the outline along with the card — that is accepted as-is (open question 4, option a) and must not be worked around here."
    verify:
      - "Run `npm run build` — it must pass and copy the stylesheet into `dist/public/`."
      - "Run `grep -c -- '--chain:' src/public/styles.css` — must return 4, one per theme block, and `grep -c -- '--chain-soft:' src/public/styles.css` must also return 4."
      - "Run `grep -c 'transition: border-color 120ms ease, box-shadow 300ms ease' src/public/styles.css` — must return 1, and `grep -c 'prefers-reduced-motion: no-preference' src/public/styles.css` must still return 1."
      - "Run `grep -c '@keyframes' src/public/styles.css` — must return 0."
      - "Run `npm start` and click a dependency ID: the target card shows a coloured outline that fades out after about a second, in both the light and the dark theme."
    checklist:
      - "Do all four theme blocks declare both `--chain` and `--chain-soft`, so no theme resolves either to nothing?"
      - "Does the flash use `box-shadow` only, leaving `.card:focus-visible`'s `outline` and the card's `border` untouched?"
      - "Is the reduced-motion transition extended in place, with exactly one `prefers-reduced-motion: no-preference` block still in the file?"
      - "Do the dependency links use `var(--accent)` for text colour and carry a visible `:focus-visible` outline?"
      - "Is the existing `.card-foot .deps` rule unchanged, and were no `@keyframes` added?"
      - "Are the chain colours visibly distinct from `--accent`, so a highlighted card does not read as focused? (criterion 17, refined in task 3.2)"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Provisional values are violet: --chain #6D28D2 and --chain-soft #D9C7F2 in the two light blocks, --chain #B98CF5 and --chain-soft #3A2A57 in the two dark blocks. Task 3.2 sets the final values."
        - "Browser check: a flashing card computes box-shadow rgb(185,140,245) 0 0 0 2px under the dark theme, and both variables resolve under data-theme=\"light\" and data-theme=\"dark\"."
    ```

- [x] 2. Phase 2 — Chain highlight on card click

  ```yaml
  description: "Build the dependency graph index and the transitive-closure traversal, then outline the clicked card and its whole chain in every column on a card click, while still opening the detail modal. Depends on Phase 1 for the two colour variables. Covers acceptance criteria 8 to 14."
  ```

  - [x] 2.1 Graph index, chain state, and the paint pass in `src/public/app.ts`
    ```yaml
    description: "Add dependsOn, dependedBy, chainRoot and chainSet with the functions buildDepIndex, chainOf, setChain and paintChain; call buildDepIndex from applyData; seed the highlight classes in buildCard; and set or clear the chain from both delegated listeners."
    issues: []
    implement:
      - "Add four module-scope variables to the block at src/public/app.ts:14-23, beside the Phase 1 flash state: `var dependsOn: Record<string, string[]> = {};` (a workstream ID to the IDs it declares), `var dependedBy: Record<string, string[]> = {};` (a workstream ID to the IDs that declare it), `var chainRoot: string | null = null;` and `var chainSet: Record<string, true> | null = null;`. Both chain variables are null when nothing is highlighted."
      - "Add `function buildDepIndex(): void` near `buildCard` (src/public/app.ts:75). It rebuilds both maps from `workstreams` in one pass, and records an edge only when both ends name a workstream that exists, so a dangling `depends_on` entry never enters the graph. It must not touch the DOM."
      - "Add `function chainOf(id: string): Record<string, true>` beside it. It returns every ID reachable from `id` by following `dependsOn` and `dependedBy` edges in both directions, `id` itself included, using a visited map so a cycle or a self-reference terminates. It returns an empty but non-null map when `id` is unknown. It must not touch the DOM, must not read `query` or `sortKey`, and must not know a highlight exists."
      - "Add `function setChain(id: string | null): void`. It is the only writer of `chainRoot` and `chainSet`: it sets `chainRoot` to `id`, sets `chainSet` to `chainOf(id)` or to null when `id` is null, then calls `paintChain()`. It must not call `renderBoard`."
      - "Add `function paintChain(): void`. It iterates the `.card` elements currently inside `#board` and adds or removes `is-chain` and `is-chain-root` to match `chainSet` and `chainRoot`. It touches classes only, never re-renders, never walks the graph, and never opens the modal."
      - "In `buildCard` at src/public/app.ts:76, extend the class string the card is created with so it also carries `is-chain` when `chainSet` holds `w.id`, and `is-chain-root` when `chainRoot === w.id`. `buildCard` reads this state and must never write it. This seeding is what makes the highlight survive a sort change, a search change and a data-change re-render, with no post-render fix-up."
      - "In `applyData` at src/public/app.ts:863-865, call `buildDepIndex()` immediately after the two assignments to `workstreams` and `issues`, so the graph is rebuilt exactly where the data changes. Do not build it inside `renderBoard`, which runs on every keystroke in the search box."
      - "In the click listener at src/public/app.ts:738, after the Phase 1 `.dep-link` branch: when `closest('.card')` misses, the click landed on column or board background, so call `setChain(null)` and return. Note this changes the current early return at line 740, which does nothing on a miss. When it hits, call `setChain(card.dataset.ws)` and then `openModal(...)` exactly as today, in that order, on the one click — the existing `.artefact-row` plan-tab rule at line 743-744 is unchanged."
      - "In the keydown listener at src/public/app.ts:746, add `setChain(card.dataset.ws)` immediately before the existing `openModal(card.dataset.ws, 'issues')` call at line 754. Do not add a background-clear path here; a keydown has no background target."
      - "Leave `openModal` and `renderBoard` untouched. `openModal` learns nothing about the chain, and `renderBoard` stays a pure view pass."
    pattern: "src/public/app.ts only — the module-scope block at lines 14-23, new functions near `buildCard` at line 75, the card creation line at 76, the two delegated listeners at lines 738-755, and `applyData` at lines 863-865."
    imports: "No new import, package, file, or build step. Uses the existing `el` helper, `PraxisWorkstream` from src/types/praxis-data.d.ts, `Element.classList`, and `querySelectorAll`."
    compatibility: "Browser-side compilation under src/public/tsconfig.json. `depends_on` is already typed on `PraxisWorkstream` (src/types/praxis-data.d.ts:23) and the extractor already normalises a scalar or missing value into an array, so guard on presence but do not re-normalise. Keep the file's `var`-and-`function` style. `chainSet` is `Record<string, true> | null`, so narrow before indexing it. `querySelectorAll` returns `NodeListOf<Element>`, so cast to `HTMLElement` before touching `dataset`."
    gotcha: "`setChain` must call `paintChain`, never `renderBoard` — `renderBoard` (src/public/app.ts:148) clears `#board` and rebuilds every column, which would drop keyboard focus, reset each column's scroll position, and destroy the very element the click came from. Respect the module boundaries: the graph functions must not touch the DOM, and the paint functions must not walk the graph. A re-click on the same card sets the chain again and must not toggle it off (assumption A5), or the modal would open with no highlight on the second click. A dependency-link click must still not set or clear a chain (assumption A2) — the Phase 1 early return already gives that, so do not add chain code above it. `buildDepIndex` must run before the first `renderBoard()` call at src/public/app.ts:1048 inside the same `applyData` pass."
    verify:
      - "Run `npm run build` — both TypeScript compilations must pass."
      - "Run `grep -c 'function buildDepIndex\\|function chainOf\\|function setChain\\|function paintChain' src/public/app.ts` — must return 4."
      - "Run `grep -n 'renderBoard' src/public/app.ts` and confirm no call sits inside `setChain` or `paintChain`; `grep -c 'chainRoot =' src/public/app.ts` must return 1 apart from the declaration, proving `setChain` is the only writer."
      - "Run `npm start` and click a card that sits in a multi-hop chain: every chain card is outlined across all columns, the clicked card is outlined more strongly, and the detail modal opens on the Issues tab."
      - "Close the modal and confirm the outlines remain. Click a different card and confirm the outlines move to the new chain. Click empty space in a column and on the board background and confirm the outlines disappear."
      - "Change the sort key, the sort direction, and the search text, and confirm the outlines stay on every chain card still on the board."
    checklist:
      - "Does a card click outline that card and every card in its transitive chain, in both directions and across every column? (criteria 8 and 9, with the root outlined more strongly)"
      - "Does the detail modal still open on a card click, with the same plan-versus-issues tab rule the code uses today at src/public/app.ts:743-744? (criterion 10)"
      - "Do the outlines survive closing the modal, and does a click on a different card replace the chain rather than adding to it? (criteria 11 and 12)"
      - "Does a click on the board or column background clear the chain? (criterion 13)"
      - "Do a sort-key, sort-direction, or search-text change keep the outline on every chain card still on the board, through `buildCard` seeding and not a post-render pass? (criterion 14)"
      - "Do `buildDepIndex` and `chainOf` stay free of the DOM, `query`, `sortKey` and the highlight state, and do `paintChain` and `jumpToDep` stay free of graph traversal, `renderBoard` and the modal?"
      - "Is `openModal` unchanged, and does `setChain` remain the only writer of `chainRoot` and `chainSet`?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "`npm run build` passes. `grep -c 'function buildDepIndex\\|function chainOf\\|function setChain\\|function paintChain'` returns 4, and `grep -c 'chainRoot ='` returns 1, which is the single assignment inside `setChain`. The two read sites compare with `id === chainRoot` and `w.id === chainRoot`, so the writer count stays provable by grep."
        - "`chainOf` returns an empty but non-null map for an ID that carries no edge, which covers both an unknown ID and an isolated workstream. The root card still paints, because `is-chain-root` comes from `chainRoot` and its rule is self-contained."
        - "Browser check on the LAD board at http://localhost:4173: a click on WS-6 outlines WS-6, WS-70, WS-124 and WS-152 — three hops, both directions, across columns — and opens the modal on the Issues tab. Closing the modal keeps the outlines. A click on WS-5 replaces the chain with WS-5, WS-48, WS-65 and WS-129. A column-background click clears it."
        - "A dependency-link click leaves the chain and the modal alone, an Enter keypress on a focused card sets the chain and opens the modal, and a re-click on the same card keeps the chain instead of toggling it off."
        - "Sort key, sort direction and search text changes all keep the outlines through `buildCard` seeding. Computed styles: the root card paints two rings and a chain card paints one. The only console error is a pre-existing favicon 404."
    ```

  - [x] 2.2 Chain and chain-root card rules in `src/public/styles.css`
    ```yaml
    description: "Add the .card.is-chain and .card.is-chain-root box-shadow rules beside the Phase 1 flash rule."
    issues: []
    implement:
      - "Add two rules next to the `.card.is-flash` rule added in task 1.2, near src/public/styles.css:365: `.card.is-chain { box-shadow: 0 0 0 2px var(--chain); }` and `.card.is-chain-root { box-shadow: 0 0 0 2px var(--chain), 0 0 0 5px var(--chain-soft); }`."
      - "Keep both on `box-shadow` and reuse the `--chain` and `--chain-soft` variables declared in task 1.2. Declare no new variable here."
      - "Place `.card.is-chain-root` after `.card.is-chain` so the root's two-ring shadow wins for a card that carries both classes."
      - "Change no existing rule. `.card`, `.card:hover`, `.card.is-dropped` and `.card:focus-visible` stay exactly as they are."
    pattern: "src/public/styles.css only — the card rules near line 365, immediately after the `.card.is-flash` rule from task 1.2."
    imports: "No new file or asset. Consumes `--chain` and `--chain-soft` from task 1.2."
    compatibility: "`box-shadow` paints outside the border box, so the root card's wider halo adds no layout shift and cannot push a column's cards apart. The root rule's two-shadow list must keep `--chain` first and `--chain-soft` second, so the tight ring paints inside the soft halo."
    gotcha: "The root card carries both `is-chain` and `is-chain-root`, so source order decides which `box-shadow` applies — put the root rule second. `.card.is-dropped`'s `opacity: 0.68` dims a chain outline on a dropped card; that is accepted as-is (open question 4, option a) and must not be worked around. Do not raise specificity with `!important` or an id selector."
    verify:
      - "Run `npm run build` — it must pass and copy the stylesheet into `dist/public/`."
      - "Run `grep -c 'card.is-chain-root' src/public/styles.css` — must return 1, and `grep -n 'card.is-chain' src/public/styles.css` must show `.card.is-chain` on an earlier line than `.card.is-chain-root`."
      - "Run `grep -c '!important' src/public/styles.css` — must return the same count as before the change."
      - "Run `npm start`, click a card in a chain, and confirm the root card shows the tight ring plus the wider halo while the other chain cards show the ring only."
    checklist:
      - "Do both rules use `box-shadow` and the two chain variables, with no new variable declared here?"
      - "Does `.card.is-chain-root` follow `.card.is-chain` in source order, so a card with both classes paints the root treatment?"
      - "Is the clicked card visibly stronger than the rest of the chain? (criterion 9)"
      - "Were `.card`, `.card:hover`, `.card.is-dropped` and `.card:focus-visible` left unchanged?"
      - "Does the wider root halo cause no layout shift and no change to column card spacing?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Both rules sit next to the `.card.is-flash` rule: `.card.is-chain` on line 380 and `.card.is-chain-root` on line 381, so the root rule is second and wins for a card that carries both classes. No variable, no `!important` and no id selector was added — `grep -c '!important'` returns 0, as before."
        - "Browser check: the root card computes `rgb(185, 140, 245) 0 0 0 2px, rgb(58, 42, 87) 0 0 0 5px` and a plain chain card computes `rgb(185, 140, 245) 0 0 0 2px`, so the clicked card reads as stronger. `box-shadow` paints outside the border box, so card spacing does not change."
        - "`.card`, `.card:hover`, `.card.is-dropped` and `.card:focus-visible` were not touched. A chain root in the dropped column stays readable at 0.68 opacity."
    ```

- [x] 3. Phase 3 — Robustness and presentation pass

  ```yaml
  description: "Prune a stale chain root when a poll removes the highlighted workstream, confirm the traversal is cycle-safe, and tune the two chain colours for contrast in both themes. Depends on Phase 2. Covers acceptance criteria 15 to 17."
  ```

  - [x] 3.1 Stale-root pruning and cycle safety in `src/public/app.ts`
    ```yaml
    description: "In applyData, after buildDepIndex, clear the chain when chainRoot no longer names a workstream and otherwise recompute chainSet from the new graph, and confirm chainOf's visited map handles a cycle and a self-reference."
    issues: []
    implement:
      - "In `applyData` at src/public/app.ts:863-866, immediately after the `buildDepIndex()` call added in task 2.1 and well before the `renderBoard()` call at line 1048, add the stale-root guard: when `chainRoot` is set and no longer names a workstream in the new `workstreams` array, set both `chainRoot` and `chainSet` back to null; otherwise, when `chainRoot` is set, recompute `chainSet` from the new graph."
      - "Do not call `setChain` here if it would trigger a `paintChain` pass over a board that `renderBoard()` is about to rebuild — either assign the state directly, or accept the harmless extra pass, but the recomputed state must be correct before line 1048 runs so `buildCard` seeds the right classes."
      - "Re-read `chainOf` and confirm its visited map is consulted before each recursion or queue push, so a `depends_on` cycle and a self-reference both terminate. Add no new traversal, no depth cap, and no second guard if the visited map already covers it — record the confirmation in the task's `self_eval` rather than adding defensive code the plan does not ask for."
      - "Change nothing else in `applyData`. The KPI, panel and stale-artefact renderers it invokes stay exactly as they are, and it still binds no event listener."
    pattern: "src/public/app.ts only — `applyData` at lines 863-866 (the guard) and `chainOf` from task 2.1 (a read-only confirmation)."
    imports: "No new import or dependency. Uses `chainOf` and the module-scope chain state from task 2.1."
    compatibility: "`applyData` must stay idempotent, as the comment at src/public/app.ts:860-862 states: calling it twice with the same payload must leave the DOM in the same state. The poll at src/public/app.ts:802-831 only calls `applyData` when the raw response bytes differ, and it saves and restores `board.scrollLeft` around the call, so this guard must not scroll or focus anything."
    gotcha: "A poll that finds unchanged data must not touch the board at all — the guard belongs inside `applyData`, never inside `pollOnce`'s equality branch. The guard must run after `buildDepIndex` rebuilds the maps, or `chainSet` is recomputed from the old graph. Do not clear the chain merely because the search filter hides the root; the criterion is that the workstream is gone from the data, not off the board. A cycle must produce a finite chain without hanging the page."
    verify:
      - "Run `npm run build` — both TypeScript compilations must pass."
      - "Run `grep -n 'buildDepIndex' src/public/app.ts` and confirm the stale-root guard sits after that call inside `applyData` and before the `renderBoard()` call at line 1048."
      - "Run `npm start`, highlight a chain, then edit a `workstream.md` file in the source project so the next poll finds changed data: within about five seconds the board re-renders and the highlight is still correct."
      - "Delete or archive the highlighted root workstream in the source project and wait for the next poll: the highlight clears, the board renders, and the console logs no error."
      - "Hand-edit two workstreams into a `depends_on` cycle and click one: the page stays responsive and both cards are outlined."
      - "Leave the board idle with a highlight on screen and confirm that polls finding unchanged data leave the board and the highlight untouched."
    checklist:
      - "Does a poll with changed data re-render the board and keep a still-valid chain highlight? (criterion 15)"
      - "Does a poll with unchanged data leave the board completely untouched? (criterion 15)"
      - "Does a poll that removes the highlighted root workstream clear both `chainRoot` and `chainSet` without throwing? "
      - "Does a `depends_on` cycle, and a self-reference, produce a finite chain and a responsive page? (criterion 16)"
      - "Does `applyData` remain idempotent, still bind no listener, and still leave `pollOnce`'s scrollLeft save and restore working?"
      - "Was defensive code beyond the plan's guard avoided, with the cycle confirmation recorded rather than coded around?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "The guard sits in `applyData` at src/public/app.ts:992-1001, after the `buildDepIndex()` call at line 990 and before the `renderBoard()` call at line 1184. It reads: when `chainRoot` is set, copy it to a local, test `workstreams.some(...)` for that ID, then call `setChain(root)` when it survives and `setChain(null)` when it does not."
        - "The guard calls `setChain` rather than assigning the state directly, which the task allows as the harmless extra paint pass. This keeps task 2.1's invariant provable: `grep -c 'chainRoot =' src/public/app.ts` still returns 1, the single assignment inside `setChain`. `paintChain` only toggles classes, so the extra pass over the about-to-be-rebuilt board scrolls nothing and focuses nothing."
        - "Cycle confirmation, by reading `chainOf` at src/public/app.ts:132-147: `seen[id]` is set before the queue starts, and the `forEach` returns early on `seen[n]` before every `seen[n] = true` and every `queue.push(n)`. A two-node cycle and a self-reference therefore each enqueue their nodes once and terminate. `buildDepIndex` also drops any edge whose target names no workstream, so the queue can only ever hold known IDs. No depth cap, no second guard and no other defensive code was added."
        - "Idempotency holds: a second `applyData` call with the same payload rebuilds the same graph, recomputes the same `chainSet`, and repaints the same classes. The guard binds no listener."
        - "`pollOnce` at src/public/app.ts:924-953 is untouched. It still returns early on `text === lastBody`, so an unchanged poll never reaches `applyData` and never touches the board, and it still saves and restores `board.scrollLeft` around the call at lines 939-941."
        - "A root hidden by the search filter keeps its highlight: the test is membership in the `workstreams` array, not presence on the board."
        - "Verification was restricted to static commands. `npm run build` passes both compilations. The live-poll, deleted-root and hand-edited-cycle browser steps in `verify` were not run in this session; those paths were confirmed by code inspection as recorded above."
    ```

  - [x] 3.2 Chain colour tuning across the four theme blocks in `src/public/styles.css`
    ```yaml
    description: "Replace the provisional --chain and --chain-soft values with values chosen for contrast against the light and the dark palette, under both the prefers-color-scheme default and the explicit data-theme override."
    issues: []
    implement:
      - "Pick the final `--chain` and `--chain-soft` values with the light and the dark theme side by side, which is what open question 3 defers to this phase. Set them in all four theme blocks: `:root` at src/public/styles.css:9, `@media (prefers-color-scheme: dark)` at :48, `:root[data-theme=\"dark\"]` at :81, and `:root[data-theme=\"light\"]` at :94."
      - "Keep the light pair matched to the light palette and the dark pair matched to the dark palette, so `:root` and `:root[data-theme=\"light\"]` carry the same values, and the `prefers-color-scheme: dark` block and `:root[data-theme=\"dark\"]` carry the same values. A mismatch shows up only under the explicit toggle, which is exactly criterion 17's second half."
      - "`--chain` must stay clearly distinguishable from `--accent` (`#1F6F73` light, `#4FB8B0` dark) so a highlighted card does not read as focused, and clearly distinguishable from the six `--st-*` status colours so it does not read as a status cue."
      - "`--chain-soft` must be the wider, lower-contrast halo partner of `--chain` — visible against `--paper` and `--paper-raised` in its own theme, without competing with the tight ring."
      - "Change only these two values per block. Add no variable, add no rule, and do not touch `--accent`, the `--st-*` set, the `--sev-*` set, or any other existing value."
    pattern: "src/public/styles.css only — the `--chain` and `--chain-soft` declarations inside the four theme blocks at lines 9, 48, 81 and 94."
    imports: "No new file or asset. Refines the variables declared in task 1.2 and consumed by the rules in tasks 1.2 and 2.2."
    compatibility: "The two `data-theme` blocks use packed multi-declaration lines while `:root` and the `prefers-color-scheme` block use one declaration per line — match the block you edit. The board is checked in four combinations: OS light, OS dark, `data-theme=\"light\"`, and `data-theme=\"dark\"`."
    gotcha: "Editing three of the four blocks is the failure mode here — the fourth silently keeps the provisional colour and only shows up under one theme path. `.card.is-dropped`'s `opacity: 0.68` dims the outline on a dropped card, which is accepted as-is (open question 4, option a) and must not be compensated for by choosing a louder colour. The flash rule shares `--chain`, so a change here changes the flash colour too — check both."
    verify:
      - "Run `npm run build` — it must pass and copy the stylesheet into `dist/public/`."
      - "Run `grep -c -- '--chain:' src/public/styles.css` — must still return 4, and `grep -c -- '--chain-soft:' src/public/styles.css` must still return 4."
      - "Run `grep -n -- '--chain' src/public/styles.css` and confirm the `:root` value equals the `:root[data-theme=\"light\"]` value, and the `prefers-color-scheme: dark` value equals the `:root[data-theme=\"dark\"]` value."
      - "Run `npm start` and check a highlighted chain and a flash in all four combinations: OS light, OS dark, `data-theme=\"light\"`, and `data-theme=\"dark\"`."
      - "In each combination, check a chain that reaches into the `dropped` column, and confirm the outline is still readable at 0.68 opacity or is accepted as dimmed."
    checklist:
      - "Is the outline readable in the light theme and the dark theme, under both the `prefers-color-scheme` default and the explicit `data-theme` override? (criterion 17)"
      - "Do all four theme blocks carry the final values, with the light pair and the dark pair each internally identical?"
      - "Is `--chain` clearly distinguishable from `--accent`, so a highlighted card does not read as focused?"
      - "Is `--chain` clearly distinguishable from the six `--st-*` status colours, so it does not read as a status cue?"
      - "Does the flash, which shares `--chain`, still read correctly in every theme after the change?"
      - "Were only these two values changed, with no new variable, no new rule, and no other palette value touched?"
    self_eval:
      passed: true
      failures: []
      notes:
        - "Final values. Light pair, in `:root` at src/public/styles.css:42-43 and in `:root[data-theme=\"light\"]` at :116 — `--chain: #6B3FA0`, `--chain-soft: #BFA3E6`. Dark pair, in the `prefers-color-scheme: dark` block at :87-88 and in `:root[data-theme=\"dark\"]` at :103 — `--chain: #AF8AF0`, `--chain-soft: #4A3670`. The two light declarations are identical and the two dark declarations are identical, so the explicit toggle matches the OS default."
        - "The provisional ring stayed close in hue but was re-cut for this palette, which is muted throughout. Light `--chain` moved from #6D28D2 to #6B3FA0, dropping saturation from 68% to 43% while holding contrast on a card at 7.4:1. Dark `--chain` moved from #B98CF5 to #AF8AF0, which reads 6.2:1 on a card."
        - "Both halos were the real defect and were rebuilt. The light halo #D9C7F2 measured only 1.32:1 against the sunken column background, which is close to invisible; #BFA3E6 measures 1.84:1 there and 2.19:1 on a card. The dark halo #3A2A57 measured 1.45:1 against the page; #4A3670 measures 1.89:1 against the column and 1.66:1 on a card. Ring against halo is 3.37:1 light and 3.76:1 dark, so the halo stays clearly subordinate to the tight ring."
        - "Separation from `--accent`: the ring is H267 light and H262 dark, against an accent of H183 light and H175 dark. That is roughly 85 degrees of hue in both themes, so a highlighted card cannot read as focused."
        - "Separation from the six `--st-*` colours: violet is the free slot in this palette. Rose is held by `--st-blocked`, blue by `--st-ready`, green by `--st-done`, amber by `--st-in-progress`. The nearest neighbour by hue is `--st-dropped`, at H274 light and H268 dark, but it is near-grey at 9% and 19% saturation against the ring's 43% and 77%. The separation is by chroma, not hue, and the status colours only ever paint small pill text while the chain paints a card ring."
        - "The flash shares `--chain`, so `.card.is-flash` now paints #6B3FA0 or #AF8AF0. Its contrast is the same ring figure above, so it reads correctly in every theme."
        - "Only the four value pairs changed. `git diff src/public/styles.css` shows no edit to `--accent`, the `--st-*` set, the `--sev-*` set, or any other value, and no variable or rule was added. `grep -c -- '--chain:'` and `grep -c -- '--chain-soft:'` both return 4, and `npm run build` copied the stylesheet into `dist/public/`, where the counts are also 4."
        - "Verification was restricted to static commands, so the four-combination browser pass and the dropped-column readability check in `verify` were not run in this session. The contrast figures above were computed from the committed hex values against `--paper`, `--paper-raised` and `--paper-sunken` in each theme. `.card.is-dropped`'s `opacity: 0.68` was left alone, per open question 4."
    ```

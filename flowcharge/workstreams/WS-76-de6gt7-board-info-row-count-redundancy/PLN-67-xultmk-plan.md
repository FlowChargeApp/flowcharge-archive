---
id: PLN-67-xultmk
type: plan
workstream: WS-76-de6gt7
slug: board-info-row-count-redundancy
title: "Remove the redundant workstream and issue counts from the board info row"
status: done
created: 2026-08-29
updated: 2026-08-29
depends_on: []
links: []
---

# Remove the redundant workstream and issue counts from the board info row

## Summary

The board screen's info row (`.toolbar-sub`, `src/public/board.html:37-45`) shows a
counts item — `N workstreams · M issues` — that repeats figures the KPI strip below it
already publishes. KPI Tile 1 shows `workstreams.length` as its headline value
(`src/public/app.ts:1285`), and KPI Tile 2's sub-line shows the raw issue total as
`M filed total across all issue lists` (`src/public/app.ts:1321`). The counts item is
therefore pure duplication.

The chosen approach is full removal of the element and its writer: delete the
`<span class="tb-meta-item" id="meta-counts"></span>` node from `board.html:40`, and
delete the `byId('meta-counts').textContent = ...` statement at `src/public/app.ts:1249-1250`.
The `#meta-counts` id disappears from the codebase entirely. Nothing else in the info
row, and nothing in the KPI strip, changes.

Reconnaissance confirms the removal leaves no artefacts to clean up. The middot
separators in that row are drawn by CSS, not by any script — `styles.css:228` sets
`.tb-meta-item + .tb-meta-item::before { content: "·"; ... }` — so removing a span
removes its separator with it, and no dangling `·` can survive. `styles.css:227`
(`.tb-meta-item:empty { display: none; }`) keeps a live user after the change:
`#live-status` ships empty in the markup and stays empty until the first poll. No CSS
rule targets `#meta-counts` by id, so no rule becomes dead.

## Scope

### Acceptance criteria

1. `grep -rn "meta-counts" src/ electron/ tools/` returns no matches.
2. The board info row renders `Generated <date>`, then the branch item when a branch
   is known, then the live-status item — with exactly one `·` between each pair of
   visible items and no leading or trailing separator.
3. The info row never shows a workstream count or an issue count in any data state.
4. `#gen-date`, `#branch-line`, `#branch-name`, `#live-status` and `#app-version` keep
   their ids, their markup, their `hidden` attributes and their current behaviour.
5. KPI Tile 1 still shows `workstreams.length`, and KPI Tile 2 still shows
   `openIssues.length` over the `M filed total across all issue lists` sub-line, with
   no change to `renderKpis` (`src/public/app.ts:1275-1363`).
6. `npm run build` completes clean, including the `tsc -p src/public/tsconfig.json`
   type-check gate and the eval guard in `tools/bundle-public.mjs`.
7. The board loads with no console error, and `applyData` still runs to completion
   (`#lower` is revealed, the KPI strip is populated, the poller sets live status).
8. `src/public/styles.css` is unchanged by this work.

### Out of scope

- Any change to the KPI tiles, the KPI strip layout, or `renderKpis`.
- Any change to `.toolbar-sub`, `.tb-meta`, `.tb-meta-item`, `.tb-version` CSS.
- Any change to the main toolbar, the breadcrumb row, the filter row or the sort row.
- The home screen (`src/public/index.html`), which carries no `.tb-meta` row.
- Relocating the counts anywhere else, or adding a tooltip or title attribute to
  compensate for their loss.

### Assumptions

- **A1 — Release constraints.** This is a locally built desktop and localhost app with
  no server-side persisted state, no schema, and no API contract touched. The change
  ships in the next ordinary build with no flag, no migration and no staged rollout.
- **A2 — Counts stay visible.** `renderKpis` is an IIFE inside `applyData`
  (`src/public/app.ts:1275`) and runs unconditionally on every data apply, on the same
  `workstreams` and `issues` arrays the removed line read. Any state where the info row
  had counts is a state where the KPI tiles have them too, so no data state loses both.
- **A3 — No external consumer of the id.** `#meta-counts` is referenced only at
  `src/public/board.html:40` and `src/public/app.ts:1249`. Nothing under `src/`,
  `electron/` or `tools/` reads it, and no CSS rule targets it.
- **A4 — `dist/` is generated.** `dist/` is git-ignored (`.gitignore:4`).
  `tools/copy-assets.mjs` copies `board.html` verbatim into `dist/public/`, and
  `tools/bundle-public.mjs` sweeps every stale `.js` there before esbuild rewrites
  `dist/public/app.js`. Editing the two source files is the whole edit; no compiled
  output is hand-touched.

## Key flows

**Board info row renders after data load** — **Actor:** a user opening a project board.
**Preconditions:** a project is selected and its payload fetched. **Main flow:**
`applyData` writes `#gen-date` from `raw.generated`, then unhides `#branch-line` when
`raw.branch` is set, then `renderKpis` fills `#kpi-strip`; the poller calls
`setLiveStatus` (`src/public/app.ts:1159`) and fills `#live-status`. **Outcome:** the row
reads `Generated <date> · Branch <name> · Live · updated <time>`, and both counts appear
only in the KPI tiles below. **Edge cases:** with no branch, `#branch-line` keeps its
`hidden` attribute, its `::before` middot is suppressed with it, and the row reads
`Generated <date> · Live · updated <time>`. Before the first poll, `#live-status` is empty
and `.tb-meta-item:empty` hides it, so the row reads `Generated <date>` alone with no
trailing middot. When the poll fails, `setLiveStatus(false)` writes `Not updating` and
adds `is-stale`; the row layout is unaffected.

## Design

This is a deletion, so the design is the pair of contracts that change and the pair that
must not.

**DOM contract — `src/public/board.html`.** The `.tb-meta` block loses one child. Its
required content after the change is exactly three `.tb-meta-item` spans, in this order:
the `Generated`/`#gen-date` span, the `#branch-line` span with its `hidden` attribute and
its nested `#branch-name` strong, and the empty `#live-status` span. The wrapping
`.toolbar-sub` div and its `.tb-version`/`#app-version` sibling are untouched. The id
`meta-counts` is retired and must not be reused.

**Script contract — `src/public/app.ts`.** `applyData(raw: BoardPayload)` loses the two
physical lines at `1249-1250`. Its signature, its parameter type, and every other write
in the block — `#gen-date` at `1245`, `#board-title` at `1246`, `#branch-name` and
`#branch-line` at `1252-1253`, `#lower` at `1255` — stay as they are. `applyData` after
the change knows nothing about counts; it must NOT gain a replacement write, a guarded
`getElementById` lookup, or a comment standing in for the removed line.

**Ordering constraint — the two edits are one unit.** `byId` is
`document.getElementById(id)!` (`src/public/app.ts:76`): a non-null assertion the compiler
trusts and the runtime does not. Removing the span while the write survives makes line
1249 throw a `TypeError` on null and abort `applyData` before `renderKpis` and before
`#lower` is revealed — a blank board. The two files must therefore change together, in
one commit, and must never be split across stages.

**Unchanged by design — `src/public/styles.css`.** `.tb-meta-item:empty` (line 227) is
retained: `#live-status` ships empty and still depends on it. The sibling separator rule
(line 228) is retained and needs no adjustment, because it generates the middot inside the
*second* element of each adjacent pair — deleting an element deletes its own separator,
and a `display: none` element suppresses the separator it owns. No rule names
`#meta-counts`, so no rule is orphaned.

## Stages

1. **Remove the counts item and its writer.** Delete `src/public/board.html:40` and
   `src/public/app.ts:1249-1250` in one change, then run `npm run build`. It is the only
   stage because the change is atomic: either file alone leaves the board broken or the
   duplication in place. Observable at the end: the board's info row shows the generated
   date, the branch when present, and live status, with correct middot spacing and no
   counts; the KPI tiles are unchanged; the build is clean and the console is silent.

## Data & compatibility

No data model, no migration, no persisted state and no API contract is involved. The
board payload (`BoardPayload`) is unchanged — the removed line only read the already-parsed
`workstreams` and `issues` arrays, which many other consumers still use.

The one compatibility surface is the DOM id `#meta-counts`, retired here. In-repo consumers
are zero (Assumption A3). Rollback is a single-commit `git revert`; nothing is destructive
and nothing is staged, so there is no point past which the change cannot be pulled.

## Testing strategy

There is no automated coverage for the board's DOM. `src/lib/*.test.ts` uses `node:test`,
`package.json` declares no `test` script, and nothing under `src/public/` has a test file.
This plan adds none: a browser-DOM harness for a two-line deletion is scope the request
does not carry, and it would be the first of its kind in the repo.

Verification for the single stage is therefore build plus browser:

- **Static gate** — `npm run build`. `tsc -p src/public/tsconfig.json` type-checks `app.ts`
  under `strict`, and `tools/bundle-public.mjs` re-bundles and re-runs the eval guard.
- **Grep gate** — `meta-counts` absent from `src/`, `electron/` and `tools/`.
- **Browser pass** — open a board and read the info row in three data states: branch
  present, branch absent, and before the first poll completes. Confirm middot placement in
  each, confirm the KPI tiles are unchanged, and confirm the console is clean.

## Open questions

1. **Deployment and release constraints.** Assumption A1 treats this as a plain
   next-build change with no flag, no migration and no rollout staging, because the app is
   locally built and the change touches no persisted or shared state. If a packaged release
   is mid-flight, or if a specific build must carry this, the stage is unaffected — only the
   commit's timing is. Recommendation: proceed under A1.
2. **Consumers of `#meta-counts` outside this repository.** The id is retired, and the
   grep proves no in-repo reader. A user-side artefact outside the repository — a saved
   screenshot-diff baseline, a personal bookmarklet, a browser extension selector — cannot
   be checked from here. Options: retire the id as planned, or keep an empty span as a
   selector stub. Recommendation: retire it. A permanently empty element preserved for an
   unknown reader is dead markup, and the request asked for removal.

## Alternatives considered and rejected

1. **Keep the span, delete only the `app.ts` write, and let `.tb-meta-item:empty` hide
   it.** Rejected: it leaves a permanently empty element and a live id in the DOM contract,
   and it makes a CSS rule responsible for hiding markup that should not exist.
2. **Keep both, and hide the item with `#meta-counts { display: none; }` in
   `styles.css`.** Rejected: the code would still compute and write a string nobody can see,
   and it adds a CSS rule where the request asked for a removal.
3. **Move the counts elsewhere in the info row, for example into the generated date's
   `title` attribute.** Rejected: the user's decision is removal, not relocation, and the
   KPI tiles already carry both figures.
4. **Split the work into two stages, markup then script.** Rejected: `byId`'s non-null
   assertion (`src/public/app.ts:76`) makes the intermediate state a runtime `TypeError`
   that aborts `applyData`, so neither half is independently shippable.
5. **Add a DOM regression test for the info row alongside the deletion.** Rejected: the
   repo has no browser-test harness, and introducing one for a two-line deletion is scope the
   request does not carry.

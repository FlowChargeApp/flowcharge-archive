---
id: PLN-77-v2atsx
type: plan
workstream: WS-85-qwdpix
slug: search-does-not-match-child-artefact-ids
title: "Board search matches child artefact IDs and titles"
status: ready
created: 2026-09-01
updated: 2026-09-01
depends_on: []
links: []
---

# Board search matches child artefact IDs and titles

## Summary

The board's `#search` box matches only a workstream's own `id`, `title`, `slug` and
`tags`, because `matches(w, q)` at `src/public/app.ts:114-118` builds its haystack from
those four fields alone. Typing a plan, task-list, issue-list or issue ID never finds the
workstream that owns it.

The fix has two parts. The extractor gains one field: each entry in a workstream's
`artefacts` array carries the artefact's frontmatter `title`, which
`src/lib/extract.ts:156` already parses and then discards. The browser gains a
per-workstream search index, built where the data changes rather than on every keystroke,
that folds the workstream's own four fields together with its artefact IDs and titles and
the IDs and titles of its issues. `matches()` becomes a lookup against that index.

This is chosen over a client-only fix because child artefact titles do not reach the
browser today, and over per-workstream detail fetches because the search box must answer
on every keystroke. Existing workstream-level matching is unchanged; the change is purely
additive.

## Scope

### Acceptance criteria

1. Typing a plan ID (for example `PLN-77-v2atsx`) leaves only the workstream that owns that plan visible on the board.
2. Typing a task-list ID or an issue-list ID leaves only the workstream that owns it visible.
3. Typing an issue ID (`ISS-…`) leaves only the workstream whose issue list holds that issue visible.
4. Typing text from a plan, task-list or issue-list title leaves the owning workstream visible.
5. Typing text from an issue title leaves the workstream that owns that issue visible.
6. Every query that matched before still matches: workstream ID, title, slug, tag, and any substring of them, case-insensitively on both sides.
7. Each entry in a workstream's `artefacts` array in the board payload carries a `title` string, empty when the source file declares no `title`.
8. The `#result-count` line and each column's "No matches" placeholder report the widened match, with no change to how they are worded.

### Out of scope

- The `#search` input's placeholder text at `src/public/board.html:75`. It already promises "Filter by title, slug, tag, or ID…", and this work makes that promise true rather than rewording it.
- The `#filter-chips` tag-filter row and the `FILTER_ROW_ENABLED` switch at `src/public/app.ts:44`. That row is a separate axis, gated by WS-56 and WS-57, and nothing here touches it.
- Any card-level cue showing which child artefact caused a match.
- The sort controls, the KPI panels, the stale-artefact panel, and the detail modal.
- Search over an artefact's body text, an issue's severity or status, or a task's title. Only IDs and titles are in scope.

### Assumptions

1. Issues are treated as child artefacts here. The workstream record's root-cause section names `ISS-` IDs among the IDs that fail to match, and `PraxisData.issues` already carries `id`, `title` and `workstream` to the browser, so covering them costs nothing beyond folding two more strings into the index. The workstream record's shorter "Net ask" paragraph lists only plan, task list and issue list; the wider reading is taken.
2. The search index holds full artefact IDs. A card displays an abbreviated form (`PLN·77`, built at `src/public/app.ts:304`); typing that abbreviation with its middle dot is not a supported query, while typing `77` or `PLN-77` still matches by substring.
3. There is no production deployment and no live user of this board other than the author, and no persisted state derives from the search box — `query` at `src/public/app.ts:49` is in-memory only, with no URL parameter and no storage. No feature flag, dark launch or staged rollout is warranted.
4. The board payload is regenerated from the source markdown on every request, so a payload shape change needs no migration and no backfill.
5. `npm run build` compiles the Node side and the browser side together, so the extractor and the browser bundle ship as one pair.

## Key flows

**Find a workstream by a child artefact ID** — **Actor:** a person reading the board.
**Preconditions:** a project board is open and its payload has loaded.
**Main flow:** the person types or pastes a plan, task-list, issue-list or issue ID into
`#search`; each keystroke sets `query` and calls `renderBoard()`; `matches()` reads the
workstream's precomputed haystack from the search index and keeps the card when the
lowercased query is a substring of it. **Outcome:** the owning workstream's card stays on
the board in its status column, and the result count reports the narrowed set.
**Edge cases:** an empty or whitespace-only query matches every workstream, as it does
today; an ID that belongs to no artefact empties every column and each column shows "No
matches"; a workstream with no artefacts and no issues indexes exactly the four fields it
indexes today; an artefact file with no `title` contributes its ID only, never the string
`undefined`.

## Design

### Payload contract

`PraxisArtefact` in `src/types/praxis-data.d.ts:6-13` gains one field:

```ts
interface PraxisArtefact {
  id: string;
  type: string;
  title: string;   // '' when the source file's frontmatter declares no title
  status: string;
  updated: string;
  total?: number;
  done?: number;
}
```

`title` is required, never `undefined`, so no consumer needs a presence check. It sits
beside `type` because both are read from the same frontmatter block. `PraxisIssue`,
`PraxisWorkstream` and `PraxisData` are unchanged; `PraxisWorkstreamDetail` and its
`PraxisDetailArtefact` are unchanged, since the detail route already carries titles
(`src/lib/detail.ts:255`).

### Extractor

`src/lib/extract.ts` populates the new field in the per-file loop that builds `entry` at
line 158. `parseFrontmatter` has already produced `fm` at line 156, so the title needs no
second read of the file. The value is taken only when the parsed frontmatter holds a
string, and falls back to `''` otherwise — the same shape of guard the same function
already applies to `description` and `blocked` at lines 215-216, rather than the bare
`fmStr` cast used for keys the walk requires. No other part of `walkWorkstreams` changes:
the artefact sort comparator, the issue-block scan, and the workstream record it pushes
all stay as they are.

The extractor knows nothing about search. It publishes the title because the title is part
of the artefact; which surface consumes it is not its concern.

### Browser search index

`src/public/app.ts` gains one module-scope variable and one builder, placed beside the
existing `dependsOn` / `dependedBy` graph so both derived structures live together:

```ts
var searchIndex: Record<string, string> = {};   // workstream id → lowercased haystack
function buildSearchIndex(): void
```

`buildSearchIndex()` is called from `applyData`, immediately after `buildDepIndex()` at
`src/public/app.ts:1230`, where `workstreams` and `issues` have both just been assigned.
It is never called from `renderBoard()`, for the reason the comment at
`src/public/app.ts:1228-1229` already records: `renderBoard()` runs on every keystroke.
`applyData` itself runs only when the polled response bytes differ from the last applied
payload (`src/public/app.ts:1181-1185`), so the index is rebuilt only on a real data
change.

Each entry's haystack is the lowercased concatenation of, in this order: the workstream's
`id`, `title`, `slug` and `tags` — the four fields today's `matches()` already uses, in
the order it uses them — then each of its `artefacts` entries' `id` and `title`, then the
`id` and `title` of every `PraxisIssue` whose `workstream` equals the workstream's `id`.
Fields are joined by a single space, and an empty title contributes nothing but that
separator.

`matches(w, q)` keeps its signature and its early return for an empty query. It reads
`searchIndex[w.id]` instead of concatenating, and falls back to the workstream's own four
fields when the index holds no entry for that ID, so a card can never become silently
unfindable through an index gap. Its callers are unchanged: the single call site is the
column filter at `src/public/app.ts:443`, where the three filter axes combine with AND.

The index knows about workstream records, artefact entries and issue records, all of which
already reach this module. It must NOT know about the DOM, about the card's abbreviated ID
display, about sort state, or about the tag chips — `tagMatch` and `blockedOnly` stay
separate axes and are not folded in.

### Case handling

Query normalisation is unchanged: `renderBoard()` lowercases and trims `query` once at
`src/public/app.ts:423` before passing it to `matches()`. The index stores its haystacks
already lowercased, so no per-keystroke lowercasing is added.

## Stages

1. **Artefact titles reach the payload.** Extend `PraxisArtefact` and populate `title` in `src/lib/extract.ts`. This is first because it is the contract every later step builds on and the only change that crosses a module boundary. Observable at the end: `npm run refresh -- --root .` dumps a payload whose every artefact entry carries a `title`, and the extract suite asserts it.
2. **The search index and the widened match.** Add `searchIndex` and `buildSearchIndex()` to `src/public/app.ts`, call it from `applyData`, and rewrite `matches()` to read it. This is second because it consumes stage 1's field. Observable at the end: typing a `PLN-`, `TL-`, `IL-` or `ISS-` ID, or words from a child artefact's title, filters the board to the owning workstream, while every workstream-level query behaves as before.

## Data & compatibility

- **Migration:** none. The board payload is extracted from the markdown on every request, and `.praxis-projects.json` is untouched.
- **Payload consumers:** `title` is additive. Today's readers of `artefacts` — the card's artefact rows at `src/public/app.ts:296`, the stale collector at line 1261 and the KPI counter at line 1339 — read `id`, `type`, `status`, `updated`, `total` and `done` only, so none of them changes behaviour.
- **Poll churn:** the first payload served after stage 1 differs in bytes from whatever a running board last applied, so `pollOnce` applies it and re-renders once. That is one extra render, and the board preserves its horizontal scroll across it (`src/public/app.ts:1187-1190`).
- **Mixed build:** a partially rebuilt `dist/` could pair a new bundle with an old server, whose payload has no `title`. The index builder's empty-string fallback keeps that case working with IDs alone rather than indexing the literal `undefined`. `npm run build` rebuilds both sides, so the case is transitional only.
- **`npm run refresh` dumps:** existing JSON files on disk simply lack the field. The board never reads them (README, "Scripts"), so nothing needs regenerating.
- **Rollback:** revert the two source files and rebuild. There is no persisted state, no schema and no migration to reverse, so the feature is fully reversible at any point, including after stage 1 alone.

## Testing strategy

There is no browser-side test harness — every `.test.ts` in this repo is Node-side, all but
`src/server.test.ts` under `src/lib/`, run with `node --test dist/lib/<name>.test.js` after
`npm run build` (`src/lib/extract.test.ts:8`). The split follows that boundary.

- **Stage 1, unit:** extend `src/lib/extract.test.ts` to assert that the fixture project's issue-list artefact reaches `artefacts[]` carrying its frontmatter title. The shared fixture at `src/lib/fixture-project.ts` already writes an issue list titled "Fixture issues", so the assertion needs no fixture change. Run the detail suite as well, since both suites import the same fixture builder.
- **Stage 1, compile:** `npm run build` must pass all three TypeScript projects; adding a required field to a shared ambient interface is checked by the compiler across both compilations.
- **Stage 2, manual:** open this repository's own board and confirm, in one pass: a plan ID, a task-list ID, an issue-list ID and an issue ID each narrow the board to the right card; a fragment of a child artefact title does the same; a workstream ID, title, slug and tag all behave as before; an unmatched string empties every column; clearing the box restores every card and the full result count.
- **Not covered:** `matches()` and `buildSearchIndex()` get no automated test, because standing up a DOM harness for `src/public/` is a larger change than this fix and none exists to extend.

## Open questions

None. Every choice this fix needed is settled above, and the two readings that were open —
whether issues count as child artefacts, and whether the card's abbreviated ID form is a
supported query — are recorded as assumptions 1 and 2, where either can be challenged and
reversed by a one-line follow-up.

## Adjacent opportunities

Not requested; listed only so they can be promoted deliberately in a later revision.

1. Show on a filtered card which child artefact matched the query, so a hit on a title the card does not display is explicable — skip, it adds UI the bug does not require.
2. Reuse the same index to make the detail modal's artefact tabs searchable — skip, no one has asked for search inside the modal.

## Alternatives considered and rejected

1. **Client-only fix using the IDs already on the payload.** Rejected: artefact titles never reach the browser today, so this satisfies the ID half of the request and none of the title half.
2. **Fetch each workstream's `PraxisWorkstreamDetail` to obtain titles.** Rejected: one request per workstream per board load and per poll, to serve a filter that must answer on every keystroke.
3. **Build the haystack inside `matches()` on each call, as it is built today.** Rejected: it would rescan every issue for every workstream on every keystroke, and it contradicts the convention this module states at `src/public/app.ts:1228-1229`, that data-derived structures are built where the data changes.
4. **Have the extractor emit a ready-made `searchText` field per workstream.** Rejected: it puts a browser display concern in a pure extraction library and duplicates strings the payload already carries.
5. **Match child artefact IDs only and leave titles out.** Rejected: workstream titles are already searchable, so excluding artefact titles reproduces the same surprise one level down.

## Final summary

- **Approach:** publish each artefact's `title` from the extractor, then match against a per-workstream search index built in `applyData` that folds artefact and issue IDs and titles in beside the workstream's own four fields.
- **Size:** 2 stages, 3 files touched (`src/types/praxis-data.d.ts`, `src/lib/extract.ts`, `src/public/app.ts`) plus one test file; a short sitting each.
- **Risks:** an artefact file with no `title` must contribute `''` and never `undefined`; the index must be rebuilt on every data change or a new artefact stays unfindable until reload; a stale `dist/` can pair a new bundle with an old payload.
- **Needs your answer:** nothing blocking. Confirm assumption 1 (issue IDs and titles are in scope) and assumption 2 (the card's `PLN·77` form is not a supported query) if you disagree with either.

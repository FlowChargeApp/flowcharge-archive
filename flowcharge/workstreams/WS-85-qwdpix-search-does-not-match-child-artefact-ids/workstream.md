---
id: WS-85-qwdpix
type: workstream
workstream: WS-85-qwdpix
slug: search-does-not-match-child-artefact-ids
title: "Board search box doesn't match plan, task-list, or issue-list IDs"
description: "The board's search box (#search, filters the workstream cards as you type) only ever matches a workstream's own id, title, slug, and tags (app.ts's matches() function, line 114). It never checks that workstream's plan, task-list, or issue-list IDs, or their titles, so typing a PLN-, TL-, or IL- id (or an ISS- issue id) never finds the workstream that owns it, even though workstream ids and titles work fine."
status: backlog
tags: [board, bug, ids, feature]
created: 2026-08-31
updated: 2026-09-01
author: Anthony Koukoullis
depends_on: []
links: []
---

The board's search filter only matches a workstream's own id/title/slug/tags, not its plan, task-list, or issue-list IDs, so typing a child artefact's ID never finds the owning workstream.

## What the user said

"This one is a bug and the filter box text box on the sort and filter toolbar does not filter when I start typing in the ID of a plan or a task list or an issue list, it only seems to work with workstream IDs and the titles of workstreams. Create a work stream to fix this issue."

## Confirmed root cause

`byId('search')` (`src/public/board.html:75`, placeholder "Filter by title, slug, tag, or ID…") is wired at `src/public/app.ts:492-495` to set a module-level `query` string on every keystroke, which feeds `renderBoard()`. The actual text match happens in `matches(w, q)` at `src/public/app.ts:114-118`:

```ts
function matches(w: PraxisWorkstream, q: string) {
  if (!q) return true;
  var hay = (w.id + ' ' + w.title + ' ' + w.slug + ' ' + (w.tags || []).join(' ')).toLowerCase();
  return hay.indexOf(q) !== -1;
}
```

`hay` is built only from the workstream's own `id`, `title`, `slug`, and `tags`. The board's data model at this point (`workstreams.forEach` in `renderBoard`, around `src/public/app.ts:430`) iterates workstream records only; a workstream's plan/task-list/issue-list IDs and titles are not folded into `hay` at all, so no text belonging to a child artefact can ever match, regardless of what the placeholder text promises ("Filter by title, slug, tag, or ID…" doesn't scope "ID" to workstream IDs only, which is itself part of the bug from a user's perspective).

Note: this is the `#search` text box, which is separate from and unaffected by the `#filter-chips` tag-filter row that WS-56/WS-57 gate behind `FILTER_ROW_ENABLED`. The search box described here is not hidden and is fully live today.

## Net ask

Extend the search match to also check each workstream's owned plan, task-list, and issue-list IDs (and likely their titles too, for the same reason workstream titles are already searchable) so that typing any of those IDs, or matching text from their titles, finds the workstream that owns them. Where the artefact ID/title data comes from client-side (is it already loaded per-workstream, or does it need fetching) is an implementation question for the plan, not decided here.

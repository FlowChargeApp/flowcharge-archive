---
id: WS-54-4gm92r
type: workstream
workstream: WS-54-4gm92r
slug: board-filter-and-blocked-chip
title: "Add a blocked-count chip to the KPI strip and a tag/blocked filter row to the board"
status: done
tags: [board, ui, ux]
created: 2026-08-21
updated: 2026-08-21
author: Anthony Koukoullis
depends_on: []
links: [WS-53-ah1p06]
---

Add two small board UI improvements raised while designing WS-53's blocked badge: a blocked-count KPI indicator, and a filter row for exact tag/blocked filtering.

Both come from a cl-opus-high subagent's advisory opinion this session, given the context of WS-52 (description-in-modal) and WS-53 (blocked-field-badge), both already planned and spec-tasked but not yet executed:

1. **Blocked KPI indicator.** WS-53's plan deliberately added no KPI tile or chip for blocked workstreams, reasoning that a whole tile would be empty most of the time and the card badge already surfaces it. The subagent agreed no full tile is warranted, but disagreed that nothing should replace the old Blocked column's aggregate visibility — on a growing board (this project alone has 49 workstreams), a blocked card can now sit in any of five columns with no way to see the count at a glance. Its recommendation: add one small chip to the existing Workstreams KPI tile's chip row, shown only when the blocked count is greater than zero, colored with `--sev-critical` (matching the card badge), not a `--st-` status color. Caveat raised: the chip row today sums to the workstream total, and a blocked chip would break that invariant since blocked overlaps other statuses rather than replacing one — accept that trade, or drop the count. This workstream should decide.

2. **A filter row for the board.** Today the board has sort (by id/name/severity/created/updated, ascending/descending) and one free-text search box (`matches()` in src/public/app.ts) that does a lowercase substring match against id, title, slug, and joined tags — it is not an exact tag filter. The subagent measured this project's own 49 records and found the "just search the tag name" idea unreliable in practice: searching "board" matches 19 records via substring but only 5 actually carry the `board` tag; searching "ui" matches 18 records but only 15 carry that tag, because the substring also appears inside words like "build" and "guidance". It also flagged a hard gap: WS-53 deliberately keeps the new `blocked` field out of `matches()` entirely, so once WS-53 lands there will be no way in the UI to find blocked work at all, fuzzy or otherwise.
   Its suggested shape, to be refined in this workstream's own plan rather than treated as final: exact-equality toggle chips (not substring) for a small set of *selective* tags — skip a tag that already sits on most records (e.g. the automatic `feature` tag, already on 18 of 49) — plus one "blocked only" toggle; chips across different axes (tag vs. blocked) combine with AND, multiple tag chips combine with OR; the existing free-text search box stays as-is and combines with the chip filters via AND; add one visible Clear control so a forgotten active filter with an apparently empty board doesn't confuse the user. Reuse the existing `.seg` toggle-button markup/CSS pattern already used for the sort controls in `src/public/board.html`, rather than inventing a new control style.

Both items touch the `blocked` frontmatter field WS-53 adds, so this workstream's actual code changes should be sequenced to land after WS-53's task list (TL-52-74z9f6) executes — the plan and task list for this workstream should state that dependency explicitly, the same way WS-53 depends on WS-52.

Next steps for this workstream: investigate the codebase to determine the best way to implement both, write up a plan from the findings, then author spec tasks. Execution and commit were not requested yet.

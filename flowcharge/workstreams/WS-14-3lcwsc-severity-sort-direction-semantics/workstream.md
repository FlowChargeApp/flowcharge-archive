---
id: WS-14-3lcwsc
type: workstream
workstream: WS-14-3lcwsc
slug: severity-sort-direction-semantics
title: "Reconsider Severity sort's Ascending direction"
status: done
created: 2026-08-07
updated: 2026-08-07
depends_on: []
links: []
tags: [board, sort, ux]
---
Severity sort's "Ascending" direction currently shows the most-severe workstreams first, which reads as backwards to users expecting low-to-high. This is deliberate per WS-8/PLN-8 (`severityCmp()` in `src/public/app.ts` compares `y - x` so items with no open-issue severity sort to the bottom under default Asc), not an accidental bug — but the convention needs reconsidering, e.g. inverting to match the other four sort keys or clarifying it in the UI. Also check, unconfirmed, whether any other sort key has a similar ascending/descending mismatch.

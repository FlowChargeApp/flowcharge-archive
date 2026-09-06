---
id: WS-57-7n4rzk
type: workstream
workstream: WS-57-7n4rzk
slug: hide-filter-row-until-relaunch
title: "Hide the board's filter row until WS-56 lands"
status: done
tags: [board, ui, feature]
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: []
links: [WS-56-kdu68p]
---

Hide the filter row WS-54 added, as a quick, simple, easily-reversible change — not a redesign.

The user has decided to prioritize launching the app over adding more UI polish first, and has put a line in the sand: the backlog (6 items) is enough runway for incremental post-launch updates, and the filter row's known gaps (WS-56: dead zone on small projects, no "More tags" overflow, no mobile handling) should not block launch. Rather than ship the filter row in its current known-incomplete state, hide it for now. It gets re-enabled once WS-56's fixes and features land.

Keep the fix minimal and trivially reversible — a single toggle to flip back on, not a removal of any code WS-54/WS-56 already built. Write a short plan, then open spec tasks. No investigation stage requested — this is intentionally simple.

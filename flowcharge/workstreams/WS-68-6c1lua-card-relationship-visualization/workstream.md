---
id: WS-68-6c1lua
type: workstream
workstream: WS-68-6c1lua
slug: card-relationship-visualization
title: "Visually represent links and dependency relationships between workstream cards on the board"
description: "Add a visual representation on the board for the existing links relationship between workstream cards, alongside the current depends_on relationship, so both kinds of card-to-card connections are visible at a glance."
status: backlog
tags: [board, ux, dependencies, ui, feature]
created: 2026-08-25
updated: 2026-08-25
author: Anthony Koukoullis
depends_on: []
links: []
---
Cards can hold two kinds of relationship — the `links` array (related, non-blocking) and the `depends_on` array (must-complete-before) — and the board needs a visual way to show both.

This is both a design and a coding workstream: it needs UX/UI expertise on top of implementation. The requested flow is: investigate the codebase to determine the best way to implement this, write a plan from the findings, then open spec tasks to implement the plan. Execution of those tasks is not requested yet.

Note: a related, already-completed workstream (`WS-25-u72qbt-card-dependency-highlighting`) added clickable `depends_on` links and chain highlighting to the board. This workstream is broader — it must also cover the separate `links` relationship, not just `depends_on` — so investigation should establish how (or whether) to build on that prior work rather than duplicate it.

---
id: WS-77-ctmvwq
type: workstream
workstream: WS-77-ctmvwq
slug: sticky-toolbar-stack-on-scroll
title: "Keep the top toolbar (.toolbar), breadcrumb bar (.toolbar-crumb) and sort/filter bar sticky on board scroll"
description: "Today only the sort-and-filter bar sticks to the top of the viewport when the board scrolls. Extend the behaviour so the top toolbar (the header row with class `.toolbar`) and the breadcrumb bar directly beneath it (with class `.toolbar-crumb`) stick as well, and so the sort-and-filter bar sticks directly beneath them. All three rows stay pinned and visible, stacked in that order, at any scroll position."
status: backlog
tags: [board, ui, styling, feature]
created: 2026-08-30
updated: 2026-08-31
author: Anthony Koukoullis
depends_on: []
links: []
---

Pin the top toolbar (`.toolbar`), the breadcrumb bar (`.toolbar-crumb`) and the sort-and-filter bar to the top of the viewport as the board view scrolls, stacked in that order.

## The current behaviour

The Praxis Board app's board view has a sticky-scroll behaviour problem. Currently, when the user scrolls the board down, only the sort-and-filter bar becomes sticky once it reaches the top of the viewport — it stays pinned there on its own.

## What the user wants

The user wants this extended: the top toolbar (the header row with class `.toolbar`, holding the app wordmark and theme switcher) and the breadcrumb bar directly beneath it (the row with class `.toolbar-crumb`, holding the "Projects › Board" breadcrumb) should also become sticky as the user scrolls, so they remain pinned at the top of the viewport instead of scrolling out of view. The sort-and-filter bar should then stack directly beneath those two sticky bars and become sticky itself at that lower position — so all three rows (`.toolbar`, `.toolbar-crumb`, sort-and-filter bar) stay visible and pinned at the top of the viewport at all times during scroll, not just the sort-and-filter bar as today.

Net effect: no matter how far the user scrolls the board, the top toolbar (`.toolbar`), the breadcrumb bar (`.toolbar-crumb`), and the sort-and-filter bar remain visible, stacked in that order at the top of the viewport.

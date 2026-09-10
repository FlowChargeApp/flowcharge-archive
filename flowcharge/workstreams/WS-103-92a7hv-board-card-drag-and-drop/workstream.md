---
id: WS-103-92a7hv
type: workstream
workstream: WS-103-92a7hv
slug: board-card-drag-and-drop
title: "Drag workstream cards between the backlog, ready and dropped board columns"
description: "The board is read-only today apart from filtering and sorting, because an agent drives it through FlowCharge Core sessions. Limited, carefully-scoped drag-and-drop can coexist with that: a human could stage backlog cards into ready and then ask the agent to run everything in ready, or move an irrelevant workstream straight to dropped. Only backlog, ready and dropped may ever accept a human drag; in-progress and done must stay the consequence of a formal agent action. A drop must still change the workstream record's frontmatter status and regenerate, never hand-edit the generated board. Feasibility, the animation method and whether any drag-and-drop library is worth the zero-runtime-dependency cost are all open, and get decided when this is planned."
status: backlog
tags: [board, board-card, frontend, ui, ux]
created: 2026-09-10
updated: 2026-09-10
author: Anthony Koukoullis
depends_on: []
links: []
---
Allow a human to drag workstream cards into the backlog, ready and dropped columns only, with a wiggle on pick-up and the other cards reflowing to open a gap at the drop position.

This is a new UI feature request for the board itself (`src/public/board.html`, `src/public/app.ts`), not a FlowCharge Core orchestration change.

What is wanted: limited drag-and-drop of workstream cards between board columns. This is a large, deliberately open-ended item — feasibility and implementation method are to be determined when the team gets around to implementing it, not now.

## Why the app is read-only today, and why that need not stay true

The app is currently read-only to a large extent, except for filtering and sorting. This is by design: an agent drives the board more than the human does, working through FlowCharge Core sessions. But that does not mean it always has to stay that way — limited, carefully-scoped interactivity can coexist with an agent-driven workflow.

## Which columns should allow dragging, and which must not

Only three of the five status columns should ever allow a human to drag a card into them: `backlog`, `ready`, and `dropped`. The other two, `in-progress` and `done`, must never be human-drag targets, because they are meant to be the consequence of a formal action, not a manual move: a workstream only becomes `in-progress` when an agent is formally told to start it, and only becomes `done` when the agent finishes it and sets that itself. A human dragging a card straight to "in-progress" or "done" would misrepresent what has actually happened.

## The two motivating human workflows this unlocks

1. A human planning out loud — e.g. talking through the day's objective — could grab a handful of `backlog` cards and drag them into `ready`, then ask the agent to execute everything sitting in `ready`. This mirrors the existing `ready` status's own defined meaning (optional, user-driven staging — a person marks records ready to batch the several workstreams they mean to work on next; it is never a gate, since `backlog` is already actionable) but currently that batching can only be done by editing files or asking the agent to do it — never by direct manipulation on the board itself.
2. A human reviewing the board might spot workstreams that have become irrelevant or redundant, and currently has to say so to an agent (or hand-edit frontmatter) to move them to `dropped`. Drag-and-drop would let them do this directly and quickly.

## This does not replace the existing method

Everything achievable through drag-and-drop must remain equally possible the original way — telling an agent in a FlowCharge Core session to move a workstream's status and regenerate. Drag-and-drop is an additional, faster path for a human working directly on the board, not a replacement for the agent-driven convention CONVENTIONS.md already documents (a card's status only ever changes by editing the workstream record's frontmatter and regenerating — this feature must still go through that same mechanism under the hood, never by hand-editing the generated board file).

## The interaction and animation the maintainer explicitly wants

- When a card starts being dragged, it should visibly wiggle a little, so it's clear it has been picked up.
- As the dragged card hovers over its eventual destination among the other cards in a column, the column should visually adjust — other cards shifting to open a gap at the position the dragged card would land in, similar to how many drag-and-drop list UIs behave, so the final position is clear before the drop.
- The maintainer has seen a number of UI libraries with polished drag-and-drop animations of this kind, but does not know whether any is a good specific fit here, and explicitly wants this discussed and evaluated — including whether any library is worth pulling in at all, given this project's stated zero-runtime-dependency philosophy for the shipped code (DEVELOPMENT.md, Prerequisites) — at the point this workstream is actually planned and executed, not decided now.

This is a backlog card only: no plan, issue list or task list is to be authored from it yet, and nothing is to be executed.

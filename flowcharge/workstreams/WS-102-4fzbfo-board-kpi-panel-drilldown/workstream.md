---
id: WS-102-4fzbfo
type: workstream
workstream: WS-102-4fzbfo
slug: board-kpi-panel-drilldown
title: "Drill down from board KPI tiles and lower panels to workstreams"
description: "The board's KPI numbers and its two lower panels are dead ends today: no tile on the strip is clickable, the Needs attention rows are plain unclickable divs, and the severity panel shows only a stacked bar and a colour legend with no list behind it. Make the summary numbers, the lower-panel breakdowns and the workstream detail modal agree, so a count can be drilled down to the specific workstreams behind it in two clicks or fewer."
blocked: "The maintainer is unsure exactly what the two bottom panels should list — task lists, issue lists, or workstreams — and wants further discussion before this is planned. Do not author a plan, issue list or task list for this workstream before that discussion happens."
status: backlog
tags: [board, ui, ux, frontend, detail-modal]
created: 2026-09-10
updated: 2026-09-10
author: Anthony Koukoullis
depends_on: []
links: []
---

Make the board's Open issues and Needs attention KPI tiles clickable, make the lower-panel rows open the workstream detail modal, and add the missing severity breakdown list.

## Scope

This is a UI feature request for the board itself — `src/public/board.html` and
`src/public/app.ts` — not a FlowCharge Core orchestration change.

What is wanted: make the board's top KPI strip and its two bottom panels interactive and
connected to each other, so a summary number is never a dead end. Clicking a number should
show which workstreams or issues it actually refers to, and clicking one of those should
jump straight to that workstream's detail.

## Piece 1 — the top KPI strip

The strip is `#kpi-strip`, populated by `renderKpis()` in `app.ts`. It renders four tiles
today:

- "Workstreams" — status breakdown bar plus chips
- "Open issues" — count plus severity chips
- "Task completion" — percentage plus progress bar
- "Needs attention" — count of in-progress artefacts untouched 14+ days

None of the four tiles is clickable today.

Clicking "Open issues" or "Needs attention" — the two tiles whose numbers name specific
workstreams, not just an aggregate stat — should reveal exactly which workstreams they
refer to. Either mechanism is acceptable:

- Highlight the matching cards on the board itself with a distinct border colour, which
  clears on an outside click or on a second click; or
- Open a small popup or list naming the matching workstreams, from which each workstream
  can be opened directly.

Whichever mechanism is chosen should feel consistent with how the rest of the board already
reveals detail. The existing tag filter chips and the workstream detail modal are the
closest existing patterns.

## Piece 2 — the two bottom panels

The bottom panels are `.lower`, holding `#attn-list` and `#sev-bar` / `#sev-legend`. This
is where the feature partly exists already, but disconnected from the top strip and not
interactive.

- **"Needs attention"** (`renderAttention()`) already lists up to 12 individual stale
  artefacts by ID, title and slug — but the rows are plain, unclickable divs. Each row
  should become clickable and open that workstream's detail modal directly, reusing the
  existing `openModal(wsId, initialTab)` function that `app.ts` already calls elsewhere to
  open the same modal from a card click.
- **"Open issues by severity"** (`renderSeverity()`) is, as it stands today, only a stacked
  bar and a colour legend showing aggregate counts per severity. It does NOT list
  individual issue lists or workstreams at all, despite the maintainer's initial
  recollection that it already did — that recollection was actually describing the "Needs
  attention" panel. The request is to add that missing list: below or alongside the
  severity bar, list the workstreams and issue lists that actually hold open issues, broken
  down by severity, in the same clickable-row style as the "Needs attention" panel, each
  opening straight to that workstream's detail, likely landing on its issues tab.

## One connected feature

The two pieces should read as one connected feature, not two separate ones. A KPI tile's
number, a bottom-panel breakdown, and a workstream's own detail modal should all agree, and
should let a user drill from the summary down to the specific thing in two clicks or fewer.

## Explicitly out of scope

- The "Workstreams" and "Task completion" KPI tiles. Their numbers are pure aggregates with
  no single natural drill-down target — status and completion percentage do not name
  specific workstreams the way "open issues" and "needs attention" do.
- Redesigning the board's card layout, or the workstream detail modal itself.
- Any backend or API change. The board already receives full workstream and issue data
  client-side: `renderKpis()`, `renderAttention()` and `renderSeverity()` all operate on the
  already-fetched `workstreams` and `issues` arrays, with no server round-trip visible in
  that code.

## Not ready to plan — the list content needs more thought

This workstream is explicitly NOT ready to be planned yet. The maintainer's own follow-up
correction: what Piece 2's two bottom panels should actually list is still unsettled —
possibly the panels should each list only the task lists or issue lists that need
attention or hold open issues, rather than (or in addition to) listing workstreams
directly. This is a real, unresolved design question, not a detail to be assumed away
during planning. Do not author a plan, issue list or task list for this workstream until
the maintainer has discussed and settled it. The reason is recorded in the `blocked`
frontmatter key.

---
id: WS-21-m6g1do
type: workstream
workstream: WS-21-m6g1do
slug: plan-artefact-not-readable
title: "A workstream's plan is not readable on the detail screen or the board card"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: []
links: []
tags: [detail-modal, board-card, plan, bug]
---
A workstream's `plan.md` is named but never readable: the detail modal has no Plan tab, and the board card shows an inert `PLN` row. Make the plan readable on both surfaces.
`extractWorkstreamDetail()` (src/lib/detail.ts) builds only `issueLists` and `taskLists`, so the plan file is never opened. `src/public/board.html` declares only Issues and Tasks tabs with matching panels. On the card, `src/public/app.ts` renders a `PLN` row with an ID and a status but no progress, and it opens nothing. The plan is the one Praxis artefact type the dashboard names but cannot show.

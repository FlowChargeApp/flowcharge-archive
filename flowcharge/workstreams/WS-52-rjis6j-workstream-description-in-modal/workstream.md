---
id: WS-52-rjis6j
type: workstream
workstream: WS-52-rjis6j
slug: workstream-description-in-modal
title: "Show the new workstream description field at the top of the detail modal"
status: done
tags: [detail-modal, extraction, feature]
created: 2026-08-21
updated: 2026-08-21
author: Anthony Koukoullis
depends_on: []
links: []
---

Praxis workstream records now support an optional `description` frontmatter field. This dashboard does not read or show it anywhere yet — add that.

Grounded in the upstream Praxis repo (/Users/akoukoullis/Work/AK/Praxis), workstream WS-47-shh3y3 ("Add an optional description field to workstream records", status done). Its plan (PLN-34-q4919b) defines the field: `description: "<text>"`, optional, workstream records only, a single-line double-quoted scalar written immediately after `title`, soft-capped at 500 characters (Praxis's own generator WARNs past that but writes the value in full either way). Praxis's own upstream rendering deliberately puts it only on the Obsidian plain-text-kanban card's first body line — explicitly not in its index table or its `--list` output.

This dashboard has a different UI and should make its own placement choice, not copy Praxis's: the description must NOT appear on the board card. It must appear at the top of the workstream detail modal (the screen that opens when a card is clicked), above whatever the modal currently shows first. Reasoning given: `title` is already short and visible on the card; `description` is the fuller upfront explanation a user or agent wrote, and belongs in the deeper detail view, not competing for space on the compact card.

Scope: this dashboard's frontmatter extraction (src/lib/extract.ts) needs to read the new `description` key off a workstream record (it is not read today — grep confirmed no `description` handling in src/lib/extract.ts or src/types/praxis-data.d.ts), thread it through to the detail payload, and the detail modal's rendering code (src/public/app.ts) needs to display it at the top when present, and show nothing extra when the field is absent (most of the 47+ existing workstream records in Praxis-managed projects have no `description` yet, so the absent case must render cleanly with no empty gap).

Next steps for this workstream: investigate the codebase to determine the best way to implement this, write up a plan from the findings, then author spec tasks. Execution and commit were not requested yet.

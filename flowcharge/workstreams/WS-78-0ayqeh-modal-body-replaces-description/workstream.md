---
id: WS-78-0ayqeh
type: workstream
workstream: WS-78-0ayqeh
slug: modal-body-replaces-description
title: "Show the workstream body in the detail modal instead of its description field"
description: "The detail modal renders the description frontmatter field today. FlowCharge is retiring that field elsewhere, because it only restated the workstream body in a shorter, length-capped copy. Swap the data source only: render the workstream.md Markdown body where the description is shown now, on the same show-more button and the same clamp threshold. No new UI behaviour and no restyling."
status: done
tags: [detail-modal, markdown, extraction, ui]
created: 2026-08-30
updated: 2026-08-30
author: Anthony Koukoullis
depends_on: []
links: []
---
The workstream detail modal shows the `description` frontmatter field; render the workstream's Markdown body there instead, on the existing show-more mechanics.

## The request

The workstream detail modal in this Praxis-Dashboard app currently renders a workstream's `description` frontmatter field (element id `ws-modal-description`, with a clamp/overflow "Show more" button `ws-modal-description-more` and a `syncDescriptionOverflow()` function — see `src/public/app.ts` around lines 979–1151).

The `description` field is being retired from the FlowCharge schema elsewhere (in the FlowCharge Core skill files, not this repo) because it was found to be a redundant, length-capped restatement of the workstream's own Markdown body — every fact in `description` already exists in the body, so `description` added a second, smaller copy of the same information rather than new information.

Change the modal to render the workstream's Markdown **body** (the content below the frontmatter in `workstream.md`) in the exact place the `description` field is shown today, using the exact same UI mechanics already built for it: the same "Show more" button behaviour, and the same clamp threshold (same count of blocks or lines before the button appears). Only the data source changes, from the `description` frontmatter field to the workstream body content.

## Constraints

- No new UI behaviour, no restyling, and no distinguishing a "lede" line from the rest — this is a straight source swap onto the existing show-more mechanism.

## Out of scope

- Removing the `description` field from the FlowCharge schema, CONVENTIONS.md, the generator script, or any skill prompt templates. That is separate work, tracked elsewhere, and does not touch this dashboard repo.
- Editing any existing workstream record that carries a `description` field. Those records are left as-is.

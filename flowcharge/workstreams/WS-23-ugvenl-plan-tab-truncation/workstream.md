---
id: WS-23-ugvenl
type: workstream
workstream: WS-23-ugvenl
slug: plan-tab-truncation
title: "Long plans load in full on the workstream details modal's Plan tab"
status: done
created: 2026-08-09
updated: 2026-08-09
depends_on: []
links: []
tags: [detail-modal, plan, ux]
---
The workstream details modal's Plan tab loads a full plan body at once; long plans should load truncated with a way to read the rest.
Follow-up to WS-21 (`plan-artefact-not-readable`), which made the Plan tab readable. The user observed that some plans are long, and loading the whole plan into the modal at once may not be useful. Wants an initial truncated view, with a button or link the user can click to load and read the rest.
Decision made in discussion: truncate by block count (for example, the first 8 rendered blocks — headings, paragraphs, lists), not by raw character count, because block-count truncation keeps each block whole and avoids a broken-looking cut mid-block.
Known from prior investigation: the full plan body already crosses the wire in one piece when the modal opens (`src/lib/detail.ts`, `extractWorkstreamDetail`), with no size limit and no caching. `src/public/app.ts`'s `renderPlanBlocks` already turns the plan text into DOM blocks one at a time, in file order, so a "Show more" step can likely be added to the existing client-side render without any server change or extra network call. This is the working assumption for investigation, not a fixed constraint — the investigate stage should confirm or correct it.

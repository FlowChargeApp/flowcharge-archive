---
id: WS-20-73eu0l
type: workstream
workstream: WS-20-73eu0l
slug: detail-modal-artefact-order-by-id
title: "Detail modal orders artefact sections by filename, not artefact ID"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: []
links: []
tags: [detail-modal, ordering, bug]
---
The detail modal orders a workstream's artefact sections by filename, not by the artefact ID in each section header, so IL-85 can appear before IL-84. Order them by artefact ID instead.
The fix belongs in `extractWorkstreamDetail()` (src/lib/detail.ts), on the Issues tab and the Tasks tab. Compare the numeric part of the ID numerically so IL-9 sorts before IL-85, and keep the explicit `.sort()` on the directory walk, because that is what makes the walk deterministic across platforms.

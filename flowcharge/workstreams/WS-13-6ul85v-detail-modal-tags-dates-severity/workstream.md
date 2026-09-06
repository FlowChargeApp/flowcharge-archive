---
id: WS-13-6ul85v
type: workstream
workstream: WS-13-6ul85v
slug: detail-modal-tags-dates-severity
title: "Workstream detail modal: tags, dates, severity"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: [WS-5-kxteoh, WS-9-8d98ve]
links: []
tags: [feature, ui]
---

Enhance the workstream detail modal (`#ws-modal`, populated by `openModal()`/`renderDetail()` in src/public/app.ts) to show the same picture of a workstream that its board card already does: tags, created date, updated date, and a severity indicator using the established SEV_ORDER/SEV_LABEL vocabulary and `--sev-*` CSS custom properties from WS-9/WS-11. Currently the modal's header only shows ID, title and status, and its body only has Issues/Tasks tabs; exact placement (header vs. new section, icons vs. text) is undecided and belongs in this workstream's own plan.

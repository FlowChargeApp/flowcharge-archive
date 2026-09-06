---
id: WS-53-ah1p06
type: workstream
workstream: WS-53-ah1p06
slug: blocked-field-badge
title: "Replace the Blocked board column with a blocked-field badge on cards and the detail modal"
status: done
tags: [board, board-card, detail-modal, extraction, feature]
created: 2026-08-21
updated: 2026-08-21
author: Anthony Koukoullis
depends_on: []
links: []
---

Upstream Praxis removed `blocked` as a workstream status value, replacing it with a separate frontmatter flag. This dashboard still hardcodes `blocked` as a sixth status/column and needs to match.

Grounded in the upstream Praxis repo (/Users/akoukoullis/Work/AK/Praxis), workstream WS-48-nxb8ls ("Fix workstream in-progress timing and replace blocked with a frontmatter flag", status done). Its plan (PLN-36-corraz) defines the new schema: the workstream status enum is now five values only (`backlog | ready | in-progress | done | dropped`) — `blocked` is gone from it entirely, and Praxis's own generator now rejects `status: blocked` outright. In its place, workstream records get an optional `blocked` frontmatter key: a single-line double-quoted scalar carrying the reason (never a boolean — presence means blocked, absence means not), written immediately after `description` when present or after `title` when not, always before `status`. A workstream can be blocked at any status (backlog, ready, or in-progress). Upstream Praxis's own Obsidian-plugin board renders it as a `**Blocked:** <reason>` line on the card body, and appends ` (blocked)` to the status cell in its index table and `--list` output — this dashboard should make its own placement choices for its own UI, not copy those verbatim.

This dashboard currently hardcodes the old model: grep confirmed `STATUS_ORDER` and `STATUS_LABEL` in src/public/app.ts both list `blocked` as a status value sitting between `in-progress` and `done`, meaning the board renders (or expects) a full "Blocked" column — the README's own description of the board (six columns: Backlog · Ready · In Progress · Blocked · Done · Dropped) is now stale against upstream Praxis. This needs three changes:

1. Remove `blocked` from `STATUS_ORDER`/`STATUS_LABEL` and drop the Blocked column entirely, so the board has five working columns (plus the existing hidden Archive column) matching upstream Praxis's own board shape.
2. Read the new `blocked` frontmatter key (src/lib/extract.ts does not read it today) and carry it through to both the board-card data and the detail-modal data.
3. Render it: on the card, as a small red pill badge reading "Blocked", on its own row directly under the WS-ID/date row and above the card title — this exact visual choice was confirmed with the user in this session, picked over a plain red text label and a red-dot-plus-text option, specifically to avoid visual confusion with the existing severity dot that already sits next to the ID. The full reason text shows as a tooltip on hover over the badge. On the detail modal, show the reason in full, unambiguously labelled, wherever it best fits the modal's existing layout — not fixed to a specific spot by this brief, left as an implementation judgment call informed by the modal's current structure.

A workstream carrying no `blocked` key renders exactly as today, with no badge and no extra modal content — this must hold for essentially the entire existing corpus, since no workstream anywhere yet uses the new field.

Next steps for this workstream: investigate the codebase to determine the best way to implement this, write up a plan from the findings, then author spec tasks. Execution and commit were not requested yet.

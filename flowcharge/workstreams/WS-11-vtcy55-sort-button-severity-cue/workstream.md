---
id: WS-11-vtcy55
type: workstream
workstream: WS-11-vtcy55
slug: sort-button-severity-cue
title: "Sort button severity cue"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: [WS-9-8d98ve]
links: []
tags: [feature, ui]
---

Colour the "Severity" sort button (`#sort-key-seg` in src/public/board.html/src/public/app.ts) by the board's single worst open severity project-wide, as a quick board-wide temperature check in the controls bar — a follow-up WS-9 deferred if its per-card severity dot alone proves hard to eyeball. The "worst severity present" aggregate already exists inside `renderSeverity()` (src/public/app.ts): it builds a `counts` object over all open issues walked in `SEV_ORDER` (worst-to-least), so this is the first tier with `counts[s] > 0` — relocate/expose that computation rather than writing a new one, and reuse `SEV_ORDER`/`SEV_LABEL` and the `--sev-*` CSS custom properties, same as WS-9.

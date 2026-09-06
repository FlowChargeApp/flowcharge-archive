---
id: WS-9-8d98ve
type: workstream
workstream: WS-9-8d98ve
slug: board-severity-cue
title: "Board severity cue"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: [WS-8-nlelsj]
links: []
tags: [feature, ui]
---

Give the severity sort ranking (WS-8) a visual cue so it's easy to eyeball, not just inferable from card position — a colour on the "Severity" sort button, or a per-card chip/dot showing each workstream's dominant open severity; which (or another option) is undecided and belongs in this workstream's own plan. Reuse `SEV_ORDER`/`SEV_LABEL` (src/public/app.ts) and the `--sev-critical`/`--sev-high`/`--sev-medium`/`--sev-low` CSS custom properties (src/public/styles.css) — the project's existing severity vocabulary and colour source of truth — rather than a second scheme.

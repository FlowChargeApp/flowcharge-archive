---
id: IL-11-kv7vyc
type: issuelist
workstream: WS-73-4zgcm7
slug: dropped-status-indicator
title: "Dropped status indicator findings"
status: done
created: 2026-08-28
updated: 2026-08-28
depends_on: []
links: []
---

# PRX Issue List

- [x] ISS-22-049ixu. Dropped task/issue list is invisible on a board card when nothing is done

  ```yaml
  id: ISS-22-049ixu
  status: done
  severity: medium
  author: Anthony Koukoullis
  description: "The board card marks a dropped task list or issue list by recolouring its progress-bar segment to var(--st-dropped). The segment width comes from pct = a.total ? Math.round(100 * a.done / a.total) : 0. When no item is checked, pct is 0, so the colour is applied to a segment with zero width and nothing is drawn. This artefact-row branch prints no status text, unlike the plan branch beside it, which prints a coloured dot plus the literal status word. The dropped state is therefore lost on screen exactly when the artefact was dropped before any work started, which is the normal case for a dropped artefact."
  steps_to_reproduce:
    - "Open a board for a project that holds a task list with status: dropped and no checked task, for example TL-72-js2jg5 under workstream WS-70-hvf4cd."
    - "Find the card for that workstream in the board column."
    - "Look at the artefact row for the dropped task list."
    - "Compare it with the row of an ordinary task list that shows 0/N and is not dropped."
  expected: "The row shows the dropped state, in the same way the plan row shows its status text next to a coloured dot."
  actual: "The row is identical to a task list at 0/N that has not started. The --st-dropped colour is applied to a zero-width segment, so no colour is visible and no text names the state."
  affected: "src/public/app.ts — the artefact-row loop inside buildCard (approximately lines 279-305), specifically the issuelist/tasklist branch at lines 288-295"
  environment: "Browser board view, src/public/app.ts compiled to dist/public/app.js"
  tasks: [TL-75-23opfs.2.1, TL-75-23opfs.2.2]
  notes: "The plan branch (lines 296-301) already renders a dot plus status text and is the working comparison case in the same loop. The --st-* palette in src/public/styles.css is already read by this card, at line 292 and at line 298. The STATUS_LABEL map at src/public/app.ts line 15 also already exists, but no card code reads it today — its readers are the column head at line 438 and the KPI strip at lines 1261 and 1268 — so a card-side fix that needs the word 'Dropped' can take it from that existing map without adding new label text."
  ```

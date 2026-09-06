---
id: WS-73-4zgcm7
type: workstream
workstream: WS-73-4zgcm7
slug: dropped-status-indicator
title: "Dropped status has no consistent indicator across artefact types or in the detail modal"
description: "Investigation found the dropped status is shown inconsistently across artefact types on the board card, and is not shown at all inside the card detail modal for any artefact type or individual issue/task."
status: done
tags: [bug, detail-modal, board-card, ui, ux]
created: 2026-08-28
updated: 2026-08-28
author: Anthony Koukoullis
depends_on: []
links: []
---
Investigation found the `dropped` status is shown inconsistently across artefact types on the board card, and is not shown at all inside the card detail modal, for any artefact type or individual issue/task.

## Origin

Noticed while closing WS-70-hvf4cd: its `PLN-59-pbg3pk` plan was marked `dropped` and showed a "dropped" label on the board card, but this prompted the question of whether task lists and issues get the same treatment. They do not, and the gap is worse than that once the actual modal rendering was checked.

## Findings from investigation (src/public/app.ts, src/types/praxis-data.d.ts, src/lib/detail.ts, src/public/styles.css)

**1. On the board card face (`buildCard`, app.ts ~L279-305), plans and task/issue lists are treated differently:**
- A plan artefact-row shows a colored dot plus the literal status text (e.g. "dropped") — `app.ts:296-300`.
- A task-list or issue-list artefact-row only recolors its progress-bar segment (`app.ts:292`, `seg.style.background = 'var(--st-dropped)'`) — no text label exists for this case. When a dropped list has zero checked items, that segment is 0% wide, so the color change is invisible; a dropped, never-started task list looks identical to an ordinary not-yet-started one.

**2. Inside the card detail modal, none of the three artefact types show a dropped indicator at all:**
- `buildSection` (`app.ts:621-628`), used by all three modal tabs (Plan/Issues/Tasks), reads only `artefact.id` and `artefact.title` — it never reads `artefact.status`, even though `PraxisDetailArtefact.status` (`src/types/praxis-data.d.ts:67-73`) is fetched and available in the payload.
- A dropped plan, issue list, or task list gets an identical section header to an active one — no label, no color, no dimming.

**3. Individual issues and tasks have no `status` concept in their modal data model at all:**
- `PraxisIssueDetail` / `PraxisTaskDetail` (`praxis-data.d.ts:75-88`) carry only a `checked: boolean`, no `status` field.
- `buildItem` (`app.ts:631-640`) and `buildTaskGroup` (`app.ts:852-882`) render purely off `checked` — a dropped-but-unchecked issue or task is visually indistinguishable from an ordinary open one, both in the summary row and (unless a custom YAML field happens to be present, rendered generically with no special styling via `renderMap`) anywhere else in the modal.
- `.ws-check.is-checked` (`styles.css:990`) is hard-coded to `--st-done` green regardless of the item's actual status — it fires purely off `checked`.

**4. No shared status-badge/dot component is reused across artefact types inside the modal.** The `--st-*` CSS custom-property palette (`styles.css` L60-72 light, L122-134 dark) and `STATUS_LABEL` (`app.ts:14-15`) exist and are used for the board card and the KPI strip, but nothing in the modal's rendering path consumes them per-artefact or per-item.

## Constraints

- Investigate the codebase to determine the best way to fix these gaps and implement a real dropped indicator — this is a design decision, not just a mechanical patch, since the fix should probably introduce some shared status-indicator treatment rather than four one-off patches.
- Scope is the dropped-status indicator gap only, as found above — no other visual or behavioral change to the modal, board card, or KPI strip.

---
id: WS-76-de6gt7
type: workstream
workstream: WS-76-de6gt7
slug: board-info-row-count-redundancy
title: "Remove duplicate workstream and issue counts from the board's info row"
status: done
tags: [board, counts, ui, feature]
created: 2026-08-29
updated: 2026-08-29
author: Anthony Koukoullis
depends_on: []
links: []
---
The board's info row repeats the workstream and issue counts already shown in the KPI tiles below it; remove those two counts from the info row.

The board screen has two heading areas — the main toolbar and a sub-toolbar (breadcrumb) — then a third row of summary info (generated date, workstream/issue counts, git branch, live status), then the KPI tiles. The workstream count and issue count in that third row are redundant with the KPI tiles beneath it. The rest of that row's information (generated date, branch, live status) should stay unchanged.

Scope: remove only the workstream-count and issue-count display from the info row. Do not change the KPI tiles or any other part of the info row.

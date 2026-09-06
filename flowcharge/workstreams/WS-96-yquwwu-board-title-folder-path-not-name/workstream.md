---
id: WS-96-yquwwu
type: workstream
workstream: WS-96-yquwwu
slug: board-title-folder-path-not-name
title: "Board title shows the project's folder path instead of its registry name"
status: done
tags: [board, bug, ui]
created: 2026-09-06
updated: 2026-09-06
author: Anthony Koukoullis
depends_on: []
links: []
---

The board's breadcrumb title reads the project's filesystem folder path, not the name the
project registry (`.praxis-projects.json`) actually stores for it.

Found while renaming a demo project's registry `name` field from "Praxis-Demo" to "Northbeam"
to prep a screenshot for the public README. The Projects list page picked up the rename
correctly (`Northbeam` tile), but opening that project's board still showed "Praxis-Demo" in
the breadcrumb after the rename and after a server restart. Traced to
`src/public/app.ts:1249`: `byId('board-title').textContent = raw.source`, where `raw.source` is
the project's folder path (e.g. `/Users/akoukoullis/Work/AK/Praxis-Demo`) returned by
`GET /api/projects/:id/data`, not the registry's `name` field. The board never fetches or
reads that field at all.

---
id: IL-14-3tf64p
type: issuelist
workstream: WS-96-yquwwu
slug: board-title-folder-path-not-name
title: "Board breadcrumb title shows the folder name, not the registry name"
status: done
created: 2026-09-06
updated: 2026-09-06
depends_on: []
links: []
---

# FlowCharge Issue List

- [x] ISS-27-bysm0j. Board breadcrumb title reads the project folder name instead of the registry name

  ```yaml
  id: ISS-27-bysm0j
  status: done
  severity: medium
  author: Anthony Koukoullis
  description: "The board's breadcrumb title is derived from the project's filesystem folder path, not from the name the project registry stores. src/public/app.ts sets byId('board-title').textContent from raw.source.split('/').pop(), where raw.source is the project's absolute folder path returned by GET /api/projects/:id/data (src/server.ts). The project registry (.praxis-projects.json, read by src/lib/projects.ts) holds a separate, user-editable name field per project, and the Projects list page (src/public/home.ts) renders that field on each tile. The /api/projects/:id/data response the board consumes carries no name field, and the board never fetches the registry list to obtain one. Whenever a project's registry name differs from its folder name, the board shows the wrong name, and no board UI can correct it."
  steps_to_reproduce:
    - "Register a project whose folder is named Praxis-Demo, then open its board and note the breadcrumb reads 'Praxis-Demo'."
    - "Edit that project's name field in .praxis-projects.json from 'Praxis-Demo' to 'Northbeam'."
    - "Restart the server and open the Projects list page. The project's tile correctly reads 'Northbeam'."
    - "Click the tile to open that project's board and read the breadcrumb title."
  expected: "The board breadcrumb shows the project's registry name, the same name the Projects list tile shows — 'Northbeam'."
  actual: "The board breadcrumb shows the folder-derived name — 'Praxis-Demo' — because the title comes from the folder path in raw.source, not from the registry name field."
  affected: "src/public/app.ts (board title assignment from raw.source), src/server.ts (GET /api/projects/:id/data response, which carries no name field), src/lib/projects.ts (registry name field), src/public/home.ts (Projects list, which renders the registry name correctly)"
  environment: "Browser board page served by the local dev server; project registry .praxis-projects.json"
  tasks: [TL-97-2j5zyi task 1]
  notes: "Reproduced live against the running dev server, before and after the registry edit and a server restart. The finding quoted the line as `byId('board-title').textContent = raw.source;`; the live code at src/public/app.ts:1249 reads `raw.source ? raw.source.split('/').pop()! : 'Board'`, which is the same defect — the title is still folder-derived."
  ```

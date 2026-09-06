---
id: WS-22-hwt503
type: workstream
workstream: WS-22-hwt503
slug: project-tile-icon-buttons
title: "Rename and Delete on project tiles become icon buttons at the top right"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: [WS-19-jhikk2]
links: []
tags: [ui, home-page, icons]
---
The home page project tiles show Rename and Delete as text words in a `div.tile-actions` row below the tile link. Make them icon-only buttons and move them to the top right of the tile, always visible and never hover-only.
Use the Lucide `square-pen` icon for rename and `trash-2` for delete, pasted in as inline SVG in `src/public/home.ts` the same way the search icon is drawn in `src/public/board.html` (`viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`). No dependency, icon font, sprite, or CDN. Save and Cancel in the inline rename row stay as text. No change to the server, `/api/projects`, or the project registry, and no change to the board cards.

---
id: WS-29-ns8zxo
type: workstream
workstream: WS-29-ns8zxo
slug: project-tile-folder-modified-date
title: "Let a home-page project tile's folder path be edited, and show a modified date"
status: backlog
created: 2026-08-15
updated: 2026-08-18
depends_on: []
links: []
tags: [home-page, project-tile, ux]
---
The home page's project tiles currently let a user edit only the project's name. The underlying folder path cannot be edited — to point a project entry at a different path, the whole entry must be deleted and re-added. Wanted: let the folder path be edited in place, alongside the name, from the same edit control.

Each tile also shows an added date but no modified date. Wanted: a modified date, shown only once a modification has actually occurred (so a tile that has never been edited keeps showing only its added date, with no separate modified date creating clutter for the common case).

Both changes apply to the same project-tile edit UI on the home page. Reason given by the user: they are about to edit a project's path and do not want to delete and re-add the entry to do it.

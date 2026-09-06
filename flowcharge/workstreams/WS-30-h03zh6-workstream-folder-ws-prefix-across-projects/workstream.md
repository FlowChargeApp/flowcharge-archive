---
id: WS-30-h03zh6
type: workstream
workstream: WS-30-h03zh6
slug: workstream-folder-ws-prefix-across-projects
title: "Rename workstream folders to WS-N-<slug> across every other project on the dashboard"
status: done
created: 2026-08-15
updated: 2026-08-16
depends_on: []
links: []
tags: [maintenance, flowcharge, multi-project]
---
The `WS-N-<slug>` workstream-folder-naming convention (folder carries the WS-N prefix, e.g. `WS-2-adopt-ak-git-skill`, distinct from the frontmatter `slug:` key which stays unprefixed) was adopted and applied to the `Praxis` project itself via that project's own WS-16 (`workstream-folder-missing-ws-code`, task list TL-10). Its subtask 1.7 renamed that project's 14 existing bare-slug folders to match.

This workstream extends that same fix to every other project registered on this dashboard's home page (`.praxis-projects.json`), skipping `Praxis` itself since it already has the fix. A scan of all 8 registered projects found only two with bare-slug folders left to rename: `Praxis-Board` (this project, Praxis-Dashboard — 25 folders) and `DownloadAlbum` (14 folders, 2 of which have no `workstream.md` at all and need their WS-N read from `tasklist.md`'s frontmatter instead). `LAD`, `lad-poc`, `Praxis-Launch`, `Praxis-Website`, and `Praxis-Demo` are already fully compliant.

Task 1 of this workstream's task list is subtask 1.7 from `Praxis`'s TL-10 (`/Users/akoukoullis/Work/AK/Praxis/flowcharge/workstreams/WS-16-workstream-folder-missing-ws-code/tasklist.md`), copied and generalised from a single-project rename into a multi-project one.

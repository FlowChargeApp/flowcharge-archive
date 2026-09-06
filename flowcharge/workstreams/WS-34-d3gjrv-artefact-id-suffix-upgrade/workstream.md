---
id: WS-34-d3gjrv
type: workstream
workstream: WS-34-d3gjrv
slug: artefact-id-suffix-upgrade
title: "Upgrade every artefact ID across all dashboard-registered projects to the TYPE-N-SUFFIX form"
status: done
created: 2026-08-16
updated: 2026-08-17
depends_on: []
links: []
tags: [maintenance, flowcharge, multi-project, ids]
---
Praxis IDs (`WS-N`, `PLN-N`, `IL-N`, `TL-N`, `ISS-N`) have been upgraded, in the shared `prx-orchestrate` skill tooling, to a new permanent shape: `TYPE-N-SUFFIX`, where `SUFFIX` is a random 6-character lowercase base-36 string drawn at claim time (confirmed directly against `~/.claude/skills/prx-orchestrate/scripts/prx-index.mjs`'s `allocateIds`/`randomSuffix` functions and `CONVENTIONS.md`'s IDs section — this is real and already live, not merely proposed). The suffix exists so that `N` alone no longer needs to be globally coordinated: two independently cloned `flowcharge/` trees can allocate the same `N` and never collide.

Every artefact created before this change — across every project registered on this dashboard's home page — still carries the old, suffix-less `TYPE-N` form. This workstream extends the fix already modelled by WS-30-workstream-folder-ws-prefix-across-projects (which added the `WS-N-` folder prefix across projects) to this new, larger requirement: every existing artefact's `id:` frontmatter, every cross-reference to that ID (`workstream:`, `depends_on:`, `links:`, `issues:`, and any literal prose mention), and every containing folder name must be upgraded to carry the new `-SUFFIX` segment, project by project, across all projects this dashboard tracks.

This is a bigger and riskier migration than the folder-prefix fix: it rewrites the IDs themselves, not just where they live on disk, so every reference graph (dependencies, issue-to-task links, workstream ownership) must be kept consistent throughout.

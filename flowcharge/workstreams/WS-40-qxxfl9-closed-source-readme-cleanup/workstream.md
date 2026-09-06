---
id: WS-40-qxxfl9
type: workstream
workstream: WS-40-qxxfl9
slug: closed-source-readme-cleanup
title: "Remove the self-host/open-source framing from README and add a closed-source notice"
status: done
created: 2026-08-17
updated: 2026-08-19
depends_on: []
links: []
tags: [documentation, licensing, closed-source, group1]
---
Remove the "clone this repo and self-host it" framing from README.md and add a closed-source notice, now that this repo will not be published.

This project (the Praxis Board dashboard, currently a Node/Bun HTTP server plus a plain-TypeScript browser frontend, described in README.md) is being turned into a closed-source, Electron-packaged desktop app for macOS, Linux, and Windows. It will no longer be published as a self-hosted, clone-and-run-yourself open-source project.

This item (closed-source and licensing cleanup) is small, administrative, and has no technical dependency on the other four pivot items (Electron shell scaffold, bridging the Node backend to the frontend, native project-folder access, cross-platform packaging and distribution) — it is not chained to them and may be actioned at any time relative to them. (Revised 2026-08-18: the pivot switched from Tauri to Electron; this item's own deliverable, the README wording, never mentioned either platform by name, so nothing here needed to change beyond this background note.)

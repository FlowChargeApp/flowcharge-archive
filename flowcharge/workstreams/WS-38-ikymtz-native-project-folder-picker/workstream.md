---
id: WS-38-ikymtz
type: workstream
workstream: WS-38-ikymtz
slug: native-project-folder-picker
title: "Replace typed-path project registration with Electron's native folder-picker dialog"
status: done
created: 2026-08-17
updated: 2026-08-18
depends_on: [WS-45-kvkdgl]
links: []
tags: [electron, ui, filesystem, permissions, group1]
---
Replace the typed-path project-registration flow with Electron's native folder-picker dialog.

**Revised 2026-08-18: this workstream now targets Electron, not Tauri.** The user chose Electron over Tauri to minimize restructuring of a codebase they consider stable. Electron's `dialog.showOpenDialog` (main process, exposed to the renderer over the same IPC bridge WS-37 already builds) is the direct equivalent of Tauri's dialog plugin — same user-facing outcome, different API.

This project (the Praxis Board dashboard, currently a Node/Bun HTTP server plus a plain-TypeScript browser frontend, described in README.md) is being turned into a closed-source, Electron-packaged desktop app for macOS, Linux, and Windows. It will no longer be published as a self-hosted, clone-and-run-yourself open-source project.

Decision already made, do not re-litigate: the current Node backend's logic (src/server.ts, src/lib/*.ts) is not ported or rewritten — it runs inside Electron's main process, reachable from the frontend via IPC (WS-37). The end state is a single downloaded app with nothing else to install.

This item (native project-folder access) replaces the app's current typed/stored-path project registration (.praxis-projects.json) with Electron's native folder-picker dialog, so a user adds a project by picking its folder instead of typing a path.

Ordering: this workstream depends on WS-45-kvkdgl (keep the dashboard usable in a plain browser tab alongside the Electron app), inserted 2026-08-18 between this workstream and WS-37-zj17yn (bridge the Node backend to the frontend via Electron IPC) at the user's request, after WS-37 landed and broke plain-browser-tab usability. This workstream's own dependency was repointed from WS-37-zj17yn to WS-45-kvkdgl accordingly. Item 4 (cross-platform packaging and distribution) depends in turn on this workstream's own ID.

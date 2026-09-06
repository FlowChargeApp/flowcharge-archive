---
id: WS-37-zj17yn
type: workstream
workstream: WS-37-zj17yn
slug: absorb-node-backend-into-frontend
title: "Bridge the existing Node backend to the frontend via Electron IPC"
status: done
created: 2026-08-17
updated: 2026-08-18
depends_on: [WS-36-b3b2pw]
links: []
tags: [electron, server, filesystem, git, group1]
---
Wire the frontend to call server.ts's existing logic through Electron's IPC instead of HTTP, running that logic unchanged inside Electron's main process.

**Revised 2026-08-18: this workstream now targets Electron, not Tauri.** The user chose Electron over Tauri to minimize restructuring of a codebase they consider stable. This changes this workstream's whole shape, not just its target platform: the original Tauri version had to port every file-system and git call off Node entirely, since Tauri's frontend has no Node runtime. Electron ships its own Node.js runtime in its main process, so none of that porting is needed — server.ts's and src/lib/*.ts's logic keeps running as real Node code, completely unchanged. This workstream's job becomes wiring, not rewriting: expose that existing logic to the frontend over Electron's IPC (ipcMain/ipcRenderer, bridged through a preload script's contextBridge) in place of the current fetch()-based HTTP calls.

This project (the Praxis Board dashboard, currently a Node/Bun HTTP server plus a plain-TypeScript browser frontend, described in README.md) is being turned into a closed-source, Electron-packaged desktop app for macOS, Linux, and Windows. It will no longer be published as a self-hosted, clone-and-run-yourself open-source project.

Decision already made, do not re-litigate: the current Node backend's logic (src/server.ts, src/lib/*.ts) is not ported, rewritten, or ported to any other language — it runs inside Electron's main process exactly as it runs today, reachable from the frontend via IPC instead of HTTP. The end state is a single downloaded app with nothing else to install, and no user-visible separate server process.

This item is the core of the pivot: replace app.ts's/home.ts's fetch('/api/...') calls with IPC calls to the same underlying logic, running in Electron's main process.

Ordering: this workstream depends on WS-36-b3b2pw (Electron shell scaffold), per the pivot's required processing order — item 2 depends on item 1's own freshly claimed WS ID. Item 3 (native project-folder access) depends in turn on this workstream's own ID.

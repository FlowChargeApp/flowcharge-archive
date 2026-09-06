---
id: WS-36-b3b2pw
type: workstream
workstream: WS-36-b3b2pw
slug: tauri-shell-scaffold
title: "Wrap the existing frontend in a native Electron shell and prove cross-platform packaging"
status: done
created: 2026-08-17
updated: 2026-08-18
depends_on: []
links: []
tags: [electron, desktop, frontend, packaging, group1]
---
Wrap the existing browser frontend, unchanged, in a native Electron window and prove the app builds and runs on macOS, Linux, and Windows, before any backend logic is touched.

**Revised 2026-08-18: this workstream now targets Electron, not Tauri.** The user chose Electron over Tauri to minimize restructuring of a codebase they consider stable, at the cost of a larger shipped binary — a trade-off made explicitly, not overlooked. Electron ships its own Node.js runtime alongside its own Chromium window, so — unlike Tauri — the existing `src/server.ts`/`src/lib/*.ts` file-system and git logic never needs to be ported off Node at all; it can keep running as real Node code in Electron's main process, reachable from the frontend via Electron's own inter-process communication (IPC). A Tauri-packaged download option may still be built later, as a separate pass, once Electron ships.

This project (the Praxis Board dashboard, currently a Node/Bun HTTP server plus a plain-TypeScript browser frontend, described in README.md) is being turned into a closed-source, Electron-packaged desktop app for macOS, Linux, and Windows. It will no longer be published as a self-hosted, clone-and-run-yourself open-source project.

This is the first of five workstreams recorded for this pivot (a second, separate group covering a multi-environment agentic-tool skill installer is being recorded separately and is not part of this batch).

Decision already made, do not re-litigate: the current Node/Bun backend (src/server.ts) will not ship as a separate, user-visible server binary. Instead, it runs inside Electron's own main process, reachable from the frontend via IPC once the dependent workstream (item 2) wires that bridge. The end state is a single downloaded app with nothing else to install.

This item (Electron shell scaffold) is the foundation for that pivot: get the existing frontend loading, unmodified, inside a native Electron window, and prove the app builds and runs on all three target platforms before any backend logic is touched.

Ordering: this workstream has no dependency and is claimed first in the pivot's required sequence. Item 2 (absorb the Node backend into the frontend) depends on this workstream's own ID, per the pivot's required processing order (items 1 through 4 strictly in sequence, each citing the previous item's freshly claimed WS ID in its own depends_on).

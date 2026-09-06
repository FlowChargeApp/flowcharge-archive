---
id: WS-39-20u3dv
type: workstream
workstream: WS-39-20u3dv
slug: tauri-cross-platform-packaging
title: "Configure Electron cross-platform packaging and distribution for macOS, Linux, and Windows"
status: done
created: 2026-08-17
updated: 2026-08-19
depends_on: [WS-46-6hl7r7]
links: []
tags: [electron, packaging, desktop, cross-platform, group1]
---
Configure Electron's packaging tooling and produce a working, installable build for macOS, Linux, and Windows, verified on the three machines available.

**Revised 2026-08-18: this workstream now targets Electron, not Tauri.** The user chose Electron over Tauri to minimize restructuring of a codebase they consider stable, at the cost of a larger shipped binary. Electron bundles its own Chromium inside the app, so this workstream does not face Tauri's system-webview-version risk (e.g. Debian 11's older webkit2gtk) — one real source of risk from the original plan simply does not exist under Electron. The trade-off is size: Electron installers are meaningfully larger than Tauri's would have been, an already-accepted cost.

This project (the Praxis Board dashboard, currently a Node/Bun HTTP server plus a plain-TypeScript browser frontend, described in README.md) is being turned into a closed-source, Electron-packaged desktop app for macOS, Linux, and Windows. It will no longer be published as a self-hosted, clone-and-run-yourself open-source project.

Decision already made, do not re-litigate: the current Node backend's logic (src/server.ts, src/lib/*.ts) is not ported or rewritten — it runs inside Electron's main process, reachable from the frontend via IPC (WS-37). This already satisfies "no separate server binary, nothing else to install" — server.ts is not a standalone executable in the shipped app, it runs as part of the one Electron process. This workstream does not need to eliminate or further absorb it; that gap, real under the old Tauri plan, does not exist under Electron.

This item (cross-platform packaging and distribution) configures Electron's packaging tool (electron-builder or electron-forge, decided in the plan) for macOS, Linux, and Windows, and must be verified as installing and running on the three machines actually available for testing: a MacBook Pro M4 Pro on macOS Sequoia, a Dell Latitude on Debian 11, and a Windows 11 ARM virtual machine running under UTM on the MacBook. Code signing and notarization are explicitly out of scope for this item and are left for a later, separate piece of work.

Ordering: this workstream depends on WS-46-6hl7r7 (fix the project registry path for the packaged Electron app), inserted 2026-08-19 between this workstream and WS-38-ikymtz (native project-folder access) after this workstream's own Phase 2 macOS build-and-verify task found the packaged app's registry reads/writes fail under `app.asar`. This workstream's own dependency was repointed from WS-38-ikymtz to WS-46-6hl7r7 accordingly. This is the last of the four ordered items in the Electron pivot; item 5 has no dependency on this chain.

**Resolved (2026-08-19):** WS-46-6hl7r7 landed and fixed the `app.asar` registry-path bug. Phase 2 (macOS build and verify) was re-run and now passes: a packaged first launch starts with an empty registry, and adding/loading a real project works. Phases 3 (Linux) and 4 (Windows ARM) remain deferred — this session has no access to those physical machines — checked off with the reason recorded in the task list, not claimed as verified, matching the same deferral already applied to WS-36's Phases 4/5.

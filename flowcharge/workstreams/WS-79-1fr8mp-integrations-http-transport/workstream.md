---
id: WS-79-1fr8mp
type: workstream
workstream: WS-79-1fr8mp
slug: integrations-http-transport
title: "Give the Manage integrations feature an HTTP transport for the web build"
description: "The Manage integrations modal opens empty in the plain web build (npm start, src/server.ts on http://localhost:4173) because src/public/home.ts calls window.praxisSkillInstallAPI, which only electron/preload.cts defines. src/server.ts exposes no route for the feature and src/public/browser-ipc-shim.ts never implements that API surface, so the call throws an uncaught TypeError before home.ts's own catch runs. Every library the Electron IPC handler calls is portable Node, so the fix is HTTP routes in src/server.ts over the same src/lib/agentic-tools-*.ts functions, matching fetch() methods in the shim, and an existence check in the frontend."
status: done
tags: [agentic-tools, server, electron, frontend, compatibility, cross-platform]
created: 2026-08-30
updated: 2026-08-30
author: Anthony Koukoullis
depends_on: []
links: []
---

The "Manage integrations" modal opens empty in the plain web build because its frontend calls an Electron-only API; give the feature HTTP routes and a browser shim so it works outside Electron too.

## The defect

The "Manage integrations" modal on the Praxis-Dashboard home page is broken when the app runs as a plain web app (Node HTTP server via `npm start` / `src/server.ts`, on http://localhost:4173) — the modal opens but every panel is empty, because of an uncaught JS exception. It works correctly only in the Electron desktop build.

## Root cause

The integration-detection frontend code in `src/public/home.ts` (`loadIntegrationsDetection()`, `installIntegrationsSelected()`, and the "Manage integrations" and rescan click handlers) calls `window.praxisSkillInstallAPI.detectTools()`, `.checkInstalledSkills()`, `.installSelected()`, etc. `window.praxisSkillInstallAPI` is defined ONLY in `electron/preload.cts` (via `contextBridge.exposeInMainWorld`), backed by `ipcMain.handle` channels registered in `electron/agentic-tools-ipc-handlers.cts`. In a plain browser tab served by `src/server.ts`, `window.praxisSkillInstallAPI` is simply `undefined` — the frontend never checks for its existence before calling it, so `home.ts` throws an uncaught `TypeError` before its own `.catch()` handler ever runs, leaving the modal empty with no user-visible error.

`src/server.ts` has no HTTP route at all for this feature (no `/api/detect-tools`, `/api/install-selected`, `/api/check-installed-skills`, `/api/install-status`, or similar — confirmed by grep, only `/api/projects`, `/api/projects/:id`, `/api/projects/:id/data`, `/api/projects/:id/workstreams/:wsId/detail` and `/api/version` exist). `src/public/browser-ipc-shim.ts`, which already provides an HTTP-backed fallback for the original 6-method `window.praxisAPI` surface when running outside Electron, never implements `window.praxisSkillInstallAPI` at all. `electron/agentic-tools-ipc-handlers.cts`'s own header comment states this is deliberate: "this engine has no HTTP route of its own to relay to" — unlike the rest of the app's IPC surface, which does proxy over HTTP for the web build.

## Why this is fully fixable, not a platform limitation

Confirmed by reading the actual library code: every function `electron/agentic-tools-ipc-handlers.cts` calls into — `detectAllTools` (`src/lib/agentic-tools-detect.ts`), `installToTarget` / `removeInstallation` (`src/lib/agentic-tools-install.ts`), `checkSkillPresence` (`src/lib/agentic-tools-skill-presence.ts`), `createNodeFsAccess` / `createNodeFsWriteAccess` (`src/lib/agentic-tools-fs-adapter.ts`), `parseInstallRegistry` / `findInstallRecord` (`src/lib/agentic-tools-install-tracking.ts`), plus `TOOL_CATALOGUE` and `CANONICAL_PRAXIS_SKILL_IDS` — uses ONLY plain Node builtins (`node:fs/promises`, `node:path`, `node:os`, `node:crypto`). None of it imports `electron` or touches any Electron-only API (`app.getPath`, `dialog`, `BrowserWindow`, etc.). The only Electron-specific code in the whole call graph is the `ipcMain.handle(...)` wiring itself in `electron/agentic-tools-ipc-handlers.cts`. A Node HTTP server has the exact same filesystem access as Electron's main process (both are plain Node) — there is no technical barrier.

This matters immediately: there's a plan, not yet built, to package this app as a plain Node-server CLI binary for Windows/Mac/Linux (no Electron) — that binary would ship with this same integrations feature completely non-functional unless this gap is closed first.

## What the fix looks like

Add HTTP routes to `src/server.ts` that call the same portable `src/lib/agentic-tools-*.ts` functions the Electron IPC handler already calls (no new business logic — same functions, new transport). Add matching `fetch()`-based methods to `src/public/browser-ipc-shim.ts` for `window.praxisSkillInstallAPI`, mirroring exactly how the shim already covers the original 6-method `window.praxisAPI` surface for Electron/browser parity. Also fix the frontend's missing existence check so a genuinely unavailable API fails gracefully instead of throwing — though once the HTTP routes exist, `window.praxisSkillInstallAPI` should always exist in both Electron and browser contexts, the way `window.praxisAPI` already does.

No second SDK, no duplicated logic — one shared library, two thin transport wrappers (IPC and HTTP), following the pattern already established for the rest of the app's Electron/browser parity.

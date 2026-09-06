---
id: WS-45-kvkdgl
type: workstream
workstream: WS-45-kvkdgl
slug: browser-tab-fallback
title: "Keep the dashboard usable in a plain browser tab alongside the Electron app"
status: done
tags: [electron, frontend, compatibility, group1]
created: 2026-08-18
updated: 2026-08-18
author: Anthony Koukoullis
depends_on: [WS-37-zj17yn]
links: []
---
Restore the ability to run the plain browser-based version of the dashboard side by side with the Electron app, for easy manual testing, without touching anything outside Praxis's own IPC-bridge work.

The user's original requirement (stated when this pivot still targeted Tauri, and never withdrawn when the pivot moved to Electron): both the original web app (server.ts served over plain HTTP, opened in an ordinary browser tab) and the compiled Electron app must be runnable at the same time, so the browser tab stays available for quick manual testing.

WS-37 (Bridge the existing Node backend to the frontend via Electron IPC) replaced `home.ts`'s and `app.ts`'s `fetch('/api/...')` calls with direct calls to `window.praxisAPI.*`, a global that only exists inside Electron's preload-injected context. In a plain browser tab, `window.praxisAPI` is `undefined`, so `loadProjects()` throws immediately and the project list never renders — confirmed by the user running the server and loading it in a browser after WS-37 landed. WS-37's own plan recorded this as an accepted trade-off ("pages stop being independently usable in a plain browser tab; only the raw `/api/*` routes stay reachable"), but that directly contradicts the user's actual, standing requirement — this is a real gap to close, not a documented non-issue.

Likely direction (to be confirmed by this workstream's own investigation, not assumed here): have `home.ts`/`app.ts` feature-detect `window.praxisAPI` at each of the seven call sites WS-37 migrated, and fall back to the original `fetch('/api/...')` path when it is undefined (plain browser tab), using `window.praxisAPI` when present (Electron). `src/server.ts`'s HTTP `/api/*` routes are untouched by WS-37 and still serve real data, so the fallback has a working target to call.

Ordering: this workstream sits between WS-37-zj17yn (already done) and WS-38-ikymtz (native project-folder access) in the Electron pivot's sequence, inserted at the user's explicit request after WS-37 landed and the browser-tab regression was found. WS-38-ikymtz's `depends_on` has been repointed from WS-37-zj17yn to this workstream's own ID.

---
id: WS-46-6hl7r7
type: workstream
workstream: WS-46-6hl7r7
slug: packaged-app-registry-path
title: "Fix the project registry path for the packaged (asar-bundled) Electron app"
status: done
tags: [electron, packaging, bug, filesystem, group1]
created: 2026-08-19
updated: 2026-08-19
author: Anthony Koukoullis
depends_on: [WS-38-ikymtz]
links: []
---
Fix the project registry's path computation so it resolves to a real, writable location once the app is packaged into an Electron `app.asar` archive, instead of resolving inside the read-only archive itself.

Found during WS-39's own Phase 2 macOS build-and-verify task: `npm run package:mac` built and launched cleanly, but opening/adding/removing a project all failed. Root cause, traced to `src/lib/projects.ts`: `repoRoot` is computed as `path.join(__dirname, '..', '..')`, relative to the compiled module's own location. In dev (`npm start` or `npm run electron:dev`), that lands correctly at the repo root. Once electron-builder packs `dist/` into `app.asar`, the same computation resolves inside that read-only archive instead — on first launch this created a bogus phantom project pointing at the app bundle itself, and every real add/remove/rename failed with "Could not write the project registry."

Confirmed unaffected: the plain browser tab (`npm start`) and the unpackaged Electron dev app (`npm run electron:dev`) both run straight from `dist/` on real disk, with no `app.asar` involved — neither was broken by this, and neither needs any change from this fix. Only the packaged (`.dmg`/`.deb`/`.exe`) build is affected.

Likely direction (to be confirmed by this workstream's own investigation, not assumed here): resolve the registry path via Electron's `app.getPath('userData')` when running inside a packaged Electron main process, falling back to today's `__dirname`-relative computation everywhere else (dev Electron, and the plain Node/Bun server which has no Electron `app` module available at all).

Ordering: inserted into the Electron pivot's sequence between WS-38-ikymtz (native project-folder access, done) and WS-39-20u3dv (cross-platform packaging, in-progress — its own Phase 2 macOS verify is blocked on this fix landing first). WS-39-20u3dv's `depends_on` has been repointed from WS-38-ikymtz to this workstream's own ID.

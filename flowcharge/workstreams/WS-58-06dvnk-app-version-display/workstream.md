---
id: WS-58-06dvnk
type: workstream
workstream: WS-58-06dvnk
slug: app-version-display
title: "Expose the app's own version number in the UI"
description: "Read the running Electron app's own version at runtime and show it to the user (About/Settings area), as the foundation for a later update-check feature."
status: done
tags: [packaging, electron, ui, feature]
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: []
links: []
---

The packaged Electron app must know its own version number at runtime, as the foundation for a later update-check-and-notify feature.

This came out of a consultation on distributing Praxis Board (closed-source, packaged Electron app) and how it should learn about and announce newer versions. The recommendation was: read the version via Electron's `app.getVersion()` in the main process (not by reading `package.json` at runtime, since the asar bundle changes that path), and expose it to the renderer over the existing preload/IPC bridge so it can be shown in an About or Settings area. `package.json`'s `version` field (currently `1.0.0`) stays the single source of truth; electron-builder copies it into the packaged bundle.

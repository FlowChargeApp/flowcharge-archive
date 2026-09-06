---
id: WS-94-ked1ye
type: workstream
workstream: WS-94-ked1ye
slug: code-signing-notarization-deferral
title: "Park Electron code signing and notarization behind the D-26 deferral"
status: ready
tags: [electron, packaging, security, desktop]
created: 2026-09-04
updated: 2026-09-04
author: Anthony Koukoullis
depends_on: [WS-92-t964y8]
links: []
---

macOS notarization and Windows code signing are deliberately not started, per D-26's deferral — this record exists so the requirement is not lost.

Decision D-26 defers this work with no set trigger: "no specific trigger... reconsider once the app has gathered enough traction to justify it." The parked work is Apple Developer Program enrollment, a Windows signing certificate, and wiring both into electron-builder's existing `hardenedRuntime` and `notarize` configuration already present in `package.json`.

electron-builder's `mac`, `linux` and `win` build config already exists in `package.json` and works structurally. What is missing is the signing credentials, which are not provisioned.

Start no work from this record. It is a placeholder only. `depends_on: [WS-92-t964y8]` places it sixth and last in the recommended six-workstream execution chain (WS-93 → WS-89 → WS-90 → WS-91 → WS-92 → WS-94) — an ordering marker only, not a signal to begin.

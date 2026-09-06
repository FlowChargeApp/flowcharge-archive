---
id: WS-42-7fm9ak
type: workstream
workstream: WS-42-7fm9ak
slug: skill-install-sync-engine
title: "Install and sync the Praxis skill integration into detected agentic tools"
status: done
created: 2026-08-17
updated: 2026-08-19
depends_on: [WS-36-b3b2pw, WS-41-3783cz]
links: []
tags: [feature, electron, filesystem, agentic-tools, group2]
---
Write or update the Praxis integration at a detected agentic-tool target, in its own format when a plain copy will not do, and track what was installed so it can later be updated or removed.

**Revised 2026-08-18: scope narrowed to four tools, per WS-41's own revision.** Antigravity, Cline, Roo, and Kilo are dropped from this feature's v1 entirely, including Kilo's `kilo.jsonc` merge logic and Roo's global-scope exclusion handling. Only Claude Code, OpenCode, Cursor, and Windsurf remain in scope.

This is the write side of the three-item batch: given a detected target and its known format from the detection workstream (WS-41-3783cz), write or update the Praxis integration there — in that target's native format where a plain copy will not do — and track what was installed so a later run can update or remove it.

**Revised 2026-08-18: this workstream now targets Electron, not Tauri, and its dependency changed.** Under Electron, this engine's pure logic runs in Electron's main process, where Node's `fs` and `crypto` are directly available — no filesystem permission/capability system is needed at all, unlike the discarded Tauri design. `depends_on` changed from `[WS-41-3783cz, WS-37-zj17yn]` to `[WS-36-b3b2pw, WS-41-3783cz]`: WS-37 no longer does any filesystem work under its own Electron revision (it only bridges six pre-existing project-registry routes over IPC), so this workstream no longer depends on it. This workstream's real foundation is WS-36 (the Electron main-process scaffold, where new IPC channels are registered) and WS-41 (the detection catalogue).

Ordering: this batch's items are processed strictly in the order listed. This is the second item; WS-43-4cpdch (onboarding and manage-installations screen) depends on this item's own ID in turn.

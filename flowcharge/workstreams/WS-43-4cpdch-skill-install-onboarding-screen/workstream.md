---
id: WS-43-4cpdch
type: workstream
workstream: WS-43-4cpdch
slug: skill-install-onboarding-screen
title: "Add an onboarding and manage-installations screen for agentic-tool skill integrations"
status: done
created: 2026-08-17
updated: 2026-08-19
depends_on: [WS-42-7fm9ak]
links: []
tags: [feature, ui, agentic-tools, group2]
---
One reusable screen that runs detection and install, lets the user pick detected agentic-tool targets, and shows install status per target.

**Revised 2026-08-18: scope narrowed to four tools, per WS-41's and WS-42's own revisions.** Antigravity, Cline, Roo, and Kilo are dropped from this feature's v1 entirely. Only Claude Code, OpenCode, Cursor, and Windsurf remain in scope — all four have a global install path, so the Roo-unsupported-for-global row state no longer applies, and the Cline write-path contract gap is moot (Cline is out of scope).

This is the UI side of the three-item batch: one reusable screen, built once, that runs the detection workstream's (WS-41-3783cz) detection and the install-and-sync engine's (WS-42-7fm9ak) install logic, lets the user pick which detected targets to install into, and shows install status per target. It must be reachable both as a first-run onboarding wizard and from settings at any later time — not a first-run-only flow.

**Revised 2026-08-18: this workstream now targets Electron, not Tauri.** WS-41 and WS-42 both now run their pure logic in Electron's main process, reached from this screen over IPC. The browser-safe duplicate copies this workstream originally needed to build (to call WS-42's Node-`crypto`-based logic directly from the frontend under Tauri) are no longer needed at all under Electron — this screen calls both engines through IPC instead.

Ordering: this batch's items are processed strictly in the order listed. This is the third and final item; its depends_on cites WS-42-7fm9ak, the second item's own freshly claimed ID.

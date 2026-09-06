---
id: WS-41-3783cz
type: workstream
workstream: WS-41-3783cz
slug: detect-agentic-tool-config-locations
title: "Detect config storage locations and formats for agentic coding tools"
status: done
created: 2026-08-17
updated: 2026-08-19
depends_on: []
links: []
tags: [feature, cross-platform, filesystem, agentic-tools, group2]
---
Detect where each target agentic coding tool stores its configuration on macOS, Linux, and Windows, and what file format it expects for an added skill or integration.

For each target coding tool — Claude Code, OpenCode, Cursor, and Windsurf — determine where it stores its configuration on macOS, Linux, and Windows, and what file format it expects for an added skill or integration.

**Revised 2026-08-18: scope narrowed to four tools.** Antigravity, Cline, Roo, and Kilo are dropped from this feature's v1. The user chose the four most popular general-purpose tools instead; the three VS Code-plugin tools (Cline, Roo, Kilo) are paused for a later version, and Antigravity was never among the "most popular" set either.

This is the first of a three-item batch. Once this project (the Praxis Board dashboard) is turned into a closed-source, Tauri-packaged desktop app for macOS, Linux, and Windows, giving it real file-system access, it should be able to install the Praxis skill files into the config folder of whichever agentic coding tool the user has on their machine, from inside the app itself. That separate desktop pivot is already recorded as workstreams WS-36-b3b2pw through WS-40-qxxfl9.

Target tools named so far, not exhaustive: Claude Code, OpenCode, Antigravity, Cline, Roo, Kilo, Cursor, Windsurf. More may be added later. Each stores its configuration differently, and not every tool has a "skill" concept at all — Claude Code has a skills format; Cursor and Windsurf use rules files or MCP instead; Cline, Roo, and Kilo are VS Code extensions with their own storage. For several of these targets, "installing the Praxis skill files" will mean writing a converted, tool-native format, not copying the same files verbatim everywhere.

This item is investigation-heavy: most of these tools' config locations and formats are not consistently documented, and several differ by OS. It should start as an investigate stage, not go straight to a plan, because the findings decide what the install-and-sync engine workstream (WS-42-7fm9ak) can actually build.

Ordering: this batch's items are processed strictly in the order listed. This item is first; WS-42-7fm9ak (install and sync engine) depends on this item's findings, and WS-43-4cpdch (onboarding and manage-installations screen) depends on WS-42-7fm9ak in turn.

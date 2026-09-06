---
id: WS-64-gdxh7m
type: workstream
workstream: WS-64-gdxh7m
slug: bytenode-electron-main
title: "Compile the Electron main process to V8 bytecode with bytenode"
description: "Compile dist/electron/*.cjs to .jsc with bytenode, the lowest-priority step of the source-hardening plan: high effort for coverage limited to glue code only (main process and IPC handlers, not the server or the renderer)."
status: dropped
tags: [hardening, electron, packaging, security, feature]
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: []
links: []
---

Compile dist/electron/*.cjs to .jsc with bytenode, using the Electron binary (not plain node) to produce the cache.

This came out of the same source-hardening consultation as WS-61/62/63 (11-step ordered plan). This workstream covers step 7, deliberately ranked last: the V8 bytecode cache is locked to the exact Electron/V8 version and CPU architecture, so it must be rebuilt for every packaging target and every Electron upgrade, and it only covers main.cts, ipc-handlers.cts, and agentic-tools-ipc-handlers.cts — glue code, not the HTTP server, the flowcharge/ parsing logic, or the renderer. The consultation was explicit that this is high effort for the least valuable code on the whole list, and that bytecode is a build trick (V8 must be forced to compile eagerly, and a dummy same-length source is shipped to satisfy V8's cache-validity check), not a stable file format.

Constraints already settled, do not re-derive: do NOT convert src/server.ts or src/lib/ from ESM to CommonJS to try to extend bytecode's reach there (damages good code to protect logic a person can already read from the HTTP responses regardless). Do NOT turn off `sandbox: true` to let bytecode reach preload.cts (a sandboxed preload has no `vm` module, so bytecode cannot work there — this would trade away a real security property for a speed bump). The .jsc files must be added to electron-builder's `files` list once produced.

**Dropped 2026-08-22.** Per this workstream's own plan (PLN-54-kcr1ok): investigation found 85% of the targeted code (`main.cts`, `agentic-tools-ipc-handlers.cts`) cannot be bytecode-compiled at all — both bridge to this project's ESM code via a dynamic `import()` construct that bytenode's `vm.Script` execution model cannot handle. The remaining 15% (`ipc-handlers.cts`) discloses nothing not already readable elsewhere in the app, for a permanent cost (first production dependency, a per-platform/per-arch compile matrix, an uncatchable crash failure mode on version mismatch). The finding was independently corroborated against bytenode's own documentation. No code was built; the plan and task list (TL-65-yjm7as) stand as the decision record.

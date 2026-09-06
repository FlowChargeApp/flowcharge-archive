---
id: WS-62-ytspyd
type: workstream
workstream: WS-62-ytspyd
slug: bundle-and-obfuscate-renderer
title: "Bundle and obfuscate the browser-facing renderer code"
description: "Convert src/public/ from classic shared-global scripts to real ES modules, bundle with esbuild, then layer javascript-obfuscator on top — the one step of the source-hardening plan that actually protects the code served to a browser tab, Electron or standalone."
status: done
tags: [hardening, electron, frontend, security, feature]
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: [WS-63-2ad774]
links: []
---

Convert src/public/ from classic shared-global scripts to real ES modules, bundle with esbuild, then layer javascript-obfuscator on top of the bundle.

This came out of the same source-hardening consultation as WS-61 (11-step ordered plan, framed as "raising the cost, not a security boundary"). This workstream covers steps 4-5, identified as "the true no-readable-source work" and the only steps of the whole plan that protect the renderer at all — bytecode compilation (steps 6-7) cannot reach renderer code, and this app's server sends the board/UI code as plain .js over HTTP to both Electron's BrowserWindow and a standalone browser tab.

Two facts already established by investigation, to ground the plan (do not re-derive):
- src/public/tsconfig.json currently sets `"module": "none"`, and app.ts, home.ts, ipc-adapter.ts, and browser-ipc-shim.ts share top-level names as globals across files — a minifier cannot safely rename top-level names in this shape today.
- The fix is real: switch `module` to `es2020`, add explicit `import`/`export` to those files (and lib/agentic-tools-scope.ts), then bundle two entry points with `esbuild --bundle --format=iife --minify`, updating the `<script>` tags in index.html and board.html accordingly. A bundle is one closed scope, so the minifier/obfuscator can safely rename every name, not only local ones.
- javascript-obfuscator settings must stay moderate: `stringArray: true`, `stringArrayEncoding: ['base64']`, `identifierNamesGenerator: 'mangled'`, `splitStrings: true`. Explicitly do NOT enable `controlFlowFlattening`, `selfDefending`, `debugProtection`, or `deadCodeInjection` — flattening costs real runtime, and the other two trap the app's own debugger/crash reporting for only hours of attacker delay. Never enable anything using `eval` — this app's CSP is `script-src 'self'` with no `unsafe-eval`, so such output would simply fail to run.

Estimated effort from the consultation: roughly half a day, because the global-sharing pattern must become explicit imports across several files.

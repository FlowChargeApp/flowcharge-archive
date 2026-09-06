---
id: WS-61-xq11uw
type: workstream
workstream: WS-61-xq11uw
slug: electron-packaging-quick-hardening
title: "Harden the packaged Electron app: fuses, devtools, source maps"
description: "Disable Node command-line escape hatches via Electron fuses, turn off devtools in production, and guard against shipping source maps — the cheapest, highest-value hardening steps identified in a source-protection consultation."
status: done
tags: [hardening, electron, packaging, security, feature]
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: [WS-60-imdumr]
links: []
---

Disable Node command-line escape hatches via Electron fuses, turn off devtools in the production build, and guard against shipping source maps — the cheapest, highest-value steps of a larger source-hardening plan.

This came out of a consultation on protecting this closed-source Electron app's source code from casual reading, following up on an article review and a colleague's detailed rebuttal of that article. A subagent produced an 11-step ordered action plan, explicitly framed as "raising the cost, not a security boundary — nothing here is foolproof." This workstream covers the plan's first three steps, identified as the cheapest and highest-value:

1. Electron fuses: set `RunAsNode: false`, `EnableNodeOptionsEnvironmentVariable: false`, `EnableNodeCliInspectArguments: false` via the `electronFuses` key in `package.json`'s `build` block (electron-builder 26 supports this). Rationale: today a person can start the packaged binary with the inspector attached and read every loaded script in full — this defeats minification, obfuscation, and bytecode all at once, so it is ranked as the single largest gain on the whole 11-step list.
2. Set `devTools: false` on the production `BrowserWindow` (keep it on in `electron:dev` only).
3. Confirm no source maps reach `dist/public/` — `tools/copy-assets.mjs` was found to already be clean (it only copies HTML/CSS/font), so this step is a verification/guard against regression, not a fix.

Out of scope for this workstream: the renderer bundling/obfuscation work (steps 4-5 of the same plan, tracked separately), code signing and ASAR integrity (step 6, tracked separately), and bytenode compilation of the Electron main process (step 7, tracked separately).

---
id: WS-92-t964y8
type: workstream
workstream: WS-92-t964y8
slug: readme-flowcharge-board-positioning
title: "Reauthor this repo's README.md around FlowCharge Board's public positioning"
description: "The root README.md still reads as a web/Electron dev-workflow document. Rewrite it to state FlowCharge Board's positioning as the primary product, describe the D-26 CLI-binary-first distribution model with real install instructions, and link to the flowcharge-core repository as the companion open-source skill suite this app orchestrates. This is this repo's own README, not the public repo's."
status: done
tags: [documentation, closed-source, feature]
created: 2026-09-04
updated: 2026-09-04
author: Anthony Koukoullis
depends_on: [WS-91-mecfuo, WS-95-3r4cg5]
links: []
---

Bring this repo's root README.md up to date: FlowCharge Board as the primary product, the CLI-binary-first distribution model, and a link to flowcharge-core.

## What to change

Read the current `README.md` first — it likely still describes only the web and Electron dev workflow, not the app's actual public positioning. Rewrite it to:

- State FlowCharge Board's positioning as the primary product, per `Praxis-Business/strategy/00-positioning.md`.
- Describe the CLI-binary-first distribution model per decision D-26, once that is live.
- Link to the flowcharge-core repository, `https://github.com/FlowChargeApp/flowcharge-core`, as the companion open-source skill suite this app orchestrates.

## Sequencing

This rewrite should happen AFTER the release process workstream lands and AFTER the Homebrew tap exists, so it describes real install instructions — including `brew install` — and not aspirational ones. `depends_on: [WS-91-mecfuo, WS-95-3r4cg5]` records both as hard dependencies — this workstream is now sixth in the recommended seven-workstream execution chain (WS-93 → WS-89 → WS-90 → WS-91 → WS-95 → WS-92 → WS-94).

## Boundary

This is a docs-only change to THIS repo's own README.md. It is not the public repo's README, which the public flowcharge repository scaffolding workstream owns. Keep the two clearly distinct.

---
id: WS-80-lgot3j
type: workstream
workstream: WS-80-lgot3j
slug: flowcharge-prose-rename-sweep
title: "UI text, README and code comments still call the app Praxis Board instead of FlowCharge"
description: "The app is renamed from Praxis / Praxis Board / Praxis Dashboard to simply FlowCharge, dropping the words dashboard and board from its name and product description, and becoming the primary user-facing entry point for the whole product. Visual branding and data-format compatibility already landed in WS-70-hvf4cd, WS-69-m06s86 and WS-44-h5cpzp. This workstream sweeps only the remaining prose: user-visible UI text, the README and other documentation, and source-code comments. Code identifiers, file names, CSS classes, API routes and data-format field names are out of scope. The words board and dashboard change only where they are branding or product description, never where they name the real kanban UI this app renders."
status: done
tags: [flowcharge, documentation, ui, maintenance]
created: 2026-08-30
updated: 2026-08-30
author: Anthony Koukoullis
depends_on: []
links: []
---
The app's prose still calls itself Praxis, dashboard and board as branding across UI text, the README, other documentation and code comments, and it must read FlowCharge instead.

## The rebranding decision

A rebranding decision has been made: this app (repo root `/Users/akoukoullis/Work/AK/Praxis-Dashboard`) is being renamed from "Praxis" / "Praxis Board" / "Praxis Dashboard" to simply **"FlowCharge"** — dropping the words "dashboard" and "board" from its name and product description entirely, and becoming the primary, user-facing entry point for the whole product.

The sibling repo that holds just the FlowCharge skill files (the Claude Code skill suite this app's boards are generated from) is being renamed to **"FlowCharge Core"** — the set of components a user installs into their agentic coding environment to work with this app. That sibling repo's own folder is still literally named "Praxis" on disk for now, for unrelated technical reasons, and is out of scope here — this workstream only touches this repo (Praxis-Dashboard).

## What already landed

This app's own rebranding to FlowCharge is already partway done — see prior workstreams `WS-69-m06s86` (flowcharge-prefix-compatibility), `WS-70-hvf4cd` (flowcharge-logo-and-masthead) and `WS-44-h5cpzp` (vendor-praxis-skill-content). Visual branding (logo, wordmark) and some data-format compatibility work already landed.

## Scope of this workstream

This new workstream is specifically about sweeping every remaining piece of **PROSE**:

- user-visible UI text and copy,
- the README and any other documentation,
- comments in the source code.

It is **not** about renaming code identifiers, file names, CSS classes, API routes, or data-format field names (e.g. `praxisAPI`, `PraxisWorkstream`, `.praxis-projects.json`, `board.html`, `.board` CSS class) — those are structural/technical and a much larger, separate concern; changing them is explicitly out of scope for this workstream.

The scope is human-readable text: what a user reads in the UI, what a reader reads in the README/docs, and what a developer reads in a comment.

## Rough scan already performed

A rough scan already found 27 non-generated, non-vendored files still containing the string "Praxis" in this repo (excluding `node_modules`, `dist/`, `flowcharge/`, `prxwork-bak/`, `release/`, `mockups/`):

`.praxis-projects.json`, `README.md`, `package.json`, `electron/main.cts`, `electron/update-check-ipc-handlers.cts`, `electron/ipc-handlers.cts`, `electron/preload.cts`, `electron/agentic-tools-ipc-handlers.cts`, `src/types/praxis-data.d.ts`, `src/public/index.html`, `src/public/ipc-adapter.ts`, `src/public/app.ts`, `src/public/update-banner.ts`, `src/public/board.html`, `src/public/lib/agentic-tools-api.ts`, `src/public/home.ts`, `src/public/browser-ipc-shim.ts`, `src/scripts/extract-praxis-data.ts`, `src/lib/extract.ts`, `src/lib/yaml-block.ts`, `src/lib/agentic-tools-canonical-skills.ts`, `src/lib/update-check.ts`, `src/lib/detail.ts`, `src/lib/agentic-tools-skill-presence.ts`, `src/lib/extract.test.ts`, `src/lib/skill-content-fetch.ts`, `src/server.ts`.

This list is not yet triaged — most of these hits are almost certainly legitimate code identifiers (out of scope), not prose (in scope); a small number may be user-visible strings or comment prose that should change. A full investigation is planned as this workstream's next step, not part of this initial record.

## The "board" / "dashboard" audit

Separately, the word "board" / "dashboard" also needs auditing wherever it appears in a **branding or product-description** sense — e.g. this repo's own README calls itself "a local, bird's-eye Kanban dashboard" and refers to opening "its board".

That is as opposed to its ordinary, legitimate technical/generic use: this app genuinely renders a kanban board UI, so words like "board payload", `board.html`, "the board screen", the `.board` CSS class and the `BoardPayload` type are structural, not branding, and are out of scope here for the same reason code identifiers are out of scope.

## Net task

Investigate the codebase thoroughly for every candidate instance in UI text, documentation and code comments, triage each as a genuine rename candidate or a legitimate technical use to leave alone, then plan and execute the prose changes for the genuine candidates.

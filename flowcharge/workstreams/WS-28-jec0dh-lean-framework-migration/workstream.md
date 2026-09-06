---
id: WS-28-jec0dh
type: workstream
workstream: WS-28-jec0dh
slug: lean-framework-migration
title: "Migrate dashboard frontend to a lean modern component framework"
status: backlog
created: 2026-08-12
updated: 2026-08-17
depends_on: []
links: [WS-5-kxteoh, WS-7-c5ispw]
tags: [refactor, architecture, frontend]
---

Refactor and rewrite the dashboard's frontend to adopt a lean, efficient, widely-adopted component framework (React, Vue, or whichever is the most popular option that is lean) that makes implementing the behaviour from the previous workstreams much easier, and reorganize the code into a clean, best-practice structure of files / modules / classes per current frontend conventions.

Not a ground-up rewrite of everything — existing behaviour and output stay the same; the ask is a framework migration plus a principled code-structure pass. Current frontend is plain TypeScript with no framework: `src/public/app.ts` (board app), `src/public/home.ts` (home page), hand-written `board.html` / `index.html` / `styles.css`. Recent workstreams (WS-5 detail modal, WS-7 live board refresh, plus the sorting/severity/date cards, WS-27 open-modal live refresh) added substantial DOM-manipulation logic that a component framework with reactive state should make dramatically simpler.

Open questions to resolve during planning: exact framework choice (React vs Vue vs Svelte given the lean criterion, current popularity, and bundle/build impact), build-tooling strategy (Vite, etc.) alongside the existing tsc build pipeline (`npm run build` = `tsc` + asset copy), how the generated `dist` layout (tracked by WS-1 src-dist-build-layout) should be affected, and whether the framework layer should extend to the server or stay client-only.
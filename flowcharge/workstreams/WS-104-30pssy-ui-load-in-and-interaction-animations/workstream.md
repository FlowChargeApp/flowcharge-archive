---
id: WS-104-30pssy
type: workstream
workstream: WS-104-30pssy
slug: ui-load-in-and-interaction-animations
title: "Animate the home tiles, board KPI numbers and board cards into place on load, plus button hover and click accents"
description: "A deliberately open-ended, ideas-gathering item: add subtle, small, effective animations across both pages of the app, on load and on interaction. The maintainer gave a starting list of four ideas - staggered split-flap-style tile entry on the home screen, count-up KPI numbers with staggered panel entry on the board, staggered card entry so the board appears to draw itself on, and small animated accents on button hover and click. More ideas are expected to surface when this workstream is planned, so the list is a seed, not a closed spec. Method, feasibility and staggering technique are all undecided and must respect the project's no-runtime-dependency rule for shipped code."
status: backlog
tags: [animation, ui, ux, frontend, home-page, board]
created: 2026-09-10
updated: 2026-09-10
author: Anthony Koukoullis
depends_on: []
links: []
---

Animate the home project tiles, the board KPI numbers and the board cards into place on load, staggered rather than all at once, and add small animated accents to buttons on hover and click.

## Scope

This is a UI feature request for the app's two pages — `src/public/index.html` with `src/public/home.ts`, and `src/public/board.html` with `src/public/app.ts`. It is not a FlowCharge Core orchestration change.

What is wanted: subtle, effective, small animations across the UI, on load and on interaction.

## Starting list of animation ideas, as given

1. **Home screen project tiles, on load.** The project tiles (`#project-tiles`, populated by `renderTiles()` in `home.ts`) should animate in one at a time, staggered, each growing into its final position — not all appearing at once. The maintainer's reference point: the old mechanical split-flap boards seen at airports or train stations, where letters/characters flip into place one after another.

2. **The board's top KPI panels, on load.** The four KPI tiles (`#kpi-strip`, populated by `renderKpis()` in `app.ts`) should have their numbers count upward rapidly and then decelerate smoothly to the final value, rather than appearing instantly. The panels themselves should also animate in — growing into their final size in a staggered approach, so they appear to draw themselves on rather than pop in.

3. **The Kanban workstream cards, on load.** Each card on the board (rendered by `renderBoard()` in `app.ts`) should similarly grow into its final size in a staggered, fast sequence when the board first loads, giving an overall impression that the whole board is being "drawn on" rather than appearing all at once.

4. **Button hover and click accents.** A more open-ended idea: small animated accents on buttons in response to hover or click, across the UI generally, not yet tied to any specific button or component.

## This list is a starting collection, not a closed spec

The maintainer explicitly expects more ideas to surface later. Capture and keep the four above in full, but do not treat them as exhaustive or final. When this workstream is actually planned, expand the list first, then evaluate:

- feasibility of each idea;
- method — CSS transitions/animations, a small hand-written animation loop, or a library;
- how staggering and counting-up numbers should actually be implemented.

None of that is decided now. The shipped code has no runtime dependency (DEVELOPMENT.md, Prerequisites), so any method chosen must respect that.

## Reference links — UI/animation libraries to evaluate at planning time

The maintainer collected these while thinking about this workstream. Not yet evaluated for
fit, license, bundle size or the project's no-runtime-dependency rule — that evaluation
happens when this workstream is planned, per "This list is a starting collection" above.

- https://www.interior.dev/
- https://opensourceui.in/
- https://reui.io/components
- https://www.beautifului.dev/
- https://www.rareui.com/
- https://transitions.dev/
- https://ui.shadcn.com/

## Status of this record

This is a backlog card only. No plan, issue list or task list was authored for it, and nothing was executed.

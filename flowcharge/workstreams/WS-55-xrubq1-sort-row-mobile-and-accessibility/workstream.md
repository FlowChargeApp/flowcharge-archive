---
id: WS-55-xrubq1
type: workstream
workstream: WS-55-xrubq1
slug: sort-row-mobile-and-accessibility
title: "Fix the sort row's mobile overflow and improve its accessibility"
status: backlog
tags: [board, ui, ux, issue, feature]
created: 2026-08-21
updated: 2026-08-31
author: Anthony Koukoullis
depends_on: []
links: [WS-83-vskjrr, WS-84-sxdmbl]
---

Fix a broken mobile layout and add accessibility improvements to the board's sort row, both raised by a senior UX/UI subagent's review of WS-54's controls bar this session.

Grounded in a live-measured review (real viewport rendering, not estimates): at 375px width the sort row's `#sort-key-seg` (5 buttons: Artefact ID, Name, Severity, Created, Updated) forces the whole page 139px wider than the screen. `.controls` is `position: sticky; top: 0`, so this overflow is pinned to the top of every screen. Three effects follow: the Asc/Desc direction buttons sit fully off-screen and are unreachable without a sideways drag; `.seg`'s `overflow: hidden` clips the "Updated" button so it reads as a rendering fault; and flex-shrink compresses the buttons until the active label wraps to two lines and the row grows taller than intended. This is a genuine defect (existing behavior broken on a viewport class the control renders on at all), not a missing capability — filed as an issue.

Two features, not defects, also came out of the same review: (1) neither the sort buttons nor the (separate, WS-56) filter buttons expose their active state to a screen reader — state lives only in a CSS class, with no `aria-pressed`; (2) a better long-term mobile design than the minimal overflow fix — replace the 5-button key segment with a native `<select>` below the existing 880px breakpoint, and collapse Asc/Desc into a single icon button that flips between ↑ and ↓, roughly 200px on one line versus the current segmented control's footprint.

Full recommendations from the reviewer, to ground the investigation:
- Bug fix direction: inside the existing `@media (max-width: 880px)` block (styles.css), let `.seg` scroll horizontally within its own bounds rather than overflowing the page (`.controls .group { flex-wrap: wrap; min-width: 0; }`, `.controls .group .seg { max-width: 100%; overflow-x: auto; }`, `.seg button { flex: none; white-space: nowrap; }`). Reuse the existing breakpoint; do not add a new one. Do not just shorten the button labels — the reviewer checked the arithmetic and short labels alone still don't fit beside the direction segment at 375px. Do not put sort behind a drawer/toggle — sort state must stay visible, since it explains the card order on screen.
- Feature direction (native select + icon toggle): treat as the upgrade, not the minimum fix, since it needs a second control kept in sync with the underlying sort state.
- Feature direction (accessibility): add `aria-pressed` to the sort buttons reflecting the active key/direction; the `Sort` label element is a `<label>` with no `for` — reconsider it as a `<span>`/heading or `role="group"`/`aria-label`, since it labels a group, not a form control.

Next steps: for the bug, write it up as an issue, investigate the codebase for the best fix, then author spec tasks. For the two features, investigate the codebase, write up a plan, then author spec tasks. Execution and commit were not requested yet.

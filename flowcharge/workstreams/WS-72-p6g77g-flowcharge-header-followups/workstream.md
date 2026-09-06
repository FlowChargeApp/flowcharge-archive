---
id: WS-72-p6g77g
type: workstream
workstream: WS-72-p6g77g
slug: flowcharge-header-followups
title: "Match the app's toolbar chrome to the mockups the header work was translated from"
description: "Six items found comparing the built app against the approved mockups: two settled-but-dropped mockup details (font, card-foot color) plus a spacing gap, and three scope decisions the user is now reversing (home heading removal, add-project reorder, footer removal on both screens)."
status: done
tags: [ui, ux, styling, feature]
created: 2026-08-28
updated: 2026-08-28
author: Anthony Koukoullis
depends_on: []
links: []
---
Comparing the built app (WS-70's translation of mockups/home-toolbar-mockup.html and mockups/board-toolbar-mockup.html into real code) against those same mockups surfaced six gaps.

## Genuine mockup-fidelity gaps — settled in the mockups, never carried into any plan

1. **Card-foot dashed rule color.** The mockups settled on `--line` for `.card-foot`'s dashed top rule (subtler, less contrasty) after the user found the original bronze/`--rule-strong` choice too orange, and separately noticed dropped cards look grey instead of orange purely because `.card.is-dropped`'s `opacity: 0.68` desaturates whatever color sits there. WS-71's PLN-60/TL-71 never had this correction folded back in, so the shipped app still uses `--rule-strong` (bronze), reproducing exactly the orange/grey inconsistency the mockup work fixed. Revert `.card-foot`'s `border-top` to `var(--line)`.
2. **Small-heading font.** Both mockups settled on swapping `--font-display` from the Fraunces serif to the body sans face, for headings/tile-names (home) and KPI values/panel headings (board) — explicitly NOT for anything already using `--font-mono` at its original size. Neither PLN-60 nor PLN-62 ever captured this token change; TL-71's Phase 4 explicitly left `--font-*` untouched. Apply the same `--font-display: var(--font-body)` swap the mockups use, confined to the same scope (large serif usages only, not mono labels).
3. **Info-bar-to-KPI spacing.** The mockups' `.mockup-note` div (a dev-only "static mockup" caption) incidentally created a visual gap between `.toolbar-sub` and the KPI strip below it. Removing that mockup-only element when translating to the real app also removed the gap it created. Add back an equivalent margin/padding so the same visual breathing room exists without the caption text.

## Scope reversals — deliberately excluded by PLN-62, now wanted

4. **Home screen: drop "Your projects".** PLN-62 explicitly kept the home screen's body unchanged, including the `<h1 class="home-heading">Your projects</h1>` heading, reasoning that reordering/trimming the body was out of scope for a header-focused plan. The user now wants this heading removed entirely — it was already settled once in this project's earlier mockup-review discussion, before WS-70/WS-71 existed as separate workstreams, and got lost when PLN-62 scoped it out again.
5. **Home screen: move "Add a project" above the tile grid.** Same PLN-62 exclusion as item 4, same earlier settled decision. Reorder so the add-project form is the first thing under the toolbar chrome, tiles below it.
6. **Remove both screens' footers entirely.** PLN-62's Assumption A5 treated the mockups' lack of any footer as "absence is not a deletion instruction" and left both `<footer class="note">` blocks (wordmark/lockup image, disclaimer prose) in place, only relocating `#app-version` out of them. The user now wants both footers deleted outright, matching the mockups, which show no footer at all.

## Constraints

- This workstream starts only from these six items — nothing broader. No other visual difference between the app and the mockups was reported.
- Item 1's fix is a single-selector CSS revert; verify against WS-71/PLN-60's own contrast reasoning for `--line` before assuming no other consequence.
- Item 2's font swap must stay scoped exactly as the mockups did it — confirm scope by re-reading both mockup files' `--font-display` usage and everything that references `var(--font-mono)`, rather than re-deriving which elements qualify.
- Items 4-6 reverse specific, named PLN-62 assumptions (A5 for the footer) — record that reversal explicitly rather than silently overwriting the earlier plan's reasoning.
- `flowcharge-mark.png`'s un-downscaled size and the `--line` dark-mode value are both already-tracked open items from prior workstreams (WS-70's PLN-62 open questions 1 and 5) — do not duplicate them here unless the user names them again.

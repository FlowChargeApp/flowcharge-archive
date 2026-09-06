---
id: WS-65-o96qgz
type: workstream
workstream: WS-65-o96qgz
slug: modal-description-show-more
title: "Add a Show more reveal to the workstream details modal's description"
description: "Line-clamp the modal description to 4 lines with a Show more reveal button (matching the plan panel's existing pattern), only when the text actually overflows, with the meta region scrolling on short viewports so an expanded long description is never clipped."
status: done
tags: [detail-modal, ui, ux, styling, feature]
created: 2026-08-23
updated: 2026-08-23
author: Anthony Koukoullis
depends_on: []
links: []
---

Implement a "Show more" reveal for the workstream details modal's description in the Praxis-Dashboard repo. This is a Dashboard-repo-only frontend change. It does not touch the Praxis skill-source repo, and it does not change the description field's underlying character cap in any way.

Target: the description element `#ws-modal-description` (a `<p>` with class `ws-modal-description`) in `src/public/board.html`. It is populated by `renderModalMeta()` in `src/public/app.ts` and styled in `src/public/styles.css`.

Mechanic: apply a CSS line-clamp of 4 lines to the description text using `-webkit-line-clamp` (with the required `display: -webkit-box`, `-webkit-box-orient: vertical`, and `overflow: hidden`), via a modifier class the script can remove. Below the clamped text, render a "Show more" button that matches the existing plan panel's "Show more" button styling and one-shot behaviour (see `appendPlanBody()` in `src/public/app.ts` for the existing pattern): clicking it removes the clamp class, reveals the full text, and hides the button permanently for that render — no re-collapse. The full description string is already present in the DOM; the reveal must be pure CSS-class removal, with no string truncation and no re-fetch.

Toggle visibility logic: only show the "Show more" button when the text actually overflows the clamped height. After setting the description text and applying the clamp class in `renderModalMeta()`, compare `scrollHeight > clientHeight` on the element and show the button only when true. Make sure this check runs while the element is visible and laid out, and that repeated modal opens reset the state (clamp re-applied, button visibility re-evaluated) for each workstream.

Small-viewport fix: the description sits in `.ws-modal-meta`, a pinned, non-scrolling header region above the modal's tabs; the dialog uses `overflow: hidden` and `.ws-modal-inner` caps height at `calc(100vh - 64px)`, so an expanded long description can be clipped with no way to reach the rest. Give `.ws-modal-meta` a `max-height` and `overflow-y: auto` (or let it flex-shrink with its own scroll) so an expanded description scrolls within the meta region instead of being clipped. Verify on a short viewport that the tabs and tab body remain usable and the entire expanded description is reachable.

Acceptance criteria: a short description shows no button and no clamp artefacts; a long description shows exactly 4 lines plus "Show more"; clicking reveals the full text with the button gone; reopening the modal restores the clamped state; at a small viewport height the fully expanded description is fully scrollable and nothing is clipped.

---
id: WS-70-hvf4cd
type: workstream
workstream: WS-70-hvf4cd
slug: flowcharge-logo-and-masthead
title: "Replace Praxis branding with the FlowCharge logo across the Dashboard UI"
status: done
tags: [flowcharge, ui, ux, styling, icons, feature]
created: 2026-08-27
updated: 2026-08-28
author: Anthony Koukoullis
depends_on: [WS-71-0ca13u]
links: []
---
The Dashboard still shows the old "Praxis" branding and no FlowCharge logo, even though the sibling public site has already shipped real FlowCharge logo assets to use.

A senior UX/UI designer subagent was consulted twice on how to integrate them, with the exact source assets and current markup as context. Its final, user-approved recommendation:

## Assets (already exist, sibling repo)

All in `/Users/akoukoullis/Work/AK/Praxis-Website/public/`, PNG with alpha, chrome/metallic gradient styling:
- `flowcharge-logo.png` (1000×1000) — standalone arrow/lightning mark, no text.
- `flowcharge-name.png` (2048×490) — "FlowCharge" wordmark, no mark.
- `flowcharge-name-logo.png` (2120×270) — combo lockup: mark + wordmark together.

None of the three say "FlowCharge Board" or "FlowCharge Projects" — commissioning a combined text asset was considered and explicitly rejected (see below).

## Decisions taken

1. **Masthead wordmark**: place a trimmed `flowcharge-name.png` (crop to alpha bounds, ~2% margin, export ~420px wide, keep alpha) top-left on both screens, where the current `.mark`/"P" badge sits.
2. **No baked "FlowCharge Board" image.** The brand is stable; the screen content is not. A baked combined image would need one variant per screen and re-generation on every future screen. Use the wordmark image plus real text instead.
3. **Delete the circular "P" mark badge** (`<span class="mark">P</span>` in both HTML files, and the `.masthead .mark` CSS rule) entirely — it reads as stale old branding next to a real wordmark.
4. **Footer**: add the `flowcharge-name-logo.png` combo lockup, small and muted (~18px visible height, ~0.75 opacity in light mode), at the top of the currently plain-text `<footer class="note">` on both screens.
5. **Favicon/app icon**: the standalone arrow mark (`flowcharge-logo.png`) has no place in either page's body (this app has no hero section), but should become the favicon and desktop app icon — there is currently no `<link rel="icon">` in either HTML file. The source PNG cannot just be downscaled: it needs to be **redrawn**, not resized — remove the drop shadow, reduce the chrome to 2-3 tonal bands, thicken the outline, and fill as one solid silhouette, or it turns to noise at 16-32px. **This is new artwork the user may need to generate/commission separately — it is not producible by mechanically processing the existing source PNG.** Deliver at 512/180/64/32/16px, plus SVG if possible.
6. **Per-screen heading treatment** (second design round, resolving a follow-up question about whether either screen needs an on-page title at all, given this is an Electron desktop app, not a website):
   - **Home screen** (`index.html`): drop the `<h1>Praxis Projects</h1>` entirely — there is one home screen, it's self-evident from its own content (project tiles, add-project form), and the board screen's own "← Projects" back-link already establishes the word "Projects" via navigation. Promote the existing `<h2 class="home-heading">Your projects</h2>` to `<h1>` (keep its class) so the document still has a real, content-bearing heading. No divider next to the wordmark on this screen (nothing to divide from).
   - **Board screen** (`board.html`): keep the `<h1>` slot, but stop putting "Praxis Board" in it. `app.ts:1213` currently puts the actual project folder name into the small 11px tagline ("Workstream state · <name>"), while the big 30px heading holds the static word "Board" — backwards, since with Electron allowing multiple board windows open at once, the project name is the one thing that actually needs page-level visibility (the OS window title alone can't differentiate multiple open windows). Swap them: project name into the `<h1>`, "Workstream state" into the tagline. Keep the wordmark → divider → `<h1>` layout on this screen only.
   - General rule stated by the designer: "app UIs don't repeat their own name as a heading — the heading holds what varies, never the brand."

## Technical build notes from the design review (not exhaustive — implementer should re-verify against current code)

- `.masthead .brand-row` currently uses `align-items: baseline`; an `<img>` has no useful baseline — change to `center`. `.masthead` itself also uses `align-items: baseline` — check the right-hand `.meta` block on the board screen after the change.
- The wordmark PNG has large transparent padding above/below the letters (~half the 490px canvas height) — trim to alpha bounds before sizing, or the logo renders undersized inside its own bounding box.
- Never apply a CSS filter to invert/brighten the chrome-gradient PNGs for dark mode — an inverted chrome gradient reads as a broken image, not a dark variant. The wordmark's built-in dark outline + pale glow already survives both the near-white (`--paper: #F3F5F4`) and near-black (`--paper: #10141A`) themes as tested; if either theme looks wrong once built, request separate light/dark exports rather than filtering.
- The standalone arrow mark is mostly near-white with a soft grey shadow and reads faint/dirty on the light theme — this is a second, independent reason (beyond "no hero section") it does not belong in either page body.
- Consider marking up `.masthead` as a semantic `<header>` element rather than `<div class="masthead">`, at least on the home screen where the visible heading is being removed, so the region is still announced to assistive tech as a landmark.

## Explicitly out of scope

`package.json`'s `"productName": "Praxis Board"` (the Electron window/dock/taskbar title) still says the old name. The design rationale for dropping on-page titles partly assumes the OS-level app name will say "FlowCharge Board" — it currently doesn't, and this workstream does not fix that. Flagged for the user as a related, separate piece of work; not actioned here.

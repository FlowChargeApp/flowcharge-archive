---
id: WS-71-0ca13u
type: workstream
workstream: WS-71-0ca13u
slug: flowcharge-theme-palette-and-toggle
title: "Match the Dashboard's light and dark themes to the FlowCharge website's palette, with a theme toggle"
description: "Recolor the Dashboard's semantic UI tokens (backgrounds, cards, KPI panels) to match the FlowCharge website's derived light/dark palette, freeze board status/severity colors, and add a light/dark/system toggle."
status: done
tags: [styling, ui, ux, flowcharge, feature]
created: 2026-08-28
updated: 2026-08-28
author: Anthony Koukoullis
depends_on: []
links: []
---
The Dashboard's light and dark themes do not match the sibling FlowCharge website's palette, and the app has no in-app light/dark toggle at all.

## Origin

Follow-on from WS-70 (flowcharge-logo-and-masthead), whose masthead/footer logo treatment the user rejected post-merge as "looking like a website." Before revisiting the header, the user asked for a UX/UI audit and raised five points; this workstream covers points 2 and 3 (a `cl-opus-high` subagent's recommended sequencing: colors and toggle land first, since judging a new header in the app's current colors would repeat the same patchwork problem).

## User's original request (points 2 and 3, verbatim intent)

- The website (`/Users/akoukoullis/Work/AK/Praxis-Website`) has a light and dark color palette developed for it, extracted from the FlowCharge wordmark/logo: https://coolors.co/palette/434a5b-d5e0e9-5c7c96-a2805b-d2c2aa (`#434a5b` slate, `#d5e0e9` powder, `#5c7c96` steel, `#a2805b` bronze/tan, `#d2c2aa` oak/light tan). The app's light theme and dark theme need to match the website's light theme and dark theme: backgrounds, workstream/card elements (header/body/footer of each card), and the KPI info panels near the top of the app should be recolored to match, using the overall palette. Exact same five colors do not need to be used everywhere — subtle variations, neighbouring palette colors, and complementary in-between tones are welcome, so the same exact colors aren't reused everywhere verbatim.
- A button needs to be added to switch between light mode and dark mode, with dark mode as the default, or system-theme-detected default if feasible.

## Facts established during discussion (from a `cl-opus-high` subagent's read-only inspection of both repos — treat as verified, not assumption)

- The website's palette work already exists in full: `/Users/akoukoullis/Work/AK/Praxis-Website/app/steel-theme.css` holds a complete light-and-dark semantic token system (`--background`, `--card`, `--muted`, `--border`, `--primary`, `--accent`, chart ramp) derived from the five swatches, with each derivation recorded in a comment (e.g. "oak mixed 65% toward white", "slate with each channel halved"). This is the source of truth to map from, not the raw hex codes.
- The dashboard already has its own clean semantic token layer at the top of `src/public/styles.css` (`--ink*`, `--paper*`, `--line*`, `--accent*`, plus `--st-*` status colors and `--sev-*` severity colors). Below line ~120 there are only six hardcoded colors against roughly 230 `var(--)` uses, so this recolor is a value swap in the `:root` and `@media (prefers-color-scheme: dark)` blocks, not a rewrite.
- Token **names** differ between the two repos (shadcn-style roles vs. `--ink`/`--paper`), so a mapping table from website role to dashboard token is needed — not a file copy.
- The board's status colors (`--st-backlog`, `--st-ready`, `--st-in-progress`, `--st-blocked`, `--st-done`, `--st-dropped`) and severity colors (`--sev-critical`, `--sev-high`, `--sev-medium`, `--sev-low`) must be frozen and NOT recolored from this palette — the five swatches contain no red and no green, and the website's own theme file leaves its destructive-red untouched for the same reason (no logo equivalent). Only the chrome/neutral tokens (`--ink*`, `--paper*`, `--line*`, `--accent*`) are in scope for this palette match.
- Computed contrast ratios against the powder swatch: slate `#434a5b` is 6.6:1 (safe for body text), steel `#5c7c96` is 3.3:1 (large text/borders only), bronze `#a2805b` is 2.7:1 (rules/accents only, never text). Raw swatches used verbatim as text colors will fail accessibility contrast; use the website's derived tiers instead.
- Backgrounds are derived, not raw swatches. The website's light-mode background is `#E9E1D5` (oak mixed 50% toward white — a warm cream), not the lightest swatch (powder blue, `#d5e0e9`), which the website instead uses as dark-mode text. The website's dark-mode background is `#22252E` (slate with each channel halved). The user has confirmed: follow the website's warm cream for the app's light-mode background rather than keeping the app's current cool powder-blue background, since matching the website was the explicit goal and the cream exists specifically to keep the palette's other colors readable at proper contrast.
- Do not port the website's body radial gradient (a four-stop ambient gradient over the flat background) — flagged as another "website" visual tell that would fight a dense Kanban board's density.
- The dashboard already has an unused `:root[data-theme="dark"]` / `:root[data-theme="light"]` CSS block in `styles.css` (dead code, confirmed via grep never wired to any script) that already mirrors the `@media (prefers-color-scheme: dark)` values — this can likely be wired up rather than rebuilt, once its values are updated to the new palette.

## Toggle implementation notes (from the same subagent, sanity-checked, not yet implemented)

- Use `data-theme` on `:root` (the existing dead attribute selector) plus `localStorage` for the user's explicit choice, with `prefers-color-scheme` as the fallback when no explicit choice has been made.
- Retarget the current `@media (prefers-color-scheme: dark)` block to apply only via `:root:not([data-theme])`, so the system-default case is explicit rather than winning by CSS cascade accident once `data-theme` starts being set.
- Apply the stored theme in an inline `<head>` script before first paint, or a dark-default launch will flash white/light briefly.
- Support three states — system, light, dark — not just two. This is an Electron app; consider tying the "system" state to Electron's `nativeTheme.themeSource` in the main process so the OS-level chrome (if any) and the web content agree.
- Dark mode is the default absent any stored user choice (per the user's explicit request), with "system" as a selectable third option rather than the silent default — the user asked for "dark mode being the default, or possibly the system theme being the default, if that's even possible to be ascertained"; resolve this open question in the plan.

## Explicitly out of scope

- The header/masthead/footer redesign (points 1, 4, 5 of the user's original five-point list) — tracked separately in WS-70 (flowcharge-logo-and-masthead), continuing under that workstream since it is the same target the earlier masthead work already touched.
- Any change to the board's status or severity colors.
- Favicon/app-icon redrawing (WS-70's still-blocked Phase 5).

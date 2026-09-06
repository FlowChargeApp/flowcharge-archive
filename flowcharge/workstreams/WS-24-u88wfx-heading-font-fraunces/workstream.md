---
id: WS-24-u88wfx
type: workstream
workstream: WS-24-u88wfx
slug: heading-font-fraunces
title: "Switch the dashboard's heading font from the system serif to Fraunces"
status: done
created: 2026-08-09
updated: 2026-08-09
depends_on: []
links: []
tags: [styling, typography, ux]
---
Replace the dashboard's heading font (currently the `--font-display` system-serif stack, falling back through Georgia) with the free Google Font Fraunces (https://fonts.google.com/specimen/Fraunces), because the current look reads as generic, like many other generated dashboards.

`--font-display` is defined in `src/public/styles.css` and used only for headings and heading-weight text (h1/h2 in the masthead, panel headers, modal headers, empty-state headings) — body text uses `--font-body` and code/data uses `--font-mono`, both untouched by this change.

Discussed direction: use Fraunces plain (no "soft"/"wonky" optical axes), medium weight (500-600) matching the existing `font-weight: 600/700` on headings, with `font-optical-sizing: auto`. Fraunces ships as a variable font, so one `@font-face`/Google Fonts reference should cover the weight range already used. Investigation should confirm the best way to bring the font into this project (self-hosted static file vs. Google Fonts link) and whether it needs a fallback stack for offline/no-network use.

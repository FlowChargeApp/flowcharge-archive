---
id: WS-84-sxdmbl
type: workstream
workstream: WS-84-sxdmbl
slug: toolbar-mobile-width-overflow
title: "Toolbar buttons overflow or disappear at mobile widths"
description: "The top toolbar carries four buttons, including Manage Integrations. At mobile widths there is not enough room and the user's own observation is that the whole button row may disappear rather than reflow, which needs confirming. The user's proposed direction is to shrink Manage Integrations from a labelled button to a glyph-only button (e.g. a briefcase icon) so all four fit."
status: backlog
tags: [ui, ux, styling, feature]
created: 2026-08-31
updated: 2026-08-31
author: Anthony Koukoullis
depends_on: []
links: [WS-55-xrubq1, WS-83-vskjrr]
---

Confirm what actually happens to the top toolbar's four buttons at mobile widths, and evaluate turning Manage Integrations into a glyph-only button so all four fit.

## What the user said

While settling the open questions on WS-83 (disable Manage Integrations over LAN), the user added: "since this is a semi-cosmetic feature, I want to change the button's label from the text to a glyph, maybe a glyph of a briefcase, simply because at mobile widths there still is a problem with space on that top toolbar and that big button doesn't quite fit, but it will fit. In fact, I think what happens is everything disappears, which I don't want. Those four buttons can fit at mobile widths if the manage integrations button becomes a glyph itself."

The user chose to investigate first rather than plan directly, because their own description of the current behaviour ("I think what happens is everything disappears") is a suspicion, not a confirmed fact.

## Net ask, for the investigation stage

Confirm, by reading the actual toolbar markup and CSS and by checking rendered behaviour at mobile widths, what currently happens to the toolbar's four buttons (including Manage Integrations) when the viewport narrows — do they overflow, wrap, get clipped, or does the whole row disappear as the user suspects. Report back with enough detail (the actual CSS rules and breakpoints involved, and why the current behaviour is what it is) for a decision on whether the glyph-button idea is the right fix, before any plan is written.

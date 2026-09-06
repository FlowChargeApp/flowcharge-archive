---
id: WS-25-u72qbt
type: workstream
workstream: WS-25-u72qbt
slug: card-dependency-highlighting
title: "Make workstream card dependencies visible on the board"
status: done
created: 2026-08-09
updated: 2026-08-09
depends_on: []
links: []
tags: [board, ux, dependencies]
---
Workstream cards can depend on each other (`depends_on` in `workstream.md` frontmatter), and the board already renders this as a small "⤷ WS-N" line in each card's footer (`src/public/app.ts`'s `buildCard`, `.card-foot .deps` in `styles.css`). That text is faint (10px, muted color) and inert: clicking it does nothing, and it gives no way to see a linked card that sits in a different column or far down the same column.

Observed problem case: a real four-workstream chain (WS-129 → WS-48 → WS-5 → WS-65 in a separate project's Praxis board) was only visible by opening each card's frontmatter — nothing on the board itself showed the connection.

Agreed direction, two changes:
1. Make each dependency ID in the card footer clickable: clicking it scrolls the board to that card and briefly flashes its border, so a dependency in another column or off-screen becomes reachable with one click.
2. Clicking a card (not just its deps text) highlights the whole chain: every card it depends on, and every card that depends on it, gets outlined across all columns, until something else is clicked. This shows a multi-hop chain at a glance, not just one link at a time.

Both are additive, front-end-only changes (`src/public/app.ts` and `src/public/styles.css`) using data the dashboard already loads — `depends_on` is already extracted and shipped to the client. No server or schema change is expected.

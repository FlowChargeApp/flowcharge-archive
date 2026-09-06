---
id: WS-26-htqat4
type: workstream
workstream: WS-26-htqat4
slug: plan-markdown-table-rendering
title: "Render markdown tables in plans as HTML tables in the workstream details modal"
status: backlog
created: 2026-08-12
updated: 2026-08-18
depends_on: []
links: []
tags: [detail-modal, plan, markdown, ux]
---
Not a bug — a new feature. Plans shown in the workstream details modal's Plan tab render as a markdown subset (headings, paragraphs, lists, code — see `renderPlanBlocks` in `src/public/app.ts`). A markdown table in a plan's body is not one of the recognised block types today, so it renders as raw, unstyled text instead of an HTML table.

Wanted: markdown tables in a plan's body should be detected and converted to real HTML `<table>` markup when rendered in the Plan tab, styled to match the rest of the dashboard's UI (matching the existing typography, borders, and light/dark theme variables already used elsewhere in `styles.css`).

**Scope widened by the user (2026-08-09):** not just tables. All markdown inline formatting should render as its HTML equivalent, not as literal markdown characters — bold, italic, and underline named explicitly, plus whatever else the investigation finds unrendered. Block-level headings are believed to already render correctly (`renderPlanBlocks` maps `#`/`##`/`###` to h4/h5/h6), but this needs confirming, since even a correctly-detected heading block writes its text via `textContent`, so any inline markup *inside* a heading would still show as literal characters. The existing PLN-22 plan and TL-27 task list (table rendering only) should be revised in place to cover this widened scope, not superseded — Praxis supports only one plan and one task list per workstream.

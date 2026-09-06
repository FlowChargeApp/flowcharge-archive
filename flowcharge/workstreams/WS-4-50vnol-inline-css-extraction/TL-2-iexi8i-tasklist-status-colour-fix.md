---
id: TL-2-iexi8i
type: tasklist
workstream: WS-4-50vnol
slug: inline-css-extraction
title: "Fix the in-progress status colour custom-property mismatch"
status: done
created: 2026-08-04
updated: 2026-08-04
depends_on: [IL-1-ub7gho]
links: []
mode: spec
base_commit: 0b54642
---

# PRX Tasks

## Fix the in-progress status colour custom-property mismatch

`public/app.js` derives every status colour by concatenating the status token straight into a
custom-property name — `'var(--st-' + s + ')'` and `'var(--st-' + s + '-bg)'` — where `s` comes
from `STATUS_ORDER` at `public/app.js` line 2, which holds the literal token `'in-progress'`.
The call sites, as read this session, are `public/app.js` lines 85, 94, 95, 251 and 293.
`public/styles.css` declares the amber in-progress colours under the shorter names
`--st-progress` and `--st-progress-bg`, with no `-in-` infix, so the names `app.js` builds match
nothing and the in-progress colour resolves to transparent — the "In Progress" column header
dot, the KPI bar segment and the status chip all render uncoloured.

The fix renames the CSS custom properties to match the status token rather than adding a
normalisation layer in JavaScript. The status token is already the naming convention for the
other five statuses (`--st-backlog`, `--st-ready`, `--st-blocked`, `--st-done`, `--st-dropped`
all equal `--st-` plus their token exactly); `--st-progress` is the single deviation, and
correcting it restores the convention the code was written against without introducing a
mapping table, helper function, or any new code. A repo-wide grep this session confirms every
occurrence of `st-progress` outside `flowcharge/` is a *declaration* in `public/styles.css` — no
rule, script or template consumes the old names — so the rename has no other callers to break.
The change is confined to one file, so this is a single adult task.

- [x] 1. Rename `--st-progress` / `--st-progress-bg` to `--st-in-progress` / `--st-in-progress-bg` in `public/styles.css`

  ```yaml
  description: "Rename the in-progress status colour custom properties in every theme block of public/styles.css so the names match the 'in-progress' status token app.js concatenates into var(--st-...)."
  issues: [ISS-1-jkza6i]
  implement:
    - "In public/styles.css, rename the two in-progress status colour custom properties from --st-progress and --st-progress-bg to --st-in-progress and --st-in-progress-bg, in every block that declares them, so the property names equal '--st-' plus the 'in-progress' token that STATUS_ORDER (public/app.js line 2) feeds into the var() names built at public/app.js lines 85, 94, 95, 251 and 293."
    - "The declaring anchors, as read in this session, are the four theme blocks: the base :root block (lines 16 and 23), the :root nested inside the @media (prefers-color-scheme: dark) block (lines 57 and 64), the :root[data-theme=\"dark\"] override block (lines 82 and 84), and the :root[data-theme=\"light\"] override block (lines 94 and 96). In the two data-theme override blocks the declaration shares a line with other statuses, so the anchor is the declaration, not the line."
    - "Rename the property names only. Every hex value stays exactly as it is: #A8721B and #F6ECDA in the light-theme blocks, #E0A83F and #241D12 in the dark-theme blocks."
    - "Change nothing in public/app.js. The correction belongs on the CSS side; do not add a status-to-variable mapping, helper, or normalisation step."
  pattern: "public/styles.css only. public/app.js, public/index.html and every other file are read-only reference for this task."
  imports: "None. No package, module, file or selector is added — this is a rename of two existing custom-property names within one existing stylesheet. The app is dependency-free, static, and has no build step, bundler, or CSS preprocessor, so the renamed names take effect on reload with nothing to rebuild."
  compatibility: "Plain CSS custom properties consumed at runtime by an ES5-style IIFE in public/app.js that builds names by string concatenation; there is no mapping layer, so the CSS name is the only place the status token can be honoured. After the rename all six STATUS_ORDER tokens must satisfy the same rule — property name equals '--st-' plus the token, and '--st-' plus the token plus '-bg' — for backlog, ready, in-progress, blocked, done and dropped alike. All four theme blocks must stay in step with each other: a rename applied to some blocks but not others silently reintroduces the transparent colour for whichever theme was missed. public/styles.css also consumes --st-done at line 347 (.artefact-row .a-bar span) and --st-blocked at line 396 directly in its own rules; neither name changes here and both must keep resolving."
  gotcha: "The four theme blocks are easy to under-cover: two are formatted one declaration per line and two pack several statuses onto a shared line, so a line-oriented or first-match-only edit will leave the data-theme override blocks behind and the explicit theme toggle will still show a transparent dot. A plain substring replacement of '--st-progress' with '--st-in-progress' is prefix-safe and correctly rewrites the '-bg' variant too, but it is not idempotent — applying it twice yields '--st-in-in-progress'; verify the count rather than re-running it. Do not touch --st-dropped: it is a distinct status, hardcoded at public/app.js line 245, and shares no substring with the renamed names. The status tokens also appear as plain text in data.json and in flowcharge/ frontmatter; those are data, not CSS, and must not be edited."
  verify:
    - "grep -n 'st-progress' public/styles.css — expect zero matches for the old names, i.e. no line containing '--st-progress:' or '--st-progress-bg:' survives."
    - "grep -c 'st-in-progress' public/styles.css — expect exactly 8: two declarations in each of the four theme blocks."
    - "grep -rn 'st-progress' public/ — expect matches only for the new '--st-in-progress' names in styles.css, confirming no script, rule or template still refers to the old names."
    - "npm start, then open the dashboard in a browser: the 'In Progress' column header dot, its KPI bar segment and its status chip must render in the amber status colour rather than invisible, and every other column's dot, segment and chip must look exactly as before."
    - "With the page open, toggle the theme control through its explicit light and dark settings and confirm the in-progress colour holds in both — those two states are served by the :root[data-theme] blocks, not the @media block. Then inspect the In Progress dot's computed background colour in devtools: it must be a solid colour, not rgba(0, 0, 0, 0)."
  checklist:
    - "The in-progress dot, KPI bar segment and status chip render in the amber status colour in the system-default, explicit light, and explicit dark themes — none of them computes to a transparent colour"
    - "Backlog, ready, blocked, done and dropped still resolve to their original colours in all four theme blocks, for both the base and -bg variants"
    - "The stylesheet's own direct references to var(--st-done) and var(--st-blocked) still resolve, so the artefact progress bar and the blocked styling are unchanged"
    - "No hex colour value anywhere in public/styles.css differs from its pre-change value"
    - "public/app.js is byte-for-byte unchanged — no mapping table, helper, or status normalisation was introduced"
    - "No file outside public/styles.css was modified"
  self_eval:
    passed: true
    failures: []
    notes:
      - "All 8 declarations renamed in one prefix-safe substring pass across the four theme blocks (styles.css lines 16, 23, 57, 64, 82, 84, 94, 96 — matching the anchors recorded when this task was authored, no drift). Verified idempotency: grep -c 'in-in-progress' returns 0."
      - "The verify step's 'toggle the theme control' could not be performed as written: the app has no theme toggle. grep -rn 'data-theme' over public/, server.js and scripts/ matches only the two selectors in styles.css, so nothing in the app ever sets the attribute. The two :root[data-theme] blocks were exercised the only way available, by setting the attribute directly in devtools, and the attribute was removed afterwards to restore the original state."
      - "Computed-colour evidence, all three theme states, In Progress dot / KPI bar segment / chip: system-default and explicit dark all rgb(224, 168, 63) = #E0A83F with chip background rgb(36, 29, 18) = #241D12; explicit light all rgb(168, 114, 27) = #A8721B with chip background rgb(246, 236, 218) = #F6ECDA. No element computed rgba(0, 0, 0, 0). The other five statuses resolved to their original hexes in every block, and the stylesheet's own var(--st-done) at line 347 and var(--st-blocked) at line 396 still resolved."
      - "Integrity: public/app.js SHA-256 identical before and after (86dd5ed14eb815825112928623ff05fd3b68e03033a1a093f57f58cbbc226b6a), as is public/index.html; the sorted hex-literal multiset of styles.css is unchanged, so no colour value moved. git status shows no file modified beyond the pre-existing README.md / index.html / styles.css working-tree state."
      - "index.md and kanban.md were NOT regenerated, despite this file's status moving to done — regeneration writes files outside this task's declared scope. The orchestrator should regenerate them."
  ```

## Skipped

None. `ISS-1` is the only open issue in `IL-1`, and it is a correction to existing behaviour
rather than functionality the app was never built to have, so it is actioned as task 1 above.

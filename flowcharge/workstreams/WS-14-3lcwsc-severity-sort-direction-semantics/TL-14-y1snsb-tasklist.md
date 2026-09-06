---
id: TL-14-y1snsb
type: tasklist
workstream: WS-14-3lcwsc
slug: severity-sort-direction-semantics
title: "Severity sort direction semantics fixes"
status: done
created: 2026-08-07
updated: 2026-08-07
depends_on: [IL-2-gbn2fu]
links: []
mode: spec
base_commit: 4110b3e
---

# PRX Tasks

## Severity sort direction semantics

Severity's "Ascending" direction currently shows the most-severe workstreams first (least-severe last), the reverse of what "Ascending" means for id/name/created/updated on the same shared Asc/Desc buttons. `severityCmp()` in `src/public/app.ts` reverses its operands (`y` before `x`) relative to the ordinary `a - b` convention every other sort key uses inline in `renderBoard()`. Inverting the operand order in `severityCmp()` makes Severity's Ascending mean "least-severe first" like every other key, with Descending now producing the "most-severe first" view. No other logic — the comparator's dispatch chain, `dominantSeverity()`, the per-card/sort-button severity dots, or the `sortDir === 'asc' ? cmp : -cmp` trailer — changes.

- [x] 1. Invert `severityCmp()`'s operand order in `src/public/app.ts`
  ```yaml
  description: "Fix severityCmp() so Severity's Ascending direction means least-severe-first, matching id/name/created/updated's Ascending convention on the same shared Asc/Desc buttons."
  issues: [ISS-2-gqq2pl]
  implement:
    - "In src/public/app.ts, function severityCmp(x, y) (currently lines 50-52), replace the reversed-operand body with the standard a-then-b convention every other sort key already uses inline in renderBoard() (wsIdNum(a.id) - wsIdNum(b.id), a.title.localeCompare(b.title), etc. at lines 162-165). See the SEARCH/REPLACE block below — this is the entire change."
  pattern: "src/public/app.ts"
  imports: "None — no new imports or dependencies. Self-contained change to one function body."
  compatibility: "severityCmp(a, b) is called exactly once, at renderBoard()'s sort comparator dispatch (line 166: `else cmp = severityCmp(sevMix![a.id], sevMix![b.id]);`), which feeds the shared `sortDir === 'asc' ? cmp : -cmp` trailer at line 167 — identical to how id/name/created/updated feed that same trailer. Neither the call site, the dispatch if/else chain, nor the trailer changes; only the sign convention inside severityCmp() flips, so the existing call composes correctly with no further edits."
  gotcha: "Do not touch dominantSeverity() (line 54) or SEV_ORDER (line 4) — WS-9's per-card severity dot (buildCard(), line 81) and WS-11's sort-button severity dot (line 451 and the counts-based dot at line 766) both call dominantSeverity() directly and never read severityCmp or sortDir, so they are unaffected by this change and must stay untouched. Do not touch the sortKey dispatch chain (lines 162-166) or the sortDir trailer (line 167) — only the two-line return statement inside severityCmp() changes. Do not add a UI label or indicator for the direction change; the fix is behavioral only, aligning Severity with the existing unlabeled Asc/Desc buttons."
  verify:
    - "npx tsc -p tsconfig.json --noEmit"
    - "npx tsc -p src/public/tsconfig.json --noEmit"
    - "npm run build"
  checklist:
    - "Severity + Ascending shows the workstream with the fewest/least-severe open issues first and the most-severe last, within each status column"
    - "Severity + Descending shows the inverse: most-severe open issues first, least-severe/none last"
    - "Artefact ID, Name, Created, and Updated sort behavior is unchanged for both Ascending and Descending"
    - "WS-9's per-card severity dot (buildCard()) and WS-11's sort-button severity dot are visually unaffected, since neither reads severityCmp or sortDir"
    - "No other line in src/public/app.ts changed besides severityCmp()'s return statement"
  self_eval:
    passed: true
    failures: []
    note: "Directly confirmed live in a real browser (127.0.0.1:4173), not by code trace. Fixture: WS-4 given 1 open critical, WS-6 given 1 open medium, all others zero. Severity+Asc now puts WS-4 (critical) and WS-6 (medium) LAST, with all zero-severity workstreams first (checklist item 1). Severity+Desc correctly inverted this, showing WS-4 then WS-6 first (checklist item 2) -- matching how every other key's Desc already means 'biggest/most-recent first'. Artefact ID+Desc still produced correct descending numeric order, confirming id/name/created/updated are unaffected (checklist item 3). WS-4's and WS-6's per-card severity dots (WS-9) stayed their correct critical-red/medium-amber colours throughout, and the sort-button dot (WS-11) correctly showed 'Critical' -- both unaffected, confirming checklist item 4. git diff confirmed only severityCmp()'s two-line body changed (checklist item 5). Fixture reverted and confirmed byte-identical via diff and md5 before this was marked passed."
  ```

  ```typescript
  src/public/app.ts
  <<<<<<< SEARCH
  function severityCmp(x: SevMix, y: SevMix) {
    return (y.critical - x.critical) || (y.high - x.high) || (y.medium - x.medium) || (y.low - x.low);
  }
  =======
  function severityCmp(x: SevMix, y: SevMix) {
    return (x.critical - y.critical) || (x.high - y.high) || (x.medium - y.medium) || (x.low - y.low);
  }
  >>>>>>> REPLACE
  ```

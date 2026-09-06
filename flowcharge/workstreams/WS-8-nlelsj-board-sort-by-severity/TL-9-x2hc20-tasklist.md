---
id: TL-9-x2hc20
type: tasklist
workstream: WS-8-nlelsj
slug: board-sort-by-severity
title: "Rank workstreams by open-issue severity as a third board sort key"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: [PLN-8-7whjuj]
links: []
mode: spec
base_commit: 817802a
---

# PRX Tasks

## Rank workstreams by open-issue severity as a third board sort key

Implements PLN-8. Adds a third `data-key="severity"` pill to `#sort-key-seg` in
`src/public/board.html`, and a third branch in `renderBoard()`'s comparator in `src/public/app.ts`
that ranks workstreams by a lexicographic tuple of open-issue counts (critical, then high, then
medium, then low), computed once per render into a `sevMix` lookup rather than per pairwise
comparison. "Open" reuses the exact `status === 'ready' || status === 'in-progress'` check already
used by `renderKpis()` (app.ts:618) and `renderSeverity()` (app.ts:693) — no new definition, no new
fetch, no server-side change. The plan's single stage maps to the one parent task below, with one
child per touched file plus a manual-verification child, in the plan's own order.

- [x] 1. Stage 1 — Severity as a third sort key
  ```yaml
  description: "Add the Severity sort pill, its comparator branch, and manually verify against temporary fixture data, per PLN-8's single stage."
  ```

  - [x] 1.1 Markup: add the Severity pill
    ```yaml
    description: "Add a third data-key=\"severity\" button to #sort-key-seg in board.html."
    issues: []
    implement:
      - "File: src/public/board.html. In #sort-key-seg (current lines 33-36), append a third button after the existing data-key=\"name\" button, matching the two existing buttons' markup style (no class — only the initially-active id pill carries class=\"active\")."
      - |
        <<<<<<< SEARCH
            <div class="seg" id="sort-key-seg">
              <button data-key="id" class="active">Artefact ID</button>
              <button data-key="name">Name</button>
            </div>
        =======
            <div class="seg" id="sort-key-seg">
              <button data-key="id" class="active">Artefact ID</button>
              <button data-key="name">Name</button>
              <button data-key="severity">Severity</button>
            </div>
        >>>>>>> REPLACE
    pattern: "src/public/board.html"
    imports: "None."
    compatibility: "The click handler at app.ts:157-163 reads btn.dataset.key generically and needs no change to recognise the new value. .seg / .seg button (styles.css:238-247) size to content with no fixed-width or child-count assumption — no CSS change needed or in scope."
    gotcha: "Ordering matters: the new button must be appended after Name, not before Artefact ID or between the two existing ones, to match the plan's specified pill order."
    verify:
      - "npm run build"
      - "Reload the board in a browser and confirm a third \"Severity\" pill renders in #sort-key-seg and is clickable (it will not yet change ordering until task 1.2 lands)."
    checklist:
      - "Exactly one new <button data-key=\"severity\">Severity</button> line added, after the Name button."
      - "The two existing buttons and their attributes are unmodified."
      - "npm run build completes with zero errors."
      - "No CSS file touched."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Logic: severity-mix precompute + comparator branch
    ```yaml
    description: "Add the SevMix type, the per-render sevMix precompute, severityCmp, and the three-way comparator dispatch in app.ts."
    issues: []
    implement:
      - "File: src/public/app.ts. Anchor: the module-scope state block (current lines 9-15, `var sortKey ... var polling = false;`). Add a module-scope `type SevMix = { critical: number; high: number; medium: number; low: number };` and `var sevMix: Record<string, SevMix> | null = null;` alongside the existing `sortKey`/`sortDir`/`workstreams`/`issues` state — it survives re-renders the same way they do."
      - "Anchor: renderBoard() (current lines 115-155), at its top, before the `STATUS_ORDER.forEach(function (status) { ... })` loop (current line 125). Insert the precompute block, run only when sortKey === 'severity': seed every workstream id to {critical:0,high:0,medium:0,low:0} by walking `workstreams`, then walk `issues` once, skipping any issue whose status is not 'ready'/'in-progress' (identical check to app.ts:618/693), and increment the matching tier on `sevMix[issue.workstream]` when `issue.severity` is a known tier key. This must run once per renderBoard() call, not per status column and not per pairwise comparison — matching the plan's own illustrative code:"
      - |
        if (sortKey === 'severity') {
          sevMix = {};
          workstreams.forEach(function (w) { sevMix![w.id] = { critical: 0, high: 0, medium: 0, low: 0 }; });
          issues.forEach(function (i) {
            if (i.status !== 'ready' && i.status !== 'in-progress') return;
            var mix = i.severity != null ? sevMix![i.workstream] : null;
            if (mix && mix[i.severity as keyof SevMix] !== undefined) mix[i.severity as keyof SevMix]++;
          });
        }
      - "Anchor: add a `severityCmp(x: SevMix, y: SevMix)` function near the other pure per-key comparison helpers (e.g. beside `wsIdNum`, current line 46). It must return `(y.critical - x.critical) || (y.high - x.high) || (y.medium - x.medium) || (y.low - x.low)` — operands reversed (y minus x) relative to the id/name branches' `a - b`, so that the shared `sortDir === 'asc' ? cmp : -cmp` trailer keeps working unmodified for all three keys while 'Asc' still means most-severe-first for this key alone."
      - "Anchor: the comparator inside `items.sort(...)` (current lines 129-134). Change the unconditional `else` (today's implicit 'name' branch) into an explicit `else if (sortKey === 'name')`, and add `else cmp = severityCmp(sevMix![a.id], sevMix![b.id]);` as the final branch. The `return sortDir === 'asc' ? cmp : -cmp;` trailer is untouched."
      - |
        items.sort(function (a, b) {
          var cmp;
          if (sortKey === 'id') cmp = wsIdNum(a.id) - wsIdNum(b.id);
          else if (sortKey === 'name') cmp = a.title.localeCompare(b.title);
          else cmp = severityCmp(sevMix![a.id], sevMix![b.id]);
          return sortDir === 'asc' ? cmp : -cmp;
        });
    pattern: "src/public/app.ts"
    imports: "None — no new types in praxis-data.d.ts, no new fetch/route (PraxisIssue already carries severity, status, workstream per src/types/praxis-data.d.ts:29-36)."
    compatibility: "src/public/tsconfig.json targets es2020 with module: \"none\" — dist/public/app.js must remain a classic script (no import/export). Array.prototype.sort's es2020 stability guarantee is what satisfies the all-zero/tied tie-break; no synthetic secondary key is added, matching id/name having none."
    gotcha: "sevMix must be seeded from workstreams (not only from issues) so a workstream with zero open issues in every tier — including one with no issue list at all — naturally gets an all-zero entry rather than an undefined lookup, which is what makes it fall to the least-urgent end without a special case. Do not recompute sevMix inside the STATUS_ORDER.forEach per-column loop — it is global across all workstreams, computed once per renderBoard() call."
    verify:
      - "npx tsc -p tsconfig.json --noEmit"
      - "npx tsc -p src/public/tsconfig.json --noEmit"
      - "npm run build"
      - "grep -E \"^\\s*(import|export)\\s\" dist/public/app.js — must return no matches, confirming app.js is still a classic script."
    checklist:
      - "SevMix type and sevMix var declared at module scope, not inside renderBoard()."
      - "sevMix precompute walks workstreams first (seeding every id to zero) then issues once, using status === 'ready' || status === 'in-progress' as the only open check — no second open/closed definition introduced."
      - "severityCmp compares (y - x), not (x - y), on all four tiers in critical, high, medium, low order."
      - "The id and name branches' code and the sortDir trailer are byte-for-byte unchanged."
      - "Both tsc -p projects and npm run build complete with zero errors."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Manual verification against fixture data
    ```yaml
    description: "Confirm PLN-8 acceptance criteria 2, 5, 6, 7, 8 by eye using temporary fixture edits, then revert them."
    issues: []
    implement:
      - "No source-code changes. Per PLN-8 Assumption 6, this project's own flowcharge/ has zero open issues project-wide today, so real reordering cannot be observed without temporary fixture data."
      - "Temporarily edit one or two issues' status to ready (or in-progress) and vary severity across at least two different workstreams' issue lists under flowcharge/workstreams/*/issuelist*.md — enough spread to produce a visible, non-trivial severity ranking (e.g. one workstream with a critical, one with only highs, one left at zero)."
      - "With the temporary data in place: run npm run build, load the board, click Severity + Asc and confirm the most-severe workstream (most open criticals, ties broken by high/medium/low) sorts first within its status column and any all-zero workstream sorts last (criteria 4, 5)."
      - "Click Desc and confirm the order inverts — no-data/least-severe rises to the top (criterion 6)."
      - "Switch to Artefact ID, then Name, then back to Severity, and confirm id/name ordering and semantics are exactly as before this feature (criterion 7)."
      - "Re-render the same underlying data (e.g. reload) and confirm two workstreams with an identical severity mix, including two both all-zero, keep the same relative order across renders (criterion 8)."
      - "Revert every temporary fixture edit (git checkout — or git restore — on the touched issuelist files) and confirm git status is clean before considering this stage done."
    pattern: "flowcharge/workstreams/*/issuelist*.md (temporary edits only, reverted before completion); no src/ file is touched by this task."
    imports: "None."
    compatibility: "Fixture edits must be reverted — this task must leave the repository's tracked flowcharge/ content unchanged; only task 1.1 and 1.2's src/ changes should remain in the working tree afterward."
    gotcha: "Forgetting to revert the fixture edits would leave fabricated open issues in the project's real flowcharge/ data. Confirm with git status (or git diff --stat) that no issuelist file shows as modified before marking this task complete."
    verify:
      - "git status --short flowcharge/ — must show no changes once the walkthrough is complete."
      - "npm run build — still zero errors after the revert, confirming no source file was inadvertently left mid-edit."
    checklist:
      - "Severity + Asc puts the most-open-critical workstream first and an all-zero workstream last, within its status column (criteria 4, 5)."
      - "Severity + Desc inverts that order (criterion 6)."
      - "Artefact ID and Name sorting are unchanged after switching away from and back to Severity (criterion 7)."
      - "Two workstreams with an identical severity mix keep stable relative order across a re-render (criterion 8)."
      - "All temporary fixture edits are reverted; git status on flowcharge/ is clean."
    self_eval:
      passed: true
      failures: []
      note: "Directly confirmed live in a real browser (127.0.0.1:4173), not by code trace. Fixture data: WS-6 given 1 open critical, WS-3 given 3 open high, WS-4's existing ISS-1 temporarily flipped to 1 open high, WS-1/WS-2/WS-5/WS-7 left at zero — all within the Done column. Severity+Asc rendered exactly WS-6, WS-3, WS-4, then the four all-zero workstreams in stable order (criteria 4, 5) — confirming a single critical outranks three highs, per the plan's own worked example. Severity+Desc rendered the exact reverse, with the all-zero group's relative order unchanged between Asc/Desc (correct stable-sort tie behaviour, criterion 6). Switching to Artefact ID (correct numeric order) and back to Severity reproduced the identical Asc ordering (criterion 7). The Severity+Asc re-check after switching away and back is itself a second independent render of the same data, and produced an identical order both times (criterion 8). All fixture edits reverted and confirmed byte-identical to their pre-edit content via diff and md5 (not via git status, which is meaningless for gitignored flowcharge/) before this was marked passed."
    ```

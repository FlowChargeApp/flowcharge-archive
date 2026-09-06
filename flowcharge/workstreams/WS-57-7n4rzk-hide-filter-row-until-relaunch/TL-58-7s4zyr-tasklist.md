---
id: TL-58-7s4zyr
type: tasklist
workstream: WS-57-7n4rzk
slug: hide-filter-row-until-relaunch
title: "Hide the filter row until relaunch"
status: done
created: 2026-08-22
updated: 2026-08-22
author: Anthony Koukoullis
depends_on: [PLN-47-6kx579]
links: []
mode: spec
base_commit: 6c14319
---

# PRX Tasks

## Hide the filter row until relaunch

The board's filter row (WS-54) must not appear at launch. It is hidden by suppressing the
one statement that reveals it, not by removing anything WS-54 built.

`src/public/board.html:50` already ships the row with the `hidden` attribute, and
`src/public/styles.css:136` makes that attribute authoritative with
`[hidden] { display: none !important; }`. One statement at `src/public/app.ts:482` clears
the attribute at wiring time. That statement is the whole reveal.

This task list adds one named module constant, `FILTER_ROW_ENABLED`, beside the existing
`TAG_*` constants at `src/public/app.ts:26-28`, and guards that one statement with it.
Markup, CSS, chip building, click handling, and filter state all stay exactly as WS-54
left them. Re-enabling is one edit: set the constant to `true`.

The plan settled its open questions. `refreshFilterTags`, `syncFilterActive`, `tagMatch`,
and the delegated click handler stay live and untouched. The constant is read in exactly
one place. Whether WS-56 later flips the constant or deletes it belongs to WS-56, not
here.

- [x] 1. Guard the filter row reveal behind `FILTER_ROW_ENABLED`
  ```yaml
  description: "Declare a FILTER_ROW_ENABLED module constant set to false, and guard the single #filter-chips reveal statement with it, so the filter row keeps its hidden attribute for the whole session."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Open src/public/app.ts. Anchor 1 is the filter chip threshold constant block that ends with the line `  var TAG_MAX_CHIPS = 10;` (line 28 at base_commit 6c14319), immediately before the blank line and the `// module (IIFE) scope` comment."
    - "Directly after `  var TAG_MAX_CHIPS = 10;`, add a comment and one new constant, at the same two-space indent and in the same upper-case style as the TAG_* constants. The comment must name WS-57 as the workstream that hides the row and WS-56 as the workstream whose fixes it waits on, and must state that this constant is the only switch. Illustrative, not literal: `// WS-57: the filter row is built and wired but stays hidden until WS-56's` / `// fixes land. Set to true to reveal it again — this is the only switch.` / `var FILTER_ROW_ENABLED = false;`"
    - "Anchor 2 is the reveal statement `  byId('filter-chips').hidden = false;` (line 482 at base_commit 6c14319), preceded by the two-line comment that begins `// The row ships hidden in board.html`. Guard that one assignment with `if (FILTER_ROW_ENABLED)`, keeping it a single statement so the reveal path stays one greppable place."
    - "Keep the existing two-line comment above the reveal and extend it to say why the reveal is now suppressed. Do not delete or reword the part that explains why the row ships hidden in the markup."
    - "Read FILTER_ROW_ENABLED nowhere else. Do not gate refreshFilterTags (src/public/app.ts:327), syncFilterActive (src/public/app.ts:316), the delegated click handler (src/public/app.ts:460), or tagMatch (src/public/app.ts:117). Leaving those paths live is what makes the flip back exact."
    - "Change no other file. Do not touch src/public/board.html, src/public/styles.css, the README, or any server or extract code."
  pattern: "src/public/app.ts only. One added constant near the top of the IIFE, and one guarded statement at the wiring site. No other file in the repository changes."
  imports: "None. No package, module, or component is added. src/public/app.ts compiles as a classic script under src/public/tsconfig.json, so it can neither import nor export."
  compatibility: "Follow the file's existing conventions: `var` declarations inside the IIFE, upper-case names for behaviour constants (POLL_MS, TAG_MIN_COUNT, TAG_MAX_SHARE, TAG_MAX_CHIPS), two-space indent. Reuse the app's existing hide idiom — the `hidden` attribute plus the global `[hidden] { display: none !important; }` rule at src/public/styles.css:136 — rather than adding a new hiding mechanism. src/public/app.ts is the only copy of this logic: electron/main.cts:29 points the desktop window at the same local server that serves the browser pages, so one build covers both surfaces."
  gotcha: "Four things can go wrong. First, leaving the constant `true` after testing the flip — it must be `false` in the committed file. Second, adding a second read of the constant, which creates a second thing for WS-56 to unwind. Third, a future cleanup pass deleting a constant that looks unused, which is why the comment must state the intent in live code. Fourth, hiding the row with a CSS rule or by deleting the statement instead of guarding it — both were considered and rejected in the plan, because they split the switch across files or force WS-56 to rebuild working code."
  verify:
    - "Run `npm run build`. It must complete with no TypeScript error."
    - "Run `npm start` and open a project board. Confirm the sticky controls bar shows the sort row, the search box, and the result count, and shows no filter row below them: no `Filter` label, no tag chips, no `Blocked only` button, no `Clear` button."
    - "In the browser dev tools element inspector, confirm `#filter-chips` still carries the `hidden` attribute, and still carries it after roughly 15 seconds of the 5-second poll cycle."
    - "Confirm the result count reads `N / N workstreams shown` with both numbers equal on first load, that every column holds its usual cards, and that the KPI blocked-count chip is unchanged."
    - "Confirm the browser console shows no new error and no new warning on board load."
    - "Set the constant to `true`, run `npm run build`, reload, and confirm the chips, `Blocked only`, and `Clear` all work as WS-54 shipped them. Set the constant back to `false`, rebuild, and confirm the row is hidden again before committing."
  checklist:
    - "Does `git diff --stat` show src/public/app.ts as the only changed file?"
    - "Does `grep -n FILTER_ROW_ENABLED src/public/app.ts` return exactly two lines — the declaration and the single guard?"
    - "Is the committed value of FILTER_ROW_ENABLED `false`?"
    - "Does the filter row stay invisible and keep its `hidden` attribute for the whole session, including after several poll cycles?"
    - "Do the sort row, the search box, the result count, and the KPI blocked-count chip behave exactly as they did before this change, with the board rendering every workstream unfiltered?"
    - "Does setting the constant to `true` and rebuilding restore WS-54's full filter behaviour with no other edit?"
  self_eval:
    passed: true
    failures:
      - item: "Does `grep -n FILTER_ROW_ENABLED src/public/app.ts` return exactly two lines — the declaration and the single guard?"
        reason: "The first draft of the extended comment above the reveal statement named FILTER_ROW_ENABLED in prose, so grep returned three lines instead of two."
        fix: "Reworded that comment to say 'the switch declared at the top of this file' instead of repeating the identifier. grep now returns exactly two lines: line 31 (declaration) and line 487 (guard)."
  ```

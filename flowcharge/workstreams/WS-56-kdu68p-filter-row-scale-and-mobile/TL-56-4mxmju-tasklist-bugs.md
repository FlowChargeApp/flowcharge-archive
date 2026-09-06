---
id: TL-56-4mxmju
type: tasklist
workstream: WS-56-kdu68p
slug: filter-row-scale-and-mobile
title: "Filter row tag-chip qualification defect"
status: ready
created: 2026-08-21
updated: 2026-08-21
author: Anthony Koukoullis
depends_on: [IL-10-gbgf7k]
links: []
mode: spec
base_commit: 6c14319
---

# PRX Tasks

## Filter row tag-chip qualification defect

The filter row builds its tag chips in `refreshFilterTags` in `src/public/app.ts`. A tag
earns a chip only when it passes two constraints at once: a count floor of
`TAG_MIN_COUNT` (2) and a relative share ceiling of `TAG_MAX_SHARE` (0.30). Both can
only hold together when `0.30 * N > 2`, that is when the all-time workstream count `N`
is 7 or more. Below that point the two constraints exclude every possible tag, so the
Filter label sits above a permanently empty chip area on any small project. The pin step
cannot rescue the row, because a tag that never draws a chip can never become active.

The fix corrects one boolean expression. The share ceiling stays exactly as it is
wherever it is mathematically satisfiable. Below that point the rule falls back to an
honest small-N reading of the same intent: exclude only a tag that every workstream
carries, because such a tag filters nothing out anyway. The result is byte-identical to
the current rule for every `N >= 7`, and it opens the chip row at small `N`.

The fix is deliberately one corrected expression, with no new constant, no new helper,
and no new branch structure. A separate "More tags" overflow feature in this same
workstream will later drop `TAG_MIN_COUNT` to 1 and make the ceiling moot. That feature
must be able to delete or replace this rule in one edit with no leftover. This bug fix
lands before that feature and stays independent of it.

- [ ] 1. Close the small-N dead zone in the tag-chip qualification rule

  ```yaml
  description: "Correct the tag-chip qualification expression in refreshFilterTags so small projects show chips for genuinely repeated tags, while behaviour at 7 or more workstreams stays identical."
  author: Anthony Koukoullis
  issues: [ISS-21-5ym0ei]
  implement:
    - "Open src/public/app.ts and find the function refreshFilterTags. Inside it, find the `var shown = Object.keys(counts).filter(...)` step that follows the PRUNE block and precedes the `shown.sort(...)` line. Its callback body is a single `return` statement that combines the TAG_MIN_COUNT floor with the TAG_MAX_SHARE ceiling. That one return statement is the defect and the only line to change."
    - "Keep the TAG_MIN_COUNT floor exactly as it is. Replace the relative share test with a comparison of the raw count against a ceiling value that is chosen at the current workstream count: use `TAG_MAX_SHARE * workstreams.length` when that product is greater than TAG_MIN_COUNT, and otherwise use `workstreams.length`. The reason is that the share ceiling is only satisfiable together with the floor once the product clears the floor. Below that point the fallback excludes only a tag carried by every workstream, which is the honest small-N form of the same intent."
    - "Illustrative form only, not a literal block — adapt the exact syntax, spacing, and line breaks to the file as it reads now: `return counts[k] >= TAG_MIN_COUNT && counts[k] < (TAG_MAX_SHARE * workstreams.length > TAG_MIN_COUNT ? TAG_MAX_SHARE * workstreams.length : workstreams.length);`"
    - "Add no new constant, no new helper function, and no new conditional branch structure beyond this one expression. Leave the TAG_MIN_COUNT, TAG_MAX_SHARE, and TAG_MAX_CHIPS declarations unchanged, leave the comment block above them unchanged, and leave the PRUNE, sort, slice, PIN, and GUARD steps untouched."
  pattern: "src/public/app.ts only — the qualification filter inside refreshFilterTags. No other file changes."
  imports: "None. The change uses only identifiers already in scope in the same IIFE: counts, workstreams, TAG_MIN_COUNT, and TAG_MAX_SHARE."
  compatibility: "src/public/app.ts is browser code compiled by its own tsconfig at src/public/tsconfig.json, which npm run build invokes as its second step. The file style is ES5-era: var declarations and function expressions, no arrow functions, no const or let, no optional chaining. Match that style. The expression must stay a single boolean returned from the existing filter callback, so a later More tags feature can delete or replace it in one edit."
  gotcha: "The comparison changes from a share to a raw count, so the operator direction matters: the old test was `counts[k] / workstreams.length < TAG_MAX_SHARE`, and the corrected test compares counts[k] against a product, not a share. Do not convert one side and leave the other. The ceiling must stay strict (<), because the small-N fallback relies on a tag carried by every workstream failing the test. workstreams.length is the all-time count, not the filtered count, and must stay that way. refreshFilterTags is called from applyData only, never from renderBoard, so a wrong edit shows up on data load and not on a keystroke. Guard against a divide-by-zero style trap: at zero workstreams the filter runs over an empty counts map, so no tag is tested at all."
  verify:
    - "Before editing, start the app and record this repository's own current chip row from the board's Filter control. The expected baseline is the 10 chips electron(10), bug(9), ux(9), board(8), detail-modal(8), group1(7), server(7), agentic-tools(6), filesystem(6), group2(5)."
    - "Run `npm run build` and confirm it completes with no TypeScript error."
    - "Reload this repository's own board and confirm the chip row is byte-identical to the recorded baseline, proving no regression at large N."
    - "Build synthetic flowcharge/ fixtures at N=3 and N=6 in the scratch directory. Each workstream needs only a valid workstream.md with a tags frontmatter array, because src/lib/extract.ts reads tags verbatim. Give each fixture one tag on every workstream, one tag on roughly half, one tag on exactly two, and one singleton tag. Register the fixtures through .praxis-projects.json or the home page add-project form."
    - "Open the N=3 and N=6 fixture boards and confirm each shows chips for its repeated non-universal tags, hides only the universal tag, and shows no chip for the singleton tag."
    - "Build synthetic fixtures at N=7 and N=10 by the same method and confirm their chip rows match what the unpatched rule would produce, proving no regression at and above the dead-zone boundary."
    - "On the N=6 fixture, activate a tag chip, reload the page, and confirm the chip survives the reload and the board filters to the matching cards rather than to zero cards."
    - "Delete the synthetic fixture entries from the project registry and remove the scratch fixtures."
  checklist:
    - "Does this repository's own board still show the same 10 chips in the same order as the pre-edit baseline?"
    - "Does an N=6 project show chips for its tags carried by 2, 3, and 5 of the 6 workstreams, and hide only the tag carried by all 6?"
    - "Does an N=3 project show a chip for a tag carried by 2 of its 3 workstreams?"
    - "Do N=7 and N=10 projects produce the same chip set the unpatched rule produced?"
    - "Does an active tag on the N=6 fixture survive a reload and filter the board to matching cards instead of to zero cards?"
    - "Is the diff confined to the single qualification expression in refreshFilterTags, with no new constant, helper, or branch structure added anywhere?"
  self_eval:
    passed: false
    failures: []
  ```

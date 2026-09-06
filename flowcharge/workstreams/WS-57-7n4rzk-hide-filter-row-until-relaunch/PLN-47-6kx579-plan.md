---
id: PLN-47-6kx579
type: plan
workstream: WS-57-7n4rzk
slug: hide-filter-row-until-relaunch
title: "Suppress the filter row's reveal behind one build-time constant"
status: done
created: 2026-08-22
updated: 2026-08-22
depends_on: []
links: []
---

# Hide the filter row until relaunch

## Summary

The board's filter row (WS-54) must not appear at launch. It is hidden by suppressing the
one line that reveals it, not by removing anything WS-54 built.

`src/public/board.html:50` already ships the row with the `hidden` attribute, and
`src/public/styles.css:136` makes that attribute authoritative with
`[hidden] { display: none !important; }`. A single statement at `src/public/app.ts:482`
clears the attribute at wiring time. That statement is the whole reveal.

The plan adds one named module constant, `FILTER_ROW_ENABLED`, beside the existing
`TAG_*` constants at `src/public/app.ts:26-28`, and guards that one statement with it.
Markup, CSS, chip building, click handling, and filter state all stay exactly as WS-54
left them. Re-enabling is one edit: set the constant to `true`.

This plan implements nothing.

## Scope

### Acceptance criteria

1. A user who opens a project board sees no filter row: no `Filter` label, no tag chips,
   no `Blocked only` button, no `Clear` button.
2. `#filter-chips` keeps its `hidden` attribute for the whole session, including after
   the 5-second poll cycle at `src/public/app.ts` refreshes the data several times.
3. The board renders every workstream, unfiltered. The result count at
   `src/public/app.ts:436` reads `N / N workstreams shown` on first load.
4. The sort row, the search box, the result count, and the KPI blocked-count chip behave
   exactly as before this change.
5. No filter control is reachable by keyboard or by a screen reader, because
   `display: none` removes the row from the layout and the accessibility tree.
6. Setting `FILTER_ROW_ENABLED` to `true` and rebuilding restores WS-54's behaviour in
   full, with no other edit.
7. The browser console shows no new errors or warnings on board load.

### Out of scope

- The KPI blocked-count chip. It is a separate WS-54 feature and is untouched.
- Anything in WS-55's or WS-56's scope, including WS-56's dead-zone bug, the overflow
  popover, and the mobile rail.
- Deleting or editing the row's markup, its CSS, `refreshFilterTags`, `syncFilterActive`,
  `tagMatch`, or the delegated click handler.
- A user-facing setting, a URL parameter, or any runtime switch. The toggle is a source
  constant only.
- Any README or documentation edit. The README never mentions the filter row.

### Assumptions

- **A1 — Build-time constant, not a runtime setting.** The workstream asks for "a single
  toggle to flip back on". A source constant is that toggle. No preference storage, no
  query parameter.
- **A2 — One build covers every surface.** `electron/main.cts:29` points the desktop
  window at the same local server that serves the browser pages, so the compiled
  `dist/public/app.js` is the only copy. Hiding the row in `src/public/app.ts` hides it
  in the browser and in the packaged app together.
- **A3 — No release constraints apply.** The app is local, read-only against a project's
  `flowcharge/` folder, and holds no production data and no live users. Filter state is
  in-memory only, documented at `src/public/app.ts:34-38` as having no URL parameter and
  no storage, so hiding the row discards no saved user state. There is no migration, and
  the app stays shippable at every point because the change is one commit.
- **A4 — WS-56 owns the flip back.** This workstream hides the row. It does not schedule,
  automate, or pre-author the re-enable.

## Design

### The single change

`src/public/app.ts:480-482` currently reads:

```ts
  // The row ships hidden in board.html so it can land before it is wired. It is
  // wired now, so it becomes visible here.
  byId('filter-chips').hidden = false;
```

The design wraps that assignment in a guard on a new module constant declared with the
other filter constants at `src/public/app.ts:26-28`:

```ts
  // WS-57: the filter row is built and wired but stays hidden until WS-56's
  // fixes land. Set to true to reveal it again — this is the only switch.
  var FILTER_ROW_ENABLED = false;
```

The guard keeps the existing comment and reads as one statement, so the reveal path stays
a single, greppable place.

### What this touches and what it must not touch

The constant knows one thing: whether the row is revealed at wiring time. It must not be
read anywhere else. In particular it must not gate `refreshFilterTags`
(`src/public/app.ts:327`), `syncFilterActive` (`src/public/app.ts:316`), the delegated
click handler (`src/public/app.ts:460`), or `tagMatch` (`src/public/app.ts:117`). Those
paths stay live and untouched, which is what makes the flip back exact.

### Why the hidden row is inert

- The chips are still built into `#filter-tags`, inside a `display: none` subtree. That
  costs a few DOM nodes and no layout work, and it guarantees the row is correct the
  moment the constant flips.
- `activeTags` and `blockedOnly` (`src/public/app.ts:37-38`) can only change through the
  delegated click handler on `#filter-chips`. A `display: none` element receives no
  clicks and holds no focusable children, so both stay at their initial empty and `false`
  values. `tagMatch` therefore returns true for every workstream and the board is
  unfiltered.
- The `PRUNE` and `PIN` steps in `refreshFilterTags` operate on an always-empty
  `activeTags`, so they are no-ops.

### Reused patterns

- The `hidden` attribute plus the global `[hidden] { display: none !important; }` rule at
  `src/public/styles.css:136` is the app's existing hide idiom, used for `#lower`,
  `#branch-line`, and the modal panels. This change does nothing new; it only stops
  removing the attribute.
- Naming a behaviour constant in upper case at the top of the IIFE follows the existing
  `TAG_MIN_COUNT`, `TAG_MAX_SHARE`, `TAG_MAX_CHIPS`, and `POLL_MS` convention.

## Staged task breakdown

One phase, one task. The change is a single guarded statement and cannot be sliced
smaller.

### Phase 1 — Guard the reveal

- **What to build:** Declare `FILTER_ROW_ENABLED = false` with a comment naming WS-57 and
  WS-56, beside the `TAG_*` constants at `src/public/app.ts:26-28`. Guard the reveal
  statement at `src/public/app.ts:482` with it, keeping the existing explanatory comment
  and extending it to say why the reveal is suppressed.
- **Files touched:** `src/public/app.ts` only.
- **Effort:** small.
- **Dependencies:** none.
- **Verify:**
  1. Run `npm start` and open a project board. The sticky controls bar shows the sort row,
     the search box, and the result count, and no filter row below them.
  2. In the browser dev tools, confirm `#filter-chips` still carries `hidden`, and that it
     still carries it after roughly 15 seconds of polling.
  3. Confirm the result count reads `N / N workstreams shown` and that every column holds
     its usual cards.
  4. Confirm the console is clean and the KPI blocked-count chip is unchanged.
  5. Set the constant to `true`, rebuild, and confirm the chips, `Blocked only`, and
     `Clear` all work as WS-54 shipped them. Set it back to `false` before committing.

## Data & compatibility

There is no data model change, no API change, no schema change, and no migration. The
server, `src/lib/extract.ts`, and the payload types are untouched. The filter state was
never persisted, so no stored user state is invalidated.

**Rollback:** set `FILTER_ROW_ENABLED` to `true` and rebuild, or revert the single commit.
The change is reversible at every point, with no partial state.

## Testing strategy

The repository has no test framework and no `test` script in `package.json`, so this
change is verified by the manual steps in Phase 1 rather than by automated tests. Adding a
first test harness for a one-constant change is out of proportion and out of scope.

If a browser-level test suite is added later, the natural assertions are: `#filter-chips`
retains `hidden` after load with the constant `false`, and loses it with the constant
`true`. Those belong to a test-writing pass, not to this workstream.

## Open questions

1. **Should `refreshFilterTags` also be skipped while the row is hidden?** Options: leave
   it running as planned, or guard it with the same constant. Recommendation: leave it
   running. It costs a handful of DOM nodes under a `display: none` node, and skipping it
   would add a second read of the constant and a second thing to unwind later.
2. **When WS-56 lands, does it flip the constant to `true` or delete the constant and the
   guard?** Options: flip and keep the switch, or remove both and restore the original
   bare statement. Recommendation: remove both in WS-56's final task, so no dead switch
   survives. This question belongs to WS-56's scope, so it is recorded, not decided here.
3. **Should the hidden row keep building chips for a project with no qualifying tags?**
   This is only a question if question 1 is answered the other way. Recommendation: no
   action; WS-56 owns the dead-zone behaviour.

## Alternatives considered and rejected

- **Comment out the reveal statement.** Equally one line to reverse, but it leaves no
  named symbol to grep and no stated intent in live code. A commented-out statement reads
  as debris and invites deletion by a later cleanup pass, which would make the reveal
  unrecoverable without reading history.
- **Hide the row with a CSS rule**, such as `.controls .filter-chips { display: none }` in
  `src/public/styles.css`. Rejected because it puts the switch in a different file from the
  logic that governs the row's visibility, and duplicates a mechanism the app already has
  in the `hidden` attribute. Two places would then decide whether the row shows.
- **Remove the reveal statement and the markup.** Rejected by the workstream brief. It
  would force WS-56 to reconstruct code that already exists and works.
- **Put the row behind a user-facing toggle or a collapsed panel.** Rejected as scope the
  brief does not ask for, and WS-56's review explicitly warns that a hidden active filter
  with an empty-looking board is the main confusion risk of any toggle.
- **Delete the `hidden` attribute from the markup and add it back in script.** Rejected as
  a net-worse inversion: it would flash the row before the script runs.

## Final summary

- **Approach:** guard the one reveal statement at `src/public/app.ts:482` with a new
  `FILTER_ROW_ENABLED = false` constant, so `#filter-chips` never loses its `hidden`
  attribute.
- **Size:** one phase, one small task, one file.
- **Risks:** all low. The main ones are forgetting to leave the constant `false` after
  testing the flip, and a future cleanup pass deleting a constant that looks unused.
- **Needs a decision:** whether `refreshFilterTags` should also be skipped while hidden
  (recommend no), and whether WS-56 flips the constant or removes it entirely (recommend
  removes, but that is WS-56's call).

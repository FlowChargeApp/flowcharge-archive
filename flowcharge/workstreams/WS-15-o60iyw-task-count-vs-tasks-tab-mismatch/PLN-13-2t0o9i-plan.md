---
id: PLN-13-2t0o9i
type: plan
workstream: WS-15-o60iyw
slug: task-count-vs-tasks-tab-mismatch
title: "Child-count cue on collapsed parent rows in the Tasks tab"
status: done
created: 2026-08-07
updated: 2026-08-08
depends_on: []
links: []
---

# Child-count cue on collapsed parent rows in the Tasks tab

## Summary

Add one inline text span to the `<summary>` row of every collapsed parent task in the
detail modal's Tasks tab, reading `N subtasks` (or `1 subtask`). The span states how
many children that row hides, so a reader can add the visible rows to the visible cue
numbers and land on the tab's own label.

The cue is built in `buildTaskGroup()` (`src/public/app.ts:357`), which is the only
place a parent group is made. `renderTasksPanel()` (`src/public/app.ts:404-406`) calls
it only when `task.children.length` is non-zero, so a leaf top-level row cannot receive
the cue and no new branch is needed to prevent it. The number comes from
`task.children.length`, which `buildTaskTree()` (`src/lib/detail.ts:113-144`) already
guarantees by throwing when parents plus children do not equal the flat count.

This is a client-side presentation change only. No package, no server route, no wire
shape, no extraction change, and no change to `countTasks()` or the tab label.

The user-visible arithmetic the feature delivers, and the thing to check by eye:

> top-level rows visible at rest + sum of the cue numbers = the number in the tab label

For LAD's WS-124 that is 4 rows with child counts `[2, 0, 16, 2]`, so `4 + 20 = 24`,
which is exactly what `countTasks()` produces.

## Scope

### Acceptance criteria

1. Opening a workstream whose task list has parent tasks shows, on each collapsed
   parent row and after the title, a cue reading the parent's child count.
2. A parent with exactly one child reads `1 subtask`. A parent with more than one
   reads `N subtasks`.
3. A top-level task with no children shows no cue at all — not `0 subtasks`, and not an
   empty element.
4. The cue text is derived from `task.children.length` only. It does not change when a
   row is expanded or collapsed.
5. Adding the visible top-level row count to the sum of the visible cue numbers equals
   the number in the `Tasks (N)` tab label, for every workstream.
6. The tab label text is byte-for-byte unchanged, and `countTasks()` is unchanged.
7. The Issues tab renders exactly as it does today. No issue row gains a cue.
8. The existing accent tint on a parent's task number and the native `<details>`
   disclosure marker both still render, unchanged.
9. `npm run build` completes with no error, and `dist/public/app.js` still contains no
   `import` or `export` statement.
10. The cue is legible in light and dark themes without any new CSS custom property.

### Out of scope

- The Issues tab. It shares `buildItem()` and the `.ws-item` styling, but the change
  lands in `buildTaskGroup()`, which the Issues tab never calls.
- Any change to the tab label, to `countTasks()`, or to `countChecks()` in
  `src/lib/extract.ts:31-42`.
- Any change to `src/lib/detail.ts`, the extraction pipeline, `src/server.ts`, or
  `src/types/praxis-data.d.ts`.
- The `collectItems()` parser defect. It belongs to WS-16 and ISS-3.
- Showing completion inside the cue, for example `2/5 done`. See Rejected alternatives.
- Adding a test framework or a lint script to the repository.

### Assumptions

These are assumptions, not confirmed requirements. Each is cheap to reverse.

1. **Release constraints.** The dashboard is a local, single-user, read-only tool bound
   to `127.0.0.1`. It has no production data, no live users, no persisted server state,
   and `dist/` is gitignored and rebuilt on every `npm start`. So no feature flag, no
   dark launch, and no migration are planned. Rollback is `git revert` of one commit.
2. **Wording.** The cue says `subtask` / `subtasks`. This is one string literal in one
   line of `buildTaskGroup()`. Changing it later costs one edit and a rebuild.
3. **Placement.** The cue sits after the title, inline, in the same `<summary>` row.
   It is not right-aligned. `.ws-item-summary` uses `display: list-item`
   (`src/public/styles.css:707`) to keep the native disclosure marker, and switching
   that to flex to allow right-alignment would put the marker at risk. The comment at
   `src/public/styles.css:701` records that the marker is deliberate.
4. **Visibility when expanded.** The cue stays visible after the parent is expanded,
   because it lives in the summary row and hiding it would need extra CSS for no
   stated benefit.
5. **Accessibility.** The cue is plain text inside `<summary>`, so it joins the
   disclosure control's accessible name and is announced without any ARIA attribute.
   No `aria-label` is planned.

## Design

### Where it attaches

One function and one stylesheet rule change. Nothing else.

**`src/public/app.ts`, `buildTaskGroup()` at line 357.** The summary row is built at
lines 359-363 from three `el()` spans. A fourth span is appended after
`ws-item-title`:

```ts
var n = task.children.length;
sum.appendChild(el('span', 'ws-task-count', n + (n === 1 ? ' subtask' : ' subtasks')));
```

The string is built inline rather than in a helper, because there is exactly one call
site. The inline ternary matches the file's existing style in the same function, where
the check glyph is chosen with `task.checked ? '✓' : '○'` at line 360.

No guard on `n === 0` is added. `renderTasksPanel()` at lines 404-406 is the sole
caller and already branches on `task.children.length`, so a zero can never reach here.
The plan calls for a one-line comment recording that invariant, in the style of the
existing comments at lines 352-356 and 401-403, rather than a defensive branch that
would duplicate the caller's decision.

**`src/public/styles.css`.** One new rule, placed immediately after the existing
parent-group rule `.ws-task-group > .ws-item-summary .ws-item-id` at line 793, so all
parent-group summary styling stays in one block:

```css
.ws-task-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ink-faint);
  margin-left: 8px;
  white-space: nowrap;
}
```

Four grounded choices here:

- `var(--ink-faint)` is an existing token, already defined in all three theme blocks
  (`:root`, `@media (prefers-color-scheme: dark)`, and `:root[data-theme="dark"]`). A
  new token would cost three edits and give nothing. This is the same token
  `.column-head .count` (line 302) and `.result-count` (line 265) already use for
  count text, so the cue reads as the same class of information as the board's other
  counts.
- `var(--font-mono)` at 11px matches `.ws-item-id` in the same row (lines 720-726)
  rather than the 11.5px of `.column-head .count`, because the cue's neighbours in
  that row set the scale.
- `white-space: nowrap` stops `3` and `subtasks` splitting across lines when a long
  title wraps. `.ws-item-title` already carries `overflow-wrap: anywhere`, so wrapping
  is a real case.
- The selector is flat, not scoped under `.ws-task-group`, matching how `.ws-check`,
  `.ws-item-id` and `.ws-item-title` are written. The class appears in exactly one
  place in the code.

### What this module knows and must not know

`buildTaskGroup()` already receives a whole `PraxisTaskDetail` and already reads
`task.children` to build the child rows. Reading `task.children.length` for the cue
adds no new knowledge and no new coupling. It must NOT:

- read or recompute the tab label — `setTabLabels()` (line 244) and `countTasks()`
  (line 417) stay untouched, so the two numbers cannot drift by anything this change
  does;
- reach into `list.tasks` or any sibling task — the cue is about this row only;
- know anything about issues — `buildItem()` (line 316) is shared with the Issues tab
  and is not modified.

### Approach chosen, and alternatives rejected

**Chosen: an inline text span built in TypeScript.** It fits the file's existing shape
(every visible string in this modal is created with `el()`), it is styleable and
spaceable on its own, it survives theme switching through an existing token, and it is
exposed to assistive technology as ordinary text.

**Rejected — CSS generated content.** Put the number in a `data-children` attribute and
render it with `.ws-task-group > summary::after { content: attr(data-children) " subtasks"; }`.
Rejected on three grounds: `styles.css` contains no `content:` declaration today (the
only matches for that substring are `justify-content`), so it would introduce a new
mechanism for one cue; singular and plural would need a second attribute or a duplicated
rule; and generated content is exposed inconsistently to assistive technology.

**Rejected — fold the count into the title string.** Pass `task.title + ' (' + n + ')'`
into the existing title span. Rejected because it fuses a derived number into a text
node that currently holds the file's own title verbatim. The comment at
`src/public/app.ts:426` records that displayed values are the file's values, and the
fused string could not be styled or spaced separately.

**Rejected — a filled pill badge reusing `.tag`.** Rejected because `.tag`
(`src/public/styles.css:338-346`) is the board card's tag vocabulary, with an
`--accent-soft` background. Reusing it for a count would give the same visual language
two meanings, and a filled pill would over-decorate a row that already carries a
disclosure marker, a status glyph and an accent-tinted number.

**Rejected — a completion fraction such as `2/5 done`.** Context asks for a
child-count cue, and a fraction is a different feature that would also raise the
question of which number reconciles with the tab. Out of scope under YAGNI.

## Staged task breakdown

### Phase 1 — Build the cue (small)

**What to build.** The four-line change described in Design: the new span in
`buildTaskGroup()` with its invariant comment, and the `.ws-task-count` rule in
`styles.css`.

**Files touched.** `src/public/app.ts`, `src/public/styles.css`.

**Dependencies.** None.

**Verify.**

1. `npm run build` completes with no error. `src/public/tsconfig.json` sets
   `noEmitOnError: true` and `module: "none"`, so a type error or a stray `import`
   fails the build rather than shipping.
2. `npm start`, then open this repository's own board and open the
   `card-detail-modal-issues-tasks` workstream. Its task list has parent child counts
   `[9, 5, 7, 4]`, so four rows show `9 subtasks`, `5 subtasks`, `7 subtasks` and
   `4 subtasks`, and `4 + 25 = 29` matches the tab label.
3. Open the `git-branch-display` workstream. Its counts are `[3, 2, 0]`, so two rows
   carry a cue and the third, a leaf, carries none. This is criterion 3.

### Phase 2 — Walk the range and the regressions (small)

**What to build.** Nothing. This is the manual walkthrough that stands in for the test
suite this repository does not have. Any defect it finds is fixed in the same two files
as Phase 1.

**Files touched.** None, unless the walkthrough finds a defect.

**Dependencies.** Phase 1.

**Verify.** Against named, real fixtures. The LAD ones are read-only — open them in the
dashboard, never edit them.

1. **The reported case.** LAD `WS-124-service-reference-inconsistencies-issue-list`.
   Child counts are `[2, 0, 16, 2]`. Four rows at rest, three cues, one leaf with none,
   and `4 + 20 = 24`, which is the `Tasks (24)` label that started this workstream.
2. **Singular.** LAD `WS-52-controllers-bug-hunt-round-3`. Counts are
   `[15, 8, 1, 3, 7, 2, 2]`. The third row must read `1 subtask`, not `1 subtasks`.
   This repository's own `flowcharge/` has no single-child parent, so this check needs the
   LAD fixture.
3. **The wide end.** LAD `WS-50-controllers-bug-hunt-round-1`, whose widest parent has
   35 children and which has 18 top-level rows including two leaves. Confirm the cue
   stays on one line and the row layout holds.
4. **Long titles.** In the same fixture, narrow the browser window until a parent title
   wraps. The cue must stay whole on one line and not split between its number and its
   word.
5. **Expanded state.** Expand a parent. The cue stays visible and unchanged, the
   description and child rows render as before, and each child row carries no cue.
6. **Regressions.** In the same modal, confirm the accent tint on the parent's number,
   the native disclosure triangle, and the `✓` / `○` glyph all still render. Switch to
   the Issues tab and confirm no issue row gained a cue.
7. **Themes.** Repeat one modal in light and in dark. The cue must be legible in both.
   Both paths are exercised by the existing `--ink-faint` token.
8. **Two task lists.** This repository's `inline-css-extraction` workstream has two task
   lists in one Tasks tab. Confirm both sections get cues and the tab label still
   reconciles across the pair.

## Data & compatibility

- **Migrations.** None. No data shape, no stored file, and no persisted state changes.
- **Wire compatibility.** The `/detail` payload and `PraxisTaskDetail`
  (`src/types/praxis-data.d.ts:80-86`) are unchanged. `children` is already present and
  already `[]` for a leaf, so no field is added, renamed or made nullable.
- **Existing consumers.** `buildItem()` is shared with the Issues tab and is not
  touched. `countTasks()` and `setTabLabels()` are not touched, so the modal and the
  board card behind it cannot begin to disagree as a result of this change.
- **Source projects.** The dashboard remains read-only over other projects' `flowcharge/`
  folders. Nothing in this plan writes to any project.
- **Rollback.** Revert the single commit and run `npm run build`. `dist/` is gitignored
  and regenerated, so nothing stale survives. The change is reversible at every point,
  because it only adds a DOM node and a CSS rule.
- **Repository hygiene.** The untracked `bun.lock` at the repository root is
  pre-existing and must not be staged, edited or removed.

## Testing strategy

This repository has no test framework and no lint script. `package.json` defines only
`build`, `prestart`, `start`, `prerefresh` and `refresh`. Adding a framework for this
feature is explicitly not recommended: it would be the first change to the dependency
set in the project's history, for a four-line presentation change, and it belongs to a
separate decision if it is ever wanted.

Verification is therefore two things, both already in the phases above:

- **Compile gate.** `npm run build`. Because `src/public/tsconfig.json` sets
  `noEmitOnError: true`, a type error stops the build. Because it sets
  `module: "none"`, an accidental `import` is a compile error rather than a broken
  classic script.
- **Manual walkthrough.** The Phase 2 matrix. It is deliberately fixture-named rather
  than described in the abstract, so it can be re-run identically later.

If a test framework is added to this repository in a future workstream, the natural
unit under test from this change is the pluralisation choice at the `1` boundary, and
the natural integration check is criterion 5, that rows plus cues equal
`countTasks()`. Neither is written now.

## Open questions

None of these blocks Phase 1. Each has a default already committed in this plan, so
the work can be authored and built before any of them is answered.

1. **Release constraints.** This plan assumes no production data, no live users, no
   feature flag and no migration, on the grounds that the dashboard is a local
   single-user tool bound to `127.0.0.1`. Options: (a) confirm the assumption, which
   is what the plan is written against; (b) name a constraint that changes it.
   Recommendation: (a).
2. **The word.** The cue says `subtask` / `subtasks`. Alternatives are `child task`,
   which matches the `prx-task-list` skill's own vocabulary, and a bare `+3`, which
   avoids the plural entirely but reads worse for one child. Recommendation: keep
   `subtasks`. It is the word Context itself uses, and it is one string literal to
   change.
3. **Visibility when expanded.** The cue stays visible after the parent opens.
   Alternative: hide it while open, with `.ws-task-group[open] > summary .ws-task-count
   { display: none; }`. Recommendation: keep it visible. The count is still true when
   open, and hiding it makes the cue flicker as the reader expands rows to check the
   arithmetic.

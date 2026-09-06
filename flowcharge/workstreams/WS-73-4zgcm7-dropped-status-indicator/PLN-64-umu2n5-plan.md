---
id: PLN-64-umu2n5
type: plan
workstream: WS-73-4zgcm7
slug: dropped-status-indicator
title: "Shared dropped-status indicator for the board card and the detail modal"
status: done
created: 2026-08-28
updated: 2026-08-28
depends_on: []
links: []
---

# Shared dropped-status indicator

## Summary

The `dropped` status is not visible in three places. A dropped task list or issue
list is invisible on the board card when no item is checked (`ISS-22-049ixu`). A
dropped artefact has no cue in the detail modal's section header. A dropped issue
item shows a green check mark, the same mark a completed issue shows.

This plan adds ONE shared badge helper in `src/public/app.ts`, plus one CSS class
in `src/public/styles.css`. Three call sites use it. Each call site renders the
badge only when the status is `dropped`. The helper reads the existing `--st-*`
palette and the existing `STATUS_LABEL` map, so no new colour and no new label
text enters the codebase.

One data-layer change supports the third call site. The issue item's `status`
becomes a typed field on `PraxisIssueDetail`. The value already crosses the wire
today inside the generic `fields` bag, so no parser change is necessary.

Individual TASK items get no indicator. Section "Verified data model" gives the
reason: no per-task status data exists.

## Verified data model

The brief told me to verify the per-item status question myself. I did. These are
the results, with the evidence.

**1. Issue items DO carry a per-item `status`.** The `fc-issue-list` skill schema
makes `status` a required key of every issue's YAML fence. The enum has six values:
`backlog`, `ready`, `in-progress`, `blocked`, `done`, `dropped`. A repo-wide grep of
`flowcharge/workstreams/*/IL-*-issuelist.md` for an indented `status:` line returns
22 real items (18 `done`, 3 `in-progress`, 1 `ready`).

**2. That value already reaches the browser.** `collectItems` in
`src/lib/detail.ts` attaches every fence key to `PraxisIssueDetail.fields`. The
modal already prints it as an ordinary `Status` row inside the expanded body,
through `renderMap`. No new parsing is needed. Only the collapsed summary row
misses it.

**3. `extract.ts` already promotes the same key.** `src/lib/extract.ts` lines
173-180 read `status:` and `severity:` out of the issue fence with a regular
expression, and put them on `PraxisIssue`. The board payload therefore already
treats issue-item status as a first-class field. Promoting it on the detail side
copies a decision this codebase already made.

**4. Task items DO NOT carry a status.** The `fc-task-list` item schema is
`description`, `author`, `mode`, `issues`, `implement`, `pattern`, `imports`,
`compatibility`, `gotcha`, `verify`, `checklist`, `self_eval`. There is no
`status` key. A grep of `flowcharge/workstreams/*/TL-*-tasklist.md` for an
indented `status:` line returns no real item field. The only hits are prose inside
an `implement` step and a type declaration quoted in a task body. A per-task
dropped indicator is therefore NOT buildable today. It needs a schema change to
the `fc-task-list` skill, and that skill lives outside this repository. See Open
question 1.

**5. Live fixtures exist for two of the three surfaces.**
`WS-64-gdxh7m-bytenode-electron-main/TL-65-yjm7as-tasklist.md` has
`status: dropped` and 3 tasks with 0 checked. That is the exact `ISS-22-049ixu`
reproduction: a 0% wide bar carrying an invisible colour. Three plan files carry
`status: dropped`, including two in `WS-70-hvf4cd-flowcharge-logo-and-masthead`.
No issue item in this repo carries `status: dropped` today, so Phase 4 needs a
temporary hand-made fixture. See Testing strategy.

## Scope

### Acceptance criteria

1. A board card artefact row for an issue list or task list whose file status is
   `dropped` shows the text "Dropped". The row shows it when 0 of N items are
   checked, and when N of N items are checked.
2. That row keeps its progress bar and its `done/total` fraction. No other
   artefact row changes.
3. A detail modal section header for a plan, issue list, or task list whose file
   status is `dropped` shows the text "Dropped" beside the artefact title.
4. A section header for any other status looks exactly as it looks today.
5. An issue row in the modal's Issues tab whose item status is `dropped` shows the
   text "Dropped", and its check mark is the dropped colour, not the done green.
6. An issue row for any other status looks exactly as it looks today.
7. Every indicator uses `--st-dropped` and `--st-dropped-bg`, so it follows the
   light theme and the dark theme with no extra rule.
8. Task rows in the Tasks tab are unchanged.
9. `npm run build` passes.

### Out of scope

- Any indicator for a status other than `dropped`. The badge helper takes a status
  argument, but all three call sites gate on `dropped`. This keeps the promise in
  the workstream brief: no other visual change.
- Any change to the KPI strip, including the `.chip` code at `app.ts` lines
  1248-1272. That code builds the same inline colour pair the new helper builds.
  Folding it into the helper is a real simplification, but it is a change to the
  KPI strip, which the brief forbids. The duplication is accepted knowingly.
- Any per-task dropped indicator (Open question 1).
- Any change to the `fc-task-list` or `fc-issue-list` skill files.
- Removing the `Status` row from an issue's expanded body. It stays. Removing it
  would be a visual change the brief does not ask for.
- The workstream-level status text at `app.ts:929` (`#ws-modal-status`). It
  already prints the status word for every status, including `dropped`.

### Assumptions

These are decisions I made without the user. Each one is reversible.

- **A1.** "Indicator" means a small text badge, not an icon and not colour alone.
  Colour alone fails `ISS-22-049ixu`, whose `expected` field asks for status text
  next to a coloured dot, matching the plan row.
- **A2.** The badge is a pill in the shape of the existing `.chip` and `.tag`
  rules: a rounded background from `--st-dropped-bg`, text from `--st-dropped`.
  This reuses a shape the app already carries in two places.
- **A3.** A dropped artefact's title gets the line-through treatment already used
  by `.is-dropped .card-title` at `styles.css:460`. This keeps one visual language
  for "dropped" across the card and the modal.
- **A4.** An issue item with no YAML fence gets `status: ''`, not `null`. Every
  other scalar in the detail payload uses the empty-string convention set by
  `str()` in `src/lib/detail.ts`. The board payload's `PraxisIssue.status` is
  `string | null`, so the two payloads differ. Internal consistency inside the
  detail payload wins.
- **A5.** The status string is lower-cased before use, copying `extract.ts:180`.
  A file written as `Dropped` therefore still matches.
- **A6.** There is no deployment or release step to plan. `npm run build` is the
  only gate. The desktop package scripts consume the same `dist/` output and need
  no change.

## Design

### The contract, first

One new function in `src/public/app.ts`, inside the existing IIFE:

```ts
// Builds the shared status pill. Reads the --st-<status> pair the palette
// already defines and the label STATUS_LABEL already carries. It knows nothing
// about cards, sections or items — the caller decides WHEN a status is worth
// showing, this decides only how one looks.
function statusBadge(status: string): HTMLElement
```

It returns a `<span class="st-badge">`. It sets `textContent` from
`STATUS_LABEL[status]`, and sets `background` and `color` from
`var(--st-<status>-bg)` and `var(--st-<status>)`, the same way the KPI chip does
at `app.ts` lines 1268-1270.

What it must NOT know: which artefact type is rendering it, whether it is on a
card or in a modal, and whether the status deserves a badge at all. Every caller
answers that last question itself, with `status === 'dropped'`.

Why a status argument, when only one status is ever passed today: the alternative
hard-codes the token name `--st-dropped` and the word "Dropped" inside the
function. That loses the whole point of a shared treatment the moment a second
status is wanted. The argument costs one line and removes three token-name
duplications.

### One data model change

`src/types/praxis-data.d.ts`, interface `PraxisIssueDetail` (lines 75-80). Add one
field:

```ts
status: string;   // per-item YAML status, '' when the item has no fence
```

`src/lib/detail.ts`, `parseIssueItems` (lines 106-115). Populate it from the
fence that `collectItems` already attached. Read `entry.fields.status`, narrow it
with `typeof === 'string'`, lower-case it, and fall back to `''`.

`PraxisTaskDetail` is NOT changed. There is no data to put in it.

`fields` keeps its `status` entry. The two are not in conflict: `fields` is the
raw bag the expanded body renders, and `status` is the typed contract the summary
row reads.

### The three call sites

**Site 1 — board card artefact row.** `src/public/app.ts`, `buildCard`, the
`issuelist || tasklist` branch at lines 288-295. Today the branch recolours a
segment whose width is `pct`, which is 0 when nothing is checked. Keep that
recolour. Add: when `a.status === 'dropped'`, add the class `is-dropped` to the
row, and append `statusBadge('dropped')` after the fraction. The `else` branch,
which serves plans, is not touched — it already prints a dot and status text.

**Site 2 — modal section header.** `src/public/app.ts`, `buildSection` at lines
621-628. It already receives the whole `PraxisDetailArtefact`, so `artefact.status`
needs no new argument and no new payload field. When the status is `dropped`, add
`is-dropped` to the section element and append the badge to the head. All three
tabs get this at once, because `renderPlanPanel`, `renderIssuesPanel` and
`renderTasksPanel` all call `buildSection`.

**Site 3 — modal issue row.** `src/public/app.ts`, `buildItem` at lines 631-640.
This function is shared by issues and by tasks: `renderIssuesPanel` calls it, and
so do `renderTasksPanel` and `buildTaskGroup`. It must therefore not read an issue
field directly. Add an OPTIONAL trailing parameter:

```ts
function buildItem(
  checked: boolean, id: string, title: string,
  fields: Record<string, PraxisYamlValue>, status?: string
): HTMLElement
```

`renderIssuesPanel` (line 839) passes `item.status`. The three task call sites
(lines 876, 906) pass nothing and stay unchanged. Inside `buildItem`, when
`status === 'dropped'`, add `is-dropped` to the `<details>` element and append the
badge to the summary. `buildItem` therefore renders what it is given and still
knows nothing about issues against tasks.

### CSS

`src/public/styles.css`. Four additions, and no edit to an existing rule.

1. `.st-badge` — the pill shape. Copy the metrics of `.tag` at line 465, which is
   the card-sized pill this app already uses. Colour comes from the inline style
   the helper sets, never from this rule.
2. `.artefact-row.is-dropped .a-bar span` and `.artefact-row.is-dropped .a-frac` —
   fade the bar and the fraction, so the row reads as inactive.
3. `.ws-section.is-dropped .ws-section-title` — line-through, matching
   `styles.css:460`.
4. `.ws-item.is-dropped .ws-check.is-checked` — set `color: var(--st-dropped)`.
   This overrides the hard-coded `--st-done` at `styles.css:990`. Specificity is
   0-4-0 against that rule's 0-2-0, so it wins with no `!important`.

**Gotcha.** `styles.css:460` is `.is-dropped .card-title`, an UNSCOPED descendant
selector. Every new rule above is scoped to its own element class
(`.artefact-row.is-dropped`, `.ws-section.is-dropped`, `.ws-item.is-dropped`).
Never write a bare `.is-dropped` rule, or it will leak across the card and the
modal.

### Principles check

- DRY: one badge helper replaces what would be three inline colour lookups.
- KISS: no new module, no new payload endpoint, no new colour token, no parser
  change.
- YAGNI: no indicator for any status the brief did not name. No refactor of the
  KPI chip.
- Separation of concerns: the helper owns appearance. Each call site owns the
  decision to show it. `detail.ts` owns the field, and the browser owns the
  rendering, exactly as the file header comments already require.

## Staged task breakdown

Four phases. Each phase leaves the app building and usable.

### Phase 1 — The shared primitive (small)

Add `statusBadge` to `src/public/app.ts`. Add `.st-badge` to
`src/public/styles.css`. No call site yet.

- Files: `src/public/app.ts`, `src/public/styles.css`.
- Depends on: nothing.
- Risk note: neither tsconfig sets `noUnusedLocals`, so a helper with no caller
  compiles. I verified both config files.
- Verify: `npm run build` passes. Open a board. Nothing on screen changes.

### Phase 2 — Board card cue, closing ISS-22-049ixu (small)

Apply Site 1. Add the two `.artefact-row.is-dropped` rules.

- Files: `src/public/app.ts`, `src/public/styles.css`.
- Depends on: Phase 1.
- Verify: `npm run build`, then `npm start`. Open this repository's own board.
  Find the card for `WS-64-gdxh7m`. Its `TL-65-yjm7as` row is `dropped` at 0 of 3.
  The row must read "Dropped". Compare it with any other task-list row at 0 of N,
  which must be unchanged. Check the row at the narrowest board column width, and
  in both themes.

### Phase 3 — Modal section headers (small)

Apply Site 2. Add the `.ws-section.is-dropped` rule.

- Files: `src/public/app.ts`, `src/public/styles.css`.
- Depends on: Phase 1.
- Verify: open the `WS-64-gdxh7m` card. The Tasks tab section header for
  `TL-65-yjm7as` shows "Dropped" and a struck title. Open the
  `WS-70-hvf4cd` card. Its Plan tab has two dropped plans (`PLN-59-pbg3pk`,
  `PLN-61-7f18vq`) and they must both show the badge. Every non-dropped section
  header must be unchanged.

### Phase 4 — Issue item status (medium)

Do the data model change, then apply Site 3, then add the
`.ws-item.is-dropped` rule.

- Files: `src/types/praxis-data.d.ts`, `src/lib/detail.ts`,
  `src/public/app.ts`, `src/public/styles.css`.
- Depends on: Phase 1.
- Ordering inside the phase: change the type and `detail.ts` first, build, then
  change the browser. The type is the contract and must land first.
- Verify: see Testing strategy. This phase has no live fixture in this repository.

## Data and compatibility

- **No migration.** No file on disk changes. The dashboard is read-only against
  the project tree it reads, and this plan does not change that.
- **Payload growth.** One string per issue item. The largest issue list in this
  repository holds a handful of items, so the cost is negligible.
- **Backward compatibility of the payload.** `PraxisIssueDetail.status` is a NEW
  required field. Server and browser are compiled and shipped together from the
  same `dist/`, so there is no version skew to handle. A stale cached `app.js`
  against a fresh server would read `undefined`, and the `=== 'dropped'` test
  would simply be false. The result is today's behaviour, not a crash.
- **Old files.** An issue item written before `status` was a required key gets
  `''`. It renders exactly as it renders today.
- **`extract.ts` is untouched.** The board payload and its `PraxisIssue` type do
  not change, so the KPI strip, the open-issue panels and the severity sort are
  all unaffected.
- **Rollback.** Every phase is a self-contained commit and reverts cleanly.
  Phases 2, 3 and 4 are independent of each other, so any one can be pulled
  without the others. Reverting Phase 4 also needs the type field reverted, which
  is why the type and its reader land in the same commit.

## Testing strategy

There is no test script in `package.json`. `npm run build` runs three `tsc`
passes and is the gate the brief names. A `node --test` suite does exist under
`src/lib/*.test.ts`, and it is compiled by the Node pass.

- **Compile gate, every phase.** `npm run build` must pass. The public pass is
  `noEmit` and type-checks `app.ts` against `praxis-data.d.ts`, so the new
  `PraxisIssueDetail.status` field and the new optional `buildItem` parameter are
  both checked there.
- **Existing tests, Phase 4.** `src/lib/detail.test.ts` covers `parseIssueItems`.
  I checked it: it contains no `deepStrictEqual` on an item object, so adding a
  field breaks nothing. Confirm this by running
  `node --test dist/lib/detail.test.js` after the build.
- **Phase 4 fixture, manual.** No issue item in this repository is `dropped`
  today. To verify by eye, copy one workstream folder to the session scratchpad,
  set one issue's fence to `status: dropped` and its checkbox to `[x]`, register
  that copy as a project, and open its card. The dropped row must show the badge
  and a dropped-coloured check mark, while its neighbours stay green or hollow.
  Do not edit a real file in `flowcharge/workstreams/` for this.
- **A later test-writing pass could add**, if the user wants it: one `detail.ts`
  unit case asserting a fenced item yields its lower-cased status, and one
  asserting a fence-less item yields `''`. The existing `fixture-project.ts`
  builder is the natural place to add such an item. This plan does not author
  those tests.
- **Theme check, Phases 2 to 4.** Every new colour comes from a `--st-*` token
  that both the light block and the dark block define, so a single toggle of the
  theme is enough to confirm all three surfaces.

## Open questions

Each of these is a decision for the user. Nothing downstream should be built for
them until they are answered.

1. **Should individual tasks get a dropped state at all?** No such data exists.
   The `fc-task-list` item schema has no `status` key, so this cannot be built
   from any file in the project today. Adding it means editing the `fc-task-list`
   skill, then teaching `detail.ts` and `extract.ts` to read the new key. The
   skill lives outside this repository, so that is a separate workstream under a
   different scope. Options: (a) accept that tasks have no dropped state, and
   rely on the dropped SECTION header from Phase 3 to carry it; (b) open a
   separate workstream to extend the task schema first. My recommendation is (a)
   for now, and this plan builds (a).

2. **Should task rows inside a dropped task list be dimmed?** Phase 3 marks the
   section header. It would be possible to fade every row under it as well. I did
   NOT plan this. It implies a per-task state that does not exist, and the brief
   forbids visual change beyond the dropped gap. Options: (a) leave rows
   unchanged, which is what this plan does; (b) fade them. My recommendation is
   (a).

3. **Should the badge read "Dropped" or should it match the plan row's lower-case
   status word?** The board card's plan branch prints the raw status string, so it
   reads `dropped` in lower case. `STATUS_LABEL` gives `Dropped`. This plan uses
   `STATUS_LABEL`, so the new badge and the old plan row will differ in case on
   the same card. Options: (a) accept the difference, which this plan does; (b)
   change the plan branch to use `STATUS_LABEL` too, which is a visual change to
   a row the brief did not name. My recommendation is (a).

4. **Should the KPI strip's `.chip` builder be folded into `statusBadge`?** It
   builds the same inline colour pair. Folding it removes a real duplication, but
   it changes the KPI strip, which the brief puts out of scope. My recommendation
   is to leave it, and to raise it as its own small workstream later.

### What I would have asked, and the reading I took instead

- I would have asked whether "indicator" meant text, colour, or an icon. I took
  text plus colour, because `ISS-22-049ixu` names status text as the expected
  result (Assumption A1).
- I would have asked whether every status should get a badge, or only `dropped`.
  I took `dropped` only, because the brief says no other visual change.
- I would have asked about a release or deployment constraint. I found none: the
  build produces `dist/`, and the packaging scripts consume the same output
  (Assumption A6).

## Alternatives considered and rejected

**Alternative 1 — CSS only, with no shared helper.** Set an `is-dropped` class at
each site and let the stylesheet do everything, including a `::after` pseudo-
element for the word "Dropped".
*Rejected.* Text in a `content` property is invisible to a text search and awkward
to translate. It also still needs JavaScript to set the class, so it does not
actually avoid touching `app.ts`. The saving is imaginary.

**Alternative 2 — three separate one-off patches.** Recolour the card row, print
the status word in `buildSection`, and read `fields.status` inline in
`buildItem`.
*Rejected.* This is exactly the shape finding 4 of the workstream brief warns
about. It duplicates the `--st-dropped` token name three times, and a later
status colour change would need three edits. The shared helper costs about the
same number of lines.

**Alternative 3 — a full status badge on every artefact and every item, for all
six statuses.** The most "complete" reading of the feature.
*Rejected.* It changes the look of every section header and every issue row on
every card. The brief explicitly limits scope to the dropped gap. The helper is
built to allow this later with no rewrite, but no call site does it now.

**Alternative 4 — read `fields.status` in the browser and change no type.** Zero
data-layer change.
*Rejected, narrowly.* It works, and it is one line shorter. I rejected it because
`extract.ts` lines 173-180 ALREADY promote this exact key to a typed field on the
board side. Leaving the detail side reaching into a generic bag makes the two
payloads disagree about whether issue status is schema data or incidental data.
The typed field states the contract the UI depends on, and costs two lines.

**Alternative 5 — extend the `fc-task-list` schema first, then build all four
surfaces.** The complete fix the brief's finding 3 imagines.
*Rejected.* The skill is outside this repository, the change would need every
existing task list migrated to stay consistent, and the brief limits this
workstream to the dashboard. Recorded as Open question 1 instead.

## Final summary

The chosen approach is one shared `statusBadge` helper plus one `.st-badge` CSS
class, called from three sites, each gated on `status === 'dropped'`, with the
issue item's status promoted to a typed field to feed the third site.

Four phases, all small except Phase 4 which is medium. The whole change is
roughly 40 lines of TypeScript and 15 lines of CSS across four files.

Top risks:

1. The board card column is narrow. A badge added beside the bar and the fraction
   may crowd the row. Phase 2's verification step checks the narrowest width.
2. `styles.css:460` uses an unscoped `.is-dropped` selector. Every new rule must
   be scoped to its own element class, or it will leak.
3. Phase 4 has no live fixture in this repository and needs a hand-made one.

Open questions needing an answer: 1 (do tasks need a dropped state at all, which
would require a skill schema change outside this repo), 2 (dim task rows under a
dropped section), 3 (badge label case against the plan row's raw status word), and
4 (fold the KPI chip into the helper later). This plan builds recommendation (a)
for questions 1, 2 and 3, and defers 4.

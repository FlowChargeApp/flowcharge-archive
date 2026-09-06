---
id: PLN-16-1x7tg5
type: plan
workstream: WS-20-73eu0l
slug: detail-modal-artefact-order-by-id
title: "Order a board card's artefact rows by type, then by artefact ID"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: []
links: []
---

# Order a board card's artefact rows by type, then by artefact ID

## Summary

A board card lists a workstream's artefacts in raw directory order. The card for LAD's
WS-124 therefore reads `IL·85`, `IL·84`, `TL·174`, `TL·175`. A hyphen is byte `0x2D` and a
full stop is `0x2E`, so `issuelist-<qualifier>.md` always precedes `issuelist.md`,
whatever IDs the two files carry.

This is the second plan under WS-20. The first pass (ISS-6, TL-19, commit `2fe5500`) fixed
the same symptom in the detail modal only. That fix changed `extractWorkstreamDetail()` in
`src/lib/detail.ts`, which feeds a different route and is deliberately separate from the
board's extraction path. It could never have reached the card. This is a parallel defect,
not a regression.

The plan adds one comparator to `walkWorkstreams()` in `src/lib/extract.ts`, applied to the
`artefacts` array after the file loop closes and before `out.push`. The comparator ranks by
artefact type first (plan 0, issue list 1, task list 2, anything else last), then by the
numeric part of the ID ascending, then by the ID string as a total-order tie-break. The
existing `artefactIdNumber()` helper moves from `src/lib/detail.ts` into `src/lib/extract.ts`
and is exported there, so one rule serves both surfaces.

Two files change. No new package, no type change, no client change, no change to any count
or KPI.

## Scope

### Acceptance criteria

1. Every board card lists its artefact rows grouped by type, in the order plan, then issue
   list, then task list. Any other type sorts after all three.
2. Within one type group, rows ascend by the number in the artefact ID, compared as a
   number and not as text. `IL·9` therefore precedes `IL·85`.
3. The card for LAD's WS-124 reads `IL·84`, `IL·85`, `TL·174`, `TL·175`.
4. The card for this repository's `inline-css-extraction` workstream reads `PLN·1`, `IL·1`,
   `TL·1`, `TL·2`.
5. The card for LAD's WS-55 reads `IL·23`, `IL·81`, `IL·82`, `IL·83`, `TL·40`, `TL·166`,
   `TL·169`.
6. The card for LAD's WS-156 reads `PLN·33`, `IL·79`, `TL·149`, `TL·150`.
7. Two runs of the extraction over the same folder produce the same row order, on any
   machine and any filesystem. The comparator never returns 0 for two different artefacts.
8. An artefact whose `id` carries no parsable number sorts as though its number were 0. It
   never produces a `NaN` sort key, and the extraction never throws.
9. An artefact whose `type` key is absent sorts into the single trailing bucket. It never
   produces an `undefined` sort key.
10. The JSON that `npm run refresh` writes carries the same order as the board, because both
    read the same array.
11. Every open-issue count, severity chip, task-completion KPI, and "Needs attention" count
    holds the value it holds today.
12. `src/lib/extract.ts` still imports nothing from `src/lib/detail.ts`.
13. Both TypeScript projects still type-check, and `npm run build` still succeeds.

### Out of scope

- The detail modal. Its two sorts at `src/lib/detail.ts:257-258` are already correct and are
  not touched, beyond the import line that the helper move requires.
- The card sort at `src/public/app.ts:160-168`. That orders the workstream cards themselves,
  it is user-controlled, and it is a different thing.
- The `issues[]` array built inside the same file loop at `src/lib/extract.ts:88-104`.
- WS-21 (`plan-artefact-not-readable`, status backlog). It records that a `PLN` row renders
  on the card but opens nothing. It is separate work, and this plan does not fold it in.
- Any change to `PraxisArtefact` or `PraxisWorkstream` in `src/types/praxis-data.d.ts`.
- Adding a test framework. This repository has none, and this plan does not introduce one.

### Assumptions

These were not confirmed by a user. Each is the most reasonable reading, recorded so it can
be overturned.

1. **Release constraints.** The dashboard is a local single-user tool that binds `127.0.0.1`
   and extracts every board live on request. There is no production data, no live user, no
   cached payload to invalidate, and no migration. The app stays shippable after each phase,
   so no feature flag is needed. Rollback is `git revert` of the phase commit.
2. **Type order.** Plan, then issue list, then task list is the causal chain. The plan is the
   workstream's premise, and task files cross-reference issues through an `issues` key. This
   is taken as the intended reading order.
3. **The `workstream` type is defensive only.** `workstream.md` is excluded by filename at
   `src/lib/extract.ts:74`, so a `workstream`-typed file reaches the array only under another
   filename. It falls into the trailing unknown bucket rather than taking a rank of its own.
   No such file exists in either corpus today.
4. **"Needs attention" tie order may change.** `collectStale()` at `src/public/app.ts:638`
   sorts by days descending at line 651. Ties on equal `days` inherit artefact-array order, so
   rows can reshuffle within one day value, and the 12-row slice at line 746 could change
   which row it drops. The counts at lines 731 and 739 do not change. This is accepted as an
   improvement, because the inherited order was previously `readdirSync` order and therefore
   arbitrary.
5. **The board is verified by eye.** No test pins the current order, and there is no test
   script. This is treated as the verification bar, not as a gap to close in this plan.

## Design

### Where it attaches

`walkWorkstreams()` at `src/lib/extract.ts:59` builds the `artefacts` array. Its inner loop
at line 73 pushes each artefact at line 86 in raw `readdirSync` order, and line 118 attaches
the array to the workstream record. There is no sort anywhere in `extract.ts` today.

The comparator goes between the close of that loop (line 105) and `out.push` (line 107). At
that point the array is complete, and the `issues[]` pushes inside the loop have already
happened and are untouched.

The client does not re-order. `src/public/app.ts:104-126` renders the rows in array order.
Nothing else needs to change.

### The comparator

Added to `src/lib/extract.ts`, module scope, above `walkWorkstreams()`:

```ts
// Reading order for a card's artefact rows: the plan is the workstream's premise,
// the issues come from it, and task files cross-reference those issues. Neither
// the labels (IL, PLN, TL) nor the frontmatter keys (issuelist, plan, tasklist)
// sort into that order alphabetically — both put the plan second.
// `workstream` is not ranked: workstream.md is skipped by filename above, so a
// workstream-typed file only reaches here under another name. It lands in the
// trailing bucket with any unrecognised type.
const ARTEFACT_TYPE_RANK: Record<string, number> = { plan: 0, issuelist: 1, tasklist: 2 };
const UNRANKED_TYPE = 3;
```

Applied after the file loop closes:

```ts
// Type first, then the id number, then the id string. The string tie-break is what
// makes the comparator TOTAL. Stability is not enough here: what a stable sort
// preserves is readdirSync order, and this walk — unlike detail.ts's, which sorts
// its listing explicitly — never sorts its listing, so the same data could render
// in two orders on two machines.
artefacts.sort((a, b) => {
  const ra = ARTEFACT_TYPE_RANK[a.type] ?? UNRANKED_TYPE;
  const rb = ARTEFACT_TYPE_RANK[b.type] ?? UNRANKED_TYPE;
  if (ra !== rb) return ra - rb;
  const na = artefactIdNumber(a.id);
  const nb = artefactIdNumber(b.id);
  if (na !== nb) return na - nb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
});
```

Three properties of that code are load-bearing.

- `?? UNRANKED_TYPE` is required, not defensive habit. `fmStr()` at line 29 asserts and never
  coerces, so `a.type` is typed `string` but holds `undefined` when the key is absent. Without
  the fallback the comparator computes `undefined - undefined`, which is `NaN`, and a `NaN`
  comparator result makes the whole sort implementation-defined.
- The number comparison must be numeric. String comparison of the ID number breaks seven LAD
  workstreams, for example `WS-75-file-service` (TL-53, TL-164, TL-165) and `WS-103` (TL-78,
  TL-172).
- The final tie-break uses `<` and `>`, not `localeCompare`. `localeCompare` depends on the
  runtime's locale and ICU build, which would put back the machine dependence the tie-break
  exists to remove.

### The helper move

`artefactIdNumber()` sits at `src/lib/detail.ts:185-188` and is not exported. It moves to
`src/lib/extract.ts` and is exported there. `detail.ts` already imports from `extract.ts` at
line 9, so the name joins that import:

```ts
import { ISSUE_ITEM, TASK_ITEM, artefactIdNumber, parseFrontmatter } from './extract.js';
```

Direction matters. Nothing imports `detail.ts`, and `extract.ts` must never import it — that
is the cycle to avoid. `ISSUE_ITEM` and `TASK_ITEM` already live in `extract.ts` for
`detail.ts` to consume, with a comment stating why, so the move follows an established
pattern in these same two files.

History supports the move over a second copy. WS-17 / ISS-5 was caused by two hand-maintained
copies of the task-line rule across these two files. They drifted, and the card read 98 where
the modal read 86. Re-declaring the helper would repeat that mistake.

The helper's body does not change. Two properties of it must survive the move, because the
new call site depends on both:

- A malformed or absent number falls back to 0, never `NaN`.
- It must not throw when `id` holds a `string[]` at runtime, which `fmStr()` permits. It
  currently returns 0 in that case, through `Array.prototype.slice` and `Number()` of an
  array. Preserve that.

The helper's comment does change, and this is the one part of the move that is not mechanical.
It currently reads that every id inside one result array shares a prefix, so the number alone
orders the array. That is true of `detail.ts`, whose arrays are single-type, and false of the
board's `artefacts` array, which is mixed. The rewritten comment must say that the number
orders a set of ids that already share a prefix, and that grouping by type is what supplies
that precondition on the board side. It must also stop naming `str()`, which lives in
`detail.ts`.

### What each piece knows, and must not know

- `ARTEFACT_TYPE_RANK` knows the three Praxis artefact types and their reading order. It knows
  nothing about labels, CSS, tabs, or which route consumes the payload.
- `artefactIdNumber()` knows how a Praxis ID is shaped. It does not know what an artefact is,
  what type it has, or which array it is being sorted into.
- The comparator knows only `PraxisArtefact`. It reads no file and touches no `issues[]` entry.
- `src/public/app.ts` learns nothing. It keeps rendering the array in the order it receives.

### Approach chosen, and alternatives rejected

**Chosen: one comparator in `walkWorkstreams()`, type rank then ID number then ID string.**

Row order is data shape, not view state. One order then serves every consumer, including the
JSON that `src/scripts/extract-praxis-data.ts` writes. `buildCard()` runs for every card on
every keystroke and every five-second poll, so a client-side sort would repeat the work
forever. It also matches where the modal's fix went.

**Rejected: a flat numeric sort with no type grouping.** Each ID prefix is an independent
counter, so a flat numeric sort ties across types and the tie falls to `readdirSync`. This
repository's `inline-css-extraction` holds IL-1, PLN-1, TL-1 and TL-2 — a three-way tie at 1,
in which the plan does not lead. LAD's `WS-55-create-prd` holds IL-23, IL-81, IL-82, IL-83,
TL-40, TL-166, TL-169, which a flat sort interleaves as IL-23, TL-40, IL-81, IL-82, IL-83,
TL-166, TL-169. Grouping by type produces a correct list for every workstream in both corpora.

**Rejected: alphabetical type order.** It is wrong on the labels (IL, PLN, TL) and wrong on
the frontmatter keys (issuelist, plan, tasklist) alike. Both put the plan second, between the
issues and the tasks.

**Rejected: sorting in `src/public/app.ts`.** It is the wrong layer for a data-shape decision,
it leaves the `refresh` JSON unsorted, and it re-runs the comparison on every render.

**Rejected: sorting the directory listing instead of the array.** Sorting `readdirSync` would
make the walk deterministic but would still order by filename, which is the defect. The IDs
are the identifiers the reader sees.

**Rejected: re-declaring `artefactIdNumber()` in `extract.ts`.** WS-17 / ISS-5 is the recorded
cost of exactly that shortcut in exactly these two files.

**Rejected: relying on sort stability instead of a tie-break.** `Array.prototype.sort` is
stable, but what it preserves here is `readdirSync` order, and `walkWorkstreams()` does not
sort its listing. `detail.ts:230` sorts its listing and carries a comment making this point.
Without a total comparator the same data can render differently on two machines.

## Staged task breakdown

### Phase 1 — Move the helper, change no behaviour (small)

Move `artefactIdNumber()` from `src/lib/detail.ts` into `src/lib/extract.ts`, export it there,
rewrite its comment for the new home, delete the `detail.ts` copy, and add the name to the
existing import at `src/lib/detail.ts:9`.

- Files touched: `src/lib/extract.ts`, `src/lib/detail.ts`.
- Depends on: nothing.
- Verify: `npx tsc --noEmit -p tsconfig.json` and `npx tsc --noEmit -p src/public/tsconfig.json`
  both pass. `npm run build` succeeds. Confirm by reading `src/lib/extract.ts` that it imports
  nothing from `detail.ts`. Open a board, open the detail modal for a workstream holding a
  qualified and a plain artefact file, and confirm the Issues tab and the Tasks tab still read
  in ascending ID order. Board cards are unchanged at this point, by design.

This phase is separated so that an import or cycle failure is diagnosed on its own, before any
visible order changes.

### Phase 2 — Add the comparator and confirm the order (small)

Add `ARTEFACT_TYPE_RANK`, `UNRANKED_TYPE`, and the `artefacts.sort(...)` call to
`walkWorkstreams()`, placed after the file loop closes and before `out.push`.

- Files touched: `src/lib/extract.ts`.
- Depends on: Phase 1, for the exported helper.
- Verify: `npx tsc --noEmit -p tsconfig.json` passes and `npm run build` succeeds. Then
  `npm start`, and check acceptance criteria 3 to 6 by eye on the named cards. Run this
  repository's own extraction read-only over the LAD corpus and confirm the 17 wrong
  workstreams now read correctly and no previously correct workstream has changed. Confirm the
  KPI strip and the open-issue counts hold their present values. Run `npm run refresh` against
  one project and confirm the `artefacts` arrays in the JSON carry the same order as the cards.

## Data & compatibility

- **No schema change.** `PraxisArtefact` and `PraxisWorkstream` in
  `src/types/praxis-data.d.ts` keep every field and every type. The payload changes order
  only.
- **No migration and no stored data.** Every board is extracted live on request. The only
  persisted file is `.praxis-projects.json`, the project registry, which this plan does not
  touch.
- **Consumers.** `w.artefacts` has exactly three uses in `src/public/app.ts`. Line 104-126,
  `buildCard()`, is the target. Line 641, `collectStale()`, inherits the new order in ties on
  equal `days` — see assumption 4. Line 709, the KPI task-list sums, is additive and therefore
  order-independent.
- **The `issues[]` array is untouched.** Its pushes happen inside the file loop at lines
  88-104, and the sort runs after the loop closes. `issues` is only counted or bucketed, never
  shown as an ordered list, so no KPI, chip, or count moves.
- **Read-only over other projects.** The dashboard only reads other projects' `flowcharge/`
  folders. The LAD replay in Phase 2 must not write to that tree. `flowcharge/` is gitignored in
  those projects, so those files exist on disk only.
- **Rollback.** Revert the phase commit. Both phases are pure source changes with no persisted
  side effect, so a revert restores the previous order on the next request. Phase 2 alone can
  be reverted without touching Phase 1.

## Testing strategy

This repository has no test framework, no test file, and no test script. `package.json` defines
only `build`, `prestart`, `start`, `prerefresh` and `refresh`. Adding a framework is out of
scope, so verification is compile plus replay plus eye. This section is the pointer a later
test-writing pass would start from.

- **Phase 1** — compile both projects and confirm the modal is unchanged. The helper move is
  behaviour-preserving by construction, so the modal reading correctly is the whole test.
- **Phase 2** — the four named cards in acceptance criteria 3 to 6 are the fixture set. They
  cover the qualified-filename case, the three-way tie at 1, the interleave a flat sort would
  produce, and the full plan-issues-tasks chain.
- **If a unit test is added later**, the comparator is the natural target: it is a pure
  function of two `PraxisArtefact` values, with no filesystem in reach. The cases worth pinning
  are the four fixtures above, a missing `type`, a missing `id` number, an `id` holding a
  `string[]`, and two artefacts differing only in `id` string, which must never compare equal.
- **Not covered by any automated check**: that `extract.ts` never grows an import of
  `detail.ts`. Today that is a code-review point only.

## Open questions

1. **Should the "Needs attention" panel get its own secondary sort key?** Ties on equal `days`
   currently inherit artefact-array order, so this change reshuffles some rows and could change
   which row the 12-row slice drops. Options: leave it, and let the panel inherit the new and
   better-defined order; or add an explicit secondary key such as workstream ID then artefact
   ID. Recommendation: leave it. The inherited order was arbitrary before and is deterministic
   after, and pinning the panel is separate work with its own acceptance criteria.
2. **Should a `workstream`-typed artefact get an explicit rank?** It cannot occur today, since
   `workstream.md` is skipped by filename and no other file carries that type in either
   corpus. Options: leave it in the trailing unknown bucket; or give it rank 0 so it would lead
   a card. Recommendation: leave it. Ranking a case that does not exist is speculation, and the
   trailing bucket is already deterministic.
3. **Does moving `PLN` to the top of every card raise the priority of WS-21?** WS-21
   (`plan-artefact-not-readable`, backlog) records that a `PLN` row renders but opens nothing.
   After this change that dead row leads every card that has a plan, which is most of them.
   Recommendation: note it and do nothing here. WS-21 is separate work, and this plan
   deliberately does not fold it in. The user decides whether it moves up the queue.
4. **Is `plan → issues → tasks` the intended reading order?** It is taken as established, on the
   causal argument and on LAD WS-156. The user could prefer tasks before issues, since tasks are
   what gets worked. Recommendation: keep plan, issues, tasks. Changing it later is a one-line
   edit to `ARTEFACT_TYPE_RANK`.

## Final summary

One comparator in `walkWorkstreams()` — type rank, then ID number, then ID string — with
`artefactIdNumber()` moved from `detail.ts` into `extract.ts` and exported.

Two phases, both small, two files touched, no new package and no type change. Phase 1 moves the
helper with zero behaviour change. Phase 2 adds the sort.

Top risks: a `NaN` or `undefined` sort key making order implementation-defined, which the
explicit type fallback and the numeric-only comparison prevent; a non-total comparator letting
two machines render the same data differently, which the ID-string tie-break prevents; and an
`extract.ts → detail.ts` import creating a cycle, which the move direction prevents.

Open for the user: whether the "Needs attention" panel needs its own tie-break, whether
`workstream` deserves an explicit rank, whether WS-21 moves up now that `PLN` leads every card,
and whether plan-issues-tasks is the order wanted.

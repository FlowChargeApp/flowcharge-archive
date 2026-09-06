---
id: PLN-8-7whjuj
type: plan
workstream: WS-8-nlelsj
slug: board-sort-by-severity
title: "Rank workstreams by open-issue severity as a third board sort key"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: []
links: []
---

# Rank workstreams by open-issue severity as a third board sort key

## Summary

Add a third pill, `data-key="severity"`, to the existing `#sort-key-seg` control in
`src/public/board.html`, and a third branch in `renderBoard()`'s comparator in
`src/public/app.ts`. The ranking is a **lexicographic tuple compare** — critical count first,
then high, then medium, then low, each compared in full before the next tier is consulted — computed
once per `renderBoard()` call into a `Map`-like lookup keyed by workstream id, not recomputed per
pairwise comparison. A workstream with no open issues in any tier (plan-only, or an issue list with
nothing currently `ready`/`in-progress`) naturally lands at the ranking's least-urgent end. "Open"
reuses the exact definition `renderKpis()`/`renderSeverity()` already use (`status === 'ready' ||
status === 'in-progress'`, app.ts:618 and app.ts:693) — no second definition is introduced. Zero
server-side change: `issues` is already loaded into module scope by `applyData()` (app.ts:552-554)
with every issue carrying `severity`, `status`, and `workstream` (the owning id) already.

The one non-obvious design decision is the **sign convention**. For the existing `id`/`name` keys,
"Asc" means literal ascending value (`cmp = a - b`, or `localeCompare`), and the shared trailer
`return sortDir === 'asc' ? cmp : -cmp;` flips it for "Desc". The card requires the *default*
("Asc", already the active button on load) to put the *most*-severe workstreams first and
no-data workstreams last — the opposite base ordering from what "ascending" means for the other two
keys. Rather than special-casing the trailer, the severity branch computes `cmp` with its operands
already reversed (`cmp = severityCmp(b, a)` — see Design), so the single shared
`sortDir === 'asc' ? cmp : -cmp` line keeps working unmodified for all three keys, and "Desc" on
Severity correctly inverts to no-data-first.

## Scope

### Acceptance criteria

1. `#sort-key-seg` in `board.html` gains a third button, `<button data-key="severity">Severity</button>`,
   appended after the existing "Name" pill. The two existing buttons and the control's click handler
   (`app.ts:157-163`, which already reads `btn.dataset.key` generically) are unmodified.
2. Clicking "Severity" re-renders the board sorted, independently within each status column, by each
   workstream's open-issue severity mix.
3. "Open" means `status === 'ready' || status === 'in-progress'` on a `PraxisIssue` — identical to
   `renderKpis()` and `renderSeverity()`. No new open/closed definition is introduced anywhere.
4. Ranking is a lexicographic tuple compare: a workstream with more open `critical` issues always
   outranks one with fewer, regardless of the other tiers' counts. Only when `critical` counts tie
   does `high` decide; only when both `critical` and `high` tie does `medium` decide; then `low`.
   No weighted/summed score is used.
5. A workstream with zero open issues across all four tiers — including one carrying only a plan
   artefact, or one whose issue list currently has nothing `ready`/`in-progress` — sorts to the
   bottom of its status column when "Severity" + "Asc" (the default) are active.
6. With "Severity" active, clicking "Desc" reverses the order: no-data/least-severe workstreams rise
   to the top, most-severe fall to the bottom — the same inversion role "Desc" already plays for
   `id` and `name`.
7. Switching to "Severity" and back to "Artefact ID" or "Name" restores their exact prior ordering
   and semantics; neither existing key's behavior changes.
8. Two workstreams with an identical severity mix (including two both all-zero) keep a stable,
   repeatable relative order across re-renders of the same underlying data — relying on
   `Array.prototype.sort`'s stability guarantee, which the `es2020` target (`src/public/tsconfig.json:3`)
   already provides; no synthetic secondary sort key is added (this matches `id`/`name`, neither of
   which has a secondary tie-break today either).
9. The ranking is computed only from the `issues` array `applyData()` already holds (app.ts:13,
   populated at app.ts:552-554) matched to a workstream via `PraxisIssue.workstream`
   (`praxis-data.d.ts:35`). No new fetch, no new route, no change to `PraxisData` / `BoardPayload` /
   `PraxisIssue`.
10. `npm run build` (both `tsconfig.json` and `src/public/tsconfig.json`) completes with zero errors;
    `dist/public/app.js` remains a classic script — no `import`/`export` (guaranteed by
    `module: "none"`, `src/public/tsconfig.json`).
11. Zero new runtime dependencies. `src/server.ts`, `src/lib/extract.ts`, `src/lib/projects.ts`,
    `src/lib/git.ts` are untouched — this is a client-only change, consistent with WS-7's precedent.

### Out of scope

- The home page's project tiles (`index.html` / `home.ts`) — this card scopes to the board only.
- Changing what "open" means, anywhere.
- Changing the `PraxisData` / `PraxisIssue` wire shape. Every field this feature needs already
  exists in the payload.
- A user-configurable weighting scheme. The ranking algorithm is a fixed, coded decision.
- **A visual severity cue on the sort button or on cards** (e.g. pulling `--sev-critical` etc. into
  the button's styling, or showing a severity chip per card). The card asks for a sort *key*, not a
  new card affordance; the two existing pills (`Artefact ID`, `Name`) carry no such styling either,
  and adding one only for the new key would be inconsistent with them. Recorded as Open Question 2
  in case the shipped sort proves hard to eyeball without one.
- Refactoring the pre-existing duplicated open-issue-status check. `renderKpis()` (app.ts:618) and
  `renderSeverity()` (app.ts:693) already each inline `status === 'ready' || status === 'in-progress'`
  independently; this feature adds a third inline copy in the same style rather than introducing a
  shared `isOpenIssue()` helper that would touch those two working, unrelated functions. DRY-ing the
  three call sites is a legitimate future cleanup, not part of this card.

### Assumptions

1. **No deployment or release constraints apply.** Same footing as WS-7 (`flowcharge/workstreams/live-board-refresh/plan.md`): a `localhost:4173`, single-user developer tool — no production data, no live users, no migration, nothing that must stay shippable mid-feature. Rollback is `git revert`. Recorded as Open Question 1, asked every run per process.
2. **Lexicographic tuple compare, not a weighted score or raw count** — per the card's own worked example (3 open `high` vs 1 open `critical`), a weighted score's constants are arbitrary and need future retuning; a raw count contradicts the feature's purpose outright. Tuple compare matches standard incident-triage convention and needs no tunable constants.
3. **"Asc" (default) = most-severe-first, no-data-last**, achieved by reversing the comparator's operand order for the severity branch only, leaving the shared `sortDir === 'asc' ? cmp : -cmp` trailer untouched (see Summary and Design).
4. **Tie-break is JS sort stability, not a synthetic key** — consistent with `id`/`name` having none either; adding one for severity only would be an inconsistency the card didn't ask for.
5. **No visual affordance beyond the button label** — see Out of scope; recorded as Open Question 2.
6. **A single project's current data cannot exercise most of this ranking.** `flowcharge/workstreams/*/issuelist*.md` (checked during planning) contains exactly one issue list (`inline-css-extraction`, `IL-1`), whose one issue is `status: done` — zero open issues project-wide today. Manual verification (Testing strategy, below) needs temporary fixture data to actually see workstreams reorder.

## Design

### Data flow (unchanged inputs, new derived structure)

No new types. The feature adds one derived, render-local structure inside `app.ts`:

```ts
// computed once per renderBoard() call, only when sortKey === 'severity' — same
// "walk once, look up O(1) per comparison" shape as collectStale() (app.ts:568-583)
type SevMix = { critical: number; high: number; medium: number; low: number };
var sevMix: Record<string, SevMix> | null = null;
```

Populated by walking `workstreams` (to seed every id at zero — this is what makes an
all-zero, no-issue-list workstream fall out "for free", no special case needed) and then
`issues` once:

```ts
if (sortKey === 'severity') {
  sevMix = {};
  workstreams.forEach(function (w) { sevMix![w.id] = { critical: 0, high: 0, medium: 0, low: 0 }; });
  issues.forEach(function (i) {
    if (i.status !== 'ready' && i.status !== 'in-progress') return;   // same open definition as app.ts:618/693
    var mix = i.severity != null ? sevMix![i.workstream] : null;
    if (mix && mix[i.severity as keyof SevMix] !== undefined) mix[i.severity as keyof SevMix]++;
  });
}
```

This block belongs at the top of `renderBoard()` (app.ts, currently starting line 115), before the
`STATUS_ORDER.forEach` loop that does the per-column sort — the mix is global across all
workstreams, not per status column, so it must not be recomputed inside that loop.

### Comparator change

Today's comparator (`renderBoard()`, currently app.ts:129-134):

```ts
items.sort(function (a, b) {
  var cmp;
  if (sortKey === 'id') cmp = wsIdNum(a.id) - wsIdNum(b.id);
  else cmp = a.title.localeCompare(b.title);
  return sortDir === 'asc' ? cmp : -cmp;
});
```

becomes a three-way dispatch. `else` (unconditional "name") becomes an explicit `sortKey === 'name'`
check, with `severity` as the new final branch:

```ts
function severityCmp(x: SevMix, y: SevMix) {
  // x more severe than y  =>  negative  =>  x sorts first under the existing
  // "sortDir === 'asc' ? cmp : -cmp" trailer, unmodified.
  return (y.critical - x.critical) || (y.high - x.high) || (y.medium - x.medium) || (y.low - x.low);
}
// ...
items.sort(function (a, b) {
  var cmp;
  if (sortKey === 'id') cmp = wsIdNum(a.id) - wsIdNum(b.id);
  else if (sortKey === 'name') cmp = a.title.localeCompare(b.title);
  else cmp = severityCmp(sevMix![a.id], sevMix![b.id]);
  return sortDir === 'asc' ? cmp : -cmp;
});
```

`severityCmp(a, b)` deliberately compares `y` minus `x` (operands reversed from the `id`/`name`
branches' `a - b`) — that inversion is the entire mechanism behind "Asc" meaning
most-severe-first for this key while still meaning literal-ascending for the other two, without
touching the shared trailer line. All-zero vs all-zero yields `0` on every term, i.e. a tie, which
falls through to sort stability per Acceptance criterion 8.

**Rejected: packing the tuple into one integer** (e.g. `critical*1000 + high*100 + medium*10 + low`).
The card flagged this needs checking against real project data for a per-tier cap the packing would
silently assume. Current data has zero open issues anywhere (Assumption 6), so that check cannot be
answered from evidence either way — and there's no reason to accept the risk: four chained
subtractions cost the same O(1)-per-comparison as one integer subtraction, with no cap to violate,
ever. The tuple-compare above is adopted outright rather than packed-with-a-caveat.

### Markup change

`board.html`'s `#sort-key-seg` (currently lines 33-36):

```html
<div class="seg" id="sort-key-seg">
  <button data-key="id" class="active">Artefact ID</button>
  <button data-key="name">Name</button>
</div>
```

gains one line, `<button data-key="severity">Severity</button>`, after the "Name" button. No CSS
change: `.seg` (`styles.css:238`) is `display: inline-flex` with no fixed width or child-count
assumption, and `.seg button` (`styles.css:239-247`) sizes to its own padding/label — a third pill
costs nothing extra. The click handler at `app.ts:157-163` already reads `btn.dataset.key`
generically and needs no change to recognise the new value.

### What each piece knows / must not know

- The `sevMix` computation knows workstream ids and the `issues` array; it must not know about
  rendering (`el()`, DOM) or about `id`/`name` sort semantics.
- `severityCmp` knows only two `SevMix` values; it must not know how the mix was computed, matching
  `wsIdNum` and `localeCompare`'s existing role as pure per-key comparison logic.
- `board.html` knows only that a `data-key="severity"` button exists; it carries no severity
  vocabulary itself (colors, labels) — that stays in `app.ts`'s `SEV_ORDER`/`SEV_LABEL` (app.ts:4-5)
  and `styles.css`'s `--sev-*` custom properties, neither of which this feature touches or needs to,
  since no visual affordance is in scope.

## Staged task breakdown

Small enough for one stage; three small tasks, sequenced so each leaves the app in a working state.

**Stage 1 — Severity as a third sort key** (small-medium overall)

1. **Markup: add the `Severity` pill.** File: `src/public/board.html`. Add
   `<button data-key="severity">Severity</button>` to `#sort-key-seg`. Effort: small. Depends on:
   nothing. Verify: `npm run build` succeeds (no TS involved in this step, but keeps the build green
   between commits); reload the board and confirm a third pill renders and is clickable (it will not
   yet change ordering until task 2 lands).

2. **Logic: severity-mix precompute + comparator branch.** File: `src/public/app.ts`. Add the
   `SevMix` type, the `sevMix` precompute block, `severityCmp`, and the three-way comparator dispatch
   as in Design. Effort: medium — the only genuinely new logic in this feature. Depends on: task 1
   (so the button exists to exercise it, though the code compiles independently). Verify: `npm run
   build` (both tsconfig projects) with zero errors; `dist/public/app.js` still has no
   `import`/`export`.

3. **Manual verification against fixture data.** No code changes. Because the project's own
   `flowcharge/` currently has zero open issues (Assumption 6), temporarily edit one or two issues'
   `status` to `ready` and vary `severity` across a couple of workstreams (or point the running
   server, via the home page's "add project" form, at a second local `flowcharge/` tree with real open
   issues, if one is available) — confirm criteria 2, 5, 6, 7, 8 by eye — then revert the temporary
   edits (`git checkout` / `git status` clean) before considering the stage done. Effort: small.
   Depends on: task 2.

## Data & compatibility

No migrations — no data model changes anywhere. Fully backward compatible: `id` and `name` sorting
are unmodified (criterion 7), the wire payload is unmodified (criterion 9), and no server file is
touched (criterion 11). Rollback, if ever needed, is `git revert` on the commit(s) — same story as
WS-7, since this is the same single-user, no-persisted-state tool.

## Testing strategy

No test framework exists in this repo and this plan does not add one (matches the project's own
`README.md` and WS-7's precedent) — `npm run build` plus the manual walkthrough in Stage 1 task 3 is
the verification. For a later `write-tests` pass, if a framework ever lands:

- `severityCmp` is the one pure, easily unit-testable piece here: given two `SevMix` values, assert
  the sign of the result for a critical-vs-many-highs case (the card's own worked example), a tie
  down to the last tier, and an all-zero-vs-all-zero tie.
- The `sevMix` precompute is a pure function of `(workstreams, issues)` → `Record<string, SevMix>`;
  a fixture with a mix of `ready`/`in-progress`/`done` issues across a couple of workstreams
  (including one with no issue list at all) would pin acceptance criterion 5 directly.
- Integration-level, `renderBoard()`'s existing `id`/`name` sorting needs no new coverage — it is
  unchanged.

## Open questions

1. **Deployment and release constraints — confirming there are none.** Assumed per Assumption 1:
   no production data, no live users, no migration, no flag needed, rollback is `git revert`. Asked
   every run because the answer varies per project.
   *Recommendation: confirm the assumption; nothing in this plan would change shape if it's wrong,
   since there's no server-side surface to stage a rollout for.*

2. **Should a visual severity cue (color, chip) be added to the Severity button or to cards**, pulling
   `SEV_ORDER`/`SEV_LABEL`/`--sev-*` the way the KPI strip and "Open issues by severity" panel already
   do? Options: (a) none — a plain-text pill, matching `Artefact ID`/`Name` exactly, this plan's
   choice; (b) a color-mixed background on the active "Severity" pill once selected, cheap and
   contained; (c) a per-card severity chip or dot, the most useful for actually reading the new order
   at a glance, but a real card-layout change touching `buildCard()` (app.ts:58-113) that the card's
   own wording didn't ask for.
   *Recommendation: (a) for this pass — ship the sort key alone, see whether the ordering alone is
   legible enough in practice (the column position already says a lot), and revisit (c) as its own
   small follow-up card if not.*

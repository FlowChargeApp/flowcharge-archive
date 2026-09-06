---
id: PLN-9-fe9rs9
type: plan
workstream: WS-9-8d98ve
slug: board-severity-cue
title: "Per-card dominant-severity dot for the board"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: []
links: []
---

# Per-card dominant-severity dot for the board

## Summary

Give every workstream card on the board a small colored dot, next to its ID in
`card-top`, showing that workstream's dominant open-issue severity — so severity is
readable at a glance under *any* sort key, not only inferable from position when
"Severity" sort happens to be active. The dot reuses the existing `SEV_ORDER`/
`SEV_LABEL` vocabulary (`src/public/app.ts:4-5`) and `--sev-critical`/`--sev-high`/
`--sev-medium`/`--sev-low` custom properties (`src/public/styles.css:28-31`, `69-72`,
`86`, `98`) — no second color scheme. "Dominant" uses the same presence-based,
worst-tier-first rule WS-8's `severityCmp` already sorts by (`SEV_ORDER.find(s =>
mix[s] > 0)`), so a card's dot color can never visually contradict where Severity
sort ranks it.

The change is entirely client-side, in `src/public/app.ts` and one CSS selector in
`src/public/styles.css`: (1) unconditionally compute the existing `sevMix` precompute
every `renderBoard()` call instead of only when `sortKey === 'severity'`, (2) add a
small `dominantSeverity()` helper next to `severityCmp`, (3) render a `.dot-sm` dot in
`buildCard()`'s `card-top`, colored via `sevMix[w.id]`, (4) generalize the existing
`.artefact-row .dot-sm` CSS rule to a bare `.dot-sm` selector so the same 6×6px dot
shape is reusable outside artefact rows, exactly as it already is inside them.

## Scope

### Acceptance criteria

1. Every card, in every status column, under any active sort key (`Artefact ID`,
   `Name`, or `Severity`) and any search/filter state, shows a small colored dot next
   to its ID in `card-top` when that workstream has at least one open (`ready` or
   `in-progress`) issue with a recognized severity.
2. The dot's color is exactly one of `--sev-critical` / `--sev-high` / `--sev-medium`
   / `--sev-low`, chosen by the first tier in `SEV_ORDER` (critical → high → medium →
   low) with a nonzero count in that workstream's `sevMix` — the same presence-based
   rule `severityCmp` already ranks by, not a most-numerous-tier (mode) rule.
3. A workstream with zero open issues in any tier (no issue list, or one with nothing
   currently `ready`/`in-progress`) shows no dot — `card-top` renders exactly as it
   does today for that workstream. No "no severity" placeholder color is invented.
4. Under Severity sort specifically, a card's dot color never visually contradicts its
   position: within one status column, a card ranked above another never shows a
   less-severe dot than one ranked below it (guaranteed by criterion 2 using the exact
   same tie-break rule as the sort itself).
5. Switching sort key or direction, or typing into the search filter, re-renders every
   visible card with a correct, non-stale dot every time (dots are rebuilt fresh in
   `buildCard()` on every `renderBoard()` call, matching the board's existing
   full-redraw pattern — no separate cache to go stale).
6. Card hover/focus/click behavior, the detail modal, and every other existing
   card element (title, tags, artefacts, foot) are visually and functionally
   unchanged; `card-top`'s existing two-item `space-between` layout (ID block vs.
   updated-date block) is unchanged.
7. `npm run build` (both `tsconfig.json` and `src/public/tsconfig.json`) completes
   with zero errors; `dist/public/app.js` remains a classic script (no
   `import`/`export`, guaranteed by `module: "none"`).
8. Zero new runtime dependencies. No server file (`src/server.ts`,
   `src/lib/extract.ts`, `src/lib/projects.ts`, `src/lib/git.ts`) touched. No change
   to the `PraxisData`/`PraxisIssue` wire shape — `sevMix` remains entirely derived
   client-side from data already in the payload.

### Out of scope

- **Coloring the "Severity" sort button, or any board-wide "worst open severity"
  aggregate** (investigation's option (b), and the "both" option (c)). See Design →
  Approach for why this is rejected rather than added as a cheap extra.
- Changing WS-8's `severityCmp` or the severity sort algorithm itself.
- Any change to the `PraxisData`/`PraxisIssue` wire shape.
- A user-configurable colour scheme or cue style — this is a fixed, coded visual
  decision.
- The home page's project tiles.
- Hoisting `renderSeverity()`'s local `counts` (app.ts:712) out of its closure — that
  computation is only relevant to the rejected sort-button-coloring option and stays
  untouched.
- DRY-ing the now-three independent `status === 'ready' || status === 'in-progress'`
  open-issue checks (`renderKpis()`, `renderSeverity()`, the `sevMix` precompute) —
  pre-existing duplication WS-8 left in place; this plan adds no new copy of the
  check and does not refactor the existing ones, matching WS-8's own precedent.

### Assumptions

1. **No deployment or release constraints apply.** Same footing as WS-7/WS-8: a
   `localhost` single-user developer tool, no production data, no live users, no
   migration, no flag needed. Rollback is `git revert`. Recorded as Open Question 1,
   asked every run per process.
2. **Approach (a) — a per-card dot — is adopted alone, without also adding (b) the
   sort-button color.** The investigation's own comparison states (a) satisfies the
   card's requirement on its own, while (b) alone would not (it only shows one
   board-wide aggregate, is least informative exactly when Severity sort is already
   active, and doesn't distinguish workstreams). Recorded as Open Question 2 in case
   the shipped dot alone still proves hard to eyeball in practice.
3. **"Dominant" is presence-based (first nonzero tier in `SEV_ORDER`), not
   most-numerous-tier.** This is the only definition that cannot visually contradict
   `severityCmp`'s own ranking (per investigation: a most-numerous rule could show a
   "medium" dot on a card that Severity-sort ranks above a "critical"-dot card, if the
   medium-dot card has more total open issues).
4. **A workstream with no open severity data renders no dot**, rather than a grey/
   neutral placeholder — keeps the four-color `--sev-*` vocabulary exactly as-is, adds
   no fifth "none" swatch.
5. **Project data currently cannot exercise this feature.** `flowcharge/workstreams/*/
   issuelist*.md` has exactly one issue list (`inline-css-extraction`), whose one
   issue is `status: done` — zero open issues project-wide. Manual verification needs
   temporary fixture data, same as WS-8's Stage 1 task 3.

## Design

### Approach: chosen and rejected

**Chosen — (a) per-card dominant-severity dot.** Directly satisfies the card's own
framing ("not just inferable from card position") because it's readable under every
sort key, not only Severity sort. It reuses `sevMix`, a structure WS-8 already built
and populates once per render; the only structural change needed is removing its
`sortKey === 'severity'` guard.

**Rejected — (b) color the Severity sort button by board-wide worst-open-severity
alone.** Investigation's own comparison: cheap, but only one aggregate — it can't
distinguish between workstreams, and it is least useful exactly when Severity sort is
already active (the worst card is already sorted first, so the button's color adds no
information a user doesn't already have from position). Since (a) alone already fully
satisfies the requirement, adding (b) as well would be scope beyond what the
workstream card asks for (YAGNI) — the card names this as one of two *alternative*
options, not a package deal, and the investigation confirms (b) alone would not have
been sufficient on its own.

**Rejected — (c) both (a) and (b).** Same reasoning as rejecting (b) alone: it is a
low-cost *addition*, not a requirement, once (a) ships. Adding it now would be
building a capability the workstream card left as an alternative, not a request —
descoped per this project's scope-discipline convention. Recorded as Open Question 2
for a future pass if (a) alone proves insufficient in practice.

**Rejected — a chip near `card-title` instead of a dot in `card-top`.** Both were
flagged as clean insertion points by investigation. A chip is more visually prominent
but costs more horizontal space and risks crowding the title's existing two-line
clamp (`.card-title`, `styles.css:325-334`); a compact dot in `card-top` mirrors the
board's own existing visual language (`column-head`'s status dot, `styles.css:292`)
and needs no new space — `card-top` already has slack (its `justify-content:
space-between` layout leaves the ID block to size to its own content).

### Data flow — unguard the existing `sevMix` precompute

`src/public/app.ts:131-139` currently reads:

```ts
if (sortKey === 'severity') {
  sevMix = {};
  workstreams.forEach(function (w) { sevMix![w.id] = { critical: 0, high: 0, medium: 0, low: 0 }; });
  issues.forEach(function (i) {
    if (i.status !== 'ready' && i.status !== 'in-progress') return;
    var mix = i.severity != null ? sevMix![i.workstream] : null;
    if (mix && mix[i.severity as keyof SevMix] !== undefined) mix[i.severity as keyof SevMix]++;
  });
}
```

The `if (sortKey === 'severity')` guard is removed; the body runs unconditionally at
the top of every `renderBoard()` call, exactly once per render (one pass to seed
zeros, one pass over `issues` to bucket — unchanged cost shape, just no longer
conditional). This is the only reason a per-card cue meaningful under every sort key
is possible: `buildCard()` must never see a stale or `null` `sevMix` when the active
sort key isn't `severity`.

### `dominantSeverity()` — new, pure helper

Placed next to `severityCmp` (`app.ts:50-52`), matching its calling convention (a pure
function of one/two `SevMix` values, no DOM, no rendering knowledge):

```ts
function dominantSeverity(mix: SevMix): string | null {
  var found = SEV_ORDER.find(function (s) { return mix[s as keyof SevMix] > 0; });
  return found || null;
}
```

`SEV_ORDER.find` walks `['critical', 'high', 'medium', 'low']` in that fixed order —
the identical presence-based rule `severityCmp` uses for its own tie-break chain, so
`dominantSeverity` and the sort can never disagree (criterion 4). `Array.prototype
.find` is available under the `es2020` lib target (`src/public/tsconfig.json:3`); no
arrow function is introduced (project convention, confirmed: `app.ts` uses `function`
-keyword callbacks throughout, no `=>` callback exists in the file today).

### `buildCard()` — render the dot in `card-top`

`buildCard()` (`app.ts:64-119`) already runs after `sevMix` is fully populated for
every workstream (investigation-verified: it's called from `renderBoard()`'s
per-column loop, which runs after the precompute block), so `sevMix![w.id]` is safe to
read with no ordering hazard — same guarantee the comparator already relies on.

Current `card-top` block (`app.ts:71-77`):

```ts
var top = el('div', 'card-top');
top.appendChild(el('div', 'card-id', w.id));
var upd = el('div', 'card-id', fmtDate(w.updated));
upd.style.fontWeight = '400';
upd.style.color = 'var(--ink-faint)';
top.appendChild(upd);
card.appendChild(top);
```

becomes:

```ts
var top = el('div', 'card-top');
var idWrap = el('div', 'card-id');
idWrap.style.display = 'flex';
idWrap.style.alignItems = 'center';
idWrap.style.gap = '4px';
var dominant = dominantSeverity(sevMix![w.id]);
if (dominant) {
  var sevDot = el('span', 'dot-sm');
  sevDot.style.background = 'var(--sev-' + dominant + ')';
  sevDot.title = SEV_LABEL[dominant] + ' severity (open issues)';
  idWrap.appendChild(sevDot);
}
idWrap.appendChild(document.createTextNode(w.id));
top.appendChild(idWrap);
var upd = el('div', 'card-id', fmtDate(w.updated));
upd.style.fontWeight = '400';
upd.style.color = 'var(--ink-faint)';
top.appendChild(upd);
card.appendChild(top);
```

`card-top`'s CSS (`styles.css:318`, `display: flex; justify-content: space-between`)
still sees exactly two children — the ID block and the date block — so its layout is
unchanged; the dot lives *inside* the first child rather than as a third flex item,
which is what keeps `space-between` from spreading three items apart oddly. The
`display: flex` used to align the dot with the ID text is set inline on this specific
`idWrap` instance only, the same convention `upd.style.fontWeight`/`upd.style.color`
already use one line below — the shared `.card-id` CSS class itself is untouched, so
the `updated`-date use of `.card-id` (`upd`) is unaffected.

`buildCard()` reads only `sevMix[w.id]` — a fixed 4-key object — never `issues`
directly; this is unchanged from what WS-8 already guaranteed for the comparator, and
this feature must preserve it (per investigation's performance note) rather than
re-deriving a workstream's issues from the full `issues` array per card, which would
silently regress from O(n) to O(workstreams × issues) per render.

### CSS — generalize `.dot-sm` to a bare selector

`src/public/styles.css:352` currently reads:

```css
.artefact-row .dot-sm { width: 6px; height: 6px; border-radius: 50%; flex: none; }
```

becomes:

```css
.dot-sm { width: 6px; height: 6px; border-radius: 50%; flex: none; }
```

This is the one CSS change this feature needs. `.dot-sm` was scoped to `.artefact-row`
descendants only; the new `card-top` dot lives outside `.artefact-row`, so the bare
selector is required for the dot to actually render at its intended 6×6px circular
size (an unscoped rule change, not a new rule — DRY: the existing artefact-row dot
already gets its color set inline via `dot.style.background`, `app.ts:102`, so
generalizing the *shape* selector introduces no new coloring mechanism). The existing
artefact-row usage (`app.ts:101-103`) still matches the bare selector — a descendant
still matches a class selector with no ancestor restriction — so no visual change
there.

### What each piece knows / must not know

- The `sevMix` precompute knows workstream ids and the `issues` array; it must not
  know about rendering (`el()`, DOM) or which sort key is active — this is exactly why
  removing the guard is the whole mechanism: the precompute becoming
  sort-key-agnostic is what lets `buildCard()` use it unconditionally.
- `dominantSeverity()` knows only a single `SevMix` value and `SEV_ORDER`; it must not
  know how the mix was computed, matching `severityCmp`'s existing role as pure,
  render-blind comparison logic.
- `buildCard()`'s new dot-rendering code knows `sevMix[w.id]` and `SEV_LABEL` (for the
  tooltip); it must not know the active `sortKey`/`sortDir` — the entire point of the
  cue is that it looks identical regardless of which sort is active, decoupling the
  visual cue from the current sort.
- `.dot-sm` (CSS) knows only a shape (6×6px circle); it must not know about severity
  or status color — coloring stays inline per the existing convention, both for the
  artefact-row dot and the new severity dot.

## Staged task breakdown

Small enough for one stage; four small tasks, sequenced so the app stays in a working
state after each and the visible change lands last.

**Stage 1 — Per-card severity dot**

1. **CSS: generalize `.dot-sm` to a bare selector.** File: `src/public/styles.css`.
   Change `.artefact-row .dot-sm { ... }` (line 352) to `.dot-sm { ... }`. Effort:
   small. Depends on: nothing. Verify: reload the board; existing artefact-row dots
   (non-progress artefact rows inside cards) are visually unchanged.

2. **Logic: unguard `sevMix` + add `dominantSeverity()`.** File: `src/public/app.ts`.
   Remove the `if (sortKey === 'severity')` guard around the precompute block
   (currently lines 131-139), leaving its body unconditional; add `dominantSeverity()`
   next to `severityCmp` (currently lines 50-52), as in Design. Effort: small. Depends
   on: nothing (independent of task 1). Verify: `npm run build` (both tsconfig
   projects) with zero errors; switching sort keys still sorts identically to before
   (no visible change yet — `sevMix` is now always populated, but nothing reads it
   outside `severity` sort until task 3).

3. **Rendering: dot in `card-top`.** File: `src/public/app.ts`. Replace the `card-top`
   block in `buildCard()` (currently lines 71-77) with the `idWrap`-based version in
   Design. Effort: small-medium — the only genuinely new rendering logic in this
   feature. Depends on: tasks 1 and 2 (needs the bare `.dot-sm` selector to render at
   the right size, and `sevMix`/`dominantSeverity` to be ready). Verify: `npm run
   build` with zero errors; `dist/public/app.js` still has no `import`/`export`.

4. **Manual verification against fixture data.** No code changes. The project's own
   `flowcharge/` currently has zero open issues (Assumption 5), so temporarily edit one
   or two issues' `status` to `ready`/`in-progress` and vary `severity` across a
   couple of workstreams (or point the server at a second local `flowcharge/` tree with
   real open issues, via the home page's "add project" form, if one is available).
   Confirm: a dot appears only on workstreams with open issues, in the correct color
   (criteria 1-3); the dot's color and the Severity-sort position never disagree
   (criterion 4); switching sort key/direction and typing a search filter keeps every
   dot correct with no staleness (criterion 5); no other card element visibly moved
   (criterion 6). Revert the temporary fixture edits (`git status` clean) before
   considering the stage done. Effort: small. Depends on: task 3.

## Data & compatibility

No migrations, no data model changes. Fully backward compatible: the wire payload is
unmodified (criterion 8), `id`/`name`/`severity` sort behavior is unmodified
(criterion 4 only adds a consistency guarantee, doesn't change ranking), and no server
file is touched. Rollback, if ever needed, is `git revert` on the commit(s) — same
story as WS-7/WS-8, since this is the same single-user, no-persisted-state tool.

## Testing strategy

No test framework exists in this repo and this plan does not add one (matches the
project's own precedent, most recently WS-8) — `npm run build` plus the manual
walkthrough in Stage 1 task 4 is the verification. For a later `write-tests` pass, if
a framework ever lands:

- `dominantSeverity()` is the one new pure, easily unit-testable piece here: given a
  `SevMix`, assert the returned tier for a single-critical mix, a tie down to `low`,
  and an all-zero mix returning `null`.
- The unguarded `sevMix` precompute is otherwise already covered by WS-8's own
  testing notes (same function, now called unconditionally) — no new coverage shape
  needed beyond confirming it still populates correctly when `sortKey !== 'severity'`.
- Integration-level, `buildCard()`'s dot rendering would be a DOM-presence assertion:
  given a workstream with a known `sevMix`, the rendered card contains (or doesn't
  contain) a `.dot-sm` child with the expected `background` style.

## Open questions

1. **Deployment and release constraints — confirming there are none.** Assumed per
   Assumption 1: no production data, no live users, no migration, no flag needed,
   rollback is `git revert`. Asked every run because the answer varies per project.
   *Recommendation: confirm the assumption; nothing in this plan would change shape
   if it's wrong, since there's no server-side surface to stage a rollout for.*

2. **Should the sort-button color cue (rejected options (b)/(c)) be added as a
   follow-up**, once the per-card dot has been used for a while? Options: (a) no —
   the per-card dot alone fully satisfies the workstream card's requirement, this
   plan's choice; (b) yes, as a small separate follow-up workstream if the per-card
   dot alone proves hard to eyeball in practice (e.g. on a very tall column where
   dots scroll out of view).
   *Recommendation: (a) for this pass — ship the per-card dot, see whether it alone
   is legible enough in practice, and revisit (b) as its own small follow-up card
   only if not.*

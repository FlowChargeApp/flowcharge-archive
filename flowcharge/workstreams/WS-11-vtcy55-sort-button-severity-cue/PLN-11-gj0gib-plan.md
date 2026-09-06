---
id: PLN-11-gj0gib
type: plan
workstream: WS-11-vtcy55
slug: sort-button-severity-cue
title: "Board-wide severity dot on the Severity sort button"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: []
links: []
---

# Board-wide severity dot on the Severity sort button

## Summary

Add a small colored dot to the "Severity" pill in `#sort-key-seg`
(`src/public/board.html:36`), showing the board's single worst open-issue severity
project-wide — a quick temperature check readable in the controls bar regardless of
which sort key is currently active. The dot reuses `SEV_ORDER`/`SEV_LABEL`
(`src/public/app.ts:4-5`), the `--sev-*` custom properties, and the `.dot-sm` shape
class WS-9 already generalized to a bare selector (`src/public/styles.css:352`) — the
same visual language as WS-9's per-card dot, deliberately, so the two severity cues
read as one system rather than two.

The computation is free: `renderSeverity()` (`src/public/app.ts:726-751`) already
builds `counts: Record<string, number>`, zeroed over `SEV_ORDER` and incremented per
open issue, on every `applyData()` call. `dominantSeverity(counts)`
(`app.ts:54-57`, added by WS-9) returns the first `SEV_ORDER` tier present, or `null`.
This plan adds roughly ten lines directly inside the existing `renderSeverity()` IIFE,
right after `counts` is computed, plus one scoped CSS rule — no new module-scope
state, no new helper function, no server change.

## Scope

### Acceptance criteria

1. Whenever at least one open (`ready`/`in-progress`) issue exists project-wide, the
   Severity pill in `#sort-key-seg` shows a small colored dot, colored by
   `--sev-critical` / `--sev-high` / `--sev-medium` / `--sev-low` according to the
   first `SEV_ORDER` tier with a nonzero board-wide count (identical presence-based
   rule `dominantSeverity` already applies for WS-9's per-card dot).
2. When zero open issues exist project-wide, the Severity pill shows no dot — matching
   WS-9's "no dot when no open issues" precedent exactly, no neutral/grey placeholder
   invented.
3. The dot is visible and correctly colored whether or not the Severity pill is the
   currently active sort key — i.e. it survives `.seg button.active`'s solid
   `background: var(--accent)` override (`styles.css:250`), which a background-tint
   treatment would not.
4. The Severity pill carries a tooltip (`title` attribute) that states the cue is
   board-wide (e.g. "Worst open severity, board-wide: Critical"), present exactly
   when the dot is present and absent when it isn't — so it never reads as if it
   describes the top-sorted card specifically.
5. The dot updates correctly on every `applyData()` call — initial load and every
   WS-7 poll-triggered re-render — independent of which sort key is active or
   whether sort/filter state changed, reflecting only the underlying open-issue data.
6. Calling `applyData()` twice with an unchanged payload leaves the pill in the same
   DOM state both times (no duplicate dot nodes, no stale `title`), preserving the
   idempotence `applyData` already guarantees elsewhere (`app.ts:583-585`).
7. The other four pills (Artefact ID, Name, Created, Updated) and the click handler's
   `.active`-toggling behavior (`app.ts:191-197`) are visually and functionally
   unchanged.
8. `npm run build` completes with zero errors across both `tsconfig.json` and
   `src/public/tsconfig.json`; `dist/public/app.js` remains a classic script (no
   `import`/`export`).
9. Zero new runtime dependencies; no server file touched; no change to the
   `PraxisData`/`PraxisIssue` wire shape.

### Out of scope

- Changing WS-8's sort algorithm, WS-9's per-card dot, or WS-10's date sort keys.
- Any change to the `PraxisData`/`PraxisIssue` wire shape.
- A user-configurable colour scheme or cue style.
- The home page's project tiles.
- Hoisting `counts` out of `renderSeverity()`'s closure into module scope — the new
  logic reads it in place, inside the same IIFE, so no extraction is needed.
- A new `dominantSeverity`-style helper — the existing one (WS-9) is reused unchanged.

### Assumptions

1. **No deployment or release constraints apply.** Same footing as WS-7/WS-8/WS-9: a
   `localhost` single-user developer tool, no production data, no live users, no
   migration, no flag needed. Rollback is `git revert`. Recorded as Open Question 1,
   asked every run per process.
2. **Treatment: a `.dot-sm` dot inside the button**, not a background tint or a
   border. Settled in Design below; recorded as Open Question 2 in case the shipped
   cue proves too subtle in practice.
3. **This project's own data currently has zero open issues** (per WS-9's plan,
   confirmed unchanged), so criterion 2 (no dot) is the default state observable
   without fixture data; criterion 1 needs temporary fixture data to verify, same as
   WS-9's manual-verification task.

## Design

### Approach: chosen and rejected

**Chosen — a `.dot-sm` dot inserted inside the Severity button, colored inline via
`style.background`.** Reuses the exact shape class and coloring convention WS-9
already established for the per-card dot (`app.ts:83-86`), so the two severity cues
on this board share one visual language. Unlike a background tint, an appended dot is
additive to the button's existing background/color — it is never overridden by
`.seg button.active`'s `background: var(--accent); color: #fff` (`styles.css:250`),
so it stays visible exactly when Severity is the active sort, which is when the cue
is checked most.

**Rejected — `color-mix()` background tint (KPI-strip chip style).** Investigation
flagged this directly: `.active`'s solid background would override any tint the
instant Severity becomes the active sort — the one moment a user is most likely to
glance at this button. Fails criterion 3 by construction.

**Rejected — text-colour-only cue.** Weakest signal of the options considered per
investigation: unreadable against `.active`'s white text, and easy to miss against
the default `--ink-soft` text on the four other pills. Also fails to visually
distinguish itself from ordinary button text at a glance.

**Rejected — a coloured border (bottom or left).** Also survives `.active` (additive,
same reasoning as the chosen dot) and was investigation's other viable option. Not
chosen because it reads as a different visual idiom from WS-9's dot — a user would
need to learn two distinct severity cues (a border here, a dot on every card) for the
same concept. A border also needs a new CSS property path (`border-bottom-color` or
`border-left`) with no existing precedent in this file, whereas `.dot-sm` is a proven,
already-generalized shape class needing zero new CSS beyond one layout rule. Kept as
the fallback if the dot proves too subtle (Open Question 2).

**Rejected — DRY-ing `renderSeverity()`'s `counts` block against `buildCard()`'s
`sevMix` precompute.** Both derive from the same `issues` array filtered identically
to "open," and produce structurally similar per-severity tallies, but `counts` is a
single board-wide total while `sevMix` is per-workstream — merging them would need a
new shared aggregation shape for no behavioural gain, and WS-9's own plan explicitly
left this class of duplication alone as pre-existing. Out of scope here for the same
reason.

### Where the logic goes

Inside the existing `renderSeverity()` IIFE (`app.ts:726-751`), directly after
`counts` is fully populated (after the `openIssues.forEach` on line 731) and before
the bar/legend rendering that already follows it:

```ts
var sevBtn = document.querySelector('#sort-key-seg button[data-key="severity"]') as HTMLElement | null;
if (sevBtn) {
  var dominant = dominantSeverity(counts);
  var dot = sevBtn.querySelector('.dot-sm') as HTMLElement | null;
  if (dominant) {
    if (!dot) {
      dot = el('span', 'dot-sm');
      sevBtn.insertBefore(dot, sevBtn.firstChild);
    }
    dot.style.background = 'var(--sev-' + dominant + ')';
    sevBtn.title = 'Worst open severity, board-wide: ' + SEV_LABEL[dominant];
  } else if (dot) {
    dot.remove();
    sevBtn.removeAttribute('title');
  }
}
```

Notes on this exact placement and shape:

- `counts: Record<string, number>` passes directly to `dominantSeverity(mix: SevMix)`
  with no cast — a `Record<string, number>` index signature structurally satisfies
  `SevMix`'s four required `number` properties in TypeScript's assignability rules,
  the same fact Context item 2 established and WS-9's own `sevMix![w.id]` call site
  relies on for an equivalent value shape.
- `document.querySelector` matches this file's existing convention: the click
  handlers at `app.ts:191-204` already call `this.querySelectorAll('button')`, so
  reaching one specific button by its `data-key` attribute via `querySelector`
  introduces no new idiom.
- The button is looked up fresh, by attribute, not cached in a module-scope var —
  `#sort-key-seg`'s five buttons are static HTML (`board.html:34-38`), never rebuilt,
  so a fresh lookup costs one query per render and avoids any risk of a stale
  reference; this matches the file's general preference for `byId()`-style lookups
  at point of use over precomputed DOM handles.
- **Idempotence (criterion 6):** the dot is looked up before being created
  (`sevBtn.querySelector('.dot-sm')`) and reused if present — only its `background`
  and the button's `title` are written on a repeat call with the same `dominant`,
  producing identical DOM state. When `dominant` flips to `null` (open issues drop to
  zero on a poll), the existing dot node and `title` attribute are explicitly removed
  rather than left stale.
- `dominant` is narrowed from `string | null` to `string` by the `if (dominant)`
  check before indexing `SEV_LABEL[dominant]` — the identical pattern WS-9 already
  uses at `app.ts:81-86`, so this type-checks the same way.

### CSS — one new rule, scoped to the Severity button only

```css
.seg button[data-key="severity"] { display: inline-flex; align-items: center; gap: 4px; }
```

`.dot-sm` (`styles.css:352`, already a bare, ready-to-reuse selector since WS-9) sets
only `width`/`height`/`border-radius`/`flex: none` — these have no visible effect on
a plain inline `<span>` outside a flex container, so the button needs `display:
inline-flex` for the dot to actually render as a 6×6px circle (the same reason WS-9's
dot works inside `idWrap`, which sets `display: flex` inline at `app.ts:78`).

This rule is scoped to `.seg button[data-key="severity"]` specifically, not the bare
`.seg button` selector all five pills share (`styles.css:239-247`) — the other four
pills never carry a dot, so broadening the shared rule would be an unnecessary blast
radius for zero behavioural gain on those buttons. `.dot-sm`'s own shape rule stays
untouched; only this one new, narrowly-scoped layout rule is added.

### What this piece knows / must not know

- The new logic knows `counts` (already computed, same IIFE), `dominantSeverity`,
  `SEV_LABEL`, and the `#sort-key-seg button[data-key="severity"]` DOM node. It must
  not know `sortKey`/`sortDir` — the entire point is that the cue is identical
  regardless of which sort is currently active, exactly mirroring WS-9's stated
  constraint for the per-card dot.
- It must not know about `sevMix` (the per-workstream structure) — board-wide and
  per-workstream severity are deliberately two independent aggregates over the same
  `issues` array, per Context item 7; conflating them would risk drift between what
  the dot shows and what `renderSeverity()`'s own bar/legend already show for the
  same `counts`.

## Staged task breakdown

Small enough for a single stage; three small tasks, sequenced so the app stays
working after each and the visible change lands last.

**Stage 1 — Severity-button dot**

1. **CSS: add the scoped layout rule.** File: `src/public/styles.css`. Add
   `.seg button[data-key="severity"] { display: inline-flex; align-items: center;
   gap: 4px; }` near the existing `.seg` rules (`styles.css:238-251`). Effort: small.
   Depends on: nothing. Verify: reload the board; all five pills render identically
   to before (no dot exists yet to lay out).

2. **Logic: render/update the dot inside `renderSeverity()`.** File:
   `src/public/app.ts`. Insert the block from Design directly after `counts` is
   populated in the existing `renderSeverity()` IIFE (currently ending line 731).
   Effort: small. Depends on: task 1 (dot needs the layout rule to render at the
   right size). Verify: `npm run build` (both tsconfig projects) with zero errors;
   `dist/public/app.js` still has no `import`/`export`.

3. **Manual verification against fixture data.** No code changes. The project's own
   `flowcharge/` currently has zero open issues (Assumption 3), so temporarily edit one
   or two issues' `status` to `ready`/`in-progress` with varying `severity` values.
   Confirm: the dot appears only when open issues exist, in the correct color
   (criteria 1-2); it stays visible and correctly colored when the Severity pill is
   clicked active (criterion 3); the `title` tooltip is present exactly when the dot
   is, and reads as board-wide (criterion 4); toggling between zero and nonzero open
   issues across two `applyData()`/poll cycles updates the dot with no duplicate node
   or stale tooltip (criteria 5-6); the other four pills and the click-to-sort
   behavior are unaffected (criterion 7). Revert the temporary fixture edits (`git
   status` clean) before considering the stage done. Effort: small. Depends on: task
   2.

## Data & compatibility

No migrations, no data model changes. Fully backward compatible: the wire payload is
unmodified (criterion 9), no sort behavior changes (criterion 7), and no server file
is touched. Rollback, if ever needed, is `git revert` on the commit(s) — same story
as every prior workstream this session.

## Testing strategy

No test framework exists in this repo and this plan does not add one, matching the
project's own precedent (WS-7/WS-8/WS-9) — `npm run build` plus the manual
walkthrough in Stage 1 task 3 is the verification. For a later `write-tests` pass, if
a framework ever lands:

- No new pure function is introduced (`dominantSeverity` is reused unchanged and
  already covered by WS-9's own testing notes), so there is nothing new to unit-test
  in isolation.
- Integration-level, the dot-render/remove logic would be a DOM-presence assertion:
  given a `counts` value with a known dominant tier, the Severity button contains (or
  doesn't contain) a `.dot-sm` child with the expected `background` style and
  `title`; and calling the render logic twice with the same `counts` leaves exactly
  one `.dot-sm` node (idempotence, criterion 6).

## Open questions

1. **Deployment and release constraints — confirming there are none.** Assumed per
   Assumption 1: no production data, no live users, no migration, no flag needed,
   rollback is `git revert`. Asked every run because the answer varies per project.
   *Recommendation: confirm the assumption; nothing in this plan would change shape
   if it's wrong, since there's no server-side surface to stage a rollout for.*

2. **Is the dot cue expressive enough, or should the fallback border treatment be
   used instead (or added alongside)?** Options: (a) dot only, this plan's choice —
   consistent with WS-9's visual language, lowest implementation cost; (b) border
   only — also survives `.active`, but introduces a second severity-cue idiom
   alongside WS-9's dot; (c) both — strictly more visual weight, not requested by the
   workstream card. *Recommendation: (a) for this pass; revisit (b)/(c) only if the
   dot alone proves too subtle in practice, as its own small follow-up.*

3. **Exact tooltip wording.** This plan settles on "Worst open severity, board-wide:
   {Label}" to satisfy criterion 4's board-wide-scope requirement. No alternative
   wording was specified by the workstream card. *Recommendation: ship as worded;
   it's a one-line string change if different wording is preferred later, with no
   structural impact.*

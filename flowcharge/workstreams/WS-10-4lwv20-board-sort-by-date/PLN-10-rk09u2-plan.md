---
id: PLN-10-rk09u2
type: plan
workstream: WS-10-4lwv20
slug: board-sort-by-date
title: "Add Created and Updated as two more board sort keys"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: []
links: []
---

# Add Created and Updated as two more board sort keys

## Summary

Add two more pills, `data-key="created"` and `data-key="updated"`, to the existing
`#sort-key-seg` control in `src/public/board.html` (after `id`/`name`/`severity`,
which already exist from WS-8/WS-9), and two more branches in `renderBoard()`'s
comparator in `src/public/app.ts`. Both new keys order workstreams by a straight
string compare on `PraxisWorkstream.created`/`.updated` — the same
`localeCompare`-style one-liner the existing `name` branch already uses, not a
`Date` parse. `created`/`updated` are stored as strict zero-padded `YYYY-MM-DD`
with no time component (confirmed across every workstream file in this repo), and
lexicographic order over that format equals chronological order, so a plain string
compare is correct, cheaper, and sidesteps the timezone question `daysSince()`
(app.ts:27-31) has to handle for its own, unrelated delta-arithmetic use of `Date`.

"Asc" for both new keys means literal ascending — earliest date first — matching
how `id`/`name` already treat "Asc" as literal-ascending. This deliberately does
**not** follow `severity`'s reversed-operand trick (WS-8), because nothing in the
card asks for a "most recent first" default the way it asked for "most severe
first"; literal ascending is the unsurprising reading and needs no special-casing
of the shared `sortDir === 'asc' ? cmp : -cmp` trailer.

The one real design decision beyond the mechanical pill-plus-branch pattern is the
**card display gap**: today the card shows `updated` (via `fmtDate(w.updated)` in
two places) but never `created` anywhere. Sorting by "Created" without showing it
anywhere would leave the user unable to see the value they asked to sort by. This
plan closes that gap with the smallest possible change: the existing footer line
that renders `'updated ' + fmtDate(w.updated)` becomes `'created ' +
fmtDate(w.created) + ' · updated ' + fmtDate(w.updated)`, reusing the same DOM
node and CSS class (`.card-foot .updated`) rather than adding a new element or
stylesheet rule. This runs for every card regardless of the active sort key —
simplest to reason about, and avoids coupling `buildCard()` to module-scoped
`sortKey` (which it does not read today for any other key either: `id` is already
shown via `card.dataset.ws`/`idWrap`, `name` via `card-title`, `severity` via the
per-card dominant-severity dot from WS-9).

## Scope

### Acceptance criteria

1. `#sort-key-seg` in `board.html` gains two more buttons, in this order after the
   existing three: `<button data-key="created">Created</button>` and
   `<button data-key="updated">Updated</button>`. The three existing buttons and
   the control's click handler (`app.ts:189-195`, which already reads
   `btn.dataset.key` generically) are unmodified.
2. Clicking "Created" re-renders the board sorted, independently within each
   status column, by each workstream's `created` date string, ascending (earliest
   first) when "Asc" is active, descending (latest first) when "Desc" is active.
3. Clicking "Updated" does the same for `updated`.
4. Both comparisons are plain string comparison (`localeCompare`, matching the
   `name` branch's own style) over the raw `YYYY-MM-DD` value — no `Date` object
   construction, no reformatting.
5. Switching to "Created" or "Updated" and back to any of `id`/`name`/`severity`
   restores their exact prior ordering and semantics; none of the three existing
   keys' behavior changes.
6. Two workstreams with an identical `created` (or `updated`) value keep a stable,
   repeatable relative order across re-renders of the same underlying data,
   relying on `Array.prototype.sort`'s stability guarantee — the same precedent
   `id`/`name`/`severity` already rely on (`src/public/tsconfig.json`'s `es2020`
   target guarantees this). No synthetic secondary sort key (e.g. `id`) is added
   for `created`/`updated`.
7. Every card, regardless of the active sort key, displays both `created` and
   `updated` (currently only `updated` is shown). The existing footer line in
   `buildCard()` that renders `fmtDate(w.updated)` is extended to also render
   `fmtDate(w.created)`; both go through the existing `fmtDate()` helper (so a
   missing value still renders as `—`, unchanged behavior for that helper).
8. `npm run build` (both `tsconfig.json` and `src/public/tsconfig.json`) completes
   with zero errors; `dist/public/app.js` remains a classic script — no
   `import`/`export` (guaranteed by `module: "none"`,
   `src/public/tsconfig.json`).
9. Zero new runtime dependencies, zero server-side change. `src/server.ts`,
   `src/lib/extract.ts`, `src/lib/projects.ts`, `src/lib/git.ts` are untouched —
   `created`/`updated` are already in the wire payload
   (`PraxisData`/`BoardPayload`); this is a client-only change, consistent with
   WS-7/WS-8/WS-9's precedent.

### Out of scope

- Any change to the `PraxisData`/`PraxisWorkstream` wire shape — both `created`
  and `updated` already exist and are already typed `string`.
- A user-configurable date format or locale. The display format stays whatever
  `fmtDate()` already produces (the raw `YYYY-MM-DD` string, or `—` if empty).
- `Date`-based parsing or arithmetic of any kind for the comparator. See Summary
  for why a plain string compare is correct and sufficient for this data's format.
- Guarding against a workstream frontmatter that omits `created`/`updated`. Per
  investigation, this is a pre-existing latent gap shared by every other sort key
  (`id`/`title`/`status` are typed `string` but populated by the same unchecked
  `fmStr()` assert in `src/lib/extract.ts`); this feature accepts the same risk
  profile rather than adding new validation only for the two keys it introduces.
- WS-11's sort-button-color follow-up — a separate workstream.
- Anything to do with the home page's project tiles (`index.html`/`home.ts`).
- A per-card visual cue analogous to WS-9's severity dot (e.g. highlighting
  whichever date is currently the active sort key). The chosen fix for the
  "can't see what you're sorting by" gap is to always show both dates
  (criterion 7), which resolves the gap without any state-dependent rendering.

### Assumptions

1. **No deployment or release constraints apply.** Same footing as WS-7/WS-8: a
   `localhost:4173`, single-user developer tool — no production data, no live
   users, no migration, nothing that must stay shippable mid-feature. Rollback is
   `git revert`. Recorded as Open Question 1, asked every run per process.
2. **"Asc" = literal ascending (earliest first) for both new keys**, matching
   `id`/`name`'s existing convention rather than `severity`'s reversed one. Nothing
   in the card or investigation asks for a "most recent first" default, so the
   unsurprising reading wins (see Summary).
3. **Comparator is a plain string compare (`localeCompare`), not `Date` parsing.**
   Justified by the confirmed `YYYY-MM-DD` zero-padded format across every real
   workstream file in this repo, where lexicographic order equals chronological
   order.
4. **Tie-break is JS sort stability, not a synthetic key** — consistent with
   `id`/`name`/`severity` having none either. Investigation flagged that same-day
   ties are plausible and more common than the severity ties WS-8 already
   accepted; this plan still follows the established precedent rather than
   introducing an inconsistency only these two keys would have, since the card
   does not ask for a more deterministic tie-break and the existing precedent
   already ships without one.
5. **The card is extended to show `created` (criterion 7)** rather than left
   showing only `updated`. This settles the open UI question investigation
   flagged: sorting by a value the user cannot see anywhere on the card would be
   a real usability gap, worse than the ones any existing key has (each of
   `id`/`name`/`severity` is already visible on the card in some form).
6. **No missing-`created`/`updated` cases exist in this repo's current data**,
   confirmed during investigation — consistent with Out of scope's decision not
   to add new validation.

## Design

### Markup change

`board.html`'s `#sort-key-seg` (currently lines 33-36):

```html
<div class="seg" id="sort-key-seg">
  <button data-key="id" class="active">Artefact ID</button>
  <button data-key="name">Name</button>
  <button data-key="severity">Severity</button>
</div>
```

gains two lines, appended after "Severity":

```html
  <button data-key="created">Created</button>
  <button data-key="updated">Updated</button>
```

No CSS change: `.seg` (`styles.css:238`) is `display: inline-flex` with no fixed
width or child-count assumption, and `.seg button` (`styles.css:239-250`) sizes to
its own padding/label — this is the same extension WS-8 already confirmed going
2→3; going 3→5 costs nothing extra. `.controls` (`styles.css`) is `flex-wrap:
wrap`, so five pills plus the direction toggle and search box wrap on a narrow
viewport rather than breaking layout. The click handler at `app.ts:189-195`
already reads `btn.dataset.key` generically and needs no change to recognise the
two new values.

### Comparator change

Today's comparator (`renderBoard()`, currently `app.ts:160-166`):

```ts
items.sort(function (a, b) {
  var cmp;
  if (sortKey === 'id') cmp = wsIdNum(a.id) - wsIdNum(b.id);
  else if (sortKey === 'name') cmp = a.title.localeCompare(b.title);
  else cmp = severityCmp(sevMix![a.id], sevMix![b.id]);
  return sortDir === 'asc' ? cmp : -cmp;
});
```

`severity` is currently the implicit catch-all (`else`). This change keeps that
role unchanged and inserts two new explicit branches ahead of it, so the diff
touches only the two new lines plus one condition:

```ts
items.sort(function (a, b) {
  var cmp;
  if (sortKey === 'id') cmp = wsIdNum(a.id) - wsIdNum(b.id);
  else if (sortKey === 'name') cmp = a.title.localeCompare(b.title);
  else if (sortKey === 'created') cmp = a.created.localeCompare(b.created);
  else if (sortKey === 'updated') cmp = a.updated.localeCompare(b.updated);
  else cmp = severityCmp(sevMix![a.id], sevMix![b.id]);
  return sortDir === 'asc' ? cmp : -cmp;
});
```

Both new branches use `localeCompare`, the exact style already used for `name`,
rather than `<`/`>` — one comparison idiom for every string-valued key in this
function. No new helper function is introduced (unlike `severity`, which needed
`severityCmp` because it compares a multi-field tuple, not a single string).

### Card change

`buildCard()`'s footer (currently `app.ts:129`):

```ts
foot.appendChild(el('span', 'updated', 'updated ' + fmtDate(w.updated)));
```

becomes:

```ts
foot.appendChild(el('span', 'updated', 'created ' + fmtDate(w.created) + ' · updated ' + fmtDate(w.updated)));
```

Same DOM node, same CSS class (`.card-foot .updated`, `styles.css:354`) — zero
stylesheet change. `.card-foot` is `display: flex` with no `white-space: nowrap`
set anywhere on this span, so the browser's default text wrapping (not
horizontal overflow) handles the longer string on narrow cards; the flex row
still holds at most the same two children it does today (this span, and `deps`
when present), so `justify-content: space-between`'s behavior is unaffected. The
top-right `upd` element (`app.ts:90-93`, `card-top`) is left as-is — it already
duplicates `updated` next to the id for at-a-glance scanning, and duplicating
`created` there too was considered and rejected (see Rejected alternatives) as
more visual noise than the gap warrants.

### What each piece knows / must not know

- The two new comparator branches know only `a.created`/`a.updated` and
  `b.created`/`b.updated` as plain strings; they must not know about `Date`,
  timezones, or formatting — identical boundary to the `name` branch.
- `board.html` knows only that `data-key="created"` and `data-key="updated"`
  buttons exist; it carries no date-formatting logic itself, matching how it
  already knows nothing about `id` numeric parsing or severity vocabulary.
- The footer's new text is assembled entirely inside `buildCard()`, which already
  owns all per-card text assembly (id, title, tags, artefact rows, deps); it does
  not read `sortKey` — the display is the same regardless of which pill is
  active, keeping `buildCard()`'s existing statelessness with respect to sort
  state intact.

### Rejected alternatives

- **`Date`-parsing comparator** (`new Date(a.created).getTime() - new
  Date(b.created).getTime()`), matching `daysSince()`'s style. Rejected: adds
  parse overhead and a timezone question (`daysSince()` suffixes `'T00:00:00Z'`
  specifically to avoid this) that a plain string compare on an already
  zero-padded, unambiguous format sidesteps entirely. No behavioral difference
  in the result for this data.
- **Explicit secondary tie-break key** (e.g. `id`) for `created`/`updated` only.
  Rejected: `id`/`name`/`severity` all rely on sort stability alone; giving only
  the two new keys a synthetic secondary key would be an inconsistency the card
  did not ask for, even though ties are more likely here than for `severity`.
- **Sort-key-dependent card display** (show `created` only when "Created" is the
  active key, e.g. swapping the footer text based on `sortKey`). Rejected in
  favor of always showing both: it would couple `buildCard()` to module-scoped
  sort state for the first time, and a re-render already happens on every sort
  change regardless, so there's no performance reason to prefer the conditional
  form — always-visible is simpler and never stale.
- **A new footer element for `created`** instead of extending the existing
  `updated` span's text. Rejected: adding a third flex child changes
  `justify-content: space-between`'s spacing behavior when `deps` is also
  present (three items instead of two), where extending the existing span's text
  content changes nothing structurally.
- **Duplicating `created` next to the top-right `updated` date** (`card-top`,
  `app.ts:90-93`), matching how `updated` appears in two places today. Rejected
  as unnecessary: the footer alone satisfies "the user can see what they're
  sorting by" (criterion 7's actual goal), and adding a second copy widens
  `card-top` (already `justify-content: space-between` against the id/severity
  dot) for no discoverability gain the footer doesn't already provide.

## Staged task breakdown

Small enough for one stage; three small tasks, sequenced so each leaves the app
in a working state — same shape as WS-8's own staging.

**Stage 1 — Created/Updated as two more sort keys, plus card visibility**
(small overall)

1. **Markup: add the `Created`/`Updated` pills.** File: `src/public/board.html`.
   Add the two `<button data-key="...">` lines to `#sort-key-seg` per Design.
   Effort: small. Depends on: nothing. Verify: `npm run build` succeeds; reload
   the board and confirm two more pills render and are clickable (ordering will
   not change yet until task 2 lands).

2. **Logic: comparator branches.** File: `src/public/app.ts`. Add the two
   `else if` branches (`created`, `updated`) to the comparator per Design,
   ahead of the existing `severity` catch-all. Effort: small. Depends on: task 1
   (so the buttons exist to exercise it, though the code compiles
   independently). Verify: `npm run build` (both tsconfig projects) with zero
   errors; `dist/public/app.js` still has no `import`/`export`.

3. **Card display: show `created` in the footer.** File: `src/public/app.ts`.
   Change the footer line in `buildCard()` per Design (Card change). Effort:
   small. Depends on: nothing functionally, but grouped last so the manual
   walkthrough below exercises the full feature in one pass. Verify: `npm run
   build`; manually confirm in the browser that every card's footer now reads
   `created <date> · updated <date>`, that clicking "Created"/"Updated" +
   "Asc"/"Desc" reorders each status column correctly against the visible
   dates, that `id`/`name`/`severity` sorting is unchanged, and that same-date
   ties keep a stable order across a couple of re-renders (e.g. toggling
   search text on/off without changing the underlying data).

## Data & compatibility

No migrations — no data model changes anywhere; `created`/`updated` already exist
on `PraxisWorkstream` and are already in the wire payload. Fully backward
compatible: `id`, `name`, and `severity` sorting are unmodified (criterion 5), no
server file is touched (criterion 9). Rollback, if ever needed, is `git revert`
on the commit(s) — same story as WS-7/WS-8/WS-9.

## Testing strategy

No test framework exists in this repo and this plan does not add one (matches
the project's own precedent) — `npm run build` plus the manual walkthrough in
Stage 1 task 3 is the verification. For a later `write-tests` pass, if a
framework ever lands:

- The `created`/`updated` comparator branches are pure one-liners
  (`a.created.localeCompare(b.created)`); a fixture with a handful of
  `YYYY-MM-DD` values including duplicates would pin ascending order,
  descending order, and stability on ties directly.
- `buildCard()`'s footer text is a pure function of `(w.created, w.updated)`
  through `fmtDate()`; a fixture with one present and one empty value would pin
  the `—` fallback for each independently.
- Integration-level, `renderBoard()`'s existing `id`/`name`/`severity` sorting
  needs no new coverage — unchanged.

## Open questions

1. **Deployment and release constraints — confirming there are none.** Assumed
   per Assumption 1: no production data, no live users, no migration, no flag
   needed, rollback is `git revert`. Asked every run because the answer varies
   per project.
   *Recommendation: confirm the assumption; nothing in this plan would change
   shape if it's wrong, since there's no server-side surface to stage a rollout
   for.*

2. **Is showing both `created` and `updated` on every card (Assumption 5,
   criterion 7) the right long-term card design**, or would a later pass prefer
   the sort-key-dependent display this plan rejected (see Rejected
   alternatives), once more sort keys or a denser card layout are in play?
   *Recommendation: ship the always-visible footer now — it is the smaller,
   state-free change and fully resolves the immediate discoverability gap;
   revisit only if a future card redesign makes the footer too crowded.*

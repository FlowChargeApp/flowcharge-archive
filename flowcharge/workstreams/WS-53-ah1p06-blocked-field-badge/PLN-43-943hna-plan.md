---
id: PLN-43-943hna
type: plan
workstream: WS-53-ah1p06
slug: blocked-field-badge
title: "Drop the Blocked column and render the blocked frontmatter field as a card badge and modal line"
status: done
created: 2026-08-21
updated: 2026-08-21
depends_on: []
links: []
---

# Replace the Blocked column with a `blocked` field badge

## Summary

Upstream Praxis removed `blocked` from the workstream status enum (WS-48-nxb8ls /
PLN-36-corraz) and replaced it with an optional `blocked` frontmatter key whose
value is the reason. Presence means blocked; absence means not. A workstream can
be blocked at any status.

This dashboard still hardcodes the old model. This plan does three things:

1. Removes `blocked` from `STATUS_ORDER` and `STATUS_LABEL` in
   `src/public/app.ts`, which drops the board column, the KPI bar segment, and
   the KPI chip in one edit each, and updates the now-false six-column sentence
   in `README.md`.
2. Reads the new `blocked` key during extraction and carries it on the
   `PraxisWorkstream` payload type.
3. Renders it twice from the same in-memory board data — as a small red pill on
   the card, and as a labelled reason line at the top of the detail modal's meta
   block.

Six files change: `src/public/app.ts`, `README.md`, `src/lib/extract.ts`,
`src/types/praxis-data.d.ts`, `src/public/board.html`, and
`src/public/styles.css`. No new dependency. `src/lib/detail.ts`, `src/server.ts`,
and `electron/ipc-handlers.cts` stay untouched.

The data path copies WS-52-rjis6j / PLN-42-oldpkh exactly. That workstream adds
the sibling `description` field through the identical mechanism, and this plan
follows its precedent rather than inventing a second one.

## Scope

### Acceptance criteria

1. The board renders five columns — Backlog, Ready, In Progress, Done, Dropped —
   in that order. No Blocked column appears.
2. The KPI strip's workstream bar and chip row show those same five statuses and
   no Blocked segment or chip.
3. A workstream record whose status is an unrecognised value, including a stray
   `status: blocked`, still lands in the Backlog column through the existing
   `(byStatus[w.status] || byStatus.backlog)` fallback. No new handling is added.
4. `README.md` describes the board as five columns, naming them in the order the
   board renders them.
5. A workstream record whose frontmatter holds `blocked: "Some reason"` shows a
   small red pill reading `Blocked` on its card, on its own row directly below
   the workstream-ID and date row and directly above the card title.
6. Hovering the card pill shows the full reason text as a native tooltip.
7. The same workstream's detail modal shows the reason in full, unambiguously
   labelled, as the first line inside `.ws-modal-meta` — above the description
   line, the tags row, and the dates line.
8. A workstream record with no `blocked` key shows no pill, no modal line, and
   adds no vertical space to either the card or the modal meta block. The card
   and modal look exactly as they do before this change.
9. A `blocked` value that is empty or whitespace-only is treated exactly as
   absent, so criterion 8 applies to it.
10. `GET /api/projects/<id>/data` includes `"blocked"` on a workstream object
    that has the key, and omits the key entirely on one that does not.
11. Opening workstream A (blocked), closing it, then opening workstream B (not
    blocked) shows no blocked line for B. No stale reason carries over.
12. A reason containing `<`, `&`, `"`, or `'` renders as literal text on both the
    card tooltip and the modal line, never as markup.
13. A long reason wraps inside the modal and does not force horizontal overflow.
14. The pill is legible in all four theme blocks defined in
    `src/public/styles.css`.
15. `--st-blocked` and `--st-blocked-bg` remain defined and unmodified in all
    four theme blocks, and the Attention panel's `.attn-row .a-days` colour is
    visually unchanged.

### Out of scope

- **The pre-existing KPI undercount.** `renderKpis` counts a total over every
  workstream but draws its bar and chips only over `STATUS_ORDER`, so any
  unrecognised status already undercounts the bar today. One registered project
  outside this repository (`Praxis-Demo`) holds one workstream still at
  `status: blocked`, which will hit that path. This is a pre-existing condition
  with an unrelated cause. `renderKpis`'s counting logic is not touched and
  nothing is authored to reconcile it. (Settled decision, not an open question.)
- **`--st-blocked` and `--st-blocked-bg` in `src/public/styles.css`.** They are
  not deleted, renamed, or edited. `--st-blocked` has one live unrelated
  consumer, `.attn-row .a-days` at line 432, which supplies the Attention
  panel's stale-days colour. Deleting the pair would break that panel. This
  workstream does not touch it.
- **Migration or fallback code for records still carrying `status: blocked`.**
  The existing Backlog fallback is correct and sufficient.
- **Markdown or rich-text rendering of the reason.** It is one plain-text scalar,
  the same constraint WS-52 applies to `description`.
- **Search.** `matches()` keeps its current haystack of id, title, slug, and
  tags. The reason does not join it.
- **Writing or editing a `blocked` value.** This dashboard is read-only over
  `flowcharge/`.
- **Any new KPI, filter, or sort keyed on the blocked field.** The workstream
  asks for a column removal, an extraction, and two render sites. Nothing more.
- **`src/lib/detail.ts`, `src/server.ts`, `electron/ipc-handlers.cts`.** The
  chosen data flow needs no change in any of them.

### Assumptions

Taken as the most reasonable reading, not confirmed by a user. Each is stated so
it can be corrected before code is written.

- **A1 — WS-52 has already executed.** This plan describes
  `src/lib/extract.ts`'s `out.push({...})` literal, the `PraxisWorkstream`
  interface, and the `.ws-modal-meta` block as they read *after* WS-52's task
  list `TL-51-49a6fh` has applied its `description` changes — not as they read
  today. Both workstreams edit the same two anchors. The task list this plan
  produces must declare `depends_on: [PLN-43-943hna, TL-51-49a6fh]`, so Praxis's
  own dependency gate blocks execution until `TL-51-49a6fh` reaches
  `status: done`. This is a settled decision, recorded here as the assumption the
  edit anchors rest on.
- **A2 — Release constraints.** This is a local developer dashboard. There is no
  production deployment, no live user base, and no persisted application
  database. The only data is the user's own `flowcharge/` Markdown, which this app
  reads and never writes. No feature flag, no dark launch, and no migration are
  needed. Rollback is `git revert`.
- **A3 — Single-line values only.** `parseFrontmatter` in `src/lib/extract.ts`
  parses line by line, so it supports a single-line scalar only. Upstream defines
  `blocked` as a single-line double-quoted scalar, so this matches. A multi-line
  or folded YAML value is not supported and is not planned for.
- **A4 — No unescaping.** Neither this dashboard nor upstream Praxis unescapes
  `\"` sequences inside a quoted scalar. This plan does the same, deliberately,
  matching both upstream and WS-52.
- **A5 — Presence semantics, never boolean.** A value of `"false"` or `"no"` is
  a reason string like any other and marks the workstream blocked. Only absence,
  emptiness, or whitespace mean not blocked. No boolean coercion is added.
- **A6 — No Archive column.** This dashboard's board has no hidden Archive
  column. Archived workstreams are mixed in by their own status like any other
  record. The workstream text's mention of one is stale, and nothing in this plan
  references it.
- **A7 — README wording.** The README's board sentence changes from six columns
  to five and drops `Blocked` from the column list. The surrounding paragraph
  keeps its current wording. No other README section is edited.

## Design

### Contract 1 — the frontmatter key

Read from a workstream record's frontmatter:

```yaml
blocked: "Free text, single line, double-quoted, the reason the workstream is blocked."
```

Optional. Workstream records only. No default. Presence means blocked.

### Contract 2 — the payload type

`src/types/praxis-data.d.ts` gains one optional key on `PraxisWorkstream`, beside
the `description?: string;` key WS-52 adds:

```ts
interface PraxisWorkstream {
  // ...existing keys, unchanged...
  description?: string;   // from WS-52
  blocked?: string;
}
```

Optional, not nullable. Absent means absent — never `null`, never `''`.
`JSON.stringify` drops an `undefined` key, which is what keeps criterion 10 true
and the payload byte-identical for the entire existing corpus.

This file is an ambient global declaration shared by three tsconfig projects. It
must stay import-free and export-free, or the interfaces stop being global.
Adding one optional key does not disturb that.

### Contract 3 — the status list

`src/public/app.ts` lines 2-3 become:

```ts
var STATUS_ORDER = ['backlog', 'ready', 'in-progress', 'done', 'dropped'];
var STATUS_LABEL: Record<string, string> = { backlog: 'Backlog', ready: 'Ready', 'in-progress': 'In Progress', done: 'Done', dropped: 'Dropped' };
```

Every consumer already loops these two constants:
`renderBoard` seeds `byStatus` from `STATUS_ORDER`, then renders one column per
entry with `STATUS_LABEL[status]` as the heading. `renderKpis` seeds
`wsByStatus`, then draws one bar segment and one chip per entry. Removing the
`blocked` entry from both constants therefore removes the column, the segment,
and the chip with no other code change. `.board` is `display: flex`, not a fixed
grid, so no layout CSS changes either.

### Contract 4 — the card DOM

Built by `buildCard` in `src/public/app.ts`, inserted between
`card.appendChild(top);` and `card.appendChild(el('div', 'card-title', w.title));`:

```
var b = (w.blocked || '').trim();
if (b) {
  var row = el('div', 'card-blocked');
  var pill = el('span', 'blocked-pill', 'Blocked');
  pill.title = b;
  row.appendChild(pill);
  card.appendChild(row);
}
```

The `el()` helper assigns text through `textContent`, and `pill.title` is a
property assignment, so criterion 12 holds with no escaping helper anywhere. The
card is built fresh on every render, so there is no hide branch to write and no
stale-state path — an unblocked card simply never gains the element, which is
criterion 8.

### Contract 5 — the modal DOM

One new element in `src/public/board.html`, the **first** child of
`.ws-modal-meta`, above WS-52's description paragraph:

```html
<div class="ws-modal-meta" id="ws-modal-meta">
  <div id="ws-modal-blocked" class="ws-modal-blocked" hidden>
    <span class="blocked-pill">Blocked</span>
    <span id="ws-modal-blocked-reason"></span>
  </div>
  <p id="ws-modal-description" class="ws-modal-description" hidden></p>
  <div class="card-tags" id="ws-modal-tags" hidden></div>
  <div class="ws-modal-dates" id="ws-modal-dates"></div>
</div>
```

The pill span is static markup, so `renderModalMeta` performs exactly one
`textContent` write and one `hidden` toggle, the same shape as the tags row and
the description.

**Ordering, settled:** the blocked line sits above the description. A blocked
reason is an alert; the description is background context. Alerts read first.
WS-52's description element becomes the second child.

The wrapper ships with `hidden` already set, so an unblocked workstream shows
nothing on the very first paint, before any script runs.

### Where each piece attaches

**Extraction — `src/lib/extract.ts`.** `parseFrontmatter` needs no change. Its
key regex `/^([a-zA-Z_]+):\s*(.*)$/` already matches a `blocked` key, and its
`val.replace(/^"(.*)"$/, '$1')` already strips the surrounding double quotes. One
key joins the workstream `out.push({...})` literal, immediately after the
`description` key WS-52 adds:

```ts
blocked: typeof wsFm.blocked === 'string' ? wsFm.blocked : undefined,
```

The inline `typeof` guard, not the existing `fmStr` helper. `fmStr` is documented
in the same file as asserting `v as string` rather than coercing; using it would
type an absent field as `string` and lie to every consumer. The guard also gives
the right answer for the one odd input the parser can produce — an unquoted value
that both starts with `[` and ends with `]` is parsed into an array, and the
guard turns that into `undefined`, which is the correct graceful outcome.

Extraction does not trim, truncate, validate, or sanitise. Trimming happens at
render time only, in both render sites.

**Transport.** Nothing to do. `extractPraxisData()` returns the workstream
objects whole, `src/server.ts` spreads the payload into the
`GET /api/projects/<id>/data` response with no per-field mapping, and the
Electron proxy passes the same object through. A new optional key rides along for
free.

**Card rendering — `src/public/app.ts`.** As Contract 4. `buildCard` already
reads only from the `PraxisWorkstream` it is handed, and this addition keeps
that.

**Modal rendering — `src/public/app.ts`.** `renderModalMeta(w)` already owns the
`.ws-modal-meta` block and already handles `w === undefined` by hiding
everything. The blocked line joins it, following the shape the tags row uses:

- Fetch `ws-modal-blocked` and `ws-modal-blocked-reason` with the existing `byId`
  helper, beside the `tagsEl` and `datesEl` lookups.
- In the `if (!w)` early-return branch, clear the reason text and set the
  wrapper's `hidden = true`, beside the existing resets.
- In the main path, before the description write, trim `w.blocked` into a local.
  If it is a non-empty string, assign it with `textContent` and set the wrapper's
  `hidden = false`. Otherwise clear the text and set `hidden = true`. Absent,
  empty, and whitespace-only all take the same branch.

Because `renderModalMeta` runs synchronously at the top of `openModal`, before
`modal.showModal()`, criterion 11 falls out of the design. No reset in
`openModal` is needed, and there is no window in which the previous workstream's
reason is on screen.

The value comes from the board's already-loaded `workstreams` array — the same
source `renderModalMeta` already reads and the same source WS-52 uses. Nothing is
fetched, and `src/lib/detail.ts` is untouched.

**Styling — `src/public/styles.css`.** Two new rules, placed beside the existing
card rules:

```
.card-blocked { display: flex; margin-bottom: 5px; }
.blocked-pill {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 600;
  color: var(--sev-critical);
  background: color-mix(in srgb, var(--sev-critical) 12%, transparent);
  padding: 1px 6px;
  border-radius: 999px;
  letter-spacing: 0.02em;
}
```

Illustrative, not literal — the exact size, weight, and mix percentage are
derived from the neighbouring `.tag` rule at line 362, which is already a small
pill at `font-size: 9.5px; padding: 1px 6px; border-radius: 999px`.

Three notes on the colour, because it is the one non-obvious part:

- `--sev-critical` is the user's confirmed choice for this feature, over the
  `--st-blocked` / `--st-blocked-bg` pair. That pair is deliberately left alone.
- `--sev-critical` is defined in all four theme blocks (lines 36, 81, 102, 115)
  and is used elsewhere only as a foreground `color`, so it is already tuned to
  read as ink against each theme's paper. Using it as the pill's ink and a faint
  mix of itself as the pill's background gives criterion 14 in all four themes
  without adding a new custom property.
- Mixing with `transparent` rather than with `var(--paper)` is deliberate. The
  pill appears on two surfaces — the card, whose background is `var(--paper)`,
  and the modal meta block, which inherits the modal's. An alpha tint composites
  correctly over both from one rule. `color-mix()` is already in this stylesheet
  in the same `mix a themed variable with transparent` shape, at the two
  `::backdrop` rules on lines 683 and 801.

One further rule for the modal wrapper:

```
.ws-modal-blocked { display: flex; align-items: baseline; gap: 6px; font-size: 12.5px; color: var(--ink); overflow-wrap: anywhere; }
```

`overflow-wrap: anywhere` is criterion 13, copying the intent of the existing
`.ws-modal-title` rule. The rule must add no `display` declaration that competes
with the global `[hidden] { display: none !important; }` at line 136 — that rule
carries the `!important` that makes the attribute win over any later class rule,
and it is what makes criterion 8 true against `.ws-modal-meta`'s flex `gap: 6px`.

### What each piece must not know

- `src/lib/extract.ts` knows how to read a frontmatter key. It must not know the
  value is displayed, where, or under what conditions.
- `buildCard` knows how to paint a card from a `PraxisWorkstream`. It must not
  fetch anything and must not learn about the modal.
- `renderModalMeta` knows how to paint the meta block from a `PraxisWorkstream`.
  It must not fetch anything and must not reach into detail-payload state.
- `matches()` must not learn that `blocked` exists.

## Staged task breakdown

Four phases. Each leaves the app working if execution stops after it.

### Phase 1 — remove the Blocked column

**Build.** Remove the `blocked` entry from `STATUS_ORDER` and from
`STATUS_LABEL` in `src/public/app.ts` (lines 2-3). Update the six-column sentence
in `README.md` line 10 to name five columns.

**Files.** `src/public/app.ts`, `README.md`.

**Effort.** Small.

**Depends on.** Nothing. This phase is independent of WS-52 and touches no anchor
WS-52 touches.

**Verify.**
1. `npm run build` compiles clean.
2. Start the server. The board shows five columns in order: Backlog, Ready, In
   Progress, Done, Dropped.
3. The KPI strip's workstream bar and chip row show no Blocked segment and no
   Blocked chip.
4. `grep -n "blocked" src/public/app.ts` returns no match.
5. `grep -n "st-blocked" src/public/styles.css` still returns eight matches, and
   the Attention panel's stale-days figures still render in their red.
6. Temporarily set one local workstream record to `status: blocked`. It appears
   in the Backlog column. Revert the edit.

### Phase 2 — the field reaches the browser

**Build.** Add `blocked?: string;` to `PraxisWorkstream` in
`src/types/praxis-data.d.ts`. Add the guarded `blocked` key to the workstream
`out.push({...})` literal in `src/lib/extract.ts`.

**Files.** `src/types/praxis-data.d.ts`, `src/lib/extract.ts`.

**Effort.** Small.

**Depends on.** `TL-51-49a6fh` reaching `status: done` (assumption A1), because
both edits land beside WS-52's `description` key at the same two anchors.

**Verify.**
1. `npm run build` compiles clean across all three tsconfig projects.
2. `grep -cE '^(import|export) ' src/types/praxis-data.d.ts` returns 0, so the
   file is still an ambient global declaration.
3. Add `blocked: "Test reason with <angle> & \"quotes\"."` to one workstream
   record's frontmatter in a local `flowcharge/` tree.
4. Start the server and request `GET /api/projects/<id>/data`. That workstream
   object carries `"blocked"` with the exact text. Count the occurrences of
   `"blocked"` in the response body — exactly one, so every other workstream
   object carries no `blocked` key at all.
5. `git diff --name-only` lists neither `src/lib/detail.ts`, nor
   `src/server.ts`, nor `electron/ipc-handlers.cts`.

### Phase 3 — the card badge

**Build.** Add the `.card-blocked` and `.blocked-pill` rules to
`src/public/styles.css` beside the existing `.tag` rule. Add the badge block to
`buildCard` in `src/public/app.ts` between `card.appendChild(top);` and the
card-title append.

**Files.** `src/public/styles.css`, `src/public/app.ts`.

**Effort.** Small.

**Depends on.** Phase 2.

**Verify.** With the Phase 2 test value still in place and `npm run build` re-run
so `tools/copy-assets.mjs` republishes the assets:
1. The edited workstream's card shows a small red pill reading `Blocked`, on its
   own row below the ID/date row and above the title.
2. Hovering the pill shows the full reason. The `<angle>` text appears literally.
3. Every other card is unchanged, with no pill and no extra vertical space.
4. Cycle all four themes. The pill stays legible in each.
5. Set the test value to `blocked: "   "`. Reload. No pill appears.
6. `git diff -- src/public/styles.css` is purely additive — no existing rule was
   modified or removed, and `--st-blocked` and `--st-blocked-bg` are untouched.
7. Searching for a word that appears only in the reason matches nothing.

### Phase 4 — the modal line

**Build.** Add the `#ws-modal-blocked` wrapper as the first child of
`.ws-modal-meta` in `src/public/board.html`, above WS-52's
`#ws-modal-description`. Add the `.ws-modal-blocked` rule to
`src/public/styles.css`. Extend `renderModalMeta` in `src/public/app.ts` to write
and hide it.

**Files.** `src/public/board.html`, `src/public/styles.css`,
`src/public/app.ts`.

**Effort.** Small.

**Depends on.** Phase 3 for the shared `.blocked-pill` rule, and on
`TL-51-49a6fh` for the `.ws-modal-meta` anchor.

**Verify.** With the Phase 2 test value still in place and `npm run build`
re-run:
1. Open the edited workstream's card. The modal shows the pill and the full
   reason as the first line in the meta block, above the description line, the
   tags row, and the dates line. The `<angle>` text appears literally.
2. Close it and open a workstream with no `blocked` key. No blocked line appears,
   and the meta block spacing matches a pre-change screenshot.
3. Set the test value to `blocked: "   "`. Reload. The modal shows no blocked
   line.
4. Set the test value to 500 characters. The line wraps inside the modal with no
   horizontal scrolling.
5. `grep -n 'innerHTML' src/public/app.ts` shows every match is still a clear
   (`= ''`), with no HTML content write added.
6. `git diff -- src/public/app.ts | grep -c 'matches'` returns 0, proving the
   search haystack was not touched.
7. Remove the temporary `blocked` line from the workstream record and confirm
   that `flowcharge/` tree is back to unmodified.

## Data & compatibility

- **Migrations.** None. There is no database and no persisted app state.
- **Backward compatibility of the field.** Additive and total. No workstream
  record anywhere yet carries a `blocked` key. Each one produces `undefined`,
  `JSON.stringify` drops the key, and the payload is byte-identical to today's.
- **Backward compatibility of the column removal.** Not additive, and the one
  place it shows is worth stating plainly. A record still holding
  `status: blocked` moves from its own column into Backlog. One such record
  exists, in the registered `Praxis-Demo` project outside this repository. It is
  read-only data this dashboard never writes, and the Backlog fallback is the
  intended landing place. The KPI bar undercount that record triggers is
  pre-existing and explicitly out of scope.
- **Forward compatibility.** An older build of this dashboard reading a newer
  `flowcharge/` tree ignores the key, exactly as it does today. There is no version
  handshake to break.
- **Client compatibility.** `blocked` is optional on the interface, so every
  existing producer and consumer of `PraxisWorkstream` still typechecks with no
  edit.
- **Rollback.** `git revert` per phase, then `npm run build`. The feature writes
  nothing to disk, so there is nothing to undo beyond the code. Reversible after
  any phase.
- **Non-functional.** The value is read once per extraction pass from frontmatter
  the parser already reads line by line — no new file reads, no new I/O, no
  measurable cost. The dashboard binds to loopback by default and serves the
  user's own local `flowcharge/` files, so the new field introduces no new trust
  boundary: the same person who writes the reason reads it. The only injection
  surface is the DOM write, which `textContent` and the `title` property
  assignment both close. Existing request logging in `src/server.ts` is
  sufficient observability for a field that cannot fail independently of the
  payload it rides in.

## Testing strategy

This repository has no test framework and no test directory. `npm run build` is
the only automated gate, and it is a TypeScript compile. This section is a
pointer for a later pass with the write-tests skill, not a request to add a test
runner as part of this feature.

- **Compile-time (available now).** `npm run build` runs `tsc` over the library,
  the browser bundle, and the Electron main process. It catches a mistyped key
  and any consumer the optional field breaks.
- **Unit, if a runner is later added.** `parseFrontmatter` and the workstream
  extraction path are pure functions over a string and a directory: a record with
  a quoted `blocked`, a record with none, an empty value, a whitespace-only
  value, a value containing `<` and `&`, and a bracketed unquoted value that the
  parser turns into an array. Assert that the absent case yields no `blocked` key
  after a `JSON.stringify` round trip.
- **Integration, if a runner is later added.** One assertion on
  `GET /api/projects/<id>/data` against a fixture `flowcharge/` tree: the blocked
  workstream carries the reason, the unblocked one carries no key.
- **Manual (this feature's real gate).** The per-phase verification steps above
  are the acceptance test. They cover all fifteen acceptance criteria.

## Open questions

None of these blocks any phase. Each has a recommendation the phases already
follow, so task authoring can proceed on all four.

1. **Where should the manual test `blocked` value live?** Options: (a) add a real
   `blocked` reason to this repository's own `WS-53-ah1p06` record and keep it,
   which dogfoods the feature and gives a permanent visual check; (b) add a
   temporary value to any local record and revert it after verification, leaving
   the repository unchanged. **Recommendation: (b),** and the phases are written
   for it. Editing a workstream record is a data change, not a code change, and
   this plan should not smuggle one in.
2. **Should the modal show the pill plus the reason, or a plain `Blocked:` text
   prefix plus the reason?** The workstream leaves the exact visual form to
   implementation judgment, requiring only that it be unambiguously labelled.
   **The plan commits to the pill,** so it reuses the card's visual token and the
   same signal reads the same in both places. Switching to a text prefix later is
   a small change confined to Contract 5 and one CSS rule. This is a taste call
   and cheap to reverse after you see it.
3. **Should the blocked reason join the search haystack?** The workstream is
   silent, and WS-52 answered the same question for `description` by leaving
   `matches()` alone. **Recommendation: leave it out,** as planned. Unlike a
   description, a blocked reason *is* visible on the board, so the argument for
   including it is stronger here than it was for WS-52. If you want it, it is a
   separate one-token change at the `matches()` haystack.
4. **Should the KPI strip gain a blocked count, now that blocked is no longer a
   status with a chip?** The workstream asks for three changes and this is not
   among them, so the plan adds nothing. **Recommendation: no for now.** Raised
   only because removing the Blocked chip does remove the one place the board
   surfaced a blocked total. If you want a count back, it is a separate
   workstream.
5. **Deployment and release constraints.** Assumption A2 takes this as a local
   developer tool with no deployment gate. Had a user been available, the
   question would have been whether any packaged Electron build is pinned to a
   released version that this UI change must be staged against.

## Alternatives considered and rejected

1. **Keep `blocked` in `STATUS_ORDER` and hide the column with CSS.** Rejected:
   it leaves a dead status value that `renderKpis` still counts and that
   `renderBoard` still allocates a bucket for, and it would make a stray
   `status: blocked` record silently invisible instead of landing in Backlog.
   Removing the two entries is both smaller and more honest.
2. **Reuse `--st-blocked` / `--st-blocked-bg` for the pill.** They are already a
   themed red pair with a matching background variable, so this is the obvious
   candidate. Rejected on two grounds: the user specifically confirmed
   `--sev-critical` for this feature, and `--st-blocked` now has exactly one
   consumer — the Attention panel's stale-days colour — so binding a second,
   unrelated meaning to it would couple the blocked badge to a variable whose
   remaining purpose is something else entirely.
3. **Add a new `--sev-critical-bg` custom property to all four theme blocks.**
   Rejected: four theme edits and a new public token to express what one
   `color-mix()` already expresses, and the mix composites correctly over both
   the card and the modal surfaces while a fixed background token would have to
   pick one.
4. **Read the reason from the detail fetch (`src/lib/detail.ts`).**
   `locateWorkstream` already keeps full frontmatter, so exposing `blocked` there
   is also a one-line change. Rejected: the detail payload arrives
   asynchronously, so the reason would pop into the modal after it is already on
   screen, and `openModal` would need an explicit reset to stop the previous
   workstream's reason showing during the load. It would also not reach the card
   at all, which needs the value at board-render time. The board data is already
   in memory and already read synchronously by both render sites.
5. **Use the existing `fmStr` helper for the new key.** Rejected: `fmStr` is
   documented in `src/lib/extract.ts` as asserting rather than coercing. It would
   type an absent `blocked` as `string`, and the payload would carry `undefined`
   behind a type that promises a string — a lie every consumer inherits.
6. **Treat `blocked` as a boolean and take the reason from somewhere else.**
   Rejected: upstream defines the key explicitly as never a boolean. Presence is
   the flag and the value is the reason. Coercing `"false"` to unblocked would
   diverge from upstream on a value that is a perfectly ordinary reason string.
7. **Put the blocked line below the description in the modal.** Rejected by the
   settled ordering decision: a blocked reason is an alert and the description is
   background context, so the alert reads first.
8. **Show the full reason as text on the card instead of a hover tooltip.**
   Rejected: the workstream settled the card visual as a pill with a tooltip,
   chosen over a plain red text label specifically to avoid competing with the
   severity dot already sitting next to the workstream ID, and card height is
   scarce on a five-column flex board.
9. **Trim the value during extraction.** Rejected: extraction reads a key and
   knows nothing about display. Trimming at both render sites keeps the payload a
   faithful copy of the frontmatter and matches WS-52's split of
   responsibilities.
10. **Add an HTML-escaping helper for the reason.** Rejected as unnecessary work
    with a real cost: it implies `app.ts` writes HTML somewhere, which it does
    not. Every text write in the file goes through `textContent` or the `el()`
    helper. An escaper would be dead code and a misleading precedent.

---
id: PLN-42-oldpkh
type: plan
workstream: WS-52-rjis6j
slug: workstream-description-in-modal
title: "Read the workstream description field and show it at the top of the detail modal"
status: done
created: 2026-08-21
updated: 2026-08-21
depends_on: []
links: []
author: Anthony Koukoullis
---

# Show the workstream `description` field in the detail modal

## Summary

Praxis workstream records now carry an optional `description` frontmatter field
(defined upstream by WS-47-shh3y3 / PLN-34-q4919b). This dashboard ignores it
today. This plan adds it to the extraction payload and paints it at the top of
the workstream detail modal.

The chosen approach reads the value from the board's already-loaded
`PraxisWorkstream` array, not from the per-workstream detail fetch. The modal
already calls `renderModalMeta(workstreams.find(...))` synchronously at
`src/public/app.ts:819`, so the description paints the instant the modal opens.
There is no fetch wait, no loading placeholder, and no window in which the
previous workstream's description is still on screen.

Three files change: `src/lib/extract.ts`, `src/types/praxis-data.d.ts`, and the
front-end pair `src/public/board.html` + `src/public/app.ts` + `src/public/styles.css`.
No new dependency. No change to the board card, `src/lib/detail.ts`,
`src/server.ts`, or `electron/ipc-handlers.cts`.

## Scope

### Acceptance criteria

1. A workstream record whose frontmatter holds `description: "Some text"` shows
   `Some text` in its detail modal, as the first line inside the meta block,
   above the tags row and the created/updated dates.
2. The identity header stays visually first: severity dot, workstream id, title,
   and status keep their current order and position above the description.
3. A workstream record with no `description` key shows no description element
   and adds no vertical gap to the modal — the modal looks byte-for-byte as it
   looks today.
4. A `description` whose value is empty or whitespace-only is treated exactly as
   absent (criterion 3 applies).
5. The description never appears on a board card, in the search haystack, in the
   card tooltip, or anywhere outside the detail modal.
6. Opening workstream A (which has a description), closing it, then opening
   workstream B (which has none) shows no description for B — no stale text
   carries over.
7. A description containing `<`, `&`, `"`, or `'` renders as literal text, never
   as markup.
8. A long description (500 characters, the upstream soft cap, or beyond) wraps
   inside the modal and does not force horizontal overflow.
9. `GET /api/projects/<id>/data` includes `"description"` on a workstream object
   that has the field, and omits the key entirely on one that does not.

### Out of scope

- The board card. The description must not reach it in any form.
- Search. `matches()` at `src/public/app.ts:83` keeps its current haystack of
  id, title, slug, and tags.
- Writing or editing a `description`. This dashboard is read-only over `flowcharge/`.
- Validating or enforcing the 500-character soft cap. Upstream Praxis warns and
  still writes the full value; this dashboard displays whatever it finds.
- Any `description` on a non-workstream record (plan, issue list, task list).
  Upstream defines the field for workstream records only.
- Markdown rendering of the description. It is plain text.
- `src/lib/detail.ts`, `src/server.ts`, `electron/ipc-handlers.cts` — the chosen
  data-flow needs no change in any of them.

### Assumptions

These were taken as the most reasonable reading rather than confirmed by a user.
Each one is stated here so it can be corrected before any code is written.

- **A1 — Release constraints.** This is a local developer dashboard. There is no
  production deployment, no live user base, and no persisted application
  database. The only "data" is the user's own `flowcharge/` Markdown, which this app
  reads and never writes. No feature flag, no dark launch, and no migration are
  needed. Rollback is `git revert`.
- **A2 — Single-line values only.** `parseFrontmatter` at `src/lib/extract.ts:17`
  parses line by line, so it supports a single-line scalar only. Upstream defines
  `description` as a single-line double-quoted scalar, so this matches. A
  multi-line or folded YAML value is not supported and is not planned for.
- **A3 — Plain text, one paragraph.** The value renders as a single paragraph.
  Newline escapes inside the value are not interpreted.
- **A4 — No unescaping.** Neither this dashboard nor upstream Praxis unescapes
  `\"` sequences inside a quoted scalar, and upstream writes the value
  unescaped. This plan does the same, deliberately, to match upstream behaviour.
- **A5 — Position within the meta block.** The description is the first child of
  `.ws-modal-meta`, under the identity header. The workstream file says "above
  whatever the modal currently shows first"; the prior investigation settled this
  as meaning the top of the modal's *content*, not above the id/title row. This
  plan treats that as decided, not open.

## Design

### Contract 1 — the frontmatter key

Read from a workstream record's frontmatter:

```yaml
description: "Free text, single line, double-quoted, soft cap 500 characters."
```

Optional. Workstream records only. No default.

### Contract 2 — the payload type

`src/types/praxis-data.d.ts:15-27` gains one optional key on `PraxisWorkstream`:

```ts
interface PraxisWorkstream {
  // ...existing keys, unchanged...
  description?: string;
}
```

Optional, not nullable. Absent means absent — never `null`, never `''`. This is
what keeps criterion 9 true: `JSON.stringify` drops an `undefined` key, so a
workstream with no description serialises exactly as it does today.

This file is an ambient global declaration shared by both compilations. It must
stay import-free and export-free, or the interfaces stop being global. Adding
one optional key does not disturb that.

### Contract 3 — the DOM element

One new element in `src/public/board.html`, the first child of `.ws-modal-meta`:

```html
<p id="ws-modal-description" class="ws-modal-description" hidden></p>
```

Written only by `renderModalMeta`. Nothing else reads or writes it.

### Where each piece attaches

**Extraction — `src/lib/extract.ts`.** `parseFrontmatter` (lines 17-34) needs no
change. Its line regex `/^([a-zA-Z_]+):\s*(.*)$/` already matches a
`description` key, and its `val.replace(/^"(.*)"$/, '$1')` already strips the
surrounding double quotes. One key joins the workstream `out.push({...})` object
literal at lines 184-196:

```ts
description: typeof wsFm.description === 'string' ? wsFm.description : undefined,
```

The `typeof` guard, not the existing `fmStr` helper. `fmStr` (line 46) asserts
`v as string` and is documented as asserting rather than coercing; using it here
would type an absent field as `string` and lie to every consumer. The guard also
gives the right answer for the one odd input the parser can produce: a value the
parser turned into an array, which happens when the value is unquoted and both
starts with `[` and ends with `]`. That yields `undefined`, which is the correct
graceful outcome.

**Transport.** Nothing to do. `extractPraxisData()` returns the workstream
objects whole. `src/server.ts:323` spreads the payload into the
`GET /api/projects/<id>/data` response with no per-field mapping. The Electron
proxy in `electron/ipc-handlers.cts` passes the same object through. A new
optional key rides along for free.

**Rendering — `src/public/app.ts`.** `renderModalMeta` (line 786) already owns
the `.ws-modal-meta` block: it writes the severity dot, the tags row, and the
dates line, and it already handles the `w === undefined` case by hiding
everything. The description joins that function, following the exact shape the
tags row already uses:

- Fetch the element with the existing `byId` helper alongside `tagsEl` and
  `datesEl`.
- In the `if (!w)` early-return branch, clear its text and set `hidden = true`.
- Otherwise: trim the value; if it is a non-empty string, assign it via
  `textContent` and set `hidden = false`; else clear the text and set
  `hidden = true`.

`textContent` is what satisfies criterion 7. `app.ts` has no `innerHTML` content
write anywhere — every `innerHTML` reference in the file is a clear (`= ''`) —
and all text reaches the DOM through the `el()` helper at line 39, which assigns
`textContent`, or through a direct `textContent` assignment. No escaping helper
is added, and none is needed.

Because `renderModalMeta` runs synchronously at the top of `openModal`
(line 819), criterion 6 falls out of the design itself: every open rewrites the
element before `modal.showModal()`. No separate reset in `openModal` is needed.

**Styling — `src/public/styles.css`.** One new rule for `.ws-modal-description`,
placed next to the existing `.ws-modal-meta` rules at lines 736-744. It sets the
body font size and a soft ink colour consistent with the surrounding meta block,
and `overflow-wrap: anywhere`, matching `.ws-modal-title` at line 715. That is
criterion 8.

The `hidden` attribute is load-bearing, not cosmetic. `.ws-modal-meta` is
`display: flex; flex-direction: column; gap: 6px` (line 736), so a
present-but-empty child would still contribute a 6px gap. The global
`[hidden] { display: none !important; }` rule at line 136 makes the attribute
win regardless of source order, exactly as it already does for `#ws-modal-tags`.
That is criterion 3.

### What each piece must not know

- `extract.ts` knows how to read a frontmatter key. It must not know that the
  value is displayed, where, or under what conditions. It does not trim,
  truncate, sanitise, or validate the value.
- `renderModalMeta` knows how to paint the meta block from a `PraxisWorkstream`.
  It must not fetch anything, and it must not reach into detail-payload state.
- The board card renderer must not learn that `description` exists.

## Staged task breakdown

Two phases. Phase 1 is verifiable on its own through the HTTP payload without
any UI change, so a stop between phases still leaves the app working.

### Phase 1 — the field reaches the browser

**Build.** Add `description?: string;` to `PraxisWorkstream` in
`src/types/praxis-data.d.ts`. Add the guarded `description` key to the workstream
object literal in `src/lib/extract.ts` (lines 184-196).

**Files.** `src/types/praxis-data.d.ts`, `src/lib/extract.ts`.

**Effort.** Small.

**Depends on.** Nothing.

**Verify.**
1. `npm run build` compiles clean.
2. Add `description: "Test description with <angle> & \"quotes\"."` to one
   workstream record's frontmatter in a local `flowcharge/` tree, directly under
   its `title` line.
3. Start the server and request `GET /api/projects/<id>/data`. The edited
   workstream object carries `"description"` with that exact text. Every other
   workstream object has no `description` key at all — confirm by counting
   occurrences of `"description"` in the response body.

### Phase 2 — the modal shows it

**Build.** Add the `<p id="ws-modal-description" class="ws-modal-description" hidden></p>`
element as the first child of `.ws-modal-meta` in `src/public/board.html`
(lines 98-101). Add the `.ws-modal-description` rule to `src/public/styles.css`
near line 744. Extend `renderModalMeta` in `src/public/app.ts` (line 786) to
write and hide the element, as described in Design.

**Files.** `src/public/board.html`, `src/public/styles.css`, `src/public/app.ts`.

**Effort.** Small.

**Depends on.** Phase 1.

**Verify.** With the Phase 1 test description still in place, and `npm run build`
run again so `copy-assets.mjs` republishes `board.html` and `styles.css`:
1. Open the edited workstream's card. The description appears as the first line
   under the id/title/status header, above tags and dates. The `<angle>` text
   shows literally as `<angle>`, not as an element.
2. Close it and open a workstream that has no description. No description line
   appears and the meta block spacing matches a pre-change screenshot.
3. Set the test value to `description: "   "`. Reload. The modal shows no
   description line.
4. Set the test value to 500 characters of text. The paragraph wraps and the
   modal does not scroll sideways.
5. Confirm no board card shows the description, and that searching for a word
   that appears only in the description matches nothing.
6. Remove the test `description` line from the workstream record.

## Data & compatibility

- **Migrations.** None. There is no database and no persisted app state.
- **Backward compatibility with existing records.** Additive and total. Almost
  none of the 47+ existing workstream records carry a `description` yet. Each one
  produces `undefined`, `JSON.stringify` drops the key, and the payload for those
  workstreams is byte-identical to today's. No existing consumer of
  `PraxisWorkstream` reads the new key, and none is changed.
- **Forward compatibility.** An older build of this dashboard reading a newer
  `flowcharge/` tree simply ignores the key, exactly as it does today. There is no
  version handshake to break.
- **Client compatibility.** `description` is optional on the interface, so any
  code path that builds or receives a `PraxisWorkstream` still typechecks
  unchanged.
- **Rollback.** `git revert` of the two commits, then `npm run build`. Nothing is
  written to disk by the feature, so there is nothing to undo beyond the code.
  Reversible at any point, including after Phase 1 alone.
- **Non-functional.** The value is read once per extraction pass from frontmatter
  the parser already reads line by line — no new file reads, no new I/O, no
  measurable cost. The dashboard binds to loopback by default and serves the
  user's own local `flowcharge/` files, so the new field introduces no new trust
  boundary: the same person who writes the description reads it. The only
  injection surface is the DOM write, which `textContent` closes. Existing
  request logging in `src/server.ts` is sufficient observability for a field that
  cannot fail independently of the payload it rides in.

## Testing strategy

This repository has no test framework and no test directory. `npm run build` is
the only automated gate, and it is a TypeScript compile. This section is a
pointer for a later pass with the write-tests skill, not a request to add a test
runner as part of this feature.

- **Compile-time (available now).** `npm run build` runs `tsc` over the library,
  the browser bundle, and the Electron main process. It catches a mistyped key
  and any consumer the optional field breaks.
- **Unit, if a runner is later added.** `parseFrontmatter` and the workstream
  extraction path are pure functions over a string and a directory, so they are
  the natural first unit targets: a record with a quoted description, a record
  with none, a record with an empty value, a value containing `<` and `&`, a
  value with a trailing comment-like fragment, and a value long enough to exceed
  the soft cap. Assert that the absent case yields no `description` key after a
  `JSON.stringify` round trip.
- **Integration, if a runner is later added.** One assertion on
  `GET /api/projects/<id>/data` against a fixture `flowcharge/` tree: the described
  workstream carries the text, the undescribed one carries no key.
- **Manual (this feature's real gate).** The Phase 2 verification steps above are
  the acceptance test. They cover all nine acceptance criteria.

## Open questions

1. **Where should the manual test description live?** Options: (a) add a real
   `description` to this repository's own `WS-52-rjis6j` workstream record and
   keep it, which dogfoods the feature and gives a permanent visual check;
   (b) add a temporary description to any local record and revert it after
   verification, leaving the repository unchanged. **Recommendation: (b).**
   Editing a workstream record is a data change, not a code change, and this plan
   should not smuggle one in. Option (a) is a good follow-up if you want it, but
   it belongs to you, not to this feature.
2. **Should search eventually match description text?** The workstream is silent
   on it, so this plan leaves `matches()` untouched. Options: (a) leave it out,
   as planned; (b) add `w.description` to the haystack at `src/public/app.ts:85`,
   a one-token change. **Recommendation: (a) for now.** Searching text a user
   cannot see on the board produces cards that match for no visible reason. If
   you want it, it is a separate one-line decision.
3. **Should the description be visually distinguished from the dates line?** The
   plan styles it as ordinary body text in the meta block. Options: (a) plain
   body text, as planned; (b) a lighter or italic treatment to read as a
   subtitle. **Recommendation: (a).** The description is content, not metadata;
   the dates line is already the faint one. This is a taste call and cheap to
   change after you see it.

Nothing in this list blocks Phase 1. Question 1 affects only the Phase 2
verification procedure; questions 2 and 3 are enhancements outside the stated
scope.

## Alternatives considered and rejected

1. **Read the description from the detail fetch (`PraxisWorkstreamDetail` in
   `src/lib/detail.ts`).** `locateWorkstream` already keeps full frontmatter in
   `found.fm`, so exposing `description` there is also a one-line change.
   Rejected: the modal's detail payload arrives asynchronously
   (`src/public/app.ts:842`), so the description would pop in after the modal is
   already on screen, and `openModal` would need an explicit reset to stop the
   previous workstream's description showing during the load. The board data is
   already in memory and already read synchronously by `renderModalMeta`. It also
   keeps `src/lib/detail.ts` and `src/server.ts` untouched, as the workstream
   requires.
2. **Use the existing `fmStr` helper for the new key.** Rejected: `fmStr` is
   documented at `src/lib/extract.ts:46` as asserting rather than coercing. It
   would type an absent `description` as `string`, and the payload would carry
   `undefined` under a type that promises a string — a lie that every consumer
   inherits.
3. **Reuse the existing `body` field instead of adding `description`.** The
   workstream object already carries `body`, the first three non-empty body
   lines. Rejected: they are different things. `body` is a derived preview of
   prose the author did not write for display; `description` is a deliberate
   one-line summary. Conflating them would show body text for every record that
   has no description, breaking acceptance criterion 3.
4. **Put the description above the identity header, literally first in the
   modal.** Rejected: it would push the workstream id, title, and status below a
   paragraph of free text, and the close button sits in that header row. The
   prior investigation settled on the top of `.ws-modal-meta`, and this plan
   treats that as decided (assumption A5).
5. **Add an HTML-escaping helper for the new value.** Rejected as unnecessary
   work with a real cost: it implies `app.ts` writes HTML somewhere, which it
   does not. Every text write in the file goes through `textContent`. Adding an
   escaper would be dead code and a misleading precedent.
6. **Render the description as Markdown.** Rejected: upstream defines a plain
   single-line scalar, nothing asks for formatting, and it would pull the plan
   into either a new dependency or a hand-rolled parser.

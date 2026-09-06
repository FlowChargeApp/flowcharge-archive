---
id: PLN-68-xa5h9a
type: plan
workstream: WS-78-0ayqeh
slug: modal-body-replaces-description
title: "Render the workstream Markdown body in the detail modal's description slot"
status: done
created: 2026-08-30
updated: 2026-08-30
depends_on: []
links: []
---

# Render the workstream body in the detail modal

## 1. Requirement

The workstream detail modal shows the `description` frontmatter field today. Change
the data source to the workstream's Markdown body. Keep the same slot, the same
"Show more" button, and the same clamp threshold. Change nothing else.

## 2. Reconnaissance — the pipeline as it is today

I traced the full path from `workstream.md` to the modal. The result is below. I am
confident about every point in this section, because I read each file.

### 2.1 The modal's data source is the BOARD payload, not the detail payload

`renderModalMeta(w)` at `src/public/app.ts:975` takes a `PraxisWorkstream`. The
caller at `src/public/app.ts:1052` gets that object from the in-memory
`workstreams` array, not from the per-open detail fetch:

```ts
renderModalMeta(workstreams.find(function (ws) { return ws.id === wsId; }));
```

This runs synchronously, before `modal.showModal()` and before the
`getWorkstreamDetail` fetch starts. The description is therefore painted at open
time, with no network wait. `syncDescriptionOverflow()` at
`src/public/app.ts:1072` runs immediately after `showModal()`, which is the only
moment the height reads are valid.

The detail payload (`PraxisWorkstreamDetail`, from `src/lib/detail.ts`) carries
plans, issue lists and task lists only. It carries no workstream body and no
description.

### 2.2 A `body` field ALREADY exists on the board payload — and it is dead

`PraxisWorkstream` at `src/types/praxis-data.d.ts:24` declares `body: string`.
`walkWorkstreams` populates it at `src/lib/extract.ts:214`. It is shipped in
every board payload and in every 5-second poll.

Nothing reads it. I grepped `src/public/app.ts`, `src/public/home.ts`,
`src/public/board.html`, `src/server.ts`, `src/scripts/` and `electron/`. There
is no `w.body` consumer anywhere. The only `.body` reads in `app.ts` are
`item.body` on a plan (line 848) and local variables.

### 2.3 The existing `body` value is lossy in two separate ways

`src/lib/extract.ts:145-146` computes the raw body like this:

```ts
const parts = wsText.split('---');
const body = (parts.length >= 3 ? parts.slice(2).join('---') : '').trim();
```

Then `src/lib/extract.ts:214` truncates it:

```ts
body: body.split('\n').filter(Boolean).slice(0, 3).join(' '),
```

Two defects follow.

1. **`split('---')` corrupts bodies.** The same file's own comment at
   `src/lib/extract.ts:18-22` documents this exact hazard, and records that 19
   plan files in the corpus hold body lines starting `---`. The file already
   ships the correct helper, `stripFrontmatter()` at `src/lib/extract.ts:47`,
   which slices from the end of an anchored match. `src/lib/detail.ts:262` uses
   that helper for plan bodies. `walkWorkstreams` does not.
2. **The value is a three-line blurb, not a body.** `filter(Boolean)` drops every
   blank line, `slice(0, 3)` keeps three lines, and `join(' ')` flattens them
   into one run. This is a shorter restatement of the body — precisely the
   redundancy this workstream exists to remove.

So the field cannot be used as-is. Fixing both defects is strictly required for
the feature, not an optional cleanup.

### 2.4 The clamp threshold is CSS, and it is line-based

`src/public/styles.css:880-885` sets `-webkit-line-clamp: 4` on
`.ws-modal-description.is-clamped`. The button appears only when the paragraph
really overflows, tested at `src/public/app.ts:1046`:

```ts
moreEl.hidden = descEl.scrollHeight <= descEl.clientHeight + 1;
```

The threshold is four rendered lines. It is measured, not counted in JavaScript.
A longer text therefore keeps the identical threshold with no code change. This
is what makes a pure source swap possible.

`#ws-modal-meta` at `src/public/styles.css:861-864` already caps its height at
`40vh` and scrolls. An expanded long body is therefore already handled.

### 2.5 The slot is plain text

`src/public/board.html:130` is a `<p>`. `src/public/app.ts:1021` writes it with
`descEl.textContent = desc`. There is no Markdown rendering and no `innerHTML`.

### 2.6 Transport

Both hosts serve the same extractor output. `src/server.ts` serves the HTTP
routes; `electron/preload.cts:16` and `electron/ipc-handlers.cts:98` serve the
Electron IPC equivalents. Neither reshapes `PraxisWorkstream`, so a change in
`extract.ts` reaches both hosts with no transport edit.

## 3. Approach

### 3.1 Chosen: make the existing `body` field full-fidelity, and render it

Two changes, both small.

1. In `src/lib/extract.ts`, replace the `split('---')` computation and the
   three-line truncation with `stripFrontmatter(wsText).trim()`.
2. In `src/public/app.ts:1019`, read `w.body` instead of `w.description`.

Everything else stays untouched: the element ids, the CSS, the clamp, the
overflow test, the click handler, and the call order in `openModal`.

Why this approach wins.

- The field, the type entry and the wire slot already exist. The change makes
  dead data correct and used. It adds no new field and no new payload shape.
- `renderModalMeta` already holds the workstream object synchronously. The
  timing dance around `showModal()` and `syncDescriptionOverflow()` is preserved
  exactly. There is no flash of empty text and no second overflow sync.
- Live refresh comes free. The 5-second board poll at `src/public/app.ts:1212`
  already refreshes `workstreams`, so an edited body is current on the next open.
- It repairs a real latent defect (2.3, item 1) that the feature depends on.

### 3.2 Rejected: put the body on the detail payload

Add `body` to `PraxisWorkstreamDetail`, fill it in `locateWorkstream`
(`src/lib/detail.ts:192`, which already reads the file text but keeps only the
frontmatter), and render it from `renderDetail`.

Rejected for three reasons.

- It changes observable behaviour. The slot would paint empty at open and fill
  when the fetch resolves. The constraint forbids new UI behaviour.
- It forces a structural edit. The description branch would have to leave
  `renderModalMeta`, and `syncDescriptionOverflow()` would need a second call
  site inside `renderDetail`. That is more churn than the chosen approach, not
  less.
- It leaves the dead, lossy `body` field in the board payload. The app would then
  carry two different notions of "the workstream body".

Its one advantage is payload size (see 6.1). That advantage does not pay for the
three costs above.

### 3.3 Rejected: render the truncated three-line body as-is

Change only `src/public/app.ts:1019` and leave `extract.ts` alone.

Rejected. The three-line join is itself a shorter copy of the body, which is the
exact redundancy being retired. It also flattens the text so far that it rarely
exceeds four lines, so "Show more" would almost never appear. The `split('---')`
corruption would remain.

## 4. Contracts

One type changes in meaning, none in shape.

`PraxisWorkstream.body` — `src/types/praxis-data.d.ts:24`.

- Before: the first three non-empty body lines, joined by spaces, from a
  `split('---')` slice.
- After: the whole file text below the frontmatter, trimmed, newlines intact.
- Type stays `string`. A workstream with no body still yields `''`, never
  `undefined`. A file with no frontmatter still yields its whole text, because
  `stripFrontmatter` returns the input unchanged in that case.

`PraxisWorkstream.description` — `src/types/praxis-data.d.ts:27`.

- Unchanged. It stays optional, stays extracted at `src/lib/extract.ts:217`, and
  stays on the wire. It simply stops being read by the modal. See open question
  Q3.

No change to `PraxisWorkstreamDetail`, `BoardPayload`, `PraxisData`, the HTTP
routes, the IPC channels, `board.html`, or `styles.css`.

## 5. Stages

Riskiest first. The extraction change carries the corruption risk, so it is
staged and tested before the render swap depends on it.

### Stage 1 — make `body` the true workstream body

Files: `src/lib/extract.ts`.

- Delete the `split('---')` lines at `src/lib/extract.ts:145-146`.
- Set `body` in the pushed record from `stripFrontmatter(wsText).trim()`.
  `stripFrontmatter` is already defined in this file, so no import is added.
- Update the comment on `src/types/praxis-data.d.ts:24` if it describes the old
  three-line value. (Check the live text; the field carries no comment today.)

Acceptance criteria.

- A workstream body containing a line that starts `---` survives intact.
- A multi-paragraph body keeps its blank lines and its newlines.
- A body longer than three lines is returned whole.
- A workstream file with frontmatter and no body yields `''`.
- The board still renders, and no card visibly changes. Nothing reads `body`
  yet, so this stage is invisible in the UI by design.

### Stage 2 — swap the modal's data source

Files: `src/public/app.ts`.

- At `src/public/app.ts:1019`, change
  `var desc = w.description ? w.description.trim() : '';` to read `w.body`.
- Keep the whole `if (desc) { … } else { … }` block exactly as it is, including
  `descEl.textContent`, the `is-clamped` class reset, and the `hidden` flags.
- Change nothing in `syncDescriptionOverflow()`, in `openModal`, or in the
  `ws-modal-description-more` click handler at `src/public/app.ts:1149-1152`.
- Do not rename the element ids, the CSS classes or the function. They stay
  `ws-modal-description`, `ws-modal-description-more` and
  `syncDescriptionOverflow`. Renaming is out of scope. See open question Q4.

Acceptance criteria.

- Opening any workstream card shows that workstream's Markdown body text in the
  slot where the description was.
- A body over four rendered lines shows "Show more". Clicking it reveals the
  rest and hides the button, exactly as before.
- A body of four lines or fewer shows no button.
- A workstream with an empty body shows an empty, hidden slot and no button,
  exactly as an absent description did.
- The text is still written with `textContent`. It is never written with
  `innerHTML`.
- The `description` field is no longer read anywhere in `src/public/app.ts`.

### Stage 3 — tests

Files: `src/lib/extract.test.ts`, and possibly `src/lib/fixture-project.ts`.

Add unit cases for Stage 1 against the shared fixture builder. The suite runs
with `node --test dist/lib/extract.test.js` after `npm run build`, as recorded
at `src/lib/extract.test.ts:8`.

Cases to add.

- A body holding a `---` line comes back with that line intact.
- A body of several paragraphs comes back with its blank lines preserved.
- A body of more than three lines comes back whole, not joined by spaces.
- A workstream with no body comes back as `''`.

Implementation note. `WORKSTREAM_FILE` in `src/lib/fixture-project.ts:16` is
shared with `src/lib/detail.test.ts`. Its body is `# Fixture` today. If a task
extends that body, it must first confirm no `detail.test.ts` case asserts on it.
Writing a bespoke temp tree inside the new cases is the safer option, and is
preferred if any doubt remains.

## 6. Data, compatibility and risk

### 6.1 Payload size — accepted, with a number

Full bodies now travel on every board load and on every 5-second poll. I measured
the corpus in this repo: 72 workstream marker files, 139,416 bytes in total,
frontmatter included. Bodies alone are under that. The board is a local,
loopback-only or in-process Electron surface, so this is a small cost on a link
with no bandwidth constraint. I accept it. Q2 records the alternative if the user
disagrees.

### 6.2 No stored data changes

The extractor is read-only, as `README.md` states. Nothing is written back to any
project. No `workstream.md` record is edited. No `description` field is removed
from any record, from the schema, from `CONVENTIONS.md`, from the generator
script, or from any skill prompt. Those live in a different repo and stay
untouched.

### 6.3 Cross-generation trees

`walkWorkstreams` reads either marker name, `workstream.md` or
`prxworkstream.md`, through `WORKSTREAM_MARKERS`. The change is inside that loop
and applies to both generations at once. No generation-specific handling is
needed.

### 6.4 Injection risk

None added. The slot stays `textContent`. Markdown syntax in a body is rendered
as literal characters, never as markup.

### 6.5 Every registered project is affected

`extract.ts` serves every project in the registry, not only this repo. A project
whose workstream bodies are long will show long modal text. This is intended and
is the point of the change.

## 7. Assumptions

I took the most reasonable reading of the brief on each point below, and did not
stop to ask. Each is a decision a reader can veto before tasks are authored.

- **A1 — plain text, not rendered Markdown.** The brief says "straight source
  swap" and "no new UI behaviour, no restyling" twice. So the body goes into the
  existing `<p>` through `textContent`, unrendered. Consequence, stated plainly:
  Markdown syntax will be visible as literal characters, and newlines will
  collapse into spaces, because a `<p>` uses normal white-space handling. A body
  with `##` headings will read as one run-on paragraph with `##` in it. This is
  the literal reading of the constraint, and it is the single decision most
  worth a second look. See Q1.
- **A2 — the whole body, not a first paragraph.** The brief defines the source as
  "the content below the frontmatter", and forbids distinguishing a lede from the
  rest. So the whole body goes in.
- **A3 — no fallback to `description`.** A workstream with an empty body shows
  nothing, and no button. Falling back to `description` would be new behaviour.
- **A4 — `description` stays on the wire.** It stays in the type and in the
  extractor, unread. Removing it is cleanup this brief did not ask for. See Q3.
- **A5 — no renames.** The element ids, CSS class names and the
  `syncDescriptionOverflow` function name all keep the word "description". They
  are now slightly misnamed. Renaming them touches `board.html`, `styles.css` and
  `app.ts` for no functional gain. See Q4.
- **A6 — no release or deployment constraint.** This is a local dashboard built
  with `npm run build`. There is no migration, no feature flag and no rollout
  step. The change lands in one commit and takes effect on the next build. The
  packaged Electron build picks it up at its next package run.
- **A7 — the card is unaffected.** No card surface reads `description` or `body`
  today, so no card changes. I verified this by grep.

## 8. Open questions

These are genuinely unsettled. I did not guess a value for any of them. A task
must not be authored for anything that rests on one of these until it is
answered.

1. **Should the body be rendered as Markdown instead of plain text?** A1 commits
   to plain text, because the constraint is explicit. But a real workstream body
   holds `##` headings, backticks and list bullets, and those will show as
   literal characters in one run-on paragraph. If the intent was legible body
   text, the answer changes Stage 2 substantially: it would need a renderer in
   the meta slot, and the clamp would have to be re-thought, because
   `-webkit-line-clamp` clamps one flow, not a set of blocks. `renderPlanBlocks`
   at `src/public/app.ts:698` already exists for the Plan tab, but it carries its
   own block-count show-more, which is a different threshold and therefore
   contradicts the brief. Answer this before Stage 2 is authored.
2. **Is the polled payload growth acceptable?** 6.1 measures it at well under
   140 KB for this corpus, every 5 seconds. I accept it. If the user does not,
   approach 3.2 is the alternative, and its costs are listed there.
3. **Should `description` be retired from this repo's own type and extractor?**
   A4 keeps it. It becomes dead data in this app the moment Stage 2 lands. The
   brief forbids touching the upstream schema, but says nothing about this repo's
   local type entry. This is a separate, small cleanup, and it is not planned
   here.
4. **Should the "description" naming be retired?** A5 keeps
   `ws-modal-description`, `ws-modal-description-more` and
   `syncDescriptionOverflow`. They will name the wrong thing after Stage 2. This
   is cosmetic, and it is not planned here.
5. **Should the body be length-capped before it crosses the wire?** Nothing caps
   it in the chosen approach, and the CSS clamp handles display. A very long body
   is fully expandable inside the `40vh` scroller. I see no need for a cap, but
   the brief did not address it.

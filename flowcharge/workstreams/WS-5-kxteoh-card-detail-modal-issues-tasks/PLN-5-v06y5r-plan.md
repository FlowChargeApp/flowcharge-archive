---
id: PLN-5-v06y5r
type: plan
workstream: WS-5-kxteoh
slug: card-detail-modal-issues-tasks
title: "Card detail modal with Issues and Tasks tabs"
status: done
created: 2026-08-06
updated: 2026-08-06
depends_on: []
links: []
---

# Card detail modal with Issues and Tasks tabs

## Summary

Clicking a workstream card on the board opens a modal showing that workstream's full detail
across two tabs — Issues (from its `issuelist*.md` files) and Tasks (from its
`tasklist*.md` files) — with every entry rendered in full rather than as a summary line.

The chosen approach is a **separate, on-demand detail endpoint plus a native `<dialog>`**:
a new route `GET /api/projects/<projectId>/workstreams/<wsId>/detail` parses one workstream's
artefact files at request time and returns a detail-only payload, and the board opens a native
`<dialog>` populated from it. The existing `PraxisData` payload, `extractPraxisData`,
`PraxisIssue[]`, and every renderer that consumes them are untouched — the detail data travels
a completely separate path, so the KPI strip, severity panel, attention panel and card
rendering cannot regress.

Two things carry most of the risk and are addressed head-on. First, the item bodies are YAML
blocks with shapes `parseFrontmatter` cannot read (block lists, nested maps, lists of maps), so
this needs a genuinely new parser; it is written in-repo rather than pulled from npm, preserving
the project's zero-runtime-dependency character (reasoning in Design). Second, the largest task
list in this repo is 91KB / 966 lines / 32 tasks, so "render every task in full" is a real
volume problem; every item renders as a collapsed `<details>` whose body is built lazily on
first expand.

## Scope

### Acceptance criteria

1. Clicking anywhere on a workstream card on the board opens a modal for that workstream.
2. Pressing Enter or Space while a card has keyboard focus opens the same modal. (Cards are
   already `tabIndex = 0` with `:focus-visible` styling; today that focus does nothing.)
3. The modal header shows the workstream's `id`, `title` and `status`.
4. The modal has exactly two tabs, "Issues" and "Tasks", each labelled with a count. Issues is
   selected on open.
5. The Issues tab lists every issue from every `issuelist*.md` file in that workstream's
   folder, grouped under one section per file headed by that file's artefact id and title. Each
   issue shows its `ISS-N` id, its checkbox state, its title, and — on expand — every field its
   YAML block carries, in the order the file carries them, with block lists rendered as lists
   and nested maps rendered as nested definition lists.
6. The Tasks tab does the same for every `tasklist*.md` file, as a two-level tree: parent
   tasks (`N.`) render their `description` and contain their child tasks (`N.M`), which render
   their full field set.
7. Every item is collapsed on open; a task's or issue's body DOM is built the first time it is
   expanded and never rebuilt.
8. A workstream with no issue lists shows an explanatory empty state in the Issues tab; the same
   for task lists in the Tasks tab; a workstream with neither (3 of this repo's 7) opens
   cleanly with both tabs empty and no error.
9. Escape closes the modal, a click on the backdrop closes it, an explicit close button closes
   it, and focus returns to the card that opened it.
10. While the modal is open, keyboard focus stays inside it and the board behind is inert.
11. The board's rendering, column layout, sort controls, direction controls and search filter
    behave exactly as before, and the `/api/projects/<id>/data` response is byte-identical to
    its pre-change output for the same input.
12. The modal is scoped by project: opening `WS-5` from project A's board fetches project A's
    `WS-5`, never another registered project's.
13. `npm run build` succeeds with no new runtime dependency in `package.json`.

### Out of scope

- Editing, creating, closing or reordering issues or tasks from the modal. This is a read-only
  detail view.
- Any change to `countChecks`, the artefact `total`/`done` figures, or anything else the board's
  cards and KPI strip already display.
- Any change to the shape or contents of `PraxisData`, `PraxisIssue`, `PraxisWorkstream` or
  `PraxisArtefact`.
- Board rendering, layout, sorting and filtering (named as unchanged by the workstream record).
- Rendering the plan (`plan.md`) or the workstream record body in the modal — the feature is
  issues and tasks.
- Deep-linking the modal via the URL, browser-history integration, and modal state surviving a
  reload.
- A test framework, linter or formatter (this project has none; see Testing strategy).
- Caching detail responses on the server.

### Assumptions

These were settled without the user available; each is a candidate for correction.

- **A1 — Two tabs, N files per type.** `CONVENTIONS.md` permits `issuelist-<qualifier>.md`
  and `tasklist-<qualifier>.md`, and `inline-css-extraction/` already has two task lists. The
  tab count stays fixed at two; multiple files become sections *within* a tab, headed by the
  file's own artefact id and title, ordered by filename. Rejected: one tab per file (tab count
  would vary 0–N per workstream, and the feature is specified as two tabs).
- **A2 — Items only, not file prose.** The narrative preamble between a task list's frontmatter
  and its first task (`## Feature`, phase summary, "properties that must survive") is not
  rendered. "Each entry rendered in full" is about entries.
- **A3 — Every parsed value is a string.** `passed: true` becomes the string `"true"`. No type
  coercion; the renderer never has to care.
- **A4 — Local dev tool, no release constraints.** This is a single-user localhost dashboard
  (`server.listen(port, '127.0.0.1')`, `src/server.ts:193`) with no production data, no live
  users and no persisted state touched by this feature. Every phase leaves `npm start` working,
  so no feature flag or dark launch is needed and rollback is `git revert`.
- **A5 — New client code lives in `src/public/app.ts`.** `src/public/tsconfig.json` sets
  `"module": "none"`, so client files compile as classic scripts that cannot import each other;
  a second file would have to share state through a `window` global. Keeping the modal in
  `app.ts` (growing it from 349 to roughly 600 lines) is the lower-coupling choice under that
  constraint.
- **A6 — No client-side caching of detail responses.** Reopening a card refetches. On localhost
  the cost is milliseconds, and the DOM cost — the real one — is handled by lazy expansion.

## Design

### Where the work attaches

| Concern | File | Change |
| --- | --- | --- |
| YAML-subset block parsing | `src/lib/yaml-block.ts` | **new** |
| Praxis markdown item structure | `src/lib/detail.ts` | **new** |
| Frontmatter reading | `src/lib/extract.ts` | add `export` to `parseFrontmatter` — nothing else |
| Route table | `src/server.ts` | one new matched route beside the existing `/data` route |
| Payload types | `src/types/praxis-data.d.ts` | new interfaces appended; existing ones untouched |
| Modal markup | `src/public/board.html` | static `<dialog>` skeleton |
| Modal behaviour | `src/public/app.ts` | delegated card listener + modal/tab/accordion code |
| Modal styling | `src/public/styles.css` | new `/* ---------- Card detail modal ---------- */` section |

No build wiring changes: `tools/copy-assets.mjs` already copies `board.html` and `styles.css`,
and `tsc -p src/public/tsconfig.json` already emits `app.ts` to `dist/public/app.js`. New files
under `src/lib/` are picked up by the root `tsconfig.json`'s `"src/lib/**/*.ts"` include.

### Contract — the detail endpoint

```
GET /api/projects/<projectId>/workstreams/<wsId>/detail
```

Matched by `/^\/api\/projects\/([^/]+)\/workstreams\/([^/]+)\/detail$/`, placed immediately
after the existing `/data` route in `handleApi` (`src/server.ts:131`). Responses mirror the
`/data` route's conventions exactly:

- `405` — method is not GET.
- `400` — `wsId` does not match `/^WS-\d+$/`.
- `404` — unknown project id, or no workstream with that id in the project.
- `410` — the project path no longer contains `flowcharge/` (same wording as the `/data` route).
- `500` — anything thrown, logged with `console.error` and answered as
  `{ error: 'Detail extraction failed' }`. An uncaught throw inside an `http.createServer`
  handler takes the process down; this branch is not optional.
- `200` — a `PraxisWorkstreamDetail`.

The `wsId` is never joined into a filesystem path — resolution scans workstream folders and
compares each `workstream.md`'s frontmatter `id`, so the URL segment cannot escape the tree.
The project path comes from the registry via `findProject`, never from the URL. No new write
path is introduced.

### Contract — payload types

Appended to `src/types/praxis-data.d.ts` (an ambient global declaration file — the new
declarations must stay import/export-free or every interface in it stops being global):

```ts
type PraxisYamlValue = string | PraxisYamlValue[] | { [key: string]: PraxisYamlValue };

interface PraxisDetailArtefact {
  id: string;       // IL-1 / TL-5
  file: string;     // basename, e.g. "tasklist-status-colour-fix.md"
  title: string;
  status: string;
  updated: string;
}

interface PraxisIssueDetail {
  id: string;       // ISS-1
  title: string;
  checked: boolean;
  fields: Record<string, PraxisYamlValue>;   // {} when the item has no yaml fence
}

interface PraxisTaskDetail {
  number: string;   // "1" or "1.1"
  title: string;
  checked: boolean;
  fields: Record<string, PraxisYamlValue>;
  children: PraxisTaskDetail[];              // always present; [] for a leaf
}

interface PraxisIssueListDetail { artefact: PraxisDetailArtefact; items: PraxisIssueDetail[]; }
interface PraxisTaskListDetail  { artefact: PraxisDetailArtefact; tasks: PraxisTaskDetail[]; }

interface PraxisWorkstreamDetail {
  id: string;
  slug: string;
  title: string;
  status: string;
  archived: boolean;
  issueLists: PraxisIssueListDetail[];
  taskLists: PraxisTaskListDetail[];
}
```

`fields` is deliberately an untyped-key generic tree rather than a per-type field list. The prx
skills own the item schemas and will add keys over time; a generic tree means a new field
renders the day it appears, with no dashboard change. It also handles the fact — visible in this
repo — that the *same* key takes different shapes in different files: `notes` is a scalar string
in `inline-css-extraction/issuelist.md:32` and a block list in
`inline-css-extraction/tasklist-status-colour-fix.md:69`. A schema-driven parser would have
to pick one and be wrong half the time.

### Contract — library API

```ts
// src/lib/yaml-block.ts
export function parseYamlBlock(lines: string[]): Record<string, PraxisYamlValue>;

// src/lib/detail.ts
export function extractWorkstreamDetail(root: string, workstreamId: string): PraxisWorkstreamDetail | null;
```

`extractWorkstreamDetail` returns `null` when no workstream carries that id, which the route
turns into a 404.

**What each module knows, and must not know.**

- `yaml-block.ts` knows one YAML subset's syntax. It must NOT know what a task, an issue, a
  workstream or a file is. Its input is a list of lines; its output is a value tree.
- `detail.ts` knows Praxis markdown structure — folder layout, which filenames are issue lists
  and task lists, how an item line is written, how a fence attaches to an item. It must NOT know
  YAML syntax details (it delegates), and must NOT know about HTTP, the project registry, or the
  board payload.
- `server.ts` keeps doing what it already does: registry lookup, validation at the boundary,
  status codes. It must NOT know how any file is parsed.
- The modal code in `app.ts` knows how to render a `PraxisYamlValue` tree. It must NOT know the
  names of any issue or task field.

### The YAML subset, specified

`parseYamlBlock` receives the lines between a ` ```yaml ` fence and its closing ` ``` `, with
common leading indentation stripped. Grammar, at each indentation level:

- `key: <non-empty>` → scalar. A double-quoted value is unquoted with `\"` and `\\` unescaped;
  a `[a, b]` value becomes a string array (`[]` → `[]`); anything else is the trimmed text.
- `key:` with nothing after it → look at the following more-indented lines. If they all start
  with `- `, the value is a list; otherwise it is a nested map, parsed by recursion.
- A list item `- <text>` is a string. A list item whose text is itself `key: value`, followed by
  sibling lines at the item's content indentation that are also `key: value`, is a map — this is
  the `self_eval.failures` shape, a list of `{item, reason, fix}` maps.
- Anything the grammar does not recognise is appended verbatim to the enclosing map under the
  key `_raw` (an array of strings). The parser never throws and never silently drops a line.
  `_raw` renders in the modal under an "Unparsed" heading, so a shape this grammar cannot read
  is visible rather than invisible.

Not supported, because nothing in the Praxis schema produces it: block scalars (`|`, `>`),
anchors, aliases, multi-document streams, flow maps. If one appears it lands in `_raw`.

**Why hand-written rather than `js-yaml`.** This would be the project's first runtime
dependency ever — a property every prior plan in this repo has defended. The decisive argument
is how little a real YAML library would actually save: the markdown layer around the fences is
hand-written either way (finding `- [x] ISS-N. Title` lines, attaching the right fence to the
right item, deriving the parent/child tree from task numbering), and that is the larger and more
Praxis-specific half of the work. A dependency would replace roughly 80 lines of a
tightly-specified grammar over machine-authored input. The trade-off accepted in exchange: input
that steps outside the grammar degrades to `_raw` instead of parsing correctly. That is a real
cost and it is why the `_raw` escape hatch is part of the contract rather than an afterthought.
If a workstream ever hand-authors exotic YAML, revisiting this is a contained change — one
module, one exported function.

### Item and structure recognition, specified

- **Issue item line:** `^-\s*\[([ xX])\]\s*(ISS-\d+)\.\s*(.*)$` — the same shape
  `src/lib/extract.ts:76` already matches, so the two paths cannot disagree about what an issue
  is.
- **Task item line:** `^(\s*)-\s*\[([ xX])\]\s*(\d+(?:\.\d+)*)\.?\s+(.*)$`. Note the optional
  trailing period: in this repo parents are written `- [x] 1. Phase 1 — …` and children
  `- [x] 1.1 Capture the …`. Nesting is derived from the **dot depth of the number**, not from
  leading whitespace — indentation is presentational and drifts, the numbering does not. A
  `N.M` task attaches to the most recent `N` parent; an orphan child with no parent becomes a
  top-level entry rather than being dropped.
- **Fence attachment:** after an item line, the first ` ```yaml ` fence encountered before the
  next item line belongs to that item. An item with no fence gets `fields: {}` and still
  renders — title and checkbox only.
- **File classification:** a file in the workstream folder is an issue list if its parsed
  frontmatter says `type: issuelist`, a task list if `type: tasklist`. Filename is used only for
  ordering and display, never for classification — frontmatter is the source of truth, matching
  how `walkWorkstreams` already decides (`src/lib/extract.ts:66`).

### Workstream resolution

`extractWorkstreamDetail` scans `flowcharge/workstreams/` then `flowcharge/archive/`, reads each
subfolder's `workstream.md` frontmatter, and returns the first whose `id` matches. Folders on
disk are named by bare slug in this repo (`card-detail-modal-issues-tasks/`) while
`CONVENTIONS.md` documents `<WS-N>-<slug>` — scanning frontmatter is correct under both, which
is exactly why the folder name is not used as the key.

This repeats a few lines of `walkWorkstreams`'s directory loop. The alternative — refactoring
`walkWorkstreams` to also emit a workstream→directory map — was rejected because it means
editing the function that produces the board's entire payload in order to add a feature that
must not touch the board. A small, obvious duplication in a new file is a better trade than a
change to the one function every existing renderer depends on.

### Modal: native `<dialog>`

A static skeleton is added to `src/public/board.html` (already in `copy-assets.mjs`'s list, so
no wiring changes): a `<dialog id="ws-modal">` containing a header (`#ws-modal-title`,
`#ws-modal-status`, a close button), a `role="tablist"` with two `role="tab"` buttons, and two
`role="tabpanel"` containers that `app.ts` fills.

`showModal()` gives focus containment, an inert background, Escape-to-close, `::backdrop`, and
focus restoration to the invoking element for free. The hand-rolled overlay `<div>` alternative
was rejected: it needs a manual tab trap, `aria-modal`/`role` attributes, an Escape handler, a
click-outside handler and explicit focus save/restore — roughly 60 extra lines reimplementing
platform behaviour, each line a chance to trap a keyboard user. The one objection to `<dialog>`
is the browser floor, and this codebase has already committed to a higher one: `app.ts:129`
uses `color-mix(in srgb, …)`, which requires materially newer browsers than `<dialog>` does.

Backdrop dismissal is `if (e.target === dialog) dialog.close()`, which works because a backdrop
click targets the dialog element itself. For that to be correct the dialog must have `padding:
0` with its content in an inner wrapper — otherwise a click on the dialog's own padding closes
it, which is a surprise.

### Tabs

Behaviour copies the existing `.seg` controls (`app.ts:328-341`): one delegated click listener
on the tablist, read a `data-` attribute, toggle an `.active` class, re-render. Accessibility
goes beyond `.seg`, which has none: `aria-selected` on each tab, `aria-controls`/
`aria-labelledby` pairing tabs to panels, `hidden` on the inactive panel, roving `tabindex`, and
Left/Right/Home/End arrow-key movement. A modal is precisely where a keyboard user gets stuck,
and this is about twenty lines. Visually the tabs are underlined labels, not `.seg`'s joined
pills — `.seg` is a behavioural precedent here, not a visual one.

### Volume

`multi-project-home-page/tasklist.md` is 91KB, 966 lines, 32 tasks; a single leaf task runs
~40 lines with an 8-item `verify` list and a 6-item `checklist`. Rendering all of that eagerly
means several thousand DOM nodes per open. Therefore:

- Every issue and every task renders as a `<details>` whose `<summary>` carries the checkbox
  state, number/id and title. Parent tasks render their `description` inline in the open group
  and contain their children.
- A `<details>` body is built on its first `toggle` event and kept thereafter. Opening the modal
  on the 32-task workstream builds ~40 summary rows, not ~3000 nodes.
- Using `<details>`/`<summary>` rather than hand-rolled disclosure widgets is the same reasoning
  as `<dialog>`: the platform already has the semantics and the keyboard behaviour.
- Transfer volume is bounded by one workstream's own files and is strictly less than what the
  board already reads on every load, so no server-side cap or pagination is needed.

### Counts shown on the tabs

Tab labels show item counts. The Tasks count counts **every** task line, parents and children
alike, which is the same thing `countChecks` counts for the card's `done/total` fraction
(`src/lib/extract.ts:31`). Counting only leaves would put a different number in the modal than
on the card behind it, for the same workstream, on the same screen.

### The card affordance

- A single delegated `click` listener on `#board`, not a per-card listener: `renderBoard` clears
  and rebuilds `board.innerHTML` on every sort, direction and search change, so per-card
  listeners would be re-created continuously. Delegation matches the existing control listeners
  and survives every re-render.
- `buildCard` sets `card.dataset.ws = w.id` and adds `role="button"` plus
  `aria-haspopup="dialog"`. The handler is
  `(e.target as HTMLElement).closest('.card')?.dataset.ws`.
- A delegated `keydown` on `#board` opens the modal on Enter or Space (preventing Space's page
  scroll). `card.tabIndex = 0` and `.card:focus-visible` already exist and need no change.
- `.card { cursor: default }` (`styles.css:312`) becomes `cursor: pointer`, plus a hover
  border-colour change reusing the existing `.tile:hover` pattern. Nothing else about `.card` or
  its DOM changes.
- `projectParam` is already in scope in `boot`'s closure, so the fetch URL needs no new plumbing.

## Staged task breakdown

Four phases, each leaving `npm start` serving a working application.

### Phase 1 — End-to-end skeleton: route, resolution, dialog, tabs

**Build.** `src/lib/detail.ts` with `extractWorkstreamDetail` doing folder resolution and
artefact classification only — every `items`/`tasks` array returns empty. The new types in
`src/types/praxis-data.d.ts`. The `export` on `parseFrontmatter`. The route in `src/server.ts`
with all five status codes. The `<dialog>` skeleton in `board.html`, its CSS section in
`styles.css`, and in `app.ts`: the delegated click/keydown listeners, the fetch, the header
fill, tab switching with full ARIA, and both empty states.

**Files.** `src/lib/detail.ts` (new), `src/types/praxis-data.d.ts`, `src/lib/extract.ts` (one
word), `src/server.ts`, `src/public/board.html`, `src/public/styles.css`, `src/public/app.ts`.

**Effort.** Medium. **Depends on.** Nothing.

**Verify.** `npm run build` passes. `curl` the new route for `WS-4` and confirm it lists one
issue-list and two task-list artefacts with correct ids and titles; for `WS-5` confirm both
arrays are empty; for `WS-99` confirm 404; for `WS/../x` confirm 400. In the browser, click a
card and confirm the modal opens with the right title, tabs switch by mouse and by arrow keys,
both tabs show their empty state, and Escape / backdrop / close button each close it and return
focus to the card. Confirm `/api/projects/<id>/data` is byte-identical to a capture taken before
the phase started.

### Phase 2 — The block parser and the Issues tab

**Build.** `src/lib/yaml-block.ts` implementing the grammar above including `_raw`. In
`detail.ts`, issue-item splitting and fence attachment, filling `items`. In `app.ts`, the
generic `PraxisYamlValue` renderer (string → paragraph, array → list, map → nested definition
list, `_raw` → `<pre>`), field-name humanising (`steps_to_reproduce` → "Steps to reproduce"),
per-file sections, and the lazy `<details>` accordion. Styling for all of it.

**Files.** `src/lib/yaml-block.ts` (new), `src/lib/detail.ts`, `src/public/app.ts`,
`src/public/styles.css`.

**Effort.** Medium. **Depends on.** Phase 1.

**Verify.** Open `inline-css-extraction` (WS-4), the only workstream in this repo with an issue
list. `ISS-1` must show its ~1400-character `description`, its 3-item `steps_to_reproduce`
list, and `expected`, `actual`, `affected`, `environment`, `tasks` and `notes` — with `notes`
rendering as a paragraph (it is a scalar in that file). No field may be missing, and no `_raw`
block may appear. The body must be absent from the DOM until first expand — check in devtools
before and after clicking the summary.

### Phase 3 — The Tasks tab and its two-level tree

**Build.** In `detail.ts`, task-item splitting, the dot-depth parent/child tree, and orphan
handling. In `app.ts`, the Tasks panel: per-file sections, parent groups showing `description`
and containing their children, children rendering the full field set through the same generic
renderer built in Phase 2.

**Files.** `src/lib/detail.ts`, `src/public/app.ts`, `src/public/styles.css`.

**Effort.** Large — this is where the volume and shape variety land.

**Depends on.** Phase 2 (reuses the parser and the renderer unchanged).

**Verify.** Three fixtures in this repo, each chosen for what it breaks:

- `multi-project-home-page` (WS-3, TL-5, 91KB / 966 lines / 32 tasks: 5 parents, 27 children) —
  the volume case. All 5 parents and all 27 children appear in the right groups; the modal opens
  without perceptible delay; devtools shows the collapsed modal holding tens of nodes, not
  thousands; `self_eval.failures` entries render as nested maps with their `item`/`reason`/`fix`
  keys.
- `inline-css-extraction` (WS-4) — the multi-file case: both `tasklist.md` and
  `tasklist-status-colour-fix.md` appear as separate sections under one Tasks tab, each
  headed by its own artefact id. This file also carries `notes` as a **block list** while the
  same workstream's issue list carries `notes` as a **scalar** — both must render correctly in
  one modal session, proving the parser is shape-driven rather than schema-driven.
- `typescript-source-conversion` (WS-1, 81KB) — a second large list, as a cross-check.

Then re-check the Tasks tab count against the card's `TL·N` fraction behind it: the totals must
agree.

### Phase 4 — Empty states, hardening and regression check

**Build.** Final empty-state copy for all four cases (no file of that type / file present but no
items, per tab). Reduced-motion handling consistent with the existing
`@media (prefers-reduced-motion: no-preference)` block. Dark-theme pass — every new colour must
come from an existing custom property, since `styles.css` defines its palette four times
(`:root`, the `prefers-color-scheme` block, and both `data-theme` overrides) and a raw hex would
be wrong in three of them. Long-value overflow (`overflow-wrap: anywhere`, matching
`.tile-path`) so a 400-character `implement` string cannot widen the dialog.

**Files.** `src/public/app.ts`, `src/public/styles.css`, `src/public/board.html`.

**Effort.** Small–medium. **Depends on.** Phase 3.

**Verify.** Open `card-detail-modal-issues-tasks` (WS-5), `git-branch-display` (WS-6) and
`live-board-refresh` (WS-7) — all three have `workstream.md` and nothing else — and confirm
both tabs show their empty state with no console error. Confirm the modal renders correctly in
light and dark. Confirm the board's sort, direction and search controls still work after a modal
has been opened and closed. Re-run the `/api/projects/<id>/data` byte-comparison from Phase 1.

## Data & compatibility

- **No migrations.** This feature persists nothing and reads no state beyond the files the
  extractor already opens. `.praxis-projects.json` is untouched.
- **Existing payload untouched.** `PraxisData`, `PraxisIssue`, `PraxisWorkstream` and
  `PraxisArtefact` keep their exact shapes, and `extractPraxisData` / `walkWorkstreams` /
  `countChecks` keep their exact behaviour. The only edit to `src/lib/extract.ts` in this whole
  plan is adding `export` to `parseFrontmatter`, which changes nothing at runtime. The byte
  comparison of `/api/projects/<id>/data` in Phases 1 and 4 is the proof, not the intention.
- **Existing consumers.** The KPI strip, severity panel, attention panel and card renderer all
  read the shallow `issues[]` array; because that array is not touched, no verification of those
  renderers beyond the payload comparison is required.
- **Additive API.** The new route is new; no existing route changes. An older client against a
  newer server is unaffected, and the reverse just 404s.
- **Rollback.** Fully reversible at every phase — remove the route, the `<dialog>` markup and
  the delegated listeners. No data to unwind, no migration to reverse, no flag to flip.
- **Forward compatibility.** Because `fields` is a generic tree, a prx skill adding a new issue
  or task field needs no dashboard change; the field appears on its own.

## Testing strategy

This project has no test framework and no linter — `package.json` lists exactly `typescript` and
`@types/node` as devDependencies. Adding one is a separate decision and is out of scope here, so
verification in this plan is: `tsc` under `strict` with `noEmitOnError` (the existing build
gate), `curl` against the new route with assertions run through `node -e`, and browser checks
against the named fixtures above. Every phase's Verify section is written to be executed, not
skimmed.

The one piece that genuinely wants unit tests is `parseYamlBlock` — it is pure, it takes lines
and returns a tree, and it is the only component here with non-trivial branching. It is designed
to be testable (a single exported pure function, no filesystem, no globals) so that a later
write-tests pass can cover it with no refactor. The cases that pass would be: quoted scalars
with escaped quotes, inline arrays including the empty one, block lists, nested maps, the
list-of-maps `self_eval.failures` shape, a key that is scalar in one block and a list in
another, and unrecognised input landing in `_raw`. `extractWorkstreamDetail` is a thinner
integration target — resolution hit and miss, archived folder, multi-file, no-file — but it
needs filesystem fixtures, so it is the second priority.

Coverage gap worth stating plainly: `flowcharge/archive/` is empty in this repo, so the archived
resolution branch cannot be verified against a real fixture here. It should be exercised by
temporarily moving a done workstream folder into `archive/` and moving it back, or by pointing
the dashboard at another registered project that has archived work.

## Open questions

1. **Should the modal be deep-linkable?** WS-3 established URL-driven navigation (`?project=`,
   plain anchors, working back button) as this codebase's pattern, and `?project=X&ws=WS-5`
   would fit it. The feature as specified does not ask for it. *Recommendation: no.* It is
   additive later and costs a history entry, a popstate handler and open-on-load logic now.
2. **Is the `_raw` fallback the right failure mode for YAML this grammar cannot read?** The
   alternatives are dropping the field silently (worse — invisible data loss) or failing the
   whole request (worse — one odd line hides an entire workstream). *Recommendation: `_raw`,
   rendered visibly under an "Unparsed" heading.* Flagged because it is the one place the
   no-dependency decision has a user-visible consequence.
3. **Should a task list's narrative preamble be shown?** Assumption A2 says no — only items are
   rendered. But `multi-project-home-page/tasklist.md` opens with a genuinely useful phase
   summary and a "properties that must survive" section that exists nowhere else.
   *Recommendation: leave it out of this workstream;* if it turns out to be missed, adding a
   collapsed "Overview" section per file is a small follow-up.
4. **Is growing `app.ts` to roughly 600 lines acceptable** (assumption A5), given
   `"module": "none"` makes a second client file share state only through a `window` global?
   *Recommendation: accept it for now.* The alternative worth considering later is switching
   the client tsconfig to ES modules with `<script type="module">`, which is a build-layout
   change and its own workstream.
5. **Would the user have accepted `js-yaml`?** This plan says no and explains why in Design.
   Recorded here because it is the one decision that changes a property the whole project has
   defended so far, and it was made without the user in the room.

**What I would have asked at intake, had the user been available:** whether anything about this
dashboard is deployed or shared rather than purely local (assumption A4 says purely local, which
drives "no feature flag, no dark launch, ship each phase"); and whether two tabs with per-file
sections (A1) matches what they pictured, or whether a workstream with several task lists should
present them some other way.

## Final summary

**Approach:** a separate on-demand detail endpoint plus a native `<dialog>` — the existing
`PraxisData` payload and every renderer that reads it are untouched, so the board cannot
regress. Rejected: extending the board payload (would push ~90KB of task detail into every board
load), parsing markdown in the browser (duplicates parsing into a `"module": "none"` classic
script), and a hand-rolled overlay `<div>` (reimplements focus trapping, Escape and inertness
that `<dialog>` gives free, on a codebase whose `color-mix()` usage already sets a higher
browser floor).

**Shape:** 4 phases, each independently shippable. Medium, medium, large, small–medium — call it
a few focused sittings, with Phase 3 the biggest.

**Top risks:** (1) the hand-written YAML-subset parser meeting a shape the grammar does not
cover — mitigated by the `_raw` escape hatch, but it is the piece most likely to need a second
pass; (2) rendering volume on the 91KB / 32-task list — mitigated by collapsed `<details>` with
lazy body construction, which must be verified in devtools rather than assumed; (3) accidental
regression of the board's existing payload — mitigated by a byte-comparison of
`/api/projects/<id>/data` in Phases 1 and 4.

**Needs your call:** deep-linking the modal (recommend no), `_raw` as the parse-failure mode
(recommend yes), showing task-list preamble prose (recommend no), letting `app.ts` grow past
600 lines (recommend yes for now), and whether skipping `js-yaml` in favour of an in-repo parser
is the trade you want.

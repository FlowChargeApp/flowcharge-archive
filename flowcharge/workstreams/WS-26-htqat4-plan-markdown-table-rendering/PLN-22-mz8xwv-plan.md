---
id: PLN-22-mz8xwv
type: plan
workstream: WS-26-htqat4
slug: plan-markdown-table-rendering
title: "Render plan-body markdown as HTML in the Plan tab: inline formatting and pipe tables"
status: ready
created: 2026-08-12
updated: 2026-08-12
depends_on: []
links: []
---

# Render plan-body markdown as HTML in the Plan tab: inline formatting and pipe tables

## Summary

`renderPlanBlocks` (`src/public/app.ts:497-609`) renders a block-level markdown subset for the
workstream details modal's Plan tab. Two separate gaps make a plan body read as raw markdown, and
this plan closes both.

**Gap 1 — inline formatting does not render at all, in any block type.** Every block writer passes a
raw source string into `el(tag, cls, rawText)`, and `el()` sets `textContent` only
(`src/public/app.ts:31-36`). So `` `code` ``, `**bold**` and `*italic*` survive as literal
characters in paragraphs (line 508), headings (550), unordered list items (571), ordered list items
(585) and pipe-line paragraphs (595). Block-level recognition and inline rendering are separate
concerns and only the first exists: a heading line IS correctly classified and mapped to
`h4`/`h5`/`h6`, but the backticks inside it still render literally, because its text goes through
the same raw-`textContent` path as everything else. This is the higher-value half of the work by a
wide margin — the corpus holds 5,637 inline code spans against 12 tables.

**Gap 2 — a pipe table is not a block type.** Test 7 (`src/public/app.ts:593-598`) catches every
line that starts with `|` and turns it into its own paragraph of literal pipe characters, so a table
reads as a stack of pipes.

The chosen approach for Gap 1 is a small hand-written inline tokenizer: one scan turns a raw string
into a flat token list, and a second walk turns that token list into an array of DOM nodes — text
nodes for plain runs, `<code>`, `<strong>` and `<em>` elements for formatted spans. Backtick code
spans are consumed in the first pass, so their contents are opaque tokens by construction and a `*`
inside backticks can never be read as emphasis. A companion `fillInline` helper appends those nodes
into a parent element, and each of the five call sites above switches from `el(tag, cls, rawText)`
to it. A markdown library is not used: the project ships zero runtime dependencies by design
(`README.md:82-84`), and `innerHTML` is not used, which is the file's own stated rule
(`src/public/app.ts:488-490`).

The chosen approach for Gap 2 models the table branch on the code-fence sub-scanner already in the
same function (`src/public/app.ts:520-538`): one line of look-ahead to confirm the separator row,
consume the run of rows, emit exactly one element, advance the index past the run. The branch is
nested **inside** the existing test-7 guard, so no other block type's classification changes and the
current pipe-to-paragraph behaviour survives as the fallback for a pipe line with no valid separator
under it. Table cells are filled with `fillInline`, so the two features meet in exactly one place.

Only `src/public/app.ts` and `src/public/styles.css` change. No new dependency, no `innerHTML`, no
change to `appendPlanBody` (`src/public/app.ts:614-634`) or to `PLAN_BLOCK_LIMIT` /
`PLAN_TRUNCATE_THRESHOLD` (`src/public/app.ts:11-12`).

**Revision note.** This is a revision of the previous PLN-22, which covered pipe tables only. The
table design below is preserved from it. Inline formatting is new, and it is sequenced first, so the
phase numbers have shifted: the old Phases 1-3 are now Phases 3-5. Any task list derived from the
previous revision needs re-authoring against the numbering here.

## Scope

### In scope — acceptance criteria

**Inline formatting**

1. `` `x` `` renders as a `<code>` element in all four contexts that carry prose: a paragraph, a
   heading, a list item and a table cell. Reference heading case:
   `flowcharge/workstreams/board-severity-cue/plan.md:172` (`### \`dominantSeverity()\` — new, pure
   helper`) renders as an `<h5>` containing the text `— new, pure helper` and one `<code>` reading
   `dominantSeverity()`, with no backtick characters anywhere in it.
2. `**x**` renders as a `<strong>` element, and a code span nested inside bold renders as a `<code>`
   inside that `<strong>`. Reference case:
   `flowcharge/workstreams/board-severity-cue/plan.md:141` — one `<strong>` holding the text
   `Rejected — a chip near ` … ` instead of a dot in ` … `.` plus two `<code>` children reading
   `card-title` and `card-top`. 182 corpus bold spans contain a nested code span.
3. `*x*` renders as an `<em>` element when the opening `*` is followed by a non-whitespace character
   and the closing `*` is preceded by one. Reference cases:
   `flowcharge/workstreams/board-severity-cue/plan.md:20` (`*any*`) and `:131` (`*alternative*`).
4. A code span's content is opaque: no `*`, `**` or `_` inside it becomes emphasis. Reference case:
   the glob code span at `flowcharge/workstreams/board-severity-cue/plan.md:110-111` holds two `*`
   characters and must render as one `<code>` reading `flowcharge/workstreams/*/ issuelist*.md`,
   with both asterisks visible and no `<em>` created.
5. An unmatched delimiter stays literal. A lone `*`, a lone `**` with no closer, and an unclosed
   backtick run all render as their own characters, and the scan continues past them rather than
   swallowing the rest of the string.
6. A code span or a bold span split across a hard wrap renders correctly, because tokenizing happens
   after `flushPara` joins the run (`src/public/app.ts:506-510`). The case at criterion 4 is exactly
   this: the opening backtick is on source line 110 and the closing one on 111.
7. The fenced-code and thematic-rule branches are untouched. A fence still renders verbatim inside
   `pre.ws-raw` with no `<code>`, `<strong>` or `<em>` element inside it, and `<hr>` stays a bare
   element. A `grep` of the diff shows no change at `src/public/app.ts:530` or `:560`.
8. No attribute is written from file content anywhere in the inline path. Every element is created
   through `el()`, every string reaches the DOM as `textContent` or as a text node, and the diff adds
   no `innerHTML`, no `setAttribute` and no property assignment carrying file content.
9. Heading, list and paragraph **block classification** is byte-identical to today. The only DOM
   difference in those blocks is that a text child may be replaced by a mix of text nodes and inline
   elements whose concatenated text equals today's text, minus the consumed delimiter characters.

**Pipe tables**

10. A plan body holding a header row, a separator row and N data rows renders one `<table>` inside
    `.ws-plan`, with one `<thead>` row of `<th>` cells and N `<tbody>` rows of `<td>` cells.
    Reference case: `flowcharge/workstreams/typescript-source-conversion/plan.md:357-362` —
    3 columns, 4 data rows.
11. No pipe character from a recognised table's header, separator or data rows appears as literal
    text in the rendered output.
12. Cell text is the source cell with surrounding whitespace trimmed, then rendered through the
    inline path of criteria 1-6. An escaped pipe (`\|`) is content, not a delimiter: the cell at
    `flowcharge/workstreams/typescript-source-conversion/plan.md:359` renders as one `<code>`
    reading `string | undefined` followed by the text `under `, a `<code>` reading `@types/node`,
    and `; …` — and that row parses as 3 columns, not 4.
13. A line that starts with `|` but has no valid separator row beneath it still renders as its own
    paragraph, with the pipes literal, exactly as today except that its inline markup now renders.
14. A pipe table inside a fenced code block still renders verbatim inside `pre.ws-raw` — the fence
    scanner keeps priority.
15. A row whose cells merely *contain* dashes is not mistaken for a separator row. Reference case:
    `flowcharge/workstreams/plan-artefact-not-readable/plan.md:199` is a data row whose first cell is
    `` `---`, `***` or `___` alone on a line ``; it renders as three `<td>` cells with three `<code>`
    children in the first, and it never terminates or opens a table.
16. A recognised table counts as exactly one block for truncation. The 14-line table in
    `flowcharge/workstreams/inline-css-extraction/plan.md:109-122` (header, separator, 12 data rows)
    is never cut mid-table by the `Show more` control.
17. A 296-character table line (`flowcharge/workstreams/typescript-source-conversion/plan.md:362`)
    does not push the modal sideways. Any horizontal scrolling is confined to the table's own
    wrapper element.

**Shared**

18. Every new style rule draws its colours, borders, type sizes and faces from variables already
    defined in `src/public/styles.css`. A `grep` for new `--` custom properties in the diff returns
    nothing, so none of the four theme blocks (`:root` at line 9, the dark `@media` at line 53,
    `:root[data-theme="dark"]` at line 93, `:root[data-theme="light"]` at line 106) needs an edit.
19. Truncation behaviour is unchanged apart from criterion 16. Inline formatting adds no top-level
    child to `.ws-plan`, so `root.children.length` (`src/public/app.ts:617`) counts the same blocks
    as today for every corpus plan.
20. `npm run build` passes with the existing `strict: true` browser compilation
    (`src/public/tsconfig.json`).

### Out of scope

- **Links.** `[text](url)` is not parsed. The corpus contains exactly one match in 22 files, and it
  is itself literal text inside a code span documenting this very limitation
  (`flowcharge/workstreams/plan-artefact-not-readable/plan.md`) — so there are zero genuine markdown
  links. See Open questions 1, which records the security design an implementation would need.
- **Underline.** Markdown has no native underline syntax, so there is nothing to parse. The corpus
  has zero `<u>` tags, zero raw HTML in prose, and zero `__x__` used as underline. See Open
  questions 2.
- **Underscore emphasis** (`_x_`, `__x__`). Every one of the 21 corpus underscore pairs is
  `__dirname` inside a code span (for example `flowcharge/workstreams/src-dist-build-layout/plan.md:29`).
  There is zero demand and a real false-positive risk against identifiers, so `_` is not a
  delimiter.
- **Bold-italic** (`***x***`). The corpus's only `***` sits inside a code span
  (`flowcharge/workstreams/plan-artefact-not-readable/plan.md:199`). A run of three or more
  asterisks stays literal text.
- **Backslash escapes for inline delimiters** (`` \` ``, `\*`). Not needed: an unpaired delimiter
  already stays literal by criterion 5, and a code span is the escape hatch for anything else.
  Adding escapes would also silently change how existing `\*` text renders.
- **Strikethrough, autolinks, images, footnotes, blockquote styling, HTML in prose.** None is
  requested and none is parsed. A `> ` blockquote line keeps its literal `> `, as today
  (`src/public/app.ts:600-601`).
- **Any panel other than the Plan tab.** `renderPlanBlocks` has a single caller
  (`src/public/app.ts:647`), reached only for artefacts with frontmatter `type: plan`
  (`src/lib/detail.ts:242`). The Issues and Tasks panels render their own fields and are untouched.
- **Column alignment from separator colons** (see Open questions 3).
- **Tables without a leading pipe on each row**, which GFM permits and the corpus never uses (see
  Open questions 5).
- Any change to `appendPlanBody`, the truncation constants, or the extractor / server / types.
- Adding a test runner or any dependency.

### Assumptions

These are the readings taken where the request did not settle a point. Each one has a concrete
default below, so no phase in this plan waits on an answer.

1. **Release constraints: none.** The dashboard is a local, single-user, read-only dev tool
   (`README.md:6-11`, server bound to `127.0.0.1`). There is no production data, no live user, no
   stored state touched by this change and no migration. Rollback is a `git revert` of two files,
   so no feature flag or dark launch is planned.
2. **"All formatting" means bold, italic and inline code.** The user named bold, italic and
   underline, and asked which else was unrendered. Inline code is added because it is by far the
   most used markup in the corpus (5,637 spans, 6x bold) and because the user's phrasing was about
   markdown generally. Links and underline are declined, with reasons, under Open questions 1-2.
3. **Italic is worth implementing, with a flanking guard.** The false-positive worry was
   glob-pattern asterisks, and code-first tokenization already removes it: every glob-like `*` in the
   corpus sits inside a code span (criterion 4). The remaining guard is that an opening `*` needs a
   non-whitespace character after it and a closing `*` needs one before it, which is the CommonMark
   left/right-flanking rule reduced to its useful half. All 143 corpus italic spans are single-word
   emphasis and satisfy it.
4. **Code-span content is taken verbatim.** CommonMark strips one leading and one trailing space
   when both are present; this implementation does not, so `` `` `x` `` `` renders with its padding
   spaces visible. That is a cosmetic difference in a form the corpus does not use.
5. **A code span's delimiter is a run of N backticks closed by a run of exactly N.** This costs
   nothing over the single-backtick case in the same loop, and it is what lets a code span contain a
   backtick.
6. **Adjacent text nodes are not merged.** Criteria are stated as visible text and element
   structure, never as text-node counts, so an implementation may emit two neighbouring text nodes.
7. **No `em` rule is added to the stylesheet.** The user-agent italic is correct for the body face.
   The plan-body display face is a variable Fraunces loaded at `font-style: normal` only
   (`src/public/styles.css:1-7`), so an `<em>` inside a plan heading gets a browser-synthesized
   oblique. Phase 2 verifies that reads acceptably and adds a rule only if it does not.
8. **Leading-pipe rows only.** The table check sits inside the existing
   `line.trim().charAt(0) === '|'` guard. All 12 corpus tables satisfy this.
9. **Alignment colons are tolerated but ignored.** The separator pattern accepts `:`, so a table
   carrying colons is still recognised as a table; no per-column text alignment is emitted. The
   corpus has no colons anywhere.
10. **Ragged rows are normalised to the header's column count** — short rows padded with empty
    cells, long rows truncated. All corpus tables are already uniform, so this is defensive only and
    guarantees a rectangular table.
11. **No rounded outer corners on the table.** `border-collapse: collapse` plus a horizontal scroll
    container makes rounded outer corners unreliable, so the table deviates from the 6px/`--radius`
    box convention deliberately.
12. **Cells get a `min-width` and the wrapper scrolls.** Without it, the inherited
    `overflow-wrap: anywhere` on `.ws-plan` (`src/public/styles.css:914`) breaks long cells into
    very narrow columns instead of overflowing. The planned value is 88px.

## Design

### Where it attaches

One function and one stylesheet section, for both halves of the work:

- `src/public/app.ts` — six new module-scope helpers beside `renderPlanBlocks` (three for inline,
  three for tables), five changed call sites inside it, and one nested branch inside its existing
  test-7 site at `src/public/app.ts:593-598`.
- `src/public/styles.css` — new rules appended to the `/* ---------- Plan body ---------- */`
  section, after `.ws-plan pre.ws-raw` at line 962.

Nothing else is touched. `PraxisPlanDetail.body` already reaches the browser verbatim, and
`renderPlanPanel` (`src/public/app.ts:638-649`) already calls
`appendPlanBody(sec, renderPlanBlocks(item.body))`, so there is no wiring to add.

### Contracts — inline formatting

Three helpers, defined before any phase uses them. The first two are pure functions; only the third
touches the DOM.

```ts
// One token per source construct, in source order. `text` is a plain run,
// `code` is the CONTENT of a backtick code span with its delimiters already
// consumed, and `delim` is a run of one or two asterisks with its flanking
// already decided. Because code spans are consumed HERE, in the first pass, an
// asterisk inside backticks never becomes a delim token at all — that is the
// whole mechanism behind acceptance criterion 4.
type InlineToken =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'delim'; run: 1 | 2; canOpen: boolean; canClose: boolean };

function inlineTokens(src: string): InlineToken[];

// Tokens in, DOM nodes out, for the half-open token range [from, to). An opener
// searches forward for a matching closer of the same run length; on a hit it
// recurses on the enclosed range and emits <strong> (run 2) or <em> (run 1); on
// a miss the delimiter is emitted as a literal text node. A `code` token always
// emits <code>. Recursion is on a strictly shorter range, so it terminates.
function tokensToNodes(toks: InlineToken[], from: number, to: number): Node[];

// The only function the block writers call. Appends
// tokensToNodes(inlineTokens(src), 0, n) into parent and returns parent, so a
// call site stays one expression: root.appendChild(fillInline(el('p'), text)).
function fillInline(parent: HTMLElement, src: string): HTMLElement;
```

Tokenizing rules, all decided in `inlineTokens`:

- **Code first, by construction.** At each position a backtick run is consumed before anything else.
  A run of N backticks opens a span that closes at the next run of exactly N. If no such run exists,
  the backticks are emitted as `text` and the scan continues one character past them (criterion 5).
- **`**` before `*`.** A run of exactly two asterisks is a `run: 2` delim; a run of exactly one is a
  `run: 1` delim; a run of three or more is emitted as `text`.
- **Flanking.** `canOpen` is true when the character after the run exists and is not whitespace.
  `canClose` is true when the character before the run exists and is not whitespace. A delim that
  can neither open nor close is still a token, and `tokensToNodes` emits it literally.
- **No other character is special.** No `_`, no `~`, no `[`, no `\` (see Out of scope).

`inlineTokens` knows about one string and nothing else — no DOM, no line indices, no markdown block
types. `tokensToNodes` knows about tokens and DOM nodes; it must NOT know about source strings,
offsets, `.ws-plan`, truncation, tabs or the modal. `fillInline` knows only how to join the two.

**Why the paragraph join must stay upstream.** `flushPara` joins a hard-wrapped run with single
spaces (`src/public/app.ts:503-510`) and only then is the joined string tokenized. That ordering is
what makes criterion 6 work: the code span opening at
`flowcharge/workstreams/board-severity-cue/plan.md:110` and closing at `:111` is a single span only
after the join. Tokenizing per source line instead would break it.

### The five call sites

Each becomes `fillInline(el(tag), text)` in place of `el(tag, null, text)`:

| Site | Today | After |
| --- | --- | --- |
| paragraph, `src/public/app.ts:508` | `el('p', null, para.join(' '))` | `fillInline(el('p'), para.join(' '))` |
| heading, `:550` | `el(tag, null, h[2].trim())` | `fillInline(el(tag), h[2].trim())` |
| unordered item, `:571` | `el('li', null, ul[1].trim())` | `fillInline(el('li'), ul[1].trim())` |
| ordered item, `:585` | `el('li', null, ol[2].trim())` | `fillInline(el('li'), ol[2].trim())` |
| pipe fallback, `:595` | `el('p', null, line.trim())` | `fillInline(el('p'), line.trim())` |

Two sites deliberately do NOT change: `el('pre', 'ws-raw', …)` at `:530`, because a code block is
verbatim by definition, and `el('hr')` at `:560`, which has no text (criterion 7). The `<th>` and
`<td>` writers added in Phase 3 make a sixth and seventh site, both using `fillInline` from the
start.

### Contracts — pipe tables

Three more helpers. Each is a pure function of strings; only the third touches the DOM.

```ts
// True when the line is a GFM table separator row: pipes, dashes, optional
// alignment colons and whitespace only, at least one dash, and at least one
// pipe. The pipe requirement is what stops a bare `---` thematic rule beneath a
// single-column pipe line from being read as a separator. A row whose cells
// merely contain dashes fails the character test, which is criterion 15.
function isSeparatorRow(line: string): boolean;

// One pipe-table row in, trimmed cell strings out. `\|` is a literal pipe inside
// a cell rather than a delimiter, and its backslash is dropped. A leading and a
// trailing pipe produce no empty edge cells.
function splitCells(line: string): string[];

// Cells in, DOM out. Returns the wrapper element, so the caller appends exactly
// ONE child — which is what keeps the block-counting truncation logic correct.
// Emits div.ws-plan-table-wrap > table.ws-plan-table > thead/tbody explicitly,
// because document.createElement + appendChild does not insert a <tbody> the way
// the HTML parser does. Each cell is filled with fillInline, so cell prose gets
// the same inline treatment as every other block (criterion 12).
function buildPlanTable(header: string[], rows: string[][]): HTMLElement;
```

`splitCells` is a single character scan rather than a regex split, because it must both respect the
escape and strip the backslash in one pass.

`buildPlanTable` knows about cell strings, `fillInline` and DOM elements. It must **not** know about
source lines, line indices, markdown block syntax, tabs, panels, truncation or the modal.
`isSeparatorRow` and `splitCells` know about one line of text each and nothing else.

### The table branch

Placed at the existing test-7 site, replacing the body of that guard while keeping the guard itself
and its paragraph fallback:

```
if (line.trim().charAt(0) === '|') {
  flushAll();
  head = splitCells(line);
  sep  = i + 1;
  if (sep < lines.length && isSeparatorRow(lines[sep])
      && splitCells(lines[sep]).length === head.length) {
    // consume rows: every following line whose trimmed form starts with `|`
    // normalise each row to head.length cells
    root.appendChild(buildPlanTable(head, rows));
    i = <first line past the run>;
    continue;
  }
  root.appendChild(fillInline(el('p'), line.trim()));   // fallback, now inline-aware
  i++;
  continue;
}
```

Properties this preserves, all of them load-bearing in the existing file:

- **Test order is untouched.** The fence, blank-line, heading, thematic-rule and list tests all
  still run before any pipe handling, so a pipe line inside a fence or a `---` rule is unaffected.
- **One forward pass.** The only look-ahead is `lines[i + 1]` for detection plus the run scan,
  exactly the shape of the fence scanner at `src/public/app.ts:520-538`. Cost stays linear in file
  size; the corpus maximum is 1570 lines.
- **`flushAll()` first**, so an open paragraph or list closes before the table, as every other
  block-level branch does.
- **`textContent` only.** Every cell is written through `fillInline`, which writes text nodes and
  `el()`-created elements and nothing else. The one attribute written is a static `scope="col"` on
  each `<th>`, which is code-authored, not file content — the same discipline as the existing
  `more.setAttribute('type', 'button')` at `src/public/app.ts:625`, and the reason the fence info
  string is dropped at `src/public/app.ts:525-527`.
- **Column count decides tablehood.** The separator's cell count must equal the header's, which is
  the GFM rule and also the guard that keeps a `| note |` line followed by `---` rendering as a
  paragraph and then an `<hr>`.

### Truncation

No change is needed and none is planned. `appendPlanBody` counts `root.children.length`
(`src/public/app.ts:617-622`). Inline formatting only ever adds descendants of an existing block, so
it changes no count at all. The table branch appends exactly one wrapper element, so a table is one
block automatically; as a side effect, a long table can no longer be cut mid-table.

### Styling

New rules under `.ws-plan`, using only existing variables.

**Inline (Phase 2):**

- `.ws-plan code` — reuses the chip treatment the file already ships for `footer.note code`
  (`src/public/styles.css:448-453`): `font-family: var(--font-mono)`,
  `background: var(--paper-sunken)`, `border-radius: 4px`, with `padding: 1px 4px` and
  `font-size: 0.92em`. The size is relative, not absolute, so the same rule works at the 12.5px body
  size and inside `.ws-plan h4`/`h5`/`h6`. `--paper-sunken` is already proven as a fill inside this
  modal by `.ws-raw` (`src/public/styles.css:866`). No selector exclusion for `pre` is needed,
  because the fence branch writes text into `pre` directly and creates no `<code>` element.
- `.ws-plan strong` — `font-weight: 600; color: var(--ink);`, matching `.masthead .meta strong`
  (`src/public/styles.css:183`), which is the file's existing precedent for emphasised inline text.
- No `em` rule, per Assumption 7.
- Conditional, only if Phase 2's check shows bold is invisible inside a plan heading (headings are
  already `font-weight: 600`): `.ws-plan h4 strong, .ws-plan h5 strong, .ws-plan h6 strong` at
  `font-weight: 700`, which the loaded Fraunces face supports (`src/public/styles.css:4`).

**Tables (Phase 4):**

- `.ws-plan-table-wrap` — `margin: 0 0 10px` (matching `.ws-plan pre.ws-raw`, the file's other
  boxed block) and `overflow-x: auto`. A wrapper is used rather than `display: block` on the table,
  because it keeps the table's own layout intact. It is a plain block child of `.ws-plan`, so it
  never reaches a tab panel div — the constraint the file states at
  `src/public/styles.css:904-909`.
- `.ws-plan-table` — `border-collapse: collapse`, `width: 100%`, inheriting the 12.5px body size
  from `.ws-modal-body` (`src/public/styles.css:765-769`) and using the 1.55 line height already
  used by `.ws-plan p` and `.ws-plan li`.
- `.ws-plan-table th, .ws-plan-table td` — `1px solid var(--line)` borders, `5px 8px` padding,
  `text-align: left` (overriding the `<th>` user-agent centring), `vertical-align: top`, and
  `min-width: 88px` per Assumption 12.
- `.ws-plan-table th` — `background: var(--paper-sunken)`, `font-weight: 600`,
  `color: var(--ink-soft)`.

`--font-mono` is deliberately not used for cell text; it stays reserved for identifiers and counts,
and a cell that holds an identifier now gets it through `<code>` instead.
`.ws-plan > :first-child { margin-top: 0; }` (`src/public/styles.css:916`) already covers a table
that opens a plan body. This is the app's first real `<table>` — there is no existing `<th>`,
`<td>` or `border-collapse` rule in `src/`, so nothing is being overridden.

### Stale comments to correct

Three comment passages state today's behaviour and become wrong. All sit inside or beside the
function in scope:

- `src/public/app.ts:491-493` — "Deliberately NOT parsed: inline markup, so backticks, `**` pairs
  and link brackets survive as literal characters; and pipe tables …". After this change the only
  true part is link brackets. It must be rewritten to state what IS parsed inline (code, bold,
  italic) and what is still not (links, underscore emphasis, `***`, escapes).
- `src/public/app.ts:488-490` — the `textContent`-only note. Still true, and it must stay true, but
  it should name text nodes as the second permitted path, since `tokensToNodes` returns them.
- `src/public/app.ts:590-592` — the note explaining the pipe-to-paragraph branch, which must now
  describe itself as the fallback for a pipe line with no separator beneath it.

## Staged task breakdown

Inline formatting comes first: it is the higher-value half (5,637 code spans against 12 tables), it
carries the more intricate code, and `buildPlanTable` needs `fillInline` to exist so its cells are
written once rather than written and then rewritten.

### Phase 1 — Inline tokenizer and the five call sites (medium)

Build `inlineTokens`, `tokensToNodes` and `fillInline`. Switch the five call sites. Correct the two
comments at `src/public/app.ts:488-493`. No CSS yet, so `<code>` and `<strong>` render with
user-agent styling and `<em>` renders final.

- Files: `src/public/app.ts`.
- Depends on: nothing.
- Verify: `npm run build` passes. `npm start`, open the board, open WS-19 (`board-severity-cue`),
  Plan tab. DevTools shows: the `<h5>` from source line 172 containing one `<code>`; the `<strong>`
  from line 141 containing two `<code>` children; `<em>` around `any` from line 20; and one `<code>`
  from lines 110-111 whose text contains both `*` characters with no `<em>` inside it. No backtick
  or asterisk character remains visible in any of those four places. `pre.ws-raw` blocks are
  character-identical to before.

### Phase 2 — Inline styling under `.ws-plan` (small)

Add the `.ws-plan code` and `.ws-plan strong` rules described in Design, after
`src/public/styles.css:962`.

- Files: `src/public/styles.css`.
- Depends on: Phase 1.
- Verify: inline code reads as a mono chip in paragraphs, list items, headings and section prose,
  at a size that does not disturb the line rhythm at 12.5px. Bold reads as bold in prose. Check
  light and dark, both by system preference and by the explicit `[data-theme]` toggle. Confirm
  italic is distinguishable in a plan heading as well as in body prose (Assumption 7) and add the
  `em` rule only if it is not. Confirm bold is distinguishable inside a plan heading and add the
  conditional `h4/h5/h6 strong` rule only if it is not.
  `git diff src/public/styles.css | grep '^+.*--[a-z-]*:'` shows no new custom property.

### Phase 3 — Table detection, parsing and DOM emission (medium)

Build `isSeparatorRow`, `splitCells` and `buildPlanTable`, and the nested branch. Correct the
comment at `src/public/app.ts:590-592`. No table CSS yet, so the table renders with user-agent
styling but with fully rendered cell prose.

- Files: `src/public/app.ts`.
- Depends on: Phase 1 (`buildPlanTable` calls `fillInline`).
- Verify: `npm run build` passes. Open WS-25 (`typescript-source-conversion`), Plan tab. DevTools
  shows `div.ws-plan-table-wrap > table > thead > tr > th × 3` and `tbody > tr × 4` with 3 `<td>`
  each. The cell from source line 359 reads `string | undefined` inside a `<code>`, with a single
  unescaped pipe. A pipe line elsewhere with no separator beneath it still shows as a paragraph of
  literal pipes, now with its inline markup rendered.

### Phase 4 — Table styling under `.ws-plan` (small)

Add the four table rule blocks described in Design, after the Phase 2 rules.

- Files: `src/public/styles.css`.
- Depends on: Phase 3 (there is no table in the DOM to style before it).
- Verify: the same table reads as a bordered table with a filled header row, matching the
  surrounding panel, with code chips inside cells sitting comfortably against the cell padding.
  Check light and dark, both ways. The 296-character row scrolls inside the wrapper and the modal
  itself gains no horizontal scrollbar. No new custom property in the diff.

### Phase 5 — Corpus sweep and regression check (medium)

Walk every plan in `flowcharge/workstreams/*/plan.md` — 22 files, about 9,500 lines — looking for
both a missed render and a false positive.

- Files: none expected; `src/public/app.ts` or `src/public/styles.css` only if the sweep finds a
  defect.
- Depends on: Phase 4.
- Verify, inline: no stray backtick or `**` remains visible in prose, and no `<em>` appears around
  something that was never meant to be emphasis — the highest-risk shapes are glob patterns, a lone
  `*` in a sentence, and arithmetic or footnote-like asterisks. Fenced blocks are unchanged
  everywhere.
- Verify, tables: all 12 tables across the 9 plans that contain one render as tables — 2-column
  (`inline-css-extraction`), 3-column and 4-column cases all rectangular with no stray pipes. The
  data row at `plan-artefact-not-readable/plan.md:199` renders as cells, not as a separator.
  A fenced block containing pipes still renders inside `pre.ws-raw`.
- Verify, shared: headings, rules, lists and paragraphs keep their block structure.
  `inline-css-extraction`'s 14-line table is not cut mid-table, and where `Show more` still appears
  it restores the remaining blocks in source order.

## Data & compatibility

- **No data changes.** Nothing is written, no schema, no migration. The change is browser-side
  rendering of a string the extractor already passes through verbatim.
- **No API or type changes.** `PraxisPlanDetail`, the `/api/` routes and `src/lib/extract.ts` are
  untouched, so a stale `data.json` snapshot from `npm run refresh` stays valid.
- **Output compatibility.** Block classification is unchanged for every line (criterion 9). Inline
  markup changes the children of prose blocks by design, and the table branch changes only lines
  that already reach test 7 *and* have a valid separator row beneath them.
- **Text-selection and copy behaviour changes**, unavoidably: copying a formatted paragraph now
  yields the text without its markdown delimiters. That is the point of the feature, and there is no
  consumer of the copied text to protect.
- **Rollback.** Revert the two files and rebuild. There is no persisted state, no flag and no
  partially-migrated data at any point, so rollback is complete at any phase boundary. After
  Phase 1 alone the app is fully working, just unstyled inline; after Phase 3, likewise for tables.

## Testing strategy

The repository has no test runner and no `test` script (`package.json`), and adding one would mean
a new devDependency — out of scope here and a separate decision.

- **Per phase:** `npm run build` is the type-check gate (`strict: true`, `noEmitOnError: true`).
  Behaviour is verified in the browser against the real `flowcharge/` corpus, using the checks listed
  under each phase.
- **Pointer for a later `write-tests` pass.** `inlineTokens` and `tokensToNodes` are the highest-value
  unit targets in this plan: the first is a pure string-to-array function, the second needs only a
  DOM. Highest-value inline cases: a code span containing `**`; bold containing a code span; an
  unclosed backtick run; a lone `*` mid-sentence; `**` with whitespace after it (must not open);
  `***`; an `N`-backtick span; and a delimiter pair spanning a joined hard wrap.
  `isSeparatorRow`, `splitCells` and `buildPlanTable` are the table targets, with these cases:
  escaped pipes, a separator with a mismatched column count, a pipe line with nothing beneath it, a
  data row whose cells contain backticked dashes, a table at end-of-file with no trailing blank
  line, a table immediately followed by a heading or a list, and a pipe table inside a fence.
  `renderPlanBlocks` itself is the integration target: string in, element tree out, with no fetch or
  modal state involved.
- **Non-functional.** Security is the `textContent`-and-text-nodes-only rule, criterion 8, and it is
  strengthened rather than weakened here: the inline path creates no attribute from file content at
  all, which is precisely what declining links preserves. Performance: `inlineTokens` is one linear
  scan; `tokensToNodes` searches forward for a closer, so a pathological run of unmatched
  delimiters is quadratic in the length of ONE block, bounded by the corpus's longest line (978
  characters) — no mitigation needed, but do not lift this code to a whole-file input. Observability
  needs nothing new — the app does no client-side logging and a misparse is visible in the panel
  itself.

## Open questions

None of these blocks a phase. Each has a committed default in Scope or Design, so the plan can be
built as written and these are decisions to confirm or override.

1. **Links — implement or not?** Options: (a) do not parse `[text](url)`, the planned default;
   (b) implement it. Recommendation: (a). The corpus has zero genuine links, and an anchor is the
   only inline construct that would write an attribute derived from file content, which is the one
   thing this renderer has never done. If (b) is chosen it is a self-contained addition to
   `inlineTokens`/`tokensToNodes`, and it must: normalise the URL by stripping whitespace and C0
   control characters BEFORE any check, since browsers tolerate `java\tscript:` and `java%0Ascript:`;
   then test the scheme against an allowlist (`http:`, `https:`, `mailto:`, or a relative path with
   no `:` before its first `/`, `?` or `#`); reject anything else — `javascript:`, `data:`,
   `vbscript:`, `blob:` — by emitting a plain text node instead of an anchor; and set `href` by
   property assignment on an `el('a', …)` element, matching `src/public/app.ts:52-53`, not by
   `setAttribute`. There is no existing sanitiser in the repo to reuse. It would also need a
   `.ws-plan a` rule, since the only anchor styling today is the global
   `a { color: var(--accent); }` at `src/public/styles.css:132`.
2. **Underline — what did you actually want?** Markdown has no underline syntax, so the request
   cannot be honoured as stated. Options: (a) nothing, the planned default; (b) treat `__x__` as
   underline, which contradicts markdown, where it means bold, and which the corpus never uses that
   way; (c) support a raw `<u>` tag in prose, which needs HTML parsing or `innerHTML` and is
   therefore refused on the file's own rule. Recommendation: (a), and if underline was meant as a
   stand-in for "make emphasis visible", bold and italic already deliver that.
3. **Italic — keep it?** Options: (a) implement `*x*` with the flanking guard, the planned default;
   (b) drop italic and ship bold and code only, which is the lowest-risk possible scope.
   Recommendation: (a). The user named italic, the corpus has 143 real uses, and code-first
   tokenization removes the glob false-positive class. If Phase 5's sweep finds a false positive
   that the flanking rule cannot fix, (b) is a one-line retreat: stop emitting `run: 1` delims.
4. **Column alignment from separator colons.** Options: (a) ignore alignment, the planned default —
   colons are tolerated so the table still renders, but every column is left-aligned; (b) honour
   them by setting `style.textAlign` per cell. Recommendation: (a). The corpus has no colons, and
   (b) adds a per-column pass for zero present benefit.
5. **Leading-pipe-less tables.** GFM allows rows without an opening pipe; the corpus has none, and
   supporting them would mean widening the test-7 guard and risking prose that merely contains a
   pipe. Recommendation: leave unsupported.
6. **Long cells: scroll or wrap.** Options: (a) `min-width: 88px` per cell plus wrapper scroll, the
   planned default, so a 4-column 296-character row scrolls rather than shredding into narrow
   columns; (b) no `min-width`, cells wrap and the table always fits. Recommendation: (a), with the
   exact value open to a look-and-tune pass in Phase 4.
7. **Header-row treatment.** Options: (a) `var(--paper-sunken)` fill, the planned default and the
   fill `.ws-raw` already uses; (b) no fill, with a heavier `var(--line-strong)` rule under the
   header row. Recommendation: (a), because the fill reads as a header at 12.5px without adding a
   second border weight to the panel.
8. **Release and rollback constraints.** Assumed none, per Assumption 1: local single-user tool, no
   production data, no flag, revert to roll back. Recommendation: confirm this once; if the answer
   ever changes, it changes nothing in this plan because no state is touched.

## Alternatives considered and rejected

**Inline formatting**

- **Regex substitution into `innerHTML`.** The obvious three-line version. Rejected outright: it is
  an HTML-injection path from file content, and this file has never written `innerHTML` from
  content — the rule it states at `src/public/app.ts:488-490` and repeats at `:910`.
- **A markdown library (`marked`, `markdown-it`) with a sanitiser.** Rejected: the project ships
  zero runtime dependencies by design (`README.md:82-84`), a library plus sanitiser is two
  dependencies to serve three inline rules, and it would also replace the block renderer whose
  behaviour is already tuned to this corpus.
- **A single-pass scanner with no token list, emitting nodes as it goes.** Rejected: bold containing
  a code span (182 corpus cases) needs the enclosed content re-processed, which means either
  recursion on substrings — re-scanning code spans that were already resolved, so their `*`
  characters get a second chance to be misread — or a token list. The token list is the cheaper
  correct answer.
- **A pre-pass that masks code-span character indices, then one emphasis scan over the raw string.**
  Rejected: it works, but it carries a parallel boolean array that every subsequent index must be
  checked against, and it mixes "what is code" with "where are the delimiters" in one loop. The
  token list expresses the same fact structurally.
- **Placeholder substitution — replace each code span with a sentinel character, run emphasis, then
  restore.** Rejected: no character is safe to reserve in arbitrary file content.
- **Supporting `_x_` as italic for symmetry.** Rejected: every corpus underscore pair is
  `__dirname`, so the rule would have negative value — pure false-positive surface.
- **Applying inline formatting inside fenced blocks for consistency.** Rejected: a code block is
  verbatim by definition, and the fence branch is the renderer's defence against a bash `# comment`
  reading as a heading (`src/public/app.ts:517-519`).

**Pipe tables**

- **A pre-pass over `lines` that marks table runs before the main loop.** Rejected: it breaks the
  documented single-forward-pass property of `renderPlanBlocks`, duplicates line classification in
  two places, and needs an index map to tell the main loop which lines to skip.
- **A third piece of open-run state (`table`), alongside `para` and `list`.** Rejected: a header
  row cannot be identified as a header without looking at the next line, so this approach still
  needs the same look-ahead, and then adds a third flush obligation to every site that closes a
  run — a standing chance of a missed flush for no gain.
- **Rendering a detected table as `pre.ws-raw`, aligned as preformatted text.** Rejected: cheap and
  needs no cell parsing, but it does not deliver the requirement, which is real `<table>` markup
  styled like the rest of the dashboard.
- **`display: block; overflow-x: auto` on the `<table>` itself instead of a wrapper div.**
  Rejected: it takes the element out of table layout, which weakens column sizing, and the wrapper
  costs nothing — it is still exactly one child of `.ws-plan`, so truncation counting is unaffected.
- **Splitting cells with a negative-lookbehind regex (`/(?<!\\)\|/`).** Rejected: it still needs a
  second pass to strip the backslash, and lookbehind only reached Safari in 16.4. A single
  character scan does both jobs in one place and matches the hand-written style of the file.
- **Leaving cell prose literal, as the previous revision of this plan planned.** Rejected now that
  inline formatting is in scope: corpus cells are dense with backticked identifiers, and a table
  whose cells alone still showed raw markdown would be the one inconsistent block type.

**Sequencing**

- **Tables first, inline second, keeping the previous revision's phase numbers.** Rejected: it
  means writing the `<th>`/`<td>` cell writers with `el()` and then changing them one phase later,
  and it delays the far more frequent win. Inline first costs nothing and each phase still leaves
  the app working.

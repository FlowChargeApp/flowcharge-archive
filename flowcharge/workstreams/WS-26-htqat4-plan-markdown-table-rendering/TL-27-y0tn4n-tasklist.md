---
id: TL-27-y0tn4n
type: tasklist
workstream: WS-26-htqat4
slug: plan-markdown-table-rendering
title: "Render plan-body markdown as HTML in the Plan tab: inline formatting and pipe tables"
status: ready
created: 2026-08-12
updated: 2026-08-12
depends_on: [PLN-22-mz8xwv]
links: []
mode: spec
base_commit: 34f6a2e
---

# PRX Tasks

## Render plan-body markdown as HTML in the Plan tab: inline formatting and pipe tables

This list implements PLN-22, as revised. `renderPlanBlocks` (`src/public/app.ts:497-609`) renders a
block-level markdown subset for the workstream details modal's Plan tab. Two gaps make a plan body
read as raw markdown, and this list closes both.

Gap 1 — inline formatting does not render at all. Every block writer passes a raw source string into
`el(tag, cls, rawText)`, and `el()` sets `textContent` only (`src/public/app.ts:31-36`), so
backticks, `**` pairs and `*` pairs survive as literal characters in paragraphs (line 508), headings
(550), unordered items (571), ordered items (585) and pipe-line paragraphs (595). This is the
higher-value half by a wide margin: the corpus holds thousands of inline code spans against 13
tables.

Gap 2 — a pipe table is not a block type. Test 7 (`src/public/app.ts:593-598`) catches every line
that starts with a pipe and makes it its own paragraph, so a table reads as a stack of pipes.

The inline approach is a small hand-written tokenizer: `inlineTokens` turns a raw string into a flat
token list in one scan, `tokensToNodes` turns a token range into DOM nodes, and `fillInline` joins
the two and is the only function the block writers call. Backtick code spans are consumed in the
first pass, so a `*` inside backticks can never be read as emphasis. The table approach models the
branch on the code-fence sub-scanner in the same function (`src/public/app.ts:520-538`): one line of
look-ahead to confirm the separator row, consume the run of rows, emit exactly one element, advance
the index past the run. The branch nests INSIDE the existing test-7 guard, so no other block type's
classification changes and the pipe-to-paragraph behaviour survives as the fallback. Table cells are
filled with `fillInline`, so the two features meet in exactly one place.

Phase 1 builds the three inline helpers, switches the five call sites and corrects the two comments
at `src/public/app.ts:488-493`. Phase 2 adds the `.ws-plan code` and `.ws-plan strong` rules. Phase 3
builds the three table helpers and the nested branch and corrects the comment at
`src/public/app.ts:590-592`. Phase 4 adds the four table rule blocks. Phase 5 sweeps the real corpus
for both a missed render and a false positive.

Out of scope, per the plan: links (`[text](url)`), underline, underscore emphasis (`_x_`, `__x__`),
bold-italic (`***x***`), backslash escapes for inline delimiters, strikethrough, autolinks, images,
footnotes, blockquote styling, HTML in prose, column alignment from separator colons, tables without
a leading pipe on every row, any panel other than the Plan tab, any change to `appendPlanBody`,
`PLAN_BLOCK_LIMIT` or `PLAN_TRUNCATE_THRESHOLD`, any change to the extractor, server or types, and
any new dependency or test runner. Only `src/public/app.ts` and `src/public/styles.css` change.

The repository has no test framework and no `test` script. `npm run build` runs both TypeScript
compilations, including `src/public/tsconfig.json` with `strict: true` and `noEmitOnError: true`, and
it also copies the public assets into `dist/`, so it is the static gate and the prerequisite for
every browser check here. The rest of the verification is the plan's own manual and grep steps.

- [ ] 1. Phase 1 — Inline tokenizer and the five call sites

  ```yaml
  description: "Build inlineTokens, tokensToNodes and fillInline, switch the five block writers to fillInline, and correct the two comments at src/public/app.ts:488-493. No CSS yet, so <code> and <strong> render with user-agent styling and <em> renders final. Covers acceptance criteria 1, 2, 3, 4, 5, 6, 7, 8, 9, 19 and 20."
  ```

  - [ ] 1.1 Inline tokenizer, node builder, `fillInline` and the five call sites in `src/public/app.ts`
    ```yaml
    description: "Add the InlineToken type and the three inline helpers at module scope beside renderPlanBlocks, switch the paragraph, heading, unordered-item, ordered-item and pipe-fallback writers to fillInline, and rewrite the two stale doc comments."
    issues: []
    implement:
      - "Add the token type and three helpers at module scope inside the same IIFE, above `renderPlanBlocks` (`src/public/app.ts:497`) so it can call them. Keep them out of the function: they hold none of the walk state, and the plan names them as the natural unit-test targets."
      - 'Declare the token type as a discriminated union of exactly three kinds: `{ kind: ''text''; text: string }` for a plain run, `{ kind: ''code''; text: string }` for the CONTENT of a backtick code span with its delimiters already consumed, and `{ kind: ''delim''; run: 1 | 2; canOpen: boolean; canClose: boolean }` for a run of one or two asterisks with its flanking already decided. Do not merge `text` and `code` into one kind — the distinction is what makes a code span opaque.'
      - 'Helper 1 — `function inlineTokens(src: string): InlineToken[]`. One linear scan, in source order. At each position a backtick run is consumed BEFORE anything else: a run of N backticks opens a span that closes at the next run of exactly N, and the enclosed text becomes one `code` token. Take the content verbatim — do not strip a leading or trailing space the way CommonMark does. If no closing run of exactly N exists, emit the backticks as `text` and continue one character past them, so the scan never swallows the rest of the string (acceptance criterion 5).'
      - 'Asterisk rules inside `inlineTokens`: a run of exactly two asterisks is a `run: 2` delim, a run of exactly one is a `run: 1` delim, and a run of three or more is emitted as `text`, so `***x***` stays literal. `canOpen` is true when the character after the run exists and is not whitespace. `canClose` is true when the character before the run exists and is not whitespace. A delim that can neither open nor close is still emitted as a token. No other character is special: no `_`, no `~`, no `[`, no backslash.'
      - 'Helper 2 — `function tokensToNodes(toks: InlineToken[], from: number, to: number): Node[]`. Tokens in, DOM nodes out, over the half-open range `[from, to)`. A `text` token emits a text node. A `code` token emits `el(''code'', null, tok.text)`. A delim with `canOpen` searches forward inside the range for a later delim of the SAME run length with `canClose`; on a hit it recurses on the enclosed range and wraps the result in `<strong>` for run 2 or `<em>` for run 1; on a miss it emits the delimiter characters as a literal text node and moves on. Recurse only on a strictly shorter range, so it terminates.'
      - "Helper 3 — `function fillInline(parent: HTMLElement, src: string): HTMLElement`. Append `tokensToNodes(inlineTokens(src), 0, n)` into `parent` and return `parent`, so a call site stays one expression. This is the only inline function the block writers call."
      - "Keep the helper boundaries as the plan draws them. `inlineTokens` knows about one string and nothing else — no DOM, no line indices, no markdown block types. `tokensToNodes` knows about tokens and DOM nodes only, and must NOT know about source strings, offsets, `.ws-plan`, truncation, tabs or the modal. `fillInline` knows only how to join the two."
      - 'Switch the five call sites, each to `fillInline(el(tag), text)`. Line 508 `root.appendChild(el(''p'', null, para.join('' '')));` becomes `fillInline(el(''p''), para.join('' ''))`. Line 550 `root.appendChild(el(tag, null, h[2].trim()));` becomes `fillInline(el(tag), h[2].trim())`. Line 571 `list.appendChild(el(''li'', null, ul[1].trim()));` becomes `fillInline(el(''li''), ul[1].trim())`. Line 585 `list.appendChild(el(''li'', null, ol[2].trim()));` becomes `fillInline(el(''li''), ol[2].trim())`. Line 595 `root.appendChild(el(''p'', null, line.trim()));` becomes `fillInline(el(''p''), line.trim())`.'
      - 'Do NOT touch two sites: `el(''pre'', ''ws-raw'', …)` at line 530, because a code block is verbatim by definition, and `el(''hr'')` at line 560, which has no text (acceptance criterion 7).'
      - "Leave the paragraph join upstream exactly as it is. `flushPara` (`src/public/app.ts:506-510`) joins a hard-wrapped run with single spaces and only then is the joined string tokenized. That ordering is what makes a code span or bold span split across a hard wrap render as one span (acceptance criterion 6). Do not tokenize per source line."
      - 'Rewrite the doc comment at `src/public/app.ts:491-493`. It currently opens `Deliberately NOT parsed: inline markup, so backticks, ``**`` pairs and link brackets survive as literal characters`. Replace the inline clause with what IS now parsed inline — code spans, bold, italic — and what is still not: links, underscore emphasis, three-or-more asterisk runs, and backslash escapes. The pipe-table clause is still true after this phase, so leave it standing; task 3.1 corrects it.'
      - "Extend the `textContent`-only note at `src/public/app.ts:488-490`. It stays true and must stay true, but it should now name text nodes as the second permitted path, because `tokensToNodes` returns them."
      - "Change nothing else. Do not touch `appendPlanBody` (`src/public/app.ts:614-634`), `PLAN_BLOCK_LIMIT` or `PLAN_TRUNCATE_THRESHOLD` (`src/public/app.ts:11-12`), or `renderPlanPanel` (`src/public/app.ts:638-649`). No truncation change is needed: inline formatting only adds descendants of an existing block, so `root.children.length` (`src/public/app.ts:617`) counts the same blocks as today."
    pattern: "src/public/app.ts only — the doc comment at lines 486-496, the new type and three helpers at module scope above renderPlanBlocks (line 497), and the five writer lines inside it at 508, 550, 571, 585 and 595."
    imports: "No new import, package, file or build step. The existing `el(tag, cls, text)` helper at src/public/app.ts:31-36 for every element, and `document.createTextNode` for a plain run. No markdown library and no sanitiser: the project ships zero runtime dependencies by design (README.md), and a regex-into-innerHTML version is rejected outright by the plan."
    compatibility: "Browser-side compilation under src/public/tsconfig.json — DOM lib, strict: true, noEmitOnError: true, no Node types. Keep the file's existing `var`-and-`function` style and do not convert surrounding code to const or arrow functions. The node array is `Node[]`, not `HTMLElement[]`, because a plain run is a `Text`. Block classification must stay byte-identical: the only DOM difference in a paragraph, heading or list item is that a text child may become a mix of text nodes and inline elements whose concatenated text equals today's text minus the consumed delimiters. textContent and text nodes stay the ONLY paths from file content to the DOM — no innerHTML content write, no setAttribute and no property assignment carrying file content, matching the rule the function documents at lines 486-490."
    gotcha: "A `**` with whitespace after it must not open, and a `**` with whitespace before it must not close — that flanking pair is the whole guard against a stray asterisk becoming emphasis. An opener must not match itself as its own closer. A three-or-more asterisk run must stay literal text, not become bold plus a stray asterisk. Code must be consumed first: if emphasis is scanned over the raw string instead, the two asterisks in the glob code span at flowcharge/workstreams/board-severity-cue/plan.md:110-111 become an <em> and acceptance criterion 4 fails. Do not merge adjacent text nodes and do not assert text-node counts — the criteria are stated as visible text and element structure. tokensToNodes searches forward for a closer, so a pathological run of unmatched delimiters is quadratic in the length of ONE block; that is bounded by the corpus's longest line at 978 characters and needs no mitigation, but do NOT lift this code to a whole-file input. The Fraunces display face is loaded at font-style: normal only (src/public/styles.css:1-7), so an <em> inside a plan heading gets a browser-synthesized oblique — task 2.1 checks that, not this one."
    verify:
      - "Run `npm run build` — both TypeScript compilations must pass under strict: true and noEmitOnError: true (acceptance criterion 20)."
      - 'Run `grep -c "fillInline(" src/public/app.ts` — must return at least 6: the definition plus the five switched call sites.'
      - 'Run `grep -c "el(''p'', null, para.join('' ''))" src/public/app.ts` — must return 0, proving the paragraph writer no longer takes the raw-text path.'
      - 'Run `git diff -U0 src/public/app.ts | grep -cE "^-.*(el\(''pre'', ''ws-raw''|el\(''hr''\))"` — must return 0, proving the fenced-code and thematic-rule writers at lines 530 and 560 are untouched (acceptance criterion 7).'
      - "Run `git diff src/public/app.ts | grep -cE '^\\+.*(innerHTML|setAttribute)'` — must return 0, proving no attribute or markup path was added from file content (acceptance criterion 8)."
      - "Run `grep -c 'Deliberately NOT parsed: inline markup' src/public/app.ts` — must return 0, proving the stale doc comment at lines 491-493 was rewritten."
      - "Run `npm start`, open the board, open WS-19 (board-severity-cue), Plan tab. DevTools must show: the <h5> from source line 172 containing one <code> reading `dominantSeverity()` and the text `— new, pure helper`, with no backtick anywhere in it; the <strong> from line 141 containing two <code> children reading `card-title` and `card-top`; an <em> around `any` from line 20; and ONE <code> from lines 110-111 whose text contains both `*` characters with no <em> inside it. No backtick or asterisk may remain visible in any of those four places, and every pre.ws-raw block must be character-identical to before."
    checklist:
      - "Does `npm run build` pass with no TypeScript error?"
      - "Does a code span render as one `<code>` whose content is opaque, so no `*`, `**` or `_` inside it becomes emphasis?"
      - "Does bold containing a code span render as one `<strong>` holding a `<code>`, and does `*x*` render as `<em>` only when the flanking rule allows it?"
      - "Does an unmatched `*`, an unmatched `**` and an unclosed backtick run each stay literal, with the scan continuing past them?"
      - "Do all five prose writers use `fillInline`, with `pre.ws-raw` at line 530 and `el('hr')` at line 560 unchanged?"
      - "Is every string still reaching the DOM only as textContent or a text node, with block classification and the `.ws-plan` top-level child count unchanged, and both comments at lines 488-493 corrected?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 2. Phase 2 — Inline styling under `.ws-plan`

  ```yaml
  description: "Add the .ws-plan code and .ws-plan strong rules described in the plan's Design section, using only variables that already exist, and decide the two conditional rules from what the rendered result actually shows. Covers acceptance criteria 18 and 20."
  ```

  - [ ] 2.1 Inline code chip and bold rules in `src/public/styles.css`
    ```yaml
    description: "Append the .ws-plan code and .ws-plan strong rule blocks to the Plan body section after .ws-plan pre.ws-raw, then add the em rule or the heading-bold rule only if the rendered result needs them."
    issues: []
    implement:
      - 'Insert the new rules in the `/* ---------- Plan body ---------- */` section, immediately after `.ws-plan pre.ws-raw { margin: 0 0 10px; }` at src/public/styles.css:962 and before the `.ws-plan-more` comment block at line 963. Do not append them at the end of the file.'
      - '`.ws-plan code` — reuse the chip treatment the file already ships for `footer.note code` (src/public/styles.css:448-453): `font-family: var(--font-mono)`, `background: var(--paper-sunken)`, `border-radius: 4px`, plus `padding: 1px 4px` and `font-size: 0.92em`. Keep the size RELATIVE, not absolute, so the same rule works at the 12.5px body size and inside `.ws-plan h4`, `h5` and `h6`.'
      - 'Add no selector exclusion for `pre`. The fence branch writes text into `pre` directly and creates no `<code>` element, so there is nothing to exclude.'
      - '`.ws-plan strong` — `font-weight: 600` and `color: var(--ink)`, matching `.masthead .meta strong` at src/public/styles.css:183, which is the file''s existing precedent for emphasised inline text.'
      - 'Add NO `em` rule by default, per the plan''s Assumption 7: the user-agent italic is correct for the body face. Check the rendered result first. Add a rule ONLY if italic is not distinguishable in a plan heading, where the Fraunces face gives a synthesized oblique.'
      - 'Add the conditional rule `.ws-plan h4 strong, .ws-plan h5 strong, .ws-plan h6 strong { font-weight: 700; }` ONLY if bold is not distinguishable inside a plan heading, which is already `font-weight: 600`. The loaded Fraunces face supports 700 (src/public/styles.css:4).'
      - 'Define no new `--` custom property, and edit none of the four theme blocks: `:root` at line 9, the dark `@media` at line 53, `:root[data-theme="dark"]` at line 93 and `:root[data-theme="light"]` at line 106.'
      - 'Add a short comment above the new rules, in the voice of the section, recording that the code chip reuses the footer.note code treatment, that its font-size is relative so it works inside a heading, and that no `em` rule is added because the user-agent italic is correct for the body face.'
    pattern: "src/public/styles.css only — the Plan body section, inserted after line 962 and before line 963."
    imports: "No new file, asset, font or build step. Only variables that already exist: --font-mono, --paper-sunken, --ink."
    compatibility: "Every selector must target a container INSIDE the tab panel, never a panel div — the panels rely on the `hidden` attribute and the user-agent `display: none`, and the file carries no `[hidden]` rule, so a display rule reaching a panel would reveal a hidden panel (src/public/styles.css:904-909). `.ws-plan code` and `.ws-plan strong` are inline descendants of `.ws-plan`, which satisfies this. The rules must work unchanged in all four theme blocks without touching any of them."
    gotcha: "An absolute font-size on `.ws-plan code` disturbs the line rhythm at 12.5px and looks wrong inside an 11.5px h6 — the size must be relative. A new custom property fails acceptance criterion 18 even if it looks right. Both themes must be checked twice each, by system preference and by the explicit [data-theme] toggle, because the palette is defined in four separate blocks. Bold inside a plan heading can be invisible because headings are already font-weight: 600 — that is what the conditional rule is for, and it is added only if the check shows it is needed. Do not add the em rule or the heading-bold rule speculatively."
    verify:
      - "Run `npm run build` — it also copies the public assets into dist/, which the browser check depends on."
      - "Run `git diff src/public/styles.css | grep '^+.*--[a-z-]*:'` — must print nothing, proving no new custom property (acceptance criterion 18)."
      - "Run `git diff -U0 src/public/styles.css | grep '^@@'` — every hunk must sit in the Plan body section past line 962, and none may touch lines 9, 53, 93 or 106."
      - "Run `grep -c '\\.ws-plan code' src/public/styles.css` — must return 1."
      - "Run `npm start` and open WS-19 (board-severity-cue), Plan tab: inline code must read as a mono chip in paragraphs, list items, headings and section prose, at a size that does not disturb the line rhythm at 12.5px, and bold must read as bold in prose. Check light and dark, both by system preference and by the explicit [data-theme] toggle."
      - "In the same view, confirm italic is distinguishable in a plan heading as well as in body prose, and add the `em` rule only if it is not; confirm bold is distinguishable inside a plan heading, and add the conditional `h4/h5/h6 strong` rule only if it is not."
    checklist:
      - "Do the new rules sit in the Plan body section after `.ws-plan pre.ws-raw`, not at the end of the file?"
      - "Does the diff introduce zero new `--` custom properties and zero edits to the four theme blocks?"
      - "Is the code chip's font-size relative, so it reads correctly at the 12.5px body size and inside h4, h5 and h6?"
      - "Does the result read correctly in light and dark, both by system preference and by the explicit [data-theme] toggle?"
      - "Were the `em` rule and the heading-bold rule each added only if the rendered result actually needed it?"
      - "Does every new selector target a descendant of `.ws-plan`, with no rule reaching a tab panel div?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 3. Phase 3 — Table detection, parsing and DOM emission

  ```yaml
  description: "Build isSeparatorRow, splitCells and buildPlanTable and the nested branch inside the existing pipe guard, with cells filled through fillInline, and correct the comment at src/public/app.ts:590-592. No table CSS yet, so the table renders with user-agent styling but with fully rendered cell prose. Covers acceptance criteria 10, 11, 12, 13, 14, 15, 16, 19 and 20."
  ```

  - [ ] 3.1 Table helpers, the nested branch and the comment correction in `src/public/app.ts`
    ```yaml
    description: "Add isSeparatorRow, splitCells and buildPlanTable at module scope beside renderPlanBlocks, nest the table branch inside the existing test-7 pipe guard while keeping its paragraph fallback, and correct the branch comment and the remaining pipe-table clause in the doc comment."
    issues: []
    implement:
      - "Add three more helpers at module scope inside the same IIFE, beside the inline helpers from task 1.1 and above `renderPlanBlocks` (`src/public/app.ts:497`). They hold none of the walk state and the plan names them as unit-test targets."
      - 'Helper 1 — `function isSeparatorRow(line: string): boolean`. True only when the line holds pipes, dashes, optional alignment colons and whitespace, AND has at least one dash, AND has at least one pipe. The pipe requirement is what stops a bare `---` thematic rule beneath a single-column pipe line from reading as a separator. A row whose cells merely CONTAIN dashes fails the character test, which is acceptance criterion 15. Colons are tolerated and ignored; emit no per-column alignment.'
      - 'Helper 2 — `function splitCells(line: string): string[]`. One pipe-table row in, trimmed cell strings out. Use a single character scan, not a regex split, because it must respect the escape and strip the backslash in one pass: a backslash immediately before a pipe makes that pipe cell content and the backslash is dropped, and every other pipe is a delimiter. A leading pipe and a trailing pipe must produce no empty edge cells. Trim each cell.'
      - 'Helper 3 — `function buildPlanTable(header: string[], rows: string[][]): HTMLElement`. Cells in, DOM out. It returns the WRAPPER element, so the caller appends exactly one child. Build `div.ws-plan-table-wrap > table.ws-plan-table > thead > tr > th` and `tbody > tr > td`, creating `<thead>` and `<tbody>` explicitly — `document.createElement` plus `appendChild` does not insert a `<tbody>` the way the HTML parser does. Fill every cell with `fillInline` from task 1.1, so cell prose gets the same inline treatment as every other block (acceptance criterion 12). The only attribute written is a static `scope="col"` on each `<th>`, which is code-authored, not file content.'
      - "Keep the helper boundaries as the plan draws them: `buildPlanTable` knows about cell strings, `fillInline` and DOM elements, and must NOT know about source lines, line indices, markdown block syntax, tabs, panels, truncation or the modal. `isSeparatorRow` and `splitCells` know about one line of text each and nothing else."
      - "Nest the table branch inside the EXISTING guard at `src/public/app.ts:593-598`. Do not move the guard and do not add a test above the fence, blank-line, heading, thematic-rule or list tests, so a pipe line inside a fence still renders verbatim (acceptance criterion 14) and a `---` rule is unaffected. Inside the guard: call `flushAll()` first, split the current line into the header cells, then look at `lines[i + 1]`."
      - "Treat the run as a table only when the next line exists, `isSeparatorRow` accepts it, AND its cell count equals the header's cell count. That column-count equality is the GFM rule and it is also the guard that keeps a one-cell pipe line followed by `---` rendering as a paragraph and then an `<hr>`."
      - "On a match, consume every following line whose trimmed form starts with a pipe, normalise each row to the header's cell count (pad short rows with empty cells, truncate long ones), append `buildPlanTable(header, rows)` to `root`, set `i` to the first line past the run, and `continue`. The run ends at the first line that does not start with a pipe, or at end of input."
      - 'Leave the paragraph fallback as task 1.1 left it — `root.appendChild(fillInline(el(''p''), line.trim()))`, `i++`, `continue` — for a pipe line with no valid separator beneath it (acceptance criterion 13).'
      - "Correct the branch comment at `src/public/app.ts:590-592` so it describes the branch as it now is: a table when a valid separator row sits beneath, and a literal-pipe paragraph as the fallback when it does not."
      - "Correct what remains of the doc comment at `src/public/app.ts:491-493`: pipe tables are no longer a documented non-goal, so drop the clause saying they fall through as one paragraph per row. The inline non-goals task 1.1 wrote there stay."
      - "Change nothing else. Do not touch `appendPlanBody` (`src/public/app.ts:614-634`), `PLAN_BLOCK_LIMIT` or `PLAN_TRUNCATE_THRESHOLD` (`src/public/app.ts:11-12`), or `renderPlanPanel` (`src/public/app.ts:638-649`). No truncation change is needed: `appendPlanBody` counts `root.children.length`, and the branch appends one wrapper, so a table is one block already (acceptance criterion 16)."
    pattern: "src/public/app.ts only — the doc comment at lines 491-493, the three new helpers at module scope above renderPlanBlocks (line 497), and the pipe guard with its comment at lines 590-598 inside it."
    imports: "No new import, package, file or build step. The existing `el(tag, cls, text)` helper at src/public/app.ts:31-36, `fillInline` from task 1.1, and `Element.setAttribute` for the static scope value only."
    compatibility: "Browser-side compilation under src/public/tsconfig.json — DOM lib, strict: true, noEmitOnError: true, no Node types. Keep the file's existing `var`-and-`function` style. Give the header cells and row arrays fresh variable names: `start` and `end` already exist as `number` in the `renderPlanBlocks` scope (src/public/app.ts:522-523), and TypeScript rejects a second `var` of the same name with a different type. textContent and text nodes stay the only paths from file content to the DOM. One forward pass with look-ahead only, matching the fence scanner at lines 520-538, so cost stays linear in file size."
    gotcha: "A separator test that does not require at least one pipe turns a `| note |` line above a `---` rule into a table. A separator whose cell count differs from the header's must NOT be treated as a table. Do not create the `<table>` and expect an implicit `<tbody>` — build both sections. An off-by-one on the index after the run either re-reads the last row or drops the line after the table. The escaped pipe must lose its backslash, so the cell at flowcharge/workstreams/typescript-source-conversion/plan.md:359 renders one <code> reading `string | undefined` and that row parses as 3 columns, not 4. A row `| a | b |` must split to two cells, not to an empty leading or trailing third. Appending more than one element per table would break the block-counting truncation. Writing any file content into an attribute, including an alignment value or a column label, is the rule this file already states at lines 525-527. Cell prose must go through fillInline, not el(): a table whose cells alone still showed raw markdown would be the one inconsistent block type."
    verify:
      - "Run `npm run build` — both TypeScript compilations must pass under strict: true and noEmitOnError: true (acceptance criterion 20)."
      - 'Run `grep -c "charAt(0) === ''|''" src/public/app.ts` — must return exactly 1, proving the table branch nests inside the one existing guard and no second pipe test was added.'
      - 'Run `grep -c "fillInline(el(''p''), line.trim())" src/public/app.ts` — must return 1, proving the literal-pipe paragraph fallback survives (acceptance criterion 13).'
      - "Run `grep -c 'as one paragraph per row' src/public/app.ts` — must return 0, proving the stale pipe-table clause was dropped."
      - "Run `git diff src/public/app.ts | grep -cE '^\\+.*innerHTML'` — must return 0, proving no innerHTML write was added."
      - "Run `npm start`, open the board, open WS-25 (typescript-source-conversion), Plan tab. DevTools must show `div.ws-plan-table-wrap > table > thead > tr > th` three times and `tbody > tr` four times with three `<td>` each, and no pipe character as literal text in that table. The cell from source line 359 must read `string | undefined` inside a `<code>`, with a single unescaped pipe, followed by the text `under `, a `<code>` reading `@types/node`, and the rest of the cell."
      - "In the same session, open WS-24 (plan-artefact-not-readable), Plan tab, and confirm the data row at source line 199 renders as three `<td>` cells with three `<code>` children in the first, and that it neither opens nor terminates a table (acceptance criterion 15)."
    checklist:
      - "Does `npm run build` pass with no TypeScript error?"
      - "Does the table branch sit INSIDE the existing pipe guard, with the fence, blank-line, heading, thematic-rule and list tests still running before it?"
      - "Does the branch append exactly ONE element per table, so a table counts as one block for truncation?"
      - "Is every cell filled through `fillInline`, with `scope=\"col\"` the only attribute written and no file content in any attribute?"
      - "Does a pipe line with no valid separator row beneath it still render as its own paragraph, and does a row whose cells merely contain dashes stay a data row?"
      - "Were both comments corrected, and were `appendPlanBody`, the truncation constants, the extractor, the server and the types all left untouched?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 4. Phase 4 — Table styling under `.ws-plan`

  ```yaml
  description: "Add the four table rule blocks described in the plan's Design section, after the Phase 2 inline rules, using only variables that already exist. Covers acceptance criteria 17, 18 and 20."
  ```

  - [ ] 4.1 Plan table wrapper, table, cell and header rules in `src/public/styles.css`
    ```yaml
    description: "Append four rule blocks to the Plan body section after the inline rules from task 2.1, giving the wrapper its spacing and horizontal scroll, the table collapsed borders and full width, the cells borders, padding and a min-width, and the header cells the sunken fill."
    issues: []
    implement:
      - "Insert the new rules in the `/* ---------- Plan body ---------- */` section, immediately after the inline rules added by task 2.1 and before the `.ws-plan-more` comment block. Do not append them at the end of the file."
      - '`.ws-plan-table-wrap` — `margin: 0 0 10px` to match `.ws-plan pre.ws-raw`, the file''s other boxed block, plus `overflow-x: auto`. A wrapper is used rather than `display: block` on the table, because it keeps the table''s own layout intact.'
      - '`.ws-plan-table` — `border-collapse: collapse`, `width: 100%`, and `line-height: 1.55`, the value `.ws-plan p` and `.ws-plan li` already use. Do not set a font size: it inherits the 12.5px body size from `.ws-modal-body` (src/public/styles.css:765-769).'
      - '`.ws-plan-table th, .ws-plan-table td` — `1px solid var(--line)` border, `5px 8px` padding, `text-align: left` to override the user-agent `<th>` centring, `vertical-align: top`, and `min-width: 88px`. The exact min-width value is open to a look-and-tune pass here, per the plan''s Open question 6.'
      - '`.ws-plan-table th` — `background: var(--paper-sunken)`, the fill `.ws-raw` already uses at src/public/styles.css:866, plus `font-weight: 600` and `color: var(--ink-soft)`.'
      - 'Define no new `--` custom property, and edit none of the four theme blocks: `:root` at line 9, the dark `@media` at line 53, `:root[data-theme="dark"]` at line 93 and `:root[data-theme="light"]` at line 106.'
      - 'Set no `border-radius` on the table or the wrapper. `border-collapse: collapse` plus a scroll container makes rounded outer corners unreliable, so the deliberate deviation from the 6px box convention stays.'
      - 'Do not use `var(--font-mono)` for cell text; it stays reserved for identifiers and counts, and a cell that holds an identifier now gets the mono face through `<code>` and the task 2.1 rule instead.'
      - 'Add a short comment above the new rules, in the voice of the section, recording why the wrapper exists, why `min-width` is needed against the inherited `overflow-wrap: anywhere`, and that the corners are deliberately square.'
    pattern: "src/public/styles.css only — the Plan body section, inserted after the task 2.1 inline rules and before the .ws-plan-more comment block."
    imports: "No new file, asset, font or build step. Only variables that already exist: --line, --paper-sunken, --ink-soft."
    compatibility: "Every selector must target a container INSIDE the tab panel, never a panel div — the panels rely on the `hidden` attribute and the user-agent `display: none`, and the file carries no `[hidden]` rule, so a display rule reaching a panel would reveal a hidden panel (src/public/styles.css:904-909). `.ws-plan-table-wrap` is a plain block child of `.ws-plan`, which satisfies this. `.ws-plan > :first-child { margin-top: 0; }` at line 916 already covers a table that opens a plan body. This is the app's first real `<table>`: src/ has no existing th, td or border-collapse rule, so nothing is being overridden. No scroll container on the plan body itself — `.ws-modal-body` already sets overflow: auto."
    gotcha: "Without `min-width` the `overflow-wrap: anywhere` inherited from `.ws-plan` (src/public/styles.css:914) shreds long cells into very narrow columns instead of letting the wrapper scroll. Horizontal scrolling must stay inside `.ws-plan-table-wrap`; if the modal itself gains a horizontal scrollbar, the wrapper is not the scroll container. A new custom property fails acceptance criterion 18 even if it works visually. Both themes must be checked twice each, by system preference and by the explicit [data-theme] toggle, because the palette is defined in four separate blocks. The code chips added by task 2.1 now sit inside cells, so the cell padding must still read comfortably around them."
    verify:
      - "Run `npm run build` — it also copies the public assets into dist/, which the browser check depends on."
      - "Run `git diff src/public/styles.css | grep '^+.*--[a-z-]*:'` — must print nothing, proving no new custom property (acceptance criterion 18)."
      - "Run `git diff -U0 src/public/styles.css | grep '^@@'` — every hunk must sit in the Plan body section past line 962, and none may touch lines 9, 53, 93 or 106."
      - "Run `grep -c 'border-collapse' src/public/styles.css` — must return 1."
      - "Run `npm start` and open WS-25 (typescript-source-conversion), Plan tab: the table must read as a bordered table with a filled header row that matches the surrounding panel, with the code chips inside cells sitting comfortably against the cell padding. Check light and dark, both by system preference and by the explicit [data-theme] toggle."
      - "In the same view, the 296-character row (flowcharge/workstreams/typescript-source-conversion/plan.md:362) must scroll inside .ws-plan-table-wrap while .ws-modal-body gains no horizontal scrollbar (acceptance criterion 17)."
    checklist:
      - "Do the new rules sit in the Plan body section after the task 2.1 inline rules, not at the end of the file?"
      - "Does the diff introduce zero new `--` custom properties and zero edits to the four theme blocks?"
      - "Does the table read correctly in light and dark, both by system preference and by the explicit [data-theme] toggle?"
      - "Is horizontal scrolling confined to `.ws-plan-table-wrap`, with no horizontal scrollbar on the modal?"
      - "Does every new selector target a container inside the tab panel, with no rule reaching a panel div?"
      - "Is the table left square-cornered, with no `var(--font-mono)` on cell text?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 5. Phase 5 — Corpus sweep and regression check
  ```yaml
  description: "Walk every plan in flowcharge/workstreams/*/plan.md — 22 files, about 9,800 lines — looking for both a missed render and a false positive, in the inline path and the table path. Covers acceptance criteria 4, 5, 7, 9, 11, 14, 15, 16 and 19. No file change is expected; src/public/app.ts or src/public/styles.css change only if the sweep finds a defect."
  issues: []
  implement:
    - 'Enumerate the tables first from the corpus itself, not from a remembered count. The plan says 12 tables across 9 plan files, which was true before the plan''s own revision added a table to flowcharge/workstreams/plan-markdown-table-rendering/plan.md; the current corpus holds 13 separator rows across 10 plan files. Use the grep in the first verify step as the sweep''s checklist and walk whatever it lists.'
    - "Run `npm start` and open the Plan tab of every workstream the grep lists. Every table must be rectangular, with a `<thead>` row and the right number of `<tbody>` rows, and with no pipe character as literal text (acceptance criterion 11). Cover the 2-column, 3-column and 4-column cases."
    - "Check the 3-column reference case at flowcharge/workstreams/typescript-source-conversion/plan.md:357-362 — 3 header cells, 4 data rows — and confirm the escaped-pipe cell on source line 359 renders `string | undefined` in ONE `<code>` with a single, unescaped pipe."
    - "Check the data row at flowcharge/workstreams/plan-artefact-not-readable/plan.md:199 renders as cells with three `<code>` children in the first cell, and never opens or terminates a table (acceptance criterion 15)."
    - "Check truncation on inline-css-extraction: its 14-line table at plan.md:109-122 counts as ONE block and is never cut mid-table. Where `Show more` still appears, clicking it must restore the remaining blocks in source order (acceptance criteria 16 and 19)."
    - "Check fence priority (acceptance criterion 14). The corpus now holds three in-fence lines whose trimmed form starts with a pipe, all in flowcharge/workstreams/plan-markdown-table-rendering/plan.md at lines 247-249 — the InlineToken union type. Open that workstream's Plan tab and confirm all three render verbatim inside `pre.ws-raw`, with the pipes literal and no table."
    - "Sweep the inline path for false positives. The highest-risk shapes are glob patterns, a lone `*` in a sentence, and arithmetic or footnote-like asterisks. No `<em>` may appear around something that was never meant to be emphasis, and no stray backtick or `**` may remain visible in prose."
    - "Sweep the inline path for missed renders in all four prose contexts: a paragraph, a heading at all three levels, a list item and a table cell. Confirm fenced blocks are unchanged everywhere, with no `<code>`, `<strong>` or `<em>` element inside a `pre.ws-raw` (acceptance criterion 7)."
    - "Check the unchanged block types (acceptance criterion 9): headings at all three levels, thematic rules, ordered and unordered lists, paragraphs and fenced code blocks must keep their block structure, including a table immediately followed by a heading or a list, and a paragraph run that ends at a table."
    - "If, and only if, the sweep finds a defect, fix it in src/public/app.ts or src/public/styles.css. Touch no other file, add no dependency and add no test runner. If a defect needs a change outside those two files, stop and report it instead."
    - "Do not drop italic on your own initiative. The plan's Open question 3 keeps `*x*` with the flanking guard as the committed default, and names dropping `run: 1` delims as a retreat only if the sweep finds a false positive the flanking rule cannot fix. If you find such a case, report it and stop rather than removing italic."
  pattern: "No file change expected. src/public/app.ts and src/public/styles.css are the only files this task may edit, and only to fix a defect the sweep finds."
  imports: "No new import, package or tool. The project's own npm scripts and the real flowcharge/ corpus in this repository."
  compatibility: "The only DOM that may differ in block structure from before the change is for lines that already reached the pipe guard AND have a valid separator row beneath them. Every other line keeps its block classification, and the only other difference is that a prose block's text child may become a mix of text nodes and inline elements. A stale data.json snapshot from `npm run refresh` stays valid, because nothing in the extractor, the /api/ routes or src/lib/extract.ts changed."
  gotcha: "Do not trust the plan's 12-tables-in-9-files count: the plan's own revision added a table to its own file, so the current count is 13 in 10 files. The plan's Phase 5 also says about 9,500 lines, and the corpus is now about 9,830. A 2-column table is the case most likely to expose a bad edge-cell split. A table at end of file with no trailing blank line, and a table immediately followed by a heading or a list, are the run-termination cases worth looking at first. Resist widening the parser during the sweep: links, underscore emphasis, three-asterisk runs, backslash escapes, alignment colons and leading-pipe-less rows are all out of scope by decision, not by omission."
  verify:
    - "Run `npm run build` — it must pass, and it is the prerequisite for the browser sweep."
    - 'Run `grep -cE ''^\|[ :|-]+\|?[[:space:]]*$'' flowcharge/workstreams/*/plan.md | grep -v '':0$''` — it must list the plan files that hold a table, and their counts must sum to the number of tables walked in this sweep. At base_commit 34f6a2e it lists 10 files summing to 13.'
    - 'Run `awk ''FNR==1{f=0} /^[[:space:]]*```/{f=!f; next} f && $0 ~ /^[[:space:]]*\|/ {print FILENAME":"FNR}'' flowcharge/workstreams/*/plan.md` — it must print exactly three lines, all flowcharge/workstreams/plan-markdown-table-rendering/plan.md at 247, 248 and 249, which are the corpus instances for acceptance criterion 14.'
    - "Run `npm start` and walk the Plan tab of every workstream the table grep lists, checking every table is rectangular with no literal pipes, and that headings, rules, lists, paragraphs and pre.ws-raw blocks keep their block structure."
    - "In the same session, walk at least five further plans that hold no table, checking the inline path in paragraphs, headings and list items: no stray backtick or `**` visible, and no `<em>` around a glob asterisk or a lone `*`."
    - "Run `git diff --name-only` — it must list at most src/public/app.ts and src/public/styles.css."
  checklist:
    - "Does every table the grep lists render as a rectangular table with no stray pipe characters, across the 2-column, 3-column and 4-column cases?"
    - "Do the three in-fence pipe lines at plan-markdown-table-rendering/plan.md:247-249 still render verbatim inside pre.ws-raw, with no table?"
    - "Is every code span, bold span and italic span rendered in paragraphs, headings, list items and table cells, with no stray backtick or asterisk left visible?"
    - "Is there no `<em>` around anything that was never emphasis — no glob asterisk, no lone `*`, no arithmetic asterisk — and no inline element inside any pre.ws-raw?"
    - "Is the 14-line inline-css-extraction table counted as one block and never cut mid-table, with `Show more` restoring the remaining blocks in source order?"
    - "Does `git diff --name-only` list no file other than src/public/app.ts and src/public/styles.css?"
  self_eval:
    passed: false
    failures: []
  ```

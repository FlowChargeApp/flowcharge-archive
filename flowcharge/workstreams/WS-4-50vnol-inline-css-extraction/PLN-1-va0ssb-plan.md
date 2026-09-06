---
id: PLN-1-va0ssb
type: plan
workstream: WS-4-50vnol
slug: inline-css-extraction
title: "Extract the inline stylesheet from index.html into public/styles.css"
status: done
created: 2026-08-04
updated: 2026-08-04
depends_on: []
links: []
---

# Extract the inline stylesheet from index.html into public/styles.css

## Summary

`public/index.html` carries its entire stylesheet inline: one `<style>` block spanning
lines 7–451, with 443 lines / 14,124 bytes of CSS between them (lines 8–450). This plan
moves that CSS verbatim into a new file, `public/styles.css`, and links it from `<head>`
with `<link rel="stylesheet" href="styles.css">` placed exactly where the `<style>` block
stood.

The approach is a single whole-block move in one step, not a staged or partial migration.
The CSS is a single cascade with theme tokens, attribute-selector overrides and component
rules that depend on source order; splitting it across phases or files would leave the page
visibly broken between phases and buys nothing here. Nothing else changes: no selector,
rule, value or declaration order is touched, `server.js` needs no edit (its MIME table
already maps `.css`), and no build step is introduced.

Verification is mechanical rather than judgemental. Because the move is a pure text
relocation, a normalised text diff between the pre-change `<style>` contents and the new
`styles.css` can prove no CSS was altered, which is stronger evidence than eyeballing the
page. Visual comparison then confirms the browser agrees.

## Scope

### Acceptance criteria

1. A file `public/styles.css` exists containing exactly the CSS that was between
   `<style>` and `</style>` in `public/index.html` — same rules, same values, same order —
   differing only by the removal of the two-space indent every line carried inside the
   `<style>` block.
2. `public/index.html` contains no `<style>` element and no CSS text.
3. `public/index.html` contains `<link rel="stylesheet" href="styles.css">` inside `<head>`,
   at the position the `<style>` block occupied (immediately after the `<title>` on line 6).
4. Loading `http://localhost:4173/` with `npm start` serves `styles.css` with HTTP 200 and
   `Content-Type: text/css; charset=utf-8`, with no console errors and no failed requests.
5. The rendered board is visually identical to the pre-change page in light scheme, dark
   scheme, and at a viewport under 880px wide (the responsive breakpoint at index.html:369).
6. JS-assigned colours still resolve: KPI status bars and chips, severity bar and legend
   swatches, column header dots and card artefact dots all render in colour rather than
   transparent/black — these read `var(--st-*)`, `var(--sev-*)` and the `color-mix()` at
   app.js:113 from the `:root` block, so they are the sharpest signal that the token block
   survived the move intact.
7. `server.js` is unmodified.
8. The README directory tree (README.md:25–34) describes `index.html` without claiming it
   holds styles, and lists `styles.css`.

### Out of scope

- The `style="display:none"` attribute on `index.html:498` and the `app.js:50` assignment
  that clears it. This is JS-driven show/hide state, not static styling; converting it to a
  class toggle would be a behaviour change, which this card does not ask for.
- The other 17 `.style.*` assignments in `app.js` (computed widths and per-status colours).
  They must keep working unchanged; none of them need editing.
- Any build step, bundler, minifier, preprocessor or npm dependency.
- Splitting the CSS into multiple files, reordering rules, deduplicating the two theme
  override blocks (`@media (prefers-color-scheme: dark)` at index.html:48 and
  `:root[data-theme="dark"]` at index.html:84 restate the same values), or any other tidying.
  All of that is a change to the CSS, and this is a move.
- The `src/`/`dist/` restructuring (WS-2). `public/styles.css` sits in today's flat `public/`
  alongside `index.html`, `app.js` and `data.json`. If WS-2 later relocates `public/`, it
  relocates this file too — that is WS-2's work, and nothing here should anticipate it.
- Cache headers on `server.js` (it sends none today, for any asset).

### Assumptions

These were settled without the user present. Each is a judgement call, not a requirement
found in the card.

1. **Filename and location: `public/styles.css`, linked as bare `href="styles.css"`.**
   `public/` is flat and `app.js` is already referenced by bare relative filename
   (index.html:519), so this follows the file's own convention.
2. **The CSS is dedented by exactly two spaces on every line.** Every non-blank line in the
   block is indented by at least two spaces (verified), so stripping a uniform two-space
   prefix is a pure whitespace change with no effect on CSS parsing — there are no
   multi-line string literals in this stylesheet. A standalone file should not be globally
   indented.
3. **No release or deployment constraints apply.** This is a local-only developer dashboard
   served from `localhost:4173` by `npm start`; there is no production deployment, no live
   users, no persisted user data, and nothing to migrate. So: no feature flag, no dark
   launch, no staged rollout, one commit, revert to roll back.
4. **Verification is manual visual comparison plus a text diff.** The repo has no test
   framework, no test script and no dependencies; adding visual-regression tooling would
   mean adding dependencies, which is out of scope.
5. **The README tree gains a `styles.css` entry as well as the reworded `index.html` line.**
   A tree that lists `app.js` and `data.json` but omits `styles.css` would be inaccurate in
   a new way.

## Design

There is no new module boundary, data model, or interface here — the change is one file
split into two along a boundary the language already defines. What follows is the mechanical
contract for the split.

### Current state (verified this session)

| Fact | Location |
|---|---|
| `<style>` open / close | `public/index.html:7` / `public/index.html:451` |
| CSS content | `public/index.html:8–450`, 443 lines, 14,124 bytes |
| Uniform indent | every non-blank line starts with at least two spaces |
| `:root` token block | index.html:8–46 |
| `@media (prefers-color-scheme: dark)` | index.html:48–83 |
| `:root[data-theme="dark"]` / `="light"` | index.html:84–95 / 96–107 |
| `@media (max-width: 880px)` | index.html:369 |
| `@media (prefers-reduced-motion: no-preference)` | index.html:448–450 |
| `@import` / `url()` / external asset refs | none |
| Only `<link>` needed | none exists today; only external ref is `<script src="app.js">` at index.html:519 |
| `.css` MIME mapping | `server.js:14`, `'text/css; charset=utf-8'` — already present |
| Static root | `server.js:7`, `public/`; `/` rewrites to `/index.html` at server.js:21 |

### After the change

`public/index.html` head becomes:

```html
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Praxis Board</title>
<link rel="stylesheet" href="styles.css">
</head>
```

`public/styles.css` is the 443 lines, dedented by two, with no wrapper and no added
comments or header banner.

### What the new file knows about

`styles.css` owns every visual rule and every custom property on `:root`. It knows nothing
about the data pipeline, the DOM construction in `app.js`, or the server. Its contract with
`app.js` is exactly the set of custom-property names `app.js` reads by string —
`--st-{backlog,ready,in-progress,blocked,done,dropped}`, `--st-*-bg`,
`--sev-{critical,high,medium,low}`, `--accent`, `--paper-raised`, `--font-mono`, `--ink-faint`
— which is precisely why nothing in the `:root` block may be renamed or dropped. That
contract is unchanged by this move; it is only being restated here so the constraint is
visible to whoever does the work.

### Load-order and failure-mode notes

- A `<link>` in `<head>` is render-blocking, so the page still paints already-styled. There
  is no flash-of-unstyled-content risk from this change.
- `app.js` runs from the bottom of `<body>` (index.html:519), long after the stylesheet has
  been applied, and in any case its `var(--x)` strings are resolved by the style engine at
  computed-style time, not at assignment time. No ordering problem is introduced.
- The one genuinely new failure mode is the stylesheet not loading at all (wrong filename,
  wrong path, file not in `public/`). Symptom: unstyled page **and** missing JS-driven
  colours, since the custom properties would be undefined. Acceptance criterion 4 checks the
  network request directly so this fails loudly rather than subtly.
- `server.js` sets no `Cache-Control` or `ETag` on any asset, so a browser may heuristically
  cache `styles.css` between edits. Use a hard reload when verifying. This is pre-existing
  behaviour affecting `app.js` equally and is not being changed here.

## Staged task breakdown

Three phases, all small, strictly ordered. Phase 1 must run before Phase 2 because its
output is the baseline Phase 2 is checked against.

### Phase 1 — Capture the visual baseline (small)

**Build:** nothing. Start the server (`npm start`, or the `praxis-dashboard` config in
`.claude/launch.json`, port 4173) and capture the current rendering: light scheme, dark
scheme, and a viewport narrower than 880px. Keep the captures for side-by-side comparison.

**Files touched:** none.

**Depends on:** nothing.

**Verify:** three captures exist showing the fully rendered board — masthead, KPI strip with
coloured bars and chips, all six columns with coloured header dots, and both lower panels
with the severity bar in colour. If the lower panels are absent, `data.json` failed to load
and the baseline is not usable; resolve that before continuing.

### Phase 2 — Move the CSS and link it (small)

**Build:**
1. Create `public/styles.css` from `public/index.html` lines 8–450, dedented by two spaces.
2. Delete lines 7–451 (`<style>` through `</style>`) from `public/index.html`.
3. Insert `<link rel="stylesheet" href="styles.css">` at that position, after the `<title>`.

**Files touched:** `public/index.html` (new), `public/styles.css` (new). Not `server.js`,
not `app.js`.

**Depends on:** Phase 1 (for the baseline).

**Verify:**

1. **Text parity** — the decisive check. Compare the committed original against the new file:

   ```
   git show HEAD:public/index.html | sed -n '8,450p' | sed 's/^  //' > /tmp/orig.css
   diff /tmp/orig.css public/styles.css
   ```

   This must produce no output. Any difference means CSS was altered, not moved, and the
   change is wrong regardless of how the page looks.
2. **Markup** — `grep -c '<style' public/index.html` returns 0; `grep -n 'stylesheet'`
   returns the new link inside `<head>`.
3. **Serving** — reload and confirm `styles.css` returns 200 with
   `Content-Type: text/css; charset=utf-8`, and the console is clean.
4. **Visual** — hard-reload and compare against all three Phase 1 captures. Confirm
   acceptance criterion 6 specifically: coloured KPI bars, coloured chips, coloured severity
   bar and legend swatches, coloured column dots and artefact dots.

### Phase 3 — Update the README directory tree (small)

**Build:** in `README.md:25–34`, change the `index.html` description so it no longer claims
to hold styles, and add a `styles.css` line to the tree. Nothing else in the README changes;
the "no build step, no framework, no npm dependencies" note at README.md:51 remains true.

**Files touched:** `README.md`.

**Depends on:** Phase 2.

**Verify:** the tree lists `index.html`, `styles.css`, `app.js`, `data.json`, matching
`ls public/`, and no line attributes styling to `index.html`.

## Data & compatibility

- **Migrations:** none. No data model, no schema, no persisted state, no generated artefact
  format is touched. `public/data.json` and `scripts/extract-praxis-data.mjs` are untouched
  and unaffected.
- **Consumers:** the only consumer of `index.html` is a browser loading it from `server.js`.
  There is no public API, no external client, no downstream import of this markup.
- **Backward compatibility:** the served page is byte-different but behaviourally identical.
  A browser holding a cached `index.html` from before the change would still render fine —
  it carries its own inline CSS. A browser holding cached `index.html` from *after* the
  change needs `styles.css` to be present, which it will be, since they ship in one commit.
- **Rollback:** revert the commit. That restores the inline block and removes `styles.css`
  in one step. There is no partially-applied state to unwind, no data to repair, and no
  point past which the change becomes irreversible.

## Testing strategy

The repo has no test framework, no `test` script in `package.json`, and no dependencies, and
this plan does not introduce any. Coverage is therefore:

- **Phase 2, automated:** the `diff` in the Phase 2 verification is the real test. It is a
  complete proof of CSS parity — for a pure move, byte equality of the relocated text is a
  stronger guarantee than any rendering check, because it rules out silent single-character
  edits that a screenshot comparison would miss.
- **Phase 2, manual:** the three-way visual comparison against the Phase 1 baseline, covering
  the light path, the dark path, and the sub-880px responsive path. These three are chosen
  because they exercise all three theme mechanisms in the stylesheet plus the one responsive
  breakpoint.
- **Phase 3:** read-through against `ls public/`.

If a later workstream introduces a test runner, a rendering-parity check would be a
reasonable thing to add then. Adding one for this change would cost more than the change.

## Open questions

None of these block the work — each has a committed default recorded above — but all four
are the user's call, and any answer other than the default changes what gets built.

1. **Filename.** Plan assumes `public/styles.css`. Alternatives: `app.css` (pairs by name
   with `app.js`) or `index.css` (pairs with `index.html`). *Recommendation:* `styles.css` —
   the file styles the whole page, not specifically `app.js`'s output, and the name survives
   unchanged if WS-2 later moves the folder.
2. **Dedent or verbatim.** Plan assumes stripping the uniform two-space indent. The
   alternative is copying the block byte-for-byte, keeping every line indented by two spaces
   in the standalone file, which makes the parity diff trivially `sed`-free at the cost of an
   oddly indented stylesheet. *Recommendation:* dedent; the parity check handles it in one
   extra `sed`.
3. **README tree depth.** Plan assumes both a reworded `index.html` line and a new
   `styles.css` entry. The narrower reading of the card is to change only the one description
   line and leave the tree's file list alone. *Recommendation:* add the entry — a tree
   missing a file it sits next to is a new inaccuracy.
4. **Commit granularity.** Plan assumes one commit covering Phases 2 and 3. The alternative
   is two commits so the README change is separable. *Recommendation:* one commit — the
   README line is only true because of the code change, and splitting them means main is
   momentarily wrong either way round.

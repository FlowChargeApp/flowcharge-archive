---
id: PLN-63-somr2u
type: plan
workstream: WS-72-p6g77g
slug: flowcharge-header-followups
title: "Seven chrome corrections that close the gap to the two toolbar mockups"
status: done
created: 2026-08-28
updated: 2026-08-28
depends_on: []
links: []
---

# Seven chrome corrections that close the gap to the two toolbar mockups

## Summary

WS-70 translated `mockups/home-toolbar-mockup.html` and `mockups/board-toolbar-mockup.html`
into real code. Comparing the shipped app against those same two files found six
differences. Three are mockup decisions that no plan ever carried across. Three reverse
scope exclusions `PLN-62-r6bxg3` made on purpose.

A seventh item joins them by user decision on 2026-08-28. The home mockup carries the same
incidental `.mockup-note` gap that item 3 restores on the board, between the crumb bar and
the page body. The original brief never asked for it because the mockup already had it. The
user has now asked for it. It is item 7.

The chosen approach is **faithful mockup transcription**: for each item, do what the mockup
file does, by the mechanism the mockup file uses, and change nothing else. The single design
fork of any weight is item 2. Both mockups swap the display font at the **token**
(`--font-display: var(--font-body)`), not per selector, so this plan swaps the token. That
repaints seven app selectors the mockups do not contain, because the mockups do not contain
modals or plan prose. That consequence is named in full in Design, and the user confirmed it
on 2026-08-28 (Decision 1).

Three orphan cleanups are folded into the items that create the orphans, on the user's
instruction of 2026-08-28. Item 1 deletes the `--rule-strong` token it strands. Item 2
deletes the Fraunces `@font-face` block, `src/public/fonts/fraunces-latin.woff2`, that
file's `tools/copy-assets.mjs` entry, and `src/public/fonts/OFL.txt`, the licence text that
covers only that font — with no preserved-stack comment and no reversal path in the working
tree. Item 6 deletes `src/public/img/flowcharge-lockup.png` and its `tools/copy-assets.mjs`
entry. See Decisions 2, 3, 4 and 8.

Everything is CSS, static HTML, one build script, and three deleted files, two of them
binary. No TypeScript changes. No new dependency. No new asset. The whole feature is five
phases, all small.

## Source-of-truth notes

The authoritative brief is
`flowcharge/workstreams/WS-72-p6g77g-flowcharge-header-followups/workstream.md`. It states
the reasoning behind each of the first six items, and this plan does not re-derive any of
it. Item 7 is not in the brief; it comes from the user's answer of 2026-08-28 and its
reasoning is recorded at Decision 5.

For items 1, 2, 3 and 7 the mockup files are the specification and were read directly:

- `mockups/home-toolbar-mockup.html`
- `mockups/board-toolbar-mockup.html`

Both mockups are still untracked in git (`??` in `git status`). That is
`PLN-62-r6bxg3` open question 6 and stays there. This plan reads them and does not move
or commit them.

The files this plan changes:

- `src/public/styles.css` (1229 lines)
- `src/public/index.html` (95 lines)
- `src/public/board.html`
- `tools/copy-assets.mjs` (58 lines)

The files this plan deletes:

- `src/public/fonts/fraunces-latin.woff2` (item 2)
- `src/public/fonts/OFL.txt` (item 2, by Decision 8)
- `src/public/img/flowcharge-lockup.png` (item 6)

**Every line number in this plan names the files as they stand today, before any phase
lands.** Several phases delete lines, so a line number quoted here is only valid against the
pre-phase file. Item 2 alone removes eight lines from the top of `src/public/styles.css`,
which shifts every later line in that file by eight. An implementer working after any phase
has landed must locate each edit by its selector, token name, or quoted text, never by the
line number printed here.

Phase 1 and Phase 5 both edit `tools/copy-assets.mjs`. They remove different entries and
cannot conflict, but whichever lands second finds the other's line numbers shifted. Locate
the entry by its filename string.

## Scope

### Acceptance criteria

**Item 1 — the card-foot dashed rule**

1. On the board screen, every `.card-foot`'s dashed top rule is drawn in `var(--line)`,
   not `var(--rule-strong)`.
2. In light mode that rule renders `#D2C2AA`; in dark mode `#3B3F46`. Both match the
   `--line` values already in `src/public/styles.css` at lines 41 and 107, and both match
   the values both mockups declare — light at line 34 in each, dark at home mockup line 100
   and board mockup line 102.
3. A dropped card (`.card.is-dropped`, `opacity: 0.68`) and a non-dropped card next to it
   now show the same hue in their foot rule, differing only in strength. The
   orange-versus-grey mismatch is gone.
4. `--rule-strong` is declared nowhere in `src/public/styles.css`. Both declarations — light
   at line 47, dark at line 113 — are deleted in the same change that strands them. No
   selector anywhere in the stylesheet names the token. See Decision 2.

**Item 2 — the display font**

5. `--font-display` resolves to `var(--font-body)` in
   `src/public/styles.css`, exactly as both mockups declare at their own line 71.
6. No comment above that declaration preserves the old Fraunces stack. The mockups keep one;
   this plan deliberately does not, because the user has ruled out a reversal path. See
   Decision 4 and Assumption A6.
7. Every selector that reads `var(--font-mono)` is unchanged, at its original size. No
   mono label, id, or meta line moves.
8. On the board screen, `.kpi .kpi-value` and `.panel h2` render in the body sans face.
9. On the home screen, `.home-heading` and `.tile-name` render in the body sans face.
10. All eleven `var(--font-display)` consumers go sans, including the seven the mockups do
    not contain. Contract 2 lists them. This is confirmed, not tolerated. See Decision 1.
11. The Fraunces `@font-face` block (`src/public/styles.css` lines 1-7, plus the blank line
    that follows it) is deleted.
12. `src/public/fonts/fraunces-latin.woff2` and `src/public/fonts/OFL.txt` are both deleted
    from the repository. `OFL.txt` licenses only that font, so it goes with it. See
    Decision 8.
13. `tools/copy-assets.mjs` no longer lists `fonts/fraunces-latin.woff2` (its line 20).
    `OFL.txt` was never in that list, so its deletion needs no build-script change.
14. `grep -rn "Fraunces\|fraunces" src/public/` returns nothing at all. The word is gone
    from `src/public/styles.css`, from `src/public/index.html`, from
    `src/public/board.html`, and from the deleted `OFL.txt`.
15. `npm run build` succeeds with that copy-list entry removed. The file and its entry are
    deleted in one change, because either one alone breaks the build.

**Item 3 — the gap above the KPI strip**

16. On the board screen there is visible vertical space between the `.toolbar-sub` info
    bar and the top of the `.kpi-strip`, of the same size the mockup's `.mockup-note`
    element produced.
17. That space is `21px`. See Assumption A3 for the derivation and the check that
    confirms it.
18. When `#update-banner` is visible, the three chrome bands — `.toolbar-crumb`,
    `.toolbar-sub`, `.update-banner` — stay flush against each other with no gap between
    them, and the `21px` opens between the banner and the KPI strip. See Assumption A4.
19. When `#update-banner` is hidden, the `21px` opens between `.toolbar-sub` and the KPI
    strip.
20. The gap shows the page background (`var(--paper)`), which is what `.toolbar-sub`
    already paints, so the transition reads as one continuous surface.

**Item 4 — the home heading**

21. `src/public/index.html` no longer contains `<h1 class="home-heading">Your
    projects</h1>`.
22. The home screen has exactly one `.home-heading`: the `<h2>Add a project</h2>`, which
    matches the home mockup exactly.

**Item 5 — the add-project form position**

23. On the home screen, reading top to bottom under the chrome: the `Add a project`
    heading, then the add-project control, then the project tile grid.
24. The add-project block stays contiguous — heading, `#add-form`, `#choose-folder-button`
    and `#add-error` move together as one unit. See Assumption A7.
25. `#project-tiles` is the last element inside `<section class="home">`.
26. In the build where `#add-form` is visible, `28px` of space separates it from the tile
    grid, produced by the existing `.home-heading + *` rule with no CSS edit. See
    Assumption A8.
27. Adding a project, renaming a tile, and removing a tile all still work. `home.ts`
    reaches every affected element by id, never by position, so no script change is
    needed.

**Item 6 — both footers**

28. `src/public/index.html` no longer contains a `<footer class="note">` element.
29. `src/public/board.html` no longer contains a `<footer class="note">` element.
30. Neither page references `img/flowcharge-lockup.png`.
31. The `footer.note`, `footer.note code` and `footer.note .footer-lockup` rules are gone
    from `src/public/styles.css`. See Assumption A9.
32. `#app-version` still renders on both screens, unaffected. It already sits outside both
    footers — in `.toolbar-crumb` on the home screen and in `.toolbar-sub` on the board —
    because WS-70 moved it there.
33. `src/public/img/flowcharge-lockup.png` is deleted from the repository.
34. `tools/copy-assets.mjs` no longer lists `img/flowcharge-lockup.png` (its line 22).
35. `npm run build` succeeds **with that entry removed**. The file and its entry are deleted
    in one change, because either one alone breaks the build. See Decision 3 and
    Assumption A5.

**Item 7 — the gap under the home crumb bar**

36. On the home screen there is visible vertical space between the `.toolbar-crumb` bar and
    the top of `<section class="home">`'s content, of the same size the home mockup's
    `.mockup-note` element produced.
37. That space is `21px`, the same value and the same derivation as item 3. The home
    mockup's `.mockup-note` rule is character-identical to the board mockup's, inside a body
    with the same `line-height: 1.45`. See Assumption A3.
38. The `21px` is added outside the existing `.home { padding: 24px … }`, not folded into
    it. Total clearance above the `Add a project` heading becomes `21px + 24px`, which is
    exactly what the home mockup renders, because the mockup carries the identical padding
    rule at its line 208 *and* the note above it.
39. When `#update-banner` is visible, `.toolbar-crumb` and `.update-banner` stay flush
    against each other, and the `21px` opens between the banner and the page body. See
    Assumption A10.
40. When `#update-banner` is hidden, the `21px` opens between `.toolbar-crumb` and the page
    body.
41. The gap shows the page background (`var(--paper)`), not the crumb bar's `var(--tile-bg)`.
42. The board screen is unaffected. `.home` exists only on the home screen.

### Out of scope

- Every visual difference between the app and the mockups other than these seven. The
  workstream record states no other difference was reported, and item 7 is the only addition
  the user made to it.
- `flowcharge-mark.png`'s file size. That is `PLN-62-r6bxg3` open question 5 and stays
  there.
- `--line`'s dark-mode value. That is `PLN-62-r6bxg3` open question 1. It is in fact
  already `#3B3F46` in `src/public/styles.css:107`, matching the mockups, so item 1
  inherits the mockup value with no action here. This plan does not touch the token.
- Every token other than `--rule-strong`. `--font-mono`, `--font-body` and the other four
  derived logo colours are untouched. Only the one token that item 1 strands is deleted.
- Every asset other than the three named in items 2 and 6. `src/public/fonts/OFL.txt` is
  **not** out of scope any more: Decision 8 folds it into item 2, because it licenses only
  the font that item deletes. `src/public/img/flowcharge-wordmark.png`,
  `src/public/img/flowcharge-mark.png` and the two untracked Snasm `.otf` files in
  `src/public/fonts/` are untouched, so neither directory becomes empty.
- Committing or relocating `mockups/`.
- Any change to `src/public/home.ts`, `src/public/app.ts`, `src/public/app-version.ts` or
  any other TypeScript file.

### Assumptions

Assumptions A1 to A9 were written before the user answered. Where an answer overturned one,
the assumption is kept and marked overturned rather than quietly rewritten, so the record
still shows what was assumed and what replaced it. A10 is new, and serves item 7.

- **A1 — release constraints. Confirmed by the user on 2026-08-28.** No production data, no
  live users, no server-side state. This is a desktop Electron app built from source and
  packaged per platform (`package.json` scripts `package:mac`, `package:linux`,
  `package:win`). The app stays shippable after every phase because every phase is a
  complete visual change on its own. There is no migration, no feature flag, and no rollback
  story beyond reverting the phase's commit. **The five phases land as five commits, one per
  phase.** That matches this project's standing practice: WS-71 landed five commits, one per
  parent task, and WS-70 landed four, one per parent task. No packaged release ships
  mid-way. Each phase only has to leave `npm run build` passing. A later tasks-authoring pass
  must keep each phase a separably committable unit and must not merge two phases into one
  commit. See Decision 7.

- **A2 — item 2 is a token swap, not four overrides.** The workstream says "Apply the same
  `--font-display: var(--font-body)` swap the mockups use, confined to the same scope
  (large serif usages only, not mono labels)." Both mockups implement this as one token
  edit at their line 71. The "not mono labels" constraint is satisfied automatically by a
  token edit: mono consumers read `--font-mono`, which is untouched. The board mockup's own
  comment says so — its line 70 reads that mono use for labels, ids and meta stays at its
  original size. So this plan edits one token, and the user confirmed the consequence
  (Decision 1). What A2 originally left out, and what Decision 4 added, is that the token
  edit no longer stands alone: once nothing resolves to Fraunces, item 2 also deletes the
  `@font-face` block, the woff2 file, and the copy-list entry, in the same phase.

- **A3 — the gap is `21px`.** The mockup's `.mockup-note` is a single line of `font-size:
  10.5px` text with `padding: 6px clamp(16px,4vw,40px) 0`, inside a body with
  `line-height: 1.45` (board mockup lines 142-145 and 122-128). Its height is therefore
  `6px + (10.5 × 1.45) = 6 + 15.225 = 21.225px`. `21px` is that value rounded. The home
  mockup declares the same `.mockup-note` rule at its lines 136-139 inside a body with the
  same `line-height: 1.45` at its line 122, so one derivation serves both item 3 and item 7.
  The implementing task confirms it by opening `mockups/board-toolbar-mockup.html` in a
  browser and reading `document.querySelector('.mockup-note').offsetHeight`. If the browser
  reports a different number, the plan's value yields to the measurement, on both screens.

- **A4 — the board gap lives on `.kpi-strip { margin-top }`.** Not on `.toolbar-sub
  { margin-bottom }`. In the mockup the note sat directly between the two, but the real
  board has `#update-banner` between them, and `styles.css` lines 1185-1205 state that the
  banner is deliberately full-bleed with its own `border-bottom: 1px solid var(--line)` so
  it "read[s] as one more band of the same chrome". A margin on `.toolbar-sub` would push
  the banner away from the bars above it and break that band stacking, while leaving the
  banner butted against the KPI strip. `margin-top` on `.kpi-strip` keeps the chrome bands
  flush and opens the space where the mockup shows it, in both banner states.
  `.kpi-strip` exists only on the board screen, so this also scopes the change correctly
  with no selector qualification.

- **A5 — OVERTURNED by explicit user instruction on 2026-08-28 (Decisions 3 and 4).** A5
  originally read: after items 2 and 6, `src/public/img/flowcharge-lockup.png` is referenced
  by no page and `src/public/fonts/fraunces-latin.woff2` is fetched by no page, but both
  stay on disk and both stay in `tools/copy-assets.mjs`'s hardcoded copy list, because
  neither deletion is one of the six items. The user has decided otherwise for both. Both
  files are deleted, and both copy-list entries are deleted with them.
  **A5's one surviving mechanical claim still governs the work:** `tools/copy-assets.mjs`
  calls `copyFileSync` over a hardcoded list and throws on a missing file, so a file and its
  list entry must be deleted in the same change or `npm run build` breaks. That is why item
  2's deletions are one atomic phase and item 6's are another.

- **A6 — OVERTURNED by explicit user instruction on 2026-08-28 (Decisions 4 and 8).** A6
  originally read: both mockups keep the original Fraunces stack as a comment "so it is one
  edit to restore" (home mockup lines 65-70, six lines; the board mockup's is five, at its
  lines 66-70), this plan copies that treatment into `styles.css`, and the user has reversed
  a font decision in this project before, so cheap reversibility is worth six lines of
  comment. The user's answer was "No reversal, remove it all." The comment is therefore not
  written, the `@font-face` block goes, the woff2 file goes, and Decision 8 sends `OFL.txt`
  with it. After item 2 there is no in-tree reversal path for the display font at all. The only
  reversal is `git revert` of Phase 1's commit, which restores the comment-free original
  declaration, the `@font-face` block, the binary font file and `OFL.txt` together. That is a
  deliberate, user-chosen trade, not an oversight.

- **A7 — item 5 moves the whole add-project block.** The home mockup's `<section
  class="home">` contains only the heading, the form, and the tile grid. The real page also
  has `#choose-folder-button` and `#add-error`, which the mockup has no equivalent for.
  Both belong to the add-project control, so all four elements move above `#project-tiles`
  together, in their current relative order.

- **A8 — items 4 and 5 need no CSS change.** `styles.css:618` is `.home-heading + *
  { margin-bottom: 28px; }`. The home mockup carries the identical rule at its line 210,
  with the post-reorder element order. After this plan's reorder the adjacent sibling of
  the one remaining `.home-heading` is `#add-form`, exactly as in the mockup, so the mockup
  spacing falls out with no edit. Decision 6 covers the one state where this differs. Item 7
  does not disturb this: it adds a margin to `.home` itself, not to anything inside it, so
  the `.home-heading + *` relationship is untouched.

- **A9 — item 6 deletes the footer CSS with the footer HTML.** `footer.note`,
  `footer.note code` and `footer.note .footer-lockup` (`styles.css:569-587`) match nothing
  once both `<footer class="note">` blocks are gone. Removing them is finishing item 6, not
  widening it. Nothing else in `styles.css` uses the `.note` class or the `.footer-lockup`
  class. Deleting the lockup PNG itself and its copy-list entry is now also part of item 6,
  by Decision 3.

- **A10 — the home gap lives on `.home { margin-top }`.** Same reasoning as A4, same page
  structure. In the home mockup the note sat directly between `.toolbar-crumb` (its line
  268) and `<section class="home">` (its line 275), but the real home page has
  `#update-banner` between them — `styles.css:1186-1187` says the banner sits "directly
  under `.toolbar-crumb` on the home screen". A `margin-bottom` on `.toolbar-crumb` would
  push the banner off the crumb bar and break the same band stacking A4 protects, while
  leaving the banner butted against the page body. `margin-top` on `.home` keeps the bands
  flush and opens the space where the mockup shows it, in both banner states. `.home` exists
  only on the home screen, so the change scopes itself with no selector qualification, the
  same way `.kpi-strip` does for item 3.

## Design

This feature adds no module, no data model, no interface, and no dependency. There is
nothing to define contracts-first in the usual sense. What follows is the exact edit
surface, since that is where all the risk sits.

### Contract 1 — the token block, and the `@font-face` block above it

`src/public/styles.css:92` today:

```css
  --font-display: "Fraunces", ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif;
```

After item 2:

```css
  --font-display: var(--font-body);
```

One line replaces one line. **No preserved-stack comment is written above it.** Both mockups
keep such a comment; this plan deliberately does not, because Decision 4 rules out a
reversal path. Assumption A6 records that this reverses the plan's original position.

`--font-body` is declared on the next line (`styles.css:93`). Custom property references
are resolved at use time, not declaration time, so declaration order does not matter. Both
mockups rely on the same ordering and render correctly.

`--font-mono` (`styles.css:94`) is not touched. `--font-body` is not touched.

Item 2 also deletes the `@font-face` block that loads the now-unused face.
`src/public/styles.css` lines 1-7 today:

```css
@font-face {
  font-family: "Fraunces";
  src: url("fonts/fraunces-latin.woff2") format("woff2");
  font-weight: 600 700;
  font-style: normal;
  font-display: swap;
}
```

That block and the blank line after it are deleted, so the file now opens on the palette
comment block that currently starts at line 9. This removes eight lines from the top of
`styles.css` and shifts every other line number quoted in this plan for that file by eight.
See the warning in Source-of-truth notes.

With the block gone, `src/public/fonts/fraunces-latin.woff2` is fetched by nothing and is
deleted, and its `tools/copy-assets.mjs` entry is deleted with it — see Contract 7.
`src/public/fonts/OFL.txt`, which licenses that one font and nothing else, is deleted in the
same phase (Decision 8). It carries no copy-list entry, so its deletion cannot affect the
build.

### Contract 2 — the full consequence of the token swap

This is the one thing in this feature that reaches beyond the two mockups, so it is
enumerated rather than summarised. `src/public/styles.css` has eleven consumers of
`var(--font-display)`. Four appear in the mockups. Seven do not, because the mockups
contain no modal and no rendered plan prose.

**In the mockups — intended, specified, verified against the mockup files:**

| `styles.css` | Selector | Mockup source |
|---|---|---|
| 303 | `.kpi .kpi-value` | board mockup line 260 |
| 529 | `.panel h2` | board mockup line 310 |
| 613 | `.home-heading` | home mockup line 209 |
| 715 | `.tile-name` | home mockup line 219 |

**Not in the mockups — repainted as a consequence of the token swap:**

| `styles.css` | Selector | What it draws |
|---|---|---|
| 595 | `.load-state h2` | board load/error screen heading |
| 742 | `.tiles-empty h3` | home empty-state heading |
| 827 | `.ws-modal-title` | detail modal title |
| 991 | `.ws-section-title` | detail modal section headings |
| 1117 | `.ws-plan h4` | rendered plan prose, level 4 |
| 1124 | `.ws-plan h5` | rendered plan prose, level 5 |
| 1131 | `.ws-plan h6` | rendered plan prose, level 6 |

`PLN-62-r6bxg3` saw this coming. Its "Alternatives considered and rejected" section
rejected porting the mockup `<style>` blocks wholesale partly because they carry a
`--font-display: var(--font-body)` override that "would repaint every heading, tile name,
and panel title in the app". That is the same seven-selector consequence, and the user
asked for the swap anyway.

**Settled.** On 2026-08-28 the user confirmed all eleven consumers go sans, the four in the
mockups and the seven that are not (Decision 1). The repaint is intended, on the reasoning
that one heading face across the app is more coherent than a sans board with a serif modal.
Phase 1's verification still looks at a modal, but as a confirmation, not as a decision
point.

### Contract 3 — the card-foot rule, and the token it strands

`src/public/styles.css:500` today ends `border-top: 1px dashed var(--rule-strong);`. It
becomes `border-top: 1px dashed var(--line);`, matching board mockup line 301 character
for character.

`--rule-strong` has exactly one consumer in the whole stylesheet — this one. After the
change the token is declared twice and read nowhere. **Both declarations are deleted in the
same change**, on the user's instruction of 2026-08-28 (Decision 2):

- `styles.css:47`, light palette, `--rule-strong: #9A7A56;`
- `styles.css:113`, dark palette, `--rule-strong: #A2805B;`

The user's reason: the style is not coming back, and if it ever has to, it will be created
again. The palette comment block at `styles.css:9-32` must be read while the declarations
are removed, but **expect no edit to it.** That block documents the five *source* logo
colours — slate `#434A5B`, powder blue `#D5E0E9`, steel blue `#5C7C96`, bronze `#A2805B`,
oak `#D2C2AA` — and the two derivation operations allowed from them. It does not name
`--rule-strong` or any other derived token, so deleting the declarations falsifies nothing
in it. Bronze in particular stays in use: the comment at `styles.css:49` records that
`--toolbar-bg` light is the bronze swatch verbatim. Change the comment only if the read
finds a statement the deletion actually falsified. No other token in either palette is
touched.

The workstream asks that this revert be checked against WS-71's own contrast reasoning
before assuming no other consequence. It was: `--line` in dark mode is already `#3B3F46`
in `styles.css:107`, which is the value both mockups use (home mockup line 100, board
mockup line 102), so the shipped
dark palette and the mockup dark palette agree on this token and the revert lands the
mockup's exact appearance in both modes. `.card` itself is already bordered in
`var(--line)` (`styles.css:444`), so after the change a card's outer border and its
internal foot rule share one tone, which is the consistency the mockup was after.

### Contract 4 — the KPI gap

`src/public/styles.css:280` opens the `.kpi-strip` block. One declaration is added:

```css
  margin-top: 21px;
```

Nothing else in that block changes. `.kpi-strip` already sets `background: var(--line)` and
`border-bottom: 1px solid var(--line)`; the new margin sits outside both, so the exposed
strip is `body`'s `var(--paper)` (`styles.css:160-161`), the same surface `.toolbar-sub`
paints (`styles.css:227-231`).

Margin collapsing is not a hazard here: `.kpi-strip` is `display: grid`, and its previous
sibling is either `.toolbar-sub` (`display: flex`) or `.update-banner` (`display: flex`),
neither of which has a bottom margin to collapse with.

### Contract 5 — the home screen body

`src/public/index.html` lines 44-55 today:

```html
<section class="home">
  <h1 class="home-heading">Your projects</h1>
  <div id="project-tiles"></div>

  <h2 class="home-heading">Add a project</h2>
  <form class="add-form" id="add-form" hidden> … </form>
  <button type="button" id="choose-folder-button" hidden>Choose folder</button>
  <div id="add-error"></div>
</section>
```

After items 4 and 5, matching the home mockup's own order (its lines 275-302):

```html
<section class="home">
  <h2 class="home-heading">Add a project</h2>
  <form class="add-form" id="add-form" hidden> … </form>
  <button type="button" id="choose-folder-button" hidden>Choose folder</button>
  <div id="add-error"></div>

  <div id="project-tiles"></div>
</section>
```

The `<h1>` is deleted, not demoted or moved. The four add-project elements keep their
current relative order and their current attributes; only the block's position changes.

**Why no script change is needed.** `src/public/home.ts` reaches all of these by id:
`byId('project-tiles')` at lines 150 and 298, `byId('add-form')` at lines 339, 351 and 355,
`byId('choose-folder-button')` at lines 352, 354 and 359. It never uses `nextElementSibling`,
`children[n]`, or any position-dependent lookup, and it never queries `.home-heading`. Both
`loadProjects()` call sites write into `#project-tiles` by id. So DOM order is free to
change.

**Heading levels after the change.** The home screen's only remaining heading in
`<section class="home">` is an `<h2>`, with no `<h1>` above it on that page. The home
mockup has exactly the same structure — its only heading is the same `<h2>` — so this
matches the specification. It is a document-outline regression relative to today, and it
is what the mockup shows. Not raised as an open question because the mockup is explicit.

### Contract 6 — the two footers, the lockup PNG, and its copy entry

Deleted whole from `src/public/index.html` (lines 57-63) and from `src/public/board.html`
(lines 108-114). Both are static markup with no id, no script binding, and no dynamic
content. `#app-version` is not inside either of them: WS-70 already moved it to
`.toolbar-crumb` in `index.html:31` and to `.toolbar-sub` in `board.html:44`.

The three matching CSS rules at `styles.css:569-587` are deleted with them (Assumption A9).

Those two `<img class="footer-lockup" src="img/flowcharge-lockup.png" …>` tags are the only
references to the file in the whole repository. On the user's instruction of 2026-08-28
(Decision 3), item 6 therefore also deletes:

- `src/public/img/flowcharge-lockup.png`, the file itself; and
- its entry in `tools/copy-assets.mjs`, `'img/flowcharge-lockup.png',` at line 22.

The user's reason: that particular lockup is probably not going to be used as is in the app.
The two deletions are one atomic step — see Contract 7 for why. `img/flowcharge-wordmark.png`
and `img/flowcharge-mark.png` stay in the copy list and on disk; both are still used.

**This reverses `PLN-62-r6bxg3` Assumption A5 by name.** A5 read: the mockups show no
footer at all, but they also show no update banner and no modals, so absence in a mockup is
not a deletion instruction — and commit `308a9ac` had deliberately added the lockup to both
footers on 2026-08-27. A5 also noted that `PLN-61-7f18vq` had specified footer deletion and
that PLN-62 was superseding it. The user has now decided the other way. This plan does not
re-argue A5's reasoning; it records that A5 is overturned by explicit instruction, and that
`PLN-61-7f18vq`'s original footer deletion is in effect reinstated. It also records that
this plan's own Assumption A5 — the one that kept the PNG on disk — is overturned in turn.

Items 4 and 5 likewise reverse `PLN-62-r6bxg3`'s "Out of scope" bullet that read: the home
screen's body content and ordering — the `<h1 class="home-heading">Your projects</h1>`, the
tile grid, and the add form stay exactly as they are. Same reversal, by explicit
instruction, recorded rather than silently overwritten.

### Contract 7 — the two copy-list deletions

`tools/copy-assets.mjs` lines 16-24 today:

```js
for (const name of [
  'index.html',
  'board.html',
  'styles.css',
  'fonts/fraunces-latin.woff2',
  'img/flowcharge-wordmark.png',
  'img/flowcharge-lockup.png',
  'img/flowcharge-mark.png',
]) {
```

After items 2 and 6, two entries are gone and five remain:

```js
for (const name of [
  'index.html',
  'board.html',
  'styles.css',
  'img/flowcharge-wordmark.png',
  'img/flowcharge-mark.png',
]) {
```

**Why each deletion is atomic with its file.** The loop below this list calls
`fs.copyFileSync(path.join(srcPublic, name), dest)` with no existence check, so it throws
`ENOENT` and fails `npm run build` the moment a listed file is missing. Deleting a file
without its entry breaks the build; deleting an entry without its file ships a dead copy of
an unused asset. So `fonts/fraunces-latin.woff2` and its entry go together in Phase 1, and
`img/flowcharge-lockup.png` and its entry go together in Phase 5.

Nothing else in this file changes. The source-map guard below the loop is untouched. The two
phases edit different lines of the same file and cannot conflict, but the second to land
finds the first's line numbers shifted — locate each entry by its filename string.

### Contract 8 — the home screen gap

`src/public/styles.css:611` today is the whole `.home` rule:

```css
.home { padding: 24px clamp(16px, 4vw, 40px) 30px; }
```

After item 7:

```css
.home { margin-top: 21px; padding: 24px clamp(16px, 4vw, 40px) 30px; }
```

**The padding is not touched, and the margin does not fight it.** Margin is outside the
box, padding inside it, so the two add rather than compete: `21px` of `var(--paper)`
background, then the existing `24px` of inset before the `Add a project` heading. The home
mockup renders exactly that sum, because it carries the identical `.home { padding: 24px
clamp(16px, 4vw, 40px) 30px; }` rule at its line 208 *and* the `.mockup-note` above it. So
matching the mockup means adding the note's height, not redistributing the padding. Folding
`21px` into the padding instead would have moved the gap inside `.home`'s box, which changes
nothing visually today but silently breaks if `.home` ever gains a background.

`.home` is a plain block `<section>` whose previous sibling is either `.toolbar-crumb`
(`display: flex`) or `.update-banner` (`display: flex`). Neither declares a bottom margin,
so there is no sibling margin to collapse with. `.home`'s own `padding-top: 24px` sits
between its top margin and its first child's, so no parent-child collapse can pull the new
margin inward either.

`.home` appears only in `src/public/index.html`. `src/public/board.html` has no such element,
so this rule cannot reach the board screen and needs no qualification — the same property
`.kpi-strip` has for item 3.

## Staged task breakdown

Five phases. Each is a complete change on its own, each leaves the app building and
running, and each is revertible without touching the others. Ordered highest-blast-radius
first, so the change most likely to draw a reaction is in front of the user earliest.

**Each phase is one commit.** That is Assumption A1 as the user confirmed it, and it matches
WS-71 and WS-70. A later tasks-authoring pass must keep the phases separably committable and
must not merge two into one commit.

There is no automated test suite in this repository (`package.json` has no `test` script,
and there is no test directory). Every verification below is a build plus a look, done with
`npm run electron:dev`, or `npm start` and a browser tab.

### Phase 1 — The display-font token swap and the Fraunces removal (item 2)

**Effort:** small. **Depends on:** nothing.

**Build.**
1. Replace `src/public/styles.css:92` with `--font-display: var(--font-body);`. Write no
   comment above it (Contract 1, Assumption A6).
2. Delete the `@font-face` block at `src/public/styles.css` lines 1-7, and the blank line
   after it. The file now opens on the palette comment block.
3. Delete the `'fonts/fraunces-latin.woff2',` entry from `tools/copy-assets.mjs` (line 20).
4. Delete `src/public/fonts/fraunces-latin.woff2` with `git rm`. Steps 3 and 4 must land in
   this same commit or `npm run build` breaks (Contract 7). Remove the entry before the
   file, so the build stays green at every point in between.
5. Delete `src/public/fonts/OFL.txt` with `git rm` (Decision 8). It licenses only the font
   step 4 removes. It has no copy-list entry, so it carries no build constraint. The two
   untracked Snasm `.otf` files stay, so `src/public/fonts/` does not become empty.
6. Change nothing else in any file.

**Files touched.** `src/public/styles.css`, `tools/copy-assets.mjs`,
`src/public/fonts/fraunces-latin.woff2` (deleted) and `src/public/fonts/OFL.txt` (deleted).

**Verify.**
1. `npm run build` succeeds. This is the step that catches a half-done deletion, in either
   direction.
2. The build's `copied …` log lines no longer name `fonts/fraunces-latin.woff2`. Check the
   log, not `dist/`: neither `copy-assets.mjs` nor `bundle-public.mjs` cleans `dist/public/`
   of anything but `.js` files, so a stale copy from an earlier build survives there and
   would make a directory listing misleading. To check `dist/` instead, delete
   `dist/public/fonts/` first and confirm the build does not recreate it.
3. `grep -rn "Fraunces\|fraunces" src/public/` returns nothing.
4. Board screen: the four KPI values and both lower-panel `<h2>` headings render sans, not
   serif. Compare side by side against `mockups/board-toolbar-mockup.html` in a second tab.
5. Home screen: the `Add a project` heading and every tile name render sans. Compare
   against `mockups/home-toolbar-mockup.html`.
6. Every mono element is unchanged: card ids, tags, `.tb-meta`, `.tb-version`, KPI labels,
   column-head names, `.tile-path`, `.tile-added`.
7. Open a card's detail modal. Its title, its section titles, and any `h4`/`h5`/`h6` inside
   rendered plan prose are now sans too. This is Contract 2's confirmed consequence — check
   it renders as expected, in the knowledge that the decision is already made.
8. Both light and dark mode.
9. No network request for a `.woff2` in devtools on either screen, and no console warning
   about a missing font resource.

**Revert.** `git revert` of this one commit. There is deliberately no in-tree reversal path
any more: no preserved comment, no `@font-face` block, no font file, no licence file. See
Assumption A6.

### Phase 2 — Board chrome: the card-foot rule and the KPI gap (items 1 and 3)

**Effort:** small. **Depends on:** nothing. Independent of Phase 1.

**Build.**
1. In `src/public/styles.css:500`, change `var(--rule-strong)` to `var(--line)` in
   `.card-foot`'s `border-top`.
2. Delete both `--rule-strong` declarations: `styles.css:47` (light, `#9A7A56`) and
   `styles.css:113` (dark, `#A2805B`). Read the palette comment block at `styles.css:9-32`
   and confirm its prose is still accurate. Expect no edit: it documents the five source
   logo colours and the two derivation operations, not the derived tokens, and bronze stays
   in use as `--toolbar-bg` light. Change it only if the deletion actually falsified a
   statement in it. Do not touch any other token (Contract 3).
3. Before doing step 4, open `mockups/board-toolbar-mockup.html` and read
   `document.querySelector('.mockup-note').offsetHeight`. Use that number if it differs from
   `21`, and carry the same number into Phase 5.
4. Add `margin-top: 21px;` to the `.kpi-strip` block at `src/public/styles.css:280`.

**Files touched.** `src/public/styles.css`.

**Verify.**
1. `npm run build` succeeds.
2. `grep -n "rule-strong" src/public/styles.css` returns nothing.
3. Board screen, light mode: a card's foot rule is the same oak tone as the card's own
   border, not bronze.
4. Board screen, dark mode: the same, in `#3B3F46`.
5. A dropped card next to a live one: both foot rules read the same hue. The dropped one is
   only fainter, never a different colour. This is the specific defect item 1 exists to fix.
6. The space between the info bar and the KPI strip matches the mockup's, checked by
   flipping between the app and `mockups/board-toolbar-mockup.html` at the same window
   width.
7. Force `#update-banner` visible (remove its `hidden` attribute in devtools). The three
   chrome bands stay flush; the gap is between the banner and the KPI strip. Restore
   `hidden`.
8. Narrow the window below `880px`, where the KPI strip drops to two columns. The gap is
   unchanged.

**Revert.** One commit, four lines.

### Phase 3 — Home screen body: drop the heading, lift the form (items 4 and 5)

**Effort:** small. **Depends on:** nothing.

**Build.** Apply Contract 5 to `src/public/index.html`: delete the `<h1 class="home-heading">Your
projects</h1>` line, then move the four add-project elements — the `<h2>`, `#add-form`,
`#choose-folder-button`, `#add-error` — above `<div id="project-tiles"></div>`, preserving
their relative order and every attribute. Do not edit `styles.css` (Assumption A8). Do not
edit `home.ts`.

**Files touched.** `src/public/index.html`.

**Verify.**
1. `npm run build` succeeds.
2. Home screen top to bottom: chrome, `Add a project`, the add-project control, then the
   tile grid. No `Your projects` anywhere.
3. Side by side against `mockups/home-toolbar-mockup.html` — same order, same spacing
   *inside* `<section class="home">`. The space *above* the heading is item 7's, and only
   matches the mockup once Phase 5 has landed too. If Phase 5 is not in yet, judge the
   ordering here and leave the top clearance to Phase 5's own check.
4. In the Electron build, `#choose-folder-button` is the visible control and `#add-form` is
   hidden (`home.ts:350-356`). Check the space above the tile grid in this state — see
   Decision 6.
5. In a plain browser tab, `#add-form` is the visible control. `28px` separates it from the
   tile grid.
6. Add a project: the new tile appears in the grid below. Rename a tile. Remove a tile.
   Trigger an error, for example by adding a path with no `flowcharge/` folder, and confirm
   `#add-error` still renders in place.

**Revert.** One commit, one file.

### Phase 4 — The home screen gap (item 7)

**Effort:** small. **Depends on:** nothing. Uses Phase 2 step 3's measurement if Phase 2 has
already run; otherwise take the measurement here, the same way, from
`mockups/home-toolbar-mockup.html`.

**Build.** Add `margin-top: 21px;` to the `.home` rule at `src/public/styles.css:611`,
leaving its `padding` shorthand exactly as it is (Contract 8). Change nothing else.

**Files touched.** `src/public/styles.css`.

**Verify.**
1. `npm run build` succeeds.
2. Home screen: the `Add a project` heading no longer sits close under the crumb bar. The
   clearance above it reads as `21px` of page background plus the existing `24px` inset.
3. Side by side against `mockups/home-toolbar-mockup.html` at the same window width, with
   Phase 3 also in: the top of the page body sits at the same height in both.
4. The gap paints `var(--paper)`, not the crumb bar's `var(--tile-bg)`. The crumb bar's own
   band ends cleanly at its bottom edge.
5. Force `#update-banner` visible (remove its `hidden` attribute in devtools). The crumb bar
   and the banner stay flush against each other; the `21px` opens below the banner. Restore
   `hidden`.
6. Board screen: unchanged. `.home` is not present there.
7. Both light and dark mode. Narrow the window into the `clamp()` range for `.home`'s
   horizontal padding and confirm the vertical gap does not move.

**Revert.** One commit, one line.

### Phase 5 — Delete both footers and the lockup asset (item 6)

**Effort:** small. **Depends on:** nothing.

**Build.**
1. Delete `<footer class="note">…</footer>` from `src/public/index.html` (lines 57-63).
2. Delete `<footer class="note">…</footer>` from `src/public/board.html` (lines 108-114).
3. Delete the `footer.note`, `footer.note code` and `footer.note .footer-lockup` rules from
   `src/public/styles.css` (lines 569-587).
4. Delete `src/public/img/flowcharge-lockup.png` with `git rm`.
5. Delete the `'img/flowcharge-lockup.png',` entry from `tools/copy-assets.mjs` (line 22).
   Steps 4 and 5 must land in this same commit or `npm run build` breaks (Contract 7).
6. Leave `img/flowcharge-wordmark.png` and `img/flowcharge-mark.png` alone, on disk and in
   the copy list. Both are still used.

**Files touched.** `src/public/index.html`, `src/public/board.html`,
`src/public/styles.css`, `tools/copy-assets.mjs`, and
`src/public/img/flowcharge-lockup.png` (deleted).

**Verify.**
1. `npm run build` succeeds **with the copy-list entry removed**. This is the step that
   catches a half-done deletion: the file without its entry, or the entry without its file.
2. The build's `copied …` log lines still name `img/flowcharge-wordmark.png` and
   `img/flowcharge-mark.png`, and no longer name `img/flowcharge-lockup.png`. Read the log,
   not `dist/`: the build sweeps only `.js` files from `dist/public/`, so a stale PNG from
   an earlier build survives there. To check `dist/` instead, delete
   `dist/public/img/flowcharge-lockup.png` first and confirm the build does not restore it.
3. `grep -rn "flowcharge-lockup" src/ tools/` returns nothing.
4. Neither screen shows a footer, a lockup image, or the disclaimer prose. No broken-image
   placeholder and no 404 in devtools on either screen.
5. Both screens still show the version string: on the crumb bar on home, on the info bar on
   the board. This is the one regression risk worth checking, and it is covered because
   WS-70 already moved `#app-version` out of both footers.
6. The board's lower panels are the last content on the page and end with the page's own
   bottom padding, with no dangling whitespace where the footer was.
7. Both light and dark mode, both screens.

**Revert.** `git revert` of this one commit, which restores the markup, the CSS, the copy
entry and the binary PNG together.

## Data & compatibility

There is no data. No schema, no stored state, no API, no serialised format is touched.
`localStorage` is used only by the theme mechanism, which this plan does not go near.

Backward compatibility has one real surface: `#app-version`. It is read and written by
`src/public/app-version.ts:17` via `document.getElementById('app-version')`, and the element
survives Phase 5 untouched in its WS-70 home. Nothing else this plan deletes carries an id
or is queried by any script.

`tools/copy-assets.mjs` copies a fixed list of filenames (lines 16-24) and throws if one is
missing. This plan removes three files from `src/public/`, two of which are on that list,
and removes those two entries in the same commits as their files. That is why `npm run
build` succeeding is an explicit acceptance criterion for Phase 1 and for Phase 5 rather
than an assumed background fact: it is the only automatic check that each pair stayed
together. The third file, `src/public/fonts/OFL.txt`, is on no list and is fetched by no
page, so its deletion has no build consequence at all. After both phases the list holds five
entries and every one of them still exists on disk.

Packaged builds shrink by the two removed copied assets: `fraunces-latin.woff2` at roughly
67 KB and `flowcharge-lockup.png`. `OFL.txt` never shipped in the build or the package, so
deleting it changes no artefact size. Nothing depends on any of the three being present, in
the app or in the packaging config.

**Rollback.** Every phase is a plain `git revert` of one commit, with no ordering
constraint between them and no state to unwind. Phase 1 and Phase 5 each delete a binary
file, so their reverts must go through git rather than by hand — `git revert` restores the
files, the copy-list entry, and the markup or CSS in one operation. No phase can be
hand-reverted from what is left in the tree, and for Phase 1 that is a deliberate,
user-chosen property (Assumption A6).

## Testing strategy

There is no test runner in this repository and this plan does not add one — that would be a
separate workstream, and none of the seven items needs it. All seven are visual, and the
only honest verification is a build and a comparison against the mockup files.

**Where a later test-writing pass could attach**, if one is ever wanted, and in rough order
of value:

- **Static markup assertions**, cheapest and highest value. Parse `src/public/index.html`
  and `src/public/board.html` and assert: no `<footer class="note">` in either; exactly one
  `.home-heading` in `index.html`; `#add-form` precedes `#project-tiles` in document order.
  Those three cover items 4, 5 and 6 and would catch a future regression that a visual pass
  would miss.
- **Stylesheet assertions**, also cheap. Assert `--font-display` resolves through
  `--font-body`, that no `@font-face` block and no `--rule-strong` declaration remain, that
  `.card-foot`'s `border-top` names `--line`, and that `.kpi-strip` and `.home` each carry a
  non-zero `margin-top`. Covers items 1, 2, 3 and 7.
- **Build-manifest assertion**, cheap and specific to this plan's two deletions. Assert that
  every filename in `tools/copy-assets.mjs`'s list exists under `src/public/`. That is the
  failure mode Phases 1 and 5 each carry, made explicit instead of relying on the build
  throwing.
- **Screenshot comparison** against the two mockup files. The highest-fidelity option and
  the most expensive, needing a headless browser and a baseline-image workflow the project
  does not have. Not recommended for seven small changes.

Per phase, the "Verify" list in each phase above is the test plan, and it is complete.

## Decisions

The plan originally carried seven open questions, each with a stated default. **The user
answered all seven on 2026-08-28.** Folding answer 4 in raised an eighth question, about
`src/public/fonts/OFL.txt`, and **the user answered that one too, on 2026-08-28.** All eight
are recorded here as settled, because several answers overturned the plan's default and the
record needs to show which way each went. **No question in this plan remains open.**

1. **Should the seven non-mockup selectors also lose Fraunces? — Yes. Option A, the plan's
   default, confirmed.** One token edit; all eleven `var(--font-display)` consumers go sans,
   including `.load-state h2`, `.tiles-empty h3`, `.ws-modal-title`, `.ws-section-title` and
   `.ws-plan h4`/`h5`/`h6`. The app has one heading face. Contract 2 lists them. Contract 1
   and Contract 2 are unchanged by this answer beyond being marked settled.

2. **`--rule-strong` becomes an orphan. — Delete both declarations now. Option B; the
   plan's default was reversed.** The user's reason: that style is not coming back, and if
   it ever has to come back, it will be created again. Both declarations go in Phase 2, in
   the same commit that strands them, not in a later dead-token pass. See Contract 3.

3. **`img/flowcharge-lockup.png` becomes an orphan. — Delete the file and its
   `tools/copy-assets.mjs` entry together, now. Option B; the plan's default was reversed.**
   The user's reason: that particular lockup is probably not going to be used as is in the
   app. Both go in Phase 5. `npm run build` succeeding is still the acceptance bar, but it
   now means succeeding *with the entry removed*, not with the entry preserved. This
   overturns this plan's Assumption A5. See Contracts 6 and 7.

4. **`fonts/fraunces-latin.woff2` stops being fetched. — Delete the font file, its
   `@font-face` block, and its `tools/copy-assets.mjs` entry. Option B; the plan's default
   was reversed.** The user's words: "No reversal, remove it all." That also settles the
   four-line preserved-stack comment the mockups keep — it is not written either, because
   the user wants no reversal path at all, not merely the file gone. This overturns
   Assumption A6. See Contract 1, Contract 7 and Phase 1.

5. **Does the home screen want the same gap as item 3? — Yes, and it is now item 7. The
   plan's "leave it" recommendation was reversed, and this is new scope, not only an
   answer.** The user's reason: the add-project form should not sit flush against the crumb
   bar. The home mockup already has that breathing room, which is exactly why the workstream
   brief never asked for it — it was present and taken for granted. `21px` between
   `.toolbar-crumb` and `<section class="home">`, same size and same derivation as item 3
   (Assumption A3), on `.home { margin-top }` (Assumption A10). Acceptance criteria 36-42,
   Contract 8, Phase 4.

6. **Spacing above the tile grid in the folder-picker build. — No CSS change now. Option A,
   the plan's default, confirmed.** `.home-heading + *` (`styles.css:618`) gives `28px` to
   whichever element directly follows the heading. In the Electron build `home.ts:350-356`
   hides `#add-form` and shows `#choose-folder-button` instead; a `hidden` element is
   `display: none`, so its margin does not render, and `#choose-folder-button` is not
   adjacent to the heading and gets no margin of its own. Item 5's reorder does not create
   this, but it moves where it shows. Judge it during Phase 3 verification step 4, and only
   then extend the rule to `.home-heading + *, #choose-folder-button { margin-bottom: 28px; }`
   if it looks wrong. Neither mockup has this element, so there is no specification to
   follow.

7. **Release and deployment constraints. — Assumption A1 confirmed as written, with commit
   granularity added.** No production data, no live users, no mid-feature shippability
   requirement beyond each phase standing alone, no migration, rollback by `git revert`.
   Additionally: the five phases land as **one commit per phase**, matching this project's
   standing practice from WS-71 (five commits, one per parent task) and WS-70 (four commits,
   one per parent task). No packaged release ships mid-way; each phase only has to leave
   `npm run build` passing. A1 and the Staged task breakdown both now state this, so a later
   tasks-authoring pass keeps the phases as separably committable units.

8. **`src/public/fonts/OFL.txt` becomes an orphan. — Delete it with the font, in Phase 1.
   Option B; the plan's default was reversed.** Deleting
   `src/public/fonts/fraunces-latin.woff2` leaves the Fraunces SIL Open Font Licence text
   behind with nothing to license. It is referenced by no page, is not in
   `tools/copy-assets.mjs`'s copy list, and so ships in neither the build nor the package —
   it exists only in the repository, next to the font it came with. The plan's default was
   to leave it, on scope grounds only, because the user's answer 4 named three things to
   delete and this was not one of them. The user has now named it: it goes with the font.
   There is no build or legal risk either way, and there is none in deleting it: a licence
   for an absent font grants nothing. `src/public/fonts/` still does not become an empty
   directory, because the two untracked Snasm `.otf` files stay. See Contract 1, acceptance
   criteria 12-14, and Phase 1 build step 5.

## Open questions

None. All eight questions this plan raised are settled and recorded in Decisions 1-8.

## Alternatives considered and rejected

- **Scoped per-selector font override instead of the token swap (item 2).** Leave
  `--font-display` pointing at Fraunces and add `font-family: var(--font-body)` to only the
  four selectors both mockups actually contain. *Rejected.* It is not the mechanism either
  mockup uses — both edit the token, at their line 71 — and copying the outcome by a
  different mechanism means the next person comparing the two files finds them structurally
  different. It replaces one declaration with four, which is the same value stated four
  times. It leaves the app with a sans board and a serif modal, which is a new inconsistency
  introduced in the name of fidelity. And it leaves a token named `--font-display`, still
  holding a serif stack, whose only remaining consumers are the seven selectors nobody
  decided about — the worst of both. It was kept alive as the fallback in case the user
  disliked the modal repaint; Decision 1 confirmed the repaint, so the fallback is now dead.

- **Retire `--font-display` entirely.** Replace all eleven consumers with `var(--font-body)`
  and delete the token, as well as the `@font-face` block, `fonts/fraunces-latin.woff2` and
  its `tools/copy-assets.mjs` entry. **Partly adopted, on Decisions 4 and 8.** The asset half
  of this alternative is now the plan: the `@font-face` block, the font file, the copy entry,
  the preserved-stack comment and `fonts/OFL.txt` all go in Phase 1, and the
  one-edit-to-restore property is
  deliberately given up, because the user asked for no reversal path. The token half stays
  *rejected*. `--font-display` remains, holding `var(--font-body)`, and all eleven consumers
  keep reading it. Rewriting eleven selectors would be eleven edits where one suffices, and
  would throw away the single seam where the app's heading face is chosen — which is the
  thing a future font change needs most, whether or not Fraunces ever comes back.

- **Port both mockups' `<style>` blocks wholesale into `styles.css`.** *Rejected*, for the
  same reasons `PLN-62-r6bxg3` rejected it, which have not changed: the mockups carry the
  full WS-71 palette and three palette blocks where the app has two, so a wholesale port
  would drag palette decisions WS-71 owns into a chrome workstream. The seven items are
  seven targeted edits and are correctly applied as seven targeted edits.

- **Put item 3's gap on `.toolbar-sub { margin-bottom }`, matching the mockup's DOM position
  literally.** *Rejected.* Assumption A4 has the detail. The real board has `#update-banner`
  between the two elements, deliberately styled as a flush continuation of the chrome bands
  (`styles.css:1185-1205`). A bottom margin on `.toolbar-sub` breaks that stacking whenever
  the banner shows, and puts the gap in the wrong place. `margin-top` on `.kpi-strip`
  produces the mockup's appearance in both banner states.

- **Put item 7's gap on `.toolbar-crumb { margin-bottom }`, or fold it into `.home`'s
  padding.** *Rejected*, on Assumption A10 and Contract 8. `.toolbar-crumb` has the same
  banner problem `.toolbar-sub` has, and worse: on the home screen the banner sits directly
  under the crumb bar, so a bottom margin there would separate the two bands on the one
  screen where they are the whole of the chrome. Folding `21px` into `.home`'s existing
  `24px` padding would render identically today but moves the gap inside `.home`'s box, so
  it stops being page background the moment `.home` gains one — and it also stops matching
  the mockup, which keeps the `24px` padding and adds height above it.

- **Insert a real spacer element in `board.html` or `index.html` where `.mockup-note` sat.**
  *Rejected.* An empty `<div>` whose only job is height is what a margin is for. It would
  also need a class and a rule, so it is strictly more code than the margin, with a
  meaningless element left in the document for a screen reader to walk past.

- **Demote the home `<h1>` to a `<h2>` and keep it, or move it above the add form, rather
  than deleting it.** *Rejected.* Item 4 says "remove entirely", and the home mockup's
  `<section class="home">` contains exactly one heading, the `Add a project` `<h2>`. There is
  nothing to interpret.

- **Do items 4, 5 and 6 in one phase as "the home screen and footers pass".** *Rejected.*
  Item 6 touches both screens, `styles.css` and the build script; items 4 and 5 touch one
  file. Splitting them keeps each revert to its own blast radius, and item 6 is the one with
  a build-breaking failure mode worth verifying on its own.

- **Fold item 7 into Phase 3, as one "home screen" commit with items 4 and 5.** *Rejected*,
  though it is the closest call in the breakdown. Item 7 is a `styles.css` chrome-spacing
  change and Phase 3 is an `index.html` body-content change whose whole claim is that it
  needs no CSS edit (Assumption A8); merging them would blur that. Item 7 also belongs to the
  same family as item 3 — one `.mockup-note` height restored on each screen — and giving it
  its own phase keeps one commit per revertible visual change, which is the pattern every
  other phase follows and which Decision 7 requires. The cost is that a full home-versus-
  mockup comparison needs both Phase 3 and Phase 4 in; Phase 3 verification step 3 says so.

- **Defer the three orphan cleanups to a later dead-asset pass.** *Rejected*, on Decisions
  2, 3 and 4. This was the plan's own default for all three and the user reversed all three.
  Each cleanup is deleted in the same commit as the change that strands it, which means no
  commit in this workstream ever leaves an unreferenced token or an uncopied asset behind,
  and no follow-up workstream has to reconstruct why they were orphaned.

## Final summary

**Approach:** do exactly what each mockup does, by the mechanism the mockup uses, and
nothing else — including item 2's `--font-display` swap at the token, not per selector. Each
of the three orphans this creates is deleted in the same commit that creates it.

**Size:** five phases, all small. CSS, static HTML, one build script, and three deleted
files — two binary assets and one licence text. No TypeScript, no dependency, no new asset.
Phase order is 2 → (1, 3) → (4, 5) → 7 → 6, highest blast radius first. One commit per
phase, five commits total, matching WS-71 and WS-70.

**Top risks:**
1. The token swap repaints seven selectors the mockups do not contain, including every modal
   title and all rendered plan prose headings. Confirmed by the user (Decision 1) and
   enumerated in Contract 2 — but it is still the change most likely to draw a reaction, so
   Phase 1 verification looks at a modal before calling it done.
2. Phase 1 and Phase 5 each delete a vendored asset **and** its `tools/copy-assets.mjs`
   entry. Either half without the other is a broken build or a shipped dead file. Both pairs
   must land in one commit, and `npm run build` is the check.
3. Item 2 has no in-tree reversal path by design: no preserved font-stack comment, no
   `@font-face` block, no woff2 file, no licence file. Reversing it means `git revert` of
   Phase 1's commit. The user chose this explicitly (Decisions 4 and 8, Assumption A6).
4. The `21px` gap value for items 3 and 7 is derived from the mockups' arithmetic, not
   measured. Phase 2 step 3 measures it, the measurement wins, and Phase 4 uses the same
   number.

**Needs a user's answer:** nothing. All eight questions are settled and recorded in
Decisions 1-8.

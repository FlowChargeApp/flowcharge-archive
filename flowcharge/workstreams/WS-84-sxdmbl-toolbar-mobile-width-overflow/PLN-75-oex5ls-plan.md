---
id: PLN-75-oex5ls
type: plan
workstream: WS-84-sxdmbl
slug: toolbar-mobile-width-overflow
title: "Fit the toolbar on narrow phones with a glyph integrations button"
status: ready
created: 2026-08-31
updated: 2026-09-03
depends_on: []
links: []
---

# Fit the toolbar on narrow phones with a glyph integrations button

## Summary

The home toolbar (`<header class="toolbar">`, `src/public/index.html:12-27`) needs
about 450px of width. `.toolbar` is a `display: flex` row with no `flex-wrap`
(`src/public/styles.css:174-179`), every in-flow child is `flex: none` (`.tb-mark` is
absolutely positioned and takes no row width), and no element sets `overflow-x`. The
excess therefore becomes page-level horizontal scroll, which reads as the third theme
button disappearing off the right edge. This is confirmed at 402px, where the document
scroll width is 440px against a 402px client width.

Two changes remove the excess. First, the "Manage integrations" button loses its text
label and carries a briefcase glyph instead, which drops its width from about 138px to
24px. Second, the FlowCharge wordmark drops from 31px tall to 26px tall below 360px,
which recovers a further 31px and takes the row to 306px, clearing 320px.

The glyph is written as inline SVG in `index.html`, matching the three theme buttons
that already sit in the same row, rather than being built at runtime by `iconSvg()`
in `home.ts`. Nothing else about the button changes: same element, same `id`, same
click handler, same dialog.

## Scope

### Acceptance criteria

1. At a 402px viewport the home toolbar shows the wordmark, the integrations button and all three theme buttons, with no horizontal page scroll.
2. At a 360px viewport the same holds.
3. At a 320px viewport the same holds.
4. The integrations button shows a briefcase glyph and no visible text at every viewport width.
5. The button keeps the id `manage-integrations-button` and still opens the integrations dialog on click.
6. The button exposes the accessible name "Manage integrations" and shows that same string as a hover tooltip.
7. At 360px and below the wordmark renders 26px tall on both `index.html` and `board.html`; at 361px and above it stays 31px.
8. At 768px and above the toolbar is visually unchanged from the current build, apart from the integrations button's glyph.

### Out of scope

- The sort row and the filter row on `board.html`. They carry the same overflow
  pattern and belong to `WS-55-xrubq1-sort-row-mobile-and-accessibility` and
  `WS-56-kdu68p-filter-row-scale-and-mobile`. This plan touches `.toolbar` only.
- The integrations dialog itself (`src/public/index.html:56-78`) and everything
  `home.ts` does when it opens.
- The click handler at `src/public/home.ts:896` and the `iconSvg()` helper at
  `src/public/home.ts:63-81`. No TypeScript file changes.
- Any `flex-wrap` or `overflow-x` rule on `.toolbar`. Removing the excess width is
  the fix; containing the excess is a different fix and is not asked for.
- The `.tb-mark` badge, already hidden below 520px at `src/public/styles.css:190`.

### Assumptions

- **A1 — inline SVG, not `iconSvg()`.** The three theme buttons at
  `src/public/index.html:17-25` are icon-only buttons with inline SVG, an
  `aria-label` and a `title`, in the same static file and the same toolbar row.
  That is the closer precedent. `iconSvg()` exists because `home.ts` builds project
  tiles dynamically and `document.createElement` cannot make an SVG element; this
  button is static markup, so a runtime injection would add JavaScript for a fixed
  thing and leave the button visually empty until the bundle loads.
- **A2 — Lucide `briefcase` is the icon.** Lucide ships a `briefcase` icon, so no
  substitute is needed. Its geometry is two nodes: a rounded `rect` for the case and
  one `path` for the handle. The exact attribute values are transcribed from Lucide
  at task time.
- **A3 — 24x24 is the glyph button's box.** This matches the theme segment's 24px
  outer height (`src/public/styles.css:259-263`, 22px buttons inside a 1px-bordered
  wrapper) and the 26px square of `.tile-actions .tile-action`
  (`src/public/styles.css:673-680`). It also meets WCAG 2.2 AA 2.5.8 Target Size
  (Minimum) exactly.
- **A4 — 360px is the wordmark breakpoint and 26px is the height.** See the width
  table in Design. The row fits from 337px up once the button is a glyph, so 360px
  leaves a 23px cushion against font and zoom variance, and follows the file's own
  `@media (max-width: 520px)` convention at line 190.
- **A5 — the wordmark shrink applies to `board.html` too.** Both pages load
  `styles.css`. `board.html`'s toolbar already fits at 320px, so this is a cosmetic
  change there, accepted as the cost of one shared rule.
- **A6 — no flag and no staged rollout.** This is presentational, reversible by
  reverting two small diffs, and matches how WS-83 was scoped.
- **A7 — next build is the release.** The change lands on the next `npm run build`
  and enters the packaged app on its next `package:mac` run. See Open questions Q1.

## Key flows

**Open integrations from the toolbar** — **Actor:** any user on the home screen.
**Preconditions:** the home page is loaded. **Main flow:** the user sees a briefcase
glyph button between the wordmark and the theme toggle, hovers it and reads the
"Manage integrations" tooltip, clicks it, and the integrations dialog opens exactly as
it does today. **Outcome:** the dialog opens; nothing about its content changes.
**Edge cases:** a screen-reader user hears "Manage integrations, button" from the
`aria-label`, because the glyph is `aria-hidden`. A keyboard user reaches the button
in the same tab order and sees the existing `.tb-button:focus-visible` outline
(`src/public/styles.css:248`). A touch user gets a 24x24 target, marginally taller than
the 26x22 theme buttons beside it (`src/public/styles.css:259-263`).

## Design

### Width budget

The current row measures 450.07px in the browser: a 192.5px wordmark, a 137.57px button
and an 80px theme segment, plus 20px of padding and 20px of gaps. The table below rounds
each item up, so its 451px total is one pixel conservative and the projected figures can
be trusted. The rounded projections were checked the same way: 336.5px after the glyph
swap and 305.45px after the wordmark shrink. Padding is `clamp(10px, 2vw, 16px)` per side
(`src/public/styles.css:177`), which resolves to 10px per side at every width in
question. The wordmark is a 770x124 PNG, so its width is its height times 6.21.

| Item | Today | After the glyph swap | After the 26px wordmark |
| --- | --- | --- | --- |
| Padding, both sides | 20px | 20px | 20px |
| `.tb-wordmark` | 193px | 193px | 162px |
| Gap | 10px | 10px | 10px |
| `#manage-integrations-button` | 138px | 24px | 24px |
| Gap | 10px | 10px | 10px |
| `#theme-seg` | 80px | 80px | 80px |
| **Row total** | **451px** | **337px** | **306px** |

337px clears 360px and 402px. 306px clears 320px.

### Markup contract — `src/public/index.html:15`

The button element keeps its tag, `type="button"`, its `id`, and its position between
the `.tb-mark` image and `#theme-seg`. It changes in three ways.

- `class` becomes `tb-button tb-button-icon`. Keeping `tb-button` is load-bearing:
  `.toolbar .tb-button { margin-left: auto; }` and
  `.toolbar .tb-button ~ .seg { margin-left: 0; }` (`src/public/styles.css:254-255`)
  are what right-align the row, and `.tb-button:focus-visible` supplies the focus
  ring.
- It gains `aria-label="Manage integrations"` and `title="Manage integrations"`. Both
  strings match the dialog's own heading at `src/public/index.html:59` verbatim.
- Its text node is replaced by one inline `<svg>` child carrying the same attribute
  set the theme buttons use — `viewBox="0 0 24 24"`, `fill="none"`,
  `stroke="currentColor"`, `stroke-width="2"`, `stroke-linecap="round"`,
  `stroke-linejoin="round"` — plus `aria-hidden="true"`, so the glyph never competes
  with the `aria-label`. Its children are Lucide `briefcase`: a rounded `rect` for the
  case body and one `path` for the handle.

No `width` or `height` attribute goes on the SVG; the CSS below sizes it, as it does
for the theme buttons at `src/public/styles.css:265`.

`board.html` has no such button and its markup is not touched.

### CSS contract — `src/public/styles.css`

Two additions, no deletions.

- A `.tb-button-icon` rule placed directly after `.tb-button:focus-visible` (line 248),
  setting `display: inline-flex`, `align-items: center`, `justify-content: center`,
  `width: 24px`, `height: 24px`, `padding: 0`. The global `* { box-sizing: border-box }`
  at line 148 makes 24px the outer size including the inherited 1px border. A companion
  `.tb-button-icon svg { width: 14px; height: 14px; }` matches the 14px that
  `iconSvg()` uses at `src/public/home.ts:65-66`.
- A `@media (max-width: 360px)` block placed directly after the `.tb-wordmark` rule at
  line 181, setting `.tb-wordmark { height: 26px; }` only. `width: auto`, `flex: none`,
  `display: block` and `margin-top: 6px` are all inherited from the base rule and stay
  as they are; 26px plus the 6px margin is 32px, still inside the 44px bar.

The base `.tb-button` rule at lines 242-246 is not edited. Its `padding: 3px 10px` and
`font-size: 12px` are overridden by the variant, and leaving the base rule intact keeps
it available for any future text button in the toolbar.

### What does not change

`src/public/home.ts` gains no line. The listener at line 896, `iconSvg()`, the
`SQUARE_PEN_PATHS` and `TRASH_2_PATHS` arrays, and every dialog function are untouched.
`tools/copy-assets.mjs:17-21` already copies `index.html` and `styles.css`, so the build
needs no change either.

## Stages

1. **Glyph swap** — replace the button's label with the briefcase glyph and add the
   `.tb-button-icon` rule. First because it carries the whole accessibility and
   discoverability risk and removes 114 of the 131 excess pixels on its own. Done when
   the toolbar fits at 402px and 360px with no horizontal scroll, the button opens the
   dialog, and a screen reader announces "Manage integrations".
2. **Wordmark shrink below 360px** — add the one-line media query. Second because it
   is a cosmetic top-up that only becomes observable once stage 1 has landed. Done when
   the toolbar fits at 320px on both `index.html` and `board.html`, and is unchanged at
   361px and above.

## Data & compatibility

- No data model, no storage, no migration, no API or IPC contract is touched.
- The button's `id` and its DOM position survive, so any consumer that finds it by id
  keeps working. The one contract that does break is finding the button by its visible
  text; the repository has no browser test harness and no such consumer.
- `WS-83-vskjrr-disable-integrations-button-over-lan` carries workstream status
  `backlog`, but its plan PLN-74-npqccu and its task list TL-87-sb1ghy are both `ready`
  and unexecuted. That plan edits the same button at `src/public/index.html:15`, adds a
  `.tb-button:disabled` rule in `styles.css`, and narrows the existing
  `.tb-button:hover` rule at `src/public/styles.css:247`. Whichever lands second needs a
  manual merge in both files. One conflict is real, not just textual: PLN-74 ships the
  button with its own `title` giving the LAN reason, and has `home.ts` remove that
  `title` once access is proven local. This plan's `title="Manage integrations"` is the
  string that must be restored at that point, not an empty attribute. See Open
  questions Q2.
- Rollback is per stage. Reverting stage 2 restores the 31px wordmark and leaves the
  glyph fix in place. Reverting stage 1 restores the text label. Neither revert leaves
  a half state, because each stage's markup and CSS land together.

## Testing strategy

There is no browser test harness. `package.json` declares no `test` script, and every
unit test in the repository sits under `src/lib` as a `.test.ts` file over library
modules — extraction, projects, agentic tools, update checks and others. None of them
touch the DOM, so none can reach this change. Verification is manual for both stages and
belongs in the task list's verify steps.

- **Stage 1** — run `npm start`, open the home page, and check the glyph, the tooltip,
  the accessible name in the browser's accessibility inspector, the focus ring under
  keyboard tabbing, and that a click still opens the dialog. Check the absence of
  horizontal page scroll at 402px and 360px in the responsive device toolbar. Check
  both light and dark themes, because the glyph inherits `currentColor` from
  `--toolbar-ink-soft`.
- **Stage 2** — repeat the horizontal-scroll check at 320px on `index.html` and on
  `board.html`, and confirm 361px and 768px are unchanged.
- No unit or integration coverage is added. A future test-writing pass would have no
  seam to attach to here.

## Open questions

1. **Is there a release constraint on this change?** I assumed there is none (A7): it
   lands on the next `npm run build` and reaches the packaged FlowCharge app on its next
   `package:mac` run. If it must ride a specific tagged release instead, that changes
   sequencing but not the design.
2. **Which of WS-84 and WS-83 lands first?** I assumed either order, with a manual merge
   on `src/public/index.html:15` and on the `.tb-button` block in `styles.css` for
   whichever is second. Landing WS-84 first is marginally simpler, because WS-83 then
   adds `disabled` to a button whose shape is already final. Either order still needs
   WS-83's title handling reconciled with this plan's `title="Manage integrations"`, as
   Data & compatibility records.

## Adjacent opportunities

Not requested; listed only so they can be promoted deliberately.

1. Serve a wordmark asset sized for its 193px slot instead of the 770px-wide,
   92KB PNG. Skip — it is a separate asset workstream, not a layout fix.
2. Give `.toolbar` a `flex-wrap: wrap` or `overflow-x: clip` guard so any future
   toolbar addition degrades instead of overflowing. Skip — it overlaps the strategy
   WS-55 and WS-56 own, and this plan is explicitly scoped to removing width.

## Alternatives considered and rejected

1. **Build the glyph with `iconSvg()` in `home.ts`.** Rejected: it adds runtime
   JavaScript for a static element, leaves the button empty until the bundle loads, and
   diverges from the three inline-SVG icon buttons beside it in the same file.
2. **Add `flex-wrap: wrap` to `.toolbar` and let the row wrap to two lines.** Rejected:
   it doubles the toolbar's height on phones and does not honour the stated ask, which
   is a glyph button.
3. **Hide the wordmark below 360px, as `.tb-mark` is hidden below 520px.** Rejected:
   the brief asks for a shrink via a media query or fluid rule, and the wordmark is the
   page's only branding once `.tb-mark` is gone.
4. **Use a fluid `height: clamp(26px, 8vw, 31px)` on `.tb-wordmark` instead of a
   breakpoint.** Rejected: it changes the logo's size continuously across all narrow
   widths, which is harder to verify against a fixed acceptance criterion, and the file
   already uses discrete breakpoints.
5. **Keep the text label above a breakpoint and swap to the glyph only below it.**
   Rejected: it makes the button two components with two accessible-name paths, and the
   ask is for a glyph button, not a responsive label.

## Final summary

- **Approach:** swap the integrations button's text label for an inline-SVG Lucide
  briefcase glyph in `index.html`, then shrink the wordmark to 26px below 360px.
- **Size:** 2 stages, both small. Two files touched, `src/public/index.html` and
  `src/public/styles.css`. No TypeScript and no build change.
- **Risks:** the glyph is less discoverable than the words, so the `aria-label` and
  `title` carry the meaning; the shared wordmark rule also shrinks the logo on
  `board.html`, which does not need it; WS-83 edits the same two places and will need a
  manual merge.
- **Needs an answer:** Q1, whether a specific release must carry this. Q2, whether
  WS-84 or WS-83 lands first.

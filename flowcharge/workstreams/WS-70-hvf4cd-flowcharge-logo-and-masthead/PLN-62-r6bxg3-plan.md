---
id: PLN-62-r6bxg3
type: plan
workstream: WS-70-hvf4cd
slug: flowcharge-logo-and-masthead
title: "Three-bar toolbar chrome, translated from the approved mockups"
status: done
created: 2026-08-28
updated: 2026-08-28
depends_on: [TL-71-leb0ht]
links: [PLN-61-7f18vq]
---

# Three-bar toolbar chrome, translated from the approved mockups

## Summary

The Dashboard still draws a tall `.masthead` band on both screens. It holds the
wordmark, a divider, an `<h1>`, a tagline, and — on the board — a right-aligned meta
block. Two hand-approved interactive mockups replace that band with a three-bar
stack on the board screen and a two-bar stack on the home screen.

This plan is a translation, not a design exercise. The two mockup files are the
specification:

- `mockups/home-toolbar-mockup.html`
- `mockups/board-toolbar-mockup.html`

Every colour, size, breakpoint, and structural choice in them is final. Their inline
comments record what was tried and rejected. The work here is to read those two files
precisely and land their markup, CSS, and asset choices in the real files, plus the
control-consistency corrections the mockups also carry.

The three bars, top to bottom:

1. `.toolbar` — 44px tall, `--toolbar-bg`, no border. Holds the wordmark on the
   left, the standalone arrow mark absolutely centred, and the theme toggle on the
   right. On the home screen only, a `Manage integrations` button sits between the
   mark and the toggle.
2. `.toolbar-crumb` — `--tile-bg`, no border. On the board it holds the back
   chevron, `Projects`, a `›` separator, and the project title. On the home screen it
   holds `Projects` and the version number.
3. `.toolbar-sub` — board screen only, on plain `--paper`. Holds the meta line
   (generated time, counts, branch, live status) and the version number. It wraps at
   narrow widths instead of vanishing.

This plan depends on `TL-71-leb0ht` (the WS-71 palette and theme-toggle work) landing
first. That task list creates the theme mechanism, the `#theme-seg` control, and the
two-palette-block structure this plan writes its new tokens into.

## Source-of-truth notes

The mockups were read with their base64 image payloads stripped, then verified byte
for byte against files on disk:

- The mockups' `img.tb-wordmark` payload is 92,122 bytes, 770×124, and is
  byte-identical to `src/public/img/flowcharge-wordmark-2.png`. This confirms
  Context point 11.
- The mockups' `img.tb-mark` payload is 493,636 bytes, 1000×1000, and is
  byte-identical to `/Users/akoukoullis/Work/AK/Praxis-Website/public/flowcharge-logo.png`.
  **It does not exist anywhere in this repository.** Vendoring it is new work this
  plan owns — see Contract 5.

## Scope

### Acceptance criteria

1. `src/public/board.html` opens with `<header class="toolbar">`, then
   `<div class="toolbar-crumb">`, then `<div class="toolbar-sub">`. There is no
   `.masthead`, no `.brand-row`, no `.brand-divider`, no `.tagline`, and no
   `.back-link` anywhere on the page.
2. `src/public/index.html` opens with `<header class="toolbar">`, then
   `<div class="toolbar-crumb">`. Same absences as above. It has no `.toolbar-sub`.
3. The main toolbar is exactly 44px tall on both screens, painted `--toolbar-bg`,
   with no `border-bottom`.
4. The wordmark renders at 31px CSS height with `margin-top: 6px`, from
   `img/flowcharge-wordmark.png`, whose bytes are the second-version artwork.
5. `img.tb-mark` renders from `img/flowcharge-mark.png` at 38px height, absolutely
   centred on the toolbar's midpoint at every viewport width, and never overlaps the
   wordmark, the integrations button, or the toggle.
6. At a viewport width of 520px or less, `.tb-mark` is not rendered. Above 520px it
   is.
7. On the board, the back chevron, `Projects`, `›`, and `<h1 id="board-title">` sit
   in `.toolbar-crumb` on `--tile-bg`, drawn in `--crumb-ink`. The bar has no border.
8. On the home screen, `Projects` and `#app-version` sit in `.toolbar-crumb` on
   `--tile-bg`, drawn in `--crumb-ink`, with the version pushed to the far right and
   faded by `--version-fade`.
9. `#manage-integrations-button` sits in the home screen's **main** toolbar, styled
   as `.tb-button` — transparent background, `--toolbar-ink-faint` border,
   `--toolbar-ink-soft` text — with the theme toggle immediately to its right and
   both pushed to the far right of the bar.
10. On the board, `#gen-date`, `#meta-counts`, `#branch-line`, `#branch-name`,
    `#live-status`, and `#app-version` sit in `.toolbar-sub` on plain `--paper`, in
    `--ink-soft` and `--ink-faint`.
11. Narrowing the board window to 400px wraps `.toolbar-sub`'s meta line onto more
    rows. No part of it is hidden at any width. This is the fix for the old plan's
    behaviour, where the whole line disappeared below 880px.
12. The theme toggle in the toolbar is three icon-only buttons, 26×22px each, with
    13×13px SVG glyphs — a monitor, a sun, and a moon. Hover and the active state
    change only the background, to
    `color-mix(in srgb, var(--toolbar-bg) 90%, var(--toolbar-shade) 10%)`, plus the
    text colour to `--toolbar-ink`. No border-colour change and no font-weight
    change.
13. Eight new tokens are defined in **both** palette blocks of
    `src/public/styles.css`: `--toolbar-bg`, `--toolbar-ink`, `--toolbar-ink-soft`,
    `--toolbar-ink-faint`, `--toolbar-shade`, `--tile-bg`, `--crumb-ink`, and
    `--version-fade`, at the values in Contract 1.
14. Project tiles and board columns still paint `--paper-raised`. `--tile-bg` has
    exactly one consumer, `.toolbar-crumb`.
15. `.seg`, `.search-wrap input`, `.search-wrap svg`, `.add-form input`, and
    `.tile-action` use `--line` for their borders. `.seg button`,
    `.search-wrap input`, its placeholder, its glyph, `.add-form input`, and its
    placeholder use `--line-strong` for text and glyph colour. `.tile-action`'s text
    stays `--ink-soft`.
16. `src/public/img/flowcharge-mark.png` exists, is tracked by git, and is listed in
    `tools/copy-assets.mjs`.
17. `src/public/img/flowcharge-wordmark-2.png` no longer exists as a separate file.
18. `src/public/app.ts`, `src/public/home.ts`, and `src/public/app-version.ts` are
    **not modified by this plan at all**. Every id they read still exists, with the
    same meaning.
19. `rm -rf dist && npm run build` succeeds, and `dist/public/img/` contains
    `flowcharge-mark.png`, `flowcharge-wordmark.png`, and `flowcharge-lockup.png`.
20. No CSS rule in `src/public/styles.css` names `.masthead` or `.back-link`.

### Out of scope

- Any layout change below the header chrome. The page-scroll versus filled-pane
  question is untouched.
- The palette token *values* WS-71 owns. This plan adds eight new tokens; it changes
  no existing one. See Open question 1 for the `--line` dark-mode conflict.
- The favicon and app-icon work. Still blocked, still separate.
- `package.json`'s `productName` and the `<title>` tags in both HTML files.
- The two footers. They keep their prose and their `.footer-lockup` image. Only the
  `#app-version` element moves out of them. See Assumption A5.
- The home screen's body content and ordering. `<h1 class="home-heading">Your
  projects</h1>`, the tile grid, and the add form stay exactly as they are.

## Assumptions

Each of these is a reading this plan commits to. Each is also written up under Open
questions, so a reader can overturn it in one place.

- **A1 — the arrow mark is vendored from the sibling website repository, under the
  role-based name this repository already uses.** The mockups' embedded mark is
  byte-identical to `/Users/akoukoullis/Work/AK/Praxis-Website/public/flowcharge-logo.png`.
  Commit `4b18c13` already established the convention: `flowcharge-name.png` was
  vendored as `flowcharge-wordmark.png`, and `flowcharge-name-logo.png` as
  `flowcharge-lockup.png`. So `flowcharge-logo.png` becomes
  `src/public/img/flowcharge-mark.png`. It is copied verbatim, not trimmed or
  downscaled, so the rendered result is exactly what was approved.

- **A2 — the second-version wordmark takes over the existing filename.** The `-2`
  suffix is an artefact of the user's export workflow, not a name this repository
  should carry. `src/public/img/flowcharge-wordmark.png` is overwritten with the
  bytes of `flowcharge-wordmark-2.png`, and the `-2` file is deleted. Both files are
  770×124, so no `width`/`height` attribute changes. This is the only option that
  needs zero edits to `tools/copy-assets.mjs`'s wordmark entry, zero edits to either
  `src=` attribute, and leaves no unused asset in the tree. The old artwork stays
  recoverable from git history.

- **A3 — the WS-71 amendment lands the icon-glyph toggle markup.** PLN-60's
  Contract 5 currently specifies text-labelled `System | Light | Dark` buttons. The
  mockups specify icon-only SVG buttons. Context says PLN-60 is being amended to
  match. This plan owns the toolbar-scoped **CSS** for that control either way. It
  also carries a contingency: if, at implementation time, either HTML file still
  carries text labels, the same task replaces the three buttons' children with the
  SVGs given in Contract 3. That contingency is deterministic and self-checking, so
  no stage here rests on the amendment.

- **A4 — the version string keeps the format `app-version.ts` already writes.**
  The mockups show the literal `v0.14.2`. `src/public/app-version.ts` writes
  `'Version ' + version`. That module is out of scope, so the bar will read
  `Version 0.14.2`. The mockups' literal is placeholder content, not a format
  specification.

- **A5 — only `#app-version` leaves the footers.** The mockups show no footer at
  all, but they also show no update banner and no modals, so absence in a mockup is
  not a deletion instruction. Commit `308a9ac` deliberately added the lockup to both
  footers on 2026-08-27. PLN-61's footer deletion is part of the design this plan
  supersedes and is not carried over.

- **A6 — `.tb-mark` gets `width` and `height` attributes.** The mockups' `img.tb-mark`
  has none, while their `img.tb-wordmark` has `width="770" height="124"`. This plan
  adds `width="1000" height="1000"` to match the repository's own convention for the
  other two images. With `height` fixed in CSS and `width: auto`, the attributes
  change nothing visually and only give the browser the intrinsic aspect ratio.

- **A7 — the mockups' `@media (prefers-color-scheme: dark)` palette block is not
  ported.** The mockups carry three palette blocks because they must work as
  standalone files with a possibly-absent `data-theme`. In the real app,
  `theme-init.ts` stamps a resolved `data-theme` before the first paint, which is why
  TL-71 Phase 1 cuts the stylesheet to exactly two blocks. The eight new tokens go
  into those two blocks only.

- **A8 — the board mockup's `.seg` rule is the authoritative one.** The home mockup's
  global `.seg` still carries the pre-correction values (`--line-strong` border,
  `--ink-soft` button text). The home screen has no sort control, so that rule was
  never re-examined there. Context point 10 states the corrected values, and the
  board mockup carries them. See Contract 4, reconciliation R2.

## Design

### What each bar has to hold

| Screen | Element | Today | After |
|---|---|---|---|
| both | wordmark | `.masthead .brand-row img.wordmark`, 62px | `.toolbar img.tb-wordmark`, 31px |
| both | arrow mark | absent | `.toolbar img.tb-mark`, centred, 38px |
| both | `#theme-seg` | arrives with TL-71 | `.toolbar`, far right, icon-only |
| both | `#app-version` | `<footer class="note">` | `.toolbar-crumb` (home) / `.toolbar-sub` (board) |
| home | `#manage-integrations-button` | `.masthead`, right | `.toolbar`, far right, as `.tb-button` |
| home | `Registered projects` tagline | `.masthead .tagline` | deleted |
| home | `Projects` label | absent | `.toolbar-crumb span.tb-title` |
| board | `.back-link` | `.masthead`, above the brand row | `.toolbar-crumb a.tb-back`, with a chevron SVG |
| board | `#board-title` | `.masthead .brand-row h1` | `.toolbar-crumb h1.tb-title` |
| board | `Workstream state` tagline | `.masthead .tagline` | deleted |
| board | `#gen-date`, `#meta-counts`, `#branch-line`, `#branch-name`, `#live-status` | `.masthead .meta`, right-aligned | `.toolbar-sub .tb-meta`, wrapping |

### Contract 1 — the eight new tokens

Added to `src/public/styles.css`, inside the two palette blocks TL-71 Phase 1 leaves
behind (`:root` and `:root[data-theme="dark"]`). No existing token value changes.

| Token | Light (`:root`) | Dark (`:root[data-theme="dark"]`) |
|---|---|---|
| `--toolbar-bg` | `#A2805B` | `#10141A` |
| `--toolbar-ink` | `#FFFFFF` | `#D5E0E9` |
| `--toolbar-ink-soft` | `rgba(255,255,255,0.8)` | `#9FA8B1` |
| `--toolbar-ink-faint` | `rgba(255,255,255,0.55)` | `#8D959E` |
| `--toolbar-shade` | `#000000` | `#FFFFFF` |
| `--tile-bg` | `#B99E82` | `#171D24` |
| `--crumb-ink` | `#E9E1D5` | `#D5E0E9` |
| `--version-fade` | `0.9` | `0.75` |

Reasons the mockups record, to carry across as comments:

- `--toolbar-bg` light is the palette's bronze swatch verbatim. Dark is the original
  dashboard's page background.
- `--toolbar-shade` is the mix target for hover and active states. It is darker than
  the bar in light mode and lighter in dark mode.
- `--tile-bg` light is bronze held at H 31.3° and S 28.1%, with L raised from 49.6%
  to 61.6%. The literal +3.33-point step was tried first and read as too subtle. Dark
  is the original dashboard's raised-surface colour.
- `--crumb-ink` light is the cream `#E9E1D5`. A darker ink and plain white were both
  tried and rejected against `--tile-bg`.
- `--version-fade` differs per theme because the same fractional fade reads
  differently on a near-black bar than on a mid-lightness tan.

`--toolbar-ink-soft` and `--toolbar-ink-faint` are translucent white in light mode
and opaque greys in dark mode. That asymmetry is deliberate: it is what the mockups
carry.

### Contract 2 — the toolbar DOM, board screen

Replaces `src/public/board.html:11-27` in full.

```html
<header class="toolbar">
  <img class="tb-wordmark" src="img/flowcharge-wordmark.png" alt="FlowCharge" width="770" height="124">
  <img class="tb-mark" src="img/flowcharge-mark.png" alt="" aria-hidden="true" width="1000" height="1000">
  <div class="seg" id="theme-seg" role="group" aria-label="Theme">
    <!-- three icon buttons, Contract 3 -->
  </div>
</header>

<div class="toolbar-crumb">
  <a class="tb-back" href="/">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
    Projects
  </a>
  <span class="tb-crumb-sep" aria-hidden="true">›</span>
  <h1 class="tb-title" id="board-title">Board</h1>
</div>

<div class="toolbar-sub">
  <div class="tb-meta">
    <span class="tb-meta-item">Generated <strong id="gen-date">—</strong></span>
    <span class="tb-meta-item" id="meta-counts"></span>
    <span class="tb-meta-item" id="branch-line" hidden>Branch <strong id="branch-name"></strong></span>
    <span class="tb-meta-item" id="live-status"></span>
  </div>
  <div class="tb-version" id="app-version" hidden></div>
</div>
```

Load-bearing points:

- Every id `app.ts` writes to survives: `gen-date`, `board-title`, `meta-counts`,
  `branch-line`, `branch-name`, `live-status`. `app.ts:1213` still finds
  `#board-title` and still sets its `textContent`. `app.ts:1219-1220` still finds
  `#branch-name` and still clears `#branch-line`'s `hidden`.
- The `<br>` elements that separated the old meta lines are gone. Separation is now
  the `.tb-meta-item + .tb-meta-item::before` middot rule.
- `#branch-line` keeps its `hidden` attribute. While hidden it is `display: none`, so
  its own `::before` middot is not drawn, and no stray separator appears.
- `#meta-counts` and `#live-status` ship empty. `.tb-meta-item:empty { display: none; }`
  hides them until `app.ts` fills them, and suppresses their middots too.
- `#board-title` stays an `<h1>`, so the board keeps the document landmark heading
  that commit `3205d7b` deliberately preserved.
- `#app-version` keeps its id and its `hidden` attribute, so
  `app-version.ts:17-28` finds it and reveals it with no change to that module.
- The back link is an `<a class="tb-back" href="/">` with an inline chevron SVG. It
  replaces `<a class="back-link" href="/">← Projects</a>`; the `←` character is gone.

### Contract 3 — the toolbar DOM, home screen

Replaces `src/public/index.html:11-19` in full.

```html
<header class="toolbar">
  <img class="tb-wordmark" src="img/flowcharge-wordmark.png" alt="FlowCharge" width="770" height="124">
  <img class="tb-mark" src="img/flowcharge-mark.png" alt="" aria-hidden="true" width="1000" height="1000">
  <button type="button" id="manage-integrations-button" class="tb-button">Manage integrations</button>
  <div class="seg" id="theme-seg" role="group" aria-label="Theme">
    <!-- three icon buttons, below -->
  </div>
</header>

<div class="toolbar-crumb">
  <span class="tb-title">Projects</span>
  <div class="tb-version" id="app-version" hidden></div>
</div>
```

`#manage-integrations-button` keeps its id, so `home.ts:727` binds it unchanged. It
gains `class="tb-button"`. Because an id selector outranks a class selector, it must
also be removed from the three shared rules at `styles.css:682`, `:691`, and `:692` —
otherwise it would keep the accent-filled look. See Contract 4.

The home screen's `.toolbar-crumb` holds a `<span class="tb-title">`, not an `<h1>`.
The page's real heading, `<h1 class="home-heading">Your projects</h1>`, stays in the
body untouched.

**The theme toggle's three buttons**, identical on both pages:

```html
<button type="button" data-mode="system" aria-label="Match system theme" title="System">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
</button>
<button type="button" data-mode="light" aria-label="Light theme" title="Light">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
</button>
<button type="button" data-mode="dark" aria-label="Dark theme" title="Dark">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>
</button>
```

The `data-mode` attributes are what WS-71's `theme-toggle.ts` reads. The `aria-label`
is what carries the accessible name now that the visible text is gone. No button
carries `class="active"` in the markup; `theme-toggle.ts` sets it from storage.

### Contract 4 — the CSS

Replaces the `.masthead` block at `src/public/styles.css:141-188` and deletes the
`.back-link` block at `:521-532`. The section heading changes from
`/* ---------- Masthead ---------- */` to `/* ---------- Toolbar (app chrome) ---------- */`.

```css
/* ---------- Toolbar (app chrome) ---------- */
/* Three stacked bars, not one band. The main bar holds only fixed-width items on
   both sides, so the centred mark can be positioned absolutely and can never be
   crowded off-centre. None of the three bars carries a border: they are set apart
   by their own background colours. */
.toolbar {
  position: relative;
  display: flex; align-items: center; gap: 10px; height: 44px;
  padding: 0 clamp(10px, 2vw, 16px);
  background: var(--toolbar-bg);
}
/* 26px * 1.2 ~= 31px, plus top clearance so it no longer brushes the toolbar edge. */
.tb-wordmark { display: block; flex: none; height: 31px; width: auto; margin-top: 6px; }

/* The standalone arrow mark, centred like a badge on a car's boot. */
.tb-mark {
  position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  height: 38px; width: auto;
}
/* The badge is a flourish, not load-bearing information — the first thing to give
   up the fight for space once the toolbar gets this narrow. */
@media (max-width: 520px) { .tb-mark { display: none; } }

/* The breadcrumb row: back navigation and the title on the board, the "Projects"
   label and the version on the home screen. Sits on --tile-bg, so it uses
   --crumb-ink, not --ink and not --toolbar-ink. */
.toolbar-crumb {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  min-height: 26px; padding: 4px clamp(10px, 2vw, 16px);
  background: var(--tile-bg);
}
.tb-back {
  display: inline-flex; align-items: center; gap: 4px; flex: none;
  font-size: 12.5px; color: var(--crumb-ink); text-decoration: none;
}
.tb-back:hover { color: var(--accent); }
.tb-back:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
.tb-crumb-sep { flex: none; font-size: 12.5px; color: var(--crumb-ink); opacity: 0.7; }
/* font-family is explicit because this element is an <h1> on the board screen, and
   would otherwise inherit --font-display. */
.tb-title {
  font-family: var(--font-body);
  font-size: 13px; font-weight: 600; color: var(--crumb-ink); margin: 0;
  min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

/* The info line, board screen only. Back on normal page tones, since this bar sits
   on --paper. It wraps instead of hiding: none of it is decorative. */
.toolbar-sub {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end;
  gap: 6px 12px; min-height: 26px; padding: 4px clamp(10px, 2vw, 16px);
  background: var(--paper);
}
.tb-meta {
  display: flex; flex-wrap: wrap; align-items: baseline; row-gap: 2px;
  font-family: var(--font-mono); font-size: 11px; color: var(--ink-soft);
}
.tb-meta strong { color: var(--ink); font-weight: 600; }
.tb-meta-item:empty { display: none; }
.tb-meta-item + .tb-meta-item::before { content: "·"; color: var(--ink-faint); margin: 0 6px; }
.tb-meta #live-status { color: var(--st-done); }
.tb-meta #live-status.is-stale { color: var(--sev-high); }

.tb-version {
  flex: none; font-family: var(--font-mono); font-size: 10.5px; white-space: nowrap;
}
/* Two homes, two treatments: cream and faded on the tan crumb bar, plain faint ink
   on the --paper info bar. */
.toolbar-crumb .tb-version { margin-left: auto; color: var(--crumb-ink); opacity: var(--version-fade); }
.toolbar-sub .tb-version { color: var(--ink-faint); }

/* Home screen only. Background-only hover: a shade step off --toolbar-bg, never a
   text-weight or border-colour change, so the button's box never resizes. */
.tb-button {
  flex: none; border: 1px solid var(--toolbar-ink-faint); border-radius: 6px;
  background: transparent; color: var(--toolbar-ink-soft);
  padding: 3px 10px; font-size: 12px; cursor: pointer;
}
.tb-button:hover { background: color-mix(in srgb, var(--toolbar-bg) 90%, var(--toolbar-shade) 10%); color: var(--toolbar-ink); }
.tb-button:focus-visible { outline: 2px solid var(--toolbar-ink); outline-offset: 2px; }

/* Right-alignment: the first of the right-hand items takes the free space. On the
   board that is the toggle; on the home screen it is the integrations button, and
   the toggle then sits immediately beside it. */
.toolbar .seg { margin-left: auto; flex: none; border-radius: 5px; border-color: var(--toolbar-ink-faint); }
.toolbar .tb-button { margin-left: auto; }
.toolbar .tb-button ~ .seg { margin-left: 0; }

/* Icon-only, mirroring the sibling website's sun/moon toggle. A third glyph covers
   "system", which the website's binary toggle does not have. */
.toolbar .seg button {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 22px; padding: 0; background: transparent; color: var(--toolbar-ink-soft);
  border-right: 1px solid var(--toolbar-ink-faint);
}
.toolbar .seg button:last-child { border-right: none; }
.toolbar .seg button svg { width: 13px; height: 13px; }
.toolbar .seg button:hover { background: color-mix(in srgb, var(--toolbar-bg) 90%, var(--toolbar-shade) 10%); color: var(--toolbar-ink); }
.toolbar .seg button.active { background: color-mix(in srgb, var(--toolbar-bg) 90%, var(--toolbar-shade) 10%); color: var(--toolbar-ink); }
```

**Control-consistency edits** (Context point 10), applied in place:

| Anchor at base commit | Today | After |
|---|---|---|
| `styles.css:260` `.seg` | `border: 1px solid var(--line-strong)` | `var(--line)` |
| `styles.css:264` `.seg button` | `color: var(--ink-soft)` | `var(--line-strong)` |
| `styles.css:268` `.seg button` | `border-right: 1px solid var(--line-strong)` | `var(--line)` |
| `styles.css:301` `.search-wrap input` | `border: 1px solid var(--line-strong)` | `var(--line)` |
| `styles.css:304` `.search-wrap input` | `color: var(--ink)` | `var(--line-strong)` |
| `styles.css:298-306` `.search-wrap input` | no `::placeholder` rule | add `.search-wrap input::placeholder { color: var(--line-strong); opacity: 0.75; }` |
| `styles.css:307` `.search-wrap svg` | `opacity: 0.5` | `color: var(--line-strong); opacity: 1;` |
| `styles.css:675` `.add-form input` | `border: 1px solid var(--line-strong)` | `var(--line)` |
| `styles.css:678` `.add-form input` | `color: var(--ink)` | `var(--line-strong)` |
| `styles.css:679` `.add-form input` | `font-family: var(--font-mono)` | declaration deleted — the field inherits the body sans face |
| `styles.css:668-681` `.add-form input` | no `::placeholder` rule | add `.add-form input::placeholder { color: var(--line-strong); opacity: 0.75; }` |
| `styles.css:586` `.tile-action` | `border: 1px solid var(--line-strong)` | `var(--line)` |
| `styles.css:682, 691, 692` | selector lists include `#manage-integrations-button` | that one selector removed from each of the three lists |

`.tile-action`'s `color: var(--ink-soft)` at `:589` is left alone. It is already
legible; only the border was inconsistent with the tile it sits on.

The `font-family` deletion on `.add-form input` is deliberate, not a side effect of
the colour edits. The mockup's rule carries no `font-family` property at all, so the
field falls back to the body's default sans face. That treatment was ported from the
board's filter field, which never had a mono override either. After all four edits the
rule reads exactly as the mockup does:

```css
.add-form input {
  flex: 1; min-width: 240px; max-width: 520px; padding: 6px 10px; border: 1px solid var(--line);
  border-radius: 6px; background: var(--paper-raised); color: var(--line-strong); font-size: 12.5px;
}
```

Not touched, because Context point 10 does not name them: `.filter-chips button`
(`:285`), `.tile-edit input` (`:621`), and `.tiles-empty` (`:660`) all keep their
`--line-strong` borders.

The `.seg` change is global by design. It reaches `#sort-key-seg`, `#sort-dir-seg`,
`#integrations-scope-seg`, and `#theme-seg`. The board mockup's `.seg` rule is the
shared rule, and its comment says exactly that: standardise on the border tone the
cards, columns, KPI strip, and panels already use.

One comment fix: the update-banner comment block at `styles.css:1108-1115` says the
banner sits "directly under the masthead" and "carries the masthead's own bottom
border". After this change there is no `.masthead` and the bars have no bottom
border. Rewrite those two sentences to name `.toolbar-crumb` and `.toolbar-sub`, and
to say the banner's own bottom border is now its own. No declaration changes.

### Contract 5 — the assets

Three changes under `src/public/img/`:

1. Copy `/Users/akoukoullis/Work/AK/Praxis-Website/public/flowcharge-logo.png` to
   `src/public/img/flowcharge-mark.png`, verbatim. Verify with `shasum -a 256` that
   the two files match, and that the result is 493,636 bytes.
2. Overwrite `src/public/img/flowcharge-wordmark.png` with the bytes of
   `src/public/img/flowcharge-wordmark-2.png`, then delete the `-2` file. Verify the
   result is 92,122 bytes and 770×124.
3. `git add` both results. `flowcharge-wordmark-2.png` is currently untracked, so it
   never entered history under that name.

`tools/copy-assets.mjs:16-23` gains one entry, `'img/flowcharge-mark.png'`, beside
the two already there. The wordmark entry needs no change, because A2 keeps the
filename. `fs.copyFileSync` throws on a missing source, so the asset copy and the
list entry belong in the same commit.

`src/public/img/flowcharge-lockup-2.png` is also on disk and untracked. It is not
referenced by either mockup and this plan does not touch it.

### Reconciling the two mockups

The two files are near-duplicates of one shared stylesheet, and they disagree in
five places. Each disagreement is resolved here, once, so the implementer does not
have to re-derive it.

- **R1 — `margin-left: auto`.** The board mockup puts it on `.toolbar .seg`; the
  home mockup puts it on `.tb-button` and leaves `.toolbar .seg` without it. Merging
  both verbatim would give the home screen two auto margins, which split the free
  space evenly and push the integrations button toward the middle. Resolution: keep
  `.toolbar .seg { margin-left: auto; }` as the base, add
  `.toolbar .tb-button { margin-left: auto; }`, and neutralise the second with
  `.toolbar .tb-button ~ .seg { margin-left: 0; }`. Both screens then render exactly
  as their own mockup does.

- **R2 — the global `.seg`.** The board mockup has the corrected values; the home
  mockup has the pre-correction ones. The board mockup wins, per Assumption A8 and
  Context point 10.

- **R3 — `.tb-version`.** The home mockup's version sits on `--tile-bg` in
  `--crumb-ink`, faded by `--version-fade`, pushed right by `margin-left: auto`. The
  board mockup's sits on `--paper` in `--ink-faint`, unfaded, with no auto margin.
  Resolution: one base rule plus two context-scoped overrides, as written in
  Contract 4. `--version-fade` is defined in both palette blocks even though only the
  home screen consumes it, because it needs a value per theme.

- **R4 — the palette blocks.** Assumption A7. Two blocks, not three.

- **R5 — a stale comment.** The board mockup's comment above `.tb-back` argues for
  `--accent-ink` and quotes contrast ratios for it, but the declaration below it says
  `var(--crumb-ink)`. The declaration is what was approved. The comment is a leftover
  from an earlier round and is not carried across.

### Module boundaries

- `src/public/styles.css` stays the one hand-maintained stylesheet. No second file,
  no build step for CSS.
- `src/public/app.ts`, `src/public/home.ts`, and `src/public/app-version.ts` know
  exactly the ids they know today, and are not opened by this plan.
- `tools/copy-assets.mjs` stays a list-driven copier that knows filenames and nothing
  else.
- The theme mechanism stays entirely WS-71's. This plan writes no TypeScript.

### Non-functional notes

- `flowcharge-mark.png` is 482 KB for a 38px render. The two already-vendored assets
  are 20 KB and 16 KB because they were trimmed before vendoring. Vendoring this one
  verbatim guarantees the rendered result is byte-for-byte what was approved. See
  Open question 5 for the deferred size question; it changes nothing about how the
  page is built.
- `color-mix(in srgb, ...)` is used in four places. Electron's bundled Chromium and
  every current browser support it. There is no fallback declaration, matching the
  mockups.
- The workstream record warns that the arrow mark "reads faint/dirty on the light
  theme". That warning was about the mark on the near-white `--paper` of the old
  palette. In the mockups it sits on the bronze `--toolbar-bg`, and it was approved
  there. Confirm by eye in Phase 1 rather than assuming.

## Staged task breakdown

### Phase 1 — Assets, tokens, and the board screen's three bars (large)

The riskiest slice, and a complete vertical one: after it, the board screen can be
opened and judged in both themes.

1. Vendor `flowcharge-mark.png` and swap the wordmark bytes, per Contract 5. Add the
   `img/flowcharge-mark.png` entry to `tools/copy-assets.mjs`.
2. Add the eight tokens of Contract 1 to both palette blocks in
   `src/public/styles.css`, with the reason comments.
3. Replace `styles.css:141-188` with Contract 4's toolbar block. Do not yet delete
   `.back-link`; the home screen still uses `.masthead` at this point, and both old
   rule sets are harmless while only one page has moved.
4. Replace `board.html:11-27` with Contract 2.
5. If `board.html`'s `#theme-seg` carries text-label buttons rather than the SVG
   icons, replace the three buttons' children with Contract 3's SVGs (Assumption A3).

Files: `src/public/img/flowcharge-mark.png` (new),
`src/public/img/flowcharge-wordmark.png`, `src/public/img/flowcharge-wordmark-2.png`
(deleted), `tools/copy-assets.mjs`, `src/public/styles.css`, `src/public/board.html`.
Depends on: `TL-71-leb0ht`.

Stop-and-raise condition: if the arrow mark reads as noise or dirt on the bronze bar
in light mode, stop and raise Open question 4. Do not add a CSS filter, and do not
substitute the lockup — the workstream record rules both out.

### Phase 2 — The home screen's two bars (medium)

1. Replace `index.html:11-19` with Contract 3.
2. Remove `#manage-integrations-button` from the three shared selector lists at
   `styles.css:682`, `:691`, and `:692`.
3. Same icon-markup contingency as Phase 1, step 5.
4. Confirm the home screen's body is untouched: `<h1 class="home-heading">Your
   projects</h1>`, the tile grid, and the add form are exactly as they were.

Files: `src/public/index.html`, `src/public/styles.css`. Depends on: Phase 1.

### Phase 3 — Retire the dead rules and move the version (small)

1. Delete the `.back-link` block at `styles.css:521-532`. Both pages have stopped
   using it.
2. Confirm no `.masthead` selector remains anywhere in `styles.css`.
3. Move `<div id="app-version" hidden></div>` out of `<footer class="note">` on both
   pages, into the position Contracts 2 and 3 give it, with `class="tb-version"`
   added. The footers keep their prose and their `.footer-lockup` image.
4. Rewrite the two stale sentences in the update-banner comment at
   `styles.css:1108-1115`.

Files: `src/public/styles.css`, `src/public/index.html`, `src/public/board.html`.
Depends on: Phase 2.

Note: if the `#app-version` move is folded into Phases 1 and 2 instead — which is
tidier, since it is one element per page — this phase reduces to steps 1, 2, and 4.
Either ordering is acceptable; the acceptance criteria do not distinguish them.

### Phase 4 — Interactive-control border and text consistency (small)

Apply the thirteen edits in Contract 4's second table, minus the three
`#manage-integrations-button` selector removals already done in Phase 2.

Read each anchor fresh. `TL-71-leb0ht` Phase 1 deletes 66 lines above these, and its
Phase 4 edits lines 272 and 294 in the same neighbourhood, so locate every edit by
its selector and never by line number.

Files: `src/public/styles.css`. Depends on: Phase 3.

### Phase 5 — Build, narrow-width, and package check (small)

1. `rm -rf dist && npm run build`. It must succeed, and `dist/public/img/` must hold
   all three PNGs.
2. `npm start`, then open both screens in all three theme modes.
3. Narrow each window to 400px and confirm criteria 6 and 11.
4. `npm run electron:dev` and confirm both screens in the packaged shell.

Files: none. Depends on: Phase 4.

## Data & compatibility

There is no data model here and no persisted state this plan owns. The only
compatibility surface is the set of DOM ids the compiled scripts read.

**Ids that must survive, and who reads them:**

| Id | Reader | New home |
|---|---|---|
| `board-title` | `app.ts:1213` | `.toolbar-crumb h1.tb-title` |
| `gen-date` | `app.ts:1212` | `.toolbar-sub .tb-meta` |
| `meta-counts` | `app.ts:1216` | `.toolbar-sub .tb-meta` |
| `branch-line` | `app.ts:1220` | `.toolbar-sub .tb-meta` |
| `branch-name` | `app.ts:1219` | `.toolbar-sub .tb-meta` |
| `live-status` | `app.ts:1127` | `.toolbar-sub .tb-meta` |
| `manage-integrations-button` | `home.ts:727` | `.toolbar` |
| `app-version` | `app-version.ts:17` | `.toolbar-crumb` / `.toolbar-sub` |
| `theme-seg` | WS-71's `theme-toggle.ts` | `.toolbar` |

`app.ts` uses a `byId()` helper that throws or returns null on a missing element, so
a dropped id fails loudly on the board. `app-version.ts` fails **silently** by
design: a missing `#app-version` leaves no error and no console line, so criterion 8
and criterion 10 must be checked by eye.

`#live-status` changes colour from `--ink-faint` to `--st-done` in its live state,
per the board mockup. Its `.is-stale` state keeps `--sev-high`; the mockup has no
stale state, so that rule is carried forward unchanged.

No stored value, no server route, and no API payload changes.

## Testing strategy

There are no automated tests for the page chrome, and none are added: this repository
tests `src/lib/` and has no DOM test harness. Verification is a build check plus a
scripted manual pass.

**Mechanical checks:**

- `grep -c 'masthead' src/public/styles.css src/public/index.html src/public/board.html`
  returns 0 for all three.
- `grep -c 'back-link' src/public/styles.css src/public/board.html` returns 0 for
  both.
- `grep -c -- '--toolbar-bg' src/public/styles.css` returns at least 6 — two
  definitions plus the four `color-mix` uses and the `.toolbar` background.
- `grep -c -- '--tile-bg' src/public/styles.css` returns 3 — one definition per
  block plus `.toolbar-crumb`.
- `grep -o 'id="[a-z-]*"' src/public/board.html | sort > after.txt`, compared against
  the same list at the base commit, differs by no removals.
- `shasum -a 256 src/public/img/flowcharge-mark.png` matches
  `/Users/akoukoullis/Work/AK/Praxis-Website/public/flowcharge-logo.png`.
- `wc -c src/public/img/flowcharge-wordmark.png` returns 92122.
- `rm -rf dist && npm run build` succeeds; `ls dist/public/img/` shows three PNGs.

**Manual pass, on both screens and in all three theme modes:**

1. The main bar is one flat 44px band with no hairline under it. The crumb bar below
   is a different, lighter tone with no hairline under it either.
2. The wordmark clears the bar's top edge and does not touch it.
3. The arrow mark is centred on the window, not on the space between the wordmark and
   the toggle. Resize the window slowly and confirm it stays centred and never
   touches either neighbour.
4. Cross 520px and confirm the mark disappears, then reappears.
5. Hover each toggle button and the integrations button. Only the background changes.
   Nothing shifts by a pixel and no border brightens.
6. Click each of the three toggle buttons and confirm the whole page repaints, both
   bars included, with no reload.
7. On the board, narrow to 400px and confirm the meta line wraps to two or three rows
   and that the branch, counts, generated time, live status, and version are all
   still on screen.
8. On the board, confirm the crumb bar's chevron and `Projects` navigate home, and
   that the project name in the `<h1>` is the folder name, not the word `Board`.
9. On the home screen, confirm `Manage integrations` opens the modal, and that it
   sits immediately left of the toggle with no gap between the two groups.
10. Read the filter field's placeholder, the sort control's labels, the add-project
    field's placeholder, and the tile action glyphs in both themes. All must be
    legible, and every border must match the card or column beside it.

## Open questions

1. **`--line`'s dark-mode value conflicts, and is unresolved.** The mockups use
   `#3B3F46`, derived by mixing a light swatch toward the background and then reduced
   25% after review. `PLN-60-f7jh0n` line 282 and `TL-71-leb0ht` Phase 4 both still
   specify `#2F3440`. Neither has been amended: `PLN-60-f7jh0n`'s `updated` field
   still reads 2026-08-28 and its Contract 7 dark table is unchanged. WS-71 owns this
   token, so **this plan does not touch it** and no stage here depends on the answer.
   The only consequence of leaving `#2F3440` is that the dark-mode borders on cards,
   columns, and panels read fainter than the mockups show. *A user needs to confirm
   `#3B3F46` into WS-71 before that workstream's Phase 4 lands, or accept the fainter
   borders.*

2. **The toggle's markup depends on a WS-71 amendment that is not confirmed.**
   `PLN-60-f7jh0n` Contract 5 still specifies text-labelled buttons. Assumption A3
   carries a deterministic contingency, so nothing here is blocked. But the cleaner
   outcome is that WS-71 lands the icon markup and this plan lands only the CSS. *A
   user should confirm which workstream owns the button children, so the two do not
   both edit them.*

3. **The version string reads `Version 0.14.2`, not `v0.14.2`.** Assumption A4 keeps
   `app-version.ts` untouched. Changing it to the mockups' shorter form is one line
   in that module. *Is the mockups' `v` prefix a requirement, or placeholder text?*

4. **The arrow mark on the bronze bar in light mode has not been seen in the real
   app.** The mockups were approved, so this is expected to pass, but the workstream
   record's warning about the mark reading "faint/dirty" was written about a
   different background. Phase 1 gates on it. *If it fails, the fix is a separate
   light-mode export, not a CSS filter — the workstream record rules filters out
   explicitly.*

5. **Should `flowcharge-mark.png` be downscaled before vendoring?** It is 482 KB of
   1000×1000 artwork rendered at 38px. Vendoring verbatim is what this plan does,
   because it guarantees the approved result. A 152×152 export would be roughly 2%
   of the size at 2× density with no visible difference. *Worth doing as a later,
   separate pass?*

6. **The two mockup files themselves are untracked.** `mockups/` shows as `??` in
   `git status`. They are the specification for this work and the record of many
   rounds of feedback. *Should they be committed, and if so, do they belong under
   `mockups/` or inside this workstream folder?* This plan does not move or commit
   them.

## Alternatives considered and rejected

- **Port each mockup's `<style>` block wholesale into `styles.css`.** Rejected. The
  mockups carry the full WS-71 palette, three palette blocks instead of two, and a
  `--font-display: var(--font-body)` override that Context never asks for and that
  would repaint every heading, tile name, and panel title in the app. A wholesale
  port would silently take ownership of tokens WS-71 owns and would make Open
  question 1 impossible to answer cleanly. Selective translation keeps the boundary
  between the two workstreams intact.

- **Extract the toolbar chrome into a second stylesheet, `toolbar.css`.** Rejected.
  There is exactly one consumer of these rules and no reuse to gain. It would add a
  second stylesheet request on both pages, a second entry in
  `tools/copy-assets.mjs`, and a second file to keep in sync with the palette — cost
  with no benefit. `styles.css` is a single hand-maintained file by convention.

- **Keep the mockups' three palette blocks verbatim, for safety.** Rejected. The
  `@media (prefers-color-scheme: dark)` block only matters when `data-theme` is
  absent, and `theme-init.ts` guarantees it is present before the first paint. A
  third block would be dead code that has to be kept in sync with two live ones, and
  it directly contradicts `TL-71-leb0ht` Phase 1, which cuts the file to two.

- **Reference the new artwork as `img/flowcharge-wordmark-2.png` under its own
  name.** Rejected in favour of A2. It would need an edit to `tools/copy-assets.mjs`,
  edits to both `src=` attributes, and would leave a superseded 20 KB asset in the
  tree and in the packaged app. The `-2` suffix is export-workflow bookkeeping, not a
  name the codebase should carry.

- **Do the home screen first, as the smaller slice.** Rejected. The board screen
  carries eight of the nine load-bearing ids, the third bar, and the wrapping meta
  line. Doing it first surfaces the real risks — the centred mark's positioning, the
  meta line's middot separators against `hidden` and `:empty` items, and the
  `<h1>`-inheriting-`--font-display` trap — while there is still nothing built on top
  of them.

- **Delete both footers, as `PLN-61-7f18vq` Phase 3 does.** Rejected. That plan's
  design is superseded, commit `308a9ac` deliberately added the lockup to both
  footers afterwards, and Context's out-of-scope list keeps everything below the
  header chrome untouched. Only `#app-version` moves.

- **Reorder the home screen's body to match the mockup** (add form above the tiles,
  no `Your projects` heading). Rejected. That is a layout change below the header
  chrome, which Context puts out of scope. The mockups' bodies are scaffolding for
  showing the chrome, not a body specification — they also omit the update banner and
  both modals.

## Final summary

Two hand-approved mockups replace one 100px masthead band with a three-bar stack:
a 44px bronze toolbar holding the wordmark, a centred arrow mark, and an icon-only
theme toggle; a tan breadcrumb bar; and, on the board only, a plain info bar that
wraps rather than disappears. The work is translation, in four small stages plus one
verification stage, touching six files and no TypeScript.

Three things make it more than a copy-paste. First, the arrow mark is a brand-new
asset that exists nowhere in this repository — it has to be vendored from the sibling
website repo, where it is byte-identical to what the mockups embed. Second, the two
mockups disagree in five places, and each disagreement has a right answer that is
recorded here rather than left for the implementer to re-derive; the `margin-left:
auto` collision on the home screen is a real defect that a naive merge would ship.
Third, this plan deliberately does **not** touch `--line`, because WS-71 owns it and
the two workstreams currently specify different dark-mode values — that conflict is
Open question 1, and a user has to settle it.

One earlier open question is now closed. `.add-form input` does lose its
`font-family: var(--font-mono)`. That was confirmed directly from the mockup file
`mockups/home-toolbar-mockup.html`, lines 237-240, which carries no `font-family`
property at all. It was not inferred.

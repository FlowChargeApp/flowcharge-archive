---
id: PLN-61-7f18vq
type: plan
workstream: WS-70-hvf4cd
slug: flowcharge-logo-and-masthead
title: "Replace the masthead band with a compact app toolbar carrying the back navigation"
status: dropped
created: 2026-08-28
updated: 2026-08-28
depends_on: [TL-71-leb0ht]
links: [PLN-62-r6bxg3]
notes: "Superseded by PLN-62-r6bxg3. Its single-toolbar design (no centred badge, no separate breadcrumb/info bars, 36px wordmark) was replaced through live mockup iteration in mockups/home-toolbar-mockup.html and mockups/board-toolbar-mockup.html before any of this plan's tasks executed."
---

# Compact app toolbar, replacing the masthead band

## Summary

WS-70 shipped a 62px FlowCharge wordmark inside a bordered masthead band, plus a combo-lockup
footer on both screens. The user rejected the result after merge: it reads as a website banner,
not desktop-app chrome. A `cl-opus-high` review gave the diagnosis and the direction, and the
user approved it.

This plan replaces that header with a **single compact toolbar, 36px tall, shared in shape by
both screens**. The toolbar carries a small wordmark (26px), a breadcrumb that holds the "back to
projects" navigation as a chevron link, the board's condensed meta line, the WS-71 theme toggle,
and the home screen's "Manage integrations" button. Both `<footer class="note">` blocks are
deleted, along with the combo lockup image they hold. The `Fraunces` display serif leaves the
header entirely.

The chosen approach is **one shared `.toolbar` CSS block plus per-screen slot markup**, replacing
the `.masthead` block outright. It keeps every existing DOM id, so **no TypeScript file is edited
by this plan at all** — `src/public/app.ts`, `home.ts` and `app-version.ts` keep working
unchanged. That is the design's main safety property and its main sequencing benefit.

Three reconnaissance facts drive the work, and none of them appear in the workstream record:

1. **`<div id="app-version" hidden>` lives inside `<footer class="note">` on both pages**
   (`src/public/index.html:50`, `src/public/board.html:96`). `src/public/app-version.ts:17`
   queries it by id. Deleting the footers without relocating that element silently kills the
   version display shipped by WS-58.
2. **The board's `.meta` block is four lines tall** (`src/public/board.html:21-26`) and holds four
   live ids that `app.ts` writes on every poll. A 36px bar cannot hold four lines, so the meta has
   to become one condensed inline row — with every id preserved, or `app.ts` breaks.
3. **`.back-link` is defined under the `/* ---------- Home page ---------- */` comment**
   (`src/public/styles.css:521-532`) although only `board.html` uses it. Moving the back
   navigation into the toolbar retires that rule and its misplacement together.

## Scope

### Acceptance criteria

**The toolbar, both screens**

1. `<header class="toolbar">` is the first element in `<body>` on both pages, and neither page
   contains `class="masthead"` any more.
2. The toolbar's rendered height is 36px on both screens, measured in devtools with the toolbar's
   content loaded, and it does not grow when the board's meta line is populated.
3. Both toolbars open with the same left group in the same order: the wordmark image, a 1px
   vertical rule, then breadcrumb text.
4. The wordmark renders at a CSS height of 26px with `width: auto`, from the same
   `src/public/img/flowcharge-wordmark.png` already on disk (770 × 124). No CSS `filter` is
   applied to it in any theme.
5. No element inside the toolbar uses `var(--font-display)`. The toolbar title is the body sans
   face; the meta and version lines are the mono face.
6. The toolbar has no centred content column and no `max-width` — it spans the full window width.
7. The WS-71 `.seg#theme-seg` control sits in the toolbar's right group on both screens, renders
   at most 24px tall, and its three buttons still switch theme with one click.
8. The board's toolbar and the home toolbar are visually consistent: same height, same padding,
   same brand slot, same right-group gap.

**Board screen**

9. The back navigation is inside the toolbar as a single `<a class="tb-back" href="/">` carrying a
   chevron glyph and the word `Projects`. No back link appears anywhere outside the toolbar.
10. The breadcrumb reads: wordmark │ ‹ Projects › project-name, with the project name in
    `<h1 id="board-title" class="tb-title">`.
11. The project name truncates with an ellipsis rather than wrapping or pushing the right group
    off screen, when the folder name is long.
12. The four meta fields render as one inline row separated by `·`: generated date, counts, branch
    (when present), live status. The elements `#gen-date`, `#meta-counts`, `#branch-line`,
    `#branch-name` and `#live-status` all still exist with those exact ids.
13. `#live-status.is-stale` still renders in `var(--sev-high)`.
14. `#branch-line` still starts hidden and is revealed by `app.ts` when `raw.branch` is present,
    with no stray separator left behind when it is absent.
15. The page still contains exactly one `<h1>`.

**Home screen**

16. The toolbar reads wordmark │ `Projects`, then a right group holding the version, the
    `#manage-integrations-button`, and the theme control.
17. `#manage-integrations-button` keeps that exact id and still opens the integrations dialog.
18. The page still contains exactly one `<h1>`, and it is `<h1 class="home-heading">Your
    projects</h1>` in the body.

**Footer removal**

19. Neither `index.html` nor `board.html` contains a `<footer>` element.
20. `src/public/img/flowcharge-lockup.png` is deleted from the repository, its entry is removed
    from `tools/copy-assets.mjs`, and a clean `rm -rf dist && npm run build` succeeds with no
    missing-file error.
21. `<div id="app-version" hidden>` exists on both pages inside the toolbar, and the running
    version still appears there in the packaged or Electron-run app.
22. The `footer.note`, `footer.note code` and `footer.note .footer-lockup` rules are gone from
    `src/public/styles.css`.

**Narrow width**

23. At 880px and below, the board toolbar hides the generated date, the counts, the branch and the
    version, keeps `#live-status` visible with no leading separator, and still fits on one 36px
    row.
24. At every width from 640px to 2560px, neither page scrolls horizontally because of the toolbar.

**Build**

25. `npm run build` and `npm run build:release` both succeed, and `build:release` still passes the
    eval guard and the source-map guard in `tools/bundle-public.mjs`.
26. No file under `src/public/*.ts`, `electron/` or `src/lib/` is modified by this plan.
27. No entry is added to `dependencies` or `devDependencies`.

### Out of scope

- Any layout change below the toolbar. The page-scroll versus filled-panes question is the
  broader concern the user deferred.
- The board's status and severity colours, and the colour tokens themselves. WS-71 owns those.
- `Fraunces` outside the header — `.panel h2`, `.home-heading`, `.kpi .kpi-value`,
  `.load-state h2`, `.tiles-empty h3`, `.ws-modal-title` and the other `var(--font-display)`
  consumers keep it. See Open question 4. The `@font-face` rule and
  `src/public/fonts/fraunces-latin.woff2` therefore stay.
- The favicon and app-icon work. WS-70's Phase 5 stays blocked and untouched.
- `package.json`'s `productName` and the `<title>` element on either page.
- `src/server.ts`, `electron/`, and every TypeScript file in `src/public/`.
- The `.seg`, `.seg button` and `.filter-chips` rules as they apply outside the toolbar. The
  board's sort and filter controls are below the header and keep their current size.
- Native window-titlebar integration. See Alternatives.

### Assumptions

Context left each of these open. Each is the most reasonable reading, not a confirmed decision.
Every one is also written up under Open questions.

- **A1 — 36px toolbar, 26px wordmark.** The direction says "roughly 32-40px tall" with "a small
  brand mark (around 16px)". 36px is the middle of that band. **26px is the user's own decision,
  not a derived number.** The plan first sized the wordmark at 18px, half the bar height, on a
  proportional argument. The user asked instead to keep the wordmark near its old 62px size and
  shrink it only at narrow widths; that was declined here, because a 62px brand forces the bar
  back to banner height and re-creates the exact problem this workstream exists to fix. 26px is
  the accepted compromise: clearly larger and more legible than 18px, still small enough that the
  bar stays desktop chrome. At 26px the 770 × 124 raster is downscaled about 4.8×, so resolution
  is not the risk. The risk is aesthetic, and Phase 1 carries a visual gate for it.
- **A1a — 36px is kept, not widened.** A 26px wordmark in a 36px bar leaves 5px of clearance above
  and below it. That is normal for a compact toolbar, and the wordmark is now the tallest item in
  the bar — the theme control is at most 24px and `.tb-button` renders near 25px — so nothing else
  sets a higher floor. 36px therefore stands. If the Phase 1 visual gate finds the wordmark
  cramped against the bar's edges, raise the bar to 38px, which is still inside the direction's
  32-40px band. Do not shrink the wordmark back below 26px to buy clearance.
- **A2 — the taglines are deleted.** `<div class="tagline">Registered projects</div>` and
  `<div class="tagline">Workstream state</div>` are decorative subtitle lines with no consumer in
  any script. A 36px single-row bar has no place for them, and a subtitle under a brand is itself
  a website tell.
- **A3 — the board's meta stays in the toolbar, condensed.** Moving it to a status strip below the
  toolbar would be below-header layout work, which is out of scope. Condensing it to one inline
  row keeps every id, so `app.ts` is untouched.
- **A4 — `#app-version` moves into the toolbar.** It is the only element inside the footers that
  a script consumes. Keeping the id and the `hidden` attribute means `app-version.ts` needs no
  change.
- **A5 — the home toolbar shows a `Projects` crumb.** It gives the two screens the same left
  group and makes the board's `‹ Projects ›` read as a real breadcrumb root, at the cost of mild
  repetition against the body's "Your projects" heading.
- **A6 — the toolbar sits on `var(--paper-raised)`.** A chrome bar that is a distinct surface from
  the page reads as a toolbar; a bar separated only by a hairline reads as a banner. Both tokens
  are defined in both of WS-71's theme blocks, so this adds no media query and no new token.
- **A7 — deployment and release constraints.** This is a private, locally-run Electron app with no
  server deployment, no live users and no production data. Every change here is presentational.
  No feature flag, no dark launch, no migration. The app runs at the end of every phase, and
  rollback is `git revert` of that phase's commit.
- **A8 — WS-71 has landed first.** `depends_on: [TL-71-leb0ht]`. At implementation time
  `src/public/styles.css` carries two palette blocks, not four; `theme-init.js` is in both
  `<head>` blocks; and the `.seg#theme-seg` markup is already the last child of both
  `<header class="masthead">` elements. **Every line number in this plan is from the pre-WS-71
  tree and will have shifted** — WS-71 deletes roughly 53 lines near the top of the stylesheet.
  Anchor every edit on the selector or the markup, never on the line number.

## Design

### What the toolbar has to hold

Inventory taken from the live files, plus what WS-71 adds:

| Screen | Element | Fate |
|---|---|---|
| both | `.wordmark` img, 62px | kept, resized to 26px |
| both | `.brand-divider` span | kept, renamed `.tb-rule`, 16px |
| both | `.tagline` div | deleted (A2) |
| both | `.seg#theme-seg` (from WS-71) | kept, restyled compact inside the toolbar |
| both | `#app-version` (currently in the footer) | relocated into the toolbar (A4) |
| home | `#manage-integrations-button` | kept, restyled as `.tb-button` |
| board | `.back-link` (`board.html:13`) | replaced by `.tb-back` inside the breadcrumb |
| board | `h1#board-title`, 30px Fraunces | kept, restyled to 13px body sans |
| board | `.meta` block, 4 lines | condensed to one row, all ids kept (A3) |

### Contract 1 — the toolbar DOM, board screen

`src/public/board.html:11-27` becomes:

```html
<header class="toolbar">
  <img class="tb-wordmark" src="img/flowcharge-wordmark.png" alt="FlowCharge"
       width="770" height="124">
  <span class="tb-rule" aria-hidden="true"></span>
  <a class="tb-back" href="/">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2.4" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
    Projects
  </a>
  <span class="tb-crumb-sep" aria-hidden="true">›</span>
  <h1 id="board-title" class="tb-title">Board</h1>
  <div class="tb-right">
    <div class="tb-meta">
      <span class="tb-meta-item">Generated <strong id="gen-date">—</strong></span>
      <span class="tb-meta-item" id="meta-counts"></span>
      <span class="tb-meta-item" id="branch-line" hidden>Branch <strong id="branch-name"></strong></span>
      <span class="tb-meta-item" id="live-status"></span>
    </div>
    <div id="app-version" class="tb-version" hidden></div>
    <div class="seg" id="theme-seg" role="group" aria-label="Theme">…WS-71's three buttons…</div>
  </div>
</header>
```

Notes that are load-bearing:

- The inline chevron `<svg>` copies the attribute style of the search icon already in this file
  (`src/public/board.html:57`) — `fill="none" stroke="currentColor" stroke-width="2.4"`. It is
  markup, not script, so the `script-src 'self'` CSP is not involved.
- `<h1 id="board-title">` keeps its id and its `Board` fallback text, so
  `src/public/app.ts:1213-1215` continues to work with no edit and the document always has a
  non-empty heading.
- The four meta ids are preserved exactly. `app.ts:1212`, `:1216`, `:1219`, `:1220` and the
  `setLiveStatus` helper at `:1126-1135` are all untouched.
- The `<br>` elements that separated the meta lines are dropped; the separators are drawn in CSS
  (Contract 3), so no script writes them and no empty field leaves a dangling `·`.
- `#app-version` arrives here in Phase 3, not Phase 1.

### Contract 2 — the toolbar DOM, home screen

`src/public/index.html:11-19` becomes:

```html
<header class="toolbar">
  <img class="tb-wordmark" src="img/flowcharge-wordmark.png" alt="FlowCharge"
       width="770" height="124">
  <span class="tb-rule" aria-hidden="true"></span>
  <span class="tb-title">Projects</span>
  <div class="tb-right">
    <div id="app-version" class="tb-version" hidden></div>
    <button type="button" id="manage-integrations-button" class="tb-button">Manage integrations</button>
    <div class="seg" id="theme-seg" role="group" aria-label="Theme">…WS-71's three buttons…</div>
  </div>
</header>
```

The home crumb is a `<span class="tb-title">`, not a heading — the page's single `<h1>` stays
`<h1 class="home-heading">Your projects</h1>` at `src/public/index.html:32`. Same class, same
rendering, different element: the toolbar carries no page heading on this screen, exactly as
WS-70 decided.

`#manage-integrations-button` keeps its id, so `src/public/home.ts:727` needs no edit. Its label
text is unchanged.

### Contract 3 — the CSS

The whole `/* ---------- Masthead ---------- */` block (`src/public/styles.css:141-188`
pre-WS-71) is replaced by a `/* ---------- Toolbar (app chrome) ---------- */` block:

```css
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 clamp(10px, 2vw, 16px);
  background: var(--paper-raised);
  border-bottom: 1px solid var(--line);
}
.tb-wordmark { display: block; flex: none; height: 26px; width: auto; }
.tb-rule { flex: none; width: 1px; height: 16px; background: var(--line-strong); }

.tb-back {
  display: inline-flex; align-items: center; gap: 4px; flex: none;
  font-size: 12.5px; color: var(--ink-soft); text-decoration: none;
}
.tb-back:hover { color: var(--accent); }
.tb-back:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 4px; }
.tb-crumb-sep { flex: none; font-size: 12.5px; color: var(--ink-faint); }

/* Deliberately var(--font-body), not var(--font-display): no display serif in the chrome. */
.tb-title {
  font-family: var(--font-body);
  font-size: 13px; font-weight: 600; color: var(--ink); margin: 0;
  min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.tb-right { margin-left: auto; display: flex; align-items: center; gap: 12px; min-width: 0; }

.tb-meta {
  display: flex; align-items: baseline; min-width: 0;
  font-family: var(--font-mono); font-size: 11px; color: var(--ink-soft);
  white-space: nowrap; overflow: hidden;
}
.tb-meta strong { color: var(--ink); font-weight: 600; }
.tb-meta-item:empty { display: none; }
.tb-meta-item + .tb-meta-item::before { content: "·"; color: var(--ink-faint); margin: 0 6px; }
.tb-meta #live-status { color: var(--ink-faint); }
.tb-meta #live-status.is-stale { color: var(--sev-high); }

.tb-version {
  flex: none; font-family: var(--font-mono); font-size: 10.5px;
  color: var(--ink-faint); white-space: nowrap;
}

.tb-button {
  flex: none; border: 1px solid var(--line-strong); border-radius: 6px;
  background: transparent; color: var(--ink-soft);
  padding: 3px 10px; font-size: 12px; cursor: pointer;
}
.tb-button:hover { background: var(--paper-sunken); color: var(--ink); }
.tb-button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Compact segmented control, scoped to the toolbar so the board's sort and filter
   segments below the header keep the size they have today. */
.toolbar .seg { flex: none; border-radius: 5px; }
.toolbar .seg button { padding: 2px 8px; font-size: 11.5px; background: transparent; }
.toolbar .seg button:hover { background: var(--paper-sunken); }
```

Deleted with the block: `.masthead`, `.masthead h1`, `.masthead .brand-row`,
`.masthead .wordmark`, `.masthead .brand-divider`, `.masthead .tagline`, `.masthead .meta`,
`.masthead .meta strong`, `.masthead .meta #live-status`,
`.masthead .meta #live-status.is-stale`. Also deleted, from the Home page section:
`.back-link`, `.back-link:hover`, `.back-link:focus-visible`
(`src/public/styles.css:521-532` pre-WS-71).

Also deleted, in Phase 3: `footer.note`, `footer.note code` and `footer.note .footer-lockup`
(`src/public/styles.css:479-497` pre-WS-71).

Every colour is an existing custom property already declared in both of WS-71's theme blocks. No
`@media (prefers-color-scheme: …)` block is added, no new custom property is introduced, and no
`filter` is applied to any image — the standing rule from WS-70's design review holds.

**`.toolbar .seg button` background.** `.seg button` sets `background: var(--paper-raised)`, which
is now the toolbar's own surface, so inactive segments would be invisible fills. Making them
transparent inside the toolbar leaves the control defined by its `--line-strong` border and its
`--accent` active segment, which is the intended compact form.

### Contract 4 — the narrow-width rule

Added to the existing breakpoint convention. The stylesheet's only layout breakpoint today is
`@media (max-width: 880px)` (`src/public/styles.css:430` pre-WS-71); this reuses that width rather
than inventing a second one:

```css
@media (max-width: 880px) {
  .tb-version { display: none; }
  .tb-meta .tb-meta-item { display: none; }
  .tb-meta #live-status { display: inline; }
  .tb-meta #live-status::before { content: none; }
}
```

The live/stale signal is the one meta field with no other home on the page, so it is the one that
survives. Suppressing its `::before` is what stops a leading `·` once its predecessors are hidden.

### Contract 5 — the footer removal

Both `<footer class="note">…</footer>` blocks are deleted whole — the lockup `<img>`, the prose,
and the closing tag (`src/public/index.html:44-51`, `src/public/board.html:90-97`). Before the
deletion, `<div id="app-version" hidden></div>` is moved into the toolbar's `.tb-right` group per
Contracts 1 and 2, keeping its id and its `hidden` attribute so
`src/public/app-version.ts:17-28` finds it and reveals it exactly as it does today.

The asset itself goes too: `src/public/img/flowcharge-lockup.png` (628 × 80, 16401 bytes) is the
only consumer of the deleted rule and has no other reference in the repository. It is deleted with
`git rm`, and its entry is removed from the copy list in `tools/copy-assets.mjs:16-23`. Leaving it
listed there is not merely untidy — `fs.copyFileSync` throws if a listed source is missing, so the
list and the file must change together, in the same commit. `src/public/img/flowcharge-wordmark.png`
and its copy-list entry stay.

### Module boundaries

This plan adds no module and edits no script. What each touched file is allowed to know:

- The two HTML files know asset paths, element ids and structure. They must **not** learn sizes,
  colours or spacing — those live in the stylesheet.
- `src/public/styles.css` knows sizes, spacing and existing colour tokens. It must **not** learn
  asset paths beyond what already exists, and must not introduce a colour literal.
- `tools/copy-assets.mjs` stays a list-driven copier that knows filenames and nothing else.
- `src/public/app.ts`, `home.ts` and `app-version.ts` know exactly the ids they know today. The
  whole point of preserving every id is that this plan never opens them.

### Non-functional notes

- **Security.** No new attack surface. No new file is served, no MIME entry changes, no CSP
  change, no dependency. One tracked binary is deleted, which shrinks what is shipped.
- **Performance.** The packaged build loses 16401 bytes (the lockup) and the wordmark now paints
  at 26px instead of 62px from the same file. Nothing new is fetched.
- **Observability.** None required. A broken toolbar is visible on sight; a missing image shows a
  404 through the server's existing request path.
- **Accessibility.** The brand is announced once per page via `alt="FlowCharge"`. The chevron
  `<svg>`, the vertical rule and the `›` separator are all `aria-hidden="true"` and contribute no
  text. `<header>` remains a banner landmark on both pages. Each page keeps exactly one `<h1>`.
  `.tb-back` keeps a visible focus ring, matching `.back-link`'s today. Every text pair in the
  toolbar uses an existing token pairing that WS-71's Contract 7 already measured at AA.

## Staged task breakdown

Four phases, ordered riskiest first. The app builds and runs at the end of every one.

### Phase 1 — Board toolbar (medium)

The riskiest slice: the board header carries the most content, and this phase settles whether an
26px wordmark holds up.

- Rewrite `src/public/board.html`'s `<header class="masthead">` block per Contract 1.
- Add the whole `/* ---------- Toolbar (app chrome) ---------- */` block from Contract 3 to
  `src/public/styles.css`, **leaving the existing `.masthead*` and `.back-link` rules in place**.
  The home screen still carries `class="masthead"` at this point and must keep rendering exactly
  as it does today. The two blocks coexist for one phase only.

Files: `src/public/board.html`, `src/public/styles.css`. Depends on: TL-71.

**Verify.** `npm run electron:dev` on a real project.
1. The board's toolbar is one row, 36px tall in devtools, and does not grow when the meta line
   populates.
2. The breadcrumb reads wordmark │ ‹ Projects › project-folder-name. Clicking `Projects`
   navigates to the home screen.
3. The meta row reads `Generated <date> · N workstreams · M issues · Live · updated <time>`, with
   `Branch <name>` inserted when the project is a git repository, and no stray `·` when it is not.
4. Let the poll go stale: `#live-status` turns `--sev-high`.
5. Open a project whose folder name is long: the title truncates with an ellipsis and the right
   group stays on screen.
6. **The visual gate on the wordmark, blocking.** At the real 26px render size, in both themes,
   the FlowCharge wordmark must still read as the wordmark and not as a smear. The user has
   already rejected this artwork at small sizes once, on the public website. Check the vertical
   clearance at the same time: 26px in the 36px bar leaves 5px above and below, and if that reads
   as cramped the fix is a 38px bar (A1a), not a smaller wordmark. If the artwork itself fails,
   stop and raise Open question 1 — request a simplified small-size export. Do **not** add a CSS
   `filter` and do not silently enlarge the bar past 40px.
7. **The theme control gate.** The three-button `#theme-seg` still switches theme with one click,
   renders at most 24px tall, and its inactive buttons are legible against the
   `--paper-raised` bar in both themes.
8. The home screen is byte-for-byte unaffected: open it and confirm it looks exactly as it did.

### Phase 2 — Home toolbar, and retire the masthead rules (small)

- Rewrite `src/public/index.html`'s `<header class="masthead">` block per Contract 2.
- Delete every `.masthead*` rule and the three `.back-link` rules from `src/public/styles.css`,
  per Contract 3.
- Update the one comment above `.update-banner` in `src/public/styles.css` that says the banner
  sits "directly under the masthead" and "carries the masthead's own bottom border" — the same
  two sentences, with the element's new name.

Files: `src/public/index.html`, `src/public/styles.css`. Depends on: Phase 1, which owns the
shared block.

**Verify.**
1. `grep -rn 'masthead' src/public/` returns nothing.
2. `grep -c '<h1' src/public/index.html` returns exactly 1, and it is the `home-heading` line.
3. Both toolbars are the same height and share the same left group. Put the two screens side by
   side and confirm it by eye, not only by devtools.
4. `Manage integrations` still opens the integrations dialog.
5. The update banner still renders as a second band immediately under the toolbar. Reveal it in
   devtools by removing its `hidden` attribute.
6. Navigate home → board → home. The theme control shows the same active mode throughout.

### Phase 3 — Delete both footers and the lockup asset (small)

- Move `<div id="app-version" hidden></div>` into `.tb-right` on both pages, per Contract 5.
- Delete both `<footer class="note">…</footer>` blocks whole.
- Delete the `footer.note`, `footer.note code` and `footer.note .footer-lockup` rules.
- `git rm src/public/img/flowcharge-lockup.png` and remove its entry from the copy list in
  `tools/copy-assets.mjs`. Both in the same commit — `fs.copyFileSync` throws on a missing source.

Files: `src/public/index.html`, `src/public/board.html`, `src/public/styles.css`,
`tools/copy-assets.mjs`, `src/public/img/flowcharge-lockup.png` (deleted). Depends on: Phase 2.

**Verify.**
1. `rm -rf dist && npm run build` succeeds, and `ls dist/public/img/` lists only
   `flowcharge-wordmark.png`.
2. `grep -rn 'footer\|lockup' src/public/index.html src/public/board.html src/public/styles.css`
   returns nothing.
3. `npm run electron:dev`: the version string appears in the toolbar's right group on both
   screens, and nothing logs an error in the console — the failure mode of a missed relocation is
   silent by design in `app-version.ts`, so this check has to be made by eye.
4. `npm run build:release` still passes the eval guard and the source-map guard.
5. Both pages end at the last content section with no empty space where the footer was.

### Phase 4 — Narrow-width behaviour (small)

- Add Contract 4's rule to the existing `@media (max-width: 880px)` breakpoint region in
  `src/public/styles.css`.

Files: `src/public/styles.css`. Depends on: Phase 3.

**Verify.** Resize the window, or use devtools' responsive mode, from 2560px down to 640px on both
screens.
1. At 880px and below, the board toolbar shows the wordmark, the breadcrumb and `#live-status`
   with no leading `·`, plus the theme control. The generated date, counts, branch and version are
   hidden.
2. The toolbar stays one 36px row at every width down to 640px on both screens.
3. Neither page scrolls horizontally at any width in that range.
4. Above 880px every meta field returns.

## Data & compatibility

- **No data model, API or persisted-state change.** No field is added, renamed or removed.
  `src/types/praxis-data.d.ts`, `src/lib/`, `src/server.ts` and every `/api/*` route are
  untouched. `.praxis-projects.json`, `.praxis-update.json` and the `praxis-theme` key WS-71 adds
  are all unaffected.
- **No DOM contract change.** Every id a script reads — `board-title`, `gen-date`, `meta-counts`,
  `branch-line`, `branch-name`, `live-status`, `manage-integrations-button`, `app-version`,
  `theme-seg`, `update-banner*` — survives with the same id and the same initial state. That is
  why no TypeScript file is edited, and it is the property to protect if any phase has to be
  re-cut.
- **The one deleted class contract** is `.masthead` and its descendants, plus `.back-link` and
  `footer.note*`. No script queries any of them, confirmed by grep across `src/`, `electron/` and
  `tools/`.
- **One deleted binary.** `src/public/img/flowcharge-lockup.png` is removed from the working tree
  and from the build's copy list together. `git revert` of Phase 3's commit restores both.
- **Rollback.** Each phase is one revertible commit. Reverting Phase 2 alone would leave the home
  screen styled by rules Phase 2 deleted, so Phases 1 and 2 revert together or in reverse order.
  Phases 3 and 4 revert independently.
- **Mid-feature state.** After Phase 1 and before Phase 2 the board shows the new toolbar and the
  home screen still shows the old masthead band. The app is fully functional; it looks
  half-migrated. Acceptable for a solo sequential build (A7), but do not cut a release between
  those two phases.
- **Interaction with WS-71.** WS-71's `.seg#theme-seg` markup moves position inside the header in
  Phases 1 and 2 but keeps its id, its `role`, its `aria-label` and its three `data-mode` buttons,
  so `theme-toggle.ts` binds to it unchanged. This plan adds no rule that could reach WS-71's
  palette blocks.

## Testing strategy

This repository has no test harness: `package.json` declares no `test` script and no runner, and
the feature is entirely HTML and CSS with zero TypeScript changes. Building one for a header
redesign would be a larger change than the redesign. Verification is therefore mechanical where it
can be, and observed where it cannot:

| Phase | Mechanical check | Observed check |
|---|---|---|
| 1 | `npm run build`; `grep -c 'class="toolbar"' src/public/board.html` returns 1 | toolbar height, breadcrumb, meta row, stale state, long-name truncation, **the 26px wordmark gate**, **the theme-control gate** |
| 2 | `grep -rn 'masthead' src/public/` returns nothing; `grep -c '<h1' src/public/index.html` returns 1 | cross-screen consistency; integrations dialog; update banner position |
| 3 | `rm -rf dist && npm run build`; `ls dist/public/img/`; `npm run build:release` | version string in both toolbars; no gap where the footer was |
| 4 | `npm run build` | one row from 640px to 2560px; no horizontal scroll; meta returns above 880px |

Two checks are deliberately observed rather than automated, because nothing in this repository can
assert them. The wordmark gate is an aesthetic judgement the user has already made once, against
this same artwork. The `#app-version` relocation fails silently by design — `app-version.ts`
swallows every error path and leaves the element hidden — so only looking at the toolbar proves it.

If a DOM harness is ever added, the two behaviours worth covering are that both pages expose every
id in the Data & compatibility list, and that each page has exactly one `<h1>`. Neither justifies
the harness on its own.

## Open questions

Each needs the user's answer. Nothing downstream should author work that contradicts one.

1. **Does the wordmark survive at 26px?** *The size itself is settled: the user chose 26px (A1),
   so this question is now about the artwork alone, not the number.* The user has already rejected
   this chrome/metallic artwork at small sizes on the public website and enlarged it to 62px there
   for exactly that reason. 26px is a much softer test than the 18px this plan first proposed — the
   artwork is downscaled 4.8× rather than 6.9× — but it is still a reduction, so Phase 1 keeps the
   visual gate. **Options:** (a) 26px as decided, with the Phase 1 gate — only the gradient's
   readability is in doubt, not the resolution; (b) commission a simplified flat small-size
   wordmark export and use that in the toolbar. **Recommendation: (a) with (b) as the standing
   fallback.** Showing the standalone arrow mark instead is rejected outright — direction 5 keeps
   the wordmark, and the standalone mark measured 4.5:1 on only 10.9% of its body pixels against
   the light paper.
2. **What happens to the board's meta at narrow widths?** Contract 4 hides the generated date, the
   counts, the branch and the version below 880px, keeping only the live/stale signal.
   **Options:** (a) as planned; (b) hide the whole meta group, including live status, for a
   simpler rule; (c) let the toolbar wrap to a second row below 880px, breaking the fixed 36px
   height; (d) move the meta to a status strip under the toolbar — which is below-header layout
   and out of scope for this plan. **Recommendation: (a).** Live/stale is the one field with no
   other home on the page.
3. **The footer prose is lost with the footer.** Deleting `<footer class="note">` removes the home
   screen's `.praxis-projects.json` privacy note and the board's explanation of the live-refresh
   polling. The core onboarding fact survives — `home.ts:152-156` already tells a first-time user
   that a project is "a directory that contains a flowcharge/ folder" — but the other two
   sentences do not. **Options:** (a) accept the loss, which is what the direction asks for;
   (b) relocate one sentence into the integrations dialog or a tooltip, which is below-header work
   and out of scope here. **Recommendation: (a).**
4. **Fraunces below the header.** This pass removes `var(--font-display)` from the toolbar only.
   It stays on `.panel h2`, `.home-heading`, `.kpi .kpi-value`, `.load-state h2`, `.tiles-empty h3`
   and `.ws-modal-title`. The direction says "drop it from chrome entirely, keep it only for
   genuine content" — and several of those are chrome, not content, but all of them sit below the
   header, which the user put out of scope. **Options:** (a) header only now, and sweep the rest in
   the deferred below-header pass; (b) widen this plan to sweep them all now.
   **Recommendation: (a).** Widening it would re-open the layout question the user deferred.
5. **The taglines are deleted (A2).** "Registered projects" and "Workstream state" have no script
   consumer and no room in a 36px bar. **Options:** (a) delete both, as planned; (b) keep the
   board's as a `title` tooltip on the breadcrumb. **Recommendation: (a).**
6. **Does the home toolbar need a `Projects` crumb (A5)?** It gives both screens the same left
   group, at the cost of showing "Projects" in the toolbar and "Your projects" as the body heading
   on the same screen. **Options:** (a) keep the crumb, as planned; (b) show the wordmark alone on
   home, accepting that the two toolbars' left groups differ. **Recommendation: (a)** —
   direction 4 asks for visual consistency between the two screens.

## Alternatives considered and rejected

**Overall shape of the header**

- *Keep the bordered masthead band and just reduce its padding and the wordmark's height.*
  **Rejected.** It is the pattern the user rejected, made smaller. The review's point 1 is that a
  bordered band holding a wordmark is the website's own pattern, not that the band is too tall.
- *Integrate the toolbar with the native window title bar* (`titleBarStyle: 'hiddenInset'` plus
  `-webkit-app-region: drag`). **Rejected here, worth raising separately.** This is the most
  genuinely desktop answer, and it would reclaim the OS title bar's height. But it edits
  `electron/main.cts`, which this plan puts out of scope; it needs per-platform inset handling for
  the macOS traffic lights; and it degrades in the browser-tab fallback mode WS-45 ships, where
  there is no native title bar at all. It is a follow-up workstream, not a phase of this one.
- *Give the two screens different toolbars, each sized to its own content.* **Rejected** by
  direction 4 and by the constraint the earlier masthead work already established.

**The board's meta block**

- *Move `.meta` to a slim status strip below the toolbar.* **Rejected.** It is the most honest
  desktop pattern for this content, and it would free the toolbar completely — but a new band
  below the header is below-header layout, which the user explicitly deferred.
- *Drop the generated date and the branch to make the row fit comfortably.* **Rejected.** Deleting
  information the user did not ask to delete is not a header redesign, and the branch display is
  its own shipped workstream (WS-6).
- *Keep `.meta` as a multi-line block and let the toolbar be 60px tall.* **Rejected** — it fails
  the 32-40px constraint, which is the whole direction.

**Class naming**

- *Keep the class name `.masthead` and only change what it does.* **Rejected.** The name is the
  primary carrier of the design intent here; leaving it means every future reader re-derives a
  masthead from the stylesheet. The rename is mechanically safe: `masthead` appears in exactly two
  HTML lines and one CSS block, and grep across `src/`, `electron/` and `tools/` confirms no
  script references it.

**The footer**

- *Keep the footer prose and delete only the lockup image.* **Rejected** by direction 2, which
  names the whole `<footer class="note">` block. A prose footer on every screen is itself the
  website tell.
- *Keep `flowcharge-lockup.png` in the repository, unreferenced, in case a footer returns.*
  **Rejected.** It would ship 16KB into every packaged build to render nowhere, and `git revert`
  restores it in one command if it is ever wanted.

**Sequencing**

- *Rename the shared class and rewrite both screens in one phase.* **Rejected.** It makes the
  first phase the only phase, with nothing demonstrable until it is entirely finished. Letting
  `.toolbar` and `.masthead` coexist for exactly one phase keeps both screens working throughout,
  at the cost of one phase of duplicated CSS.
- *Do the footer deletion first, as the smallest slice.* **Rejected.** The `#app-version`
  relocation needs a toolbar to relocate into, so the footer work is downstream of Phase 2 either
  way.

## Final summary

- **Approach:** one shared 36px `.toolbar` block replacing `.masthead` on both screens, with an
  26px wordmark, the back navigation as a breadcrumb chevron inside the bar, the board's four meta
  fields condensed to one inline row, a compact home for WS-71's theme control, and both footers
  deleted. Every DOM id is preserved, so **no TypeScript file is touched**.
- **Four phases**, one medium and three small — a focused session's work, on top of WS-71.
- **Top risks:** (1) the chrome/metallic wordmark may not read at 26px, and the user has already
  rejected this artwork small once, which is why Phase 1 gates it; (2) `#app-version` lives inside
  the footer being deleted and fails silently if the relocation is missed, so only looking at the
  toolbar proves it; (3) the board's meta row is the widest thing in the bar and the least
  forgiving at narrow widths.
- **Needs your answer:** whether the artwork holds at the decided 26px or a simplified export is
  needed (Q1); what the meta row does below 880px (Q2); whether losing the footer prose is
  accepted (Q3); and whether Fraunces stays below the header for now (Q4).

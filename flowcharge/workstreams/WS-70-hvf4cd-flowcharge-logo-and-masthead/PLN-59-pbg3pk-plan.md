---
id: PLN-59-pbg3pk
type: plan
workstream: WS-70-hvf4cd
slug: flowcharge-logo-and-masthead
title: "FlowCharge wordmark in the masthead, lockup in the footer, and a real app icon"
status: dropped
created: 2026-08-27
updated: 2026-08-28
depends_on: []
links: []
notes: "Superseded. TL-70-yrrmr7 executed this plan before this session, but every part of what it delivered is now gone: the single masthead wordmark and heading demotion were fully rebuilt by PLN-62-r6bxg3/TL-73-r0874s into the three-bar/two-bar toolbar chrome, and the footer lockup image was deleted outright by WS-72-p6g77g. Marked dropped rather than done, matching PLN-61-7f18vq's treatment, since nothing it specified survives in the app."
---

# FlowCharge wordmark in the masthead, lockup in the footer, and a real app icon

## Summary

The Dashboard shows a teal circular "P" badge and the words "Praxis Projects" / "Praxis Board"
in its masthead (`src/public/index.html:14-15`, `src/public/board.html:15-16`). This plan
replaces that with the real FlowCharge wordmark image, adds the combo lockup to the footer,
deletes the "P" badge, and re-cuts the heading on each screen so the `<h1>` carries what varies
instead of the brand name.

The chosen approach **vendors pre-sized copies of the sibling repo's PNGs into
`src/public/img/`** and extends the existing static-copy step (`tools/copy-assets.mjs`) to carry
them into `dist/public/`. No new build dependency, no new pipeline, no runtime image processing.

**UPDATE (2026-08-27) — the two image files are already delivered.** The user produced them
directly, outside this pipeline, and they are on disk now:

| File | Raster | Alpha | Bytes |
|---|---|---|---|
| `src/public/img/flowcharge-wordmark.png` | 770 × 124 | yes | 20906 |
| `src/public/img/flowcharge-lockup.png` | 628 × 80 | yes | 16401 |

Both are 2x their CSS display height: 124 / 2 = **62px** for the wordmark, 80 / 2 = **40px** for
the lockup. Those two display heights are not a guess. The user's public website ships these exact
chrome/metallic-gradient assets and renders the wordmark at `h-[62px]`
(`Praxis-Website/components/navbar.tsx`) and the footer lockup at `h-10`, that is 40px
(`Praxis-Website/components/Blocks/Footer.tsx`). The user built that site, started with small
sizes on the same artwork, found that the airbrushed 3D-chrome styling looks bad small, and
enlarged both. So 62px and 40px are tested figures.

**Consequently the crop, pad and downscale derivation that this plan originally specified is
moot.** Nothing in Phase 1 produces an image any more. Phase 1 verifies the delivered files.
The old figures — raster 420 × 67 and 284 × 36, CSS heights 34px and 18px, byte caps 25KB and
15KB — are **WRONG and superseded**. They are kept in this document only where they explain how
the earlier reasoning went, and they are marked as superseded wherever they appear.

Reconnaissance turned up three facts the workstream record does not contain, and all three
change the work:

1. **`src/server.ts` has no `.png` entry in its `MIME` table** (`src/server.ts:17-25`). Every
   PNG would be served as `application/octet-stream`. This must be fixed or the whole feature
   depends on browser content sniffing.
2. **`tools/copy-assets.mjs:16` copies a hard-coded list of four filenames.** A new asset that
   is not added to that list never reaches `dist/public/`, and the Electron build ships only
   `dist/**/*`.
3. **There is no `icon` key in `package.json`'s `build` section and no `build/` directory.**
   electron-builder's default `buildResources` directory does not exist yet, so the delivered
   icon artwork needs a home and a conversion step that this repo has no tooling for.

Phase 5 (favicon and app icon) is **blocked on artwork the user must supply**. It is planned as
a consumer of a delivered asset set, not as something the implementer produces.

## Scope

### Acceptance criteria

**Masthead — both screens**

1. Neither `index.html` nor `board.html` contains `<span class="mark">P</span>`, and the
   `.masthead .mark` rule is gone from `styles.css`.
2. The top-left of both screens shows the FlowCharge wordmark as an `<img>`, rendered at a
   CSS height of 62px with `width: auto`, crisp on a 2x display (the delivered raster is
   770 × 124). *Superseded: this criterion previously said 34px.*
3. The wordmark carries `alt="FlowCharge"`, so a screen reader announces the brand once per
   page and nothing announces the letter "P".
4. No CSS `filter` is applied to the wordmark in any theme. The same file serves light and dark.
5. On the board screen the right-hand `.meta` block (`Data generated …`, counts, branch,
   live status) sits where it did before the alignment change, with no vertical jump.
6. On the home screen the "Manage integrations" button does not drop below the wordmark's
   bottom edge (the failure mode the old `align-items: baseline` produces once the left
   column's first line box becomes a replaced element).

**Home screen (`index.html`)**

7. The `<h1>Praxis Projects</h1>` element no longer exists.
8. `<h2 class="home-heading">Your projects</h2>` is now `<h1 class="home-heading">Your projects</h1>`,
   keeping the class so its 18px Fraunces styling (`styles.css:530-535`) is unchanged.
9. The page still has exactly one `<h1>`. "Add a project" stays an `<h2>`.
10. The masthead region is a `<header class="masthead">` element, so the region is announced
    as a landmark now that the visible heading has left it.
11. No divider element appears next to the wordmark on this screen.

**Board screen (`board.html`)**

12. The masthead reads wordmark → vertical divider → `<h1>`, in that order.
13. The `<h1>` shows the project's folder name (the value `app.ts` derives today from
    `raw.source`), not the words "Praxis Board" and not the word "Board".
14. The `.tagline` shows the constant text `Workstream state`, with no project name appended.
15. The tagline's text is set by the HTML, not by JavaScript — the assignment at
    `src/public/app.ts:1213-1215` is replaced by an assignment to the `<h1>`.
16. Opening two board windows on two different projects shows two different `<h1>` values.
17. The divider is `aria-hidden="true"` and contributes no text to the accessibility tree.

**Footer — both screens**

18. `<footer class="note">` on both pages opens with the combo lockup image at a CSS height of
    40px, `width: auto`, at 0.75 opacity, above the existing prose (the delivered raster is
    628 × 80). *Superseded: this criterion previously said 18px.*
19. The lockup carries `alt=""` and `aria-hidden="true"` — it repeats the masthead brand and
    must not be announced twice.

**Serving and build**

20. `GET /img/flowcharge-wordmark.png` returns `Content-Type: image/png`, not
    `application/octet-stream`.
21. `npm run build` places every new asset under `dist/public/img/`, and a clean
    `rm -rf dist && npm run build` produces a working masthead with no missing images.
22. `npm run build:release` still passes `tools/bundle-public.mjs`'s eval guard and source-map
    guard. The `.js` sweep in `bundle-public.mjs:41-54` must not touch the new `.png` files.
23. No new entry appears in `dependencies` or `devDependencies`.
24. The committed wordmark PNG is at most 30KB and the committed lockup PNG is at most 20KB.
    The delivered files are 20906 and 16401 bytes, so both budgets carry real headroom. The
    440–500KB source files are never committed. *Superseded: the budgets were previously 25KB
    and 15KB, sized for the old 420 × 67 and 284 × 36 rasters.*

**Favicon and app icon (phase 5, blocked)**

25. Both HTML `<head>` blocks carry `<link rel="icon">` entries pointing at same-origin files
    under `img/`, and the browser tab shows the FlowCharge mark instead of a blank page icon.
26. `package.json`'s `build` section names an icon, and `npm run package:mac` produces a `.app`
    whose Dock and Finder icon is the FlowCharge mark.
27. The 16px and 32px icons are the *delivered* small-size artwork, not automatic downscales
    of the 512px file.

### Out of scope

- `package.json`'s `"productName": "Praxis Board"` and `"appId": "com.praxisboard.app"`. The
  workstream record explicitly excludes productName; appId is a distribution identity that
  cannot be changed without breaking update continuity, and nothing asked for it.
- The `<title>` element on either page. See Open question 1 — this plan does not action it.
- `README.md`'s "Praxis Board" heading and all its `prxwork/` prose.
- `window.praxisAPI` / `window.praxisSkillInstallAPI` contextBridge names, `.praxis-projects.json`,
  and every other internal `praxis` identifier. Renaming any of them is a separate, risky change
  (`tools/bundle-public.mjs` documents `renameProperties: false` as load-bearing for exactly
  these names).
- Any hero, splash, or in-body use of the standalone arrow mark. Decision 5 excludes it.
- A dark-specific export of any asset. Decision 5's rule stands: if a theme looks wrong, request
  a separate export — never filter.
- Adding an `icon` option to `new BrowserWindow(...)` in `electron/main.cts:22-30`. See Open
  question 4.
- Any change to `src/server.ts` beyond the one `MIME` table entry.

### Assumptions

These are stated, not confirmed. Each one is a judgement I made because Context left it open.

- **A1 — Display size. RESOLVED, no longer an assumption.** The wordmark renders at
  `height: 62px` and the lockup at `height: 40px`. The delivered rasters are 770 × 124 and
  628 × 80, exactly 2x each display height. These figures come from the user's own public
  website, which ships the same chrome/metallic-gradient files at `h-[62px]` in
  `Praxis-Website/components/navbar.tsx` and `h-10` (40px) in
  `Praxis-Website/components/Blocks/Footer.tsx`. The user built that site, started small on the
  same artwork, saw that the airbrushed 3D-chrome styling reads badly at small sizes, and
  enlarged both. Treat 62px and 40px as settled facts.
  *Superseded, kept only as the record of the earlier reasoning:* this plan originally assumed
  34px and 18px, reading the record's "export ~420px wide" as a raster width and choosing 34px
  to sit optically level with the neighbouring 30px Fraunces `<h1>` (`styles.css:151-158`).
  That optical-levelling rationale is now overruled by the website's tested sizes. The wordmark
  is deliberately taller than the `<h1>` beside it.
- **A2 — Where the trim happens. MOOT.** No trim, pad or downscale happens at all. The user
  supplied both files pre-sized at the final path. Nothing in this plan produces an image, so
  the question of which tool performs the crop no longer arises, and no package is needed. The
  measured crop rectangle is retained in Design only as a record of the source artwork.
- **A3 — Board `<h1>` fallback.** `app.ts` already branches on a missing `raw.source`
  (`src/public/app.ts:1213-1215`). When `raw.source` is absent the `<h1>` shows `Board` — a
  neutral, non-branded word — rather than being empty, so the document always has a non-empty
  top-level heading.
- **A4 — Masthead alignment value.** `align-items: flex-start` on `.masthead`, not `center`.
  `center` would move the board screen's four-line `.meta` block more than `flex-start` does.
- **A5 — Lockup opacity is one value for both themes.** The record specifies 0.75 "in light
  mode" and says nothing about dark. A single 0.75 is the starting point; if the visual check
  in Phase 4 says dark needs its own value, the codebase-consistent mechanism is a
  `--lockup-opacity` custom property declared in all four theme blocks
  (`styles.css:9`, `:53`, `:93`, `:106`), never a new `@media` query.
- **A6 — Deployment and release constraints.** This is a private, locally-run Electron app with
  no server deployment, no live users, and no production data. Every change here is
  presentational and additive. No feature flag, no dark launch, no migration. The app stays
  runnable at the end of every phase. Rollback is `git revert`.
- **A7 — Asset provenance.** The sibling repo `/Users/akoukoullis/Work/AK/Praxis-Website/` is
  the user's own and its assets are the user's own. Copying derivatives into this repo raises
  no licensing question.

## Design

### Verification of the record's theme claim — done, with a caveat

Context asked me to re-run the "survives both themes" judgement rather than trust it. I decoded
`flowcharge-name.png` and measured every near-opaque pixel (alpha ≥ 200) composited against each
theme's real `--paper` value from `src/public/styles.css`:

| Asset | vs light `#F3F5F4` | vs dark `#10141A` |
|---|---|---|
| `flowcharge-name.png` (wordmark) | 19.4% of body pixels reach 4.5:1, peak 19.18:1 | 77.0% reach 4.5:1, peak 18.47:1 |
| `flowcharge-name-logo.png` (lockup) | 18.4% reach 4.5:1 | 77.9% reach 4.5:1 |
| `flowcharge-logo.png` (arrow mark) | 10.9% reach 4.5:1 | 85.4% reach 4.5:1 |

**Verdict: the decision holds, but not for the reason the record gives.** The record implies the
wordmark is comfortable on both papers. It is not symmetric. On the dark theme three quarters of
the glyph body clears the 4.5:1 text threshold, carried by the pale lower half and the light
outer glow. On the light theme only one fifth does — the entire readable signal comes from the
thin near-black outline around each letter, which peaks at 19.18:1 against `#F3F5F4`.

That is still enough. A logotype is not body text, and a dark outline at 19:1 delineates every
letterform cleanly. So **the no-separate-exports decision survives** and Phase 2 proceeds with
one file. But the light theme is the weak side, not the strong one, and Phase 2 carries an
explicit visual gate at final render size before the phase is called done. If it fails, the
remedy is a separate light export, never a filter.

The same measurement independently confirms decision 5's second rationale: the standalone arrow
mark reaches 4.5:1 on only 10.9% of its body against the light paper. It genuinely does read
faint on light, and it genuinely does need a redraw rather than a resize.

### Correction to the record's padding claim — now a historical note only

**MOOT.** This section measured the source artwork so that this plan could specify a crop. The
user has since delivered both final files pre-sized, so no crop is performed and these numbers
drive no work. They are kept because they document the source artwork accurately.

The record says the wordmark PNG has "large transparent padding above/below the letters (~half
the 490px canvas height)". Measured, the true alpha bounds are:

```
flowcharge-name.png        2048 x 490    content bbox (alpha>=1): x 105..1943, y 92..386
                                         -> 1839 x 295, i.e. 60.2% of canvas height
flowcharge-name-logo.png   2120 x 270    content bbox (alpha>=1): x 0..2119, y 0..269
                                         -> full canvas, NO padding at all
flowcharge-logo.png        1000 x 1000   content bbox (alpha>=8): x 24..980, y 4..994
```

So the wordmark's padding is ~40% of canvas height (92px top, 104px bottom) plus ~10% horizontal
(105px each side) — real, and enough to render the logo undersized inside its own box, but not
half. **The lockup needs no trim at all** — a fact the record does not state and which removes
work from Phase 4.

### Contract 1 — the vendored asset files

The directory `src/public/img/`, sitting alongside the existing `src/public/fonts/` and
`src/public/lib/`. It already exists on disk. Two files land in Phases 1–4. **Both already exist
on disk at these exact paths.** The user produced them outside this pipeline and delivered them pre-sized, so this
contract now describes what must be *verified*, not what must be *derived*:

| Path | Origin | Raster (verified) | Alpha | Bytes (verified) | Budget | CSS display height |
|---|---|---|---|---|---|---|
| `src/public/img/flowcharge-wordmark.png` | supplied by the user, matched to `Praxis-Website`'s own navbar proportions | 770 × 124 | yes | 20906 | ≤ 30KB | 62px |
| `src/public/img/flowcharge-lockup.png` | supplied by the user, matched to `Praxis-Website`'s own footer proportions | 628 × 80 | yes | 16401 | ≤ 20KB | 40px |

Both carry transparency. Note the delivered encoding: both files are 8-bit **indexed-colour**
PNGs (colour type 3) whose transparency comes from a `tRNS` chunk, not truecolour RGBA
(colour type 6). `sips -g hasAlpha` reports `yes` for both, but `file` describes them as
`8-bit colormap`, never `RGBA`. Any check must assert transparency, not the letters "RGBA".
Both are 2x their CSS display height — 124 / 2 = 62 and 80 / 2 = 40 — which is what makes them
crisp on a HiDPI panel without a `srcset`.

**Superseded figures.** This contract previously specified a `Derivation` column: crop the
wordmark to `x=105, y=92, w=1839, h=295`, pad 2% transparent on all sides (→ 1912 × 307) and
downscale to width 420 for a 420 × 67 raster at ≤ 25KB; downscale the lockup only, to 284 × 36 at
≤ 15KB, for CSS heights of 34px and 18px. **Every one of those numbers is now WRONG.** No crop,
no pad and no downscale is performed by this plan.

Phase 5 adds, from *delivered* artwork only:

```
src/public/img/icon-512.png      icon-180.png     icon-64.png
src/public/img/icon-32.png       icon-16.png      icon.svg  (if supplied)
build/icon.png                   build/icon.icns  build/icon.ico
```

`build/` is electron-builder's default `buildResources` directory. It does not exist yet, and
`.gitignore` does not exclude it, so it will be committed. It is deliberately *not* under
`dist/` — `buildResources` is read at packaging time and is unrelated to the `files` glob.

### Contract 2 — the MIME entry

`src/server.ts:17-25` gains exactly one line:

```ts
'.png': 'image/png',
```

`.svg` and `.ico` are already present. Without this, `src/server.ts:454` falls through to
`'application/octet-stream'`. There is no `X-Content-Type-Options: nosniff` header on static
responses today, so a browser would probably sniff the PNG and render it anyway — which is
precisely why this must be fixed deliberately rather than relied on.

No CSP change is needed. The `CSP` constant (`src/server.ts:30-33`) already sets `img-src 'self'`
on line 32, and every new asset is same-origin. The path-traversal guard
(`src/server.ts:426-434`) and `passesOriginCheck` (defined at `src/server.ts:112`, called at
`src/server.ts:422`) already cover `/img/*` — they run before the static branch, on every path.

### Contract 3 — the copy-assets list

`tools/copy-assets.mjs:16` currently reads:

```js
for (const name of ['index.html', 'board.html', 'styles.css', 'fonts/fraunces-latin.woff2']) {
```

It gains the new relative paths in the same style. The loop already does
`fs.mkdirSync(path.dirname(dest), { recursive: true })`, so `img/…` needs no other change —
the `fonts/…` entry proves the nested-path case works.

The source-map guard at the bottom of that file scans for `.map` only, and
`tools/bundle-public.mjs`'s sweep (`sweepJavaScript`, lines 41-54) removes `.js` only. Neither
touches `.png`. Nothing else in the build chain needs to change.

### Contract 4 — the masthead DOM

**`src/public/board.html:11-26`** becomes:

```html
<header class="masthead">
  <div>
    <a class="back-link" href="/">← Projects</a>
    <div class="brand-row">
      <img class="wordmark" src="img/flowcharge-wordmark.png" alt="FlowCharge" width="770" height="124">
      <span class="brand-divider" aria-hidden="true"></span>
      <h1 id="board-title">Board</h1>
    </div>
    <div class="tagline">Workstream state</div>
  </div>
  <div class="meta"> …unchanged… </div>
</header>
```

The `width`/`height` attributes are the intrinsic raster size and exist to reserve layout space
before the image loads; CSS overrides both. `<h1 id="board-title">` ships with the fallback text
from A3 so the page never has an empty heading, and `app.ts` overwrites it once data arrives.
The `.tagline` loses its `id` — nothing sets it any more.

**`src/public/index.html:11-20`** becomes:

```html
<header class="masthead">
  <div>
    <div class="brand-row">
      <img class="wordmark" src="img/flowcharge-wordmark.png" alt="FlowCharge" width="770" height="124">
    </div>
    <div class="tagline">Registered projects</div>
  </div>
  <button type="button" id="manage-integrations-button">Manage integrations</button>
</header>
```

No divider, no `<h1>` — per decision 6. `src/public/index.html:33` changes from
`<h2 class="home-heading">Your projects</h2>` to `<h1 class="home-heading">Your projects</h1>`.
Line 36's "Add a project" stays `<h2>`.

Grep confirms `class="mark"` appears in exactly two places (`board.html:15`, `index.html:14`)
and `.mark` in exactly one CSS rule. No TypeScript file references it. Deleting all three is
complete.

### Contract 5 — the CSS

In `src/public/styles.css`, the `/* ---------- Masthead ---------- */` block:

```css
.masthead {
  align-items: flex-start;   /* was: baseline — see below */
  …everything else unchanged…
}

.masthead .brand-row { display: flex; align-items: center; gap: 10px; }

.masthead .wordmark { display: block; height: 62px; width: auto; }

.masthead .brand-divider {
  flex: none;
  width: 1px;
  height: 22px;
  background: var(--line-strong);
}

/* .masthead .mark { … }  ← deleted entirely */
```

**Why `.masthead` must change too, and not just `.brand-row`.** The record flags `.brand-row`'s
`align-items: baseline` and asks the implementer to "check the right-hand `.meta` block". The
check has a definite answer: `.masthead` itself is also `align-items: baseline`
(`styles.css:144`), and a flex container's baseline comes from its first flex item's first line
box. On the home screen the left column's first line box becomes the wordmark `<img>`, whose
baseline is its **bottom margin edge** — so the "Manage integrations" button would baseline-align
to the bottom of the logo and visibly drop. `flex-start` removes the dependency on a replaced
element's baseline on both screens. (`center` is the alternative; see Alternatives.)

Footer, appended to the `footer.note` rules at `styles.css:481-492` (the `footer.note` rule is
481-486 and `footer.note code` is 487-492), after the `footer.note code` rule:

```css
footer.note .footer-lockup {
  display: block;
  height: 40px;
  width: auto;
  opacity: 0.75;
  margin-bottom: 10px;
}
```

No `@media (prefers-color-scheme: …)` block is added anywhere. Every colour used is an existing
custom property already redefined in all four theme blocks (`--line-strong` at `styles.css:17`,
`:62`, `:96`, `:109`) — the same discipline the update banner comment at `styles.css:1104-1111`
documents.

### Contract 6 — the app.ts change

`src/public/app.ts:1213-1215` reads today (verified — the record's line reference is correct):

```ts
    byId('tagline').textContent = raw.source
      ? 'Workstream state · ' + raw.source.split('/').pop()
      : 'Workstream state';
```

It becomes:

```ts
    byId('board-title').textContent = raw.source
      ? raw.source.split('/').pop()!
      : 'Board';
```

Same data, same branch, same enclosing block (it sits with the other `byId(…).textContent`
assignments at `app.ts:1212-1217`). `byId` is the local helper at `app.ts:74`. This is a
one-expression edit, not a refactor. `app.js` is only loaded by `board.html`, so there is no
cross-page risk from the new id.

Note the `.split('/')` is preserved verbatim, Windows separator and all — see
Out-of-scope observations.

### Contract 7 — the icon wiring (Phase 5)

Both `<head>` blocks gain, after the stylesheet link:

```html
<link rel="icon" type="image/png" sizes="32x32" href="img/icon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="img/icon-16.png">
<link rel="apple-touch-icon" href="img/icon-180.png">
```

If an SVG is delivered it goes first as `<link rel="icon" type="image/svg+xml" href="img/icon.svg">`,
with the PNG lines kept as the fallback. The `apple-touch-icon` line earns its place because this
app has a browser-tab fallback mode (WS-45) as well as the Electron shell; if the user prefers to
drop it, nothing else changes.

`package.json`'s `build` section gains one line per platform block, or relies on convention:

```json
"mac":   { "icon": "build/icon.icns", … }
"win":   { "icon": "build/icon.ico",  … }
"linux": { "icon": "build/icon.png",  … }
```

**The conversion problem.** electron-builder will happily generate `.icns` and `.ico` from a
single ≥512px `build/icon.png` — by mechanically downscaling it. That reintroduces precisely the
failure decision 5 exists to prevent: the 16px and 32px entries inside the icon container would
be automatic reductions of the 512px artwork, not the delivered small-size artwork. So the
containers should be assembled from the per-size files:

- **`.icns`** — `iconutil -c icns build/icon.iconset` ships with macOS. Zero new dependencies.
  The `.iconset` folder takes per-size PNGs at the Apple-mandated names.
- **`.ico`** — macOS has no built-in tool. See Open question 3.

### Module boundaries

This feature adds no module. What each touched file is allowed to know:

- `tools/copy-assets.mjs` knows filenames and nothing about what the files contain or where they
  are rendered. It stays a list-driven copier.
- `src/server.ts` knows one more file extension. It must **not** grow any image-specific logic,
  caching header, or resizing behaviour.
- `src/public/app.ts` knows the DOM id `board-title` and the shape of `raw.source`. It must
  **not** learn anything about the wordmark, the divider, or the assets — those are pure
  markup and CSS.
- The HTML files know asset paths. The CSS knows sizes and opacity. Neither knows about the
  build step.

### Non-functional notes

- **Security.** No new attack surface. One MIME entry, no CSP change (`img-src 'self'` already
  permits it), no new network origin, no new dependency. The images are static bytes served
  through the same guarded static branch as `styles.css`.
- **Performance.** Two PNGs totalling 37307 bytes as delivered, served from loopback, cached by
  the renderer. The hard rule is that the *pre-sized* files ship: committing the 440KB and 499KB
  source files would put ~1MB into `dist/**/*` and therefore into every packaged build, to render
  at 62px and 40px. Acceptance criterion 24 exists to catch that.
- **Observability.** None required. A missing image is visible on sight and shows a 404 in the
  server's existing request path.
- **Accessibility.** One brand announcement per page (`alt="FlowCharge"` on the masthead,
  `alt=""` + `aria-hidden` on the footer repeat); one `<h1>` per page; a `<header>` landmark on
  both screens; a decorative divider hidden from the accessibility tree.

## Staged task breakdown

Five phases, ordered riskiest-first. The app builds and runs at the end of every one. Phases 1–4
are unblocked today; Phase 5 is blocked on artwork.

### Phase 1 — Vendor the assets and fix the serving path (small)

The plumbing slice. Nothing visual changes yet, but the asset becomes reachable.

- Verify the delivered `src/public/img/flowcharge-wordmark.png` (770 × 124, alpha, ≤ 30KB) and
  `src/public/img/flowcharge-lockup.png` (628 × 80, alpha, ≤ 20KB). Both files are already on
  disk at these paths, supplied by the user. Do not produce, crop, pad or downscale anything,
  and do not add a package.
- Add `'.png': 'image/png'` to `MIME` in `src/server.ts`.
- Add both `img/…` paths to the copy list in `tools/copy-assets.mjs`.

Files: `src/public/img/*` (delivered, verified only), `src/server.ts`, `tools/copy-assets.mjs`.
Depends on: nothing. The asset delivery that Phase 1 once depended on has already happened.

**Verify.** `rm -rf dist && npm run build` — both files appear under `dist/public/img/`. Then
`npm start` and `curl -sI http://127.0.0.1:4173/img/flowcharge-wordmark.png` shows
`Content-Type: image/png`. `sips -g pixelWidth -g pixelHeight` on each committed file matches
Contract 1, and `ls -l` shows both under their size caps.

### Phase 2 — Board masthead: wordmark, divider, heading swap (medium)

The riskiest slice, and the one that settles the theme question for the whole feature.

- Rewrite `src/public/board.html:11-26` per Contract 4.
- Apply the `.masthead`, `.brand-row`, `.wordmark`, `.brand-divider` changes and delete
  `.masthead .mark` per Contract 5.
- Apply the one-expression `app.ts` change per Contract 6.

Files: `src/public/board.html`, `src/public/styles.css`, `src/public/app.ts`.
Depends on: Phase 1.

**Verify.** `npm run electron:dev` on a real project, then:
1. The masthead reads wordmark │ project-folder-name, and the tagline reads `Workstream state`
   with no folder name appended.
2. **The theme gate.** Toggle the OS appearance between light and dark with the board open, at
   the real 62px render size. On light, every letterform must remain individually legible on
   `#F3F5F4` — this is the weak side per the measurements above. If it fails, stop and request a
   separate light export. Do **not** add a filter.
3. The `.meta` block on the right has not jumped vertically relative to the pre-change screenshot.
4. Open two boards on two different projects: two different `<h1>` values.
5. Before data loads, the heading reads `Board` and there is no layout shift when it is replaced.

### Phase 3 — Home masthead and heading demotion (small)

- Rewrite `src/public/index.html:11-20` per Contract 4 — wordmark only, no divider, no `<h1>`,
  `<div class="masthead">` becomes `<header class="masthead">`.
- Promote `src/public/index.html:33` from `<h2 class="home-heading">` to `<h1 class="home-heading">`.
- Change `board.html`'s masthead wrapper to `<header>` too, for symmetry.

Files: `src/public/index.html`, `src/public/board.html`.
Depends on: Phase 2 (which owns the shared CSS).

**Verify.** Home screen shows the wordmark with no "P" badge and no "Praxis Projects". The
"Manage integrations" button sits at the top of the masthead row and has not dropped to the
wordmark's bottom edge. In devtools, exactly one `<h1>` per page, and "Your projects" renders at
the same 18px Fraunces it did as an `<h2>`. Both `.mark` occurrences and the CSS rule are gone —
`grep -rn 'class="mark"' src/public/` and `grep -n '\.masthead \.mark' src/public/styles.css`
both return nothing. Do not grep the bare string `mark`: `src/public/` carries 11 unrelated
hits on "markup", "marker" and "marked" that have nothing to do with the badge.

### Phase 4 — Footer lockup on both screens (small)

- Insert `<img class="footer-lockup" src="img/flowcharge-lockup.png" alt="" aria-hidden="true"
  width="628" height="80">` as the first child of `<footer class="note">` in both files
  (`index.html:45`, `board.html:89`).
- Add the `footer.note .footer-lockup` rule per Contract 5.

Files: `src/public/index.html`, `src/public/board.html`, `src/public/styles.css`.
Depends on: Phase 1.

**Verify.** Both footers open with a small muted lockup above the prose. Check it in both themes:
at 0.75 opacity the lockup measures below the wordmark's already-weak light-theme contrast, so
this is the second place a separate export could turn out to be needed. If dark and light want
different opacities, use A5's custom-property mechanism.

### Phase 5 — Favicon and desktop app icon (medium) — **BLOCKED**

**This phase cannot start until the user delivers the redrawn icon artwork.** Decision 5 is
explicit that the source PNG cannot be mechanically downscaled, and the measurements in Design
confirm it. No such asset exists in this repo or the sibling repo today. Nothing in this phase
should be attempted with a placeholder or a resized `flowcharge-logo.png`.

**Input required:** `icon-512.png`, `icon-180.png`, `icon-64.png`, `icon-32.png`, `icon-16.png`,
each drawn (not resized) for its size, plus `icon.svg` if available.

- Place the delivered PNGs in `src/public/img/` and add each to `tools/copy-assets.mjs`.
- Add the `<link rel="icon">` block to both `<head>`s per Contract 7.
- Create `build/`, assemble `build/icon.icns` via `iconutil` from the per-size artwork, place
  `build/icon.png` (the 512), and resolve `.ico` per Open question 3.
- Add the `icon` keys to `package.json`'s `build.mac` / `build.win` / `build.linux`.

Files: `src/public/img/icon-*` (new, delivered), `src/public/index.html`, `src/public/board.html`,
`tools/copy-assets.mjs`, `build/*` (new), `package.json`.
Depends on: Phase 1, and on the artwork delivery.

**Verify.** The browser tab and the Electron window show the mark instead of a default icon.
`npm run package:mac` produces a `.app` whose Finder and Dock icon is the FlowCharge mark. Open
the generated `.icns` in Preview and confirm the 16px and 32px entries are the delivered artwork,
not blurred reductions — that is the whole point of the phase.

## Data & compatibility

- **No data model, API, or persisted-state change.** No field is added, renamed, or removed.
  `src/types/praxis-data.d.ts` is untouched. `raw.source` is read exactly as it is read today.
- **No migration.** `.praxis-projects.json`, `.praxis-update.json` and every project's
  `flowcharge/` folder are unaffected.
- **Backward compatibility.** The only contract that changes is internal DOM ids: `#tagline`
  loses its consumer and `#board-title` gains one. Both live inside the same bundle
  (`app.ts` → `dist/public/app.js`), so there is no version skew to manage. The Electron
  contextBridge surface (`window.praxisAPI`, `window.praxisSkillInstallAPI`) is untouched, which
  matters because `tools/bundle-public.mjs` documents those names as a hard contract with
  `electron/preload.cts`.
- **Rollback.** Every phase is one revertible commit. The assets are new files; reverting deletes
  them and restores the "P" badge. Nothing is destructive, nothing is one-way. Phase 5's
  `package.json` icon keys are the only change that affects a packaged artefact, and reverting
  them returns electron-builder to its current default-icon behaviour.
- **Mid-feature state.** After Phase 2 and before Phase 3, the home screen still shows the "P"
  badge and "Praxis Projects" while the board shows the wordmark. The app is fully functional;
  it just looks half-migrated. Acceptable for a solo sequential build (A6), but do not ship a
  release between those two phases.

## Testing strategy

**There is no test runner wired in this repo.** `package.json` has no `test` script, and the
`*.test.ts` files under `src/lib/` are not reachable from any documented command. This feature is
also almost entirely HTML, CSS and static bytes, with one one-line TypeScript expression change
and no DOM test harness anywhere in the project. Inventing a test infrastructure for it would be
a larger change than the feature.

So verification is deliberately manual and build-level, per phase:

| Phase | Automated / mechanical check | Manual check |
|---|---|---|
| 1 | `rm -rf dist && npm run build` succeeds; `curl -sI` asserts `image/png`; `sips` asserts dimensions; `ls -l` asserts size caps | none |
| 2 | `npm run build` and `npm run build:release` both pass the eval and source-map guards | the theme gate at 62px, `.meta` position, two-window `<h1>` check |
| 3 | `grep -rn 'class="mark"' src/public/` and `grep -c '<h1>Praxis Projects</h1>' src/public/index.html` both return nothing; `grep -c '<h1' src/public/index.html` returns 1 | one `<h1>` per page; button position on home |
| 4 | `npm run build` | lockup contrast in both themes at 0.75 opacity |
| 5 | `npm run package:mac` completes | tab icon, Dock icon, and the small entries inside the generated `.icns` |

Phase 3's check is deliberately narrow. A broader `grep -rn 'Praxis Projects' src/public/` can
never return nothing, because `src/public/index.html:6` is `<title>Praxis Projects</title>` and
the `<title>` elements are out of scope (Open question 1). The narrowed commands above cover
acceptance criteria 1, 7 and 9 in full.

If a later pass adds a DOM test harness, the two behaviours worth covering are the `app.ts`
`board-title` branch (folder name vs the `Board` fallback) and the "no image path 404s after a
clean build" build assertion. Neither justifies the harness on its own.

## Open questions

Each needs the user's answer. Nothing downstream should author work for these until they are
settled.

1. **The `<title>` elements.** `board.html:6` says `Praxis Board` and `index.html:6` says
   `Praxis Projects` — old branding, inside the feature's stated subject, but not named by any of
   the six decisions. The record put the adjacent OS-level name (`productName`) explicitly out of
   scope, and in Electron `<title>` and `productName` compose into the window title, so changing
   one without the other produces a mismatch. **Options:** (a) leave both untouched, and handle
   `<title>` together with `productName` in the separate workstream the record already flags;
   (b) change them now to `FlowCharge` / `FlowCharge Board`. **Recommendation: (a).** This plan
   does not action them.

2. **The icon artwork itself.** Does the redrawn set exist? Nothing in this repo or in
   `/Users/akoukoullis/Work/AK/Praxis-Website/public/` is a redrawn small-size icon — that folder
   holds only the three 1000px+ source PNGs and eight old screenshots. Phase 5 is blocked until
   the set in Contract 1 is delivered. **Recommendation:** commission or draw it as a separate
   piece of work, and run Phases 1–4 now without waiting.

3. **How `build/icon.ico` gets assembled.** macOS ships `iconutil` for `.icns` but has no `.ico`
   tool, and this repo has no image dependency. **Options:** (a) let electron-builder generate the
   `.ico` by downscaling `build/icon.png`, accepting that the 16/32px entries are reductions, not
   the delivered artwork — zero effort, defeats part of decision 5, and only affects Windows;
   (b) add `png-to-ico` or `png2icons` to `devDependencies` — a new dependency, which this plan
   otherwise avoids entirely; (c) generate the `.ico` once, offline, outside this repo and commit
   the binary. **Recommendation: (c)** — it keeps the dependency list clean and matches the
   already-offline treatment of the wordmark trim. But this is the user's call, not mine.

4. **`BrowserWindow` icon in development.** `electron/main.cts:22-30` passes no `icon` option. A
   packaged app takes its icon from the bundle, so this only affects `npm run electron:dev` on
   Linux and Windows. **Options:** (a) leave it (listed as out of scope above); (b) add
   `icon: path.join(__dirname, …)` in Phase 5. **Recommendation: (a)** — it is not in any of the
   six decisions and adds a path dependency between the Electron main process and `dist/public/`.

5. **Wordmark display height. ANSWERED — closed.** The height is 62px CSS on both screens, and
   the footer lockup is 40px. Both figures come from the user's own website, which ships these
   same files at `h-[62px]` and `h-10`. The user already tried small sizes there and rejected
   them, because the chrome styling needs the size. This question previously proposed 34px and
   asked whether the home screen could take something larger. Both parts are settled: one size
   on both screens, and that size is 62px.

## Alternatives considered and rejected

**Asset vendoring — how the PNGs get into this repo**

- *Reference the sibling repo path at build time* (have `copy-assets.mjs` read from
  `../Praxis-Website/public/`). **Rejected.** It makes this repo unbuildable on any machine that
  does not have the sibling checked out at the right relative path, and it makes a packaged
  release depend on a directory outside the repo. It would also ship the untrimmed 440KB original.
- *Inline the images as `data:` URIs in `styles.css`.* **Rejected.** Base64 inflates by ~33%,
  puts binary noise into a hand-maintained stylesheet, defeats separate caching, and gains nothing
  — the CSP already permits same-origin images so there is no request to eliminate.
- *Add `sharp` (or `imagemin`) and trim at build time.* **Rejected.** A new devDependency and a
  new build step for a transformation that happens exactly once, on an asset that will not change.
  The repo's build tooling is two hand-written ESM scripts with no framework; this would be the
  first image pipeline in it. YAGNI.
- *Chosen: commit pre-trimmed derivatives to `src/public/img/` and extend the existing copy list.*
  It matches how `fonts/fraunces-latin.woff2` is already handled — the nearest existing pattern —
  and adds no dependency, no build step, and no external path.

**Trimming — how the transparent padding is removed**

- *Don't trim; use CSS `clip-path: inset()` with percentages derived from the measured bbox.*
  **Rejected.** It works and needs no image tooling, but the element still reserves its untrimmed
  box unless paired with negative margins, and it hides a load-bearing magic number in the
  stylesheet where nobody will connect it back to the source PNG's alpha bounds. It also keeps the
  440KB original in the repo.

**Masthead alignment**

- *`align-items: center` on `.masthead`.* **Rejected in favour of `flex-start`**, though it is a
  close call. `center` reads well on the home screen, where the right-hand item is a single
  button. On the board screen the right-hand `.meta` block is four lines tall against a
  three-element left column, and centring moves it further from where it sits today than
  `flex-start` does. Acceptance criterion 5 is the tiebreaker: least movement wins.
- *Leave `.masthead` at `baseline` and change only `.brand-row`.* **Rejected** — this is what the
  record suggests, and it produces the home-screen bug described in Contract 5, because the left
  column's first line box becomes an `<img>` whose baseline is its bottom edge.

**Heading treatment**

- *Keep an `<h1>FlowCharge Projects</h1>` on the home screen next to the wordmark.* **Rejected**
  by decision 6 and by the designer's stated rule that an app UI does not repeat its own name as
  a heading. Also rejected on its own merits: it would put the brand into the accessibility tree
  twice on a page that has exactly one instance of itself.
- *Commission a baked "FlowCharge Board" image.* **Rejected** by decision 2 — it needs one variant
  per screen and regeneration for every future screen, to encode text that is already text.

**Dark theme handling**

- *Apply `filter: invert()` or `brightness()` to the chrome PNGs on dark.* **Rejected** by
  decision 5 and confirmed unnecessary by measurement: the wordmark is *stronger* on dark (77% of
  body pixels above 4.5:1) than on light (19%). Inverting would damage the theme that currently
  works best.
- *Ship separate light and dark exports up front.* **Rejected as premature.** One file is
  sufficient per the measurements, and the phase gates keep the option live if the visual check
  disagrees.

## Out-of-scope observations

Noticed during reconnaissance. **Not actioned, and no task should be authored for any of them
without the user saying so.**

- `src/public/app.ts:1214` uses `raw.source.split('/').pop()` to extract a folder name. On
  Windows, a backslash-separated path returns the whole string. This plan moves that expression
  verbatim into the `<h1>` — it neither introduces nor fixes the behaviour, but the bug becomes
  more visible, since the result moves from an 11px tagline to a 30px heading.
- `src/server.ts` sends no `X-Content-Type-Options: nosniff` on static responses.
- `package.json`'s `build.publish` block still carries `TODO-REPLACE-OWNER` / `TODO-REPLACE-REPO`.
- `README.md` still describes the app as "Praxis Board" reading `prxwork/`, while the code now
  reads `flowcharge/` (`index.html:46`, `board.html:90`).

## Final summary

**Approach:** vendor the two pre-sized FlowCharge PNGs in `src/public/img/` — both already
delivered by the user at 770 × 124 and 628 × 80, for CSS heights of 62px and 40px — extend the
existing `tools/copy-assets.mjs` copy list, add one `.png` MIME entry, and do the rest in HTML
and CSS. No new dependency, no new build step, and no image derivation of any kind.

**Size:** 5 phases — 3 small, 2 medium. Phases 1–4 are a focused session's work; Phase 5 is
blocked on artwork.

**Top risks:** (1) the wordmark's light-theme contrast is carried entirely by its thin dark
outline — measured at 19% of body pixels above 4.5:1, versus 77% on dark — so Phase 2's visual
gate is real, not ceremonial; (2) `.masthead`'s `align-items: baseline` breaks the home screen's
right-hand button once the left column starts with an `<img>`, which the record's build notes do
not catch; (3) without the `.png` MIME entry the whole feature rests on browser content sniffing.

**Needs your answer:** whether the `<title>` tags change now or with `productName` (Q1); whether
the redrawn icon set exists or must be commissioned (Q2, blocks Phase 5); and how `build/icon.ico`
gets assembled without adding a dependency (Q3).

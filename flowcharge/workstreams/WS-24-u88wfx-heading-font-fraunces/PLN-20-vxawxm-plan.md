---
id: PLN-20-vxawxm
type: plan
workstream: WS-24-u88wfx
slug: heading-font-fraunces
title: "Self-host Fraunces as the heading font, carried by the build and served locally"
status: done
created: 2026-08-09
updated: 2026-08-09
depends_on: []
links: []
---

## Summary

`--font-display` (`src/public/styles.css:33`) is a system-serif stack that reads as generic.
This plan replaces it with the free Google Font Fraunces, **self-hosted** as one `woff2`
file committed under `src/public/fonts/`.

The chosen approach vendors the font into the repository, extends the existing
`tools/copy-assets.mjs` manifest so the build carries the file into `dist/public/`, adds a
`.woff2` entry to the `MIME` map in `src/server.ts` (lines 15-22), and declares one
`@font-face` in `styles.css` with `font-display: swap`. `--font-display` keeps its whole
current stack as the fallback tail.

Self-hosting is chosen over a Google Fonts `<link>` because this app is local-first: it
binds `127.0.0.1` by default, reads the local filesystem, has zero runtime dependencies,
and today references no external asset of any kind. A CDN link would make the UI depend on
internet access it otherwise never needs.

The change is purely visual. No page markup, no TypeScript, no other CSS variable, and no
other font (`--font-body`, `--font-mono`) is touched.

## Scope

**In scope — acceptance criteria:**

- A user who runs `npm run build` sees the font file present at
  `dist/public/fonts/fraunces-latin.woff2`, copied by `tools/copy-assets.mjs`.
- A user who requests `/fonts/fraunces-latin.woff2` from the running server gets HTTP 200
  with `Content-Type: font/woff2`, not `application/octet-stream`.
- A user who opens the home page or a board sees every heading rendered in Fraunces: the
  masthead title and mark, the KPI values, panel headings, the load-state heading, the home
  heading, project tile names, the empty-tiles heading, the workstream modal title and
  section titles, and the plan `h4`/`h5`/`h6` headings.
- A user viewing those headings sees the correct weight: 600 everywhere except
  `.masthead .mark` at 700, and the browser-default bold on `.load-state h2`. No heading
  falls back to a synthesised (faux-bold) weight.
- A user with the font file missing or not yet built still sees readable headings in the
  existing serif stack, because `--font-display` retains `ui-serif, Georgia, "Iowan Old
  Style", "Times New Roman", serif` after `"Fraunces"`.
- A user on a machine with no internet connection sees Fraunces render normally, because
  the file is served from the same origin as the page.
- A user loading the page sees heading text immediately in the fallback face and then
  swapping to Fraunces, never invisible text, because `font-display: swap` is set.
- A user switching between light, dark, and explicitly-set themes sees Fraunces in all
  three, because the three theme override blocks (`styles.css:41-76`, `77-88`, `89-100`)
  redefine colours only and never `--font-display`.
- Body text and monospace text are visually unchanged.

**Out of scope:**

- Any change to `--font-body` or `--font-mono`.
- Any change to page markup (`index.html`, `board.html`), to any `.ts` file other than the
  `MIME` map in `src/server.ts`, or to app behaviour.
- Adding `Cache-Control` headers. The server sets none today; that is existing behaviour
  and Context excludes it.
- Adding a Content-Security-Policy. None exists, and self-hosting introduces no external
  origin that would need one.
- Fraunces `SOFT` and `WONK` optical axes. The decided direction is plain Fraunces.
- Any redesign of heading sizes, spacing, or hierarchy beyond the two optional
  micro-adjustments listed under Open questions.

**Assumptions (stated, not confirmed by the user):**

1. The font file is committed to the repository as a vendored binary asset. `dist/` is
   gitignored, so the source of truth must live under `src/public/`. About 67KB of binary
   in git history is accepted.
2. The file name is `fraunces-latin.woff2` and it lives in a new `src/public/fonts/`
   directory. The name is a convention choice, not load-bearing; only `@font-face` and the
   copy manifest refer to it.
3. The Open Font License text is committed alongside the font as
   `src/public/fonts/OFL.txt`. Redistributing an OFL font normally requires shipping the
   licence and copyright notice with it. It is not served or referenced by any page.
4. The requested weight range is `600 700`, covering every weight the 13 call sites
   actually use. Nothing in the app requests a display weight outside that range.
5. The latin subset alone is sufficient for the current content. See Open questions for
   latin-ext.
6. There is no release or deployment constraint to satisfy: this is a local developer
   tool with no production deployment, no live users, and no persisted data touched by the
   change. Each phase leaves the app fully working, so no feature flag is needed.

## Design

### The asset

One file: `src/public/fonts/fraunces-latin.woff2`.

Obtain it by requesting Google's own CSS for the wanted axes and downloading the `woff2`
it points at:

```
https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600..700&display=swap
```

Requesting only `opsz` and `wght` leaves `SOFT` and `WONK` at their defaults of 0, which is
plain Fraunces — exactly the decided direction, and it avoids the larger full-axis
variable download. Google returns the same `woff2` regardless of how the weight sub-range
is narrowed; only the `font-weight` descriptor in its CSS differs, so there is no byte
saving from narrowing further. Take the `latin` block's URL.

This download is a one-time manual acquisition step, not a build step. Nothing in the build
chain reaches the network, before or after this change.

### The CSS contract

Two edits in `src/public/styles.css`, both in the first `:root` region and its
surroundings:

```css
@font-face {
  font-family: "Fraunces";
  src: url("fonts/fraunces-latin.woff2") format("woff2");
  font-weight: 600 700;
  font-style: normal;
  font-display: swap;
}
```

```css
--font-display: "Fraunces", ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif;
```

Notes that make this contract correct rather than merely plausible:

- The `src` URL is relative to the stylesheet. The stylesheet is served from
  `dist/public/styles.css`, so it resolves to `/fonts/fraunces-latin.woff2`.
- `font-weight: 600 700` is a range descriptor, correct for a variable font. It tells the
  browser this one file covers both weights, so the browser never synthesises bold.
- `font-display: swap` is chosen over `optional`, which can skip the webfont entirely on a
  slow first load — unacceptable when the whole point of the change is the typeface.
- `font-optical-sizing: auto` is added as one declaration on the existing `body` rule
  (`styles.css:104-111`). It is the browser default, so it changes nothing functionally; it
  is written down because Fraunces carries `opsz 9..144` and the display headings span
  11.5px to 30px, and the declaration records that the automatic behaviour is intended.
- **Hard constraint:** do not add `font-variation-settings: "wght" …` at any call site.
  That would disable automatic optical sizing and duplicate what `font-weight` already
  does. The 13 selectors keep their existing numeric `font-weight` untouched.
- The `@font-face` block goes at the top of the file, above the first `:root`, so it is not
  buried inside a themed block.

### The build contract

`tools/copy-assets.mjs:15-18` copies a hardcoded flat list into `dist/public/`. It calls
`fs.copyFileSync` with no directory creation beyond the top-level `mkdirSync` at line 12,
so a nested destination path currently fails. The fix keeps the existing explicit-manifest
convention and adds the one missing capability:

```js
for (const name of ['index.html', 'board.html', 'styles.css', 'fonts/fraunces-latin.woff2']) {
  const dest = path.join(distPublic, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(srcPublic, name), dest);
  console.log(`copied ${name}`);
}
```

The manifest stays an explicit list, which is what the file already is and what makes it
obvious that `app.ts`, `home.ts`, and `tsconfig.json` are deliberately not copied.

### The serving contract

`src/server.ts:319-320` looks the extension up in `MIME` and falls back to
`application/octet-stream`. Add one entry to the map at lines 15-22:

```ts
'.woff2': 'font/woff2',
```

Browsers ignore the `Content-Type` when loading a font through `@font-face`, so this is
correctness rather than a functional requirement — but it is a one-line, additive change
with no consumer that could break.

The path-traversal guard at `src/server.ts:297` is `filePath.startsWith(root)`, and
`path.join(root, '/fonts/x.woff2')` stays inside `root`, so a subdirectory under
`dist/public/` is served without any change to the guard.

### What knows about what

- `styles.css` is the only file that knows the font's family name, weight range, and
  loading strategy.
- `copy-assets.mjs` knows only a file path. It has no opinion about fonts.
- `server.ts` knows only that `.woff2` maps to a MIME string. It has no font logic.
- No TypeScript in `src/public/` learns anything about fonts. No page markup changes.

## Staged task breakdown

Phase 1 delivers the riskiest part first — the build and serving pipeline, which is where
Context found the real gap — and it is independently shippable because it changes nothing
visible.

### Phase 1 — Vendor the asset and make the pipeline carry it

**Effort:** small. **Depends on:** nothing.

- Download the `latin` `woff2` from the Google CSS URL above into
  `src/public/fonts/fraunces-latin.woff2`.
- Add `src/public/fonts/OFL.txt` (assumption 3; drop this step if the user rejects it).
- Extend the loop in `tools/copy-assets.mjs` as shown in Design, adding the per-file
  `mkdirSync` and the new manifest entry.
- Add `'.woff2': 'font/woff2'` to the `MIME` map in `src/server.ts`.

**Files touched:** `src/public/fonts/fraunces-latin.woff2` (new),
`src/public/fonts/OFL.txt` (new), `tools/copy-assets.mjs`, `src/server.ts`.

**Verify:**
- `npm run build` succeeds and prints `copied fonts/fraunces-latin.woff2`.
- `dist/public/fonts/fraunces-latin.woff2` exists and matches the source file's byte size.
- With `npm start` running, `curl -sI http://localhost:4173/fonts/fraunces-latin.woff2`
  returns `200` and `Content-Type: font/woff2`.
- The home page and a board still render exactly as before — nothing references the font
  yet.

### Phase 2 — Declare the face and switch `--font-display`

**Effort:** small. **Depends on:** Phase 1 (the file must be reachable, or every heading
silently stays on Georgia and the phase cannot be verified).

- Add the `@font-face` block at the top of `src/public/styles.css`.
- Prepend `"Fraunces"` to `--font-display` at line 33, keeping the whole existing tail.
- Add `font-optical-sizing: auto;` to the `body` rule.

**Files touched:** `src/public/styles.css`.

**Verify:**
- `npm run build && npm start`, then open the home page: the network panel shows
  `fraunces-latin.woff2` fetched once with status 200.
- In DevTools, the Computed panel for `.masthead h1` lists Fraunces as the rendered font,
  and the Fonts pane reports it as a network resource, not a synthesised fallback.
- `.masthead .mark` at weight 700 and `.masthead h1` at weight 600 are visibly different
  weights, confirming the variable range works from one file.
- Temporarily rename `dist/public/fonts/` and reload: headings fall back to the serif
  stack and the page is fully readable. Restore it afterwards.

### Phase 3 — Visual sweep of all 13 call sites

**Effort:** medium. **Depends on:** Phase 2.

Walk every `--font-display` site and confirm nothing clips, overflows, or wraps badly now
that glyphs are wider than Georgia at the same size. The sites, with their line numbers in
`src/public/styles.css`:

`.masthead h1` (128), `.masthead .mark` (144), `.kpi .kpi-value` (192), `.panel h2` (375),
`.load-state h2` (434), `.home-heading` (465), `.tile-name` (567), `.tiles-empty h3` (594),
`.ws-modal-title` (676), `.ws-section-title` (768), `.ws-plan h4` (894), `.ws-plan h5`
(901), `.ws-plan h6` (908).

Give extra attention to the constrained ones: `.masthead h1` uses `text-wrap: balance` and
sits in a flex row that wraps; `.kpi .kpi-value` at 30px sits in a fixed KPI tile;
`.tile-name` sits in a tile grid; `.ws-modal-title` uses `overflow-wrap: anywhere` inside
the modal header; `.ws-plan h6` at 11.5px is the smallest display text in the app and is
where optical sizing matters most.

Check each in light and dark themes, and at a narrow window width where the masthead and
tile grid reflow.

**Files touched:** none expected. Any fix is one of the Open questions and needs the
user's call first.

**Verify:** a completed pass over the 13 sites in both themes with no clipped, overlapping,
or overflowing heading. Record anything that looks wrong rather than fixing it ad hoc.

## Data & compatibility

- No data model, no API contract, no persisted state, and no client contract changes. The
  extraction pipeline, the `/api/` routes, and `.praxis-projects.json` are untouched.
- No migration of any kind.
- Backward compatibility for a stale `dist/`: a build that predates Phase 1 has no font
  file. If such a `dist/` were paired with the new `styles.css`, the `@font-face` request
  would 404 and headings would render from the fallback tail — degraded, never broken.
  Since `npm start` always builds first (`prestart` in `package.json`), this state is hard
  to reach in practice.
- Rollback: revert the `styles.css` change alone and every heading returns to the current
  serif stack immediately, with the unused font file and MIME entry left harmlessly in
  place. Reverting all three files restores the exact prior state. The change is fully
  reversible at every phase, and no phase creates anything that cannot be undone by
  `git revert`.
- The `@font-face` and the `font-weight` range descriptor are supported by every browser
  that already runs this dashboard's ES-module client code. No new browser floor.

## Testing strategy

The repository has no test framework and no `test` script in `package.json`. This plan does
not introduce one — a font swap is not the right reason to stand up a test harness, and
doing so would be scope creep.

Verification is therefore the build plus manual observation, exactly as each phase's
Verify block specifies:

- **Phase 1 — build and transport.** Mechanical and objectively checkable: the file exists
  in `dist/`, the server returns 200 with the right MIME. These are the only steps in this
  feature that can fail silently, which is why they come first and are verified by command
  rather than by eye.
- **Phase 2 — loading and weight resolution.** Checked in DevTools, not by eyeball: the
  rendered-font readout and the network entry prove the file loaded, and the two-weight
  comparison proves the variable range resolved. The deliberate fallback test (rename the
  font directory) proves the resilience acceptance criterion, which is otherwise never
  exercised.
- **Phase 3 — visual regression.** Manual, against the enumerated 13-site checklist in two
  themes and two widths. There is no snapshot tooling in this project and adding one is out
  of scope.

If a later pass adds a test framework, the only mechanically testable assertions here are
Phase 1's: `copy-assets.mjs` places the font in `dist/public/fonts/`, and the `MIME` map
resolves `.woff2`. Record that as a note for a future write-tests pass, not as work here.

## Open questions

1. **Latin-ext subset.** The plan ships the `latin` subset only, per Context. Workstream
   titles and project names come from arbitrary user projects, so an accented character in
   a heading would render in Georgia while its neighbours render in Fraunces — a visible
   mixed-font glyph. *Options:* (a) ship `latin` only, accept per-glyph fallback; (b) also
   download the `latin-ext` `woff2` and add a second `@font-face` with Google's own
   `unicode-range`, costing one more file and one more manifest entry, with no design
   change. *Recommendation:* (a) now, since Context states a single file, and (b) as a
   trivial follow-on if a real project name exposes the problem.

2. **`size-adjust` on the `@font-face`.** Fraunces is wider and heavier per glyph than
   Georgia at the same size, so headings will grow somewhat. `size-adjust` can pull them
   back toward the current metrics. *Options:* (a) omit it; (b) tune a percentage after
   seeing Phase 3. *Recommendation:* (a). The visual change is the point of the feature,
   and `size-adjust` mainly reduces the fallback-to-webfont swap jump, which is a
   sub-second, first-load-only effect on a local-only app. Revisit only if Phase 3 finds a
   heading that actually clips.

3. **`.masthead h1` letter-spacing.** It carries `letter-spacing: 0.2px`
   (`styles.css:132`), tuned for the current stack. *Options:* (a) leave it; (b) reduce or
   remove it after seeing Fraunces at 30px. *Recommendation:* leave it and decide from the
   Phase 3 sweep. Context explicitly marks this as the plan author's judgement and not a
   requirement, so it is recorded here rather than planned as work.

4. **Committing the OFL text** (assumption 3). *Options:* (a) commit
   `src/public/fonts/OFL.txt` alongside the font; (b) omit it. *Recommendation:* (a) — it
   is standard practice for a redistributed OFL font and costs one text file. Confirm, since
   Context named only the font asset itself.

5. **Committing a binary to git** (assumption 1). There is no alternative that keeps the
   app offline-capable and dependency-free, so this is a notification rather than a real
   choice — but the user should know roughly 67KB of binary enters the repository
   permanently.

*Questions that would have been asked at intake and were answered by assumption instead:*
whether there is any deployment, release, or rollback constraint (assumed none — local
developer tool, no production, no live users), and whether the app must stay shippable
mid-feature (assumed yes, and every phase satisfies it anyway).

## Alternatives considered and rejected

- **Google Fonts `<link>` or `@import`.** Rejected. It is the least work, but it makes a
  deliberately local-first app depend on the internet for its own appearance: the
  dashboard binds `127.0.0.1`, reads the local filesystem, has zero runtime dependencies,
  and today references no external asset at all. Offline, every heading would silently
  fall back. It would also introduce the first third-party origin in the app, and the
  first privacy-relevant outbound request.

- **The full Fraunces variable font, all axes.** Rejected. It carries `SOFT` and `WONK`,
  which the decided direction explicitly does not want, and is a larger download for
  capability that will never be used. YAGNI.

- **Static instances — one `woff2` for weight 600 and another for 700.** Rejected. Two
  files and two `@font-face` blocks instead of one, more bytes in total, and it forfeits
  the automatic optical sizing across the 11.5px-to-30px range that made the variable font
  the right choice.

- **Rewriting `copy-assets.mjs` to copy `src/public/` recursively with an exclusion list.**
  Rejected. It would silently start copying anything dropped into `src/public/`, including
  `app.ts`, `home.ts`, and `tsconfig.json`, which are deliberately excluded today. The
  explicit manifest is the existing convention, and one added entry is the smaller,
  clearer change.

- **Copying the font with `fs.cpSync(srcFonts, distFonts, { recursive: true })`.**
  Rejected. It would auto-carry future font files, but `fs.cpSync` was still flagged
  experimental on Node 18, which `package.json` declares as the floor. `copyFileSync` plus
  `mkdirSync` is stable everywhere and just as short.

- **Applying Fraunces globally instead of only to `--font-display`.** Rejected. It is not
  what was asked, and Fraunces is a display serif that would hurt readability in the dense
  12px body and card text. Body and monospace text stay as they are.

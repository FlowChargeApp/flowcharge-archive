---
id: PLN-15-1p9wf2
type: plan
workstream: WS-22-hwt503
slug: project-tile-icon-buttons
title: "Icon-only Rename and Delete buttons at the top right of each project tile"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: []
links: []
---

# Icon-only Rename and Delete buttons at the top right of each project tile

## Summary

On the home page each project tile shows a Rename button and a Delete button as text
words, in a `div.tile-actions` row below the tile link. This plan replaces the two words
with Lucide icons — `square-pen` for rename, `trash-2` for delete — and moves the pair to
the top right corner of the tile, always visible.

The chosen approach draws both icons as inline SVG built in JavaScript, through a new
namespace-aware helper that sits beside the existing `el()` helper in
`src/public/home.ts`. The move to the corner is pure CSS in `src/public/styles.css`:
`position: relative` on `.tile`, `position: absolute` on `.tile-actions`, and a reserved
gutter through `padding-right` on `.tile-link`.

Two files change. No dependency, no icon font, no sprite, no content delivery network. No
change to the server, to `/api/projects`, to the project registry, or to the board cards.

## Scope

### Acceptance criteria

1. Each project tile shows exactly two buttons at its top right corner. They are visible
   at all times, with no hover needed.
2. The rename button shows the Lucide `square-pen` glyph and no text. The delete button
   shows the Lucide `trash-2` glyph and no text.
3. Both icons are real inline SVG in the rendered page. They inherit the button's colour,
   so they change with the light theme, the dark theme, and the hover state.
4. Each button keeps `type="button"` and its existing `aria-label` (`Rename <name>` and
   `Delete <name>`), and gains a `title` with the same text.
5. Each SVG carries `aria-hidden="true"` and `focusable="false"`, so a screen reader reads
   the label only, and the SVG never takes a tab stop.
6. Each button's hit target is at least 24 by 24 CSS pixels, which meets WCAG 2.2 target
   size. The plan uses 26 by 26.
7. The project name, the path, and the "Added" line never run under the buttons, on one
   line or on a wrapped second line.
8. Clicking rename still opens the inline edit row. The Save and Cancel buttons inside
   that row keep their text words and their present size.
9. Clicking delete still shows the confirm dialog and still removes the tile.
10. The tile error line, the tile hover border, and the focus ring on each control behave
    exactly as they do today. The focus ring is not clipped at the tile corner.
11. Both TypeScript projects still type-check, and `npm run build` still succeeds.

### Out of scope

- Icons anywhere else in the application.
- A shared icon module for future reuse.
- Any change to the board cards, to `board.html`, or to `app.ts`.
- Any change to the add-project form.
- Hover-reveal behaviour or a tooltip component.
- Any new custom property in `:root`.
- Any dependency.
- Any refactor of `renderTiles` beyond what these two buttons need.
- Widening the `#project-tiles` minimum column from 280px. See Open questions.

### Assumptions

These are decisions taken here, not requirements from the user. Each one names what breaks
if it is wrong. All of them are cheap to change after the fact, and none of them blocks
the work.

1. **Icon stroke width is `2`.** That is Lucide's own default, and the icons are drawn for
   it. The single existing SVG in the project, the search icon at `src/public/board.html`
   line 46, uses `2.4` at 13 pixels. If `2` reads too light next to that icon, change one
   attribute value.
2. **Icon box is 14 by 14 pixels, inside a 26 by 26 pixel button.** If the glyph looks
   small in the box, change two attribute values.
3. **The buttons sit at `top: 10px; right: 10px`** inside the tile. That is an inset
   corner, slightly tighter than the tile's own `14px 16px` padding. If the user prefers
   the buttons flush with the text column, change two CSS values.
4. **The gutter is 60 pixels of `padding-right` on `.tile-link`.** The arithmetic is in
   Design. If it is too small the name touches the buttons; if too large the name column
   is needlessly narrow.
5. **The Lucide path data is transcribed by hand into the source.** The icons are static
   art, so a wrong `d` string produces a wrong-looking glyph and nothing else. Phase 1
   verifies each glyph by eye against lucide.dev.
6. **Deployment has no constraints.** This is a local, single-user, read-only dashboard
   that binds `127.0.0.1`. There is no production data, no live user, no migration, and no
   feature flag. The application stays shippable after every phase. Rollback is
   `git revert`.

## Design

### Where the change lands

Two files, and only these two:

- `/Users/akoukoullis/Work/AK/Praxis-Dashboard/src/public/home.ts`
- `/Users/akoukoullis/Work/AK/Praxis-Dashboard/src/public/styles.css`

`src/public/index.html` holds only `<div id="project-tiles"></div>` at line 23. Every tile
is built in JavaScript, so the markup change is entirely in `home.ts`.

### The markup today

`renderTiles` at `src/public/home.ts` lines 27-180 builds each tile as a `div.tile` with
three flow children, in order:

1. `a.tile-link` at lines 45-51, holding `span.tile-name`, `span.tile-path` and
   `span.tile-added`.
2. `div.tile-actions` at lines 53-62, holding two `button.tile-action`, rename then delete.
3. `div.tile-error` at lines 64-65.

A fourth child, `div.tile-edit`, is inserted between the link and the actions by
`tile.insertBefore(row, actions)` at line 143, and removed by `exitEditMode` at lines
77-82.

The tile is a `div` and not an `a` on purpose. The comment at lines 40-41 records why: a
button cannot sit inside a link. The buttons must therefore stay siblings of `a.tile-link`,
never children of it. Absolute positioning does not change that constraint.

### The SVG contract

The `el()` helper at lines 5-10 calls `document.createElement`, which cannot create an SVG
element. It returns an `HTMLUnknownElement` that never renders. A grep for
`createElementNS` across `src/` and `tools/` returns nothing today, so this is new ground
in this repository.

Add one helper immediately after `el()`, with the two icon path arrays beside the existing
string constants at lines 2-3. The helper's public shape:

```ts
// document.createElement cannot make an SVG element: it returns an HTMLUnknownElement
// that never renders. Every node in an SVG subtree needs createElementNS.
function iconSvg(paths: string[]): SVGSVGElement
```

The helper builds one `<svg>` and one `<path>` per entry in `paths`. It sets every
attribute through `setAttribute`, because SVG attributes are not DOM properties. `viewBox`
is case-sensitive and must be spelled exactly that way.

Attributes on the `<svg>`:

| Attribute | Value | Why |
|---|---|---|
| `width`, `height` | `14` | Literal pixels, matching the file's convention |
| `viewBox` | `0 0 24 24` | Lucide's grid, same as the board search icon |
| `fill` | `none` | Same as the board search icon |
| `stroke` | `currentColor` | Inherits `.tile-action`'s `color`, so both themes and the hover state work with no new colour literal |
| `stroke-width` | `2` | Lucide default. See Assumption 1 |
| `stroke-linecap` | `round` | Lucide default. Without it `trash-2` and `square-pen` look sharp-cornered |
| `stroke-linejoin` | `round` | Same reason |
| `aria-hidden` | `true` | The button's `aria-label` is the accessible name |
| `focusable` | `false` | Stops a stray tab stop in older engines |

No `xmlns` attribute, matching the board search icon. The namespace comes from
`createElementNS`, not from an attribute.

**TypeScript gotcha.** `document.createElementNS` returns `SVGSVGElement` and
`SVGPathElement` only when the namespace argument is the string *literal*
`'http://www.w3.org/2000/svg'`, because the typed overload keys on that literal. Storing
the namespace in a plain `var` widens its type to `string`, the overload no longer matches,
and the call returns `Element`. Write the literal inline at each call site, or the
annotated return type fails `tsc`.

### The icon path data

Both icons are drawn with `<path>` elements only. Lucide's current `trash-2` uses two
`<path>` elements for the bin's inner strokes where an older version used `<line>`, so the
helper never needs a second element type. That keeps the helper as small as the job needs.

`square-pen`:

```
M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7
M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z
```

`trash-2`:

```
M10 11v6
M14 11v6
M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6
M3 6h18
M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2
```

Phase 1 checks each glyph by eye against lucide.dev before the phase is called done. See
Assumption 5.

### The button changes in `renderTiles`

At lines 54-59, each button loses its text argument and gains an icon child and a `title`:

- `el('button', 'tile-action')` with no third argument, so `textContent` stays empty.
- `renameButton.appendChild(iconSvg(SQUARE_PEN_PATHS))`.
- `renameButton.title = 'Rename ' + p.name;` beside the existing `aria-label`.
- The same three changes for the delete button, with `TRASH_2_PATHS`.

`type = 'button'` and both `aria-label` calls stay exactly as they are. Nothing else in
`renderTiles` changes. The Save and Cancel buttons at lines 94-99 are not touched.

### The CSS changes

All in `src/public/styles.css`. Line numbers are current as of this plan.

**1. `.tile` at line 479** — add `position: relative;`.

Do **not** add `overflow: hidden`. `.tile-action:focus-visible` at line 518 uses
`outline-offset: 2px`, and a clipped corner outline would fail acceptance criterion 10.

**2. `.tile-actions` at lines 502-507** — replace the rule body:

```css
.tile-actions {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
}
```

`margin-top: 6px` goes, because an absolutely positioned box is out of flow and the margin
does nothing useful. `flex-wrap` becomes `nowrap`, so the pair never stacks.

**3. `.tile-link` at lines 492-500** — add `padding-right: 60px;`.

The gutter must be on the link, not on `.tile-name`. Two reasons. A wrapped name's second
line would still slide under the buttons if only the name carried the padding. And
`exitEditMode` sets `nameSpan.style.display = 'none'` at line 142, which promotes
`.tile-path` to the top line, so the gutter cannot depend on the name being present.

**4. A new rule, immediately after `.tile-action:focus-visible` at line 518:**

```css
/* Icon-only buttons. Scoped to .tile-actions so the text Save and Cancel buttons,
   which live in .tile-edit and share the .tile-action class, keep their word size. */
.tile-actions .tile-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
}
```

Everything else — border, radius, background, colour, cursor, the hover at line 517 and
the focus ring at line 518 — is inherited from `.tile-action` at lines 508-516 and is not
duplicated.

Specificity: `.tile-actions .tile-action` scores 0,2,0 and beats the plain `.tile-action`
at 0,1,0. `.tile-edit .tile-action` at line 542 also scores 0,2,0, but the two selectors
never match the same element, because the Save and Cancel buttons live inside
`div.tile-edit` and the icon buttons live inside `div.tile-actions`.

26 by 26 is the size already used by `.ws-modal-close` at lines 670-681, the closest
precedent in the file, and it clears the WCAG 2.2 minimum of 24 by 24.

### The gutter arithmetic

`* { box-sizing: border-box; }` at line 102, so the grid's `minmax(280px, 1fr)` at line 473
is a border box.

Measured leftward from the tile's inner border edge:

- 0 to 10px: the `right: 10px` offset.
- 10 to 68px: the two 26px buttons plus the 6px gap.
- The link's content right edge sits at 16px, from the tile's `padding: 14px 16px`.

So the buttons intrude 68 − 16 = 52px into the link's content area. A `padding-right` of
52px clears them exactly; 60px adds 8px of visual breathing room.

At the 280px minimum column: 280 − 2 (border) − 32 (padding) = 246px of content, minus the
60px gutter leaves 186px for the name, the path and the "Added" line. `.tile-path` at line
556 carries `overflow-wrap: anywhere`, so a long absolute path wraps onto more lines than
it does today. That is the real, accepted cost of the gutter. See Open question 1.

`.tile-edit` sits outside `.tile-link` and keeps the full content width, so the inline
rename row is unaffected.

### Behaviour that must not break

Each of these is checked in Phase 3.

1. `tile.insertBefore(row, actions)` at line 143 still works with the actions out of flow.
   `insertBefore` is a DOM operation and does not care about the CSS position of its
   reference node.
2. `.tile-edit .tile-action` at line 542 must keep matching the Save and Cancel buttons
   after the new selector lands.
3. `nameSpan.style.display = 'none'` shortens the link, which is why the gutter is padding
   and not a top margin.
4. `.tile-error` stays the last flow child, and is unaffected.
5. `.tile:has(.tile-link:hover)` at line 491 is unaffected. Hovering a button does not
   highlight the card border. That is the behaviour today and it stays.
6. No `overflow` is added to `.tile`.
7. The buttons stay siblings of `a.tile-link`. Moving them inside it would be invalid HTML.

### Non-functional notes

- **Security.** No new input, no new network call, no new server surface. The icon path
  data is a static literal in the source and never comes from project data. The existing
  comment at line 91, which records that a project name goes in through `.value` and never
  through `innerHTML`, still holds: this plan adds no `innerHTML` use.
- **Performance.** Two extra SVG subtrees, seven `<path>` elements in total, per tile. On a
  list of local projects this is not measurable.
- **Observability.** None needed. This is a local single-user page, and the change is
  visual only.

## Staged task breakdown

### Phase 1 — Draw the icons, keeping the row where it is

**Build.** Add the `iconSvg` helper and the two path-data constants to
`src/public/home.ts`. Swap both buttons from text to icon, add the `title` on each, and
keep both `aria-label` calls. Change no CSS.

**Files.** `src/public/home.ts`.

**Effort.** Small.

**Depends on.** Nothing.

**Verify.**
- `npx tsc --noEmit -p src/public/tsconfig.json` passes. This is where the
  `createElementNS` literal-type gotcha shows up.
- `npm run build`, then `grep -c createElementNS dist/public/home.js` returns a non-zero
  count.
- On the running page, each tile shows two icon buttons below the link, where the words
  were. The glyphs render — an `HTMLUnknownElement` would leave the buttons blank, so a
  blank button is the failure signal.
- Each glyph matches its Lucide reference at lucide.dev by eye.
- Hovering a button turns the glyph the accent colour, which proves `currentColor` is
  wired.

This phase is deliberately first, because the SVG namespace work is the only part of the
feature that can fail silently, and it is easier to see while the buttons are still in
normal flow.

### Phase 2 — Move the pair to the top right corner

**Build.** The four CSS edits described in Design: `position: relative` on `.tile`, the
rewritten `.tile-actions`, `padding-right: 60px` on `.tile-link`, and the new
`.tile-actions .tile-action` rule.

**Files.** `src/public/styles.css`.

**Effort.** Small.

**Depends on.** Phase 1.

**Verify.**
- `npm run build`, so `tools/copy-assets.mjs` copies the stylesheet into `dist/public/`.
  Nothing is visible before that.
- On the running page, both buttons sit at the top right of every tile and are visible
  with no hover.
- The project name does not run under the buttons, on a short name or on a name long
  enough to wrap.
- Save and Cancel in the rename row are still text words at their present size.

### Phase 3 — Cross-state verification

**Build.** Nothing. This is the verification pass, and it is a separate phase because the
repository has no test framework and no lint script, so looking at the page *is* the test
suite.

**Files.** None.

**Effort.** Small.

**Depends on.** Phase 2.

**Verify.** Walk this list on the running page:

1. Both TypeScript projects type-check: `npx tsc --noEmit -p tsconfig.json` and
   `npx tsc --noEmit -p src/public/tsconfig.json`.
2. Narrow the window until the grid hits its 280px minimum column. Both buttons stay on
   one line. The name does not collide with them. Note how far the path now wraps, which
   is the cost recorded in Open question 1.
3. Light theme and dark theme. The glyphs follow `--ink-soft` and turn `--accent` on hover
   in both.
4. Tab through a tile. Order is link, rename, delete. Each focus ring is fully visible and
   is not clipped at the tile corner.
5. Click rename. The name hides, the edit row appears between the link and the corner
   buttons, and the icons stay in the corner. Escape and Cancel both restore the name.
6. Save a rename. The tile list re-renders and the icons are still correct.
7. Trigger a tile error, for example by renaming to an empty name. The error line still
   appears at the bottom of the tile and does not overlap the buttons.
8. Click delete, then cancel the confirm dialog, then confirm it. Both paths behave as
   before.
9. Hover a button. The card border does not change, which matches today's behaviour.
10. Inspect a button in the browser tools. The SVG carries `aria-hidden="true"` and
    `focusable="false"`, and the button carries both `aria-label` and `title`.

## Data & compatibility

- **Migrations.** None. This change touches no data.
- **Data model.** Unchanged. `ProjectEntry` and `ProjectList` are untouched.
- **API.** Unchanged. `/api/projects`, its `PATCH` and its `DELETE` are untouched.
- **Registry.** `.praxis-projects.json` is untouched.
- **Backward compatibility.** Nothing consumes the tile markup other than the page itself.
  The class names `tile`, `tile-link`, `tile-actions`, `tile-action`, `tile-edit` and
  `tile-error` all survive with the same meanings.
- **Build.** `home.ts` compiles to `dist/public/home.js`, and `styles.css` is copied to
  `dist/public/styles.css` by `tools/copy-assets.mjs`. Nothing is visible until
  `npm run build` runs. A stale `dist/` shows the old text buttons and is not a bug.
- **Rollback.** `git revert` of the two file changes, then `npm run build`. There is no
  partial state to unwind and no persisted state to repair. Rollback is available after
  any phase.

## Testing strategy

The repository has no test framework and no lint script. `package.json` defines only
`build`, `prestart`, `start`, `prerefresh` and `refresh`. This plan does not introduce a
test framework, because Context does not ask for one and a framework is a dependency
decision far larger than the feature.

Verification is therefore four things, and they are already written into the phases above:

- **Type checking**, both projects: `npx tsc --noEmit -p tsconfig.json` and
  `npx tsc --noEmit -p src/public/tsconfig.json`.
- **The build**: `npm run build`.
- **Grep on the build output**, to confirm the new code actually reached `dist/`.
- **Looking at the running page** in the states listed in Phase 3.

If a test pass is wanted later, the natural unit is `iconSvg` — it is a pure function from
a path array to a DOM node. That is a separate decision and a separate skill.

## Open questions

Only one item is genuinely the user's to settle. Everything else is recorded as an
assumption above, with a stated default, so no phase in this plan rests on an unanswered
question.

1. **The 60px gutter narrows the text column at the smallest grid width, so a long
   absolute project path wraps onto more lines than it does today. Is that acceptable?**
   - Option A, accept it. The tile grows a little taller only in the narrowest column, and
     the buttons are always reachable. **Recommended**, because it is the only option
     inside the scope Context set.
   - Option B, raise `#project-tiles` from `minmax(280px, 1fr)` to about `minmax(300px,
     1fr)` at line 473, which buys back the 20px the gutter costs. This changes the grid
     for every tile and is a layout change Context did not ask for, so it is out of scope
     unless the user asks for it.
   - If the answer is A, which the plan assumes, nothing changes. If the answer is B, it is
     a one-value edit in Phase 2.

## Final summary

- **Approach.** Inline SVG built with `document.createElementNS`, through one new helper
  beside `el()` in `src/public/home.ts`, plus absolute positioning of `.tile-actions` and a
  reserved `padding-right` gutter on `.tile-link` in `src/public/styles.css`.
- **Rejected.** An `innerHTML` icon string, because the file already records a preference
  against `innerHTML` and uses it only for clearing. An in-document `<symbol>` sprite with
  `<use>`, because Context bans a sprite and it still needs `createElementNS` anyway. A CSS
  `mask-image` data URI, because it moves the icon art into the stylesheet and abandons the
  `stroke="currentColor"` convention the one existing SVG in the project already sets.
- **Size.** Three phases, two files changed, all three phases small.
- **Top risks.** One, `document.createElement` cannot build SVG, and the failure is a
  silent blank button rather than an error — Phase 1 isolates and checks it. Two, the
  `.tile-action` class is shared with the text Save and Cancel buttons, so the icon rule
  must be scoped to `.tile-actions .tile-action`. Three, the gutter must sit on
  `.tile-link`, because `exitEditMode` hides the name and promotes the path to the top
  line.
- **Needs an answer.** Open question 1 only: accept the extra path wrapping at the 280px
  column, which the plan assumes, or widen the grid minimum, which is out of scope.

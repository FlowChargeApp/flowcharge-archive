---
id: PLN-55-a4xsr3
type: plan
workstream: WS-65-o96qgz
slug: modal-description-show-more
title: "Clamp the modal description to four lines with a measured Show more reveal"
status: done
created: 2026-08-23
updated: 2026-08-23
depends_on: []
links: []
---

# Clamp the modal description to four lines with a measured Show more reveal

## Summary

The workstream detail modal shows the full `description` in one `<p>`
(`src/public/board.html:120`). A long description pushes the tabs and the tab
body down. This plan clamps that paragraph to four lines with
`-webkit-line-clamp`, and adds a one-shot "Show more" button below it. The
button appears only when the text really overflows the clamped box.

The chosen approach keeps the clamp state in markup and CSS, and keeps the
measurement in a small new function that runs **after** `modal.showModal()`.
That is the decisive point of the design: `renderModalMeta()` runs at
`src/public/app.ts:997`, but `modal.showModal()` runs at
`src/public/app.ts:1016`. Until `showModal()` runs, the `<dialog>` has no
`open` attribute, so it is `display: none` and every height read returns 0.
Measuring inside `renderModalMeta()` as it stands today would always report
"no overflow", and the button would never appear.

A third change gives the pinned meta region its own scroll, so an expanded
description on a short viewport is reachable instead of clipped.

## Scope

### In scope — acceptance criteria

1. A workstream with a description of four lines or fewer shows the full text,
   with no "Show more" button and no visible clamp artefact (no ellipsis, no
   cut glyphs).
2. A workstream with a description longer than four lines shows exactly four
   lines, followed by a "Show more" button.
3. The "Show more" button uses the same visual style as the plan panel's
   existing button (`.ws-plan-more`, `src/public/styles.css:1067-1078`): quiet
   text button, `--ink-soft`, `--ink` on hover, 12.5px body font, accent focus
   ring.
4. A click on "Show more" reveals the whole description in place and hides the
   button. There is no collapse path and no second click behaviour.
5. Closing the modal and reopening the same workstream restores the clamped
   four-line state and shows the button again.
6. Opening a different workstream re-evaluates the button from that
   workstream's own text. A short description after a long one shows no button.
7. The description text is never truncated as a string and is never re-fetched.
   The full text is in the DOM at all times, and the reveal only removes a CSS
   class.
8. On a short viewport (about 600px tall) with an expanded long description,
   the whole description is reachable by scrolling, the tab strip stays
   visible, and the tab body still scrolls its own content.
9. The integrations modal (`src/public/index.html:59`) renders and behaves
   exactly as before.
10. `npm run build` passes with no TypeScript error.

### Out of scope

- The description field's character cap. It is untouched, in every layer.
- The Praxis skill-source repo. This change is Dashboard-only.
- Any change to `#ws-modal { padding: 0 }` (`src/public/styles.css:705-717`).
  That value is load-bearing for backdrop dismissal.
- Any change to the plan panel's own "Show more"
  (`appendPlanBody()`, `src/public/app.ts:782-812`). It is a template to copy,
  not a target to refactor.
- Scrolling the revealed text into view after the click.
- A collapse / "Show less" path.
- Any change to the poll (`pollOnce()`, `src/public/app.ts:1103`) or to
  `applyData()`.

### Assumptions (taken, not confirmed)

- **A1.** Four lines is a fixed count at every viewport width. There is no
  smaller count on a narrow window.
- **A2.** The app ships as a normal source change. There is no feature flag,
  no dark launch, and no staged rollout for a frontend-only visual change.
  The recent `FILTER_ROW_ENABLED` switch (commit 15efb36) was for an unfinished
  feature. This feature ships complete, so it needs no switch.
- **A3.** The runtime is Chromium, both in Electron and in the browser tab
  fallback. `-webkit-line-clamp` is safe there, and the codebase already relies
  on it in `.card-title` (`src/public/styles.css:371-380`).
- **A4.** The button carries no ARIA state. It matches the existing
  `.ws-plan-more` pattern, which has none. See Open questions, item 3.
- **A5.** No user data and no persisted state is involved, so there is no
  migration and no data risk.

## Design

### The three touched files and what each one owns

**`src/public/board.html`** owns the static shape and the default state.
Two edits inside `.ws-modal-meta` (line 115):

```html
<p id="ws-modal-description" class="ws-modal-description is-clamped" hidden></p>
<button type="button" id="ws-modal-description-more"
        class="ws-modal-description-more" hidden>Show more</button>
```

The clamp class is in the markup, so the clamped state is the document's
default. The script re-asserts it, but never has to add it for the first open.
The button is a sibling of the paragraph, not a wrapper child. This matches
`appendPlanBody()`, which appends its button to the section beside the body
root, not inside it (`src/public/app.ts:811`). No wrapper element is added:
`.ws-modal-meta` is already a column flex container with `gap: 6px`
(`src/public/styles.css:770-776`), so it lays the button under the paragraph
without help.

**`src/public/styles.css`** owns the clamp and the button's look. Three
additions and one grouped selector:

1. The clamp modifier, next to the existing `.ws-modal-description` rule at
   line 787:

   ```css
   .ws-modal-description.is-clamped {
     display: -webkit-box;
     -webkit-line-clamp: 4;
     -webkit-box-orient: vertical;
     overflow: hidden;
   }
   ```

   This is the same four-declaration set already used by `.card-title`
   (`src/public/styles.css:371-380`), so it is a repeat of a proven pattern,
   not a new technique. The declarations live in the modifier class only. The
   base `.ws-modal-description` rule keeps `margin`, `font-size`, `color` and
   `overflow-wrap`, so removing the class returns the paragraph to plain block
   flow with no other side effect.

2. The button style, added by extending the existing rule's selector list
   rather than by copying its declarations:

   ```css
   .ws-plan-more,
   .ws-modal-description-more { /* existing declarations, unchanged */ }
   .ws-plan-more:hover,
   .ws-modal-description-more:hover { color: var(--ink); }
   .ws-plan-more:focus-visible,
   .ws-modal-description-more:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
   ```

   One rule, one set of token values. Every token (`--ink-soft`, `--ink`,
   `--accent`, `--font-body`) is defined in `:root` with a
   `prefers-color-scheme: dark` override, so dark mode stays correct with no
   extra rule.

3. Two corrections for the new context, which the plan panel does not need:

   ```css
   .ws-modal-description-more {
     align-self: flex-start;
     margin-top: 0;
   }
   ```

   `align-self: flex-start` is required. A flex item stretches on the cross
   axis by default, so without it the button becomes full width and a click far
   to the right of the label still fires it. `margin-top: 0` removes the
   inherited 8px, because the parent's `gap: 6px` already supplies the spacing.

4. The meta region's own scroll (Phase 3):

   ```css
   #ws-modal-meta {
     max-height: 40vh;
     overflow-y: auto;
   }
   ```

**`src/public/app.ts`** owns the timing and the one-shot reveal. Three edits:

- Inside `renderModalMeta()` (line 942), in the branch that sets the
  description: re-add `is-clamped` to the paragraph and set the button's
  `hidden` to `true`. In the empty-description branch and in the `!w` branch:
  hide the button too. This is the reset that acceptance criteria 5 and 6
  require, and it holds no state variable of its own.

- A new function, placed beside `renderModalMeta()`:

  ```ts
  // Measurement only. It must run after modal.showModal(), because a <dialog>
  // without `open` is display:none and every height read returns 0.
  function syncDescriptionOverflow(): void {
    var descEl = byId('ws-modal-description');
    var moreEl = byId('ws-modal-description-more');
    if (descEl.hidden) { moreEl.hidden = true; return; }
    // The +1 absorbs sub-pixel rounding between the two integer readings. One
    // real extra line is a whole line-height, far above this tolerance.
    moreEl.hidden = descEl.scrollHeight <= descEl.clientHeight + 1;
  }
  ```

  It is called from `openModal()` on the line straight after
  `modal.showModal()` (`src/public/app.ts:1016`). `showModal()` sets the `open`
  attribute synchronously, and layout is computed on demand when `scrollHeight`
  is read, so the value is correct in the same task. No `requestAnimationFrame`
  and no `setTimeout` is needed.

  This function knows only two element ids and two height properties. It must
  NOT know what a workstream is, what the text says, or how long it is.

- One click listener, registered once at module setup beside the existing
  `byId('ws-modal-close')` listener (`src/public/app.ts:1088`):

  ```ts
  byId('ws-modal-description-more').addEventListener('click', function () {
    byId('ws-modal-description').classList.remove('is-clamped');
    (this as HTMLElement).hidden = true;
  });
  ```

  Registration happens once, not per open, because the button is static markup.
  This differs from `appendPlanBody()`, which builds a fresh button each render
  and can therefore attach a fresh listener. Registering per open here would
  stack listeners on every card click.

### Why the CSS uses the id, not the shared class

`.ws-modal-meta` is used by two different modals: the board's detail modal
(`src/public/board.html:115`, which also carries `id="ws-modal-meta"`) and the
integrations modal (`src/public/index.html:59`, which carries no id). This is
confirmed by reading both files. The integrations copy holds a segmented
scope control and a project `<select>` — nothing related to a description.

The scroll rule therefore uses `#ws-modal-meta`, the id that exists only in
`board.html`. Reasons:

- A `max-height` on the integrations header serves no purpose. That header has
  two short controls and can never overflow.
- `overflow-y: auto` there would create a new scroll container around a
  `<select>`, and an accent focus ring with `outline-offset: 2px` inside a
  scroll container can be clipped at the edge. That is a real, if small,
  regression for zero benefit.
- This feature has no mandate over the integrations modal. Reaching it with a
  bare class selector would be a silent scope widening.

The id rule is additive to the class rule, not a conflict, so the shared layout
declarations at `src/public/styles.css:770-776` stay in one place.

### Why `.ws-modal-body` needs no flex change

The concern raised at investigation was that a column flex item's automatic
minimum size (`min-height: auto`) would stop `.ws-modal-body` shrinking, so the
meta region could not grow. Reading the live CSS shows this does not apply.
`.ws-modal-body` already sets `overflow: auto` (`src/public/styles.css:821-825`).
Per CSS Flexbox, the automatic minimum size applies only to items whose
overflow is `visible`. With `overflow: auto` the item's minimum is zero, and it
already shrinks. This is also why the modal works correctly today on a short
viewport.

So the plan adds **no** `min-height: 0` and **no** `flex: 1` up front. Phase 3
carries an explicit check for it, and a named fallback if the check fails:
`.ws-modal-body { flex: 1 1 auto; min-height: 0; }`.

One CSS fact to expect during that phase: setting `overflow-y: auto` while
`overflow-x` stays `visible` makes the computed `overflow-x` become `auto`.
The meta region's children handle this already — `.card-tags` wraps, the
description sets `overflow-wrap: anywhere`, and the dates line is short — so a
horizontal bar is not expected. Phase 3 verifies it rather than assuming it.

### What does not change

`renderModalMeta()` still has exactly one call site
(`src/public/app.ts:997`), verified by grep. The poll (`pollOnce()`,
`src/public/app.ts:1103`) calls `applyData()`, which re-renders the board and
never touches the modal meta. So a live refresh cannot collapse a description
the user has just expanded. No guard is needed for that case.

## Staged task breakdown

### Phase 1 — Clamp the paragraph and place the button (small)

**Build.** Add `is-clamped` to the paragraph's class list and add the hidden
button after it in `src/public/board.html`. Add the `.is-clamped` clamp rule,
the grouped button selector, and the `align-self` / `margin-top` corrections in
`src/public/styles.css`.

**Files.** `src/public/board.html`, `src/public/styles.css`.

**Depends on.** Nothing.

**Verify.** Run `npm start`. Open a workstream whose description is longer than
four lines. The description shows exactly four lines. No button is visible yet,
because the button is still `hidden` in markup. Open a workstream with a short
description. The text renders in full with no visible cut.

### Phase 2 — Measure the overflow and wire the one-shot reveal (small)

**Build.** In `src/public/app.ts`: re-assert `is-clamped` and hide the button
in `renderModalMeta()`'s three branches; add `syncDescriptionOverflow()`; call
it directly after `modal.showModal()`; register the click listener once beside
the close-button listener.

**Files.** `src/public/app.ts`.

**Depends on.** Phase 1 (the class and the button must exist).

**Verify.** Run `npm run build`, which must pass with no TypeScript error.
Then, in the running app, check acceptance criteria 1, 2, 4, 5, 6 and 7 in
order:
- a long description shows four lines and the button;
- one click reveals the whole text and the button disappears;
- Escape, then reopen the same card — four lines and the button return;
- open a short-description card straight after a long one — no button;
- with DevTools, confirm the paragraph's `textContent` holds the whole string
  in the clamped state, which proves no string truncation happened.

### Phase 3 — Let the meta region scroll on a short viewport (small)

**Build.** Add `#ws-modal-meta { max-height: 40vh; overflow-y: auto; }` to
`src/public/styles.css`, below the existing `.ws-modal-meta` rule.

**Files.** `src/public/styles.css`.

**Depends on.** Phase 2 (an expanded description is needed to test it).

**Verify.** Set the window height to about 600px, then to about 450px. With a
long description expanded, check that:
- the whole description is reachable by scrolling inside the meta region;
- the tab strip stays visible and every tab still switches;
- the tab body still scrolls its own content;
- no horizontal scrollbar appears in the meta region;
- the meta region does not collapse to a sliver at 450px.

If the meta region collapses too far, or the tab body loses its scroll, apply
the named fallback `.ws-modal-body { flex: 1 1 auto; min-height: 0; }` and
re-run the same five checks. Finally open the integrations modal from the home
page and confirm it is unchanged.

## Data & compatibility

- **Data models.** None change. `description` is already extracted and already
  sent in the board payload. The server, `src/lib/extract.ts` and the shared
  types in `src/types/praxis-data.d.ts` are all untouched.
- **Migrations.** None. There is no stored state, no registry field, and no
  persisted "expanded" flag.
- **Backward compatibility.** The change is additive markup plus additive CSS
  plus three edits in one renderer. A stale cached `board.html` with a fresh
  `styles.css` shows an unclamped description and no button, which is exactly
  today's behaviour. A fresh `board.html` with a stale `styles.css` shows an
  unclamped description and a visible but harmless button after
  `syncDescriptionOverflow()` runs. Neither combination breaks the modal.
- **Other consumers.** `.ws-modal-meta`'s shared declarations are untouched, so
  the integrations modal in `src/public/index.html` is unaffected by design,
  not by luck.
- **Rollback.** Revert the three files. Nothing else has to be undone, because
  no data, no build config and no packaged artefact changes shape. Rollback is
  clean at every phase boundary and after full delivery.

## Testing strategy

The repository has no test runner. `package.json` declares no `test` script and
no test framework in `devDependencies`. So this plan states honest verification,
not a fictional suite.

- **Per phase.** The manual checks listed under each phase's "Verify" heading.
  They map one to one onto the acceptance criteria.
- **Compile check.** `npm run build` type-checks all three TypeScript projects
  and is the only automated gate that exists today. Phase 2 must pass it.
- **Later automated coverage.** If a DOM test harness is added to this project
  in future, the two behaviours worth covering are (a)
  `syncDescriptionOverflow()` hiding the button when
  `scrollHeight <= clientHeight + 1`, and (b) `renderModalMeta()` re-adding
  `is-clamped` and re-hiding the button on every call. Both are pure DOM
  functions with no fetch. Adding that harness is a separate decision and is
  not part of this feature.

## Open questions

1. **The meta region's height cap.** The plan uses `max-height: 40vh`. The
   alternatives are a fixed pixel cap (predictable, but wrong on a very tall or
   very short screen) or no cap at all (the region grows until flex shrink
   forces it back). Recommendation: keep `40vh`, and change the number after
   seeing Phase 3's checks on a real screen. Tell me if you want a different
   value or no cap.
2. **Release timing.** This is a packaged Electron app with an update-check
   path (WS-59). The plan assumes an ordinary source change with no flag and no
   staged rollout (assumption A2). Confirm whether this must land in a named
   release, or whether it can ship on the next build like any other UI fix.
3. **Screen-reader announcement.** The plan gives the button no `aria-expanded`
   and no `aria-controls`, to match the existing `.ws-plan-more`
   (assumption A4). The button also disappears after one click, so an expanded
   state has nothing left to report. Recommendation: leave it as plain button
   text. Say so if you want the ARIA attributes added anyway.
4. **Clamp count on narrow windows.** The plan fixes the clamp at four lines at
   every width (assumption A1). On a narrow window four lines hold fewer words.
   Recommendation: keep four everywhere, because a width-dependent count needs
   a media query for a small gain. Tell me if you want a smaller count below a
   breakpoint.

## Alternatives considered and rejected

- **Measure inside `renderModalMeta()` with `requestAnimationFrame`.** This
  keeps all description logic in one function. Rejected: it defers the button's
  appearance to the next frame, so the button can flicker in after the modal is
  already visible. It also hides the real cause — the dialog is not open yet —
  behind a timer, which the next reader has to rediscover. The explicit call
  after `showModal()` states the dependency in the code's own order.
- **Move the whole `renderModalMeta()` call to after `showModal()`.** This is
  the smallest possible edit. Rejected: it makes one function responsible for
  both content and measurement, and it moves every meta field's render behind
  the dialog's opening for the sake of one height read. The narrow
  `syncDescriptionOverflow()` keeps the responsibilities apart.
- **A character-count heuristic instead of DOM measurement.** Cheap, and needs
  no timing fix at all. Rejected: it is wrong at both ends. A wide window fits
  far more characters in four lines than a narrow one, so the button would
  appear with no overflow and stay away when text is clipped. The workstream
  brief also asks for real measurement.
- **Wrap the paragraph and the button in a new container `<div>`.** This would
  let one `hidden` attribute control both. Rejected: it adds an element and a
  CSS rule to replace two `hidden` assignments the code already has to make,
  and `.ws-modal-meta`'s existing flex `gap` already positions the button
  correctly.
- **Reuse the `.ws-plan-more` class name on the new button.** Zero new CSS.
  Rejected: the class name says "plan", and its own comment in
  `src/public/styles.css:1064-1066` states that it lives beside `.ws-plan`
  inside `.ws-section`. Grouping the selectors keeps one set of declarations
  and one honest name for each place.
- **Apply the scroll fix with the bare `.ws-modal-meta` class.** One selector,
  and the behaviour might be harmless on the integrations modal. Rejected: it
  changes a modal this feature has no reason to touch, and it puts a focus ring
  with an outline offset inside a new scroll container for no gain.

## Final summary

- **Approach.** Clamp with a CSS modifier class that the markup carries by
  default, measure `scrollHeight` against `clientHeight` in a small function
  called right after `modal.showModal()`, and reveal with one static
  click listener that removes the class.
- **Size.** Three phases, all small. One sitting each, and about 40 lines of
  change in total across three files.
- **Top risks.** (1) The measurement timing — solved by the call site after
  `showModal()`, and it is the one thing to check first in Phase 2. (2) The
  short-viewport flex behaviour of the meta region, which needs real checks at
  600px and 450px, with a named fallback rule ready. (3) The shared
  `.ws-modal-meta` class, avoided by scoping the scroll rule to the
  `#ws-modal-meta` id.
- **Needs your answer.** The `40vh` cap value, the release timing, whether to
  add ARIA attributes to the button, and whether four lines is right at every
  window width.

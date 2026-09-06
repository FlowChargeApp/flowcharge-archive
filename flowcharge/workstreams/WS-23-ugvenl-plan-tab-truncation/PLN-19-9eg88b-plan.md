---
id: PLN-19-9eg88b
type: plan
workstream: WS-23-ugvenl
slug: plan-tab-truncation
title: "Truncate long plan bodies in the Plan tab behind a one-shot Show more button"
status: done
created: 2026-08-09
updated: 2026-08-09
depends_on: []
links: []
---

# Truncate long plan bodies in the Plan tab behind a one-shot Show more button

## Summary

The workstream details modal renders a whole plan body the moment the Plan tab builds.
This plan makes each plan file show only its first 12 rendered blocks, with a one-shot
**Show more** button that reveals the rest and then removes itself.

The chosen approach detaches the surplus blocks in `renderPlanPanel`
(`src/public/app.ts:495`) after `renderPlanBlocks` has produced them, and holds them in a
closure until the button is clicked. `renderPlanBlocks` (`src/public/app.ts:379`) is not
touched, so the markdown subset renderer keeps its single responsibility and the display
policy stays in the panel that owns display.

This is a display change only. The server keeps sending the full body
(`src/lib/detail.ts:242`), and the browser keeps parsing all of it into DOM nodes before
anything is hidden. No network, memory, or parse cost changes.

## Scope

### Acceptance criteria

1. A user who opens the Plan tab of a workstream whose plan renders more than 16 blocks
   sees exactly the first 12 blocks, followed by a **Show more** button.
2. A user who clicks **Show more** sees every remaining block appear, in source order,
   directly below the twelfth block, with the same styling the blocks would have had if
   they were never detached.
3. After that click the **Show more** button is gone from the panel, and no second click
   is possible.
4. A user who opens the Plan tab of a workstream whose plan renders 16 blocks or fewer
   sees the whole plan and no **Show more** button anywhere.
5. A user who switches from the Plan tab to Issues and back sees the panel in the state
   they left it: still truncated if they never clicked, still full if they did.
6. A user who closes the modal and opens a different card sees that card's plan truncated
   again from the start, with no trace of the previous card's revealed blocks.
7. A workstream that holds two plan files shows one independent **Show more** button per
   file, and clicking one reveals only that file's blocks.
8. A keyboard user can reach the **Show more** button with Tab, and activate it with Enter
   or Space, without leaving the modal's focus trap.
9. The button shows a count cue that states how many blocks are still hidden.
10. `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p src/public/tsconfig.json`
    and `npm run build` all pass.

### Out of scope

- Any **Show less** or collapse-again behaviour. The control is one-shot (decision 4).
- Collapsible per-heading sections, the idea WS-21's plan deferred as its own open
  question 3. That is a different feature and this plan does not start it.
- Any server, route, or type change. `src/lib/detail.ts`, `src/server.ts`,
  `src/types/praxis-data.d.ts` and `src/public/board.html` are not edited.
- Any change to `renderPlanBlocks`, the Issues tab, or the Tasks tab.
- A user setting or query parameter for the cutoff. The cutoff is a module constant.
- Lazy fetching or streaming of plan bodies. The body already arrives whole and stays
  that way (decision 7).

### Assumptions carried into this plan

These are settled by the request or by reconnaissance. They are recorded, not re-opened.

- **A1 — no deployment or release constraints apply.** The dashboard is a local,
  read-only, single-user tool served from `127.0.0.1` (README, "Notes"). There is no
  production data, no live user, and no migration. A bad build is undone by reverting two
  source files and rebuilding. I would have asked the user to confirm this; I take it as
  read because the repository shows no deployment path at all.
- **A2 — no feature flag is needed.** The change is two files and reversible by revert, so
  a flag would be more machinery than the feature.
- **A3 — the block cutoff never lands inside a block.** `renderPlanBlocks` appends one
  child per block to its `root`, so counting children counts blocks exactly.
- **A4 — every plan in this repository will truncate.** Counting blocks the way
  `renderPlanBlocks` does, across all 18 plan files under `flowcharge/workstreams/`, the
  smallest is 74 blocks (`server-bind-beyond-loopback`) and the largest is 285
  (`multi-project-home-page`). The "16 blocks or fewer" case is therefore a correctness
  guard for small or future plans, not a path this repository exercises today.
- **A5 — the count cue never needs a singular form.** With a cutoff of 12 and a threshold
  of 16, a truncated plan always hides at least 5 blocks.

## Design

### Where the change attaches

`renderPlanPanel` (`src/public/app.ts:495`) is the only seam. Today its loop body is three
lines:

```
var sec = buildSection(item.artefact);
sec.appendChild(renderPlanBlocks(item.body));
panelPlan.appendChild(sec);
```

The middle line becomes a call to one new helper that appends the body **and** decides
whether to truncate it. Nothing else in the file's call graph moves: `maybeBuildPlan`
(`src/public/app.ts:362`) still calls `renderPlanPanel` exactly once per modal open, and
the `planBuilt` guard plus the `planData = null; planBuilt = false;` reset in `openModal`
(`src/public/app.ts:671-672`) already give acceptance criteria 5 and 6 with no new code.

### New module constants

Two constants join the existing module-scope block at the top of the IIFE
(`src/public/app.ts:2-6`), which is where `STATUS_ORDER`, `SEV_ORDER` and `POLL_MS`
already live:

- `PLAN_BLOCK_LIMIT = 12` — blocks shown before the button.
- `PLAN_TRUNCATE_THRESHOLD = 16` — a plan is truncated only when it renders **more** than
  this many blocks.

Both carry a short comment stating that the gap between them is what guarantees at least
5 hidden blocks, so the count cue needs no singular form. This mirrors the comment style
at `src/public/app.ts:545-547`, which records the same kind of guarantee for
`.ws-task-count`.

### The new helper — interface and boundaries

```
function appendPlanBody(sec: HTMLElement, root: HTMLElement): void
```

- `sec` is the `.ws-section` element from `buildSection` (`src/public/app.ts:333`).
- `root` is the `.ws-plan` element returned by `renderPlanBlocks`.
- It returns nothing. It appends `root` to `sec`, and appends the button to `sec` after
  `root` when truncation applies.

**What it knows about:** two DOM elements, the two constants, and `el()`
(`src/public/app.ts:19`).

**What it must NOT know about:** `PraxisPlanDetail`, `item.body`, markdown, artefact ids,
tabs, panels, the modal, or fetching. It never reads plan text. It is the reason
`renderPlanPanel` stays a three-line loop and `renderPlanBlocks` stays untouched.

The helper is declared immediately above `renderPlanPanel`, so the reading order in the
file stays "renderer, then truncation, then panel".

### Behaviour of the helper

1. Append `root` to `sec` unconditionally. A plan that is never truncated is finished
   here, and the early return keeps the untruncated path identical to today's.
2. If `root.children.length <= PLAN_TRUNCATE_THRESHOLD`, return.
3. Otherwise collect the surplus into a plain array **first**, then remove them.
   `root.children` is a live `HTMLCollection`, so removing while iterating it skips
   nodes. Two separate loops, never one:
   - loop one reads `root.children[k]` for `k` from `PLAN_BLOCK_LIMIT` to
     `root.children.length - 1` and pushes each into `var held: Element[]`;
   - loop two walks `held` and calls `root.removeChild(held[k])`.
4. Build the button through `el()`:
   - `var more = el('button', 'ws-plan-more', 'Show more');`
   - `more.setAttribute('type', 'button');` — matching the explicit `type="button"` the
     tab buttons already carry in `src/public/board.html:104-106`.
   - `more.appendChild(el('span', 'ws-plan-more-count', held.length + ' more blocks'));`
     The text is a number plus a literal, never file content.
5. Register the one-shot handler. It appends every held node back into `root` in array
   order, then calls `more.remove()`:

   ```
   more.addEventListener('click', function () {
     for (var k = 0; k < held.length; k++) root.appendChild(held[k]);
     more.remove();
   });
   ```

   The nodes go back into `root`, **not** into `sec`. Every plan-body rule in
   `styles.css` is scoped `.ws-plan h4`, `.ws-plan p`, `.ws-plan pre.ws-raw` and so on
   (`src/public/styles.css:883-935`), so a revealed block appended anywhere else would
   lose its styling. This is the single most breakable detail in the change.
6. Append `more` to `sec`, after `root`.

### Patterns reused, not reinvented

- **The closure-held-nodes shape** comes from `lazyBody` (`src/public/app.ts:324`), which
  already defers DOM work behind a one-shot guard. The button is the click-driven sibling
  of that toggle-driven pattern.
- **`el()`** is the only element factory used. No `innerHTML` write is added; the file's
  only `innerHTML` uses stay the `= ''` clears at lines 267, 496 and 511.
- **`held`, `more`, `k`** are all `var`, and the helper is a function declaration.
  `src/public/tsconfig.json` sets `module: "none"`, so no import, export, `let` or `const`
  may appear.
- **Per-file independence** is structural, not enforced: `held`, `root` and `more` are all
  locals of one `appendPlanBody` call, and `renderPlanPanel` calls it once per element of
  `plans`. Two plan files cannot share a budget (decision 6).

### CSS contract

Two new rules go inside the existing `/* ---------- Plan body ---------- */` section of
`src/public/styles.css` (lines 876-935), after the last rule at line 935.

`.ws-plan-more` copies the `.ws-modal-tabs button` treatment (lines 719-736): `border:
none`, `background: none`, `color: var(--ink-soft)`, `font-family: var(--font-body)`,
`font-size: 12.5px`, `cursor: pointer`, with `:hover { color: var(--ink); }` and
`:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`. It adds its
own padding and a top margin so it does not sit flush against the last visible block.

`.ws-plan-more-count` copies `.ws-task-count` (lines 868-874): `font-family:
var(--font-mono)`, `font-size: 11px`, `color: var(--ink-faint)`, `margin-left: 8px`,
`white-space: nowrap`.

**Hard constraint on both:** no new selector may match `#ws-panel-plan` itself. The panels
are hidden by the `hidden` attribute and the user-agent `display: none` that comes with
it, and this stylesheet carries no `[hidden]` rule — the comment at
`src/public/styles.css:877-882` records exactly this hazard. Both new selectors are class
selectors on elements strictly inside a `.ws-section`, so neither can reach the panel.

### Non-functional notes

- **Performance.** Unchanged in the direction that matters and slightly worse in one that
  does not: the full body is still parsed into DOM nodes, and the change adds one array
  build and up to 273 `removeChild` calls on the largest plan in this repository. That is
  a one-off cost on a panel the user just opened. The gain is layout and paint work for
  12 blocks instead of 285, and a scrollbar that means something.
- **Scale.** The largest plan the corpus holds is 285 blocks from 707 source lines. The
  helper is linear in block count with no nesting, so a plan an order of magnitude larger
  behaves the same, only slower in proportion.
- **Security.** No new input path. The only strings written are `'Show more'` and
  `held.length + ' more blocks'`, both generated, and both set through `el()`'s
  `textContent`.
- **Observability.** The existing request logging in `src/server.ts` is unchanged and
  sufficient. This is a client-side rendering change in a local single-user tool; adding
  logging for it would be noise.

## Staged task breakdown

### Phase 1 — Truncation and the working button (small)

**Build:** the two constants, the `appendPlanBody` helper, and the one-line change in
`renderPlanPanel`'s loop. No CSS yet — the button renders with browser default styling
and is fully functional.

**Files:** `src/public/app.ts` only.

**Depends on:** nothing.

**Verify:**
- `npx tsc --noEmit -p src/public/tsconfig.json` passes.
- `npm start`, open a board, open any card, select the Plan tab. The plan stops after 12
  blocks and a browser-default **Show more** button follows it.
- Click it. Every remaining block appears, in the same order as the file, and the button
  disappears.
- Read a revealed heading and a revealed code block. They carry the same size, colour and
  spacing as the blocks above them, which proves they went back into `.ws-plan`.

### Phase 2 — Button and count-cue styling (small)

**Build:** the `.ws-plan-more` and `.ws-plan-more-count` rules at the end of the "Plan
body" section of the stylesheet.

**Files:** `src/public/styles.css` only.

**Depends on:** Phase 1, because the elements must exist to style.

**Verify:**
- `npm run build`, then reload the board. `tools/copy-assets.mjs` copies `styles.css` into
  `dist/public/`, so a plain reload after the build shows the new rules.
- The button reads as a quiet text control in the same family as the modal's tab labels,
  and the count cue reads as mono, small and faint, like a subtask count.
- Tab to the button. A visible accent outline appears.
- Select the Issues tab, then the Tasks tab. Both panels stay hidden and visible in the
  right order, which proves no new selector reached `#ws-panel-plan`.

### Phase 3 — Corpus and edge-case walkthrough (small)

**Build:** nothing. This phase is verification, because the repository has no test
framework and no lint script.

**Files:** none.

**Depends on:** Phases 1 and 2.

**Verify:**
- `npx tsc --noEmit -p tsconfig.json`, `npx tsc --noEmit -p src/public/tsconfig.json` and
  `npm run build` all pass.
- Open the smallest plan (`server-bind-beyond-loopback`, 74 blocks) and the largest
  (`multi-project-home-page`, 285 blocks). Both truncate at 12. The count cues read
  "62 more blocks" and "273 more blocks".
- On one card: reveal the blocks, switch to Issues, switch back to Plan. The plan is still
  full and the button is still gone.
- On another card: leave it truncated, switch to Issues, switch back. Still truncated,
  button still present, one button only.
- Close the modal and open a different card's Plan tab. It is truncated from the start.
- Open a workstream that has no plan file. The "No plan in this workstream" message still
  shows and no button appears.
- Activate the button with Enter, and on a second card with Space. Both reveal the blocks,
  and Space does not scroll the modal.

## Data & compatibility

- **Migrations:** none. Nothing is persisted, and nothing on disk changes shape.
- **Server and wire contract:** unchanged. `extractWorkstreamDetail` keeps pushing
  `{ artefact, body: stripFrontmatter(text) }` at `src/lib/detail.ts:242`, and
  `PraxisPlanDetail` in `src/types/praxis-data.d.ts` is untouched. An older build of the
  client and a newer build of the server stay compatible in both directions, because
  neither end learned a new field.
- **Existing consumers:** `renderPlanBlocks` has exactly one caller, `renderPlanPanel`,
  and that caller keeps passing the same argument and receiving the same element. No other
  code reads `.ws-plan`.
- **Backward compatibility of the DOM:** the `.ws-plan` container, its class, and its
  children's tags and classes are all unchanged. Only the number of children present at
  first paint differs.
- **Rollback:** revert the two files and run `npm run build`. The feature is reversible at
  every phase boundary, with no data to unwind and no flag to clear. Phase 1 alone is a
  complete, shippable state; Phase 2 alone would be dead CSS and is never left standing on
  its own.

## Testing strategy

The repository has no test framework and no lint script, so there is no unit or
integration layer to add to. Coverage is the compiler plus a scripted browser walkthrough,
and that is stated here as the honest ceiling rather than a gap to fill later.

- **Type coverage, every phase:** `npx tsc --noEmit -p tsconfig.json` and `npx tsc --noEmit
  -p src/public/tsconfig.json`. The browser config is the one that matters here: its
  `module: "none"` turns a stray `import`, `let` or `const` into a compile error, and
  `strict` catches an `Element` versus `HTMLElement` slip in the `held` array.
- **Build coverage, Phases 2 and 3:** `npm run build`, which also proves
  `tools/copy-assets.mjs` carried the new CSS into `dist/public/`.
- **Behavioural coverage:** the walkthroughs listed per phase above. Phase 3's list is the
  regression script to repeat if this code is touched again.
- **Pointer for a later test-writing pass:** if a framework is ever introduced, the two
  units worth covering are the block-count boundary (16 blocks renders whole, 17 blocks
  truncates to 12 with 5 held) and the live-`HTMLCollection` detach, which is the one place
  a naive rewrite silently drops or skips blocks.

## Open questions

1. **Focus after the button removes itself.** The button is a one-shot that deletes itself
   (settled decision 4), so a keyboard user who activates it loses their focus position;
   focus falls back to the `<dialog>`. The options are (a) accept it, since the dialog
   keeps focus contained and Escape still closes the modal, or (b) move focus to the first
   revealed block, which needs a `tabIndex = -1` on a node the plan renderer produced.
   **Recommendation: (a).** It is the smaller change, and the revealed content is directly
   below where focus lands. Worth revisiting only if the modal is ever audited for
   keyboard flow as a whole.
2. **Whether 12 is the right first number.** The cutoff is settled as 12 (decision 3), but
   reconnaissance shows every plan in this repository runs 74 to 285 blocks, so 12 is
   roughly the first 4 to 16 percent of a file. That may read as too aggressive once it is
   on screen. **Recommendation: ship 12, look at it in Phase 3, and treat any change as a
   one-line constant edit.** No design depends on the value.
3. **Whether the count cue should say "blocks".** "273 more blocks" exposes an internal
   rendering unit to the reader. The alternatives are a plain "Show more" with no cue, or a
   vaguer "more". **Recommendation: keep the block count.** It is honest about what the
   button will do, and decision 5 already sanctions the cue as optional-but-styled.

Questions I would have asked the user at intake, answered here as assumptions: whether any
deployment, live-data or rollback constraint applies (A1), and whether the change needs a
feature flag (A2).

## Alternatives considered and rejected

- **Truncate inside `renderPlanBlocks`, by passing it a limit and stopping the walk early.**
  Rejected. It would give the markdown renderer a second responsibility — display policy —
  and the comment block at `src/public/app.ts:368-378` is explicit that the function knows
  nothing about tabs, panels or the modal. It would also have to keep parsing to count what
  is left for the cue, so it saves nothing.
- **CSS-only truncation: a `max-height` on `.ws-plan` with a fade, removed by a class
  toggle.** Rejected on two counts. It cuts mid-block, which is exactly what decision 1
  rules out, and it cannot produce an honest hidden-block count. It also puts a `display`
  or height rule near the panel, which is the hazard the stylesheet comment at
  `src/public/styles.css:877-882` warns about.
- **Split the plan into collapsible `<details>` sections, one per heading.** Rejected as a
  different feature. It is the idea WS-21's plan deferred, it needs the renderer to expose
  heading boundaries, and it changes how the whole plan reads rather than how much of it
  loads.
- **Server-side truncation with a second fetch for the remainder.** Rejected. Decision 7
  settles that the server does not change, and it would add a route, a payload shape and a
  loading state to solve a problem that is not about bytes.

## Final summary

Detach every rendered block past the twelfth in `renderPlanPanel`, hold them in a closure,
and reveal them with a one-shot **Show more** button that then removes itself.

Three phases, all small: behaviour in `app.ts`, styling in `styles.css`, then a corpus and
edge-case walkthrough. Roughly 40 new lines across two files, and no server change.

Top risks:
1. Iterating the live `root.children` while removing from it would silently skip blocks.
   Collect into an array first, then remove.
2. Appending revealed blocks anywhere but back inside `.ws-plan` loses all their styling.
3. A new CSS selector that reaches `#ws-panel-plan` would unhide a hidden panel.

Needing your answer: (1) accept the focus falling back to the dialog after the button
removes itself, (2) confirm 12 blocks reads well on screen once you see it, and (3) confirm
the count cue should name blocks.

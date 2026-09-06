---
id: PLN-40-8txyes
type: plan
workstream: WS-49-bxknyf
slug: select-folder-button-order
title: "Fix .add-form hidden-attribute override so only one add-project control shows"
status: done
created: 2026-08-20
updated: 2026-08-20
depends_on: []
links: []
---

# Fix .add-form hidden-attribute override so only one add-project control shows

## Summary

The home page's "Add a project" panel shows both the path-field form and the
"Choose folder" button at once in the Electron build, instead of exactly one
of them. The toggle logic in `src/public/home.ts` is already correct; the
bug is a CSS specificity conflict in `src/public/styles.css:624`, where
`.add-form { display: flex; ... }` overrides the browser's default
`[hidden] { display: none; }` rule for the same element. The fix adds one
scoped override rule, `.add-form[hidden] { display: none; }`, immediately
after the existing `.add-form` rule in `styles.css`. This restores the
`hidden` attribute's effect for `.add-form` specifically, without touching
`home.ts`'s toggle logic, `index.html`'s markup, or `#choose-folder-button`
(which already hides/shows correctly and needs no change).

## Scope

**In scope — acceptance criteria:**

- In Electron mode (`window.praxisAPI.pickProjectFolder` is a function), the
  home page's add-project panel shows only the "Choose folder" button; the
  path field and "Add project" button are not visible and do not occupy
  layout space.
- In plain-browser-tab mode (`pickProjectFolder` is not a function), the
  panel shows only the path field and "Add project" button; the "Choose
  folder" button is not visible and does not occupy layout space.
- Both controls remain functionally unchanged: "Add project" still calls
  `submitPath()` → `window.praxisAPI.addProject(value)`; "Choose folder"
  still calls `window.praxisAPI.pickProjectFolder()` then `addProject(path)`.
- The fix is CSS-only, confined to `src/public/styles.css`.

**Out of scope:**

- Any change to `src/public/home.ts`'s `initAddProjectControl()`, `submitPath()`,
  or the `choose-folder-button` click handler — their logic is already correct.
- Any change to `src/public/index.html`'s DOM order or structure.
- Button repositioning or reordering — once only one control renders at a
  time, there is nothing to position relative to another control.
- A general audit or global `[hidden]` reset rule covering elements other
  than `.add-form` — no other element in `styles.css` was reported or found
  to have this bug (see Design, "why not a global rule").

**Assumptions (none require confirmation — none affect the design):**

- The existing toggle logic's feature-detect (`typeof
  window.praxisAPI.pickProjectFolder === 'function'`) correctly and
  exhaustively distinguishes Electron mode from browser-tab mode; this plan
  does not re-verify that detection, only the CSS that renders its result.
- No automated test currently exercises this panel's visibility (see Testing
  strategy); manual verification in both modes is the acceptance method,
  matching how the original bug was confirmed (user screenshot + `npm run
  build && npm run electron:dev`).

**Deployment/release constraints:** This is a local developer tool
(`README.md`: "Private repository... for internal use," server binds to
`127.0.0.1` by default) with no production deployment, live user base, or
release/rollback pipeline to protect. The change is a single scoped CSS
rule with no data or API surface, so no flag, dark-launch, or migration
concern applies. This is stated as an assumption because deployment
constraints were not addressed in the bug report; there was nothing to ask
that would change the design.

## Design

**Root cause (confirmed in Context, re-verified during reconnaissance):**

- `src/public/home.ts:332-339` (`initAddProjectControl()`) sets
  `byId('add-form').hidden = true` and `byId('choose-folder-button').hidden
  = false` in Electron mode (and the inverse in browser-tab mode) — this
  logic is correct and untouched by this plan.
- `src/public/styles.css:624`:
  `.add-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }`
  sets `display` on the exact element the `hidden` IDL attribute targets.
  Because this author-origin declaration has higher specificity than the
  user-agent stylesheet's `[hidden] { display: none; }` rule for the same
  element, `.add-form` renders regardless of its `hidden` state.
- `#choose-folder-button` (`styles.css:637-649`) has no `display` rule of
  its own — that block only sets border/background/padding/font/cursor —
  so it hides/shows correctly via `hidden`'s default UA behavior.
- Confirmed via `grep -n "hidden"` and `grep -rn "\[hidden\]"` across
  `src/public/*.css`: no `[hidden]` selector exists anywhere in
  `styles.css`, and no other class combines an unconditional `display`
  declaration with an element that also carries the `hidden` attribute.
  `styles.css:952-955` documents this as a deliberate file-wide convention
  for the modal/panel system elsewhere in the file ("this file carries no
  `[hidden]` rule, so any display rule reaching a panel would make a hidden
  panel visible") — `.add-form` is the one place that convention was
  broken, which is exactly this bug.

**Chosen fix:** add one scoped override rule directly after the existing
`.add-form` rule at `styles.css:624`:

```css
.add-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.add-form[hidden] { display: none; }
```

`.add-form[hidden]` has specificity (0,2,0) — one class plus one attribute
selector — which beats the plain `.add-form` rule's (0,1,0) regardless of
source order, so no `!important` is needed (consistent with the rest of
`styles.css`, which uses `!important` nowhere — confirmed by `grep -n
"!important" styles.css` returning no matches). This is the smallest
change that restores the `hidden` attribute's effect for exactly the
element that lost it, and needs no HTML or TypeScript change.

**Why not a global `[hidden] { display: none; }` reset:** `styles.css:952-955`
records that the rest of the file deliberately avoids putting `display` on
any `hidden`-toggled element in the first place, rather than relying on a
reset rule to fix it up afterward — `.add-form` is the sole exception found.
A file-wide reset would be a wider-blast-radius change than the confirmed
bug calls for, and would work against that documented convention rather
than restoring it locally. Scoping the fix to `.add-form[hidden]` fixes the
one confirmed instance without changing behavior anywhere else in the page.

**What this module knows / must not know:** `.add-form[hidden]` is a pure
presentation rule — it knows only that this one element's `hidden` state
must suppress `display`. It must not (and does not) reference
`#choose-folder-button`, `home.ts`'s toggle logic, or any other panel's
`hidden` handling; those stay exactly as they are.

**Contracts:** No data model, API, or module interface changes — this is a
single CSS selector addition. No new contract is introduced.

## Staged task breakdown

Single phase — the fix is one file, one rule, verified in both runtime
modes.

### Phase 1 — Restore mutually-exclusive add-project controls

**Task 1.1 — Add the `.add-form[hidden]` override rule**
- What: insert `.add-form[hidden] { display: none; }` immediately after the
  existing `.add-form { display: flex; ... }` rule at `src/public/styles.css:624`.
- Files touched: `src/public/styles.css` only.
- Effort: small.
- Dependencies: none.
- Verify: `grep -n "add-form\[hidden\]" src/public/styles.css` shows the new
  rule; `npm run build` completes without error.

**Task 1.2 — Verify Electron mode shows only "Choose folder"**
- What: run `npm run build && npm run electron:dev`, open the home page,
  and confirm the add-project panel shows only the "Choose folder" button —
  no path field, no "Add project" button, no stacked/duplicate controls.
  Click "Choose folder", pick a directory, and confirm it is added as a
  tile (existing `addProject` flow, unchanged).
- Files touched: none (verification only).
- Effort: small.
- Dependencies: Task 1.1.
- Verify: observable in the running Electron window — matches the
  acceptance criterion for Electron mode above.

**Task 1.3 — Verify browser-tab mode shows only the path field + Add project button**
- What: run `npm start` (or open the built `dist/public/index.html` in a
  plain browser tab, where `praxisAPI.pickProjectFolder` is not a function
  per `browser-ipc-shim.ts`'s WS-45 shim), and confirm the panel shows only
  the path field and "Add project" button — no "Choose folder" button.
  Type an absolute path and submit, and confirm it is added as a tile
  (existing `submitPath()` flow, unchanged).
- Files touched: none (verification only).
- Effort: small.
- Dependencies: Task 1.1.
- Verify: observable in the browser tab — matches the acceptance criterion
  for browser-tab mode above, and confirms the standing project requirement
  that both modes keep working.

## Data & compatibility

No data model, storage format, or API changes. `.praxis-projects.json` and
the `/api/` routes are untouched. No migration is needed. Rollback is a
one-line revert of the added CSS rule (or `git revert` of this change) —
fully reversible with no data-shape implications, since nothing persisted
changes.

## Testing strategy

No existing automated test suite covers `src/public/*.ts` or `*.css`
rendering (this is a hand-written, dependency-free static frontend per
`README.md`'s "Notes" section — no test runner is configured in
`package.json` for the public/ assets). The verification method matches how
the bug itself was confirmed: manual checks in both runtime modes (Tasks
1.2 and 1.3 above), covering the two acceptance criteria. If the project
later adds browser-level UI tests, a good candidate assertion would be:
"with `pickProjectFolder` mocked as a function, `#add-form` has computed
`display: none`" and its inverse — but authoring that suite is not part of
this fix and is not requested by Context.

## Open questions

None. Context specified the root cause, the decision, and the constraint
directly enough that no part of the design was left to interpretation. The
only item that would ordinarily be asked — deployment/release constraints —
is answered by the project's own README (local-only tool, no production
deployment) and recorded as an assumption above rather than a question.

## Alternatives considered and rejected

- **`.add-form { display: none; } .add-form:not([hidden]) { display: flex; ... }`**
  (invert the rule instead of adding an override) — functionally
  equivalent to the chosen fix, but rewrites the existing, working
  `display: flex; flex-wrap: wrap; gap: 8px; align-items: center;`
  declaration in place rather than adding one line after it, which is a
  larger diff against a rule that isn't otherwise wrong. Rejected for being
  a less minimal change than the chosen override for no behavioral gain.
- **A global `[hidden] { display: none; }` reset rule** (e.g. added near the
  top of `styles.css`) — would fix this instance and guard against the same
  mistake recurring elsewhere. Rejected because it is a wider-blast-radius
  change than the confirmed bug needs, it works against the file's own
  documented convention of never needing a `[hidden]` rule
  (`styles.css:952-955`) rather than restoring that convention, and no
  second instance of the bug was found during reconnaissance to justify the
  wider fix.
- **Remove `display: flex` from `.add-form` and move the flex layout to a
  wrapper element around the input and button** — would follow the file's
  "never put display on a hidden-toggled element" convention most purely,
  but requires adding a wrapper element in `src/public/index.html`. Context
  explicitly rules out touching `index.html`'s DOM structure, so this
  alternative is not viable under the stated constraint.
- **Fix in `home.ts` instead of CSS** (e.g. toggle a `style.display`
  inline, or add/remove a class) — Context explicitly identifies
  `initAddProjectControl()`'s logic as already correct and instructs not to
  touch it unless the CSS fix alone cannot restore correct behavior. The
  CSS-only fix is sufficient, so this alternative was not pursued.

## Final summary

Chosen approach: add `.add-form[hidden] { display: none; }` to
`src/public/styles.css` right after the existing `.add-form` rule
(line 624), restoring the `hidden` attribute's effect for that element
without touching `home.ts` or `index.html`. One phase, three small tasks
(the fix plus manual verification in Electron mode and browser-tab mode),
effort ballpark: small overall. Top risks: none of significance — this is a
single, low-specificity-conflict CSS rule with no data/API surface; the
main risk is skipping verification in one of the two runtime modes, which
Tasks 1.2 and 1.3 both cover explicitly. No open questions remain.

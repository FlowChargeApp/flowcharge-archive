---
id: TL-66-3dh0fp
type: tasklist
workstream: WS-65-o96qgz
slug: modal-description-show-more
title: "Clamp the modal description to four lines with a measured Show more reveal"
status: done
created: 2026-08-23
updated: 2026-08-23
author: Anthony Koukoullis
depends_on: [PLN-55-a4xsr3]
links: []
mode: spec
base_commit: bc58e6b
---

# PRX Tasks

## Clamp the modal description to four lines with a measured Show more reveal

The workstream detail modal prints the whole `description` in one `<p>`
(`src/public/board.html:120`). A long description pushes the tab strip and the
tab body down. This work clamps that paragraph to four lines with
`-webkit-line-clamp`, and adds a one-shot "Show more" button below it. The
button appears only when the text really overflows the clamped box.

The clamp state lives in markup and CSS. The measurement lives in a small new
function, `syncDescriptionOverflow()`, that runs **after** `modal.showModal()`.
That call site is the decisive point of the design. `renderModalMeta()` runs at
`src/public/app.ts:997`, but `modal.showModal()` runs at `src/public/app.ts:1016`.
Until `showModal()` runs, the `<dialog>` has no `open` attribute, so it is
`display: none` and every height read returns 0. A measurement inside
`renderModalMeta()` would always report "no overflow", and the button would
never appear.

A third change gives the pinned meta region its own scroll, so an expanded
description on a short viewport is reachable instead of clipped.

The work is three phases, in this order, about 40 lines of change across three
files: `src/public/board.html`, `src/public/styles.css`, `src/public/app.ts`.

Excluded by the plan and untouched by every task here: the description field's
character cap in any layer; the Praxis skill-source repo; `#ws-modal { padding: 0 }`
(`src/public/styles.css:705-717`), which is load-bearing for backdrop dismissal;
the plan panel's own "Show more" in `appendPlanBody()` (`src/public/app.ts:782-812`),
which is a template to copy and not a target to refactor; scrolling the revealed
text into view; a collapse or "Show less" path; and `pollOnce()` / `applyData()`.

- [x] 1. Phase 1 — Clamp the paragraph and place the button

  ```yaml
  description: "Add the clamp class and the hidden reveal button to the markup, and add the clamp rule plus the shared button styling to the stylesheet. The button stays hidden after this phase, because only Phase 2 unhides it."
  ```

  - [x] 1.1 Mark the description as clamped and add the hidden reveal button in `src/public/board.html`
    ```yaml
    description: "Add is-clamped to #ws-modal-description and add a hidden #ws-modal-description-more button directly after it, inside .ws-modal-meta."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor: the single #ws-modal-description paragraph inside the div.ws-modal-meta block that carries id=\"ws-modal-meta\" (src/public/board.html:115-123)."
      - "Apply this one mechanical edit. The SEARCH text is copied from the file as read at base_commit bc58e6b."
      - |
        src/public/board.html
        <<<<<<< SEARCH
              <p id="ws-modal-description" class="ws-modal-description" hidden></p>
        =======
              <p id="ws-modal-description" class="ws-modal-description is-clamped" hidden></p>
              <button type="button" id="ws-modal-description-more"
                      class="ws-modal-description-more" hidden>Show more</button>
        >>>>>>> REPLACE
      - "Add no wrapper element around the paragraph and the button. .ws-modal-meta is already a column flex container with gap: 6px (src/public/styles.css:770-776), so it stacks the button under the paragraph without help."
      - "Add no ARIA attributes to the button. It matches the existing .ws-plan-more pattern, which carries none (plan assumption A4)."
    pattern: "src/public/board.html only. Do not edit src/public/index.html, whose integrations modal reuses the .ws-modal-meta class with no id."
    imports: "None. Static markup only, no script tag and no new asset."
    compatibility: "The clamp class ships in the markup, so the clamped state is the document's default and the first open needs no script. The button is a sibling of the paragraph, matching appendPlanBody(), which appends its button beside the body root and not inside it (src/public/app.ts:811). The button must keep the hidden attribute; Phase 2 owns unhiding it."
    gotcha: "The type=\"button\" attribute is required. A bare <button> inside a <dialog> defaults to type=submit and would close the dialog on click. The id and the class must both be ws-modal-description-more, because Phase 2 looks up the id and Phase 3's styling matches the class."
    verify:
      - "npm run build"
      - "grep -c 'is-clamped' src/public/board.html returns 1"
      - "grep -c 'id=\"ws-modal-description-more\"' src/public/board.html returns 1"
      - "grep -c 'ws-modal-description-more' src/public/index.html returns 0"
    checklist:
      - "Does #ws-modal-description carry both ws-modal-description and is-clamped in its class list?"
      - "Is the new button a direct sibling of the paragraph, inside #ws-modal-meta, with no wrapper element added?"
      - "Does the button carry type=\"button\", id=ws-modal-description-more, class=ws-modal-description-more, and the hidden attribute?"
      - "Is src/public/index.html unchanged?"
      - "Does the button carry no aria-expanded and no aria-controls?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Add the clamp rule and the shared button styling in `src/public/styles.css`
    ```yaml
    description: "Add a .ws-modal-description.is-clamped clamp modifier, extend the existing .ws-plan-more selector list to cover the new button, and add the two corrections the flex context needs."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Anchor 1: the .ws-modal-description rule at src/public/styles.css:787-792. Directly below it, add a .ws-modal-description.is-clamped modifier that sets display: -webkit-box, -webkit-line-clamp: 4, -webkit-box-orient: vertical and overflow: hidden. This is the same four-declaration set already used by .card-title (src/public/styles.css:371-380)."
      - "Keep the base .ws-modal-description rule exactly as it is. Its margin, font-size, color and overflow-wrap must stay there, so removing the modifier class returns the paragraph to plain block flow with no other side effect."
      - "Anchor 2: the .ws-plan-more rule and its two state rules at src/public/styles.css:1067-1078. Extend each of the three selectors with a comma and the matching .ws-modal-description-more selector. Do not copy the declarations into a second rule and do not change any declaration value."
      - "Anchor 3: below that grouped rule, add a .ws-modal-description-more rule with align-self: flex-start and margin-top: 0. align-self is required because a flex item stretches on the cross axis by default, so without it the button spans the full width and a click far right of the label still fires it. margin-top: 0 removes the inherited 8px, because .ws-modal-meta's gap: 6px already supplies the spacing."
      - "Add no #ws-modal-meta rule in this task. The meta region's scroll belongs to task 3."
    pattern: "src/public/styles.css only. Three insertion points, all additive apart from the two commas that extend the existing .ws-plan-more selector list."
    imports: "No new token. --ink-soft, --ink, --accent and --font-body are already defined in :root with a prefers-color-scheme: dark override, so dark mode needs no extra rule."
    compatibility: "The runtime is Chromium in Electron and in the browser tab fallback, so -webkit-line-clamp is safe and is already relied on by .card-title (plan assumption A3). The clamp is a fixed four lines at every viewport width, with no media query (plan assumption A1). Reusing the .ws-plan-more declarations by selector grouping, not by copying, keeps one set of token values."
    gotcha: "The clamp declarations must sit in the modifier class only. If any of them leaks into the base .ws-modal-description rule, removing the class in Phase 2 will not reveal the text. The .ws-plan-more class name says \"plan\" and its own comment (src/public/styles.css:1064-1066) states it lives beside .ws-plan inside .ws-section, so the new button must not simply reuse that class name. The plan's exclusion list forbids any change to #ws-modal { padding: 0 } (src/public/styles.css:705-717)."
    verify:
      - "npm run build"
      - "grep -c '\\-webkit-line-clamp: 4' src/public/styles.css returns 1"
      - "grep -c 'ws-modal-description-more' src/public/styles.css returns 4 (the grouped base, hover and focus-visible selectors, plus the align-self rule)"
      - "git diff -U0 src/public/styles.css | grep -c '^[-+].*#ws-modal {' returns 0"
      - "git diff -U0 src/public/styles.css | grep -c '^-[^-]' returns 3 (the only removed lines are the three .ws-plan-more selector lines, replaced by their grouped form)"
      - "npm start, then open a workstream whose description is longer than four lines: the paragraph shows exactly four lines and no button is visible yet. Open a workstream with a short description: the full text renders with no visible cut."
    checklist:
      - "Do the four clamp declarations live only in .ws-modal-description.is-clamped, leaving the base rule's margin, font-size, color and overflow-wrap untouched?"
      - "Is the button styled by extending the existing .ws-plan-more selector list, with no declaration value copied or changed?"
      - "Does .ws-modal-description-more set align-self: flex-start and margin-top: 0?"
      - "Is the clamp fixed at four lines with no media query and no width breakpoint?"
      - "Is #ws-modal { padding: 0 } unchanged, and is no #ws-modal-meta rule added in this task?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — Measure the overflow and wire the one-shot reveal in `src/public/app.ts`

  ```yaml
  description: "Re-assert the clamp and hide the button in renderModalMeta()'s branches, add syncDescriptionOverflow(), call it directly after modal.showModal(), and register one click listener at module setup."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Anchor 1: renderModalMeta() at src/public/app.ts:942. It already resolves descEl via byId('ws-modal-description'). Resolve the button the same way, then reset both elements in all three branches that set the description state: the early-return !w branch, the empty-description else branch, and the branch that sets descEl.textContent = desc and descEl.hidden = false. In every one of the three, add is-clamped back to descEl's class list and set the button's hidden to true."
    - "This reset holds no state variable of its own. It is what makes a reopen show four lines again, and what makes a short description after a long one show no button."
    - "Anchor 2: beside renderModalMeta(), add a new function syncDescriptionOverflow(): void. It resolves the paragraph and the button by id, returns early with the button hidden when the paragraph is hidden, and otherwise sets moreEl.hidden = descEl.scrollHeight <= descEl.clientHeight + 1. The +1 absorbs sub-pixel rounding between the two integer readings; one real extra line is a whole line-height, far above that tolerance."
    - "Keep the function narrow. It must know only two element ids and two height properties. It must not know what a workstream is, what the text says, or how long it is. Carry a comment stating why it runs after showModal()."
    - "Anchor 3: openModal(), at the line immediately after modal.showModal() (src/public/app.ts:1016). Call syncDescriptionOverflow() there. showModal() sets the open attribute synchronously and layout is computed on demand when scrollHeight is read, so the value is correct in the same task. Use no requestAnimationFrame and no setTimeout."
    - "Anchor 4: the module-setup listener block, beside byId('ws-modal-close').addEventListener(...) at src/public/app.ts:1088. Register one click listener on ws-modal-description-more that removes is-clamped from ws-modal-description and hides the button. Register it once here, never per open, because the button is static markup and per-open registration would stack a listener on every card click."
    - "Provide no collapse path and no second-click behaviour. Do not scroll the revealed text into view. Do not truncate the description string anywhere; the reveal only removes a CSS class."
  pattern: "src/public/app.ts only. Four edit sites in that one file. Do not touch appendPlanBody() (src/public/app.ts:782-812), pollOnce() (src/public/app.ts:1108) or applyData()."
  imports: "No new import. byId() at src/public/app.ts:74 already returns HTMLElement, which carries hidden, classList, scrollHeight and clientHeight."
  compatibility: "src/public/tsconfig.json sets strict: true and noEmit: true; tsc is the type-check gate and esbuild owns emit. The file's local style is var declarations and function expressions, not const/arrow, so match it. scrollHeight and clientHeight are number properties on Element and HTMLElement, so no cast is needed for the comparison."
  gotcha: "The call site is the whole design. A call before modal.showModal() reads 0 for both heights, because a <dialog> without the open attribute is display: none, so the button would never appear. Inside the click listener, prefer byId('ws-modal-description-more').hidden = true over a this-based reference; addEventListener's HTMLElement overload does type this, but the explicit lookup is unambiguous under strict mode. renderModalMeta() has exactly one call site, and the poll never touches the modal meta, so a live refresh cannot collapse a description the user just expanded and no guard is needed for it."
  verify:
    - "npm run build (this type-checks all three TypeScript projects and is the only automated gate the repository has; it must pass with no TypeScript error)"
    - "grep -c 'syncDescriptionOverflow' src/public/app.ts returns 2 (the definition and the single call)"
    - "grep -n -A2 'modal.showModal();' src/public/app.ts shows syncDescriptionOverflow() on the next line"
    - "grep -c \"ws-modal-description-more').addEventListener\" src/public/app.ts returns 1 (exactly one registration site)"
    - "grep -n \"ws-modal-description-more').addEventListener\" src/public/app.ts reports a line outside both openModal() and renderModalMeta()"
    - "git diff -U0 src/public/app.ts | grep -c 'appendPlanBody\\|pollOnce\\|applyData' returns 0"
    - "In the running app, check the plan's acceptance criteria in order: a long description shows four lines and the button; one click reveals the whole text and the button disappears; Escape then reopen the same card restores four lines and the button; a short-description card opened straight after a long one shows no button; in DevTools the paragraph's textContent holds the whole string while clamped, which proves no string truncation happened."
  checklist:
    - "Do all three branches of renderModalMeta() re-add is-clamped and set the button's hidden to true?"
    - "Is syncDescriptionOverflow() called on the line immediately after modal.showModal(), with no requestAnimationFrame and no setTimeout?"
    - "Does syncDescriptionOverflow() use the scrollHeight <= clientHeight + 1 comparison and reference nothing beyond the two element ids and the two height properties?"
    - "Is the click listener registered exactly once at module setup, not inside openModal() or renderModalMeta()?"
    - "Does the reveal only remove the is-clamped class, with no collapse path, no string truncation and no re-fetch?"
    - "Does npm run build pass with no TypeScript error?"
  self_eval:
    passed: true
    failures: []
    notes: "npm run build passed. All grep verify steps passed. The running-app acceptance-criteria walkthrough was skipped: this run is restricted to build, grep and file inspection."
  ```

- [x] 3. Phase 3 — Let the meta region scroll on a short viewport (`src/public/styles.css`)

  ```yaml
  description: "Give the board modal's meta region its own capped scroll, scoped by the #ws-modal-meta id, and verify the short-viewport behaviour at 600px and 450px."
  author: Anthony Koukoullis
  issues: []
  implement:
    - "Anchor: the .ws-modal-meta block at src/public/styles.css:770-777. Below it, add a rule for the id #ws-modal-meta setting max-height: 40vh and overflow-y: auto."
    - "Use the id selector, not the bare .ws-modal-meta class. That class is shared with the integrations modal (src/public/index.html:59), which carries no id and holds a segmented scope control and a project <select>. A max-height there serves no purpose, and a new scroll container around a <select> can clip an accent focus ring drawn with outline-offset: 2px."
    - "The id rule is additive to the class rule, so the shared layout declarations at src/public/styles.css:770-776 stay in one place. Do not move or duplicate them."
    - "Verify at a window height of about 600px and again at about 450px, with a long description expanded, that the whole description is reachable by scrolling inside the meta region, the tab strip stays visible and every tab still switches, the tab body still scrolls its own content, no horizontal scrollbar appears in the meta region, and the meta region does not collapse to a sliver at 450px."
    - "Option A (expected): the five checks pass and no further CSS is needed. .ws-modal-body already sets overflow: auto (src/public/styles.css:821-825), and a flex item's automatic minimum size applies only to items whose overflow is visible, so its minimum is already zero and it already shrinks."
    - "Option B (fallback, only if the meta region collapses too far or the tab body loses its scroll): add the named fallback .ws-modal-body { flex: 1 1 auto; min-height: 0; } and re-run the same five checks. Apply this only on an observed failure, never pre-emptively."
    - "Finally open the integrations modal from the home page and confirm it renders and behaves exactly as before."
  pattern: "src/public/styles.css only. One new rule, plus the named fallback rule if and only if Option B is triggered."
  imports: "No new token and no new asset."
  compatibility: "40vh is the plan's committed cap value. The id #ws-modal-meta exists only in src/public/board.html:115, so the rule cannot reach the integrations modal in src/public/index.html."
  gotcha: "Setting overflow-y: auto while overflow-x stays visible makes the computed overflow-x become auto. The meta region's children already handle this: .card-tags wraps, the description sets overflow-wrap: anywhere, and the dates line is short. Verify it rather than assume it, which is why the no-horizontal-scrollbar check is in the verify list."
  verify:
    - "npm run build"
    - "grep -c '#ws-modal-meta {' src/public/styles.css returns 1"
    - "grep -c 'max-height: 40vh' src/public/styles.css returns 1"
    - "git diff -U0 src/public/styles.css | grep -c '^[-+].*\\.ws-modal-meta {' returns 0 (the shared class rule itself is untouched)"
    - "npm start, then at a window height of about 600px and again at about 450px with a long description expanded: the whole description is reachable by scrolling inside the meta region; the tab strip stays visible and every tab switches; the tab body still scrolls its own content; no horizontal scrollbar appears in the meta region; the meta region does not collapse to a sliver at 450px."
    - "Open the integrations modal from the home page and confirm it renders and behaves exactly as before."
  checklist:
    - "Is the scroll rule scoped to the #ws-modal-meta id, with the shared .ws-modal-meta class rule left byte-for-byte unchanged?"
    - "Is the cap exactly max-height: 40vh with overflow-y: auto?"
    - "Do all five short-viewport checks pass at both 600px and 450px?"
    - "Is the .ws-modal-body fallback absent, or present only because an observed check failed?"
    - "Does the integrations modal in src/public/index.html render and behave exactly as before?"
  self_eval:
    passed: true
    failures: []
    notes: "Option A held: no .ws-modal-body fallback was needed. npm run build passed. All grep checks passed: '#ws-modal-meta {' = 1, 'max-height: 40vh' = 1, and the diff touches no '.ws-modal-meta {' line. The five short-viewport checks ran headlessly against the live server, reading computed styles and scroll metrics at viewport heights 600px and 450px with a long description expanded. At 450px the cap resolved to 180px, the meta region scrolled (scrollHeight 465 against clientHeight 179), the end of the description was reachable, scrollWidth equalled clientWidth so no horizontal scrollbar appeared, the tab strip stayed inside the viewport, every tab switched, and the tab body still scrolled its own content (94 against 91). At 600px the cap resolved to 240px and the same checks passed. The integrations modal on the home page kept max-height: none and overflow: visible on its class-only .ws-modal-meta, and it rendered and opened as before."
  ```

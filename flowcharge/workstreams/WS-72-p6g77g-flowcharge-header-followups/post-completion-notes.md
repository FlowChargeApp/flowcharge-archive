# Post-completion notes — after WS-72

Ad hoc work done after WS-72's plan and task list were already closed. Not a formal
FlowCharge artefact — a placeholder for the future addendum-artefact type. One defect,
found in the Electron build after the five phases had landed, and fixed as task 6
appended to `TL-74-bqkeb0-tasklist.md`.

## The Electron folder-picker button sat flush against the tile grid

`src/public/styles.css` gives the add-project control its clearance above the project
tile grid with `.home-heading + * { margin-bottom: 28px; }` — an adjacent-sibling rule,
so it matches whichever element follows the heading in markup order. That is
`#add-form`.

`src/public/home.ts` `initAddProjectControl()` (around line 349) shows only one of two
controls: `#choose-folder-button` when `window.praxisAPI.pickProjectFolder` exists — the
Electron build with the native folder picker — and `#add-form` otherwise. The hidden one
carries `hidden`, so it is `display: none` and renders no margin.

Before task 3 the heading, the form and the button all sat below the tile grid, so the
rule's gap fell in empty space and the mismatch was invisible. Task 3 moved the whole
add-project block above the grid. That put the *visible* control directly above the grid
in both builds, and only then did it matter that the rule names the form and not the
button. In the Electron build the button ended up 0px above the grid. In the browser
build nothing changed: `#add-form` is still the heading's sibling and still gets 28px.

Task 3 verify step 7 predicted and reported this exact state, and plan Decision 6
deliberately made no CSS change at the time. The user then saw it in the real Electron
window and asked for the browser build's spacing.

## The fix

`src/public/styles.css`, one rule, plus a comment saying why an id joins an
adjacency selector:

```css
.home-heading + *, #choose-folder-button { margin-bottom: 28px; }
```

Both possible visible controls now carry the same 28px. They can never double it,
because only one of the two is ever visible and the hidden one is `display: none`.
No other file changed — the markup order and the build-time swap were both already
correct.

Verified per task 6's own steps: `npm run build` clean; the control-to-grid gap measures
28px in the browser state and 28px in the reproduced Electron DOM state; the
heading-to-control gap stays 12px, so the space opened below the control; `#add-error`
still renders in place between the control and the grid; unchanged in light and dark
mode; and `src/public/board.html` contains neither selector, so the board screen cannot
be reached.

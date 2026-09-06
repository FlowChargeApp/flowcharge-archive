---
id: PLN-69-uuue9p
type: plan
workstream: WS-78-0ayqeh
slug: modal-body-replaces-description
title: "Keep the modal's tags and dates fixed while only the body scrolls"
status: done
created: 2026-08-30
updated: 2026-08-30
depends_on: []
links: []
---

# Keep the modal's tags and dates fixed while only the body scrolls

## 1. Requirement

The workstream detail modal's meta region scrolls as one block. A long body now
pushes the tags row and the dates row out of the visible 40vh, so the user must
scroll to reach them.

Move the tags row and the dates row out of the scrolling area. Only the blocked
banner, the body paragraph and the "Show more" button scroll. The tags row and
the dates row stay in their present visual position, after the scrolling area
and before the tabs.

This is a layout change only. The data that fills each element, the "Show more"
click handler and the CSS line clamp all stay as they are.

## 2. Reconnaissance

I read every file named below.

### 2.1 The markup

`src/public/board.html:125-135` holds one flat container:

```html
<div class="ws-modal-meta" id="ws-modal-meta">
  <div id="ws-modal-blocked" class="ws-modal-blocked" hidden> … </div>
  <p id="ws-modal-description" class="ws-modal-description is-clamped" hidden></p>
  <button type="button" id="ws-modal-description-more"
          class="ws-modal-description-more" hidden>Show more</button>
  <div class="card-tags" id="ws-modal-tags" hidden></div>
  <div class="ws-modal-dates" id="ws-modal-dates"></div>
</div>
```

All five children are siblings. The container is the scroller.

### 2.2 The CSS

`src/public/styles.css:850-856` gives `.ws-modal-meta` a column flex layout, a
`6px` gap, `12px 18px` padding and a bottom border.
`src/public/styles.css:857` sets `.ws-modal-meta .card-tags { margin-bottom: 0; }`
— a descendant selector, so the tags row must stay inside `.ws-modal-meta`.
`src/public/styles.css:858-864` adds the `40vh` cap and `overflow-y: auto`,
scoped by id so the integrations modal in `src/public/index.html:62`, which
reuses the `.ws-modal-meta` class, keeps a plain unscrolled layout.

### 2.3 The flex context

`.ws-modal-inner` at `src/public/styles.css:801-805` is a column flex box capped
at `calc(100vh - 64px)`. Its children are the head, the meta region, the tab
list and `.ws-modal-body`. `.ws-modal-body` sets `overflow: auto`, so it is the
item that absorbs shrink on a short viewport.

This matters for the change. A flex item that is a scroll container has an
automatic minimum size of zero, so `#ws-modal-meta` can shrink below `40vh`
today. Once the scroll moves to an inner element, `#ws-modal-meta` stops being a
scroll container, its automatic minimum size becomes its content height, and it
no longer shrinks. See 5.3.

### 2.4 The script

`renderModalMeta` at `src/public/app.ts:975-1032` looks each element up by id
with `byId`. It never walks the tree by parent or by sibling. Element nesting is
therefore free to change, provided every id survives.

`syncDescriptionOverflow` at `src/public/app.ts:1039-1048` reads `scrollHeight`
and `clientHeight` on `#ws-modal-description` and returns early when that
element is hidden. The click handler at `src/public/app.ts:1149-1152` only
removes the clamp class and hides the button. Neither reads the parent.

### 2.5 Tests

There is no browser-side test suite. `src/lib/*.test.ts` covers extraction only,
and no case touches the modal markup. Verification for this change is manual.

## 3. Approach

### 3.1 Chosen: wrap the scrolling children in a new inner element

Add one element inside `#ws-modal-meta` that holds the blocked banner, the body
paragraph and the "Show more" button. Move the `40vh` cap and `overflow-y: auto`
onto that element. Leave the tags row and the dates row as direct children of
`#ws-modal-meta`, in their present order.

Why this wins.

- The visual result is identical for a short body. The outer gap, padding and
  border stay on the same element, and the new wrapper repeats the `6px` gap
  inside itself, so the spacing between banner, body and button is unchanged.
- The tags row stays a descendant of `.ws-modal-meta`, so the
  `.ws-modal-meta .card-tags` rule keeps working with no edit.
- Every id survives, so `renderModalMeta`, `syncDescriptionOverflow` and the
  click handler keep their `byId` lookups. Only one small addition is needed
  (5.2).
- It touches three files and adds no new concept.

### 3.2 Rejected: move tags and dates to a sibling block after the meta region

Make `#ws-modal-meta` the scroller as it is today, and put the tags row and the
dates row in a new container placed between `#ws-modal-meta` and the tab list.

Rejected. The new container would have to repeat the `12px 18px` padding, and
the bottom border would have to move to it, so the border and the padding would
be split across two rules. It also breaks the
`.ws-modal-meta .card-tags` descendant rule, which forces a second CSS edit for
no gain. The change is larger and the styling is more fragile.

### 3.3 Rejected: keep the flat markup and pin tags and dates with sticky

Leave the five siblings as they are and give the tags row and the dates row
`position: sticky; bottom: 0`.

Rejected. They would still live inside the scroller, so they would overlay the
body text and would need an opaque background to stay readable. Worse, a sticky
bottom pins them to the foot of the `40vh` box even when the body is short, so
the rows would move down the modal in the common case. That is a visual position
change, which the requirement forbids.

## 4. Contracts

No data contract changes. No type, payload, route or IPC channel is touched.

The DOM contract changes in one way only: `#ws-modal-blocked`,
`#ws-modal-description` and `#ws-modal-description-more` gain one level of
nesting. All five ids keep their names and their document order.

## 5. Stages

### Stage 1 — restructure the meta region

Files: `src/public/board.html`, `src/public/styles.css`, `src/public/app.ts`.

These three edits must land together. Stage 5.2 exists to stop a spacing
regression that stage 5.1 would otherwise introduce, so they belong in one
commit.

#### 5.1 Markup and CSS

In `src/public/board.html`, wrap the first three children of `#ws-modal-meta` in
a new `<div id="ws-modal-meta-scroll">`. Leave `#ws-modal-tags` and
`#ws-modal-dates` as direct children, after the wrapper, in their present order.
Change no id, no class and no attribute on any existing element.

In `src/public/styles.css`:

- Delete the `max-height` and `overflow-y` declarations from the `#ws-modal-meta`
  rule at lines 861-864, and remove that now-empty rule.
- Add a `#ws-modal-meta-scroll` rule with `display: flex`,
  `flex-direction: column`, `gap: 6px`, `max-height: 40vh` and
  `overflow-y: auto`.
- Move the explanatory comment at lines 858-860 onto the new rule and reword it,
  because it describes the scroll behaviour that is moving. Keep the point it
  makes about `src/public/index.html` reusing the `.ws-modal-meta` class.
- Change nothing in `.ws-modal-meta`, `.ws-modal-meta .card-tags`,
  `.ws-modal-dates`, `.ws-modal-blocked`, `.ws-modal-description` or
  `.ws-modal-description.is-clamped`.

Acceptance criteria.

- A workstream with a long body shows the tags row and the dates row without any
  scrolling, in the same place they sit for a short body.
- The body area scrolls on its own once it passes `40vh`.
- A workstream with a short body renders pixel-identically to the current build.
- The integrations modal in `src/public/index.html` is unchanged.

#### 5.2 Keep the empty wrapper from adding a gap

`.ws-modal-meta` uses `gap: 6px`. A hidden child is `display: none` and is not a
flex item, so today a workstream with no body and no blocked banner produces one
gap, between tags and dates. After 5.1 the wrapper is still a flex item at zero
height, so a second gap appears above the tags row.

Fix it in `renderModalMeta` in `src/public/app.ts`.

- Add one `byId('ws-modal-meta-scroll')` lookup beside the existing lookups at
  `src/public/app.ts:977-982`.
- In the `if (!w)` branch, set the wrapper `hidden = true`.
- At the end of the populated path, set the wrapper's `hidden` to
  `blockedEl.hidden && descEl.hidden`.

Change nothing else in the function. Do not alter what fills the description,
the tags or the dates.

This does not interfere with `syncDescriptionOverflow`. The wrapper is hidden
only when `#ws-modal-description` is itself hidden, and that function already
returns early in exactly that case.

Acceptance criteria.

- A workstream with no body and no blocked banner shows the same spacing above
  the tags row as it does today.
- A workstream with a blocked banner but no body still shows the banner.
- A workstream with a body but no blocked banner still shows the body and the
  correct "Show more" state.

### Stage 2 — verify by hand

There is no browser test harness (2.5), so verification is manual. Run
`npm start` and open the board.

Checks.

1. Open a workstream whose body is longer than `40vh`. The tags row and the
   dates row are visible with no scrolling. The body area scrolls on its own.
2. Click "Show more" on a clamped body. The rest of the body appears, the button
   disappears, and the tags row and the dates row do not move.
3. Open a workstream with a four-line or shorter body. No "Show more" button
   appears, and the layout matches the current build.
4. Open a workstream with an empty body. The spacing above the tags row matches
   the current build.
5. Open a blocked workstream. The banner sits above the body inside the
   scrolling area.
6. Open a workstream with no tags. The tags row stays hidden and no empty row
   appears.
7. Open the integrations modal from the home page. It is unchanged.
8. Repeat check 1 in a short window, about 600px tall, and confirm the tags row
   and the dates row are still visible.

### 5.3 Consequence to watch on a short viewport

`#ws-modal-meta` stops being a scroll container, so it stops shrinking below its
content height (2.3). On a short viewport the meta region therefore claims
`40vh` plus the tags and dates rows, and `.ws-modal-body` — the tab panel area —
absorbs the difference and gets smaller.

This is the direct consequence of the requirement. Making the rows always
visible must take space from somewhere, and the tab panel already scrolls. I
accept it. Check 8 above is there to confirm the result is still usable. See
open question Q2.

## 6. Risk

- **Scrollbar position moves inward.** The scrollbar currently sits at the right
  edge of `#ws-modal-meta`, outside its `18px` padding. After the change it sits
  on the inner wrapper, so it is inset by `18px`. This appears only when the
  body overflows. See open question Q3.
- **No data or storage risk.** The extractor is read-only and untouched.
- **No injection risk added.** The body is still written with `textContent`.
- **No build change.** `tools/copy-assets.mjs` already copies `board.html` and
  `styles.css`, and `src/public/tsconfig.json` already compiles `app.ts`.

## 7. Assumptions

I took the most reasonable reading on each point below and did not stop to ask.

- **A1 — the blocked banner scrolls with the body.** The brief left this open. It
  sits directly above the body in the current order, and it is part of the same
  block of state text, so it goes inside the scrolling wrapper. This also keeps
  the DOM order unchanged. See Q1.
- **A2 — the `40vh` cap keeps its value.** The brief says the scrolling area
  keeps the `40vh` cap. The number is not re-tuned for the smaller area.
- **A3 — the wrapper gets no border and no background.** It is a layout box only.
  Any visible divider would be new styling the brief did not ask for.
- **A4 — no renames.** `#ws-modal-description` and its class keep their names,
  as PLN-68 already decided.
- **A5 — no release constraint.** This is a local dashboard. The change lands in
  one commit and takes effect on the next `npm run build`. The packaged Electron
  build picks it up on its next package run.
- **A6 — manual verification is enough.** No browser test harness exists, and
  adding one is not in this brief.

## 8. Open questions

A task must not be authored for anything resting on one of these until it is
answered.

1. **Should the blocked banner scroll with the body, or stay fixed with the tags
   and dates?** A1 puts it in the scrolling area. If it should stay fixed, it
   moves out of the wrapper and above it, and 5.2's hidden test drops the
   `blockedEl.hidden` term. The change is small, but it must be settled before
   5.1 is authored.
2. **Is the smaller tab panel on a short viewport acceptable?** 5.3 explains why
   the panel loses height. If it is not acceptable, the fix is to lower the
   scrolling area's cap below `40vh`, which contradicts the brief, so I did not
   plan it.
3. **Should the scrollbar keep its current flush position?** Section 6 records
   that it moves inward by `18px`. Keeping it flush means moving the horizontal
   padding from `.ws-modal-meta` onto each child, which is more CSS churn than
   this fix warrants. I did not plan it.

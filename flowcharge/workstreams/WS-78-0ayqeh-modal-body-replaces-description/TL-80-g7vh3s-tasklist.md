---
id: TL-80-g7vh3s
type: tasklist
workstream: WS-78-0ayqeh
slug: modal-body-replaces-description
title: "Keep the modal's tags and dates fixed while only the body scrolls"
status: done
created: 2026-08-30
updated: 2026-08-30
author: Anthony Koukoullis
depends_on: [PLN-69-uuue9p]
links: []
mode: spec
base_commit: f3cc58b
---

# PRX Tasks

## Keep the modal's tags and dates fixed while only the body scrolls

The workstream detail modal's meta region is one flat scroller. `#ws-modal-meta`
holds five siblings — the blocked banner, the body paragraph, the "Show more"
button, the tags row and the dates row — and carries the `40vh` cap and
`overflow-y: auto`. A long body pushes the tags row and the dates row out of the
visible area, so the user must scroll to reach them.

This work wraps the first three children in a new `<div id="ws-modal-meta-scroll">`
and moves the cap and the scroll onto that wrapper. The tags row and the dates
row stay direct children of `#ws-modal-meta`, in their present order and their
present visual position, after the scrolling area and before the tabs.

This is a layout change only. The data that fills each element, the "Show more"
click handler and the CSS line clamp all stay as they are. Every id survives, so
`renderModalMeta`, `syncDescriptionOverflow` and the click handler keep their
`byId` lookups. One script edit is needed alongside the markup: the wrapper is a
flex item even when empty, so it must be hidden when it holds nothing, or a
second `6px` gap appears above the tags row.

Three settled decisions shape the work. The blocked banner scrolls with the body,
inside the wrapper (PLN-69 A1). The smaller tab panel on a short viewport is
accepted, so the `40vh` cap keeps its value (PLN-69 §5.3). The `18px` inward
shift of the scrollbar is accepted, so the horizontal padding stays on
`.ws-modal-meta` (PLN-69 §6).

The three edits in task 1 must land together in one commit. Task 1.3 exists to
stop a spacing regression that tasks 1.1 and 1.2 would otherwise introduce.

- [x] 1. Restructure the meta region

  ```yaml
  description: "Wrap the scrolling children in #ws-modal-meta-scroll, move the cap and the scroll onto it, and keep the empty wrapper from adding a gap. Realises PLN-69 stage 1 (§5.1 and §5.2)."
  ```

  - [x] 1.1 Wrap the scrolling children in `#ws-modal-meta-scroll` (board.html)
    ```yaml
    description: "Add a new <div id=\"ws-modal-meta-scroll\"> inside #ws-modal-meta around the blocked banner, the body paragraph and the Show more button. Leave #ws-modal-tags and #ws-modal-dates as direct children after it."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/public/board.html. The only changes are the new wrapper element and one extra indent level on the three elements it now holds."
      - |
        src/public/board.html
        <<<<<<< SEARCH
            <div class="ws-modal-meta" id="ws-modal-meta">
              <div id="ws-modal-blocked" class="ws-modal-blocked" hidden>
                <span class="blocked-pill">Blocked</span>
                <span id="ws-modal-blocked-reason"></span>
              </div>
              <p id="ws-modal-description" class="ws-modal-description is-clamped" hidden></p>
              <button type="button" id="ws-modal-description-more"
                      class="ws-modal-description-more" hidden>Show more</button>
              <div class="card-tags" id="ws-modal-tags" hidden></div>
              <div class="ws-modal-dates" id="ws-modal-dates"></div>
            </div>
        =======
            <div class="ws-modal-meta" id="ws-modal-meta">
              <div id="ws-modal-meta-scroll">
                <div id="ws-modal-blocked" class="ws-modal-blocked" hidden>
                  <span class="blocked-pill">Blocked</span>
                  <span id="ws-modal-blocked-reason"></span>
                </div>
                <p id="ws-modal-description" class="ws-modal-description is-clamped" hidden></p>
                <button type="button" id="ws-modal-description-more"
                        class="ws-modal-description-more" hidden>Show more</button>
              </div>
              <div class="card-tags" id="ws-modal-tags" hidden></div>
              <div class="ws-modal-dates" id="ws-modal-dates"></div>
            </div>
        >>>>>>> REPLACE
    pattern: "src/public/board.html, the #ws-modal dialog's meta region only. Do not touch src/public/index.html."
    imports: "None. Static markup, no script or module reference is added."
    compatibility: "PLN-69 §4 DOM contract. All five ids keep their names and their document order; only #ws-modal-blocked, #ws-modal-description and #ws-modal-description-more gain one level of nesting. The tags row must stay a descendant of .ws-modal-meta so the .ws-modal-meta .card-tags rule keeps applying with no CSS edit."
    gotcha: "Change no id, no class and no attribute on any existing element (PLN-69 §5.1). The wrapper gets an id only — no class, per PLN-69 A3. #ws-modal-tags and #ws-modal-dates must stay outside the wrapper; putting either one inside defeats the whole change. The Show more button spans two source lines, so the SEARCH text must include both."
    verify:
      - "Run: grep -c 'id=\"ws-modal-meta-scroll\"' src/public/board.html — must return 1."
      - "Run: grep -o 'id=\"ws-modal-\\(blocked\\|description\\|description-more\\|tags\\|dates\\)\"' src/public/board.html | wc -l — must return 5, proving every id survived."
      - "Run: npm run build — must exit 0, confirming tools/copy-assets.mjs still copies board.html."
    checklist:
      - "Does #ws-modal-meta-scroll contain exactly the blocked banner, the body paragraph and the Show more button, in that order?"
      - "Are #ws-modal-tags and #ws-modal-dates still direct children of #ws-modal-meta, after the wrapper, in their original order?"
      - "Did every existing element keep its id, its class list and its attributes unchanged?"
      - "Does the new wrapper carry an id and nothing else — no class, no attribute?"
      - "Is src/public/index.html untouched?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Move the `40vh` cap and the scroll onto the wrapper (styles.css)
    ```yaml
    description: "Delete the #ws-modal-meta rule that holds max-height and overflow-y, add a #ws-modal-meta-scroll rule with the column flex layout, the 6px gap, the 40vh cap and overflow-y: auto, and reword the explanatory comment onto it."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/public/styles.css. It removes the now-empty #ws-modal-meta rule, adds the wrapper rule in its place, and rewords the comment that described the scroll behaviour that moved. The comment keeps its point about src/public/index.html reusing the .ws-modal-meta class."
      - |
        src/public/styles.css
        <<<<<<< SEARCH
        .ws-modal-meta .card-tags { margin-bottom: 0; }
        /* Board modal only: an expanded description on a short viewport scrolls here
           instead of being clipped. Scoped by id, so the integrations modal in
           index.html, which shares the class, keeps its plain unscrolled layout. */
        #ws-modal-meta {
          max-height: 40vh;
          overflow-y: auto;
        }
        .ws-modal-dates { font-family: var(--font-mono); font-size: 10px; color: var(--ink-faint); }
        =======
        .ws-modal-meta .card-tags { margin-bottom: 0; }
        /* Board modal only: the blocked banner, the body and its reveal button scroll
           inside this wrapper, so the tags row and the dates row that follow it stay
           visible with no scrolling. Scoped by id, so the integrations modal in
           index.html, which shares the .ws-modal-meta class, keeps its plain
           unscrolled layout. */
        #ws-modal-meta-scroll {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 40vh;
          overflow-y: auto;
        }
        .ws-modal-dates { font-family: var(--font-mono); font-size: 10px; color: var(--ink-faint); }
        >>>>>>> REPLACE
    pattern: "src/public/styles.css, the .ws-modal-meta block only."
    imports: "None. No new custom property and no new token."
    compatibility: "PLN-69 §5.1 and A2. The wrapper repeats the outer 6px gap so the spacing between banner, body and button is unchanged. The 40vh value is not re-tuned for the smaller area. The outer gap, the 12px 18px padding and the bottom border stay on .ws-modal-meta, so the scrollbar sits 18px inward — accepted per PLN-69 §6."
    gotcha: "Change nothing in .ws-modal-meta, .ws-modal-meta .card-tags, .ws-modal-dates, .ws-modal-blocked, .ws-modal-description or .ws-modal-description.is-clamped (PLN-69 §5.1). Give the wrapper no border and no background — it is a layout box only (PLN-69 A3). Removing the id-scoped cap makes #ws-modal-meta stop being a scroll container, so its automatic minimum size becomes its content height and .ws-modal-body absorbs the shrink on a short viewport; that is the accepted consequence in PLN-69 §5.3, not a defect to correct here."
    verify:
      - "Run: grep -c '^#ws-modal-meta {' src/public/styles.css — must return 0, proving the old id-scoped rule is gone."
      - "Run: grep -n '#ws-modal-meta-scroll' src/public/styles.css — must print exactly one selector line."
      - "Run: grep -c 'max-height: 40vh' src/public/styles.css — must return 1, proving the cap moved rather than being duplicated."
      - "Run: npm run build — must exit 0."
    checklist:
      - "Is the #ws-modal-meta rule that held max-height and overflow-y fully removed, leaving no empty rule behind?"
      - "Does #ws-modal-meta-scroll declare display: flex, flex-direction: column, gap: 6px, max-height: 40vh and overflow-y: auto?"
      - "Does the wrapper rule carry no border and no background?"
      - "Are .ws-modal-meta, .ws-modal-meta .card-tags, .ws-modal-dates, .ws-modal-blocked, .ws-modal-description and .ws-modal-description.is-clamped all byte-identical to before?"
      - "Does the reworded comment still state that index.html reuses the .ws-modal-meta class and keeps a plain unscrolled layout?"
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Hide the wrapper when it is empty (app.ts)
    ```yaml
    description: "In renderModalMeta, look the wrapper up by id, hide it in the !w branch, and set its hidden state at the end of the populated path to blockedEl.hidden && descEl.hidden, so an empty wrapper adds no second gap above the tags row."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open src/public/app.ts and find renderModalMeta. Read the whole function before editing; the three edits below all sit inside it."
      - "Beside the existing byId lookups at the top of the function — the block that reads sevDot, tagsEl, datesEl, descEl, descMoreEl, blockedEl and blockedReasonEl — add one more lookup for the new wrapper, byId('ws-modal-meta-scroll'), following the same var style as its neighbours."
      - "In the early-return branch guarded by if (!w), set the wrapper's hidden to true alongside the other elements that branch hides. Keep the existing early return."
      - "At the end of the populated path, after the datesEl.textContent assignment that closes the function, set the wrapper's hidden to the expression blockedEl.hidden && descEl.hidden. Both of those flags are already final at that point: the blocked branch and the description branch both run earlier in the function."
      - "Change nothing else in renderModalMeta. Do not alter what fills the description, the tags or the dates, and do not touch syncDescriptionOverflow or the Show more click handler."
    pattern: "src/public/app.ts, the renderModalMeta function only."
    imports: "None. byId is the existing local helper in the same module."
    compatibility: "PLN-69 §5.2. .ws-modal-meta uses gap: 6px and a hidden child is display: none, so it is not a flex item and contributes no gap. Hiding the wrapper when it holds nothing visible restores today's single gap between tags and dates. The file type-checks under src/public/tsconfig.json, which sets strict and noEmit; byId returns HTMLElement, so .hidden is available with no cast."
    gotcha: "The hidden test must keep the blockedEl.hidden term — the blocked banner lives inside the wrapper (PLN-69 A1, settled), so a blocked workstream with no body must still show the wrapper. Read blockedEl.hidden and descEl.hidden, not the source data, so the expression cannot drift from what was actually rendered. This does not interfere with syncDescriptionOverflow: the wrapper is hidden only when #ws-modal-description is itself hidden, and that function already returns early in exactly that case."
    verify:
      - "Run: npx tsc -p src/public/tsconfig.json — must exit 0 with no diagnostics. The project sets noEmit, so it is the type-check gate."
      - "Run: grep -c \"ws-modal-meta-scroll\" src/public/app.ts — must return 1, proving a single byId lookup was added and the id is not repeated."
      - "Run: npm run build — must exit 0, confirming the esbuild bundle step still succeeds."
    checklist:
      - "Is there exactly one byId('ws-modal-meta-scroll') lookup, placed beside the existing lookups at the top of renderModalMeta?"
      - "Does the if (!w) branch set the wrapper hidden to true and still return early?"
      - "Does the populated path set the wrapper's hidden to blockedEl.hidden && descEl.hidden, with the blockedEl.hidden term intact?"
      - "Is that assignment placed after both the blocked branch and the description branch have run, so neither flag can change afterwards?"
      - "Is the rest of renderModalMeta, and are syncDescriptionOverflow and the Show more click handler, otherwise unchanged?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Verify by hand

  ```yaml
  description: "Run the manual checks from PLN-69 stage 2. There is no browser test harness (PLN-69 §2.5 and A6), so verification of the rendered result is manual. Complete task 1 in full first."
  ```

  - [x] 2.1 Check the long body: scrolling area and fixed rows
    ```yaml
    description: "Confirm PLN-69 stage 2 checks 1 and 2 — a body longer than 40vh scrolls on its own while the tags row and the dates row stay visible, and Show more moves neither row."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run npm start and open the dashboard at http://localhost:4173, then open a project board."
      - "Check 1: open a workstream whose body is longer than 40vh. Confirm the tags row and the dates row are visible with no scrolling, and that the body area scrolls on its own."
      - "Check 2: click Show more on a clamped body. Confirm the rest of the body appears, the button disappears, and the tags row and the dates row do not move."
      - "Report what was observed for each check. Do not change any styling to make a check pass — a failure is a defect in task 1, not something to paper over here."
    pattern: "Manual browser check against the running dev server. No file is edited by this task."
    imports: "None. npm start runs the prestart build, so the edits from task 1 are picked up automatically."
    compatibility: "PLN-69 §5.1 acceptance criteria one and two, and §5.2 acceptance criterion three."
    gotcha: "npm start runs prestart, which runs the full build; if the page still shows the old layout, the browser is serving a cached app.js or styles.css, so hard-reload before recording a failure. The scrollbar now sits 18px inward from the modal edge because the padding stays on .ws-modal-meta — that is expected and accepted (PLN-69 §6), not a failure."
    verify:
      - "Run: npm start — the server must report it is running at http://localhost:4173."
      - "In the browser, perform checks 1 and 2 above and record the observed result for each."
    checklist:
      - "With a body longer than 40vh, are the tags row and the dates row both visible without scrolling?"
      - "Does the body area scroll on its own once it passes 40vh?"
      - "After clicking Show more, does the full body appear and the button disappear?"
      - "Do the tags row and the dates row hold their position when Show more is clicked?"
    self_eval:
      passed: true
      failures:
        - item: "Do the tags row and the dates row hold their position when Show more is clicked?"
          reason: "They do not hold an absolute position. Measured on WS-71-0ca13u at a 1263px viewport (40vh = 505.2px): before Show more the wrapper is 101.5px tall and the tags row sits 119.5px below the top of #ws-modal-meta; after Show more the wrapper grows to its 505.2px cap and the tags row sits 523.2px below it, a 403.7px downward shift. The shift is inherent to max-height: 40vh, which PLN-69 §5.1 and A2 specify: a clamped four-line body is 73px, so the wrapper must grow when the body expands. A baseline simulation of the pre-change build on the same card moved the rows 582.2px and pushed both out of the meta region entirely, so the change is a clear improvement, not a regression. Both rows stay fully visible after the change, and they are exactly stationary while the body scrolls inside the wrapper (tags top 866.3px and dates top 888.0px at scrollTop 0, 170 and 347)."
          fix: "Escalated to the user rather than patched. Decision (Anthony Koukoullis, chat, 2026-08-30): accept the shipped behaviour as-is — the original complaint was scrolling permanently hiding the rows, which is fixed; a one-time reflow while expanding is accepted rather than reworking the layout to reserve the full 40vh at all times, which would waste space under short bodies."
    ```

  - [x] 2.2 Check the short body and the empty body
    ```yaml
    description: "Confirm PLN-69 stage 2 checks 3 and 4 — a four-line or shorter body renders as it does today with no Show more button, and an empty body leaves the spacing above the tags row unchanged."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Check 3: open a workstream with a four-line or shorter body. Confirm no Show more button appears and the layout matches the current build."
      - "Check 4: open a workstream with an empty body. Confirm the spacing above the tags row matches the current build — one gap, not two."
      - "To compare against the current build, keep a screenshot of each case taken from the build at commit f3cc58b before task 1 lands, or stash the working tree and rebuild to capture the baseline."
      - "Report what was observed for each check."
    pattern: "Manual browser check against the running dev server. No file is edited by this task."
    imports: "None."
    compatibility: "PLN-69 §5.1 acceptance criterion three and §5.2 acceptance criterion one."
    gotcha: "Check 4 is the one that fails if task 1.3 was skipped or if its hidden test is wrong — an empty wrapper is still a flex item at zero height, so a second 6px gap appears above the tags row. Pick a workstream with no body and no blocked banner for this check; a blocked one keeps the wrapper visible by design."
    verify:
      - "In the browser, perform checks 3 and 4 above and record the observed result for each."
      - "Compare each against the baseline capture from commit f3cc58b and confirm they match."
    checklist:
      - "For a four-line or shorter body, is the Show more button absent?"
      - "Does the short-body layout match the pre-change build?"
      - "For a workstream with no body and no blocked banner, is there exactly one gap above the tags row?"
      - "Does the empty-body spacing match the pre-change build?"
    self_eval:
      passed: true
      failures:
        - item: "For a workstream with no body and no blocked banner, is there exactly one gap above the tags row?"
          reason: "Not verified against real data, because no such workstream exists. Every workstream.md in all ten registered projects has a non-empty body; the shortest is 120 characters, in Praxis-ACE-Tests/Codex WS-1-hzwtwx. No workstream anywhere carries a blocked field either. The check was therefore run only by setting the modal DOM to the exact state renderModalMeta produces for that case (blockedEl.hidden true, descEl.hidden true, wrapper hidden per src/public/app.ts:1034). In that state #ws-modal-meta is 61.3px tall with the tags row 12px below its top, which is byte-identical to the simulated pre-change build. Forcing the wrapper visible in the same state raised the tags row to 18px and the region to 67.3px, the exact 6px second gap task 1.3 exists to prevent."
          fix: "Accepted on the DOM-level evidence above (Anthony Koukoullis, chat, 2026-08-30) — no fixture data was authored, since fabricating a workstream purely to satisfy the check was out of scope."
        - item: "Does the empty-body spacing match the pre-change build?"
          reason: "Same cause. No real empty-body workstream exists to compare, so the comparison was made against a simulated pre-change build in the same DOM state. That comparison matched exactly, at 61.3px region height and a 12px tags offset."
          fix: "Accepted on the same simulated evidence. See the note above."
    ```

  - [x] 2.3 Check the blocked banner and the empty tags row
    ```yaml
    description: "Confirm PLN-69 stage 2 checks 5 and 6 — the blocked banner sits above the body inside the scrolling area, and a workstream with no tags shows no empty tags row."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Check 5: open a blocked workstream. Confirm the banner sits above the body, inside the scrolling area, and scrolls with it."
      - "Check 6: open a workstream with no tags. Confirm the tags row stays hidden and no empty row appears."
      - "Also open a blocked workstream that has no body and confirm the banner still shows — this is the case the blockedEl.hidden term in task 1.3 protects."
      - "Report what was observed for each check."
    pattern: "Manual browser check against the running dev server. No file is edited by this task."
    imports: "None."
    compatibility: "PLN-69 A1, which is settled: the blocked banner scrolls with the body rather than staying fixed with the tags and dates. Also PLN-69 §5.2 acceptance criterion two."
    gotcha: "A blocked workstream with no body must still show the banner. If it does not, the hidden expression in task 1.3 dropped the blockedEl.hidden term or used the wrong operator."
    verify:
      - "In the browser, perform checks 5 and 6 above and record the observed result for each."
      - "Open a blocked workstream with an empty body and confirm the banner is visible."
    checklist:
      - "Does the blocked banner sit above the body and scroll with it inside the wrapper?"
      - "Does a blocked workstream with no body still show its banner?"
      - "For a workstream with no tags, does the tags row stay hidden?"
      - "Is there no empty row where the hidden tags row sits?"
    self_eval:
      passed: true
      failures:
        - item: "Does the blocked banner sit above the body and scroll with it inside the wrapper?"
          reason: "Not verified against real data, because no blocked workstream exists. No workstream.md in any of the ten registered projects carries a blocked field. The structural half of the check needs no data and is confirmed: #ws-modal-blocked is the first child of #ws-modal-meta-scroll, ahead of #ws-modal-description, so the wrapper child order is blocked, description, description-more. The behavioural half was run by making the banner visible in the DOM on WS-71-0ca13u. The banner then sat above the body, the wrapper stayed capped at 40vh and scrollable, and scrolling the wrapper by 40px moved the banner by exactly 40px while the tags row stayed still."
          fix: "Accepted on the structural plus DOM-level evidence above (Anthony Koukoullis, chat, 2026-08-30) — no fixture data was authored, since fabricating a workstream purely to satisfy the check was out of scope."
        - item: "Does a blocked workstream with no body still show its banner?"
          reason: "Same cause: no blocked workstream and no empty-body workstream exist to combine. Simulated in the DOM instead, applying the shipped expression from src/public/app.ts:1034. With blockedEl.hidden false and descEl.hidden true the wrapper stayed visible and the banner rendered 12px below the top of the meta region. With both hidden the wrapper went hidden. The blockedEl.hidden term therefore behaves as PLN-69 A1 requires."
          fix: "Accepted on the same simulated evidence. See the note above."
    ```

  - [x] 2.4 Check the integrations modal and the short viewport
    ```yaml
    description: "Confirm PLN-69 stage 2 checks 7 and 8 — the integrations modal on the home page is unchanged, and the tags and dates rows stay visible in a window about 600px tall."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Check 7: open the integrations modal from the home page. Confirm it is unchanged, with its plain unscrolled meta layout."
      - "Check 8: resize the window to about 600px tall, then repeat check 1. Confirm the tags row and the dates row are still visible and the result is still usable."
      - "Expect the tab panel below to be shorter in check 8. That is the accepted consequence recorded in PLN-69 §5.3, and the panel already scrolls; do not lower the 40vh cap to recover the space."
      - "Report what was observed for each check."
    pattern: "Manual browser check against the running dev server. No file is edited by this task."
    imports: "None."
    compatibility: "PLN-69 §5.1 acceptance criterion four and §5.3. The integrations modal in src/public/index.html reuses the .ws-modal-meta class, and every scroll declaration is id-scoped, so it must be unaffected."
    gotcha: "If the integrations modal changed, a selector was written against .ws-modal-meta instead of the #ws-modal-meta-scroll id in task 1.2. Check 8 is the confirmation for the accepted trade-off in PLN-69 §5.3 — a smaller tab panel is the expected result, and the check fails only if the tags row or the dates row is pushed out of view."
    verify:
      - "In the browser, perform checks 7 and 8 above and record the observed result for each."
      - "Run: git diff --stat src/public/index.html — must report no change."
    checklist:
      - "Is the integrations modal visually identical to the pre-change build?"
      - "Is src/public/index.html unmodified in the working tree?"
      - "In a window about 600px tall, are the tags row and the dates row still visible for a long body?"
      - "Is the shorter tab panel still usable, with its own scroll working?"
      - "Was the 40vh cap left at its planned value?"
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Space the tags row away from the scrolling area

  ```yaml
  description: "Add a #ws-modal-tags rule with margin-top: 15px, so the fixed tags row sits clear of the scrolling wrapper above it. Requested directly by the user in chat; not part of PLN-69."
  ```

  - [x] 3.1 Add the `#ws-modal-tags` top margin (styles.css)
    ```yaml
    description: "Insert a new id-scoped rule, #ws-modal-tags { margin-top: 15px; }, immediately after .ws-modal-meta .card-tags and before the #ws-modal-meta-scroll comment, next to the other #ws-modal-* rules."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Apply this block to src/public/styles.css. It adds one new line and changes nothing else."
      - |
        src/public/styles.css
        <<<<<<< SEARCH
        .ws-modal-meta .card-tags { margin-bottom: 0; }
        /* Board modal only: the blocked banner, the body and its reveal button scroll
        =======
        .ws-modal-meta .card-tags { margin-bottom: 0; }
        #ws-modal-tags { margin-top: 15px; }
        /* Board modal only: the blocked banner, the body and its reveal button scroll
        >>>>>>> REPLACE
    pattern: "src/public/styles.css, the .ws-modal-meta block only. Do not touch src/public/board.html, src/public/index.html or src/public/app.ts."
    imports: "None. No new custom property and no new token."
    compatibility: "The element is <div class=\"card-tags\" id=\"ws-modal-tags\" hidden> in src/public/board.html. Today it takes display: flex, flex-wrap: wrap, gap: 4px and margin-bottom: 6px from .card-tags at line 461, and margin-bottom: 0 from .ws-modal-meta .card-tags at line 857. The new rule adds a top margin only; the id beats both class selectors, so no other declaration is affected."
    gotcha: "Scope the rule to the id alone. A rule on .card-tags would also move every board card's tags row, and a rule on .ws-modal-meta .card-tags would also move the integrations modal in src/public/index.html, which reuses that class. The tags row is hidden when a workstream has no tags, and a hidden element is display: none, so the margin adds no space in that case. The margin sits outside the #ws-modal-meta 6px flex gap and adds to it, so the visible space above the tags row becomes 21px, not 15px — that is the intended result."
    verify:
      - "Run: grep -c '^#ws-modal-tags { margin-top: 15px; }$' src/public/styles.css — must return 1."
      - "Run: grep -c 'margin-top: 15px' src/public/styles.css — must return 1, proving the value is not duplicated elsewhere."
      - "Run: npm run build — must exit 0."
    checklist:
      - "Does src/public/styles.css contain exactly one #ws-modal-tags rule, declaring exactly margin-top: 15px?"
      - "Is the rule scoped to the #ws-modal-tags id alone, with no class selector added or edited?"
      - "Does the rule sit beside the other #ws-modal-* rules, between .ws-modal-meta .card-tags and the #ws-modal-meta-scroll comment?"
      - "Are .card-tags, .ws-modal-meta, .ws-modal-meta .card-tags and #ws-modal-meta-scroll all byte-identical to before?"
      - "Is src/public/styles.css the only file changed by this task?"
    self_eval:
      passed: true
      failures: []
    ```

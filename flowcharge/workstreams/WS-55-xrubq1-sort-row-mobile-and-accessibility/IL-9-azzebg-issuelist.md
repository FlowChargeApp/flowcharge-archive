---
id: IL-9-azzebg
type: issuelist
workstream: WS-55-xrubq1
slug: sort-row-mobile-and-accessibility
title: "Sort row mobile layout defect"
status: ready
created: 2026-08-21
updated: 2026-08-21
depends_on: []
links: []
---

# PRX Issue List

- [ ] ISS-19-ua5166. Sort row overflows the page at mobile widths and hides the direction control

  ```yaml
  id: ISS-19-ua5166
  status: in-progress
  severity: high
  author: Anthony Koukoullis
  description: "At mobile viewport widths the board's sort row makes the whole page overflow sideways. The key segment #sort-key-seg holds 5 buttons (Artefact ID, Name, Severity, Created, Updated) and does not shrink below about 356px of combined width. .controls is display: flex with flex-wrap: wrap, so its children wrap onto new lines, but .seg is display: inline-flex with no flex-wrap and never wraps inside itself. It stays one solid non-wrapping block. Measured at 375px viewport width, the document scroll width becomes 514px, so the page overflows horizontally by 139px. .controls is position: sticky; top: 0, so the overflow is pinned to the top at every scroll position. Three effects follow. First, the #sort-dir-seg control (Asc/Desc) is pushed fully off-screen, so sort direction is unreachable without a sideways page drag, and nothing on screen shows that the control exists. Second, .seg has overflow: hidden, so the Updated button is painted half-clipped instead of wrapped or scrolled, which reads as a rendering fault. Third, flex-shrink compresses the remaining buttons from their natural width of about 88px down to about 76px, which wraps the active label 'Artefact ID' onto two lines and makes the segment taller than the surrounding row."
  steps_to_reproduce:
    - "Start the dashboard with npm start and open a board page at /board.html?project=<id>."
    - "Set the browser viewport width to 375px."
    - "Look at the sort row at the top of the page."
    - "Observe that the Asc/Desc segment is off-screen, that the Updated button is clipped, and that the page scrolls sideways."
  expected: "At mobile widths the sort controls stay reachable and legible. There is no page-level horizontal overflow, no off-screen control, and no clipped or wrapped button text."
  actual: "The page overflows sideways by up to 139px at narrow widths. The direction toggle is unreachable, the Updated button is visually clipped, and the Artefact ID label wraps to two lines."
  affected: "src/public/board.html (#sort-key-seg and #sort-dir-seg inside .controls); src/public/styles.css (.controls at about line 242, .seg and .seg button at about line 262, and the single responsive rule @media (max-width: 880px) near the .lower and .kpi-strip rules)"
  environment: "Any mobile-width browser viewport. Measured at 320px, 375px, 390px and 430px. Desktop widths of 768px and above are unaffected and were confirmed clean."
  tasks: [TL-54-w3me1p task 1]
  notes: "Recommended fix direction from the reviewer: inside the existing @media (max-width: 880px) block in styles.css, let .seg scroll horizontally within its own bounds instead of overflowing the page, with .controls .group { flex-wrap: wrap; min-width: 0; }, .controls .group .seg { max-width: 100%; overflow-x: auto; } and .seg button { flex: none; white-space: nowrap; }. Do not add a new breakpoint. The reviewer checked that shorter button labels alone (for example 'ID' and 'Sev') do not fix it: available width at 375px is 343px, or 297px after the 'Sort' label, which is too narrow for all 5 short labels plus the direction segment. Do not move the sort control behind a drawer or toggle, because the sort state must stay visible on screen to explain the card order the user sees."
  ```

- [ ] ISS-20-en7s3l. Keyboard focus on the sort row's last button stays visually obscured at mobile widths

  ```yaml
  id: ISS-20-en7s3l
  status: in-progress
  severity: medium
  author: Anthony Koukoullis
  description: "At mobile viewport widths the segmented control #sort-key-seg does not fit on screen, so its last button (Updated) sits partially or fully outside the visible area. Keyboard focus still moves to that button when the user tabs to it, confirmed with document.activeElement, but the browser does not scroll the segment's content into view. Up to 34px of the button and its :focus-visible outline (outline: 2px solid var(--accent); outline-offset: 2px) stay hidden behind the screen edge, leaving at most a thin visible sliver. This is a WCAG 2.4.11 Focus Not Obscured (Minimum) failure. It is an accessibility defect, not a security one, so no CWE applies."
  steps_to_reproduce:
    - "Start the dashboard with npm start and open a board page at /board.html?project=<id>."
    - "Set the browser viewport width to 375px."
    - "Press Tab repeatedly until focus reaches the Updated button inside #sort-key-seg, the last of the 5 buttons in that segmented control."
    - "Look at the sort row and confirm that no focus indicator is visible on screen."
    - "Read document.activeElement in the console and confirm that it is the Updated button."
  expected: "A keyboard user who tabs to any control can see that control take focus, with its focus indicator fully visible, as required by WCAG 2.4.11."
  actual: "Focus moves off-screen with no visible indicator. A keyboard-only user tabbing past the visible sort buttons cannot tell which button, if any, holds focus."
  affected: "src/public/board.html (#sort-key-seg inside .controls, lines 33-39); src/public/styles.css (.seg at line 262 and .seg button:focus-visible at line 276)"
  environment: "Mobile-width browser viewports where #sort-key-seg does not fit on screen. Confirmed at 375px, the same class of viewport that ISS-19-ua5166 covers."
  tasks: [TL-54-w3me1p task 1]
  notes: "Found while investigating the fix for ISS-19-ua5166 in this same workstream. The two issues share a root cause, which is that the sort segment does not fit the mobile viewport, but they are distinct defects: ISS-19-ua5166 is page-level layout overflow, this one is keyboard focus visibility, and each reproduces independently. The user has decided for this workstream to fix ISS-19-ua5166 with a wrap-based approach, where .seg wraps its buttons onto more than one row instead of scrolling horizontally. That approach keeps every button, including Updated, fully on screen, so it also resolves this defect as a side effect. If a horizontal-scroll approach is chosen instead, this issue needs its own fix, because a scrolling segment can still hold the focused button out of view."
  ```

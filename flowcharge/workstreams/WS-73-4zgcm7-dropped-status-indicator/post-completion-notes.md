# Post-completion notes — after WS-73

Ad hoc work done directly after WS-73's four tasks landed, in reply to a design
rejection at review. Not a formal Praxis artefact type yet — a placeholder for
the future addendum artefact. Unlike the sibling notes in Praxis-Website, this
one WAS tasked: it became task 5 of `TL-75-23opfs-tasklist.md`, so the change
itself is tracked there and this file only records the reasoning.

## 2026-08-28 — Pill replaced with the app's own dot-plus-word indicator

**What was wrong.** Tasks 1 to 4 shipped `statusBadge(status)`, which built a
coloured pill: `<span class="st-badge">` with an inline background and text
colour. This app already had a per-row status indicator, and it is not a pill.
The board card's plan branch has always drawn a small coloured dot followed by
the status word. On the WS-70-hvf4cd card those two mechanisms ended up in one
list, three plan rows as dots and one task-list row as a pill. `ISS-22-049ixu`
had in fact asked for the dot: its `expected` field reads "in the same way the
plan row shows its status text next to a coloured dot". The pill answered the
issue's symptom and missed its stated shape.

**The design decision.** Unify on dot plus word. All four status indicators a
page can show — the pre-existing plan row, the board card's dropped artefact
row, the modal section header, and the modal issue row — now use one mechanism.

**The label case.** The indicator prints the RAW lower-case status word, not
`STATUS_LABEL['dropped']` ("Dropped"). This closes plan open question 3, which
tasks 1 to 4 had left open by accepting the mismatch. Two reasons. First, the
raw word is already this app's convention wherever a status sits beside
content: `buildCard`'s plan branch prints `a.status`, and `#ws-modal-status`
prints `detail.status`. `STATUS_LABEL` serves the title-case display surfaces,
the column heads and the KPI chips, and it keeps them. Second, unifying the
mechanism made the case difference worse, not better: once the two rows look
identical, a capitalised word one line under a lower-case one reads as a bug.
The WS-70-hvf4cd card is the proof — PLN-59, PLN-61 and TL-72 now read the same
word in the same shape.

**The fix**, task 5 of `TL-75-23opfs-tasklist.md`:

- 5.1 `src/public/app.ts` — `statusBadge` became `statusIndicator`. It returns
  a `<span class="st-ind">` wrapper holding a `dot-sm` dot, coloured inline from
  `var(--st-<status>)` exactly as the plan branch colours its own, and a
  `<span class="st-ind-label">` carrying the status argument itself. It still
  returns one element, so all three call sites kept their single `appendChild`
  and changed by name only. The wrapper is load-bearing: `.dot-sm` declares no
  `display`, so the dot needs a flex parent, and `.ws-item-summary` is
  `display: list-item`. A `DocumentFragment` of two siblings would have worked
  on the card and in the section head and collapsed to nothing in the issue row.
- 5.2 `src/public/styles.css` — `.st-badge` deleted. `.st-ind` (inline-flex,
  6px gap, matching `.artefact-row`'s own gap) and `.st-ind-label` (mono,
  `--ink-faint`, copied from `.artefact-row .a-frac`) added in its place, plus
  `.ws-item-summary .st-ind { margin-left: 6px; }` for the one surface that is
  not a flex container. No new colour token, and `.dot-sm` untouched.

Nothing else moved: no `is-dropped` gating logic, no plan branch, no KPI chip,
no `STATUS_LABEL` map.

**Verified.** `npm run build` clean. Every grep in both tasks returned its
stated count, and the file's unscoped `.is-dropped` count is still 1. Checked in
the browser in light and dark: the board card rows on WS-70-hvf4cd (TL-72, 0/12)
and WS-64-gdxh7m (TL-65, 0/3), both keeping their fractions; the section headers
on WS-70-hvf4cd's Plan tab (PLN-59, PLN-61) and Tasks tab (TL-72) and on
WS-64-gdxh7m's Tasks tab (TL-65); and no non-dropped row, header or task row
changed. The modal issue row has no dropped fixture in this repository, so it
was checked on a throwaway copy of this workstream served by a second server run
with `PRAXIS_DATA_DIR` pointed at the session scratchpad — the real project
registry was never touched, and the copy was deleted afterwards.

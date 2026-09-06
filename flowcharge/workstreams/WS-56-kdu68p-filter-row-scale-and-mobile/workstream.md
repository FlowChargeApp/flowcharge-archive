---
id: WS-56-kdu68p
type: workstream
workstream: WS-56-kdu68p
slug: filter-row-scale-and-mobile
title: "Fix the filter row's small-project gap and scale it for growing tag pools"
status: backlog
tags: [board, ui, ux, issue, feature]
created: 2026-08-21
updated: 2026-08-21
author: Anthony Koukoullis
depends_on: []
links: []
---

Fix a broken edge case and add scaling/mobile features to the board's new filter row (WS-54), raised by a UX review this session after pushback on its first, snapshot-only pass.

**The bug.** The tag-chip qualification rule (count ≥ 2 AND share < 30%) is mathematically dead on any project with 6 or fewer workstreams — the floor and ceiling cross at N > 6.67, so no tag can ever qualify below that size. Such a project shows a `Filter` label with nothing under it: a control that looks broken, not a control with nothing to show. This is a genuine defect in the shipped rule, reachable on any small or newly-registered project, not a missing capability — filed as an issue.

**The features**, from the reviewer's full re-evaluation (their first pass judged desktop layout only against this one project's current 50-workstream snapshot; asked to reconsider generically, for a tag pool that grows over months of use and varies across registered projects, they reversed that conclusion):
- **The 10-chip cap already hides most of the control's own subject.** On this project alone, 48 distinct tags exist, 27 qualify under the current rule, and only 10 display — 17 qualifying tags are unreachable, with nothing on screen indicating a cutoff exists.
- **The hidden tags fall back to the exact mechanism this control was built to replace.** WS-54 exists because free-text substring search unreliably matches tags. Every tag past the cap has no other path than that same unreliable search.
- **Growth actively degrades the ranked set over time**, not just lengthens it: the qualifying set grows with the vocabulary while the display stays pinned at 10; broad tags (e.g. `feature`, `ui`) are excluded today only by the relative share ceiling and will re-qualify and evict selective tags as the project grows; and the pin rule (keeping an active out-of-cap tag visible) makes row height vary with user state in a sticky bar.
- **A flat pill run stops being scannable past roughly a dozen items**, so "just show them all" is not a fix either — the row would grow to multiple wrapped lines on a large pool, directly eating sticky-bar height.
- **Mobile has no responsive handling at all** — WS-54's plan never scoped mobile; the reviewer's live measurement showed the filter row alone taking 124px across 4 wrapped lines at 375px width, and combined with the sort row (WS-55) the sticky `.controls` bar consumes 31% of a phone screen. `Clear` lands alone on the last wrapped line, the least findable spot on the row. There is also a load-time layout jump: `#filter-chips` ships `hidden` and reveals after data loads, growing the bar under the user's thumb.

Full recommendations from the reviewer, to ground the investigation and plan:
- **Add a "More tags…" overflow control** (popover/list) next to a shortened fast-path row (6-8 chips, alphabetical order for stability across polls, each showing its count) — holding the complete tag list, searchable, multi-select, with counts. This is called out as the single change that matters most; it makes the hidden set both visible and reachable at any vocabulary size, and doesn't need the sticky bar to grow.
- Always render an active tag as a chip in the row whether picked from the fast path or the popover — active filter state must never live only inside a closed popover.
- Label the cutoff, e.g. quiet "Top 8 of 27" text beside the `Filter` label.
- Once the popover exists, reconsider the two thresholds — the share ceiling exists only to stop a near-universal tag consuming a scarce fast-path slot, which the popover makes moot; the count floor could drop to 1. This also fixes the ≤6-workstream dead zone described above as the bug, though the bug's own minimal fix (see issue) may land before or independent of this broader rework — the investigation should determine the right relationship between the two.
- Separate the tag axis visually from `Blocked only`/`Clear` (e.g. `margin-left: auto` or a thin rule) and demote `Clear` to a plain text control, since it's an escape hatch, not a peer filter.
- On mobile: turn the tag row into a single-line horizontal scrolling rail (`#filter-tags { display: flex; flex-wrap: nowrap; overflow-x: auto; }`, replacing its current `display: contents`), cap visible chips lower (~5), keep `Blocked only`/`Clear` outside the rail and always visible, drop `position: sticky` on `.controls` below the existing 880px breakpoint (or pin only the search box and result count), and reserve the filter row's height (or reveal without animation) to avoid the load-time layout jump. Do not hide the filter row behind a toggle — a hidden active filter with an empty-looking board is the main confusion risk it creates. On mobile, the popover should open as a full-height sheet, not a small anchored panel.
- Accessibility: neither the filter buttons nor the (separate, WS-55) sort buttons expose active state to a screen reader — add `aria-pressed`; reconsider the bare `Filter`/`Sort` `<label>` elements as group headings rather than form labels.
- Explicitly rejected by the reviewer: a `+17 more` expander that unwraps into more wrapped lines (fixes discoverability, not scannability, and jumps the sticky bar by 100px+); inventing tag categories/grouping (no category axis exists in the frontmatter data, would need per-project maintenance); replacing the chips entirely with a dropdown (loses the one-click fast path for the common case).

Next steps: for the bug, write it up as an issue, investigate the codebase for the best fix, then author spec tasks. For the features, investigate the codebase, write up a plan, then author spec tasks. Execution and commit were not requested yet.

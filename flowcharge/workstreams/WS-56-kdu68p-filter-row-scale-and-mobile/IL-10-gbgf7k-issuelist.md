---
id: IL-10-gbgf7k
type: issuelist
workstream: WS-56-kdu68p
slug: filter-row-scale-and-mobile
title: "Filter row tag-chip qualification defect"
status: ready
created: 2026-08-21
updated: 2026-08-21
depends_on: []
links: []
---

# PRX Issue List

- [ ] ISS-21-5ym0ei. Tag-chip qualification rule shows zero chips on any project of 6 or fewer workstreams

  ```yaml
  id: ISS-21-5ym0ei
  status: in-progress
  severity: medium
  author: Anthony Koukoullis
  description: "The filter row's tag-chip qualification rule has a mathematical dead zone at small workstream counts. A tag earns a chip only when TAG_MIN_COUNT and TAG_MAX_SHARE both hold: count >= 2 AND count / N < 0.30, where N is the project's all-time workstream count. Those two constraints can only both hold when 0.30 * N > 2, that is N >= 7. On any project with 6 or fewer workstreams no tag can qualify under any possible tag distribution, so the Filter label renders above a permanently empty chip area. The pin step cannot recover the row either, because a tag that never renders a chip can never become active. Any newly registered project starts inside this dead zone."
  steps_to_reproduce:
    - "Register a project whose flowcharge/ holds 6 or fewer workstreams in total."
    - "Give two or more of those workstreams the same tag in their workstream.md frontmatter."
    - "Open that project's board and look at the Filter row in the sticky controls bar."
    - "Observe that the Filter label renders with no tag chips under it, although a repeated tag exists."
  expected: "A small project that carries repeated tags shows chips for at least the tags that are actually repeated. The control degrades gracefully at small N instead of going blank."
  actual: "The Filter label renders with an empty tag-chip area, permanently, on every project of 6 or fewer workstreams. The user gets no indication that this is expected rather than a fault, because the same control shows chips normally once a project reaches 7 workstreams."
  affected: "src/public/app.ts — the TAG_MIN_COUNT / TAG_MAX_SHARE qualification filter in refreshFilterTags (added by WS-54), which feeds the #filter-tags chip row"
  environment: "Any registered project with <= 6 total workstreams, all-time count and not the filtered count. This includes brand-new projects and small personal projects, which are normal use of this dashboard."
  tasks: [TL-56-4mxmju.1]
  notes: "Found during a UX review's re-evaluation of the filter row for generic long-term use, not against this project's current 50-workstream snapshot. Scoped narrowly to the dead-zone defect. The minimal correction is for the investigation stage to decide, for example loosening the floor and ceiling so they cannot mathematically exclude every tag at small N. The reviewer's larger recommendation package — a More tags overflow popover, relaxed thresholds once that popover exists, alphabetical ordering, counts on chips — is a separate feature effort tracked elsewhere in this same workstream and is not part of this issue."
  ```

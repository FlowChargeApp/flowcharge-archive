---
id: IL-2-gbn2fu
type: issuelist
workstream: WS-14-3lcwsc
slug: severity-sort-direction-semantics
title: "Severity sort direction semantics findings"
status: done
created: 2026-08-07
updated: 2026-08-07
depends_on: []
links: []
---

# PRX Issue List

- [x] ISS-2-gqq2pl. Severity sort's "Ascending" direction is inverted relative to every other sort key, with no UI indication

  ```yaml
  id: ISS-2-gqq2pl
  status: done
  severity: medium
  description: "The Severity sort pill's 'Ascending' direction shows the most-severe workstreams first and pushes no-open-issue workstreams to the bottom — the reverse of what 'Ascending' means for every other sort key (id, name, created, updated) on the same shared Asc/Desc buttons, with no on-screen cue distinguishing the two conventions."
  steps_to_reproduce:
    - "Open the board and click the 'Severity' sort pill."
    - "Click the default-active 'Ascending' direction button."
    - "Compare against clicking 'Ascending' on the Artefact ID, Name, Created, or Updated pills."
  expected: "'Ascending' should mean the same thing for every sort key sharing one pair of Asc/Desc buttons: smallest/least-urgent value first, matching id/name/created/updated (lowest ID first, A before Z, earliest date first). A user wanting the most severe workstreams surfaced first should get that from 'Descending', consistent with how 'Descending' surfaces the highest ID or most-recently-updated workstream on those keys."
  actual: "'Ascending' on Severity shows workstreams with the most severe open issues (critical, then high, medium, low) first and pushes no-open-issue workstreams to the bottom — backwards relative to id/name/created/updated's Ascending behavior on the same two buttons, silently and with no UI indication that Severity's convention differs."
  affected: "src/public/app.ts (severityCmp() at line 50, and renderBoard()'s comparator dispatch at line 166, which calls severityCmp(sevMix![a.id], sevMix![b.id]) while the id/name/created/updated branches at lines 162-165 all compute cmp in the ordinary a-then-b direction)"
  environment: ""
  tasks: []
  notes: "Deliberate per the WS-8 merge commit (11cb944), which reversed severityCmp's operands specifically so 'Asc' means most-severe-first for this key. The WS-10 merge commit (5d9d860) independently reaffirms Created/Updated do NOT copy this reversed convention, contrasting themselves against severity's reversed one by name. WS-9's per-card severity dot and WS-11's sort-button severity dot both use dominantSeverity(), which reads SEV_ORDER directly and does not depend on sortKey/sortDir/severityCmp, so they are unaffected by any change here. Investigation confirmed only Severity has this inconsistency; id/name/created/updated are already correct and consistent with each other."
  ```

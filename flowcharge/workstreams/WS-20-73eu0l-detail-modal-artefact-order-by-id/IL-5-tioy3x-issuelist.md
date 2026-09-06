---
id: IL-5-tioy3x
type: issuelist
workstream: WS-20-73eu0l
slug: detail-modal-artefact-order-by-id
title: "Detail modal artefact ordering findings"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: []
links: []
---

# PRX Issue List

- [x] ISS-6-quhxra. Detail modal orders artefact sections by filename, so artefact IDs appear out of order

  ```yaml
  id: ISS-6-quhxra
  status: done
  severity: low
  description: >
    extractWorkstreamDetail() walks the workstream folder with
    fs.readdirSync(found.dir).sort() and pushes each artefact into the issueLists
    array or the taskLists array in filename-ascending order. The modal prints the
    artefact ID in every section header, but the reader never sees the filename, so
    the visible identifiers do not ascend. A hyphen sorts before a full stop in
    ASCII, so a qualified file such as issuelist-<qualifier>.md always precedes
    the plain issuelist.md, whatever IDs the two carry.
  steps_to_reproduce:
    - "Open a board for a project that has a workstream folder holding both a plain and a qualified artefact file, for example /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD."
    - "Open the detail modal for workstream WS-124 (folder flowcharge/workstreams/WS-124-service-reference-inconsistencies-issue-list/)."
    - "Read the Issues tab section headers from top to bottom."
  expected: >
    Artefact sections appear in ascending artefact ID order. The numeric part of an
    ID must compare numerically, not as text, so IL-9 sorts before IL-85. The
    existing explicit .sort() on the directory walk must stay, because that call is
    what makes the walk deterministic across platforms, as the comment above it
    records.
  actual: >
    The Issues tab lists IL-85 (from issuelist-tl174-test-fallout.md) before
    IL-84 (from issuelist.md), because the qualified filename sorts first. The
    two task lists in the same folder land in ascending ID order only by
    coincidence, because TL-174 happens to live in the qualified file
    tasklist-tl174-reconstructed.md and TL-175 in the plain tasklist.md.
  affected: "src/lib/detail.ts, function extractWorkstreamDetail() — the directory walk at line 218 and the issueLists/taskLists construction at lines 213-214 and 238-239"
  environment: ""
  tasks: [TL-19-ff31qo task 1]
  notes: >
    No data is lost, nothing crashes, and every artefact is present and readable.
    The panel simply looks unsorted, and a workstream with several artefacts is
    harder to scan. Confidence is high: the sort call and the array construction
    were read directly in src/lib/detail.ts, and the four filenames and their IDs
    were read directly from the LAD folder. Whether issue lists and task lists
    should be interleaved or stay as two separate arrays is a later design step and
    is deliberately not decided here.
  ```

# Praxis-Launch baseline — captured before the Phase 4 migration

Captured 2026-08-17 by task 4.1, before any dry run.
Source: dist/scripts/extract-praxis-data.js, the dashboard's own extraction path.
The --check output is saved alongside as praxis-launch-check.txt.

- Workstream count: 1
- Issue count: 0
- Artefact count: 4 (WS-31, PLN-23, TL-25, TL-26)
- Claim markers: 1 (flowcharge/ids/TL-26)

## Workstream order, as the dashboard renders it

1. WS-31 — Release Praxis publicly as an open-source Claude Code plugin [in-progress]

## Artefact order within each workstream

### WS-31
1. PLN-23 (plan, ready)
2. TL-25 (tasklist, ready, 0/7 done)
3. TL-26 (tasklist, ready, 0/49 done)

## Issue order

- (none — this project has no issue list)

## Folder layout

- flowcharge/workstreams/WS-31-open-source-launch/workstream.md (WS-31)
- flowcharge/workstreams/WS-31-open-source-launch/plan.md (PLN-23)
- flowcharge/workstreams/WS-31-open-source-launch/tasklist-git-history.md (TL-25)
- flowcharge/workstreams/WS-31-open-source-launch/tasklist.md (TL-26)

## Praxis-Website reference state

`git -C /Users/akoukoullis/Work/AK/Praxis-Website status --porcelain` printed nothing
before the run. Praxis-Website is out of scope and must print nothing after it too.

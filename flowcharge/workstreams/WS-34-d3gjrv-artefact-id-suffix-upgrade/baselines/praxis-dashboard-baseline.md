# Praxis-Dashboard baseline — captured before the Phase 3 migration

Captured 2026-08-17 by task 3, before any dry run.
Source: dist/scripts/extract-praxis-data.js, the dashboard own extraction path.
The --check output is saved alongside as praxis-dashboard-check.txt.
The raw payload is saved alongside as praxis-dashboard-data.json.

- Workstream count: 31
- Issue count: 10

## Workstream order, as the dashboard renders it

1. WS-1 — Convert the source to TypeScript [done]
2. WS-10 — Board sort by date created/updated [done]
3. WS-11 — Sort button severity cue [done]
4. WS-13 — Workstream detail modal: tags, dates, severity [done]
5. WS-14 — Reconsider Severity sort's Ascending direction [done]
6. WS-15 — Detail modal Tasks tab shows fewer tasks than its own count [done]
7. WS-16 — Task-list fence scanner silently discards tasks [done]
8. WS-17 — Board card total counts checkbox lines that are not tasks [done]
9. WS-18 — Open the server bind beyond loopback [done]
10. WS-19 — Delete and rename projects from the home page [done]
11. WS-2 — Split hand-written source into src/ and build output into dist/ [done]
12. WS-20 — Detail modal orders artefact sections by filename, not artefact ID [done]
13. WS-21 — A workstream's plan is not readable on the detail screen or the board card [done]
14. WS-22 — Rename and Delete on project tiles become icon buttons at the top right [done]
15. WS-23 — Long plans load in full on the workstream details modal's Plan tab [done]
16. WS-24 — Switch the dashboard's heading font from the system serif to Fraunces [done]
17. WS-25 — Make workstream card dependencies visible on the board [done]
18. WS-26 — Render markdown tables in plans as HTML tables in the workstream details modal [in-progress]
19. WS-27 — Open workstream detail modal doesn't reflect live source changes [in-progress]
20. WS-28 — Migrate dashboard frontend to a lean modern component framework [in-progress]
21. WS-29 — Let a home-page project tile's folder path be edited, and show a modified date [in-progress]
22. WS-3 — Multi-project home page with project tiles [done]
23. WS-30 — Rename workstream folders to WS-N-<slug> across every other project on the dashboard [done]
24. WS-34-d3gjrv — Upgrade every artefact ID across all dashboard-registered projects to the TYPE-N-SUFFIX form [in-progress]
25. WS-35-970q8q — Fix this dashboard's code so it reads the new TYPE-N-SUFFIX artefact ID shape [done]
26. WS-4 — Extract the inline stylesheet out of index.html into its own CSS file [done]
27. WS-5 — Card detail modal with Issues and Tasks tabs [done]
28. WS-6 — Display the current git branch name of the project being viewed [done]
29. WS-7 — Live board refresh from flowcharge changes [done]
30. WS-8 — Board sort by severity [done]
31. WS-9 — Board severity cue [done]

## Artefact order within each workstream

### WS-1
1. PLN-3 (plan)
2. TL-4 (tasklist)

### WS-10
1. PLN-10 (plan)
2. TL-11 (tasklist)

### WS-11
1. PLN-11 (plan)
2. TL-12 (tasklist)

### WS-13
1. PLN-12 (plan)
2. TL-13 (tasklist)

### WS-14
1. IL-2 (issuelist)
2. TL-14 (tasklist)

### WS-15
1. PLN-13 (plan)
2. TL-16 (tasklist)

### WS-16
1. IL-3 (issuelist)
2. TL-15 (tasklist)

### WS-17
1. IL-4 (issuelist)
2. TL-17 (tasklist)

### WS-18
1. PLN-18 (plan)
2. TL-23 (tasklist)

### WS-19
1. PLN-14 (plan)
2. TL-18 (tasklist)

### WS-2
1. PLN-2 (plan)
2. TL-3 (tasklist)

### WS-20
1. PLN-16 (plan)
2. IL-5 (issuelist)
3. TL-19 (tasklist)
4. TL-21 (tasklist)

### WS-21
1. PLN-17 (plan)
2. TL-22 (tasklist)

### WS-22
1. PLN-15 (plan)
2. TL-20 (tasklist)

### WS-23
1. PLN-19 (plan)
2. TL-24 (tasklist)

### WS-24
1. PLN-20 (plan)
2. TL-25 (tasklist)

### WS-25
1. PLN-21 (plan)
2. TL-26 (tasklist)

### WS-26
1. PLN-22 (plan)
2. TL-27 (tasklist)

### WS-27
- (none listed)

### WS-28
- (none listed)

### WS-29
1. PLN-23 (plan)
2. TL-28 (tasklist)

### WS-3
1. PLN-4 (plan)
2. TL-5 (tasklist)

### WS-30
1. TL-29 (tasklist)

### WS-34-d3gjrv
1. PLN-25-0agr4z (plan)
2. TL-30-gju8tp (tasklist)

### WS-35-970q8q
1. IL-6-ngnx6e (issuelist)
2. TL-31-m0bhqi (tasklist)

### WS-4
1. PLN-1 (plan)
2. IL-1 (issuelist)
3. TL-1 (tasklist)
4. TL-2 (tasklist)

### WS-5
1. PLN-5 (plan)
2. TL-6 (tasklist)

### WS-6
1. PLN-6 (plan)
2. TL-7 (tasklist)

### WS-7
1. PLN-7 (plan)
2. TL-8 (tasklist)

### WS-8
1. PLN-8 (plan)
2. TL-9 (tasklist)

### WS-9
1. PLN-9 (plan)
2. TL-10 (tasklist)

## Issue order

1. ISS-2 — Severity sort's "Ascending" direction is inverted relative to every other sort key, with no UI indication
2. ISS-3 — collectItems() silently discards every item after an unbalanced indented code fence
3. ISS-4 — collectItems() swallows every item between an unterminated fence opener and a later unrelated closer at the same indentation
4. ISS-5 — countChecks() counts checkbox-shaped prose lines as tasks, so the card total overstates the count and contradicts the detail modal
5. ISS-6 — Detail modal orders artefact sections by filename, so artefact IDs appear out of order
6. ISS-7-2zokm9 — Workstream detail request returns HTTP 400 for suffixed workstream ids
7. ISS-8-8httpx — Issues with suffixed ids are silently dropped by the issue-line parser
8. ISS-9-xzo6ao — artefactIdNumber reads the sort key from the random suffix, not the sequence number
9. ISS-10-5b1rra — wsIdNum fuses the sequence number with the suffix digits and mis-sorts the board
10. ISS-1 — In-progress status colour resolves to transparent (`--st-in-progress` never defined)

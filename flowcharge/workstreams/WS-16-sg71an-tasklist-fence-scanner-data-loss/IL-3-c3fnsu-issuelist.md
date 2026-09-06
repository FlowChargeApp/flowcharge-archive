---
id: IL-3-c3fnsu
type: issuelist
workstream: WS-16-sg71an
slug: tasklist-fence-scanner-data-loss
title: "Task-list fence scanner data-loss findings"
status: done
created: 2026-08-07
updated: 2026-08-08
depends_on: []
links: []
---

# PRX Issue List

- [x] ISS-3-mx32cr. collectItems() silently discards every item after an unbalanced indented code fence

  ```yaml
  id: ISS-3-mx32cr
  status: done
  severity: high
  description: "collectItems() in src/lib/detail.ts walks a file body once and pairs each item line with the first yaml fence that follows it. When it meets an opening fence it captures that fence's leading whitespace as fm[1] and builds closer = fm[1] + backticks (line 60). It then scans forward for a line that, after trailing whitespace is stripped, equals closer EXACTLY (line 62), so a closing fence at any other indentation does not match. If no matching closer is found, j reaches lines.length and line 67 sets i = lines.length. The walk ends. Every item line after the opening fence is never examined and never enters out. The failure is silent: there is no throw, no warning and no partial-result signal, so the caller receives a short list that looks complete. The dashboard is read-only over other projects' flowcharge/ folders and does not own or write the task-list files it reads, so it cannot fix the malformed source and must tolerate malformed input."
  steps_to_reproduce:
    - "Register the project at /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD on the dashboard home page and open its board."
    - "Note that the card for WS-139 reports 29 tasks, a total that comes from countChecks() in src/lib/extract.ts:31-42, which is fence-blind and counts all 29 checkbox lines."
    - "Open the WS-139 card's detail modal and select the Tasks tab."
    - "Compare the modal's task count against the card's task count."
    - "Read flowcharge/workstreams/WS-139-testing-strategies-bug-fixes/tasklist.md in that project: line 34 opens a fence indented by four spaces, no four-space closer follows it, lines 40 and 50 are an eight-space typescript pair that does not match the four-space closer, and line 67 is the next task line."
  expected: "collectItems() should keep walking the remaining item lines when an opening fence has no matching closer at its own indentation, so the detail modal lists every task that exists on disk and its count agrees with the card's count. If any items cannot be parsed, the loss should be signalled rather than silent."
  actual: "The scan runs to end of file and swallows every task from line 34 onward. The detail modal's Tasks tab for WS-139 reports 2 tasks while the card behind it reports 29. The two numbers contradict each other and the modal is the one that is wrong. No error, warning or partial-result signal is produced."
  affected: "src/lib/detail.ts, function collectItems() at lines 50-81 — specifically the closer search at line 62 and the resume assignment at line 67. The contradicting count comes from countChecks() in src/lib/extract.ts:31-42. Symptom is visible in the detail modal's Tasks tab and on the board card."
  environment: "Read-only extraction over another project's flowcharge/ folder. Reproduced against /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD. flowcharge/ is gitignored in these projects, so the LAD artefacts exist on disk only and are not in any repository."
  tasks: [TL-15-c60hpn task 1]
  notes: "Scope: 17 of the 138 LAD workstreams show this card-versus-modal disagreement. Further confirmed examples: WS-56 shows 30 on the card and 2 in the modal, and WS-74 shows 105 on the card and 93 in the modal. The malformed input is a real condition in the corpus this dashboard is built to read. Every claim was verified by reading the named source lines and by running the real extraction against the real workstream folders on disk. Not this issue: the Tasks tab showing fewer rows than its label because sub-tasks sit inside collapsed parent groups. That is a separate, already-triaged matter belonging to WS-15 and is not a defect. WS-124 in LAD is affected by that matter and is NOT affected by this one."
  ```

- [x] ISS-4-l56ap3. collectItems() swallows every item between an unterminated fence opener and a later unrelated closer at the same indentation

  ```yaml
  id: ISS-4-l56ap3
  status: done
  severity: high
  description: "This is a second, still-live variant of the fence defect recorded as ISS-3. It is NOT ISS-3 and it is not fixed by the ISS-3 fix. In collectItems() in src/lib/detail.ts the closer search at line 66 scans forward for the FIRST line that, after trailing whitespace is stripped, equals fm[1] + backticks exactly. The early-continue added by the ISS-3 fix at lines 71-74 only fires when that search reaches lines.length. When an opener's own closer was never written, the search does not usually reach end of file. It instead matches a LATER, unrelated bare closer at the same indentation, typically the closing fence of a different item further down the file. Because j is then less than lines.length, the early-continue never fires. The walk jumps to j + 1 and every item line between the unterminated opener and that distant closer is never examined and never reaches out. When the opener was a yaml opener, lines.slice(i + 1, j) at line 76 spans that whole unrelated region and is attached as the current item's fields, so one item's metadata absorbs the text of every item in between. The failure is silent: nothing throws and nothing warns, so the caller receives a short list that looks complete. The dashboard is read-only over other projects' flowcharge/ folders. It cannot repair the malformed source files and must tolerate malformed input."
  steps_to_reproduce:
    - "Check out branch feature/tasklist-fence-scanner-data-loss, which already carries the ISS-3 fix applied by TL-15 task 1."
    - "Register the project at /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD on the dashboard home page and open its board."
    - "Note that the card for WS-139 reports 29 tasks, a total that comes from countChecks() in src/lib/extract.ts and is fence-blind."
    - "Open the WS-139 card's detail modal and select the Tasks tab, then compare its task count against the card's count."
    - "Read flowcharge/workstreams/WS-139-testing-strategies-bug-fixes/tasklist.md in that project: line 288 opens a yaml fence indented by two spaces and no two-space closer follows it, the next two-space bare closer is line 444, and task lines 333, 387 and 441 sit between them."
    - "Expand task 3 in the modal and read its description field, which ends with the text of task 6."
    - "Repeat with WS-56, whose file flowcharge/workstreams/WS-56-create-task-lists-bug-fixes/tasklist.md has unterminated openers at lines 25 and 676."
  expected: "collectItems() should keep examining the remaining item lines when an opening fence has no closer of its own, so the detail modal lists every task that exists on disk and its count agrees with the card's count. No item's fields should ever be populated from a region that spans other items. If any items cannot be parsed, the loss should be signalled rather than silent."
  actual: "The closer search binds the unterminated opener to a distant unrelated closer. Every item line between them is skipped and never reaches the output list, and the intervening text is attached as the preceding item's fields. After the ISS-3 fix the WS-139 detail modal reports 24 tasks against a card total of 29, and task 3 of that file parses lines 289-443 as its YAML block so its description field ends with the text of task 6. WS-56 reports 25 against a card total of 30. No error, warning or partial-result signal is produced."
  affected: "src/lib/detail.ts, function collectItems() at lines 54-93 — specifically the closer search at line 66, the j >= lines.length early-continue at lines 71-74 that does not reach this case, the fields assignment at line 76 and the resume assignment at line 79. Both call paths are affected, parseIssueItems() and flatTasks(). The contradicting count comes from countChecks() in src/lib/extract.ts. Symptom is visible in the detail modal's Issues and Tasks tabs and on the board card."
  environment: "Read-only extraction over another project's flowcharge/ folder. Reproduced on branch feature/tasklist-fence-scanner-data-loss against /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD. flowcharge/ is gitignored in these projects, so the LAD artefacts exist on disk only and are in no repository."
  tasks: [TL-15-c60hpn task 2]
  notes: "Do not re-file or re-open ISS-3. The ISS-3 fix works: a replay across all 247 LAD task and issue lists shows zero items still swallowed by an opener reaching end of file, and it recovered 94 previously-dropped items across 175 workstreams. This issue is the remaining variant that fix does not reach. Scope: 15 LAD files still exhibit this variant after the ISS-3 fix. Card-versus-modal mismatches across the corpus fell from 18 to 16 when the ISS-3 fix was applied, and this variant accounts for 15 of the 16 that remain. Confidence is high: every claim was verified by a replay of the real extraction over the real LAD corpus on this branch. Constraint on any remedy: the obvious fix of bounding the closer search at the next item line is explicitly forbidden by the gotcha field of TL-15 task 1, on the grounds that it would break the guarantee that a checkbox bullet quoted inside an item's own body is not an item. The owner has decided that constraint must now be re-opened and re-decided deliberately rather than quietly overridden. This issue records the finding only and prescribes no implementation. Not this issue: the LAD WS-74 card-versus-modal gap, which has a different cause (countChecks() counting checkbox-shaped lines that are not task items) and is recorded under WS-17; and the Tasks tab rendering fewer rows than its label because sub-tasks sit in collapsed parent groups, which belongs to WS-15 and is not a defect."
  ```

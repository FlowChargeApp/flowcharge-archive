---
id: IL-4-il5cwb
type: issuelist
workstream: WS-17-q6z7rp
slug: card-total-counts-non-task-lines
title: "Board card task total counts checkbox lines that are not tasks"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: []
links: [WS-16-sg71an]
---

# PRX Issue List

- [x] ISS-5-b8j9k1. countChecks() counts checkbox-shaped prose lines as tasks, so the card total overstates the count and contradicts the detail modal

  ```yaml
  id: ISS-5-b8j9k1
  status: done
  severity: medium
  description: "countChecks() in src/lib/extract.ts (lines 31-42) matches every line of a task list against /^\\s*-\\s*\\[( |x|X)\\]/ and increments total on each hit, and done when the mark is x. The regex requires only leading whitespace, a dash and a bracketed mark. It does not require a task number and it does not track code fences. The detail path applies a stricter rule over the same file: TASK_ITEM in src/lib/detail.ts (line 21) is /^(\\s*)-\\s*\\[([ xX])\\]\\s*(\\d+(?:\\.\\d+)*)\\.?\\s+(.*)$/, which additionally requires a numeric task number such as 1 or 3.2, so a checkbox bullet with no number is correctly rejected. collectItems() in the same file also skips anything inside a balanced code fence. Two different rules therefore produce two counts over one file, and they disagree whenever the file holds a checkbox-shaped line that is not a numbered task. The board card shows the countChecks() total and the detail modal shows the detail-path total, so the user sees the two numbers side by side."
  steps_to_reproduce:
    - "Register the project at /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD on the dashboard home page and open its board."
    - "Find the card for WS-74 and read its task total, which is 98."
    - "Open the WS-74 card's detail modal, select the Tasks tab and read its task count, which is 86."
    - "Read flowcharge/workstreams/WS-74-express-stack-guidance-fixes/tasklist.md in that project: lines 2555 to 2566 hold twelve checkbox bullets nested eight spaces deep inside one task's own body, written as deployment-checklist prose such as `pnpm run build` completes without TypeScript errors, Server binds to PORT env var (not hardcoded), and `/api/health` endpoint returns 200. None of the twelve carries a task number."
    - "Confirm that 98 minus 86 is 12, which is exactly the number of unnumbered prose bullets in that file."
  expected: "The board card's task total and the detail modal's task count should agree for the same file, and neither should treat an unnumbered checkbox bullet inside a task's body as a task."
  actual: "countChecks() counts all twelve prose bullets and the detail path rejects all twelve. The card reads 98 while the modal opened from that same card reads 86. A user reasonably concludes that twelve tasks are missing from the modal, when the modal is right and the card is wrong."
  affected: "src/lib/extract.ts, function countChecks() at lines 31-42 and its use at lines 67-69, which set entry.total and entry.done. The disagreeing count comes from TASK_ITEM at src/lib/detail.ts line 21 and from collectItems() in the same file. The symptom is visible on the board card and in the detail modal's Tasks tab."
  environment: "Read-only extraction over another project's flowcharge/ folder. Observed against /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD. flowcharge/ is gitignored in these projects, so the LAD artefacts exist on disk only and are in no repository."
  tasks: [TL-17-51udvr]
  notes: "Record the finding only. Do not prescribe which of the two counters should change or how. The owner has not decided whether the card should adopt the detail path's stricter rule or whether some other reconciliation is right, and that decision belongs to a later planning step. No data is lost and nothing crashes; the card simply reports a total that is too high and disagrees with the modal. Confidence is high: both regexes and LAD lines 2555 to 2566 were read directly, and the twelve-line difference matches the observed 98-versus-86 gap exactly. Found while executing WS-16 and deliberately excluded from that workstream's scope, because the cause is in a different file and no change to collectItems() can reconcile it. Not this issue: collectItems() losing items after an unterminated code fence, which is ISS-3 and ISS-4 under WS-16 and is being fixed on a separate branch; and the Tasks tab rendering fewer rows than its label because sub-tasks sit inside collapsed parent groups, which belongs to WS-15 and was triaged as not a defect."
  ```

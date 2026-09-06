---
id: TL-15-c60hpn
type: tasklist
workstream: WS-16-sg71an
slug: tasklist-fence-scanner-data-loss
title: "Task-list fence scanner data-loss fix"
status: done
created: 2026-08-07
updated: 2026-08-08
depends_on: [IL-3-c3fnsu]
links: []
mode: spec
base_commit: dc47e01
---

# PRX Tasks

## Task-list fence scanner data loss

`collectItems()` in `src/lib/detail.ts` is the single walker shared by the issue path (`parseIssueItems`) and the task path (`flatTasks`). It scans the file body once. When it meets a line matching `FENCE`, it builds `closer = fm[1] + '```'` and scans forward for a line that equals that closer exactly after trailing whitespace is stripped. If no such line exists, `j` reaches `lines.length` and the resume assignment sets `i = lines.length`, which ends the walk. Every item line after that opening fence is never examined and never reaches `out`. Nothing throws and nothing warns, so the caller receives a short list that looks complete.

The dashboard is strictly read-only over other projects' `flowcharge/` folders. It never writes the task-list files it reads, so it cannot repair a malformed source file and must tolerate malformed input instead. The correction is therefore confined to the walker: an opening fence with no closer at its own indentation is treated as not a fence, and the walk resumes at the following line. The unterminated block is not attached as YAML, because its extent is unknown and slicing to end of file would swallow every later item into one field. Once no items are lost, there is nothing left to signal, so no logging and no UI warning are added.

`countChecks()` in `src/lib/extract.ts` is fence-blind by design and produces the card's total. It is the correct number and the reference this fix converges on. It is not changed.

Task 1 corrected only the variant where the closer search runs to end of file. A second variant remains, recorded as ISS-4. When an opener's own closer was never written, the search usually does not reach end of file. It matches a later, unrelated bare closer at the same indentation, so `j` is less than `lines.length` and task 1's early-continue never fires. Every item line between the two is swallowed, and a `yaml` opener also attaches that whole region as the preceding item's `fields`. Task 2 corrects that variant by bounding the closer search — not at the next item line, but at the next fence opener with a non-empty info string at the opener's own indentation. That boundary keeps the guarantee that item lines are never looked for inside a fence.

- [x] 1. Resume the `collectItems()` walk after an unterminated fence in `src/lib/detail.ts`

  ```yaml
  description: "Correct collectItems() so an opening code fence with no closer at its own indentation no longer ends the walk at end of file. The walker must keep examining the remaining item lines, so the detail modal lists every task that exists on disk and its count agrees with the board card's count."
  issues: [ISS-3-mx32cr]
  implement:
    - "In src/lib/detail.ts, inside collectItems() (lines 50-81), in the `if (fm)` branch that begins at line 59: after the closer search loop completes, distinguish the found case from the not-found case. When the loop ends because `j` reached `lines.length`, the opener has no closer at its own indentation. Treat that line as ordinary text rather than a fence — advance by a single line and continue the walk, so every later item line is still examined. Only when a closer was genuinely found should the walk jump past it. This replaces the resume assignment at line 67, which currently collapses both cases into one expression and sets `i = lines.length` for the not-found case."
    - "Guard the YAML attachment at lines 63-64 with the same distinction. `lines.slice(i + 1, j)` is only a block body when a closer was found; with `j === lines.length` it is the whole remainder of the file, so attaching it would fold every later item's text into one item's `fields`. An unterminated fence must therefore attach nothing, leaving that item's `fields` as `{}` and leaving `attached` false."
    - |
      Illustrative only — not a literal edit. It shows the shape of the branch, not the text to paste:
      ```ts
      if (fm) {
        const closer = fm[1] + '```';
        let j = i + 1;
        while (j < lines.length && lines[j].replace(/\s+$/, '') !== closer) j++;
        if (j >= lines.length) { i++; continue; }   // unterminated: not a fence
        if (fm[2].trim() === 'yaml' && current && !attached) { /* unchanged */ }
        i = j + 1;
        continue;
      }
      ```
    - "Extend the existing comment above collectItems() (lines 45-49) and/or the FENCE comment (lines 23-25) with one sentence stating the new rule: an opener whose closer never appears at its own indentation is not treated as a fence. Both comments currently describe only the balanced case, so leaving them unchanged makes them wrong."
  pattern: "src/lib/detail.ts only. The change is confined to the `if (fm)` branch of collectItems() plus the two comments that describe it. No other file is touched."
  imports: "None. No new import, no new module, no new package. This repository has zero runtime dependencies and that constraint is absolute — adding one is a failure of the task, not a fix."
  compatibility: "collectItems() is shared by BOTH parseIssueItems() (line 86) and flatTasks() (line 99); the comment at lines 45-49 states this explicitly. Any behaviour change lands on issue extraction as well as task extraction, so the correction must be safe for issue lists too. For any well-formed file every opener has a closer, so `j < lines.length` always holds and behaviour is byte-identical to today — the change is reachable only on malformed input. flatTasks() feeds buildTaskTree() (lines 113-144), which throws 'task tree lost N of M tasks' when parents plus children do not equal the flat count; recovering more tasks must not trip that assertion. The returned shapes PraxisIssueDetail and PraxisTaskDetail are unchanged, so src/public/app.ts and src/scripts/extract-praxis-data.ts need no edit. src/public/tsconfig.json compiles with module 'none', but that constrains src/public/ only; src/lib/ is ordinary ESM and is unaffected."
  gotcha: "Do NOT attach an unterminated block's body as YAML. `parseYamlBlock(stripCommonIndent(lines.slice(i + 1, j)))` with `j === lines.length` parses the rest of the file and destroys far more than it recovers. An item under an unterminated fence therefore ends with `fields: {}` — that is the accepted trade-off, and losing one item's metadata is correct in preference to losing every later item. Do NOT bound the closer search at the next item line as an alternative fix: the comment at lines 45-49 guarantees that item lines are never looked for inside a fence, so a checkbox bullet quoted inside a task's own body is not an item, and bounding the search would break that guarantee. Do NOT change countChecks() in src/lib/extract.ts (lines 31-42) — it is deliberately fence-blind, it is the correct total, and it is the number this fix converges on. Do NOT add a Markdown parser, a fence-recovery mode, an option, a log line, or a UI warning; once nothing is lost there is nothing to report, and the issue list's 'signal the loss' wording is satisfied by removing the loss. Resuming the walk can in principle surface a line inside an unterminated block that looks like an item; in the reference corpus the inner blocks are deeper-indented balanced fences that are still skipped correctly, so this is accepted and must not grow a heuristic to suppress it. `npm run lint` does not exist in this repository — package.json defines only build, prestart, start, prerefresh and refresh."
  verify:
    - "npx tsc --noEmit -p tsconfig.json"
    - "npm run build"
    - "node dist/scripts/extract-praxis-data.js against /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD, then compare the detail payload's task count for WS-139 with the card's total from countChecks(). The two must agree. Read that project's flowcharge/ only — never write to it."
  checklist:
    - "The detail modal's task count for LAD WS-139 equals the board card's count for the same workstream, and the same holds for WS-56. WS-74 is deliberately excluded: its gap is countChecks() counting checkbox-shaped lines that are not task items, which no change to collectItems() can reconcile, and it is recorded separately under WS-17"
    - "No item line after an unterminated fence is dropped from collectItems()'s output for any file in the LAD corpus"
    - "Extraction over a well-formed file produces byte-identical output to the pre-change behaviour, for both the issue path and the task path"
    - "buildTaskTree() does not throw 'task tree lost N of M tasks' for any LAD workstream after the change"
    - "No item's fields are populated from a block whose closer was never found"
    - "countChecks() in src/lib/extract.ts is unchanged, and no file other than src/lib/detail.ts is modified"
    - "No package was added and the repository still has zero runtime dependencies"
  self_eval:
    passed: true
    failures: []
  ```

- [x] 2. Bound the `collectItems()` closer search at the next same-indent fence opener in `src/lib/detail.ts`

  ```yaml
  description: "Correct collectItems() so an opener whose own closer was never written can no longer adopt a later, unrelated bare closer at the same indentation. The walker must keep examining the item lines that sit between the two, and must not attach that region as the preceding item's fields."
  issues: [ISS-4-l56ap3]
  implement:
    - "In src/lib/detail.ts, inside collectItems(), in the closer search that currently reads `while (j < lines.length && lines[j].replace(/\\s+$/, '') !== closer) j++;`: give the search a second exit. Stop it when a line is itself a FENCE match whose capture 1 equals the opener's capture 1 exactly and whose capture 2 has a non-empty trim. Such a line is a new opener at the opener's own indentation, so the opener above it was never closed."
    - "Feed that second exit into the same not-a-fence path task 1 already built. The `if (j >= lines.length) { i++; continue; }` early-continue is the only place that treats an opener as ordinary text; the new exit must reach it too, so the two unterminated cases share one branch rather than growing a second one. Nothing is attached and the walk resumes on the very next line, exactly as for the end-of-file case."
    - "Order matters: the closer comparison must still be evaluated before the new exit. A bare closer written with trailing whitespace strips to `closer` and matches first, so it can never be mistaken for an opener. The new exit is therefore reachable only on a fence line that carries an info string."
    - |
      Illustrative only — not a literal edit. It shows the shape of the second exit, not the text to paste:
      ```ts
      let j = i + 1;
      let unclosed = false;
      while (j < lines.length && lines[j].replace(/\s+$/, '') !== closer) {
        const g = FENCE.exec(lines[j]);
        if (g && g[1] === fm[1] && g[2].trim() !== '') { unclosed = true; break; }
        j++;
      }
      if (unclosed || j >= lines.length) { i++; continue; }
      ```
    - "Extend the `FENCE` comment and the `collectItems()` comment with one sentence for the new rule: a fence opener at the opener's own indentation ends the closer search, because a well-formed block closes before another block opens beside it. Both comments currently describe only the end-of-file case that task 1 added, so leaving them unchanged makes them incomplete."
  pattern: "src/lib/detail.ts only. The change is confined to the closer search and its early-continue inside collectItems(), plus the two comments that describe them. No other file is touched."
  imports: "None. No new import, no new module, no new package. This repository has zero runtime dependencies and that constraint is absolute — adding one is a failure of the task, not a fix."
  compatibility: "The new exit must compare leading whitespace as an exact string, the way `closer` is already built by concatenating capture 1 with three backticks. A length comparison would treat a tab-indented opener and a space-indented opener as the same indentation. collectItems() is shared by BOTH parseIssueItems() and flatTasks(), so the change lands on issue extraction as well as task extraction; a replay over the LAD corpus confirms one issue list, WS-74's, is among the files it corrects. flatTasks() feeds buildTaskTree(), which throws 'task tree lost N of M tasks' when parents plus children do not equal the flat count; a replay of the bounded walk over all 162 LAD task lists produces zero throws, so recovering these items does not trip it. The returned shapes PraxisIssueDetail and PraxisTaskDetail are unchanged, so src/public/app.ts and src/scripts/extract-praxis-data.ts need no edit. src/public/tsconfig.json compiles with module 'none', but that constrains src/public/ only; src/lib/ is ordinary ESM and is unaffected. Task 1's end-of-file early-continue stays and keeps working — task 2 adds a second way to reach it, it does not replace it."
  gotcha: "THE RE-OPENED CONSTRAINT, DECIDED. Task 1's gotcha forbids bounding the closer search at the next item line. The owner re-opened that constraint for this task. The decision taken here is to bound the search, but at a fence opener rather than at an item line. The guarantee task 1 defended is therefore KEPT, not traded: a checkbox bullet quoted inside an item's own body is still never looked for inside a fence, it is still not an item, and the item that owns that body still receives its fields. Do NOT bound at the next item line. It was evaluated against the real corpus and rejected on evidence: it recovers exactly the same 51 items in exactly the same 15 files, so it buys nothing, and it regresses well-formed input. On a well-formed task whose body quotes a line shaped like `- [ ] 2. Example`, bounding at item lines makes the enclosing fence look unterminated, drops that task's fields, and promotes the quoted bullet to a real item with a duplicate number. The fence-opener bound leaves that same file byte-identical to today. The cost actually paid is a narrower assumption: a nested fence inside a block must be indented deeper than the block it sits in. That is the assumption the FENCE comment already states, so no new assumption is introduced. Where an unterminated opener is followed by a second block that does close, the item keeps its first fence discarded and takes its fields from that second block — LAD WS-117 task 7.1 is the one instance in the corpus. That is accepted; the alternative attaches a region spanning a stray opener, which parses worse. Do NOT change countChecks() in src/lib/extract.ts — it is deliberately fence-blind, it is the correct total, and it is the number this fix converges on. Do NOT add a Markdown parser, a fence-recovery mode, an option, a log line or a UI warning. Do NOT revert or rewrite task 1's early-continue. `npm run lint` does not exist in this repository — package.json defines only build, prestart, start, prerefresh and refresh — and a bare `npx tsc --noEmit` resolves neither tsconfig.json nor src/public/tsconfig.json."
  verify:
    - "npx tsc --noEmit -p tsconfig.json"
    - "npm run build"
    - "Replay the extraction read-only over /Users/akoukoullis/Work/AK/AgenticCodingTests/LAD. The corpus item total over its 247 task and issue lists must rise from 3128 to 3179, changing exactly 15 files and no others. Read that project's flowcharge/ only — never write to it."
  checklist:
    - "The detail modal's task count for LAD WS-139 equals its board card total of 29, and WS-56 equals 30. WS-74's task-list gap is deliberately excluded: its cause is countChecks() counting checkbox-shaped lines that are not items, recorded under WS-17, and no change to collectItems() can reconcile it"
    - "A well-formed file whose item body quotes a checkbox-shaped bullet still yields the same items and the same fields as before the change, on both the issue path and the task path — the quoted bullet is not promoted to an item and the owning item keeps its fields"
    - "No item line is dropped for any file in the LAD corpus, for either variant: neither an opener that reaches end of file nor an opener bound to a later unrelated closer"
    - "No item's fields are populated from a region that spans another item's line"
    - "buildTaskTree() does not throw 'task tree lost N of M tasks' for any LAD task list"
    - "countChecks() in src/lib/extract.ts is unchanged, src/lib/detail.ts is the only modified file, and no package was added"
  self_eval:
    passed: true
    failures: []
  ```

## Skipped

No open issue was skipped. `flowcharge/workstreams/tasklist-fence-scanner-data-loss/issuelist.md` holds two open issues. ISS-3 was already tasked as task 1 of this file and needs no further task. ISS-4 is tasked as task 2. Both are corrections to code that exists rather than new functionality.

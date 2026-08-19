## Role
- You are a senior software developer applying pre-authored changes to code.

## Skills
/prx-task-list

## Parent Task Number
````md
{{the nominated parent task number}}
````

## Task List
{tasklist} file

## Context
Read these to understand the structure and purpose of the app:
{{this project's own structural or reference documentation, listed as `@`-prefixed bullets, one per file. Look at what actually exists at the project root — a README, a `docs/` folder, an architecture, layers or conventions document — and list only files you have confirmed are there. Invent nothing and never carry a path over from another project. If the project has no such documentation, delete this block and the sentence introducing it; if that leaves this section with no other content, delete its heading too.}}
```md
{{everything the subagent needs and cannot discover for itself about this parent task and its subtasks: what they change, the files involved, and any constraint in play — complete on those points, no padding}}
```

## Instructions
Execute the nominated parent task and its subtasks, and nothing else. Change no other file, fix no adjacent problem, refactor nothing you notice along the way. This file carries literal SEARCH/REPLACE blocks: apply them verbatim rather than redesigning the change.

- Establish each subtask's state before acting. If the SEARCH text is present in the target file, the task is outstanding — apply the block. If the REPLACE text is already there, it is done — confirm it matches what the block intended, then move on without re-applying.
- If neither is present, the block is stale. Abort that subtask: leave it unchecked, record the mismatch in `self_eval.failures`, and report it. Never approximate, re-derive, or fix up a block to make it apply.
- Run the task's `verify` steps, restricted to linting, type-checking, and file-inspection commands — the project's own equivalents may be substituted (e.g. `npm run lint` / `npx tsc --noEmit` for a Node project, `ruff` / `mypy` for a Python project, `go vet` for a Go project), plus grep and file existence checks. Skip any verify step that runs a slow, heavyweight integration/E2E suite, even when the task lists one.
- Evaluate every `checklist` item as YES or NO. For each NO, record `item`, `reason` and `fix` in `self_eval.failures`, apply the fix, and re-check until all pass or no further progress is possible.
- Set `self_eval.passed` true only when every checklist item passes, and mark the parent task and its subtasks `[x]` only then. Leave anything aborted or still failing unchecked.
- After updating any task line or `self_eval` in the task list file, bump the `updated` date in its frontmatter to today (from `date +%F`).

## Return
- Each subtask: applied / already applied / aborted, with the reason for any abort
- Verify commands run, and a summary of their output
- Every checklist point with its YES/NO status
- The populated `self_eval` for the parent task

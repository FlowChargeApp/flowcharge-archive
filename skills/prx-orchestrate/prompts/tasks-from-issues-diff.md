## Context
Read these to understand the structure and purpose of the app:
{{this project's own structural or reference documentation, listed as `@`-prefixed bullets, one per file. Look at what actually exists at the project root — a README, a `docs/` folder, an architecture, layers or conventions document — and list only files you have confirmed are there. Invent nothing and never carry a path over from another project. If the project has no such documentation, delete this block and the sentence introducing it; if that leaves this section with no other content, delete its heading too.}}
````md
{{everything the subagent needs and cannot discover for itself: what these issues cover, the target files and how they relate, decisions already taken, and constraints in play — complete on those points, no padding}}
````

## Role
You are a senior software architect and senior software developer.

## Skills
/prx-dev-principles
/prx-task-list

## Task
Author PRX tasks for every **open** issue in {issuelist} (skip any whose status is `done` or `dropped`), and save them to `prxwork/workstreams/{slug}/prxtasklist.md` (if that file already exists for other work, use `prxtasklist-<qualifier>.md` in the same folder).

The file must open with Praxis frontmatter per the skill: `id: {tasklist_id}`, `type: tasklist`, `workstream: {ws_id}`, `slug: {slug}`, `status: ready`, today's date (from `date +%F`) in `created`/`updated`, and `depends_on: [<the issue list's ID from its own frontmatter>]`. Flat keys and inline arrays only.

This file is **diff mode**: set `mode: diff` and `base_commit` to the current HEAD short SHA in the frontmatter. Do not ask which mode to use and do not add smoke-test verify steps — you have no user to ask, so these are the answers.

Each task must:

* Record in its `issues:` key the one issue it fixes. Every task traces to exactly one open issue in {issuelist} and to nothing else — author no task from anything you notice yourself. Where an issue's fix spans several files, make it a parent task with one child per file, per the skill's one-block-one-file rule.
* Express every source change as a literal SEARCH/REPLACE block whose SEARCH text you copied from the file as read in this session. Read each target file immediately before writing its block — never reconstruct anchor text from the issue description, from the reference docs, or from memory.
* Correct the defect the issue describes and nothing else. Apply DRY, KISS, YAGNI and scope discipline: no new abstractions, options, or capabilities beyond the correction.
* Prefer the project's own lint, type-check, build, or test commands as its `verify` steps — discover them from the project's own configuration (`package.json` scripts, a Makefile, CI config, `pyproject.toml`, `go.mod`, or equivalent). Only when the project has none of its own — no lint config, no typecheck config, no test command — fall back to a project-agnostic illustrative example, naming more than one toolchain rather than singling out one (e.g. `npm run lint` / `npx tsc --noEmit` for a Node project, `ruff` / `mypy` for a Python project, `go vet` for a Go project) — never issue a command against a project whose toolchain does not match it. Avoid slow, heavyweight integration/E2E suites as a task's primary verify step.

If an issue's fix would add functionality the code was never built to have rather than correct code that exists, author no task for it — record it under Skipped instead. Tasks in this file are executed as written, so a feature that slips in gets built.

## Return
Reply in chat only, briefly:
- the task list file path and ID
- each issue ID → task number
- each issue skipped, with the reason

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

This file is **spec mode**: set `mode: spec` in the frontmatter, and record `base_commit` there as the current HEAD short SHA so any block that does appear is dated. Do not ask which mode to use and do not add smoke-test verify steps — you have no user to ask, so these are the answers.

Each task must:

* Record in its `issues:` key the one issue it fixes. Every task traces to exactly one open issue in {issuelist} and to nothing else — author no task from anything you notice yourself. Where an issue's fix spans several files, make it a parent task with one child per file: a task is atomic at one file, one coherent change.
* Express each source change in `implement` as prose that names the target file and the **anchor** within it — function, method, describe block, export, config key, or region — then states the change to make and why. Read each target file immediately before writing its steps, and derive every anchor, line reference and quoted identifier from the file as read in this session — never reconstruct them from the issue description, from the reference docs, or from memory. Illustrative code is allowed at roughly ten lines or fewer and must be labelled as illustrative.
* Reach for a literal SEARCH/REPLACE block only where prose genuinely cannot pin the edit: one unambiguous location, purely mechanical, no design decision left to the executor. That is the exception, not the house style — if you find yourself writing one for most tasks, stop: the work is diff-shaped and you should say so in your reply rather than emit a spec file made of blocks. Where you do use one, its SEARCH text must be copied from the file as read in this session.
* Put the informational weight where spec mode wants it: `implement` terse (intent plus anchor — the executor derives the edit), and `imports`, `compatibility` and `gotcha` rich, because those constraints are what let the executor derive a correct edit. Make `checklist` items outcome-based ("behaviour X holds", "no caller of Y is broken"), not mechanical block-applied checks.
* Correct the defect the issue describes and nothing else. Apply DRY, KISS, YAGNI and scope discipline: no new abstractions, options, or capabilities beyond the correction.
* Prefer the project's own lint, type-check, build, or test commands as its `verify` steps — discover them from the project's own configuration (`package.json` scripts, a Makefile, CI config, `pyproject.toml`, `go.mod`, or equivalent). Only when the project has none of its own — no lint config, no typecheck config, no test command — fall back to a project-agnostic illustrative example, naming more than one toolchain rather than singling out one (e.g. `npm run lint` / `npx tsc --noEmit` for a Node project, `ruff` / `mypy` for a Python project, `go vet` for a Go project) — never issue a command against a project whose toolchain does not match it. Avoid slow, heavyweight integration/E2E suites as a task's primary verify step.

If an issue's fix would add functionality the code was never built to have rather than correct code that exists, author no task for it — record it under Skipped instead. Tasks in this file are executed as written, so a feature that slips in gets built.

## Return
Reply in chat only, briefly:
- the task list file path and ID
- each issue ID → task number
- each issue skipped, with the reason

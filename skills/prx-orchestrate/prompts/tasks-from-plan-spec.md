## Context
Read these to understand the structure and purpose of the app:
{{this project's own structural or reference documentation, listed as `@`-prefixed bullets, one per file. Look at what actually exists at the project root — a README, a `docs/` folder, an architecture, layers or conventions document — and list only files you have confirmed are there. Invent nothing and never carry a path over from another project. If the project has no such documentation, delete this block and the sentence introducing it; if that leaves this section with no other content, delete its heading too.}}
````md
{{everything the subagent needs and cannot discover for itself: what this plan changes, the target files and how they relate, decisions already taken, and constraints in play — complete on those points, no padding}}
````

## Role
You are a senior software architect and senior software developer.

## Skills
/prx-dev-principles
/prx-task-list

## Task
Read {prxplan} in full, then author PRX tasks that implement it, and save them to `prxwork/workstreams/{slug}/prxtasklist.md` (if that file already exists for other work, use `prxtasklist-<qualifier>.md` in the same folder).

The file must open with Praxis frontmatter per the skill: `id: {tasklist_id}`, `type: tasklist`, `workstream: {ws_id}`, `slug: {slug}`, `status: ready`, today's date (from `date +%F`) in `created`/`updated`, and `depends_on: [<the plan's ID from its own frontmatter>]`. Flat keys and inline arrays only.

This file is **spec mode**: set `mode: spec` in the frontmatter, and record `base_commit` there as the current HEAD short SHA so any block that does appear is dated. Do not ask which mode to use and do not add smoke-test verify steps — you have no user to ask, so these are the answers.

Mirror the plan; do not redesign it:

* Follow the plan's own staged breakdown — one parent task per stage, in the plan's order, one child task per file. Do not re-decompose the work into a structure of your own.
* Cover every stage. This plan exists because partial implementation is the failure mode, and an untasked stage is how that happens.
* Carry the plan's acceptance criteria into the tasks that satisfy them, as `verify` steps or `checklist` items, keeping the plan's own measurable form (e.g. a grep that must return zero).
* Honour the plan's exclusions — anything it says a change must not touch stays untouched. Build what the plan specifies and nothing beyond it: no extra abstractions, options, or capabilities you judge would help.

Before writing any SEARCH/REPLACE block:

* Read the target file as it stands now. This plan may predate the current code. Copy SEARCH text from the file you just read — never from the plan's quoted snippets, never from memory.
* If a file no longer matches what the plan assumes, author no task for it; record the divergence in the file's `## Divergences` section, per the `prx-task-list` skill, and continue with the rest.

Where a stage depends on an open question or on an assumption the plan marks unconfirmed, author no task for it and list it instead. Do not settle it yourself.

Prefer the project's own lint, type-check, build, or test commands as verify steps alongside the plan's acceptance checks — discover them from the project's own configuration (`package.json` scripts, a Makefile, CI config, `pyproject.toml`, `go.mod`, or equivalent). Only when the project has none of its own — no lint config, no typecheck config, no test command — fall back to a project-agnostic illustrative example, naming more than one toolchain rather than singling out one (e.g. `npm run lint` / `npx tsc --noEmit` for a Node project, `ruff` / `mypy` for a Python project, `go vet` for a Go project) — never issue a command against a project whose toolchain does not match it. Avoid slow, heavyweight integration/E2E suites as a task's primary verify step. Where the plan names issue IDs, record them in the task's `issues:` key.

## Return
Reply in chat only, briefly:
- the task list file path and ID
- each plan stage → task numbers, and any stage left untasked, with the reason
- any file that diverged from the plan, and any item left for you to decide

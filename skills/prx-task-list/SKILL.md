---
name: prx-task-list
description: Manage Praxis (PRX) task list files stored as per-workstream Markdown in ./prxwork/workstreams/{{WS-N}}-{{slug}}/prxtasklist.md. Read, create, update, delete tasks, understand Praxis frontmatter, task types, authoring modes, schema, global TL IDs, and rules. Part of the Praxis suite (parallel successor to ak-task-list-md).
---

## What I do

- Read, create, update, and delete tasks in a Praxis task list Markdown file directly
- Enforce Praxis frontmatter, task type rules, numbering conventions, and self-evaluation standards
- Author tasks in either `spec` or `diff` mode, per the file's declared mode

## When to use me

Use this whenever you need to read, create, update, or delete tasks in a Praxis task list, or understand task types, authoring modes, schema, self-evaluation rules, or the Markdown format.

The canonical Praxis data model (layout, IDs, frontmatter, status lifecycle, index generation) lives in `<skills-dir>/prx-orchestrate/CONVENTIONS.md`; this skill restates the parts task lists need. Where they disagree, CONVENTIONS.md wins.

## Content

### Storage — workstream folders

Each workstream keeps ONE task list at: `./prxwork/workstreams/{{WS-N}}-{{slug}}/prxtasklist.md`. If a second, genuinely separate list is needed in the same workstream, name it `prxtasklist-{{qualifier}}.md` in the same folder. There are no date buckets and no `_done/` folders — completion is `status: done` in frontmatter, and the file stays put.

**Choosing the `{{slug}}`.** The workstream's folder is `{{WS-N}}-{{slug}}`, with `{{slug}}` remaining the bare, unprefixed slug used for reuse and collision-checking. Reuse an existing slug byte-for-byte ONLY when continuing a workstream that folder already holds. For genuinely new work the slug must describe the *specific* work, not just the subject area — `lad-opencode-client-vitest-migration`, not `lad-opencode-client-tests` — and where it extends earlier work its name should read as related to it. Before adopting a slug, collision-check it: `ls prxwork/workstreams/`. If that name already belongs to a *different* workstream, pick a distinct descriptive slug — never overwrite, rename, or displace another workstream's folder to take its name.

**CRITICAL: "create a task list for X" means CREATE THE FILE, NOT A TASK.**

When the user says "create a task list for X":

1. Do NOT add any task to any existing file.
2. Ask which authoring mode applies (see **Two authoring modes** below).
3. Create `./prxwork/workstreams/{{WS-N}}-{{slug}}/prxtasklist.md` with the frontmatter, heading, and summary block only (no tasks). Claim its `TL-N-SUFFIX` ID from the registry first (see Frontmatter). If the workstream folder is new, it also needs a `prxworkstream.md` record per CONVENTIONS.md.
4. Tell the user the file was created, with its ID and mode.

When the user says "add a task to X":

1. Resolve the file path: `./prxwork/workstreams/{{WS-N}}-{{slug}}/prxtasklist.md`.
2. If the file doesn't exist, create it first as above, then add the task.
3. Resolve the file's mode before authoring the task — the mode determines the form of `implement`.

If no workstream is specified in a request, consult `prxindex.md` (regenerate if stale); if genuinely undecidable, ask the user.

### File frontmatter

Every task list opens with Praxis frontmatter. Flat keys and inline arrays only — the index parser depends on it:

```yaml
---
id: TL-4-a3x9k2
type: tasklist
workstream: WS-2-h4t6m8
slug: scope-service-bug-fixes
title: "Scope service bug fixes"
status: ready
created: 2026-07-29
updated: 2026-07-29
author: Ada Lovelace
depends_on: [IL-3-k9d2s5]
links: []
mode: spec              # spec | diff
base_commit: a1b2c3d    # required wherever SEARCH blocks appear — the commit they were authored against
---
```

- `id`: a `TL-N-SUFFIX` claimed by running `node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root> --claim TL` and using the printed id verbatim. IDs are global and permanent; tasks are addressed globally as `TL-N-SUFFIX task M` (compact form `TL-4-a3x9k2.2.1` = task 2.1 in `TL-4-a3x9k2`).
- `status`: the uniform enum (`backlog`, `ready`, `in-progress`, `blocked`, `done`, `dropped`); `ready` when authored, `in-progress` once execution starts, `done` when every task line is `[x]`.
- `depends_on`: the IDs this list is built from and gated on — the issue list or plan it implements, and any list that must execute first. The orchestrator refuses to execute a list whose `depends_on` are not all `done` (a `type: plan` or `type: issuelist` dependency is satisfied once authored — any status but `backlog`/`dropped`). Ordering constraints are data here, never only prose.
- `updated`: bump on EVERY edit to the file.
- `mode` / `base_commit`: see below — these live in the frontmatter, not a separate header block.

After any status or task-state change, regenerate the index:

```bash
node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root>
```

### Two authoring modes — `spec` and `diff`

Every task list declares a `mode` in its frontmatter that fixes the **form** of its `implement` steps. Mode describes the instruction format and the latitude granted to the executor. It never names a model, vendor, product, or tier — do not record one anywhere in a task file.

- **`spec`** — predominantly instruction-oriented: `implement` states intent and anchors, and the executor derives the change itself. Use when the executor is expected to read surrounding code, resolve ambiguity, and choose an approach. Files stay small and tolerate code drift. A literal SEARCH/REPLACE block is permitted for the occasional small, mechanical edit — see `implement` under **Metadata Schema** for the conditions.
- **`diff`** — `implement` carries a literal SEARCH/REPLACE block; the executor applies it verbatim and does not improvise. Use when the executor should not be making design decisions. Files are large and perishable.

**Ask, never infer.** When creating a task list, ask the user: *"Spec mode (intent + anchors) or diff mode (literal SEARCH/REPLACE blocks)?"*

**Mode resolution order** when reading or writing a task:

1. A `mode` key on the task's own YAML — a per-task override. Use sparingly; a mixed file is harder to hand to one executor.
2. The `mode` key in the file frontmatter.
3. No `mode` at all — the file predates this rule. Treat it as `diff` for **reading**. Do not backfill. Ask the user which mode applies before authoring anything new into it.

### Diff-mode staleness guard

A pre-written SEARCH/REPLACE block is only valid against the code it was authored from. It rots as soon as anything else edits that file.

- Record `base_commit` in the frontmatter when authoring a diff-mode file — or a spec-mode file that contains any SEARCH/REPLACE block — and re-record it if blocks are regenerated.
- **If a SEARCH block does not match at execution time, re-anchor it — never approximate it.** Re-read the target file, locate the anchor in its current form, and re-derive the edit against what the file actually says now. Then record the re-anchoring in `self_eval` (see below): what the block expected, what the file contained, and how the edit was adapted. A silent fix-up is what this rule exists to prevent; a visible, reported one is fine.
- **Abort only when the anchor is genuinely gone or its meaning has changed** — the function, symbol, or region the block targeted no longer exists, or it now does something different enough that the intended edit may no longer be correct. In that case leave the task unchecked, record it, and stop rather than guessing at intent.
- Diff-mode files are perishable. Author them close to when they will be executed, not weeks ahead. If a diff-mode file has sat unexecuted while its target files changed, regenerate the blocks against current content rather than executing as-is.

### Three task types

- **Parent** — Category heading only. Has child tasks. Only has `description` in its YAML metadata. Not directly actionable.
- **Adult** — Standalone, childless task. Has the full set of YAML metadata keys.
- **Child** — Belongs to a parent task. Has the full set of YAML metadata keys. Numbered as `N.M` (e.g. `2.1`, `2.2`).

### Task List Format

Each file follows this structure (after the file frontmatter):

````md
# PRX Tasks

## Feature Name

{{ Detailed-yet-concise summary of the feature }}

- [ ] 1. Task (Childless / Adult)
  ```yaml
  description: "Describe the task"
  author: Ada Lovelace
  issues: []
  implement:
    - "Step or instruction"
    - "Option A: ..."
    - "Option B: ..."
  pattern: "Files applicable"
  imports: "Components, packages, etc required"
  compatibility: "Design patterns, package versions, etc, that the task output needs to be compatible with"
  gotcha: "Any known or foreseeable issues that can arise with such a task relating to imports, compatibility, etc"
  verify:
    - "Primary command or tool to verify successful implementation"
    - "Optional: follow-up check on the output of the above"
  checklist:
    - "Binary YES/NO criterion derived from imports, compatibility, gotcha, or pattern"
    - "..."
  self_eval:
    passed: false
    failures: []
  ```
- [ ] 2. Parent task

  ```yaml
  description: "Describe the overall task"
  ```

  - [ ] 2.1 Child task / Subtask
    ```yaml
    description: "Describe the child task"
    author: Ada Lovelace
    issues: []
    implement:
      - "Step or instruction"
    pattern: "Files applicable"
    imports: "Components, packages, etc required"
    compatibility: "Relevant compatibility constraints"
    gotcha: "Known or foreseeable issues"
    verify:
      - "Primary command or tool to verify successful implementation"
      - "Optional: follow-up check on the output of the above"
    checklist:
      - "..."
      - "..."
    self_eval:
      passed: false
      failures: []
    ```
  - [x] 2.2 Completed child task / subtask

- [x] 3. Completed parent task

## Divergences

1. **Short label.** What the plan assumed; what the file actually contains; the consequence.
````

### Divergences

Record every divergence found while authoring the file in one section named exactly
`Divergences`. Add no suffix and no artefact ID to the name — the source artefact is
already in `depends_on`, and the fixed string is what makes the section greppable.

Give the heading the level `##`, a sibling of the `## Feature Name` heading. Put the
section last in the file, after the final task line and after any other trailing
section.

Write the section only when at least one divergence was found. Omit it entirely when
nothing diverged. One optional closing sentence may record that every other cited file
matched the plan.

Write the entries as an ordered numbered list from 1, one entry per divergence. Open
each entry with a bold short label, then state in prose:

1. what the plan assumed,
2. what the file or the project actually contains, cited by path and by the line or
   short SHA read at authoring time,
3. the consequence — the tasks affected, or that no task was authored.

Any task may point at an entry with the literal form `see Divergence N`, from
`implement`, `gotcha`, `verify`, or `checklist`. Never renumber an entry once it is
written, because those references are not updated with it.

Two prohibitions:

- Never use checkbox syntax in an entry. A `- [ ]` line here is counted as a task by
  the index generator.
- Record a divergence in this section and nowhere else in the file — not in the feature
  summary, and not as a bold inline paragraph.

### Metadata Schema

Every task includes an indented YAML block immediately after the task line. These are the standard keys:

- `description`: concise task description
- `author`: plaintext name of whoever authored the task — see **Author attribution** below. Adult and child tasks only.
- `mode`: **optional** per-task override of the file's mode — `spec` or `diff`. Omit unless this one task genuinely needs the other form.
- `issues`: **optional** list of issue IDs from `prx-issue-list` that this task addresses (e.g. `[ISS-3-q2j5w7, ISS-7-s5g9y0]`). Use `[]` if none. When populated, update the corresponding issue's `tasks` key and set its `status` to `in-progress`.
- `implement`: **ordered list** of implementation steps or instructions. Each item is a discrete action. Use multiple items to capture branching options (e.g. `"Option A: ..."`, `"Option B: ..."`) rather than embedding them in prose. **The form of these steps is set by the task's mode:**

  **`spec` mode**
  - Steps are prose. Name the target file and the **anchor** within it (function, method, symbol, export, config key, or region), then state the change to make and why.
  - Illustrative code is allowed but capped at roughly 10 lines, and must be labelled as illustrative rather than literal.
  - A literal SEARCH/REPLACE block is **allowed** in spec mode, but only when all of the following hold. Prose is the default; reach for a block because it is genuinely clearer, never because it is easier to author.
    - The change is small and targets **one unambiguous location** in one file.
    - It is mechanical enough that no design decision is left for the executor — if the executor would still have to choose an approach, write prose.
    - The SEARCH text is copied from the file **as read in this session**, never recalled from memory or reconstructed.
    - The block follows the same shape and one-block-per-task limit as `diff` mode below.
  - **Consequence:** a spec file containing at least one SEARCH/REPLACE block must carry `base_commit` in its frontmatter, and those tasks fall under the **Diff-mode staleness guard** exactly as diff-mode tasks do. Without the SHA a block has nothing to date it against. If a task is drifting toward several blocks, that is the signal it belongs in a diff-mode file — or give that one task a `mode: diff` override.

  **`diff` mode**
  - Steps that modify source code must be expressed as a SEARCH/REPLACE block, not prose. Each block states the full file path, then a `<<<<<<< SEARCH` section with the exact existing text, a `=======` divider, and a `>>>>>>> REPLACE` section with the new text.
  - Max **one** SEARCH/REPLACE block per task, targeting **one** file. Multi-file or multi-location changes: split into one child task per block, never multiple blocks in one task.
  - The SEARCH text must be copied from the file as read in this session — never recalled from memory or reconstructed. See **Diff-mode staleness guard** above.

- `pattern`: files, paths, or applicable scope
- `imports`: required components, packages, modules, or dependencies
- `compatibility`: required design patterns, package versions, or compatibility constraints
- `gotcha`: likely pitfalls, edge cases, or foreseeable issues
- `verify`: **ordered list** of verification steps. The first item is the primary command or tool. Subsequent items are follow-up checks on the output of the previous step (e.g. inspect a value, hit an endpoint, assert a file exists). Steps are executed in sequence — later steps may depend on earlier ones succeeding. See **Smoke Tests** below for tasks whose output is a class/method with observable state.
- `checklist`: 4–6 binary YES/NO criteria derived from `imports`, `compatibility`, `gotcha`, or `pattern`
- `self_eval`: post-execution evaluation object with:
  - `passed`: boolean — true only if every checklist item passes
  - `failures`: array of failed checklist items, each with `item`, `reason`, and `fix`

**Parent tasks only have the `description` key.** All other task types (adult, child) have the full set of keys above.

That rule is unchanged, and `author` carves no exception into it: a parent task
still carries `description` and nothing else, so it never carries `author` either.

### Author attribution

Read the `author` value from the generator when you author a task list, and write the
printed line verbatim into the file's frontmatter and into every adult and child
task's YAML:

```bash
node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root> --whoami
```

The command prints exactly one line and writes nothing. It prints the literal string
`unknown` when `git config user.name` is unset or the call fails, so a missing local
git identity never blocks authoring a task list.

Treat the value as **local attribution, not a verified identity** — sourced from the
machine's own `git config user.name` at authoring time, which is self-reported, can
differ from the account that actually opens a GitHub pull request, and can be blank
or wrong on a misconfigured machine. No `--check` warning exists for a missing or
empty `author`; the field is optional and non-blocking by design.

### Where the detail sits, by mode

Both modes use the same schema, but the informational load moves. Filling every key to the same depth in both modes is what makes task files bloat.

| Key | `spec` | `diff` |
| --- | --- | --- |
| `implement` | **Terse.** Intent plus anchor. The executor derives the edit. | **Long.** The block *is* the task. |
| `imports`, `compatibility`, `gotcha` | **Rich.** These constraints are what let the executor derive a correct edit. | **Terse.** The block already encodes them; restating is duplication. |
| `checklist` | Outcome-based — "behaviour X holds", "no caller of Y is broken". | Mechanical — "block applied cleanly", "`grep` confirms Z", "type-check clean". |
| `verify` | May require judgement about the result. | Should be a runnable command with an unambiguous pass/fail. |

### Self-evaluation

After each task is executed, evaluate every checklist item as YES or NO. If any item fails, add it to `self_eval.failures` with `item`, `reason`, and `fix`, apply the fix immediately, and re-check. Repeat until all pass or no further progress is possible. Set `self_eval.passed` to true only if every checklist item passes. Mark a task complete (`[x]`) only when `self_eval.passed` is true. Return the populated `self_eval` in the task result.

A diff-mode task whose SEARCH block failed to match is **not** a checklist failure. Handle it per the **Diff-mode staleness guard**: if the block was re-anchored, note that in `self_eval` as a `reanchored` entry (`item`, `expected`, `found`, `resolution`) — the task may still pass, but the re-anchoring must be visible in the result, never folded silently into a green task. If the anchor was gone or its meaning had changed, leave the task unchecked, record the mismatch in `self_eval.failures`, and stop.

### Smoke Tests

A smoke test is a minimal script that instantiates/calls the changed code with concrete inputs and asserts a concrete expected output/state — proving it runs and does the basic thing, without a full test suite.

When generating a task that adds/changes a class or method with externally observable state (file written, DB row, API response, computed value), ask the user: *"Add a smoke-test verify step for this task?"* If yes, the `verify` entry must specify, inline, not just "run a smoke test":
- exact instantiation/call (class, method, args)
- concrete input values (e.g. temp dir, sample IDs)
- exact expected output and how to compute it independently of the code under test
- runtime to execute it with (match the project's actual entrypoint runtime — e.g. `tsx`, not `bun`, if the project runs via `tsx`; verify with the user or codebase if unknown)
- cleanup step if it writes temp files

### Rules

- Always include a detailed-yet-concise summary of the feature, from the discussion recently conducted about it, to give the section context. It sits under the `## Feature Name` heading, after the frontmatter.
- Record every authoring-time divergence in the file's `## Divergences` section — see **Divergences** above — and never in the feature summary or inline in a task's prose.
- **CRITICAL — Task Numbering:**
  - Parent and adult tasks are ALWAYS numbered `1.`, `2.`, etc.
  - Child tasks / subtasks are ALWAYS numbered `1.1`, `1.2`, etc. — incorporating the parent task number. This is **IMPERATIVE**.
  - If adding existing discussed tasks to a parent task as subtasks, **RENUMBER** them to incorporate the parent task number in the subtask numbers.
- Tasks may include an inline description: `1. Task name (description)`
- If a task has child tasks, it is a parent task.
  - If a task's scope is large, break it down into atomic child tasks.
  - **Atomic = one file, one coherent change, provable by a single `verify` sequence.** In `diff` mode, additionally: **one SEARCH/REPLACE block**. Split multi-file changes into separate child tasks in either mode.
  - If a task's scope is already atomic, keep it as a parent-level adult task.
  - Treat the parent task as a category heading — not directly actionable.
  - A parent task only has the `description` key in its YAML metadata.
  - Child tasks have the full set of YAML metadata keys.
  - When all subtasks of a parent are completed, mark the parent task as completed too.
- Only add tasks that don't already exist in the file.
- Mark complete by switching `[ ]` → `[x]`.
- When every task line is `[x]`, set the frontmatter `status` to `done`.
- Bump the frontmatter `updated` date on every edit, and regenerate the index (command above) after the edit lands.
- Preserve all existing content, ordering, indentation, and metadata exactly.
- Never record a model, vendor, product, or tier name in a task file. Mode captures the instruction format; that is the only distinction the file needs.
- After writing, summarise what was added/updated/completed, and state the mode used.

---

## File Operations for Large Task List Files

### Reading

**Locate a task** (get line number):

```bash
grep -n "7\.3" prxwork/workstreams/{{WS-N}}-{{slug}}/prxtasklist.md
```

**Read a fixed range** (once you have line numbers):

```bash
sed -n '122,155p' prxwork/workstreams/{{WS-N}}-{{slug}}/prxtasklist.md
```

**Read a task to the next task** (variable-length YAML):

```bash
# Child task (indented):
sed -n '/^  - \[.\] 7\.3/,/^  - \[.\] 7\.4/p' file.md
# Parent/adult task:
sed -n '/^- \[.\] 7\./,/^- \[.\] 8\./p' file.md
```

**Scan all task status lines:**

```bash
grep -n "^\s*- \[" prxwork/workstreams/{{WS-N}}-{{slug}}/prxtasklist.md
```

**Read N lines from a known task line:**

```bash
START=$(grep -n "7\.3" file.md | head -1 | cut -d: -f1)
sed -n "${START},$((START+40))p" file.md
```

**Check a file's mode** (before authoring into it):

```bash
sed -n '1,20p' prxwork/workstreams/{{WS-N}}-{{slug}}/prxtasklist.md | grep -E '^mode:|^base_commit:'
```

### Writing (SEARCH/REPLACE)

These rules govern edits to the **task list file itself**, in either mode.

1. `grep -n` to get line number → `sed -n` to read exact current content → write a SEARCH/REPLACE block.
2. The SEARCH section must match existing content exactly, including whitespace and indentation.
3. Include just enough surrounding lines in SEARCH to make the match unique within the file.
4. Label the fence with the target file's language (e.g. `python`, `yaml`, `md`) — never a generic `diff` tag.
5. Apply the block using the coding tool's native file-editing capability — do not shell out to `patch` or `git apply`.
6. If the edit fails (SEARCH text not found or matches multiple locations), re-read the file (lines may have shifted) and regenerate the block against current content.
7. Never generate a block against a file not re-read since the last write in this session.

**Block format:**

```
prxwork/workstreams/{{WS-N}}-{{slug}}/prxtasklist.md
<<<<<<< SEARCH
  - [ ] 7.3 Some child task
=======
  - [x] 7.3 Some child task
>>>>>>> REPLACE
```

---

## Housekeeping — Completion & the Index

There is no per-file archive sweep and no `_done/` folder in Praxis — files never move individually. (A fully completed workstream may later be archived wholesale, folder and all, to `prxwork/archive/<slug>/` — an explicit, user-directed act covered by CONVENTIONS.md, not by this skill.) Housekeeping is:

1. **Close out**: when no open task line is left (`- [ ] N.` for parent/adult, `  - [ ] N.M` for child — real task-tracker lines only, not unchecked-looking bullets embedded in prose such as a "Definition of Done" inside a task's body), set the frontmatter `status: done` and bump `updated`. If a done file gets a new open task, set it back to `ready` or `in-progress`.
2. **Regenerate**: run the index generator. Its Attention section flags task lists whose tasks are all checked but whose status is not yet `done`, and stale in-progress files.
3. **Compaction on completion (diff mode).** Once a diff-mode file is `done`, its SEARCH/REPLACE blocks are dead weight — the applied changes now live in git history, and the blocks no longer match anything. Offer to compact it: keep the frontmatter, feature summary, the task lines with their `[x]` status, each `description`, `issues`, and `self_eval`, and record the commit SHAs; drop the `implement` blocks. Never compact without the user's confirmation, and never compact a file that still has open tasks.
4. **Never hand-edit** `prxindex.md` or `prxkanban.md` — they are generated views; frontmatter here is the source of truth.

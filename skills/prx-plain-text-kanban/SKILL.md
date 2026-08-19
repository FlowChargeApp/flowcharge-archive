---
name: prx-plain-text-kanban
description: Manage the Praxis (PRX) kanban board — a generated Obsidian "Plain Text Kanban" markdown file (prxkanban.md) whose thin cards are derived views of workstream records under prxwork/. Use this skill whenever the user wants the Praxis board created, regenerated, read, or a card moved/added/edited — card moves happen by editing workstream frontmatter status and regenerating, never by hand-editing the board. Also documents the plain-text-kanban plugin format (columns, cards, labels, tabs) for reading boards and for repairs. Part of the Praxis suite (parallel successor to ak-plain-text-kanban).
---

# PRX Kanban Manager

Manages `prxwork/prxkanban.md` — plain markdown that renders as an interactive
kanban board in Obsidian via the **Plain Text Kanban** plugin
(https://community.obsidian.md/plugins/plain-text-kanban).

**The Praxis board is a generated view, not a source of truth.** Every card is a thin
pointer to a workstream record at `prxwork/workstreams/<WS-N>-<slug>/prxworkstream.md`; the card's column is
that record's frontmatter `status`, its text is the record's body, its `#labels` are the
record's `tags`. The canonical data model is
`<skills-dir>/prx-orchestrate/CONVENTIONS.md`.

## The one rule that replaces most board operations

To change the board, change the workstream records and regenerate:

```bash
node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root>
```

- **Move a card** → edit `status` in the workstream's `prxworkstream.md` (enum: `backlog`,
  `ready`, `in-progress`, `blocked`, `done`, `dropped`), bump `updated`, regenerate.
- **Add a card** → create `prxwork/workstreams/<WS-N>-<slug>/prxworkstream.md` per CONVENTIONS.md (run
  `node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root> --claim WS` and use the
  printed id verbatim first), regenerate.
- **Edit a card's title/text/labels** → edit the record's `title`, body, or `tags`,
  regenerate.
- **Clear a tag WARN** → tags are validated against the canonical pool in `prxwork/prxtags.md` by the index generator; edit the record's `tags` to a defined pool spelling, regenerate.
- **Remove a card** → set the workstream's status to `dropped` (with the reason in the
  body), regenerate. Never delete a workstream folder to clear a card.
- **Complete a board/workstream** → close out the underlying artefacts (tasks `[x]`,
  issues `done`/`dropped`, per their skills), set the workstream `status: done`,
  regenerate.
- **Archive a workstream** → only when its status is `done` or `dropped`, and only on
  the user's say-so: move the ENTIRE folder `prxwork/workstreams/<WS-N>-<slug>/` →
  `prxwork/archive/<WS-N>-<slug>/`, then regenerate. The card moves to the hidden
  `Archive __archived__` column and `workstreams/` keeps holding only live work. IDs
  are untouched and stay resolvable. Unarchive = move the folder back, regenerate.

Never hand-edit `prxkanban.md` to make any of these changes. If someone (or Obsidian
drag-and-drop) has hand-moved a card, the generator prints a WARN naming the divergence —
frontmatter wins and the board is rewritten. If the drag was the user's real intent,
apply it to the frontmatter first, then regenerate.

## Columns and cards

The generated board has fixed columns mapping the status enum:
`Backlog`, `Ready`, `In Progress`, `Blocked`, `Done`, `Dropped __archived__`, and
`Archive __archived__` (the ` __archived__` suffix hides a column from the rendered
board; its cards stay in the file). `Archive` holds workstreams whose folders live
under `prxwork/archive/`, whatever their terminal status; `Dropped` holds dropped
workstreams not yet archived.

Cards are **thin** — this is deliberate and load-bearing. One card is:

```
	- ## WS-4-a3x9k2 Fix scope service defects #services #bugfix
		Three defects from the scope-service bug hunt: tier inheritance, a silent catch, a stale cache key.
		→ prxwork/workstreams/WS-4-a3x9k2-scope-service-bug-fixes/
```

Title line = `WS-N-SUFFIX` + the record's `title` + `#tags`; body = the record's body first line
(the card shows this one line only, truncated at 200 characters; the rest of the
record's body is storage and never reaches the board) plus a pointer to the
workstream folder. If a card is growing prose — ordering constraints, carve-outs,
execution notes — that content belongs in the workstream record's artefacts and in
`depends_on`, not on the board. The board answers "what exists and where does it
stand"; the artefacts answer everything else.

## Plugin format (for reading boards and hand repairs)

The file is a nested markdown list; the only thing requiring care is whitespace:
**tabs, not spaces**.

```
<!-- kanban-labels: {"bug":"#e03e3e","feature":"#2f80ed"} -->
- # To Do
	- ## Fix login page #bug
		Some description in **markdown**.
- # In Progress
	- ## Refactor API #feature
		- [x] Extract helpers
		- [ ] Write tests
- # Done
```

- Optional metadata comments at top — the ONLY two the plugin understands:
  `<!-- kanban-labels: {"name":"#hex",...} -->` (label → color; lowercase names — the
  plugin lowercases JSON keys on save and matches labels case-insensitively) and
  `<!-- kanban-swimlanes: [...] -->` (each swimlane is `{"labels":[...]}` only — no
  `name` key; empty array = all labels; `"__no_label__"` matches unlabeled cards).
- **Column**: `- # Title` (zero indent, single `#`). Empty column = header line alone. A
  title ending in ` __archived__` is an archived column, hidden from the board.
- **Card**: `\t- ## Title #label1 #label2` (exactly one literal tab — the parser requires
  it; double `#`). Labels are `#hashtags` anywhere in the title text.
- **Card body** = every line below the card until the next card/column line, at **two
  literal tabs**. Checklist lines are GFM: `\t\t- [ ] Task` / `\t\t- [x] Task`.
- **Purity**: the plugin rewrites the whole file on every save and silently deletes
  anything it doesn't parse — YAML frontmatter, prose between columns, blank lines,
  unknown comments. This is why the board file itself can never be a Praxis artefact and
  never carries frontmatter: the board must contain ONLY the two metadata comments,
  columns, cards, and bodies. (The generator preserves existing label colors across
  regenerations.)
- **Whitespace**: copy tabs verbatim from a fresh read when building old/new text —
  editors and chat interfaces silently convert tabs to spaces.

Hand edits are legitimate only for **repair** — e.g. the plugin or a merge mangled the
file and the generator can't run — and follow read-first/minimal-unique-match/verify
discipline. After any repair, regenerate to restore the canonical view.

## Verify

After regenerating (or repairing), check: card lines have exactly one leading tab, bodies
keep their two-tab indent, headers have zero, metadata JSON is valid. Deterministic
checks:

```bash
# Space-indented structure lines (tabs got converted) — expect no output:
grep -nE '^ +- #' prxwork/prxkanban.md
# Card lines with wrong tab count (0 or 2+) — expect no output:
grep -nE '^- ## ' prxwork/prxkanban.md; grep -nE $'^\t\t+- ## ' prxwork/prxkanban.md
# Metadata JSON parses — prints "JSON OK" or a Python error:
sed -nE 's/^<!-- kanban-(labels|swimlanes): (.*) -->$/\2/p' prxwork/prxkanban.md \
  | python3 -c 'import json,sys; [json.loads(l) for l in sys.stdin if l.strip()]; print("JSON OK")'
# Board agrees with frontmatter — expect no WARN lines:
node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root> --check
```

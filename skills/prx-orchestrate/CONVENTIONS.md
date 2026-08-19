# Praxis Conventions

Canonical data model for the Praxis (prx) project-management suite. Every prx skill
follows this document; where a skill's own prose and this document disagree, this
document wins.

## Layout — workstream folders, not date buckets

Everything lives under `prxwork/` at the project root — nothing else pollutes the
project. One subfolder per workstream under `prxwork/workstreams/`:

```
prxwork/
  prxids.md                      # ID registry (see IDs)
  prxagents.md                   # optional; local per-project preference manifest,
                                  # not a tracked artefact (see prx-orchestrate/SKILL.md)
  prxindex.md                    # GENERATED — never hand-edited
  prxkanban.md                   # GENERATED view of workstream statuses
  workstreams/
    <WS-N-SUFFIX>-<slug>/
      prxworkstream.md           # the workstream record (drives the kanban card)
      prxplan.md                 # optional
      prxissuelist.md            # optional; extras as prxissuelist-<qualifier>.md
      prxtasklist.md             # optional; extras as prxtasklist-<qualifier>.md
  archive/
    <WS-N-SUFFIX>-<slug>/         # archived workstreams, same shape (see Archiving)
```

## Allowed variation

Three properties of a `prxwork/` tree are deliberately unconstrained. The generator
emits no warning for any of them, and their absence from the checks is a decision,
not an oversight:

- **An empty `prxwork/archive/` directory.** A project that has archived nothing may
  keep the directory or leave it out. Neither state is a defect.
- **Non-artefact files at the `prxwork/` root**, such as a notes file or
  `prxagents.md`. The generator reads the artefacts named above and ignores every
  other file at that level.
- **Whether `prxwork/` is tracked by git.** Commit it or ignore it — the choice
  belongs to the project, and Praxis assumes neither.

Do not add a check for any of the three, and do not "correct" a tree that shows
one.

## Project root — resolved once, shared by every worktree

`<project-root>` — the directory containing `prxwork/`, referenced throughout this
document, every skill's regenerate command, and every skill's literal
`prxwork/...` paths — is not simply the current working directory. Resolve it once,
before touching any `prxwork/` path, whether through the generator script or
directly:

```bash
git rev-parse --path-format=absolute --git-common-dir 2>/dev/null | xargs -I{} dirname {}
```

This prints the same directory for a plain checkout and for every
`git worktree add` checkout of the same repository, so every worktree of a project
shares one `prxwork/`. If the command fails (not a git repository), `<project-root>`
is the current working directory, unchanged from today. Treat the resolved value as
the base for every `prxwork/...` reference anywhere in the Praxis skill suite,
including literal relative paths such as `./prxwork/workstreams/<slug>/...` — they
mean `<project-root>/prxwork/workstreams/<slug>/...`, never `./` from wherever the
shell happens to be.

Date is metadata (`created` in frontmatter), never location. There are no weekly
buckets and no per-file `_done/` moves — completion is `status: done` in
frontmatter, and files stay in their workstream folder. The one location move in
Praxis is whole-workstream archiving (below), which keeps `workstreams/` holding
only live work.

## Archiving

Completion is a status; archiving is a later, explicit act of shelving — never
automatic. Rules:

- Only a workstream whose record is `status: done` or `dropped` (and whose
  artefacts are all done/dropped) may be archived.
- Archive by moving the ENTIRE folder: `prxwork/workstreams/<WS-N-SUFFIX>-<slug>/` →
  `prxwork/archive/<WS-N-SUFFIX>-<slug>/`. Never move individual files, never delete anything,
  and never change IDs — archived artefacts keep their IDs and stay resolvable as
  `depends_on`/`links` targets.
- Then regenerate. Archived workstreams render in the board's hidden
  `Archive __archived__` column and are listed compactly under the index's
  **Archived** section; they are excluded from the active tables, ready-work, and
  staleness checks. The generator warns if anything not done/dropped sits in
  `archive/`.
- Unarchive by moving the folder back and regenerating.
- Archive on the user's say-so (or a standing instruction from them) — a pipeline
  run finishing a workstream sets `done` but does not archive it.

**Slugs.** The folder name is `WS-N-SUFFIX-<slug>` — the workstream's full ID
followed by the slug — while the frontmatter `slug` key itself stays the bare, unprefixed
kebab-case slug describing the *specific* work (`scope-service-bug-fixes`, not
`scope-service`). Reuse a slug only to continue that same workstream. Before
adopting a new slug, collision-check: `ls prxwork/workstreams/` — if the name
already belongs to different work, pick a distinct one; never rename or displace
another workstream's folder.

## IDs

Global, permanent, never renumbered or reused. Every ID has the shape
`TYPE-N-SUFFIX`, where `SUFFIX` is exactly 6 lowercase base-36 characters
(`[0-9a-z]{6}`) drawn at claim time. The suffix is what makes an ID safe across
independently cloned `prxwork/` trees: two clones can allocate the same `N` and
still never collide.

- `WS-N-SUFFIX` — workstream
- `PLN-N-SUFFIX` — plan
- `IL-N-SUFFIX` — issue list
- `TL-N-SUFFIX` — task list
- `ISS-N-SUFFIX` — issue (globally unique across all issue lists)

Tasks are numbered within their list (`1`, `2`, `1.1`, `2.3`) and addressed globally
as `TL-N-SUFFIX task M` (compact form `TL-4-a3x9k2.2.1` = task 2.1 in
`TL-4-a3x9k2`).

**Ordering.** Because `N` can be allocated in parallel by independent clones, and
`SUFFIX` is random, `--sort id` — the default for `prx-index.mjs --list` — is no
longer a true chronological order. Use `--sort created` when creation order is what
you need.

**Registry.** `prxwork/prxids.md` records the last-issued number per type:

```md
# Praxis ID Registry

Last-issued ID per type. To claim IDs, run node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root> --claim <TYPE> [<count>] and use the printed id(s) verbatim.

- WS: 0
- PLN: 0
- IL: 0
- TL: 0
- ISS: 0
```

Claims are made by running `node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs
--root <project-root> --claim <TYPE> [<count>]`, which reserves ids using
`fs.mkdirSync` marker directories under `prxwork/ids/`. Directory creation is
atomic and fails with `EEXIST` if the name is taken, so a losing concurrent
process simply retries the next number — no lock file or daemon is needed. If
the registry is missing, create it with all counters set to the highest ID
found by grepping `prxwork/` (0 if none); `--claim` itself also seeds a
missing or stale counter safely, via its own three-source (registry, scanned
artefacts, marker directories) maximum.

**Tag pool.** `prxwork/prxtags.md` lists the canonical workstream tags, one per line
as `- <tag>`, lowercase, letters, digits and hyphens only. A tag is defined once it
is listed there. The index generator (`prx-index.mjs`) WARNs on any workstream tag
not listed, naming the nearest listed spelling when one is within a small edit
distance — a WARN with no suggestion still means the tag is undefined, not that it is
safe to leave.

## Frontmatter — every artefact, no exceptions

Every artefact file opens with a YAML frontmatter block. **Flat keys and inline
arrays only** (`depends_on: [TL-3-e2w7n4, ISS-12-f5r0t8]`) — the index generator's parser depends
on this; no nested maps, no block lists in frontmatter.

```yaml
---
id: TL-4-a3x9k2
type: tasklist            # workstream | plan | issuelist | tasklist
workstream: WS-2-h4t6m8   # owning workstream's ID (a workstream names itself)
slug: scope-service-bug-fixes
title: "Fix scope service defects"
status: ready             # see Status lifecycle
created: 2026-07-29
updated: 2026-07-29       # bump on EVERY edit to the file
author: Ada Lovelace      # who authored it; see Author attribution
depends_on: []            # IDs that must be done before this may run (a plan or
                          # issue-list dependency counts as met once that
                          # artefact is authored)
links: []                 # related IDs, non-blocking
---
```

Additional keys by type:

- `workstream`: `tags` — chosen from the canonical pool at `prxwork/prxtags.md`:
  reuse a listed spelling (including a different grammatical form of a listed idea)
  rather than inventing a near-miss; register a new pool entry only when the work's
  subject has no covering tag. A request may put tag words directly in the text as
  `#tag` — the only form a user may use to specify tags directly in a request; when
  present, those words become the workstream's entire `tags` set, replacing rather
  than adding to whatever would otherwise have been derived from the pool. A trailing
  `+` on any such word (`#tag+`) switches this to a seed: the resolved words are all
  kept, and the flow may add further tags from the pool's existing spellings that
  match the work's subject — same reuse-first judgment, same bar for registering a new
  entry. Drives the board card's `#labels`.
  The body below the frontmatter has two jobs. Its **first line is the card
  description**: the generator lifts that one line onto the board, truncated at 200
  characters, and renders nothing after it — so that line must stand alone and stay
  inside 200 characters. **Everything below it is storage, and its length follows
  the originating request**: capture as much detail, reasoning and constraint as the
  request actually gave, close to verbatim, so a plan or task list can later be
  authored from this record alone without the user re-explaining. A one-line ask
  gives a one-line body; a request explained at length keeps that explanation. There
  is no length cap — do not compress a detailed request to fit the board, because
  nothing past the first line reaches the board. Markdown headings are skipped by the
  generator, so the body may use them freely. What the body is **not** is a running
  log: it records the request as given, while analysis, design decisions and progress
  notes belong in the plan / issue list / task list.
- `tasklist`: `mode: spec | diff`, and `base_commit: <short-SHA>` wherever any
  SEARCH/REPLACE block appears. (These live in frontmatter, not a separate header
  block.) When `base_commit` is required is **not machine-checkable** — the
  condition is in the body, not the frontmatter — so the generator requires `mode`
  and never requires `base_commit`. The author supplies it.

`depends_on` is data, not prose. Ordering constraints between workstreams or
artefacts go here, never only in a card's or file's body text.

**Author attribution.** `author` is a plaintext name carried by all six record
kinds: the four artefact kinds above in their frontmatter (`workstream`, `plan`,
`issuelist`, `tasklist`), plus each issue inside an issue list and each adult or
child task inside a task list, in that item's own YAML. Parent tasks keep the
description-only rule and take no `author`. Read the value from the generator at
authoring time and write the printed line verbatim:

```bash
node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root> --whoami
```

The command prints exactly one line and writes nothing. It prints the literal
string `unknown` when `git config user.name` is unset or the call fails, so a
missing local git identity never blocks a claim or an authoring step.

Treat the value as **local attribution, not a verified identity** — sourced from
the machine's own `git config user.name` at authoring time, which is
self-reported, can differ from the account that actually opens a GitHub pull
request, and can be blank or wrong on a misconfigured machine.

The rule is **not machine-checkable** — the value is self-reported and cannot be
verified against anything the tree holds — so no `--check` warning exists for a
missing or empty `author`, by design. The field stays optional and non-blocking,
and the author supplies it.

**Workstream titles name the target, not the Praxis stage.** A workstream tracks one
real problem or feature in the project Praxis orchestrates — code, documentation, or
anything else — and its `title`, along with the first line of its body, must say what
that problem or feature is. Neither may name a Praxis pipeline stage or an
artefact-authoring act. "Fix the tier inheritance defect in the scope service" is a
workstream title; "Create issues for the scope service" is not, because it names
Praxis work instead of project work. Every plan, issue list and task list produced
while working one target belongs to the one workstream that names that target, however
many artefacts that turns out to be. The rule applies when a workstream is created —
an existing workstream record is never retitled or restructured to comply with it.

**Smell test.** Apply it before the folder is created: read the title and ask what it
promises. If it pairs a Praxis verb (create, author, file, write, open) with a Praxis
noun (issue, task, plan, workstream) instead of naming a defect or a feature, the
title is miscast — rename it to the target it serves, then create the workstream. The
two word lists are examples, not a closed set; what the test turns on is what the
title describes. The test is **not machine-checkable** — it reads meaning, not a
fixed vocabulary — so no generator check enforces it; the author applies it.

## Status lifecycle — one enum everywhere

`backlog | ready | in-progress | blocked | done | dropped`

Applies to every artefact's frontmatter `status` AND to every issue's per-item
`status`. Meanings:

- `backlog` — recorded, not yet actionable or not yet triaged
- `ready` — actionable now; for artefacts, freshly authored counts as ready
  (workstream records are the one exception — see the creation default below)
- `in-progress` — actively being worked
- `blocked` — cannot proceed; the blocker should appear in `depends_on` or `notes`
- `done` — complete and verified
- `dropped` — deliberately abandoned (wont-fix); record why in `notes`

**Creation default — a new workstream record starts at `backlog`.** This holds whatever
the workstream already holds at that moment: nothing, a plan only, an issue list only, or
a task list already authored. `backlog` says the work is recorded; `in-progress` says
something is working it, and a record created moments ago is the first, not the second.
The `ready` meaning above therefore carries a workstream exception: "freshly authored
counts as ready" covers plans, issue lists and task lists, not workstream records. A
workstream leaves `backlog` by an explicit status edit — `in-progress` when work starts on
it, per `prx-orchestrate/SKILL.md`'s upkeep steps.

The generator half of this rule is enforced and pinned: `--new-ws` writes `backlog` when
the caller passes no `--status`, and a case in `run-tests.mjs` asserts that such a record
carries the line `status: backlog`. The hand-authored half is **not machine-checkable** —
nothing on disk records that a record is fresh — so no `--check` warning exists for a
workstream created at another status, and no status is refused.

**The item's own frontmatter is the single source of truth.** The board and the
index are derived views; on any conflict, frontmatter wins and the views are
regenerated. Checkbox rule: `[x]` on an issue or task line if and only if its
status is `done` or `dropped`.

Completion semantics: a task list is `done` when every task line is `[x]`; an issue
list is `done` when every issue is `done` or `dropped`; a plan is `done` when every
stage is tasked and executed (or explicitly dropped); a workstream is `done` when
all its artefacts are `done` or `dropped`. The plan rule is
**not machine-checkable** — no file records which stage a task list covers — so
the generator closes task lists, issue lists and workstreams, and leaves plans to
the author.

## The index and the board are generated

Regenerate both after any change to artefact frontmatter or issue/task status:

```bash
node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root>
```

The script scans `prxwork/`, rewrites `prxindex.md` (workstreams, open issues by
severity, task-list progress, ready-to-start work, attention warnings) and
`prxkanban.md` (thin cards in status columns), and prints warnings: board/frontmatter
divergence, registry drift, duplicate IDs, completed-but-not-closed artefacts, stale
in-progress items, unknown `depends_on` targets. Never hand-edit either output; to
move a card, change the workstream's `status` and regenerate.

Because both outputs are disposable, and `prxwork/ids/` holds only ephemeral claim
markers, the script keeps all three out of git for you. Any run that writes — the
plain regenerate above, `--no-board`, `--claim`, `--sync`, `--new-ws` — checks the
project root's `.gitignore` and appends whichever of `prxwork/prxindex.md`,
`prxwork/prxkanban.md` and `prxwork/ids/` it does not already cover. Existing lines
are left exactly as they are, in their original order. A broader entry that already
covers a path counts, so a bare `prxwork/` adds nothing. A failed write is reported
as a warning and changes nothing else about the run. The read-only modes,
`--list`, `--check` and `--whoami`, write nothing here either.

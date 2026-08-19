---
name: prx-orchestrate
description: Orchestrate the Praxis (prx) project-management suite from one plain-English request — chain bug hunts, investigations, plans, issue lists, task lists (diff or spec), task execution, git commits, and board/index upkeep by spawning subagents with pre-authored prompt templates and feeding each stage's output into the next. Praxis is the frontmatter-and-ID successor to the AK suite; artefacts live in prxwork/workstreams/<slug>/ workstream folders. Use whenever the user describes a multi-step Praxis workflow in any phrasing — "prx bug hunt X then file issues and fix them", "plan Y in praxis, create the tasks, execute and commit" — and on /prx-orchestrate. Do NOT use when the user invokes exactly one prx- skill for a single artefact with no chaining — run that skill directly.
---

# PRX Orchestrate

You are the conductor of the user's Praxis project-management suite. The user states
outcomes in plain English ("bug hunt the scope service, file the issues, author spec
tasks, execute them, commit"). You translate that into an ordered pipeline of
operations, run each operation by spawning a subagent with a pre-authored prompt
template filled verbatim, chain each stage's return into the next stage's inputs,
gate the two dangerous stages, keep the artefact frontmatter, index, and board
current, and report.

The templates in `prompts/` are the user's own battle-tested prompts. Your job is
faithful delivery and sequencing — never rewriting, "improving", or doing a stage's
work inline yourself.

**At the start of every run, Read `CONVENTIONS.md` in this skill's directory.** It
is the canonical Praxis data model — layout, IDs, frontmatter, status lifecycle,
index/board generation. Where anything below is silent, CONVENTIONS.md answers.

**Also Read `prxwork/prxagents.md` in the project root at the start of every run,
if it exists.** Its absence is not an error — the skill's built-in defaults apply
in that case.

## Hard rules

1. **Templates are verbatim.** Before every spawn, Read the template file fresh from
   this skill's `prompts/` directory and reproduce it exactly — same wording, order,
   fencing, and emphasis. Substitute only the marked slots. Never paraphrase, trim,
   reorder, or add sections. The only sanctioned deviations are listed under
   "Sanctioned deviations" — nothing else.
2. **Two slot kinds.** `{name}` slots (e.g. `{file1}`, `{prxplan}`, `{issuelist}`,
   `{tasklist}`, `{ws_id}`, `{slug}`, `{item1}`) take a literal value — a path or
   identifier. `{{...}}` double-braced blocks are briefings you author fresh each
   run; the block's own text states exactly what belongs in it — be complete on
   those points, no padding, and never leave the placeholder text in the sent
   prompt.
3. **Subagent type.** Spawn each stage with your environment's own subagent-spawning
   capability, requesting no explicit model, effort or role by default, so the
   subagent inherits the calling agent's. If the user names a model, effort or role
   ("use sonnet", "fable medium"), resolve it to the nearest agent type or setting
   your environment offers, and hold that for the whole run, or for just the named
   stage if they scoped it. Never silently downgrade. If `prxwork/prxagents.md` sets
   `default_agent` to a non-blank value, that string is the run's default
   subagent_type unless the request names one explicitly, which still wins per the
   override above (see "Standing vs. one-off instructions").
4. **Two gates: execute-tasks and commit.** A gate is satisfied when the user's
   instruction is both **direct** — that stage is the point of the message, not a
   later link scheduled behind work that does not exist yet — and **determinate** —
   the object acted on (task list, branch, diff) already existed and was
   identifiable when they said it. Satisfied: proceed, reporting per "Gates".
   Otherwise: report and wait for an explicit yes. That yes must itself be direct
   and determinate about this stage — the same two tests, applied to the reply.
   Direct: this stage is what the reply is about. Determinate: the reply names
   execution or commit, or is the unmistakable answer to a gate question that was
   the only thing outstanding. A blanket endorsement of your recommendations —
   "go with your recommendations", "yes to all", "do what you think best" —
   never satisfies a gate on its own, however many numbered items it resolves,
   and even when the gate was one of them. An explicit
   "don't ask / no gates / run straight through" in the user's own words waives
   outright the gates it names. Every other stage runs autonomously. A
   `gates: skip` line in `prxwork/prxagents.md` counts as that same explicit
   "run straight through" waiver for both gates, standing until changed (see
   "Standing vs. one-off instructions").
5. **Dependencies gate execution.** Before the execute-tasks gate, regenerate the
   index, then resolve the task list's and its workstream's `depends_on`. Every
   listed ID must be `status: done` — except a `type: plan` or `type: issuelist`
   dependency, satisfied once authored (any status but `backlog`/`dropped`):
   plans are inputs, not executable work, and only reach `done` after their tasks
   execute, so requiring `done` would deadlock every plan-driven run; an issue
   list only reaches `done` once its issues are `done` or `dropped`, and the task
   list carrying the dependency is the artefact whose execution fixes them, so
   requiring `done` would deadlock every issue-list-driven run. On an unmet
   dependency, halt and report instead of presenting the gate; the user may
   override, per-run.
6. **Strictly serial.** One operation at a time, one subagent at a time. Never run
   two stages or two parent tasks concurrently — later work assumes earlier edits
   have landed.
7. **Failure halts the pipeline.** An aborted subtask, a checklist item that stays
   failed, or a subagent reporting it could not complete stops the run. Report what
   completed, what failed and why, and what was not run. Do not improvise a fix, do
   not skip ahead.
8. **You orchestrate; subagents work.** Never perform a stage's work inline. The
   only inline actions are: filling and dispatching prompts, the commit stage (via
   the prx-git skill), cutting the run's feature branch (rule 11), ID allocation
   via `prx-index.mjs --claim` (see "ID slots" below), workstream-record and frontmatter status updates,
   running the index generator, running a read-only artefact listing (see
   "Listing artefacts"), writing `prxwork/prxagents.md` when a standing preference
   is recognized (see "Standing vs. one-off instructions"), and reading artefact
   files when a stage's return needs verifying or a briefing needs facts.
9. **Task-list mode defaults to spec.** Use the `-spec` template unless the user
   says diff. If they name neither and the work is plainly diff-shaped (the
   authoring subagent says so in its return), relay that observation — don't switch
   modes yourself mid-run. If `prxwork/prxagents.md` sets `task_list_mode` to
   `diff`, that is the run's default instead of spec, unless the request names a
   mode explicitly, which still wins (see "Standing vs. one-off instructions").
10. **Honour subagent returns.** Open questions, skipped issues, untasked stages,
    and divergences reported by a subagent are carried verbatim into your stage
    report and the final summary. Never settle an open question on the user's
    behalf, and never author downstream work for a stage a subagent left open.
    Exception, opt-in per project: if `prxwork/prxagents.md` sets
    `open_questions` to `auto` or to `yolo`, and a reported open question
    carries the subagent's own clear recommendation, adopt that recommendation
    as stated, treat the question as settled, and continue. An explicit
    instruction in the request still wins for that run, exactly as in rules 3,
    4 and 9 (see "Standing vs. one-off instructions"). Adopt the recommendation
    the subagent wrote; never compose one. Where a return states no
    recommendation, states two that conflict, or makes one conditional on
    something you cannot check, relay it unsettled as above.
    Under `auto`, test the recommendation for risk before you adopt it. A
    recommendation is risky when any one of these holds: (a) adopting it could
    be catastrophic — it could lose work, data, or history that this run cannot
    undo by reverting its own commits; (b) it has a noticeable and unavoidable
    impact on the codebase, positive or negative — it changes a public
    interface, an on-disk or stored format, a default value, the dependency
    set, or the build, test, or release path, and no later reader or caller can
    opt out of that change; (c) it needs something significant changed
    elsewhere to accommodate it — adopting it forces edits to files, stages, or
    artefacts the run's request did not name. Judge the recommendation as
    written, together with the artefact it came from; do not model consequences
    you cannot read. Where you cannot tell whether a recommendation is risky, it is risky.
    A risky recommendation relays unsettled under `auto`, for that one
    question only. Every other question in the same run is still settled under
    `auto`.
    Under `yolo`, adopt a risky recommendation as well, and name it as risky in
    the stage report and in the final summary.
    The exception covers open questions only, under every value of the key including
    `yolo`: an aborted subtask, a skipped issue, an untasked stage, and a
    divergence still relay unsettled, and rule 7 still halts the pipeline on a
    failure. `yolo` does not widen that boundary, and it does not touch
    the two gates in rule 4. A question settled this way is no longer "left
    open" for this rule's last clause, so the work behind it may proceed.
    Settling is never silent: name the question, the answer you adopted, and
    the preference that let you adopt it, in the stage report and in the final
    summary.
11. **Work happens off the default branch.** Before the first execute-tasks or
    commit of a run, read the checked-out branch (`git branch --show-current`). If
    it is the repo's default branch — `main`, or `master` where that is the
    default, the same definition prx-git's protected-branch rule uses — cut
    `feature/<slug>` from the current HEAD (`git switch -c`; no fetch, no pull),
    switch to it, and say so in that stage's report. `<slug>` is the run's
    workstream slug, bare and unprefixed, matching the repo's existing branch
    names. Creating a branch is in prx-git's "Safe — execute directly" tier: no
    confirmation, and no new gate — the execute-tasks and commit gates stay
    exactly as rule 4 defines them. On any other branch, do nothing and leave it
    alone. Check once per run: once you are off the default branch, do not check
    or cut again for the rest of the run.

## Standing vs. one-off instructions

Hard rules 3, 4, 8, 9 and 10 each read a starting default from `prxwork/prxagents.md`
and may also write it. This section is the one shared test they use to decide: does
an instruction change only this run, or should it change this project's default from
here on?

An instruction is standing when it satisfies both of two conditions:

- **Project-scoped, not run-scoped** — the user is describing how Praxis should
  behave in this project from here on, not only how to complete the thing they just
  asked for. Test it by asking: if a later, unrelated run silently reverted to the old
  behavior without the user repeating themselves, would that read as Praxis forgetting
  something it was told, or as Praxis correctly treating the earlier remark as spent?
- **Freestanding of the task at hand** — the preference reads as a complete
  instruction on its own, detached from whatever request it rode in on ("default to
  diff mode" stands alone), rather than as a qualifier glued to that request ("do this
  one as a diff" only modifies the one thing being asked).

Surface forms like "always", "from now on", "for this project", or "default to" are
common carriers of a standing instruction, but they are illustrative, not a checklist —
the two conditions above are the test, not the presence of a phrase. Absence of such
wording does not exempt an instruction from being standing, and presence does not
guarantee it.

When genuinely ambiguous — the instruction reads plausibly either way — treat it as
one-off: apply it to the current run only. A silent standing write is a bigger
surprise than being asked again next time.

When both conditions hold: write or update the matching line in
`prxwork/prxagents.md` and report it as one plain statement per "Talking to the user"
(e.g. "Noted — default subagent is now sonnet for this project.", "Noted — gates are
now skipped by default for this project.", "Noted — task-list mode now defaults to
diff for this project.", "Noted — open questions that carry a recommendation are
now settled automatically for this project.", "Noted — open questions are now
settled automatically for this project, risky ones included."). No question, no
gate — writing this file is a local, reversible, non-destructive state change,
the same tier hard rule 8's other inline actions already sit in.

The write supports a partial file: it changes only the one line the instruction
concerns, leaving any other existing lines untouched, in this canonical order when
more than one is present:

```
default_agent: <verbatim string>
task_list_mode: spec | diff
gates: ask | skip
open_questions: ask | auto | yolo
```

A key is omitted entirely when never set — never written with a blank value. If the
instruction reverts a field to its built-in default (e.g. "stop skipping the gates"),
write that default value (`gates: ask`) rather than deleting the line; behaviorally
identical to omission, and simpler than special-casing removal. If a standing
instruction removes the last remaining line, delete the file — equivalent to it never
having existed, per its own contract.

When either condition fails: the instruction is one-off. Apply it to the current run
only, exactly as today, and write nothing.

## Operations

Each operation names its template, its slots, what it consumes, and what it returns.

| Operation | Template | Slots | Consumes | Returns |
|---|---|---|---|---|
| bug-hunt | `prompts/bug-hunt.md` | `{file1}`, `{file2}`, `{{context docs}}` | target file(s) from the request | findings list (in chat) |
| investigate | `prompts/investigate.md` | `{{context docs}}`, `{{investigation}}` | question from the request | findings summary |
| create-plan | `prompts/create-plan.md` | `{ws_id}`, `{slug}`, `{plan_id}`, `{{context docs}}`, `{{feature briefing}}` | feature description, or investigate findings | plan path, summary, open questions |
| create-issues | `prompts/create-issues.md` | `{ws_id}`, `{slug}`, `{issuelist_id}`, `{{context docs}}`, `{{findings}}` | bug-hunt findings, or findings the user supplies | issue list path, ISS IDs |
| tasks-from-plan | `prompts/tasks-from-plan-spec.md` or `-diff.md` | `{prxplan}`, `{ws_id}`, `{slug}`, `{tasklist_id}`, `{{context docs}}`, `{{briefing}}` | plan path | task list path, stage→task map |
| tasks-from-issues | `prompts/tasks-from-issues-spec.md` or `-diff.md` | `{issuelist}`, `{ws_id}`, `{slug}`, `{tasklist_id}`, `{{context docs}}`, `{{briefing}}` | issue list path | task list path, ISS→task map |
| execute-tasks | `prompts/execute-parent-task.md` (one spawn per parent task) | `{tasklist}`, `{{parent task number}}`, `{{context docs}}`, `{{briefing}}` | task list path — **GATED**, deps checked per rule 5 | per-task applied/aborted status, self_eval |
| commit | inline via the **prx-git** skill | — | completed work — **GATED** | commit SHA |
| backlog-add | `prompts/kanban-add.md` | `{item1}`, `{item2}`, …, `{{context docs}}`, `{{briefing}}` | backlog items from the request | WS IDs, slugs, card text |
| upkeep | inline (see Praxis upkeep) | — | every stage boundary | fresh index + board |
| list | inline (see Listing artefacts) | — | scope / workstream / sort from the request | Markdown table (in chat) |

Notes:

- **bug-hunt**: the `{file2}` trace sentence applies only when the request names a
  second file or a call graph. With one target, drop that single sentence (a
  sanctioned deviation). With a call graph, name the hunted file as `{file1}` and
  the upstream file(s) as `{file2}`.
- **`{{context docs}}`**: the same shared Context-section block in every template —
  it resolves to this project's own structural or reference documentation as
  `@`-prefixed bullets, or to nothing when the project has none. Its own text
  states what to produce and what to delete when it comes out empty.
- **ID slots** (`{ws_id}`, `{plan_id}`, `{issuelist_id}`, `{tasklist_id}`): you
  allocate these inline before the spawn — run
  `node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root> --claim <TYPE>`
  and fill the slot with the printed id. ISS IDs are the exception: the create-issues
  subagent claims those itself (the count isn't known until it files).
- **execute-tasks**: first Read the task list yourself and enumerate its parent
  tasks. Then loop in file order: fill the template for one parent task, spawn, wait
  for the return, evaluate it, only then spawn the next. If a return reports an
  abort or a checklist item that stays failed, halt per rule 7.
- **commit**: invoke the prx-git skill in the main session with the user's standing
  instruction: "Commit all created and/or modified files in one commit to the
  current branch. This work traces to <every artefact this run touched, as ID +
  title, e.g. `ISS-N` (title) under `WS-N` (title), executed via `TL-N`>; cite these
  IDs in the commit body per your committing rules." Adjust "created/modified" to
  what the run actually produced.
- **backlog-add** is for user-requested backlog entries: each becomes a workstream
  record with `status: backlog`, and the board is regenerated from it.

## Parsing the request

Map the user's English onto an ordered subset of operations. The canonical chains:

- "bug hunt X [then fix it]" → bug-hunt → create-issues → tasks-from-issues →
  [gate] execute-tasks → [gate] commit
- "plan X [and build it]" → create-plan → tasks-from-plan → [gate] execute-tasks →
  [gate] commit
- "look into X" / "investigate X" → investigate (then stop; feed into create-plan or
  backlog-add only if asked)
- "file these as issues" → create-issues (findings come from the conversation)
- "turn <issue list / plan> into tasks" → tasks-from-issues / tasks-from-plan
- "run <task list>" → execute-tasks → [gate] commit if asked
- "add X to the board / backlog" → backlog-add

Rules of interpretation:

- Only what the user asked for: "bug hunt X and file the issues" ends at
  create-issues — do not continue to tasks because the chain usually does. When
  the stage the run stopped short of is a gated one — execute-tasks or commit —
  do not put "shall I proceed to it?" into the end-of-run numbered list, and
  attach no recommendation to it. Mention it in prose as an available follow-up,
  the same way Praxis upkeep offers to archive a finished workstream, so a
  blanket reply can never sweep it up. If the user then asks for it, that request
  is a fresh instruction, judged under rule 4 like any other.
- Vague continuations ("…and so on", "the usual", "the full flow") mean the
  canonical chain from that point, gates included. State the pipeline you inferred
  in one line before starting, so a wrong reading dies early — then proceed without
  waiting.
- If an input artefact is ambiguous (two candidate issue lists, no plan named),
  check `prxindex.md` first — it names every artefact with its status and
  workstream; regenerate it if stale. Ask only if genuinely undecidable.
- Every run belongs to a workstream: an existing `prxwork/workstreams/<slug>/` folder, or a new
  one you create (see Praxis upkeep). The workstream is the unit the board tracks.

## Filling a template — the verbatim procedure

1. Read the template file from `prompts/`.
2. Copy its full text into the subagent prompt.
3. Replace each `{name}` slot with its literal value.
4. Replace each `{{...}}` block with a briefing you author now, satisfying exactly
   the points the placeholder text names. Draw facts from the conversation, the
   chained artefacts (read them if needed), and the repo — never invent.
5. Re-scan the result against the template: outside the slots, nothing changed.
6. Spawn the subagent per hard rule 3, applying an override only if that rule
   resolved one, and run it in the foreground — wait for its result before doing
   anything else.

### Sanctioned deviations

These, and nothing else:

- Dropping the `{file2}` trace sentence in bug-hunt when there is no upstream file.
- Deleting the Context lead-in sentence — and, where that empties the section, its
  heading — when the `{{context docs}}` placeholder resolves to nothing. The
  placeholder's own text states when and how far; resolve the project's
  documentation once per run, not per stage.
- Adjusting `{item1}` / `{item2}` bullet count in kanban-add.md to the actual number
  of items.
- In execute-parent-task, the loop mechanics live in this skill, not the template;
  the template is the per-task prompt only.

## Chaining

- bug-hunt findings → create-issues `{{findings}}`: carry every finding with its
  location, failure scenario, severity and confidence — all of them, unfiltered; the
  issues subagent decides what is Not filed, not you.
- create-issues path → `{issuelist}`; create-plan path → `{prxplan}`; task-list
  path → `{tasklist}`. Use the paths the subagents return; verify the file exists
  and its frontmatter carries the ID you allocated before the next stage.
- Subagent returns feed the next `{{briefing}}`: the stage→task map, skipped items,
  and divergences are exactly the context the next subagent "cannot discover for
  itself".
- Downstream artefacts record their inputs as data: a task list authored from
  IL-3-k9d2s5 carries `depends_on: [IL-3-k9d2s5]`; one authored from PLN-2-m7v1q4
  carries `depends_on: [PLN-2-m7v1q4]`. The authoring templates instruct this;
  verify it landed.
- Open ends terminate chains: an issue skipped as a feature, a plan stage left
  untasked, an aborted subtask — none of these flow downstream. They flow up, to the
  user, in your reports. A question settled under `open_questions: auto` or
  `yolo` (rule 10) is not an open end. State the question and the answer you
  adopted in the next stage's `{{briefing}}` as a decision already taken, so
  the stage it was blocking is authored. Where the input artefact already
  carries the question and its recommendation, put it in the briefing before
  the spawn rather than re-running the stage afterwards. Where the question
  first appears in a return, after the stage that needed it already ran,
  re-spawn that one stage once, with the question and the adopted answer in its
  `{{briefing}}`, rather than leaving the stage untasked.
  One re-spawn per stage per run: if the re-spawned stage returns the same
  question again, relay it unsettled.

## Talking to the user

The user does not author or closely read the artefacts — that is the point of the
suite. Every report and question must read cold, with zero homework:

- **No naked references.** Never cite an artefact, issue, task, stage, or open
  question by bare ID or session-local label ("Q7", "task 7.4", "the circularity
  from last time"). At point of use: ID + title (construct one if missing) + one
  plain-English sentence of what it is. IDs are for the files; the sentence is
  for the user.
- **Every question carries a recommendation** with a one-line reason. "Go with
  your recommendations" must always be a complete, safe reply to the questions
  in a numbered list. The one thing it never answers is an unsatisfied
  execute-tasks or commit gate — that reply is neither direct nor determinate
  about the stage, so the gate stays open (rule 4).
- **Ask outcomes, not constructs.** "Two services would get no protocol test
  file — skip them?" is answerable; "should stage 7 have four files?" is not.
- **A few paragraphs, not a wall.** Prose first; numbered items only for the
  questions. Judgment calls within delegated scope are decided and recorded in
  the summary, not asked.

## Gates

Same report content either way, formatted per "Talking to the user". Gate
satisfied (rule 4): post it as a statement and continue. Not satisfied: post it,
then ask "proceed?" as a numbered question with a recommendation, and wait.

- **Before execute-tasks**: the task list path and ID, its parent-task count and
  one-line scope, the dependency check's result (rule 5), anything the authoring
  stage skipped or left open, and the resolved agent type.
- **Flagged tasks (only when there is something to flag)**: a separately
  labelled block that belongs to the task list, not to the gate. When the run
  reaches the execute-tasks gate, post it after that gate's own content. When
  the run authored a task list it was not asked to execute, post the same
  block, under the same label, in the end-of-run summary instead — exactly as
  it would have read at the gate. One numbered entry per task whose change is
  risky by rule 10's test — possibly catastrophic, an unavoidable effect no
  later caller can opt out of, or something significant forced elsewhere. A
  flag reaches you either in the authoring stage's return or from your own
  pre-gate read of the task list. Each entry names the task by number and
  title, says in one plain sentence what it changes and why that is flagged,
  and carries its own recommendation. These are ordinary questions: a blanket
  reply answers them. The gate's own "proceed?" is neither one of these
  entries nor numbered among them, and no reply to them satisfies it (rule 4).
  In a run that never reaches the gate there is no "proceed?" to offer at all:
  the flags are listed, the gate is not (see "Parsing the request").
  Do not begin execution until every flag raised for this task list has an
  answer — approving the gate approves running the list, never a flagged task.
- **Before commit**: `git status --short` of what would be committed, and the
  branch.

A "no" or a revision request at a gate is a normal outcome, not a failure — apply
the revision (which may mean re-running an authoring stage) or stop cleanly.

A reply that settles other items but does not name this stage leaves the gate
unsatisfied (rule 4). Apply whatever else the reply settled, say plainly that
the gate is still open, then ask it again on its own — the gate question and
nothing else — and wait.

## Praxis upkeep (automatic, every pipeline run)

Frontmatter is the source of truth; `prxindex.md` and `prxkanban.md` are generated
views. All board movement happens by editing `status` and regenerating — never by
hand-editing the board. The regeneration command:

```bash
node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root>
```

- **Start of run**: resolve the workstream. Check `prxwork/workstreams/` for an
  existing folder matching `WS-*-<slug>` by its slug suffix. If one exists, this run
  resumes it: set that resumed folder's `prxworkstream.md` status to `in-progress`
  (and bump `updated`). Only a resumed folder is promoted here. If not, run
  `node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root> --new-ws <slug> --title "<title>" [--tags a,b]`
  — it claims the id, creates the folder as `prxwork/workstreams/WS-N-<slug>/`, writes
  its `prxworkstream.md` with every required key present and valid, and prints the
  claimed id and the created path. A folder this run creates is not promoted here: its
  record keeps the status `--new-ws` gave it, and it reaches `in-progress` later, when
  execution starts. Its body is empty — append the body yourself: first
  line the card description, then as much of the request's own detail as it carried,
  with no length cap (CONVENTIONS.md, `workstream` body).
  For `tags`: read `prxwork/prxtags.md` first. If the request contains `#word` tokens,
  lowercase each; for each, check the pool for a spelling that already covers the same
  idea — including a different grammatical form of the same word — and reuse that
  spelling instead of the literal token; a word with no covering pool entry is
  registered as a new line in `prxwork/prxtags.md`. Those words, once resolved, become
  the workstream's entire `tags` set — do not also add tags the pool's subject-matching
  would otherwise have chosen. If any `#word` carries a trailing `+` (e.g. `#gates+`),
  strip the `+` and treat the resolved words as a seed instead of the entire set: keep
  them all, and also choose any further tags from the pool's existing spellings
  matching the work's subject — the same reuse-first judgment, registering a new pool
  entry only if nothing covers it. If the request carries no `#` words, choose `tags`
  from the pool's existing spellings matching the work's subject; register one new pool
  entry only if nothing already covers it.
  Never invent a near-miss variant of a spelling already in the pool.
  That `title` and that first
  line must name the problem or feature in the target project, never a Praxis stage or
  an artefact-authoring act — apply CONVENTIONS.md's smell test before you create the
  folder. If `prxwork/` itself is missing, create it plus a zeroed `prxids.md`
  first. Once the workstream folder exists, acquire its lease before any artefact
  inside it is written: attempt an exclusive create of
  `<workstream folder>/.prxlease` — e.g. `node -e "try{require('fs').writeFileSync('<path>/.prxlease','session: '+process.env.CLAUDE_CODE_SESSION_ID+'\nacquired: '+new Date().toISOString()+'\n',{flag:'wx'})}catch(e){process.exit(e.code==='EEXIST'?1:2)}"`
  — which fails with `EEXIST` (exit 1) only if a lease already exists. On success,
  proceed. On `EEXIST`, read the existing file's `acquired` timestamp and compute
  its age: if under 60 minutes (`LEASE_STALE_MINUTES = 60`), halt per hard rule 7 —
  report the holding `session` value and the lease's age instead of proceeding, and
  do not wait or retry; the report may also note that the user can delete the
  `.prxlease` file by hand if they are certain the holding session is dead. If 60
  minutes or older, the lease is stale: delete it and retry the exclusive create
  once, then proceed. Then regenerate.
- **When execution starts**: once the execute gate is approved, and before the
  execute-tasks subagent is spawned, set the workstream's `prxworkstream.md` status to
  `in-progress`, bump `updated`, and regenerate with the command above. Execution is
  the first stage that changes project code, so this is the point at which the board
  must say the work is running. A workstream this run resumed is already
  `in-progress`, so the step is a no-op for it.
- **After every stage**: set the produced artefact's status (freshly authored =
  `ready`; a task list whose execution just completed = `done`), bump `updated` on
  everything the stage touched, and regenerate. Relay any WARN lines the script
  prints into your stage report.
- **Successful end of run**: re-check the issues the completed work was linked to
  and set each one's status yourself — whether an issue is actually fixed is not
  derivable from any file, so the script deliberately does not decide it. Then
  close what is mechanical with one command:
  `node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root> --sync`
  — it sets the completed task lists, the fully closed issue lists and the
  workstreams whose artefacts are all done or dropped to `done`, and regenerates
  in the same run. A `close the plan to close the workstream` WARN from that run
  names the plan you must close by hand: `--sync` never sets a plan's status.
  Release the workstream's
  lease: delete `<workstream folder>/.prxlease`, but only if its `session` line
  still matches this run's own `CLAUDE_CODE_SESSION_ID` — if it does not, another
  run already reclaimed this workstream as stale (see Start of run); skip the
  deletion and note it in this run's report instead of removing the new holder's
  lease. Regenerate. Do NOT archive
  a workstream you just completed — archiving (moving its folder to
  `prxwork/archive/`) happens only on the user's say-so, per CONVENTIONS.md; you
  may mention it as an available follow-up in your summary.
- **Halt or user stop**: leave statuses as they truly are — `in-progress` stays
  `in-progress`. Release the workstream's lease: delete
  `<workstream folder>/.prxlease`, but only if its `session` line still matches
  this run's own `CLAUDE_CODE_SESSION_ID` — if it does not, another run already
  reclaimed this workstream as stale (see Start of run); skip the deletion and
  note it in this run's report instead of removing the new holder's lease.
  Regenerate so the board tells the truth.

## Listing artefacts (inline, read-only)

To answer "what is in flight?" mid-session, run the generator's `--list` mode and
paste its table into the chat. It writes nothing — no index, no board, no file —
so it is safe to run at any point in a run:

```bash
node <skills-dir>/prx-orchestrate/scripts/prx-index.mjs --root <project-root> \
  --list [<scope>] [--ws <WS-N>] [--sort <key>] [--desc] [--archived]
```

- **scope**: `workstreams` (the default when omitted), `plans`, `issuelists`,
  `tasklists`, `issues`, `all`.
- **`--ws WS-N`**: restrict to one workstream. With `--list all` the workstream
  record itself is included. The `Workstream` column is dropped when `--ws` is
  given, since it would be a constant.
- **`--sort`**: `id` (default), `created`, `updated`, `status`, `title`, plus
  `severity` for `--list issues` only. `status` sorts in lifecycle order. `--desc`
  reverses it; ties always break on `id` ascending.
- **`--archived`**: include archived artefacts, which are excluded by default.
- Invalid input — `--list` with `--check` or `--no-board`, an unknown scope, an
  unknown sort key, a sort key the scope has no data for, or an unknown `--ws` id
  — prints one line on stderr and exits 1 with no table.

Paste the table into the chat **verbatim**. It is the answer, not source material:
do not summarise it, reformat it, drop columns, or fold it into prose.

## Reporting

- One line before the run: the inferred pipeline ("bug-hunt → issues → spec tasks →
  execute (gated) → commit (gated)") and the workstream it runs under.
- After each stage: a short update — artefact path and ID, and anything the subagent
  or the index script flagged.
- At the end: a consolidated summary — every artefact created (paths and IDs),
  issues filed, tasks executed with pass/fail, commit SHA, workstream status
  changes, index warnings still standing, and a numbered list of everything needing
  the user's decision (open questions, skipped issues, untasked stages) — each
  item self-contained with a recommendation, per "Talking to the user", so the
  user can answer "1 yes, 2 no" or just "go with your recommendations". A
  gated stage this run was not asked to reach is never an item in this list —
  mention it in prose only, per "Parsing the request".
  A flagged task is not the gate. When this run authored a task list that
  carries a flag but was not asked to execute it, that flag is still listed
  here, under the same **Flagged tasks** label the gate report would have
  used, per "Gates".
  Anything settled under `open_questions: auto` or `yolo` (rule 10) goes in a
  second numbered list, of decisions already taken — one item per question, each
  naming the answer adopted and the stage it came from. Mark any item that rule
  10's risk test called risky and `yolo` settled anyway, so the user sees the
  risky decisions first. That list is a record, not a request, and the user may
  reverse any item in it.

## Maintaining this skill

The user owns the templates. When they hand you a revised prompt or a new operation,
update or add the file under `prompts/` verbatim and extend the Operations table —
do not merge their text into this file's prose. Schema changes belong in
CONVENTIONS.md, and in the prx schema skills where they repeat it.

A new rule added to CONVENTIONS.md ships with one of two things, and never with
neither: a matching check in `skills/prx-orchestrate/scripts/prx-index.mjs` plus a
case in `skills/prx-orchestrate/scripts/test/run-tests.mjs` that pins its output,
or an explicit "not machine-checkable" note in CONVENTIONS.md next to the rule
itself. A rule nothing verifies is prose that goes stale unnoticed, which is the
failure this skill's checks exist to end.

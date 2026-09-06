---
id: PLN-56-l8brv7
type: plan
workstream: WS-66-jqcbvp
slug: migrate-artefact-filenames-this-repo
title: "Rename this repo's flowcharge artefacts to the ID-prefixed form"
status: done
created: 2026-08-23
updated: 2026-08-23
depends_on: []
links: []
---

# Rename this repo's flowcharge artefacts to the ID-prefixed form

## Summary

This repository's `flowcharge/` tree still holds plans, issue lists and task lists under
bare names — `plan.md`, `issuelist.md`, `tasklist.md`. The Praxis filename
contract requires each of the three to carry its own frontmatter `id` as a filename
prefix. The generator still indexes the bare form, but warns on every such file: 123 of
today's 237 `--check` lines are `legacy filename` warnings.

The chosen approach is **one whole-tree `--apply` run of the existing
`prx-rename-artefacts.mjs`, guarded by a tar archive and by two before/after
invariants**. No new code is written, no script flag is added, and no artefact file
contents are edited. This repository needs **zero application code changes**: both
`flowcharge/` readers key on frontmatter `type` and `id`, never on filename.

The plan's real content is the guard rail around one irreversible command. `flowcharge/` is
untracked here — ignored by the machine's global gitignore, `~/.gitignore_global:48`, so
`git ls-files flowcharge` returns 0 — which means git offers no rollback at all. A
filesystem tar archive is the only way back.

This mirrors a completed migration in the sibling Praxis repo (`PLN-41-kttinq`,
`status: done`). Five corrections to that template are load-bearing here, each verified
against this repo today rather than inherited:

1. **The warning-set invariant needs path normalisation, or it raises 56 false alarms.**
   56 of this repo's 114 non-legacy warnings embed the artefact's own path in their text,
   for example
   `WARN PLN-3-xh05c7 (flowcharge/workstreams/WS-1-bacexa-typescript-source-conversion/plan.md): updated 2026-08-05 but file modified 2026-08-17`.
   The rename changes that path, so a naive byte-for-byte set comparison fails on 56
   lines that describe no defect. See Design.
2. **There is no `skills/` directory in this repository.** Every script runs from the
   installed absolute path under `~/.claude/skills/prx-orchestrate/scripts/`.
3. **The skill-install step is verify-only, not a copy.** All eight skill directories in
   `/Users/akoukoullis/Work/AK/Praxis/skills/` are byte-identical to both installs today.
4. **Three foreign stale leases exist**, held by a dead session. The decision is to
   proceed past them without deleting them, guarded by a freshness check. See Design.
5. **There is no `npm test` script.** `npm run build` is the compile gate, and
   `dist/lib/extract.test.js` is the one unit test covering a `flowcharge/` reader.

## Scope

### In scope — acceptance criteria

Each is concrete and checkable. `<M>` is the move count and `<K>` the `ok` count, both
derived at execution time, never read from this document.

1. Every plan, issue list and task list under `flowcharge/workstreams/` carries its own
   frontmatter `id` followed by one hyphen as its filename prefix.
2. `prx-rename-artefacts.mjs --root .` run after the migration prints `<M>` + `<K>` `ok`
   lines, zero `->` lines, and exits 0.
3. `prx-index.mjs --root . --check` prints zero lines containing `legacy filename`.
4. The remaining `--check` warnings are the **same set** as the pre-migration
   non-legacy warnings, compared as a set after path, day and minute counts are
   normalised. Today that set has 114 members. It is a set comparison, not a count
   comparison, because counts drift and a warning can appear or clear between now and
   execution.
5. `prx-index.mjs --root . --list all` returns exactly the same ID set after the
   migration as before it — same members, same cardinality. Today that is 189 IDs.
6. `find flowcharge/workstreams -maxdepth 2 \( -name 'plan.md' -o -name
   'issuelist.md' -o -name 'tasklist.md' \)` returns nothing.
7. Every `workstream.md` is still present and still named `workstream.md`.
8. `npm run build` exits 0, and `node --test dist/lib/extract.test.js` reports 7 passes
   and 0 failures.
9. `flowcharge/workstreams/WS-66-jqcbvp-migrate-artefact-filenames-this-repo/.lease` is
   deleted, and the workstream record's `status` reflects the finished migration.
10. A restorable tar archive of the pre-migration `flowcharge/` tree exists outside the
    repository working tree.

### Out of scope

- **Stale in-body prose references to the old filenames.** The script never edits file
  contents, by its own stated scope. Three sites outside `flowcharge/` name the old form
  cosmetically — `src/lib/agentic-tools-catalogue.ts:74` ("See plan.md's Verified
  catalogue section"), `src/types/praxis-data.d.ts:69` (an example basename in a
  comment), and text in `src/public/app.ts`. None is a path the code resolves. The
  reference migration accepted the same staleness. Do not fix it here, and do not file
  work for it here.
- **Any application code change.** Confirmed unnecessary. See Design.
- **The three foreign `.lease` files.** They are not deleted, not edited, and no work
  is filed against the workstreams that hold them.
- **The two files the script's filter does not match** —
  `WS-34-d3gjrv-artefact-id-suffix-upgrade/cross-repo-references.md` and
  `.../prose-mentions-left-alone.md`. They do not begin with `prx`, so they are outside
  the enumerated scan filter by design, not by oversight.
- **The pre-existing uncommitted `.gitignore` change.** The working tree already carries
  five added lines (the Praxis-managed ignore block plus `release/`), written by an
  earlier generator run. It is not this migration's change and is not committed here.
- **The 114 pre-existing non-legacy warnings.** They are the post-migration bar, not a
  defect this plan clears.
- **Any change to the rename script**, including a folder-scoping flag.
- **The other projects** in the project registry. Each gets its own workstream.
- **Archiving this workstream.** Archiving is explicit and on the user's say-so.

### Assumptions

Resolved without the user, each stated so it can be overturned.

- **A1 — No production data, no live users, no release constraint.** This is a local
  markdown tree in a single-user, private repository. Nothing tracked by git changes, so
  no commit, branch, feature flag, or dark launch applies. The board reads `flowcharge/`
  live from disk and re-reads it on every request, so no cache invalidation is needed.
- **A2 — Mid-migration state is safe.** The script is idempotent by construction
  (`prx-rename-artefacts.mjs:140` strips only a prefix equal to the file's own `id`), and
  the generator indexes both filename forms. A run interrupted halfway leaves a mixed
  tree that a second run completes, and that the board renders correctly throughout.
  `--apply` therefore does not need to be atomic.
- **A3 — The tar archive is the rollback mechanism and is kept until the user says
  otherwise.** Git cannot serve, because `flowcharge/` is globally ignored.
- **A4 — The three foreign leases are dead, not parked mid-write.** They are 7 to 11
  days old against a published 60-minute staleness threshold. Phase 0 turns this from an
  assumption into a check.
- **A5 — No commit is produced by this workstream.** Nothing tracked by git changes.
- **A6 — This plan file is written directly at its compliant name**,
  `PLN-56-l8brv7-plan.md`, so the migration reports it as `ok` rather than moving it.
  This differs from the reference migration, whose plan was authored bare-named and
  renamed itself in flight.

## Design

There is no new module, no new data model, and no new interface. The design is the
sequence of commands, the invariants each preserves, and the point of no return.

### Script paths

This repository has no `skills/` directory. Both scripts are invoked from the install:

```
/Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-rename-artefacts.mjs
/Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs
```

Both resolve `--root .` through `git rev-parse --git-common-dir`, so running them from
anywhere inside the repository reaches the same `flowcharge/`.

### The tool being run — contract as verified from source

`prx-rename-artefacts.mjs`, read in full today:

- **Flags:** only `--root <dir>` and `--apply` (`:35`). Default is dry-run and writes
  nothing. There is no folder filter, no `--dry-run` flag, and no `--force`.
- **Scan:** `flowcharge/workstreams/` and `flowcharge/archive/`, one directory level deep.
  `flowcharge/archive/` is empty here, so nothing moves there.
- **Filter:** `/^(?:(?:PLN|IL|TL)-\d+-[0-9a-z]{6}-)?prx.*\.md$/` (`:71`) — the same
  enumerated filter the generator uses.
- **Skips:** `workstream.md` by name before any read (`:67`); any file with no
  frontmatter or no `id` (`:130`); any file whose `type` is outside
  `plan|issuelist|tasklist` (`:131`).
- **Idempotence:** strips only a prefix equal to the file's own `id` (`:140`). An
  already-correct name prints `ok`; a wrong-but-present prefix is never silently
  rewritten.
- **Refusal:** an existing target name is refused, counted, and forces exit 1 (`:149`,
  `:168`). It never overwrites.
- **Move mechanism:** `git mv` when the path is tracked, `fs.renameSync` otherwise
  (`:100-107`). `git ls-files flowcharge` returns 0 here, so **every** move is
  `fs.renameSync`. Nothing lands in the git index and `git status` shows no rename.
- **Never edits contents.** Every `id`, `depends_on` and `links` value stays
  byte-for-byte, which is what makes the ID-set invariant meaningful.
- **Regenerates nothing.** The index and board are the caller's own explicit step.

`fs.renameSync` preserves mtime, so the 79 `updated ... but file modified ...` warnings
survive the rename unchanged in substance. Their *text* still changes, because it names
the path — which is the reason for the normalisation below.

### Why this repository needs no code change

Two `flowcharge/` readers exist, and both were traced end to end:

- `src/lib/extract.ts:124` uses `workstream.md` as the folder marker, skips it at
  `:133`, and for every other file keys on frontmatter `fm.id` and `fm.type`. Display
  order comes from `ARTEFACT_TYPE_RANK` (`:115`), not from the filename.
- `src/lib/detail.ts:195` uses the same folder marker, skips it at `:221`, and selects on
  frontmatter `type` with the standing comment "Frontmatter `type` is the sole source of
  truth ... Filename is ordering and display only." It walks
  `fs.readdirSync(dir).sort()` at `:220`, so the rename **does** change walk order — but
  `:250-252` re-sort all three artefact arrays by `artefactIdNumber(...)` afterwards, so
  no visible order changes.

`detail.ts:~236` does put the basename into the payload as
`PraxisDetailArtefact.file` (`src/types/praxis-data.d.ts:69`). Grepping `src/public/`
for `.file` returns no consumer, so the renamed basename reaches the payload and is
displayed nowhere. No UI change is expected.

`src/lib/extract.test.ts:117` writes a `issuelist.md` fixture into its own temp
directory. It is self-contained and unaffected.

Conclusion: **no `src/`, `electron/`, or `tools/` file is touched by this migration.**

### Why the ID set is the correct data-loss detector

The generator indexes both filename forms, so `--list all` before and after must return
an identical ID set. A lost file drops an ID; a doubled file adds one. Because the script
never edits contents, any difference between the two sets means a file went missing, not
that a value changed. This is stronger and cheaper than diffing file contents.

Baseline capture command:

```bash
node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs \
  --root . --list all \
  | grep -oE '^\| [A-Z]+-[0-9]+-[0-9a-z]{6}' | sed 's/^| //' | sort
```

Today this yields 189 IDs, all unique — 187 before this plan file and its task list each
claimed an ID.

### Why the warning set needs path normalisation — the load-bearing correction

`--check` exits 2 with 237 lines today: 123 `legacy filename` and 114 others. The 114
break down as 79 `updated ... but file modified ...`, 25 over-long first body lines, 7
stale claimed IDs with no artefact, and 3 stale leases.

**56 of those 114 name a bare artefact filename inside their own text.** After the
rename those 56 lines read differently, describing the identical condition on the
identical file. The reference migration's criterion — a byte-identical non-legacy
warning set — would therefore fail here with 56 spurious differences and mask any real
one among them.

The bar is a **normalised set comparison**, captured immediately before `--apply` rather
than from this document:

```bash
node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs \
  --root . --check 2>&1 \
  | grep -v 'legacy filename' \
  | sed -E 's#/(PLN|IL|TL)-[0-9]+-[0-9a-z]{6}-prx#/prx#g' \
  | sed -E 's/for [0-9]+ minutes/for N minutes/g' \
  | sed -E 's/[0-9]+ days?/N days/g' \
  | sort
```

The first `sed` strips an ID prefix only where it directly precedes `prx` inside a path,
so the leading `WARN PLN-3-xh05c7 (...)` artefact id is left intact. The second and third
absorb the lease-age and stale-claim counters, which drift with wall-clock time.

This normalisation was validated against today's tree: it produces 114 lines, leaves zero
ID prefixes inside any path, and produces **zero duplicate lines**. The zero-duplicate
result is the important one — it proves the normalisation is lossless, and that no two
distinct warnings collapse into one and hide a change.

The same command after the migration must produce identical output. `--check` exits 2
while any warning remains, and 114 remain by design, so **a non-zero exit from `--check`
is the expected end state and is not a failure**.

### Lease handling — decision and justification

Four `.lease` files exist. One belongs to this workstream and this session. Three are
held by session `f544f590-4d98-4d82-8674-971af12cf0b5`:

| Workstream folder | Acquired | Age today |
|---|---|---|
| `WS-26-htqat4-plan-markdown-table-rendering` | 2026-08-12 | 11 days |
| `WS-29-ns8zxo-project-tile-folder-modified-date` | 2026-08-15 | 8 days |
| `WS-34-d3gjrv-artefact-id-suffix-upgrade` | 2026-08-16 | 7 days |

The only staleness constant Praxis publishes is `LEASE_STALE_MINUTES = 60`
(`prx-index.mjs:284`, republished at `prx-orchestrate/SKILL.md:498`). No separate
constant exists for a whole-tree operation, and the generator already reports all three
as stale. All three exceed the threshold by more than four orders of magnitude.

**Decision: proceed past the three leases, and do not delete them.** The reasoning:

- The `SKILL.md` stale-lease procedure — delete the lease and retry the exclusive create
  — governs *acquiring* a lease on a workstream you intend to work inside. This migration
  acquires nothing there. It renames files across the tree and edits no artefact's
  contents, so it is not entering those workstreams as a worker.
- Deleting another session's lease is an unrequested destructive write on state this
  workstream does not own. `SKILL.md:551` prefers noting a foreign lease in the run
  report over removing it.
- A session that later resumes any of the three finds every artefact byte-identical, only
  renamed, and finds a tree the generator indexes completely at any interim point.
- The tar archive covers the whole tree regardless of which folder a fault lands in.

**The guard that turns A4 into a check:** immediately before `--apply`, assert that no
file under the three foreign-leased folders has an mtime inside the last 60 minutes:

```bash
find flowcharge/workstreams/WS-26-htqat4-plan-markdown-table-rendering \
     flowcharge/workstreams/WS-29-ns8zxo-project-tile-folder-modified-date \
     flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade \
     -type f -mmin -60
```

Any output contradicts the dead-session reading and is a halt condition. Zero output is
the pass.

### The point of no return

Phases 0 through 3 write nothing to `flowcharge/`. Phase 4's `--apply` is the single
irreversible step, and it is irreversible only in the sense that git cannot undo it; the
Phase 2 archive can.

### What verification must not depend on

No verification step reads its expected counts from this plan. Every count is derived
from the tree at execution time. This plan states today's values as a sanity reference
only, and a divergence is a signal to re-derive and understand, not an automatic failure.
The census in particular moves: authoring this plan and any task list from it adds
artefacts, and both are authored at compliant names by up-to-date skills, so they raise
the `ok` count rather than the move count.

## Staged task breakdown

Seven phases, one person, sequential. Each leaves the tree either fully pre-migration,
fully post-migration, or is a read-only observation.

### Phase 0 — Pre-flight and baselines (small)

**Build:** Establish that the tree is safe to touch, and capture every before-value the
later phases compare against.

**Steps:**
- `git status --short` — record it. Expect `M .gitignore` and nothing else. That change
  is pre-existing (the Praxis-managed ignore block plus `release/`), it is not this
  migration's, and it is neither committed nor reverted here. Record it so a later diff
  does not attribute it to the rename.
- `find flowcharge -name .lease` — expect exactly four. Exactly one must sit at this
  workstream's folder with a `session` line matching the running session. Any *new*
  foreign lease, or a missing own-lease, halts the run.
- Run the 60-minute mtime freshness guard over the three foreign-leased folders (command
  in Design). Any output halts the run.
- `lsof +D flowcharge` — confirm no process holds a file in the tree open. A running
  `npm start` only reads on request and does not hold handles, but stop it anyway for the
  duration, so nothing reads a half-renamed folder.
- Save the normalised non-legacy `--check` baseline (command in Design) to a scratch
  directory **outside** the repository.
- Save the `--list all` ID set (command in Design) to the same scratch directory, and
  record its cardinality.
- Derive the census:
  `find flowcharge/workstreams flowcharge/archive -maxdepth 2 -name '*.md' ! -name workstream.md | wc -l`
  and record it as `<C>`.

**Files touched:** none in the repository. Baselines go to a scratch directory outside
the repository working tree.

**Depends on:** nothing.

**Verify:** Both baseline files exist and are non-empty; exactly one lease is owned by
this session; the freshness guard and `lsof` both return nothing.

**Today's reference values:** `git status --short` = `M .gitignore`; four leases;
`--check` 237 lines (123 legacy, 114 other, exit 2); normalised non-legacy set 114 lines
with zero duplicates; `--list all` 189 IDs; census 129.

### Phase 1 — Verify skill-install freshness (small)

**Build:** Confirm no installed skill would author a bare-named artefact into the renamed
tree.

**Steps:**
- For each of the eight directories in `/Users/akoukoullis/Work/AK/Praxis/skills/`, run
  `diff -rq -x .DS_Store` against `~/.claude/skills/<name>` and against
  `~/.config/opencode/skills/<name>`.

**Files touched:** none. **This is a verification step, not a copy step.** The previous
migration already re-synced both installs globally, and a fresh check today reports zero
differences across all sixteen comparisons.

**Depends on:** Phase 0.

**Verify:** All sixteen comparisons report no differences.

**Halt condition:** any difference. Do **not** silently copy — a difference means the
installs have drifted since the previous migration, which is new information the user
should see before it is overwritten. Report it and stop.

### Phase 2 — Archive the pre-migration tree (small)

**Build:** The only rollback path.

**Steps:**
- `tar czf <scratch>/flowcharge-pre-rename-2026-08-23.tar.gz flowcharge` from the project root.
- Verify the archive: `tar tzf` entry count against the live tree's entry count, and
  confirm at least one bare-named file and one `workstream.md` appear in the listing.
- Record the archive's absolute path in the run notes.

**Files touched:** one new archive file, outside the repository working tree. The tree is
25 MB, so the archive is cheap but not instant.

**Depends on:** Phase 1. Placed after Phase 1 deliberately: Phase 1 touches nothing, and
taking the archive as late as possible keeps it closest to the state `--apply` acts on.

**Verify:** `tar tzf` lists the expected entry count and both sample files.

### Phase 3 — Dry-run and reconcile (small)

**Build:** Prove the script's intent matches the tree, immediately before acting.

**Steps:**
- `node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-rename-artefacts.mjs --root .`
- Save stdout and stderr separately.

**Files touched:** none.

**Depends on:** Phase 2.

**Verify, all five:**
- Exit code 0.
- stderr is empty — zero refusal lines.
- Record `<M>` = the `->` line count and `<K>` = the `ok` line count.
- **Reconcile against the census:** `<M> + <K>` must equal `<C> - 2`. The two are
  `cross-repo-references.md` and `prose-mentions-left-alone.md`, which do not begin with
  `prx` and are outside the scan filter by design. Confirm those two are exactly the
  files in the gap, by name, rather than accepting the arithmetic on its own.
- No line names `workstream.md`, and no two lines share a target path.

**Halt condition:** any refusal, any non-zero exit, or a gap that is not exactly those
two files. An unexplained gap means the tree changed since Phase 0 — re-derive, find the
cause, and only then continue.

**Today's reference:** exit 0, 123 move lines (51 PLN, 10 IL, 62 TL), 2 `ok` lines, empty
stderr, census 127. With this plan file present the `ok` count becomes 3 and the census
128; a task list authored from this plan raises both again by one.

### Phase 4 — Apply (medium — the irreversible phase)

**Build:** The migration itself.

**Steps:**
- Re-run the Phase 0 lease-freshness guard. The elapsed time since Phase 0 is real.
- `node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-rename-artefacts.mjs --root . --apply`
- Save the output.
- Immediately re-run the same command **without** `--apply`.

**Files touched:** every renameable artefact under `flowcharge/workstreams/`. Each moves by
`fs.renameSync`, so nothing is staged in git, `git status` is unchanged, and no file
content changes. `flowcharge/archive/` is empty, so nothing moves there.

**Depends on:** Phases 1, 2 and 3, in that order. Phase 2 must precede this one or there
is no way back.

**Verify:**
- The `--apply` run exits 0 and prints exactly `<M>` move lines and `<K>` `ok` lines,
  matching Phase 3's output line for line. Diff the two saved files; only an empty diff
  passes. This is the **only** way to distinguish an applied run from a dry run, because
  the script prints identical text for both.
- The immediate re-run exits 0, prints `<M> + <K>` `ok` lines and zero `->` lines. This
  is criterion 2, and it proves idempotence on the live tree, not on a fixture.
- `find flowcharge/workstreams -maxdepth 2 \( -name 'plan.md' -o -name 'issuelist.md'
  -o -name 'tasklist.md' \)` returns nothing — criterion 6.
- `find flowcharge/workstreams -maxdepth 2 -name 'workstream.md' | wc -l` equals the
  workstream folder count — criterion 7.

**Halt condition:** a non-zero exit, or any refusal on stderr. **Do not re-run with
`--apply` to "fix" a refusal — read the refusal first.** A refusal means a target name
was already taken, which is a collision the dry-run did not predict and which needs
understanding before any further write.

### Phase 5 — Regenerate and verify the invariants (small)

**Build:** Bring the generated views back in line and check every before/after invariant.

**Steps:**
- `node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root .`
  — rewrites `flowcharge/index.md` and `flowcharge/kanban.md`.
- `--check`, normalised through the Design command, saved.
- `--list all` ID set, saved.
- `npm run build`.
- `node --test dist/lib/extract.test.js`.

**Files touched:** `flowcharge/index.md`, `flowcharge/kanban.md`, `dist/` (generated and
gitignored), and possibly `.gitignore` — every writing generator invocation appends any
missing ignore lines. Expect no `.gitignore` change, because the required lines are
already present in the working tree; if one appears, that is documented generator
behaviour, not a fault of this migration.

**Depends on:** Phase 4.

**Verify, all five:**
- `grep -c 'legacy filename'` on the new raw `--check` output returns 0 — criterion 3.
- The normalised non-legacy `--check` set is identical to Phase 0's baseline —
  criterion 4. Diff the two saved files; an empty diff is the pass.
- The `--list all` ID set is identical to Phase 0's baseline — criterion 5. Diff the two
  saved files; an empty diff is the pass.
- `npm run build` exits 0 — criterion 8, first half.
- `node --test dist/lib/extract.test.js` reports 7 passes, 0 failures — criterion 8,
  second half.
- Optionally, start the board and open this repository's own project tile, confirming
  every workstream card still renders its plan, issue list and task list rows.

**Expected exit codes:** the regenerate exits 0; `--check` still exits 2 because 114
warnings remain. That is the designed end state.

**Halt condition:** a non-empty diff on either set. An ID-set difference in particular
means a file was lost or duplicated, and is the one condition that justifies the rollback
in Data & compatibility.

**Do not run the whole test glob as a gate.** `node --test 'dist/lib/*.test.js'` fails
today inside `skill-content-fetch.test.js`, which makes a live network call and times
out. That failure is pre-existing and unrelated to this migration, and treating it as a
gate would produce a false red.

### Phase 6 — Close out (small)

**Build:** Leave the workstream in a correct, unlocked state.

**Steps:**
- Set this plan's `status` to `done` and bump `updated`. The plan is already at its
  compliant name, so Phase 4 did not move it; edit it in place.
- Set the workstream record's `status` and bump `updated`. `workstream.md` keeps its
  plain name and was never moved.
- Delete `.lease` from **this workstream's folder only**, and only if its `session`
  line still matches the running session. Leave the three foreign leases untouched, and
  name them in the run report.
- Regenerate the index and board one final time.

**Files touched:** this plan file, `workstream.md`, this workstream's `.lease`
(deleted), and the two generated views.

**Depends on:** Phase 5 passing every invariant.

**Verify:** `find flowcharge -name .lease` returns exactly the three foreign leases; the
workstream's card sits in the expected board column; the final `--check` shows zero
`legacy filename` lines and the same 114-member normalised warning set.

**Note:** there is **no commit phase**. Nothing tracked by git changed. The only
modified tracked file is `.gitignore`, whose change pre-dates this work and belongs to
whoever made it.

## Data & compatibility

**Migration.** This is the migration. It is one-way in the sense that git cannot reverse
it, and repeatable in the sense that running the script again is a safe no-op.

**Backward compatibility.** The generator accepts both filename forms, and both Dashboard
readers key on frontmatter rather than filename, so nothing reading the tree breaks at
any point during the run. There is no half-broken window: a tree with some files renamed
and some not is a tree the generator indexes completely and the board renders completely,
warning only on the files still bare. This is what makes A2 hold and what makes the
migration safe to interrupt.

**Consumers that must not break.** Three scanners key on the plain filename
`workstream.md` as the workstream-folder marker — the generator's folder-marker test,
`src/lib/extract.ts:124`, and `src/lib/detail.ts:195`. The script skips that filename by
name before reading it (`prx-rename-artefacts.mjs:67`), and the planning dry-run
confirmed no `workstream.md` appears in its output. Criterion 7 asserts it directly
after the fact. No scanner change is needed and none is planned.

**Known breakage, accepted.** In-body prose references to the old filenames go stale,
both inside `flowcharge/` artefact bodies and at the three cosmetic sites in `src/`. They
are prose and historical record, not machine-read paths. Listed under Out of scope.

**Rollback story.**

- *Before Phase 4:* nothing to roll back. Phases 0 through 3 write nothing to `flowcharge/`,
  and Phase 1 writes nothing at all.
- *After Phase 4, and after Phase 5 or 6:* restore the Phase 2 archive. The procedure
  replaces the live `flowcharge/` with the archived one, which **destroys** anything written
  to the tree after the archive was taken — the regenerated index and board, and any
  status edits from Phase 6. It also deletes the live tree. Treat it as a destructive
  operation that needs the user's explicit go-ahead at the moment it is needed, not a
  step this plan pre-authorises.
- *Preferred alternative to rollback:* because the script is idempotent and never edits
  contents, most failure modes are better answered by reading the refusal, fixing the one
  file, and re-running, than by restoring the whole tree. Restore only for a failed
  ID-set invariant, which is the one signal that a file is genuinely lost.

## Testing strategy

No new tests are written. This workstream adds no code, so a later test-writing pass has
nothing to do here.

- **Unit — existing, used as a regression gate.** `dist/lib/extract.test.js` covers
  `extract.ts`, one of the two `flowcharge/` readers, and passes 7/7 today. It writes its own
  fixtures into a temp directory and never reads this repository's real `flowcharge/`, so it
  can neither detect nor be broken by the rename. Its role is to prove the reader still
  compiles and behaves after the build.
- **Compile — `npm run build`.** The nearest thing this repository has to a full gate.
  There is no `test` script in `package.json`. The build compiles three TypeScript
  projects and bundles the browser assets, so it catches any accidental source edit.
- **Not a gate — the full test glob.** `node --test 'dist/lib/*.test.js'` has a
  pre-existing failure in `skill-content-fetch.test.js`, which attempts a live network
  connection and times out. Running it is fine for information; asserting on it is not.
- **No coverage exists for `detail.ts`.** It is the other `flowcharge/` reader, and the one
  that carries the filename through to the payload. Its rename-safety was established by
  reading the code, not by a test. The manual board check in Phase 5 is the substitute.
- **Integration — the migration run itself.** Phases 3, 4 and 5 are the integration test,
  and their assertions are the acceptance criteria: dry-run reconciles with the census,
  apply matches dry-run line for line, re-run is a pure no-op, zero legacy warnings,
  normalised warning set unchanged, ID set unchanged.
- **Deliberately not tested.** The stale in-body references are not asserted on in either
  direction. Adding a check would contradict the accepted side effect.

## Open questions

1. **The three foreign stale leases.** This plan proceeds past them without deleting
   them, guarded by a 60-minute mtime freshness check (see Design). Options: (a) proceed
   and leave them, as planned; (b) delete all three first, since the published threshold
   makes them stale and the holding session is 7 to 11 days gone; (c) halt until the user
   clears them by hand. **Recommendation: (a).** It is the only option that neither
   blocks the migration nor writes to state this workstream does not own, and the
   freshness check makes the dead-session reading falsifiable rather than assumed. Choose
   (b) only if the user wants the three workstreams unlocked for their own sake, which is
   a separate decision from this migration.
2. **Whether `npm run build` is a strong enough code-health gate.** There is no `test`
   script, and `detail.ts` — the reader that carries the filename furthest — has no unit
   coverage at all. Options: (a) accept `npm run build` plus `extract.test.js` plus a
   manual board check, as planned; (b) write a `detail.ts` unit test first, which widens
   this workstream into test authoring. **Recommendation: (a).** The migration changes no
   code, so a build-and-render check is proportionate. A `detail.ts` test is worth having
   on its own merits, in its own workstream.
3. **What happens to the tar archive after success.** Options: keep it indefinitely, keep
   it for a fixed period, or delete it once Phase 5 passes. **Recommendation: keep it**
   until the user says otherwise. At 25 MB compressed it is cheap, and it is the only
   artefact standing between a late-discovered fault and an unrecoverable tree.
4. **The final status for the workstream and the plan.** Phase 6 sets both, but the exact
   values are the user's call — in particular whether the workstream goes straight to
   `done` or waits for the user to confirm the result. **Recommendation: `done` for
   both**, since every acceptance criterion is machine-checkable and checked in Phase 5.
5. **Whether to archive WS-66 afterwards.** Archiving is explicit and user-driven.
   **Recommendation: do not archive**, and leave it to a separate say-so.
6. **The pre-existing uncommitted `.gitignore` change.** Five lines sit unstaged in the
   working tree. This plan neither commits nor reverts them. Options: (a) leave as is;
   (b) commit them separately, before or after this migration. **Recommendation: (a)
   here, and decide (b) separately** — they are not this workstream's change, and folding
   them in would put an unrelated commit inside a migration that produces none.
7. **The frontmatter `author` key.** Praxis conventions carry `author` on artefact kinds,
   but the authoring instruction listed an exact key set that omits it. The instruction
   was followed. The key is optional, raises no `--check` warning, and nothing is
   affected. **Recommendation: add it if the user wants attribution consistency**;
   otherwise leave as is.

## Alternatives considered and rejected

- **Batch the rename, a few workstream folders at a time, verifying between batches.**
  Rejected on two grounds. The script has no folder filter — its only flags are `--root`
  and `--apply` (`prx-rename-artefacts.mjs:35`) — so batching would need either a new
  flag, which widens scope into script development, or pointing `--root` at a fake tree,
  which changes what is being tested. And the safety batching would buy is already bought
  more cheaply: the script is idempotent and per-file, so a whole-tree run that fails
  partway *is* a partial batch, recoverable by fixing the one file and re-running.

- **Rename with a shell one-liner or an ad-hoc script.** Rejected. It would duplicate
  logic that already exists, and would lose the two safeties that matter most: reading
  each file's own frontmatter `id` rather than guessing the prefix, and refusing rather
  than overwriting an existing target. A one-liner that gets the prefix from anywhere but
  the file's own `id` can silently mis-prefix a file, and nothing downstream would catch
  it.

- **Commit `flowcharge/` to git first, so the rename is reversible with `git checkout`.**
  Rejected. Whether a project tracks `flowcharge/` is a deliberate per-project choice, and
  this machine has chosen to ignore it globally (`~/.gitignore_global:48`). Changing that
  choice to gain a rollback path is a far larger decision than this migration, and it
  would put 187 artefacts and 25 MB into the repository's history as a side effect of a
  filename change. The tar archive gives the same rollback at a fraction of the
  consequence.

- **Copy the reference migration's acceptance criteria verbatim, including its
  byte-identical non-legacy warning-set check.** Rejected on evidence. 56 of this repo's
  114 non-legacy warnings embed the artefact path in their text, so that check would fail
  with 56 differences that describe nothing and would bury any real difference among
  them. The normalised comparison in Design was validated against today's tree and
  produces zero duplicate lines, so it stays lossless.

- **Re-copy the eight skill directories into both installs, as the reference migration's
  Phase 1 did.** Rejected on evidence. A fresh `diff -rq -x .DS_Store` over all eight
  directories against both install locations reports zero differences across all sixteen
  comparisons. The reference migration's copy step existed because three sibling skills
  were stale at that time; that has since been fixed globally. Copying now would be a
  no-op that could still introduce an orphan file. Phase 1 verifies instead, and halts on
  any difference rather than overwriting it unseen.

- **Update the three cosmetic `src/` references to the old filenames in the same run.**
  Rejected. They are prose in comments and user-facing strings, not paths the code
  resolves. Changing them would put a source-code edit — and therefore a git commit —
  inside a migration whose defining property is that it changes no tracked file. The
  reference migration made the same call.

- **Delete the three foreign stale leases before applying.** Rejected as the default, and
  recorded as Open question 1 rather than settled silently. The published stale-lease
  procedure governs acquiring a lease you need, and this migration needs none of the
  three. Deleting them is an unrequested destructive write on another session's state,
  and it buys no safety the freshness check and the tar archive do not already provide.

## Final summary

Run the existing rename script once over the whole tree, guarded by a tar archive and by
two before/after invariants — the artefact ID set, and a path-normalised non-legacy
warning set.

Seven phases, all small except the `--apply` phase, which is medium. The whole migration
is one sitting.

Top risks:

1. **The `--apply` step cannot be undone by git**, because `flowcharge/` is globally ignored
   and nothing under it is tracked. The Phase 2 tar archive is the only way back, and
   restoring it is itself destructive.
2. **Dry-run and applied output are textually identical.** The only proof that `--apply`
   really applied is the immediate re-run showing all `ok` lines. Phase 4 makes that
   mandatory, not optional.
3. **A naive warning-set comparison raises 56 false alarms** and would mask a real
   difference. The normalisation in Design is required, not cosmetic.

Needs the user's answer: how to handle the three foreign stale leases (Q1), whether
`npm run build` is a sufficient gate (Q2), what happens to the archive afterwards (Q3),
the final statuses (Q4), whether to archive the workstream (Q5), the pre-existing
`.gitignore` change (Q6), and whether to add the `author` key (Q7).

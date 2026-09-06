---
id: TL-67-5ay1xi
type: tasklist
workstream: WS-66-jqcbvp
slug: migrate-artefact-filenames-this-repo
title: "Rename this repo's flowcharge artefacts to the ID-prefixed form"
status: done
created: 2026-08-23
updated: 2026-08-23
author: Anthony Koukoullis
depends_on: [PLN-56-l8brv7]
links: []
mode: spec
base_commit: b9fe85b
---

# PRX Tasks

## Rename this repo's flowcharge artefacts to the ID-prefixed form

Run the existing `prx-rename-artefacts.mjs` once over this repository's whole `flowcharge/`
tree, so every plan, issue list and task list gains its own frontmatter `id` as a filename
prefix. No new code is written, no script flag is added, and no artefact file contents are
edited. This repository needs zero application code changes, because both `flowcharge/`
readers key on frontmatter `type` and `id`, never on filename.

`flowcharge/` is ignored by the machine's global gitignore, so `git ls-files flowcharge` returns
0 and git offers no rollback. A filesystem tar archive is the only way back. The plan's
real content is the guard rail around one irreversible command: a tar archive, and two
before/after invariants — the artefact ID set, and a **path-normalised** non-legacy
warning set.

Seven sequential phases, tasks 1 to 7 below, in the plan's order. Phases 0 to 3 write
nothing to `flowcharge/`. Task 5.2 (`--apply`) is the point of no return.

**Conventions used by every task below.**

- Run every command from the repository root, `/Users/akoukoullis/Work/AK/Praxis-Dashboard`.
- Both scripts run from the install path. This repository has no `skills/` directory:
  - `/Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-rename-artefacts.mjs`
  - `/Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs`
- `$SCRATCH` is one directory created outside the repository working tree at the start of
  task 1.1, for example `~/prx-scratch/WS-66-jqcbvp`. Record its absolute path in the run
  notes and reuse the same value in every later task. Nothing in `$SCRATCH` is ever placed
  inside the repository.
- `<C>` is the census count from task 1.5, `<M>` the move-line count and `<K>` the `ok`
  line count from task 4.1. Derive all three at execution time. Never read a count from
  the plan or from this file — both state today's values as a sanity reference only, and a
  divergence is a signal to re-derive and understand, not an automatic failure.
- `--check` exits 2 while any warning remains, and warnings remain by design. **A non-zero
  exit from `--check` is the expected end state and is not a failure.**

- [x] 1. Phase 0 — Pre-flight and baselines

  ```yaml
  description: "Establish that the tree is safe to touch, and capture every before-value the later phases compare against. Writes nothing inside the repository; all baselines go to $SCRATCH."
  self_eval:
    passed: true
    failures: []
    notes:
      - "All five subtasks pass. Every Phase 0 checklist item is YES."
      - "The board process was the last open item. The user stopped PID 81268 and PID 81476, and the executing session re-verified that nothing runs and nothing listens on TCP port 4173."
      - "$SCRATCH = /Users/akoukoullis/prx-scratch/WS-66-jqcbvp. Every later task must reuse this path."
      - "Baselines captured on 2026-08-23: 114 normalised non-legacy warning lines, 237 raw --check lines, 189 unique artefact IDs, and census <C> = 129."
      - "Phase 0 wrote nothing inside the repository other than this task list file."
  ```

  - [x] 1.1 Create $SCRATCH and record the git and lease inventory
    ```yaml
    description: "Create the scratch directory outside the repository, record git status, and confirm the lease inventory is exactly the four expected leases."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Create one scratch directory outside the repository working tree and record its absolute path in the run notes. Reuse this same path as $SCRATCH in every later task."
      - "Run: git status --short. Save the output to $SCRATCH/git-status-before.txt and record it in the run notes."
      - "Expect ' M .gitignore' and nothing else. That change is pre-existing — the Praxis-managed ignore block plus release/ — it is not this migration's change, and it is neither committed nor reverted anywhere in this task list. Record it so a later diff does not attribute it to the rename."
      - "Run: find flowcharge -name .lease. Expect exactly four."
      - "Confirm exactly one lease sits at flowcharge/workstreams/WS-66-jqcbvp-migrate-artefact-filenames-this-repo/.lease and that its session line matches the running session."
      - "Confirm the other three are the known foreign leases at WS-26-htqat4-plan-markdown-table-rendering, WS-29-ns8zxo-project-tile-folder-modified-date and WS-34-d3gjrv-artefact-id-suffix-upgrade. Do not delete, edit, or acquire any of them at any point in this task list."
      - "Halt the run on any new foreign lease, on a missing own-lease, or on an own-lease whose session line does not match."
    pattern: "Read-only over flowcharge/ and the git working tree. Writes only to $SCRATCH."
    imports: "git; find; a shell."
    compatibility: "flowcharge/ is untracked here — the machine's global gitignore covers it — so git status never reports anything under flowcharge/. The only modified tracked file is .gitignore, and it belongs to whoever made that change."
    gotcha: "A tracked-file change beyond .gitignore means the working tree is not in the state the plan surveyed. Stop and understand it before continuing, rather than folding an unrelated change into this migration."
    verify:
      - "git status --short — output is ' M .gitignore' and nothing else."
      - "find flowcharge -name .lease | wc -l — returns 4."
      - "grep session flowcharge/workstreams/WS-66-jqcbvp-migrate-artefact-filenames-this-repo/.lease — matches the running session id."
    checklist:
      - "$SCRATCH exists, sits outside the repository working tree, and its absolute path is recorded."
      - "git status --short shows only the pre-existing .gitignore modification."
      - "Exactly four .lease files exist, and exactly one is this workstream's."
      - "This workstream's lease session line matches the running session."
      - "The three foreign leases are recorded by folder name and left untouched."
    self_eval:
      passed: true
      failures: []
      notes:
        - "$SCRATCH = /Users/akoukoullis/prx-scratch/WS-66-jqcbvp, outside the repository working tree."
        - "git status --short output is ' M .gitignore' and nothing else. Saved to $SCRATCH/git-status-before.txt."
        - "find flowcharge -name .lease returns 4."
        - "Own lease: flowcharge/workstreams/WS-66-jqcbvp-migrate-artefact-filenames-this-repo/.lease, session c17da25e-59e8-42e4-b0e6-e68ea344a35d, acquired 2026-08-23T12:32:40.645Z. It matches the running session."
        - "The three foreign leases are WS-26-htqat4-plan-markdown-table-rendering (2026-08-12), WS-29-ns8zxo-project-tile-folder-modified-date (2026-08-15) and WS-34-d3gjrv-artefact-id-suffix-upgrade (2026-08-16), all held by session f544f590-4d98-4d82-8674-971af12cf0b5. None was deleted, edited or acquired."
    ```

  - [x] 1.2 Run the lease-freshness guard and the open-handle check
    ```yaml
    description: "Turn assumption A4 — the three foreign leases are dead, not parked mid-write — into a check, and confirm no process holds a file in the tree open."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Assert that no file under the three foreign-leased folders has an mtime inside the last 60 minutes. LEASE_STALE_MINUTES = 60 is the only staleness constant Praxis publishes (prx-index.mjs, republished in prx-orchestrate/SKILL.md), and all three leases are 7 to 11 days old."
      - |-
        Run exactly:
        find flowcharge/workstreams/WS-26-htqat4-plan-markdown-table-rendering \
             flowcharge/workstreams/WS-29-ns8zxo-project-tile-folder-modified-date \
             flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade \
             -type f -mmin -60
      - "Any output contradicts the dead-session reading and is a halt condition. Zero output is the pass."
      - "Run: lsof +D flowcharge — confirm no process holds a file in the tree open."
      - "Stop any running board process for the duration of the migration, so nothing reads a half-renamed folder. A running npm start only reads on request and holds no handles, but stop it anyway."
      - "Do not delete or edit any of the three foreign leases. Proceeding past them is the plan's settled decision, and this guard is what makes the dead-session reading falsifiable rather than assumed."
    pattern: "Read-only over the three foreign-leased workstream folders and over flowcharge/ as a whole."
    imports: "find; lsof."
    compatibility: "The 60-minute window is the published Praxis staleness threshold. Do not substitute a different window."
    gotcha: "lsof +D walks the whole 25 MB tree and is slow. It can also exit non-zero simply because it found nothing, so read its output rather than only its exit code."
    verify:
      - "The three-folder find with -mmin -60 prints nothing."
      - "lsof +D flowcharge prints no open handle on any file under flowcharge/."
    checklist:
      - "The freshness guard was run over all three foreign-leased folders in one command."
      - "The guard produced zero output lines."
      - "lsof +D flowcharge reports no process holding a file open."
      - "Any board or dev process reading flowcharge/ was stopped for the duration."
      - "No .lease file was deleted or edited."
    self_eval:
      passed: true
      failures: []
      notes:
        - "The freshness guard ran over all three foreign-leased folders in one find command and printed zero lines. Output saved to $SCRATCH/freshness-guard.txt."
        - "lsof +D flowcharge printed no open handle. It exited 1 because it found nothing, which the task names as the pass. Output saved to $SCRATCH/lsof-flowcharge.txt."
        - "The board process was stopped by the user. PID 81268 (npm start) and PID 81476 (node dist/server.js) are both gone, and nothing listens on TCP port 4173. The executing session re-verified this with ps -p, lsof -iTCP:4173 and a broad ps scan, and then re-ran lsof +D flowcharge, which again printed nothing."
        - "No .lease file was deleted or edited. The lease count is still 4."
    ```

  - [x] 1.3 Capture the normalised non-legacy --check baseline
    ```yaml
    description: "Save the path-normalised non-legacy warning set to $SCRATCH. This is the before half of acceptance criterion 4."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Capture the baseline from the tree now, immediately before the migration. Never take it from the plan document."
      - |-
        Run exactly, saving to $SCRATCH:
        node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs \
          --root . --check 2>&1 \
          | grep -v 'legacy filename' \
          | sed -E 's#/(PLN|IL|TL)-[0-9]+-[0-9a-z]{6}-prx#/prx#g' \
          | sed -E 's/for [0-9]+ minutes/for N minutes/g' \
          | sed -E 's/[0-9]+ days?/N days/g' \
          | sort > $SCRATCH/check-nonlegacy-before.txt
      - "Also save the raw unfiltered --check output to $SCRATCH/check-raw-before.txt, for reading if a later diff is non-empty."
      - "Confirm the normalisation is lossless on today's tree: the file has zero duplicate lines, and zero ID prefixes remain inside any path."
      - "Record the line count. Today it is 114 — 79 'updated ... but file modified ...', 25 over-long first body lines, 7 stale claimed IDs, and 3 stale leases."
      - "The normalisation is required, not cosmetic. 56 of the non-legacy warnings embed the artefact's own path in their text, so a naive byte-for-byte comparison would fail on 56 lines that describe no defect and would bury any real difference among them."
    pattern: "Read-only over flowcharge/. Writes two files to $SCRATCH."
    imports: "node; the installed prx-index.mjs; grep; sed -E; sort."
    compatibility: "Use GNU-style extended regex through sed -E, which BSD sed on macOS also accepts. The first sed strips an ID prefix only where it directly precedes prx inside a path, so the leading 'WARN PLN-3-xh05c7 (...)' artefact id stays intact. Do not simplify it into a global ID strip."
    gotcha: "--check exits 2 whenever any warning remains, which is the normal state here. Capture 2>&1 and do not treat the exit code as a failure. A pipeline into sort also masks the exit code, so read the output, not the status."
    verify:
      - "test -s $SCRATCH/check-nonlegacy-before.txt — the file exists and is non-empty."
      - "sort $SCRATCH/check-nonlegacy-before.txt | uniq -d | wc -l — returns 0, proving the normalisation collapses no two distinct warnings into one."
      - "grep -cE '/(PLN|IL|TL)-[0-9]+-[0-9a-z]{6}-prx' $SCRATCH/check-nonlegacy-before.txt — returns 0."
      - "grep -c 'legacy filename' $SCRATCH/check-nonlegacy-before.txt — returns 0."
    checklist:
      - "The baseline was captured from the live tree, not copied from the plan."
      - "$SCRATCH/check-nonlegacy-before.txt is non-empty and its line count is recorded."
      - "The file contains zero duplicate lines."
      - "The file contains zero ID prefixes inside any path, and zero legacy-filename lines."
      - "The raw --check output was saved alongside it."
    self_eval:
      passed: true
      failures: []
      notes:
        - "Captured from the live tree on 2026-08-23. $SCRATCH/check-nonlegacy-before.txt holds 114 lines, which matches the task's stated reference."
        - "sort | uniq -d returns 0 duplicate lines."
        - "grep -cE '/(PLN|IL|TL)-[0-9]+-[0-9a-z]{6}-prx' returns 0, and grep -c 'legacy filename' returns 0."
        - "The raw unfiltered output is saved to $SCRATCH/check-raw-before.txt and holds 237 lines."
    ```

  - [x] 1.4 Capture the --list all ID-set baseline
    ```yaml
    description: "Save the artefact ID set to $SCRATCH and record its cardinality. This is the before half of acceptance criterion 5, and the data-loss detector for the whole migration."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |-
        Run exactly, saving to $SCRATCH:
        node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs \
          --root . --list all \
          | grep -oE '^\| [A-Z]+-[0-9]+-[0-9a-z]{6}' | sed 's/^| //' | sort > $SCRATCH/ids-before.txt
      - "Record the cardinality. Today it is 189 IDs, all unique. The plan's 187 was captured before this plan file and this task list each registered an ID, so 189 is the current reference."
      - "Confirm every ID is unique, so the set and the list agree."
      - "This is the correct data-loss detector because the script never edits file contents. A lost file drops an ID and a doubled file adds one, so any difference between before and after means a file went missing, not that a value changed."
    pattern: "Read-only over flowcharge/. Writes one file to $SCRATCH."
    imports: "node; the installed prx-index.mjs; grep -oE; sed; sort."
    compatibility: "The grep anchors on the generated table's leading pipe. If prx-index.mjs changes its --list all table format, re-derive the extraction rather than editing the saved baseline."
    gotcha: "The census moves while this workstream is worked: this plan file and this task list are both authored at compliant names, so they raise the ok count rather than the move count. The ID set, by contrast, must be captured once and must not change at all."
    verify:
      - "test -s $SCRATCH/ids-before.txt — the file exists and is non-empty."
      - "wc -l < $SCRATCH/ids-before.txt — record this number as the baseline cardinality."
      - "sort $SCRATCH/ids-before.txt | uniq -d | wc -l — returns 0, confirming every ID is unique."
    checklist:
      - "$SCRATCH/ids-before.txt exists, is non-empty, and is sorted."
      - "Its cardinality is recorded in the run notes."
      - "Every ID in the file is unique."
      - "Every line is a bare ID with no leading pipe or trailing text."
    self_eval:
      passed: true
      failures: []
      notes:
        - "$SCRATCH/ids-before.txt is non-empty and sort -c confirms it is sorted."
        - "Baseline cardinality is 189 IDs, which matches the task's stated reference."
        - "sort | uniq -d returns 0, so every ID is unique."
        - "grep -cvE '^[A-Z]+-[0-9]+-[0-9a-z]{6}$' returns 0, so every line is a bare ID."
    ```

  - [x] 1.5 Derive the census <C>
    ```yaml
    description: "Count the artefact files the dry-run must account for, so Phase 3 can reconcile against a number derived from the tree rather than from the plan."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run: find flowcharge/workstreams flowcharge/archive -maxdepth 2 -name '*.md' ! -name workstream.md | wc -l"
      - "Record the result as <C> in the run notes. Task 4.2 reconciles <M> + <K> against <C> - 2."
      - "Also save the full file listing, without wc -l, to $SCRATCH/census-before.txt, so task 4.2 can name the two files in the gap rather than accepting the arithmetic on its own."
      - "flowcharge/archive/ is empty here, so nothing is expected from that half of the scan."
      - "Today's reference is 127 without this plan file. With this plan file present it is 128, and with this task list present it is 129. A moving census is expected and is not a fault."
    pattern: "Read-only over flowcharge/workstreams and flowcharge/archive. Writes one file to $SCRATCH."
    imports: "find; wc."
    compatibility: "-maxdepth 2 matches the script's own scan depth — one directory level below each scan root. Do not widen it."
    gotcha: "The census counts every .md file at that depth, including the two files the script's filter deliberately does not match: WS-34-d3gjrv-artefact-id-suffix-upgrade/cross-repo-references.md and .../prose-mentions-left-alone.md. They do not begin with prx, so they are outside the enumerated scan filter by design. That is exactly why the reconciliation subtracts 2."
    verify:
      - "The find | wc -l command returns a positive integer, recorded as <C>."
      - "test -s $SCRATCH/census-before.txt — the listing exists and is non-empty."
      - "wc -l < $SCRATCH/census-before.txt equals <C>."
    checklist:
      - "<C> is derived from the live tree and recorded in the run notes."
      - "The full census listing is saved to $SCRATCH."
      - "The listing excludes every workstream.md."
      - "The two non-prx files in WS-34-d3gjrv are present in the listing and identified by name."
    self_eval:
      passed: true
      failures: []
      notes:
        - "<C> = 129, derived from the live tree on 2026-08-23. It matches the task's stated reference for a tree that holds both this plan file and this task list."
        - "The full listing is saved to $SCRATCH/census-before.txt and holds 129 lines, equal to <C>."
        - "grep -c 'workstream.md' on the listing returns 0."
        - "The two non-prx files are present: flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/cross-repo-references.md and flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/prose-mentions-left-alone.md."
        - "flowcharge/archive/ contributed 0 lines, as expected."
    ```

- [x] 2. Phase 1 — Verify skill-install freshness

  ```yaml
  description: "Confirm no installed skill would author a bare-named artefact into the renamed tree. This is a verification step, not a copy step: it touches no file, and it halts on any difference rather than overwriting it unseen."
  self_eval:
    passed: true
    failures: []
    notes:
      - "Both subtasks pass. Every Phase 1 checklist item is YES."
      - "All sixteen comparisons are clean: eight against ~/.claude/skills and eight against ~/.config/opencode/skills. Every diff -rq -x .DS_Store exited 0 and printed nothing."
      - "Both collected outputs are 0 bytes: $SCRATCH/skill-diff-claude.txt and $SCRATCH/skill-diff-opencode.txt, with $SCRATCH = /Users/akoukoullis/prx-scratch/WS-66-jqcbvp."
      - "No file was copied, synced, or written in either install location. Phase 1 wrote only the two scratch files and this task list file."
  ```

  - [x] 2.1 Diff the eight source skills against the ~/.claude install
    ```yaml
    description: "Compare all eight directories in /Users/akoukoullis/Work/AK/Praxis/skills/ against ~/.claude/skills/<name> and confirm zero differences."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "The eight directories are prx-bug-hunt, prx-dev-principles, prx-git, prx-issue-list, prx-orchestrate, prx-plain-text-kanban, prx-plan-feature and prx-task-list."
      - "For each one, run: diff -rq -x .DS_Store /Users/akoukoullis/Work/AK/Praxis/skills/<name> /Users/akoukoullis/.claude/skills/<name>"
      - "Save the combined output to $SCRATCH/skill-diff-claude.txt. All eight comparisons must report no differences."
      - "Do NOT copy or re-sync anything. A difference means the installs have drifted since the previous migration, which is new information the user should see before it is overwritten. Report it and stop."
    pattern: "Read-only over /Users/akoukoullis/Work/AK/Praxis/skills/ and /Users/akoukoullis/.claude/skills/. Touches no file in this repository."
    imports: "diff."
    compatibility: "-x .DS_Store excludes the macOS metadata file, which is noise rather than drift. Keep the exclusion; do not add others."
    gotcha: "diff -rq exits non-zero when it finds a difference, so a loop over eight directories can stop early under set -e. Run it so every comparison is attempted and its output collected, and read the collected output rather than only the final exit status."
    verify:
      - "test ! -s $SCRATCH/skill-diff-claude.txt — the collected diff output is empty."
      - "Confirm all eight directory names appear in the run log, so no comparison was skipped."
    checklist:
      - "All eight source directories were compared against ~/.claude/skills."
      - "Every comparison reported no differences."
      - "No file was copied, synced, or written in either location."
      - "The collected output is saved to $SCRATCH."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Diff the eight source skills against the ~/.config/opencode install
    ```yaml
    description: "Compare the same eight directories against ~/.config/opencode/skills/<name> and confirm zero differences, completing all sixteen comparisons."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "For each of the same eight directories, run: diff -rq -x .DS_Store /Users/akoukoullis/Work/AK/Praxis/skills/<name> /Users/akoukoullis/.config/opencode/skills/<name>"
      - "Save the combined output to $SCRATCH/skill-diff-opencode.txt. All eight comparisons must report no differences."
      - "Together with task 2.1 this makes sixteen comparisons, all of which must be clean."
      - "Do NOT copy or re-sync anything. Halt and report on any difference."
    pattern: "Read-only over /Users/akoukoullis/Work/AK/Praxis/skills/ and /Users/akoukoullis/.config/opencode/skills/. Touches no file in this repository."
    imports: "diff."
    compatibility: "Same -x .DS_Store exclusion as task 2.1, so the two halves are directly comparable."
    gotcha: "A directory missing entirely from the opencode install reports as a diff error rather than a content difference. Treat it the same way — halt and report; do not create it."
    verify:
      - "test ! -s $SCRATCH/skill-diff-opencode.txt — the collected diff output is empty."
      - "Confirm all eight directory names appear in the run log, so all sixteen comparisons are accounted for across tasks 2.1 and 2.2."
    checklist:
      - "All eight source directories were compared against ~/.config/opencode/skills."
      - "Every comparison reported no differences."
      - "All sixteen comparisons across 2.1 and 2.2 are clean and recorded."
      - "No file was copied, synced, or written in either location."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 2 — Archive the pre-migration tree

  ```yaml
  description: "Take the tar archive of flowcharge/ outside the repository working tree. This is the only rollback path, because flowcharge/ is globally ignored and git cannot serve. Placed after Phase 1 deliberately, so the archive sits as close as possible to the state --apply acts on."
  self_eval:
    passed: true
    failures: []
    notes:
      - "Both subtasks pass. Every Phase 2 checklist item is YES."
      - "Archive path: /Users/akoukoullis/prx-scratch/WS-66-jqcbvp/flowcharge-pre-rename-2026-08-23.tar.gz, 22286858 bytes."
      - "Archive entry count is 440 and find flowcharge | wc -l is 440. The two counts agree exactly."
      - "The rollback path is confirmed. No write to flowcharge/ has happened yet, so Phase 3 may proceed."
  ```

  - [x] 3.1 Create the tar archive of flowcharge/
    ```yaml
    description: "Archive the whole pre-migration flowcharge/ tree to $SCRATCH and record its absolute path."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "From the repository root, run: tar czf $SCRATCH/flowcharge-pre-rename-2026-08-23.tar.gz flowcharge"
      - "Use the actual execution date in the filename if it is not 2026-08-23."
      - "Record the archive's absolute path in the run notes. Every later task and any rollback depends on it."
      - "Keep the archive after success. It is the only artefact standing between a late-discovered fault and an unrecoverable tree, and deleting it is a separate decision for the user."
    pattern: "Reads all of flowcharge/. Writes one new archive file inside $SCRATCH, outside the repository working tree."
    imports: "tar."
    compatibility: "Archive with the relative path flowcharge from the repository root, so the archive restores into a repository root rather than an absolute path."
    gotcha: "The tree is 25 MB, so the archive is cheap but not instant. Do not write the archive anywhere inside the repository — it would then be swept by later finds and would sit inside the very tree it protects."
    verify:
      - "test -s $SCRATCH/flowcharge-pre-rename-<date>.tar.gz — the archive exists and is non-empty."
      - "The archive's absolute path is recorded in the run notes."
    checklist:
      - "The archive was created from the repository root with the relative flowcharge path."
      - "The archive file exists, is non-empty, and sits outside the repository working tree."
      - "Its absolute path is recorded in the run notes."
      - "No file inside flowcharge/ was modified by this task."
    self_eval:
      passed: true
      failures: []
      notes:
        - "The archive was created from /Users/akoukoullis/Work/AK/Praxis-Dashboard with the relative path flowcharge, so its entries begin with flowcharge/ and restore into a repository root."
        - "Archive path: /Users/akoukoullis/prx-scratch/WS-66-jqcbvp/flowcharge-pre-rename-2026-08-23.tar.gz. Size is 22286858 bytes, from a 25 MB tree."
        - "$SCRATCH is /Users/akoukoullis/prx-scratch/WS-66-jqcbvp, outside the repository working tree."
        - "tar only reads the source tree. A find flowcharge -newermt check after the archive showed no file touched by this task."
        - "The archive is kept. Deletion is a separate decision for the user."
    ```

  - [x] 3.2 Verify the archive is restorable
    ```yaml
    description: "Prove the archive lists the expected entries before any irreversible step runs."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run: tar tzf $SCRATCH/flowcharge-pre-rename-<date>.tar.gz > $SCRATCH/archive-listing.txt"
      - "Compare the archive's entry count against the live tree's entry count. Count the live tree with: find flowcharge | wc -l"
      - "Confirm at least one bare-named artefact file appears in the listing, for example any path ending in /plan.md, /issuelist.md or /tasklist.md."
      - "Confirm at least one workstream.md appears in the listing."
      - "Halt if the counts disagree materially or either sample is absent. There is no point continuing to Phase 3 without a verified rollback path."
    pattern: "Read-only over the archive and over flowcharge/. Writes one listing file to $SCRATCH."
    imports: "tar; find; grep; wc."
    compatibility: "tar tzf lists directories as well as files, so its raw count matches find flowcharge | wc -l, which also counts directories. Compare like with like."
    gotcha: "A trailing-slash or leading-./ difference in tar's entry names can make a naive diff of the two listings look wrong while the counts agree. Compare counts and sample presence, as specified, rather than diffing the two listings byte for byte."
    verify:
      - "wc -l < $SCRATCH/archive-listing.txt — matches find flowcharge | wc -l."
      - "grep -cE '/(plan|issuelist|tasklist)\\.md$' $SCRATCH/archive-listing.txt — returns a positive number, confirming a pre-migration bare name is captured."
      - "grep -c '/workstream.md$' $SCRATCH/archive-listing.txt — returns a positive number."
    checklist:
      - "The archive listing was produced and saved to $SCRATCH."
      - "The archive entry count matches the live tree's entry count."
      - "At least one bare-named artefact file is present in the listing."
      - "At least one workstream.md is present in the listing."
      - "The rollback path is confirmed before any write to flowcharge/."
    self_eval:
      passed: true
      failures: []
      notes:
        - "The listing is saved to /Users/akoukoullis/prx-scratch/WS-66-jqcbvp/archive-listing.txt and holds 440 lines."
        - "find flowcharge | wc -l also returns 440, so the archive and the live tree agree exactly. Counts were compared, not the listings byte for byte."
        - "grep -cE '/(plan|issuelist|tasklist)\\.md$' returns 117. A sample is flowcharge/workstreams/WS-10-4lwv20-board-sort-by-date/tasklist.md."
        - "grep -c '/workstream.md$' returns 62. A sample is flowcharge/workstreams/WS-66-jqcbvp-migrate-artefact-filenames-this-repo/workstream.md."
        - "Entry names carry no leading ./ and use the relative flowcharge/ prefix, as intended."
        - "Nothing inside flowcharge/ has been written at this point. Phase 3 is safe to start."
    ```

- [x] 4. Phase 3 — Dry-run and reconcile

  ```yaml
  description: "Prove the script's intent matches the tree, immediately before acting. The script's default mode is dry-run and writes nothing; its only flags are --root and --apply."
  ```

  - [x] 4.1 Run the dry-run and record <M> and <K>
    ```yaml
    description: "Run prx-rename-artefacts.mjs without --apply, save stdout and stderr separately, and record the move-line and ok-line counts."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |-
        Run exactly, saving the two streams separately:
        node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-rename-artefacts.mjs --root . \
          > $SCRATCH/rename-dryrun.out 2> $SCRATCH/rename-dryrun.err
      - "The exit code must be 0 and $SCRATCH/rename-dryrun.err must be empty. A refusal line on stderr means an existing target name blocks a move, which forces exit 1."
      - "Record <M> as the count of lines containing the ' -> ' move marker, and <K> as the count of lines ending in ' ok'."
      - "Halt on any refusal or any non-zero exit. Do not proceed to Phase 4 on an unclean dry-run."
      - "Today's reference is exit 0, 123 move lines (51 PLN, 10 IL, 62 TL), empty stderr, and 4 ok lines — 2 from WS-65 plus this plan file and this task list. The plan's '52 PLN, 10 IL, 63 TL' does not sum to 123; the correct split is 51, 10, 62. Derive the real numbers from the run."
    pattern: "Reads flowcharge/workstreams/ and flowcharge/archive/, one directory level deep. Writes nothing in the repository; two output files go to $SCRATCH."
    imports: "node; the installed prx-rename-artefacts.mjs."
    compatibility: "The script has only two flags, --root <dir> and --apply. There is no --dry-run flag, no --force, and no folder filter. Default is dry-run. Do not invent a flag, and do not point --root at anything but this repository."
    gotcha: "Dry-run and applied output are textually identical, which is why the two streams are saved now: task 5.2 diffs its applied output against this file, and that diff is the only proof the apply matched the plan the dry-run showed."
    verify:
      - "The dry-run exits 0."
      - "test ! -s $SCRATCH/rename-dryrun.err — stderr is empty, so there are zero refusal lines."
      - "grep -c ' -> ' $SCRATCH/rename-dryrun.out — record as <M>."
      - "grep -c ' ok$' $SCRATCH/rename-dryrun.out — record as <K>."
    checklist:
      - "The dry-run was invoked without --apply and exited 0."
      - "stderr is empty and contains zero refusal lines."
      - "<M> and <K> are recorded in the run notes."
      - "Both output streams are saved to $SCRATCH for task 5.2 to diff against."
      - "Nothing under flowcharge/ was modified by this task."
    self_eval:
      passed: true
      failures: []
      notes:
        - "The dry-run ran on 2026-08-23 without --apply and exited 0."
        - "$SCRATCH/rename-dryrun.err is 0 bytes, so there are zero refusal lines."
        - "<M> = 123 move lines, split 51 PLN, 10 IL, 62 TL. This matches the corrected reference, not the plan's original 52/10/63."
        - "<K> = 4 ok lines: WS-65 PLN-55-a4xsr3 and TL-66-3dh0fp, plus this workstream's PLN-56-l8brv7 and TL-67-5ay1xi."
        - "The output holds 127 lines in total, equal to <M> + <K>."
        - "Both streams are saved as $SCRATCH/rename-dryrun.out and $SCRATCH/rename-dryrun.err for task 5.2 to diff against."
        - "Nothing under flowcharge/ was written. The newest artefact file predates the dry-run, and prx-index.mjs --list all still reports 189 IDs."
    ```

  - [x] 4.2 Reconcile the dry-run against the census
    ```yaml
    description: "Confirm <M> + <K> equals <C> - 2, and confirm by name that the two files in the gap are exactly the two the scan filter excludes by design."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Compute <M> + <K> from task 4.1 and compare it against <C> - 2, where <C> is the census from task 1.5."
      - "Do not accept the arithmetic on its own. Confirm the two files in the gap are exactly flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/cross-repo-references.md and flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/prose-mentions-left-alone.md, by comparing $SCRATCH/census-before.txt against the paths named in $SCRATCH/rename-dryrun.out."
      - "Those two do not begin with prx, so they fall outside the script's enumerated scan filter by design, not by oversight."
      - "Confirm no output line names workstream.md. The script skips that filename before any read, and three separate scanners key on it as the workstream-folder marker."
      - "Confirm no two output lines share a target path."
      - "Halt on any refusal, any non-zero exit, or a gap that is not exactly those two files. An unexplained gap means the tree changed since Phase 0 — re-derive, find the cause, and only then continue."
    pattern: "Read-only reconciliation over $SCRATCH/census-before.txt and $SCRATCH/rename-dryrun.out."
    imports: "grep; sort; uniq; comm or diff."
    compatibility: "<C> comes from task 1.5 and <M>/<K> from task 4.1. Both are derived at execution time. Never substitute the plan's reference numbers."
    gotcha: "The census and the ok count both move while this workstream is worked, because this plan file and this task list are authored at compliant names and count as ok rather than as moves. The reconciliation still holds, because both sides move together."
    verify:
      - "<M> + <K> equals <C> - 2, using the values recorded in tasks 1.5 and 4.1."
      - "The two files in the gap are identified by name and are exactly cross-repo-references.md and prose-mentions-left-alone.md, both under WS-34-d3gjrv-artefact-id-suffix-upgrade."
      - "grep -c workstream.md $SCRATCH/rename-dryrun.out — returns 0."
      - "Extract the target path from every move line, then: sort | uniq -d | wc -l — returns 0, so no two lines share a target."
    checklist:
      - "<M> + <K> equals <C> - 2."
      - "The two files in the gap were confirmed by name, not by arithmetic alone."
      - "No dry-run line names workstream.md."
      - "No two dry-run lines share a target path."
      - "The run notes record the reconciliation, so a later reader can see it was checked."
    self_eval:
      passed: true
      failures: []
      notes:
        - "<M> + <K> = 123 + 4 = 127. <C> - 2 = 129 - 2 = 127. The two sides agree."
        - "comm -23 over the sorted census and the sorted dry-run source paths names exactly two files: flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/cross-repo-references.md and flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade/prose-mentions-left-alone.md. Neither begins with prx, so both fall outside the enumerated scan filter by design."
        - "comm -13 the other way returns nothing, so the dry-run names no path the census missed."
        - "grep -c workstream.md on the dry-run output returns 0."
        - "The 123 target paths, sorted and passed through uniq -d, return 0 duplicates."
        - "The derived helper files $SCRATCH/dryrun-sources.txt and $SCRATCH/census-sorted.txt hold the two sorted sides of this comparison."
    ```

- [x] 5. Phase 4 — Apply

  ```yaml
  description: "The migration itself, and the single irreversible step. Every move is fs.renameSync, because git ls-files flowcharge returns 0 here, so nothing lands in the git index and git status shows no rename. No file content changes. Depends on Phases 1, 2 and 3 in that order — Phase 2 must have run, or there is no way back."
  ```

  - [x] 5.1 Re-run the lease-freshness guard immediately before applying
    ```yaml
    description: "Run the 60-minute mtime guard a second time, because the elapsed time since Phase 0 is real."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run the identical command from task 1.2, over the same three foreign-leased folders, with -mmin -60."
      - "Any output halts the run. Zero output is the pass."
      - "This second run is mandatory, not a repeat for tidiness. Phase 0 may be an hour or more behind by now, and this guard is the only thing standing between the apply and a session that woke up mid-write."
      - "Still do not delete or edit any foreign lease."
    pattern: "Read-only over the three foreign-leased workstream folders."
    imports: "find."
    compatibility: "Use the same 60-minute window as task 1.2, so the two runs are directly comparable."
    gotcha: "Running the guard from a different working directory silently changes which folders the relative paths resolve to. Run it from the repository root, as in task 1.2."
    verify:
      - "The three-folder find with -mmin -60 prints nothing, on this second run."
      - "The run notes record that the guard was run twice — once in Phase 0 and once here."
    checklist:
      - "The guard was re-run immediately before the apply, not reused from Phase 0."
      - "It produced zero output lines."
      - "It covered all three foreign-leased folders."
      - "No lease file was deleted or edited."
    self_eval:
      passed: true
      failures: []
      notes:
        - "The guard ran a second time on 2026-08-23, from the repository root, immediately before the apply. It is a fresh run, not the Phase 0 result."
        - "The command was the identical three-folder find with -type f -mmin -60, over WS-26-htqat4, WS-29-ns8zxo and WS-34-d3gjrv."
        - "It printed zero lines. The output is saved as $SCRATCH/freshness-guard-2.txt, alongside the Phase 0 file $SCRATCH/freshness-guard.txt, so both runs are on record."
        - "No .lease file was deleted or edited. find flowcharge -name .lease still returns the same four leases."
    ```

  - [x] 5.2 Run --apply and diff its output against the dry-run
    ```yaml
    description: "The irreversible step. Run the rename with --apply, save the output, and diff it line for line against the Phase 3 dry-run output."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Confirm first that task 3.1's archive exists and task 3.2 verified it. Do not run this task otherwise."
      - |-
        Run exactly, saving the two streams separately:
        node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-rename-artefacts.mjs --root . --apply \
          > $SCRATCH/rename-apply.out 2> $SCRATCH/rename-apply.err
      - "Diff $SCRATCH/rename-apply.out against $SCRATCH/rename-dryrun.out. Only an empty diff passes."
      - "That diff is the only way to distinguish an applied run from a dry run, because the script prints identical text for both."
      - "Halt condition: a non-zero exit, or any refusal on stderr. Do NOT re-run with --apply to fix a refusal — read the refusal first. A refusal means a target name was already taken, which is a collision the dry-run did not predict and which needs understanding before any further write."
      - "Prefer reading the refusal, fixing the one file, and re-running over restoring the archive. The script is idempotent and never edits contents, so most failure modes are answered that way. Restore only for a failed ID-set invariant in task 6.3, and only with the user's explicit go-ahead at that moment."
    pattern: "Renames every renameable artefact under flowcharge/workstreams/. flowcharge/archive/ is empty, so nothing moves there. No file content changes anywhere."
    imports: "node; the installed prx-rename-artefacts.mjs; diff."
    compatibility: "The script strips only a prefix equal to the file's own frontmatter id, so an already-correct name prints ok and a wrong-but-present prefix is never silently rewritten. It refuses rather than overwrites an existing target, and it never edits file contents — which is what makes the ID-set invariant meaningful."
    gotcha: "Every move here is fs.renameSync, because nothing under flowcharge/ is tracked. Expect git status to be unchanged afterwards, and expect no staged rename. mtimes are preserved by fs.renameSync, so the 'updated ... but file modified ...' warnings survive unchanged in substance — only their text changes, because it names the path."
    verify:
      - "The --apply run exits 0."
      - "test ! -s $SCRATCH/rename-apply.err — stderr is empty, so there are zero refusals."
      - "diff $SCRATCH/rename-dryrun.out $SCRATCH/rename-apply.out — empty output. Only an empty diff passes."
      - "git status --short — still shows only the pre-existing .gitignore modification, and no rename."
    checklist:
      - "The verified archive from Phase 2 existed before this task ran."
      - "The --apply run exited 0 with empty stderr."
      - "The applied output is byte-identical to the Phase 3 dry-run output."
      - "git status shows no rename and no new tracked change."
      - "No re-run with --apply was attempted to work around a refusal."
    self_eval:
      passed: true
      failures: []
      notes:
        - "The Phase 2 archive existed and was verified before this task ran. $SCRATCH/flowcharge-pre-rename-2026-08-23.tar.gz is 22286858 bytes, and tasks 3.1 and 3.2 both record passed: true."
        - "The --apply run exited 0. $SCRATCH/rename-apply.err is 0 bytes, so there were zero refusals."
        - "diff $SCRATCH/rename-dryrun.out $SCRATCH/rename-apply.out printed nothing and exited 0. The applied output is byte-identical to the Phase 3 dry-run output."
        - "The applied output holds 127 lines: 123 move lines and 4 ok lines, equal to <M> and <K> from task 4.1."
        - "git status --short still shows only ' M .gitignore'. There is no rename and no new tracked change, as expected for an untracked tree."
        - "The script ran once with --apply. No second apply was attempted."
    ```

  - [x] 5.3 Prove idempotence with an immediate re-run
    ```yaml
    description: "Re-run the script without --apply straight after the apply. It must print <M> + <K> ok lines and zero move lines. This is acceptance criterion 2."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |-
        Run exactly:
        node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-rename-artefacts.mjs --root . \
          > $SCRATCH/rename-rerun.out 2> $SCRATCH/rename-rerun.err
      - "The output must contain <M> + <K> ok lines and zero move lines, and the run must exit 0."
      - "This is mandatory, not optional. Because dry-run and applied output are textually identical, this all-ok re-run is the only positive proof that the apply really applied."
      - "It also proves idempotence on the live tree rather than on a fixture."
    pattern: "Read-only over flowcharge/workstreams/ and flowcharge/archive/. Writes two output files to $SCRATCH."
    imports: "node; the installed prx-rename-artefacts.mjs; grep."
    compatibility: "Run it without --apply. The counts <M> and <K> come from task 4.1."
    gotcha: "A non-zero move count here means some file was not renamed — most likely one the apply refused. Read $SCRATCH/rename-apply.err before doing anything else, and do not re-apply blindly."
    verify:
      - "The re-run exits 0 and $SCRATCH/rename-rerun.err is empty."
      - "grep -c ' -> ' $SCRATCH/rename-rerun.out — returns 0."
      - "grep -c ' ok$' $SCRATCH/rename-rerun.out — equals <M> + <K> from task 4.1."
    checklist:
      - "The re-run was executed immediately after the apply, without --apply."
      - "It exited 0 with empty stderr."
      - "It printed zero move lines."
      - "Its ok-line count equals <M> + <K>."
    self_eval:
      passed: true
      failures: []
      notes:
        - "The re-run ran immediately after the apply, without --apply, and exited 0."
        - "$SCRATCH/rename-rerun.err is 0 bytes."
        - "grep -c ' -> ' $SCRATCH/rename-rerun.out returns 0. Zero move lines remain."
        - "grep -c ' ok$' returns 127, equal to <M> + <K> = 123 + 4 from task 4.1. The file holds 127 lines in total, so every line is an ok line."
        - "This all-ok re-run is the positive proof that the apply really applied, and it proves idempotence on the live tree."
    ```

  - [x] 5.4 Assert zero bare names and an intact set of workstream records
    ```yaml
    description: "Check acceptance criteria 6 and 7 directly on the filesystem: no bare artefact name survives, and every workstream.md is still present under its plain name."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |-
        Criterion 6 — run exactly, and expect no output:
        find flowcharge/workstreams -maxdepth 2 \( -name 'plan.md' -o -name 'issuelist.md' -o -name 'tasklist.md' \)
      - "Criterion 7 — run: find flowcharge/workstreams -maxdepth 2 -name 'workstream.md' | wc -l, and confirm it equals the workstream folder count from: find flowcharge/workstreams -maxdepth 1 -mindepth 1 -type d | wc -l"
      - "Also spot-check acceptance criterion 1 by listing a renamed folder and confirming each artefact filename opens with its own frontmatter id followed by one hyphen."
      - "Any surviving bare name, or any missing workstream.md, halts the run before Phase 5."
    pattern: "Read-only over flowcharge/workstreams/."
    imports: "find; wc; grep."
    compatibility: "-maxdepth 2 matches the script's own scan depth. The escaped parentheses in the criterion 6 find are required by the shell."
    gotcha: "workstream.md is deliberately never renamed: its folder already carries the workstream id, and three scanners key on that plain filename as the folder marker — the generator's folder-marker test, src/lib/extract.ts and src/lib/detail.ts. A missing one is a serious fault, not a cosmetic one."
    verify:
      - "The criterion 6 find returns no output at all."
      - "The workstream.md count equals the workstream folder count."
      - "In one sampled folder, every artefact filename begins with that file's own frontmatter id followed by a hyphen."
    checklist:
      - "Zero files named plan.md, issuelist.md or tasklist.md remain under flowcharge/workstreams."
      - "Every workstream folder still holds a workstream.md under that exact name."
      - "A sampled folder confirms each artefact filename carries its own id prefix."
      - "No file was renamed, moved, or edited by this verification task."
    self_eval:
      passed: true
      failures: []
      notes:
        - "Criterion 6: the -maxdepth 2 find for plan.md, issuelist.md and tasklist.md returned no output at all. A wider check, find flowcharge/workstreams -maxdepth 2 -name 'prx*.md' ! -name 'workstream.md' | wc -l, also returns 0."
        - "Criterion 7: 62 workstream.md files, and 62 workstream folders. The two counts are equal."
        - "Criterion 1 spot-check in flowcharge/workstreams/WS-34-d3gjrv-artefact-id-suffix-upgrade: PLN-25-0agr4z-plan.md carries frontmatter id PLN-25-0agr4z, and TL-30-gju8tp-tasklist.md carries id TL-30-gju8tp. Each filename opens with its own id and one hyphen."
        - "The same folder still holds workstream.md, cross-repo-references.md and prose-mentions-left-alone.md under their original names, which confirms the two excluded files were left alone."
        - "This task ran only find, ls, grep and wc. It renamed, moved and edited nothing."
    ```

- [x] 6. Phase 5 — Regenerate and verify the invariants

  ```yaml
  description: "Bring the generated views back in line and check every before/after invariant. The regenerate exits 0; --check still exits 2 because the pre-existing non-legacy warnings remain by design. That is the designed end state, not a failure."
  ```

  - [x] 6.1 Regenerate the index and the board
    ```yaml
    description: "Run prx-index.mjs in its writing mode, so index.md and kanban.md reflect the renamed tree."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run: node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root ."
      - "This rewrites flowcharge/index.md and flowcharge/kanban.md."
      - "Check git status afterwards. Expect no .gitignore change, because the required ignore lines are already present in the working tree. If one appears, that is documented generator behaviour — every writing generator invocation appends any missing ignore lines — and not a fault of this migration. Record it and do not revert it."
      - "Never hand-edit index.md or kanban.md. They are generated views, and workstream frontmatter is the source of truth."
    pattern: "Writes flowcharge/index.md and flowcharge/kanban.md, and possibly appends to .gitignore."
    imports: "node; the installed prx-index.mjs."
    compatibility: "Run the writing invocation, without --check and without --list. Run it from the repository root so --root . resolves through git rev-parse --git-common-dir to this repository."
    gotcha: "The board reads flowcharge/ live from disk on every request, so no cache invalidation is needed. Any board process stopped in task 1.2 can be restarted for the manual check in task 6.5."
    verify:
      - "The regenerate exits 0."
      - "ls -l flowcharge/index.md flowcharge/kanban.md — both files exist and their mtimes are from this run."
      - "git status --short — records whether .gitignore changed, so the outcome is documented either way."
    checklist:
      - "The generator was run in its writing mode and exited 0."
      - "index.md and kanban.md were both rewritten."
      - "Neither generated view was hand-edited."
      - "Any .gitignore change is recorded rather than reverted."
    self_eval:
      passed: true
      failures: []
      notes:
        - "node prx-index.mjs --root . ran in its writing mode and exited 0. It reported 62 workstreams, 189 artefacts, 21 issues (3 open) → index.md + kanban.md."
        - "Both generated views were rewritten at 2026-08-23 22:49, replacing the 22:30 copies that pre-dated the rename."
        - "git status --short shows only ' M .gitignore', which pre-dates this workstream. The generator appended no new ignore line, so there is no .gitignore change to record from this run."
        - "Neither view was hand-edited. Both were produced only by the generator."
        - "index.md shrank from 51545 to 33628 bytes, 408 lines to 284. The executing session investigated the drop against the pre-rename copy held in the Phase 2 tar archive rather than accepting it. The cause is benign: index.md embeds the --check warning list, and the 123 legacy-filename warnings the rename cleared are gone from it. 237 raw warnings minus 123 equals the 114 that remain."
        - "One ordering change is visible inside index.md: the per-workstream artefact column now lists TL-1-vioqeg before TL-2-iexi8i, and TL-19-ff31qo before TL-21-7mprrh, where before it listed each pair the other way round. prx-index.mjs lists that column in directory walk order, and the rename changes walk order. It is a cosmetic ordering change in the installed generator's own output. The board is unaffected, because detail.ts re-sorts by artefact id number, which task 6.5 confirmed at runtime."
    ```

  - [x] 6.2 Assert zero legacy warnings and an unchanged normalised warning set
    ```yaml
    description: "Check acceptance criteria 3 and 4: no legacy-filename warning survives, and the normalised non-legacy warning set is identical to the Phase 0 baseline."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Save the raw --check output to $SCRATCH/check-raw-after.txt, then run: grep -c 'legacy filename' $SCRATCH/check-raw-after.txt — it must return 0. That is criterion 3."
      - |-
        Re-run the identical normalisation pipeline from task 1.3, writing to a new file:
        node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs \
          --root . --check 2>&1 \
          | grep -v 'legacy filename' \
          | sed -E 's#/(PLN|IL|TL)-[0-9]+-[0-9a-z]{6}-prx#/prx#g' \
          | sed -E 's/for [0-9]+ minutes/for N minutes/g' \
          | sed -E 's/[0-9]+ days?/N days/g' \
          | sort > $SCRATCH/check-nonlegacy-after.txt
      - "Diff $SCRATCH/check-nonlegacy-before.txt against $SCRATCH/check-nonlegacy-after.txt. An empty diff is the pass. That is criterion 4."
      - "A non-empty diff halts the run. Read $SCRATCH/check-raw-before.txt and $SCRATCH/check-raw-after.txt to identify which warning appeared or cleared before deciding anything."
      - "The remaining non-legacy warnings are the post-migration bar, not a defect this migration clears. Do not fix them here."
    pattern: "Read-only over flowcharge/. Writes two files to $SCRATCH."
    imports: "node; the installed prx-index.mjs; grep; sed -E; sort; diff."
    compatibility: "The pipeline must be byte-identical to task 1.3's, or the two sides are not comparable. Copy it rather than retyping it."
    gotcha: "--check exits 2 while any warning remains, and warnings remain by design, so a non-zero exit here is expected and is not a failure. The path normalisation is load-bearing: without it this comparison fails on the warnings that embed the artefact's own path in their text, which the rename changes while describing the identical condition on the identical file."
    verify:
      - "grep -c 'legacy filename' $SCRATCH/check-raw-after.txt — returns 0."
      - "diff $SCRATCH/check-nonlegacy-before.txt $SCRATCH/check-nonlegacy-after.txt — empty output."
      - "sort $SCRATCH/check-nonlegacy-after.txt | uniq -d | wc -l — returns 0, confirming the normalisation stayed lossless after the rename."
    checklist:
      - "The raw --check output after the migration contains zero legacy-filename lines."
      - "The after-normalisation pipeline is byte-identical to the one used in task 1.3."
      - "The before and after normalised sets diff empty."
      - "The after set contains zero duplicate lines."
      - "The non-zero --check exit was recorded as expected rather than treated as a failure."
    self_eval:
      passed: true
      failures: []
      notes:
        - "Criterion 3 passes. $SCRATCH/check-raw-after.txt holds 114 lines and grep -c 'legacy filename' on it returns 0. The before raw held 237 lines, so all 123 legacy-filename warnings cleared and nothing else changed count."
        - "The after normalisation pipeline was copied from task 1.3 rather than retyped, so it is byte-identical: the same grep -v, the same three sed -E expressions in the same order, and the same sort."
        - "Criterion 4 passes. diff $SCRATCH/check-nonlegacy-before.txt $SCRATCH/check-nonlegacy-after.txt produces empty output and exits 0. Both files hold 114 lines."
        - "sort $SCRATCH/check-nonlegacy-after.txt | uniq -d | wc -l returns 0, so the normalisation stayed lossless after the rename."
        - "--check exited 2, as the task predicts. The remaining 114 warnings are the designed post-migration bar and were not touched."
    ```

  - [x] 6.3 Assert the artefact ID set is unchanged
    ```yaml
    description: "Check acceptance criterion 5, the data-loss detector: --list all returns exactly the same ID set after the migration as before it."
    author: Anthony Koukoullis
    issues: []
    implement:
      - |-
        Re-run the identical pipeline from task 1.4, writing to a new file:
        node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs \
          --root . --list all \
          | grep -oE '^\| [A-Z]+-[0-9]+-[0-9a-z]{6}' | sed 's/^| //' | sort > $SCRATCH/ids-after.txt
      - "Diff $SCRATCH/ids-before.txt against $SCRATCH/ids-after.txt. An empty diff is the pass — same members, same cardinality."
      - "A non-empty diff is the one condition that justifies restoring the Phase 2 archive. A dropped ID means a file is genuinely lost; an added ID means a file was doubled."
      - "Restoring the archive replaces the live flowcharge/ with the archived one, which destroys anything written to the tree since the archive was taken — the regenerated index and board, and any status edits. Treat it as a destructive operation that needs the user's explicit go-ahead at the moment it is needed. Do not restore without asking."
    pattern: "Read-only over flowcharge/. Writes one file to $SCRATCH."
    imports: "node; the installed prx-index.mjs; grep -oE; sed; sort; diff."
    compatibility: "The pipeline must be byte-identical to task 1.4's, or the two sides are not comparable."
    gotcha: "Because the script never edits file contents, any difference between the two ID sets means a file went missing or was doubled, not that a value changed. That is what makes this check stronger and cheaper than diffing file contents."
    verify:
      - "diff $SCRATCH/ids-before.txt $SCRATCH/ids-after.txt — empty output."
      - "wc -l < $SCRATCH/ids-after.txt — equals the baseline cardinality recorded in task 1.4."
      - "sort $SCRATCH/ids-after.txt | uniq -d | wc -l — returns 0."
    checklist:
      - "The after pipeline is byte-identical to the one used in task 1.4."
      - "The before and after ID sets diff empty."
      - "The cardinality matches the recorded baseline."
      - "Every ID in the after set is unique."
      - "No archive restore was performed without the user's explicit go-ahead."
    self_eval:
      passed: true
      failures: []
      notes:
        - "The after pipeline was copied from task 1.4 rather than retyped, so it is byte-identical: the same --list all, the same grep -oE anchor, the same sed and the same sort."
        - "Criterion 5 passes. diff $SCRATCH/ids-before.txt $SCRATCH/ids-after.txt produces empty output and exits 0. No ID was dropped and none was doubled, so no artefact file was lost by the rename."
        - "Cardinality is 189, equal to the baseline recorded in task 1.4."
        - "sort $SCRATCH/ids-after.txt | uniq -d | wc -l returns 0, so every ID is unique."
        - "No archive restore was performed and none was needed. The Phase 2 tar archive was opened read-only once, to extract the pre-rename flowcharge/index.md into $SCRATCH/extract/ for the task 6.1 size investigation. The live flowcharge/ tree was never overwritten."
    ```

  - [x] 6.4 Run the build and the extract unit test
    ```yaml
    description: "Check acceptance criterion 8: npm run build exits 0, and node --test dist/lib/extract.test.js reports 7 passes and 0 failures."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run: npm run build — this is the repository's compile gate. It compiles three TypeScript projects and bundles the browser assets, so it catches any accidental source edit. There is no test script in package.json and no lint or typecheck script; the build is the nearest thing this repository has to a full gate."
      - "Run: node --test dist/lib/extract.test.js — it must report 7 passes and 0 failures."
      - "extract.test.js covers extract.ts, one of the two flowcharge/ readers. It writes its own fixtures into a temp directory and never reads this repository's real flowcharge/, so it can neither detect nor be broken by the rename. Its role is to prove the reader still compiles and behaves after the build."
      - "Do NOT run the whole test glob as a gate. node --test 'dist/lib/*.test.js' fails today inside skill-content-fetch.test.js, which makes a live network call and times out. That failure is pre-existing and unrelated to this migration, and treating it as a gate would produce a false red. Running it for information is fine; asserting on it is not."
      - "Write no new tests. This workstream adds no code."
    pattern: "Runs the repository's own build and one existing unit test. Writes to dist/, which is generated and gitignored."
    imports: "npm; node 18 or later; typescript 5.9 and esbuild, both already in devDependencies."
    compatibility: "npm run build expands to build:base plus tools/bundle-public.mjs, covering tsconfig.json, src/public/tsconfig.json and electron/tsconfig.json. Run it before the node --test, because the test runs the compiled output in dist/, not the TypeScript source."
    gotcha: "The unit test must be run against the compiled dist/lib/extract.test.js path specifically. Naming the glob instead pulls in skill-content-fetch.test.js and its pre-existing network timeout."
    verify:
      - "npm run build — exits 0."
      - "node --test dist/lib/extract.test.js — reports pass 7 and fail 0."
    checklist:
      - "npm run build exits 0 with no compile error."
      - "node --test dist/lib/extract.test.js reports 7 passes and 0 failures."
      - "The full dist/lib/*.test.js glob was not used as a gate."
      - "No source file under src/, electron/ or tools/ was edited by this migration."
      - "No new test was written."
    self_eval:
      passed: true
      failures: []
      notes:
        - "Criterion 8 passes. npm run build exited 0. It compiled all three TypeScript projects, copied the assets, swept 2 stale .js files, bundled 2 entry points and passed its own eval guard and source-map check."
        - "node --test dist/lib/extract.test.js reported tests 7, pass 7, fail 0, in 35.7 ms."
        - "The full dist/lib/*.test.js glob was never run as a gate, so the pre-existing network timeout in skill-content-fetch.test.js could not produce a false red."
        - "git status --short src electron tools returns zero changed files, so this migration edited no source file. The only modified tracked file in the whole repository is .gitignore, whose change pre-dates this workstream."
        - "No new test was written. This workstream adds no code."
    ```

  - [x] 6.5 Check the board still renders this repository's artefacts
    ```yaml
    description: "The plan's manual board check — the substitute for the missing unit coverage on detail.ts, the reader that carries the filename furthest."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Start the board with: npm start — then open this repository's own project tile."
      - "Confirm every workstream card still renders its plan, issue list and task list rows."
      - "detail.ts has no unit coverage, and it is the reader that puts the basename into the payload as PraxisDetailArtefact.file. Its rename-safety was established by reading the code — src/public/ has no consumer of that field — so this render check is the only runtime confirmation."
      - "Confirm the displayed ordering is unchanged. detail.ts walks the directory sorted, so the rename does change walk order, but it re-sorts all three artefact arrays by artefact id number afterwards."
      - "Stop the board again when the check is done, if the migration is not yet closed out."
      - "The plan marks this check optional in its verify list and relies on it in its testing strategy. Run it; report the result either way."
    pattern: "Runs the repository's own server entrypoint and reads the rendered board. Changes no file."
    imports: "npm; the built dist/ output from task 6.4."
    compatibility: "npm start runs prestart, which rebuilds first, so run it after task 6.4 rather than instead of it. The board reads flowcharge/ live from disk on every request, so no cache needs clearing."
    gotcha: "No unit test can catch a detail.ts regression here, so a visual confirmation is the whole value of this task. Do not substitute a passing build for it."
    verify:
      - "npm start — the server starts without error."
      - "Open this repository's project tile and confirm every workstream card lists its plan, issue list and task list rows."
      - "Confirm artefact ordering within each card is by artefact id number, unchanged from before the migration."
    checklist:
      - "The board started and this repository's project tile opened."
      - "Every workstream card renders its artefact rows."
      - "Artefact ordering within cards is unchanged."
      - "The result is recorded in the run notes, pass or fail."
    self_eval:
      passed: true
      failures: []
      notes:
        - "The check passes. npm start ran prestart, rebuilt, and served on 127.0.0.1:4173 without error. This repository's own tile, Praxis-Board, opened to the board."
        - "The board header reads 62 workstreams, 21 issues, 89% task completion, 505/569 tasks across 64 task lists, and 62 / 62 workstreams shown."
        - "Every card renders its artefact rows. A DOM sweep over all 62 cards counted 127 artefact rows: 53 plan, 64 tasklist and 10 issuelist. That equals the 189 artefacts of the ID set minus the 62 workstream.md records, so every non-workstream artefact renders."
        - "Two cards render no artefact row, WS-27-wg5q18 and WS-28-jec0dh. This is correct and pre-existing, not a rename effect: both folders hold only workstream.md and never held a plan, issue list or task list."
        - "Ordering is unchanged and is by artefact id number, so detail.ts re-sorts as the task describes. Both workstreams whose walk order the rename actually flipped were checked. WS-4-50vnol renders PLN-1, IL-1, TL-1, TL-2 on the card and IL-1-ub7gho, TL-1-vioqeg, TL-2-iexi8i in the modal. WS-20-73eu0l renders PLN-16, IL-5, TL-19, TL-21 on the card and IL-5-tioy3x, TL-19-ff31qo, TL-21-7mprrh in the modal."
        - "The detail modal was exercised on all three tabs for WS-4-50vnol. Plan renders PLN-1-va0ssb with its full body, Issues (1) renders IL-1-ub7gho with its issue row, and Tasks (6) renders both task lists. This is the runtime confirmation that detail.ts survives the rename, since it has no unit coverage and carries the basename into PraxisDetailArtefact.file."
        - "The board was stopped again after the check. No dist/server.js process remains and nothing listens on TCP port 4173. The background npm start exited 143, which is the executing session's own SIGTERM, not a fault."
    ```

- [x] 7. Phase 6 — Close out

  ```yaml
  description: "Leave the workstream in a correct, unlocked state. Depends on Phase 5 passing every invariant. There is no commit phase: nothing tracked by git changed, and the only modified tracked file is .gitignore, whose change pre-dates this work."
  self_eval:
    passed: true
    failures: []
    notes:
      - "All four subtasks pass. Every Phase 6 checklist item is YES."
      - "RUN REPORT — archive: /Users/akoukoullis/prx-scratch/WS-66-jqcbvp/flowcharge-pre-rename-2026-08-23.tar.gz, 22286858 bytes, retained."
      - "RUN REPORT — counts: <C> = 129, <M> = 123, <K> = 4, and <M> + <K> = 127 = <C> - 2."
      - "RUN REPORT — ID-set cardinality is 189, unchanged before and after the rename."
      - "RUN REPORT — normalised non-legacy warning set: 114 lines at the Phase 0 baseline and at the task 6.2 after-check, 115 lines after the tasks 7.1 and 7.2 status edits, and 116 lines after this task list's own checkboxes were marked. Both added lines are close-out bookkeeping on this workstream's own two files, and neither is a rename effect. Zero legacy-filename lines throughout."
      - "RUN REPORT — three foreign leases left in place, unmodified: WS-26-htqat4-plan-markdown-table-rendering, WS-29-ns8zxo-project-tile-folder-modified-date and WS-34-d3gjrv-artefact-id-suffix-upgrade. Their mtimes are still 2026-08-12, 2026-08-15 and 2026-08-16."
      - "RUN REPORT — no git commit was made. git status --short still shows only the pre-existing ' M .gitignore'."
      - "This task list's own frontmatter status is still ready. That raises two open warnings, one on workstream.md and one on this file. Task 7 does not instruct a change to it, so it was left alone for the orchestrating session to decide."
  ```

  - [x] 7.1 Set the plan to done
    ```yaml
    description: "Set PLN-56-l8brv7's frontmatter status to done and bump its updated date, editing the file in place."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open flowcharge/workstreams/WS-66-jqcbvp-migrate-artefact-filenames-this-repo/PLN-56-l8brv7-plan.md."
      - "In its frontmatter, change the status key from ready to done."
      - "Set the updated key to today's date, from: date +%F"
      - "Edit the file in place. The plan was authored directly at its compliant name, so Phase 4 reported it as ok rather than moving it, and its path is unchanged."
      - "Change nothing else in the file. The migration edits no artefact body."
    pattern: "flowcharge/workstreams/WS-66-jqcbvp-migrate-artefact-filenames-this-repo/PLN-56-l8brv7-plan.md — frontmatter only."
    imports: "None."
    compatibility: "Praxis frontmatter takes flat keys and inline arrays only; the index parser depends on that. Keep the existing key order and quoting style."
    gotcha: "Editing the file changes its mtime, which can raise a fresh 'updated ... but file modified ...' warning if updated is not moved to today at the same time. Setting both keys in one edit avoids it. This task runs after task 6.2 captured its warning-set comparison, so it cannot disturb that invariant."
    verify:
      - "grep -E '^(status|updated):' on the plan file — status is done and updated is today's date."
      - "head -13 on the plan file — the frontmatter still parses as flat keys with inline arrays."
    checklist:
      - "The plan's status is done."
      - "The plan's updated key holds today's date."
      - "No other key and no body line changed."
      - "The plan file was edited in place at its existing ID-prefixed path."
    self_eval:
      passed: true
      failures: []
      notes:
        - "PLN-56-l8brv7-plan.md line 7 now reads 'status: done'. It read 'status: ready' before the edit, so the task was outstanding."
        - "The updated key already held 2026-08-23, which is today's date from date +%F, so no date change was needed. Both keys were covered by one edit, so no new 'updated but file modified' warning can appear."
        - "head -13 shows the frontmatter still parses as flat keys with inline arrays, in the original key order and quoting style."
        - "Only the one status token changed. No other key and no body line was touched, and the file stayed at its existing ID-prefixed path."
    ```

  - [x] 7.2 Set the workstream record to done
    ```yaml
    description: "Set WS-66-jqcbvp's frontmatter status to done and bump its updated date, so the board moves its card."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Open flowcharge/workstreams/WS-66-jqcbvp-migrate-artefact-filenames-this-repo/workstream.md."
      - "In its frontmatter, change the status key from backlog to done, reflecting the finished migration. That is acceptance criterion 9's second half."
      - "Set the updated key to today's date, from: date +%F"
      - "Change nothing else. workstream.md keeps its plain name and was never moved."
      - "Do not archive this workstream. Archiving is explicit and on the user's separate say-so, and it is out of scope here."
    pattern: "flowcharge/workstreams/WS-66-jqcbvp-migrate-artefact-filenames-this-repo/workstream.md — frontmatter only."
    imports: "None."
    compatibility: "Card movement happens by editing workstream frontmatter status and regenerating, never by hand-editing kanban.md."
    gotcha: "This file's plain name is the folder marker three separate scanners key on. Do not rename it, and do not move it while editing."
    verify:
      - "grep -E '^(status|updated):' on workstream.md — status is done and updated is today's date."
      - "ls on the workstream folder — the file is still named exactly workstream.md."
    checklist:
      - "The workstream's status is done."
      - "The workstream's updated key holds today's date."
      - "The file is still named workstream.md and sits in the same folder."
      - "The workstream was not archived."
    self_eval:
      passed: true
      failures: []
      notes:
        - "workstream.md line 8 now reads 'status: done'. The task text predicts a starting value of backlog, but the live value was in-progress. The end state the task asks for is done, and that is what the edit set. This divergence is a stale reference in the task text, not a defect."
        - "The updated key already held 2026-08-23, today's date, so both keys are correct after one edit."
        - "ls on the folder shows the file is still named exactly workstream.md and still sits in the same workstream folder. It was not renamed and not moved."
        - "The workstream was not archived. The board places its card in the Done column, not in Dropped or Archive."
    ```

  - [x] 7.3 Release this workstream's lease only
    ```yaml
    description: "Delete .lease from this workstream's folder, and only if its session line still matches the running session. Leave the three foreign leases untouched."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Read flowcharge/workstreams/WS-66-jqcbvp-migrate-artefact-filenames-this-repo/.lease and confirm its session line still matches the running session."
      - "Delete that one file only if the session line matches. That is acceptance criterion 9's first half."
      - "If it does not match, leave it in place and report it. Another session holds it, and deleting it would be a destructive write on state this session does not own."
      - "Do NOT delete, edit, or acquire the three foreign leases at WS-26-htqat4-plan-markdown-table-rendering, WS-29-ns8zxo-project-tile-folder-modified-date and WS-34-d3gjrv-artefact-id-suffix-upgrade. Name all three in the run report instead."
    pattern: "flowcharge/workstreams/WS-66-jqcbvp-migrate-artefact-filenames-this-repo/.lease — deletion of one file."
    imports: "None."
    compatibility: "The published stale-lease procedure governs acquiring a lease on a workstream you intend to work inside. This migration acquired none of the three foreign ones, so that procedure does not authorise deleting them here."
    gotcha: "A wildcard delete over flowcharge/ would take all four leases. Delete the one path explicitly, by its full path, never through a find -delete or a glob."
    verify:
      - "find flowcharge -name .lease — returns exactly the three foreign leases and nothing else."
      - "The three remaining paths are the WS-26-htqat4, WS-29-ns8zxo and WS-34-d3gjrv folders, and all three are named in the run report."
    checklist:
      - "The own-lease session line was confirmed to match before deletion."
      - "Exactly one lease file was deleted."
      - "The three foreign leases still exist, unmodified."
      - "The three foreign leases are named in the run report."
    self_eval:
      passed: true
      failures: []
      notes:
        - "The own lease was read before deletion. Its session line was c17da25e-59e8-42e4-b0e6-e68ea344a35d, acquired 2026-08-23T12:32:40.645Z. That matches the running session, so the deletion was authorised."
        - "Exactly one file was deleted, by its full explicit path: flowcharge/workstreams/WS-66-jqcbvp-migrate-artefact-filenames-this-repo/.lease. No glob and no find -delete was used."
        - "find flowcharge -name .lease now returns exactly 3, the three foreign leases. Their mtimes are still 2026-08-12, 2026-08-15 and 2026-08-16, so none was modified."
        - "The three foreign leases are WS-26-htqat4-plan-markdown-table-rendering, WS-29-ns8zxo-project-tile-folder-modified-date and WS-34-d3gjrv-artefact-id-suffix-upgrade. All three are named in the run report."
    ```

  - [x] 7.4 Regenerate a final time and confirm the end state
    ```yaml
    description: "Run the index generator once more, so the board reflects the closed-out statuses, then confirm the migration's end state."
    author: Anthony Koukoullis
    issues: []
    implement:
      - "Run: node /Users/akoukoullis/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root ."
      - "Confirm this workstream's card sits in the expected board column for its new status."
      - "Run --check one last time and confirm it shows zero legacy-filename lines and the same normalised non-legacy warning set as task 6.2's after file."
      - "Confirm the tar archive from task 3.1 is still in place. It is kept after success, not deleted, and removing it is a separate decision for the user."
      - "Produce a short run report naming: the archive's absolute path, <C>, <M>, <K>, the ID-set cardinality, the normalised warning-set line count, and the three foreign leases left in place."
      - "Do not create a git commit. Nothing tracked by git changed."
    pattern: "Rewrites flowcharge/index.md and flowcharge/kanban.md. Reads flowcharge/ and $SCRATCH."
    imports: "node; the installed prx-index.mjs; grep; diff."
    compatibility: "--check exits 2 while any warning remains, and warnings remain by design. Treat the non-zero exit as the expected end state."
    gotcha: "This final regenerate runs after the status edits in tasks 7.1 and 7.2, so the plan file and workstream.md now have fresh mtimes and today's updated dates. If a new 'updated ... but file modified ...' warning appears for either, check that both keys were set in the same edit before treating it as a fault."
    verify:
      - "The final regenerate exits 0."
      - "grep -c 'legacy filename' on the final raw --check output — returns 0."
      - "Re-run task 6.2's normalisation pipeline into a new file and diff it against $SCRATCH/check-nonlegacy-after.txt — differences, if any, are confined to the two files edited in tasks 7.1 and 7.2 and are explained in the run report."
      - "find flowcharge -name .lease — returns exactly the three foreign leases."
      - "test -s $SCRATCH/flowcharge-pre-rename-<date>.tar.gz — the archive is still present."
      - "git status --short — still shows only the pre-existing .gitignore modification, and no commit was made."
    checklist:
      - "The index and board were regenerated after the status edits."
      - "This workstream's card sits in the expected board column."
      - "The final --check shows zero legacy-filename lines."
      - "Exactly three .lease files remain, all foreign, all untouched."
      - "The tar archive is retained and its absolute path is in the run report."
      - "No git commit was created by this workstream."
    self_eval:
      passed: true
      failures: []
      notes:
        - "The final regenerate ran after the tasks 7.1 and 7.2 status edits and exited 0. It reported 62 workstreams, 189 artefacts, 21 issues (3 open), and rewrote index.md and kanban.md."
        - "The regenerate also printed 'board: WS-66-jqcbvp sits in In Progress but frontmatter says done — frontmatter wins, board regenerated', which is the card move itself."
        - "The card now sits in the Done column of flowcharge/kanban.md, between the '- # Done' header and the '- # Dropped __archived__' header. That is the expected column for status done."
        - "The final raw --check output is at $SCRATCH/check-raw-closeout.txt, 115 lines, and grep -c 'legacy filename' on it returns 0. --check exited 2, which is the designed end state, not a failure."
        - "Task 6.2's normalisation pipeline was re-run byte-identically into $SCRATCH/check-nonlegacy-closeout.txt, 115 lines. diff against $SCRATCH/check-nonlegacy-after.txt shows exactly one added line and no removed line."
        - "The single added line is: WARN WS-66-jqcbvp (.../workstream.md): status is done but 1 of its 2 artefacts are still open. It is confined to the workstream.md file edited in task 7.2, and its cause is that this task list's own frontmatter status is still ready. No other warning appeared or cleared."
        - "sort | uniq -d on the close-out file returns 0, so the normalisation stayed lossless."
        - "The generator was then run a second time, after this task list's own checkboxes were marked, so the board's task-completion figures match the finished list. That run also exited 0. Its raw --check is $SCRATCH/check-raw-closeout2.txt, 116 lines, with 0 legacy-filename lines, and its normalised set is $SCRATCH/check-nonlegacy-closeout2.txt, 116 lines, with 0 duplicates."
        - "That second run added one further line: WARN TL-67-5ay1xi: all 31 tasks checked but status is ready — close it? It is confined to this task list file, and it is the direct consequence of marking Phase 6 complete. Task 7 does not instruct a status change on this file, so it was left for the orchestrating session."
        - "The tar archive is still present at /Users/akoukoullis/prx-scratch/WS-66-jqcbvp/flowcharge-pre-rename-2026-08-23.tar.gz, 22286858 bytes. It was not deleted. That decision belongs to the user."
        - "git status --short still shows only ' M .gitignore', and git log -1 is still b9fe85b. No commit was created."
    ```

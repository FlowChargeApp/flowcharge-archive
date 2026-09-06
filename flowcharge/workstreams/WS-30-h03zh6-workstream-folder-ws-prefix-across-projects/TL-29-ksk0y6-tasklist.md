---
id: TL-29-ksk0y6
type: tasklist
workstream: WS-30-h03zh6
slug: workstream-folder-ws-prefix-across-projects
title: "Rename workstream folders to WS-N-<slug> across every other project on the dashboard"
status: done
created: 2026-08-15
updated: 2026-08-16
depends_on: []
links: []
mode: spec
base_commit: 34f6a2e
---
# PRX Tasks

## Rename workstream folders to WS-N-<slug> across every other project on the dashboard

The `Praxis` project already adopted the `WS-N-<slug>` workstream-folder naming scheme — ID prefix, hyphen, then the existing unchanged slug — and renamed its own 14 folders as part of that work. The convention now lives in the shared `skills/` docs, but the other projects this dashboard tracks were never migrated: their folders are still bare `<slug>/`, so a workstream's ID is only visible by opening `workstream.md`. This task list carries that same rename across the projects that still need it. All 8 projects registered in `.praxis-projects.json` were scanned this session for `flowcharge/workstreams/*/` folders that do not already start with `WS-<number>-`. Only two projects have any: this project (`Praxis-Dashboard`, 27 folders including this workstream's own) and `DownloadAlbum` (14 folders). The other six — `LAD`, `Praxis`, `lad-poc`, `Praxis-Launch`, `Praxis-Website`, and `Praxis-Demo` — are already fully compliant and need no work. This is a pure filesystem rename: the frontmatter `slug:` key is untouched everywhere, and no file content changes.

- [x] 1. Rename existing bare-slug workstream folders to WS-N-<slug> across all affected projects

  ```yaml
  description: "Rename every remaining bare-slug flowcharge/workstreams/<slug>/ folder to the WS-N-<slug> form in the two projects that still need it — Praxis-Dashboard (27 folders) and DownloadAlbum (14 folders) — so the naming scheme already adopted in Praxis holds across the whole dashboard."
  issues: []
  implement:
    - "Work one project at a time. For each project root, first re-verify the live state: list `flowcharge/workstreams/` and collect every directory whose name does NOT already match `WS-<number>-*`. The mapping in `gotcha` was gathered when this list was authored — treat it as the expected set, not as a substitute for the live listing, since a new workstream may have been created since."
    - "For each bare-slug folder found, read that folder's `workstream.md` `id:` frontmatter key, then `mv` the folder to `WS-<N>-<slug>` using that ID and the folder's existing, unchanged slug. One `mv` per folder, run from inside that project's own `flowcharge/workstreams/` directory."
    - "For the two DownloadAlbum folders that have no `workstream.md` (`monochrome-precoding-research`, `monochrome-remediation`), read the `id:` key from that folder's `tasklist.md` instead — see `gotcha`."
    - "If the live listing turns up a bare-slug folder not in the `gotcha` mapping, rename it too, using the ID read from its own record file. Do not skip it, and do not guess its ID."
    - "If a project registered in `.praxis-projects.json` was added since this list was authored, scan it the same way and rename anything bare-slug it holds."
    - "After the renames in a project are complete, run the index/board regenerator once for that project root: `node ~/.claude/skills/prx-orchestrate/scripts/prx-index.mjs --root <project-root>` — so its index.md and kanban.md reflect the new folder names. Run it once for Praxis-Dashboard and once for DownloadAlbum."
  pattern: "/Users/akoukoullis/Work/AK/Praxis-Dashboard/flowcharge/workstreams/*/ (27 folders) and /Users/akoukoullis/Work/AK/DownloadAlbum/flowcharge/workstreams/*/ (14 folders) — two independent project roots, each with its own flowcharge/ tree and its own WS-N numbering space."
  imports: "The shell `mv` command only — NOT `git mv`. `flowcharge/` is excluded by this user's global ~/.gitignore_global, so nothing under it is git-tracked in any project and `git mv` fails with 'fatal: source directory is empty'. Also `~/.claude/skills/prx-orchestrate/scripts/prx-index.mjs` (run via node) for the post-rename regenerate; only this session's skill path provides it, neither project vendors its own copy. `.praxis-projects.json` at the Praxis-Dashboard root is the registry naming the tracked project roots."
  compatibility: "Must use the exact WS-N-<slug> form already fixed in the Praxis project's skills/prx-orchestrate/CONVENTIONS.md — ID prefix, hyphen, then the folder's existing slug, unchanged. WS-N numbering is per-project: DownloadAlbum's WS-13 and Praxis-Dashboard's WS-13 are different workstreams, and each folder must take the ID from its own project's record file. Never carry a mapping across project boundaries."
  gotcha: |-
    Exact current-slug → WS-N mapping, read from each folder's own record file this session.
    Praxis-Dashboard (/Users/akoukoullis/Work/AK/Praxis-Dashboard/flowcharge/workstreams/) — board-severity-cue=WS-9, board-sort-by-date=WS-10, board-sort-by-severity=WS-8, card-dependency-highlighting=WS-25, card-detail-modal-issues-tasks=WS-5, card-total-counts-non-task-lines=WS-17, detail-modal-artefact-order-by-id=WS-20, detail-modal-tags-dates-severity=WS-13, git-branch-display=WS-6, heading-font-fraunces=WS-24, inline-css-extraction=WS-4, live-board-refresh=WS-7, multi-project-home-page=WS-3, plan-artefact-not-readable=WS-21, plan-markdown-table-rendering=WS-26, plan-tab-truncation=WS-23, project-delete-and-rename=WS-19, project-tile-folder-modified-date=WS-29, project-tile-icon-buttons=WS-22, server-bind-beyond-loopback=WS-18, severity-sort-direction-semantics=WS-14, sort-button-severity-cue=WS-11, src-dist-build-layout=WS-2, task-count-vs-tasks-tab-mismatch=WS-15, tasklist-fence-scanner-data-loss=WS-16, typescript-source-conversion=WS-1, workstream-folder-ws-prefix-across-projects=WS-30.
    DownloadAlbum (/Users/akoukoullis/Work/AK/DownloadAlbum/flowcharge/workstreams/) — download-album-list-recompression=WS-13, download-album-list-runner=WS-12, download-album-list-tagging=WS-14, download-album-v2=WS-11, minichrome-recompression-pipeline=WS-4, monochrome-browser=WS-6, monochrome-downloader=WS-7, monochrome-metadata=WS-8, monochrome-volume-layout=WS-2, python-mirror-downloader=WS-5, tiddl-batch-downloader=WS-3, tiddl-cli-setup=WS-1, plus the two exceptions below.
    Two DownloadAlbum exceptions — monochrome-precoding-research=WS-10 and monochrome-remediation=WS-9 have NO workstream.md at all, only a tasklist.md, so their WS-N must be read from that file's `id:` key. Those two tasklist.md files carry non-standard frontmatter (`type: workstream` inside a file named tasklist.md, a `status: active` value outside the Praxis status enum, and an extra `project: mirror-dl` key). Out of scope — do not fix or normalise that frontmatter, and do not raise a task for it. It is a pre-existing data-quality issue in a project this workstream owns no edits to beyond the folder rename.
    `workstream-folder-ws-prefix-across-projects` (WS-30) is this very workstream, holding this task list (TL-29) — renaming it mid-execution changes its own file paths too. That is expected and correct, not a bug, since Praxis cross-references artefacts by ID (WS-N/IL-N/TL-N/ISS-N), never by literal folder path.
    Re-verify each id: against the live record file immediately before moving that folder, in case another change has landed since this task list was authored. No file content inside any folder needs editing — `mv` alone is sufficient.
  verify:
    - "For each project root, list its workstream folders: `ls /Users/akoukoullis/Work/AK/Praxis-Dashboard/flowcharge/workstreams/` and `ls /Users/akoukoullis/Work/AK/DownloadAlbum/flowcharge/workstreams/`."
    - "Confirm from each listing that NO bare-slug folder remains — every entry matches `WS-<number>-*`. Any leftover entry without the prefix is a missed rename."
    - "Confirm from the same listings that each expected `WS-N-<slug>` folder now exists, and that the folder count per project is unchanged from before the renames (27 for Praxis-Dashboard, 14 for DownloadAlbum) — a changed count means a folder was lost or duplicated instead of renamed."
    - "Confirm each renamed folder's record file still reports the ID that its new folder name carries, e.g. by reading the `id:` key back out of each `WS-N-<slug>/workstream.md` (or `tasklist.md` for the two DownloadAlbum exceptions) and comparing it to the prefix."
    - "Optional sanity check only: run `npm run build` in Praxis-Dashboard. No source file is expected to change in this task, so this only confirms nothing else broke."
  checklist:
    - "Every bare-slug folder in both project roots is renamed to WS-N-<slug> using its own recorded WS-N, with the slug portion unchanged"
    - "Each project's live workstream listing was re-checked before renaming, rather than relying only on the mapping recorded in gotcha"
    - "No folder's WS-N was guessed or carried across project boundaries — each was read from that folder's own workstream.md, or tasklist.md for the two DownloadAlbum exceptions"
    - "The two DownloadAlbum files with non-standard frontmatter were renamed but their frontmatter was left untouched"
    - "No file content inside any renamed folder was altered, and the per-project folder count is unchanged"
    - "The index generator was run once per affected project root after that project's renames"
  self_eval:
    passed: true
    failures: []
    notes:
      - "DownloadAlbum needed no renames: its live listing held 28 folders, all already WS-N-<slug>, including all 14 named in gotcha. Recorded as already applied, not skipped."
      - "The two DownloadAlbum exception folders now hold workstream.md, not the tasklist.md described in gotcha. Their ids (WS-10, WS-9) match their folder prefixes. Frontmatter left untouched."
      - "Praxis-Dashboard held 29 folders, not the 27 in gotcha: WS-27-detail-modal-live-refresh and WS-28-lean-framework-migration were already prefixed. The 27 bare-slug folders matched the gotcha mapping exactly. Count is 29 before and after."
      - "The other six registered projects (LAD, Praxis, lad-poc, Praxis-Launch, Praxis-Website, Praxis-Demo) were re-scanned this session and hold zero bare-slug folders."
  ```

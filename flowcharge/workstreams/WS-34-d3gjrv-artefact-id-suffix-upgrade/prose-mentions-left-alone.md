# Prose mentions deliberately left alone — all six migrated projects

This is a plain record, written in Phase 7 of `WS-34-d3gjrv`. It carries no frontmatter
and no artefact id, so the index generator does not read it as an artefact.

It answers acceptance criterion 11 in one place: for each of the six migrated projects,
how many old-shape id mentions the mechanical rewrite could not reach, how many of those
were rewritten by hand, how many were deliberately left alone, and why. The authoritative
per-project detail stays in each project's own
`flowcharge/id-migration-2026-08-17-prose-review.md`, under its `## Resolution` section.
Nothing here replaces those files.

## Why any mention is left alone at all

The migration script rewrites structured identity only: frontmatter `id`, `workstream`,
`depends_on`, `links` and `issues` keys at column 1, plus the `ISS-N` id at the head of an
issue-list checkbox line. Everything else that names an id is prose. The script never
rewrites prose automatically. It emits a report instead, bucketed `In-map` (the id belongs
to this project's own map) and `Not-in-map` (it does not).

Two rules govern the review, and both were applied in every project:

1. Rewrite only structured identity and cross-reference data that the column-1 anchor
   could not reach — an indented `id:`, `issues:`, `tasks:` or `depends_on:` key, or a
   block-sequence element under one, inside a YAML fence. Leaving these would let an
   artefact's own identity disagree with the checkbox id already rewritten, and would
   leave live cross-references pointing at ids that no longer exist.
2. Leave every narrative or free-text mention alone, In-map or Not-in-map. A sentence
   recording why a workstream was superseded, what an earlier decision was, or how two
   pieces of work relate is historical record, not identity data. Being in-map does not
   make rewriting it safe.

This follows the `Praxis` project's own precedent, which left roughly 83 prose mentions
untouched for the same reason.

## Totals across the six projects

| Project | Occurrences | Rewritten | Left alone |
|---|---:|---:|---:|
| Praxis-Demo | 6 | 3 | 3 |
| Praxis-Launch | 82 | 4 | 78 |
| lad-poc | 695 | 26 | 669 |
| Praxis-Board | 1145 | 18 | 1127 |
| DownloadAlbum | 1636 | 174 | 1462 |
| LAD | 7988 | 2690 | 5298 |
| **Total** | **11552** | **2915** | **8637** |

Every occurrence in all six reports is accounted for. No entry is unresolved.

## Praxis-Demo — 3 left alone

Three free-text prose mentions. The three rewrites were issue-block `id:` lines that had
come to disagree with their own checkbox ids.

## Praxis-Launch — 78 left alone

- 47 In-map free-text prose mentions, which the mapping table in the record already
  resolves.
- 31 Not-in-map mentions, every one citing the separate `Praxis` project's own `WS-4`,
  `WS-5`, `WS-32` or `WS-34`. Rewriting a foreign project's id is the precise failure the
  two-bucket design exists to prevent.

The 4 rewrites were not id mentions at all. They were stale filesystem paths naming a
folder that the rename stage had already moved.

## lad-poc — 669 left alone

- 610 In-map free-text prose mentions.
- 59 Not-in-map mentions.

## Praxis-Board — 1127 left alone

- 6 TypeScript code comments reading `id: string;  // IL-1 / TL-5` and `// ISS-1`, inside
  interface declarations in a code block. The ids are illustrative examples in a trailing
  comment. They are not artefact identity and nothing resolves them.
- 928 In-map free-text prose mentions, in three sub-cases:
  1. Historical reasoning, such as a line recording what an earlier workstream decided at
     the time. Rewriting it would restate history in ids that did not exist then.
  2. 144 occurrences inside this workstream's own `baselines/` files. Those files exist to
     record the estate before migration. Rewriting their ids would destroy the only thing
     they are for.
  3. Test literals, such as `['WS-5',true]` inside a `node -e` assertion. That is a test
     input, not a reference.
- 193 Not-in-map mentions: LAD ids cited as test fixtures, `WS-31` belonging to
  Praxis-Launch, and deliberately invalid negative-test literals such as `WS-99` and
  `ISS-999`.

Count note: the Praxis-Board report's own left-alone sub-headings read 6, 922 and 193,
which sum to 1121 rather than 1127. The bucket headings and the entry counts agree exactly
(952 In-map, 193 Not-in-map, 1145 total), and 18 occurrences were rewritten, so the
In-map free-text figure is 928 and the left-alone total is 1127. The `922` in that report
is a six-count slip in a sub-heading only. No entry is missing or unreviewed.

## DownloadAlbum — 1462 left alone

- 1425 In-map free-text prose mentions.
- 37 Not-in-map mentions, every one quoted inside `WS-28`'s own historical record of
  orphaned markers. Rewriting those ids would falsify the finding that records them.

## LAD — 5298 left alone

- 4439 In-map free-text mentions: 1801 in narrative body text, 1244 in markdown list items
  and checkbox titles, and the remainder inside free-text keys (`notes:`, `description:`,
  `gotcha:`, `compatibility:`, `reason:`, `fix:` and smaller counts elsewhere). Six
  narrative bullets that happen to open with an id sit under `checklist:`, `verify:`,
  `implement:` or no key at all, never under a structured cross-reference key, so they were
  left alone too.
- 859 Not-in-map mentions, every one an `ISS` id with no artefact in the project: 78
  distinct ids, led by `ISS-1`, `ISS-2`, `ISS-3`, `ISS-5`, `ISS-6` and `ISS-4`. They are
  AK-era issue numbers quoted inside historical records and shell fixtures. Rewriting them
  would point them at ids that do not exist.

LAD's rewrite ratio is higher than the other five (37.7 percent of its In-map bucket)
because structured cross-references scale with issue count while narrative prose does not.
LAD holds 829 `ISS` items against DownloadAlbum's 39. Per issue LAD is in fact lighter.
The classifier used was validated against the completed phases first: over lad-poc's report
it selects exactly the 26 occurrences Phase 5 rewrote, and over DownloadAlbum's report it
selects the same 18 files and the same line set.

## Two things left alone that are not prose

Both are recorded here so they are not rediscovered as defects of this migration.

1. **Unmatched claim markers.** Five bare markers survive across the estate:
   `PLN-24` and `WS-31` in Praxis-Board, `PLN-36` and `WS-185` in LAD, and `IL-2` in
   lad-poc. Each has no map entry, each is listed in its project's mapping record as
   unmatched, and none was renamed or deleted. This is the plan's stated option (a).
   Open question 2, which asks whether to delete them instead, is still unanswered.
2. **A pre-existing LAD data defect.** Two different issues in two different LAD
   workstreams were both numbered `ISS-497`. One old id maps to one new id, so both
   received the same suffix, and `--check` now reports `duplicate issue id ISS-497-a671v8`.
   The collision predates this migration and is already recorded at
   `flowcharge-pre-migration-2026-08-17/index.md:459`. Repairing it means renumbering one
   of the two issues, which is outside this migration's scope.

## Backups

No `flowcharge-pre-migration-2026-08-17/` backup was deleted. All six still exist. For
lad-poc, Praxis-Launch and Praxis-Demo they are the only rollback path, because those three
are not git repositories. For Praxis-Board, LAD and DownloadAlbum, `flowcharge/` is gitignored,
so git restores nothing under it and the backup is the only rollback path there too.

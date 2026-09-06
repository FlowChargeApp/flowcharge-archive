---
id: WS-69-m06s86
type: workstream
workstream: WS-69-m06s86
slug: flowcharge-prefix-compatibility
title: "The Dashboard reads flowcharge paths and workstream.md filenames that the FlowCharge rename replaces"
description: "The Praxis suite is renaming itself to FlowCharge. Its data folder flowcharge/ becomes flowcharge/, and the per-file prx prefix is dropped, so workstream.md becomes workstream.md and plan.md, issuelist.md and tasklist.md lose their prefix too. The Dashboard reads all of these names directly, so every project it scans stops resolving the moment that rename lands. This workstream tracks making the Dashboard read the new names."
status: done
tags: [flowcharge, parser, extraction, compatibility, feature]
created: 2026-08-26
updated: 2026-08-27
author: Anthony Koukoullis
depends_on: []
links: []
---
The Dashboard resolves every project by names that the FlowCharge rename is about to replace, so scanning breaks the moment that rename lands.

The Praxis suite registered the public product name FlowCharge on 2026-08-26 and renamed its own branding in `WS-78-l3cdjy`, merged at commit `28fa19d` in `/Users/akoukoullis/Work/AK/Praxis`. A follow-up workstream there, `WS-80-vuez4i` with plan `PLN-57-5wgpp6`, now renames the `prx` prefix itself. The maintainer asked for this record to be opened here so the Dashboard side is tracked. Do not expand it yet — the maintainer will scope and plan it separately.

## What changes on the Praxis side

- The data folder `flowcharge/` becomes `flowcharge/`.
- The per-file prefix is dropped, not renamed. `workstream.md` becomes `workstream.md`; `plan.md`, `issuelist.md` and `tasklist.md` become `plan.md`, `issuelist.md` and `tasklist.md`, keeping the `<id>-` filename prefix the naming contract already requires; `index.md`, `kanban.md`, `ids.md`, `tags.md` and `agents.md` become `index.md`, `kanban.md`, `ids.md`, `tags.md` and `agents.md`; `.lease` becomes `.lease`.
- The eight `prx-` skill folders and their command names become `fc-`.
- Artefact ID shapes do not change. `WS-N-SUFFIX`, `PLN`, `IL`, `TL` and `ISS` all stay exactly as they are.

## Measured coupling in this repository, at commit b9fe85b

`grep -rno` across `src/`, `tools/` and `electron/` finds 41 occurrences in 22 files:

- `flowcharge` — 29 occurrences. The folder every project scan starts from.
- `workstream` — 6 occurrences. Two of them are the sites the Praxis suite's own `CONVENTIONS.md` records as locate-and-skip: `src/lib/extract.ts:124` and `:133`, plus `src/lib/detail.ts:195` and `:201`.
- `plan`, `issuelist`, `tasklist` — 2 occurrences each.

`dist/` carries the same names, but it is build output and is regenerated rather than edited.

`.praxis-projects.json` at the repository root registers the scanned projects by absolute path, including `/Users/akoukoullis/Work/AK/Praxis` itself. Check whether anything in it or its loader also keys on the old names.

## The compatibility question this workstream must answer

The Dashboard scans several projects at once, and they will not migrate on the same day. Decide whether it reads the new names only, or reads both the old and the new names for a period. The Praxis suite's own generator already has a precedent worth reading: it indexes an artefact carrying a legacy bare filename and WARNs, rather than refusing it.

## Timing

The Praxis-side rename merges before `WS-74-ujlkon` publishes a public history there. The breakage in this repository starts at that merge commit, not before.

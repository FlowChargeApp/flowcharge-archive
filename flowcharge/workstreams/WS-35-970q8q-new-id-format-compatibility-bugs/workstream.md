---
id: WS-35-970q8q
type: workstream
workstream: WS-35-970q8q
slug: new-id-format-compatibility-bugs
title: "Fix this dashboard's code so it reads the new TYPE-N-SUFFIX artefact ID shape"
status: done
created: 2026-08-16
updated: 2026-08-17
depends_on: []
links: []
tags: [bug, ids, compatibility]
---
Split out from WS-34-d3gjrv-artefact-id-suffix-upgrade, whose plan (PLN-25-0agr4z) found that this dashboard's own code cannot correctly read the new Praxis artefact ID shape (`TYPE-N-SUFFIX`, e.g. `WS-16-a3x9k2`) that the shared `prx-orchestrate` tooling now generates. Three real bugs were found and verified during that plan's investigation:

1. `src/server.ts` validates a workstream id against `/^WS-\d+$/`, so any request naming a new-format workstream id is rejected with HTTP 400.
2. `src/lib/extract.ts` parses an issue's checkbox line against a pattern requiring the old `ISS-\d+\.` shape, so a migrated issue's checkbox is not recognised at all — the issue silently disappears from the extracted data, with no error.
3. `src/lib/extract.ts`'s `artefactIdNumber` (used for numeric sort/comparison) reads the number after the ID's last hyphen, which is correct for `TYPE-N` but wrong for `TYPE-N-SUFFIX` — it reads the suffix's trailing digits instead of the real sequence number, giving a wrong but plausible-looking sort order with no error.

This is standalone code-fix value: these bugs matter regardless of the artefact-ID-migration workstream's own timeline, since `Praxis` and `Praxis-Website` are already migrated and any dashboard user pointing at either project today is already hitting these bugs.

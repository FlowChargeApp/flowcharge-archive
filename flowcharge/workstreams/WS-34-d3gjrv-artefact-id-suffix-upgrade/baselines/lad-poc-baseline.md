# lad-poc baseline — captured before the Phase 5 migration

Captured 2026-08-17 by task 5.1, before any dry run.
Source: dist/scripts/extract-praxis-data.js, the dashboard's own extraction path.
The --check output is saved alongside as lad-poc-check.txt (0 errors, 27 warnings, exit 2).

- Workstream count: 6
- Issue count: 7
- Artefact count: 19 (6 WS, 5 PLN, 1 IL, 7 TL)
- Claim markers: 24 under flowcharge/ids/
- Files under flowcharge/: 24
- Not a git repository, so the pre-migration backup is the only rollback path.

## Workstream order, as the dashboard renders it

1. WS-1 — Proof of concept — can an MCP server hand prompts to the client's model? [done]
2. WS-2 — Second proof of concept — does obedience hold on a long prompt and a long conversation? [in-progress]
3. WS-3 — Third proof of concept — small instructions that name local files, not embedded documents [done]
4. WS-4 — Make the architecture MCP tool match the real service, on real documents [done]
5. WS-5 — Prove the fixed architecture tool runs clean, once [in-progress]
6. WS-6 — Refactor the architecture prompt to reference files instead of embedding them [in-progress]

## Artefact order within each workstream

### WS-1
1. PLN-1 (plan, done)
2. TL-1 (tasklist, done, 25/26)

### WS-2
1. PLN-2 (plan, ready)
2. TL-2 (tasklist, in-progress, 20/29)
3. TL-3 (tasklist, done, 3/3)

### WS-3
1. PLN-3 (plan, ready)
2. TL-4 (tasklist, done, 18/28)

### WS-4
1. IL-1 (issuelist, done, 7/7)
2. TL-5 (tasklist, done, 24/24)

### WS-5
1. PLN-4 (plan, ready)
2. TL-6 (tasklist, in-progress, 3/9)

### WS-6
1. PLN-5 (plan, ready)
2. TL-7 (tasklist, ready, 4/5)

## Issue order

1. ISS-1 — Architecture tool runs on invented fixture documents instead of real LAD output [high, done]
2. ISS-2 — Guidance packs are hardcoded, so the layer-details document that selects them is never read [high, done]
3. ISS-3 — Brief fixture is Markdown, so the enhanced-else-original precedence is never exercised [medium, done]
4. ISS-4 — Existing architecture is read from a fixture path, not from the monorepo root [medium, done]
5. ISS-5 — featureName and the manifest are absent from the tool's inputs [medium, done]
6. ISS-6 — The assembly gates pass without ever comparing the assembled text to the reference service's prompt [high, dropped]
7. ISS-7 — WS-3 measures a modified copy of the shipping setup prompt [medium, done]

All seven belong to WS-4.

## Folder layout

- flowcharge/workstreams/WS-1-mcp-oracle-proof-of-concept/
- flowcharge/workstreams/WS-2-architecture-prompt-fidelity/
- flowcharge/workstreams/WS-3-instruction-sized-delivery/
- flowcharge/workstreams/WS-4-architecture-tool-fidelity/
- flowcharge/workstreams/WS-5-architecture-tool-smoke-run/
- flowcharge/workstreams/WS-6-architecture-prompt-file-references/

## Claim markers

IL-1, IL-2, ISS-1..ISS-7, PLN-2..PLN-5, TL-2..TL-7, WS-2..WS-6 (24 in total).
PLN-1, TL-1 and WS-1 have no marker. IL-2 has a marker but no artefact.

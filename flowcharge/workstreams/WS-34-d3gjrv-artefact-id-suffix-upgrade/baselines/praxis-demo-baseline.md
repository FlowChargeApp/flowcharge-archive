# Praxis-Demo baseline — captured before the Phase 2 migration

Captured 2026-08-17 by task 2.3, before any dry run.
Source: dist/scripts/extract-praxis-data.js, the dashboard own extraction path.
The --check output is saved alongside as praxis-demo-check.txt.

- Workstream count: 8
- Issue count: 3

## Workstream order, as the dashboard renders it

1. WS-1 — Fix pagination bug in the reports API [in-progress]
2. WS-2 — Add dark mode to the settings page [ready]
3. WS-3 — Replace the legacy CSV importer [backlog]
4. WS-4 — Cut cold-start time on the search worker [in-progress]
5. WS-5 — Rotate the expiring signing keys [blocked]
6. WS-6 — Add rate limiting to the public API [done]
7. WS-7 — Ship the audit log export [done]
8. WS-8 — Migrate the mailer to the new template engine [dropped]

## Artefact order within each workstream

### WS-1
1. PLN-1 (plan)
2. IL-1 (issuelist)
3. TL-1 (tasklist)

### WS-2
- (none listed)

### WS-3
- (none listed)

### WS-4
1. PLN-2 (plan)

### WS-5
- (none listed)

### WS-6
- (none listed)

### WS-7
- (none listed)

### WS-8
- (none listed)

## Issue order

1. ISS-1 — Second page repeats a row when timestamps tie
2. ISS-2 — A malformed cursor returns a 500 instead of a clear error
3. ISS-3 — The deprecated offset parameter is still undocumented as deprecated

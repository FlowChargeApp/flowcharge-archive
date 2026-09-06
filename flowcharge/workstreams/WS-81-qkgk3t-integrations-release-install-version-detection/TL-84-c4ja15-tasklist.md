---
id: TL-84-c4ja15
type: tasklist
workstream: WS-81-qkgk3t
slug: integrations-release-install-version-detection
title: "Repair the stale FlowCharge Core git ref"
status: done
created: 2026-08-30
updated: 2026-08-30
author: Anthony Koukoullis
depends_on: [IL-12-r4zsp2]
links: []
mode: spec
base_commit: 2046996
---

# PRX Tasks

## Manage Integrations install repair

The sibling FlowCharge Core repository renamed its default branch from `master` to
`main` on 2026-08-25, and it renamed its shipped skill folders from `prx-*` to `fc-*`.
This dashboard was never updated for either rename. This list carries the production
half of the repair.

`PRAXIS_REPO_REF` in `src/lib/skill-content-fetch.ts` still holds the literal
`'master'`. `getInstallContent` passes it to `buildArchiveUrl`, so every Manage
Integrations install requests `.../archive/master.tar.gz` and gets HTTP 404. The
failure hits all four catalogue tools, both scopes, and both transports, because both
transports call the same `getInstallContent`. A live probe at authoring time confirms
the state: `master.tar.gz` returns 404 and `main.tar.gz` returns HTTP 200 with 160385
bytes.

The live integration test in `src/lib/skill-content-fetch.test.ts` asserts the old
`prx-*` skill ids, so it fails today on the 404 and would still fail after the ref fix.
That test is not repaired here. `TL-83-qg4zjp` task 1.13 rebuilds the same tier (c)
section for the release-based download, unzip, install and delete design that
`PLN-72-ph4oel` specifies, and that rebuild already covers the stale ids. See
Divergence 3.

This list therefore holds one task. Task 1.1 fixes production behaviour. The test that
proves it is realigned by `TL-83-qg4zjp` task 1.13.

- [x] 1. Realign the dashboard with the renamed FlowCharge Core repository

  ```yaml
  description: "Point the skill archive fetch at the renamed default branch."
  ```

  - [x] 1.1 Point `PRAXIS_REPO_REF` at the `main` branch
    ```yaml
    description: "Change the PRAXIS_REPO_REF constant in src/lib/skill-content-fetch.ts from the stale 'master' to 'main', so buildArchiveUrl produces a URL that exists."
    author: Anthony Koukoullis
    issues: [ISS-23-22bcfg]
    implement:
      - "Open src/lib/skill-content-fetch.ts and locate the exported constant PRAXIS_REPO_REF, which sits directly below PRAXIS_REPO_BASE_URL near line 39."
      - "Apply this single mechanical edit. The SEARCH text was copied from the file as read in this session at commit 2046996."
      - |
        src/lib/skill-content-fetch.ts
        <<<<<<< SEARCH
        export const PRAXIS_REPO_REF = 'master';
        =======
        export const PRAXIS_REPO_REF = 'main';
        >>>>>>> REPLACE
      - "Change nothing else. Do not touch PRAXIS_REPO_BASE_URL, buildArchiveUrl, or getInstallContent."
    pattern: "src/lib/skill-content-fetch.ts, the module-level constant block at lines 36-39."
    imports: "None. This is a string literal change with no new import."
    compatibility: "buildArchiveUrl(baseUrl, ref) builds `${baseUrl}/archive/${ref}.tar.gz`, so the constant must stay a bare ref name with no leading slash and no .tar.gz suffix. The archive's single top-level directory is stripped generically by getInstallContent, so the folder name change from praxis-master/ to praxis/ needs no code change."
    gotcha: "The constant is also named in the file's header comment at line 18, which says the ref tracks the branch's moving tip. That sentence stays true for 'main' and needs no edit. The value is compiled in with no setting or environment override, so a rebuild is required before any runtime check. See Divergence 1 for the exact line the issue cites."
    verify:
      - "Run `grep -n \"PRAXIS_REPO_REF = \" src/lib/skill-content-fetch.ts` and confirm the single result reads `export const PRAXIS_REPO_REF = 'main';`."
      - "Run `npx tsc -p tsconfig.json` and confirm it exits 0 with no diagnostics. This is the project's own type-check for this module, and it emits dist/lib/skill-content-fetch.js."
      - "Probe the built URL directly with `curl -s -o /dev/null -w '%{http_code}\\n' http://100.87.185.97:8110/akoukoullis/Praxis/archive/main.tar.gz` and confirm it prints 200, where the old master URL printed 404."
      - "Carry the issue's own reproduction: run `npm start`, open the Manage Integrations dialog, select the claude-code catalogue tool in the Project scope, and click 'Install selected'. Confirm no alert appears and the row reports success. Use a scratch project directory for the Project scope, because a successful install writes files into the chosen scope."
    checklist:
      - "Does `grep -n \"PRAXIS_REPO_REF = \" src/lib/skill-content-fetch.ts` return exactly one line, and does it hold 'main'?"
      - "Does the literal 'master' no longer appear anywhere in src/lib/skill-content-fetch.ts?"
      - "Does `npx tsc -p tsconfig.json` exit 0?"
      - "Does the constant remain a bare ref name, with no leading slash and no .tar.gz suffix?"
      - "Are PRAXIS_REPO_BASE_URL, buildArchiveUrl, and getInstallContent unchanged?"
      - "Does a live GET of the main archive URL return HTTP 200?"
    self_eval:
      passed: true
      failures: []
    ```

## Divergences

1. **ISS-23-22bcfg cites a two-line range for a one-line constant.** The issue places
   `PRAXIS_REPO_REF` at `src/lib/skill-content-fetch.ts:38-39`. The live file at commit
   `2046996` holds `PRAXIS_REPO_BASE_URL` on line 38 and `PRAXIS_REPO_REF` on line 39.
   Only line 39 is the target. The issue's other citations verified correct against the
   live file: `buildArchiveUrl` at lines 50-52 and the `getInstallContent` call site at
   line 224. This changed no task, and task 1.1 edits line 39 only.

2. **ISS-24-4rf1rr understates the stale test's scope.** The issue names only the
   `EXPECTED_IDS` constant at `src/lib/skill-content-fetch.test.ts:100-109`. The live
   file at commit `2046996` shows the same live-network case also hardcodes
   `prx-orchestrate` in its `skills.find` predicate at line 124, in its throw message at
   line 125, in its test name at line 111, and `scripts/prx-index.mjs` in its
   `expectedFiles` array at line 139. A direct listing of the fetched `main.tar.gz` also
   shows `fc-orchestrate` now ships `scripts/fc-rename-artefacts.mjs`, which
   `expectedFiles` does not list at all. Fixing only `EXPECTED_IDS` would leave the case
   failing on `expectedFiles`. The repair therefore covers the whole tier (c) section,
   not just the constant the issue names. No task here carries it, per Divergence 3.

3. **Task 1.2 was dropped in favour of `TL-83-qg4zjp` task 1.13.** This list originally
   held a second child task, 1.2, which realigned the tier (c) live-network test in
   `src/lib/skill-content-fetch.test.ts` for `ISS-24-4rf1rr`. `TL-83-qg4zjp` task 1.13
   rewrites the same tier (c) block, at lines 98-148 of the same file, for the
   release-based download, unzip, install and delete design in `PLN-72-ph4oel`. Its own
   scope statement already replaces the stale `prx-*` ids, the `prx-orchestrate` lookups
   and the nested-file list, reading them from the live release asset. Two tasks
   rewriting one section would conflict, so task 1.2 and its content block were removed
   from this file. `ISS-24-4rf1rr` now names `TL-83-qg4zjp task 1.13` in its `tasks` key
   and stays `in-progress`. Task 1.1 is unaffected and is the only task left here.

Every other file and line the two issues cite matched the live repository at commit
`2046996`.

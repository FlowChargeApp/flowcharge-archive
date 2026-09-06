---
id: TL-97-2j5zyi
type: tasklist
workstream: WS-96-yquwwu
slug: board-title-folder-path-not-name
title: "Board breadcrumb title from the registry name"
status: done
created: 2026-09-06
updated: 2026-09-06
author: Anthony Koukoullis
depends_on: [IL-14-3tf64p]
links: []
mode: spec
base_commit: 8268522
---

# FlowCharge Tasks

## Board breadcrumb title from the registry name

The board's breadcrumb title is folder-derived. `src/public/app.ts` sets
`byId('board-title').textContent` from `raw.source.split('/').pop()`, where `raw.source` is
the absolute project folder path that `extractPraxisData()` puts in the payload. The project
registry (`.praxis-projects.json`, owned by `src/lib/projects.ts`) holds a separate, editable
`name` per project, and the Projects list renders that field. The board therefore shows the
wrong name whenever a registry rename has moved `name` away from the folder basename.

The fix carries the registry name to the board on the payload the board already fetches. The
route `GET /api/projects/:id/data` in `src/server.ts` already has the registry entry in hand
and already composes the response as the extractor's payload plus one transport-layer field
(`branch`). One more field of the same kind, `name`, closes the gap with no second request,
no client-side registry lookup, and no change to the pure extractor. `src/lib/extract.ts`
stays untouched: it knows nothing about the registry, and `PraxisData` stays exactly what
`npm run refresh` dumps.

Three files change: the shared type declaration, the route that composes the payload, and the
one line in the board that reads it. The children below are ordered — the type must widen
before the two readers of it compile.

- [x] 1. Board title reads the registry name

  ```yaml
  description: "Carry the project registry name on the board payload and render it as the breadcrumb title, in place of the folder-derived name."
  ```

  - [x] 1.1 Widen `BoardPayload` with the registry name
    ```yaml
    description: "Add a name field to the BoardPayload interface so the route and the board agree on the new field."
    author: Anthony Koukoullis
    issues: [ISS-27-bysm0j]
    implement:
      - "In src/types/praxis-data.d.ts, at the `interface BoardPayload extends PraxisData` declaration (it currently holds only `branch: string | null;`), add a required `name: string;` member. Required, not optional: the one route that builds this payload always has the registry entry in hand, and an optional field would push a needless undefined check into the board."
      - "Extend the comment block directly above that interface — it already says the interface is 'the extractor's payload plus the fields the server adds at the transport layer' — to note that `name` is the registry display name, not anything the extractor produces."
      - "Do NOT add `name` to `PraxisData`. That interface is what extractPraxisData() returns and what `npm run refresh` dumps to disk; the extractor has no access to the registry."
    pattern: "src/types/praxis-data.d.ts — the BoardPayload interface only."
    imports: "None. This file is an ambient global declaration file: it has no top-level import or export, and adding one would turn it into a module and un-globalise every interface in it. The file's own header comment states this."
    compatibility: "The file is consumed by two separate TypeScript compilations that share no import graph: the root tsconfig.json (Node side, src/server.ts) and src/public/tsconfig.json, whose `include` array lists `../types/praxis-data.d.ts` explicitly. Both must keep compiling. src/public/tsconfig.json sets `strict: true` and `types: []`, so no @types/node global is available on the browser side — keep the new member to plain `string`."
    gotcha: "Adding a REQUIRED member to BoardPayload makes every object literal typed as BoardPayload incomplete until task 1.2 lands. At base_commit the only such literal is the `const payload: BoardPayload = ...` line inside the /api/projects/:id/data handler in src/server.ts, so the root type-check is expected to FAIL between this task and 1.2. That is the intended ordering, not a defect — run 1.2 before judging the root type-check. ProjectEntry in this same file already declares its own `name: string;`, so a bare grep for `name: string` in this file is not specific to BoardPayload."
    verify:
      - "Confirm the field landed in the right interface: `sed -n '/^interface BoardPayload/,/^}/p' src/types/praxis-data.d.ts | grep -c 'name: string'`. This returned 0 at base_commit 8268522; it must return 1 after the change."
      - "Confirm the browser-side compilation still type-checks on its own: `npx tsc -p src/public/tsconfig.json` exits 0. That config sets `noEmit: true`, so this is a pure check. It also exited 0 at base_commit, so it does not by itself prove the change — it proves the change broke nothing in the public graph, and the grep above is what discriminates."
    checklist:
      - "BoardPayload declares a required `name: string` member, and PraxisData does not."
      - "The file still contains no top-level import or export statement, so its interfaces remain global."
      - "The browser-side type-check (src/public/tsconfig.json) exits 0."
      - "ProjectEntry, PraxisData and every other interface in the file are unchanged."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 Put the registry name on the board route's response
    ```yaml
    description: "Add the registry entry's name to the BoardPayload the GET /api/projects/:id/data handler sends."
    author: Anthony Koukoullis
    issues: [ISS-27-bysm0j]
    implement:
      - "In src/server.ts, inside the `dataMatch` branch (the handler for `/^\\/api\\/projects\\/([^/]+)\\/data$/`), find the single line that composes the response: `const payload: BoardPayload = { ...extractPraxisData(entry.path), branch: readBranch(entry.path) };`. Add `name: entry.name` to that object literal, alongside `branch`."
      - "Place `name` in the same position the interface declares it, so the literal reads as the extractor spread followed by the two transport-layer fields. `entry` is the ProjectEntry already returned by `findProject(id)` a few lines above and already null-checked with the 404 return, so no extra lookup and no extra guard is needed."
      - "Change nothing else in the handler: the 404 for an unknown id, the 410 for a missing workstream tree, the warnLegacyLayout call and the 500 catch all stay exactly as they are."
    pattern: "src/server.ts — the `dataMatch` route handler only. No other route, and no change to src/lib/projects.ts or src/lib/extract.ts."
    imports: "None new. `findProject` is already imported at the top of src/server.ts from './lib/projects.js', and BoardPayload is an ambient global from src/types/praxis-data.d.ts."
    compatibility: "This one route feeds BOTH front ends. src/public/browser-ipc-shim.ts implements getProjectData as a fetch of this exact path, and electron/ipc-handlers.cts implements the 'getProjectData' ipcMain handler as a loopback HTTP request to the same path — it is a pure relay that adds and validates nothing. So the field reaches the browser build and the Electron build from this single edit; do not add a parallel field anywhere in electron/. The registry `name` is already constrained at the PATCH /api/projects/:id boundary in this same file: trimmed, non-empty, at most MAX_NAME_LENGTH (100) characters, and rejected if it contains control characters. A name is therefore always a non-empty single line of text by the time it reaches here."
    gotcha: "A registry entry written before those PATCH rules existed, or edited by hand in .praxis-projects.json, can still carry an empty or malformed name — the read path in src/lib/projects.ts does not re-validate. Do NOT add validation or a fallback here; the display fallback belongs in the board (task 1.3), which is where an empty name has a visible consequence. Also note `extractPraxisData()` already puts the absolute folder path on the payload as `source`; leave it in place, other than the board title nothing is being changed about it."
    verify:
      - "Confirm the field is on the payload literal: `grep -c 'name: entry.name' src/server.ts`. This returned 0 at base_commit 8268522; it must return 1 after the change."
      - "Confirm the Node-side compilation type-checks, which is also what proves 1.1's required member is now satisfied: `npx tsc -p tsconfig.json --noEmit` exits 0. This exited 0 at base_commit too, so on its own it does not discriminate — after 1.1 it is expected to FAIL until this task lands, which is what makes it meaningful in this sequence."
      - "Run the project's own suite for a regression check: `npm test`. At base_commit it passes, and src/server.test.ts covers only the /api/integrations/* routes — no case asserts on the /data response shape — so it cannot fail for a correct change here."
    checklist:
      - "GET /api/projects/:id/data returns the registry name for the requested project."
      - "No caller of the route is broken: the browser shim and the Electron relay both receive the extra field without either being edited."
      - "src/lib/extract.ts and src/lib/projects.ts are untouched, so PraxisData and `npm run refresh` output are unchanged."
      - "The route's 404, 410 and 500 behaviour is byte-for-byte what it was."
      - "`npx tsc -p tsconfig.json --noEmit` exits 0 and `npm test` passes."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Render the registry name as the breadcrumb title
    ```yaml
    description: "Set the board breadcrumb title from the payload's name field instead of the folder path in source."
    author: Anthony Koukoullis
    issues: [ISS-27-bysm0j]
    implement:
      - "In src/public/app.ts, inside `function applyData(raw: BoardPayload)`, find the title assignment that sits immediately after the `byId('gen-date').textContent = raw.generated || '—';` line and immediately before the `if (raw.branch)` block. At base_commit it reads across three lines: `byId('board-title').textContent = raw.source` / `? raw.source.split('/').pop()!` / `: 'Board'`."
      - "Replace that expression so the title comes from `raw.name`, keeping the existing 'Board' string as the fallback for a missing or empty name. Illustrative, not literal: `byId('board-title').textContent = raw.name || 'Board';`"
      - "Leave `raw.source` unread by this file afterwards. Do not delete `source` from the payload or the extractor — it is still the extractor's own record of which folder was read, and removing it is out of scope for this issue."
    pattern: "src/public/app.ts — the board title assignment inside applyData only. src/public/board.html is untouched: its `<h1 class=\"tb-title\" id=\"board-title\">Board</h1>` already carries the same 'Board' placeholder and needs no edit."
    imports: "None new. `byId` is the file's existing local helper and `applyData` already receives the typed payload."
    compatibility: "applyData is called on the initial load AND on every poll (pollOnce runs it whenever the response bytes differ), and the file's own comment states applyData must stay idempotent — a plain assignment satisfies that. Keep the file's established DOM discipline: assign textContent, never innerHTML, so a registry name is never interpreted as markup. The public compilation runs under `strict: true` with `types: []`, so no Node globals are available here."
    gotcha: "This task does not type-check until 1.1 has widened BoardPayload — `raw.name` is otherwise an error under strict mode. The `||` fallback is doing real work: task 1.2 deliberately does not re-validate a hand-edited registry, so an empty-string name must still leave the breadcrumb readable rather than blank. The non-null assertion `!` in the old expression existed only because `.pop()` can return undefined; it has no place in the replacement and must not be carried over. Note also that the old expression showed the folder BASENAME, so on a project whose registry name was never changed the visible title is identical before and after — a visual check alone cannot confirm this fix, which is why the greps below are the discriminating steps."
    verify:
      - "Confirm the folder-derived title is gone: `grep -c 'raw\\.source' src/public/app.ts`. This returned 2 at base_commit 8268522 (both occurrences in this one expression); it must return 0 after the change."
      - "Confirm the registry name is what is read: `grep -c 'raw\\.name' src/public/app.ts`. This returned 0 at base_commit 8268522; it must return 1 after the change."
      - "Confirm the browser-side type-check passes: `npx tsc -p src/public/tsconfig.json` exits 0. It exited 0 at base_commit as well, so it discriminates nothing on its own — it is here because it is the gate that catches a `raw.name` written without task 1.1."
    checklist:
      - "The breadcrumb shows the registry name for a project whose registry name differs from its folder basename."
      - "The breadcrumb shows 'Board' rather than an empty heading when the payload carries an empty name."
      - "src/public/app.ts no longer reads raw.source anywhere, and nothing else in applyData changed."
      - "The title is still set via textContent, so a name containing markup is rendered as text."
      - "applyData remains idempotent across the initial load and every poll."
    self_eval:
      passed: true
      failures: []
    ```

## Skipped

Nothing was skipped. IL-14-3tf64p holds one issue, ISS-27-bysm0j, it is open at status
`ready`, and it describes a defect in code that already exists rather than functionality the
code was never built to have.

## Divergences

1. **A fourth file is required that the issue does not name.** ISS-27-bysm0j's `affected` key
   names src/public/app.ts, src/server.ts, src/lib/projects.ts and src/public/home.ts. The
   payload contract between the route and the board is not in any of those: it is the
   `interface BoardPayload extends PraxisData` declaration in
   src/types/praxis-data.d.ts:50-52, read at 8268522, and neither the route nor the board
   compiles against a new field until that interface declares it. Task 1.1 therefore edits a
   file outside the issue's `affected` list, and it is strictly required to make the two
   in-scope edits compile.

2. **Two of the named files need no change.** src/lib/projects.ts already stores and returns
   the registry `name` on every ProjectEntry, and src/public/home.ts already renders it
   correctly (src/public/home.ts:121, `el('span', 'tile-name', p.name)`), which the issue
   itself records as working. Both are read-only context here, so no task was authored
   against either.

3. **The verify commands cannot all fail at the baseline.** Both type-checks — `npx tsc -p
   tsconfig.json --noEmit` and `npx tsc -p src/public/tsconfig.json` — were run at 8268522
   and exited 0, and `src/server.test.ts` contains no case touching
   `/api/projects/:id/data`, so `npm test` cannot fail for this defect either. Each task
   therefore leads with a measured grep whose baseline count is recorded in the step, and
   states in the type-check step itself why that step does not discriminate.

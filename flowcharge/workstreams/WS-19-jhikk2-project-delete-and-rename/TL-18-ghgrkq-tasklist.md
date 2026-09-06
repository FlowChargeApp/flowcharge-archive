---
id: TL-18-ghgrkq
type: tasklist
workstream: WS-19-jhikk2
slug: project-delete-and-rename
title: "Delete and rename registered projects from the home page"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: [PLN-14-pto0d5]
links: []
mode: spec
base_commit: 30bcdc7
---

# PRX Tasks

## Delete and rename registered projects from the home page

The home page can only add projects today. This work adds two more registry operations, each with
a server endpoint and a matching control on the tile: remove a project from the registry, and give
a project a different display name.

`src/lib/projects.ts` gains one private whole-file writer (`writeProjects`, temp file then
`fs.renameSync`) and two public operations, `removeProject(id)` and `renameProject(id, name)`.
`addProject` is repointed at the shared writer so all three write paths behave identically.
`src/server.ts` gains one end-anchored route pattern, `^/api/projects/([^/]+)$`, dispatching
`DELETE` and `PATCH` with a `405` fallthrough. `src/public/home.ts` restructures each tile from a
single `<a>` into `div.tile` holding `a.tile-link`, `div.tile-actions` and `div.tile-error`,
because a button cannot sit inside a link.

Two decisions carry the design. Rename changes the stored display `name` only: the id is
`sha1(path)` truncated to 8 hex characters, so rename never touches `path`, never touches `id`,
and never touches any file inside the project. And no new field is added: `name` is already
persisted, so `ProjectEntry` and `ProjectList` are unchanged and there is no migration.

The plan's five open questions are answered and settled. The name cap is 100 characters.
The delete confirmation uses `window.confirm`, not a styled `<dialog>`. Deleting the synthesised
self-entry is allowed, and materialises the registry as `{"projects": []}`. The one `README.md`
line describing the registry library is updated. Delete and rename both work when the project's
directory no longer exists on disk.

Out of scope, and not to be added while in there: bulk delete, multi-select, reordering,
archiving, soft-delete or undo, a settings page, changing a project's `path`, any read or write
inside a project's own `flowcharge/` folder, and any authentication, permissions or locking.

The repository has no test framework, and `package.json` defines no `lint` script. Verification is
`npm run build`, the two `tsc --noEmit` project checks, and the manual steps the plan states.

- [x] 1. Phase 1 — Delete, end to end

  ```yaml
  description: "Add the atomic registry writer, removeProject, the DELETE endpoint, and the Delete control on every tile. Delete goes first because it is the irreversible operation and it is what forces writeProjects into existence."
  ```

  - [x] 1.1 Registry write path and `removeProject` (`src/lib/projects.ts`)
    ```yaml
    description: "Add the private writeProjects helper with temp-file-then-rename, add removeProject(id), and repoint addProject at the helper so there is one writer."
    issues: []
    implement:
      - "In src/lib/projects.ts, below the `registryPath` constant and above `readProjects`, add a module-private `function writeProjects(projects: ProjectEntry[]): void`. It is not exported."
      - "writeProjects must serialise `{ projects }` as a ProjectList with `JSON.stringify(list, null, 2)` — byte-identical output to what addProject writes today — then write that string to a sibling temporary file next to registryPath and `fs.renameSync` the temporary file over registryPath."
      - "Explain in a comment why the temp file exists: fs.writeFileSync truncates first, so a half-way failure leaves a truncated registry, readProjects then fails to parse it and returns [], and the user silently loses the whole project list."
      - "Repoint the existing `addProject` (anchor: the `fs.writeFileSync(registryPath, ...)` line and the `const list: ProjectList = { projects };` line above it) at writeProjects. Same output bytes, same `{ entry, created }` return value."
      - "Add `export function removeProject(id: string): ProjectEntry | undefined`. Read the list, find the row with that id, return undefined when no row matches, otherwise remove that row, call writeProjects with the remaining rows, and return the removed entry."
      - "Let a genuine filesystem failure throw out of both writeProjects and removeProject. Do not catch it here — the server already catches for addProject."
      - "Add no fs.rm, no fs.unlink of any project path, and no recursion anywhere in this module. Nothing outside .praxis-projects.json is touched."
    pattern: "src/lib/projects.ts only. Do not edit src/server.ts, src/public/home.ts, or src/types/praxis-data.d.ts in this task."
    imports: "node:fs and node:path are already imported at the top of the file. No new import and no new dependency."
    compatibility: "The registry JSON keeps its exact current shape — same keys, same key order, two-space indent. ProjectEntry and ProjectList in src/types/praxis-data.d.ts are unchanged. The module must keep knowing nothing about HTTP status codes, request bodies, or the DOM: it returns entries and undefined."
    gotcha: "The temporary file must be a sibling of registryPath, because fs.renameSync is only atomic within one filesystem — a temp file under the OS temp directory can cross a device boundary and fail with EXDEV. removeProject must return undefined rather than throw on an unknown id; the library does not know what a 404 is. The synthesised self-entry from readProjects is a normal row here: removing it writes {\"projects\": []}, which is intended."
    verify:
      - "npm run build"
      - "npx tsc --noEmit -p tsconfig.json"
      - "Start the server, add a project through the existing form, and confirm .praxis-projects.json is identical in shape to what the old code wrote — two-space indent, same key order, keys id, name, path, added."
      - "grep -nE 'fs\\.(rm|rmSync|unlink|unlinkSync|rmdir)' src/lib/projects.ts returns zero matches."
    checklist:
      - "writeProjects is module-private and is NOT exported."
      - "writeProjects writes a sibling temporary file and renames it over .praxis-projects.json, never writing registryPath directly."
      - "addProject no longer calls fs.writeFileSync and produces byte-identical registry output to before."
      - "removeProject returns the removed entry, or undefined for an unknown id, and never throws for an unknown id."
      - "No fs.rm, fs.unlink or recursive deletion appears anywhere in the module."
      - "npm run build and npx tsc --noEmit -p tsconfig.json both pass."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.2 `DELETE /api/projects/:id` (`src/server.ts`)
    ```yaml
    description: "Add the end-anchored id-scoped route with the DELETE branch and the 405 fallthrough."
    issues: []
    implement:
      - "In src/server.ts, in handleApi, directly after the `/api/projects` block that ends with the `sendJson(res, 405, { error: 'Method not allowed' }); return;` pair, and before the `dataMatch` line, add `const entryMatch = reqPath.match(/^\\/api\\/projects\\/([^/]+)$/);`."
      - "The regex must stay end-anchored so it cannot shadow the existing dataMatch (.../data) or detailMatch (.../workstreams/.../detail) routes below it."
      - "Inside `if (entryMatch) { ... }`, read the id from entryMatch[1]. Handle method === 'DELETE' by calling removeProject(id) inside a try/catch."
      - "DELETE outcomes: removed → 200 with `{ deleted: entry }`; removeProject returned undefined → 404 with `{ error: `Unknown project ${id}` }`; a throw → console.error then 500 with `{ error: 'Could not write the project registry' }`."
      - "Read no request body for DELETE. Delete nothing other than the registry row."
      - "End the entryMatch block with the fallthrough `sendJson(res, 405, { error: 'Method not allowed' });` followed by `return;`, matching the wording already used in the /api/projects block. The PATCH branch is added later in task 2.3 and slots into this same block."
      - "Do not shape-check the id. It is only ever compared against strings already in the registry and never becomes a filesystem path — the same reasoning the .../data route already relies on, and unlike the workstream id which does become a path segment."
      - "Add `removeProject` to the existing named import from './lib/projects.js' at the top of the file."
    pattern: "src/server.ts only. Do not edit src/lib/projects.ts or any client file in this task."
    imports: "removeProject from ./lib/projects.js, added to the existing `import { readProjects, findProject, addProject } from './lib/projects.js';` line. No new module and no new dependency."
    compatibility: "Every branch answers with JSON and catches its own throws, per the comment above handleApi — an uncaught exception inside an http.createServer handler takes the whole process down. Failures log through console.error like every existing handler. The server must keep knowing nothing about the registry's file format or its location; it calls the library."
    gotcha: "Route order matters: entryMatch must be placed after the exact `/api/projects` equality check and before dataMatch. Without the `$` anchor the pattern would swallow `/api/projects/<id>/data`. Deleting the synthesised self-entry is allowed and materialises the file — do not add a guard against it. Do not add a directory-existence check; delete must work for a project whose directory is gone."
    verify:
      - "npm run build"
      - "npx tsc --noEmit -p tsconfig.json"
      - "Start the server, then curl -i -X DELETE http://localhost:4173/api/projects/<real-id> returns 200 with the removed entry, and that row is gone from .praxis-projects.json."
      - "curl -i -X DELETE http://localhost:4173/api/projects/nosuchid returns 404 and .praxis-projects.json is unchanged."
      - "curl -i -X PUT http://localhost:4173/api/projects/<real-id> returns 405."
      - "curl -i http://localhost:4173/api/projects/<other-id>/data still returns 200 with the board payload, and ls on the deleted project's own directory shows it untouched."
    checklist:
      - "The entryMatch regex is end-anchored with $ and is placed after the /api/projects equality block and before dataMatch."
      - "DELETE returns 200 with { deleted: <entry> }, 404 for an unknown id, and 500 with the registry-write message on a throw."
      - "Any other method on /api/projects/:id returns 405 with { error: 'Method not allowed' }."
      - "GET /api/projects/<id>/data and the .../detail route still resolve for a surviving project."
      - "No request body is read on DELETE and no filesystem path is derived from the id."
      - "npm run build and npx tsc --noEmit -p tsconfig.json both pass."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.3 Tile restructure and the Delete control (`src/public/home.ts`)
    ```yaml
    description: "Split each tile from a single <a> into a container with a link, an actions area and an error area, and wire the Delete button through window.confirm and the DELETE endpoint."
    issues: []
    implement:
      - "In src/public/home.ts, rewrite the body of the `projects.forEach` callback inside renderTiles. It currently builds one `document.createElement('a')` with className 'tile'."
      - "Build this structure instead (illustrative, not literal): div.tile containing a.tile-link (href '/board.html?project=' + encodeURIComponent(p.id), holding the existing three spans tile-name, tile-path, tile-added), then div.tile-actions holding two buttons with class 'tile-action' labelled Rename and Delete, then an empty div.tile-error."
      - "Give each button an aria-label naming the project — 'Delete <name>' and 'Rename <name>' — and set type to 'button' so neither can submit a form."
      - "In this task the Rename button is created but does nothing yet. Its handler is added in task 2.4. Do not stub any other capability."
      - "Add a small per-tile error helper that writes a message into that tile's own .tile-error element and clears it before each attempt."
      - "Wire the Delete button: call window.confirm with a message that names the project and states that the project's own files on disk are not touched; on a false result do nothing at all and send no request."
      - "On confirm, fetch('/api/projects/' + encodeURIComponent(p.id), { method: 'DELETE' }). On success call loadProjects(), the same refresh-the-whole-list pattern submitPath already uses. On failure read the JSON body's `error` field and write it into that tile's .tile-error, leaving the tile in place."
      - "Write delete errors into the tile's own .tile-error, never into #add-error. #add-error stays the add form's error line."
      - "Change no markup in src/public/index.html — home.ts builds every tile in JavaScript and the page already supplies the #project-tiles, #add-form and #add-error hooks."
    pattern: "src/public/home.ts only. The CSS is task 1.4. Do not edit src/public/index.html, src/server.ts, or src/lib/projects.ts."
    imports: "None. This file is compiled as a classic script with `module: none` and `types: []` in src/public/tsconfig.json — adding any import statement is a compile error."
    compatibility: "Keep the file's existing style: the IIFE wrapper, `var` declarations, function expressions, and .then/.catch promise chains rather than async/await. Reuse the existing el(tag, cls, text) helper. Escaping needs no work because el() sets textContent, so a name containing <script> is displayed and never parsed."
    gotcha: "A button cannot live inside a link — nested interactive content is invalid and the click target becomes ambiguous. This is the only place existing behaviour can regress: after the split, clicking a tile must still open its board, and Tab must still reach each tile link and show a focus ring. Do not attach the click handler to div.tile, or the button clicks will also navigate."
    verify:
      - "npm run build"
      - "npx tsc --noEmit -p src/public/tsconfig.json"
      - "Load the home page: each tile still shows name, path and Added date, clicking a tile still opens its board, and Tab reaches each tile link and both buttons with a visible focus ring."
      - "Click Delete and cancel the confirmation: the tile stays, .praxis-projects.json is unchanged, and no request is sent (check the network panel)."
      - "Click Delete and confirm: the tile disappears from the page and the row is gone from .praxis-projects.json, while the project's own directory is byte-identical."
      - "chmod 444 .praxis-projects.json, then delete a tile: an error appears in that tile's own .tile-error, the tile stays on the page, #add-error stays empty, and .praxis-projects.json still parses and still holds every entry. Restore with chmod 644."
      - "grep -n 'add-error' src/public/home.ts shows it referenced only by setError, which is used only by the add form."
    checklist:
      - "Each tile is div.tile containing a.tile-link, div.tile-actions with two buttons, and div.tile-error."
      - "No button is nested inside the a.tile-link element."
      - "Clicking a tile still opens /board.html?project=<id> and keyboard focus still shows a ring on the link."
      - "Cancelling the confirmation sends no request and changes nothing."
      - "Delete errors render in that tile's .tile-error and never in #add-error."
      - "src/public/index.html is unchanged, and home.ts contains no import statement."
      - "npm run build and npx tsc --noEmit -p src/public/tsconfig.json both pass."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 1.4 Tile CSS for the restructured card (`src/public/styles.css`)
    ```yaml
    description: "Move the link-only rules from .tile onto .tile-link and add rules for .tile-actions, .tile-action and .tile-error."
    issues: []
    implement:
      - "In src/public/styles.css, in the home page block, keep the .tile rule as the card box — display flex, column direction, gap, padding, background, border, radius, box-shadow, min-width."
      - "Remove the link-only declarations `text-decoration: none;` and `color: inherit;` from .tile and put them on a new .tile-link rule, together with the hover border rule currently on .tile:hover and the focus outline currently on .tile:focus-visible, so keyboard focus still shows on the link."
      - "Add .tile-link as a flex column carrying the three spans, so tile-name, tile-path and tile-added keep their current stacked layout and gap."
      - "Add new rules for .tile-actions (a row of buttons), .tile-action (the button shape), .tile-edit (the inline rename input and its Save/Cancel buttons, used from task 2.5) and .tile-error (the per-tile error line)."
      - "Reuse the existing design tokens only — var(--line), var(--line-strong), var(--ink-soft), var(--accent), var(--paper-raised), var(--radius) — and the button shape already established by the .add-form button rule. Define no new custom property."
      - "Style .tile-error on var(--sev-critical) and give it an :empty rule that collapses its margin, mirroring how #add-error already handles the empty case."
      - "Leave the #project-tiles grid rule `repeat(auto-fill, minmax(280px, 1fr))` exactly as it is."
    pattern: "src/public/styles.css only, in the home page section around the existing .tile rules. Do not edit any other stylesheet region and do not edit src/public/home.ts in this task."
    imports: "None. This is a plain stylesheet with no build step of its own; tools/copy-assets.mjs copies it during npm run build."
    compatibility: "The class names must match exactly what task 1.3 emits: tile, tile-link, tile-actions, tile-action, tile-edit, tile-error. The existing .tile-name, .tile-path and .tile-added rules stay unchanged. Both light and dark rendering come from the existing tokens, so no colour literal is needed."
    gotcha: "Dropping :focus-visible when moving the rule off .tile silently removes the keyboard focus ring, which is a real accessibility regression and is exactly what the plan flags as the risk of this restructure. The .tile-action buttons need their own :focus-visible outline too. Inheriting flex from .tile onto .tile-link is easy to get wrong: if .tile-link is not itself a flex column the three spans collapse onto one line."
    verify:
      - "npm run build"
      - "Load the home page and compare against the previous look: the card box, spacing and grid are unchanged, and the two action buttons sit inside the card."
      - "Tab through the page: the tile link shows a focus ring, and each action button shows one."
      - "Hover a tile: the border still changes to var(--line-strong)."
      - "Resize the window down to the narrowest 280px grid column and confirm nothing overflows the card."
      - "grep -n 'minmax(280px, 1fr)' src/public/styles.css still returns the unchanged #project-tiles grid rule."
    checklist:
      - "text-decoration, color: inherit, the hover border and the :focus-visible outline all now live on .tile-link."
      - "The keyboard focus ring is visible on the tile link and on each action button."
      - ".tile-actions, .tile-action, .tile-edit and .tile-error rules exist and use only existing tokens."
      - "No new CSS custom property is defined and no colour literal is introduced."
      - "The #project-tiles grid rule and the .tile-name / .tile-path / .tile-added rules are unchanged."
      - "npm run build passes."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 2. Phase 2 — Rename, end to end

  ```yaml
  description: "Add renameProject over the same writer, the PATCH endpoint with its name validation, and the in-place rename edit mode on the tile. Rename changes the stored display name only; the id, the path and the added date never move."
  ```

  - [x] 2.1 `renameProject` (`src/lib/projects.ts`)
    ```yaml
    description: "Add renameProject(id, name) over the writeProjects helper introduced in task 1.1."
    issues: []
    implement:
      - "In src/lib/projects.ts, next to removeProject, add `export function renameProject(id: string, name: string): ProjectEntry | undefined`."
      - "Read the list, find the row with that id, return undefined when no row matches, otherwise set that row's `name` to the given value, call writeProjects with the full list, and return the updated entry."
      - "Set `name` only. Do not touch `id`, `path` or `added`, and do not re-derive the name from the path."
      - "Treat `name` as already validated. Do not trim, cap, or check it here — validation lives at the HTTP boundary, the way addProject already receives an already-validated path."
      - "Note in a short comment that `name` arrives already validated, so a future second caller knows it must validate for itself."
      - "Let a genuine filesystem failure throw, exactly as removeProject does."
    pattern: "src/lib/projects.ts only. The type comment is task 2.2 and the endpoint is task 2.3."
    imports: "None new. writeProjects and readProjects are already in this module after task 1.1."
    compatibility: "Requires task 1.1 to have landed, because renameProject writes through writeProjects. ProjectEntry is unchanged and gains no field: the existing persisted `name` carries the rename, so there is no migration and no backfill. The module still knows nothing about HTTP or the DOM."
    gotcha: "readProjects never re-derives `name` from the path, which is what makes a user-set name survive — do not add any re-derivation. Renaming the synthesised self-entry materialises the registry file with that one row, which is intended. Returning undefined rather than throwing for an unknown id keeps the 404 decision in the server."
    verify:
      - "npm run build"
      - "npx tsc --noEmit -p tsconfig.json"
      - "grep -nE \"\\.(path|added|id) *=\" src/lib/projects.ts returns no assignment inside renameProject."
    checklist:
      - "renameProject writes through writeProjects and never calls fs.writeFileSync directly."
      - "Only the row's `name` is assigned; id, path and added are untouched."
      - "renameProject returns the updated entry, or undefined for an unknown id, and never throws for an unknown id."
      - "No trimming, length cap, or character check is performed inside the library."
      - "npm run build and npx tsc --noEmit -p tsconfig.json both pass."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.2 Update the `name` comment (`src/types/praxis-data.d.ts`)
    ```yaml
    description: "The name field is no longer always the path basename; correct its comment. No type changes."
    issues: []
    implement:
      - "Apply this single mechanical edit to src/types/praxis-data.d.ts. Change nothing else in the file — no field is added, removed, or retyped."
      - |
        src/types/praxis-data.d.ts
        <<<<<<< SEARCH
          name: string;   // path.basename(path) — display only, never an identifier
        =======
          name: string;   // display only, never an identifier: path.basename(path) at add time, then whatever a rename sets
        >>>>>>> REPLACE
    pattern: "src/types/praxis-data.d.ts only, the ProjectEntry interface."
    imports: "None. This declaration file is included by both compilations and contains no imports by design."
    compatibility: "ProjectEntry and ProjectList keep the same fields and the same types, so both tsconfig projects and every existing consumer are unaffected. This is a comment-only change."
    gotcha: "This file is shared by tsconfig.json and src/public/tsconfig.json. Adding any import statement here would break the classic-script public build, so keep the edit to the comment text."
    verify:
      - "npx tsc --noEmit -p tsconfig.json"
      - "npx tsc --noEmit -p src/public/tsconfig.json"
      - "npm run build"
      - "git diff --stat src/types/praxis-data.d.ts shows one line changed."
    checklist:
      - "Only the comment on the `name` field changed."
      - "No field was added, removed, or retyped in ProjectEntry or ProjectList."
      - "No import statement was introduced into the declaration file."
      - "Both tsc --noEmit project checks and npm run build pass."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.3 `PATCH /api/projects/:id` (`src/server.ts`)
    ```yaml
    description: "Add the PATCH branch with the full name validation from the plan's contract table, and make the readRequestBody log label a parameter."
    issues: []
    implement:
      - "In src/server.ts, add a `method === 'PATCH'` branch inside the `entryMatch` block created in task 1.2, above the 405 fallthrough."
      - "Reuse readRequestBody as-is for the body, with one change: its hardcoded log label 'POST /api/projects — request stream error:' becomes a parameter, because reusing it under PATCH would otherwise log the wrong method. Pass the existing label from handleAddProject so that call site's log output is unchanged. Leave the 8KB MAX_BODY_BYTES cap alone."
      - "Wrap the whole body handler in try/catch, mirroring handleAddProject, so no throw escapes the http.createServer callback."
      - "Validate in this order and return the plan's exact messages. Body not valid JSON → 400 {\"error\": \"Request body must be valid JSON of the form {\\\"name\\\": \\\"New name\\\"}\"}. `name` missing, not a string, or blank after trimming → 400 {\"error\": \"Missing `name` — send a JSON body of the form {\\\"name\\\": \\\"New name\\\"}\"}. Trimmed name longer than 100 characters → 400 {\"error\": \"Name must be 100 characters or fewer\"}. Name containing any control character or line break → 400 {\"error\": \"Name must be a single line of plain text\"}."
      - "Put the 100 in a single named constant in src/server.ts so the cap can be widened in one place."
      - "On a valid name, call renameProject(id, trimmedName). undefined → 404 {\"error\": `Unknown project ${id}`}. Success → 200 with { project: entry }. A throw → console.error then 500 {\"error\": \"Could not write the project registry\"}."
      - "Add `renameProject` to the existing named import from './lib/projects.js'."
      - "Add no directory-existence check: rename must work for a project whose directory is gone."
    pattern: "src/server.ts only. Requires tasks 1.2 and 2.1 to have landed."
    imports: "renameProject from ./lib/projects.js, added to the existing named import line."
    compatibility: "The 405 fallthrough added in task 1.2 must stay reachable for every method other than DELETE and PATCH. The body-too-large path keeps returning the existing readRequestBody 413 response. Validation happens at the route boundary, where handleAddProject already does it, never inside the library. Every branch answers with JSON and catches its own throws."
    gotcha: "Changing readRequestBody's signature touches its existing handleAddProject caller — update that call site in the same edit or the build fails. The trimmed value is what gets length-checked and what gets stored, so trim once and reuse it. A `name` of 42 must be rejected by the typeof check before .trim() is reached, or it throws. The control-character check must cover \\n, \\r and \\t as well as the C0 and C1 ranges."
    verify:
      - "npm run build"
      - "npx tsc --noEmit -p tsconfig.json"
      - "curl -i -X PATCH -H 'Content-Type: application/json' -d '{\"name\":\"Renamed\"}' http://localhost:4173/api/projects/<real-id> returns 200 with the new name."
      - "Each 400 case returns its exact message and leaves .praxis-projects.json untouched: {}, {\"name\":\"\"}, {\"name\":\"   \"}, {\"name\":42}, a 101-character name, and a name containing a literal newline. Also send a non-JSON body."
      - "curl -i -X PATCH -H 'Content-Type: application/json' -d '{\"name\":\"X\"}' http://localhost:4173/api/projects/nosuchid returns 404 and changes nothing."
      - "After a successful rename, curl -i http://localhost:4173/api/projects/<same-id>/data still returns the board payload, and the entry's path and added values in .praxis-projects.json are unchanged."
      - "curl -i -X PUT http://localhost:4173/api/projects/<real-id> still returns 405."
    checklist:
      - "Every row of the plan's PATCH contract table returns its stated status code and its stated message."
      - "The 100-character cap is a single named constant in src/server.ts."
      - "readRequestBody takes the log label as a parameter, and the handleAddProject call site passes its original label unchanged."
      - "A rename leaves the entry's id, path and added values unchanged, and GET /api/projects/<id>/data still works for that id."
      - "The 405 fallthrough still answers for methods other than DELETE and PATCH."
      - "No directory-existence check was added to either endpoint."
      - "npm run build and npx tsc --noEmit -p tsconfig.json both pass."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.4 Inline rename in the tile (`src/public/home.ts`)
    ```yaml
    description: "Wire the Rename button to an in-place edit mode with Save, Cancel, Enter and Escape, sending the PATCH and rendering errors into that tile's .tile-error."
    issues: []
    implement:
      - "In src/public/home.ts, in the per-tile code from task 1.3, give the Rename button a click handler that swaps that one tile into edit mode in place. No other tile changes."
      - "Edit mode replaces the tile-name span with an <input> pre-filled with the current name through its .value property, plus a Save button and a Cancel button, all inside a container with class 'tile-edit'."
      - "Focus the input on entering edit mode. Enter saves, Escape cancels, matching the Save and Cancel buttons."
      - "Save sends fetch('/api/projects/' + encodeURIComponent(p.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: <input value> }) }), then on success calls loadProjects()."
      - "On a failed save, read the JSON body's `error` field and write it into that tile's .tile-error, leaving the tile in edit mode so the user can correct the value rather than retype it — the same reasoning as the comment in submitPath's catch."
      - "Cancel and Escape re-render that tile untouched and send no request."
      - "Do not change the tile's href. The link must stay '/board.html?project=' + encodeURIComponent(p.id) with the same id, character for character, after a rename."
      - "Populate the input through .value, never through innerHTML, so a name containing markup is never parsed."
      - "Change nothing in src/public/index.html."
    pattern: "src/public/home.ts only. The CSS is task 2.5. Requires tasks 1.3 and 2.3 to have landed."
    imports: "None. The public tsconfig sets module: none and types: [], so any import statement is a compile error."
    compatibility: "Keep the file's existing style — the IIFE, var, function expressions, and .then/.catch chains. Reuse el() and the per-tile error helper added in task 1.3. Errors go to that tile's .tile-error, never to #add-error."
    gotcha: "Escape inside a text input does not bubble as a form event here; bind keydown on the input itself and check the key value. Enter inside an input can submit an enclosing form — the buttons must have type='button' and the handler must call preventDefault. Calling loadProjects() re-renders every tile, which discards any other tile left in edit mode, so only enter edit mode on one tile at a time."
    verify:
      - "npm run build"
      - "npx tsc --noEmit -p src/public/tsconfig.json"
      - "Rename a tile, then reload the page fully: the new name is still shown."
      - "Copy the tile link before the rename and compare it after: /board.html?project=<same-id> is character-identical, and the board still opens."
      - "Press Escape in edit mode, and separately click Cancel: the original name returns, no request is sent, and .praxis-projects.json is unchanged."
      - "Submit an empty name: the server's message appears in that tile's .tile-error and #add-error stays empty."
      - "Check .praxis-projects.json after a rename: the entry's path and added values are unchanged."
    checklist:
      - "Rename opens an input pre-filled with the current name, populated through .value."
      - "Enter and Save both send the PATCH; Escape and Cancel both restore the tile and send nothing."
      - "The tile's href is unchanged by a rename and the board still loads."
      - "Rename errors render in that tile's .tile-error, never in #add-error."
      - "src/public/index.html is unchanged and home.ts contains no import statement."
      - "npm run build and npx tsc --noEmit -p src/public/tsconfig.json both pass."
    self_eval:
      passed: true
      failures: []
    ```

  - [x] 2.5 Edit-mode CSS (`src/public/styles.css`)
    ```yaml
    description: "Finish the .tile-edit rules so the inline rename input and its Save and Cancel buttons sit correctly in the card."
    issues: []
    implement:
      - "In src/public/styles.css, complete the .tile-edit rules stubbed in task 1.4 so the input and its two buttons lay out inside the card at the narrowest 280px grid column."
      - "Style the input on the existing .add-form input shape — border var(--line-strong), radius 6px, background var(--paper-raised), colour var(--ink) — but sized for the tile rather than the form."
      - "Style the Save and Cancel buttons on the same .tile-action shape already defined, and give them a :focus-visible outline."
      - "Reuse existing tokens only. Define no new custom property and introduce no colour literal."
      - "Leave the .tile, .tile-link, .tile-name, .tile-path, .tile-added, .tile-error and #project-tiles rules from task 1.4 as they are."
    pattern: "src/public/styles.css only, in the home page section. Requires task 1.4 to have landed."
    imports: "None."
    compatibility: "Class names must match what task 2.4 emits. The card must not change height enough to reflow the grid noticeably when a tile enters edit mode."
    gotcha: "An input with a default width can overflow the 280px card; give it a min-width of 0 and let it flex, or it pushes the buttons out of the card. Long names must not force horizontal overflow of the tile."
    verify:
      - "npm run build"
      - "Enter edit mode on a tile at the narrowest 280px grid column: the input and both buttons fit inside the card with no horizontal overflow."
      - "Tab through edit mode: the input, Save and Cancel each show a focus ring."
      - "Leave edit mode and confirm the tile returns to its normal appearance."
      - "grep -n 'minmax(280px, 1fr)' src/public/styles.css still returns the unchanged #project-tiles grid rule."
    checklist:
      - ".tile-edit lays out the input and both buttons inside the card with no overflow at 280px."
      - "The input and both buttons show a visible focus ring."
      - "Only existing design tokens are used; no new custom property and no colour literal."
      - "The rules added in task 1.4 are unchanged."
      - "npm run build passes."
    self_eval:
      passed: true
      failures: []
    ```

- [x] 3. Phase 3 — Edge-path verification
  ```yaml
  description: "The deliberate pass over the paths that are easy to leave untested because they need the registry file moved out of the way. No new code is expected; any fix found here lands in the file that owns the path."
  issues: []
  implement:
      - "Write no new code as part of this task. This is a verification pass over the synthesised self-entry, the empty registry, and the two-tab race."
      - "Copy .praxis-projects.json somewhere safe first. It is gitignored, so it is not recoverable from git, and delete has no undo buffer."
      - "Run the five steps in the verify list below, in order."
      - "If a step fails, fix it in the file that owns that path — src/lib/projects.ts, src/server.ts, src/public/home.ts or src/public/styles.css — and re-run the step. Change nothing else."
      - "Restore the registry file that was moved aside as the final step."
  pattern: "No file is expected to change. Any fix lands in the file that owns the failing path."
  imports: "None."
  compatibility: "Requires tasks 1.1 through 2.5 to have landed. readProjects treats an existing registry file as authoritative — an empty list in it means an empty list on the page — and that behaviour is the expected outcome of step 2, not a bug to fix."
  gotcha: "Deleting the self-entry is a one-way door in one narrow sense: once the self-entry is materialised into the file, removing .praxis-projects.json is the only way back to the synthesised tile. That is a rm of a gitignored local file, not a code concern. Two tabs share one registry file and there is no locking, by design."
  verify:
      - "Move .praxis-projects.json aside. The self-tile appears. Rename it. The file now exists, contains exactly that one row with the new name, and the tile keeps its name after a reload."
      - "Move the file aside again. The self-tile appears. Delete it. The file now exists and contains {\"projects\": []}, and the home page shows the 'No projects yet' empty state, including after a reload. Confirm the dashboard repo's own files are untouched with git status."
      - "Delete the last remaining project when several exist, and confirm the same empty state."
      - "Open two browser tabs, delete a project in one, then delete the same project in the other. The second attempt reports the 404 on that tile and the list reloads without it."
      - "Restore the registry file that was moved aside."
  checklist:
      - "Renaming the synthesised self-entry materialises the file with exactly that one row, and the name survives a reload."
      - "Deleting the synthesised self-entry writes {\"projects\": []} and the empty state persists across a reload."
      - "The dashboard repo's own files and flowcharge/ folder are untouched after deleting the self-entry."
      - "The second tab's duplicate delete reports 404 on that tile and reloads the list without it."
      - "The original registry file was restored at the end."
  self_eval:
      passed: true
      failures:
        - item: "The second tab's duplicate delete reports 404 on that tile and reloads the list without it."
          reason: "Failed on the first pass. The 404 half worked: the stale tab's DELETE /api/projects/a51ce5bc returned 404 and the tile's own .tile-error showed `Unknown project a51ce5bc`, with #add-error left empty. The reload half did not: no GET /api/projects followed the 404, so the dead tile stayed until the user reloaded the page by hand."
          fix: "Applied in src/public/home.ts, the one file that owns this path. A new httpError(status, message) helper attaches the response status to the thrown Error, and the Delete button's .catch calls loadProjects() after setTileError when, and only when, err.status is 404. The tile and its message disappear together, which is the intended outcome: the project is already gone, so the tile must go too. Every other failure status is unchanged — the tile stays and the error stays on it, verified with a stubbed 500 that left the tile and the message 'Could not write the project registry' in place. Re-ran: the second tab now shows DELETE 404 followed by GET /api/projects 200, and the dead tile is gone without a manual reload."
  ```

- [x] 4. Update the registry library line in `README.md`
  ```yaml
  description: "README.md describes projects.ts as 'read, find, add', which goes stale once removeProject and renameProject land. Approved answer to the plan's open question 4."
  issues: []
  implement:
      - "Apply this single mechanical edit to README.md. Change no other line of the file."
      - |
        README.md
        <<<<<<< SEARCH
        │   │   └── projects.ts              the project registry: read, find, add
        =======
        │   │   └── projects.ts              the project registry: read, find, add, rename, remove
        >>>>>>> REPLACE
  pattern: "README.md only, the source tree listing. Do not touch any other documentation."
  imports: "None."
  compatibility: "The listing uses box-drawing characters and column-aligned descriptions. Keep the existing leading characters and the run of spaces before the description exactly as they are."
  gotcha: "The line starts with box-drawing characters, so the SEARCH text must be matched byte-for-byte including those characters and the exact space run. Do not re-align the neighbouring lines."
  verify:
      - "grep -c 'read, find, add, rename, remove' README.md returns 1."
      - "grep -c 'the project registry: read, find, add$' README.md returns 0."
      - "git diff --stat README.md shows one line changed."
  checklist:
      - "The projects.ts description now reads 'read, find, add, rename, remove'."
      - "Only that one line of README.md changed."
      - "The box-drawing prefix and the column alignment of the listing are unchanged."
      - "Both grep checks return their expected counts."
  self_eval:
      passed: true
      failures: []
  ```

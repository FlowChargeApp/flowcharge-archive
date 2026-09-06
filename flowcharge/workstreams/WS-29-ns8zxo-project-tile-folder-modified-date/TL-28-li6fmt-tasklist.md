---
id: TL-28-li6fmt
type: tasklist
workstream: WS-29-ns8zxo
slug: project-tile-folder-modified-date
title: "Editable project folder path and a modified date on home-page tiles"
status: ready
created: 2026-08-15
updated: 2026-08-15
depends_on: [PLN-23-j16i7f]
links: []
mode: spec
base_commit: 34f6a2e
---

# PRX Tasks

## Editable project folder path and a modified date on home-page tiles

Implements PLN-23. A home-page project tile's inline edit row gains a second input for the
project's absolute folder path, so a user can repoint an entry without deleting and re-adding
it. Each tile also shows a `Modified YYYY-MM-DD` line, but only after the entry has really
changed.

The project `id` stays stable across a path edit, so bookmarked `/board.html?project=<id>`
URLs keep working. Because an id can now outlive the path it was hashed from, `addProject`'s
duplicate check moves from comparing `id` to comparing the resolved `path`, and a path already
owned by another entry is rejected with 409. `renameProject` in `src/lib/projects.ts` becomes
`updateProject`, a partial update over `name` and `path` with four outcomes. The four inline
path checks in `src/server.ts` become one shared `validateProjectPath` used by both the add
handler and the update handler. `ProjectEntry` gains one optional field, `updated?: string`.

Three phases, in the plan's order: Phase 1 is the server and registry end to end, Phase 2 is
the path input in the tile edit row, Phase 3 is the modified date. Nothing on disk is touched
by an edit — only one registry row is rewritten. The plan's exclusions hold: `hasPrxwork` is
reused exactly as it is, `selfEntry()` persistence behaviour is inherited unchanged, no test
framework is introduced, and `README.md` is not edited.

- [ ] 1. Phase 1 — Stable-id path editing, end to end on the server

  ```yaml
  description: "Land the identity decision and the registry semantics on the server first, where they can be exercised by curl before any UI depends on them."
  ```

  - [ ] 1.1 Correct the `ProjectEntry` id and path comments
    ```yaml
    description: "Document that `id` is the sha1 of the path the entry was ADDED with and is stable for the life of the row, and that `path` is editable after add."
    issues: []
    implement:
      - "Open src/types/praxis-data.d.ts and find the `ProjectEntry` interface (currently near line 52)."
      - "Replace the `id` trailing comment. It says the id is the sha1 of `path`. It must now say: 8 lowercase hex chars, sha1 of the path the entry was ADDED with, truncated; stable for the life of the row, so editing `path` does not change it and bookmarked /board.html?project=<id> URLs survive."
      - "Extend the `path` trailing comment to record that the value is absolute, path.resolve'd, and editable after add."
      - "Leave the `name` and `added` fields and their comments untouched."
      - "Do NOT add the `updated` field here. It belongs to task 3.1, so Phase 1 and Phase 3 stay separately revertible."
      - "Add no import and no export to this file. A top-level import or export turns it into a module and every interface in it stops being global for both compilations."
    pattern: "src/types/praxis-data.d.ts, the `ProjectEntry` interface only."
    imports: "None. This file is ambient global declarations and must stay import-free and export-free."
    compatibility: "The field set is unchanged in this task, so both tsconfig projects (tsconfig.json and src/public/tsconfig.json) keep compiling against the same shape. Comment-only change."
    gotcha: "The relaxed invariant is the whole point of the comment: after this feature `id === projectId(path)` is no longer guaranteed. A reader who trusts the old comment would reintroduce an id-based path lookup. Keep the wording explicit about that."
    verify:
      - "npm run build"
      - "grep -n 'sha1 of `path`' src/types/praxis-data.d.ts — must return nothing, proving the stale wording is gone."
    checklist:
      - "Does the `id` comment state that the id is fixed at add time and does not change when `path` is edited?"
      - "Does the `id` comment name the bookmarked /board.html?project=<id> URL as the reason?"
      - "Does the `path` comment say the value is editable after add?"
      - "Is the `updated` field still absent from this file?"
      - "Does the file still contain no top-level import and no top-level export?"
      - "Does `npm run build` complete with no TypeScript errors?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 1.2 Replace `renameProject` with `updateProject` and dedupe `addProject` on path
    ```yaml
    description: "Turn the rename-only library call into a partial update over `name` and `path` with four outcomes, and make addProject recognise an already-registered directory by its resolved path rather than by its id."
    issues: []
    implement:
      - "In src/lib/projects.ts, export two new types next to the function that will use them: `ProjectUpdate` with optional `name` and optional `path`, both already trimmed and validated by the caller and the path NOT yet resolved; and `UpdateResult`, a discriminated union of `{ ok: true; entry: ProjectEntry }`, `{ ok: false; reason: 'not-found' }`, and `{ ok: false; reason: 'path-taken'; conflict: ProjectEntry }`."
      - "Replace the `renameProject` function (currently the last export in the file, around line 110) with `export function updateProject(id: string, changes: ProjectUpdate): UpdateResult`. Delete `renameProject` entirely rather than keeping it as a wrapper — it has exactly one caller and that caller is updated in task 1.3."
      - "Implement updateProject in this order. First, readProjects() and find the row by `id`; if there is none, return `{ ok: false, reason: 'not-found' }`."
      - "Second, if `changes.path` is present, path.resolve it, then look for any OTHER row (different `id`) already holding that resolved path. If one exists, return `{ ok: false, reason: 'path-taken', conflict }` and write nothing. A row's own path must never count as taken."
      - "Third, compute whether anything really changes: `changes.name` present and different from the stored name, or the resolved path different from the stored path. If nothing differs, return `{ ok: true, entry }` WITHOUT calling writeProjects — no disk write at all. This branch is what Phase 3 relies on to keep an identical resubmit from stamping a date."
      - "Fourth, assign the supplied fields onto the entry (the RESOLVED path, not the raw one) and call writeProjects(projects), then return `{ ok: true, entry }`."
      - "Do NOT set `entry.updated` here. That single line belongs to task 3.2, so Phase 1 stays independently revertible."
      - "Never recompute `id` and never touch `added`."
      - "Carry the intent of the old renameProject comment block forward onto updateProject: the library owns registry state decisions such as the duplicate-path check, but knows nothing about 404 or 409; shape validation (trimming, length cap, absoluteness, flowcharge/ presence) stays at the HTTP boundary and arrives already done."
      - "Separately, change addProject's idempotency check. It currently reads `const existing = projects.find((p) => p.id === id);`. It must compare the resolved path instead: `const existing = projects.find((p) => p.path === resolved);`. This is required, not cosmetic — once an id can outlive its path, an id comparison no longer recognises a repointed project and re-adding its current path would create a second row for the same directory."
      - "Leave the `const id = projectId(resolved)` line in addProject in place; the id is still needed to build a new entry. projectId keeps its callers in addProject and selfEntry and gains no new one."
      - "Do not change readProjects, writeProjects, findProject, removeProject or selfEntry. The selfEntry persistence behaviour is named out of scope by the plan and is inherited unchanged, because updateProject reads and writes through the same readProjects/writeProjects pair renameProject already used."
    pattern: "src/lib/projects.ts only. The library must not learn about HTTP status codes, request validation, or the browser."
    imports: "No new imports. `path` (node:path) is already imported and provides path.resolve."
    compatibility: "ProjectEntry is an ambient global from src/types/praxis-data.d.ts and is not imported. ProjectUpdate and UpdateResult are real exports of this module, so src/server.ts imports them by name if it needs to annotate. Node >=18, ESM, .js extensions on relative imports."
    gotcha: "Three traps. First, the path-taken scan must exclude the entry being updated, or every path edit that keeps the same path reports a conflict against itself. Second, the no-change branch must return before writeProjects, not merely skip the stamp — the plan's criterion 11 asserts the registry file's modification time does not move. Third, the entry object returned is the same object held in the `projects` array read from disk, so mutating it before the write is intentional and correct; do not clone it and write the stale array."
    verify:
      - "npm run build"
      - "grep -rn 'renameProject' src/ — must return zero matches once task 1.3 has also landed; at this point it must match only the import and call site in src/server.ts."
      - "grep -n 'p.id === id' src/lib/projects.ts — must show the lookups in findProject, removeProject and updateProject, and must NOT appear inside addProject."
    checklist:
      - "Does updateProject return 'not-found' for an unknown id, without writing?"
      - "Does the path-taken check compare against OTHER rows only, so an entry's own path never conflicts with itself?"
      - "Does the no-change branch return the entry without calling writeProjects at all?"
      - "Are `id` and `added` left untouched on every path through updateProject?"
      - "Does addProject now find an existing entry by resolved `path` rather than by `id`?"
      - "Is `renameProject` gone from src/lib/projects.ts, with no wrapper left behind?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 1.3 Extract `validateProjectPath` and turn the rename handler into a partial-update handler
    ```yaml
    description: "Lift the four inline path checks out of handleAddProject into one shared validator, rename handleRenameProject to handleUpdateProject, make both body fields optional behind an at-least-one guard, and map the library's outcomes to 404 and 409."
    issues: []
    implement:
      - "In src/server.ts, add `type PathCheck = { ok: true; path: string } | { ok: false; error: string };` and `function validateProjectPath(candidate: unknown): PathCheck` above handleAddProject."
      - "Move the four checks currently inline in handleAddProject (around lines 94-112) into that function, in the same order and with the four message strings byte-identical: the typeof-string-and-non-empty-after-trim check producing 'Missing `path` — send a JSON body of the form {\"path\": \"/absolute/path\"}'; then trim; then the leading-`~` rejection producing '~ is not expanded — enter the full absolute path instead'; then !path.isAbsolute producing 'Path must be absolute — enter a full path starting with /'; then !hasPrxwork producing the template string 'No flowcharge/ folder found under ${input} — a project is a directory containing flowcharge/'. On success return `{ ok: true, path: input }` with the TRIMMED value, because the trimmed value is what gets stored."
      - "Reuse hasPrxwork exactly as it is imported today. The plan names its directory-vs-file gap explicitly out of scope."
      - "Rewrite handleAddProject's body so it calls validateProjectPath(body?.path), returns 400 with `result.error` when `ok` is false, and passes `result.path` to addProject. Its observable behaviour, status codes and messages must not change at all — the JSON-parse failure message stays as it is."
      - "Rename handleRenameProject to handleUpdateProject, keeping its position in the file, its readRequestBody call, and its try-catch structure. Update the log label string it passes to readRequestBody only if the method name appears in it; the label already reads `PATCH /api/projects/${id} — request stream error:` and stays correct."
      - "Inside handleUpdateProject, read both `name` and `path` off the parsed body as `unknown`. If NEITHER key is present, return 400 with exactly 'Send a JSON body with `name`, `path`, or both'. This is the one message string that changes, because the endpoint now accepts two fields."
      - "Keep the existing name checks inline, wrapped in a presence guard so they run only when `name` is present: typeof-string-and-non-empty-after-trim, then MAX_NAME_LENGTH, then CONTROL_CHARS, with their three existing messages unchanged. Do not extract them — there is still exactly one caller."
      - "When `path` is present, call validateProjectPath on it and return 400 with the returned error on failure. When it is absent, do not touch the stored path and do not run any flowcharge/ check against it — a name-only edit must still work for an entry whose folder has since moved away."
      - "Build a ProjectUpdate carrying only the keys the body actually supplied, call updateProject(id, changes), and map the result: ok true sends 200 `{ project: entry }`; 'not-found' sends 404 `{ error: `Unknown project ${id}` }`; 'path-taken' sends 409 with `${conflict.name} already uses that folder`, naming the owning project so the user can find the tile without opening the JSON. The existing catch keeps sending 500 'Could not write the project registry'."
      - "Change the import on line 6 from `renameProject` to `updateProject`, and change the PATCH route call site (around line 218) from handleRenameProject to handleUpdateProject. The route table entry changes only the function name."
      - "Leave the JSON-parse failure message in handleUpdateProject as-is unless it names only `name`; if it does, it may state the two-field form. Prefer the smallest change that is not misleading."
      - "Do not add a duplicate-path lookup here. That check is registry state and belongs to updateProject; src/server.ts must not read registry rows to answer it."
    pattern: "src/server.ts only: the new validator, handleAddProject, handleUpdateProject, the projects import, and the PATCH route call site."
    imports: "hasPrxwork from './lib/extract.js' is already imported. Change the './lib/projects.js' import to bring in updateProject in place of renameProject; import the ProjectUpdate or UpdateResult types from the same module only if an explicit annotation is needed."
    compatibility: "Backward compatible with the only existing caller: a PATCH body of `{ name }` alone must behave exactly as today, including the 200 `{ project: entry }` response shape. The PATCH body stays inside the existing MAX_BODY_BYTES 8KB cap in readRequestBody, which this handler already goes through. Every handler must keep swallowing its own throws — an uncaught exception inside the http.createServer handler takes the whole process down."
    gotcha: "Four traps. First, the add form's four messages are asserted byte-identical by acceptance criterion 4, so copy the strings, do not retype them. Second, presence must be tested on the KEY, not on truthiness: a `path` of empty string is present and must produce the missing-path message from the validator, not the neither-field-present 400. Third, the typeof check must come before .trim(), because a `name` of 42 has no .trim() to call — the existing comment says so. Fourth, the 409 must name the CONFLICTING entry, not the one being edited."
    verify:
      - "npm run build"
      - "grep -c 'isAbsolute' src/server.ts — must return 1, proving the absoluteness check exists in one place only."
      - "grep -rn 'renameProject\\|handleRenameProject' src/ — must return zero matches."
      - "npm start, then with a scratch registry: PATCH a valid other directory containing flowcharge/ returns 200; GET /api/projects shows the new path with the SAME id; GET /api/projects/<same id>/data returns the new directory's payload (criteria 2, 3)."
      - "PATCH {\"name\": \"X\"} alone behaves exactly as before (criterion 6). PATCH {} returns 400. PATCH on an unknown id returns 404."
      - "PATCH each of {\"path\": \"~/x\"}, {\"path\": \"relative/x\"}, {\"path\": \"\"} and a directory with no flowcharge/ — each must return the same message the add form gives for that input (criterion 4)."
      - "PATCH the path of another registry entry — must return 409 naming that entry, and .praxis-projects.json must be unchanged (criterion 5)."
      - "After a path edit, POST that same path to /api/projects — must return 200 with the existing entry, not 201 with a new row (criterion 7)."
    checklist:
      - "Are the four path-rejection messages byte-identical to the ones the add form produced before this task?"
      - "Does handleAddProject behave identically, with the same status codes and messages, after the extraction?"
      - "Does a PATCH body carrying neither `name` nor `path` return 400 with 'Send a JSON body with `name`, `path`, or both'?"
      - "Does a name-only PATCH run no flowcharge/ check against the stored path?"
      - "Does 'not-found' map to 404 and 'path-taken' map to 409 naming the conflicting project?"
      - "Is the duplicate-path lookup absent from src/server.ts, living only in updateProject?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 2. Phase 2 — Path input in the tile edit row

  ```yaml
  description: "Add the second input to the tile's inline edit row, hide and restore the path line with it, share the Enter/Escape handler, send changed fields only, and give the path input its own line in the narrowest column. Depends on Phase 1: the endpoint must already accept `path`."
  ```

  - [ ] 2.1 Add the path input, shared key handler and changed-fields-only save to the tile edit row
    ```yaml
    description: "Build a second pre-filled input for the folder path next to the name input, hide both the .tile-name and .tile-path spans while editing, attach Enter/Escape to both inputs through one helper, and PATCH only the fields that actually differ."
    issues: []
    implement:
      - "In src/public/home.ts, inside renderTiles' per-project closure, capture the path span the same way the name span is captured. Today line 87 appends it inline: `link.appendChild(el('span', 'tile-path', p.path));`. Assign it to a `pathSpan` variable first, then append it, mirroring how `nameSpan` is built on lines 85-86."
      - "In exitEditMode (around line 119), restore `pathSpan.style.display = ''` alongside the existing `nameSpan.style.display = ''`."
      - "In the pencil button's click handler (around line 126), build a `pathInput` next to `nameInput`: type 'text', value set through `.value` and never innerHTML so a path containing markup is never parsed, and `aria-label` of 'New folder path for ' + p.name."
      - "Append the row's children in the tile's own display order: nameInput, pathInput, saveButton, cancelButton."
      - "Hide both spans when entering edit mode: set `pathSpan.style.display = 'none'` next to the existing `nameSpan.style.display = 'none'` (around line 184), so edit mode does not show the path twice."
      - "Replace the single nameInput keydown listener (lines 174-182) with a small local helper that attaches the same Enter/Escape handler to both inputs, rather than duplicating the listener. Keep the existing behaviour exactly: Enter calls ev.preventDefault() then save(), Escape calls ev.preventDefault() then exitEditMode(). Keep the existing comment explaining why the key is read on the input itself."
      - "Change save() to build the request body from changed fields only: include `name` when `nameInput.value !== p.name`, include `path` when `pathInput.value !== p.path`. If neither differs, call exitEditMode() and return without issuing any fetch."
      - "Leave the rest of save() unchanged: the same PATCH URL, the same error unwrapping, loadProjects() on success, and setTileError(err.message) with the row still open on failure. The id is stable, so the client must NOT read an id back out of the response."
      - "Update the pencil button's aria-label and title (lines 94-95) from 'Rename ' + p.name to 'Edit ' + p.name, and update the two edit-row aria-labels that say 'renaming': the Save button's 'Save the new name for ' and the Cancel button's 'Cancel renaming '. Reword both so they describe editing the project rather than renaming it."
      - "Give pathInput the CSS class the styling task adds, so task 2.2's rule applies to it: `pathInput.className = 'tile-edit-path';`."
      - "Do not add any client-side path rule beyond the two instant-feedback checks the add form already has. The server stays the authority, and this file must never recompute or derive an id."
      - "Keep the existing focus behaviour: nameInput.focus() and nameInput.select() after the row is inserted."
    pattern: "src/public/home.ts, the renderTiles per-project closure only: the tile-path span, exitEditMode, the pencil click handler, and save()."
    imports: "None. This file is a browser IIFE with no module imports, and ProjectEntry reaches it as an ambient global."
    compatibility: "Compiled by src/public/tsconfig.json for the browser, so it keeps the file's existing style: `var` declarations, function expressions, no arrow functions, no template literals, and explicit `as HTMLInputElement` casts on el() results. Only one tile is ever in edit mode, because a save calls loadProjects() and re-renders every tile."
    gotcha: "Three traps. First, the changed-field comparison must be against `p.name` and `p.path` — the values the row was rendered from — not against the input's own defaultValue. Second, an empty body must short-circuit on the client; letting it through would hit the Phase 1 at-least-one guard and show a 400 message for a no-op save. Third, exitEditMode must restore the path span on the Cancel path AND on the Escape path; both already funnel through exitEditMode, so restoring it there covers both."
    verify:
      - "npm run build"
      - "grep -c 'addEventListener(.keydown' src/public/home.ts — must return 1, proving the handler was shared rather than duplicated."
      - "grep -n 'Rename ' src/public/home.ts — must return nothing, proving the pencil label changed."
      - "npm start, open http://localhost:4173: the pencil button opens a row with both values pre-filled, and the tile's own name and path lines are hidden while it is open (criterion 1)."
      - "Change the path and save — the tile re-renders with the new path (criterion 2). Enter in either input saves; Escape in either input restores the tile untouched (criterion 8)."
      - "Save a bad path — the row stays open with both typed values intact and the message on the tile (criterion 4). Save with nothing changed — the row closes and the network panel shows no request."
    checklist:
      - "Is the path input pre-filled through .value rather than innerHTML?"
      - "Are BOTH the .tile-name and .tile-path spans hidden on entering edit mode and restored on exit?"
      - "Is the Enter/Escape handler attached to both inputs from one helper, not duplicated?"
      - "Does a save with no changed field close the row and issue no fetch?"
      - "Does the client still avoid reading any id out of the PATCH response?"
      - "Do the pencil, Save and Cancel labels describe editing rather than renaming?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 2.2 Give the path input its own line in the edit row
    ```yaml
    description: "Add one CSS modifier so the folder-path input takes a full line in the narrowest 280px grid column and reads in the same monospace family as the .tile-path span it replaces."
    issues: []
    implement:
      - "In src/public/styles.css, add a `.tile-edit .tile-edit-path` rule immediately after the existing `.tile-edit .tile-action` rule, overriding the shared `.tile-edit input` flex basis with `flex: 1 1 100%` and setting `font-family: var(--font-mono)`."
      - "Apply this SEARCH/REPLACE block, which targets that one unambiguous location:"
      - |
        src/public/styles.css
        <<<<<<< SEARCH
        .tile-edit .tile-action { flex: 0 0 auto; }
        =======
        .tile-edit .tile-action { flex: 0 0 auto; }
        /* The folder path is long and monospaced, so it takes its own line rather than
           sharing one with the name input, and reads like the .tile-path span it replaces
           while the edit row is open. */
        .tile-edit .tile-edit-path {
          flex: 1 1 100%;
          font-family: var(--font-mono);
        }
        >>>>>>> REPLACE
      - "Add nothing else. No new rule is needed for the modified line, because task 3.3 reuses the existing .tile-added class."
      - "Do not change .tile-edit, .tile-edit input, .tile-path or .tile-added."
    pattern: "src/public/styles.css, the tile edit-row block only (the rules around .tile-edit)."
    imports: "None. The --font-mono custom property is already defined and already used by .tile-path."
    compatibility: "The rule must be more specific than the shared `.tile-edit input` rule that sets `flex: 1 1 140px`, and must come after it in source order. `.tile-edit` already sets flex-wrap: wrap and the input already sets min-width: 0, so the 100% basis wraps instead of overflowing."
    gotcha: "A bare `.tile-edit-path` selector loses the specificity contest with `.tile-edit input` and the flex basis silently stays 140px, so keep the two-class descendant selector. The class name must match the one task 2.1 assigns to pathInput."
    verify:
      - "npm run build"
      - "grep -n 'tile-edit-path' src/public/styles.css src/public/home.ts — must match in both files, proving the class name agrees."
      - "npm start, open http://localhost:4173, open a tile's edit row, and shrink the window until the tile grid is at its 280px minimum: the row must wrap with no horizontal overflow."
    checklist:
      - "Does the new rule sit after `.tile-edit input` in source order?"
      - "Does it use a two-class descendant selector so it out-specifies `.tile-edit input`?"
      - "Does the path input render in the same monospace family as the .tile-path span?"
      - "Does the edit row avoid horizontal overflow at the 280px column minimum?"
      - "Were .tile-added and .tile-path left unchanged?"
    self_eval:
      passed: false
      failures: []
    ```

- [ ] 3. Phase 3 — The modified date

  ```yaml
  description: "Add the optional `updated` field, stamp it only in updateProject's write branch, and render it as a second metadata line on the tile. Depends on Phase 1 for the change detection and Phase 2 to exercise a path edit from the UI."
  ```

  - [ ] 3.1 Add `updated?: string` to `ProjectEntry`
    ```yaml
    description: "Add one optional field carrying the day the entry's name or path last really changed, absent until the first real change."
    issues: []
    implement:
      - "In src/types/praxis-data.d.ts, add `updated?: string;` to the `ProjectEntry` interface, after `added`."
      - "Comment it: YYYY-MM-DD, the day `name` or `path` last really changed; ABSENT until the first real change, which is also the state of every entry written before this feature existed."
      - "Keep it optional. Do not make it required and do not backfill it anywhere — absence is the only honest signal of 'never edited', and comparing it against `added` would wrongly hide the modified line for an edit made on the day of the add."
      - "Add no import and no export to this file, for the same ambient-global reason as task 1.1."
    pattern: "src/types/praxis-data.d.ts, the `ProjectEntry` interface only."
    imports: "None."
    compatibility: "Additive and optional, so no migration is needed: every row already in a user's .praxis-projects.json stays valid and renders with no modified line. readProjects parses whole objects and writeProjects re-serialises them, so the key survives a rollback to an older build untouched and simply goes unrendered."
    gotcha: "Note the name collision with the unrelated `updated` fields on PraxisArtefact and PraxisWorkstream in the same file. They are different types and must not be touched."
    verify:
      - "npm run build"
      - "grep -n 'updated' src/types/praxis-data.d.ts — the ProjectEntry occurrence must be optional (`updated?:`)."
    checklist:
      - "Is the new field declared optional with `?`?"
      - "Does its comment state that the key is absent until the first real change?"
      - "Are the unrelated `updated` fields on PraxisArtefact and PraxisWorkstream untouched?"
      - "Does the file still contain no top-level import and no top-level export?"
      - "Does `npm run build` complete with no TypeScript errors?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 3.2 Stamp `updated` in `updateProject`'s write branch
    ```yaml
    description: "Set the modified date on a real change only, using the same expression `added` already uses."
    issues: []
    implement:
      - "In src/lib/projects.ts, inside updateProject's write branch only — after the no-change early return added in task 1.2, alongside where the supplied fields are applied — set `entry.updated = new Date().toISOString().slice(0, 10);`."
      - "Use that exact expression. It is identical to the one addProject and selfEntry already use for `added`, so the two lines on the tile can never disagree about what a date means."
      - "Do not stamp in the not-found branch, the path-taken branch, or the no-change branch. The no-change branch is what keeps an identical resubmit from stamping a date and from writing the file at all."
      - "Stamp for a name-only change exactly as for a path change — the field records that the row changed, not which part of it changed."
      - "Do not touch `added` and do not compare `updated` against it."
    pattern: "src/lib/projects.ts, the write branch of updateProject only."
    imports: "None. No date library is used or wanted."
    compatibility: "The value is a UTC date, so a late-evening edit in a positive-offset zone can stamp the next day. That is precisely how `added` already behaves, and consistency between the two lines is worth more than fixing it here."
    gotcha: "The stamp must land after the no-change early return, not before it. Placed before, every save would write the file and move the registry's modification time, which acceptance criterion 11 asserts must not happen."
    verify:
      - "npm run build"
      - "grep -c \"toISOString().slice(0, 10)\" src/lib/projects.ts — must return 3: selfEntry, addProject, and updateProject."
      - "npm start, PATCH a name change, then read .praxis-projects.json: that row must carry `updated` set to today's date and its `added` must be unchanged."
      - "PATCH the identical values again and note .praxis-projects.json's modification time before and after: it must not move (criterion 11)."
    checklist:
      - "Is the stamp inside the write branch, after the no-change early return?"
      - "Is the expression byte-identical to the one used for `added`?"
      - "Does a name-only change stamp the date as well as a path change (criterion 12)?"
      - "Does an identical resubmit leave both the date and the file untouched (criterion 11)?"
      - "Is `added` still never written by updateProject?"
    self_eval:
      passed: false
      failures: []
    ```

  - [ ] 3.3 Render the `Modified` line on the tile
    ```yaml
    description: "Append a second metadata span under the added line, only when the entry carries an `updated` value."
    issues: []
    implement:
      - "In src/public/home.ts, inside renderTiles' per-project closure, append a third span to the tile link immediately after the existing 'Added ' span, guarded on `p.updated` being present."
      - "Reuse the .tile-added class rather than introducing a new one: the two lines are the same kind of metadata and must look identical."
      - "Apply this SEARCH/REPLACE block, which targets that one unambiguous location:"
      - |
        src/public/home.ts
        <<<<<<< SEARCH
              link.appendChild(el('span', 'tile-added', 'Added ' + p.added));
              tile.appendChild(link);
        =======
              link.appendChild(el('span', 'tile-added', 'Added ' + p.added));
              if (p.updated) link.appendChild(el('span', 'tile-added', 'Modified ' + p.updated));
              tile.appendChild(link);
        >>>>>>> REPLACE
      - "Add no CSS. The reused class is already styled."
      - "Do not render a placeholder, an em dash, or an 'as added' fallback when the field is absent — a tile that has never been edited must show only its added line, exactly as today."
    pattern: "src/public/home.ts, the tile link construction inside renderTiles only."
    imports: "None. el() is already defined in this file and ProjectEntry is an ambient global."
    compatibility: "Keeps the file's browser style: string concatenation rather than template literals, and el() for element construction. The guard is a plain truthiness test, which is correct here because the field is either absent or a non-empty date string."
    gotcha: "The span must go inside `link`, alongside the other three, not on `tile` — appending to the tile would put it outside the anchor and break the tile's single click target. The SEARCH block above anchors on `tile.appendChild(link);` for exactly that reason."
    verify:
      - "npm run build"
      - "grep -c \"'tile-added'\" src/public/home.ts — must return 2, proving the class was reused rather than a new one added."
      - "npm start, open http://localhost:4173: a tile that has never been edited shows only its added line (criterion 9)."
      - "Rename a project from its tile — the tile then shows `Modified <today>` under the added line, in matching style (criteria 10, 12). Repeat with a path change and confirm the same."
      - "Re-open the edit row and save the identical values — the date must not change (criterion 11)."
    checklist:
      - "Is the Modified span appended to `link`, after the Added span?"
      - "Is it rendered only when `p.updated` is present, with no fallback text?"
      - "Does it reuse .tile-added, with no new CSS class introduced?"
      - "Do the two lines render in identical style?"
      - "Does a never-edited tile look exactly as it did before this task?"
    self_eval:
      passed: false
      failures: []
    ```

---
id: PLN-14-pto0d5
type: plan
workstream: WS-19-jhikk2
slug: project-delete-and-rename
title: "Delete and rename registered projects from the home page"
status: done
created: 2026-08-08
updated: 2026-08-08
depends_on: []
links: []
---

# Delete and rename registered projects from the home page

## Summary

The home page can only add projects. This plan adds two more registry operations, each with a
server endpoint and a matching control on the tile: **remove a project from the registry**, and
**give a project a different display name**.

The chosen approach is the smallest one that fits what already exists:

1. `src/lib/projects.ts` gains one private whole-file writer and two public operations,
   `removeProject(id)` and `renameProject(id, name)`. `addProject` is repointed at the shared
   writer so all three write paths behave identically.
2. `src/server.ts` gains one new route pattern, `^/api/projects/([^/]+)$`, dispatching
   `DELETE` and `PATCH` on it. This mirrors the existing id-scoped `.../data` and
   `.../workstreams/.../detail` patterns (`src/server.ts:133`, `src/server.ts:159`) exactly.
3. `src/public/home.ts` restructures each tile so the link and the two action buttons are
   siblings, and drives the two new endpoints.

Two decisions carry the design, and both are forced by how identity works today:

- **Rename changes the display name only.** The id is `sha1(absolutePath)` truncated to 8 hex
  characters (`src/lib/projects.ts:17`). Changing the path would change the id and break every
  bookmarked `/board.html?project=<id>` URL. So rename never touches `path`, never touches `id`,
  and never touches anything on disk inside the project. It rewrites one string in one registry
  row.
- **No new field, and no type change.** `name` is *derived* once, at add time
  (`src/lib/projects.ts:68`), but it is *persisted* like every other field, and `readProjects`
  never re-derives it (`src/lib/projects.ts:39-52`). A user-set name therefore survives on its own.
  `ProjectEntry` and `ProjectList` (`src/types/praxis-data.d.ts:52-61`) are unchanged, so there is
  no migration and no backfill.

There are no new dependencies, no new files, and no change to the payload of
`GET /api/projects`.

## Scope

### Acceptance criteria

Delete:

1. Every project tile shows a **Delete** control.
2. Activating it asks the user to confirm, naming the project, and stating that the project's own
   files are not touched.
3. On confirm, the tile disappears from the home page and the project is gone from
   `.praxis-projects.json`.
4. The project's directory, its `flowcharge/` folder, and every file under it are byte-identical
   after a delete.
5. `DELETE /api/projects/<unknown-id>` answers `404` and changes nothing.
6. If the registry cannot be written, the endpoint answers `500`, the tile stays on the page with
   an error next to it, and `.praxis-projects.json` still parses and still holds every entry it
   held before.

Rename:

7. Every project tile shows a **Rename** control that opens an editable field pre-filled with the
   current name.
8. Saving a new name updates the tile, and the new name is still there after a full page reload.
9. The tile's link target `/board.html?project=<id>` is character-identical before and after a
   rename, and that board still loads.
10. The entry's `path` and `added` values are unchanged by a rename.
11. An empty or whitespace-only name is rejected with a message, and nothing is written.
12. `PATCH /api/projects/<unknown-id>` answers `404` and changes nothing.
13. Cancelling the edit leaves the tile exactly as it was and writes nothing.

Both:

14. `GET /api/projects/<id>/data` and the board page continue to work unchanged for every project
    that was not deleted.
15. Any other HTTP method on `/api/projects/<id>` answers `405`.

### Out of scope

Explicitly not planned, not designed for, and not to be added "while we are in there":

- Bulk delete, multi-select, or select-all.
- Drag-to-reorder or any ordering control.
- Archiving, hiding, or soft-delete with an undo buffer.
- A settings page or any second page.
- Changing a project's `path` (see Assumption A1).
- Any read or write inside a project's own `flowcharge/` folder.
- Any change to the add flow beyond the tile restructure that delete and rename force.
- Authentication, permissions, TLS, CSRF tokens, or multi-writer locking. The server binds
  `127.0.0.1` (`src/server.ts:234`). Opening that bind is `WS-18` and is not this work.

### Assumptions

These are decisions taken without the user, each with the consequence if the reading is wrong.

- **A1 — "Rename" means the display label, not the location.** The user gets a new name on the
  tile; the project stays exactly where it is on disk. *If wrong:* the user actually wanted to
  move a project or re-point a tile at a moved directory. That is a different feature, it changes
  the id, and none of this plan serves it — it would need its own workstream.
- **A2 — The synthesised self-entry is materialised on write.** `readProjects` invents an entry
  for the dashboard repo itself when the registry file does not exist
  (`src/lib/projects.ts:24-32`, `src/lib/projects.ts:44`). Delete and rename read the list, change
  it, and write the whole list back — so the first delete or rename creates the file, exactly as
  the first `addProject` already does today. Deleting the self-entry therefore writes
  `{"projects": []}`, and the home page then shows the empty state permanently, because
  `readProjects` treats an existing file as authoritative (`src/lib/projects.ts:38`). *If wrong:*
  the user expected the self-tile to be permanent and is surprised it does not come back. Recovery
  is one paste of the repo path into the add form, or deleting `.praxis-projects.json`.
- **A3 — Name rules.** A name is a string, trimmed, non-empty, at most 100 characters, and free of
  control characters including newlines. Names need not be unique — identity is the id, never the
  name. *If wrong:* a user who wants a 200-character name gets a `400`. Widening the cap is a
  one-constant change.
- **A4 — Validation happens at the HTTP boundary.** The library functions receive an
  already-validated name, the way `addProject` receives an already-validated path today
  (`src/server.ts:86-98`). *If wrong:* nothing user-visible; a future second caller of the library
  would have to validate for itself.
- **A5 — Failed writes surface as `500` and leave the file intact.** See "Data & compatibility".
- **A6 — Manual verification only.** The repository has no test framework and no test files. A
  test runner would be a new dependency and a separate decision (see "Testing strategy").
- **A7 — Release constraints.** This is a local, single-user, loopback-only developer tool with no
  production deployment, no live users, and no server-side data other than the machine-local,
  gitignored `.praxis-projects.json`. No feature flag, dark launch, or staged rollout is planned.
  Rollback is `git revert`. *If wrong:* if this is in fact running somewhere shared, the delete
  endpoint is unauthenticated and would need `WS-18` settled first.

## Design

### The registry contract

`.praxis-projects.json` keeps the shape it has now:

```json
{ "projects": [ { "id": "1a2b3c4d", "name": "Praxis-Dashboard", "path": "/abs/path", "added": "2026-08-08" } ] }
```

No key is added, removed, or renamed. `ProjectEntry` in `src/types/praxis-data.d.ts:52-57` is
unchanged, except for the comment on `name`, which currently reads "path.basename(path) — display
only, never an identifier". That is still true of what it is *for*, but no longer true of where it
comes from: after this work it is the basename only until the user changes it. The comment is
updated to say so. A row that lacks `name` entirely — only reachable by hand-editing the file —
renders blank today and still renders blank after this work; a rename fixes it by writing one.

### Library contract — `src/lib/projects.ts`

Three additions and one repoint. The module keeps knowing only about the registry and its shape,
and keeps knowing nothing about HTTP, `flowcharge/`, or the board payload (the file's own header
comment, `src/lib/projects.ts:1-3`).

```ts
// Not exported. The single write path for the whole module.
function writeProjects(projects: ProjectEntry[]): void;

// Removes the row with this id and rewrites the file.
// Returns the removed entry, or undefined when no row has that id.
export function removeProject(id: string): ProjectEntry | undefined;

// Sets the row's `name` and rewrites the file. `name` must already be validated.
// Returns the updated entry, or undefined when no row has that id.
export function renameProject(id: string, name: string): ProjectEntry | undefined;
```

- `writeProjects` writes to a sibling temporary file and then `fs.renameSync`s it over
  `.praxis-projects.json`. This is the one piece of behaviour that is genuinely new rather than
  moved. It exists because `fs.writeFileSync` truncates first: a write that fails half-way leaves
  a truncated file, `readProjects` then fails to parse it and returns `[]`
  (`src/lib/projects.ts:49-51`), and the user silently loses the whole project list. Constraint:
  read must never break the app — this keeps that true for the new write paths as well.
- `addProject` (`src/lib/projects.ts:58-76`) is repointed at `writeProjects` instead of calling
  `fs.writeFileSync` directly. Same output bytes, same return value, safer failure mode. This is
  the only change to existing add behaviour, and it exists so there is one writer rather than
  three copies of the same four lines.
- Both new functions return `undefined` rather than throwing on an unknown id. The library does
  not know what a `404` is; the server does.
- Both let a genuine filesystem failure throw. The server catches it, exactly as it already does
  for `addProject` (`src/server.ts:102-105`).
- Neither function touches anything outside `.praxis-projects.json`. There is no `fs.rm`, no
  `fs.unlink` of any project path, and no recursion anywhere in this module. That is what makes
  acceptance criterion 4 structurally true rather than a promise.

### HTTP contract — `src/server.ts`

One new route pattern, placed directly after the existing `/api/projects` block
(`src/server.ts:114-131`). Its regex is end-anchored, so it cannot shadow the `.../data`
(`src/server.ts:133`) or `.../detail` (`src/server.ts:159`) routes:

```ts
const entryMatch = reqPath.match(/^\/api\/projects\/([^/]+)$/);
```

**`DELETE /api/projects/:id`**

| Outcome | Status | Body |
|---|---|---|
| Removed | 200 | `{ "deleted": { id, name, path, added } }` |
| No such id | 404 | `{ "error": "Unknown project <id>" }` |
| Write failed | 500 | `{ "error": "Could not write the project registry" }` |

No request body is read. Nothing else is deleted.

**`PATCH /api/projects/:id`**

Request body: `{ "name": "<new display name>" }`.

| Outcome | Status | Body |
|---|---|---|
| Renamed | 200 | `{ "project": { id, name, path, added } }` |
| Body not JSON | 400 | `{ "error": "Request body must be valid JSON of the form {\"name\": \"New name\"}" }` |
| `name` missing, not a string, or blank after trimming | 400 | `{ "error": "Missing `name` — send a JSON body of the form {\"name\": \"New name\"}" }` |
| Name over 100 characters | 400 | `{ "error": "Name must be 100 characters or fewer" }` |
| Name contains a control character or a line break | 400 | `{ "error": "Name must be a single line of plain text" }` |
| Body over 8KB | 413 | existing `readRequestBody` response |
| No such id | 404 | `{ "error": "Unknown project <id>" }` |
| Write failed | 500 | `{ "error": "Could not write the project registry" }` |

**Any other method on `/api/projects/:id`** → `405 { "error": "Method not allowed" }`, matching
`src/server.ts:129`.

Supporting details:

- `readRequestBody` (`src/server.ts:34-67`) is reused as-is for `PATCH`, with one change: its
  hardcoded log label `'POST /api/projects — request stream error:'` (`src/server.ts:64`) becomes a
  parameter, because reusing it under `PATCH` would otherwise log the wrong method. The 8KB cap
  (`src/server.ts:25`) is left alone; a display name is far under it.
- The id is only ever compared against strings already in the registry. It never becomes a
  filesystem path, so it needs no shape check — the same reasoning the `.../data` route already
  relies on. This is unlike the workstream id at `src/server.ts:170`, which does become a path
  segment and is therefore shape-checked.
- Every branch answers with JSON and catches its own throws, per the comment at
  `src/server.ts:109-110`. Failures log through `console.error`, like every existing handler.

### Client — `src/public/home.ts`, `src/public/index.html`, `src/public/styles.css`

The tile is an `<a>` wrapping the whole card today (`src/public/home.ts:32-38`). Buttons cannot
live inside a link — nested interactive content is invalid, and the click would be ambiguous. So
`renderTiles` builds:

```
div.tile
  a.tile-link  → /board.html?project=<id>     (name, path, added — the current three spans)
  div.tile-actions
    button.tile-action  "Rename"   aria-label "Rename <name>"
    button.tile-action  "Delete"   aria-label "Delete <name>"
  div.tile-error                               (empty unless that tile's request failed)
```

- **Delete** calls `window.confirm` naming the project and saying the files on disk are not
  touched, then `fetch(..., { method: 'DELETE' })`, then `loadProjects()` — the same
  refresh-the-whole-list pattern `submitPath` already uses on success
  (`src/public/home.ts:94-97`).
- **Rename** swaps that tile into edit mode in place: the name span becomes an `<input>`
  pre-filled with the current name, with Save and Cancel buttons. Enter saves, Escape cancels.
  Save sends the `PATCH` and then calls `loadProjects()`. Cancel re-renders the tile untouched.
  No new markup is added to `index.html`, because `home.ts` already builds every tile in
  JavaScript and the page only supplies the `#project-tiles`, `#add-form` and `#add-error` hooks.
- **Errors** from delete and rename are written into that tile's own `.tile-error`, not into
  `#add-error` (`src/public/index.html:30`, `src/public/styles.css:548`). `#add-error` stays what
  its name says: the add form's error line. A failed delete on the third tile should report on the
  third tile.
- **Escaping** needs no work: `el()` sets `textContent` (`src/public/home.ts:5-10`), and the input
  is populated through `.value`. A name containing `<script>` is displayed, never parsed.
- **CSS** (`src/public/styles.css:477-510`): `.tile` keeps the card box but loses the link-only
  rules; `.tile-link` takes over `text-decoration`, `color: inherit`, the `:hover` border and the
  `:focus-visible` outline (`src/public/styles.css:490-491`) so keyboard focus still shows.
  New rules for `.tile-actions`, `.tile-action`, `.tile-edit` and `.tile-error`, reusing the
  existing tokens (`var(--line-strong)`, `var(--ink-soft)`, `var(--sev-critical)`) and the button
  shape already established at `src/public/styles.css:536-546`. The
  `repeat(auto-fill, minmax(280px, 1fr))` grid (`src/public/styles.css:472-476`) is unchanged.

### What each part must not know

- `projects.ts` must not know about HTTP status codes, request bodies, or the DOM. It returns
  entries and `undefined`.
- `server.ts` must not know the registry's file format or its location. It calls the library.
- `home.ts` must not know the registry's file format either. It knows two URLs, two methods, and
  the `ProjectEntry` shape it already renders.

## Staged task breakdown

Delete goes first: it is the irreversible operation, and it is the one that forces `writeProjects`
into existence, so the riskier half is proven end to end before rename is layered on. Each phase
leaves the app building, running, and demonstrable.

### Phase 1 — Delete, end to end

**1.1 — Registry write path and `removeProject`** *(small)*
Add the private `writeProjects` helper with temp-file-then-rename, add `removeProject(id)`, and
repoint `addProject` at the helper.
Files: `src/lib/projects.ts`.
Depends on: nothing.
Verify: `npm run build` succeeds. Add a project through the existing form and confirm
`.praxis-projects.json` is byte-identical in shape to what the old code wrote (two-space indent,
same key order).

**1.2 — `DELETE /api/projects/:id`** *(small)*
Add the end-anchored `entryMatch` route with the `DELETE` branch and the `405` fallthrough.
Files: `src/server.ts`.
Depends on: 1.1.
Verify: `curl -X DELETE http://localhost:4173/api/projects/<real-id>` returns `200` with the
removed entry and the row is gone from the file. An unknown id returns `404`. `curl -X PUT` on the
same path returns `405`. The project's own directory is untouched — confirm with `ls` on it and by
opening a different project's board.

**1.3 — Tile restructure and the Delete control** *(medium)*
Split the tile into `div.tile` + `a.tile-link` + `div.tile-actions` + `div.tile-error`; wire the
Delete button through `window.confirm` and the new endpoint; add the CSS.
Files: `src/public/home.ts`, `src/public/styles.css`.
Depends on: 1.2.
Verify: tiles look and behave as before — clicking one still opens its board, Tab still reaches
each tile link and shows a focus ring. Delete asks for confirmation, cancelling does nothing, and
confirming removes the tile. Making the registry file read-only (`chmod 444`) and deleting shows
an error on that tile, leaves the tile in place, and leaves the file complete and parseable.

*Phase 1 is shippable on its own: the dashboard can add and delete projects.*

### Phase 2 — Rename, end to end

**2.1 — `renameProject`** *(small)*
Add `renameProject(id, name)` over the same `writeProjects` helper. Update the `name` comment in
`src/types/praxis-data.d.ts`.
Files: `src/lib/projects.ts`, `src/types/praxis-data.d.ts`.
Depends on: 1.1.
Verify: `npm run build` succeeds.

**2.2 — `PATCH /api/projects/:id`** *(medium)*
Add the `PATCH` branch, the name validation listed in the HTTP contract, and the log-label
parameter on `readRequestBody`.
Files: `src/server.ts`.
Depends on: 2.1, 1.2.
Verify: `curl -X PATCH -H 'Content-Type: application/json' -d '{"name":"Renamed"}'` returns `200`
and the new name. Each `400` case in the contract table returns its message and leaves the file
untouched — check `{}`, `{"name":""}`, `{"name":"   "}`, `{"name":42}`, a 101-character name, and
a name containing `\n`. `GET /api/projects/<id>/data` still returns the board payload for the same
id after the rename.

**2.3 — Inline rename in the tile** *(medium)*
Add the Rename button and the in-place edit mode with Save, Cancel, Enter and Escape; render
errors into `.tile-error`; add the CSS.
Files: `src/public/home.ts`, `src/public/styles.css`.
Depends on: 2.2, 1.3.
Verify: rename a tile, reload the page, the new name persists. The tile's link is still
`/board.html?project=<same-id>` and the board still opens. Escape and Cancel restore the original
name and write nothing. Submitting an empty name shows the server's message on that tile.

*Phase 2 completes the feature.*

### Phase 3 — Edge-path verification *(small)*

No new code is expected here; this is the deliberate pass over the paths that are easy to leave
untested because they need the registry file moved out of the way.
Files: none expected. Any fix found here lands in the file that owns the path.
Depends on: 2.3.
Verify, in order:

1. Move `.praxis-projects.json` aside. The self-tile appears. Rename it. The file now exists,
   contains exactly that one row with the new name, and the tile keeps its name after a reload.
2. Move the file aside again. The self-tile appears. Delete it. The file now exists and contains
   `{"projects": []}`, and the home page shows the "No projects yet" empty state
   (`src/public/home.ts:22-29`) — including after a reload. Confirm the dashboard repo's own files
   are untouched.
3. Delete the last remaining project when several exist; confirm the same empty state.
4. Open two browser tabs, delete a project in one, then delete the same project in the other.
   The second attempt reports the `404` on that tile and the list reloads without it.
5. Restore the registry file that was moved aside.

## Data & compatibility

- **Migration: none.** No field is added, removed, or retyped. Every entry written before this
  work is valid after it, and vice versa.
- **Backward compatibility: total.** A registry written by the new code is readable by the old
  code, and an old client reading a renamed entry simply displays the new name. Rolling back the
  code does not require rolling back the file.
- **Failed writes.** `writeProjects` writes a temporary file and renames it into place, so a
  failure leaves the previous registry whole rather than truncated. The exception propagates, the
  server returns `500`, and the client shows the error on the affected tile. The read guarantee at
  `src/lib/projects.ts:39-52` — a bad registry costs the list, never the app — is preserved,
  because the registry is never left in a state that needs that guarantee.
- **The one irreversible act.** A deleted registry row is gone; there is no undo buffer and none
  is planned. Recovery is re-pasting the path into the add form, which produces the same id
  because the id is a function of the path. Only `added` differs, and only if it is a different
  day. Recommend copying `.praxis-projects.json` before first testing delete, since it is
  gitignored and therefore not recoverable from git.
- **Rollback of the feature.** `git revert` the phase commits. The registry file needs no change:
  the worst residue is a project the user deleted (they re-add it) or a custom name they can no
  longer edit (it still displays).
- **Not reversible past Phase 3 step 2** in one specific sense: once the self-entry has been
  materialised into the file, deleting `.praxis-projects.json` is the only way back to the
  synthesised tile. That is a `rm` of a gitignored local file, not a code concern.

## Non-functional notes

- **Security.** Both endpoints are unauthenticated, like every existing endpoint, on a server
  bound to `127.0.0.1` (`src/server.ts:234`). Choosing `DELETE` and `PATCH` over `POST` action
  URLs has a side benefit: neither is a CORS-simple method, so a page on another origin cannot
  invoke them without a preflight this server never answers. This is a note, not a security
  control — `WS-18` owns the bind question, and if the bind is ever opened, these endpoints are
  among the reasons it needs authentication.
- **Input validation** happens at the route boundary, where `handleAddProject` already does it
  (`src/server.ts:86-98`), never inside the library.
- **Scale.** The registry is rewritten whole on every write, as it is today. At the expected size
  (tens of entries) that is a sub-millisecond write. At 10,000× that — roughly 1MB — it is still a
  single small synchronous write, and the home page renders a plain CSS grid. No pagination,
  streaming, or indexing is warranted, and none is planned.
- **Observability.** The existing `console.error` on each failure path is sufficient for a local
  single-user tool. Nothing new is added.

## Testing strategy

The repository has no test framework, no test files, and only two devDependencies (`typescript`,
`@types/node`). Adding a runner would be a new dependency and a separate decision, so this plan
verifies by hand, through the per-phase steps above. It records what a later test pass — the
write-tests skill, under its own workstream — would cover if a runner is adopted:

- **Unit, `src/lib/projects.ts`:** `removeProject` on a known id, on an unknown id, and on the
  synthesised self-entry; `renameProject` preserving `id`, `path` and `added`; `writeProjects`
  leaving the previous file intact when the rename step fails; `addProject` output unchanged after
  the repoint.
- **Integration, `src/server.ts`:** each row of the two contract tables above, driven against a
  temporary registry file — the status code and the resulting file contents together.
- **Manual only, `src/public/home.ts`:** there is no DOM harness in this repo, and the client
  logic is thin. Keyboard reachability of the tile link and both buttons, and the focus ring, are
  checked by hand in Phase 1.3 and Phase 2.3.

## Open questions

Numbered so they can be answered directly. Each phase above is buildable on the stated assumption
without waiting for these.

1. **Is 100 characters the right name cap?** Options: 100 (fits the tile at the narrowest grid
   column of 280px), 255, or no cap. *Recommendation: 100.* It is one constant in `src/server.ts`
   and can be widened at any time.
2. **Is `window.confirm` acceptable for the delete confirmation, or should it be a styled
   `<dialog>`?** The board page already has a native `<dialog>` pattern
   (`src/public/board.html:84`), so a styled confirmation is available at the cost of new markup in
   `index.html` and new CSS. *Recommendation: `window.confirm`.* It is one line, it cannot be
   dismissed by accident, and this is a local developer tool.
3. **Should deleting the self-entry be allowed at all?** As planned it is (Assumption A2), and it
   leaves the home page empty until something is added. The alternative is a `409` refusing to
   delete the entry whose path is the dashboard repo, which needs the client to know which entry
   that is. *Recommendation: allow it.* A visible button that always errors is worse than an empty
   list the user chose.
4. **Should the README be updated?** `README.md:40` describes `projects.ts` as "the project
   registry: read, find, add", which goes stale the moment `removeProject` lands.
   *Recommendation: a one-line edit to "read, find, add, rename, remove".* No task is authored for
   it in this plan, because documentation was not in the request.
5. **Should a rename be offered for a project whose directory no longer exists?** Today such a
   project still shows a tile and its board returns `410` (`src/server.ts:146-148`). As planned,
   both rename and delete work on it, which is arguably the main reason a user would want delete.
   *Recommendation: yes, leave both enabled;* no check on directory existence is planned for
   either endpoint.

## Final summary

- **Approach:** two new registry functions over one shared atomic writer, two new methods on one
  new id-scoped route, and two buttons per tile. Rename changes the display name only; the id and
  the path never move.
- **Size:** 3 phases, 7 tasks, roughly one sitting each for Phase 1 and Phase 2, plus a short
  verification pass. No new dependencies, no new files, no type or schema change.
- **Top risks:** (1) the tile must be restructured from an `<a>` into a container, which is the
  only place existing behaviour can regress — keyboard focus and the board link are the things to
  check; (2) a partial registry write would silently empty the project list, which is why the
  writer is temp-file-then-rename; (3) deleting the synthesised self-entry writes an empty
  registry and the self-tile does not come back.
- **Needs a decision:** the 100-character name cap (Q1), `window.confirm` versus a styled dialog
  (Q2), whether the self-entry may be deleted (Q3), and whether the README line is updated (Q4).

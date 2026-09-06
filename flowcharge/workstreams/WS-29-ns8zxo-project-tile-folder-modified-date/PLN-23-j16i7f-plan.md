---
id: PLN-23-j16i7f
type: plan
workstream: WS-29-ns8zxo
slug: project-tile-folder-modified-date
title: "Editable project folder path and a modified date on home-page tiles"
status: ready
created: 2026-08-15
updated: 2026-08-15
depends_on: []
links: []
---

# Editable project folder path and a modified date on home-page tiles

## Summary

Two changes to the home-page project tiles. First, the existing inline edit row gains a
second input for the project's folder path, so a user can repoint an entry at a different
directory without deleting and re-adding it. Second, each tile shows a modified date, but
only after the entry has really changed.

The chosen approach keeps a project's `id` stable across a path edit. The id is
`sha1(path)` truncated to 8 characters today (`src/lib/projects.ts:17`), and every
bookmarked board URL is `/board.html?project=<id>`. The purpose of this feature is to
repoint an entry *without losing the entry*, so an edit that silently invalidates the
entry's bookmarks would give the user the same outcome as delete-and-re-add, which is
exactly what they asked to avoid. The id therefore becomes "sha1 of the path at add time,
stable for the life of the row", and the two places that leaned on the old invariant are
changed to compare `path` directly.

`renameProject` becomes `updateProject`, a partial update over `name` and `path`. The four
inline path checks in `handleAddProject` become one shared validator used by both the add
handler and the edit handler. A new optional `updated?: string` field on `ProjectEntry`
carries the modified date, and the tile renders it only when it is present.

## Scope

### Acceptance criteria

Path editing:

1. A user who clicks the pencil button on a tile sees two inputs in the edit row: one
   pre-filled with the project's name, one pre-filled with its absolute folder path.
2. A user who changes the path to another absolute directory containing `flowcharge/` and
   saves sees the tile re-render with the new path, and the same name.
3. A bookmarked `/board.html?project=<id>` URL for that project still opens its board
   after the path edit, and the board now renders the *new* directory's `flowcharge/`.
4. A user who saves a path that is empty, starts with `~`, is relative, or has no
   `flowcharge/` folder under it sees the matching error on the tile, with the edit row still
   open and their typed values intact. The four messages are byte-identical to the ones the
   add form already produces.
5. A user who saves a path that another registry entry already owns sees an error naming
   the project that owns it, and no change is written.
6. A user who changes only the name and saves gets the same result as today: the name
   changes, the path is untouched, and no `flowcharge/` check runs against the stored path.
7. A user who re-pastes an already-registered path into the *add* form still gets the
   existing entry back rather than a duplicate row, including when that entry's path was
   changed by an edit.
8. A user who presses Enter in either input saves, and Escape in either input cancels and
   restores the tile.

Modified date:

9. A tile for an entry that has never been edited shows only its added line, exactly as
   today.
10. A tile for an entry whose name or path has been changed shows a second line,
    `Modified YYYY-MM-DD`, under the added line, in the same style as the added line.
11. A save that submits values identical to the stored ones does not stamp a modified date
    and does not write the registry.
12. The modified date is stamped for a name-only change as well as a path change.

### Out of scope

- The `hasPrxwork` gap: it is `fs.existsSync` on a `flowcharge` subpath
  (`src/lib/extract.ts:183-185`) and does not check that the target is a directory. Named
  out of scope by the brief. The shared validator reuses it exactly as it is.
- The `selfEntry()` persistence behaviour (`src/lib/projects.ts:24-32`): the synthesised
  self-entry becomes a real row on the first write. Named out of scope by the brief. The
  new update path inherits this behaviour unchanged, because it reads and writes through
  the same `readProjects`/`writeProjects` pair `renameProject` already uses.
- Any other project-entry feature: no reordering, no tags, no notes, no bulk edit.
- Introducing a test framework (see Open question 4).

**Out of scope (not actioned, flagged only):** `README.md:40` describes
`src/lib/projects.ts` as "read, find, add, rename, remove". Renaming `renameProject` to
`updateProject` makes that word stale. README is not in this feature's file list, so no
work is planned for it.

### Assumptions

These are taken as the most reasonable reading. Each would otherwise have been a question.

- **A1 — Release constraints.** This is a local, single-user developer tool. The only
  persistent state is `.praxis-projects.json` on the user's own machine, and it is
  gitignored (`README.md:55-56`). There is no production data, no live user, no migration
  tooling and no feature-flag mechanism in the codebase. The feature therefore ships whole,
  in one build, with no flag and no staged rollout.
- **A2 — Bookmark stability is the point.** The workstream states the user is about to edit
  a path and does not want to delete and re-add the entry
  (`workstream.md`, closing line). Keeping the entry's identity intact is read as part
  of that intent, not merely saving keystrokes.
- **A3 — Date format and source.** `updated` uses `new Date().toISOString().slice(0, 10)`,
  the identical expression `added` already uses (`src/lib/projects.ts:85`). It is a UTC
  date, so a late-evening edit in a positive-offset zone can stamp the next day. That is
  precisely how `added` already behaves, and consistency between the two lines is worth
  more than fixing it here.
- **A4 — The client sends only changed fields.** The save handler compares each input
  against the values it rendered from, and includes a key in the PATCH body only when it
  differs. If neither differs it closes the edit row without a request. This keeps a
  name-only edit from re-validating a stored path, so a user can still relabel an entry
  whose folder has since been moved away.
- **A5 — Empty PATCH body is a client error.** A PATCH carrying neither `name` nor `path`
  is a 400, not a silent no-op.
- **A6 — A claimed path is a conflict.** Editing a path to one another entry already owns
  returns 409 and writes nothing.
- **A7 — Nothing on disk is touched.** Editing a path rewrites one registry row. Neither
  the old directory nor the new one is read, moved, created or deleted, matching how
  `removeProject` is already documented (`src/lib/projects.ts:92-94`).
- **A8 — Path comparison stays byte-exact on the resolved string.** `path.resolve` is
  applied before comparing, as `addProject` already does (`src/lib/projects.ts:74`). Two
  differently-cased spellings of the same directory on a case-insensitive filesystem
  compare as different paths. This is exactly today's behaviour, because `sha1` of the
  string is equally case-sensitive, so it is not a regression.

## Design

### Data model

`ProjectEntry` (`src/types/praxis-data.d.ts:52-57`) gains one optional field, and the `id`
comment is corrected:

```ts
interface ProjectEntry {
  id: string;        // 8 lowercase hex chars: sha1 of the path the entry was ADDED with,
                     // truncated. Stable for the life of the row: editing `path` does not
                     // change it, so bookmarked /board.html?project=<id> URLs survive.
  name: string;      // display only, never an identifier
  path: string;      // absolute, path.resolve'd; editable after add
  added: string;     // YYYY-MM-DD, the day the row appeared
  updated?: string;  // YYYY-MM-DD, the day `name` or `path` last really changed.
                     // ABSENT until the first real change — an entry that has never been
                     // edited has no key, which is also every entry written before this
                     // feature existed.
}
```

Optional, not compared against `added`. Comparing the two would hide the modified line for
an edit made on the day of the add, because the values would be equal. Absence is the only
honest signal of "never edited", and it is what every existing row in
`.praxis-projects.json` already carries.

### Registry library contract — `src/lib/projects.ts`

`renameProject` (`src/lib/projects.ts:110-117`) is replaced by `updateProject`. It needs
three outcomes, not two, because "path already claimed" is a distinct answer from "no such
id", so the `ProjectEntry | undefined` return of the current function is no longer enough:

```ts
export interface ProjectUpdate {
  name?: string;   // already trimmed and validated by the caller
  path?: string;   // already trimmed and validated by the caller; NOT yet resolved
}

export type UpdateResult =
  | { ok: true; entry: ProjectEntry }
  | { ok: false; reason: 'not-found' }
  | { ok: false; reason: 'path-taken'; conflict: ProjectEntry };

export function updateProject(id: string, changes: ProjectUpdate): UpdateResult;
```

Semantics, in order:

1. Find the row by `id`. Missing → `{ ok: false, reason: 'not-found' }`.
2. If `changes.path` is present, `path.resolve` it. If any *other* row already holds that
   resolved path, return `{ ok: false, reason: 'path-taken', conflict }`. The row's own
   path never conflicts with itself.
3. Compute whether anything really changes: `name` differs from the stored name, or the
   resolved path differs from the stored path. If nothing differs, return
   `{ ok: true, entry }` **without writing** — no stamp, no disk write.
4. Apply the supplied fields, set `entry.updated` to today's date, and `writeProjects`.

`id` is never recomputed. `added` is never touched.

Why the duplicate check lives in the library rather than at the HTTP boundary: it is a
question about registry *state*, and the library is the only module that reads registry
state. `addProject` already makes exactly this kind of state decision inside the library
and reports it to the caller (`created: true | false`, `src/lib/projects.ts:73-90`).
Shape validation — trimming, length, absoluteness, `flowcharge/` presence — stays at the
boundary, which is where this codebase already puts it
(`src/lib/projects.ts:104-109` documents the split).

`addProject`'s idempotency check (`src/lib/projects.ts:78`) changes from comparing
`projectId(resolved)` against existing ids to comparing `resolved` against existing paths:

```ts
const existing = projects.find((p) => p.path === resolved);
```

This is required, not cosmetic. Once an id can outlive its path, an id comparison no longer
recognises a repointed project and re-adding its current path would create a second row for
the same directory. For every row whose path has never been edited the two comparisons give
identical answers, because for those rows `id === projectId(path)` still holds. `projectId`
keeps its single remaining caller inside `addProject` and `selfEntry`.

### HTTP contract — `src/server.ts`

`PATCH /api/projects/<id>` becomes a partial update. Request body:

| Field | Type | Required |
|---|---|---|
| `name` | string | no |
| `path` | string | no |

At least one must be present. Responses:

| Outcome | Status | Body |
|---|---|---|
| Updated, or nothing changed | 200 | `{ "project": { id, name, path, added, updated? } }` |
| Neither field present | 400 | `{ "error": "Send a JSON body with `name`, `path`, or both" }` |
| Name or path fails validation | 400 | `{ "error": "<the existing message>" }` |
| Unknown id | 404 | `{ "error": "Unknown project <id>" }` |
| Path owned by another entry | 409 | `{ "error": "<name> already uses that folder" }` |
| Registry write failed | 500 | `{ "error": "Could not write the project registry" }` |

Backward compatible with the only existing caller: a body of `{ name }` alone still
behaves exactly as today, including the 200 response shape. The 400 message for a missing
field is the one string that changes, because the endpoint now accepts two fields.

### Shared path validator — `src/server.ts`

The four checks currently inline in `handleAddProject` (`src/server.ts:94-112`) are lifted
into one function, called by both handlers:

```ts
type PathCheck = { ok: true; path: string } | { ok: false; error: string };

function validateProjectPath(candidate: unknown): PathCheck;
```

It performs, in order and with the existing message strings unchanged: the string-and-
non-empty check, `trim`, the leading-`~` rejection, `path.isAbsolute`, and `hasPrxwork`.
On success it returns the trimmed value, which is what gets stored. Presence is the
caller's decision, not the validator's: `handleAddProject` calls it unconditionally,
`handleUpdateProject` calls it only when the body carries a `path` key. This keeps the
add form's behaviour and messages byte-identical while removing the duplication.

The name checks (`trim`, `MAX_NAME_LENGTH`, `CONTROL_CHARS` — `src/server.ts:128,148-156`)
stay inline in the update handler, wrapped in a presence guard. There is still exactly one
caller, so extracting them would be an abstraction with nothing to share.

`handleRenameProject` (`src/server.ts:130-169`) is renamed `handleUpdateProject` and keeps
its position and its `readRequestBody` / try-catch structure. The route table entry at
`src/server.ts:217-220` changes only the function name.

### Home page — `src/public/home.ts`

The tile's edit row (`src/public/home.ts:126-189`) gains a second input. What changes:

- A `pathInput` is built next to `nameInput`, pre-filled through `.value` (never
  `innerHTML`, matching the comment at `src/public/home.ts:132`), with
  `aria-label` `'New folder path for ' + p.name`.
- The row order becomes name input, path input, Save, Cancel, matching the tile's own
  display order.
- `exitEditMode` restores both the hidden `.tile-name` span and a newly hidden `.tile-path`
  span, so edit mode does not show the path twice.
- The Enter/Escape keydown handler (`src/public/home.ts:174-182`) is attached to both
  inputs through a small local helper rather than duplicated.
- `save()` builds the body from changed fields only (assumption A4): include `name` when
  `nameInput.value !== p.name`, include `path` when `pathInput.value !== p.path`. If the
  body is empty, call `exitEditMode()` and return without a request.
- Everything else is unchanged. On success it still calls `loadProjects()`; on failure it
  still stays in edit mode with the message on the tile. **Because the id is stable, the
  client never has to read an id back out of the response** — this is the single largest
  simplification the chosen approach buys.

A third span is appended after the added span (`src/public/home.ts:88`), only when the
field is present:

```ts
if (p.updated) link.appendChild(el('span', 'tile-added', 'Modified ' + p.updated));
```

Reusing `.tile-added` is deliberate: the two lines are the same kind of metadata and must
look identical. No new class is introduced for it.

The pencil button's `aria-label` and `title` (`src/public/home.ts:94-95`) change from
`'Rename …'` to `'Edit …'`, because the button no longer only renames. See Open question 3.

### Styling — `src/public/styles.css`

`.tile-edit` already wraps (`src/public/styles.css:564-572`) and `.tile-edit input` already
flexes and shrinks (`:573-583`), so almost nothing is needed. One addition:

- A modifier for the path input giving it `flex: 1 1 100%` and `font-family: var(--font-mono)`,
  so it takes its own line in the narrowest 280px grid column and reads like the
  `.tile-path` span it replaces (`.tile-path` at `:599-604` sets the same mono family).

No new rule is needed for the modified line, because it reuses `.tile-added` (`:605-611`).

### Module boundaries

- `src/lib/projects.ts` knows the registry file and its shape. It must **not** know what a
  404 or a 409 is, must not validate input shape, and must not know a browser exists. It
  reports outcomes; the caller maps them to status codes. This is the split its own
  comments already describe (`src/lib/projects.ts:1-3, 104-109`).
- `src/server.ts` knows HTTP, validation and status mapping. It must **not** reach into the
  registry file itself, and must **not** duplicate the duplicate-path lookup that
  `updateProject` owns.
- `src/public/home.ts` knows the tile DOM and the API's JSON shapes. It must **not**
  recompute an id, derive one from a path, or hold any rule about what makes a path valid
  beyond the two instant-feedback checks the add form already has
  (`src/public/home.ts:2-3, 254-261`) — the server stays the authority.

### Non-functional notes

- **Security.** The path input is the same trust boundary as the existing add form: the
  server already accepts an arbitrary absolute path from the browser and reads it on this
  machine's filesystem. Editing a path grants no capability the add form did not already
  grant, so the README's existing warning about binding beyond loopback
  (`README.md:90-94`) still covers it accurately and needs no change.
- **Input size.** The PATCH body is bounded by the existing `MAX_BODY_BYTES` 8KB cap in
  `readRequestBody` (`src/server.ts:27, 60-65`), which the update handler already goes
  through. Two fields instead of one does not approach it.
- **Performance.** The duplicate-path scan is a linear pass over a list of hand-added
  projects. At 10,000x the expected size it is still a few thousand string comparisons per
  edit, against a file already read whole on every request.
- **Observability.** The existing per-handler `console.error` and the tile's own error line
  cover this. The one deliberate addition is that the 409 message names the conflicting
  project, so the user can find which tile already owns the folder without opening the JSON.

## Staged task breakdown

Riskiest first: the identity decision and the registry semantics land in Phase 1, where
they can be exercised directly before any UI depends on them.

### Phase 1 — Stable-id path editing, end to end on the server (medium)

**Build:**
- `src/types/praxis-data.d.ts`: correct the `id` comment and the `path` comment on
  `ProjectEntry`. Do **not** add `updated` yet — that belongs with Phase 3's slice.
- `src/lib/projects.ts`: replace `renameProject` with `updateProject` per the contract
  above, including the not-found, path-taken and no-change outcomes. Change `addProject`'s
  dedupe to compare resolved paths.
- `src/server.ts`: extract `validateProjectPath` and call it from `handleAddProject` with
  no change to its behaviour or messages. Rename `handleRenameProject` to
  `handleUpdateProject`, make both fields optional with an at-least-one guard, call the
  validator for `path`, keep the name checks inline behind a presence guard, and map
  `not-found` to 404 and `path-taken` to 409. Update the import and the route call site.

**Files:** `src/types/praxis-data.d.ts`, `src/lib/projects.ts`, `src/server.ts`.

**Depends on:** nothing.

**Verify** with `npm start` and curl, against a scratch registry:
- `PATCH {"path": "<another dir with flowcharge/>"}` returns 200; `GET /api/projects` shows
  the new path with the **same** id; `GET /api/projects/<same id>/data` returns the new
  directory's payload; the browser bookmark still opens the board (criteria 2, 3).
- `PATCH {"name": "X"}` alone behaves exactly as before (criterion 6).
- `PATCH {}` returns 400 (A5). `PATCH` on an unknown id returns 404.
- `PATCH {"path": "~/x"}`, `"relative/x"`, `""`, and a directory with no `flowcharge/` each
  return the same message the add form gives for that input (criterion 4).
- `PATCH {"path": "<path of another entry>"}` returns 409 naming that entry, and
  `.praxis-projects.json` is unchanged (criterion 5).
- After a path edit, POSTing that same path to `/api/projects` returns 200 with the
  existing entry, not 201 with a new row (criterion 7).

### Phase 2 — Path input in the tile edit row (small)

**Build:** the second input, the `.tile-path` hide/restore, the shared Enter/Escape
handler, the changed-fields-only body, and the CSS modifier for the path input.

**Files:** `src/public/home.ts`, `src/public/styles.css`.

**Depends on:** Phase 1 (the endpoint must accept `path`).

**Verify** in the browser at `http://localhost:4173`:
- The pencil button opens a row with both values pre-filled, and the tile's own name and
  path lines are hidden while it is open (criterion 1).
- Changing the path and saving re-renders the tile with the new path (criterion 2).
- Enter in either input saves; Escape in either input restores the tile untouched
  (criterion 8).
- A bad path leaves the row open with both typed values intact and the message on the tile
  (criterion 4).
- Saving with nothing changed closes the row and issues no request (visible in the network
  panel).
- The row still fits the narrowest column: shrink the window until the tile grid is at its
  280px minimum and confirm no horizontal overflow.

### Phase 3 — The modified date (small)

**Build:**
- `src/types/praxis-data.d.ts`: add `updated?: string` with its comment.
- `src/lib/projects.ts`: set `entry.updated` in `updateProject`'s write branch. The
  no-change branch from Phase 1 is what keeps an identical resubmit from stamping.
- `src/public/home.ts`: render the `Modified …` span when `p.updated` is present.

**Files:** `src/types/praxis-data.d.ts`, `src/lib/projects.ts`, `src/public/home.ts`.

**Depends on:** Phase 1 (the change detection) and Phase 2 (to exercise a path edit from
the UI).

**Verify** in the browser:
- A tile never edited shows only its added line (criterion 9).
- After a name change, the tile shows `Modified <today>` under the added line, in matching
  style (criteria 10, 12).
- After a path change, the same.
- Re-opening the edit row and saving the identical values leaves the date alone, and
  `.praxis-projects.json`'s modification time does not move (criterion 11).

## Data & compatibility

- **No migration.** `updated` is optional and additive. Every row already in a user's
  `.praxis-projects.json` is valid unchanged and correctly renders with no modified line.
  The `id` field is untouched by this feature for every existing row.
- **Existing consumers.** The only readers of `ProjectEntry` are `src/server.ts` and
  `src/public/home.ts`, both in scope. The only caller of `PATCH /api/projects/<id>` is
  `src/public/home.ts:148`, and the old `{ name }` body stays valid. Nothing outside
  `.praxis-projects.json` and the URL query string stores a project id.
- **The relaxed invariant.** After this feature, `id === projectId(path)` holds for every
  row except one whose path has been edited. The two places that relied on it —
  `addProject`'s dedupe and the type comment — are both changed in Phase 1. No third place
  exists; `projectId` has no other caller.
- **Rollback.** Reverting the code is safe for the data. `readProjects` parses whole
  objects and `writeProjects` re-serialises them, so an `updated` key written by this
  feature survives an older build untouched and simply goes unrendered. The one caveat is
  not reversible by code: if a path was edited before the rollback, that row's id no longer
  matches its path, and the restored id-based dedupe in `addProject` would let the same
  directory be added a second time under a different id. Recovery is to delete one of the
  two tiles. Given assumption A1 — one user, one machine, a gitignored file — this is an
  acceptable and clearly-stated risk rather than something to engineer around.
- **Concurrency.** Two browser tabs editing the same entry is last-write-wins over the
  whole file, exactly as `renameProject` and `removeProject` behave today. This feature
  does not widen that window and does not narrow it.

## Testing strategy

The repository has no test framework: `package.json` declares no `test` script and its only
devDependencies are `typescript` and `@types/node`. Every phase above is therefore verified
by observable behaviour, and each phase's Verify block is written to be run by hand.

If a later pass introduces one (see Open question 4), the highest-value targets, in order,
are all pure and need no HTTP:

- **`updateProject`, unit.** Not-found; path-taken against a *different* entry; the entry's
  own path not counting as taken; the no-change branch returning the entry without writing;
  `id` and `added` preserved across a path change; `updated` stamped on a real change only.
- **`addProject`, unit.** A path already present returns the existing entry with
  `created: false`, including after that entry's path was changed by an edit — the exact
  regression the dedupe change exists to prevent.
- **`validateProjectPath`, unit.** One case per rejection, asserting the exact message
  string, so the add form and the edit row can never drift apart.
- **The PATCH handler, integration.** The status-code table above, one case per row.

The DOM work in `src/public/home.ts` stays manually verified; the codebase has no browser
test harness and adding one is far outside this feature.

## Open questions

1. **Should the id stay stable across a path edit?** This is the central fork, and the plan
   commits to *yes*. The alternative is recomputing `id = sha1(new path)` on every path
   edit, which preserves the documented invariant exactly but silently breaks every
   bookmarked `/board.html?project=<id>` URL for that project — the same loss the user is
   trying to avoid by not deleting and re-adding. **Recommendation: keep the id stable.**
   If the invariant matters more than bookmarks, say so before Phase 1 starts: it changes
   `updateProject`, drops the `addProject` dedupe change, drops the duplicate-path check,
   and adds a client-side re-read of the id from the PATCH response.
2. **What should happen when the edited path is already owned by another entry?** The plan
   rejects with 409 and names the owner. The alternative is to adopt it silently, merging
   two tiles into one, which loses a row without asking. **Recommendation: reject.** A
   merge, if ever wanted, is a separate feature with its own confirmation step.
3. **Should the pencil button's label change from "Rename" to "Edit"?** It now edits two
   fields, so "Rename X" is misleading in the tooltip and to a screen reader. The change is
   two strings in `src/public/home.ts:94-95` plus the two Save/Cancel `aria-label`s that
   say "renaming". **Recommendation: change them to "Edit".** Low stakes, easy to reverse.
4. **Should this feature introduce a test suite?** The repo has none, and Node's built-in
   `node:test` would add no dependency. The plan assumes *no*, and verifies by hand, to stay
   inside the stated file scope. **Recommendation: keep it manual here**, and treat a test
   suite as its own workstream if wanted — `updateProject` is a good first target because it
   is pure and now has four distinct outcomes.

## Alternatives considered and rejected

- **Recompute the id from the new path on every path edit.** Rejected: it keeps
  `id = sha1(path)` true but breaks every bookmarked board URL for the edited project,
  silently. The prior workstream `project-delete-and-rename` chose to keep rename away from
  `path` for exactly this reason (`flowcharge/workstreams/project-delete-and-rename/plan.md:36-37`)
  and listed changing a path as out of scope; it documented the obstacle without solving it.
  Repointing an entry *while keeping the entry* is the whole request, and a new id gives the
  user the same practical outcome as the delete-and-re-add they asked to avoid. It would
  also force the client to re-read the id from the PATCH response before re-rendering, and
  introduce a collision check against existing ids.
- **A random or sequential id, decoupled from the path entirely.** Rejected: cleaner in
  principle, but it rewrites the identity of every existing row and breaks every bookmark
  that exists today — a much larger blast radius than the feature justifies, and it is a
  registry migration this feature was not asked to perform.
- **A separate "change path" control and endpoint, leaving rename untouched.** Rejected: the
  brief asks for the path to be editable "in the same edit UI", and it would give the tile
  three buttons and the server two near-identical validation paths. Extending the existing
  inline edit row is the pattern this codebase already established.
- **A modal dialog for editing.** Rejected: the codebase's established pattern for tile
  editing is an inline row (`src/public/home.ts:126-189`), the app has no modal component
  on the home page, and a second input fits the existing wrapping row with one CSS line.
- **Derive "modified" by comparing `updated` against `added` instead of storing an optional
  field.** Rejected on the investigation's reasoning, which holds: an edit on the same day
  as the add produces equal values and would wrongly hide the modified line. It would also
  require backfilling `updated` onto every existing row, turning an additive change into a
  migration.
- **Put the duplicate-path check at the HTTP boundary.** Rejected: it would make
  `src/server.ts` read and reason about registry rows, which is the library's single
  responsibility, and would split the read from the write across two modules. The library
  already reports this class of state decision to its caller in `addProject`.

## Final summary

Editing a project's folder path keeps the entry's id stable, so bookmarked board URLs
survive; `renameProject` becomes a partial-update `updateProject`, `addProject` dedupes on
path instead of id, and the add handler's four path checks become one shared validator used
by both handlers. A new optional `updated` field renders as a `Modified` line on the tile,
only after a real change.

Three phases, small-to-medium each: server and registry, then the path input, then the
modified date. Roughly one sitting per phase.

Top risks: (1) relaxing the `id = sha1(path)` invariant is not reversible in data — a row
whose path was edited would be re-addable as a duplicate under an older build; (2) the
`addProject` dedupe change is easy to overlook and is what prevents duplicate rows;
(3) there is no test suite, so every phase rests on hand-verification.

Needs your answer: question 1 (stable id versus recomputed id — the plan commits to stable),
question 2 (409 on a claimed path), question 3 ("Rename" becoming "Edit"), question 4 (no
test suite in this feature).
